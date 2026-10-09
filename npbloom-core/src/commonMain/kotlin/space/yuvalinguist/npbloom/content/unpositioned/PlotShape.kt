@file:OptIn(ExperimentalJsExport::class)

package space.yuvalinguist.npbloom.content.unpositioned

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import space.yuvalinguist.npbloom.content.Id
import space.yuvalinguist.npbloom.content.NodeIndicatorInPlot
import space.yuvalinguist.npbloom.content.WithId
import space.yuvalinguist.npbloom.content.positioned.CoordsInPlot
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport

// Plot shapes come in two forms, mirroring unpositioned vs. positioned trees and nodes:
// - PersistentPlotShape: what is stored in an UnpositionedPlot, serialized, and changed by content actions.
// - DrawablePlotShape: what the positioning pass produces for a PositionedPlot, and what the frontend renders.
// Conversion only goes one way (persistent -> drawable), in the positioning pass,
// similarly to unpositioned -> positioned for trees and nodes.
// All shape types live in this one file because subtypes of a sealed type must share its package.
// TODO: Consider restructuring the hierarchy so we keep the perks of sealed classes without this constraint

@JsExport
@Serializable
sealed interface PersistentPlotShape : WithId {
    val strokeColor: String
    val strokeWidth: Double
    fun move(offset: PlotCoordsOffset): PersistentPlotShape
}

@JsExport
sealed interface DrawablePlotShape : WithId {
    val strokeColor: String
    val strokeWidth: Double
}

/**
 * A shape whose stored and drawn forms are the same data, since it is defined in absolute plot coordinates.
 * Only free-standing shapes can be resized.
 */
@JsExport
@Serializable
sealed interface FreeStandingPlotShape : PersistentPlotShape, DrawablePlotShape {
    override fun move(offset: PlotCoordsOffset): FreeStandingPlotShape
}

@JsExport
@Serializable
@SerialName("LS")
data class LineShape(
    @SerialName("i") override val id: Id,
    @SerialName("s") val start: CoordsInPlot,
    @SerialName("e") val end: CoordsInPlot,
    @SerialName("a") val arrowhead: Arrowhead = Arrowhead.None,
    @SerialName("_") override val strokeColor: String = "#000000",
    @SerialName("=") override val strokeWidth: Double = 1.0,
) : FreeStandingPlotShape {
    override fun move(offset: PlotCoordsOffset) = copy(
        start = start + offset,
        end = end + offset,
    )
}

@JsExport
@Serializable
@SerialName("EN")
data class EnclosureShape(
    @SerialName("i") override val id: Id,
    @SerialName("x") val x: Double,
    @SerialName("y") val y: Double,
    @SerialName("w") val width: Double,
    @SerialName("h") val height: Double,
    @SerialName("r") val cornerRadius: Double = 0.0,
    @SerialName("_") override val strokeColor: String = "#000000",
    @SerialName("=") override val strokeWidth: Double = 1.0,
    @SerialName("#") val fillColor: String? = null,
) : FreeStandingPlotShape {
    override fun move(offset: PlotCoordsOffset) = copy(
        x = x + offset.dPlotX,
        y = y + offset.dPlotY,
    )
}

/**
 * An enclosure drawn around a single node.
 * Its bounds are not stored; instead, they are derived from the anchor node's position in the positioning pass,
 * which produces a `ResolvedNodeBoundEnclosureShape`.
 */
@JsExport
@Serializable
@SerialName("NBES")
data class NodeBoundEnclosureShape(
    @SerialName("i") override val id: Id,
    @SerialName("n") val nodeIndicatorInPlot: NodeIndicatorInPlot,
    @SerialName("r") val cornerRadius: Double = 0.0,
    @SerialName("_") override val strokeColor: String = "#000000",
    @SerialName("=") override val strokeWidth: Double = 1.0,
    @SerialName("#") val fillColor: String? = null,
) : PersistentPlotShape {
    // A node-bound enclosure moves with its node, so moving it directly is a no-op
    override fun move(offset: PlotCoordsOffset) = this
}

/**
 * The drawable form of a `NodeBoundEnclosureShape`, with bounds resolved from the anchor node's position.
 * The bounds are in plot coordinates rather than client coordinates, so that consumers needing tree-local
 * coordinates (e.g. single-tree export) can get there with a plain offset subtraction against the anchor tree's
 * own plot position, without needing to know anything about pan/zoom.
 */
@JsExport
data class ResolvedNodeBoundEnclosureShape(
    override val id: Id,
    val nodeIndicatorInPlot: NodeIndicatorInPlot,
    val cornerRadius: Double,
    override val strokeColor: String,
    override val strokeWidth: Double,
    val fillColor: String?,
    val plotX: Double,
    val plotY: Double,
    val width: Double,
    val height: Double,
) : DrawablePlotShape

@JsExport
@Serializable
enum class Arrowhead {
    @SerialName("N") None,
    @SerialName("E") End,
    @SerialName("S") Start,
    @SerialName("B") Both,
}
