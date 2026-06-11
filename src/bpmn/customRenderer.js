import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import { append as svgAppend, attr as svgAttr, create as svgCreate } from 'tiny-svg';
import { getRoundRectPath } from 'bpmn-js/lib/draw/BpmnRenderUtil';
import { is } from 'bpmn-js/lib/util/ModelUtil';

// ── Brand palette ────────────────────────────────────────────────────────────

const BRAND = {
  purple:     '#9D6BCF',
  teal:       '#5AC8D2',
  cobalt:     '#4A69E1',
  green:      '#89C44A',
  crimson:    '#D83D41',
  bronze:     '#B86C3D',
  periwinkle: '#7E8CC1',
  amber:      '#C07830',
  obsidian:   '#0A0A0B',
  plum:       '#4A2C5A',
};

// ── Constants ────────────────────────────────────────────────────────────────

const FONT = 'Inter, -apple-system, sans-serif';

const TASK_W      = 140;
const TASK_H      = 84;
const TASK_RADIUS = 10;
const ACCENT_W    = 5;

const EVENT_R = 20;
const GW_SIZE = 50;

// ── SVG filter: drop shadow (inserted once per SVG) ─────────────────────────

let _filterId = 0;
function ensureDropShadowFilter(parentNode) {
  let root = parentNode;
  while (root && root.tagName !== 'svg') root = root.parentNode;
  if (!root) return 'none';

  const existingId = root._customDropShadow;
  if (existingId) return existingId;

  const id = `customDropShadow${++_filterId}`;
  root._customDropShadow = id;

  const defs = svgCreate('defs');
  const filter = svgCreate('filter');
  svgAttr(filter, { id, x: '-25%', y: '-25%', width: '150%', height: '150%' });

  const blur = svgCreate('feGaussianBlur');
  svgAttr(blur, { in: 'SourceAlpha', stdDeviation: 4 });

  const offset = svgCreate('feOffset');
  svgAttr(offset, { dx: 0, dy: 3 });

  const flood = svgCreate('feFlood');
  svgAttr(flood, { 'flood-color': '#0A0A0B', 'flood-opacity': 0.10 });

  const composite = svgCreate('feComposite');
  svgAttr(composite, { in2: 'SourceAlpha', operator: 'in' });

  const merge = svgCreate('feMerge');
  const mergeNode1 = svgCreate('feMergeNode');
  const mergeNode2 = svgCreate('feMergeNode');
  svgAttr(mergeNode2, { in: 'SourceGraphic' });

  svgAppend(merge, mergeNode1);
  svgAppend(merge, mergeNode2);

  [blur, offset, flood, composite, merge].forEach(n => svgAppend(filter, n));
  svgAppend(defs, filter);
  svgAppend(root, defs);

  return id;
}

// ── Text helpers ─────────────────────────────────────────────────────────────

