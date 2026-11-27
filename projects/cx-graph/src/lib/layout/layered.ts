import {
  CxEdgeRoute,
  CxLayoutEngine,
  CxLayoutInput,
  CxLayoutNode,
  CxLayoutOptions,
  CxLayoutResult,
  CxPoint,
  CxRect,
  CxSide,
} from './layout';

/**
 * The built-in layout: a layered (Sugiyama style) layout with nested
 * containers and no dependencies. Each container is laid out by itself,
 * then treated as one box in the scope above it.
 */
export function cxLayeredLayout(overrides: Partial<Omit<CxLayoutOptions, 'direction'>> = {}): CxLayoutEngine {
  return {
    layout: (input) => layeredLayout({ ...input, options: { ...input.options, ...overrides } }),
  };
}

const ROOT = '\u0000root';

interface Pair {
  key: string;
  from: string;
  to: string;
  weight: number;
}

interface ScopeResult {
  pos: Map<string, CxPoint>;
  routes: Map<string, CxPoint[]>;
  width: number;
  height: number;
}

export function layeredLayout(input: CxLayoutInput): CxLayoutResult {
  const opt = input.options;
  const byId = new Map<string, CxLayoutNode>();
  for (const n of input.nodes) byId.set(n.id, n);

  const scopeOf = (n: CxLayoutNode): string => {
    const p = n.parent !== undefined ? byId.get(n.parent) : undefined;
    return p && p.container && p.id !== n.id ? p.id : ROOT;
  };
  const members = new Map<string, CxLayoutNode[]>();
  for (const n of byId.values()) {
    const s = scopeOf(n);
    let list = members.get(s);
    if (!list) members.set(s, (list = []));
    list.push(n);
  }

  // Root-first chain of a node: [top-level ancestor, ..., node].
  const chains = new Map<string, string[]>();
  const chainOf = (id: string): string[] => {
    let chain = chains.get(id);
    if (chain) return chain;
    chain = [];
    let cur: CxLayoutNode | undefined = byId.get(id);
    let guard = 0;
    while (cur && guard++ < 1000) {
      chain.unshift(cur.id);
      const s = scopeOf(cur);
      cur = s === ROOT ? undefined : byId.get(s);
    }
    chains.set(id, chain);
    return chain;
  };

  // Each edge belongs to the scope of the lowest common container of its ends.
  const scopePairs = new Map<string, Map<string, Pair>>();
  const edgePair = new Map<string, { scope: string; key: string }>();
  for (const e of input.edges) {
    if (!byId.has(e.from) || !byId.has(e.to) || e.from === e.to || e.constraint === false) continue;
    const a = chainOf(e.from);
    const b = chainOf(e.to);
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (i >= a.length || i >= b.length) continue;
    const scope = i === 0 ? ROOT : a[i - 1];
    const key = a[i] + '\u0000' + b[i];
    let pairs = scopePairs.get(scope);
    if (!pairs) scopePairs.set(scope, (pairs = new Map()));
    const hit = pairs.get(key);
    if (hit) hit.weight++;
    else pairs.set(key, { key, from: a[i], to: b[i], weight: 1 });
    edgePair.set(e.id, { scope, key });
  }

  const sizes = new Map<string, { width: number; height: number }>();
  const scopes = new Map<string, ScopeResult>();
  const solve = (scope: string): ScopeResult => {
    const list = members.get(scope) ?? [];
    const items = list.map((n) => {
      let size = { width: n.width, height: n.height };
      if (n.container && members.has(n.id)) {
        const inner = solve(n.id);
        size = {
          width: Math.max(n.width, inner.width + opt.padding.left + opt.padding.right),
          height: Math.max(n.height, inner.height + opt.padding.top + opt.padding.bottom),
        };
      }
      sizes.set(n.id, size);
      return { id: n.id, w: size.width, h: size.height };
    });
    const result = layoutScope(items, [...(scopePairs.get(scope)?.values() ?? [])], opt);
    scopes.set(scope, result);
    return result;
  };
  const root = solve(ROOT);

  const rects = new Map<string, CxRect>();
  const origins = new Map<string, CxPoint>();
  const place = (scope: string, ox: number, oy: number) => {
    origins.set(scope, { x: ox, y: oy });
    const result = scopes.get(scope);
    if (!result) return;
    for (const [id, p] of result.pos) {
      const size = sizes.get(id)!;
      rects.set(id, { x: ox + p.x, y: oy + p.y, width: size.width, height: size.height });
      if (scopes.has(id)) place(id, ox + p.x + opt.padding.left, oy + p.y + opt.padding.top);
    }
  };
  place(ROOT, 0, 0);

  const horizontal = opt.direction === 'RIGHT';
  const edges = new Map<string, CxEdgeRoute>();
  for (const e of input.edges) {
    const ref = edgePair.get(e.id);
    const a = rects.get(e.from);
    const b = rects.get(e.to);
    if (!a || !b || e.from === e.to) continue;
    if (!ref) {
      // Not part of the layering: join the two boxes directly.
      if (e.constraint === false) edges.set(e.id, connect(a, b, [], horizontal));
      continue;
    }
    const o = origins.get(ref.scope)!;
    const bends = (scopes.get(ref.scope)?.routes.get(ref.key) ?? []).map((p) => ({ x: p.x + o.x, y: p.y + o.y }));
    edges.set(e.id, connect(a, b, bends, horizontal));
  }

  return { nodes: rects, edges, width: root.width, height: root.height };
}

