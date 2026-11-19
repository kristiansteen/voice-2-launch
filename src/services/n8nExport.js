// n8n export: the process diagram as an importable n8n workflow skeleton.
// It is a starting point for automation, not a running workflow: credentials,
// data and real API calls are set up in n8n. Mapping:
//   start event            → Manual Trigger
//   approval step          → Wait (resumes on a webhook; swap for a Send-and-Wait node)
//   other step             → No Operation placeholder with a note on what to build
//   decision, 2 branches   → IF;  3–4 branches → Switch
//   parallel join          → Merge
//   join / split gateways  → no node; paths connect straight through
//   waste step (value view)→ left out and listed on a sticky note
//   end event              → No Operation "End: …"
// Only core nodes with fixed versions, so the file imports cleanly.

import { APPROVAL } from './quickPlaybook.js';
import { toMinutes, formatMinutes } from '../lib/processMetrics.js';

const T = {
  manual: { type: 'n8n-nodes-base.manualTrigger', typeVersion: 1 },
  noop: { type: 'n8n-nodes-base.noOp', typeVersion: 1 },
  wait: { type: 'n8n-nodes-base.wait', typeVersion: 1.1 },
  if: { type: 'n8n-nodes-base.if', typeVersion: 1 },
  switch: { type: 'n8n-nodes-base.switch', typeVersion: 1 },
  merge: { type: 'n8n-nodes-base.merge', typeVersion: 2 },
  sticky: { type: 'n8n-nodes-base.stickyNote', typeVersion: 1 },
};

const TXT = {
  en: {
    end: 'End', decision: 'Decision', join: 'Join', step: 'Step',
    noteStep: 'Placeholder: replace with the node that does this step.',
    noteApproval: 'Approval: waits until resumed via its webhook. For e-mail, Slack or Teams approval, swap in that node with "Send and Wait for Response" and keep the IF after it.',
    system: 'System', role: 'Done today by', time: 'Touch time today',
    branches: 'Branches', notWired: 'More than 4 branches: the rest are not connected.',
    mergeMany: 'More than 2 paths join here; only the first 2 are connected.',
    title: '## {name}\nExported from Ailean ({variant}). A starting point: set credentials, data and real API calls in each node.',
    removed: '\n\n**Left out as waste (value view):**\n{list}',
  },
  da: {
    end: 'Slut', decision: 'Beslutning', join: 'Samling', step: 'Trin',
    noteStep: 'Pladsholder: erstat med den node, der udfører trinnet.',
    noteApproval: 'Godkendelse: venter, til den genoptages via sin webhook. Til godkendelse via mail, Slack eller Teams: indsæt den node med "Send and Wait for Response", og behold IF-noden efter.',
    system: 'System', role: 'Udføres i dag af', time: 'Behandlingstid i dag',
    branches: 'Grene', notWired: 'Mere end 4 grene: resten er ikke forbundet.',
    mergeMany: 'Mere end 2 veje samles her; kun de første 2 er forbundet.',
    title: '## {name}\nEksporteret fra Ailean ({variant}). Et udgangspunkt: sæt adgangsoplysninger, data og rigtige API-kald op i hver node.',
    removed: '\n\n**Udeladt som spild (værdivisning):**\n{list}',
  },
};

export function n8nFilename(processName, variant = 'to-be') {
  const slug = (processName || 'process').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'process';
  return `${slug}-${variant}-n8n.json`;
}

const uuid = i => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

