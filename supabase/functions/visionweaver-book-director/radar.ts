// VisionWeaver Book Pipeline: Layer 1, T.H.E.L.M.A. Trend Radar.
// Reads the trending / best-seller sections of book sites, ranks what is
// rising, and proposes ORIGINAL book ideas for a person to pick from.
// Every source reports honestly: ok, no_data or failed. Nothing is invented
// to fill a gap.
import { claude, clip, db, fetchJson, fetchText, logEvent, parseJson, type Row, type Source } from './lib.ts';

type Item = { rank: number | null; title: string; author: string; genre: string; url: string; list_name: string };

function decodeEntities(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
}

async function readAppleBooks(config: Row): Promise<{ items: Item[]; citations: Source[] }> {
  const country = clip(config.country || 'us', 4).toLowerCase();
  const feed = config.feed === 'top-free' ? 'top-free' : 'top-paid';
  const limit = Math.max(10, Math.min(100, Number(config.limit) || 50));
  const path = '/api/v2/' + country + '/books/' + feed + '/' + limit + '/books.json';
  let json: Row | null = null;
  let used = '';
  let lastError = '';
  for (const host of ['https://rss.marketingtools.apple.com', 'https://rss.applemarketingtools.com']) {
    try { json = await fetchJson(host + path); used = host + path; break; } catch (error) { lastError = String((error as Error).message); }
  }
  if (!json) throw new Error(lastError || 'Apple Books feed unavailable');
  const results = Array.isArray(json.feed?.results) ? json.feed.results : [];
  return {
    items: results.map((entry: Row, index: number) => ({
      rank: index + 1,
      title: clip(entry.name, 240),
      author: clip(entry.artistName, 160),
      genre: (Array.isArray(entry.genres) ? entry.genres : []).map((genre: Row) => genre.name).filter((name: string) => name && name !== 'Books').join(', '),
      url: clip(entry.url, 400),
      list_name: 'Apple Books ' + (feed === 'top-free' ? 'Top Free' : 'Top Paid')
    })),
    citations: [{ title: 'Apple Books ' + feed + ' feed', url: used }]
  };
}

async function readOpenLibrary(config: Row): Promise<{ items: Item[]; citations: Source[] }> {
  const window = ['daily', 'weekly', 'monthly'].includes(config.window) ? config.window : 'daily';
  const limit = Math.max(10, Math.min(100, Number(config.limit) || 50));
  const url = 'https://openlibrary.org/trending/' + window + '.json?limit=' + limit;
  const json = await fetchJson(url);
  const works = Array.isArray(json.works) ? json.works : [];
  return {
    items: works.map((work: Row, index: number) => ({
      rank: index + 1,
      title: clip(work.title, 240),
      author: clip(Array.isArray(work.author_name) ? work.author_name[0] : '', 160),
      genre: '',
      url: work.key ? 'https://openlibrary.org' + work.key : '',
      list_name: 'Open Library trending (' + window + ')'
    })),
    citations: [{ title: 'Open Library trending API', url }]
  };
}

async function readGoogleBooks(config: Row): Promise<{ items: Item[]; citations: Source[] }> {
  const categories: string[] = (Array.isArray(config.categories) ? config.categories : [config.category || 'fiction']).map((value: unknown) => clip(value, 60)).filter(Boolean).slice(0, 10);
  const per = Math.max(5, Math.min(40, Number(config.per_category) || 10));
  const items: Item[] = [];
  const citations: Source[] = [];
  let failures = 0;
  for (const category of categories) {
    const url = 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent('subject:"' + category + '"') + '&orderBy=newest&printType=books&langRestrict=en&maxResults=' + per;
    try {
      const json = await fetchJson(url);
      for (const volume of Array.isArray(json.items) ? json.items : []) {
        const info = volume.volumeInfo || {};
        if (!info.title) continue;
        items.push({
          rank: null,
          title: clip(info.title + (info.subtitle ? ': ' + info.subtitle : ''), 240),
          author: clip(Array.isArray(info.authors) ? info.authors.join(', ') : '', 160),
          genre: clip(Array.isArray(info.categories) ? info.categories.join(', ') : category, 120),
          url: clip(info.infoLink || '', 400),
          list_name: 'Google Books newest in ' + category
        });
      }
      citations.push({ title: 'Google Books: ' + category, url });
    } catch (_) { failures += 1; }
  }
  if (!items.length && failures) throw new Error('Google Books did not answer (' + failures + ' of ' + categories.length + ' categories failed)');
  return { items, citations };
}

