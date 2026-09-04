@file:OptIn(ExperimentalJsExport::class)

package space.yuvalinguist.npbloom.content.positioned

import space.yuvalinguist.npbloom.content.*
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport

typealias PlotX = Double
typealias PlotY = Double
typealias TreeX = Double
typealias TreeY = Double
typealias Width = Double

@JsExport
sealed interface PositionedNode : NodeBase, WithPositionInTree

@JsExport
data class PositionedBranchingNode(
    override val id: Id,
    override val label: NodeLabel,
    override val position: CoordsInTree,
    internal val children: Set<Id> = emptySet(),
    override val yAlignMode: YAlignMode = YAlignMode.Bottom,
) : PositionedNode {
    val childrenAsArray = children.toTypedArray()

    fun withChildrenFromArray(children: Array<Id>) =
        copy(id = id, label = label, position = position, children = children.toSet())

    override fun withPosition(treeX: TreeX, treeY: TreeY) = copy(position = CoordsInTree(treeX, treeY))
}

@JsExport
data class PositionedTerminalNode(
    override val id: Id,
    override val label: NodeLabel,
    override val position: CoordsInTree,
    val slice: StringSlice,
    val triangle: TreeXRange? = null,
    val folded: Boolean = false,
    override val yAlignMode: YAlignMode = YAlignMode.Bottom,
) : PositionedNode {
    override fun withPosition(treeX: TreeX, treeY: TreeY) = copy(position = CoordsInTree(treeX, treeY))
}

@JsExport
data class PositionedStrandedNode(
    override val id: Id,
    override val label: NodeLabel,
    override val position: CoordsInTree,
    override val yAlignMode: YAlignMode = YAlignMode.Bottom,
) : PositionedNode {
    override fun withPosition(treeX: TreeX, treeY: TreeY) = copy(position = CoordsInTree(treeX, treeY))
}
