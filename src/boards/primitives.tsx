import type{CSSProperties,ReactNode}from'react';

export type Tone='accent'|'good'|'warn'|'bad'|'info'|'muted';
const toneVar:Record<Tone,string>={accent:'var(--bd-accent)',good:'var(--bd-good)',warn:'var(--bd-warn)',bad:'var(--bd-bad)',info:'var(--bd-info)',muted:'var(--bd-muted)'};
export const tv=(tone:Tone)=>toneVar[tone];

/** Controlled status vocabulary from docs/ui/CEO-DASHBOARD-PAGE-SPECIFICATION.md section 5. */
export type Status='HEALTHY'|'ATTENTION'|'AT_RISK'|'BLOCKED'|'CRITICAL'|'OFFLINE'|'PENDING_APPROVAL'|'IN_PROGRESS'|'COMPLETED'|'ARCHIVED';
const statusTone:Record<Status,Tone>={HEALTHY:'good',ATTENTION:'warn',AT_RISK:'warn',BLOCKED:'bad',CRITICAL:'bad',OFFLINE:'muted',PENDING_APPROVAL:'info',IN_PROGRESS:'accent',COMPLETED:'good',ARCHIVED:'muted'};
export const statusLabel=(s:Status)=>s.replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());

export function Card({title,sub,right,children,className='',style}:{title?:ReactNode;sub?:ReactNode;right?:ReactNode;children?:ReactNode;className?:string;style?:CSSProperties}){
 return <section className={`bd-card ${className}`} style={style}>{(title||right)&&<header><div>{title&&<h3>{title}</h3>}{sub&&<small>{sub}</small>}</div>{right}</header>}{children}</section>;
}

export function Stat({label,value,sub,tone='accent',spark,ring}:{label:string;value:string;sub?:string;tone?:Tone;spark?:number[];ring?:number}){
 return <article className="bd-card bd-stat"><span className="bd-label">{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}{spark&&<Spark values={spark} tone={tone}/>}{ring!==undefined&&<Donut value={ring} size={56} tone={tone}/>}</article>;
}

export function Pill({tone='muted',children}:{tone?:Tone;children:ReactNode}){return <span className={`bd-pill ${tone}`}>{children}</span>}
export function StatusPill({status}:{status:Status}){return <Pill tone={statusTone[status]}>{statusLabel(status)}</Pill>}

export function Prog({label,value,tone='accent',right}:{label:string;value:number;tone?:Tone;right?:ReactNode}){
 const pct=Math.max(0,Math.min(100,value));
 return <div className="bd-prog"><div><span>{label}</span><b>{right??`${pct}%`}</b></div><i role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><em style={{width:`${pct}%`,background:tv(tone)}}/></i></div>;
}

const W=300;
function pathFor(values:number[],h:number,max:number){
 const n=values.length;
 if(n<2)return'';
 return values.map((v,i)=>`${i===0?'M':'L'}${((i/(n-1))*W).toFixed(1)},${(h-(v/max)*(h-8)-4).toFixed(1)}`).join(' ');
}

export function Spark({values,tone='accent',h=30}:{values:number[];tone?:Tone;h?:number}){
 const max=Math.max(...values,1);
 const line=pathFor(values,h,max);
 return <svg className="bd-spark" viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{height:h}} aria-hidden="true"><path d={`${line} L${W},${h} L0,${h} Z`} fill={tv(tone)} opacity=".14"/><path d={line} fill="none" stroke={tv(tone)} strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>;
}

export function AreaChart({values,labels,tone='accent',h=120,second,secondTone='good',forecastFrom}:{values:number[];labels?:string[];tone?:Tone;h?:number;second?:number[];secondTone?:Tone;forecastFrom?:number}){
 const max=Math.max(...values,...(second??[]),1);
 const line=pathFor(values,h,max);
 return <figure className="bd-chart"><svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{height:h}} role="img" aria-label="Trend chart">
  {[0.25,0.5,0.75].map(g=><line key={g} x1="0" x2={W} y1={h*g} y2={h*g} stroke="var(--bd-line)" strokeWidth="1" vectorEffect="non-scaling-stroke"/>)}
  <path d={`${line} L${W},${h} L0,${h} Z`} fill={tv(tone)} opacity=".16"/>
  <path d={line} fill="none" stroke={tv(tone)} strokeWidth="2.2" vectorEffect="non-scaling-stroke"/>
  {second&&<path d={pathFor(second,h,max)} fill="none" stroke={tv(secondTone)} strokeWidth="2.2" vectorEffect="non-scaling-stroke"/>}
  {forecastFrom!==undefined&&<line x1={(forecastFrom/(values.length-1))*W} x2={(forecastFrom/(values.length-1))*W} y1="0" y2={h} stroke="var(--bd-muted)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"/>}
 </svg>{labels&&<figcaption>{labels.map((l,i)=><span key={i}>{l}</span>)}</figcaption>}</figure>;
}

