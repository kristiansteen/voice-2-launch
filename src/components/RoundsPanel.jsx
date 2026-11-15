import { useEffect, useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';
import {
  createRound, listRounds, getRound, closeRound, reopenRound, renewRoundLink,
} from '../services/roundService.js';
import { inviteUrl } from '../lib/roundInvite.js';

const PAID = ['commercial', 'enterprise'];
const PRICING_URL = 'https://ailean.dk/ailean-pricing';

/** The process owner's AS-IS rounds: start one, share its link, follow and read contributions. */
export default function RoundsPanel({ vimplToken, vimplUser, onBack, onContribute, onUseSubmissions, useError }) {
  const { t, lang } = useLang();
  const [rounds, setRounds]     = useState(null);
  const [openId, setOpenId]     = useState(null);
  const [detail, setDetail]     = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError]       = useState(null);
  const canStart = vimplUser?.isAdmin || PAID.includes(vimplUser?.subscriptionTier);

  function load() {
    listRounds(vimplToken).then(setRounds).catch(err => { setRounds([]); setError(err.message); });
  }
  useEffect(load, [vimplToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!openId) { setDetail(null); return; }
    getRound(vimplToken, openId).then(setDetail).catch(err => setError(err.message));
  }, [openId, vimplToken]);

  async function act(fn) {
    setError(null);
    try { setDetail(await fn(vimplToken, detail.id)); load(); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
        <button onClick={openId ? () => setOpenId(null) : onBack} className="text-xs text-gray-500 hover:text-gray-800">
          ← {openId ? t.roundsAll : t.roundToDashboard}
        </button>
        <span className="ailean-logo" style={{ fontSize: '15px' }}>AILEAN</span>
        <span className="w-24" />
      </header>

      <main className="max-w-4xl mx-auto p-4 flex flex-col gap-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}

        {!openId && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{t.roundsTitle}</h1>
                <p className="text-sm text-gray-500">{t.roundsSubtitle}</p>
              </div>
              {canStart
                ? <button onClick={() => setShowForm(v => !v)} className="bg-ink text-paper text-sm font-semibold px-4 py-2 rounded-full hover:bg-ink-hover">{t.roundsNew}</button>
                : <a href={PRICING_URL} target="_blank" rel="noopener noreferrer" className="bg-ink text-paper text-sm font-semibold px-4 py-2 rounded-lg hover:bg-ink-hover">{t.roundsUpgrade}</a>}
            </div>

            {showForm && canStart && (
              <NewRoundForm
                defaultLang={lang}
                onCancel={() => setShowForm(false)}
                onCreate={async round => {
                  setError(null);
                  try {
                    const created = await createRound(vimplToken, round);
                    setShowForm(false); load(); setOpenId(created.id);
                  } catch (err) {
                    setError(err.code === 'PLAN_REQUIRED' ? t.roundsPlanRequired : err.message);
                  }
                }}
              />
            )}

            {rounds === null && <p className="text-sm text-gray-500">{t.roundLoading}</p>}
            {rounds?.length === 0 && !showForm && <p className="text-sm text-gray-500">{t.roundsEmpty}</p>}
            <ul className="flex flex-col gap-2">
              {rounds?.map(r => (
                <li key={r.id}>
                  <button onClick={() => setOpenId(r.id)} className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-violet-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-900">{r.processName}</span>
                      <StatusBadge status={r.status} t={t} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {t.roundsCounts.replace('{opened}', r.counts.opened).replace('{started}', r.counts.started).replace('{submitted}', r.counts.submitted)}
                      {' · '}{new Date(r.createdAt).toLocaleDateString(lang === 'da' ? 'da-DK' : 'en-GB')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {openId && detail && (
          <RoundDetail
            round={detail}
            t={t}
            lang={lang}
            onClose={() => act(closeRound)}
            onReopen={() => act(reopenRound)}
            onRenew={() => { if (window.confirm(t.roundsRenewConfirm)) act(renewRoundLink); }}
            onContribute={() => onContribute(detail.inviteToken)}
            onUse={onUseSubmissions}
            useError={useError}
          />
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status, t }) {
  const cls = status === 'open' ? 'bg-green-50 text-green-700' : status === 'promoted' ? 'bg-violet-50 text-violet-700' : 'bg-gray-100 text-gray-600';
  const label = { open: t.roundsStatusOpen, closed: t.roundsStatusClosed, promoted: t.roundsStatusPromoted }[status] || status;
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>{label}</span>;
}

function NewRoundForm({ defaultLang, onCreate, onCancel }) {
  const { t } = useLang();
  const [f, setF] = useState({ processName: '', startTrigger: '', endPoint: '', language: defaultLang === 'da' ? 'da' : 'en' });
  const [saving, setSaving] = useState(false);
  const valid = f.processName.trim() && f.startTrigger.trim() && f.endPoint.trim();
  const field = (key, label, hint) => (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        value={f[key]} maxLength={200} placeholder={hint}
        onChange={e => setF({ ...f, [key]: e.target.value })}
        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
      />
    </label>
  );
  return (
    <form
      className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3"
      onSubmit={async e => { e.preventDefault(); if (!valid) return; setSaving(true); await onCreate(f); setSaving(false); }}
    >
      {field('processName', t.roundsFieldName, t.roundsFieldNameHint)}
      {field('startTrigger', t.roundsFieldStart, t.roundsFieldStartHint)}
      {field('endPoint', t.roundsFieldEnd, t.roundsFieldEndHint)}
      <label className="block">
        <span className="text-xs font-medium text-gray-600">{t.roundsFieldLang}</span>
        <select value={f.language} onChange={e => setF({ ...f, language: e.target.value })} className="mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2">
          <option value="en">English</option>
          <option value="da">Dansk</option>
        </select>
      </label>
      <div className="flex gap-2">
        <button disabled={!valid || saving} className="bg-ink disabled:opacity-50 text-paper text-sm font-semibold px-4 py-2 rounded-lg hover:bg-ink-hover">{t.roundsCreate}</button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-600 px-4 py-2">{t.roundsCancel}</button>
      </div>
    </form>
  );
}

function RoundDetail({ round, t, lang, onClose, onReopen, onRenew, onContribute, onUse, useError }) {
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState(null);
  const submitted = round.submissions.filter(s => s.status === 'submitted');
  const [selected, setSelected] = useState(() => new Set(submitted.map(s => s.id)));
  const [using, setUsing] = useState(null); // 'review' | 'diagram' while working
  const chosen = submitted.filter(s => selected.has(s.id)).map(s => s.id);
  const toggle = id => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function use(mode) {
    setUsing(mode);
    try { await onUse({ round, submissionIds: chosen, mode }); } finally { setUsing(null); }
  }
  const link = inviteUrl(window.location.origin, round.inviteToken);
  const fmt = d => (d ? new Date(d).toLocaleString(lang === 'da' ? 'da-DK' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const statusLabel = { opened: t.roundsSubOpened, started: t.roundsSubStarted, submitted: t.roundsSubSubmitted };

  return (
    <>
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{round.processName}</h1>
            <p className="text-sm text-gray-500 mt-1">{t.roundStarts}: {round.startTrigger} · {t.roundEnds}: {round.endPoint}</p>
          </div>
          <StatusBadge status={round.status} t={t} />
        </div>

        <div className="mt-4">
          <span className="text-xs font-medium text-gray-600">{t.roundsLink}</span>
          <div className="mt-1 flex gap-2">
            <input readOnly value={link} onFocus={e => e.target.select()} className="flex-1 text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 bg-gray-50" />
            <button
              onClick={() => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
              className="text-sm font-medium text-violet-700 border border-violet-300 bg-violet-50 rounded-lg px-3 py-2 hover:bg-violet-100"
            >{copied ? t.roundsCopied : t.roundsCopy}</button>
          </div>
          <p className="text-xs text-gray-400 mt-1">{t.roundsLinkHint}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {round.status === 'open' && <button onClick={onContribute} className="text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400">{t.roundsContribute}</button>}
          <button onClick={onRenew} className="text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400">{t.roundsRenew}</button>
          {round.status === 'open' && <button onClick={onClose} className="text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400">{t.roundsClose}</button>}
          {round.status === 'closed' && <button onClick={onReopen} className="text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400">{t.roundsReopen}</button>}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-900 px-5 pt-4">{t.roundsParticipants} ({round.submissions.length})</h2>
        {round.submissions.length === 0 && <p className="text-sm text-gray-500 px-5 py-4">{t.roundsNoParticipants}</p>}
        {round.submissions.length > 0 && (
          <table className="w-full text-sm mt-2">
            <tbody>
              {round.submissions.map(s => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="pl-5 py-2 w-6">
                    {s.status === 'submitted' && (
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} aria-label={t.roundsSelect} />
                    )}
                  </td>
                  <td className="px-3 py-2"><div className="font-medium text-gray-800">{s.participantName || s.participantEmail}</div><div className="text-xs text-gray-400">{s.participantEmail}</div></td>
                  <td className="px-2 py-2 text-gray-600">{statusLabel[s.status] || s.status}</td>
                  <td className="px-2 py-2 text-xs text-gray-400">{fmt(s.updatedAt)}</td>
                  <td className="px-5 py-2 text-right">
                    {s.status === 'submitted' && <button onClick={() => setReading(reading?.id === s.id ? null : s)} className="text-xs font-medium text-violet-700 hover:underline">{reading?.id === s.id ? t.roundsHide : t.roundsRead}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {submitted.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-600">
              {chosen.length === 1 ? t.roundsUseOne : t.roundsUseMany.replace('{n}', chosen.length)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button disabled={!chosen.length || !!using} onClick={() => use('review')}
                className="bg-green-400 disabled:opacity-50 text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-300">
                {using === 'review' ? t.roundsUsing : t.roundsUseReview}
              </button>
              <button disabled={!chosen.length || !!using} onClick={() => use('diagram')}
                className="disabled:opacity-50 text-sm font-medium text-gray-700 border border-gray-300 bg-white rounded-lg px-4 py-2 hover:border-violet-400">
                {using === 'diagram' ? t.roundsUsing : t.roundsUseDiagram}
              </button>
            </div>
            {useError && <p className="mt-2 text-xs text-red-600">{useError}</p>}
            <p className="mt-2 text-[11px] text-gray-400">{t.roundsUseSnapshot}</p>
          </div>
        )}
      </section>

      {reading && (
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900">{reading.participantName || reading.participantEmail}</h2>
          <ol className="mt-3 space-y-1.5 list-decimal list-inside text-sm text-gray-800">
            {(reading.contribution?.description?.steps || []).map((step, i) => (
              <li key={i}><span className="font-medium">{step.name}</span>{step.performer && <span className="text-gray-500"> — {step.performer}</span>}{step.description && <p className="text-xs text-gray-500 ml-5">{step.description}</p>}</li>
            ))}
          </ol>
          <details className="mt-4">
            <summary className="text-xs font-medium text-gray-600 cursor-pointer">{t.roundsTranscript}</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3 max-h-96 overflow-auto">{reading.contribution?.transcript}</pre>
          </details>
        </section>
      )}
    </>
  );
}
