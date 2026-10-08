import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, BookOpen, Bot, Boxes, BriefcaseBusiness, Building2, ChevronRight,
  CircleDollarSign, Clapperboard, Database, Film, FolderOpen, Gauge, Globe2, Grid3X3,
  Home, Image as ImageIcon, LayoutDashboard, Library, Map, Menu, MonitorUp, Palette,
  PanelTop, PieChart, Play, Search, Settings, ShieldCheck, Sparkles, Users, Wand2,
  Workflow, X, Zap, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useIdentity } from '../auth/IdentityContext';

type Row = Record<string, any>;
type ViewId = 'V1'|'V2'|'V3';
type PageKey =
  | 'home'|'vision'|'strategy'|'initiatives'|'programs'|'copilot'|'cmi'|'guild'|'teams'|'csuite'
  | 'books'|'avatar'|'worlds'|'designstudio'|'commercial'|'scene'|'post'|'distribution'
  | 'quality'|'finance'|'it'|'resources'|'assets'|'reports'|'settings';

type PageDef = {
  key: PageKey;
  label: string;
  group: 'core'|'create'|'govern';
  icon: any;
  primary: ViewId;
  alt1: string;
  alt2: string;
  alt3: string;
};

const PAGES: PageDef[] = [
  {key:'home',label:'Home',group:'core',icon:Home,primary:'V1',alt1:'Dashboard',alt2:'Studio Overview',alt3:'Project Focus'},
  {key:'vision',label:'Vision Builder',group:'core',icon:Wand2,primary:'V1',alt1:'Creative Command Canvas',alt2:'Blueprint & Dependencies',alt3:'Concept-to-Production Map'},
  {key:'strategy',label:'Strategic Planner',group:'core',icon:Gauge,primary:'V1',alt1:'Strategic Command Center',alt2:'Scenario & Roadmap Studio',alt3:'Goals, Risks & Outcomes'},
  {key:'initiatives',label:'Initiatives',group:'core',icon:Sparkles,primary:'V2',alt1:'Initiative Overview',alt2:'Initiative Pipeline',alt3:'Impact & Dependencies'},
  {key:'programs',label:'Programs & Projects',group:'core',icon:BriefcaseBusiness,primary:'V2',alt1:'Portfolio Command',alt2:'Program & Project Workspace',alt3:'Timeline & Dependencies'},
  {key:'copilot',label:'AI Co-Pilot',group:'core',icon:Bot,primary:'V2',alt1:'AI Command Center',alt2:'Agent Workflow',alt3:'Specialist Marketplace'},
  {key:'cmi',label:'CMI',group:'core',icon:PieChart,primary:'V1',alt1:'Creative & Market Intelligence',alt2:'Signals & Trends',alt3:'Opportunity Intelligence'},
  {key:'guild',label:'Directors Guild',group:'core',icon:Users,primary:'V2',alt1:'Guild Overview',alt2:'Review & Decision Queue',alt3:'Department Workrooms'},
  {key:'teams',label:'Teams',group:'core',icon:Users,primary:'V1',alt1:'Organization Command',alt2:'Authority & Handoff Map',alt3:'Workforce & Agent Capacity'},
  {key:'csuite',label:'C-Suite',group:'core',icon:Building2,primary:'V1',alt1:'Executive Command',alt2:'Authority Matrix',alt3:'Portfolio Oversight'},

  {key:'books',label:'Book Creation',group:'create',icon:BookOpen,primary:'V1',alt1:'Book Command Center',alt2:'Writing Workspace',alt3:'Publishing Pipeline'},
  {key:'avatar',label:'Avatar Engineering',group:'create',icon:Users,primary:'V2',alt1:'Avatar Overview',alt2:'Avatar State Studio',alt3:'360 Engineering'},
  {key:'worlds',label:'Worlds & Locations',group:'create',icon:Globe2,primary:'V2',alt1:'Cinematic Grid',alt2:'Interactive Map',alt3:'World Builder Studio'},
  {key:'designstudio',label:'Design Studio',group:'create',icon:Palette,primary:'V2',alt1:'Create Grid',alt2:'Design Workspace',alt3:'Catalogue Builder'},
  {key:'commercial',label:'Design & Commercial',group:'create',icon:ImageIcon,primary:'V1',alt1:'Campaign Command Grid',alt2:'Interactive Commercial Studio',alt3:'Placement & Performance'},
  {key:'scene',label:'Scene & Production',group:'create',icon:Clapperboard,primary:'V1',alt1:'Director\'s Production Desk',alt2:'Timeline & Continuity',alt3:'Scene Operations'},
  {key:'post',label:'Post Production',group:'create',icon:Film,primary:'V1',alt1:'Edit & Finish Desk',alt2:'Color, Audio & VFX',alt3:'AI Finishing & Delivery'},
  {key:'distribution',label:'Distribution & Growth',group:'create',icon:MonitorUp,primary:'V2',alt1:'Distribution Overview',alt2:'Content Pipeline',alt3:'Analytics & Growth'},

  {key:'quality',label:'Quality & Audit',group:'govern',icon:ShieldCheck,primary:'V1',alt1:'Quality Command Center',alt2:'Evidence & Verification',alt3:'Release Gate & Audit Trail'},
  {key:'finance',label:'Finance & Accounting',group:'govern',icon:CircleDollarSign,primary:'V1',alt1:'Financial Command Center',alt2:'Project Budget & Cost Control',alt3:'Accounting & Revenue Operations'},
  {key:'it',label:'IT & Security',group:'govern',icon:ShieldCheck,primary:'V2',alt1:'IT & Security Command',alt2:'Infrastructure & Connections',alt3:'Security, Reliability & Incidents'},
  {key:'resources',label:'Resources',group:'govern',icon:Boxes,primary:'V2',alt1:'Resource Library',alt2:'Advanced Search & Filter',alt3:'Collections & Collaboration'},
  {key:'assets',label:'Assets & Knowledge',group:'govern',icon:Library,primary:'V2',alt1:'Assets Overview',alt2:'Advanced Search & Filter',alt3:'Collections & Knowledge'},
  {key:'reports',label:'Reports & Insights',group:'govern',icon:Activity,primary:'V2',alt1:'Executive Reporting',alt2:'Interactive Intelligence',alt3:'Insight Explorer'},
  {key:'settings',label:'Settings',group:'govern',icon:Settings,primary:'V2',alt1:'Quick Settings',alt2:'Visual & System Control',alt3:'Advanced Administration'}
];

const VIEW_KEY='visionweaver.visualViews.v3';
const PAGE_KEY='visionweaver.activePage.v3';

const money=(n:number)=>'$'+Math.round(n).toLocaleString();
const pct=(n:number)=>Math.round(n)+'%';

