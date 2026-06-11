import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

const CATEGORIES = ['automation', 'governance', 'clarity', 'efficiency', 'risk'];
const EFFORTS    = ['low', 'medium', 'high'];

const CAT_LABEL_KEYS = {
  automation: 'catAutomation',
  governance: 'catGovernance',
  clarity:    'catClarity',
  efficiency: 'catEfficiency',
  risk:       'catRisk',
};

const CATEGORY_COLOURS = {
  automation: 'bg-blue-100 text-blue-700',
  governance: 'bg-purple-100 text-purple-700',
  clarity:    'bg-yellow-100 text-yellow-700',
  efficiency: 'bg-green-100 text-green-700',
  risk:       'bg-red-100 text-red-700',
};

const EFFORT_COLOURS = {
  low:    'bg-green-50 text-green-600',
  medium: 'bg-yellow-50 text-yellow-700',
  high:   'bg-red-50 text-red-600',
};

const BLANK_IDEA = { title: '', description: '', category: 'efficiency', effort: 'medium', ai_candidate: false };

// ── Inline idea edit form ────────────────────────────────────────────────────
function IdeaForm({ initial = BLANK_IDEA, onSave, onCancel, saveLabel }) {
  const { t } = useLang();
  const [v, setV] = useState(initial);
  return (
    <div className="border border-green-200 rounded-lg p-3 bg-green-50/40 space-y-2">
      <input
        autoFocus
        value={v.title}
        onChange={e => setV(p => ({ ...p, title: e.target.value }))}
        onKeyDown={e => e.key === 'Enter' && v.title.trim() && onSave(v)}
        placeholder={t.ideaTitlePh}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-green-400 bg-white"
      />
      <textarea
        value={v.description}
        onChange={e => setV(p => ({ ...p, description: e.target.value }))}
        placeholder={t.ideaDescPh}
        rows={2}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-green-400 bg-white resize-none"
      />
      <div className="flex gap-2">
        <select value={v.category} onChange={e => setV(p => ({ ...p, category: e.target.value }))}
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-green-400">
          {CATEGORIES.map(c => <option key={c} value={c}>{t[CAT_LABEL_KEYS[c]] || c}</option>)}
        </select>
        <select value={v.effort} onChange={e => setV(p => ({ ...p, effort: e.target.value }))}
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-green-400">
          {EFFORTS.map(e => <option key={e} value={e}>{t[e] || e} {t.effort}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!!v.ai_candidate}
          onChange={e => setV(p => ({ ...p, ai_candidate: e.target.checked }))}
          className="accent-green-500"
        />
        <span className="text-xs text-gray-600">{t.markAsAiCandidate}</span>
        {v.ai_candidate && (
          <span className="text-xs rounded px-1.5 py-0.5 font-semibold text-white" style={{backgroundColor: '#65c434'}}>✦ AI</span>
        )}
      </label>
      <div className="flex gap-2 pt-1">
        <button onClick={() => v.title.trim() && onSave(v)} disabled={!v.title.trim()}
          className="flex-1 text-xs bg-green-500 text-white rounded px-3 py-1.5 hover:bg-green-600 disabled:opacity-40 transition-colors">
          {saveLabel}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 px-2">
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ImprovePanel({
  parsed, apiKey,
  improvements, onGetImprovements, onAddImprovement, onUpdateImprovement, onDeleteImprovement,
  selectedIds, onToggleSelect,
  toBeXml, toBeLoading, onGenerateToBe,
  toBeApproved, onApproveToBe, onReviewDiagram,
  projectPlan, onGeneratePlan, planLoading,
}) {
  const { t } = useLang();
  const [impError, setImpError]   = useState(null);
  const [impLoading, setImpLoading] = useState(false);
  const [showAddIdea, setShowAddIdea] = useState(false);
  const [editingImpId, setEditingImpId] = useState(null);
  const [toBeGenerated, setToBeGenerated] = useState(false);
  const [planGenerated, setPlanGenerated] = useState(false);

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

  const hasImprovements = improvements && improvements.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        {/* ── Improvements list ─────────────────────────────────────── */}
        {hasImprovements && (
          <div className="px-4 pb-2 space-y-2">
            <p className="text-xs text-gray-500">{selectedIds.length} {t.selected}</p>
            {improvements.map(imp => (
              <div key={imp.id}>
                {editingImpId === imp.id ? (
                  <IdeaForm
                    initial={{ title: imp.title, description: imp.description || '', category: imp.category || 'efficiency', effort: imp.effort || 'medium', ai_candidate: !!imp.ai_candidate }}
                    onSave={v => { onUpdateImprovement({ ...imp, ...v }); setEditingImpId(null); }}
                    onCancel={() => setEditingImpId(null)}
                    saveLabel={t.saveChanges}
                  />
                ) : (
                  <div
                    onClick={() => onToggleSelect(imp.id)}
                    className={[
                      'border rounded-lg p-3 cursor-pointer transition-colors group',
                      selectedIds.includes(imp.id)
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-2">
                      <input type="checkbox" readOnly checked={selectedIds.includes(imp.id)} className="mt-0.5 accent-purple-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="font-medium text-sm text-gray-800">{imp.title}</span>
                          {imp._custom && (
                            <span className="text-xs rounded px-1.5 py-0.5 bg-amber-100 text-amber-700">{t.yourIdea}</span>
                          )}
                        </div>
                        <div className="flex gap-1 mb-1 flex-wrap">
                          <span className={`text-xs rounded px-1.5 py-0.5 ${CATEGORY_COLOURS[imp.category] || 'bg-gray-100 text-gray-600'}`}>
                            {t[CAT_LABEL_KEYS[imp.category]] || imp.category}
                          </span>
                          <span className={`text-xs rounded px-1.5 py-0.5 ${EFFORT_COLOURS[imp.effort] || 'bg-gray-100 text-gray-600'}`}>
                            {t[imp.effort] || imp.effort} {t.effort}
                          </span>
                          {imp.effort_score !== undefined && (
                            <span className="text-xs rounded px-1.5 py-0.5 bg-gray-100 text-gray-600">
                              {t.effortLabel} {imp.effort_score}/100
                            </span>
                          )}
                          {imp.impact_score !== undefined && (
                            <span className="text-xs rounded px-1.5 py-0.5 bg-indigo-50 text-indigo-600">
                              {t.impactLabel} {imp.impact_score}/100
                            </span>
                          )}
                          {imp.ai_candidate && (
                            <span className="text-xs rounded px-1.5 py-0.5 font-semibold text-white" style={{backgroundColor: '#65c434'}} title="AI development candidate">
                              ✦ AI
                            </span>
                          )}
                        </div>
                        {imp.description && <p className="text-xs text-gray-600">{imp.description}</p>}
                        {imp.benefit && <p className="text-xs text-gray-400 mt-1 italic">{t.benefit} {imp.benefit}</p>}
                      </div>
                      {/* Edit button */}
                      <button
                        onClick={e => { e.stopPropagation(); setEditingImpId(imp.id); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 text-xs px-1 transition-opacity shrink-0"
                        title={t.editIdea}
                      >
                        ✎
                      </button>
                      {/* Delete button — custom ideas only */}
                      {imp._custom && (
                        <button
                          onClick={e => { e.stopPropagation(); onDeleteImprovement(imp.id); }}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-xs px-1 transition-opacity shrink-0"
                          title={t.deleteIdea}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Add your own idea ────────────────────────────────────── */}
        <div className="px-4 pb-3">
          {showAddIdea ? (
            <IdeaForm
              onSave={v => {
                onAddImprovement({ id: `custom_${Date.now()}`, ...v, benefit: '', _custom: true });
                setShowAddIdea(false);
              }}
              onCancel={() => setShowAddIdea(false)}
              saveLabel={t.addIdeaBtn}
            />
          ) : (
            <button
              onClick={() => setShowAddIdea(true)}
              className="w-full border border-dashed border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600 text-xs py-1.5 rounded-md transition-colors"
            >
              {t.addOwnIdea}
            </button>
          )}
        </div>

{/* ── Three-stage actions ──────────────────────────────────── */}
        {hasImprovements && (() => {
          const step1Done = !!toBeXml;
          const step2Done = toBeApproved;
          const step3Done = !!projectPlan;

          return (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">

              {/* Step 1 — Generate TO-BE */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${step1Done ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                    {step1Done ? '✓' : '1'}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{t.generateToBe}</span>
                </div>
                <button
                  onClick={() => { onGenerateToBe(); setToBeGenerated(true); }}
                  disabled={selectedIds.length === 0 || toBeLoading}
                  className={[
                    'w-full text-sm font-medium py-2 rounded-md transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed',
                    !step1Done
                      ? 'bg-vimpl text-black hover:bg-vimpl-dark hover:text-white disabled:opacity-40'
                      : 'border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40',
                  ].join(' ')}
                >
                  {toBeLoading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      {t.generating}
                    </>
                  ) : (step1Done ? t.regenerateToBeBtn : t.generateToBeBtn)}
                </button>
              </div>

              {/* Step 2 — Review & approve TO-BE */}
              {step1Done && (
                <div className={step2Done ? 'opacity-60' : ''}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${step2Done ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'}`}>
                      {step2Done ? '✓' : '2'}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{t.reviewApproveToBe}</span>
                  </div>
                  {!step2Done && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                      <p className="text-xs text-amber-800 mb-2">{t.reviewToBeInfo}</p>
                      <button
                        onClick={onReviewDiagram}
                        className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
                      >
                        {t.openDiagramTab}
                      </button>
                    </div>
                  )}
                  <button
                    onClick={onApproveToBe}
                    disabled={step2Done}
                    className={[
                      'w-full text-sm font-medium py-2 rounded-md transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed',
                      !step2Done
                        ? 'bg-amber-400 text-white hover:bg-amber-500'
                        : 'border border-gray-200 text-gray-400 bg-gray-50',
                    ].join(' ')}
                  >
                    {step2Done ? t.approveToBeDone : t.approveToBeBtn}
                  </button>
                </div>
              )}

              {/* Step 3 — Project plan */}
              <div className={step2Done ? '' : 'opacity-40 pointer-events-none'}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${step3Done ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                    {step3Done ? '✓' : '3'}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{t.draftPlan}</span>
                </div>
                <button
                  onClick={() => { onGeneratePlan(); setPlanGenerated(true); }}
                  disabled={!step2Done || planLoading}
                  className={[
                    'w-full text-sm font-medium py-2 rounded-md transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed',
                    step2Done && !step3Done
                      ? 'bg-vimpl text-black hover:bg-vimpl-dark hover:text-white disabled:opacity-40'
                      : 'border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40',
                  ].join(' ')}
                >
                  {planLoading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      {t.generating}
                    </>
                  ) : (step3Done ? t.regeneratePlanBtn : t.draftPlanBtn)}
                </button>
              </div>

            </div>
          );
        })()}
      </div>
    </div>
  );
}
