import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createArmoredNative,updateArmoredNative,disposeArmoredNative} from './armored-native-rig.js';

// Uploaded user meshes are unrigged and have no source animations.
// Build a lightweight per-vertex skeletal skin, then animate it at runtime.
export const TITAN_GLB_PATHS=Object.freeze({
 attack:'/models/titans/attack_titan.glb',
 armored:'/models/titans/armored_titan.glb',
 colossal:'/models/titans/colossal_titan.glb',
 female:'/models/titans/female_titan.glb',
 beast:'/models/titans/beast_titan.glb',
 jaw:'/models/titans/jaw_titan.glb',
 cart:'/models/titans/cart_titan.glb',
 warhammer:'/models/titans/war_hammer_titan.glb',
 founding:'/models/titans/founding_titan.glb'
});
export const ARMORED_IDLE_PATH='/models/titans/armored_idle.glb';
const loader=new GLTFLoader(),cache=new Map(),preparedMeshes=new Map(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Convert unrigged Meshy mesh vertex weights only once per Titan type,
// then reuse that prepared geometry and material for other instances.
function load(kind){
 if(!cache.has(kind))cache.set(kind,loader.loadAsync(TITAN_GLB_PATHS[kind]).catch(e=>{cache.delete(kind);throw e;}));
 return cache.get(kind);
}
function loadArmoredIdle(){
 const kind='armoredIdle';
 if(!cache.has(kind))cache.set(kind,loader.loadAsync(ARMORED_IDLE_PATH).catch(e=>{cache.delete(kind);throw e;}));
 return cache.get(kind);
}
function bone(name,x,y,z,parent){
 const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);return b;
}
export function classifyTitanVertex(x,y,z){
 // Original Meshy model normalized to y=0..1, front toward negative Z.
 // Weight spread smooths deformation around knees/elbows/hips/shoulders.
 if(y>.83&&Math.abs(x)<.21)return [[6,1]];
 if(y>.54&&Math.abs(x)<.23)return [[1,1]];
 if(y>.53&&Math.abs(x)>.23){
   const left=x<0,upper=y>.63;
   const shoulder=left?2:4,elbow=left?3:5;
   const bend=clamp((.64-y)/.13,0,1);
   return [[shoulder,1-bend],[elbow,bend]];
 }
 if(y<=.54){
   const left=x<0,upper=y>.30;
   const hip=left?7:9,knee=left?8:10;
   const bend=clamp((.38-y)/.14,0,1);
   return [[hip,1-bend],[knee,bend]];
 }
 return [[1,1]];
}
function makeBones(root){
 const hips=bone('Hips',0,.53,0,root);
 const torso=bone('Spine',0,.08,0,hips);
 const leftArm=bone('LeftUpperArm',-.22,.19,0,torso);
 const leftFore=bone('LeftForeArm',-.12,-.14,0,leftArm);
 const rightArm=bone('RightUpperArm',.22,.19,0,torso);
 const rightFore=bone('RightForeArm',.12,-.14,0,rightArm);
 const head=bone('Head',0,.30,0,torso);
 const leftLeg=bone('LeftUpperLeg',-.10,-.08,0,hips);
 const leftShin=bone('LeftLowerLeg',0,-.22,0,leftLeg);
 const rightLeg=bone('RightUpperLeg',.10,-.08,0,hips);
 const rightShin=bone('RightLowerLeg',0,-.22,0,rightLeg);
 return {bones:[hips,torso,leftArm,leftFore,rightArm,rightFore,head,leftLeg,leftShin,rightLeg,rightShin],
  hips,torso,leftArm,leftFore,rightArm,rightFore,head,leftLeg,leftShin,rightLeg,rightShin};
}
function skinnedVisual(gltf,kind){
 const pivot=new THREE.Group();
 pivot.name='User GLB skinned / '+kind;
 // The imported model faces +Z but locomotion expects local -Z.
 pivot.rotation.y=Math.PI;
 const scene=gltf.scene;
 scene.updateMatrixWorld(true);
 const bbox=new THREE.Box3().setFromObject(scene);
 const dims=bbox.getSize(new THREE.Vector3());
 if(!Number.isFinite(dims.y)||dims.y<=.01)throw Error('Invalid mesh size');
 const c=bbox.getCenter(new THREE.Vector3()),factor=1/dims.y;
 // Transform world-space vertices into shared normalized rig coordinates.
 const norm=new THREE.Matrix4().makeScale(factor,factor,factor)
    .multiply(new THREE.Matrix4().makeTranslation(-c.x,-bbox.min.y,-c.z));
 const bones=makeBones(pivot);
 pivot.updateMatrixWorld(true);
 const skeleton=new THREE.Skeleton(bones.bones);
 scene.traverse(obj=>{
  if(!obj.isMesh)return;
  const geo=obj.geometry.clone();
  geo.applyMatrix4(norm.clone().multiply(obj.matrixWorld));
  if(!geo.attributes.normal)geo.computeVertexNormals();
  const pos=geo.attributes.position,si=new Uint16Array(pos.count*4),sw=new Float32Array(pos.count*4);
  for(let i=0;i<pos.count;i++){
    const picks=classifyTitanVertex(pos.getX(i),pos.getY(i),pos.getZ(i));
    for(let k=0;k<picks.length;k++){si[i*4+k]=picks[k][0];sw[i*4+k]=picks[k][1];}
  }
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));
  geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
  const baseMaterials=Array.isArray(obj.material)?obj.material:[obj.material];
  const mats=baseMaterials.map(m=>{
    const material=new THREE.MeshStandardMaterial({
      color:0xffffff,vertexColors:!!geo.attributes.color,roughness:.88,
      flatShading:false,side:THREE.DoubleSide
    });
    if(m.map)material.map=m.map;
    if(!geo.attributes.color&&!material.map)material.color.setHex(0xb18a78);
    return material;
  });
  const skin=new THREE.SkinnedMesh(geo,mats.length===1?mats[0]:mats);
  skin.name='Animated Mesh / '+kind;
  skin.castShadow=false;skin.receiveShadow=true;skin.frustumCulled=true;
  // Conservative animated bounds in normalized local rig units.
  skin.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.48,0),1.65);
  pivot.add(skin);
  skin.bind(skeleton);
 });
 if(!pivot.children.some(c=>c.isSkinnedMesh))throw Error('No skinnable meshes in GLB');
 return {pivot,bones,skeleton};
}
export function preparedTitanVisual(gltf,kind){
 if(!preparedMeshes.has(kind))preparedMeshes.set(kind,skinnedVisual(gltf,kind));
 const template=preparedMeshes.get(kind);
 const pivot=cloneSkinned(template.pivot);
 const skinned=pivot.children.find(obj=>obj.isSkinnedMesh);
 if(!skinned)throw Error('Cached Titan skin missing skinned mesh');
 const jointNames=['hips','torso','leftArm','leftFore','rightArm','rightFore',
   'head','leftLeg','leftShin','rightLeg','rightShin'];
 const bones={bones:skinned.skeleton.bones};
 for(let i=0;i<jointNames.length;i++)bones[jointNames[i]]=skinned.skeleton.bones[i];
 return {pivot,bones,skeleton:skinned.skeleton};
}
export function animateTitanGLB(rig,enemy,dt,time){
 if(rig.nativeArmored){updateArmoredNative(rig,enemy,dt);return;}
 if(!rig.modelSkeleton)return;
 const b=rig.modelSkeleton.bones,move=clamp(enemy.moving||0,0,1),
 gait=rig.gait,walk=Math.sin(gait)*.39*move,atk=enemy.attackPhase||'idle',
 swing=atk==='strike'?.95:atk==='windup'?-.65:atk==='lunge'?.4:0;
 const k=1-Math.exp(-Math.max(0,dt)*12);
 const pose=(node,x,y=0,z=0)=>{node.rotation.x=THREE.MathUtils.lerp(node.rotation.x,x,k);
  node.rotation.y=THREE.MathUtils.lerp(node.rotation.y,y,k);
  node.rotation.z=THREE.MathUtils.lerp(node.rotation.z,z,k);};
 pose(b.torso,Math.sin(time*1.2)*.014+(atk==='lunge'?-.23:0),0,walk*.13);
 pose(b.leftArm,-walk*.55-.12,0,-.11);
 pose(b.rightArm,walk*.55+swing-.12,0,.11);
 pose(b.leftFore,-.20-Math.max(0,swing)*.4);
 pose(b.rightFore,-.20-Math.max(0,swing)*.65);
 pose(b.head,Math.sin(time*.68)*.025);
 pose(b.leftLeg,-walk);
 pose(b.rightLeg,walk);
 pose(b.leftShin,Math.max(0,walk)*.55);
 pose(b.rightShin,Math.max(0,-walk)*.55);
 b.hips.position.y=.53+Math.abs(Math.sin(gait))*.007*move;
 rig.modelVisual.position.y=Math.sin(time*1.3)*.003;
}
export function attachTitanGLB(rig,kind){
 if(typeof window==='undefined'||!TITAN_GLB_PATHS[kind])return rig;
 if(rig.modelStatus==='loading'||rig.modelStatus==='loaded')return rig;
 rig.modelStatus='loading';
 const assetPromise=kind==='armored'?Promise.all([load(kind),loadArmoredIdle()]):load(kind).then(gltf=>[gltf,null]);
 rig.modelReady=assetPromise.then(([gltf,idleGltf])=>{
  if(rig.disposed)return false;
  const native=kind==='armored'?createArmoredNative(gltf,idleGltf):null;
  const skinned=native?{pivot:native.root,bones:null,skeleton:null}:preparedTitanVisual(gltf,kind);
  // Prevent the old blocky meshes from displaying behind the actual character.
  for(const obj of rig.fallbackMeshes||[])obj.visible=false;
  rig.group.add(skinned.pivot);
  rig.modelVisual=skinned.pivot;
  rig.modelSkeleton=native?null:skinned;
  rig.nativeArmored=native;
  rig.modelStatus='loaded';
  rig.lodLevel='high';
  return true;
 }).catch(err=>{
  rig.modelStatus='fallback';
  if(!rig.disposed)console.warn('Titan GLB unavailable',kind,err);
  return false;
 });
 return rig;
}
export function preloadTitanGLBs(kinds=Object.keys(TITAN_GLB_PATHS)){
 if(typeof window==='undefined')return Promise.resolve([]);
 return Promise.allSettled([...kinds.map(load),...(kinds.includes('armored')?[loadArmoredIdle()]:[])]);
}

// Release the native Armored Titan's mixer and private materials when switching modes.
export function disposeTitanGLBVisual(rig){
 if(rig.nativeArmored){disposeArmoredNative(rig.nativeArmored);rig.nativeArmored=null;}
 // Skinned clones own Skeleton/bone textures, but NOT geometry/material
 // buffers (those remain cached for subsequent Titans).
 if(rig.modelSkeleton){
  rig.modelSkeleton.skeleton.dispose();
  rig.modelSkeleton=null;
 }
}
