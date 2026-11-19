import React, { useEffect, useRef, useState } from 'react';
import { treeToLbn, UnpositionedTree } from 'npbloom-core';
import { Button, Group, Menu, Modal, Textarea, useMantineTheme } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import './TextOutputModal.scss';

interface TextOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  trees: UnpositionedTree[];
}

const generateMshangCaPermalink = (text: string) => {
  const encodedText = encodeURIComponent(text);
  return `https://mshang.ca/syntree/?i=${encodedText}`;
}

const TextOutputModal: React.FC<TextOutputModalProps> = ({
  isOpen,
  onClose,
  trees,
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mshangCaPermalink = trees.length === 1 ? generateMshangCaPermalink(text) : undefined;

  const theme = useMantineTheme();

  useEffect(() => {
    if (isOpen) {
      setText(trees.map(tree => treeToLbn(tree)).join('\n\n'));
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [trees, isOpen]);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      textareaRef.current?.select();
      document.execCommand('copy');
    }
  };

  return (
    <Modal centered title="Export to text" size="lg" opened={isOpen} onClose={onClose}>
      <Textarea
        value={text}
        ref={textareaRef}
        readOnly
        minRows={10}
        className="TextOutputModal--textarea"
        mb={theme.spacing.md}
      />
      <Group position="apart">
        <Group>
          <Button variant="default" onClick={handleCopy}>Copy to clipboard</Button>
          <Menu shadow="md" position="bottom-start">
            <Menu.Target>
              <Button variant="default" disabled={!mshangCaPermalink}>
                <IconExternalLink stroke={1} style={{ transform: 'translate(0.5px, 0.5px)' }} />&nbsp; Open in...
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item component="a" href={mshangCaPermalink} target="_blank" rel="noopener noreferrer">
                Miles Shang's Syntax Tree Generator
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
        <Button variant="filled" onClick={onClose}>Done</Button>
      </Group>
    </Modal>
  );
};

export default TextOutputModal;