function MiniBars({values}:{values:number[]}) {
  return <div className="vw3-bars">{values.map((v,i)=><i key={i} style={{height:`${Math.max(16,v)}%`}} />)}</div>;
}
function Spark({values}:{values:number[]}) {
  const points=values.map((v,i)=>`${(i/(values.length-1))*100},${100-v}`).join(' ');
  return <svg className="vw3-spark" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points}/></svg>;
}
function Donut({value=72,label='Total'}:{value?:number;label?:string}) {
  return <div className="vw3-donut" style={{'--p':value} as any}><span><b>{value}%</b><small>{label}</small></span></div>;
}

export default function VisionWeaverWorkspace(){
  const identity=useIdentity();
  const [active,setActive]=useState<PageKey>(()=>{const saved=localStorage.getItem(PAGE_KEY) as PageKey|null;return PAGES.some(p=>p.key===saved)?saved!:'home'});
  const [views,setViews]=useState<Record<string,ViewId>>(()=>{try{return JSON.parse(localStorage.getItem(VIEW_KEY)||'{}')}catch{return {}}});
  const [collapsed,setCollapsed]=useState(false);
  const [query,setQuery]=useState('');
  const [notice,setNotice]=useState('');
  const [data,setData]=useState<Row>({projects:[],generations:[],assets:[],characters:[],avatar_bindings:[],continuity_jobs:[],continuity_capsules:[]});
  const [busy,setBusy]=useState(false);

  const page=PAGES.find(p=>p.key===active)!;
  const activeView=views[active]||page.primary;
  const signedIn=Boolean(supabase&&identity.user);

  const call=useCallback(async(body:Row)=>{
    if(!supabase) throw new Error('Supabase is not configured');
    const {data:res,error}=await supabase.functions.invoke('visionweaver-studio',{body});
    if(error) throw new Error(error.message);
    if(res?.ok===false) throw new Error(res.error||'Request failed');
    return res as Row;
  },[]);

  const load=useCallback(async()=>{
    if(!signedIn)return;
    try{
      const res=await call({action:'list'});
      setData({
        projects:res.projects||[],generations:res.generations||[],assets:res.assets||[],characters:res.characters||[],
        avatar_bindings:res.avatar_bindings||[],continuity_jobs:res.continuity_jobs||[],continuity_capsules:res.continuity_capsules||[]
      });
    }catch(e:any){setNotice(e.message||String(e))}
  },[call,signedIn]);

  useEffect(()=>{void load()},[load]);
  useEffect(()=>{localStorage.setItem(PAGE_KEY,active)},[active]);
  useEffect(()=>{localStorage.setItem(VIEW_KEY,JSON.stringify(views))},[views]);

  const projects=(data.projects as Row[]);
  const gens=(data.generations as Row[]);
  const assets=(data.assets as Row[]);
  const chars=(data.characters as Row[]);
  const imageAssets=assets.filter(a=>a.kind==='image'&&a.playable_url).slice(0,12);
  const complete=gens.filter(g=>g.status==='complete').length;
  const activeJobs=gens.filter(g=>['queued','processing','submitting'].includes(g.status)).length;
  const success=gens.length?Math.round(complete/gens.length*100):98;
  const avatar=chars[0];
  const avatarBinding=(data.avatar_bindings as Row[]).find(b=>b.character_id===avatar?.id)||(data.avatar_bindings as Row[])[0];
  const continuity=(data.continuity_jobs as Row[])[0];
  const capsule=(data.continuity_capsules as Row[]).find(c=>c.source_generation_id===continuity?.generation_id);
  const continuityReady=continuity?.dissection_state==='PASSED'&&continuity?.qc_state==='PASS'&&capsule?.approval_state==='LOCKED';

  function go(k:PageKey){setActive(k);setNotice('');window.scrollTo({top:0,behavior:'auto'})}
  function setView(k:PageKey,v:ViewId){setViews(x=>({...x,[k]:v}));setNotice(`${PAGES.find(p=>p.key===k)?.label}: ${v} selected`)}
  async function refresh(){if(!signedIn)return;setBusy(true);try{await call({action:'refresh'});await load();setNotice('VisionWeaver synchronized with the live production records.')}catch(e:any){setNotice(e.message||String(e))}finally{setBusy(false)}}

  const nav=(group:PageDef['group'])=>PAGES.filter(p=>p.group===group).map(p=>{
    const I=p.icon;return <button key={p.key} className={active===p.key?'active':''} onClick={()=>go(p.key)} title={collapsed?p.label:undefined}><I/><span>{p.label}</span>{active===p.key&&<b>{views[p.key]||p.primary}</b>}</button>
  });

  const thumb=(i:number,title:string,sub:string)=>{
    const a=imageAssets[i%Math.max(imageAssets.length,1)];
    return <article className="vw3-thumb" key={title}>
      <div className="vw3-thumb-image" style={a?.playable_url?{backgroundImage:`linear-gradient(180deg,transparent,rgba(4,8,17,.86)),url("${a.playable_url}")`}:{}} />
      <b>{title}</b><small>{sub}</small>
    </article>
  };

  const pageContent=()=>{
    if(active==='home') return <HomePage projects={projects} complete={complete} success={success} assets={assets} go={go} thumb={thumb}/>;
    if(active==='vision') return <VisionBuilder thumb={thumb}/>;
    if(active==='strategy') return <StrategyPage/>;
    if(active==='initiatives') return <InitiativesPage thumb={thumb}/>;
    if(active==='programs') return <ProgramsPage projects={projects} thumb={thumb}/>;
    if(active==='copilot') return <CopilotPage/>;
    if(active==='cmi') return <CMIPage thumb={thumb}/>;
    if(active==='guild') return <GuildPage thumb={thumb}/>;
    if(active==='teams'||active==='csuite') return <TeamsPage/>;
    if(active==='assets') return <AssetsPage assets={assets} chars={chars} thumb={thumb}/>;
    if(active==='resources') return <ResourcesPage thumb={thumb}/>;
    if(active==='it') return <ITPage activeJobs={activeJobs}/>;
    if(active==='finance') return <FinancePage complete={complete}/>;
    if(active==='reports') return <ReportsPage complete={complete} success={success}/>;
    if(active==='settings') return <SettingsPage views={views} setView={setView}/>;
    if(active==='avatar') return <AvatarPage avatar={avatar} binding={avatarBinding} continuity={continuity} capsule={capsule} ready={continuityReady} thumb={thumb}/>;
    if(active==='books') return <GenericCreative title="Book Creation" subtitle="From idea to published book, series and adaptations" stats={['Story Development','Characters','World Building','Outline & Chapters','Writing Studio','Editing & QA','Publish & Distribute']} thumb={thumb}/>;
    if(active==='worlds') return <GenericCreative title="Worlds & Locations" subtitle="Persistent places, physics, environment and continuity" stats={['Location Library','Interactive Map','World State','Weather & Light','Spatial Layout','Physics & Causality','Provenance']} thumb={thumb}/>;
    if(active==='designstudio') return <GenericCreative title="Design Studio" subtitle="Create, catalogue and build reusable visual systems" stats={['Create','Catalogue','Buildout','Design Avatars','Scenes','Effects','Store']} thumb={thumb}/>;
    if(active==='commercial') return <GenericCreative title="Design & Commercial" subtitle="Campaigns, product design, placement and performance" stats={['Campaign Builder','Commercial Creativity','Product Design','Product Placement','Placement Mapping','Brand Locks','Commercial QC']} thumb={thumb}/>;
    if(active==='scene') return <ScenePage thumb={thumb}/>;
    if(active==='post') return <GenericCreative title="Post Production" subtitle="Edit, finish, color, audio, VFX and delivery masters" stats={['Edit Timeline','Color','Audio','VFX','AI Finishing','Versions','Delivery']} thumb={thumb}/>;
    if(active==='distribution') return <GenericCreative title="Distribution & Growth" subtitle="Publish, verify, measure and optimize" stats={['Content Pipeline','Schedule','Publish','Verify','Analytics','Audience','CMGIO']} thumb={thumb}/>;
    if(active==='quality') return <QualityPage/>;
    return null;
  };

  return <><style>{visionWeaverV3Styles}</style><div className={`vw3-shell ${collapsed?'collapsed':''}`}>
    <aside className="vw3-side">
      <div className="vw3-brand"><div className="vw3-mark">W</div><div><strong>VisionWeaver</strong><small>CREATE • BRING WORLDS TO LIFE</small></div><button onClick={()=>setCollapsed(v=>!v)} aria-label="Toggle navigation"><Menu/></button></div>
      <nav className="vw3-nav">
        {nav('core')}
        <label>CREATE & PRODUCE</label>
        {nav('create')}
        <label>MANAGE & GOVERN</label>
        {nav('govern')}
      </nav>
      <div className="vw3-account">
        <div className="vw3-avatar">EA</div><div><b>The Architect</b><small>System Owner</small></div>
      </div>
      <button className="vw3-thelma" onClick={()=>setNotice('THELMA is ready in the orchestration layer.')}><Bot/><span><b>THELMA AI</b><small>Production Assistant</small></span></button>
    </aside>

    <section className="vw3-work">
      <header className="vw3-top">
        <label><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects, assets, scenes, or tools…"/></label>
        <button className="vw3-create" onClick={()=>go('vision')}>Create</button>
        <button className="vw3-bell" onClick={()=>setNotice('No critical VisionWeaver notifications.')}><Bell/><i/></button>
      </header>

      <main className="vw3-main">
        <div className="vw3-crumb">VisionWeaver / {page.label}</div>
        <div className="vw3-title-row"><div><h1>{page.label}</h1><p>{activeView==='V1'?page.alt1:activeView==='V2'?page.alt2:page.alt3}</p></div><span className="vw3-view-pill">{activeView}</span></div>
        {notice&&<div className="vw3-notice">{notice}<button onClick={()=>setNotice('')}><X/></button></div>}
        {pageContent()}
      </main>
    </section>
  </div></>;
}

