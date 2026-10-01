import{useState}from'react';
import type{ReactElement}from'react';
import{AreaChart,Avatar,BarChart,Card,Grid,Pill,Prog,Stat,StatusPill,Thumb}from'./primitives';

const up=[3,5,4,7,6,8,7,9];
const mid=[4,3,5,4,6,5,7,6];

/** 01 Dashboard */
export function DashboardBoard():ReactElement{
 return <div className="bd-stack">
  <Grid cols="3">
   <Stat label="AI Model" value="1.94" sub="Model index" spark={up}/>
   <Stat label="Revenue" value="1,257" sub="Daily chart" tone="good" spark={mid}/>
   <Stat label="Sales" value="54,520" sub="Total orders" tone="good" spark={up}/>
  </Grid>
  <Grid cols="2">
   <Card title="Quick Access"><div className="bd-numbers"><div><b>6</b><span>Revenue</span></div><div><b>73</b><span>Hours</span></div><div><b>1,260</b><span>Posts</span></div></div></Card>
   <Card title="Data Ingestion"><Prog label="Total Throughput" value={40} tone="good"/></Card>
   <Card title="Data Revenue"><Prog label="Revenue" value={70} tone="warn"/><Prog label="Environment" value={10}/></Card>
   <Card title="Techniques"><Prog label="First weeks" value={50} tone="good"/><Prog label="Last month" value={90} tone="good"/></Card>
  </Grid>
 </div>;
}

/** 02 AI Mastery */
export function AiMasteryBoard():ReactElement{
 return <div className="bd-stack">
  <Grid cols="3">
   <Stat label="AI Model" value="1.94" sub="Model index" spark={up}/>
   <Stat label="Performance" value="1,257" sub="Evaluation runs" tone="good" spark={mid}/>
   <Stat label="Sessions" value="54,520" sub="Total interactions" tone="good" ring={90}/>
  </Grid>
  <Grid cols="2">
   <Card title="Quick Access"><div className="bd-numbers"><div><b>6</b><span>Courses</span></div><div><b>73</b><span>Hours</span></div><div><b>1,360</b><span>Prompts</span></div></div></Card>
   <Card title="Data Ingestion"><Prog label="Total Throughput" value={40} tone="good"/></Card>
   <Card title="Data Revenue"><Prog label="Revenue" value={70} tone="warn"/><Prog label="Environment" value={10}/></Card>
   <Card title="Techniques"><Prog label="First weeks" value={50} tone="good"/><Prog label="Last month" value={90} tone="good"/></Card>
  </Grid>
 </div>;
}

const agents=['T.H.E.L.M.A.','H.E.N.R.Y.','L.I.L.Y.'];
const days=['M','T','W','T','F','S','S'];
const fills=[[0,1,0,1,1,0,1,0,0,1,0,0,1,1],[1,0,1,0,0,1,0,1,1,0,0,1,0,0],[0,0,1,1,0,0,1,0,1,0,1,0,0,1]];

/** 03 Agent Hub (layout A) and the alternate Assignment layout (B) */
export function AgentHubBoard():ReactElement{
 const[layout,setLayout]=useState<'A'|'B'>('A');
 return <div className="bd-stack">
  <div className="bd-tabs" role="group" aria-label="Agent Hub layout">{(['A','B']as const).map(k=><button key={k} type="button" aria-pressed={layout===k} onClick={()=>setLayout(k)}>{k==='A'?'Layout A · Task Assignment':'Layout B · Weekly Assignment'}</button>)}</div>
  {layout==='A'?<>
   <Grid cols="3">{agents.map((a,i)=><Card key={a} title={a} sub="Task Assignment" right={<StatusPill status={i===1?'ATTENTION':'HEALTHY'}/>}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,textAlign:'center',fontSize:11}}>{days.map((d,k)=><b key={k} style={{color:'var(--bd-muted)'}}>{d}</b>)}{fills[i].map((f,k)=><span key={k} style={{height:22,borderRadius:4,background:f?'var(--bd-accent)':'var(--bd-soft)',opacity:f?(i===2?.55:.9):1,border:'1px solid var(--bd-line)'}}/>)}</div>
   </Card>)}</Grid>
   <Grid cols="21">
    <Card title="Conversation Log"><div className="bd-field" style={{minHeight:74,alignItems:'flex-start'}}>Conversation log · T.H.E.L.M.A. confirmed the weekly publishing plan.</div><div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}><button type="button" className="bd-btn">Send</button></div></Card>
    <Card title="Agent Health Telemetry"><BarChart series={[[3,5,4,6,7,5],[2,3,3,2,4,3]]} labels={['Mon','Tue','Wed','Thu','Fri','Sat']} tones={['accent','good']} h={110}/></Card>
   </Grid>
  </>:<Grid cols="211">
   <Card title="Tasks Assignment">{['Assigned task 1','Content review','Media sorting','Lead follow-up','Report draft','Data validation'].map((t,i)=><div className="bd-row" key={t}><Avatar name={t} index={i}/><div className="grow"><b>{t}</b></div></div>)}</Card>
   <Card title="Weekly Status"><div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4,textAlign:'center',fontSize:12}}>{['M','T','W','T','F'].map((d,i)=><b key={i}>{d}</b>)}{Array.from({length:25},(_,i)=>{const s=(i*7+3)%5;return<span key={i} style={{padding:'4px 0',borderRadius:4,fontWeight:700,background:s===1?'#ee7b78':s===3?'#f2c35b':'#58c797',color:'#10131f'}}>{s===1?'✕':'✓'}</span>})}</div></Card>
   <div className="bd-stack"><Card title="Status"><Prog label="Assigned" value={80} tone="good"/><Prog label="Pending" value={50} tone="warn"/><Prog label="Published" value={30}/></Card><Card title="Agent Health"><AreaChart values={[3,4,3,6,5,7,6,8]} h={70}/></Card></div>
  </Grid>}
 </div>;
}

