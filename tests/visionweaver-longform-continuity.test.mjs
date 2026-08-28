import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('supabase/functions/visionweaver-studio/index.ts', 'utf8');
const orchestrator = readFileSync('supabase/functions/visionweaver-orchestrator/index.ts', 'utf8');
const workspace = readFileSync('src/components/VisionWeaverWorkspace.tsx', 'utf8');
const watcher = readFileSync('src/components/VisionWeaverAssemblyWatcher.tsx', 'utf8');
const assembler = readFileSync('api/visionweaver-assemble.js', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

test('VisionWeaver single-shot video supports current Runway Seedance 2.5 duration limits', () => {
  assert.match(studio, /RUNWAY_LONG_VIDEO_MODEL = 'seedance2_5'/);
  assert.match(studio, /Math\.max\(4, Math\.min\(30, Number\(parameters\.duration\) \|\| 5\)\)/);
  assert.match(studio, /runway_seedance2_5: \{ min: 4, max: 30 \}/);
});

test('VisionWeaver long-form scenes use strict sequential video extension', () => {
  assert.match(orchestrator, /RUNWAY_MODEL = 'seedance2_5'/);
  assert.match(orchestrator, /promptVideo: predecessor\.video_url/);
  assert.match(orchestrator, /mode: 'extend'/);
  assert.match(orchestrator, /continuity_mode: extend \? 'extend_previous_scene' : 'origin'/);
  assert.match(orchestrator, /acted\.push\('submit:' \+ scene\.scene_id \+ ':' \+ result\.operation\);\s*return;/s);
});

test('VisionWeaver defaults short projects to five seconds and expands explicit long-form runtimes safely', () => {
  assert.match(orchestrator, /setting\('visionweaver_segment_seconds', '5'\)/);
  assert.match(orchestrator, /source\.match\(\/\\b\(\\d\+\(\?:\\\.\\d\+\)\?\)\\s\*\(\?:minutes\?\|mins\?\|min\)\\b\/\)/);
  assert.match(orchestrator, /Math\.max\(requestedScenes, Math\.ceil\(runtime \/ 30\)\)/);
  assert.match(orchestrator, /sceneCount > 120/);
  assert.match(workspace, /\['600', '10 minutes'\]/);
  assert.match(workspace, /continuity_mode: longForm \? continuityMode : 'reference'/);
  assert.match(workspace, /provider_shot_max_seconds: longForm \? 30 : 10/);
});

test('VisionWeaver automatically assembles completed multi-shot video sequences', () => {
  assert.match(watcher, /provider', 'visionweaver'/);
  assert.match(watcher, /operation', 'multi_shot_video'/);
  assert.match(watcher, /fetch\('\/api\/visionweaver-assemble'/);
  assert.match(watcher, /deliverable_state === 'master_ready'/);
});

test('VisionWeaver master assembly is owner-authenticated, lossless and durable', () => {
  assert.match(assembler, /auth\.getUser\(token\)/);
  assert.match(assembler, /\.eq\('owner_id', user\.id\)/);
  assert.match(assembler, /'-c', 'copy'/);
  assert.match(assembler, /reencoded: false/);
  assert.match(assembler, /children\.length > 20/);
  assert.match(assembler, /upsert: false/);
  assert.match(assembler, /deliverable_state: 'master_ready'/);
  assert.equal(packageJson.dependencies['ffmpeg-static'], '5.3.0');
  assert.equal(packageJson.allowScripts['ffmpeg-static@5.3.0'], true);
});

test('VisionWeaver orchestrator does not falsely label its pre-master manifest as a stitched file', () => {
  assert.match(orchestrator, /assembly_state: 'clips_ready_master_not_yet_stitched'/);
  assert.match(orchestrator, /master_video_url: null/);
});
