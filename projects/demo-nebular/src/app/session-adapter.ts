import { CxEdge, CxNode } from 'ngx-cx-graph';

/**
 * Turns the execution-graph API response into cx-graph nodes and edges.
 * This is the only place that knows the session data model.
 */
export interface SessionGraph {
  nodes: CxNode[];
  edges: CxEdge[];
  ledger: any[];
}

export function toCxGraph(response: any, session: any): SessionGraph {
  const graph = response.graph;
  const byId = new Map<string, any>(graph.nodes.map((n: any) => [n.id, n]));
  const nodes: CxNode[] = [];

  // Each ledger entry becomes a node next to the tool call that produced it.
  const entryOf = new Map<string, any>();
  graph.ledger.forEach((entry: any, i: number) => {
    entry.ref = 'E-' + String(i + 1).padStart(2, '0');
    if (entry.source?.nodeId) entryOf.set(entry.source.nodeId, entry);
  });

  for (const n of graph.nodes) {
    nodes.push({
      id: n.id,
      kind: n.kind,
      label: n.kind === 'step' ? stepTitle(n.label) : (n.data?.statement ?? n.data?.question ?? n.data?.action ?? n.data?.test ?? n.data?.description ?? n.label),
      parent: n.parent,
      status: n.status,
      data: { ...n.data, logRef: n.logRef },
    });
    const entry = entryOf.get(n.id);
    if (entry) {
      nodes.push({
        id: entry.id,
        kind: 'ledger_entry',
        label: entry.reason ?? entry.source?.name,
        parent: n.parent,
        status: entry.status,
        data: entry,
      });
    }
  }
  for (const entry of graph.ledger) {
    if (!nodes.some((n) => n.id === entry.id)) {
      nodes.push({ id: entry.id, kind: 'ledger_entry', label: entry.reason, status: entry.status, data: entry });
    }
  }

  const edges: CxEdge[] = graph.edges.map((e: any) => ({ id: e.id, from: e.from, to: e.to, kind: e.kind }));

  // The response has no edges between steps. Their order is only in
  // createdAt, so the sequence is made explicit here.
  const steps = graph.nodes
    .filter((n: any) => n.kind === 'step' && !n.parent)
    .sort((a: any, b: any) => a.createdAt - b.createdAt);
  for (let i = 1; i < steps.length; i++) edges.push({ from: steps[i - 1].id, to: steps[i].id, kind: 'then' });

  // The outcome is not part of the graph response. It hangs off the surviving hypothesis.
  const outcome = session?.outcome;
  if (outcome) {
    nodes.push({ id: 'outcome', kind: 'outcome', status: 'done', data: outcome });
    const survivor = outcome.disposition?.survivingItemId;
    if (survivor && byId.has(survivor)) edges.push({ from: survivor, to: 'outcome', kind: 'concludes' });
    if (steps.length) edges.push({ from: steps[steps.length - 1].id, to: 'outcome', kind: 'then' });
  }
  return { nodes, edges, ledger: graph.ledger };
}

function stepTitle(label: string): string {
  return label ? label[0].toUpperCase() + label.slice(1) : 'Step';
}
