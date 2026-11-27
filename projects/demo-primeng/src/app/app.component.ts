import { Component, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { CxDirection, CxGraphComponent, CxGraphHooks, CxIconDirective, CxNode } from 'ngx-cx-graph';
import { PIPELINE_EDGES, PIPELINE_EDGE_TYPES, PIPELINE_NODES, PIPELINE_NODE_TYPES, RUN_ORDER } from './pipeline';

@Component({
  selector: 'app-root',
  imports: [FormsModule, ButtonModule, SelectButtonModule, TagModule, ToggleSwitchModule, CxGraphComponent, CxIconDirective],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnDestroy {
  readonly nodes = signal<CxNode[]>(PIPELINE_NODES);
  readonly edges = PIPELINE_EDGES;
  readonly nodeTypes = PIPELINE_NODE_TYPES;
  readonly edgeTypes = PIPELINE_EDGE_TYPES;

  readonly directions = [
    { label: 'Top down', value: 'DOWN' },
    { label: 'Left to right', value: 'RIGHT' },
  ];
  direction: CxDirection = 'DOWN';
  dark = false;
  readonly running = signal(false);
  readonly last = signal('');
  private timer: ReturnType<typeof setInterval> | undefined;

  readonly hooks: CxGraphHooks = {
    navigate: (e) => this.last.set(`${e.action.label} → ${e.node.label}`),
  };

  setDark(on: boolean): void {
    document.documentElement.classList.toggle('app-dark', on);
  }

  /** Replays a run by replacing the nodes input, as a live feed would. */
  run(): void {
    clearInterval(this.timer);
    this.running.set(true);
    this.patch(() => 'queued');
    let tick = 0;
    this.timer = setInterval(() => {
      const started = RUN_ORDER[tick]?.[0];
      const ended = RUN_ORDER[tick - 1];
      this.patch((n) => (n.id === started ? 'running' : n.id === ended?.[0] ? ended[1] : n.status));
      if (++tick > RUN_ORDER.length) {
        clearInterval(this.timer);
        this.running.set(false);
      }
    }, 450);
  }

  private patch(next: (n: CxNode) => string | undefined): void {
    this.nodes.update((list) => list.map((n) => (n.kind === 'stage' ? n : { ...n, status: next(n) })));
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
