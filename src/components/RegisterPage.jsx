import { useState } from 'react';
import { BACKEND_URL } from '../lib/api.js';
import AuthLayout, { inputClass, primaryButtonClass, OrDivider, ErrorBox } from './AuthLayout.jsx';

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
    if (score <= 3) return { label: 'Medium', color: 'text-ink' };
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
    <AuthLayout
      headline="Tell the process. Get the diagram."
      intro="Interview the people who do the work. Ailean turns it into BPMN, improvements and a plan with the business case."
      points={['Free to get started', 'No credit card required', 'EU-hosted, not used for training']}
    >
          <h1 className="text-2xl font-semibold text-ink mb-1">Create account</h1>
          <p className="text-mid text-sm mb-8">Get started with Ailean today.</p>

          {error && <ErrorBox>{error}</ErrorBox>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={inputClass}
              />
              {strength && (
                <p className={`mt-1 text-xs font-medium ${strength.color}`}>{strength.label} password</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className={primaryButtonClass}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <OrDivider />

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full py-3 rounded-full border border-line bg-white text-sm font-medium text-ink hover:border-ink transition flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-4 text-center text-xs text-mid">
            By creating an account you agree to our{' '}
            <a href="https://app.vimpl.com/terms.html" target="_blank" rel="noreferrer" className="underline">Terms</a>
            {' '}and{' '}
            <a href="https://app.vimpl.com/dpa.html" target="_blank" rel="noreferrer" className="underline">Data Processing Agreement</a>.
            {' '}See our{' '}
            <a href="https://app.vimpl.com/privacy.html" target="_blank" rel="noreferrer" className="underline">Privacy Notice</a>.
          </p>

          <p className="mt-4 text-center text-sm text-mid">
            Already have an account?{' '}
            <button onClick={onSwitchToLogin} className="font-semibold text-ink underline underline-offset-2" >
              Sign in
            </button>
          </p>
    </AuthLayout>
  );
}
