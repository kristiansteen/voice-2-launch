import { useState, useRef, useEffect } from 'react';
import { useLang } from '../i18n/LangContext.jsx';
import LangSwitcher from './LangSwitcher.jsx';
import { APQC_NODES } from '../data/apqcTaxonomy.js';
import { MSBPC_NODES } from '../data/msbpcTaxonomy.js';

const PRICING_URL = 'https://ailean.dk/ailean-pricing';

// ── Taxonomy helpers ──────────────────────────────────────────────────────────

const APQC_ID_SET  = new Set(APQC_NODES.map(n => n.id));
const MSBPC_ID_SET = new Set(MSBPC_NODES.map(n => n.id));

function inferTaxonomySource(nodeId) {
  if (!nodeId) return null;
  if (APQC_ID_SET.has(nodeId))  return 'APQC';
  if (MSBPC_ID_SET.has(nodeId)) return 'MS BPC';
  return 'Custom';
}

const TAXONOMY_BADGE = {
  'APQC':    'border-green-300 text-green-700 bg-green-50',
  'MS BPC':  'border-blue-300  text-blue-700  bg-blue-50',
  'Custom':  'border-amber-300 text-amber-700 bg-amber-50',
};

const L1_BORDER_COLOR = { 'APQC': '#22c55e', 'MS BPC': '#3b82f6', 'Custom': '#f59e0b' };
const L1_BG_CLASS     = { 'APQC': 'bg-green-50/50', 'MS BPC': 'bg-blue-50/50', 'Custom': 'bg-amber-50/50' };

function l1HeaderStyle(nodeId) {
  const src = inferTaxonomySource(nodeId);
  return { borderLeft: `4px solid ${L1_BORDER_COLOR[src] || '#9ca3af'}` };
}
function l1HeaderBg(nodeId) {
  const src = inferTaxonomySource(nodeId);
  return L1_BG_CLASS[src] || 'bg-gray-50';
}

