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
const KLING_DEFAULT_BASE = 'https://api-singapore.klingai.com';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const ALLOWED_ORIGINS = new Set([
  'https://master-ceo-dashboard.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);
const MEDIA = new Set(['image', 'video', 'audio', 'book', 'movie']);
const SHORT_PROVIDER_SHOT_MAX_SECONDS = 10;
const LONG_FORM_PROVIDER_SHOT_MAX_SECONDS = 30;
const MAX_PROVIDER_SHOTS_PER_REQUEST = 72;

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function balancedShotDurations(totalSeconds: number, maximumShotSeconds: number) {
  const total = boundedInteger(totalSeconds, 10, 5, 600);
  const count = Math.ceil(total / maximumShotSeconds);
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function productionContract(mediaType: string, parameters: Record<string, any>, providerShotMaxSeconds = SHORT_PROVIDER_SHOT_MAX_SECONDS) {
  const variants = ['image', 'video'].includes(mediaType)
    ? boundedInteger(parameters.variant_count, 1, 1, 4)
    : 1;
  const fallbackDuration = mediaType === 'movie' ? 5400 : mediaType === 'video' ? 30 : mediaType === 'audio' ? 8 : 0;
  const maximumDuration = mediaType === 'movie' ? 14400 : mediaType === 'video' ? 600 : mediaType === 'audio' ? 30 : 0;
  const targetDurationSeconds = maximumDuration
    ? boundedInteger(parameters.target_duration_seconds ?? parameters.duration, fallbackDuration, mediaType === 'audio' ? 1 : 5, maximumDuration)
    : 0;
  const shotDurations = mediaType === 'video' ? balancedShotDurations(targetDurationSeconds, providerShotMaxSeconds) : [];
  const continuityMode = mediaType === 'video' && shotDurations.length > 1 && parameters.continuity_mode === 'extend'
    ? 'extend'
    : 'reference';
  const providerShotCount = mediaType === 'video' ? shotDurations.length * variants : mediaType === 'image' ? variants : 1;
  if (providerShotCount > MAX_PROVIDER_SHOTS_PER_REQUEST) {
    throw new Error(`This request needs ${providerShotCount} provider shots. The governed maximum is ${MAX_PROVIDER_SHOTS_PER_REQUEST}; reduce variants or split the long-form production into chapters.`);
  }
  return {
    template_id: String(parameters.template_id || 'custom').slice(0, 80),
    platform: String(parameters.platform || 'Custom').slice(0, 80),
    target_duration_seconds: targetDurationSeconds,
    provider_shot_max_seconds: providerShotMaxSeconds,
    provider_shot_count: providerShotCount,
    variant_count: variants,
    shot_durations: shotDurations,
    video_generation_profile: mediaType === 'video' && providerShotMaxSeconds > SHORT_PROVIDER_SHOT_MAX_SECONDS ? 'long_form' : 'short_form',
    continuity_mode: continuityMode,
    render_mode: mediaType === 'movie' ? 'plan' : 'render'
  };
}

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
async function secret(name: string) {
  const environmentValue = (Deno.env.get(name) || '').trim();
  if (environmentValue && environmentValue !== 'PLACEHOLDER_REPLACE_ME') return environmentValue;
  const { data, error } = await db.rpc('get_secret', { secret_name: name });
  if (error || !data || data === 'PLACEHOLDER_REPLACE_ME') return null;
  const value = String(data).trim();
  return value && value !== 'PLACEHOLDER_REPLACE_ME' ? value : null;
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
  const key = await secret('RUNWAY_API_ACCESS');
  if (!key || !/^key_[0-9a-f]{128}$/.test(key)) throw new Error('Runway access is not configured correctly');
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
function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function klingToken() {
  const [accessKey, secretKey] = await Promise.all([secret('KLING_ACCESS_KEY'), secret('KLING_SECRET_KEY')]);
  if (!accessKey || !secretKey) throw new Error('Kling is not configured');
  const now = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 }));
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(input));
  return `${input}.${base64Url(new Uint8Array(signature))}`;
}
async function klingBase() {
  return (await setting('kling_api_base', KLING_DEFAULT_BASE)).replace(/\/+$/, '');
}
async function kling(path: string, init: RequestInit = {}) {
  const token = await klingToken();
  const result = await fetch(await klingBase() + path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + token,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });
  const text = await result.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch (_) {}
  if (!result.ok || (typeof json.code === 'number' && json.code !== 0)) {
    throw new Error('Kling ' + result.status + ': ' + String(json.message || json.error || text).slice(0, 400));
  }
  return json.data || json;
}
async function elevenLabsSound(prompt: string, duration: number) {
  const key = await secret('ELEVENLABS_API_KEY');
  if (!key) throw new Error('ElevenLabs is not configured');
  const result = await fetch(ELEVENLABS_BASE + '/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify({
      text: prompt.slice(0, 1000),
      duration_seconds: Math.max(0.5, Math.min(30, duration)),
      prompt_influence: 0.4,
      model_id: 'eleven_text_to_sound_v2'
    })
  });
  if (!result.ok) throw new Error('ElevenLabs ' + result.status + ': ' + (await result.text()).slice(0, 400));
  return result.blob();
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
let healthCache: { expires: number; value: any } | null = null;
async function providerHealth() {
  if (healthCache && healthCache.expires > Date.now()) return healthCache.value;
  const [anthropicKey, runwayKey, klingAccess, klingSecret, elevenLabsKey] = await Promise.all([
    secret('ANTHROPIC_API_KEY'), secret('RUNWAY_API_ACCESS'), secret('KLING_ACCESS_KEY'),
    secret('KLING_SECRET_KEY'), secret('ELEVENLABS_API_KEY')
  ]);
  let anthropicVerified = false;
  let runwayVerified = false;
  let klingVerified = false;
  let elevenLabsVerified = false;
  let anthropicStatus: number | null = null;
  let runwayStatus: number | null = null;
  let klingStatus: number | null = null;
  let elevenLabsStatus: number | null = null;
  if (anthropicKey) {
    try {
      const result = await fetch('https://api.anthropic.com/v1/models?limit=1', {
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' }
      });
      anthropicStatus = result.status;
      anthropicVerified = result.ok;
    } catch (_) {}
  }
  const runwayFormatValid = Boolean(runwayKey && /^key_[0-9a-f]{128}$/.test(runwayKey));
  if (runwayKey && runwayFormatValid) {
    try {
      const result = await fetch(RUNWAY_BASE + '/tasks/00000000-0000-0000-0000-000000000000', {
        headers: { authorization: 'Bearer ' + runwayKey, 'X-Runway-Version': RUNWAY_VERSION }
      });
      runwayStatus = result.status;
      runwayVerified = result.status !== 401 && result.status !== 403;
    } catch (_) {}
  }
  if (klingAccess && klingSecret) {
    try {
      const token = await klingToken();
      const result = await fetch(await klingBase() + '/v1/videos/text2video/00000000-0000-0000-0000-000000000000', {
        headers: { authorization: 'Bearer ' + token }
      });
      klingStatus = result.status;
      const body = await result.json().catch(() => ({}));
      klingVerified = result.status !== 401 && result.status !== 403 && !(typeof body.code === 'number' && [1001, 1002, 1003, 1004].includes(body.code));
    } catch (_) {}
  }
  if (elevenLabsKey) {
    try {
      const result = await fetch(ELEVENLABS_BASE + '/models', { headers: { 'xi-api-key': elevenLabsKey } });
      elevenLabsStatus = result.status;
      await result.body?.cancel();
      elevenLabsVerified = result.ok;
    } catch (_) {}
  }
  const imageReady = runwayVerified || klingVerified;
  const videoReady = runwayVerified || klingVerified;
  const audioReady = elevenLabsVerified || runwayVerified;
  const value = {
    providers: {
      anthropic: { configured: Boolean(anthropicKey), verified: anthropicVerified, status: anthropicStatus },
      runway: {
        configured: Boolean(runwayKey),
        length_valid: runwayKey?.length === 132,
        characters_valid: Boolean(runwayKey && /^key_[0-9a-f]+$/.test(runwayKey)),
        format_valid: runwayFormatValid,
        verified: runwayVerified,
        status: runwayStatus
      },
      kling: { configured: Boolean(klingAccess && klingSecret), verified: klingVerified, status: klingStatus },
      elevenlabs: { configured: Boolean(elevenLabsKey), verified: elevenLabsVerified, status: elevenLabsStatus }
    },
    readiness: {
      planning: anthropicVerified,
      image: imageReady,
      video: videoReady,
      audio: audioReady,
      book: anthropicVerified,
      movie: anthropicVerified && videoReady
    }
  };
  healthCache = { expires: Date.now() + 30000, value };
  return value;
}

