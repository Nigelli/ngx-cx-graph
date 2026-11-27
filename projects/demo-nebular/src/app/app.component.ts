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
import { buildResearchRun } from './research-run';

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

  readonly run = buildResearchRun();
  readonly counts = `${this.run.nodes.length} nodes · ${this.run.edges.length} edges`;

  readonly theme = signal('default');
  readonly selected = signal<string | null>(null);
  readonly activeReason = signal<number | null>(null);
  readonly log = signal<string[]>([]);

  /** The claim behind the chosen reason and the sources it cites, lit up in the graph. */
  readonly highlight = computed<string[] | null>(() => {
    const i = this.activeReason();
    if (i === null) return null;
    const reason = this.run.reasons[i];
    return ['answer', reason.claim, ...reason.sources];
  });

  /** The library calls back here. The app decides what "navigate" means. */
  readonly hooks: CxGraphHooks = {
    navigate: (e) => this.onNavigate(e),
  };

  setTheme(name: string): void {
    this.theme.set(name);
    this.themes.changeTheme(name);
  }

  pickReason(i: number): void {
    const next = this.activeReason() === i ? null : i;
    this.activeReason.set(next);
    this.selected.set(null);
    if (next !== null) this.graphRef()?.reveal(this.run.reasons[next].claim);
  }

  showSource(id: string): void {
    this.graphRef()?.reveal(id);
  }

  private onNavigate(e: CxNavigateEvent<CxNode>): void {
    const target = e.node.kind === 'source' ? e.node.data.ref : (e.node.label ?? e.node.kind);
    this.log.update((l) => [`${e.action.id} → ${target}`, ...l].slice(0, 6));
    this.toastr.info(`A real app would handle "${e.action.id}" for ${target} here.`, e.action.label, {
      duration: 2500,
    });
  }
}
