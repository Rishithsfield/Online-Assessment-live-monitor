import { useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

export function useBehaviorTracker(sessionId, enabled = true) {
  const { socket } = useSocket();

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
    const handleBlur = () => {
      reportEvent('blur');
    };

    const handleCopy = (e) => {
      // Check if copy is happening outside of our allowed editor areas
      // We will look for elements that have monaco editor classes or our specific code editor container class
      const isInsideEditor = e.target.closest('.monaco-editor') || e.target.closest('.code-editor-container');
      if (!isInsideEditor) {
        reportEvent('copy');
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('copy', handleCopy);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('copy', handleCopy);
    };
  }, [reportEvent]);

  // For paste and macro, we will trigger them from the editor component directly
  // since standard window events might not catch monaco editor internals reliably
  return { reportEvent };
}
