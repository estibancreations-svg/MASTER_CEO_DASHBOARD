import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Clapperboard, Film, Image as ImageIcon, Library, Loader2, Music, RefreshCw, Sparkles, Upload, UserRound, Wand2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useIdentity } from '../auth/IdentityContext';

const DURATIONS: Array<[string, string]> = [
  ['5', '5 seconds'], ['10', '10 seconds'], ['30', '30 seconds'], ['60', '1 minute'], ['120', '2 minutes'],
  ['300', '5 minutes'], ['600', '10 minutes']
];

type Tab = 'create' | 'books' | 'characters' | 'library';
type Media = 'image' | 'video' | 'audio';
type Row = Record<string, any>;

const css = `
.vwx{display:grid;grid-template-columns:76px 1fr;min-height:82vh;background:#0b0b10;color:#eceaf4;border-radius:18px;overflow:hidden;font-family:Inter,system-ui,sans-serif}
.vwx *{box-sizing:border-box}
.vwx-rail{background:#111118;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px;border-right:1px solid #22222e}
.vwx-rail button{width:60px;background:none;border:0;color:#8b89a0;padding:10px 4px;border-radius:12px;font-size:11px;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer}
.vwx-rail button.on{background:#1f1d33;color:#d7ff4a}
.vwx-rail svg{width:20px;height:20px}
.vwx-main{padding:22px 26px;overflow:auto}
.vwx h2{margin:0 0 4px;font-size:22px}
.vwx .sub{color:#8b89a0;margin:0 0 18px;font-size:14px}
.vwx .bar{background:#15151f;border:1px solid #26263a;border-radius:16px;padding:14px}
.vwx textarea,.vwx input[type=text],.vwx select{width:100%;background:#0f0f17;border:1px solid #2a2a3f;color:#eceaf4;border-radius:10px;padding:10px;font:inherit}
.vwx textarea{min-height:92px;resize:vertical}
.vwx .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}
.vwx .chip{padding:7px 12px;border-radius:999px;border:1px solid #2a2a3f;background:#0f0f17;color:#b9b7cc;cursor:pointer;font-size:13px}
.vwx .chip.on{border-color:#d7ff4a;color:#d7ff4a}
.vwx .go{background:#d7ff4a;color:#111;border:0;border-radius:12px;padding:11px 20px;font-weight:700;cursor:pointer;display:inline-flex;gap:8px;align-items:center}
.vwx .go:disabled{opacity:.5;cursor:default}
.vwx .ghost{background:#1b1b2b;color:#eceaf4;border:1px solid #2a2a3f;border-radius:10px;padding:8px 12px;cursor:pointer;font-size:13px;display:inline-flex;gap:6px;align-items:center;text-decoration:none}
.vwx .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-top:16px}
.vwx .card{background:#15151f;border:1px solid #26263a;border-radius:14px;overflow:hidden}
.vwx .card .media{aspect-ratio:16/9;background:#0a0a10;display:flex;align-items:center;justify-content:center;color:#6f6d86;font-size:13px;text-align:center;padding:8px}
.vwx .card video,.vwx .card img{width:100%;height:100%;object-fit:cover}
.vwx .card .meta{padding:10px 12px;font-size:12px;color:#9e9cb4}
.vwx .card .meta b{display:block;color:#eceaf4;font-size:13px;margin-bottom:3px}
.vwx .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;background:#23233a}
.vwx .pill.complete{background:#1d3a26;color:#8dffb0}.vwx .pill.failed{background:#3a1d1d;color:#ff9c9c}
.vwx .note{background:#1a1a2a;border:1px solid #2f2f4a;border-radius:12px;padding:12px;font-size:13px;margin:12px 0}
.vwx .err{border-color:#663;color:#ffd37a}
.vwx .refs{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.vwx .refs img{width:54px;height:54px;object-fit:cover;border-radius:10px;border:2px solid transparent;cursor:pointer}
.vwx .refs img.on{border-color:#d7ff4a}
.vwx .chap{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #22222e;font-size:13px}
.vwx .chap small{color:#8b89a0;display:block}
@media(max-width:720px){.vwx{grid-template-columns:1fr}.vwx-rail{flex-direction:row;justify-content:space-around;border-right:0;border-bottom:1px solid #22222e}}
`;

