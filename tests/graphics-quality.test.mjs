import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createShiganshinaVisuals,VISUAL_PRESETS,normaliseVisualQuality} from '../src/shiganshina-visuals.js';
import {createVoxelWorld} from '../src/voxel-city.js';

const palette=['#000000','#8f8d87','#aaa69c','#777875','#c8bda1','#e5d7b9','#806048','#4c3528',
  '#ad573e','#7c4138','#4b6573','#76a2b0','#66844f','#826a4a','#826455','#9b8874',
  '#6c6c68','#4c9bb0','#54864a','#bd6854','#cfcac0','#424244','#a8433e','#929594',
  '#61754b','#bca26b','#b66c52','#f3c985','#52779c','#c5a45e','#6d9b68','#978c80'];

test('visual presets keep the default flight mode fast and expose cinematic quality',()=>{
  assert.equal(normaliseVisualQuality('invalid'),'performance');
  assert.equal(normaliseVisualQuality('cinematic'),'cinematic');
  assert.ok(VISUAL_PRESETS.performance.pixelRatio<VISUAL_PRESETS.cinematic.pixelRatio);
  assert.equal(VISUAL_PRESETS.performance.bloom,false);
  assert.equal(VISUAL_PRESETS.cinematic.bloom,true);
  assert.ok(VISUAL_PRESETS.performance.shadowMap<VISUAL_PRESETS.cinematic.shadowMap);
});

test('Shiganshina shader can create pixel atlas and switch quality without new geometry',()=>{
  const originalDocument=globalThis.document;
  const canvas={width:0,height:0,getContext:()=>({fillRect(){},fillStyle:''})};
  globalThis.document={createElement:(tag)=>tag==='canvas'?canvas:null};
  try{
    const scene=new THREE.Scene();
    const visual=createShiganshinaVisuals(scene,palette,'performance');
    assert.equal(visual.material.uniforms.uFogNear.value,VISUAL_PRESETS.performance.fogNear);
    assert.ok(visual.material.fragmentShader.includes('uEdgeAO'));
    assert.ok(visual.material.fragmentShader.includes('uCloudShadow'));
    assert.ok(visual.material.fragmentShader.includes('vTile>16.5')); // water response
    const children=scene.children.length;
    visual.setQuality('cinematic');
    assert.equal(visual.material.uniforms.uFogNear.value,VISUAL_PRESETS.cinematic.fogNear);
    assert.equal(visual.sun.shadow.mapSize.x,VISUAL_PRESETS.cinematic.shadowMap);
    assert.equal(scene.children.length,children,'mode switches must not duplicate scene objects');
    visual.animate(42);
    assert.equal(visual.material.uniforms.uTime.value,42);
    assert.equal(visual.sky.material.uniforms.uTime.value,42);
    const camera=new THREE.PerspectiveCamera();camera.position.set(180,100,-20);
    visual.sky.onBeforeRender(null,scene,camera);
    assert.deepEqual(visual.sky.position.toArray(),camera.position.toArray());
    visual.setQuality('performance');
    assert.equal(visual.sun.shadow.mapSize.x,1024);
  }finally{globalThis.document=originalDocument;}
});

test('procedural fallback supports the same visual-quality API',()=>{
  const scene=new THREE.Scene(),world=createVoxelWorld(scene);
  assert.equal(typeof world.setVisualQuality,'function');
  const fog=scene.fog;
  world.setVisualQuality('cinematic');
  assert.equal(scene.fog,fog);
  assert.ok(scene.fog.density>.0015);
  world.setVisualQuality('performance');
  assert.ok(scene.fog.density<.0015);
});
