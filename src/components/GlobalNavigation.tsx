import{PropsWithChildren,useEffect,useMemo,useState}from'react';
import{ArrowLeft,Bot,ChevronDown,Gauge,Grid3X3,Home,Landmark,Megaphone,PanelTop,Play,Workflow,X}from'lucide-react';
import ThelmaAIConsole from'./ThelmaAIConsole';

type SystemLink={key:string;name:string;description:string;path:string;icon:any;tag:string};
const systems:SystemLink[]=[
 {key:'visionweaver',name:'VisionWeaver',description:'Create images, video, audio, books and movies.',path:'/systems/visionweaver',icon:Play,tag:'CREATE'},
 {key:'landweaver',name:'LandWeaver',description:'Research, score and manage property opportunities.',path:'/systems/landweaver',icon:Landmark,tag:'PROPERTY'},
 {key:'grantos',name:'GrantOS',description:'Manage funding opportunities, evidence and submissions.',path:'/systems/grantos',icon:PanelTop,tag:'FUNDING'},
 {key:'thelma',name:'THELMA',description:'Dispatch governed work to agents and monitor execution.',path:'/systems/thelma',icon:Bot,tag:'OPERATIONS'},
 {key:'cmgio-map',name:'CMGIO',description:'Plan campaigns, monitor signals and optimize growth.',path:'/systems/cmgio-map',icon:Megaphone,tag:'GROWTH'},
 {key:'integration-fabric',name:'EC Integration Fabric',description:'Authorize, route, retry and audit production jobs.',path:'/systems/integration-fabric',icon:Workflow,tag:'INFRASTRUCTURE'}
];

function currentSystemKey(path:string){if(path.includes('visionweaver'))return'SYS-VISION-001';if(path.includes('landweaver'))return'SYS-LAND-001';if(path.includes('grantos'))return'SYS-GRANT-001';if(path.includes('cmgio'))return'SYS-MKT-001';if(path.includes('integration-fabric'))return'SYS-FABRIC-001';if(path.includes('thelma'))return'SYS-THELMA-001';return'SYS-CEO-001'}

function currentLocation(path:string){
 if(path==='/dashboard'||path.startsWith('/dashboard/'))return{title:'Master Dashboard',systemHome:'/dashboard'};
 if(path.startsWith('/c-suite'))return{title:'C-Suite Command',systemHome:'/c-suite/executive-overview'};
 const item=systems.find(s=>path.startsWith(s.path));
 if(item)return{title:item.name,systemHome:item.path};
 return{title:'Estiban Creations',systemHome:'/dashboard'};
}

export default function GlobalNavigation({children}:PropsWithChildren){
 const[path,setPath]=useState(()=>window.location.pathname),[open,setOpen]=useState(false),[thelmaOpen,setThelmaOpen]=useState(false);
 useEffect(()=>{
  const notify=()=>setPath(window.location.pathname);
  const originalPush=window.history.pushState.bind(window.history),originalReplace=window.history.replaceState.bind(window.history);
  window.history.pushState=((...args:Parameters<History['pushState']>)=>{originalPush(...args);window.dispatchEvent(new Event('ec-locationchange'))})as History['pushState'];
  window.history.replaceState=((...args:Parameters<History['replaceState']>)=>{originalReplace(...args);window.dispatchEvent(new Event('ec-locationchange'))})as History['replaceState'];
  window.addEventListener('popstate',notify);window.addEventListener('ec-locationchange',notify);
  return()=>{window.history.pushState=originalPush;window.history.replaceState=originalReplace;window.removeEventListener('popstate',notify);window.removeEventListener('ec-locationchange',notify)};
 },[]);
 const location=useMemo(()=>currentLocation(path),[path]);
 const go=(next:string)=>{setOpen(false);if(window.location.pathname===next){window.location.assign(next);return}window.location.assign(next)};
 return <div className="ec-product-frame">
  <header className="ec-global-nav">
   <button className="ec-back" onClick={()=>window.history.length>1?window.history.back():go('/dashboard')} aria-label="Go back"><ArrowLeft/></button>
   <button className="ec-logo" onClick={()=>go('/dashboard')} aria-label="Master Dashboard"><span>EC</span></button>
   <div className="ec-location"><small>ESTIBAN CREATIONS</small><b>{location.title}</b></div>
   <nav className="ec-global-actions">
    <button onClick={()=>go('/dashboard')} className={path.startsWith('/dashboard')?'active':''}><Home/><span>Main Dashboard</span></button>
    {!path.startsWith('/dashboard')&&<button onClick={()=>go(location.systemHome)}><PanelTop/><span>System Home</span></button>}
    <button onClick={()=>go('/c-suite/executive-overview')} className={path.startsWith('/c-suite')?'active':''}><Gauge/><span>C-Suite</span></button>
    <button className={thelmaOpen?'active':''} onClick={()=>setThelmaOpen(true)}><Bot/><span>Ask THELMA</span></button>
    <button className={open?'active':''} onClick={()=>setOpen(!open)}><Grid3X3/><span>All Systems</span><ChevronDown/></button>
   </nav>
  </header>
  {open&&<div className="ec-system-overlay" onClick={()=>setOpen(false)}><section className="ec-system-switcher" onClick={e=>e.stopPropagation()}>
   <div className="ec-switcher-head"><div><small>WORKSPACES</small><h2>Where do you want to work?</h2><p>Every production system is one click away.</p></div><button onClick={()=>setOpen(false)} aria-label="Close"><X/></button></div>
   <div className="ec-system-grid">{systems.map(({key,name,description,path:target,icon:Icon,tag})=><button key={key} onClick={()=>go(target)} className={path.startsWith(target)?'current':''}><span className="ec-system-icon"><Icon/></span><span className="ec-system-copy"><small>{tag}</small><b>{name}</b><em>{description}</em></span><span className="ec-open-label">Open</span></button>)}</div>
   <div className="ec-switcher-foot"><button onClick={()=>go('/dashboard')}><Home/>Master Dashboard</button><button onClick={()=>go('/c-suite/executive-overview')}><Gauge/>C-Suite Command</button></div>
  </section></div>}
  {thelmaOpen&&<div className="ec-thelma-overlay" onClick={()=>setThelmaOpen(false)}><section className="ec-thelma-dock" onClick={e=>e.stopPropagation()}><button className="ec-thelma-close" onClick={()=>setThelmaOpen(false)} aria-label="Close THELMA"><X/></button><ThelmaAIConsole contextSystemKey={currentSystemKey(path)}/></section></div>}
  <div className="ec-product-body">{children}</div>
 </div>;
}
