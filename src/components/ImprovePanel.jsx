import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

const CATEGORIES = ['automation', 'governance', 'clarity', 'efficiency', 'risk'];
const EFFORTS    = ['low', 'medium', 'high'];

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

const BLANK_IDEA = { title: '', description: '', category: 'efficiency', effort: 'medium' };

export default function ImprovePanel({
  parsed, apiKey,
  improvements, onGetImprovements, onAddImprovement,
  selectedIds, onToggleSelect,
  projectPlan, onGeneratePlan, planLoading,
}) {
  const { t } = useLang();
  const [impError, setImpError]   = useState(null);
  const [impLoading, setImpLoading] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [idea, setIdea]           = useState(BLANK_IDEA);

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

  function handleAddIdea() {
    if (!idea.title.trim()) return;
    onAddImprovement({
      id:          `custom_${Date.now()}`,
      title:       idea.title.trim(),
      description: idea.description.trim(),
      category:    idea.category,
      effort:      idea.effort,
      benefit:     '',
      _custom:     true,
    });
    setIdea(BLANK_IDEA);
    setShowForm(false);
  }

  const hasImprovements = improvements && improvements.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        {/* ── Get improvements (AI) ────────────────────────────────── */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={handleGetImprovements}
            disabled={!parsed || !apiKey || impLoading}
            className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {impLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t.analysing}
              </>
            ) : (
              t.getImprovements
            )}
          </button>
          {impError && <p className="text-xs text-red-500 mt-2">{impError}</p>}
        </div>

        {/* ── Add your own idea ────────────────────────────────────── */}
        <div className="px-4 pb-3">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full border border-dashed border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600 text-xs py-1.5 rounded-md transition-colors"
            >
              {t.addOwnIdea}
            </button>
          ) : (
            <div className="border border-green-200 rounded-lg p-3 bg-green-50/40 space-y-2">
              <p className="text-xs font-medium text-gray-600">{t.addOwnIdea}</p>

              <input
                autoFocus
                value={idea.title}
                onChange={e => setIdea(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddIdea()}
                placeholder={t.ideaTitlePh}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-green-400 bg-white"
              />

              <textarea
                value={idea.description}
                onChange={e => setIdea(p => ({ ...p, description: e.target.value }))}
                placeholder={t.ideaDescPh}
                rows={2}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-green-400 bg-white resize-none"
              />

              <div className="flex gap-2">
                <select
                  value={idea.category}
                  onChange={e => setIdea(p => ({ ...p, category: e.target.value }))}
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-green-400 bg-white"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={idea.effort}
                  onChange={e => setIdea(p => ({ ...p, effort: e.target.value }))}
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-green-400 bg-white"
                >
                  {EFFORTS.map(e => (
                    <option key={e} value={e}>{e} {t.effort}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAddIdea}
                  disabled={!idea.title.trim()}
                  className="flex-1 text-xs bg-green-500 text-white rounded px-3 py-1.5 hover:bg-green-600 disabled:opacity-40 transition-colors"
                >
                  {t.addIdeaBtn}
                </button>
                <button
                  onClick={() => { setShowForm(false); setIdea(BLANK_IDEA); }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Improvements list ─────────────────────────────────────── */}
        {hasImprovements && (
          <div className="px-4 pb-2 space-y-2">
            <p className="text-xs text-gray-500">{selectedIds.length} {t.selected}</p>
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
                        {imp.category}
                      </span>
                      <span className={`text-xs rounded px-1.5 py-0.5 ${EFFORT_COLOURS[imp.effort] || 'bg-gray-100 text-gray-600'}`}>
                        {imp.effort} {t.effort}
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
                    </div>
                    {imp.description && (
                      <p className="text-xs text-gray-600">{imp.description}</p>
                    )}
                    {imp.benefit && (
                      <p className="text-xs text-gray-400 mt-1 italic">{t.benefit} {imp.benefit}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Generate plan ────────────────────────────────────────── */}
        {hasImprovements && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <button
              onClick={onGeneratePlan}
              disabled={selectedIds.length === 0 || planLoading}
              className="w-full bg-vimpl text-black text-sm font-medium py-2 rounded-md hover:bg-vimpl-dark hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {planLoading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t.generatingPlan}
                </>
              ) : (
                t.generatePlan
              )}
            </button>

            {projectPlan && (
              <p className="text-xs text-green-600 text-center mt-2">
                {t.planReady}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
