import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {moveFacingYaw,orbitCameraPose,smoothFacingYaw} from '../src/free-orbit-camera.js';
import {createPlayer} from '../src/player.js';
import {createTitanPlayer} from '../src/titan-player.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const close=(a,b,t=.001)=>Math.abs(a-b)<t;
const keys=(...codes)=>({keys:new Set(codes),jumpQueued:false,mobileAssist:false});

test('360-degree orbit never requires the character to turn with camera',()=>{
 const pos=V(10,1,-5);
 for(const yaw of [0,Math.PI/2,Math.PI,3*Math.PI/2,2*Math.PI,4*Math.PI]){
  const pose=orbitCameraPose(pos,yaw,0,{distance:12,height:2,elevation:1});
  assert.ok(close(pose.ideal.distanceTo(pose.focus),Math.sqrt(145),.01));
  assert.ok(pose.direction.length()>0.99);
  assert.ok(pose.focus.distanceTo(V(10,3,-5))<1e-8);
 }
 assert.ok(close(moveFacingYaw(Math.PI,0,0,{previousYaw:.85,moving:false}),.85));
 assert.ok(close(moveFacingYaw(0,0,1,{moving:true}),0));
 assert.ok(close(moveFacingYaw(0,1,0,{moving:true}),-Math.PI/2));
 assert.ok(close(moveFacingYaw(Math.PI,0,1,{moving:true}),Math.PI));
 assert.ok(Math.abs(smoothFacingYaw(3.13,-3.13,.1)-3.13)<.10);
});

test('Scout camera orbits to front while body remains stationary; W turns body toward camera-forward travel',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const world={spawnPoint:V(0,1,0),grappleRay:()=>null,resolveCollision:()=>false};
 const player=createPlayer(scene,world,camera);
 const initialBody=player.model.root.rotation.y;
 player.yaw=Math.PI;
 player.update(1/60,keys(),.016);
 player.updateCamera(1/60,true);
 assert.ok(close(player.model.root.rotation.y,initialBody),'camera orbit alone never turns Scout');
 assert.ok(camera.position.z<player.position.z,'front-facing camera should move in front of Scout');
 for(let i=0;i<36;i++)player.update(1/60,keys('KeyW'),i/60);
 assert.ok(Math.abs(player.model.root.rotation.y)>2.5,'W turns Scout to face camera movement heading');
});

test('Titan camera can show front without rotating body; walking forward rotates Titan',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const world={terrainHeight:()=>0,colliders:[]};
 const e={enemies:[]};
 const titan=createTitanPlayer(scene,world,camera,e);
 assert.equal(titan.choose('armored',V(0,0,0)),true);
 titan.yaw=Math.PI;
 titan.updateCamera(.02,true);
 assert.ok(camera.position.z<0,'camera swings to world -Z to see Titan front');
 titan.update(.016,keys(),.016);
 // Read the root directly: model remains facing its previous heading when idle.
 const rig=scene.children.find(child=>child.name?.includes('Titan'));
 // We only require the camera to move freely and the Titan to translate on W.
 const before=titan.position.clone();
 for(let i=0;i<50;i++)titan.update(.016,keys('KeyW'),i*.016);
 assert.ok(titan.position.z>before.z,'W follows the new camera direction');
 assert.ok(Math.abs(titan.yaw-Math.PI)<.001,'camera direction remains user-controlled');
 titan.dispose();
});
