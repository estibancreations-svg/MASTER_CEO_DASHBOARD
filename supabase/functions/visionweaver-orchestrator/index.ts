import { createClient } from 'jsr:@supabase/supabase-js@2';

// VisionWeaver Orchestrator
// Durable, minute-tick production pipeline.
// Long-form continuity rule:
//   Scene 1: text-to-video.
//   Scene N>1: video-to-video extend from Scene N-1.
// This keeps scene generation sequential and restart-safe.

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

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1';
const RUNWAY_VERSION = '2024-11-06';
const RUNWAY_LONGFORM_MODEL = 'seedance2_5';
const DEADLINE_MS = 100000;
const started = Date.now();
const outOfTime = () => Date.now() - started > DEADLINE_MS;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function secret(name) {
  const environmentValue = (Deno.env.get(name) || '').trim();
  if (environmentValue && environmentValue !== 'PLACEHOLDER_REPLACE_ME') return environmentValue;
  const { data, error } = await db.rpc('get_secret', { secret_name: name });
  if (error || !data || data === 'PLACEHOLDER_REPLACE_ME') return null;
  return String(data).trim();
}

async function setting(key, fallback) {
  const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle();
  if (!data) return fallback;
  return typeof data.value === 'string' ? data.value : fallback;
}

async function claude(system, user, maxTokens = 4000) {
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
  const json = await res.json();
  return (json.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

function parseJson(raw) {
  let text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text);
}

function clampSegmentDuration(value, fallback = 15) {
  const n = Number(value);
  const resolved = Number.isFinite(n) ? n : fallback;
  return Math.max(4, Math.min(30, Math.round(resolved)));
}

function targetRuntime(job) {
  const provenance = job?.provenance && typeof job.provenance === 'object' ? job.provenance : {};
  const candidate = Number(
    provenance.target_duration_seconds ??
    provenance.target_runtime_seconds ??
    provenance.duration_seconds ??
    0
  );
  return Number.isFinite(candidate) && candidate > 0 ? Math.round(candidate) : null;
}

async function segmentDurationFor(job) {
  const provenance = job?.provenance && typeof job.provenance === 'object' ? job.provenance : {};
  const explicit = Number(provenance.segment_duration_seconds || 0);
  if (Number.isFinite(explicit) && explicit > 0) return clampSegmentDuration(explicit);

  const runtime = targetRuntime(job);
  const count = Math.max(1, Number(job.scene_count) || 1);
  if (runtime) return clampSegmentDuration(Math.ceil(runtime / count));

  return clampSegmentDuration(await setting('visionweaver_segment_seconds', '15'));
}

async function runway(path, init = {}) {
  const key = await secret('RUNWAY_API_ACCESS');
  if (!key) throw new Error('RUNWAY_API_ACCESS is not configured');
  if (!/^key_[0-9a-f]{128}$/.test(key)) throw new Error('RUNWAY_API_ACCESS is malformed');

  const res = await fetch(RUNWAY_BASE + path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + key,
      'X-Runway-Version': RUNWAY_VERSION,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });
  const body = await res.text();
  if (!res.ok) throw new Error('Runway ' + res.status + ': ' + body.slice(0, 400));
  return body ? JSON.parse(body) : {};
}

async function stageParse(job) {
  const out = await claude(
    'You are the Content Parser for a cinematic video pipeline. Return ONLY valid JSON, no preamble, no markdown fences.',
    'Parse this concept into structured production intake.\n\nTITLE: ' + job.project_title +
      '\nPLATFORM: ' + job.target_platform +
      '\nCONCEPT: ' + job.concept +
      '\n\nReturn JSON with keys: logline (string), characters (array of objects with name and description), locations (array of strings), emotional_arc (string), tone (string).'
  );
  await db.from('production_jobs')
    .update({ parsed_content: parseJson(out), status: 'scene_breakdown', error_message: null })
    .eq('id', job.id);
}

