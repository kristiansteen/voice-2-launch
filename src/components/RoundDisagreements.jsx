import { useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';

/**
 * Where the selected AS-IS round submissions disagree, shown at the top of the Review pane.
 * Each option lists who said it; each version links to its source (a passage copied from
 * that person's transcript, or their own step text) and to the full transcript.
 */
export default function RoundDisagreements({ snapshot, onResolve }) {
  const { t } = useLang();
  const [showResolved, setShowResolved] = useState(false);
  const [transcriptOf, setTranscriptOf] = useState(null);
  if (!snapshot) return null;

  const names = Object.fromEntries(snapshot.versions.map(v => [v.id, v.name]));
  const list = snapshot.disagreements || [];
  const resolutions = snapshot.resolutions || {};
  const open = list.filter(d => !resolutions[d.id]);
  const resolved = list.filter(d => resolutions[d.id]);
  const versionTranscript = snapshot.versions.find(v => v.id === transcriptOf);

  return (
    <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-3 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-amber-900">
          {t.roundDisTitle.replace('{n}', snapshot.versions.length)}
        </p>
        <p className="text-[11px] text-amber-700">
          {list.length === 0 ? t.roundDisNone
            : open.length ? t.roundDisOpen.replace('{open}', open.length).replace('{total}', list.length)
            : t.roundDisAllResolved}
        </p>
      </div>
      <p className="text-[11px] text-amber-800">{snapshot.versions.map(v => v.name).join(' · ')}</p>

      {open.map(d => (
        <Item key={d.id} d={d} names={names} t={t} onResolve={onResolve} onTranscript={setTranscriptOf} />
      ))}

      {resolved.length > 0 && (
        <div>
          <button onClick={() => setShowResolved(v => !v)} className="text-[11px] font-medium text-amber-800 hover:underline">
            {showResolved ? '▾' : '▸'} {t.roundDisResolved.replace('{n}', resolved.length)}
          </button>
          {showResolved && resolved.map(d => (
            <p key={d.id} className="text-[11px] text-gray-600 mt-1">
              {title(d, t)} → <b>{optionLabel(d, d.options.find(o => o.key === resolutions[d.id].option), t)}</b>
            </p>
          ))}
        </div>
      )}

      {versionTranscript && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setTranscriptOf(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">{t.roundDisTranscriptOf.replace('{name}', versionTranscript.name)}</p>
              <button onClick={() => setTranscriptOf(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap text-xs text-gray-700 p-4">{versionTranscript.transcript || '—'}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function title(d, t) {
  if (d.type === 'missing') return t.roundDisMissing.replace('{step}', d.stepName);
  if (d.type === 'performer') return t.roundDisPerformer.replace('{step}', d.stepName);
  return t.roundDisOrder.replace('{a}', d.otherStepName).replace('{b}', d.stepName);
}

function optionLabel(d, o, t) {
  if (!o) return '';
  if (d.type === 'missing') return o.key === 'include' ? t.roundDisInclude : t.roundDisExclude;
  if (d.type === 'performer') return o.label || t.roundDisNobody;
  return o.key === 'ab'
    ? t.roundDisBefore.replace('{a}', d.otherStepName).replace('{b}', d.stepName)
    : t.roundDisBefore.replace('{a}', d.stepName).replace('{b}', d.otherStepName);
}

function Item({ d, names, t, onResolve, onTranscript }) {
  const [showSources, setShowSources] = useState(false);
  return (
    <div className="bg-white border border-amber-100 rounded-lg p-2.5">
      <p className="text-xs font-semibold text-gray-800">⚠ {title(d, t)}</p>
      <div className="mt-2 space-y-1.5">
        {d.options.map(o => (
          <div key={o.key} className="flex items-start gap-2">
            <button
              onClick={() => onResolve(d.id, o.key)}
              className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded border ${o.key === d.chosen ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-gray-200 text-gray-700 hover:border-violet-300'}`}
              title={t.roundDisUseThis}
            >
              {optionLabel(d, o, t)}
            </button>
            <span className="text-[11px] text-gray-500 pt-0.5">
              {o.versionIds.length ? o.versionIds.map(id => names[id]).join(', ') : '—'}
              {o.key === d.chosen && <span className="text-violet-600"> · {t.roundDisInDraft}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3">
        <button onClick={() => onResolve(d.id, d.chosen)} className="text-[11px] text-gray-500 hover:text-gray-800">{t.roundDisKeep}</button>
        <button onClick={() => setShowSources(v => !v)} className="text-[11px] text-violet-700 hover:underline">
          {showSources ? t.roundDisHideSources : t.roundDisShowSources}
        </button>
      </div>
      {showSources && (
        <div className="mt-2 space-y-2">
          {Object.entries(d.sources || {}).map(([id, s]) => (
            <div key={id} className="text-[11px] border-l-2 border-gray-200 pl-2">
              <p className="font-medium text-gray-700">{names[id]}</p>
              {s.passage
                ? <p className="text-gray-600 italic">“{s.passage}”</p>
                : <p className="text-gray-500"><span className="text-gray-400">{t.roundDisOwnStep}</span> {s.stepText}</p>}
              <button onClick={() => onTranscript(id)} className="text-violet-700 hover:underline">{t.roundDisOpenTranscript}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
