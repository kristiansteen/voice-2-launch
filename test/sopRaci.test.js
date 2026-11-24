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
