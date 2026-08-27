import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, CheckCircle2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ScanRun = {
  id: string;
  status: string;
  sources_scanned: number;
  candidates_seen: number;
  advisements_created: number;
  started_at: string;
  completed_at: string | null;
  error_summary: string | null;
  evidence: any;
};

type WatchSource = {
  source_key: string;
  system_key: string;
  query_family: string;
  enabled: boolean;
  cadence: string;
  last_scanned_at: string | null;
};

type Finding = {
  provider_key: string | null;
  product_name: string | null;
  model_id: string | null;
  category: string;
  title: string;
  summary: string;
  why_it_matters: string | null;
  recommendation: string | null;
  recommendation_state: string;
  commercial_fit: string | null;
  free_or_included_state: string | null;
  confidence: number | null;
  observed_at: string;
  source_urls: string[];
};

type Advisement = {
  id: string;
  system_key: string;
  title: string;
  why_it_matters: string;
  recommendation: string;
  status: string;
  decision_required: string;
  created_at: string;
};

const fmtDate = (value: string | null) => value ? new Date(value).toLocaleString() : 'Never';

export default function EcosystemIntelligencePanel() {
  const [runs, setRuns] = useState<ScanRun[]>([]);
  const [sources, setSources] = useState<WatchSource[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [advisements, setAdvisements] = useState<Advisement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    if (!supabase) return;
    setBusy(true);
    setError('');
    const [runQ, sourceQ, findingQ, adviceQ] = await Promise.all([
      supabase.from('ecosystem_scan_runs').select('*').order('started_at', { ascending: false }).limit(12),
      supabase.from('ecosystem_watch_sources').select('source_key,system_key,query_family,enabled,cadence,last_scanned_at').eq('enabled', true).order('system_key').order('source_key'),
      supabase.from('model_intelligence_weekly_digest').select('*').order('observed_at', { ascending: false }).limit(100),
      supabase.from('ecosystem_advisements').select('id,system_key,title,why_it_matters,recommendation,status,decision_required,created_at').order('created_at', { ascending: false }).limit(50)
    ]);
    const firstError = runQ.error || sourceQ.error || findingQ.error || adviceQ.error;
    if (firstError) setError(firstError.message);
    setRuns((runQ.data || []) as ScanRun[]);
    setSources((sourceQ.data || []) as WatchSource[]);
    setFindings((findingQ.data || []) as Finding[]);
    setAdvisements((adviceQ.data || []) as Advisement[]);
    setBusy(false);
  }

  async function runNow() {
    if (!supabase) return;
    setBusy(true);
    setError('');
    setNotice('');
    const { data, error: invokeError } = await supabase.functions.invoke('ecosystem-watch', {
      body: { trigger: 'ceo_manual_enterprise_scan' }
    });
    if (invokeError || !data?.ok) setError(invokeError?.message || data?.error || 'Ecosystem scan failed.');
    else setNotice('Enterprise Ecosystem v3 scan completed or entered governed review. Findings remain candidates until evaluated.');
    await load();
  }

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => {
    const systems = new Set(sources.map(source => source.system_key));
    const latest = runs[0];
    return {
      systems: systems.size,
      sources: sources.length,
      findings: findings.length,
      pending: advisements.filter(item => item.status === 'PENDING_REVIEW').length,
      latest
    };
  }, [sources, runs, findings, advisements]);

  return <div className="thelma-ai-console resource-intelligence">
    <section className="thelma-ai-head">
      <div>
        <span className="eyebrow">ECOSYSTEM SCOUT v3 · ENTERPRISE INTELLIGENCE</span>
        <h3>Models, tools, APIs, pricing, licensing and system updates</h3>
        <p>Every registered system is reviewed on the Monday/Thursday cycle. New discoveries are evidence-backed candidates, not automatic production changes.</p>
      </div>
      <button onClick={runNow} disabled={busy}><RefreshCw />{busy ? 'Scanning…' : 'Run enterprise scan'}</button>
    </section>

    {error && <div className="thelma-ai-error"><AlertTriangle />{error}</div>}
    {notice && <div className="land-notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

    <div className="thelma-ai-stats">
      <article><BrainCircuit /><span>Systems covered</span><strong>{summary.systems}</strong></article>
      <article><Search /><span>Active watch sources</span><strong>{summary.sources}</strong></article>
      <article><CheckCircle2 /><span>Recent research findings</span><strong>{summary.findings}</strong></article>
      <article><ShieldCheck /><span>Pending evaluations</span><strong>{summary.pending}</strong></article>
    </div>

    <section className="panel">
      <div className="panel-title"><div><span className="eyebrow">LATEST ENTERPRISE SCAN</span><h3>Execution evidence</h3></div><BrainCircuit /></div>
      {summary.latest ? <div className="command-list">
        <div className="command-row">
          <div><b>{summary.latest.status}</b><small>Started {fmtDate(summary.latest.started_at)} · completed {fmtDate(summary.latest.completed_at)}</small></div>
          <span>{summary.latest.sources_scanned} sources</span>
          <strong>{summary.latest.candidates_seen} candidates</strong>
          <small>{summary.latest.advisements_created} advisements{summary.latest.error_summary ? ` · ${summary.latest.error_summary}` : ''}</small>
        </div>
      </div> : <div className="thelma-clear"><Search /><b>No certified scan run stored yet.</b><p>The Monday/Thursday scheduler or a manual CEO scan will populate this evidence.</p></div>}
    </section>

    <section className="panel">
      <div className="panel-title"><div><span className="eyebrow">MONDAY + THURSDAY MODEL / TOOL REVIEW</span><h3>What changed and why it matters</h3></div><Search /></div>
      {findings.length ? <div className="command-list">{findings.map((item, index) => <div className="command-row" key={`${item.observed_at}-${item.title}-${index}`}>
        <div><b>{item.title}</b><small>{item.provider_key || 'ecosystem'} · {item.category} · {item.model_id || item.product_name || 'general'} · confidence {item.confidence ?? '—'}</small><p>{item.why_it_matters || item.summary}</p></div>
        <span>{item.free_or_included_state || 'UNKNOWN'}</span>
        <strong>{item.recommendation_state}</strong>
        <small>{item.commercial_fit || 'UNKNOWN'} · {new Date(item.observed_at).toLocaleDateString()}</small>
      </div>)}</div> : <div className="thelma-clear"><Search /><b>No current research findings stored.</b><p>Research findings will appear after a successful official-source review.</p></div>}
    </section>

    <section className="panel">
      <div className="panel-title"><div><span className="eyebrow">SYSTEM COVERAGE</span><h3>Enterprise watch map</h3></div><ShieldCheck /></div>
      <div className="command-list">{sources.map(source => <div className="command-row" key={source.source_key}>
        <div><b>{source.query_family}</b><small>{source.system_key} · {source.source_key}</small></div>
        <span>{source.cadence}</span>
        <strong>{source.enabled ? 'ACTIVE' : 'OFF'}</strong>
        <small>Last scan {fmtDate(source.last_scanned_at)}</small>
      </div>)}</div>
    </section>
  </div>;
}
