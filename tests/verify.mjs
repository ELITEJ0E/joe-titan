import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const html=read('../index.html');
const main=read('../src/main.js');
const world=read('../src/world.js');
const player=read('../src/player.js');
const ids=[...main.matchAll(/\$\('([a-zA-Z][\w-]*)'\)/g)].map(m=>m[1]);
const missing=[...new Set(ids)].filter(id=>!html.includes(`id="${id}"`));
if(missing.length)throw Error('Missing UI elements: '+missing.join(', '));
for(const file of ['../src/main.js','../src/world.js','../src/player.js','../src/collision.js','../src/navigation.js','../src/batching.js','../src/aspects.js','../src/enemies.js','../tests/browser.js']){
  execFileSync(process.execPath,['--check',fileURLToPath(new URL(file,import.meta.url))]);
}
for(const token of ['grappleRay','bestAnchor','resolveCollision','setBeaconActive']){
  if(!world.includes(token))throw Error(`Missing world API ${token}`);
}
for(const token of ['function fire','function release','function updateCamera','hook.length','state.boost']){
  if(!player.includes(token))throw Error(`Missing movement feature ${token}`);
}
if(!html.includes('type="importmap"'))throw Error('Standalone CDN import map is missing');
console.log(`OK: 9 JavaScript modules parse, ${[...new Set(ids)].length} HUD/overlay IDs resolve, core world and combat APIs exist.`);
console.log('Browser/GPU validation: open /tests/browser.html using the development server.');
