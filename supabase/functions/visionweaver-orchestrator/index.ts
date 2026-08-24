import { createClient } from 'jsr:@supabase/supabase-js@2';

// VisionWeaver Orchestrator - replaces the n8n pipeline.
// RUNTIME MODEL: invoked every minute by pg_cron. Each invocation
// advances work by ONE step and exits. Nothing waits in-process for
// a render. A 6-minute Runway render is simply 6 ticks of "still
// rendering". If this crashes mid-flight the job row is untouched and
// the next tick resumes exactly where it left off.

function namedSupabaseKey(jsonEnv, legacyEnv) {
  try {
    const named = JSON.parse(Deno.env.get(jsonEnv) || '{}');
    if (named.default) return named.default;
  } catch (_) {
    // Fall through to the legacy key during the 2026 migration window.
  }
  return Deno.env.get(legacyEnv);
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = namedSupabaseKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase server credentials are unavailable');

const DEADLINE_MS = 100000;
const started = Date.now();
const outOfTime = () => Date.now() - started > DEADLINE_MS;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function secret(name) {
  const environmentValue = (Deno.env.get(name) || '').trim();
  if (environmentValue && environmentValue !== 'PLACEHOLDER_REPLACE_ME') return environmentValue;
  const { data, error } = await db.rpc('get_secret', { secret_name: name });
  if (error) return null;
  if (!data || data === 'PLACEHOLDER_REPLACE_ME') return null;
  return data;
}

async function setting(key, fallback) {
  const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle();
  if (!data) return fallback;
  const v = data.value;
  return typeof v === 'string' ? v : fallback;
}

async function claude(system, user, maxTokens) {
  const key = await secret('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not set in Vault');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens || 4000,
      system: system,
      messages: [{ role: 'user', content: user }]
    })
  });
  if (!res.ok) throw new Error('Anthropic ' + res.status + ': ' + (await res.text()).slice(0, 400));
  const j = await res.json();
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function parseJson(raw) {
  let t = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s !== -1 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

async function stageParse(job) {
  const out = await claude(
    'You are the Content Parser for a cinematic video pipeline. Return ONLY valid JSON, no preamble, no markdown fences.',
    'Parse this concept into structured production intake.\n\nTITLE: ' + job.project_title + '\nPLATFORM: ' + job.target_platform + '\nCONCEPT: ' + job.concept + '\n\nReturn JSON with keys: logline (string), characters (array of objects with name and description), locations (array of strings), emotional_arc (string), tone (string).'
  );
  await db.from('production_jobs').update({ parsed_content: parseJson(out), status: 'scene_breakdown', error_message: null }).eq('id', job.id);
}

async function stageBreakdown(job) {
  const out = await claude(
    'You are the Scene Breakdown agent. Apply Seedance Rule 1: describe emotional intent and what the audience feels, never camera mechanics. Return ONLY valid JSON.',
    'Break this into exactly ' + job.scene_count + ' scenes.\n\nPARSED: ' + JSON.stringify(job.parsed_content) + '\n\nReturn JSON shaped as {"scenes":[{"scene_id":"SC001","beat":"...","emotional_intent":"...","subject":"...","setting":"...","duration_seconds":5}]}'
  );
  await db.from('production_jobs').update({ scene_plan: parseJson(out), status: 'cinematography', error_message: null }).eq('id', job.id);
}

async function stageCinematography(job) {
  const tone = job.parsed_content && job.parsed_content.tone ? job.parsed_content.tone : '';
  const out = await claude(
    'You are the Cinematic Orchestration agent. Produce final render-ready prompts with lens, lighting in Kelvin, atmosphere and movement. Return ONLY valid JSON.',
    'Convert each scene into a single render-ready prompt string.\n\nSCENES: ' + JSON.stringify(job.scene_plan) + '\nTONE: ' + tone + '\n\nReturn JSON shaped as {"scenes":[{"scene_id":"SC001","prompt":"<one rich paragraph>","duration_seconds":5}]}',
    6000
  );
  const cine = parseJson(out);
  const list = cine.scenes || [];
  if (!list.length) throw new Error('Cinematography returned zero scenes');
  const rows = list.map((s, i) => ({
    job_id: job.id,
    scene_index: i,
    scene_id: s.scene_id || ('SC' + String(i + 1).padStart(3, '0')),
    prompt: s.prompt,
    scene_spec: s,
    status: 'pending'
  }));
  await db.from('production_scenes').delete().eq('job_id', job.id);
  const { error } = await db.from('production_scenes').insert(rows);
  if (error) throw new Error('scene insert failed: ' + error.message);
  await db.from('production_jobs').update({ status: 'scenes_ready', error_message: null }).eq('id', job.id);
}

async function submitScene(scene) {
  const runwayKey = await secret('RUNWAY_API_ACCESS');
  if (!runwayKey) throw new Error('RUNWAY_API_ACCESS is not configured');
  if (!/^key_[0-9a-f]{128}$/.test(runwayKey)) throw new Error('RUNWAY_API_ACCESS is malformed');
  const model = await setting('runway_model', 'gen4_turbo');
  const dur = scene.scene_spec && scene.scene_spec.duration_seconds ? scene.scene_spec.duration_seconds : 5;
  const res = await fetch('https://api.dev.runwayml.com/v1/text_to_video', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + runwayKey, 'X-Runway-Version': '2024-11-06' },
    body: JSON.stringify({ model: model, promptText: (scene.prompt || '').slice(0, 1000), duration: dur, ratio: '1280:720' })
  });
  const body = await res.text();
  if (!res.ok) throw new Error('Runway submit ' + res.status + ': ' + body.slice(0, 300));
  const j = JSON.parse(body);
  if (!j.id) throw new Error('Runway returned no task id: ' + body.slice(0, 200));
  await db.from('production_scenes').update({
    status: 'rendering', provider: 'runway', provider_task_id: j.id,
    submitted_at: new Date().toISOString(), error_message: null,
    provenance: { provider: 'runway', model, prompt_version: scene.prompt_version || 1 }
  }).eq('id', scene.id);
  await db.from('vw_integration_receipts').insert({
    job_id: scene.job_id, scene_id: scene.id, provider: 'runway',
    operation: 'text_to_video', external_id: j.id, status: 'accepted',
    metadata: { model, duration: dur, ratio: '1280:720' }
  });
}

