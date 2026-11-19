import { useEffect, useRef, useState } from 'react';
import { EXPORT_FORMATS } from '../lib/exportFormats.js';
import { useLang } from '../i18n/LangContext.jsx';

// One "Export" button with a menu of formats (see lib/exportFormats.js).
// handlers: { [formatId]: () => void }, disabled: { [formatId]: bool }
export default function ExportMenu({ handlers, disabled = {}, busy = false, error = null }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    const first = itemRefs.current.find(el => el && !el.disabled);
    first?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function onKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); wrapRef.current?.querySelector('button')?.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = itemRefs.current.filter(el => el && !el.disabled);
    const i = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onKeyDown}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={error || undefined}
        className="text-xs font-medium text-ink border border-line rounded-full px-3 py-1.5 bg-white hover:border-ink transition-colors whitespace-nowrap flex items-center gap-1.5"
      >
        {busy && <span className="inline-block w-3 h-3 border-2 border-line border-t-ink rounded-full animate-spin" />}
        {error && !busy && <span aria-hidden="true">⚠</span>}
        {t.exportMenu}
        <span aria-hidden="true" className="text-mid">▾</span>
      </button>
      {open && (
        <div role="menu" aria-label={t.exportMenu}
          className="absolute right-0 mt-1 z-50 w-72 bg-white border border-line rounded-[10px] shadow-lg py-1">
          {EXPORT_FORMATS.map((f, i) => (
            <button
              key={f.id}
              ref={el => (itemRefs.current[i] = el)}
              role="menuitem"
              disabled={!!disabled[f.id] || !handlers[f.id]}
              onClick={() => { setOpen(false); handlers[f.id]?.(); }}
              className="w-full text-left px-3 py-2 hover:bg-paper focus:bg-paper focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink">{t[f.labelKey]}</span>
                <span className="text-[11px] text-mid tabular-nums">{f.ext}</span>
              </span>
              <span className="block text-xs text-mid mt-0.5">{t[f.hintKey]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
