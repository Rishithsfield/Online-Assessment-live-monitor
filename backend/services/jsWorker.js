import { parentPort } from 'worker_threads';
import vm from 'vm';

parentPort.on('message', ({ code, input, functionName }) => {
  try {
    const sandbox = {
      console: {
        log:   (...args) => args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
        error: (...args) => args.map(a => String(a)).join(' '),
        warn:  (...args) => args.map(a => String(a)).join(' '),
      },
      JSON,
      Math,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      __result: undefined,
      __error:  undefined,
    };

    const wrappedCode = `
      ${code}
      try {
        if (typeof ${functionName} !== 'function') {
          __error = "Function '${functionName}' not found. Make sure you define it with that exact name.";
        } else {
          const __rawResult = ${functionName}(${input});
          __result = JSON.stringify(__rawResult);
        }
      } catch (e) {
        __error = e.message;
      }
    `;

    const context = vm.createContext(sandbox);
    vm.runInContext(wrappedCode, context, { timeout: 2000 });

    if (sandbox.__error) {
      parentPort.postMessage({ error: sandbox.__error });
    } else {
      parentPort.postMessage({ result: sandbox.__result ?? 'null' });
    }
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
});
