import { useEffect, useRef, useState } from 'react';
import { trustFacts } from '../lib/trust.js';
import { useLang } from '../i18n/LangContext.jsx';

const OFFLINE = import.meta.env.VITE_OFFLINE === 'true';

function Lock() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

// Header badge that tells clients where their data goes; opens a short panel.
export default function TrustBadge({ compact = false }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const facts = trustFacts({ offline: OFFLINE });

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') { setOpen(false); wrapRef.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="trust-panel"
        title={t.trustTitle}
        className="text-xs font-medium text-ink border border-ink rounded-full px-3 py-1.5 bg-panel hover:bg-ink hover:text-paper transition-colors whitespace-nowrap flex items-center gap-1.5"
      >
        <Lock />
        {compact ? <span className="sr-only">{t[facts.badgeKey]}</span> : t[facts.badgeKey]}
      </button>
      {open && (
        <div id="trust-panel" role="dialog" aria-label={t.trustTitle}
          className="absolute right-0 mt-2 z-50 w-80 bg-white border border-line rounded-[10px] shadow-lg p-4 text-left">
          <p className="text-[11px] uppercase tracking-[0.12em] text-mid mb-2">{t.trustTitle}</p>
          <ul className="space-y-2">
            {facts.items.map(k => (
              <li key={k} className="flex gap-2 text-sm text-ink leading-snug">
                <span aria-hidden="true" className="mt-[7px] w-1.5 h-1.5 rounded-full bg-ink shrink-0" />
                <span>{t[k]}</span>
              </li>
            ))}
          </ul>
          {facts.links.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line flex flex-wrap gap-x-4 gap-y-1">
              {facts.links.map(l => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer"
                  className="text-xs text-ink underline underline-offset-2 hover:text-signal">
                  {t[l.labelKey]}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
