import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  FIRST_PERSON_CAMERA,firstPersonTargetFov,updateStableFirstPersonCamera
} from '../src/odm-first-person-camera.js';
import {createPlayer} from '../src/player.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const EPS=1e-7;
const cameraDirection=c=>c.getWorldDirection(new THREE.Vector3());

test('first-person center reticle follows yaw/pitch exactly during very fast translation',()=>{
  const camera=new THREE.PerspectiveCamera(72,1,.15,1600),p=V(0,30,0);
  const yaw=.8,pitch=-.4;
  const direction=V(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  for(const frame of [0,1,2,3,4,5]){
    p.set(frame*16,30+Math.sin(frame*2)*9,-frame*11);
    assert.equal(updateStableFirstPersonCamera(camera,p,direction,1/30,{speed:85,boosting:true}),true);
    assert.ok(camera.position.distanceTo(p.clone().add(V(0,1.3,0)))<EPS,
      'eye does not rubber-band behind physics at high speed');
    assert.ok(cameraDirection(camera).distanceTo(direction)<EPS,
      'the exact center ray remains on the selected crosshair direction');
  }
  assert.deepEqual(camera.up.toArray(),[0,1,0]);
});

test('first-person view has no body roll, bank-dependent drift or delayed mouse aim',()=>{
  const camera=new THREE.PerspectiveCamera(72,1,.15,1600);
  const p=V(6,18,-2),dir=V(.6,.1,-.8).normalize();
  camera.rotateZ(.9); // may carry over from a banking third-person camera
  updateStableFirstPersonCamera(camera,p,dir,.016,{snap:true});
  assert.ok(cameraDirection(camera).distanceTo(dir)<EPS);
  const projectedUp=V(0,1,0).addScaledVector(dir,-V(0,1,0).dot(dir)).normalize();
  const cameraUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  assert.ok(cameraUp.distanceTo(projectedUp)<EPS,'level world-up horizon');
  const newDir=V(-.7,-.21,-.69).normalize();
  updateStableFirstPersonCamera(camera,p,newDir,.001);
  assert.ok(cameraDirection(camera).distanceTo(newDir)<EPS,'new mouse input is not orientation-smoothed');
});

test('first-person flight zoom is restrained compared with cinematic third person',()=>{
  assert.equal(firstPersonTargetFov(0,false),72);
  assert.ok(firstPersonTargetFov(85,true)<=82);
  const camera=new THREE.PerspectiveCamera(105,1,.15,1600);
  updateStableFirstPersonCamera(camera,V(0,1,0),V(0,0,-1),.1,{snap:true,speed:85,boosting:true});
  assert.ok(camera.fov>72&&camera.fov<83);
  const before=camera.fov;
  updateStableFirstPersonCamera(camera,V(0,1,0),V(0,0,-1),.016,{speed:0,boosting:false});
  assert.ok(camera.fov<before&&camera.fov>FIRST_PERSON_CAMERA.baseFov);
});

test('integrated first-person ODM grapples from the same stabilized reticle ray',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,1,.15,1600);
  const rayCalls=[];
  const world={
    spawnPoint:V(0,1,0),resolveCollision:()=>false,
    grappleRay:(origin,direction,maxDist)=>{
      rayCalls.push({origin:origin.clone(),direction:direction.clone(),maxDist});
      return origin.clone().addScaledVector(direction,Math.min(45,maxDist));
    }
  };
  const p=createPlayer(scene,world,camera);
  p.firstPerson=true;
  for(let i=0;i<24;i++){
    p.yaw=i*.25;p.pitch=Math.sin(i*.4)*.65;
    p.position.set(i*5,13+i*.2,-i*6);
    p.velocity.set(47,12,-48);
    p.updateCamera(1/60);
    const direction=p.viewDirection();
    assert.ok(cameraDirection(camera).distanceTo(direction)<EPS);
    assert.ok(camera.position.distanceTo(p.position.clone().add(V(0,1.3,0)))<EPS);
  }
  rayCalls.length=0;
  assert.equal(p.fire(0),true);
  assert.ok(rayCalls.length>0);
  assert.ok(rayCalls[0].direction.distanceTo(cameraDirection(camera))<EPS,
    'left grapple fires along visible center reticle');
  assert.ok(p.hooks[0]&&p.hooks[0].point.distanceTo(camera.position)>40);
  p.release(0);
  p.firstPerson=false;
  assert.equal(p.model.root.visible,true);
  p.firstPerson=true;
  assert.equal(p.model.root.visible,false);
  assert.ok(cameraDirection(camera).distanceTo(p.viewDirection())<EPS);
});
