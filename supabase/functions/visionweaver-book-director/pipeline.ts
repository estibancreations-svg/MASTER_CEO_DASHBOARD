// VisionWeaver Book Pipeline: Layers 2 to 4. The "Book Director" stage machine.
// Each call to runBookStep does ONE unit of work for one book, so no single
// request runs long. Gates stop the line until a person decides.
import fontkitModule from 'npm:@pdf-lib/fontkit@1.1.1';
import { BUCKET, addUsage, claude, clip, db, logEvent, parseJson, secret, setting, type LlmResult, type Row } from './lib.ts';
import { AUTHOR_PLACEHOLDER, buildEpub, buildManuscriptMarkdown, buildPdf, countWords, sniffImageMime, stripLeadingHeading, validateEpub, validatePdf, type AssemblyBook, type FontBytes } from './assemble.ts';

// The CommonJS build can arrive wrapped in { default }.
export const FONTKIT: any = (fontkitModule as any)?.default?.create ? (fontkitModule as any).default : fontkitModule;

export const TIERS: Record<string, { label: string; total_words: number; chapters: number; words_per_chapter: number }> = {
  short: { label: 'Short read (about 10,000 words)', total_words: 10000, chapters: 6, words_per_chapter: 1700 },
  standard: { label: 'Standard (about 30,000 words)', total_words: 30000, chapters: 10, words_per_chapter: 3000 },
  comprehensive: { label: 'Comprehensive (about 60,000 words)', total_words: 60000, chapters: 16, words_per_chapter: 3750 }
};
export const GATES = ['research', 'outline', 'chapters', 'assembly'] as const;
export type Gate = typeof GATES[number];
const GATES_BY_MODE: Record<string, Gate[]> = {
  gated: ['research', 'outline', 'chapters', 'assembly'],
  hybrid: ['outline', 'assembly'],
  full_auto: []
};
export const RUNNABLE = ['intake', 'research', 'outline', 'chapters', 'design', 'cover', 'critic', 'revision', 'assembly'];
const PART_WORDS = 1900;
const MAX_REVISION_ROUNDS = 2;
const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1';
const RUNWAY_VERSION = '2024-11-06';

const HOUSE_RULES = `You work inside the VisionWeaver Book Pipeline for Estiban Creations.
House rules that always apply:
- Original work only. Never copy sentences, characters or structure from an existing book. Comparable titles are for positioning only.
- Never invent quotes, statistics, studies, dates or anecdotes about real, named people or organizations. If the research you were given does not support a factual claim, leave it out or state it as general knowledge without fake specifics.
- Invented characters and events are fine in fiction and in clearly labelled illustrative examples.
- Write for the stated audience and keep one consistent voice.`;

export function normalizeOptions(input: Row | null | undefined): Row {
  const raw = input || {};
  const tier = TIERS[raw.length_tier] ? raw.length_tier : 'standard';
  const formats = Array.isArray(raw.formats) ? raw.formats.filter((format: string) => ['pdf', 'epub'].includes(format)) : [];
  return {
    length_tier: tier,
    genre_focus: clip(raw.genre_focus || '', 80),
    tone: clip(raw.tone || '', 80),
    formats: formats.length ? formats : ['pdf', 'epub'],
    approval_mode: GATES_BY_MODE[raw.approval_mode] ? raw.approval_mode : 'gated',
    author_name: clip(raw.author_name || '', 120),
    trim_size: raw.trim_size === '8.5x11' ? '8.5x11' : '6x9',
    cover: raw.cover === 'skip' ? 'skip' : 'generate'
  };
}

function briefBlock(book: Row) {
  const options = normalizeOptions(book.options);
  const tier = TIERS[options.length_tier];
  return 'BOOK BRIEF\n' + JSON.stringify(book.brief || {}, null, 1) +
    '\nLENGTH: ' + tier.label + ', ' + tier.chapters + ' chapters of about ' + tier.words_per_chapter + ' words each.' +
    (options.tone ? '\nTONE REQUESTED: ' + options.tone : '') +
    (options.genre_focus ? '\nGENRE FOCUS: ' + options.genre_focus : '');
}

function notesBlock(book: Row, gate: string) {
  const notes = (Array.isArray(book.director_notes) ? book.director_notes : []).filter((note: Row) => note.gate === gate && !note.applied);
  return notes.length ? '\nDIRECTOR NOTES TO APPLY (these override your own choices):\n' + notes.map((note: Row) => '- ' + note.notes).join('\n') : '';
}

function markNotesApplied(book: Row, gate: string) {
  return (Array.isArray(book.director_notes) ? book.director_notes : []).map((note: Row) => (note.gate === gate ? { ...note, applied: true } : note));
}

function hintBlock(hint: string | null) {
  return hint ? '\n\nIMPORTANT: an earlier attempt at this step failed with this problem: "' + hint.slice(0, 300) + '". Fix that this time and follow the output format exactly.' : '';
}

async function save(book: Row, patch: Row, result?: LlmResult | null) {
  const next: Row = { ...patch };
  if (result) next.usage = addUsage(book.usage, result.usage);
  const { error } = await db.from('vw_books').update(next).eq('id', book.id);
  if (error) throw new Error('Book update failed: ' + error.message);
  Object.assign(book, next);
}

