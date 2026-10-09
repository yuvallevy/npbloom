import React from 'react';
import {
  applyShapeSelection,
  ClientCoordsOffset,
  DrawablePlotShape,
  EnclosureShape,
  EntitySelectionMode,
  FreeStandingPlotShape,
  LineShape,
  PanZoomState,
  ResolvedNodeBoundEnclosureShape,
  SetSelection,
  ShapeSelectionInPlot,
} from 'npbloom-core';
import { Id } from '../../types';
import { renderFreeStandingEnclosure, renderNodeBoundEnclosure } from './enclosures';
import { renderLine } from './lines';
import useUiState from '../../useUiState';
import './ShapeView.scss';

interface ShapeViewProps {
  shape: DrawablePlotShape;
  isSelected: boolean;
  panZoomState: PanZoomState;
  dragOffset?: ClientCoordsOffset;
  resizePreviewShape?: FreeStandingPlotShape;
  onMouseDown?: (event: React.MouseEvent<SVGElement>) => void;
  onSelect?: (id: Id, mode: EntitySelectionMode) => void;
  onResizeHandleMouseDown?: (handleId: string, event: React.MouseEvent<SVGElement>) => void;
}

const ShapeView: React.FC<ShapeViewProps> = ({
  shape,
  isSelected,
  panZoomState,
  dragOffset,
  resizePreviewShape,
  onMouseDown,
  onResizeHandleMouseDown,
}) => {
  const { state, dispatch } = useUiState();
  const handleShapeSelect = (shapeId: string, mode: EntitySelectionMode) => {
    const existing = state.selection instanceof ShapeSelectionInPlot
      ? [...state.selection.shapeIdsAsArray] : [];
    dispatch(new SetSelection(applyShapeSelection(mode, [shapeId], existing)));
  };

  // Mouse interaction is the same for all shapes - clicking selects the shape, dragging moves it (if possible).
  // Resizing is handled separately since it is different between shape types.
  const handleShapeMouseDown = ((event: React.MouseEvent<SVGElement>) => {
    event.stopPropagation();
    handleShapeSelect(
      shape.id,
      event.ctrlKey || event.metaKey
        ? EntitySelectionMode.AddToSelection
        : EntitySelectionMode.SetSelection
    );
    // Node-bound enclosures derive their position from their anchor node, so dragging them is a no-op.
    // Selection still applies, but we don't start a move-drag for them.
    if (!(shape instanceof ResolvedNodeBoundEnclosureShape)) onMouseDown && onMouseDown(event);
  });

  if (shape instanceof EnclosureShape) return renderFreeStandingEnclosure(
    shape,
    isSelected,
    panZoomState,
    dragOffset,
    resizePreviewShape as EnclosureShape | undefined,
    handleShapeMouseDown,
    onResizeHandleMouseDown,
  );

  if (shape instanceof LineShape) return renderLine(
    shape,
    isSelected,
    panZoomState,
    dragOffset,
    resizePreviewShape as LineShape | undefined,
    handleShapeMouseDown,
    onResizeHandleMouseDown,
  );

  if (shape instanceof ResolvedNodeBoundEnclosureShape) return renderNodeBoundEnclosure(
    shape,
    isSelected,
    panZoomState,
    handleShapeMouseDown,
  );

  return null;
};

export default ShapeView;
