import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const POLL_MS = 30_000;
const RETRY_MS = 5 * 60_000;

export default function VisionWeaverAssemblyWatcher() {
  const inFlight = useRef(new Set<string>());
  const lastFailure = useRef(new Map<string, number>());

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    async function assembleReadySequences() {
      if (!active) return;
      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData.session;
      if (!session?.user || !session.access_token) return;

      const { data: parents, error } = await client
        .from('vw_generations')
        .select('id,status,provider,operation,result,created_at')
        .eq('owner_id', session.user.id)
        .eq('media_type', 'video')
        .eq('provider', 'visionweaver')
        .eq('operation', 'multi_shot_video')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !parents?.length) return;

      for (const generation of parents) {
        const result = generation.result && typeof generation.result === 'object'
          ? generation.result as Record<string, unknown>
          : {};
        if (result.deliverable_state === 'master_ready' || Boolean(result.partial)) continue;
        if (inFlight.current.has(generation.id)) continue;
        const failedAt = lastFailure.current.get(generation.id) || 0;
        if (Date.now() - failedAt < RETRY_MS) continue;

        inFlight.current.add(generation.id);
        try {
          const response = await fetch('/api/visionweaver-assemble', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ generation_id: generation.id })
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || !body.ok) throw new Error(body.error || `assembly_http_${response.status}`);
          lastFailure.current.delete(generation.id);
          window.dispatchEvent(new CustomEvent('visionweaver:master-ready', {
            detail: { generationId: generation.id, masterUrl: body.master_url || null }
          }));
        } catch (assemblyError) {
          lastFailure.current.set(generation.id, Date.now());
          console.error('[VisionWeaver] automatic master assembly failed', {
            generationId: generation.id,
            error: String(assemblyError)
          });
        } finally {
          inFlight.current.delete(generation.id);
        }
        break;
      }
    }

    void assembleReadySequences();
    const timer = window.setInterval(() => void assembleReadySequences(), POLL_MS);
    const { data: authListener } = client.auth.onAuthStateChange(() => {
      window.setTimeout(() => void assembleReadySequences(), 0);
    });
    const onSequenceUpdate = () => void assembleReadySequences();
    window.addEventListener('visionweaver:sequence-ready', onSequenceUpdate);

    return () => {
      active = false;
      window.clearInterval(timer);
      authListener.subscription.unsubscribe();
      window.removeEventListener('visionweaver:sequence-ready', onSequenceUpdate);
    };
  }, []);

  return null;
}