async function afterGate(book: Row, gate: Gate, nextStatus: string, snapshot: Row, patch: Row = {}, result?: LlmResult | null) {
  const options = normalizeOptions(book.options);
  const gated = GATES_BY_MODE[options.approval_mode].includes(gate);
  if (gated) {
    await save(book, { ...patch, status: 'awaiting_' + gate + '_approval', step_attempts: 0, error: null }, result);
    await logEvent({ book_id: book.id }, gate, 'info', 'Waiting for approval at the ' + gate + ' gate.');
    return;
  }
  await db.from('vw_book_approvals').insert({
    book_id: book.id, gate, decision: 'auto_approved',
    notes: 'Approval mode "' + options.approval_mode + '" does not stop at this gate.', snapshot
  });
  await save(book, { ...patch, status: nextStatus, step_attempts: 0, error: null }, result);
  await logEvent({ book_id: book.id }, gate, 'info', 'Gate ' + gate + ' passed automatically (' + options.approval_mode + ' mode).');
}

// ------------------------------------------------------------ station 1
async function stepIntake(book: Row, hint: string | null) {
  const options = normalizeOptions(book.options);
  const result = await claude({
    system: HOUSE_RULES + '\nYou are the Idea Parser. Turn a raw book idea into a structured book brief. Return ONLY a JSON object.',
    user: 'RAW IDEA\n' + clip(book.idea, 6000) +
      (book.source?.source_url ? '\nSOURCE URL: ' + book.source.source_url : '') +
      (book.source?.inspiration ? '\nMARKET CONTEXT (for positioning only, never to copy):\n' + clip(JSON.stringify(book.source.inspiration), 3000) : '') +
      (options.genre_focus ? '\nGENRE FOCUS: ' + options.genre_focus : '') +
      (options.tone ? '\nTONE: ' + options.tone : '') +
      '\n\nReturn JSON with exactly these keys: {"title": string, "subtitle": string, "genre": string, "audience": string, "core_promise": string, "comparable_titles": [string], "unique_angle": string, "source_url": string}. ' +
      'The title must be original. comparable_titles: 3 to 5 real published books the reader may know, or an empty list if you are not sure they exist.' + hintBlock(hint),
    maxTokens: 1200
  });
  const brief = parseJson(result.text);
  for (const key of ['title', 'genre', 'audience', 'core_promise']) if (!brief[key]) throw new Error('Brief is missing "' + key + '"');
  brief.comparable_titles = Array.isArray(brief.comparable_titles) ? brief.comparable_titles.slice(0, 6).map(String) : [];
  brief.source_url = clip(brief.source_url || book.source?.source_url || '', 400);
  await save(book, { brief, title: clip(brief.title, 160), status: 'research', step_attempts: 0, error: null }, result);
  await logEvent({ book_id: book.id }, 'intake', 'info', 'Book brief created: "' + clip(brief.title, 120) + '".');
}

// ------------------------------------------------------------ station 2
async function stepResearch(book: Row, hint: string | null) {
  const result = await claude({
    system: HOUSE_RULES + '\nYou are the Research Agent. Validate market fit and gather supporting material for one book idea. Use web search to check real, current information. Report only what the search results support; if you could not verify something, say so in "unverified". Return ONLY a JSON object after your research.',
    user: briefBlock(book) + notesBlock(book, 'research') +
      '\n\nResearch: (1) market demand, including existing bestsellers in this genre; (2) gap analysis, meaning what is underserved; (3) supporting material such as stories, case studies and expert perspectives that could feed chapters.' +
      '\n\nReturn JSON: {"market_demand": {"signal": "strong|moderate|weak|unknown", "evidence": [string]}, "audience_pain_points": [string], "unique_selling_proposition": string, "gap_analysis": string, "competitive_landscape": [{"title": string, "author": string, "why_it_sells": string, "gap_it_leaves": string}], "chapter_research_leads": [{"topic": string, "lead": string}], "unverified": [string]}' + hintBlock(hint),
    maxTokens: 3500,
    search: { maxUses: 6 }
  });
  const research = parseJson(result.text);
  research.sources = result.sources;
  research.grounded = result.grounded;
  research.grounding_note = result.grounded
    ? 'Built from live web search. Sources are listed.'
    : result.searchUnavailable
      ? 'Live web search is not enabled on the Anthropic account, so this brief comes from the model\'s general knowledge and is NOT verified.'
      : 'No web sources came back, so this brief comes from the model\'s general knowledge and is NOT verified.';
  if (!result.grounded) await logEvent({ book_id: book.id }, 'research', 'warn', research.grounding_note, { detail: result.searchUnavailable });
  await afterGate(book, 'research', 'outline', { market_signal: research.market_demand?.signal || 'unknown', grounded: research.grounded },
    { research_brief: research, director_notes: markNotesApplied(book, 'research') }, result);
  await logEvent({ book_id: book.id }, 'research', 'info', 'Research brief ready. Market signal: ' + (research.market_demand?.signal || 'unknown') + '. Sources: ' + result.sources.length + '.');
}

