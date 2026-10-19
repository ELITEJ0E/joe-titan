import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {VISUAL_PRESETS,normaliseVisualQuality} from './shiganshina-visuals.js';
import {createFrameBudgetController} from './adaptive-frame-budget.js';

// Cinematic effects are optional. No postprocessing allocations are made while
// playing in Performance mode (the default for the high-speed ODM game).
export function createGraphicsQuality(renderer,scene,camera,world,initial='performance'){
  let quality='performance',composer=null,renderPass=null,bloomPass=null,aoPass=null;
  const dynamic=createFrameBudgetController();
  const size=()=>({width:window.innerWidth,height:window.innerHeight});
  function getComposer(){
    if(composer)return composer;
    composer=new EffectComposer(renderer);
    renderPass=new RenderPass(scene,camera);
    const {width,height}=size();
    // Filmic contact occlusion is computed only in Cinematic mode. Existing
    // baked AO still serves Performance without any offscreen render targets.
    aoPass=new GTAOPass(scene,camera,width,height);
    aoPass.blendIntensity=.63;
    bloomPass=new UnrealBloomPass(new THREE.Vector2(width,height),.28,.24,.91);
    composer.addPass(renderPass);
    composer.addPass(aoPass);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    return composer;
  }
  function resize(){
    const {width,height}=size();
    const p=VISUAL_PRESETS[quality];
    const pixelRatio=Math.min(window.devicePixelRatio||1,p.pixelRatio)*dynamic.scale;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width,height,false);
    // Reduce internal render resolution slightly to offset the bloom pass.
    if(composer){
      composer.setPixelRatio(pixelRatio*.72);
      composer.setSize(width,height);
    }
  }
  function setQuality(next){
    const selected=normaliseVisualQuality(next);
    if(selected!==quality)dynamic.reset();
    quality=selected;
    const p=VISUAL_PRESETS[quality];
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=p.exposure;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    world?.setVisualQuality?.(quality);
    if(p.bloom)getComposer();
    resize();
    return quality;
  }
  function render(){
    if(VISUAL_PRESETS[quality].bloom&&composer)composer.render();
    else renderer.render(scene,camera);
  }
  function tickFrame(dt){
    // Performance mode stays lightweight; Cinematic retains AO/bloom,
    // but downscales targets gradually instead of stalling on slow GPUs.
    if(dynamic.update(dt))resize();
  }
  setQuality(initial);
  return {setQuality,getQuality:()=>quality,resize,render,tickFrame,
    getResolutionScale:()=>dynamic.scale,getEstimatedFps:()=>dynamic.fps};
}
