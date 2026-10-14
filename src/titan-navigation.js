import * as THREE from 'three';
// Lightweight voxel look-ahead steering for procedural Titan patrols.
// Return the closest clear heading before the enemy walks into a wall;
// never teleport or change the pilot/ODM physics.
export function chooseTitanSteering(world,position,desired,{
 height=15,speed=3,turnBias=1
}={}){
 const forward=desired.clone();forward.y=0;
 if(forward.lengthSq()<1e-8)return forward.set(0,0,0);
 forward.normalize();
 if(typeof world?.grappleRay!=='function')return forward;
 const origin=position.clone().add(new THREE.Vector3(0,Math.min(2.8,height*.22),0));
 const distance=Math.min(10,Math.max(3.5,speed*1.65));
 const bias=turnBias>=0?1:-1;
 for(const angle of [0,.5*bias,-.5*bias,1.03*bias,-1.03*bias,1.55*bias,-1.55*bias]){
   const rotated=forward.clone().applyAxisAngle(new THREE.Vector3(0,1,0),angle);
   const hit=world.grappleRay(origin,rotated,distance);
   if(!hit||hit.distanceTo(origin)>distance-.35)return rotated;
 }
 return new THREE.Vector3(0,0,0);
}
export function crowdSeparation(enemy,others,dt){
 const correction=new THREE.Vector3();
 for(const other of others){
   if(other===enemy||!other.alive)continue;
   const dx=enemy.position.x-other.position.x,dz=enemy.position.z-other.position.z;
   const dist=Math.hypot(dx,dz),radius=Math.min(5,(enemy.height+other.height)*.085);
   if(dist>=radius)continue;
   const weight=Math.min(radius*.25,Math.max(0,radius-dist)*Math.min(1,dt*2.5));
   if(dist>1e-5)correction.add(new THREE.Vector3(dx/dist*weight,0,dz/dist*weight));
   else correction.x+=(String(enemy.id)<String(other.id)?-1:1)*weight;
 }
 return correction;
}