// ------------------------------------------------------------ station 3
async function stepOutline(book: Row, hint: string | null) {
  const options = normalizeOptions(book.options);
  const tier = TIERS[options.length_tier];
  const result = await claude({
    system: HOUSE_RULES + '\nYou are the Outline Agent. Design the chapter plan for the book. Return ONLY a JSON array.',
    user: briefBlock(book) + '\n\nRESEARCH BRIEF\n' + clip(JSON.stringify({ ...book.research_brief, sources: undefined }), 9000) + notesBlock(book, 'outline') +
      '\n\nWrite exactly ' + tier.chapters + ' chapters. Each chapter needs a clear job and they must build on each other with no overlap.' +
      '\nReturn a JSON array: [{"chapter_number": number, "title": string, "description": string}]. Each description is 2 to 4 sentences saying what the chapter covers and what the reader leaves with.' + hintBlock(hint),
    maxTokens: 3000
  });
  const parsed = parseJson(result.text, 'array');
  const list = Array.isArray(parsed) ? parsed : parsed.chapters;
  if (!Array.isArray(list) || list.length < 3) throw new Error('Outline did not contain a chapter list');
  const chapters = list.slice(0, 24).map((chapter: Row, index: number) => ({
    chapter_number: index + 1,
    title: clip(chapter.title || 'Chapter ' + (index + 1), 180).replace(/^chapter\s+\d+\s*[:.\-]\s*/i, ''),
    description: clip(chapter.description || '', 900)
  }));
  await db.from('vw_book_chapters').delete().eq('book_id', book.id);
  const { error } = await db.from('vw_book_chapters').insert(chapters.map((chapter: Row) => ({
    book_id: book.id, ...chapter,
    target_words: tier.words_per_chapter,
    parts_total: Math.max(1, Math.ceil(tier.words_per_chapter / PART_WORDS))
  })));
  if (error) throw new Error('Chapter insert failed: ' + error.message);
  await afterGate(book, 'outline', 'chapters', { chapters: chapters.length }, { outline: chapters, director_notes: markNotesApplied(book, 'outline') }, result);
  await logEvent({ book_id: book.id }, 'outline', 'info', 'Outline ready with ' + chapters.length + ' chapters.');
}

function outlineBlock(book: Row) {
  return 'FULL OUTLINE\n' + (book.outline || []).map((chapter: Row) => chapter.chapter_number + '. ' + chapter.title + ': ' + chapter.description).join('\n');
}

async function stepChapters(book: Row, hint: string | null) {
  const { data: chapters, error } = await db.from('vw_book_chapters').select('*').eq('book_id', book.id).order('chapter_number');
  if (error) throw new Error(error.message);
  if (!chapters?.length) throw new Error('No chapters exist for this book');
  const pending = chapters.find((chapter: Row) => chapter.status === 'pending');
  const drafting = chapters.find((chapter: Row) => ['researched', 'drafting'].includes(chapter.status));

  if (drafting) {
    const part = drafting.parts_done + 1;
    const total = drafting.parts_total;
    const words = Math.round(drafting.target_words / total);
    const previous = chapters.find((chapter: Row) => chapter.chapter_number === drafting.chapter_number - 1);
    const result = await claude({
      system: HOUSE_RULES + '\nYou are the Content Writer Agent. Write book chapters in Markdown. Use only facts supported by the research dossier. Do not add a chapter heading; start with the first sentence of the text. Use "## " subheadings sparingly. Return ONLY the chapter text.',
      user: briefBlock(book) + '\n\n' + outlineBlock(book) +
        '\n\nCHAPTER TO WRITE: ' + drafting.chapter_number + '. ' + drafting.title + '\n' + drafting.description +
        '\n\nRESEARCH DOSSIER FOR THIS CHAPTER\n' + clip(drafting.research?.dossier || 'No dossier.', 9000) +
        (previous?.content_md ? '\n\nEND OF THE PREVIOUS CHAPTER (for continuity only, do not repeat):\n...' + previous.content_md.slice(-1200) : '') +
        (drafting.content_md ? '\n\nTHIS CHAPTER SO FAR (continue from here, do not repeat any of it):\n' + drafting.content_md.slice(-6000) : '') +
        '\n\nWrite ' + (total > 1 ? 'part ' + part + ' of ' + total + ' of this chapter' : 'the full chapter') + ', about ' + words + ' words.' +
        (total > 1 && part < total ? ' Stop at a natural paragraph break; the chapter continues in the next part.' : ' Bring the chapter to a satisfying close that leads toward the next chapter.') + hintBlock(hint),
      maxTokens: Math.min(8000, Math.round(words * 3) + 1000)
    });
    const text = stripLeadingHeading(result.text);
    if (countWords(text) < Math.min(250, words * 0.3)) throw new Error('Chapter ' + drafting.chapter_number + ' came back too short');
    const content = drafting.content_md ? drafting.content_md.trimEnd() + '\n\n' + text : text;
    const done = part >= total;
    await db.from('vw_book_chapters').update({
      content_md: content, parts_done: part, word_count: countWords(content), status: done ? 'drafted' : 'drafting', step_attempts: 0, error: null
    }).eq('id', drafting.id);
    await save(book, { step_attempts: 0, error: null }, result);
    await logEvent({ book_id: book.id }, 'chapters', 'info', 'Chapter ' + drafting.chapter_number + (total > 1 ? ' part ' + part + '/' + total : '') + ' written (' + countWords(text) + ' words).');
    return;
  }

  if (pending) {
    const result = await claude({
      system: HOUSE_RULES + '\nYou are the Chapter Research Agent. Build a research dossier for one chapter using web search. Include only stories, case studies, data points and expert views that the search results support, and name the source next to each. Mark anything you could not verify as [UNVERIFIED]. Return the dossier as plain text of 500 to 1000 words.',
      user: briefBlock(book) + '\n\nBOOK RESEARCH BRIEF\n' + clip(JSON.stringify({ ...book.research_brief, sources: undefined }), 5000) +
        '\n\nCHAPTER: ' + pending.chapter_number + '. ' + pending.title + '\n' + pending.description + hintBlock(hint),
      maxTokens: 2600,
      search: { maxUses: 3 }
    });
    if (countWords(result.text) < 120) throw new Error('Research dossier for chapter ' + pending.chapter_number + ' came back too short');
    await db.from('vw_book_chapters').update({
      research: { dossier: result.text, sources: result.sources, grounded: result.grounded }, status: 'researched', step_attempts: 0, error: null
    }).eq('id', pending.id);
    await save(book, { step_attempts: 0, error: null }, result);
    await logEvent({ book_id: book.id }, 'chapters', result.grounded ? 'info' : 'warn',
      'Chapter ' + pending.chapter_number + ' research dossier ready' + (result.grounded ? ' (' + result.sources.length + ' sources).' : ' (NOT verified by web search).'));
    return;
  }

  const words = chapters.reduce((sum: number, chapter: Row) => sum + (chapter.word_count || 0), 0);
  await afterGate(book, 'chapters', 'design', { chapters: chapters.length, words });
  await logEvent({ book_id: book.id }, 'chapters', 'info', 'All ' + chapters.length + ' chapters drafted (' + words + ' words).');
}

