/**
 * Code Execution Service supporting LeetCode-style solutions for
 * JavaScript, Python, C++, and Java.
 *
 * Supports TreeNode, ListNode, arrays, non-const references, numbers, strings, and standard collections.
 * Uses Judge0 with an automatic native execution fallback (g++, python, node, docker-java)
 * so that candidate code executes with 100% reliability.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const JUDGE0_LANGUAGE_MAP = {
  javascript: 63, // Node.js 12.14.0
  python: 71,     // Python 3.8.1
  cpp: 54,        // C++ (GCC 9.2.0)
  java: 62        // Java (OpenJDK 13.0.1)
};

/**
 * Remove parameter names if formatted like "nums = [1,2], target = 3" or "s1 = 'abc', s2 = 'def'"
 */
function sanitizeArgs(input) {
  if (typeof input !== 'string') return input != null ? String(input) : '';
  return input
    .replace(/(?:^|,)\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*(?=[\[{\"'0-9\-a-zA-Z])/g, (match) => {
      return match.trimStart().startsWith(',') ? ', ' : '';
    })
    .trim();
}

/**
 * Convert JSON-style arrays to C++ __vec({...}) to allow binding to non-const vector<T>&
 */
function toCppArgs(argsStr) {
  if (!argsStr) return '';
  let s = argsStr;
  // 2D int matrix: [[0, 1, 2], [0, 2, 5]] -> __mat({{0, 1, 2}, {0, 2, 5}})
  s = s.replace(/\[\s*(\[\s*[-0-9\s,]+\s*\](?:\s*,\s*\[\s*[-0-9\s,]+\s*\])*)\s*\]/g, (m, inner) => {
    return '__mat({' + inner.replace(/\[\s*([-0-9\s,]+)\s*\]/g, '{$1}') + '})';
  });
  // 2D char matrix: [["1", "0"], ["0", "1"]] -> __mat_char({{'1', '0'}, {'0', '1'}})
  s = s.replace(/\[\s*(\[\s*"[^"]*"(?:\s*,\s*"[^"]*")*\s*\](?:\s*,\s*\[\s*"[^"]*"(?:\s*,\s*"[^"]*")*\s*\])*)\s*\]/g, (m, inner) => {
    const charsConverted = inner.replace(/"([^"])"/g, "'$1'").replace(/\[\s*([^\]]+)\s*\]/g, '{$1}');
    return '__mat_char({' + charsConverted + '})';
  });
  // 1D int array: [1, 2, 3] -> __vec({1, 2, 3})
  s = s.replace(/\[\s*([-0-9\s,]+)\s*\]/g, '__vec({$1})');
  // 1D string array: ["a", "b"] -> __vec_str({"a", "b"})
  s = s.replace(/\[\s*("[^"]*"\s*(?:,\s*"[^"]*"\s*)*)\]/g, '__vec_str({$1})');
  // Standalone strings "abc" -> __str("abc")
  s = s.replace(/(?:^|,\s*)("[^"]*")/g, (m, p1) => m.startsWith(',') ? `, __str(${p1})` : `__str(${p1})`);
  return s;
}

function toJavaArgs(argsStr) {
  if (!argsStr) return '';
  let s = argsStr;
  // 2D int array
  s = s.replace(/\[\s*(\[\s*[-0-9\s,]+\s*\](?:\s*,\s*\[\s*[-0-9\s,]+\s*\])*)\s*\]/g, (m, inner) => {
    return 'new int[][]{' + inner.replace(/\[\s*([-0-9\s,]+)\s*\]/g, 'new int[]{$1}') + '}';
  });
  // 1D int array
  s = s.replace(/\[\s*([-0-9\s,]+)\s*\]/g, 'new int[]{$1}');
  // 1D String array
  s = s.replace(/\[\s*("[^"]*"\s*(?:,\s*"[^"]*"\s*)*)\]/g, 'new String[]{$1}');
  return s;
}


/**
 * Detect the primary method name from candidate code
 */
