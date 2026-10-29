import { Arrowhead, ClientCoordsOffset, CoordsInClient, coordsInPlotToCoordsInClient, LineShape, PanZoomState } from 'npbloom-core';
import { renderHandles, snap } from './common';

const ARROWHEAD_LENGTH = 10;

/**
 * Returns the endpoint for the given line shortened by a given pixel distance toward the other endpoint.
 * Used for rendering arrowheads without the line overshooting the tip.
 */
const shortenEndpoint = (
  start: CoordsInClient,
  end: CoordsInClient,
  shortenBy: number,
): CoordsInClient => {
  // Convert to vector, find its length, and scale it down
  const dx = end.clientX - start.clientX;
  const dy = end.clientY - start.clientY;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Avoid division by zero
  if (len === 0) return new CoordsInClient(end.clientX, end.clientY);
  const ratio = (len - shortenBy) / len;
  return new CoordsInClient(start.clientX + dx * ratio, start.clientY + dy * ratio);
};

export const renderLine = (
  shape: LineShape,
  isSelected: boolean,
  panZoomState: PanZoomState,
  dragOffset?: ClientCoordsOffset,
  resizePreviewShape?: LineShape,
  onMouseDown?: (event: React.MouseEvent<SVGElement>) => void,
  onResizeHandleMouseDown?: (handleId: string, event: React.MouseEvent<SVGElement>) => void,
) => {
  const zoomLevel = panZoomState.zoomLevel;
  const scaledStrokeWidth = shape.strokeWidth * zoomLevel;

  const start = coordsInPlotToCoordsInClient(shape.start, panZoomState);
  const end = coordsInPlotToCoordsInClient(shape.end, panZoomState);
  const hasEndArrow = shape.arrowhead === Arrowhead.End || shape.arrowhead === Arrowhead.Both;
  const hasStartArrow = shape.arrowhead === Arrowhead.Start || shape.arrowhead === Arrowhead.Both;
  const markerEnd = hasEndArrow ? 'url(#arrowhead-end)' : undefined;
  const markerStart = hasStartArrow ? 'url(#arrowhead-start)' : undefined;

  // Shorten line so it ends at the base of the arrowhead, not past the tip
  const lineEnd = hasEndArrow ? shortenEndpoint(start, end, ARROWHEAD_LENGTH * zoomLevel) : end;
  const lineStart = hasStartArrow ? shortenEndpoint(end, start, ARROWHEAD_LENGTH * zoomLevel) : start;

  // Move preview: render a ghost of the shape being dragged, transformed to the current mouse position
  const moveGhostTransform = dragOffset && isSelected
    ? `translate(${dragOffset.dClientX}px, ${dragOffset.dClientY}px)` : undefined;

  // Resize preview: render a ghost of the target shape
  let resizeGhost: React.ReactNode = null;
  if (resizePreviewShape) {
    const previewStart = coordsInPlotToCoordsInClient(resizePreviewShape.start, panZoomState);
    const previewEnd = coordsInPlotToCoordsInClient(resizePreviewShape.end, panZoomState);
    resizeGhost = <line className="ShapeView--ghost"
      x1={previewStart.clientX}
      y1={previewStart.clientY}
      x2={previewEnd.clientX}
      y2={previewEnd.clientY}
    />;
  }

  const snappedStart = new CoordsInClient(
    snap(lineStart.clientX, scaledStrokeWidth), 
    snap(lineStart.clientY, scaledStrokeWidth),
  );
  const snappedEnd = new CoordsInClient(
    snap(lineEnd.clientX, scaledStrokeWidth),
    snap(lineEnd.clientY, scaledStrokeWidth),
  );

  return <g className="ShapeView" onMouseDown={onMouseDown} id={`shape-${shape.id}`}>
    {/* Visual: the actual line, optionally snapped to pixel boundaries for better rendering quality */}
    <line className="ShapeView--visual"
      x1={snappedStart.clientX}
      y1={snappedStart.clientY}
      x2={snappedEnd.clientX}
      y2={snappedEnd.clientY}
      stroke={shape.strokeColor}
      strokeWidth={scaledStrokeWidth}
      markerEnd={markerEnd}
      markerStart={markerStart}
    />

    {/* Hit area: a wider invisible line on top of the visual line to make it easier to interact with */}
    <line
      className="ShapeView--hitarea"
      x1={start.clientX}
      y1={start.clientY}
      x2={end.clientX}
      y2={end.clientY}
    />
    
    {/* Handles: only rendered when selected, so they don't interfere with interaction when not needed */}
    {isSelected && onResizeHandleMouseDown && renderHandles([
      { id: 'start', x: start.clientX, y: start.clientY },
      { id: 'end', x: end.clientX, y: end.clientY },
    ], onResizeHandleMouseDown)}

    {/* Drag preview: render a ghost of the line being dragged, transformed to the current mouse position */}
    {moveGhostTransform && <g className="ShapeView--ghost" style={{ transform: moveGhostTransform }}>
      <line
        x1={start.clientX}
        y1={start.clientY}
        x2={end.clientX}
        y2={end.clientY}
      />
    </g>}
    {resizeGhost}
  </g>;
};