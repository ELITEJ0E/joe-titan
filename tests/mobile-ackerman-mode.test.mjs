import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ACKERMAN_MODE,ASPECTS,createAspectState,activateAspect,
  updateAspect,ackermanWorldScale,selectAspect} from '../src/aspects.js';
import {lookDragDelta,mobileHookAssistance,MOBILE_ASSIST,isMobileBackActive}
  from '../src/mobile-flight-controls.js';
import {createPlayer} from '../src/player.js';
import {readFileSync} from 'node:fs';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const input=mobileAssist=>({keys:new Set(),jumpQueued:false,mobileAssist});
const world=()=>({spawnPoint:V(0,1,0),grappleRay:()=>null,resolveCollision:()=>false});

test('Ackerman Mode is the single selectable ability, with exactly seven real seconds',()=>{
  assert.equal(ASPECTS.length,1);
  assert.equal(selectAspect(createAspectState(),8),ACKERMAN_MODE);
  const state=createAspectState(),trigger=activateAspect(state);
  assert.equal(trigger.ok,true);assert.equal(trigger.aspect.effect,'ackerman');
  assert.equal(state.duration,7);
  assert.ok(ackermanWorldScale(state)<.35);
  const activatedAgain=activateAspect(state);
  assert.equal(activatedAgain.reason,'ACTIVE');
  const almost=updateAspect(state,6.99);
  assert.equal(almost.ended,false);
  assert.ok(state.duration>0);
  const end=updateAspect(state,.01);
  assert.equal(end.ended,true);
  assert.equal(end.aspect,ACKERMAN_MODE);
  assert.equal(ackermanWorldScale(state),1);
  assert.equal(activateAspect(state).reason,'COOLDOWN');
  updateAspect(state,26);
  assert.equal(activateAspect(state).ok,true);
});

test('Ackerman Mode slows gravity while leaving flight velocity physical',()=>{
  const a=createPlayer(new THREE.Scene(),world(),new THREE.PerspectiveCamera());
  const b=createPlayer(new THREE.Scene(),world(),new THREE.PerspectiveCamera());
  a.grounded=false;b.grounded=false;
  a.position.y=15;b.position.y=15;
  a.velocity.set(0,0,0);b.velocity.set(0,0,0);
  a.setAspect(ACKERMAN_MODE);
  for(let i=0;i<10;i++){
    a.update(1/240,input(false),i/240);
    b.update(1/240,input(false),i/240);
  }
  assert.ok(a.velocity.y>b.velocity.y,'Ackerman pilot should descend more slowly');
  assert.ok(a.velocity.y<0,'gravity is reduced, not removed or replaced by teleportation');
  assert.ok(a.position.y>b.position.y);
});

test('mobile hooks auto reel and engage reduced-cost propulsion; PC hooks remain manual',()=>{
  const mobile=createPlayer(new THREE.Scene(),world(),new THREE.PerspectiveCamera());
  const desktop=createPlayer(new THREE.Scene(),world(),new THREE.PerspectiveCamera());
  for(const p of [mobile,desktop]){
    p.grounded=true;
    p.position.set(0,1,0);
    p.hooks[0]={point:V(0,28,-52),length:60,age:0};
  }
  const startM=mobile.gas,startD=desktop.gas;
  mobile.update(.03,input(true),.03);
  desktop.update(.03,input(false),.03);
  assert.ok(mobile.hooks[0].length<desktop.hooks[0].length);
  assert.ok(mobile.boost,'mobile hook initiates assisted gas propulsion');
  assert.equal(desktop.boost,false,'PC boost remains manual');
  assert.ok(mobile.gas<startM&&desktop.gas<startD);
  assert.equal(mobile.grounded,false,'attached mobile hook helps take off');
  assert.ok(mobile.velocity.y>desktop.velocity.y);
});

test('right-half camera pan uses drag deltas, not a virtual stick or continuous rotation',()=>{
  const delta=lookDragDelta(100,-60);
  assert.ok(Math.abs(delta.yaw+100*MOBILE_ASSIST.lookYawPerPixel)<1e-9);
  assert.ok(Math.abs(delta.pitch-60*MOBILE_ASSIST.lookPitchPerPixel)<1e-9);
  assert.deepEqual(lookDragDelta(0,0),{yaw:0,pitch:0});
  assert.ok(Math.abs(lookDragDelta(9999,9999).yaw)<=110*MOBILE_ASSIST.lookYawPerPixel);
  assert.ok(mobileHookAssistance({mobileAssist:true,activeHooks:1,gas:50}).reel);
  assert.equal(mobileHookAssistance({mobileAssist:false,activeHooks:2,gas:50}).boost,false);
  assert.equal(mobileHookAssistance({mobileAssist:true,activeHooks:2,gas:0}).boost,false);
  assert.ok(mobileHookAssistance({mobileAssist:true,activeHooks:1,gas:50}).gasCostMultiplier<1);
});

test('mobile back only pauses an active flight; UI retains pause visual settings',()=>{
  assert.equal(isMobileBackActive({started:true,finished:false,mobile:true}),true);
  assert.equal(isMobileBackActive({started:false,mobile:true}),false);
  assert.equal(isMobileBackActive({started:true,mobile:false}),false);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
  assert.ok(html.includes('id="touchLookZone"'));
  assert.ok(!html.includes('id="lookStick"'));
  assert.ok(html.includes('id="mobilePauseButton"'));
  assert.ok(html.includes('id="graphicsPauseButton"'));
  assert.ok(!html.includes('id="qualityButton"'));
  assert.ok(main.includes("window.addEventListener('popstate'"));
  assert.ok(main.includes('setupTouchLookZone()'));
  assert.ok(!main.includes('mobileInput.look.x'));
  assert.ok(css.includes('.touch-look-zone'));
  assert.ok(css.includes('.brand,.hud-right,.city-label{display:none!important}'));
});