async function stepDesign(book: Row, hint: string | null) {
  const { data: chapters } = await db.from('vw_book_chapters').select('chapter_number,title,content_md').eq('book_id', book.id).order('chapter_number').limit(2);
  const sample = (chapters || []).map((chapter: Row) => 'CHAPTER ' + chapter.chapter_number + ': ' + chapter.title + '\n' + String(chapter.content_md || '').slice(0, 1800)).join('\n\n');
  const result = await claude({
    system: HOUSE_RULES + '\nYou are the Design Agent. Recommend interior layout and typography for a book, and write its retail metadata. Return ONLY a JSON object.',
    user: briefBlock(book) + '\n\nSAMPLE CHAPTERS\n' + sample +
      '\n\nReturn JSON: {"layout": {"trim_size": "6x9 or 8.5x11", "body_font": string, "heading_font": string, "chapter_openers": string, "visual_hierarchy": [string], "special_elements": [string]}, "marketing": {"description": string, "keywords": [string], "categories": [string]}}. ' +
      'description is back-cover copy of 90 to 140 words. keywords: exactly 7 search phrases. categories: 2 or 3 bookstore categories.' + hintBlock(hint),
    maxTokens: 1600
  });
  const design = parseJson(result.text);
  design.marketing = design.marketing || {};
  design.marketing.keywords = Array.isArray(design.marketing.keywords) ? design.marketing.keywords.slice(0, 7).map(String) : [];
  design.marketing.categories = Array.isArray(design.marketing.categories) ? design.marketing.categories.slice(0, 3).map(String) : [];
  const options = normalizeOptions(book.options);
  await save(book, { design, status: options.cover === 'skip' ? 'critic' : 'cover', cover: options.cover === 'skip' ? { status: 'skipped', reason: 'Cover generation was switched off for this book.' } : book.cover, step_attempts: 0, error: null }, result);
  await logEvent({ book_id: book.id }, 'design', 'info', 'Design notes and retail metadata ready.');
}

