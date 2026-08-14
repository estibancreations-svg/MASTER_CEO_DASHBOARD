import {useMemo,useState} from'react';
import{Activity,Award,BarChart3,Bell,Bot,Boxes,ChevronDown,ChevronRight,CircleDollarSign,CircleHelp,FileText,Gauge,GraduationCap,LayoutDashboard,Library,ListChecks,Menu,MessageSquare,Package,Plug,Search,Settings,ShieldCheck,Sparkles,Target,TrendingUp,Users,Video,Workflow,X}from'lucide-react';
import type{LucideIcon}from'lucide-react';
import{useCommandData}from'../hooks/useCommandData';

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

const rows:Record<string,string[][]>={
'AI Mastery':[['Prompt Architecture','Advanced','82%','In progress'],['Agent Orchestration','Intermediate','64%','In progress'],['Security & Governance','Required','100%','Certified']],
'Agent Hub':[['THELMA','Operations lead','Online','31 tasks'],['CMGIO','Growth intelligence','Online','18 tasks'],['The Auditor','Quality control','Reviewing','7 tasks'],['LandWeaver','Property intelligence','Online','12 tasks']],
'Leads Pipeline':[['Riverside property group','Qualified','$84,000','Today'],['Community arts initiative','Proposal','$42,500','Today'],['Southeast land portfolio','Discovery','$186,000','Tomorrow']],
'Content Engine':[['Reunion launch campaign','In review','12 assets','Aug 15'],['Property insight series','Drafting','8 assets','Aug 17'],['GrantOS authority launch','Approved','16 assets','Aug 18']],
'Social Media':[['Instagram','Connected','18.4K','6.8%'],['Facebook','Connected','31.2K','5.1%'],['Pinterest','Connected','22.7K','8.4%'],['YouTube','Attention','4.8K','4.2%']],
'Trends':[['Florida land opportunities','High','92','Rising'],['AI agent workspaces','High','88','Rising'],['Family legacy storytelling','Medium','76','Stable']],
'Communications':[['Board briefing packet','Executive Office','Priority','Unread'],['THELMA operations digest','Operations','Normal','Unread'],['LandWeaver market alert','Property','Priority','Read']],
'CRM':[['Avery Holdings','Property investor','Qualified','Today'],['Hope Community Network','Nonprofit','Active','Yesterday'],['Southern Media Group','Partner','Nurture','Aug 11']],
'Products':[['CEO Command Center','Software','Active','$12,400'],['VisionWeaver Studio','Creative AI','Staging','$8,900'],['LandWeaver Intelligence','Property','Pilot','$6,200']],
'Finance':[['Operating revenue','Income','$54,230','+12.4%'],['Platform services','Expense','$8,420','-3.1%'],['Available runway','Forecast','9.4 months','Stable']],
'System Audit':[['Authentication policy','Security','Passed','Today'],['VisionWeaver RLS','Database','Passed','Today'],['Provider credentials','Integration','Review','Aug 14']],
'Certificates':[['AI Governance','The Architect','Verified','2027'],['Zero-Trust Operations','Technology','Verified','2027'],['Agent Quality Control','Operations','In review','Pending']],
'Settings':[['Executive preferences','Workspace','Configured','Edit'],['Role and permissions','Security','Enforced','Review'],['Notifications','Communications','14 rules','Edit']],
'Team Overview':[['Executive Office','2 members','84% capacity','Healthy'],['Technology','4 members','76% capacity','Healthy'],['Growth & Media','3 members','91% capacity','Watch']],
'Video Storyboard':[['The Matriarch’s Debt','12 scenes','Pre-production','72%'],['LandWeaver launch','8 scenes','Storyboard','45%'],['GrantOS explainer','6 scenes','Script','31%']],
'Social Analytics':[['Total reach','All channels','184,220','+18%'],['Engagement','All channels','6.7%','+0.8%'],['Conversions','All channels','1,247','+12%']],
'Lead Scoring Rules':[['Budget fit','Financial','25 points','Active'],['Decision authority','Qualification','20 points','Active'],['Timeline under 90 days','Intent','18 points','Active']],
'API Integration':[['Supabase','Data & Auth','Connected','Healthy'],['GitHub','Source control','Connected','Healthy'],['Vercel','Deployment','Connected','Healthy'],['Google Drive','Documents','Configured','Review']],
'Revenue Report':[['Software & systems','Current month','$28,400','52%'],['Creative media','Current month','$16,230','30%'],['Property intelligence','Current month','$9,600','18%']],
'Agent Logs':[['THELMA daily orchestration','Completed','1m 42s','Today'],['CMGIO campaign analysis','Completed','4m 18s','Today'],['Auditor release review','Attention','2m 51s','Today']],
'Media Library':[['Brand library','128 assets','Updated today','Shared'],['Product photography','86 assets','Updated Aug 12','Private'],['Video productions','44 assets','Updated Aug 11','Shared']],
'Multi-Account Posting':[['Reunion campaign','4 channels','Scheduled','Aug 15'],['LandWeaver insights','3 channels','In review','Aug 16'],['CEO briefing series','2 channels','Draft','Aug 18']],
'Trend Signal Alerts':[['Florida property velocity','Property','High','Active'],['Creator economy funding','Funding','Medium','Active'],['AI video cost movement','Technology','Medium','Watching']],
'Help Center':[['Launch the CEO Dashboard','Getting started','5 min','Open'],['Connect a new provider','Integrations','8 min','Open'],['Understand governed actions','Security','6 min','Open']]
};
const tones=['violet','blue','green','amber'];

