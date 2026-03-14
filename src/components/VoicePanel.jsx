import { useState } from 'react';
import ApqcSelector from './ApqcSelector.jsx';
import InterviewGuide from './InterviewGuide.jsx';
import { useLang } from '../i18n/LangContext.jsx';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder.js';

const EXAMPLE_TRANSCRIPT = `Interviewer: Can you walk me through the invoice approval process?

SME: Sure. When we receive an invoice from a supplier, the Accounts Payable clerk first checks if it matches a purchase order. If it matches, they send it to the relevant department manager for approval. The manager either approves or rejects it. If approved, AP processes the payment. If rejected, they notify the supplier and archive the invoice. If there's no matching PO, AP sends it back to procurement to raise one first.`;

export default function VoicePanel({
  transcript, setTranscript,
  onParse, loading, canParse,
  onLoadDemo,
  processContext, onProcessContextChange,
}) {
  const { t, lang } = useLang();
  const [showGuide, setShowGuide] = useState(true);

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
        </div>

        {/* Guide toggle */}
        <button
          onClick={() => setShowGuide(v => !v)}
          className={[
            'text-xs rounded px-2 py-0.5 border transition-colors',
            showGuide
              ? 'text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100'
              : 'text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600',
          ].join(' ')}
          title={t.guideToggleTitle}
        >
          {t.guideToggle}
        </button>
      </div>

      {/* ── Main area: transcript + optional guide ────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left: transcript */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

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
                // Only allow manual edits when not recording (interim mixed in)
                if (!isRecording) setTranscript(e.target.value);
              }}
              readOnly={isRecording}
              placeholder={t.transcriptPlaceholder}
              className={[
                'absolute inset-0 w-full h-full p-3 text-sm text-gray-700 resize-none focus:outline-none',
                isRecording ? 'bg-red-50/30 cursor-default' : 'bg-white',
              ].join(' ')}
            />
            {/* Interim text overlay indicator */}
            {isRecording && interimText && (
              <div className="absolute bottom-2 left-3 right-3 pointer-events-none">
                <span className="text-xs text-gray-400 italic">
                  {t.recordingInterim}: {interimText}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: interview guide */}
        {showGuide && (
          <div className="w-52 shrink-0 border-l border-gray-100 flex flex-col overflow-hidden">
            <InterviewGuide isRecording={isRecording} />
          </div>
        )}
      </div>

      {/* ── APQC context selector ─────────────────────────────────── */}
      <ApqcSelector
        processContext={processContext}
        onChange={onProcessContextChange}
      />

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
