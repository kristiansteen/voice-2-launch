import test from 'node:test';
import assert from 'node:assert/strict';
import { flowStage, STAGES, summarisePortfolio, groupPortfolio, taxonomyCoverage, worstStatus } from '../src/lib/portfolio.js';

const nodes = [
  { id: '8.0', level: 1, name: 'Manage Financial Resources' },
  { id: '8.6', level: 2, parentId: '8.0', name: 'Process accounts payable' },
  { id: '8.6.1', level: 3, parentId: '8.6', name: 'Process invoices' },
  { id: '8.2', level: 2, parentId: '8.0', name: 'Revenue accounting' },
  { id: '4.0', level: 1, name: 'Deliver Products and Services' },
  { id: '4.2', level: 2, parentId: '4.0', name: 'Procure' },
  { id: '6.0', level: 1, name: 'Human Capital' },
];
const p = { activities: [{ id: 'a' }], gateways: [], events: [], sequence_flows: [] };
const asIs = { activities: [{ id: 'a', duration_value: 60, duration_unit: 'min', duration_source: 'stated' }] };
const toBe = { activities: [{ id: 'a', duration_value: 30, duration_unit: 'min', duration_source: 'stated' }] };
const money = (vol, oneOff = 0) => ({ parsed: p, asIsMetrics: asIs, toBeParsed: p, toBeMetrics: toBe,
  businessCase: { volumePerMonth: vol, hourlyRate: 600, oneOffCost: oneOff, currency: 'DKK' } });
// 30 min saved × vol × 12 / 60 = 6·vol hours; × 600 = 3 600·vol per year

const flows = [
  { id: 'f1', process_name: 'Supplier invoices', processContext: { apqcNodeId: '8.6.1' }, projectPlan: { tasks: [] }, ragStatus: 'green', ...money(100, 180000) },
  { id: 'f2', process_name: 'Customer invoicing', processContext: { apqcNodeId: '8.2' }, improvements: [{ id: 'i' }], ragStatus: 'amber', ...money(50) },
  { id: 'f3', process_name: 'Purchase requests', processContext: { apqcNodeId: '4.2' }, parsed: p, board_url: 'x', ...money(400, 0) },
  { id: 'f4', process_name: 'Loose one', processDescription: { overview: 'x' } },
  { id: 'demo', _demo: true, process_name: 'Demo', ...money(1000) },
];

test('stage follows the five steps plus launched', () => {
  assert.deepEqual(STAGES, ['describe', 'review', 'map', 'improve', 'plan', 'launched']);
  assert.equal(flowStage(flows[0]), 'plan');
  assert.equal(flowStage(flows[1]), 'improve');
  assert.equal(flowStage(flows[2]), 'launched');
  assert.equal(flowStage(flows[3]), 'review');
  assert.equal(flowStage({}), 'describe');
  assert.equal(flowStage({ parsed: p }), 'map');
});

test('portfolio totals add up each business case and skip demo flows', () => {
  const s = summarisePortfolio(flows);
  assert.equal(s.count, 4);
  assert.equal(s.netPerYear, 3600 * (100 + 50 + 400));
  assert.equal(s.hours, 6 * (100 + 50 + 400));
  assert.equal(s.oneOff, 180000);
  assert.equal(s.paybackMonths, Math.ceil(180000 / (s.netPerYear / 12)));
  assert.equal(s.withMoney, 3);
  assert.deepEqual(s.stages, { describe: 0, review: 1, map: 0, improve: 1, plan: 1, launched: 1 });
});

test('no business cases gives empty money figures, not zeros', () => {
  const s = summarisePortfolio([{ id: 'x' }]);
  assert.equal(s.netPerYear, null);
  assert.equal(s.paybackMonths, null);
});

test('groups by level 1 then level 2, sorted by benefit, unclassified last', () => {
  const g = groupPortfolio(flows.filter(f => !f._demo), nodes);
  assert.deepEqual(g.map(a => a.node?.id ?? null), ['4.0', '8.0', null]);
  const fin = g[1];
  assert.equal(fin.flows.length, 2);
  assert.deepEqual(fin.groups.map(x => x.node.id), ['8.6', '8.2']);
  assert.equal(fin.totals.netPerYear, 3600 * 150);
  assert.equal(fin.status, 'amber');
});

test('worst status wins: red over amber over green', () => {
  assert.equal(worstStatus(['green', 'red', 'amber']), 'red');
  assert.equal(worstStatus([null, 'green']), 'green');
  assert.equal(worstStatus([null]), null);
});

test('coverage counts level 1 areas with at least one process', () => {
  assert.deepEqual(taxonomyCoverage(flows, nodes), { covered: 2, total: 3, unclassified: 1 });
});

test('every text the overview uses exists in English and Danish', async () => {
  const { readFileSync } = await import('node:fs');
  const { translations } = await import('../src/i18n/translations.js');
  const src = readFileSync(new URL('../src/components/ProcessOverview.jsx', import.meta.url), 'utf8');
  const keys = new Set([...src.matchAll(/(?<![\w.])t\.([A-Za-z_]+)/g)].map(m => m[1]));
  for (const s of STAGES) keys.add(`ovStage_${s}`);
  for (const lang of ['en', 'da']) for (const k of keys) assert.ok(translations[lang][k], `${lang}.${k}`);
});
