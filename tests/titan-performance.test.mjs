import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {preparedTitanVisual,disposeTitanGLBVisual} from '../src/titan-glb-models.js';
import {titanRenderBudget,applyTitanRenderBudget} from '../src/titan-render-budget.js';
import {createFrameBudgetController} from '../src/adaptive-frame-budget.js';
import {createTitanPlayer} from '../src/titan-player.js';
import {readFileSync} from 'node:fs';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

test('GLB preparation shares one GPU geometry between identical Titans but not their Skeletons',()=>{
 const source=new THREE.Group();
 source.add(new THREE.Mesh(new THREE.BoxGeometry(.9,1.8,.5),new THREE.MeshStandardMaterial({color:0xccbbaa})));
 const gltf={scene:source};
 const a=preparedTitanVisual(gltf,'perf-test-demo');
 const b=preparedTitanVisual(gltf,'perf-test-demo');
 const amesh=a.pivot.children.find(c=>c.isSkinnedMesh);
 const bmesh=b.pivot.children.find(c=>c.isSkinnedMesh);
 assert.ok(amesh&&bmesh);
 assert.notEqual(a.pivot,b.pivot);
 assert.equal(amesh.geometry,bmesh.geometry,'GPU vertex/index buffers shared');
 assert.equal(amesh.material,bmesh.material,'unchanged skin material shared');
 assert.notEqual(amesh.skeleton,bmesh.skeleton,'independent bones and GPU skinning per Titan');
 assert.notEqual(a.bones.leftLeg,b.bones.leftLeg);
 a.bones.leftLeg.rotation.x=.6;
 assert.notEqual(a.bones.leftLeg.rotation.x,b.bones.leftLeg.rotation.x);
 assert.equal(amesh.frustumCulled,true);
 assert.ok(amesh.boundingSphere.radius>=1.4,'conservative animation bounds');
 disposeTitanGLBVisual({modelSkeleton:a});
 disposeTitanGLBVisual({modelSkeleton:b});
});

test('near Titans show full model, distant Titans use compact fallback and stop casting shadows',()=>{
 const near=titanRenderBudget(35,15,{previous:'low'});
 const far=titanRenderBudget(190,15,{previous:'high'});
 const hidden=titanRenderBudget(440,15,{previous:'low'});
 assert.equal(near.lod,'high');assert.equal(near.shadow,true);
 assert.equal(far.lod,'low');assert.equal(far.shadow,false);
 assert.equal(hidden.lod,'hidden');
 assert.ok(far.interval>near.interval*2);
 assert.equal(titanRenderBudget(500,60,{human:true}).lod,'high');
 const group=new THREE.Group();
 const fallback=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
 fallback.name='head block';
 const detail=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
 detail.name='detail / skin';
 group.add(fallback,detail);
 const modelVisual=new THREE.Group();
 const skinned=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
 modelVisual.add(skinned);group.add(modelVisual);
 const rig={group,fallbackMeshes:[fallback,detail],modelStatus:'loaded',modelVisual,death:0};
 applyTitanRenderBudget(rig,near);
 assert.equal(modelVisual.visible,true);assert.equal(fallback.visible,false);
 assert.equal(skinned.castShadow,true);
 applyTitanRenderBudget(rig,far);
 assert.equal(modelVisual.visible,false);assert.equal(fallback.visible,true);
 assert.equal(detail.visible,false);assert.equal(fallback.castShadow,false);
 applyTitanRenderBudget(rig,hidden);
 assert.equal(group.visible,false);
 applyTitanRenderBudget(rig,near);
 assert.equal(group.visible,true);
});

test('adaptive render scale falls only on sustained low frame rate, recovers slowly',()=>{
 const adaptive=createFrameBudgetController({windowSeconds:2.5});
 for(let i=0;i<150;i++)adaptive.update(1/60);
 assert.equal(adaptive.scale,1);
 for(let i=0;i<84;i++)adaptive.update(1/28);
 assert.ok(adaptive.scale<1,'downshift for sustained 28 FPS');
 const low=adaptive.scale;
 for(let i=0;i<360;i++)adaptive.update(1/60);
 assert.ok(adaptive.scale>low,'restore render detail when stable');
 for(let i=0;i<1500;i++)adaptive.update(1/18);
 assert.ok(adaptive.scale>=.59,'minimum resolution bound');
 adaptive.reset();
 assert.equal(adaptive.scale,1);
});

test('player Titan visual updates are separated from 240Hz gameplay physics',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const world={terrainHeight:()=>0,colliders:[],damageStructures:()=>({pieces:0})};
 const t=createTitanPlayer(scene,world,camera,{enemies:[]});
 t.choose('colossal',V(0,0,0));
 assert.equal(t.special().ok,true);
 assert.equal(t.explosionCount,1);
 const input={keys:new Set(),jumpQueued:false};
 for(let i=0;i<240;i++)t.update(1/240,input,i/240);
 assert.equal(t.explosionCount,1,'physics alone does not age/render explosion');
 for(let i=0;i<90;i++)t.renderUpdate(1/30,i/30);
 assert.equal(t.explosionCount,1);
 for(let i=90;i<180;i++)t.renderUpdate(1/30,i/30);
 assert.equal(t.explosionCount,0);
 t.dispose();
});

test('optimizations preserve AI update and throttle repeated wall-impact scans',()=>{
 const titan=readFileSync(new URL('../src/titan-player.js',import.meta.url),'utf8');
 const ai=readFileSync(new URL('../src/enemies.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.ok(ai.includes("const result=simulation.update(dt,playerPosition"));
 assert.ok(ai.includes("rig.modelStatus==='deferred'"));
 assert.ok(ai.includes("rig.poseAccumulator>=budget.interval"));
 assert.ok(titan.includes('impactCooldown=.72;'));
 assert.ok(titan.includes('function renderUpdate(dt,time)'));
 assert.ok(main.includes('titanPlayer.renderUpdate(dt,gameTime)'));
 assert.ok(main.includes('graphics.tickFrame(dt)'));
 assert.ok(main.includes('DRAW CALLS'));
});
