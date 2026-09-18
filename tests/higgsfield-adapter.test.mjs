import test from 'node:test';
import assert from 'node:assert/strict';
import { createHiggsfieldAdapter, extractResultUrl } from '../supabase/functions/visionweaver-orchestrator/higgsfield-adapter.js';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

test('Higgsfield adapter submits a render job and returns the job id', async () => {
  const requests = [];
  const adapter = createHiggsfieldAdapter({
    apiKey: 'key',
    apiSecret: 'secret',
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return jsonResponse(200, { job_id: 'job-123' });
    }
  });
  const submitted = await adapter.submitRenderJob({ prompt: 'cinematic sunset', duration_seconds: 5 });
  assert.equal(submitted.id, 'job-123');
  assert.equal(requests[0].url.endsWith('/render-jobs'), true);
  assert.equal(requests[0].init.method, 'POST');
});

test('Higgsfield adapter polls status and resolves completed asset URL', async () => {
  const adapter = createHiggsfieldAdapter({
    apiKey: 'key',
    apiSecret: 'secret',
    fetchImpl: async () => jsonResponse(200, { status: 'completed', output_urls: ['https://cdn.example.com/clip.mp4'] })
  });
  const polled = await adapter.pollRenderJob('job-123');
  assert.equal(polled.status, 'SUCCEEDED');
  assert.equal(polled.resultUrl, 'https://cdn.example.com/clip.mp4');
});

test('Higgsfield adapter keeps queued/running jobs in non-terminal state', async () => {
  const adapter = createHiggsfieldAdapter({
    apiKey: 'key',
    apiSecret: 'secret',
    fetchImpl: async () => jsonResponse(200, { state: 'rendering' })
  });
  const polled = await adapter.pollRenderJob('job-123');
  assert.equal(polled.status, 'RUNNING');
  assert.equal(polled.resultUrl, null);
});

test('Higgsfield adapter surfaces provider HTTP failures', async () => {
  const adapter = createHiggsfieldAdapter({
    apiKey: 'key',
    apiSecret: 'secret',
    fetchImpl: async () => jsonResponse(401, { error: 'unauthorized' })
  });
  await assert.rejects(
    () => adapter.submitRenderJob({ prompt: 'x' }),
    /Higgsfield 401: unauthorized/
  );
});

test('Higgsfield result URL extraction supports nested payloads', () => {
  assert.equal(
    extractResultUrl({ result: { video_url: 'https://cdn.example.com/nested.mp4' } }),
    'https://cdn.example.com/nested.mp4'
  );
});

