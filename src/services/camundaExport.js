// Camunda 8 export: the diagram as a BPMN file Camunda Modeler opens as a
// Camunda 8 process and that passes Camunda's compatibility checks. Mapping:
//   step in a system lane, or with a system set  → service task, job type = step name
//   other step                                    → Camunda user task, candidate group = lane
//   decision (exclusive / inclusive gateway)      → FEEL condition per path on one variable
//                                                   named after the decision; one default path
//   condition on a path that does not leave a decision → kept as the path's label only
//   intermediate event without a type             → none throw event (Camunda has no plain catch)
// Layout, lanes and ids are kept, so the file opens looking like the Ailean diagram.
// A starting point: job workers, forms and variables are set up in Camunda.

import BpmnModdle from 'bpmn-moddle';
import zeebe from 'zeebe-bpmn-moddle/resources/zeebe.json' with { type: 'json' };

export const CAMUNDA_VERSION = '8.8.0';
const MODELER_NS = 'http://camunda.org/schema/modeler/1.0';
const SYSTEM_LANE = /\b(system|erp|sap|crm|bot|automat|integration|api)\b/i;
const DEFAULT_LABEL = /^(no|nej|else|otherwise|ellers|andet|other)$/i;
const TASKS = new Set(['bpmn:Task', 'bpmn:UserTask', 'bpmn:ManualTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask', 'bpmn:SendTask', 'bpmn:BusinessRuleTask']);

const slug = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function feelName(name, id) {
  const words = String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return `decision_${slug(id).replace(/-/g, '_')}`;
  const v = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('');
  return /^[a-z]/i.test(v) ? v : `d${v}`;
}

const feelString = s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export function camundaFilename(processName, variant) {
  return `${slug(processName) || 'process'}-${variant}.camunda.bpmn`;
}

export async function buildCamundaXml({ xml, systemMap = {} }) {
  const moddle = new BpmnModdle({ zeebe });
  const { rootElement: defs } = await moddle.fromXML(xml);

  defs.$attrs['xmlns:modeler'] = MODELER_NS;
  defs.$attrs['modeler:executionPlatform'] = 'Camunda Cloud';
  defs.$attrs['modeler:executionPlatformVersion'] = CAMUNDA_VERSION;

  const planeElements = (defs.diagrams || []).flatMap(d => d.plane?.planeElement || []);

  for (const process of defs.rootElements.filter(e => e.$type === 'bpmn:Process')) {
    process.isExecutable = true;
    const els = process.flowElements || [];
    const lanes = (process.laneSets || []).flatMap(ls => ls.lanes || []);
    const laneOf = id => lanes.find(l => (l.flowNodeRef || []).some(n => n.id === id));

    // Swap one element for another of a new type, keeping every reference to it.
    const replace = (old, type, props = {}) => {
      const el = moddle.create(type, { id: old.id, name: old.name, ...props });
      el.$parent = process;
      if (old.documentation) el.documentation = old.documentation;
      el.incoming = old.incoming || [];
      el.outgoing = old.outgoing || [];
      els[els.indexOf(old)] = el;
      for (const f of els) {
        if (f.sourceRef === old) f.sourceRef = el;
        if (f.targetRef === old) f.targetRef = el;
      }
      for (const l of lanes) l.flowNodeRef = (l.flowNodeRef || []).map(n => (n === old ? el : n));
      for (const pe of planeElements) if (pe.bpmnElement === old) pe.bpmnElement = el;
      return el;
    };

    for (const el of [...els]) {
      if (TASKS.has(el.$type)) {
        const lane = laneOf(el.id);
        const system = systemMap[el.id] || (lane && SYSTEM_LANE.test(lane.name || '') ? lane.name : '');
        if (system) {
          const values = [moddle.create('zeebe:TaskDefinition', { type: slug(el.name) || slug(el.id) })];
          values.push(moddle.create('zeebe:TaskHeaders', { values: [moddle.create('zeebe:Header', { key: 'system', value: String(system) })] }));
          replace(el, 'bpmn:ServiceTask', { extensionElements: moddle.create('bpmn:ExtensionElements', { values }) });
        } else {
          const values = [moddle.create('zeebe:UserTask')];
          const group = (lane?.name || '').replace(/,/g, ' ').trim();
          if (group) values.push(moddle.create('zeebe:AssignmentDefinition', { candidateGroups: group }));
          replace(el, 'bpmn:UserTask', { extensionElements: moddle.create('bpmn:ExtensionElements', { values }) });
        }
      } else if (el.$type === 'bpmn:IntermediateCatchEvent' && !(el.eventDefinitions || []).length) {
        replace(el, 'bpmn:IntermediateThrowEvent');
      }
    }

    const flows = els.filter(e => e.$type === 'bpmn:SequenceFlow');
    const label = f => f.name || f.conditionExpression?.body || '';

    // Labels live in the path name from here on; conditions are set only where Camunda evaluates them.
    for (const f of flows) {
      if (!f.name && f.conditionExpression?.body) f.name = f.conditionExpression.body;
      f.conditionExpression = undefined;
    }

    for (const gw of els.filter(e => e.$type === 'bpmn:ExclusiveGateway' || e.$type === 'bpmn:InclusiveGateway')) {
      const out = flows.filter(f => f.sourceRef === gw);
      gw.default = undefined;
      if (out.length < 2) continue;
      const v = feelName(gw.name, gw.id);
      const def = out.find(f => !label(f)) || out.find(f => DEFAULT_LABEL.test(label(f).trim())) || out[out.length - 1];
      gw.default = def;
      for (const f of out) {
        if (f === def) continue;
        f.conditionExpression = moddle.create('bpmn:FormalExpression', { body: `=${v} = ${feelString(label(f) || f.id)}` });
      }
    }
  }

  const { xml: out } = await moddle.toXML(defs, { format: true });
  return out;
}