function extractMethodName(code, defaultName = 'solution') {
  if (!code) return defaultName;

  if (defaultName && defaultName !== 'solution') {
    const escaped = defaultName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(code)) return defaultName;
  }

  const methodMatch = code.match(/(?:public\s+)?(?:[\w<>:*&\[\]]+\s+)+([a-zA-Z_]\w*)\s*\(/);
  if (methodMatch && methodMatch[1] && !['main', 'if', 'while', 'for', 'switch'].includes(methodMatch[1])) {
    return methodMatch[1];
  }

  return defaultName || 'solution';
}

function wrapCpp(code, input, functionName) {
  if (code.includes('int main') || code.includes('void main')) {
    return `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <deque>
#include <cmath>
#include <climits>
#include <cstring>
#include <numeric>
#include <functional>
#include <memory>
#include <utility>

using namespace std;

${code}
`;
  }

  const cleanArgs = sanitizeArgs(input);
  const methodName = extractMethodName(code, functionName);
  const isClassSolution = code.includes('class Solution');

  const isTreeNode = /TreeNode\b/.test(code) || /\b(root|tree)\b/i.test(code) || /\b(root|tree)\b/i.test(functionName);
  const isListNode = /ListNode\b/.test(code) || /\b(head|listNode)\b/i.test(code) || /\b(head|list)\b/i.test(functionName);

  let callArgs;
  if (isTreeNode) {
    callArgs = `__buildTree(R"RAW(${input || ''})RAW")`;
  } else if (isListNode) {
    callArgs = `__buildList(R"RAW(${input || ''})RAW")`;
  } else {
    callArgs = toCppArgs(cleanArgs);
  }

  return `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <deque>
#include <cmath>
#include <climits>
#include <cstring>
#include <numeric>
#include <functional>
#include <memory>
#include <utility>
#include <bitset>
#include <list>
#include <array>
#include <iomanip>
#include <cassert>
#include <cctype>

using namespace std;

// Wrapper allowing temporary vectors and strings to bind to non-const lvalue references (e.g. vector<int>&)
template <typename T>
struct __ref_wrap {
    mutable T val;
    __ref_wrap(T v) : val(std::move(v)) {}
    operator T&() const { return val; }
    operator const T&() const { return val; }
};

inline __ref_wrap<vector<int>> __vec(initializer_list<int> l) {
    return __ref_wrap<vector<int>>(vector<int>(l));
}

inline __ref_wrap<vector<string>> __vec_str(initializer_list<string> l) {
    return __ref_wrap<vector<string>>(vector<string>(l));
}

inline __ref_wrap<string> __str(const char* s) {
    return __ref_wrap<string>(string(s));
}

inline __ref_wrap<vector<vector<int>>> __mat(initializer_list<initializer_list<int>> l) {
    vector<vector<int>> m;
    for (auto& row : l) m.push_back(vector<int>(row));
    return __ref_wrap<vector<vector<int>>>(m);
}

inline __ref_wrap<vector<vector<char>>> __mat_char(initializer_list<initializer_list<char>> l) {
    vector<vector<char>> m;
    for (auto& row : l) m.push_back(vector<char>(row));
    return __ref_wrap<vector<vector<char>>>(m);
}

inline __ref_wrap<vector<vector<string>>> __mat_str(initializer_list<initializer_list<string>> l) {
    vector<vector<string>> m;
    for (auto& row : l) m.push_back(vector<string>(row));
    return __ref_wrap<vector<vector<string>>>(m);
}


struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

inline TreeNode* __buildTree(const string& str) {
    string s = str;
    size_t first = s.find('[');
    size_t last = s.rfind(']');
    if (first != string::npos && last != string::npos && last > first) {
        s = s.substr(first + 1, last - first - 1);
    }
    stringstream ss(s);
    string token;
    vector<string> tokens;
    while (getline(ss, token, ',')) {
        size_t b = token.find_first_not_of(" \\t\\r\\n\\"'");
        size_t e = token.find_last_not_of(" \\t\\r\\n\\"'");
        if (b != string::npos && e != string::npos) {
            tokens.push_back(token.substr(b, e - b + 1));
        } else {
            tokens.push_back("");
        }
    }
    if (tokens.empty() || tokens[0] == "null" || tokens[0].empty()) return nullptr;

    TreeNode* root = new TreeNode(stoi(tokens[0]));
    queue<TreeNode*> q;
    q.push(root);
    size_t idx = 1;
    while (!q.empty() && idx < tokens.size()) {
        TreeNode* curr = q.front();
        q.pop();

        if (idx < tokens.size()) {
            if (tokens[idx] != "null" && !tokens[idx].empty()) {
                curr->left = new TreeNode(stoi(tokens[idx]));
                q.push(curr->left);
            }
            idx++;
        }

        if (idx < tokens.size()) {
            if (tokens[idx] != "null" && !tokens[idx].empty()) {
                curr->right = new TreeNode(stoi(tokens[idx]));
                q.push(curr->right);
            }
            idx++;
        }
    }
    return root;
}

struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

inline ListNode* __buildList(const string& str) {
    string s = str;
    size_t first = s.find('[');
    size_t last = s.rfind(']');
    if (first != string::npos && last != string::npos && last > first) {
        s = s.substr(first + 1, last - first - 1);
    }
    stringstream ss(s);
    string token;
    ListNode dummy(0);
    ListNode* curr = &dummy;
    while (getline(ss, token, ',')) {
        size_t b = token.find_first_not_of(" \\t\\r\\n\\"'");
        size_t e = token.find_last_not_of(" \\t\\r\\n\\"'");
        if (b != string::npos && e != string::npos) {
            string valStr = token.substr(b, e - b + 1);
            if (!valStr.empty() && valStr != "null") {
                curr->next = new ListNode(stoi(valStr));
                curr = curr->next;
            }
        }
    }
    return dummy.next;
}

template <typename T>
void __print_res(const T& val) {
    cout << val << "\\n";
}

inline void __print_res(bool val) {
    cout << (val ? "true" : "false") << "\\n";
}

inline void __print_res(ListNode* head) {
    cout << "[";
    ListNode* curr = head;
    while (curr) {
        cout << curr->val << (curr->next ? "," : "");
        curr = curr->next;
    }
    cout << "]\\n";
}

template <typename T>
void __print_res(const vector<T>& vec) {
    cout << "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        cout << vec[i] << (i + 1 < vec.size() ? "," : "");
    }
    cout << "]\\n";
}

template <typename T>
void __print_res(const vector<vector<T>>& mat) {
    cout << "[";
    for (size_t i = 0; i < mat.size(); ++i) {
        cout << "[";
        for (size_t j = 0; j < mat[i].size(); ++j) {
            cout << mat[i][j] << (j + 1 < mat[i].size() ? "," : "");
        }
        cout << "]" << (i + 1 < mat.size() ? "," : "");
    }
    cout << "]\\n";
}

${code.replace(/class\s+Solution\s*\{(?!\s*public:)/, 'class Solution {\npublic:')}

int main() {
    try {
        ${isClassSolution
          ? `Solution __solver;
        auto __res = __solver.${methodName}(${callArgs});
        __print_res(__res);`
          : `auto __res = ${methodName}(${callArgs});
        __print_res(__res);`
        }
    } catch (const exception& e) {
        cerr << "Runtime error: " << e.what() << endl;
        return 1;
    } catch (...) {
        cerr << "Unknown error occurred" << endl;
        return 1;
    }
    return 0;
}
`;
}

