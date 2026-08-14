import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useIdentity } from '../auth/IdentityContext';

export type SystemStatus={system_id:string;system_name:string;lifecycle_state:string;health_state:string;progress_percent:number;blocker_count:number;qc_state:string;summary:string|null;updated_at:string};
export type Integration={integration_key:string;display_name:string;owning_system:string;connection_type:string;status:string;capabilities:string[];updated_at:string};
export type ModuleRecord={id:string;module_key:string;name:string;category:string;status_value:string;activity:string;record_state:'active'|'review'|'completed'|'archived';updated_at:string};

export function useCommandData(){
  const identity=useIdentity();
  const[systems,setSystems]=useState<SystemStatus[]>([]);
  const[integrations,setIntegrations]=useState<Integration[]>([]);
  const[moduleRecords,setModuleRecords]=useState<ModuleRecord[]>([]);
  const[loading,setLoading]=useState(Boolean(supabase));
  const[error,setError]=useState<string|null>(null);
  useEffect(()=>{
    const client=supabase;
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
    if(!supabase)return{error:'Supabase is unavailable'};
    const{error}=await supabase.from('ceo_module_records').insert({organization_id:identity.organizationId,module_key:moduleKey,...input,created_by:identity.user.id});
    return{error:error?.message||null};
  };
  return{systems,integrations,moduleRecords,createModuleRecord,loading,error,connected:Boolean(supabase)};
}
