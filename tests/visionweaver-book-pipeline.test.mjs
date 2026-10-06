import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dir = 'supabase/functions/visionweaver-book-director/';
const handler = readFileSync(dir + 'index.ts', 'utf8');
const pipeline = readFileSync(dir + 'pipeline.ts', 'utf8');
const radar = readFileSync(dir + 'radar.ts', 'utf8');
const screen = readFileSync('src/components/BookPipelineWorkspace.tsx', 'utf8');
const migration = readFileSync('supabase/migrations/20261006020000_visionweaver_book_pipeline.sql', 'utf8');

test('Book Director handles every action the Book Pipeline screen calls', () => {
  const called = new Set([...screen.matchAll(/action: '([a-z_]+)'/g)].map((match) => match[1]));
  for (const action of ['overview', 'get', 'intake', 'approve', 'resume', 'radar_scan', 'opportunity', 'queue_decide']) {
    assert.ok(called.has(action), `screen never calls ${action}`);
  }
  for (const action of called) {
    assert.match(handler, new RegExp(`action === '${action}'`), `Book Director has no handler for ${action}`);
  }
});

test('Scheduler-only actions require the cron secret', () => {
  assert.match(handler, /\['tick', 'scheduled_scan', 'selftest'\]\.includes\(action\)/);
  assert.match(handler, /if \(!\(await isCron\(req\)\)\) return response\(req, \{ ok: false, error: 'Not authorized' \}, 401\)/);
});

test('All four approval gates exist and the default mode stops at each one', () => {
  assert.match(pipeline, /GATES = \['research', 'outline', 'chapters', 'assembly'\]/);
  assert.match(pipeline, /gated: \['research', 'outline', 'chapters', 'assembly'\]/);
  assert.match(pipeline, /approval_mode: GATES_BY_MODE\[raw\.approval_mode\] \? raw\.approval_mode : 'gated'/);
});

test('Assembly is refused while the Consistency Critic has blocking issues', () => {
  assert.match(pipeline, /blocking_count \|\| 0\) > 0\) throw new Error\('The Consistency Critic has unresolved blocking issues; assembly is not allowed'\)/);
  assert.match(pipeline, /status: 'paused', paused_stage: 'critic'/);
});

test('A failed step is retried, then paused and logged', () => {
  assert.match(pipeline, /const limit = transient \? 4 : 2;/);
  assert.match(pipeline, /status: 'paused', paused_stage: stage, error: message/);
});

test('Research and trend data report honestly when they are not verified', () => {
  assert.match(pipeline, /is NOT verified/);
  assert.match(radar, /Never fill in titles from memory/);
  assert.match(radar, /status: items\.length \? 'ok' : 'no_data'/);
});

test('Every book pipeline table has row level security switched on', () => {
  const tables = [...migration.matchAll(/create table if not exists public\.(vw_book[a-z_]*)/g)].map((match) => match[1]);
  assert.equal(tables.length, 10);
  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`), `${table} has no RLS`);
  }
  assert.match(migration, /revoke all on function public\.vw_book_claim_work\(text\) from public, anon, authenticated;/);
});
