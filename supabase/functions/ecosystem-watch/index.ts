import{createClient}from'jsr:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const db=createClient(url,service,{auth:{persistSession:false}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,x-thelma-cron-secret'}});

async function authorized(req:Request){
 const cron=req.headers.get('x-thelma-cron-secret');
 if(cron){const{data}=await db.rpc('get_runtime_secret',{p_name:'THELMA_ECOSYSTEM_CRON_SECRET'});if(data&&cron===data)return{kind:'cron' as const,orgs:null};}
 const auth=req.headers.get('authorization');if(!auth)return null;
 const client=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const{data:{user}}=await client.auth.getUser();if(!user)return null;
 const{data:membership}=await client.from('ceo_organization_memberships').select('organization_id,status').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();
 return membership?{kind:'user' as const,orgs:[membership.organization_id]}:null;
}

function score(item:any){
 const stars=Number(item.stargazers_count||0),forks=Number(item.forks_count||0),issues=Number(item.open_issues_count||0);
 const pushed=item.pushed_at?Date.parse(item.pushed_at):0,days=pushed?Math.max(0,(Date.now()-pushed)/86400000):9999;
 const relevance=25,popularity=Math.min(25,Math.round(Math.log10(stars+1)*8)),adoption=Math.min(10,Math.round(Math.log10(forks+1)*4));
 const maintenance=days<=30?20:days<=90?15:days<=365?8:2,license=item.license?.spdx_id&&item.license.spdx_id!=='NOASSERTION'?10:0;
 const issueHealth=stars>0&&issues/stars<.08?10:stars>0&&issues/stars<.2?6:2;
 return{total:Math.min(100,relevance+popularity+adoption+maintenance+license+issueHealth),breakdown:{relevance,popularity,adoption,maintenance,license,issue_health:issueHealth,stars,forks,open_issues:issues,days_since_push:Math.round(days)}};
}