function parseChapters(md: string) {
  const parts = md.split(/^#{1,2}\s+(?=Chapter\s+\d+|Epilogue|Prologue)/im);
  const out: Row[] = [];
  for (const p of parts.slice(1)) {
    const nl = p.indexOf('\n');
    const head = (nl < 0 ? p : p.slice(0, nl)).trim();
    let body = nl < 0 ? '' : p.slice(nl + 1).trim();
    let pov: string | null = null;
    const m = body.match(/^_?POV:\s*([^_\n]+)_?/i);
    if (m) { pov = m[1].trim(); body = body.slice(m[0].length).trim(); }
    out.push({ title: head.replace(/^Chapter\s+\d+:\s*/i, '') || head, pov, text: body, summary: body.slice(0, 400), word_count: body.split(/\s+/).length });
  }
  return out;
}

export default function VisionWeaverWorkspace() {
  const identity = useIdentity();
  const [tab, setTab] = useState<Tab>('create');
  const [data, setData] = useState<Row>({ generations: [], assets: [], characters: [], chapters: [], projects: [] });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [media, setMedia] = useState<Media>('video');
  const [prompt, setPrompt] = useState('');
  const [seconds, setSeconds] = useState(10);
  const [continuityMode, setContinuityMode] = useState<'reference' | 'extend'>('extend');
  const [ratio, setRatio] = useState('1280:720');
  const [picked, setPicked] = useState<string[]>([]);
  const [master, setMaster] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const bookRef = useRef<HTMLInputElement>(null);
  const charFileRef = useRef<HTMLInputElement>(null);
  const [charName, setCharName] = useState('');
  const [charDesc, setCharDesc] = useState('');
  const [charAssets, setCharAssets] = useState<string[]>([]);
  const signedIn = Boolean(supabase && identity.user);

  const call = useCallback(async (body: Row) => {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data: res, error } = await supabase.functions.invoke('visionweaver-studio', { body });
    if (error) {
      let detail = error.message;
      try { const j = await (error as any).context?.json?.(); if (j?.error) detail = j.error; } catch { /* ignore */ }
      throw new Error(detail);
    }
    if (res && res.ok === false) throw new Error(res.error || 'Request failed');
    return res as Row;
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (!signedIn) return;
    try {
      const res = await call({ action: refresh ? 'refresh' : 'list' });
      setData({ generations: res.generations || [], assets: res.assets || [], characters: res.characters || [], chapters: res.chapters || [], projects: res.projects || [] });
    } catch (e: any) { setErr(String(e.message || e)); }
  }, [call, signedIn]);

  useEffect(() => { void load(true); }, [load]);
  const active = useMemo(() => (data.generations as Row[]).some((g) => ['queued', 'processing', 'submitting'].includes(g.status)), [data.generations]);
  useEffect(() => {
    if (!signedIn) return;
    const t = setInterval(() => { void load(active); }, active ? 8000 : 30000);
    return () => clearInterval(t);
  }, [active, load, signedIn]);

  const refAssets = useMemo(() => (data.assets as Row[]).filter((a) => a.kind === 'image' && a.metadata?.uploaded_by_user && a.playable_url), [data.assets]);

  async function uploadImages(files: FileList | null, role: string): Promise<string[]> {
    if (!supabase || !identity.user || !files) return [];
    const ids: string[] = [];
    for (const f of Array.from(files)) {
      const ext = f.type.includes('png') ? 'png' : f.type.includes('webp') ? 'webp' : 'jpg';
      const path = `${identity.user.id}/references/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('visionweaver-outputs').upload(path, f, { contentType: f.type || 'image/jpeg' });
      if (error) throw new Error('Upload failed: ' + error.message);
      const res = await call({ action: 'register_asset', kind: 'image', storage_path: path, title: f.name, mime_type: f.type, metadata: { role, tag: 'ref' } });
      ids.push(res.asset.id);
    }
    return ids;
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setErr(''); setMsg('');
    try { await fn(); } catch (e: any) { setErr(String(e.message || e)); } finally { setBusy(''); }
  }

  async function generate(overridePrompt?: string, refs?: string[], m?: Media) {
    const kind = m || media;
    const text = (overridePrompt ?? prompt).trim();
    const longForm = kind === 'video' && seconds > 10;
    await run('generate', async () => {
      const res = await call({
        action: 'create', media_type: kind, prompt: text, title: text.slice(0, 60), organization_id: identity.organizationId,
        parameters: {
          ratio, duration: seconds, target_duration_seconds: seconds, variant_count: 1, reference_asset_ids: (refs || picked).slice(0, 3),
          continuity_mode: longForm ? continuityMode : 'reference',
          video_generation_profile: longForm ? 'long_form' : 'short_form',
          provider_shot_max_seconds: longForm ? 30 : 10
        }
      });
      setMsg(`Started. Your ${kind} will appear in the Library when it finishes (${res.generation?.status || 'queued'}).`);
      setTab('library');
      await load(true);
    });
  }

  async function importBook(file: File | undefined) {
    if (!file) return;
    await run('book', async () => {
      const text = await file.text();
      const chapters = parseChapters(text);
      if (!chapters.length) throw new Error('No chapters found. Use headings like "## Chapter 1: The News".');
      const title = (text.match(/^#\s+(.+)$/m)?.[1] || file.name.replace(/\.[^.]+$/, '')).slice(0, 150);
      await call({ action: 'import_book', title, chapters, universe: 'Crossroads of Identity' });
      setMsg(`Imported "${title}" with ${chapters.length} chapters.`);
      await load();
    });
  }

  async function saveCharacter() {
    await run('char', async () => {
      await call({ action: 'save_character', name: charName, description: charDesc, visual_anchor: charDesc, reference_asset_ids: charAssets, confirmed: true });
      setCharName(''); setCharDesc(''); setCharAssets([]);
      setMsg('Character saved.');
      await load();
    });
  }

  async function assemble(id: string) {
    await run('assemble', async () => {
      const { data: s } = await supabase!.auth.getSession();
      const r = await fetch('/api/visionweaver-assemble', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.session?.access_token }, body: JSON.stringify({ generation_id: id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Assemble failed');
      setMaster((m) => ({ ...m, [id]: j.master_url }));
      setMsg('Master video built. Scroll to that card to play it.');
      await load();
    });
  }

  function chapterClip(ch: Row) {
    const book = (data.projects as Row[]).find((p) => p.id === ch.project_id);
    const chars = (data.characters as Row[]).filter((c) => String(ch.pov || '').toLowerCase().includes(String(c.name).split(' ')[0].toLowerCase()));
    const refIds: string[] = chars.flatMap((c) => c.bible?.reference_asset_ids || []).slice(0, 1);
    const anchor = chars.map((c) => c.visual_anchor).join(' ');
    const p = `Cinematic film scene, ${book?.title || 'novel'}, chapter "${ch.title}". ${anchor} ${String(ch.excerpt || '').replace(/\s+/g, ' ').slice(0, 520)}`.slice(0, 990);
    setPrompt(p); setPicked(refIds); setMedia('video'); setTab('create');
    setMsg('Prompt filled from the chapter. Review it, then press Generate.');
  }

  const Tabs: [Tab, string, any][] = [['create', 'Create', Wand2], ['books', 'Books', BookOpen], ['characters', 'Cast', UserRound], ['library', 'Library', Library]];

  return (
    <div className="vwx">
      <style>{css}</style>
      <nav className="vwx-rail">
        {Tabs.map(([k, label, Icon]) => (<button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon />{label}</button>))}
      </nav>
      <div className="vwx-main">
        {!signedIn && <div className="note err">Sign in with your email link to save and see your work here. Nothing can be generated while signed out.</div>}
        {msg && <div className="note">{msg}</div>}
        {err && <div className="note err">{err}</div>}

        {tab === 'create' && (<>
          <h2>Create</h2><p className="sub">Describe a shot. Pick a character photo to keep the same face.</p>
          <div className="bar">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A tall man in a burgundy tie stands in a glass office at sunrise, camera slowly pushes in…" maxLength={1000} />
            <div className="row">
              {(['video', 'image', 'audio'] as Media[]).map((m) => (<span key={m} className={'chip ' + (media === m ? 'on' : '')} onClick={() => setMedia(m)}>{m === 'video' ? <Film size={13} /> : m === 'image' ? <ImageIcon size={13} /> : <Music size={13} />} {m}</span>))}
              {media === 'video' && (<select aria-label="Video length" style={{ width: 130 }} value={String(seconds)} onChange={(e) => setSeconds(Number(e.target.value))}>
                {DURATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>)}
              {media === 'video' && seconds > 10 && (<select aria-label="Continuity" style={{ width: 170 }} value={continuityMode} onChange={(e) => setContinuityMode(e.target.value as 'reference' | 'extend')}>
                <option value="extend">Extend prior shot</option><option value="reference">Reference continuity</option>
              </select>)}
              <select style={{ width: 130 }} value={ratio} onChange={(e) => setRatio(e.target.value)}>
                <option value="1280:720">16:9</option><option value="720:1280">9:16</option><option value="960:960">1:1</option>
              </select>
              <button className="go" style={{ marginLeft: 'auto' }} disabled={!signedIn || prompt.trim().length < 8 || !!busy} onClick={() => void generate()}>
                {busy === 'generate' ? <Loader2 size={16} /> : <Sparkles size={16} />} Generate
              </button>
            </div>
            {media !== 'audio' && (<>
              <div className="row"><b style={{ fontSize: 13 }}>Reference photos</b>
                <button className="ghost" onClick={() => fileRef.current?.click()}><Upload size={14} /> Upload</button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => void run('upload', async () => { const ids = await uploadImages(e.target.files, 'reference'); await load(); setPicked((p) => [...p, ...ids].slice(0, 3)); })} />
                <small style={{ color: '#8b89a0' }}>Pick up to 3. Videos start from the first one.</small></div>
              <div className="refs">{refAssets.map((a) => (<img key={a.id} src={a.playable_url} alt={a.title} className={picked.includes(a.id) ? 'on' : ''} onClick={() => setPicked((p) => p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id].slice(0, 3))} />))}</div>
            </>)}
          </div>
        </>)}

        {tab === 'books' && (<>
          <h2>Books</h2><p className="sub">Bring in a book as a .md or .txt file split by chapter. Each chapter can become a clip.</p>
          <div className="bar"><button className="go" disabled={!signedIn || !!busy} onClick={() => bookRef.current?.click()}><Upload size={16} /> Import book file</button>
            <input ref={bookRef} type="file" accept=".md,.txt,text/markdown,text/plain" hidden onChange={(e) => void importBook(e.target.files?.[0])} /></div>
          {(data.projects as Row[]).filter((p) => p.medium === 'book' && (data.chapters as Row[]).some((c) => c.project_id === p.id)).map((p) => (
            <div key={p.id} className="bar" style={{ marginTop: 14 }}>
              <b>{p.title}</b>
              {(data.chapters as Row[]).filter((c) => c.project_id === p.id).map((c) => (
                <div className="chap" key={c.id}><div>Ch {c.scene_no}: {c.title}<small>{c.pov ? c.pov + ' · ' : ''}{c.word_count || '?'} words</small></div>
                  <button className="ghost" onClick={() => chapterClip(c)}><Clapperboard size={14} /> Make clip</button></div>))}
            </div>))}
        </>)}

        {tab === 'characters' && (<>
          <h2>Cast</h2><p className="sub">Save each character with a look and a reference photo so every clip stays consistent.</p>
          <div className="bar">
            <input type="text" placeholder="Name (e.g. Marcus Reynolds)" value={charName} onChange={(e) => setCharName(e.target.value)} />
            <div style={{ height: 8 }} />
            <textarea placeholder="Look: age, hair, clothes, mood…" value={charDesc} onChange={(e) => setCharDesc(e.target.value)} />
            <div className="row">
              <button className="ghost" onClick={() => charFileRef.current?.click()}><Upload size={14} /> Add photo</button>
              <input ref={charFileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => void run('upload', async () => { const ids = await uploadImages(e.target.files, 'character'); setCharAssets((a) => [...a, ...ids]); await load(); })} />
              <small style={{ color: '#8b89a0' }}>{charAssets.length} photo(s) attached</small>
              <button className="go" style={{ marginLeft: 'auto' }} disabled={!signedIn || !charName.trim() || !!busy} onClick={() => void saveCharacter()}>Save character</button>
            </div>
          </div>
          <div className="grid">{(data.characters as Row[]).map((c) => {
            const a = (data.assets as Row[]).find((x) => (c.bible?.reference_asset_ids || []).includes(x.id));
            return (<div className="card" key={c.id}><div className="media">{a?.playable_url ? <img src={a.playable_url} alt={c.name} /> : 'No photo'}</div><div className="meta"><b>{c.name}</b>{c.visual_anchor}</div></div>);
          })}</div>
        </>)}

        {tab === 'library' && (<>
          <h2>Library <button className="ghost" style={{ marginLeft: 10 }} onClick={() => void load(true)}><RefreshCw size={13} /> Refresh</button></h2>
          <p className="sub">Everything VisionWeaver makes is saved here, not just in Runway.</p>
          <div className="grid">
            {(data.generations as Row[]).map((g) => {
              const url = (master[g.id] || g.playable_urls?.[0]) as string | undefined;
              const isVideo = g.media_type === 'video';
              return (<div className="card" key={g.id}>
                <div className="media">{url ? (isVideo ? <video src={url} controls playsInline /> : g.media_type === 'image' ? <img src={url} alt="" /> : <audio src={url} controls />) : (['failed', 'cancelled'].includes(g.status) ? (g.error || 'Failed') : g.media_type === 'movie' || g.media_type === 'book' ? 'Plan ready' : 'Rendering…')}</div>
                <div className="meta"><b>{String(g.prompt || '').slice(0, 70)}</b>
                  <span className={'pill ' + g.status}>{g.status}</span> {g.progress ? ` ${g.progress.complete}/${g.progress.total} shots` : ''}
                  <div className="row" style={{ marginTop: 6 }}>
                    {g.status === 'failed' && <button className="ghost" onClick={() => void run('retry', async () => { await call({ action: 'retry', generation_id: g.id }); await load(true); })}>Retry</button>}
                    {url && <a className="ghost" href={url} target="_blank" rel="noreferrer" download>Download</a>}
                    {g.provider === 'visionweaver' && g.operation === 'multi_shot_video' && g.status === 'complete' && <button className="ghost" onClick={() => void assemble(g.id)}>Build master</button>}
                  </div></div></div>);
            })}
          </div>
          {!(data.generations as Row[]).length && <div className="note">Nothing here yet. Use Create or Books to make your first clip.</div>}
        </>)}
      </div>
    </div>
  );
}
