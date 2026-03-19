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
      className="relative bg-white border border-gray-200 hover:border-vimpl/50 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md flex flex-col gap-2"
    >
      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(flow); }}
        className={`absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-all text-xs px-1.5 py-1 rounded hover:bg-red-50 ${hovered ? 'opacity-100' : 'opacity-0'}`}
        title="Delete flow"
      >
        ✕
      </button>

      {/* Process name */}
      <p className="text-sm font-semibold text-gray-800 pr-6 leading-snug">
        {flow.process_name || 'Untitled process'}
      </p>

      {/* Date */}
      <p className="text-xs text-gray-400">{formatDate(flow.updated_at)}</p>

      {/* Progress badges */}
      <div className="flex flex-wrap gap-1">
        <ProgressBadge done={!!flow.processDescription} label="Description" />
        <ProgressBadge done={!!flow.parsed} label="BPMN" />
        <ProgressBadge done={!!flow.projectPlan} label="Plan" />
        <ProgressBadge done={!!flow.board_url} label="Exported" />
      </div>

      {/* Board link */}
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

export default function Dashboard({ flows, vimplUser, onOpen, onCreate, onDelete, canCreate, onLogout }) {
  const { t } = useLang();
  const [deletingFlow, setDeletingFlow] = useState(null);

  const sorted = [...flows].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-2 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="vimpl-wordmark">vimpl</span>
          <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Voice to Launch</span>
          <a
            href="https://www.ailean.dk"
            target="_blank"
            rel="noopener noreferrer"
            className="ailean-badge"
          >
            <span>Powered by</span>
            <span className="ailean-logo">AILEAN</span>
          </a>
        </div>
        {vimplUser && (
          <div className="flex items-center gap-3">
            {vimplUser.subscriptionTier !== 'student' && (
              <span className="text-xs bg-vimpl/10 text-vimpl-dark px-2 py-0.5 rounded-full font-medium capitalize border border-vimpl/20">
                {vimplUser.subscriptionTier}
              </span>
            )}
            <span className="text-xs text-gray-500">{vimplUser.email}</span>
            <button
              onClick={onLogout}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Page title + new flow button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">My Processes</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {flows.length} flow{flows.length !== 1 ? 's' : ''}
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
              className="flex items-center gap-1.5 border border-green-500/50 text-green-400 text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-500/10 transition-colors"
            >
              Upgrade to add more ↗
            </a>
          )}
        </div>

        {/* Empty state */}
        {flows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
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

        {/* Upgrade notice when limit reached */}
        {!canCreate && flows.length > 0 && (
          <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold text-gray-700">Your free flow has been used</p>
              <p className="text-xs text-gray-400 mt-0.5">Subscribe to create unlimited process flows</p>
            </div>
            <a
              href={PRICING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs bg-green-400 text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-green-300 transition-colors"
            >
              See plans
            </a>
          </div>
        )}
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