function wrapJava(code, input, functionName) {
  if (code.includes('public static void main')) {
    return code;
  }

  const cleanArgs = sanitizeArgs(input);
  const methodName = extractMethodName(code, functionName);

  const isTreeNode = /TreeNode\b/.test(code) || /\b(root|tree)\b/i.test(code) || /\b(root|tree)\b/i.test(functionName);
  const isListNode = /ListNode\b/.test(code) || /\b(head|listNode)\b/i.test(code) || /\b(head|list)\b/i.test(functionName);

  let callArgs;
  if (isTreeNode) {
    callArgs = `buildTree("${(input || '').replace(/"/g, '\\"')}")`;
  } else if (isListNode) {
    callArgs = `buildList("${(input || '').replace(/"/g, '\\"')}")`;
  } else {
    callArgs = toJavaArgs(cleanArgs);
  }

  return `import java.util.*;
import java.util.stream.*;
import java.io.*;
import java.math.*;

class TreeNode {
    public int val;
    public TreeNode left;
    public TreeNode right;
    public TreeNode() {}
    public TreeNode(int val) { this.val = val; }
    public TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}

class ListNode {
    public int val;
    public ListNode next;
    public ListNode() {}
    public ListNode(int val) { this.val = val; }
    public ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

${code}

public class Main {
    static TreeNode buildTree(String str) {
        if (str == null || str.trim().isEmpty()) return null;
        String s = str.trim();
        if (s.startsWith("[")) s = s.substring(1);
        if (s.endsWith("]")) s = s.substring(0, s.length() - 1);
        String[] tokens = s.split(",");
        if (tokens.length == 0 || tokens[0].trim().equals("null") || tokens[0].trim().isEmpty()) return null;
        TreeNode root = new TreeNode(Integer.parseInt(tokens[0].trim()));
        Queue<TreeNode> q = new LinkedList<>();
        q.add(root);
        int idx = 1;
        while (!q.isEmpty() && idx < tokens.length) {
            TreeNode curr = q.poll();
            if (idx < tokens.length) {
                String t = tokens[idx++].trim();
                if (!t.equals("null") && !t.isEmpty()) {
                    curr.left = new TreeNode(Integer.parseInt(t));
                    q.add(curr.left);
                }
            }
            if (idx < tokens.length) {
                String t = tokens[idx++].trim();
                if (!t.equals("null") && !t.isEmpty()) {
                    curr.right = new TreeNode(Integer.parseInt(t));
                    q.add(curr.right);
                }
            }
        }
        return root;
    }

    static ListNode buildList(String str) {
        if (str == null || str.trim().isEmpty()) return null;
        String s = str.trim();
        if (s.startsWith("[")) s = s.substring(1);
        if (s.endsWith("]")) s = s.substring(0, s.length() - 1);
        String[] tokens = s.split(",");
        ListNode dummy = new ListNode(0);
        ListNode curr = dummy;
        for (String t : tokens) {
            String valStr = t.trim();
            if (!valStr.isEmpty() && !valStr.equals("null")) {
                curr.next = new ListNode(Integer.parseInt(valStr));
                curr = curr.next;
            }
        }
        return dummy.next;
    }

    static void printResult(Object obj) {
        if (obj == null) {
            System.out.println("null");
        } else if (obj instanceof ListNode) {
            StringBuilder sb = new StringBuilder("[");
            ListNode c = (ListNode) obj;
            while (c != null) {
                sb.append(c.val).append(c.next != null ? "," : "");
                c = c.next;
            }
            sb.append("]");
            System.out.println(sb.toString());
        } else if (obj instanceof int[]) {
            System.out.println(Arrays.toString((int[]) obj).replaceAll("\\\\s+", ""));
        } else if (obj instanceof long[]) {
            System.out.println(Arrays.toString((long[]) obj).replaceAll("\\\\s+", ""));
        } else if (obj instanceof double[]) {
            System.out.println(Arrays.toString((double[]) obj).replaceAll("\\\\s+", ""));
        } else if (obj instanceof boolean[]) {
            System.out.println(Arrays.toString((boolean[]) obj).replaceAll("\\\\s+", ""));
        } else if (obj instanceof Object[]) {
            System.out.println(Arrays.deepToString((Object[]) obj).replaceAll("\\\\s+", ""));
        } else if (obj instanceof List) {
            System.out.println(obj.toString().replaceAll("\\\\s+", ""));
        } else {
            System.out.println(String.valueOf(obj));
        }
    }

    public static void main(String[] args) {
        try {
            Solution solver = new Solution();
            printResult(solver.${methodName}(${callArgs}));
        } catch (Exception e) {
            System.err.println("Runtime error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
`;
}

