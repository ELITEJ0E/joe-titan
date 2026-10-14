import * as THREE from 'three';
import {REFERENCE_COMBAT,createBullet,stepBullet,parryBullet} from './reference-combat.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
// Gameplay-local ranged weapon. Ballistics come from the supplied REA report;
// cosmetic models and default ammo counts are original JOE Titan design.
export function createRangedCombat(scene,world,enemies){
 const shots=[],material=new THREE.MeshBasicMaterial({color:0xffd99c}),geometry=new THREE.SphereGeometry(.16,7,5);
 let cooldown=0,reload=0,ammo=8,slashAge=Infinity;
 const remove=(i)=>{const item=shots[i];scene.remove(item.mesh);shots.splice(i,1);};
 function fire(position,direction){
  if(cooldown>0||reload>0||ammo<=0)return false;
  ammo--;cooldown=REFERENCE_COMBAT.shotCooldown;
  const bullet=createBullet(position,direction);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(bullet.position);scene.add(mesh);
  shots.push({...bullet,mesh});if(ammo===0)reload=REFERENCE_COMBAT.reload;
  return true;
 }
 function update(dt){
  cooldown=Math.max(0,cooldown-dt);slashAge+=dt;
  if(reload>0){reload=Math.max(0,reload-dt);if(reload===0)ammo=8;}
  for(let i=shots.length-1;i>=0;i--){
   const b=shots[i],previous=b.position.clone();
   stepBullet(b,dt);
   b.mesh.position.copy(b.position);
   const travel=b.position.clone().sub(previous),length=travel.length();
   if(length>0&&world.grappleRay?.(previous,travel.normalize(),length)){remove(i);continue;}
   let hit=false;
   for(const enemy of enemies.enemies){
    if(!enemy.alive)continue;
    const nape=enemy.position.clone().add(V(0,enemy.height*.82,0));
    if(b.position.distanceTo(nape)<REFERENCE_COMBAT.hitRadius+Math.max(.75,enemy.height*.08)){
     // Bullets are useful to stagger or weaken Titans; sword attacks remain
     // the decisive nape-focused finishing move for normal Titans.
     enemy.health=Math.max(0,enemy.health-REFERENCE_COMBAT.bulletDamage);
     enemy.stagger=Math.max(enemy.stagger,.4);
     if(enemy.health===0)enemy.alive=false;
     hit=true;break;
    }
   }
   if(hit||b.life<=0)remove(i);
  }
 }
 function reset(){for(let i=shots.length-1;i>=0;i--)remove(i);cooldown=reload=0;ammo=8;}
 return {fire,update,reset,get ammo(){return ammo;},get reload(){return reload;}};
}
