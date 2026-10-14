import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {REFERENCE_COMBAT,createBullet,stepBullet,parryBullet,pickupAvailable,encodeScoutState,segmentNapeHealth,napeHit} from '../src/reference-combat.js';
import {createEnemySimulation,strikeWeakPoint} from '../src/enemies.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
test('REA ballistics: bullet speed, gravity, life and cooldown',()=>{
  assert.equal(REFERENCE_COMBAT.bulletSpeed,110);
  assert.equal(REFERENCE_COMBAT.bulletGravity,4);
  assert.equal(REFERENCE_COMBAT.bulletLife,1.4);
  assert.equal(REFERENCE_COMBAT.bulletDamage,30);
  assert.equal(REFERENCE_COMBAT.shotCooldown,.28);
  const bullet=createBullet(V(0,2,0),V(0,0,-1));
  stepBullet(bullet,.1);
  assert.equal(bullet.position.z,-11);
  assert.equal(bullet.velocity.y,-.4);
});
test('slash and spin parry windows are distinct',()=>{
  const a=createBullet(V(0,0,0),V(1,0,0));
  assert.equal(parryBullet(a,V(1,0,0),.29),true);
  assert.equal(a.velocity.x,-110);
  assert.equal(parryBullet(a,V(1,0,0),.31,.59),true);
  assert.equal(parryBullet(a,V(1,0,0),.31,.61),false);
});
test('fuel pickup obeys 3.6 horizontal and 3.4 vertical limits',()=>{
  assert.equal(pickupAvailable({position:V(0,0,0)},{position:V(3.5,3.3,0)}),true);
  assert.equal(pickupAvailable({position:V(0,0,0)},{position:V(3.7,0,0)}),false);
  assert.equal(pickupAvailable({position:V(0,0,0)},{position:V(0,3.5,0)}),false);
});
test('multiplayer compact state rounds position, velocity and hooks',()=>{
 const player={position:V(1.2345,3.5678,-9.8765),velocity:V(12.1111,0,-1.999),
 hooks:[{point:V(4.444,9.999,10.105),length:14.456},null],grounded:false,boost:true};
 const data=encodeScoutState(player);
 assert.deepEqual(data.p,[1.23,3.57,-9.88]);
 assert.deepEqual(data.v,[12.11,0,-2]);
 assert.deepEqual(data.a[0],{p:[4.44,10,10.11],l:14.46});
 assert.equal(data.f,2);
});
test('segmented nape accepts only deep cuts and stagger on crack',()=>{
 assert.equal(segmentNapeHealth(250),3);
 assert.equal(napeHit({hp:250,napeHP:3,shifter:true,deep:false}).kind,'shallow');
 const crack=napeHit({hp:250,napeHP:3,shifter:true,deep:true});
 assert.deepEqual({kind:crack.kind,hp:crack.hp,napeHP:crack.napeHP},{kind:'napecrack',hp:200,napeHP:2});
 assert.equal(napeHit({hp:100,napeHP:1,shifter:true,deep:true}).kind,'kill');
 assert.equal(napeHit({hp:100,napeHP:1,shifter:true,deep:true,armor:true}).kind,'armor');
});
test('new shifter Titan variants have multiple nape segments',()=>{
 const sim=createEnemySimulation([{type:'armored',position:[0,0,0]},{type:'beast',position:[10,0,0]}]);
 assert.equal(sim.enemies[0].shifter,true);
 assert.ok(sim.enemies[0].napeHP>=3);
 const e=sim.enemies[1];e.forward.set(0,0,-1);
 const p=V(10,e.height*.82,-7),d=V(0,0,1);
 const shallow=strikeWeakPoint(e,p,d,25,10);
 assert.equal(shallow.kind,'shallow');
 const deep=strikeWeakPoint(e,p,d,45,10);
 assert.equal(deep.kind,'napecrack');
 assert.equal(e.napeHP,2);
});
