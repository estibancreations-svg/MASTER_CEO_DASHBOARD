import { execFileSync } from 'node:child_process';

const requestId = process.env.REPAIR_REQUEST_ID ?? '';
const approvalReference = process.env.APPROVAL_REFERENCE ?? '';
const acknowledgement = process.env.RISK_ACKNOWLEDGEMENT ?? '';
const allowed = (process.env.REPAIR_ALLOWED_PATHS ?? 'src/,tests/,docs/')
  .split(',').map((value) => value.trim()).filter(Boolean);
const forbidden = ['.github/workflows/', 'supabase/', '.env', '.git/', 'node_modules/'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!uuid.test(requestId) || !uuid.test(approvalReference)) {
  throw new Error('A valid repair request id and approval reference are required.');
}
if (acknowledgement !== 'CEO_APPROVED') {
  throw new Error('The exact CEO_APPROVED acknowledgement is required.');
}
if (!allowed.length || allowed.some((prefix) => prefix.startsWith('.') || prefix.includes('..'))) {
  throw new Error('Allowed paths must be explicit repository-relative prefixes.');
}

const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' })
  .split('\n').map((value) => value.trim()).filter(Boolean);
if (!changed.length) throw new Error('Codex produced no repair changes.');

for (const path of changed) {
  if (forbidden.some((prefix) => path === prefix || path.startsWith(prefix))) {
    throw new Error(`Repair touched forbidden path: ${path}`);
  }
  if (!allowed.some((prefix) => path === prefix || path.startsWith(prefix))) {
    throw new Error(`Repair exceeded approved paths: ${path}`);
  }
}

console.log(JSON.stringify({ requestId, approvalReference, changed, allowed }));

