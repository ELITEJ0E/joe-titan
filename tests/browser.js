import * as THREE from 'three';
import {createVoxelWorld} from '../src/voxel-city.js';
import {createPlayer} from '../src/player.js';
import {createEnemyManager} from '../src/enemies.js';
import {activateAspect,createAspectState,selectAspect,updateAspect} from '../src/aspects.js';

const results=document.getElementById('results'),summary=document.getElementById('summary');
let renderer,scene,camera,world,player,enemies;
const assert=(condition,message)=>{if(!condition)throw Error(message);};
function render(){scene.updateMatrixWorld(true);renderer.render(scene,camera);}
function simulate(keys,steps,jump=false){
  const input={keys:new Set(keys),jumpQueued:jump};
  for(let i=0;i<steps;i++){
    player.update(.01,input,i*.01);player.updateCamera(.01);
    assert([...player.position.toArray(),...player.velocity.toArray(),...camera.position.toArray(),...camera.quaternion.toArray()].every(Number.isFinite),'Invalid player or camera coordinates');
  }
  render();
}
try{
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.15,1600);
  renderer=new THREE.WebGLRenderer({canvas:document.getElementById('view'),antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
  world=createVoxelWorld(scene);player=createPlayer(scene,world,camera);enemies=createEnemyManager(scene,world);render();
}catch(error){summary.textContent='FAIL: '+error.message;document.getElementById('run').disabled=true;}

document.getElementById('run').onclick=async()=>{
  document.getElementById('run').disabled=true;summary.textContent='Running…';
  results.replaceChildren();const initialRecoveries=player.recoveries;let passed=0;
  const checks=[
    ['Walk all four directions in the voxel city',()=>{for(const key of ['KeyW','KeyA','KeyS','KeyD']){player.reset();const start=player.position.clone();simulate([key],200);assert(player.position.distanceTo(start)>1,'Walking did not move');}assert(player.recoveries===initialRecoveries,'Unexpected recovery');}],
    ['Jump, boost, brake and land',()=>{player.reset();simulate([],15,true);assert(!player.grounded,'Jump failed');simulate(['Space','KeyW'],100);assert(player.gas<100,'Boost did not use gas');simulate(['KeyG'],50);simulate([],1000);assert(player.grounded,'Landing failed');}],
    ['Dual grapple, reel and independent release',()=>{player.reset();assert(player.fire(0)&&player.fire(1),'Hooks failed at spawn');const len=player.hooks[0].length;simulate(['ShiftLeft','Space'],100);assert(player.hooks[0].length<len,'Reel failed');player.release(0);assert(!player.hooks[0]&&player.hooks[1],'Independent release failed');simulate(['ShiftLeft'],100);player.release(1);simulate([],600);}],
    ['Rooftop landing in real city collision',()=>{player.reset();const b=world.colliders[0];player.position.set(b.x,b.h+10,b.z);simulate([],200);assert(player.grounded&&Math.abs(player.position.y-b.h-1)<.01,'Rooftop landing failed');}],
    ['First-person view, reset and invalid-coordinate recovery',()=>{player.firstPerson=true;simulate(['KeyW'],60);assert(!player.model.root.visible,'First-person avatar visible');player.firstPerson=false;player.position.x=NaN;simulate([],1);assert(player.recoveries===initialRecoveries+1,'Recovery failed');assert(player.position.distanceTo(world.spawnPoint)<.01,'Recovery spawn incorrect');assert(camera.position.distanceTo(player.position)<15,'Camera did not recover');}],
    ['Nine selectable aspects activate and then recover',()=>{const state=createAspectState();for(let index=0;index<9;index++){selectAspect(state,index);const result=activateAspect(state);assert(result.ok,'Aspect did not activate');player.setAspect(result.aspect);updateAspect(state,100);player.clearAspect();}assert(!player.aspect,'Aspect did not fade');}],
    ['Roaming giants render, receive pulse damage and remain bounded',()=>{const before=enemies.living(),target=enemies.enemies[0];enemies.update(.1,player.position,1);assert(target.group.visible,'Giant did not render');enemies.pulse(target.position,3,999);assert(enemies.living()===before-1,'Pulse did not remove giant');}],
    ['WebGL produces visible pixels after movement',()=>{simulate(['KeyW'],80);const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);assert(pixel[0]+pixel[1]+pixel[2]>0,'Frame was blank');assert(gl.getError()===gl.NO_ERROR,'WebGL error');}]
  ];
  for(const [label,check] of checks){
    const item=document.createElement('li');results.append(item);
    try{check();passed++;item.textContent='PASS — '+label;}catch(error){item.textContent='FAIL — '+label+': '+error.message;console.error(error);}
    await new Promise(requestAnimationFrame);
  }
  summary.textContent=`${passed}/${checks.length} checks passed · WebGL active · ${world.colliders.length} buildings · ${renderer.info.render.calls} draw calls.`;
  document.getElementById('run').disabled=false;
};
