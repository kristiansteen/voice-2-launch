import { roleColor } from '../bpmn/roleColors.js';
import { flatLayout, swimlaneLayout } from '../bpmn/elkLayout.js';

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function calculateLevels(parsed) {
  const { events, activities, gateways, sequence_flows } = parsed;
  const elementMap = {};
  events.forEach(e => (elementMap[e.id] = e));
  activities.forEach(a => (elementMap[a.id] = a));
  gateways.forEach(g => (elementMap[g.id] = g));

  const outEdges = {};
  const inDegree = {};
  Object.keys(elementMap).forEach(id => { outEdges[id] = []; inDegree[id] = 0; });

  sequence_flows.forEach(f => {
    if (outEdges[f.from] !== undefined) outEdges[f.from].push(f.to);
    if (inDegree[f.to] !== undefined) inDegree[f.to]++;
  });

  const levels = {};
  const roots = Object.keys(elementMap).filter(id => inDegree[id] === 0);
  roots.forEach(id => (levels[id] = 0));
  const visited = new Set(roots);
  const queue = [...roots];

  while (queue.length) {
    const id = queue.shift();
    (outEdges[id] || []).forEach(toId => {
      const lvl = (levels[id] || 0) + 1;
      if (levels[toId] === undefined || levels[toId] < lvl) levels[toId] = lvl;
      if (!visited.has(toId)) { visited.add(toId); queue.push(toId); }
    });
  }

  Object.keys(elementMap).forEach(id => { if (levels[id] === undefined) levels[id] = 0; });
  return levels;
}

function getBpmnTag(el, events, activities, gateways) {
  const evt = events.find(e => e.id === el.id);
  if (evt) {
    if (evt.type === 'start') return 'startEvent';
    if (evt.type === 'end') return 'endEvent';
    return 'intermediateCatchEvent';
  }
  if (activities.find(a => a.id === el.id)) return 'userTask';
  const gw = gateways.find(g => g.id === el.id);
  if (gw) {
    if (gw.type === 'parallel') return 'parallelGateway';
    if (gw.type === 'inclusive') return 'inclusiveGateway';
    return 'exclusiveGateway';
  }
  return 'task';
}

function getShapeSize(elType) {
  if (elType === 'activity') return { w: 140, h: 80 };
  if (elType === 'gateway') return { w: 50, h: 50 };
  return { w: 36, h: 36 };
}

function elementType(el, events, activities, gateways) {
  if (activities.find(a => a.id === el.id)) return 'activity';
  if (gateways.find(g => g.id === el.id)) return 'gateway';
  return 'event';
}

function getElementSizeById(id, events, activities, gateways) {
  if (activities.find(a => a.id === id)) return getShapeSize('activity');
  if (gateways.find(g => g.id === id)) return getShapeSize('gateway');
  return getShapeSize('event');
}

// ── Obstacle-aware connection router ─────────────────────────────────────────

// Segment-AABB collision: checks if a horizontal or vertical segment hits a rect (with padding).
function segmentHitsRect(x1, y1, x2, y2, bx, by, bw, bh, pad) {
  const isHoriz = Math.abs(y2 - y1) < 0.5;
  if (isHoriz) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    return (
      y1 >= by - pad && y1 <= by + bh + pad &&
      maxX >= bx - pad && minX <= bx + bw + pad
    );
  }
  // Vertical
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  return (
    x1 >= bx - pad && x1 <= bx + bw + pad &&
    maxY >= by - pad && minY <= by + bh + pad
  );
}

// Check whether a multi-segment route (array of [x,y] pairs) is clear of all
// obstacles (except the source and target shapes).
function routeIsClear(pts, obstacles, pad = 15) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    for (const o of obstacles) {
      if (segmentHitsRect(ax, ay, bx, by, o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, pad)) return false;
    }
  }
  return true;
}

