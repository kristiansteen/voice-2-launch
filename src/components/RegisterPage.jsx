import { useState } from 'react';
import { BACKEND_URL } from '../lib/api.js';

export default function RegisterPage({ onLogin, onSwitchToLogin }) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  function passwordStrength(pw) {
    if (!pw) return null;
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw))   score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (score <= 2) return { label: 'Weak', color: 'text-red-500' };
    if (score <= 3) return { label: 'Medium', color: 'text-amber-500' };
    return { label: 'Strong', color: 'text-green-600' };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, signupSource: 'voice2launch' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      onLogin(data.accessToken);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    const state = btoa(JSON.stringify({ origin: window.location.origin, source: 'voice2launch' }));
    window.location.href = `${BACKEND_URL}/api/v1/auth/google?state=${encodeURIComponent(state)}`;
  }

  const strength = passwordStrength(password);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Mobile compact header ── */}
      <div
        className="lg:hidden flex items-center justify-center py-6 px-6 text-white shrink-0"
        style={{ background: 'linear-gradient(135deg, #0a0f0a 0%, #0d1f0d 100%)' }}
      >
        <div style={{ fontSize: '2.6rem', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, background: 'linear-gradient(135deg, #65c434 0%, #0ea5e9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          AILEAN
        </div>
      </div>

      {/* ── Left hero — desktop only ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-white relative overflow-hidden"
        style={{ background: '#0a0f0a' }}
      >
        {/* Burst image background */}
        <img
          src="/assets/images/ailean-burst-vision.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.45 }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,30,10,0.5) 100%)' }} />

        <div className="max-w-sm text-center relative z-10">
          <div className="mb-2" style={{ fontSize: '5rem', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 1, background: 'linear-gradient(135deg, #65c434 0%, #0ea5e9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            AILEAN
          </div>
          <div className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>fra Vimpl</div>
          <h2 className="text-2xl font-bold mb-4 leading-snug">Start mapping your processes</h2>
          <p className="text-white/70 leading-relaxed">
            Create your account and let Ailean turn your conversations into structured BPMN diagrams.
          </p>
          <div className="mt-10 space-y-3 text-left text-sm text-white/70">
            {['Free to get started', 'No credit card required', 'First diagram in minutes'].map(f => (
              <div key={f} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#65c434', color: '#0a0f0a' }}>✓</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 bg-slate-50">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Create account</h1>
          <p className="text-slate-500 text-sm mb-8">Get started with Ailean today.</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition bg-white"
              />
              {strength && (
                <p className={`mt-1 text-xs font-medium ${strength.color}`}>{strength.label} password</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm transition disabled:opacity-60"
              style={{ background: loading ? '#3d7a1f' : '#65c434', color: '#0a0f0a' }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-4 text-center text-xs text-slate-400">
            By creating an account you agree to our{' '}
            <a href="https://app.vimpl.com/terms.html" target="_blank" rel="noreferrer" className="underline">Terms</a>
            {' '}and{' '}
            <a href="https://app.vimpl.com/privacy.html" target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>.
          </p>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <button onClick={onSwitchToLogin} className="font-semibold" style={{ color: '#65c434' }}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
