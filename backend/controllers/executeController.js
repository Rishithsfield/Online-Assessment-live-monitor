import { executeCode } from '../services/codeRunner.js';

export async function executeCodeHandler(req, res) {
  const { language, code, input, functionName } = req.body;
  try {
    const output = await executeCode(language, code, input, functionName);
    res.json({ output });
  } catch (e) {
    res.status(500).json({ error: 'Execution failed' });
  }
}