const kcards=(prefix:string,tones:('warn'|'good'|'info'|'bad'|'plain')[])=>tones.map((t,i)=><div key={i} className={`bd-kcard ${t}`}>{prefix} {i+1}<small>{15-i*3} minutes ago</small></div>);
/** 04 Leads Pipeline */
export function LeadsPipelineBoard():ReactElement{
 return <Grid cols="21">
  <Card title="Lead Pipeline" right={<Pill tone="muted">Sort by: Stage</Pill>}>
   <div className="bd-kanban">
    <div className="bd-stack" style={{gap:8}}><b>Lead Card</b>{kcards('Lead Card',['warn','good','plain'])}</div>
    <div className="bd-stack" style={{gap:8}}><b>Conversions</b>{kcards('Lead Card',['good','bad','info'])}</div>
    <div className="bd-stack" style={{gap:8}}><b>Pipelines</b>{kcards('Lead Card',['warn','good'])}<div className="bd-field">+ Add</div></div>
   </div>
  </Card>
  <div className="bd-stack">
   <Card title="Conversion Rate" sub="Conversion rate"><AreaChart values={[2,3,3,5,4,6,7,9]} labels={['2022','2023','2024','2025']} tone="good" h={100}/></Card>
   <Card title="Revenue Forecast"><AreaChart values={[2,3,4,5,6,8,9,10]} second={[1,2,3,3,4,5,6,7]} labels={['2022','2023','2024','2025']} h={100}/></Card>
  </div>
 </Grid>;
}

/** 05 Content Engine */
export function ContentEngineBoard():ReactElement{
 const titles=['Video · Hero reel','Video / Image · Filter test','Video / Images · Set A','Video · Outtakes'];
 return <div className="bd-stack">
  <Card title="Content" right={<div className="bd-field" style={{minWidth:160}}>Search</div>}>
   <Grid cols="4">{titles.map((t,i)=><div key={t}><Thumb index={i} play label={t} height={84}/><b style={{display:'block',marginTop:6}}>{t}</b><small>{i+2} minutes ago</small></div>)}</Grid>
  </Card>
  <Card title="Media / Assets">
   <Grid cols="4">{['Video / Image · Mixed','Video / Image · Images','Video / Image · Clip'].map((t,i)=><div key={t}><Thumb index={i+4} play={i!==1} label={t} height={84}/><b style={{display:'block',marginTop:6}}>{t}</b><small>{i+5} minutes ago</small></div>)}<div className="bd-field" style={{height:84,justifyContent:'center',borderStyle:'dashed'}}>+ Add media</div></Grid>
  </Card>
 </div>;
}

