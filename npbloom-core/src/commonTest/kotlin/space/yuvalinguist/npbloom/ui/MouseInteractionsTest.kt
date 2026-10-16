package space.yuvalinguist.npbloom.ui

import space.yuvalinguist.npbloom.content.EntitySet
import space.yuvalinguist.npbloom.content.StringSlice
import space.yuvalinguist.npbloom.content.positioned.CoordsInPlot
import space.yuvalinguist.npbloom.content.positioned.applyNodePositionsToPlot
import space.yuvalinguist.npbloom.content.unpositioned.NodeBoundEnclosureShape
import space.yuvalinguist.npbloom.content.unpositioned.TreeCoordsOffset
import space.yuvalinguist.npbloom.content.unpositioned.UnpositionedPlot
import space.yuvalinguist.npbloom.content.unpositioned.UnpositionedTerminalNode
import space.yuvalinguist.npbloom.content.unpositioned.UnpositionedTree
import space.yuvalinguist.npbloom.mockStrWidth
import kotlin.test.Test
import kotlin.test.assertIs

class MouseInteractionsTest {
    private val plot = applyNodePositionsToPlot(
        ::mockStrWidth,
        UnpositionedPlot(
            trees = EntitySet(
                UnpositionedTree(
                    id = "tree1",
                    sentence = "Noun verbs.",
                    nodes = EntitySet(
                        UnpositionedTerminalNode("a", "N", TreeCoordsOffset.ZERO, StringSlice(0, 4)),
                    ),
                    coordsInPlot = CoordsInPlot.ZERO,
                ),
            ),
        ),
    )

    // Dragging an enclosure tool around a single node should always produce a NodeBoundEnclosureShape,
    // not a FreeStandingPlotShape, regardless of which corner of the rectangle the drag started from.
    @Test
    fun createShapeFromDragDetectsEnclosedNodeRegardlessOfDragDirection() {
        val topLeft = CoordsInPlot(-50.0, -50.0)
        val bottomRight = CoordsInPlot(50.0, 50.0)
        val topRight = CoordsInPlot(bottomRight.plotX, topLeft.plotY)
        val bottomLeft = CoordsInPlot(topLeft.plotX, bottomRight.plotY)

        val dragDirections = listOf(
            "top-left to bottom-right" to (topLeft to bottomRight),
            "bottom-right to top-left" to (bottomRight to topLeft),
            "top-right to bottom-left" to (topRight to bottomLeft),
            "bottom-left to top-right" to (bottomLeft to topRight),
        )

        for ((description, drag) in dragDirections) {
            val (start, end) = drag
            val shape = createShapeFromDrag(plot, ShapeTool.RoundedRectangle, start, end)
            assertIs<NodeBoundEnclosureShape>(shape, "Expected a NodeBoundEnclosureShape when dragging $description")
        }
    }
}
