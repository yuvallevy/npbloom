import { Fragment } from 'react';
import { Button, Flex, Header, Menu, Space, Text } from '@mantine/core';
import { useOs } from '@mantine/hooks';
import {
  IconDeviceFloppy,
  IconFileExport,
  IconFileImport,
  IconFolder,
  IconPhotoShare,
  TablerIconsProps,
} from '@tabler/icons-react';
import { MAIN_MENU_HEIGHT } from '../uiDimensions.ts';
import useHotkeys from '@reecelucas/react-use-hotkeys';
import { FoldSelectedNodes, MarkCCommandedNodes, MarkCCommandingNodes, NodeSelectionInPlot,
  RemoveRelationMarkingsInSelectedTree, RemoveAllRelationMarkings, TreeSelectionInPlot, UnfoldSelectedNodes,
  UnfoldSelectedNodesOneLevel,
} from 'npbloom-core';
import useUiState from '../useUiState.ts';
import substituteOsAwareHotkey from './substituteOsAwareHotkey.ts';
import Settings from './meta/Settings';
import AboutButton from './meta/AboutButton';
import useFileIo from '../io/useFileIo.ts';
import useTreeExport from '../useTreeExport.ts';

type MenuItem = {
  label: string;
  action?: (() => void) | (() => Promise<void>);
  icon?: (props: TablerIconsProps) => JSX.Element;
  hotkey?: string;
  disabled?: boolean;
  hidden?: boolean;
};

type MenuItemGroup = MenuItem[];

type MenuSection = MenuItemGroup[];

type NamedMenuSection = [string, MenuSection];

const MainMenu: React.FC = () => {
  const { state, dispatch } = useUiState();

  const {
    browserFileIoModalComponent,
    activeFileName,
    openFileSaveModal,
    openFileLoadModal,
    saveOrSaveAs,
    openSystemFileLoadModal,
    openSystemFileSaveModal,
  } = useFileIo();

  const os = useOs();

  const { exportSelectedTree } = useTreeExport();

  const noNodesSelected = !(state.selection instanceof NodeSelectionInPlot);

  const oneNodeSelected = state.selection instanceof NodeSelectionInPlot &&
    state.selection.nodeIndicatorsAsArray.length === 1;

  const oneTreeSelected = state.selection instanceof TreeSelectionInPlot &&
    state.selection.treeIdsAsArray.length === 1;

  const markCCommandingNodes = () => {
    if (oneNodeSelected) dispatch(new MarkCCommandingNodes());
  }

  const markCCommandedNodes = () => {
    if (oneNodeSelected) dispatch(new MarkCCommandedNodes());
  }

  const foldSelectedNodes = () => dispatch(new FoldSelectedNodes());

  const unfoldSelectedNodes = () => dispatch(new UnfoldSelectedNodes());

  const unfoldSelectedNodesOneLevel = () => dispatch(new UnfoldSelectedNodesOneLevel());

  useHotkeys(['Control+O', 'Meta+O'], event => { event.preventDefault(); openFileLoadModal(); },
    { ignoredElementWhitelist: ['INPUT'] });

  useHotkeys(['Control+S', 'Meta+S'], event => { event.preventDefault(); saveOrSaveAs(); },
    { ignoredElementWhitelist: ['INPUT'] });

  useHotkeys(['Control+-', 'Meta+-'], event => { event.preventDefault(); foldSelectedNodes(); },
    { ignoredElementWhitelist: ['INPUT'] });

  useHotkeys(['Control+=', 'Meta+=', 'Control++', 'Meta++'], event => { event.preventDefault(); unfoldSelectedNodes(); },
    { ignoredElementWhitelist: ['INPUT'] });

  const mainMenuElements: NamedMenuSection[] = [
    ['File', [
      [
        { label: 'Open...', icon: IconFolder, hotkey: 'Control+O', action: openFileLoadModal },
        { label: activeFileName ? 'Save' : 'Save...', icon: IconDeviceFloppy, hotkey: 'Control+S', action: saveOrSaveAs },
        { label: 'Save as...', disabled: !activeFileName, action: openFileSaveModal },
      ],
      [
        { label: activeFileName ? `Currently open file:\n${activeFileName}` : '', disabled: true, hidden: !activeFileName },
      ],
      [
        { label: 'Import forest...', icon: IconFileImport, action: openSystemFileLoadModal },
        { label: 'Export forest...', icon: IconFileExport, action: openSystemFileSaveModal },
      ],
      [
        { label: 'Export tree as image...', icon: IconPhotoShare, disabled: !oneTreeSelected, action: exportSelectedTree },
      ],
    ]],
    ['View', [
      [
        { label: 'Mark C-commanding nodes', disabled: !oneNodeSelected, action: markCCommandingNodes },
        { label: 'Mark C-commanded nodes', disabled: !oneNodeSelected, action: markCCommandedNodes },
        { label: 'Clear relation markings in selected tree',
          action: () => dispatch(new RemoveRelationMarkingsInSelectedTree()) },
        { label: 'Clear all relation markings',
          action: () => dispatch(new RemoveAllRelationMarkings()) },
      ],
      [
        { label: 'Fold selected nodes', disabled: noNodesSelected, action: foldSelectedNodes, hotkey: 'Control+-' },
        { label: 'Unfold selected nodes', disabled: noNodesSelected, action: unfoldSelectedNodes, hotkey: 'Control+=' },
        { label: 'Unfold selected nodes by one level', disabled: noNodesSelected, action: unfoldSelectedNodesOneLevel },
      ]
    ]],
  ]

  return <>
    <Header height={MAIN_MENU_HEIGHT}>
      <Flex align="stretch" className="MainMenu">
        {mainMenuElements.map(([sectionName, sectionGroups]) => (
          <Menu
            key={sectionName}
            shadow="md"
            offset={0}
            position="top-start"
            transitionProps={{ transition: 'scale-y' }}
          >
            <Menu.Target>
              <Button variant="subtle" size="sm">
                {sectionName}
              </Button>
            </Menu.Target>
            <Menu.Dropdown sx={{ minWidth: '18ch' }}>
              {sectionGroups.map((groupItems, groupIndex) => <Fragment key={groupIndex}>
                {groupItems.map((item, itemIndex) =>
                  item.hidden ? null : <Menu.Item
                    key={itemIndex}
                    icon={item.icon ? <item.icon size={14} /> : null}
                    rightSection={item.hotkey && <Text color="dimmed">{substituteOsAwareHotkey(item.hotkey, os)}</Text>}
                    style={{ whiteSpace: 'pre-line' }}
                    disabled={item.disabled}
                    onClick={item.action}
                  >
                    {item.label}
                  </Menu.Item>)}
                {groupIndex < sectionGroups.length - 1
                  && sectionGroups[groupIndex + 1].some(({ hidden }) => !hidden)
                  && <Menu.Divider />}
              </Fragment>)}
            </Menu.Dropdown>
          </Menu>
        ))}
        <Space style={{ flexGrow: 1 }} />
        <Settings />
        <AboutButton />
      </Flex>
    </Header>
    {browserFileIoModalComponent}
  </>;
};

export default MainMenu;
