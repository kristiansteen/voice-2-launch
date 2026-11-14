// Obstacle-aware orthogonal router for sequence flows.
//
// All arrows are routed on a shared 10px grid with A*. Every shape (plus a
// clearance margin) is blocked, so an arrow can never pass through a box.
// Arrows are routed one after another and each records the grid segments it
// occupies; later arrows pay a heavy cost for reusing a segment, so they pick
// a parallel track instead of being drawn on top of an earlier arrow.
//
// Shapes are given by centre ({ id, x, y, w, h }) and their centres must lie on
// the grid (multiples of GRID) so that ports line up with grid lines.

export const GRID = 10;
const MARGIN = 10; // minimum clearance between an arrow and a shape it is not attached to

// Costs, in units of one grid step
const STEP = 1;
const BEND = 6;
const CROSS = 4;
const SHARE_UNRELATED = 80; // per step on a segment used by an unrelated arrow
const SHARE_SAME_SOURCE = 12; // branches out of one gateway should fan out
const SHARE_SAME_TARGET = 1;  // arrows merging into one element may join up
const PORT_OPPOSITE = 30;     // leaving on the left / entering on the right
const PORT_SIDE = 4;          // top or bottom of a task or event
const PORT_SIDE_GATEWAY = 1;  // gateway branches conventionally leave top/bottom
const PORT_REUSE_OUT = 8;
const PORT_REUSE_IN = 3;
const PORT_MIXED = 40;        // one arrow in and one arrow out on the same side

// Directions: 0 = right, 1 = down, 2 = left, 3 = up
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const SIDES = ['right', 'bottom', 'left', 'top'];

class MinHeap {
  constructor() { this.keys = []; this.vals = []; }
  get size() { return this.keys.length; }
  push(key, val) {
    const { keys, vals } = this;
    let i = keys.length;
    keys.push(key); vals.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      keys[i] = keys[p]; vals[i] = vals[p];
      i = p;
    }
    keys[i] = key; vals[i] = val;
  }
  pop() {
    const { keys, vals } = this;
    const top = vals[0];
    const key = keys.pop(), val = vals.pop();
    const n = keys.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= key) break;
        keys[i] = keys[c]; vals[i] = vals[c];
        i = c;
      }
      keys[i] = key; vals[i] = val;
    }
    return top;
  }
}

/**
 * @param shapes [{ id, x, y, w, h, isGateway? }] — centres, on the grid
 * @param edges  [{ id, from, to }]
 * @param bounds { x0, y0, x1, y1 } — arrows stay inside this rectangle
 * @returns { [edgeId]: [[x, y], ...] } — edges that could not be routed are omitted
 */
