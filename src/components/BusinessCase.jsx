import { useId, useMemo, useRef, useState } from 'react';
import { useLang } from '../i18n/LangContext.jsx';
import { CURRENCIES, FTE_HOURS_PER_YEAR, formatMoney } from '../lib/businessCase.js';
import { formatMinutes } from '../lib/processMetrics.js';

// Braun palette: ink for the baseline, the one orange signal for the gain.
const INK = '#151515';
const MID = '#62625D';
const LINE = '#C6C6C0';
const SIGNAL = '#E8500A';
const SURFACE = '#FFFFFF';
const OTHER_GAIN_CATS = ['risk', 'governance', 'clarity'];
const SOURCES = ['stated', 'estimated', 'measured'];

function EstTag({ children }) {
  return <span className="ml-1.5 border border-dashed border-mid rounded-full px-1.5 text-[11px] text-mid align-middle">{children}</span>;
}

// ── Before / after bars: one quantity, two rows, own scale ────────────────────
function BeforeAfter({ title, asIs, toBe, reduction, t, note }) {
  const max = Math.max(asIs || 0, toBe || 0, 1);
  const rows = [
    { key: 'asis', label: t.bcAsIs, value: asIs, color: MID },
    { key: 'tobe', label: t.bcToBe, value: toBe, color: SIGNAL },
  ];
  return (
    <figure className="m-0">
      <figcaption className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-ink">{title}</span>
        {reduction != null && reduction > 0 && (
          <span className="text-xs font-medium text-ink tabular-nums">−{reduction} %</span>
        )}
      </figcaption>
      {asIs == null ? (
        <p className="text-xs text-mid">{note}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map(r => {
            const w = r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0;
            const label = `${r.label}: ${formatMinutes(r.value)}`;
            return (
              <div key={r.key} className="grid grid-cols-[52px_1fr] items-center gap-2" title={label}>
                <span className="text-[11px] text-mid">{r.label}</span>
                <div className="flex items-center gap-2 min-w-0" role="img" aria-label={label}>
                  <div className="h-4 rounded-r-[4px]" style={{ width: `calc((100% - 64px) * ${w / 100})`, minWidth: w ? 3 : 0, background: r.color }} />
                  <span className="text-[11px] text-ink tabular-nums whitespace-nowrap">{formatMinutes(r.value)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </figure>
  );
}

// ── Cumulative benefit after the investment, month by month ───────────────────
function CumulativeChart({ points, currency, lang, payback, t }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const uid = useId();
  const W = 520, H = 190, PAD = { l: 64, r: 16, t: 14, b: 26 };
  const vals = points.map(p => p.value);
  const yMin = Math.min(0, ...vals), yMax = Math.max(0, ...vals);
  const span = yMax - yMin || 1;
  const x = m => PAD.l + (m / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = v => PAD.t + (1 - (v - yMin) / span) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.at(-1).month)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [yMin, 0, yMax].filter((v, i, a) => a.indexOf(v) === i);
  const fmt = v => (v === 0 ? '0' : formatMoney(v, currency, lang, { compact: true }));
  const zeroY = y(0);

  function onMove(e) {
    const box = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const m = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1));
    setHover(points[Math.max(0, Math.min(points.length - 1, m))]);
  }

  const be = payback > 0 && payback <= points.length - 1 ? payback : null;
  return (
    <figure className="m-0 relative">
      <figcaption className="text-xs font-medium text-ink mb-1">{t.bcCumulative}</figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        role="img"
        aria-label={`${t.bcCumulative}: ${fmt(points[0].value)} → ${fmt(points.at(-1).value)}${be != null ? `. ${t.bcBreakEven.replace('{n}', be)}` : ''}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? INK : LINE} strokeWidth="1" />
            <text x={PAD.l - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill={MID}>{fmt(v)}</text>
          </g>
        ))}
        {[0, 6, 12, 18, 24].filter(m => m < points.length).map(m => (
          <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize="10" fill={MID}>{m === 0 ? t.bcStart : `${m} ${t.bcMonthsShort}`}</text>
        ))}
        <defs>
          <clipPath id={`${uid}-above`}><rect x="0" y="0" width={W} height={zeroY} /></clipPath>
          <clipPath id={`${uid}-below`}><rect x="0" y={zeroY} width={W} height={H - zeroY} /></clipPath>
        </defs>
        {/* Below zero is the investment still being earned back: grey wash; above is gain: orange wash */}
        <path d={area} fill={MID} opacity="0.12" clipPath={`url(#${uid}-below)`} />
        <path d={area} fill={SIGNAL} opacity="0.12" clipPath={`url(#${uid}-above)`} />
        <path d={path} fill="none" stroke={SIGNAL} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {be != null && (
          <g>
            <circle cx={x(be)} cy={y(points[be].value)} r="5" fill={SIGNAL} stroke={SURFACE} strokeWidth="2" />
            <text x={x(be) + 10} y={y(points[be].value) + 18} fontSize="11" fontWeight="600" fill={INK}>
              {t.bcBreakEven.replace('{n}', be)}
            </text>
          </g>
        )}
        <circle cx={x(points.at(-1).month)} cy={y(points.at(-1).value)} r="4" fill={SIGNAL} stroke={SURFACE} strokeWidth="2" />
        {hover && (
          <g pointerEvents="none">
            <line x1={x(hover.month)} x2={x(hover.month)} y1={PAD.t} y2={H - PAD.b} stroke={MID} strokeWidth="1" />
            <circle cx={x(hover.month)} cy={y(hover.value)} r="4.5" fill={SIGNAL} stroke={SURFACE} strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover && (
        <div
          className="absolute pointer-events-none bg-white border border-line rounded-md px-2 py-1 text-[11px] shadow-sm whitespace-nowrap"
          style={{ left: `${(x(hover.month) / W) * 100}%`, top: 18, transform: hover.month > points.length / 2 ? 'translateX(-105%)' : 'translateX(8px)' }}
        >
          <span className="text-mid">{hover.month === 0 ? t.bcStart : `${hover.month} ${t.bcMonthsShort}`} · </span>
          <span className="text-ink font-medium tabular-nums">{formatMoney(hover.value, currency, lang)}</span>
        </div>
      )}
    </figure>
  );
}

// ── Assumption field with its source ──────────────────────────────────────────
function Field({ label, value, onChange, suffix, placeholder, source, onSource, t }) {
  return (
    <label className="block">
      <span className="text-[11px] text-mid">{label}</span>
      <span className="mt-0.5 flex items-center gap-1.5">
        <input
          type="number" min="0" inputMode="decimal"
          value={value ?? ''}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className="w-full min-w-0 text-sm text-ink border border-line rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-ink tabular-nums"
        />
        {suffix && <span className="text-xs text-mid whitespace-nowrap">{suffix}</span>}
      </span>
      {onSource && (
        <span className="mt-1 flex gap-1" role="group" aria-label={t.bcSource}>
          {SOURCES.map(s => (
            <button
              key={s} type="button" onClick={() => onSource(s)} aria-pressed={source === s}
              className={`text-[10px] rounded-full px-1.5 py-0.5 border ${
                source === s
                  ? s === 'measured' ? 'bg-ink text-paper border-ink' : s === 'estimated' ? 'border-dashed border-mid text-ink' : 'border-ink text-ink'
                  : 'border-line text-mid hover:border-mid'
              }`}
            >{t[`bcSrc_${s}`]}</button>
          ))}
        </span>
      )}
    </label>
  );
}

export default function BusinessCase({ bc, inputs = {}, onChange, improvements = [], selectedIds = [] }) {
  const { t, lang } = useLang();
  const set = patch => onChange?.({ ...inputs, ...patch });
  const setSource = (k, s) => set({ sources: { ...(inputs.sources || {}), [k]: s } });
  const currency = inputs.currency || 'DKK';
  const [showInputs, setShowInputs] = useState(false);

  const otherGains = useMemo(
    () => (improvements || []).filter(i => selectedIds.includes(i.id) && OTHER_GAIN_CATS.includes(i.category)).slice(0, 4),
    [improvements, selectedIds],
  );

  if (!bc) {
    return (
      <section className="px-4 py-5 border-b border-line">
        <h3 className="text-xs font-semibold tracking-[0.14em] uppercase text-ink">{t.bcTitle}</h3>
        <p className="text-sm text-mid mt-2">{t.bcNeedTimes}</p>
      </section>
    );
  }

  const hasMoney = bc.netSavingPerYear != null;
  const inputsOpen = showInputs || !hasMoney;
  const perCaseLead = s => (s ? s.touchMin + s.waitMin : null);

  return (
    <section className="px-4 py-5 border-b border-line" aria-labelledby="bc-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="bc-title" className="text-xs font-semibold tracking-[0.14em] uppercase text-ink">
          {t.bcTitle}
          {bc.basedOnEstimates && <EstTag>{t.dashEffEst}</EstTag>}
        </h3>
        {hasMoney && (
          <button onClick={() => setShowInputs(v => !v)} aria-expanded={inputsOpen}
            className="text-xs font-medium text-ink border border-line rounded-full px-3 py-1 hover:border-ink">
            {t.bcAssumptions} {inputsOpen ? '▴' : '▾'}
          </button>
        )}
      </div>

      {/* Hero + supporting figures */}
      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] items-end">
        <div>
          <p className="text-[11px] text-mid">{t.bcPerYear}</p>
          <p className="text-[52px] leading-none font-medium tracking-[-0.035em] text-ink mt-1">
            {hasMoney ? formatMoney(bc.netSavingPerYear, currency, lang, { compact: true }) : '—'}
          </p>
          <p className="text-xs text-mid mt-2">
            {hasMoney
              ? t.bcHeroNote.replace('{min}', formatMinutes(bc.minutesSavedPerCase)).replace('{n}', Number(inputs.volumePerMonth).toLocaleString(lang === 'da' ? 'da-DK' : 'en-GB'))
              : t.bcMissing}
          </p>
        </div>
        <dl className="grid grid-cols-3 border-t border-ink">
          {[
            [bc.paybackMonths != null ? `${bc.paybackMonths}` : '—', t.bcPayback],
            [bc.hoursSavedPerYear != null ? bc.hoursSavedPerYear.toLocaleString(lang === 'da' ? 'da-DK' : 'en-GB') : '—', t.bcHours.replace('{fte}', bc.fteFreed != null ? bc.fteFreed.toLocaleString(lang === 'da' ? 'da-DK' : 'en-GB') : '—')],
            [bc.threeYearNet != null ? formatMoney(bc.threeYearNet, currency, lang, { compact: true }) : '—', t.bcThreeYear],
          ].map(([n, label], i) => (
            <div key={i} className={`pt-3 ${i ? 'pl-4 border-l border-line' : 'pr-4'}`}>
              <dd className="text-2xl font-medium tracking-[-0.03em] leading-none">{n}</dd>
              <dt className="text-xs text-mid mt-1">{label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {/* Visuals */}
      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="space-y-5 bg-white border border-line rounded-[10px] p-4">
          <BeforeAfter title={t.bcTouchPerCase} asIs={bc.perCase.asIs.touchMin} toBe={bc.perCase.toBe.touchMin} reduction={bc.touchReduction} t={t} />
          <BeforeAfter
            title={t.bcLeadPerCase}
            asIs={bc.leadReduction != null ? perCaseLead(bc.perCase.asIs) : null}
            toBe={bc.leadReduction != null ? perCaseLead(bc.perCase.toBe) : null}
            reduction={bc.leadReduction} t={t} note={t.bcLeadMissing}
          />
          <div className="flex gap-4 text-[11px] text-mid pt-1" aria-hidden="true">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: MID }} />{t.bcAsIs}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SIGNAL }} />{t.bcToBe}</span>
          </div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          {bc.cumulative.length ? (
            <CumulativeChart points={bc.cumulative} currency={currency} lang={lang} payback={bc.paybackMonths} t={t} />
          ) : (
            <div className="h-full min-h-[160px] grid place-items-center text-center">
              <p className="text-xs text-mid max-w-[260px]">{t.bcCurveNeedsInputs}</p>
            </div>
          )}
        </div>
      </div>

      {/* Other gains */}
      {otherGains.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] text-mid mb-1.5">{t.bcOtherGains}</p>
          <ul className="flex flex-wrap gap-1.5">
            {otherGains.map(g => (
              <li key={g.id} className="text-xs text-ink border border-line rounded-full px-3 py-1 bg-white">{g.title}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Assumptions */}
      {inputsOpen && (
        <div className="mt-5 bg-panel border border-line rounded-[10px] p-4">
          <p className="text-xs font-medium text-ink mb-3">{t.bcAssumptions}</p>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Field t={t} label={t.bcVolume} value={inputs.volumePerMonth} placeholder="400" suffix={t.bcPerMonth}
              onChange={v => set({ volumePerMonth: v })} source={inputs.sources?.volumePerMonth || 'stated'} onSource={s => setSource('volumePerMonth', s)} />
            <Field t={t} label={t.bcRate} value={inputs.hourlyRate} placeholder="450" suffix={`${currency}/${t.bcHourShort}`}
              onChange={v => set({ hourlyRate: v })} source={inputs.sources?.hourlyRate || 'stated'} onSource={s => setSource('hourlyRate', s)} />
            <Field t={t} label={t.bcOneOff} value={inputs.oneOffCost} placeholder="250000" suffix={currency}
              onChange={v => set({ oneOffCost: v })} source={inputs.sources?.oneOffCost || 'stated'} onSource={s => setSource('oneOffCost', s)} />
            <Field t={t} label={t.bcRunCost} value={inputs.runCostPerYear} placeholder="0" suffix={`${currency}/${t.bcYearShort}`}
              onChange={v => set({ runCostPerYear: v })} />
            <label className="block">
              <span className="text-[11px] text-mid">{t.bcCurrency}</span>
              <select value={currency} onChange={e => set({ currency: e.target.value })}
                className="mt-0.5 w-full text-sm text-ink border border-line rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-ink">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <label className="block">
              <span className="text-[11px] text-mid">{t.bcProblem}</span>
              <textarea rows={2} value={inputs.problem || ''} onChange={e => set({ problem: e.target.value })} placeholder={t.bcProblemPh}
                className="mt-0.5 w-full text-sm text-ink border border-line rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-ink resize-y" />
            </label>
            <label className="block">
              <span className="text-[11px] text-mid">{t.bcTarget}</span>
              <textarea rows={2} value={inputs.target || ''} onChange={e => set({ target: e.target.value })} placeholder={t.bcTargetPh}
                className="mt-0.5 w-full text-sm text-ink border border-line rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-ink resize-y" />
            </label>
          </div>
          <p className="text-[11px] text-mid mt-3">{t.bcMethod.replace('{fte}', FTE_HOURS_PER_YEAR.toLocaleString(lang === 'da' ? 'da-DK' : 'en-GB'))}</p>
        </div>
      )}
    </section>
  );
}