function wrapText(text, maxPx, fontSize) {
  const charPx = fontSize * 0.6;
  const maxChars = Math.floor(maxPx / charPx);
  const words = (text || '').split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function appendWrappedText(parentNode, text, cx, cy, opts = {}) {
  const {
    fontSize = 12,
    fontWeight = 500,
    fill = '#1e293b',
    maxWidth = TASK_W - 24,
    anchor = 'middle',
    maxLines = 2,
  } = opts;

  const lines = wrapText(text, maxWidth, fontSize);
  const display = lines.length > maxLines
    ? [...lines.slice(0, maxLines - 1), lines[maxLines - 1].slice(0, -1) + '…']
    : lines;

  const lineH = fontSize * 1.4;
  const totalH = display.length * lineH;
  const startY = cy - totalH / 2 + lineH / 2;

  display.forEach((line, i) => {
    const tEl = svgCreate('text');
    svgAttr(tEl, {
      x: cx,
      y: startY + i * lineH,
      'text-anchor': anchor,
      'dominant-baseline': 'central',
      'font-family': FONT,
      'font-size': fontSize,
      'font-weight': fontWeight,
      fill,
    });
    tEl.textContent = line;
    svgAppend(parentNode, tEl);
  });
}

// ── Accent color from DI ─────────────────────────────────────────────────────

function getAccentColor(element) {
  try {
    const di = element.businessObject && element.businessObject.di;
    if (di) {
      if (typeof di.stroke === 'string') return di.stroke;
      if (di.$attrs && di.$attrs['bioc:stroke']) return di.$attrs['bioc:stroke'];
    }
  } catch { /* ignore */ }
  return BRAND.periwinkle;
}

// ── Hex → light tint (blend toward white) ───────────────────────────────────

function hexTint(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const tr = Math.round(r + (255 - r) * (1 - opacity));
  const tg = Math.round(g + (255 - g) * (1 - opacity));
  const tb = Math.round(b + (255 - b) * (1 - opacity));
  return `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`;
}

// ── Custom Renderer ──────────────────────────────────────────────────────────

class CustomRenderer extends BaseRenderer {
  constructor(eventBus, bpmnRenderer) {
    super(eventBus, 2000);
    this.bpmnRenderer = bpmnRenderer;
  }

  canRender(element) {
    // Intercept label elements for events and gateways so bpmnRenderer
    // doesn't draw a second copy of the text we already render inline.
    if (element.labelTarget) {
      return (
        is(element.labelTarget, 'bpmn:Event') ||
        is(element.labelTarget, 'bpmn:Gateway')
      );
    }
    return true;
  }

  drawShape(parentNode, element) {
    // Suppress the separate label element for events/gateways — text is drawn inline.
    if (element.labelTarget) return svgCreate('g');

    if (
      is(element, 'bpmn:Task') ||
      is(element, 'bpmn:UserTask') ||
      is(element, 'bpmn:ManualTask') ||
      is(element, 'bpmn:ServiceTask') ||
      is(element, 'bpmn:SendTask') ||
      is(element, 'bpmn:ReceiveTask') ||
      is(element, 'bpmn:ScriptTask') ||
      is(element, 'bpmn:BusinessRuleTask')
    ) return this._drawTask(parentNode, element);

    if (is(element, 'bpmn:StartEvent'))       return this._drawEvent(parentNode, element, 'start');
    if (is(element, 'bpmn:EndEvent'))         return this._drawEvent(parentNode, element, 'end');
    if (
      is(element, 'bpmn:IntermediateCatchEvent') ||
      is(element, 'bpmn:IntermediateThrowEvent')
    ) return this._drawEvent(parentNode, element, 'intermediate');

    if (is(element, 'bpmn:ExclusiveGateway')) return this._drawGateway(parentNode, element, 'exclusive');
    if (is(element, 'bpmn:ParallelGateway'))  return this._drawGateway(parentNode, element, 'parallel');
    if (is(element, 'bpmn:InclusiveGateway')) return this._drawGateway(parentNode, element, 'inclusive');

    return this.bpmnRenderer.drawShape(parentNode, element);
  }

  drawConnection(parentNode, element) {
    if (is(element, 'bpmn:SequenceFlow')) {
      return this._drawSequenceFlow(parentNode, element);
    }
    return this.bpmnRenderer.drawConnection(parentNode, element);
  }

  getShapePath(shape) {
    if (
      is(shape, 'bpmn:Task') || is(shape, 'bpmn:UserTask') || is(shape, 'bpmn:ManualTask') ||
      is(shape, 'bpmn:ServiceTask') || is(shape, 'bpmn:SendTask') || is(shape, 'bpmn:ReceiveTask') ||
      is(shape, 'bpmn:ScriptTask') || is(shape, 'bpmn:BusinessRuleTask')
    ) return getRoundRectPath(shape, TASK_RADIUS);
    return this.bpmnRenderer.getShapePath(shape);
  }

  // ── Task ──────────────────────────────────────────────────────────────────

  _drawTask(parentNode, element) {
    const { width: w = TASK_W, height: h = TASK_H } = element;
    const accent = getAccentColor(element);
    const tint   = hexTint(accent, 0.07); // very subtle bg tint
    const filterId = ensureDropShadowFilter(parentNode);

    // Base rect with tinted fill
    const rect = svgCreate('rect');
    svgAttr(rect, {
      x: 0, y: 0, width: w, height: h,
      rx: TASK_RADIUS, ry: TASK_RADIUS,
      fill: tint,
      stroke: hexTint(accent, 0.55),
      'stroke-width': 1,
      filter: filterId !== 'none' ? `url(#${filterId})` : undefined,
    });
    svgAppend(parentNode, rect);

    // Left accent bar — clipped via two rects
    const bar = svgCreate('rect');
    svgAttr(bar, {
      x: 0, y: 0, width: ACCENT_W, height: h,
      rx: TASK_RADIUS, ry: TASK_RADIUS,
      fill: accent,
    });
    svgAppend(parentNode, bar);

    const cover = svgCreate('rect');
    svgAttr(cover, {
      x: ACCENT_W, y: 0, width: ACCENT_W, height: h,
      fill: tint,
    });
    svgAppend(parentNode, cover);

    const name = (element.businessObject && element.businessObject.name) || '';
    const labelX = ACCENT_W + 4 + (w - ACCENT_W - 14) / 2;
    appendWrappedText(parentNode, name, labelX, h / 2, {
      fontSize: 12,
      fontWeight: 500,
      fill: '#1e293b',
      maxWidth: w - ACCENT_W - 18,
      maxLines: 3,
    });

    return rect;
  }

  // ── Event ─────────────────────────────────────────────────────────────────

  _drawEvent(parentNode, element, kind) {
    const cx = element.width / 2;
    const cy = element.height / 2;

    let strokeColor, fillColor, strokeWidth;
    if (kind === 'start') {
      strokeColor = BRAND.green;
      fillColor   = hexTint(BRAND.green, 0.12);
      strokeWidth = 2.5;
    } else if (kind === 'end') {
      strokeColor = BRAND.crimson;
      fillColor   = hexTint(BRAND.crimson, 0.10);
      strokeWidth = 3.5;
    } else {
      strokeColor = BRAND.amber;
      fillColor   = hexTint(BRAND.amber, 0.10);
      strokeWidth = 2;
    }

    const outer = svgCreate('circle');
    svgAttr(outer, {
      cx, cy, r: EVENT_R,
      fill: fillColor,
      stroke: strokeColor,
      'stroke-width': strokeWidth,
    });
    svgAppend(parentNode, outer);

    if (kind === 'intermediate') {
      const inner = svgCreate('circle');
      svgAttr(inner, {
        cx, cy, r: EVENT_R - 4,
        fill: 'none',
        stroke: strokeColor,
        'stroke-width': 1.5,
      });
      svgAppend(parentNode, inner);
    }

    if (kind === 'end') {
      // Filled inner disc
      const disc = svgCreate('circle');
      svgAttr(disc, {
        cx, cy, r: EVENT_R - 6,
        fill: strokeColor,
        'fill-opacity': 0.25,
      });
      svgAppend(parentNode, disc);
    }

    const name = (element.businessObject && element.businessObject.name) || '';
    if (name) {
      appendWrappedText(parentNode, name, cx, cy + EVENT_R + 10, {
        fontSize: 10,
        fontWeight: 600,
        fill: strokeColor,
        maxWidth: 90,
        maxLines: 2,
      });
    }

    return outer;
  }

  // ── Gateway ───────────────────────────────────────────────────────────────

  _drawGateway(parentNode, element, kind) {
    const hw = GW_SIZE / 2;
    const cx = element.width / 2;
    const cy = element.height / 2;

    const diamond = svgCreate('path');
    svgAttr(diamond, {
      d: `M ${cx},${cy - hw} L ${cx + hw},${cy} L ${cx},${cy + hw} L ${cx - hw},${cy} Z`,
      fill: hexTint(BRAND.amber, 0.10),
      stroke: BRAND.bronze,
      'stroke-width': 2,
    });
    svgAppend(parentNode, diamond);

    const symbol = kind === 'exclusive' ? '×' : kind === 'parallel' ? '+' : '○';
    const sym = svgCreate('text');
    svgAttr(sym, {
      x: cx, y: cy,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-family': FONT,
      'font-size': 18,
      'font-weight': 700,
      fill: BRAND.bronze,
    });
    sym.textContent = symbol;
    svgAppend(parentNode, sym);

    const name = (element.businessObject && element.businessObject.name) || '';
    if (name) {
      appendWrappedText(parentNode, name, cx, cy - hw - 10, {
        fontSize: 10,
        fontWeight: 600,
        fill: BRAND.bronze,
        maxWidth: 100,
        maxLines: 2,
      });
    }

    return diamond;
  }

  // ── Sequence flow ─────────────────────────────────────────────────────────

  _drawSequenceFlow(parentNode, element) {
    const waypoints = element.waypoints || [];
    if (waypoints.length < 2) return this.bpmnRenderer.drawConnection(parentNode, element);

    const d = buildRoundedPath(waypoints, 8);
    const markerId = ensureArrowMarker(parentNode, BRAND.periwinkle);

    const path = svgCreate('path');
    svgAttr(path, {
      d,
      fill: 'none',
      stroke: BRAND.periwinkle,
      'stroke-width': 1.5,
      'marker-end': `url(#${markerId})`,
    });
    svgAppend(parentNode, path);

    const condExpr = element.businessObject
      && element.businessObject.conditionExpression
      && element.businessObject.conditionExpression.body;
    if (condExpr) {
      // Place label at the midpoint of the longest segment (not a bend point)
      let maxLen = 0, lx = 0, ly = 0, isHoriz = true;
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i], p2 = waypoints[i + 1];
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (len > maxLen) {
          maxLen = len;
          lx = (p1.x + p2.x) / 2;
          ly = (p1.y + p2.y) / 2;
          isHoriz = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x);
        }
      }
      // Offset label off the line so it doesn't sit on top of it
      if (isHoriz) ly -= 12; else lx += 12;
      _drawConditionPill(parentNode, String(condExpr), lx, ly);
    }

    return path;
  }
}

