import { ClientCoordsOffset, CoordsInClient, CoordsInPlot, coordsInPlotToCoordsInClient, EnclosureShape,
  PanZoomState, PlotCoordsOffset, plotCoordsOffsetToClientCoordsOffset, ResolvedNodeBoundEnclosureShape } from 'npbloom-core';
import { renderHandles, snap } from './common';

/**
 * Base function for rendering the visible part of an enclosure.
 * Used by both `renderFreeStandingEnclosure` and `renderNodeBoundEnclosure`.
 */
export const renderBaseEnclosure = (
  // Anchor is only meaningful for bound enclosures, where it is the same as the anchor of the parent tree.
  // For free-standing enclosures, which are always plot-level, the anchor is (0, 0).
  // ClientCoordsOffset is used here rather than CoordsInClient because this value can be relative.
  topLeftFromAnchor: ClientCoordsOffset,
  width: number,
  height: number,
  cornerRadius: number,
  className?: string,
  stroke?: string,
  strokeWidth?: number,
  fill?: string,
  exportInGraphics?: boolean,
) => {
  const commonProps = { className, stroke, strokeWidth, fill: fill ?? 'none',
    'data-npb-export': exportInGraphics ? 'true' : undefined };
  return cornerRadius === Infinity
    ? <ellipse {...commonProps}
      cx={topLeftFromAnchor.dClientX + width / 2}
      cy={topLeftFromAnchor.dClientY + height / 2}
      rx={width / 2}
      ry={height / 2}
    />
    : <rect {...commonProps}
      x={topLeftFromAnchor.dClientX}
      y={topLeftFromAnchor.dClientY}
      width={width}
      height={height}
      rx={cornerRadius}
      ry={cornerRadius}
    />;
};

export const renderFreeStandingEnclosure = (
  shape: EnclosureShape,
  isSelected: boolean,
  panZoomState: PanZoomState,
  dragOffset?: ClientCoordsOffset,
  resizePreviewShape?: EnclosureShape,
  onMouseDown?: (event: React.MouseEvent<SVGElement>) => void,
  onResizeHandleMouseDown?: (handleId: string, event: React.MouseEvent<SVGElement>) => void,
) => {
  const zoomLevel = panZoomState.zoomLevel;
  const scaledStrokeWidth = shape.strokeWidth * zoomLevel;

  // The values of the variables below are scaled to client size.
  // "Client" or "scaled" are omitted from the variable names for brevity.
  const topLeft = coordsInPlotToCoordsInClient(new CoordsInPlot(shape.x, shape.y), panZoomState);
  const width = shape.width * zoomLevel;
  const height = shape.height * zoomLevel;
  const cornerRadius = shape.cornerRadius * zoomLevel;

  // Move preview: render a ghost of the shape being dragged, transformed to the current mouse position
  const moveGhostTransform = dragOffset && isSelected
    ? `translate(${dragOffset.dClientX}px, ${dragOffset.dClientY}px)` : undefined;

  // Resize preview: render a ghost of the target shape
  let resizeGhost: React.ReactNode = null;
  if (resizePreviewShape) {
    const previewTopLeft = coordsInPlotToCoordsInClient(
      new CoordsInPlot(resizePreviewShape.x, resizePreviewShape.y),
      panZoomState,
    );
    const previewWidth = resizePreviewShape.width * zoomLevel;
    const previewHeight = resizePreviewShape.height * zoomLevel;
    const previewCornerRadius = resizePreviewShape.cornerRadius * zoomLevel;
    resizeGhost = renderBaseEnclosure(
      previewTopLeft.toOffset(),
      previewWidth,
      previewHeight,
      previewCornerRadius,
      'ShapeView--ghost',
    );
  }

  const leftEdge = topLeft.clientX;
  const topEdge = topLeft.clientY;
  const rightEdge = leftEdge + width;
  const bottomEdge = topEdge + height;
  const centerX = leftEdge + width / 2;
  const centerY = topEdge + height / 2;

  const snappedTopLeft = new CoordsInClient(
    snap(leftEdge, scaledStrokeWidth),
    snap(topEdge, scaledStrokeWidth),
  );

  return <g className="ShapeView" onMouseDown={onMouseDown} id={`shape-${shape.id}`}>
    {/* Visual: the actual shape, optionally snapped to pixel boundaries for better rendering quality */}
    {renderBaseEnclosure(snappedTopLeft.toOffset(), width, height, cornerRadius, 'ShapeView--visual',
      shape.strokeColor, scaledStrokeWidth, shape.fillColor ?? undefined)}

    {/* Hit area: outline only, no fill, so interior elements remain interactive */}
    {renderBaseEnclosure(topLeft.toOffset(), width, height, cornerRadius, 'ShapeView--hitarea', 'none')}

    {/* Handles: only rendered when selected, so they don't interfere with interaction when not needed */}
    {isSelected && onResizeHandleMouseDown && renderHandles([
      { id: 'nw', x: leftEdge, y: topEdge },
      { id: 'n', x: centerX, y: topEdge },
      { id: 'ne', x: rightEdge, y: topEdge },
      { id: 'e', x: rightEdge, y: centerY },
      { id: 'se', x: rightEdge, y: bottomEdge },
      { id: 's', x: centerX, y: bottomEdge },
      { id: 'sw', x: leftEdge, y: bottomEdge },
      { id: 'w', x: leftEdge, y: centerY },
    ], onResizeHandleMouseDown)}

    {/* Drag preview: render a ghost of the shape being dragged, transformed to the current mouse position */}
    {moveGhostTransform && <g className="ShapeView--ghost" style={{ transform: moveGhostTransform }}>
      {renderBaseEnclosure(topLeft.toOffset(), width, height, cornerRadius)}
    </g>}
    {resizeGhost}
  </g>;
};

