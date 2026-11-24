import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSopHtml } from '../src/services/sopGenerator.js';

const parsed = { roles: [{ id: 'role_1', name: 'Clerk' }], events: [], activities: [], gateways: [], sequence_flows: [] };

test('SOP includes the RACI chart when there is one', () => {
  const raci = { roles: ['Clerk', 'CFO'], rows: [{ step: 'Approve <big>', cells: { Clerk: 'R', CFO: 'A' } }] };
  const html = buildSopHtml({ parsed, processName: 'P', lang: 'en', raci });
  assert.match(html, /RACI/);
  assert.match(html, /<th>CFO<\/th>/);
  assert.match(html, /Approve &lt;big&gt;/);
  assert.match(html, /<td class="raci">A<\/td>/);
});

test('SOP leaves the RACI chart out when there is none', () => {
  assert.doesNotMatch(buildSopHtml({ parsed, processName: "P", lang: "en" }), /<table class="roles-table raci-table">/);
});

const parsedWithStep = {
  roles: [{ id: 'role_1', name: 'Clerk' }],
  events: [{ id: 'event_1', type: 'start', name: 'Start' }],
  activities: [{ id: 'act_1', name: 'Approve invoice', performer: 'role_1' }],
  gateways: [],
  sequence_flows: [{ id: 'f1', from: 'event_1', to: 'act_1' }],
};
const raciStep = { roles: ['Clerk', 'CFO', 'AP', 'Supplier'], rows: [{ step: 'approve invoice', cells: { Clerk: 'R', CFO: 'A', AP: 'C', Supplier: 'I' } }] };

test('each SOP step shows who is R, A, C and I', () => {
  const html = buildSopHtml({ parsed: parsedWithStep, processName: 'P', lang: 'en', raci: raciStep });
  const step = html.slice(html.indexOf('class="step step-activity"'));
  assert.match(step, /class="step-raci/);
  assert.match(step, /Responsible: Clerk/);
  assert.match(step, /Accountable: CFO/);
  assert.match(step, /Consulted: AP/);
  assert.match(step, /Informed: Supplier/);
});

test('A/R counts as both responsible and accountable in the step line', () => {
  const raci = { roles: ['Clerk'], rows: [{ step: 'Approve invoice', cells: { Clerk: 'A/R' } }] };
  const html = buildSopHtml({ parsed: parsedWithStep, processName: 'P', lang: 'en', raci });
  assert.match(html, /Responsible: Clerk/);
  assert.match(html, /Accountable: Clerk/);
});

test('Danish SOP uses Danish RACI wording', () => {
  const html = buildSopHtml({ parsed: parsedWithStep, processName: 'P', lang: 'da', raci: raciStep });
  assert.match(html, /Udfører: Clerk/);
  assert.match(html, /Godkender: CFO/);
  assert.match(html, /Konsulteres: AP/);
  assert.match(html, /Informeres: Supplier/);
  assert.doesNotMatch(html, /R = Responsible/);
});

test('steps without a RACI row show no RACI line', () => {
  const html = buildSopHtml({ parsed: parsedWithStep, processName: 'P', lang: 'en' });
  assert.doesNotMatch(html, /class="step-raci/);
});
