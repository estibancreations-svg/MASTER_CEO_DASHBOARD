import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(p,'utf8');
const registry=read('src/visionweaver/registry.ts');
const runtime=read('src/visionweaver/VisionWeaverRuntime.tsx');
const pages=read('src/visionweaver/pages/index.tsx');
const production=read('src/visionweaver/ProductionStudio.tsx');
const thelma=read('src/visionweaver/ThelmaDiagnostic.tsx');
const css=read('src/visionweaver/visionweaver.css');
const backend=read('supabase/functions/visionweaver-studio/index.ts');
const routing=read('src/routing.ts');
test('every canonical registry page has a real component or authenticated production view',()=>{
 const keys=[...registry.matchAll(/\{key:'([^']+)',label:/g)].map(x=>x[1]);
 assert.ok(keys.length>=24);
 for(const key of keys)assert.ok(key==='production-studio'||pages.includes("'"+key+"':"),'Unmapped page: '+key);
 assert.match(runtime,/page==='production-studio'\?<ProductionStudio/);
});
test('VisionWeaver navigation is URL addressable, not cosmetic',()=>{
 assert.match(routing,/if\(surface==='vision'\)return\{surface,page:parts\[2\]/);
 assert.match(runtime,/onNavigatePage\?\.\(next\)/);
 assert.match(runtime,/window\.location\.assign\('\/systems\/thelma'\)/);
});
test('authenticated production actions match real backend handlers',()=>{
 for(const action of ['create','retry','import_book','save_character','register_asset','refresh']){
  assert.match(production,new RegExp("action:\\s*'"+action+"'"),'UI missing '+action);
  assert.match(backend,new RegExp("body\\.action === '"+action+"'"),'backend missing '+action);
 }
 assert.match(production,/supabase\.functions\.invoke\('visionweaver-studio'/);
 assert.match(production,/ackSpend/);
});
test('THELMA is invoked as an authenticated agent, not a placeholder',()=>{
 assert.match(thelma,/identity\.user/);
 assert.match(thelma,/functions\.invoke\('thelma-ai'/);
 assert.match(thelma,/action:'refresh_white_cells'/);
 assert.match(thelma,/action:'chat'/);
 assert.match(thelma,/assistant\?\.content/);
 assert.doesNotMatch(thelma,/setResult\('All systems operational/);
});
test('mobile retains a vertical sidebar and production controls',()=>{
 assert.match(css,/\.vw-sidebar\{position:sticky/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css,/\.vw-production-form/);
 assert.doesNotMatch(css,/\.vw-sidebar\{display:none/);
});
test('unimplemented visual tabs are not advertised as live buttons',()=>{
 for(const file of ['src/visionweaver/pages/core.tsx','src/visionweaver/pages/create.tsx','src/visionweaver/pages/govern.tsx']){
  const source=read(file);
  const buttons=[...source.matchAll(/<button\b[^>]*>/g)].map(x=>x[0]);
  assert.equal(buttons.filter(x=>!x.includes('onClick')).length,0,file+' has inert buttons');
 }
});
