import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  afterNextRender,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  isDevMode,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  CX_DEFAULT_LABELS,
  CX_DEFAULT_STATUS_TONES,
  CX_GRAPH_CONFIG,
  cxDefaultStatus,
  cxHumanize,
} from './config';
import { edgeGeometry } from './geometry';
import { CX_ICONS } from './icons';
import { layeredLayout } from './layout/layered';
import {
  CX_DEFAULT_LAYOUT_OPTIONS,
  CxLayoutEngine,
  CxLayoutNode,
  CxLayoutOptions,
  CxLayoutResult,
  CxPoint,
  CxRect,
} from './layout/layout';
import {
  CxAction,
  CxDirection,
  CxEdge,
  CxEdgeType,
  CxField,
  CxGraphHooks,
  CxGraphLabels,
  CxGraphPatch,
  CxNavigateEvent,
  CxNode,
  CxNodeTemplateContext,
  CxNodeType,
  CxStatus,
  CxTone,
} from './model';
import { CxIconDirective, CxNodeBodyDirective, CxNodeDetailDirective } from './templates';
import { CxViewGraph, CxViewNode, ancestorsOf, buildHierarchy, buildViewGraph, defaultExpanded } from './view-graph';

interface Scene {
  view: CxViewGraph;
  layout: CxLayoutResult;
}

interface SummaryPart {
  color: string;
  pct: number;
}

/** Everything the template needs to draw one node, group or stub. */
export interface CxNodeVm {
  id: string;
  role: 'node' | 'group' | 'more';
  node: CxNode;
  type: CxNodeType<any>;
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
  kindLabel: string;
  icon: string | undefined;
  title: string;
  sub: string | undefined;
  /** The kind label without the node's reference. */
  typeLabel: string;
  status: CxStatus | undefined;
  tone: CxTone;
  filled: boolean;
  aria: string;
  expanded: boolean;
  total: number;
  remaining: number;
  noun: string;
  summaryParts: SummaryPart[];
  summaryText: string;
  ctx: CxNodeTemplateContext<any>;
  body: TemplateRef<CxNodeTemplateContext<any>> | undefined;
}

interface EdgeVm {
  id: string;
  from: string;
  to: string;
  kind: string;
  d: string;
  head: string;
  mid: CxPoint;
  color: string;
  width: number;
  dash: string | null;
  badge: string | undefined;
}

interface CardVm {
  vm: CxNodeVm;
  pinned: boolean;
  x: number;
  y: number;
  width: number;
  fields: CxField[];
  detail: TemplateRef<CxNodeTemplateContext<any>> | undefined;
  actions: CxAction[];
  incoming: number;
  outgoing: number;
}

const TOGGLE_ACTION = 'cx:toggle';
const CARD_WIDTH = 340;
const DEFAULT_SIZE = { width: 240, height: 76 };
const MONO_SIZE = { width: 240, height: 56 };
const GROUP_SIZE = { width: 280, height: 112 };
const MORE_SIZE = { width: 240, height: 44 };
const CULL_ABOVE = 300;

function toneVar(tone: CxTone, part: 'tint' | 'text' | 'line'): string {
  return `var(--cx-${tone}-${part}, var(--cxd-${tone}-${part}, var(--cxd-basic-${part})))`;
}

function isThenable<T>(v: unknown): v is PromiseLike<T> {
  return !!v && typeof (v as PromiseLike<T>).then === 'function';
}

/**
 * An explorable graph: pan and zoom, collapsible groups, a detail card on
 * hover or pin, edge filtering, search and a minimap. It knows nothing
 * about the host application. Node and edge kinds, icons, colours and
 * navigation all come from the host.
 */
@Component({
  selector: 'cx-graph',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './cx-graph.component.html',
  styleUrl: './cx-graph.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'cx-graph',
    '[class.cx-graph--panning]': 'panning()',
    '[class.cx-graph--still]': '!animate()',
  },
})
export class CxGraphComponent {
  private readonly config = inject(CX_GRAPH_CONFIG, { optional: true }) ?? {};
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  // ---- Data
  readonly nodes = input<readonly CxNode[]>([]);
  readonly edges = input<readonly CxEdge[]>([]);
  /** Node types for this graph. Merged over the ones from `provideCxGraph`. */
  readonly nodeTypes = input<Record<string, CxNodeType<any>>>({});
  readonly edgeTypes = input<Record<string, CxEdgeType>>({});
  readonly hooks = input<CxGraphHooks<any>>({});

  // ---- Layout
  readonly direction = input<CxDirection>('RIGHT');
  readonly layout = input<CxLayoutEngine | null>(null);
  readonly layoutOptions = input<Partial<Omit<CxLayoutOptions, 'direction'>>>({});
  /** Groups nested less deep than this start expanded. */
  readonly expandDepth = input(1);
  /** Groups with more children than this start collapsed. */
  readonly collapseThreshold = input(12);
  /** Children shown when a group opens, and added by each "show more". */
  readonly pageSize = input(8);

  // ---- State. Each of these supports two-way binding.
  /** Ids of expanded groups. `null` means "use the defaults". */
  readonly expanded = model<ReadonlySet<string> | null>(null);
  /** Id of the pinned node. */
  readonly selected = model<string | null>(null);
  readonly hiddenEdgeKinds = model<ReadonlySet<string>>(new Set<string>());
  readonly query = model('');
  readonly legendOpen = model(true);
  /** Node ids to emphasise, for example one path. Everything else is dimmed. */
  readonly highlight = input<ReadonlySet<string> | readonly string[] | null>(null);

