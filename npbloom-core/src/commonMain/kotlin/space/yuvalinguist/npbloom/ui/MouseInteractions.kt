@file:OptIn(ExperimentalJsExport::class)

package space.yuvalinguist.npbloom.ui

import space.yuvalinguist.npbloom.content.NodeIndicatorInPlot
import space.yuvalinguist.npbloom.content.generateShapeId
import space.yuvalinguist.npbloom.content.positioned.CoordsInPlot
import space.yuvalinguist.npbloom.content.positioned.PositionedNode
import space.yuvalinguist.npbloom.content.positioned.PositionedPlot
import space.yuvalinguist.npbloom.content.positioned.PositionedTree
import space.yuvalinguist.npbloom.content.unpositioned.Arrowhead
import space.yuvalinguist.npbloom.content.unpositioned.EnclosureShape
import space.yuvalinguist.npbloom.content.unpositioned.FreeStandingPlotShape
import space.yuvalinguist.npbloom.content.unpositioned.LineShape
import space.yuvalinguist.npbloom.content.unpositioned.NodeBoundEnclosureShape
import space.yuvalinguist.npbloom.content.unpositioned.PersistentPlotShape
import kotlin.math.*
import kotlin.js.ExperimentalJsExport
import kotlin.js.JsExport

@JsExport
enum class MouseInteractionMode {
    Idle,
    Selecting,
    Panning,
    DraggingNodes,
    DraggingTrees,
    DraggingShapes,
    ResizingShape,
    CreatingShape,
}

/**
 * Returns true if the center of the given node in the given tree is within the given rectangle in plot coordinates.
 * Used for selection by dragging a rectangle over the plot.
 */
fun isNodeInRect(tree: PositionedTree, node: PositionedNode, rect: RectInPlot) =
    calculateNodeCenterOnPlot(tree, node) in rect

/**
 * Returns the indicator for the node enclosed by the given coordinate pair, if there is exactly one.
 * Used for dragging an enclosure around a single node.
 */
private fun findSingleNodeEnclosedByRect(
    plot: PositionedPlot,
    rectInPlot: RectInPlot,
): NodeIndicatorInPlot? = plot
    .filterNodeIndicators { tree, node -> isNodeInRect(tree, node, rectInPlot) }
    .singleOrNull()

/**
 * Returns true if the given tree's visual bounding box is entirely within the given rectangle in plot coordinates.
 * Used to determine whether a selection box should select trees or nodes.
 */
fun isTreeInRect(tree: PositionedTree, rect: RectInPlot) =
    tree.visualTopLeftCorner in rect && tree.visualBottomRightCorner in rect

/**
 * Determines the correct action to take when a new node selection is made, based on
 * - the current selection mode (replace or add to selection)
 * - the current selection action (set selection, adopt, or disown)
 * and returns the corresponding UiAction to perform.
 */
fun determineNodeSelectionAction(
    newNodeIndicators: Array<NodeIndicatorInPlot>,
    currentSelection: NodeSelectionInPlot? = null,
    selectionMode: EntitySelectionMode = EntitySelectionMode.SetSelection,
    selectionAction: EntitySelectionAction = EntitySelectionAction.SelectNode,
): UiAction = when (selectionAction) {
    EntitySelectionAction.SelectNode -> SetSelection(
        applyNodeSelection(
            selectionMode,
            newNodeIndicators.toSet(),
            currentSelection?.nodeIndicators ?: emptySet()
        )
    )

    EntitySelectionAction.Adopt -> AdoptNodesBySelection(newNodeIndicators)
    EntitySelectionAction.Disown -> DisownNodesBySelection(newNodeIndicators)
    // Selection action should never be SelectTree here
    EntitySelectionAction.SelectTree -> error("Invalid selection action: SelectTree cannot be used for node selection")
}

/**
 * Determines the correct action to take when a new selection box is made.
 * Returns the corresponding UiAction to perform.
 */
