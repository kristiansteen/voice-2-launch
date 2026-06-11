let _elkInstance = null;

async function getElk() {
  if (!_elkInstance) {
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
    _elkInstance = new ELK();
  }
  return _elkInstance;
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
  'elk.spacing.nodeNode': '30',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  // FREE port constraints let ELK spread multiple outgoing edges across
  // different positions on the node boundary, preventing stacking on gateways.
  'elk.portConstraints': 'FREE',
  'elk.spacing.edgeEdge': '10',
  'elk.spacing.edgeNode': '12',
  'elk.padding': '[top=25,left=60,bottom=25,right=60]',
};

// ── Flat (no swimlanes) ───────────────────────────────────────────────────────

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

  const layout = await (await getElk()).layout(graph);

  const positions = {};
  layout.children.forEach(n => {
    positions[n.id] = { x: n.x + n.width / 2, y: n.y + n.height / 2 };
  });

  const waypoints = {};
  (layout.edges || []).forEach(e => {
    const pts = extractWaypoints(e);
    if (pts) waypoints[e.id] = pts;
  });

  return { positions, waypoints };
}

// ── Swimlane layout ───────────────────────────────────────────────────────────
// Strategy: run a single flat ELK layout across all nodes so that connected
// nodes land in the same column regardless of lane. Then snap each node's Y
// to the centre of its lane. ELK waypoints are discarded because they were
// computed for the original Y positions; xmlGenerator uses swimlaneRoute()
// instead, which produces clean orthogonal paths in the final coordinate space.

const LANE_H = 210; // height of each swimlane row

export async function swimlaneLayout(parsed, elementLaneId, lanes) {
  const { events, activities, gateways, sequence_flows } = parsed;
  const all = [...events, ...activities, ...gateways];
  const ids = new Set(all.map(e => e.id));

  // Single flat layout — ELK sees every node and every edge, so it assigns
  // consistent X column positions across lanes and separates gateway branches.
  const layout = await (await getElk()).layout({
    id: 'root',
    layoutOptions: {
      ...LANE_OPTS,
      'elk.padding': '[top=40,left=80,bottom=40,right=80]',
    },
    children: all.map(el => makeNode(el, events, activities, gateways)),
    edges: sequence_flows
      .filter(f => ids.has(f.from) && ids.has(f.to))
      .map(f => ({ id: f.id, sources: [f.from], targets: [f.to] })),
  });

  // X from ELK (centre), Y snapped to lane centre
  const laneIdx = Object.fromEntries(lanes.map((l, i) => [l.id, i]));
  const positions = {};
  layout.children.forEach(n => {
    const li = laneIdx[elementLaneId[n.id]] ?? 0;
    positions[n.id] = {
      x: n.x + n.width  / 2,
      y: li * LANE_H + LANE_H / 2,
    };
  });

  // Lane boxes — all same width, stacked vertically
  const totalW = Math.ceil(layout.width ?? 600);
  const laneBoxes = {};
  lanes.forEach((lane, i) => {
    laneBoxes[lane.id] = { x: 0, y: i * LANE_H, w: totalW, h: LANE_H };
  });

  // No ELK waypoints — swimlaneRoute() in xmlGenerator handles all edges
  return { positions, waypoints: {}, laneBoxes };
}

// ── Simple orthogonal router for swimlane edges ───────────────────────────────
// Cross-lane edges route via the lane boundary row (y between two lane centers)
// so the horizontal segment never passes through any activity box.
// Same-lane edges are straight; backward edges loop below both shapes.

const POOL_OFFSET_Y = 80; // must match OFFSET_Y in xmlGenerator.js
const HALF_GAP = 30;       // half of elk.layered.spacing.nodeNodeBetweenLayers (60)

export function swimlaneRoute(sx, sy, sw, sh, tx, ty, tw, th) {
  const exitX  = sx + sw / 2;
  const entryX = tx - tw / 2;

  // Same lane — straight horizontal
  if (Math.abs(sy - ty) < 5) {
    return [[exitX, sy], [entryX, ty]];
  }

  // Forward edge (left-to-right or negligibly backward in X)
  if (entryX >= exitX - 5) {
    // Bend at the lane boundary — no node is ever positioned there
    const relSrcY = sy - POOL_OFFSET_Y;
    const boundaryY = ty > sy
      ? Math.ceil(relSrcY / LANE_H) * LANE_H + POOL_OFFSET_Y   // bottom of source lane
      : Math.floor(relSrcY / LANE_H) * LANE_H + POOL_OFFSET_Y; // top of source lane

    const bendX1 = exitX + HALF_GAP;
    const bendX2 = entryX - HALF_GAP;

    if (bendX1 < bendX2) {
      // Full 6-point route via lane boundary
      return [
        [exitX,  sy],
        [bendX1, sy],
        [bendX1, boundaryY],
        [bendX2, boundaryY],
        [bendX2, ty],
        [entryX, ty],
      ];
    }
    // Source and target are close — simple L-bend (adjacent nodes, no obstacle in gap)
    const midX = (exitX + entryX) / 2;
    return [[exitX, sy], [midX, sy], [midX, ty], [entryX, ty]];
  }

  // Backward edge — loop below both shapes
  const botY = Math.max(sy + sh / 2, ty + th / 2) + 55;
  return [
    [exitX,        sy],
    [exitX  + 25,  sy],
    [exitX  + 25,  botY],
    [entryX - 25,  botY],
    [entryX - 25,  ty],
    [entryX,       ty],
  ];
}
