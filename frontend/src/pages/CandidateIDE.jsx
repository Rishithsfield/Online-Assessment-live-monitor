import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useBehaviorTracker } from '../hooks/useBehaviorTracker';
import { CodeEditor } from '../components/CodeEditor';
import { AlertTriangle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  CandidateHeader, QuestionNavigation
} from '../components/candidate/CandidateHeader';
import { QuestionPanel } from '../components/candidate/QuestionPanel';
import { TerminalPanel } from '../components/candidate/TerminalPanel';
import { CandidateChatDrawer } from '../components/candidate/CandidateChatDrawer';
import {
  LoadingSkeleton, DisqualifiedScreen, SubmittedScreen, ExamEndedScreen, WaitingToStartScreen
} from '../components/candidate/CandidateStatusScreens';
import { compareOutputs } from '../lib/utils';


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
    return `class Solution:\n    def ${fnName}(self, *args):\n        # Write your code here\n        pass\n`;
  }
  if (lang === 'cpp') {
    return `class Solution {\npublic:\n    // Write your solution here\n    int ${fnName}() {\n        return 0;\n    }\n};\n`;
  }
  if (lang === 'java') {
    return `class Solution {\n    // Write your solution here\n    public int ${fnName}() {\n        return 0;\n    }\n}\n`;
  }
  return `/**\n * @return {any}\n */\nvar ${fnName} = function() {\n    // Write your solution here\n};\n`;
};

