import{FormEvent,ReactNode,useEffect,useState}from'react';
import type{Session}from'@supabase/supabase-js';
import{isSupabaseConfigured,supabase}from'../lib/supabase';
import{IdentityProvider,type ExecutiveIdentity}from'../auth/IdentityContext';
type Membership={organization_id:string;role:ExecutiveIdentity['role'];status:string;scopes:string[]};
type Organization={id:string;display_name:string;slug:string};
const BUILDER_MODE=true;
export default function AuthGate({children}:{children:ReactNode}){
 const[session,setSession]=useState<Session|null>(null),[identity,setIdentity]=useState<ExecutiveIdentity|null>(null),[ready,setReady]=useState(!isSupabaseConfigured),[email,setEmail]=useState(''),[sent,setSent]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(BUILDER_MODE)return;const client=supabase;if(!client)return;let alive=true;
  const resolve=async(next:Session|null)=>{if(!alive)return;setSession(next);setIdentity(null);setError('');if(!next){setReady(true);return}setReady(false);
   const{data:membership,error:membershipError}=await client.from('ceo_organization_memberships').select('organization_id,role,status,scopes').eq('user_id',next.user.id).eq('status','active').limit(1).maybeSingle<Membership>();
   if(!alive)return;if(membershipError||!membership){setError(membershipError?.message||'This account has no active executive workspace membership.');setReady(true);return}
   const{data:organization,error:organizationError}=await client.from('ceo_organizations').select('id,display_name,slug').eq('id',membership.organization_id).single<Organization>();
   if(!alive)return;if(organizationError||!organization){setError(organizationError?.message||'Executive workspace unavailable.');setReady(true);return}
   setIdentity({session:next,user:next.user,isBuilder:false,organizationId:organization.id,organizationName:organization.display_name,organizationSlug:organization.slug,role:membership.role,scopes:membership.scopes||[],signOut:async()=>{await client.auth.signOut()}});setReady(true)
  };
  client.auth.getSession().then(({data})=>resolve(data.session));
  const{data}=client.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>resolve(next),0)});
  return()=>{alive=false;data.subscription.unsubscribe()}
 },[]);
 const login=async(e:FormEvent)=>{e.preventDefault();if(!supabase)return;setError('');const{error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin}});if(error)setError(error.message);else setSent(true)};
 if(BUILDER_MODE)return <IdentityProvider value={{session:null,user:null,isBuilder:true,organizationId:'20e10428-4443-4324-b36a-e68d64ec26ed',organizationName:'Estiban Creations',organizationSlug:'estiban-creations',role:'viewer',scopes:['builder:read'],signOut:async()=>{}}}>{children}</IdentityProvider>;
 if(!ready)return <div className="auth-screen"><div className="auth-card"><div className="brand-mark">EC</div><h1>Verifying executive authority</h1><p>Checking workspace membership and governed access.</p></div></div>;
 if(isSupabaseConfigured&&!session)return <div className="auth-screen"><form className="auth-card" onSubmit={login}><div className="brand-mark">EC</div><span className="eyebrow">SYS-CEO-001 · ZERO-TRUST ENTRY</span><h1>CEO Command Center</h1><p>Use an authorized executive account. Authentication alone does not grant access; an active workspace role is required.</p><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Executive email"/><button type="submit">Send secure sign-in link</button>{sent&&<small>Check your email for the secure link.</small>}{error&&<small className="auth-error">{error}</small>}</form></div>;
 if(session&&!identity)return <div className="auth-screen"><div className="auth-card"><div className="brand-mark">EC</div><span className="eyebrow">ACCESS DENIED · MEMBERSHIP REQUIRED</span><h1>Executive workspace unavailable</h1><p>{error||'This account is authenticated but has not been authorized for an organization.'}</p><button onClick={()=>supabase?.auth.signOut()}>Sign out</button></div></div>;
 if(!identity)return <>{children}</>;
 return <IdentityProvider value={identity}>{children}</IdentityProvider>
}
