import * as THREE from 'three';
import {napeHit,segmentNapeHealth} from './reference-combat.js';
import {createTitanProjectiles,BOULDER} from './titan-projectiles.js';
import {severTitanArm,canTitanSwipe,titanSwipeDamage} from './titan-limbs.js';
import {createVoxelTitanRig,animateVoxelTitanRig} from './titan-voxel-rig.js';
import {chooseNapeArcTarget,BLADE_ARC} from './scout-blade-arc.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const TYPES={
  wanderer:{name:'Wanderer',height:15,speed:3.2,health:100,color:0x9b675c},
  runner:{name:'Runner',height:12,speed:5.1,health:72,color:0xb88b73},
  bruiser:{name:'Bruiser',height:20,speed:2.25,health:180,color:0x765659},
  armored:{name:'Armored',height:19,speed:2.8,health:300,color:0xa69a7d,shifter:true},
  beast:{name:'Beast',height:23,speed:3,health:300,color:0x7b6757,shifter:true},
  colossus:{name:'Colossus',height:34,speed:1.5,health:400,color:0xb85d4f,shifter:true}
};


/**
 * Original oriented attack hitbox. Horizontal proximity alone is never a hit:
 * the target must be within the Titan's vertically reachable swipe volume and
 * inside its forward-facing attack arc.
 */
export function titanAttackContact(enemy,target,{grab=false}={}){
  if(!enemy?.alive||!target)return false;
  const dx=target.x-enemy.position.x,dz=target.z-enemy.position.z;
  const planar=Math.hypot(dx,dz);
  const radius=grab?Math.min(4.8,enemy.height*.36):Math.min(8.2,enemy.height*.52);
  if(planar>radius)return false;
  const vertical=target.y-(enemy.position.y+enemy.height*.62);
  const reachAbove=enemy.height*.40,reachBelow=enemy.height*.65;
  if(vertical>reachAbove||vertical< -reachBelow)return false;
  if(planar>.4&&enemy.forward){
    const cone=(dx*enemy.forward.x+dz*enemy.forward.z)/planar;
    if(cone<-.12)return false;
  }
  return true;
}

export function createEnemySimulation(spawns=[]){
  const enemies=spawns.map((spawn,index)=>{
    const type=TYPES[spawn.type]||TYPES.wanderer,position=V(...spawn.position);
    return {id:spawn.id||`riftborn-${index}`,type:spawn.type||'wanderer',height:type.height,maxHealth:type.health,health:type.health,
      speed:type.speed,shifter:!!type.shifter,napeHP:segmentNapeHealth(type.health),armRight:0,armLeft:0,
      position,spawnPosition:position.clone(),patrol:V(...(spawn.patrol||spawn.position)),
      forward:V(0,0,-1),state:'patrol',alive:true,attack:0,stagger:0,
      attackPhase:'idle',phaseTime:0,patrolGoal:1,loiter:0,moving:0,flash:0};
  });
  function reset(){
    for(const e of enemies){
      e.position.copy(e.spawnPosition);e.health=e.maxHealth;e.napeHP=segmentNapeHealth(e.maxHealth);
      e.armRight=e.armLeft=0;e.alive=true;e.state='patrol';e.attack=0;e.stagger=0;
      e.attackPhase='idle';e.phaseTime=0;e.patrolGoal=1;e.loiter=0;e.moving=0;e.flash=0;
      e.forward.set(0,0,-1);
    }
  }
  function update(dt,playerPosition,decoyPosition=null,slow=1){
    let damage=0,grab=false;
    if(!Number.isFinite(dt)||dt<=0)return {damage,grab};
    for(const e of enemies){
      if(!e.alive)continue;
      e.attack=Math.max(0,e.attack-dt);e.stagger=Math.max(0,e.stagger-dt);
      e.armRight=Math.max(0,e.armRight-dt);e.armLeft=Math.max(0,e.armLeft-dt);
      const target=decoyPosition||playerPosition;
      const offset=target.clone().sub(e.position);offset.y=0;
      const distance=offset.length();
      e.moving=0;
      if(e.stagger>0){
        e.state='stagger';e.attackPhase='idle';e.phaseTime=0;continue;
      }
      if(e.attackPhase!=='idle'){
        // Telegraph follows the scout during windup; the actual lunge/strike
        // then locks that orientation to make sidesteps meaningful.
        if(e.attackPhase==='windup'&&distance>.1)
          e.forward.lerp(offset.clone().normalize(),Math.min(1,dt*10)).normalize();
        e.phaseTime-=dt;
        if(e.attackPhase==='windup'&&e.phaseTime<=0){
          e.attackPhase='lunge';e.phaseTime=.17;
        }else if(e.attackPhase==='lunge'){
          const advance=Math.min(distance,e.speed*1.6*dt);
          if(distance>2.7&&distance<11&&offset.lengthSq()>1e-8){
            e.position.addScaledVector(offset.normalize(),advance);e.moving=.5;
          }
          if(e.phaseTime<=0){
            e.attackPhase='strike';e.phaseTime=.15;
            e.attack=e.type==='armored'?8:2.4;
            if(canTitanSwipe(e)&&titanAttackContact(e,target)){
              if(e.type==='armored'&&titanAttackContact(e,target,{grab:true}))grab=true;
              else damage+=titanSwipeDamage(e.type);
            }
          }
        }else if(e.attackPhase==='strike'&&e.phaseTime<=0){
          e.attackPhase='recover';e.phaseTime=.44;
        }else if(e.attackPhase==='recover'&&e.phaseTime<=0){
          e.attackPhase='idle';e.phaseTime=0;
        }
        e.state=e.attackPhase==='idle'?'pursue':e.attackPhase;
        continue;
      }
      const pursuing=distance<38+e.height*2.2;
      let destination;
      if(pursuing){
        e.state='pursue';destination=target;
      }else{
        // Patrol continuously between the spawn and assigned waypoint, with
        // a short idle scan at each end. Enemies do not freeze at their patrol.
        destination=e.patrolGoal?e.patrol:e.spawnPosition;
        const waypointDist=Math.hypot(destination.x-e.position.x,destination.z-e.position.z);
        if(waypointDist<1){
          if(e.loiter<=0)e.loiter=1.0+(e.height%5)*.17;
          e.loiter-=dt;
          if(e.loiter<=0){e.patrolGoal=1-e.patrolGoal;e.loiter=0;}
          e.state='patrol';continue;
        }
        e.state='patrol';
      }
      const direction=destination.clone().sub(e.position);direction.y=0;
      const remaining=direction.length();
      if(remaining>1e-6){
        direction.multiplyScalar(1/remaining);
        e.forward.lerp(direction,Math.min(1,dt*(pursuing?4.5:2.5))).normalize();
      }
      if(pursuing&&distance<7&&e.attack===0&&canTitanSwipe(e)){
        e.attackPhase='windup';e.phaseTime=e.type==='runner'?.28:.48;
        e.state='windup';continue;
      }
      const stop=pursuing?3.5:.7;
      if(remaining>stop){
        const travel=Math.min(remaining-stop,e.speed*slow*dt);
        e.position.addScaledVector(e.forward,travel);
        e.moving=clamp(travel/Math.max(.0001,e.speed*dt),0,1);
      }
      e.position.x=clamp(e.position.x,-181,181);
      e.position.z=clamp(e.position.z,-181,181);
    }
    return {damage,grab};
  }
  return {enemies,update,reset};
}

