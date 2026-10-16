package space.yuvalinguist.npbloom.content.positioned

import space.yuvalinguist.npbloom.content.EntitySet
import space.yuvalinguist.npbloom.content.NodeIndicatorInPlot
import space.yuvalinguist.npbloom.content.StringSlice
import space.yuvalinguist.npbloom.content.YAlignMode
import space.yuvalinguist.npbloom.content.unpositioned.*
import space.yuvalinguist.npbloom.mockStrWidth
import space.yuvalinguist.npbloom.ui.NODE_AREA_HEIGHT
import space.yuvalinguist.npbloom.ui.NODE_AREA_RELATIVE_X
import space.yuvalinguist.npbloom.ui.NODE_AREA_RELATIVE_Y
import space.yuvalinguist.npbloom.ui.NODE_AREA_WIDTH
import space.yuvalinguist.npbloom.ui.NODE_ENCLOSURE_MARGIN_X
import space.yuvalinguist.npbloom.ui.NODE_ENCLOSURE_MARGIN_Y
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class PositioningTest {
    private val treeWithTerminalNodes = UnpositionedTree(
        id = "O29",
        sentence = "Noun verbs.",
        nodes = EntitySet(
            UnpositionedTerminalNode("a", "N", TreeCoordsOffset.ZERO, StringSlice(0, 4)),
            UnpositionedTerminalNode("b", "V", TreeCoordsOffset(5.0, 0.0), StringSlice(5, 10)),
        ),
        coordsInPlot = CoordsInPlot.ZERO,
    )

    private val treeWithTriangleNodes = UnpositionedTree(
        id = "oqYi7",
        sentence = "Noun verb phrases.",
        nodes = EntitySet(
            UnpositionedTerminalNode("a", "N", TreeCoordsOffset(0.0, -10.0), StringSlice(0, 4)),
            UnpositionedTerminalNode("b", "VP", TreeCoordsOffset.ZERO, StringSlice(5, 17), true),
        ),
        coordsInPlot = CoordsInPlot.ZERO,
    )

    private val treeWithStrandedNodes = UnpositionedTree(
        id = "7NI69oA",
        sentence = "Noun verbs.",
        nodes = EntitySet(
            UnpositionedFormerlyBranchingNode("c", "S", TreeCoordsOffset.ZERO, treeWithTerminalNodes.nodes),
        ),
        coordsInPlot = CoordsInPlot.ZERO,
    )

    private val treeWithBranchingNodes = UnpositionedTree(
        id = "BJcX",
        sentence = "Noun verbs.",
        nodes = EntitySet(
            UnpositionedTerminalNode("a", "N", TreeCoordsOffset.ZERO, StringSlice(0, 4)),
            UnpositionedTerminalNode("b", "V", TreeCoordsOffset(5.0, 0.0), StringSlice(5, 10)),
            UnpositionedBranchingNode("c", "S", TreeCoordsOffset.ZERO, setOf("a", "b")),
        ),
        coordsInPlot = CoordsInPlot.ZERO,
    )

    private val treeWithBranchingAndTriangleNodes = UnpositionedTree(
        id = "926mr",
        sentence = "Noun verb phrases.",
        nodes = EntitySet(
            UnpositionedTerminalNode("a", "N", TreeCoordsOffset(0.0, -10.0), StringSlice(0, 4)),
            UnpositionedTerminalNode("b", "VP", TreeCoordsOffset.ZERO, StringSlice(5, 17), true),
            UnpositionedBranchingNode("c", "S", TreeCoordsOffset.ZERO, setOf("a", "b")),
        ),
        coordsInPlot = CoordsInPlot.ZERO,
    )

    private val treeWithVerticallyAlignedNode = UnpositionedTree(
        id = "926mr",
        sentence = "Noun verbs.",
        nodes = EntitySet(
            UnpositionedTerminalNode("a", "N", TreeCoordsOffset.ZERO, StringSlice(0, 4), yAlignMode = YAlignMode.Top),
            UnpositionedTerminalNode("d", "V", TreeCoordsOffset.ZERO, StringSlice(5, 10)),
            UnpositionedBranchingNode("b", "VP", TreeCoordsOffset.ZERO, setOf("d")),
            UnpositionedBranchingNode("c", "S", TreeCoordsOffset.ZERO, setOf("a", "b")),
        ),
        coordsInPlot = CoordsInPlot.ZERO,
    )

    private val treeWithFoldedBranchingNodes = UnpositionedTree(
        id = "foldedTree",
        sentence = "Long phrase verbs.",
        nodes = EntitySet(
            UnpositionedTerminalNode("a", "A", TreeCoordsOffset.ZERO, StringSlice(0, 4)),
            UnpositionedTerminalNode("b", "N", TreeCoordsOffset.ZERO, StringSlice(5, 11)),
            UnpositionedTerminalNode("c", "V", TreeCoordsOffset.ZERO, StringSlice(12, 17)),
            UnpositionedBranchingNode("d", "AP", TreeCoordsOffset.ZERO, setOf("a")),
            UnpositionedBranchingNode("e", "NP", TreeCoordsOffset.ZERO, setOf("d", "b"), folded = true),
            UnpositionedBranchingNode("f", "VP", TreeCoordsOffset.ZERO, setOf("c")),
            UnpositionedBranchingNode("g", "S", TreeCoordsOffset.ZERO, setOf("e", "f")),
        ),
        coordsInPlot = CoordsInPlot.ZERO,
    )

    @Test
    fun positionTerminalNodes() {
        val result = applyNodePositionsToTree(::mockStrWidth, treeWithTerminalNodes)
        assertEquals(CoordsInTree(18.0, -2.0), result.node("a").position)
        assertEquals(CoordsInTree(62.0, -2.0), result.node("b").position)
    }

    @Test
    fun positionTriangleNodes() {
        val result = applyNodePositionsToTree(::mockStrWidth, treeWithTriangleNodes)
        assertEquals(CoordsInTree(18.0, -12.0), result.node("a").position)
        assertEquals(CoordsInTree(79.5, -20.0), result.node("b").position)
    }

    @Test
    fun positionStrandedNodes() {
        val result = applyNodePositionsToTree(::mockStrWidth, treeWithStrandedNodes)
        assertEquals(CoordsInTree(40.0, -42.0), result.node("c").position)
    }

    @Test
    fun positionBranchingNodes() {
        val result = applyNodePositionsToTree(::mockStrWidth, treeWithBranchingNodes)
        assertEquals(CoordsInTree(40.0, -42.0), result.node("c").position)
    }

    @Test
    fun positionBranchingNodesInTreeWithTriangles() {
        val result = applyNodePositionsToTree(::mockStrWidth, treeWithBranchingAndTriangleNodes)
        assertEquals(CoordsInTree(48.75, -60.0), result.node("c").position)
    }

    @Test
    fun positionFoldedNodes() {
        val result = applyNodePositionsToTree(::mockStrWidth, treeWithFoldedBranchingNodes)
        // All nodes under NP should be hidden
        val nodeLabelsInTree: Set<String> = result.nodes.map { it.label }.toSet()
        assertEquals(setOf("S", "NP", "VP", "V"), nodeLabelsInTree) // No A, AP, N since they are under NP
        // NP node should be a terminal node with triangle vertices matching the entire span of its descendants
        val npNode = result.nodes.find { it.label == "NP" } as PositionedTerminalNode
        assertEquals(TreeXRange(0.0, 79.0), npNode.triangle)
    }

    @Test
    fun positionTriangleVertices() {
        val result = applyNodePositionsToTree(::mockStrWidth, treeWithTriangleNodes)
        val triangleNode = result.nodes["b"] as PositionedTerminalNode
        assertEquals(TreeXRange(40.0, 119.0), triangleNode.triangle)
    }

    @Test
    fun positionVerticallyAlignedNodes() {
        val result = applyNodePositionsToTree(::mockStrWidth, treeWithVerticallyAlignedNode)
        assertEquals(CoordsInTree(18.0, -42.0), result.node("a").position)
    }

    @Test
    fun sortNodesByXCoord() {
        assertEquals(
            listOf("a", "b"),
            sortNodesByXCoord(::mockStrWidth, treeWithBranchingNodes, setOf("b", "a"))
        )
        assertEquals(
            listOf("a", "c"),
            sortNodesByXCoord(::mockStrWidth, treeWithBranchingNodes, setOf("a", "c"))
        )
    }

    @Test
    fun measureTreeWidth() {
        val result = applyNodePositionsToTree(::mockStrWidth, treeWithBranchingAndTriangleNodes)
        assertEquals(123.0, result.width)
    }

    @Test
    fun resolvesNodeBoundEnclosureGeometryFromAnchorNode() {
        val plot = UnpositionedPlot(
            trees = EntitySet(treeWithTerminalNodes),
            shapes = EntitySet(
                NodeBoundEnclosureShape(
                    id = "e1",
                    nodeIndicatorInPlot = NodeIndicatorInPlot(treeWithTerminalNodes.id, "a"),
                    cornerRadius = 8.0,
                ),
            ),
        )
        val result = applyNodePositionsToPlot(::mockStrWidth, plot)
        val shape = result.shapes["e1"] as ResolvedNodeBoundEnclosureShape
        val tree = result.tree(treeWithTerminalNodes.id)
        val nodePosition = tree.node("a").position
        assertEquals(
            tree.position.plotX + nodePosition.treeX + NODE_AREA_RELATIVE_X - NODE_ENCLOSURE_MARGIN_X,
            shape.plotX
        )
        assertEquals(
            tree.position.plotY + nodePosition.treeY + NODE_AREA_RELATIVE_Y - NODE_ENCLOSURE_MARGIN_Y,
            shape.plotY
        )
        assertEquals(NODE_AREA_WIDTH + NODE_ENCLOSURE_MARGIN_X * 2, shape.width)
        assertEquals(NODE_AREA_HEIGHT + NODE_ENCLOSURE_MARGIN_Y * 2, shape.height)
        assertEquals(8.0, shape.cornerRadius)
    }

    @Test
    fun leavesFreeStandingShapesUnchanged() {
        val shape = EnclosureShape(id = "e2", x = 4.0, y = 8.0, width = 10.0, height = 20.0)
        val plot = UnpositionedPlot(trees = EntitySet(treeWithTerminalNodes), shapes = EntitySet(shape))
        val result = applyNodePositionsToPlot(::mockStrWidth, plot)
        assertEquals(shape, result.shapes["e2"])
    }

    @Test
    fun omitsNodeBoundEnclosureWithStaleAnchor() {
        val shape = NodeBoundEnclosureShape(id = "e3", nodeIndicatorInPlot = NodeIndicatorInPlot("nonexistentTree", "x"))
        val plot = UnpositionedPlot(trees = EntitySet(treeWithTerminalNodes), shapes = EntitySet(shape))
        val result = applyNodePositionsToPlot(::mockStrWidth, plot)
        assertNull(result.shapes["e3"])
    }
}
