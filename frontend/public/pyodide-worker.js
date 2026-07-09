/**
 * Pyodide Web Worker
 * Runs Python code entirely in the browser via WebAssembly.
 * Loaded lazily on first Python execution — ~10 MB download, cached after that.
 */

let pyodide = null;

async function loadPyodideInstance() {
  if (pyodide) return pyodide;
  // Load pyodide from CDN
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');
  pyodide = await loadPyodide();
  return pyodide;
}

self.onmessage = async (event) => {
  const { id, code, input, functionName } = event.data;

  try {
    const py = await loadPyodideInstance();

    // Capture stdout
    py.runPython(`
import sys
import io
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
`);

    const wrappedCode = `
${code}

import json as _json
try:
    _fn_name = '${functionName}'
    _alt_names = [_fn_name]
    
    # Camel to snake
    import re as _re
    _snake = _re.sub(r'(?<!^)(?=[A-Z])', '_', _fn_name).lower()
    if _snake not in _alt_names:
        _alt_names.append(_snake)
        
    # Snake to camel
    _camel = ''.join(_word.title() if _idx > 0 else _word for _idx, _word in enumerate(_fn_name.split('_')))
    if _camel not in _alt_names:
        _alt_names.append(_camel)

    _found = None
    for _name in _alt_names:
        if _name in dir():
            _found = _name
            break

    if not _found:
        print(f"Error: Function '${functionName}' not found. Checked alternatives: {_alt_names}")
    else:
        _fn = eval(_found)
        _result = _fn(${input})
        print(_json.dumps(_result, separators=(',', ':')))
except Exception as _e:
    print(f"Error: {_e}")
`;

    py.runPython(wrappedCode);

    const output = py.runPython('_stdout_capture.getvalue()').trim();

    // Reset stdout for next run
    py.runPython(`
sys.stdout = sys.__stdout__
`);

    self.postMessage({ id, output, error: null });
  } catch (err) {
    self.postMessage({ id, output: null, error: err.message });
  }
};