async function runway(path: string, init: RequestInit = {}) {
  const key = await secret('RUNWAY_API_ACCESS');
  if (!key) throw new Error('Runway is not configured, so a cover image cannot be made');
  const result = await fetch(RUNWAY_BASE + path, {
    ...init,
    headers: { authorization: 'Bearer ' + key, 'X-Runway-Version': RUNWAY_VERSION, ...(init.body ? { 'content-type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(40000)
  });
  const text = await result.text();
  if (!result.ok) throw new Error('Runway ' + result.status + ': ' + text.slice(0, 300));
  return text ? JSON.parse(text) : {};
}

async function stepCover(book: Row, hint: string | null) {
  const cover: Row = book.cover && typeof book.cover === 'object' ? { ...book.cover } : {};
  if (!cover.prompt) {
    const result = await claude({
      system: HOUSE_RULES + '\nYou are the Cover Image Agent. Write one image-generation prompt for a professional, marketable, genre-appropriate book cover illustration. The image must contain NO words, letters, numbers, logos or signatures, because the title is typeset separately. Leave calm space in the top third for the title. Do not name real people, brands or copyrighted characters, and do not ask for the style of a named living artist. Return ONLY a JSON object.',
      user: briefBlock(book) + '\n\nReturn JSON: {"concept": string, "prompt": string, "palette": [string]}. The prompt is under 900 characters and describes a portrait-orientation illustration.' + hintBlock(hint),
      maxTokens: 900
    });
    const parsed = parseJson(result.text);
    if (!parsed.prompt) throw new Error('Cover agent did not return a prompt');
    await save(book, { cover: { status: 'prompted', concept: clip(parsed.concept, 500), prompt: clip(parsed.prompt, 950), palette: Array.isArray(parsed.palette) ? parsed.palette.slice(0, 6) : [] }, step_attempts: 0, error: null }, result);
    await logEvent({ book_id: book.id }, 'cover', 'info', 'Cover concept written.');
    return;
  }
  if (!cover.task_id) {
    const model = await setting('book_pipeline_cover_model', await setting('runway_image_model_noref', 'gemini_2.5_flash'));
    const ratios = [await setting('book_pipeline_cover_ratio', '832:1248'), '768:1344', '1024:1024'];
    let task: Row | null = null;
    let lastError = '';
    let ratioUsed = '';
    for (const ratio of ratios.filter((value, index) => ratios.indexOf(value) === index)) {
      try {
        task = await runway('/text_to_image', { method: 'POST', body: JSON.stringify({ model, promptText: String(cover.prompt).slice(0, 1000), ratio }) });
        ratioUsed = ratio;
        break;
      } catch (error) {
        lastError = String((error as Error).message || error);
        if (!/ 400:/.test(lastError)) break;
      }
    }
    if (!task?.id) throw new Error(lastError || 'Runway did not return a task');
    await save(book, { cover: { ...cover, status: 'submitted', task_id: task.id, model, ratio: ratioUsed, submitted_at: new Date().toISOString() }, step_attempts: 0, error: null });
    await logEvent({ book_id: book.id }, 'cover', 'info', 'Cover image requested from Runway (' + model + ', ' + ratioUsed + ').');
    return;
  }
  const task = await runway('/tasks/' + encodeURIComponent(cover.task_id));
  const status = String(task.status || '').toUpperCase();
  if (status === 'FAILED' || status === 'CANCELLED') {
    await save(book, { cover: { ...cover, task_id: null, last_failure: clip(task.failure || task.failureCode || status, 200) } });
    throw new Error('Runway could not make the cover: ' + clip(task.failure || task.failureCode || status, 200));
  }
  if (status !== 'SUCCEEDED') {
    const waited = Date.now() - new Date(cover.submitted_at || Date.now()).getTime();
    if (waited > 20 * 60 * 1000) {
      await save(book, { cover: { ...cover, task_id: null } });
      throw new Error('Runway cover image timed out after 20 minutes');
    }
    return; // still rendering; the next tick checks again
  }
  const url = Array.isArray(task.output) ? task.output.find((item: unknown) => typeof item === 'string') : null;
  if (!url) throw new Error('Runway finished but returned no image');
  const fetched = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!fetched.ok) throw new Error('Could not download the cover image (' + fetched.status + ')');
  const bytes = new Uint8Array(await fetched.arrayBuffer());
  const mime = sniffImageMime(bytes, fetched.headers.get('content-type') || 'image/png');
  const extension = /png/.test(mime) ? 'png' : /webp/.test(mime) ? 'webp' : 'jpg';
  const path = book.owner_id + '/books/' + book.id + '/cover.' + extension;
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error('Cover upload failed: ' + error.message);
  await save(book, {
    cover: { ...cover, status: 'done', storage_path: path, mime, bytes: bytes.length, print_ready: false,
      note: 'Illustration only; the title is typeset on top. Resolution is below 300 DPI at print size, so it needs upscaling before print.' },
    status: 'critic', step_attempts: 0, error: null
  });
  await logEvent({ book_id: book.id }, 'cover', 'info', 'Cover image saved.');
}

async function stepCritic(book: Row, hint: string | null) {
  const { data: chapters } = await db.from('vw_book_chapters').select('*').eq('book_id', book.id).order('chapter_number');
  if (!chapters?.length) throw new Error('No chapters to review');
  const manuscript = chapters.map((chapter: Row) => '=== CHAPTER ' + chapter.chapter_number + ': ' + chapter.title + ' ===\n' + chapter.content_md).join('\n\n');
  const previous = book.critic?.issues?.filter((issue: Row) => issue.severity === 'blocking') || [];
  const result = await claude({
    system: HOUSE_RULES + '\nYou are the Consistency Critic. Read the whole manuscript and report real problems with tone, continuity and factual consistency. ' +
      'Mark an issue "blocking" only when a reader would be misled or thrown out of the book: chapters that contradict each other, a quote, statistic or study presented as fact with no support, a clear break in voice, or a promise in the brief that the book does not keep. Everything else is "minor". Report at most 12 issues, most serious first. If the manuscript is sound, return an empty issues list. Return ONLY a JSON object.',
    user: briefBlock(book) + '\n\n' + outlineBlock(book) +
      (previous.length ? '\n\nISSUES RAISED LAST ROUND (the chapters were revised to fix these; confirm they are fixed and do not raise them again unless they really remain):\n' + previous.map((issue: Row) => '- Ch ' + issue.chapter_number + ': ' + issue.description).join('\n') : '') +
      '\n\nMANUSCRIPT\n' + manuscript +
      '\n\nReturn JSON: {"summary": string, "issues": [{"chapter_number": number, "type": "tone|continuity|fact|promise", "severity": "blocking|minor", "description": string, "fix": string}]}' + hintBlock(hint),
    maxTokens: 3500
  });
  const parsed = parseJson(result.text);
  const numbers = new Set(chapters.map((chapter: Row) => chapter.chapter_number));
  const issues = (Array.isArray(parsed.issues) ? parsed.issues : []).slice(0, 12).map((issue: Row) => ({
    chapter_number: numbers.has(Number(issue.chapter_number)) ? Number(issue.chapter_number) : chapters[0].chapter_number,
    type: clip(issue.type || 'continuity', 20),
    severity: issue.severity === 'blocking' ? 'blocking' : 'minor',
    description: clip(issue.description, 500),
    fix: clip(issue.fix, 500)
  }));
  const blocking = issues.filter((issue: Row) => issue.severity === 'blocking');
  const round = Number(book.revision_round || 0);
  const critic = { round: round + 1, summary: clip(parsed.summary, 900), issues, blocking_count: blocking.length, minor_count: issues.length - blocking.length, reviewed_at: new Date().toISOString() };

  if (!blocking.length) {
    await afterGate(book, 'assembly', 'assembly', { blocking_issues: 0, minor_issues: critic.minor_count }, { critic }, result);
    await logEvent({ book_id: book.id }, 'critic', 'info', 'Consistency Critic passed the manuscript (' + critic.minor_count + ' minor notes).');
    return;
  }
  if (round >= MAX_REVISION_ROUNDS) {
    await save(book, { critic, status: 'paused', paused_stage: 'critic', step_attempts: 0,
      error: 'The Consistency Critic still flags ' + blocking.length + ' unresolved issue(s) after ' + MAX_REVISION_ROUNDS + ' revision rounds. Assembly is blocked until they are resolved.' }, result);
    await logEvent({ book_id: book.id }, 'critic', 'error', 'Paused: ' + blocking.length + ' blocking issue(s) remain after ' + MAX_REVISION_ROUNDS + ' revision rounds.', { issues: blocking });
    return;
  }
  for (const chapter of chapters) {
    const mine = blocking.filter((issue: Row) => issue.chapter_number === chapter.chapter_number);
    if (mine.length) await db.from('vw_book_chapters').update({ status: 'needs_revision', revision_notes: mine }).eq('id', chapter.id);
  }
  await save(book, { critic, status: 'revision', step_attempts: 0, error: null, metadata: { ...(book.metadata || {}), revision_return: 'critic' } }, result);
  await logEvent({ book_id: book.id }, 'critic', 'warn', 'Critic found ' + blocking.length + ' blocking issue(s). Sending chapters back for revision (round ' + (round + 1) + ').');
}

async function stepRevision(book: Row, hint: string | null) {
  const metadata: Row = { ...(book.metadata || {}) };
  const { data: chapters } = await db.from('vw_book_chapters').select('*').eq('book_id', book.id).order('chapter_number');
  if (!chapters?.length) throw new Error('No chapters to revise');

  if (metadata.pending_director_notes) {
    const result = await claude({
      system: HOUSE_RULES + '\nYou are the Book Director. Turn the director\'s change request into specific fix instructions per chapter. Return ONLY a JSON array.',
      user: outlineBlock(book) + '\n\nDIRECTOR CHANGE REQUEST\n' + clip(metadata.pending_director_notes, 4000) +
        '\n\nReturn a JSON array: [{"chapter_number": number, "fix": string}]. Include only chapters that need to change. If the request applies to the whole book, include every chapter.' + hintBlock(hint),
      maxTokens: 2000
    });
    const plan = parseJson(result.text, 'array');
    const list = Array.isArray(plan) ? plan : [];
    let marked = 0;
    for (const chapter of chapters) {
      const mine = list.filter((item: Row) => Number(item.chapter_number) === chapter.chapter_number);
      if (!mine.length) continue;
      marked += 1;
      await db.from('vw_book_chapters').update({
        status: 'needs_revision',
        revision_notes: mine.map((item: Row) => ({ chapter_number: chapter.chapter_number, type: 'director', severity: 'blocking', description: 'Director change request', fix: clip(item.fix, 600) }))
      }).eq('id', chapter.id);
    }
    if (!marked) throw new Error('The change request could not be matched to any chapter');
    delete metadata.pending_director_notes;
    await save(book, { metadata, step_attempts: 0, error: null }, result);
    await logEvent({ book_id: book.id }, 'revision', 'info', 'Change request mapped to ' + marked + ' chapter(s).');
    return;
  }

  const target = chapters.find((chapter: Row) => chapter.status === 'needs_revision');
  if (target) {
    const notes = Array.isArray(target.revision_notes) ? target.revision_notes : [];
    const result = await claude({
      system: HOUSE_RULES + '\nYou are the Content Writer Agent revising a chapter. Apply every fix. Keep everything that already works, keep the length about the same, and keep the same voice. Do not add a chapter heading. Return ONLY the full revised chapter in Markdown.',
      user: briefBlock(book) + '\n\nCHAPTER ' + target.chapter_number + ': ' + target.title + '\n' + target.description +
        '\n\nFIXES TO APPLY\n' + notes.map((note: Row) => '- ' + (note.description ? note.description + ' Fix: ' : '') + note.fix).join('\n') +
        '\n\nRESEARCH DOSSIER\n' + clip(target.research?.dossier || 'No dossier.', 6000) +
        '\n\nCURRENT CHAPTER TEXT\n' + target.content_md + hintBlock(hint),
      maxTokens: Math.min(9000, Math.round((target.word_count || target.target_words) * 2.2) + 1200)
    });
    const text = stripLeadingHeading(result.text);
    if (countWords(text) < Math.max(200, (target.word_count || 0) * 0.5)) throw new Error('Revised chapter ' + target.chapter_number + ' came back too short');
    await db.from('vw_book_chapters').update({ content_md: text, word_count: countWords(text), status: 'revised', step_attempts: 0, error: null }).eq('id', target.id);
    await save(book, { step_attempts: 0, error: null }, result);
    await logEvent({ book_id: book.id }, 'revision', 'info', 'Chapter ' + target.chapter_number + ' revised (' + notes.length + ' fix(es)).');
    return;
  }

  const back = metadata.revision_return === 'awaiting_chapters_approval' ? 'awaiting_chapters_approval' : 'critic';
  delete metadata.revision_return;
  await save(book, { status: back, metadata, revision_round: back === 'critic' ? Number(book.revision_round || 0) + 1 : book.revision_round, step_attempts: 0, error: null });
  await logEvent({ book_id: book.id }, 'revision', 'info', back === 'critic' ? 'Revisions done. Back to the Consistency Critic.' : 'Revisions done. Waiting for approval at the chapters gate.');
}

// ------------------------------------------------------------ station 4
const FONT_FILES: Record<keyof FontBytes, string> = {
  regular: 'CrimsonText-Regular.ttf', bold: 'CrimsonText-Bold.ttf', italic: 'CrimsonText-Italic.ttf', boldItalic: 'CrimsonText-BoldItalic.ttf'
};
const FONT_SOURCE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/crimsontext/';

export async function loadFonts(): Promise<{ fonts: FontBytes | null; note: string }> {
  const out: Row = {};
  try {
    for (const [style, file] of Object.entries(FONT_FILES)) {
      const path = 'system/fonts/' + file;
      const cached = await db.storage.from(BUCKET).download(path);
      if (cached.data) { out[style] = new Uint8Array(await cached.data.arrayBuffer()); continue; }
      const fetched = await fetch(FONT_SOURCE + file, { signal: AbortSignal.timeout(20000) });
      if (!fetched.ok) throw new Error('font download ' + fetched.status);
      const bytes = new Uint8Array(await fetched.arrayBuffer());
      if (bytes.length < 20000) throw new Error('font file too small');
      await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'font/ttf', upsert: true });
      out[style] = bytes;
    }
    return { fonts: out as FontBytes, note: 'Crimson Text (SIL Open Font License) embedded.' };
  } catch (error) {
    return { fonts: null, note: 'Book fonts could not be loaded (' + clip((error as Error).message, 100) + '); built-in Times fonts were used and are not embedded.' };
  }
}

