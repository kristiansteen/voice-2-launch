import { useEffect, useState } from 'react';
import {
  getRoundForFlow, startRoundForFlow, linkRoundToFlow, sendInvites, remindInvites, removeInvite,
  closeRound, reopenRound, renewRoundLink,
} from '../services/roundService.js';
import { inviteUrl } from '../lib/roundInvite.js';
import { splitEmails, shareSummary } from '../lib/shareRound.js';

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), s);

const STATUS_STYLE = {
  invited: 'text-mid border-line',
  opened: 'text-mid border-line',
  started: 'text-signal-700 border-signal-200 bg-signal-50',
  submitted: 'text-white border-ink bg-ink',
};

// "Share" in the Describe step: ask colleagues by email to describe this flow's process.
// Answers come back as submissions; "Combine" merges them into this flow for Review.
export default function ShareFlow({
  token, flowId, processName, startTrigger, endPoint, lang, t, owner,
  linkedRoundId, hasOwnDescription, onCombine,
}) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(null);       // null = not loaded or none yet
  const [loaded, setLoaded] = useState(false);
  const [emails, setEmails] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);         // 'send' | 'remind' | 'combine' | 'link'
  const [message, setMessage] = useState(null);   // { kind: 'ok' | 'error', text }
  const [copied, setCopied] = useState(false);

  // A different flow: start over
  useEffect(() => { setRound(null); setLoaded(false); setMessage(null); }, [flowId]);

  useEffect(() => {
    if (!open || loaded || !token || !flowId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getRoundForFlow(token, flowId);
        if (!cancelled) setRound(r);
      } catch (err) {
        // A flow made from an older round: attach that round to the flow
        if (err.status === 404 && linkedRoundId) {
          try { const r = await linkRoundToFlow(token, linkedRoundId, flowId); if (!cancelled) setRound(r); } catch { /* none */ }
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, loaded, token, flowId, linkedRoundId]);

  async function ensureRound() {
    if (round) return round;
    const r = await startRoundForFlow(token, {
      flowId, processName: processName || 'Process', startTrigger: startTrigger || '', endPoint: endPoint || '', language: lang,
    });
    setRound(r);
    return r;
  }

  function errorText(err) {
    if (err?.code === 'PLAN_REQUIRED') return t.sharePlanRequired;
    if (err?.code === 'INVALID_EMAILS') return fill(t.shareInvalid, { list: (err.data?.invalid || []).join(', ') });
    if (err?.code === 'TOO_MANY_INVITES') return t.shareTooMany;
    return t.shareError;
  }

  async function handleSend() {
    const { valid, invalid } = splitEmails(emails);
    if (invalid.length) { setMessage({ kind: 'error', text: fill(t.shareInvalid, { list: invalid.join(', ') }) }); return; }
    if (!valid.length) return;
    setBusy('send'); setMessage(null);
    try {
      const r = await ensureRound();
      const res = await sendInvites(token, r.id, { emails: valid, note });
      setRound(res.round);
      const parts = [];
      if (res.sent.length) parts.push(fill(t.shareSent, { n: res.sent.length }));
      if (res.alreadyInvited.length) parts.push(fill(t.shareAlready, { n: res.alreadyInvited.length }));
      if (res.failed.length) parts.push(fill(t.shareFailed, { list: res.failed.join(', ') }));
      setMessage({ kind: res.failed.length ? 'error' : 'ok', text: parts.join(' ') });
      if (!res.failed.length) { setEmails(''); setNote(''); }
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err) });
    } finally { setBusy(null); }
  }

  async function handleCopy() {
    setMessage(null);
    try {
      const r = await ensureRound();
      await navigator.clipboard?.writeText(inviteUrl(window.location.origin, r.inviteToken));
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch (err) { setMessage({ kind: 'error', text: errorText(err) }); }
  }

  async function handleRemind() {
    setBusy('remind'); setMessage(null);
    try {
      const res = await remindInvites(token, round.id);
      setRound(res.round);
      setMessage({ kind: res.failed.length ? 'error' : 'ok', text: fill(t.shareReminded, { n: res.sent.length }) });
    } catch (err) { setMessage({ kind: 'error', text: errorText(err) }); } finally { setBusy(null); }
  }

  async function handleRemove(inviteId) {
    try { setRound(await removeInvite(token, round.id, inviteId)); } catch (err) { setMessage({ kind: 'error', text: errorText(err) }); }
  }

  async function handleStatus(action) {
    if (action === 'renew' && !window.confirm(t.shareNewLinkConfirm)) return;
    setBusy(action); setMessage(null);
    try {
      const fn = action === 'close' ? closeRound : action === 'reopen' ? reopenRound : renewRoundLink;
      setRound(await fn(token, round.id));
      if (action === 'renew') setMessage({ kind: 'ok', text: t.shareNewLinkDone });
    } catch (err) { setMessage({ kind: 'error', text: errorText(err) }); } finally { setBusy(null); }
  }

  async function handleCombine() {
    setBusy('combine'); setMessage(null);
    try {
      const ok = await onCombine(round);
      if (ok) setOpen(false);
      else setMessage({ kind: 'error', text: t.roundsUseFailed });
    } finally { setBusy(null); }
  }

  const summary = shareSummary(round, owner?.email);
  const invitedEmails = new Set((round?.invites || []).map(i => i.email.toLowerCase()));
  const ownerEmail = (owner?.email || '').toLowerCase();
  const viaLink = (round?.submissions || []).filter(s => {
    const e = (s.participantEmail || '').toLowerCase();
    return e && e !== ownerEmail && !invitedEmails.has(e);
  });
  const answers = summary.described;
  const canCombine = answers >= 1 && (hasOwnDescription || answers >= 2);
  const closed = round?.status === 'closed';

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={[
          'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border transition-all',
          open ? 'border-ink text-ink' : 'text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800',
        ].join(' ')}
      >
        <svg className="shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
        </svg>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-xs font-semibold">
            {t.shareButton}{summary.people > 0 && <span className="ml-1 tabular-nums text-mid">{summary.described}/{summary.people}</span>}
          </span>
          <span className="text-[9px] font-normal opacity-60">{t.shareButtonSub}</span>
        </span>
      </button>

      {open && (
        <div className="absolute right-3 top-14 z-30 w-[min(560px,calc(100%-1.5rem))] max-h-[calc(100%-4.5rem)] overflow-y-auto rounded-[10px] border border-line bg-white shadow-xl p-5 text-ink" role="dialog" aria-label={t.shareTitle}>
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className="text-base font-semibold">{t.shareTitle}</h3>
            <button onClick={() => setOpen(false)} className="text-xs text-mid hover:text-ink" aria-label={t.shareClose}>✕</button>
          </div>
          <p className="text-sm text-mid leading-relaxed mb-4">{t.shareIntro}</p>
          {closed && (
            <p className="mb-4 px-3 py-2 rounded-lg bg-gray-50 border border-line text-xs text-ink">{t.shareClosedNote}</p>
          )}

          <label className="block text-xs font-medium mb-1" htmlFor="share-emails">{t.shareEmailsLabel}</label>
          <textarea
            id="share-emails" rows={2} value={emails} onChange={e => setEmails(e.target.value)}
            placeholder={t.shareEmailsPlaceholder}
            className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-ink resize-none mb-3"
          />
          <label className="block text-xs font-medium mb-1" htmlFor="share-note">{t.shareNoteLabel}</label>
          <textarea
            id="share-note" rows={2} value={note} maxLength={500} onChange={e => setNote(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-ink resize-none mb-3"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSend} disabled={closed || busy === 'send' || !emails.trim()}
              className="px-4 py-2 rounded-full bg-ink text-white text-sm font-semibold hover:bg-ink-hover disabled:opacity-50 transition"
            >{busy === 'send' ? t.shareSending : t.shareSend}</button>
            <button onClick={handleCopy} className="px-4 py-2 rounded-full border border-line text-sm font-medium hover:border-ink transition">
              {copied ? t.shareCopied : t.shareCopyLink}
            </button>
          </div>
          {message && (
            <p className={`mt-3 text-xs ${message.kind === 'error' ? 'text-red-700' : 'text-mid'}`} role="status">{message.text}</p>
          )}

          {(round?.invites?.length > 0 || viaLink.length > 0) && (
            <div className="mt-5 pt-4 border-t border-line">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">{fill(t.sharePeople, { described: summary.described, people: summary.people })}</p>
                <button
                  onClick={handleRemind} disabled={closed || busy === 'remind' || summary.remindable === 0}
                  title={summary.remindable === 0 ? t.shareRemindNone : undefined}
                  className="text-xs font-medium underline underline-offset-2 disabled:no-underline disabled:text-gray-400"
                >{fill(t.shareRemind, { n: summary.remindable })}</button>
              </div>
              <ul className="divide-y divide-gray-100">
                {(round?.invites || []).map(i => (
                  <li key={i.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="flex-1 min-w-0 truncate">{i.name || i.email}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[i.status]}`}>{t.shareStatus[i.status]}</span>
                    {i.status !== 'submitted' && (
                      <button onClick={() => handleRemove(i.id)} className="text-[11px] text-mid hover:text-red-700" aria-label={`${t.shareRemove} ${i.email}`}>{t.shareRemove}</button>
                    )}
                  </li>
                ))}
                {viaLink.map(s => (
                  <li key={s.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="flex-1 min-w-0 truncate">{s.participantName || s.participantEmail} <span className="text-[11px] text-mid">· {t.shareViaLink}</span></span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[s.status] || STATUS_STYLE.opened}`}>{t.shareStatus[s.status] || s.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {answers > 0 && (
            <div className="mt-5 pt-4 border-t border-line">
              <button
                onClick={handleCombine} disabled={!canCombine || busy === 'combine'}
                className="w-full py-2.5 rounded-full bg-signal text-white text-sm font-semibold hover:bg-signal-600 disabled:opacity-50 transition"
              >{busy === 'combine' ? t.shareCombining : fill(t.shareCombine, { n: answers + (hasOwnDescription ? 1 : 0) })}</button>
              <p className="mt-2 text-[11px] text-mid text-center">{t.shareCombineNote}</p>
            </div>
          )}

          {round && (
            <div className="mt-5 pt-3 border-t border-line flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mid">
              {closed ? (
                <button onClick={() => handleStatus('reopen')} disabled={!!busy} className="underline underline-offset-2 hover:text-ink">{t.shareReopen}</button>
              ) : (
                <button onClick={() => handleStatus('close')} disabled={!!busy} className="underline underline-offset-2 hover:text-ink">{t.shareStop}</button>
              )}
              <button onClick={() => handleStatus('renew')} disabled={!!busy} className="underline underline-offset-2 hover:text-ink">{t.shareNewLink}</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
