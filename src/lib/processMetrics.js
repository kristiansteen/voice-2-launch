// Pure process-metric logic: provenance of each number, expected time per case
// weighted by gateway branch rates, waiting time, lead time and flow efficiency.
// No React, no SDK imports — safe to unit test in isolation.
//
// Metrics shape (all *_source and wait_* fields are optional, older saved flows
// have neither):
// {
//   activities: [{ id, duration_value, duration_unit, duration_source,
//                  wait_value, wait_unit, wait_source, backlog, backlog_source }],
//   gateways:   [{ id, branches: [{ condition, rate, source }] }]
// }
//
// Sources:
//   stated    — a person said it (in the interview, or typed it in)
//   estimated — AI estimate or industry norm; the default when nothing is recorded
//   measured  — taken from real data; only a user can set this

export const SOURCES = ['stated', 'estimated', 'measured'];
export const DURATION_UNITS = ['min', 'hr', 'day', 'week'];

// Working time: 8-hour day, 5-day week
const UNIT_MINUTES = { min: 1, hr: 60, day: 480, week: 2400 };

export function toMinutes(value, unit) {
  return (Number(value) || 0) * (UNIT_MINUTES[unit] || 1);
}

export function formatMinutes(min) {
  if (min == null || !Number.isFinite(min)) return '—';
  const trim = n => String(Math.round(n * 10) / 10);
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 480) return `${trim(min / 60)} hr`;
  const days = trim(min / 480);
  return `${days} ${days === '1' ? 'day' : 'days'}`;
}

// ── Provenance ───────────────────────────────────────────────────────────────

function cleanSource(source, { fromAi, forceSource }) {
  if (forceSource) return forceSource;
  if (!SOURCES.includes(source)) return 'estimated';
  if (fromAi && source === 'measured') return 'estimated';
  return source;
}

const hasValue = v => v !== undefined && v !== null && v !== '';

/**
 * Make sure every recorded value carries a valid source.
 * @param opts.fromAi      the metrics came straight from the model: it may say
 *                         "stated" or "estimated" but never "measured"
 * @param opts.forceSource set every source to this value (TO-BE projections)
 */
export function normaliseMetrics(raw, opts = {}) {
  if (!raw) return null;
  const activities = (raw.activities || []).map(a => {
    const out = { ...a };
    if (hasValue(a.duration_value)) out.duration_source = cleanSource(a.duration_source, opts);
    if (hasValue(a.wait_value)) out.wait_source = cleanSource(a.wait_source, opts);
    else { delete out.wait_value; delete out.wait_unit; delete out.wait_source; }
    if (hasValue(a.backlog)) out.backlog_source = cleanSource(a.backlog_source, opts);
    return out;
  });
  const gateways = (raw.gateways || []).map(g => ({
    ...g,
    branches: (g.branches || []).map(b => ({ ...b, source: cleanSource(b.source, opts) })),
  }));
  return { ...raw, activities, gateways };
}

// ── Gateway branches ─────────────────────────────────────────────────────────

const sameText = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/**
 * Every outgoing flow of a gateway with its rate (%) and source. Flows without a
 * recorded rate share whatever is left of 100% equally and count as estimated.
 */
export function gatewayBranches(parsed, metrics, gatewayId) {
  const flows = (parsed?.sequence_flows || []).filter(f => f.from === gatewayId);
  const recorded = metrics?.gateways?.find(g => g.id === gatewayId)?.branches || [];
  const rows = flows.map(f => {
    const hit = recorded.find(b => sameText(b.condition, f.condition) && hasValue(b.rate));
    return {
      flowId: f.id,
      to: f.to,
      condition: f.condition || '',
      rate: hit ? Number(hit.rate) || 0 : null,
      source: hit ? (SOURCES.includes(hit.source) ? hit.source : 'estimated') : 'estimated',
    };
  });
  const missing = rows.filter(r => r.rate === null);
  if (missing.length) {
    const used = rows.reduce((s, r) => s + (r.rate || 0), 0);
    const share = Math.max(0, 100 - used) / missing.length;
    missing.forEach(r => { r.rate = Math.round(share * 10) / 10; });
  }
  return rows;
}

