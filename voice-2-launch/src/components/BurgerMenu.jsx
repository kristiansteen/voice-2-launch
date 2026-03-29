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
  vimplToken, vimplUser, onLogout,
  onNewFlow, onOverview,
  parsed, processContext,
  customTaxonomyNodes, onTaxonomyChange,
}) {
  const fileRef = useRef(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadName, setUploadName] = useState(() => {
    try { return localStorage.getItem(CUSTOM_TAX_KEY + '_name') || null; } catch { return null; }
  });

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
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-white">Settings</span>
            {vimplUser?.email && (
              <span className="text-xs text-gray-400">{vimplUser.email}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-sm px-1"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Navigation ────────────────────────────────────────── */}
          <div className="px-4 py-3 border-b border-gray-100 space-y-1">
            <button
              onClick={() => { onOverview?.(); onClose(); }}
              className="flex items-center gap-2 w-full text-xs text-gray-600 hover:text-gray-900 py-1.5 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/>
              </svg>
              Overview
            </button>
            <button
              onClick={() => { onNewFlow?.(); onClose(); }}
              className="flex items-center gap-2 w-full text-xs text-gray-600 hover:text-gray-900 py-1.5 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Start new process
            </button>
          </div>

          {/* ── Account ───────────────────────────────────────────── */}
          <Section title="Account" defaultOpen>
            {vimplUser && (
              <p className="text-xs text-gray-500 mb-3">
                Signed in as <span className="font-medium text-gray-700">{vimplUser.email}</span>
              </p>
            )}
            {vimplToken && (
              <button
                onClick={onLogout}
                className="w-full text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-3 py-2 hover:bg-red-50 transition-colors"
              >
                Log out
              </button>
            )}
          </Section>

          {/* ── Repository ────────────────────────────────────────── */}
          <Section title="Repository">
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

            <div className="border border-gray-100 rounded-lg overflow-hidden" style={{ height: 480 }}>
              <TaxonomyPanel parsed={parsed} processContext={processContext} />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
