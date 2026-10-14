import * as THREE from 'three';
import {REFERENCE_COMBAT,pickupAvailable} from './reference-combat.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
export function createSupplyDrops(scene,world){
 const spots=[[-31,17],[-105,-72],[77,-94],[111,42],[25,115],[-92,112]];
 const drops=spots.map(([x,z],i)=>{
   const y=world.terrainHeight?.(x,z)??1;
   const position=V(x,Math.max(2,y)+1.25,z);
   const type=['gas','health','gas','blades','gas','health'][i];
   const material=new THREE.MeshBasicMaterial({color:type==='gas'?0x84ecce:type==='health'?0xff9a82:0xffd27d});
   const group=new THREE.Group(),core=new THREE.Mesh(new THREE.OctahedronGeometry(.9,0),material);
   group.position.copy(position);group.add(core);scene.add(group);
   return {position,type,group,core,available:true,respawn:0};
 });
 function update(dt,time,player){
  for(const item of drops){
   if(!item.available){item.respawn-=dt;if(item.respawn<=0){item.available=true;item.group.visible=true;}continue;}
   item.group.rotation.y=time*.65;item.core.position.y=Math.sin(time*2+item.position.x)*.18;
   if(!pickupAvailable(player,item))continue;
   item.available=false;item.group.visible=false;
   item.respawn=35; // Original game respawn delay unknown; game-specific choice.
   if(item.type==='gas')player.refillGas(REFERENCE_COMBAT.fuelGas);
   else if(item.type==='health')player.heal(REFERENCE_COMBAT.fuelHP);
   return item.type;
  }
  return null;
 }
 function reset(){for(const item of drops){item.available=true;item.respawn=0;item.group.visible=true;}}
 return {drops,update,reset};
}
