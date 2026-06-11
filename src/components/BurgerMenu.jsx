import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

const BOOK_URL = 'https://calendar.app.google/kwF1TaAHfsXkPn3p6';

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
  currentFlowId, flowName,
}) {
  const { t, lang, setLang } = useLang();
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('idle'); // idle | sending | sent | error

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
