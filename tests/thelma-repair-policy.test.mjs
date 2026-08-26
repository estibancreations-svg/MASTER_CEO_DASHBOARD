import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/thelma-codex-repair.yml', 'utf8');
const validator = readFileSync('scripts/validate-thelma-repair.mjs', 'utf8');

test('THELMA repair workflow is manual, bounded, and PR-only', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /safety-strategy: drop-sudo/);
  assert.match(workflow, /sandbox: workspace-write/);
  assert.match(workflow, /npm run quality/);
  assert.match(workflow, /gh pr create/);
  assert.doesNotMatch(workflow, /git push[^\n]*main/);
  assert.doesNotMatch(workflow, /gh pr merge/);
});

test('repair validator blocks governance, secrets, database, and path escape', () => {
  for (const boundary of ["'.github/workflows/'", "'supabase/'", "'.env'", "'..'"]) {
    assert.match(validator, new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(validator, /CEO_APPROVED/);
  assert.match(validator, /approvalReference/);
});

