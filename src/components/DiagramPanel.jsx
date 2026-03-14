import { useState, useRef } from 'react';
import BpmnViewer from './BpmnViewer.jsx';
import BpmnErrorBoundary from './BpmnErrorBoundary.jsx';
import {
  saveDiagram,
  updateDiagram,
  listDiagrams,
  deleteDiagram,
} from '../services/diagramService.js';

export default function DiagramPanel({ xml, onXmlChange, bpmnLoading, processName }) {
  const viewerRef = useRef(null);

  // XML preview modal
  const [showXmlModal, setShowXmlModal] = useState(false);

  // Save panel (inline, below toolbar)
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedId, setSavedId] = useState(null); // track current cloud save

  // Load modal
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadList, setLoadList] = useState([]);
  const [loadListError, setLoadListError] = useState('');
  const [loadListBusy, setLoadListBusy] = useState(false);
  const [deleting, setDeleting] = useState(null); // id being deleted

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

  function openSavePanel() {
    setSaveName(processName || 'BPMN Diagram');
    setSaveMsg('');
    setSaveError('');
    setShowSavePanel(v => !v);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    setSaveError('');
    try {
      let result;
      if (savedId) {
        result = await updateDiagram(savedId, saveName.trim(), xml, processName);
      } else {
        result = await saveDiagram(saveName.trim(), xml, processName);
        setSavedId(result.id);
      }
      setSaveMsg(`Saved: ${result.name}`);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openLoadModal() {
    setShowLoadModal(true);
    setLoadList([]);
    setLoadListError('');
    setLoadListBusy(true);
    try {
      const list = await listDiagrams();
      setLoadList(list);
    } catch (err) {
      setLoadListError(err.message);
    } finally {
      setLoadListBusy(false);
    }
  }

  async function handleLoad(diagram) {
    try {
      const full = await listDiagrams().then(list => list.find(d => d.id === diagram.id))
        .catch(() => null);
      // fetch full diagram with xml
      const { baseUrl, token } = JSON.parse(localStorage.getItem('voice2bpmn_vimpl_config') || '{}');
      if (!baseUrl || !token) throw new Error('No credentials');
      const res = await fetch(`${baseUrl}/api/v1/diagrams/${diagram.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load diagram');
      const data = await res.json();
      onXmlChange(data.xml);
      setSavedId(data.id);
      setSaveName(data.name);
      setShowLoadModal(false);
    } catch (err) {
      setLoadListError(err.message);
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await deleteDiagram(id);
      setLoadList(prev => prev.filter(d => d.id !== id));
      if (savedId === id) setSavedId(null);
    } catch (err) {
      setLoadListError(err.message);
    } finally {
      setDeleting(null);
    }
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

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="bpmn-toolbar px-3 py-2 flex items-center gap-2 shrink-0">
        {/* Left: save/load actions */}
        <button onClick={openSavePanel} className="bpmn-toolbar-btn" title="Save to vimpl-saas">
          {savedId ? '☁ Saved' : '☁ Save'}
        </button>
        <button onClick={openLoadModal} className="bpmn-toolbar-btn" title="Load a diagram">
          ⬆ Load
        </button>
        <div className="flex-1" />
        {/* Right: secondary actions */}
        <button onClick={() => setShowXmlModal(true)} className="bpmn-toolbar-btn" title="View BPMN XML">
          XML
        </button>
        <button onClick={handleDownload} className="bpmn-toolbar-btn" title="Download XML file">
          ⬇
        </button>
      </div>

      {/* ── Inline save panel ──────────────────────────────────────── */}
      {showSavePanel && (
        <div className="bpmn-save-bar px-3 py-2 shrink-0 flex items-center gap-2">
          <input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Diagram name..."
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-green-400 bg-white"
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim() || saving}
            className="text-xs font-medium bg-green-500 text-white rounded-lg px-4 py-1.5 hover:bg-green-600 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : savedId ? 'Update' : 'Save'}
          </button>
          <button
            onClick={() => { setShowSavePanel(false); setSaveError(''); setSaveMsg(''); }}
            className="text-gray-400 hover:text-gray-600 text-xs px-1"
          >
            ✕
          </button>
          {saveMsg && <span className="text-xs text-green-600 whitespace-nowrap">{saveMsg}</span>}
          {saveError && <span className="text-xs text-red-500 max-w-[160px] truncate" title={saveError}>{saveError}</span>}
        </div>
      )}

      {/* ── Diagram canvas + zoom controls ─────────────────────────── */}
      <div className="flex-1 overflow-hidden relative">
        <BpmnErrorBoundary>
          <BpmnViewer ref={viewerRef} xml={xml} onXmlChange={onXmlChange} />
        </BpmnErrorBoundary>

        {/* Zoom controls — floating bottom-right */}
        <div className="bpmn-zoom-controls">
          <button onClick={() => viewerRef.current?.zoomIn()} title="Zoom in" className="bpmn-zoom-btn">
            +
          </button>
          <button onClick={() => viewerRef.current?.fitViewport()} title="Fit to screen" className="bpmn-zoom-btn bpmn-zoom-fit">
            ⊡
          </button>
          <button onClick={() => viewerRef.current?.zoomOut()} title="Zoom out" className="bpmn-zoom-btn">
            −
          </button>
        </div>
      </div>

      {/* ── XML preview modal ──────────────────────────────────────── */}
      {showXmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="font-semibold text-sm text-gray-800">BPMN XML</span>
              <div className="flex gap-2">
                <button onClick={handleDownload}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                  ⬇ Download
                </button>
                <button onClick={() => setShowXmlModal(false)}
                  className="text-gray-400 hover:text-gray-700 text-sm px-1">
                  ✕
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-5 text-xs text-gray-600 font-mono whitespace-pre-wrap break-all leading-relaxed bg-gray-50 rounded-b-2xl">
              {xml}
            </pre>
          </div>
        </div>
      )}

      {/* ── Load diagram modal ─────────────────────────────────────── */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[70vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="font-semibold text-sm text-gray-800">Load Diagram</span>
              <button onClick={() => setShowLoadModal(false)}
                className="text-gray-400 hover:text-gray-700 text-sm px-1">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {loadListBusy && (
                <div className="flex justify-center py-8">
                  <span className="inline-block w-5 h-5 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
                </div>
              )}
              {loadListError && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {loadListError}
                </div>
              )}
              {!loadListBusy && !loadListError && loadList.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-8">No saved diagrams yet</div>
              )}
              {loadList.map(d => (
                <div key={d.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50/40 transition-colors group">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{d.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {d.processName && <span className="mr-2">{d.processName}</span>}
                      {new Date(d.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-3">
                    <button
                      onClick={() => handleLoad(d)}
                      className="text-xs font-medium text-green-600 hover:text-green-800 border border-green-200 rounded-lg px-3 py-1 hover:bg-green-50 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      disabled={deleting === d.id}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {deleting === d.id ? '…' : '✕'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
