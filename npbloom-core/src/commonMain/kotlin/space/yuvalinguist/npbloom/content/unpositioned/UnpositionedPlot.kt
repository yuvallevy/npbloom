@file:OptIn(ExperimentalJsExport::class)

package space.yuvalinguist.npbloom.content.unpositioned

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import space.yuvalinguist.npbloom.NoSuchTreeException
import space.yuvalinguist.npbloom.content.EntitySet
import space.yuvalinguist.npbloom.content.Id
import space.yuvalinguist.npbloom.content.NodeIndicatorInPlot
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport
import kotlin.js.JsName

@JsExport
@Serializable
data class UnpositionedPlot internal constructor(
    @SerialName("t") val trees: EntitySet<UnpositionedTree> = EntitySet(),
    @SerialName("s") val shapes: EntitySet<PersistentPlotShape> = EntitySet(),
) {
    val isEmpty get() = trees.isEmpty() && shapes.isEmpty()

    val treesAsArray get() = trees.toJsArray()

    val treeCount get() = trees.size

    fun tree(treeId: Id) = trees[treeId] ?: throw NoSuchTreeException(treeId)

    internal operator fun contains(treeId: Id) = treeId in trees

    internal operator fun contains(nodeIndicator: NodeIndicatorInPlot) =
        nodeIndicator.treeId in this && nodeIndicator.nodeId in tree(nodeIndicator.treeId)

    internal fun setTree(tree: UnpositionedTree) = copy(trees = trees + tree)

    internal fun removeTree(treeId: Id) = copy(trees = trees - treeId)

    /**
     * Returns a list of tree and node IDs referring to the parents of the given nodes.
     */
    internal fun getParentNodeIds(nodeIndicators: Set<NodeIndicatorInPlot>): Set<NodeIndicatorInPlot> =
        groupNodeIdsByTree(nodeIndicators).flatMap { (treeId, nodeIds) ->
            trees[treeId]!!.getParentNodeIds(nodeIds).map { NodeIndicatorInPlot(treeId, it) }
        }.toSet()

    /**
     * Returns a list of tree and node IDs referring to the children of the given nodes.
     */
    internal fun getChildNodeIds(nodeIndicators: Set<NodeIndicatorInPlot>): Set<NodeIndicatorInPlot> =
        groupNodeIdsByTree(nodeIndicators).flatMap { (treeId, nodeIds) ->
            trees[treeId]!!.getChildNodeIds(nodeIds).map { NodeIndicatorInPlot(treeId, it) }
        }.toSet()

    /**
     * Returns whether all given nodes are top-level nodes.
     */
    @JsName("allTopLevelByKtSet")
    fun allTopLevel(nodeIndicators: Set<NodeIndicatorInPlot>): Boolean =
        this.getParentNodeIds(nodeIndicators).isEmpty()

    fun allTopLevel(nodeIndicators: Array<NodeIndicatorInPlot>): Boolean =
        this.getParentNodeIds(nodeIndicators.toSet()).isEmpty()

    /**
     * Transforms the nodes with the given indicators using the given transform function
     * at any point in any tree in the given plot.
     */
    internal fun transformNodes(
        nodeIndicators: Set<NodeIndicatorInPlot>,
        transformFunc: NodeTransformFunc,
    ): UnpositionedPlot =
        copy(
            trees = trees + groupNodeIdsByTree(nodeIndicators).mapValues { (treeId, nodeIds) ->
                trees[treeId]!!.transformNodes(nodeIds, transformFunc)
            }.values
        )

    /**
     * Transforms the children of the nodes with the given indicators using the given transform function
     * at any point in any tree in the given plot.
     */
    internal fun transformChildrenOfNodes(
        nodeIndicators: Set<NodeIndicatorInPlot>,
        transformFunc: NodeTransformFunc,
    ): UnpositionedPlot =
        copy(
            trees = trees + groupNodeIdsByTree(nodeIndicators).mapValues { (treeId, nodeIds) ->
                trees[treeId]!!.transformChildrenOfNodes(nodeIds, transformFunc)
            }.values
        )

    /**
     * Deletes the nodes with the given indicators from the given plot.
     */
    internal fun deleteNodes(nodeIndicators: Set<NodeIndicatorInPlot>) =
        copy(
            trees = trees + groupNodeIdsByTree(nodeIndicators).mapValues { (treeId, nodeIds) ->
                trees[treeId]!!.deleteNodes(nodeIds)
            }.values
        )

    /**
     * Transforms the trees with the given IDs in the given plot using the given transform function.
     */
    internal fun transformTrees(treeIds: Set<Id>, transformFunc: TreeTransformFunc): UnpositionedPlot =
        copy(trees = trees.transformTrees(treeIds, transformFunc))

    /**
     * Deletes the trees with the given IDs from the given plot.
     */
    internal fun deleteTrees(treeIds: Set<Id>) = copy(trees = trees.deleteTrees(treeIds))

    // Shape operations

    val shapesAsArray get() = shapes.toJsArray()

    internal fun containsShape(shapeId: Id) = shapeId in shapes

    internal fun setShape(shape: PersistentPlotShape) = copy(shapes = shapes + shape)

    internal fun removeShape(shapeId: Id) = copy(shapes = shapes - shapeId)

    internal fun transformShapes(
        shapeIds: Set<Id>,
        transformFunc: (PersistentPlotShape) -> PersistentPlotShape,
    ): UnpositionedPlot = copy(
        shapes = shapes + shapes.filter { it.id in shapeIds }.map(transformFunc)
    )

    internal fun deleteShapes(shapeIds: Set<Id>) = copy(shapes = shapes - shapeIds)
}

/**
 * Returns the given list of tree and node IDs as a mapping from tree ID to node IDs.
 */
private fun groupNodeIdsByTree(nodeIndicators: Set<NodeIndicatorInPlot>): Map<Id, Set<Id>> =
    nodeIndicators.groupBy { it.treeId }.mapValues { (_, nodeIndicators) -> nodeIndicators.map { it.nodeId }.toSet() }
