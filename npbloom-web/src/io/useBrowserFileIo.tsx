import { useEffect, useRef, useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import useUiState from '../useUiState';
import { ContentChange, LoadContentState, createFileContents } from 'npbloom-core';
import {
  deleteFile,
  FileWithMetadata,
  getFileMetadataList,
  loadFileContents,
  openFileDatabase,
  renameFile,
  saveFileContents
} from './browserFileIoImpl';
import BrowserFileIoModal from './BrowserFileIoModal';
import useUnsavedChangesWarning from './useUnsavedChangesWarning';

const useBrowserFileIo = ({
  activeFileName,
  setActiveFileName,
}: {
  activeFileName?: string;
  setActiveFileName: (fileName?: string) => void;
}) => {
  const { state, dispatch } = useUiState();
  const db = useRef<IDBDatabase>();
  const [browserFileIoModalOpened, { open: openFileIoModal, close: closeFileIoModal }] = useDisclosure(false);
  const [fileList, setFileList] = useState<FileWithMetadata[]>([]);
  const [interactionMode, setInteractionMode] = useState<'save' | 'load'>('load');

  // The top of the undo stack at the time of the last save or load, used as a marker for the saved version.
  // Compared by reference to determine whether the content has changed since then.
  const [savedMarker, setSavedMarker] = useState<ContentChange | null>(null);
  const hasUnsavedChanges = (state.contentState.lastAction ?? null) !== savedMarker;
  useUnsavedChangesWarning(hasUnsavedChanges);

  const refreshFileList = async () => {
    if (!db.current) {
      db.current = await openFileDatabase();
    }
    setFileList(await getFileMetadataList(db.current));
  };

  useEffect(() => {
    if (browserFileIoModalOpened) void refreshFileList();
  }, [browserFileIoModalOpened]);

  const openFileSaveModal = () => {
    setInteractionMode('save');
    openFileIoModal();
  };

  const openFileLoadModal = () => {
    setInteractionMode('load');
    openFileIoModal();
  };

  const assertDbConnected = (fn: (db: IDBDatabase) => Promise<void>): Promise<void> =>
    !db.current ? new Promise((_, reject) => reject(new Error('File database not connected')))
      : fn(db.current);

  const handleSave = (fileName: string): Promise<void> =>
    assertDbConnected(async db => {
      try {
        const fileContents = createFileContents(state.contentState.current, state.plotPanZoomStates);
        const marker = state.contentState.lastAction ?? null; // Captured alongside the contents being saved
        await saveFileContents(db, fileContents, fileName);
        setActiveFileName(fileName);
        setSavedMarker(marker);
        closeFileIoModal();
      } catch (e: any) {
        modals.open({
          title: 'Error saving file',
          children: <div>{e.message || 'An unknown error occurred while saving the file.'}</div>,
          centered: true,
        });
      }
    });

  const handleLoad = (fileName: string): Promise<void> =>
    assertDbConnected(async db => {
      try {
        const fileContents = await loadFileContents(db, fileName);
        setActiveFileName(fileName);
        dispatch(new LoadContentState(fileContents));
        setSavedMarker(null); // Loading resets the undo history, so the loaded content has an empty undo stack
        closeFileIoModal();
      } catch (e: any) {
        modals.open({
          title: 'Error loading file',
          children: <div>{e.message || 'An unknown error occurred while loading the file.'}</div>,
          centered: true,
        });
      }
    });

  const handleRename = (oldFileName: string, newFileName: string): Promise<void> =>
    assertDbConnected(async db => {
      await renameFile(db, oldFileName, newFileName);
      await refreshFileList();
    });

  const handleDelete = (fileName: string): Promise<void> =>
    assertDbConnected(async db => {
      await deleteFile(db, fileName);
      await refreshFileList();
    });

  const saveOrSaveAs = () => activeFileName ? handleSave(activeFileName) : openFileSaveModal();

  const browserFileIoModalComponent = <BrowserFileIoModal
    opened={browserFileIoModalOpened}
    fileList={fileList}
    interactionMode={interactionMode}
    activeFileName={activeFileName}
    onSave={handleSave}
    onLoad={handleLoad}
    onRename={handleRename}
    onDelete={handleDelete}
    onClose={closeFileIoModal}
  />;

  return {
    browserFileIoModalComponent,
    openFileSaveModal,
    openFileLoadModal,
    saveOrSaveAs,
    hasUnsavedChanges,
  };
};

export default useBrowserFileIo;
