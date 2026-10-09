/**
 * This file contains the mouse interaction logic for the plot, consisting of:
 * - a mouse interaction state machine that tracks what the user is currently doing with the mouse
 * - handlers for mouse events on the plot and its entities that update the mouse interaction state
 *   and dispatch actions to edit the UI state and content as needed
 * 
 * The logic for moving and resizing existing entities seems misplaced in this file,
 * since the name implies it is strictly about plot-level interactions.
 * The reason is that mouse movements and drags can register on the plot even when they start on an entity,
 * since the user might move the mouse very quickly and end up outside the entity before the `onMouseMove` event fires.
 * If the handlers for these interactions were registered on the entity-level handlers, the user would have to
 * move the mouse very slowly and carefully so that the cursor never leaves the entity while dragging.
 * From a UX perspective, this is unacceptable - natural mouse drags are going to be faster than that.
 * Event handlers where this is not a risk, such as selecting a single node by clicking on it,
 * are registered on the entity-level handlers as expected.
 */

import { useState } from 'react';
import {
  AddTree, AddTreeFromLbn, ClientCoordsOffset, computeResizedShape, CoordsInClient, CoordsInPlot, createShapeFromDrag,
  determineActionOnDragCompletion, determineActionOnSelectBoxCompletion, EnclosureShape, EntitySelectionMode,
  FreeStandingPlotShape, generateTreeId, LineShape, MouseInteractionMode, NoSelectionInPlot, Pan, PositionedPlot,
  RectInClient, SetSelection, ShapeSelectionInPlot, ShapeTool, snapAngleTo45Deg
} from 'npbloom-core';
import useUiState from '../useUiState';
import usePlotMouseWheelInteractions from './usePlotMouseWheelInteractions';
import { SVG_X, SVG_Y } from '../uiDimensions';

const PRIMARY_MOUSE_BUTTON = 1;
const MINIMUM_SELECTION_BOX_DIMENSION = 8;  // to leave some wiggle room for the mouse to move while clicking

