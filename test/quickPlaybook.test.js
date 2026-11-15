import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuickPlaybook, quickPlaybookFilename } from '../src/services/quickPlaybook.js';

const parsed = {
  process_name: 'Invoice approval',
  roles: [{ id: 'role_1', name: 'AP Clerk' }, { id: 'role_2', name: 'Manager' }],
  events: [{ id: 'event_1', type: 'start', name: 'Invoice received' }, { id: 'event_2', type: 'end', name: 'Invoice closed' }],
  activities: [
    { id: 'act_1', name: 'Check PO match', performer: 'role_1' },
    { id: 'act_2', name: 'Approve invoice', performer: 'role_2' },
    { id: 'act_3', name: 'Return to procurement', performer: 'role_1' },
  ],
  gateways: [{ id: 'gw_1', type: 'exclusive', name: 'PO match?' }],
  sequence_flows: [
    { id: 'f1', from: 'event_1', to: 'act_1' },
    { id: 'f2', from: 'act_1', to: 'gw_1' },
    { id: 'f3', from: 'gw_1', to: 'act_2', condition: 'Yes' },
    { id: 'f4', from: 'gw_1', to: 'act_3', condition: 'No' },
    { id: 'f5', from: 'act_2', to: 'event_2' },
    { id: 'f6', from: 'act_3', to: 'event_2' },
  ],
};
const metrics = { activities: [{ id: 'act_1', duration_value: 10, duration_unit: 'min', duration_source: 'stated' }] };
const md = buildQuickPlaybook({ parsed, metrics, systemMap: { act_1: 'SAP S/4HANA' }, processDescription: { overview: 'Pay suppliers on time', exceptions: ['Supplier not in vendor master'], steps: [{ name: 'Check PO match', description: 'Compare invoice lines with the PO.' }] }, variant: 'to-be', lang: 'en' });

test('playbook names the project and its purpose', () => {
  assert.match(md, /^# Invoice approval/m);
  assert.match(md, /Pay suppliers on time/);
  assert.match(md, /TO-BE/);
});
test('systems from the system map become action connectors to set up', () => {
  assert.match(md, /## .*connectors/i);
  assert.match(md, /SAP S\/4HANA/);
});
test('steps carry role, system, time and missing details as fill-in markers', () => {
  assert.match(md, /Check PO match/);
  assert.match(md, /AP Clerk/);
  assert.match(md, /10 min/);
  assert.match(md, /\[fill in: system\]/); // act_2 has no system
});
test('approvals become human-in-the-loop tasks, others agent actions', () => {
  const approve = md.split('\n').findIndex(l => l.includes('Approve invoice'));
  assert.match(md.split('\n').slice(approve, approve + 6).join('\n'), /human-in-the-loop/i);
  const check = md.split('\n').findIndex(l => l.includes('Check PO match'));
  assert.doesNotMatch(md.split('\n').slice(check, check + 4).join('\n'), /human-in-the-loop/i);
});
test('decisions point each branch at the step it leads to', () => {
  assert.match(md, /Yes.*→.*Step \d+.*Approve invoice/);
  assert.match(md, /No.*→.*Step \d+.*Return to procurement/);
});
test('Danish playbook and safe filename', () => {
  const da = buildQuickPlaybook({ parsed, lang: 'da' });
  assert.match(da, /Opsætning/);
  assert.equal(quickPlaybookFilename('Invoice approval', 'to-be'), 'invoice-approval-to-be-quick-playbook.md');
});
test('no process gives no playbook', () => {
  assert.equal(buildQuickPlaybook({ parsed: null }), null);
});
test('description text and exceptions flow into the playbook', () => {
  assert.match(md, /Compare invoice lines with the PO\./);
  assert.match(md, /Supplier not in vendor master/);
});