function models() {
  return {
    image: { provider: 'automatic', model: 'Runway Gen-4 Image Turbo / Kling 2.0 fallback', operation: 'text_to_image' },
    video: { provider: 'automatic', model: 'Runway Seedance 2.5 (up to 30s) / Gen-4.5 (up to 10s)', operation: 'duration_aware_sequence' },
    audio: { provider: 'automatic', model: 'ElevenLabs Sound Effects / Runway fallback', operation: 'sound_effect' },
    book: { provider: 'anthropic', model: 'claude-sonnet-4-6', operation: 'author_package' },
    movie: { provider: 'automatic', model: 'Claude Sonnet 4.6 + verified video provider', operation: 'runtime_bound_movie_plan' }
  };
}
async function routeFor(mediaType: string, parameters: Record<string, any> = {}) {
  const health = await providerHealth();
  const requestedVideoSeconds = Number(parameters.provider_shot_max_seconds ?? parameters.target_duration_seconds ?? parameters.duration ?? 0);
  const longFormVideo = mediaType === 'video' && (parameters.video_generation_profile === 'long_form' || parameters.continuity_mode === 'extend' || requestedVideoSeconds > SHORT_PROVIDER_SHOT_MAX_SECONDS);
  if (mediaType === 'book') return { provider: 'anthropic', model: 'claude-sonnet-4-6', operation: 'author_package' };
  if (mediaType === 'movie') {
    const videoProvider = health.providers.runway.verified ? 'runway' : health.providers.kling.verified ? 'kling' : 'unavailable';
    if (!health.providers.anthropic.verified) throw new Error('No verified planning provider is available');
    return { provider: `anthropic+${videoProvider}`, model: `claude-sonnet-4-6 + ${videoProvider}`, operation: 'movie_package' };
  }
  if (mediaType === 'audio') {
    if (health.providers.elevenlabs.verified) return { provider: 'elevenlabs', model: 'eleven_text_to_sound_v2', operation: 'sound_effect' };
    if (health.providers.runway.verified) return { provider: 'runway', model: 'eleven_text_to_sound_v2', operation: 'sound_effect' };
    throw new Error('No verified audio provider is available');
  }
  if (health.providers.runway.verified) {
    return mediaType === 'image'
      ? { provider: 'runway', model: 'gen4_image_turbo', operation: 'text_to_image' }
      : longFormVideo
        ? { provider: 'runway', model: await setting('runway_long_video_model', 'seedance2_5'), operation: 'text_to_video', providerShotMaxSeconds: LONG_FORM_PROVIDER_SHOT_MAX_SECONDS }
        : { provider: 'runway', model: 'gen4.5', operation: 'text_to_video', providerShotMaxSeconds: SHORT_PROVIDER_SHOT_MAX_SECONDS };
  }
  if (health.providers.kling.verified) {
    if (longFormVideo) throw new Error('Long-form video requires the verified Runway Seedance 2.5 route; Kling remains limited to short shots.');
    return mediaType === 'image'
      ? { provider: 'kling', model: await setting('kling_image_model', 'kling-v2'), operation: 'text_to_image' }
      : { provider: 'kling', model: await setting('kling_video_model', 'kling-v2-6'), operation: 'text_to_video', providerShotMaxSeconds: SHORT_PROVIDER_SHOT_MAX_SECONDS };
  }
  throw new Error(`No verified ${mediaType} provider is available`);
}
async function planSequence(prompt: string, contract: any) {
  const rows: Array<{ sequence_index: number; variant_index: number; segment_index: number; duration_seconds: number; prompt: string }> = [];
  let sequenceIndex = 0;
  for (let variantIndex = 1; variantIndex <= contract.variant_count; variantIndex += 1) {
    for (let segmentIndex = 1; segmentIndex <= contract.shot_durations.length; segmentIndex += 1) {
      sequenceIndex += 1;
      rows.push({
        sequence_index: sequenceIndex,
        variant_index: variantIndex,
        segment_index: segmentIndex,
        duration_seconds: contract.shot_durations[segmentIndex - 1],
        prompt: `${prompt}\nVariant ${variantIndex}, shot ${segmentIndex} of ${contract.shot_durations.length}. Preserve subject, wardrobe, environment, lighting and screen direction. ${contract.continuity_mode === 'extend' && segmentIndex > 1 ? 'Start exactly from the prior shot’s ending state, composition and motion; then continue the next distinct narrative beat.' : 'Create a distinct narrative beat that connects cleanly to the adjacent shots.'}`
      });
    }
  }
  try {
    const planned = await claude(
      'You are the VisionWeaver shot planner. Return only valid JSON. Preserve the creative brief, continuity and exact row identifiers. Never change durations, variant numbers, segment numbers or row count.',
      `${prompt}\n\nPlatform: ${contract.platform}. Produce JSON {"shots":[...]} for these exact rows: ${JSON.stringify(rows.map(({ sequence_index, variant_index, segment_index, duration_seconds }) => ({ sequence_index, variant_index, segment_index, duration_seconds })))}. Each shot needs sequence_index, variant_index, segment_index, duration_seconds and a concise provider-ready prompt. Every prompt must stand alone while maintaining continuity.`,
      6000
    );
    const parsed = cleanJson(planned);
    if (Array.isArray(parsed.shots) && parsed.shots.length === rows.length) {
      const bySequence = new Map(parsed.shots.map((item: any) => [Number(item.sequence_index), item]));
      return rows.map((row) => {
        const plannedRow: any = bySequence.get(row.sequence_index);
        return plannedRow && String(plannedRow.prompt || '').trim().length >= 8
          ? { ...row, prompt: String(plannedRow.prompt).slice(0, 4000) }
          : row;
      });
    }
  } catch (error) {
    console.warn('[visionweaver-studio] shot planner fallback', { error: String(error) });
  }
  return rows;
}

