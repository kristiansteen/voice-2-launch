export default function SuggestionsPanel({ parsed, apiKey, suggestions, loading, error, onGetSuggestions }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <button
          onClick={onGetSuggestions}
          disabled={!parsed || !apiKey || loading}
          className="w-full bg-purple-600 text-white text-sm font-medium py-2 rounded-md hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analysing...
            </>
          ) : (
            'Get Suggestions →'
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="text-sm text-red-500 mb-3">{error}</div>
        )}
        {suggestions ? (
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {suggestions}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-300 text-sm">
            Improvement suggestions will appear here
          </div>
        )}
      </div>
    </div>
  );
}
