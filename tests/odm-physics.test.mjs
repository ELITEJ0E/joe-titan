import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {solveTetherConstraints,groundVelocityBlend} from '../src/odm-physics.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
test('a taut cable removes outward velocity but keeps tangential swing speed',()=>{
  const p=V(10,0,0),v=V(8,0,22),hooks=[{point:V(0,0,0),length:10}];
  solveTetherConstraints(p,v,hooks);
  assert.ok(Math.abs(v.x)<1e-7);
  assert.ok(Math.abs(v.z-22)<1e-7);
});
test('two ropes remain feasible after alternating constraints',()=>{
  const p=V(0,-20,0),v=V(10,-8,14),hooks=[
    {point:V(-12,18,0),length:25},
    {point:V(12,18,0),length:25}
  ];
  solveTetherConstraints(p,v,hooks,16);
  for(const h of hooks)assert.ok(p.distanceTo(h.point)<=h.length+.02);
  assert.ok(p.toArray().every(Number.isFinite)&&v.toArray().every(Number.isFinite));
});
test('tethered ground contact does not erase horizontal momentum',()=>{
  const tethered=V(48,0,0),unhooked=V(48,0,0),goal=V(10,0,0);
  groundVelocityBlend(tethered,goal,.016,true);
  groundVelocityBlend(unhooked,goal,.016,false);
  assert.equal(tethered.x,48);
  assert.ok(unhooked.x<48);
});
test('slack cables exert no constraint',()=>{
  const p=V(1,2,3),v=V(4,5,6);
  solveTetherConstraints(p,v,[{point:V(0,0,0),length:40}]);
  assert.deepEqual(p.toArray(),[1,2,3]);
  assert.deepEqual(v.toArray(),[4,5,6]);
});
