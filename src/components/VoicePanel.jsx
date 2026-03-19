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
  onAileanTurn,
}) {
  const { t, lang } = useLang();
  const [showGuide, setShowGuide] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);
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
      // Give the final transcript 400ms to commit, then let Ailean respond
      if (ailean?.enabled) {
        setTimeout(() => onAileanTurn?.(), 400);
      }
    } else {
      ailean?.stopSpeaking(); // stop Ailean when user starts speaking
      start(transcript);
    }
  }

  const aileanActive   = ailean?.enabled;
  const aileanBusy     = ailean?.thinking || ailean?.speaking;
  const aileanTurns    = ailean?.turns || [];
  // Text the user has spoken since the last Ailean question (current in-progress turn)
  const currentDraft   = aileanActive ? transcript.slice(ailean?.prevTranscriptLength || 0) : '';

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

  // Use Ailean live turns if active, otherwise fall back to parsing the transcript text
  const displayTurns = aileanActive && aileanTurns.length > 0
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
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <button
          onClick={handlePaste}
          title="Paste transcript from clipboard"
          className={[
            'flex-1 flex items-center justify-center gap-1 text-xs font-medium px-2 py-1.5 rounded-md border transition-all',
            pasteFlash
              ? 'bg-green-50 text-green-700 border-green-300'
              : 'text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800',
          ].join(' ')}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="9" y="2" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {pasteFlash ? 'Pasted!' : 'Paste'}
        </button>

        {/* Ailean toggle */}
        {ailean && (
          <button
            onClick={ailean.toggle}
            title={aileanActive ? 'Disable Ailean interview mode' : 'Enable Ailean interview mode — she will ask follow-up questions after you speak'}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-md border transition-all',
              aileanActive
                ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                : hasElevenLabsKey
                  ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                  : 'text-gray-600 border-gray-200 hover:border-purple-400 hover:text-purple-600',
            ].join(' ')}
          >
            <svg width="13" height="11" viewBox="0 0 13 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0"   y="4"   width="2" height="3"  rx="1" fill="currentColor" opacity="0.6"/>
              <rect x="2.5" y="2"   width="2" height="7"  rx="1" fill="currentColor" opacity="0.8"/>
              <rect x="5"   y="0"   width="2" height="11" rx="1" fill="currentColor"/>
              <rect x="7.5" y="2"   width="2" height="7"  rx="1" fill="currentColor" opacity="0.8"/>
              <rect x="10"  y="4"   width="2" height="3"  rx="1" fill="currentColor" opacity="0.6"/>
            </svg>
            Ailean
            {aileanActive && aileanBusy && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse ml-0.5" />
            )}
          </button>
        )}
      </div>

      {/* ── Main area: transcript ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

        {/* Record button */}
        <div className="px-3 pt-3 pb-1 shrink-0">
          {!supported ? (
            <p className="text-xs text-orange-500 bg-orange-50 border border-orange-200 rounded px-3 py-2">
              {t.recordNotSupported}
            </p>
          ) : (
            <button
              onClick={handleRecord}
              className={[
                'w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-lg border transition-all',
                isRecording
                  ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-500 hover:bg-red-50',
              ].join(' ')}
            >
              {isRecording ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-sm bg-white shrink-0" />
                  {t.stopRecording}
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
                  {t.startRecording}
                </>
              )}
            </button>
          )}
          {error && (
            <p className="text-xs text-red-500 mt-1">{t.recordError}: {error}</p>
          )}
        </div>

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

              {/* Thinking / speaking indicators inline (live Ailean only) */}
              {aileanActive && (ailean.thinking || ailean.speaking) && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shrink-0 text-white text-[9px] font-bold">A</div>
                  <div className="flex-1 min-w-0 text-xs rounded-xl px-3 py-2 bg-purple-50 text-purple-600">
                    {ailean.thinking ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin shrink-0" />
                        thinking…
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="flex items-end gap-0.5 h-3 shrink-0">
                          {[0,1,2,3].map(i => (
                            <span key={i} className="w-0.5 bg-purple-500 rounded-full animate-bounce"
                              style={{ height: `${[8,12,10,7][i]}px`, animationDelay: `${i * 0.12}s` }} />
                          ))}
                        </span>
                        speaking…
                        <button onClick={ailean.stopSpeaking} className="ml-auto text-[10px] underline opacity-70 hover:opacity-100">stop</button>
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
                Ailean is thinking…
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
                Ailean is speaking…
                <button onClick={ailean.stopSpeaking} className="ml-auto text-[10px] text-purple-400 hover:text-purple-700 underline">stop</button>
              </div>
            )}
            {!ailean.thinking && !ailean.speaking && (
              <p className="text-[10px] text-purple-400 italic">
                Record your answer — Ailean will ask a follow-up when you stop.
              </p>
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
                {isRecording ? 'Recording…' : 'Stop recording for Ailean to respond.'}
              </p>
            )}
            <button onClick={ailean.reset} className="text-[10px] text-purple-300 hover:text-purple-600 transition-colors shrink-0 ml-2">
              Reset
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
                <span className="text-[10px] text-green-500">click to inject</span>
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

      {/* ── Parse footer ──────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <button
          onClick={onParse}
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
        {!canParse && !loading && (
          <p className="text-xs text-gray-400 mt-1 text-center">
            {!effectiveTranscript?.trim() ? t.enterTranscript : t.setApiKeyFirst}
          </p>
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
