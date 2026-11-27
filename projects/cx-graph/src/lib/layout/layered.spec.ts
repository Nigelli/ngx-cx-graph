import { CX_DEFAULT_LAYOUT_OPTIONS, CxLayoutInput, CxLayoutNode, CxRect } from './layout';
import { layeredLayout } from './layered';

const leaf = (id: string, parent?: string): CxLayoutNode => ({ id, parent, width: 200, height: 60 });
const box = (id: string): CxLayoutNode => ({ id, width: 240, height: 0, container: true });
const input = (nodes: CxLayoutNode[], edges: [string, string][], direction: 'RIGHT' | 'DOWN' = 'RIGHT'): CxLayoutInput => ({
  nodes,
  edges: edges.map(([from, to], i) => ({ id: 'e' + i, from, to })),
  options: { ...CX_DEFAULT_LAYOUT_OPTIONS, direction },
});
const overlap = (a: CxRect, b: CxRect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('layeredLayout', () => {
  it('places a chain in layers along the direction', () => {
    const r = layeredLayout(input([leaf('a'), leaf('b'), leaf('c')], [['a', 'b'], ['b', 'c']]));
    const [a, b, c] = ['a', 'b', 'c'].map((id) => r.nodes.get(id)!);
    expect(a.x + a.width).toBeLessThan(b.x);
    expect(b.x + b.width).toBeLessThan(c.x);
    expect(a.y).toBeCloseTo(b.y, 0);
    expect(r.width).toBe(c.x + c.width);
  });

  it('runs top down when asked', () => {
    const r = layeredLayout(input([leaf('a'), leaf('b')], [['a', 'b']], 'DOWN'));
    const a = r.nodes.get('a')!;
    const b = r.nodes.get('b')!;
    expect(a.y + a.height).toBeLessThan(b.y);
    const route = r.edges.get('e0')!;
    expect(route.sourceSide).toBe('bottom');
    expect(route.targetSide).toBe('top');
  });

  it('never overlaps siblings', () => {
    const nodes = Array.from({ length: 30 }, (_, i) => leaf('n' + i));
    const edges: [string, string][] = [];
    for (let i = 0; i < 30; i++) for (const j of [i * 2 + 1, i * 3 + 2]) if (j < 30) edges.push(['n' + i, 'n' + j]);
    const r = layeredLayout(input(nodes, edges));
    const rects = [...r.nodes.values()];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i], rects[j])).toBeFalse();
    }
  });

  it('survives cycles and still places every node', () => {
    const r = layeredLayout(input([leaf('a'), leaf('b'), leaf('c')], [['a', 'b'], ['b', 'c'], ['c', 'a']]));
    expect(r.nodes.size).toBe(3);
    expect(r.edges.size).toBe(3);
    for (const route of r.edges.values()) expect(route.points.length).toBeGreaterThanOrEqual(2);
  });

  it('grows a container around its children', () => {
    const r = layeredLayout(input([box('g'), leaf('a', 'g'), leaf('b', 'g'), leaf('x')], [['a', 'b'], ['b', 'x']]));
    const g = r.nodes.get('g')!;
    const pad = CX_DEFAULT_LAYOUT_OPTIONS.padding;
    for (const id of ['a', 'b']) {
      const c = r.nodes.get(id)!;
      expect(c.x).toBeGreaterThanOrEqual(g.x + pad.left);
      expect(c.y).toBeGreaterThanOrEqual(g.y + pad.top);
      expect(c.x + c.width).toBeLessThanOrEqual(g.x + g.width - pad.right);
      expect(c.y + c.height).toBeLessThanOrEqual(g.y + g.height - pad.bottom);
    }
    expect(overlap(g, r.nodes.get('x')!)).toBeFalse();
    expect(g.x + g.width).toBeLessThan(r.nodes.get('x')!.x);
  });

  it('starts and ends routes on the node borders', () => {
    const r = layeredLayout(input([leaf('a'), leaf('b'), leaf('c')], [['a', 'b'], ['b', 'c'], ['a', 'c']]));
    const a = r.nodes.get('a')!;
    const c = r.nodes.get('c')!;
    const long = r.edges.get('e2')!;
    expect(long.points[0].x).toBe(a.x + a.width);
    expect(long.points[long.points.length - 1].x).toBe(c.x);
    // The long edge bends around the middle layer.
    expect(long.points.length).toBeGreaterThan(2);
  });

  it('wraps a scope without edges into a grid', () => {
    const nodes = Array.from({ length: 12 }, (_, i) => leaf('n' + i));
    const r = layeredLayout(input(nodes, []));
    const columns = new Set([...r.nodes.values()].map((n) => n.x));
    expect(columns.size).toBeGreaterThan(1);
    expect(r.height).toBeLessThanOrEqual(CX_DEFAULT_LAYOUT_OPTIONS.wrapAt + 80);
  });

  it('routes an unconstrained edge without letting it move nodes', () => {
    const base = input([leaf('a'), leaf('b'), leaf('c')], [['a', 'b'], ['b', 'c']]);
    const before = layeredLayout(base);
    const withBack = layeredLayout({
      ...base,
      edges: [...base.edges, { id: 'back', from: 'c', to: 'a', constraint: false }],
    });
    for (const id of ['a', 'b', 'c']) expect(withBack.nodes.get(id)).toEqual(before.nodes.get(id));
    const route = withBack.edges.get('back')!;
    expect(route.sourceSide).toBe('left');
    expect(route.targetSide).toBe('right');
    expect(route.points.length).toBe(2);
  });

  it('returns an empty result for an empty graph', () => {
    const r = layeredLayout(input([], []));
    expect(r.nodes.size).toBe(0);
    expect(r.width).toBe(0);
  });
});