export function strikeWeakPoint(enemy,origin,direction,damage=18,maxReach=Infinity){
  if(!enemy.alive)return {hit:false};
  // The nape is at the BACK of the skull, opposite the facing direction.
  if(origin.clone().sub(enemy.position).dot(enemy.forward)>=-.5)return {hit:false};
  const point=enemy.position.clone().addScaledVector(enemy.forward,-enemy.height*.18).add(V(0,enemy.height*.82,0));
  const ray=point.clone().sub(origin),distance=ray.length();
  // Blades must actually pass near the nape; a line of sight is not a hit.
  if(distance>maxReach)return {hit:false};
  ray.multiplyScalar(1/(distance||1));
  const alignment=ray.dot(direction),closest=origin.clone().addScaledVector(direction,Math.max(0,point.clone().sub(origin).dot(direction)));
  if(alignment<.87||closest.distanceTo(point)>2.35)return {hit:false};
  enemy.flash=1;
  if(enemy.shifter){
    const result=napeHit({hp:enemy.health,napeHP:enemy.napeHP,shifter:true,deep:damage>=35,
      armor:enemy.type==='armored'&&enemy.stagger===0&&damage<44});
    enemy.health=result.hp;enemy.napeHP=result.napeHP;
    enemy.stagger=result.kind==='napecrack'?result.stagger:result.kind==='kill'?.9:.25;
    if(result.kind==='kill')enemy.alive=false;
    return {hit:true,point,defeated:!enemy.alive,kind:result.kind,enemy};
  }
  enemy.health=Math.max(0,enemy.health-damage);enemy.stagger=.45;
  if(enemy.health===0)enemy.alive=false;
  return {hit:true,point,defeated:!enemy.alive,enemy};
}

