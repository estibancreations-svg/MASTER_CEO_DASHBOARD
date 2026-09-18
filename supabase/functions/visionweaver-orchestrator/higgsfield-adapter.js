const DEFAULT_BASE = 'https://api.higgsfield.ai/v1';

function toBase64(value) {
  if (typeof btoa === 'function') return btoa(value);
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf8').toString('base64');
  throw new Error('Base64 encoding is unavailable in this runtime');
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function normalizeStatus(status) {
  const value = String(status || '').trim().toUpperCase();
  if (!value) return 'UNKNOWN';
  if (['SUCCEEDED', 'SUCCESS', 'COMPLETED', 'DONE'].includes(value)) return 'SUCCEEDED';
  if (['FAILED', 'ERROR', 'CANCELLED', 'CANCELED'].includes(value)) return value === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
  if (['RUNNING', 'RENDERING', 'PROCESSING', 'IN_PROGRESS'].includes(value)) return 'RUNNING';
  if (['QUEUED', 'PENDING', 'WAITING', 'SUBMITTED'].includes(value)) return 'QUEUED';
  return value;
}

export function extractResultUrl(payload) {
  return pickString(
    payload?.result_url,
    payload?.asset_url,
    payload?.video_url,
    payload?.output_url,
    payload?.result?.url,
    payload?.result?.video_url,
    payload?.output?.url,
    Array.isArray(payload?.output_urls) ? payload.output_urls.find((item) => typeof item === 'string') : null,
    Array.isArray(payload?.assets) ? payload.assets.map((item) => item?.url).find((item) => typeof item === 'string') : null
  );
}

async function readJsonOrText(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    return { message: text.slice(0, 1000) };
  }
}

export function createHiggsfieldAdapter({
  apiKey,
  apiSecret,
  baseUrl = DEFAULT_BASE,
  fetchImpl = fetch
}) {
  if (!apiKey || !apiSecret) throw new Error('HIGGSFIELD_API_KEY and HIGGSFIELD_API_SECRET are required');
  const base = baseUrl.replace(/\/+$/, '');
  const auth = `Basic ${toBase64(`${apiKey}:${apiSecret}`)}`;
  const baseHeaders = {
    authorization: auth,
    'x-api-key': apiKey,
    'x-api-secret': apiSecret
  };

  async function request(path, init = {}) {
    const response = await fetchImpl(base + path, {
      ...init,
      headers: {
        ...baseHeaders,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
    const body = await readJsonOrText(response);
    if (!response.ok) {
      throw new Error(`Higgsfield ${response.status}: ${String(body?.error || body?.message || JSON.stringify(body)).slice(0, 400)}`);
    }
    return body;
  }

  return {
    async submitRenderJob(payload) {
      const body = await request('/render-jobs', { method: 'POST', body: JSON.stringify(payload) });
      const id = pickString(body?.id, body?.job_id, body?.task_id, body?.data?.id);
      if (!id) throw new Error('Higgsfield returned no job id');
      return { id, raw: body };
    },
    async pollRenderJob(jobId) {
      const body = await request('/render-jobs/' + encodeURIComponent(jobId));
      const status = normalizeStatus(pickString(body?.status, body?.state, body?.job_status, body?.data?.status));
      return {
        status,
        resultUrl: status === 'SUCCEEDED' ? extractResultUrl(body) : null,
        raw: body
      };
    }
  };
}

