import { createClient } from '@supabase/supabase-js';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

function json(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json').send(JSON.stringify(body));
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk).slice(-12000); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-4000)}`));
    });
  });
}

function safeConcatLine(url) {
  return `file '${String(url).replaceAll("'", "'\\''")}'`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      service: 'visionweaver-master-assembler',
      mode: 'ffmpeg_stream_copy',
      max_segments: 20,
      reencode: false
    });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return json(res, 500, { ok: false, error: 'supabase_runtime_not_configured' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(res, 401, { ok: false, error: 'production_sign_in_required' });

  const generationId = String(req.body?.generation_id || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(generationId)) return json(res, 400, { ok: false, error: 'invalid_generation_id' });

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return json(res, 401, { ok: false, error: 'production_sign_in_required' });
  const user = authData.user;

  const { data: parent, error: parentError } = await supabase.from('vw_generations')
    .select('*')
    .eq('id', generationId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (parentError) return json(res, 500, { ok: false, error: parentError.message });
  if (!parent) return json(res, 404, { ok: false, error: 'generation_not_found' });
  if (parent.media_type !== 'video' || parent.provider !== 'visionweaver' || parent.operation !== 'multi_shot_video') {
    return json(res, 400, { ok: false, error: 'generation_is_not_a_multi_shot_video' });
  }
  if (parent.status !== 'complete' || parent.result?.partial) {
    return json(res, 409, { ok: false, error: 'all_segments_must_complete_before_assembly' });
  }

  const { data: children, error: childError } = await supabase.from('vw_generations')
    .select('id,status,sequence_index,storage_paths,parameters')
    .eq('parent_generation_id', generationId)
    .eq('owner_id', user.id)
    .order('sequence_index');
  if (childError) return json(res, 500, { ok: false, error: childError.message });
  if (!children?.length || children.length > 20) return json(res, 400, { ok: false, error: 'invalid_segment_count' });
  if (children.some((item) => item.status !== 'complete' || !Array.isArray(item.storage_paths) || !item.storage_paths[0])) {
    return json(res, 409, { ok: false, error: 'durable_segment_copy_missing' });
  }

  const paths = children.map((item) => item.storage_paths[0]);
  const { data: signed, error: signedError } = await supabase.storage.from('visionweaver-outputs').createSignedUrls(paths, 1800);
  if (signedError || !signed || signed.some((item) => !item.signedUrl)) {
    return json(res, 500, { ok: false, error: signedError?.message || 'could_not_sign_segments' });
  }

  const workId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), `visionweaver-${workId}`);
  const listPath = path.join(tempDir, 'concat.txt');
  const masterPath = path.join(tempDir, 'master.mp4');
  await fs.mkdir(tempDir, { recursive: true });

  try {
    await fs.writeFile(listPath, signed.map((item) => safeConcatLine(item.signedUrl)).join('\n'), 'utf8');
    await runFfmpeg([
      '-hide_banner', '-loglevel', 'error',
      '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
      '-f', 'concat', '-safe', '0', '-i', listPath,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-c', 'copy', '-movflags', '+faststart', '-y', masterPath
    ]);

    const stat = await fs.stat(masterPath);
    if (!stat.size) throw new Error('assembled master is empty');
    const buffer = await fs.readFile(masterPath);
    const storagePath = `${user.id}/${parent.project_id}/masters/${parent.id}.mp4`;
    const { error: uploadError } = await supabase.storage.from('visionweaver-outputs').upload(storagePath, buffer, {
      contentType: 'video/mp4',
      upsert: true
    });
    if (uploadError) throw new Error(`master upload failed: ${uploadError.message}`);

    const result = {
      ...(parent.result || {}),
      deliverable_state: 'master_ready',
      assembly: {
        state: 'master_ready',
        strategy: 'ffmpeg_stream_copy',
        reencoded: false,
        segment_count: children.length,
        master_storage_path: storagePath,
        bytes: stat.size,
        assembled_at: new Date().toISOString()
      }
    };
    const existingPaths = Array.isArray(parent.storage_paths) ? parent.storage_paths.filter((item) => item !== storagePath) : [];
    const { error: parentUpdateError } = await supabase.from('vw_generations').update({
      storage_paths: [storagePath, ...existingPaths],
      result,
      error: null
    }).eq('id', parent.id).eq('owner_id', user.id);
    if (parentUpdateError) throw new Error(`generation update failed: ${parentUpdateError.message}`);

    await supabase.from('vw_assets').insert({
      project_id: parent.project_id,
      generation_id: parent.id,
      owner_id: user.id,
      kind: 'video',
      title: 'VisionWeaver assembled master',
      storage_path: storagePath,
      metadata: { role: 'master', strategy: 'ffmpeg_stream_copy', segment_count: children.length, bytes: stat.size }
    });

    const { data: masterSigned, error: masterSignedError } = await supabase.storage.from('visionweaver-outputs').createSignedUrl(storagePath, 3600);
    if (masterSignedError) throw new Error(`master signing failed: ${masterSignedError.message}`);
    return json(res, 200, {
      ok: true,
      generation_id: parent.id,
      master_url: masterSigned.signedUrl,
      master_storage_path: storagePath,
      segment_count: children.length,
      bytes: stat.size,
      reencoded: false
    });
  } catch (error) {
    return json(res, 500, { ok: false, error: String(error).replace(/^Error:\s*/, '').slice(0, 1200) });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
