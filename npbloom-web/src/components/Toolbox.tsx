import {
  AddNodeBySelection, DeleteSelectedEntities, EntitySelectionAction, generateNodeId, NodeSelectionInPlot,
  Redo, ResetSelectedNodePositions, SetSelectionAction, SetShapeTool, ShapeSelectionInPlot, ShapeTool,
  SliceSelectionInPlot, StartEditing, ToggleSliceStrikethrough, ToggleTriangle, TreeSelectionInPlot, Undo,
  UnpositionedTerminalNode,
} from 'npbloom-core';
import { ActionIcon, Paper, Navbar, SimpleGrid, useMantineTheme } from '@mantine/core';
import {
  IconArrowBackUp, IconArrowForwardUp, IconArrowUpRight, IconBracketsContain, IconCircle, IconCopy, IconLine,
  IconPencil, IconPhotoShare, IconPlus, IconRectangle, IconStrikethrough, IconTrash, IconTriangle, TablerIconsProps,
} from '@tabler/icons-react';
import { useRef, useState } from 'react';
import './Toolbox.scss';
import substituteOsAwareHotkey from './substituteOsAwareHotkey';
import { useOs } from '@mantine/hooks';
import { IconAdoptNode, IconDisownNode, IconResetNodePosition } from './icons';
import useUiState from '../useUiState';
import useTextOutputModal from '../io/useTextOutputModal';
import useHotkeys from '@reecelucas/react-use-hotkeys';
import { copyTreeToClipboard } from '../io/clipboardIo';
import { TOOLBOX_WIDTH } from '../uiDimensions';
import useTreeExport from '../useTreeExport';

type ToolboxItem = {
  title: string;
  icon?: (props: TablerIconsProps) => JSX.Element;
  action: (event: React.UIEvent, focusEvent?: React.FocusEvent) => void;
  disabled?: boolean;
  toggleState?: 'on' | 'off' | 'indeterminate';
  hotkey?: string;
  hotkeyHold?: boolean;
  description: string;
};

type NamedToolboxSection = [string, ToolboxItem[]];

