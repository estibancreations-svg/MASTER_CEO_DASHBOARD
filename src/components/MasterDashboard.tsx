import {FormEvent,useMemo,useState} from'react';
import{Activity,Award,BarChart3,Bell,Bot,Boxes,ChevronDown,ChevronRight,CircleDollarSign,CircleHelp,FileText,Gauge,GraduationCap,LayoutDashboard,Library,ListChecks,Menu,MessageSquare,Package,Plug,Search,Settings,ShieldCheck,Sparkles,Target,TrendingUp,Users,Video,Workflow,X}from'lucide-react';
import type{LucideIcon}from'lucide-react';
import{useCommandData}from'../hooks/useCommandData';
import type{ModuleRecord}from'../hooks/useCommandData';
import{useIdentity}from'../auth/IdentityContext';

type Module={name:string;icon:LucideIcon;group:string;description:string};
const modules:Module[]=[
 ['Dashboard',LayoutDashboard,'Overview','Enterprise performance and priority work'],
 ['AI Mastery',GraduationCap,'Intelligence','Training paths, assessments and AI capability'],
 ['Agent Hub',Bot,'Intelligence','Agent roster, assignments and operating health'],
 ['Leads Pipeline',Workflow,'Growth','Opportunities from intake through conversion'],
 ['Content Engine',Sparkles,'Growth','Plan, create, approve and publish content'],
 ['Social Media',MessageSquare,'Growth','Channel activity, publishing and engagement'],
 ['Trends',TrendingUp,'Intelligence','Signals, topics and emerging opportunities'],
 ['Communications',Bell,'Operations','Messages, briefings and response queues'],
 ['CRM',Users,'Growth','People, organizations and relationship history'],
 ['Products',Package,'Business','Catalog, offers, inventory and performance'],
 ['Finance',CircleDollarSign,'Business','Revenue, expenses, budget and forecasts'],
 ['System Audit',ShieldCheck,'Governance','Security, compliance and system evidence'],
 ['Certificates',Award,'Governance','Credentials, completions and verification'],
 ['Settings',Settings,'Governance','Workspace, permissions and preferences'],
 ['Team Overview',Users,'Operations','Capacity, roles, goals and performance'],
 ['Video Storyboard',Video,'Creative','Scenes, scripts, media and production status'],
 ['Social Analytics',BarChart3,'Growth','Reach, engagement, conversion and ROI'],
 ['Lead Scoring Rules',Target,'Growth','Qualification criteria, weights and routing'],
 ['API Integration',Plug,'Systems','Provider connections, health and credentials'],
 ['Revenue Report',FileText,'Business','Revenue detail, trends and exports'],
 ['Agent Logs',ListChecks,'Systems','Agent execution history, exceptions and cost'],
 ['Media Library',Library,'Creative','Images, video, audio and brand assets'],
 ['Multi-Account Posting',Boxes,'Growth','Cross-channel scheduling and approvals'],
 ['Trend Signal Alerts',Activity,'Intelligence','Monitored signals and escalation rules'],
 ['Help Center',CircleHelp,'Support','Guides, support and system documentation']
].map(([name,icon,group,description])=>({name,icon,group,description}as Module));

const tones=['violet','blue','green','amber'];

