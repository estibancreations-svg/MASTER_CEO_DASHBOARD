// VisionWeaver Book Director: request handler.
// People call it signed in (organization members). pg_cron calls "tick" with
// the Vault-backed VISIONWEAVER_CRON_SECRET, the same pattern as visionweaver-studio.
import { BUCKET, claude, clip, db, logEvent, secret, type Row } from './lib.ts';
import { FONTKIT, GATES, RUNNABLE, TIERS, assembleOutputs, decideGate, loadFonts, normalizeOptions, runBookStep, type Gate } from './pipeline.ts';
import { rankScan, runScanSource, startScan } from './radar.ts';
import { buildEpub, buildPdf, validateEpub, validatePdf, type AssemblyBook } from './assemble.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const ALLOWED_ORIGINS = new Set(['https://master-ceo-dashboard.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173']);
// A second unit of work is only chained when the first one finished quickly.
const TICK_BUDGET_MS = 20000;

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isProjectDeployment = /^https:\/\/master-ceo-dashboard(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) || isProjectDeployment ? origin : 'https://master-ceo-dashboard.vercel.app',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'vary': 'Origin',
    'cache-control': 'no-store'
  };
}

function response(req: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors(req) });
}

async function currentUser(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: membership } = await db.from('ceo_organization_memberships')
    .select('organization_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .in('role', ['architect', 'ceo', 'operator'])
    .limit(1)
    .maybeSingle();
  return membership ? { id: data.user.id, organization_id: membership.organization_id as string, role: membership.role as string } : null;
}

