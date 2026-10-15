import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {TITAN_JUMPS,titanJumpVelocity,titanCameraLimits,changeOrbitZoom} from '../src/titan-camera-jump.js';
import {createTitanPlayer} from '../src/titan-player.js';
import {createTitanBlastEffects} from '../src/titan-blast-effects.js';
import {createVoxelWorld} from '../src/voxel-city.js';
import {createPlayer} from '../src/player.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const input=(...codes)=>({keys:new Set(codes),jumpQueued:false});

test('all nine Titans have size-aware jumps and Jaw is dramatically higher/faster',()=>{
 assert.equal(Object.keys(TITAN_JUMPS).length,9);
 assert.ok(TITAN_JUMPS.jaw.height>=23);
 assert.ok(TITAN_JUMPS.jaw.height>TITAN_JUMPS.attack.height*2);
 assert.ok(TITAN_JUMPS.attack.height>TITAN_JUMPS.armored.height);
 assert.ok(TITAN_JUMPS.colossal.height<TITAN_JUMPS.armored.height);
 assert.ok(titanJumpVelocity('jaw')>titanJumpVelocity('attack')*1.35);
 assert.ok(TITAN_JUMPS.jaw.airSpeed>TITAN_JUMPS.armored.airSpeed);
});
test('Jaw leap exceeds Attack height over same first second of actual physics',()=>{
 const start=(kind)=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const world={terrainHeight:()=>0,colliders:[]};
  const t=createTitanPlayer(scene,world,camera,{enemies:[]});
  t.choose(kind,V(0,0,0));
  const trigger=input('KeyW','ShiftLeft');trigger.jumpQueued=true;
  t.update(1/120,trigger,0);
  let peak=t.position.y;
  for(let i=0;i<280;i++){
   t.update(1/120,input('KeyW','ShiftLeft'),(i+1)/120);
   peak=Math.max(peak,t.position.y);
  }
  const moved=Math.hypot(t.position.x,t.position.z);
  t.dispose();return {peak,moved};
 };
 const jaw=start('jaw'),attack=start('attack'),colossal=start('colossal');
 assert.ok(jaw.peak>20,'Jaw should vault well over a multi-storey building');
 assert.ok(jaw.peak>attack.peak*1.8);
 assert.ok(attack.peak>colossal.peak*2);
 assert.ok(jaw.moved>attack.moved,'Jaw is also fast horizontally in the air');
});
test('Titan and Scout zoom independently, with limits and no first-person zoom drift',()=>{
 const limits=titanCameraLimits(60);
 assert.ok(limits.min>20&&limits.max>150);
 assert.ok(changeOrbitZoom(20,-500,{min:10,max:70})<20);
 assert.ok(changeOrbitZoom(20,500,{min:10,max:70})>20);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const t=createTitanPlayer(scene,{terrainHeight:()=>0,colliders:[]},camera,{enemies:[]});
 t.choose('colossal',V());
 const initial=t.cameraDistance;
 assert.ok(t.adjustZoom(-360)<initial);
 const near=t.adjustZoom(-99999);
 assert.ok(near>=titanCameraLimits(60).min);
 const far=t.adjustZoom(99999);
 assert.ok(far<=titanCameraLimits(60).max);
 t.dispose();
 const scout=createPlayer(new THREE.Scene(),{spawnPoint:V(0,1,0),grappleRay:()=>null,resolveCollision:()=>true},new THREE.PerspectiveCamera());
 assert.ok(scout.adjustZoom(-500)<11.6);
 scout.firstPerson=true;
 const before=scout.adjustZoom(0);
 assert.equal(scout.adjustZoom(-500),before,'wheel does not disrupt FPS aiming');
});
test('Colossal creates an expanding mushroom cloud and damages nearby world structures',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const calls=[];
 const world={terrainHeight:()=>0,colliders:[],damageStructures:(p,r,o)=>{
  calls.push({p:p.clone(),r,o});return {pieces:45,colliders:3};
 }};
 const t=createTitanPlayer(scene,world,camera,{enemies:[]});
 assert.ok(t.choose('colossal',V()));
 assert.equal(t.explosionCount,0);
 const special=t.special();
 assert.equal(special.ok,true);
 assert.ok(t.explosionCount>0);
 assert.ok(calls.some(c=>c.r>=40));
 const count=scene.children.length;
 t.update(.6,input(),.6);
 assert.ok(scene.children.length>=count);
 t.update(5.4,input(),6);
 assert.equal(t.explosionCount,0);
 t.dispose();
});
test('procedural city breaks instanced blocks AND physical colliders, and restores on reset',()=>{
 const scene=new THREE.Scene(),world=createVoxelWorld(scene);
 const original=world.colliders.length;
 assert.ok(original>20);
 const wall=world.colliders.find(b=>Math.abs(b.x+180)<.1&&Math.abs(b.z+97)<9);
 assert.ok(wall);
 const origin=V(wall.x,10,wall.z);
 const result=world.damageStructures(origin,12,{height:10});
 assert.ok(result.pieces>0,'walls lose visible instanced geometry');
 assert.ok(result.colliders>0,'corresponding wall physics removed');
 assert.ok(world.colliders.length<original);
 const again=world.damageStructures(origin,12,{height:10});
 assert.equal(again.pieces,0,'previously destroyed geometry cannot count twice');
 world.resetDestruction();
 assert.equal(world.colliders.length,original);
 const replay=world.damageStructures(origin,12,{height:10});
 assert.ok(replay.pieces>0,'restored map is destructible in the next mission');
});
test('Shiganshina destruction changes both voxel physics and voxel material mask',()=>{
 const code=readFileSync(new URL('../src/minecraft-world.js',import.meta.url),'utf8');
 const shader=readFileSync(new URL('../src/shiganshina-visuals.js',import.meta.url),'utf8');
 assert.ok(code.includes('world.damageStructures=(center,radius'));
 assert.ok(code.includes('asset.voxel[id]=0'));
 assert.ok(code.includes('world.resetDestruction='));
 assert.ok(code.includes('visuals.material.uniforms.uBlastCount.value=volumes.length'));
 assert.ok(shader.includes('uniform vec4 uBlastVolumes[24]'));
 assert.ok(shader.includes('discard;'));
});
