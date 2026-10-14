import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlayer} from '../src/player.js';
import {resolveWorldCollision} from '../src/collision.js';

function setup(colliders=[]) {
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,1,.15,1600);
  const world={resolveCollision:(p,prev,v)=>resolveWorldCollision(colliders,p,prev,v),grappleRay:(origin,dir,maxDist=125)=>maxDist>=45?origin.clone().addScaledVector(dir,45):null};
  return {player:createPlayer(scene,world,camera),camera,world,input:{keys:new Set(),jumpQueued:false}};
}
function finite(player,camera) {
  for(const vector of [player.position,player.velocity,camera.position])assert.ok(vector.toArray().every(Number.isFinite),'coordinates must remain finite');
  assert.ok(camera.quaternion.toArray().every(Number.isFinite),'camera orientation must remain finite');
}
function step(s,count=100) {for(let i=0;i<count;i++){s.player.update(.01,s.input,i*.01);s.player.updateCamera(.01);finite(s.player,s.camera);}}

test('WASD walking stays finite and follows yaw in all four directions',()=>{
  for(const [key,axis,sign] of [['KeyW','z',-1],['KeyS','z',1],['KeyA','x',-1],['KeyD','x',1]]) {
    const s=setup(),start=s.player.position[axis];s.input.keys.add(key);step(s);
    assert.ok((s.player.position[axis]-start)*sign>5);assert.equal(s.player.recoveries,0);
  }
  const s=setup(),startX=s.player.position.x;s.player.yaw=Math.PI/2;s.input.keys.add('KeyW');step(s);assert.ok(s.player.position.x<startX-5);
});
test('jump, boost, landing and gas refill remain stable',()=>{
  const s=setup();s.input.jumpQueued=true;step(s,10);assert.ok(s.player.position.y>1);assert.equal(s.player.grounded,false);
  s.input.keys.add('Space');step(s,50);assert.ok(s.player.gas<100);s.input.keys.clear();step(s,800);
  assert.equal(s.player.position.y,1);assert.equal(s.player.grounded,true);assert.equal(s.player.gas,100);
});
test('dual hooks reel, release independently and preserve finite motion',()=>{
  const s=setup();assert.ok(s.player.fire(0));assert.ok(s.player.fire(1));assert.deepEqual(s.player.hooks[0].point.toArray(),s.player.hooks[1].point.toArray());
  const length=s.player.hooks[0].length;s.input.jumpQueued=true;s.input.keys.add('ShiftLeft');s.input.keys.add('Space');step(s,40);
  assert.ok(s.player.gas<100,'airborne boost must spend gas');
  step(s,210);
  assert.ok(s.player.hooks[0].length<length);
  assert.ok(s.player.hooks[0].length+s.player.hooks[1].length>=s.player.hooks[0].point.distanceTo(s.player.hooks[1].point),'dual ropes must remain geometrically feasible');
  s.player.release(0);assert.equal(s.player.hooks[0],null);assert.ok(s.player.hooks[1]);
  s.player.release(1);step(s,300);assert.equal(s.player.recoveries,0);
});
test('roofs land from above, leave overhead movement alone and block side entry',()=>{
  const b=[{x:0,z:0,h:20,halfW:10,halfD:10}],p=new THREE.Vector3(0,20.5,0),v=new THREE.Vector3(0,-10,0);
  assert.ok(resolveWorldCollision(b,p,new THREE.Vector3(0,22,0),v));assert.equal(p.y,21);assert.equal(v.y,0);
  p.set(2,30,2);v.set(3,0,0);resolveWorldCollision(b,p,p.clone(),v);assert.deepEqual(p.toArray(),[2,30,2]);
  p.set(-10,5,0);v.set(10,0,0);resolveWorldCollision(b,p,new THREE.Vector3(-11,5,0),v);assert.equal(p.x,-10.52);assert.equal(v.x,0);
});
test('invalid coordinates and world escape recover once and reset camera immediately',()=>{
  const s=setup();s.player.fire(0);s.player.position.x=NaN;step(s,1);assert.equal(s.player.recoveries,1);assert.equal(s.player.hooks[0],null);
  assert.deepEqual(s.player.position.toArray(),[34,1,31]);assert.ok(s.camera.position.distanceTo(s.player.position)<15);
  s.player.position.set(700,3,0);step(s,1);assert.equal(s.player.recoveries,2);
  s.player.velocity.z=Infinity;step(s,1);assert.equal(s.player.recoveries,3);step(s,100);assert.equal(s.player.recoveries,3);
});
test('first-person camera and obstructed camera stay finite and above ground',()=>{
  const s=setup();s.player.firstPerson=true;step(s,30);assert.ok(s.camera.position.distanceTo(s.player.position)<2);
  s.player.firstPerson=false;s.world.grappleRay=(origin,dir)=>origin.clone().addScaledVector(dir,.7);step(s,30);
  assert.ok(s.camera.position.distanceTo(s.player.position)<2);assert.ok(s.camera.position.y>=.35);
});
test('a new cable preserves position rather than snapping toward its anchor',()=>{
  const s=setup(),before=s.player.position.clone();assert.ok(s.player.fire(0));
  assert.equal(s.player.hooks[0].length,s.player.position.distanceTo(s.player.hooks[0].point));
  step(s,1);assert.ok(s.player.position.distanceTo(before)<.2);
});