@JsExport
fun determineActionOnSelectBoxCompletion(
    plot: PositionedPlot,
    selectionBox: RectInPlot,
    currentSelection: SelectionInPlot,
    selectionMode: EntitySelectionMode,
    selectionAction: EntitySelectionAction,
): UiAction {
    // Figure out if we're trying to select nodes or trees.
    // If any tree is fully enclosed in the selection box, we select trees; otherwise, we select nodes.
    val enclosedTreeIds = plot.trees.filter { isTreeInRect(it, selectionBox) }.map { it.id }.toSet()
    if (enclosedTreeIds.isNotEmpty()) {
        val alreadySelectedTreeIds = (currentSelection as? TreeSelectionInPlot)?.treeIds ?: emptySet()
        return SetSelection(
            applyTreeSelection(selectionMode, enclosedTreeIds, alreadySelectedTreeIds),
        )
    }

    // No trees are fully enclosed, so we select nodes.
    // We defer to determineNodeSelectionAction to figure out the exact action to take
    // based on the selection mode and action.
    val newSelectedNodes = plot.filterNodeIndicators { tree, node -> isNodeInRect(tree, node, selectionBox) }.toSet()
    return determineNodeSelectionAction(
        newNodeIndicators = newSelectedNodes.toTypedArray(),
        currentSelection = currentSelection as? NodeSelectionInPlot,
        selectionMode = selectionMode,
        selectionAction = selectionAction,
    )
}

/**
 * Given a delta x and y, returns a new delta x and y snapped to the nearest 45-degree angle.
 */
@JsExport
fun snapAngleTo45Deg(dx: Double, dy: Double): ClientCoordsOffset {
    val snapped = round(atan2(dy, dx) / (PI / 4)) * (PI / 4)
    val length = hypot(dx, dy)
    return ClientCoordsOffset(cos(snapped) * length, sin(snapped) * length)
}

/**
 * Given the original shape, the resize handle being dragged, and the distance dragged in plot coordinates,
 * computes the new shape that would result from resizing the original shape according to that drag.
 * Used both to show shape previews while resizing and to determine the final shape when completing a resize drag.
 */
@JsExport
fun computeResizedShape(
    originalShape: FreeStandingPlotShape,
    handleId: String,
    dPlotX: Double,
    dPlotY: Double,
    snapTo45Deg: Boolean = false,
): FreeStandingPlotShape = when (originalShape) {
    is EnclosureShape -> {
        var newX = originalShape.x
        var newY = originalShape.y
        var newWidth = originalShape.width
        var newHeight = originalShape.height
        if ('w' in handleId) {
            newX += dPlotX
            newWidth -= dPlotX
        }
        if ('e' in handleId) {
            newWidth += dPlotX
        }
        if ('n' in handleId) {
            newY += dPlotY
            newHeight -= dPlotY
        }
        if ('s' in handleId) {
            newHeight += dPlotY
        }
        originalShape.copy(
            x = newX,
            y = newY,
            width = newWidth,
            height = newHeight,
        )
    }

    is LineShape -> {
        var newStartX = originalShape.start.plotX
        var newStartY = originalShape.start.plotY
        var newEndX = originalShape.end.plotX
        var newEndY = originalShape.end.plotY
        if (handleId == "start") {
            newStartX += dPlotX
            newStartY += dPlotY
        } else if (handleId == "end") {
            newEndX += dPlotX
            newEndY += dPlotY
        }
        if (snapTo45Deg) {
            val (snappedDeltaX, snappedDeltaY) = snapAngleTo45Deg(newEndX - newStartX, newEndY - newStartY)
            newEndX = newStartX + snappedDeltaX
            newEndY = newStartY + snappedDeltaY
        }
        originalShape.copy(
            start = CoordsInPlot(newStartX, newStartY),
            end = CoordsInPlot(newEndX, newEndY),
        )
    }
}

/**
 * Returns the appropriate corner radius to use for an enclosure, based on the shape tool currently in use.
 */
fun cornerRadiusByShapeTool(shapeTool: ShapeTool) = when (shapeTool) {
    ShapeTool.RoundedRectangle -> 8.0
    ShapeTool.Ellipse -> Double.POSITIVE_INFINITY
    else -> 0.0
}

