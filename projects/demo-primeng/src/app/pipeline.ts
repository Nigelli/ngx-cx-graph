import { CxEdge, CxEdgeType, CxNode, CxNodeType, CxStatus, cxNodeType } from 'ngx-cx-graph';

/** A fictional nightly data pipeline, laid out top down. */

const STATUS: Record<string, CxStatus> = {
  queued: { label: 'Queued', tone: 'basic' },
  running: { label: 'Running', tone: 'info' },
  ok: { label: 'Healthy', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  late: { label: 'Late', tone: 'warning' },
  stale: { label: 'Stale', tone: 'stale' },
};
const status = (n: CxNode) => STATUS[n.status ?? 'queued'];

export const PIPELINE_NODE_TYPES: Record<string, CxNodeType<any>> = {
  stage: cxNodeType({ label: 'Stage', icon: 'pi-objects-column', group: true, status: () => undefined }),
  source: cxNodeType({
    label: 'Source',
    plural: 'sources',
    icon: 'pi-database',
    size: { width: 200, height: 76 },
    status,
    detail: (n) => [
      { label: 'System', value: n.data.system },
      { label: 'Rows', value: n.data.rows },
    ],
    actions: () => [{ id: 'catalog', label: 'Open in catalog' }],
  }),
  job: cxNodeType({
    label: 'Job',
    plural: 'jobs',
    icon: 'pi-cog',
    mono: true,
    size: { width: 200, height: 56 },
    status,
    detail: (n) => [
      { label: 'Schedule', value: n.data.schedule, mono: true },
      { label: 'Last run', value: n.data.duration },
    ],
    actions: () => [
      { id: 'logs', label: 'Open logs' },
      { id: 'rerun', label: 'Run again' },
    ],
  }),
  dataset: cxNodeType({
    label: 'Dataset',
    plural: 'datasets',
    icon: 'pi-table',
    size: { width: 200, height: 76 },
    status,
    detail: (n) => [
      { label: 'Schema', value: n.data.schema, mono: true },
      { label: 'Freshness', value: n.data.freshness },
    ],
    actions: () => [{ id: 'catalog', label: 'Open in catalog' }],
  }),
  dashboard: cxNodeType({
    label: 'Dashboard',
    plural: 'dashboards',
    icon: 'pi-chart-bar',
    size: { width: 200, height: 76 },
    status,
    detail: (n) => [{ label: 'Audience', value: n.data.audience }],
    actions: () => [{ id: 'open', label: 'Open dashboard', href: '#dashboard' }],
  }),
};

export const PIPELINE_EDGE_TYPES: Record<string, CxEdgeType> = {
  reads: { label: 'Reads', tone: 'basic', width: 1.5 },
  writes: { label: 'Writes', tone: 'info', width: 2 },
  feeds: { label: 'Feeds', tone: 'primary', width: 2 },
};

const n = (id: string, kind: string, parent: string, label: string, data: object): CxNode => ({
  id,
  kind,
  parent,
  label,
  status: 'queued',
  data,
});

export const PIPELINE_NODES: CxNode[] = [
  { id: 's-ingest', kind: 'stage', label: 'Ingest' },
  n('src-orders', 'source', 's-ingest', 'Orders', { system: 'PostgreSQL · shop', rows: '4.2 M per day' }),
  n('src-events', 'source', 's-ingest', 'Clickstream', { system: 'Kafka · web-events', rows: '310 M per day' }),
  n('src-crm', 'source', 's-ingest', 'CRM accounts', { system: 'Salesforce export', rows: '86 k' }),
  n('src-fx', 'source', 's-ingest', 'FX rates', { system: 'Vendor API', rows: '170 per day' }),

  { id: 's-transform', kind: 'stage', label: 'Transform' },
  n('job-clean', 'job', 's-transform', 'clean_orders', { schedule: '0 1 * * *', duration: '6 min' }),
  n('job-sess', 'job', 's-transform', 'sessionize_events', { schedule: '0 1 * * *', duration: '24 min' }),
  n('job-cust', 'job', 's-transform', 'build_customers', { schedule: '30 1 * * *', duration: '4 min' }),
  n('ds-orders', 'dataset', 's-transform', 'orders_clean', { schema: 'staging.orders_clean', freshness: 'Daily by 02:00' }),
  n('ds-sess', 'dataset', 's-transform', 'sessions', { schema: 'staging.sessions', freshness: 'Daily by 02:30' }),
  n('ds-cust', 'dataset', 's-transform', 'customers', { schema: 'staging.customers', freshness: 'Daily by 02:00' }),

  { id: 's-model', kind: 'stage', label: 'Model' },
  n('job-rev', 'job', 's-model', 'revenue_daily', { schedule: '0 3 * * *', duration: '9 min' }),
  n('job-funnel', 'job', 's-model', 'funnel_daily', { schedule: '0 3 * * *', duration: '12 min' }),
  n('ds-rev', 'dataset', 's-model', 'fct_revenue', { schema: 'marts.fct_revenue', freshness: 'Daily by 04:00' }),
  n('ds-funnel', 'dataset', 's-model', 'fct_funnel', { schema: 'marts.fct_funnel', freshness: 'Daily by 04:00' }),

  { id: 's-serve', kind: 'stage', label: 'Serve' },
  n('dash-exec', 'dashboard', 's-serve', 'Executive revenue', { audience: 'Leadership, daily' }),
  n('dash-growth', 'dashboard', 's-serve', 'Growth funnel', { audience: 'Product and marketing' }),
  n('dash-fin', 'dashboard', 's-serve', 'Finance close', { audience: 'Finance, month end' }),
];

export const PIPELINE_EDGES: CxEdge[] = [
  { from: 'src-orders', to: 'job-clean', kind: 'reads' },
  { from: 'src-fx', to: 'job-clean', kind: 'reads' },
  { from: 'job-clean', to: 'ds-orders', kind: 'writes' },
  { from: 'src-events', to: 'job-sess', kind: 'reads' },
  { from: 'job-sess', to: 'ds-sess', kind: 'writes' },
  { from: 'src-crm', to: 'job-cust', kind: 'reads' },
  { from: 'src-orders', to: 'job-cust', kind: 'reads' },
  { from: 'job-cust', to: 'ds-cust', kind: 'writes' },
  { from: 'ds-orders', to: 'job-rev', kind: 'reads' },
  { from: 'ds-cust', to: 'job-rev', kind: 'reads' },
  { from: 'job-rev', to: 'ds-rev', kind: 'writes' },
  { from: 'ds-sess', to: 'job-funnel', kind: 'reads' },
  { from: 'ds-cust', to: 'job-funnel', kind: 'reads' },
  { from: 'job-funnel', to: 'ds-funnel', kind: 'writes' },
  { from: 'ds-rev', to: 'dash-exec', kind: 'feeds' },
  { from: 'ds-rev', to: 'dash-fin', kind: 'feeds' },
  { from: 'ds-funnel', to: 'dash-growth', kind: 'feeds' },
  { from: 'ds-funnel', to: 'dash-exec', kind: 'feeds' },
];

/** One simulated run: the order in which nodes start and how each ends. */
export const RUN_ORDER: [string, string][] = [
  ['src-orders', 'ok'], ['src-events', 'ok'], ['src-crm', 'late'], ['src-fx', 'ok'],
  ['job-clean', 'ok'], ['job-sess', 'failed'], ['job-cust', 'ok'],
  ['ds-orders', 'ok'], ['ds-sess', 'stale'], ['ds-cust', 'ok'],
  ['job-rev', 'ok'], ['job-funnel', 'ok'],
  ['ds-rev', 'ok'], ['ds-funnel', 'stale'],
  ['dash-exec', 'ok'], ['dash-growth', 'stale'], ['dash-fin', 'ok'],
];
