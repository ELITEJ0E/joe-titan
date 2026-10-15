import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {floatingStickVector,lookDragDelta,ackermanPilotScale} from '../src/mobile-flight-controls.js';
import {ACKERMAN_MODE,ASPECTS} from '../src/aspects.js';
import {createPlayer} from '../src/player.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const world=()=>({spawnPoint:V(0,1,0),resolveCollision:()=>false,grappleRay:()=>null});

test('floating joystick re-centers to finger location and caps thumb displacement',()=>{
 const zero=floatingStickVector(290,150,290,150,43);
 assert.deepEqual(zero,{x:0,y:0,offsetX:0,offsetY:0});
 const a=floatingStickVector(290,150,322,126,43);
 assert.ok(Math.abs(a.x-32/43)<1e-12);
 assert.ok(Math.abs(a.y+24/43)<1e-12);
 const b=floatingStickVector(100,80,1000,80,43);
 assert.ok(b.x<=1&&b.x>.99);
 assert.ok(Math.abs(b.offsetX)<=43);
 assert.deepEqual(lookDragDelta(0,0),{yaw:0,pitch:0});
});

test('single selectable scout skill is Ackerman, with fast hooked and slow unhooked motion',()=>{
 assert.equal(ASPECTS.length,1);assert.equal(ACKERMAN_MODE.duration,12);
 assert.equal(ackermanPilotScale({active:false,hooked:false}),1);
 assert.equal(ackermanPilotScale({active:true,hooked:true}),1);
 assert.equal(ackermanPilotScale({active:true,hooked:false}),.34);
 const free=createPlayer(new THREE.Scene(),world(),new THREE.PerspectiveCamera());
 const hooked=createPlayer(new THREE.Scene(),world(),new THREE.PerspectiveCamera());
 for(const p of [free,hooked]){p.position.y=30;p.velocity.set(0,0,-30);p.setAspect(ACKERMAN_MODE);}
 hooked.hooks[0]={point:V(0,60,-60),length:95,age:0};
 const startFree=free.position.clone(),startHooked=hooked.position.clone();
 for(let i=0;i<10;i++){
   free.update(1/240,{keys:new Set(['Space']),jumpQueued:false,mobileAssist:false},i/240);
   hooked.update(1/240,{keys:new Set(['Space']),jumpQueued:false,mobileAssist:false},i/240);
 }
 assert.ok(hooked.position.distanceTo(startHooked)>free.position.distanceTo(startFree)*1.35,
   'with an attached cable, Ackerman flight is faster than unhooked gas-only navigation');
});

test('full-screen responsive layout exposes desktop Ackerman button and radial touch actions',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 for(const id of ['touchMoveZone','touchLookZone','moveStick','ackermanPcButton','mobilePauseButton'])
   assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('class="ackerman-slowmo-overlay"'));
 assert.ok(css.includes('.touch-move-zone'));
 assert.ok(css.includes('.touch-actions{'));
 assert.ok(css.includes('.touch-btn.cable-left'));
 assert.ok(css.includes('.touch-btn.cable-right'));
 assert.ok(css.includes('.touch-btn.boost'));
 assert.ok(css.includes('body.ackerman-active .ackerman-slowmo-overlay{display:block}'));
 assert.ok(css.includes('100dvh'));
 assert.ok(css.includes('env(safe-area-inset-bottom)'));
 assert.ok(main.includes('floatingStickVector('));
 assert.ok(main.includes('mobileInput.boostPointer'));
 assert.ok(main.includes("  $('ackermanPcButton').onclick="));
 assert.ok(!html.includes('1 SELECT · X ENGAGE'));
 assert.ok(!html.includes('1–9 / X'));
});