/**
 * Given the shape tool being used and the start and end coordinates of a drag in plot coordinates,
 * returns the corresponding shape to be added to the plot.
 * Used both to show shape previews while dragging to create a new shape (via `PositionedPlot.positionShape`)
 * and to determine the final shape when completing a creation drag.
 */
@JsExport
fun createShapeFromDrag(
    plot: PositionedPlot,
    tool: ShapeTool,
    start: CoordsInPlot,
    end: CoordsInPlot,
): PersistentPlotShape = when (tool) {
    ShapeTool.Line, ShapeTool.Arrow -> LineShape(
        id = generateShapeId(),
        start = start,
        end = end,
        arrowhead = if (tool == ShapeTool.Arrow) Arrowhead.End else Arrowhead.None,
    )

    else -> {
        val id = generateShapeId()
        val cornerRadius = cornerRadiusByShapeTool(tool)

        // RectInPlot expects topLeft/bottomRight in order, but a drag can go in any of the four directions -
        // normalize so node detection works regardless of which corner the user dragged from.
        val normalizedRect = RectInPlot(
            topLeft = CoordsInPlot(min(start.plotX, end.plotX), min(start.plotY, end.plotY)),
            bottomRight = CoordsInPlot(max(start.plotX, end.plotX), max(start.plotY, end.plotY)),
        )
        val nodeMatchingCoordinates = findSingleNodeEnclosedByRect(plot, normalizedRect)
        if (nodeMatchingCoordinates != null) NodeBoundEnclosureShape(
            id = id,
            nodeIndicatorInPlot = nodeMatchingCoordinates,
            cornerRadius = cornerRadius,
        ) else EnclosureShape(
            id = id,
            x = min(start.plotX, end.plotX),
            y = min(start.plotY, end.plotY),
            width = abs(end.plotX - start.plotX),
            height = abs(end.plotY - start.plotY),
            cornerRadius = cornerRadius,
        )
    }
}

/**
 * Determines the correct editing action to take when a drag on an object is completed
 * (i.e. any drag that is not a selection box).
 * Returns the corresponding UiAction to perform.
 * This can be moving entities, resizing a shape, or creating a shape.
 */
@JsExport
fun determineActionOnDragCompletion(
    plot: PositionedPlot,
    mouseInteractionMode: MouseInteractionMode,
    dragStartCoords: CoordsInClient,
    dragEndCoords: CoordsInClient,
    panZoomState: PanZoomState,
    activeShapeTool: ShapeTool,
    resizeHandleId: String?,
    isShiftDragging: Boolean,
): UiAction? {
    // Find how much the mouse has moved in plot coordinates (taking zoom level into account) since the start of the drag
    val dPlotX = (dragEndCoords.clientX - dragStartCoords.clientX) / panZoomState.zoomLevel
    val dPlotY = (dragEndCoords.clientY - dragStartCoords.clientY) / panZoomState.zoomLevel

    // If we're moving any entity, return the corresponding Move action for that entity type
    when (mouseInteractionMode) {
        MouseInteractionMode.DraggingNodes -> return MoveSelectedNodes(dPlotX, dPlotY)
        MouseInteractionMode.DraggingTrees -> return MoveSelectedTrees(dPlotX, dPlotY)
        MouseInteractionMode.DraggingShapes -> return MoveSelectedShapes(dPlotX, dPlotY)
        else -> {}
    }

    // If we're resizing a shape, return a ResizeSelectedShape action describing the resize
    if (mouseInteractionMode == MouseInteractionMode.ResizingShape && resizeHandleId != null) {
        return ResizeSelectedShape(resizeHandleId, dPlotX, dPlotY, isShiftDragging)
    }

    // If we're creating a shape, return an AddShapeToPlot action with the shape corresponding to the drag we just made
    if (mouseInteractionMode == MouseInteractionMode.CreatingShape) {
        val startCoordsInPlot = dragStartCoords.toCoordsInPlot(panZoomState)
        val endCoordsInPlot = dragEndCoords.toCoordsInPlot(panZoomState)
        val shape = createShapeFromDrag(plot, activeShapeTool, startCoordsInPlot, endCoordsInPlot)
        return AddShapeToPlot(shape)
    }

    return null
}