// Obstacle-aware orthogonal router.
//
// allShapesPositions: array of { id, x, y, w, h } (centers). Source and target
// are excluded from collision tests.
//
// Tries candidates in order:
//  1. Straight — aligned horizontally or vertically
//  2. Single L-bend — exit right, bend in inter-column gap, enter target left
//  3. Mid-gap channel — vertical segment at exact midpoint between the two shapes
//  4. Backward loop — route below both shapes so loops don't overlap pool headers
//  5. Over-the-top fallback
function orthogonalWaypoints(x1, y1, w1, h1, x2, y2, w2, h2, allShapesPositions, srcId, tgtId) {
  const obstacles = (allShapesPositions || []).filter(s => s.id !== srcId && s.id !== tgtId);

  const exitX  = x1 + w1 / 2;
  const entryX = x2 - w2 / 2;

  // 1. Straight — same row or same column
  if (Math.abs(y1 - y2) < 1) {
    const route = [[exitX, y1], [entryX, y2]];
    if (routeIsClear(route, obstacles)) return route;
  }
  if (Math.abs(x1 - x2) < 5) {
    const route = y1 < y2
      ? [[x1, y1 + h1 / 2], [x2, y2 - h2 / 2]]
      : [[x1, y1 - h1 / 2], [x2, y2 + h2 / 2]];
    if (routeIsClear(route, obstacles)) return route;
  }

  // 2. Forward L-bend — bend 30px past exit (more clearance than 15px)
  if (x2 > x1) {
    const bendX = exitX + 30;
    const route = [[exitX, y1], [bendX, y1], [bendX, y2], [entryX, y2]];
    if (routeIsClear(route, obstacles)) return route;

    // 3. Mid-gap channel — vertical at midpoint between source right and target left
    const channelX = (exitX + entryX) / 2;
    const channelRoute = [[exitX, y1], [channelX, y1], [channelX, y2], [entryX, y2]];
    if (routeIsClear(channelRoute, obstacles)) return channelRoute;
  }

  // 4. Backward / loop flow — route BELOW both shapes so loops stay out of pool headers
  if (x2 <= x1) {
    const botY = Math.max(y1 + h1 / 2, y2 + h2 / 2) + 45;
    return [
      [exitX,           y1],
      [exitX + 20,      y1],
      [exitX + 20,      botY],
      [x2 - w2 / 2 - 20, botY],
      [x2 - w2 / 2 - 20, y2],
      [x2 - w2 / 2,    y2],
    ];
  }

  // 5. Over-the-top fallback — route above the bounding box of all shapes
  const allYs = (allShapesPositions || []).map(s => s.y - s.h / 2);
  const overY = Math.min(...allYs, y1 - h1 / 2, y2 - h2 / 2) - 50;
  return [
    [exitX,  y1],
    [exitX,  overY],
    [entryX, overY],
    [entryX, y2],
  ];
}

function waypointsXml(points) {
  return points.map(([x, y]) => `        <di:waypoint x="${Math.round(x)}" y="${Math.round(y)}" />`).join('\n');
}

function flowsXml(sequence_flows) {
  return sequence_flows.map(f => {
    const cond = f.condition
      ? `\n      <conditionExpression>${escapeXml(f.condition)}</conditionExpression>\n    `
      : '';
    return `    <sequenceFlow id="${f.id}" sourceRef="${f.from}" targetRef="${f.to}">${cond}</sequenceFlow>`;
  }).join('\n');
}

// ─── Flat (no swimlanes) ──────────────────────────────────────────────────────

