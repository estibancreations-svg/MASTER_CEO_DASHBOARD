import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const retired = ['GEMINI_API', 'KEY'].join('_');
const canonical = 'GEMINI_CONNECTION';
const scanRoots = ['.github', 'src', 'supabase/functions', 'docs', 'scripts', 'tests'];
const ignored = new Set(['node_modules', 'dist', '.git']);
const textExtensions = /\.(?:md|mjs|js|ts|tsx|json|ya?ml|sql|txt)$/i;

function filesUnder(path) {
  const out = [];
  for (const name of readdirSync(path)) {
    if (ignored.has(name)) continue;
    const full = join(path, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...filesUnder(full));
    else if (textExtensions.test(name)) out.push(full);
  }
  return out;
}

test('active source and operating docs use GEMINI_CONNECTION', () => {
  const offenders = [];
  for (const base of scanRoots) {
    const fullBase = join(root, base);
    for (const file of filesUnder(fullBase)) {
      const text = readFileSync(file, 'utf8');
      if (text.includes(retired)) offenders.push(relative(root, file));
    }
  }
  assert.deepEqual(offenders, [], `Retired Gemini credential name found in active files: ${offenders.join(', ')}`);
});

test('THELMA, Resource Intelligence and VisionWeaver use the canonical Gemini connection', () => {
  const thelma = readFileSync(join(root, 'supabase/functions/thelma-ai/index.ts'), 'utf8');
  const resource = readFileSync(join(root, 'supabase/functions/resource-intelligence/index.ts'), 'utf8');
  const vision = readFileSync(join(root, 'supabase/functions/visionweaver-orchestrator/index.ts'), 'utf8');
  assert.ok(thelma.includes(canonical), 'THELMA runtime must read GEMINI_CONNECTION');
  assert.ok(resource.includes(canonical), 'Resource Intelligence must read GEMINI_CONNECTION');
  assert.ok(vision.includes(canonical), 'VisionWeaver provider health must read GEMINI_CONNECTION');
});
