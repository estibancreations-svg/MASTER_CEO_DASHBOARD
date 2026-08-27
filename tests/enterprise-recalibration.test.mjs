import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');
const governanceMigration = 'supabase/migrations/20260827220000_base_ten_and_social_commerce_runtime.sql';

test('Base Ten runtime contract preserves Architect authority and open challenge', () => {
  const sql = read(governanceMigration);
  assert.ok(sql.includes("authority_owner text not null default 'THE_ARCHITECT'"));
  assert.ok(sql.includes('reserved_authority smallint not null default 60'));
  assert.ok(sql.includes('recommendations_allowed boolean not null default true'));
  assert.ok(sql.includes('challenge_allowed boolean not null default true'));
  assert.ok(sql.includes('silent_override_allowed boolean not null default false'));
  assert.ok(sql.includes("emergency_bypass_owner text not null default 'THE_ARCHITECT'"));
  assert.ok(sql.includes("r.architect_final_required and member_role <> 'architect'"));
  assert.ok(sql.includes("member_role='delegated_approver' and r.risk_tier in ('high','critical')"));
});

test('Social-Commerce weekly, monthly, attribution and forecast ledgers exist', () => {
  const sql = read(governanceMigration);
  for (const table of ['social_metric_snapshots','social_attribution_events','social_weekly_reports','social_monthly_reports','social_forecasts']) {
    assert.ok(sql.includes(`create table if not exists public.${table}`), `Missing ${table}`);
  }
  assert.ok(sql.includes("social-commerce-weekly-intelligence-refresh"));
  assert.ok(sql.includes("'10 13 * * 1,4'"), 'Weekly intelligence must refresh Monday and Thursday');
  assert.ok(sql.includes("social-commerce-monthly-close"));
  assert.ok(sql.includes("attribution_method in ('direct','last_touch','first_touch','assisted','multi_touch','modeled','correlated','unknown')"));
});

test('All Systems exposes the approved 17-system enterprise registry without fake routes', () => {
  const nav = read('src/components/GlobalNavigation.tsx');
  const expected = [
    'SYS-DASH-001','SYS-CEO-001','SYS-THELMA-001','SYS-FABRIC-001','SYS-VISION-001','SYS-LAND-001','SYS-GRANT-001',
    'SYS-CMGIO-001','SYS-ADS-001','SYS-AGENCYFLOW-001','SYS-CLIMATE-001','SYS-PUBLISH-001','SYS-IAM-001','SYS-TELECOM-001',
    'SYS-ASSESS-001','SYS-TRAINING-001','SYS-QC-001'
  ];
  for (const systemKey of expected) assert.ok(nav.includes(systemKey), `Missing ${systemKey}`);
  const declarations = [...nav.matchAll(/systemKey:\s*'SYS-[A-Z-]+-001'/g)];
  assert.equal(declarations.length, 17, `Expected 17 registry declarations, found ${declarations.length}`);
  assert.ok(nav.includes("state: 'NOT_IMPLEMENTED'"));
  assert.ok(nav.includes('disabled={!launchable}'), 'Non-executable systems must not pretend to launch');
});

test('Ecosystem v3.1 retains the three Monday/Thursday enterprise partitions', () => {
  const sql = read('supabase/migrations/20260827051656_ecosystem_v31_partitioned_schedule_and_provider_truth.sql');
  for (const schedule of ['0 13 * * 1,4','2 13 * * 1,4','4 13 * * 1,4']) assert.ok(sql.includes(schedule), `Missing schedule ${schedule}`);
  assert.ok(sql.includes("'partition_count',3"));
});

test('final verifier artifacts must be present before release certification', () => {
  assert.ok(existsSync(join(root, 'docs/verification/GITHUB_ENTERPRISE_RECALIBRATION_REPORT_2026-08-27.md')), 'Missing Markdown verifier handoff');
  assert.ok(existsSync(join(root, 'docs/verification/GITHUB_ENTERPRISE_RECALIBRATION_MANIFEST_2026-08-27.json')), 'Missing JSON verifier manifest');
});
