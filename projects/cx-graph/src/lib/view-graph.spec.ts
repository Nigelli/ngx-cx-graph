import { CxEdge, CxNode } from './model';
import { ancestorsOf, buildViewGraph, defaultExpanded, moreId } from './view-graph';

const nodes: CxNode[] = [
  { id: 'plan', kind: 'item' },
  { id: 'step', kind: 'step' },
  { id: 't1', kind: 'tool', parent: 'step' },
  { id: 't2', kind: 'tool', parent: 'step' },
  { id: 't3', kind: 'tool', parent: 'step' },
  { id: 'out', kind: 'outcome' },
];
const edges: CxEdge[] = [
  { from: 'plan', to: 't1', kind: 'runs' },
  { from: 'plan', to: 't2', kind: 'runs' },
  { from: 'plan', to: 't3', kind: 'runs' },
  { from: 't1', to: 'out', kind: 'supports' },
  { from: 't1', to: 't2', kind: 'then' },
];
const view = (expanded: string[], shown = 10, hidden: string[] = []) =>
  buildViewGraph(nodes, edges, {
    expanded: new Set(expanded),
    shown: () => shown,
    isGroupKind: () => false,
    hiddenEdgeKinds: new Set(hidden),
  });

describe('buildViewGraph', () => {
  it('folds the children of a collapsed group into the group', () => {
    const v = view([]);
    expect(v.nodes.map((n) => n.id)).toEqual(['plan', 'step', 'out']);
    expect(v.rep.get('t2')).toBe('step');
    expect(v.byId.get('step')!.role).toBe('group');
    expect(v.byId.get('step')!.totalChildren).toBe(3);
  });

  it('merges edges that end at the same visible nodes and counts them', () => {
    const v = view([]);
    const runs = v.edges.find((e) => e.kind === 'runs')!;
    expect(runs.from).toBe('plan');
    expect(runs.to).toBe('step');
    expect(runs.count).toBe(3);
  });

  it('drops edges that stay inside a collapsed group', () => {
    expect(view([]).edges.some((e) => e.kind === 'then')).toBeFalse();
    expect(view(['step']).edges.some((e) => e.kind === 'then')).toBeTrue();
  });

  it('shows children of an expanded group', () => {
    const v = view(['step']);
    expect(v.nodes.map((n) => n.id)).toEqual(['plan', 'step', 't1', 't2', 't3', 'out']);
    expect(v.byId.get('t1')!.parent).toBe('step');
    expect(v.edges.filter((e) => e.kind === 'runs').length).toBe(3);
  });

  it('pages children and routes their edges to a "show more" stub', () => {
    const v = view(['step'], 1);
    const stub = v.byId.get(moreId('step'))!;
    expect(stub.role).toBe('more');
    expect(stub.remaining).toBe(2);
    expect(v.rep.get('t3')).toBe(stub.id);
    const toStub = v.edges.find((e) => e.to === stub.id && e.kind === 'runs')!;
    expect(toStub.count).toBe(2);
  });

  it('counts children that are not loaded yet', () => {
    const v = buildViewGraph([{ id: 'g', kind: 'zone', childCount: 40 }], [], {
      expanded: new Set(['g']),
      shown: () => 6,
      isGroupKind: () => false,
    });
    expect(v.byId.get(moreId('g'))!.remaining).toBe(40);
  });

  it('leaves out hidden edge kinds', () => {
    const v = view(['step'], 10, ['runs']);
    expect(v.edges.some((e) => e.kind === 'runs')).toBeFalse();
    expect(v.degree.get('plan')).toBeUndefined();
  });

  it('ignores edges to unknown nodes and parent cycles', () => {
    const v = buildViewGraph(
      [
        { id: 'a', kind: 'x', parent: 'b' },
        { id: 'b', kind: 'x', parent: 'a' },
      ],
      [{ from: 'a', to: 'nope', kind: 'k' }],
      { expanded: new Set(['a', 'b']), shown: () => 10, isGroupKind: () => false },
    );
    expect(v.nodes.length).toBe(2);
    expect(v.edges.length).toBe(0);
  });
});

describe('defaultExpanded', () => {
  const tree: CxNode[] = [
    { id: 'small', kind: 'g' },
    { id: 's1', kind: 'n', parent: 'small' },
    { id: 'inner', kind: 'g', parent: 'small' },
    { id: 'i1', kind: 'n', parent: 'inner' },
    { id: 'big', kind: 'g' },
    ...Array.from({ length: 5 }, (_, i) => ({ id: 'b' + i, kind: 'n', parent: 'big' })),
  ];

  it('opens groups above the depth limit that are small enough', () => {
    expect([...defaultExpanded(tree, () => false, 1, 3)]).toEqual(['small']);
    expect([...defaultExpanded(tree, () => false, 2, 3)]).toEqual(['small', 'inner']);
    expect(defaultExpanded(tree, () => false, 1, 12).has('big')).toBeTrue();
  });

  it('lists ancestors nearest first', () => {
    expect(ancestorsOf(tree, 'i1')).toEqual(['inner', 'small']);
  });
});