function connect(a: CxRect, b: CxRect, bends: CxPoint[], horizontal: boolean): CxEdgeRoute {
  const startSide: CxSide = horizontal ? 'left' : 'top';
  const endSide: CxSide = horizontal ? 'right' : 'bottom';
  const crossStart: CxSide = horizontal ? 'top' : 'left';
  const crossEnd: CxSide = horizontal ? 'bottom' : 'right';
  const main = (p: CxPoint) => (horizontal ? p.x : p.y);
  const lo = (r: CxRect) => (horizontal ? r.x : r.y);
  const hi = (r: CxRect) => (horizontal ? r.x + r.width : r.y + r.height);
  const mid = (r: CxRect) => (horizontal ? r.y + r.height / 2 : r.x + r.width / 2);

  let sourceSide: CxSide;
  let targetSide: CxSide;
  if (bends.length) {
    sourceSide = main(bends[0]) <= lo(a) + 0.5 ? startSide : endSide;
    targetSide = main(bends[bends.length - 1]) >= hi(b) - 0.5 ? endSide : startSide;
  } else if (lo(b) >= hi(a)) {
    sourceSide = endSide;
    targetSide = startSide;
  } else if (hi(b) <= lo(a)) {
    sourceSide = startSide;
    targetSide = endSide;
  } else if (mid(b) >= mid(a)) {
    sourceSide = crossEnd;
    targetSide = crossStart;
  } else {
    sourceSide = crossStart;
    targetSide = crossEnd;
  }
  return { points: [port(a, sourceSide), ...bends, port(b, targetSide)], sourceSide, targetSide };
}

function port(r: CxRect, side: CxSide): CxPoint {
  switch (side) {
    case 'left':
      return { x: r.x, y: r.y + r.height / 2 };
    case 'right':
      return { x: r.x + r.width, y: r.y + r.height / 2 };
    case 'top':
      return { x: r.x + r.width / 2, y: r.y };
    default:
      return { x: r.x + r.width / 2, y: r.y + r.height };
  }
}

