import { useState } from 'react';

type Row = Record<string, any>;
const fields = [['location','Location'],['date','Story date'],['timezone','Timezone'],['time_of_day','Time of day'],['terrain','Terrain / architecture'],['weather','Weather'],['lighting','Lighting'],['camera','Camera framing and movement'],['action','Action / interactions'],['end_state','Required ending state'],['evidence','Location / historical reference notes']];
const events = [['rain','Rain'],['traffic','Passing cars'],['pedestrians','Pedestrians'],['birds','Birds'],['insects','Insects'],['baby','Baby crying'],['garbage_truck','Garbage truck'],['splashes','Water splashes']];

export default function SceneSetup({projects, disabled, onSave, onUse}: {projects:Row[]; disabled:boolean; onSave:(body:Row)=>Promise<void>; onUse:(id:string)=>void}) {
  const [title,setTitle] = useState('');
  const [state,setState] = useState<Row>({});
  const [parent,setParent] = useState('');
  const scenes = projects.filter(p => p.settings?.production_scene);
  function updateEvent(type:string, values:Row) {
    setState(s => ({...s,events:events.map(([key]) => ({type:key,...(s.events || []).find((e:Row)=>e.type===key),...(key===type?values:{})}))}));
  }
  return <>
    <h2>Scenes</h2><p className="sub">Define the world and ending state before creating the shot. Reuse a saved scene or save a new revision.</p>
    <div className="workbench"><div className="bar">
      <label className="field">Scene title<input type="text" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} /></label>
      {fields.map(([key,label])=><label className="field" key={key}>{label}<textarea rows={2} style={{minHeight:70}} maxLength={1000} value={state[key] || ''} onChange={e=>setState(s=>({...s,[key]:e.target.value}))} /></label>)}
    </div><div className="bar"><h3>Environment and background</h3>
      <p className="stage-note">Visual choices direct a new generation. Audio choices are saved as a sound plan; they do not yet produce separate audio tracks. Removing an object from existing footage requires an editing/rendering step.</p>
      {events.map(([type,label])=>{const e=(state.events || []).find((e:Row)=>e.type===type)||{};return <div className="note" key={type}><b>{label}</b><div className="row"><label><input type="checkbox" checked={!!e.visible} onChange={x=>updateEvent(type,{visible:x.target.checked})} /> Visible</label><label><input type="checkbox" checked={!!e.audible} onChange={x=>updateEvent(type,{audible:x.target.checked})} /> Sound planned</label></div><label className="field">Species, timing, path or interaction<input type="text" maxLength={300} value={e.notes || ''} onChange={x=>updateEvent(type,{notes:x.target.value})} /></label></div>})}
      <p className="stage-note">Check species, season and location before approval. These directions target cinematic plausibility; they are not a validated physics simulation.</p>
    </div></div>
    <div className="submit"><button className="go" disabled={disabled || !title.trim()} onClick={()=>void onSave({title,scene:state,parent_scene_id:parent || undefined})}>Save scene version</button><button className="ghost" onClick={()=>{setTitle('');setState({});setParent('')}}>New scene</button></div>
    <h3>Saved scene versions</h3><div className="grid">{scenes.map(p=><article key={p.id} className="card"><div className="meta"><b>{p.title}</b><p>{p.settings.production_scene.location || 'Location not set'} · {new Date(p.created_at).toLocaleString()}</p><div className="row"><button className="ghost" onClick={()=>{setTitle(p.title);setState(p.settings.production_scene);setParent(p.id)}}>Open / revise</button><button className="go" onClick={()=>onUse(p.id)}>Use in Create</button></div></div></article>)}</div>
  </>;
}