export default function MasterDashboard({onOpenSuite}:{onOpenSuite:()=>void}){
 const[active,setActive]=useState('Dashboard'),[navOpen,setNavOpen]=useState(false),command=useCommandData();
 const selected=modules.find(x=>x.name===active)!;
 const groups=useMemo(()=>Array.from(new Set(modules.map(x=>x.group))),[]);
 const systems=command.systems.length?command.systems.slice(0,4):[
  {system_name:'VisionWeaver',progress_percent:72,lifecycle_state:'Staging'},{system_name:'CEO Dashboard',progress_percent:78,lifecycle_state:'Active'},{system_name:'LandWeaver',progress_percent:58,lifecycle_state:'Pilot'},{system_name:'GrantOS',progress_percent:44,lifecycle_state:'Build'}];
 return <div className="master-shell"><aside className={navOpen?'master-nav open':'master-nav'}>
  <div className="master-brand"><span>EC</span><div><b>ESTIBAN CREATIONS</b><small>MASTER DASHBOARD</small></div><button onClick={()=>setNavOpen(false)}><X/></button></div>
  <nav>{groups.map(group=><section key={group}><label>{group}</label>{modules.filter(x=>x.group===group).map(({name,icon:Icon})=><button className={active===name?'active':''} onClick={()=>{setActive(name);setNavOpen(false)}} key={name}><Icon/><span>{name}</span></button>)}</section>)}</nav>
  <button className="suite-switch" onClick={onOpenSuite}><Gauge/><span>C-Suite Command</span><ChevronRight/></button>
 </aside><main className="master-main"><header className="master-header"><button className="master-menu" onClick={()=>setNavOpen(true)}><Menu/></button><div><p>MASTER OPERATING SYSTEM</p><h1>{active}</h1></div><label><Search/><input aria-label="Search dashboard" placeholder="Search dashboard…"/></label><button className="master-alert"><Bell/><i>3</i></button><div className="master-user"><span>EA</span><div><b>Estiban</b><small>Architect</small></div><ChevronDown/></div></header>
  <section className="master-content"><div className="master-heading"><div><p>{selected.description}</p><small>Last synchronized just now · {command.connected&&!command.error?'Live Supabase data':'Read model available'}</small></div><button><Sparkles/> Ask THELMA</button></div>
  {active==='Dashboard'?<Dashboard systems={systems} onOpenSuite={onOpenSuite}/>:<ModulePage module={selected} data={rows[active]||[]}/>}</section>
 </main></div>
}

function Dashboard({systems,onOpenSuite}:{systems:any[];onOpenSuite:()=>void}){
 return <><div className="master-metrics">{[['Total Leads','1,247','+12.4%'],['Content Queue','89','14 ready'],['Revenue','$54,230','+8.7%'],['System Health','98%','All critical services']].map((m,i)=><article className={tones[i]} key={m[0]}><span>{m[0]}</span><strong>{m[1]}</strong><small>{m[2]}</small><BarChart3/></article>)}</div>
 <div className="master-grid"><section className="master-card"><Title over="QUICK MONITOR" title="Enterprise performance"/>{[['Revenue plan',78],['Qualified pipeline',64],['Content production',86],['Team capacity',74]].map(([n,v])=><div className="progress" key={n as string}><span>{n}</span><b>{v}%</b><i><em style={{width:`${v}%`}}/></i></div>)}</section>
 <section className="master-card"><Title over="LIVE SYSTEMS" title="System portfolio" action="Open C-Suite" onClick={onOpenSuite}/>{systems.map(s=><div className="system-line" key={s.system_name}><span className="system-icon"><Bot/></span><div><b>{s.system_name}</b><small>{s.lifecycle_state}</small></div><strong>{s.progress_percent}%</strong><i><em style={{width:`${s.progress_percent}%`}}/></i></div>)}</section>
 <section className="master-card wide"><Title over="OPERATING QUEUE" title="Priority work" action="View all"/>{[['VisionWeaver production gate','Technology','High','Today'],['LandWeaver provider activation','Property Intelligence','Medium','Tomorrow'],['GrantOS submission authority','Funding','High','Aug 18']].map(r=><div className="master-row" key={r[0]}><span className={`row-status ${r[2].toLowerCase()}`}>{r[2]}</span><div><b>{r[0]}</b><small>{r[1]}</small></div><span>{r[3]}</span><button><ChevronRight/></button></div>)}</section></div></>
}
function ModulePage({module,data}:{module:Module;data:string[][]}){return <><div className="module-metrics">{[['Active','24','+4 this week'],['In Review','07','2 priority'],['Completed','184','96% on time'],['Health','94%','Within target']].map((m,i)=><article className={tones[i]} key={m[0]}><span>{m[0]}</span><strong>{m[1]}</strong><small>{m[2]}</small></article>)}</div><section className="master-card module-card"><Title over={module.group.toUpperCase()+' WORKSPACE'} title={module.name} action="+ Add new"/><div className="table-head"><span>Name</span><span>Category</span><span>Status / Value</span><span>Activity</span></div>{data.map(r=><div className="module-row" key={r[0]}>{r.map((c,i)=>i===0?<b key={c}>{c}</b>:<span key={c}>{c}</span>)}<button><ChevronRight/></button></div>)}</section></>}
function Title({over,title,action,onClick}:{over:string;title:string;action?:string;onClick?:()=>void}){return <div className="card-title"><div><small>{over}</small><h2>{title}</h2></div>{action&&<button onClick={onClick}>{action}</button>}</div>}
