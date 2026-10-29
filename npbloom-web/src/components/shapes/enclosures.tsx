import { ClientCoordsOffset, CoordsInClient, CoordsInPlot, coordsInPlotToCoordsInClient, EnclosureShape,
  PanZoomState, ResolvedNodeBoundEnclosureShape } from 'npbloom-core';
import { renderHandles, snap } from './common';

/**
 * Base function for rendering the visible part of an enclosure.
 * Used by both `renderFreeStandingEnclosure` and `renderNodeBoundEnclosure`.
 */
export const renderBaseEnclosure = (
  topLeft: CoordsInClient,
  width: number,
  height: number,
  cornerRadius: number,
  className?: string,
  stroke?: string,
  strokeWidth?: number,
  fill?: string,
) => cornerRadius === Infinity
  ? <ellipse
      className={className}
      cx={topLeft.clientX + width / 2}
      cy={topLeft.clientY + height / 2}
      rx={width / 2}
      ry={height / 2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill={fill ?? 'none'}
    />
  : <rect
      className={className}
      x={topLeft.clientX}
      y={topLeft.clientY}
      width={width}
      height={height}
      rx={cornerRadius}
      ry={cornerRadius}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill={fill ?? 'none'}
    />;

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
      previewTopLeft,
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
    {renderBaseEnclosure(snappedTopLeft, width, height, cornerRadius, 'ShapeView--visual',
      shape.strokeColor, scaledStrokeWidth, shape.fillColor ?? undefined)}

    {/* Hit area: outline only, no fill, so interior elements remain interactive */}
    {renderBaseEnclosure(topLeft, width, height, cornerRadius, 'ShapeView--hitarea', 'none')}

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
      {renderBaseEnclosure(topLeft, width, height, cornerRadius)}
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

  const topLeft = coordsInPlotToCoordsInClient(new CoordsInPlot(shape.plotX, shape.plotY), panZoomState);
  const width = shape.width * zoomLevel;
  const height = shape.height * zoomLevel;
  const cornerRadius = shape.cornerRadius * zoomLevel;

  const snappedTopLeft = new CoordsInClient(
    snap(topLeft.clientX, scaledStrokeWidth),
    snap(topLeft.clientY, scaledStrokeWidth),
  );

  const leftEdge = topLeft.clientX;
  const topEdge = topLeft.clientY;
  const rightEdge = leftEdge + width;
  const bottomEdge = topEdge + height;
  const centerX = leftEdge + width / 2;
  const centerY = topEdge + height / 2;

  return <g className="ShapeView" onMouseDown={onMouseDown} id={`shape-${shape.id}`}>
    {/* Visual: the actual shape, optionally snapped to pixel boundaries for better rendering quality */}
    {renderBaseEnclosure(snappedTopLeft, width, height, cornerRadius, 'ShapeView--visual',
      shape.strokeColor, scaledStrokeWidth, shape.fillColor ?? undefined)}

    {/* Hit area: outline only, no fill, so interior elements remain interactive */}
    {renderBaseEnclosure(topLeft, width, height, cornerRadius, 'ShapeView--hitarea', 'none')}

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