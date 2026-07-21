import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useBehaviorTracker } from '../hooks/useBehaviorTracker';
import { usePyodide } from '../hooks/usePyodide';
import { CodeEditor } from '../components/CodeEditor';
import {
  AlertTriangle, Clock, TerminalSquare, LogOut, CheckCircle,
  ChevronLeft, ChevronRight, Play, Upload, XCircle, Loader2,
  Moon, Sun, MessageSquare, Send, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

const SUPPORTED_LANGUAGES = [
  { id: 'javascript', name: 'JavaScript (Node.js)' },
  { id: 'python',     name: 'Python (Pyodide)'     },
];

// ── Skeleton loader ────────────────────────────────────────────────────────────
function SkeletonBlock({ className }) {
  return (
    <div className={cn('bg-slate-100 rounded-xl animate-pulse', className)} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-screen bg-[#fdfdfd] flex flex-col font-sans overflow-hidden">
      <div className="h-16 border-b border-slate-100 bg-white px-8 flex items-center justify-between shrink-0">
        <SkeletonBlock className="h-8 w-48" />
        <div className="flex items-center gap-4">
          <SkeletonBlock className="h-8 w-28" />
          <SkeletonBlock className="h-8 w-20" />
          <SkeletonBlock className="h-8 w-24" />
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/3 border-r border-slate-100 p-6 space-y-4">
          <SkeletonBlock className="h-6 w-3/4" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-5/6" />
          <SkeletonBlock className="h-4 w-4/6" />
          <SkeletonBlock className="h-24 w-full mt-4" />
          <SkeletonBlock className="h-20 w-full" />
        </div>
        <div className="flex-1 bg-slate-50 p-4">
          <SkeletonBlock className="h-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

const toSnakeCase = (str) => {
  if (!str) return 'solution';
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
};

const getDefaultCode = (lang, question) => {
  if (question?.boilerplate?.[lang] && question.boilerplate[lang].trim()) {
    return question.boilerplate[lang];
  }
  const fnName = question?.functionName || 'solution';
  if (lang === 'python') {
    const pyFn = toSnakeCase(fnName);
    return `def ${pyFn}():\n    # Write your solution here\n    pass\n`;
  }
  return `function ${fnName}() {\n  // Write your solution here\n}\n`;
};

export default function CandidateIDE() {
  const { auth, socket, logout } = useSocket();
  const { runPython } = usePyodide();
  const navigate = useNavigate();

  const [examData, setExamData]                 = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const theme = 'light';
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const [code, setCode]         = useState('// Write your solution here\n');
  const [language, setLanguage] = useState('javascript');

  const [warning, setWarning]           = useState(null);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isSubmitted, setIsSubmitted]   = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [timeLeft, setTimeLeft]         = useState(3600);

  // answers[questionId] = code string
  const [answers, setAnswers]           = useState({});
  // submittedScores[questionId] = { passed, total }
  const [submittedScores, setSubmittedScores] = useState({});

  const [terminalOutput, setTerminalOutput] = useState(null);
  const [isRunning, setIsRunning]           = useState(false);

  // ── Chat State ─────────────────────────────────────────────────────────────
  const [chatOpen, setChatOpen]               = useState(false);
  const [chatMessages, setChatMessages]       = useState([]);
  const [chatInput, setChatInput]             = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatScrollRef                         = useRef(null);
  const chatOpenRef                           = useRef(chatOpen);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnreadChatCount(0);
  }, [chatOpen]);

  // ── Persist state to localStorage ─────────────────────────────────────────
  useEffect(() => {
    if (!auth?.sessionId) return;
    localStorage.setItem(`exam_state_${auth.sessionId}`, JSON.stringify({
      answers, language, currentQuestionIndex
    }));
  }, [answers, language, currentQuestionIndex, auth?.sessionId]);

  // ── Restore + connect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth || auth.role !== 'candidate' || !auth.sessionId) {
      navigate('/');
      return;
    }

    // Restore saved state
    try {
      const saved = localStorage.getItem(`exam_state_${auth.sessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.answers)              setAnswers(parsed.answers);
        if (parsed.language)             setLanguage(parsed.language);
        if (parsed.currentQuestionIndex !== undefined)
          setCurrentQuestionIndex(parsed.currentQuestionIndex);
      }
    } catch {}

    if (!socket) return;

    // Fix B1: correct event name
    socket.emit('join_candidate', { sessionId: auth.sessionId });

    socket.emit('get_exam', (data) => {
      setLoading(false);
      if (!data) return;
      setExamData(data);
      setTimeLeft(data.duration || 3600);

      // Restore code for the current question
      try {
        const saved = localStorage.getItem(`exam_state_${auth.sessionId}`);
        const parsed = saved ? JSON.parse(saved) : {};
        const savedAnswers = parsed.answers || {};
        const savedIndex   = parsed.currentQuestionIndex || 0;

        if (data.questions?.length > 0) {
          const qObj = data.questions[savedIndex] || data.questions[0];
          const qId = qObj.id;
          const initialLang = parsed.language || 'javascript';
          setCode(savedAnswers[qId] || getDefaultCode(initialLang, qObj));
        }
      } catch {}
    });

    socket.on('warning_prompt', ({ message }) => {
      setWarning(message);
      setTimeout(() => setWarning(null), 6000);
    });

    socket.on('test_disqualified', () => setIsDisqualified(true));

    socket.on('test_submitted_auto', () => {
      setIsSubmitted(true);
      toast.success('The exam has been ended by the recruiter. Your test is submitted.', { icon: '📝' });
    });

    socket.on('exam_updated', (data) => {
      setExamData(data);
      setTimeLeft(data?.duration || 3600);
      if (data?.questions?.length > 0) {
        const currentQ = data.questions[currentQuestionIndex] || data.questions[0];
        setCode(prev => {
          if (!prev || prev.includes('Write your solution here')) {
            return getDefaultCode(language, currentQ);
          }
          return prev;
        });
      }
    });

    socket.on('exam_started', (data) => {
      setExamData(data);
      setTimeLeft(data?.duration || 3600);
      toast.success('The exam has started!', { icon: '🚀' });
      if (data?.questions?.length > 0) {
        const currentQ = data.questions[currentQuestionIndex] || data.questions[0];
        setCode(prev => {
          if (!prev || prev.includes('Write your solution here')) {
            return getDefaultCode(language, currentQ);
          }
          return prev;
        });
      }
    });

    // Fetch initial chat history
    socket.emit('get_chat_history', { sessionId: auth.sessionId }, (messages) => {
      if (Array.isArray(messages)) setChatMessages(messages);
    });

    socket.on('new_chat_message', (msg) => {
      if (msg.sessionId === auth.sessionId) {
        setChatMessages(prev => [...prev, msg]);
        if (!chatOpenRef.current && msg.sender === 'recruiter') {
          setUnreadChatCount(prev => prev + 1);
          toast('💬 New message from Proctor', { icon: '💬' });
        }
      }
    });

    socket.on('force_logout', ({ reason }) => {
      toast.error(reason || 'Force logout triggered.', { duration: 6000 });
      setTimeout(() => {
        logout(true);
        navigate('/');
      }, 2000);
    });

    // Timer
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      socket.off('warning_prompt');
      socket.off('test_disqualified');
      socket.off('test_submitted_auto');
      socket.off('exam_updated');
      socket.off('exam_started');
      socket.off('force_logout');
      socket.off('new_chat_message');
    };
  }, [auth, socket, navigate]);

  // ── Auto-submit when timer hits 0 ─────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === 0 && examData && !isSubmitted && !isDisqualified) {
      handleFinalSubmit(true);
    }
  }, [timeLeft]);

  const { reportEvent } = useBehaviorTracker(auth?.sessionId || '', examData?.status === 'active');

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket || !auth?.sessionId) return;
    socket.emit('send_chat_message', {
      sessionId: auth.sessionId,
      text: chatInput.trim(),
      sender: 'candidate',
      senderName: auth.name || 'Candidate'
    });
    setChatInput('');
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatOpen]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);

    const currentQ = examData?.questions[currentQuestionIndex];
    const currentPlaceholderJs = getDefaultCode('javascript', currentQ);
    const currentPlaceholderPy = getDefaultCode('python', currentQ);
    if (code === currentPlaceholderJs || code === currentPlaceholderPy || !code.trim() || code.includes('Write your solution here')) {
      const nextDefault = getDefaultCode(newLang, currentQ);
      setCode(nextDefault);
      if (currentQ) {
        setAnswers(prev => ({ ...prev, [currentQ.id]: nextDefault }));
      }
      if (socket && auth?.sessionId) {
        socket.emit('code_update', { sessionId: auth.sessionId, code: nextDefault });
      }
    }

    if (socket && auth?.sessionId)
      socket.emit('language_update', { sessionId: auth.sessionId, language: newLang });
  };

  const handleCodeChange = (newCode) => {
    const val = newCode || '';
    setCode(val);
    if (examData?.questions[currentQuestionIndex]) {
      setAnswers(prev => ({ ...prev, [examData.questions[currentQuestionIndex].id]: val }));
    }
    if (socket && auth?.sessionId)
      socket.emit('code_update', { sessionId: auth.sessionId, code: val });
  };

  const switchQuestion = (index) => {
    if (!examData || !examData.questions[index]) return;
    const targetQ = examData.questions[index];
    const nextQId = targetQ.id;
    setCode(answers[nextQId] || getDefaultCode(language, targetQ));
    setCurrentQuestionIndex(index);
    setTerminalOutput(null);
  };

  const evaluateCode = async (codeToRun, inputStr, functionName = 'solution') => {
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: languageRef.current, code: codeToRun, input: inputStr, functionName })
      });
      const data = await res.json();
      const output = data.output ?? 'No output';

      // Server signals Python should run client-side via Pyodide
      if (output === '__PYODIDE__') {
        try {
          return await runPython(codeToRun, inputStr, functionName);
        } catch (pyErr) {
          return `Error: ${pyErr.message}`;
        }
      }

      return output;
    } catch (e) {
      return e.toString();
    }
  };

  // Use refs so keyboard shortcut always has fresh values (fixes B4)
  const examDataRef            = useRef(examData);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const codeRef                = useRef(code);
  const languageRef            = useRef(language);
  const isRunningRef           = useRef(isRunning);

  useEffect(() => { examDataRef.current = examData; },                   [examData]);
  useEffect(() => { currentQuestionIndexRef.current = currentQuestionIndex; }, [currentQuestionIndex]);
  useEffect(() => { codeRef.current = code; },                           [code]);
  useEffect(() => { languageRef.current = language; },                   [language]);
  useEffect(() => { isRunningRef.current = isRunning; },                 [isRunning]);

  const handleRun = useCallback(async () => {
    if (isRunningRef.current) return;
    const currentQuestion = examDataRef.current?.questions[currentQuestionIndexRef.current];
    if (!currentQuestion) return;

    if (socket && auth?.sessionId)
      socket.emit('candidate_run', { sessionId: auth.sessionId });

    setIsRunning(true);
    setTerminalOutput({ type: 'running' });

    const tcs = (currentQuestion.testcases || []).slice(0, 3);
    const results = await Promise.all(
      tcs.map(async (tc) => {
        const actual = await evaluateCode(codeRef.current, tc.input, currentQuestion.functionName || 'solution');
        return { ...tc, actualOutput: actual, passed: String(actual).trim() === String(tc.expectedOutput).trim() };
      })
    );

    setTerminalOutput({ type: 'run_result', results });
    setIsRunning(false);
    toast.success('Execution complete!', { icon: '✅' });
  }, [socket, auth]);

  const handleQuestionSubmit = useCallback(async () => {
    if (isRunningRef.current) return;
    const currentQuestion = examDataRef.current?.questions[currentQuestionIndexRef.current];
    if (!currentQuestion) return;

    setIsRunning(true);
    setTerminalOutput({ type: 'running' });
    toast.loading('Evaluating all test cases...', { id: 'submit' });

    const tcs = currentQuestion.testcases || [];
    let passedCount = 0;
    let failedTestCase = null;

    for (const tc of tcs) {
      const actual = await evaluateCode(codeRef.current, tc.input, currentQuestion.functionName || 'solution');
      const passed = String(actual).trim() === String(tc.expectedOutput).trim();
      if (passed) {
        passedCount++;
      } else if (!failedTestCase) {
        failedTestCase = { ...tc, actualOutput: actual };
      }
    }

    const score = { passed: passedCount, total: tcs.length };
    setSubmittedScores(prev => ({ ...prev, [currentQuestion.id]: score }));

    if (socket && auth?.sessionId) {
      socket.emit('submit_code', {
        sessionId: auth.sessionId,
        questionId: currentQuestion.id,
        code: codeRef.current,
        score
      });
    }

    setTerminalOutput({ type: 'submit_result', ...score, failedTestCase });
    setIsRunning(false);
    toast.success('Solution submitted!', { id: 'submit', icon: '🏆' });
  }, [socket, auth]);

  const handleFinalSubmit = useCallback((autoSubmit = false) => {
    if (!socket || !auth?.sessionId) return;

    // Compute overall score from submittedScores
    const allScores = Object.values(submittedScores);
    const totalPassed = allScores.reduce((s, q) => s + q.passed, 0);
    const totalTests  = allScores.reduce((s, q) => s + q.total,  0);

    socket.emit('submit_test', {
      sessionId: auth.sessionId,
      score: { passed: totalPassed, total: totalTests }
    });
    setIsSubmitted(true);
    setShowExitConfirm(false);
    if (autoSubmit) toast.error('Time is up! Your test has been auto-submitted.', { duration: 6000 });
  }, [socket, auth, submittedScores]);

  // Keyboard shortcuts — use refs so they're always fresh (fixes B4)
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault();
        e.stopPropagation();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleQuestionSubmit();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handleRun, handleQuestionSubmit]);

  const floatingBlobs = (
    <>
      <div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none animate-oily-blob-1"
        style={{
          top: '-10%', left: '-5%',
          background: 'radial-gradient(circle, rgba(165,180,252,0.1) 0%, rgba(224,231,255,0.04) 50%, transparent 70%)',
          filter: 'blur(55px)',
        }} />
      <div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none animate-oily-blob-2"
        style={{
          bottom: '-5%', right: '-5%',
          background: 'radial-gradient(circle, rgba(196,181,253,0.1) 0%, rgba(243,232,255,0.03) 50%, transparent 70%)',
          filter: 'blur(55px)',
        }} />
    </>
  );

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleLogout = () => { logout(); navigate('/'); };

  // ── Special screens ────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />;

  if (isDisqualified) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300", 
        theme === 'dark' ? 'bg-black text-slate-100' : 'bg-[#f8f9fb] text-slate-800'
      )}>
        {floatingBlobs}
        <div className="max-w-md w-full refractive-glass p-8 rounded-[32px] text-center space-y-6 z-10 animate-fade-up border-red-500/20">
          <div className="w-20 h-20 bg-red-500/10 mx-auto icon-blob flex items-center justify-center animate-pulse border border-red-500/20">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-red-500 tracking-tight">Test Disqualified</h1>
          <p className="text-slate-450 dark:text-slate-400 text-sm leading-relaxed">Your session has been terminated by the administrator due to suspicious activity logs.</p>
          <button onClick={handleLogout} className="oily-liquid-capsule px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-650 dark:text-red-400 border border-red-400/40 font-bold tracking-wide transition-all duration-300 active:scale-[0.98] cursor-pointer text-sm">
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300", 
        theme === 'dark' ? 'bg-black text-slate-100' : 'bg-[#f8f9fb] text-slate-800'
      )}>
        {floatingBlobs}
        <div className="max-w-md w-full refractive-glass p-8 rounded-[32px] text-center space-y-6 z-10 animate-fade-up border-emerald-500/20">
          <div className="w-20 h-20 bg-emerald-500/10 mx-auto icon-blob flex items-center justify-center border border-emerald-500/20">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-emerald-400 tracking-tight font-sans">Test Submitted</h1>
          <p className="text-slate-450 dark:text-slate-400 text-sm leading-relaxed">Your answers and code history have been successfully submitted and logged for review.</p>
          <button onClick={handleLogout} className="oily-liquid-capsule px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-400/40 font-bold tracking-wide transition-all duration-300 active:scale-[0.98] cursor-pointer text-sm">
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (examData && examData.status === 'finished') {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300", 
        theme === 'dark' ? 'bg-black text-slate-100' : 'bg-[#f8f9fb] text-slate-800'
      )}>
        {floatingBlobs}
        <div className="max-w-md w-full refractive-glass p-8 rounded-[32px] text-center space-y-6 z-10 animate-fade-up border-indigo-500/20">
          <div className="w-20 h-20 bg-indigo-500/10 mx-auto icon-blob flex items-center justify-center border border-indigo-500/20">
            <CheckCircle className="w-10 h-10 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-indigo-450 tracking-tight">Exam Ended</h1>
          <p className="text-slate-450 dark:text-slate-400 text-sm leading-relaxed">The recruiter has ended the exam session. Your progress has been automatically saved and submitted.</p>
          <button onClick={handleLogout} className="oily-liquid-capsule px-6 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-400/40 font-bold tracking-wide transition-all duration-300 active:scale-[0.98] cursor-pointer text-sm">
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (examData && examData.status === 'draft') {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors", 
        theme === 'dark' ? 'bg-black' : 'bg-[#f8f9fb]'
      )}>
        {floatingBlobs}
        <div className="max-w-md w-full refractive-glass p-8 rounded-[32px] text-center space-y-6 z-10 animate-fade-up border-indigo-400/20">
          <div className="w-20 h-20 bg-indigo-500/5 mx-auto rounded-full flex items-center justify-center border border-indigo-500/10">
            <Clock className="w-10 h-10 text-indigo-500 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Waiting to Start</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">The recruiter has not started the exam yet. Once started, the environment will load automatically.</p>
          <div className="flex items-center justify-center gap-2.5 text-xs text-slate-450 dark:text-slate-500">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
            </span>
            Waiting for recruiter...
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = examData?.questions[currentQuestionIndex];
  const isTimeCritical  = timeLeft <= 300; // last 5 minutes

  // ── Main IDE Layout ────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#fdfdfd] dark:bg-black flex flex-col font-sans text-slate-800 dark:text-slate-100 overflow-hidden">

      {/* Warning Banner */}
      {warning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-amber-50 border border-amber-300 text-amber-700 rounded-full font-medium text-sm flex items-center gap-2 shadow-lg animate-fade-up">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {warning}
        </div>
      )}

      {/* Top Bar */}
      <header className="h-16 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-black px-6 flex items-center justify-between shrink-0 shadow-sm text-slate-800 dark:text-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 icon-blob shadow-md shadow-indigo-600/20">
            <TerminalSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-800 dark:text-slate-100 leading-tight text-sm">Algorithm Assessment</h1>
            <p className="text-[11px] text-slate-400">Candidate: <span className="font-medium text-slate-600 dark:text-slate-300">{auth?.name}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Language selector */}
          <select
            value={language}
            onChange={handleLanguageChange}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-250 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
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
            onClick={() => setShowExitConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-650 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Exit
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex overflow-hidden">

        {/* Left: Question Panel */}
        <div className="w-[380px] border-r border-slate-100 dark:border-slate-850 bg-white dark:bg-black flex flex-col shrink-0">
          {/* Question navigation */}
          {examData && examData.questions.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                onClick={() => switchQuestion(currentQuestionIndex - 1)}
                disabled={currentQuestionIndex === 0}
                className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-30 text-slate-500 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Question tabs */}
              <div className="flex items-center gap-1.5">
                {examData.questions.map((q, i) => {
                  const score = submittedScores[q.id];
                  const passed = score && score.passed > 0;
                  return (
                    <button
                      key={q.id}
                      onClick={() => switchQuestion(i)}
                      className={cn(
                        'relative w-7 h-7 rounded-full text-xs font-bold transition-all border',
                        i === currentQuestionIndex
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : passed
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                      )}
                    >
                      {passed && i !== currentQuestionIndex && (
                        <CheckCircle className="absolute -top-1 -right-1 w-3.5 h-3.5 text-emerald-500 bg-white rounded-full" />
                      )}
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => switchQuestion(currentQuestionIndex + 1)}
                disabled={currentQuestionIndex === examData.questions.length - 1}
                className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-30 text-slate-500 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Question content */}
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            {currentQuestion ? (
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h2 className="text-lg font-bold text-slate-800 leading-tight">{currentQuestion.title}</h2>
                  {submittedScores[currentQuestion.id] && (
                    <span className={cn(
                      'shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border',
                      submittedScores[currentQuestion.id].passed === submittedScores[currentQuestion.id].total
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-amber-50 text-amber-600 border-amber-200'
                    )}>
                      {submittedScores[currentQuestion.id].passed}/{submittedScores[currentQuestion.id].total} ✓
                    </span>
                  )}
                </div>

                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap mb-6">
                  {currentQuestion.text}
                </p>

                {currentQuestion.constraints && (
                  <div className="mb-5">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Constraints</h3>
                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 text-xs font-mono text-amber-800 whitespace-pre-wrap">
                      {currentQuestion.constraints}
                    </div>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Expected Function</h3>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-sm font-mono text-indigo-700">
                    {currentQuestion.functionName || 'solution'}
                  </div>
                </div>

                {Array.isArray(currentQuestion.testcases) && currentQuestion.testcases.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      Sample Test Cases ({currentQuestion.testcases.length})
                    </h3>
                    <div className="space-y-2">
                      {currentQuestion.testcases.map((tc, idx) => (
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
            ) : (
              <div className="text-center text-slate-400 mt-16">
                <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p>Loading exam...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Editor + Terminal */}
        <div className="flex-1 flex flex-col bg-slate-50/60 dark:bg-zinc-950/10 min-w-0">
          {/* Editor */}
          <div className="flex-1 p-4 pb-2 min-h-0">
            <div className="h-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
              <CodeEditor
                value={code}
                language={language}
                onChange={handleCodeChange}
                onPaste={() => reportEvent('paste')}
                onMacroDetected={() => reportEvent('macro')}
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                fontSize={15.5}
              />
            </div>
          </div>

          {/* Terminal */}
          {terminalOutput && (
            <div className="mx-4 mb-2 bg-black rounded-xl border border-zinc-800 flex flex-col overflow-hidden max-h-52">
              <div className="h-8 bg-zinc-950 flex items-center px-4 border-b border-zinc-800 shrink-0">
                <div className="flex gap-1.5 mr-3">
                  <button onClick={() => setTerminalOutput(null)} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <TerminalSquare className="w-3.5 h-3.5 text-slate-400 mr-2" />
                <span className="text-xs font-mono text-slate-400">Output</span>
              </div>

              <div className="p-4 overflow-y-auto font-mono text-sm flex-1 custom-scrollbar">
                {terminalOutput.type === 'running' && (
                  <div className="text-indigo-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Evaluating solution...
                  </div>
                )}

                {terminalOutput.type === 'run_result' && (
                  <div className="space-y-3">
                    <div className="text-slate-400 text-xs mb-2">
                      Sample results ({terminalOutput.results.filter(r => r.passed).length}/{terminalOutput.results.length} passed)
                    </div>
                    {terminalOutput.results.map((tc, i) => (
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

                {terminalOutput.type === 'submit_result' && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    {terminalOutput.failedTestCase ? (
                      <div className="w-full text-left space-y-2">
                        <div className="text-red-400 flex items-center gap-2 font-semibold"><XCircle className="w-4 h-4" /> Some cases failed</div>
                        <div className="text-slate-300 text-sm">Passed {terminalOutput.passed} / {terminalOutput.total} testcases</div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-xs space-y-1">
                          <div className="text-slate-400">Input: <span className="text-slate-200">{terminalOutput.failedTestCase.input}</span></div>
                          <div className="text-slate-400">Expected: <span className="text-emerald-300">{terminalOutput.failedTestCase.expectedOutput}</span></div>
                          <div className="text-slate-400">Got: <span className="text-red-300">{terminalOutput.failedTestCase.actualOutput}</span></div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <CheckCircle className="w-8 h-8 text-emerald-400" />
                        <div className="text-emerald-400 font-bold text-lg">All Testcases Passed!</div>
                        <div className="text-3xl font-bold text-emerald-400 font-mono">
                          {terminalOutput.passed}<span className="text-slate-500 text-xl"> / {terminalOutput.total}</span>
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
                onClick={handleRun}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-sm"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run Code
              </button>
              <button
                onClick={handleQuestionSubmit}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-indigo-600/20"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Submit Answer
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Exit Confirm Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <div className="refractive-glass rounded-[32px] shadow-2xl w-full max-w-sm p-6 text-center animate-fade-up border-red-500/20">
            <div className="w-12 h-12 bg-red-500/10 mx-auto icon-blob flex items-center justify-center mb-4 border border-red-500/20">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-sm font-extrabold text-black mb-1.5">Exit & Submit?</h3>
            <p className="text-[11px] text-zinc-950 font-semibold leading-relaxed mb-6">
              This will submit your current progress. You won't be able to return.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="oily-liquid-capsule flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all duration-300 shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleFinalSubmit(false)}
                className="oily-liquid-capsule flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-650 dark:text-red-400 border border-red-400/40 text-sm font-bold transition-all duration-300 shadow-sm cursor-pointer"
              >
                Exit Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Proctor Chat Drawer (Bottom Left to avoid overlapping IDE action buttons) */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
        {chatOpen ? (
          <div className="w-80 sm:w-96 h-96 refractive-glass rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-black/95 backdrop-blur-xl animate-fade-up">
            {/* Drawer Header */}
            <div className="px-4 py-3 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                  <MessageSquare className="w-4 h-4 text-indigo-400" /> Live Proctor Chat
                </span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages body */}
            <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/50">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs">
                  <MessageSquare className="w-8 h-8 mb-2 text-slate-300 dark:text-zinc-700" />
                  <p className="font-bold text-slate-600 dark:text-slate-300">Proctor Support Channel</p>
                  <p className="text-[10px] text-slate-400 mt-1">Need help or clarification? Send a message directly to your proctor.</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => {
                  const isMe = msg.sender === 'candidate';
                  return (
                    <div key={msg._id || i} className={cn('flex flex-col max-w-[85%]', isMe ? 'ml-auto items-end' : 'mr-auto items-start')}>
                      <span className="text-[9px] text-slate-400 mb-0.5 px-1 font-bold">
                        {isMe ? 'You' : (msg.senderName || 'Proctor')} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className={cn(
                        'px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm font-medium',
                        isMe
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-zinc-700'
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChatMessage} className="p-3 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message to proctor..."
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="relative oily-liquid-capsule px-4 py-3 bg-white hover:bg-slate-100 text-black shadow-2xl shadow-black/20 border-2 border-slate-300 dark:border-zinc-700 flex items-center gap-2.5 text-xs font-black transition-all duration-300 hover:scale-105 cursor-pointer z-50 opacity-100"
          >
            <div className="relative">
              <MessageSquare className="w-4.5 h-4.5 text-black stroke-[2.5]" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              )}
            </div>
            <span className="text-black font-black tracking-wide">Proctor Chat</span>
            {unreadChatCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black border border-black">
                {unreadChatCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