export async function assembleOutputs(book: Row) {
  const options = normalizeOptions(book.options);
  const { data: chapters } = await db.from('vw_book_chapters').select('*').eq('book_id', book.id).order('chapter_number');
  if (!chapters?.length) throw new Error('No chapters to assemble');
  const unfinished = chapters.filter((chapter: Row) => !['drafted', 'revised'].includes(chapter.status));
  if (unfinished.length) throw new Error(unfinished.length + ' chapter(s) are not finished');
  if (Number(book.critic?.blocking_count || 0) > 0) throw new Error('The Consistency Critic has unresolved blocking issues; assembly is not allowed');

  const seen = new Set<string>();
  const sources: Array<{ title: string; url: string }> = [];
  const collect = (list: unknown) => {
    for (const source of Array.isArray(list) ? list : []) {
      if (source?.url && !seen.has(source.url)) { seen.add(source.url); sources.push({ title: clip(source.title || source.url, 160), url: String(source.url) }); }
    }
  };
  collect(book.research_brief?.sources);
  for (const chapter of chapters) collect(chapter.research?.sources);

  let cover: AssemblyBook['cover'] = null;
  if (book.cover?.storage_path) {
    const downloaded = await db.storage.from(BUCKET).download(book.cover.storage_path);
    if (downloaded.data) {
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      cover = { bytes, mime: sniffImageMime(bytes, book.cover.mime || 'image/png') };
    }
  }
  const brief = book.brief || {};
  const author = options.author_name || '';
  const assembly: AssemblyBook = {
    title: clip(brief.title || book.title, 200),
    subtitle: clip(brief.subtitle || '', 240),
    author,
    year: new Date().getUTCFullYear(),
    description: clip(book.design?.marketing?.description || brief.core_promise || '', 1200),
    language: 'en',
    isbn: '',
    trim: options.trim_size,
    chapters: chapters.map((chapter: Row) => ({ number: chapter.chapter_number, title: chapter.title, markdown: chapter.content_md })),
    sources: sources.slice(0, 120),
    cover
  };

  const base = book.owner_id + '/books/' + book.id + '/';
  const files: Row = {};
  const checks: Row = {};
  const notes: string[] = [];
  const put = async (name: string, bytes: Uint8Array | string, contentType: string) => {
    const body = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
    const { error } = await db.storage.from(BUCKET).upload(base + name, body, { contentType, upsert: true });
    if (error) throw new Error('Upload of ' + name + ' failed: ' + error.message);
    files[name] = { path: base + name, bytes: body.length };
  };

  const manuscript = buildManuscriptMarkdown(assembly);
  await put('manuscript.md', manuscript, 'text/markdown; charset=utf-8');
  const words = countWords(manuscript);

  if (options.formats.includes('pdf')) {
    const loaded = await loadFonts();
    notes.push(loaded.note);
    const interior = await buildPdf(assembly, { includeCover: false, fonts: loaded.fonts, fontkit: FONTKIT });
    await put('interior.pdf', interior.bytes, 'application/pdf');
    const reading = await buildPdf(assembly, { includeCover: true, fonts: loaded.fonts, fontkit: FONTKIT });
    await put('reading-copy.pdf', reading.bytes, 'application/pdf');
    notes.push(...interior.notes, ...reading.notes);
    checks.pdf = { ...(await validatePdf(interior.bytes)), body_pages: interior.bodyPages, fonts_embedded: interior.fontsEmbedded, reading_copy_pages: reading.pages, cover_in_reading_copy: reading.coverIncluded };
  }
  if (options.formats.includes('epub')) {
    const epub = await buildEpub(assembly);
    await put('book.epub', epub, 'application/epub+zip');
    checks.epub = await validateEpub(epub);
    if (!checks.epub.ok) throw new Error('EPUB failed its structure check: ' + checks.epub.problems.join('; '));
  }

  const metadata = {
    title: assembly.title,
    subtitle: assembly.subtitle,
    author: author || null,
    author_note: author ? null : 'No author name was set. Files show "' + AUTHOR_PLACEHOLDER + '". Set a name and reassemble.',
    description: assembly.description,
    keywords: book.design?.marketing?.keywords || [],
    categories: book.design?.marketing?.categories || [],
    genre: brief.genre || '',
    audience: brief.audience || '',
    language: 'en',
    isbn: null,
    isbn_note: 'ISBN placeholder. Assign one before retail publishing.',
    trim_size: options.trim_size,
    word_count: words,
    chapter_count: chapters.length,
    source_count: sources.length,
    research_verified_by_web_search: Boolean(book.research_brief?.grounded),
    cover: book.cover?.status === 'done'
      ? { file: 'cover', print_ready_300dpi: false, note: book.cover.note }
      : { file: null, note: book.cover?.reason || 'No cover image was generated.' },
    print_readiness: {
      trim_size_set: true,
      fonts_embedded: Boolean(checks.pdf?.fonts_embedded),
      mirrored_margins: true,
      checked_in_a_printer_previewer: false,
      note: 'interior.pdf follows common print-on-demand basics. It has not been run through a specific printer\'s preview tool (for example KDP), and the cover needs a 300 DPI version with spine before print.'
    },
    ai_disclosure: 'Text and cover art were generated with AI assistance. Most retailers ask publishers to declare this at upload.',
    checks,
    notes,
    assembled_at: new Date().toISOString(),
    pipeline: 'VisionWeaver Book Pipeline'
  };
  await put('metadata.json', JSON.stringify(metadata, null, 2), 'application/json');
  if (book.cover?.storage_path) files['cover'] = { path: book.cover.storage_path, bytes: book.cover.bytes || null };
  return { files, metadata };
}

