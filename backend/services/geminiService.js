/**
 * Service to generate coding challenges using the Gemini API,
 * with a multi-pass auto-repairing JSON parser for resilience.
 */

export async function generateQuestionWithGemini({ topic, difficulty, testCaseCount }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('Gemini API key not configured. Add GEMINI_API_KEY to your .env file.');
    error.status = 503;
    throw error;
  }

  const numTestCases = Math.min(Math.max(testCaseCount || 3, 1), 10);
  const diffLevel = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';

  const prompt = `Topic: ${topic}
Difficulty: ${diffLevel}
Number of test cases: ${numTestCases}

Create an original, novel coding challenge inspired by the topic "${topic}".
IMPORTANT: All boilerplates must strictly match LeetCode style without ANY #include or import statements!
- In C++, do NOT write #include <...> or using namespace std;. Output ONLY class Solution with public method.
- In Java, do NOT write import ... or public class Main. Output ONLY class Solution with public method.
- In Python, do NOT write import ...; output ONLY class Solution.
- In JavaScript, output var functionName = function(...) { ... }.
All necessary headers, modules, and driver main execution are automatically injected in the background.

CRITICAL REQUIREMENT FOR TEST CASES:
- Double-check all expectedOutput values! Manually trace the algorithm step-by-step on each input.
- Do NOT guess or approximate arithmetic calculations.
- For tree, graph, or matrix problems, calculate every node, path sum, and subtree sum individually without assuming symmetry. All test cases MUST be mathematically 100% correct.

Generate a coding challenge as a JSON object matching this structure:
{
  "title": "Short descriptive title",
  "functionName": "camelCaseFunctionName",
  "text": "Full problem statement with examples. Use standard plain text for math (e.g. 10^9 + 7, a != b). Do NOT use LaTeX commands with backslashes like \\neq or \\frac.",
  "constraints": "Bullet-pointed constraints using standard text",
  "difficulty": "${diffLevel}",
  "tags": ["tag1", "tag2"],
  "boilerplate": {
    "javascript": "/**\\n * @return {any}\\n */\\nvar camelCaseFunctionName = function(params) {\\n  // Write your code here\\n};",
    "python": "class Solution:\\n    def camelCaseFunctionName(self, params):\\n        # Write your code here\\n        pass",
    "cpp": "class Solution {\\npublic:\\n    ReturnType camelCaseFunctionName(ParamTypes params) {\\n        // Write your code here\\n    }\\n};",
    "java": "class Solution {\\n    public ReturnType camelCaseFunctionName(ParamTypes params) {\\n        // Write your code here\\n    }\\n}"
  },
  "testcases": [
    { "id": 1, "input": "arg1, arg2", "expectedOutput": "expected_result" }
  ]
}`;

  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey
  };

  const jsonSchema = {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      functionName: { type: 'STRING' },
      text: { type: 'STRING' },
      constraints: { type: 'STRING' },
      difficulty: { type: 'STRING' },
      tags: { type: 'ARRAY', items: { type: 'STRING' } },
      boilerplate: {
        type: 'OBJECT',
        properties: {
          javascript: { type: 'STRING' },
          python: { type: 'STRING' },
          cpp: { type: 'STRING' },
          java: { type: 'STRING' }
        },
        required: ['javascript', 'python', 'cpp', 'java']
      },
      testcases: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'INTEGER' },
            input: { type: 'STRING' },
            expectedOutput: { type: 'STRING' }
          },
          required: ['id', 'input', 'expectedOutput']
        }
      }
    },
    required: ['title', 'functionName', 'text', 'constraints', 'difficulty', 'tags', 'boilerplate', 'testcases']
  };

  const reqBody = JSON.stringify({
    systemInstruction: {
      parts: [{
        text: 'You are an automated API backend that outputs ONLY raw JSON adhering strictly to the provided response schema. Never output reasoning, test walkthroughs, markdown code fences, or LaTeX commands containing backslashes.'
      }]
    },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: jsonSchema
    }
  });

  const GEMINI_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest'
  ];

  let rawText = null;
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: 'POST', headers, body: reqBody }
      );

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text();
        console.warn(`Gemini model ${model} returned HTTP ${geminiRes.status}:`, errBody.slice(0, 120));
        let parsedErr = errBody;
        try {
          const jsonErr = JSON.parse(errBody);
          parsedErr = jsonErr.error?.message || errBody;
        } catch (_) {}
        lastError = new Error(`Gemini API (${model}) returned ${geminiRes.status}: ${parsedErr}`);
        continue;
      }

      const geminiData = await geminiRes.json();
      const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        rawText = text;
        break;
      } else {
        const reason = geminiData?.candidates?.[0]?.finishReason || 'Unknown';
        console.warn(`Gemini model ${model} had empty parts (finishReason: ${reason})`);
        lastError = new Error(`Gemini model ${model} response was filtered (finishReason: ${reason})`);
      }
    } catch (fetchErr) {
      console.warn(`Gemini model ${model} fetch failed:`, fetchErr.message);
      lastError = fetchErr;
    }
  }

  if (!rawText) {
    const error = lastError || new Error('Empty response from Gemini API across all models. Try again.');
    error.status = 502;
    throw error;
  }


  // Multi-pass Auto-Repairing JSON Parser
  let question;
  try {
    let cleaned = rawText.replace(/^```(?:json)?\s*/gi, '').replace(/\s*```$/gi, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    } else if (firstBrace !== -1) {
      cleaned = cleaned.substring(firstBrace);
    }

    // Pass 1: Direct JSON.parse
    try {
      question = JSON.parse(cleaned);
    } catch (e1) {
      // Pass 2: Truncated JSON Auto-repair + Invalid backslash & character escaping
      let inString = false;
      let escaped = false;
      let stack = [];
      let repaired = '';

      for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (escaped) {
          repaired += ch;
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          // Fix invalid JSON escape characters (e.g. LaTeX \neq, \frac)
          const nextChar = cleaned[i + 1];
          if (nextChar && !' "  / b f n r t u '.includes(nextChar)) {
            repaired += '\\\\';
          } else {
            repaired += ch;
            escaped = true;
          }
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          repaired += ch;
          continue;
        }
        if (inString) {
          if (ch === '\n') { repaired += '\\n'; continue; }
          if (ch === '\r') { repaired += '\\r'; continue; }
          if (ch === '\t') { repaired += '\\t'; continue; }
          repaired += ch;
          continue;
        }

        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if (ch === '}' || ch === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === ch) {
            stack.pop();
          }
        }
        repaired += ch;
      }

      if (inString) repaired += '"';
      while (stack.length > 0) repaired += stack.pop();

      question = JSON.parse(repaired);
    }
  } catch (err) {
    console.error('Failed JSON raw output:', rawText);
    const error = new Error('AI response was truncated or unparseable. Please click Generate Question again.');
    error.status = 502;
    throw error;
  }

  // Validate essential fields
  if (!question.title || !question.text || !question.testcases) {
    const error = new Error('Gemini returned an incomplete question. Try again.');
    error.status = 502;
    throw error;
  }

  // Ensure IDs on test cases
  question.testcases = question.testcases.map((tc, i) => ({ ...tc, id: tc.id || i + 1 }));

  // Sanitize boilerplates to ensure pure LeetCode style without any headers or imports
  if (question.boilerplate) {
    if (question.boilerplate.cpp) {
      question.boilerplate.cpp = question.boilerplate.cpp
        .replace(/#include\s*<[^>]+>\s*/g, '')
        .replace(/#include\s*"[^"]+"\s*/g, '')
        .replace(/using\s+namespace\s+std\s*;\s*/g, '')
        .trim();
    }
    if (question.boilerplate.java) {
      question.boilerplate.java = question.boilerplate.java
        .replace(/import\s+[a-zA-Z0-9_.*]+;\s*/g, '')
        .trim();
    }
    if (question.boilerplate.python) {
      question.boilerplate.python = question.boilerplate.python
        .replace(/(?:from\s+[a-zA-Z0-9_.]+\s+)?import\s+[a-zA-Z0-9_.*,\s]+\n/g, '')
        .trim();
    }
  }

  if (!question.boilerplate) question.boilerplate = {};
  const fn = question.functionName || 'solution';
  if (!question.boilerplate.javascript) {
    question.boilerplate.javascript = `var ${fn} = function() {\n    // Write your code here\n};`;
  }
  if (!question.boilerplate.python) {
    question.boilerplate.python = `class Solution:\n    def ${fn}(self, *args):\n        # Write your code here\n        pass`;
  }
  if (!question.boilerplate.cpp) {
    question.boilerplate.cpp = `class Solution {\npublic:\n    // Write your code here\n    void ${fn}() {\n        \n    }\n};`;
  }
  if (!question.boilerplate.java) {
    question.boilerplate.java = `class Solution {\n    // Write your code here\n    public void ${fn}() {\n        \n    }\n}`;
  }

  return question;
}