  // ---- Chrome
  readonly toolbar = input(true);
  readonly legend = input(true);
  readonly minimap = input(true);
  /** What the mouse wheel does. Ctrl or Cmd plus wheel always zooms. */
  readonly wheel = input<'pan' | 'zoom' | 'none'>('pan');
  readonly minZoom = input(0.2);
  readonly maxZoom = input(2);
  readonly labels = input<Partial<CxGraphLabels>>({});

  /** A card action was used. */
  readonly cxNavigate = output<CxNavigateEvent<any>>();
  /** The hovered or focused node changed. */
  readonly cxHover = output<CxNode | null>();
  readonly cxNodeClick = output<CxNode>();

  private readonly detailTemplates = contentChildren(CxNodeDetailDirective);
  private readonly bodyTemplates = contentChildren(CxNodeBodyDirective);
  protected readonly iconTemplate = contentChild(CxIconDirective);
  private readonly viewportRef = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly cardRef = viewChild<ElementRef<HTMLElement>>('card');

  // ---- Resolved configuration
  protected readonly text = computed<CxGraphLabels>(() => ({
    ...CX_DEFAULT_LABELS,
    ...this.config.labels,
    ...this.labels(),
  }));
  private readonly allNodeTypes = computed(() => ({ ...this.config.nodeTypes, ...this.nodeTypes() }));
  private readonly allEdgeTypes = computed(() => ({ ...this.config.edgeTypes, ...this.edgeTypes() }));
  private readonly statusTones = { ...CX_DEFAULT_STATUS_TONES, ...this.config.statusTones };
  private readonly icons: Record<string, string> = { ...CX_ICONS, ...this.config.icons };
  private readonly warned = new Set<string>();

  // ---- Graph
  private readonly lazy = signal<{ nodes: CxNode[]; edges: CxEdge[] }>({ nodes: [], edges: [] });
  private readonly shown = signal<ReadonlyMap<string, number>>(new Map());
  protected readonly loading = signal<ReadonlySet<string>>(new Set());
  private readonly knownGroups = new Set<string>();

  private readonly allNodes = computed<readonly CxNode[]>(() => {
    const extra = this.lazy().nodes;
    if (!extra.length) return this.nodes();
    const ids = new Set(this.nodes().map((n) => n.id));
    return [...this.nodes(), ...extra.filter((n) => !ids.has(n.id))];
  });
  private readonly allEdges = computed<readonly CxEdge[]>(() => {
    const extra = this.lazy().edges;
    return extra.length ? [...this.edges(), ...extra] : this.edges();
  });
  private readonly isGroupKind = computed(() => {
    const types = this.allNodeTypes();
    return (kind: string) => !!types[kind]?.group;
  });
  private readonly hierarchy = computed(() => buildHierarchy(this.allNodes(), this.isGroupKind()));
  private readonly defaults = computed(() =>
    defaultExpanded(this.allNodes(), this.isGroupKind(), this.expandDepth(), this.collapseThreshold()),
  );
  private readonly expandedSet = computed<ReadonlySet<string>>(() => this.expanded() ?? this.defaults());

  private readonly view = computed(() =>
    buildViewGraph(this.allNodes(), this.allEdges(), {
      expanded: this.expandedSet(),
      shown: (id) => this.shown().get(id) ?? this.pageSize(),
      isGroupKind: this.isGroupKind(),
      hiddenEdgeKinds: this.hiddenEdgeKinds(),
    }),
  );

  private readonly scene = signal<Scene | null>(null);
  private layoutRun = 0;

  // ---- Viewport
  protected readonly tx = signal(0);
  protected readonly ty = signal(0);
  /** Current zoom factor, 1 = 100%. */
  readonly zoom = signal(1);
  private readonly size = signal({ width: 0, height: 0 });
  protected readonly panning = signal(false);
  protected readonly animate = signal(false);
  private fitted = false;
  private anchor: { id: string; x: number; y: number } | null = null;
  private centreOn: string | null = null;

  // ---- Interaction
  private readonly hover = signal<string | null>(null);
  private readonly active = signal<string | null>(null);
  private readonly cardHeight = signal(280);
  private hoverTimer: ReturnType<typeof setTimeout> | undefined;
  private pointers = new Map<number, CxPoint>();
  private drag: { x: number; y: number; tx: number; ty: number; moved: boolean; onNode: boolean } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;
  private suppressClick = false;

  /** Number of nodes on screen. Stubs are not counted. */
  readonly visibleCount = computed(() => this.vms().filter((n) => n.role !== 'more').length);
  readonly totalCount = computed(() => this.allNodes().length);
  protected readonly zoomPct = computed(() => Math.round(this.zoom() * 100));

