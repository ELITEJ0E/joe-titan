import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createSpatialColliderIndex} from '../src/spatial-collider-index.js';
import {createVoxelWorld} from '../src/voxel-city.js';
import {createTitanBlastEffects} from '../src/titan-blast-effects.js';
import {titanRenderBudget} from '../src/titan-render-budget.js';
import {createEnemyManager} from '../src/enemies.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
test('spatial index returns same nearby colliders as brute scan with far fewer candidates',()=>{
 const boxes=[];
 for(let x=-15;x<=15;x++)for(let z=-15;z<=15;z++){
   boxes.push({x:x*20,z:z*20,halfW:6,halfD:7,h:15});
 }
 const index=createSpatialColliderIndex(boxes);
 assert.equal(index.count,boxes.length);
 for(const [x,z,r] of [[0,0,2.4],[31,-87,4],[-200,187,9],[318,-318,10],[0,0,65]]){
   const expected=boxes.filter(b=>Math.abs(x-b.x)<=b.halfW+r&&Math.abs(z-b.z)<=b.halfD+r);
   const result=index.query(x,z,r);
   assert.deepEqual(new Set(result),new Set(expected),'indexed broadphase must not omit edge collisions');
 }
 assert.ok(index.query(0,0,2.4).length<boxes.length/100,
  'ordinary per-frame physics must consider only local building footprints');
 boxes.splice(0,1);
 index.rebuild(boxes);
 assert.equal(index.count,boxes.length);
});

test('procedural world indexed collision still lands on roofs and removes/restores broken walls',()=>{
 const scene=new THREE.Scene(),world=createVoxelWorld(scene);
 const original=world.colliders.length;
 const first=world.colliders.find(c=>Math.abs(c.x+180)<.01);
 assert.ok(first);
 const position=V(first.x,first.h+.1,first.z),previous=V(first.x,first.h+2,first.z),velocity=V(0,-9,0);
 assert.ok(world.nearbyColliders(position,2).includes(first));
 assert.equal(world.resolveCollision(position,previous,velocity),true);
 const origin=V(first.x,15,first.z);
 const hit=world.grappleRay(origin.clone().add(V(0,40,0)),V(0,-1,0),100);
 assert.ok(hit,'indexed ray broadphase still detects the wall');
 const breakResult=world.damageStructures(origin,11,{height:7});
 assert.ok(breakResult.colliders>0);
 assert.ok(world.colliders.length<original);
 assert.ok(!world.nearbyColliders(origin,2).includes(first));
 world.resetDestruction();
 assert.equal(world.colliders.length,original);
 assert.ok(world.nearbyColliders(origin,2).includes(first));
});

test('Colossal mushroom explosion is instanced into a few GPU draw calls',()=>{
 const scene=new THREE.Scene(),fx=createTitanBlastEffects(scene);
 const blast=fx.spawn(V(0,0,0),{radius:43,height:86});
 assert.equal(blast.smoke.isInstancedMesh,true);
 assert.ok(blast.smoke.count>=45);
 assert.equal(blast.root.children.length,3,'one smoke instanced mesh + two shockwave rings');
 assert.ok(blast.smoke.instanceColor);
 fx.update(.5);
 assert.ok(blast.smoke.material.opacity>0);
 fx.update(5.3);
 assert.equal(fx.activeCount,0);
 assert.equal(scene.children.length,0);
 fx.dispose();
});

test('high-poly GLBs are preserved for close views but use voxel LOD sooner in the skyline',()=>{
 const close=titanRenderBudget(18,23,{previous:'high'});
 const distant=titanRenderBudget(145,23,{previous:'high'});
 assert.equal(close.lod,'high');
 assert.equal(distant.lod,'low');
 assert.equal(titanRenderBudget(10,15,{human:true}).lod,'high',
  'playable Titan always retains original full-detail GLB');
 assert.ok(titanRenderBudget(400,15).lod==='hidden');
});

test('entire Titan rigs get screen-frustum culled when out of camera view',()=>{
 const scene=new THREE.Scene(),world={grappleRay:()=>null,colliders:[]};
 const manager=createEnemyManager(scene,world);
 const camera=new THREE.PerspectiveCamera(62,1,.1,500);
 camera.position.set(0,20,160);camera.lookAt(0,10,0);camera.updateMatrixWorld();
 manager.cullOffscreen(camera);
 const forwardVisibility=manager.enemies.map(e=>e.group.visible);
 camera.lookAt(0,10,330);camera.updateMatrixWorld();
 const culled=manager.cullOffscreen(camera);
 const backVisibility=manager.enemies.map(e=>e.group.visible);
 assert.ok(culled>0);
 assert.notDeepEqual(forwardVisibility,backVisibility);
 assert.equal(backVisibility.filter(Boolean).length,0,'all six Titans are behind the camera');
});

test('debug metrics distinguish CPU script/render submission from measured GPU time',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const graphics=readFileSync(new URL('../src/graphics-quality.js',import.meta.url),'utf8');
 const glb=readFileSync(new URL('../src/titan-glb-models.js',import.meta.url),'utf8');
 assert.ok(main.includes('CPU GAME'));
 assert.ok(main.includes('RENDER SUBMIT'));
 assert.ok(main.includes('VISIBLE ENEMY GLBS'));
 assert.ok(main.includes('cullOffscreen'));
 assert.ok(graphics.includes('getAOEnabled'));
 assert.ok(graphics.includes('if(quality!==\'cinematic\'||coarse||struggling)aoPass.enabled=false'));
 assert.ok(!glb.includes('const picks=classifyTitanVertex(pos.getX(i)'));
 assert.ok(glb.includes('side:m.side??THREE.FrontSide'));
});
