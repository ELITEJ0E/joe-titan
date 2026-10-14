import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {REFERENCE_COMBAT,createBullet,stepBullet,parryBullet,pickupAvailable,encodeScoutState,segmentNapeHealth,napeHit} from '../src/reference-combat.js';
import {createEnemySimulation,strikeWeakPoint} from '../src/enemies.js';
import {createPlayer} from '../src/player.js';
import {BOULDER,createTitanProjectiles} from '../src/titan-projectiles.js';
import {createSupplyDrops} from '../src/supplies.js';
import {createRangedCombat} from '../src/ranged-combat.js';
import {remoteTarget,smoothFactor,MAX_EXTRAPOLATION} from '../src/network-interpolation.js';
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
 const p=V(10,e.height*.82,7),d=V(0,0,-1);
 const shallow=strikeWeakPoint(e,p,d,25,10);
 assert.equal(shallow.kind,'shallow');
 const deep=strikeWeakPoint(e,p,d,45,10);
 assert.equal(deep.kind,'napecrack');
 assert.equal(e.napeHP,2);
});

test('armored Titan grab requires seven unique escape inputs and freezes pilot',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const world={resolveCollision:()=>true,grappleRay:()=>null,spawnPoint:V(0,1,0)};
 const player=createPlayer(scene,world,camera);
 assert.equal(player.grab(),true);
 const p=player.position.clone();
 player.update(.05,{keys:new Set(['KeyW']),jumpQueued:false},0);
 assert.deepEqual(player.position.toArray(),p.toArray());
 for(let i=1;i<7;i++){
   const result=player.escapeGrab();
   assert.equal(result.active,true);
   assert.equal(result.remaining,7-i);
 }
 assert.equal(player.escapeGrab().active,false);
 assert.equal(player.grabbed,false);
});
test('Armored attack initiates zero-damage grab',()=>{
 const sim=createEnemySimulation([{type:'armored',position:[0,0,0],patrol:[0,0,0]}]);
 const result=sim.update(.1,V(1,1,1));
 assert.equal(result.grab,true);
 assert.equal(result.damage,0);
});
test('Beast boulder launches at measured speed and disappears on world collision',()=>{
 const scene=new THREE.Scene(),world={grappleRay:()=>null};
 const manager=createTitanProjectiles(scene,world);
 assert.equal(BOULDER.speed,22);
 assert.equal(BOULDER.gravity,4);
 assert.equal(manager.throwBoulder(V(0,15,0),V(30,1,0)),true);
 assert.equal(manager.count,1);
 manager.update(.1,V(100,1,100));
 assert.equal(manager.count,1);
 manager.reset();
 assert.equal(manager.count,0);
});
test('collectible supplies grant source-measured amounts and two blade charges',()=>{
 const scene=new THREE.Scene();
 const supplies=createSupplyDrops(scene,{terrainHeight:()=>0});
 const hit=supplies.drops.find(d=>d.type==='blades');
 const increments=[];
 const player={position:hit.position.clone(),refillGas:(n)=>increments.push(['gas',n]),
   heal:(n)=>increments.push(['health',n]),refillBlades:(n)=>increments.push(['blades',n])};
 assert.equal(supplies.update(.05,0,player),'blades');
 assert.deepEqual(increments,[['blades',2]]);
 assert.equal(supplies.update(.05,.05,player),null);
});

test('remote physics packets interpolate smoothly and extrapolate for no more than 120ms',()=>{
 const state={x:0,y:0,z:0,physics:{p:[10,20,-30],v:[20,-5,10]}};
 assert.deepEqual(remoteTarget(state,0),[10,20,-30]);
 assert.deepEqual(remoteTarget(state,.1),[12,19.5,-29]);
 const capped=remoteTarget(state,1);
 assert.ok(Math.abs(capped[0]-(10+20*MAX_EXTRAPOLATION))<1e-9);
 assert.ok(smoothFactor(1/60)>0&&smoothFactor(1/60)<1);
 assert.equal(smoothFactor(0),0);
});

test('live scout pistol enforces fire cadence, eight-round magazine and timed reload',()=>{
 const scene=new THREE.Scene(),world={grappleRay:()=>null};
 const ranged=createRangedCombat(scene,world,{enemies:[]});
 const p=V(0,10,0),dir=V(1,0,0);
 assert.equal(ranged.fire(p,dir),true);
 assert.equal(ranged.ammo,7);
 assert.equal(ranged.fire(p,dir),false,'cooldown prevents immediate second shot');
 for(let i=0;i<7;i++){
   ranged.update(.29);
   assert.equal(ranged.fire(p,dir),true);
 }
 assert.equal(ranged.ammo,0);
 assert.ok(ranged.reload>0);
 assert.equal(ranged.fire(p,dir),false);
 ranged.update(1.6);
 assert.equal(ranged.ammo,8);
 assert.equal(ranged.fire(p,dir),true);
 ranged.reset();
 assert.equal(ranged.ammo,8);
});
