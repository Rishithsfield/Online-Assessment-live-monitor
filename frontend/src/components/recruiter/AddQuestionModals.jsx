import React, { useState, useEffect } from 'react';
import {
  BookOpen, Sparkles, Plus, Trash2, Search, XCircle, Loader2, Save, AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

export function DifficultyBadge({ difficulty, size = 'sm' }) {
  const cls = size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1';
  return (
    <span className={cn('rounded-full font-bold uppercase tracking-widest', cls,
      `badge-${difficulty || 'medium'}`
    )}>
      {difficulty || 'medium'}
    </span>
  );
}

export function TemplateLibraryModal({ auth, onClose, onAddToExam }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      let url = '/api/templates';
      const params = new URLSearchParams();
      if (filterDifficulty !== 'all') params.set('difficulty', filterDifficulty);
      if (params.toString()) url += `?${params}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.ok) setTemplates(await res.json());
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, [filterDifficulty]);

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const filtered = templates.filter(t =>
    searchQuery === '' || t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
      <div className="refractive-glass rounded-[32px] shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-fade-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-black flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" /> Question Template Library
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none cursor-pointer">&times;</button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title or tag..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {['all', 'easy', 'medium', 'hard'].map(d => (
              <button
                key={d}
                onClick={() => setFilterDifficulty(d)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors border cursor-pointer',
                  filterDifficulty === d
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 icon-blob bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-4">
                <BookOpen className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">No templates found</h3>
              <p className="text-xs text-slate-400 max-w-xs">Generate questions with AI and save them to build your template library.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(t => (
                <div key={t._id} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all duration-300 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{t.title}</h4>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <DifficultyBadge difficulty={t.difficulty} />
                        {(t.tags || []).slice(0, 3).map(tag => (
                          <span key={tag} className="tag-chip">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {(t.testcases || []).length} tc
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">{t.text}</p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { onAddToExam(t); toast.success(`Added "${t.title}" to exam`); }}
                      className="flex-1 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold tracking-widest transition-colors border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> ADD TO EXAM
                    </button>
                    <button
                      onClick={() => handleDelete(t._id)}
                      className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/20 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AIGeneratorModal({ auth, onClose, onAddToExam, onSaveToLibrary }) {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [testCaseCount, setTestCaseCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error('Enter a topic first'); return; }
    setGenerating(true);
    setError(null);
    setGenerated(null);
    try {
      const res = await fetch('/api/ai/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ topic: topic.trim(), difficulty, testCaseCount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setGenerated(data);
      toast.success('Question generated!', { icon: '✨' });
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!generated) return;
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify(generated)
      });
      if (res.ok) {
        toast.success('Saved to template library!', { icon: '📚' });
        if (onSaveToLibrary) onSaveToLibrary(generated);
      }
    } catch (err) {
      toast.error('Failed to save to library');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
      <div className="refractive-glass rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden animate-fade-up bg-white dark:bg-black border border-slate-200 dark:border-zinc-800">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 icon-blob bg-indigo-600/10 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                AI Question Generator
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Powered by Gemini AI</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Input controls */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">
                Topic / Concept
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Binary Search, Linked List Reversal, Two Pointers..."
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                onKeyDown={e => { if (e.key === 'Enter' && !generating) handleGenerate(); }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">
                  Difficulty Level
                </label>
                <div className="flex items-center gap-1.5">
                  {['easy', 'medium', 'hard'].map(d => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all border cursor-pointer',
                        difficulty === d
                          ? `badge-${d} shadow-sm border-current/30`
                          : 'bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1.5">
                  Test Case Count
                </label>
                <input
                  type="number"
                  min={1} max={10}
                  value={testCaseCount}
                  onChange={e => setTestCaseCount(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className={cn(
                'w-full py-3 oily-liquid-capsule text-xs font-extrabold tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-sm',
                generating || !topic.trim()
                  ? 'bg-slate-100 dark:bg-zinc-850 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-zinc-800 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
              )}
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating Problem...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Generate Question</>
              )}
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-xs text-red-600 dark:text-red-400">
              <div className="font-bold mb-1 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Generation Error
              </div>
              {error}
            </div>
          )}

          {/* Generated Question Preview */}
          {generated && (
            <div className="border border-indigo-500/30 dark:border-indigo-500/30 bg-slate-50/70 dark:bg-zinc-900/40 rounded-2xl overflow-hidden shadow-sm animate-fade-up">
              <div className="px-5 py-3 bg-indigo-50/60 dark:bg-indigo-500/10 border-b border-indigo-100 dark:border-indigo-500/20 flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Generated Preview
                </span>
                <DifficultyBadge difficulty={generated.difficulty} />
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">{generated.title}</h3>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/20">
                      {generated.functionName}
                    </span>
                    {(generated.tags || []).map(tag => (
                      <span key={tag} className="tag-chip">{tag}</span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {generated.text}
                </p>

                {generated.constraints && (
                  <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-xl p-3 text-[11px] font-mono text-amber-800 dark:text-amber-300 whitespace-pre-wrap">
                    <strong className="block text-[9px] uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Constraints</strong>
                    {generated.constraints}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {generated.boilerplate?.javascript && (
                    <div>
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">JS Starter</span>
                      <pre className="bg-slate-950 dark:bg-black text-indigo-300 border border-slate-800 rounded-xl p-3 text-[11px] font-mono overflow-x-auto leading-normal">
                        {generated.boilerplate.javascript}
                      </pre>
                    </div>
                  )}
                  {generated.boilerplate?.python && (
                    <div>
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Python Starter</span>
                      <pre className="bg-slate-950 dark:bg-black text-indigo-300 border border-slate-800 rounded-xl p-3 text-[11px] font-mono overflow-x-auto leading-normal">
                        {generated.boilerplate.python}
                      </pre>
                    </div>
                  )}
                  {generated.boilerplate?.cpp && (
                    <div>
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">C++ Starter</span>
                      <pre className="bg-slate-950 dark:bg-black text-indigo-300 border border-slate-800 rounded-xl p-3 text-[11px] font-mono overflow-x-auto leading-normal">
                        {generated.boilerplate.cpp}
                      </pre>
                    </div>
                  )}
                  {generated.boilerplate?.java && (
                    <div>
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Java Starter</span>
                      <pre className="bg-slate-950 dark:bg-black text-indigo-300 border border-slate-800 rounded-xl p-3 text-[11px] font-mono overflow-x-auto leading-normal">
                        {generated.boilerplate.java}
                      </pre>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">
                    Test Cases ({(generated.testcases || []).length})
                  </span>
                  <div className="space-y-1.5">
                    {(generated.testcases || []).map((tc, i) => (
                      <div key={i} className="flex gap-3 text-xs font-mono bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2">
                        <span className="text-slate-400 font-bold shrink-0">#{i + 1}</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium flex-1 truncate">In: {tc.input}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex-1 truncate">Out: {tc.expectedOutput}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { onAddToExam(generated); toast.success(`Added "${generated.title}" to exam`); onClose(); }}
                    className="oily-liquid-capsule flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold tracking-widest uppercase transition-all shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add to Exam
                  </button>
                  <button
                    onClick={() => { handleSaveToLibrary(); onAddToExam(generated); onClose(); }}
                    className="oily-liquid-capsule flex-1 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-650 dark:text-emerald-400 border border-emerald-400/40 text-xs font-extrabold tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Save & Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
