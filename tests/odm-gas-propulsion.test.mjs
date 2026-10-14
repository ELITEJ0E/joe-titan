import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {gasThrustDirection,allowBoostCablePayout} from '../src/odm-gas-propulsion.js';
import {solveTetherConstraints} from '../src/odm-physics.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('gas jet follows gaze even while WASD points elsewhere',()=>{
 const aimed=V(0,.2,-1).normalize();
 const thrust=gasThrustDirection(aimed,V(1,0,0));
 assert.ok(thrust.dot(aimed)>.98,'look direction must dominate the jet');
 assert.ok(thrust.x>0,'sideways WASD still bends thrust slightly');
 assert.ok(Math.abs(thrust.length()-1)<1e-10);
 assert.deepEqual(gasThrustDirection(V(0,0,-1),V(0,0,0)).toArray(),[0,0,-1]);
});
test('gas can extend a taut cable without teleporting its target or player',()=>{
 const p=V(0,10,0),anchor=V(0,12,-10),v=V(0,0,40);
 const initial=p.distanceTo(anchor),hook={point:anchor.clone(),length:initial};
 const paid=allowBoostCablePayout(p,v,[hook],.1,{boosting:true,gas:50});
 assert.ok(Math.abs(paid-2.4)<1e-9,'payout limited to 24 world units/s');
 assert.ok(Math.abs(hook.length-initial-2.4)<1e-9);
 assert.deepEqual(p.toArray(),[0,10,0]);
 assert.deepEqual(hook.point.toArray(),anchor.toArray());
});
test('no gas, no boost, slack cable and inward velocity must never pay out',()=>{
 const p=V(0,0,0),point=V(0,0,-10),hook={point,length:10};
 assert.equal(allowBoostCablePayout(p,V(0,0,30),[hook],.1,{boosting:true,gas:0}),0);
 assert.equal(allowBoostCablePayout(p,V(0,0,30),[hook],.1,{boosting:false,gas:100}),0);
 assert.equal(allowBoostCablePayout(p,V(0,0,-30),[hook],.1,{boosting:true,gas:100}),0);
 hook.length=20;
 assert.equal(allowBoostCablePayout(p,V(0,0,30),[hook],.1,{boosting:true,gas:100}),0);
});
test('look-driven acceleration keeps tangential momentum on hook constraint',()=>{
 const pos=V(0,12,0),hook={point:V(0,15,-20),length:pos.distanceTo(V(0,15,-20))};
 const v=V(12,0,-3),aim=gasThrustDirection(V(1,0,-1),V(0,0,0));
 v.addScaledVector(aim,36*.05);
 allowBoostCablePayout(pos,v,[hook],.05,{boosting:true,gas:50});
 const oldSpeed=v.length();
 pos.addScaledVector(v,.05);
 solveTetherConstraints(pos,v,[hook]);
 assert.ok(pos.distanceTo(hook.point)<=hook.length+.01);
 assert.ok(v.x>12,'jet keeps lateral forward acceleration');
 assert.ok(v.length()<=oldSpeed+.0001,'constraints cannot create speed');
});