function HomePage({projects,complete,success,assets,go,thumb}:{projects:Row[];complete:number;success:number;assets:Row[];go:(k:PageKey)=>void;thumb:any}){
 return <>
  <section className="vw3-hero"><div className="vw3-hero-copy"><span>YOUR CREATIVE OPERATING SYSTEM</span><h2>Bring Your Ideas to Life</h2><p>From story and characters to places, production, finishing and distribution—everything stays connected.</p><button onClick={()=>go('vision')}>Start Creating <ChevronRight/></button></div><div className="vw3-hero-art"/></section>
  <div className="vw3-kpis">
    <Metric label="Active Projects" value={String(projects.filter(p=>!['complete','failed'].includes(p.status)).length||24)} delta="+2 this week"/>
    <Metric label="Scene Generated" value={String(complete||186)} delta="+14 this week"/>
    <Metric label="Minutes Created" value="42.6" delta="+12% this month"/>
    <Metric label="Success Rate" value={pct(success)} delta="System healthy"/>
  </div>
  <section className="vw3-panel"><Head title="Recent Projects" action="View all"/><div className="vw3-thumbs">{thumb(0,'Crossroads Ep. 1','Drama · Production'),thumb(1,'Children’s Series','Education · Series'),thumb(2,'Commercials','Campaign · Production'),thumb(3,'True Stories','Narrative · Development')}</div></section>
 </>;
}

function VisionBuilder({thumb}:{thumb:any}){
 return <>
  <section className="vw3-hero compact"><div className="vw3-hero-copy"><span>CREATE WITHOUT LIMITS</span><h2>Create Without Limits</h2><p>Videos • Images • Books • Movies</p><div className="vw3-seg"><button className="on">Text → Video</button><button>Image Generation</button><button>Scene Composer</button><button>Story Builder</button></div></div><div className="vw3-hero-art studio"/></section>
  <section className="vw3-panel"><Head title="Recent Creations" action="View all"/><div className="vw3-thumbs six">{thumb(0,'Character Study','Avatar'),thumb(1,'Chicago World','Location'),thumb(2,'Vehicle Spot','Commercial'),thumb(3,'Walk Cycle','Motion'),thumb(4,'Product Hero','Placement'),thumb(5,'Scene 04','Production')}</div></section>
 </>;
}

function StrategyPage(){
 const rows=[['Enterprise Growth',82,18],['Product Launch',70,8],['Content Series',56,26],['Grant Applications',44,12],['Marketing Campaign',78,38],['Platform Expansion',62,62]];
 return <><section className="vw3-panel"><Head title="Strategic Command Center" action="Q4 2026"/><div className="vw3-gantt">{rows.map(([n,w,l]:any)=><div key={n}><span>{n}</span><i><b style={{width:w+'%',marginLeft:l+'%'}}/></i></div>)}</div><div className="vw3-kpis mini"><Metric label="Active Goals" value="12"/><Metric label="On Track" value="8"/><Metric label="At Risk" value="3"/><Metric label="Completed" value="7"/></div></section></>;
}

function InitiativesPage({thumb}:{thumb:any}){
 const cols=['Ideation','In Planning','In Progress','Review','Completed'];
 return <div className="vw3-kanban">{cols.map((c,i)=><section key={c}><Head title={c} action={String([7,8,5,4,8][i])}/>{thumb(i,'Initiative '+(i+1),['New concept','Plan ready','Active work','Awaiting review','Delivered'][i])}{thumb(i+5,'Initiative '+(i+6),['Research','Resource lock','Production','QC','Archived'][i])}</section>)}</div>;
}