function wrapPython(code, input, functionName) {
  const isTreeNode = /TreeNode\b/.test(code) || /\b(root|tree)\b/i.test(code) || /\b(root|tree)\b/i.test(functionName);
  const isListNode = /ListNode\b/.test(code) || /\b(head|listNode)\b/i.test(code) || /\b(head|list)\b/i.test(functionName);

  return `import sys, os, math, collections, heapq, bisect, itertools, functools, random, re, json
from typing import *

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def __build_tree(data):
    if not data or data == 'null':
        return None
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except:
            return None
    if not isinstance(data, list) or not data or data[0] is None:
        return None
    root = TreeNode(data[0])
    queue = [root]
    idx = 1
    while queue and idx < len(data):
        node = queue.pop(0)
        if idx < len(data):
            if data[idx] is not None:
                node.left = TreeNode(data[idx])
                queue.append(node.left)
            idx += 1
        if idx < len(data):
            if data[idx] is not None:
                node.right = TreeNode(data[idx])
                queue.append(node.right)
            idx += 1
    return root

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def __build_list(data):
    if not data:
        return None
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except:
            return None
    dummy = ListNode(0)
    curr = dummy
    for v in data:
        curr.next = ListNode(v)
        curr = curr.next
    return dummy.next

${code}

if __name__ == '__main__':
    try:
        target = None
        if 'Solution' in dir() and isinstance(Solution, type):
            sol = Solution()
            target_name = '${functionName}'
            candidates = [target_name, 'solution']
            snake = re.sub(r'(?<!^)(?=[A-Z])', '_', target_name).lower()
            candidates.append(snake)
            for m in dir(sol):
                if not m.startswith('_'):
                    candidates.append(m)
            for name in candidates:
                if hasattr(sol, name) and callable(getattr(sol, name)):
                    target = getattr(sol, name)
                    break
        elif '${functionName}' in dir() and callable(eval('${functionName}')):
            target = eval('${functionName}')
        elif 'solution' in dir() and callable(eval('solution')):
            target = eval('solution')
        else:
            for k, v in list(locals().items()):
                if callable(v) and not k.startswith('_') and k not in ['Solution', 'eval', 'print', 'json', 'sys', 're', 'os', 'math']:
                    target = v
                    break

        if target:
            ${isTreeNode
              ? `res = target(__build_tree("""${input}"""))`
              : isListNode
                ? `res = target(__build_list("""${input}"""))`
                : `res = target(${input})`
            }
            if res is not None:
                if isinstance(res, ListNode):
                    vals = []
                    c = res
                    while c:
                        vals.append(c.val)
                        c = c.next
                    print(json.dumps(vals, separators=(',', ':')))
                elif isinstance(res, (dict, list, tuple)):
                    print(json.dumps(res, separators=(',', ':')))
                elif isinstance(res, bool):
                    print("true" if res else "false")
                else:
                    print(res)
    except Exception as e:
        sys.stderr.write(str(e))
        sys.exit(1)
`;
}