/** Lays out the direct members of one scope. Positions are relative to the scope. */
function layoutScope(items: { id: string; w: number; h: number }[], pairs: Pair[], opt: CxLayoutOptions): ScopeResult {
  const real = items.length;
  const result: ScopeResult = { pos: new Map(), routes: new Map(), width: 0, height: 0 };
  if (!real) return result;
  const horizontal = opt.direction === 'RIGHT';

  // m: size along the layer axis. c: size across it.
  const m: number[] = items.map((it) => (horizontal ? it.w : it.h));
  const c: number[] = items.map((it) => (horizontal ? it.h : it.w));
  const index = new Map(items.map((it, i) => [it.id, i] as const));
  const layer: number[] = new Array(real).fill(0);

  interface Link {
    u: number;
    v: number;
    weight: number;
    pair: number;
    rev: boolean;
  }
  const links: Link[] = [];
  pairs.forEach((p, pi) => {
    const u = index.get(p.from);
    const v = index.get(p.to);
    if (u === undefined || v === undefined || u === v) return;
    links.push({ u, v, weight: p.weight, pair: pi, rev: false });
  });

  if (!links.length) {
    const extent = c.reduce((sum, v) => sum + v, 0) + opt.nodeGap * (real - 1);
    const columns = Math.max(1, Math.min(real, Math.ceil(extent / Math.max(1, opt.wrapAt))));
    const perLayer = Math.ceil(real / columns);
    for (let i = 0; i < real; i++) layer[i] = Math.floor(i / perLayer);
  } else {
    breakCycles(real, links);
    assignLayers(real, links, layer);
  }

  // Dummy nodes keep long edges inside their own lane.
  const chain: number[][] = pairs.map(() => []);
  const up: { j: number; w: number }[][] = [];
  const down: { j: number; w: number }[][] = [];
  for (let i = 0; i < real; i++) {
    up.push([]);
    down.push([]);
  }
  const join = (a: number, b: number, w: number) => {
    down[a].push({ j: b, w });
    up[b].push({ j: a, w });
  };
  for (const l of links) {
    let prev = l.u;
    for (let k = layer[l.u] + 1; k < layer[l.v]; k++) {
      const d = m.length;
      m.push(0);
      c.push(0);
      layer.push(k);
      up.push([]);
      down.push([]);
      chain[l.pair].push(d);
      join(prev, d, l.weight);
      prev = d;
    }
    join(prev, l.v, l.weight);
  }
  const total = m.length;
  const isDummy = (i: number) => i >= real;

  const layerCount = Math.max(...layer) + 1;
  const layers: number[][] = Array.from({ length: layerCount }, () => []);
  for (let i = 0; i < total; i++) layers[layer[i]].push(i);
  const ord: number[] = new Array(total).fill(0);
  const reindex = (k: number) => layers[k].forEach((i, j) => (ord[i] = j));
  for (let k = 0; k < layerCount; k++) reindex(k);

  if (links.length) orderLayers(layers, ord, up, down, reindex);

  // Cross-axis coordinates.
  const gap = (a: number, b: number) =>
    isDummy(a) && isDummy(b) ? opt.nodeGap * 0.4 : isDummy(a) || isDummy(b) ? opt.nodeGap * 0.6 : opt.nodeGap;
  const pos: number[] = new Array(total).fill(0);
  for (const row of layers) {
    let acc = 0;
    row.forEach((i, j) => {
      pos[i] = acc;
      acc += c[i] + (j < row.length - 1 ? gap(i, row[j + 1]) : 0);
    });
  }
  const center = (i: number) => pos[i] + c[i] / 2;
  const settle = (row: number[], neighbours: (i: number) => { j: number; w: number }[]) => {
    const target: number[] = [];
    const weight: number[] = [];
    for (const i of row) {
      const ns = neighbours(i);
      if (!ns.length) {
        target.push(pos[i]);
        weight.push(0.001);
        continue;
      }
      let sum = 0;
      let w = 0;
      for (const n of ns) {
        sum += center(n.j) * n.w;
        w += n.w;
      }
      target.push(sum / w - c[i] / 2);
      weight.push(isDummy(i) ? w * 2 : w);
    }
    isotonic(row, target, weight, c, gap, pos);
  };
  if (links.length) {
    for (let it = 0; it < 6; it++) {
      for (let k = 1; k < layerCount; k++) settle(layers[k], (i) => up[i]);
      for (let k = layerCount - 2; k >= 0; k--) settle(layers[k], (i) => down[i]);
    }
    for (let it = 0; it < 3; it++) {
      for (let k = 0; k < layerCount; k++) settle(layers[k], (i) => up[i].concat(down[i]));
    }
  }
  let min = Infinity;
  for (let i = 0; i < total; i++) min = Math.min(min, pos[i]);
  for (let i = 0; i < total; i++) pos[i] -= min;

  // Layer-axis coordinates.
  const layerGap = links.length ? opt.layerGap : opt.nodeGap;
  const depth: number[] = layers.map((row) => Math.max(0, ...row.map((i) => m[i])));
  const start: number[] = [];
  let acc = 0;
  for (let k = 0; k < layerCount; k++) {
    start.push(acc);
    acc += depth[k] + layerGap;
  }
  const mainTotal = acc - layerGap;
  let crossTotal = 0;
  for (let i = 0; i < real; i++) crossTotal = Math.max(crossTotal, pos[i] + c[i]);

  const point = (main: number, cross: number): CxPoint => (horizontal ? { x: main, y: cross } : { x: cross, y: main });
  for (let i = 0; i < real; i++) result.pos.set(items[i].id, point(start[layer[i]], pos[i]));
  for (const l of links) {
    const pts: CxPoint[] = [];
    for (const d of chain[l.pair]) {
      pts.push(point(start[layer[d]], pos[d]));
      if (depth[layer[d]] > 0) pts.push(point(start[layer[d]] + depth[layer[d]], pos[d]));
    }
    if (l.rev) pts.reverse();
    result.routes.set(pairs[l.pair].key, pts);
  }
  result.width = horizontal ? mainTotal : crossTotal;
  result.height = horizontal ? crossTotal : mainTotal;
  return result;
}

/** Reverses the back edges found by a depth-first walk, so the links form a DAG. */
function breakCycles(n: number, links: { u: number; v: number; rev: boolean }[]): void {
  const out: number[][] = Array.from({ length: n }, () => []);
  links.forEach((l, i) => out[l.u].push(i));
  const state = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (state[s]) continue;
    const stack: { node: number; next: number }[] = [{ node: s, next: 0 }];
    state[s] = 1;
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.next >= out[top.node].length) {
        state[top.node] = 2;
        stack.pop();
        continue;
      }
      const l = links[out[top.node][top.next++]];
      if (state[l.v] === 1) {
        l.rev = true;
      } else if (state[l.v] === 0) {
        state[l.v] = 1;
        stack.push({ node: l.v, next: 0 });
      }
    }
  }
  for (const l of links) {
    if (!l.rev) continue;
    const u = l.u;
    l.u = l.v;
    l.v = u;
  }
}

