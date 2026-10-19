import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSpatialColliderIndex} from '../src/spatial-collider-index.js';
import {createVoxelWorld} from '../src/voxel-city.js';
import {createTitanPlayer} from '../src/titan-player.js';
import {classifyTitanVertex} from '../src/titan-glb-models.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const overlap=(c,x,z,r)=>Math.abs(x-c.x)<=c.halfW+r&&Math.abs(z-c.z)<=c.halfD+r;
const seed=()=>[{x:0,z:0,halfW:3,halfD:3,h:10},
  {x:25,z:-40,halfW:3,halfD:5,h:16},
  {x:90,z:20,halfW:31,halfD:2,h:40},
  {x:-100,z:0,halfW:1.5,halfD:100,h:70}];

test('spatial collision index covers every overlapping building and long wall',()=>{
 const items=seed(),index=createSpatialColliderIndex(items,24);
 assert.equal(index.count,items.length);
 assert.ok(index.cellCount>4);
 for(let x=-140;x<=140;x+=7)for(let z=-120;z<=120;z+=7){
   const nearby=index.query(x,z,4);
   const brute=items.filter(c=>overlap(c,x,z,4));
   assert.equal(nearby.length,brute.length, 'must preserve exact collision candidate set');
   assert.deepEqual(new Set(nearby),new Set(brute));
 }
 items.splice(0,1);
 index.rebuild(items);
 assert.equal(index.query(0,0,2).length,0);
 assert.throws(()=>createSpatialColliderIndex([],0),/positive/);
});

test('indexed voxel city raycasts preserve nearest hits at close and long range',()=>{
 const scene=new THREE.Scene(),world=createVoxelWorld(scene);
 assert.equal(typeof world.nearbyColliders,'function');
 const center=world.colliders.find(c=>c.h>10);
 assert.ok(center);
 const origin=V(center.x,center.h*.58,center.z+19),direction=V(0,0,-1);
 const rayHit=world.grappleRay(origin,direction,50);
 assert.ok(rayHit,'raycast should hit nearby structure');
 const ray=new THREE.Ray(origin,direction);
 let nearest=Infinity;
 const box=new THREE.Box3(),hit=V();
 for(const c of world.colliders){
   box.min.set(c.x-c.halfW,0,c.z-c.halfD);
   box.max.set(c.x+c.halfW,c.h,c.z+c.halfD);
   const point=ray.intersectBox(box,hit);
   if(!point)continue;
   const distance=origin.distanceTo(point);
   if(distance>.2&&distance<nearest)nearest=distance;
 }
 assert.ok(Number.isFinite(nearest));
 assert.ok(Math.abs(origin.distanceTo(rayHit)-nearest)<1e-6);
 assert.ok(world.nearbyColliders(V(center.x,0,center.z),2).length>0);
});

test('destruction and reset update collision broadphase without stale locations',()=>{
 const world=createVoxelWorld(new THREE.Scene());
 const box=world.colliders.find(c=>c.h>12&&c.halfW<12&&c.halfD<12);
 assert.ok(box);
 const p=V(box.x,10,box.z);
 const before=world.nearbyColliders(p,0).includes(box);
 assert.equal(before,true);
 world.damageStructures(p,15,{height:15});
 assert.equal(world.colliders.includes(box),false);
 assert.equal(world.nearbyColliders(p,0).includes(box),false);
 world.resetDestruction();
 assert.equal(world.nearbyColliders(p,0).includes(box),true);
});

test('Titan update uses nearby colliders rather than scanning full world array',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const world={terrainHeight:()=>0,
   colliders:new Proxy([], {get(target,key){if(key===Symbol.iterator)throw Error('full collider iteration in Titan update');return Reflect.get(target,key);}}),
   nearbyColliders:(position,radius)=>{assert.ok(radius>=2);return [];},
   damageStructures:()=>({pieces:0,colliders:0})};
 const titan=createTitanPlayer(scene,world,camera,{enemies:[]});
 titan.choose('jaw',V());
 for(let i=0;i<50;i++)titan.update(1/240,{keys:new Set(['KeyW','ShiftLeft']),jumpQueued:false},i/240);
 assert.ok(titan.position.length()>0);
 titan.dispose();
});

test('allocation-free GLB skin preparation remains consistent with public vertex classifier',()=>{
 for(let y=0;y<=1.001;y+=.03125)for(let x=-.6;x<=.601;x+=.047){
  const picks=classifyTitanVertex(x,y,0),left=x<0;
  let first=1,second=0,blend=0;
  if(y>.83&&Math.abs(x)<.21)first=6;
  else if(y>.54&&Math.abs(x)<.23)first=1;
  else if(y>.53&&Math.abs(x)>.23){first=left?2:4;second=left?3:5;blend=Math.max(0,Math.min(1,(.64-y)/.13));}
  else if(y<=.54){first=left?7:9;second=left?8:10;blend=Math.max(0,Math.min(1,(.38-y)/.14));}
  assert.equal(picks[0][0],first);
  assert.ok(Math.abs(picks[0][1]-(1-blend))<1e-10);
  if(blend>0)assert.ok(picks.length===2&&picks[1][0]===second);
 }
});