async function createProject(user: any, body: any) {
  const mediaType = String(body.media_type || '').toLowerCase();
  let prompt = String(body.prompt || '').trim();
  if (!MEDIA.has(mediaType)) throw new Error('Unsupported media type');
  if (prompt.length < 8) throw new Error('Prompt must be at least 8 characters');
  const title = String(body.title || (mediaType[0].toUpperCase() + mediaType.slice(1) + ' project')).slice(0, 160);
  const requestedParameters: Record<string, any> = { ...(body.parameters && typeof body.parameters === 'object' ? body.parameters : {}) };
  if (['image', 'video'].includes(mediaType)) {
    const charIds: string[] = Array.isArray(requestedParameters.character_ids) ? requestedParameters.character_ids.slice(0, 4) : [];
    let anchorText = '';
    if (charIds.length) {
      const { data: chars } = await db.from('vw_characters').select('name,visual_anchor,bible').in('id', charIds).eq('owner_id', user.id);
      const refIds = new Set<string>(Array.isArray(requestedParameters.reference_asset_ids) ? requestedParameters.reference_asset_ids : []);
      for (const c of chars || []) for (const id of (c.bible?.reference_asset_ids || [])) refIds.add(id);
      requestedParameters.reference_asset_ids = [...refIds].slice(0, 6);
      anchorText = (chars || []).map((c: any) => `${c.name}: ${String(c.visual_anchor || '').slice(0, 200)}`).join(' | ');
      requestedParameters.character_lock = (chars || []).map((c: any) => c.name);
    }
    const camera = String(requestedParameters.camera || '').trim();
    const tail = [camera ? `Camera: ${camera}.` : '', anchorText ? `Characters (keep identical): ${anchorText}` : ''].filter(Boolean).join(' ');
    if (tail) prompt = (prompt.slice(0, Math.max(200, 980 - tail.length)) + ' ' + tail).slice(0, 1000);
  }
  let route: any = await routeFor(mediaType, requestedParameters);
  if (mediaType === 'video' && route.provider === 'runway' && ['gen4.5', 'seedance2_5'].includes(String(requestedParameters.model_choice || ''))) {
    const choice = String(requestedParameters.model_choice);
    route = { ...route, model: choice, providerShotMaxSeconds: choice === 'seedance2_5' ? LONG_FORM_PROVIDER_SHOT_MAX_SECONDS : SHORT_PROVIDER_SHOT_MAX_SECONDS };
  }
  const contract = productionContract(mediaType, requestedParameters, route.providerShotMaxSeconds || SHORT_PROVIDER_SHOT_MAX_SECONDS);
  const params = {
    ...requestedParameters,
    ...contract,
    ...(['video', 'audio'].includes(mediaType) ? { duration: contract.target_duration_seconds } : {})
  };
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
    story_object: { source: 'visionweaver-studio', version: 2, production_contract: contract }
  }).select('*').single();
  if (projectError) throw new Error('Project insert: ' + projectError.message);

  const isVideoSequence = mediaType === 'video' && contract.provider_shot_count > 1;
  const isImageBatch = mediaType === 'image' && contract.variant_count > 1;
  if (isVideoSequence || isImageBatch) {
    const parentOperation = isVideoSequence ? 'multi_shot_video' : 'image_variants';
    const { data: parent, error: parentError } = await db.from('vw_generations').insert({
      project_id: project.id,
      owner_id: user.id,
      media_type: mediaType,
      operation: parentOperation,
      provider: 'visionweaver',
      model: `${route.model} sequenced`,
      prompt,
      parameters: params,
      sequence_count: contract.provider_shot_count,
      status: 'processing',
      submitted_at: new Date().toISOString(),
      result: {
        deliverable_state: 'rendering',
        production_contract: contract,
        progress: { complete: 0, failed: 0, total: contract.provider_shot_count }
      }
    }).select('*').single();
    if (parentError) throw new Error('Parent generation insert: ' + parentError.message);

    const plan = isVideoSequence
      ? await planSequence(prompt, contract)
      : Array.from({ length: contract.variant_count }, (_, index) => ({
          sequence_index: index + 1,
          variant_index: index + 1,
          segment_index: 1,
          duration_seconds: 0,
          prompt: `${prompt}\nCreative variant ${index + 1} of ${contract.variant_count}. Preserve the subject and brand rules while varying composition and visual treatment.`
        }));
    const childIds = new Map(plan.map((shot) => [`${shot.variant_index}:${shot.segment_index}`, crypto.randomUUID()]));
    const children = plan.map((shot) => {
      const extendFromGenerationId = contract.continuity_mode === 'extend' && shot.segment_index > 1
        ? childIds.get(`${shot.variant_index}:${shot.segment_index - 1}`)
        : null;
      return {
        id: childIds.get(`${shot.variant_index}:${shot.segment_index}`),
        project_id: project.id,
        owner_id: user.id,
        parent_generation_id: parent.id,
        sequence_index: shot.sequence_index,
        sequence_count: plan.length,
        media_type: mediaType,
        operation: route.operation,
        provider: route.provider,
        model: route.model,
        prompt: shot.prompt,
        parameters: {
          ...params,
          duration: shot.duration_seconds || undefined,
          variant_index: shot.variant_index,
          segment_index: shot.segment_index,
          segment_count: isVideoSequence ? contract.shot_durations.length : 1,
          continuity_mode: extendFromGenerationId ? 'extend' : 'reference',
          extend_from_generation_id: extendFromGenerationId
        },
        status: 'queued'
      };
    });
    const { error: childrenError } = await db.from('vw_generations').insert(children);
    if (childrenError) throw new Error('Sequence insert: ' + childrenError.message);
    if (isVideoSequence) {
      const { error: sceneError } = await db.from('vw_scenes').insert(plan.map((shot) => ({
        project_id: project.id,
        scene_no: shot.sequence_index,
        spec: {
          variant_index: shot.variant_index,
          segment_index: shot.segment_index,
          duration_seconds: shot.duration_seconds,
          target_duration_seconds: contract.target_duration_seconds,
          platform: contract.platform
        },
        runway_prompt: shot.prompt,
        qc_status: 'pending'
      })));
      if (sceneError) console.warn('[visionweaver-studio] scene ledger insert failed', { error: sceneError.message });
    }
    await db.from('vw_projects').update({
      outputs: { generation_id: parent.id, format: parentOperation, production_contract: contract }
    }).eq('id', project.id);
    await tick(user.id);
    const { data: fresh } = await db.from('vw_generations').select('*').eq('id', parent.id).single();
    return { project, generation: fresh };
  }

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
async function extendSource(generation: any) {
  const predecessorId = String(generation.parameters?.extend_from_generation_id || '');
  if (!predecessorId) return { ready: true, url: null as string | null };
  const { data: predecessor, error } = await db.from('vw_generations')
    .select('id,status,output_urls,storage_paths').eq('id', predecessorId).eq('owner_id', generation.owner_id).maybeSingle();
  if (error) throw new Error('Continuity predecessor lookup: ' + error.message);
  if (!predecessor || !['complete'].includes(predecessor.status)) {
    if (predecessor && ['failed', 'cancelled'].includes(predecessor.status)) {
      await db.from('vw_generations').update({
        status: 'cancelled',
        error: `Continuity predecessor ${predecessorId} did not complete; retry that shot before continuing.`
      }).eq('id', generation.id).eq('status', 'queued');
    }
    return { ready: false, url: null as string | null };
  }
  const storagePath = Array.isArray(predecessor.storage_paths) ? predecessor.storage_paths[0] : null;
  if (storagePath) {
    const { data: signed, error: signedError } = await db.storage.from('visionweaver-outputs').createSignedUrl(storagePath, 3600);
    if (!signedError && signed?.signedUrl) return { ready: true, url: signed.signedUrl };
  }
  const outputUrl = Array.isArray(predecessor.output_urls) ? predecessor.output_urls[0] : null;
  return { ready: Boolean(outputUrl), url: typeof outputUrl === 'string' ? outputUrl : null };
}

async function resolveReferences(generation: any, max = 3) {
  const parameters = generation.parameters || {};
  const out: { uri: string; tag: string }[] = [];
  const ids: string[] = Array.isArray(parameters.reference_asset_ids) ? parameters.reference_asset_ids.slice(0, max) : [];
  if (ids.length) {
    const { data: rows } = await db.from('vw_assets').select('id,storage_path,source_url,title,metadata').in('id', ids).eq('owner_id', generation.owner_id);
    for (const row of rows || []) {
      let uri = row.source_url || '';
      if (row.storage_path) {
        const { data } = await db.storage.from('visionweaver-outputs').createSignedUrl(row.storage_path, 3600);
        if (data?.signedUrl) uri = data.signedUrl;
      }
      if (uri) {
        const base = String(row.metadata?.tag || 'ref').replace(/[^A-Za-z0-9_]/g, '').replace(/^[^A-Za-z]+/, '').slice(0, 12) || 'ref';
        out.push({ uri, tag: (base + (out.length + 1)).slice(0, 16) });
      }
    }
  }
  for (const uri of (Array.isArray(parameters.reference_urls) ? parameters.reference_urls : []).slice(0, Math.max(0, max - out.length))) {
    if (typeof uri === 'string' && uri.startsWith('http')) out.push({ uri, tag: 'ref' + (out.length + 1) });
  }
  return out;
}

async function assetUrl(ownerId: string, id: unknown) {
  if (!id || typeof id !== 'string') return null;
  const { data: row } = await db.from('vw_assets').select('storage_path,source_url').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  if (!row) return null;
  if (row.storage_path) {
    const { data } = await db.storage.from('visionweaver-outputs').createSignedUrl(row.storage_path, 3600);
    if (data?.signedUrl) return data.signedUrl;
  }
  return row.source_url || null;
}

