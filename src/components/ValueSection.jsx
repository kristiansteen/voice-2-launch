import { useLang } from '../i18n/LangContext.jsx';
import { VALUE_CLASSES, WASTE_TYPES } from '../lib/valueAnalysis.js';

// Value for the customer (B06): class, Ailean's suggestion with its reason, type of waste.
export default function ValueSection({ metric, onSetValue }) {
  const { t } = useLang();
  const cls = metric?.value_class || null;
  const fromAi = cls && metric?.value_source !== 'user';
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide uppercase text-mid mb-1.5">{t.valTitle}</p>
      <div role="group" aria-label={t.valTitle} className="flex border border-ink rounded-full overflow-hidden">
        {VALUE_CLASSES.map(c => (
          <button
            key={c}
            type="button"
            aria-pressed={cls === c}
            onClick={() => onSetValue({ value_class: c })}
            className={`flex-1 text-[13px] font-medium py-2 px-2 ${cls === c ? 'bg-ink text-paper' : 'bg-transparent text-ink hover:bg-paper'}`}
          >
            {t[`valClass_${c}`]}
          </button>
        ))}
      </div>

      {metric?.value_reason && (
        <div className={`mt-3 rounded-lg px-3 py-2.5 text-[13px] ${fromAi ? 'bg-white border border-dashed border-mid' : 'bg-paper'}`}>
          {fromAi && <p className="font-semibold">{t.valSuggested}</p>}
          <p className={fromAi ? 'mt-1' : ''}>{metric.value_reason}</p>
          {fromAi && (
            <button type="button" onClick={() => onSetValue({ value_class: cls })}
              className="mt-2 text-[13px] font-medium rounded-full px-3 py-1 bg-ink text-paper hover:bg-ink-hover">
              {t.valAccept}
            </button>
          )}
        </div>
      )}

      {cls === 'waste' && (
        <>
          <p className="mt-4 mb-1.5 text-[11px] font-semibold tracking-wide uppercase text-mid">{t.valWasteType}</p>
          <div role="group" aria-label={t.valWasteType} className="flex flex-wrap gap-1.5">
            {WASTE_TYPES.filter(w => w !== 'waiting').map(w => (
              <button
                key={w}
                type="button"
                aria-pressed={metric?.waste_type === w}
                onClick={() => onSetValue({ value_class: 'waste', waste_type: w })}
                className={`text-[13px] rounded-full px-2.5 py-1 border ${metric?.waste_type === w ? 'bg-ink text-paper border-ink' : 'border-line text-ink hover:border-ink'}`}
              >
                {t[`valWaste_${w}`]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-mid">{t.valWaitingNote}</p>
        </>
      )}
    </div>
  );
}