async function stageBreakdown(job) {
  const duration = await segmentDurationFor(job);
  const runtime = targetRuntime(job);
  const requested = runtime
    ? `The requested total runtime is approximately ${runtime} seconds.`
    : `Use ${duration} seconds per scene unless a beat clearly needs less time.`;

  const out = await claude(
    'You are the Scene Breakdown agent. Describe emotional intent and audience experience before camera mechanics. Preserve strict continuity between adjacent scenes. Return ONLY valid JSON.',
    'Break this into exactly ' + job.scene_count + ' sequential scenes.\n\nPARSED: ' +
      JSON.stringify(job.parsed_content) +
      '\n\n' + requested +
      '\nEach scene must hand off naturally into the next scene: preserve character identity, wardrobe, location geography, time of day, light direction, screen direction, props, and the final physical action.' +
      '\nReturn JSON shaped as {"scenes":[{"scene_id":"SC001","beat":"...","emotional_intent":"...","subject":"...","setting":"...","continuity_handoff":"...","duration_seconds":' + duration + '}]}'
  );

  const plan = parseJson(out);
  const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];
  for (const scene of scenes) scene.duration_seconds = clampSegmentDuration(scene.duration_seconds, duration);

  await db.from('production_jobs')
    .update({
      scene_plan: { ...plan, scenes, continuity_mode: 'strict_extend', segment_duration_seconds: duration },
      status: 'cinematography',
      error_message: null
    })
    .eq('id', job.id);
}

async function stageCinematography(job) {
  const tone = job.parsed_content?.tone || '';
  const fallbackDuration = await segmentDurationFor(job);
  const out = await claude(
    'You are the Cinematic Orchestration agent. Produce final render-ready prompts with lens, lighting in Kelvin, atmosphere and movement. Every prompt after scene one must explicitly continue the prior scene without resetting the character, environment, time, wardrobe, props, or screen direction. Return ONLY valid JSON.',
    'Convert each scene into a single render-ready prompt string.\n\nSCENES: ' +
      JSON.stringify(job.scene_plan) +
      '\nTONE: ' + tone +
      '\n\nFor Scene 1, describe the opening shot completely. For Scene 2+, begin the prompt with a natural continuation instruction tied to the previous scene handoff. Avoid re-introducing subjects as if they are new.' +
      '\nReturn JSON shaped as {"scenes":[{"scene_id":"SC001","prompt":"<one rich paragraph>","continuity_handoff":"<what must carry into next scene>","duration_seconds":' + fallbackDuration + '}]}',
    7000
  );

  const cine = parseJson(out);
  const list = Array.isArray(cine.scenes) ? cine.scenes : [];
  if (!list.length) throw new Error('Cinematography returned zero scenes');

  const rows = list.map((scene, index) => ({
    job_id: job.id,
    scene_index: index,
    scene_id: scene.scene_id || ('SC' + String(index + 1).padStart(3, '0')),
    prompt: String(scene.prompt || '').slice(0, 15000),
    scene_spec: {
      ...scene,
      duration_seconds: clampSegmentDuration(scene.duration_seconds, fallbackDuration),
      continuity_mode: index === 0 ? 'origin' : 'extend_previous_scene',
      predecessor_scene_index: index === 0 ? null : index - 1
    },
    status: 'pending',
    provider: null
  }));

  await db.from('production_scenes').delete().eq('job_id', job.id);
  const { error } = await db.from('production_scenes').insert(rows);
  if (error) throw new Error('scene insert failed: ' + error.message);

  await db.from('production_jobs')
    .update({ status: 'scenes_ready', error_message: null })
    .eq('id', job.id);
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
  if (error) throw new Error('predecessor lookup failed: ' + error.message);
  return data || null;
}

