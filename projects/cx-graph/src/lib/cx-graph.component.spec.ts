import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCxGraph } from './config';
import { CxGraphComponent } from './cx-graph.component';
import { CxEdge, CxGraphHooks, CxNavigateEvent, CxNode } from './model';
import { CxIconDirective, CxNodeBodyDirective, CxNodeDetailDirective } from './templates';

const NODES: CxNode[] = [
  { id: 'plan', kind: 'item', label: 'Plan the work', status: 'planned' },
  { id: 'step', kind: 'step', label: 'Execute' },
  { id: 't1', kind: 'tool', parent: 'step', label: 'search_logs', status: 'done' },
  { id: 't2', kind: 'tool', parent: 'step', label: 'lookup_hash', status: 'failed' },
  { id: 't3', kind: 'tool', parent: 'step', label: 'lookup_ip', status: 'done' },
  { id: 'out', kind: 'outcome', label: 'Benign', status: 'done' },
];
const EDGES: CxEdge[] = [
  { from: 'plan', to: 't1', kind: 'runs' },
  { from: 'plan', to: 't2', kind: 'runs' },
  { from: 't1', to: 'out', kind: 'supports' },
];

@Component({
  imports: [CxGraphComponent, CxNodeDetailDirective, CxNodeBodyDirective, CxIconDirective],
  template: `
    <div style="width: 900px; height: 600px">
      <cx-graph
        [nodes]="nodes()"
        [edges]="edges"
        [hooks]="hooks"
        [collapseThreshold]="threshold()"
        [pageSize]="pageSize()"
        [(selected)]="selected"
        [(query)]="query"
        [(hiddenEdgeKinds)]="hidden"
        [highlight]="highlight()"
        (cxNavigate)="navigated.push($event)"
      >
        @if (templates()) {
          <ng-template cxIcon let-name><i class="host-icon" [attr.data-name]="name"></i></ng-template>
          <ng-template cxNodeDetail="outcome" let-node><b class="host-detail">{{ node.label }}!</b></ng-template>
          <ng-template cxNodeBody="item" let-node><em class="host-body">{{ node.id }}</em></ng-template>
        }
      </cx-graph>
    </div>
  `,
})
class HostComponent {
  readonly graph = viewChild.required(CxGraphComponent);
  readonly nodes = signal(NODES);
  readonly edges = EDGES;
  readonly threshold = signal(12);
  readonly pageSize = signal(8);
  readonly selected = signal<string | null>(null);
  readonly query = signal('');
  readonly hidden = signal<ReadonlySet<string>>(new Set());
  readonly highlight = signal<string[] | null>(null);
  readonly templates = signal(false);
  readonly navigated: CxNavigateEvent[] = [];
  hooks: CxGraphHooks = {};
}

