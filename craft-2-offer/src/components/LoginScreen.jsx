import { useState, useEffect } from 'react';

const VIMPL_BACKEND = import.meta.env.VITE_VIMPL_BACKEND_URL ?? 'https://backend-eight-rho-46.vercel.app';
const AUTH_KEY = 'aison_vimpl_config';

export default function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle OAuth callback — vimpl redirects back with ?token=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    // Remove token from URL
    window.history.replaceState({}, '', window.location.pathname);

    setLoading(true);
    fetch(`${VIMPL_BACKEND}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          const config = { token, email: data.user.email, name: data.user.name };
          localStorage.setItem(AUTH_KEY, JSON.stringify(config));
          onLogin(config);
        } else {
          setError('Login mislykkedes. Prøv igen.');
        }
      })
      .catch(() => setError('Netværksfejl. Prøv igen.'))
      .finally(() => setLoading(false));
  }, [onLogin]);

  function handleGoogleLogin() {
    const callbackUrl = encodeURIComponent(`${window.location.origin}?`);
    window.location.href = `${VIMPL_BACKEND}/api/v1/auth/google?redirect=${callbackUrl}`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B4F72] to-[#2E86C1] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-[#1B4F72] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Aison</h1>
          <p className="text-sm text-gray-500 mt-1">Tilbud på sekunder</p>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Log ind med din konto for at oprette professionelle tilbud til dine kunder.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Logger ind...' : 'Log ind med Google'}
        </button>

        <p className="text-xs text-gray-400 mt-6">
          Drevet af vimpl · <a href="https://frontend-puce-ten-18.vercel.app/privacy" className="underline" target="_blank" rel="noreferrer">Privatlivspolitik</a>
        </p>
      </div>
    </div>
  );
}
