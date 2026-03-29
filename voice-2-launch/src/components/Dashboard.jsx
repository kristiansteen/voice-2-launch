import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

const PRICING_URL = 'https://frontend-puce-ten-18.vercel.app/pricing';

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
            <input
              type="checkbox"
              checked={deleteBoard}
              onChange={e => setDeleteBoard(e.target.checked)}
              className="mt-0.5 accent-red-500"
            />
            <span className="text-xs text-gray-600">
              Also delete the corresponding vimpl board
            </span>
          </label>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(deleteBoard)}
            className="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function FlowCard({ flow, onOpen, onDelete }) {
  const [hovered, setHovered] = useState(false);

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <div
      onClick={() => onOpen(flow.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md flex flex-col gap-2 ${
        flow._demo
          ? 'border-blue-200 hover:border-blue-400'
          : 'border-gray-200 hover:border-vimpl/50'
      }`}
    >
      {flow._demo && (
        <span className="absolute top-3 left-3 text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">
          Demo
        </span>
      )}
      <button
        onClick={e => { e.stopPropagation(); onDelete(flow); }}
        className={`absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-all text-xs px-1.5 py-1 rounded hover:bg-red-50 ${hovered ? 'opacity-100' : 'opacity-0'}`}
        title="Delete flow"
      >
        ✕
      </button>

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

      {flow.improvements?.length > 0 && (() => {
        const CATEGORY_COLOURS = {
          automation: 'bg-blue-100 text-blue-700',
          governance: 'bg-purple-100 text-purple-700',
          clarity:    'bg-yellow-100 text-yellow-700',
          efficiency: 'bg-green-100 text-green-700',
          risk:       'bg-red-100 text-red-700',
        };
        const tags = [...new Set(flow.improvements.map(i => i.category).filter(Boolean))];
        const hasAi = flow.improvements.some(i => i.ai_candidate);
        return tags.length > 0 || hasAi ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.map(tag => (
              <span key={tag} className={`text-xs rounded px-1.5 py-0.5 ${CATEGORY_COLOURS[tag] || 'bg-gray-100 text-gray-600'}`}>
                {tag}
              </span>
            ))}
            {hasAi && (
              <span className="text-xs rounded px-1.5 py-0.5 font-semibold text-white" style={{ backgroundColor: '#65c434' }}>
                ✦ AI
              </span>
            )}
          </div>
        ) : null;
      })()}

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

export default function Dashboard({ flows, vimplUser, onOpen, onCreate, onDelete, canCreate, onLogout, onDemo, onBurger }) {
  const { t } = useLang();
  const [deletingFlow, setDeletingFlow] = useState(null);

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
          <a
            href="https://www.vimpl.com"
            target="_blank"
            rel="noopener noreferrer"
            className="ailean-badge"
          >
            <span>Powered by</span>
            <span className="vimpl-wordmark" style={{ fontSize: '22px', lineHeight: 1 }}>vimpl</span>
          </a>
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-400 tracking-wide uppercase">Voice to Launch</span>
        <div className="flex items-center gap-3">
          {vimplUser && (
            <>
              {isTrial ? (
                <a
                  href={PRICING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium hover:bg-amber-100 transition-colors"
                >
                  Trial — Upgrade ↗
                </a>
              ) : (
                <span className="text-xs bg-vimpl/10 text-vimpl-dark px-2 py-0.5 rounded-full font-medium capitalize border border-vimpl/20">
                  {vimplUser.subscriptionTier}
                </span>
              )}
</>
          )}
          <button
            onClick={onBurger}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
            title="Menu"
          >
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
              <span className="font-semibold">Free trial</span> — 1 process flow included.
              Upgrade for unlimited flows and vimpl boards.
            </p>
          </div>
          <a
            href={PRICING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs bg-amber-500 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors"
          >
            See plans ↗
          </a>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Page title + new flow button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">My Processes</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {realFlowCount} flow{realFlowCount !== 1 ? 's' : ''}
              {isTrial && ' · 1 included in trial'}
            </p>
          </div>
          {canCreate ? (
            <button
              onClick={onCreate}
              className="flex items-center gap-1.5 bg-green-400 text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-300 transition-colors"
            >
              + New flow
            </button>
          ) : (
            <a
              href={PRICING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
            >
              Upgrade to add more ↗
            </a>
          )}
        </div>

        {/* Empty state */}
        {flows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-3xl">🎙️</div>
            <p className="text-sm font-medium text-gray-700">No flows yet</p>
            <p className="text-xs text-gray-400">Record your first process interview to get started</p>
            <button
              onClick={onCreate}
              className="mt-2 bg-green-400 text-black text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-green-300 transition-colors"
            >
              Start your first flow
            </button>
          </div>
        )}

        {/* Flow cards */}
        {flows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map(flow => (
              <FlowCard
                key={flow.id}
                flow={flow}
                onOpen={onOpen}
                onDelete={setDeletingFlow}
              />
            ))}
          </div>
        )}

        {/* Upgrade card — shown when trial limit hit */}
        {!canCreate && isTrial && (
          <div className="mt-6 bg-white border border-amber-200 rounded-xl p-5 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-gray-800">Ready to do more?</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Your free flow is active. Upgrade to create unlimited process flows and vimpl boards.
              </p>
            </div>
            <a
              href={PRICING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sm bg-amber-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
            >
              Upgrade now ↗
            </a>
          </div>
        )}

        {/* Try Demo card — always visible */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">See it in action</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Walk through a full AP invoice process — from voice interview to vimpl board — with pre-built demo data. No API quota used.
            </p>
          </div>
          <button
            onClick={onDemo}
            className="shrink-0 text-sm bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Try demo ↗
          </button>
        </div>
      </div>

      {/* Delete modal */}
      {deletingFlow && (
        <DeleteModal
          flow={deletingFlow}
          onConfirm={(deleteBoard) => {
            onDelete(deletingFlow.id, deleteBoard);
            setDeletingFlow(null);
          }}
          onCancel={() => setDeletingFlow(null)}
        />
      )}
    </div>
  );
}
