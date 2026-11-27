import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import {
  CX_ICONS,
  CxDirection,
  CxGraphComponent,
  CxGraphHooks,
  CxIconDirective,
  CxNodeBodyDirective,
} from 'ngx-cx-graph';
import { ATTACK_EDGES, ATTACK_EDGE_TYPES, ATTACK_NODES, ATTACK_NODE_TYPES, ATTACK_PATHS, loadFleet } from './attack-graph';

@Component({
  selector: 'app-root',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatListModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
    CxGraphComponent,
    CxIconDirective,
    CxNodeBodyDirective,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly snack = inject(MatSnackBar);
  protected readonly graph = viewChild.required(CxGraphComponent);

  readonly nodes = ATTACK_NODES;
  readonly edges = ATTACK_EDGES;
  readonly nodeTypes = ATTACK_NODE_TYPES;
  readonly edgeTypes = ATTACK_EDGE_TYPES;
  readonly paths = ATTACK_PATHS;

  readonly direction = signal<CxDirection>('RIGHT');
  readonly dark = signal(false);
  readonly query = signal('');
  readonly path = signal<number | null>(null);
  readonly highlight = computed(() => {
    const i = this.path();
    return i === null ? null : this.paths[i].steps;
  });

  readonly hooks: CxGraphHooks = {
    navigate: (e) => this.snack.open(`${e.action.label}: ${e.node.label}`, 'OK', { duration: 2500 }),
    loadChildren: (_parent, page) => loadFleet(page.offset, page.limit),
  };

  constructor() {
    // Material renders the icons. The graph only passes icon names along.
    const registry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    for (const [name, d] of Object.entries(CX_ICONS)) {
      registry.addSvgIconLiteral(
        name,
        sanitizer.bypassSecurityTrustHtml(
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`,
        ),
      );
    }
  }

  setDark(on: boolean): void {
    this.dark.set(on);
    document.documentElement.classList.toggle('dark', on);
  }

  pick(i: number): void {
    this.path.set(this.path() === i ? null : i);
  }
}
