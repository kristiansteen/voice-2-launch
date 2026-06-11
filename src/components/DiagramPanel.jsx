import { useState, useRef, useEffect } from 'react';
import BpmnViewer from './BpmnViewer.jsx';
import BpmnErrorBoundary from './BpmnErrorBoundary.jsx';
import StepCurtain from './StepCurtain.jsx';
import { useLang } from '../i18n/LangContext.jsx';

export default function DiagramPanel({ xml, onXmlChange, bpmnLoading, processName, parsed, processDescription, onGetImprovements, apiKey, asIsXml, toBeXml, onToBeXmlChange, toBeLoading, asIsMetrics, onAsIsMetricsChange, toBeMetrics, onToBeMetricsChange }) {
  const { t } = useLang();
  const viewerRef = useRef(null);
  const toBeViewerRef = useRef(null);
  const [activeTab, setActiveTab] = useState('asis'); // 'asis' | 'tobe'

  function handleUpdateMetric(id, changes) {
    const updater = prev => ({
      ...prev,
      activities: prev?.activities?.map(m => m.id === id ? { ...m, ...changes } : m),
    });
    if (activeTab === 'tobe') onToBeMetricsChange?.(updater);
    else onAsIsMetricsChange?.(updater);
  }

  // Switch to TO-BE tab as soon as it's ready
  useEffect(() => { if (toBeXml) setActiveTab('tobe'); }, [toBeXml]);
  // Reset to asis when AS-IS is cleared (new session)
  useEffect(() => { if (!asIsXml) setActiveTab('asis'); }, [asIsXml]);
  // Fit viewport when switching to TO-BE tab (viewer may have initialised while invisible)
  useEffect(() => {
    if (activeTab === 'tobe' && toBeViewerRef.current) {
      setTimeout(() => toBeViewerRef.current?.fitViewport(), 150);
    }
  }, [activeTab, toBeXml]);

  const [impLoading, setImpLoading] = useState(false);
  const [impError, setImpError] = useState(null);

  async function handleGetImprovements() {
    setImpError(null);
    setImpLoading(true);
    try { await onGetImprovements(); }
    catch (err) { setImpError(err.message || 'Failed to get improvements.'); }
    finally { setImpLoading(false); }
  }

  // Step curtain
  const [curtainElement, setCurtainElement] = useState(null);

  // XML preview modal
  const [showXmlModal, setShowXmlModal] = useState(false);

  const activeXml = (asIsXml && activeTab === 'tobe') ? toBeXml : (asIsXml || xml);
  const activeRef = activeTab === 'tobe' ? toBeViewerRef.current : viewerRef.current;
  const activeVariant = (asIsXml && activeTab === 'tobe') ? 'to-be' : 'as-is';

  function makeFilename() {
    const safeName = (processName || 'process')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${safeName}-${activeVariant}.xml`;
  }

  function handleDownload() {
    if (!activeXml) return;
    const blob = new Blob([activeXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = makeFilename();
    a.click();
    URL.revokeObjectURL(url);
  }

  if (bpmnLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm gap-2">
        <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" />
        {t.generatingDiagram}
      </div>
    );
  }

  if (!xml) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
        {t.approveToGenerate}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="bpmn-toolbar px-3 py-2 flex items-center gap-1.5 shrink-0">
        {/* Palette tools */}
        <button onMouseDown={e => { e.preventDefault(); activeRef?.activateTool('hand', e); }} className="bpmn-zoom-btn" title="Hand tool">☚</button>
        <button onMouseDown={e => { e.preventDefault(); activeRef?.activateTool('lasso', e); }} className="bpmn-zoom-btn" title="Lasso select">⬚</button>
        <button onMouseDown={e => { e.preventDefault(); activeRef?.activateTool('space', e); }} className="bpmn-zoom-btn" title="Space tool">⇔</button>
        <button onMouseDown={e => { e.preventDefault(); activeRef?.activateTool('connect', e); }} className="bpmn-zoom-btn" title="Connect">⤳</button>
        <button onMouseDown={e => { e.preventDefault(); activeRef?.activateTool('participant', e); }} className="bpmn-zoom-btn text-[10px] font-semibold" title="Add swimlane">+▭</button>
        <div className="bpmn-zoom-divider" />
        <button onMouseDown={e => { e.preventDefault(); activeRef?.activateTool('start-event', e); }} className="bpmn-zoom-btn" title="Start event">○</button>
        <button onMouseDown={e => { e.preventDefault(); activeRef?.activateTool('intermediate-event', e); }} className="bpmn-zoom-btn" title="Intermediate event">⊙</button>
        <button onMouseDown={e => { e.preventDefault(); activeRef?.activateTool('end-event', e); }} className="bpmn-zoom-btn" title="End event">●</button>
        <button onMouseDown={e => { e.preventDefault(); activeRef?.activateTool('gateway', e); }} className="bpmn-zoom-btn" title="Gateway">◇</button>
        <button onMouseDown={e => { e.preventDefault(); activeRef?.activateTool('task', e); }} className="bpmn-zoom-btn" title="Task">▭</button>
        <div className="bpmn-zoom-divider" />
        <button onClick={() => setShowXmlModal(true)} className="text-xs font-medium text-gray-600 border border-gray-200 rounded-md px-2 py-1.5 hover:border-gray-400 hover:text-gray-800 transition-colors whitespace-nowrap">
          {t.bpmnXml}
        </button>
        <div className="bpmn-zoom-divider" />
        <button onClick={() => activeRef?.undo()} className="bpmn-zoom-btn" title="Undo (Ctrl+Z)">↩</button>
        <button onClick={() => activeRef?.redo()} className="bpmn-zoom-btn" title="Redo (Ctrl+Shift+Z)">↪</button>
        <div className="bpmn-zoom-divider" />
        <button onClick={() => activeRef?.zoomIn()} className="bpmn-zoom-btn">+</button>
        <button onClick={() => activeRef?.fitViewport()} className="bpmn-zoom-btn bpmn-zoom-fit">⊡</button>
        <button onClick={() => activeRef?.zoomOut()} className="bpmn-zoom-btn">−</button>
      </div>

      {/* ── Tab bar — only when AS-IS is frozen ─────────────────────── */}
      {asIsXml && (
        <div className="shrink-0 flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('asis')}
            className={[
              'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors',
              activeTab === 'asis'
                ? 'border-gray-500 text-gray-700 bg-white'
                : 'border-transparent text-gray-400 hover:text-gray-600',
            ].join(' ')}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest bg-gray-200 text-gray-500 rounded px-1 py-0.5">AS-IS</span>
            <span className="truncate max-w-[100px]">{processName}</span>
          </button>
          <button
            onClick={() => toBeXml && setActiveTab('tobe')}
            className={[
              'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors',
              activeTab === 'tobe'
                ? 'border-green-500 text-green-700 bg-white'
                : toBeXml
                  ? 'border-transparent text-gray-400 hover:text-green-600'
                  : 'border-transparent text-gray-300 cursor-default',
            ].join(' ')}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest bg-green-100 text-green-600 rounded px-1 py-0.5">TO-BE</span>
            {toBeLoading ? (
              <span className="flex items-center gap-1 text-green-500">
                <span className="inline-block w-2.5 h-2.5 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                {t.generating}
              </span>
            ) : (
              <span className="truncate max-w-[100px]">{toBeXml ? `${processName} — TO-BE` : t.toBePending}</span>
            )}
          </button>
        </div>
      )}

      {/* ── Diagram canvas ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden relative">

        {/* AS-IS viewer — visible when no tabs or asis tab active */}
        <div className={`absolute inset-0 ${asIsXml && activeTab !== 'asis' ? 'invisible' : ''}`}>
          <BpmnErrorBoundary>
            <BpmnViewer
              ref={viewerRef}
              xml={asIsXml || xml}
              onXmlChange={asIsXml ? undefined : onXmlChange}
              onElementDblClick={setCurtainElement}
            />
          </BpmnErrorBoundary>
          {curtainElement && (
            <StepCurtain
              element={curtainElement}
              parsed={parsed}
              processDescription={processDescription}
              metrics={activeTab === 'tobe' ? toBeMetrics : asIsMetrics}
              onUpdateMetric={handleUpdateMetric}
              onClose={() => setCurtainElement(null)}
            />
          )}
        </div>

        {/* TO-BE viewer — visible when tobe tab active */}
        {toBeXml && (
          <div className={`absolute inset-0 ${activeTab !== 'tobe' ? 'invisible' : ''}`}>
            <BpmnErrorBoundary>
              <BpmnViewer
                ref={toBeViewerRef}
                xml={toBeXml}
                onXmlChange={onToBeXmlChange}
                onElementDblClick={setCurtainElement}
              />
            </BpmnErrorBoundary>
          </div>
        )}
      </div>

      {/* ── XML preview modal ──────────────────────────────────────── */}
      {showXmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-800">{t.bpmnXml}</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest rounded px-1.5 py-0.5 ${activeVariant === 'to-be' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                  {activeVariant}
                </span>
                <span className="text-xs text-gray-400 truncate max-w-[180px]">{processName}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={handleDownload}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                  {t.download}
                </button>
                <button onClick={() => setShowXmlModal(false)}
                  className="text-gray-400 hover:text-gray-700 text-sm px-1">
                  ✕
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-5 text-xs text-gray-600 font-mono whitespace-pre-wrap break-all leading-relaxed bg-gray-50 rounded-b-2xl">
              {activeXml}
            </pre>
          </div>
        </div>
      )}

      {/* ── Get improvements footer — AS-IS only ──────────────────── */}
      {activeTab !== 'tobe' && (
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <button
            onClick={handleGetImprovements}
            disabled={!parsed || !apiKey || impLoading}
            className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {impLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t.analysing}
              </>
            ) : t.getImprovements}
          </button>
          {impError && <p className="text-xs text-red-500 mt-1">{impError}</p>}
        </div>
      )}
    </div>
  );
}
