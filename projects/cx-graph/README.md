# ngx-cx-graph

[![npm version](https://img.shields.io/npm/v/ngx-cx-graph.svg)](https://www.npmjs.com/package/ngx-cx-graph)
[![Live demos](https://img.shields.io/badge/demos-live-2ea44f.svg)](https://nigelli.github.io/ngx-cx-graph/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An explorable graph component for Angular. It draws a directed graph as cards and edges, and lets people pan, zoom, collapse groups, search, filter edge kinds, and open a detail card for any node.

The component knows nothing about your application. You tell it what your node and edge kinds look like, you theme it with CSS custom properties, and it calls you back when the user wants to go somewhere.

- Angular 19 or later, standalone, signal based
- No dependencies beyond Angular
- Works with any design system. Presets are included for Nebular, Angular Material and PrimeNG.

## Installation

```bash
npm install ngx-cx-graph
```

## Quick start

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

This works with no configuration. Unknown kinds get a neutral look, and the colours follow the page's `color-scheme`. The component fills its parent, so give it or its parent a height.

## Data model

```ts
interface CxNode<D = any> {
  id: string;
  kind: string;        // selects the node type
  label?: string;      // main text
  parent?: string;     // id of the group that contains this node
  status?: string;     // mapped to a tone and label by the node type
  childCount?: number; // total children, when not all are loaded yet
  data?: D;            // anything your templates and callbacks need
}

interface CxEdge<D = any> {
  id?: string;
  from: string;
  to: string;
  kind: string;        // selects the edge type
  label?: string;
  data?: D;
}
```

A node becomes a **group** when other nodes name it as their `parent`, when it has a `childCount`, or when its type sets `group: true`. Groups nest.

## Node and edge types

Register types for the whole app with `provideCxGraph`, or per graph with the `nodeTypes` and `edgeTypes` inputs. Inputs win over the provider.

```ts
import { cxNodeType, provideCxGraph } from 'ngx-cx-graph';

provideCxGraph({
  nodeTypes: {
    tool_call: cxNodeType<ToolCallNode>({
      label: 'Tool call',
      plural: 'tool calls',
      icon: 'gear',
      mono: true,
      status: (n) => ({ label: 'Done', tone: 'success' }),
      detail: (n) => [{ label: 'Reason', value: n.data.reason }],
      actions: (n) => [{ id: 'trace', label: 'Open trace event' }],
    }),
    step: cxNodeType({ label: 'Step', icon: 'layers', group: true }),
  },
  edgeTypes: {
    supports: { label: 'Supports', tone: 'success', width: 2 },
    contradicts: { label: 'Contradicts', tone: 'danger', width: 2, dash: [6, 5] },
  },
});
```

| `CxNodeType` member | Purpose |
|---|---|
| `label` | Kind label on the node, the card and the legend. A string or a function of the node. |
| `plural` | Noun for group summaries, for example "tool calls". |
| `icon` | Icon name. See [Icons](#icons). |
| `border` | `'solid'` or `'dashed'`. |
| `mono` | Monospace title on one line. |
| `emphasis` | Heavier border and larger title. |
| `group` | Treat as a group even with no children. |
| `size` | `{ width, height }` or a function. The layout needs fixed sizes. Default 240 by 76, or 240 by 56 for `mono`. |
| `title`, `subtitle`, `ref` | Text. `title` defaults to `node.label`. `ref` is a short reference shown after the kind label. |
| `status` | Returns `{ label, tone }` for the status chip and the colour bar. Without it, `node.status` is mapped by name (`done`, `running`, `failed` and so on). |
| `fill` | Returns a tone that fills the whole node. |
| `detail` | Returns the rows of the detail card. |
| `actions` | Returns the buttons of the detail card. |
| `hideInLegend` | Leave the kind out of the legend. |

| `CxEdgeType` member | Purpose |
|---|---|
| `label` | Name in the legend. |
| `tone` | Colour role. |
| `width` | Stroke width in pixels. Default 1.5. |
| `dash` | SVG dash pattern. |
| `arrow` | Draw an arrowhead. Default true. |
| `layout` | Whether edges of this kind decide where nodes go. Default true. Set it to false for edges that are drawn but must not pull nodes out of order, such as evidence links across a sequence of steps. |
| `hideInLegend` | Leave the kind out of the legend. |

A **tone** is a colour role: `basic`, `primary`, `success`, `info`, `warning` or `danger`. You can use any other name once you define its three colours. See [Theming](#theming).

## Groups, paging and lazy loading

- A collapsed group is one card that summarises its children by status. Edges to its children merge into one edge with a count.
- `expandDepth` (default 1) and `collapseThreshold` (default 12) decide which groups start open.
- An open group shows `pageSize` children (default 8) and a "Show more" stub. Edges to the hidden children point at the stub.
- When a group's `childCount` is higher than the number of loaded children, the graph calls `hooks.loadChildren(parent, { offset, limit })` and merges the result.

```ts
hooks: CxGraphHooks = {
  loadChildren: (parent, page) => this.api.children(parent.id, page), // Observable or Promise of { nodes, edges? }
  beforeExpand: (node) => this.permissions.canOpen(node),             // boolean or Promise<boolean>
  navigate: ({ node, action }) => this.router.navigate(['/items', node.id], { queryParams: { tab: action.id } }),
};
```

## Inputs, outputs and methods

| Input | Type | Default | Purpose |
|---|---|---|---|
| `nodes` | `CxNode[]` | `[]` | The nodes. Replace the array to update a live graph. |
| `edges` | `CxEdge[]` | `[]` | The edges. |
| `nodeTypes`, `edgeTypes` | records | `{}` | Types for this graph. |
| `hooks` | `CxGraphHooks` | `{}` | Callbacks to the host. |
| `direction` | `'RIGHT' \| 'DOWN'` | `'RIGHT'` | Layout direction. |
| `layout` | `CxLayoutEngine` | built in | Another layout engine. |
| `layoutOptions` | partial options | | `layerGap`, `nodeGap`, `padding`, `wrapAt`. |
| `expandDepth`, `collapseThreshold`, `pageSize` | number | 1, 12, 8 | See above. |
| `highlight` | ids | `null` | Nodes to emphasise, for example one path. The rest is dimmed. |
| `toolbar`, `legend`, `minimap` | boolean | `true` | Show the built-in toolbar, legend and minimap. |
| `wheel` | `'pan' \| 'zoom' \| 'none'` | `'pan'` | What the mouse wheel does. Ctrl or Cmd plus wheel always zooms. Use `'none'` when the page must keep scrolling. |
| `minZoom`, `maxZoom` | number | 0.2, 2 | Zoom limits. |
| `labels` | partial `CxGraphLabels` | English | Every user-visible string, for translation. |

| Two-way binding | Type | Purpose |
|---|---|---|
| `[(expanded)]` | `ReadonlySet<string> \| null` | Ids of open groups. `null` means "use the defaults". |
| `[(selected)]` | `string \| null` | Id of the pinned node. |
| `[(hiddenEdgeKinds)]` | `ReadonlySet<string>` | Edge kinds switched off in the legend. |
| `[(query)]` | `string` | Search text. |
| `[(legendOpen)]` | `boolean` | Whether the legend is open. |

Bind these to your router or store to keep the state in the URL.

| Output | Payload | Fires when |
|---|---|---|
| `cxNavigate` | `{ node, action }` | A card action is used. `hooks.navigate` is called too. |
| `cxHover` | `CxNode \| null` | The hovered or focused node changes. |
| `cxNodeClick` | `CxNode` | A node is clicked. |

| Method or signal | Purpose |
|---|---|
| `fit()`, `resetView()` | Show the whole graph, or return to the opening view. |
| `zoomIn()`, `zoomOut()`, `zoomAt(k, point?)`, `zoom()` | Zoom control and the current zoom. |
| `expandAll()`, `collapseAll()`, `toggle(id, open?)` | Group control. |
| `showMore(groupId)` | Show the next page of a group. |
| `reveal(id)` | Open every group around a node, pin it and centre it. Use this for deep links. |
| `focusNode(id)` | Move keyboard focus to a visible node. |
| `visibleCount()`, `totalCount()`, `matchCount()` | Counts for your own toolbar. |

To build the toolbar from your own components, set `[toolbar]="false"` and call these methods. To add controls to the built-in toolbar, project them with the `cxToolbarEnd` attribute.

## Templates

```html
<cx-graph [nodes]="nodes" [edges]="edges">
  <!-- Render icons with your design system's icon component. -->
  <ng-template cxIcon let-name><mat-icon [svgIcon]="name" /></ng-template>

  <!-- Replace the fields of the detail card for one kind. -->
  <ng-template cxNodeDetail="evidence" let-node>
    <app-evidence-preview [entry]="node.data" />
  </ng-template>

  <!-- Replace the content of the node box for one kind. -->
  <ng-template cxNodeBody="host" let-node let-status="status">
    <app-host-chip [host]="node.data" />
  </ng-template>
</cx-graph>
```

Leave the kind empty (`cxNodeDetail=""`) to match every kind that has no template of its own.

### Icons

`icon` on a node type is only a name. Without a `cxIcon` template the name is looked up in a small built-in set (`CX_ICONS`: `list`, `gear`, `doc`, `bulb`, `flag`, `layers`, `server`, `database`, `user`, `shield`, `key`, `globe`, `lock`, `bug`, `target`, `alert`, `question`, `check`, `box`, `circle`). Add more with `provideCxGraph({ icons: { name: 'SVG path data' } })`. With a `cxIcon` template, the name goes to your template and can be anything your icon component accepts.

## Theming

Every colour, font and radius is a CSS custom property. Set them on `cx-graph` or on any ancestor. Anything you leave unset uses a neutral default that follows the page's `color-scheme`, so light and dark work with no setup.

| Property | Used for |
|---|---|
| `--cx-font`, `--cx-font-mono` | Font families |
| `--cx-canvas`, `--cx-dot` | Canvas background and its dot grid |
| `--cx-node-bg`, `--cx-node-border` | Node, card, toolbar and legend surfaces and borders |
| `--cx-surface-2` | Card header, hover states |
| `--cx-group-bg` | Background of an open group |
| `--cx-divider` | Hairlines |
| `--cx-text`, `--cx-hint` | Primary and secondary text |
| `--cx-accent` | Focus ring, pinned outline, primary button |
| `--cx-accent-text`, `--cx-accent-contrast`, `--cx-accent-tint` | Accent as text, text on accent, accent wash |
| `--cx-shadow` | Detail card shadow |
| `--cx-node-radius`, `--cx-control-radius` | Corner radii |
| `--cx-<tone>-tint` | Chip background and node fill for a tone |
| `--cx-<tone>-text` | Chip text for a tone |
| `--cx-<tone>-line` | Colour bar, edge and minimap colour for a tone |

Keep `--cx-<tone>-text` on `--cx-<tone>-tint` and `--cx-hint` on `--cx-node-bg` at a contrast of 4.5:1 or more.

A custom tone is three properties:

```css
cx-graph {
  --cx-stale-tint: rgb(147 51 234 / 16%);
  --cx-stale-text: #6b21a8;
  --cx-stale-line: #9333ea;
}
```

### Presets

Each preset is a small CSS file that maps the tokens above to a design system's own custom properties. Import one after your theme, then override whatever you like.

```scss
@import 'ngx-cx-graph/themes/nebular.css';   // Nebular with CSS custom properties mode (the default)
@import 'ngx-cx-graph/themes/material.css';  // Angular Material with Material 3 system tokens (mat.theme)
@import 'ngx-cx-graph/themes/primeng.css';   // PrimeNG 18 or later, styled mode
```

The presets carry no runtime code and add no dependency. To support another design system, copy one and change the right-hand sides.

## Layout

The built-in layout is layered (Sugiyama style): nodes go into layers along the direction of the edges, layers are ordered to reduce crossings, and long edges get their own lane. Each open group is laid out by itself and then treated as one box. A group without internal edges becomes a grid that wraps at `wrapAt` pixels.

To use another engine, such as ELK or dagre, implement one method and pass it as `[layout]` or through `provideCxGraph({ layout })`:

```ts
const engine: CxLayoutEngine = {
  layout(input: CxLayoutInput): CxLayoutResult | Promise<CxLayoutResult> {
    // input.nodes: boxes with sizes and parents. input.edges: visible edges.
    // Return a rectangle per node and a route per edge.
  },
};
```

The result can be a promise, so an engine can run in a web worker.

## Keyboard

| Key | Action |
|---|---|
| Tab | Move into and out of the graph. All nodes share one tab stop. |
| Arrow keys | Move to the nearest node in that direction |
| Enter | Pin or unpin the node. The detail card stays open while pinned. |
| Space | Expand or collapse a group |
| Escape | Unpin and close the card |
| `+`, `-`, `0` | Zoom in, zoom out, fit |

Mouse and touch: drag to pan, Ctrl or Cmd plus wheel or pinch to zoom, hover for the detail card, click to pin it.

## Limits

- Node sizes are fixed per type. Content does not resize the box.
- The built-in layout is deterministic but not incremental. When nodes are added, existing nodes can move. Moves are animated, and a group you expand stays where it is on screen.
- Nodes outside the viewport are not rendered once more than 300 are visible. Edges are always rendered.

## License

MIT
