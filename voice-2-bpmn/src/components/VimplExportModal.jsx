import { useState, useEffect } from 'react';
import { exportToVimpl } from '../services/vimplService.js';

const STORAGE_KEY = 'voice2bpmn_vimpl_config';

export default function VimplExportModal({ projectPlan, processName, selectedImprovements = [], onClose }) {
  const [baseUrl, setBaseUrl] = useState('http://localhost:3001');
  const [token, setToken] = useState('');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved.baseUrl) setBaseUrl(saved.baseUrl);
      if (saved.token) setToken(saved.token);
    } catch { /* ignore */ }
  }, []);

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseUrl, token }));
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await exportToVimpl(projectPlan, processName, { baseUrl, token }, selectedImprovements);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-[420px] mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-medium text-sm">Export to vimpl-saas</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm px-1">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">vimpl-saas URL</label>
            <input
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              className="mt-1 w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400"
              placeholder="http://localhost:3001"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">JWT Token</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="mt-1 w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400"
              placeholder="Bearer token..."
            />
          </div>

          <button
            onClick={saveSettings}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            Save settings
          </button>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          {result && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 space-y-1">
              <p>Board created successfully!</p>
              <p>{result.tasksCreated} tasks created.</p>
              <a
                href={result.boardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline break-all"
              >
                {result.boardUrl}
              </a>
            </div>
          )}
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 text-sm border border-gray-200 rounded py-2 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!token || !baseUrl || exporting}
            className="flex-1 bg-orange-500 text-white text-sm font-medium py-2 rounded hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              'Export Now'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
