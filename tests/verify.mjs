import {readFileSync,existsSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const html=read('../index.html');
const main=read('../src/main.js');
const world=read('../src/voxel-city.js');
const player=read('../src/player.js');
const motor=read('../src/odm-motor.js');
if(!motor.includes('hook.length'))throw Error('ODM motor must handle cable length');
const ids=[...main.matchAll(/\$\('([a-zA-Z][\w-]*)'\)/g)].map(m=>m[1]);
const missing=[...new Set(ids)].filter(id=>!html.includes(`id="${id}"`));
if(missing.length)throw Error('Missing UI elements: '+missing.join(', '));
for(const file of ['../src/main.js','../src/voxel-city.js','../src/odm-physics.js','../src/player.js','../src/collision.js','../src/navigation.js','../src/batching.js','../src/aspects.js','../src/enemies.js','../src/titan-voxel-rig.js','../src/scout-combat-state.js','../src/odm-cable-visuals.js','../src/odm-impacts.js','../src/grab-escape.js','../src/scout-blade-arc.js','../src/titan-navigation.js','../src/scout-cut-effects.js','../src/menu-presentation.js','../src/odm-arm-aim.js','../src/titan-gait.js','../src/free-orbit-camera.js','../src/odm-first-person-camera.js','../src/mouse-capture.js','../src/scout-appearance.js','../src/multiplayer.js','../src/cinematic-atmosphere.js','../src/voxel-surface-detail.js','../src/mobile-flight-controls.js','../src/scout-sword-visuals.js','../src/graphics-quality.js','../src/shiganshina-visuals.js','../src/minecraft-world.js','../tests/browser.js']){
  execFileSync(process.execPath,['--check',fileURLToPath(new URL(file,import.meta.url))]);
}
for(const token of ['grappleRay','bestAnchor','resolveCollision','setBeaconActive']){
  if(!world.includes(token))throw Error(`Missing world API ${token}`);
}
for(const token of ['function fire','function release','function updateCamera','applyODMMotor','state.boost']){
  if(!player.includes(token))throw Error(`Missing movement feature ${token}`);
}
if(!main.includes('hookRetryClock-=PHYSICS_STEP'))throw Error('Held ODM grapple does not reacquire missed targets');
if(!main.includes('releaseUnheld'))throw Error('Independent keyboard/mouse grapple release unavailable');
if(!main.includes('physicsTick%5===0'))throw Error('Network tick-rate separation missing');
if(!main.includes('world=createVoxelWorld(scene)'))throw Error('Voxel city is not the active world');
if(main.includes('installMedievalCity('))throw Error('Heavy GLB loader is still active');
if(!world.includes('InstancedMesh'))throw Error('Voxel city must batch repeated blocks');
// Optional authentic Minecraft region conversion can be uploaded after creator permission.
const minecraftPath=new URL('../public/maps/shiganshina.jtvx',import.meta.url);
if(existsSync(minecraftPath)){
  const payload=inflateSync(readFileSync(minecraftPath));
  if(payload.toString('ascii',0,4)!=='JTVX'||payload.readUInt16LE(4)!==1)throw Error('Minecraft map asset header invalid');
  const nx=payload.readUInt16LE(6),ny=payload.readUInt16LE(8),nz=payload.readUInt16LE(10);
  const faces=payload.readUInt32LE(12),paletteLen=payload.readUInt32LE(20);
  const expected=24+paletteLen+nx*ny*nz+faces*9;
  if(nx!==304||ny!==88||nz!==304||expected!==payload.length||faces<200000)throw Error('Minecraft world asset is truncated or wrong');
  console.log('OK: authentic Minecraft Shiganshina map asset ('+faces+' quads) validated.');
}
if(!html.includes('type="importmap"'))throw Error('Standalone CDN import map is missing');
console.log(`OK: gameplay JavaScript modules parse, ${[...new Set(ids)].length} HUD/overlay IDs resolve, core world and combat APIs exist.`);
console.log('Browser/GPU validation: open /tests/browser.html using the development server.');
