import * as THREE from 'three';
import {napeHit,segmentNapeHealth} from './reference-combat.js';
import {createTitanProjectiles,BOULDER} from './titan-projectiles.js';
import {severTitanArm,canTitanSwipe,titanSwipeDamage} from './titan-limbs.js';

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

export function createEnemySimulation(spawns=[]){
  const enemies=spawns.map((spawn,index)=>{
    const type=TYPES[spawn.type]||TYPES.wanderer,position=V(...spawn.position);
    return {id:spawn.id||`riftborn-${index}`,type:spawn.type||'wanderer',height:type.height,maxHealth:type.health,health:type.health,
      speed:type.speed,shifter:!!type.shifter,napeHP:segmentNapeHealth(type.health),armRight:0,armLeft:0,position,spawnPosition:position.clone(),patrol:V(...(spawn.patrol||spawn.position)),spawnPatrol:V(...(spawn.patrol||spawn.position)),forward:V(0,0,-1),state:'patrol',alive:true,attack:0,stagger:0};
  });
  function reset(){for(const enemy of enemies){enemy.position.copy(enemy.spawnPosition);enemy.patrol.copy(enemy.spawnPatrol);enemy.health=enemy.maxHealth;enemy.napeHP=segmentNapeHealth(enemy.maxHealth);enemy.armRight=enemy.armLeft=0;enemy.alive=true;enemy.state='patrol';enemy.attack=0;enemy.stagger=0;enemy.forward.set(0,0,-1);}}
  function update(dt,playerPosition,decoyPosition=null,slow=1){
    let damage=0,grab=false;
    for(const enemy of enemies){
      if(!enemy.alive)continue;
      enemy.attack=Math.max(0,enemy.attack-dt);enemy.stagger=Math.max(0,enemy.stagger-dt);enemy.armRight=Math.max(0,enemy.armRight-dt);enemy.armLeft=Math.max(0,enemy.armLeft-dt);
      const target=decoyPosition||playerPosition,offset=target.clone().sub(enemy.position);offset.y=0;const distance=offset.length();
      if(enemy.stagger>0){enemy.state='stagger';continue;}
      if(distance<42)enemy.state='pursue';else if(enemy.state!=='patrol')enemy.state='return';
      const destination=enemy.state==='pursue'?target:enemy.patrol;
      const direction=destination.clone().sub(enemy.position);direction.y=0;
      const targetDistance=direction.length();
      if(targetDistance>.5){direction.multiplyScalar(1/targetDistance);enemy.forward.lerp(direction,Math.min(1,dt*4)).normalize();}
      if(enemy.state==='pursue'&&distance<7&&canTitanSwipe(enemy)){
        enemy.state='strike';if(enemy.attack===0){
          if(enemy.type==='armored'&&distance<4.8){enemy.attack=8;grab=true;}
          else{enemy.attack=2.4;damage=titanSwipeDamage(enemy.type);}
        }
      }else if(targetDistance>.7){enemy.position.addScaledVector(enemy.forward,Math.min(targetDistance,enemy.speed*slow*dt));}
      enemy.position.x=clamp(enemy.position.x,-181,181);enemy.position.z=clamp(enemy.position.z,-181,181);
    }
    return {damage,grab};
  }
  return {enemies,update,reset};
}

