import { createClient } from 'jsr:@supabase/supabase-js@2';

function namedSupabaseKey(jsonEnv, legacyEnv) {
  try {
    const named = JSON.parse(Deno.env.get(jsonEnv) || '{}');
    if (named.default) return named.default;
  } catch (_) {}
  return Deno.env.get(legacyEnv);
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = namedSupabaseKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase server credentials are unavailable');

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1';
const RUNWAY_VERSION = '2024-11-06';
const RUNWAY_MODEL = 'seedance2_5';
const DEADLINE_MS = 100000;
const started = Date.now();
const outOfTime = () => Date.now() - started > DEADLINE_MS;

async function secret(name) {
  const envValue = (Deno.env.get(name) || '').trim();
  if (envValue && envValue !== 'PLACEHOLDER_REPLACE_ME') return envValue;
  const { data, error } = await db.rpc('get_secret', { secret_name: name });
  if (error || !data || data === 'PLACEHOLDER_REPLACE_ME') return null;
  return String(data).trim();
}

async function setting(key, fallback) {
  const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle();
  return typeof data?.value === 'string' ? data.value : fallback;
}

function cleanJson(raw) {
  let text = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text);
}

async function claude(system, user, maxTokens = 5000) {
  const key = await secret('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not set in Vault');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }]
    })
  });
  if (!res.ok) throw new Error('Anthropic ' + res.status + ': ' + (await res.text()).slice(0, 400));
  const body = await res.json();
  return (body.content || []).filter((part) => part.type === 'text').map((part) => part.text).join('\n');
}

async function runway(path, init = {}) {
  const key = await secret('RUNWAY_API_ACCESS');
  if (!key || !/^key_[0-9a-f]{128}$/.test(key)) throw new Error('RUNWAY_API_ACCESS is not configured correctly');
  const res = await fetch(RUNWAY_BASE + path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + key,
      'X-Runway-Version': RUNWAY_VERSION,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error('Runway ' + res.status + ': ' + text.slice(0, 400));
  return text ? JSON.parse(text) : {};
}

function clampDuration(value, fallback = 5) {
  const number = Number(value);
  return Math.max(4, Math.min(30, Math.round(Number.isFinite(number) ? number : fallback)));
}

function inferRuntimeSeconds(job) {
  const provenance = job?.provenance && typeof job.provenance === 'object' ? job.provenance : {};
  const explicit = Number(
    provenance.target_duration_seconds ??
    provenance.target_runtime_seconds ??
    provenance.duration_seconds ??
    0
  );
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);

  const source = `${job?.project_title || ''} ${job?.concept || ''}`.toLowerCase();
  const hour = source.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/);
  if (hour) return Math.round(Number(hour[1]) * 3600);
  const minute = source.match(/\b(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b/);
  if (minute) return Math.round(Number(minute[1]) * 60);
  const second = source.match(/\b(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|sec)\b/);
  if (second) return Math.round(Number(second[1]));
  return null;
}

async function productionPlan(job) {
  const runtime = inferRuntimeSeconds(job);
  const requestedScenes = Math.max(1, Number(job.scene_count) || 1);
  const defaultSegment = clampDuration(await setting('visionweaver_segment_seconds', '5'), 5);
  if (!runtime) return { runtime: null, sceneCount: requestedScenes, segmentSeconds: defaultSegment };

  const sceneCount = Math.max(requestedScenes, Math.ceil(runtime / 30));
  if (sceneCount > 120) throw new Error('Requested runtime exceeds VisionWeaver long-form limit of 120 sequential segments');
  return {
    runtime,
    sceneCount,
    segmentSeconds: clampDuration(Math.ceil(runtime / sceneCount), defaultSegment)
  };
}

async function stageParse(job) {
  const plan = await productionPlan(job);
  const out = await claude(
    'You are VisionWeaver Content Parser. Return only valid JSON.',
    `Parse the production intake.\nTITLE: ${job.project_title}\nPLATFORM: ${job.target_platform}\nCONCEPT: ${job.concept}\nTARGET RUNTIME SECONDS: ${plan.runtime || 'not specified'}\nReturn {"logline":"...","characters":[{"name":"...","description":"..."}],"locations":["..."],"emotional_arc":"...","tone":"..."}.`
  );
  await db.from('production_jobs').update({
    parsed_content: cleanJson(out),
    scene_count: plan.sceneCount,
    provenance: {
      ...(job.provenance || {}),
      target_duration_seconds: plan.runtime,
      segment_duration_seconds: plan.segmentSeconds,
      continuity_mode: 'strict_extend'
    },
    status: 'scene_breakdown',
    error_message: null
  }).eq('id', job.id);
}

