const DEFAULT_BASE = 'https://api.higgsfield.ai';
const DEFAULT_TEXT_MODEL = 'bytedance/seedance-2.5/text-to-video';
const DEFAULT_EXTEND_MODEL = 'bytedance/seedance-2.5/video-extend';

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
  if (['FAILED', 'ERROR', 'NSFW'].includes(value)) return 'FAILED';
  if (['CANCELLED', 'CANCELED'].includes(value)) return 'CANCELLED';
  if (['RUNNING', 'RENDERING', 'PROCESSING', 'IN_PROGRESS'].includes(value)) return 'RUNNING';
  if (['QUEUED', 'PENDING', 'WAITING', 'SUBMITTED'].includes(value)) return 'QUEUED';
  return value;
}

export function extractResultUrl(payload) {
  return pickString(
    payload?.video?.url,
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
  try { return JSON.parse(text); } catch (_) { return { message: text.slice(0, 1000) }; }
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE).replace(/\/+$/, '').replace(/\/v1$/, '');
}

function modelPath(model, extend) {
  const configured = String(model || '').replace(/^\/+/, '');
  if (configured.includes('/') && configured !== 'vision-weaver-v1') {
    if (extend && configured.endsWith('/text-to-video')) return configured.replace(/\/text-to-video$/, '/video-extend');
    return configured;
  }
  return extend ? DEFAULT_EXTEND_MODEL : DEFAULT_TEXT_MODEL;
}

function requestPayload(payload, extend, model) {
  if (/image|soul/i.test(model)) return { prompt: String(payload?.prompt || '').trim() };
  const shared = {
    prompt: String(payload?.prompt || '').trim(),
    duration: Number(payload?.duration ?? payload?.duration_seconds ?? 5),
    resolution: payload?.resolution || '720p',
    bitrate_mode: payload?.bitrate_mode || 'high',
    generate_audio: payload?.generate_audio ?? false
  };
  if (extend) return { ...shared, video_url: payload?.video_url || payload?.source_video_url };
  return { ...shared, aspect_ratio: payload?.aspect_ratio || '16:9', output_format: payload?.output_format || 'mp4' };
}

export function createHiggsfieldAdapter({ apiKey, apiSecret, baseUrl = DEFAULT_BASE, fetchImpl = fetch }) {
  if (!apiKey || !apiSecret) throw new Error('HIGGSFIELD_API_KEY and HIGGSFIELD_API_SECRET are required');
  const base = normalizeBaseUrl(baseUrl);
  const baseHeaders = { authorization: `Key ${apiKey}:${apiSecret}` };

  async function request(path, init = {}) {
    const response = await fetchImpl(base + path, {
      ...init,
      headers: { ...baseHeaders, ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) }
    });
    const body = await readJsonOrText(response);
    if (!response.ok) throw new Error(`Higgsfield ${response.status}: ${String(body?.error || body?.message || JSON.stringify(body)).slice(0, 400)}`);
    return body;
  }

  return {
    async submitRenderJob(payload) {
      const extend = payload?.mode === 'extend' || Boolean(payload?.source_video_url || payload?.video_url);
      const endpoint = '/' + modelPath(payload?.model, extend);
      const body = await request(endpoint, { method: 'POST', body: JSON.stringify(requestPayload(payload, extend, modelPath(payload?.model, extend))) });
      const id = pickString(body?.request_id, body?.id);
      if (!id) throw new Error('Higgsfield returned no request_id');
      return { id, statusUrl: pickString(body?.status_url), raw: body };
    },
    async pollRenderJob(requestId) {
      const body = await request('/requests/' + encodeURIComponent(requestId) + '/status');
      const status = normalizeStatus(body?.status);
      return { status, resultUrl: status === 'SUCCEEDED' ? extractResultUrl(body) : null, raw: body };
    }
  };
}
