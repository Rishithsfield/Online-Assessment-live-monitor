import React, { useState, useEffect, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import {
  MessageSquare, Send, GitCompare, RefreshCw, CheckCircle, Eye, Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export function InviteCodesTab({ auth, socket }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchInvites = async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/invites', {
        headers: { 'Authorization': `Bearer ${auth.token}` }
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
        headers: { 'Authorization': `Bearer ${auth.token}` }
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
      const handleReset = () => setInvites([]);
      socket.on('invites_reset', handleReset);
      return () => socket.off('invites_reset', handleReset);
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

export function ProctorChatSidebarTab({ socket, sessionsList }) {
  const [selectedSessionId, setSelectedSessionId] = useState(sessionsList[0]?.id || null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (sessionsList.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessionsList[0].id);
    }
  }, [sessionsList]);

  useEffect(() => {
    if (!socket || !selectedSessionId) return;

    socket.emit('get_chat_history', { sessionId: selectedSessionId }, (msgs) => {
      if (Array.isArray(msgs)) setMessages(msgs);
    });

    const handleNewMsg = (msg) => {
      if (msg.sessionId === selectedSessionId) {
        setMessages(prev => [...prev, msg]);
      }
    };

    socket.on('new_chat_message', handleNewMsg);
    return () => {
      socket.off('new_chat_message', handleNewMsg);
    };
  }, [socket, selectedSessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSessionId || !socket) return;
    socket.emit('send_chat_message', {
      sessionId: selectedSessionId,
      text: chatInput.trim(),
      sender: 'recruiter',
      senderName: 'Recruiter Proctor'
    });
    setChatInput('');
  };

  const selectedCandidate = sessionsList.find(s => s.id === selectedSessionId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Candidate Selector */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-zinc-900 shrink-0">
        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Select Candidate</label>
        <select
          value={selectedSessionId || ''}
          onChange={e => setSelectedSessionId(e.target.value)}
          className="w-full px-3 py-1.5 bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
        >
          {sessionsList.length === 0 ? (
            <option value="">No candidates online</option>
          ) : (
            sessionsList.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id.slice(-6)})
              </option>
            ))
          )}
        </select>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar bg-white dark:bg-black">
        {!selectedCandidate ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">Select a candidate to start chatting</div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-xs text-slate-400">
            <MessageSquare className="w-8 h-8 mb-2 text-slate-300 dark:text-zinc-700" />
            <p>No messages with {selectedCandidate.name} yet</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isRecruiter = m.sender === 'recruiter';
            return (
              <div key={m._id || i} className={cn('flex flex-col max-w-[85%]', isRecruiter ? 'ml-auto items-end' : 'mr-auto items-start')}>
                <span className="text-[9px] text-slate-400 mb-0.5 px-1 font-bold">
                  {isRecruiter ? 'You (Proctor)' : m.senderName} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className={cn(
                  'px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm font-medium',
                  isRecruiter
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-slate-100 dark:bg-zinc-850 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-zinc-800'
                )}>
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {selectedCandidate && (
        <form onSubmit={handleSend} className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-zinc-900 flex gap-2 shrink-0">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder={`Message ${selectedCandidate.name}...`}
            className="flex-1 px-3 py-1.5 bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none text-slate-800 dark:text-slate-100"
          />
          <button type="submit" disabled={!chatInput.trim()} className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-40 cursor-pointer">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}

export function DiffComparisonModal({ pair, onClose, theme }) {
  if (!pair) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
      <div className="refractive-glass rounded-[32px] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-fade-up">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitCompare className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                Code Similarity Comparison
              </h3>
              <p className="text-xs text-slate-400">
                {pair.session1.name} vs {pair.session2.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              'px-3 py-1 rounded-full text-xs font-bold uppercase border',
              pair.similarity >= 70
                ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
            )}>
              {pair.similarity}% Similarity Match
            </span>
            <button onClick={onClose} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer">
              CLOSE
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-900 overflow-hidden">
          <DiffEditor
            height="100%"
            language="javascript"
            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            original={pair.session1.code}
            modified={pair.session2.code}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
              wordWrap: 'on'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function PlagiarismReportPanel({ auth, theme }) {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPair, setSelectedPair] = useState(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plagiarism/report', {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.ok) {
        setReport(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch plagiarism report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-indigo-500" /> Plagiarism & Code Overlap Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">AST Token N-Gram similarity comparison across all candidates</p>
        </div>
        <button
          onClick={fetchReport}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-xl text-xs font-bold tracking-widest cursor-pointer hover:bg-indigo-100"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> RE-ANALYZE
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : report.length === 0 ? (
        <div className="py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center space-y-2">
          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Plagiarism Detected</h3>
          <p className="text-xs text-slate-400">No pairs exceeded the 50% code similarity threshold.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {report.map((pair, idx) => (
            <div key={idx} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xl">{pair.isFlagged ? '🚨' : '⚠️'}</span>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {pair.session1.name} <span className="text-slate-400 font-normal">↔</span> {pair.session2.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {pair.session1.id.slice(-6)} vs {pair.session2.id.slice(-6)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-extrabold border',
                  pair.isFlagged
                    ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                )}>
                  {pair.similarity}% MATCH
                </span>
                <button
                  onClick={() => setSelectedPair(pair)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> COMPARE DIFF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPair && (
        <DiffComparisonModal pair={selectedPair} onClose={() => setSelectedPair(null)} theme={theme} />
      )}
    </div>
  );
}

export function ActivityFeedTab({ activities }) {
  return (
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
  );
}

export function TelemetryAlertsTab({ alerts }) {
  return (
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
  );
}
