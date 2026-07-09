import { useRef, useCallback } from 'react';

/**
 * usePyodide — manages a Web Worker that runs Python via Pyodide (WebAssembly).
 *
 * The worker is created lazily on first Python execution and stays alive for
 * the lifetime of the component so Pyodide doesn't need to re-download.
 *
 * Usage:
 *   const { runPython } = usePyodide();
 *   const result = await runPython(code, input, functionName);
 */
export function usePyodide() {
  const workerRef   = useRef(null);
  const pendingRef  = useRef(new Map()); // id → { resolve, reject }
  let   idCounter   = 0;

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker('/pyodide-worker.js?v=' + Date.now());

    worker.onmessage = (e) => {
      const { id, output, error } = e.data;
      const pending = pendingRef.current.get(id);
      if (!pending) return;
      pendingRef.current.delete(id);
      if (error) pending.reject(new Error(error));
      else        pending.resolve(output ?? '');
    };

    worker.onerror = (e) => {
      // Reject all pending promises on a fatal worker error
      for (const [, p] of pendingRef.current) p.reject(new Error(e.message));
      pendingRef.current.clear();
      workerRef.current = null; // allow re-creation on next call
    };

    workerRef.current = worker;
    return worker;
  }, []);

  const runPython = useCallback((code, input, functionName = 'solution') => {
    return new Promise((resolve, reject) => {
      const id = ++idCounter;
      pendingRef.current.set(id, { resolve, reject });

      // 30-second timeout guard
      const timeout = setTimeout(() => {
        pendingRef.current.delete(id);
        reject(new Error('Python execution timed out (30s). Check for infinite loops.'));
      }, 30000);

      pendingRef.current.set(id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v); },
        reject:  (e) => { clearTimeout(timeout); reject(e);  },
      });

      getWorker().postMessage({ id, code, input, functionName });
    });
  }, [getWorker]);

  return { runPython };
}
