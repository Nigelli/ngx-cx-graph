import { CxEdge, CxEdgeType, CxNode, CxNodeType, CxTone, cxNodeType } from 'ngx-cx-graph';

/**
 * A fictional attack graph. Zones are groups, assets and weaknesses are
 * nodes, and edges are the steps an attacker could take.
 */

const SEVERITY: Record<string, CxTone> = { critical: 'danger', high: 'warning', medium: 'info', low: 'basic' };
const title = (s: string) => s[0].toUpperCase() + s.slice(1);

export const ATTACK_NODE_TYPES: Record<string, CxNodeType<any>> = {
  zone: cxNodeType({ label: 'Zone', icon: 'shield', group: true, status: () => undefined }),
  entry: cxNodeType({
    label: 'Entry point',
    icon: 'globe',
    status: () => ({ label: 'External', tone: 'danger' }),
    detail: (n) => [{ label: 'Technique', value: n.data.technique }],
  }),
  host: cxNodeType({
    label: 'Host',
    plural: 'hosts',
    icon: 'server',
    size: { width: 240, height: 84 },
    status: (n) =>
      n.data.exposed ? { label: 'Exposed', tone: 'warning' } : { label: 'Internal', tone: 'basic' },
    detail: (n) => [
      { label: 'Address', value: n.data.ip, mono: true },
      { label: 'OS', value: n.data.os },
      { label: 'Owner', value: n.data.owner },
    ],
    actions: () => [
      { id: 'asset', label: 'Open asset' },
      { id: 'isolate', label: 'Isolate host' },
    ],
  }),
  vuln: cxNodeType({
    label: 'Vulnerability',
    plural: 'vulnerabilities',
    icon: 'bug',
    mono: true,
    ref: (n) => n.data.cvss,
    status: (n) => ({ label: title(n.data.severity), tone: SEVERITY[n.data.severity] }),
    detail: (n) => [
      { label: 'Summary', value: n.data.summary },
      { label: 'Fix', value: n.data.fix },
    ],
    actions: () => [{ id: 'ticket', label: 'Create ticket' }],
  }),
  identity: cxNodeType({
    label: 'Identity',
    plural: 'identities',
    icon: 'user',
    status: (n) =>
      n.data.privileged ? { label: 'Privileged', tone: 'warning' } : { label: 'Standard', tone: 'basic' },
    detail: (n) => [
      { label: 'Type', value: n.data.type },
      { label: 'MFA', value: n.data.mfa ? 'Enforced' : 'Not enforced' },
    ],
    actions: () => [{ id: 'identity', label: 'Open identity' }],
  }),
  crown: cxNodeType({
    label: 'Crown jewel',
    icon: 'database',
    emphasis: true,
    size: { width: 240, height: 96 },
    subtitle: (n) => n.data.classification,
    status: () => ({ label: 'Target', tone: 'danger' }),
    fill: () => 'danger',
    detail: (n) => [
      { label: 'Holds', value: n.data.holds },
      { label: 'Owner', value: n.data.owner },
    ],
    actions: () => [{ id: 'asset', label: 'Open asset' }],
  }),
};

export const ATTACK_EDGE_TYPES: Record<string, CxEdgeType> = {
  exploits: { label: 'Exploits', tone: 'danger', width: 2 },
  has: { label: 'Has weakness', tone: 'basic', width: 1.5, arrow: false },
  lateral: { label: 'Lateral movement', tone: 'warning', width: 2, dash: [6, 5] },
  credential: { label: 'Uses credential', tone: 'info', width: 1.5 },
  reaches: { label: 'Reaches', tone: 'primary', width: 2.5 },
};

const zone = (id: string, label: string, childCount?: number): CxNode => ({ id, kind: 'zone', label, childCount });
const host = (id: string, parent: string, label: string, ip: string, os: string, owner: string, exposed = false): CxNode => ({
  id,
  kind: 'host',
  parent,
  label,
  data: { ip, os, owner, exposed },
});
const vuln = (id: string, parent: string, cve: string, severity: string, cvss: string, summary: string, fix: string): CxNode => ({
  id,
  kind: 'vuln',
  parent,
  label: cve,
  data: { severity, cvss, summary, fix },
});

