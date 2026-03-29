import { useState, useMemo } from 'react';
import { APQC_NODES } from '../data/apqcTaxonomy.js';

export default function ApqcSelector({ processContext, onChange, nodes: customNodes }) {
  const nodes = customNodes || APQC_NODES;
  const LEVEL1 = nodes.filter(n => n.level === 1);
  const LEVEL2 = nodes.filter(n => n.level === 2);
  const LEVEL3 = nodes.filter(n => n.level === 3);
  const [open, setOpen]           = useState(false);
  const [search, setSearch]       = useState('');
  const [expandedL1, setExpandedL1] = useState(null); // L1 node id
  const [expandedL2, setExpandedL2] = useState(null); // L2 node id (for L3 peek)

  const { apqcNodeId, apqcNodeName, isCustom, customLabel } = processContext;

  // ── helpers ────────────────────────────────────────────────────────────────

  function select(node) {
    onChange({ ...processContext, apqcNodeId: node.id, apqcNodeName: node.name, isCustom: false, customLabel: null });
    setOpen(false);
    setSearch('');
  }

  function clearSelection() {
    onChange({ ...processContext, apqcNodeId: null, apqcNodeName: null });
  }

  function toggleCustom() {
    const next = !isCustom;
    onChange({
      ...processContext,
      isCustom: next,
      apqcNodeId: next ? null : apqcNodeId,
      apqcNodeName: next ? null : apqcNodeName,
    });
    if (next) setOpen(false);
  }

  // ── search filtering ────────────────────────────────────────────────────────

  const searchLower = search.trim().toLowerCase();

  const matchedL2 = useMemo(() => {
    if (!searchLower) return [];
    return LEVEL2.filter(
      n => n.name.toLowerCase().includes(searchLower) ||
           n.id.includes(searchLower)
    );
  }, [searchLower]);

  const matchedL3 = useMemo(() => {
    if (!searchLower) return [];
    return LEVEL3.filter(
      n => n.name.toLowerCase().includes(searchLower) ||
           n.id.includes(searchLower)
    );
  }, [searchLower]);

  // ── display helpers ─────────────────────────────────────────────────────────

  const hasSelection = isCustom || !!apqcNodeId;

  const summaryLabel = isCustom
    ? (customLabel ? `Custom: ${customLabel}` : 'Custom process')
    : apqcNodeId
      ? `${apqcNodeId} — ${apqcNodeName}`
      : null;

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="border-t border-gray-100 shrink-0">
      {/* Collapsed bar */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => !isCustom && setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">
            APQC context
          </span>
          {summaryLabel ? (
            <span className="text-[10px] text-green-700 font-medium truncate">{summaryLabel}</span>
          ) : (
            <span className="text-[10px] text-gray-300 italic">optional — helps LLM naming</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Custom toggle */}
          <button
            onClick={e => { e.stopPropagation(); toggleCustom(); }}
            title={isCustom ? 'Switch back to APQC taxonomy' : 'Mark as custom/new process'}
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
              isCustom
                ? 'border-amber-400 text-amber-600 bg-amber-50'
                : 'border-gray-200 text-gray-400 hover:border-gray-300'
            }`}
          >
            custom
          </button>
          {hasSelection && (
            <button
              onClick={e => { e.stopPropagation(); clearSelection(); onChange({ ...processContext, apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null }); }}
              className="text-gray-300 hover:text-red-400 transition-colors text-xs"
              title="Clear selection"
            >
              ✕
            </button>
          )}
          {!isCustom && (
            <span className="text-gray-400 text-xs">{open ? '▴' : '▾'}</span>
          )}
        </div>
      </div>

      {/* Custom label input */}
      {isCustom && (
        <div className="px-4 pb-2">
          <input
            type="text"
            value={customLabel || ''}
            onChange={e => onChange({ ...processContext, customLabel: e.target.value })}
            placeholder="Describe the process domain..."
            className="w-full text-xs border border-amber-200 rounded px-2 py-1 focus:outline-none focus:border-amber-400 bg-amber-50"
            autoFocus
          />
        </div>
      )}

      {/* Expanded selector */}
      {open && !isCustom && (
        <div className="border-t border-gray-100 bg-white">
          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search APQC processes..."
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-green-400"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
            {/* ── Search results ── */}
            {searchLower ? (
              <div className="p-2 space-y-0.5">
                {matchedL2.length === 0 && matchedL3.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4">No matches</div>
                ) : (
                  <>
                    {matchedL2.map(node => (
                      <SearchResult key={node.id} node={node} level={2} onSelect={select} selected={apqcNodeId === node.id} />
                    ))}
                    {matchedL3.map(node => (
                      <SearchResult key={node.id} node={node} level={3} onSelect={select} selected={apqcNodeId === node.id} />
                    ))}
                  </>
                )}
              </div>
            ) : (
              /* ── Browse: L1 pills → L2 chips ── */
              <div className="p-3 space-y-3">
                {LEVEL1.map(l1 => {
                  const isExpL1 = expandedL1 === l1.id;
                  const l2s = LEVEL2.filter(n => n.parentId === l1.id);
                  return (
                    <div key={l1.id}>
                      <button
                        onClick={() => setExpandedL1(isExpL1 ? null : l1.id)}
                        className={`w-full text-left text-[10px] font-semibold px-2 py-1.5 rounded-md border transition-colors ${
                          isExpL1
                            ? 'border-green-400 text-green-700 bg-green-50'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-mono text-gray-400 mr-1">{l1.id}</span>
                        {l1.name}
                        <span className="ml-1 text-gray-400">{isExpL1 ? '▴' : '▾'}</span>
                      </button>

                      {isExpL1 && (
                        <div className="mt-1.5 ml-2 space-y-0.5">
                          {l2s.map(l2 => {
                            const isSelL2 = apqcNodeId === l2.id;
                            const isExpL2 = expandedL2 === l2.id;
                            const l3s = LEVEL3.filter(n => n.parentId === l2.id);
                            return (
                              <div key={l2.id}>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => select(l2)}
                                    className={`flex-1 text-left text-[10px] px-2 py-1 rounded border transition-colors ${
                                      isSelL2
                                        ? 'border-green-500 bg-green-100 text-green-800 font-semibold'
                                        : 'border-transparent text-gray-600 hover:bg-gray-100 hover:border-gray-200'
                                    }`}
                                  >
                                    <span className="font-mono text-gray-400 mr-1">{l2.id}</span>
                                    {l2.name}
                                  </button>
                                  {l3s.length > 0 && (
                                    <button
                                      onClick={() => setExpandedL2(isExpL2 ? null : l2.id)}
                                      className="text-[9px] text-gray-400 hover:text-gray-600 px-1"
                                      title="Show sub-processes"
                                    >
                                      {isExpL2 ? '▴' : '▾'}
                                    </button>
                                  )}
                                </div>
                                {isExpL2 && (
                                  <div className="ml-4 mt-0.5 space-y-0.5">
                                    {l3s.map(l3 => (
                                      <button
                                        key={l3.id}
                                        onClick={() => select(l3)}
                                        className={`w-full text-left text-[9px] px-2 py-0.5 rounded border transition-colors ${
                                          apqcNodeId === l3.id
                                            ? 'border-green-400 bg-green-50 text-green-700 font-semibold'
                                            : 'border-transparent text-gray-500 hover:bg-gray-100'
                                        }`}
                                      >
                                        <span className="font-mono text-gray-400 mr-1">{l3.id}</span>
                                        {l3.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchResult({ node, level, onSelect, selected }) {
  return (
    <button
      onClick={() => onSelect(node)}
      className={`w-full text-left px-2 py-1 rounded border transition-colors ${
        selected
          ? 'border-green-400 bg-green-50 text-green-800'
          : 'border-transparent text-gray-700 hover:bg-gray-100 hover:border-gray-200'
      }`}
    >
      <span className="font-mono text-[9px] text-gray-400 mr-1">{node.id}</span>
      <span className={`text-[10px] ${level === 3 ? 'text-gray-500' : 'font-medium'}`}>{node.name}</span>
    </button>
  );
}
