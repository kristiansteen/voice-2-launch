let _elkInstance = null;

async function getElk() {
  if (!_elkInstance) {
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
    _elkInstance = new ELK();
  }
  return _elkInstance;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

const SIZES = {
  activity: { w: 140, h: 84 },
  gateway:  { w: 50,  h: 50 },
  event:    { w: 36,  h: 36 },
};

function elType(el, events, activities, gateways) {
  if (activities.find(a => a.id === el.id)) return 'activity';
  if (gateways.find(g => g.id === el.id))   return 'gateway';
  return 'event';
}

function makeNode(el, events, activities, gateways) {
  const { w, h } = SIZES[elType(el, events, activities, gateways)];
  return { id: el.id, width: w, height: h };
}

function extractWaypoints(edge) {
  if (!edge.sections?.length) return null;
  const pts = [];
  edge.sections.forEach(s => {
    pts.push([s.startPoint.x, s.startPoint.y]);
    (s.bendPoints || []).forEach(b => pts.push([b.x, b.y]));
    pts.push([s.endPoint.x, s.endPoint.y]);
  });
  // Deduplicate adjacent identical points
  return pts.filter((p, i) => !i || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
}

const LANE_OPTS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '70',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  // Rework loops make the graph cyclic. Break cycles by walking forward from the
  // start event, so loop-back arrows are the ones reversed and the process still
  // reads left to right. (The default greedy strategy can put the start mid-diagram.)
  'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  'elk.portConstraints': 'FREE',
  'elk.spacing.edgeEdge': '12',
  'elk.spacing.edgeNode': '16',
  'elk.padding': '[top=25,left=60,bottom=25,right=60]',
};

// ── Overlap separation ────────────────────────────────────────────────────────
// After layout, iteratively push apart any two elements whose bounding boxes
// overlap. Runs up to MAX_ITER times; usually converges in 1–2 passes.

const MAX_ITER = 10;
const OVERLAP_PAD = 20; // minimum gap between element edges

function getSize(id, events, activities, gateways) {
  if (activities.find(a => a.id === id)) return SIZES.activity;
  if (gateways.find(g => g.id === id))   return SIZES.gateway;
  return SIZES.event;
}

function separateOverlaps(positions, all, events, activities, gateways, elementLaneId, laneH) {
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let moved = false;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const pa = positions[a.id], pb = positions[b.id];
        if (!pa || !pb) continue;

        const sa = getSize(a.id, events, activities, gateways);
        const sb = getSize(b.id, events, activities, gateways);

        const overlapX = (sa.w + sb.w) / 2 + OVERLAP_PAD - Math.abs(pa.x - pb.x);
        const overlapY = (sa.h + sb.h) / 2 + OVERLAP_PAD - Math.abs(pa.y - pb.y);

        if (overlapX <= 0 || overlapY <= 0) continue; // no overlap

        moved = true;
        // Push apart along the axis of least overlap
        if (overlapX < overlapY) {
          const shift = overlapX / 2;
          if (pa.x <= pb.x) { pa.x -= shift; pb.x += shift; }
          else               { pa.x += shift; pb.x -= shift; }
        } else {
          // For swimlanes: clamp Y to stay within the lane bounds
          const shift = overlapY / 2;
          if (elementLaneId && laneH) {
            const laneAY = (Object.keys(elementLaneId).indexOf(a.id) >= 0)
              ? Math.round(pa.y / laneH) * laneH : 0;
            const halfLane = laneH / 2 - sa.h / 2 - 10;
            if (pa.y <= pb.y) {
              pa.y = Math.max(pa.y - shift, laneAY - halfLane);
              pb.y = Math.min(pb.y + shift, laneAY + laneH + halfLane);
            } else {
              pa.y = Math.min(pa.y + shift, laneAY + laneH + halfLane);
              pb.y = Math.max(pb.y - shift, laneAY - halfLane);
            }
          } else {
            if (pa.y <= pb.y) { pa.y -= shift; pb.y += shift; }
            else               { pa.y += shift; pb.y -= shift; }
          }
        }
      }
    }
    if (!moved) break;
  }
}

// ── Flat (no swimlanes) ───────────────────────────────────────────────────────

// Fallback grid layout when ELK fails — left-to-right topological sort
function gridFallback(parsed) {
  const { events, activities, gateways, sequence_flows } = parsed;
  const all = [...events, ...activities, ...gateways];
  const inDeg = Object.fromEntries(all.map(e => [e.id, 0]));
  const out = Object.fromEntries(all.map(e => [e.id, []]));
  sequence_flows.forEach(f => {
    if (out[f.from] !== undefined) out[f.from].push(f.to);
    if (inDeg[f.to] !== undefined) inDeg[f.to]++;
  });
  const queue = all.filter(e => inDeg[e.id] === 0).map(e => e.id);
  const order = [];
  const visited = new Set(queue);
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    (out[id] || []).forEach(nid => {
      if (!visited.has(nid)) { visited.add(nid); queue.push(nid); }
    });
  }
  all.forEach(e => { if (!visited.has(e.id)) order.push(e.id); });
  const positions = {};
  order.forEach((id, i) => { positions[id] = { x: 120 + i * 180, y: 300 }; });
  return { positions, waypoints: {} };
}