function TaxonomyBadge({ nodeId }) {
  const source = inferTaxonomySource(nodeId);
  if (!source) return null;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${TAXONOMY_BADGE[source]}`}>
      {source}
    </span>
  );
}

// ── Taxonomy grouping ─────────────────────────────────────────────────────────

function getActiveTaxonomyNodes() {
  const source = localStorage.getItem('voice2bpmn_taxonomy_source') || 'apqc';
  if (source === 'msbpc') return MSBPC_NODES;
  if (source === 'custom') {
    try {
      const s = localStorage.getItem('voice2bpmn_custom_taxonomy');
      if (s) return JSON.parse(s);
    } catch { /* fall through */ }
  }
  return APQC_NODES;
}

// Returns: [{ l1, l2Entries: [{ l2, flows }] }, ...] sorted by taxonomy order.
// Flows without taxonomy context land in a trailing { l1: null } group.
function groupByTaxonomy(flows, nodes) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const l1Order = nodes.filter(n => n.level === 1).map(n => n.id);
  const l2Order = nodes.filter(n => n.level === 2).map(n => n.id);

  function ancestry(nodeId) {
    const node = nodeMap[nodeId];
    if (!node) return { l1: null, l2: null };
    if (node.level === 1) return { l1: node, l2: null };
    if (node.level === 2) return { l1: nodeMap[node.parentId] || null, l2: node };
    // level 3
    const l2 = nodeMap[node.parentId] || null;
    return { l1: l2 ? nodeMap[l2.parentId] || null : null, l2 };
  }

  // l1Id → { l1, l2Groups: Map<l2Id|'__none__', { l2, flows[] }> }
  const l1Map = new Map();
  const ungrouped = [];

  for (const flow of flows) {
    const { l1, l2 } = ancestry(flow.processContext?.apqcNodeId);
    if (!l1) { ungrouped.push(flow); continue; }

    if (!l1Map.has(l1.id)) l1Map.set(l1.id, { l1, l2Groups: new Map() });
    const l1Entry = l1Map.get(l1.id);
    const l2Key = l2?.id || '__none__';
    if (!l1Entry.l2Groups.has(l2Key)) l1Entry.l2Groups.set(l2Key, { l2, flows: [] });
    l1Entry.l2Groups.get(l2Key).flows.push(flow);
  }

  const result = [];
  for (const l1Id of l1Order) {
    if (!l1Map.has(l1Id)) continue;
    const { l1, l2Groups } = l1Map.get(l1Id);
    const l2Entries = [];
    for (const key of [...l2Order, '__none__']) {
      if (l2Groups.has(key)) l2Entries.push(l2Groups.get(key));
    }
    result.push({ l1, l2Entries });
  }
  if (ungrouped.length) result.push({ l1: null, l2Entries: [{ l2: null, flows: ungrouped }] });
  return result;
}

const CATEGORY_COLOURS = {
  automation: 'bg-blue-100 text-blue-700',
  governance: 'bg-purple-100 text-purple-700',
  clarity:    'bg-yellow-100 text-yellow-700',
  efficiency: 'bg-green-100 text-green-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function relativeTime(iso, t) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.dashJustNow;
  if (mins < 60) return t.dashMinsAgo.replace('{n}', mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t.dashHrsAgo.replace('{n}', hrs);
  const days = Math.floor(hrs / 24);
  if (days < 7) return t.dashDaysAgo.replace('{n}', days);
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t.dashWeeksAgo.replace('{n}', weeks);
  return formatDate(iso);
}

const STEPS = [
  { key: 'transcript',         tKey: 'dashStepInterview',    color: 'bg-blue-100 text-blue-700' },
  { key: 'processDescription', tKey: 'dashStepDescription',  color: 'bg-indigo-100 text-indigo-700' },
  { key: 'parsed',             tKey: 'dashStepMapped',       color: 'bg-purple-100 text-purple-700' },
  { key: 'improvements',       tKey: 'dashStepImprovements', color: 'bg-amber-100 text-amber-700' },
  { key: 'projectPlan',        tKey: 'dashStepPlan',         color: 'bg-green-100 text-green-700' },
  { key: 'board_url',          tKey: 'dashStepExported',     color: 'bg-emerald-100 text-emerald-700' },
];

function lastStep(flow, t) {
  for (let i = STEPS.length - 1; i >= 0; i--) {
    const { key, tKey, color } = STEPS[i];
    const val = flow[key];
    if (val && (typeof val !== 'object' || (Array.isArray(val) ? val.length > 0 : Object.keys(val).length > 0))) {
      return { label: t[tKey], color };
    }
  }
  return { label: t.dashStepNotStarted, color: 'bg-gray-100 text-gray-400' };
}

function progressPercent(flow) {
  const total = STEPS.length;
  let done = 0;
  for (const { key } of STEPS) {
    const val = flow[key];
    if (val && (typeof val !== 'object' || (Array.isArray(val) ? val.length > 0 : Object.keys(val).length > 0))) done++;
  }
  return Math.round((done / total) * 100);
}

function shortId(id) {
  return id ? id.slice(0, 8) : '—';
}

// Week number relative to flow creation date (week 1 = first 7 days after created_at)
function getCurrentWeekNo(createdAt) {
  if (!createdAt) return 1;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / msPerWeek) + 1;
}

function getPlannedFinishWeek(projectPlan) {
  if (!projectPlan?.tasks?.length) return null;
  return Math.max(...projectPlan.tasks.map(t =>
    (t.startWeek || 1) + Math.ceil(((t.durationDays || 3) - 1) / 5)
  ));
}

function getDueThisWeek(projectPlan, createdAt) {
  if (!projectPlan?.tasks?.length) return 0;
  const cw = getCurrentWeekNo(createdAt);
  return projectPlan.tasks.filter(t => t.startWeek === cw).length;
}

function getOverdue(projectPlan, createdAt) {
  if (!projectPlan?.tasks?.length) return 0;
  const cw = getCurrentWeekNo(createdAt);
  return projectPlan.tasks.filter(t => {
    const endWeek = (t.startWeek || 1) + Math.ceil(((t.durationDays || 3) - 1) / 5);
    return endWeek < cw;
  }).length;
}

function getProjectTypes(flow) {
  const cats = [...new Set((flow.improvements || []).map(i => i.category).filter(c => c && c !== 'risk'))];
  const hasAi = (flow.improvements || []).some(i => i.ai_candidate);
  return { cats, hasAi };
}

function getTopRisks(flow) {
  const risks = flow.projectPlan?.risks || [];
  return [...risks]
    .sort((a, b) => (b.probability * b.consequence) - (a.probability * a.consequence))
    .slice(0, 3);
}

function getKeyDeliverables(flow) {
  const selected = (flow.improvements || []).filter(i =>
    (flow.selectedImprovementIds || []).includes(i.id)
  );
  return selected.length ? selected : (flow.improvements || []).slice(0, 3);
}

// ── Deletable tag ─────────────────────────────────────────────────────────────

function DeletableTag({ tagKey, hidden, onHide, className, children }) {
  if (hidden) return null;
  return (
    <span className={`relative group/tag inline-flex items-center ${className}`}>
      {children}
      <button
        onClick={e => { e.stopPropagation(); onHide(tagKey); }}
        className="opacity-0 group-hover/tag:opacity-100 ml-0.5 text-[8px] leading-none text-current hover:text-red-500 transition-opacity"
        title="Hide"
      >✕</button>
    </span>
  );
}

// ── Efficiency helpers ────────────────────────────────────────────────────────

function toMinutes(value, unit) {
  const m = { min: 1, hr: 60, day: 480, week: 2400 };
  return value * (m[unit] || 1);
}

function computeEfficiencies(flow) {
  const asIs = flow.asIsMetrics;
  const toBe = flow.toBeMetrics;

  let leadTimeReduction = null;
  let backlogReduction  = null;

  if (asIs?.activities?.length && toBe?.activities?.length) {
    const asIsTime = asIs.activities.reduce((s, a) => s + toMinutes(a.duration_value, a.duration_unit), 0);
    const toBeTime = toBe.activities.reduce((s, a) => s + toMinutes(a.duration_value, a.duration_unit), 0);
    if (asIsTime > 0) leadTimeReduction = Math.round((1 - toBeTime / asIsTime) * 100);

    const asIsBacklog = asIs.activities.reduce((s, a) => s + (a.backlog || 0), 0);
    const toBeBacklog = toBe.activities.reduce((s, a) => s + (a.backlog || 0), 0);
    if (asIsBacklog > 0) backlogReduction = Math.round((1 - toBeBacklog / asIsBacklog) * 100);
  }

  const imps = flow.improvements || [];
  const hasAutomation   = imps.some(i => i.category === 'automation');
  const hasClarity      = imps.some(i => i.category === 'clarity');
  const hasGovernance   = imps.some(i => i.category === 'governance');
  const hasEfficiency   = imps.some(i => i.category === 'efficiency');
  const hasAiCandidate  = imps.some(i => i.ai_candidate);

  return { leadTimeReduction, backlogReduction, hasAutomation, hasClarity, hasGovernance, hasEfficiency, hasAiCandidate };
}

function EfficiencyCell({ flow }) {
  const { t } = useLang();
  const { leadTimeReduction, backlogReduction, hasAutomation, hasClarity, hasGovernance, hasEfficiency } = computeEfficiencies(flow);

  const [hidden, setHidden] = useState(() => {
    try {
      const s = localStorage.getItem(`voice2bpmn_eff_hidden_${flow.id}`);
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch { return new Set(); }
  });

  function hide(key) {
    setHidden(prev => {
      const next = new Set(prev); next.add(key);
      localStorage.setItem(`voice2bpmn_eff_hidden_${flow.id}`, JSON.stringify([...next]));
      return next;
    });
  }

  const h = key => hidden.has(key);

  const hasQuantitative = leadTimeReduction !== null || backlogReduction !== null;
  const hasQualitative  = hasGovernance || hasAutomation || hasEfficiency || hasClarity;
  const hasAny = hasQuantitative || hasQualitative;

  if (!hasAny) return <span className="text-xs text-gray-300">—</span>;

  return (
    <div className="flex flex-col gap-0.5 items-start">
      {/* Row 1: quantitative */}
      <div className="flex flex-wrap gap-0.5">
        {leadTimeReduction !== null && (
          <DeletableTag tagKey="lead_time" hidden={h('lead_time')} onHide={hide}
            className="text-[10px] font-semibold bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
            {t.dashEffLeadTime.replace('{n}', leadTimeReduction)}
          </DeletableTag>
        )}
        {leadTimeReduction !== null && (
          <DeletableTag tagKey="cost" hidden={h('cost')} onHide={hide}
            className="text-[10px] font-semibold bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
            {t.dashEffCost.replace('{n}', leadTimeReduction)}
          </DeletableTag>
        )}
        {backlogReduction !== null && (
          <DeletableTag tagKey="backlog" hidden={h('backlog')} onHide={hide}
            className="text-[10px] font-semibold bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
            {t.dashEffBacklog.replace('{n}', backlogReduction)}
          </DeletableTag>
        )}
      </div>
      {/* Row 2: qualitative */}
      <div className="flex flex-wrap gap-0.5">
        {(hasGovernance || hasAutomation) && (
          <DeletableTag tagKey="quality" hidden={h('quality')} onHide={hide}
            className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
            {t.dashEffQuality}
          </DeletableTag>
        )}
        {(hasAutomation || hasEfficiency) && (
          <DeletableTag tagKey="cust_sat" hidden={h('cust_sat')} onHide={hide}
            className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">
            {t.dashEffCustSat}
          </DeletableTag>
        )}
        {hasClarity && (
          <DeletableTag tagKey="motivation" hidden={h('motivation')} onHide={hide}
            className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
            {t.dashEffMotivation}
          </DeletableTag>
        )}
      </div>
    </div>
  );
}

// ── RAG indicator ─────────────────────────────────────────────────────────────

function getRagOptions(t) {
  return [
    { value: 'green', label: t.dashRagOnTrack,  bg: 'bg-green-500', ring: 'ring-green-400' },
    { value: 'amber', label: t.dashRagAtRisk,   bg: 'bg-amber-400', ring: 'ring-amber-300' },
    { value: 'red',   label: t.dashRagOffTrack, bg: 'bg-red-500',   ring: 'ring-red-400' },
  ];
}

function RagPicker({ value, onChange, showLabel = false }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const ragOptions = getRagOptions(t);
  const current = ragOptions.find(o => o.value === value) || { bg: 'bg-gray-300', label: t.dashRagSetStatus };

  function handleOpen(e) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
    }
    setOpen(o => !o);
  }

  // Close on scroll so the popover doesn't drift
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open]);

  return (
    <div className={showLabel ? 'flex items-center gap-1.5 cursor-pointer' : 'flex justify-center'} onClick={showLabel ? handleOpen : undefined}>
      <button
        ref={btnRef}
        onClick={showLabel ? undefined : handleOpen}
        title={current.label}
        className={`shrink-0 rounded-full ${current.bg} transition-all hover:scale-110 ${
          showLabel
            ? 'w-2.5 h-2.5'
            : `w-5 h-5 ring-2 ring-offset-1 ${value ? current.ring : 'ring-gray-200'}`
        }`}
      />
      {showLabel && (
        <span className={`text-xs font-medium ${value ? 'text-gray-700' : 'text-gray-400'}`}>
          {current.label}
        </span>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2 flex flex-col gap-1.5 min-w-[110px] -translate-x-1/2"
            style={{ top: pos.top, left: pos.left }}
          >
            {ragOptions.map(opt => (
              <button
                key={opt.value}
                onClick={e => { e.stopPropagation(); onChange(opt.value); setOpen(false); }}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 text-left transition-colors ${value === opt.value ? 'bg-gray-50' : ''}`}
              >
                <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${opt.bg}`} />
                <span className="text-xs text-gray-700">{opt.label}</span>
              </button>
            ))}
            {value && (
              <button
                onClick={e => { e.stopPropagation(); onChange(null); setOpen(false); }}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 text-left"
              >
                <span className="w-3.5 h-3.5 rounded-full shrink-0 bg-gray-200" />
                <span className="text-xs text-gray-400">{t.dashRagClear}</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Automation level ──────────────────────────────────────────────────────────

const AUTO_T_KEYS = ['', 'dashAutoManual', 'dashAutoAssisted', 'dashAutoPartial', 'dashAutoAutomated', 'dashAutoAiPowered'];
const SYS_RE = /\b(erp|system|automated|automation|bot|engine|api|crm|sap|oracle|software|tool|platform|ai)\b/i;

function computeAutomationLevels(flow) {
  const steps = flow.description?.steps || [];
  const sysCount = steps.filter(s => SYS_RE.test(s.performer || '')).length;
  const ratio = steps.length ? sysCount / steps.length : 0;
  let current;
  if      (ratio < 0.15) current = 1;
  else if (ratio < 0.35) current = 2;
  else if (ratio < 0.55) current = 3;
  else if (ratio < 0.75) current = 4;
  else                    current = 5;

  const imps = flow.improvements || [];
  const selected = imps.filter(i => (flow.selectedImprovementIds || []).includes(i.id));
  const automationCount = selected.filter(i => i.category === 'automation').length;
  const hasAiCandidate  = selected.some(i => i.ai_candidate);
  const boost = Math.min(automationCount, 2) + (hasAiCandidate ? 1 : 0);
  const future = Math.min(5, current + boost);
  return { current, future };
}

function AutomationDots({ level, activeClass }) {
  return (
    <div className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`w-2 h-2 rounded-full ${i <= level ? activeClass : 'bg-gray-200'}`} />
      ))}
    </div>
  );
}

function AutomationCell({ flow }) {
  const { t } = useLang();
  const hasData = flow.description?.steps?.length || flow.improvements?.length;
  if (!hasData) return <span className="text-xs text-gray-300">—</span>;
  const { current, future } = computeAutomationLevels(flow);
  const improved = future > current;
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-gray-400 w-6 shrink-0">{t.dashAutoNow}</span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-300 rounded-full" style={{ width: `${(current / 5) * 100}%` }} />
        </div>
        <span className="text-[9px] text-gray-500 w-14 shrink-0 truncate">{t[AUTO_T_KEYS[current]]}</span>
      </div>
      {improved && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-400 w-6 shrink-0">{t.dashAutoGoal}</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full" style={{ width: `${(future / 5) * 100}%` }} />
          </div>
          <span className="text-[9px] text-green-600 w-14 shrink-0 truncate">{t[AUTO_T_KEYS[future]]}</span>
        </div>
      )}
    </div>
  );
}

// ── Matrix row ────────────────────────────────────────────────────────────────

function MatrixRow({ flow, rowIndex = 0, onOpen, onUpdateRag, onDelete }) {
  const { t } = useLang();
  const { cats, hasAi } = getProjectTypes(flow);
  const deliverables = getKeyDeliverables(flow);
  const topRisks = getTopRisks(flow);

  return (
    <tr
      className={`border-b border-gray-100 cursor-pointer group transition-colors hover:bg-blue-50/40 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
      onClick={() => onOpen(flow.id)}
    >
      {/* Project name */}
      <td className="px-3 py-2.5 border-l-2 border-l-transparent group-hover:border-l-indigo-400 transition-colors">
        <div className="flex items-center gap-1.5 min-w-0">
          {flow._demo && (
            <span className="shrink-0 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">Demo</span>
          )}
          <p className="text-sm font-medium text-gray-800 truncate leading-snug" title={flow.process_name}>
            {flow.process_name || <span className="text-gray-300 italic">{t.dashUntitled}</span>}
          </p>
        </div>
      </td>

      {/* Project type */}
      <td className="px-3 py-2.5">
        {(() => {
          const tags = [
            ...cats.map(cat => <span key={cat} className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${CATEGORY_COLOURS[cat] || 'bg-gray-100 text-gray-600'}`}>{cat}</span>),
            ...(hasAi ? [<span key="ai" className="text-[10px] px-1.5 py-0.5 rounded font-semibold text-white" style={{ backgroundColor: '#65c434' }}>✦ AI</span>] : []),
          ];
          return tags.length === 0
            ? <span className="text-xs text-gray-300">—</span>
            : <div className="flex flex-wrap gap-0.5 items-start" style={{ maxWidth: '12rem' }}>{tags}</div>;
        })()}
      </td>

      {/* Plan start / duration / end */}
      {(() => {
        const start = flow.projectPlan?._startDate || flow.created_at;
        const weeks = flow.projectPlan?.duration_weeks;
        const endDate = start && weeks
          ? new Date(new Date(start).getTime() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString()
          : null;
        return (
          <td className="px-3 py-2.5 text-xs text-gray-500">
            <div>{formatDate(start)}</div>
            {weeks && (
              <div className="text-[10px] text-gray-400 mt-0.5">
                {weeks}w · {formatDate(endDate)}
              </div>
            )}
          </td>
        );
      })()}

      {/* Board */}
      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
        {flow.board_url
          ? <a href={flow.board_url} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-vimpl-dark hover:underline whitespace-nowrap font-medium">
              {t.dashOpenBoard}
            </a>
          : <button
              onClick={() => onOpen(flow.id)}
              className="text-[10px] text-gray-300 hover:text-vimpl-dark transition-colors whitespace-nowrap"
              title="Open flow to link a board"
            >
              {t.dashLinkBoard}
            </button>
        }
      </td>

      {/* Key deliverables */}
      <td className="px-3 py-2.5 align-top">
        {deliverables.length ? (
          <ul className="space-y-0.5">
            {deliverables.slice(0, 3).map((d, i) => (
              <li key={i} className="text-[11px] text-gray-600 truncate leading-snug">
                · {d.title || d.name || d.description}
              </li>
            ))}
            {deliverables.length > 3 && (
              <li className="text-[10px] text-gray-400">{t.dashMore.replace('{n}', deliverables.length - 3)}</li>
            )}
          </ul>
        ) : <span className="text-xs text-gray-300">—</span>}
      </td>

      {/* Top 3 risks */}
      <td className="px-3 py-2.5 align-top">
        {topRisks.length ? (
          <ul className="space-y-0.5">
            {topRisks.map((r, i) => {
              const score = r.probability * r.consequence;
              const heat = score >= 6000 ? 'text-red-600' : score >= 3000 ? 'text-amber-600' : 'text-gray-500';
              return (
                <li key={r.id || i} className={`text-[11px] truncate leading-snug ${heat}`} title={r.title}>
                  · {r.title}
                </li>
              );
            })}
          </ul>
        ) : <span className="text-xs text-gray-300">—</span>}
      </td>

      {/* Efficiency gains */}
      <td className="px-3 py-2.5">
        <EfficiencyCell flow={flow} />
      </td>

      {/* Automation level */}
      <td className="px-3 py-2.5">
        <AutomationCell flow={flow} />
      </td>

      {/* RAG status */}
      <td
        className={`px-3 py-2.5 transition-colors ${
          flow.ragStatus === 'green' ? 'bg-green-50' :
          flow.ragStatus === 'amber' ? 'bg-amber-50' :
          flow.ragStatus === 'red'   ? 'bg-red-50'   : ''
        }`}
        onClick={e => e.stopPropagation()}
      >
        <RagPicker
          showLabel
          value={flow.ragStatus || null}
          onChange={status => onUpdateRag(flow.id, status)}
        />
      </td>

      {/* Delete */}
      <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onDelete(flow)}
          title="Delete flow"
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all rounded px-1.5 py-0.5 text-xs"
        >✕</button>
      </td>
    </tr>
  );
}

// ── Project matrix ────────────────────────────────────────────────────────────

const MATRIX_COLS = 10;

function ProjectMatrix({ flows, onOpen, onUpdateRag, onDelete }) {
  const { t } = useLang();
  const nodes = getActiveTaxonomyNodes();
  const groups = groupByTaxonomy(
    [...flows].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
    nodes,
  );
  const isGrouped = groups.some(g => g.l1 !== null);

  const TH = ({ children, center }) => (
    <th className={`px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-b-2 border-gray-200 ${center ? 'text-center' : ''}`}>
      {children}
    </th>
  );

  return (
    <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm bg-white">
      <table className="w-full text-sm border-collapse table-fixed">
        <colgroup>
          <col style={{ width: '220px' }} />  {/* Project name */}
          <col style={{ width: '130px' }} />  {/* Type */}
          <col style={{ width: '110px' }} />  {/* Plan start */}
          <col style={{ width: '64px'  }} />  {/* Board */}
          <col style={{ width: '180px' }} />  {/* Key deliverables */}
          <col style={{ width: '180px' }} />  {/* Top risks */}
          <col style={{ width: '160px' }} />  {/* Efficiency gains */}
          <col style={{ width: '130px' }} />  {/* Automation */}
          <col style={{ width: '110px' }} />  {/* Status */}
          <col style={{ width: '36px'  }} />  {/* Delete */}
        </colgroup>
        <thead className="bg-white sticky top-0 z-10 shadow-sm">
          <tr>
            <TH>{t.dashColProject}</TH>
            <TH>{t.dashColType}</TH>
            <TH>{t.dashColPlanStart}</TH>
            <TH>{t.dashColBoard}</TH>
            <TH>{t.dashColDeliverables}</TH>
            <TH>{t.dashColRisks}</TH>
            <TH>{t.dashColEfficiency}</TH>
            <TH>{t.dashColAutomation}</TH>
            <TH center>{t.dashColStatus}</TH>
            <TH></TH>
          </tr>
        </thead>

        {isGrouped ? groups.map(({ l1, l2Entries }) => (
          <tbody key={l1?.id || '__ungrouped__'}>
            {/* L1 header */}
            <tr>
              <td
                colSpan={MATRIX_COLS}
                className={`px-4 py-2 ${l1 ? `py-2.5 ${l1HeaderBg(l1.id)}` : 'bg-transparent border-t border-dashed border-gray-200'}`}
                style={l1 ? l1HeaderStyle(l1.id) : { borderLeft: '4px solid #e5e7eb' }}
              >
                <div className="flex items-center gap-2">
                  {l1 && <TaxonomyBadge nodeId={l1.id} />}
                  <span className={l1
                    ? 'text-xs font-bold text-gray-700 uppercase tracking-widest'
                    : 'text-[10px] font-medium text-gray-400 italic'
                  }>
                    {l1 ? `${l1.id}  ${l1.name}` : t.dashNoTaxonomy}
                  </span>
                </div>
              </td>
            </tr>
            {l2Entries.map(({ l2, flows: l2flows }) => (
              <>
                {/* L2 sub-header */}
                {l2 && (
                  <tr key={`l2-${l2.id}`} className="bg-gray-50/80">
                    <td colSpan={MATRIX_COLS} className="px-6 py-1 border-l-2 border-l-gray-200">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        {l2.id}  {l2.name}
                      </span>
                    </td>
                  </tr>
                )}
                {l2flows.map((flow, i) => (
                  <MatrixRow key={flow.id} flow={flow} rowIndex={i} onOpen={onOpen} onUpdateRag={onUpdateRag} onDelete={onDelete} />
                ))}
              </>
            ))}
          </tbody>
        )) : (
          <tbody>
            {(groups[0]?.l2Entries[0]?.flows || []).map((flow, i) => (
              <MatrixRow key={flow.id} flow={flow} rowIndex={i} onOpen={onOpen} onUpdateRag={onUpdateRag} onDelete={onDelete} />
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

// ── Flow card ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-2/3" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
      <div className="h-1.5 bg-gray-100 rounded-full w-full mt-1" />
      <div className="flex gap-1.5 flex-wrap mt-1">
        {[60, 72, 56, 68, 52].map(w => (
          <div key={w} className="h-5 bg-gray-100 rounded-full" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

function ProgressBadge({ done, label }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      done
        ? 'bg-green-50 text-green-600 border border-green-200'
        : 'bg-gray-100 text-gray-400 border border-gray-200'
    }`}>
      {done ? '✓ ' : ''}{label}
    </span>
  );
}

function DeleteModal({ flow, onConfirm, onCancel }) {
  const { t } = useLang();
  const [deleteBoard, setDeleteBoard] = useState(false);
  const hasBoard = !!flow.board_id;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">{t.dashDeleteTitle}</h3>
        <p className="text-xs text-gray-500 mb-4">
          {t.dashDeleteBody.replace('{name}', flow.process_name || t.dashUntitledProcess)}
        </p>
        {hasBoard && (
          <label className="flex items-start gap-2 mb-4 cursor-pointer select-none">
            <input type="checkbox" checked={deleteBoard} onChange={e => setDeleteBoard(e.target.checked)} className="mt-0.5 accent-red-500" />
            <span className="text-xs text-gray-600">{t.dashDeleteAlsoBoard}</span>
          </label>
        )}
        <div className="flex gap-2">
          <button onClick={() => onConfirm(deleteBoard)} className="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 transition-colors">{t.dashDeleteConfirm}</button>
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">{t.dashDeleteCancel}</button>
        </div>
      </div>
    </div>
  );
}

function FlowCard({ flow, onOpen, onDelete }) {
  const { t } = useLang();
  const [hovered, setHovered] = useState(false);
  const { cats, hasAi } = getProjectTypes(flow);
  const step = lastStep(flow, t);
  const pct = progressPercent(flow);

  const ragTopStyle = flow.ragStatus === 'green' ? { borderTopColor: '#4ade80', borderTopWidth: 3 }
    : flow.ragStatus === 'amber' ? { borderTopColor: '#fbbf24', borderTopWidth: 3 }
    : flow.ragStatus === 'red'   ? { borderTopColor: '#ef4444', borderTopWidth: 3 }
    : undefined;

  return (
    <div
      onClick={() => onOpen(flow.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={ragTopStyle}
      className={`relative bg-white border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 flex flex-col gap-2 ${
        flow._demo ? 'border-blue-200 hover:border-blue-400' : 'border-gray-200 hover:border-vimpl/50'
      }`}
    >
      {flow._demo && (
        <span className="absolute top-3 left-3 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">Demo</span>
      )}
      <button
        onClick={e => { e.stopPropagation(); onDelete(flow); }}
        className={`absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-all text-xs px-1.5 py-1 rounded hover:bg-red-50 ${hovered ? 'opacity-100' : 'opacity-0'}`}
        title="Delete flow"
      >✕</button>

      <p className={`text-base font-bold text-gray-900 leading-snug pr-6 ${flow._demo ? 'pl-10' : ''}`}>
        {flow.process_name || t.dashUntitledProcess}
      </p>

      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${step.color}`}>{step.label}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{relativeTime(flow.updated_at, t)}</span>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{Math.round(pct * STEPS.length / 100)}/{STEPS.length} {t.dashStepsCount}</span>
          {pct === 100 && <span className="text-[10px] font-semibold text-emerald-600">{t.dashComplete}</span>}
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#34d399' : '#65c434' }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mt-0.5">
        <ProgressBadge done={!!flow.processDescription} label={t.dashBadgeVoiced} />
        <ProgressBadge done={!!(flow.improvements?.length)} label={t.dashBadgeIdentified} />
        <ProgressBadge done={!!flow.parsed} label={t.dashBadgeMapped} />
        <ProgressBadge done={!!flow.projectPlan} label={t.dashBadgePlanned} />
        <ProgressBadge done={!!flow.board_url} label={t.dashBadgeLaunched} />
      </div>

      {(cats.length > 0 || hasAi) && (
        <div className="flex flex-wrap gap-1">
          {cats.map(cat => (
            <span key={cat} className={`text-xs rounded px-1.5 py-0.5 ${CATEGORY_COLOURS[cat] || 'bg-gray-100 text-gray-600'}`}>{cat}</span>
          ))}
          {hasAi && (
            <span className="text-xs rounded px-1.5 py-0.5 font-semibold text-white" style={{ backgroundColor: '#65c434' }}>✦ AI</span>
          )}
        </div>
      )}

      {flow.board_url && (
        <a
          href={flow.board_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-xs text-vimpl-dark hover:text-vimpl hover:underline mt-1 font-medium"
        >
          {t.dashOpenVimpl}
        </a>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard({ flows, loading, vimplUser, onOpen, onCreate, onDelete, onUpdateRag, canCreate, onLogout, onDemo, onBurger }) {
  const { t } = useLang();
  const [deletingFlow, setDeletingFlow] = useState(null);
  const [view, setView] = useState('matrix'); // 'matrix' | 'cards'

  const sorted = [...flows].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  const isTrial = !vimplUser || (vimplUser.subscriptionTier !== 'commercial' && vimplUser.subscriptionTier !== 'enterprise');
  const realFlows     = flows.filter(f => !f._demo);
  const realFlowCount = realFlows.length;
  const mappedCount   = realFlows.filter(f => !!f.parsed).length;
  const plannedCount  = realFlows.filter(f => !!f.projectPlan).length;
  const launchedCount = realFlows.filter(f => !!f.board_url).length;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="relative flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="w-24" />
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="ailean-logo" style={{ fontSize: '15px' }}>AILEAN</span>
        </div>
        <div className="flex items-center gap-3">
          <LangSwitcher />
          {vimplUser && (
            isTrial ? (
              <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium hover:bg-amber-100 transition-colors">
                {t.dashTrialBadge}
              </a>
            ) : (
              <span className="text-xs bg-vimpl/10 text-vimpl-dark px-2 py-0.5 rounded-full font-medium capitalize border border-vimpl/20">
                {vimplUser.subscriptionTier}
              </span>
            )
          )}
          <button onClick={onBurger} className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800" title="Menu">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="4" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="2" y="8.25" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="2" y="12.5" width="14" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Trial banner */}
      {isTrial && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-sm">⚡</span>
            <p className="text-xs text-amber-800">
              <span className="font-semibold">{t.dashTrialTitle}</span>{t.dashTrialBody}
            </p>
          </div>
          <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-xs bg-amber-500 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">
            {t.dashSeePlans}
          </a>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t.dashTitle}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t.dashSubtitle}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-gray-400">{realFlowCount} {realFlowCount !== 1 ? t.dashProcesses : t.dashProcess}</span>
              {mappedCount > 0 && <span className="text-xs text-gray-300">·</span>}
              {mappedCount > 0 && <span className="text-xs text-indigo-500">{mappedCount} {t.dashMappedStat}</span>}
              {plannedCount > 0 && <span className="text-xs text-gray-300">·</span>}
              {plannedCount > 0 && <span className="text-xs text-green-600">{plannedCount} {t.dashPlannedStat}</span>}
              {launchedCount > 0 && <span className="text-xs text-gray-300">·</span>}
              {launchedCount > 0 && <span className="text-xs text-emerald-600">{launchedCount} {t.dashLaunchedStat}</span>}
              {isTrial && <span className="text-xs text-gray-300">·</span>}
              {isTrial && <span className="text-xs text-amber-500">{t.dashTrialIncluded}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            {!loading && flows.length > 0 && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button
                  onClick={() => setView('matrix')}
                  className={`px-3 py-1.5 transition-colors ${view === 'matrix' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  {t.dashViewMatrix}
                </button>
                <button
                  onClick={() => setView('cards')}
                  className={`px-3 py-1.5 transition-colors ${view === 'cards' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  {t.dashViewCards}
                </button>
              </div>
            )}
            {canCreate ? (
              <button onClick={onCreate} className="flex items-center gap-1.5 bg-green-400 text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-300 transition-colors">
                {t.dashNewFlow}
              </button>
            ) : (
              <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors">
                {t.dashUpgradeAdd}
              </a>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Empty state */}
        {!loading && flows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-3xl">🎙️</div>
            <p className="text-sm font-medium text-gray-700">{t.dashEmptyTitle}</p>
            <p className="text-xs text-gray-400">{t.dashEmptyBody}</p>
            <button onClick={onCreate} className="mt-2 bg-green-400 text-black text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-green-300 transition-colors">
              {t.dashEmptyBtn}
            </button>
          </div>
        )}

        {/* Matrix view */}
        {!loading && flows.length > 0 && view === 'matrix' && (
          <ProjectMatrix flows={flows} onOpen={onOpen} onUpdateRag={onUpdateRag} onDelete={setDeletingFlow} />
        )}

        {/* Card view */}
        {!loading && flows.length > 0 && view === 'cards' && (() => {
          const nodes = getActiveTaxonomyNodes();
          const groups = groupByTaxonomy(sorted, nodes);
          const isGrouped = groups.some(g => g.l1 !== null);

          if (!isGrouped) {
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sorted.map(flow => (
                  <FlowCard key={flow.id} flow={flow} onOpen={onOpen} onDelete={setDeletingFlow} />
                ))}
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {groups.map(({ l1, l2Entries }) => (
                <div key={l1?.id || '__ungrouped__'}>
                  {/* L1 header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <TaxonomyBadge nodeId={l1?.id} />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {l1 ? `${l1.id}  ${l1.name}` : t.dashNoTaxonomy}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  <div className="space-y-4">
                    {l2Entries.map(({ l2, flows: l2flows }) => (
                      <div key={l2?.id || '__none__'}>
                        {/* L2 sub-header */}
                        {l2 && (
                          <p className="text-[10px] font-semibold text-gray-400 mb-2 pl-1">
                            {l2.id}  {l2.name}
                          </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {l2flows.map(flow => (
                            <FlowCard key={flow.id} flow={flow} onOpen={onOpen} onDelete={setDeletingFlow} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Upgrade card */}
        {!canCreate && isTrial && (
          <div className="mt-6 bg-white border border-amber-200 rounded-xl p-5 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-gray-800">{t.dashUpgradeTitle}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.dashUpgradeBody}</p>
            </div>
            <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-sm bg-amber-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors">
              {t.dashUpgradeBtn}
            </a>
          </div>
        )}

        {/* Try Demo card — only shown before user has any real flows */}
        {realFlowCount === 0 && <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">{t.dashDemoTitle}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t.dashDemoDesc}</p>
          </div>
          <button onClick={onDemo} className="shrink-0 text-sm bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
            {t.dashDemoBtn}
          </button>
        </div>}
      </div>

      {deletingFlow && (
        <DeleteModal
          flow={deletingFlow}
          onConfirm={(deleteBoard) => { onDelete(deletingFlow.id, deleteBoard); setDeletingFlow(null); }}
          onCancel={() => setDeletingFlow(null)}
        />
      )}
    </div>
  );
}
