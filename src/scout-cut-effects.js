import * as THREE from 'three';
// Small pooled, original additive cut arcs. No reference-game textures/assets.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const POOL=12,ARC_LIFE=.32;
export function createScoutCutEffects(scene){
 const shape=new THREE.RingGeometry(.72,1.0,28,1,-Math.PI*.6,Math.PI*1.15);
 const slots=Array.from({length:POOL},()=>{
  const material=new THREE.MeshBasicMaterial({
   color:0xb5eeff,transparent:true,opacity:0,depthWrite:false,
   side:THREE.DoubleSide,blending:THREE.AdditiveBlending
  });
  const mesh=new THREE.Mesh(shape,material);mesh.visible=false;mesh.renderOrder=4;
  scene.add(mesh);return {mesh,remaining:0,duration:ARC_LIFE,spin:false};
 });
 let cursor=0;
 function cut(position,direction,{spin=false,hit=false}={}){
  const slot=slots[cursor++%slots.length];
  slot.remaining=ARC_LIFE;slot.spin=spin;
  slot.mesh.visible=true;slot.mesh.position.copy(position);
  slot.mesh.quaternion.setFromUnitVectors(
   new THREE.Vector3(0,0,1),direction.clone().normalize()
  );
  slot.mesh.scale.setScalar(spin?1.7:1.15);
  slot.mesh.material.color.setHex(hit?0xffe6a8:0xa7e5ff);
  slot.mesh.material.opacity=.8;
 }
 function update(dt){
  for(const slot of slots){
   if(slot.remaining<=0)continue;
   slot.remaining=Math.max(0,slot.remaining-dt);
   const progress=1-slot.remaining/slot.duration;
   slot.mesh.scale.setScalar((slot.spin?1.7:1.15)*(1+progress*.65));
   slot.mesh.material.opacity=.8*(1-progress)**2;
   slot.mesh.visible=slot.remaining>0;
  }
 }
 function clear(){for(const slot of slots){slot.remaining=0;slot.mesh.visible=false;}}
 return {cut,update,clear,activeCount:()=>slots.filter(s=>s.remaining>0).length};
}
