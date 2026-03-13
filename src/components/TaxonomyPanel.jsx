import { useState, useCallback } from 'react';
import { buildApqcTree, APQC_NODES } from '../data/apqcTaxonomy.js';
import {
  saveProcess,
  getAllProcesses,
  getElementsByNode,
  getBlueprintForNode,
  deleteProcess,
  buildCumulativeCountMap,
  buildProcessCountMap,
  clearDb,
} from '../services/taxonomyDb.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  activity: 'bg-blue-100 text-blue-700',
  event:    'bg-purple-100 text-purple-700',
  gateway:  'bg-amber-100 text-amber-700',
  role:     'bg-green-100 text-green-700',
};

const DEVIATION_COLORS = {
  'near-blueprint':    'bg-green-100 text-green-700',
  'configured':        'bg-blue-100 text-blue-700',
  'heavily-customised':'bg-orange-100 text-orange-700',
};

const PROCESS_TYPE_BADGE = {
  blueprint:    { label: 'Blueprint', cls: 'bg-green-600 text-white' },
  configured:   { label: 'Configured', cls: 'bg-blue-500 text-white' },
  unclassified: { label: 'Unclassified', cls: 'bg-gray-200 text-gray-500' },
};

// ─── Save modal (inline) ──────────────────────────────────────────────────────

