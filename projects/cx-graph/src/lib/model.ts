import type { Observable } from 'rxjs';

/**
 * A semantic colour role. The six built-in tones have default colours.
 * Any other string works when the host defines `--cx-<tone>-tint`,
 * `--cx-<tone>-text` and `--cx-<tone>-line`.
 */
export type CxTone = 'basic' | 'primary' | 'success' | 'info' | 'warning' | 'danger' | (string & {});

export type CxDirection = 'RIGHT' | 'DOWN';

/** A node of the graph. `kind` selects the registered node type. */
export interface CxNode<D = any> {
  id: string;
  kind: string;
  /** Main text of the node. */
  label?: string;
  /** Id of the group node that contains this node. */
  parent?: string;
  /** Free-form status key. The node type maps it to a tone and label. */
  status?: string;
  /**
   * Total number of children when not all of them are loaded yet.
   * The rest is paged in through `hooks.loadChildren`.
   */
  childCount?: number;
  data?: D;
}

/** A directed edge. `kind` selects the registered edge type. */
export interface CxEdge<D = any> {
  id?: string;
  from: string;
  to: string;
  kind: string;
  label?: string;
  data?: D;
}

export interface CxStatus {
  label: string;
  tone: CxTone;
}

/** One row of the detail card. */
export interface CxField {
  label: string;
  value: string;
  mono?: boolean;
}

/** A button on the detail card. Clicking it emits `cxNavigate`. */
export interface CxAction {
  id: string;
  label: string;
  /** Rendered as a plain link when set. `cxNavigate` still fires. */
  href?: string;
  data?: unknown;
}

export interface CxSize {
  width: number;
  height: number;
}

/** How one kind of node looks and behaves. Every member is optional. */
export interface CxNodeType<N extends CxNode = CxNode> {
  /** Kind label shown on the node, the card and the legend. */
  label?: string | ((node: N) => string);
  /** Plural noun for collapsed-group summaries, for example "tool calls". */
  plural?: string;
  /** Icon name. Resolved by the `cxIcon` template or the icon registry. */
  icon?: string;
  border?: 'solid' | 'dashed';
  /** Render the title in the monospace font. */
  mono?: boolean;
  /** Draw a heavier border, for the few nodes that matter most. */
  emphasis?: boolean;
  /** Treat nodes of this kind as groups even when they have no children yet. */
  group?: boolean;
  /** Box size used by the layout. Node content must fit in it. */
  size?: CxSize | ((node: N) => CxSize);
  title?: (node: N) => string;
  subtitle?: (node: N) => string | undefined;
  /** Short reference shown after the kind label, for example "E-12". */
  ref?: (node: N) => string | undefined;
  status?: (node: N) => CxStatus | undefined;
  /** Fill the whole node with a tone, for example a final result. */
  fill?: (node: N) => CxTone | undefined;
  detail?: (node: N) => CxField[];
  actions?: (node: N) => CxAction[];
  /** Hide this kind from the legend. */
  hideInLegend?: boolean;
}

export interface CxEdgeType {
  label?: string;
  tone?: CxTone;
  /** Stroke width in pixels. */
  width?: number;
  /** SVG dash pattern, for example `[6, 5]`. */
  dash?: number[];
  /** Draw an arrowhead at the target. Default true. */
  arrow?: boolean;
  /**
   * Whether edges of this kind decide where nodes go. Default true. Set it
   * to false for edges that should be drawn but must not pull nodes out of
   * order, for example evidence links across a sequence of steps.
   */
  layout?: boolean;
  hideInLegend?: boolean;
}

export interface CxNavigateEvent<N extends CxNode = CxNode> {
  node: N;
  action: CxAction;
}

export interface CxPage {
  offset: number;
  limit: number;
}

export interface CxGraphPatch {
  nodes: CxNode[];
  edges?: CxEdge[];
}

/** Callbacks that hand control back to the host application. */
export interface CxGraphHooks<N extends CxNode = CxNode> {
  /** Called when a card action is used. The host decides where to go. */
  navigate?(event: CxNavigateEvent<N>): void;
  /** Page in children of a group whose `childCount` exceeds what is loaded. */
  loadChildren?(parent: N, page: CxPage): Observable<CxGraphPatch> | Promise<CxGraphPatch>;
  /** Veto or defer an expand, for example for a permission check. */
  beforeExpand?(node: N): boolean | Promise<boolean>;
  /** Detail fields for node types that define none. */
  detail?(node: N): CxField[];
}

/** User-visible strings. Override any of them through the `labels` input. */
export interface CxGraphLabels {
  canvas: string;
  find: string;
  findPlaceholder: string;
  expandAll: string;
  collapseAll: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  legend: string;
  nodeTypes: string;
  edgeTypes: string;
  group: string;
  items: string;
  pinned: string;
  clickToPin: string;
  close: string;
  loading: string;
  empty: string;
  expand: (title: string) => string;
  collapse: (title: string) => string;
  hidden: (count: number, noun: string) => string;
  showMore: (count: number, noun: string) => string;
  incoming: (count: number) => string;
  outgoing: (count: number) => string;
  showing: (visible: number, total: number) => string;
  matches: (count: number) => string;
}

/** Template context of `cxNodeDetail` and `cxNodeBody`. */
export interface CxNodeTemplateContext<N extends CxNode = CxNode> {
  $implicit: N;
  node: N;
  type: CxNodeType<N>;
  status: CxStatus | undefined;
}

/** Template context of `cxIcon`. */
export interface CxIconTemplateContext {
  $implicit: string;
  name: string;
}