async function stepAssembly(book: Row) {
  const { files, metadata } = await assembleOutputs(book);
  await save(book, { outputs: { files }, metadata: { ...(book.metadata || {}), book: metadata }, status: 'complete', completed_at: new Date().toISOString(), step_attempts: 0, error: null });
  await logEvent({ book_id: book.id }, 'assembly', 'info', 'Book assembled: ' + Object.keys(files).join(', ') + '.', { checks: metadata.checks });
}

// --------------------------------------------------------------- runner
const HANDLERS: Record<string, (book: Row, hint: string | null) => Promise<void>> = {
  intake: stepIntake, research: stepResearch, outline: stepOutline, chapters: stepChapters,
  design: stepDesign, cover: stepCover, critic: stepCritic, revision: stepRevision, assembly: stepAssembly
};

export async function runBookStep(bookId: string): Promise<{ status: string; runnable: boolean }> {
  const { data: book, error } = await db.from('vw_books').select('*').eq('id', bookId).single();
  if (error || !book) throw new Error('Book not found');
  const stage = book.status;
  const handler = HANDLERS[stage];
  if (!handler) { await db.from('vw_books').update({ locked_at: null, locked_by: null }).eq('id', bookId); return { status: stage, runnable: false }; }
  try {
    await handler(book, book.step_attempts > 0 ? book.error : null);
  } catch (caught) {
    const message = String((caught as Error)?.message || caught).slice(0, 500);
    const attempts = Number(book.step_attempts || 0) + 1;
    const transient = /Anthropic (429|5\d\d)|Runway (429|5\d\d)|overloaded|timed? ?out|aborted|network/i.test(message);
    const limit = transient ? 4 : 2;
    if (attempts >= limit) {
      await db.from('vw_books').update({ status: 'paused', paused_stage: stage, error: message, step_attempts: 0 }).eq('id', bookId);
      await logEvent({ book_id: bookId }, stage, 'error', 'Paused at "' + stage + '" after ' + attempts + ' attempts: ' + message);
    } else {
      await db.from('vw_books').update({ step_attempts: attempts, error: message }).eq('id', bookId);
      await logEvent({ book_id: bookId }, stage, 'warn', 'Attempt ' + attempts + ' at "' + stage + '" failed and will be retried: ' + message);
    }
  } finally {
    await db.from('vw_books').update({ locked_at: null, locked_by: null }).eq('id', bookId);
  }
  const { data: after } = await db.from('vw_books').select('status,cover').eq('id', bookId).single();
  const status = after?.status || stage;
  const waitingOnRunway = status === 'cover' && after?.cover?.status === 'submitted';
  return { status, runnable: RUNNABLE.includes(status) && !waitingOnRunway };
}

