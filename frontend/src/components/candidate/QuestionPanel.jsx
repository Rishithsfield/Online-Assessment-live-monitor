import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export function QuestionPanel({ question, score }) {
  if (!question) {
    return (
      <div className="text-center text-slate-400 mt-16 p-6 space-y-3">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-500 border border-slate-200">
          <Clock className="w-6 h-6 opacity-60 animate-pulse" />
        </div>
        <h3 className="text-sm font-bold text-slate-700">No Questions Added Yet</h3>
        <p className="text-xs text-slate-450 max-w-xs mx-auto leading-relaxed">
          The proctor has not configured any questions for this assessment yet. Once added in the recruiter console, they will display here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-slate-800 leading-tight">{question.title}</h2>
        {score && (
          <span className={cn(
            'shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border',
            score.passed === score.total
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : 'bg-amber-50 text-amber-600 border-amber-200'
          )}>
            {score.passed}/{score.total} ✓
          </span>
        )}
      </div>

      <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap mb-6">
        {question.text}
      </p>

      {question.constraints && (
        <div className="mb-5">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Constraints</h3>
          <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 text-xs font-mono text-amber-800 whitespace-pre-wrap">
            {question.constraints}
          </div>
        </div>
      )}

      <div className="mb-5">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Expected Function</h3>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-sm font-mono text-indigo-700">
          {question.functionName || 'solution'}
        </div>
      </div>

      {Array.isArray(question.testcases) && question.testcases.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            Sample Test Cases ({question.testcases.length})
          </h3>
          <div className="space-y-2">
            {question.testcases.map((tc, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Case {idx + 1}
                </div>
                <div className="text-slate-500">Input: <span className="text-slate-700">{tc.input}</span></div>
                <div className="text-slate-500 mt-1">Output: <span className="text-emerald-700">{tc.expectedOutput}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
