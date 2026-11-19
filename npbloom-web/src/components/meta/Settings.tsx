import { useContext } from 'react';
import { Button, Checkbox, Group, Modal, Stack } from '@mantine/core';
import { SetAutoFormatSubscript, SetLiveStringWidth, SetPrettyNodeLabels } from 'npbloom-core';
import { useDisclosure } from '@mantine/hooks';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';
import SettingsStateContext from "../../SettingsStateContext";
import useHotkeys from '@reecelucas/react-use-hotkeys';

const Settings: React.FC = () => {
  const [opened, { open, close }] = useDisclosure(false);
  const { settingsState, settingsDispatch } = useContext(SettingsStateContext);

  useHotkeys(['Control+,', 'Meta+,'], event => { event.preventDefault(); open(); },
    { ignoredElementWhitelist: ['INPUT'] });

  return <>
    <Button
      variant="subtle"
      size="sm"
      onClick={open}
    >
      <IconAdjustmentsHorizontal stroke={1} style={{ transform: 'translate(0.5px, 0.5px)' }} />&nbsp; Settings
    </Button>
    <Modal centered title="Settings" size="lg" opened={opened} onClose={close}>
      <Stack>
        <Checkbox
          label="Format brackets/parentheses as subscript while typing"
          description={<>
            When this is enabled, letters and numbers in parentheses or brackets such as (i) and [i] will automatically be rendered as subscript.<br />
            This does not work on all letters. This setting will not affect existing text.
          </>}
          checked={settingsState.autoFormatSubscript}
          onChange={(event) => settingsDispatch(new SetAutoFormatSubscript(event.currentTarget.checked))}
        />
        <Checkbox
          label="Use new text width measurement (slightly slower, more accurate)"
          checked={settingsState.liveStringWidth}
          onChange={(event) => settingsDispatch(new SetLiveStringWidth(event.currentTarget.checked))}
        />
        <Checkbox
          label={<>Render bar notation and subscripts in node labels (e.g. X'[16] as X&#x0304;&#x2081;&#x2086;)</>}
          checked={settingsState.prettyNodeLabels}
          onChange={(event) => settingsDispatch(new SetPrettyNodeLabels(event.currentTarget.checked))}
        />
        <Group position="right">
          <Button variant="filled" onClick={close}>Done</Button>
        </Group>
      </Stack>
    </Modal>
  </>;
};

export default Settings;