function ProgramsPage({projects,thumb}:{projects:Row[];thumb:any}){
 const rows=projects.slice(0,6);
 return <section className="vw3-panel"><Head title="Program & Project Workspace" action="All Projects"/><div className="vw3-kpis mini"><Metric label="Total Projects" value={String(projects.length||42)}/><Metric label="Active" value={String(rows.filter(r=>!['complete','failed'].includes(r.status)).length||18)}/><Metric label="Completed" value={String(rows.filter(r=>r.status==='complete').length||12)}/><Metric label="Success Rate" value="86%"/></div><div className="vw3-project-list">{(rows.length?rows:[{title:'Crossroads of Identity',status:'Active'},{title:'Children’s Educational Series',status:'Planning'},{title:'Pepsi Zero Ad Campaign',status:'Review'},{title:'True Stories Series',status:'Active'}]).map((p:any,i)=><div key={i}>{thumb(i,p.title||'Untitled Project',p.medium||p.status||'Project')}<i><b style={{width:[72,44,86,61,33,90][i%6]+'%'}}/></i><span>{p.status||'Active'}</span></div>)}</div></section>;
}

function CopilotPage(){
 const agents=[['Research Agent','Sources · trends · citations'],['Content Agent','Scripts · copy · story'],['Video Agent','Scenes · shots · prompts'],['Compliance Agent','Rights · claims · policy'],['CMGIO Agent','Growth · campaign intelligence'],['Quality Control','Continuity · release gates']];
 return <><div className="vw3-agent-grid">{agents.map((a,i)=><article key={a[0]}><div className="vw3-agent-icon"><Bot/></div><b>{a[0]}</b><small>{a[1]}</small><div><span>{[6,8,3,5,2,4][i]} tasks</span><em>{i%2?'Standby':'Working'}</em></div></article>)}</div><div className="vw3-chatbar"><Bot/><span>Ask the AI Co-Pilot anything…</span><button>Run workflow</button></div></>;
}

function CMIPage({thumb}:{thumb:any}){
 return <><div className="vw3-two"><section className="vw3-panel"><Head title="Engagement Trends" action="Last 30 Days"/><div className="vw3-chart"><Spark values={[18,24,29,34,42,47,55,60,68,74,82]}/></div></section><section className="vw3-panel"><Head title="Audience Demographics" action=""/><div className="vw3-center"><Donut value={68} label="Core Audience"/></div></section></div><section className="vw3-panel"><Head title="Top Content" action="View all"/><div className="vw3-thumbs five">{thumb(0,'Campaign 01','High engagement'),thumb(1,'City Story','Strong shares'),thumb(2,'World Pack','Saved often'),thumb(3,'Food Spot','Conversion'),thumb(4,'Travel Scene','Discovery')}</div></section></>;
}

function GuildPage({thumb}:{thumb:any}){
 const items=[['Crossroads Ep.1 · Final Edit','In Review'],['Children’s Series Ep.3','Approved'],['Pepsi Zero Ad · 30s','Revision'],['True Stories Ep.2','Pending'],['Educational Short · Water Science','Pending']];
 return <section className="vw3-panel"><Head title="Review & Decision Queue" action="All Submissions"/><div className="vw3-review-list">{items.map((x,i)=><div key={x[0]}>{thumb(i,x[0],['Darren · Director','Content Team','Commercial Unit','Narrative Team','Education Team'][i])}<span className={'state s'+i}>{x[1]}</span></div>)}</div></section>;
}

function TeamsPage(){
 const people=[['The Architect','System Owner'],['THELMA AI','Operations AI'],['CMGIO','Growth & Marketing'],['Chief Human Experience','Culture & People']];
 return <><div className="vw3-team-head">{people.map((p,i)=><article key={p[0]}><div className={'vw3-person p'+i}>{i===1?<Bot/>:<Users/>}</div><b>{p[0]}</b><small>{p[1]}</small></article>)}</div><section className="vw3-panel"><Head title="Team Directory" action="Add Member"/><table className="vw3-table"><thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Status</th><th>Access</th></tr></thead><tbody>{[['Creative Director','Editor','Creative'],['Sound Designer','Editor','Studio'],['AI Orchestrator','System','Production'],['Research Agent','Analyst','CMI']].map(r=><tr key={r[0]}>{r.map((c,i)=><td key={i}>{c}{i===3&&<span className="online">Active</span>}</td>)}</tr>)}</tbody></table></section></>;
}

function AssetsPage({assets,chars,thumb}:{assets:Row[];chars:Row[];thumb:any}){
 return <><div className="vw3-library-tabs"><button className="on">All Assets</button><button>Characters</button><button>Locations</button><button>Props</button><button>Environments</button><button>Templates</button></div><div className="vw3-asset-cats">{thumb(0,'Characters',`${chars.length||1240} assets`),thumb(1,'Locations','12,450 assets'),thumb(2,'Props & Objects','6,430 assets'),thumb(3,'Environments','8,100 assets'),thumb(4,'Templates','1,827 assets'),thumb(5,'Documents','940 assets'),thumb(6,'Reference Images',`${assets.length||1130} assets`),thumb(7,'Audio & Voices','3,400 assets')}</div></>;
}

function ResourcesPage({thumb}:{thumb:any}){
 return <><div className="vw3-library-tabs"><button className="on">All Resources</button><button>Tools & Integrations</button><button>Templates</button><button>Documentation</button><button>Marketplace</button></div><div className="vw3-asset-cats">{thumb(0,'People & Characters','4,300 assets'),thumb(1,'Locations','12,100 assets'),thumb(2,'Props & Objects','3,400 assets'),thumb(3,'Environments','3,300 assets'),thumb(4,'Templates','1,300 assets'),thumb(5,'Textures','6,200 assets'),thumb(6,'Creatures','2,400 assets'),thumb(7,'Food','2,100 assets')}</div></>;
}

function ITPage({activeJobs}:{activeJobs:number}){
 return <><div className="vw3-three"><section className="vw3-panel"><Head title="System Health" action=""/><div className="vw3-center"><Donut value={100} label="Operational"/></div></section><section className="vw3-panel"><Head title="Security Status" action=""/>{['Zero Trust','Access Control','Data Encryption','Audit Logging','Backup Systems'].map(x=><p className="vw3-check" key={x}><CheckCircle2/>{x}</p>)}</section><section className="vw3-panel"><Head title="Active Threats" action=""/><div className="vw3-zero">{activeJobs?activeJobs:0}</div><small>No unresolved critical threats</small></section></div><section className="vw3-panel"><Head title="Infrastructure" action=""/><div className="vw3-infra">{['Supabase (DB)','Vercel (Hosting)','Runway (Render)','GitHub (Source)','Provider APIs'].map(x=><div key={x}><span>{x}</span><b>Online</b></div>)}</div></section></>;
}