async function isCron(req: Request) {
  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const expected = await secret('VISIONWEAVER_CRON_SECRET');
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

// ------------------------------------------------------------- worker
async function tick(worker: string) {
  const started = Date.now();
  const acted: Row[] = [];
  while (Date.now() - started < TICK_BUDGET_MS) {
    const { data: claim, error } = await db.rpc('vw_book_claim_work', { p_worker: worker });
    if (error) { console.error('[book-director] claim failed', error.message); break; }
    if (!claim) break;
    if (claim.kind === 'book') {
      let state = await runBookStep(claim.id);
      acted.push({ kind: 'book', id: claim.id, status: state.status });
      // keep going on the same book while there is time, to move faster
      while (state.runnable && Date.now() - started < TICK_BUDGET_MS) {
        const { data: again } = await db.from('vw_books').update({ locked_at: new Date().toISOString(), locked_by: worker })
          .eq('id', claim.id).is('locked_at', null).in('status', RUNNABLE).select('id');
        if (!again?.length) break;
        state = await runBookStep(claim.id);
        acted.push({ kind: 'book', id: claim.id, status: state.status });
      }
      break;
    }
    if (claim.kind === 'scan_source') { await runScanSource(claim.id); acted.push(claim); continue; }
    if (claim.kind === 'scan_rank') { await rankScan(claim.id); acted.push(claim); break; }
    break;
  }
  if (acted.length) console.log('[book-director] tick', JSON.stringify({ worker, ms: Date.now() - started, acted }));
  return acted;
}

function background(work: Promise<unknown>) {
  const guarded = work.catch((error) => console.error('[book-director] background failure', String(error?.message || error)));
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(guarded);
}

// ------------------------------------------------------------ actions
async function loadBook(user: { organization_id: string }, bookId: unknown) {
  const { data: book } = await db.from('vw_books').select('*').eq('id', String(bookId || '')).eq('organization_id', user.organization_id).maybeSingle();
  if (!book) throw new Error('Book not found');
  return book as Row;
}

async function createBook(user: { id: string; organization_id: string }, input: { idea: string; brief?: Row | null; source_type: string; source: Row; options: Row }) {
  const options = normalizeOptions(input.options);
  const idea = clip(input.idea, 8000);
  if (!input.brief && idea.length < 12) throw new Error('Describe the book idea in at least a sentence');
  const { data: book, error } = await db.from('vw_books').insert({
    organization_id: user.organization_id,
    owner_id: user.id,
    title: clip(input.brief?.title || idea.slice(0, 80), 160),
    idea,
    brief: input.brief || null,
    status: input.brief ? 'research' : 'intake',
    source_type: input.source_type,
    source: input.source,
    options
  }).select('*').single();
  if (error) throw new Error('Book insert failed: ' + error.message);
  await logEvent({ book_id: book.id }, 'intake', 'info', 'Book started from ' + input.source_type.replace('_', ' ') + ' (' + TIERS[options.length_tier].label + ', ' + options.approval_mode + ' approvals).');
  return book;
}

async function overview(user: { organization_id: string }) {
  const [books, queue, scans, sources] = await Promise.all([
    db.from('vw_books').select('id,title,status,paused_stage,source_type,options,error,is_test,usage,revision_round,created_at,updated_at,completed_at,cover,brief')
      .eq('organization_id', user.organization_id).order('created_at', { ascending: false }).limit(60),
    db.from('vw_book_idea_queue').select('*').eq('organization_id', user.organization_id).eq('status', 'queued').order('created_at', { ascending: false }).limit(40),
    db.from('vw_book_trend_scans').select('id,scan_type,params,requested_by,status,summary,error,started_at,completed_at')
      .eq('organization_id', user.organization_id).order('started_at', { ascending: false }).limit(8),
    db.from('vw_book_sources').select('*').order('name')
  ]);
  const bookIds = (books.data || []).map((book: Row) => book.id);
  const scanIds = (scans.data || []).map((scan: Row) => scan.id);
  const [chapters, opportunities, scanSources] = await Promise.all([
    bookIds.length ? db.from('vw_book_chapters').select('book_id,status,word_count').in('book_id', bookIds) : Promise.resolve({ data: [] as Row[] }),
    scanIds.length ? db.from('vw_book_opportunities').select('*').in('scan_id', scanIds).order('rank') : Promise.resolve({ data: [] as Row[] }),
    scanIds.length ? db.from('vw_book_trend_scan_sources').select('scan_id,source_slug,source_name,method,status,item_count,error').in('scan_id', scanIds).order('source_name') : Promise.resolve({ data: [] as Row[] })
  ]);
  const progress: Record<string, Row> = {};
  for (const chapter of chapters.data || []) {
    const entry = progress[chapter.book_id] || { total: 0, done: 0, words: 0 };
    entry.total += 1;
    if (['drafted', 'revised'].includes(chapter.status)) entry.done += 1;
    entry.words += chapter.word_count || 0;
    progress[chapter.book_id] = entry;
  }
  return {
    books: (books.data || []).map((book: Row) => ({ ...book, cover: book.cover ? { status: book.cover.status } : null, brief: book.brief ? { genre: book.brief.genre, audience: book.brief.audience } : null, progress: progress[book.id] || { total: 0, done: 0, words: 0 } })),
    queue: queue.data || [],
    scans: (scans.data || []).map((scan: Row) => ({ ...scan, sources: (scanSources.data || []).filter((source: Row) => source.scan_id === scan.id) })),
    opportunities: opportunities.data || [],
    sources: sources.data || [],
    tiers: TIERS,
    gates: GATES
  };
}

async function bookDetail(user: { organization_id: string }, bookId: unknown) {
  const book = await loadBook(user, bookId);
  const [chapters, approvals, events] = await Promise.all([
    db.from('vw_book_chapters').select('id,chapter_number,title,description,target_words,word_count,parts_total,parts_done,status,revision_notes,error,research').eq('book_id', book.id).order('chapter_number'),
    db.from('vw_book_approvals').select('*').eq('book_id', book.id).order('decided_at', { ascending: false }),
    db.from('vw_book_events').select('at,stage,level,message').eq('book_id', book.id).order('at', { ascending: false }).limit(80)
  ]);
  const files: Row = {};
  const stored = book.outputs?.files || {};
  const paths = Object.values(stored).map((file: any) => file.path).filter(Boolean);
  if (book.cover?.storage_path && !paths.includes(book.cover.storage_path)) paths.push(book.cover.storage_path);
  if (paths.length) {
    const { data } = await db.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const entry of data || []) if (entry.signedUrl && entry.path) files[entry.path.split('/').pop() as string] = entry.signedUrl;
  }
  return {
    book,
    chapters: (chapters.data || []).map((chapter: Row) => ({ ...chapter, research: chapter.research ? { grounded: chapter.research.grounded, sources: chapter.research.sources || [] } : null })),
    approvals: approvals.data || [],
    events: events.data || [],
    files
  };
}

