import{FormEvent,useEffect,useMemo,useState}from'react';
import{Activity,AlertTriangle,Boxes,CheckCircle2,Clock3,Database,GitBranch,Layers3,Play,RefreshCw,RotateCcw,ShieldCheck,Workflow,XCircle}from'lucide-react';
import{supabase}from'../lib/supabase';
import{useIdentity}from'../auth/IdentityContext';

type Connector={connector_key:string;display_name:string;category:string;connection_state:string;transport:string;capabilities:string[];credential_mode:string;last_health_at:string|null};
type Flow={workflow_key:string;display_name:string;owning_system:string;trigger_type:string;execution_mode:string;risk_level:string;max_retries:number;enabled:boolean;steps:string[]};
type Job={id:string;module_key:string;workflow_key:string;target_connector:string|null;risk_level:string;authorization_state:string;execution_state:string;retry_count:number;max_retries:number;created_at:string;last_error?:string|null;next_attempt_at?:string|null};
type Binding={module_key:string;adapter_key:string;binding_state:string;read_authority:boolean;write_authority:boolean};
type DeadLetter={id:string;job_id:string;reason:string;remediation_state:string;created_at:string;resolved_at:string|null};

const moduleNames=['Dashboard','AI Mastery','Agent Hub','Leads Pipeline','Content Engine','Social Media','Trends','Communications','CRM','Products','Finance','System Audit','Certificates','Settings','Team Overview','Video Storyboard','Social Analytics','Lead Scoring Rules','API Integration','Revenue Report','Agent Logs','Media Library','Multi-Account Posting','Trend Signal Alerts','Help Center'];
const tabs=['Fabric Overview','Connectors','Workflows','Job Queue','Module Bindings','Dead Letters','Usage','Policy & Audit'];