async function readRss(config: Row): Promise<{ items: Item[]; citations: Source[] }> {
  const url = String(config.url || '');
  if (!/^https:\/\//i.test(url)) throw new Error('The feed address must start with https://');
  const xmlText = await fetchText(url);
  const entries = xmlText.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  const items: Item[] = entries.slice(0, 60).map((entry, index) => {
    const title = decodeEntities((entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const link = decodeEntities((entry.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '') || ((entry.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '');
    const author = decodeEntities((entry.match(/<(?:dc:creator|author)[^>]*>([\s\S]*?)<\/(?:dc:creator|author)>/i) || [])[1] || '');
    const category = decodeEntities((entry.match(/<category[^>]*>([\s\S]*?)<\/category>/i) || [])[1] || '');
    return { rank: index + 1, title: clip(title, 240), author: clip(author, 160), genre: clip(category, 120), url: clip(link, 400), list_name: clip(config.name || 'RSS feed', 80) };
  }).filter((item) => item.title);
  return { items, citations: [{ title: clip(config.name || 'RSS feed', 80), url }] };
}

async function readByWebSearch(name: string, config: Row): Promise<{ items: Item[]; citations: Source[]; usage: Row; note: string }> {
  const domain = clip(config.domain, 80);
  if (!domain) throw new Error('This source has no domain set');
  const result = await claude({
    fast: true,
    system: 'You collect current book-trend data. Use web search, limited to the site you are given, to find what is on its current best-seller, trending or hot-new-release lists. ' +
      'List ONLY titles that appear in the search results you actually received. Never fill in titles from memory. If the search results do not show a current list, return an empty items array. Return ONLY a JSON object after searching.',
    user: 'SITE: ' + name + ' (' + domain + ')\nLISTS TO LOOK FOR: ' + clip(config.lists || 'best sellers and trending books', 300) +
      '\nTODAY: ' + new Date().toISOString().slice(0, 10) +
      '\n\nReturn JSON: {"list_date": string, "items": [{"rank": number or null, "title": string, "author": string, "genre": string, "list_name": string, "url": string}], "notes": string}. Up to 30 items. genre is your best one-or-two-word label for the book.',
    maxTokens: 3000,
    search: { maxUses: 3, allowedDomains: [domain] }
  });
  if (result.searchUnavailable) throw new Error('Live web search is not enabled on the Anthropic account');
  if (!result.sources.length) return { items: [], citations: [], usage: result.usage, note: 'The search returned no pages from ' + domain + '.' };
  const parsed = parseJson(result.text);
  const items: Item[] = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 30).map((entry: Row) => ({
    rank: Number.isFinite(Number(entry.rank)) && entry.rank !== null ? Number(entry.rank) : null,
    title: clip(entry.title, 240),
    author: clip(entry.author, 160),
    genre: clip(entry.genre, 120),
    url: clip(entry.url, 400),
    list_name: clip(entry.list_name || name, 120)
  })).filter((item: Item) => item.title.length > 1);
  return { items, citations: result.sources.slice(0, 12), usage: result.usage, note: clip(parsed.notes, 300) };
}

// ------------------------------------------------------------ scan flow
export async function startScan(owner: { id: string; organization_id: string }, scanType: string, params: Row, requestedBy: string) {
  let sources: Row[] = [];
  if (scanType === 'google_books') {
    const category = clip(params.category, 60);
    if (!category) throw new Error('Choose a category');
    sources = [{ slug: 'google-books-category', name: 'Google Books: ' + category, method: 'google_books', config: { categories: [category], per_category: 40 } }];
  } else if (scanType === 'rss') {
    const url = clip(params.url, 500);
    if (!/^https:\/\//i.test(url)) throw new Error('The feed address must start with https://');
    sources = [{ slug: 'rss-feed', name: clip(params.name || new URL(url).host, 80), method: 'rss', config: { url, name: clip(params.name || new URL(url).host, 80) } }];
  } else {
    const { data, error } = await db.from('vw_book_sources').select('*').eq('active', true).order('slug');
    if (error) throw new Error(error.message);
    sources = data || [];
    if (!sources.length) throw new Error('No active trend sources are configured');
    scanType = 'radar';
  }
  const { data: running } = await db.from('vw_book_trend_scans').select('id').eq('organization_id', owner.organization_id).eq('scan_type', scanType).in('status', ['scanning', 'ranking']).limit(1);
  if (running?.length) throw new Error('A scan of this kind is already running');
  const { data: scan, error } = await db.from('vw_book_trend_scans').insert({
    organization_id: owner.organization_id, owner_id: owner.id, scan_type: scanType, params, requested_by: requestedBy
  }).select('*').single();
  if (error) throw new Error('Scan insert failed: ' + error.message);
  const { error: sourceError } = await db.from('vw_book_trend_scan_sources').insert(sources.map((source) => ({
    scan_id: scan.id, source_slug: source.slug, source_name: source.name, method: source.method, config: source.config || {}
  })));
  if (sourceError) { await db.from('vw_book_trend_scans').delete().eq('id', scan.id); throw new Error('Scan sources insert failed: ' + sourceError.message); }
  await logEvent({ scan_id: scan.id }, 'radar', 'info', 'Scan started with ' + sources.length + ' source(s), requested by ' + requestedBy + '.');
  return scan;
}

export async function runScanSource(id: string) {
  const { data: row } = await db.from('vw_book_trend_scan_sources').select('*').eq('id', id).single();
  if (!row) return;
  try {
    let read: { items: Item[]; citations: Source[]; note?: string };
    if (row.method === 'apple_books') read = await readAppleBooks(row.config);
    else if (row.method === 'open_library') read = await readOpenLibrary(row.config);
    else if (row.method === 'google_books') read = await readGoogleBooks(row.config);
    else if (row.method === 'rss') read = await readRss(row.config);
    else read = await readByWebSearch(row.source_name, row.config);
    const items = read.items.filter((item) => item.title).slice(0, 100);
    if (items.length) {
      const { error } = await db.from('vw_book_trend_items').insert(items.map((item) => ({ scan_id: row.scan_id, source_slug: row.source_slug, ...item })));
      if (error) throw new Error('Trend items insert failed: ' + error.message);
    }
    await db.from('vw_book_trend_scan_sources').update({
      status: items.length ? 'ok' : 'no_data', item_count: items.length, grounded: read.citations.length > 0,
      citations: read.citations, error: items.length ? null : clip(read.note || 'No current list was found.', 300), finished_at: new Date().toISOString(), locked_at: null
    }).eq('id', id);
  } catch (caught) {
    const message = String((caught as Error)?.message || caught).slice(0, 300);
    const attempts = Number(row.step_attempts || 0) + 1;
    const fatal = /not enabled|must start with|no domain/i.test(message);
    await db.from('vw_book_trend_scan_sources').update(attempts >= 2 || fatal
      ? { status: 'failed', error: message, step_attempts: attempts, finished_at: new Date().toISOString(), locked_at: null }
      : { status: 'queued', error: message, step_attempts: attempts, locked_at: null }).eq('id', id);
  }
}

function titleKey(title: string) {
  return title.toLowerCase().replace(/[:(\[].*$/, '').replace(/[^a-z0-9 ]+/g, '').replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
}

export async function rankScan(id: string) {
  const { data: scan } = await db.from('vw_book_trend_scans').select('*').eq('id', id).single();
  if (!scan) return;
  try {
    const [{ data: sourceRows }, { data: itemRows }] = await Promise.all([
      db.from('vw_book_trend_scan_sources').select('source_slug,source_name,method,status,item_count,error').eq('scan_id', id).order('source_slug'),
      db.from('vw_book_trend_items').select('*').eq('scan_id', id).limit(3000)
    ]);
    const sources = sourceRows || [];
    const items = itemRows || [];
    const counts = {
      sources_total: sources.length,
      sources_ok: sources.filter((source: Row) => source.status === 'ok').length,
      sources_no_data: sources.filter((source: Row) => source.status === 'no_data').length,
      sources_failed: sources.filter((source: Row) => source.status === 'failed').length,
      item_count: items.length
    };
    if (!items.length) {
      await db.from('vw_book_trend_scans').update({ status: 'failed', error: 'No source returned any data.', summary: { ...counts, sources }, completed_at: new Date().toISOString(), locked_at: null }).eq('id', id);
      await logEvent({ scan_id: id }, 'radar', 'error', 'Scan failed: no source returned any data.');
      return;
    }

    // Exact counts done in code, not by the model.
    const byTitle = new Map<string, { title: string; author: string; sources: Set<string>; best_rank: number | null }>();
    const byGenre = new Map<string, { genre: string; sources: Set<string>; items: number }>();
    for (const item of items) {
      const key = titleKey(item.title);
      if (key.length > 2) {
        const entry = byTitle.get(key) || { title: item.title, author: item.author, sources: new Set<string>(), best_rank: null };
        entry.sources.add(item.source_slug);
        if (item.rank !== null && (entry.best_rank === null || item.rank < entry.best_rank)) entry.best_rank = item.rank;
        if (!entry.author && item.author) entry.author = item.author;
        byTitle.set(key, entry);
      }
      for (const raw of String(item.genre || '').split(/[,/&]| and /i)) {
        const genre = raw.trim().toLowerCase();
        if (genre.length < 3 || genre.length > 40) continue;
        const entry = byGenre.get(genre) || { genre, sources: new Set<string>(), items: 0 };
        entry.sources.add(item.source_slug);
        entry.items += 1;
        byGenre.set(genre, entry);
      }
    }
    const crossListed = [...byTitle.values()].filter((entry) => entry.sources.size >= 2)
      .sort((a, b) => b.sources.size - a.sources.size || (a.best_rank ?? 999) - (b.best_rank ?? 999)).slice(0, 20)
      .map((entry) => ({ title: entry.title, author: entry.author, source_count: entry.sources.size, sources: [...entry.sources], best_rank: entry.best_rank }));
    const genreCounts = [...byGenre.values()].sort((a, b) => b.sources.size - a.sources.size || b.items - a.items).slice(0, 20)
      .map((entry) => ({ genre: entry.genre, source_count: entry.sources.size, item_count: entry.items }));

    const lines = items.slice(0, 520).map((item: Row) => item.source_slug + ' | ' + (item.rank ?? '-') + ' | ' + clip(item.title, 90) + ' | ' + clip(item.author, 40) + ' | ' + clip(item.genre, 40));
    const result = await claude({
      system: 'You are T.H.E.L.M.A.\'s book-market analyst for Estiban Creations. You are given real trend data collected from book sites. Rank what is rising and propose ORIGINAL book ideas that fit the demand. ' +
        'Base every claim on the data shown. Ideas must be new books, never copies or sequels of listed titles. Comparable titles must come from the data. Return ONLY a JSON object.',
      user: 'DATA COLLECTED ' + new Date().toISOString().slice(0, 10) + ' from ' + counts.sources_ok + ' sources (' + items.length + ' listings).\n' +
        'TITLES ON 2 OR MORE LISTS (exact count):\n' + (crossListed.length ? crossListed.map((entry) => '- ' + entry.title + ' (' + entry.source_count + ' sources)').join('\n') : 'none') +
        '\n\nGENRE LABELS BY NUMBER OF SOURCES (exact count):\n' + genreCounts.map((entry) => '- ' + entry.genre + ': ' + entry.source_count + ' sources, ' + entry.item_count + ' listings').join('\n') +
        '\n\nALL LISTINGS (source | rank | title | author | genre):\n' + lines.join('\n') +
        '\n\nReturn JSON: {"trend_rankings": [{"rank": number, "theme": string, "genre": string, "momentum": number, "example_titles": [string], "why": string}], ' +
        '"opportunities": [{"rank": number, "score": number, "theme": string, "genre": string, "idea": {"title": string, "subtitle": string, "genre": string, "audience": string, "core_promise": string, "comparable_titles": [string], "unique_angle": string}, "rationale": string}]}. ' +
        'trend_rankings: the top 12 themes, momentum 0 to 100. opportunities: the top 10 original book ideas, score 0 to 100 for how well demand and a gap line up.',
      maxTokens: 5500
    });
    const parsed = parseJson(result.text);
    const rankings = (Array.isArray(parsed.trend_rankings) ? parsed.trend_rankings : []).slice(0, 12).map((entry: Row, index: number) => ({
      rank: index + 1, theme: clip(entry.theme, 120), genre: clip(entry.genre, 60), momentum: Math.max(0, Math.min(100, Number(entry.momentum) || 0)),
      example_titles: (Array.isArray(entry.example_titles) ? entry.example_titles : []).slice(0, 5).map((title: unknown) => clip(title, 120)), why: clip(entry.why, 400)
    }));
    const opportunities = (Array.isArray(parsed.opportunities) ? parsed.opportunities : []).slice(0, 10).filter((entry: Row) => entry?.idea?.title);
    if (opportunities.length) {
      const { error } = await db.from('vw_book_opportunities').insert(opportunities.map((entry: Row, index: number) => ({
        scan_id: id, organization_id: scan.organization_id, rank: index + 1,
        score: Math.max(0, Math.min(100, Number(entry.score) || 0)),
        theme: clip(entry.theme, 120), genre: clip(entry.genre || entry.idea.genre, 60),
        idea: {
          title: clip(entry.idea.title, 160), subtitle: clip(entry.idea.subtitle, 200), genre: clip(entry.idea.genre, 60), audience: clip(entry.idea.audience, 300),
          core_promise: clip(entry.idea.core_promise, 500), comparable_titles: (Array.isArray(entry.idea.comparable_titles) ? entry.idea.comparable_titles : []).slice(0, 5).map((title: unknown) => clip(title, 120)),
          unique_angle: clip(entry.idea.unique_angle, 500), source_url: ''
        },
        evidence: { rationale: clip(entry.rationale, 600), score_kind: 'editorial estimate by the analyst model, based on the collected listings' }
      })));
      if (error) throw new Error('Opportunity insert failed: ' + error.message);
    }
    await db.from('vw_book_trend_scans').update({
      status: 'complete', completed_at: new Date().toISOString(), locked_at: null, error: null,
      summary: { ...counts, sources, cross_listed: crossListed, genre_counts: genreCounts, trend_rankings: rankings, opportunities: opportunities.length, usage: result.usage,
        method_note: 'Counts of sources and cross-listed titles are exact. Momentum and opportunity scores are editorial estimates by the analyst model.' }
    }).eq('id', id);
    await logEvent({ scan_id: id }, 'radar', 'info', 'Scan complete: ' + counts.sources_ok + ' of ' + counts.sources_total + ' sources returned data, ' + items.length + ' listings, ' + opportunities.length + ' ideas.');
  } catch (caught) {
    const message = String((caught as Error)?.message || caught).slice(0, 400);
    const attempts = Number(scan.step_attempts || 0) + 1;
    await db.from('vw_book_trend_scans').update(attempts >= 2
      ? { status: 'failed', error: message, step_attempts: attempts, completed_at: new Date().toISOString(), locked_at: null }
      : { status: 'scanning', error: message, step_attempts: attempts, locked_at: null }).eq('id', id);
    await logEvent({ scan_id: id }, 'radar', attempts >= 2 ? 'error' : 'warn', 'Ranking attempt ' + attempts + ' failed: ' + message);
  }
}
