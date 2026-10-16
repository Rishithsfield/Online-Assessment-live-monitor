import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export function FraudActivityChart({ alerts, theme }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const buckets = Array.from({ length: 8 }, (_, i) => {
        const end = now - i * 10000;
        const start = end - 10000;
        return {
          time: new Date(end).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
          anomalies: alerts.filter(a => a.timestamp >= start && a.timestamp < end).length
        };
      }).reverse();
      setData(buckets);
    };
    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, [alerts]);

  const isDark = theme === 'dark';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 h-56 flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            Real-Time Anomaly Activity
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Suspicious events per 10-second window</p>
        </div>
        <div className="text-2xl font-bold text-red-500 dark:text-red-400">
          {alerts.length}
          <span className="text-xs text-slate-400 font-normal ml-1">total alerts</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 0, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={isDark ? 0.15 : 0.1} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f8fafc'} />
            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: isDark ? '#475569' : '#94a3b8' }} dy={8} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: isDark ? '#475569' : '#94a3b8' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderRadius: '8px', border: `1px solid ${isDark ? '#1e293b' : '#f1f5f9'}`, fontSize: '12px' }}
              itemStyle={{ color: '#4f46e5', fontWeight: 600 }}
              labelStyle={{ color: isDark ? '#94a3b8' : '#64748b' }}
            />
            <Area type="monotone" dataKey="anomalies" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#cg)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
