import test from 'node:test';
import assert from 'node:assert/strict';

import { generateBpmnXml } from '../src/services/xmlGenerator.js';
import { DEMO_PARSED } from '../src/data/demoFlow.js';
import { DA_DEMO_PARSED } from '../src/data/daDemoFlow.js';

// ── Geometry checks on generated BPMN DI ─────────────────────────────────────

function readDiagram(xml, parsed) {
  const laneIds = new Set((parsed.roles || []).map(r => r.id));
  const all = [...xml.matchAll(/<bpmndi:BPMNShape id="[^"]*" bpmnElement="([^"]*)"[^>]*>\s*<dc:Bounds x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)"/g)]
    .map(m => ({ id: m[1], x: +m[2], y: +m[3], w: +m[4], h: +m[5] }));
  const lanes = all.filter(s => laneIds.has(s.id));
  const shapes = all.filter(s => !laneIds.has(s.id) && s.id !== 'Participant_1');
  const flows = Object.fromEntries(parsed.sequence_flows.map(f => [f.id, f]));
  const edges = [...xml.matchAll(/<bpmndi:BPMNEdge id="[^"]*" bpmnElement="([^"]*)">([\s\S]*?)<\/bpmndi:BPMNEdge>/g)].map(m => ({
    id: m[1],
    pts: [...m[2].matchAll(/waypoint x="(-?\d+)" y="(-?\d+)"/g)].map(p => [+p[1], +p[2]]),
  }));
  const segs = [];
  edges.forEach(e => {
    for (let i = 0; i < e.pts.length - 1; i++) segs.push({ e: e.id, a: e.pts[i], b: e.pts[i + 1] });
  });
  return { lanes, shapes, flows, edges, segs };
}

function findDefects(xml, parsed) {
  const { lanes, shapes, flows, edges, segs } = readDiagram(xml, parsed);
  const d = { throughOther: [], throughOwn: [], sharedLine: [], diagonal: [], shapeOverlap: [], outsideLane: [], unattached: [], startNotFirst: [] };

  // Arrow segment passing through the interior of a shape (2px tolerance at the border)
  for (const s of segs) for (const sh of shapes) {
    const minX = Math.min(s.a[0], s.b[0]), maxX = Math.max(s.a[0], s.b[0]);
    const minY = Math.min(s.a[1], s.b[1]), maxY = Math.max(s.a[1], s.b[1]);
    if (maxX > sh.x + 2 && minX < sh.x + sh.w - 2 && maxY > sh.y + 2 && minY < sh.y + sh.h - 2) {
      const f = flows[s.e];
      (f.from === sh.id || f.to === sh.id ? d.throughOwn : d.throughOther).push(`${s.e} through ${sh.id}`);
    }
  }

  // Two arrows with no common source or target drawn on the same line for >10px
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const p = segs[i], q = segs[j];
    if (p.e === q.e) continue;
    const fp = flows[p.e], fq = flows[q.e];
    if (fp.from === fq.from || fp.to === fq.to) continue;
    let len = 0;
    if (p.a[1] === p.b[1] && q.a[1] === q.b[1] && Math.abs(p.a[1] - q.a[1]) < 4) {
      len = Math.min(Math.max(p.a[0], p.b[0]), Math.max(q.a[0], q.b[0])) - Math.max(Math.min(p.a[0], p.b[0]), Math.min(q.a[0], q.b[0]));
    }
    if (p.a[0] === p.b[0] && q.a[0] === q.b[0] && Math.abs(p.a[0] - q.a[0]) < 4) {
      len = Math.min(Math.max(p.a[1], p.b[1]), Math.max(q.a[1], q.b[1])) - Math.max(Math.min(p.a[1], p.b[1]), Math.min(q.a[1], q.b[1]));
    }
    if (len > 10) d.sharedLine.push(`${p.e} ~ ${q.e} (${Math.round(len)}px)`);
  }

  segs.forEach(s => { if (s.a[0] !== s.b[0] && s.a[1] !== s.b[1]) d.diagonal.push(s.e); });

  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    const a = shapes[i], b = shapes[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) d.shapeOverlap.push(`${a.id}/${b.id}`);
  }

  // Every element sits fully inside exactly one lane
  if (lanes.length) {
    shapes.forEach(sh => {
      const inside = lanes.some(l => sh.x >= l.x && sh.x + sh.w <= l.x + l.w && sh.y >= l.y && sh.y + sh.h <= l.y + l.h);
      if (!inside) d.outsideLane.push(sh.id);
    });
  }

  // Each arrow starts on its source's border and ends on its target's border
  const byId = Object.fromEntries(shapes.map(s => [s.id, s]));
  const onBorder = ([x, y], sh) =>
    x >= sh.x - 1 && x <= sh.x + sh.w + 1 && y >= sh.y - 1 && y <= sh.y + sh.h + 1 &&
    (Math.abs(x - sh.x) <= 1 || Math.abs(x - sh.x - sh.w) <= 1 || Math.abs(y - sh.y) <= 1 || Math.abs(y - sh.y - sh.h) <= 1);
  edges.forEach(e => {
    const f = flows[e.id];
    if (e.pts.length < 2 || !onBorder(e.pts[0], byId[f.from]) || !onBorder(e.pts.at(-1), byId[f.to])) d.unattached.push(e.id);
  });

  // The process reads left to right: nothing is placed left of the start event
  const startIds = new Set(parsed.events.filter(e => e.type === 'start').map(e => e.id));
  const starts = shapes.filter(s => startIds.has(s.id));
  if (starts.length) {
    const startX = Math.min(...starts.map(s => s.x));
    const left = shapes.filter(s => s.x + s.w / 2 < startX);
    if (left.length) d.startNotFirst.push(`${left.length} element(s) left of the start event, e.g. ${left[0].id}`);
  }

  return d;
}

// ── Synthetic interview-style processes (deterministic) ──────────────────────
// Main chain with XOR branches that rejoin, rework loops and early exits,
// spread over 2–5 roles — the shapes the LLM typically returns.

function makeProcess(seedInit) {
  let seed = seedInit;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const roles = Array.from({ length: 2 + Math.floor(rnd() * 4) }, (_, i) => ({ id: `role_${i + 1}`, name: `Role ${i + 1}` }));
  const events = [{ id: 'event_1', type: 'start', name: 'Start' }, { id: 'event_2', type: 'end', name: 'End' }];
  const activities = [], gateways = [], flows = [];
  let cur = 'event_1', lane = pick(roles).id;
  const act = () => {
    if (rnd() < 0.4) lane = pick(roles).id;
    const id = `act_${activities.length + 1}`;
    activities.push({ id, name: id, performer: lane });
    return id;
  };
  const gw = () => { const id = `gw_${gateways.length + 1}`; gateways.push({ id, type: 'exclusive', name: id }); return id; };
  const flow = (from, to, condition = null) => flows.push({ id: `flow_${flows.length + 1}`, from, to, condition });
  const steps = 6 + Math.floor(rnd() * 9);
  const chain = [];
  for (let i = 0; i < steps; i++) {
    const r = rnd();
    if (r < 0.22 && i > 1) {
      const g = gw(); flow(cur, g);
      const b1 = act(), b2 = act(); flow(g, b1, 'Yes'); flow(g, b2, 'No');
      const j = act(); flow(b1, j); flow(b2, j); cur = j;
    } else if (r < 0.36 && chain.length > 2) {
      const g = gw(); flow(cur, g);
      flow(g, chain[Math.max(0, chain.length - 2 - Math.floor(rnd() * 2))], 'Rework');
      const n = act(); flow(g, n, 'OK'); cur = n;
    } else if (r < 0.44 && i > 1) {
      const g = gw(); flow(cur, g);
      const ev = `event_${events.length + 1}`; events.push({ id: ev, type: 'end', name: ev }); flow(g, ev, 'Rejected');
      const n = act(); flow(g, n, 'OK'); cur = n;
    } else {
      const n = act(); flow(cur, n); cur = n;
    }
    chain.push(cur);
  }
  flow(cur, 'event_2');
  return { process_name: `Synthetic ${seedInit}`, roles, events, activities, gateways, sequence_flows: flows };
}

const CASES = [
  DEMO_PARSED,
  DA_DEMO_PARSED,
  ...Array.from({ length: 200 }, (_, i) => makeProcess(1000 + i * 7919)),
];

// Each diagram is generated and checked once per mode, then reused by every assertion
const cache = new Map();
function defectsFor(mode, transform) {
  if (!cache.has(mode)) {
    cache.set(mode, (async () => {
      const out = [];
      for (const parsed of CASES) {
        const p = transform(parsed);
        out.push({ name: p.process_name, defects: findDefects(await generateBpmnXml(p), p) });
      }
      return out;
    })());
  }
  return cache.get(mode);
}

async function collect(kind, mode = 'swimlane', transform = p => p) {
  return (await defectsFor(mode, transform))
    .filter(r => r.defects[kind].length)
    .map(r => `${r.name}: ${r.defects[kind].slice(0, 3).join(', ')}`);
}

const report = bad => `${bad.length} of ${CASES.length} diagrams, e.g.\n  ${bad.slice(0, 5).join('\n  ')}`;

test('swimlane diagram layout', async (t) => {
  await t.test('no arrow passes through another element', async () => {
    const bad = await collect('throughOther');
    assert.equal(bad.length, 0, report(bad));
  });
  await t.test('no arrow passes through its own source or target', async () => {
    const bad = await collect('throughOwn');
    assert.equal(bad.length, 0, report(bad));
  });
  await t.test('unrelated arrows never share a line', async () => {
    const bad = await collect('sharedLine');
    assert.equal(bad.length, 0, report(bad));
  });
  await t.test('all arrow segments are horizontal or vertical', async () => {
    const bad = await collect('diagonal');
    assert.equal(bad.length, 0, report(bad));
  });
  await t.test('elements never overlap each other', async () => {
    const bad = await collect('shapeOverlap');
    assert.equal(bad.length, 0, report(bad));
  });
  await t.test('every element sits inside a lane', async () => {
    const bad = await collect('outsideLane');
    assert.equal(bad.length, 0, report(bad));
  });
  await t.test('the start event is the leftmost element', async () => {
    const bad = await collect('startNotFirst');
    assert.equal(bad.length, 0, report(bad));
  });
  await t.test('every arrow is attached to its source and target', async () => {
    const bad = await collect('unattached');
    assert.equal(bad.length, 0, report(bad));
  });
});

test('flat diagram layout (no roles)', async (t) => {
  const flat = p => ({ ...p, roles: [] });
  await t.test('no arrow passes through another element', async () => {
    const bad = await collect('throughOther', 'flat', flat);
    assert.equal(bad.length, 0, report(bad));
  });
  await t.test('unrelated arrows never share a line', async () => {
    const bad = await collect('sharedLine', 'flat', flat);
    assert.equal(bad.length, 0, report(bad));
  });
  await t.test('the start event is the leftmost element', async () => {
    const bad = await collect('startNotFirst', 'flat', flat);
    assert.equal(bad.length, 0, report(bad));
  });
  await t.test('elements never overlap each other', async () => {
    const bad = await collect('shapeOverlap', 'flat', flat);
    assert.equal(bad.length, 0, report(bad));
  });
});
