export default function ComparisonPanel({ result, onClose }) {
  if (!result) return null;

  const score = result.compliance_score ?? 0;
  const scoreColor =
    score >= 80 ? 'text-green-700' :
    score >= 55 ? 'text-amber-700' :
    'text-red-700';
  const barColor =
    score >= 80 ? 'bg-green-500' :
    score >= 55 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 z-50 h-screen flex flex-col bg-white shadow-2xl border-l border-gray-200 overflow-hidden"
        style={{ width: '36vw', minWidth: 320, maxWidth: 600 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">AS-IS vs Blueprint</h2>
            <p className="text-xs text-gray-400 mt-0.5">Gap &amp; variation analysis</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1 shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Score */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Compliance score</span>
              <span className={`text-2xl font-bold ${scoreColor}`}>{score}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
            </div>
            {result.summary && (
              <p className="text-sm text-gray-600 leading-relaxed mt-3">{result.summary}</p>
            )}
          </div>

          {/* Gaps */}
          {result.gaps?.length > 0 && (
            <Section label="Gaps" count={result.gaps.length} color="red"
              description="Steps in the blueprint that are missing from AS-IS">
              <ul className="space-y-3">
                {result.gaps.map((g, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex items-center justify-center">✕</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{g.blueprint_step}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Variations */}
          {result.variations?.length > 0 && (
            <Section label="Variations" count={result.variations.length} color="amber"
              description="Steps present in both but handled differently">
              <ul className="space-y-3">
                {result.variations.map((v, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold flex items-center justify-center">≠</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        <span className="text-gray-400">{v.blueprint_step}</span>
                        <span className="mx-1 text-gray-300">→</span>
                        <span>{v.asis_step}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{v.difference}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Extra steps */}
          {result.extra_steps?.length > 0 && (
            <Section label="Extra steps" count={result.extra_steps.length} color="blue"
              description="In AS-IS but not in the blueprint">
              <ul className="space-y-3">
                {result.extra_steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center">+</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.step}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.assessment}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Recommendations */}
          {result.recommendations?.length > 0 && (
            <Section label="Recommendations" color="indigo">
              <ul className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-indigo-400 shrink-0 mt-0.5">→</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ label, count, color, description, children }) {
  const badge = {
    red:    'bg-red-50 text-red-600 border-red-100',
    amber:  'bg-amber-50 text-amber-600 border-amber-100',
    blue:   'bg-blue-50 text-blue-600 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  }[color] || 'bg-gray-50 text-gray-600 border-gray-100';

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        {count != null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badge}`}>{count}</span>
        )}
      </div>
      {description && <p className="text-xs text-gray-400 mb-3">{description}</p>}
      {children}
    </div>
  );
}
