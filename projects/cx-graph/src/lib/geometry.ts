import { CxEdgeRoute, CxPoint, CxSide } from './layout/layout';

export interface CxEdgeGeometry {
  /** SVG path of the line. */
  d: string;
  /** SVG path of the arrowhead, or an empty string. */
  head: string;
  /** A point half way along the edge, for a label or count. */
  mid: CxPoint;
}

const NORMAL: Record<CxSide, CxPoint> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

const r = (v: number) => Math.round(v * 10) / 10;

/** Builds a smooth path through a route. `shift` separates parallel edges. */
export function edgeGeometry(route: CxEdgeRoute, arrow: boolean, shift: CxPoint = { x: 0, y: 0 }): CxEdgeGeometry {
  const pts = route.points.map((p) => ({ x: p.x + shift.x, y: p.y + shift.y }));
  const n = pts.length;
  const horizontal = route.sourceSide === 'left' || route.sourceSide === 'right';
  const out = NORMAL[route.sourceSide];
  const into = { x: -NORMAL[route.targetSide].x, y: -NORMAL[route.targetSide].y };

  const tangent = (i: number): CxPoint => {
    if (i === 0) return out;
    if (i === n - 1) return into;
    const sign = horizontal ? Math.sign(pts[i + 1].x - pts[i - 1].x) || 1 : Math.sign(pts[i + 1].y - pts[i - 1].y) || 1;
    return horizontal ? { x: sign, y: 0 } : { x: 0, y: sign };
  };

  const tip = pts[n - 1];
  if (arrow) pts[n - 1] = { x: tip.x - into.x * 7, y: tip.y - into.y * 7 };

  let d = `M ${r(pts[0].x)} ${r(pts[0].y)}`;
  const segments: [CxPoint, CxPoint, CxPoint, CxPoint][] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ta = tangent(i);
    const tb = tangent(i + 1);
    const span = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    const reach = Math.max(16, Math.min(140, span * 0.45));
    const c1 = { x: a.x + ta.x * reach, y: a.y + ta.y * reach };
    const c2 = { x: b.x - tb.x * reach, y: b.y - tb.y * reach };
    segments.push([a, c1, c2, b]);
    const straight = ta.x === tb.x && ta.y === tb.y && (ta.x ? Math.abs(a.y - b.y) < 0.5 : Math.abs(a.x - b.x) < 0.5);
    d += straight
      ? ` L ${r(b.x)} ${r(b.y)}`
      : ` C ${r(c1.x)} ${r(c1.y)}, ${r(c2.x)} ${r(c2.y)}, ${r(b.x)} ${r(b.y)}`;
  }

  let head = '';
  if (arrow) {
    const bx = tip.x - into.x * 9;
    const by = tip.y - into.y * 9;
    const px = -into.y * 5;
    const py = into.x * 5;
    head = `M ${r(tip.x)} ${r(tip.y)} L ${r(bx + px)} ${r(by + py)} L ${r(bx - px)} ${r(by - py)} Z`;
  }

  const [a, c1, c2, b] = segments[Math.floor((segments.length - 1) / 2)];
  const mid = {
    x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8,
    y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8,
  };
  return { d, head, mid };
}
