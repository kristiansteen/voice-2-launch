// Portfolio roll-up for the process overview: stage per flow, business-case
// totals, grouping by the process taxonomy (level 1 → level 2), coverage.
// Demo flows never count.

import { computeBusinessCase, FTE_HOURS_PER_YEAR } from './businessCase.js';

export const STAGES = ['describe', 'review', 'map', 'improve', 'plan', 'launched'];
const STATUS_RANK = { red: 3, amber: 2, green: 1 };

const filled = v => !!v && (typeof v !== 'object' || (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0));

export function flowStage(flow = {}) {
  if (flow.board_url) return 'launched';
  if (filled(flow.projectPlan)) return 'plan';
  if (filled(flow.improvements)) return 'improve';
  if (filled(flow.parsed) || flow.xml) return 'map';
  if (filled(flow.processDescription)) return 'review';
  return 'describe';
}

export function flowBusinessCase(flow = {}) {
  return computeBusinessCase({
    asIsParsed: flow.asIsParsed || flow.parsed,
    asIsMetrics: flow.asIsMetrics,
    toBeParsed: flow.toBeParsed,
    toBeMetrics: flow.toBeMetrics,
    inputs: flow.businessCase || {},
  });
}

export function worstStatus(statuses) {
  let worst = null;
  for (const s of statuses) if (STATUS_RANK[s] > (STATUS_RANK[worst] || 0)) worst = s;
  return worst;
}

const real = flows => (flows || []).filter(f => !f._demo);

export function summarisePortfolio(flows) {
  const list = real(flows);
  const stages = Object.fromEntries(STAGES.map(s => [s, 0]));
  let net = 0, hours = 0, oneOff = 0, withMoney = 0, withHours = 0, estimates = false;
  const currencies = new Set();
  for (const f of list) {
    stages[flowStage(f)]++;
    const bc = flowBusinessCase(f);
    if (!bc) continue;
    if (bc.hoursSavedPerYear != null) { hours += bc.hoursSavedPerYear; withHours++; }
    if (bc.netSavingPerYear == null) continue;
    withMoney++;
    net += bc.netSavingPerYear;
    oneOff += bc.oneOffCost || 0;
    estimates = estimates || bc.basedOnEstimates;
    currencies.add(bc.currency);
  }
  // Money in different currencies is never added up
  const mixed = currencies.size > 1;
  const has = withMoney > 0 && !mixed;
  return {
    count: list.length,
    withMoney,
    netPerYear: has ? net : null,
    hours: withHours ? hours : null,
    fte: withHours ? Math.round((hours / FTE_HOURS_PER_YEAR) * 10) / 10 : null,
    oneOff: has ? oneOff : null,
    paybackMonths: has && net > 0 ? (oneOff > 0 ? Math.ceil(oneOff / (net / 12)) : 0) : null,
    basedOnEstimates: estimates,
    currency: mixed ? 'mixed' : (currencies.size ? [...currencies][0] : 'DKK'),
    stages,
  };
}

// A node list, or a list of node lists (one per taxonomy). Ids can repeat across
// taxonomies (a custom "1.1" next to APQC "1.1"); the stored node name decides.
function makeResolver(nodesOrLists = []) {
  const lists = Array.isArray(nodesOrLists[0]) ? nodesOrLists : [nodesOrLists];
  const maps = lists.map(l => Object.fromEntries(l.map(n => [n.id, n])));
  return function resolve(ctx) {
    const id = ctx?.apqcNodeId;
    if (!id) return { l1: null, l2: null, leaf: null };
    const hits = maps.filter(m => m[id]);
    const map = hits.find(m => ctx.apqcNodeName && m[id].name === ctx.apqcNodeName) || hits[0];
    if (!map) return { l1: null, l2: null, leaf: null };
    let node = map[id];
    const leaf = node;
    let l2 = null;
    while (node && node.level > 1) {
      if (node.level === 2) l2 = node;
      node = map[node.parentId];
    }
    return { l1: node || null, l2, leaf, path: pathOf(map, leaf) };
  };
}
function pathOf(map, leaf) {
  const parts = [];
  for (let n = leaf; n; n = map[n.parentId]) parts.unshift(n.id);
  return parts;
}
export { makeResolver };

const time = f => new Date(f.updated_at || 0).getTime();
const benefit = f => flowBusinessCase(f)?.netSavingPerYear ?? -Infinity;
const RANK = s => STATUS_RANK[s] || 0;
function sortFlows(list, sortBy) {
  const by = {
    benefit: (a, b) => benefit(b) - benefit(a),
    status: (a, b) => RANK(b.ragStatus) - RANK(a.ragStatus),
    updated: (a, b) => time(b) - time(a),
  }[sortBy];
  return by ? [...list].sort((a, b) => by(a, b) || time(b) - time(a)) : list;
}

/** [{ node: l1|null, flows, totals, status, groups: [{ node: l2|null, flows }] }] */
export function groupPortfolio(flows, nodesOrLists = [], { sortBy = 'benefit' } = {}) {
  const resolve = makeResolver(nodesOrLists);
  const l2Order = (Array.isArray(nodesOrLists[0]) ? nodesOrLists.flat() : nodesOrLists).filter(n => n.level === 2).map(n => n.id);
  const areas = new Map();
  const loose = [];
  for (const f of real(flows)) {
    const { l1, l2 } = resolve(f.processContext);
    if (!l1) { loose.push(f); continue; }
    const aKey = `${l1.id}|${l1.name}`;
    if (!areas.has(aKey)) areas.set(aKey, { node: l1, flows: [], byL2: new Map() });
    const a = areas.get(aKey);
    a.flows.push(f);
    const key = l2?.id || '__none__';
    if (!a.byL2.has(key)) a.byL2.set(key, { node: l2, flows: [] });
    a.byL2.get(key).flows.push(f);
  }
  const area = (node, list, byL2) => {
    const totals = summarisePortfolio(list);
    const groups = byL2
      ? [...byL2.entries()]
          .sort(([a], [b]) => (a === '__none__') - (b === '__none__') || l2Order.indexOf(a) - l2Order.indexOf(b))
          .map(([, g]) => ({ ...g, flows: sortFlows(g.flows, sortBy) }))
      : [{ node: null, flows: sortFlows(list, sortBy) }];
    return { node, flows: list, totals, status: worstStatus(list.map(f => f.ragStatus)), groups };
  };
  const areaSort = {
    benefit: (a, b) => (b.totals.netPerYear ?? -Infinity) - (a.totals.netPerYear ?? -Infinity),
    status: (a, b) => RANK(b.status) - RANK(a.status),
    updated: (a, b) => Math.max(...b.flows.map(time)) - Math.max(...a.flows.map(time)),
  }[sortBy] || (() => 0);
  const out = [...areas.values()]
    .map(a => area(a.node, a.flows, a.byL2))
    .sort((a, b) => areaSort(a, b) || a.node.id.localeCompare(b.node.id, undefined, { numeric: true }));
  // Unclassified always last, whatever the sort
  if (loose.length) out.push(area(null, loose, null));
  return out;
}

export function taxonomyCoverage(flows, nodes = []) {
  const resolve = makeResolver(nodes);
  const covered = new Set();
  let unclassified = 0;
  for (const f of real(flows)) {
    const { l1 } = resolve(f.processContext);
    if (l1) covered.add(l1.id); else if (!f.processContext?.apqcNodeId) unclassified++;
  }
  return { covered: covered.size, total: nodes.filter(n => n.level === 1).length, unclassified };
}
