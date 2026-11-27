import { InjectionToken, Provider } from '@angular/core';
import { CxLayoutEngine } from './layout/layout';
import { CxEdgeType, CxGraphLabels, CxNode, CxNodeType, CxStatus, CxTone } from './model';

export interface CxGraphConfig {
  /** Node types keyed by `node.kind`. */
  nodeTypes?: Record<string, CxNodeType<any>>;
  /** Edge types keyed by `edge.kind`. */
  edgeTypes?: Record<string, CxEdgeType>;
  /** Extra icons: name to SVG path data on a 24 by 24 grid. */
  icons?: Record<string, string>;
  /** Layout engine. Defaults to the built-in layered layout. */
  layout?: CxLayoutEngine;
  /** Maps `node.status` to a tone for node types without a `status` function. */
  statusTones?: Record<string, CxTone>;
  labels?: Partial<CxGraphLabels>;
}

export const CX_GRAPH_CONFIG = new InjectionToken<CxGraphConfig>('CX_GRAPH_CONFIG');

/** Registers app-wide defaults. Inputs on `<cx-graph>` override them per graph. */
export function provideCxGraph(config: CxGraphConfig): Provider {
  return { provide: CX_GRAPH_CONFIG, useValue: config };
}

/** Types a node type against your node shape: `cxNodeType<MyNode>({ ... })`. */
export function cxNodeType<N extends CxNode = CxNode>(type: CxNodeType<N>): CxNodeType<any> {
  return type as CxNodeType<any>;
}

export const CX_DEFAULT_STATUS_TONES: Record<string, CxTone> = {
  done: 'success',
  success: 'success',
  completed: 'success',
  complete: 'success',
  ok: 'success',
  passed: 'success',
  running: 'info',
  active: 'info',
  in_progress: 'info',
  open: 'info',
  waiting: 'warning',
  blocked: 'warning',
  suspended: 'warning',
  warning: 'warning',
  failed: 'danger',
  error: 'danger',
  critical: 'danger',
};

export const CX_DEFAULT_LABELS: CxGraphLabels = {
  canvas: 'Graph',
  find: 'Find a node',
  findPlaceholder: 'Find a node',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Fit',
  legend: 'Legend',
  nodeTypes: 'Node types',
  edgeTypes: 'Edge types · click to filter',
  group: 'group',
  items: 'items',
  pinned: 'Pinned',
  clickToPin: 'Click node to pin',
  close: 'Close details',
  loading: 'Loading…',
  empty: 'Nothing to show',
  expand: (title) => `Expand ${title}`,
  collapse: (title) => `Collapse ${title}`,
  hidden: (count, noun) => `${count} ${noun} hidden`,
  showMore: (count, noun) => `Show ${count} more ${noun}`,
  incoming: (count) => `${count} incoming`,
  outgoing: (count) => `${count} outgoing`,
  showing: (visible, total) => `Showing ${visible} of ${total}`,
  matches: (count) => (count === 1 ? '1 match' : `${count} matches`),
};

/** "tool_call" becomes "Tool call", "net.host" becomes "Host". */
export function cxHumanize(key: string): string {
  const last = key.split('.').pop() ?? key;
  const words = last.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}

export function cxDefaultStatus(status: string | undefined, tones: Record<string, CxTone>): CxStatus | undefined {
  if (!status) return undefined;
  return { label: cxHumanize(status), tone: tones[status.toLowerCase()] ?? 'basic' };
}
