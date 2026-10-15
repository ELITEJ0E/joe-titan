import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ATMOSPHERE_DEFAULTS,sampleCinematicAtmosphere,createSkyUniforms,updateSkyUniforms,
  CINEMATIC_SKY_FRAGMENT
} from '../src/cinematic-atmosphere.js';
import {createShiganshinaVisuals,VISUAL_PRESETS} from '../src/shiganshina-visuals.js';
import {createVoxelWorld} from '../src/voxel-city.js';

test('daylight atmosphere is finite, coherent and responds to storm and rain',()=>{
 const clear=sampleCinematicAtmosphere();
 const storm=sampleCinematicAtmosphere({stormAmount:1,weather:'rain'});
 assert.ok(clear.sunlight>storm.sunlight);
 assert.ok(clear.sunDirection.length()>0.99);
 assert.ok(storm.fogStrength>clear.fogStrength);
 assert.ok(storm.wetness>clear.wetness);
 assert.ok(clear.sunColor instanceof THREE.Color);
 assert.ok(clear.zenith instanceof THREE.Color);
 assert.ok(CINEMATIC_SKY_FRAGMENT.includes('uHorizon'));
 assert.ok(CINEMATIC_SKY_FRAGMENT.includes('uSunColor'));
 const dawn=sampleCinematicAtmosphere({timeOfDay:.04});
 assert.ok(dawn.sunStrength<clear.sunStrength);
 assert.deepEqual(ATMOSPHERE_DEFAULTS.weather,'clear');
});
test('sky and terrain can reuse one sun direction and palette without shader rebuilds',()=>{
 const sample=sampleCinematicAtmosphere(),u=createSkyUniforms(sample);
 const original=u.uSunDir.value;
 const storm=sampleCinematicAtmosphere({stormAmount:.8});
 updateSkyUniforms(u,storm,16,1.2);
 assert.equal(u.uSunDir.value,original,'reuse uniform vector rather than reallocating shaders');
 assert.equal(u.uTime.value,16);
 assert.ok(u.uHorizon.value.equals(storm.horizon));
});
test('imported voxel atlas remains pixel sharp and water receives separate transparent shading',()=>{
 const previous=globalThis.document;
 const canvas={width:0,height:0,getContext:()=>({fillRect(){},fillStyle:''})};
 globalThis.document={createElement:()=>canvas};
 try{
  const scene=new THREE.Scene(),colors=Array(32).fill('#888888');
  const visual=createShiganshinaVisuals(scene,colors,'performance');
  assert.equal(visual.atlas.minFilter,THREE.NearestFilter);
  assert.equal(visual.atlas.magFilter,THREE.NearestFilter);
  assert.equal(visual.atlas.generateMipmaps,false);
  assert.equal(visual.waterMaterial.transparent,true);
  assert.equal(visual.waterMaterial.depthWrite,false);
  assert.equal(visual.waterMaterial.uniforms.uSunDir,visual.material.uniforms.uSunDir);
  for(const token of ['uWetness','uFogStrength','uHorizonTint','vAO','vShadow','uTime']){
   assert.ok(visual.material.fragmentShader.includes(token),token);
  }
  assert.ok(visual.material.vertexShader.includes('w.y+=.095'));
  const count=scene.children.length;
  visual.setAtmosphere({stormAmount:.85,weather:'rain'});
  visual.animate(2);
  assert.ok(visual.material.uniforms.uWetness.value>.4);
  assert.ok(scene.fog.color.equals(visual.material.uniforms.uFogColor.value));
  assert.ok(visual.sky.material.uniforms.uSunDir.value.equals(visual.material.uniforms.uSunDir.value));
  visual.setMenuClarity(true);
  assert.ok(visual.material.uniforms.uFogFar.value>500);
  visual.setQuality('cinematic');visual.animate(3);
  assert.equal(visual.sun.shadow.mapSize.x,VISUAL_PRESETS.cinematic.shadowMap);
  assert.equal(scene.children.length,count,'uniform updates and preset switches may not create meshes');
 }finally{globalThis.document=previous;}
});
test('procedural fallback shares sky/fog/sun state without extra render-pass allocations',()=>{
 const scene=new THREE.Scene(),world=createVoxelWorld(scene);
 assert.equal(typeof world.setAtmosphere,'function');
 const sky=scene.getObjectByName('Voxel atmospheric sky');
 assert.ok(sky);
 const children=scene.children.length;
 world.setAtmosphere({timeOfDay:.24,weather:'rain',stormAmount:.65});
 world.animate(1,.016);
 assert.ok(scene.fog.color instanceof THREE.Color);
 assert.ok(sky.material.uniforms.uSunStrength.value<=1);
 assert.ok(sky.material.uniforms.uCloudOpacity.value>.20);
 assert.equal(scene.children.length,children);
 world.setMenuClarity(true);
 const menuFog=scene.fog.density;
 world.setMenuClarity(false);
 assert.ok(scene.fog.density>menuFog);
});
