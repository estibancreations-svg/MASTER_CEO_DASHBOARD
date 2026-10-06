import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Download, Loader2, Play, Radar, RefreshCw, RotateCcw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Book Pipeline: the director's screen for the visionweaver-book-director function.
// Four stations (idea, research, writing team, assembly) with four approval gates.
// Nothing here fakes progress: every status and number comes from the function.

type Row = Record<string, any>;
type View = 'books' | 'new' | 'radar' | 'queue';

const STATUS: Record<string, string> = {
  intake: 'Reading the idea', research: 'Researching', awaiting_research_approval: 'Needs your decision: research',
  outline: 'Outlining', awaiting_outline_approval: 'Needs your decision: outline', chapters: 'Writing chapters',
  awaiting_chapters_approval: 'Needs your decision: chapters', design: 'Design notes', cover: 'Making the cover',
  critic: 'Consistency check', revision: 'Revising chapters', awaiting_assembly_approval: 'Needs your decision: final assembly',
  assembly: 'Building the files', complete: 'Complete', paused: 'Paused', rejected: 'Rejected', cancelled: 'Cancelled'
};
const STATIONS: Array<[string, string[]]> = [
  ['1 Idea', ['intake']],
  ['2 Research', ['research', 'awaiting_research_approval']],
  ['3 Writing team', ['outline', 'awaiting_outline_approval', 'chapters', 'awaiting_chapters_approval', 'design', 'cover', 'critic', 'revision', 'awaiting_assembly_approval']],
  ['4 Assembly', ['assembly', 'complete']]
];
const RUNNING = new Set(['intake', 'research', 'outline', 'chapters', 'design', 'cover', 'critic', 'revision', 'assembly']);
const MODES: Array<[string, string]> = [
  ['gated', 'Ask me at all four gates'],
  ['hybrid', 'Ask me at the outline and before final assembly'],
  ['full_auto', 'Run without stopping (the Critic can still pause it)']
];
const FILE_LABELS: Record<string, string> = {
  'manuscript.md': 'Manuscript (Markdown)', 'interior.pdf': 'Print interior (PDF)', 'reading-copy.pdf': 'Reading copy with cover (PDF)',
  'book.epub': 'E-book (EPUB)', 'metadata.json': 'Metadata (JSON)'
};

