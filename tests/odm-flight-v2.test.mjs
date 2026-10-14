import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyODMMotor,ODM_TUNING} from '../src/odm-motor.js';
import {slideVoxelHorizontal} from '../src/voxel-slide.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
test('hook engagement immediately pulls toward reticle anchor without requiring Shift',()=>{
  const position=V(0,10,0),velocity=V(13,0,0);
  const hooks=[{point:V(0,32,-45),length:position.distanceTo(V(0,32,-45))}];
  const originalSide=velocity.x;
  const consumed=applyODMMotor(position,velocity,hooks,.02,{gas:100});
  assert.ok(velocity.y>0&&velocity.z<0,'winch should pull toward target on engagement');
  assert.equal(velocity.x,originalSide,'preserve tangential swing momentum');
  assert.ok(hooks[0].length<position.distanceTo(hooks[0].point),'automatically take up cable slack');
  assert.ok(consumed>0);
});

test('holding Shift increases reel speed; exhausted gas allows passive pendulum only',()=>{
  const p=V(0,10,0),a=V(0,40,-40),length=p.distanceTo(a);
  const slow=[{point:a.clone(),length}],fast=[{point:a.clone(),length}];
  applyODMMotor(p,V(0,0,0),slow,.1,{gas:100});
  applyODMMotor(p,V(0,0,0),fast,.1,{gas:100,reeling:true});
  assert.ok(fast[0].length<slow[0].length);
  const velocity=V(5,0,0),hook=[{point:a,length}];
  assert.equal(applyODMMotor(p,velocity,hook,.1,{gas:0,reeling:true}),0);
  assert.deepEqual(velocity.toArray(),[5,0,0]);
  assert.equal(hook[0].length,length);
});

test('two opposing anchors do not create explosive acceleration or impossible cable length',()=>{
  const p=V(0,14,0),velocity=V(0,0,-13);
  const hooks=[{point:V(-20,42,-30),length:45},{point:V(20,42,-30),length:45}];
  for(let i=0;i<100;i++)applyODMMotor(p,velocity,hooks,.01,{reeling:true,gas:100});
  assert.ok(velocity.length()<160);
  assert.ok(hooks[0].length+hooks[1].length>=hooks[0].point.distanceTo(hooks[1].point)-.001);
  assert.ok(ODM_TUNING.autoReel<ODM_TUNING.fastReel);
});

test('swept collision slides along walls without killing lateral velocity',()=>{
  const solid=(x,y,z)=>x>=2&&x<=3&&y>=0&&y<=8&&z>=-4&&z<=7;
  const previous=V(0,2,0),position=V(5,2,4),velocity=V(65,0,45);
  const hit=slideVoxelHorizontal(position,previous,velocity,solid);
  assert.ok(hit.blockedX);
  assert.equal(velocity.x,0);
  assert.equal(velocity.z,45);
  assert.ok(position.x<2);
  assert.ok(position.z>3,'allow travel parallel to the wall');
});

test('swept voxel check catches thin walls even when a 100 Hz step passes them',()=>{
  const solid=(x,y,z)=>x>=1.2&&x<1.6&&y>=0&&y<6;
  const old=V(0,2,0),pos=V(3,2,0),velocity=V(90,0,0);
  slideVoxelHorizontal(pos,old,velocity,solid);
  assert.ok(pos.x<1.2);
  assert.equal(velocity.x,0);
});

test('unobstructed flight retains full velocity and intended path',()=>{
  const previous=V(0,12,0),position=V(1.8,13.2,-2.4),velocity=V(32,10,-43);
  const result=slideVoxelHorizontal(position,previous,velocity,()=>false);
  assert.deepEqual(result,{blockedX:false,blockedZ:false});
  assert.ok(position.distanceTo(V(1.8,13.2,-2.4))<1e-8);
  assert.deepEqual(velocity.toArray(),[32,10,-43]);
});
