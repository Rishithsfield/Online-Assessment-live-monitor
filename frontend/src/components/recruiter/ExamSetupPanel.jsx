import React, { useState, useEffect } from 'react';
import {
  BookOpen, Sparkles, Plus, Trash2, XCircle, Code2, ChevronDown, FileText, Save
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { DifficultyBadge, TemplateLibraryModal, AIGeneratorModal } from './AddQuestionModals';
import toast from 'react-hot-toast';

export function ExamSetupPanel({ exam, auth, onSave }) {
  const init = (ex) => {
    if (!ex) return { duration: 3600, questions: [] };
    return JSON.parse(JSON.stringify({ ...ex, questions: Array.isArray(ex.questions) ? ex.questions : [] }));
  };

  const [local, setLocal] = useState(init(exam));
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [expandedBoilerplate, setExpandedBoilerplate] = useState({});

  useEffect(() => {
    if (exam) setLocal(init(exam));
  }, [exam]);

  const updateQ = (i, field, val) =>
    setLocal(p => { const qs = [...p.questions]; qs[i] = { ...qs[i], [field]: val }; return { ...p, questions: qs }; });

  const addQ = () =>
    setLocal(p => ({
      ...p,
      questions: [...p.questions, { id: Date.now(), title: 'New Question', functionName: 'solution', text: '', constraints: '', difficulty: 'medium', tags: [], boilerplate: { javascript: '', python: '', cpp: '', java: '' }, testcases: [] }]
    }));

  const addQuestionFromTemplate = (template) => {
    setLocal(p => ({
      ...p,
      questions: [...p.questions, {
        id: Date.now(),
        title: template.title,
        functionName: template.functionName || 'solution',
        text: template.text,
        constraints: template.constraints || '',
        difficulty: template.difficulty || 'medium',
        tags: template.tags || [],
        boilerplate: template.boilerplate || { javascript: '', python: '', cpp: '', java: '' },
        testcases: (template.testcases || []).map((tc, i) => ({ ...tc, id: tc.id || Date.now() + i }))
      }]
    }));
  };

  const saveQuestionAsTemplate = async (q) => {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          title: q.title,
          functionName: q.functionName,
          text: q.text,
          constraints: q.constraints,
          difficulty: q.difficulty,
          tags: q.tags,
          boilerplate: q.boilerplate,
          testcases: q.testcases
        })
      });
      if (res.ok) {
        toast.success(`"${q.title}" saved to template library!`, { icon: '📚' });
      }
    } catch (err) {
      toast.error('Failed to save template');
    }
  };

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

  const toggleBoilerplate = (qId) => {
    setExpandedBoilerplate(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleTagInput = (i, e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = e.target.value.trim().replace(/,/g, '');
      if (val && !(local.questions[i].tags || []).includes(val)) {
        updateQ(i, 'tags', [...(local.questions[i].tags || []), val]);
      }
      e.target.value = '';
    }
  };

  const removeTag = (qi, tag) => {
    updateQ(qi, 'tags', (local.questions[qi].tags || []).filter(t => t !== tag));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Exam Setup</h2>
          <p className="text-sm text-slate-400 mt-1">Configure questions, test cases, and duration.</p>
        </div>
        <button onClick={() => onSave(local)}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold tracking-widest transition-colors shadow-sm shadow-indigo-600/20 cursor-pointer">
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Questions ({local.questions.length})</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTemplateLibrary(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 rounded-xl text-xs font-bold tracking-widest transition-colors cursor-pointer">
              <BookOpen className="w-3.5 h-3.5" /> TEMPLATES
            </button>
            <button onClick={() => setShowAIGenerator(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 hover:from-indigo-100 hover:to-purple-100 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 rounded-xl text-xs font-bold tracking-widest transition-colors cursor-pointer ai-shimmer">
              <Sparkles className="w-3.5 h-3.5" /> GENERATE AI ✨
            </button>
            <button onClick={addQ}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold tracking-widest transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> MANUAL
            </button>
          </div>
        </div>

        {local.questions.length === 0 && (
          <div className="py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center space-y-4">
            <div className="w-16 h-16 icon-blob bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-2">
              <FileText className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No questions yet</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setShowAIGenerator(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-bold tracking-widest shadow-sm cursor-pointer">
                <Sparkles className="w-3.5 h-3.5" /> Generate with AI
              </button>
              <button onClick={() => setShowTemplateLibrary(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold tracking-widest cursor-pointer">
                <BookOpen className="w-3.5 h-3.5" /> Browse Library
              </button>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {local.questions.map((q, i) => (
            <div key={q.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Question {i + 1}</span>
                  <DifficultyBadge difficulty={q.difficulty} />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => saveQuestionAsTemplate(q)} title="Save to template library"
                    className="flex items-center gap-1 text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 text-xs font-bold transition-colors cursor-pointer">
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => removeQ(i)} className="flex items-center gap-1 text-red-400 hover:text-red-500 text-xs font-bold cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Title + Function Name */}
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

                {/* Difficulty + Tags */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Difficulty</label>
                    <div className="flex items-center gap-1.5">
                      {['easy', 'medium', 'hard'].map(d => (
                        <button
                          key={d}
                          onClick={() => updateQ(i, 'difficulty', d)}
                          className={cn(
                            'flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border cursor-pointer',
                            q.difficulty === d
                              ? `badge-${d}`
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                      Tags <span className="text-slate-300 dark:text-slate-600 font-normal">(Enter to add)</span>
                    </label>
                    <div className="flex items-center flex-wrap gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl min-h-[36px]">
                      {(q.tags || []).map(tag => (
                        <span key={tag} className="tag-chip gap-1">
                          {tag}
                          <button onClick={() => removeTag(i, tag)} className="text-indigo-400 hover:text-red-400 cursor-pointer ml-0.5">&times;</button>
                        </span>
                      ))}
                      <input
                        type="text"
                        onKeyDown={e => handleTagInput(i, e)}
                        className="flex-1 min-w-[60px] bg-transparent text-xs focus:outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                        placeholder={q.tags?.length ? '' : 'type & enter...'}
                      />
                    </div>
                  </div>
                </div>

                {/* Problem Statement */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Problem Statement</label>
                  <textarea value={q.text} onChange={e => updateQ(i, 'text', e.target.value)} rows={4}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe the problem..." />
                </div>

                {/* Constraints */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Constraints (Optional)</label>
                  <textarea value={q.constraints || ''} onChange={e => updateQ(i, 'constraints', e.target.value)} rows={2}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 1 ≤ n ≤ 10^5" />
                </div>

                {/* Boilerplate Code (collapsible) */}
                <div>
                  <button
                    onClick={() => toggleBoilerplate(q.id)}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    Starter Code
                    <ChevronDown className={cn('w-3 h-3 transition-transform', expandedBoilerplate[q.id] && 'rotate-180')} />
                    {(q.boilerplate?.javascript || q.boilerplate?.python || q.boilerplate?.cpp || q.boilerplate?.java) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  </button>
                  {expandedBoilerplate[q.id] && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">JavaScript</label>
                        <textarea
                          value={q.boilerplate?.javascript || ''}
                          onChange={e => updateQ(i, 'boilerplate', { ...(q.boilerplate || {}), javascript: e.target.value })}
                          rows={4}
                          className="w-full px-3 py-2 bg-slate-900 text-slate-300 border border-slate-700 rounded-xl text-[11px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="var solution = function() {&#10;  // code here&#10;};"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Python</label>
                        <textarea
                          value={q.boilerplate?.python || ''}
                          onChange={e => updateQ(i, 'boilerplate', { ...(q.boilerplate || {}), python: e.target.value })}
                          rows={4}
                          className="w-full px-3 py-2 bg-slate-900 text-slate-300 border border-slate-700 rounded-xl text-[11px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="class Solution:&#10;    def solution(self):&#10;        pass"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">C++</label>
                        <textarea
                          value={q.boilerplate?.cpp || ''}
                          onChange={e => updateQ(i, 'boilerplate', { ...(q.boilerplate || {}), cpp: e.target.value })}
                          rows={4}
                          className="w-full px-3 py-2 bg-slate-900 text-slate-300 border border-slate-700 rounded-xl text-[11px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="class Solution {&#10;public:&#10;    void solution() {&#10;    }&#10;};"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Java</label>
                        <textarea
                          value={q.boilerplate?.java || ''}
                          onChange={e => updateQ(i, 'boilerplate', { ...(q.boilerplate || {}), java: e.target.value })}
                          rows={4}
                          className="w-full px-3 py-2 bg-slate-900 text-slate-300 border border-slate-700 rounded-xl text-[11px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="class Solution {&#10;    public void solution() {&#10;    }&#10;}"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Test Cases */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Test Cases ({(q.testcases || []).length})</label>
                    <button onClick={() => addTC(i)}
                      className="flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer">
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
                        <button onClick={() => removeTC(i, ti)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer">
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

      {/* Template Library Modal */}
      {showTemplateLibrary && (
        <TemplateLibraryModal
          auth={auth}
          onClose={() => setShowTemplateLibrary(false)}
          onAddToExam={(t) => addQuestionFromTemplate(t)}
        />
      )}

      {/* AI Generator Modal */}
      {showAIGenerator && (
        <AIGeneratorModal
          auth={auth}
          onClose={() => setShowAIGenerator(false)}
          onAddToExam={(q) => addQuestionFromTemplate(q)}
          onSaveToLibrary={() => {}}
        />
      )}
    </div>
  );
}
