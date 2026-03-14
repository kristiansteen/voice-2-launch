import { useState } from 'react';
import VimplExportModal from './VimplExportModal.jsx';
import { useLang } from '../i18n/LangContext.jsx';

function riskLevel(p, c, t) {
  const score = p * c;
  if (score >= 5000) return { label: t.high, colour: 'text-red-600' };
  if (score >= 2000) return { label: t.medium, colour: 'text-orange-500' };
  return { label: t.low, colour: 'text-green-600' };
}

export default function LaunchPanel({ projectPlan, parsed, processDescription, improvements, selectedIds }) {
  const { t } = useLang();
  const [showExport, setShowExport] = useState(false);

  if (!projectPlan) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center px-6 gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">🚀</div>
        <p className="text-sm font-medium text-gray-500">{t.launchEmpty}</p>
        <p className="text-xs text-gray-400">{t.launchEmptyDesc}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        {/* ── Plan summary ─────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">{projectPlan.plan_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {projectPlan.duration_weeks} {t.weeks}
          </p>
        </div>

        {/* ── Tracks & tasks ───────────────────────────────────────── */}
        {(projectPlan.tracks || []).map(track => {
          const tasks = (projectPlan.tasks || []).filter(t2 => t2.track_id === track.id);
          if (!tasks.length) return null;
          return (
            <div key={track.id} className="px-4 pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{track.name}</p>
              {tasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-300 text-xs shrink-0">■</span>
                  <span className="text-xs text-gray-700 flex-1 min-w-0">{task.title}</span>
                  <span className="text-xs text-gray-400 shrink-0">{t.week} {task.week_start}–{task.week_end}</span>
                  {task.owner && (
                    <span className="text-xs text-gray-400 shrink-0 max-w-[80px] truncate">{task.owner}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {/* ── Risks ────────────────────────────────────────────────── */}
        {(projectPlan.risks || []).length > 0 && (
          <div className="px-4 pt-3 pb-2 mt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.risks}</p>
            {projectPlan.risks.map(risk => {
              const { label, colour } = riskLevel(risk.probability, risk.consequence, t);
              return (
                <div key={risk.id} className="py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 text-xs shrink-0">⚠</span>
                    <span className="text-xs font-medium text-gray-700 flex-1">{risk.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">P:{risk.probability} C:{risk.consequence}</span>
                    <span className={`text-xs font-semibold shrink-0 ${colour}`}>{label}</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-5 mt-0.5">{t.mitigation} {risk.mitigation}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Export CTA ───────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-t border-gray-100 shrink-0">
        <button
          onClick={() => setShowExport(true)}
          className="w-full bg-vimpl text-black text-sm font-semibold py-2.5 rounded-lg hover:bg-vimpl-dark hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          🚀 {t.exportToVimpl}
        </button>
      </div>

      {showExport && (
        <VimplExportModal
          projectPlan={projectPlan}
          processName={parsed?.process_name || 'Process Plan'}
          selectedImprovements={(improvements || []).filter(i => selectedIds.includes(i.id))}
          processDescription={processDescription}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
