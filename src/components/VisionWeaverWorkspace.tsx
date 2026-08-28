import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, BookOpen, Bot, CheckCircle2, Clapperboard, Film,
  FileAudio, FileImage, FileText, FileVideo, FolderOpen, GraduationCap, Grid3X3,
  Image, Layers3, Library, Mic2, MonitorPlay, Music2, Palette, Play, Plus,
  RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Upload, Users, WandSparkles,
  Workflow, X, Zap
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useIdentity } from '../auth/IdentityContext';

type Job = { id: string; project_title: string; concept: string; scene_count: number; target_platform: string; status: string; approval_state: string; created_at: string };
type Scene = { id: string; job_id: string; scene_index: number; scene_id: string; prompt: string; status: string; provider: string | null; qc_state: string; prompt_version: number };
type Asset = { id: string; name: string; kind: 'image' | 'video' | 'audio' | 'document'; size: string; url?: string; created_at: string };
type Character = { id: string; name: string; description: string; status: string };
type StudioMode = 'image' | 'video' | 'audio' | 'book' | 'movie';
type LiveGeneration = {
  id: string; project_id: string; media_type: StudioMode; status: string; prompt: string;
  model: string; error?: string | null; result?: Record<string, unknown>; playable_urls?: string[];
  progress?: { complete: number; failed: number; total: number } | null;
  children?: Array<{ id: string; status: string; sequence_index?: number; playable_urls?: string[] }>;
  created_at: string;
};
type StudioHealth = {
  ok: boolean; version: number;
  readiness: Record<StudioMode | 'planning', boolean>;
  providers?: Record<string, { configured: boolean; verified: boolean; status?: number | null }>;
  capabilities: Record<StudioMode, { provider: string; model: string; operation: string }>;
};

const STORAGE_KEY = 'visionweaver-studio-v4';
const builderJobs: Job[] = [
  { id: 'vw-1', project_title: 'The Matriarch’s Debt', concept: 'Bittersweet family legacy short film', scene_count: 12, target_platform: 'Movie', status: 'scene_breakdown', approval_state: 'review', created_at: '2026-08-14' },
  { id: 'vw-2', project_title: 'LandWeaver Launch', concept: 'Property intelligence product story', scene_count: 8, target_platform: 'Social', status: 'cinematography', approval_state: 'approved', created_at: '2026-08-13' },
  { id: 'vw-3', project_title: 'The Tub', concept: 'Book-to-screen adaptation workspace', scene_count: 6, target_platform: 'Book', status: 'draft', approval_state: 'draft', created_at: '2026-08-12' }
];
const builderScenes: Scene[] = Array.from({ length: 12 }, (_, i) => ({
  id: `scene-${i}`, job_id: 'vw-1', scene_index: i + 1, scene_id: `MAT-${String(i + 1).padStart(2, '0')}`,
  prompt: ['Hope Memorial Chapel exterior at blue hour', 'Evelyn Reed enters the silent chapel', 'Close portrait: memory and resolve', 'Family photographs across an empty pew'][i % 4],
  status: i < 4 ? 'ready' : 'pending', provider: null, qc_state: i < 2 ? 'passed' : 'pending', prompt_version: 1
}));

const nav = [
  ['Home', Activity], ['Agent', Bot], ['Studio', WandSparkles], ['Apps', Grid3X3],
  ['Workflows', Workflow], ['Characters', Users], ['Library', Library], ['Academy', GraduationCap]
] as const;

const modes: { id: StudioMode; label: string; icon: typeof Film; models: string[]; description: string }[] = [
  { id: 'video', label: 'Video', icon: Film, models: ['Auto route · Runway → Kling'], description: 'Create 5-second shots through 10-minute productions. Long-form jobs are split into sequential Runway Seedance segments and can extend each completed shot into the next.' },
  { id: 'image', label: 'Image', icon: Image, models: ['Auto route · Runway → Kling'], description: 'Create production stills with automatic provider failover and private output storage.' },
  { id: 'audio', label: 'Audio', icon: Mic2, models: ['Auto route · ElevenLabs → Runway'], description: 'Generate sound effects and atmospheres with durable private output storage.' },
  { id: 'movie', label: 'Movie', icon: Clapperboard, models: ['VisionWeaver Movie Pipeline · resilient route'], description: 'Create a treatment, characters, shot plan, audio plan and delivery package.' },
  { id: 'book', label: 'Book', icon: BookOpen, models: ['VisionWeaver Author · Claude Sonnet 4.6'], description: 'Create an outline, sample chapter, cover prompt, audiobook direction and publishing package.' }
];

