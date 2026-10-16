import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

export function useBehaviorTracker(sessionId, enabled = true) {
  const { socket } = useSocket();
  const lastBlurRef = useRef(0);

  const reportEvent = useCallback((eventType) => {
    if (!enabled) return;
    if (socket && sessionId) {
      socket.emit('telemetry_event', {
        sessionId,
        eventType,
        timestamp: Date.now()
      });
    }
  }, [socket, sessionId, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const handleBlurOrTabSwitch = () => {
      const now = Date.now();
      // Debounce blurs within 400ms to prevent duplicate triggers on simultaneous blur + visibilitychange
      if (now - lastBlurRef.current < 400) return;
      lastBlurRef.current = now;
      reportEvent('blur');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBlurOrTabSwitch();
      }
    };

    const handleCopy = (e) => {
      const isInsideEditor = e.target?.closest?.('.monaco-editor') || e.target?.closest?.('.code-editor-container');
      if (!isInsideEditor) {
        reportEvent('copy');
      }
    };

    window.addEventListener('blur', handleBlurOrTabSwitch);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('copy', handleCopy);

    return () => {
      window.removeEventListener('blur', handleBlurOrTabSwitch);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('copy', handleCopy);
    };
  }, [reportEvent, enabled]);

  return { reportEvent };
}