export const ATTACK_NODES: CxNode[] = [
  zone('z-internet', 'Internet'),
  { id: 'phish', kind: 'entry', parent: 'z-internet', label: 'Phishing email with a lure document', data: { technique: 'T1566.001 Spearphishing attachment' } },
  { id: 'scan', kind: 'entry', parent: 'z-internet', label: 'Internet scan of the public VPN gateway', data: { technique: 'T1190 Exploit public-facing application' } },

  zone('z-dmz', 'DMZ'),
  host('vpn', 'z-dmz', 'vpn-gw-01', '203.0.113.10', 'Appliance firmware 9.1', 'Network team', true),
  vuln('cve-vpn', 'z-dmz', 'CVE-2025-10412', 'critical', '9.8', 'Pre-auth remote code execution in the VPN web portal.', 'Upgrade the firmware to 9.1.4.'),
  host('web', 'z-dmz', 'web-portal-02', '203.0.113.24', 'Ubuntu 22.04', 'Web platform', true),
  vuln('cve-web', 'z-dmz', 'CVE-2024-38819', 'high', '7.5', 'Path traversal in the static resource handler.', 'Upgrade the framework to 6.1.14.'),

  zone('z-corp', 'Corporate network'),
  host('ws-ada', 'z-corp', 'ws-ada-lovelace', '10.20.4.18', 'Windows 11', 'Finance'),
  { id: 'id-ada', kind: 'identity', parent: 'z-corp', label: 'ada.lovelace', data: { type: 'User', mfa: true, privileged: false } },
  host('jump', 'z-corp', 'jump-admin-01', '10.20.0.5', 'Windows Server 2022', 'IT operations'),
  { id: 'id-svc', kind: 'identity', parent: 'z-corp', label: 'svc-backup', data: { type: 'Service account', mfa: false, privileged: true } },
  vuln('weak-svc', 'z-corp', 'Kerberoastable SPN', 'high', '8.1', 'The service account has an SPN and a weak password.', 'Rotate to a 30+ character managed password.'),

  // This zone loads its hosts on demand, a page at a time.
  zone('z-fleet', 'Workstation fleet', 40),

  zone('z-server', 'Server VLAN'),
  host('files', 'z-server', 'fs-finance-01', '10.30.1.12', 'Windows Server 2019', 'Finance'),
  host('backup', 'z-server', 'backup-01', '10.30.1.40', 'Rocky Linux 9', 'IT operations'),
  vuln('cve-smb', 'z-server', 'CVE-2024-43642', 'medium', '6.5', 'SMB signing is not required on the file server.', 'Require SMB signing by group policy.'),
  host('dc', 'z-server', 'dc-01', '10.30.0.2', 'Windows Server 2022', 'Identity team'),

  zone('z-data', 'Data stores'),
  { id: 'crown-fin', kind: 'crown', parent: 'z-data', label: 'Finance data warehouse', data: { classification: 'Restricted', holds: 'Ledger, payroll and bank files', owner: 'CFO office' } },
  { id: 'crown-ad', kind: 'crown', parent: 'z-data', label: 'Domain admin', data: { classification: 'Tier 0', holds: 'Control of every domain-joined machine', owner: 'Identity team' } },
];

export const ATTACK_EDGES: CxEdge[] = [
  { from: 'scan', to: 'cve-vpn', kind: 'exploits', label: 'T1190' },
  { from: 'vpn', to: 'cve-vpn', kind: 'has' },
  { from: 'cve-vpn', to: 'jump', kind: 'lateral', label: 'T1021' },
  { from: 'scan', to: 'cve-web', kind: 'exploits' },
  { from: 'web', to: 'cve-web', kind: 'has' },
  { from: 'cve-web', to: 'files', kind: 'lateral' },
  { from: 'phish', to: 'ws-ada', kind: 'exploits', label: 'T1204' },
  { from: 'ws-ada', to: 'id-ada', kind: 'credential' },
  { from: 'id-ada', to: 'files', kind: 'lateral' },
  { from: 'ws-ada', to: 'jump', kind: 'lateral' },
  { from: 'jump', to: 'ws-ada', kind: 'lateral' },
  { from: 'jump', to: 'weak-svc', kind: 'exploits', label: 'T1558.003' },
  { from: 'id-svc', to: 'weak-svc', kind: 'has' },
  { from: 'weak-svc', to: 'id-svc', kind: 'credential' },
  { from: 'id-svc', to: 'backup', kind: 'lateral' },
  { from: 'backup', to: 'dc', kind: 'lateral' },
  { from: 'files', to: 'cve-smb', kind: 'has' },
  { from: 'cve-smb', to: 'dc', kind: 'exploits' },
  { from: 'files', to: 'crown-fin', kind: 'reaches' },
  { from: 'backup', to: 'crown-fin', kind: 'reaches' },
  { from: 'dc', to: 'crown-ad', kind: 'reaches' },
];

export interface AttackPath {
  name: string;
  risk: string;
  steps: string[];
}

export const ATTACK_PATHS: AttackPath[] = [
  { name: 'VPN exploit to domain admin', risk: 'Critical', steps: ['scan', 'cve-vpn', 'jump', 'weak-svc', 'id-svc', 'backup', 'dc', 'crown-ad'] },
  { name: 'Phishing to finance data', risk: 'High', steps: ['phish', 'ws-ada', 'id-ada', 'files', 'crown-fin'] },
  { name: 'Web portal to finance data', risk: 'High', steps: ['scan', 'cve-web', 'files', 'crown-fin'] },
];

/** Stands in for an API that pages the workstation fleet. */
export function loadFleet(offset: number, limit: number): Promise<{ nodes: CxNode[]; edges: CxEdge[] }> {
  const nodes: CxNode[] = [];
  const edges: CxEdge[] = [];
  for (let i = offset; i < Math.min(40, offset + limit); i++) {
    const id = 'ws-' + String(i + 1).padStart(3, '0');
    nodes.push(host(id, 'z-fleet', id, '10.20.8.' + (i + 10), i % 3 ? 'Windows 11' : 'macOS 15', 'Mixed'));
    if (i % 4 === 0) edges.push({ from: 'phish', to: id, kind: 'exploits' });
  }
  return new Promise((resolve) => setTimeout(() => resolve({ nodes, edges }), 500));
}