export function strikeWeakPoint(enemy,origin,direction,damage=18,maxReach=Infinity){
  if(!enemy.alive)return {hit:false};
  // The exposed nape sits on the forward-marked side of this original creature rig.
  if(origin.clone().sub(enemy.position).dot(enemy.forward)<=.5)return {hit:false};
  const point=enemy.position.clone().addScaledVector(enemy.forward,1.45).add(V(0,enemy.height*.82,0));
  const ray=point.clone().sub(origin),distance=ray.length();
  // Blades must actually pass near the nape; a line of sight is not a hit.
  if(distance>maxReach)return {hit:false};
  ray.multiplyScalar(1/(distance||1));
  const alignment=ray.dot(direction),closest=origin.clone().addScaledVector(direction,Math.max(0,point.clone().sub(origin).dot(direction)));
  if(alignment<.87||closest.distanceTo(point)>2.35)return {hit:false};
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

function humanoid(scene,enemy){
  const type=TYPES[enemy.type]||TYPES.wanderer,group=new THREE.Group(),skin=new THREE.MeshStandardMaterial({color:type.color,roughness:.82}),dark=new THREE.MeshStandardMaterial({color:0x3e3030,roughness:.9});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(type.height*.105,type.height*.45,5,8),skin);body.position.y=type.height*.48;body.castShadow=true;group.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(type.height*.13,12,9),skin);head.position.y=type.height*.83;head.castShadow=true;group.add(head);
  for(const side of [-1,1]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(type.height*.048,type.height*.34,4,6),skin);arm.position.set(side*type.height*.15,type.height*.56,0);arm.rotation.z=side*.18;arm.castShadow=true;group.add(arm);}
  const weak=new THREE.Mesh(new THREE.SphereGeometry(type.height*.06,10,8),new THREE.MeshBasicMaterial({color:0xffd99a,transparent:true,opacity:.96}));weak.position.set(0,type.height*.82,type.height*.14);group.add(weak);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(type.height*.3,16),new THREE.MeshBasicMaterial({color:0x11131a,transparent:true,opacity:.28,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.03;group.add(shadow);
  group.position.copy(enemy.position);scene.add(group);enemy.group=group;enemy.weak=weak;return enemy;
}

export function createEnemyManager(scene,world){
  const simulation=createEnemySimulation([
    {type:'wanderer',position:[-72,0,-67],patrol:[-105,0,-91]}, {type:'runner',position:[75,0,-92],patrol:[110,0,-106]},
    {type:'bruiser',position:[-117,0,75],patrol:[-132,0,110]}, {type:'wanderer',position:[98,0,83],patrol:[127,0,116]},
    {type:'beast',position:[-58,0,112],patrol:[-94,0,128]}, {type:'armored',position:[135,0,8],patrol:[153,0,29]}
  ]);
  simulation.enemies.forEach(enemy=>humanoid(scene,enemy));
  const boulders=createTitanProjectiles(scene,world);
  const throwTimers=new Map();let slowTimer=0,decoyTimer=0,decoy=null;
  function reset(){simulation.reset();boulders.reset();throwTimers.clear();slowTimer=0;decoyTimer=0;decoy=null;for(const enemy of simulation.enemies){if(enemy.group){enemy.group.visible=true;enemy.group.position.copy(enemy.position);if(enemy.group.children[2])enemy.group.children[2].visible=true;if(enemy.group.children[3])enemy.group.children[3].visible=true;}}}
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
      if(!enemy.group)continue;enemy.group.visible=enemy.alive;enemy.group.position.copy(enemy.position);enemy.group.rotation.y=Math.atan2(enemy.forward.x,enemy.forward.z);
      // Hide severed procedural arms until their individual regrowth timers expire.
      if(enemy.group.children[2])enemy.group.children[2].visible=enemy.armLeft<=0;
      if(enemy.group.children[3])enemy.group.children[3].visible=enemy.armRight<=0;
      const stride=Math.sin(time*(enemy.speed*2)+enemy.position.x)*.09;enemy.group.children[0].rotation.z=stride;
      if(enemy.weak)enemy.weak.scale.setScalar(enemy.state==='stagger'?1.65:1+Math.sin(time*4)*.16);
    }
    return result;
  }
  function strike(origin,direction,damage=22){
    const candidates=simulation.enemies.filter(enemy=>enemy.alive).sort((a,b)=>a.position.distanceToSquared(origin)-b.position.distanceToSquared(origin));
    for(const enemy of candidates){const result=strikeWeakPoint(enemy,origin,direction,damage,9.5);if(result.hit)return result;}
    return {hit:false};
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
          .addScaledVector(lateral,sign*enemy.height*.15)
          .add(V(0,enemy.height*.56,0));
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
  return {enemies:simulation.enemies,update,reset,strike,severArm,pulse,setDecoy:(position)=>{decoy=position.clone();decoyTimer=7;},suppress:()=>{slowTimer=7;},living:()=>simulation.enemies.filter(enemy=>enemy.alive).length};
}
