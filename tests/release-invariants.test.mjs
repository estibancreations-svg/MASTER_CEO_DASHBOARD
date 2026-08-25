import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('all six primary system routes remain registered', async () => {
  const routing = await read('src/routing.ts');
  for (const route of [
    '/systems/landweaver',
    '/systems/visionweaver',
    '/systems/grantos',
    '/systems/thelma',
    '/systems/cmgio-map',
    '/systems/integration-fabric'
  ]) {
    assert.match(routing, new RegExp(route.replaceAll('/', '\\/')));
  }
});

test('master dashboard retains the canonical operational module names', async () => {
  const routing = await read('src/routing.ts');
  for (const moduleName of [
    'AI Mastery',
    'Agent Hub',
    'Leads Pipeline',
    'Content Engine',
    'Social Media',
    'Communications',
    'CRM',
    'Finance',
    'Products',
    'System Audit',
    'Certificates',
    'Settings'
  ]) {
    assert.match(routing, new RegExp(moduleName));
  }
});

test('known fake-success wording is not reintroduced', async () => {
  const files = [
    'src/components/MasterDashboard.tsx',
    'src/components/CsuiteDashboard.tsx',
    'src/components/ThelmaWorkspace.tsx',
    'src/components/IntegrationFabricWorkspace.tsx'
  ];
  for (const file of files) {
    let body = '';
    try { body = await read(file); } catch { continue; }
    assert.doesNotMatch(body.toLowerCase(), /action acknowledged/);
  }
});

test('QC gate explicitly forbids deployment-only certification', async () => {
  const qc = await read('docs/QC-GATE.md');
  assert.match(qc, /not production-certified/i);
  assert.match(qc, /deployment.*not.*certif|deployed interface is not a production-certified/i);
});
