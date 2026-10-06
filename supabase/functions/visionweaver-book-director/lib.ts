// VisionWeaver Book Pipeline: shared server helpers (database, secrets, model calls).
import { createClient } from 'npm:@supabase/supabase-js@2';

function namedSupabaseKey(jsonEnv: string, legacyEnv: string) {
  try {
    const named = JSON.parse(Deno.env.get(jsonEnv) || '{}');
    if (named.default) return named.default;
  } catch (_) { /* fall through */ }
  return Deno.env.get(legacyEnv);
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = namedSupabaseKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase server credentials unavailable');
export const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
export const BUCKET = 'visionweaver-outputs';

export type Row = Record<string, any>;
export type Usage = { input_tokens: number; output_tokens: number; searches: number; calls: number };
export type Source = { title: string; url: string };
export type LlmResult = {
  text: string;
  sources: Source[];
  grounded: boolean;
  searchRequested: boolean;
  searchUnavailable: string;
  usage: Usage;
  model: string;
};

export async function secret(name: string) {
  const environmentValue = (Deno.env.get(name) || '').trim();
  if (environmentValue && environmentValue !== 'PLACEHOLDER_REPLACE_ME') return environmentValue;
  const { data, error } = await db.rpc('get_secret', { secret_name: name });
  if (error || !data || data === 'PLACEHOLDER_REPLACE_ME') return null;
  const value = String(data).trim();
  return value && value !== 'PLACEHOLDER_REPLACE_ME' ? value : null;
}

export async function setting(key: string, fallback: string) {
  const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle();
  return typeof data?.value === 'string' && data.value ? data.value : fallback;
}

export async function logEvent(target: { book_id?: string | null; scan_id?: string | null }, stage: string, level: 'info' | 'warn' | 'error', message: string, detail: Row = {}) {
  try {
    await db.from('vw_book_events').insert({
      book_id: target.book_id || null,
      scan_id: target.scan_id || null,
      stage,
      level,
      message: String(message).slice(0, 900),
      detail
    });
  } catch (_) { /* logging must never break the pipeline */ }
}

export function emptyUsage(): Usage {
  return { input_tokens: 0, output_tokens: 0, searches: 0, calls: 0 };
}

export function addUsage(total: Row | null | undefined, extra: Usage): Usage {
  const base = { ...emptyUsage(), ...(total || {}) } as Usage;
  return {
    input_tokens: Number(base.input_tokens || 0) + extra.input_tokens,
    output_tokens: Number(base.output_tokens || 0) + extra.output_tokens,
    searches: Number(base.searches || 0) + extra.searches,
    calls: Number(base.calls || 0) + extra.calls
  };
}

export function parseJson(raw: string, kind: 'object' | 'array' = 'object'): any {
  let value = String(raw || '').trim();
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) value = fenced[1].trim();
  const pairs: Array<[string, string]> = kind === 'array' ? [['[', ']'], ['{', '}']] : [['{', '}'], ['[', ']']];
  let problem = 'The model did not return JSON';
  for (const [open, close] of pairs) {
    const first = value.indexOf(open);
    const last = value.lastIndexOf(close);
    if (first < 0 || last <= first) continue;
    try {
      return JSON.parse(value.slice(first, last + 1));
    } catch (error) {
      problem = 'The model returned JSON that could not be read: ' + String((error as Error).message).slice(0, 120);
    }
  }
  throw new Error(problem);
}

const workingModel: Record<string, string> = {};

async function modelCandidates(fast: boolean) {
  const main = await setting('book_pipeline_model', 'claude-sonnet-5-5');
  const list = fast
    ? [await setting('book_pipeline_fast_model', 'claude-haiku-4-5-20251001'), main, 'claude-sonnet-4-6']
    : [main, 'claude-sonnet-4-6'];
  const cached = workingModel[fast ? 'fast' : 'main'];
  const ordered = cached ? [cached, ...list] : list;
  return ordered.filter((model, index) => model && ordered.indexOf(model) === index);
}

export type LlmOptions = {
  system: string;
  user: string;
  maxTokens?: number;
  fast?: boolean;
  search?: { maxUses: number; allowedDomains?: string[] } | null;
};

