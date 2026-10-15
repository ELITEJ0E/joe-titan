import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TITAN_GAIT,gaitForTitan,armoredClipPose} from '../src/titan-gait.js';
import {createEnemySimulation} from '../src/enemies.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('patrol gait is distinctly slower than pursuit and is size-aware',()=>{
 for(const [type,tuning] of Object.entries(TITAN_GAIT)){
  const entity={type,height:type==='colossus'?34:19};
  const walk=gaitForTitan(entity,{pursuing:false,remaining:30});
  const run=gaitForTitan(entity,{pursuing:true,remaining:45});
  assert.equal(walk.running,false);
  assert.equal(run.running,true);
  assert.ok(run.speed>walk.speed*1.7,type);
  assert.ok(run.cycleRate>walk.cycleRate);
  assert.equal(walk.speed,tuning.walk);
 }
});

test('AI Titans ramp into walking and running smoothly, including Armored',()=>{
 const sim=createEnemySimulation([{type:'armored',position:[0,0,0],patrol:[0,0,-50]}]);
 const e=sim.enemies[0],player=V(0,0,900);
 sim.update(.1,player);
 assert.equal(e.state,'patrol');
 assert.ok(e.locomotionSpeed>0&&e.locomotionSpeed<TITAN_GAIT.armored.walk);
 assert.equal(e.sprinting,false);
 for(let i=0;i<30;i++)sim.update(.1,player);
 assert.ok(e.moving>.4,'walking animation becomes active during patrol');
 const walk=e.locomotionSpeed;
 player.set(0,0,-80);
 for(let i=0;i<18;i++)sim.update(.1,player);
 assert.equal(e.state,'pursue');
 assert.ok(e.locomotionSpeed>walk+1,'chase moves faster than patrol');
 assert.equal(e.sprinting,true);
 assert.ok(e.cycleRate>1);
 sim.reset();
 assert.equal(e.locomotionSpeed,0);
 assert.equal(e.sprinting,false);
});

test('Armored native rig chooses a visible animated walk before full sprint',()=>{
 const idle=armoredClipPose({moving:0,sprinting:false},true);
 const walk=armoredClipPose({moving:1,sprinting:false},true);
 const run=armoredClipPose({moving:1,sprinting:true},true);
 assert.equal(idle.mode,'idle');
 assert.equal(walk.mode,'walk');
 assert.equal(run.mode,'run');
 assert.ok(walk.rate<run.rate*.6);
 assert.ok(walk.weight<run.weight);
 assert.equal(armoredClipPose({moving:1,sprinting:true},false).mode,'idle');
});
