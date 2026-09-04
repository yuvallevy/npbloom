import React, { useContext } from 'react';
import {
  AddBranchingNodeByTarget,
  AddTerminalNodeByTarget,
  AdoptNodesBySelection,
  applyNodeSelection,
  applyTreeSelection,
  BranchingNodeCreationTrigger,
  ClientCoordsOffset,
  coordsInPlotToCoordsInClient,
  DisownNodesBySelection,
  EntitySelectionAction,
  EntitySelectionMode,
  EntitySet,
  formatSubscriptInString,
  generateNodeId,
  getNodeCreationTriggers,
  isPositionedNodeTopLevel,
  NodeCreationTrigger,
  NodeIndicatorInPlot,
  NodeSelectionInPlot,
  PositionedBranchingNode,
  PositionedNode,
  PositionedTerminalNode,
  PositionedTree,
  SelectionInPlot,
  SetSelection,
  StartEditing,
  TerminalNodeCreationTrigger,
  TreeSelectionInPlot,
} from 'npbloom-core';
import { Id } from '../types';
import './TreeView.scss';
import useUiState from '../useUiState';
import SettingsStateContext from '../SettingsStateContext';
import { NODE_AREA_HEIGHT, SENTENCE_FONT_SIZE_PX } from '../uiDimensions.ts';

const NODE_LEVEL_SPACING = 20;
const TRIANGLE_BASE_Y = -2;

const NODE_AREA_WIDTH = 35;
const NODE_AREA_RELATIVE_X = -(NODE_AREA_WIDTH / 2);
const NODE_AREA_RELATIVE_Y = -18.5;

const TREE_AREA_PADDING = 12;

interface NodeCreationTriggerClickZoneProps {
  trigger: NodeCreationTrigger;
  targetChildren?: Id[]; // For branching node creation triggers, the IDs of the children that would be adopted
  targetSlice?: string; // For terminal node creation triggers, the slice of the sentence that would be covered
  onClick?: () => void;
}

interface TreeViewProps {
  treeId: Id;
  tree: PositionedTree;
  isAltHeld?: boolean;
  nodeDragOffset?: ClientCoordsOffset;
  treeDragOffset?: ClientCoordsOffset;
  onNodeMouseDown?: (event: React.MouseEvent<SVGElement>) => void;
  onTreeMouseDown?: (event: React.MouseEvent<SVGElement>) => void;
}

