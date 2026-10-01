import { useState } from 'react';
import type { ReactElement } from 'react';
import './systemsRegistry.css';

/**
 * The 17 governed business systems, copied from the ACTIVE_CANON registry in
 * estibancreations-svg/Master-System-Buildout (00-CENTRAL-HUB/Registries/SYSTEM-REGISTRY.md).
 * `state` is implementation truth. Nothing here is VERIFIED, and a route existing does not mean a system is healthy.
 */
export type RegistryState = 'PARTIAL' | 'RECOVERY_REQUIRED' | 'SPECIFICATION_ONLY' | 'NOT_IMPLEMENTED';
export type RegistrySystem = { n: number; id: string; name: string; purpose: string; state: RegistryState; where: string; open?: string };

export const REGISTRY_SOURCE = 'Master-System-Buildout SYSTEM-REGISTRY.md';
export const REGISTRY_RECONCILED = '2026-09-19';

export const SYSTEM_REGISTRY: RegistrySystem[] = [
  { n: 1, id: 'SYS-DASH-001', name: 'Master Dashboard', purpose: 'Enterprise operational aggregation, navigation, system launcher and everyday overview.', state: 'PARTIAL', where: 'MASTER_CEO_DASHBOARD /dashboard; global navigation and module shell.', open: 'dashboard' },
  { n: 2, id: 'SYS-CEO-001', name: 'CEO Command Center', purpose: 'Executive governance, decisions, approvals, risk, finance, C-Suite intelligence and THELMA recommendations.', state: 'PARTIAL', where: '/c-suite/executive-overview; Resource and Ecosystem controls (PR #40).', open: 'suite' },
  { n: 3, id: 'SYS-THELMA-001', name: 'T.H.E.L.M.A.', purpose: 'Enterprise operating intelligence: diagnosis, delegation, agents, White Blood Cells, governed repairs, model, resource and tool routing.', state: 'PARTIAL', where: '/systems/thelma; thelma-ai; agent profiles; approvals; Base Ten runtime governance.', open: 'thelma' },
  { n: 4, id: 'SYS-FABRIC-001', name: 'EC Integration Fabric', purpose: 'Deterministic authorization, queueing, routing, retry, dead-letter, state and audit infrastructure.', state: 'PARTIAL', where: '/systems/integration-fabric; live queue and worker schema; generic false-success removed.', open: 'fabric' },
  { n: 5, id: 'SYS-VISION-001', name: 'VisionWeaver', purpose: 'Creative-production OS: story and asset continuity, image, video, audio, music, voice, timeline, production, QC and publishing handoff.', state: 'PARTIAL', where: '/systems/visionweaver; Runway generations; generation and billing receipts; orchestrator and studio runtime.', open: 'vision' },
  { n: 6, id: 'SYS-LAND-001', name: 'LandWeaver', purpose: 'GIS, property and map-first intelligence: parcel research, spatial evidence, zoning, hazards, utilities, comps and property workflow.', state: 'PARTIAL', where: '/systems/landweaver; connected property MVP and data foundation.', open: 'land' },
  { n: 7, id: 'SYS-GRANT-001', name: 'GrantOS', purpose: 'Grant lifecycle: discovery, qualification, evidence, drafting, review, submission, award and compliance.', state: 'PARTIAL', where: '/systems/grantos; operational MVP structures.', open: 'grant' },
  { n: 8, id: 'SYS-CMGIO-001', name: 'CMGIO', purpose: 'Marketing and growth intelligence: trends, campaigns, audience and content intelligence, attribution interpretation and optimization.', state: 'PARTIAL', where: '/systems/cmgio-map; campaign and control-plane foundation.', open: 'cmgio' },
  { n: 9, id: 'SYS-ADS-001', name: 'Master Advertising Platform (MAP)', purpose: 'Advertising strategy, creative, variants, experimentation, spend, boosts, platform execution and ad attribution.', state: 'RECOVERY_REQUIRED', where: 'No certified dedicated current workspace; related historical components exist.' },
  { n: 10, id: 'SYS-AGENCYFLOW-001', name: 'AgencyFlow', purpose: 'Agency operations: CRM, leads, clients, communications, social accounts and posting, services, workflows and operational agents.', state: 'RECOVERY_REQUIRED', where: 'No certified dedicated current workspace.' },
  { n: 11, id: 'SYS-CLIMATE-001', name: 'ClimateTrack Pro', purpose: 'Climate, sustainability and environmental intelligence with public and scientific data, monitoring and reporting.', state: 'RECOVERY_REQUIRED', where: 'Historical and repository evidence exists; no certified current enterprise workspace.' },
  { n: 12, id: 'SYS-PUBLISH-001', name: 'Publishing & Media Studio', purpose: 'Books, manuscripts, EPUB and PDF, audiobooks, media packages, canon, accessibility, release and distribution control.', state: 'SPECIFICATION_ONLY', where: 'No certified dedicated current workspace.' },
  { n: 13, id: 'SYS-IAM-001', name: 'IAM / Self-Help', purpose: 'Identity and access self-service, OAuth and connection health, governed recovery, role and permission assistance and revocation.', state: 'NOT_IMPLEMENTED', where: 'Core Supabase identity exists but no certified IAM product.' },
  { n: 14, id: 'SYS-TELECOM-001', name: 'Telecommunications', purpose: 'Voice, SIP and SMS, call routing, communications history, transcription, QA and coaching, and escalation.', state: 'NOT_IMPLEMENTED', where: 'No certified dedicated current product.' },
  { n: 15, id: 'SYS-ASSESS-001', name: 'Assessment Suite', purpose: 'Assessments, instruments, scoring, longitudinal results and capability and skills intelligence.', state: 'NOT_IMPLEMENTED', where: 'No certified dedicated current product.' },
  { n: 16, id: 'SYS-TRAINING-001', name: 'AI Mastery / Training', purpose: 'Curriculum, tutoring, exercises, mastery, evaluations, certificates and training intelligence.', state: 'PARTIAL', where: 'Existing /modules/ai-mastery route and module material; no certified independent full workspace.', open: 'aimastery' },
  { n: 17, id: 'SYS-QC-001', name: 'Quality Control Agency', purpose: 'Independent testing, regression, release evidence, model and provider evaluation and system certification.', state: 'PARTIAL', where: 'AUDITOR, VERITAS and WBC regression concepts; GitHub Quality Gate; Analyst evidence.' }
];

