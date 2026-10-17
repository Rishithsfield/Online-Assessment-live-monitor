import React from 'react';
import {
  TerminalSquare, Clock, LogOut, ChevronLeft, ChevronRight, CheckCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const SUPPORTED_LANGUAGES = [
  { id: 'javascript', name: 'JavaScript (Node.js)' },
  { id: 'python',     name: 'Python 3'             },
  { id: 'cpp',        name: 'C++ (GCC)'            },
  { id: 'java',       name: 'Java (OpenJDK)'       },
];

export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CandidateHeader({
  candidateName,
  language,
  onLanguageChange,
  timeLeft,
  onExitClick,
}) {
  const isTimeCritical = timeLeft <= 300; // last 5 minutes

  return (
    <header className="h-16 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-black px-6 flex items-center justify-between shrink-0 shadow-sm text-slate-800 dark:text-slate-100">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 icon-blob shadow-md shadow-indigo-600/20">
          <TerminalSquare className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="font-semibold text-slate-800 dark:text-slate-100 leading-tight text-sm">Algorithm Assessment</h1>
          <p className="text-[11px] text-slate-400">Candidate: <span className="font-medium text-slate-600 dark:text-slate-300">{candidateName}</span></p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Language selector */}
        <select
          value={language}
          onChange={onLanguageChange}
          className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
        >
          {SUPPORTED_LANGUAGES.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        {/* Timer */}
        <div className={cn(
          'flex items-center gap-2 px-4 py-1.5 rounded-lg border font-mono font-semibold text-sm transition-colors',
          isTimeCritical
            ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400'
        )}>
          <Clock className="w-4 h-4" />
          {formatTime(timeLeft)}
        </div>

        {/* Exit */}
        <button
          onClick={onExitClick}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-650 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Exit
        </button>
      </div>
    </header>
  );
}

export function QuestionNavigation({
  questions,
  currentIndex,
  onSwitchQuestion,
  submittedScores,
}) {
  if (!questions || questions.length === 0) {
    return (
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Questions (0)</span>
        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
          Waiting for Questions
        </span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
      <button
        onClick={() => onSwitchQuestion(currentIndex - 1)}
        disabled={currentIndex === 0}
        className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-30 text-slate-500 transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-1.5">
        {questions.map((q, i) => {
          const score = submittedScores[q.id];
          const passed = score && score.passed > 0;
          return (
            <button
              key={q.id}
              onClick={() => onSwitchQuestion(i)}
              className={cn(
                'relative w-7 h-7 rounded-full text-xs font-bold transition-all border cursor-pointer',
                i === currentIndex
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : passed
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
              )}
            >
              {passed && i !== currentIndex && (
                <CheckCircle className="absolute -top-1 -right-1 w-3.5 h-3.5 text-emerald-500 bg-white rounded-full" />
              )}
              {i + 1}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSwitchQuestion(currentIndex + 1)}
        disabled={currentIndex === questions.length - 1}
        className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-30 text-slate-500 transition-colors cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
