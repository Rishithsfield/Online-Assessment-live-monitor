import React from 'react';
import {
  TerminalSquare, Loader2, CheckCircle, XCircle, Play, Upload
} from 'lucide-react';

export function TerminalPanel({
  output,
  onClose,
  onRun,
  onSubmit,
  isRunning
}) {
  return (
    <>
      {output && (
        <div className="mx-4 mb-2 bg-black rounded-xl border border-zinc-800 flex flex-col overflow-hidden max-h-52">
          <div className="h-8 bg-zinc-950 flex items-center px-4 border-b border-zinc-800 shrink-0">
            <div className="flex gap-1.5 mr-3">
              <button
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer"
              />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <TerminalSquare className="w-3.5 h-3.5 text-slate-400 mr-2" />
            <span className="text-xs font-mono text-slate-400">Output</span>
          </div>

          <div className="p-4 overflow-y-auto font-mono text-sm flex-1 custom-scrollbar">
            {output.type === 'running' && (
              <div className="text-indigo-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Evaluating solution...
              </div>
            )}

            {output.type === 'run_result' && (
              <div className="space-y-3">
                <div className="text-slate-400 text-xs mb-2">
                  Sample results ({output.results.filter(r => r.passed).length}/{output.results.length} passed)
                </div>
                {output.results.map((tc, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Case {i + 1}</span>
                      {tc.passed
                        ? <span className="text-emerald-400 text-xs font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Passed</span>
                        : <span className="text-red-400 text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</span>}
                    </div>
                    <div className="text-xs space-y-0.5">
                      <div className="text-slate-400">Input: <span className="text-slate-200">{tc.input}</span></div>
                      <div className="text-slate-400">Expected: <span className="text-emerald-300">{tc.expectedOutput}</span></div>
                      {!tc.passed && <div className="text-slate-400">Got: <span className="text-red-300">{tc.actualOutput}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {output.type === 'submit_result' && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                {output.failedTestCase ? (
                  <div className="w-full text-left space-y-2">
                    <div className="text-red-400 flex items-center gap-2 font-semibold"><XCircle className="w-4 h-4" /> Some cases failed</div>
                    <div className="text-slate-300 text-sm">Passed {output.passed} / {output.total} testcases</div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-xs space-y-1">
                      <div className="text-slate-400">Input: <span className="text-slate-200">{output.failedTestCase.input}</span></div>
                      <div className="text-slate-400">Expected: <span className="text-emerald-300">{output.failedTestCase.expectedOutput}</span></div>
                      <div className="text-slate-400">Got: <span className="text-red-300">{output.failedTestCase.actualOutput}</span></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                    <div className="text-emerald-400 font-bold text-lg">All Testcases Passed!</div>
                    <div className="text-3xl font-bold text-emerald-400 font-mono">
                      {output.passed}<span className="text-slate-500 text-xl"> / {output.total}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 py-3 flex items-center justify-between shrink-0 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">Ctrl+'</kbd>
          <span>Run</span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">Ctrl+Enter</kbd>
          <span>Submit</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRun}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Code
          </button>
          <button
            onClick={onSubmit}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-indigo-600/20 cursor-pointer"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Submit Answer
          </button>
        </div>
      </div>
    </>
  );
}