async function pollScene(scene) {
  const runwayKey = await secret('RUNWAY_API_ACCESS');
  if (!runwayKey) throw new Error('RUNWAY_API_ACCESS is not configured');
  if (!/^key_[0-9a-f]{128}$/.test(runwayKey)) throw new Error('RUNWAY_API_ACCESS is malformed');
  const res = await fetch('https://api.dev.runwayml.com/v1/tasks/' + scene.provider_task_id, {
    headers: { authorization: 'Bearer ' + runwayKey, 'X-Runway-Version': '2024-11-06' }
  });
  if (!res.ok) throw new Error('Runway poll ' + res.status);
  const j = await res.json();
  const polls = (scene.poll_count || 0) + 1;
  const maxPolls = scene.max_polls || 40;
  if (j.status === 'SUCCEEDED') {
    await db.from('production_scenes').update({
      status: 'complete', video_url: (j.output && j.output[0]) || null, poll_count: polls
    }).eq('id', scene.id);
  } else if (j.status === 'FAILED') {
    await db.from('production_scenes').update({
      status: 'failed', error_message: 'Runway render failed: ' + (j.failure || 'unknown'), poll_count: polls
    }).eq('id', scene.id);
  } else if (polls >= maxPolls) {
    await db.from('production_scenes').update({
      status: 'failed', error_message: 'Render watchdog: exceeded ' + maxPolls + ' polls, still ' + j.status, poll_count: polls
    }).eq('id', scene.id);
  } else {
    await db.from('production_scenes').update({ poll_count: polls }).eq('id', scene.id);
  }
}

async function stagePublish(job) {
  const { data: scenes } = await db.from('production_scenes')
    .select('scene_id, video_url, prompt').eq('job_id', job.id).order('scene_index');
  const logline = job.parsed_content && job.parsed_content.logline ? job.parsed_content.logline : '';
  const out = await claude(
    'You are the Publish Package agent. Return ONLY valid JSON.',
    'Create a publish package for ' + job.target_platform + '.\n\nTITLE: ' + job.project_title + '\nLOGLINE: ' + logline + '\nSCENES: ' + JSON.stringify(scenes) + '\n\nReturn JSON shaped as {"title":"...","description":"...","tags":["..."],"thumbnail_concept":"..."}'
  );
  await db.from('production_jobs').update({
    publish_package: parseJson(out), status: 'complete',
    completed_at: new Date().toISOString(), error_message: null
  }).eq('id', job.id);
}

async function failJob(job, msg) {
  const attempts = (job.attempt_count || 0) + 1;
  const dead = attempts >= (job.max_attempts || 3);
  await db.from('production_jobs').update({
    attempt_count: attempts, error_message: String(msg).slice(0, 1000),
    status: dead ? 'failed' : job.status, locked_at: null, locked_by: null
  }).eq('id', job.id);
}

