import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import {
  AlertCircle, ShieldAlert, Activity, Users, LayoutGrid, Terminal,
  LogOut, Download, Moon, Sun, Settings, XCircle, Play, List,
  Trophy, Copy, CheckCircle, Zap, Clock, BarChart2, Plus, Trash2,
  Eye, Ban, RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Editor, { DiffEditor } from '@monaco-editor/react';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

// ── Helpers ──────────────────────────────────────────────────────────────────
const getPassed = s => !s.scores ? 0 : Object.values(s.scores).reduce((sum, q) => sum + (q?.passed || 0), 0);
const getTotal = s => !s.scores ? 0 : Object.values(s.scores).reduce((sum, q) => sum + (q?.total || 0), 0);

function ScoreBadge({ session }) {
  const passed = getPassed(session);
  const total = getTotal(session);
  if (total === 0) return null;
  const pct = total ? (passed / total) : 0;
  return (
    <span className={cn(
      'text-[10px] font-bold px-2 py-0.5 rounded-full border',
      pct === 1 ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
        pct >= 0.5 ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
          'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
    )}>
      {passed}/{total}
    </span>
  );
}

// ── Real-time Anomaly Chart ───────────────────────────────────────────────────
function FraudActivityChart({ alerts, theme }) {
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

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }) {
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

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
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

function InviteCodesTab({ auth, socket }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchInvites = async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/invites', {
        headers: {
          'Authorization': `Bearer ${auth.token}`
        }
      });
      const data = await res.json();
      if (res.ok) setInvites(data);
    } catch (err) {
      console.error('Failed to fetch invites:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!auth?.token) return;
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.token}`
        }
      });
      if (res.ok) {
        toast.success('Generated new access code!', { icon: '🔑' });
        fetchInvites();
      }
    } catch (err) {
      console.error('Failed to generate invite:', err);
    }
  };

  useEffect(() => {
    fetchInvites();
    if (socket) {
      const handleReset = () => {
        setInvites([]);
      };
      socket.on('invites_reset', handleReset);
      return () => {
        socket.off('invites_reset', handleReset);
      };
    }
  }, [socket]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
      <button
        onClick={handleGenerate}
        className="w-full py-3 oily-liquid-capsule bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-650 dark:text-indigo-400 border border-indigo-400/40 text-xs font-bold tracking-wider uppercase transition-all duration-300 shadow-sm cursor-pointer"
      >
        Generate Access Code
      </button>

      <div className="space-y-2">
        {loading && invites.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-6">Loading codes...</div>
        ) : invites.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-6">No access codes generated yet</div>
        ) : (
          invites.map((invite) => (
            <div key={invite._id} className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-805 p-3 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-mono font-bold text-slate-855 dark:text-slate-200 bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 px-2 py-1 rounded">
                  {invite.code}
                </div>
                <div className="text-[10px] text-slate-450 dark:text-slate-500 mt-1">
                  {invite.status === 'used' ? `Used: ${invite.usedBy?.slice(-8) || ''}` : 'Active / Unused'}
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(invite.code);
                  toast.success('Code copied to clipboard!', { icon: '📋' });
                }}
                className="p-1.5 text-slate-450 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-50 cursor-pointer text-xs"
              >
                Copy
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function RecruiterConsole() {
  const { auth, socket, logout } = useSocket();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState(new Map());
  const [alerts, setAlerts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('candidates');
  const [theme, setTheme] = useState(() => localStorage.getItem('recruiter_theme') || 'light');
  const [viewMode, setViewMode] = useState('grid');
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [settings, setSettings] = useState({
    weights: { blur: 15, paste: 25, macro: 40 },
    thresholds: { suspicious: 40, danger: 75 }
  });
  const [exam, setExam] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [examStarted, setExamStarted] = useState(false);

  useEffect(() => {
    localStorage.setItem('recruiter_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const sidebarTabRef = useRef(sidebarTab);
  useEffect(() => {
    sidebarTabRef.current = sidebarTab;
    if (sidebarTab === 'telemetry') setUnreadAlerts(0);
  }, [sidebarTab]);

  // ── Socket setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth || auth.role !== 'recruiter') { navigate('/'); return; }
    if (!socket) return;

    // Fix B2: correct event name + Fix B5: fetch settings/exam after join confirms
    socket.emit('join_recruiter');

    // initial_state is now emitted by server right after join_recruiter
    socket.on('initial_state', (initialSessions) => {
      const map = new Map();
      initialSessions.forEach(s => map.set(s.id, s));
      setSessions(map);
      if (initialSessions.length === 0) {
        setAlerts([]);
        setActivities([]);
      }
    });

    // Fetch settings & exam (server is ready by now)
    socket.emit('get_settings', (data) => { if (data) setSettings(data); });
    socket.emit('get_exam', (data) => {
      if (data) {
        setExam(data);
        setExamStarted(data.status === 'active');
      }
    });

    socket.on('settings_updated', (data) => { if (data) setSettings(data); });

    socket.on('exam_updated', (data) => {
      if (data) { setExam(data); setExamStarted(data.status === 'active'); }
    });

    socket.on('exam_started', (data) => {
      if (data) { setExam(data); setExamStarted(true); }
    });

    socket.on('session_updated', (session) => {
      setSessions(prev => {
        const next = new Map(prev);
        next.set(session.id, session);
        return next;
      });
    });

    socket.on('candidate_activity', (a) => {
      setActivities(prev => [a, ...prev].slice(0, 150));
    });

    socket.on('fraud_alert_triggered', (alertData) => {
      setAlerts(prev => [alertData, ...prev].slice(0, 100));
      toast.error(`🚨 ${alertData.candidateName} — ${alertData.eventType} (score: ${alertData.fraudScore})`, {
        style: { borderRadius: '12px', background: '#0f172a', color: '#f1f5f9', border: '1px solid #1e293b' },
        duration: 5000
      });
      if (sidebarTabRef.current !== 'telemetry') {
        setUnreadAlerts(prev => prev + 1);
      }
    });

    return () => {
      socket.off('initial_state');
      socket.off('session_updated');
      socket.off('fraud_alert_triggered');
      socket.off('candidate_activity');
      socket.off('settings_updated');
      socket.off('exam_updated');
      socket.off('exam_started');
    };
  }, [auth, socket, navigate]);

  const handleLockout = useCallback((sessionId) => {
    if (socket) socket.emit('force_lockout', { sessionId });
  }, [socket]);

  const handleLogout = () => { logout(); navigate('/'); };

  const sessionsList = [...sessions.values()];
  const activeCount = sessionsList.filter(s => s.status === 'active').length;
  const submittedCount = sessionsList.filter(s => s.status === 'submitted').length;
  const disqualCount = sessionsList.filter(s => s.status === 'disqualified').length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={cn('h-screen font-sans flex flex-col overflow-hidden transition-colors duration-300',
      theme === 'dark' ? 'dark bg-black text-slate-100' : 'bg-[#f8f9fb] text-slate-800'
    )}>

      {/* ── Header ── */}
      <header className="h-16 border-b border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-black/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 icon-blob flex items-center justify-center shadow-md shadow-indigo-600/20">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-extrabold tracking-tight text-slate-800 dark:text-slate-100 text-lg">
            Live Monitor
            <span className="text-slate-400 dark:text-slate-500 ml-2 font-mono text-xs font-normal">v2.0</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {/* Exam controls */}
          {exam && exam.status === 'draft' && (
            <button
              onClick={() => {
                socket?.emit('start_exam');
                toast.success('Exam started — candidates can now code!', { icon: '🚀' });
              }}
              className="oily-liquid-capsule flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-400/40 text-xs font-bold tracking-widest transition-all duration-300 shadow-sm cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              START EXAM
            </button>
          )}
          {exam && exam.status === 'active' && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-250/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                EXAM LIVE
              </span>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to end the exam? All active candidate sessions will be automatically submitted.')) {
                    socket?.emit('end_exam');
                    toast.success('Exam ended successfully!');
                  }
                }}
                className="oily-liquid-capsule flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-650 dark:text-red-400 border border-red-400/40 text-xs font-bold tracking-widest transition-all duration-300 shadow-sm cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                END EXAM
              </button>
            </div>
          )}
          {exam && exam.status === 'finished' && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold">
                EXAM FINISHED
              </span>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to reset the exam? This will permanently delete all candidate sessions and telemetry data to start a new fresh session.')) {
                    socket?.emit('reset_exam');
                    toast.success('Exam reset to draft!');
                  }
                }}
                className="oily-liquid-capsule flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/40 text-xs font-bold tracking-widest transition-all duration-300 shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                RESET EXAM
              </button>
            </div>
          )}

          {/* Session counts */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-full text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</span> active
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{submittedCount}</span> submitted
            {disqualCount > 0 && <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="font-bold text-red-600 dark:text-red-400">{disqualCount}</span> disqualified
            </>}
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

          <button onClick={() => setShowSettingsModal(true)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all duration-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 transition-all duration-300 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-72 bg-white dark:bg-black border-r border-slate-100 dark:border-slate-800/80 flex flex-col shrink-0">
          {/* Sidebar tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 shrink-0">
            {[
              { id: 'candidates', label: 'Candidates' },
              { id: 'activity', label: 'Activity' },
              { id: 'telemetry', label: 'Alerts', badge: unreadAlerts },
              { id: 'invites', label: 'Invites' },
              { id: 'exam_setup', label: 'Setup' },
            ].map(({ id, label, badge }) => (
              <button
                key={id}
                onClick={() => setSidebarTab(id)}
                className={cn(
                  'relative flex-1 py-3 text-[9px] font-bold uppercase tracking-widest text-center border-b-2 transition-colors',
                  sidebarTab === id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                )}
              >
                {label}
                {badge > 0 && (
                  <span className="absolute top-2 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Candidates list */}
          {sidebarTab === 'candidates' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {sessionsList.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-10">No candidates have joined yet</div>
              ) : (
                sessionsList.map(session => {
                  const isDanger = session.fraudScore >= settings.thresholds.danger;
                  const isWarning = session.fraudScore >= settings.thresholds.suspicious && !isDanger;
                  return (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      className="w-full p-3 rounded-xl border text-left transition-all hover:shadow-md group bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-500/30"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate max-w-[140px]">
                            {session.name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{session.id.slice(-8)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={cn(
                            'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                            session.status === 'disqualified' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' :
                              session.status === 'submitted' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' :
                                isDanger ? 'bg-red-50 dark:bg-red-900/20 text-red-500' :
                                  isWarning ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' :
                                    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          )}>
                            {session.status === 'disqualified' ? 'OUT' :
                              session.status === 'submitted' ? 'DONE' :
                                isDanger ? 'DANGER' :
                                  isWarning ? 'WARN' : 'ACTIVE'}
                          </span>
                          <ScoreBadge session={session} />
                        </div>
                      </div>
                      {/* Fraud bar */}
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                          <span>Risk</span>
                          <span className={cn(
                            'font-bold',
                            isDanger ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                          )}>{session.fraudScore}</span>
                        </div>
                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500',
                              isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                            )}
                            style={{ width: `${session.fraudScore}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Activity feed */}
          {sidebarTab === 'activity' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {activities.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-10">No candidate activity yet</div>
              ) : (
                activities.map((a, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-xl shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{a.candidateName}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">{new Date(a.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span className={cn('font-bold uppercase tracking-wide text-[9px] mr-1.5',
                        a.type === 'submit' ? 'text-indigo-500' :
                          a.type === 'run' ? 'text-emerald-500' :
                            a.type === 'violation' ? 'text-red-500' : 'text-slate-400'
                      )}>{a.type}</span>
                      {a.message}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Invites tab */}
          {sidebarTab === 'invites' && (
            <InviteCodesTab auth={auth} socket={socket} />
          )}

          {/* Telemetry alerts */}
          {sidebarTab === 'telemetry' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {alerts.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-10 space-y-2">
                  <CheckCircle className="w-8 h-8 mx-auto text-slate-200 dark:text-slate-700" />
                  <p>No anomalies detected</p>
                </div>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 uppercase">
                        {a.eventType}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.candidateName}</div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Risk Score</span>
                      <span className={cn('font-bold', a.fraudScore >= 75 ? 'text-red-500' : 'text-amber-500')}>
                        {a.fraudScore}/100
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Exam Setup in sidebar (hidden — rendered in main panel) */}
          {sidebarTab === 'exam_setup' && (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-slate-400 text-center">Configure the exam in the main panel →</p>
            </div>
          )}
        </aside>

        {/* ── Main Panel ── */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#f8f9fb] dark:bg-black">
          {sidebarTab === 'exam_setup' ? (
            <div className="p-8">
              <ExamSetupPanel
                exam={exam}
                onSave={(newExam) => {
                  socket?.emit('update_exam', newExam);
                  toast.success('Exam updated!');
                }}
              />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Stat strip */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Active Candidates" value={activeCount} icon={Users} color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
                <StatCard label="Submitted" value={submittedCount} icon={CheckCircle} color="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" />
                <StatCard label="Fraud Alerts" value={alerts.length} icon={Zap} color="bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400" />
                <StatCard label="Disqualified" value={disqualCount} icon={Ban} color="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" />
              </div>

              {/* Anomaly chart */}
              <FraudActivityChart alerts={alerts} theme={theme} />

              {/* Top Performers */}
              <TopPerformersWidget sessionsList={sessionsList} />

              {/* View toggle */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                  {viewMode === 'grid' ? 'Session Matrix' : 'Leaderboard'}
                </h2>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  {[['grid', LayoutGrid], ['list', List]].map(([id, Icon]) => (
                    <button
                      key={id}
                      onClick={() => setViewMode(id)}
                      className={cn('p-1.5 rounded-lg transition-colors',
                        viewMode === id ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Sessions */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {sessionsList.length === 0 ? (
                    <EmptyState />
                  ) : (
                    sessionsList.map(s => (
                      <CandidateCard
                        key={s.id}
                        session={s}
                        onLockout={handleLockout}
                        onViewCode={() => setSelectedSessionId(s.id)}
                        settings={settings}
                      />
                    ))
                  )}
                </div>
              ) : (
                <CandidateLeaderboard
                  sessionsList={sessionsList}
                  onViewCode={setSelectedSessionId}
                  onLockout={handleLockout}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Live Code Modal */}
      {selectedSessionId && sessions.has(selectedSessionId) && (
        <LiveCodeModal
          session={sessions.get(selectedSessionId)}
          exam={exam}
          onClose={() => setSelectedSessionId(null)}
          onLockout={handleLockout}
          theme={theme}
          settings={settings}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettingsModal(false)}
          onSave={(s) => {
            socket?.emit('update_settings', s);
            setShowSettingsModal(false);
            toast.success('Settings saved and scores recalculated.');
          }}
        />
      )}
    </div>
  );
}

// ── Top Performers ─────────────────────────────────────────────────────────────
function TopPerformersWidget({ sessionsList }) {
  const sorted = [...sessionsList].sort((a, b) => {
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
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{getPassed(s)} passed</span>
                <span className="text-[10px] text-slate-400 pl-2 border-l border-slate-200 dark:border-slate-700">Risk: {s.fraudScore}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Candidate Card ─────────────────────────────────────────────────────────────
function CandidateCard({ session, onLockout, onViewCode, settings }) {
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
          <ScoreBadge session={session} />
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
          className="flex-1 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-bold tracking-widest transition-colors flex items-center justify-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" /> VIEW
        </button>
        <button
          disabled={session.status === 'disqualified'}
          onClick={() => onLockout(session.id)}
          className="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-xs font-bold tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <Ban className="w-3.5 h-3.5" /> LOCKOUT
        </button>
      </div>
    </div>
  );
}

// ── Leaderboard ────────────────────────────────────────────────────────────────
function CandidateLeaderboard({ sessionsList, onViewCode, onLockout }) {
  const sorted = [...sessionsList].sort((a, b) => {
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
              <th className="px-6 py-4 font-bold tracking-widest text-center">Score</th>
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
                    <span className="font-bold text-slate-700 dark:text-slate-300">{getPassed(s)}</span>
                    <span className="text-slate-400"> / {getTotal(s) || '?'}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn('font-bold',
                      s.fraudScore >= 75 ? 'text-red-500' :
                        s.fraudScore >= 40 ? 'text-amber-500' : 'text-emerald-500'
                    )}>{s.fraudScore}</span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => onViewCode(s.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold tracking-widest transition-colors">
                      VIEW
                    </button>
                    <button onClick={() => onLockout(s.id)} disabled={s.status === 'disqualified'}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-bold tracking-widest transition-colors disabled:opacity-40">
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

// ── Live Code Modal ───────────────────────────────────────────────────────────
function LiveCodeModal({ session, exam, onClose, onLockout, theme, settings }) {
  const isDanger = session.fraudScore >= settings.thresholds.danger;

  // Build per-question history tabs from codeHistory
  const questionTabs = exam?.questions?.map(q => {
    const hist = session.codeHistory?.find(h => h.questionId === q.id);
    return { ...q, submission: hist };
  }) || [];

  const [activeQTab, setActiveQTab] = useState(questionTabs[0]?.id ?? null);
  const [showLive, setShowLive] = useState(true);

  const activeSubmission = questionTabs.find(t => t.id === activeQTab)?.submission;
  const displayCode = showLive ? session.code : (activeSubmission?.code || '// No submission for this question');
  const editorLang = session.language || 'javascript';

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Candidate Session Report', 20, 20);
    doc.setFontSize(12);
    doc.text(`Name: ${session.name}`, 20, 35);
    doc.text(`Session ID: ${session.id}`, 20, 45);
    doc.text(`Status: ${session.status}`, 20, 55);
    doc.text(`Risk Index: ${session.fraudScore}/100`, 20, 65);
    doc.setFontSize(14);
    doc.text('Behavior Stats', 20, 80);
    doc.setFontSize(11);
    doc.text(`Blur: ${session.stats.blur}  Paste: ${session.stats.paste}  Macro: ${session.stats.macro}  Copy: ${session.stats.copy || 0}`, 20, 90);
    doc.text(`Score: ${getPassed(session)} / ${getTotal(session)} testcases passed`, 20, 102);
    doc.setFontSize(14);
    doc.text('Final Code', 20, 116);
    doc.setFontSize(9);
    doc.setFont('courier');
    const lines = doc.splitTextToSize(session.code || '', 170);
    doc.text(lines, 20, 126);
    doc.save(`Report_${session.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
      <div className="refractive-glass rounded-[32px] shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden animate-fade-up">

        {/* Modal header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-black flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 icon-blob">
              <Terminal className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {session.name}
                <span className={cn('ml-2 text-xs font-bold',
                  isDanger ? 'text-red-500' : 'text-slate-400'
                )}>Risk: {session.fraudScore}/100</span>
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-slate-400">{session.id.slice(-12)}</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  Live
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live / History toggle */}
            {questionTabs.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[10px]">
                <button onClick={() => setShowLive(true)}
                  className={cn('px-2.5 py-1 rounded-lg font-bold transition-colors',
                    showLive ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-400'
                  )}>LIVE</button>
                <button onClick={() => setShowLive(false)}
                  className={cn('px-2.5 py-1 rounded-lg font-bold transition-colors',
                    !showLive ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-400'
                  )}>HISTORY</button>
              </div>
            )}
            <button onClick={() => navigator.clipboard.writeText(displayCode).then(() => toast.success('Copied!'))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-bold tracking-widest transition-colors">
              <Copy className="w-3.5 h-3.5" /> COPY
            </button>
            <button onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-bold tracking-widest transition-colors border border-indigo-200 dark:border-indigo-500/20">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button onClick={() => onLockout(session.id)} disabled={session.status === 'disqualified'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-bold tracking-widest transition-colors border border-red-200 dark:border-red-500/20 disabled:opacity-40">
              <Ban className="w-3.5 h-3.5" /> LOCKOUT
            </button>
            <button onClick={onClose}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-700">
              CLOSE
            </button>
          </div>
        </div>

        {/* Question history tabs (only in history mode) */}
        {!showLive && questionTabs.length > 0 && (
          <div className="flex gap-1 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 overflow-x-auto">
            {questionTabs.map(q => (
              <button
                key={q.id}
                onClick={() => setActiveQTab(q.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border',
                  activeQTab === q.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                )}
              >
                Q{questionTabs.indexOf(q) + 1}: {q.title}
                {q.submission && (
                  <span className="ml-1.5 text-[9px] opacity-80">
                    ({q.submission.score?.passed}/{q.submission.score?.total})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 bg-slate-900 overflow-hidden">
          <Editor
            height="100%"
            language={editorLang}
            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            value={displayCode}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 15.5,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 16 },
            }}
          />
        </div>

        {/* Stat footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0 flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
          {[
            { label: 'Blur', val: session.stats.blur },
            { label: 'Paste', val: session.stats.paste },
            { label: 'Macro', val: session.stats.macro },
            { label: 'Copy', val: session.stats.copy || 0 },
          ].map(({ label, val }) => (
            <span key={label}>{label}: <strong className="text-slate-700 dark:text-slate-300">{val}</strong></span>
          ))}
          <span className="ml-auto font-semibold text-slate-700 dark:text-slate-300">
            Score: {getPassed(session)}/{getTotal(session)} passed
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Settings Modal ─────────────────────────────────────────────────────────────
function SettingsModal({ settings, onClose, onSave }) {
  const [local, setLocal] = useState(JSON.parse(JSON.stringify(settings)));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
      <div className="refractive-glass rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-fade-up">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-black flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-500" /> Fraud Detection Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">&times;</button>
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

// ── Exam Setup Panel ───────────────────────────────────────────────────────────
function ExamSetupPanel({ exam, onSave }) {
  const init = (ex) => {
    if (!ex) return { duration: 3600, questions: [] };
    return JSON.parse(JSON.stringify({ ...ex, questions: Array.isArray(ex.questions) ? ex.questions : [] }));
  };

  const [local, setLocal] = useState(init(exam));

  // Fix B7: always sync when exam prop changes (not just when questions are empty)
  useEffect(() => {
    if (exam) setLocal(init(exam));
  }, [exam]);

  const updateQ = (i, field, val) =>
    setLocal(p => { const qs = [...p.questions]; qs[i] = { ...qs[i], [field]: val }; return { ...p, questions: qs }; });

  const addQ = () =>
    setLocal(p => ({
      ...p,
      questions: [...p.questions, { id: Date.now(), title: 'New Question', functionName: 'solution', text: '', constraints: '', testcases: [] }]
    }));

  const removeQ = (i) =>
    setLocal(p => ({ ...p, questions: p.questions.filter((_, j) => j !== i) }));

  const addTC = (qi) => {
    const qs = [...local.questions];
    qs[qi].testcases = [...(qs[qi].testcases || []), { id: Date.now(), input: '', expectedOutput: '' }];
    setLocal(p => ({ ...p, questions: qs }));
  };

  const updateTC = (qi, ti, field, val) => {
    const qs = [...local.questions];
    qs[qi].testcases = qs[qi].testcases.map((tc, j) => j === ti ? { ...tc, [field]: val } : tc);
    setLocal(p => ({ ...p, questions: qs }));
  };

  const removeTC = (qi, ti) => {
    const qs = [...local.questions];
    qs[qi].testcases = qs[qi].testcases.filter((_, j) => j !== ti);
    setLocal(p => ({ ...p, questions: qs }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Exam Setup</h2>
          <p className="text-sm text-slate-400 mt-1">Configure questions, test cases, and duration.</p>
        </div>
        <button onClick={() => onSave(local)}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold tracking-widest transition-colors shadow-sm shadow-indigo-600/20">
          SAVE EXAM
        </button>
      </div>

      {/* Duration */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Duration (minutes)</label>
        <input
          type="number"
          value={Math.floor(local.duration / 60)}
          onChange={e => setLocal(p => ({ ...p, duration: Number(e.target.value) * 60 }))}
          className="w-36 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Questions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Questions ({local.questions.length})</h3>
          <button onClick={addQ}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold tracking-widest transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Question
          </button>
        </div>

        {local.questions.length === 0 && (
          <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-400 text-sm">
            No questions yet — click "Add Question" to begin.
          </div>
        )}

        <div className="space-y-5">
          {local.questions.map((q, i) => (
            <div key={q.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Question {i + 1}</span>
                <button onClick={() => removeQ(i)} className="flex items-center gap-1 text-red-400 hover:text-red-500 text-xs font-bold">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Title</label>
                    <input type="text" value={q.title} onChange={e => updateQ(i, 'title', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Two Sum" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Function Name</label>
                    <input type="text" value={q.functionName || ''} onChange={e => updateQ(i, 'functionName', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. solution" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Problem Statement</label>
                  <textarea value={q.text} onChange={e => updateQ(i, 'text', e.target.value)} rows={4}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe the problem..." />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Constraints (Optional)</label>
                  <textarea value={q.constraints || ''} onChange={e => updateQ(i, 'constraints', e.target.value)} rows={2}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 1 ≤ n ≤ 10^5" />
                </div>

                {/* Test Cases */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Test Cases ({(q.testcases || []).length})</label>
                    <button onClick={() => addTC(i)}
                      className="flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-600">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(q.testcases || []).map((tc, ti) => (
                      <div key={tc.id} className="flex gap-2 items-center">
                        <input type="text" value={tc.input} onChange={e => updateTC(i, ti, 'input', e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Input" />
                        <input type="text" value={tc.expectedOutput} onChange={e => updateTC(i, ti, 'expectedOutput', e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Expected Output" />
                        <button onClick={() => removeTC(i, ti)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(q.testcases || []).length === 0 && (
                      <p className="text-xs text-slate-400 italic">No test cases yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