const prettyNodeLabel = (rawNodeLabel: string): string => {
  // Replace apostrophes with combining macrons after single letters
  return (formatSubscriptInString(rawNodeLabel) || rawNodeLabel).replace(/^([a-zA-Z])'/g, `$1\u0304`);
}

const renderChildNodeConnections = (node: PositionedBranchingNode, allNodes: EntitySet<PositionedNode>): React.ReactNode[] => {
  // If there is only one child, we simply render one line
  if (node.childrenAsArray.length === 1) {
    const childNode = allNodes.get(node.childrenAsArray[0]);
    if (!childNode) return [];
    return [
      <line
        key={`to-${childNode.id}`}
        data-npb-export={true}
        stroke="#000"
        x1={node.position.treeX}
        y1={node.position.treeY}
        x2={childNode.position.treeX}
        y2={childNode.position.treeY - (childNode.label ? NODE_LEVEL_SPACING : 0)}
      />
    ];
  }

  // If there are multiple children, we first take the first and last one and render a path from
  // 1. the leftmost child
  // 2. to the parent
  // 3. to the rightmost child
  // This way we don't get the lines looking weird where they meet because their strokes don't connect.
  // Instead, the connections to the leftmost and rightmost child will intersect with a nice miter/bevel joint
  // (depending on the angle) at the parent node.
  const allChildNodes = allNodes.filter(otherNode => node.childrenAsArray.includes(otherNode.id))
    .toSortedArrayBy(otherNode => otherNode.position.treeX);
  const leftmostChild = allChildNodes[0];
  const rightmostChild = allChildNodes[allChildNodes.length - 1];
  if (!leftmostChild || !rightmostChild) return [];
  const leftmostChildX = leftmostChild.position.treeX;
  const leftmostChildY = leftmostChild.position.treeY - (leftmostChild.label ? NODE_LEVEL_SPACING : 0);
  const rightmostChildX = rightmostChild.position.treeX;
  const rightmostChildY = rightmostChild.position.treeY - (rightmostChild.label ? NODE_LEVEL_SPACING : 0);
  const pathData = `M${leftmostChildX} ${leftmostChildY} ` +
    `L${node.position.treeX} ${node.position.treeY} ` +
    `L${rightmostChildX} ${rightmostChildY}`;
  return [
    <path
      key={`to-${node.childrenAsArray.join(',')}`}
      data-npb-export={true}
      stroke="#000"
      fill="none"
      d={pathData}
    />,
    // Then we render the rest of the connections -
    // these will be perfectly covered by the path's stroke at the intersection point
    allChildNodes.slice(1, -1).map(childNode => {
      if (!childNode) return false;
      return <line
        key={`to-${childNode.id}`}
        data-npb-export={true}
        stroke="#000"
        x1={node.position.treeX}
        y1={node.position.treeY}
        x2={childNode.position.treeX}
        y2={childNode.position.treeY - (childNode.label ? NODE_LEVEL_SPACING : 0)}
      />;
    })
  ]
};

const renderTriangleConnection = (nodeId: Id, node: PositionedTerminalNode): React.ReactNode =>
  node.triangle && <path
    key={`triangle-${nodeId}`}
    data-npb-export={true}
    stroke="#000"
    fill={node.folded
      ? 'url(#folded-pattern)' // Folded branching node
      : 'none'} // Natural triangle terminal node
    d={`M${node.position.treeX} ${node.position.treeY} L${node.triangle.treeX1} ${TRIANGLE_BASE_Y}  L${node.triangle.treeX2} ${TRIANGLE_BASE_Y} Z`}
  />;

const renderNode = (
  nodeId: Id,
  node: PositionedNode,
  allNodes: EntitySet<PositionedNode>,
  selectedNodeIds: Id[],
  markedNodeIds: Id[],
  prettyNodeLabels: boolean,
  zoomLevel: number,
  nodeDragOffset?: ClientCoordsOffset,
  onMouseDown?: (event: React.MouseEvent<SVGElement>) => void,
  onSelect?: (id: Id, mode: EntitySelectionMode) => void,
  onEditStart?: () => void,
): React.ReactNode[] => [
  <g
    key={nodeId}
    data-node-id={nodeId}
    data-npb-export={true}
    data-raw-label={node.label}
    className={'TreeView--node' + (node.label ? '' : ' TreeView--node--empty-label')
      + (selectedNodeIds.includes(nodeId) ? ' TreeView--node--selected' : '')
      + (markedNodeIds.includes(nodeId) ? ' TreeView--node--marked' : '')}
    onMouseDown={event => {
      onSelect && onSelect(nodeId, event.ctrlKey || event.metaKey ? EntitySelectionMode.AddToSelection : EntitySelectionMode.SetSelection);
      onMouseDown && onMouseDown(event);
    }}
    onDoubleClick={onEditStart}
  >
    <rect
      x={node.position.treeX + NODE_AREA_RELATIVE_X}
      y={node.position.treeY + NODE_AREA_RELATIVE_Y}
      width={NODE_AREA_WIDTH}
      height={NODE_AREA_HEIGHT}
      rx={3}
      ry={3}
      className="TreeView--node-hitbox"
      fill="transparent"
      stroke="none"
    />
    {(isPositionedNodeTopLevel(allNodes, nodeId) || node.label) && <text
      x={node.position.treeX}
      y={node.position.treeY}
      fill="#000"
      textAnchor="middle"
      dominantBaseline="text-after-edge"
    >
      {(prettyNodeLabels ? prettyNodeLabel(node.label) : node.label) || '?'}
    </text>}
  </g>,
  nodeDragOffset && selectedNodeIds.includes(nodeId) && <rect
    key={`${nodeId}-ghost`}
    className="TreeView--ghost"
    x={node.position.treeX + NODE_AREA_RELATIVE_X + nodeDragOffset.dClientX / zoomLevel}
    y={node.position.treeY + NODE_AREA_RELATIVE_Y + nodeDragOffset.dClientY / zoomLevel}
    width={NODE_AREA_WIDTH}
    height={NODE_AREA_HEIGHT}
    rx={3}
    ry={3}
  />,
  node instanceof PositionedTerminalNode && renderTriangleConnection(nodeId, node),
  node instanceof PositionedBranchingNode && renderChildNodeConnections(node, allNodes),
];

const NodeCreationTriggerClickZone: React.FC<NodeCreationTriggerClickZoneProps> = ({
  trigger,
  targetChildren,
  targetSlice,
  onClick,
}) =>
  <g
    className="NodeCreationTriggerClickZone"
    data-target-children={targetChildren ? targetChildren.join(',') : undefined}
    data-target-slice={targetSlice}
    onClick={onClick}
  >
    <rect
      className="NodeCreationTriggerClickZone--area"
      x={trigger.topLeft.treeX}
      y={trigger.topLeft.treeY}
      width={trigger.bottomRight.treeX - trigger.topLeft.treeX}
      height={trigger.bottomRight.treeY - trigger.topLeft.treeY}
    />
    <circle
      className="NodeCreationTriggerClickZone--indicator"
      cx={trigger.origin.treeX}
      cy={trigger.origin.treeY}
      r={8}
    />
    {trigger instanceof BranchingNodeCreationTrigger
      ? trigger.childPositions.map(childPosition =>
        childPosition ? <line
          key={`${childPosition.treeX},${childPosition.treeY}`}
          className="NodeCreationTriggerClickZone--indicator"
          x1={trigger.origin.treeX}
          y1={trigger.origin.treeY}
          x2={childPosition.treeX}
          y2={childPosition.treeY - NODE_LEVEL_SPACING}
        /> : null)
      : trigger instanceof TerminalNodeCreationTrigger && trigger.triangle ?
        <path
          className="NodeCreationTriggerClickZone--indicator"
          d={`M${trigger.origin.treeX} ${trigger.origin.treeY} L${trigger.triangle.treeX1} ${TRIANGLE_BASE_Y}  L${trigger.triangle.treeX2} ${TRIANGLE_BASE_Y} Z`}
        />
      : <line
        className="NodeCreationTriggerClickZone--indicator"
        x1={trigger.origin.treeX}
        y1={trigger.origin.treeY}
        x2={trigger.origin.treeX}
        y2={0}
      />}
  </g>;

const TreeView: React.FC<TreeViewProps> = ({
  treeId,
  tree,
  isAltHeld,
  nodeDragOffset,
  treeDragOffset,
  onNodeMouseDown,
  onTreeMouseDown,
}) => {
  const { state, dispatch } = useUiState();
  const { settingsState, strWidth } = useContext(SettingsStateContext);

  const selectedTreeIds = state.selection instanceof TreeSelectionInPlot ? state.selection.treeIdsAsArray : [];
  const selectedNodeIndicators = state.selection instanceof NodeSelectionInPlot
    ? state.selection.nodeIndicatorsAsArray : [];
  const selectedNodeIds = selectedNodeIndicators.map(({ nodeId }) => nodeId);
  const markedNodeIndicators = state.objectMarkings instanceof NodeSelectionInPlot
    ? state.objectMarkings.nodeIndicatorsAsArray : [];
  const markedNodeIds = markedNodeIndicators.map(({ nodeId }) => nodeId);

  const setSelection = (newSelection: SelectionInPlot) => dispatch(new SetSelection(newSelection));
  const startEditing = () => dispatch(new StartEditing());
  const adoptNodes = (adoptedNodeIndicators: NodeIndicatorInPlot[]) =>
    dispatch(new AdoptNodesBySelection(adoptedNodeIndicators));
  const disownNodes = (disownedNodeIndicators: NodeIndicatorInPlot[]) =>
    dispatch(new DisownNodesBySelection(disownedNodeIndicators));

  const handleSingleNodeSelect = (nodeId: Id, mode: EntitySelectionMode = EntitySelectionMode.SetSelection) =>
    state.selectionAction === EntitySelectionAction.Adopt ? adoptNodes([new NodeIndicatorInPlot(treeId, nodeId)])
      : state.selectionAction === EntitySelectionAction.Disown ? disownNodes([new NodeIndicatorInPlot(treeId, nodeId)])
      : setSelection(applyNodeSelection(mode, [new NodeIndicatorInPlot(treeId, nodeId)], selectedNodeIndicators));

  const handleSingleTreeSelect = (treeId: Id, mode: EntitySelectionMode = EntitySelectionMode.SetSelection) =>
    setSelection(applyTreeSelection(mode, [treeId], selectedTreeIds));

  const handleNodeCreationTriggerClick = (trigger: NodeCreationTrigger) => {
    if (trigger instanceof BranchingNodeCreationTrigger) {
      dispatch(new AddBranchingNodeByTarget(treeId, generateNodeId(), trigger.childIds));
    } else if (trigger instanceof TerminalNodeCreationTrigger) {
      dispatch(new AddTerminalNodeByTarget(treeId, generateNodeId(), trigger.slice, !!trigger.triangle));
    }
  };

  const treePositionInClient = coordsInPlotToCoordsInClient(tree.position, state.panZoomState);

  // Strikethrough rendering
  const strikethroughYPosition = 0.75 * SENTENCE_FONT_SIZE_PX;
  const strikethroughLines = tree.strikethroughXRangesAsArray.map(({ treeX1, treeX2 }) =>
    <line
      key={`${treeX1}-${treeX2}`}
      data-npb-export={true}
      x1={treeX1}
      y1={strikethroughYPosition}
      x2={treeX2}
      y2={strikethroughYPosition}
      className="TreeView--strikethrough"
    />);

  return <g id={`tree-${treeId}`}
            style={{ transform: `translate(${treePositionInClient.clientX}px, ${treePositionInClient.clientY}px) scale(${state.panZoomState.zoomLevel})` }}>
    <g className={'TreeView--tree-handle' + (selectedTreeIds.includes(treeId) ? ' TreeView--tree-handle--selected' : '')}>
      <rect
        x={-TREE_AREA_PADDING}
        y={tree.visualTopBound - TREE_AREA_PADDING}
        width={tree.width + TREE_AREA_PADDING * 2}
        height={tree.visualHeight + TREE_AREA_PADDING * 2}
        rx={3}
        ry={3}
        onMouseDown={event => {
          handleSingleTreeSelect(treeId, event.ctrlKey || event.metaKey ? EntitySelectionMode.AddToSelection : EntitySelectionMode.SetSelection);
          onTreeMouseDown && onTreeMouseDown(event);
        }}
        className="TreeView--tree-area"
      />
      <rect
        x={-TREE_AREA_PADDING}
        y={tree.visualTopBound - TREE_AREA_PADDING}
        width={tree.width + TREE_AREA_PADDING * 2}
        height={tree.visualHeight + TREE_AREA_PADDING * 2}
        rx={3}
        ry={3}
        className="TreeView--tree-outline"
      />
    </g>
    {getNodeCreationTriggers(
      tree,
      strWidth,
      state.selection,
    ).map(trigger =>
      <NodeCreationTriggerClickZone
        key={trigger instanceof BranchingNodeCreationTrigger
          ? `branching-${trigger.childIds.join('-')}`
          : trigger instanceof TerminalNodeCreationTrigger
            ? `terminal-${trigger.slice.start}-${trigger.slice.endExclusive}`
            : `stranded-${trigger.origin.treeX}-${trigger.origin.treeY}`}
        trigger={trigger}
        targetChildren={trigger instanceof BranchingNodeCreationTrigger ? trigger.childIds : undefined}
        targetSlice={trigger instanceof TerminalNodeCreationTrigger ? `${trigger.slice.start},${trigger.slice.endExclusive}` : undefined}
        onClick={() => handleNodeCreationTriggerClick(trigger)}
      />)}
    {tree.nodes.map(node =>
      renderNode(node.id, node, tree.nodes, selectedNodeIds, markedNodeIds, settingsState.prettyNodeLabels,
        state.panZoomState.zoomLevel, nodeDragOffset, onNodeMouseDown, handleSingleNodeSelect, startEditing))}
    {treeDragOffset && selectedTreeIds.includes(treeId) && <rect
      className="TreeView--ghost"
      x={-TREE_AREA_PADDING + treeDragOffset.dClientX / state.panZoomState.zoomLevel}
      y={tree.visualTopBound - TREE_AREA_PADDING + treeDragOffset.dClientY / state.panZoomState.zoomLevel}
      width={tree.width + TREE_AREA_PADDING * 2}
      height={tree.visualHeight + TREE_AREA_PADDING * 2}
      rx={3}
      ry={3}
    />}
    {strikethroughLines}

    {/* Render an additional selection handle covering the entire tree when Alt is held,
        to make it easier to select the tree without having to aim for the comparatively small outline handle. */}
    {isAltHeld && <rect
      className="TreeView--alt-selection-area"
      x={-TREE_AREA_PADDING}
      y={tree.visualTopBound - TREE_AREA_PADDING}
      width={tree.width + TREE_AREA_PADDING * 2}
      height={tree.visualHeight + TREE_AREA_PADDING * 2}
      rx={3}
      ry={3}
      onMouseDown={event => {
        handleSingleTreeSelect(treeId, event.ctrlKey || event.metaKey
          ? EntitySelectionMode.AddToSelection : EntitySelectionMode.SetSelection);
        onTreeMouseDown && onTreeMouseDown(event);
      }}
    />}
  </g>;
};

export default TreeView;
