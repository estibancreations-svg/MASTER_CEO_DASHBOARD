import test from 'node:test';
import assert from 'node:assert/strict';
import { createHiggsfieldAdapter, extractResultUrl } from '../supabase/functions/visionweaver-orchestrator/higgsfield-adapter.js';

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(body); } };
}

test('submits documented Seedance text-to-video request', async () => {
  const requests = [];
  const adapter = createHiggsfieldAdapter({ apiKey: 'id', apiSecret: 'secret', baseUrl: 'https://api.higgsfield.ai/v1', fetchImpl: async (url, init) => {
    requests.push({ url, init });
    return jsonResponse(200, { status: 'queued', request_id: 'req-123', status_url: 'https://api.higgsfield.ai/requests/req-123/status' });
  }});
  const submitted = await adapter.submitRenderJob({ model: 'vision-weaver-v1', prompt: 'cinematic sunset', duration_seconds: 5, mode: 'origin' });
  assert.equal(submitted.id, 'req-123');
  assert.equal(requests[0].url, 'https://api.higgsfield.ai/bytedance/seedance-2.5/text-to-video');
  assert.equal(requests[0].init.headers.authorization, 'Key id:secret');
  assert.deepEqual(JSON.parse(requests[0].init.body), { prompt: 'cinematic sunset', duration: 5, resolution: '720p', bitrate_mode: 'high', generate_audio: false, aspect_ratio: '16:9', output_format: 'mp4' });
});

test('maps continuation to documented video-extend schema', async () => {
  let request;
  const adapter = createHiggsfieldAdapter({ apiKey: 'id', apiSecret: 'secret', fetchImpl: async (url, init) => {
    request = { url, init };
    return jsonResponse(200, { request_id: 'req-extend' });
  }});
  await adapter.submitRenderJob({ model: 'bytedance/seedance-2.5/text-to-video', prompt: 'continue', duration_seconds: 8, mode: 'extend', source_video_url: 'https://cdn.example.com/input.mp4' });
  assert.equal(request.url, 'https://api.higgsfield.ai/bytedance/seedance-2.5/video-extend');
  assert.equal(JSON.parse(request.init.body).video_url, 'https://cdn.example.com/input.mp4');
});

test('polls the documented request status route and extracts video.url', async () => {
  let url;
  const adapter = createHiggsfieldAdapter({ apiKey: 'id', apiSecret: 'secret', fetchImpl: async (value) => {
    url = value;
    return jsonResponse(200, { status: 'completed', video: { url: 'https://cdn.example.com/clip.mp4' } });
  }});
  const result = await adapter.pollRenderJob('req-123');
  assert.equal(url, 'https://api.higgsfield.ai/requests/req-123/status');
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.resultUrl, 'https://cdn.example.com/clip.mp4');
});

test('normalizes moderation and cancellation terminal states', async () => {
  for (const [providerStatus, expected] of [['nsfw', 'FAILED'], ['canceled', 'CANCELLED']]) {
    const adapter = createHiggsfieldAdapter({ apiKey: 'id', apiSecret: 'secret', fetchImpl: async () => jsonResponse(200, { status: providerStatus }) });
    assert.equal((await adapter.pollRenderJob('req')).status, expected);
  }
});

test('surfaces provider HTTP failures', async () => {
  const adapter = createHiggsfieldAdapter({ apiKey: 'id', apiSecret: 'secret', fetchImpl: async () => jsonResponse(401, { error: 'unauthorized' }) });
  await assert.rejects(() => adapter.submitRenderJob({ prompt: 'x' }), /Higgsfield 401: unauthorized/);
});

test('extractResultUrl supports official and legacy shapes', () => {
  assert.equal(extractResultUrl({ video: { url: 'https://cdn.example.com/official.mp4' } }), 'https://cdn.example.com/official.mp4');
  assert.equal(extractResultUrl({ result: { video_url: 'https://cdn.example.com/legacy.mp4' } }), 'https://cdn.example.com/legacy.mp4');
});

test('uses prompt-only payload for official Higgsfield image endpoints', async () => {
  let request;
  const adapter = createHiggsfieldAdapter({ apiKey: 'id', apiSecret: 'secret', fetchImpl: async (url, init) => {
    request = { url, init };
    return jsonResponse(200, { request_id: 'req-image' });
  }});
  await adapter.submitRenderJob({ model: 'higgsfield-ai/soul/v2/standard', prompt: 'editorial portrait', duration_seconds: 5 });
  assert.equal(request.url, 'https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard');
  assert.deepEqual(JSON.parse(request.init.body), { prompt: 'editorial portrait' });
});
