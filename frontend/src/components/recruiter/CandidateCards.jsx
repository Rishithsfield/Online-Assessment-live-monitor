import React from 'react';
import {
  Users, CheckCircle, Zap, Ban, Trophy, Eye, List, LayoutGrid
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const getScoreList = s => {
  if (!s?.scores) return [];
  if (s.scores instanceof Map) {
    return Array.from(s.scores.values()).filter(q => q && typeof q === 'object');
  }
  if (typeof s.scores === 'object') {
    return Object.entries(s.scores)
      .filter(([k]) => k !== 'final')
      .map(([, v]) => v)
      .filter(q => q && typeof q === 'object');
  }
  return [];
};

export const getPassed = s => getScoreList(s).reduce((sum, q) => sum + (Number(q?.passed) || 0), 0);
export const getTotal = s => getScoreList(s).reduce((sum, q) => sum + (Number(q?.total) || 0), 0);
export const getQuestionsPassed = s => getScoreList(s).filter(q => Number(q?.total) > 0 && Number(q?.passed) === Number(q?.total)).length;
export const getQuestionsTotal = (s, examTotal) => {
  if (examTotal && examTotal > 0) return examTotal;
  return Math.max(1, getScoreList(s).length);
};

export function ScoreBadge({ session, examTotal }) {
  const qPassed = getQuestionsPassed(session);
  const totalCases = getTotal(session);
  const passedCases = getPassed(session);
  const scoreList = getScoreList(session);
  if (scoreList.length === 0 && totalCases === 0) return null;

  const totalQs = examTotal || Math.max(1, scoreList.length);
  const isPerfect = totalQs > 0 && qPassed === totalQs;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        title={`${passedCases}/${totalCases} test cases passed`}
        className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs inline-flex items-center gap-1',
          isPerfect
            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
            : qPassed > 0
              ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
              : passedCases > 0
                ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
        )}
      >
        <span className="font-extrabold">{qPassed}/{totalQs}</span> Qs Solved
      </span>
      <span className="text-[9px] text-slate-400 font-mono">
        ({passedCases}/{totalCases} cases)
      </span>
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="refractive-glass rounded-2xl p-5 flex items-center gap-4 hover:scale-[1.02] hover:shadow-md transition-all duration-300">
      <div className={cn('w-11 h-11 icon-blob flex items-center justify-center shrink-0 border border-current/10', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-none">{value}</div>
        <div className="text-xs text-slate-550 dark:text-slate-400 mt-2 font-bold tracking-wider uppercase">{label}</div>
        {sub && <div className="text-[10px] text-slate-450 dark:text-slate-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 icon-blob bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-6">
        <Users className="w-9 h-9 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No candidates yet</h3>
      <p className="text-sm text-slate-400 max-w-xs">
        Candidates will appear here once they join the exam. Share the portal URL to get started.
      </p>
    </div>
  );
}

export function TopPerformersWidget({ sessionsList, examTotal }) {
  const sorted = [...sessionsList].sort((a, b) => {
    const qDiff = getQuestionsPassed(b) - getQuestionsPassed(a);
    if (qDiff !== 0) return qDiff;
    const diff = getPassed(b) - getPassed(a);
    if (diff !== 0) return diff;
    return a.fraudScore - b.fraudScore;
  });
  const top3 = sorted.slice(0, 3);
  if (top3.length === 0) return null;

  const medals = ['🥇', '🥈', '🥉'];
  const borders = ['border-amber-300 dark:border-amber-700/50', 'border-slate-300 dark:border-slate-700', 'border-orange-300 dark:border-orange-700/50'];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-bold uppercase tracking-widest">Top Performers</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((s, i) => (
          <div key={s.id} className={cn(
            'refractive-glass rounded-2xl border-2 shadow-sm p-5 flex items-center gap-4 hover:scale-[1.02] transition-all duration-300',
            borders[i]
          )}>
            <span className="text-2xl shrink-0">{medals[i]}</span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">{s.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  {getQuestionsPassed(s)}/{examTotal || getQuestionsTotal(s, examTotal)} Qs Solved
                </span>
                <span className="text-[10px] text-slate-400 pl-2 border-l border-slate-200 dark:border-slate-700">
                  {getPassed(s)} cases • Risk: {s.fraudScore}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CandidateCard({ session, onLockout, onViewCode, settings, examTotal }) {
  const isDanger = session.fraudScore >= settings.thresholds.danger;
  const isWarning = session.fraudScore >= settings.thresholds.suspicious && !isDanger;

  return (
    <div className={cn(
      'refractive-glass rounded-2xl flex flex-col overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.02]',
      isDanger ? 'border-red-400/40 dark:border-red-500/30' :
        isWarning ? 'border-amber-400/40 dark:border-amber-500/30' : '',
      session.status === 'disqualified' && 'opacity-55 grayscale'
    )}>
      {/* Card header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{session.name}</h3>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{session.id.slice(-10)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
          <span className={cn('text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border',
            session.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' :
              session.status === 'submitted' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20' :
                'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
          )}>{session.status}</span>
          <ScoreBadge session={session} examTotal={examTotal} />
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4">
        {/* Risk bar */}
        <div>
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span>Risk Index</span>
            <span className={cn(
              isDanger ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
            )}>{session.fraudScore}/100</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700',
                isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-500'
              )}
              style={{ width: `${session.fraudScore}%` }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'BLUR', val: session.stats.blur, alert: session.stats.blur > 2 },
            { label: 'PASTE', val: session.stats.paste, alert: session.stats.paste > 0 },
            { label: 'MACRO', val: session.stats.macro, alert: session.stats.macro > 0 },
            { label: 'COPY', val: session.stats.copy || 0, alert: (session.stats.copy || 0) > 0 },
          ].map(({ label, val, alert }) => (
            <div key={label} className={cn(
              'flex flex-col items-center p-2 rounded-xl border text-center',
              alert
                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400'
            )}>
              <span className="text-[9px] font-bold tracking-widest">{label}</span>
              <span className="text-base font-bold mt-0.5">{val}</span>
            </div>
          ))}
        </div>

        {/* Code preview */}
        <div
          onClick={onViewCode}
          className="flex-1 bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-3 font-mono text-[10px] text-slate-400 overflow-hidden relative cursor-pointer hover:border-indigo-500/40 transition-colors group min-h-[56px]"
        >
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <pre className="whitespace-pre-wrap line-clamp-3">{session.code || '// No code yet'}</pre>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={onViewCode}
          className="flex-1 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-bold tracking-widest transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" /> VIEW
        </button>
        <button
          disabled={session.status === 'disqualified'}
          onClick={() => onLockout(session.id)}
          className="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-xs font-bold tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Ban className="w-3.5 h-3.5" /> LOCKOUT
        </button>
      </div>
    </div>
  );
}