export function createEnemyManager(scene,world){
  const simulation=createEnemySimulation([
    {type:'wanderer',position:[-72,0,-67],patrol:[-105,0,-91]}, {type:'runner',position:[75,0,-92],patrol:[110,0,-106]},
    {type:'bruiser',position:[-117,0,75],patrol:[-132,0,110]}, {type:'wanderer',position:[98,0,83],patrol:[127,0,116]},
    {type:'beast',position:[-58,0,112],patrol:[-94,0,128]}, {type:'armored',position:[135,0,8],patrol:[153,0,29]}
  ]);
  simulation.enemies.forEach(enemy=>{
    const type=TYPES[enemy.type]||TYPES.wanderer;
    enemy.rig=createVoxelTitanRig(scene,enemy,type);
    enemy.group=enemy.rig.group;enemy.weak=enemy.rig.weak;
  });
  const boulders=createTitanProjectiles(scene,world);
  const throwTimers=new Map();let slowTimer=0,decoyTimer=0,decoy=null;
  function reset(){
    simulation.reset();boulders.reset();throwTimers.clear();
    slowTimer=0;decoyTimer=0;decoy=null;
    for(const enemy of simulation.enemies){
      const rig=enemy.rig;
      rig.group.visible=true;rig.group.position.copy(enemy.position);rig.group.rotation.set(0,0,0);
      rig.hips.quaternion.identity();rig.flash=0;rig.death=0;rig.gait=0;
      rig.weak.visible=true;rig.alert.visible=false;
      for(const side of ['left','right'])rig.arms[side].shoulder.visible=true;
    }
  }
  function update(dt,playerPosition,time){
    slowTimer=Math.max(0,slowTimer-dt);decoyTimer=Math.max(0,decoyTimer-dt);
    const result=simulation.update(dt,playerPosition,decoyTimer>0?decoy:null,slowTimer>0?.48:1);
    result.damage+=boulders.update(dt,playerPosition);
    for(const enemy of simulation.enemies){
      if(enemy.alive&&enemy.type==='beast'){
        const timer=Math.max(0,(throwTimers.get(enemy.id)||0)-dt);
        const distance=enemy.position.distanceTo(playerPosition);
        if(timer<=0&&distance>15&&distance<85){
          const origin=enemy.position.clone().add(V(0,enemy.height*.77,0));
          boulders.throwBoulder(origin,playerPosition.clone());
          throwTimers.set(enemy.id,BOULDER.cooldown);
        }else throwTimers.set(enemy.id,timer);
      }
      if(!enemy.rig)continue;
      // The rig faces local -Z; world.forward is the target-facing vector.
      enemy.rig.group.rotation.y=Math.atan2(-enemy.forward.x,-enemy.forward.z);
      // Keep voxel Titans above the Minecraft heightfield rather than y=0,
      // while retaining the old flat-ground positions in procedural mode.
      if(typeof world.terrainHeight==='function'){
        const ground=world.terrainHeight(enemy.position.x,enemy.position.z);
        if(Number.isFinite(ground))enemy.position.y=ground;
      }
      enemy.rig.group.position.copy(enemy.position);
      if(enemy.flash>0){enemy.rig.flash=Math.max(enemy.rig.flash,enemy.flash);enemy.flash=0;}
      animateVoxelTitanRig(enemy.rig,enemy,dt,time);
    }
    return result;
  }
  function strike(origin,direction,damage=22){
    const candidates=simulation.enemies.filter(enemy=>enemy.alive).sort((a,b)=>a.position.distanceToSquared(origin)-b.position.distanceToSquared(origin));
    for(const enemy of candidates){const result=strikeWeakPoint(enemy,origin,direction,damage,9.5);if(result.hit)return result;}
    return {hit:false};
  }
  function strikeArc(origin,direction,damage=22,{spin=false}={}){
    // Select a reachable rear-facing nape within the physical sword sweep;
    // the camera never automatically rotates or locks to a faraway target.
    const candidate=chooseNapeArcTarget(simulation.enemies,origin,direction,{
      reach:BLADE_ARC.reach,halfAngle:spin?BLADE_ARC.spinAngle:BLADE_ARC.slashAngle,world
    });
    return candidate?strikeWeakPoint(candidate.enemy,origin,candidate.direction,damage,BLADE_ARC.reach):{hit:false};
  }
  function severArm(origin,direction,maxReach=8){
    // Approximate the two arm sockets on our procedural Titan rigs. This is
    // deliberately not a claim of exact reference skeletal hit geometry.
    for(const enemy of simulation.enemies){
      if(!enemy.alive)continue;
      const lateral=new THREE.Vector3(-enemy.forward.z,0,enemy.forward.x);
      for(const side of ['left','right']){
        const sign=side==='left'?-1:1;
        const point=enemy.position.clone()
          .addScaledVector(lateral,sign*enemy.height*.182)
          .add(V(0,enemy.height*.79,0));
        const offset=point.clone().sub(origin),along=offset.dot(direction);
        if(along<0||along>maxReach)continue;
        const closest=origin.clone().addScaledVector(direction,along);
        if(closest.distanceTo(point)>Math.max(.7,enemy.height*.055))continue;
        const result=severTitanArm(enemy,side,{boss:enemy.type==='colossus'});
        if(result.kind==='limb')return {...result,enemy,point};
      }
    }
    return {kind:'none'};
  }
  function pulse(position,range,damage){let hits=0;for(const enemy of simulation.enemies){if(enemy.alive&&enemy.position.distanceTo(position)<=range){enemy.health=Math.max(0,enemy.health-damage);enemy.stagger=.9;if(enemy.health===0)enemy.alive=false;hits++;}}return hits;}
  return {enemies:simulation.enemies,update,reset,strike,strikeArc,severArm,pulse,setDecoy:(position)=>{decoy=position.clone();decoyTimer=7;},suppress:()=>{slowTimer=7;},living:()=>simulation.enemies.filter(enemy=>enemy.alive).length};
}