function SavePanel({ parsed, processContext, onSaved, onCancel }) {
  const hasApqc = !processContext?.isCustom && !!processContext?.apqcNodeId;
  const existingBlueprint = hasApqc ? getBlueprintForNode(processContext.apqcNodeId) : null;

  const defaultMode = !hasApqc
    ? 'auto'
    : existingBlueprint ? 'configured' : 'blueprint';

  const [mode, setMode] = useState(defaultMode);

  function handleSave() {
    saveProcess(parsed, processContext || {}, mode);
    onSaved();
  }

  return (
    <div className="border border-gray-200 rounded-lg m-3 p-3 bg-gray-50 text-xs space-y-3">
      {/* APQC context summary */}
      <div>
        <div className="font-semibold text-gray-700 mb-0.5">
          {parsed?.process_name || 'Unnamed process'}
        </div>
        {hasApqc ? (
          <div className="text-[10px] text-gray-500">
            APQC {processContext.apqcNodeId} — {processContext.apqcNodeName}
          </div>
        ) : processContext?.isCustom ? (
          <div className="text-[10px] text-amber-600">
            Custom: {processContext.customLabel || 'no label'}
          </div>
        ) : (
          <div className="text-[10px] text-gray-400 italic">No APQC node selected</div>
        )}
      </div>

      {/* Mode selector (only when APQC node present) */}
      {hasApqc && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
            Save as
          </div>

          <label className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
            mode === 'blueprint' ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input type="radio" name="saveMode" value="blueprint"
              checked={mode === 'blueprint'} onChange={() => setMode('blueprint')}
              className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-gray-700">Blueprint</div>
              <div className="text-[10px] text-gray-500 leading-tight">
                The standard/reference version of this process for APQC {processContext.apqcNodeId}.
                {existingBlueprint && (
                  <span className="text-orange-500"> Replaces existing blueprint "{existingBlueprint.processName}".</span>
                )}
              </div>
            </div>
          </label>

          <label className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
            mode === 'configured' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input type="radio" name="saveMode" value="configured"
              checked={mode === 'configured'} onChange={() => setMode('configured')}
              className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-gray-700">Configured</div>
              <div className="text-[10px] text-gray-500 leading-tight">
                {existingBlueprint
                  ? `A customised variant — will be scored against blueprint "${existingBlueprint.processName}".`
                  : 'A customised variant. No blueprint on file yet — save one first for deviation scoring.'}
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 bg-vimpl text-black py-1.5 rounded text-xs font-medium hover:bg-vimpl-dark hover:text-white transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Tree ─────────────────────────────────────────────────────────────────────

function TreeNode({ node, depth, counts, processCounts, selectedId, onSelect, searchLower }) {
  const [open, setOpen] = useState(depth === 0);
  const count = counts[node.id] || 0;
  const pc = processCounts[node.id];
  const hasChildren = node.children?.length > 0;
  const isSelected = selectedId === node.id;
  const hasBlueprint = pc?.blueprint > 0;

  if (searchLower) {
    const subtreeMatches = n => {
      if (n.name.toLowerCase().includes(searchLower)) return true;
      return (n.children || []).some(subtreeMatches);
    };
    if (!subtreeMatches(node)) return null;
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer select-none ${
          isSelected ? 'bg-green-50 text-green-800' : 'hover:bg-gray-50 text-gray-700'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => { if (hasChildren) setOpen(o => !o); onSelect(node.id); }}
      >
        {hasChildren
          ? <span className="text-gray-400 text-xs w-3 shrink-0">{open ? '▾' : '▸'}</span>
          : <span className="w-3 shrink-0" />
        }

        {/* Blueprint dot indicator */}
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasBlueprint ? 'bg-green-500' : 'bg-gray-200'}`}
          title={hasBlueprint ? 'Blueprint on file' : 'No blueprint yet'}
        />

        <span className={`text-[10px] font-mono shrink-0 ${isSelected ? 'text-green-600' : 'text-gray-400'}`}>
          {node.id}
        </span>
        <span className={`text-xs flex-1 leading-tight truncate ${depth === 0 ? 'font-semibold' : ''}`}>
          {node.name}
        </span>

        {/* Process type counts */}
        {pc && (pc.blueprint > 0 || pc.configured > 0) && (
          <span className="text-[9px] shrink-0 flex gap-0.5">
            {pc.blueprint  > 0 && <span className="bg-green-100 text-green-700 px-1 rounded">B:{pc.blueprint}</span>}
            {pc.configured > 0 && <span className="bg-blue-100 text-blue-700 px-1 rounded">C:{pc.configured}</span>}
          </span>
        )}

        {/* Element count */}
        {count > 0 && (
          <span className="text-[9px] ml-0.5 px-1 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
            {count}
          </span>
        )}
      </div>

      {open && hasChildren && node.children.map(child => (
        <TreeNode key={child.id} node={child} depth={depth + 1}
          counts={counts} processCounts={processCounts}
          selectedId={selectedId} onSelect={onSelect} searchLower={searchLower} />
      ))}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function TaxonomyPanel({ parsed, processContext }) {
  const [refreshKey, setRefreshKey]     = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [search, setSearch]             = useState('');
  const [activeTab, setActiveTab]       = useState('tree');
  const [showSave, setShowSave]         = useState(false);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Recompute on refreshKey change
  const tree          = buildApqcTree();
  const counts        = buildCumulativeCountMap();
  const processCounts = buildProcessCountMap();
  const processes     = getAllProcesses();
  const totalElements = Object.values(counts).reduce((a, b) => a + b, 0);

  const selectedNode     = selectedNodeId ? APQC_NODES.find(n => n.id === selectedNodeId) : null;
  const selectedElements = selectedNodeId ? getElementsByNode(selectedNodeId) : [];

  function handleSaved() {
    setShowSave(false);
    refresh();
  }

  function handleDeleteProcess(id) {
    deleteProcess(id);
    refresh();
  }

  function handleClearDb() {
    if (window.confirm('Clear all saved processes and elements from the taxonomy DB?')) {
      clearDb();
      setSelectedNodeId(null);
      refresh();
    }
  }

  const searchLower = search.trim().toLowerCase();

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-800">

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2 shrink-0">
        <div className="flex-1 text-xs text-gray-500 truncate">
          <span className="font-semibold text-gray-700">{processes.length}</span> processes ·{' '}
          <span className="font-semibold text-gray-700">{totalElements}</span> elements
        </div>
        <button
          onClick={() => setShowSave(s => !s)}
          disabled={!parsed}
          className="text-xs font-medium bg-vimpl text-black px-3 py-1 rounded-md hover:bg-vimpl-dark hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {showSave ? '✕ Cancel' : '⬆ Save current'}
        </button>
        <button onClick={handleClearDb} className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1" title="Clear all">✕</button>
      </div>

      {/* Inline save panel */}
      {showSave && parsed && (
        <SavePanel
          parsed={parsed}
          processContext={processContext}
          onSaved={handleSaved}
          onCancel={() => setShowSave(false)}
        />
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100 shrink-0">
        {['tree', 'processes'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-green-500 text-green-700'
                : 'text-gray-400 hover:text-gray-600'
            }`}>
            {tab === 'tree' ? '🌳 Taxonomy' : `📋 Saved (${processes.length})`}
          </button>
        ))}
      </div>

      {/* ── Tree tab ── */}
      {activeTab === 'tree' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 shrink-0">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search taxonomy..." className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-green-400" />
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-1">
              {tree.map(node => (
                <TreeNode key={node.id} node={node} depth={0}
                  counts={counts} processCounts={processCounts}
                  selectedId={selectedNodeId} onSelect={setSelectedNodeId}
                  searchLower={searchLower} />
              ))}
            </div>

            {/* Detail pane */}
            {selectedNode && (
              <div className="w-52 shrink-0 overflow-y-auto p-3 bg-white border-l border-gray-100">
                <div className="text-[9px] font-mono text-gray-400 mb-0.5">{selectedNode.id}</div>
                <div className="text-xs font-semibold text-gray-800 mb-1 leading-tight">{selectedNode.name}</div>

                {/* Blueprint badge */}
                {(() => {
                  const bp = getBlueprintForNode(selectedNode.id);
                  return bp ? (
                    <div className="text-[9px] text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 mb-2">
                      Blueprint: {bp.processName}
                    </div>
                  ) : (
                    <div className="text-[9px] text-gray-400 italic mb-2">No blueprint on file</div>
                  );
                })()}

                <div className="text-[10px] text-gray-500 mb-2">
                  {selectedElements.length} element{selectedElements.length !== 1 ? 's' : ''}
                </div>

                {selectedElements.length === 0 ? (
                  <div className="text-[10px] text-gray-400 italic">No elements mapped here yet.</div>
                ) : (
                  <div className="space-y-1">
                    {selectedElements.map(el => (
                      <div key={el.id} className="flex items-start gap-1.5">
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase shrink-0 ${TYPE_COLORS[el.type] || 'bg-gray-100 text-gray-600'}`}>
                          {el.type.slice(0, 3)}
                        </span>
                        <span className="text-[10px] text-gray-700 leading-tight">{el.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Processes tab ── */}
      {activeTab === 'processes' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {processes.length === 0 ? (
            <div className="text-xs text-gray-400 text-center mt-8">
              No processes saved yet.<br />Parse a transcript and click "⬆ Save current".
            </div>
          ) : (
            processes.slice().reverse().map(proc => {
              const badge = PROCESS_TYPE_BADGE[proc.processType] || PROCESS_TYPE_BADGE.unclassified;
              return (
                <div key={proc.id} className="border border-gray-100 rounded-md p-3 bg-white">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{proc.processName}</div>
                      {proc.apqcNodeId && (
                        <div className="text-[10px] text-gray-400 truncate">
                          {proc.apqcNodeId} — {proc.apqcNodeName}
                        </div>
                      )}
                      {proc.isCustom && (
                        <div className="text-[10px] text-amber-600">Custom: {proc.customLabel || '—'}</div>
                      )}
                    </div>
                    <button onClick={() => handleDeleteProcess(proc.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-xs shrink-0" title="Delete">✕</button>
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>
                      {badge.label}
                    </span>

                    {proc.deviationScore != null && (
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${DEVIATION_COLORS[proc.deviationLabel] || 'bg-gray-100 text-gray-500'}`}>
                        {proc.deviationLabel} · {Math.round(proc.deviationScore * 100)}%
                      </span>
                    )}

                    <span className="text-[9px] text-gray-400 ml-auto">
                      {new Date(proc.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
