import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useIdentity } from '../auth/IdentityContext';

export type SystemStatus={system_id:string;system_name:string;lifecycle_state:string;health_state:string;progress_percent:number;blocker_count:number;qc_state:string;summary:string|null;updated_at:string};
export type Integration={integration_key:string;display_name:string;owning_system:string;connection_type:string;status:string;capabilities:string[];updated_at:string};

export function useCommandData(){
  const identity=useIdentity();
  const[systems,setSystems]=useState<SystemStatus[]>([]);
  const[integrations,setIntegrations]=useState<Integration[]>([]);
  const[loading,setLoading]=useState(Boolean(supabase));
  const[error,setError]=useState<string|null>(null);
  useEffect(()=>{
    const client=supabase;
    if(!client)return;
    let alive=true;
    const load=async()=>{
      const[s,i]=await Promise.all([
        client.from('ceo_system_status').select('*').eq('organization_id',identity.organizationId).order('progress_percent',{ascending:false}),
        client.from('ceo_integrations').select('integration_key,display_name,owning_system,connection_type,status,capabilities,updated_at').eq('organization_id',identity.organizationId).order('display_name')
      ]);
      if(!alive)return;
      if(s.error||i.error)setError(s.error?.message||i.error?.message||'Read model unavailable');
      else{setSystems(s.data||[]);setIntegrations((i.data||[])as Integration[])}
      setLoading(false);
    };
    load();
    const channel=client.channel('ceo-command-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'ceo_system_status'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'ceo_integrations'},load).subscribe();
    return()=>{alive=false;client.removeChannel(channel)};
  },[identity.organizationId]);
  return{systems,integrations,loading,error,connected:Boolean(supabase)};
}