const usePlotMouseInteractions = (
  plot: PositionedPlot,
  svgRef: React.RefObject<SVGSVGElement>,
) => {
  const { state, dispatch } = useUiState();

  const [dragStartCoords, setDragStartCoords] = useState<CoordsInClient | undefined>();
  const [rawDragEndCoords, setRawDragEndCoords] = useState<CoordsInClient | undefined>();
  const [mouseInteractionMode, setMouseInteractionMode] =
    useState<MouseInteractionMode>(MouseInteractionMode.Idle);
  const [resizeHandleId, setResizeHandleId] = useState<string | undefined>();
  // Kept only to render the resize preview; the resize itself is dispatched as an intent (ResizeSelectedShape)
  const [resizingShape, setResizingShape] = useState<FreeStandingPlotShape | undefined>();
  const [isShiftDragging, setIsShiftDragging] = useState(false);

  // `dragEndCoords` is split into "raw" and "effective" versions.
  // The "raw" version is derived directly from the distance the mouse has traveled since the start of the drag,
  // without any adjustments.
  // The "effective" version is the one that is used in practice, and may be adjusted from the raw version
  // when the Shift key is held down and at least one of the following interaction modes is in effect:
  // - Creating a LineShape (i.e. line or arrow)
  // - Moving nodes, trees, or shapes
  //
  // Note: the effective drag offset cannot be used for snapping when resizing lines.
  // This is because the reference frame for moving is the drag start coordinates (what `dragOffset` assumes),
  // while the reference frame for resizing is the opposite endpoint of the line (which is not at the drag start coordinates).
  // See `computeResizedShape` for how snapping is handled when resizing line shapes.

  // Whether we are currently in a mode where we want to snap to 45-degree angles when the user is holding Shift.
  const canSnapTo45Deg = mouseInteractionMode === MouseInteractionMode.DraggingNodes ||
    mouseInteractionMode === MouseInteractionMode.DraggingTrees ||
    mouseInteractionMode === MouseInteractionMode.DraggingShapes ||
    (mouseInteractionMode === MouseInteractionMode.CreatingShape && (
      state.activeShapeTool === ShapeTool.Line || state.activeShapeTool === ShapeTool.Arrow
    ));

  const dragEndCoords = (() => {
    if (!rawDragEndCoords) return undefined;
    if (isShiftDragging && canSnapTo45Deg && dragStartCoords) {
      const { dClientX: snappedX, dClientY: snappedY } = snapAngleTo45Deg(
        rawDragEndCoords.clientX - dragStartCoords.clientX,
        rawDragEndCoords.clientY - dragStartCoords.clientY,
      );
      return new CoordsInClient(dragStartCoords.clientX + snappedX, dragStartCoords.clientY + snappedY);
    }
    return rawDragEndCoords;
  })();

  const dragOffset: ClientCoordsOffset | undefined = dragStartCoords && dragEndCoords ? new ClientCoordsOffset(
    dragEndCoords.clientX - dragStartCoords.clientX,
    dragEndCoords.clientY - dragStartCoords.clientY,
  ) : undefined;

  const selectedShapeIds = state.selection instanceof ShapeSelectionInPlot
    ? state.selection.shapeIdsAsArray : [];
  const isCreatingShape = state.activeShapeTool !== ShapeTool.None;

  const selectionBoxTopLeft: CoordsInClient | undefined = mouseInteractionMode === MouseInteractionMode.Selecting && dragStartCoords && dragEndCoords ? new CoordsInClient(
    Math.min(dragStartCoords.clientX, dragEndCoords.clientX),
    Math.min(dragStartCoords.clientY, dragEndCoords.clientY),
  ) : undefined;

  const selectionBoxBottomRight: CoordsInClient | undefined = mouseInteractionMode === MouseInteractionMode.Selecting && dragStartCoords && dragEndCoords ? new CoordsInClient(
    Math.max(dragStartCoords.clientX, dragEndCoords.clientX),
    Math.max(dragStartCoords.clientY, dragEndCoords.clientY),
  ) : undefined;

  const plotViewCursor =
    (mouseInteractionMode === MouseInteractionMode.DraggingNodes || mouseInteractionMode === MouseInteractionMode.DraggingTrees || mouseInteractionMode === MouseInteractionMode.DraggingShapes) && dragOffset ? 'move'
      : mouseInteractionMode === MouseInteractionMode.ResizingShape ? 'grabbing'
        : (mouseInteractionMode === MouseInteractionMode.Panning) ? 'grabbing'
          : 'crosshair';

  const resizePreviewShape = mouseInteractionMode === MouseInteractionMode.ResizingShape && resizingShape && resizeHandleId && dragOffset
    ? computeResizedShape(resizingShape, resizeHandleId,
        dragOffset.dClientX / state.panZoomState.zoomLevel,
        dragOffset.dClientY / state.panZoomState.zoomLevel,
        isShiftDragging,
      )
    : undefined;

  const creationPreviewShape = mouseInteractionMode === MouseInteractionMode.CreatingShape && dragStartCoords && dragEndCoords
    ? plot.positionShape(createShapeFromDrag(
      plot,
      state.activeShapeTool,
      dragStartCoords.toCoordsInPlot(state.panZoomState),
      dragEndCoords.toCoordsInPlot(state.panZoomState),
    )) ?? undefined : undefined;

  const addTreeAndFocus = (position: CoordsInPlot) => {
    const newTreeId = generateTreeId();
    dispatch(new AddTree(newTreeId, position));
    setTimeout(() =>
      (document.querySelector(`input#${newTreeId}`) as (HTMLInputElement | null))?.focus(), 50);
  };

  const handlePlotClick = (event: React.MouseEvent<SVGElement>) => {
    if (state.selection === NoSelectionInPlot.getInstance()) {
      // If nothing is currently selected, create a new tree where the user clicked and focus it for editing right away
      addTreeAndFocus(new CoordsInClient(event.clientX - SVG_X, event.clientY - SVG_Y).toCoordsInPlot(state.panZoomState));
    } else {
      // If something is currently selected, clear the selection to get ready for a new selection or action
      dispatch(new SetSelection(NoSelectionInPlot.getInstance()));
    }
  };

  const handlePlotMouseDown = (event: React.MouseEvent<SVGElement>) => {
    if (isCreatingShape && event.currentTarget === event.target && !event.shiftKey) {
      setMouseInteractionMode(MouseInteractionMode.CreatingShape);
      setDragStartCoords(new CoordsInClient(event.clientX - SVG_X, event.clientY - SVG_Y));
    } else if (event.currentTarget === event.target && !event.shiftKey) {  // Only start a selection box from an empty area
      setMouseInteractionMode(MouseInteractionMode.Selecting);
      setDragStartCoords(new CoordsInClient(event.clientX - SVG_X, event.clientY - SVG_Y));
    } else if (event.shiftKey) {
      setMouseInteractionMode(MouseInteractionMode.Panning);
    }
  };

  const handlePlotMouseMove = (event: React.MouseEvent<SVGElement>) => {
    // Don't do anything if the mouse isn't dragging with the primary button pressed
    if (event.buttons !== PRIMARY_MOUSE_BUTTON) return;
  
    // If we're panning, dispatch a Pan action for the distance the mouse has moved since the last event,
    // and return early since we don't need to update any drag coordinates in state for a pan
    if (mouseInteractionMode === MouseInteractionMode.Panning) {
      dispatch(new Pan(new ClientCoordsOffset(event.movementX, event.movementY)));
      return;
    }

    // If for some reason the drag start coordinates aren't set, we probably aren't in a valid drag state,
    // so don't do anything
    if (!dragStartCoords) return;

    // If we have valid drag start coordinates, update the drag end coordinates in state to the current mouse position
    setRawDragEndCoords(new CoordsInClient(event.clientX - SVG_X, event.clientY - SVG_Y));
    setIsShiftDragging(event.shiftKey);
  };

  const handlePlotMouseUp = (event: React.MouseEvent<SVGElement>) => {
    // Determine what action we're completing, between:
    // - Making a box selection (if we dragged out a selection box from an empty area)
    // - Moving nodes, trees, or shapes (if we dragged from a selected entity)
    // - Resizing a shape (if we dragged from a shape's resize handle)
    // - Creating a shape at an arbitrary position (if we dragged from an empty area while a shape tool was active)
    // - Creating an enclosure shape around a node (if we dragged an enclosure shape around a single node)
    // - Clicking to clear selection or create a new tree (if we just clicked without dragging)

    // To count as a box selection, we must have a selection box (which only starts if we drag from an empty area)
    // and we must have dragged at least a minimum distance, to distinguish from small, accidental mouse movements while clicking.
    const isSelectionBoxIntentional = selectionBoxTopLeft && selectionBoxBottomRight && dragOffset && (
      Math.abs(dragOffset.dClientX) > MINIMUM_SELECTION_BOX_DIMENSION ||
        Math.abs(dragOffset.dClientY) > MINIMUM_SELECTION_BOX_DIMENSION
    );

    if (isSelectionBoxIntentional) {
      const rectInPlot = new RectInClient(selectionBoxTopLeft, selectionBoxBottomRight)
        .toRectInPlot(state.panZoomState);
      dispatch(determineActionOnSelectBoxCompletion(
        plot,
        rectInPlot,
        state.selection,
        event.ctrlKey || event.metaKey ? EntitySelectionMode.AddToSelection : EntitySelectionMode.SetSelection,
        state.selectionAction
      ));
    } else if (dragStartCoords && dragEndCoords && mouseInteractionMode !== MouseInteractionMode.Selecting) {
      // In the context of editing the content, we will count any drag as intentional,
      // since even small drags can be meaningful (e.g. dragging a node a small distance to adjust the tree layout).
      const action = determineActionOnDragCompletion(
        plot,
        mouseInteractionMode,
        dragStartCoords,
        dragEndCoords,
        state.panZoomState,
        state.activeShapeTool,
        resizeHandleId,
        isShiftDragging,
      );
      if (action) dispatch(action);
    } else if (dragStartCoords && event.currentTarget === event.target) {
      handlePlotClick(event);
    }
    setDragStartCoords(undefined);
    setRawDragEndCoords(undefined);
    setResizeHandleId(undefined);
    setResizingShape(undefined);
    setIsShiftDragging(false);
    setMouseInteractionMode(MouseInteractionMode.Idle);
  };

  // When the user clicks on an entity, we want to start a drag immediately so that they can move the entity by dragging without having to click twice.
  // Selection itself is not handled here; entity-level components will handle that in their own onMouseDown handlers,
  // and this handler will just take care of starting the drag after the entity is selected.
  const handleNodeMouseDown = (event: React.MouseEvent<SVGElement>) => {
    if (event.buttons === PRIMARY_MOUSE_BUTTON) {
      setMouseInteractionMode(MouseInteractionMode.DraggingNodes);
      setDragStartCoords(new CoordsInClient(event.clientX - SVG_X, event.clientY - SVG_Y));
    }
  };

  const handleTreeMouseDown = (event: React.MouseEvent<SVGElement>) => {
    if (event.buttons === PRIMARY_MOUSE_BUTTON) {
      setMouseInteractionMode(MouseInteractionMode.DraggingTrees);
      setDragStartCoords(new CoordsInClient(event.clientX - SVG_X, event.clientY - SVG_Y));
    }
  };

  const handleShapeMouseDown = (event: React.MouseEvent<SVGElement>) => {
    if (event.buttons === PRIMARY_MOUSE_BUTTON) {
      setMouseInteractionMode(MouseInteractionMode.DraggingShapes);
      setDragStartCoords(new CoordsInClient(event.clientX - SVG_X, event.clientY - SVG_Y));
    }
  };

  const handleResizeHandleMouseDown = (handleId: string, event: React.MouseEvent<SVGElement>) => {
    if (event.buttons === PRIMARY_MOUSE_BUTTON && selectedShapeIds.length === 1) {
      const shape = plot.shapes.get(selectedShapeIds[0]);
      // Only free-standing shapes are resizable (and only they render usable resize handles).
      // Kotlin interfaces can't be checked with instanceof from JS, so we check the concrete classes.
      if (shape instanceof EnclosureShape || shape instanceof LineShape) {
        setMouseInteractionMode(MouseInteractionMode.ResizingShape);
        setResizeHandleId(handleId);
        setResizingShape(shape);
        setDragStartCoords(new CoordsInClient(event.clientX - SVG_X, event.clientY - SVG_Y));
      }
    }
  };

  // Mouse wheel interactions are deferred to a separate hook since they require some bespoke logic.
  // See `usePlotMouseWheelInteractions` for details.
  const { handlePlotWheel } = usePlotMouseWheelInteractions(svgRef);

  // Prevent the default browser drag-and-drop behavior when dragging files or text into the plot,
  // since we want to use drag-and-drop for adding trees from text, and the default behavior would interfere with that.
  const preventDefaultDragEvent = (event: React.DragEvent<SVGElement>) => event.preventDefault();

  // Handle dropping text into the plot to create a new tree from that text in labelled bracket notation.
  const handleDrop = (event: React.DragEvent<SVGElement>) => {
    event.preventDefault();
    const text = event.dataTransfer.getData('text/plain');
    if (text.startsWith('[') && text.endsWith(']')) {
      event.preventDefault();
      dispatch(new AddTreeFromLbn(new CoordsInClient(event.clientX, event.clientY), text));
    }
  };

  return {
    mouseInteractionMode,
    selectedShapeIds,
    selectionBoxTopLeft,
    selectionBoxBottomRight,
    dragOffset,
    plotViewCursor,
    resizePreviewShape,
    creationPreviewShape,
    handlePlotMouseDown,
    handlePlotMouseMove,
    handlePlotMouseUp,
    handleNodeMouseDown,
    handleTreeMouseDown,
    handleShapeMouseDown,
    handleResizeHandleMouseDown,
    handlePlotWheel,
    preventDefaultDragEvent,
    handleDrop,
  };
};

export default usePlotMouseInteractions;