export async function claude(options: LlmOptions): Promise<LlmResult> {
  const key = await secret('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Anthropic is not configured');
  const usage = emptyUsage();
  const sources: Source[] = [];
  const seen = new Set<string>();
  let searchUnavailable = '';
  let useSearch = Boolean(options.search);
  const candidates = await modelCandidates(Boolean(options.fast));
  let modelIndex = 0;
  const messages: any[] = [{ role: 'user', content: options.user }];
  let text = '';

  for (let turn = 0; turn < 6; turn += 1) {
    const model = candidates[modelIndex];
    const body: Row = { model, max_tokens: options.maxTokens || 4000, system: options.system, messages };
    if (useSearch && options.search) {
      const tool: Row = { type: 'web_search_20250305', name: 'web_search', max_uses: options.search.maxUses };
      if (options.search.allowedDomains?.length) tool.allowed_domains = options.search.allowedDomains;
      body.tools = [tool];
    }
    const result = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(110000)
    });
    const raw = await result.text();
    if (!result.ok) {
      const lowered = raw.toLowerCase();
      if (result.status === 404 && modelIndex < candidates.length - 1) { modelIndex += 1; turn -= 1; continue; }
      if (result.status === 400 && lowered.includes('model') && lowered.includes('not') && modelIndex < candidates.length - 1 && !lowered.includes('web_search')) { modelIndex += 1; turn -= 1; continue; }
      if (result.status === 400 && useSearch) {
        // Web search is switched on per organization in the Anthropic Console.
        searchUnavailable = raw.slice(0, 240);
        useSearch = false;
        messages.length = 1;
        turn -= 1;
        continue;
      }
      throw new Error('Anthropic ' + result.status + ': ' + raw.slice(0, 300));
    }
    const json = JSON.parse(raw);
    workingModel[options.fast ? 'fast' : 'main'] = model;
    usage.calls += 1;
    usage.input_tokens += Number(json.usage?.input_tokens || 0);
    usage.output_tokens += Number(json.usage?.output_tokens || 0);
    usage.searches += Number(json.usage?.server_tool_use?.web_search_requests || 0);
    for (const part of json.content || []) {
      if (part.type === 'text') {
        text += part.text;
        for (const citation of part.citations || []) {
          if (citation.url && !seen.has(citation.url)) { seen.add(citation.url); sources.push({ title: String(citation.title || citation.url).slice(0, 200), url: citation.url }); }
        }
      }
      if (part.type === 'web_search_tool_result' && Array.isArray(part.content)) {
        for (const item of part.content) {
          if (item?.type === 'web_search_result' && item.url && !seen.has(item.url)) {
            seen.add(item.url);
            sources.push({ title: String(item.title || item.url).slice(0, 200), url: item.url });
          }
        }
      }
    }
    if (json.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: json.content }); continue; }
    if (json.stop_reason === 'max_tokens') throw new Error('The model ran out of room before finishing its answer');
    return {
      text,
      sources: sources.slice(0, 40),
      grounded: Boolean(options.search) && useSearch && sources.length > 0,
      searchRequested: Boolean(options.search),
      searchUnavailable,
      usage,
      model
    };
  }
  throw new Error('The model did not finish after several turns');
}

export async function fetchJson(url: string, timeoutMs = 20000) {
  const result = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'VisionWeaverBookPipeline/1.0' }, signal: AbortSignal.timeout(timeoutMs) });
  const text = await result.text();
  if (!result.ok) throw new Error('HTTP ' + result.status + ' from ' + new URL(url).host);
  return JSON.parse(text);
}

export async function fetchText(url: string, timeoutMs = 20000) {
  const result = await fetch(url, { headers: { 'user-agent': 'VisionWeaverBookPipeline/1.0' }, signal: AbortSignal.timeout(timeoutMs) });
  const text = await result.text();
  if (!result.ok) throw new Error('HTTP ' + result.status + ' from ' + new URL(url).host);
  return text;
}

export function clip(value: unknown, length: number) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, length);
}
