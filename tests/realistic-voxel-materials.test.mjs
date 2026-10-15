import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVoxelSurfaceAtlas,makeVoxelNormalTile,makeVoxelPBRMaterial,
  roughnessForTile,surfaceHeight} from '../src/voxel-surface-detail.js';
import {CINEMATIC_SKY_FRAGMENT,createSkyUniforms,sampleCinematicAtmosphere}
  from '../src/cinematic-atmosphere.js';
import {createShiganshinaVisuals,VISUAL_PRESETS} from '../src/shiganshina-visuals.js';
import {createVoxelWorld} from '../src/voxel-city.js';
import {readFileSync} from 'node:fs';

test('packed material atlas stores distinct procedural normals/roughness without sRGB distortions',()=>{
  const tex=createVoxelSurfaceAtlas();
  assert.equal(tex.image.width,256);
  assert.equal(tex.image.height,128);
  assert.equal(tex.minFilter,THREE.NearestFilter);
  assert.equal(tex.magFilter,THREE.NearestFilter);
  assert.equal(tex.colorSpace,THREE.NoColorSpace);
  assert.equal(tex.generateMipmaps,false);
  assert.ok(roughnessForTile(17)<roughnessForTile(2));
  assert.ok(roughnessForTile(2)>roughnessForTile(9));
  assert.notEqual(surfaceHeight(.25,.25,'roof'),surfaceHeight(.25,.45,'roof'));
  const pixel=(t,x,y)=>{const k=(((Math.floor(t/8)*32+y)*256)+(t%8)*32+x)*4;return [...tex.image.data.slice(k,k+4)];};
  const roughStone=pixel(2,12,12)[3],roughWater=pixel(17,12,12)[3];
  assert.ok(roughStone>roughWater);
  const a=pixel(2,7,9),b=pixel(2,15,12);
  assert.notDeepEqual(a,b,'mortar and chips create different geometric surface normals');
  assert.ok(a[2]>120&&b[2]>120);
  tex.dispose();
});
test('procedural fallback stone, wood and roof can use physical normal-map materials',()=>{
  const color=new THREE.DataTexture(new Uint8Array([180,120,90,255]),1,1);
  for(const kind of ['stone','timber','roofRed']){
    const m=makeVoxelPBRMaterial(color,kind,32);
    assert.equal(m.type,'MeshStandardMaterial');
    assert.ok(m.normalMap,'fallback surfaces have tactile bump normals');
    assert.equal(m.normalMap.image.width,64);
    assert.ok(m.roughness>.5);
    m.normalMap.dispose();m.dispose();
  }
  color.dispose();
});
test('cinematic multi-layered cloud mode is distinguishable from lightweight performance sky',()=>{
  const sky=createSkyUniforms(sampleCinematicAtmosphere());
  assert.equal(sky.uSkyQuality.value,0);
  for(const token of ['uSkyQuality','.44','cloudPattern','cameraPosition','for(int i=0;i<7;i++)','cirrus']){
    assert.ok(CINEMATIC_SKY_FRAGMENT.includes(token),token);
  }
  assert.equal(VISUAL_PRESETS.performance.skyQuality,0);
  assert.equal(VISUAL_PRESETS.cinematic.skyQuality,1);
  assert.ok(VISUAL_PRESETS.cinematic.normalStrength>VISUAL_PRESETS.performance.normalStrength);
  assert.ok(VISUAL_PRESETS.cinematic.contactAO>0);
  assert.equal(VISUAL_PRESETS.performance.contactAO,0);
});
test('Shiganshina shares packed surface atlas with water and switches normal strength only through uniforms',()=>{
  const previous=globalThis.document;
  const canvas={width:0,height:0,getContext:()=>({fillRect(){},fillStyle:''})};
  globalThis.document={createElement:()=>canvas};
  try{
    const scene=new THREE.Scene();
    const visual=createShiganshinaVisuals(scene,Array(32).fill('#928275'),'performance');
    const tex=visual.surfaceAtlas;
    const ordinary=visual.material,water=visual.waterMaterial;
    assert.equal(ordinary.uniforms.uSurfaceAtlas.value,tex);
    assert.equal(water.uniforms.uSurfaceAtlas.value,tex);
    assert.equal(ordinary.uniforms.uNormalStrength.value,VISUAL_PRESETS.performance.normalStrength);
    assert.equal(visual.sky.material.uniforms.uSkyQuality.value,0);
    assert.ok(ordinary.fragmentShader.includes('detailNormal'));
    assert.ok(ordinary.fragmentShader.includes('effectiveRoughness'));
    assert.ok(ordinary.vertexShader.includes('surfaceNormal=normalize'));
    assert.ok(ordinary.fragmentShader.includes('opticalFresnel'));
    const objectCount=scene.children.length;
    visual.setQuality('cinematic');
    assert.equal(ordinary.uniforms.uNormalStrength.value,VISUAL_PRESETS.cinematic.normalStrength);
    assert.equal(visual.sky.material.uniforms.uSkyQuality.value,1);
    assert.equal(scene.children.length,objectCount);
    visual.setQuality('performance');
    assert.equal(visual.sky.material.uniforms.uSkyQuality.value,0);
  }finally{globalThis.document=previous;}
});
test('fallback procedural world gets sky ray sampling only on cinematic preset',()=>{
  const scene=new THREE.Scene(),world=createVoxelWorld(scene);
  const sky=scene.getObjectByName('Voxel atmospheric sky');
  assert.ok(sky);
  assert.equal(sky.material.uniforms.uSkyQuality.value,0);
  world.setVisualQuality('cinematic');world.animate(2,.016);
  assert.equal(sky.material.uniforms.uSkyQuality.value,1);
  world.setVisualQuality('performance');world.animate(3,.016);
  assert.equal(sky.material.uniforms.uSkyQuality.value,0);
});
test('postprocessing adds contact occlusion only to existing opt-in cinematic pipeline',()=>{
  const code=readFileSync(new URL('../src/graphics-quality.js',import.meta.url),'utf8');
  assert.ok(code.includes("GTAOPass"));
  assert.ok(code.includes("composer.addPass(aoPass)"));
  assert.ok(code.includes("if(p.bloom)getComposer()"));
  assert.ok(code.includes("else renderer.render(scene,camera)"));
});
