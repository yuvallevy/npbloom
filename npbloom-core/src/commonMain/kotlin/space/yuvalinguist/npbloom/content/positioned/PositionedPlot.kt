@file:OptIn(ExperimentalJsExport::class)

package space.yuvalinguist.npbloom.content.positioned

import space.yuvalinguist.npbloom.NoSuchTreeException
import space.yuvalinguist.npbloom.content.EntitySet
import space.yuvalinguist.npbloom.content.Id
import space.yuvalinguist.npbloom.content.NodeIndicatorInPlot
import space.yuvalinguist.npbloom.content.unpositioned.DrawablePlotShape
import space.yuvalinguist.npbloom.content.unpositioned.PersistentPlotShape
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport

@JsExport
data class PositionedPlot(
    val trees: EntitySet<PositionedTree>,
    val shapes: EntitySet<DrawablePlotShape> = EntitySet(),
) {
    val treesAsArray get() = trees.toJsArray()

    fun tree(treeId: Id) = trees[treeId] ?: throw NoSuchTreeException(treeId)

    operator fun contains(treeId: Id) = treeId in trees

    /**
     * Returns the drawable form of a shape that is not part of this plot (yet).
     * Used for previewing shape creation.
     */
    fun positionShape(shape: PersistentPlotShape): DrawablePlotShape? = applyPositionToShape(trees, shape)

    /**
     * Returns a set of node indicators referring to nodes matching the given predicate.
     */
    fun filterNodeIndicatorsAsArray(predicate: (tree: PositionedTree, node: PositionedNode) -> Boolean) =
        trees.flatMap { tree ->
            tree.filterNodes { predicate(tree, it) }.ids.map { NodeIndicatorInPlot(tree.id, it) }
        }.toTypedArray()

    internal fun filterNodeIndicators(predicate: (tree: PositionedTree, node: PositionedNode) -> Boolean) =
        filterNodeIndicatorsAsArray(predicate).toSet()
}
