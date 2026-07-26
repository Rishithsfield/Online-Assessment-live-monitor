import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.resolve(__dirname, 'jsWorker.js');

/**
 * Executes code in a sandboxed environment.
 *
 * JavaScript runs directly in a isolated Node.js worker thread with vm sandbox.
 * Python is handled client-side via Pyodide (WebAssembly).
 *
 * @param {string} language
 * @param {string} code
 * @param {string} input  - the argument expression, e.g. "[2,7,11,15], 9"
 * @param {string} functionName
 * @returns {Promise<string>}
 */
export async function executeCode(language, code, input, functionName = 'solution') {
  if (language === 'javascript') {
    return executeJavaScript(code, input, functionName);
  }

  // Python is executed client-side via Pyodide — signal the frontend.
  if (language === 'python') {
    return '__PYODIDE__';
  }

  return 'Language not supported in sandbox mode. Please use JavaScript or Python.';
}

function executeJavaScript(code, input, functionName) {
  return new Promise((resolve) => {
    const worker = new Worker(workerPath);
    let resolved = false;

    const timeoutId = setTimeout(async () => {
      if (!resolved) {
        resolved = true;
        await worker.terminate();
        resolve('Error: Code execution timed out (2.5s limit exceeded). Check for infinite loops.');
      }
    }, 2500);

    worker.on('message', (message) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      worker.terminate();

      if (message.error) {
        resolve(`Error: ${message.error}`);
      } else {
        resolve(message.result);
      }
    });

    worker.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      worker.terminate();
      resolve(`Error: ${err.message}`);
    });

    worker.on('exit', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      resolve(`Error: Code execution stopped unexpectedly with exit code ${code}`);
    });

    worker.postMessage({ code, input, functionName });
  });
}