export async function flatLayout(parsed) {
  const { events, activities, gateways, sequence_flows } = parsed;
  const all = [...events, ...activities, ...gateways];
  const ids = new Set(all.map(e => e.id));

  const graph = {
    id: 'root',
    layoutOptions: {
      ...LANE_OPTS,
      'elk.padding': '[top=40,left=80,bottom=40,right=80]',
    },
    children: all.map(el => makeNode(el, events, activities, gateways)),
    edges: sequence_flows
      .filter(f => ids.has(f.from) && ids.has(f.to))
      .map(f => ({ id: f.id, sources: [f.from], targets: [f.to] })),
  };

  let layout;
  try {
    layout = await withTimeout((await getElk()).layout(graph), 8000, 'ELK flatLayout');
  } catch (err) {
    console.error('[elkLayout] ELK failed, using grid fallback:', err);
    return gridFallback(parsed);
  }

  const positions = {};
  layout.children.forEach(n => {
    positions[n.id] = { x: n.x + n.width / 2, y: n.y + n.height / 2 };
  });

  separateOverlaps(positions, all, events, activities, gateways, null, null);

  const waypoints = {};
  (layout.edges || []).forEach(e => {
    const pts = extractWaypoints(e);
    if (pts) waypoints[e.id] = pts;
  });

  return { positions, waypoints };
}

// ── Swimlane layout ───────────────────────────────────────────────────────────
// Strategy: run a single flat ELK layout across all nodes so that connected
// nodes land in the same column regardless of lane. X comes from ELK; Y comes
// from the lane. When two elements of the same lane share a column they get
// separate rows and the lane grows taller. ELK's own edge routes are discarded
// (they were computed for other Y positions); xmlGenerator routes all arrows
// with routeEdges() in the final coordinate space.
//
// All coordinates are multiples of 10 so they line up with the router grid.

const LANE_PAD = 40;   // free space above the first and below the last row of a lane
const ROW_H    = 120;  // one row of elements: 80px task + 40px for arrows between rows
const COL_GAP  = 40;   // elements of one lane closer than this horizontally need separate rows

const snap = v => Math.round(v / 10) * 10;

export async function swimlaneLayout(parsed, elementLaneId, lanes) {
  const { events, activities, gateways, sequence_flows } = parsed;
  const all = [...events, ...activities, ...gateways];
  const ids = new Set(all.map(e => e.id));

  // Single flat layout — ELK sees every node and every edge, so it assigns
  // consistent X column positions across lanes and separates gateway branches.
  let layout;
  try {
    layout = await withTimeout((await getElk()).layout({
      id: 'root',
      layoutOptions: {
        ...LANE_OPTS,
        'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        'elk.padding': '[top=40,left=80,bottom=40,right=80]',
      },
      children: all.map(el => makeNode(el, events, activities, gateways)),
      edges: sequence_flows
        .filter(f => ids.has(f.from) && ids.has(f.to))
        .map(f => ({ id: f.id, sources: [f.from], targets: [f.to] })),
    }), 8000, 'ELK swimlaneLayout');
  } catch (err) {
    console.error('[elkLayout swimlane] ELK failed:', err);
    throw err; // let generateBpmnXml fallback to flatLayout
  }

  // Row assignment within each lane, left to right. An element prefers the row
  // of a predecessor in the same lane (straight arrow); if that spot is taken
  // by an element in the same column it moves to the nearest free row.
  const laneIdx = Object.fromEntries(lanes.map((l, i) => [l.id, i]));
  const laneOf = id => laneIdx[elementLaneId[id]] ?? 0;
  const preds = {};
  sequence_flows.forEach(f => { (preds[f.to] ||= []).push(f.from); });

  const nodes = layout.children
    .map(n => ({ id: n.id, x: snap(n.x + n.width / 2), elkY: n.y, w: n.width, lane: laneOf(n.id) }))
    .sort((a, b) => a.x - b.x || a.elkY - b.elkY);

  const rowOf = {};
  const placed = lanes.map(() => []);
  const laneRows = lanes.map(() => 1);
  for (const n of nodes) {
    const taken = new Set(
      placed[n.lane]
        .filter(o => Math.abs(o.x - n.x) < (o.w + n.w) / 2 + COL_GAP)
        .map(o => rowOf[o.id])
    );
    const pred = (preds[n.id] || []).find(p => rowOf[p] !== undefined && laneOf(p) === n.lane);
    let row = pred !== undefined ? rowOf[pred] : 0;
    for (let k = 1; taken.has(row); k++) {
      const up = row - k, down = row + k;
      if (up >= 0 && !taken.has(up)) row = up;
      else if (!taken.has(down)) row = down;
    }
    rowOf[n.id] = row;
    placed[n.lane].push(n);
    laneRows[n.lane] = Math.max(laneRows[n.lane], row + 1);
  }

  // Lane boxes — all same width, stacked vertically, height by number of rows
  const totalW = Math.ceil((layout.width ?? 600) / 10) * 10;
  const laneBoxes = {};
  const laneTop = [];
  let y = 0;
  lanes.forEach((lane, i) => {
    const h = laneRows[i] * ROW_H + 2 * LANE_PAD;
    laneTop[i] = y;
    laneBoxes[lane.id] = { x: 0, y, w: totalW, h };
    y += h;
  });

  const positions = {};
  nodes.forEach(n => {
    positions[n.id] = { x: n.x, y: laneTop[n.lane] + LANE_PAD + rowOf[n.id] * ROW_H + ROW_H / 2 };
  });

  return { positions, waypoints: {}, laneBoxes };
}
