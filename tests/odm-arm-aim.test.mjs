import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {aimODMArm} from '../src/odm-arm-aim.js';
import {createPlayer} from '../src/player.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('grappling arm follows its world-space anchor instead of fixed forward pose',()=>{
 const scene=new THREE.Scene();
 const root=new THREE.Group(),pivot=new THREE.Group(),arm=new THREE.Group();
 root.rotation.y=1.1;pivot.rotation.x=-.25;pivot.rotation.z=.15;
 scene.add(root);root.add(pivot);pivot.add(arm);arm.position.set(.45,.9,0);
 const anchor=V(6,16,-8);
 for(let i=0;i<60;i++)assert.ok(aimODMArm(arm,anchor,1/60));
 const downward=V(0,-1,0).applyQuaternion(arm.getWorldQuaternion(new THREE.Quaternion())).normalize();
 const target=anchor.clone().sub(arm.getWorldPosition(V(0,0,0))).normalize();
 assert.ok(downward.dot(target)>.99,'arm points toward hook in actual world direction');
});

test('the left and right arm independently target their own hooked anchors',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const world={spawnPoint:V(0,1,0),resolveCollision:()=>false,grappleRay:()=>null};
 const p=createPlayer(scene,world,camera),input={keys:new Set(),jumpQueued:false};
 p.hooks[0]={point:V(-18,25,-19),length:100,age:0};
 p.hooks[1]={point:V(23,31,-30),length:100,age:0};
 for(let i=0;i<120;i++)p.update(1/120,input,i/120);
 const a=p.model.arms.map(arm=>V(0,-1,0).applyQuaternion(arm.getWorldQuaternion(new THREE.Quaternion())).normalize());
 assert.ok(a[0].dot(a[1])<.99,'hooks demand distinct arm orientations');
});
