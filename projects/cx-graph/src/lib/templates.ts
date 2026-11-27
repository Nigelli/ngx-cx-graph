import { Directive, TemplateRef, inject, input } from '@angular/core';
import { CxIconTemplateContext, CxNodeTemplateContext } from './model';

/**
 * Replaces the fields of the detail card for one node kind:
 * `<ng-template cxNodeDetail="ledger_entry" let-node>...</ng-template>`.
 * Leave the kind empty to match every kind without its own template.
 */
@Directive({ selector: 'ng-template[cxNodeDetail]', standalone: true })
export class CxNodeDetailDirective {
  readonly kind = input<string>('', { alias: 'cxNodeDetail' });
  readonly template = inject<TemplateRef<CxNodeTemplateContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: CxNodeDetailDirective, _ctx: unknown): _ctx is CxNodeTemplateContext {
    return true;
  }
}

/**
 * Replaces the content of the node box for one node kind:
 * `<ng-template cxNodeBody="host" let-node>...</ng-template>`.
 */
@Directive({ selector: 'ng-template[cxNodeBody]', standalone: true })
export class CxNodeBodyDirective {
  readonly kind = input<string>('', { alias: 'cxNodeBody' });
  readonly template = inject<TemplateRef<CxNodeTemplateContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: CxNodeBodyDirective, _ctx: unknown): _ctx is CxNodeTemplateContext {
    return true;
  }
}

/**
 * Renders icons with the host's own icon component:
 * `<ng-template cxIcon let-name><mat-icon [svgIcon]="name" /></ng-template>`.
 */
@Directive({ selector: 'ng-template[cxIcon]', standalone: true })
export class CxIconDirective {
  readonly template = inject<TemplateRef<CxIconTemplateContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: CxIconDirective, _ctx: unknown): _ctx is CxIconTemplateContext {
    return true;
  }
}
