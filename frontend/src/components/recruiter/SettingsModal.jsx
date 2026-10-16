import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

export function SettingsModal({ settings, onClose, onSave }) {
  const [local, setLocal] = useState(JSON.parse(JSON.stringify(settings)));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
      <div className="refractive-glass rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-fade-up">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-black flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-500" /> Fraud Detection Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none cursor-pointer">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">Event Weights</h3>
              <p className="text-xs text-slate-400 mb-4">Points added to the risk score per occurrence.</p>
            </div>
            {[
              { key: 'blur', label: 'Blur / Tab Switch' },
              { key: 'paste', label: 'Paste Action' },
              { key: 'macro', label: 'Macro Detection' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-sm text-slate-700 dark:text-slate-300">{label}</label>
                <input type="number" min={0} max={100} value={local.weights[key]}
                  onChange={e => setLocal(p => ({ ...p, weights: { ...p.weights, [key]: Number(e.target.value) } }))}
                  className="w-20 px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono"
                />
              </div>
            ))}
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-850" />

          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-1">Thresholds</h3>
              <p className="text-xs text-slate-400 mb-4">Risk scores that escalate session alerts.</p>
            </div>
            {[
              { key: 'suspicious', label: 'Suspicious (amber)', ring: 'focus:ring-amber-400' },
              { key: 'danger', label: 'Danger (red)', ring: 'focus:ring-red-400' },
            ].map(({ key, label, ring }) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-sm text-slate-700 dark:text-slate-300">{label}</label>
                <input type="number" min={0} max={100} value={local.thresholds[key]}
                  onChange={e => setLocal(p => ({ ...p, thresholds: { ...p.thresholds, [key]: Number(e.target.value) } }))}
                  className={cn('w-20 px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 text-center font-mono', ring)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-black flex justify-end gap-3">
          <button onClick={onClose} className="oily-liquid-capsule px-4 py-2 text-sm font-semibold text-slate-650 dark:text-slate-300 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all duration-300 shadow-sm cursor-pointer">Cancel</button>
          <button onClick={() => onSave(local)} className="oily-liquid-capsule px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-750 transition-all duration-300 shadow-sm shadow-indigo-600/20 cursor-pointer">Save Changes</button>
        </div>
      </div>
    </div>
  );
}
