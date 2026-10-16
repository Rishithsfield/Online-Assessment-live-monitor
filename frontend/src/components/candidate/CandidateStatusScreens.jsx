import React from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export function SkeletonBlock({ className }) {
  return (
    <div className={cn('bg-slate-100 rounded-xl animate-pulse', className)} />
  );
}

export function LoadingSkeleton() {
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

export function DisqualifiedScreen({ onHome, theme }) {
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
        <p className="text-slate-450 dark:text-slate-400 text-sm leading-relaxed">
          Your session has been terminated by the administrator due to suspicious activity logs.
        </p>
        <button onClick={onHome} className="oily-liquid-capsule px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-650 dark:text-red-400 border border-red-400/40 font-bold tracking-wide transition-all duration-300 active:scale-[0.98] cursor-pointer text-sm">
          Return to Home
        </button>
      </div>
    </div>
  );
}

export function SubmittedScreen({ onHome, theme }) {
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
        <p className="text-slate-450 dark:text-slate-400 text-sm leading-relaxed">
          Your answers and code history have been successfully submitted and logged for review.
        </p>
        <button onClick={onHome} className="oily-liquid-capsule px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-400/40 font-bold tracking-wide transition-all duration-300 active:scale-[0.98] cursor-pointer text-sm">
          Return to Home
        </button>
      </div>
    </div>
  );
}

export function ExamEndedScreen({ onHome, theme }) {
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
        <p className="text-slate-450 dark:text-slate-400 text-sm leading-relaxed">
          The recruiter has ended the exam session. Your progress has been automatically saved and submitted.
        </p>
        <button onClick={onHome} className="oily-liquid-capsule px-6 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-400/40 font-bold tracking-wide transition-all duration-300 active:scale-[0.98] cursor-pointer text-sm">
          Return to Home
        </button>
      </div>
    </div>
  );
}

export function WaitingToStartScreen({ theme }) {
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
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
          The recruiter has not started the exam yet. Once started, the environment will load automatically.
        </p>
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
