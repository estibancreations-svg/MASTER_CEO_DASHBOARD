import { createClient } from 'jsr:@supabase/supabase-js@2';

function namedSupabaseKey(jsonEnv: string, legacyEnv: string) {
  try {
    const named = JSON.parse(Deno.env.get(jsonEnv) || '{}');
    if (named.default) return named.default;
  } catch (_) {}
  return Deno.env.get(legacyEnv);
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = namedSupabaseKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase server credentials unavailable');
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1';
const RUNWAY_VERSION = '2024-11-06';
const ALLOWED_ORIGINS = new Set([
  'https://master-ceo-dashboard.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);
const MEDIA = new Set(['image', 'video', 'audio', 'book', 'movie']);

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://master-ceo-dashboard.vercel.app',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'vary': 'Origin',
    'cache-control': 'no-store'
  };
}
function response(req: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors(req) });
}
async function secret(name: string) {
  const { data, error } = await db.rpc('get_secret', { secret_name: name });
  if (error || !data || data === 'PLACEHOLDER_REPLACE_ME') return null;
  return String(data);
}
async function setting(key: string, fallback: string) {
  const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle();
  return typeof data?.value === 'string' ? data.value : fallback;
}
function cleanJson(raw: string) {
  let value = raw.trim().replace(/^\`\`\`(?:json)?/i, '').replace(/\`\`\`$/i, '').trim();
  const first = value.indexOf('{');
  const last = value.lastIndexOf('}');
  if (first >= 0 && last > first) value = value.slice(first, last + 1);
  return JSON.parse(value);
}
async function claude(system: string, user: string, maxTokens = 5000) {
  const key = await secret('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Anthropic is not configured');
  const result = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    })
  });
  const text = await result.text();
  if (!result.ok) throw new Error('Anthropic ' + result.status + ': ' + text.slice(0, 300));
  const json = JSON.parse(text);
  return (json.content || []).filter((part: any) => part.type === 'text').map((part: any) => part.text).join('\n');
}
async function runway(path: string, init: RequestInit = {}) {
  const key = await secret('RUNWAY_API_KEY');
  if (!key || !key.startsWith('key_')) throw new Error('Runway is not configured');
  const result = await fetch(RUNWAY_BASE + path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + key,
      'X-Runway-Version': RUNWAY_VERSION,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });
  const text = await result.text();
  if (!result.ok) throw new Error('Runway ' + result.status + ': ' + text.slice(0, 400));
  return text ? JSON.parse(text) : {};
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
  return membership ? Object.assign(data.user, { membership }) : null;
}
async function isCron(req: Request) {
  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const expected = await secret('VISIONWEAVER_CRON_SECRET');
  if (!provided || !expected) return false;
  const data = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', data.encode(provided)),
    crypto.subtle.digest('SHA-256', data.encode(expected))
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}
function models() {
  return {
    image: { provider: 'runway', model: 'gen4_image_turbo', operation: 'text_to_image' },
    video: { provider: 'runway', model: 'gen4.5', operation: 'text_to_video' },
    audio: { provider: 'runway', model: 'eleven_text_to_sound_v2', operation: 'sound_effect' },
    book: { provider: 'anthropic', model: 'claude-sonnet-4-6', operation: 'author_package' },
    movie: { provider: 'anthropic+runway', model: 'claude-sonnet-4-6 + gen4.5', operation: 'movie_package' }
  };
}
async function createProject(user: any, body: any) {
  const mediaType = String(body.media_type || '').toLowerCase();
  const prompt = String(body.prompt || '').trim();
  if (!MEDIA.has(mediaType)) throw new Error('Unsupported media type');
  if (prompt.length < 8) throw new Error('Prompt must be at least 8 characters');
  const title = String(body.title || (mediaType[0].toUpperCase() + mediaType.slice(1) + ' project')).slice(0, 160);
  const route: any = models()[mediaType as keyof ReturnType<typeof models>];
  const params = body.parameters && typeof body.parameters === 'object' ? body.parameters : {};
  const { data: project, error: projectError } = await db.from('vw_projects').insert({
    owner_id: user.id,
    organization_id: user.membership.organization_id,
    title,
    medium: mediaType,
    source_concept: prompt,
    universe: String(body.universe || 'VisionWeaver'),
    status: 'active',
    output_formats: [mediaType],
    settings: params,
    story_object: { source: 'visionweaver-studio', version: 1 }
  }).select('*').single();
  if (projectError) throw new Error('Project insert: ' + projectError.message);
  const { data: generation, error: generationError } = await db.from('vw_generations').insert({
    project_id: project.id,
    owner_id: user.id,
    media_type: mediaType,
    operation: route.operation,
    provider: route.provider,
    model: route.model,
    prompt,
    parameters: params,
    status: 'queued'
  }).select('*').single();
  if (generationError) throw new Error('Generation insert: ' + generationError.message);
  try {
    await submitGeneration(generation);
  } catch (error) {
    await db.from('vw_generations').update({ status: 'failed', error: String(error).slice(0, 1000), attempts: 1 }).eq('id', generation.id);
    await db.from('vw_projects').update({ status: 'failed', error: String(error).slice(0, 1000) }).eq('id', project.id);
    throw error;
  }
  const { data: fresh } = await db.from('vw_generations').select('*').eq('id', generation.id).single();
  return { project, generation: fresh };
}
async function submitGeneration(generation: any) {
  if (generation.media_type === 'book' || generation.media_type === 'movie') {
    const isBook = generation.media_type === 'book';
    const system = isBook
      ? 'You are VisionWeaver Author. Return only valid JSON. Build an original, editable book production package. Do not include markdown fences.'
      : 'You are VisionWeaver Film Architect. Return only valid JSON. Build an original, shootable movie pre-production package. Do not include markdown fences.';
    const instruction = isBook
      ? 'Create JSON with title, logline, audience, tone, outline (array of chapter, title, summary), sample_chapter, cover_prompt, audiobook_direction, publishing_checklist.'
      : 'Create JSON with title, logline, genre, audience, characters, three_act_outline, screenplay_treatment, shots (array of shot, prompt, duration_seconds), audio_plan, poster_prompt, trailer_prompt, delivery_checklist.';
    await db.from('vw_generations').update({ status: 'processing', submitted_at: new Date().toISOString(), attempts: generation.attempts + 1 }).eq('id', generation.id);
    const result = cleanJson(await claude(system, generation.prompt + '\n\n' + instruction));
    await db.from('vw_generations').update({
      status: 'complete',
      result,
      completed_at: new Date().toISOString(),
      error: null
    }).eq('id', generation.id);
    await db.from('vw_projects').update({
      status: 'complete',
      story_object: result,
      outputs: { generation_id: generation.id, format: isBook ? 'book_package' : 'movie_package' },
      error: null
    }).eq('id', generation.project_id);
    return;
  }

  const parameters = generation.parameters || {};
  let path = '';
  let payload: any = {};
  if (generation.media_type === 'image') {
    path = '/text_to_image';
    payload = {
      model: await setting('runway_image_model', 'gen4_image_turbo'),
      promptText: generation.prompt.slice(0, 1000),
      ratio: parameters.ratio || '1360:768'
    };
  } else if (generation.media_type === 'video') {
    path = '/text_to_video';
    payload = {
      model: await setting('runway_model', 'gen4.5'),
      promptText: generation.prompt.slice(0, 1000),
      ratio: parameters.ratio || '1280:720',
      duration: Math.max(2, Math.min(10, Number(parameters.duration) || 5))
    };
  } else {
    path = '/sound_effect';
    payload = {
      model: await setting('runway_audio_model', 'eleven_text_to_sound_v2'),
      promptText: generation.prompt.slice(0, 1000),
      duration: Math.max(1, Math.min(30, Number(parameters.duration) || 8))
    };
  }
  await db.from('vw_generations').update({ status: 'submitting', attempts: generation.attempts + 1 }).eq('id', generation.id);
  const task = await runway(path, { method: 'POST', body: JSON.stringify(payload) });
  if (!task.id) throw new Error('Provider returned no task id');
  await db.from('vw_generations').update({
    status: 'processing',
    external_id: task.id,
    model: payload.model,
    submitted_at: new Date().toISOString(),
    error: null
  }).eq('id', generation.id);
}
async function mirrorOutputs(generation: any, urls: string[]) {
  const paths: string[] = [];
  for (let index = 0; index < urls.length; index += 1) {
    try {
      const fetched = await fetch(urls[index]);
      if (!fetched.ok) continue;
      const length = Number(fetched.headers.get('content-length') || 0);
      if (length > 100 * 1024 * 1024) continue;
      const contentType = fetched.headers.get('content-type') || (generation.media_type === 'image' ? 'image/png' : generation.media_type === 'audio' ? 'audio/mpeg' : 'video/mp4');
      const extension = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : contentType.includes('audio') ? 'mp3' : 'mp4';
      const path = generation.owner_id + '/' + generation.project_id + '/' + generation.id + '-' + index + '.' + extension;
      const blob = await fetched.blob();
      const { error } = await db.storage.from('visionweaver-outputs').upload(path, blob, { contentType, upsert: true });
      if (!error) paths.push(path);
    } catch (_) {}
  }
  return paths;
}
async function pollGeneration(generation: any) {
  if (!generation.external_id || !['image', 'video', 'audio'].includes(generation.media_type)) return;
  const task = await runway('/tasks/' + encodeURIComponent(generation.external_id));
  const polls = generation.poll_count + 1;
  if (task.status === 'SUCCEEDED') {
    const urls = Array.isArray(task.output) ? task.output.filter((item: unknown) => typeof item === 'string') : [];
    const paths = await mirrorOutputs(generation, urls);
    await db.from('vw_generations').update({
      status: 'complete',
      output_urls: urls,
      storage_paths: paths,
      result: { provider_status: task.status, output_count: urls.length },
      poll_count: polls,
      completed_at: new Date().toISOString(),
      error: null
    }).eq('id', generation.id);
    await db.from('vw_projects').update({
      status: 'complete',
      outputs: { generation_id: generation.id, output_urls: urls, storage_paths: paths },
      error: null
    }).eq('id', generation.project_id);
    for (let index = 0; index < Math.max(urls.length, paths.length); index += 1) {
      await db.from('vw_assets').insert({
        project_id: generation.project_id,
        generation_id: generation.id,
        owner_id: generation.owner_id,
        kind: generation.media_type,
        title: generation.media_type + ' output ' + (index + 1),
        storage_path: paths[index] || null,
        source_url: urls[index] || null,
        metadata: { provider: generation.provider, model: generation.model }
      });
    }
  } else if (task.status === 'FAILED' || task.status === 'CANCELLED') {
    const error = String(task.failure || task.failureCode || 'Provider generation failed').slice(0, 1000);
    await db.from('vw_generations').update({ status: 'failed', error, poll_count: polls, completed_at: new Date().toISOString() }).eq('id', generation.id);
    await db.from('vw_projects').update({ status: 'failed', error }).eq('id', generation.project_id);
  } else if (polls >= 60) {
    const error = 'Generation watchdog exceeded 60 polls';
    await db.from('vw_generations').update({ status: 'failed', error, poll_count: polls }).eq('id', generation.id);
    await db.from('vw_projects').update({ status: 'failed', error }).eq('id', generation.project_id);
  } else {
    await db.from('vw_generations').update({ poll_count: polls, result: { provider_status: task.status } }).eq('id', generation.id);
  }
}
async function tick(ownerId?: string, generationId?: string) {
  let query = db.from('vw_generations').select('*').in('status', ['queued', 'processing']).order('created_at').limit(8);
  if (ownerId) query = query.eq('owner_id', ownerId);
  if (generationId) query = query.eq('id', generationId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const acted: string[] = [];
  for (const generation of data || []) {
    try {
      if (generation.status === 'queued') {
        await submitGeneration(generation);
        acted.push('submitted:' + generation.id);
      } else if (generation.external_id) {
        await pollGeneration(generation);
        acted.push('polled:' + generation.id);
      }
    } catch (error) {
      await db.from('vw_generations').update({ status: 'failed', error: String(error).slice(0, 1000) }).eq('id', generation.id);
      acted.push('failed:' + generation.id);
    }
  }
  return acted;
}
async function listWorkspace(user: any) {
  const [{ data: projects, error: projectError }, { data: generations, error: generationError }, { data: assets }] = await Promise.all([
    db.from('vw_projects').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(50),
    db.from('vw_generations').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(100),
    db.from('vw_assets').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(100)
  ]);
  if (projectError) throw new Error(projectError.message);
  if (generationError) throw new Error(generationError.message);
  const signed = new Map<string, string>();
  const paths = [...new Set((generations || []).flatMap((item: any) => item.storage_paths || []).concat((assets || []).map((item: any) => item.storage_path).filter(Boolean)))];
  if (paths.length) {
    const { data } = await db.storage.from('visionweaver-outputs').createSignedUrls(paths, 3600);
    for (const item of data || []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }
  return {
    projects,
    generations: (generations || []).map((item: any) => ({
      ...item,
      playable_urls: (item.storage_paths || []).map((path: string) => signed.get(path)).filter(Boolean).concat(item.output_urls || [])
    })),
    assets: (assets || []).map((item: any) => ({ ...item, playable_url: item.storage_path ? signed.get(item.storage_path) : item.source_url }))
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname.endsWith('/health')) {
      const [anthropic, runway] = await Promise.all([secret('ANTHROPIC_API_KEY'), secret('RUNWAY_API_KEY')]);
      return response(req, {
        ok: true,
        service: 'visionweaver-studio',
        version: 1,
        capabilities: models(),
        readiness: { planning: Boolean(anthropic), image: Boolean(runway), video: Boolean(runway), audio: Boolean(runway), book: Boolean(anthropic), movie: Boolean(anthropic && runway) }
      });
    }
    if (req.method !== 'POST') return response(req, { ok: false, error: 'method_not_allowed' }, 405);
    const body = await req.json().catch(() => ({}));
    if (body.action === 'tick' && await isCron(req)) {
      return response(req, { ok: true, acted: await tick() });
    }
    const user = await currentUser(req);
    if (!user) return response(req, { ok: false, error: 'production_sign_in_required' }, 401);
    if (body.action === 'create') return response(req, { ok: true, ...(await createProject(user, body)) }, 201);
    if (body.action === 'refresh') {
      const acted = await tick(user.id, body.generation_id || undefined);
      return response(req, { ok: true, acted, ...(await listWorkspace(user)) });
    }
    if (body.action === 'list') return response(req, { ok: true, ...(await listWorkspace(user)) });
    return response(req, { ok: false, error: 'unknown_action' }, 400);
  } catch (error) {
    return response(req, { ok: false, error: String(error).replace(/^Error:\s*/, '').slice(0, 1000) }, 500);
  }
});
