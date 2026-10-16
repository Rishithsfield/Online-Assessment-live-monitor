import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import jsPDF from 'jspdf';
import { Terminal, Copy, Download, Ban } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPassed, getTotal, getQuestionsPassed, getQuestionsTotal } from './CandidateCards';
import toast from 'react-hot-toast';

export function LiveCodeModal({ session, exam, onClose, onLockout, theme, settings }) {
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
    const primaryColor = [79, 70, 229]; // Indigo

    // Header Band
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CANDIDATE ASSESSMENT REPORT', 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 140, 18);

    // Candidate Overview
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Candidate Overview', 14, 38);

    doc.setLineWidth(0.3);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 41, 196, 41);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${session.name}`, 14, 49);
    doc.text(`Session ID: ${session.id}`, 14, 56);
    doc.text(`Status: ${session.status.toUpperCase()}`, 110, 49);
    doc.text(`Risk Index: ${session.fraudScore} / 100`, 110, 56);

    // Behavior Telemetry Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Proctoring & Behavior Infractions', 14, 70);
    doc.line(14, 73, 196, 73);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 77, 182, 18, 'F');
    doc.text(`Tab Switch (Blur): ${session.stats.blur}`, 20, 88);
    doc.text(`Paste Actions: ${session.stats.paste}`, 65, 88);
    doc.text(`Macro Detected: ${session.stats.macro}`, 110, 88);
    doc.text(`Copy Outside IDE: ${session.stats.copy || 0}`, 155, 88);

    // Test Score Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Test Results & Evaluation', 14, 108);
    doc.line(14, 111, 196, 111);

    const passedCount = getPassed(session);
    const totalCount = getTotal(session);
    const qPassed = getQuestionsPassed(session);
    const qTotal = getQuestionsTotal(session, exam?.questions?.length);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Questions Solved: ${qPassed} / ${qTotal}`, 14, 118);
    doc.text(`Passed Testcases: ${passedCount} / ${totalCount}`, 14, 125);

    // Final Code
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Submitted Source Code', 14, 134);
    doc.line(14, 137, 196, 137);

    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    const lines = doc.splitTextToSize(session.code || '// No code submitted', 178);
    let y = 145;
    for (let i = 0; i < lines.length; i++) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines[i], 14, y);
      y += 4.5;
    }

    doc.save(`Assessment_Report_${session.name.replace(/\s+/g, '_')}.pdf`);
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
                  className={cn('px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer',
                    showLive ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-400'
                  )}>LIVE</button>
                <button onClick={() => setShowLive(false)}
                  className={cn('px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer',
                    !showLive ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-400'
                  )}>HISTORY</button>
              </div>
            )}
            <button onClick={() => navigator.clipboard.writeText(displayCode).then(() => toast.success('Copied!'))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-bold tracking-widest transition-colors cursor-pointer">
              <Copy className="w-3.5 h-3.5" /> COPY
            </button>
            <button onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-bold tracking-widest transition-colors border border-indigo-200 dark:border-indigo-500/20 cursor-pointer">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button onClick={() => onLockout(session.id)} disabled={session.status === 'disqualified'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-bold tracking-widest transition-colors border border-red-200 dark:border-red-500/20 disabled:opacity-40 cursor-pointer">
              <Ban className="w-3.5 h-3.5" /> LOCKOUT
            </button>
            <button onClick={onClose}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
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
                  'px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border cursor-pointer',
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
            Solved: <strong className="text-emerald-600 dark:text-emerald-400">{getQuestionsPassed(session)}/{getQuestionsTotal(session, exam?.questions?.length)} Qs</strong> ({getPassed(session)}/{getTotal(session)} testcases)
          </span>
        </div>
      </div>
    </div>
  );
}
