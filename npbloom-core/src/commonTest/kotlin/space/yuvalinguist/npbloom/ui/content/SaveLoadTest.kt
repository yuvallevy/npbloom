@file:OptIn(ExperimentalStdlibApi::class)

package space.yuvalinguist.npbloom.ui.content

import space.yuvalinguist.npbloom.content.EntitySet
import space.yuvalinguist.npbloom.content.NodeIndicatorInPlot
import space.yuvalinguist.npbloom.content.StringSlice
import space.yuvalinguist.npbloom.content.YAlignMode
import space.yuvalinguist.npbloom.content.positioned.CoordsInPlot
import space.yuvalinguist.npbloom.content.unpositioned.*
import space.yuvalinguist.npbloom.content.unpositioned.PlotCoordsOffset
import space.yuvalinguist.npbloom.ui.PanZoomState
import kotlin.test.Test
import kotlin.test.assertEquals

class SaveLoadTest {
    private val content = ContentState(
        listOf(
            UnpositionedPlot(
                trees = EntitySet(
                    UnpositionedTree(
                        id = "cleo",
                        sentence = "Cleo laughed.",
                        nodes = EntitySet(
                            UnpositionedBranchingNode("s1", "S", TreeCoordsOffset(0.0, 5.1), setOf("np1", "vp1")),
                            UnpositionedBranchingNode("np1", "NP", TreeCoordsOffset.ZERO, setOf("n1")),
                            UnpositionedTerminalNode("n1", "N", TreeCoordsOffset.ZERO, StringSlice(0, 4)),
                            UnpositionedTerminalNode(
                                "vp1",
                                "VP",
                                TreeCoordsOffset.ZERO,
                                StringSlice(5, 12),
                                yAlignMode = YAlignMode.Top
                            ),
                        ),
                        coordsInPlot = CoordsInPlot.ZERO,
                    ),
                    UnpositionedTree(
                        id = "alex",
                        sentence = "Alex baked cookies.",
                        nodes = EntitySet(
                            UnpositionedBranchingNode("s2", "S", TreeCoordsOffset(0.0, 5.0), setOf("np2a", "vp2")),
                            UnpositionedBranchingNode("np2a", "NP", TreeCoordsOffset.ZERO, setOf("n2")),
                            UnpositionedTerminalNode("n2", "N", TreeCoordsOffset.ZERO, StringSlice(0, 4)),
                            UnpositionedBranchingNode("vp2", "VP", TreeCoordsOffset.ZERO, setOf("v2", "np2b")),
                            UnpositionedTerminalNode("v2", "V", TreeCoordsOffset.ZERO, StringSlice(5, 10)),
                            UnpositionedTerminalNode("np2b", "NP", TreeCoordsOffset.ZERO, StringSlice(11, 18)),
                        ),
                        coordsInPlot = CoordsInPlot.ZERO,
                    ),
                ),
            )
        ))

    private val contentWithShapes = content.copy(
        plots = listOf(content.plots[0].copy(
            shapes = EntitySet(
                EnclosureShape(
                    id = "rectangle",
                    x = 4.0,
                    y = 8.0,
                    width = 120.0,
                    height = 40.0,
                ),
                EnclosureShape(
                    id = "ellipse",
                    x = 8.0,
                    y = 4.0,
                    width = 40.0,
                    height = 80.0,
                    cornerRadius = Double.POSITIVE_INFINITY,
                ),
                LineShape(
                    id = "line",
                    start = CoordsInPlot(120.0, 0.0),
                    end = CoordsInPlot(0.0, 80.0),
                    arrowhead = Arrowhead.End,
                ),
            )
        ))
    )

    private val contentWithNodeBoundEnclosure = content.copy(
        plots = listOf(content.plots[0].copy(
            shapes = EntitySet(
                NodeBoundEnclosureShape(
                    id = "nodeEnclosure",
                    nodeIndicatorInPlot = NodeIndicatorInPlot("cleo", "np1"),
                    cornerRadius = 8.0,
                ),
            )
        ))
    )

    // The plot as it looks after decoding bytesFormat20WithLegacyNodeEnclosure: same tree/node structure as what
    // was serialized, minus the legacy "O" (enclosureCornerRadius) field, which no longer exists on the node class
    // and is silently dropped by ignoreUnknownKeys rather than migrated to a NodeBoundEnclosureShape (no shapes).
    private val legacyNodeEnclosureContent = ContentState(
        listOf(
            UnpositionedPlot(
                trees = EntitySet(
                    UnpositionedTree(
                        id = "cleo",
                        sentence = "Cleo laughed.",
                        nodes = EntitySet(
                            UnpositionedBranchingNode("s1", "S", TreeCoordsOffset.ZERO, setOf("n1")),
                            UnpositionedTerminalNode("n1", "N", TreeCoordsOffset.ZERO, StringSlice(0, 4)),
                        ),
                        coordsInPlot = CoordsInPlot.ZERO,
                    ),
                ),
            )
        )
    )

