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
  if (elType === 'activity') return { w: 100, h: 80 };
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

// Returns waypoints for an orthogonal (90-degree) connection between two shapes.
// Entry/exit at the horizontal edges; mid-column bend when Y differs.
function orthogonalWaypoints(x1, y1, w1, x2, y2, w2) {
  const exitX = x1 + w1 / 2;
  const entryX = x2 - w2 / 2;
  const midX = Math.round((exitX + entryX) / 2);

  if (y1 === y2) {
    return [[exitX, y1], [entryX, y2]];
  }
  return [[exitX, y1], [midX, y1], [midX, y2], [entryX, y2]];
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

function generateFlatXml(parsed) {
  const { process_name, events, activities, gateways, sequence_flows } = parsed;
  const allElements = [...events, ...activities, ...gateways];
  const levels = calculateLevels(parsed);

  const byLevel = {};
  Object.entries(levels).forEach(([id, lvl]) => {
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(id);
  });

  const CENTER_Y = 300, X_START = 100, X_STEP = 180, Y_STEP = 120;
  const positions = {};
  Object.entries(byLevel).forEach(([lvl, ids]) => {
    const x = X_START + Number(lvl) * X_STEP;
    const startY = CENTER_Y - ((ids.length - 1) * Y_STEP) / 2;
    ids.forEach((id, i) => { positions[id] = { x, y: startY + i * Y_STEP }; });
  });

  const processElements = allElements.map(el =>
    `    <${getBpmnTag(el, events, activities, gateways)} id="${el.id}" name="${escapeXml(el.name)}" />`
  ).join('\n');

  const shapesXml = allElements.map(el => {
    const pos = positions[el.id] || { x: 100, y: 300 };
    const elTyp = elementType(el, events, activities, gateways);
    const { w, h } = getShapeSize(elTyp);
    const colorAttrs = elTyp === 'activity'
      ? ' bioc:stroke="#3d7a1f" bioc:fill="#65c434"'
      : elTyp === 'gateway'
        ? ' bioc:stroke="#0284c7" bioc:fill="#0ea5e9"'
        : '';
    return `      <bpmndi:BPMNShape id="${el.id}_di" bpmnElement="${el.id}"${colorAttrs}>
        <dc:Bounds x="${pos.x - w / 2}" y="${pos.y - h / 2}" width="${w}" height="${h}" />
      </bpmndi:BPMNShape>`;
  }).join('\n');

  const edgesXml = sequence_flows.map(f => {
    const fp = positions[f.from] || { x: 100, y: 300 };
    const tp = positions[f.to] || { x: 280, y: 300 };
    const { w: fw } = getElementSizeById(f.from, events, activities, gateways);
    const { w: tw } = getElementSizeById(f.to, events, activities, gateways);
    const pts = orthogonalWaypoints(fp.x, fp.y, fw, tp.x, tp.y, tw);
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

function generateSwimlanesXml(parsed) {
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

  events.forEach(e => { elementLaneId[e.id] = inferLane(e.id); });
  gateways.forEach(g => { elementLaneId[g.id] = inferLane(g.id); });

  // Build ordered lane list — only lanes that are actually used
  const usedIds = new Set(Object.values(elementLaneId));
  const lanes = [
    ...(usedIds.has('_general') ? [{ id: '_general', name: 'General' }] : []),
    ...roles.filter(r => usedIds.has(r.id)),
  ];
  const laneIdx = Object.fromEntries(lanes.map((l, i) => [l.id, i]));

  // Layout constants
  const POOL_X = 100;
  const POOL_Y = 80;
  const POOL_LABEL_W = 30;
  const LANE_LABEL_W = 150;
  const LANE_H = 200;
  const X_STEP = 200;
  const X_PAD = 80; // padding before first element

  const levels = calculateLevels(parsed);
  const maxLevel = Math.max(0, ...Object.values(levels));

  const POOL_W = POOL_LABEL_W + LANE_LABEL_W + (maxLevel + 1) * X_STEP + X_PAD;
  const POOL_H = lanes.length * LANE_H;

  const elX = id => POOL_X + POOL_LABEL_W + LANE_LABEL_W + X_PAD / 2 + (levels[id] || 0) * X_STEP;
  const elY = id => POOL_Y + (laneIdx[elementLaneId[id]] || 0) * LANE_H + LANE_H / 2;

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

  const laneShapes = lanes.map(lane => `      <bpmndi:BPMNShape id="${lane.id}_di" bpmnElement="${lane.id}" isHorizontal="true">
        <dc:Bounds x="${POOL_X + POOL_LABEL_W}" y="${POOL_Y + laneIdx[lane.id] * LANE_H}" width="${POOL_W - POOL_LABEL_W}" height="${LANE_H}" />
      </bpmndi:BPMNShape>`).join('\n');

  const elementShapes = allElements.map(el => {
    const cx = elX(el.id), cy = elY(el.id);
    const elTyp = elementType(el, events, activities, gateways);
    const { w, h } = getShapeSize(elTyp);
    const colorAttrs = elTyp === 'activity'
      ? ' bioc:stroke="#3d7a1f" bioc:fill="#65c434"'
      : elTyp === 'gateway'
        ? ' bioc:stroke="#0284c7" bioc:fill="#0ea5e9"'
        : '';
    return `      <bpmndi:BPMNShape id="${el.id}_di" bpmnElement="${el.id}"${colorAttrs}>
        <dc:Bounds x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" />
      </bpmndi:BPMNShape>`;
  }).join('\n');

  const edgesXml = sequence_flows.map(f => {
    const { w: fw } = getElementSizeById(f.from, events, activities, gateways);
    const { w: tw } = getElementSizeById(f.to, events, activities, gateways);
    const pts = orthogonalWaypoints(elX(f.from), elY(f.from), fw, elX(f.to), elY(f.to), tw);
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

export function generateBpmnXml(parsed) {
  const { roles, activities } = parsed;
  const hasRolesWithActivities = roles.some(r => activities.some(a => a.performer === r.id));
  return hasRolesWithActivities ? generateSwimlanesXml(parsed) : generateFlatXml(parsed);
}