const css = `
.bkp h3{margin:22px 0 10px;font-size:16px}
.bkp .tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}
.bkp .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.bkp .book{display:block;width:100%;text-align:left;background:#15151f;border:1px solid #26263a;border-radius:14px;padding:14px;color:inherit;cursor:pointer;font:inherit}
.bkp .book.on{border-color:#d7ff4a}
.bkp .book b{display:block;font-size:15px;margin-bottom:6px}
.bkp .book small{color:#9e9cb4}
.bkp .tag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;background:#23233a;color:#cfcde0;margin-right:6px}
.bkp .tag.wait{background:#4a4215;color:#ffe135}
.bkp .tag.stop{background:#4a1a2a;color:#ff8aa8}
.bkp .tag.done{background:#1d3a26;color:#8dffb0}
.bkp .stations{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0}
.bkp .stations div{border:1px solid #2a2a3f;border-radius:10px;padding:8px 10px;font-size:12px;color:#8b89a0}
.bkp .stations div.on{border-color:#d7ff4a;color:#d7ff4a}
.bkp .stations div.past{color:#cfcde0}
.bkp .panel{background:#15151f;border:1px solid #26263a;border-radius:14px;padding:16px;margin:14px 0}
.bkp .panel.gate{border-color:#ffe135}
.bkp .panel.stop{border-color:#ff5a87}
.bkp .panel p,.bkp .panel li{font-size:14px;line-height:1.6}
.bkp .panel ul,.bkp .panel ol{padding-left:20px;margin:8px 0}
.bkp table{width:100%;border-collapse:collapse;font-size:13px}
.bkp th,.bkp td{text-align:left;padding:7px 8px;border-bottom:1px solid #22222e;vertical-align:top}
.bkp th{color:#9e9cb4;font-weight:600}
.bkp .log{font-size:12px;color:#aaa7bf;max-height:240px;overflow:auto}
.bkp .log div{padding:4px 0;border-bottom:1px solid #1d1d2a}
.bkp .read{white-space:pre-wrap;font-size:14px;line-height:1.7;max-height:420px;overflow:auto;background:#0f0f17;border:1px solid #2a2a3f;border-radius:10px;padding:14px}
.bkp img.cover{max-width:180px;border-radius:8px;border:1px solid #2a2a3f}
.bkp .danger{border-color:#ff5a87;color:#ff8aa8}
@media(max-width:720px){.bkp .stations{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

function when(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
}

function statusTag(status: string) {
  const kind = status.startsWith('awaiting') ? 'wait' : status === 'paused' || status === 'rejected' ? 'stop' : status === 'complete' ? 'done' : '';
  return <span className={'tag ' + kind}>{STATUS[status] || status}</span>;
}

export default function BookPipelineWorkspace({ signedIn }: { signedIn: boolean }) {
  const [view, setView] = useState<View>('books');
  const [data, setData] = useState<Row>({ books: [], queue: [], scans: [], opportunities: [], sources: [], tiers: {} });
  const [detail, setDetail] = useState<Row | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [idea, setIdea] = useState('');
  const [options, setOptions] = useState<Row>({ length_tier: 'standard', approval_mode: 'gated', trim_size: '6x9', tone: '', genre_focus: '', author_name: '', cover: 'generate' });
  const [notes, setNotes] = useState('');
  const [author, setAuthor] = useState('');
  const [reading, setReading] = useState<Row | null>(null);
  const [category, setCategory] = useState('');
  const [feed, setFeed] = useState('');
  const [queueIdea, setQueueIdea] = useState('');

  const call = useCallback(async (body: Row) => {
    if (!supabase) throw new Error('Supabase is not configured');
    const { data: res, error } = await supabase.functions.invoke('visionweaver-book-director', { body });
    if (error) {
      let message = error.message;
      try { const json = await (error as any).context?.json?.(); if (json?.error) message = json.error; } catch { /* keep the default message */ }
      throw new Error(message);
    }
    if (res && res.ok === false) throw new Error(res.error || 'Request failed');
    return res as Row;
  }, []);

  const load = useCallback(async () => {
    if (!signedIn) return;
    try { setData(await call({ action: 'overview' })); } catch (error) { setErr((error as Error).message); }
  }, [call, signedIn]);

  const open = useCallback(async (bookId: string) => {
    setSelected(bookId);
    setReading(null);
    if (!bookId) { setDetail(null); return; }
    try {
      const res = await call({ action: 'get', book_id: bookId });
      setDetail(res);
      setAuthor(res.book?.options?.author_name || '');
    } catch (error) { setErr((error as Error).message); }
  }, [call]);

  const run = useCallback(async (label: string, work: () => Promise<void>) => {
    setBusy(label); setErr(''); setMsg('');
    try { await work(); } catch (error) { setErr((error as Error).message); } finally { setBusy(''); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const anyRunning = useMemo(() => (data.books || []).some((book: Row) => RUNNING.has(book.status)) || (data.scans || []).some((scan: Row) => ['scanning', 'ranking'].includes(scan.status)), [data]);
  useEffect(() => {
    if (!signedIn || !anyRunning) return;
    const timer = window.setInterval(() => { void load(); if (selected) void open(selected); }, 20000);
    return () => window.clearInterval(timer);
  }, [anyRunning, load, open, selected, signedIn]);

  const book: Row | null = detail?.book || null;
  const gate = book?.status?.startsWith('awaiting_') ? book.status.replace('awaiting_', '').replace('_approval', '') : '';
  const scan: Row | null = (data.scans || [])[0] || null;
  const ideas = (data.opportunities || []).filter((item: Row) => scan && item.scan_id === scan.id);
  const waiting = (data.books || []).filter((item: Row) => item.status.startsWith('awaiting')).length;

  const decide = (decision: string) => run('decide', async () => {
    await call({ action: 'approve', book_id: book!.id, gate, decision, notes });
    setNotes('');
    setMsg(decision === 'approved' ? 'Approved. The line is moving again.' : decision === 'rejected' ? 'Book rejected.' : 'Change request sent back to the team.');
    await load(); await open(book!.id);
  });

  const start = () => run('start', async () => {
    const res = await call({ action: 'intake', idea, options });
    setIdea(''); setMsg('Book started. It appears under Books.'); setView('books');
    await load(); await open(res.book.id);
  });

  const readChapter = (chapterId: string) => run('read', async () => {
    const res = await call({ action: 'chapter', book_id: book!.id, chapter_id: chapterId });
    setReading(res.chapter);
  });

  const optionFields = (
    <div className="options">
      <label>Length<select value={options.length_tier} onChange={(e) => setOptions({ ...options, length_tier: e.target.value })}>
        <option value="short">Short read, about 10,000 words</option>
        <option value="standard">Standard, about 30,000 words</option>
        <option value="comprehensive">Comprehensive, about 60,000 words</option>
      </select></label>
      <label>Approvals<select value={options.approval_mode} onChange={(e) => setOptions({ ...options, approval_mode: e.target.value })}>
        {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Page size<select value={options.trim_size} onChange={(e) => setOptions({ ...options, trim_size: e.target.value })}>
        <option value="6x9">6 x 9 inches</option><option value="8.5x11">8.5 x 11 inches</option>
      </select></label>
      <label>Cover image<select value={options.cover} onChange={(e) => setOptions({ ...options, cover: e.target.value })}>
        <option value="generate">Make one (uses Runway credits)</option><option value="skip">Skip the cover</option>
      </select></label>
      <label>Tone (optional)<input type="text" value={options.tone} onChange={(e) => setOptions({ ...options, tone: e.target.value })} placeholder="conversational, playful, authoritative" /></label>
      <label>Genre focus (optional)<input type="text" value={options.genre_focus} onChange={(e) => setOptions({ ...options, genre_focus: e.target.value })} placeholder="children's, business, fiction" /></label>
      <label>Author name (optional)<input type="text" value={options.author_name} onChange={(e) => setOptions({ ...options, author_name: e.target.value })} placeholder="Leave blank to add later" /></label>
    </div>
  );

  const gatePanel = () => {
    if (!book || !gate) return null;
    const research = book.research_brief || {};
    const critic = book.critic || {};
    return (
      <div className="panel gate">
        <h3 style={{ marginTop: 0 }}>Your decision: {gate === 'assembly' ? 'final assembly' : gate}</h3>
        {gate === 'research' && (<>
          <p><b>Market signal:</b> {research.market_demand?.signal || 'unknown'}. {research.grounding_note}</p>
          {research.unique_selling_proposition && <p><b>What makes it different:</b> {research.unique_selling_proposition}</p>}
          {research.gap_analysis && <p><b>Gap in the market:</b> {research.gap_analysis}</p>}
          {!!research.audience_pain_points?.length && <><b>Reader problems</b><ul>{research.audience_pain_points.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul></>}
          {!!research.competitive_landscape?.length && <table><thead><tr><th>Competing book</th><th>Why it sells</th><th>Gap it leaves</th></tr></thead><tbody>
            {research.competitive_landscape.map((item: Row, index: number) => <tr key={index}><td>{item.title}{item.author ? ', ' + item.author : ''}</td><td>{item.why_it_sells}</td><td>{item.gap_it_leaves}</td></tr>)}
          </tbody></table>}
          {!!research.unverified?.length && <><b>Could not verify</b><ul>{research.unverified.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul></>}
          {!!research.sources?.length && <details><summary>{research.sources.length} sources</summary><ol>{research.sources.map((source: Row, index: number) => <li key={index}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ol></details>}
        </>)}
        {gate === 'outline' && <ol>{(book.outline || []).map((chapter: Row) => <li key={chapter.chapter_number}><b>{chapter.title}.</b> {chapter.description}</li>)}</ol>}
        {gate === 'chapters' && <p>All chapters are drafted. Open any chapter in the list below to read it before you decide.</p>}
        {gate === 'assembly' && (<>
          <p><b>Consistency Critic:</b> {critic.summary || 'No summary.'}</p>
          <p>{critic.blocking_count || 0} blocking issue(s), {critic.minor_count || 0} minor note(s).</p>
          {!!critic.issues?.length && <ul>{critic.issues.map((issue: Row, index: number) => <li key={index}>Chapter {issue.chapter_number} ({issue.severity}, {issue.type}): {issue.description}</li>)}</ul>}
          {book.design?.marketing?.description && <p><b>Back-cover copy:</b> {book.design.marketing.description}</p>}
          {detail?.files && Object.entries(detail.files).filter(([name]) => name.startsWith('cover.')).map(([name, url]) => <img key={name} className="cover" src={url as string} alt="Generated cover illustration" />)}
          {book.cover?.status === 'skipped' && <p>No cover image: {book.cover.reason}</p>}
        </>)}
        <label className="field">Notes (required when asking for changes)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 80 }} placeholder="What should change?" />
        </label>
        <div className="row">
          <button className="go" disabled={!!busy} onClick={() => decide('approved')}><Check size={16} /> Approve</button>
          <button className="ghost" disabled={!!busy || notes.trim().length < 5} onClick={() => decide('changes_requested')}><RotateCcw size={14} /> Request changes</button>
          <button className="ghost danger" disabled={!!busy} onClick={() => decide('rejected')}><X size={14} /> Reject the book</button>
        </div>
      </div>
    );
  };

  return (
    <div className="bkp">
      <style>{css}</style>
      <h2>Book Pipeline</h2>
      <p className="sub">Idea, research, a writing team and assembly. The line stops at each gate until you decide.</p>
      {!signedIn && <div className="note err">Sign in to use the Book Pipeline.</div>}
      {msg && <div className="note" role="status">{msg}</div>}
      {err && <div className="note err" role="alert">{err}</div>}
      <div className="tabs">
        <button className={'chip' + (view === 'books' ? ' on' : '')} onClick={() => setView('books')}>Books{waiting ? ' (' + waiting + ' need you)' : ''}</button>
        <button className={'chip' + (view === 'new' ? ' on' : '')} onClick={() => setView('new')}>New book</button>
        <button className={'chip' + (view === 'radar' ? ' on' : '')} onClick={() => setView('radar')}>Trend Radar</button>
        <button className={'chip' + (view === 'queue' ? ' on' : '')} onClick={() => setView('queue')}>Idea queue{data.queue?.length ? ' (' + data.queue.length + ')' : ''}</button>
        <button className="ghost" disabled={!signedIn} onClick={() => { void load(); if (selected) void open(selected); }}><RefreshCw size={14} /> Refresh</button>
      </div>

      {view === 'new' && (
        <div className="bar">
          <label className="field">Describe the book idea
            <textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Who is it for, what does it promise, and what makes it different?" />
          </label>
          {optionFields}
          <button className="go" disabled={!signedIn || !!busy || idea.trim().length < 12} onClick={start}>{busy === 'start' ? <Loader2 size={16} /> : <Play size={16} />} Start this book</button>
        </div>
      )}

      {view === 'books' && (<>
        {!data.books?.length && <div className="note">No books yet. Start one under New book, or pick an idea from the Trend Radar.</div>}
        <div className="grid">
          {(data.books || []).map((item: Row) => (
            <button key={item.id} className={'book' + (selected === item.id ? ' on' : '')} onClick={() => void open(item.id)}>
              <b>{item.title}</b>
              {statusTag(item.status)}{item.is_test && <span className="tag">TEST</span>}
              <small style={{ display: 'block', marginTop: 8 }}>
                {item.progress?.total ? item.progress.done + ' of ' + item.progress.total + ' chapters, ' + (item.progress.words || 0).toLocaleString() + ' words' : 'No chapters yet'} · {when(item.updated_at)}
              </small>
            </button>
          ))}
        </div>

        {book && (<>
          <h3>{book.title}</h3>
          <div className="stations">
            {STATIONS.map(([label, statuses], index) => {
              const current = statuses.includes(book.status) || (book.status === 'paused' && statuses.includes(book.paused_stage));
              const position = STATIONS.findIndex(([, list]) => list.includes(book.status === 'paused' ? book.paused_stage : book.status));
              return <div key={label} className={current ? 'on' : position > index ? 'past' : ''}>{label}{current ? ': ' + (STATUS[book.status] || book.status) : ''}</div>;
            })}
          </div>
          {book.brief && <p className="stage-note">{book.brief.genre} · for {book.brief.audience} · {data.tiers?.[book.options?.length_tier]?.label || book.options?.length_tier}</p>}

          {gatePanel()}

          {book.status === 'paused' && (
            <div className="panel stop">
              <b>Paused at: {STATUS[book.paused_stage] || book.paused_stage}</b>
              <p>{book.error}</p>
              <div className="row">
                <button className="go" disabled={!!busy} onClick={() => run('resume', async () => { await call({ action: 'resume', book_id: book.id }); setMsg('Resumed.'); await load(); await open(book.id); })}><Play size={16} /> Try again</button>
                {book.paused_stage === 'cover' && <button className="ghost" disabled={!!busy} onClick={() => run('skip', async () => { await call({ action: 'skip_cover', book_id: book.id }); await load(); await open(book.id); })}>Skip the cover</button>}
              </div>
            </div>
          )}

          {book.status === 'complete' && (
            <div className="panel">
              <b>Finished files</b>
              <div className="row" style={{ margin: '10px 0' }}>
                {Object.entries(detail?.files || {}).map(([name, url]) => <a key={name} className="ghost" href={url as string} target="_blank" rel="noreferrer"><Download size={14} /> {FILE_LABELS[name] || (name.startsWith('cover.') ? 'Cover illustration' : name)}</a>)}
              </div>
              <p className="stage-note">Links last one hour; press Refresh for new ones. {book.metadata?.book?.print_readiness?.note}</p>
              {book.metadata?.book?.author_note && <p className="stage-note">{book.metadata.book.author_note}</p>}
              <div className="row">
                <input type="text" style={{ maxWidth: 280 }} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" />
                <button className="ghost" disabled={!!busy} onClick={() => run('meta', async () => { await call({ action: 'update_meta', book_id: book.id, author_name: author }); setMsg('Author saved and files rebuilt.'); await open(book.id); })}>Save name and rebuild files</button>
              </div>
            </div>
          )}

          {!!detail?.chapters?.length && (
            <div className="panel">
              <b>Chapters</b>
              {detail.chapters.map((chapter: Row) => (
                <div key={chapter.id} className="chap">
                  <div>{chapter.chapter_number}. {chapter.title}<small>{chapter.status.replace('_', ' ')} · {(chapter.word_count || 0).toLocaleString()} words{chapter.research ? (chapter.research.grounded ? ' · research verified by web search' : ' · research NOT verified') : ''}</small></div>
                  {chapter.word_count > 0 && <button className="ghost" disabled={!!busy} onClick={() => readChapter(chapter.id)}>Read</button>}
                </div>
              ))}
              {reading && <><h3>Chapter {reading.chapter_number}: {reading.title}</h3><div className="read">{reading.content_md}</div></>}
            </div>
          )}

          <div className="panel">
            <b>Activity</b>
            <div className="log">{(detail?.events || []).map((event: Row, index: number) => <div key={index}>{when(event.at)} · {event.level !== 'info' ? event.level.toUpperCase() + ' · ' : ''}{event.message}</div>)}</div>
            {!['complete', 'cancelled', 'rejected'].includes(book.status) && <button className="ghost danger" style={{ marginTop: 12 }} disabled={!!busy} onClick={() => run('cancel', async () => { await call({ action: 'cancel', book_id: book.id }); await load(); await open(book.id); })}>Cancel this book</button>}
          </div>
        </>)}
      </>)}

      {view === 'radar' && (<>
        <div className="bar">
          <p className="stage-note">T.H.E.L.M.A. reads the trending sections of {(data.sources || []).filter((source: Row) => source.active).length} book sites every Monday. Each site reports honestly whether it returned data. Scores are estimates; the source counts are exact.</p>
          <div className="row">
            <button className="go" disabled={!signedIn || !!busy} onClick={() => run('scan', async () => { await call({ action: 'radar_scan', scan_type: 'radar' }); setMsg('Scan started. It takes about ten minutes.'); await load(); })}><Radar size={16} /> Scan all sites now</button>
            <input type="text" style={{ maxWidth: 200 }} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Google Books category" />
            <button className="ghost" disabled={!signedIn || !!busy || category.trim().length < 3} onClick={() => run('scan', async () => { await call({ action: 'radar_scan', scan_type: 'google_books', category }); setMsg('Category scan started.'); await load(); })}>Scan this category</button>
            <input type="text" style={{ maxWidth: 240 }} value={feed} onChange={(e) => setFeed(e.target.value)} placeholder="https:// RSS feed address" />
            <button className="ghost" disabled={!signedIn || !!busy || !feed.trim().startsWith('https://')} onClick={() => run('scan', async () => { await call({ action: 'radar_scan', scan_type: 'rss', url: feed }); setMsg('Feed scan started.'); await load(); })}>Scan this feed</button>
          </div>
        </div>
        {!scan && <div className="note">No scan has run yet.</div>}
        {scan && (<>
          <h3>Latest scan · {when(scan.started_at)} · {scan.status}{scan.error ? ': ' + scan.error : ''}</h3>
          <p className="stage-note">{scan.summary?.sources_ok ?? scan.sources.filter((source: Row) => source.status === 'ok').length} of {scan.sources.length} sites returned data · {scan.summary?.item_count ?? 0} listings · requested by {scan.requested_by}</p>
          {!!ideas.length && (<>
            <h3>Top ideas to pick from</h3>
            <div className="grid">
              {ideas.map((item: Row) => (
                <div key={item.id} className="panel" style={{ margin: 0 }}>
                  <span className="tag">#{item.rank}</span><span className="tag">score {Math.round(item.score)}</span>{item.status !== 'new' && <span className="tag">{item.status}</span>}
                  <p><b>{item.idea.title}</b>{item.idea.subtitle ? ': ' + item.idea.subtitle : ''}</p>
                  <p className="stage-note">{item.genre} · {item.idea.audience}</p>
                  <p>{item.idea.core_promise}</p>
                  <p className="stage-note">{item.evidence?.rationale}</p>
                  {item.status === 'new' && <div className="row">
                    <button className="go" disabled={!!busy} onClick={() => run('pick', async () => { const res = await call({ action: 'opportunity', opportunity_id: item.id, decision: 'pick', options }); setMsg('Book started from this idea, using the options on the New book tab.'); setView('books'); await load(); await open(res.book.id); })}>Make this book</button>
                    <button className="ghost" disabled={!!busy} onClick={() => run('pick', async () => { await call({ action: 'opportunity', opportunity_id: item.id, decision: 'dismiss' }); await load(); })}>Dismiss</button>
                  </div>}
                </div>
              ))}
            </div>
          </>)}
          {!!scan.summary?.trend_rankings?.length && (<>
            <h3>What is rising</h3>
            <table><thead><tr><th>#</th><th>Theme</th><th>Genre</th><th>Momentum (estimate)</th><th>Examples</th></tr></thead><tbody>
              {scan.summary.trend_rankings.map((item: Row) => <tr key={item.rank}><td>{item.rank}</td><td>{item.theme}<div className="stage-note">{item.why}</div></td><td>{item.genre}</td><td>{item.momentum}</td><td>{(item.example_titles || []).join('; ')}</td></tr>)}
            </tbody></table>
          </>)}
          {!!scan.summary?.cross_listed?.length && (<>
            <h3>Titles on more than one list (exact count)</h3>
            <table><thead><tr><th>Title</th><th>Author</th><th>Lists</th></tr></thead><tbody>
              {scan.summary.cross_listed.map((item: Row, index: number) => <tr key={index}><td>{item.title}</td><td>{item.author}</td><td>{item.source_count}</td></tr>)}
            </tbody></table>
          </>)}
          <h3>Sites checked</h3>
          <table><thead><tr><th>Site</th><th>Result</th><th>Listings</th><th>Note</th></tr></thead><tbody>
            {scan.sources.map((source: Row) => <tr key={source.source_slug}><td>{source.source_name}</td><td>{source.status === 'ok' ? 'Data returned' : source.status === 'no_data' ? 'No data' : source.status === 'failed' ? 'Failed' : 'Waiting'}</td><td>{source.item_count}</td><td>{source.error || ''}</td></tr>)}
          </tbody></table>
        </>)}
      </>)}

      {view === 'queue' && (<>
        <div className="bar">
          <label className="field">Add an idea to the queue
            <textarea value={queueIdea} onChange={(e) => setQueueIdea(e.target.value)} style={{ minHeight: 90 }} placeholder="Ideas wait here until a director starts or dismisses them. T.H.E.L.M.A. agents can add ideas too." />
          </label>
          <button className="ghost" disabled={!signedIn || !!busy || queueIdea.trim().length < 12} onClick={() => run('queue', async () => { await call({ action: 'queue_add', idea: queueIdea }); setQueueIdea(''); await load(); })}>Add to queue</button>
        </div>
        {!data.queue?.length && <div className="note">The idea queue is empty.</div>}
        {(data.queue || []).map((item: Row) => (
          <div key={item.id} className="panel">
            <span className="tag">from {item.submitted_by}</span><span className="tag">{when(item.created_at)}</span>
            <p>{item.idea}</p>
            <div className="row">
              <button className="go" disabled={!!busy} onClick={() => run('queue', async () => { const res = await call({ action: 'queue_decide', queue_id: item.id, decision: 'start', options }); setMsg('Book started, using the options on the New book tab.'); setView('books'); await load(); await open(res.book.id); })}>Start this book</button>
              <button className="ghost" disabled={!!busy} onClick={() => run('queue', async () => { await call({ action: 'queue_decide', queue_id: item.id, decision: 'dismiss' }); await load(); })}>Dismiss</button>
            </div>
          </div>
        ))}
      </>)}
    </div>
  );
}