async function generateFlatXml(parsed) {
  const { process_name, events, activities, gateways, sequence_flows } = parsed;
  const allElements = [...events, ...activities, ...gateways];

  const { positions, waypoints } = await flatLayout(parsed);

  const processElements = allElements.map(el =>
    `    <${getBpmnTag(el, events, activities, gateways)} id="${el.id}" name="${escapeXml(el.name)}" />`
  ).join('\n');

  const allShapesPositions = allElements.map(el => {
    const pos = positions[el.id] || { x: 100, y: 300 };
    const elTyp = elementType(el, events, activities, gateways);
    const { w, h } = getShapeSize(elTyp);
    return { id: el.id, x: pos.x, y: pos.y, w, h };
  });

  const shapesXml = allElements.map(el => {
    const pos = positions[el.id] || { x: 100, y: 300 };
    const elTyp = elementType(el, events, activities, gateways);
    const { w, h } = getShapeSize(elTyp);
    let colorAttrs = '';
    if (elTyp === 'activity') {
      const act = activities.find(a => a.id === el.id);
      const stroke = roleColor(act && act.performer);
      colorAttrs = ` bioc:stroke="${stroke}" bioc:fill="#ffffff"`;
    } else if (elTyp === 'gateway') {
      colorAttrs = ' bioc:stroke="#B86C3D" bioc:fill="#fff4e6"';
    }
    return `      <bpmndi:BPMNShape id="${el.id}_di" bpmnElement="${el.id}"${colorAttrs}>
        <dc:Bounds x="${Math.round(pos.x - w / 2)}" y="${Math.round(pos.y - h / 2)}" width="${w}" height="${h}" />
      </bpmndi:BPMNShape>`;
  }).join('\n');

  const edgesXml = sequence_flows.map(f => {
    const fp = positions[f.from] || { x: 100, y: 300 };
    const tp = positions[f.to]   || { x: 280, y: 300 };
    const { w: fw, h: fh } = getElementSizeById(f.from, events, activities, gateways);
    const { w: tw, h: th } = getElementSizeById(f.to,   events, activities, gateways);
    const pts = waypoints[f.id] ||
      orthogonalWaypoints(fp.x, fp.y, fw, fh, tp.x, tp.y, tw, th, allShapesPositions, f.from, f.to);
    return `      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">
${waypointsXml(pts)}
      </bpmndi:BPMNEdge>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_1" name="${escapeXml(process_name)}" isExecutable="false">
${processElements}
${flowsXml(sequence_flows)}
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
${shapesXml}
${edgesXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;
}

// ─── Swimlanes ────────────────────────────────────────────────────────────────

async function generateSwimlanesXml(parsed) {
  const { process_name, roles, events, activities, gateways, sequence_flows } = parsed;
  const allElements = [...events, ...activities, ...gateways];
  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]));

  // Assign each element to a lane id
  const elementLaneId = {};
  activities.forEach(a => {
    elementLaneId[a.id] = (a.performer && roleMap[a.performer]) ? a.performer : '_general';
  });
  function inferLane(elemId) {
    for (const f of sequence_flows) {
      if (f.to === elemId && elementLaneId[f.from]) return elementLaneId[f.from];
    }
    for (const f of sequence_flows) {
      if (f.from === elemId && elementLaneId[f.to]) return elementLaneId[f.to];
    }
    return '_general';
  }
  events.forEach(e   => { elementLaneId[e.id] = inferLane(e.id); });
  gateways.forEach(g => { elementLaneId[g.id] = inferLane(g.id); });

  // Build ordered lane list — only lanes that are actually used
  const usedIds = new Set(Object.values(elementLaneId));
  const lanes = [
    ...(usedIds.has('_general') ? [{ id: '_general', name: 'General' }] : []),
    ...roles.filter(r => usedIds.has(r.id)),
  ];

  // ELK layout — positions are relative to the inner layout area
  const { positions: elkPos, waypoints: elkWp, laneBoxes } =
    await swimlaneLayout(parsed, elementLaneId, lanes);

  // Canvas offsets (pool label + lane label columns + top margin)
  const POOL_X       = 100;
  const POOL_Y       = 80;
  const POOL_LABEL_W = 30;
  const LANE_LABEL_W = 150;
  const OFFSET_X     = POOL_X + POOL_LABEL_W + LANE_LABEL_W;
  const OFFSET_Y     = POOL_Y;

  // Absolute positions for BPMN elements
  const absPos = (id) => {
    const p = elkPos[id] || { x: 0, y: 0 };
    return { x: p.x + OFFSET_X, y: p.y + OFFSET_Y };
  };

  // Pool / lane dimensions from ELK output
  const totalW = Math.max(...Object.values(laneBoxes).map(b => b.w), 600);
  const totalH = Object.values(laneBoxes).reduce((s, b) => Math.max(s, b.y + b.h), 0);
  const POOL_W = POOL_LABEL_W + LANE_LABEL_W + totalW;
  const POOL_H = totalH;

  // Process elements
  const processElementsXml = allElements.map(el =>
    `    <${getBpmnTag(el, events, activities, gateways)} id="${el.id}" name="${escapeXml(el.name)}" />`
  ).join('\n');

  const laneSetXml = `    <laneSet id="LaneSet_1">
${lanes.map(lane => {
    const refs = allElements
      .filter(el => elementLaneId[el.id] === lane.id)
      .map(el => `        <flowNodeRef>${el.id}</flowNodeRef>`)
      .join('\n');
    return `      <lane id="${lane.id}" name="${escapeXml(lane.name)}">
${refs}
      </lane>`;
  }).join('\n')}
    </laneSet>`;

  // Diagram shapes
  const poolShape = `      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="${POOL_X}" y="${POOL_Y}" width="${POOL_W}" height="${POOL_H}" />
      </bpmndi:BPMNShape>`;

  const laneShapes = lanes.map(lane => {
    const box = laneBoxes[lane.id] || { y: 0, h: 200 };
    return `      <bpmndi:BPMNShape id="${lane.id}_di" bpmnElement="${lane.id}" isHorizontal="true">
        <dc:Bounds x="${POOL_X + POOL_LABEL_W}" y="${POOL_Y + box.y}" width="${POOL_W - POOL_LABEL_W}" height="${box.h}" />
      </bpmndi:BPMNShape>`;
  }).join('\n');

  const allShapesPositions = allElements.map(el => {
    const { x, y } = absPos(el.id);
    const elTyp = elementType(el, events, activities, gateways);
    const { w, h } = getShapeSize(elTyp);
    return { id: el.id, x, y, w, h };
  });

  const elementShapes = allElements.map(el => {
    const { x: cx, y: cy } = absPos(el.id);
    const elTyp = elementType(el, events, activities, gateways);
    const { w, h } = getShapeSize(elTyp);
    let colorAttrs = '';
    if (elTyp === 'activity') {
      const act = activities.find(a => a.id === el.id);
      const stroke = roleColor(act && act.performer);
      colorAttrs = ` bioc:stroke="${stroke}" bioc:fill="#ffffff"`;
    } else if (elTyp === 'gateway') {
      colorAttrs = ' bioc:stroke="#B86C3D" bioc:fill="#fff4e6"';
    }
    return `      <bpmndi:BPMNShape id="${el.id}_di" bpmnElement="${el.id}"${colorAttrs}>
        <dc:Bounds x="${Math.round(cx - w / 2)}" y="${Math.round(cy - h / 2)}" width="${w}" height="${h}" />
      </bpmndi:BPMNShape>`;
  }).join('\n');

  const edgesXml = sequence_flows.map(f => {
    const { x: fx, y: fy } = absPos(f.from);
    const { x: tx, y: ty } = absPos(f.to);
    const { w: fw, h: fh } = getElementSizeById(f.from, events, activities, gateways);
    const { w: tw, h: th } = getElementSizeById(f.to,   events, activities, gateways);
    const pts = elkWp[f.id] || orthogonalWaypoints(fx, fy, fw, fh, tx, ty, tw, th, allShapesPositions, f.from, f.to);
    return `      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">
${waypointsXml(pts)}
      </bpmndi:BPMNEdge>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
             xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0"
             targetNamespace="http://bpmn.io/schema/bpmn">
  <collaboration id="Collaboration_1">
    <participant id="Participant_1" name="${escapeXml(process_name)}" processRef="Process_1" />
  </collaboration>
  <process id="Process_1" isExecutable="false">
${laneSetXml}
${processElementsXml}
${flowsXml(sequence_flows)}
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
${poolShape}
${laneShapes}
${elementShapes}
${edgesXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function generateBpmnXml(parsed) {
  const { roles, activities } = parsed;
  const hasRolesWithActivities = roles.some(r => activities.some(a => a.performer === r.id));
  return hasRolesWithActivities ? generateSwimlanesXml(parsed) : generateFlatXml(parsed);
}