async function scanOrg(org:string,trigger:string){
 const{data:run,error:runError}=await db.from('ecosystem_scan_runs').insert({organization_id:org,triggered_by:trigger,status:'RUNNING'}).select().single();if(runError)throw runError;
 let sourcesScanned=0,candidatesSeen=0,advisements=0;const failures:string[]=[];
 const{data:sources,error:sourceError}=await db.from('ecosystem_watch_sources').select('*').eq('organization_id',org).eq('enabled',true).order('source_key').limit(8);if(sourceError)throw sourceError;
 const token=Deno.env.get('GITHUB_DISCOVERY_TOKEN');
 for(const source of sources||[]){
  try{
   const headers:Record<string,string>={'accept':'application/vnd.github+json','user-agent':'Estiban-THELMA-Ecosystem-Scout/1.0','x-github-api-version':'2022-11-28'};if(token)headers.authorization=`Bearer ${token}`;
   const response=await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(source.search_query)}&sort=stars&order=desc&per_page=5`,{headers});
   if(!response.ok)throw new Error(`github_${response.status}`);const payload=await response.json();sourcesScanned++;
   for(const item of payload.items||[]){
    candidatesSeen++;const scored=score(item);
    const{data:candidate,error:candidateError}=await db.from('ecosystem_candidates').upsert({organization_id:org,watch_source_id:source.id,system_key:source.system_key,repository:item.full_name,url:item.html_url,description:item.description,license_spdx:item.license?.spdx_id||null,stars:item.stargazers_count||0,forks:item.forks_count||0,open_issues:item.open_issues_count||0,last_pushed_at:item.pushed_at,score:scored.total,score_breakdown:scored.breakdown,last_seen_at:new Date().toISOString(),last_scan_run_id:run.id,evidence:{github_id:item.id,default_branch:item.default_branch,topics:item.topics||[],archived:Boolean(item.archived)}},{onConflict:'organization_id,repository'}).select().single();
    if(candidateError)throw candidateError;
    if(scored.total>=source.minimum_score){
     const recommendation=scored.total>=82?'ADAPT':'REFERENCE';
     const{data:advice,error:adviceError}=await db.from('ecosystem_advisements').upsert({organization_id:org,candidate_id:candidate.id,system_key:source.system_key,title:`Weekly ecosystem candidate: ${item.full_name}`,why_it_matters:`Scored ${scored.total}/100 for ${source.query_family}. Stars ${item.stargazers_count||0}; forks ${item.forks_count||0}; last push ${item.pushed_at||'unknown'}; license ${item.license?.spdx_id||'unverified'}.`,recommendation,decision_required:'CEO',status:'PENDING_REVIEW',evidence:{source_key:source.source_key,score:scored.total,score_breakdown:scored.breakdown,url:item.html_url,run_id:run.id}},{onConflict:'organization_id,candidate_id'}).select().single();
     if(adviceError)throw adviceError;advisements++;
     let approvalId=advice.approval_request_id as string|undefined;
     if(!approvalId){const{data:approval}=await db.from('thelma_approval_requests').insert({organization_id:org,requested_by_agent:'ECOSYSTEM_SCOUT',action_type:'ECOSYSTEM_EVALUATION',risk_tier:'medium',title:`Approve evaluation: ${item.full_name}`,description:`Approve a sandbox evaluation only. This does not authorize installation or production use. Score ${scored.total}/100.`,tool_key:'ecosystem:sandbox-evaluate',proposed_payload:{candidate_id:candidate.id,advisement_id:advice.id,repository:item.full_name,url:item.html_url},status:'PENDING'}).select('id').single();approvalId=approval?.id;if(approvalId)await db.from('ecosystem_advisements').update({approval_request_id:approvalId}).eq('id',advice.id);}
     if(approvalId)await db.from('thelma_alerts').upsert({organization_id:org,source_type:'ECOSYSTEM_ADVISEMENT',source_ref:advice.id,system_key:source.system_key,severity:scored.total>=82?'high':'medium',title:`THELMA weekly update: ${item.full_name}`,summary:`Ecosystem Scout rated this ${scored.total}/100 and recommends ${recommendation}. Review usage, maintenance, license, security, cost and fit before approving evaluation.`,recommended_action:'Discuss with THELMA, then approve or reject sandbox evaluation.',approval_required:true,approval_request_id:approvalId,evidence:{candidate_id:candidate.id,url:item.html_url,score:scored.total}},{onConflict:'organization_id,source_type,source_ref'});
    }
   }
   await db.from('ecosystem_watch_sources').update({last_scanned_at:new Date().toISOString()}).eq('id',source.id);
  }catch(e){failures.push(`${source.source_key}:${String(e).slice(0,160)}`);}
 }
 const status=failures.length?(sourcesScanned?'PARTIAL':'FAILED'):'SUCCEEDED';
 await db.from('ecosystem_scan_runs').update({status,sources_scanned:sourcesScanned,candidates_seen:candidatesSeen,advisements_created:advisements,completed_at:new Date().toISOString(),error_summary:failures.join(' | ')||null,evidence:{failures}}).eq('id',run.id);
 return{run_id:run.id,status,sources_scanned:sourcesScanned,candidates_seen:candidatesSeen,advisements_created:advisements,failures};
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,x-thelma-cron-secret'}});
 if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 try{const auth=await authorized(req);if(!auth)return json({ok:false,error:'authorization_required'},401);const body=await req.json().catch(()=>({}));
  let orgs=auth.orgs;if(!orgs){const{data}=await db.from('ceo_organizations').select('id');orgs=(data||[]).map((x:any)=>x.id);}
  const results=[];for(const org of orgs||[])results.push(await scanOrg(org,String(body.trigger||auth.kind)));
  return json({ok:true,results});
 }catch(e){console.error('[ecosystem-watch]',e);return json({ok:false,error:String(e).replace(/^Error:\s*/,'').slice(0,1000)},500);}
});