async function sourceVideoUrl(generation: any) {
  const id = String(generation.parameters?.source_generation_id || '');
  const { data: src } = await db.from('vw_generations').select('storage_paths,output_urls').eq('id', id).eq('owner_id', generation.owner_id).maybeSingle();
  if (!src) throw new Error('Source clip not found');
  const path = Array.isArray(src.storage_paths) ? src.storage_paths[0] : null;
  if (path) {
    const { data } = await db.storage.from('visionweaver-outputs').createSignedUrl(path, 3600);
    if (data?.signedUrl) return data.signedUrl;
  }
  const url = Array.isArray(src.output_urls) ? src.output_urls[0] : null;
  if (!url) throw new Error('Source clip has no playable file yet');
  return url as string;
}

async function submitGeneration(generation: any) {
  if (generation.media_type === 'book' || generation.media_type === 'movie') {
    const isBook = generation.media_type === 'book';
    const targetDurationSeconds = boundedInteger(generation.parameters?.target_duration_seconds, 5400, 30, 14400);
    const targetRuntimeMinutes = Math.round(targetDurationSeconds / 60 * 10) / 10;
    const system = isBook
      ? 'You are VisionWeaver Author. Return only valid JSON. Build an original, editable book production package. Do not include markdown fences.'
      : 'You are VisionWeaver Film Architect. Return only valid JSON. Build an original, shootable movie pre-production package. Do not include markdown fences.';
    const instruction = isBook
      ? 'Create JSON with title, logline, audience, tone, outline (8 concise chapter objects with chapter, title, summary), sample_chapter (700 words maximum), cover_prompt, audiobook_direction, publishing_checklist. Keep the entire response under 3500 tokens.'
      : `Create JSON with title, logline, genre, audience, target_runtime_minutes (${targetRuntimeMinutes}), characters, three_act_outline, screenplay_treatment, scene_plan (18-30 concise objects with scene, purpose, estimated_duration_seconds), representative_shots (12 concise objects with shot, prompt, duration_seconds between 5 and 10), audio_plan, poster_prompt, trailer_prompt, render_approval_checklist and delivery_checklist. The estimated scene durations must total approximately ${targetDurationSeconds} seconds. This is a production plan, not a rendered movie. Keep the entire response under 3500 tokens.`;
    await db.from('vw_generations').update({ status: 'processing', submitted_at: new Date().toISOString(), attempts: generation.attempts + 1 }).eq('id', generation.id);
    const draft = await claude(system, generation.prompt + '\n\n' + instruction, 6000);
    let result;
    try {
      result = cleanJson(draft);
    } catch (_) {
      const repaired = await claude(
        'Repair the supplied material into one complete, concise, valid JSON object. Preserve the requested production fields. Return only JSON, under 3500 tokens.',
        draft.slice(0, 42000),
        6000
      );
      result = cleanJson(repaired);
    }
    result = {
      ...result,
      deliverable_state: 'plan_ready',
      target_duration_seconds: isBook ? null : targetDurationSeconds,
      rendered_duration_seconds: 0,
      requires_render_approval: !isBook
    };
    await db.from('vw_generations').update({
      status: 'complete',
      result,
      completed_at: new Date().toISOString(),
      error: null
    }).eq('id', generation.id);
    await db.from('vw_projects').update({
      status: isBook ? 'complete' : 'plan_ready',
      story_object: result,
      outputs: { generation_id: generation.id, format: isBook ? 'book_package' : 'movie_package' },
      error: null
    }).eq('id', generation.project_id);
    return;
  }

  const parameters = generation.parameters || {};
  const continuation = generation.media_type === 'video' && parameters.continuity_mode === 'extend'
    ? await extendSource(generation)
    : { ready: true, url: null as string | null };
  if (!continuation.ready) return;
  if (generation.provider === 'elevenlabs') {
    await db.from('vw_generations').update({ status: 'processing', attempts: generation.attempts + 1, submitted_at: new Date().toISOString() }).eq('id', generation.id);
    const blob = await elevenLabsSound(generation.prompt, Number(parameters.duration) || 8);
    const path = generation.owner_id + '/' + generation.project_id + '/' + generation.id + '-0.mp3';
    const { error: uploadError } = await db.storage.from('visionweaver-outputs').upload(path, blob, { contentType: 'audio/mpeg', upsert: true });
    if (uploadError) throw new Error('Audio storage: ' + uploadError.message);
    await db.from('vw_generations').update({
      status: 'complete', storage_paths: [path], result: { provider_status: 'SUCCEEDED', output_count: 1 },
      completed_at: new Date().toISOString(), error: null
    }).eq('id', generation.id);
    if (!generation.parent_generation_id) {
      await db.from('vw_projects').update({ status: 'complete', outputs: { generation_id: generation.id, storage_paths: [path] }, error: null }).eq('id', generation.project_id);
    }
    await db.from('vw_assets').insert({
      project_id: generation.project_id, generation_id: generation.id, owner_id: generation.owner_id,
      kind: 'audio', title: 'audio output 1', storage_path: path,
      metadata: { provider: generation.provider, model: generation.model, sequence_index: generation.sequence_index || null }
    });
    return;
  }
  if (generation.provider === 'kling') {
    const isImage = generation.media_type === 'image';
    const ratioMap: Record<string, string> = {
      '1360:768': '16:9', '1280:720': '16:9', '768:1360': '9:16', '720:1280': '9:16',
      '1024:1024': '1:1', '1080:1350': '3:4'
    };
    const payload = isImage ? {
      model_name: generation.model || await setting('kling_image_model', 'kling-v2'), prompt: generation.prompt.slice(0, 1000),
      aspect_ratio: ratioMap[parameters.ratio] || '16:9', n: 1
    } : {
      model_name: generation.model || await setting('kling_video_model', 'kling-v2-6'), prompt: generation.prompt.slice(0, 1000),
      mode: String(parameters.quality || '').toLowerCase() === 'high' ? 'pro' : 'std',
      duration: String(Math.max(5, Math.min(10, Number(parameters.duration) || 5))),
      aspect_ratio: ratioMap[parameters.ratio] || '16:9'
    };
    await db.from('vw_generations').update({ status: 'submitting', attempts: generation.attempts + 1 }).eq('id', generation.id);
    const task = await kling(isImage ? '/v1/images/generations' : '/v1/videos/text2video', { method: 'POST', body: JSON.stringify(payload) });
    if (!task.task_id) throw new Error('Kling returned no task id');
    await db.from('vw_generations').update({
      status: 'processing', external_id: task.task_id, model: payload.model_name,
      submitted_at: new Date().toISOString(), error: null
    }).eq('id', generation.id);
    return;
  }
  let path = '';
  let payload: any = {};
  if (generation.media_type === 'image') {
    path = '/text_to_image';
    const refs = await resolveReferences(generation);
    payload = refs.length ? {
      model: await setting('runway_image_model', 'gen4_image_turbo'),
      promptText: (generation.prompt.slice(0, 940) + ' Featuring ' + refs.map((r) => '@' + r.tag).join(', ') + '.').slice(0, 1000),
      ratio: String(parameters.ratio) === '720:1280' ? '720:1280' : ['960:960', '1024:1024'].includes(String(parameters.ratio)) ? '1024:1024' : '1360:768',
      referenceImages: refs
    } : {
      model: await setting('runway_image_model_noref', 'gemini_2.5_flash'),
      promptText: generation.prompt.slice(0, 1000),
      ratio: String(parameters.ratio) === '720:1280' ? '768:1344' : ['960:960', '1024:1024'].includes(String(parameters.ratio)) ? '1024:1024' : '1344:768'
    };
  } else if (generation.media_type === 'video') {
    const isExtend = Boolean(continuation.url);
    const ratioValue = ['1280:720', '720:1280', '960:960'].includes(String(parameters.ratio)) ? String(parameters.ratio) : '1280:720';
    if (generation.operation === 'edit_video') {
      const source = await sourceVideoUrl(generation);
      path = '/video_to_video';
      payload = parameters.edit_engine === 'seedance'
        ? { model: 'seedance2_5', promptVideo: source, mode: 'edit', duration: 'auto', promptText: generation.prompt.slice(0, 1000) }
        : { model: 'aleph2', videoUri: source, promptText: generation.prompt.slice(0, 1000) };
      if (payload.model === 'aleph2' && parameters.target_aspect_ratio) payload.targetAspectRatio = parameters.target_aspect_ratio;
    } else if (isExtend) {
      path = '/video_to_video';
      payload = {
        model: 'seedance2_5',
        promptText: generation.prompt.slice(0, 1000),
        promptVideo: continuation.url,
        mode: 'extend',
        duration: Math.max(4, Math.min(LONG_FORM_PROVIDER_SHOT_MAX_SECONDS, Number(parameters.duration) || 5))
      };
    } else {
      const choice = parameters.model_choice === 'seedance2_5' || generation.model === 'seedance2_5' ? 'seedance2_5' : 'gen4.5';
      const first = await assetUrl(generation.owner_id, parameters.first_frame_asset_id);
      const last = first ? await assetUrl(generation.owner_id, parameters.last_frame_asset_id) : null;
      const vrefs = first ? [] : await resolveReferences(generation, choice === 'seedance2_5' ? 6 : 1);
      const wanted = Number(parameters.duration) || 5;
      if (choice === 'seedance2_5') {
        const frames: any[] = first
          ? [{ uri: first, position: 'first' }, ...(last ? [{ uri: last, position: 'last' }] : [])]
          : [];
        path = frames.length ? '/image_to_video' : '/text_to_video';
        payload = {
          model: 'seedance2_5',
          ...(frames.length ? { promptImage: frames } : {}),
          ...(!frames.length && vrefs.length ? { references: vrefs.map((r) => ({ uri: r.uri })) } : {}),
          promptText: generation.prompt.slice(0, 1000),
          ratio: ratioValue,
          duration: Math.max(4, Math.min(15, Math.round(wanted)))
        };
      } else {
        const frame = first || vrefs[0]?.uri || null;
        path = frame ? '/image_to_video' : '/text_to_video';
        payload = {
          model: 'gen4.5',
          ...(frame ? { promptImage: [{ uri: frame, position: 'first' }] } : {}),
          promptText: generation.prompt.slice(0, 1000),
          ratio: frame ? ratioValue : (ratioValue === '720:1280' ? '720:1280' : '1280:720'),
          duration: Math.max(2, Math.min(SHORT_PROVIDER_SHOT_MAX_SECONDS, Math.round(wanted)))
        };
      }
    }
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
  let task: any;
  let status = '';
  let urls: string[] = [];
  if (generation.provider === 'kling') {
    task = await kling(
      generation.media_type === 'image'
        ? '/v1/images/generations/' + encodeURIComponent(generation.external_id)
        : '/v1/videos/text2video/' + encodeURIComponent(generation.external_id)
    );
    status = String(task.task_status || '').toUpperCase();
    const outputs = generation.media_type === 'image' ? task.task_result?.images : task.task_result?.videos;
    urls = Array.isArray(outputs) ? outputs.map((item: any) => item.url).filter((item: unknown) => typeof item === 'string') : [];
  } else {
    task = await runway('/tasks/' + encodeURIComponent(generation.external_id));
    status = String(task.status || '').toUpperCase();
    urls = Array.isArray(task.output) ? task.output.filter((item: unknown) => typeof item === 'string') : [];
  }
  const polls = generation.poll_count + 1;
  if (status === 'SUCCEEDED' || status === 'SUCCEED') {
    const paths = await mirrorOutputs(generation, urls);
    await db.from('vw_generations').update({
      status: 'complete',
      output_urls: urls,
      storage_paths: paths,
      result: { provider_status: status, output_count: urls.length },
      poll_count: polls,
      completed_at: new Date().toISOString(),
      error: null
    }).eq('id', generation.id);
    if (!generation.parent_generation_id) {
      await db.from('vw_projects').update({
        status: 'complete',
        outputs: { generation_id: generation.id, output_urls: urls, storage_paths: paths },
        error: null
      }).eq('id', generation.project_id);
    }
    for (let index = 0; index < Math.max(urls.length, paths.length); index += 1) {
      await db.from('vw_assets').insert({
        project_id: generation.project_id,
        generation_id: generation.id,
        owner_id: generation.owner_id,
        kind: generation.media_type,
        title: generation.media_type + ' output ' + (index + 1),
        storage_path: paths[index] || null,
        source_url: urls[index] || null,
        metadata: {
          provider: generation.provider,
          model: generation.model,
          sequence_index: generation.sequence_index || null,
          variant_index: generation.parameters?.variant_index || null,
          segment_index: generation.parameters?.segment_index || null,
          duration_seconds: generation.parameters?.duration || null
        }
      });
    }
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    const error = String(task.task_status_msg || task.failure || task.failureCode || 'Provider generation failed').slice(0, 1000);
    await db.from('vw_generations').update({ status: 'failed', error, poll_count: polls, completed_at: new Date().toISOString() }).eq('id', generation.id);
    if (!generation.parent_generation_id) await db.from('vw_projects').update({ status: 'failed', error }).eq('id', generation.project_id);
  } else if (polls >= 60) {
    const error = 'Generation watchdog exceeded 60 polls';
    await db.from('vw_generations').update({ status: 'failed', error, poll_count: polls }).eq('id', generation.id);
    if (!generation.parent_generation_id) await db.from('vw_projects').update({ status: 'failed', error }).eq('id', generation.project_id);
  } else {
    await db.from('vw_generations').update({ poll_count: polls, result: { provider_status: status } }).eq('id', generation.id);
  }
}
async function finalizeParents(ownerId?: string) {
  let parentQuery = db.from('vw_generations').select('*')
    .eq('provider', 'visionweaver')
    .eq('status', 'processing')
    .in('operation', ['multi_shot_video', 'image_variants'])
    .order('created_at')
    .limit(30);
  if (ownerId) parentQuery = parentQuery.eq('owner_id', ownerId);
  const { data: parents, error: parentError } = await parentQuery;
  if (parentError) throw new Error(parentError.message);
  const finalized: string[] = [];
  for (const parent of parents || []) {
    const { data: children, error: childError } = await db.from('vw_generations').select('*')
      .eq('parent_generation_id', parent.id).order('sequence_index');
    if (childError) throw new Error(childError.message);
    const complete = (children || []).filter((item: any) => item.status === 'complete');
    const failed = (children || []).filter((item: any) => ['failed', 'cancelled'].includes(item.status));
    const total = children?.length || Number(parent.sequence_count) || 0;
    const resolved = complete.length + failed.length;
    const progress = { complete: complete.length, failed: failed.length, total };
    const orderedOutputs = complete.flatMap((item: any) => item.output_urls || []);
    const orderedPaths = complete.flatMap((item: any) => item.storage_paths || []);
    const variants = Array.from({ length: Number(parent.parameters?.variant_count) || 1 }, (_, index) => {
      const variantIndex = index + 1;
      const variantChildren = (children || []).filter((item: any) => Number(item.parameters?.variant_index || 1) === variantIndex);
      return {
        variant_index: variantIndex,
        status: variantChildren.every((item: any) => item.status === 'complete') ? 'complete'
          : variantChildren.some((item: any) => item.status === 'failed') ? 'partial_or_failed' : 'processing',
        target_duration_seconds: Number(parent.parameters?.target_duration_seconds) || 0,
        segments: variantChildren.map((item: any) => ({
          generation_id: item.id,
          sequence_index: item.sequence_index,
          segment_index: item.parameters?.segment_index || 1,
          duration_seconds: Number(item.parameters?.duration) || 0,
          status: item.status,
          prompt: item.prompt,
          error: item.error || null
        }))
      };
    });
    const baseResult = {
      ...(parent.result || {}),
      deliverable_state: resolved === total && total > 0 ? 'sequence_ready' : 'rendering',
      production_contract: parent.result?.production_contract || parent.parameters,
      progress,
      variants,
      output_count: orderedOutputs.length,
      partial: failed.length > 0
    };
    if (resolved < total || total === 0) {
      await db.from('vw_generations').update({ result: baseResult }).eq('id', parent.id);
      continue;
    }
    const successful = complete.length > 0;
    const status = successful ? 'complete' : 'failed';
    const error = failed.length
      ? successful ? `${failed.length} of ${total} provider shots failed; retry to complete the sequence.` : 'Every provider shot failed.'
      : null;
    await db.from('vw_generations').update({
      status,
      output_urls: orderedOutputs,
      storage_paths: orderedPaths,
      result: baseResult,
      error,
      completed_at: new Date().toISOString()
    }).eq('id', parent.id);
    await db.from('vw_projects').update({
      status: successful ? 'complete' : 'failed',
      outputs: {
        generation_id: parent.id,
        format: parent.operation,
        output_urls: orderedOutputs,
        storage_paths: orderedPaths,
        production_contract: parent.parameters,
        partial: failed.length > 0
      },
      error
    }).eq('id', parent.project_id);
    finalized.push(parent.id);
  }
  return finalized;
}
async function tick(ownerId?: string, generationId?: string) {
  let query = db.from('vw_generations').select('*').in('status', ['queued', 'processing'])
    .neq('provider', 'visionweaver').order('created_at').limit(8);
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
  const finalized = await finalizeParents(ownerId);
  acted.push(...finalized.map((id) => 'finalized:' + id));
  return acted;
}
async function retryGeneration(user: any, generationId: string) {
  if (!generationId) throw new Error('generation_id is required');
  const { data: generation, error } = await db.from('vw_generations')
    .select('*').eq('id', generationId).eq('owner_id', user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!generation) throw new Error('Generation not found');
  const isParent = generation.provider === 'visionweaver';
  const isPartial = Boolean(generation.result?.partial);
  if (generation.status !== 'failed' && !isPartial) throw new Error('Only failed or partial generations can be retried');
  const route = await routeFor(generation.media_type, generation.parameters || {});
  if (isParent) {
    const { data: failedChildren, error: childrenError } = await db.from('vw_generations').select('id')
      .eq('parent_generation_id', generation.id).in('status', ['failed', 'cancelled']);
    if (childrenError) throw new Error(childrenError.message);
    const childIds = (failedChildren || []).map((item: any) => item.id);
    if (!childIds.length) throw new Error('No failed provider shots were found');
    const { error: childResetError } = await db.from('vw_generations').update({
      provider: route.provider,
      model: route.model,
      operation: route.operation,
      status: 'queued',
      external_id: null,
      error: null,
      poll_count: 0,
      submitted_at: null,
      completed_at: null
    }).in('id', childIds).eq('owner_id', user.id);
    if (childResetError) throw new Error(childResetError.message);
    await db.from('vw_generations').update({
      status: 'processing',
      error: null,
      completed_at: null,
      result: { ...(generation.result || {}), deliverable_state: 'rendering', partial: false }
    }).eq('id', generation.id).eq('owner_id', user.id);
    await db.from('vw_projects').update({ status: 'active', error: null }).eq('id', generation.project_id).eq('owner_id', user.id);
    const acted = await tick(user.id);
    return { acted, ...(await listWorkspace(user)) };
  }
  const { error: resetError } = await db.from('vw_generations').update({
    ...(['extend_video', 'edit_video'].includes(generation.operation) ? {} : { provider: route.provider, model: route.model, operation: route.operation }),
    status: 'queued',
    external_id: null,
    error: null,
    poll_count: 0,
    submitted_at: null,
    completed_at: null
  }).eq('id', generation.id).eq('owner_id', user.id);
  if (resetError) throw new Error(resetError.message);
  await db.from('vw_projects').update({ status: 'active', error: null }).eq('id', generation.project_id).eq('owner_id', user.id);
  const acted = await tick(user.id, generation.id);
  return { acted, ...(await listWorkspace(user)) };
}
async function importBook(user: any, body: any) {
  const title = String(body.title || 'Untitled book').slice(0, 160);
  const chapters = Array.isArray(body.chapters) ? body.chapters.slice(0, 80) : [];
  if (!chapters.length) throw new Error('No chapters supplied');
  const { data: project, error } = await db.from('vw_projects').insert({
    owner_id: user.id,
    organization_id: user.membership.organization_id,
    title,
    medium: 'book',
    source_concept: String(body.synopsis || title).slice(0, 4000),
    universe: String(body.universe || 'Crossroads of Identity'),
    status: 'active',
    output_formats: ['book'],
    settings: { book_import: true },
    story_object: { source: 'book_import', chapter_count: chapters.length }
  }).select('*').single();
  if (error) throw new Error('Book insert: ' + error.message);
  const rows = chapters.map((c: any, i: number) => ({
    project_id: project.id,
    scene_no: i + 1,
    spec: {
      kind: 'chapter',
      title: String(c.title || 'Chapter ' + (i + 1)).slice(0, 200),
      pov: c.pov ? String(c.pov).slice(0, 80) : null,
      summary: String(c.summary || '').slice(0, 1200),
      excerpt: String(c.text || '').slice(0, 1500),
      text: String(c.text || '').slice(0, 120000),
      word_count: Number(c.word_count) || null
    }
  }));
  const { error: sceneError } = await db.from('vw_scenes').insert(rows);
  if (sceneError) throw new Error('Chapter insert: ' + sceneError.message);
  return { project, chapters: rows.length };
}

async function saveCharacter(user: any, body: any) {
  const name = String(body.name || '').trim().slice(0, 120);
  if (!name) throw new Error('Character name required');
  const universe = String(body.universe || 'Crossroads of Identity').slice(0, 120);
  const assetIds = Array.isArray(body.reference_asset_ids) ? body.reference_asset_ids.slice(0, 6) : [];
  let paths: string[] = [];
  if (assetIds.length) {
    const { data } = await db.from('vw_assets').select('storage_path').in('id', assetIds).eq('owner_id', user.id);
    paths = (data || []).map((r: any) => r.storage_path).filter(Boolean);
  }
  if (assetIds.length) {
    const tag = name.split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, '').slice(0, 10) || 'char';
    const { data: tagRows } = await db.from('vw_assets').select('id,metadata').in('id', assetIds).eq('owner_id', user.id);
    for (const r of tagRows || []) await db.from('vw_assets').update({ metadata: { ...(r.metadata || {}), tag, role: 'character', character: name } }).eq('id', r.id);
  }
  const record = {
    universe, name,
    visual_anchor: String(body.visual_anchor || body.description || name).slice(0, 2000),
    bible: { description: String(body.description || '').slice(0, 4000), role: body.role || null, wardrobe: String(body.wardrobe || '').slice(0, 500), reference_asset_ids: assetIds, locked: body.locked !== false, confirmed: Boolean(body.confirmed) },
    reference_image_urls: paths,
    owner_id: user.id,
    project_id: body.project_id || null,
    updated_at: new Date().toISOString()
  };
  const { data: existing } = await db.from('vw_characters').select('id,version').eq('universe', universe).eq('name', name).maybeSingle();
  if (existing) {
    const { data, error } = await db.from('vw_characters').update({ ...record, version: (existing.version || 1) + 1 }).eq('id', existing.id).select('*').single();
    if (error) throw new Error(error.message);
    return { character: data };
  }
  const { data, error } = await db.from('vw_characters').insert(record).select('*').single();
  if (error) throw new Error(error.message);
  return { character: data };
}

