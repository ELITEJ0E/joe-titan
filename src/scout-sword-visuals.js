import * as THREE from 'three';
import {SCOUT_ATTACK_TIMING} from './scout-combat-state.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function swordMotion(combat,side=1){
 if(!combat||combat.kind==='idle')return {swing:0,windup:0,spin:0,twist:0};
 const t=SCOUT_ATTACK_TIMING[combat.kind];
 const elapsed=combat.elapsed;
 const wind=clamp(elapsed/t.windup,0,1);
 const strike=clamp((elapsed-t.windup)/t.strike,0,1);
 const recover=clamp((elapsed-t.windup-t.strike)/t.recover,0,1);
 const ease=x=>x*x*(3-2*x);
 const windup=combat.phase==='windup'?wind:combat.phase==='idle'?0:1;
 const swing=combat.phase==='windup'?-wind*.7:combat.phase==='strike'?
   -.7+ease(strike)*2.05:1.35*(1-ease(recover));
 return {swing,windup,spin:combat.kind==='spin'?clamp(elapsed/(t.windup+t.strike+t.recover),0,1):0,
  twist:side*swing*.48};
}
export function createFirstPersonSwords(camera){
 // Always attach swords to the stable FPS camera, never to the banking pilot.
 const group=new THREE.Group();group.name='FPS dual swords';camera.add(group);
 const steel=new THREE.MeshStandardMaterial({color:0xdde8ef,metalness:.85,roughness:.19,side:THREE.DoubleSide});
 const grip=new THREE.MeshStandardMaterial({color:0x35281f,roughness:.87});
 const guard=new THREE.MeshStandardMaterial({color:0xb4a579,metalness:.65,roughness:.3});
 const models=[];
 for(const side of [-1,1]){
  const pivot=new THREE.Group();pivot.position.set(side*.39,-.38,-.66);group.add(pivot);
  const handle=new THREE.Mesh(new THREE.BoxGeometry(.10,.23,.12),grip);
  handle.position.set(0,-.04,0);pivot.add(handle);
  const cross=new THREE.Mesh(new THREE.BoxGeometry(.25,.045,.12),guard);
  cross.position.set(0,.09,-.07);pivot.add(cross);
  // Wide metal blade extends forward into the player's first-person view.
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.09,.045,.96),steel);
  blade.position.set(0,.12,-.58);pivot.add(blade);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.058,.2,4),steel);
  tip.rotation.x=-Math.PI/2;tip.position.set(0,.12,-1.13);pivot.add(tip);
  models.push(pivot);
 }
 group.visible=false;
 return {group,models};
}
export function animateFirstPersonSwords(view,combat,dt,time=0,{visible=true,blades=1}={}){
 view.group.visible=visible&&blades>0;
 if(!view.group.visible)return;
 for(let i=0;i<view.models.length;i++){
  const side=i===0?-1:1,motion=swordMotion(combat,side),pivot=view.models[i];
  const targetX=-.19+motion.swing*(i===0?-.60:.75);
  const targetZ=side*(.11+motion.swing*.53);
  const targetY=side*(.08+motion.spin*Math.PI*1.25);
  const alpha=1-Math.exp(-Math.max(0,dt)*(combat?.phase==='strike'?35:17));
  pivot.rotation.x+=(targetX-pivot.rotation.x)*alpha;
  pivot.rotation.z+=(targetZ-pivot.rotation.z)*alpha;
  pivot.rotation.y+=(targetY-pivot.rotation.y)*alpha;
  pivot.position.y=-.37+Math.sin(time*2.5+i)*.007+Math.abs(motion.swing)*.09;
 }
}
