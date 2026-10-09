import type{ReactNode}from'react';
import{ChevronRight,Image as ImageIcon}from'lucide-react';
import type{ViewId}from'../types';

export function Panel({title,action,children,className=''}:{title?:string;action?:string;children:ReactNode;className?:string}){
 return <section className={'vw-panel '+className}>{title&&<header className="vw-panel-head"><h3>{title}</h3>{action&&<span>{action}<ChevronRight/></span>}</header>}{children}</section>
}
export function Metric({label,value,delta,tone='cyan'}:{label:string;value:string|number;delta?:string;tone?:'cyan'|'purple'|'green'|'pink'|'amber'}){
 return <article className={'vw-metric '+tone}><span>{label}</span><strong>{value}</strong>{delta&&<small>{delta}</small>}</article>
}
export function ViewChooser({view,setView,labels}:{view:ViewId;setView:(v:ViewId)=>void;labels:Record<ViewId,string>}){
 return <div className="vw-view-chooser">{(['V1','V2','V3']as ViewId[]).map(v=><button type="button" key={v} aria-pressed={view===v} onClick={()=>setView(v)}><b>{v}</b><small>{labels[v]}</small></button>)}</div>
}
export function AssetCard({title,subtitle,url,badge}:{title:string;subtitle?:string;url?:string;badge?:string}){
 return <article className="vw-asset-card"><div className="vw-asset-art" style={url?{backgroundImage:`linear-gradient(180deg,rgba(3,8,16,.02),rgba(3,8,16,.82)),url("${url}")`}:undefined}>{!url&&<ImageIcon/>}{badge&&<span>{badge}</span>}</div><div className="vw-asset-copy"><b>{title}</b>{subtitle&&<small>{subtitle}</small>}</div></article>
}
export function Progress({label,value,status}:{label:string;value:number;status?:string}){
 return <div className="vw-progress"><div><span>{label}</span>{status&&<small>{status}</small>}</div><i><b style={{width:Math.max(0,Math.min(100,value))+'%'}}/></i><strong>{value}%</strong></div>
}
export function StatusGrid({items}:{items:Array<[string,string,string?]>}){
 return <div className="vw-status-grid">{items.map(([a,b,c])=><div key={a}><span>{a}</span><b>{b}</b>{c&&<small>{c}</small>}</div>)}</div>
}
export function Bars({items}:{items:Array<[string,number,string?]>}){
 return <div className="vw-bar-chart">{items.map(([label,value,meta])=><div key={label}><span>{label}</span><i><b style={{width:value+'%'}}/></i><strong>{meta||String(value)}</strong></div>)}</div>
}
export function Empty({title,detail}:{title:string;detail:string}){
 return <div className="vw-empty"><b>{title}</b><p>{detail}</p></div>
}
