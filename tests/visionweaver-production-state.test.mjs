import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneState,compileScene,voiceProfile,orderedUnique} from '../supabase/functions/visionweaver-studio/production-state.js';

test('audio-only background event remains invisible and does not masquerade as synthesized sound',()=>{
  const s=sceneState({events:[{type:'baby',visible:false,audible:true,notes:'Off screen'}]});
  assert.equal(s.events.find(e=>e.type==='baby').audible,true);
  assert.match(compileScene(s),/baby: not visible/);
  assert.doesNotMatch(compileScene(s),/baby: visible/);
});
test('scene snapshot survives serialization without losing camera or event direction',()=>{
  const state=sceneState({camera:'Tilt up after release',end_state:'Balloon ascends',events:[{type:'birds',visible:true,notes:'Pigeons on pavement'}]});
  const restored=sceneState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored,state);
  assert.match(compileScene(restored),/Tilt up after release/);
  assert.match(compileScene(restored),/Pigeons on pavement/);
});
test('voice input cannot inject unrecognized fields or unbounded storage',()=>{
  assert.equal(voiceProfile({accent:'Chicago',admin:true}).admin,undefined);
  assert.equal(voiceProfile({pronunciation:'x'.repeat(2000)}).pronunciation.length,500);
  assert.equal(voiceProfile(null).accent,'');
});
test('reference order and deduplication preserve the intended first frame',()=>{
  assert.deepEqual(orderedUnique(['ending','board','ending','detail'],3),['ending','board','detail']);
});
