import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('supabase/functions/visionweaver-studio/index.ts', 'utf8');
const workspace = readFileSync('src/components/VisionWeaverWorkspace.tsx', 'utf8');
const boards = readFileSync('src/boards/index.tsx', 'utf8');

test('Studio function handles every action the VisionWeaver workspace calls', () => {
  const called = new Set([...workspace.matchAll(/action: '([a-z_]+)'/g)].map((m) => m[1]));
  for (const action of ['create', 'retry', 'import_book', 'save_character', 'register_asset']) {
    assert.ok(called.has(action), `workspace never calls ${action}`);
  }
  for (const action of called) {
    assert.match(studio, new RegExp(`body\\.action === '${action}'`), `studio has no handler for ${action}`);
  }
});

test('Studio keeps the Books, Cast and reference-photo backend in the repo', () => {
  assert.match(studio, /async function importBook\(/);
  assert.match(studio, /async function saveCharacter\(/);
  assert.match(studio, /async function registerAsset\(/);
  assert.match(studio, /async function resolveReferences\(/);
  assert.match(studio, /Path must be inside your own folder/);
  assert.match(studio, /from\('vw_projects'\)\.delete\(\)\.eq\('id', project\.id\)/);
  assert.match(studio, /from\('vw_scenes'\)/);
  assert.match(studio, /characters: characters \|\| \[\]/);
  assert.match(studio, /body\.action === 'chapter_text'/);
});

test('Studio keeps the Higgsfield provider path alongside Runway', () => {
  assert.match(studio, /createHiggsfieldAdapter/);
  assert.match(studio, /generation\.provider === 'higgsfield'/);
});

test('Board frame opens on the Live module by default', () => {
  assert.match(boards, /useState<'board'\|'live'>\('live'\)/);
});
