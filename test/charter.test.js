import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARTER_FIELDS, charterProgress, kpiLine } from '../src/lib/charter.js';
import { buildQuickPlaybook } from '../src/services/quickPlaybook.js';

test('charter fields, shared with the business case', () => {
  assert.deepEqual(CHARTER_FIELDS, ['owner', 'customer', 'problem', 'target', 'kpiName', 'kpiBaseline', 'kpiTarget', 'targetDate', 'volumePerMonth']);
});

test('progress counts filled fields', () => {
  assert.deepEqual(charterProgress({ owner: 'Ann', problem: ' ', volumePerMonth: 400, kpiBaseline: 0 }), { filled: 3, total: 9 });
  assert.deepEqual(charterProgress(undefined), { filled: 0, total: 9 });
});

test('KPI line reads baseline → target by date', () => {
  assert.equal(kpiLine({ kpiName: 'Days to pay', kpiBaseline: 21, kpiTarget: 5, targetDate: '2027-06-30' }, 'en'), 'Days to pay: 21 → 5 by 2027-06-30');
  assert.equal(kpiLine({ kpiName: 'Dage til betaling', kpiBaseline: 21, kpiTarget: 5 }, 'da'), 'Dage til betaling: 21 → 5');
  assert.equal(kpiLine({ kpiBaseline: 21 }, 'en'), null);
});

test('playbook carries owner, customer and KPI', () => {
  const md = buildQuickPlaybook({
    parsed: { process_name: 'P', roles: [], events: [], activities: [], gateways: [], sequence_flows: [] },
    businessCaseInputs: { owner: 'Ann', customer: 'Suppliers', kpiName: 'Days to pay', kpiBaseline: 21, kpiTarget: 5 },
    lang: 'en',
  });
  assert.match(md, /\*\*Process owner:\*\* Ann/);
  assert.match(md, /\*\*Customer:\*\* Suppliers/);
  assert.match(md, /\*\*KPI:\*\* Days to pay: 21 → 5/);
});

test('every charter text exists in English and Danish', async () => {
  const { readFileSync } = await import('node:fs');
  const { translations } = await import('../src/i18n/translations.js');
  const src = readFileSync(new URL('../src/components/ProcessCharter.jsx', import.meta.url), 'utf8');
  const keys = new Set([...src.matchAll(/(?<![\w.])t\.([A-Za-z_]+)/g)].map(m => m[1]));
  for (const lang of ['en', 'da']) for (const k of keys) assert.ok(translations[lang][k], `${lang}.${k}`);
});