const apps = [
  ['Scene Builder', 'Movie', 'Craft a consistent multi-shot scene step by step.', Clapperboard],
  ['Multi-Shot Video', 'Video', 'Turn one prompt into a complete shot sequence.', Film],
  ['Edit Studio', 'Video', 'Edit video with natural-language instructions.', MonitorPlay],
  ['Image Studio', 'Image', 'Generate, edit, expand, vary and upscale stills.', FileImage],
  ['Character Lock', 'Continuity', 'Keep faces, wardrobe and traits consistent.', Users],
  ['Book Studio', 'Book', 'Outline, write, edit, illustrate and publish books.', BookOpen],
  ['Audiobook Builder', 'Audio', 'Cast voices, narrate chapters and master audio.', FileAudio],
  ['Sound + Score', 'Audio', 'Create music, dialogue and sound effects.', Music2],
  ['Storyboard to Film', 'Movie', 'Convert panels into shots and an edit-ready timeline.', Layers3],
  ['Product Reshoot', 'Image', 'Change setting, light, angle and visual treatment.', Palette],
  ['Adapt Everywhere', 'Publish', 'Resize and version assets for every platform.', Zap],
  ['Upscale + Restore', 'Utility', 'Improve footage and images for delivery.', Sparkles]
] as const;

const workflows = [
  ['Book → Audiobook → Trailer', 'book', 'Manuscript intake, chapter plan, narration, cover and cinematic trailer.'],
  ['Idea → Feature Film', 'movie', 'Concept, character bible, screenplay, storyboard, shots, edit, QC and delivery.'],
  ['Storyboard → Multi-Shot Video', 'video', 'Reference panels, continuity lock, shot generation, assembly and review.'],
  ['Product → Campaign', 'image', 'Product references, image reshoot, ad concepts, video and social derivatives.'],
  ['Character Across Worlds', 'image', 'Character lock, environment variations, motion tests and contact sheet.'],
  ['Weekly Social Factory', 'video', 'Source idea, platform variants, captions, thumbnails and approvals.']
] as const;

const starterPrompts: Record<StudioMode, string> = {
  video: 'Create a cinematic multi-shot sequence with a locked character and consistent lighting.',
  image: 'Create a polished key art image with room for title treatment.',
  audio: 'Create the dialogue, score and sound design for this scene.',
  movie: 'Build a complete movie package from concept through final delivery.',
  book: 'Turn this idea into an outline, chapter plan, manuscript and publishing package.'
};

const videoDurationOptions = [
  ['5', '5 seconds'], ['10', '10 seconds'], ['15', '15 seconds'], ['30', '30 seconds'],
  ['45', '45 seconds'], ['60', '1 minute'], ['90', '1½ minutes'], ['120', '2 minutes'],
  ['300', '5 minutes'], ['600', '10 minutes']
] as const;

function readLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

