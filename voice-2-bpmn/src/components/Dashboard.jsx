import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

const PRICING_URL = 'https://frontend-puce-ten-18.vercel.app/pricing';

const CATEGORY_COLOURS = {
  automation: 'bg-blue-100 text-blue-700',
  governance: 'bg-purple-100 text-purple-700',
  clarity:    'bg-yellow-100 text-yellow-700',
  efficiency: 'bg-green-100 text-green-700',
  risk:       'bg-red-100 text-red-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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
  const cats = [...new Set((flow.improvements || []).map(i => i.category).filter(Boolean))];
  const hasAi = (flow.improvements || []).some(i => i.ai_candidate);
  return { cats, hasAi };
}

function getKeyDeliverables(flow) {
  const selected = (flow.improvements || []).filter(i =>
    (flow.selectedImprovementIds || []).includes(i.id)
  );
  return selected.length ? selected : (flow.improvements || []).slice(0, 3);
}

// ── RAG indicator ─────────────────────────────────────────────────────────────

const RAG_OPTIONS = [
  { value: 'green', label: 'On track',   bg: 'bg-green-500', ring: 'ring-green-400' },
  { value: 'amber', label: 'At risk',    bg: 'bg-amber-400', ring: 'ring-amber-300' },
  { value: 'red',   label: 'Off track',  bg: 'bg-red-500',   ring: 'ring-red-400' },
];

function RagPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = RAG_OPTIONS.find(o => o.value === value) || { bg: 'bg-gray-300', label: 'Set status' };

  return (
    <div className="relative flex justify-center">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title={current.label}
        className={`w-5 h-5 rounded-full ${current.bg} ring-2 ring-offset-1 ${value ? current.ring : 'ring-gray-200'} transition-all hover:scale-110`}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-7 left-1/2 -translate-x-1/2 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-2 flex flex-col gap-1.5 min-w-[110px]">
            {RAG_OPTIONS.map(opt => (
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
                <span className="text-xs text-gray-400">Clear</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Matrix row ────────────────────────────────────────────────────────────────

function MatrixRow({ flow, onOpen, onUpdateRag }) {
  const { cats, hasAi } = getProjectTypes(flow);
  const deliverables = getKeyDeliverables(flow);
  const finishWeek = getPlannedFinishWeek(flow.projectPlan);
  const dueThisWeek = getDueThisWeek(flow.projectPlan, flow.created_at);
  const overdue = getOverdue(flow.projectPlan, flow.created_at);

  return (
    <tr
      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer group transition-colors"
      onClick={() => onOpen(flow.id)}
    >
      {/* Project ID */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="font-mono text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          {shortId(flow.id)}
        </span>
        {flow._demo && (
          <span className="ml-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded-full">Demo</span>
        )}
      </td>

      {/* Project name */}
      <td className="px-3 py-2.5 max-w-[180px]">
        <p className="text-sm font-medium text-gray-800 truncate leading-snug">
          {flow.process_name || <span className="text-gray-300 italic">Untitled</span>}
        </p>
        {flow.board_url && (
          <a
            href={flow.board_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-vimpl-dark hover:underline"
          >
            Open board ↗
          </a>
        )}
      </td>

      {/* Project type */}
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {cats.map(cat => (
            <span key={cat} className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${CATEGORY_COLOURS[cat] || 'bg-gray-100 text-gray-600'}`}>
              {cat}
            </span>
          ))}
          {hasAi && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold text-white" style={{ backgroundColor: '#65c434' }}>
              ✦ AI
            </span>
          )}
          {!cats.length && !hasAi && <span className="text-xs text-gray-300">—</span>}
        </div>
      </td>

      {/* Date started */}
      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500">
        {formatDate(flow.created_at)}
      </td>

      {/* Key deliverables */}
      <td className="px-3 py-2.5 max-w-[200px]">
        {deliverables.length ? (
          <ul className="space-y-0.5">
            {deliverables.slice(0, 3).map((d, i) => (
              <li key={i} className="text-[11px] text-gray-600 truncate leading-snug">
                · {d.title || d.name || d.description}
              </li>
            ))}
            {deliverables.length > 3 && (
              <li className="text-[10px] text-gray-400">+{deliverables.length - 3} more</li>
            )}
          </ul>
        ) : <span className="text-xs text-gray-300">—</span>}
      </td>

      {/* Planned finish (week no.) */}
      <td className="px-3 py-2.5 text-center whitespace-nowrap">
        {finishWeek
          ? <span className="text-xs font-medium text-gray-700">Wk {finishWeek}</span>
          : <span className="text-xs text-gray-300">—</span>}
      </td>

      {/* Due this week */}
      <td className="px-3 py-2.5 text-center">
        {dueThisWeek > 0
          ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{dueThisWeek}</span>
          : <span className="text-xs text-gray-300">—</span>}
      </td>

      {/* Overdue */}
      <td className="px-3 py-2.5 text-center">
        {overdue > 0
          ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold">{overdue}</span>
          : <span className="text-xs text-gray-300">—</span>}
      </td>

      {/* RAG status */}
      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
        <RagPicker
          value={flow.ragStatus || null}
          onChange={status => onUpdateRag(flow.id, status)}
        />
      </td>
    </tr>
  );
}

// ── Project matrix ────────────────────────────────────────────────────────────

function ProjectMatrix({ flows, onOpen, onUpdateRag }) {
  const sorted = [...flows].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const TH = ({ children, center }) => (
    <th className={`px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap border-b border-gray-200 ${center ? 'text-center' : ''}`}>
      {children}
    </th>
  );

  return (
    <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm bg-white">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <TH>Flow ID</TH>
            <TH>Project name</TH>
            <TH>Type</TH>
            <TH>Started</TH>
            <TH>Key deliverables</TH>
            <TH center>Finish</TH>
            <TH center>Due this wk</TH>
            <TH center>Overdue</TH>
            <TH center>Status</TH>
          </tr>
        </thead>
        <tbody>
          {sorted.map(flow => (
            <MatrixRow
              key={flow.id}
              flow={flow}
              onOpen={onOpen}
              onUpdateRag={onUpdateRag}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Flow card (unchanged) ─────────────────────────────────────────────────────

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
  const [deleteBoard, setDeleteBoard] = useState(false);
  const hasBoard = !!flow.board_id;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Delete flow?</h3>
        <p className="text-xs text-gray-500 mb-4">
          <span className="font-medium text-gray-700">"{flow.process_name || 'Untitled process'}"</span> will
          be permanently removed.
        </p>
        {hasBoard && (
          <label className="flex items-start gap-2 mb-4 cursor-pointer select-none">
            <input type="checkbox" checked={deleteBoard} onChange={e => setDeleteBoard(e.target.checked)} className="mt-0.5 accent-red-500" />
            <span className="text-xs text-gray-600">Also delete the corresponding vimpl board</span>
          </label>
        )}
        <div className="flex gap-2">
          <button onClick={() => onConfirm(deleteBoard)} className="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 transition-colors">Delete</button>
          <button onClick={onCancel} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function FlowCard({ flow, onOpen, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const { cats, hasAi } = getProjectTypes(flow);

  return (
    <div
      onClick={() => onOpen(flow.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md flex flex-col gap-2 ${
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

      <p className={`text-sm font-semibold text-gray-800 leading-snug pr-6 ${flow._demo ? 'pl-10' : ''}`}>
        {flow.process_name || 'Untitled process'}
      </p>
      <p className="text-xs text-gray-400">{formatDate(flow.updated_at)}</p>

      <div className="flex flex-wrap gap-1">
        <ProgressBadge done={!!flow.processDescription} label="Voiced" />
        <ProgressBadge done={!!flow.improvements?.length} label="Identified" />
        <ProgressBadge done={!!flow.parsed} label="Mapped" />
        <ProgressBadge done={!!flow.projectPlan} label="Planned" />
        <ProgressBadge done={!!flow.board_url} label="Launched" />
      </div>

      {(cats.length > 0 || hasAi) && (
        <div className="flex flex-wrap gap-1 mt-1">
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
          Open vimpl board ↗
        </a>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard({ flows, vimplUser, onOpen, onCreate, onDelete, onUpdateRag, canCreate, onLogout, onDemo, onBurger }) {
  const { t } = useLang();
  const [deletingFlow, setDeletingFlow] = useState(null);
  const [view, setView] = useState('matrix'); // 'matrix' | 'cards'

  const sorted = [...flows].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  const isTrial = !vimplUser || (vimplUser.subscriptionTier !== 'commercial' && vimplUser.subscriptionTier !== 'enterprise');
  const realFlowCount = flows.filter(f => !f._demo).length;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="relative flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <span className="ailean-logo" style={{ fontSize: '15px' }}>AILEAN</span>
          <div className="w-px h-5 bg-gray-200" />
          <a href="https://www.vimpl.com" target="_blank" rel="noopener noreferrer" className="ailean-badge">
            <span>Powered by</span>
            <span className="vimpl-wordmark" style={{ fontSize: '22px', lineHeight: 1 }}>vimpl</span>
          </a>
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-400 tracking-wide uppercase">Voice to Launch</span>
        <div className="flex items-center gap-3">
          {vimplUser && (
            isTrial ? (
              <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium hover:bg-amber-100 transition-colors">
                Trial — Upgrade ↗
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
              <span className="font-semibold">Free trial</span> — 1 process flow included. Upgrade for unlimited flows and vimpl boards.
            </p>
          </div>
          <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-xs bg-amber-500 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">
            See plans ↗
          </a>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">My Processes</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {realFlowCount} flow{realFlowCount !== 1 ? 's' : ''}{isTrial && ' · 1 included in trial'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            {flows.length > 0 && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button
                  onClick={() => setView('matrix')}
                  className={`px-3 py-1.5 transition-colors ${view === 'matrix' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  ▤ Matrix
                </button>
                <button
                  onClick={() => setView('cards')}
                  className={`px-3 py-1.5 transition-colors ${view === 'cards' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  ⊞ Cards
                </button>
              </div>
            )}
            {canCreate ? (
              <button onClick={onCreate} className="flex items-center gap-1.5 bg-green-400 text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-300 transition-colors">
                + New flow
              </button>
            ) : (
              <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors">
                Upgrade to add more ↗
              </a>
            )}
          </div>
        </div>

        {/* Empty state */}
        {flows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-3xl">🎙️</div>
            <p className="text-sm font-medium text-gray-700">No flows yet</p>
            <p className="text-xs text-gray-400">Record your first process interview to get started</p>
            <button onClick={onCreate} className="mt-2 bg-green-400 text-black text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-green-300 transition-colors">
              Start your first flow
            </button>
          </div>
        )}

        {/* Matrix view */}
        {flows.length > 0 && view === 'matrix' && (
          <ProjectMatrix flows={flows} onOpen={onOpen} onUpdateRag={onUpdateRag} />
        )}

        {/* Card view */}
        {flows.length > 0 && view === 'cards' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map(flow => (
              <FlowCard key={flow.id} flow={flow} onOpen={onOpen} onDelete={setDeletingFlow} />
            ))}
          </div>
        )}

        {/* Upgrade card */}
        {!canCreate && isTrial && (
          <div className="mt-6 bg-white border border-amber-200 rounded-xl p-5 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-gray-800">Ready to do more?</p>
              <p className="text-xs text-gray-500 mt-0.5">Upgrade to create unlimited process flows and vimpl boards.</p>
            </div>
            <a href={PRICING_URL} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-sm bg-amber-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors">
              Upgrade now ↗
            </a>
          </div>
        )}

        {/* Try Demo card */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">See it in action</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Walk through a full AP invoice process — from voice interview to vimpl board — with pre-built demo data. No API quota used.
            </p>
          </div>
          <button onClick={onDemo} className="shrink-0 text-sm bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
            Try demo ↗
          </button>
        </div>
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
