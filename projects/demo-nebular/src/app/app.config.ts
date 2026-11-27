import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { NbThemeModule, NbToastrModule } from '@nebular/theme';
import { provideCxGraph } from 'ngx-cx-graph';
import { RUN_EDGE_TYPES, RUN_NODE_TYPES } from './research-run';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    importProvidersFrom(NbThemeModule.forRoot({ name: 'default' }), NbToastrModule.forRoot(), NbEvaIconsModule),
    // The graph library knows nothing about research runs. The app
    // teaches it the node and edge kinds here.
    provideCxGraph({ nodeTypes: RUN_NODE_TYPES, edgeTypes: RUN_EDGE_TYPES }),
  ],
};
