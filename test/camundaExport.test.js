import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import BpmnModdle from 'bpmn-moddle';
import { buildCamundaXml, camundaFilename, CAMUNDA_VERSION } from '../src/services/camundaExport.js';
import { DEMO_XML, DEMO_TO_BE_XML } from '../src/data/demoFlow.js';

const require = createRequire(import.meta.url);
const { Linter } = require('bpmnlint');
const NodeResolver = require('bpmnlint/lib/resolver/node-resolver');
const zeebe = require('zeebe-bpmn-moddle/resources/zeebe.json');

const moddle = new BpmnModdle({ zeebe });
const parse = async xml => (await moddle.fromXML(xml)).rootElement;
const all = (defs, type) => {
  const p = defs.rootElements.find(e => e.$type === 'bpmn:Process');
  return p.flowElements.filter(e => e.$type === type);
};

async function lint(xml) {
  const linter = new Linter({
    config: { extends: `plugin:camunda-compat/camunda-cloud-${CAMUNDA_VERSION.split('.').slice(0, 2).join('-')}` },
    resolver: new NodeResolver(),
  });
  const reports = await linter.lint(await parse(xml));
  return Object.entries(reports).flatMap(([rule, rs]) => rs.filter(r => r.category === 'error').map(r => `${rule}: ${r.id} ${r.message}`));
}

const systemMap = { act_1: 'Outlook' };

test('AS-IS demo passes Camunda 8 compatibility lint with no errors', async () => {
  const xml = await buildCamundaXml({ xml: DEMO_XML, systemMap });
  assert.deepEqual(await lint(xml), []);
});

test('TO-BE demo passes Camunda 8 compatibility lint with no errors', async () => {
  const xml = await buildCamundaXml({ xml: DEMO_TO_BE_XML, systemMap: {} });
  assert.deepEqual(await lint(xml), []);
});

test('process is executable and the file targets Camunda 8', async () => {
  const defs = await parse(await buildCamundaXml({ xml: DEMO_XML, systemMap }));
  const p = defs.rootElements.find(e => e.$type === 'bpmn:Process');
  assert.equal(p.isExecutable, true);
  assert.equal(defs.$attrs['modeler:executionPlatform'], 'Camunda Cloud');
  assert.equal(defs.$attrs['modeler:executionPlatformVersion'], CAMUNDA_VERSION);
});

test('steps in a system lane or with a system become service tasks with a job type', async () => {
  const defs = await parse(await buildCamundaXml({ xml: DEMO_XML, systemMap }));
  const svc = all(defs, 'bpmn:ServiceTask');
  const byId = Object.fromEntries(svc.map(t => [t.id, t]));
  assert.ok(byId.act_6, 'Route for Approval (ERP System lane) is a service task');
  assert.ok(byId.act_1, 'Invoice Receipt (system map: Outlook) is a service task');
  const def = byId.act_6.extensionElements.values.find(v => v.$type === 'zeebe:TaskDefinition');
  assert.equal(def.type, 'route-for-approval');
});

test('human steps stay user tasks, assigned to their lane as candidate group', async () => {
  const defs = await parse(await buildCamundaXml({ xml: DEMO_XML, systemMap }));
  const t = all(defs, 'bpmn:UserTask').find(x => x.id === 'act_7');
  const types = t.extensionElements.values.map(v => v.$type);
  assert.ok(types.includes('zeebe:UserTask'));
  const a = t.extensionElements.values.find(v => v.$type === 'zeebe:AssignmentDefinition');
  assert.equal(a.candidateGroups, 'Department Manager');
});

test('each decision gets one default path and FEEL conditions on the rest', async () => {
  const defs = await parse(await buildCamundaXml({ xml: DEMO_XML, systemMap }));
  const flows = all(defs, 'bpmn:SequenceFlow');
  const gw = all(defs, 'bpmn:ExclusiveGateway').find(g => g.id === 'gw_1');
  const out = flows.filter(f => f.sourceRef.id === 'gw_1');
  assert.ok(gw.default && out.includes(gw.default));
  for (const f of out.filter(f => f !== gw.default)) {
    assert.match(f.conditionExpression.body, /^=documentsAvailable = ".+"$/);
  }
});

test('diagram layout and ids are kept', async () => {
  const before = await parse(DEMO_XML);
  const after = await parse(await buildCamundaXml({ xml: DEMO_XML, systemMap }));
  const shapes = d => d.diagrams[0].plane.planeElement.map(e => e.bpmnElement?.id).sort();
  assert.deepEqual(shapes(after), shapes(before));
});

test('filename is a .bpmn file named after process and variant', () => {
  assert.equal(camundaFilename('Invoice Approval (DK)', 'to-be'), 'invoice-approval-dk-to-be.camunda.bpmn');
});
