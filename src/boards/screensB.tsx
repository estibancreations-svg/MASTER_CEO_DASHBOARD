import type{ReactElement}from'react';
import{AreaChart,Avatar,BarChart,Card,DataTable,Donut,Grid,Heat,HBars,Pill,Prog,Stat,StatusPill,Thumb}from'./primitives';
import type{Status}from'./primitives';

const people=['Genteen Brniare','Anason Sinston','Client Wirldoson','Bosin Netlnon','Doheso Stolnon','Dania Beronn','Cleon Starson'];
/** 09 CRM */
export function CrmBoard():ReactElement{
 const actions=['Lead 1 Management','Lead 3 Assignment','Lead Tirentoar Management','Lead 3 Client Management','Lead 3 Action Manage','Lead 8 Hilist Management','Task 3 Task Management'];
 const tasks:['Next'|'Waiting'|'Done'|'Blocked','warn'|'info'|'good'|'bad'][]=[['Next','warn'],['Waiting','info'],['Done','good'],['Blocked','bad'],['Done','good'],['Next','warn'],['Waiting','info']];
 return <Grid cols="4">
  <Card title="Client Profiles">{people.map((p,i)=><div className="bd-row" key={p}><Avatar name={p} index={i}/><div className="grow"><b>{p}</b><small>{i+2} months ago</small></div></div>)}</Card>
  <Card title="Action History">{actions.map(a=><div className="bd-row" key={a}><div className="grow"><b>{a}</b></div></div>)}</Card>
  <Card title="Task Assignment">{tasks.map(([t,tone],i)=><div className="bd-row" key={i}><div className="grow"><b>{actions[i].split(' ').slice(0,2).join(' ')}</b></div><Pill tone={tone}>{t}</Pill></div>)}</Card>
  <Card title="Task History">{['Autonomous follow-up','Connected call','Add note','Add status','Connected email','Add reminder','Add contact'].map(t=><div className="bd-row" key={t}><div className="grow"><b>{t}</b></div></div>)}</Card>
 </Grid>;
}

/** 10 Products */
export function ProductsBoard():ReactElement{
 const rows=[['Product #1','$15,000','$12.58',6.55],['Product #2','$12,900','$9.99',6.55],['Product #3','$15,000','$3.70',0.45],['Product #4','$15,000','$5.15',6.26],['Product #5','$16,000','$1.50',6.25],['Product #6','$15,000','$3.38',-6.55],['Product Request','$18,000','$1.50',-6.55],['Product Request #5','$15,000','$13.59',-6.55]];
 return <Grid cols="21">
  <Card title="Inventory" right={<div className="bd-field" style={{minWidth:150}}>Search</div>}>
   <DataTable cols={['Product','Amount','Price','Status']} rows={rows.map(([n,a,p,s])=>[<b key="n">{n}</b>,a,p,<Pill key="s" tone={(s as number)>=0?'good':'bad'}>{(s as number)>=0?'+':''}{s}%</Pill>])}/>
  </Card>
  <div className="bd-stack">
   <Card title="Product Lifecycle"><AreaChart values={[2,3,4,4,6,7,9,10]} second={[1,2,2,3,4,4,5,6]} labels={['2001','2003','2005','2007']} h={110}/></Card>
   <Card title="Feature Requests"><Prog label="Feature request" value={70} tone="good"/><Prog label="Feature requests" value={50}/><Prog label="Feature request" value={30} tone="warn"/><div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}><button type="button" className="bd-btn ghost">Cancel</button><button type="button" className="bd-btn">Save</button></div></Card>
  </div>
 </Grid>;
}

