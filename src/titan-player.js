import * as THREE from 'three';
import {TITAN_FORMS} from './titan-forms.js';
import {createVoxelTitanRig,animateVoxelTitanRig,disposeVoxelTitanRig} from './titan-voxel-rig.js';
import {moveFacingYaw,orbitCameraPose,smoothFacingYaw} from './free-orbit-camera.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createTitanPlayer(scene,world,camera,enemies){
  let rig=null,form=null,health=0,cooldown=0,attackDelay=0,specialTimer=0,active=false;
  const position=V(),velocity=V(),target=V(),dummy={
    id:'human-shifter',position,alive:true,moving:0,sprinting:false,state:'patrol',attackPhase:'idle',
    armLeft:0,armRight:0,stagger:0,speed:4
  };
  let yaw=0,pitch=-.13,bodyYaw=0,gaitTime=0,jumpVelocity=0,grounded=true;
  function choose(id,spawn){
    if(!TITAN_FORMS[id])return false;
    dispose();
    form=TITAN_FORMS[id];health=form.health;cooldown=attackDelay=specialTimer=0;
    position.copy(spawn);position.y=world.terrainHeight?.(position.x,position.z)??0;
    yaw=0;bodyYaw=0;pitch=-.13;velocity.set(0,0,0);jumpVelocity=0;grounded=true;
    dummy.speed=form.speed;dummy.type=id;dummy.alive=true;dummy.moving=0;dummy.sprinting=false;
    rig=createVoxelTitanRig(scene,dummy,{height:form.height,color:form.color});
    rig.group.traverse(node=>{if(node.isSprite)node.visible=false;});
    // Nape and alert are AI-only hit indicators.
    rig.weak.visible=false;rig.alert.visible=false;
    active=true;return true;
  }
  function dispose(){
    if(rig){disposeVoxelTitanRig(scene,rig);rig=null;}
    active=false;form=null;
  }
  function heading(){return V(-Math.sin(yaw),0,-Math.cos(yaw));}
  function hitEnemies(damage,reach,arc=.5){
    if(!rig)return 0;
    let hits=0,forward=V(-Math.sin(bodyYaw),0,-Math.cos(bodyYaw));
    for(const e of enemies.enemies){
      if(!e.alive)continue;
      const diff=e.position.clone().sub(position),flat=V(diff.x,0,diff.z),dist=flat.length();
      if(dist>reach+e.height*.13||dist<.01)continue;
      if(flat.normalize().dot(forward)<arc)continue;
      e.health=Math.max(0,e.health-damage);e.stagger=.6;e.flash=1;
      if(!e.health)e.alive=false;
      hits++;
    }
    return hits;
  }
  function attack(){
    if(!active||attackDelay>0)return 0;
    attackDelay=.85;specialTimer=0;
    dummy.attackPhase='windup';dummy.state='windup';
    return hitEnemies(form.damage,form.reach,.05);
  }
  function special(){
    if(!active||cooldown>0)return {ok:false,remaining:cooldown};
    cooldown=form.cooldown;specialTimer=1.4;
    dummy.state='strike';dummy.attackPhase='strike';
    let hits=0;
    if(['colossal','founding','warhammer','beast'].includes(dummy.type)){
      hits=hitEnemies(form.damage*1.6,form.reach*1.7,-1);
    }else{
      hits=hitEnemies(form.damage*1.5,form.reach*1.35,-.4);
      velocity.addScaledVector(heading(),form.speed*(dummy.type==='jaw'?2.4:1.5));
    }
    if(dummy.type==='female')health=Math.min(form.health,health+40);
    if(dummy.type==='armored')health=Math.min(form.health,health+75);
    return {ok:true,name:form.special,hits};
  }
  function update(dt,input,time){
    if(!active)return;
    attackDelay=Math.max(0,attackDelay-dt);
    cooldown=Math.max(0,cooldown-dt);
    specialTimer=Math.max(0,specialTimer-dt);
    let x=Number(input.keys.has('KeyD'))-Number(input.keys.has('KeyA'));
    let z=Number(input.keys.has('KeyW'))-Number(input.keys.has('KeyS'));
    const length=Math.hypot(x,z)||1;x/=length;z/=length;
    const forward=heading(),right=V(-forward.z,0,forward.x);
    target.copy(forward).multiplyScalar(z).addScaledVector(right,x);
    const walking=target.lengthSq()>.01;
    if(walking)bodyYaw=smoothFacingYaw(bodyYaw,
      moveFacingYaw(yaw,x,z,{previousYaw:bodyYaw,moving:true}),dt,9);
    const sprint=input.keys.has('ShiftLeft')||input.keys.has('ShiftRight');
    // Native Armored run animation is opt-in: hold Shift *while* moving.
    dummy.sprinting=sprint&&walking;
    const speed=form.speed*(sprint?1.28:1);
    const acceleration=clamp(dt*8,0,1);
    velocity.x+=(target.x*speed-velocity.x)*acceleration;
    velocity.z+=(target.z*speed-velocity.z)*acceleration;
    const previous=position.clone();
    position.addScaledVector(velocity,dt);
    // Resolve horizontal obstacle volumes with Titan-sized radii.
    const radius=clamp(form.height*.09,.7,4);
    for(const box of world.colliders||[]){
      if(Math.abs(position.x-box.x)>box.halfW+radius||
         Math.abs(position.z-box.z)>box.halfD+radius)continue;
      const bottom=world.terrainHeight?.(position.x,position.z)??0;
      if(bottom>box.h+1)continue;
      const overlapX=box.halfW+radius-Math.abs(position.x-box.x);
      const overlapZ=box.halfD+radius-Math.abs(position.z-box.z);
      if(overlapX<overlapZ)position.x=box.x+Math.sign(position.x-box.x||1)*(box.halfW+radius);
      else position.z=box.z+Math.sign(position.z-box.z||1)*(box.halfD+radius);
    }
    const terrain=world.terrainHeight?.(position.x,position.z)??0;
    if(input.jumpQueued&&grounded&&form.height<30){
      jumpVelocity=Math.sqrt(form.height)*3;grounded=false;
    }
    input.jumpQueued=false;
    if(!grounded)jumpVelocity-=25*dt;
    position.y+=jumpVelocity*dt;
    if(position.y<=terrain){position.y=terrain;jumpVelocity=0;grounded=true;}
    dummy.moving=clamp(Math.hypot(velocity.x,velocity.z)/speed,0,1);
    if(!specialTimer&&attackDelay<.57){
      dummy.attackPhase='idle';dummy.state='patrol';
    }
    rig.group.position.copy(position);
    rig.group.rotation.y=bodyYaw;
    animateVoxelTitanRig(rig,dummy,dt,time);
    rig.weak.visible=false;rig.alert.visible=false;
    if(rig.cart){
      rig.cart.body.position.y=.03+Math.abs(Math.sin(time*5))*.015*dummy.moving;
      rig.cart.legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(time*9+i*Math.PI*.8)*.26*dummy.moving;});
    }
    gaitTime+=dt;
  }
  function updateCamera(dt,snap=false){
    if(!active)return;
    const distance=clamp(form.height*1.55,12,105),height=clamp(form.height*.62,3,38);
    // Camera can orbit behind, beside or in front of the Titan. Movement,
    // not mouse turning, controls its body heading.
    const pose=orbitCameraPose(position,yaw,pitch,{
      distance,height,elevation:distance*.10
    });
    const aim=pose.focus,desired=pose.ideal;
    if(snap)camera.position.copy(desired);
    else camera.position.lerp(desired,1-Math.exp(-dt*7));
    camera.up.set(0,1,0);
    camera.lookAt(aim);
    const fov=clamp(67+form.height*.05,68,76);
    if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
  }
  function takeDamage(amount){health=Math.max(0,health-amount);return {downed:health<=0};}
  return {choose,dispose,update,updateCamera,attack,special,takeDamage,
    get active(){return active;},get form(){return form;},get position(){return position;},
    get velocity(){return velocity;},get speed(){return velocity.length();},get health(){return health;},
    get cooldown(){return cooldown;},get grounded(){return grounded;},
    get yaw(){return yaw;},set yaw(v){yaw=v;},
    get pitch(){return pitch;},set pitch(v){pitch=clamp(v,-.9,.75);}
  };
}