  constructor() {
    // Lay out whenever the visible graph changes.
    effect(() => {
      const view = this.view();
      const engine = this.layout() ?? this.config.layout ?? { layout: layeredLayout };
      const direction = this.direction();
      const options: CxLayoutOptions = {
        ...CX_DEFAULT_LAYOUT_OPTIONS,
        // Rows have more room than columns before they need to wrap.
        wrapAt: direction === 'DOWN' ? 1040 : CX_DEFAULT_LAYOUT_OPTIONS.wrapAt,
        ...this.layoutOptions(),
        direction,
      };
      const types = this.allNodeTypes();
      const edgeTypes = this.allEdgeTypes();
      untracked(() => {
        const run = ++this.layoutRun;
        const result = engine.layout({
          nodes: view.nodes.map((v) => this.layoutNode(v, types)),
          edges: view.edges.map((e) => ({
            id: e.id,
            from: e.from,
            to: e.to,
            constraint: edgeTypes[e.kind]?.layout !== false,
          })),
          options,
        });
        if (isThenable<CxLayoutResult>(result)) {
          result.then((r) => run === this.layoutRun && this.commit({ view, layout: r }));
        } else {
          this.commit({ view, layout: result });
        }
      });
    });

    // New groups in a live graph follow the default expand rule.
    effect(() => {
      const h = this.hierarchy();
      const defaults = this.defaults();
      untracked(() => {
        const current = this.expanded();
        const add: string[] = [];
        for (const n of h.byId.values()) {
          if (!h.isGroup(n) || this.knownGroups.has(n.id)) continue;
          this.knownGroups.add(n.id);
          if (current && defaults.has(n.id) && !current.has(n.id)) add.push(n.id);
        }
        if (current && add.length) this.expanded.set(new Set([...current, ...add]));
      });
    });

    // Page in children that an open group needs but does not have yet.
    effect(() => {
      const view = this.view();
      const h = this.hierarchy();
      untracked(() => {
        for (const v of view.nodes) {
          if (v.role !== 'group' || !v.expanded) continue;
          const want = Math.min(this.shown().get(v.id) ?? this.pageSize(), v.totalChildren);
          const have = h.children.get(v.id)?.length ?? 0;
          if (have < want) this.load(v.node, have, want - have);
        }
      });
    });

    effect(() => {
      const id = this.hover();
      untracked(() => this.cxHover.emit(id ? (this.vmById().get(id)?.node ?? null) : null));
    });

    // Fit once the first layout and the viewport size are both known.
    effect(() => {
      const scene = this.scene();
      const size = this.size();
      if (this.fitted || !scene?.view.nodes.length || !size.width || !size.height) return;
      untracked(() => {
        this.fitted = true;
        this.resetView();
        setTimeout(() => this.animate.set(true), 60);
      });
    });

    afterNextRender(() => {
      const el = this.viewportRef().nativeElement;
      const measure = () => this.size.set({ width: el.clientWidth, height: el.clientHeight });
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        this.destroyRef.onDestroy(() => ro.disconnect());
      }
    });

    effect((onCleanup) => {
      const el = this.cardRef()?.nativeElement;
      if (!el) return;
      const measure = () => this.cardHeight.set(el.offsetHeight);
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      onCleanup(() => ro.disconnect());
    });