/** 11 Finance */
export function FinanceBoard():ReactElement{
 return <Grid cols="3">
  <Card title="Revenue" right={<Pill tone="good">+135.00%</Pill>}>
   <div className="bd-stat"><strong>$1,750,350</strong></div>
   <DataTable cols={['Product','Amount','Price']} rows={[['Revenue','$140,000','$156,500'],['Reports','$15,000','$12,500'],['Subcontracts','$15,000','$15,300'],['Bestowments','$15,000','$12,300'],['Expenses','$5,000','$4,900'],['Totals','$10,000','$15,500'],['Total Revenue','$1,000','$1,600']]}/>
  </Card>
  <div className="bd-stack">
   <Card title="Revenue Breakdown"><BarChart series={[[3,4,5,6,7],[2,2,3,4,3]]} labels={['2014','2014','2015','2000','2005']} tones={['accent','good']} h={110}/></Card>
   <Card title="Expense Categories"><HBars rows={[{label:'Expense',value:90,tone:'bad',text:'$165,000'},{label:'Expenses',value:45,tone:'info',text:'$35,000'},{label:'Costs',value:30,tone:'warn',text:'$3,900'},{label:'Other',value:25,tone:'good',text:'$3,900'}]}/></Card>
  </div>
  <div className="bd-stack">
   <Card title="Expense Categories"><Prog label="Oritest Storage" value={90} tone="good" right="$165.00%"/><Prog label="Progress Balance" value={72} tone="info" right="190.00%"/><Prog label="Raien Swift" value={50} tone="warn" right="80%"/></Card>
   <Card title="Budget Tracking"><div style={{display:'flex',alignItems:'center',gap:14}}><Donut value={38} size={86} label="Budget used"/><div><b>38% Budget</b><small style={{display:'block'}}>Used this period</small></div></div></Card>
  </div>
 </Grid>;
}

const servers:[string,Status][]=[['Server Aria','HEALTHY'],['Server Boone','ATTENTION'],['Server Ciro','HEALTHY'],['Server Dahl','CRITICAL']];
/** 12 System Audit */
export function SystemAuditBoard():ReactElement{
 return <Grid cols="3">
  <Card title="Live Servers" right={<Pill tone="muted">All Brs</Pill>}>
   <div className="bd-numbers" style={{marginBottom:10}}><div><b>8</b><span>Live now</span></div><div><b>1</b><span>Status</span></div><div><b>598</b><span>Last hour</span></div></div>
   {servers.map(([n,s])=><div className="bd-row" key={n}><div className="grow"><b>{n}</b></div><StatusPill status={s}/></div>)}
  </Card>
  <div className="bd-stack">
   <Card title="Log Entry Feeds">{[['Log entry · configuration changed','3:33 PM'],['Log entry · policy checked','3:52 PM'],['Log entry · access reviewed','3:33 PM']].map(([t,time])=><div className="bd-row" key={t+time}><span className="bd-avatar" style={{background:'var(--bd-good)'}} aria-hidden="true">✓</span><div className="grow"><b>{t}</b><small>{time}</small></div></div>)}</Card>
   <Card title="Event Timelines">{[['11:35 AM','Scheduled event ran cleanly'],['11:33 AM','Escalation opened']].map(([t,d])=><div className="bd-row" key={t}><b>{t}</b><div className="grow">{d}</div></div>)}</Card>
  </div>
  <div className="bd-stack">
   <Card title="Critical Alerts">{[1,2].map(i=><div key={i} className="bd-kcard bad" style={{marginBottom:8}}>Critical alert<small>Review required before the next release gate</small></div>)}</Card>
   <Card title="Other Alerts">{[['Critical status · live data','warn'],['Centralized alert · queued','info'],['Communication alert · delayed','warn']].map(([t,tone])=><div className="bd-row" key={t}><div className="grow">{t}</div><Pill tone={tone as 'warn'|'info'}>Open</Pill></div>)}</Card>
  </div>
 </Grid>;
}

/** 13 Certificates */
export function CertificatesBoard():ReactElement{
 return <Grid cols="12">
  <Card title="Gallery"><div className="bd-nav"><span className="on">Certificates</span><span>Gallery</span><span>Compliance Badges</span><span>Printed Records</span></div></Card>
  <div className="bd-stack">
   <Grid cols="4">{['Verified Certificate','Verified Certificate','Compliance Badge','Verified Certificate'].map((t,i)=><Card key={i} className="bd-neon" style={{textAlign:'center'}}><div style={{height:70,border:'2px solid var(--bd-line)',borderRadius:6,display:'grid',placeItems:'center',background:'var(--bd-soft)'}}>{i===2?<Pill tone="good">VERIFIED</Pill>:<span aria-hidden="true">✦</span>}</div><b style={{display:'block',marginTop:6}}>{t}</b><small>{(i+1)*3} months ago</small></Card>)}</Grid>
   <Card title="Intellectual Property Records">{[['Asset A','3 months ago'],['SOOP','4 months ago'],['Intellectual Property','4 months ago']].map(([t,d])=><div className="bd-row" key={t}><div className="grow"><b>{t}</b><small>{d}</small></div><Pill tone="info">Record</Pill></div>)}</Card>
  </div>
 </Grid>;
}

