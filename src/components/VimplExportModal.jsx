import { useState, useEffect } from 'react';
import { exportToVimpl } from '../services/vimplService.js';

const STORAGE_KEY = 'voice2bpmn_vimpl_config';
const VIMPL_LOGIN_URL = 'https://frontend-puce-ten-18.vercel.app/login.html';
const VIMPL_BASE_URL = 'https://backend-eight-rho-46.vercel.app';

export default function VimplExportModal({ projectPlan, processName, selectedImprovements = [], processDescription = null, onClose }) {
  const [token, setToken] = useState('');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if vimpl redirected back here with a token in the URL
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: urlToken }));
      // Clean the token from the URL without reloading
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', clean);
      return;
    }

    // Fall back to stored token
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved.token) setToken(saved.token);
    } catch { /* ignore */ }
  }, []);

  function loginWithVimpl() {
    const returnTo = window.location.href.split('?')[0]; // current page without params
    window.location.href = `${VIMPL_LOGIN_URL}?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function logout() {
    setToken('');
    localStorage.removeItem(STORAGE_KEY);
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await exportToVimpl(
        projectPlan,
        processName,
        { baseUrl: VIMPL_BASE_URL, token },
        selectedImprovements,
        processDescription
      );
      setResult(res);
    } catch (err) {
      // If 401, clear the stored token so they can re-login
      if (err.message?.includes('401') || err.message?.toLowerCase().includes('unauthorized')) {
        setToken('');
        localStorage.removeItem(STORAGE_KEY);
      }
      setError(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-[420px] mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-medium text-sm">Export to vimpl</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm px-1">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {!token ? (
            // ── Not logged in ──────────────────────────────────────────────
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Log in to your vimpl account to export this plan as a board.
              </p>
              <button
                onClick={loginWithVimpl}
                className="w-full bg-vimpl text-black text-sm font-semibold py-2.5 rounded hover:bg-vimpl-dark hover:text-white transition-colors"
              >
                Log in with vimpl
              </button>
            </div>
          ) : (
            // ── Logged in ──────────────────────────────────────────────────
            <>
              <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
                <span>Logged in to vimpl</span>
                <button onClick={logout} className="text-red-400 hover:text-red-600">Log out</button>
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}

              {result && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 space-y-1">
                  <p>Board created successfully! {result.tasksCreated} tasks created.</p>
                  <a
                    href={result.boardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline break-all"
                  >
                    Open in vimpl →
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 text-sm border border-gray-200 rounded py-2 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {token && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 bg-vimpl text-black text-sm font-medium py-2 rounded hover:bg-vimpl-dark hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                'Export to vimpl'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