export default function VisionWeaverWorkspace() {
  const identity = useIdentity();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [characters, setCharacters] = useState<Character[]>([
    { id: 'char-evelyn', name: 'Evelyn Reed', description: 'Silver-haired family matriarch; restrained grief, precise posture, navy wardrobe.', status: 'locked' }
  ]);
  const [activeId, setActiveId] = useState('');
  const [view, setView] = useState('Home');
  const [mode, setMode] = useState<StudioMode>('video');
  const [model, setModel] = useState(modes[0].models[0]);
  const [prompt, setPrompt] = useState(starterPrompts.video);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const [form, setForm] = useState({ title: '', concept: '', scenes: '6', platform: 'Movie', runtime: 'auto' });
  const [characterForm, setCharacterForm] = useState({ name: '', description: '' });
  const [productionUser, setProductionUser] = useState<User | null>(identity.user);
  const [health, setHealth] = useState<StudioHealth | null>(null);
  const [healthChecked, setHealthChecked] = useState(false);
  const [liveGenerations, setLiveGenerations] = useState<LiveGeneration[]>([]);
  const [aspect, setAspect] = useState('16:9');
  const [quality, setQuality] = useState('Standard');
  const [videoDuration, setVideoDuration] = useState('10');
  const [continuityMode, setContinuityMode] = useState<'reference' | 'extend'>('extend');
  const [lesson, setLesson] = useState<{ title: string; description: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (identity.isBuilder) {
      const local = readLocal();
      const localJobs = Array.isArray(local.jobs) ? local.jobs : builderJobs;
      const localScenes = Array.isArray(local.scenes) ? local.scenes : builderScenes;
      setJobs(localJobs); setScenes(localScenes);
      setAssets(Array.isArray(local.assets) ? local.assets : []);
      if (Array.isArray(local.characters)) setCharacters(local.characters);
      setActiveId((current) => current || localJobs[0]?.id || '');
      return;
    }
    if (!supabase) return;
    setBusy(true);
    const [{ data: j, error }, { data: s }] = await Promise.all([
      supabase.from('production_jobs').select('id,project_title,concept,scene_count,target_platform,status,approval_state,created_at').order('created_at', { ascending: false }),
      supabase.from('production_scenes').select('id,job_id,scene_index,scene_id,prompt,status,provider,qc_state,prompt_version').order('scene_index')
    ]);
    if (error) setNotice(error.message);
    else { setJobs(j || []); setScenes(s || []); setActiveId((current) => current || j?.[0]?.id || ''); }
    setBusy(false);
  }

  useEffect(() => {
    load();
    if (identity.isBuilder) return;
    const client = supabase; if (!client) return;
    const channel = client.channel('visionweaver-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_jobs' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_scenes' }, load).subscribe();
    return () => { client.removeChannel(channel); };
  }, [identity.isBuilder]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data }) => { if (active) setProductionUser(data.session?.user || null); });
    const { data } = client.auth.onAuthStateChange((_event, session) => { if (active) setProductionUser(session?.user || null); });
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (base) fetch(`${base}/functions/v1/visionweaver-studio/health`)
      .then((result) => result.json())
      .then((value) => { if (active && value.ok) setHealth(value); })
      .catch(() => { if (active) setHealth(null); })
      .finally(() => { if (active) setHealthChecked(true); });
    else setHealthChecked(true);
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!productionUser) { setLiveGenerations([]); return; }
    loadLive(false);
    const timer = window.setInterval(() => loadLive(true), 15000);
    return () => window.clearInterval(timer);
  }, [productionUser?.id]);

  useEffect(() => {
    if (!identity.isBuilder || !jobs.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobs, scenes, assets: assets.map(({ url, ...asset }) => asset), characters }));
  }, [identity.isBuilder, jobs, scenes, assets, characters]);

  function selectMode(next: StudioMode) {
    const config = modes.find((item) => item.id === next)!;
    setMode(next); setModel(config.models[0]); setPrompt(starterPrompts[next]); setView('Studio');
  }

  function planScenes(job: Job, count: number, sourcePrompt: string) {
    const beats = ['Opening image and emotional promise', 'Character or subject introduction', 'Escalation and discovery', 'Turning point', 'Resolution and release', 'Final image and call to action'];
    return Array.from({ length: count }, (_, index): Scene => ({
      id: crypto.randomUUID(), job_id: job.id, scene_index: index + 1,
      scene_id: `${mode.toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
      prompt: `${beats[index % beats.length]}. ${sourcePrompt}`,
      status: 'planned', provider: model, qc_state: 'pending', prompt_version: 1
    }));
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const requestedCount = Math.max(1, Math.min(20, Number(form.scenes) || 1));
    const videoLike = ['Movie', 'Video', 'Social'].includes(form.platform);
    const runtimeSeconds = videoLike && form.runtime !== 'auto' ? Number(form.runtime) : null;
    const count = Math.max(requestedCount, runtimeSeconds ? Math.ceil(runtimeSeconds / 30) : 1);
    if (identity.isBuilder) {
      const item: Job = { id: crypto.randomUUID(), project_title: form.title, concept: form.concept, scene_count: count, target_platform: form.platform, status: 'planned', approval_state: 'draft', created_at: new Date().toISOString() };
      setJobs((current) => [item, ...current]);
      setScenes((current) => [...planScenes(item, count, form.concept), ...current]);
      setActiveId(item.id); setAdding(false); setView('Workflows');
      setNotice(runtimeSeconds ? `Production planned for ${runtimeSeconds} seconds across at least ${count} continuity units.` : 'Production created and saved on this device. Open Studio to continue.');
      return;
    }
    if (!supabase || !identity.user) return;
    setBusy(true);
    const { data, error } = await supabase.from('production_jobs').insert({
      project_title: form.title,
      concept: form.concept,
      scene_count: count,
      target_platform: form.platform,
      status: 'queued',
      approval_state: 'draft',
      owner_id: identity.user.id,
      created_by: identity.user.email,
      provenance: runtimeSeconds ? {
        target_duration_seconds: runtimeSeconds,
        continuity_mode: 'strict_extend',
        source: 'visionweaver-workspace'
      } : { source: 'visionweaver-workspace' }
    }).select('id,project_title,concept,scene_count,target_platform,status,approval_state,created_at').single();
    if (error) setNotice(error.message); else { setJobs((current) => [data, ...current]); setActiveId(data.id); setAdding(false); setNotice(runtimeSeconds ? `Production queued for ${runtimeSeconds} seconds of sequential orchestration.` : 'Production queued for orchestration.'); }
    setBusy(false);
  }

  async function loadLive(refresh: boolean) {
    if (!supabase || !productionUser) return;
    const { data, error } = await supabase.functions.invoke('visionweaver-studio', {
      body: { action: refresh ? 'refresh' : 'list' }
    });
    if (error || !data?.ok) {
      setNotice(data?.error || error?.message || 'Could not load the production workspace.');
      return;
    }
    setLiveGenerations(data.generations || []);
  }

  async function retryGeneration(generationId: string) {
    if (!supabase || !productionUser) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('visionweaver-studio', {
      body: { action: 'retry', generation_id: generationId }
    });
    setBusy(false);
    if (error || !data?.ok) {
      setNotice(data?.error || error?.message || 'Generation could not be retried.');
      return;
    }
    setLiveGenerations(data.generations || []);
    setNotice('Generation rerouted to a verified provider and restarted.');
  }

  async function disconnectProduction() {
    await supabase?.auth.signOut({ scope: 'global' });
    setProductionUser(null);
    setNotice('Signed out of the governed production workspace.');
  }

  function downloadPackage(generation: LiveGeneration) {
    const blob = new Blob([JSON.stringify(generation.result || {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `visionweaver-${generation.media_type}-${generation.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function generate() {
    if (!prompt.trim()) { setNotice('Describe what you want to create first.'); return; }
    setBusy(true); setAgentLog([]);
    const title = `${modes.find((item) => item.id === mode)?.label} session · ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    if (productionUser && supabase) {
      const ratioMap: Record<string, string> = {
        '16:9': mode === 'image' ? '1360:768' : '1280:720',
        '9:16': mode === 'image' ? '768:1360' : '720:1280',
        '1:1': mode === 'image' ? '1024:1024' : '1280:720',
        '4:5': mode === 'image' ? '1080:1350' : '720:1280'
      };
      const targetDuration = mode === 'video' ? Math.max(5, Math.min(600, Number(videoDuration) || 10)) : mode === 'audio' ? 8 : 5;
      const longForm = mode === 'video' && targetDuration > 10;
      const { data, error } = await supabase.functions.invoke('visionweaver-studio', {
        body: {
          action: 'create',
          media_type: mode,
          prompt,
          title,
          organization_id: identity.organizationId,
          parameters: {
            ratio: ratioMap[aspect],
            quality,
            duration: targetDuration,
            ...(mode === 'video' ? {
              target_duration_seconds: targetDuration,
              continuity_mode: longForm ? continuityMode : 'reference',
              video_generation_profile: longForm ? 'long_form' : 'short_form',
              provider_shot_max_seconds: longForm ? 30 : 10,
              variant_count: 1,
              platform: 'Custom'
            } : {})
          }
        }
      });
      if (error || !data?.ok) {
        setNotice(data?.error || error?.message || 'Generation could not be started.');
      } else {
        await loadLive(false);
        setView('Library');
        setNotice(mode === 'book' || mode === 'movie'
          ? `${modes.find((item) => item.id === mode)?.label} package completed and saved.`
          : mode === 'video'
            ? `${targetDuration}-second video production submitted${longForm ? ` with ${continuityMode === 'extend' ? 'sequential extend continuity' : 'reference continuity'}` : ''}. VisionWeaver will keep processing it if you leave this page.`
            : `${modes.find((item) => item.id === mode)?.label} generation submitted. VisionWeaver will keep processing it if you leave this page.`);
      }
      setBusy(false);
      return;
    }

    const count = mode === 'movie' ? 12 : mode === 'book' ? 10 : mode === 'video' ? Math.max(1, Math.ceil((Number(videoDuration) || 10) / 30)) : 1;
    const item: Job = { id: crypto.randomUUID(), project_title: title, concept: prompt, scene_count: count, target_platform: mode, status: 'planned', approval_state: 'draft', created_at: new Date().toISOString() };
    const steps = ['Reading prompt and references', 'Selecting the production route', 'Building continuity and structure', 'Preparing an editable local plan'];
    for (const step of steps) {
      setAgentLog((current) => [...current, step]);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    setJobs((current) => [item, ...current]);
    setScenes((current) => [...planScenes(item, count, prompt), ...current]);
    setActiveId(item.id); setView('Workflows');
    setNotice(`${title} saved as a local plan. Sign in at the system entrance to render real media and store durable outputs.`);
    setBusy(false);
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const next = files.map((file): Asset => {
      const kind: Asset['kind'] = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document';
      return { id: crypto.randomUUID(), name: file.name, kind, size: `${Math.max(0.1, file.size / 1024 / 1024).toFixed(1)} MB`, url: kind === 'image' ? URL.createObjectURL(file) : undefined, created_at: new Date().toISOString() };
    });
    setAssets((current) => [...next, ...current]); setNotice(`${next.length} reference asset${next.length === 1 ? '' : 's'} added.`); event.target.value = '';
  }

  function useApp(name: string, category: string, description: string) {
    const next = category.toLowerCase().includes('book') ? 'book' : category.toLowerCase().includes('audio') ? 'audio' : category.toLowerCase().includes('image') ? 'image' : category.toLowerCase().includes('movie') ? 'movie' : 'video';
    selectMode(next as StudioMode); setPrompt(`${name}: ${description}`); setNotice(`${name} loaded into Studio.`);
  }

  function useWorkflow(name: string, nextMode: string, description: string) {
    selectMode(nextMode as StudioMode); setPrompt(`${name}. ${description}`); setNotice(`${name} workflow loaded. Add references, edit the brief, then create the plan.`);
  }

  function addCharacter(e: FormEvent) {
    e.preventDefault(); if (!characterForm.name.trim() || !characterForm.description.trim()) return;
    setCharacters((current) => [{ id: crypto.randomUUID(), name: characterForm.name.trim(), description: characterForm.description.trim(), status: 'locked' }, ...current]);
    setCharacterForm({ name: '', description: '' }); setNotice('Character locked for future scenes.');
  }

  const active = jobs.find((job) => job.id === activeId) || jobs[0];
  const activeScenes = scenes.filter((scene) => scene.job_id === active?.id);
  const filteredApps = apps.filter((item) => `${item[0]} ${item[1]} ${item[2]}`.toLowerCase().includes(search.toLowerCase()));
  const metrics = useMemo(() => ({ jobs: jobs.length, scenes: jobs.reduce((total, job) => total + job.scene_count, 0), assets: assets.length, ready: scenes.filter((scene) => ['ready', 'complete', 'completed'].includes(scene.status)).length }), [jobs, scenes, assets]);

  return <div className="vw-studio-shell">
    <aside className="vw-sidebar">
      <div className="vw-brand"><span><Sparkles /></span><div><b>VisionWeaver</b><small>creative operating studio</small></div></div>
      <button className="vw-new" onClick={() => setAdding(true)}><Plus /> New project</button>
      <nav>{nav.map(([name, Icon]) => <button key={name} className={view === name ? 'active' : ''} onClick={() => setView(name)}><Icon />{name}</button>)}</nav>
      <label>CREATE</label>
      {modes.map((item) => <button className="vw-create-link" key={item.id} onClick={() => selectMode(item.id)}><item.icon />Generate {item.label}</button>)}
      <div className="vw-system-state"><i /><span><b>{health ? 'Engine online' : healthChecked ? 'Engine unavailable' : 'Checking engine'}</b><small>{productionUser ? 'Production connected' : 'Planning mode · production locked'}</small></span></div>
    </aside>

    <main className="vw-main">
      <header className="vw-topbar">
        <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tools, assets and projects" /></label>
        <button onClick={() => fileRef.current?.click()}><Upload /> Add references</button>
        <input ref={fileRef} className="vw-file-input" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" onChange={handleFiles} />
      </header>

      <section className={`vw-production-bar ${productionUser ? 'connected' : ''}`}>
        <span><ShieldCheck /></span>
        <div><b>{productionUser ? 'Production connected' : 'Sign in to render real media'}</b><small>{productionUser ? productionUser.email : health ? `${(['image', 'video', 'audio', 'book', 'movie'] as StudioMode[]).filter((item) => health.readiness[item]).length} of 5 pipelines ready. VisionWeaver automatically routes around an unavailable provider.` : healthChecked ? 'Provider health could not be reached. Local planning remains available.' : 'Checking provider readiness…'}</small></div>
        {productionUser
          ? <><button onClick={() => loadLive(true)}><RefreshCw /> Sync outputs</button><button onClick={disconnectProduction}>Sign out</button></>
          : <span>Use the main dashboard login</span>}
      </section>

      {lesson && <div className="vw-modal" role="dialog" aria-modal="true"><form onSubmit={(event) => event.preventDefault()}>
        <button type="button" className="vw-close" aria-label="Close" onClick={() => setLesson(null)}><X /></button>
        <span className="eyebrow">VISIONWEAVER ACADEMY GUIDE</span><h2>{lesson.title}</h2><p>{lesson.description}</p>
        <ol className="vw-lesson-steps"><li><b>Define the output.</b><span>Write the audience, medium, purpose and acceptance criteria before selecting a model.</span></li><li><b>Build the production contract.</b><span>Attach references, continuity rules, aspect ratio, quality target and approval gate.</span></li><li><b>Generate, inspect and record.</b><span>Review the durable job status, open the output in Library, and preserve the package for the next workflow stage.</span></li></ol>
        <button type="button" onClick={() => { setLesson(null); setView('Studio'); }}><WandSparkles /> Practice in Studio</button>
      </form></div>}

      {adding && <div className="vw-modal" role="dialog" aria-modal="true"><form onSubmit={create}>
        <button type="button" className="vw-close" aria-label="Close" onClick={() => setAdding(false)}><X /></button>
        <span className="eyebrow">NEW CREATIVE PROJECT</span><h2>What are you making?</h2>
        <label>Project title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Format<select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}><option>Movie</option><option>Book</option><option>Video</option><option>Image campaign</option><option>Audio</option><option>Social</option></select></label>
        <label>Scenes or chapters<input type="number" min="1" max="20" value={form.scenes} onChange={(event) => setForm({ ...form, scenes: event.target.value })} /></label>
        <label>Target runtime<select value={form.runtime} onChange={(event) => setForm({ ...form, runtime: event.target.value })}><option value="auto">Auto / scene based</option><option value="30">30 seconds</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option></select></label>
        <label className="wide">Creative concept<textarea required value={form.concept} onChange={(event) => setForm({ ...form, concept: event.target.value })} /></label>
        <button disabled={busy}><Sparkles /> Create editable production</button>
      </form></div>}

      {view === 'Home' && <section className="vw-home">
        <div className="vw-hero"><span className="eyebrow">ONE WORKSPACE · EVERY MEDIUM</span><h1>What do you want to create?</h1><p>Generate images, video, audio, books and complete movies—then keep every asset, character and workflow connected.</p>
          <div className="vw-composer"><div className="vw-ref-row">{assets.slice(0, 4).map((asset) => <span key={asset.id}>{asset.kind === 'image' ? <FileImage /> : asset.kind === 'video' ? <FileVideo /> : asset.kind === 'audio' ? <FileAudio /> : <FileText />}{asset.name}<button onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))}><X /></button></span>)}</div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Start with your idea. Add references, a manuscript, footage, images or audio." /><div><button className="secondary" onClick={() => fileRef.current?.click()}><Plus /> Reference</button><span>{mode === 'video' ? `${videoDurationOptions.find(([value]) => value === videoDuration)?.[1]} · ${model}` : model}</span><button disabled={busy || Boolean(health && !health.readiness[mode] && mode !== 'movie')} onClick={generate}>{busy ? <RefreshCw className="spin" /> : <ArrowRight />}</button></div></div>
          <div className="vw-mode-chips">{modes.map((item) => <button key={item.id} className={mode === item.id ? 'active' : ''} onClick={() => { const config = modes.find((entry) => entry.id === item.id)!; setMode(item.id); setModel(config.models[0]); setPrompt(starterPrompts[item.id]); }}><item.icon />{item.label}</button>)}</div>
        </div>
        <div className="vw-category-row"><button onClick={() => useWorkflow('Product → Campaign', 'image', 'Product references, ad concepts and social derivatives.')}>Marketing campaigns</button><button onClick={() => selectMode('movie')}>Movies</button><button onClick={() => useWorkflow('Weekly Social Factory', 'video', 'Platform variants, captions and thumbnails.')}>Social media</button><button onClick={() => useApp('Lesson Visualizer', 'Video', 'Turn a concept into clear teaching scenes.')}>Educational content</button><button onClick={() => useApp('Character Across Worlds', 'Image', 'Explore one subject across visual styles.')}>Experimental art</button><button onClick={() => setView('Apps')}>Other</button></div>
        <div className="vw-metrics"><article><span>Projects</span><strong>{metrics.jobs}</strong></article><article><span>Scenes + chapters</span><strong>{metrics.scenes}</strong></article><article><span>Reference assets</span><strong>{metrics.assets}</strong></article><article><span>Ready outputs</span><strong>{metrics.ready}</strong></article></div>
        <section><div className="vw-section-title"><div><span className="eyebrow">STARTER APPS</span><h2>Build from a proven creative route</h2></div><button onClick={() => setView('Apps')}>View all <ArrowRight /></button></div><div className="vw-card-grid">{apps.slice(0, 6).map(([name, category, description, Icon]) => <article key={name}><span><Icon /></span><small>{category}</small><h3>{name}</h3><p>{description}</p><button onClick={() => useApp(name, category, description)}>Open app <ArrowRight /></button></article>)}</div></section>
      </section>}

      {view === 'Agent' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">VISIONWEAVER AGENT</span><h1>Build the production with an agent</h1><p>Describe the outcome; the agent creates an editable plan and preserves approval gates.</p></div><div className="vw-agent"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /><div className="vw-agent-actions"><button onClick={() => useWorkflow('Idea → Feature Film', 'movie', workflows[1][2])}>Movie workflow</button><button onClick={() => useWorkflow('Book → Audiobook → Trailer', 'book', workflows[0][2])}>Book workflow</button><button onClick={() => useWorkflow('Product → Campaign', 'image', workflows[3][2])}>Ad campaign</button><button disabled={busy || Boolean(health && !health.readiness[mode] && mode !== 'movie')} onClick={generate}><Sparkles /> Build with Agent</button></div>{agentLog.length > 0 && <ol className="vw-agent-log">{agentLog.map((entry) => <li key={entry}><CheckCircle2 />{entry}</li>)}</ol>}</div></section>}

      {view === 'Studio' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">MULTIMODAL TOOL STUDIO</span><h1>{modes.find((item) => item.id === mode)?.label} Studio</h1><p>{modes.find((item) => item.id === mode)?.description}</p></div><div className="vw-studio-tabs">{modes.map((item) => <button className={mode === item.id ? 'active' : ''} key={item.id} onClick={() => selectMode(item.id)}><item.icon />{item.label}</button>)}</div><div className="vw-tool-grid"><section className="vw-upload-zone" onClick={() => fileRef.current?.click()}><Upload /><h3>Add references</h3><p>Images, video, audio, PDF, DOCX or TXT</p><small>{assets.length} attached to this workspace</small></section><section className="vw-settings"><label>Model<select value={model} onChange={(event) => setModel(event.target.value)}>{modes.find((item) => item.id === mode)?.models.map((item) => <option key={item}>{item}</option>)}</select></label><label>Instructions<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label><div className="vw-setting-row"><label>Aspect<select value={aspect} onChange={(event) => setAspect(event.target.value)}><option>16:9</option><option>9:16</option><option>1:1</option><option>4:5</option></select></label><label>Quality<select value={quality} onChange={(event) => setQuality(event.target.value)}><option>Draft</option><option>Standard</option><option>High</option></select></label></div>{mode === 'video' && <><div className="vw-setting-row"><label>Runtime<select value={videoDuration} onChange={(event) => setVideoDuration(event.target.value)}>{videoDurationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Continuity<select value={continuityMode} onChange={(event) => setContinuityMode(event.target.value as 'reference' | 'extend')}><option value="extend">Extend prior shot</option><option value="reference">Reference continuity</option></select></label></div><small>{Number(videoDuration) > 10 ? `Long-form: VisionWeaver will create ${Math.ceil(Number(videoDuration) / 30)} sequential segment${Math.ceil(Number(videoDuration) / 30) === 1 ? '' : 's'} and ${continuityMode === 'extend' ? 'continue each segment from the completed prior video' : 'preserve continuity by prompt/reference'}.` : 'Short-form: one provider shot. Choose more than 10 seconds to activate the long-form Seedance route.'}</small></>}<button disabled={busy || Boolean(health && !health.readiness[mode] && mode !== 'movie')} onClick={generate}><Sparkles /> Create {mode === 'book' ? 'book plan' : mode === 'movie' ? 'movie plan' : `${mode} job`}</button></section></div></section>}

      {view === 'Apps' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">CREATIVE APPS</span><h1>Everything needed to make anything</h1><p>Each app opens with its workflow, medium and starting brief already selected.</p></div><div className="vw-card-grid">{filteredApps.map(([name, category, description, Icon]) => <article key={name}><span><Icon /></span><small>{category}</small><h3>{name}</h3><p>{description}</p><button onClick={() => useApp(name, category, description)}>Open app <ArrowRight /></button></article>)}</div></section>}

      {view === 'Workflows' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">PROJECTS + WORKFLOWS</span><h1>Reusable production systems</h1><p>Open a project to inspect its scenes, or load a workflow into Studio.</p></div><div className="vw-workspace-grid"><section className="vw-project-list"><div className="vw-section-title"><h2>Projects</h2><button onClick={() => setAdding(true)}><Plus /> New</button></div>{jobs.map((job) => <button className={active?.id === job.id ? 'active' : ''} onClick={() => setActiveId(job.id)} key={job.id}><span><b>{job.project_title}</b><small>{job.target_platform} · {job.scene_count} units</small></span><em>{job.status.replaceAll('_', ' ')}</em></button>)}</section><section className="vw-storyboard"><div className="vw-section-title"><div><small>{active?.approval_state}</small><h2>{active?.project_title || 'Select a project'}</h2></div><button onClick={() => selectMode((active?.target_platform?.toLowerCase() as StudioMode) || 'video')}><Settings2 /> Edit in Studio</button></div>{active && <p>{active.concept}</p>}<div>{activeScenes.map((scene) => <article key={scene.id}><span>{String(scene.scene_index).padStart(2, '0')}</span><div><b>{scene.scene_id}</b><p>{scene.prompt}</p><small>{scene.provider || 'model not selected'} · {scene.status} · QC {scene.qc_state}</small></div></article>)}</div></section></div><div className="vw-workflow-grid">{workflows.map(([name, nextMode, description]) => <article key={name}><Workflow /><h3>{name}</h3><p>{description}</p><button onClick={() => useWorkflow(name, nextMode, description)}>Use workflow <ArrowRight /></button></article>)}</div></section>}

      {view === 'Characters' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">CONTINUITY SYSTEM</span><h1>Characters, voices and visual identity</h1><p>Lock the traits every generation must preserve.</p></div><form className="vw-character-form" onSubmit={addCharacter}><input required placeholder="Character name" value={characterForm.name} onChange={(event) => setCharacterForm({ ...characterForm, name: event.target.value })} /><textarea required placeholder="Appearance, wardrobe, personality, voice and non-negotiable continuity details" value={characterForm.description} onChange={(event) => setCharacterForm({ ...characterForm, description: event.target.value })} /><button><Plus /> Lock character</button></form><div className="vw-character-grid">{characters.map((character) => <article key={character.id}><span><Users /></span><div><small>{character.status}</small><h3>{character.name}</h3><p>{character.description}</p></div><button onClick={() => { setPrompt(`Create a scene featuring ${character.name}. Preserve: ${character.description}`); setView('Studio'); }}><WandSparkles /> Create with character</button></article>)}</div></section>}

      {view === 'Library' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">CONNECTED MEDIA LIBRARY</span><h1>References and generated assets</h1><p>Production outputs are stored in the connected workspace; local references remain on this device.</p></div>
        {liveGenerations.length > 0 && <section className="vw-live-library"><div className="vw-section-title"><div><span className="eyebrow">LIVE OUTPUTS</span><h2>Production generations</h2></div><button onClick={() => loadLive(true)}><RefreshCw /> Refresh</button></div><div className="vw-generation-grid">{liveGenerations.map((generation) => <article key={generation.id} className={`status-${generation.status}`}>
          <div className="vw-generation-preview">{generation.playable_urls?.[0]
            ? generation.media_type === 'image' ? <img src={generation.playable_urls[0]} alt="" />
              : generation.media_type === 'video' ? <video controls preload="metadata" src={generation.playable_urls[0]} />
              : generation.media_type === 'audio' ? <audio controls src={generation.playable_urls[0]} />
              : <FileText />
            : generation.status === 'complete' && (generation.media_type === 'book' || generation.media_type === 'movie') ? <BookOpen />
            : generation.status === 'failed' ? <X /> : <RefreshCw className="spin" />}</div>
          <small>{generation.media_type} · {generation.model}</small><h3>{generation.prompt.slice(0, 90)}</h3>
          <p>{generation.error || generation.status.replaceAll('_', ' ')}</p>
          {generation.progress && <p>Shots: {generation.progress.complete}/{generation.progress.total} complete{generation.progress.failed ? ` · ${generation.progress.failed} failed` : ''}</p>}
          {generation.media_type === 'video' && (generation.playable_urls?.length || 0) > 1 && <div className="vw-agent-actions">{generation.playable_urls!.map((url, index) => <a key={`${generation.id}-${index}`} href={url} target="_blank" rel="noreferrer"><Play /> Clip {index + 1}</a>)}</div>}
          {(generation.media_type === 'book' || generation.media_type === 'movie') && generation.status === 'complete' && <button onClick={() => downloadPackage(generation)}><FileText /> Download package</button>}
          {generation.status === 'failed' && <button disabled={busy} onClick={() => retryGeneration(generation.id)}><RefreshCw /> Retry with verified provider</button>}
          {generation.playable_urls?.[0] && <a href={generation.playable_urls[0]} target="_blank" rel="noreferrer"><Play /> Open first output</a>}
        </article>)}</div></section>}
        <button className="vw-library-upload" onClick={() => fileRef.current?.click()}><Upload /> Upload images, video, audio or manuscripts</button>{assets.length ? <div className="vw-asset-grid">{assets.map((asset) => <article key={asset.id}>{asset.url ? <img src={asset.url} alt="" /> : <span>{asset.kind === 'video' ? <FileVideo /> : asset.kind === 'audio' ? <FileAudio /> : asset.kind === 'document' ? <FileText /> : <FileImage />}</span>}<div><b>{asset.name}</b><small>{asset.kind} · {asset.size}</small></div><button aria-label={`Remove ${asset.name}`} onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))}><X /></button></article>)}</div> : <div className="vw-empty"><FolderOpen /><h3>No assets yet</h3><p>Add Drive exports, manuscripts, reference images, footage or audio.</p></div>}</section>}

      {view === 'Academy' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">VISIONWEAVER ACADEMY</span><h1>Learn the complete pipeline</h1><p>Short operating guides built around the original 16-node VisionWeaver system.</p></div><div className="vw-academy-grid">{[['01', 'Prompt + reference intake', 'Prepare source material and a clear creative outcome.'], ['02', 'Character and environment lock', 'Protect visual continuity before generating shots.'], ['03', 'Scene breakdown + cinematography', 'Convert narrative beats into render-ready scenes.'], ['04', 'Audio direction', 'Plan dialogue, score, ambience and sound effects.'], ['05', 'Generation + review', 'Queue models, compare results and apply QC gates.'], ['06', 'Assembly + publishing', 'Create masters and platform-specific derivatives.']].map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p><button onClick={() => setLesson({ title, description })}>Start lesson <ArrowRight /></button></article>)}</div></section>}

      {notice && <div className="vw-toast" role="status"><CheckCircle2 /><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}><X /></button></div>}
    </main>
  </div>;
}
