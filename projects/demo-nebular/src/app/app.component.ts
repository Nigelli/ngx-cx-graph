import { Component, computed, inject, signal, viewChild } from '@angular/core';
import {
  NbButtonModule,
  NbCardModule,
  NbIconModule,
  NbLayoutModule,
  NbSelectModule,
  NbThemeService,
  NbToastrService,
} from '@nebular/theme';
import { CxGraphComponent, CxGraphHooks, CxIconDirective, CxNavigateEvent, CxNode, CxNodeDetailDirective } from 'ngx-cx-graph';
import { SessionGraph, toCxGraph } from './session-adapter';

@Component({
  selector: 'app-root',
  imports: [
    NbLayoutModule,
    NbCardModule,
    NbSelectModule,
    NbButtonModule,
    NbIconModule,
    CxGraphComponent,
    CxIconDirective,
    CxNodeDetailDirective,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly themes = inject(NbThemeService);
  private readonly toastr = inject(NbToastrService);
  private readonly graphRef = viewChild(CxGraphComponent);

  readonly theme = signal('default');
  readonly data = signal<SessionGraph | null>(null);
  readonly session = signal<any>(null);
  readonly selected = signal<string | null>(null);
  readonly activeAction = signal<number | null>(null);
  readonly log = signal<string[]>([]);

  readonly counts = computed(() => {
    const d = this.data();
    return d ? `${d.nodes.length} nodes · ${d.edges.length} edges · ${d.ledger.length} evidence entries` : '';
  });

  /** Evidence behind the chosen recommended action, lit up in the graph. */
  readonly highlight = computed<string[] | null>(() => {
    const i = this.activeAction();
    const actions = this.session()?.outcome?.recommendedActions;
    return i === null || !actions ? null : ['outcome', ...actions[i].entryIds];
  });

  /** The library calls back here. The app decides what "navigate" means. */
  readonly hooks: CxGraphHooks = {
    navigate: (e) => this.onNavigate(e),
  };

  constructor() {
    Promise.all([
      fetch('data/execution-graph.json').then((r) => r.json()),
      fetch('data/session-summary.json').then((r) => r.json()),
    ]).then(([graph, session]) => {
      this.session.set(session);
      this.data.set(toCxGraph(graph, session));
    });
  }

  setTheme(name: string): void {
    this.theme.set(name);
    this.themes.changeTheme(name);
  }

  pickAction(i: number): void {
    const next = this.activeAction() === i ? null : i;
    this.activeAction.set(next);
    this.selected.set(null);
    const first = next === null ? null : this.session().outcome.recommendedActions[next].entryIds[0];
    if (first) this.graphRef()?.reveal(first);
  }

  refOf(id: string): string {
    return this.data()?.ledger.find((e) => e.id === id)?.ref ?? id;
  }

  showEntry(id: string): void {
    this.graphRef()?.reveal(id);
  }

  private onNavigate(e: CxNavigateEvent<CxNode>): void {
    const target = e.node.kind === 'ledger_entry' ? e.node.data.ref : e.node.kind;
    const line = `${e.action.id} → ${target}`;
    this.log.update((l) => [line, ...l].slice(0, 6));
    this.toastr.info(`In the real app this routes to "${e.action.id}" for ${target}.`, e.action.label, {
      duration: 2500,
    });
  }
}