// ── Expected visits per element ──────────────────────────────────────────────

function nodeIds(parsed) {
  return [...(parsed?.events || []), ...(parsed?.activities || []), ...(parsed?.gateways || [])].map(e => e.id);
}

/**
 * How many times a single case passes through each element on average.
 * Exclusive/inclusive splits follow the branch rates, parallel splits send the
 * case down every branch, and rework loops are counted (a 20% loop → 1.25 visits).
 * Returns null when the flow cannot be solved (e.g. a loop with no way out).
 */
export function expectedVisits(parsed, metrics) {
  const ids = nodeIds(parsed);
  const n = ids.length;
  if (!n) return null;
  const idx = Object.fromEntries(ids.map((id, i) => [id, i]));
  const flows = (parsed.sequence_flows || []).filter(f => idx[f.from] !== undefined && idx[f.to] !== undefined);
  const gatewayType = Object.fromEntries((parsed.gateways || []).map(g => [g.id, g.type]));

  // P[i][j] = probability (or multiplicity, for parallel splits) of going i → j
  const P = Array.from({ length: n }, () => new Float64Array(n));
  for (const id of ids) {
    const out = flows.filter(f => f.from === id);
    if (!out.length) continue;
    if (out.length === 1 || gatewayType[id] === 'parallel') {
      out.forEach(f => { P[idx[id]][idx[f.to]] += 1; });
      continue;
    }
    const rows = gatewayBranches(parsed, metrics, id);
    const sum = rows.reduce((s, r) => s + r.rate, 0);
    rows.forEach(r => { P[idx[id]][idx[r.to]] += sum > 0 ? r.rate / sum : 1 / rows.length; });
  }

  // Cases enter at the start event(s); without one, at elements nothing leads into
  let starts = (parsed.events || []).filter(e => e.type === 'start').map(e => e.id);
  if (!starts.length) starts = ids.filter(id => !flows.some(f => f.to === id));
  if (!starts.length) return null;

  // Solve (I − Pᵀ) v = s
  const A = Array.from({ length: n }, (_, i) => {
    const row = new Float64Array(n + 1);
    for (let j = 0; j < n; j++) row[j] = (i === j ? 1 : 0) - P[j][i];
    row[n] = starts.includes(ids[i]) ? 1 / starts.length : 0;
    return row;
  });
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c];
      if (!k) continue;
      for (let j = c; j <= n; j++) A[r][j] -= k * A[c][j];
    }
  }
  const visits = {};
  for (let i = 0; i < n; i++) {
    const v = A[i][n] / A[i][i];
    if (!Number.isFinite(v) || v < -1e-6 || v > 1e4) return null;
    visits[ids[i]] = Math.max(0, v);
  }
  return visits;
}

// ── Time per case ────────────────────────────────────────────────────────────

/**
 * Expected time for one case through the process.
 *   touchMin       — hands-on work
 *   waitMin        — waiting before steps (of the steps where it is known)
 *   leadMin        — touch + wait; null until every step on the path has a waiting time
 *   flowEfficiency — touch / lead (0–1); null when leadMin is null
 *   weighted       — false when the flow could not be solved and a plain sum was used
 *   sources/total  — how many of the inputs are stated, estimated, measured
 *
 * Parallel branches are added together, so lead time is on the high side for
 * processes with long parallel sections.
 */
