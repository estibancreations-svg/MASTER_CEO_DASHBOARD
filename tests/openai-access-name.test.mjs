import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const retired = ['OPENAI_API', 'KEY'].join('_');
const canonical = 'OPENAI_API_ACCESS';
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

test('active source and operating docs use OPENAI_API_ACCESS', () => {
  const offenders = [];
  for (const base of scanRoots) {
    const fullBase = join(root, base);
    for (const file of filesUnder(fullBase)) {
      const text = readFileSync(file, 'utf8');
      if (text.includes(retired)) offenders.push(relative(root, file));
    }
  }
  assert.deepEqual(offenders, [], `Retired OpenAI credential name found in active files: ${offenders.join(', ')}`);
});

test('THELMA and Codex workflow reference the canonical access name', () => {
  const thelma = readFileSync(join(root, 'supabase/functions/thelma-ai/index.ts'), 'utf8');
  const workflow = readFileSync(join(root, '.github/workflows/thelma-codex-repair.yml'), 'utf8');
  assert.ok(thelma.includes(canonical), 'THELMA runtime must read OPENAI_API_ACCESS');
  assert.ok(workflow.includes(`secrets.${canonical}`), 'Codex workflow must read OPENAI_API_ACCESS');
});
