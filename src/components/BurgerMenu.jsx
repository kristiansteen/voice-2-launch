import { useState, useRef } from 'react';
import TaxonomyPanel from './TaxonomyPanel.jsx';
import { useLang } from '../i18n/LangContext.jsx';

const CUSTOM_TAX_KEY = 'voice2bpmn_custom_taxonomy';

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        <span className="text-gray-400 text-xs">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function BurgerMenu({
  open, onClose,
  apiKey, onApiKeyChange,
  vimplToken, onLoginGoogle, onLoginVimpl, onLogout,
  parsed, processContext,
  customTaxonomyNodes, onTaxonomyChange,
}) {
  const { t } = useLang();
  const [draftKey, setDraftKey] = useState(apiKey || '');
  const fileRef = useRef(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadName, setUploadName] = useState(() => {
    try { return localStorage.getItem(CUSTOM_TAX_KEY + '_name') || null; } catch { return null; }
  });

  function handleSaveKey() {
    onApiKeyChange(draftKey.trim());
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const nodes = JSON.parse(ev.target.result);
        if (!Array.isArray(nodes) || !nodes[0]?.id || !nodes[0]?.name || !nodes[0]?.level) {
          throw new Error('Expected array of { id, name, level, parentId? }');
        }
        localStorage.setItem(CUSTOM_TAX_KEY, JSON.stringify(nodes));
        localStorage.setItem(CUSTOM_TAX_KEY + '_name', file.name);
        setUploadName(file.name);
        onTaxonomyChange(nodes);
      } catch (err) {
        setUploadError(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleClearTaxonomy() {
    localStorage.removeItem(CUSTOM_TAX_KEY);
    localStorage.removeItem(CUSTOM_TAX_KEY + '_name');
    setUploadName(null);
    onTaxonomyChange(null);
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 z-50 h-full w-[420px] bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 bg-gray-900">
          <span className="text-sm font-semibold text-white">Settings</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-sm px-1"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── API Key ───────────────────────────────────────────── */}
          <Section title="Bring your own key" defaultOpen={!apiKey}>
            <div className="space-y-2">
              <input
                type="password"
                value={draftKey}
                onChange={e => setDraftKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                placeholder="sk-ant-..."
                className="w-full text-xs border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-green-400 font-mono"
              />
              <button
                onClick={handleSaveKey}
                disabled={!draftKey.trim()}
                className="w-full text-xs font-medium bg-vimpl text-black py-2 rounded hover:bg-vimpl-dark hover:text-white disabled:opacity-40 transition-colors"
              >
                {apiKey ? 'Update key' : 'Save key'}
              </button>
              {apiKey && (
                <p className="text-[10px] text-green-600 text-center">Key set ✓</p>
              )}
            </div>
          </Section>

          {/* ── Account ───────────────────────────────────────────── */}
          <Section title="Account" defaultOpen={!vimplToken}>
            {vimplToken ? (
              <button
                onClick={onLogout}
                className="w-full text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-3 py-2 hover:bg-red-50 transition-colors"
              >
                Log out
              </button>
            ) : (
              <button
                onClick={onLoginGoogle}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Login with Google
              </button>
            )}
          </Section>

          {/* ── Repository ────────────────────────────────────────── */}
          <Section title="Repository">
            {/* Taxonomy source */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Process taxonomy</span>
                {customTaxonomyNodes ? (
                  <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                    Custom
                  </span>
                ) : (
                  <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                    APQC
                  </span>
                )}
              </div>

              {uploadName && (
                <p className="text-[10px] text-gray-500 mb-2 truncate">
                  {uploadName} · {customTaxonomyNodes?.length} nodes
                </p>
              )}

              {uploadError && (
                <p className="text-[10px] text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1 mb-2">
                  {uploadError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 text-xs border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 py-1.5 rounded transition-colors"
                >
                  Upload JSON taxonomy
                </button>
                {customTaxonomyNodes && (
                  <button
                    onClick={handleClearTaxonomy}
                    className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded px-2 py-1 hover:bg-red-50 transition-colors"
                    title="Revert to APQC"
                  >
                    ✕ APQC
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileUpload}
              />
              <p className="text-[10px] text-gray-400 mt-1.5">
                JSON: <span className="font-mono">[{'{'}id, name, level, parentId?{'}'}]</span>
              </p>
            </div>

            {/* Taxonomy browser + saved processes */}
            <div className="border border-gray-100 rounded-lg overflow-hidden" style={{ height: 480 }}>
              <TaxonomyPanel parsed={parsed} processContext={processContext} />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
