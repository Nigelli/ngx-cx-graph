import { CxEdge, CxNode } from './model';

/**
 * Pure functions that turn the full graph plus the expand state into the
 * graph that is on screen: which nodes are visible, which are folded into
 * a collapsed group or a "show more" stub, and how edges merge.
 */

export type CxViewNodeRole = 'node' | 'group' | 'more';

export interface CxViewNode {
  /** Node id, or `<groupId>::more` for a "show more" stub. */
  id: string;
  role: CxViewNodeRole;
  /** The source node. For a stub this is the group it belongs to. */
  node: CxNode;
  /** Visible parent group id. */
  parent?: string;
  depth: number;
  /** True for a group whose children are on screen. */
  expanded: boolean;
  /** Loaded direct children, shown or not. For a stub: those of its group. */
  children: CxNode[];
  /** Direct children in total, counting ones not loaded yet. */
  totalChildren: number;
  /** For a stub: children of the group that are not shown. */
  remaining: number;
}

export interface CxViewEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
  /** Number of source edges merged into this one. */
  count: number;
  label?: string;
  edges: CxEdge[];
}

export interface CxViewGraph {
  nodes: CxViewNode[];
  byId: Map<string, CxViewNode>;
  edges: CxViewEdge[];
  /** Maps every source node id to the visible node that stands for it. */
  rep: Map<string, string>;
  /** Source edges per source node id, ignoring hidden kinds. */
  degree: Map<string, { in: number; out: number }>;
}

export interface CxViewOptions {
  /** Ids of expanded groups. */
  expanded: ReadonlySet<string>;
  /** How many children an expanded group shows. */
  shown: (groupId: string) => number;
  isGroupKind: (kind: string) => boolean;
  hiddenEdgeKinds?: ReadonlySet<string>;
}

export const MORE_SUFFIX = '::more';

export function moreId(groupId: string): string {
  return groupId + MORE_SUFFIX;
}

export interface CxHierarchy {
  byId: Map<string, CxNode>;
  children: Map<string, CxNode[]>;
  roots: CxNode[];
  isGroup: (node: CxNode) => boolean;
}

export function buildHierarchy(nodes: readonly CxNode[], isGroupKind: (kind: string) => boolean): CxHierarchy {
  const byId = new Map<string, CxNode>();
  for (const n of nodes) byId.set(n.id, n);
  const children = new Map<string, CxNode[]>();
  const roots: CxNode[] = [];
  for (const n of byId.values()) {
    const parent = n.parent !== undefined && n.parent !== n.id ? byId.get(n.parent) : undefined;
    if (parent && !isAncestor(byId, n.id, parent.id)) {
      let list = children.get(parent.id);
      if (!list) children.set(parent.id, (list = []));
      list.push(n);
    } else {
      roots.push(n);
    }
  }
  const isGroup = (n: CxNode) => children.has(n.id) || (n.childCount ?? 0) > 0 || isGroupKind(n.kind);
  return { byId, children, roots, isGroup };
}

/** True when `ancestorId` is `id` or sits below it, which would make a cycle. */
function isAncestor(byId: Map<string, CxNode>, ancestorId: string, id: string): boolean {
  let cur: CxNode | undefined = byId.get(id);
  let guard = 0;
  while (cur && guard++ < 10000) {
    if (cur.id === ancestorId) return true;
    cur = cur.parent !== undefined ? byId.get(cur.parent) : undefined;
  }
  return false;
}

