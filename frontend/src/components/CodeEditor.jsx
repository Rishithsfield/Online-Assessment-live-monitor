import React, { useRef, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';

export function CodeEditor({ value, onChange, onPaste, onMacroDetected, language = 'javascript', theme = 'vs', fontSize = 15.5 }) {
  const monaco = useMonaco();
  const lastTypeTime = useRef(Date.now());
  
  const onPasteRef = useRef(onPaste);
  const onMacroDetectedRef = useRef(onMacroDetected);
  const allowedClipboardTexts = useRef(new Set());

  useEffect(() => {
    onPasteRef.current = onPaste;
    onMacroDetectedRef.current = onMacroDetected;
  }, [onPaste, onMacroDetected]);
  
  const handleEditorMount = (editor, monaco) => {
    // We remove editor.onDidPaste because it fires for all pastes.
    // We will use onPasteCapture on the container instead to conditionally trigger the violation.

    // Detect fast typing / macros
    editor.onDidChangeModelContent((e) => {
      const changes = e.changes;
      if (changes && changes.length > 0) {
        // If a single change inserts a massive block of text, it might be a macro bypass
        const textLength = changes[0].text.length;
        if (textLength > 50 && e.isFlush === false) { // 50 chars instantly 
           const now = Date.now();
           if (now - lastTypeTime.current < 50) {
             if (onMacroDetectedRef.current) onMacroDetectedRef.current();
           }
        }
      }
      lastTypeTime.current = Date.now();
    });
  };

  const handleCopyButton = () => {
    navigator.clipboard.writeText(value);
    allowedClipboardTexts.current.add(value);
    toast.success('Code copied to clipboard', { icon: '📋' });
  };

  const handleContainerCopy = (e) => {
    const text = document.getSelection().toString();
    if (text) {
      allowedClipboardTexts.current.add(text);
    }
  };

  const handleContainerPaste = (e) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText && !allowedClipboardTexts.current.has(pastedText)) {
      if (onPasteRef.current) onPasteRef.current(); // Violation!
    }
  };

  return (
    <div 
      className="code-editor-container w-full h-full border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden bg-white dark:bg-slate-900 relative group"
      onCopy={handleContainerCopy}
      onPasteCapture={handleContainerPaste}
    >
      <button
        onClick={handleCopyButton}
        className="absolute top-4 right-6 z-10 p-2 bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg shadow-sm border border-slate-300 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 cursor-pointer"
        title="Copy code"
      >
        <Copy className="w-4 h-4" />
        <span className="text-xs font-semibold">Copy</span>
      </button>
      <Editor
        height="100%"
        language={language}
        theme={theme}
        value={value}
        onChange={onChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: fontSize,
          fontFamily: "'JetBrains Mono', monospace",
          padding: { top: 20 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on"
        }}
      />
    </div>
  );
}
