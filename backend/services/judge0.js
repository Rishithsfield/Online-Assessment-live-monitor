import vm from 'vm';

/**
 * Executes code in a sandboxed environment.
 *
 * JavaScript runs directly in Node.js `vm` module (secure, fast, free, no limits).
 * Python is handled client-side via Pyodide (WebAssembly) — this function returns
 * a sentinel so the frontend knows to use its Pyodide worker instead.
 *
 * @param {string} language
 * @param {string} code
 * @param {string} input  - the argument expression, e.g. "[2,7,11,15], 9"
 * @param {string} functionName
 * @returns {Promise<string>}
 */
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.resolve(__dirname, 'jsWorker.js');

/**
 * Executes JavaScript code inside a Node.js `vm` sandbox with a 5-second timeout.
 * The user's code is evaluated, then the named function is called with the input.
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
        resolve('Error: Code execution timed out (2s limit exceeded). Check for infinite loops.');
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

