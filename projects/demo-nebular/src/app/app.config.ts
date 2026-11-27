import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { NbThemeModule, NbToastrModule } from '@nebular/theme';
import { provideCxGraph } from 'ngx-cx-graph';
import { SESSION_EDGE_TYPES, SESSION_NODE_TYPES } from './session-types';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    importProvidersFrom(NbThemeModule.forRoot({ name: 'default' }), NbToastrModule.forRoot(), NbEvaIconsModule),
    // The graph library knows nothing about agent sessions. The app
    // teaches it the node and edge kinds here.
    provideCxGraph({ nodeTypes: SESSION_NODE_TYPES, edgeTypes: SESSION_EDGE_TYPES }),
  ],
};
