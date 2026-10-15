import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {blockAt,sunVisibility,cornerOcclusion,SHIGANSHINA_SUN} from '../src/voxel-illumination.js';
import {VISUAL_PRESETS,createShiganshinaVisuals} from '../src/shiganshina-visuals.js';

function grid(nx=12,ny=12,nz=12){
 return {nx,ny,nz,voxel:new Uint8Array(nx*ny*nz),colors:Array(32).fill('#888888')};
}
function set(asset,x,y,z,type=2){asset.voxel[(x*asset.ny+y)*asset.nz+z]=type;}

test('baked sunlight dims an occluded upward-facing block, not a clear sky block',()=>{
 const a=grid();
 assert.equal(blockAt(a,-2,4,3),0);
 assert.equal(sunVisibility(a,[4.5,1,4.5],3),1);
 set(a,3,2,3);
 assert.ok(sunVisibility(a,[4.5,1,4.5],3)<.5);
 assert.equal(sunVisibility(a,[4.5,1,4.5],2),1);
});

test('corners gain AO only from neighboring Minecraft blocks',()=>{
 const a=grid(),p=[4,1,4];
 assert.equal(cornerOcclusion(a,p,3,0),1);
 set(a,3,1,4);
 const one=cornerOcclusion(a,p,3,0);
 assert.ok(one<1);
 set(a,4,1,3);
 assert.equal(cornerOcclusion(a,p,3,0),.52);
});

test('palette and sunlight reference agree with the Shiganshina visual direction',()=>{
 assert.ok(SHIGANSHINA_SUN.y>0);
 assert.ok(SHIGANSHINA_SUN.x<0);
 assert.ok(VISUAL_PRESETS.cinematic.sunShadow>VISUAL_PRESETS.performance.sunShadow);
 assert.ok(VISUAL_PRESETS.cinematic.fogFar>300,'distant wall must not disappear in heavy haze');
});

test('Minecraft surface shader consumes pre-baked AO and sunlight attributes',()=>{
 const prior=globalThis.document;
 globalThis.document={createElement:()=>({width:256,height:128,getContext:()=>({fillRect(){},fillStyle:''})})};
 try{
  const scene=new THREE.Scene(),colors=Array(32).fill('#888888');
  const visual=createShiganshinaVisuals(scene,colors,'cinematic');
  assert.ok(visual.material.vertexShader.includes('aShadow'));
  assert.ok(visual.material.vertexShader.includes('aAO'));
  assert.ok(visual.material.fragmentShader.includes('vShadow'));
  assert.ok(visual.material.fragmentShader.includes('vAO'));
  assert.equal(visual.material.uniforms.uSunShadow.value,1);
  visual.setQuality('performance');
  assert.equal(visual.material.uniforms.uSunShadow.value,VISUAL_PRESETS.performance.sunShadow);
 }finally{globalThis.document=prior;}
});
