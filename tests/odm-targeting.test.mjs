import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chooseGrappleTarget} from '../src/odm-targeting.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const eye=V(0,3,0),pilot=V(0,1,0),forward=V(0,0,-1);
test('reticle attaches to the exact surface intersection, never suggested anchors',()=>{
  const direct=V(0,3,-34),roof=V(16,50,-45);
  let rays=0,assists=0;
  const world={grappleRay:()=>{rays++;return direct;},bestAnchor:()=>{assists++;return roof;}};
  const hit=chooseGrappleTarget(world,eye,pilot,forward,-1);
  assert.ok(hit.distanceTo(direct)<.0001);
  assert.equal(rays,1);
  assert.equal(assists,0);
});
test('open sky always misses even with nearby grappleable rooftops',()=>{
  let rays=0,assists=0;
  const world={grappleRay:()=>{rays++;return null;},bestAnchor:()=>{assists++;return V(0,30,-35);}};
  assert.equal(chooseGrappleTarget(world,eye,pilot,forward,1),null);
  assert.equal(rays,1);
  assert.equal(assists,0);
});
test('left and right independently fire at exactly the same aimed point',()=>{
  const center=V(0,3,-42);
  const world={grappleRay:()=>center,bestAnchor:()=>{throw Error('must not be called');}};
  const left=chooseGrappleTarget(world,eye,pilot,forward,-1);
  const right=chooseGrappleTarget(world,eye,pilot,forward,1,left);
  assert.deepEqual(left.toArray(),center.toArray());
  assert.deepEqual(right.toArray(),center.toArray());
  assert.notEqual(left,right,'each hook owns an independent anchor vector');
});
test('a hit off the crosshair axis is rejected even if very close',()=>{
  const world={grappleRay:()=>V(2,3,-40)};
  assert.equal(chooseGrappleTarget(world,eye,pilot,forward,-1),null);
});
test('crosshair hits too close, too distant, behind the camera or invalid are rejected',()=>{
  for(const hit of [V(0,3,-.4),V(0,3,-145),V(0,3,10),V(Infinity,0,-30)]){
    assert.equal(chooseGrappleTarget({grappleRay:()=>hit},eye,pilot,forward,0),null);
  }
});
test('camera direction is authoritative, even when it is not the original forward axis',()=>{
  const direction=V(1,.2,-1).normalize();
  const hit=eye.clone().addScaledVector(direction,44);
  const got=chooseGrappleTarget({grappleRay:(_eye,dir)=>{
    assert.ok(dir.distanceTo(direction)<1e-8);
    return hit;
  }},eye,pilot,direction,1);
  assert.ok(got.distanceTo(hit)<1e-8);
});
