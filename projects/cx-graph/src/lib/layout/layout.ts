import { CxDirection } from '../model';

export interface CxPoint {
  x: number;
  y: number;
}

export interface CxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CxSide = 'left' | 'right' | 'top' | 'bottom';

export interface CxLayoutNode {
  id: string;
  /** Id of the container this node sits in. */
  parent?: string;
  /** Size of a leaf, or the minimum size of a container. */
  width: number;
  height: number;
  /** True when other nodes name this node as their parent. */
  container?: boolean;
}

export interface CxLayoutEdge {
  id: string;
  from: string;
  to: string;
  /** False for an edge that needs a route but must not influence positions. */
  constraint?: boolean;
}

export interface CxInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CxLayoutOptions {
  direction: CxDirection;
  /** Space between two layers. */
  layerGap: number;
  /** Space between two nodes of one layer. */
  nodeGap: number;
  /** Space between a container's border and its children. */
  padding: CxInsets;
  /**
   * A scope without edges would be one long line. It wraps into another
   * layer once a layer is longer than this many pixels.
   */
  wrapAt: number;
}

export interface CxLayoutInput {
  nodes: CxLayoutNode[];
  edges: CxLayoutEdge[];
  options: CxLayoutOptions;
}

export interface CxEdgeRoute {
  /** From the source port to the target port, through any bend points. */
  points: CxPoint[];
  sourceSide: CxSide;
  targetSide: CxSide;
}

export interface CxLayoutResult {
  nodes: Map<string, CxRect>;
  edges: Map<string, CxEdgeRoute>;
  width: number;
  height: number;
}

/**
 * Positions nodes and routes edges. Implement this to plug in another
 * layout, for example ELK or dagre. The result may be a promise, so an
 * engine can run in a web worker.
 */
export interface CxLayoutEngine {
  layout(input: CxLayoutInput): CxLayoutResult | Promise<CxLayoutResult>;
}

export const CX_DEFAULT_LAYOUT_OPTIONS: CxLayoutOptions = {
  direction: 'RIGHT',
  layerGap: 72,
  nodeGap: 20,
  padding: { top: 52, right: 20, bottom: 16, left: 20 },
  wrapAt: 520,
};
