import { useState, useRef, useMemo } from 'react';
import { APQC_NODES } from '../data/apqcTaxonomy.js';
import { MSBPC_NODES, MSBPC_VERSION } from '../data/msbpcTaxonomy.js';

const STORAGE_SOURCE      = 'voice2bpmn_taxonomy_source';
const STORAGE_CUSTOM      = 'voice2bpmn_custom_taxonomy';
const STORAGE_CUSTOM_NAME = 'voice2bpmn_custom_taxonomy_name';

// ── Hierarchy parser ──────────────────────────────────────────────────────────
// Converts rows of [l1, l2, l3] (with blanks inheriting from previous row)
// into a flat { id, name, level, parentId } nodes array.

function rowsToNodes(rows) {
  const nodes = [];
  let l1n = 0, l2n = 0, l3n = 0;
  let lastL1Val = null, lastL2Val = null;
  let lastL1Id = null, lastL2Id = null;

  for (const row of rows) {
    const l1 = row[0]?.trim() || null;
    const l2 = row[1]?.trim() || null;
    const l3 = row[2]?.trim() || null;
    if (!l1 && !l2 && !l3) continue;

    if (l1 && l1 !== lastL1Val) {
      l1n++; l2n = 0; l3n = 0;
      lastL1Val = l1; lastL2Val = null;
      lastL1Id = `${l1n}`; lastL2Id = null;
      nodes.push({ id: lastL1Id, name: l1, level: 1, parentId: null });
    }
    if (l2 && l2 !== lastL2Val) {
      l2n++; l3n = 0;
      lastL2Val = l2;
      lastL2Id = `${l1n}.${l2n}`;
      nodes.push({ id: lastL2Id, name: l2, level: 2, parentId: lastL1Id });
    }
    if (l3) {
      l3n++;
      nodes.push({ id: `${l1n}.${l2n}.${l3n}`, name: l3, level: 3, parentId: lastL2Id });
    }
  }
  return nodes;
}

function detectColumns(header) {
  const h = header.map(x => String(x).trim().toLowerCase());
  const find = (...terms) => {
    const i = h.findIndex(c => terms.some(t => c.includes(t)));
    return i >= 0 ? i : null;
  };
  return [
    find('area', 'category', 'level 1', 'l1') ?? 0,
    find('group', 'sub', 'level 2', 'l2') ?? 1,
    find('process', 'level 3', 'l3') ?? 2,
  ];
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsvText(text) {
  function splitRow(line) {
    const cells = []; let cur = '', inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cells.push(cur); cur = ''; continue; }
      cur += c;
    }
    cells.push(cur);
    return cells.map(s => s.trim());
  }
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('Need at least a header row + one data row');
  const [c0, c1, c2] = detectColumns(splitRow(lines[0]));
  const rows = lines.slice(1).map(l => { const c = splitRow(l); return [c[c0] || '', c[c1] || '', c[c2] || '']; });
  const nodes = rowsToNodes(rows);
  if (!nodes.length) throw new Error('No valid rows found — check column layout');
  return nodes;
}

// ── Excel parser (xlsx loaded lazily) ────────────────────────────────────────
async function parseExcelBuffer(buf) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (raw.length < 2) throw new Error('Spreadsheet appears empty');
  const [c0, c1, c2] = detectColumns(raw[0]);
  const rows = raw.slice(1).map(row => [
    String(row[c0] || '').trim(),
    String(row[c1] || '').trim(),
    String(row[c2] || '').trim(),
  ]);
  const nodes = rowsToNodes(rows);
  if (!nodes.length) throw new Error('No valid rows found — check column layout');
  return nodes;
}

function loadJson(key) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}