    // Format 2.0 - FileContents wrapper, with a node carrying the legacy per-node "O" (enclosureCornerRadius) field
    // that was later replaced by NodeBoundEnclosureShape. Hand-generated by serializing an equivalent plot at
    // commit 53194c6 (the last commit before that field was removed).
    private val bytesFormat20WithLegacyNodeEnclosure =
        "59b10011f04e57000200bf6163bf61709fbf6174bf61659fbf616964636c656f61736d436c656f206c6175676865642e616ebf61659f9f6142bf6169627331616c615361599f626e31ff614ffb4020000000000000ffff9f6154bf6169626e31616c614e61739f0004ffffffffffffffffffffffff".hexToByteArray()

    // Format 1.2 - bare ContentState, no plotPanZoomStates
    private val bytesFormat12 = "59b10011f04e57000102bf61709fbf6174bf61659fbf616964636c656f61736d436c656f206c6175676865642e616ebf61659f9f6142bf6169627331616c6153616f9ffb0000000000000000fb4014666666666666ff61599f636e703163767031ffffff9f6142bf6169636e7031616c624e5061599f626e31ffffff9f6154bf6169626e31616c614e61739f0004ffffff9f6154bf616963767031616c62565061739f050cff612d615effffffffffbf616964616c6578617373416c65782062616b656420636f6f6b6965732e616ebf61659f9f6142bf6169627332616c6153616f9ffb0000000000000000fb4014000000000000ff61599f646e70326163767032ffffff9f6142bf6169646e703261616c624e5061599f626e32ffffff9f6154bf6169626e32616c614e61739f0004ffffff9f6142bf616963767032616c62565061599f627632646e703262ffffff9f6154bf6169627632616c615661739f050affffff9f6154bf6169646e703262616c624e5061739f0b12ffffffffffffffffffffff".hexToByteArray()

    // Format 1.3 - bare ContentState, no plotPanZoomStates, with shapes
    private val bytesFormat13WithShapes = "59b10011f04e57000103bf61709fbf6174bf61659fbf616964636c656f61736d436c656f206c6175676865642e616ebf61659f9f6142bf6169627331616c6153616f9ffb0000000000000000fb4014666666666666ff61599f636e703163767031ffffff9f6142bf6169636e7031616c624e5061599f626e31ffffff9f6154bf6169626e31616c614e61739f0004ffffff9f6154bf616963767031616c62565061739f050cff612d615effffffffffbf616964616c6578617373416c65782062616b656420636f6f6b6965732e616ebf61659f9f6142bf6169627332616c6153616f9ffb0000000000000000fb4014000000000000ff61599f646e70326163767032ffffff9f6142bf6169646e703261616c624e5061599f626e32ffffff9f6154bf6169626e32616c614e61739f0004ffffff9f6142bf616963767032616c62565061599f627632646e703262ffffff9f6154bf6169627632616c615661739f050affffff9f6154bf6169646e703262616c624e5061739f0b12ffffffffffffffff6173bf61659f9f62454ebf61696972656374616e676c656178fb40100000000000006179fb40200000000000006177fb405e0000000000006168fb4044000000000000ffff9f62454ebf616967656c6c697073656178fb40200000000000006179fb40100000000000006177fb40440000000000006168fb40540000000000006172fb7ff0000000000000ffff9f624c53bf6169646c696e6561739ffb405e000000000000fb0000000000000000ff61659ffb0000000000000000fb4054000000000000ff61616145ffffffffffffff".hexToByteArray()

    @Test
    fun roundTripCurrentFormat() {
        val fileContents = FileContents(content)
        assertEquals(fileContents, FileContents.fromByteArray(fileContents.toByteArray()))
    }

    @Test
    fun roundTripCurrentFormatWithShapes() {
        val fileContents = FileContents(contentWithShapes)
        assertEquals(fileContents, FileContents.fromByteArray(fileContents.toByteArray()))
    }

    @Test
    fun roundTripCurrentFormatWithPanZoom() {
        val plotPanZoomStates = listOf(PanZoomState(PlotCoordsOffset(100.0, -50.0), 1.5))
        val fileContents = FileContents(content, plotPanZoomStates)
        val restored = FileContents.fromByteArray(fileContents.toByteArray())
        assertEquals(fileContents.contentState, restored.contentState)
        assertEquals(plotPanZoomStates, restored.plotPanZoomStates)
    }

    @Test
    fun deserializeFromFormat13() {
        assertEquals(contentWithShapes, FileContents.fromByteArray(bytesFormat13WithShapes).contentState)
    }

    @Test
    fun deserializeFromFormat13HasEmptyPlotPanZoomStates() {
        assertEquals(emptyList(), FileContents.fromByteArray(bytesFormat13WithShapes).plotPanZoomStates)
    }

    @Test
    fun deserializeFromFormat12() {
        assertEquals(content, FileContents.fromByteArray(bytesFormat12).contentState)
    }

    @Test
    fun roundTripCurrentFormatWithNodeBoundEnclosure() {
        val fileContents = FileContents(contentWithNodeBoundEnclosure)
        assertEquals(fileContents, FileContents.fromByteArray(fileContents.toByteArray()))
    }

    @Test
    fun deserializeFromFormat20WithLegacyNodeEnclosureDropsField() {
        assertEquals(
            legacyNodeEnclosureContent,
            FileContents.fromByteArray(bytesFormat20WithLegacyNodeEnclosure).contentState
        )
    }
}