/** Longest-path layering, then sources are pulled next to what they feed. */
function assignLayers(n: number, links: { u: number; v: number }[], layer: number[]): void {
  const out: number[][] = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (const l of links) {
    out[l.u].push(l.v);
    indeg[l.v]++;
  }
  const queue: number[] = [];
  for (let i = 0; i < n; i++) if (!indeg[i]) queue.push(i);
  const topo: number[] = [];
  for (let q = 0; q < queue.length; q++) {
    const u = queue[q];
    topo.push(u);
    for (const v of out[u]) {
      layer[v] = Math.max(layer[v], layer[u] + 1);
      if (--indeg[v] === 0) queue.push(v);
    }
  }
  for (let t = topo.length - 1; t >= 0; t--) {
    const u = topo[t];
    if (!out[u].length) continue;
    let next = Infinity;
    for (const v of out[u]) next = Math.min(next, layer[v]);
    if (next - 1 > layer[u]) layer[u] = next - 1;
  }
  // Drop layers that the pull left empty.
  const used = [...new Set(layer)].sort((a, b) => a - b);
  const remap = new Map(used.map((k, i) => [k, i] as const));
  for (let i = 0; i < n; i++) layer[i] = remap.get(layer[i])!;
}

/** Barycentre sweeps that keep the order with the fewest crossings. */
function orderLayers(
  layers: number[][],
  ord: number[],
  up: { j: number; w: number }[][],
  down: { j: number; w: number }[][],
  reindex: (k: number) => void,
): void {
  const sweep = (k: number, neighbours: { j: number; w: number }[][], refSize: number) => {
    const row = layers[k];
    const scale = refSize / Math.max(1, row.length);
    const key = new Map<number, number>();
    for (const i of row) {
      const ns = neighbours[i];
      if (!ns.length) {
        key.set(i, ord[i] * scale);
        continue;
      }
      let sum = 0;
      let w = 0;
      for (const n of ns) {
        sum += ord[n.j] * n.w;
        w += n.w;
      }
      key.set(i, sum / w);
    }
    const before = new Map(row.map((i, j) => [i, j] as const));
    row.sort((a, b) => key.get(a)! - key.get(b)! || before.get(a)! - before.get(b)!);
    reindex(k);
  };
  const crossings = (): number => {
    let count = 0;
    for (let k = 0; k < layers.length - 1; k++) {
      const segs: number[][] = [];
      for (const i of layers[k]) for (const n of down[i]) segs.push([ord[i], ord[n.j]]);
      segs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const tree = new Array(layers[k + 1].length + 1).fill(0);
      let seen = 0;
      for (const s of segs) {
        let le = 0;
        for (let x = s[1] + 1; x > 0; x -= x & -x) le += tree[x];
        count += seen - le;
        for (let x = s[1] + 1; x < tree.length; x += x & -x) tree[x]++;
        seen++;
      }
    }
    return count;
  };

  for (let k = 1; k < layers.length; k++) sweep(k, up, layers[k - 1].length);
  let best = crossings();
  let saved = layers.map((row) => row.slice());
  for (let it = 0; it < 6 && best > 0; it++) {
    for (let k = layers.length - 2; k >= 0; k--) sweep(k, down, layers[k + 1].length);
    for (let k = 1; k < layers.length; k++) sweep(k, up, layers[k - 1].length);
    const now = crossings();
    if (now < best) {
      best = now;
      saved = layers.map((row) => row.slice());
    }
  }
  saved.forEach((row, k) => {
    layers[k] = row;
    reindex(k);
  });
}

/**
 * Places one layer as close to the targets as the order and the gaps allow
 * (weighted isotonic regression by pooling adjacent violators).
 */
function isotonic(
  row: number[],
  target: number[],
  weight: number[],
  size: number[],
  gap: (a: number, b: number) => number,
  pos: number[],
): void {
  const offset: number[] = [];
  let acc = 0;
  row.forEach((i, j) => {
    offset.push(acc);
    acc += size[i] + (j < row.length - 1 ? gap(i, row[j + 1]) : 0);
  });
  const blocks: { sum: number; weight: number; count: number }[] = [];
  row.forEach((_, j) => {
    blocks.push({ sum: (target[j] - offset[j]) * weight[j], weight: weight[j], count: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.sum / a.weight <= b.sum / b.weight) break;
      a.sum += b.sum;
      a.weight += b.weight;
      a.count += b.count;
      blocks.pop();
    }
  });
  let j = 0;
  for (const b of blocks) {
    const base = b.sum / b.weight;
    for (let k = 0; k < b.count; k++, j++) pos[row[j]] = base + offset[j];
  }
}