const STATES: RegistryState[] = ['PARTIAL', 'RECOVERY_REQUIRED', 'SPECIFICATION_ONLY', 'NOT_IMPLEMENTED'];
const MEANING: Record<RegistryState, string> = {
  PARTIAL: 'Meaningful implementation exists; coverage is incomplete.',
  RECOVERY_REQUIRED: 'Historical evidence exists; the current product must be rebuilt.',
  SPECIFICATION_ONLY: 'A design exists; no certified product yet.',
  NOT_IMPLEMENTED: 'Approved system with no current implementation.'
};
const label = (s: string) => s.replaceAll('_', ' ');

export default function SystemsRegistryPage({ onOpen }: { onOpen: (key: string) => void }): ReactElement {
  const [filter, setFilter] = useState<RegistryState | 'ALL'>('ALL');
  const counts = Object.fromEntries(STATES.map((s) => [s, SYSTEM_REGISTRY.filter((x) => x.state === s).length])) as Record<RegistryState, number>;
  const rows = filter === 'ALL' ? SYSTEM_REGISTRY : SYSTEM_REGISTRY.filter((x) => x.state === filter);
  return (
    <div className="sr">
      <p className="sr-note" role="note">
        Source: {REGISTRY_SOURCE}, reconciled {REGISTRY_RECONCILED}. These states describe what is built, not whether a system is healthy right now. No system here is certified VERIFIED.
      </p>
      <div className="sr-filters" role="group" aria-label="Filter by registry state">
        <button aria-pressed={filter === 'ALL'} onClick={() => setFilter('ALL')}>All <b>{SYSTEM_REGISTRY.length}</b></button>
        {STATES.map((s) => (
          <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)} title={MEANING[s]}>{label(s)} <b>{counts[s]}</b></button>
        ))}
      </div>
      <div className="sr-grid">
        {rows.map((x) => (
          <article className="sr-card" key={x.id} data-state={x.state}>
            <header>
              <span className="sr-n">{String(x.n).padStart(2, '0')}</span>
              <div><h3>{x.name}</h3><small>{x.id}</small></div>
              <span className="sr-state">{label(x.state)}</span>
            </header>
            <p>{x.purpose}</p>
            <p className="sr-where"><b>Today:</b> {x.where}</p>
            {x.open
              ? <button className="sr-open" onClick={() => onOpen(x.open as string)}>Open workspace</button>
              : <span className="sr-none">No workspace to open yet</span>}
          </article>
        ))}
      </div>
    </div>
  );
}
