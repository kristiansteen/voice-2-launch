import { useState, useEffect, useRef } from 'react';
import InterviewGuide from './InterviewGuide.jsx';
import { useLang } from '../i18n/LangContext.jsx';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder.js';

async function pasteFromClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}


export default function VoicePanel({
  transcript, setTranscript,
  effectiveTranscript,
  onParse, loading, canParse,
  ailean,
  hasElevenLabsKey,
  langConfirmed, onConfirmLang,
}) {
  const { t, lang, setLang } = useLang();
  const [showGuide, setShowGuide] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmParse, setConfirmParse] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const browserLang = navigator.language?.startsWith('da') ? 'da' : 'en';
  const browserLangName = browserLang === 'da' ? t.langNameDa : t.langNameEn;

  function requireLangConfirm(action) {
    if (langConfirmed) { action(); return; }
    setPendingAction(() => action);
  }
  const textareaRef = useRef(null);

  function handleInjectQuestion(question) {
    const prefix = transcript.trimEnd()
      ? transcript.trimEnd() + '\n\n'
      : '';
    const injected = `${prefix}Interviewer: ${question}\n\nSME: `;
    setTranscript(injected);
    // Open the guide so user sees what was selected, then focus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = injected.length;
        textareaRef.current.selectionEnd = injected.length;
      }
    }, 0);
  }

  async function handlePaste() {
    const text = await pasteFromClipboard();
    if (text?.trim()) {
      setTranscript(prev => prev ? prev + '\n\n' + text.trim() : text.trim());
      setPasteFlash(true);
      setTimeout(() => setPasteFlash(false), 1500);
    }
  }

  const { isRecording, interimText, error, supported, start, stop } =
    useVoiceRecorder({
      lang,
      onTranscriptUpdate: setTranscript,
    });

  function handleRecord() {
    if (isRecording) {
      stop();
    } else {
      start(transcript);
    }
  }

  function handleAileanToggle() {
    if (ailean?.enabled) { ailean.toggle(); return; } // ending — no lang check needed
    requireLangConfirm(() => { if (isRecording) stop(); ailean?.toggle(); });
  }

  const aileanActive   = ailean?.enabled;
  const aileanBusy     = ailean?.thinking || ailean?.speaking;
  const aileanTurns    = ailean?.turns || [];
  // Text the user has spoken since the last Ailean question (current in-progress turn)
  const currentDraft   = aileanActive ? (transcript || '') : '';

  // WebRTC handles the full conversation loop — no manual record/submit effects needed

  // Parse "Interviewer: / SME:" labelled transcript into display turns
  function parseTranscriptTurns(text) {
    if (!text) return null;
    const blocks = text.split(/\n{2,}/);
    const turns = blocks.map(block => {
      const b = block.trim();
      if (/^Interviewer:/i.test(b))
        return { type: 'ailean', text: b.replace(/^Interviewer:\s*/i, '') };
      if (/^SME:/i.test(b))
        return { type: 'user', text: b.replace(/^SME:\s*/i, '') };
      return null;
    }).filter(Boolean);
    return turns.length >= 2 ? turns : null;
  }

  // Show Ailean turns whenever they exist (even after session ends), else parse raw transcript
  const displayTurns = aileanTurns.length > 0
    ? aileanTurns
    : parseTranscriptTurns(transcript);
  const isStructured = !!displayTurns;

  // Auto-scroll structured conversation to bottom when turns or draft change
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = document.getElementById('ailean-transcript-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayTurns?.length, currentDraft, aileanBusy]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-center gap-2 shrink-0">

        {/* Ailean toggle — leftmost, always visible when available */}
        {ailean && !aileanActive && (
          <button
            onClick={handleAileanToggle}
            title="Start a guided Ailean interview"
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border bg-purple-600 text-white border-purple-600 hover:bg-purple-700 transition-all"
          >
            <svg className="shrink-0" width="13" height="11" viewBox="0 0 13 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0"   y="4"   width="2" height="3"  rx="1" fill="currentColor" opacity="0.6"/>
              <rect x="2.5" y="2"   width="2" height="7"  rx="1" fill="currentColor" opacity="0.8"/>
              <rect x="5"   y="0"   width="2" height="11" rx="1" fill="currentColor"/>
              <rect x="7.5" y="2"   width="2" height="7"  rx="1" fill="currentColor" opacity="0.8"/>
              <rect x="10"  y="4"   width="2" height="3"  rx="1" fill="currentColor" opacity="0.6"/>
            </svg>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-xs font-semibold">{t.aileanStart}</span>
              <span className="text-[9px] font-normal opacity-75">{t.aileanStartSub}</span>
            </span>
          </button>
        )}

        {/* Ailean mode: end button */}
        {aileanActive && (
          <button
            onClick={handleAileanToggle}
            title="End Ailean interview session"
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border bg-purple-600 text-white border-purple-600 hover:bg-purple-700 transition-all"
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="text-xs font-semibold">{t.aileanEnd}</span>
              <span className="text-[9px] font-normal opacity-75">{t.aileanEndSub}</span>
            </span>
          </button>
        )}

        {/* Clear — after an Ailean session ends the chat view stays; let user wipe it */}
        {!aileanActive && aileanTurns.length > 0 && (
          <button
            onClick={() => { ailean.reset(); setTranscript(''); }}
            title="Clear conversation and start over"
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border text-gray-500 border-gray-200 hover:border-red-300 hover:text-red-500 transition-all"
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="text-xs font-semibold">{t.clear}</span>
              <span className="text-[9px] font-normal opacity-60">{t.voiceClearSub}</span>
            </span>
          </button>
        )}

        {/* Paste — only when Ailean is off */}
        {!aileanActive && (
          <button
            onClick={() => requireLangConfirm(handlePaste)}
            title="Paste transcript from clipboard"
            className={[
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border transition-all',
              pasteFlash
                ? 'bg-green-50 text-green-700 border-green-300'
                : 'text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800',
            ].join(' ')}
          >
            <svg className="shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="9" y="2" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-xs font-semibold">{pasteFlash ? t.voicePasted : t.voicePaste}</span>
              <span className="text-[9px] font-normal opacity-60">{t.voicePasteSub}</span>
            </span>
          </button>
        )}

        {/* Record / Stop — only when Ailean is off */}
        {!aileanActive && supported && (
          <button
            onClick={() => isRecording ? handleRecord() : requireLangConfirm(handleRecord)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border transition-all',
              isRecording
                ? 'bg-red-500 text-white border-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-500 hover:bg-red-50',
            ].join(' ')}
          >
            <span className={['w-2.5 h-2.5 shrink-0', isRecording ? 'rounded-sm bg-white' : 'rounded-full bg-red-500'].join(' ')} />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-xs font-semibold">{isRecording ? t.voiceStop : t.voiceRecord}</span>
              <span className="text-[9px] font-normal opacity-60">{isRecording ? t.voiceStopSub : t.voiceRecordSub}</span>
            </span>
          </button>
        )}
        {!aileanActive && !supported && (
          <p className="flex-1 text-xs text-orange-500 text-center">{t.recordNotSupported}</p>
        )}
        {error && <p className="text-xs text-red-500">{t.recordError}: {error}</p>}

        {/* Clear — always visible, dimmed when empty and Ailean inactive */}
        <button
          onClick={() => { if (transcript || aileanActive) setConfirmClear(true); }}
          disabled={!transcript && !aileanActive}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-md border transition-all disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-400 hover:bg-red-50"
        >
          <span className="flex flex-col items-center leading-tight">
            <span className="text-xs font-medium">{t.clear}</span>
            <span className="text-[9px] font-normal opacity-60">{t.voiceClearSub}</span>
          </span>
        </button>
      </div>

      {/* ── Language confirmation prompt ──────────────────────────── */}
      {pendingAction && (
        <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center px-6 py-8 text-center">
          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">{t.langPromptTitle}</h3>
          <p className="text-xs text-gray-500 mb-4 max-w-xs leading-relaxed">
            {t.langPromptDetected.replace('{name}', browserLangName)}
            {' '}{t.langPromptSub}
          </p>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-5">
            {[['en', t.langNameEn], ['da', t.langNameDa]].map(([code, label]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={[
                  'px-5 py-2 text-sm font-medium transition-colors',
                  lang === code
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { onConfirmLang(); pendingAction(); setPendingAction(null); }}
            className="w-full max-w-xs bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
          >
            {t.langPromptConfirm}
          </button>
        </div>
      )}

      {/* ── Ailean hint — shown when not active ──────────────────── */}
      {ailean && !aileanActive && (
        <div className="shrink-0 px-3 py-1.5 bg-purple-50 border-b border-purple-100 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
          <p className="text-[10px] text-purple-500 leading-snug">
            <span className="font-semibold">{t.aileanHint}</span> — {t.aileanHintSub}
          </p>
        </div>
      )}

      {/* Clear confirmation bar */}
      {confirmClear && (
        <div className="shrink-0 px-3 py-2 bg-amber-50 border-b border-amber-200 flex flex-col gap-2">
          <p className="text-xs text-amber-800 font-medium">{t.voiceClearConfirm}</p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(transcript); } catch {}
                setTranscript('');
                if (aileanActive) ailean?.reset();
                setConfirmClear(false);
              }}
              className="flex-1 text-xs font-medium py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors"
            >
              {t.voiceClearCopyAndClear}
            </button>
            <button
              onClick={() => { setTranscript(''); if (aileanActive) ailean?.reset(); setConfirmClear(false); }}
              className="flex-1 text-xs font-medium py-1 rounded-md bg-white text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
            >
              {t.clear}
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="flex-1 text-xs font-medium py-1 rounded-md bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* ── Main area: transcript ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

        {/* Transcript — structured view when Ailean has turns, plain textarea otherwise */}
        <div className="flex-1 relative overflow-hidden">
          {isStructured ? (
            <div className="absolute inset-0 overflow-y-auto p-3 space-y-3 bg-white" id="ailean-transcript-scroll">
              {displayTurns.map((turn, i) => (
                <div key={i} className={`flex gap-2 ${turn.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold ${turn.type === 'ailean' ? 'bg-purple-600' : 'bg-gray-400'}`}>
                    {turn.type === 'ailean' ? 'A' : 'S'}
                  </div>
                  <div className={`flex-1 min-w-0 text-xs rounded-xl px-3 py-2 leading-relaxed ${turn.type === 'ailean' ? 'bg-purple-50 text-purple-900' : 'bg-gray-100 text-gray-700'}`}>
                    <span className="block text-[9px] font-semibold uppercase tracking-wider opacity-50 mb-0.5">
                      {turn.type === 'ailean' ? 'Ailean' : 'SME'}
                    </span>
                    {turn.text}
                  </div>
                </div>
              ))}

              {/* In-progress user draft (only when Ailean is live, not for parsed transcript) */}
              {aileanActive && (currentDraft.trim() || (isRecording && interimText)) && (
                <div className="flex gap-2 flex-row-reverse">
                  <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center shrink-0 text-white text-[9px] font-bold">S</div>
                  <div className="flex-1 min-w-0 text-xs rounded-xl px-3 py-2 leading-relaxed bg-gray-100 text-gray-700 opacity-60 italic">
                    <span className="block text-[9px] font-semibold uppercase tracking-wider opacity-50 mb-0.5 not-italic">SME</span>
                    {currentDraft.trim() || ''}
                    {isRecording && interimText && (
                      <span className="text-gray-400"> {interimText}</span>
                    )}
                  </div>
                </div>
              )}

              {/* WebRTC status indicator — replaces Submit button and thinking/speaking */}
              {aileanActive && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shrink-0 text-white text-[9px] font-bold">A</div>
                  <div className="flex-1 min-w-0 text-xs rounded-xl px-3 py-2 bg-purple-50 text-purple-600">
                    {ailean.thinking ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin shrink-0" />
                        {t.aileanConnecting}
                      </span>
                    ) : ailean.speaking ? (
                      <span className="flex items-center gap-1.5">
                        <span className="flex items-end gap-0.5 h-3 shrink-0">
                          {[0,1,2,3].map(i => (
                            <span key={i} className="w-0.5 bg-purple-500 rounded-full animate-bounce"
                              style={{ height: `${[8,12,10,7][i]}px`, animationDelay: `${i * 0.12}s` }} />
                          ))}
                        </span>
                        {t.aileanSpeaking}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                        {t.aileanListening}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={transcript + (interimText ? ' ' + interimText : '')}
                onChange={e => {
                  if (!isRecording) setTranscript(e.target.value);
                }}
                readOnly={isRecording}
                placeholder={t.transcriptPlaceholder}
                className={[
                  'absolute inset-0 w-full h-full p-3 text-sm text-gray-700 resize-none focus:outline-none',
                  isRecording ? 'bg-red-50/30 cursor-default' : 'bg-white',
                ].join(' ')}
              />
              {isRecording && interimText && (
                <div className="absolute bottom-2 left-3 right-3 pointer-events-none">
                  <span className="text-xs text-gray-400 italic">
                    {t.recordingInterim}: {interimText}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Ailean status bar (shown only when Ailean is active but no turns yet) ── */}
        {aileanActive && !isStructured && (
          <div className="shrink-0 border-t border-purple-100 bg-purple-50/60 px-3 py-2 space-y-1.5">
            {ailean.thinking && (
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <span className="inline-block w-3.5 h-3.5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin shrink-0" />
                {t.aileanConnectingLong}
              </div>
            )}
            {ailean.speaking && !ailean.thinking && (
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <span className="flex items-end gap-0.5 h-3.5 shrink-0">
                  {[0,1,2,3].map(i => (
                    <span key={i} className="w-0.5 bg-purple-500 rounded-full animate-bounce"
                      style={{ height: `${[8,12,10,7][i]}px`, animationDelay: `${i * 0.12}s` }} />
                  ))}
                </span>
                {t.aileanSpeakingLong}
              </div>
            )}
            {!ailean.thinking && !ailean.speaking && (
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                {t.aileanListeningLong}
              </div>
            )}
            {ailean.error && (
              <p className="text-[10px] text-red-500 bg-red-50 border border-red-100 rounded px-2 py-1">
                {ailean.error}
              </p>
            )}
          </div>
        )}

        {/* ── Ailean footer controls (when Ailean is live and structured) ── */}
        {aileanActive && isStructured && (
          <div className="shrink-0 border-t border-purple-100 bg-purple-50/40 px-3 py-1.5 flex items-center justify-between">
            {ailean.error && (
              <p className="text-[10px] text-red-500 flex-1 truncate">{ailean.error}</p>
            )}
            {!ailean.error && (
              <p className="text-[10px] text-purple-400 italic flex-1">
                {ailean.speaking ? t.aileanSpeakingLong : t.aileanListeningLong}
              </p>
            )}
            <button onClick={() => { ailean.reset(); setTranscript(''); }} className="text-[10px] text-purple-300 hover:text-purple-600 transition-colors shrink-0 ml-2">
              {t.aileanReset}
            </button>
          </div>
        )}

        {/* ── Interview guide — collapsed accordion at bottom ────── */}
        <div className="shrink-0 border-t border-gray-100">
          <button
            onClick={() => setShowGuide(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
          >
            <span className={[
              'text-xs font-medium transition-colors',
              showGuide ? 'text-purple-600' : 'text-gray-500',
            ].join(' ')}>
              {t.guideToggle}
            </span>
            <div className="flex items-center gap-2">
              {!aileanActive && (
                <span className="text-[10px] text-green-500">{t.guideInject}</span>
              )}
              <span className="text-gray-400 text-xs">{showGuide ? '▾' : '▸'}</span>
            </div>
          </button>
          {showGuide && (
            <div className="border-t border-gray-100 overflow-y-auto" style={{ maxHeight: '40vh' }}>
              <InterviewGuide
                isRecording={isRecording}
                onSelectQuestion={!aileanActive ? handleInjectQuestion : undefined}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Parse confirm bar ─────────────────────────────────────── */}
      {confirmParse && (
        <div className="shrink-0 px-3 py-2 bg-amber-50 border-t border-amber-200 flex flex-col gap-2">
          <p className="text-xs text-amber-800 font-medium">
            {aileanActive ? t.voiceParseAilean : t.voiceParseConfirm}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConfirmParse(false);
                if (isRecording) stop();
                if (aileanActive) ailean?.toggle();
                onParse();
              }}
              className="flex-1 text-xs font-medium py-1 rounded-md bg-vimpl text-black border border-vimpl hover:bg-vimpl-dark hover:text-white transition-colors"
            >
              {aileanActive ? t.voiceParseEnd : t.voiceParseYes}
            </button>
            <button
              onClick={() => setConfirmParse(false)}
              className="flex-1 text-xs font-medium py-1 rounded-md bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* ── Parse footer ──────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <button
          onClick={() => { if (canParse && !loading) setConfirmParse(true); }}
          disabled={!canParse || loading}
          className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t.parsingVoice}
            </>
          ) : (
            t.parseVoice
          )}
        </button>
        {!canParse && !loading && effectiveTranscript?.trim() && (
          <p className="text-xs text-gray-400 mt-1 text-center">{t.setApiKeyFirst}</p>
        )}
        {aileanActive && isStructured && effectiveTranscript && (
          <details className="mt-2">
            <summary className="text-[10px] text-purple-400 hover:text-purple-600 cursor-pointer select-none">
              Preview structured transcript
            </summary>
            <pre className="mt-1 text-[10px] text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap max-h-40 overflow-y-auto border border-gray-100">
              {effectiveTranscript}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