export default function IntegrationFabricWorkspace(){
 const identity=useIdentity();
 const[connectors,setConnectors]=useState<Connector[]>([]),[flows,setFlows]=useState<Flow[]>([]),[jobs,setJobs]=useState<Job[]>([]),[bindings,setBindings]=useState<Binding[]>([]),[deadLetters,setDeadLetters]=useState<DeadLetter[]>([]);
 const[active,setActive]=useState('Fabric Overview'),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[acting,setActing]=useState('');
 const[form,setForm]=useState({workflow:'system-health-pulse',module:'Dashboard',connector:'supabase',risk:'low'});

 async function load(){
  if(identity.isBuilder||!supabase)return;
  setBusy(true);
  const[c,w,j,b,d]=await Promise.all([
   supabase.from('ec_connectors').select('*').order('display_name'),
   supabase.from('ec_workflows').select('*').eq('enabled',true).order('display_name'),
   supabase.from('ec_integration_jobs').select('id,module_key,workflow_key,target_connector,risk_level,authorization_state,execution_state,retry_count,max_retries,created_at,last_error,next_attempt_at').order('created_at',{ascending:false}).limit(50),
   supabase.from('ec_module_bindings').select('*').order('module_key'),
   supabase.from('ec_dead_letters').select('id,job_id,reason,remediation_state,created_at,resolved_at').order('created_at',{ascending:false}).limit(30)
  ]);
  if(c.data)setConnectors(c.data);if(w.data)setFlows(w.data);if(j.data)setJobs(j.data);if(b.data)setBindings(b.data);if(d.data)setDeadLetters(d.data);
  setNotice(c.error?.message||w.error?.message||j.error?.message||b.error?.message||d.error?.message||'');setBusy(false);
 }
 useEffect(()=>{load();if(identity.isBuilder||!supabase)return;const client=supabase;const channel=client.channel('ec-fabric-live')
  .on('postgres_changes',{event:'*',schema:'public',table:'ec_integration_jobs'},load)
  .on('postgres_changes',{event:'*',schema:'public',table:'ec_dead_letters'},load)
  .on('postgres_changes',{event:'*',schema:'public',table:'ec_connectors'},load).subscribe();return()=>{client.removeChannel(channel)}},[identity.isBuilder]);

 async function queue(e:FormEvent){
  e.preventDefault();if(!supabase||!identity.user)return;
  setBusy(true);setNotice('');
  const{error}=await supabase.from('ec_integration_jobs').insert({organization_id:identity.organizationId,idempotency_key:`ui-${crypto.randomUUID()}`,module_key:form.module,workflow_key:form.workflow,target_connector:form.connector||null,requested_by:identity.user.id,risk_level:form.risk,authorization_state:'ASK',execution_state:'queued'});
  setBusy(false);if(error)setNotice(error.message);else{setNotice('Job created. Authorize it below to place it on the durable queue.');setActive('Job Queue');await load()}
 }
 async function mutate(job:Job,action:'authorize'|'reject'|'cancel'|'retry'){
  if(!supabase||identity.isBuilder)return;setActing(job.id+action);setNotice('');let values:Record<string,unknown>={};
  if(action==='authorize')values={authorization_state:'AUTHORIZED'};
  if(action==='reject')values={authorization_state:'REJECTED',execution_state:'cancelled'};
  if(action==='cancel')values={execution_state:'cancelled'};
  if(action==='retry')values={execution_state:'queued',retry_count:0,authorization_state:'ASK',last_error:null,next_attempt_at:null};
  const{error}=await supabase.from('ec_integration_jobs').update(values).eq('id',job.id);
  setActing('');if(error)setNotice(error.message);else{setNotice(action==='authorize'?'Authorized. The durable queue trigger will dispatch it automatically.':action==='retry'?'Reset to ASK. Review and authorize it again.':`${action[0].toUpperCase()+action.slice(1)} completed.`);await load()}
 }
 async function resolveDeadLetter(item:DeadLetter){if(!supabase)return;setActing(item.id+'resolve');const{error}=await supabase.from('ec_dead_letters').update({remediation_state:'resolved',resolved_at:new Date().toISOString()}).eq('id',item.id);setActing('');if(error)setNotice(error.message);else await load()}

 const counts=useMemo(()=>({active:connectors.filter(x=>x.connection_state==='active').length,queued:jobs.filter(x=>x.execution_state==='queued').length,running:jobs.filter(x=>['claimed','running','retry_wait'].includes(x.execution_state)).length,failed:jobs.filter(x=>x.execution_state==='dead_letter').length,completed:jobs.filter(x=>x.execution_state==='completed').length}),[connectors,jobs]);
 const panel=(title:string,children:React.ReactNode)=><section className="panel"><div className="panel-title"><div><span className="eyebrow">LIVE PRODUCTION CONTROL</span><h3>{title}</h3></div><ShieldCheck/></div>{children}</section>;
 const jobRows=<>{jobs.map(j=><article className="fabric-job" key={j.id}><Clock3/><div><b>{j.workflow_key}</b><small>{j.module_key} → {j.target_connector||'internal'} · retry {j.retry_count}/{j.max_retries}{j.last_error?` · ${j.last_error}`:''}</small></div><span>{j.authorization_state}</span><strong>{j.execution_state}</strong><div className="fabric-job-actions">{j.execution_state==='queued'&&j.authorization_state==='ASK'&&<><button disabled={acting!==''} onClick={()=>mutate(j,'authorize')}>Authorize</button><button disabled={acting!==''} onClick={()=>mutate(j,'reject')}>Reject</button></>}{j.execution_state==='queued'&&j.authorization_state==='AUTHORIZED'&&<button disabled={acting!==''} onClick={()=>mutate(j,'cancel')}>Cancel</button>}{j.execution_state==='dead_letter'&&<button disabled={acting!==''} onClick={()=>mutate(j,'retry')}><RotateCcw/> Reset & retry</button>}{['claimed','running','retry_wait'].includes(j.execution_state)&&<button disabled={acting!==''} onClick={()=>mutate(j,'cancel')}>Cancel</button>}</div></article>)}</>;

 return <div className="fabric"><div className="briefing fabric-hero"><div><span className="eyebrow">SYS-FABRIC-001 · OWNED AIR-GAP ORCHESTRATION</span><h2>EC Integration Fabric</h2><p>Create, authorize, execute, retry, cancel and inspect governed work without n8n.</p></div><button onClick={load}><RefreshCw/>{busy?'Syncing':'Refresh fabric'}</button></div>
 <div className="land-tabs">{tabs.map(t=><button className={active===t?'active':''} onClick={()=>setActive(t)} key={t}><Workflow/>{t}</button>)}</div>
 <div className="metrics"><article className="metric green"><span>Active connectors</span><strong>{counts.active}/{connectors.length}</strong><small>Live registry</small></article><article className="metric cyan"><span>Running</span><strong>{counts.running}</strong><small>Claimed / executing / retrying</small></article><article className="metric purple"><span>Completed</span><strong>{counts.completed}</strong><small>Audited jobs</small></article><article className="metric amber"><span>Needs action</span><strong>{counts.queued+counts.failed}</strong><small>Queued + dead letter</small></article></div>

 {active==='Fabric Overview'&&<div className="fabric-grid">{panel('Queue work',<><form className="fabric-form" onSubmit={queue}><label>Workflow<select value={form.workflow} onChange={e=>setForm({...form,workflow:e.target.value})}>{flows.map(x=><option value={x.workflow_key} key={x.workflow_key}>{x.display_name}</option>)}</select></label><label>Module<select value={form.module} onChange={e=>setForm({...form,module:e.target.value})}>{moduleNames.map(x=><option key={x}>{x}</option>)}</select></label><label>Connector<select value={form.connector} onChange={e=>setForm({...form,connector:e.target.value})}>{connectors.map(x=><option value={x.connector_key} key={x.connector_key}>{x.display_name}</option>)}</select></label><label>Risk<select value={form.risk} onChange={e=>setForm({...form,risk:e.target.value})}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><button disabled={busy}><Play/>Create governed job</button></form><p className="muted">New jobs start at ASK. Authorizing a queued job automatically pushes it into the correct PGMQ queue.</p></>)}{panel('Current work',jobRows)}</div>}
 {active==='Connectors'&&panel('Connector health',<>{connectors.map(c=><article className="connector" key={c.connector_key}><span className={`connector-dot ${c.connection_state}`}/><div><b>{c.display_name}</b><small>{c.category} · {c.transport} · {c.capabilities.join(', ')}</small></div><strong>{c.connection_state}</strong><em>{c.credential_mode.replaceAll('_',' ')}</em></article>)}</>)}
 {active==='Workflows'&&panel('Owned workflow catalog',<>{flows.map(f=><article className="flow" key={f.workflow_key}><Layers3/><div><b>{f.display_name}</b><small>{f.owning_system} · {f.trigger_type}</small><em>{f.steps.join(' → ')}</em></div><span>{f.execution_mode.replace('_',' ')}</span><strong>{f.risk_level}</strong></article>)}</>)}
 {active==='Job Queue'&&panel('Authorization & execution queue',jobRows)}
 {active==='Module Bindings'&&panel('Module bindings',<>{bindings.map(b=><article className="flow" key={b.module_key}><GitBranch/><div><b>{b.module_key}</b><small>{b.adapter_key}</small><em>read {b.read_authority?'allowed':'blocked'} · write {b.write_authority?'allowed':'blocked'}</em></div><span>{b.binding_state}</span><strong>{b.write_authority?'WRITE':'READ'}</strong></article>)}</>)}
 {active==='Dead Letters'&&panel('Dead-letter recovery',<>{deadLetters.length?deadLetters.map(d=><article className="fabric-job" key={d.id}><AlertTriangle/><div><b>{d.reason}</b><small>Job {d.job_id} · {new Date(d.created_at).toLocaleString()}</small></div><span>{d.remediation_state}</span><strong>{d.resolved_at?'resolved':'open'}</strong><div className="fabric-job-actions">{d.remediation_state!=='resolved'&&<button disabled={acting!==''} onClick={()=>resolveDeadLetter(d)}><CheckCircle2/> Resolve incident</button>}</div></article>):<div className="thelma-clear"><CheckCircle2/><b>No open dead letters</b><p>The failure queue is clear.</p></div>}</>)}
 {active==='Usage'&&panel('Runtime usage',<div className="fabric-controls"><article><Activity/><b>{jobs.length} recent jobs</b><p>{counts.completed} completed, {counts.running} executing, {counts.failed} failed.</p></article><article><Clock3/><b>Durable consumers</b><p>Orchestration, Vision, Agents, Connectors, QC and Monitoring are scheduled in Supabase.</p></article></div>)}
 {active==='Policy & Audit'&&panel('Policy & audit controls',<div className="fabric-controls"><article><ShieldCheck/><b>ASK → AUTHORIZE</b><p>No queued production job runs until it is explicitly authorized.</p></article><article><RotateCcw/><b>Human recovery</b><p>Dead-letter jobs can be reset to ASK, re-reviewed and authorized again.</p></article><article><XCircle/><b>Kill switch</b><p>Queued, claimed, running and retry-wait jobs can be cancelled from this screen.</p></article><article><Boxes/><b>Credential isolation</b><p>Provider secrets remain outside public tables and source code.</p></article></div>)}
 {notice&&<div className="land-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}</div>;
}