const Toolbox: React.FC = () => {
  const { state, dispatch } = useUiState();

  const { textOutputModalComponent, openTextOutputModal } = useTextOutputModal();

  const noNodesOrSliceSelected = !(state.selection instanceof NodeSelectionInPlot ||
    state.selection instanceof SliceSelectionInPlot);
  const sentenceIsEmpty = state.selection instanceof SliceSelectionInPlot &&
    state.contentState.current.plots[state.activePlotIndex]
      .tree((state.selection as SliceSelectionInPlot).treeId).sentence === '';
  const noNodesSelected = !(state.selection instanceof NodeSelectionInPlot);
  const noTreesSelected = !(state.selection instanceof TreeSelectionInPlot);
  const noSliceSelected = !(state.selection instanceof SliceSelectionInPlot);
  const noShapesSelected = !(state.selection instanceof ShapeSelectionInPlot);
  const oneTreeSelected = state.selection instanceof TreeSelectionInPlot &&
    state.selection.treeIdsAsArray.length === 1;
  const selectedNodeIndicators = state.selection instanceof NodeSelectionInPlot
    ? state.selection.nodeIndicatorsAsArray : [];
  const selectedNodeObjects = selectedNodeIndicators.map(({ treeId, nodeId }) =>
    state.contentState.current.plots[state.activePlotIndex].tree(treeId).node(nodeId));

  const startEditing = () => dispatch(new StartEditing());
  const addNode = () => dispatch(new AddNodeBySelection(generateNodeId()));
  const deleteEntities = () => dispatch(new DeleteSelectedEntities());
  const resetNodePositions = () => dispatch(new ResetSelectedNodePositions());
  const toggleTriangle = (wasEditing: boolean) => {
    dispatch(new ToggleTriangle());
    wasEditing && setTimeout(startEditing, 50);  // Hack to restore focus to edited node when clicking the triangle button.
  };
  const toggleAdoptMode = () => dispatch(new SetSelectionAction(
    state.selectionAction === EntitySelectionAction.Adopt ? EntitySelectionAction.SelectNode : EntitySelectionAction.Adopt));
  const toggleDisownMode = () => dispatch(new SetSelectionAction(
    state.selectionAction === EntitySelectionAction.Disown ? EntitySelectionAction.SelectNode : EntitySelectionAction.Disown));
  const toggleSliceStrikethrough = (wasEditing: boolean) => {
    dispatch(new ToggleSliceStrikethrough());
    wasEditing && setTimeout(startEditing, 50);
  }
  const exportToText = () => {
    const trees = state.selection instanceof TreeSelectionInPlot
      ? state.selection.treeIdsAsArray.map(treeId => state.contentState.current.plots[state.activePlotIndex].tree(treeId))
      : [state.contentState.current.plots[state.activePlotIndex].tree((state.selection as NodeSelectionInPlot).nodeIndicators[0].treeId)];
    openTextOutputModal(trees);
  };
  const copySelectedTree = () => {
    const selectedTreeId = (state.selection as TreeSelectionInPlot).treeIdsAsArray[0];
    const selectedTree = state.contentState.current.plots[state.activePlotIndex].tree(selectedTreeId);
    copyTreeToClipboard(selectedTree).then(() => console.log('Tree copied to clipboard.'));
  }
  const undo = () => dispatch(new Undo());
  const redo = () => dispatch(new Redo());
  const setShapeTool = (tool: ShapeTool) => dispatch(new SetShapeTool(
    state.activeShapeTool === tool ? ShapeTool.None : tool));

  const { exportSelectedTree } = useTreeExport();

  useHotkeys(['Control+C', 'Meta+C'], event => {
    if (oneTreeSelected) {
      event.preventDefault();
      copySelectedTree();
    }
  });

  const os = useOs();

  const [hoveredItem, setHoveredItem] = useState<ToolboxItem>();

  const lastFocusEvent = useRef<React.FocusEvent>();

  const theme = useMantineTheme();

  const getTriangleButtonState = (): { toggleState: 'on' | 'off' | 'indeterminate'; disabled?: boolean } => {
    // No nodes selected, or some non-terminal nodes selected:
    if (selectedNodeIndicators.length === 0 ||
      !(selectedNodeObjects.every(node => node instanceof UnpositionedTerminalNode)))
      return { disabled: true, toggleState: 'off' };

    // At this point we know that there are selected nodes and that they are all terminal
    const selectedTerminalNodes = selectedNodeObjects as UnpositionedTerminalNode[];
    // Only triangle nodes selected:
    if (selectedTerminalNodes.every(node => node.triangle)) return { toggleState: 'on' };
    // Some triangle nodes and some non-triangle nodes selected:
    if (selectedTerminalNodes.some(node => node.triangle)) return { toggleState: 'indeterminate' };
    // Only non-triangle nodes selected:
    return { toggleState: 'off' };
  };

  const getSliceStrikethroughToggleState = (): { toggleState: 'on' | 'off'; disabled?: boolean } => {
    // No slice selected
    if (noSliceSelected) return { toggleState: 'off', disabled: true };

    // If there is any overlap between the selected slice and the strikethroughs of the selected nodes, the button is on
    const selectedSlice = (state.selection as SliceSelectionInPlot).slice;
    const selectedTreeStrikethroughs =
      state.contentState.current.plots[state.activePlotIndex].tree(state.selection.treeId).strikethroughsAsArray;
    return {
      disabled: false,
      toggleState: selectedTreeStrikethroughs.some(strikethrough =>
        selectedSlice.overlapsWith(strikethrough)
      ) ? 'on' : 'off',
    };
  };

  const sections: NamedToolboxSection[] = [
    ['Edit', [
      { title: 'Undo', icon: IconArrowBackUp, action: undo, disabled: !state.contentState.canUndo, hotkey: 'Control+Z',
        description: 'Undo the last action.' },
      { title: 'Redo', icon: IconArrowForwardUp, action: redo, disabled: !state.contentState.canRedo, hotkey: 'Control+Y',
        description: 'Redo the last undone action.' },
      { title: 'Add', icon: IconPlus, action: addNode, disabled: noNodesOrSliceSelected || sentenceIsEmpty,
        hotkey: 'Up', description: 'Add a new parent node for the selected text or nodes.' },
      { title: 'Delete', icon: IconTrash, action: deleteEntities, disabled: noNodesSelected && noTreesSelected && noShapesSelected,
        hotkey: 'Backspace', description: 'Delete the selected ' +
          (state.selection instanceof TreeSelectionInPlot ? 'trees'
            : state.selection instanceof ShapeSelectionInPlot ? 'shapes' : 'nodes') + '.' },
      { title: 'Edit', icon: IconPencil, action: startEditing, disabled: noNodesSelected, hotkey: 'Enter',
        toggleState: state.editedNodeIndicator ? 'on' : 'off', description: 'Edit the selected node.' },
      { title: 'Triangle', icon: IconTriangle, ...getTriangleButtonState(),
        action: (_, focusEvent) =>
          // Terrible hack to figure out if the user was in the middle of editing a node when they clicked the button
          toggleTriangle(focusEvent?.relatedTarget?.className === 'LabelNodeEditorInput'),
        description: 'Toggle triangle connectors for the selected terminal nodes.'
      },
      { title: 'Adopt', icon: IconAdoptNode, action: toggleAdoptMode, disabled: noNodesSelected,
        toggleState: state.selectionAction === EntitySelectionAction.Adopt ? 'on' : 'off',
        description: 'Adopt one or more nodes as children of the selected node.' },
      { title: 'Disown', icon: IconDisownNode, action: toggleDisownMode, disabled: noNodesSelected,
        toggleState: state.selectionAction === EntitySelectionAction.Disown ? 'on' : 'off',
        description: 'Disown one or more children of the selected node.' },
      { title: 'Reset position', icon: IconResetNodePosition, action: resetNodePositions, disabled: noNodesSelected,
        description: 'Relocate the selected nodes to their original positions.' },
      { title: 'Strikethrough', icon: IconStrikethrough, ...getSliceStrikethroughToggleState(),
        action: (_, focusEvent) =>
          toggleSliceStrikethrough(focusEvent?.relatedTarget?.className === 'LabelNodeEditorInput'),
        disabled: noSliceSelected, description: 'Toggle strikethrough for the selected part of the sentence.' },
    ]],
    ['Export', [
      { title: 'Export to labelled bracket notation', icon: IconBracketsContain, action: exportToText,
        disabled: noTreesSelected, description: 'Export the selected trees to labelled bracket notation.' },
      { title: 'Export to image', icon: IconPhotoShare, action: exportSelectedTree, disabled: !oneTreeSelected,
        description: 'Export the selected tree as a PNG image.' },
      { title: 'Copy tree', icon: IconCopy, action: copySelectedTree, hotkey: 'Control+C', disabled: !oneTreeSelected,
        description: 'Copy the selected tree to the clipboard.\nTo paste, click anywhere and then press ' +
          substituteOsAwareHotkey('Control+V', os) + '.' },
    ]],
    ['Draw', [
      { title: 'Draw line', icon: IconLine, action: () => setShapeTool(ShapeTool.Line),
        toggleState: state.activeShapeTool === ShapeTool.Line ? 'on' : 'off',
        description: 'Draw a line on the canvas.' },
      { title: 'Draw arrow', icon: IconArrowUpRight, action: () => setShapeTool(ShapeTool.Arrow),
        toggleState: state.activeShapeTool === ShapeTool.Arrow ? 'on' : 'off',
        description: 'Draw an arrow on the canvas.' },
      { title: 'Draw rectangle', icon: IconRectangle, action: () => setShapeTool(ShapeTool.Rectangle),
        toggleState: state.activeShapeTool === ShapeTool.Rectangle ? 'on' : 'off',
        description: 'Draw a rectangle on the canvas.' },
      { title: 'Draw ellipse', icon: IconCircle, action: () => setShapeTool(ShapeTool.Ellipse),
        toggleState: state.activeShapeTool === ShapeTool.Ellipse ? 'on' : 'off',
        description: 'Draw an ellipse on the canvas.' },
    ]],
  ];

  return <><Navbar width={{ base: TOOLBOX_WIDTH }} p={4} sx={{ zIndex: 90 }}>
    {sections.map(([sectionName, items], sectionIndex) => (
      <Navbar.Section key={sectionName} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start' }}>
        {sectionIndex > 0 && <div className="Toolbox--section-divider" />}
        <SimpleGrid cols={2} spacing={0} verticalSpacing={0}>
          {items.map(item =>
            <div
              key={item.title}
              onMouseEnter={() => setHoveredItem(item)}
              onMouseLeave={() => setHoveredItem(undefined)}
            >
              <ActionIcon
                size="lg"
                variant={item.toggleState === 'on' ? 'gradient' : item.toggleState === 'indeterminate' ? 'light' : 'subtle'}
                disabled={item.disabled}
                color={theme.primaryColor}
                sx={{ ':disabled': { backgroundColor: theme.white, borderColor: theme.white } }}
                onFocus={e => { lastFocusEvent.current = e; }}
                onClick={clickEvent => item.action(clickEvent, lastFocusEvent.current)}
              >
                {item.icon
                  ? <item.icon stroke={1} style={{ transform: 'translate(0.5px, 0.5px)' }}/>
                  : item.title.slice(0, 2)}
              </ActionIcon>
            </div>
          )}
        </SimpleGrid>
      </Navbar.Section>
    ))}
    {textOutputModalComponent}
  </Navbar>
  {hoveredItem && <Paper
    shadow="sm"
    p="sm"
    className="Toolbox--tool-info"
  >
    <div className="Toolbox--tool-title">
      {hoveredItem.title}
      {hoveredItem.hotkey &&
        ` (${hoveredItem.hotkeyHold ? 'hold ' : ''}${substituteOsAwareHotkey(hoveredItem.hotkey, os)})`}
    </div>
    <div style={{ whiteSpace: 'pre-wrap' }}>{hoveredItem.description}</div>
  </Paper>}
  </>;
};

export default Toolbox;