// ── Path helpers ─────────────────────────────────────────────────────────────

function buildRoundedPath(pts, cornerR) {
  if (pts.length < 2) return '';
  const parts = [`M ${r(pts[0].x)},${r(pts[0].y)}`];

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur  = pts[i];
    const next = i < pts.length - 1 ? pts[i + 1] : null;

    if (!next) {
      parts.push(`L ${r(cur.x)},${r(cur.y)}`);
      continue;
    }

    const dx1 = cur.x - prev.x, dy1 = cur.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
    const t1   = Math.min(cornerR, len1 / 2) / len1;

    const dx2 = next.x - cur.x, dy2 = next.y - cur.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
    const t2   = Math.min(cornerR, len2 / 2) / len2;

    const ex = cur.x - dx1 * t1;
    const ey = cur.y - dy1 * t1;
    const sx = cur.x + dx2 * t2;
    const sy = cur.y + dy2 * t2;

    parts.push(`L ${r(ex)},${r(ey)}`);
    parts.push(`Q ${r(cur.x)},${r(cur.y)} ${r(sx)},${r(sy)}`);
  }

  return parts.join(' ');
}

function r(n) { return Math.round(n * 10) / 10; }

// ── Arrow marker ─────────────────────────────────────────────────────────────

let _markerSeq = 0;
function ensureArrowMarker(parentNode, color) {
  let root = parentNode;
  while (root && root.tagName !== 'svg') root = root.parentNode;
  if (!root) return '';

  const key = `_arrowMarker_${color.replace('#', '')}`;
  if (root[key]) return root[key];

  const id = `customArrow${++_markerSeq}`;
  root[key] = id;

  let defs = root.querySelector('defs');
  if (!defs) { defs = svgCreate('defs'); svgAppend(root, defs); }

  const marker = svgCreate('marker');
  svgAttr(marker, {
    id,
    markerWidth: 9,
    markerHeight: 6,
    refX: 8,
    refY: 3,
    orient: 'auto',
  });

  const arrow = svgCreate('polygon');
  svgAttr(arrow, { points: '0 0, 9 3, 0 6', fill: color });
  svgAppend(marker, arrow);
  svgAppend(defs, marker);

  return id;
}

