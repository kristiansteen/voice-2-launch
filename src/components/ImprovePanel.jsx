import { useState } from 'react';
import VimplExportModal from './VimplExportModal.jsx';

const CATEGORY_COLOURS = {
  automation: 'bg-blue-100 text-blue-700',
  governance: 'bg-purple-100 text-purple-700',
  clarity: 'bg-yellow-100 text-yellow-700',
  efficiency: 'bg-green-100 text-green-700',
  risk: 'bg-red-100 text-red-700',
};

const EFFORT_COLOURS = {
  low: 'bg-green-50 text-green-600',
  medium: 'bg-yellow-50 text-yellow-700',
  high: 'bg-red-50 text-red-600',
};

function riskLevel(p, c) {
  const score = p * c;
  if (score >= 5000) return { label: 'High', colour: 'text-red-600' };
  if (score >= 2000) return { label: 'Medium', colour: 'text-orange-500' };
  return { label: 'Low', colour: 'text-green-600' };
}

export default function ImprovePanel({
  parsed, apiKey,
  improvements, onGetImprovements,
  selectedIds, onToggleSelect,
  projectPlan, onGeneratePlan, planLoading,
}) {
  const [showExport, setShowExport] = useState(false);
  const [impError, setImpError] = useState(null);
  const [impLoading, setImpLoading] = useState(false);

  async function handleGetImprovements() {
    setImpError(null);
    setImpLoading(true);
    try {
      await onGetImprovements();
    } catch (err) {
      setImpError(err.message || 'Failed to get improvements.');
    } finally {
      setImpLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        {/* Section A — Improvements */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={handleGetImprovements}
            disabled={!parsed || !apiKey || impLoading}
            className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {impLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analysing...
              </>
            ) : (
              'Get Improvements →'
            )}
          </button>
          {impError && <p className="text-xs text-red-500 mt-2">{impError}</p>}
        </div>

        {improvements && (
          <div className="px-4 pb-2 space-y-2">
            <p className="text-xs text-gray-500">{selectedIds.length} selected</p>
            {improvements.map(imp => (
              <div
                key={imp.id}
                onClick={() => onToggleSelect(imp.id)}
                className={[
                  'border rounded-lg p-3 cursor-pointer transition-colors',
                  selectedIds.includes(imp.id)
                    ? 'border-purple-400 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    readOnly
                    checked={selectedIds.includes(imp.id)}
                    className="mt-0.5 accent-purple-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1 mb-1">
                      <span className="font-medium text-sm text-gray-800">{imp.title}</span>
                    </div>
                    <div className="flex gap-1 mb-1 flex-wrap">
                      <span className={`text-xs rounded px-1.5 py-0.5 ${CATEGORY_COLOURS[imp.category] || 'bg-gray-100 text-gray-600'}`}>
                        {imp.category}
                      </span>
                      <span className={`text-xs rounded px-1.5 py-0.5 ${EFFORT_COLOURS[imp.effort] || 'bg-gray-100 text-gray-600'}`}>
                        {imp.effort} effort
                      </span>
                      {imp.effort_score !== undefined && (
                        <span className="text-xs rounded px-1.5 py-0.5 bg-gray-100 text-gray-600">
                          Effort: {imp.effort_score}/100
                        </span>
                      )}
                      {imp.impact_score !== undefined && (
                        <span className="text-xs rounded px-1.5 py-0.5 bg-indigo-50 text-indigo-600">
                          Impact: {imp.impact_score}/100
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{imp.description}</p>
                    <p className="text-xs text-gray-400 mt-1 italic">Benefit: {imp.benefit}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section B — Project Plan */}
        {improvements && (
          <div className="px-4 pb-2 border-t border-gray-100 pt-3">
            <button
              onClick={onGeneratePlan}
              disabled={selectedIds.length === 0 || planLoading}
              className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {planLoading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating plan...
                </>
              ) : (
                'Generate Project Plan →'
              )}
            </button>

            {projectPlan && (
              <div className="mt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-700">{projectPlan.plan_name} — {projectPlan.duration_weeks} weeks</p>

                {/* Tasks grouped by track */}
                {(projectPlan.tracks || []).map(track => {
                  const tasks = (projectPlan.tasks || []).filter(t => t.track_id === track.id);
                  if (!tasks.length) return null;
                  return (
                    <div key={track.id}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{track.name}</p>
                      {tasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 py-1 ml-2">
                          <span className="text-gray-400 text-xs">■</span>
                          <span className="text-xs text-gray-700 flex-1">{task.title}</span>
                          <span className="text-xs text-gray-400">Wk {task.week_start}–{task.week_end}</span>
                          {task.owner && <span className="text-xs text-gray-400">{task.owner}</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Risks */}
                {(projectPlan.risks || []).length > 0 && (
                  <div className="border-t border-gray-100 pt-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Risks</p>
                    {projectPlan.risks.map(risk => {
                      const { label, colour } = riskLevel(risk.probability, risk.consequence);
                      return (
                        <div key={risk.id} className="py-1.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-orange-400 text-xs">⚠</span>
                            <span className="text-xs font-medium text-gray-700 flex-1">{risk.title}</span>
                            <span className="text-xs text-gray-400">P:{risk.probability} C:{risk.consequence}</span>
                            <span className={`text-xs font-semibold ${colour}`}>{label}</span>
                          </div>
                          <p className="text-xs text-gray-500 ml-5">Mitigation: {risk.mitigation}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section C — Export */}
        {projectPlan && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-100">
            <button
              onClick={() => setShowExport(true)}
              className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white transition-colors"
            >
              Export to vimpl-saas →
            </button>
          </div>
        )}
      </div>

      {showExport && projectPlan && (
        <VimplExportModal
          projectPlan={projectPlan}
          processName={parsed?.process_name || 'Process Plan'}
          selectedImprovements={(improvements || []).filter(i => selectedIds.includes(i.id))}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
