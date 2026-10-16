import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import {
  ShieldAlert, Activity, Users, LayoutGrid, LogOut, Moon, Sun, Settings,
  XCircle, Play, List, Zap, RefreshCw, MessageSquare, Tag, GitCompare,
  CheckCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

import {
  ScoreBadge, StatCard, EmptyState, TopPerformersWidget, CandidateCard, CandidateLeaderboard
} from '../components/recruiter/CandidateCards';
import { FraudActivityChart } from '../components/recruiter/FraudActivityChart';
import { LiveCodeModal } from '../components/recruiter/LiveCodeModal';
import { SettingsModal } from '../components/recruiter/SettingsModal';
import { ExamSetupPanel } from '../components/recruiter/ExamSetupPanel';
import {
  InviteCodesTab, ProctorChatSidebarTab, PlagiarismReportPanel, ActivityFeedTab, TelemetryAlertsTab
} from '../components/recruiter/SidebarTabs';

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
  const [unreadChatCount, setUnreadChatCount] = useState(0);
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
    if (sidebarTab === 'chat') setUnreadChatCount(0);
  }, [sidebarTab]);

  // ── Socket setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth || auth.role !== 'recruiter') { navigate('/'); return; }
    if (!socket) return;

    socket.emit('join_recruiter');

    socket.on('initial_state', (initialSessions) => {
      const map = new Map();
      initialSessions.forEach(s => map.set(s.id, s));
      setSessions(map);
      if (initialSessions.length === 0) {
        setAlerts([]);
        setActivities([]);
      }
    });

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

    socket.on('new_chat_message', (msg) => {
      if (msg.sender === 'candidate') {
        if (sidebarTabRef.current !== 'chat') {
          setUnreadChatCount(prev => prev + 1);
          toast(`💬 ${msg.senderName}: ${msg.text.slice(0, 30)}...`, {
            style: { borderRadius: '12px', background: '#0f172a', color: '#f1f5f9', border: '1px solid #1e293b' },
            duration: 4000
          });
        }
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
      socket.off('new_chat_message');
    };
  }, [auth, socket, navigate]);

  const handleLockout = useCallback((sessionId) => {
    if (socket) socket.emit('force_lockout', { sessionId });
  }, [socket]);

  const handleLogout = () => { logout(); navigate('/'); };

  const handleStartExam = async () => {
    try {
      socket?.emit('start_exam');
      if (auth?.token) {
        await fetch('/api/exam/start', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' }
        });
      }
      setExam(prev => ({ ...(prev || {}), status: 'active' }));
      setExamStarted(true);
      toast.success('Exam started — candidates can now code!', { icon: '🚀' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to start exam');
    }
  };

  const handleEndExam = async () => {
    if (!window.confirm('Are you sure you want to end the exam? All active candidate sessions will be automatically submitted.')) {
      return;
    }
    try {
      socket?.emit('end_exam');
      if (auth?.token) {
        await fetch('/api/exam/end', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' }
        });
      }
      setExam(prev => ({ ...(prev || {}), status: 'finished' }));
      setExamStarted(false);
      toast.success('Exam ended successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to end exam');
    }
  };

  const handleResetExam = async () => {
    if (!window.confirm('Are you sure you want to reset the exam? This will permanently delete all candidate sessions and telemetry data to start a new fresh session.')) {
      return;
    }
    try {
      socket?.emit('reset_exam');
      if (auth?.token) {
        await fetch('/api/exam/reset', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' }
        });
      }
      setExam(prev => ({ ...(prev || {}), status: 'draft', questions: [] }));
      setExamStarted(false);
      setSessions(new Map());
      setAlerts([]);
      setActivities([]);
      toast.success('Exam reset to draft!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to reset exam');
    }
  };

  const sessionsList = [...sessions.values()];
  const activeCount = sessionsList.filter(s => s.status === 'active').length;
  const submittedCount = sessionsList.filter(s => s.status === 'submitted').length;
  const disqualCount = sessionsList.filter(s => s.status === 'disqualified').length;

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
              onClick={handleStartExam}
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
                onClick={handleEndExam}
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
                onClick={handleResetExam}
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
        <aside className="w-80 sm:w-84 bg-white dark:bg-black border-r border-slate-100 dark:border-slate-800/80 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-zinc-950/50 shrink-0 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Navigation</span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                {sidebarTab.toUpperCase().replace('_', ' ')}
              </span>
            </div>

            {/* Tab Grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'candidates', label: 'Candidates', icon: Users },
                { id: 'chat', label: 'Chat', icon: MessageSquare, badge: unreadChatCount },
                { id: 'plagiarism', label: 'Plagiarism', icon: GitCompare },
                { id: 'telemetry', label: 'Alerts', icon: Zap, badge: unreadAlerts },
              ].map(({ id, label, icon: Icon, badge }) => (
                <button
                  key={id}
                  onClick={() => setSidebarTab(id)}
                  className={cn(
                    'relative flex flex-col items-center justify-center p-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer border',
                    sidebarTab === id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850'
                  )}
                  title={label}
                >
                  <Icon className="w-4 h-4 mb-0.5" />
                  <span className="truncate w-full text-center leading-none text-[9px]">{label}</span>
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-extrabold text-white border border-white dark:border-black animate-bounce">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'activity', label: 'Activity', icon: Activity },
                { id: 'invites', label: 'Invites', icon: Tag },
                { id: 'exam_setup', label: 'Setup', icon: Settings },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSidebarTab(id)}
                  className={cn(
                    'flex flex-col items-center justify-center p-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer border',
                    sidebarTab === id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                      : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850'
                  )}
                  title={label}
                >
                  <Icon className="w-4 h-4 mb-0.5" />
                  <span className="truncate w-full text-center leading-none text-[9px]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Candidates list in sidebar */}
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
                      className="w-full p-3 rounded-xl border text-left transition-all hover:shadow-md group bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-500/30 cursor-pointer"
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
                          <ScoreBadge session={session} examTotal={exam?.questions?.length} />
                        </div>
                      </div>
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

          {sidebarTab === 'chat' && (
            <ProctorChatSidebarTab socket={socket} sessionsList={sessionsList} />
          )}

          {sidebarTab === 'activity' && (
            <ActivityFeedTab activities={activities} />
          )}

          {sidebarTab === 'invites' && (
            <InviteCodesTab auth={auth} socket={socket} />
          )}

          {sidebarTab === 'telemetry' && (
            <TelemetryAlertsTab alerts={alerts} />
          )}

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
                auth={auth}
                onSave={(newExam) => {
                  socket?.emit('update_exam', newExam);
                  toast.success('Exam updated!');
                }}
              />
            </div>
          ) : sidebarTab === 'plagiarism' ? (
            <div className="p-8">
              <PlagiarismReportPanel auth={auth} theme={theme} />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Stat strip */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Active Candidates" value={activeCount} icon={Users} color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
                <StatCard label="Submitted" value={submittedCount} icon={CheckCircle} color="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" />
                <StatCard label="Fraud Alerts" value={alerts.length} icon={Zap} color="bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400" />
                <StatCard label="Disqualified" value={disqualCount} icon={ShieldAlert} color="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" />
              </div>

              {/* Anomaly chart */}
              <FraudActivityChart alerts={alerts} theme={theme} />

              {/* Top Performers */}
              <TopPerformersWidget sessionsList={sessionsList} examTotal={exam?.questions?.length} />

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
                      className={cn('p-1.5 rounded-lg transition-colors cursor-pointer',
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
                        examTotal={exam?.questions?.length}
                      />
                    ))
                  )}
                </div>
              ) : (
                <CandidateLeaderboard
                  sessionsList={sessionsList}
                  onViewCode={setSelectedSessionId}
                  onLockout={handleLockout}
                  examTotal={exam?.questions?.length}
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