export function BarChart({series,labels,tones=['accent','good','warn'],h=120,line}:{series:number[][];labels?:string[];tones?:Tone[];h?:number;line?:number[]}){
 const count=series[0]?.length??0;
 const totals=Array.from({length:count},(_,i)=>series.reduce((sum,s)=>sum+(s[i]??0),0));
 const max=Math.max(...totals,1);
 const lmax=line?Math.max(...line,1):1;
 return <figure className="bd-chart"><div className="bd-bars" style={{height:h}}>
  {totals.map((total,i)=><div className="bd-bar" key={i} title={`${labels?.[i]??i+1}: ${total}`}><div style={{height:`${(total/max)*100}%`}}>{series.map((s,j)=><span key={j} style={{flexGrow:s[i]??0,background:tv(tones[j%tones.length])}}/>)}</div></div>)}
  {line&&<svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" aria-hidden="true"><path d={pathFor(line,h,lmax)} fill="none" stroke="var(--bd-info)" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>}
 </div>{labels&&<figcaption>{labels.map((l,i)=><span key={i}>{l}</span>)}</figcaption>}</figure>;
}

export function HBars({rows}:{rows:{label:string;value:number;tone?:Tone;text?:string}[]}){
 return <div className="bd-hbars">{rows.map(r=><Prog key={r.label} label={r.label} value={r.value} tone={r.tone} right={r.text}/>)}</div>;
}

export function Donut({value,size=72,tone='accent',label}:{value:number;size?:number;tone?:Tone;label?:string}){
 const pct=Math.max(0,Math.min(100,value));
 const r=size/2-6,c=2*Math.PI*r;
 return <div className="bd-donut" style={{width:size,height:size}} role="img" aria-label={`${label??'Progress'} ${pct}%`}><svg viewBox={`0 0 ${size} ${size}`}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bd-line)" strokeWidth="7"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={tv(tone)} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(pct/100)*c} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`}/></svg><b>{pct}%</b></div>;
}

export function DataTable({cols,rows}:{cols:string[];rows:ReactNode[][]}){
 return <div className="bd-tablewrap"><table className="bd-table"><thead><tr>{cols.map((c,i)=><th key={i} scope="col">{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

const avatarTones=['#8f7cf0','#e08d79','#5fb0c9','#e0b24f','#6dbd94','#b27fd1'];
export function Avatar({name,index=0}:{name:string;index?:number}){
 return <span className="bd-avatar" style={{background:avatarTones[index%avatarTones.length]}} aria-hidden="true">{name.split(' ').map(p=>p[0]).slice(0,2).join('')}</span>;
}

export function Toggle({on,label}:{on:boolean;label:string}){return <span className={`bd-toggle ${on?'on':''}`} role="switch" aria-checked={on} aria-label={label}><i/></span>}

const thumbGradients=['linear-gradient(135deg,#6b4a8f,#d1687a)','linear-gradient(135deg,#8a6a52,#d9b48f)','linear-gradient(135deg,#1c2330,#41506b)','linear-gradient(135deg,#2f6f8f,#9bd0d8)','linear-gradient(135deg,#c9824a,#f1d29a)','linear-gradient(135deg,#2b2f3a,#0f1218)','linear-gradient(135deg,#4f7a58,#c3d9b0)','linear-gradient(135deg,#8c4a5a,#e9a8a0)'];
export function Thumb({index=0,play,label,height=74}:{index?:number;play?:boolean;label?:string;height?:number}){
 return <div className="bd-thumb" style={{background:thumbGradients[index%thumbGradients.length],height}} role="img" aria-label={label??'Media preview'}>{play&&<span aria-hidden="true">▶</span>}</div>;
}

export function Heat({rows,cols,cells}:{rows:string[];cols:string[];cells:number[][]}){
 const tone=(v:number)=>v>=4?'bad':v===3?'warn':v===2?'info':'good';
 return <div className="bd-tablewrap"><table className="bd-table bd-heat"><thead><tr><th scope="col"/>{cols.map((c,i)=><th key={i} scope="col">{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}><th scope="row">{r}</th>{cells[i].map((v,j)=><td key={j}><span className={`bd-cell ${tone(v)}`}>{v}</span></td>)}</tr>)}</tbody></table></div>;
}

export function Grid({cols,children,className=''}:{cols:string;children:ReactNode;className?:string}){return <div className={`bd-grid c-${cols} ${className}`}>{children}</div>}
export function Row({children}:{children:ReactNode}){return <div className="bd-row">{children}</div>}
