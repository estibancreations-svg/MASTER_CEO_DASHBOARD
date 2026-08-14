import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useIdentity } from '../auth/IdentityContext';

export type SystemStatus={system_id:string;system_name:string;lifecycle_state:string;health_state:string;progress_percent:number;blocker_count:number;qc_state:string;summary:string|null;updated_at:string};
export type Integration={integration_key:string;display_name:string;owning_system:string;connection_type:string;status:string;capabilities:string[];updated_at:string};
export type ModuleRecord={id:string;module_key:string;name:string;category:string;status_value:string;activity:string;record_state:'active'|'review'|'completed'|'archived';updated_at:string};
const BUILDER_RECORDS:ModuleRecord[]=[
 ['AI Mastery','Prompt Architecture','Advanced','82%'],['Agent Hub','THELMA','Operations lead','Online'],['Leads Pipeline','Riverside property group','Qualified','$84,000'],
 ['Content Engine','Reunion launch campaign','In review','12 assets'],['Social Media','Instagram','Connected','18.4K'],['Trends','Florida land opportunities','High','Rising'],
 ['Communications','Board briefing packet','Executive Office','Priority'],['CRM','Avery Holdings','Property investor','Qualified'],['Products','CEO Command Center','Software','Active'],
 ['Finance','Operating revenue','Income','$54,230'],['System Audit','Authentication policy','Security','Passed'],['Certificates','AI Governance','The Architect','Verified'],
 ['Settings','Executive preferences','Workspace','Configured'],['Team Overview','Executive Office','2 members','Healthy'],['Video Storyboard','The Matriarch’s Debt','12 scenes','Pre-production'],
 ['Social Analytics','Total reach','All channels','184,220'],['Lead Scoring Rules','Budget fit','Financial','25 points'],['API Integration','Supabase','Data & Auth','Connected'],
 ['Revenue Report','Software & systems','Current month','$28,400'],['Agent Logs','THELMA daily orchestration','Completed','Today'],['Media Library','Brand library','128 assets','Shared'],
 ['Multi-Account Posting','Reunion campaign','4 channels','Scheduled'],['Trend Signal Alerts','Florida property velocity','Property','High'],['Help Center','Launch the CEO Dashboard','Getting started','Open']
].map((r,i)=>({id:'builder-'+i,module_key:r[0],name:r[1],category:r[2],status_value:r[3],activity:'Builder snapshot',record_state:r[3]==='In review'?'review':r[3]==='Passed'||r[3]==='Verified'?'completed':'active',updated_at:new Date(0).toISOString()} as ModuleRecord));

export function useCommandData(){
  const identity=useIdentity();
  const[systems,setSystems]=useState<SystemStatus[]>([]);
  const[integrations,setIntegrations]=useState<Integration[]>([]);
  const[moduleRecords,setModuleRecords]=useState<ModuleRecord[]>([]);
  const[loading,setLoading]=useState(Boolean(supabase));
  const[error,setError]=useState<string|null>(null);
  useEffect(()=>{
    const client=supabase;
    if(identity.isBuilder){setModuleRecords(BUILDER_RECORDS);setLoading(false);return}
    if(!client)return;
    let alive=true;
    const load=async()=>{
      const[s,i,m]=await Promise.all([
        client.from('ceo_system_status').select('*').eq('organization_id',identity.organizationId).order('progress_percent',{ascending:false}),
        client.from('ceo_integrations').select('integration_key,display_name,owning_system,connection_type,status,capabilities,updated_at').eq('organization_id',identity.organizationId).order('display_name'),
        client.from('ceo_module_records').select('id,module_key,name,category,status_value,activity,record_state,updated_at').eq('organization_id',identity.organizationId).order('sort_order').order('created_at')
      ]);
      if(!alive)return;
      if(s.error||i.error||m.error)setError(s.error?.message||i.error?.message||m.error?.message||'Read model unavailable');
      else{setSystems(s.data||[]);setIntegrations((i.data||[])as Integration[]);setModuleRecords((m.data||[])as ModuleRecord[])}
      setLoading(false);
    };
    load();
    const channel=client.channel('ceo-command-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'ceo_system_status'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'ceo_integrations'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'ceo_module_records'},load).subscribe();
    return()=>{alive=false;client.removeChannel(channel)};
  },[identity.organizationId]);
  const createModuleRecord=async(moduleKey:string,input:{name:string;category:string;status_value:string;activity:string})=>{
    if(identity.isBuilder||!identity.user)return{error:'Builder mode is read-only. Record changes remain protected.'};
    if(!supabase)return{error:'Supabase is unavailable'};
    const{error}=await supabase.from('ceo_module_records').insert({organization_id:identity.organizationId,module_key:moduleKey,...input,created_by:identity.user.id});
    return{error:error?.message||null};
  };
  return{systems,integrations,moduleRecords,createModuleRecord,loading,error,connected:Boolean(supabase)};
}
