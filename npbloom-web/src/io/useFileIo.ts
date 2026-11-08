import { useState } from 'react';
import useBrowserFileIo from './useBrowserFileIo.tsx';
import useSystemFileIo from './useSystemFileIo.tsx';

const useFileIo = () => {
  // Keep track of which file is currently open in the browser file IO, if any,
  // so that "Save" and "Save as" work as expected
  const [activeFileName, setActiveFileName] = useState<string>();

  const {
    browserFileIoModalComponent,
    openFileLoadModal,
    openFileSaveModal,
    saveOrSaveAs,
    hasUnsavedChanges,
  } = useBrowserFileIo({
    activeFileName,
    setActiveFileName,
  });

  /** ☣️ LEAKY ABSTRACTION AHEAD! Wear gloves and/or say a prayer before touching this code. ☣️
   * The system file IO is a separate implementation from the browser file IO, and they don't share any state.
   * This means that if the user opens a file using the system file IO, we need to clear the active file name in the browser file IO
   * to prevent confusion (such as when importing a file using the system file IO on top of an already open file in the browser file IO).
   * This is not ideal, but it's a tradeoff we make to keep the two systems separate so the user doesn't get confused between them. */
  const { openSystemFileLoadModal, openSystemFileSaveModal } = useSystemFileIo({
    setBrowserIoActiveFileName: setActiveFileName,
  });

  return {
    browserFileIoModalComponent,
    activeFileName,
    openFileLoadModal,
    openFileSaveModal,
    saveOrSaveAs,
    hasUnsavedChanges,
    openSystemFileLoadModal,
    openSystemFileSaveModal,
  };
};

export default useFileIo;
