import { createClient } from '@supabase/supabase-js';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

function json(res, status, body) { return res.status(status).json(body); }
function ffmpeg(args) {
  return new Promise((resolve,reject) => {
    if (!ffmpegPath) return reject(new Error('Continuity extraction runtime unavailable'));
    const child=spawn(ffmpegPath,['-hide_banner','-loglevel','error',...args],{stdio:['ignore','ignore','pipe']});
    let detail='';
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Continuity extraction timed out'));},45000);
    child.stderr.on('data',data=>{detail=(detail+data).slice(-2000)});
    child.on('error',e=>{clearTimeout(timer);reject(e)});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Continuity extraction failed: '+detail.replace(/https?:\/\/\S+/g,'[media URL]')))});
  });
}

export default async function handler(req,res) {
  if(req.method==='GET') {
    let ready=false;try{ready=Boolean(ffmpegPath&&(await fs.stat(ffmpegPath)).isFile())}catch{}
    return json(res,ready?200:503,{ok:ready,version:'2.02',service:'visionweaver-continuity',binary_ready:ready});
  }
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
  if(!token)return json(res,401,{ok:false,error:'production_sign_in_required'});
  const id=String(req.body?.generation_id||'');
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))return json(res,400,{ok:false,error:'invalid_generation_id'});
  const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return json(res,503,{ok:false,error:'storage_not_configured'});
  const db=createClient(url,key,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:auth,error:authError}=await db.auth.getUser(token);
  if(authError||!auth.user)return json(res,401,{ok:false,error:'production_sign_in_required'});
  const owner=auth.user.id;
  const {data:g,error}=await db.from('vw_generations').select('*').eq('id',id).eq('owner_id',owner).maybeSingle();
  if(error)return json(res,500,{ok:false,error:'generation_lookup_failed'});
  if(!g)return json(res,404,{ok:false,error:'generation_not_found'});
  if(g.media_type!=='video'||g.status!=='complete'||g.result?.partial)return json(res,409,{ok:false,error:'completed_video_required'});
  if(g.operation==='multi_shot_video'&&g.result?.assembly?.state!=='master_ready')return json(res,409,{ok:false,error:'assemble_sequence_before_extracting_its_ending'});
  const source=g.storage_paths?.[0];
  if(!source||!source.startsWith(owner+'/'))return json(res,409,{ok:false,error:'durable_owned_video_required'});
  const fingerprint=crypto.createHash('sha256').update(source+'|full-ending-v2.02').digest('hex').slice(0,24);
  const framePath=`${owner}/continuity/${fingerprint}/last-frame.png`;
  const tailPath=`${owner}/continuity/${fingerprint}/motion-tail.mp4`;
  const {data:existing}=await db.from('vw_assets').select('*').eq('owner_id',owner).eq('storage_path',framePath).limit(1).maybeSingle();
  if(existing)return json(res,200,{ok:true,asset:existing,reused:true});
  let dir;
  try {
    const {data:signed,error:signError}=await db.storage.from('visionweaver-outputs').createSignedUrl(source,600);
    if(signError||!signed?.signedUrl)throw new Error('Unable to access saved video');
    dir=await fs.mkdtemp(path.join(os.tmpdir(),'vw-continuity-'));
    const tail=path.join(dir,'tail.mp4'),frame=path.join(dir,'frame.png');
    await ffmpeg(['-sseof','-2','-i',signed.signedUrl,'-t','2','-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','ultrafast','-crf','18','-c:a','aac','-movflags','+faststart','-y',tail]);
    await ffmpeg(['-i',tail,'-vf','reverse','-frames:v','1','-y',frame]);
    for(const [local,remote,type] of [[tail,tailPath,'video/mp4'],[frame,framePath,'image/png']]) {
      const {error:uploadError}=await db.storage.from('visionweaver-outputs').upload(remote,await fs.readFile(local),{contentType:type,upsert:false});
      if(uploadError&&String(uploadError.statusCode)!=='409')throw new Error('Continuity media could not be saved');
    }
    const metadata={role:'continuity_terminal_frame',production_version:'2.02',source_generation_id:g.id,source_storage_path:source,motion_tail_storage_path:tailPath,endpoint:'full_clip_end',requested_tail_seconds:2,character_snapshot:g.parameters?.character_snapshot||null,scene_snapshot:g.parameters?.scene_snapshot||null,review_status:'needs_review',extracted_at:new Date().toISOString()};
    const {data:asset,error:insertError}=await db.from('vw_assets').insert({owner_id:owner,project_id:g.project_id,generation_id:g.id,kind:'image',title:'Ending reference: '+String(g.prompt).slice(0,70),storage_path:framePath,mime_type:'image/png',metadata}).select('*').single();
    if(insertError)throw new Error('Continuity asset record could not be saved');
    return json(res,201,{ok:true,asset,reused:false});
  } catch(e) {return json(res,500,{ok:false,error:String(e.message||e).slice(0,800)})}
  finally {if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>{})}
}