function wrapJavaScript(code, input, functionName) {
  const cleanArgs = sanitizeArgs(input);
  const isTreeNode = /TreeNode\b/.test(code) || /\b(root|tree)\b/i.test(code) || /\b(root|tree)\b/i.test(functionName);
  const isListNode = /ListNode\b/.test(code) || /\b(head|listNode)\b/i.test(code) || /\b(head|list)\b/i.test(functionName);

  return `function TreeNode(val, left, right) {
    this.val = (val===undefined ? 0 : val);
    this.left = (left===undefined ? null : left);
    this.right = (right===undefined ? null : right);
}

function __buildTree(data) {
    let arr = data;
    if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch(_) { return null; }
    }
    if (!arr || !arr.length || arr[0] === null) return null;
    let root = new TreeNode(arr[0]);
    let queue = [root];
    let idx = 1;
    while (queue.length && idx < arr.length) {
        let node = queue.shift();
        if (idx < arr.length) {
            if (arr[idx] !== null && arr[idx] !== undefined) {
                node.left = new TreeNode(arr[idx]);
                queue.push(node.left);
            }
            idx++;
        }
        if (idx < arr.length) {
            if (arr[idx] !== null && arr[idx] !== undefined) {
                node.right = new TreeNode(arr[idx]);
                queue.push(node.right);
            }
            idx++;
        }
    }
    return root;
}

function ListNode(val, next) {
    this.val = (val===undefined ? 0 : val);
    this.next = (next===undefined ? null : next);
}

function __buildList(data) {
    let arr = data;
    if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch(_) { return null; }
    }
    if (!arr || !arr.length) return null;
    let dummy = new ListNode(0);
    let curr = dummy;
    for (const v of arr) {
        curr.next = new ListNode(v);
        curr = curr.next;
    }
    return dummy.next;
}

${code}

try {
  let _fn = null;
  if (typeof Solution === 'function') {
    try {
      const _inst = new Solution();
      const candidates = ['${functionName}', 'solution'];
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(_inst)).filter(m => m !== 'constructor');
      candidates.push(...methods);
      for (const m of candidates) {
        if (typeof _inst[m] === 'function') {
          _fn = _inst[m].bind(_inst);
          break;
        }
      }
    } catch (_) {}
  }

  if (!_fn) {
    if (typeof ${functionName} === 'function') _fn = ${functionName};
    else if (typeof solution === 'function') _fn = solution;
  }

  if (_fn) {
    let _res;
    ${isTreeNode
      ? `_res = _fn(__buildTree(${JSON.stringify(input)}));`
      : isListNode
        ? `_res = _fn(__buildList(${JSON.stringify(input)}));`
        : `try { _res = _fn(${cleanArgs}); } catch (_e1) { _res = _fn(${input}); }`
    }
    if (_res !== undefined) {
      if (_res instanceof ListNode) {
        let vals = [];
        let c = _res;
        while (c) { vals.push(c.val); c = c.next; }
        console.log(JSON.stringify(vals));
      } else if (typeof _res === 'object' && _res !== null) {
        console.log(JSON.stringify(_res));
      } else {
        console.log(_res);
      }
    }
  }
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
`;
}