function sampleBook(): AssemblyBook {
  const text = 'This is a built-in check of the assembly line. It uses “curly quotes”, an em dash — like this — and accents such as café.\n\n## A subheading\n\nA second paragraph with **bold** and *italic* words so every font style is exercised.\n\n- First point\n- Second point\n\n> A short quoted line.';
  return {
    title: 'Assembly Line Self-Test', subtitle: 'Not a real book', author: '', year: new Date().getUTCFullYear(), description: 'Self-test output.', language: 'en', isbn: '', trim: '6x9',
    chapters: [1, 2, 3].map((number) => ({ number, title: 'Test Chapter ' + number, markdown: (text + '\n\n').repeat(6) })),
    sources: [{ title: 'Example source', url: 'https://example.com/source' }], cover: null
  };
}

async function selfTest() {
  const report: Row = { at: new Date().toISOString() };
  const fonts = await loadFonts();
  report.fonts = fonts.note;
  const book = sampleBook();
  const pdf = await buildPdf(book, { includeCover: false, fonts: fonts.fonts, fontkit: FONTKIT });
  report.pdf = { ...(await validatePdf(pdf.bytes)), fonts_embedded: pdf.fontsEmbedded, bytes: pdf.bytes.length, notes: pdf.notes };
  const epub = await buildEpub(book);
  report.epub = { ...(await validateEpub(epub)), bytes: epub.length };
  const upload = await db.storage.from(BUCKET).upload('system/selftest/interior.pdf', pdf.bytes, { contentType: 'application/pdf', upsert: true });
  report.storage = upload.error ? 'upload failed: ' + upload.error.message : 'ok';
  if (!upload.error) {
    const { data } = await db.storage.from(BUCKET).createSignedUrl('system/selftest/interior.pdf', 3600);
    report.pdf_url = data?.signedUrl || null;
  }
  try {
    const reply = await claude({ system: 'Reply with the single word READY.', user: 'Status check.', maxTokens: 400 });
    report.model = { ok: /ready/i.test(reply.text), name: reply.model, output_tokens: reply.usage.output_tokens };
  } catch (error) { report.model = { ok: false, error: clip((error as Error).message, 200) }; }
  try {
    const reply = await claude({ fast: true, system: 'Use web search once, then reply with one short sentence.', user: 'What is the top fiction title on the current New York Times best seller list?', maxTokens: 300, search: { maxUses: 1 } });
    report.web_search = { enabled: !reply.searchUnavailable, grounded: reply.grounded, sources: reply.sources.length, model: reply.model, detail: reply.searchUnavailable || undefined };
  } catch (error) { report.web_search = { enabled: false, error: clip((error as Error).message, 200) }; }
  report.runway_configured = Boolean(await secret('RUNWAY_API_ACCESS'));
  return report;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return response(req, { ok: false, error: 'POST only' }, 405);
  try {
    const body: Row = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    // ---- scheduler-only actions
    if (['tick', 'scheduled_scan', 'selftest'].includes(action)) {
      if (!(await isCron(req))) return response(req, { ok: false, error: 'Not authorized' }, 401);
      if (action === 'tick') {
        const worker = 'cron-' + String(body.worker || 1) + '-' + crypto.randomUUID().slice(0, 8);
        if (body.wait) return response(req, { ok: true, acted: await tick(worker) });
        background(tick(worker));
        return response(req, { ok: true, accepted: true }, 202);
      }
      if (action === 'selftest') return response(req, { ok: true, report: await selfTest() });
      const { data: members } = await db.from('ceo_organization_memberships').select('user_id,organization_id,role').eq('status', 'active').in('role', ['architect', 'ceo']).limit(20);
      const started: string[] = [];
      const seen = new Set<string>();
      for (const member of members || []) {
        if (seen.has(member.organization_id)) continue;
        seen.add(member.organization_id);
        try { const scan = await startScan({ id: member.user_id, organization_id: member.organization_id }, 'radar', {}, 'T.H.E.L.M.A. weekly schedule'); started.push(scan.id); }
        catch (error) { console.error('[book-director] scheduled scan skipped', String((error as Error).message)); }
      }
      return response(req, { ok: true, started });
    }

    // ---- signed-in actions
    const user = await currentUser(req);
    if (!user) return response(req, { ok: false, error: 'Sign in with an active organization membership to use the Book Pipeline.' }, 401);

    if (action === 'overview') return response(req, { ok: true, ...(await overview(user)) });
    if (action === 'get') return response(req, { ok: true, ...(await bookDetail(user, body.book_id)) });
    if (action === 'chapter') {
      const book = await loadBook(user, body.book_id);
      const { data: chapter } = await db.from('vw_book_chapters').select('*').eq('id', String(body.chapter_id || '')).eq('book_id', book.id).maybeSingle();
      if (!chapter) throw new Error('Chapter not found');
      return response(req, { ok: true, chapter });
    }
    if (action === 'intake') {
      const book = await createBook(user, { idea: String(body.idea || ''), source_type: 'manual', source: { source_url: clip(body.source_url, 400) }, options: body.options || {} });
      return response(req, { ok: true, book }, 201);
    }
    if (action === 'approve') {
      const gate = String(body.gate || '') as Gate;
      if (!GATES.includes(gate)) throw new Error('Unknown gate');
      const book = await loadBook(user, body.book_id);
      const status = await decideGate(book, gate, String(body.decision || ''), String(body.notes || ''), user.id);
      return response(req, { ok: true, status });
    }
    if (action === 'resume') {
      const book = await loadBook(user, body.book_id);
      if (book.status !== 'paused') throw new Error('This book is not paused');
      const stage = RUNNABLE.includes(book.paused_stage) ? book.paused_stage : 'intake';
      const patch: Row = { status: stage, paused_stage: null, step_attempts: 0, error: null, locked_at: null };
      if (stage === 'critic' && Number(book.critic?.blocking_count || 0) > 0) {
        const blocking = (book.critic.issues || []).filter((issue: Row) => issue.severity === 'blocking');
        const numbers = [...new Set(blocking.map((issue: Row) => issue.chapter_number))];
        for (const number of numbers) {
          await db.from('vw_book_chapters').update({ status: 'needs_revision', revision_notes: blocking.filter((issue: Row) => issue.chapter_number === number) }).eq('book_id', book.id).eq('chapter_number', number);
        }
        patch.status = 'revision';
        patch.revision_round = 1;
        patch.metadata = { ...(book.metadata || {}), revision_return: 'critic' };
      }
      await db.from('vw_books').update(patch).eq('id', book.id);
      await logEvent({ book_id: book.id }, patch.status, 'info', 'Resumed by a director.');
      return response(req, { ok: true, status: patch.status });
    }
    if (action === 'cancel') {
      const book = await loadBook(user, body.book_id);
      if (['complete', 'cancelled'].includes(book.status)) throw new Error('This book is already finished');
      await db.from('vw_books').update({ status: 'cancelled', locked_at: null }).eq('id', book.id);
      await logEvent({ book_id: book.id }, 'cancel', 'warn', 'Cancelled by a director.');
      return response(req, { ok: true, status: 'cancelled' });
    }
    if (action === 'skip_cover') {
      const book = await loadBook(user, body.book_id);
      if (!(book.status === 'cover' || (book.status === 'paused' && book.paused_stage === 'cover'))) throw new Error('This book is not at the cover step');
      await db.from('vw_books').update({ status: 'critic', paused_stage: null, step_attempts: 0, error: null, cover: { status: 'skipped', reason: 'Skipped by a director.' } }).eq('id', book.id);
      await logEvent({ book_id: book.id }, 'cover', 'warn', 'Cover skipped by a director.');
      return response(req, { ok: true, status: 'critic' });
    }
    if (action === 'update_meta') {
      const book = await loadBook(user, body.book_id);
      const options = normalizeOptions({ ...book.options, ...(body.author_name !== undefined ? { author_name: body.author_name } : {}), ...(body.trim_size ? { trim_size: body.trim_size } : {}), ...(Array.isArray(body.formats) ? { formats: body.formats } : {}) });
      const brief = book.brief ? { ...book.brief } : null;
      if (brief && body.title) brief.title = clip(body.title, 160);
      if (brief && body.subtitle !== undefined) brief.subtitle = clip(body.subtitle, 200);
      await db.from('vw_books').update({ options, brief, title: brief?.title || book.title }).eq('id', book.id);
      let reassembled = false;
      if (book.status === 'complete') {
        const fresh = await loadBook(user, book.id);
        const { files, metadata } = await assembleOutputs(fresh);
        await db.from('vw_books').update({ outputs: { files }, metadata: { ...(fresh.metadata || {}), book: metadata } }).eq('id', book.id);
        await logEvent({ book_id: book.id }, 'assembly', 'info', 'Files rebuilt after a title or author change.');
        reassembled = true;
      }
      return response(req, { ok: true, reassembled });
    }
    if (action === 'radar_scan') {
      const scan = await startScan(user, String(body.scan_type || 'radar'), { category: body.category, url: body.url, name: body.name }, 'director');
      return response(req, { ok: true, scan }, 201);
    }
    if (action === 'opportunity') {
      const { data: opportunity } = await db.from('vw_book_opportunities').select('*').eq('id', String(body.opportunity_id || '')).eq('organization_id', user.organization_id).maybeSingle();
      if (!opportunity) throw new Error('Idea not found');
      if (opportunity.status !== 'new') throw new Error('This idea was already decided');
      if (body.decision === 'dismiss') {
        await db.from('vw_book_opportunities').update({ status: 'dismissed' }).eq('id', opportunity.id);
        return response(req, { ok: true, status: 'dismissed' });
      }
      const book = await createBook(user, {
        idea: opportunity.idea.core_promise || opportunity.idea.title, brief: opportunity.idea, source_type: 'trend_radar',
        source: { scan_id: opportunity.scan_id, opportunity_id: opportunity.id, theme: opportunity.theme, score: opportunity.score, rationale: opportunity.evidence?.rationale || '' },
        options: body.options || {}
      });
      await db.from('vw_book_opportunities').update({ status: 'picked', book_id: book.id }).eq('id', opportunity.id);
      return response(req, { ok: true, book }, 201);
    }
    if (action === 'queue_add') {
      const idea = clip(body.idea, 8000);
      if (idea.length < 12) throw new Error('Describe the idea in at least a sentence');
      const { data, error } = await db.from('vw_book_idea_queue').insert({ organization_id: user.organization_id, owner_id: user.id, submitted_by: clip(body.submitted_by || 'director', 60), idea, source_url: clip(body.source_url, 400) || null, options: body.options || {} }).select('*').single();
      if (error) throw new Error(error.message);
      return response(req, { ok: true, item: data }, 201);
    }
    if (action === 'queue_decide') {
      const { data: item } = await db.from('vw_book_idea_queue').select('*').eq('id', String(body.queue_id || '')).eq('organization_id', user.organization_id).maybeSingle();
      if (!item) throw new Error('Queue item not found');
      if (item.status !== 'queued') throw new Error('This idea was already decided');
      if (body.decision === 'dismiss') {
        await db.from('vw_book_idea_queue').update({ status: 'dismissed', decided_at: new Date().toISOString() }).eq('id', item.id);
        return response(req, { ok: true, status: 'dismissed' });
      }
      const book = await createBook(user, { idea: item.idea, source_type: 'thelma_queue', source: { queue_id: item.id, submitted_by: item.submitted_by, source_url: item.source_url || '' }, options: { ...(item.options || {}), ...(body.options || {}) } });
      await db.from('vw_book_idea_queue').update({ status: 'converted', book_id: book.id, decided_at: new Date().toISOString() }).eq('id', item.id);
      return response(req, { ok: true, book }, 201);
    }
    if (action === 'source_toggle') {
      if (!['architect', 'ceo'].includes(user.role)) throw new Error('Only an architect or CEO can change trend sources');
      const { error } = await db.from('vw_book_sources').update({ active: Boolean(body.active) }).eq('slug', String(body.slug || ''));
      if (error) throw new Error(error.message);
      return response(req, { ok: true });
    }
    return response(req, { ok: false, error: 'Unknown action' }, 400);
  } catch (error) {
    const message = String((error as Error)?.message || error);
    console.error('[book-director] request failed', message);
    return response(req, { ok: false, error: message.slice(0, 400) }, 400);
  }
});
