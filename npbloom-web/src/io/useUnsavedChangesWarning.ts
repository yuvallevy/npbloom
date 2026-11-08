import { useEffect } from 'react';

/**
 * If `enabled` is true, asks the browser to show a confirmation dialog when the tab is closed or reloaded,
 * to prevent accidental loss of unsaved changes.
 */
const useUnsavedChangesWarning = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ''; // Required by older versions of Chrome and Safari
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);
};

export default useUnsavedChangesWarning;