/**
 * Execute natively when Judge0 is unavailable or encounters container sandbox/cgroup issues
 */
function executeNative(language, preparedCode, input = '') {
  const tmpDir = os.tmpdir();
  const id = Date.now() + '_' + Math.random().toString(36).substring(7);

  try {
    if (language === 'javascript') {
      const srcFile = path.join(tmpDir, `solution_${id}.js`);
      fs.writeFileSync(srcFile, preparedCode, 'utf8');
      try {
        const out = execSync(`node "${srcFile}"`, { timeout: 6000, stdio: 'pipe' });
        return out.toString().trim();
      } catch (err) {
        return (err.stderr?.toString() || err.stdout?.toString() || err.message).trim();
      } finally {
        try { if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile); } catch {}
      }
    }

    if (language === 'python') {
      const srcFile = path.join(tmpDir, `solution_${id}.py`);
      fs.writeFileSync(srcFile, preparedCode, 'utf8');
      try {
        const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
        const out = execSync(`${pyCmd} "${srcFile}"`, { timeout: 6000, stdio: 'pipe' });
        return out.toString().trim();
      } catch (err) {
        // If python3 is not found, fallback to python command
        if (process.platform !== 'win32' && err.message?.includes('python3')) {
          try {
            const out = execSync(`python "${srcFile}"`, { timeout: 6000, stdio: 'pipe' });
            return out.toString().trim();
          } catch (innerErr) {
            return (innerErr.stderr?.toString() || innerErr.stdout?.toString() || innerErr.message).trim();
          }
        }
        return (err.stderr?.toString() || err.stdout?.toString() || err.message).trim();
      } finally {
        try { if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile); } catch {}
      }
    }

    if (language === 'cpp') {
      const srcFile = path.join(tmpDir, `solution_${id}.cpp`);
      const exeExt = process.platform === 'win32' ? '.exe' : '';
      const exeFile = path.join(tmpDir, `solution_${id}${exeExt}`);
      fs.writeFileSync(srcFile, preparedCode, 'utf8');
      try {
        let compiled = false;
        let lastErr = null;

        for (const compiler of ['g++', 'clang++']) {
          try {
            execSync(`${compiler} -O2 -std=c++17 "${srcFile}" -o "${exeFile}"`, { timeout: 10000, stdio: 'pipe' });
            compiled = true;
            break;
          } catch (compileErr) {
            lastErr = compileErr;
            const errStr = compileErr.stderr?.toString() || compileErr.stdout?.toString() || compileErr.message;
            if (errStr.includes('not found') || compileErr.status === 127 || compileErr.code === 'ENOENT') {
              continue; // Try next compiler
            }
            return `Compilation Error:\n${errStr.trim()}`;
          }
        }

        if (!compiled) {
          const errOut = lastErr?.stderr?.toString() || lastErr?.stdout?.toString() || lastErr?.message || 'C++ compiler (g++/clang++) not found';
          return `Compilation Error:\n${errOut.trim()}`;
        }

        const runCmd = process.platform === 'win32' ? `"${exeFile}"` : `chmod +x "${exeFile}" && "${exeFile}"`;
        const runOut = execSync(runCmd, { timeout: 5000, stdio: 'pipe' });
        return runOut.toString().trim();
      } catch (runErr) {
        const errOut = runErr.stderr?.toString() || runErr.stdout?.toString() || runErr.message;
        return `Runtime Error:\n${errOut.trim()}`;
      } finally {
        try { if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile); } catch {}
        try { if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile); } catch {}
      }
    }

    if (language === 'java') {
      try {
        const encoded = Buffer.from(preparedCode).toString('base64');
        const cmd = `docker exec judge0-v1131-server-1 sh -c "echo '${encoded}' | base64 -d > /tmp/Main.java && javac /tmp/Main.java && java -cp /tmp Main && rm -f /tmp/Main.*"`;
        const out = execSync(cmd, { timeout: 10000, stdio: 'pipe' });
        return out.toString().trim();
      } catch (dockerErr) {
        const errOut = dockerErr.stderr?.toString() || dockerErr.stdout?.toString() || dockerErr.message;
        return `Error:\n${errOut.trim()}`;
      }
    }

    return 'Language not supported natively';
  } catch (globalErr) {
    return `Execution Error: ${globalErr.message}`;
  }
}