    this.destroyRef.onDestroy(() => clearTimeout(this.hoverTimer));
  }

  private readonly destroyRef = inject(DestroyRef);

  // ------------------------------------------------------------------ view models

  private typeOf(kind: string, types: Record<string, CxNodeType<any>>): CxNodeType<any> {
    const type = types[kind];
    if (type) return type;
    if (isDevMode() && !this.warned.has(kind)) {
      this.warned.add(kind);
      console.warn(`cx-graph: no node type registered for kind "${kind}". Using the default type.`);
    }
    return {};
  }

  private statusOf(node: CxNode, type: CxNodeType<any>): CxStatus | undefined {
    return type.status ? type.status(node) : cxDefaultStatus(node.status, this.statusTones);
  }

  private isOpenGroup(v: CxViewNode): boolean {
    return v.role === 'group' && v.expanded && v.totalChildren > 0;
  }

  private layoutNode(v: CxViewNode, types: Record<string, CxNodeType<any>>): CxLayoutNode {
    let size = DEFAULT_SIZE;
    let container = false;
    if (v.role === 'more') {
      size = MORE_SIZE;
    } else if (this.isOpenGroup(v)) {
      size = { width: GROUP_SIZE.width, height: 0 };
      container = true;
    } else if (v.role === 'group' && v.totalChildren > 0) {
      size = GROUP_SIZE;
    } else {
      const type = types[v.node.kind] ?? {};
      const own = typeof type.size === 'function' ? type.size(v.node) : type.size;
      size = own ?? (type.mono ? MONO_SIZE : DEFAULT_SIZE);
    }
    return { id: v.id, parent: v.parent, width: size.width, height: size.height, container };
  }

  protected readonly vms = computed<CxNodeVm[]>(() => {
    const scene = this.scene();
    if (!scene) return [];
    const types = this.allNodeTypes();
    const text = this.text();
    const bodies = new Map(this.bodyTemplates().map((d) => [d.kind(), d.template] as const));
    const out: CxNodeVm[] = [];
    for (const v of scene.view.nodes) {
      const rect = scene.layout.nodes.get(v.id);
      if (!rect) continue;
      const node = v.node;
      const type = this.typeOf(node.kind, types);
      const group = v.role === 'group' && v.totalChildren > 0;
      const role = v.role === 'more' ? 'more' : group ? 'group' : 'node';
      const ref = type.ref?.(node);
      const typeLabel = typeof type.label === 'function' ? type.label(node) : (type.label ?? cxHumanize(node.kind));
      const kindLabel = ref ? typeLabel + ' · ' + ref : typeLabel;
      const title = type.title?.(node) ?? node.label ?? node.id;
      const status = role === 'more' ? undefined : this.statusOf(node, type);
      const fill = role === 'node' ? type.fill?.(node) : undefined;
      const tone = fill ?? status?.tone ?? 'basic';

      // What a group's children are called, and how they are doing.
      let noun = text.items;
      const parts: SummaryPart[] = [];
      let summaryText = '';
      if (role !== 'node') {
        const kinds = new Set(v.children.map((c) => c.kind));
        if (kinds.size === 1) noun = this.typeOf([...kinds][0], types).plural ?? text.items;
        if (role === 'group' && !v.expanded) {
          const byLabel = new Map<string, { count: number; tone: CxTone }>();
          for (const c of v.children) {
            const s = this.statusOf(c, this.typeOf(c.kind, types));
            if (!s) continue;
            const hit = byLabel.get(s.label);
            if (hit) hit.count++;
            else byLabel.set(s.label, { count: 1, tone: s.tone });
          }
          const counted = [...byLabel.values()].reduce((sum, p) => sum + p.count, 0);
          for (const p of byLabel.values()) {
            parts.push({ color: toneVar(p.tone, 'line'), pct: (p.count / counted) * 100 });
          }
          summaryText = [...byLabel].map(([label, p]) => `${p.count} ${label.toLowerCase()}`).join(' · ');
        }
      }

      const chip = status ?? { tone: 'basic' as CxTone };
      const style =
        `transform:translate(${rect.x}px,${rect.y}px);width:${rect.width}px;height:${rect.height}px;` +
        `--cx-t-tint:${toneVar(chip.tone, 'tint')};--cx-t-text:${toneVar(chip.tone, 'text')};` +
        `--cx-t-line:${toneVar(tone, 'line')};` +
        (fill ? `--cx-t-fill:${toneVar(fill, 'tint')};` : '');

      out.push({
        id: v.id,
        role,
        node,
        type,
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        style,
        kindLabel,
        icon: type.icon,
        title,
        sub: role === 'node' ? type.subtitle?.(node) : undefined,
        typeLabel,
        status,
        tone,
        filled: !!fill,
        aria: [kindLabel + ': ' + title, status?.label].filter(Boolean).join(', '),
        expanded: v.expanded,
        total: v.totalChildren,
        remaining: v.remaining,
        noun,
        summaryParts: parts,
        summaryText,
        ctx: { $implicit: node, node, type, status },
        body: role === 'node' ? (bodies.get(node.kind) ?? bodies.get('')) : undefined,
      });
    }
    return out;
  });

  protected readonly vmById = computed(() => new Map(this.vms().map((n) => [n.id, n] as const)));

  /** World-space rectangle that is on screen, or null when culling is off. */
  private readonly window = computed<CxRect | null>(() => {
    if (this.vms().length <= CULL_ABOVE) return null;
    const k = this.zoom();
    const s = this.size();
    const margin = 240;
    return {
      x: -this.tx() / k - margin,
      y: -this.ty() / k - margin,
      width: s.width / k + margin * 2,
      height: s.height / k + margin * 2,
    };
  });

  private inWindow(w: CxRect | null, x: number, y: number, width: number, height: number): boolean {
    return !w || (x < w.x + w.width && x + width > w.x && y < w.y + w.height && y + height > w.y);
  }

  protected readonly groupVms = computed(() => {
    const w = this.window();
    return this.vms().filter((n) => n.role === 'group' && this.inWindow(w, n.x, n.y, n.w, n.h));
  });

  protected readonly leafVms = computed(() => {
    const w = this.window();
    const keep = this.active();
    return this.vms().filter(
      (n) => n.role !== 'group' && (n.id === keep || this.inWindow(w, n.x, n.y, n.w, n.h)),
    );
  });

  protected readonly edgeVms = computed<EdgeVm[]>(() => {
    const scene = this.scene();
    if (!scene) return [];
    const types = this.allEdgeTypes();
    const horizontal = this.direction() === 'RIGHT';

    // Edges that join the same two nodes are drawn side by side.
    const lanes = new Map<string, string[]>();
    for (const e of scene.view.edges) {
      const key = e.from < e.to ? e.from + '\u0000' + e.to : e.to + '\u0000' + e.from;
      const list = lanes.get(key);
      if (list) list.push(e.id);
      else lanes.set(key, [e.id]);
    }

    const out: EdgeVm[] = [];
    for (const e of scene.view.edges) {
      const route = scene.layout.edges.get(e.id);
      if (!route) continue;
      const type = types[e.kind] ?? {};
      const key = e.from < e.to ? e.from + '\u0000' + e.to : e.to + '\u0000' + e.from;
      const lane = lanes.get(key)!;
      const offset = (lane.indexOf(e.id) - (lane.length - 1) / 2) * 9;
      const geo = edgeGeometry(route, type.arrow !== false, horizontal ? { x: 0, y: offset } : { x: offset, y: 0 });
      const badge = [e.label, e.count > 1 ? '×' + e.count : ''].filter(Boolean).join(' ');
      out.push({
        id: e.id,
        from: e.from,
        to: e.to,
        kind: e.kind,
        d: geo.d,
        head: geo.head,
        mid: geo.mid,
        color: toneVar(type.tone ?? 'basic', 'line'),
        width: type.width ?? 1.5,
        dash: type.dash?.length ? type.dash.join(' ') : null,
        badge: badge || undefined,
      });
    }
    // Nudge badges apart where several edges share a stretch of path.
    const placed: CxPoint[] = [];
    for (const e of out) {
      if (!e.badge) continue;
      const p = { ...e.mid };
      for (let tries = 0; tries < 8 && placed.some((q) => Math.abs(q.x - p.x) < 34 && Math.abs(q.y - p.y) < 18); tries++) {
        if (horizontal) p.y += 19;
        else p.x += 36;
      }
      placed.push(p);
      e.mid = p;
    }
    return out;
  });

  protected readonly world = computed(() => {
    const l = this.scene()?.layout;
    return { width: Math.max(1, l?.width ?? 1), height: Math.max(1, l?.height ?? 1) };
  });

  protected readonly worldTransform = computed(
    () => `translate(${this.tx()}px, ${this.ty()}px) scale(${this.zoom()})`,
  );

  // ------------------------------------------------------------------ focus, search, highlight

  /** The visible node that stands for the pinned node. */
  protected readonly pinnedId = computed(() => {
    const id = this.selected();
    const scene = this.scene();
    if (!id || !scene) return null;
    const rep = scene.view.rep.get(id);
    return rep && this.vmById().has(rep) ? rep : null;
  });

  private readonly focusId = computed(() => {
    const hover = this.hover();
    return this.pinnedId() ?? (hover && this.vmById().has(hover) ? hover : null);
  });

  /** Matches per visible node. A collapsed group counts the matches inside it. */
  protected readonly matches = computed<ReadonlyMap<string, number> | null>(() => {
    const q = this.query().trim().toLowerCase();
    const scene = this.scene();
    if (!q || !scene) return null;
    const types = this.allNodeTypes();
    const result = new Map<string, number>();
    for (const n of this.allNodes()) {
      const type = types[n.kind] ?? {};
      const kindLabel = typeof type.label === 'function' ? type.label(n) : (type.label ?? cxHumanize(n.kind));
      const hay = [type.title?.(n) ?? n.label ?? '', kindLabel, n.kind, type.ref?.(n) ?? '', n.id].join(' ');
      if (!hay.toLowerCase().includes(q)) continue;
      const rep = scene.view.rep.get(n.id);
      if (rep) result.set(rep, (result.get(rep) ?? 0) + 1);
    }
    return result;
  });

  readonly matchCount = computed(() => {
    let total = 0;
    for (const count of this.matches()?.values() ?? []) total += count;
    return total;
  });

  /** Ids that stay at full strength. Null means nothing is dimmed. */
  protected readonly lit = computed<ReadonlySet<string> | null>(() => {
    const scene = this.scene();
    if (!scene) return null;
    const focus = this.focusId();
    const matches = this.matches();
    let lit: Set<string> | null = null;

    if (focus) {
      const core = new Set<string>([focus]);
      if (scene.view.byId.get(focus)?.expanded) {
        for (const v of scene.view.nodes) if (this.under(scene.view, v, focus)) core.add(v.id);
      }
      lit = new Set(core);
      for (const e of scene.view.edges) {
        if (core.has(e.from)) lit.add(e.to);
        if (core.has(e.to)) lit.add(e.from);
      }
    } else {
      const h = this.highlight();
      const ids = h ? (h instanceof Set ? h : new Set(h as readonly string[])) : null;
      if (ids?.size) {
        lit = new Set<string>();
        for (const id of ids) {
          const rep = scene.view.rep.get(id);
          if (rep) lit.add(rep);
        }
      }
    }
    if (matches) {
      lit = lit ? new Set([...lit].filter((id) => matches.has(id))) : new Set(matches.keys());
    }
    if (!lit) return null;
    // A container stays lit while anything inside it is.
    for (const id of [...lit]) {
      let cur = scene.view.byId.get(id);
      while (cur?.parent !== undefined) {
        lit.add(cur.parent);
        cur = scene.view.byId.get(cur.parent);
      }
    }
    return lit;
  });

  private under(view: CxViewGraph, v: CxViewNode, ancestor: string): boolean {
    let cur: CxViewNode | undefined = v;
    while (cur?.parent !== undefined) {
      if (cur.parent === ancestor) return true;
      cur = view.byId.get(cur.parent);
    }
    return false;
  }

  protected isDim(id: string): boolean {
    const lit = this.lit();
    return !!lit && !lit.has(id);
  }

  /** 0 = dimmed, 1 = normal, 2 = emphasised. */
  protected edgeLevel(e: EdgeVm): 0 | 1 | 2 {
    const lit = this.lit();
    if (!lit) return 1;
    const focus = this.focusId();
    if (focus) {
      const scene = this.scene()!;
      const touches = (id: string) => id === focus || this.under(scene.view, scene.view.byId.get(id)!, focus);
      return touches(e.from) || touches(e.to) ? 2 : 0;
    }
    return lit.has(e.from) && lit.has(e.to) ? 2 : 0;
  }

  protected readonly tabId = computed(() => {
    const active = this.active();
    const vms = this.vms();
    return active && this.vmById().has(active) ? active : (vms[0]?.id ?? null);
  });

  // ------------------------------------------------------------------ detail card

  protected readonly card = computed<CardVm | null>(() => {
    const id = this.focusId();
    const scene = this.scene();
    const vm = id ? this.vmById().get(id) : undefined;
    if (!vm || !scene || vm.role === 'more' || this.panning()) return null;
    const hooks = this.hooks();
    const details = new Map(this.detailTemplates().map((d) => [d.kind(), d.template] as const));
    const detail = details.get(vm.node.kind) ?? details.get('');
    const fields = detail ? [] : (vm.type.detail?.(vm.node) ?? hooks.detail?.(vm.node) ?? []);
    const text = this.text();
    const actions: CxAction[] = [];
    if (vm.role === 'group') {
      actions.push({ id: TOGGLE_ACTION, label: vm.expanded ? text.collapse('').trim() : text.expand('').trim() });
    }
    actions.push(...(vm.type.actions?.(vm.node) ?? []));

    // Relations count every edge that crosses the node's boundary.
    let incoming = 0;
    let outgoing = 0;
    for (const e of this.allEdges()) {
      if (this.hiddenEdgeKinds().has(e.kind)) continue;
      const from = this.inside(e.from, vm.node.id);
      const to = this.inside(e.to, vm.node.id);
      if (to && !from) incoming++;
      if (from && !to) outgoing++;
    }

    const k = this.zoom();
    const size = this.size();
    const width = Math.min(CARD_WIDTH, Math.max(200, size.width - 16));
    const anchorH = vm.role === 'group' && vm.expanded ? Math.min(vm.h, 52) : vm.h;
    const left = vm.x * k + this.tx();
    const top = vm.y * k + this.ty();
    const right = left + vm.w * k;
    let x = right + 12;
    if (x + width > size.width - 8) x = left - 12 - width;
    if (x < 8) x = Math.max(8, Math.min(size.width - width - 8, right + 12));
    const maxY = Math.max(8, size.height - this.cardHeight() - 8);
    let y = Math.max(8, Math.min(top - 8, maxY));
    // When the card had to sit over the node, move it below or above instead.
    if (x < right && x + width > left) {
      const below = top + anchorH * k + 12;
      y = below + this.cardHeight() <= size.height - 8 ? below : Math.max(8, top - 12 - this.cardHeight());
    }
    return {
      vm,
      pinned: this.pinnedId() === vm.id,
      x,
      y,
      width,
      fields,
      detail,
      actions,
      incoming,
      outgoing,
    };
  });

  private inside(id: string, ancestor: string): boolean {
    const byId = this.hierarchy().byId;
    let cur = byId.get(id);
    let guard = 0;
    while (cur && guard++ < 1000) {
      if (cur.id === ancestor) return true;
      cur = cur.parent !== undefined ? byId.get(cur.parent) : undefined;
    }
    return false;
  }

  // ------------------------------------------------------------------ legend and minimap

  protected readonly legendNodes = computed(() => {
    const types = this.allNodeTypes();
    const kinds = [...new Set(this.allNodes().map((n) => n.kind))];
    return kinds
      .filter((k) => !types[k]?.hideInLegend)
      .map((k) => {
        const type = types[k] ?? {};
        return { key: k, icon: type.icon, label: typeof type.label === 'string' ? type.label : cxHumanize(k) };
      });
  });

  protected readonly legendEdges = computed(() => {
    const types = this.allEdgeTypes();
    const hidden = this.hiddenEdgeKinds();
    const kinds = [...new Set(this.allEdges().map((e) => e.kind))];
    return kinds
      .filter((k) => !types[k]?.hideInLegend)
      .map((k) => {
        const type = types[k] ?? {};
        return {
          key: k,
          label: type.label ?? cxHumanize(k),
          color: toneVar(type.tone ?? 'basic', 'line'),
          width: type.width ?? 1.5,
          dash: type.dash?.length ? type.dash.join(' ') : null,
          on: !hidden.has(k),
        };
      });
  });

  protected readonly mini = computed(() => {
    const world = this.world();
    const boxW = 188;
    const boxH = 96;
    const s = Math.min(boxW / world.width, boxH / world.height);
    const ox = (boxW - world.width * s) / 2;
    const oy = (boxH - world.height * s) / 2;
    const k = this.zoom();
    const size = this.size();
    return {
      scale: s,
      ox,
      oy,
      rects: this.vms().map((n) => ({
        id: n.id,
        x: ox + n.x * s,
        y: oy + n.y * s,
        w: Math.max(1.5, n.w * s),
        h: Math.max(1.5, n.h * s),
        group: n.role === 'group',
        color: toneVar(n.tone, 'line'),
      })),
      view: {
        x: ox + (-this.tx() / k) * s,
        y: oy + (-this.ty() / k) * s,
        w: (size.width / k) * s,
        h: (size.height / k) * s,
      },
    };
  });

  protected iconPath(name: string | undefined): string | null {
    return name ? (this.icons[name] ?? null) : null;
  }

  // ------------------------------------------------------------------ layout bookkeeping

  private commit(scene: Scene): void {
    this.scene.set(scene);
    const k = this.zoom();
    if (this.anchor) {
      const rect = scene.layout.nodes.get(this.anchor.id);
      if (rect) {
        this.tx.set(this.anchor.x - rect.x * k);
        this.ty.set(this.anchor.y - rect.y * k);
      }
      this.anchor = null;
    }
    if (this.centreOn) {
      const rep = scene.view.rep.get(this.centreOn);
      const rect = rep ? scene.layout.nodes.get(rep) : undefined;
      if (rect && rep === this.centreOn) {
        this.centreRect(rect);
        this.centreOn = null;
      }
    }
  }

  private centreRect(rect: CxRect): void {
    const k = this.zoom();
    const size = this.size();
    this.tx.set(size.width / 2 - (rect.x + rect.width / 2) * k);
    this.ty.set(size.height / 2 - (rect.y + Math.min(rect.height, 120) / 2) * k);
  }

  /** Keeps a node where it is on screen while the layout around it changes. */
  private holdStill(id: string): void {
    const rect = this.scene()?.layout.nodes.get(id);
    if (rect) this.anchor = { id, x: rect.x * this.zoom() + this.tx(), y: rect.y * this.zoom() + this.ty() };
  }

  // ------------------------------------------------------------------ public API

  /** Zooms out until the whole graph is in view. */
  fit(): void {
    this.applyFit(this.minZoom());
  }

  /** The opening view: fits the graph, but never so small that text is unreadable. */
  resetView(): void {
    this.applyFit(Math.max(this.minZoom(), 0.55));
  }

  private applyFit(floor: number): void {
    const world = this.world();
    const size = this.size();
    if (!size.width || !size.height) return;
    const pad = 32;
    const k = Math.max(
      floor,
      Math.min(1, (size.width - pad * 2) / world.width, (size.height - pad * 2) / world.height),
    );
    const w = world.width * k;
    const h = world.height * k;
    this.zoom.set(k);
    this.tx.set(w <= size.width - pad * 2 ? (size.width - w) / 2 : pad);
    this.ty.set(h <= size.height - pad * 2 ? (size.height - h) / 2 : pad);
  }

  zoomIn(): void {
    this.zoomAt(this.zoom() * 1.2);
  }

  zoomOut(): void {
    this.zoomAt(this.zoom() / 1.2);
  }

  /** Sets the zoom, keeping the given viewport point (default: the centre) in place. */
  zoomAt(next: number, at?: CxPoint): void {
    const size = this.size();
    const p = at ?? { x: size.width / 2, y: size.height / 2 };
    const k = this.zoom();
    const clamped = Math.max(this.minZoom(), Math.min(this.maxZoom(), next));
    if (clamped === k) return;
    this.tx.set(p.x - ((p.x - this.tx()) / k) * clamped);
    this.ty.set(p.y - ((p.y - this.ty()) / k) * clamped);
    this.zoom.set(clamped);
  }

  expandAll(): void {
    const h = this.hierarchy();
    const all = new Set<string>();
    for (const n of h.byId.values()) if (h.isGroup(n)) all.add(n.id);
    this.expanded.set(all);
  }

  collapseAll(): void {
    this.expanded.set(new Set());
  }

  /** Expands or collapses a group. Resolves to false when `beforeExpand` vetoed it. */
  async toggle(id: string, open?: boolean): Promise<boolean> {
    const node = this.hierarchy().byId.get(id);
    if (!node) return false;
    const current = this.expandedSet();
    const next = open ?? !current.has(id);
    if (next === current.has(id)) return true;
    if (next) {
      const allowed = await (this.hooks().beforeExpand?.(node) ?? true);
      if (!allowed) return false;
    }
    this.holdStill(id);
    const set = new Set(this.expandedSet());
    if (next) set.add(id);
    else set.delete(id);
    this.expanded.set(set);
    return true;
  }

  /** Shows the next page of a group's children. */
  showMore(groupId: string): void {
    const now = this.shown().get(groupId) ?? this.pageSize();
    const map = new Map(this.shown());
    map.set(groupId, now + this.pageSize());
    this.holdStill(groupId);
    this.shown.set(map);
  }

  /** Opens every group around a node, pins it and brings it to the centre. */
  reveal(id: string): void {
    const nodes = this.allNodes();
    const h = this.hierarchy();
    if (!h.byId.has(id)) return;
    const chain = ancestorsOf(nodes, id);
    const set = new Set(this.expandedSet());
    const shown = new Map(this.shown());
    let child = id;
    for (const parent of chain) {
      set.add(parent);
      const index = (h.children.get(parent) ?? []).findIndex((c) => c.id === child);
      const have = shown.get(parent) ?? this.pageSize();
      if (index >= have) shown.set(parent, index + 1);
      child = parent;
    }
    this.centreOn = id;
    this.shown.set(shown);
    this.expanded.set(set);
    this.selected.set(id);
    this.active.set(id);
    // When nothing had to open, the layout does not run again.
    const scene = this.scene();
    const rect = scene?.view.rep.get(id) === id ? scene.layout.nodes.get(id) : undefined;
    if (rect) {
      this.centreRect(rect);
      this.centreOn = null;
    }
  }

  // ------------------------------------------------------------------ lazy children

  private load(parent: CxNode, offset: number, limit: number): void {
    const hook = this.hooks().loadChildren;
    if (!hook || this.loading().has(parent.id)) return;
    this.loading.update((s) => new Set(s).add(parent.id));
    const done = (patch?: CxGraphPatch) => {
      if (patch?.nodes.length || patch?.edges?.length) {
        this.lazy.update((l) => ({
          nodes: [...l.nodes, ...patch.nodes],
          edges: [...l.edges, ...(patch.edges ?? [])],
        }));
      }
      this.loading.update((s) => {
        const next = new Set(s);
        next.delete(parent.id);
        return next;
      });
    };
    const result = hook(parent, { offset, limit });
    if (isThenable<CxGraphPatch>(result)) {
      result.then(done, () => done());
    } else {
      let last: CxGraphPatch | undefined;
      const sub = result.subscribe({
        next: (p) => (last = p),
        error: () => done(),
        complete: () => done(last),
      });
      this.destroyRef.onDestroy(() => sub.unsubscribe());
    }
  }

  // ------------------------------------------------------------------ node events

  protected onNodeClick(vm: CxNodeVm): void {
    if (this.suppressClick) return;
    if (vm.role === 'more') {
      this.showMore(vm.node.id);
      return;
    }
    this.selected.set(this.pinnedId() === vm.id ? null : vm.node.id);
    this.cxNodeClick.emit(vm.node);
  }

  protected onToggleClick(vm: CxNodeVm): void {
    if (this.suppressClick) return;
    void this.toggle(vm.node.id);
  }

  protected onEnter(vm: CxNodeVm, event: PointerEvent): void {
    if (event.pointerType === 'touch' || this.drag?.moved || vm.role === 'more') return;
    clearTimeout(this.hoverTimer);
    const delay = this.hover() ? 60 : 140;
    this.hoverTimer = setTimeout(() => this.hover.set(vm.id), delay);
  }

  protected onLeave(): void {
    clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => this.hover.set(null), 220);
  }

  protected onCardEnter(): void {
    clearTimeout(this.hoverTimer);
  }

  protected onFocus(vm: CxNodeVm, event: FocusEvent): void {
    this.active.set(vm.id);
    const el = event.target as HTMLElement;
    if (vm.role !== 'more' && el.matches?.(':focus-visible')) {
      clearTimeout(this.hoverTimer);
      this.hover.set(vm.id);
      this.bringIntoView(vm);
    }
  }

  protected onBlur(): void {
    this.onLeave();
  }

  protected onNodeKey(vm: CxNodeVm, event: KeyboardEvent): void {
    const dir: Record<string, CxPoint> = {
      ArrowRight: { x: 1, y: 0 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowDown: { x: 0, y: 1 },
      ArrowUp: { x: 0, y: -1 },
    };
    if (dir[event.key]) {
      event.preventDefault();
      const next = this.nearest(vm, dir[event.key]);
      if (next) this.focusNode(next.id);
    } else if (event.key === ' ' && vm.role === 'group') {
      event.preventDefault();
      void this.toggle(vm.node.id).then(() => this.focusNode(vm.id));
    }
  }

  protected onKey(event: KeyboardEvent): void {
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    if (event.key === 'Escape') {
      if (this.selected() || this.hover()) event.stopPropagation();
      this.selected.set(null);
      this.hover.set(null);
    } else if (event.key === '+' || event.key === '=') {
      this.zoomIn();
    } else if (event.key === '-') {
      this.zoomOut();
    } else if (event.key === '0') {
      this.fit();
    }
  }

  private nearest(from: CxNodeVm, dir: CxPoint): CxNodeVm | null {
    const head = (n: CxNodeVm) => (n.role === 'group' && n.expanded ? Math.min(n.h, 52) : n.h);
    const cx = from.x + from.w / 2;
    const cy = from.y + head(from) / 2;
    let best: CxNodeVm | null = null;
    let bestScore = Infinity;
    for (const n of this.vms()) {
      if (n.id === from.id) continue;
      const dx = n.x + n.w / 2 - cx;
      const dy = n.y + head(n) / 2 - cy;
      const along = dx * dir.x + dy * dir.y;
      const across = Math.abs(dx * dir.y) + Math.abs(dy * dir.x);
      if (along <= 1 || across > along * 2.5) continue;
      const score = along + across * 2;
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }
    return best;
  }

  /** Moves keyboard focus to a visible node. */
  focusNode(id: string): void {
    this.active.set(id);
    afterNextRender(
      () => {
        const el = this.host.nativeElement.querySelector<HTMLElement>(`[data-cx-id="${CSS.escape(id)}"]`);
        el?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  private bringIntoView(vm: CxNodeVm): void {
    const k = this.zoom();
    const size = this.size();
    const pad = 24;
    const h = vm.role === 'group' && vm.expanded ? Math.min(vm.h, 52) : vm.h;
    const left = vm.x * k + this.tx();
    const top = vm.y * k + this.ty();
    if (left < pad) this.tx.update((v) => v + pad - left);
    else if (left + vm.w * k > size.width - pad) this.tx.update((v) => v - (left + vm.w * k - size.width + pad));
    if (top < pad) this.ty.update((v) => v + pad - top);
    else if (top + h * k > size.height - pad) this.ty.update((v) => v - (top + h * k - size.height + pad));
  }

  // ------------------------------------------------------------------ card and legend events

  protected runAction(card: CardVm, action: CxAction, event: Event): void {
    if (action.id === TOGGLE_ACTION) {
      event.preventDefault();
      void this.toggle(card.vm.node.id);
      return;
    }
    const e: CxNavigateEvent<any> = { node: card.vm.node, action };
    this.cxNavigate.emit(e);
    this.hooks().navigate?.(e);
  }

  protected unpin(): void {
    this.selected.set(null);
    this.hover.set(null);
  }

  protected toggleEdgeKind(kind: string): void {
    const next = new Set(this.hiddenEdgeKinds());
    if (!next.delete(kind)) next.add(kind);
    this.hiddenEdgeKinds.set(next);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  // ------------------------------------------------------------------ pan and zoom

  private local(event: { clientX: number; clientY: number }): CxPoint {
    const box = this.viewportRef().nativeElement.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  protected onPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest('.cx-card, .cx-legend, .cx-minimap')) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.zoom() };
    }
    this.drag = {
      x: event.clientX,
      y: event.clientY,
      tx: this.tx(),
      ty: this.ty(),
      moved: false,
      onNode: !!target.closest('[data-cx-id], .cx-group__toggle'),
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = this.local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      this.zoomAt((this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.dist, mid);
      if (this.drag) this.drag.moved = true;
      return;
    }
    const drag = this.drag;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) + Math.abs(dy) < 5) return;
      drag.moved = true;
      this.panning.set(true);
      clearTimeout(this.hoverTimer);
      this.hover.set(null);
      try {
        this.viewportRef().nativeElement.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is already gone. Panning still works without capture.
      }
    }
    this.tx.set(drag.tx + dx);
    this.ty.set(drag.ty + dy);
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.pointers.delete(event.pointerId)) return;
    if (this.pointers.size < 2) this.pinch = null;
    const drag = this.drag;
    if (this.pointers.size) {
      // One finger of a pinch is still down: keep panning from where it is.
      const [p] = [...this.pointers.values()];
      if (drag) Object.assign(drag, { x: p.x, y: p.y, tx: this.tx(), ty: this.ty() });
      return;
    }
    this.drag = null;
    if (!drag) return;
    if (drag.moved) {
      this.panning.set(false);
      this.suppressClick = true;
      setTimeout(() => (this.suppressClick = false));
    } else if (!drag.onNode) {
      this.selected.set(null);
    }
  }

  protected onWheel(event: WheelEvent): void {
    if ((event.target as HTMLElement).closest('.cx-card, .cx-legend')) return;
    const zoom = event.ctrlKey || event.metaKey || this.wheel() === 'zoom';
    if (!zoom && this.wheel() === 'none') return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : 1;
    if (zoom) {
      this.zoomAt(this.zoom() * Math.exp(-event.deltaY * unit * 0.01), this.local(event));
    } else {
      this.tx.update((v) => v - event.deltaX * unit);
      this.ty.update((v) => v - event.deltaY * unit);
    }
  }

  protected onMiniPointer(event: PointerEvent): void {
    if (event.type === 'pointerdown') (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    else if (!(event.buttons & 1)) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const mini = this.mini();
    const wx = (event.clientX - box.left - mini.ox) / mini.scale;
    const wy = (event.clientY - box.top - mini.oy) / mini.scale;
    const size = this.size();
    this.tx.set(size.width / 2 - wx * this.zoom());
    this.ty.set(size.height / 2 - wy * this.zoom());
  }
}