async function registerAsset(user: any, body: any) {
  const path = String(body.storage_path || '');
  if (!path.startsWith(user.id + '/')) throw new Error('Path must be inside your own folder');
  const kind = ['image', 'video', 'audio', 'document', 'book', 'movie'].includes(body.kind) ? body.kind : 'image';
  const { data, error } = await db.from('vw_assets').insert({
    owner_id: user.id,
    project_id: body.project_id || null,
    kind,
    title: String(body.title || path.split('/').pop()).slice(0, 200),
    storage_path: path,
    mime_type: body.mime_type || null,
    metadata: { ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}), uploaded_by_user: true }
  }).select('*').single();
  if (error) throw new Error(error.message);
  return { asset: data };
}

function shotOwnerCheck(rowProject: any, user: any) {
  return rowProject && rowProject.owner_id === user.id;
}

async function planShots(user: any, body: any) {
  const { data: ch } = await db.from('vw_scenes').select('id,project_id,scene_no,spec').eq('id', String(body.chapter_id || '')).maybeSingle();
  if (!ch || ch.spec?.kind !== 'chapter') throw new Error('Chapter not found');
  const { data: proj } = await db.from('vw_projects').select('owner_id').eq('id', ch.project_id).maybeSingle();
  if (!shotOwnerCheck(proj, user)) throw new Error('Chapter not found');
  const { data: chars } = await db.from('vw_characters').select('name,visual_anchor').eq('owner_id', user.id).limit(20);
  const cast = (chars || []).map((c: any) => `- ${c.name}: ${String(c.visual_anchor || '').slice(0, 220)}`).join('\n') || '(no cast saved yet)';
  const count = boundedInteger(body.count, 8, 3, 12);
  const raw = await claude(
    'You are the AI Director adapting a novel chapter into a cinematic shot list. Return only valid JSON: {"shots":[{"title":"","prompt":"","duration_seconds":5,"characters":[],"camera":""}]}. Give exactly the requested number of shots covering the chapter’s key visual beats in story order. Each prompt is one self-contained visual description under 320 characters: subject, action, setting, light, mood. Use only physical traits given in the cast list; never invent race, age or body traits. Use character names exactly as listed. duration_seconds is 5 or 10. camera is one of: static, slow push-in, pull back, tracking, handheld, crane up, orbit, close-up.',
    `Cast:\n${cast}\n\nChapter ${ch.scene_no}: ${ch.spec.title} (POV ${ch.spec.pov || 'n/a'})\nShots requested: ${count}\n\nChapter text:\n${String(ch.spec.text || '').slice(0, 14000)}`,
    6000
  );
  const parsed = cleanJson(raw);
  const shots = Array.isArray(parsed.shots) ? parsed.shots.slice(0, count) : [];
  if (!shots.length) throw new Error('The director returned no shots. Try again.');
  const { data: old } = await db.from('vw_scenes').select('id,spec').eq('project_id', ch.project_id).eq('spec->>kind', 'shot').eq('spec->>chapter_id', ch.id);
  const oldIds = (old || []).map((r: any) => r.id);
  if (oldIds.length) await db.from('vw_scenes').delete().in('id', oldIds);
  const rows = shots.map((sh: any, i: number) => ({
    project_id: ch.project_id,
    scene_no: 1000 + Number(ch.scene_no) * 100 + i,
    runway_prompt: String(sh.prompt || '').slice(0, 1000),
    spec: {
      kind: 'shot',
      chapter_id: ch.id,
      chapter_no: ch.scene_no,
      title: String(sh.title || 'Shot ' + (i + 1)).slice(0, 120),
      prompt: String(sh.prompt || '').slice(0, 1000),
      duration_seconds: Number(sh.duration_seconds) === 10 ? 10 : 5,
      characters: Array.isArray(sh.characters) ? sh.characters.map((x: any) => String(x)).slice(0, 4) : [],
      camera: String(sh.camera || 'static').slice(0, 40),
      generation_id: null,
      first_frame_asset_id: null
    }
  }));
  const { error } = await db.from('vw_scenes').insert(rows);
  if (error) throw new Error('Shot insert: ' + error.message);
  return { planned: rows.length };
}

