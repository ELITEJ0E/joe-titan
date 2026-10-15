import * as THREE from 'three';

// Free-look third person: camera yaw is independent from body yaw.
// Movement follows the camera basis; forward movement turns the actor
// toward the camera, while idle orbiting never spins the character.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function moveFacingYaw(cameraYaw,x,z,{previousYaw=0,moving=false}={}){
 if(!moving||Math.hypot(x,z)<.05)return previousYaw;
 const yaw=cameraYaw+Math.atan2(-x,z);
 return Math.atan2(Math.sin(yaw),Math.cos(yaw));
}
export function orbitCameraPose(position,yaw,pitch,{
 distance=11.6,height=1.25,elevation=1.3
}={}){
 const horizontal=Math.cos(pitch);
 const direction=new THREE.Vector3(-Math.sin(yaw)*horizontal,Math.sin(pitch),-Math.cos(yaw)*horizontal);
 const focus=position.clone().add(new THREE.Vector3(0,height,0));
 const ideal=focus.clone().addScaledVector(direction,-distance);
 ideal.y+=elevation;
 return {focus,ideal,direction};
}
export function smoothFacingYaw(current,target,dt,response=10){
 const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
 return current+delta*(1-Math.exp(-clamp(dt,0,.25)*response));
}
