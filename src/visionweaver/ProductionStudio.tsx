import {useState} from 'react';
import {supabase} from '../lib/supabase';
import {useIdentity} from '../auth/IdentityContext';
import type {VWData} from './types';

/** Authenticated, explicitly user-triggered operations. No provider spend on page load. */
export default function ProductionStudio({data,refresh}:{data:VWData;refresh:()=>Promise<void>}){
 const identity=useIdentity();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [title,setTitle]=useState(''),[prompt,setPrompt]=useState('');
 const [mediaType,setMediaType]=useState('video'),[duration,setDuration]=useState('5');
 const [continuityMode,setContinuityMode]=useState('extend_previous_scene');
 const [bookTitle,setBookTitle]=useState(''),[chapterText,setChapterText]=useState('');
 const [characterName,setCharacterName]=useState(''),[visualAnchor,setVisualAnchor]=useState('');
 const [assetPath,setAssetPath]=useState(''),[assetTitle,setAssetTitle]=useState('');
 const [assetKind,setAssetKind]=useState('image');
 const [ackSpend,setAckSpend]=useState(false);
 const signedIn=Boolean(supabase&&identity.user);
 const longForm=Number(duration)>10;
 async function call(body:Record<string,unknown>){
  if(!signedIn||!supabase){setMessage('Sign in to run production operations.');return}
  setBusy(true);setMessage('');
  try{
   const {data:res,error}=await supabase.functions.invoke('visionweaver-studio',{body});
   if(error)throw error;
   if(res?.ok===false)throw new Error(res.error||'Operation rejected');
   setMessage('Operation accepted by the authenticated studio backend. Refresh to verify the resulting record.');
   await refresh();
  }catch(e:any){setMessage('Operation failed: '+(e?.message||String(e)))}
  finally{setBusy(false);setAckSpend(false)}
 }
 const retryable=data.generations.filter((g:any)=>g.status==='failed'||g.result?.partial);
 const continuity=data.continuity_jobs[0];
 const capsule=data.continuity_capsules.find((x:any)=>x.source_generation_id===continuity?.generation_id);
 const ready=continuity?.dissection_state==='PASSED'&&continuity?.qc_state==='PASS'&&capsule?.approval_state==='LOCKED';
 const continuityBlocked=Boolean(continuity)&&!ready;
 const projectReady=prompt.trim().length>=8&&title.trim().length>0&&ackSpend&&signedIn&&!busy;
 const parameters={
  duration_seconds:Number(duration),
  total_seconds:Number(duration),
  continuity_mode: longForm ? continuityMode : 'reference',
  provider_shot_max_seconds: longForm ? 30 : 10
 };
 return <div className="vw-production">
  <section className="vw-panel"><header className="vw-panel-head"><h3>Live Production Studio</h3></header>
   <p>These controls call the authenticated VisionWeaver Studio backend. Creation may spend provider credits; no render starts without explicit confirmation.</p>
   <div className="vw-production-form">
    <label>Project title<input value={title} maxLength={160} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Media type<select value={mediaType} onChange={e=>setMediaType(e.target.value)}><option value="video">Video</option><option value="image">Image</option><option value="book">Book</option><option value="movie">Movie</option></select></label>
    <label>Duration<select value={duration} onChange={e=>setDuration(e.target.value)}>{[['5','5 seconds'],['10','10 seconds'],['30','30 seconds'],['60','1 minute'],['120','2 minutes'],['300','5 minutes'],['600', '10 minutes']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Continuation mode<select value={continuityMode} onChange={e=>setContinuityMode(e.target.value)}><option value="extend_previous_scene">Extend previous scene</option><option value="reference">Reference frames</option></select></label>
    <label className="wide">Prompt<textarea rows={4} value={prompt} onChange={e=>setPrompt(e.target.value)}/></label>
    <label className="wide"><input type="checkbox" checked={ackSpend} onChange={e=>setAckSpend(e.target.checked)}/> I authorize this generation and potential provider charges.</label>
    <button type="button" disabled={!projectReady} onClick={()=>void call({action: 'create',title,media_type:mediaType,prompt,parameters})}>Create project</button>
   </div>
  </section>
  <section className="vw-panel"><header className="vw-panel-head"><h3>Continuity & Automation</h3></header>
   <strong>{ready?'SHOT 02 READY':'SHOT 02 BLOCKED'}</strong>
   <p>{ready?'Locked capsule is available. Verify the reference frame before continuing.':'Shot 02 is blocked until the prior shot is dissected, QC passes and the continuity capsule is locked.'}</p>
   <p>Checks: dissection_state !== 'PASSED', qc_state !== 'PASS', approval_state === 'LOCKED'.</p>
   <button type="button" disabled={!signedIn||busy} onClick={()=>void call({action:'refresh'})}>Refresh continuity and generation status</button>
   {continuityBlocked&&<p>Continuation is disabled; no bypass is available here.</p>}
  </section>
  <section className="vw-panel"><header className="vw-panel-head"><h3>Failed generations</h3></header>
   {retryable.length===0?<p>No failed or partial generations reported.</p>:retryable.map((g:any)=><div className="vw-production-row" key={g.id}><span>{g.id} · {g.status}</span><button type="button" disabled={!signedIn||busy||!ackSpend} onClick={()=>void call({action: 'retry',generation_id:g.id})}>Retry (requires spend confirmation)</button></div>)}
  </section>
  <section className="vw-panel"><header className="vw-panel-head"><h3>Books and characters</h3></header><div className="vw-production-form">
   <label>Book title<input value={bookTitle} onChange={e=>setBookTitle(e.target.value)}/></label>
   <label className="wide">First chapter text<textarea rows={4} value={chapterText} onChange={e=>setChapterText(e.target.value)}/></label>
   <button type="button" disabled={!signedIn||busy||!bookTitle.trim()||!chapterText.trim()} onClick={()=>void call({action: 'import_book',title:bookTitle,chapters:[{title:'Chapter 1',text:chapterText}]})}>Import book</button>
   <label>Character name<input value={characterName} onChange={e=>setCharacterName(e.target.value)}/></label>
   <label>Visual anchor<input value={visualAnchor} onChange={e=>setVisualAnchor(e.target.value)}/></label>
   <button type="button" disabled={!signedIn||busy||!characterName.trim()} onClick={()=>void call({action: 'save_character',name:characterName,visual_anchor:visualAnchor,universe:'VisionWeaver'})}>Save new character</button>
  </div></section>
  <section className="vw-panel"><header className="vw-panel-head"><h3>Register existing private asset</h3></header>
   <p>Storage path must already exist inside your own user folder. This does not upload files.</p><div className="vw-production-form">
    <label>Private storage path<input value={assetPath} onChange={e=>setAssetPath(e.target.value)} placeholder="your-user-id/path/to/file"/></label>
    <label>Asset title<input value={assetTitle} onChange={e=>setAssetTitle(e.target.value)}/></label>
    <label>Asset kind<select value={assetKind} onChange={e=>setAssetKind(e.target.value)}><option>image</option><option>video</option><option>audio</option><option>document</option><option>book</option><option>movie</option></select></label>
    <button type="button" disabled={!signedIn||busy||!assetPath.trim()} onClick={()=>void call({action: 'register_asset',storage_path:assetPath,title:assetTitle,kind:assetKind})}>Register asset</button>
   </div>
  </section>
  {message&&<div role="status" className="vw-system-note">{message}</div>}
 </div>
}