async function stageBreakdown(job) {
  const plan = await productionPlan(job);
  const out = await claude(
    'You are VisionWeaver Scene Breakdown. Preserve strict character, wardrobe, setting, prop, lighting, screen-direction and action continuity between adjacent scenes. Return only valid JSON.',
    `Break the production into exactly ${plan.sceneCount} sequential scenes. Each scene is about ${plan.segmentSeconds} seconds.${plan.runtime ? ` The finished runtime target is approximately ${plan.runtime} seconds.` : ''}\nPARSED: ${JSON.stringify(job.parsed_content)}\nReturn {"scenes":[{"scene_id":"SC001","beat":"...","emotional_intent":"...","subject":"...","setting":"...","continuity_handoff":"...","duration_seconds":${plan.segmentSeconds}}]}.`
  );
  const parsed = cleanJson(out);
  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  if (scenes.length !== plan.sceneCount) throw new Error(`Scene breakdown returned ${scenes.length}; expected ${plan.sceneCount}`);
  for (const scene of scenes) scene.duration_seconds = clampDuration(scene.duration_seconds, plan.segmentSeconds);
  await db.from('production_jobs').update({
    scene_plan: { ...parsed, scenes, continuity_mode: 'strict_extend', segment_duration_seconds: plan.segmentSeconds },
    scene_count: plan.sceneCount,
    status: 'cinematography',
    error_message: null
  }).eq('id', job.id);
}

async function stageCinematography(job) {
  const scenes = Array.isArray(job.scene_plan?.scenes) ? job.scene_plan.scenes : [];
  if (!scenes.length) throw new Error('Scene plan is empty');
  const out = await claude(
    'You are VisionWeaver Cinematic Orchestration. Return only valid JSON. Scene 1 establishes the production. Every later scene must continue the prior scene rather than reset it.',
    `Convert exactly ${scenes.length} scenes into render-ready prompts. Include lens, light, atmosphere and movement while preserving continuity handoffs.\nTONE: ${job.parsed_content?.tone || ''}\nSCENES: ${JSON.stringify(scenes)}\nReturn {"scenes":[{"scene_id":"SC001","prompt":"...","continuity_handoff":"...","duration_seconds":5}]}.`,
    8000
  );
  const parsed = cleanJson(out);
  const rendered = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  if (rendered.length !== scenes.length) throw new Error(`Cinematography returned ${rendered.length}; expected ${scenes.length}`);
  const fallbackDuration = clampDuration(job.provenance?.segment_duration_seconds, 5);
  const rows = rendered.map((scene, index) => ({
    job_id: job.id,
    scene_index: index,
    scene_id: scene.scene_id || `SC${String(index + 1).padStart(3, '0')}`,
    prompt: String(scene.prompt || '').slice(0, 15000),
    scene_spec: {
      ...scene,
      duration_seconds: clampDuration(scene.duration_seconds, fallbackDuration),
      continuity_mode: index === 0 ? 'origin' : 'extend_previous_scene',
      predecessor_scene_index: index === 0 ? null : index - 1
    },
    status: 'pending',
    provider: null
  }));
  await db.from('production_scenes').delete().eq('job_id', job.id);
  const { error } = await db.from('production_scenes').insert(rows);
  if (error) throw new Error('scene insert failed: ' + error.message);
  await db.from('production_jobs').update({ status: 'scenes_ready', error_message: null }).eq('id', job.id);
}

