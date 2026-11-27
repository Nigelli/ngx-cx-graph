import { CxEdgeType, CxNode, CxNodeType, CxStatus, CxTone, cxNodeType } from 'ngx-cx-graph';

const STATUS: Record<string, CxStatus> = {
  planned: { label: 'Planned', tone: 'basic' },
  running: { label: 'Running', tone: 'info' },
  waiting: { label: 'Waiting', tone: 'warning' },
  done: { label: 'Done', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'basic' },
};
const status = (n: CxNode) => STATUS[n.status ?? ''] ?? { label: n.status ?? '', tone: 'basic' };

const ACH: Record<string, CxStatus> = {
  open: { label: 'Open', tone: 'info' },
  supported: { label: 'Supported', tone: 'success' },
  eliminated: { label: 'Eliminated', tone: 'basic' },
};
const TEST: Record<string, CxStatus> = {
  untested: { label: 'Untested', tone: 'basic' },
  confirms: { label: 'Confirms', tone: 'success' },
  refutes: { label: 'Refutes', tone: 'danger' },
  inconclusive: { label: 'Inconclusive', tone: 'warning' },
};
const VERDICT: Record<string, { label: string; tone: CxTone }> = {
  true_positive: { label: 'True positive', tone: 'danger' },
  benign_true_positive: { label: 'Benign true positive', tone: 'warning' },
  false_positive: { label: 'False positive', tone: 'success' },
  indeterminate: { label: 'Indeterminate', tone: 'basic' },
};
const words = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');
const logRef = (n: CxNode) => (n.data?.logRef ? `epoch ${n.data.logRef.epoch} · ${n.data.logRef.scope}` : '');

export const SESSION_NODE_TYPES: Record<string, CxNodeType<any>> = {
  step: cxNodeType({
    label: 'Step',
    icon: 'layers-outline',
    group: true,
    status,
    detail: (n) => [{ label: 'Step', value: n.data?.stepLabel ?? n.label ?? '' }],
    actions: () => [{ id: 'trace', label: 'Show in trace' }],
  }),
  planned_item: cxNodeType({
    label: 'Planned item',
    plural: 'planned items',
    icon: 'list-outline',
    border: 'dashed',
    status,
    actions: () => [{ id: 'trace', label: 'Show in trace' }],
  }),
  tool_call: cxNodeType({
    label: 'Tool call',
    plural: 'tool calls',
    icon: 'settings-2-outline',
    mono: true,
    status,
    detail: (n) =>
      [
        { label: 'Reason', value: n.data?.reason ?? '' },
        { label: 'Log ref', value: logRef(n), mono: true },
      ].filter((f) => f.value),
    actions: (n) => [
      { id: 'trace', label: 'Open trace event' },
      { id: 'ledger', label: 'Open evidence', data: { entry: n.id + '.entry' } },
    ],
  }),
  ledger_entry: cxNodeType({
    label: 'Evidence',
    plural: 'evidence entries',
    icon: 'file-text-outline',
    ref: (n) => n.data.ref,
    status: (n) => ({ label: words(n.data.kind), tone: n.data.status === 'error' ? 'danger' : 'basic' }),
    actions: (n) => [
      { id: 'ledger', label: 'Open in ledger' },
      ...(n.data.artifact ? [{ id: 'artifact', label: 'Download' }] : []),
    ],
  }),
  'sans.hypothesis': cxNodeType({
    label: 'Hypothesis',
    plural: 'tests',
    icon: 'bulb-outline',
    size: { width: 260, height: 76 },
    status: (n) => ACH[n.data?.state] ?? ACH['open'],
    detail: (n) => [
      { label: 'Implies', value: VERDICT[n.data?.impliedVerdict]?.label ?? '' },
    ],
    actions: () => [{ id: 'hypotheses', label: 'Open in hypotheses' }],
  }),
  'sans.discriminator': cxNodeType({
    label: 'Test',
    plural: 'tests',
    icon: 'funnel-outline',
    status: (n) => TEST[n.data?.outcome] ?? TEST['untested'],
    detail: (n) => [
      { label: 'Expectation', value: n.data?.expectation ?? '' },
    ],
    actions: () => [{ id: 'hypotheses', label: 'Open in hypotheses' }],
  }),
  finding: cxNodeType({
    label: 'Finding',
    plural: 'findings',
    icon: 'checkmark-circle-2-outline',
    status: (n) => ({ label: words(n.data?.confidence ?? 'finding'), tone: 'success' }),
  }),
  open_question: cxNodeType({
    label: 'Question',
    plural: 'questions',
    icon: 'question-mark-circle-outline',
    status: (n) => (n.data?.answer ? { label: 'Answered', tone: 'success' } : { label: 'Open', tone: 'warning' }),
    detail: (n) =>
      [
        { label: 'Answer', value: n.data?.answer ?? '' },
      ].filter((f) => f.value),
  }),
  'sans.recommended_action': cxNodeType({
    label: 'Action',
    plural: 'actions',
    icon: 'flash-outline',
    status: () => ({ label: 'Recommended', tone: 'primary' }),
    detail: (n) =>
      [
        { label: 'Rationale', value: n.data?.rationale ?? '' },
      ].filter((f) => f.value),
    actions: () => [{ id: 'outcome', label: 'Open outcome' }],
  }),
  outcome: cxNodeType({
    label: 'Outcome',
    icon: 'flag-outline',
    emphasis: true,
    size: { width: 240, height: 100 },
    title: (n) => VERDICT[n.data.disposition.verdict]?.label ?? 'Outcome',
    subtitle: (n) => 'Confidence: ' + n.data.confidence,
    status: (n) => ({ label: words(n.data.stopReason), tone: 'success' }),
    fill: (n) => VERDICT[n.data.disposition.verdict]?.tone,
    detail: (n) => [
      { label: 'Summary', value: n.data.summary },
      {
        label: 'Evidence',
        value: `${n.data.disposition.confirmingEntryIds.length} confirm · ${n.data.disposition.eliminatingEntryIds.length} eliminate`,
      },
      { label: 'Actions', value: `${n.data.recommendedActions.length} recommended` },
    ],
    actions: () => [
      { id: 'outcome', label: 'Open outcome' },
      { id: 'ledger', label: 'Show evidence' },
    ],
  }),
};

// The steps ran one after another, so "then" edges set the layout.
// Evidence edges often point back in time. They are drawn, but they do
// not decide where anything goes.
export const SESSION_EDGE_TYPES: Record<string, CxEdgeType> = {
  then: { label: 'Then', tone: 'basic', width: 1.5 },
  carries_out: { label: 'Carries out', tone: 'basic', width: 1.5 },
  produced: { label: 'Produced', tone: 'info', width: 1.5 },
  supports: { label: 'Supports', tone: 'success', width: 2, layout: false },
  contradicts: { label: 'Contradicts', tone: 'danger', width: 2, dash: [6, 5], layout: false },
  'sans.tests': { label: 'Tests', tone: 'warning', width: 1.5, layout: false },
  depends_on: { label: 'Depends on', tone: 'basic', width: 1.5, dash: [2, 4], layout: false },
  concludes: { label: 'Concludes', tone: 'primary', width: 2.5, layout: false },
};
