/**
 * Code Similarity & Plagiarism Detection Engine
 * Uses tokenization, AST-like normalization, and N-gram Jaccard similarity
 */

function tokenize(code) {
  if (!code || typeof code !== 'string') return [];

  // Remove single line & multiline comments
  let cleaned = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/#.*/g, '');

  // Normalize string literals to 'STR' and numbers to 'NUM'
  cleaned = cleaned
    .replace(/(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, 'STR')
    .replace(/\b\d+(\.\d+)?\b/g, 'NUM');

  // Extract tokens (words, symbols, operators)
  const rawTokens = cleaned.match(/[a-zA-Z_]\w*|[^\s\w]/g) || [];

  // Map user identifiers to generic 'ID' tokens while keeping control keywords
  const KEYWORDS = new Set([
    'function', 'def', 'return', 'if', 'else', 'for', 'while', 'const', 'let', 'var',
    'class', 'import', 'from', 'in', 'of', 'try', 'catch', 'throw', 'new', 'break', 'continue',
    'and', 'or', 'not', 'elif', 'print', 'console', 'log'
  ]);

  return rawTokens.map(tok => {
    if (/^[a-zA-Z_]\w*$/.test(tok)) {
      return KEYWORDS.has(tok) ? tok : 'ID';
    }
    return tok;
  });
}

function getNGrams(tokens, n = 3) {
  if (tokens.length < n) return [tokens.join(' ')];
  const nGrams = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    nGrams.push(tokens.slice(i, i + n).join(' '));
  }
  return nGrams;
}

export function calculateCodeSimilarity(code1, code2) {
  if (!code1 || !code2) return 0;
  if (code1.trim() === code2.trim()) return 100;

  const tokens1 = tokenize(code1);
  const tokens2 = tokenize(code2);

  if (tokens1.length < 5 || tokens2.length < 5) return 0;

  const nGrams1 = new Set(getNGrams(tokens1, 3));
  const nGrams2 = new Set(getNGrams(tokens2, 3));

  let intersection = 0;
  for (const item of nGrams1) {
    if (nGrams2.has(item)) intersection++;
  }

  const union = new Set([...nGrams1, ...nGrams2]).size;
  if (union === 0) return 0;

  const score = Math.round((intersection / union) * 100);
  return score;
}

export function checkAllSessionsPlagiarism(sessions) {
  const results = [];
  const validSessions = (sessions || []).filter(s => s.code && s.code.trim().length > 20 && s.status !== 'disqualified');

  for (let i = 0; i < validSessions.length; i++) {
    for (let j = i + 1; j < validSessions.length; j++) {
      const s1 = validSessions[i];
      const s2 = validSessions[j];
      const similarity = calculateCodeSimilarity(s1.code, s2.code);

      if (similarity >= 50) {
        results.push({
          session1: { id: s1.id, name: s1.name, code: s1.code },
          session2: { id: s2.id, name: s2.name, code: s2.code },
          similarity,
          isFlagged: similarity >= 70
        });
      }
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}
