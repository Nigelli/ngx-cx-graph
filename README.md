# ngx-cx-graph

[![npm version](https://img.shields.io/npm/v/ngx-cx-graph.svg)](https://www.npmjs.com/package/ngx-cx-graph)
[![Live demos](https://img.shields.io/badge/demos-live-2ea44f.svg)](https://nigelli.github.io/ngx-cx-graph/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**▶ [Try the live demos](https://nigelli.github.io/ngx-cx-graph/)**: the same component in Nebular, Angular Material and PrimeNG.

> **Early-stage project.** This library is under active development. APIs may change without notice.

An explorable graph component for Angular. It draws a directed graph as cards and edges, and lets people pan, zoom, collapse groups, search, filter edge kinds, and open a detail card for any node.

The component knows nothing about your application. You tell it what your node and edge kinds look like, you theme it with CSS custom properties, and it calls you back when the user wants to go somewhere.

## Features

- Collapsible, nested groups with paging and lazy loading of children
- Detail card on hover or keyboard focus, pinned by a click
- Edge filtering from the legend, search, path highlighting and a minimap
- Layered layout built in, left to right or top down, with no dependencies. Other layout engines plug in.
- Theming through CSS custom properties, with presets for Nebular, Angular Material and PrimeNG
- Host templates for icons, node content and detail content
- Keyboard navigation

## Installation

```bash
npm install ngx-cx-graph
```

It needs Angular 19 or later and has no other dependencies.

## Usage

```ts
import { Component } from '@angular/core';
import { CxEdge, CxGraphComponent, CxNode } from 'ngx-cx-graph';

@Component({
  selector: 'app-example',
  imports: [CxGraphComponent],
  template: `<cx-graph [nodes]="nodes" [edges]="edges" style="height: 600px" />`,
})
export class ExampleComponent {
  nodes: CxNode[] = [
    { id: 'plan', kind: 'task', label: 'Plan the work', status: 'done' },
    { id: 'run', kind: 'task', label: 'Run the checks', status: 'running' },
    { id: 'report', kind: 'task', label: 'Write the report' },
  ];
  edges: CxEdge[] = [
    { from: 'plan', to: 'run', kind: 'then' },
    { from: 'run', to: 'report', kind: 'then' },
  ];
}
```

The [library README](projects/cx-graph/README.md) is the full reference: data model, node and edge types, inputs, hooks, templates, theming tokens, layout and keyboard.

## Sample apps

Each app uses a different design system and a different kind of graph, to show that the library is tied to neither.

| | Nebular | Material | PrimeNG |
|---|---|---|---|
| Graph | Run of a research agent: steps, searches, sources, claims | Attack graph | Data pipeline |
| Direction | Left to right | Switchable | Top down by default |
| Theme | Preset plus one override, four Nebular themes | Preset, light and dark | Preset, light and dark, one custom tone |
| Toolbar | Built in | Built from Material components on the public API | Built in, with PrimeNG controls projected in |
| Icons | Eva icons through `nb-icon` | `mat-icon` | PrimeIcons |
| Templates | Custom detail card for sources | Custom node content for hosts | None |
| Also shows | `reveal()` deep links, `highlight`, layout-only edges | Lazy loading of a 40-host group, path highlighting, cycles | Live status updates through the `nodes` input |

All data in the sample apps is fictional.

## Development

Node 20 or later and npm are needed.

```bash
npm install
```

```bash
npm run start:nebular
```

```bash
npm run start:material
```

```bash
npm run start:primeng
```

The apps serve on ports 4301, 4302 and 4303. They compile the library from source, so a change in `projects/cx-graph` reloads them.

```bash
npm run test:ci
```

```bash
npm run build:lib
```

`npm run build:lib` writes the publishable package to `dist/cx-graph`. `scripts/compat-test.sh` packs it and builds a fresh app against each supported Angular major.

| Path | What it is |
|---|---|
| `projects/cx-graph/` | The library |
| `projects/cx-graph/themes/` | CSS presets for Nebular, Angular Material and PrimeNG |
| `projects/demo-nebular/`, `projects/demo-material/`, `projects/demo-primeng/` | The sample apps |
| `scripts/compat-test.sh` | Angular version compatibility test |

## Releasing

Pushing a tag that matches `v*` publishes `dist/cx-graph` to npm through the Release workflow. Update the version in `projects/cx-graph/package.json` and the changelog first.

## License

MIT
