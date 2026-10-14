import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVoxelWorld} from '../src/voxel-city.js';
import {createPlayer} from '../src/player.js';

test('voxel city generates batched buildings, walls and six usable beacons',()=>{
  const scene=new THREE.Scene(),world=createVoxelWorld(scene);
  assert.equal(world.style,'voxel');
  assert.ok(world.stats.houses>35,'city should have multiple dense districts');
  assert.ok(world.stats.mountainColumns>900,'rocky valley should surround the town');
  assert.ok(world.stats.landmarks.includes('castle'),'reference landmark pass should be active');
  assert.ok(world.stats.instances>1500,'buildings should contain voxel details');
  assert.ok(world.stats.drawMeshes<350,'city should use batching rather than per-cube draws');
  assert.ok(world.colliders.length>50,'colliders must match the city buildings');
  assert.equal(world.beacons.length,6);
  assert.ok(world.anchors.length>120);
  assert.ok(scene.children.some(c=>c.isInstancedMesh),'rendering requires voxel instances');
  assert.ok(scene.children.some(c=>c.isDirectionalLight),'city needs sunlight');
  assert.equal(world.spawnPoint.y,1);
});

test('voxel roofs accept grapple targeting and landing collisions',()=>{
  const scene=new THREE.Scene(),world=createVoxelWorld(scene);
  const c=world.colliders[0],above=new THREE.Vector3(c.x,c.h+20,c.z);
  const hit=world.grappleRay(above,new THREE.Vector3(0,-1,0),40);
  assert.ok(hit,'a cable aimed at a roof should hit the model');
  assert.ok(hit.y<=above.y&&hit.y>=0);
  const pos=new THREE.Vector3(c.x,c.h+.25,c.z);
  const prev=new THREE.Vector3(c.x,c.h+2,c.z);
  const speed=new THREE.Vector3(0,-8,0);
  assert.equal(world.resolveCollision(pos,prev,speed),true);
  assert.ok(pos.y>=c.h+1);
  assert.equal(speed.y,0);
});

test('player avatar remains attached to the active voxel scene',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const world=createVoxelWorld(scene);
  const player=createPlayer(scene,world,camera);
  assert.ok(scene.children.includes(player.model.root),'player root is in the world scene');
  assert.ok(player.model.root.visible,'third person avatar is visible');
  assert.ok(player.position.distanceTo(world.spawnPoint)<.001);
  const input={keys:new Set(['KeyW']),jumpQueued:false};
  for(let i=0;i<40;i++)player.update(.01,input,i*.01);
  player.updateCamera(.016);
  assert.ok(player.position.toArray().every(Number.isFinite));
  assert.ok(scene.children.includes(player.model.root));
});