export function routeEdges(shapes, edges, bounds) {
  const gx0 = Math.ceil(bounds.x0 / GRID), gy0 = Math.ceil(bounds.y0 / GRID);
  const W = Math.floor(bounds.x1 / GRID) - gx0 + 1;
  const H = Math.floor(bounds.y1 / GRID) - gy0 + 1;
  if (W < 2 || H < 2) return {};
  const N = W * H;
  const inGrid = (ix, iy) => ix >= 0 && iy >= 0 && ix < W && iy < H;

  // Blocked nodes: strictly inside a shape inflated by MARGIN
  const blocked = new Uint8Array(N);
  for (const s of shapes) {
    const hw = s.w / 2 + MARGIN, hh = s.h / 2 + MARGIN;
    const ixa = Math.max(0, Math.floor((s.x - hw) / GRID) - gx0), ixb = Math.min(W - 1, Math.ceil((s.x + hw) / GRID) - gx0);
    const iya = Math.max(0, Math.floor((s.y - hh) / GRID) - gy0), iyb = Math.min(H - 1, Math.ceil((s.y + hh) / GRID) - gy0);
    for (let iy = iya; iy <= iyb; iy++) for (let ix = ixa; ix <= ixb; ix++) {
      const x = (ix + gx0) * GRID, y = (iy + gy0) * GRID;
      if (Math.abs(x - s.x) < hw && Math.abs(y - s.y) < hh) blocked[iy * W + ix] = 1;
    }
  }

  // Ports: one per side, on the shape's centre line. `gate` is the first grid
  // node outside the clearance zone; the stub boundary→gate is always straight.
  const ports = {};
  for (const s of shapes) {
    ports[s.id] = SIDES.map((side, d) => {
      const half = d % 2 === 0 ? s.w / 2 : s.h / 2;
      const border = [s.x + DX[d] * half, s.y + DY[d] * half];
      const reach = Math.ceil((half + MARGIN) / GRID) * GRID;
      const ix = (s.x + DX[d] * reach) / GRID - gx0, iy = (s.y + DY[d] * reach) / GRID - gy0;
      const ok = Number.isInteger(ix) && Number.isInteger(iy) && inGrid(ix, iy) && !blocked[iy * W + ix];
      return { side, d, border, node: ok ? iy * W + ix : -1, out: 0, in: 0 };
    });
  }

  // Occupancy: hSeg[n] = arrows on the segment n→n+1, vSeg[n] = on n→n+W
  const hSeg = new Map(), vSeg = new Map();
  const hCnt = new Uint8Array(N), vCnt = new Uint8Array(N);
  const segOf = (n, d) => (d === 0 ? [hSeg, hCnt, n] : d === 2 ? [hSeg, hCnt, n - 1] : d === 1 ? [vSeg, vCnt, n] : [vSeg, vCnt, n - W]);

  const shareCost = (occupants, e) => {
    let c = 0;
    for (const o of occupants) {
      const k = o.to === e.to ? SHARE_SAME_TARGET : o.from === e.from ? SHARE_SAME_SOURCE : SHARE_UNRELATED;
      if (k > c) c = k;
    }
    return c;
  };

  const byId = Object.fromEntries(shapes.map(s => [s.id, s]));
  const gScore = new Float32Array(N * 4);
  const cameFrom = new Int32Array(N * 4);
  const TERMINAL = N * 4;

  function routeOne(e) {
    const src = byId[e.from], tgt = byId[e.to];
    const srcPorts = ports[e.from].filter(p => p.node >= 0);
    const tgtPorts = ports[e.to].filter(p => p.node >= 0);
    if (!srcPorts.length || !tgtPorts.length) return null;

    const outCost = p =>
      (p.side === 'right' ? 0 : p.side === 'left' ? PORT_OPPOSITE : src.isGateway ? PORT_SIDE_GATEWAY : PORT_SIDE) +
      p.out * PORT_REUSE_OUT + (p.in ? PORT_MIXED : 0);
    const inCost = p =>
      (p.side === 'left' ? 0 : p.side === 'right' ? PORT_OPPOSITE : PORT_SIDE) +
      p.in * PORT_REUSE_IN + (p.out ? PORT_MIXED : 0);

    // Goal lookup: node → target port (arrival direction is opposite the port's outward direction)
    const goalAt = new Map(tgtPorts.map(p => [p.node, p]));
    const goals = tgtPorts.map(p => [p.node % W, (p.node / W) | 0]);
    const h = n => {
      const ix = n % W, iy = (n / W) | 0;
      let best = Infinity;
      for (const [gx, gy] of goals) {
        const dist = Math.abs(ix - gx) + Math.abs(iy - gy);
        if (dist < best) best = dist;
      }
      return best * STEP;
    };

    gScore.fill(Infinity);
    const heap = new MinHeap();
    for (const p of srcPorts) {
      const st = p.node * 4 + p.d, g = outCost(p);
      if (g < gScore[st]) { gScore[st] = g; cameFrom[st] = -1; heap.push(g + h(p.node), st); }
    }
    let bestEnd = Infinity, endState = -1, endPort = null;

    while (heap.size) {
      const st = heap.pop();
      if (st === TERMINAL) break;
      const n = (st / 4) | 0, d = st % 4, g = gScore[st];

      const gp = goalAt.get(n);
      if (gp) {
        const arrive = (gp.d + 2) % 4;
        if (d !== gp.d) { // cannot arrive travelling away from the shape
          const total = g + (d === arrive ? 0 : BEND) + inCost(gp);
          if (total < bestEnd) { bestEnd = total; endState = st; endPort = gp; heap.push(total, TERMINAL); }
        }
      }

      const ix = n % W, iy = (n / W) | 0;
      for (let d2 = 0; d2 < 4; d2++) {
        if (d2 === (d + 2) % 4) continue;
        const jx = ix + DX[d2], jy = iy + DY[d2];
        if (!inGrid(jx, jy)) continue;
        const m = jy * W + jx;
        if (blocked[m]) continue;
        let cost = STEP + (d2 === d ? 0 : BEND);
        const [segMap, segCnt, key] = segOf(n, d2);
        if (segCnt[key]) cost += shareCost(segMap.get(key), e);
        // Crossing or touching an arrow that runs perpendicular through m
        const perp = d2 % 2 === 0
          ? vCnt[m] || (jy > 0 && vCnt[m - W])
          : hCnt[m] || (jx > 0 && hCnt[m - 1]);
        if (perp) cost += CROSS;
        const st2 = m * 4 + d2, g2 = g + cost;
        if (g2 < gScore[st2]) { gScore[st2] = g2; cameFrom[st2] = st; heap.push(g2 + h(m), st2); }
      }
    }
    if (endState < 0) return null;

    // Walk back, record occupancy
    const states = [];
    for (let s = endState; s >= 0; s = cameFrom[s]) states.push(s);
    states.reverse();
    const startPort = srcPorts.find(p => p.node === ((states[0] / 4) | 0) && p.d === states[0] % 4);
    startPort.out++; endPort.in++;
    for (let i = 1; i < states.length; i++) {
      const [segMap, segCnt, key] = segOf((states[i - 1] / 4) | 0, states[i] % 4);
      if (!segMap.has(key)) segMap.set(key, []);
      segMap.get(key).push(e);
      if (segCnt[key] < 255) segCnt[key]++;
    }

    const pts = [startPort.border];
    for (const s of states) {
      const n = (s / 4) | 0;
      pts.push([(n % W + gx0) * GRID, (((n / W) | 0) + gy0) * GRID]);
    }
    pts.push(endPort.border);
    return simplify(pts);
  }

  // Short, straight connections first so they get the direct line;
  // long and backward arrows then route around them.
  const routable = edges.filter(e => byId[e.from] && byId[e.to] && e.from !== e.to);
  const rank = e => {
    const a = byId[e.from], b = byId[e.to];
    const back = b.x <= a.x ? 100000 : 0;
    return back + Math.abs(a.x - b.x) + 2 * Math.abs(a.y - b.y);
  };
  routable.sort((p, q) => rank(p) - rank(q));

  const routes = {};
  for (const e of routable) {
    const pts = routeOne(e);
    if (pts) routes[e.id] = pts;
  }
  return routes;
}

// Drop duplicate points and points in the middle of a straight run
function simplify(pts) {
  const out = [];
  for (const p of pts) {
    const a = out[out.length - 2], b = out[out.length - 1];
    if (b && b[0] === p[0] && b[1] === p[1]) continue;
    if (a && ((a[0] === b[0] && b[0] === p[0]) || (a[1] === b[1] && b[1] === p[1]))) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}