async function submitScene(scene) {
  const duration = clampSegmentDuration(scene.scene_spec?.duration_seconds, 15);
  const predecessor = await previousScene(scene);
  const basePrompt = String(scene.prompt || '').slice(0, 15000);

  let operation;
  let payload;

  if (!predecessor) {
    operation = 'text_to_video';
    payload = {
      model: RUNWAY_LONGFORM_MODEL,
      promptText: basePrompt,
      duration,
      ratio: '1280:720',
      audio: false
    };
  } else {
    if (predecessor.status === 'failed') {
      throw new Error('Continuity predecessor failed: ' + predecessor.scene_id);
    }
    if (predecessor.status !== 'complete' || !predecessor.video_url) {
      return { deferred: true, reason: 'waiting_for_predecessor' };
    }

    operation = 'video_to_video_extend';
    payload = {
      model: RUNWAY_LONGFORM_MODEL,
      promptVideo: predecessor.video_url,
      promptText:
        'Continue seamlessly from the final moment of the supplied video. Preserve the same character identity, wardrobe, environment, lighting direction, props, spatial geography and motion trajectory. Do not restart or repeat the previous shot. ' +
        basePrompt,
      duration,
      mode: 'extend',
      audio: false
    };
  }

  const endpoint = operation === 'text_to_video' ? '/text_to_video' : '/video_to_video';
  const task = await runway(endpoint, { method: 'POST', body: JSON.stringify(payload) });
  if (!task.id) throw new Error('Runway returned no task id');

  const provenance = {
    provider: 'runway',
    model: RUNWAY_LONGFORM_MODEL,
    operation,
    prompt_version: scene.prompt_version || 1,
    continuity_mode: predecessor ? 'extend_previous_scene' : 'origin',
    predecessor_scene_id: predecessor?.id || null,
    predecessor_provider_task_id: predecessor?.provider_task_id || null,
    requested_duration_seconds: duration,
    continuity_overlap_intent_seconds: predecessor ? 2 : 0
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
    metadata: {
      model: RUNWAY_LONGFORM_MODEL,
      duration,
      ratio: predecessor ? 'match_input' : '1280:720',
      continuity_mode: provenance.continuity_mode,
      predecessor_scene_id: provenance.predecessor_scene_id
    }
  });

  return { deferred: false, operation };
}

async function pollScene(scene) {
  if (!scene.provider_task_id) return;
  const task = await runway('/tasks/' + encodeURIComponent(scene.provider_task_id));
  const polls = (scene.poll_count || 0) + 1;
  const maxPolls = scene.max_polls || 60;
  const status = String(task.status || '').toUpperCase();

  if (status === 'SUCCEEDED') {
    const videoUrl = Array.isArray(task.output) ? task.output.find((item) => typeof item === 'string') : null;
    if (!videoUrl) throw new Error('Runway succeeded but returned no video output URL');

    await db.from('production_scenes').update({
      status: 'complete',
      video_url: videoUrl,
      poll_count: polls,
      error_message: null
    }).eq('id', scene.id);

    await db.from('vw_integration_receipts')
      .update({ status: 'succeeded', metadata: { ...(scene.provenance || {}), output_url: videoUrl } })
      .eq('external_id', scene.provider_task_id);
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    const error = 'Runway render failed: ' + String(task.failure || task.failureCode || status).slice(0, 400);
    await db.from('production_scenes').update({
      status: 'failed',
      error_message: error,
      poll_count: polls
    }).eq('id', scene.id);
  } else if (polls >= maxPolls) {
    await db.from('production_scenes').update({
      status: 'failed',
      error_message: 'Render watchdog: exceeded ' + maxPolls + ' polls, still ' + status,
      poll_count: polls
    }).eq('id', scene.id);
  } else {
    await db.from('production_scenes').update({ poll_count: polls }).eq('id', scene.id);
  }
}

async function cascadeContinuityFailure(scene) {
  const { data: downstream } = await db.from('production_scenes')
    .select('id,scene_id,status')
    .eq('job_id', scene.job_id)
    .gt('scene_index', scene.scene_index)
    .in('status', ['pending', 'rendering']);

  for (const item of downstream || []) {
    if (item.status === 'rendering') continue;
    await db.from('production_scenes').update({
      status: 'failed',
      error_message: 'Continuity chain stopped because predecessor ' + scene.scene_id + ' failed.'
    }).eq('id', item.id);
  }
}