async function previousScene(scene) {
  if (Number(scene.scene_index) <= 0) return null;
  const { data, error } = await db.from('production_scenes')
    .select('*')
    .eq('job_id', scene.job_id)
    .lt('scene_index', scene.scene_index)
    .order('scene_index', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function submitScene(scene) {
  const predecessor = await previousScene(scene);
  if (predecessor && (predecessor.status !== 'complete' || !predecessor.video_url)) return { deferred: true };
  const duration = clampDuration(scene.scene_spec?.duration_seconds, 5);
  const basePrompt = String(scene.prompt || '').slice(0, 15000);
  const extend = Boolean(predecessor);
  const endpoint = extend ? '/video_to_video' : '/text_to_video';
  const payload = extend
    ? {
        model: RUNWAY_MODEL,
        promptVideo: predecessor.video_url,
        promptText: 'Continue seamlessly from the final moment of the supplied video. Preserve character identity, wardrobe, environment, lighting direction, props, geography, screen direction and motion. Do not restart or repeat the prior shot. ' + basePrompt,
        duration,
        mode: 'extend',
        audio: false
      }
    : {
        model: RUNWAY_MODEL,
        promptText: basePrompt,
        duration,
        ratio: '1280:720',
        audio: false
      };

  const task = await runway(endpoint, { method: 'POST', body: JSON.stringify(payload) });
  if (!task.id) throw new Error('Runway returned no task id');
  const operation = extend ? 'video_to_video_extend' : 'text_to_video';
  const provenance = {
    provider: 'runway',
    model: RUNWAY_MODEL,
    operation,
    continuity_mode: extend ? 'extend_previous_scene' : 'origin',
    predecessor_scene_id: predecessor?.id || null,
    predecessor_provider_task_id: predecessor?.provider_task_id || null,
    requested_duration_seconds: duration,
    continuity_overlap_intent_seconds: extend ? 2 : 0,
    prompt_version: scene.prompt_version || 1
  };
  await db.from('production_scenes').update({
    status: 'rendering',
    provider: 'runway',
    provider_task_id: task.id,
    submitted_at: new Date().toISOString(),
    error_message: null,
    provenance
  }).eq('id', scene.id);
  await db.from('vw_integration_receipts').insert({
    job_id: scene.job_id,
    scene_id: scene.id,
    provider: 'runway',
    operation,
    external_id: task.id,
    status: 'accepted',
    metadata: { ...provenance, ratio: extend ? 'match_input' : '1280:720' }
  });
  return { deferred: false, operation };
}

async function pollScene(scene) {
  if (!scene.provider_task_id) return;
  const task = await runway('/tasks/' + encodeURIComponent(scene.provider_task_id));
  const polls = (scene.poll_count || 0) + 1;
  const status = String(task.status || '').toUpperCase();
  if (status === 'SUCCEEDED') {
    const videoUrl = Array.isArray(task.output) ? task.output.find((item) => typeof item === 'string') : null;
    if (!videoUrl) throw new Error('Runway succeeded without an output URL');
    await db.from('production_scenes').update({ status: 'complete', video_url: videoUrl, poll_count: polls, error_message: null }).eq('id', scene.id);
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    await db.from('production_scenes').update({ status: 'failed', error_message: String(task.failure || task.failureCode || status).slice(0, 500), poll_count: polls }).eq('id', scene.id);
  } else if (polls >= (scene.max_polls || 60)) {
    await db.from('production_scenes').update({ status: 'failed', error_message: `Render watchdog exceeded ${scene.max_polls || 60} polls`, poll_count: polls }).eq('id', scene.id);
  } else {
    await db.from('production_scenes').update({ poll_count: polls }).eq('id', scene.id);
  }
}

async function stagePublish(job) {
  const { data: scenes, error } = await db.from('production_scenes')
    .select('scene_index,scene_id,video_url,prompt,scene_spec,provenance,status')
    .eq('job_id', job.id)
    .order('scene_index');
  if (error) throw new Error(error.message);
  const complete = (scenes || []).filter((scene) => scene.status === 'complete' && scene.video_url);
  const clipManifest = complete.map((scene) => ({
    scene_index: scene.scene_index,
    scene_id: scene.scene_id,
    video_url: scene.video_url,
    duration_seconds: clampDuration(scene.scene_spec?.duration_seconds, 5),
    continuity_mode: scene.provenance?.continuity_mode || scene.scene_spec?.continuity_mode || null
  }));
  const generatedDuration = clipManifest.reduce((sum, scene) => sum + scene.duration_seconds, 0);
  const out = await claude(
    'You are VisionWeaver Publish Package. Return only valid JSON.',
    `Create publishing metadata for ${job.target_platform}. TITLE: ${job.project_title}. LOGLINE: ${job.parsed_content?.logline || ''}. CLIPS: ${JSON.stringify(clipManifest)}. Return {"title":"...","description":"...","tags":["..."],"thumbnail_concept":"...","chapter_markers":[{"scene_id":"SC001","label":"..."}]}.`
  );
  await db.from('production_jobs').update({
    publish_package: {
      ...cleanJson(out),
      longform: {
        continuity_mode: 'strict_extend',
        target_duration_seconds: inferRuntimeSeconds(job),
        generated_duration_seconds: generatedDuration,
        segment_count: clipManifest.length,
        clip_manifest: clipManifest,
        assembly_state: 'clips_ready_master_not_yet_stitched',
        master_video_url: null
      }
    },
    status: 'complete',
    completed_at: new Date().toISOString(),
    error_message: null
  }).eq('id', job.id);
}

async function failJob(job, error) {
  const attempts = (job.attempt_count || 0) + 1;
  await db.from('production_jobs').update({
    attempt_count: attempts,
    error_message: String(error).slice(0, 1000),
    status: attempts >= (job.max_attempts || 3) ? 'failed' : job.status,
    locked_at: null,
    locked_by: null
  }).eq('id', job.id);
}

async function advanceJobStage(acted) {
  const { data: jobs } = await db.from('production_jobs').select('*')
    .in('status', ['queued', 'scene_breakdown', 'cinematography', 'assembling'])
    .is('locked_at', null)
    .order('created_at')
    .limit(1);
  const job = jobs?.[0];
  if (!job) return;
  const lock = crypto.randomUUID();
  await db.from('production_jobs').update({ locked_at: new Date().toISOString(), locked_by: lock }).eq('id', job.id).is('locked_at', null);
  try {
    if (job.status === 'queued') await stageParse(job);
    else if (job.status === 'scene_breakdown') await stageBreakdown(job);
    else if (job.status === 'cinematography') await stageCinematography(job);
    else if (job.status === 'assembling') await stagePublish(job);
    acted.push(`${job.status}:${job.id}`);
    await db.from('production_jobs').update({ locked_at: null, locked_by: null }).eq('id', job.id);
  } catch (error) {
    await failJob(job, error);
    acted.push(`failed:${job.id}`);
  }
}

async function pollRendering(acted) {
  const { data: scenes } = await db.from('production_scenes').select('*').eq('status', 'rendering').order('submitted_at').limit(8);
  for (const scene of scenes || []) {
    if (outOfTime()) return;
    try {
      await pollScene(scene);
      acted.push('poll:' + scene.scene_id);
    } catch (error) {
      acted.push('poll_error:' + scene.scene_id + ':' + String(error).slice(0, 100));
    }
  }
}

async function submitNextScene(acted) {
  const { data: scenes } = await db.from('production_scenes')
    .select('*, production_jobs!inner(status)')
    .eq('status', 'pending')
    .in('production_jobs.status', ['scenes_ready', 'rendering'])
    .order('created_at')
    .limit(120);
  for (const scene of scenes || []) {
    if (outOfTime()) return;
    const predecessor = await previousScene(scene);
    if (predecessor?.status === 'failed') {
      await db.from('production_scenes').update({ status: 'failed', error_message: `Continuity predecessor ${predecessor.scene_id} failed` }).eq('id', scene.id);
      continue;
    }
    if (predecessor && (predecessor.status !== 'complete' || !predecessor.video_url)) continue;
    try {
      const result = await submitScene(scene);
      if (result?.deferred) continue;
      await db.from('production_jobs').update({ status: 'rendering' }).eq('id', scene.job_id);
      acted.push('submit:' + scene.scene_id + ':' + result.operation);
      return;
    } catch (error) {
      const attempts = (scene.attempt_count || 0) + 1;
      const dead = attempts >= (scene.max_attempts || 3);
      await db.from('production_scenes').update({
        attempt_count: attempts,
        status: dead ? 'failed' : 'pending',
        error_message: String(error).slice(0, 500)
      }).eq('id', scene.id);
      acted.push('submit_error:' + scene.scene_id);
      return;
    }
  }
}

async function finalizeJobs(acted) {
  const { data: jobs } = await db.from('production_jobs').select('id').eq('status', 'rendering').limit(10);
  for (const job of jobs || []) {
    const { data: scenes } = await db.from('production_scenes').select('status').eq('job_id', job.id);
    if (!scenes?.length) continue;
    if (scenes.some((scene) => !['complete', 'failed'].includes(scene.status))) continue;
    const allGood = scenes.every((scene) => scene.status === 'complete');
    await db.from('production_jobs').update({
      status: allGood ? 'assembling' : 'failed',
      error_message: allGood ? null : 'Continuity chain failed before all scenes completed'
    }).eq('id', job.id);
    acted.push((allGood ? 'assemble:' : 'failed_chain:') + job.id);
  }
}

async function tick() {
  const acted = [];
  await advanceJobStage(acted);
  if (!outOfTime()) await pollRendering(acted);
  if (!outOfTime()) await submitNextScene(acted);
  if (!outOfTime()) await finalizeJobs(acted);
  return acted;
}

async function secretsMatch(provided, expected) {
  const encoder = new TextEncoder();
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ]);
  const a = new Uint8Array(aHash);
  const b = new Uint8Array(bHash);
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const isHealth = url.pathname.endsWith('/health');
    if (req.method !== 'POST' && !(req.method === 'GET' && isHealth)) {
      return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405, headers: { 'Cache-Control': 'no-store' } });
    }
    const provided = (req.headers.get('authorization') || '').replace(/^Bearer +/i, '');
    const expected = await secret('VISIONWEAVER_CRON_SECRET');
    if (!provided || !expected || !(await secretsMatch(provided, expected))) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    if (isHealth) {
      const defaultSeconds = clampDuration(await setting('visionweaver_segment_seconds', '5'), 5);
      return Response.json({
        ok: true,
        service: 'visionweaver-orchestrator',
        version: 7,
        runway_model: RUNWAY_MODEL,
        continuity: {
          strategy: 'strict_sequential_video_extend',
          default_segment_seconds: defaultSeconds,
          segment_seconds: { min: 4, max: 30 },
          prompt_runtime_inference: true,
          explicit_runtime_provenance: true,
          master_assembly: 'clips_ready_master_not_yet_stitched'
        }
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const acted = await tick();
    return Response.json({ ok: true, acted, elapsed_ms: Date.now() - started, continuity_mode: 'strict_extend' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
});
