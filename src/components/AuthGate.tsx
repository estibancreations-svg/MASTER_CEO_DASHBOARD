import { FormEvent, ReactNode, useEffect, useState } from 'react';
import type { Provider, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { IdentityProvider, type ExecutiveIdentity } from '../auth/IdentityContext';
import SystemControls from './SystemControls';

type Membership = { organization_id: string; role: ExecutiveIdentity['role']; status: string; scopes: string[] };
type Organization = { id: string; display_name: string; slug: string };
type SocialProvider = { provider: Provider; label: string; mark: string; scopes?: string };
type AuthSettings = { external?: Record<string, boolean> };

const BUILDER_MODE = import.meta.env.DEV && (import.meta.env.VITE_BUILDER_MODE ?? 'false').trim().toLowerCase() === 'true';
const AUTH_RESET_VERSION = '2026-08-24-production-login-reset-v1';
const AUTH_RESET_KEY = 'ec-auth-reset-version';
const OTP_COOLDOWN_SECONDS = 60;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const SOCIAL_PROVIDERS: SocialProvider[] = [
  { provider: 'google', label: 'Google', mark: 'G' },
  { provider: 'apple', label: 'Apple', mark: 'A' },
  { provider: 'azure', label: 'Microsoft', mark: 'M', scopes: 'email' },
  { provider: 'github', label: 'GitHub', mark: 'GH' },
  { provider: 'facebook', label: 'Facebook', mark: 'f' },
  { provider: 'linkedin_oidc', label: 'LinkedIn', mark: 'in' }
];

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<ExecutiveIdentity | null>(null);
  const [ready, setReady] = useState(BUILDER_MODE || !isSupabaseConfigured);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [enabledProviders, setEnabledProviders] = useState<Set<string>>(new Set());
  const [providerCheckComplete, setProviderCheckComplete] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) { setProviderCheckComplete(true); return; }
    let cancelled = false;
    const loadProviders = async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
        if (!response.ok) throw new Error(`Auth provider check failed (${response.status})`);
        const settings = await response.json() as AuthSettings;
        const enabled = new Set(Object.entries(settings.external || {}).filter(([, value]) => value === true).map(([key]) => key));
        if (!cancelled) setEnabledProviders(enabled);
      } catch {
        if (!cancelled) setEnabledProviders(new Set());
      } finally {
        if (!cancelled) setProviderCheckComplete(true);
      }
    };
    void loadProviders();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (BUILDER_MODE) return;
    const client = supabase;
    if (!client) { setReady(true); return; }
    let alive = true;
    const resolve = async (next: Session | null) => {
      if (!alive) return;
      setSession(next); setIdentity(null); setError('');
      if (!next) { setReady(true); return; }
      setReady(false);
      const { data: membership, error: membershipError } = await client.from('ceo_organization_memberships').select('organization_id,role,status,scopes').eq('user_id', next.user.id).eq('status', 'active').limit(1).maybeSingle<Membership>();
      if (!alive) return;
      if (membershipError || !membership) { setError(membershipError?.message || 'This account has no active executive workspace membership.'); setReady(true); return; }
      const { data: organization, error: organizationError } = await client.from('ceo_organizations').select('id,display_name,slug').eq('id', membership.organization_id).single<Organization>();
      if (!alive) return;
      if (organizationError || !organization) { setError(organizationError?.message || 'Executive workspace unavailable.'); setReady(true); return; }
      setIdentity({ session: next, user: next.user, isBuilder: false, organizationId: organization.id, organizationName: organization.display_name, organizationSlug: organization.slug, role: membership.role, scopes: membership.scopes || [], signOut: async () => { const { error: signOutError } = await client.auth.signOut({ scope: 'global' }); if (signOutError) throw signOutError; } });
      setReady(true);
    };
    const bootstrap = async () => {
      if (localStorage.getItem(AUTH_RESET_KEY) !== AUTH_RESET_VERSION) { await client.auth.signOut({ scope: 'local' }); localStorage.setItem(AUTH_RESET_KEY, AUTH_RESET_VERSION); }
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError && alive) { setError(sessionError.message); setReady(true); return; }
      await resolve(data.session);
    };
    void bootstrap();
    const { data } = client.auth.onAuthStateChange((_event, next) => { window.setTimeout(() => void resolve(next), 0); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || submitting || cooldown > 0) return;
    setError(''); setSubmitting('email');
    const { error: loginError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/dashboard`, shouldCreateUser: false } });
    setSubmitting(null);
    if (loginError) { setError(/rate limit/i.test(loginError.message) ? 'Secure-link email limit reached. Wait a few minutes before trying again.' : loginError.message); return; }
    setSent(true); setCooldown(OTP_COOLDOWN_SECONDS);
  };

  const socialLogin = async ({ provider, scopes }: SocialProvider) => {
    if (!supabase || submitting) return;
    if (!providerCheckComplete || !enabledProviders.has(provider)) { setError(`${SOCIAL_PROVIDERS.find((item) => item.provider === provider)?.label || provider} sign-in is not enabled yet. Use the secure email link for now.`); return; }
    setError(''); setSubmitting(provider);
    const { error: socialError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/dashboard`, scopes } });
    if (socialError) { setError(socialError.message); setSubmitting(null); }
  };

  if (BUILDER_MODE) {
    const builder: ExecutiveIdentity = { session: null, user: null, isBuilder: true, organizationId: '20e10428-4443-4324-b36a-e68d64ec26ed', organizationName: 'Estiban Creations', organizationSlug: 'estiban-creations', role: 'viewer', scopes: ['builder:read'], signOut: async () => {} };
    return <IdentityProvider value={builder}><SystemControls />{children}</IdentityProvider>;
  }
  if (!isSupabaseConfigured) return <><SystemControls /><div className="auth-screen"><div className="auth-card"><div className="brand-mark">EC</div><span className="eyebrow">CONFIGURATION REQUIRED</span><h1>Executive sign-in is unavailable</h1><p>Configure the browser-safe Supabase URL and publishable key.</p></div></div></>;
  if (!ready) return <><SystemControls /><div className="auth-screen"><div className="auth-card"><div className="brand-mark">EC</div><h1>Verifying executive authority</h1><p>Checking workspace membership and governed access.</p></div></div></>;
  if (!session) {
    const visibleProviders = SOCIAL_PROVIDERS.filter((option) => enabledProviders.has(option.provider));
    return <><SystemControls /><div className="auth-screen"><form className="auth-card" onSubmit={login}>
      <div className="brand-mark">EC</div><span className="eyebrow">SYS-CEO-001 · ZERO-TRUST ENTRY</span><h1>CEO Command Center</h1>
      <p>Sign in to enter the governed dashboard. Authentication verifies identity; your active organization membership determines authority.</p>
      {!providerCheckComplete && <small>Checking available sign-in providers…</small>}
      {providerCheckComplete && visibleProviders.length > 0 && <div className="social-auth" aria-label="Social sign-in options">{visibleProviders.map((option) => <button key={option.provider} type="button" onClick={() => void socialLogin(option)} disabled={Boolean(submitting)}><span>{option.mark}</span>{submitting === option.provider ? 'Connecting…' : `Continue with ${option.label}`}</button>)}</div>}
      {providerCheckComplete && visibleProviders.length > 0 && <div className="auth-divider"><span>or use a secure email link</span></div>}
      <label className="auth-email">Executive email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
      <button className="auth-submit" type="submit" disabled={Boolean(submitting) || cooldown > 0}>{submitting === 'email' ? 'Requesting secure link…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send secure sign-in link'}</button>
      {sent && <small>Check your email for the secure link. This screen does not create unapproved executive access.</small>}
      {providerCheckComplete && visibleProviders.length === 0 && <small>Social sign-in providers are not configured yet. Secure email login remains available.</small>}
      {error && <small className="auth-error" role="alert">{error}</small>}
    </form></div></>;
  }
  if (!identity) return <><SystemControls signOut={async () => { const { error: signOutError } = await supabase!.auth.signOut({ scope: 'global' }); if (signOutError) throw signOutError; }} /><div className="auth-screen"><div className="auth-card"><div className="brand-mark">EC</div><span className="eyebrow">ACCESS DENIED · MEMBERSHIP REQUIRED</span><h1>Executive workspace unavailable</h1><p>{error || 'This account is authenticated but has not been authorized for an organization.'}</p><button className="auth-submit" onClick={() => void supabase?.auth.signOut({ scope: 'global' })}>Sign out</button></div></div></>;
  return <IdentityProvider value={identity}><SystemControls signOut={identity.signOut} />{children}</IdentityProvider>;
}
