import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, BookOpen, Bot, CheckCircle2, Clapperboard, Film,
  FileAudio, FileImage, FileText, FileVideo, FolderOpen, GraduationCap, Grid3X3,
  Image, Layers3, Library, Mic2, MonitorPlay, Music2, Palette, Play, Plus,
  RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Upload, Users, WandSparkles,
  Workflow, X, Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useIdentity } from '../auth/IdentityContext';

type Job = { id: string; project_title: string; concept: string; scene_count: number; target_platform: string; status: string; approval_state: string; created_at: string };
type Scene = { id: string; job_id: string; scene_index: number; scene_id: string; prompt: string; status: string; provider: string | null; qc_state: string; prompt_version: number };
type Asset = { id: string; name: string; kind: 'image' | 'video' | 'audio' | 'document'; size: string; url?: string; created_at: string };
type Character = { id: string; name: string; description: string; status: string };
type StudioMode = 'image' | 'video' | 'audio' | 'book' | 'movie';

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
  { id: 'video', label: 'Video', icon: Film, models: ['Runway Gen-4.5', 'Kling 3.0', 'Seedance 2.5', 'LTX-2.5'], description: 'Generate, edit, extend, upscale and assemble video.' },
  { id: 'image', label: 'Image', icon: Image, models: ['GPT Image 2', 'FLUX.1', 'Ideogram', 'Stable Diffusion 3.5'], description: 'Create, edit, vary, upscale and expand images.' },
  { id: 'audio', label: 'Audio', icon: Mic2, models: ['ElevenLabs', 'Suno', 'MusicGen', 'Stable Audio'], description: 'Voice, music, dialogue, sound effects and mastering.' },
  { id: 'movie', label: 'Movie', icon: Clapperboard, models: ['VisionWeaver Pipeline', 'Runway + Kling', 'ComfyUI Film Stack'], description: 'Script to storyboard, shots, sound, edit and release.' },
  { id: 'book', label: 'Book', icon: BookOpen, models: ['VisionWeaver Author', 'Claude', 'OpenAI', 'Local LLM'], description: 'Outline, draft, edit, illustrate, lay out and publish.' }
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
  const [form, setForm] = useState({ title: '', concept: '', scenes: '6', platform: 'Movie' });
  const [characterForm, setCharacterForm] = useState({ name: '', description: '' });
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
    const count = Math.max(1, Math.min(40, Number(form.scenes) || 1));
    if (identity.isBuilder) {
      const item: Job = { id: crypto.randomUUID(), project_title: form.title, concept: form.concept, scene_count: count, target_platform: form.platform, status: 'planned', approval_state: 'draft', created_at: new Date().toISOString() };
      setJobs((current) => [item, ...current]);
      setScenes((current) => [...planScenes(item, count, form.concept), ...current]);
      setActiveId(item.id); setAdding(false); setView('Workflows');
      setNotice('Production created and saved on this device. Open Studio to continue.');
      return;
    }
    if (!supabase || !identity.user) return;
    setBusy(true);
    const { data, error } = await supabase.from('production_jobs').insert({ project_title: form.title, concept: form.concept, scene_count: count, target_platform: form.platform, status: 'queued', approval_state: 'draft', owner_id: identity.user.id, created_by: identity.user.email }).select('id,project_title,concept,scene_count,target_platform,status,approval_state,created_at').single();
    if (error) setNotice(error.message); else { setJobs((current) => [data, ...current]); setActiveId(data.id); setAdding(false); setNotice('Production queued for orchestration.'); }
    setBusy(false);
  }

  async function generate() {
    if (!prompt.trim()) { setNotice('Describe what you want to create first.'); return; }
    setBusy(true); setAgentLog([]);
    const title = `${modes.find((item) => item.id === mode)?.label} session · ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    const count = mode === 'movie' ? 12 : mode === 'book' ? 10 : mode === 'video' ? 6 : 1;
    const item: Job = { id: crypto.randomUUID(), project_title: title, concept: prompt, scene_count: count, target_platform: mode, status: identity.isBuilder ? 'planned' : 'queued', approval_state: 'draft', created_at: new Date().toISOString() };
    const steps = ['Reading prompt and references', 'Selecting the production route', 'Building continuity and structure', 'Preparing editable outputs'];
    for (const step of steps) {
      setAgentLog((current) => [...current, step]);
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    if (identity.isBuilder) {
      setJobs((current) => [item, ...current]);
      setScenes((current) => [...planScenes(item, count, prompt), ...current]);
      setActiveId(item.id); setView('Workflows');
      setNotice(`${title} created with ${count} editable ${mode === 'book' ? 'chapters' : 'scenes'}. Live rendering shows as locked until provider credentials pass readiness.`);
    } else if (supabase && identity.user) {
      const { data, error } = await supabase.from('production_jobs').insert({ project_title: item.project_title, concept: item.concept, scene_count: item.scene_count, target_platform: item.target_platform, status: 'queued', approval_state: 'draft', owner_id: identity.user.id, created_by: identity.user.email }).select('id,project_title,concept,scene_count,target_platform,status,approval_state,created_at').single();
      if (error) setNotice(error.message); else { setJobs((current) => [data, ...current]); setActiveId(data.id); setView('Workflows'); setNotice('Generation job queued.'); }
    }
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
      <div className="vw-system-state"><i /><span><b>Workspace online</b><small>{identity.isBuilder ? 'Local-first mode' : 'Supabase live mode'}</small></span></div>
    </aside>

    <main className="vw-main">
      <header className="vw-topbar">
        <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tools, assets and projects" /></label>
        <button onClick={() => fileRef.current?.click()}><Upload /> Add references</button>
        <input ref={fileRef} className="vw-file-input" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" onChange={handleFiles} />
      </header>

      {adding && <div className="vw-modal" role="dialog" aria-modal="true"><form onSubmit={create}>
        <button type="button" className="vw-close" aria-label="Close" onClick={() => setAdding(false)}><X /></button>
        <span className="eyebrow">NEW CREATIVE PROJECT</span><h2>What are you making?</h2>
        <label>Project title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Format<select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}><option>Movie</option><option>Book</option><option>Video</option><option>Image campaign</option><option>Audio</option><option>Social</option></select></label>
        <label>Scenes or chapters<input type="number" min="1" max="40" value={form.scenes} onChange={(event) => setForm({ ...form, scenes: event.target.value })} /></label>
        <label className="wide">Creative concept<textarea required value={form.concept} onChange={(event) => setForm({ ...form, concept: event.target.value })} /></label>
        <button disabled={busy}><Sparkles /> Create editable production</button>
      </form></div>}

      {view === 'Home' && <section className="vw-home">
        <div className="vw-hero"><span className="eyebrow">ONE WORKSPACE · EVERY MEDIUM</span><h1>What do you want to create?</h1><p>Generate images, video, audio, books and complete movies—then keep every asset, character and workflow connected.</p>
          <div className="vw-composer"><div className="vw-ref-row">{assets.slice(0, 4).map((asset) => <span key={asset.id}>{asset.kind === 'image' ? <FileImage /> : asset.kind === 'video' ? <FileVideo /> : asset.kind === 'audio' ? <FileAudio /> : <FileText />}{asset.name}<button onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))}><X /></button></span>)}</div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Start with your idea. Add references, a manuscript, footage, images or audio." /><div><button className="secondary" onClick={() => fileRef.current?.click()}><Plus /> Reference</button><span>{model}</span><button disabled={busy} onClick={generate}>{busy ? <RefreshCw className="spin" /> : <ArrowRight />}</button></div></div>
          <div className="vw-mode-chips">{modes.map((item) => <button key={item.id} className={mode === item.id ? 'active' : ''} onClick={() => { const config = modes.find((entry) => entry.id === item.id)!; setMode(item.id); setModel(config.models[0]); setPrompt(starterPrompts[item.id]); }}><item.icon />{item.label}</button>)}</div>
        </div>
        <div className="vw-category-row"><button onClick={() => useWorkflow('Product → Campaign', 'image', 'Product references, ad concepts and social derivatives.')}>Marketing campaigns</button><button onClick={() => selectMode('movie')}>Movies</button><button onClick={() => useWorkflow('Weekly Social Factory', 'video', 'Platform variants, captions and thumbnails.')}>Social media</button><button onClick={() => useApp('Lesson Visualizer', 'Video', 'Turn a concept into clear teaching scenes.')}>Educational content</button><button onClick={() => useApp('Character Across Worlds', 'Image', 'Explore one subject across visual styles.')}>Experimental art</button><button onClick={() => setView('Apps')}>Other</button></div>
        <div className="vw-metrics"><article><span>Projects</span><strong>{metrics.jobs}</strong></article><article><span>Scenes + chapters</span><strong>{metrics.scenes}</strong></article><article><span>Reference assets</span><strong>{metrics.assets}</strong></article><article><span>Ready outputs</span><strong>{metrics.ready}</strong></article></div>
        <section><div className="vw-section-title"><div><span className="eyebrow">STARTER APPS</span><h2>Build from a proven creative route</h2></div><button onClick={() => setView('Apps')}>View all <ArrowRight /></button></div><div className="vw-card-grid">{apps.slice(0, 6).map(([name, category, description, Icon]) => <article key={name}><span><Icon /></span><small>{category}</small><h3>{name}</h3><p>{description}</p><button onClick={() => useApp(name, category, description)}>Open app <ArrowRight /></button></article>)}</div></section>
      </section>}

      {view === 'Agent' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">VISIONWEAVER AGENT</span><h1>Build the production with an agent</h1><p>Describe the outcome; the agent creates an editable plan and preserves approval gates.</p></div><div className="vw-agent"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /><div className="vw-agent-actions"><button onClick={() => useWorkflow('Idea → Feature Film', 'movie', workflows[1][2])}>Movie workflow</button><button onClick={() => useWorkflow('Book → Audiobook → Trailer', 'book', workflows[0][2])}>Book workflow</button><button onClick={() => useWorkflow('Product → Campaign', 'image', workflows[3][2])}>Ad campaign</button><button disabled={busy} onClick={generate}><Sparkles /> Build with Agent</button></div>{agentLog.length > 0 && <ol className="vw-agent-log">{agentLog.map((entry) => <li key={entry}><CheckCircle2 />{entry}</li>)}</ol>}</div></section>}

      {view === 'Studio' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">MULTIMODAL TOOL STUDIO</span><h1>{modes.find((item) => item.id === mode)?.label} Studio</h1><p>{modes.find((item) => item.id === mode)?.description}</p></div><div className="vw-studio-tabs">{modes.map((item) => <button className={mode === item.id ? 'active' : ''} key={item.id} onClick={() => selectMode(item.id)}><item.icon />{item.label}</button>)}</div><div className="vw-tool-grid"><section className="vw-upload-zone" onClick={() => fileRef.current?.click()}><Upload /><h3>Add references</h3><p>Images, video, audio, PDF, DOCX or TXT</p><small>{assets.length} attached to this workspace</small></section><section className="vw-settings"><label>Model<select value={model} onChange={(event) => setModel(event.target.value)}>{modes.find((item) => item.id === mode)?.models.map((item) => <option key={item}>{item}</option>)}</select></label><label>Instructions<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label><div className="vw-setting-row"><label>Aspect<select><option>16:9</option><option>9:16</option><option>1:1</option><option>4:5</option></select></label><label>Quality<select><option>Draft</option><option>Standard</option><option>High</option><option>4K delivery</option></select></label></div><button disabled={busy} onClick={generate}><Sparkles /> Create {mode === 'book' ? 'book plan' : mode === 'movie' ? 'movie plan' : `${mode} job`}</button></section></div></section>}

      {view === 'Apps' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">CREATIVE APPS</span><h1>Everything needed to make anything</h1><p>Each app opens with its workflow, medium and starting brief already selected.</p></div><div className="vw-card-grid">{filteredApps.map(([name, category, description, Icon]) => <article key={name}><span><Icon /></span><small>{category}</small><h3>{name}</h3><p>{description}</p><button onClick={() => useApp(name, category, description)}>Open app <ArrowRight /></button></article>)}</div></section>}

      {view === 'Workflows' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">PROJECTS + WORKFLOWS</span><h1>Reusable production systems</h1><p>Open a project to inspect its scenes, or load a workflow into Studio.</p></div><div className="vw-workspace-grid"><section className="vw-project-list"><div className="vw-section-title"><h2>Projects</h2><button onClick={() => setAdding(true)}><Plus /> New</button></div>{jobs.map((job) => <button className={active?.id === job.id ? 'active' : ''} onClick={() => setActiveId(job.id)} key={job.id}><span><b>{job.project_title}</b><small>{job.target_platform} · {job.scene_count} units</small></span><em>{job.status.replaceAll('_', ' ')}</em></button>)}</section><section className="vw-storyboard"><div className="vw-section-title"><div><small>{active?.approval_state}</small><h2>{active?.project_title || 'Select a project'}</h2></div><button onClick={() => selectMode((active?.target_platform?.toLowerCase() as StudioMode) || 'video')}><Settings2 /> Edit in Studio</button></div>{active && <p>{active.concept}</p>}<div>{activeScenes.map((scene) => <article key={scene.id}><span>{String(scene.scene_index).padStart(2, '0')}</span><div><b>{scene.scene_id}</b><p>{scene.prompt}</p><small>{scene.provider || 'model not selected'} · {scene.status} · QC {scene.qc_state}</small></div></article>)}</div></section></div><div className="vw-workflow-grid">{workflows.map(([name, nextMode, description]) => <article key={name}><Workflow /><h3>{name}</h3><p>{description}</p><button onClick={() => useWorkflow(name, nextMode, description)}>Use workflow <ArrowRight /></button></article>)}</div></section>}

      {view === 'Characters' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">CONTINUITY SYSTEM</span><h1>Characters, voices and visual identity</h1><p>Lock the traits every generation must preserve.</p></div><form className="vw-character-form" onSubmit={addCharacter}><input required placeholder="Character name" value={characterForm.name} onChange={(event) => setCharacterForm({ ...characterForm, name: event.target.value })} /><textarea required placeholder="Appearance, wardrobe, personality, voice and non-negotiable continuity details" value={characterForm.description} onChange={(event) => setCharacterForm({ ...characterForm, description: event.target.value })} /><button><Plus /> Lock character</button></form><div className="vw-character-grid">{characters.map((character) => <article key={character.id}><span><Users /></span><div><small>{character.status}</small><h3>{character.name}</h3><p>{character.description}</p></div><button onClick={() => { setPrompt(`Create a scene featuring ${character.name}. Preserve: ${character.description}`); setView('Studio'); }}><WandSparkles /> Create with character</button></article>)}</div></section>}

      {view === 'Library' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">CONNECTED MEDIA LIBRARY</span><h1>References and generated assets</h1><p>Assets added on this device remain available to the workspace session.</p></div><button className="vw-library-upload" onClick={() => fileRef.current?.click()}><Upload /> Upload images, video, audio or manuscripts</button>{assets.length ? <div className="vw-asset-grid">{assets.map((asset) => <article key={asset.id}>{asset.url ? <img src={asset.url} alt="" /> : <span>{asset.kind === 'video' ? <FileVideo /> : asset.kind === 'audio' ? <FileAudio /> : asset.kind === 'document' ? <FileText /> : <FileImage />}</span>}<div><b>{asset.name}</b><small>{asset.kind} · {asset.size}</small></div><button aria-label={`Remove ${asset.name}`} onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))}><X /></button></article>)}</div> : <div className="vw-empty"><FolderOpen /><h3>No assets yet</h3><p>Add Drive exports, manuscripts, reference images, footage or audio.</p></div>}</section>}

      {view === 'Academy' && <section className="vw-page"><div className="vw-page-heading"><span className="eyebrow">VISIONWEAVER ACADEMY</span><h1>Learn the complete pipeline</h1><p>Short operating guides built around the original 16-node VisionWeaver system.</p></div><div className="vw-academy-grid">{[['01', 'Prompt + reference intake', 'Prepare source material and a clear creative outcome.'], ['02', 'Character and environment lock', 'Protect visual continuity before generating shots.'], ['03', 'Scene breakdown + cinematography', 'Convert narrative beats into render-ready scenes.'], ['04', 'Audio direction', 'Plan dialogue, score, ambience and sound effects.'], ['05', 'Generation + review', 'Queue models, compare results and apply QC gates.'], ['06', 'Assembly + publishing', 'Create masters and platform-specific derivatives.']].map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p><button onClick={() => setNotice(`${title} guide opened. The interactive lesson content is ready for the next curriculum pass.`)}>Start lesson <ArrowRight /></button></article>)}</div></section>}

      {notice && <div className="vw-toast" role="status"><CheckCircle2 /><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}><X /></button></div>}
    </main>
  </div>;
}
