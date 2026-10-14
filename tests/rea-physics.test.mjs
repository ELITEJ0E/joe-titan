import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ODM_TUNING,applyODMMotor,applyReferenceAirDrag} from '../src/odm-motor.js';
import {impactDamage,IMPACT_TUNING} from '../src/odm-impacts.js';

test('REA-extracted reference constants match JOE Titan exactly',()=>{
  const expected={
    gravity:26,run:8.5,sprint:11.5,groundResponse:16,airControl:9,
    hookAirControl:15,maxSpeed:85,minCable:2.8,autoReel:3,fastReel:26,
    autoPull:2.5,fastPull:38,swingPump:7,dragBase:.015,dragSpeed:.0011,
    boost:36,boostVerticalGravity:.35,brakeVertical:110,brakeHorizontal:2.4,
    gasFire:.25,gasBoost:7,gasReel:3.5,gasHang:.35,gasBrake:2.5
  };
  for(const [key,val] of Object.entries(expected))assert.equal(ODM_TUNING[key],val,key);
});
test('source-model pull, reel and gas match one-second analytical result',()=>{
  const p=new THREE.Vector3(0,0,0),point=new THREE.Vector3(0,0,-70);
  const v=new THREE.Vector3(0,0,0),hooks=[{point,length:70}];
  applyODMMotor(p,v,hooks,.1,{gas:100});
  assert.ok(Math.abs(v.z+.25)<1e-10);
  assert.ok(Math.abs(hooks[0].length-69.7)<1e-10);
  assert.ok(Math.abs(applyODMMotor(p,new THREE.Vector3(),[{point,length:70}],.1,{gas:100,reeling:true})-.35)<1e-10);
});
test('reference air drag is speed-dependent and reduces total speed',()=>{
  const v=new THREE.Vector3(50,0,0);
  applyReferenceAirDrag(v,.2);
  assert.ok(Math.abs(v.x-50*(1-(.015+50*.0011)*.2))<1e-9);
});
test('reference jump trajectory and wall/landing damage use the measured formulas',()=>{
  assert.ok(Math.abs(9.6/ODM_TUNING.gravity-.3692307692)<1e-7);
  assert.ok(Math.abs(9.6**2/(2*ODM_TUNING.gravity)-1.7723076923)<1e-7);
  assert.deepEqual(IMPACT_TUNING,{safeLanding:22,safeWall:27,scale:2.4,stunAt:22});
  assert.equal(impactDamage(20,false),0);
  assert.equal(impactDamage(30,false),19);
  assert.equal(impactDamage(40,true),31);
});
