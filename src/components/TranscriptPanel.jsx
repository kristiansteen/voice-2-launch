import ApqcSelector from './ApqcSelector.jsx';

const EXAMPLE_TRANSCRIPT = `Interviewer: Can you walk me through the invoice approval process?

SME: Sure. When we receive an invoice from a supplier, the Accounts Payable clerk first checks if it matches a purchase order. If it matches, they send it to the relevant department manager for approval. The manager either approves or rejects it. If approved, AP processes the payment. If rejected, they notify the supplier and archive the invoice. If there's no matching PO, AP sends it back to procurement to raise one first.`;

export default function TranscriptPanel({
  transcript, setTranscript,
  onParse, loading, canParse,
  onLoadDemo,
  processContext, onProcessContextChange,
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between shrink-0">
        <button
          onClick={onLoadDemo}
          className="text-xs font-medium text-green-600 hover:text-green-800 border border-green-200 rounded px-2 py-0.5 hover:border-green-400 transition-colors"
          title="Load pre-parsed demo — no API key needed"
        >
          ⚡ Load demo
        </button>
        <button
          onClick={() => setTranscript(EXAMPLE_TRANSCRIPT)}
          className="text-xs text-blue-500 hover:text-blue-700"
        >
          Load example text
        </button>
      </div>

      {/* Transcript textarea */}
      <textarea
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        placeholder="Paste or type your process interview transcript here..."
        className="flex-1 p-4 text-sm text-gray-700 resize-none focus:outline-none min-h-32"
      />

      {/* APQC context selector */}
      <ApqcSelector
        processContext={processContext}
        onChange={onProcessContextChange}
      />

      {/* Parse footer */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <button
          onClick={onParse}
          disabled={!canParse || loading}
          className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Parsing...
            </>
          ) : (
            'Parse →'
          )}
        </button>
        {!canParse && !loading && (
          <p className="text-xs text-gray-400 mt-1 text-center">
            {!transcript.trim() ? 'Enter a transcript to continue.' : 'Set your API key first.'}
          </p>
        )}
      </div>
    </div>
  );
}
