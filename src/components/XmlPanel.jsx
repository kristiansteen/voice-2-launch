import { useState } from 'react';
import ElementReviewPanel from './ElementReviewPanel.jsx';

export default function XmlPanel({ parsed, setParsed, xml, onGenerateXml }) {
  const [showElements, setShowElements] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Element review toggle */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between shrink-0">
        <span className="text-xs text-gray-400">
          {parsed ? `${parsed.activities.length} activities · ${parsed.events.length} events · ${parsed.gateways.length} gateways` : 'No elements yet'}
        </span>
        {parsed && (
          <button
            onClick={() => setShowElements(v => !v)}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {showElements ? 'Hide elements' : 'Edit elements'}
          </button>
        )}
      </div>

      {/* Element editor (collapsible) */}
      {showElements && parsed && (
        <div className="border-b border-gray-100 overflow-y-auto" style={{ maxHeight: '45%' }}>
          <ElementReviewPanel parsed={parsed} setParsed={setParsed} onGenerateXml={null} />
        </div>
      )}

      {/* Generate button */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <button
          onClick={onGenerateXml}
          disabled={!parsed}
          className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Generate XML →
        </button>
      </div>

      {/* XML output */}
      <div className="flex-1 overflow-auto p-4">
        {xml ? (
          <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap break-all leading-relaxed">
            {xml}
          </pre>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-300 text-sm">
            XML will appear here
          </div>
        )}
      </div>
    </div>
  );
}
