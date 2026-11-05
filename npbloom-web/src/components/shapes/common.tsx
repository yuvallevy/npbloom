// Handle size should be an odd number of pixels so the center of the handle is exactly on the shape boundary
// regardless of screen DPI and zoom level.
const HANDLE_SIZE = 7;
// The hit area for the handle is larger than the visible handle to make it easier to interact with.
// The number is arbitrarily chosen based on testing and ~*~ v i b e s ~*~.
const HANDLE_HIT_AREA_SIZE = 19;
// Half-size helpers for convenience when centering the handles on the shape boundaries.
const HALF_HANDLE = HANDLE_SIZE / 2;
const HALF_HANDLE_HIT_AREA = HANDLE_HIT_AREA_SIZE / 2;

const HANDLE_CURSORS: Record<string, string> = {
  nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize',
  se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize',
  start: 'grab', end: 'grab',
};

/**
 * Returns the class name for the root element of a shape.
 * When the shape should not accept mouse events (e.g. while the user is drawing a new shape),
 * an "inert" modifier is added that disables pointer events for the entire shape, including its hit areas.
 */
export const shapeViewClassName = (acceptMouseEvents: boolean): string =>
  'ShapeView' + (acceptMouseEvents ? '' : ' ShapeView--inert');

/**
 * Returns the given coordinate snapped to a physical pixel boundary, if it is necessary to improve rendering quality.
 * Used for crisp rendering at any DPI.
 */
export const snap = (coord: number, scaledStrokeWidth: number = 1): number => {
  const devicePixelRatio = window.devicePixelRatio;
  const snapped = Math.round(coord * devicePixelRatio) / devicePixelRatio;
  return Math.round(scaledStrokeWidth * devicePixelRatio) % 2 !== 0
    ? snapped + 0.5 / devicePixelRatio
    : snapped;
};

const renderHandle = (
  handleId: string,
  x: number,
  y: number,
  onMouseDown: (handleId: string, event: React.MouseEvent<SVGElement>) => void,
) =>
  <>
    <rect
      key={`${handleId}-hitarea`}
      className="ShapeView--handle-hitarea"
      x={snap(x - HALF_HANDLE_HIT_AREA, 1)}
      y={snap(y - HALF_HANDLE_HIT_AREA, 1)}
      width={HANDLE_HIT_AREA_SIZE}
      height={HANDLE_HIT_AREA_SIZE}
      style={{ cursor: HANDLE_CURSORS[handleId] ?? 'grab' }}
      onMouseDown={event => { event.stopPropagation(); onMouseDown(handleId, event); }}
    />
    <rect
      key={handleId}
      className="ShapeView--handle"
      x={snap(x - HALF_HANDLE, 1)}
      y={snap(y - HALF_HANDLE, 1)}
      width={HANDLE_SIZE}
      height={HANDLE_SIZE}
    />
  </>;

export const renderHandles = (
  handleDefs: { id: string, x: number; y: number }[],
  onMouseDown: (handleId: string, event: React.MouseEvent<SVGElement>) => void,
) => handleDefs.map(({ id, x, y }) => renderHandle(id, x, y, onMouseDown));