async function loadShot(user: any, shotId: string) {
  const { data: shot } = await db.from('vw_scenes').select('id,project_id,spec').eq('id', shotId).maybeSingle();
  if (!shot || shot.spec?.kind !== 'shot') throw new Error('Shot not found');
  const { data: proj } = await db.from('vw_projects').select('owner_id').eq('id', shot.project_id).maybeSingle();
  if (!shotOwnerCheck(proj, user)) throw new Error('Shot not found');
  return shot;
}

async function updateShot(user: any, body: any) {
  const shot = await loadShot(user, String(body.shot_id || ''));
  const allowed = ['title', 'prompt', 'duration_seconds', 'characters', 'camera', 'generation_id', 'first_frame_asset_id', 'last_frame_asset_id', 'notes'];
  const patch: Record<string, any> = {};
  for (const key of allowed) if (body.patch && key in body.patch) patch[key] = body.patch[key];
  const spec = { ...shot.spec, ...patch };
  const { error } = await db.from('vw_scenes').update({ spec, runway_prompt: String(spec.prompt || '').slice(0, 1000) }).eq('id', shot.id);
  if (error) throw new Error(error.message);
  return { shot: { id: shot.id, project_id: shot.project_id, ...spec } };
}

async function addShot(user: any, body: any) {
  const { data: proj } = await db.from('vw_projects').select('id,owner_id').eq('id', String(body.project_id || '')).maybeSingle();
  if (!shotOwnerCheck(proj, user)) throw new Error('Project not found');
  const { data: last } = await db.from('vw_scenes').select('scene_no').eq('project_id', proj!.id).order('scene_no', { ascending: false }).limit(1);
  const next = Math.max(1000, Number(last?.[0]?.scene_no || 0) + 1);
  const spec = { kind: 'shot', chapter_id: body.chapter_id || null, title: String(body.title || 'New shot').slice(0, 120), prompt: String(body.prompt || '').slice(0, 1000), duration_seconds: 5, characters: [], camera: 'static', generation_id: null, first_frame_asset_id: null };
  const { data, error } = await db.from('vw_scenes').insert({ project_id: proj!.id, scene_no: next, spec, runway_prompt: spec.prompt }).select('id,project_id,spec').single();
  if (error) throw new Error(error.message);
  return { shot: { id: data.id, project_id: data.project_id, ...data.spec } };
}

