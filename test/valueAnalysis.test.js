import test from 'node:test';
import assert from 'node:assert/strict';
import { VALUE_CLASSES, WASTE_TYPES, valueSummary, applySuggestions, setValueClass, valueMapFor } from '../src/lib/valueAnalysis.js';

const parsed = {
  activities: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
  events: [{ id: 's', type: 'start' }, { id: 'e', type: 'end' }], gateways: [],
  sequence_flows: [{ from: 's', to: 'a' }, { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'd', to: 'e' }],
};
const m = (id, min, waitMin, extra = {}) => ({ id, duration_value: min, duration_unit: 'min', duration_source: 'stated', wait_value: waitMin, wait_unit: 'min', wait_source: 'stated', ...extra });
const metrics = { activities: [
  m('a', 30, 0, { value_class: 'va', value_source: 'user' }),
  m('b', 20, 60, { value_class: 'nnva', value_source: 'user' }),
  m('c', 10, 120, { value_class: 'waste', waste_type: 'defects', value_source: 'user' }),
  m('d', 40, 20, { value_class: 'waste', waste_type: 'overprocessing', value_source: 'ai' }),
] };

test('classes and the eight wastes', () => {
  assert.deepEqual(VALUE_CLASSES, ['va', 'nnva', 'waste']);
  assert.equal(WASTE_TYPES.length, 8);
  assert.ok(WASTE_TYPES.includes('waiting'));
});

test('value-adding share of touch and lead time, waiting counted as waste', () => {
  const s = valueSummary(parsed, metrics);
  assert.equal(s.vaTouchShare, 30 / 100);        // 30 of 100 min touch
  assert.equal(s.vaLeadShare, 30 / 300);         // 100 touch + 200 wait
  assert.equal(s.wasteSteps, 2);
  assert.equal(s.classified, 4);
  assert.equal(s.steps, 4);
  assert.equal(s.waitMin, 200);
  assert.equal(s.unconfirmed, 1);                // d is only an AI suggestion
});

test('waste by type, largest time first, waiting included', () => {
  const s = valueSummary(parsed, metrics);
  assert.deepEqual(s.byType.map(r => [r.type, r.steps, r.minutes]), [
    ['waiting', 3, 200], ['overprocessing', 1, 40], ['defects', 1, 10],
  ]);
});

test('lead share is null until every step has a waiting time', () => {
  const noWait = { activities: metrics.activities.map(a => ({ ...a, wait_value: undefined })) };
  assert.equal(valueSummary(parsed, noWait).vaLeadShare, null);
});

test('no classes yet gives nothing to show', () => {
  assert.equal(valueSummary(parsed, { activities: [m('a', 10, 0)] }), null);
});

test('AI suggestions fill only steps the user has not set', () => {
  const out = applySuggestions(metrics, [
    { id: 'a', class: 'waste', waste_type: 'motion', reason: 'x' },
    { id: 'd', class: 'nnva', reason: 'required by audit' },
    { id: 'new', class: 'va', reason: 'y' },
    { id: 'b', class: 'bogus' },
  ]);
  const byId = Object.fromEntries(out.activities.map(a => [a.id, a]));
  assert.equal(byId.a.value_class, 'va');                 // user's choice stands
  assert.equal(byId.d.value_class, 'nnva');               // AI may revise its own suggestion
  assert.equal(byId.d.value_reason, 'required by audit');
  assert.equal(byId.d.waste_type, undefined);             // waste type only for waste
  assert.equal(byId.new.value_class, 'va');
  assert.equal(byId.new.value_source, 'ai');
  assert.equal(byId.b.value_class, 'nnva');
});

test('setting a class by hand marks it as the user\'s and keeps times', () => {
  const out = setValueClass(metrics, 'd', { value_class: 'va' });
  const d = out.activities.find(a => a.id === 'd');
  assert.equal(d.value_class, 'va');
  assert.equal(d.value_source, 'user');
  assert.equal(d.waste_type, undefined);
  assert.equal(d.duration_value, 40);
  assert.equal(d.duration_source, 'stated');
});

test('value map for the diagram', () => {
  assert.deepEqual(valueMapFor(metrics), { a: 'va', b: 'nnva', c: 'waste', d: 'waste' });
});

test('every value-view text exists in English and Danish', async () => {
  const { readFileSync } = await import('node:fs');
  const { translations } = await import('../src/i18n/translations.js');
  const keys = new Set();
  for (const f of ['../src/components/ValueSection.jsx', '../src/components/DiagramPanel.jsx']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    for (const m of src.matchAll(/(?<![\w.])t\.(val[A-Za-z_]+)/g)) keys.add(m[1]);
  }
  for (const c of VALUE_CLASSES) { keys.add(`valClass_${c}`); keys.add(`valBand_${c}`); keys.add(`valLegend_${c}`); }
  for (const w of WASTE_TYPES) keys.add(`valWaste_${w}`);
  for (const lang of ['en', 'da']) for (const k of keys) assert.ok(translations[lang][k], `${lang}.${k}`);
});

import { carryValueFields } from '../src/lib/valueAnalysis.js';

test('new AI metrics keep the classes already set', () => {
  const fresh = { activities: [{ id: 'a', duration_value: 99, duration_unit: 'min' }, { id: 'z', duration_value: 1 }] };
  const out = carryValueFields(metrics, fresh);
  const a = out.activities.find(x => x.id === 'a');
  assert.equal(a.duration_value, 99);
  assert.equal(a.value_class, 'va');
  assert.equal(a.value_source, 'user');
  assert.equal(out.activities.find(x => x.id === 'z').value_class, undefined);
  assert.equal(carryValueFields(null, fresh), fresh);
  assert.equal(carryValueFields(metrics, null), null);
});

test('suggestions for ids not in the process are ignored when ids are known', () => {
  const out = applySuggestions({ activities: [] }, [{ id: 'ghost', class: 'va' }, { id: 'a', class: 'va' }], ['a']);
  assert.deepEqual(out.activities.map(x => x.id), ['a']);
});

test('overriding Ailean drops its reason; accepting keeps it', () => {
  const ai = { activities: [{ id: 'x', value_class: 'nnva', value_reason: 'audit', value_source: 'ai' }] };
  assert.equal(setValueClass(ai, 'x', { value_class: 'nnva' }).activities[0].value_reason, 'audit');
  assert.equal(setValueClass(ai, 'x', { value_class: 'waste' }).activities[0].value_reason, undefined);
});

test('a waste step without a type is counted as untyped, not guessed', () => {
  const s = valueSummary(parsed, { activities: [m('a', 10, 0, { value_class: 'waste' })] });
  assert.equal(s.byType[0].type, 'untyped');
});

test('value-adding band is green with white text, distinct from waste and from black', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const rule = css.match(/\.value-band--va\s*\{([^}]*)\}/)[1];
  assert.match(rule, /background:\s*#2E7D4F/i);
  assert.match(rule, /color:\s*#FFFFFF/i);
});