async function stagePublish(job) {
  const { data: scenes, error } = await db.from('production_scenes')
    .select('scene_index,scene_id,video_url,prompt,scene_spec,provenance,status')
    .eq('job_id', job.id)
    .order('scene_index');
  if (error) throw new Error(error.message);

  const complete = (scenes || []).filter((scene) => scene.status === 'complete' && scene.video_url);
  const segmentSeconds = complete.reduce(
    (total, scene) => total + clampSegmentDuration(scene.scene_spec?.duration_seconds, 15),
    0
  );
  const clipManifest = complete.map((scene) => ({
    scene_index: scene.scene_index,
    scene_id: scene.scene_id,
    video_url: scene.video_url,
    duration_seconds: clampSegmentDuration(scene.scene_spec?.duration_seconds, 15),
    continuity_mode: scene.provenance?.continuity_mode || scene.scene_spec?.continuity_mode || null
  }));

  const logline = job.parsed_content?.logline || '';
  const out = await claude(
    'You are the Publish Package agent. Return ONLY valid JSON.',
    'Create a publish package for ' + job.target_platform +
      '.\n\nTITLE: ' + job.project_title +
      '\nLOGLINE: ' + logline +
      '\nGENERATED CLIPS: ' + JSON.stringify(clipManifest) +
      '\n\nReturn JSON shaped as {"title":"...","description":"...","tags":["..."],"thumbnail_concept":"...","chapter_markers":[{"scene_id":"SC001","label":"..."}]}. '
  );
  const publish = parseJson(out);

  await db.from('production_jobs').update({
    publish_package: {
      ...publish,
      longform: {
        continuity_mode: 'strict_extend',
        segment_count: clipManifest.length,
        generated_duration_seconds: segmentSeconds,
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

async function failJob(job, message) {
  const attempts = (job.attempt_count || 0) + 1;
  const dead = attempts >= (job.max_attempts || 3);
  await db.from('production_jobs').update({
    attempt_count: attempts,
    error_message: String(message).slice(0, 1000),
    status: dead ? 'failed' : job.status,
    locked_at: null,
    locked_by: null
  }).eq('id', job.id);
}

async function advanceJobStage(acted) {
  const runId = crypto.randomUUID();
  const { data: jobs } = await db.from('production_jobs').select('*')
    .in('status', ['queued', 'scene_breakdown', 'cinematography', 'assembling'])
    .is('locked_at', null)
    .order('created_at')
    .limit(1);

  const job = jobs?.[0];
  if (!job) return;

  await db.from('production_jobs')
    .update({ locked_at: new Date().toISOString(), locked_by: runId })
    .eq('id', job.id)
    .is('locked_at', null);

  try {
    if (job.status === 'queued') {
      await stageParse(job);
      acted.push('parse:' + job.id);
    } else if (job.status === 'scene_breakdown') {
      await stageBreakdown(job);
      acted.push('breakdown:' + job.id);
    } else if (job.status === 'cinematography') {
      await stageCinematography(job);
      acted.push('cinematography:' + job.id);
    } else if (job.status === 'assembling') {
      await stagePublish(job);
      acted.push('publish:' + job.id);
    }
    await db.from('production_jobs').update({ locked_at: null, locked_by: null }).eq('id', job.id);
  } catch (error) {
    await failJob(job, error);
    acted.push('FAILED:' + job.id + ':' + String(error).slice(0, 160));
  }
}

async function pollRenderingScenes(acted) {
  const { data: rendering } = await db.from('production_scenes')
    .select('*')
    .eq('status', 'rendering')
    .order('submitted_at')
    .limit(8);

  for (const scene of rendering || []) {
    if (outOfTime()) break;
    try {
      await pollScene(scene);
      acted.push('poll:' + scene.scene_id);
    } catch (error) {
      acted.push('poll_err:' + scene.scene_id + ':' + String(error).slice(0, 100));
    }
  }
}

async function submitNextEligibleScene(acted) {
  const { data: candidates } = await db.from('production_scenes')
    .select('*, production_jobs!inner(status)')
    .eq('status', 'pending')
    .in('production_jobs.status', ['scenes_ready', 'rendering'])
    .order('created_at')
    .limit(40);

  for (const scene of candidates || []) {
    if (outOfTime()) return;

    const predecessor = await previousScene(scene);
    if (predecessor?.status === 'failed') {
      await db.from('production_scenes').update({
        status: 'failed',
        error_message: 'Continuity chain stopped because predecessor ' + predecessor.scene_id + ' failed.'
      }).eq('id', scene.id);
      acted.push('blocked:' + scene.scene_id);
      continue;
    }
    if (predecessor && (predecessor.status !== 'complete' || !predecessor.video_url)) continue;

    try {
      const result = await submitScene(scene);
      if (result?.deferred) continue;
      acted.push('submit:' + scene.scene_id + ':' + result.operation);
      await db.from('production_jobs').update({ status: 'rendering' }).eq('id', scene.job_id);
      return;
    } catch (error) {
      const attempts = (scene.attempt_count || 0) + 1;
      const failed = attempts >= (scene.max_attempts || 3);
      await db.from('production_scenes').update({
        attempt_count: attempts,
        status: failed ? 'failed' : 'pending',
        error_message: String(error).slice(0, 500)
      }).eq('id', scene.id);

      if (failed) await cascadeContinuityFailure(scene);
      acted.push('submit_err:' + scene.scene_id + ':' + String(error).slice(0, 100));
      return;
    }
  }
}

async function advanceCompletedJobs(acted) {
  const { data: active } = await db.from('production_jobs')
    .select('id')
    .eq('status', 'rendering')
    .limit(10);

  for (const job of active || []) {
    const { data: scenes } = await db.from('production_scenes')
      .select('status')
      .eq('job_id', job.id);

    if (!scenes?.length) continue;
    const unresolved = scenes.filter((scene) => !['complete', 'failed'].includes(scene.status)).length;
    if (unresolved > 0) continue;

    const allGood = scenes.every((scene) => scene.status === 'complete');
    await db.from('production_jobs').update({
      status: allGood ? 'assembling' : 'failed',
      error_message: allGood ? null : 'Continuity chain did not complete. At least one scene failed.'
    }).eq('id', job.id);
    acted.push((allGood ? 'assemble:' : 'failed_chain:') + job.id);
  }
}

async function tick() {
  const acted = [];
  await advanceJobStage(acted);
  if (!outOfTime()) await pollRenderingScenes(acted);
  if (!outOfTime()) await submitNextEligibleScene(acted);
  if (!outOfTime()) await advanceCompletedJobs(acted);
  return acted;
}

async function secretsMatch(provided, expected) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ]);
  const a = new Uint8Array(providedHash);
  const b = new Uint8Array(expectedHash);
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const isHealth = url.pathname.endsWith('/health');

    if (req.method !== 'POST' && !(req.method === 'GET' && isHealth)) {
      return Response.json({ ok: false, error: 'method_not_allowed' }, {
        status: 405,
        headers: { Allow: 'POST, GET', 'Cache-Control': 'no-store' }
      });
    }

    const providedCronSecret = (req.headers.get('authorization') || '').replace(/^Bearer +/i, '');
    const expectedCronSecret = await secret('VISIONWEAVER_CRON_SECRET');
    if (
      !providedCronSecret ||
      !expectedCronSecret ||
      !(await secretsMatch(providedCronSecret, expectedCronSecret))
    ) {
      return Response.json({ ok: false, error: 'unauthorized' }, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    if (isHealth) {
      const names = ['ANTHROPIC_API_KEY', 'RUNWAY_API_ACCESS', 'KIE_API_KEY', 'GEMINI_CONNECTION', 'OPENROUTER_API_KEY'];
      const status = {};
      for (const name of names) {
        const value = await secret(name);
        if (!value) status[name] = 'NOT_SET';
        else if (name === 'RUNWAY_API_ACCESS' && !/^key_[0-9a-f]{128}$/.test(value)) status[name] = 'SET_BUT_MALFORMED';
        else if (name === 'ANTHROPIC_API_KEY' && !value.startsWith('sk-ant-')) status[name] = 'SET_BUT_SUSPECT (expected sk-ant-)';
        else status[name] = 'OK';
      }

      return Response.json({
        ok: true,
        service: 'visionweaver-orchestrator',
        version: 6,
        providers_configured: Object.values(status).filter((value) => value === 'OK').length,
        runway_model: RUNWAY_LONGFORM_MODEL,
        continuity: {
          strategy: 'strict_sequential_video_extend',
          segment_duration_seconds: { min: 4, max: 30, default: Number(await setting('visionweaver_segment_seconds', '15')) || 15 },
          supports_target_runtime: true,
          master_assembly: 'clips_ready_master_not_yet_stitched'
        }
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const acted = await tick();
    return Response.json({
      ok: true,
      acted,
      elapsed_ms: Date.now() - started,
      continuity_mode: 'strict_extend'
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
});
