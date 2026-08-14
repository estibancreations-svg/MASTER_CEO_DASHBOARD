import{createContext,useContext}from'react';
import type{Session,User}from'@supabase/supabase-js';
export type ExecutiveIdentity={session:Session;user:User;organizationId:string;organizationName:string;organizationSlug:string;role:'architect'|'ceo'|'delegated_approver'|'operator'|'auditor'|'viewer';scopes:string[];signOut:()=>Promise<void>};
const IdentityContext=createContext<ExecutiveIdentity|null>(null);
export const IdentityProvider=IdentityContext.Provider;
export function useIdentity(){const value=useContext(IdentityContext);if(!value)throw new Error('Executive identity is unavailable outside AuthGate');return value}