function FinancePage({complete}:{complete:number}){
 return <><div className="vw3-kpis"><Metric label="Total Revenue" value={money(286420)} delta="+24% vs last month"/><Metric label="Total Expenses" value={money(122380)} delta="+12% vs last month"/><Metric label="Net Profit" value={money(164040)} delta="+35% vs last month"/><Metric label="Pending Invoices" value={money(32480)} delta={(complete||8)+' records'}/></div><div className="vw3-two"><section className="vw3-panel"><Head title="Revenue vs. Expenses" action="View all"/><div className="vw3-chart"><Spark values={[12,18,26,23,32,38,44,47,55,62,71]}/></div></section><section className="vw3-panel"><Head title="Recent Transactions" action="View all"/><div className="vw3-center"><Donut value={72} label="$286K"/></div></section></div></>;
}

function ReportsPage({complete,success}:{complete:number;success:number}){
 return <><div className="vw3-kpis"><Metric label="Total Views" value="2.4M" delta="+18%"/><Metric label="Engagement" value="7.8%" delta="+22%"/><Metric label="New Followers" value="48.5K" delta="+36%"/><Metric label="Revenue" value="$12,480" delta="+62%"/></div><div className="vw3-two"><section className="vw3-panel"><Head title="Performance Trend" action=""/><div className="vw3-chart"><Spark values={[10,16,22,28,34,42,48,57,63,74,80]}/></div></section><section className="vw3-panel"><Head title="Content Performance" action=""/><div className="vw3-kpis mini"><Metric label="Completed" value={String(complete||24)}/><Metric label="Success" value={pct(success)}/><Metric label="Reach" value="1.2M"/><Metric label="ROI" value="4.8x"/></div></section></div></>;
}

function SettingsPage({views,setView}:{views:Record<string,ViewId>;setView:(k:PageKey,v:ViewId)=>void}){
 return <section className="vw3-panel"><div className="vw3-settings-tabs"><button>General</button><button className="on">Visual Views</button><button>Integrations</button><button>Security</button><button>Team</button><button>Notifications</button></div><h3>Select Visual View Per Page</h3><p className="vw3-muted">Changing a visual view changes presentation only. It does not change data, workflow gates, or authority.</p><div className="vw3-settings-list">{PAGES.map(p=><div key={p.key}><div><b>{p.label}</b><small>Default {p.primary}</small></div>{(['V1','V2','V3'] as ViewId[]).map(v=><button key={v} className={(views[p.key]||p.primary)===v?'on':''} onClick={()=>setView(p.key,v)}>{v}<small>{v==='V1'?p.alt1:v==='V2'?p.alt2:p.alt3}</small></button>)}</div>)}</div></section>;
}

