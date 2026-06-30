import { useState, useRef, useCallback } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

const BOOK_URL = 'https://calendar.app.google/kwF1TaAHfsXkPn3p6';

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
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
  currentFlowId, flowName,
  companyLogo, onLogoChange, onLogoRemove,
  systemRepository = [], onAddSystem, onRemoveSystem, onImportSystems,
}) {
  const { t, lang, setLang } = useLang();
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('idle'); // idle | sending | sent | error
  const [logoError, setLogoError] = useState(null);
  const logoInputRef = useRef(null);
  const systemFileRef = useRef(null);
  const [newSystem, setNewSystem] = useState('');

  function handleSystemFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { onImportSystems?.(ev.target.result || ''); };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleAddSystem(e) {
    e?.preventDefault();
    if (!newSystem.trim()) return;
    onAddSystem?.(newSystem);
    setNewSystem('');
  }

  async function handleLogoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    try {
      const dataUrl = await onLogoChange(file);
      if (!dataUrl) return;
    } catch (err) {
      setLogoError(err.message || 'Upload failed');
    }
    e.target.value = '';
  }

  if (!open) return null;

  async function submitFeedback() {
    if (!feedbackMsg.trim()) return;
    setFeedbackStatus('sending');
    const flowInfo = currentFlowId ? ` [Flow: ${flowName || currentFlowId}]` : '';
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: feedbackMsg,
          page: `ailean.dk/app${flowInfo}`,
        }),
      });
      setFeedbackStatus(res.ok ? 'sent' : 'error');
    } catch {
      setFeedbackStatus('error');
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 z-50 h-full w-[420px] bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 bg-gray-900">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-white">{t.menuSettings}</span>
            {vimplUser?.email && (
              <span className="text-xs text-gray-400">{vimplUser.email}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-sm px-1">✕</button>
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
              {t.menuOverview}
            </button>
            <button
              onClick={() => { onNewFlow?.(); onClose(); }}
              className="flex items-center gap-2 w-full text-xs text-gray-600 hover:text-gray-900 py-1.5 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              {t.menuNewProcess}
            </button>
          </div>

          {/* ── Language ─────────────────────────────────────────── */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">{t.menuLanguage}</span>
            <div className="flex rounded-md overflow-hidden border border-gray-200">
              {[['en', 'EN'], ['da', 'DA']].map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={[
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    lang === code
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Book a session ────────────────────────────────────── */}
          <div className="px-4 py-3 border-b border-gray-100">
            <a
              href={`${BOOK_URL}${currentFlowId ? `?flowId=${currentFlowId}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg px-4 py-2.5 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {t.menuBookSession}
            </a>
          </div>

          {/* ── Feedback ──────────────────────────────────────────── */}
          <Section title={t.menuFeedbackTitle}>
            <p className="text-xs text-gray-500 mb-2">{t.menuFeedbackDesc}</p>
            {feedbackStatus === 'sent' ? (
              <p className="text-xs text-green-600 font-medium">{t.menuFeedbackThanks}</p>
            ) : (
              <>
                <textarea
                  rows={3}
                  value={feedbackMsg}
                  onChange={e => setFeedbackMsg(e.target.value)}
                  placeholder={t.menuFeedbackPh}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-purple-400 mb-2"
                />
                {feedbackStatus === 'error' && (
                  <p className="text-xs text-red-500 mb-1">{t.menuFeedbackError}</p>
                )}
                <button
                  onClick={submitFeedback}
                  disabled={feedbackStatus === 'sending' || !feedbackMsg.trim()}
                  className="w-full text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-40 rounded-lg px-3 py-2 transition-colors"
                >
                  {feedbackStatus === 'sending' ? t.menuFeedbackSending : t.menuFeedbackSend}
                </button>
              </>
            )}
          </Section>

          {/* ── System Repository ────────────────────────────────── */}
          <Section title={lang === 'da' ? 'System Repository' : 'System Repository'} defaultOpen={systemRepository.length > 0}>
            <p className="text-xs text-gray-500 mb-3">
              {lang === 'da'
                ? 'Tilføj de systemer, der bruges i jeres processer. Vælg systemet for hvert processtrin i diagrammet.'
                : 'Add the systems used in your processes. You can then tag each process step with the system it runs in.'}
            </p>

            {/* Add manually */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newSystem}
                onChange={e => setNewSystem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSystem(e); }}
                placeholder={lang === 'da' ? 'Tilføj system…' : 'Add system…'}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400"
              />
              <button
                type="button"
                onClick={handleAddSystem}
                disabled={!newSystem.trim()}
                className="text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-40 rounded-lg px-3 py-2 transition-colors"
              >
                {lang === 'da' ? 'Tilføj' : 'Add'}
              </button>
            </div>

            {/* Upload file */}
            <button
              onClick={() => systemFileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg px-3 py-2 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50/30 transition-colors mb-3"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {lang === 'da' ? 'Upload fil (CSV / TXT, én per linje)' : 'Upload file (CSV / TXT, one per line)'}
            </button>
            <input ref={systemFileRef} type="file" accept=".csv,.txt,text/plain,text/csv" className="hidden" onChange={handleSystemFile} />

            {/* List */}
            {systemRepository.length > 0 ? (
              <ul className="space-y-1">
                {systemRepository.map(s => (
                  <li key={s} className="flex items-center justify-between gap-2 text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="truncate">{s}</span>
                    <button
                      onClick={() => onRemoveSystem?.(s)}
                      className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      aria-label="Remove"
                    >✕</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-300 italic text-center py-2">
                {lang === 'da' ? 'Ingen systemer tilføjet endnu' : 'No systems added yet'}
              </p>
            )}
          </Section>

          {/* ── Company profile ──────────────────────────────────── */}
          <Section title={lang === 'da' ? 'Virksomhedsprofil' : 'Company profile'} defaultOpen={!!companyLogo}>
            <p className="text-xs text-gray-500 mb-3">
              {lang === 'da'
                ? 'Upload jeres firmalogo. Det vil blive brugt som header i fremtidige dokumenter (SOP\'er m.m.).'
                : 'Upload your company logo. It will appear as a header in all downloadable documents (SOPs etc.).'}
            </p>

            {companyLogo ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <img src={companyLogo} alt="Company logo" className="h-10 max-w-[140px] object-contain" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 font-medium truncate">
                      {lang === 'da' ? 'Logo uploadet' : 'Logo uploaded'}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {lang === 'da' ? 'Bruges i alle dokumenter' : 'Used in all documents'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors text-gray-600"
                  >
                    {lang === 'da' ? 'Skift logo' : 'Change logo'}
                  </button>
                  <button
                    onClick={() => { onLogoRemove(); setLogoError(null); }}
                    className="text-xs border border-red-200 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors"
                  >
                    {lang === 'da' ? 'Fjern' : 'Remove'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-5 hover:border-purple-300 hover:bg-purple-50/30 transition-colors group"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-purple-400 transition-colors">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                </svg>
                <span className="text-xs text-gray-400 group-hover:text-purple-500 transition-colors">
                  {lang === 'da' ? 'Klik for at uploade logo' : 'Click to upload logo'}
                </span>
                <span className="text-[11px] text-gray-300">PNG, JPG, SVG</span>
              </button>
            )}

            {logoError && (
              <p className="text-[11px] text-red-500 mt-1">{logoError}</p>
            )}

            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />
          </Section>

          {/* ── Account ───────────────────────────────────────────── */}
          <Section title={t.menuAccount} defaultOpen>
            {vimplUser && (
              <p className="text-xs text-gray-500 mb-3">
                {t.menuSignedIn} <span className="font-medium text-gray-700">{vimplUser.email}</span>
              </p>
            )}
            {vimplToken && (
              <button
                onClick={onLogout}
                className="w-full text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-3 py-2 hover:bg-red-50 transition-colors"
              >
                {t.menuLogout}
              </button>
            )}
          </Section>
        </div>

        {/* Powered by vimpl */}
        <div className="px-4 py-4 border-t border-gray-100 flex justify-center">
          <a href="https://app.vimpl.com/about" target="_blank" rel="noopener noreferrer" className="ailean-badge">
            <span>Powered by</span>
            <span className="vimpl-wordmark" style={{ fontSize: '22px', lineHeight: 1 }}>vimpl</span>
          </a>
        </div>
      </div>
    </>
  );
}