async function tick() {
  const runId = crypto.randomUUID();
  const acted = [];

  const { data: jobs } = await db.from('production_jobs').select('*')
    .in('status', ['queued', 'scene_breakdown', 'cinematography', 'assembling'])
    .is('locked_at', null).order('created_at').limit(1);

  const job = jobs && jobs[0];
  if (job) {
    await db.from('production_jobs')
      .update({ locked_at: new Date().toISOString(), locked_by: runId })
      .eq('id', job.id).is('locked_at', null);
    try {
      if (job.status === 'queued') { await stageParse(job); acted.push('parse'); }
      else if (job.status === 'scene_breakdown') { await stageBreakdown(job); acted.push('breakdown'); }
      else if (job.status === 'cinematography') { await stageCinematography(job); acted.push('cinematography'); }
      else if (job.status === 'assembling') { await stagePublish(job); acted.push('publish'); }
      await db.from('production_jobs').update({ locked_at: null, locked_by: null }).eq('id', job.id);
    } catch (e) {
      await failJob(job, e);
      acted.push('FAILED:' + String(e).slice(0, 160));
    }
  }

  const { data: pending } = await db.from('production_scenes')
    .select('*, production_jobs!inner(status)').eq('status', 'pending')
    .in('production_jobs.status', ['scenes_ready', 'rendering']).limit(4);

  for (const s of pending || []) {
    if (outOfTime()) break;
    try {
      await submitScene(s);
      acted.push('submit:' + s.scene_id);
      await db.from('production_jobs').update({ status: 'rendering' }).eq('id', s.job_id);
    } catch (e) {
      const attempts = (s.attempt_count || 0) + 1;
      await db.from('production_scenes').update({
        attempt_count: attempts,
        status: attempts >= (s.max_attempts || 3) ? 'failed' : 'pending',
        error_message: String(e).slice(0, 500)
      }).eq('id', s.id);
      acted.push('submit_err:' + s.scene_id + ':' + String(e).slice(0, 90));
    }
  }

  const { data: rendering } = await db.from('production_scenes').select('*').eq('status', 'rendering').limit(8);
  for (const s of rendering || []) {
    if (outOfTime()) break;
    try { await pollScene(s); acted.push('poll:' + s.scene_id); }
    catch (e) { acted.push('poll_err:' + s.scene_id); }
  }

  const { data: active } = await db.from('production_jobs').select('id').eq('status', 'rendering').limit(5);
  for (const a of active || []) {
    const { data: sc } = await db.from('production_scenes').select('status').eq('job_id', a.id);
    if (!sc || !sc.length) continue;
    const unresolved = sc.filter(x => x.status !== 'complete' && x.status !== 'failed').length;
    if (unresolved > 0) continue;
    const anyGood = sc.some(x => x.status === 'complete');
    await db.from('production_jobs').update({
      status: anyGood ? 'assembling' : 'failed',
      error_message: anyGood ? null : 'All scenes failed to render'
    }).eq('id', a.id);
    acted.push((anyGood ? 'assemble:' : 'alldead:') + a.id);
  }

  return acted;
}

async function secretsMatch(provided, expected) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const a = new Uint8Array(providedHash);
  const b = new Uint8Array(expectedHash);
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const isHealth = url.pathname.endsWith('/health');
    if (req.method !== 'POST' && !(req.method === 'GET' && isHealth)) {
      return Response.json({ ok: false, error: 'method_not_allowed' }, {
        status: 405,
        headers: { Allow: 'POST, GET', 'Cache-Control': 'no-store' },
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
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (isHealth) {
      const names = ['ANTHROPIC_API_KEY', 'RUNWAY_API_ACCESS', 'KIE_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY'];
      const status = {};
      for (const n of names) {
        const v = await secret(n);
        if (!v) status[n] = 'NOT_SET';
        else if (n === 'RUNWAY_API_ACCESS' && !/^key_[0-9a-f]{128}$/.test(v)) status[n] = 'SET_BUT_MALFORMED';
        else if (n === 'ANTHROPIC_API_KEY' && !v.startsWith('sk-ant-')) status[n] = 'SET_BUT_SUSPECT (expected sk-ant-)';
        else status[n] = 'OK';
      }
      return Response.json({ ok: true, providers_configured: Object.values(status).filter(v => v === 'OK').length, runway_model: await setting('runway_model', 'gen4_turbo') });
    }
    const acted = await tick();
    return Response.json({ ok: true, acted: acted, elapsed_ms: Date.now() - started });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