// ── Shared tree browser ───────────────────────────────────────────────────────
function TaxonomyBrowser({ nodes, selectedId, onSelect }) {
  const [search, setSearch] = useState('');
  const [expandedL1, setExpandedL1] = useState(null);
  const [expandedL2, setExpandedL2] = useState(null);

  const L1 = nodes.filter(n => n.level === 1);
  const L2 = nodes.filter(n => n.level === 2);
  const L3 = nodes.filter(n => n.level === 3);
  const q = search.trim().toLowerCase();

  const matchL2 = useMemo(() => !q ? [] : L2.filter(n => n.name.toLowerCase().includes(q) || n.id.includes(q)), [q, L2]);
  const matchL3 = useMemo(() => !q ? [] : L3.filter(n => n.name.toLowerCase().includes(q) || n.id.includes(q)), [q, L3]);

  return (
    <div className="border-t border-gray-100">
      <div className="px-3 py-2 border-b border-gray-100">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          autoFocus
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-green-400"
        />
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
        {q ? (
          <div className="p-2 space-y-0.5">
            {matchL2.length === 0 && matchL3.length === 0
              ? <div className="text-xs text-gray-400 text-center py-4">No matches</div>
              : <>
                  {matchL2.map(n => <NodeBtn key={n.id} node={n} level={2} sel={selectedId === n.id} onSelect={onSelect} />)}
                  {matchL3.map(n => <NodeBtn key={n.id} node={n} level={3} sel={selectedId === n.id} onSelect={onSelect} />)}
                </>
            }
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {L1.map(l1 => {
              const expL1 = expandedL1 === l1.id;
              const l2s = L2.filter(n => n.parentId === l1.id);
              return (
                <div key={l1.id}>
                  <button
                    onClick={() => setExpandedL1(expL1 ? null : l1.id)}
                    className={`w-full text-left text-[10px] font-semibold px-2 py-1.5 rounded-md border transition-colors ${expL1 ? 'border-green-400 text-green-700 bg-green-50' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    <span className="font-mono text-gray-400 mr-1">{l1.id}</span>
                    {l1.name}
                    <span className="ml-1 text-gray-400">{expL1 ? '▴' : '▾'}</span>
                  </button>
                  {expL1 && (
                    <div className="mt-1.5 ml-2 space-y-0.5">
                      {l2s.map(l2 => {
                        const selL2 = selectedId === l2.id;
                        const expL2 = expandedL2 === l2.id;
                        const l3s = L3.filter(n => n.parentId === l2.id);
                        return (
                          <div key={l2.id}>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => onSelect(l2)}
                                className={`flex-1 text-left text-[10px] px-2 py-1 rounded border transition-colors ${selL2 ? 'border-green-500 bg-green-100 text-green-800 font-semibold' : 'border-transparent text-gray-600 hover:bg-gray-100 hover:border-gray-200'}`}
                              >
                                <span className="font-mono text-gray-400 mr-1">{l2.id}</span>
                                {l2.name}
                              </button>
                              {l3s.length > 0 && (
                                <button onClick={() => setExpandedL2(expL2 ? null : l2.id)} className="text-[9px] text-gray-400 hover:text-gray-600 px-1">
                                  {expL2 ? '▴' : '▾'}
                                </button>
                              )}
                            </div>
                            {expL2 && (
                              <div className="ml-4 mt-0.5 space-y-0.5">
                                {l3s.map(l3 => (
                                  <button key={l3.id} onClick={() => onSelect(l3)}
                                    className={`w-full text-left text-[9px] px-2 py-0.5 rounded border transition-colors ${selectedId === l3.id ? 'border-green-400 bg-green-50 text-green-700 font-semibold' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
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
  );
}

function NodeBtn({ node, level, sel, onSelect }) {
  return (
    <button onClick={() => onSelect(node)}
      className={`w-full text-left px-2 py-1 rounded border transition-colors ${sel ? 'border-green-400 bg-green-50 text-green-800' : 'border-transparent text-gray-700 hover:bg-gray-100 hover:border-gray-200'}`}
    >
      <span className="font-mono text-[9px] text-gray-400 mr-1">{node.id}</span>
      <span className={`text-[10px] ${level === 3 ? 'text-gray-500' : 'font-medium'}`}>{node.name}</span>
    </button>
  );
}

// ── Upload panel (custom taxonomy only) ──────────────────────────────────────
function UploadPanel({ error, onUpload }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      let nodes;
      if (file.name.toLowerCase().endsWith('.csv')) {
        nodes = parseCsvText(await file.text());
      } else {
        nodes = await parseExcelBuffer(await file.arrayBuffer());
      }
      onUpload(nodes, file.name, null);
    } catch (err) {
      onUpload(null, null, err.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="text-[10px] text-gray-500 space-y-1">
        <p>Upload a 3-column CSV or Excel file with your process taxonomy.</p>
        <p className="font-mono bg-gray-50 rounded px-2 py-1 text-gray-500">Column order: L1 Area · L2 Group · L3 Process</p>
      </div>
      {error && (
        <p className="text-[10px] text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>
      )}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="w-full text-xs border border-dashed border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600 py-2 rounded transition-colors disabled:opacity-50"
      >
        {busy ? 'Parsing…' : 'Upload CSV or Excel'}
      </button>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Loaded header bar (shows file info + clear) ───────────────────────────────
function LoadedBar({ name, count, color, onClear }) {
  const cls = {
    blue:   'bg-blue-50 text-blue-700',
    amber:  'bg-amber-50 text-amber-700',
  }[color] || 'bg-gray-50 text-gray-700';
  return (
    <div className={`flex items-center justify-between px-3 py-1.5 border-b border-gray-100 ${cls}`}>
      <span className="text-[10px] truncate">{name} · {count} nodes</span>
      <button onClick={onClear} className="text-[10px] text-red-400 hover:text-red-600 ml-2 shrink-0">✕ Clear</button>
    </div>
  );
}

// ── Source tab button ─────────────────────────────────────────────────────────
function SourceTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-[10px] font-semibold py-1 rounded border transition-colors ${
        active
          ? 'border-gray-800 bg-gray-800 text-white'
          : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TaxonomySourceSelector({ processContext, onChange }) {
  const [source, setSourceRaw] = useState(() => localStorage.getItem(STORAGE_SOURCE) || 'apqc');
  const [open, setOpen] = useState(false);

  const [customNodes, setCustomNodes] = useState(() => loadJson(STORAGE_CUSTOM));
  const [customName,  setCustomName]  = useState(() => localStorage.getItem(STORAGE_CUSTOM_NAME));
  const [customError, setCustomError] = useState(null);

  const { apqcNodeId, apqcNodeName } = processContext;

  function switchSource(s) {
    setSourceRaw(s);
    localStorage.setItem(STORAGE_SOURCE, s);
    onChange({ ...processContext, apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
    setOpen(true);
  }

  function handleSelect(node) {
    onChange({ ...processContext, apqcNodeId: node.id, apqcNodeName: node.name, isCustom: false, customLabel: null });
    setOpen(false);
  }

  function handleClear() {
    onChange({ ...processContext, apqcNodeId: null, apqcNodeName: null, isCustom: false, customLabel: null });
  }

  function handleCustomUpload(nodes, name, error) {
    if (error) { setCustomError(error); return; }
    setCustomError(null);
    setCustomNodes(nodes); setCustomName(name);
    localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(nodes));
    localStorage.setItem(STORAGE_CUSTOM_NAME, name);
  }

  function handleCustomClear() {
    setCustomNodes(null); setCustomName(null);
    localStorage.removeItem(STORAGE_CUSTOM);
    localStorage.removeItem(STORAGE_CUSTOM_NAME);
    handleClear();
  }

  const badgeLabel = source === 'apqc' ? 'APQC' : source === 'msbpc' ? 'MS BPC' : 'Custom';
  const badgeCls   = source === 'apqc'
    ? 'border-green-300 text-green-700 bg-green-50'
    : source === 'msbpc'
      ? 'border-blue-300 text-blue-700 bg-blue-50'
      : 'border-amber-300 text-amber-700 bg-amber-50';

  const selectionLabel = apqcNodeId ? `${apqcNodeId} — ${apqcNodeName}` : null;

  return (
    <div>
      {/* ── Collapsed header ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeCls}`}>
            {badgeLabel}
          </span>
          {selectionLabel
            ? <span className="text-[10px] text-green-700 font-medium truncate">{selectionLabel}</span>
            : <span className="text-[10px] text-gray-300 italic">optional — helps LLM naming</span>
          }
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {apqcNodeId && (
            <button
              onClick={e => { e.stopPropagation(); handleClear(); }}
              className="text-gray-300 hover:text-red-400 transition-colors text-xs"
              title="Clear selection"
            >✕</button>
          )}
          <span className="text-gray-400 text-xs">{open ? '▴' : '▾'}</span>
        </div>
      </div>

      {/* ── Expanded content ─────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-gray-100">

          {/* Source tabs */}
          <div className="flex gap-1 p-2 border-b border-gray-100 bg-gray-50">
            <SourceTab label="APQC PCF"      active={source === 'apqc'}   onClick={() => source !== 'apqc'   && switchSource('apqc')} />
            <SourceTab label="MS BPC"        active={source === 'msbpc'}  onClick={() => source !== 'msbpc'  && switchSource('msbpc')} />
            <SourceTab label="Your taxonomy" active={source === 'custom'} onClick={() => source !== 'custom' && switchSource('custom')} />
          </div>

          {/* APQC */}
          {source === 'apqc' && (
            <TaxonomyBrowser nodes={APQC_NODES} selectedId={apqcNodeId} onSelect={handleSelect} />
          )}

          {/* MS BPC — bundled data, no upload needed */}
          {source === 'msbpc' && (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-blue-50">
                <span className="text-[10px] text-blue-700">
                  Microsoft Dynamics 365 Business Process Catalog
                </span>
                <span className="text-[9px] font-bold text-blue-500 ml-2 shrink-0">{MSBPC_VERSION}</span>
              </div>
              <TaxonomyBrowser nodes={MSBPC_NODES} selectedId={apqcNodeId} onSelect={handleSelect} />
            </>
          )}

          {/* Custom */}
          {source === 'custom' && (
            customNodes
              ? <>
                  <LoadedBar name={customName} count={customNodes.length} color="amber" onClear={handleCustomClear} />
                  <TaxonomyBrowser nodes={customNodes} selectedId={apqcNodeId} onSelect={handleSelect} />
                </>
              : <UploadPanel error={customError} onUpload={handleCustomUpload} />
          )}
        </div>
      )}
    </div>
  );
}