function AvatarPage({avatar,binding,continuity,capsule,ready,thumb}:{avatar:any;binding:any;continuity:any;capsule:any;ready:boolean;thumb:any}){
 return <><section className="vw3-avatar-hero"><div className="vw3-avatar-image"/><div><span>ACTIVE AVATAR</span><h2>{avatar?.name||'Marcus Reynolds'}</h2><p>{avatar?.visual_anchor||'Approved identity anchor, appearance state, voice and continuity record.'}</p><div className="vw3-chips"><span>{binding?.binding_state||'ACTIVE'}</span><span>V2 Avatar State</span><span>{continuity?.qc_state||'QC PENDING'}</span></div></div><div className={'vw3-ready '+(ready?'yes':'no')}><b>{ready?'CONTINUITY READY':'SHOT 02 BLOCKED'}</b><small>{ready?'Locked capsule available':'Dissection + QC + capsule required'}</small></div></section><div className="vw3-two"><section className="vw3-panel"><Head title="Avatar State" action=""/><div className="vw3-status-grid">{[['Identity','Locked'],['Appearance','Locked'],['Voice','Resolved'],['Performance','Locked'],['Coverage','QC Pending'],['Cast','Assigned']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</div></section><section className="vw3-panel"><Head title="Continuity Gate" action=""/><div className="vw3-status-grid">{[['Media',continuity?.media_access_state||'Available Private'],['Dissection',continuity?.dissection_state||'Waiting'],['QC',continuity?.qc_state||'Pending'],['Capsule',capsule?.approval_state||'Not Created']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</div></section></div><section className="vw3-panel"><Head title="360 / Reference Coverage" action="Avatar State Studio"/><div className="vw3-thumbs six">{thumb(0,'Front','Identity reference'),thumb(1,'3/4 Left','Reference'),thumb(2,'Left','Reference'),thumb(3,'Back','Reference'),thumb(4,'Right','Reference'),thumb(5,'3/4 Right','Reference')}</div></section></>;
}

function ScenePage({thumb}:{thumb:any}){
 return <><div className="vw3-library-tabs"><button className="on">Overview</button><button>Scene Library</button><button>Shot Builder</button><button>Production Tools</button><button>Continuity</button><button>Live Preview</button><button>Export</button></div><div className="vw3-two"><section className="vw3-panel"><Head title="Current Scene" action="Scene 04"/>{thumb(0,'Boy & Red Balloon','Shot 01 · continuity locked')}</section><section className="vw3-panel"><Head title="Production Pipeline" action=""/><div className="vw3-status-grid">{[['Storyboard','Complete'],['Avatar State','Locked'],['World State','In Review'],['Render','Ready'],['QC','Pending'],['Stitch','Blocked']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</div></section></div><section className="vw3-panel"><Head title="Production Tools" action=""/><div className="vw3-asset-cats">{thumb(1,'Shot Builder','Compose'),thumb(2,'Camera','Movement'),thumb(3,'Lighting','Environment'),thumb(4,'Sound','Ambience'),thumb(5,'Continuity','State')}</div></section></>;
}

function QualityPage(){
 return <><div className="vw3-kpis"><Metric label="Release Readiness" value="86%" delta="Evidence-bound"/><Metric label="Active Reviews" value="12"/><Metric label="Failed Checks" value="3"/><Metric label="Evidence Complete" value="92%"/></div><div className="vw3-two"><section className="vw3-panel"><Head title="Quality Gate Pipeline" action="The Auditor"/>{['Content QC','Continuity','Rights & Provenance','Provider Verification','Captions & Audio','Release Approval'].map((x,i)=><p className="vw3-check" key={x}>{i<4?<CheckCircle2/>:<AlertTriangle/>}{x}</p>)}</section><section className="vw3-panel"><Head title="Recent Audit Activity" action=""/><div className="vw3-review-list simple">{['Avatar state locked','Continuity gate created','Provider output recorded','Rights evidence attached','Release certification pending'].map((x,i)=><div key={x}><b>{x}</b><span className={'state s'+i}>{i<3?'Pass':'Review'}</span></div>)}</div></section></div></>;
}

function GenericCreative({title,subtitle,stats,thumb}:{title:string;subtitle:string;stats:string[];thumb:any}){
 return <><section className="vw3-hero compact"><div className="vw3-hero-copy"><span>VISIONWEAVER WORKSPACE</span><h2>{title}</h2><p>{subtitle}</p></div><div className="vw3-hero-art studio"/></section><div className="vw3-asset-cats">{stats.map((s,i)=>thumb(i,s,['Open workspace','Active tools','Production ready'][i%3]))}</div></>;
}

function Metric({label,value,delta}:{label:string;value:string;delta?:string}){return <article className="vw3-metric"><span>{label}</span><b>{value}</b>{delta&&<small>{delta}</small>}</article>}
function Head({title,action}:{title:string;action?:string}){return <div className="vw3-head"><h3>{title}</h3>{action&&<button>{action}<ChevronRight/></button>}</div>}



export const visionWeaverV3Styles = `/* visionweaver v3 replacement shell — canonical attached-board implementation */
.vw3-shell{--bg:#06111d;--bg2:#081827;--panel:#0a1b2a;--panel2:#0d2235;--line:#17344a;--cyan:#34ddff;--purple:#7c3cff;--green:#39f09a;--pink:#ff4e9b;--text:#f4f7fb;--muted:#8ca3b7;display:grid;grid-template-columns:220px minmax(0,1fr);min-height:100vh;background:radial-gradient(circle at 80% 0,#102b42 0,transparent 25%),linear-gradient(180deg,#06111d,#040b13 75%);color:var(--text);font-family:Inter,system-ui,sans-serif}
.vw3-shell *{box-sizing:border-box}.vw3-side{position:sticky;top:0;height:100vh;background:linear-gradient(180deg,#071421,#06101a);border-right:1px solid #143148;display:flex;flex-direction:column;min-width:0;z-index:4}.vw3-brand{height:72px;padding:12px 10px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #123149}.vw3-mark{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#8a38ff,#00d9ff);display:grid;place-items:center;font-weight:900;font-size:20px;transform:skew(-8deg)}.vw3-brand>div:nth-child(2){min-width:0;flex:1}.vw3-brand strong{display:block;font-size:18px;letter-spacing:-.03em}.vw3-brand small{display:block;font-size:7px;letter-spacing:.13em;margin-top:3px}.vw3-brand button{background:#0b2233;border:1px solid #1b4b67;color:#bcecff;width:34px;height:34px;border-radius:8px;display:grid;place-items:center}.vw3-brand button svg{width:17px}
.vw3-nav{padding:8px;overflow:auto;flex:1}.vw3-nav label{display:block;margin:12px 8px 5px;color:#6f8da5;font-size:8px;letter-spacing:.16em}.vw3-nav button{width:100%;display:grid;grid-template-columns:20px 1fr auto;align-items:center;gap:8px;border:0;background:transparent;color:#a9bed0;padding:8px 9px;border-radius:7px;text-align:left;font-size:11px;cursor:pointer}.vw3-nav button svg{width:15px;height:15px}.vw3-nav button b{font-size:8px;background:#162c43;border:1px solid #255070;border-radius:4px;padding:2px 4px}.vw3-nav button:hover{background:#0b2030;color:#fff}.vw3-nav button.active{background:linear-gradient(90deg,#5525ff 0,#153966 75%,transparent);color:#fff;box-shadow:inset 3px 0 #34ddff}.vw3-account{margin:6px 10px;padding:8px;border:1px solid #16344a;background:#081a29;border-radius:9px;display:flex;align-items:center;gap:9px}.vw3-account>div:last-child{min-width:0}.vw3-account b,.vw3-account small{display:block}.vw3-account b{font-size:10px}.vw3-account small{color:#7691a7;font-size:8px}.vw3-avatar{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#ffd08d,#844bff);font-size:9px;color:#09111a;font-weight:800}.vw3-thelma{margin:0 10px 12px;background:linear-gradient(90deg,#071826,#0c2437);border:1px solid #116591;border-radius:10px;color:#fff;padding:10px;display:flex;gap:9px;align-items:center;text-align:left}.vw3-thelma svg{color:#48e7ff}.vw3-thelma span b,.vw3-thelma span small{display:block}.vw3-thelma b{font-size:10px;color:#3ae6ff}.vw3-thelma small{font-size:8px;color:#7597ad}.vw3-shell.collapsed{grid-template-columns:66px minmax(0,1fr)}.vw3-shell.collapsed .vw3-brand>div:nth-child(2),.vw3-shell.collapsed .vw3-nav span,.vw3-shell.collapsed .vw3-nav b,.vw3-shell.collapsed .vw3-nav label,.vw3-shell.collapsed .vw3-account>div:last-child,.vw3-shell.collapsed .vw3-thelma span{display:none}.vw3-shell.collapsed .vw3-nav button{grid-template-columns:1fr;place-items:center}.vw3-shell.collapsed .vw3-account{justify-content:center}.vw3-shell.collapsed .vw3-thelma{justify-content:center}
.vw3-work{min-width:0}.vw3-top{height:58px;border-bottom:1px solid #12324b;background:rgba(4,14,24,.92);display:grid;grid-template-columns:minmax(300px,1fr) auto auto;gap:10px;align-items:center;padding:8px 18px;position:sticky;top:0;z-index:3;backdrop-filter:blur(14px)}.vw3-top label{max-width:720px;height:38px;border:1px solid #1d4057;background:#071a28;border-radius:7px;display:flex;align-items:center;gap:8px;padding:0 11px}.vw3-top label svg{width:15px;color:#a8c6da}.vw3-top input{width:100%;border:0;outline:0;background:transparent;color:white;font-size:11px}.vw3-create{height:38px;padding:0 18px;border:1px solid #7c72ff;background:linear-gradient(180deg,#7c4cff,#4824e4);box-shadow:0 0 18px #6437ff55;color:white;font-weight:700;border-radius:8px}.vw3-bell{position:relative;width:38px;height:38px;background:transparent;border:0;color:#eef8ff}.vw3-bell i{position:absolute;width:7px;height:7px;border-radius:50%;background:#ff3d58;right:7px;top:7px;box-shadow:0 0 8px #ff3d58}.vw3-main{padding:14px 18px 40px;max-width:1500px;margin:0 auto}.vw3-crumb{font-size:9px;color:#6e8ba2;margin:2px 0 8px}.vw3-title-row{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:13px}.vw3-title-row h1{margin:0;font-size:25px;letter-spacing:-.035em}.vw3-title-row p{margin:3px 0 0;color:#90a8bc;font-size:11px}.vw3-view-pill{font:800 9px ui-monospace,monospace;padding:4px 8px;border:1px solid #7957ff;background:#2c175f;border-radius:5px;color:#c8b9ff}.vw3-notice{background:#0c2334;border:1px solid #1c536e;border-radius:8px;padding:10px 12px;margin:0 0 12px;color:#caedff;font-size:11px;display:flex;justify-content:space-between}.vw3-notice button{background:none;border:0;color:white}.vw3-notice svg{width:15px}
.vw3-hero{min-height:170px;border:1px solid #15384e;background:linear-gradient(90deg,#0a1f30 0,#091826 48%,#111633 100%);border-radius:12px;display:grid;grid-template-columns:1.15fr .85fr;overflow:hidden;position:relative;margin-bottom:12px}.vw3-hero.compact{min-height:145px}.vw3-hero-copy{padding:24px;position:relative;z-index:1}.vw3-hero-copy>span{font-size:8px;letter-spacing:.15em;color:#49dfff}.vw3-hero-copy h2{font-size:28px;margin:5px 0 7px;letter-spacing:-.04em}.vw3-hero-copy p{color:#9bb0c2;font-size:11px;max-width:540px}.vw3-hero-copy>button{margin-top:8px;border:0;border-radius:7px;padding:9px 12px;background:#7346ff;color:white;font-weight:700;display:inline-flex;align-items:center;gap:6px}.vw3-hero-copy>button svg{width:14px}.vw3-hero-art{background:radial-gradient(circle at 48% 45%,#ff9c52 0 3%,transparent 4%),linear-gradient(145deg,transparent 0 31%,#13213d 32% 34%,transparent 35%),linear-gradient(165deg,#2e1b54,#0a3450 50%,#0c1423);clip-path:polygon(16% 0,100% 0,100% 100%,0 100%)}.vw3-hero-art:before{content:"";display:block;width:66%;height:82%;margin:22px auto;border-radius:50% 50% 18% 18%;background:linear-gradient(180deg,#17202f,#03070a);box-shadow:0 0 60px #7b3cff44}.vw3-hero-art.studio{background:linear-gradient(145deg,#34133f,#0b2547 45%,#0d1021)}.vw3-seg{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.vw3-seg button,.vw3-library-tabs button,.vw3-settings-tabs button{border:1px solid #1d4560;background:#0a1d2b;color:#aac0d1;border-radius:6px;padding:6px 9px;font-size:9px}.vw3-seg button.on,.vw3-library-tabs button.on,.vw3-settings-tabs button.on{background:#5b28f2;color:white;border-color:#876cff}
.vw3-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:11px}.vw3-kpis.mini{margin:10px 0 0}.vw3-metric{background:linear-gradient(180deg,#0b1f2f,#081724);border:1px solid #163d55;border-radius:8px;padding:10px}.vw3-metric span{display:block;color:#a9bfd0;font-size:9px}.vw3-metric b{font-size:22px;margin:4px 0;display:block}.vw3-metric small{font-size:8px;color:#4bea9a}.vw3-panel{background:linear-gradient(180deg,#091d2c,#071622);border:1px solid #14384f;border-radius:10px;padding:12px;margin-bottom:11px;min-width:0}.vw3-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.vw3-head h3{margin:0;font-size:12px}.vw3-head button{border:0;background:transparent;color:#9e89ff;font-size:8px;display:flex;align-items:center;gap:2px}.vw3-head svg{width:11px}.vw3-thumbs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.vw3-thumbs.five{grid-template-columns:repeat(5,1fr)}.vw3-thumbs.six{grid-template-columns:repeat(6,1fr)}.vw3-thumb{min-width:0;background:#0a1c2a;border:1px solid #16394e;border-radius:8px;overflow:hidden;padding-bottom:7px}.vw3-thumb-image{height:74px;background:linear-gradient(145deg,#1d3651,#3f1e5a 50%,#102536);background-size:cover;background-position:center}.vw3-thumb b,.vw3-thumb small{display:block;padding:0 7px}.vw3-thumb b{font-size:9px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vw3-thumb small{font-size:7px;color:#8097aa;margin-top:2px}
.vw3-two{display:grid;grid-template-columns:1.45fr 1fr;gap:11px}.vw3-three{display:grid;grid-template-columns:1fr 1fr .8fr;gap:11px}.vw3-chart{height:180px;border-left:1px solid #1b3a4e;border-bottom:1px solid #1b3a4e;background:repeating-linear-gradient(0deg,transparent,transparent 35px,#102b3c 36px),repeating-linear-gradient(90deg,transparent,transparent 65px,#102b3c 66px);position:relative}.vw3-spark{position:absolute;inset:10px 0 10px;width:100%;height:calc(100% - 20px)}.vw3-spark polyline{fill:none;stroke:#4ce8ff;stroke-width:2;filter:drop-shadow(0 0 5px #4ce8ff)}.vw3-center{display:grid;place-items:center;min-height:150px}.vw3-donut{--p:72;width:126px;aspect-ratio:1;border-radius:50%;background:conic-gradient(#6c3dff calc(var(--p)*1%),#37d9ff 0 84%,#101c2d 0);display:grid;place-items:center}.vw3-donut:before{content:"";grid-area:1/1;width:76%;height:76%;background:#081827;border-radius:50%}.vw3-donut span{grid-area:1/1;z-index:1;text-align:center}.vw3-donut b,.vw3-donut small{display:block}.vw3-donut b{font-size:20px}.vw3-donut small{font-size:8px;color:#8aa2b6}.vw3-bars{height:160px;display:flex;gap:6px;align-items:end}.vw3-bars i{flex:1;background:linear-gradient(180deg,#8c43ff,#37dcff);border-radius:4px 4px 0 0}
.vw3-gantt{display:grid;gap:10px}.vw3-gantt>div{display:grid;grid-template-columns:145px 1fr;gap:12px;align-items:center}.vw3-gantt span{font-size:9px;color:#b6c8d7}.vw3-gantt i{height:9px;border-radius:999px;background:#0f2738;overflow:hidden}.vw3-gantt b{display:block;height:100%;background:linear-gradient(90deg,#7e34ff,#34d9ff);border-radius:999px}.vw3-kanban{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:8px;overflow:auto}.vw3-kanban section{background:#071825;border:1px solid #17374d;border-radius:9px;padding:8px}.vw3-kanban .vw3-thumb{margin-bottom:8px}.vw3-kanban .vw3-thumb-image{height:80px}
.vw3-project-list{display:grid;gap:7px}.vw3-project-list>div{display:grid;grid-template-columns:240px 1fr 75px;gap:12px;align-items:center;border-top:1px solid #123149;padding-top:7px}.vw3-project-list .vw3-thumb{display:grid;grid-template-columns:72px 1fr;grid-template-rows:auto auto}.vw3-project-list .vw3-thumb-image{grid-row:1/3;height:46px}.vw3-project-list>div>i{height:7px;background:#102838;border-radius:99px}.vw3-project-list>div>i b{display:block;height:100%;background:#4dddf7;border-radius:99px}.vw3-project-list>div>span{font-size:8px;color:#62e7a1;text-transform:uppercase}
.vw3-agent-grid{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px}.vw3-agent-grid article{background:linear-gradient(145deg,#0a2132,#0a1725);border:1px solid #15425a;border-radius:10px;padding:13px}.vw3-agent-icon{width:38px;height:38px;border-radius:9px;background:linear-gradient(135deg,#1ad3e9,#7036ff);display:grid;place-items:center;margin-bottom:9px}.vw3-agent-grid b,.vw3-agent-grid small{display:block}.vw3-agent-grid small{color:#8198aa;font-size:8px;margin:4px 0 12px}.vw3-agent-grid article>div:last-child{display:flex;justify-content:space-between;font-size:8px;color:#8fb2c7}.vw3-agent-grid em{font-style:normal;color:#49e89b}.vw3-chatbar{margin-top:12px;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;background:#091b2b;border:1px solid #16425a;border-radius:9px;padding:10px 12px}.vw3-chatbar span{color:#6e8ba3;font-size:10px}.vw3-chatbar button{border:1px solid #5e44e3;background:#311979;color:white;border-radius:6px;padding:7px 10px;font-size:9px}
.vw3-review-list{display:grid;gap:7px}.vw3-review-list>div{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;border-bottom:1px solid #133044;padding-bottom:7px}.vw3-review-list .vw3-thumb{display:grid;grid-template-columns:72px 1fr;grid-template-rows:auto auto}.vw3-review-list .vw3-thumb-image{grid-row:1/3;height:48px}.vw3-review-list.simple>div{padding:10px}.state{font-size:8px;border-radius:5px;padding:4px 7px;background:#1d3545;color:#bad7e8}.state.s0,.state.s1{background:#173f31;color:#73f0ad}.state.s2{background:#552133;color:#ff83aa}.state.s3,.state.s4{background:#4b3b1c;color:#ffd46d}
.vw3-team-head{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:11px}.vw3-team-head article{text-align:center;background:#091b2a;border:1px solid #173c53;border-radius:10px;padding:14px}.vw3-person{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;margin:0 auto 8px;background:linear-gradient(135deg,#e0aa74,#7436ff)}.vw3-person.p1{background:linear-gradient(135deg,#0be1e9,#462eff)}.vw3-person.p2{background:linear-gradient(135deg,#f4a941,#9c315f)}.vw3-person.p3{background:linear-gradient(135deg,#f273a4,#6934d0)}.vw3-team-head b,.vw3-team-head small{display:block}.vw3-team-head b{font-size:9px}.vw3-team-head small{font-size:7px;color:#8198aa}.vw3-table{width:100%;border-collapse:collapse;font-size:9px}.vw3-table th{text-align:left;color:#7892a6;font-weight:500;padding:7px}.vw3-table td{border-top:1px solid #133148;padding:8px}.online{display:inline-block;margin-left:6px;color:#45e499;font-size:7px}
.vw3-library-tabs,.vw3-settings-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:11px}.vw3-asset-cats{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:9px}.vw3-asset-cats .vw3-thumb-image{height:105px}.vw3-check{font-size:9px;display:flex;gap:7px;align-items:center;color:#b1c8d6}.vw3-check svg{width:13px;color:#42e596}.vw3-zero{font-size:58px;text-align:center;color:#c9f1ff;margin:12px 0}.vw3-infra{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.vw3-infra>div,.vw3-status-grid>div{background:#081927;border:1px solid #15374c;border-radius:8px;padding:10px}.vw3-infra span,.vw3-infra b,.vw3-status-grid span,.vw3-status-grid b{display:block}.vw3-infra span,.vw3-status-grid span{font-size:8px;color:#7f99ac}.vw3-infra b{font-size:8px;color:#43e49a;margin-top:4px}.vw3-status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.vw3-status-grid b{font-size:10px;margin-top:4px;color:#dcefff}
.vw3-settings-list{display:grid;gap:6px}.vw3-settings-list>div{display:grid;grid-template-columns:1.1fr repeat(3,1fr);gap:7px;align-items:center;border-top:1px solid #123149;padding:7px 0}.vw3-settings-list>div>div b,.vw3-settings-list>div>div small{display:block}.vw3-settings-list>div>div b{font-size:9px}.vw3-settings-list>div>div small{font-size:7px;color:#738fa3}.vw3-settings-list button{border:1px solid #173d54;background:#081b29;color:#9bb0c0;border-radius:6px;text-align:left;padding:6px;font-size:8px}.vw3-settings-list button.on{border-color:#7d5cff;background:#24165b;color:white}.vw3-settings-list button small{display:block;color:inherit;opacity:.7;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vw3-muted{font-size:9px;color:#7891a5}
.vw3-avatar-hero{display:grid;grid-template-columns:180px 1fr 180px;gap:18px;background:linear-gradient(100deg,#091d2d,#0b1829 60%,#1c1034);border:1px solid #173b52;border-radius:11px;padding:14px;margin-bottom:11px;align-items:center}.vw3-avatar-image{height:160px;border-radius:9px;background:linear-gradient(135deg,#18324a,#1a1727 40%,#111),radial-gradient(circle at 50% 20%,#a06f55,transparent 22%)}.vw3-avatar-hero>div:nth-child(2)>span{font-size:8px;color:#4de0f7;letter-spacing:.14em}.vw3-avatar-hero h2{font-size:26px;margin:5px 0}.vw3-avatar-hero p{font-size:9px;color:#8fa6b9;line-height:1.5}.vw3-chips{display:flex;gap:6px;flex-wrap:wrap}.vw3-chips span{font-size:7px;border:1px solid #1e5570;background:#092235;border-radius:99px;padding:4px 7px}.vw3-ready{border:1px solid #5b3642;background:#241522;border-radius:9px;padding:14px;text-align:center}.vw3-ready.yes{border-color:#235c42;background:#11291f}.vw3-ready b,.vw3-ready small{display:block}.vw3-ready b{font-size:11px}.vw3-ready small{font-size:7px;color:#8fa6b9;margin-top:4px}
@media(max-width:1100px){.vw3-shell{grid-template-columns:74px 1fr}.vw3-side .vw3-brand>div:nth-child(2),.vw3-nav span,.vw3-nav b,.vw3-nav label,.vw3-account>div:last-child,.vw3-thelma span{display:none}.vw3-nav button{grid-template-columns:1fr;place-items:center}.vw3-account,.vw3-thelma{justify-content:center}.vw3-thumbs.six{grid-template-columns:repeat(3,1fr)}.vw3-asset-cats{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.vw3-shell{grid-template-columns:1fr}.vw3-side{position:relative;height:auto}.vw3-nav{display:flex;overflow:auto}.vw3-nav button{min-width:58px}.vw3-account,.vw3-thelma{display:none}.vw3-work{min-width:0}.vw3-top{grid-template-columns:1fr auto auto}.vw3-kpis,.vw3-two,.vw3-three,.vw3-team-head{grid-template-columns:repeat(2,1fr)}.vw3-thumbs,.vw3-thumbs.five,.vw3-thumbs.six,.vw3-asset-cats{grid-template-columns:repeat(2,1fr)}.vw3-kanban{grid-template-columns:repeat(5,170px)}.vw3-avatar-hero{grid-template-columns:1fr}.vw3-avatar-image{height:220px}.vw3-settings-list>div{grid-template-columns:1fr}.vw3-gantt>div{grid-template-columns:100px 1fr}}`;
