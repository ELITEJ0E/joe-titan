import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {pilotPoseTargets} from '../src/odm-pose.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const base={position:V(0,20,0),forward:V(0,0,-1),right:V(1,0,0),hooks:[],grounded:false,boost:false,steer:0};
test('normal grounded movement returns upright pilot',()=>{
  assert.deepEqual(pilotPoseTargets({...base,velocity:V(9,0,-9),grounded:true}),{pitch:0,bank:0});
});
test('fast tethered movement produces strong visible forward dive',()=>{
  const low=pilotPoseTargets({...base,velocity:V(0,0,-10),hooks:[{point:V(0,40,-40)}]});
  const fast=pilotPoseTargets({...base,velocity:V(0,-7,-55),hooks:[{point:V(0,40,-40)}],boost:true});
  assert.ok(fast.pitch<-0.55,'hooked high-speed avatar should clearly pitch forward');
  assert.ok(fast.pitch<low.pitch,'lean increases with aerial speed');
});
test('side flight and right or left cable tension bank in corresponding direction',()=>{
  const right=pilotPoseTargets({...base,velocity:V(35,0,-18)});
  const left=pilotPoseTargets({...base,velocity:V(-35,0,-18)});
  assert.ok(right.bank<-.15,'moving right should bank right');
  assert.ok(left.bank>.15,'moving left should bank left');
  const hookRight=pilotPoseTargets({...base,velocity:V(0,0,-50),hooks:[{point:V(28,40,-45)}]});
  const hookLeft=pilotPoseTargets({...base,velocity:V(0,0,-50),hooks:[{point:V(-28,40,-45)}]});
  assert.ok(hookRight.bank<0&&hookLeft.bank>0);
});
test('pose is bounded at extreme speed',()=>{
  const pose=pilotPoseTargets({...base,velocity:V(2000,500,-700),hooks:[{point:V(40,90,10)}]});
  assert.ok(pose.pitch>=-.79&&pose.pitch<=.06&&Math.abs(pose.bank)<=.66);
});
