import { useState } from 'react';
import VimplExportModal from './VimplExportModal.jsx';
import { useLang } from '../i18n/LangContext.jsx';

function riskLevel(p, c, t) {
  const score = p * c;
  if (score >= 5000) return { label: t.high, colour: 'text-red-600' };
  if (score >= 2000) return { label: t.medium, colour: 'text-orange-500' };
  return { label: t.low, colour: 'text-green-600' };
}

const BLANK_RISK = { title: '', probability: 50, consequence: 50, mitigation: '' };

function RiskForm({ initial = BLANK_RISK, onSave, onCancel, saveLabel }) {
  const { t } = useLang();
  const [v, setV] = useState(initial);
  return (
    <div className="border border-orange-200 rounded-lg p-3 bg-orange-50/40 space-y-2">
      <input
        autoFocus
        value={v.title}
        onChange={e => setV(p => ({ ...p, title: e.target.value }))}
        onKeyDown={e => e.key === 'Enter' && v.title.trim() && onSave(v)}
        placeholder="Risk title…"
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400 bg-white"
      />
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-24 shrink-0">Probability {v.probability}%</span>
          <input type="range" min={0} max={100} value={v.probability}
            onChange={e => setV(p => ({ ...p, probability: Number(e.target.value) }))}
            className="flex-1 accent-orange-500" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-24 shrink-0">Consequence {v.consequence}%</span>
          <input type="range" min={0} max={100} value={v.consequence}
            onChange={e => setV(p => ({ ...p, consequence: Number(e.target.value) }))}
            className="flex-1 accent-red-500" />
        </div>
      </div>
      <textarea
        value={v.mitigation}
        onChange={e => setV(p => ({ ...p, mitigation: e.target.value }))}
        placeholder="Mitigation plan…"
        rows={2}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-orange-400 bg-white resize-none"
      />
      <div className="flex gap-2 pt-1">
        <button onClick={() => v.title.trim() && onSave(v)} disabled={!v.title.trim()}
          className="flex-1 text-xs bg-orange-500 text-white rounded px-3 py-1.5 hover:bg-orange-600 disabled:opacity-40 transition-colors">
          {saveLabel}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 px-2">
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

export default function LaunchPanel({ projectPlan, parsed, processDescription, improvements, selectedIds, customRisks = [], onAddRisk, onUpdateRisk, onRemoveRisk, onExported, vimplToken }) {
  const { t } = useLang();
  const [showExport, setShowExport] = useState(false);
  const [showAddRisk, setShowAddRisk] = useState(false);
  const [editingRiskId, setEditingRiskId] = useState(null);

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
        <div className="px-4 pt-3 pb-2 mt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.risks}</p>

          {/* AI-generated risks */}
          {(projectPlan.risks || []).map(risk => {
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

          {/* Custom risks */}
          {customRisks.map(risk => {
            const { label, colour } = riskLevel(risk.probability, risk.consequence, t);
            return (
              <div key={risk.id} className="py-2 border-b border-gray-50 last:border-0">
                {editingRiskId === risk.id ? (
                  <RiskForm
                    initial={{ title: risk.title, probability: risk.probability, consequence: risk.consequence, mitigation: risk.mitigation || '' }}
                    onSave={v => { onUpdateRisk?.({ ...risk, ...v }); setEditingRiskId(null); }}
                    onCancel={() => setEditingRiskId(null)}
                    saveLabel="Save"
                  />
                ) : (
                  <div className="group">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-400 text-xs shrink-0">⚠</span>
                      <span className="text-xs font-medium text-gray-700 flex-1">{risk.title}</span>
                      <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 shrink-0">custom</span>
                      <span className="text-xs text-gray-400 shrink-0">P:{risk.probability} C:{risk.consequence}</span>
                      <span className={`text-xs font-semibold shrink-0 ${colour}`}>{label}</span>
                      <button
                        onClick={() => setEditingRiskId(risk.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 text-xs px-1 transition-opacity shrink-0"
                        title="Edit"
                      >✎</button>
                      <button
                        onClick={() => onRemoveRisk?.(risk.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-600 text-xs px-1 transition-opacity shrink-0"
                        title="Remove"
                      >✕</button>
                    </div>
                    {risk.mitigation && <p className="text-xs text-gray-500 ml-5 mt-0.5">{t.mitigation} {risk.mitigation}</p>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add risk */}
          {showAddRisk ? (
            <div className="mt-2">
              <RiskForm
                onSave={v => { onAddRisk?.({ id: `custom_risk_${Date.now()}`, ...v, _custom: true }); setShowAddRisk(false); }}
                onCancel={() => setShowAddRisk(false)}
                saveLabel="Add Risk"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowAddRisk(true)}
              className="mt-2 w-full border border-dashed border-gray-300 text-gray-400 hover:border-orange-400 hover:text-orange-600 text-xs py-1.5 rounded-md transition-colors"
            >
              + Add Risk
            </button>
          )}
        </div>
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
          onExported={onExported}
          vimplToken={vimplToken}
        />
      )}
    </div>
  );
}
