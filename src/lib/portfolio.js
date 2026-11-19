// Portfolio roll-up for the process overview: stage per flow, business-case
// totals, grouping by the process taxonomy (level 1 → level 2), coverage.
// Demo flows never count.

import { computeBusinessCase } from './businessCase.js';

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
  let net = 0, hours = 0, oneOff = 0, withMoney = 0, estimates = false;
  const currencies = new Set();
  for (const f of list) {
    stages[flowStage(f)]++;
    const bc = flowBusinessCase(f);
    if (!bc || bc.netSavingPerYear == null) continue;
    withMoney++;
    net += bc.netSavingPerYear;
    hours += bc.hoursSavedPerYear || 0;
    oneOff += bc.oneOffCost || 0;
    estimates = estimates || bc.basedOnEstimates;
    currencies.add(bc.currency);
  }
  const has = withMoney > 0;
  return {
    count: list.length,
    withMoney,
    netPerYear: has ? net : null,
    hours: has ? hours : null,
    fte: has ? Math.round((hours / 1600) * 10) / 10 : null,
    oneOff: has ? oneOff : null,
    paybackMonths: has && net > 0 ? (oneOff > 0 ? Math.ceil(oneOff / (net / 12)) : 0) : null,
    basedOnEstimates: estimates,
    // Totals are only meaningful in one currency; the overview says so when they are mixed
    currency: currencies.size === 1 ? [...currencies][0] : (currencies.size ? 'mixed' : 'DKK'),
    stages,
  };
}

function ancestry(nodeMap, nodeId) {
  let node = nodeMap[nodeId];
  if (!node) return { l1: null, l2: null };
  let l2 = null;
  while (node && node.level > 1) {
    if (node.level === 2) l2 = node;
    node = nodeMap[node.parentId];
  }
  return { l1: node || null, l2 };
}

/** [{ node: l1|null, flows, totals, status, groups: [{ node: l2|null, flows }] }] */
export function groupPortfolio(flows, nodes = []) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const l2Order = nodes.filter(n => n.level === 2).map(n => n.id);
  const areas = new Map();
  const loose = [];
  for (const f of real(flows)) {
    const { l1, l2 } = ancestry(nodeMap, f.processContext?.apqcNodeId);
    if (!l1) { loose.push(f); continue; }
    if (!areas.has(l1.id)) areas.set(l1.id, { node: l1, flows: [], byL2: new Map() });
    const a = areas.get(l1.id);
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
          .map(([, g]) => g)
      : [{ node: null, flows: list }];
    return { node, flows: list, totals, status: worstStatus(list.map(f => f.ragStatus)), groups };
  };
  const out = [...areas.values()]
    .map(a => area(a.node, a.flows, a.byL2))
    .sort((a, b) => (b.totals.netPerYear ?? -1) - (a.totals.netPerYear ?? -1) || a.node.id.localeCompare(b.node.id, undefined, { numeric: true }));
  if (loose.length) out.push(area(null, loose, null));
  return out;
}

export function taxonomyCoverage(flows, nodes = []) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const covered = new Set();
  let unclassified = 0;
  for (const f of real(flows)) {
    const { l1 } = ancestry(nodeMap, f.processContext?.apqcNodeId);
    if (l1) covered.add(l1.id); else unclassified++;
  }
  return { covered: covered.size, total: nodes.filter(n => n.level === 1).length, unclassified };
}