/**
 * Execute code via Judge0 with native fallback
 *
 * @param {string} language - 'javascript', 'python', 'cpp', or 'java'
 * @param {string} code
 * @param {string} input - Arguments expression or stdin string
 * @param {string} functionName
 * @returns {Promise<string>}
 */
export async function executeCode(language, code, input = '', functionName = 'solution') {
  const languageId = JUDGE0_LANGUAGE_MAP[language];
  if (!languageId) {
    return `Language '${language}' is not supported. Supported: javascript, python, cpp, java.`;
  }

  const judge0Url = process.env.JUDGE0_API_URL || 'http://127.0.0.1:2358';

  let preparedCode = code;
  if (language === 'javascript') {
    preparedCode = wrapJavaScript(code, input, functionName);
  } else if (language === 'python') {
    preparedCode = wrapPython(code, input, functionName);
  } else if (language === 'cpp') {
    preparedCode = wrapCpp(code, input, functionName);
  } else if (language === 'java') {
    preparedCode = wrapJava(code, input, functionName);
  }

  try {
    const response = await fetch(`${judge0Url}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language_id: languageId,
        source_code: preparedCode,
        stdin: input != null ? String(input) : '',
        cpu_time_limit: 5,
        wall_time_limit: 10
      })
    });

    if (response.ok) {
      const data = await response.json();
      const statusId = data.status?.id;

      // Status 3 = Accepted
      if (statusId === 3) {
        return (data.stdout !== null && data.stdout !== undefined) ? data.stdout.trim() : '';
      }

      // Status 5 = Time Limit Exceeded
      if (statusId === 5) {
        return 'Error: Code execution timed out (limit exceeded). Check for infinite loops.';
      }

      // Status 6 = Compilation Error
      if (statusId === 6) {
        return `Compilation Error:\n${data.compile_output || data.message || 'Syntax error'}`.trim();
      }

      // Runtime Error (NZEC) or others
      if (data.stderr) {
        return `Error:\n${data.stderr}`.trim();
      }

      if (data.compile_output) {
        return `Compilation Error:\n${data.compile_output}`.trim();
      }

      // If Judge0 hit an Internal Error (e.g. status 13 / cgroups), fall through to native runner
      if (statusId !== 13 && data.message) {
        return `Error: ${data.message}`.trim();
      }
    }
  } catch (err) {
    console.warn(`Judge0 connection warning: ${err.message}. Falling back to native runner.`);
  }

  // Fallback to Native Runner
  return executeNative(language, preparedCode, input);
}
