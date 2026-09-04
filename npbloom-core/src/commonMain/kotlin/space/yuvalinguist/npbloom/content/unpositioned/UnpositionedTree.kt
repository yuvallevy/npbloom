@file:OptIn(ExperimentalJsExport::class)

package space.yuvalinguist.npbloom.content.unpositioned

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import space.yuvalinguist.npbloom.NoSuchNodeException
import space.yuvalinguist.npbloom.content.*
import space.yuvalinguist.npbloom.content.positioned.CoordsInPlot
import space.yuvalinguist.npbloom.content.generateNodeId
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlin.js.JsName

@JsExport
@Serializable
data class UnpositionedTree(
    @SerialName("i") override val id: Id,
    @SerialName("s") override val sentence: Sentence,
    @SerialName("n") val nodes: EntitySet<UnpositionedNode>,
    @SerialName("-") val strikethroughs: List<StringSlice> = emptyList(),
    @SerialName("o") val coordsInPlot: CoordsInPlot = CoordsInPlot.ZERO,
) : TreeBase {
    internal val nodeIds get() = nodes.ids

    val nodesAsArray get() = nodes.toJsArray()

    val strikethroughsAsArray get() = strikethroughs.toTypedArray()

    val nodeCount get() = nodes.size

    val hasNodes get() = nodes.isNotEmpty()

    fun node(nodeId: Id) = nodes[nodeId] ?: throw NoSuchNodeException(nodeId)

    internal operator fun contains(nodeId: Id) = nodeId in nodes

    internal fun setNode(node: UnpositionedNode) = copy(nodes = nodes + node)

    internal fun removeNode(nodeId: Id) = copy(nodes = nodes - nodeId)

    internal fun changePosition(offsetD: PlotCoordsOffset) = copy(coordsInPlot = coordsInPlot + offsetD)

    fun anyNodes(predicate: (node: UnpositionedNode) -> Boolean) = nodes.any(predicate)

    /**
     * Returns whether ancestorNodeId dominates descendantNodeId in the tree.
     */
    private fun dominates(ancestorNodeId: Id, descendantNodeId: Id): Boolean =
        (node(ancestorNodeId) as? UnpositionedBranchingNode)
            ?.let {
                it.children.contains(descendantNodeId) ||
                        it.children.any { childId -> dominates(childId, descendantNodeId) }
            } ?: false

    /**
     * Inserts the given node into the tree, assigning it the given ID.
     */
    internal fun insertNode(node: InsertedNode): UnpositionedTree =
        copy(nodes = nodes.insertNode(node))

    /**
     * Transforms the node with the given ID using the given transform function
     * at any point in the given tree.
     */
    internal fun transformNode(nodeId: Id, transformFunc: NodeTransformFunc): UnpositionedTree =
        copy(nodes = nodes.transformNodes(setOf(nodeId), transformFunc))

    /**
     * Transforms the nodes with the given IDs using the given transform function
     * at any point in the given tree.
     */
    internal fun transformNodes(nodeIds: Set<Id>, transformFunc: NodeTransformFunc): UnpositionedTree =
        copy(nodes = nodes.transformNodes(nodeIds, transformFunc))

    /**
     * Transforms the children of the nodes with the given IDs using the given transform function
     * at any point in the given tree.
     */
    internal fun transformChildrenOfNodes(nodeIds: Set<Id>, transformFunc: NodeTransformFunc): UnpositionedTree =
        copy(nodes = nodes.transformNodes(getChildNodeIds(nodeIds), transformFunc))

    /**
     * Transforms all nodes in the given tree using the given transform function.
     */
    internal fun transformAllNodes(transformFunc: NodeTransformFunc): UnpositionedTree =
        copy(nodes = EntitySet(nodes.map(transformFunc)))

    /**
     * Deletes the nodes with the given IDs from the given tree.
     */
    internal fun deleteNodes(nodeIds: Set<Id>): UnpositionedTree =
        copy(nodes = nodes.deleteNodes(nodeIds))

    /**
     * Creates parent-child relationships between the given parent node and child nodes.
     * If any of the nodes to be adopted is already a child of another node, that relationship is severed first.
     * If any node ends up without children after the change, it becomes stranded.
     */
    internal fun adoptNodes(adoptingNodeId: Id, adoptedNodeIds: Set<Id>): UnpositionedTree =
        if (adoptingNodeId in adoptedNodeIds) this  // can't adopt yourself
        else {
            val treeWithoutExistingConnections =
                transformAllNodes { nodes.unassignAsChildren(adoptedNodeIds, it) }
            treeWithoutExistingConnections.transformNode(adoptingNodeId) {
                UnpositionedBranchingNode(
                    id = it.id,
                    label = it.label,
                    offset = TreeCoordsOffset.ZERO,
                    children = (if (it is UnpositionedBranchingNode) it.children else emptySet()) + adoptedNodeIds,
                )
            }
        }

    /**
     * Cuts parent-child relationships between the given parent node and child nodes.
     * If any node ends up without children after the change, it becomes stranded.
     */
    internal fun disownNodes(disowningNodeId: Id, disownedNodeIds: Set<Id>): UnpositionedTree =
        if (disowningNodeId in disownedNodeIds) this  // can't disown yourself
        else transformNode(disowningNodeId) { node -> nodes.unassignAsChildren(disownedNodeIds, node) }

    internal fun filterNodeIdsByNode(predicate: (node: UnpositionedNode) -> Boolean): Set<Id> =
        nodes.filter(predicate).ids

    internal fun getParentNodeIds(nodeIds: Set<Id>): Set<Id> =
        filterNodeIdsByNode { node ->
            node is UnpositionedBranchingNode && nodeIds.any { selectedNodeId -> selectedNodeId in node.children }
        }

    internal fun getChildNodeIds(nodeIds: Set<Id>): Set<Id> =
        nodeIds.flatMap { nodeId ->
            val node = nodes[nodeId]
            if (node is UnpositionedBranchingNode) node.children else emptySet()
        }.toSet()

    /**
     * Finds the ID of the first (lowest) ancestor of the given node that has more than one child.
     * If the node has no such ancestor, returns null.
     */
    private fun getFirstMultiBranchingAncestorId(nodeId: Id): Id? =
        getParentNodeIds(setOf(nodeId)).singleOrNull()
            ?.let { parentId ->
                val parent = node(parentId) as UnpositionedBranchingNode
                if (parent.children.size > 1) parentId
                else getFirstMultiBranchingAncestorId(parentId)
            }

    /**
     * Returns whether cCommandingNodeId c-commands cCommandedNodeId in the tree.
     * This is true if:
     * 1. Neither node dominates the other.
     * 2. The first ancestor of cCommandingNodeId that has more than one child dominates cCommandedNodeId.
     */
    private fun cCommands(cCommandingNodeId: Id, cCommandedNodeId: Id): Boolean =
        cCommandingNodeId != cCommandedNodeId &&
                !dominates(cCommandingNodeId, cCommandedNodeId) && !dominates(cCommandedNodeId, cCommandingNodeId) &&
                getFirstMultiBranchingAncestorId(cCommandingNodeId)?.let { dominates(it, cCommandedNodeId) } == true

    /**
     * Returns the set of IDs of nodes that c-command the node with the given ID.
     */
    internal fun getCCommandingNodeIds(nodeId: Id): Set<Id> = filterNodeIdsByNode { cCommands(it.id, nodeId) }

    /**
     * Returns the set of IDs of nodes that the node with the given ID c-commands.
     */
    internal fun getCCommandedNodeIds(nodeId: Id): Set<Id> = filterNodeIdsByNode { cCommands(nodeId, it.id) }

    @JsName("getNodeIdsAssignedToSliceAsKtSet")
    fun getNodeIdsAssignedToSlice(slice: StringSlice): Set<Id> =
        // If the slice is of length 0 (as in a zero-length selection),
        if (slice.isZeroLength)
        // check whether it is within the node slice or at either of its boundaries
            filterNodeIdsByNode { node -> node is UnpositionedTerminalNode && node.slice.start <= slice.start && slice.start <= node.slice.endExclusive }
        // otherwise use a simple overlap check where adjacent slices are not counted as overlapping
        else filterNodeIdsByNode { node -> node is UnpositionedTerminalNode && slice overlapsWith node.slice }

    @JsName("getNodeIdsAssignedToSlice")
    fun getNodeIdsAssignedToSliceAsArray(slice: StringSlice): Array<Id> =
        getNodeIdsAssignedToSlice(slice).toTypedArray()

    internal fun findSliceStart(nodeId: Id): SliceStart? =
        (nodes[nodeId] as? UnpositionedTerminalNode)?.slice?.start
            ?: (nodes[nodeId] as? UnpositionedBranchingNode)?.children?.mapNotNull(::findSliceStart)?.minOrNull()

    private fun findSliceEndExclusive(nodeId: Id): SliceEndExclusive? =
        (nodes[nodeId] as? UnpositionedTerminalNode)?.slice?.endExclusive
            ?: (nodes[nodeId] as? UnpositionedBranchingNode)?.children?.mapNotNull(::findSliceEndExclusive)?.maxOrNull()

    fun findSlice(nodeId: Id): StringSlice? {
        val start = findSliceStart(nodeId)
        val endExclusive = findSliceEndExclusive(nodeId)
        if (start != null && endExclusive != null) return StringSlice(start, endExclusive)
        return null
    }

    fun regenerateNodeIds(): UnpositionedTree {
        val newNodeIds = nodeIds.associateWith { generateNodeId() }
        return transformAllNodes {
            if (it is UnpositionedBranchingNode)
                it.withId(newNodeIds.getValue(it.id)).copy(children = it.children.map(newNodeIds::getValue).toSet())
            else it.withId(newNodeIds.getValue(it.id))
        }
    }
}