export function buildN8nWorkflow({ parsed, metrics = null, systemMap = {}, processName, variant = 'to-be', lang = 'en' } = {}) {
  if (!parsed) return null;
  const L = TXT[lang] || TXT.en;
  const flows = parsed.sequence_flows || [];
  const outOf = id => flows.filter(f => f.from === id);
  const into = id => flows.filter(f => f.to === id);
  const metricOf = Object.fromEntries((metrics?.activities || []).map(m => [m.id, m]));
  const roleOf = Object.fromEntries((parsed.roles || []).map(r => [r.id, r.name]));

  // 1. Decide what each BPMN element becomes (null = no node, connect through)
  const plan = {};
  const removed = [];
  for (const e of parsed.events || []) {
    if (e.type === 'start') plan[e.id] = { kind: 'manual', name: e.name || 'Start' };
    else if (e.type === 'end') plan[e.id] = { kind: 'noop', name: `${L.end}: ${e.name || L.end}` };
    else plan[e.id] = { kind: 'noop', name: e.name || L.step };
  }
  for (const a of parsed.activities || []) {
    const m = metricOf[a.id];
    if (m?.value_class === 'waste') { plan[a.id] = null; removed.push(a.name); continue; }
    const notes = [];
    const approval = APPROVAL.test(a.name || '');
    notes.push(approval ? L.noteApproval : L.noteStep);
    if (systemMap[a.id]) notes.push(`${L.system}: ${systemMap[a.id]}`);
    if (roleOf[a.performer]) notes.push(`${L.role}: ${roleOf[a.performer]}`);
    if (m?.duration_value) notes.push(`${L.time}: ${formatMinutes(toMinutes(Number(m.duration_value), m.duration_unit))}`);
    plan[a.id] = { kind: approval ? 'wait' : 'noop', name: a.name || L.step, notes: notes.join('\n') };
  }
  for (const g of parsed.gateways || []) {
    const outs = outOf(g.id).length, ins = into(g.id).length;
    if (g.type === 'parallel') {
      plan[g.id] = ins > 1 ? { kind: 'merge', name: g.name || L.join, notes: ins > 2 ? L.mergeMany : undefined } : null;
    } else if (outs > 1) {
      const conds = outOf(g.id).map(f => f.condition || '—');
      plan[g.id] = {
        kind: outs === 2 ? 'if' : 'switch', name: g.name || L.decision, conds,
        notes: `${L.branches}: ${conds.map((c, i) => `${i}: ${c}`).join(' · ')}${outs > 4 ? `\n${L.notWired}` : ''}`,
      };
    } else plan[g.id] = null;
  }

  // 2. Unique names
  const used = new Set();
  for (const p of Object.values(plan)) {
    if (!p) continue;
    let n = p.name, i = 2;
    while (used.has(n)) n = `${p.name} (${i++})`;
    used.add(n); p.name = n;
  }

  // 3. Where a path really goes: skip over elements that are not nodes
  function targets(id, seen = new Set()) {
    if (seen.has(id)) return [];
    seen.add(id);
    if (plan[id]) return [id];
    return outOf(id).flatMap(f => targets(f.to, seen));
  }

  // 4. Connections (by node name); Merge inputs are numbered in arrival order
  const connections = {};
  const mergeInputs = {};
  const connect = (from, output, to) => {
    const name = plan[from].name;
    connections[name] = connections[name] || { main: [] };
    while (connections[name].main.length <= output) connections[name].main.push([]);
    let index = 0;
    if (plan[to].kind === 'merge') {
      mergeInputs[to] = mergeInputs[to] ?? 0;
      index = mergeInputs[to]++;
      if (index > 1) return;
    }
    if (!connections[name].main[output].some(c => c.node === plan[to].name)) {
      connections[name].main[output].push({ node: plan[to].name, type: 'main', index });
    }
  };
  for (const id of Object.keys(plan)) {
    if (!plan[id]) continue;
    outOf(id).forEach((f, i) => {
      const output = plan[id].kind === 'if' || plan[id].kind === 'switch' ? i : 0;
      if (output > 3) return;
      for (const t of targets(f.to)) connect(id, output, t);
    });
  }

  // 5. Layout: columns by distance from the trigger(s)
  const depth = {};
  const queue = Object.keys(plan).filter(id => plan[id]?.kind === 'manual');
  queue.forEach(id => { depth[id] = 0; });
  const nameToId = Object.fromEntries(Object.entries(plan).filter(([, p]) => p).map(([id, p]) => [p.name, id]));
  while (queue.length) {
    const id = queue.shift();
    for (const outs of connections[plan[id].name]?.main || []) {
      for (const c of outs) {
        const t = nameToId[c.node];
        if (depth[t] === undefined) { depth[t] = depth[id] + 1; queue.push(t); }
      }
    }
  }
  const rows = {};
  const position = id => {
    const d = depth[id] ?? (Math.max(0, ...Object.values(depth)) + 1);
    rows[d] = (rows[d] ?? -1) + 1;
    return [260 + d * 260, 300 + rows[d] * 180];
  };

  // 6. Nodes
  let n = 0;
  const nodes = [];
  for (const [id, p] of Object.entries(plan)) {
    if (!p) continue;
    const parameters = {
      manual: {},
      noop: {},
      wait: { resume: 'webhook' },
      if: {},
      switch: { dataType: 'string', rules: { rules: (p.conds || []).slice(0, 4).map((c, i) => ({ value2: c, output: i })) } },
      merge: { mode: 'append' },
    }[p.kind];
    nodes.push({
      parameters,
      id: uuid(++n),
      name: p.name,
      ...T[p.kind],
      position: position(id),
      ...(p.notes ? { notes: p.notes, notesInFlow: true } : {}),
    });
  }
  const variantLabel = variant === 'as-is' ? 'AS-IS' : variant === 'to-be' ? 'TO-BE' : variant;
  const title = (processName || parsed.process_name || 'Process');
  nodes.push({
    parameters: {
      content: L.title.replace('{name}', title).replace('{variant}', variantLabel)
        + (removed.length ? L.removed.replace('{list}', removed.map(r => `- ${r}`).join('\n')) : ''),
      height: removed.length ? 240 + removed.length * 20 : 160,
      width: 420,
    },
    id: uuid(++n),
    name: 'Ailean note',
    ...T.sticky,
    position: [0, 40],
  });

  return {
    name: `${title} (${variantLabel})`,
    nodes,
    connections,
    active: false,
    settings: { executionOrder: 'v1' },
    pinData: {},
    meta: { templateCredsSetupCompleted: false },
  };
}
