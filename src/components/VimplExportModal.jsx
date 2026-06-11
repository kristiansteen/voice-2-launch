import { useState, useEffect } from 'react';
import { exportToVimpl, updateVimplBoard } from '../services/vimplService.js';

const VIMPL_LOGIN_URL = 'https://app.vimpl.com/login.html';
const VIMPL_BASE_URL = 'https://backend-eight-rho-46.vercel.app';

export default function VimplExportModal({ projectPlan, processName, selectedImprovements = [], processDescription = null, invitees = [], onClose, onExported, vimplToken: propToken, boardId, boardVersion = 1 }) {
  const [token, setToken] = useState(propToken || '');
  const [mode, setMode] = useState(boardId ? 'update' : 'create'); // 'update' | 'create'
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Sync if propToken arrives after mount (e.g. auth completes while modal is open)
  useEffect(() => {
    if (propToken && !token) setToken(propToken);
  }, [propToken]); // eslint-disable-line react-hooks/exhaustive-deps

  function loginWithVimpl() {
    const returnTo = window.location.href.split('?')[0];
    window.location.href = `${VIMPL_LOGIN_URL}?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function logout() {
    setToken('');
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    setResult(null);
    try {
      const cfg = { baseUrl: VIMPL_BASE_URL, token };
      const isNewBoard = mode === 'create' || !boardId;
      const nextVersion = isNewBoard ? boardVersion + 1 : boardVersion;
      const versionedPlanName = isNewBoard && nextVersion > 1
        ? `${projectPlan.plan_name || processName} — v${nextVersion}`
        : (projectPlan.plan_name || processName);
      const versionedPlan = { ...projectPlan, plan_name: versionedPlanName };
      const res = !isNewBoard && boardId
        ? await updateVimplBoard(boardId, versionedPlan, processName, cfg, selectedImprovements, processDescription)
        : await exportToVimpl(versionedPlan, processName, cfg, selectedImprovements, processDescription, invitees);
      setResult(res);
      if (onExported) onExported(res.boardId, res.boardUrl, isNewBoard);
    } catch (err) {
      if (err.message?.includes('401') || err.message?.toLowerCase().includes('unauthorized')) {
        if (!propToken) setToken('');
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
            <>
              <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
                <span>Logged in to vimpl</span>
                <button onClick={logout} className="text-red-400 hover:text-red-600">Log out</button>
              </div>

              {/* Mode picker — only shown when a board already exists */}
              {boardId && (
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  <button
                    onClick={() => setMode('update')}
                    className={`flex-1 px-3 py-2 transition-colors ${mode === 'update' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    ↻ Update existing board
                  </button>
                  <button
                    onClick={() => setMode('create')}
                    className={`flex-1 px-3 py-2 transition-colors ${mode === 'create' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    + New board {boardVersion > 0 ? `(v${boardVersion + 1})` : ''}
                  </button>
                </div>
              )}
              {mode === 'update' && boardId && (
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Tasks will be replaced with the new plan. Manually added content and team members are kept.
                </p>
              )}

              {invitees.length > 0 && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
                  <span className="font-medium text-gray-600">Inviting: </span>
                  {invitees.join(', ')}
                </div>
              )}

              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}

              {result && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 space-y-1">
                  <p>{mode === 'update' ? 'Board updated.' : 'Board created.'} {result.tasksCreated} tasks {mode === 'update' ? 'synced' : 'created'}{mode === 'create' && invitees.length > 0 ? `, ${invitees.length} invite${invitees.length !== 1 ? 's' : ''} sent` : ''}.</p>
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
                mode === 'update' ? '↻ Update vimpl board' : 'Export to vimpl'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