describe('CxGraphComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  const q = <T extends HTMLElement = HTMLElement>(sel: string) => el.querySelector<T>(sel);
  const all = (sel: string) => [...el.querySelectorAll<HTMLElement>(sel)];
  const node = (id: string) => q(`[data-cx-id="${id}"]`);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideCxGraph({
          nodeTypes: {
            step: { label: 'Step', group: true, icon: 'layers' },
            tool: {
              label: 'Tool call',
              plural: 'tool calls',
              mono: true,
              icon: 'gear',
              detail: (n) => [{ label: 'Tool', value: n.label ?? '' }],
              actions: () => [{ id: 'trace', label: 'Open trace' }],
            },
            outcome: { label: 'Outcome', fill: () => 'warning', actions: () => [{ id: 'open', label: 'Open' }] },
            item: { label: 'Planned item', border: 'dashed' },
          },
          edgeTypes: { runs: { label: 'Runs' }, supports: { label: 'Supports', tone: 'success' } },
        }),
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    await settle();
  });

  it('renders nodes, an open group and edges', () => {
    expect(all('.cx-node').length).toBe(5);
    expect(q('.cx-group--open')).toBeTruthy();
    expect(all('.cx-edge').length).toBe(3);
    expect(node('t1')!.textContent).toContain('search_logs');
    expect(node('t1')!.textContent).toContain('Done');
    expect(host.graph().visibleCount()).toBe(6);
  });

  it('collapses a group, merges its edges and summarises its children', async () => {
    await host.graph().toggle('step');
    await settle();
    expect(node('t1')).toBeNull();
    const group = q('.cx-group')!;
    expect(group.classList.contains('cx-group--open')).toBeFalse();
    expect(group.textContent).toContain('3 tool calls hidden');
    expect(group.textContent).toContain('2 done · 1 failed');
    expect(q('.cx-edge__badge')!.textContent).toContain('×2');
  });

  it('starts large groups collapsed and pages their children', async () => {
    host.threshold.set(2);
    host.pageSize.set(2);
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.threshold.set(2);
    fixture.componentInstance.pageSize.set(2);
    el = fixture.nativeElement;
    await settle();
    expect(node('t1')).toBeNull();
    q<HTMLButtonElement>('.cx-group__toggle')!.click();
    await settle();
    expect(node('t1')).toBeTruthy();
    expect(node('t3')).toBeNull();
    const more = q<HTMLButtonElement>('.cx-more')!;
    expect(more.textContent).toContain('Show 1 more tool calls');
    more.click();
    await settle();
    expect(node('t3')).toBeTruthy();
    expect(q('.cx-more')).toBeNull();
  });

  it('pins a node on click and shows its detail card', async () => {
    node('t1')!.click();
    await settle();
    expect(host.selected()).toBe('t1');
    expect(node('t1')!.classList.contains('cx-pinned')).toBeTrue();
    const card = q('.cx-card')!;
    expect(card.textContent).toContain('search_logs');
    expect(card.textContent).toContain('1 incoming');
    expect(card.textContent).toContain('1 outgoing');
    expect(card.textContent).toContain('Pinned');
    // Unrelated nodes are dimmed, neighbours are not.
    expect(node('t2')!.classList.contains('cx-dim')).toBeTrue();
    expect(node('plan')!.classList.contains('cx-dim')).toBeFalse();
    q<HTMLButtonElement>('.cx-card__close')!.click();
    await settle();
    expect(host.selected()).toBeNull();
    expect(q('.cx-card')).toBeNull();
  });

  it('hands card actions to the host through the output and the hook', async () => {
    const seen: string[] = [];
    host.hooks = { navigate: (e) => seen.push(e.action.id + ':' + e.node.id) };
    fixture.detectChanges();
    host.selected.set('t1');
    await settle();
    q<HTMLButtonElement>('.cx-card__foot .cx-btn')!.click();
    expect(host.navigated.map((e) => e.action.id)).toEqual(['trace']);
    expect(host.navigated[0].node.id).toBe('t1');
  });

  it('filters edge kinds from the legend', async () => {
    const supports = all('.cx-legend__edge').find((b) => b.textContent!.includes('Supports'))!;
    supports.click();
    await settle();
    expect(host.hidden().has('supports')).toBeTrue();
    expect(all('.cx-edge').length).toBe(2);
    expect(supports.getAttribute('aria-pressed')).toBe('false');
  });

  it('marks search matches, also inside collapsed groups', async () => {
    host.query.set('lookup');
    await settle();
    expect(node('t2')!.classList.contains('cx-match')).toBeTrue();
    expect(node('t1')!.classList.contains('cx-dim')).toBeTrue();
    expect(host.graph().matchCount()).toBe(2);
    await host.graph().toggle('step');
    await settle();
    expect(q('.cx-group')!.textContent).toContain('2 matches');
  });

  it('dims everything outside the highlight', async () => {
    host.highlight.set(['plan', 't1', 'out']);
    await settle();
    expect(node('t2')!.classList.contains('cx-dim')).toBeTrue();
    expect(node('t1')!.classList.contains('cx-dim')).toBeFalse();
    expect(all('.cx-edges g.cx-strong').length).toBe(2);
  });

  it('reveals a node inside a collapsed group', async () => {
    await host.graph().toggle('step');
    await settle();
    host.graph().reveal('t2');
    await settle();
    expect(node('t2')).toBeTruthy();
    expect(host.selected()).toBe('t2');
  });

  it('lets the host veto an expand', async () => {
    await host.graph().toggle('step', false);
    host.hooks = { beforeExpand: () => false };
    await settle();
    expect(await host.graph().toggle('step', true)).toBeFalse();
    await settle();
    expect(node('t1')).toBeNull();
  });

  it('pages in children through loadChildren', async () => {
    const calls: number[] = [];
    host.hooks = {
      loadChildren: (parent, page) => {
        calls.push(page.offset);
        const nodes = Array.from({ length: page.limit }, (_, i) => ({
          id: `lazy-${page.offset + i}`,
          kind: 'tool',
          parent: parent.id,
          label: 'lazy',
        }));
        return Promise.resolve({ nodes });
      },
    };
    host.pageSize.set(2);
    host.threshold.set(2);
    host.nodes.set([{ id: 'zone', kind: 'step', label: 'Fleet', childCount: 5 }]);
    await settle();
    expect(q('.cx-group')!.textContent).toContain('5 items hidden');
    await host.graph().toggle('zone');
    await settle();
    await settle();
    expect(calls).toEqual([0]);
    expect(node('lazy-0')).toBeTruthy();
    expect(node('lazy-1')).toBeTruthy();
    expect(q('.cx-more')!.textContent).toContain('Show 3 more');
  });

  it('renders host templates for icons, node bodies and card details', async () => {
    host.templates.set(true);
    await settle();
    expect(q('.host-icon[data-name="gear"]')).toBeTruthy();
    expect(node('plan')!.querySelector('.host-body')!.textContent).toBe('plan');
    host.selected.set('out');
    await settle();
    expect(q('.cx-card .host-detail')!.textContent).toBe('Benign!');
  });

  it('takes its colours from CSS custom properties set by the host', async () => {
    const graph = q('cx-graph')!;
    graph.style.setProperty('--cx-node-bg', 'rgb(1, 2, 3)');
    graph.style.setProperty('--cx-success-line', 'rgb(4, 5, 6)');
    await settle();
    expect(getComputedStyle(node('t1')!).backgroundColor).toBe('rgb(1, 2, 3)');
    expect(getComputedStyle(node('t1')!.querySelector('.cx-node__bar')!).backgroundColor).toBe('rgb(4, 5, 6)');
  });

  it('zooms through the public API and the toolbar', async () => {
    const before = host.graph().zoom();
    host.graph().zoomIn();
    expect(host.graph().zoom()).toBeGreaterThan(before);
    host.graph().fit();
    await settle();
    expect(host.graph().zoom()).toBeLessThanOrEqual(1);
    expect(q('.cx-zoom')!.textContent).toContain('%');
  });

  it('moves focus between nodes with the arrow keys', async () => {
    const plan = node('plan')!;
    plan.focus();
    plan.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle();
    await new Promise((r) => setTimeout(r));
    expect(document.activeElement).not.toBe(plan);
    expect(document.activeElement!.hasAttribute('data-cx-id')).toBeTrue();
  });
});
