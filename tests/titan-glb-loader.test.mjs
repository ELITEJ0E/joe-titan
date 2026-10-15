import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {TITAN_GLB_PATHS} from '../src/titan-glb-models.js';
import {TITAN_ORDER} from '../src/titan-forms.js';

test('all nine Titans have dedicated binary GLB skins', () => {
 assert.deepEqual(Object.keys(TITAN_GLB_PATHS).sort(),[...TITAN_ORDER].sort());
 for (const [form,url] of Object.entries(TITAN_GLB_PATHS)) {
   assert.match(url, /^\/models\/titans\/[a-z_]+\.glb$/);
   assert.ok(url.includes(form==='warhammer'?'war_hammer':form));
   const path='public'+url;
   assert.ok(statSync(path).size>10000,form+' GLB size');
   assert.equal(readFileSync(path).toString('ascii',0,4),'glTF',form+' GLB header');
 }
});