export function buildViewGraph(nodes: readonly CxNode[], edges: readonly CxEdge[], opt: CxViewOptions): CxViewGraph {
  const h = buildHierarchy(nodes, opt.isGroupKind);
  const out: CxViewNode[] = [];
  const byId = new Map<string, CxViewNode>();
  const rep = new Map<string, string>();

  const hide = (n: CxNode, standIn: string) => {
    rep.set(n.id, standIn);
    for (const c of h.children.get(n.id) ?? []) hide(c, standIn);
  };

  const visit = (n: CxNode, parent: string | undefined, depth: number) => {
    const kids = h.children.get(n.id) ?? [];
    const total = Math.max(kids.length, n.childCount ?? 0);
    const group = h.isGroup(n);
    const expanded = group && opt.expanded.has(n.id);
    const v: CxViewNode = {
      id: n.id,
      role: group ? 'group' : 'node',
      node: n,
      parent,
      depth,
      expanded,
      children: kids,
      totalChildren: total,
      remaining: 0,
    };
    out.push(v);
    byId.set(v.id, v);
    rep.set(n.id, n.id);
    if (!expanded) {
      for (const c of kids) hide(c, n.id);
      return;
    }
    const limit = Math.max(0, opt.shown(n.id));
    const shown = kids.slice(0, limit);
    for (const c of shown) visit(c, n.id, depth + 1);
    const remaining = total - shown.length;
    if (remaining > 0) {
      const stub: CxViewNode = {
        id: moreId(n.id),
        role: 'more',
        node: n,
        parent: n.id,
        depth: depth + 1,
        expanded: false,
        children: kids,
        totalChildren: 0,
        remaining,
      };
      out.push(stub);
      byId.set(stub.id, stub);
      for (const c of kids.slice(limit)) hide(c, stub.id);
    }
  };
  for (const r of h.roots) visit(r, undefined, 0);

  const contains = (ancestor: string, id: string): boolean => {
    let cur = byId.get(id);
    while (cur?.parent !== undefined) {
      if (cur.parent === ancestor) return true;
      cur = byId.get(cur.parent);
    }
    return false;
  };

  const degree = new Map<string, { in: number; out: number }>();
  const bump = (id: string, key: 'in' | 'out') => {
    let d = degree.get(id);
    if (!d) degree.set(id, (d = { in: 0, out: 0 }));
    d[key]++;
  };

  const merged = new Map<string, CxViewEdge>();
  for (const e of edges) {
    if (opt.hiddenEdgeKinds?.has(e.kind)) continue;
    if (!h.byId.has(e.from) || !h.byId.has(e.to) || e.from === e.to) continue;
    bump(e.from, 'out');
    bump(e.to, 'in');
    const from = rep.get(e.from)!;
    const to = rep.get(e.to)!;
    if (from === to || contains(from, to) || contains(to, from)) continue;
    const key = from + '\u0000' + to + '\u0000' + e.kind;
    const hit = merged.get(key);
    if (hit) {
      hit.count++;
      hit.edges.push(e);
      if (hit.label !== e.label) hit.label = undefined;
    } else {
      merged.set(key, { id: key, from, to, kind: e.kind, count: 1, label: e.label, edges: [e] });
    }
  }

  return { nodes: out, byId, edges: [...merged.values()], rep, degree };
}

/**
 * The groups that start expanded: those above `expandDepth` that have at
 * most `collapseThreshold` children.
 */
export function defaultExpanded(
  nodes: readonly CxNode[],
  isGroupKind: (kind: string) => boolean,
  expandDepth: number,
  collapseThreshold: number,
): Set<string> {
  const h = buildHierarchy(nodes, isGroupKind);
  const result = new Set<string>();
  const walk = (n: CxNode, depth: number) => {
    if (!h.isGroup(n) || depth >= expandDepth) return;
    const kids = h.children.get(n.id) ?? [];
    const total = Math.max(kids.length, n.childCount ?? 0);
    if (total === 0 || total > collapseThreshold) return;
    result.add(n.id);
    for (const c of kids) walk(c, depth + 1);
  };
  for (const r of h.roots) walk(r, 0);
  return result;
}

/** Ids of all ancestors of a node, nearest first. */
export function ancestorsOf(nodes: readonly CxNode[], id: string): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const result: string[] = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur?.parent !== undefined && guard++ < 10000) {
    const p = byId.get(cur.parent);
    if (!p || result.includes(p.id) || p.id === id) break;
    result.push(p.id);
    cur = p;
  }
  return result;
}