/** 14 Settings */
export function SettingsBoard():ReactElement{
 const prefs:[string,boolean][]=[['Security settings',false],['Security preferences',true],['Access integration',true],['Notification options',true]];
 return <Grid cols="13">
  <Card title="Settings"><div className="bd-nav"><span className="on">Profile</span><span>Security</span><span>Presets</span><span>Integrations</span><span>Settings</span></div></Card>
  <Grid cols="2">
   <div className="bd-stack">
    <Card title="Profile Settings"><div className="bd-row"><Avatar name="Builder Preview"/><div className="grow"><b>Builder Preview</b><small>name@example.com</small></div><Pill tone="accent">Profile</Pill></div></Card>
    <Card title="Security Preferences">{prefs.map(([t,on],i)=><div className="bd-row" key={t}><div className="grow">{t}</div><span className={`bd-toggle ${on?'on':''}`} role="switch" aria-checked={on} aria-label={t}><i/></span></div>)}</Card>
   </div>
   <div className="bd-stack">
    <Card title="Integration">{[['Customize notifications',true],['Dropped email',false],['Unknown options',false]].map(([t,on])=><div className="bd-row" key={String(t)}><div className="grow">{t}</div><span className={`bd-toggle ${on?'on':''}`} role="switch" aria-checked={Boolean(on)} aria-label={String(t)}><i/></span></div>)}</Card>
    <Card title="Notifications">{['Notification digest','Notification alerts'].map(t=><div className="bd-row" key={t}><div className="grow">{t}</div><span className="bd-toggle on" role="switch" aria-checked="true" aria-label={t}><i/></span></div>)}</Card>
   </div>
  </Grid>
 </Grid>;
}

const team:[string,Status,string][]=[['Avatar one','PENDING_APPROVAL','Avatars'],['Avatar two','HEALTHY','Status'],['Avatar three','HEALTHY','Status'],['Avatar four','ATTENTION','Status']];
/** 15 Team Overview */
export function TeamOverviewBoard():ReactElement{
 return <Grid cols="21">
  <Card title="Avatars" right={<Pill tone="muted">Locations</Pill>}>
   <Grid cols="4">{team.map(([n,s],i)=><div key={n} style={{textAlign:'center',padding:10,border:i===0?'1px solid var(--bd-accent)':'1px solid var(--bd-line)',borderRadius:8,background:i===0?'var(--bd-soft)':'transparent'}}><Avatar name={n} index={i}/><b style={{display:'block',margin:'6px 0'}}>{n}</b><StatusPill status={s}/></div>)}</Grid>
  </Card>
  <div className="bd-stack">
   <Card title="Status">{team.map(([n,s],i)=><div className="bd-row" key={n}><Avatar name={n} index={i}/><div className="grow"><b>{n}</b><small>Workload {40+i*15}%</small></div></div>)}</Card>
   <Card title="Budget Chart"><BarChart series={[[3,4,5,6]]} labels={['Q1','Q2','Q3','Q4']} h={90}/></Card>
  </div>
 </Grid>;
}

