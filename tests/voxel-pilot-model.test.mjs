import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlayer} from '../src/player.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('player uses a blocky animated rig with separate elbows, knees and blades',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,1,.1,1000);
  const world={spawnPoint:V(0,1,0),resolveCollision:()=>false,grappleRay:()=>null};
  const player=createPlayer(scene,world,camera),model=player.model;
  assert.equal(model.headRig.name,'pilot head');
  assert.equal(model.arms.length,2);
  assert.equal(model.elbows.length,2);
  assert.equal(model.knees.length,2);
  assert.equal(model.blades.length,2);
  assert.ok(model.headRig.children.some(c=>c.geometry?.type==='BoxGeometry'));
  assert.equal(model.blades[0].material.type,'MeshStandardMaterial');
  const input={keys:new Set(['KeyW','Space']),jumpQueued:true};
  player.update(1/60,input,0.1);
  for(let i=1;i<80;i++)player.update(1/60,input,.1+i/60);
  assert.equal(player.grounded,false);
  assert.ok(model.knees[0].quaternion.angleTo(new THREE.Quaternion())>0);
  assert.ok(model.elbows[0].quaternion.angleTo(new THREE.Quaternion())>0);
});

test('camera increases field of view smoothly with sustained flight speed',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,1,.1,1000);
  const world={spawnPoint:V(0,1,0),resolveCollision:()=>false,grappleRay:()=>null};
  const player=createPlayer(scene,world,camera);
  player.velocity.set(38,5,-21);
  player.update(1/60,{keys:new Set(),jumpQueued:false},.1);
  player.updateCamera(.1);
  assert.ok(camera.fov>72);
  assert.ok(camera.fov<110);
});
