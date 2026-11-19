import { Anchor, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { IconInfoCircle } from '@tabler/icons-react';
import { currentVersion } from '../../currentVersion.tsx';
import Logo from './npbloom-logo.svg';
import NewVersionModal from './NewVersionModal.tsx';
import './AboutButton.scss';

const AboutButton = () => {
  const [aboutBoxOpened, { open: openAboutBox, close: closeAboutBox }] = useDisclosure(false);
  const [newVersionModalOpened, { open: openNewVersionModal, close: closeNewVersionModal }] = useDisclosure(false);

  // Only show the email address after a delay so scrapers have to work extra hard to pick it up
  const [contactEmailAddress, setContactEmailAddress] = useState('');
  useEffect(() => {
    setTimeout(() => setContactEmailAddress(window.atob('eXV2YWxAeXV2YWxpbmd1aXN0LnNwYWNl')), 2000);
  }, []);

  return <>
    <Button
      variant="subtle"
      size="sm"
      onClick={openAboutBox}
    >
      <IconInfoCircle stroke={1} style={{ transform: 'translate(0.5px, 0.5px)' }} />&nbsp; About
    </Button>
    <Modal
      opened={aboutBoxOpened && !newVersionModalOpened}
      onClose={closeAboutBox}
      title={<Group position="apart" spacing="none">
        <img src={Logo} height={80} alt="NPBloom logo" />
        <Text size="lg">Awaken your colorless green ideas.</Text>
      </Group>}
      centered
      size="lg"
      className="Modal-product-info"
      withCloseButton={false}
    >
      <p>Build <strong>syntax trees</strong> for presentations, papers, or homework assignments
        using an in-browser point-and-click interface.</p>
      <p>To begin, click anywhere and start typing a sentence.
        Click above the words to add nodes, and click above the nodes to add parent nodes,
        working your way up the tree.</p>
      <p>
        For feedback, bug reports, or feature requests, please contact me at <b>{contactEmailAddress}</b>.<br />
        For contributing, see the <Anchor
          href="https://github.com/yuvallevy/syntax-forest-builder/tree/main"
          target="_blank"
          rel="noopener noreferrer"
        >GitHub repository</Anchor>.
      </p>
      <Group position="apart" align="end">
        <Stack>
          <Text size="sm">
            Version {currentVersion}.{' '}
            <Button variant="white" style={{ fontSize: 'inherit' }} onClick={openNewVersionModal}>See what's new</Button><br />
            {import.meta.env.VITE_BUILD_TIMESTAMP && <> Last updated {import.meta.env.VITE_BUILD_TIMESTAMP}.</>}
          </Text>
          <Text size="sm">
            Logo by <Anchor href="https://hadarorenart.wixsite.com/hrodesign" target="_blank" rel="noopener noreferrer">
              hro-arts
            </Anchor>.
          </Text>
        </Stack>
        <Button size="md" onClick={closeAboutBox} data-autofocus>Close</Button>
      </Group>
    </Modal>
    <NewVersionModal
      opened={newVersionModalOpened}
      onOpen={openNewVersionModal}
      onClose={closeNewVersionModal}
    />
  </>;
};

export default AboutButton;
