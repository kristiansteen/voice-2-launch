import { useState } from 'react';
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

const EXAMPLE_TRANSCRIPT = `Interviewer: Can you walk me through the invoice approval process?

SME: Sure. When we receive an invoice from a supplier, the Accounts Payable clerk first checks if it matches a purchase order. If it matches, they send it to the relevant department manager for approval. The manager either approves or rejects it. If approved, AP processes the payment. If rejected, they notify the supplier and archive the invoice. If there's no matching PO, AP sends it back to procurement to raise one first.`;

export default function VoicePanel({
  transcript, setTranscript,
  onParse, loading, canParse,
  onLoadDemo,
  ailean,
  onAileanTurn,
}) {
  const { t, lang } = useLang();
  const [showGuide, setShowGuide] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);

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

  const aileanActive = ailean?.enabled;
  const aileanBusy   = ailean?.thinking || ailean?.speaking;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onLoadDemo}
            className="text-xs font-medium text-green-600 hover:text-green-800 border border-green-200 rounded px-2 py-0.5 hover:border-green-400 transition-colors"
            title={t.loadDemoTitle}
          >
            {t.loadDemo}
          </button>
          <button
            onClick={() => setTranscript(EXAMPLE_TRANSCRIPT)}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {t.loadExample}
          </button>
          <button
            onClick={handlePaste}
            title="Paste transcript from clipboard"
            className={[
              'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border transition-all',
              pasteFlash
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700',
            ].join(' ')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="9" y="2" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            {pasteFlash ? 'Pasted!' : 'Paste'}
          </button>
        </div>

        {/* Ailean toggle */}
        {ailean && (
          <button
            onClick={ailean.toggle}
            title={aileanActive ? 'Disable Ailean interview mode' : 'Enable Ailean interview mode — she will ask follow-up questions after you speak'}
            className={[
              'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all',
              aileanActive
                ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                : 'bg-white text-gray-500 border-gray-200 hover:border-purple-400 hover:text-purple-600',
            ].join(' ')}
          >
            {/* Simple waveform icon */}
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
                  ? 'bg-red-500 text-white border-red-500 hover:bg-red-600 animate-pulse'
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
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  {t.startRecording}
                </>
              )}
            </button>
          )}
          {error && (
            <p className="text-xs text-red-500 mt-1">{t.recordError}: {error}</p>
          )}
        </div>

        {/* Transcript textarea */}
        <div className="flex-1 relative overflow-hidden">
          <textarea
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
        </div>

        {/* ── Ailean status + question ────────────────────────────── */}
        {aileanActive && (
          <div className="shrink-0 border-t border-purple-100 bg-purple-50/60 px-3 py-2 space-y-1.5">
            {ailean.thinking && (
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <span className="inline-block w-3.5 h-3.5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin shrink-0" />
                Ailean is thinking…
              </div>
            )}
            {ailean.speaking && !ailean.thinking && (
              <div className="flex items-center gap-2 text-xs text-purple-600">
                {/* animated bars */}
                <span className="flex items-end gap-0.5 h-3.5 shrink-0">
                  {[0,1,2,3].map(i => (
                    <span
                      key={i}
                      className="w-0.5 bg-purple-500 rounded-full animate-bounce"
                      style={{ height: `${[8,12,10,7][i]}px`, animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </span>
                Ailean is speaking…
                <button
                  onClick={ailean.stopSpeaking}
                  className="ml-auto text-[10px] text-purple-400 hover:text-purple-700 underline"
                >
                  stop
                </button>
              </div>
            )}
            {ailean.currentQuestion && !ailean.thinking && (
              <div className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-[9px] font-bold">A</span>
                </div>
                <p className="text-xs text-purple-900 leading-relaxed">
                  {ailean.currentQuestion}
                </p>
              </div>
            )}
            {!ailean.thinking && !ailean.speaking && !ailean.currentQuestion && (
              <p className="text-[10px] text-purple-400 italic">
                Record your answer — Ailean will ask a follow-up when you stop.
              </p>
            )}
            {ailean.error && (
              <p className="text-[10px] text-red-500 bg-red-50 border border-red-100 rounded px-2 py-1">
                {ailean.error}
              </p>
            )}
            {ailean.questions.length > 1 && (
              <details className="text-[10px] text-purple-400 cursor-pointer">
                <summary className="hover:text-purple-600">
                  {ailean.questions.length - 1} previous question{ailean.questions.length > 2 ? 's' : ''}
                </summary>
                <ul className="mt-1 space-y-1 pl-2 border-l border-purple-200">
                  {ailean.questions.slice(0, -1).map((q, i) => (
                    <li key={i} className="text-purple-500">{q}</li>
                  ))}
                </ul>
              </details>
            )}
            <button
              onClick={ailean.reset}
              className="text-[10px] text-purple-300 hover:text-purple-600 transition-colors"
            >
              Reset conversation
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
            <span className="text-gray-400 text-xs">{showGuide ? '▾' : '▸'}</span>
          </button>
          {showGuide && (
            <div className="border-t border-gray-100 overflow-y-auto" style={{ maxHeight: '40vh' }}>
              <InterviewGuide isRecording={isRecording} />
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
            {!transcript.trim() ? t.enterTranscript : t.setApiKeyFirst}
          </p>
        )}
      </div>
    </div>
  );
}