// ---------------------------------------------------- director actions
export async function decideGate(book: Row, gate: Gate, decision: string, notes: string, userId: string) {
  if (book.status !== 'awaiting_' + gate + '_approval') throw new Error('This book is not waiting at the ' + gate + ' gate');
  if (!['approved', 'changes_requested', 'rejected'].includes(decision)) throw new Error('Unknown decision');
  if (decision === 'changes_requested' && notes.trim().length < 5) throw new Error('Say what should change');
  await db.from('vw_book_approvals').insert({ book_id: book.id, gate, decision, notes: clip(notes, 4000), decided_by: userId, snapshot: { status: book.status } });
  const patch: Row = { step_attempts: 0, error: null };
  if (decision === 'rejected') patch.status = 'rejected';
  else if (decision === 'approved') patch.status = ({ research: 'outline', outline: 'chapters', chapters: 'design', assembly: 'assembly' } as Row)[gate];
  else if (gate === 'research' || gate === 'outline') {
    patch.status = gate;
    patch.director_notes = [...(Array.isArray(book.director_notes) ? book.director_notes : []), { gate, notes: clip(notes, 4000), at: new Date().toISOString(), applied: false }];
  } else {
    patch.status = 'revision';
    patch.metadata = { ...(book.metadata || {}), pending_director_notes: clip(notes, 4000), revision_return: gate === 'chapters' ? 'awaiting_chapters_approval' : 'critic' };
  }
  const { error } = await db.from('vw_books').update(patch).eq('id', book.id);
  if (error) throw new Error(error.message);
  await logEvent({ book_id: book.id }, gate, 'info', 'Director decision at the ' + gate + ' gate: ' + decision.replace('_', ' ') + '.', { notes: clip(notes, 300) });
  return patch.status;
}
