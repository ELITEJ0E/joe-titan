import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {gasThrustDirection,applyGazeGasBoost,allowBoostCablePayout,directionalGasThrust,applyDirectionalGasBoost} from '../src/odm-gas-propulsion.js';
import {solveTetherConstraints} from '../src/odm-physics.js';
import {applyODMMotor,ODM_TUNING} from '../src/odm-motor.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('gas direction is exactly gaze aligned regardless of lateral/forward input',()=>{
  const gaze=V(0,.2,-1).normalize();
  for(const wish of [V(0,0,0),V(1,0,0),V(0,0,-1),V(-1,0,1)]){
    const thrust=gasThrustDirection(gaze,wish);
    assert.ok(thrust.distanceTo(gaze)<1e-12);
  }
});
test('gas applies exactly 36 units/s² along look plus fixed 9.1 units/s² upward',()=>{
  const v=V(0,0,0);
  applyGazeGasBoost(v,V(0,0,-1),.1);
  assert.ok(v.distanceTo(V(0,.91,-3.6))<1e-9);
  const up=V(0,0,0);
  applyGazeGasBoost(up,V(0,1,0),.1);
  assert.ok(up.distanceTo(V(0,4.51,0))<1e-9);
});
test('gas and anchor motor add their accelerations independently',()=>{
  const p=V(0,10,0),hook={point:V(0,10,30),length:30},v=V(0,0,0);
  applyGazeGasBoost(v,V(0,0,-1),.1);
  applyODMMotor(p,v,[hook],.1,{gas:100});
  // 36*.1 toward -Z plus 2.5*.1 toward +Z
  assert.ok(Math.abs(v.z+3.35)<1e-9);
  assert.ok(Math.abs(v.y-.91)<1e-9);
});
test('a taut cable removes outward speed but preserves tangential gaze thrust',()=>{
  const p=V(0,10,0),hook={point:V(0,10,-20),length:20},v=V(12,0,0);
  applyGazeGasBoost(v,V(1,0,1).normalize(),.05);
  const before=v.clone();
  p.addScaledVector(v,.05);
  solveTetherConstraints(p,v,[hook]);
  assert.ok(p.distanceTo(hook.point)<=hook.length+.001);
  assert.ok(v.x>12,'tangent movement stays positive');
  assert.ok(v.length()<=before.length()+1e-8);
});
test('legacy cable-payout helper remains isolated and unused by player reference mode',()=>{
  const pos=V(0,0,0),hook={point:V(0,0,-10),length:10};
  const paid=allowBoostCablePayout(pos,V(0,0,30),[hook],.1,{boosting:true,gas:50});
  assert.ok(paid>0);
  assert.ok(hook.length>10);
});

test('directional jet follows strafe input rather than looking forward',()=>{
  const forward=directionalGasThrust(0,0,0,1);
  const strafe=directionalGasThrust(0,0,1,0);
  assert.ok(forward.z<-.9);
  assert.ok(strafe.x>.9);
  assert.ok(Math.abs(strafe.z)<1e-10);
  assert.ok(strafe.y>0,'reference jet has vertical steering bias');
});

test('directional gas adds gravity-relative lift without replacing swing velocity',()=>{
  const v=V(12,-10,-4);
  applyDirectionalGasBoost(v,0,0,0,1,.1);
  assert.equal(v.x,12);
  assert.ok(v.z < -7.2 && v.z > -7.6);
  // Directional lift and fast-fall cushioning both act on this descent.
  assert.ok(v.y > -3.4 && v.y < -2.9);
});

test('reference gas boost cushions only sufficiently fast descent',()=>{
  const fast=V(0,-35,0),slow=V(0,-3,0);
  applyDirectionalGasBoost(fast,0,0,0,0,.1,{acceleration:0,gravity:0});
  applyDirectionalGasBoost(slow,0,0,0,0,.1,{acceleration:0,gravity:0});
  assert.equal(fast.y,-30);
  assert.equal(slow.y,-3);
});