async function deleteShot(user: any, body: any) {
  const shot = await loadShot(user, String(body.shot_id || ''));
  await db.from('vw_scenes').delete().eq('id', shot.id);
  return { deleted: shot.id };
}

async function setTimeline(user: any, body: any) {
  const { data: proj } = await db.from('vw_projects').select('id,owner_id,settings').eq('id', String(body.project_id || '')).maybeSingle();
  if (!shotOwnerCheck(proj, user)) throw new Error('Project not found');
  const ids = (Array.isArray(body.generation_ids) ? body.generation_ids : []).map(String).slice(0, 40);
  const settings = { ...(proj!.settings || {}), timeline: ids };
  const { error } = await db.from('vw_projects').update({ settings }).eq('id', proj!.id);
  if (error) throw new Error(error.message);
  return { timeline: ids };
}

async function branchGeneration(user: any, body: any, kind: 'extend' | 'edit') {
  const { data: src } = await db.from('vw_generations').select('*').eq('id', String(body.generation_id || '')).eq('owner_id', user.id).maybeSingle();
  if (!src || src.media_type !== 'video') throw new Error('Clip not found');
  let source = src;
  if (src.provider === 'visionweaver') {
    const { data: kids } = await db.from('vw_generations').select('*').eq('parent_generation_id', src.id).eq('status', 'complete').order('sequence_index', { ascending: false }).limit(1);
    if (!kids?.length) throw new Error('This sequence has no finished shots yet');
    source = kids[0];
  }
  if (source.status !== 'complete') throw new Error('Wait until the clip finishes before extending or editing it');
  const prompt = String(body.prompt || '').trim();
  if (prompt.length < 4) throw new Error('Write what should happen next (at least a few words)');
  const health = await providerHealth();
  if (!health.providers.runway.verified) throw new Error('Runway is not verified right now');
  const parameters = kind === 'extend'
    ? { duration: boundedInteger(body.seconds, 6, 4, 30), continuity_mode: 'extend', extend_from_generation_id: source.id, source_generation_id: source.id, shot_id: body.shot_id || null }
    : { source_generation_id: source.id, edit_engine: body.engine === 'seedance' ? 'seedance' : 'aleph', target_aspect_ratio: body.target_aspect_ratio || null, shot_id: body.shot_id || null };
  const { data: generation, error } = await db.from('vw_generations').insert({
    project_id: source.project_id,
    owner_id: user.id,
    media_type: 'video',
    operation: kind === 'extend' ? 'extend_video' : 'edit_video',
    provider: 'runway',
    model: kind === 'extend' || parameters.edit_engine === 'seedance' ? 'seedance2_5' : 'aleph2',
    prompt: prompt.slice(0, 1000),
    parameters,
    status: 'queued'
  }).select('*').single();
  if (error) throw new Error('Generation insert: ' + error.message);
  try {
    await submitGeneration(generation);
  } catch (e) {
    await db.from('vw_generations').update({ status: 'failed', error: String(e).slice(0, 1000), attempts: 1 }).eq('id', generation.id);
    throw e;
  }
  const { data: fresh } = await db.from('vw_generations').select('*').eq('id', generation.id).single();
  return { generation: fresh };
}

