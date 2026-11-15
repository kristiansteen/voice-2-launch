import { useEffect, useRef, useState } from 'react';
import VoicePanel from './VoicePanel.jsx';
import { useLang } from '../i18n/LangContext.jsx';
import { getInvitation, saveContribution, withdrawContribution } from '../services/roundService.js';
import { scopeContextMessage } from '../lib/roundInvite.js';
import { buildStructuredTranscript } from '../lib/transcript.js';
import {
  checkContentSafety, parseVoiceToDescription, parseToBpmn, extractProcessMetrics,
} from '../services/anthropicService.js';

const API_KEY = import.meta.env.DEV ? (import.meta.env.VITE_ANTHROPIC_API_KEY || null) : null;

/**
 * A participant's contribution to an AS-IS round: invitation → interview →
 * confirm steps → submit. Stored in the round, never as one of the user's flows.
 */
// The voice SDK keeps one conversation per app, so the app's single interviewer is passed in
// (`ailean`) and the round's language and scope go back up through `onScope`.
export default function RoundContribution({ vimplToken, inviteToken, ailean, onScope, onDone }) {
  const { t } = useLang();
  const [invite, setInvite]         = useState(null);
  const [phase, setPhase]           = useState('loading'); // loading | invitation | interview | confirm | submitting | submitted | error
  const [errorKind, setErrorKind]   = useState(null);      // invalid | closed | other
  const [transcript, setTranscript] = useState('');
  const [description, setDescription] = useState(null);
  const [busy, setBusy]             = useState(false);
  const [notice, setNotice]         = useState(null);
  const startedSaved = useRef(false);

  const lang = invite?.language === 'da' ? 'da' : 'en';
  const proxyAuth = vimplToken ? { token: vimplToken } : null;
  const processContext = invite ? { isCustom: true, customLabel: invite.processName } : {};

  function effectiveTranscript() {
    return ailean.turns.length > 0 ? buildStructuredTranscript(ailean.turns, '') : transcript;
  }

  function fail(err) {
    if (err?.status === 404 || err?.code === 'INVITE_INVALID') setErrorKind('invalid');
    else if (err?.code === 'ROUND_CLOSED') setErrorKind('closed');
    else { setErrorKind('other'); setNotice(err?.message || null); }
    setPhase('error');
  }

  // Load the invitation; record that the participant opened it
  useEffect(() => {
    let cancelled = false;
    ailean.reset?.(); // start from a clean interview, not leftovers from a flow
    getInvitation(vimplToken, inviteToken)
      .then(async inv => {
        if (cancelled) return;
        setInvite(inv);
        const l = inv.language === 'da' ? 'da' : 'en';
        onScope?.({ language: l, message: scopeContextMessage(inv, l) });
        const own = inv.ownSubmission;
        if (inv.status !== 'open') { setErrorKind('closed'); setPhase('error'); return; }
        if (own?.status === 'submitted') {
          setTranscript(own.contribution?.transcript || '');
          setDescription(own.contribution?.description || null);
          setPhase('submitted');
          return;
        }
        if (own?.contribution?.transcript) setTranscript(own.contribution.transcript);
        if (!own) await saveContribution(vimplToken, inviteToken, { status: 'opened', contribution: {} }).catch(() => {});
        setPhase('invitation');
      })
      .catch(err => { if (!cancelled) fail(err); });
    return () => { cancelled = true; };
  }, [vimplToken, inviteToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // First words in the interview → the owner sees "interviewing"
  const hasContent = !!effectiveTranscript().trim();
  useEffect(() => {
    if (phase !== 'interview' || !hasContent || startedSaved.current) return;
    startedSaved.current = true;
    saveContribution(vimplToken, inviteToken, { status: 'started', contribution: { transcript: effectiveTranscript() } })
      .catch(fail);
  }, [phase, hasContent]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleParse() {
    const text = effectiveTranscript();
    setBusy(true); setNotice(null);
    try {
      const safety = await checkContentSafety(text, API_KEY, proxyAuth);
      if (!safety.safe) { setNotice(t.roundFlagged); return; }
      const desc = await parseVoiceToDescription(text, API_KEY, processContext, proxyAuth, lang);
      setTranscript(text);
      setDescription(desc);
      await saveContribution(vimplToken, inviteToken, { status: 'started', contribution: { transcript: text, description: desc } });
      setPhase('confirm');
    } catch (err) {
      if (err?.status) fail(err); else setNotice(err?.message || t.roundSomethingWrong);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    setPhase('submitting'); setNotice(null);
    // The diagram and metrics help the owner; if they fail, the steps are still submitted
    let parsed = null, metrics = null;
    try { parsed = await parseToBpmn(description, API_KEY, processContext, proxyAuth, lang); } catch (err) { console.warn('[round] BPMN failed', err); }
    if (parsed) {
      try { metrics = await extractProcessMetrics(parsed, transcript, API_KEY, proxyAuth, lang); } catch (err) { console.warn('[round] metrics failed', err); }
    }
    try {
      const contribution = { transcript, description };
      if (parsed) contribution.parsed = parsed;
      if (metrics) contribution.metrics = metrics;
      await saveContribution(vimplToken, inviteToken, { status: 'submitted', contribution });
      setPhase('submitted');
    } catch (err) {
      if (err?.status === 404 || err?.code) fail(err);
      else { setNotice(err?.message || t.roundSomethingWrong); setPhase('confirm'); }
    }
  }

  function handleRedo() {
    ailean.reset?.();
    setTranscript('');
    setDescription(null);
    setPhase('interview');
  }

  async function handleWithdraw() {
    if (!window.confirm(t.roundWithdrawConfirm)) return;
    try {
      await withdrawContribution(vimplToken, inviteToken);
      onDone();
    } catch (err) { fail(err); }
  }

  const owner = invite?.ownerName || t.roundTheOwner;
  const steps = description?.steps || [];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
        <span className="ailean-logo" style={{ fontSize: '15px' }}>AILEAN</span>
        <button onClick={onDone} className="text-xs text-gray-500 hover:text-gray-800">{t.roundToDashboard}</button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 flex flex-col gap-4">
        {invite && phase !== 'error' && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">{t.roundInvitedBy.replace('{name}', owner)}</p>
            <h1 className="text-xl font-semibold text-gray-900 mt-1">{invite.processName}</h1>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-gray-400">{t.roundStarts}</dt><dd className="text-gray-800">{invite.startTrigger}</dd>
              <dt className="text-gray-400">{t.roundEnds}</dt><dd className="text-gray-800">{invite.endPoint}</dd>
            </dl>
          </section>
        )}

        {notice && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{notice}</div>}

        {phase === 'loading' && <p className="text-sm text-gray-500">{t.roundLoading}</p>}

        {phase === 'error' && (
          <section className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-700">
            {errorKind === 'invalid' && t.roundInvalid.replace('{name}', owner)}
            {errorKind === 'closed' && t.roundClosed}
            {errorKind === 'other' && t.roundSomethingWrong}
            <div className="mt-4"><button onClick={onDone} className="text-sm font-medium text-violet-700 hover:underline">{t.roundToDashboard}</button></div>
          </section>
        )}

        {phase === 'invitation' && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-700">{t.roundIntro}</p>
            <p className="mt-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
              {t.roundVisibility.replace('{name}', owner)}
            </p>
            <button onClick={() => setPhase('interview')} className="mt-4 bg-green-400 text-black text-sm font-semibold px-5 py-2 rounded-lg hover:bg-green-300">
              {t.roundStart}
            </button>
          </section>
        )}

        {phase === 'interview' && (
          <section className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ minHeight: '60vh' }}>
            <VoicePanel
              transcript={transcript}
              setTranscript={setTranscript}
              effectiveTranscript={effectiveTranscript()}
              onParse={handleParse}
              loading={busy}
              canParse={hasContent && !busy}
              ailean={ailean}
              hasElevenLabsKey={!!vimplToken}
              langConfirmed
              onConfirmLang={() => {}}
            />
          </section>
        )}

        {(phase === 'confirm' || phase === 'submitting' || phase === 'submitted') && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900">
              {phase === 'submitted' ? t.roundSubmittedTitle : t.roundConfirmTitle}
            </h2>
            {phase === 'submitted' && <p className="text-sm text-gray-600 mt-1">{t.roundSubmittedText.replace('{name}', owner)}</p>}
            <ol className="mt-3 space-y-1.5 list-decimal list-inside text-sm text-gray-800">
              {steps.map((s, i) => (
                <li key={i}>
                  <span className="font-medium">{s.name}</span>
                  {s.performer && <span className="text-gray-500"> — {s.performer}</span>}
                </li>
              ))}
            </ol>
            {!steps.length && <p className="text-sm text-gray-500 mt-2">{t.roundNoSteps}</p>}

            <div className="mt-5 flex flex-wrap gap-2">
              {phase === 'confirm' && (
                <>
                  <button onClick={handleSubmit} className="bg-green-400 text-black text-sm font-semibold px-5 py-2 rounded-lg hover:bg-green-300">{t.roundConfirm}</button>
                  <button onClick={handleRedo} className="text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:border-gray-400">{t.roundRedo}</button>
                </>
              )}
              {phase === 'submitting' && <span className="text-sm text-gray-500">{t.roundSubmitting}</span>}
              {phase === 'submitted' && (
                <>
                  <button onClick={handleRedo} className="text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:border-gray-400">{t.roundChange}</button>
                  <button onClick={handleWithdraw} className="text-sm font-medium text-red-600 border border-red-200 rounded-lg px-4 py-2 hover:border-red-400">{t.roundWithdraw}</button>
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
