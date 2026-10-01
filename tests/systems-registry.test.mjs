import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const registry = readFileSync('src/boards/systemsRegistry.tsx', 'utf8');
const shell = readFileSync('src/components/MasterDashboard.tsx', 'utf8');
const rows = [...registry.matchAll(/\{ n: (\d+), id: '(SYS-[A-Z0-9-]+)', name: '([^']+)'[^}]*?state: '([A-Z_]+)'[^}]*?\}/g)];

test('Systems registry lists exactly the 17 governed systems with unique ids', () => {
  assert.equal(rows.length, 17);
  assert.equal(new Set(rows.map((r) => r[2])).size, 17);
  assert.deepEqual(rows.map((r) => Number(r[1])), Array.from({ length: 17 }, (_, i) => i + 1));
});

test('Registry states match the canon tally and never claim VERIFIED', () => {
  const tally = {};
  for (const r of rows) tally[r[4]] = (tally[r[4]] || 0) + 1;
  assert.deepEqual(tally, { PARTIAL: 10, RECOVERY_REQUIRED: 3, SPECIFICATION_ONLY: 1, NOT_IMPLEMENTED: 3 });
  assert.doesNotMatch(registry, /state: 'VERIFIED'|state: 'HEALTHY'|state: 'LIVE'/);
});

test('Every openable system is routed by the dashboard shell', () => {
  const keys = [...registry.matchAll(/open: '([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(keys.length >= 9);
  for (const key of keys) assert.match(shell, new RegExp(`\\b${key}:`), `shell has no route for ${key}`);
  assert.match(shell, /SystemsRegistryPage/);
});
