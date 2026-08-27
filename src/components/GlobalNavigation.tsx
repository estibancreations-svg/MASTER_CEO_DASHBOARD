import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, Bot, ChevronDown, Gauge, Grid3X3, Home, Landmark, Megaphone, PanelTop, Play, Search, Workflow, X } from 'lucide-react';
import ThelmaAIConsole from './ThelmaAIConsole';
import ResourceIntelligencePanel from './ResourceIntelligencePanel';
import EcosystemIntelligencePanel from './EcosystemIntelligencePanel';
import { useIdentity } from '../auth/IdentityContext';
import { supabase } from '../lib/supabase';

type SystemState = 'OPERATIONAL' | 'PARTIAL' | 'BLOCKED' | 'SPECIFICATION_ONLY' | 'RECOVERY_REQUIRED' | 'NOT_IMPLEMENTED';
type SystemLink = { key: string; systemKey: string; name: string; description: string; path?: string; icon: any; tag: string; state: SystemState };

const systems: SystemLink[] = [
  { key: 'dashboard', systemKey: 'SYS-DASH-001', name: 'Master Dashboard', description: 'Enterprise operating overview, navigation and system launcher.', path: '/dashboard', icon: Home, tag: 'OPERATIONS', state: 'PARTIAL' },
  { key: 'ceo', systemKey: 'SYS-CEO-001', name: 'CEO Command Center', description: 'Executive governance, decisions, risk, finance and strategic intelligence.', path: '/c-suite/executive-overview', icon: Gauge, tag: 'EXECUTIVE', state: 'PARTIAL' },
  { key: 'thelma', systemKey: 'SYS-THELMA-001', name: 'THELMA', description: 'Governed operating intelligence, agents, repairs, resources and White Blood Cells.', path: '/systems/thelma', icon: Bot, tag: 'INTELLIGENCE', state: 'PARTIAL' },
  { key: 'integration-fabric', systemKey: 'SYS-FABRIC-001', name: 'EC Integration Fabric', description: 'Authorize, route, retry and audit deterministic production jobs.', path: '/systems/integration-fabric', icon: Workflow, tag: 'INFRASTRUCTURE', state: 'PARTIAL' },
  { key: 'visionweaver', systemKey: 'SYS-VISION-001', name: 'VisionWeaver', description: 'Creative production for images, video, audio, books and movies.', path: '/systems/visionweaver', icon: Play, tag: 'CREATE', state: 'PARTIAL' },
  { key: 'landweaver', systemKey: 'SYS-LAND-001', name: 'LandWeaver', description: 'GIS/property research, scoring and opportunity management.', path: '/systems/landweaver', icon: Landmark, tag: 'PROPERTY', state: 'PARTIAL' },
  { key: 'grantos', systemKey: 'SYS-GRANT-001', name: 'GrantOS', description: 'Funding discovery, evidence, drafting, submission and compliance.', path: '/systems/grantos', icon: PanelTop, tag: 'FUNDING', state: 'PARTIAL' },
  { key: 'cmgio-map', systemKey: 'SYS-CMGIO-001', name: 'CMGIO', description: 'Marketing and growth intelligence, campaigns, signals and optimization.', path: '/systems/cmgio-map', icon: Megaphone, tag: 'GROWTH', state: 'PARTIAL' },
  { key: 'ads', systemKey: 'SYS-ADS-001', name: 'Master Advertising Platform', description: 'Advertising strategy, creative, testing, spend and campaign execution.', icon: Megaphone, tag: 'ADVERTISING', state: 'RECOVERY_REQUIRED' },
  { key: 'agencyflow', systemKey: 'SYS-AGENCYFLOW-001', name: 'AgencyFlow', description: 'Agency operations, CRM, clients, communications, socials and workflow.', icon: PanelTop, tag: 'AGENCY', state: 'RECOVERY_REQUIRED' },
  { key: 'climate', systemKey: 'SYS-CLIMATE-001', name: 'ClimateTrack Pro', description: 'Climate, sustainability, environmental intelligence and reporting.', icon: PanelTop, tag: 'CLIMATE', state: 'RECOVERY_REQUIRED' },
  { key: 'publishing', systemKey: 'SYS-PUBLISH-001', name: 'Publishing & Media Studio', description: 'Books, EPUB/PDF, audiobook, media packaging and distribution control.', icon: PanelTop, tag: 'PUBLISH', state: 'SPECIFICATION_ONLY' },
  { key: 'iam', systemKey: 'SYS-IAM-001', name: 'IAM / Self-Help', description: 'Identity self-service, access, connection health and governed recovery.', icon: PanelTop, tag: 'IDENTITY', state: 'NOT_IMPLEMENTED' },
  { key: 'telecom', systemKey: 'SYS-TELECOM-001', name: 'Telecommunications', description: 'Voice, SIP, SMS, routing, transcription and communications operations.', icon: PanelTop, tag: 'COMMS', state: 'NOT_IMPLEMENTED' },
  { key: 'assessment', systemKey: 'SYS-ASSESS-001', name: 'Assessment Suite', description: 'Assessments, scoring, longitudinal intelligence and capability mapping.', icon: PanelTop, tag: 'ASSESS', state: 'NOT_IMPLEMENTED' },
  { key: 'training', systemKey: 'SYS-TRAINING-001', name: 'AI Mastery / Training', description: 'Curriculum, tutoring, exercises, mastery evidence and certificates.', icon: PanelTop, tag: 'TRAINING', state: 'PARTIAL' },
  { key: 'qc', systemKey: 'SYS-QC-001', name: 'Quality Control Agency', description: 'Independent verification, regression, release evidence and system certification.', icon: PanelTop, tag: 'QUALITY', state: 'PARTIAL' }
];