export function processTimes(parsed, metrics) {
  if (!metrics?.activities?.length) return null;
  const visits = parsed ? expectedVisits(parsed, metrics) : null;
  const weighted = !!visits;
  const known = new Set((parsed?.activities || []).map(a => a.id));

  let touchMin = 0, waitMin = 0, waitComplete = true;
  const sources = { stated: 0, estimated: 0, measured: 0 };
  const count = s => { sources[SOURCES.includes(s) ? s : 'estimated']++; };

  for (const a of metrics.activities) {
    if (parsed && !known.has(a.id)) continue;
    const v = weighted ? visits[a.id] ?? 0 : 1;
    if (hasValue(a.duration_value)) {
      touchMin += v * toMinutes(a.duration_value, a.duration_unit);
      count(a.duration_source);
    }
    if (hasValue(a.wait_value)) {
      waitMin += v * toMinutes(a.wait_value, a.wait_unit);
      count(a.wait_source);
    } else if (v > 0) {
      waitComplete = false;
    }
  }
  // Steps in the diagram with no metrics entry at all also leave waiting time unknown
  if (parsed) {
    const have = new Set(metrics.activities.map(a => a.id));
    if ((parsed.activities || []).some(a => !have.has(a.id) && (!weighted || visits[a.id] > 0))) waitComplete = false;
  }

  for (const g of parsed?.gateways || []) {
    if (g.type === 'parallel') continue;
    const rows = gatewayBranches(parsed, metrics, g.id);
    if (rows.length > 1) rows.forEach(r => count(r.source));
  }

  const leadMin = waitComplete ? touchMin + waitMin : null;
  return {
    touchMin,
    waitMin,
    waitComplete,
    leadMin,
    flowEfficiency: leadMin ? touchMin / leadMin : null,
    weighted,
    sources,
    total: sources.stated + sources.estimated + sources.measured,
  };
}

/**
 * AS-IS vs TO-BE. Reductions are whole percentages; leadReduction is null unless
 * waiting time is known for both. basedOnEstimates is true when any input on
 * either side is an estimate.
 */
export function compareTimes(asIsParsed, asIsMetrics, toBeParsed, toBeMetrics) {
  const a = processTimes(asIsParsed, asIsMetrics);
  const b = processTimes(toBeParsed, toBeMetrics);
  if (!a || !b) return null;
  const pct = (from, to) => (from > 0 ? Math.round((1 - to / from) * 100) : null);
  return {
    asIs: a,
    toBe: b,
    touchReduction: pct(a.touchMin, b.touchMin),
    leadReduction: a.leadMin != null && b.leadMin != null ? pct(a.leadMin, b.leadMin) : null,
    basedOnEstimates: a.sources.estimated + b.sources.estimated > 0,
  };
}

// ── Edits ────────────────────────────────────────────────────────────────────

const FIELD_SOURCE = {
  duration_value: 'duration_source',
  duration_unit: 'duration_source',
  wait_value: 'wait_source',
  wait_unit: 'wait_source',
  backlog: 'backlog_source',
};

// A value somebody typed in is no longer an AI estimate. It becomes "stated"
// unless it was already "measured" or the same edit sets the source explicitly.
function withEditSources(current, patch) {
  const out = { ...current, ...patch };
  for (const [field, sourceKey] of Object.entries(FIELD_SOURCE)) {
    if (!(field in patch) || sourceKey in patch) continue;
    if (!current[sourceKey] || current[sourceKey] === 'estimated') out[sourceKey] = 'stated';
  }
  return out;
}

/** Apply a user's edit to one step's metrics, creating the entry if needed. */
export function updateActivityMetric(metrics, id, patch) {
  const base = metrics || {};
  const activities = base.activities || [];
  const exists = activities.some(a => a.id === id);
  return {
    ...base,
    activities: exists
      ? activities.map(a => (a.id === id ? withEditSources(a, patch) : a))
      : [...activities, withEditSources({ id }, patch)],
  };
}

/** Apply a user's edit to one gateway branch (matched by its condition text). */
export function updateGatewayBranch(metrics, parsed, gatewayId, condition, patch) {
  const base = metrics || {};
  const branches = gatewayBranches(parsed, base, gatewayId).map(r => {
    const row = { condition: r.condition, rate: r.rate, source: r.source };
    if (!sameText(r.condition, condition)) return row;
    const next = { ...row, ...patch };
    if ('rate' in patch && !('source' in patch) && row.source === 'estimated') next.source = 'stated';
    return next;
  });
  const gateways = base.gateways || [];
  const exists = gateways.some(g => g.id === gatewayId);
  return {
    ...base,
    gateways: exists
      ? gateways.map(g => (g.id === gatewayId ? { ...g, branches } : g))
      : [...gateways, { id: gatewayId, branches }],
  };
}