export default function CandidateIDE() {
  const { auth, socket, logout } = useSocket();
  const navigate = useNavigate();

  const [examData, setExamData]                         = useState(null);
  const [loading, setLoading]                           = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    try {
      const saved = localStorage.getItem(`exam_state_${auth?.sessionId}`);
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed && parsed.currentQuestionIndex !== undefined ? parsed.currentQuestionIndex : 0;
    } catch { return 0; }
  });

  const theme = 'light';
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const [code, setCode]                 = useState('// Write your solution here\n');
  const [language, setLanguage]         = useState(() => {
    try {
      const saved = localStorage.getItem(`exam_state_${auth?.sessionId}`);
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed?.language || 'javascript';
    } catch { return 'javascript'; }
  });
  const [warning, setWarning]           = useState(null);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isSubmitted, setIsSubmitted]   = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [timeLeft, setTimeLeft]         = useState(3600);

  const [answers, setAnswers]           = useState(() => {
    try {
      const saved = localStorage.getItem(`exam_state_${auth?.sessionId}`);
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed?.answers || {};
    } catch { return {}; }
  });
  const isRestoredRef                   = useRef(false);
  const [submittedScores, setSubmittedScores] = useState({});
  const [terminalOutput, setTerminalOutput] = useState(null);
  const [isRunning, setIsRunning]       = useState(false);

  // Chat State
  const [chatOpen, setChatOpen]               = useState(false);
  const [chatMessages, setChatMessages]       = useState([]);
  const [chatInput, setChatInput]             = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatOpenRef                           = useRef(chatOpen);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnreadChatCount(0);
  }, [chatOpen]);

  // Persist state to localStorage only after initial restore has run
  useEffect(() => {
    if (!auth?.sessionId || !isRestoredRef.current) return;
    try {
      localStorage.setItem(`exam_state_${auth.sessionId}`, JSON.stringify({
        answers, language, currentQuestionIndex
      }));
    } catch {}
  }, [answers, language, currentQuestionIndex, auth?.sessionId]);

  // Restore + connect
  useEffect(() => {
    if (!auth || auth.role !== 'candidate' || !auth.sessionId) {
      navigate('/');
      return;
    }

    try {
      const saved = localStorage.getItem(`exam_state_${auth.sessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.currentQuestionIndex !== undefined)
          setCurrentQuestionIndex(parsed.currentQuestionIndex);
      }
    } catch {}

    if (!socket) return;

    socket.emit('join_candidate', { sessionId: auth.sessionId });

    socket.on('session_sync', (sync) => {
      if (sync.startTime) {
        localStorage.setItem(`exam_start_${auth.sessionId}`, String(sync.startTime));
      }
      if (typeof sync.remainingSeconds === 'number') {
        setTimeLeft(sync.remainingSeconds);
      }
      if (sync.scores && typeof sync.scores === 'object') {
        setSubmittedScores(sync.scores);
      }
      if (sync.status === 'submitted') {
        setIsSubmitted(true);
      } else if (sync.status === 'disqualified') {
        setIsDisqualified(true);
      }

      if (sync.language) {
        setLanguage(sync.language);
      }

      if (Array.isArray(sync.codeHistory) && sync.codeHistory.length > 0) {
        setAnswers(prev => {
          const merged = { ...prev };
          for (const item of sync.codeHistory) {
            if (item.questionId !== undefined && item.code) {
              if (!merged[item.questionId]) {
                merged[item.questionId] = item.code;
              }
            }
          }
          return merged;
        });
      }

      if (sync.code) {
        setCode(prev => {
          if (!prev || prev.includes('Write your solution here') || prev.includes('Write code here')) {
            return sync.code;
          }
          return prev;
        });
      }
    });

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    const applyExamData = (data) => {
      if (!data) return;
      clearTimeout(safetyTimer);
      setExamData(data);
      setLoading(false);

      const savedStart = localStorage.getItem(`exam_start_${auth.sessionId}`);
      if (savedStart) {
        const elapsed = Math.floor((Date.now() - parseInt(savedStart, 10)) / 1000);
        const remaining = Math.max(0, (data.duration || 3600) - elapsed);
        setTimeLeft(remaining);
      } else {
        setTimeLeft(data.duration || 3600);
      }

      try {
        const saved = localStorage.getItem(`exam_state_${auth.sessionId}`);
        const parsed = saved ? JSON.parse(saved) : {};
        const savedAnswers = parsed.answers || {};
        const savedIndex   = parsed.currentQuestionIndex !== undefined ? parsed.currentQuestionIndex : 0;
        const initialLang  = parsed.language || 'javascript';

        if (data.questions?.length > 0) {
          const targetIndex = savedIndex < data.questions.length ? savedIndex : 0;
          const qObj = data.questions[targetIndex];
          const qId = qObj.id;
          const qAns = savedAnswers[qId] || answers[qId];
          let codeToUse = '';
          if (typeof qAns === 'object' && qAns !== null) {
            codeToUse = qAns[initialLang] || getDefaultCode(initialLang, qObj);
          } else if (typeof qAns === 'string' && qAns.trim()) {
            codeToUse = qAns;
          } else {
            codeToUse = getDefaultCode(initialLang, qObj);
          }
          setCode(codeToUse);
        }
      } catch {}

      isRestoredRef.current = true;
    };

    const requestExam = () => {
      socket.emit('get_exam', (data) => {
        if (data) {
          applyExamData(data);
        } else {
          // Retry once if exam was still initializing
          setTimeout(() => {
            socket.emit('get_exam', (retryData) => {
              if (retryData) applyExamData(retryData);
            });
          }, 1500);
        }
      });
    };

    requestExam();
    socket.on('connect', requestExam);

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
      applyExamData(data);
    });

    socket.on('exam_started', (data) => {
      localStorage.setItem(`exam_start_${auth.sessionId}`, String(Date.now()));
      applyExamData(data);
      toast.success('The exam has started!', { icon: '🚀' });
    });


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
      clearTimeout(safetyTimer);
      socket.off('connect', requestExam);
      socket.off('warning_prompt');
      socket.off('test_disqualified');
      socket.off('test_submitted_auto');
      socket.off('exam_updated');
      socket.off('exam_started');
      socket.off('force_logout');
      socket.off('new_chat_message');
      socket.off('session_sync');
    };
  }, [auth, socket, navigate]);

  const { reportEvent } = useBehaviorTracker(
    auth?.sessionId || '',
    Boolean(auth?.sessionId) && !isSubmitted && !isDisqualified
  );

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    const oldLang = language;
    setLanguage(newLang);

    const currentQ = examData?.questions?.[currentQuestionIndex];
    if (currentQ) {
      const qId = currentQ.id;
      // Preserve current code under old language
      const currentQAnswers = typeof answers[qId] === 'object' && answers[qId] !== null ? { ...answers[qId] } : { [oldLang]: code };
      currentQAnswers[oldLang] = code;

      // Immediately resolve code for new language: saved code in newLang or newLang boilerplate
      let nextCode = currentQAnswers[newLang];
      if (!nextCode || !nextCode.trim()) {
        nextCode = getDefaultCode(newLang, currentQ);
      }
      currentQAnswers[newLang] = nextCode;

      const nextAnswers = {
        ...answers,
        [qId]: currentQAnswers
      };

      setCode(nextCode);
      setAnswers(nextAnswers);

      if (auth?.sessionId) {
        try {
          localStorage.setItem(`exam_state_${auth.sessionId}`, JSON.stringify({
            answers: nextAnswers, language: newLang, currentQuestionIndex
          }));
        } catch {}
      }

      if (socket && auth?.sessionId) {
        socket.emit('code_update', { sessionId: auth.sessionId, code: nextCode });
        socket.emit('language_update', { sessionId: auth.sessionId, language: newLang });
      }
    } else if (socket && auth?.sessionId) {
      socket.emit('language_update', { sessionId: auth.sessionId, language: newLang });
    }
  };

  const handleCodeChange = (newCode) => {
    const val = newCode || '';
    setCode(val);
    const currQ = examData?.questions[currentQuestionIndex];
    if (currQ) {
      const qId = currQ.id;
      setAnswers(prev => {
        const currentQAnswers = typeof prev[qId] === 'object' && prev[qId] !== null ? { ...prev[qId] } : {};
        currentQAnswers[language] = val;
        const next = { ...prev, [qId]: currentQAnswers };
        if (auth?.sessionId) {
          try {
            localStorage.setItem(`exam_state_${auth.sessionId}`, JSON.stringify({
              answers: next, language, currentQuestionIndex
            }));
          } catch {}
        }
        return next;
      });
    }
    if (socket && auth?.sessionId)
      socket.emit('code_update', { sessionId: auth.sessionId, code: val });
  };

  const switchQuestion = (index) => {
    if (!examData || !examData.questions[index]) return;
    const currentQ = examData.questions[currentQuestionIndex];
    const nextAnswers = { ...answers };
    if (currentQ) {
      const qId = currentQ.id;
      const currentQAnswers = typeof nextAnswers[qId] === 'object' && nextAnswers[qId] !== null ? { ...nextAnswers[qId] } : {};
      currentQAnswers[language] = code;
      nextAnswers[qId] = currentQAnswers;
      setAnswers(nextAnswers);
    }
    const targetQ = examData.questions[index];
    const targetQId = targetQ.id;
    const targetQAnswers = nextAnswers[targetQId];
    let restoredCode = '';
    if (typeof targetQAnswers === 'object' && targetQAnswers !== null) {
      restoredCode = targetQAnswers[language] || getDefaultCode(language, targetQ);
    } else if (typeof targetQAnswers === 'string' && targetQAnswers.trim()) {
      restoredCode = targetQAnswers;
    } else {
      restoredCode = getDefaultCode(language, targetQ);
    }

    setCode(restoredCode);
    setCurrentQuestionIndex(index);
    setTerminalOutput(null);
    if (auth?.sessionId) {
      try {
        localStorage.setItem(`exam_state_${auth.sessionId}`, JSON.stringify({
          answers: nextAnswers, language, currentQuestionIndex: index
        }));
      } catch {}
    }
  };

  const evaluateCode = async (codeToRun, inputStr, functionName = 'solution') => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (auth?.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      }
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers,
        body: JSON.stringify({ language: languageRef.current, code: codeToRun, input: inputStr, functionName })
      });
      const data = await res.json();
      if (!res.ok && data.error) {
        return `Error: ${data.error}`;
      }
      return data.output ?? (data.error ? `Error: ${data.error}` : 'No output');
    } catch (e) {
      return e.toString();
    }
  };

  const examDataRef             = useRef(examData);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const codeRef                 = useRef(code);
  const languageRef             = useRef(language);
  const isRunningRef            = useRef(isRunning);

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
        return { ...tc, actualOutput: actual, passed: compareOutputs(actual, tc.expectedOutput) };
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
      const passed = compareOutputs(actual, tc.expectedOutput);
      if (passed) {
        passedCount++;
      } else if (!failedTestCase) {
        failedTestCase = { ...tc, actualOutput: actual };
      }
    }

    const score = { passed: passedCount, total: tcs.length };
    setSubmittedScores(prev => ({ ...prev, [currentQuestion.id]: score }));
    setAnswers(prev => {
      const qId = currentQuestion.id;
      const currentQAnswers = typeof prev[qId] === 'object' && prev[qId] !== null ? { ...prev[qId] } : {};
      currentQAnswers[languageRef.current] = codeRef.current;
      const next = { ...prev, [qId]: currentQAnswers };
      if (auth?.sessionId) {
        try {
          localStorage.setItem(`exam_state_${auth.sessionId}`, JSON.stringify({
            answers: next,
            language: languageRef.current,
            currentQuestionIndex: currentQuestionIndexRef.current
          }));
        } catch {}
      }
      return next;
    });

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

  // Auto-submit when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && examData && !isSubmitted && !isDisqualified) {
      handleFinalSubmit(true);
    }
  }, [timeLeft]);

  // Global keyboard shortcuts
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

  const handleLogout = () => { logout(); navigate('/'); };

  // Status Screens
  if (loading) return <LoadingSkeleton />;
  if (isDisqualified) return <DisqualifiedScreen onHome={handleLogout} theme={theme} />;
  if (isSubmitted) return <SubmittedScreen onHome={handleLogout} theme={theme} />;
  if (examData && examData.status === 'finished') return <ExamEndedScreen onHome={handleLogout} theme={theme} />;
  if (examData && examData.status === 'draft') return <WaitingToStartScreen theme={theme} onHome={handleLogout} candidateName={auth?.name} />;

  if (!examData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#f8f9fb] dark:bg-black text-slate-800 dark:text-slate-100">
        <div className="max-w-md w-full refractive-glass p-8 rounded-[32px] text-center space-y-4 shadow-2xl border border-indigo-500/20">
          <div className="w-16 h-16 bg-indigo-500/10 mx-auto rounded-full flex items-center justify-center border border-indigo-500/20">
            <Clock className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
          <h2 className="text-xl font-bold">Connecting to Assessment</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Retrieving exam environment and questions. Please wait...
          </p>
          <button
            onClick={() => {
              if (socket) socket.emit('get_exam', (data) => { if (data) setExamData(data); });
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = examData?.questions?.[currentQuestionIndex];

  return (
    <div className="h-screen bg-[#fdfdfd] dark:bg-black flex flex-col font-sans text-slate-800 dark:text-slate-100 overflow-hidden">
      {/* Warning Alert Banner */}
      {warning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-amber-50 border border-amber-300 text-amber-700 rounded-full font-medium text-sm flex items-center gap-2 shadow-lg animate-fade-up">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {warning}
        </div>
      )}

      {/* Top Header */}
      <CandidateHeader
        candidateName={auth?.name}
        language={language}
        onLanguageChange={handleLanguageChange}
        timeLeft={timeLeft}
        onExitClick={() => setShowExitConfirm(true)}
      />

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Question Navigation & Details */}
        <div className="w-[380px] border-r border-slate-100 dark:border-slate-850 bg-white dark:bg-black flex flex-col shrink-0">
          <QuestionNavigation
            questions={examData?.questions || []}
            currentIndex={currentQuestionIndex}
            onSwitchQuestion={switchQuestion}
            submittedScores={submittedScores}
          />
          <QuestionPanel
            question={currentQuestion}
            score={currentQuestion ? submittedScores[currentQuestion.id] : null}
          />
        </div>

        {/* Right: Code Editor & Terminal Panel */}
        <div className="flex-1 flex flex-col bg-slate-50/60 dark:bg-zinc-950/10 min-w-0">
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

          <TerminalPanel
            output={terminalOutput}
            onClose={() => setTerminalOutput(null)}
            onRun={handleRun}
            onSubmit={handleQuestionSubmit}
            isRunning={isRunning}
          />
        </div>
      </main>

      {/* Exit Confirmation Dialog */}
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

      {/* Floating Proctor Chat Drawer */}
      <CandidateChatDrawer
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        chatMessages={chatMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        unreadChatCount={unreadChatCount}
        onSendMessage={handleSendChatMessage}
      />
    </div>
  );
}
