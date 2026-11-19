// Value view (B06): each step is value-adding (va), necessary non-value-adding
// (nnva) or waste, stored on the step's metrics entry next to its times:
//   value_class, waste_type (only for waste), value_reason, value_source ('ai' | 'user')
// Waiting before a step always counts as waste (type 'waiting').

import { expectedVisits, toMinutes } from './processMetrics.js';

export const VALUE_CLASSES = ['va', 'nnva', 'waste'];
// The eight Lean wastes
export const WASTE_TYPES = ['waiting', 'overprocessing', 'defects', 'motion', 'transport', 'inventory', 'overproduction', 'skills'];

const has = v => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));

export function valueMapFor(metrics) {
  const out = {};
  for (const a of metrics?.activities || []) if (VALUE_CLASSES.includes(a.value_class)) out[a.id] = a.value_class;
  return out;
}

/**
 * Shares and waste per case. Times are weighted by how often a case passes each
 * step (as for touch and lead time elsewhere). Null when no step has a class.
 */
export function valueSummary(parsed, metrics) {
  const acts = metrics?.activities || [];
  const known = parsed ? new Set((parsed.activities || []).map(a => a.id)) : null;
  const list = acts.filter(a => !known || known.has(a.id));
  if (!list.some(a => VALUE_CLASSES.includes(a.value_class))) return null;
  const visits = parsed ? expectedVisits(parsed, metrics) : null;
  const v = id => (visits ? visits[id] ?? 0 : 1);

  let touch = 0, vaTouch = 0, wait = 0, waitComplete = true, estimates = false;
  const types = {};
  const addType = (type, minutes) => {
    types[type] = types[type] || { type, steps: 0, minutes: 0 };
    types[type].steps++;
    types[type].minutes += minutes;
  };
  for (const a of list) {
    const k = v(a.id);
    const t = has(a.duration_value) ? k * toMinutes(Number(a.duration_value), a.duration_unit) : 0;
    touch += t;
    if (a.value_class === 'va') vaTouch += t;
    if (a.value_class === 'waste') addType(WASTE_TYPES.includes(a.waste_type) ? a.waste_type : 'untyped', t);
    if (has(a.wait_value)) {
      const w = k * toMinutes(Number(a.wait_value), a.wait_unit);
      wait += w;
      if (w > 0) addType('waiting', w);
    } else if (k > 0) waitComplete = false;
    if (a.duration_source === 'estimated' || (has(a.wait_value) && a.wait_source === 'estimated')) estimates = true;
  }
  if (parsed && (parsed.activities || []).some(p => !acts.some(a => a.id === p.id))) waitComplete = false;

  const round = x => Math.round(x * 1000) / 1000;
  return {
    steps: list.length,
    classified: list.filter(a => VALUE_CLASSES.includes(a.value_class)).length,
    unconfirmed: list.filter(a => VALUE_CLASSES.includes(a.value_class) && a.value_source !== 'user').length,
    wasteSteps: list.filter(a => a.value_class === 'waste').length,
    vaTouchShare: touch > 0 ? round(vaTouch / touch) : null,
    vaLeadShare: waitComplete && touch + wait > 0 ? round(vaTouch / (touch + wait)) : null,
    waitMin: Math.round(wait),
    byType: Object.values(types)
      .map(r => ({ ...r, minutes: Math.round(r.minutes) }))
      .sort((a, b) => b.minutes - a.minutes),
    basedOnEstimates: estimates,
  };
}

function cleanClass(patch) {
  const out = { ...patch };
  if (out.value_class !== 'waste') delete out.waste_type;
  else if (!WASTE_TYPES.includes(out.waste_type)) delete out.waste_type;
  return out;
}

/** AI suggestions for steps the user has not classified; the user's own choices stand. */
export function applySuggestions(metrics, suggestions = [], knownIds = null) {
  const base = metrics || {};
  let activities = [...(base.activities || [])];
  const known = knownIds ? new Set(knownIds) : null;
  for (const s of suggestions || []) {
    if (!s?.id || !VALUE_CLASSES.includes(s.class)) continue;
    if (known && !known.has(s.id)) continue;
    const i = activities.findIndex(a => a.id === s.id);
    if (i >= 0 && activities[i].value_source === 'user') continue;
    const prev = i >= 0 ? activities[i] : { id: s.id };
    const { waste_type: _w, ...rest } = prev;
    const next = cleanClass({ ...rest, value_class: s.class, waste_type: s.waste_type, value_reason: s.reason || '', value_source: 'ai' });
    if (i >= 0) activities[i] = next; else activities = [...activities, next];
  }
  return { ...base, activities };
}

/** The user's own class for a step (also used to accept Ailean's suggestion). */
export function setValueClass(metrics, id, patch) {
  const base = metrics || {};
  const activities = base.activities || [];
  const apply = a => {
    const { waste_type: _w, ...rest } = a;
    // Overriding Ailean's class drops its reason, which would now contradict the choice
    if (patch.value_class && patch.value_class !== a.value_class && a.value_source !== 'user') delete rest.value_reason;
    return cleanClass({ ...rest, waste_type: patch.waste_type ?? (patch.value_class === 'waste' ? a.waste_type : undefined), ...patch, value_source: 'user' });
  };
  return {
    ...base,
    activities: activities.some(a => a.id === id)
      ? activities.map(a => (a.id === id ? apply(a) : a))
      : [...activities, apply({ id })],
  };
}


const VALUE_FIELDS = ['value_class', 'waste_type', 'value_reason', 'value_source'];

/** Fresh metrics from Ailean replace times; the classes already on the steps are kept. */
export function carryValueFields(prev, next) {
  if (!next || !prev?.activities?.length) return next;
  const old = Object.fromEntries(prev.activities.map(a => [a.id, a]));
  return {
    ...next,
    activities: (next.activities || []).map(a => {
      const o = old[a.id];
      if (!o?.value_class) return a;
      const keep = {};
      for (const f of VALUE_FIELDS) if (o[f] !== undefined) keep[f] = o[f];
      return { ...a, ...keep };
    }),
  };
}

/** Times-only copy, for prompts that must not see or echo the value fields. */
export function withoutValueFields(metrics) {
  if (!metrics?.activities) return metrics;
  return { ...metrics, activities: metrics.activities.map(a => {
    const out = { ...a };
    for (const f of VALUE_FIELDS) delete out[f];
    return out;
  }) };
}
