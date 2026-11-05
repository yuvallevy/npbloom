import { ClientCoordsOffset, CoordsInClient, CoordsInPlot, coordsInPlotToCoordsInClient, EnclosureShape,
  PanZoomState, PlotCoordsOffset, plotCoordsOffsetToClientCoordsOffset, ResolvedNodeBoundEnclosureShape } from 'npbloom-core';
import { renderHandles, shapeViewClassName, snap } from './common';

/**
 * Base function for rendering the visible part of an enclosure.
 * Used by both `renderFreeStandingEnclosure` and `renderNodeBoundEnclosure`.
 *
 * All values are plain numbers with no specified coordinate system (plot/tree/client).
 * What they mean depends on the transform of the group the result is placed in, which the caller is responsible for.
 * Free-standing enclosures pass client coordinates. Node-bound enclosures, which are drawn inside a tree group with a
 * transformation, pass tree coordinates.
 */
export const renderBaseEnclosure = (
  x: number,
  y: number,
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
      cx={x + width / 2}
      cy={y + height / 2}
      rx={width / 2}
      ry={height / 2}
    />
    : <rect {...commonProps}
      x={x}
      y={y}
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
  acceptMouseEvents = true,
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
      previewTopLeft.clientX,
      previewTopLeft.clientY,
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

  return <g className={shapeViewClassName(acceptMouseEvents)} onMouseDown={onMouseDown} id={`shape-${shape.id}`}>
    {/* Visual: the actual shape, optionally snapped to pixel boundaries for better rendering quality */}
    {renderBaseEnclosure(snappedTopLeft.clientX, snappedTopLeft.clientY, width, height, cornerRadius, 'ShapeView--visual',
      shape.strokeColor, scaledStrokeWidth, shape.fillColor ?? undefined)}

    {/* Hit area: outline only, no fill, so interior elements remain interactive */}
    {renderBaseEnclosure(topLeft.clientX, topLeft.clientY, width, height, cornerRadius, 'ShapeView--hitarea', 'none')}

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
      {renderBaseEnclosure(topLeft.clientX, topLeft.clientY, width, height, cornerRadius)}
    </g>}
    {resizeGhost}
  </g>;
};

export const renderNodeBoundEnclosure = (
  shape: ResolvedNodeBoundEnclosureShape,
  isSelected: boolean,
  panZoomState: PanZoomState,
  onMouseDown?: (event: React.MouseEvent<SVGElement>) => void,
  acceptMouseEvents = true,
) => {
  const zoomLevel = panZoomState.zoomLevel;

  // The anchor is the anchor tree's position, converted exactly the way TreeView converts it,
  // so that the visual layer below can share the tree's transform and line up with it precisely.
  const anchor = coordsInPlotToCoordsInClient(new CoordsInPlot(shape.anchorPlotX, shape.anchorPlotY), panZoomState);
  const treeLayerTransform = `translate(${anchor.clientX}px, ${anchor.clientY}px) scale(${zoomLevel})`;

  // The interactive parts (hit area and handles) have fixed on-screen sizes, so they can't live in the scaled layer.
  // Their positions are computed in client coordinates instead, like for free-standing enclosures.
  const topLeftFromAnchor = plotCoordsOffsetToClientCoordsOffset(new PlotCoordsOffset(shape.treeX, shape.treeY), panZoomState);
  const width = shape.width * zoomLevel;
  const height = shape.height * zoomLevel;
  const cornerRadius = shape.cornerRadius * zoomLevel;

  const leftEdge = anchor.clientX + topLeftFromAnchor.dClientX;
  const topEdge = anchor.clientY + topLeftFromAnchor.dClientY;
  const rightEdge = leftEdge + width;
  const bottomEdge = topEdge + height;
  const centerX = leftEdge + width / 2;
  const centerY = topEdge + height / 2;

  return <g className={shapeViewClassName(acceptMouseEvents)} onMouseDown={onMouseDown} id={`shape-${shape.id}`}>
    {/* Visual: drawn in tree coordinates, inside a layer with the same transform as the anchor tree's group.
        Single-tree export strips this transform along with the tree's, leaving both in tree coordinates.
        Not pixel-snapped, for the same reason: it must render exactly like the tree it belongs to. */}
    <g style={{ transform: treeLayerTransform }}>
      {renderBaseEnclosure(shape.treeX, shape.treeY, shape.width, shape.height, shape.cornerRadius,
        'ShapeView--visual', shape.strokeColor, shape.strokeWidth, shape.fillColor ?? undefined,
        /* exportInGraphics = */ true)}
    </g>

    {/* Hit area: outline only, no fill, so interior elements remain interactive */}
    {renderBaseEnclosure(leftEdge, topEdge, width, height, cornerRadius, 'ShapeView--hitarea', 'none')}

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
    ], () => undefined)}
  </g>;
};