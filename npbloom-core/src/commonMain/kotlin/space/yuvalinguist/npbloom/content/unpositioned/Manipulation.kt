package space.yuvalinguist.npbloom.content.unpositioned

import space.yuvalinguist.npbloom.content.*

typealias NodeTransformFunc = (oldNode: UnpositionedNode) -> UnpositionedNode
typealias TreeTransformFunc = (oldTree: UnpositionedTree) -> UnpositionedTree

sealed interface InsertedNode : NodeBase {
    override val label: NodeLabel
    val targetParentId: Id?
}

internal data class InsertedBranchingNode(
    override val id: Id,
    override val label: NodeLabel,
    override val targetParentId: Id?,
    val targetChildIds: Set<Id>,
    override val yAlignMode: YAlignMode = YAlignMode.Bottom,
) : InsertedNode

internal data class InsertedTerminalNode(
    override val id: Id,
    override val label: NodeLabel,
    override val targetParentId: Id?,
    val targetSlice: StringSlice,
    val triangle: Boolean,
    override val yAlignMode: YAlignMode = YAlignMode.Bottom,
) : InsertedNode

internal fun EntitySet<UnpositionedNode>.descendantIds(node: UnpositionedBranchingNode): Set<Id> {
    val directChildren = node.children.map { this[it] }
    val indirectDescendantIds = directChildren.filterIsInstance<UnpositionedBranchingNode>().flatMap(::descendantIds)
    return node.children + indirectDescendantIds
}

internal fun EntitySet<UnpositionedNode>.descendantsOf(node: UnpositionedBranchingNode): EntitySet<UnpositionedNode> =
    EntitySet(descendantIds(node).map { this[it]!! })

/**
 * Returns the IDs of all nodes that are descendants of folded branching nodes.
 * These nodes should be hidden when rendering the tree.
 */
internal fun EntitySet<UnpositionedNode>.descendantsOfFolded(): EntitySet<UnpositionedNode> =
    filter { it is UnpositionedBranchingNode && it.folded }
        .flatMap { descendantIds(it as UnpositionedBranchingNode) }
        .toSet()
        .let { EntitySet(it.map { this[it]!! }) }

internal fun EntitySet<UnpositionedNode>.toStrandedNode(node: UnpositionedNode): UnpositionedStrandedNode =
    when (node) {
        is UnpositionedBranchingNode ->
            UnpositionedFormerlyBranchingNode(node.id, node.label, node.offset, descendantsOf(node))

        is UnpositionedTerminalNode ->
            UnpositionedFormerlyTerminalNode(node.id, node.label, node.offset, node.slice, node.triangle)

        else -> UnpositionedPlainStrandedNode(node.id, node.label, node.offset)
    }

internal fun EntitySet<UnpositionedNode>.unassignAsChildren(
    nodeIds: Set<Id>,
    node: UnpositionedNode
): UnpositionedNode {
    if (node !is UnpositionedBranchingNode) return node

    val filteredChildren = node.children - nodeIds
    if (node.children == filteredChildren) return node

    if (filteredChildren.isEmpty()) return toStrandedNode(node)

    return node.copy(children = filteredChildren)
}

internal fun EntitySet<UnpositionedNode>.insertNode(insertedNode: InsertedNode): EntitySet<UnpositionedNode> {
    val nodeMapWithNewNode: EntitySet<UnpositionedNode> = when (insertedNode) {
        is InsertedBranchingNode -> mapToNewEntitySet {
            if (it is UnpositionedBranchingNode) it.copy(children = it.children - insertedNode.targetChildIds)
            else it
        } + UnpositionedBranchingNode(
            insertedNode.id,
            insertedNode.label,
            TreeCoordsOffset.ZERO,
            insertedNode.targetChildIds,
        )

        is InsertedTerminalNode -> this + UnpositionedTerminalNode(
            insertedNode.id,
            insertedNode.label,
            TreeCoordsOffset.ZERO,
            insertedNode.targetSlice,
            insertedNode.triangle,
        )
    }
    return if (insertedNode.targetParentId != null) {
        nodeMapWithNewNode.transformNodes(setOf(insertedNode.targetParentId!!)) {
            if (it is UnpositionedBranchingNode) it.copy(children = it.children + insertedNode.id)
            else it
        }
    } else nodeMapWithNewNode
}

internal fun EntitySet<UnpositionedNode>.transformNodes(
    nodeIds: Set<Id>,
    transformFunc: NodeTransformFunc,
): EntitySet<UnpositionedNode> =
    nodeIds.fold(this) { transformedNodes, nodeId ->
        if (nodeId in this) transformedNodes + transformFunc(this[nodeId]!!)
        else transformedNodes
    }

internal fun EntitySet<UnpositionedNode>.deleteNodes(nodeIds: Set<Id>): EntitySet<UnpositionedNode> {
    if (nodeIds.isEmpty() || isEmpty()) return this
    val filteredNodes = filter { it.id !in nodeIds }
    return filteredNodes.mapToNewEntitySet { unassignAsChildren(nodeIds, it) }
}

internal fun EntitySet<UnpositionedTree>.transformTrees(
    treeIds: Set<Id>,
    transformFunc: TreeTransformFunc,
): EntitySet<UnpositionedTree> =
    treeIds.fold(this) { transformedTrees, treeId ->
        if (treeId in this) transformedTrees + transformFunc(this[treeId]!!)
        else transformedTrees
    }

internal fun EntitySet<UnpositionedTree>.deleteTrees(treeIds: Set<Id>): EntitySet<UnpositionedTree> =
    if (treeIds.isEmpty() || isEmpty()) this else filter { it.id !in treeIds }
