import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { Shield, User, KeyRound, Terminal, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

export default function Login() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('candidate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    // Clear credentials on mount / logout return
    setName('');
    setEmail('');
    setPassword('');
    setAccessCode('');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let endpoint = '/api/auth/login';
      let payload = { role };

      if (role === 'candidate') {
        if (!name.trim()) {
          toast.error('Please enter your name.');
          setLoading(false);
          return;
        }
        if (!accessCode.trim()) {
          toast.error('Please enter your access code.');
          setLoading(false);
          return;
        }
        payload.name = name.trim();
        payload.accessCode = accessCode.trim().toUpperCase();
      } else {
        if (!email.trim() || !password.trim()) {
          toast.error('Please enter both email and password.');
          setLoading(false);
          return;
        }
        payload.email = email.trim();
        payload.password = password.trim();
        if (isSignUp) {
          endpoint = '/api/auth/recruiter/register';
          payload.name = name.trim() || 'Recruiter Admin';
        } else {
          endpoint = '/api/auth/recruiter/login';
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      login(data);
      toast.success(isSignUp ? 'Registration successful!' : 'Login successful!', { icon: '✅' });
      navigate(data.role === 'recruiter' ? '/recruiter' : '/ide');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-slate-50/50 transition-colors duration-500">

      {/* ── Organic Oily Floating Blobs (Light Background) ── */}
      <div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none animate-oily-blob-1"
        style={{
          top: '-10%', left: '-5%',
          background: 'radial-gradient(circle, rgba(165,180,252,0.3) 0%, rgba(224,231,255,0.15) 50%, transparent 70%)',
          filter: 'blur(45px)',
        }} />
      <div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none animate-oily-blob-2"
        style={{
          bottom: '-5%', right: '-5%',
          background: 'radial-gradient(circle, rgba(196,181,253,0.25) 0%, rgba(243,232,255,0.12) 50%, transparent 70%)',
          filter: 'blur(55px)',
        }} />
      <div className="absolute w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{
          top: '35%', left: '50%',
          background: 'radial-gradient(circle, rgba(125,211,252,0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

      {/* ── Refractive Glass Card ── */}
      <div className="relative w-full max-w-md animate-fade-up z-10">
        <div className="relative refractive-glass glass-shine rounded-[32px] overflow-hidden p-8 md:p-9 shadow-2xl">

          {/* Top light highlight line */}
          <div className="absolute top-0 left-10 right-10 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="relative inline-flex items-center justify-center w-16 h-16 mb-4">
              {/* Outer soft shadow sphere */}
              <div className="absolute inset-0 bg-indigo-500/10 blur-lg scale-110 icon-blob" />
              <div className="relative w-16 h-16 icon-blob bg-white border border-slate-200/60 shadow-sm flex items-center justify-center">
                <Terminal className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">Live Monitor</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wider uppercase mt-1">Real-time assessment platform</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">

            {/* Role selection using dense oily liquid capsules */}
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-[0.15em] mb-3">
                Select Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'candidate', label: 'Candidate', Icon: User, desc: 'Take the exam' },
                  { id: 'recruiter', label: 'Recruiter', Icon: KeyRound, desc: 'Monitor tests' },
                ].map(({ id, label, Icon, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setRole(id); setIsSignUp(false); setName(''); }}
                    className={cn(
                      'oily-liquid-capsule flex flex-col items-center py-4 px-3 cursor-pointer text-center relative group active:scale-[0.98]',
                      role === id ? 'active' : ''
                    )}
                  >
                    <div className={cn('w-10 h-10 icon-blob flex items-center justify-center mb-2 transition-all duration-300',
                      role === id ? 'bg-indigo-600/10 text-indigo-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-450'
                    )}>
                      <Icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Candidate Fields */}
            {role === 'candidate' && (
              <div className="space-y-4 animate-fade-up">
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-[0.15em] mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full py-3.5 px-4 rounded-2xl text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all duration-300 bg-white/40 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 shadow-inner"
                    placeholder="Enter your full name"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-[0.15em] mb-2">
                    Access Code
                  </label>
                  <input
                    type="text"
                    required
                    value={accessCode}
                    onChange={e => setAccessCode(e.target.value)}
                    className="w-full py-3.5 px-4 rounded-2xl text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all duration-300 bg-white/40 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 shadow-inner uppercase font-mono"
                    placeholder="INV-XXXXXX"
                  />
                </div>
              </div>
            )}

            {/* Recruiter Fields */}
            {role === 'recruiter' && (
              <div className="space-y-4 animate-fade-up">
                {isSignUp && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-[0.15em] mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full py-3.5 px-4 rounded-2xl text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all duration-300 bg-white/40 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 shadow-inner"
                      placeholder="Enter your full name"
                      autoFocus
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-[0.15em] mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="off"
                    className="w-full py-3.5 px-4 rounded-2xl text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all duration-300 bg-white/40 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 shadow-inner"
                    placeholder="email@example.com"
                    autoFocus={!isSignUp}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-[0.15em] mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full py-3.5 px-4 rounded-2xl text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all duration-300 bg-white/40 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 shadow-inner"
                    placeholder="••••••••"
                  />
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setName(''); }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold transition-colors cursor-pointer"
                  >
                    {isSignUp ? 'Already registered? Log in' : 'Register a new admin account'}
                  </button>
                </div>
              </div>
            )}

            {/* Action Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'relative w-full py-4 rounded-2xl text-[14px] font-semibold text-white transition-all duration-300 overflow-hidden shadow-lg',
                  'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:shadow-indigo-500/20 hover:scale-[1.01] active:scale-[0.99] cursor-pointer',
                  loading && 'opacity-60 cursor-not-allowed'
                )}
                style={{
                  boxShadow: '0 4px 20px rgba(99,102,241,0.25), 0 1px 0 rgba(255,255,255,0.2) inset'
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  role === 'candidate' ? 'Login →' : isSignUp ? 'Register Account →' : 'Access Dashboard →'
                )}
              </button>
            </div>
          </form>


        </div>
      </div>
    </div>
  );
}
