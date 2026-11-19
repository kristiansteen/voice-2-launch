// Process charter (B04): the Define step. Kept in the same object as the business
// case inputs (flow.businessCase), so problem, target and volume are typed once.

export const CHARTER_FIELDS = ['owner', 'customer', 'problem', 'target', 'kpiName', 'kpiBaseline', 'kpiTarget', 'targetDate', 'volumePerMonth'];

const filled = v => (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' ? v.trim() !== '' : v != null);

export function charterProgress(inputs = {}) {
  return { filled: CHARTER_FIELDS.filter(f => filled((inputs || {})[f])).length, total: CHARTER_FIELDS.length };
}

/** "Days to pay: 21 → 5 by 2027-06-30", or null without a KPI name and both values. */
export function kpiLine(inputs = {}, lang = 'en') {
  const { kpiName, kpiBaseline, kpiTarget, targetDate } = inputs || {};
  if (!filled(kpiName) || !filled(kpiBaseline) || !filled(kpiTarget)) return null;
  const by = filled(targetDate) ? (lang === 'da' ? ` inden ${targetDate}` : ` by ${targetDate}`) : '';
  return `${String(kpiName).trim()}: ${kpiBaseline} → ${kpiTarget}${by}`;
}
