import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBusinessCase, missingInputs, FTE_HOURS_PER_YEAR } from '../src/lib/businessCase.js';

// AS-IS 60 min touch per case, TO-BE 15 → 45 min saved per case
const asIsParsed = { activities: [{ id: 'a' }], gateways: [], events: [], sequence_flows: [] };
const asIsMetrics = { activities: [{ id: 'a', duration_value: 60, duration_unit: 'min', duration_source: 'stated', wait_value: 2, wait_unit: 'day', wait_source: 'stated' }] };
const toBeMetrics = { activities: [{ id: 'a', duration_value: 15, duration_unit: 'min', duration_source: 'estimated', wait_value: 4, wait_unit: 'hr', wait_source: 'estimated' }] };
const inputs = { volumePerMonth: 400, hourlyRate: 500, oneOffCost: 300000, runCostPerYear: 20000, currency: 'DKK' };

test('money follows volume × time saved × rate, less running cost', () => {
  const bc = computeBusinessCase({ asIsParsed, asIsMetrics, toBeParsed: asIsParsed, toBeMetrics, inputs });
  assert.equal(bc.minutesSavedPerCase, 45);
  assert.equal(bc.hoursSavedPerYear, 3600);           // 45 min × 400 × 12 / 60
  assert.equal(bc.grossSavingPerYear, 1800000);       // 3600 h × 500
  assert.equal(bc.netSavingPerYear, 1780000);         // less 20 000 running cost
  assert.equal(bc.fteFreed, Math.round((3600 / FTE_HOURS_PER_YEAR) * 10) / 10);
  assert.equal(bc.paybackMonths, 3);                  // 300 000 / (1 780 000 / 12) = 2.02 → first month in the black: 3
  assert.equal(bc.threeYearNet, 3 * 1780000 - 300000);
  assert.equal(bc.basedOnEstimates, true);            // TO-BE times are estimates
});

test('cumulative curve starts at minus the investment and crosses zero at payback', () => {
  const bc = computeBusinessCase({ asIsParsed, asIsMetrics, toBeParsed: asIsParsed, toBeMetrics, inputs });
  assert.equal(bc.cumulative.length, 25);              // month 0..24
  assert.equal(bc.cumulative[0].value, -300000);
  assert.ok(bc.cumulative[2].value < 0);
  assert.ok(bc.cumulative[3].value > 0);
  assert.ok(bc.cumulative[24].value > 0);
});

test('time per case before and after, split touch and wait', () => {
  const bc = computeBusinessCase({ asIsParsed, asIsMetrics, toBeParsed: asIsParsed, toBeMetrics, inputs });
  assert.deepEqual(bc.perCase.asIs, { touchMin: 60, waitMin: 2 * 8 * 60 });
  assert.equal(bc.perCase.toBe.touchMin, 15);
});

test('missing inputs are named; money is null but time still shows', () => {
  assert.deepEqual(missingInputs({ currency: 'DKK' }), ['volumePerMonth', 'hourlyRate']);
  const bc = computeBusinessCase({ asIsParsed, asIsMetrics, toBeParsed: asIsParsed, toBeMetrics, inputs: {} });
  assert.equal(bc.netSavingPerYear, null);
  assert.equal(bc.paybackMonths, null);
  assert.equal(bc.minutesSavedPerCase, 45);
  assert.deepEqual(bc.missing, ['volumePerMonth', 'hourlyRate']);
});

test('no payback when the TO-BE saves nothing', () => {
  const same = computeBusinessCase({ asIsParsed, asIsMetrics, toBeParsed: asIsParsed, toBeMetrics: asIsMetrics, inputs });
  assert.equal(same.minutesSavedPerCase, 0);
  assert.equal(same.paybackMonths, null);
});

test('no TO-BE times gives no business case', () => {
  assert.equal(computeBusinessCase({ asIsParsed, asIsMetrics, toBeParsed: null, toBeMetrics: null, inputs }), null);
});

test('an estimated volume marks the whole case as estimated', () => {
  const bc = computeBusinessCase({ asIsParsed, asIsMetrics, toBeParsed: asIsParsed, toBeMetrics: asIsMetrics,
    inputs: { ...inputs, sources: { volumePerMonth: 'estimated' } } });
  assert.equal(bc.basedOnEstimates, true);
});

import { businessCaseSummary } from '../src/lib/businessCase.js';
import { buildQuickPlaybook } from '../src/services/quickPlaybook.js';
import { buildSopHtml } from '../src/services/sopGenerator.js';

const full = () => computeBusinessCase({ asIsParsed, asIsMetrics, toBeParsed: asIsParsed, toBeMetrics, inputs });
const tiny = { process_name: 'P', roles: [], events: [], activities: [{ id: 'a', name: 'Do it' }], gateways: [], sequence_flows: [] };

test('summary line carries money, hours, payback and the estimate flag', () => {
  const line = businessCaseSummary(full(), 'en');
  assert.match(line, /per year/);
  assert.match(line, /3,600 hours freed/);
  assert.match(line, /payback 3 months/);
  assert.match(line, /based on estimates/);
  assert.equal(businessCaseSummary(computeBusinessCase({ asIsParsed, asIsMetrics, toBeParsed: asIsParsed, toBeMetrics, inputs: {} })), null);
});

test('Quick Suite playbook uses the business case instead of a fill-in', () => {
  const md = buildQuickPlaybook({ parsed: tiny, businessCase: full(), businessCaseInputs: { problem: 'Late payments' }, lang: 'en' });
  assert.match(md, /\*\*Business case:\*\* .*per year/);
  assert.match(md, /Late payments/);
  assert.doesNotMatch(md, /\[fill in: business case/);
});

test('SOP shows the business case under purpose when there is one', () => {
  const html = buildSopHtml({ parsed: tiny, processName: 'P', lang: 'en', businessCaseLine: 'DKK 1,780,000 per year' });
  assert.match(html, /Business case/);
  assert.match(html, /DKK 1,780,000 per year/);
  assert.doesNotMatch(buildSopHtml({ parsed: tiny, processName: 'P', lang: 'en' }), /Business case/);
});

test('every bc text the business case screen uses exists in English and Danish', async () => {
  const { readFileSync } = await import('node:fs');
  const { translations } = await import('../src/i18n/translations.js');
  const src = readFileSync(new URL('../src/components/BusinessCase.jsx', import.meta.url), 'utf8');
  const keys = [...new Set([...src.matchAll(/t\.(bc[A-Za-z_]+)/g)].map(m => m[1]))];
  for (const k of ['bcSrc_stated', 'bcSrc_estimated', 'bcSrc_measured']) keys.push(k);
  for (const lang of ['en', 'da']) for (const k of keys) assert.ok(translations[lang][k], `${lang}.${k}`);
});

import { formatMoney } from '../src/lib/businessCase.js';

test('an unknown saved currency falls back to DKK instead of crashing', () => {
  assert.doesNotThrow(() => formatMoney(100, 'kr', 'en'));
  assert.match(formatMoney(100, 'kr', 'en'), /DKK/);
});

test('Danish summary writes FTE with a decimal comma', () => {
  const bc = { ...full(), fteFreed: 0.5 };
  assert.match(businessCaseSummary(bc, 'da'), /0,5 årsværk/);
});

test('multi-line problem text stays on one playbook line', () => {
  const md = buildQuickPlaybook({ parsed: tiny, businessCaseInputs: { problem: 'Late\npayments' }, lang: 'en' });
  assert.match(md, /\*\*Problem:\*\* Late payments/);
});