export function CandidateLeaderboard({ sessionsList, onViewCode, onLockout, examTotal }) {
  const sorted = [...sessionsList].sort((a, b) => {
    const qDiff = getQuestionsPassed(b) - getQuestionsPassed(a);
    if (qDiff !== 0) return qDiff;
    const diff = getPassed(b) - getPassed(a);
    if (diff !== 0) return diff;
    if (a.fraudScore !== b.fraudScore) return a.fraudScore - b.fraudScore;
    if (a.status === 'submitted' && b.status !== 'submitted') return -1;
    if (b.status === 'submitted' && a.status !== 'submitted') return 1;
    return 0;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-bold tracking-widest">Rank</th>
              <th className="px-6 py-4 font-bold tracking-widest">Candidate</th>
              <th className="px-6 py-4 font-bold tracking-widest text-center">Status</th>
              <th className="px-6 py-4 font-bold tracking-widest text-center">Score / Solved</th>
              <th className="px-6 py-4 font-bold tracking-widest text-center">Risk</th>
              <th className="px-6 py-4 font-bold tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-sm">No candidates yet.</td></tr>
            ) : (
              sorted.map((s, i) => (
                <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-slate-400">#{i + 1}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{s.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">{s.id.slice(-10)}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold uppercase',
                      s.status === 'submitted' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' :
                        s.status === 'disqualified' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' :
                          'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                    )}>{s.status}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="font-bold text-slate-700 dark:text-slate-300">
                      {getQuestionsPassed(s)} / {examTotal || getQuestionsTotal(s, examTotal)} Qs
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ({getPassed(s)} / {getTotal(s) || 0} cases)
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn('font-bold',
                      s.fraudScore >= 75 ? 'text-red-500' :
                        s.fraudScore >= 40 ? 'text-amber-500' : 'text-emerald-500'
                    )}>{s.fraudScore}</span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => onViewCode(s.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold tracking-widest transition-colors cursor-pointer">
                      VIEW
                    </button>
                    <button onClick={() => onLockout(s.id)} disabled={s.status === 'disqualified'}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-bold tracking-widest transition-colors disabled:opacity-40 cursor-pointer">
                      LOCKOUT
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
