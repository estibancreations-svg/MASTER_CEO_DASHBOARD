import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('supabase/functions/visionweaver-studio/index.ts','utf8');
const continuity = readFileSync('api/visionweaver-continuity.js','utf8');
const workspace = readFileSync('src/visionweaver/ProductionStudio.tsx','utf8');
const avatarMigration = readFileSync('supabase/migrations/20261008170000_visionweaver_avatar_state_runtime_phase2.sql','utf8');
const gateMigration = readFileSync('supabase/migrations/20261008171500_visionweaver_continuity_dissection_gate.sql','utf8');

test('Avatar State runtime schema keeps exact versioned identity components',()=>{
  for(const table of [
    'vw_character_detail_versions','vw_appearance_states','vw_voice_versions',
    'vw_performance_versions','vw_coverage_sets','vw_avatar_runtime_bindings',
    'vw_cast_versions','vw_avatar_scene_states','vw_continuity_capsules'
  ]) assert.match(avatarMigration,new RegExp('create table if not exists public\\.'+table));
  assert.match(avatarMigration,/64_SLOT_FULL_HEIGHT/);
  assert.match(avatarMigration,/NO_DIALOGUE/);
  assert.match(avatarMigration,/ready_for_world_dissection/);
});

test('continuity gate blocks next shot until dissection QC and locked capsule',()=>{
  assert.match(gateMigration,/shot02_allowed/);
  assert.match(gateMigration,/dissection_state='PASSED'/);
  assert.match(gateMigration,/qc_state='PASS'/);
  assert.match(gateMigration,/approval_state='LOCKED'/);
  assert.match(gateMigration,/expected state is not accepted as observed end-state/i);
});

test('private continuity media remains owner scoped and short lived',()=>{
  assert.match(studio,/async function continuityMedia/);
  assert.match(studio,/\.eq\('owner_id', user\.id\)/);
  assert.match(studio,/createSignedUrl\(storagePath, 900\)/);
  assert.match(studio,/body\.action === 'continuity_media'/);
});

test('terminal frame extraction advances dissection but does not approve it',()=>{
  assert.match(continuity,/media_access_state:'MEDIA_LOADED'/);
  assert.match(continuity,/dissection_state:'IN_PROGRESS'/);
  assert.doesNotMatch(continuity,/qc_state:'PASS'/);
  assert.match(continuity,/provider_spend:false/);
});

test('workspace exposes continuity status and refuses premature continuation',()=>{
  assert.match(workspace,/Continuity & Automation/);
  assert.match(workspace,/SHOT 02 BLOCKED/);
  assert.match(workspace,/SHOT 02 READY/);
  assert.match(workspace,/dissection_state !== 'PASSED'/);
  assert.match(workspace,/qc_state !== 'PASS'/);
  assert.match(workspace,/approval_state === 'LOCKED'/);
  assert.match(workspace,/Shot 02 is blocked until the prior shot is dissected/);
});
