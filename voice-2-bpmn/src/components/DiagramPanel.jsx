import { useState } from 'react';
import BpmnViewer from './BpmnViewer.jsx';

export default function DiagramPanel({ xml, onXmlChange, bpmnLoading }) {
  const [showXmlModal, setShowXmlModal] = useState(false);

  function handleDownload() {
    if (!xml) return;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `process-${Date.now()}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (bpmnLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm gap-2">
        <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" />
        Generating diagram...
      </div>
    );
  }

  if (!xml) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
        Approve description to generate diagram
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header actions */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-end gap-2 shrink-0">
        <button
          onClick={() => setShowXmlModal(true)}
          className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 hover:border-gray-400 transition-colors"
        >
          View XML
        </button>
      </div>

      {/* Diagram */}
      <div className="flex-1 overflow-hidden">
        <BpmnViewer xml={xml} onXmlChange={onXmlChange} />
      </div>

      {/* XML modal */}
      {showXmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-medium text-sm">BPMN XML</span>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-gray-50 transition-colors"
                >
                  ⬇ Download
                </button>
                <button
                  onClick={() => setShowXmlModal(false)}
                  className="text-gray-400 hover:text-gray-700 text-sm px-1"
                >
                  ✕
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs text-gray-600 font-mono whitespace-pre-wrap break-all leading-relaxed">
              {xml}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
