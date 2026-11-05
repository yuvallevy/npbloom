import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { applyNodePositionsToPlot, MouseInteractionMode, PositionedPlot, ShapeTool } from 'npbloom-core';
import usePlotMouseInteractions from './usePlotMouseInteractions';
import TreeView from './TreeView';
import ShapeView from './shapes/ShapeView.tsx';
import SentenceView from './SentenceView';
import LabelNodeEditor from './LabelNodeEditor';
import ZoomControl from './ZoomControl.tsx';
import useUiState from '../useUiState';
import useModifierKey from '../useModifierKey';
import SettingsStateContext from '../SettingsStateContext';
import GuidedTour from './meta/guided-tour/GuidedTour.tsx';
import PlotPlaceholder from './meta/PlotPlaceholder.tsx';
import './PlotView.scss';

const PlotView: React.FC = () => {
  const { state } = useUiState();
  const { strWidth } = useContext(SettingsStateContext);

  const [guidedTourActive, setGuidedTourActive] = useState<boolean>(false);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const isAltHeld = useModifierKey('Alt');

  const { editedNodeIndicator } = state;

  const activePlot = state.contentState.current.plots[state.activePlotIndex];

  const plot: PositionedPlot = useMemo(() => {
    const unpositionedPlot = state.contentState.current.plots[state.activePlotIndex];
    return applyNodePositionsToPlot(strWidth, unpositionedPlot);
  }, [state.contentState, state.activePlotIndex, strWidth]);

  const {
    mouseInteractionMode,
    plotViewCursor,
    selectedShapeIds,
    selectionBoxTopLeft,
    selectionBoxBottomRight,
    dragOffset,
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
  } = usePlotMouseInteractions(plot, svgRef);

  const isMouseIdle = mouseInteractionMode === MouseInteractionMode.Idle;
  const isShapeToolActive = state.activeShapeTool !== ShapeTool.None;
  // When the user is about to draw a shape, the plot content must not capture the mouse,
  // so that the user can start drawing anywhere (including on top of existing entities).
  // This only applies to dragging in the context of drawing a shape, not any other context (e.g. moving an entity).
  const svgEntitiesAcceptMouseEvents = !isShapeToolActive;
  // HTML overlays (sentences, placeholder) sit on top of the SVG.
  // They need to let mouse events through during any kind of drag (moving, resizing, shape drawing)
  // so they don't get in the way.
  const htmlOverlaysAcceptMouseEvents = isMouseIdle && !isShapeToolActive;

  const handleGuidedTourComplete = useCallback(() => setGuidedTourActive(false), []);

  return <>
    <svg
      ref={svgRef}
      className="PlotView--svg"
      width="100%"
      height="100%"
      style={{ cursor: plotViewCursor }}
      onMouseDown={handlePlotMouseDown}
      onMouseMove={handlePlotMouseMove}
      onMouseUp={handlePlotMouseUp}
      onWheel={handlePlotWheel}
      onDragEnter={preventDefaultDragEvent}
      onDragOver={preventDefaultDragEvent}
      onDrop={handleDrop}
    >
      <defs>
        <pattern id="folded-pattern" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#000" strokeWidth="1.5" />
        </pattern>
        <marker id="arrowhead-end" markerWidth="20" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="10 0, 20 3.5, 10 7" fill="#000" />
        </marker>
        <marker id="arrowhead-start" markerWidth="14" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, -10 3.5, 0 7" fill="#000" />
        </marker>
      </defs>
      {plot.trees.map(tree =>
        <TreeView
          key={`tree-${tree.id}`}
          treeId={tree.id}
          tree={tree}
          isAltHeld={isAltHeld}
          acceptMouseEvents={svgEntitiesAcceptMouseEvents}
          nodeDragOffset={mouseInteractionMode === MouseInteractionMode.DraggingNodes ? dragOffset : undefined}
          treeDragOffset={mouseInteractionMode === MouseInteractionMode.DraggingTrees ? dragOffset : undefined}
          onNodeMouseDown={handleNodeMouseDown}
          onTreeMouseDown={handleTreeMouseDown}
        />)}
      {plot.shapes.map(shape =>
        <ShapeView
          key={`shape-${shape.id}`}
          shape={shape}
          isSelected={selectedShapeIds.includes(shape.id)}
          acceptMouseEvents={svgEntitiesAcceptMouseEvents}
          panZoomState={state.panZoomState}
          dragOffset={mouseInteractionMode === MouseInteractionMode.DraggingShapes ? dragOffset : undefined}
          resizePreviewShape={resizePreviewShape && shape.id === resizePreviewShape.id ? resizePreviewShape : undefined}
          onMouseDown={handleShapeMouseDown}
          onResizeHandleMouseDown={handleResizeHandleMouseDown}
        />)}
      {creationPreviewShape && <ShapeView
        key="creation-preview"
        shape={creationPreviewShape}
        isSelected={false}
        panZoomState={state.panZoomState}
      />}
      {selectionBoxTopLeft && selectionBoxBottomRight && <rect
        className="PlotView--selection-box"
        x={selectionBoxTopLeft.clientX}
        y={selectionBoxTopLeft.clientY}
        width={selectionBoxBottomRight.clientX - selectionBoxTopLeft.clientX}
        height={selectionBoxBottomRight.clientY - selectionBoxTopLeft.clientY}
      />}
    </svg>
    {plot.trees.map(tree =>
      <SentenceView
        key={`sentence-${tree.id}`}
        tree={tree}
        treeId={tree.id}
        acceptMouseEvents={htmlOverlaysAcceptMouseEvents}
        className={selectionBoxTopLeft && selectionBoxBottomRight ? 'box-selecting' : undefined}
      />)}
    {editedNodeIndicator && <LabelNodeEditor
      key={`editable-nodes-${editedNodeIndicator.nodeId}`}
      tree={plot.tree(editedNodeIndicator.treeId)}
      nodeId={editedNodeIndicator.nodeId}
    />}
    <ZoomControl acceptMouseEvents={isMouseIdle} />
    {guidedTourActive ? <GuidedTour
      onComplete={handleGuidedTourComplete}
    /> : activePlot.isEmpty && <PlotPlaceholder
      showWelcome={!state.contentState.canUndo && !state.contentState.canRedo}
      acceptMouseEvents={htmlOverlaysAcceptMouseEvents}
      onTourRequest={() => setGuidedTourActive(true)}
    />}
  </>;
};

export default PlotView;
