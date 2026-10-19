import * as THREE from 'three';
import {TITAN_FORMS} from './titan-forms.js';
import {createVoxelTitanRig,animateVoxelTitanRig,disposeVoxelTitanRig} from './titan-voxel-rig.js';
import {moveFacingYaw,orbitCameraPose,smoothFacingYaw} from './free-orbit-camera.js';
import {changeOrbitZoom,TITAN_JUMPS,titanJumpVelocity,titanCameraLimits} from './titan-camera-jump.js';
import {createTitanBlastEffects} from './titan-blast-effects.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const radiusForImpact=height=>Math.max(1.2,Math.min(4,height*.09));
export function createTitanPlayer(scene,world,camera,enemies){
  let rig=null,form=null,health=0,cooldown=0,attackDelay=0,specialTimer=0,active=false;
  const position=V(),velocity=V(),target=V(),dummy={
    id:'human-shifter',position,alive:true,moving:0,sprinting:false,state:'patrol',attackPhase:'idle',
    armLeft:0,armRight:0,stagger:0,speed:4
  };
  const blastEffects=createTitanBlastEffects(scene);
  let yaw=0,pitch=-.13,bodyYaw=0,gaitTime=0,jumpVelocity=0,grounded=true;
  let cameraDistance=23,impactCooldown=0;
  function choose(id,spawn){
    if(!TITAN_FORMS[id])return false;
    dispose();
    form=TITAN_FORMS[id];health=form.health;cooldown=attackDelay=specialTimer=0;impactCooldown=0;
    cameraDistance=titanCameraLimits(form.height).initial;
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
    blastEffects.clear();active=false;form=null;
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
    const hits=hitEnemies(form.damage,form.reach,.05);
    const impact=position.clone().addScaledVector(
      V(-Math.sin(bodyYaw),0,-Math.cos(bodyYaw)),form.reach*.83);
    world.damageStructures?.(impact,Math.min(14,Math.max(4.5,form.height*.28)),{
      height:Math.min(form.height*.65,13)
    });
    return hits;
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
    if(dummy.type==='colossal'){
      const ground=world.terrainHeight?.(position.x,position.z)??position.y;
      const blastOrigin=V(position.x,ground,position.z);
      blastEffects.spawn(blastOrigin,{radius:43,height:86});
      const broken=world.damageStructures?.(blastOrigin,48,{height:37});
      // Keep the same cooldown and Titan knockback rules as other specials.
      dummy.lastDestruction=broken?.pieces||0;
    }else{
      const strikeCenter=position.clone().addScaledVector(
        V(-Math.sin(bodyYaw),0,-Math.cos(bodyYaw)),form.reach*.8);
      world.damageStructures?.(strikeCenter,Math.min(22,Math.max(6,form.height*.38)),{
        height:Math.min(form.height*.66,20)
      });
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
    impactCooldown=Math.max(0,impactCooldown-dt);
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
    const jump=TITAN_JUMPS[dummy.type]||TITAN_JUMPS.attack;
    const speed=form.speed*(sprint?1.28:1)*(!grounded?jump.airSpeed:1);
    const acceleration=clamp(dt*8,0,1);
    velocity.x+=(target.x*speed-velocity.x)*acceleration;
    velocity.z+=(target.z*speed-velocity.z)*acceleration;
    const previous=position.clone();
    position.addScaledVector(velocity,dt);
    // Charging directly through breakable architecture causes actual
    // geometry and collision removal, not an invisible collision bypass.
    if(walking&&impactCooldown<=0&&Math.hypot(velocity.x,velocity.z)>form.speed*.9){
      const near=world.colliders?.some(box=>
        Math.abs(position.x-box.x)<box.halfW+radiusForImpact(form.height)&&
        Math.abs(position.z-box.z)<box.halfD+radiusForImpact(form.height));
      if(near){
        // A wall that is already destroyed still receives an impact probe;
        // always rate-limit it rather than scanning every 1/240 second.
        impactCooldown=.72;
        world.damageStructures?.(position,Math.min(17,Math.max(4,form.height*.29)),{
          height:Math.min(14,form.height*.50)
        });
      }
    }
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
    if(input.jumpQueued&&grounded){
      jumpVelocity=titanJumpVelocity(dummy.type);grounded=false;
      velocity.addScaledVector(heading(),form.speed*(jump.launch-1));
    }
    input.jumpQueued=false;
    if(!grounded)jumpVelocity-=25*dt;
    position.y+=jumpVelocity*dt;
    if(position.y<=terrain){
      const landing=!grounded;
      position.y=terrain;jumpVelocity=0;grounded=true;
      if(landing&&dummy.type==='colossal')world.damageStructures?.(position,10,{height:5});
    }
    dummy.moving=clamp(Math.hypot(velocity.x,velocity.z)/speed,0,1);
    if(!specialTimer&&attackDelay<.57){
      dummy.attackPhase='idle';dummy.state='patrol';
    }
    rig.group.position.copy(position);
    rig.group.rotation.y=bodyYaw;
    gaitTime+=dt;
  }
  function renderUpdate(dt,time){
    if(!active)return;
    // Dedicated visual tick: 60ish render frames, not 240 physics substeps.
    // The positional/collision solver above remains fixed-step accurate.
    const frameDt=Math.max(0,Math.min(.075,dt));
    blastEffects.update(frameDt);
    animateVoxelTitanRig(rig,dummy,frameDt,time);
    rig.weak.visible=false;rig.alert.visible=false;
    if(rig.cart){
      rig.cart.body.position.y=.03+Math.abs(Math.sin(time*5))*.015*dummy.moving;
      rig.cart.legs.forEach((leg,i)=>{
        leg.rotation.x=Math.sin(time*9+i*Math.PI*.8)*.26*dummy.moving;
      });
    }
  }
  function updateCamera(dt,snap=false){
    if(!active)return;
    const distance=cameraDistance,height=clamp(form.height*.62,3,38);
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
  function adjustZoom(delta){
    if(!form)return cameraDistance;
    cameraDistance=changeOrbitZoom(cameraDistance,delta,titanCameraLimits(form.height));
    return cameraDistance;
  }
  function takeDamage(amount){health=Math.max(0,health-amount);return {downed:health<=0};}
  return {choose,dispose,update,renderUpdate,updateCamera,adjustZoom,attack,special,takeDamage,
    get explosionCount(){return blastEffects.activeCount;},get cameraDistance(){return cameraDistance;},
    get active(){return active;},get form(){return form;},get position(){return position;},
    get velocity(){return velocity;},get speed(){return velocity.length();},get health(){return health;},
    get cooldown(){return cooldown;},get grounded(){return grounded;},get verticalSpeed(){return jumpVelocity;},
    get yaw(){return yaw;},set yaw(v){yaw=v;},
    get pitch(){return pitch;},set pitch(v){pitch=clamp(v,-.9,.75);}
  };
}