/** 16 Video Storyboard */
export function VideoStoryboardBoard():ReactElement{
 return <Card title="Timeline" right={<Pill tone="muted">All Brs</Pill>}>
  <div style={{display:'grid',gridTemplateColumns:'110px repeat(4,minmax(0,1fr))',gap:10,alignItems:'center'}}>
   <b>Video</b>{[1,2,3,4].map(i=><div key={i}><Thumb index={i} play label={`Video thumbnail ${i}`} height={64}/><small>Video Thumbnail {i}</small></div>)}
   <b>Timeline</b><div style={{gridColumn:'2 / -1',height:14,borderRadius:7,background:'var(--bd-soft)',border:'1px solid var(--bd-accent)'}}/>
   {[1,2,3].map(t=><div key={t} style={{display:'contents'}}><b>Content Track {t}</b>{[1,2,3,4].map(i=><div key={i} style={{height:22,borderRadius:5,background:'var(--bd-soft)',border:'1px solid var(--bd-line)'}}/>)}</div>)}
  </div>
 </Card>;
}

/** 17 Social Analytics */
export function SocialAnalyticsBoard():ReactElement{
 return <div className="bd-stack">
  <Grid cols="3">
   <Card title="Advanced Charts"><BarChart series={[[3,4,5,6,7,8],[1,2,2,3,3,4]]} line={[2,3,4,5,6,8]} labels={['2012','2018','2020','2030','2022','2025']} tones={['accent','good']} h={110}/></Card>
   <Card title="Followers Growth" right={<Pill tone="good">+135.05%</Pill>}><BarChart series={[[2,3,4,5,6,7],[1,1,2,2,3,3]]} line={[2,3,3,5,6,8]} labels={['2013','2019','2019','2020','2022','2025']} tones={['accent','good']} h={110}/></Card>
   <Card title="Follower Growth"><div className="bd-numbers" style={{gridTemplateColumns:'1fr 1fr',textAlign:'left'}}><div><span>Followers</span><b>+ 1.35K</b></div><div><span>Engagements</span><b>+ 1.0%</b></div></div><Prog label="Growth" value={85} tone="good" right=""/><div style={{marginTop:8}}><span className="bd-label">Engagement Rate</span><b style={{display:'block',fontSize:22}}>3.00%</b></div></Card>
  </Grid>
  <Grid cols="3">
   <Card title="Engagement Rate"><BarChart series={[[3,5,4,6,2,7]]} labels={['2015','2018','2019','2020','2023','2025']} h={100}/></Card>
   <Card title="Engagement Rates"><div style={{display:'flex',gap:20,justifyContent:'center'}}><div style={{textAlign:'center'}}><Donut value={30} size={84} label="Followers"/><small style={{display:'block'}}>Followers</small></div><div style={{textAlign:'center'}}><Donut value={58} size={84} tone="good" label="Rate"/><small style={{display:'block'}}>Rate</small></div></div></Card>
   <Card title="Platform Specific Analytics"><HBars rows={[{label:'Twitter',value:95,tone:'bad',text:'95%'},{label:'Facebook',value:45,tone:'info',text:'45%'},{label:'Instagram',value:25,tone:'warn',text:'25%'},{label:'YouTube',value:12,tone:'bad',text:'12%'}]}/></Card>
  </Grid>
 </div>;
}

/** 18 Lead Scoring Rules */
export function LeadScoringBoard():ReactElement{
 return <Grid cols="211">
  <Grid cols="2">
   <Card title="Rules"><div className="bd-nav"><span className="on">Configuration</span><span>Security</span><span>Security</span><span>Integrations</span><span>Settings</span></div></Card>
   <Card title="Rules Configuration"><div className="bd-field">Detailed Rules</div>{[['Weighted Criteria',50],['Weighted Criteria 2',50],['Weighted Criteria',20],['Weighted Criteria',23]].map(([t,v],i)=><div key={i} style={{marginTop:12}}><div style={{display:'flex',justifyContent:'space-between'}}><b>{t}</b><span className="bd-pill muted">{v}</span></div><Prog label={String(t)} value={Number(v)} right=""/></div>)}</Card>
  </Grid>
  <Card title="Scoring Metrics"><DataTable cols={['Rules','Weighted','Scoring']} rows={[['Scoring qualification',1,0],['Scoring dotation',2,1],['Detailed rules',3,0]]}/></Card>
  <Card title="Scoring Matrices"><Heat rows={['Low','A','B','Max']} cols={['0','1','2','3']} cells={[[1,2,3,4],[1,2,4,5],[1,1,2,4],[1,1,2,3]]}/></Card>
 </Grid>;
}