function currentSystemKey(path: string) {
  const item = systems.find(system => system.path && path.startsWith(system.path));
  return item?.systemKey || 'SYS-CEO-001';
}

function currentLocation(path: string) {
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return { title: 'Master Dashboard', systemHome: '/dashboard' };
  if (path.startsWith('/c-suite')) return { title: 'C-Suite Command', systemHome: '/c-suite/executive-overview' };
  const item = systems.find(system => system.path && path.startsWith(system.path));
  if (item?.path) return { title: item.name, systemHome: item.path };
  return { title: 'Estiban Creations', systemHome: '/dashboard' };
}

export default function GlobalNavigation({ children }: PropsWithChildren) {
  const identity = useIdentity();
  const [path, setPath] = useState(() => window.location.pathname);
  const [open, setOpen] = useState(false);
  const [thelmaOpen, setThelmaOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [ecosystemOpen, setEcosystemOpen] = useState(false);
  const [resourceLabel, setResourceLabel] = useState('Resources');

  useEffect(() => {
    const notify = () => setPath(window.location.pathname);
    const originalPush = window.history.pushState.bind(window.history);
    const originalReplace = window.history.replaceState.bind(window.history);
    window.history.pushState = ((...args: Parameters<History['pushState']>) => {
      originalPush(...args);
      window.dispatchEvent(new Event('ec-locationchange'));
    }) as History['pushState'];
    window.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      originalReplace(...args);
      window.dispatchEvent(new Event('ec-locationchange'));
    }) as History['replaceState'];
    window.addEventListener('popstate', notify);
    window.addEventListener('ec-locationchange', notify);
    return () => {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
      window.removeEventListener('popstate', notify);
      window.removeEventListener('ec-locationchange', notify);
    };
  }, []);

  useEffect(() => {
    if (identity.isBuilder || !identity.user || !supabase) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke('resource-intelligence', {
        body: { action: 'startup', trigger: 'app_startup' }
      });
      if (cancelled) return;
      if (error || !data?.ok) {
        setResourceLabel('Resources !');
        return;
      }
      const packet = data?.reports?.[0];
      const runway = packet?.accounts?.find((account: any) => account.provider_key === 'runway');
      if (runway?.current_quantity != null) setResourceLabel(`Runway ${Number(runway.current_quantity).toLocaleString()} cr`);
      else setResourceLabel(data?.sync?.[0]?.status === 'SUCCEEDED' ? 'Resources synced' : 'Resources');
    })();
    return () => { cancelled = true; };
  }, [identity.isBuilder, identity.user?.id]);

  const location = useMemo(() => currentLocation(path), [path]);
  const go = (next: string) => {
    setOpen(false);
    if (window.location.pathname === next) {
      window.location.assign(next);
      return;
    }
    window.location.assign(next);
  };

  return <div className="ec-product-frame">
    <header className="ec-global-nav">
      <button className="ec-back" onClick={() => window.history.length > 1 ? window.history.back() : go('/dashboard')} aria-label="Go back"><ArrowLeft /></button>
      <button className="ec-logo" onClick={() => go('/dashboard')} aria-label="Master Dashboard"><span>EC</span></button>
      <div className="ec-location"><small>ESTIBAN CREATIONS</small><b>{location.title}</b></div>
      <nav className="ec-global-actions">
        <button onClick={() => go('/dashboard')} className={path.startsWith('/dashboard') ? 'active' : ''}><Home /><span>Main Dashboard</span></button>
        {!path.startsWith('/dashboard') && <button onClick={() => go(location.systemHome)}><PanelTop /><span>System Home</span></button>}
        <button onClick={() => go('/c-suite/executive-overview')} className={path.startsWith('/c-suite') ? 'active' : ''}><Gauge /><span>C-Suite</span></button>
        <button className={resourceOpen ? 'active' : ''} onClick={() => setResourceOpen(true)}><Activity /><span>{resourceLabel}</span></button>
        <button className={ecosystemOpen ? 'active' : ''} onClick={() => setEcosystemOpen(true)}><Search /><span>Ecosystem</span></button>
        <button className={thelmaOpen ? 'active' : ''} onClick={() => setThelmaOpen(true)}><Bot /><span>Ask THELMA</span></button>
        <button className={open ? 'active' : ''} onClick={() => setOpen(!open)}><Grid3X3 /><span>All Systems</span><ChevronDown /></button>
      </nav>
    </header>

    {open && <div className="ec-system-overlay" onClick={() => setOpen(false)}>
      <section className="ec-system-switcher" onClick={event => event.stopPropagation()}>
        <div className="ec-switcher-head">
          <div><small>ENTERPRISE REGISTRY · 17 SYSTEMS</small><h2>Where do you want to work?</h2><p>Executable systems open directly. Rebuilding systems remain visible with their truthful current state.</p></div>
          <button onClick={() => setOpen(false)} aria-label="Close"><X /></button>
        </div>
        <div className="ec-system-grid">
          {systems.map(({ key, name, description, path: target, icon: Icon, tag, state }) => {
            const launchable = Boolean(target);
            return <button key={key} onClick={() => target && go(target)} disabled={!launchable} className={target && path.startsWith(target) ? 'current' : ''} aria-disabled={!launchable}>
              <span className="ec-system-icon"><Icon /></span>
              <span className="ec-system-copy"><small>{tag} · {state}</small><b>{name}</b><em>{description}</em></span>
              <span className="ec-open-label">{launchable ? 'Open' : state}</span>
            </button>;
          })}
        </div>
        <div className="ec-switcher-foot">
          <button onClick={() => go('/dashboard')}><Home />Master Dashboard</button>
          <button onClick={() => go('/c-suite/executive-overview')}><Gauge />C-Suite Command</button>
        </div>
      </section>
    </div>}

    {resourceOpen && <div className="ec-thelma-overlay" onClick={() => setResourceOpen(false)}>
      <section className="ec-thelma-dock ec-resource-dock" onClick={event => event.stopPropagation()}>
        <button className="ec-thelma-close" onClick={() => setResourceOpen(false)} aria-label="Close Resource Intelligence"><X /></button>
        <ResourceIntelligencePanel />
      </section>
    </div>}

    {ecosystemOpen && <div className="ec-thelma-overlay" onClick={() => setEcosystemOpen(false)}>
      <section className="ec-thelma-dock ec-resource-dock" onClick={event => event.stopPropagation()}>
        <button className="ec-thelma-close" onClick={() => setEcosystemOpen(false)} aria-label="Close Ecosystem Intelligence"><X /></button>
        <EcosystemIntelligencePanel />
      </section>
    </div>}

    {thelmaOpen && <div className="ec-thelma-overlay" onClick={() => setThelmaOpen(false)}>
      <section className="ec-thelma-dock" onClick={event => event.stopPropagation()}>
        <button className="ec-thelma-close" onClick={() => setThelmaOpen(false)} aria-label="Close THELMA"><X /></button>
        <ThelmaAIConsole contextSystemKey={currentSystemKey(path)} />
      </section>
    </div>}

    <div className="ec-product-body">{children}</div>
  </div>;
}
