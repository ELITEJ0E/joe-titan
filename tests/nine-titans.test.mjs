import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TITAN_ORDER,TITAN_FORMS} from '../src/titan-forms.js';
import {createVoxelTitanRig,disposeVoxelTitanRig} from '../src/titan-voxel-rig.js';
import {createTitanPlayer} from '../src/titan-player.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
test('all nine Titan identities are complete and independently sculpted',()=>{
 assert.equal(TITAN_ORDER.length,9);
 const scene=new THREE.Scene();
 for(const id of TITAN_ORDER){
  const dummy={id,position:V(0,0,0),type:id,alive:true,state:'patrol',armLeft:0,armRight:0};
  const rig=createVoxelTitanRig(scene,dummy,{height:TITAN_FORMS[id].height,color:TITAN_FORMS[id].color});
  assert.equal(rig.variant,id);
  assert.ok(rig.detailMeshes.length>=3,id+' has faceted sculpt layers');
  assert.equal(rig.head.name,'head');
  assert.equal(rig.group.scale.x,TITAN_FORMS[id].height);
  if(id==='cart')assert.equal(rig.cart.legs.length,4);
  if(id==='founding')assert.ok(rig.detailMeshes.some(m=>m.count>35),'founding spine and rib arrays');
  disposeVoxelTitanRig(scene,rig);
 }
});
test('Titan shifter locomotion, attacks, ability cooldown and camera have stable data',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.1,1000);
 const world={terrainHeight:()=>0,colliders:[]};
 const enemy={id:'dummy',position:V(0,0,-6),alive:true,height:15,health:300,stagger:0};
 const t=createTitanPlayer(scene,world,camera,{enemies:[enemy]});
 assert.equal(t.choose('attack',V(0,0,0)),true);
 assert.equal(t.attack(),1);
 assert.ok(enemy.health<300);
 assert.ok(t.special().ok);
 assert.ok(t.cooldown>0);
 const input={keys:new Set(['KeyW']),jumpQueued:false};
 for(let i=0;i<30;i++)t.update(1/60,input,i/60);
 assert.ok(t.position.z<0);
 t.updateCamera(1,true);
 assert.ok(camera.position.distanceTo(t.position)>5);
 t.dispose();assert.equal(t.active,false);
});
test('Titan chooser rejects unknown forms',()=>{
 const t=createTitanPlayer(new THREE.Scene(),{},new THREE.PerspectiveCamera(),{enemies:[]});
 assert.equal(t.choose('unknown',V()),false);
});