import { useEffect } from 'react';
import { Anchor, Badge, Button, Container, Group, Modal, Space, Stack, Text, ThemeIcon } from '@mantine/core';
import { changesFromPreviousVersion, currentVersion, releaseDate } from '../../currentVersion';
import './NewVersionModal.scss';

interface NewVersionModalProps {
  opened: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const colorByChangeType: Record<string, string> = {
  'New': 'lime',
  'Improved': 'blue',
  'Fix': 'orange',
};

/**
 * Modal that shows the changes from the previous version to the current one,
 * if the user has previously been using an older version.
 */
const NewVersionModal = ({
  opened,
  onOpen,
  onClose,
}: NewVersionModalProps) => {
  useEffect(() => {
    // lastVersion is the version the user was using in their last session
    const lastVersion = localStorage.getItem('nb_lastVersion');
    if (lastVersion && lastVersion !== currentVersion) {
      // Show the modal only if there are changes from the previous version we want to inform the user about
      if (changesFromPreviousVersion.length > 0) {
        onOpen();
      }
      // Update the last version in the local storage
      localStorage.setItem('nb_lastVersion', currentVersion);
    } else if (!lastVersion) {
      // If there is no last version in the local storage, this is the first time the user is using the app
      localStorage.setItem('nb_lastVersion', currentVersion);
    }
  }, [onOpen]);

  return <Modal
    opened={opened}
    centered
    size="lg"
    withCloseButton={false}
    onClose={onClose}
    className="Modal-product-info"
    title={<Group position="apart">
      <Text>What's new in NPBloom</Text>
      <Badge variant="gradient" size="xl" sx={{ textTransform: 'none' }}>
        v{currentVersion}
      </Badge>
    </Group>}
  >
    <Stack className="NewVersionModal--changes" spacing="lg">
      {changesFromPreviousVersion.map(({ icon: Icon, title, badge, description }, index) => (
        <Container key={index} className="NewVersionModal--change">
          <ThemeIcon size="xl" radius="md" variant="light" color={colorByChangeType[badge || '']}>
            <Icon />
          </ThemeIcon>
          <Stack spacing="xs">
            <Group>
              <Text weight="bold">{title}</Text>
              {badge && <Badge variant="light" color={colorByChangeType[badge]}>{badge}</Badge>}
            </Group>
            <div className="NewVersionModal--change-description">{description}</div>
          </Stack>
        </Container>
      ))}
    </Stack>
    <Space h="xl" />
    <Group position="apart">
      <Text size="sm">
        Released {releaseDate} &nbsp;&middot;&nbsp; <Anchor href="https://github.com/yuvallevy/syntax-forest-builder/blob/main/HISTORY.md" target="_blank" rel="noopener">Full release notes</Anchor>
      </Text>
      <Button size="md" onClick={onClose} data-autofocus>OK</Button>
    </Group>
  </Modal>;
}

export default NewVersionModal;