const feed=[['Cora Nias','Live feed integration update, 3 minutes ago'],['Mireille Stone','Scheduled post confirmed for tonight'],['Dorian Vale','Comment thread needs a reply']];
/** 06 Social Media */
export function SocialMediaBoard():ReactElement{
 return <Grid cols="211">
  <Card title="Live Feed Integration">{feed.map(([n,t],i)=><div className="bd-row" key={n}><Avatar name={n} index={i}/><div className="grow"><b>{n}</b><small>{t}</small></div></div>)}<Thumb index={1} label="Live feed preview" height={90}/></Card>
  <Card title="Multi-Account Post">{feed.map(([n,t],i)=><div className="bd-row" key={n}><Avatar name={n} index={i+2}/><div className="grow"><b>{n}</b><small>{t}</small></div><Pill tone={i===1?'warn':'good'}>{i===1?'Scheduled':'Posted'}</Pill></div>)}</Card>
  <div className="bd-stack">
   <Card title="Aggregate"><div className="bd-numbers"><div><b>6</b><span>Reach</span></div><div><b>73</b><span>Hours</span></div><div><b>1,260</b><span>Posts</span></div></div><div className="bd-numbers" style={{marginTop:10}}><div><b>0</b><span>Replies</span></div><div><b>3</b><span>Segments</span></div><div><b>28</b><span>Queued</span></div></div></Card>
   <Card title="Engagement Metrics"><Prog label="Reach" value={50} tone="good"/><Prog label="This week" value={70} tone="good"/><Prog label="Engagement" value={10} tone="warn"/><Prog label="Last month" value={50} tone="good"/></Card>
  </div>
 </Grid>;
}

const heatColors=['#3b7de0','#7fb6e8','#f4d58a','#f0a05a','#d9514e'];
/** 07 Trends */
export function TrendsBoard():ReactElement{
 return <Grid cols="3">
  <Card title="Trend Analysis"><AreaChart values={[3,5,4,6,5,7,6,8]} second={[2,3,4,3,5,4,6,5]} labels={['May','Jul','Sep','Nov','Jan','Jun']} h={110}/></Card>
  <Card title="Trend Analysis"><BarChart series={[[3,4,5,4,6],[2,3,2,4,3]]} labels={['2014','2015','2016','2017','2018']} tones={['accent','good']} h={110}/></Card>
  <Card title="Predictive Modeling"><AreaChart values={[2,3,3,4,5,6,7,9]} labels={['1995','2001','2020','2023','2034']} h={110} forecastFrom={4}/></Card>
  <Card title="System Status"><Prog label="Content Index" value={70} tone="good"/><Prog label="Progress Balance" value={70} tone="good"/><Prog label="Risk Shift" value={50} tone="warn"/></Card>
  <Card title="Trend Analysis"><BarChart series={[[3,5,4,6,5],[2,3,4,2,3]]} labels={['2021','2022','2023','2024','2025']} tones={['accent','info']} h={110}/></Card>
  <Card title="Global Shift Heatmap"><div className="bd-heatmap" role="img" aria-label="Regional shift heatmap">{Array.from({length:60},(_,i)=><i key={i} style={{background:heatColors[(Math.floor(i/12)*3+(i%12)*7)%5]}}/>)}</div><small>Cooler = lower shift, warmer = higher shift</small></Card>
 </Grid>;
}

const hub=[['Centralized Messages Hub','Messages across all channels'],['MultiAgent chat agents','Agent-to-agent threads'],['Communication agents','Routing and replies'],['Communication Logs','History and receipts']];
const logs:[string,string,'good'|'warn'|'info'][]=[['Cora Nias','2 minutes ago','good'],['Sema Nonlan','2 minutes ago','info'],['Sonya Acton','2 minutes ago','good'],['Paora Malm','3 minutes ago','warn'],['Matoo Resnano','3 minutes ago','info']];
/** 08 Communications */
export function CommunicationsBoard():ReactElement{
 return <Grid cols="3">
  <Card title="Message Hub">{hub.map(([t,s],i)=><div className="bd-row" key={t}><span className="bd-avatar" style={{background:i===0?'var(--bd-accent)':'#9aa1b8'}} aria-hidden="true">{i+1}</span><div className="grow"><b>{t}</b><small>{s}</small></div></div>)}</Card>
  <Card title="MultiAgent Chat"><div className="bd-chat"><div className="bd-msg">Hey, are the scheduled messages ready to go out?</div><div className="bd-msg me">Yes. The centralized messages are queued for review.</div><div className="bd-msg">Great, please log the confirmation.</div><div className="bd-field">Send a message…</div></div></Card>
  <Card title="Communication Logs">{logs.map(([n,t,tone],i)=><div className="bd-row" key={n}><Avatar name={n} index={i}/><div className="grow"><b>{n}</b><small>{t}</small></div><Pill tone={tone}>{tone==='good'?'Resolved':tone==='warn'?'Pending':'Received'}</Pill></div>)}</Card>
 </Grid>;
}