export default function MasterDashboard({onOpenSuite,onOpenLandWeaver,onOpenVisionWeaver,onOpenGrantOS,onOpenThelma,onOpenCmgio,onOpenFabric}:{onOpenSuite:()=>void;onOpenLandWeaver:()=>void;onOpenVisionWeaver:()=>void;onOpenGrantOS:()=>void;onOpenThelma:()=>void;onOpenCmgio:()=>void;onOpenFabric:()=>void}){
 const[active,setActive]=useState('Dashboard'),[navOpen,setNavOpen]=useState(false),command=useCommandData(),identity=useIdentity();
 const selected=modules.find(x=>x.name===active)!;
 const groups=useMemo(()=>Array.from(new Set(modules.map(x=>x.group))),[]);
 const systems=command.systems.length?command.systems.slice(0,10):[
  {system_name:'VisionWeaver',progress_percent:100,lifecycle_state:'Production'},{system_name:'CEO Dashboard',progress_percent:100,lifecycle_state:'Active'},{system_name:'LandWeaver',progress_percent:92,lifecycle_state:'MVP'},{system_name:'GrantOS',progress_percent:82,lifecycle_state:'MVP'},{system_name:'THELMA / EC Fabric',progress_percent:94,lifecycle_state:'MVP'},{system_name:'CMGIO / MAP',progress_percent:86,lifecycle_state:'MVP'},{system_name:'EC Integration Fabric',progress_percent:90,lifecycle_state:'MVP'}];
 return <div className="master-shell"><aside className={navOpen?'master-nav open':'master-nav'}>
  <div className="master-brand"><span>EC</span><div><b>ESTIBAN CREATIONS</b><small>MASTER DASHBOARD</small></div><button onClick={()=>setNavOpen(false)}><X/></button></div>
  <nav>{groups.map(group=><section key={group}><label>{group}</label>{modules.filter(x=>x.group===group).map(({name,icon:Icon})=><button className={active===name?'active':''} onClick={()=>{if(name==='API Integration'){onOpenFabric();return}setActive(name);setNavOpen(false)}} key={name}><Icon/><span>{name}</span></button>)}</section>)}</nav>
  <button className="suite-switch" onClick={onOpenSuite}><Gauge/><span>C-Suite Command</span><ChevronRight/></button>
 </aside><main className="master-main"><header className="master-header"><button className="master-menu" onClick={()=>setNavOpen(true)}><Menu/></button><div><p>{identity.organizationName.toUpperCase()} · MASTER OPERATING SYSTEM</p><h1>{active}</h1></div><label><Search/><input aria-label="Search dashboard" placeholder="Search dashboard…"/></label><button className="master-alert"><Bell/><i>3</i></button><div className="master-user"><span>{identity.isBuilder?'BP':identity.role==='architect'?'EA':'EC'}</span><div><b>{identity.isBuilder?'Builder Preview':identity.user?.email}</b><small>{identity.isBuilder?'read-only workspace':identity.role.replaceAll('_',' ')}</small></div>{!identity.isBuilder&&<button className="identity-signout" onClick={identity.signOut}>Sign out</button>}<ChevronDown/></div></header>
  <section className="master-content"><div className="master-heading"><div><p>{selected.description}</p><small>Last synchronized just now · {command.connected&&!command.error?'Live Supabase data':'Read model available'}</small></div><button><Sparkles/> Ask THELMA</button></div>
  {active==='Dashboard'?<Dashboard systems={systems} onOpenSuite={onOpenSuite} onOpenLandWeaver={onOpenLandWeaver} onOpenVisionWeaver={onOpenVisionWeaver} onOpenGrantOS={onOpenGrantOS} onOpenThelma={onOpenThelma} onOpenCmgio={onOpenCmgio} onOpenFabric={onOpenFabric}/>:<ModulePage module={selected} data={command.moduleRecords.filter(r=>r.module_key===active)} onCreate={command.createModuleRecord}/>}</section>
 </main></div>
}

