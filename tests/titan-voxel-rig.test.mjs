import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVoxelTitanRig,animateVoxelTitanRig,smoothVoxelJoint} from '../src/titan-voxel-rig.js';
import {createEnemySimulation,createEnemyManager} from '../src/enemies.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('voxel Titans have named joints, pixel-sharp markers and rear nape',()=>{
  const scene=new THREE.Scene();
  const enemy={id:'test',type:'armored',position:V(0,0,0),state:'patrol',speed:2.8,alive:true,stagger:0};
  const rig=createVoxelTitanRig(scene,enemy,{height:19,color:0xb89f88});
  assert.equal(rig.group.parent,scene);
  assert.equal(rig.head.name,'head');
  assert.equal(rig.torso.name,'torso');
  assert.equal(rig.arms.left.elbow.name,'left elbow');
  assert.equal(rig.legs.right.knee.name,'right knee');
  assert.equal(rig.weak.material.map.magFilter,THREE.NearestFilter);
  assert.equal(rig.alert.material.map.minFilter,THREE.NearestFilter);
  assert.ok(rig.weak.position.z>0,'nape must appear behind locally forward-facing model');
  assert.ok(rig.group.getObjectByName('armored breastplate'));
  assert.ok(rig.group.getObjectByName('foot')===undefined,'all feet are side-named for animation');
});

test('joint slerp and Titan action poses animate without affecting simulation',()=>{
  const scene=new THREE.Scene();
  const e={id:'runner',type:'runner',position:V(4,0,8),state:'windup',speed:5.1,alive:true,
    moving:1,stagger:0,attackPhase:'windup',armRight:0,armLeft:0};
  const rig=createVoxelTitanRig(scene,e,{height:12});
  smoothVoxelJoint(rig.head,.4,.3,.1,1/60);
  assert.ok(rig.head.quaternion.angleTo(new THREE.Quaternion())>0);
  const old=e.position.clone();
  animateVoxelTitanRig(rig,e,.05,.3);
  assert.equal(rig.alert.visible,true);
  assert.ok(rig.arms.right.shoulder.quaternion.angleTo(new THREE.Quaternion())>0);
  assert.deepEqual(e.position.toArray(),old.toArray(),'animation must not change authoritative physics');
  e.armLeft=12;animateVoxelTitanRig(rig,e,.05,.5);
  assert.equal(rig.arms.left.shoulder.visible,false);
  e.alive=false;
  for(let i=0;i<31;i++)animateVoxelTitanRig(rig,e,.05,1+i*.05);
  assert.equal(rig.group.visible,false,'death collapse completes before despawn');
});

test('Titan AI patrols between waypoints and telegraphs its attacks',()=>{
  const sim=createEnemySimulation([{type:'runner',position:[0,0,0],patrol:[15,0,0]}]);
  const e=sim.enemies[0],distant=V(200,0,200);
  for(let i=0;i<120;i++)sim.update(.05,distant);
  assert.ok(e.position.x>0);
  const near=e.position.clone().add(V(3,0,0));
  let tookDamage=false,sawWindup=false,sawLunge=false;
  for(let i=0;i<40;i++){
    const result=sim.update(.05,near);
    sawWindup ||= e.state==='windup';sawLunge ||= e.state==='lunge';
    tookDamage ||= result.damage>0;
  }
  assert.ok(sawWindup&&sawLunge,'attack must visibly prepare before damage');
  assert.ok(tookDamage,'attack resolves if target remains in range');
});

test('manager exposes visual bones without relying on group child indices',()=>{
  const manager=createEnemyManager(new THREE.Scene(),{grappleRay:()=>null});
  assert.ok(manager.enemies.every(e=>e.rig&&e.rig.arms.left&&e.rig.legs.right));
  const target=manager.enemies[0];
  target.armLeft=2;
  manager.update(.05,V(150,0,150),0);
  assert.equal(target.rig.arms.left.shoulder.visible,false);
  manager.reset();
  assert.equal(target.rig.arms.left.shoulder.visible,true);
});
