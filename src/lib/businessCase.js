// Business case: one structure per flow, reused by the Plan screen and every export.
// Money = cases per month × 12 × minutes of touch time saved per case × hourly cost,
// less running cost. Times come from the AS-IS and TO-BE metrics (compareTimes);
// the rest are the user's assumptions, each with a source like the times have.

import { compareTimes } from './processMetrics.js';

export const FTE_HOURS_PER_YEAR = 1600; // productive hours of one full-time employee
export const CURVE_MONTHS = 24;
export const CURRENCIES = ['DKK', 'EUR', 'USD', 'SEK', 'NOK', 'GBP'];
export const REQUIRED_INPUTS = ['volumePerMonth', 'hourlyRate'];

const num = v => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

export function missingInputs(inputs = {}) {
  return REQUIRED_INPUTS.filter(k => !(num(inputs[k]) > 0));
}

export function computeBusinessCase({ asIsParsed, asIsMetrics, toBeParsed, toBeMetrics, inputs = {} }) {
  const cmp = compareTimes(asIsParsed, asIsMetrics, toBeParsed, toBeMetrics);
  if (!cmp) return null;

  const minutesSavedPerCase = Math.max(0, Math.round((cmp.asIs.touchMin - cmp.toBe.touchMin) * 10) / 10);
  const missing = missingInputs(inputs);
  const volume = num(inputs.volumePerMonth);
  const rate = num(inputs.hourlyRate);
  const oneOff = Math.max(0, num(inputs.oneOffCost) || 0);
  const runCost = Math.max(0, num(inputs.runCostPerYear) || 0);

  const hoursSavedPerYear = volume > 0 ? Math.round((minutesSavedPerCase * volume * 12) / 60) : null;
  const grossSavingPerYear = hoursSavedPerYear != null && rate > 0 ? Math.round(hoursSavedPerYear * rate) : null;
  const netSavingPerYear = grossSavingPerYear != null ? grossSavingPerYear - runCost : null;
  const fteFreed = hoursSavedPerYear != null ? Math.round((hoursSavedPerYear / FTE_HOURS_PER_YEAR) * 10) / 10 : null;
  const monthly = netSavingPerYear != null ? netSavingPerYear / 12 : null;
  const paybackMonths = monthly > 0 ? (oneOff > 0 ? Math.ceil(oneOff / monthly) : 0) : null;
  const threeYearNet = netSavingPerYear != null ? 3 * netSavingPerYear - oneOff : null;
  const cumulative = monthly != null
    ? Array.from({ length: CURVE_MONTHS + 1 }, (_, m) => ({ month: m, value: Math.round(-oneOff + m * monthly) }))
    : [];

  const inputEstimated = Object.values(inputs.sources || {}).includes('estimated');
  return {
    currency: CURRENCIES.includes(inputs.currency) ? inputs.currency : 'DKK',
    perCase: {
      asIs: { touchMin: cmp.asIs.touchMin, waitMin: cmp.asIs.waitMin },
      toBe: { touchMin: cmp.toBe.touchMin, waitMin: cmp.toBe.waitMin },
    },
    touchReduction: cmp.touchReduction,
    leadReduction: cmp.leadReduction,
    minutesSavedPerCase,
    hoursSavedPerYear,
    grossSavingPerYear,
    netSavingPerYear,
    fteFreed,
    oneOffCost: oneOff,
    runCostPerYear: runCost,
    paybackMonths,
    threeYearNet,
    cumulative,
    missing,
    basedOnEstimates: cmp.basedOnEstimates || inputEstimated,
  };
}

export function formatMoney(value, currency = 'DKK', lang = 'en', { compact = false } = {}) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (!CURRENCIES.includes(currency)) currency = 'DKK';
  const locale = lang === 'da' ? 'da-DK' : 'en-GB';
  // Compact: two significant digits for large sums (DKK 820K, DKK 4.4M), whole units below 10 000
  const big = compact && Math.abs(value) >= 10000;
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency,
    ...(big ? { notation: 'compact', maximumSignificantDigits: 2 } : { maximumFractionDigits: 0 }),
  }).format(value);
}

/** One line for exports (SOP, Quick Suite playbook). */
export function businessCaseSummary(bc, lang = 'en') {
  if (!bc || bc.netSavingPerYear == null) return null;
  const da = lang === 'da';
  const money = formatMoney(bc.netSavingPerYear, bc.currency, lang);
  const parts = [
    da ? `${money} pr. år` : `${money} per year`,
    da ? `${bc.hoursSavedPerYear.toLocaleString('da-DK')} timer frigjort (${String(bc.fteFreed).replace('.', ',')} årsværk)` : `${bc.hoursSavedPerYear.toLocaleString('en-GB')} hours freed (${bc.fteFreed} FTE)`,
  ];
  if (bc.paybackMonths != null) parts.push(da ? `tilbagebetaling ${bc.paybackMonths} mdr.` : `payback ${bc.paybackMonths} months`);
  if (bc.basedOnEstimates) parts.push(da ? 'bygger på estimater' : 'based on estimates');
  return parts.join(' · ');
}
