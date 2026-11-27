import { CxEdge, CxEdgeType, CxNode, CxNodeType, CxStatus, cxNodeType } from 'ngx-cx-graph';

/**
 * A fictional run of a research agent that answers one question:
 * which e-bike should a commuter buy? Every product, site and figure is
 * invented. The run is a sequence of steps. Inside them are the searches
 * the agent made, the sources it found, and the claims it weighed.
 */

const RUN: Record<string, CxStatus> = {
  planned: { label: 'Planned', tone: 'basic' },
  running: { label: 'Running', tone: 'info' },
  done: { label: 'Done', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
};
const run = (n: CxNode) => RUN[n.status ?? 'planned'];

export const RUN_NODE_TYPES: Record<string, CxNodeType<any>> = {
  step: cxNodeType({ label: 'Step', icon: 'layers-outline', group: true, status: run }),
  question: cxNodeType({
    label: 'Question',
    plural: 'questions',
    icon: 'question-mark-circle-outline',
    status: (n) => (n.data.answer ? { label: 'Answered', tone: 'success' } : { label: 'Open', tone: 'warning' }),
    detail: (n) => (n.data.answer ? [{ label: 'Answer', value: n.data.answer }] : []),
  }),
  task: cxNodeType({
    label: 'Planned search',
    plural: 'planned searches',
    icon: 'list-outline',
    border: 'dashed',
    status: () => RUN['planned'],
    detail: (n) => [{ label: 'Why', value: n.data.why }],
  }),
  tool_call: cxNodeType({
    label: 'Tool call',
    plural: 'tool calls',
    icon: 'settings-2-outline',
    mono: true,
    status: run,
    detail: (n) => [
      { label: 'Query', value: n.data.query, mono: true },
      { label: 'Took', value: n.data.took },
    ],
    actions: () => [{ id: 'trace', label: 'Open trace event' }],
  }),
  source: cxNodeType({
    label: 'Source',
    plural: 'sources',
    icon: 'file-text-outline',
    ref: (n) => n.data.ref,
    status: (n) => ({ label: n.data.type, tone: 'basic' }),
    actions: () => [
      { id: 'source', label: 'Open source' },
      { id: 'cite', label: 'Copy citation' },
    ],
  }),
  option: cxNodeType({
    label: 'Option',
    plural: 'claims',
    icon: 'bulb-outline',
    group: true,
    status: (n) =>
      n.data.chosen ? { label: 'Chosen', tone: 'success' } : { label: 'Ruled out', tone: 'basic' },
    detail: (n) => [
      { label: 'Price', value: n.data.price },
      { label: 'Weight', value: n.data.weight },
      { label: 'Range', value: n.data.range },
    ],
  }),
  claim: cxNodeType({
    label: 'Claim',
    plural: 'claims',
    icon: 'checkmark-circle-2-outline',
    status: (n) =>
      n.data.holds ? { label: 'Holds', tone: 'success' } : { label: 'Disputed', tone: 'warning' },
    detail: (n) => [{ label: 'Weight', value: n.data.weight }],
  }),
  followup: cxNodeType({
    label: 'Follow-up',
    plural: 'follow-ups',
    icon: 'flash-outline',
    status: () => ({ label: 'Suggested', tone: 'primary' }),
  }),
  answer: cxNodeType({
    label: 'Answer',
    icon: 'flag-outline',
    emphasis: true,
    size: { width: 240, height: 100 },
    subtitle: (n) => 'Confidence: ' + n.data.confidence,
    status: () => ({ label: 'Final', tone: 'success' }),
    fill: () => 'success',
    detail: (n) => [{ label: 'Summary', value: n.data.summary }],
    actions: () => [{ id: 'answer', label: 'Open answer' }],
  }),
};

// The steps ran one after another, so "then" edges set the layout.
// Evidence edges link a source to a claim wherever each happens to sit.
// They are drawn, but they do not decide where anything goes.
export const RUN_EDGE_TYPES: Record<string, CxEdgeType> = {
  then: { label: 'Then', tone: 'basic', width: 1.5 },
  runs: { label: 'Runs', tone: 'basic', width: 1.5 },
  found: { label: 'Found', tone: 'info', width: 1.5 },
  supports: { label: 'Supports', tone: 'success', width: 2, layout: false },
  contradicts: { label: 'Contradicts', tone: 'danger', width: 2, dash: [6, 5], layout: false },
  concludes: { label: 'Concludes', tone: 'primary', width: 2.5, layout: false },
};

export interface Reason {
  text: string;
  claim: string;
  sources: string[];
}

export interface ResearchRun {
  nodes: CxNode[];
  edges: CxEdge[];
  question: string;
  answer: string;
  summary: string;
  reasons: Reason[];
  sourceRef: (id: string) => string;
}

const STEPS = ['Understand', 'Plan', 'Search', 'Compare', 'Answer'];

const QUESTIONS: [string, string?][] = [
  ['How far is the daily commute, and is it hilly?', '14 km each way with one long climb.'],
  ['Does the bike need to be carried up stairs?', 'Yes, one flight at home, so weight matters.'],
  ['Is there secure parking at work?'],
];

// Planned search, why, then the searches made for it:
// [query, site, source type, source title, snippet] or [query] when it failed.
const PLAN: [string, string, (string[])[]][] = [
  ['Find current prices for the three shortlisted models', 'The budget is £2,000 all in.', [
    ['vela c3 price', 'cyclebarn.example', 'Retailer', 'Vela C3 at £1,650, in stock', 'Vela C3 2026, £1,650.00. Free delivery. Mudguards and rack included.'],
    ['northwind glide price', 'cyclebarn.example', 'Retailer', 'Northwind Glide at £1,950', 'Northwind Glide, £1,950.00. Lights included. Rack £45 extra.'],
    ['kestrel metro price', 'pedalpost.example', 'Retailer', 'Kestrel Metro at £1,400', 'Kestrel Metro, £1,400.00. Assembled and checked before dispatch.'],
  ]],
  ['Get the weight of each model', 'The bike is carried up a flight of stairs every day.', [
    ['vela c3 weight kg', 'velabikes.example', 'Spec sheet', 'Vela C3 weighs 21 kg with battery', 'Weight: 21.0 kg including battery. Battery removable: yes (2.9 kg).'],
    ['northwind glide weight kg', 'northwind.example', 'Spec sheet', 'Northwind Glide weighs 18 kg', 'Weight: 18.2 kg including battery. Frame: aluminium. Mid-drive motor.'],
    ['kestrel metro weight kg', 'kestrelcycles.example', 'Spec sheet', 'Kestrel Metro weighs 24 kg', 'Weight: 24.1 kg. Battery fixed in the down tube.'],
  ]],
  ['Check real-world range on hilly routes', 'Makers quote range on flat ground.', [
    ['northwind glide range hills review', 'spokesmag.example', 'Review', 'Glide managed 62 km on a hilly test loop', 'On our 900 m climbing loop the Glide lasted 62 km in the middle assist mode, well short of the claimed 90 km but the best on test.'],
    ['vela c3 range hills review', 'spokesmag.example', 'Review', 'C3 managed 41 km on the same loop', 'The hub motor works hard on climbs. We saw 41 km against a claimed 70 km.'],
    ['kestrel metro range hills'],
  ]],
  ['Look for reliability problems reported by owners', 'A commuter bike is used in all weather.', [
    ['vela c3 problems forum', 'ridersforum.example', 'Forum', 'Several owners report C3 controller faults in rain', 'Mine cut out twice in heavy rain. The shop replaced the controller under warranty. Three others in this thread had the same.'],
    ['northwind glide problems forum', 'ridersforum.example', 'Forum', 'Glide owners report few faults after a year', 'A year and 4,000 km of commuting, one brake pad change, nothing else. Display fogs a little in winter.'],
    ['kestrel metro problems forum', 'ridersforum.example', 'Forum', 'Metro owners find it heavy but dependable', 'It is a tank. Never let me down, but I would not want to carry it anywhere.'],
  ]],
  ['Check warranty and service cover', 'Repairs must not leave the rider without transport.', [
    ['northwind warranty battery', 'northwind.example', 'Policy', 'Northwind: 3 years on battery and motor', 'Battery and motor are covered for three years or 30,000 km, whichever comes first.'],
    ['vela warranty battery', 'velabikes.example', 'Policy', 'Vela: 2 years on battery and motor', 'Two years on electrical parts. Service partners in most large towns.'],
    ['kestrel warranty battery'],
  ]],
];

// Option, price, weight, range, chosen, then its claims:
// [text, holds, weight in the decision, supporting sources, contradicting sources]
const OPTIONS: [string, string, string, string, boolean, [string, boolean, string, number[], number[]][]][] = [
  ['Northwind Glide', '£1,950', '18 kg', '62 km tested', true, [
    ['Light enough to carry up a flight of stairs', true, 'High', [5], []],
    ['Has the range for a hilly 28 km day with margin', true, 'High', [7], []],
    ['Fits the budget once a rack is added', true, 'Medium', [2], []],
    ['Owners report it as reliable', true, 'Medium', [10, 12], []],
  ]],
  ['Vela C3', '£1,650', '21 kg', '41 km tested', false, [
    ['Cheapest way to get a fully equipped bike', true, 'Medium', [1], []],
    ['Has the range for a hilly 28 km day with margin', false, 'High', [], [8]],
    ['Copes with year-round commuting in rain', false, 'High', [], [9]],
  ]],
  ['Kestrel Metro', '£1,400', '24 kg', 'Not tested', false, [
    ['Lowest price of the three', true, 'Low', [3], []],
    ['Light enough to carry up a flight of stairs', false, 'High', [], [6, 11]],
  ]],
];

export function buildResearchRun(): ResearchRun {
  const nodes: CxNode[] = [];
  const edges: CxEdge[] = [];
  const stepId = (name: string) => 'step-' + name.toLowerCase();

  STEPS.forEach((name, i) => {
    nodes.push({ id: stepId(name), kind: 'step', label: name, status: 'done' });
    if (i) edges.push({ from: stepId(STEPS[i - 1]), to: stepId(name), kind: 'then' });
  });

  QUESTIONS.forEach(([q, answer], i) =>
    nodes.push({ id: 'q' + (i + 1), kind: 'question', parent: stepId('Understand'), label: q, data: { answer } }),
  );

  const sources: string[] = [];
  let call = 0;
  PLAN.forEach(([label, why, searches], t) => {
    const task = 'task' + (t + 1);
    nodes.push({ id: task, kind: 'task', parent: stepId('Plan'), label, data: { why } });
    for (const [query, site, type, title, snippet] of searches) {
      const id = 'call' + ++call;
      nodes.push({
        id,
        kind: 'tool_call',
        parent: stepId('Search'),
        label: 'web_search',
        status: site ? 'done' : 'failed',
        data: { query, took: site ? `${(0.6 + (call % 5) * 0.3).toFixed(1)} s` : 'Timed out after 10 s' },
      });
      edges.push({ from: task, to: id, kind: 'runs' });
      if (!site) continue;
      const ref = 'S-' + String(sources.length + 1).padStart(2, '0');
      const source = 'source' + (sources.length + 1);
      sources.push(source);
      nodes.push({ id: source, kind: 'source', parent: stepId('Search'), label: title, data: { ref, site, type, snippet, query } });
      edges.push({ from: id, to: source, kind: 'found' });
    }
  });

  const reasons: Reason[] = [];
  OPTIONS.forEach(([label, price, weight, range, chosen, claims], o) => {
    const option = 'option' + (o + 1);
    nodes.push({ id: option, kind: 'option', parent: stepId('Compare'), label, data: { price, weight, range, chosen } });
    claims.forEach(([text, holds, importance, supports, contradicts], c) => {
      const claim = `${option}-claim${c + 1}`;
      nodes.push({ id: claim, kind: 'claim', parent: option, label: text, data: { holds, weight: importance } });
      for (const s of supports) edges.push({ from: sources[s - 1], to: claim, kind: 'supports' });
      for (const s of contradicts) edges.push({ from: sources[s - 1], to: claim, kind: 'contradicts' });
      const cited = [...supports, ...contradicts].map((s) => sources[s - 1]);
      if (chosen) reasons.push({ text, claim, sources: cited });
      else if (!holds) reasons.push({ text: `${label}: not "${text.toLowerCase()}"`, claim, sources: cited });
    });
    if (chosen) edges.push({ from: option, to: 'answer', kind: 'concludes' });
  });

  const summary =
    'The Northwind Glide is the only one of the three that is light enough to carry, has tested range to spare on a hilly 28 km day, and has a clean reliability record. It uses nearly all of the budget.';
  nodes.push({
    id: 'answer',
    kind: 'answer',
    parent: stepId('Answer'),
    label: 'Buy the Northwind Glide',
    status: 'done',
    data: { confidence: 'high', summary },
  });
  ['Test ride the Glide on the home climb', 'Ask the shop to fit the rack before collection', 'Check that workplace parking is covered'].forEach(
    (label, i) => nodes.push({ id: 'followup' + (i + 1), kind: 'followup', parent: stepId('Answer'), label }),
  );

  const refs = new Map(nodes.filter((n) => n.kind === 'source').map((n) => [n.id, n.data.ref as string]));
  return {
    nodes,
    edges,
    question: 'Which e-bike should a commuter buy for a hilly 14 km ride, under £2,000?',
    answer: 'Northwind Glide',
    summary,
    reasons,
    sourceRef: (id) => refs.get(id) ?? id,
  };
}