async function deleteGeneration(user: any, body: any) {
  const id = String(body.generation_id || '');
  const { data: gen } = await db.from('vw_generations').select('id,storage_paths').eq('id', id).eq('owner_id', user.id).maybeSingle();
  if (!gen) throw new Error('Not found');
  const { data: kids } = await db.from('vw_generations').select('id,storage_paths').eq('parent_generation_id', id).eq('owner_id', user.id);
  const all = [gen, ...(kids || [])];
  const paths = all.flatMap((g: any) => g.storage_paths || []);
  const ids = all.map((g: any) => g.id);
  await db.from('vw_assets').delete().in('generation_id', ids).eq('owner_id', user.id);
  await db.from('vw_generations').delete().in('id', [...(kids || []).map((k: any) => k.id)]).eq('owner_id', user.id);
  const { error } = await db.from('vw_generations').delete().eq('id', id).eq('owner_id', user.id);
  if (error) throw new Error(error.message);
  if (paths.length) await db.storage.from('visionweaver-outputs').remove(paths).catch(() => {});
  return { deleted: id };
}

async function deleteCharacter(user: any, body: any) {
  const { error } = await db.from('vw_characters').delete().eq('id', String(body.character_id || '')).eq('owner_id', user.id);
  if (error) throw new Error(error.message);
  return { deleted: true };
}

async function listWorkspace(user: any) {
  const [{ data: projects, error: projectError }, { data: generations, error: generationError }, { data: assets }] = await Promise.all([
    db.from('vw_projects').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(50),
    db.from('vw_generations').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(250),
    db.from('vw_assets').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(300)
  ]);
  if (projectError) throw new Error(projectError.message);
  if (generationError) throw new Error(generationError.message);
  const { data: bookRows } = await db.from('vw_projects').select('*').eq('owner_id', user.id).eq('medium', 'book').order('created_at', { ascending: false }).limit(20);
  const projectMap = new Map<string, any>();
  for (const item of [...(projects || []), ...(bookRows || [])]) projectMap.set(item.id, item);
  const projectList = [...projectMap.values()].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
  const signed = new Map<string, string>();
  const paths = [...new Set((generations || []).flatMap((item: any) => item.storage_paths || []).concat((assets || []).map((item: any) => item.storage_path).filter(Boolean)))];
  if (paths.length) {
    const { data } = await db.storage.from('visionweaver-outputs').createSignedUrls(paths, 3600);
    for (const item of data || []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }
  const withPlayable = (item: any) => {
    const durableUrls = (item.storage_paths || []).map((path: string) => signed.get(path)).filter(Boolean);
    return { ...item, playable_urls: durableUrls.length ? durableUrls : (item.output_urls || []) };
  };
  const rows = (generations || []).map(withPlayable);
  const childrenByParent = new Map<string, any[]>();
  for (const item of rows) {
    if (!item.parent_generation_id) continue;
    const existing = childrenByParent.get(item.parent_generation_id) || [];
    existing.push(item);
    childrenByParent.set(item.parent_generation_id, existing);
  }
  const topLevel = rows.filter((item: any) => !item.parent_generation_id).map((item: any) => {
    const children = (childrenByParent.get(item.id) || []).sort((a: any, b: any) => Number(a.sequence_index) - Number(b.sequence_index));
    const childPlayable = children.flatMap((child: any) => child.playable_urls || []);
    return {
      ...item,
      children,
      playable_urls: item.playable_urls?.length ? item.playable_urls : childPlayable,
      progress: children.length ? {
        complete: children.filter((child: any) => child.status === 'complete').length,
        failed: children.filter((child: any) => ['failed', 'cancelled'].includes(child.status)).length,
        total: children.length
      } : null
    };
  });
  const { data: characters } = await db.from('vw_characters').select('*').eq('owner_id', user.id).order('updated_at', { ascending: false }).limit(100);
  const bookIds = projectList.filter((p: any) => p.medium === 'book').map((p: any) => p.id);
  let chapters: any[] = [];
  let shots: any[] = [];
  if (bookIds.length) {
    const { data: ch } = await db.from('vw_scenes').select('id,project_id,scene_no,title:spec->>title,pov:spec->>pov,summary:spec->>summary,word_count:spec->>word_count,excerpt:spec->>excerpt').in('project_id', bookIds).eq('spec->>kind', 'chapter').order('scene_no', { ascending: true }).limit(400);
    chapters = ch || [];
    const { data: sh } = await db.from('vw_scenes').select('id,project_id,scene_no,spec').in('project_id', bookIds).eq('spec->>kind', 'shot').order('scene_no', { ascending: true }).limit(1500);
    shots = (sh || []).map((r: any) => ({ id: r.id, project_id: r.project_id, scene_no: r.scene_no, ...r.spec }));
  }
  return {
    projects: projectList,
    characters: characters || [],
    chapters,
    shots,
    generations: topLevel,
    assets: (assets || []).map((item: any) => ({ ...item, playable_url: item.storage_path ? signed.get(item.storage_path) : item.source_url }))
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  try {
    const url = new URL(req.url);
    console.log('[visionweaver-studio] request', { method: req.method, path: url.pathname });
    if (req.method === 'GET' && url.pathname.endsWith('/health')) {
      const health = await providerHealth();
      return response(req, {
        ok: true,
        service: 'visionweaver-studio',
        version: 8,
        capabilities: models(),
        ...health
      });
    }
    if (req.method !== 'POST') return response(req, { ok: false, error: 'method_not_allowed' }, 405);
    const body = await req.json().catch(() => ({}));
    if (body.action === 'tick' && await isCron(req)) {
      const acted = await tick();
      console.log('[visionweaver-studio] tick complete', { count: acted.length, acted });
      return response(req, { ok: true, acted });
    }
    const user = await currentUser(req);
    if (!user) return response(req, { ok: false, error: 'production_sign_in_required' }, 401);
    if (body.action === 'create') return response(req, { ok: true, ...(await createProject(user, body)) }, 201);
    if (body.action === 'refresh') {
      const acted = await tick(user.id, body.generation_id || undefined);
      return response(req, { ok: true, acted, ...(await listWorkspace(user)) });
    }
    if (body.action === 'retry') {
      return response(req, { ok: true, ...(await retryGeneration(user, String(body.generation_id || ''))) });
    }
    if (body.action === 'import_book') return response(req, { ok: true, ...(await importBook(user, body)) }, 201);
    if (body.action === 'save_character') return response(req, { ok: true, ...(await saveCharacter(user, body)) });
    if (body.action === 'register_asset') return response(req, { ok: true, ...(await registerAsset(user, body)) }, 201);
    if (body.action === 'plan_shots') return response(req, { ok: true, ...(await planShots(user, body)) });
    if (body.action === 'update_shot') return response(req, { ok: true, ...(await updateShot(user, body)) });
    if (body.action === 'add_shot') return response(req, { ok: true, ...(await addShot(user, body)) });
    if (body.action === 'delete_shot') return response(req, { ok: true, ...(await deleteShot(user, body)) });
    if (body.action === 'set_timeline') return response(req, { ok: true, ...(await setTimeline(user, body)) });
    if (body.action === 'extend') return response(req, { ok: true, ...(await branchGeneration(user, body, 'extend')) }, 201);
    if (body.action === 'edit') return response(req, { ok: true, ...(await branchGeneration(user, body, 'edit')) }, 201);
    if (body.action === 'delete_generation') return response(req, { ok: true, ...(await deleteGeneration(user, body)) });
    if (body.action === 'delete_character') return response(req, { ok: true, ...(await deleteCharacter(user, body)) });
    if (body.action === 'chapter_text') {
      const { data } = await db.from('vw_scenes').select('spec,project_id').eq('id', String(body.chapter_id || '')).maybeSingle();
      const { data: proj } = data ? await db.from('vw_projects').select('owner_id').eq('id', data.project_id).maybeSingle() : { data: null };
      if (!data || proj?.owner_id !== user.id) return response(req, { ok: false, error: 'not_found' }, 404);
      return response(req, { ok: true, chapter: data.spec });
    }
    if (body.action === 'list') return response(req, { ok: true, ...(await listWorkspace(user)) });
    return response(req, { ok: false, error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('[visionweaver-studio] request failed', { error: String(error) });
    return response(req, { ok: false, error: String(error).replace(/^Error:\s*/, '').slice(0, 1000) }, 500);
  }
});