function Dashboard({systems,onOpenSuite,onOpenLandWeaver,onOpenVisionWeaver,onOpenGrantOS,onOpenThelma,onOpenCmgio,onOpenFabric}:{systems:any[];onOpenSuite:()=>void;onOpenLandWeaver:()=>void;onOpenVisionWeaver:()=>void;onOpenGrantOS:()=>void;onOpenThelma:()=>void;onOpenCmgio:()=>void;onOpenFabric:()=>void}){
 return <><div className="master-metrics">{[['Total Leads','1,247','+12.4%'],['Content Queue','89','14 ready'],['Revenue','$54,230','+8.7%'],['System Health','98%','All critical services']].map((m,i)=><article className={tones[i]} key={m[0]}><span>{m[0]}</span><strong>{m[1]}</strong><small>{m[2]}</small><BarChart3/></article>)}</div>
 <div className="master-grid"><section className="master-card"><Title over="QUICK MONITOR" title="Enterprise performance"/>{[['Revenue plan',78],['Qualified pipeline',64],['Content production',86],['Team capacity',74]].map(([n,v])=><div className="progress" key={n as string}><span>{n}</span><b>{v}%</b><i><em style={{width:`${v}%`}}/></i></div>)}</section>
 <section className="master-card"><Title over="LIVE SYSTEMS" title="System portfolio" action="Open C-Suite" onClick={onOpenSuite}/>{systems.map(s=><div className="system-line" key={s.system_name}><span className="system-icon"><Bot/></span><div><b>{s.system_name}</b><small>{s.lifecycle_state}</small></div>{s.system_name==='LandWeaver'?<button className="system-open" onClick={onOpenLandWeaver}>Open</button>:s.system_name==='VisionWeaver'?<button className="system-open" onClick={onOpenVisionWeaver}>Open</button>:s.system_name==='GrantOS'?<button className="system-open" onClick={onOpenGrantOS}>Open</button>:s.system_name==='THELMA / EC Fabric'?<button className="system-open" onClick={onOpenThelma}>Open</button>:s.system_name==='CMGIO / MAP'?<button className="system-open" onClick={onOpenCmgio}>Open</button>:s.system_name==='EC Integration Fabric'?<button className="system-open" onClick={onOpenFabric}>Open</button>:<strong>{s.progress_percent}%</strong>}<i><em style={{width:`${s.progress_percent}%`}}/></i></div>)}</section>
 <section className="master-card wide"><Title over="OPERATING QUEUE" title="Priority work" action="View all"/>{[['VisionWeaver production gate','Technology','High','Today'],['LandWeaver provider activation','Property Intelligence','Medium','Tomorrow'],['GrantOS submission authority','Funding','High','Aug 18']].map(r=><div className="master-row" key={r[0]}><span className={`row-status ${r[2].toLowerCase()}`}>{r[2]}</span><div><b>{r[0]}</b><small>{r[1]}</small></div><span>{r[3]}</span><button><ChevronRight/></button></div>)}</section></div></>
}
function ModulePage({module,data,onCreate}:{module:Module;data:ModuleRecord[];onCreate:(key:string,input:{name:string;category:string;status_value:string;activity:string})=>Promise<{error:string|null}>}){
 const[adding,setAdding]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const active=data.filter(x=>x.record_state==='active').length,review=data.filter(x=>x.record_state==='review').length,done=data.filter(x=>x.record_state==='completed').length;
 const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setSaving(true);setError('');const form=new FormData(e.currentTarget);const result=await onCreate(module.name,{name:String(form.get('name')),category:String(form.get('category')),status_value:String(form.get('status')),activity:String(form.get('activity'))});setSaving(false);if(result.error)setError(result.error);else{setAdding(false);e.currentTarget.reset()}};
 return <><div className="module-metrics">{[['Active',String(active),'Live records'],['In Review',String(review),'Governed queue'],['Completed',String(done),'Recorded'],['Total',String(data.length),'Supabase records']].map((m,i)=><article className={tones[i]} key={m[0]}><span>{m[0]}</span><strong>{m[1]}</strong><small>{m[2]}</small></article>)}</div><section className="master-card module-card"><Title over={module.group.toUpperCase()+' WORKSPACE'} title={module.name} action={adding?'Cancel':'+ Add new'} onClick={()=>setAdding(!adding)}/>{adding&&<form className="module-create" onSubmit={submit}><input name="name" placeholder="Record name" required/><input name="category" placeholder="Category" required/><input name="status" placeholder="Status / value" required/><input name="activity" placeholder="Activity" required/><button disabled={saving}>{saving?'Saving…':'Save record'}</button>{error&&<small>{error}</small>}</form>}<div className="table-head"><span>Name</span><span>Category</span><span>Status / Value</span><span>Activity</span></div>{data.length?data.map(r=><div className="module-row" key={r.id}><b>{r.name}</b><span>{r.category}</span><span>{r.status_value}</span><span>{r.activity}</span><button><ChevronRight/></button></div>):<div className="module-empty">No records yet. Add the first live record.</div>}</section></>}
function Title({over,title,action,onClick}:{over:string;title:string;action?:string;onClick?:()=>void}){return <div className="card-title"><div><small>{over}</small><h2>{title}</h2></div>{action&&<button onClick={onClick}>{action}</button>}</div>}