// ── Condition pill ────────────────────────────────────────────────────────────

function _drawConditionPill(parentNode, label, mx, my) {
  const pad    = 7;
  const charPx = 9 * 0.58;
  const pillW  = Math.min(label.length * charPx + pad * 2, 140);
  const pillH  = 18;

  const g = svgCreate('g');

  // Shadow rect for legibility
  const shadow = svgCreate('rect');
  svgAttr(shadow, {
    x: mx - pillW / 2 + 1, y: my - pillH / 2 + 1,
    width: pillW, height: pillH,
    rx: 4, ry: 4,
    fill: 'rgba(0,0,0,0.08)',
  });
  svgAppend(g, shadow);

  const pill = svgCreate('rect');
  svgAttr(pill, {
    x: mx - pillW / 2, y: my - pillH / 2,
    width: pillW, height: pillH,
    rx: 4, ry: 4,
    fill: '#ffffff',
    stroke: 'none',
  });
  svgAppend(g, pill);

  const t = svgCreate('text');
  svgAttr(t, {
    x: mx, y: my,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-family': FONT,
    'font-size': 9,
    'font-weight': 600,
    fill: BRAND.plum,
  });
  // Truncate label to fit pill width
  const maxChars = Math.floor((pillW - pad * 2) / charPx);
  t.textContent = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
  svgAppend(g, t);

  svgAppend(parentNode, g);
}

// ── Module export ─────────────────────────────────────────────────────────────

CustomRenderer.$inject = ['eventBus', 'bpmnRenderer'];

export const customRenderModule = {
  __init__: ['customRenderer'],
  customRenderer: ['type', CustomRenderer],
};
