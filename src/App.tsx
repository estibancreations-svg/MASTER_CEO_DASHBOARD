import { useEffect, useState } from 'react';
import { Activity, Bell, Bot, Building2, ChevronRight, CircleDollarSign, ClipboardCheck, Clock3, FileClock, Gauge, Landmark, LayoutDashboard, Megaphone, Menu, Network, Search, Settings, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { useCommandData } from './hooks/useCommandData';
import LandWeaverWorkspace from './components/LandWeaverWorkspace';
import VisionWeaverWorkspace from './components/VisionWeaverWorkspace';
import GrantOSWorkspace from './components/GrantOSWorkspace';
import ThelmaWorkspace from './components/ThelmaWorkspace';
import CmgioWorkspace from './components/CmgioWorkspace';
import IntegrationFabricWorkspace from './components/IntegrationFabricWorkspace';
import MasterDashboard from './components/MasterDashboard';
import { parseDashboardRoute, routeForModule, routeForSuitePage, routeForSystem } from './routing';

const sections = [
  ['Executive Overview', LayoutDashboard], ['Decisions & Approvals', ClipboardCheck], ['Communications', Bell],
  ['People & Leadership', Users], ['System Portfolio', Network], ['Projects & Initiatives', Building2],
  ['Financial Command', CircleDollarSign], ['Growth & Marketing', Megaphone], ['Property Intelligence', Landmark],
  ['Grants & Funding', Sparkles], ['Operations', Gauge], ['Intelligence & Research', Bot],
  ['Risk, Security & Compliance', ShieldCheck], ['Quality Control', ClipboardCheck], ['Resource & Usage', Activity],
  ['Audit & History', FileClock], ['Settings & Governance', Settings]
] as const;

const decisions = [
  {title:'VisionWeaver staging promotion', owner:'Technology', due:'Today', level:'High'},
  {title:'LandWeaver provider shortlist', owner:'Property Intelligence', due:'Tomorrow', level:'Medium'},
  {title:'GrantOS submission authority', owner:'Funding Office', due:'Aug 14', level:'High'}
];

type PageModel = {question:string; metrics:[string,string,string][]; queue:[string,string,string][]; controls:string[]};
const pages: Record<string,PageModel> = {
  'Decisions & Approvals':{question:'What requires executive authorization now?',metrics:[['Open decisions','03','2 due today'],['Approved this week','12','100% audited'],['At risk','01','Escalated'],['Avg. response','4.2h','Within target']],queue:[['VisionWeaver staging promotion','Technology','High'],['LandWeaver provider shortlist','Property Intelligence','Medium'],['GrantOS submission authority','Funding Office','High']],controls:['Approve','Return for evidence','Delegate','Escalate']},
  'Communications':{question:'Which messages require executive awareness or response?',metrics:[['Unread priority','07','3 executive'],['Awaiting reply','04','Oldest 18h'],['Briefings','06','Today'],['Channels healthy','09/09','Available']],queue:[['Board briefing packet','Executive Office','Ready'],['THELMA operations digest','Operations','New'],['Security exception notice','Security','Urgent']],controls:['Open briefing','Assign response','Archive','Escalate']},
  'People & Leadership':{question:'Do leaders and teams have the capacity and clarity to execute?',metrics:[['Leadership seats','08','6 active'],['Capacity','74%','Balanced'],['Assignments','16','3 blocked'],['Experience pulse','82%','+5%']],queue:[['Technology lead capacity review','People Operations','Review'],['CMGIO launch staffing','Growth','Pending'],['Agent authority renewal','Governance','Due']],controls:['Request briefing','Adjust authority','Review workload','Open roster']},
  'System Portfolio':{question:'Which systems are operational, blocked, degraded, or under construction?',metrics:[['Registered','17','4 reporting'],['Healthy','03','No incidents'],['In build','08','On roadmap'],['Blocked','02','Needs decision']],queue:[['VisionWeaver','Staging preparation','72%'],['CEO Dashboard','MVP active','65%'],['LandWeaver','Specification ready','35%'],['GrantOS','Reconciliation','44%']],controls:['Open system','Request health check','View dependencies','Open incidents']},
  'Projects & Initiatives':{question:'Are strategic initiatives on plan?',metrics:[['Active','11','8 on plan'],['Milestones','06','This week'],['Blocked','02','Owner assigned'],['Budget health','91%','Within plan']],queue:[['CEO Dashboard MVP','Technology','On plan'],['VisionWeaver staging','Technology','At risk'],['LandWeaver implementation','Property','Queued']],controls:['Inspect','Reprioritize','Request briefing','View roadmap']},
  'Financial Command':{question:'What is the enterprise financial position and where are exceptions?',metrics:[['Tracked budget','$84.2K','Current cycle'],['Committed','$41.8K','49.6%'],['Variance','-3.2%','Favorable'],['Runway','9.4 mo','Stable']],queue:[['AI services forecast','Technology','$4,230'],['Marketing allocation','Growth','$8,500'],['Vendor renewal review','Operations','$2,180']],controls:['Drill to source','Request forecast','Flag variance','Export briefing']},
  'Growth & Marketing':{question:'What is driving or suppressing growth?',metrics:[['Campaigns','08','5 optimized'],['Qualified leads','184','+12%'],['Conversion','6.8%','+0.9%'],['Portfolio ROI','3.4x','Healthy']],queue:[['Pinterest product campaign','CMGIO','Scale'],['Property lead nurture','MAP','Optimize'],['GrantOS authority campaign','CMGIO','Review']],controls:['Review recommendation','Approve campaign','Pause','Request optimization']},
  'Property Intelligence':{question:'Which property opportunities or risks merit executive attention?',metrics:[['Opportunities','184','14 new'],['Due diligence','09','2 urgent'],['Pipeline value','$2.8M','Modeled'],['Material risks','04','Human review']],queue:[['Plant City parcel','LandWeaver','Score 92'],['Pasco County acreage','LandWeaver','Hazard review'],['Polk County assemblage','LandWeaver','Financial review']],controls:['Open LandWeaver','Request diligence','Hold','Approve review']},
  'Grants & Funding':{question:'Which opportunities, deadlines, awards, or compliance issues matter now?',metrics:[['Pipeline','$4.2M','23 opportunities'],['Due in 30 days','06','2 critical'],['Active awards','$1.1M','Compliant'],['RFIs','02','Response due']],queue:[['Community facilities grant','GrantOS','Due Aug 18'],['Creative workforce RFP','GrantOS','Drafting'],['Climate resilience award','GrantOS','Eligibility']],controls:['Open GrantOS','Assign section','Request briefing','Escalate deadline']},
  'Operations':{question:'Where is execution blocked or inefficient?',metrics:[['Open work','47','12 priority'],['SLA health','94%','Stable'],['Automations','31/34','3 degraded'],['Bottlenecks','03','Owners assigned']],queue:[['EC Fabric retry queue','THELMA','Degraded'],['Drive intake reconciliation','VisionWeaver','Active'],['Usage reporting rollout','Operations','Queued']],controls:['Open queue','Dispatch THELMA','View automation','Escalate']},
  'Intelligence & Research':{question:'What verified intelligence changes enterprise priorities?',metrics:[['New findings','14','6 high confidence'],['Sources checked','83','Today'],['Conflicts','02','Needs review'],['Briefings','04','Executive']],queue:[['Property market movement','Research','High confidence'],['Funding policy update','GrantOS','Verified'],['AI services cost shift','Technology','Moderate']],controls:['Inspect sources','Request validation','Accept finding','Archive']},
  'Risk, Security & Compliance':{question:'What can materially harm the enterprise?',metrics:[['Open incidents','02','0 critical'],['Security gates','07','3 pending'],['Compliance','91%','Improving'],['Overdue fixes','01','Owner alerted']],queue:[['VisionWeaver API authentication','Security','High'],['OAuth replay validation','Technology','High'],['Provider license inventory','LandWeaver','Medium']],controls:['Acknowledge','Assign remediation','Escalate','Inspect evidence']},
  'Quality Control':{question:'What has failed or not met Architect standards?',metrics:[['Open findings','11','3 blocking'],['Certified releases','02','Current cycle'],['Regression pass','96%','1 failure'],['Quality gain','31%','Above target']],queue:[['CEO Dashboard responsive verification','QC','Active'],['VisionWeaver tenant isolation','Security QC','Blocking'],['LandWeaver provenance display','Product QC','Required']],controls:['Reject promotion','Request remediation','Inspect evidence','Certify']},
  'Resource & Usage':{question:'Are time, compute, credits, vendors, and workloads being used efficiently?',metrics:[['Efficiency','76%','+8%'],['AI spend','$1,284','This cycle'],['Throughput','38/hr','Stable'],['Anomalies','02','Under review']],queue:[['Gemini token forecast','Technology','Watch'],['Image generation workload','Creative','Normal'],['EC Fabric execution spike','Operations','Investigate']],controls:['Request optimization','Adjust capacity','Set threshold','Open forecast']},
  'Audit & History':{question:'What happened, who authorized it, and what evidence supports it?',metrics:[['Events today','184','Immutable'],['Executive actions','07','Attributed'],['Evidence links','100%','Complete'],['Exceptions','00','Clear']],queue:[['PR #6 architecture approved','The Architect','Verified'],['CEO Dashboard implementation started','Codex','Verified'],['Build validation passed','Build system','Verified']],controls:['Inspect event','Export trail','Verify evidence','Filter actor']},
  'Settings & Governance':{question:'What CEO-level preferences and governed configuration are active?',metrics:[['Policies','24','Current'],['Delegations','06','2 expiring'],['Integrations','09','Governed'],['Notifications','14','3 priority']],queue:[['Executive notification matrix','CEO Office','Active'],['THELMA command boundary','Governance','Enforced'],['VisionWeaver read access','Security','Pending']],controls:['Edit preferences','Review delegation','Open policy','Audit change']}
};

function Metric({label,value,detail,tone}:{label:string,value:string,detail:string,tone:'cyan'|'purple'|'green'|'amber'}) {
  return <article className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Workspace({name}:{name:string}){
  const model=pages[name];
  const [notice,setNotice]=useState('');
  const tones=['cyan','green','amber','purple'] as const;
  const act=(label:string)=>setNotice(`${label} is ready. Sign in with the required authority to submit a governed write; this preview will not fail silently.`);
  if(!model) return null;
  return <>{notice&&<div className="data-state loading" role="status"><b>Action acknowledged</b><span>{notice}</span><button type="button" onClick={()=>setNotice('')}>Dismiss</button></div>}<div className="briefing workspace-hero"><div><span className="eyebrow">EXECUTIVE DECISION SURFACE</span><h2>{model.question}</h2><p>Read model refreshed just now · Governed actions are recorded in Audit & History.</p></div><button onClick={()=>act('THELMA briefing request')}>Request THELMA briefing <ChevronRight/></button></div>
  <div className="metrics">{model.metrics.map((m,i)=><Metric key={m[0]} label={m[0]} value={m[1]} detail={m[2]} tone={tones[i]}/>)}</div>
  <div className="workspace-grid"><section className="panel"><div className="panel-title"><div><span className="eyebrow">PRIORITY READ MODEL</span><h3>{name}</h3></div><span className="live"><i/>Current</span></div>{model.queue.map(([title,owner,state])=><div className="work-row" key={title}><div><b>{title}</b><small>{owner}</small></div><span>{state}</span><button type="button" aria-label={`Open ${title}`} onClick={()=>act(`Open ${title}`)}><ChevronRight/></button></div>)}</section><section className="panel"><div className="panel-title"><div><span className="eyebrow">GOVERNED CONTROLS</span><h3>Executive actions</h3></div><ShieldCheck/></div><div className="control-grid">{model.controls.map(x=><button type="button" key={x} onClick={()=>act(x)}>{x}<ChevronRight/></button>)}</div><div className="provenance"><b>Authority boundary</b><p>Actions create an approval request or delegated command. Source-system writes require explicit authority and an audit event.</p></div></section></div></>;
}

export function CSuiteDashboard({initialActive='Executive Overview',onNavigate}:{initialActive?:string;onNavigate?:(page:string)=>void}){
  const [active,setActive]=useState(initialActive);
  useEffect(()=>setActive(initialActive),[initialActive]);
  const selectPage=(page:string)=>{setActive(page);onNavigate?.(page)};
  const [open,setOpen]=useState(false);
  const [notice,setNotice]=useState('');
  const command=useCommandData();
  const act=(label:string)=>setNotice(`${label} is ready. Sign in with the required authority to submit a governed write; this preview will not fail silently.`);
  const portfolio=command.systems.length?command.systems.map(s=>[s.system_name,s.lifecycle_state,`${s.progress_percent}%`]):[['VisionWeaver','Staging preparation','72%'],['CEO Dashboard','Foundation active','18%'],['LandWeaver','Specification ready','35%'],['GrantOS','Reconciliation','44%']];
  return <div className="app-shell">
    <aside className={open?'sidebar open':'sidebar'}>
      <div className="brand"><div className="brand-mark">EC</div><div><b>ESTIBAN</b><span>CEO COMMAND</span></div><button className="close" onClick={()=>setOpen(false)}><X/></button></div>
      <nav>{sections.map(([name,Icon])=><button key={name} className={active===name?'active':''} onClick={()=>{selectPage(name);setOpen(false)}}><Icon/><span>{name}</span></button>)}</nav>
      <div className="system-state"><span className={command.connected&&!command.error?'pulse':'pulse warning'}/><div><b>{command.connected&&!command.error?'Command fabric online':'Demonstration read model'}</b><small>{command.systems.length||4} systems reporting</small></div></div>
    </aside>
    <main>
      <header><button className="menu" onClick={()=>setOpen(true)}><Menu/></button><div><p>CEO COMMAND CENTER</p><h1>{active}</h1></div><label className="search"><Search/><input aria-label="Search enterprise" placeholder="Search systems, decisions, people…"/></label><button className="icon-button" aria-label="Open executive notifications" onClick={()=>setNotice(notice?'':'Three executive notifications are available in Decisions & Approvals.')}><Bell/><i>3</i></button><div className="profile"><span>EA</span><div><b>The Architect</b><small>Executive authority</small></div></div></header>
      <section className="content">{notice&&<div className="data-state loading" role="status"><b>Executive notifications</b><span>{notice}</span><button type="button" onClick={()=>setNotice('')}>Dismiss</button></div>}{active==='Property Intelligence'?<LandWeaverWorkspace/>:active==='Executive Overview'?<>
        <div className="briefing"><div><span className="eyebrow">MONDAY, AUGUST 10 · EXECUTIVE BRIEFING</span><h2>Good morning. Three decisions require your attention.</h2><p>System health is stable. VisionWeaver is closest to staging; CEO Dashboard implementation is now active.</p></div><button onClick={()=>selectPage('Decisions & Approvals')}>Open daily briefing <ChevronRight/></button></div>
        <div className="metrics"><Metric label="Enterprise health" value="88%" detail="+4% from last checkpoint" tone="green"/><Metric label="Decisions waiting" value="03" detail="2 require action today" tone="amber"/><Metric label="Active systems" value="04 / 17" detail="13 in build or recovery" tone="cyan"/><Metric label="Resource efficiency" value="76%" detail="AI usage within guardrails" tone="purple"/></div>
        <div className="grid">
          <section className="panel decisions"><div className="panel-title"><div><span className="eyebrow">ACTION QUEUE</span><h3>Decisions & approvals</h3></div><button onClick={()=>selectPage('Decisions & Approvals')}>View all</button></div>{decisions.map(d=><div className="decision" key={d.title}><span className={`priority ${d.level.toLowerCase()}`}>{d.level}</span><div><b>{d.title}</b><small>{d.owner} · Due {d.due}</small></div><button aria-label={`Review ${d.title}`} onClick={()=>selectPage('Decisions & Approvals')}><ChevronRight/></button></div>)}</section>
          <section className="panel health"><div className="panel-title"><div><span className="eyebrow">{command.loading?'CONNECTING':'LIVE READ MODELS'}</span><h3>System portfolio</h3></div><span className="live"><i/>{command.connected?'Supabase':'Demo'}</span></div>{portfolio.map(([n,s,p])=><div className="health-row" key={n}><div><b>{n}</b><small>{s}</small></div><div className="bar"><i style={{width:p}}/></div><strong>{p}</strong></div>)}</section>
          <section className="panel timeline"><div className="panel-title"><div><span className="eyebrow">GOVERNED ACTIVITY</span><h3>Audit pulse</h3></div><Clock3/></div>{['PR #6 architecture approved','CEO Dashboard build sequence activated','VisionWeaver security gate retained'].map((x,i)=><div className="event" key={x}><i/><div><b>{x}</b><small>{i===0?'Today · Executive authority':'Today · System orchestration'}</small></div></div>)}</section>
        </div></>:<Workspace name={active}/>} 
      </section>
    </main>
  </div>
}

export default function App(){
  const[route,setRoute]=useState(()=>parseDashboardRoute(window.location.pathname));
  useEffect(()=>{
    const handlePopState=()=>setRoute(parseDashboardRoute(window.location.pathname));
    window.addEventListener('popstate',handlePopState);
    return()=>window.removeEventListener('popstate',handlePopState);
  },[]);
  useEffect(()=>{
    const label=route.page||route.surface.replaceAll('-',' ');
    document.title=`${label} · Master CEO Dashboard`;
  },[route]);
  const navigate=(path:string)=>{
    if(window.location.pathname!==path)window.history.pushState({},'',path);
    setRoute(parseDashboardRoute(path));
    window.scrollTo({top:0,behavior:'auto'});
  };
  if(route.surface==='master')return <MasterDashboard
    initialActive={route.page||'Dashboard'}
    onNavigateModule={name=>navigate(routeForModule(name))}
    onOpenSuite={()=>navigate(routeForSuitePage('Executive Overview'))}
    onOpenLandWeaver={()=>navigate(routeForSystem('land'))}
    onOpenVisionWeaver={()=>navigate(routeForSystem('vision'))}
    onOpenGrantOS={()=>navigate(routeForSystem('grant'))}
    onOpenThelma={()=>navigate(routeForSystem('thelma'))}
    onOpenCmgio={()=>navigate(routeForSystem('cmgio'))}
    onOpenFabric={()=>navigate(routeForSystem('fabric'))}
  />;
  if(route.surface==='suite')return <><button className="return-master" onClick={()=>navigate('/dashboard')}><LayoutDashboard/> Master Dashboard</button><CSuiteDashboard initialActive={route.page||'Executive Overview'} onNavigate={page=>navigate(routeForSuitePage(page))}/></>;
  const workspace=route.surface==='land'?<LandWeaverWorkspace/>:route.surface==='vision'?<VisionWeaverWorkspace/>:route.surface==='grant'?<GrantOSWorkspace/>:route.surface==='thelma'?<ThelmaWorkspace/>:route.surface==='cmgio'?<CmgioWorkspace/>:<IntegrationFabricWorkspace/>;
  return <><button className="return-master" onClick={()=>navigate('/dashboard')}><LayoutDashboard/> Master Dashboard</button><div className="app-shell workspace-only"><main><section className="content">{workspace}</section></main></div></>;
}
