import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

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

export default function ImprovePanel({
  parsed, apiKey,
  improvements, onGetImprovements,
  selectedIds, onToggleSelect,
  projectPlan, onGeneratePlan, planLoading,
}) {
  const { t } = useLang();
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

        {/* ── Get improvements ─────────────────────────────────────── */}
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

        {/* ── Improvements list ─────────────────────────────────────── */}
        {improvements && (
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
                    <div className="flex flex-wrap gap-1 mb-1">
                      <span className="font-medium text-sm text-gray-800">{imp.title}</span>
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
                    <p className="text-xs text-gray-600">{imp.description}</p>
                    <p className="text-xs text-gray-400 mt-1 italic">{t.benefit} {imp.benefit}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Generate plan ────────────────────────────────────────── */}
        {improvements && (
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
