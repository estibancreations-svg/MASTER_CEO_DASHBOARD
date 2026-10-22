import{useState}from'react';
import{supabase}from'../lib/supabase';
import{useIdentity}from'../auth/IdentityContext';

/** Direct authenticated THELMA invocation; never a fake status badge or simulated response. */
export function ThelmaDiagnostic(){
 const identity=useIdentity();
 const[busy,setBusy]=useState(false),[result,setResult]=useState(''),[lastRun,setLastRun]=useState('');
 const diagnose=async()=>{
  if(!supabase||!identity.user){setResult('Sign in before running THELMA.');return}
  setBusy(true);setResult('');
  try{
   const scan=await supabase.functions.invoke('thelma-ai',{body:{action:'refresh_white_cells'}});
   if(scan.error||scan.data?.ok===false)throw new Error(scan.error?.message||scan.data?.error||'White Blood Cell scan failed');
   const prompt='Run a read-only diagnostic for VisionWeaver and the Master CEO Dashboard. Review active White Blood Cell signals, live system capabilities, auth/permissions, production backend, Avatar State continuity, UI routing, deployment and release Quality Gate evidence. Distinguish observed facts from unverified claims. Give blockers, evidence, exact next actions, and approval requirements. Do not deploy, modify code, spend production credits, or claim tests passed without evidence.';
   const response=await supabase.functions.invoke('thelma-ai',{body:{action:'chat',message:prompt,context_system_key:'SYS-CEO-001'}});
   if(response.error||response.data?.ok===false)throw new Error(response.error?.message||response.data?.error||'THELMA did not return diagnostics');
   const answer=response.data?.assistant?.content;
   if(!answer)throw new Error('THELMA returned no diagnostic text');
   setResult(String(answer));setLastRun(new Date().toLocaleString());
  }catch(e:any){setResult('THELMA diagnostic failed: '+(e?.message||String(e)))}
  finally{setBusy(false)}
 };
 return <section className="vw-panel" aria-label="THELMA deployment diagnostics">
  <header className="vw-panel-head"><h3>THELMA AI · Release Diagnostics</h3></header>
  <p>Run the authenticated agent directly from VisionWeaver. THELMA scans White Blood Cells and reports findings; deployment remains approval-gated.</p>
  <button type="button" disabled={busy||!identity.user} onClick={()=>void diagnose()}>{busy?'THELMA diagnosing…':'Run THELMA diagnostics'}</button>
  <button type="button" onClick={()=>window.location.assign('/systems/thelma')}>Open THELMA command center</button>
  {lastRun&&<p>Diagnostic response received: {lastRun}</p>}
  {result&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:350,overflow:'auto'}} role="status">{result}</pre>}
 </section>
}
