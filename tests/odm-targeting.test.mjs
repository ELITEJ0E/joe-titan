import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chooseGrappleTarget} from '../src/odm-targeting.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const eye=V(0,3,0),pilot=V(0,1,0),forward=V(0,0,-1);
test('accurate crosshair ray wins over a more attractive assisted roof',()=>{
  const direct=V(0,14,-34),roof=V(16,50,-45);
  const world={grappleRay:()=>direct,bestAnchor:()=>roof};
  assert.ok(chooseGrappleTarget(world,eye,pilot,forward,-1).distanceTo(direct)<.001);
});
test('second cable can choose a separate surface without moving the first hook',()=>{
  const center=V(0,17,-35),left=V(-7,17,-35),right=V(7,17,-35);
  const world={grappleRay:(origin)=>Math.abs(origin.x)<.1?center:origin.x>0?right:left,
    bestAnchor:()=>null};
  const first=chooseGrappleTarget(world,eye,pilot,forward,-1);
  const second=chooseGrappleTarget(world,eye,pilot,forward,1,first);
  assert.ok(first.distanceTo(center)<.01);
  assert.ok(second.distanceTo(right)<.01);
  assert.ok(second.distanceTo(first)>3);
});
test('an open-sky assist must align with camera and not be behind the pilot',()=>{
  const world={grappleRay:()=>null,bestAnchor:()=>V(0,25,35)};
  assert.equal(chooseGrappleTarget(world,eye,pilot,forward,-1),null);
});
test('nearby facade occludes assisted rooftop attachment',()=>{
  const roof=V(2,30,-65),front=V(1,14,-24);
  const world={grappleRay:(_origin,dir)=>Math.abs(dir.x)<.005?null:front,bestAnchor:()=>roof};
  const hit=chooseGrappleTarget(world,eye,pilot,forward,1);
  assert.ok(hit?.distanceTo(front)<.01);
});
test('hooks reject too-close targets and non-finite geometry',()=>{
  const world={grappleRay:()=>V(0,3,-3),bestAnchor:()=>V(Infinity,10,-40)};
  assert.equal(chooseGrappleTarget(world,eye,pilot,forward,1),null);
});
