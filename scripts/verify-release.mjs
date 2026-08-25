import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'docs/QC-GATE.md',
  'docs/operations/RELEASE-PROMOTION-POLICY.md',
  'src/routing.ts',
  'supabase/migrations'
];

for (const path of requiredFiles) {
  await access(path);
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
for (const script of ['lint', 'test', 'build', 'verify:release', 'quality']) {
  if (!pkg.scripts?.[script]) throw new Error(`Missing required package script: ${script}`);
}

const qc = await readFile('docs/QC-GATE.md', 'utf8');
if (!/release-bound evidence/i.test(qc)) {
  throw new Error('QC-GATE.md is not release-bound');
}
if (!/not production-certified/i.test(qc)) {
  throw new Error('QC-GATE.md must preserve explicit production-certification state');
}

console.log('Release evidence guard passed.');
