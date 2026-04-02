'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook that registers a beforeunload handler while recording is active.
 *
 * Shows the browser's native "Changes you made may not be saved" dialog
 * when the doctor tries to close/navigate away during an active consultation.
 *
 * The optional onFlush callback is a best-effort last-chance save — Phase 5
 * incremental save already persists data every ~5s, so this is supplementary.
 *
 * @param isRecording - Whether recording is currently active
 * @param onFlush - Optional callback to flush pending data before unload
 */
export function useBeforeUnloadProtection(
  isRecording: boolean,
  onFlush?: () => void
): void {
  // Use ref for onFlush to avoid stale closures
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const handler = (event: BeforeUnloadEvent) => {
      // Best-effort flush of pending data
      onFlushRef.current?.();

      // Cross-browser: both preventDefault and returnValue are needed
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);

    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [isRecording]);
}
