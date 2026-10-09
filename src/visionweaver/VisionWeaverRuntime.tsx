import{useCallback,useEffect,useMemo,useState}from'react';
import{
 Activity,Bell,BookOpen,Bot,Boxes,BriefcaseBusiness,Building2,Clapperboard,CircleDollarSign,Film,Globe2,Home,
 Image as ImageIcon,Library,Menu,MonitorUp,Palette,PieChart,Search,Settings,ShieldCheck,Sparkles,Users,Wand2,Gauge
}from'lucide-react';
import type{PageKey,ViewId}from'./types';
import{PAGES,PAGE_MAP,loadViews,saveViews,safePage}from'./registry';
import{useVisionWeaverData}from'./data';
import VisionWeaverPage from'./pages';
import'./visionweaver.css';

const ICONS:any={
 home:Home,wand:Wand2,gauge:Gauge,sparkles:Sparkles,briefcase:BriefcaseBusiness,bot:Bot,pie:PieChart,users:Users,building:Building2,
 book:BookOpen,avatar:Users,globe:Globe2,palette:Palette,image:ImageIcon,clapper:Clapperboard,film:Film,monitor:MonitorUp,
 shield:ShieldCheck,finance:CircleDollarSign,security:ShieldCheck,boxes:Boxes,library:Library,activity:Activity,settings:Settings
};

export default function VisionWeaverRuntime({initialPage='home',onNavigatePage}:{initialPage?:string;onNavigatePage?:(page:string)=>void}){
 const dataApi=useVisionWeaverData();
 const[page,setPage]=useState<PageKey>(()=>safePage(initialPage));
 const[views,setViews]=useState<Partial<Record<PageKey,ViewId>>>(()=>loadViews());
 const[navOpen,setNavOpen]=useState(()=>typeof window==='undefined'?true:window.innerWidth>=960);
 const[query,setQuery]=useState('');
 const[notice,setNotice]=useState('');

 useEffect(()=>{setPage(safePage(initialPage))},[initialPage]);
 useEffect(()=>saveViews(views),[views]);
 useEffect(()=>{
  const h=(e:Event)=>{const d=(e as CustomEvent).detail as{page:PageKey;view:ViewId};if(d?.page&&d?.view){setViews(v=>({...v,[d.page]:d.view}));setNotice(`${PAGE_MAP[d.page].label}: ${d.view} selected`)}};
  window.addEventListener('vw:set-view',h);return()=>window.removeEventListener('vw:set-view',h);
 },[]);

 const def=PAGE_MAP[page];
 const view=views[page]||def.primary;
 const setView=useCallback((v:ViewId)=>{setViews(x=>({...x,[page]:v}));setNotice(`${def.label}: ${v} selected`)},[page,def.label]);

 const open=useCallback((next:PageKey)=>{
  setPage(next);setNotice('');
  onNavigatePage?.(next);
  if(typeof window!=='undefined'&&window.innerWidth<960)setNavOpen(false);
  window.scrollTo({top:0,behavior:'auto'});
 },[onNavigatePage]);

 const grouped=useMemo(()=>({
  core:PAGES.filter(p=>p.group==='CORE'),
  create:PAGES.filter(p=>p.group==='CREATE & PRODUCE'),
  govern:PAGES.filter(p=>p.group==='MANAGE & GOVERN')
 }),[]);

 const renderNav=(items:typeof PAGES)=>items.map(p=>{
  const Icon=ICONS[p.icon]||Home;
  const selected=p.key===page;
  return <button type="button" key={p.key} className={selected?'active':''} onClick={()=>open(p.key)} title={!navOpen?p.label:undefined}>
   <Icon/><span>{p.label}</span>{selected&&<em>{views[p.key]||p.primary}</em>}
  </button>
 });

 const searchResults=query.trim()?PAGES.filter(p=>p.label.toLowerCase().includes(query.toLowerCase())).slice(0,6):[];

 return <div className={'vw-shell '+(navOpen?'nav-open':'nav-closed')}>
  <aside className="vw-sidebar">
   <div className="vw-brand">
    <div className="vw-logo"><span/><span/><span/></div>
    <div className="vw-brand-copy"><b>VisionWeaver</b><small>CREATE • BRING WORLDS TO LIFE</small></div>
    <button type="button" className="vw-nav-toggle" onClick={()=>setNavOpen(x=>!x)} aria-label={navOpen?'Collapse navigation':'Expand navigation'}><Menu/></button>
   </div>
   <nav>
    <div className="vw-nav-group">{renderNav(grouped.core)}</div>
    <label>CREATE & PRODUCE</label>
    <div className="vw-nav-group">{renderNav(grouped.create)}</div>
    <label>MANAGE & GOVERN</label>
    <div className="vw-nav-group">{renderNav(grouped.govern)}</div>
   </nav>
   <div className="vw-sidebar-footer">
    <button type="button" className="vw-account" onClick={()=>open('settings')}><span className="vw-account-avatar">EA</span><span><b>The Architect</b><small>System Owner</small></span></button>
    <button type="button" className="vw-thelma" onClick={()=>setNotice('THELMA is available as the governed operations/orchestration layer.')}><Bot/><span><b>THELMA AI</b><small>Production Assistant</small></span></button>
   </div>
  </aside>

  <section className="vw-workspace">
   <header className="vw-command">
    <div className="vw-search-wrap"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects, assets, scenes, or tools…"/>
     {searchResults.length>0&&<div className="vw-search-menu">{searchResults.map(r=><button key={r.key} onClick={()=>{open(r.key);setQuery('')}}>{r.label}<small>{r.views[views[r.key]||r.primary]}</small></button>)}</div>}
    </div>
    <button type="button" className="vw-create-button" onClick={()=>open('vision-builder')}>Create</button>
    <button type="button" className="vw-notification" onClick={()=>setNotice('No unresolved critical VisionWeaver notifications.')}><Bell/><i/></button>
   </header>

   <main className="vw-main">
    <div className="vw-breadcrumb">VisionWeaver / {def.label}</div>
    <header className="vw-page-head">
     <div><h1>{def.label}</h1><p>{def.views[view]}</p></div>
     <div className="vw-head-actions">
      <button type="button" onClick={()=>dataApi.load()} disabled={dataApi.loading}>{dataApi.loading?'Syncing…':'Refresh'}</button>
      <span>{view}</span>
     </div>
    </header>
    {(notice||dataApi.error)&&<div className="vw-notice">{notice||dataApi.error}<button onClick={()=>setNotice('')}>×</button></div>}
    {!dataApi.signedIn&&<div className="vw-system-note"><b>Sign-in required for live production data.</b><span>The interface remains available, but project records, generation history and private assets stay protected.</span></div>}
    <VisionWeaverPage page={page} data={dataApi.data} view={view} setView={setView} open={open} assetForName={dataApi.assetForName} projectForName={dataApi.projectForName}/>
   </main>
  </section>
 </div>;
}