export const renderNodeBoundEnclosure = (
  shape: ResolvedNodeBoundEnclosureShape,
  isSelected: boolean,
  panZoomState: PanZoomState,
  onMouseDown?: (event: React.MouseEvent<SVGElement>) => void,
) => {
  const zoomLevel = panZoomState.zoomLevel;
  const scaledStrokeWidth = shape.strokeWidth * zoomLevel;

  const anchorTopLeft = coordsInPlotToCoordsInClient(new CoordsInPlot(shape.anchorPlotX, shape.anchorPlotY), panZoomState);
  const topLeftInTree = plotCoordsOffsetToClientCoordsOffset(new PlotCoordsOffset(shape.treeX, shape.treeY), panZoomState);
  const width = shape.width * zoomLevel;
  const height = shape.height * zoomLevel;
  const cornerRadius = shape.cornerRadius * zoomLevel;

  const snappedAnchorTopLeft = new CoordsInClient(
    snap(anchorTopLeft.clientX, scaledStrokeWidth),
    snap(anchorTopLeft.clientY, scaledStrokeWidth),
  );
  const snappedTopLeftInTree = new ClientCoordsOffset(
    snap(topLeftInTree.dClientX, scaledStrokeWidth),
    snap(topLeftInTree.dClientY, scaledStrokeWidth),
  );

  const leftEdge = topLeftInTree.dClientX;
  const topEdge = topLeftInTree.dClientY;
  const rightEdge = leftEdge + width;
  const bottomEdge = topEdge + height;
  const centerX = leftEdge + width / 2;
  const centerY = topEdge + height / 2;

  return <g className="ShapeView" onMouseDown={onMouseDown} id={`shape-${shape.id}`} style={{
    transform: snappedAnchorTopLeft ? `translate(${snappedAnchorTopLeft.clientX}px, ${snappedAnchorTopLeft.clientY}px)` : ''
  }}>
    {/* Visual: the actual shape, optionally snapped to pixel boundaries for better rendering quality */}
    {renderBaseEnclosure(snappedTopLeftInTree, width, height, cornerRadius, 'ShapeView--visual',
      shape.strokeColor, scaledStrokeWidth, shape.fillColor ?? undefined, /* exportInGraphics = */ true)}

    {/* Hit area: outline only, no fill, so interior elements remain interactive */}
    {renderBaseEnclosure(topLeftInTree, width, height, cornerRadius, 'ShapeView--hitarea', 'none',
      /* strokeWidth = */ undefined, /* fill = */ undefined)}

    {/* Handles as selection indicator, no-op since the shape can't actually be resized */}
    {isSelected && renderHandles([
      { id: 'nw', x: leftEdge, y: topEdge },
      { id: 'n', x: centerX, y: topEdge },
      { id: 'ne', x: rightEdge, y: topEdge },
      { id: 'e', x: rightEdge, y: centerY },
      { id: 'se', x: rightEdge, y: bottomEdge },
      { id: 's', x: centerX, y: bottomEdge },
      { id: 'sw', x: leftEdge, y: bottomEdge },
      { id: 'w', x: leftEdge, y: centerY },
    ], () => {})}
  </g>;
};