import * as THREE from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {armoredClipPose} from './titan-gait.js';

// Armored Titan has two real GLBs:
// - original colored model (rest / normal movement)
// - uploaded rigged Run_Stealth model (only when the shifter holds sprint).
// Keep the visual swap separate from game physics and heading.
function fitVisual(model) {
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);
  const size=box.getSize(new THREE.Vector3());
  const center=box.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0)throw Error('Invalid Armored Titan GLB bounds');
  const scale=1/size.y;
  const holder=new THREE.Group();
  holder.add(model);
  model.scale.multiplyScalar(scale);
  model.position.x-=center.x*scale;
  model.position.y-=box.min.y*scale;
  model.position.z-=center.z*scale;
  model.traverse(node=>{
    if(!node.isMesh)return;
    node.castShadow=true;
    node.receiveShadow=true;
    node.frustumCulled=false;
    // Clone imported materials so appearance tweaks don't affect cached assets.
    const tune=mat=>{
      const result=mat.clone();
      result.roughness=.86;
      if(!result.map&&!node.geometry.getAttribute('color'))result.color.set(0xc5a17d);
      result.needsUpdate=true;
      return result;
    };
    node.material=Array.isArray(node.material)?node.material.map(tune):tune(node.material);
  });
  return holder;
}

// Pure predicate: only a moving player holding Shift gets the native running
// model. AI-controlled Armored Titans can still animate when chasing players.
export function shouldUseArmoredRun(enemy) {
  const moving=(enemy?.moving||0)>.08;
  if(!moving)return false;
  if(enemy.id==='human-shifter')return enemy.sprinting===true;
  return enemy.sprinting===true||enemy.state==='pursue'||enemy.state==='lunge';
}

export function createArmoredNative(runGltf,idleGltf){
  const root=new THREE.Group();
  root.name='Armored Titan / dynamic idle and Shift sprint';
  // Uploaded models look toward +Z; physics' forward is local -Z.
  root.rotation.y=Math.PI;

  const idleModel=idleGltf.scene.clone(true);
  const idle=fitVisual(idleModel);
  idle.name='Armored Titan / normal stance';
  root.add(idle);

  const runModel=cloneSkinned(runGltf.scene);
  const run=fitVisual(runModel);
  run.name='Armored Titan / native sprint';
  run.visible=false;
  root.add(run);

  const clip=runGltf.animations.find(a=>/^Run[_ -]?Stealth$/i.test(a.name))
    ||runGltf.animations.find(a=>/run/i.test(a.name));
  const mixer=new THREE.AnimationMixer(runModel);
  const runAction=clip?mixer.clipAction(clip):null;
  if(runAction){
    runAction.reset();
    runAction.setLoop(THREE.LoopRepeat,Infinity);
    runAction.setEffectiveWeight(1);
    runAction.play();
  }
  return {root,idle,run,mixer,runAction,running:false,progress:0};
}

export function updateArmoredNative(rig,enemy,dt){
  const native=rig.nativeArmored;
  if(!native)return;
  const pose=armoredClipPose(enemy,!!native.runAction);
  const animated=pose.mode!=='idle';
  if(animated!==native.running){
    native.running=animated;
    native.idle.visible=!animated;
    native.run.visible=animated;
    if(animated){
      native.runAction.reset();
      native.runAction.play();
      // Start from the correct walking cadence immediately; interpolating
      // from the clip's default 1x rate caused an accidental running burst.
      native.runAction.setEffectiveTimeScale(pose.rate);
      native.runAction.setEffectiveWeight(pose.weight);
    }
  }
  // The uploaded native rig supplies a run cycle but no independent walk
  // clip. Use a slower, subdued version of the same clip for actual walking,
  // retaining the original idle mesh when stationary.
  if(animated){
    const change=1-Math.exp(-Math.max(0,dt)*5.2);
    const speed=THREE.MathUtils.lerp(native.runAction.getEffectiveTimeScale(),pose.rate,change);
    const weight=THREE.MathUtils.lerp(native.runAction.getEffectiveWeight(),pose.weight,change);
    native.runAction.setEffectiveTimeScale(speed);
    native.runAction.setEffectiveWeight(weight);
    native.mixer.update(Math.max(0,dt));
  }
  native.idle.position.y=!animated?Math.sin(rig.gait*2)*.002*(enemy.moving||0):0;
}

export function disposeArmoredNative(native){
  if(!native)return;
  native.mixer.stopAllAction();
  native.mixer.uncacheRoot(native.run.children[0]);
  for(const part of [native.idle,native.run]){
    part.traverse(node=>{
      if(!node.isMesh)return;
      // Geometry is cached and shared by GLTFLoader; don't dispose it here.
      if(Array.isArray(node.material))node.material.forEach(material=>material.dispose());
      else node.material.dispose();
    });
  }
}
