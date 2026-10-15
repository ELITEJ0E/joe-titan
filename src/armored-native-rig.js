import * as THREE from 'three';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';

export function createArmoredNative(gltf){
  const root=new THREE.Group();
  root.name='Armored Titan - animated native skeleton';
  const model=cloneSkinned(gltf.scene);
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model);
  const extent=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  if(!Number.isFinite(extent.y)||extent.y<=0)throw Error('Invalid armored model bounds');
  const scale=1/extent.y;
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  // Model forward is +Z, while movement/camera forward is -Z.
  root.rotation.y=Math.PI;
  root.add(model);
  model.traverse(node=>{
    if(!node.isMesh)return;
    node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;
    for(const mat of Array.isArray(node.material)?node.material:[node.material]){
      if(!mat)continue;
      mat.roughness=.86;
      if(!mat.map&&!node.geometry.getAttribute('color'))mat.color.set(0xc5a17d);
      mat.needsUpdate=true;
    }
  });
  const mixer=new THREE.AnimationMixer(model);
  const clip=gltf.animations.find(c=>/run[_ -]?stealth/i.test(c.name))||gltf.animations[0];
  const runAction=clip?mixer.clipAction(clip):null;
  if(runAction){runAction.play();runAction.setEffectiveWeight(0);}
  return {root,mixer,runAction,progress:0};
}

export function updateArmoredNative(rig,enemy,dt){
  const native=rig.nativeArmored;if(!native)return;
  const movement=THREE.MathUtils.clamp(enemy.moving||0,0,1);
  const smoothing=1-Math.exp(-Math.max(0,dt)*8);
  native.progress=THREE.MathUtils.lerp(native.progress,movement,smoothing);
  if(native.runAction){
    native.runAction.setEffectiveWeight(native.progress);
    native.runAction.setEffectiveTimeScale(THREE.MathUtils.clamp((enemy.speed||6)/8,.4,2));
  }
  native.mixer.update(dt);
  const recoil=enemy.attackPhase==='strike' ?-.08:enemy.attackPhase==='windup'?.05:0;
  native.root.rotation.x=THREE.MathUtils.lerp(native.root.rotation.x,recoil,smoothing);
}
