import{useCallback,useEffect,useMemo,useState}from'react';
import{supabase}from'../lib/supabase';
import{useIdentity}from'../auth/IdentityContext';
import type{VWData}from'./types';

const EMPTY:VWData={projects:[],generations:[],assets:[],characters:[],avatar_bindings:[],continuity_jobs:[],continuity_capsules:[]};

export function useVisionWeaverData(){
 const identity=useIdentity();
 const[data,setData]=useState<VWData>(EMPTY);
 const[loading,setLoading]=useState(false);
 const[error,setError]=useState('');
 const signedIn=Boolean(supabase&&identity.user);

 const load=useCallback(async()=>{
  if(!signedIn||!supabase)return;
  setLoading(true);setError('');
  try{
   const{data:res,error}=await supabase.functions.invoke('visionweaver-studio',{body:{action:'list'}});
   if(error)throw error;
   if(res?.ok===false)throw new Error(res.error||'VisionWeaver load failed');
   setData({
    projects:(res?.projects||[]).filter((p:any)=>p.status!=='archived'),
    generations:res?.generations||[],
    assets:res?.assets||[],
    characters:res?.characters||[],
    avatar_bindings:res?.avatar_bindings||[],
    continuity_jobs:res?.continuity_jobs||[],
    continuity_capsules:res?.continuity_capsules||[]
   });
  }catch(e:any){setError(e?.message||String(e))}
  finally{setLoading(false)}
 },[signedIn]);

 useEffect(()=>{void load()},[load]);

 const projectById=useMemo(()=>new Map(data.projects.map((p:any)=>[p.id,p])),[data.projects]);
 const generationsByProject=useMemo(()=>{
  const m=new Map<string,any[]>();
  for(const g of data.generations){const a=m.get(g.project_id)||[];a.push(g);m.set(g.project_id,a)}
  return m;
 },[data.generations]);

 const assetForProject=useCallback((projectId?:string)=>{
  if(!projectId)return undefined;
  const generationIds=new Set((generationsByProject.get(projectId)||[]).map((g:any)=>g.id));
  return data.assets.find((a:any)=>a?.metadata?.project_id===projectId||generationIds.has(a?.metadata?.source_generation_id));
 },[data.assets,generationsByProject]);

 const projectForName=useCallback((needles:string[])=>{
  const n=needles.map(x=>x.toLowerCase());
  return data.projects.find((p:any)=>{
   const hay=`${p.title||''} ${p.universe||''} ${p.source_concept||''}`.toLowerCase();
   return n.some(k=>hay.includes(k));
  });
 },[data.projects]);

 const assetForName=useCallback((needles:string[])=>{
  const p=projectForName(needles);
  const mapped=assetForProject(p?.id);
  if(mapped)return mapped;
  const n=needles.map(x=>x.toLowerCase());
  return data.assets.find((a:any)=>{
   const hay=JSON.stringify({kind:a.kind,name:a.name,metadata:a.metadata,source_url:a.source_url,storage_path:a.storage_path}).toLowerCase();
   return n.some(k=>hay.includes(k));
  });
 },[assetForProject,data.assets,projectForName]);

 return{identity,signedIn,data,loading,error,load,projectById,generationsByProject,assetForProject,projectForName,assetForName};
}
