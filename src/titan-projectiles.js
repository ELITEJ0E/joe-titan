import * as THREE from 'three';
import {stepBullet} from './reference-combat.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
// Source-derived: throws launch at 22 u/s with 4 u/s² ballistic gravity.
// The cooldown, damage and projectile look are original JOE Titan choices.
export const BOULDER={speed:22,gravity:4,damage:24,cooldown:4.5,radius:1.25};
export function createTitanProjectiles(scene,world){
 const balls=[],geo=new THREE.IcosahedronGeometry(BOULDER.radius,0);
 const material=new THREE.MeshStandardMaterial({color:0x686765,roughness:1});
 function throwBoulder(origin,target){
  const direction=target.clone().sub(origin);
  direction.y+=Math.min(11,direction.length()*.075);
  if(direction.lengthSq()<1e-4)return false;
  const bullet={position:origin.clone(),velocity:direction.normalize().multiplyScalar(BOULDER.speed),life:5};
  const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.position.copy(origin);scene.add(mesh);
  balls.push({...bullet,mesh});return true;
 }
 function update(dt,pilotPosition){
  let damage=0;
  for(let i=balls.length-1;i>=0;i--){
   const ball=balls[i],prev=ball.position.clone();
   // Movement remains client-side: actual impact is evaluated against player.
   stepBullet(ball,dt);
   ball.mesh.position.copy(ball.position);ball.mesh.rotation.x+=dt*2.5;
   const delta=ball.position.clone().sub(prev),length=delta.length();
   const wall=length>.001&&world.grappleRay?.(prev,delta.normalize(),length);
   const hitPilot=ball.position.distanceTo(pilotPosition.clone().add(V(0,.55,0)))<BOULDER.radius+.7;
   if(hitPilot)damage+=BOULDER.damage;
   if(wall||hitPilot||ball.life<=0||ball.position.y<-.5){
    scene.remove(ball.mesh);balls.splice(i,1);
   }
  }
  return damage;
 }
 function reset(){for(const b of balls)scene.remove(b.mesh);balls.length=0;}
 return {throwBoulder,update,reset,get count(){return balls.length;}};
}
