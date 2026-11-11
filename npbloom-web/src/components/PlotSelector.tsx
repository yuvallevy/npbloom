import { PlotIndex } from '../types';
import { AddPlot, DeletePlot, SetActivePlotIndex } from 'npbloom-core';
import { ActionIcon, Menu, Tabs, Tooltip } from '@mantine/core';
import { IconDotsVertical, IconFile, IconFilePlus, IconTrash, IconTree, IconTrees } from '@tabler/icons-react';
import './PlotSelector.scss';
import useUiState from '../useUiState';

const PlotSelector: React.FC = () => {
  const { state, dispatch } = useUiState();

  const plots = state.contentState.current.plots;
  const activePlotIndex = state.activePlotIndex;

  const setActivePlotIndex = (newPlotIndex: PlotIndex) => dispatch(new SetActivePlotIndex(newPlotIndex));
  const addPlot = () => dispatch(new AddPlot());
  const deletePlot = (plotIndex: PlotIndex) => dispatch(new DeletePlot(plotIndex));

  return <Tabs
    value={activePlotIndex.toString()}
    onChange={newValue => setActivePlotIndex(Number(newValue))}
    inverted
    className="PlotSelector--tabs"
  >
    <Tabs.List className="PlotSelector--tabs-list">
      {plots.map((plot, index) => {
        const IconComponent = plot.isEmpty ? IconFile : plot.treeCount === 1 ? IconTree : IconTrees;
        return <div className="PlotSelector--tab-container" key={index}>
          <Tabs.Tab
            value={index.toString()}
            leftSection={<IconComponent size={13} />}
            className={'PlotSelector--tab-button' + (index === activePlotIndex ? ' PlotSelector--tab-button--selected' : '')}
          >
            Plot {index + 1}
          </Tabs.Tab>
          {index === activePlotIndex && <Menu shadow="md" withArrow>
            <Menu.Target>
              <ActionIcon size="sm" variant="subtle" color="gray" className="PlotSelector--tab-right-button">
                <IconDotsVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color="var(--mantine-color-red-9)"  // Use CSS color directly because Menu.Item caps theme color shades at 6
                leftSection={<IconTrash size={14} />}
                onClick={() => deletePlot(index)}
              >
                Delete this plot
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>}
        </div>;
      })}
      <Tooltip label="New plot">
        <Tabs.Tab
          value="newPlot"
          p="md"
          onClick={addPlot}
          leftSection={<IconFilePlus size={13} />}
        />
      </Tooltip>
    </Tabs.List>
  </Tabs>;
};

export default PlotSelector;
