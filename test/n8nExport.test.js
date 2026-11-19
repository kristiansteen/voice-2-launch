import test from 'node:test';
import assert from 'node:assert/strict';
import { buildN8nWorkflow, n8nFilename } from '../src/services/n8nExport.js';

const parsed = {
  process_name: 'Invoice approval',
  roles: [{ id: 'r1', name: 'AP clerk' }, { id: 'r2', name: 'Manager' }],
  events: [{ id: 's', type: 'start', name: 'Invoice received' }, { id: 'e', type: 'end', name: 'Paid' }, { id: 'x', type: 'end', name: 'Rejected' }],
  activities: [
    { id: 'a1', name: 'Check PO match', performer: 'r1' },
    { id: 'a2', name: 'Chase missing PO', performer: 'r1' },
    { id: 'a3', name: 'Approve invoice', performer: 'r2' },
    { id: 'a4', name: 'Pay invoice', performer: 'r1' },
  ],
  gateways: [{ id: 'g1', type: 'exclusive', name: 'PO match?' }, { id: 'g2', type: 'exclusive', name: '' }],
  sequence_flows: [
    { from: 's', to: 'a1' }, { from: 'a1', to: 'g1' },
    { from: 'g1', to: 'a3', condition: 'Yes' }, { from: 'g1', to: 'a2', condition: 'No' },
    { from: 'a2', to: 'g2' }, { from: 'a3', to: 'g2' }, { from: 'g2', to: 'a4' }, { from: 'a4', to: 'e' },
  ],
};
const metrics = { activities: [{ id: 'a2', value_class: 'waste', waste_type: 'defects' }, { id: 'a1', duration_value: 10, duration_unit: 'min' }] };
const wf = buildN8nWorkflow({ parsed, metrics, systemMap: { a1: 'SAP' }, processName: 'Invoice approval', variant: 'to-be', lang: 'en' });
const byName = n => wf.nodes.find(x => x.name === n);
const out = (name, i = 0) => (wf.connections[name]?.main?.[i] || []).map(c => c.node);

test('every node is importable: id, unique name, type, version, position, parameters', () => {
  const names = new Set();
  for (const n of wf.nodes) {
    assert.ok(n.id && n.name && n.type && Number.isFinite(n.typeVersion) && Array.isArray(n.position) && n.parameters, JSON.stringify(n));
    assert.ok(!names.has(n.name), `duplicate ${n.name}`);
    names.add(n.name);
  }
  for (const [from, c] of Object.entries(wf.connections)) {
    assert.ok(names.has(from), from);
    for (const outs of c.main) for (const t of outs) assert.ok(names.has(t.node), t.node);
  }
  assert.equal(wf.name, 'Invoice approval (TO-BE)');
});

test('start becomes a manual trigger', () => {
  assert.equal(wf.nodes.filter(n => n.type === 'n8n-nodes-base.manualTrigger').length, 1);
});

test('a decision becomes an IF with true and false outputs', () => {
  const ifNode = wf.nodes.find(n => n.type === 'n8n-nodes-base.if');
  assert.ok(ifNode);
  assert.deepEqual(out(ifNode.name, 0), ['Approve invoice']);
  assert.ok(out(ifNode.name, 1).length === 1);
});

test('waste steps are left out and bridged, with a note', () => {
  assert.equal(byName('Chase missing PO'), undefined);
  const ifNode = wf.nodes.find(n => n.type === 'n8n-nodes-base.if');
  assert.deepEqual(out(ifNode.name, 1), ['Pay invoice']);
  assert.ok(wf.nodes.some(n => n.type === 'n8n-nodes-base.stickyNote' && /Chase missing PO/.test(n.parameters.content)));
});

test('approvals become a Wait node that resumes on a webhook', () => {
  const ap = byName('Approve invoice');
  assert.equal(ap.type, 'n8n-nodes-base.wait');
  assert.equal(ap.parameters.resume, 'webhook');
});

test('other steps are placeholders that say what to set up', () => {
  const s = byName('Check PO match');
  assert.equal(s.type, 'n8n-nodes-base.noOp');
  assert.match(s.notes, /SAP/);
  assert.match(s.notes, /AP clerk/);
  assert.equal(s.notesInFlow, true);
});

test('a join gateway is not a node: both paths go to the next step', () => {
  assert.equal(wf.nodes.filter(n => /gateway/i.test(n.name)).length, 0);
  assert.deepEqual(out('Approve invoice'), ['Pay invoice']);
});

test('parallel joins become a Merge node', () => {
  const p = {
    ...parsed, gateways: [{ id: 'p1', type: 'parallel' }, { id: 'p2', type: 'parallel' }],
    activities: [{ id: 'b1', name: 'A' }, { id: 'b2', name: 'B' }, { id: 'b3', name: 'C' }],
    sequence_flows: [{ from: 's', to: 'p1' }, { from: 'p1', to: 'b1' }, { from: 'p1', to: 'b2' }, { from: 'b1', to: 'p2' }, { from: 'b2', to: 'p2' }, { from: 'p2', to: 'b3' }, { from: 'b3', to: 'e' }],
  };
  const w = buildN8nWorkflow({ parsed: p, lang: 'en' });
  const merge = w.nodes.find(n => n.type === 'n8n-nodes-base.merge');
  assert.ok(merge);
  const into = Object.entries(w.connections).flatMap(([from, c]) => c.main.flat().filter(x => x.node === merge.name).map(x => x.index));
  assert.deepEqual(into.sort(), [0, 1]);
});

test('filename', () => {
  assert.equal(n8nFilename('Invoice approval', 'to-be'), 'invoice-approval-to-be-n8n.json');
});
