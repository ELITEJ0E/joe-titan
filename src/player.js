import * as THREE from 'three';
import {solveTetherConstraints,groundVelocityBlend} from './odm-physics.js';
import {applyODMMotor,applyReferenceAirDrag,ODM_TUNING} from './odm-motor.js';
import {applyDirectionalGasBoost} from './odm-gas-propulsion.js';
import {evaluateODMCollision} from './odm-impacts.js';
import {chooseGrappleTarget} from './odm-targeting.js';
import {pilotPoseTargets} from './odm-pose.js';
import {ODM_CABLE_SEGMENTS,writeODMCableCurve} from './odm-cable-visuals.js';
import {aimODMArm} from './odm-arm-aim.js';
import {updateStableFirstPersonCamera} from './odm-first-person-camera.js';
import {GRAB_ESCAPE,createEscapeProgress,registerEscapePress} from './grab-escape.js';
import {createScoutAttackState,beginScoutAttack,advanceScoutAttack,consumeScoutHit,resetScoutAttack,scoutAttackProgress,cubicEaseOut,SCOUT_ATTACK_TIMING} from './scout-combat-state.js';

const DEPLOYMENT_POINT = new THREE.Vector3(34, 1, 31);

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const mix=(a,b,t)=>a+(b-a)*t;
const poseEuler=new THREE.Euler(),poseQuat=new THREE.Quaternion();
function smoothBone(node,x,y,z,dt,response=13){
  poseEuler.set(x,y,z,'XYZ');poseQuat.setFromEuler(poseEuler);
  node.quaternion.slerp(poseQuat,1-Math.exp(-Math.max(0,dt)*response));
}
const mat=(color,metalness=0,roughness=.7)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const jacket=mat(0xa87b4e,0,.91), shirt=mat(0xe4d9be,0,.95), pants=mat(0xede2cb,0,.94);
const leather=mat(0x3d261c,0,.83), leatherLite=mat(0x77503a,0,.85), boot=mat(0x32251f,0,.76);
const green=mat(0x284c3c,0,.94),greenDark=mat(0x193a30,0,.95),steel=mat(0x86939a,.72,.3),brightSteel=mat(0xc5d2d4,.68,.27);
const brass=mat(0xb99a62,.64,.35),skin=mat(0xe1aa88,0,.86),hair=mat(0x29201c,0,.95),white=mat(0xe5e6d8,0,.9);
const box=(p,w,h,d,x,y,z,m)=>{const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);a.position.set(x,y,z);a.castShadow=true;p.add(a);return a;};
const mesh=(p,g,m,x,y,z)=>{const a=new THREE.Mesh(g,m);a.position.set(x,y,z);a.castShadow=true;p.add(a);return a;};
function rod(p,a,b,r,m){const v=new THREE.Vector3(...a),w=new THREE.Vector3(...b),delta=w.clone().sub(v);
const o=mesh(p,new THREE.CylinderGeometry(r,r,delta.length(),7),m,...v.clone().add(w).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
function capePanel(parent,side){
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(side*.50,-.08);shape.lineTo(side*.77,-.92);
  shape.lineTo(side*.55,-1.14);shape.lineTo(side*.28,-1.02);shape.lineTo(0,-1.02);shape.closePath();
  const g=new THREE.ShapeGeometry(shape,12);const m=green.clone();m.side=THREE.DoubleSide;
  const o=new THREE.Mesh(g,m);o.rotation.x=-.19;o.position.set(0,1.08,.40);o.castShadow=true;parent.add(o);return o;
}
function avatar(scene){
  const root=new THREE.Group();scene.add(root);
  const tilt=new THREE.Group();root.add(tilt);
  // Cropped tan jacket over a pale undershirt, fitted military trousers.
  box(tilt,.76,.93,.45,0,.56,0,shirt);
  box(tilt,.39,.87,.48,-.20,.58,-.035,jacket);box(tilt,.39,.87,.48,.20,.58,-.035,jacket);
  box(tilt,.10,.76,.51,0,.61,-.053,shirt);
  box(tilt,.83,.15,.54,0,.16,.035,leather);
  box(tilt,.23,.13,.09,0,.16,-.27,brass);
  box(tilt,.78,.25,.44,0,-.12,0,pants);
  // Shoulder, chest and cross-waist straps; external so they remain readable in motion.
  rod(tilt,[-.34,1,-.27],[.19,.14,-.28],.044,leather);
  rod(tilt,[.34,1,-.27],[-.19,.14,-.28],.044,leather);
  rod(tilt,[-.33,.92,.25],[.25,.18,.30],.042,leatherLite);
  rod(tilt,[.33,.92,.25],[-.25,.18,.30],.042,leatherLite);
  box(tilt,.23,.10,.04,-.13,.58,-.309,brass);box(tilt,.23,.10,.04,.13,.58,-.309,brass);
  // Minecraft-style head with pixel-like flat facial features. A named head
  // pivot is animated separately from the torso for convincing high-speed aim.
  box(tilt,.16,.17,.17,0,1.20,0,skin);
  const headRig=new THREE.Group();headRig.name='pilot head';
  headRig.position.set(0,1.49,-.02);tilt.add(headRig);
  box(headRig,.52,.52,.50,0,0,0,skin);
  box(headRig,.56,.16,.53,0,.25,0,hair);
  for(const x of [-.18,-.06,.06,.18])box(headRig,.12,.11,.08,x,.17,-.265,hair);
  for(const x of [-.115,.115]){
    box(headRig,.055,.05,.02,x,.018,-.262,leather);
    box(headRig,.022,.018,.022,x,-.085,-.262,leatherLite);
  }
  box(headRig,.105,.025,.016,0,-.16,-.262,leather);
  // Shoulder cloak with independently moving panels and custom twin-wing back emblem.
  const capePivot=new THREE.Group();capePivot.position.set(0,0,0);tilt.add(capePivot);
  const capeL=capePanel(capePivot,-1),capeR=capePanel(capePivot,1);
  box(tilt,1.06,.13,.60,0,1.08,.16,greenDark);
  const emblem=new THREE.Group();emblem.position.set(0,.81,.475);capePivot.add(emblem);
  for(const s of [-1,1]){
    for(let k=0;k<4;k++){
      const feather=box(emblem,.10,.30-k*.035,.014,s*(.08+k*.09),-k*.07,0,k%2?white:brightSteel);
      feather.rotation.z=s*(.36+k*.11);
    }
  }
  // Angular waist OD propulsion box and hip-mounted gas cylinders / cable reels.
  box(tilt,.71,.40,.27,0,.24,.47,steel);
  for(const s of [-1,1]){
    box(tilt,.25,.22,.32,s*.31,.24,.48,leather);
    const can=mesh(tilt,new THREE.CylinderGeometry(.13,.13,.76,12),steel,s*.55,-.13,.19);
    can.rotation.z=s*.14;
    box(tilt,.36,.13,.33,s*.55,.23,.18,brass);
    mesh(tilt,new THREE.CylinderGeometry(.16,.16,.06,16),brightSteel,s*.70,.04,.22).rotation.z=Math.PI/2;
    mesh(tilt,new THREE.CylinderGeometry(.068,.068,.07,10),leather,s*.74,.04,.22).rotation.z=Math.PI/2;
    // Retracted replacement blade and sheath along the hip.
    box(tilt,.10,.79,.17,s*.70,-.32,-.13,steel);
    box(tilt,.14,.13,.24,s*.70,.08,-.13,leather);
    rod(tilt,[s*.29,.49,-.20],[s*.58,-.21,-.19],.036,leatherLite);
  }
  const arms=[],legs=[],elbows=[],knees=[],blades=[];
  for(const sign of [-1,1]){
    const arm=new THREE.Group();arm.name=sign<0?'left shoulder':'right shoulder';
    arm.position.set(sign*.51,.91,0);tilt.add(arm);arms.push(arm);
    box(arm,.30,.53,.34,sign*.02,-.24,0,jacket);
    box(arm,.32,.07,.35,sign*.02,-.49,0,leather);
    const elbow=new THREE.Group();elbow.name=sign<0?'left elbow':'right elbow';
    elbow.position.set(sign*.02,-.49,0);arm.add(elbow);elbows.push(elbow);
    box(elbow,.29,.27,.32,0,-.13,0,shirt);
    box(elbow,.28,.14,.33,0,-.29,0,leather);
    box(elbow,.20,.14,.25,0,-.38,-.03,skin);
    box(elbow,.13,.26,.15,0,-.46,-.22,leather);
    box(elbow,.09,.07,.28,0,-.31,-.28,brass);
    const blade=box(elbow,.055,.51,.07,0,-.79,-.25,brightSteel);
    blade.name=sign<0?'left blade':'right blade';
    blade.visible=true;blades.push(blade);
    const leg=new THREE.Group();leg.name=sign<0?'left hip':'right hip';
    leg.position.set(sign*.22,-.23,0);tilt.add(leg);legs.push(leg);
    box(leg,.34,.64,.35,0,-.27,0,pants);
    box(leg,.38,.06,.40,0,-.13,0,leather);
    const knee=new THREE.Group();knee.name=sign<0?'left knee':'right knee';
    knee.position.y=-.55;leg.add(knee);knees.push(knee);
    box(knee,.37,.40,.37,0,-.23,0,boot);
    box(knee,.39,.16,.63,0,-.58,-.15,boot);
    box(knee,.40,.075,.42,0,-.11,0,leather);
    box(knee,.39,.06,.40,0,-.35,0,leather);
    box(knee,.10,.085,.05,sign*.18,-.24,-.20,brass);
  }
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.85,20),new THREE.MeshBasicMaterial({color:0x111b23,transparent:true,opacity:.22,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  const ropeLines=[],tips=[];
  for(const s of [-1,1]){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array((ODM_CABLE_SEGMENTS+1)*3),3));
    const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:s<0?0xc6d9df:0xbfcad1,transparent:true,opacity:.96}));
    line.visible=false;line.frustumCulled=false;scene.add(line);ropeLines.push(line);
    const tip=mesh(scene,new THREE.IcosahedronGeometry(.3,1),brightSteel);tip.visible=false;tips.push(tip);
  }
  const jets=[];
  for(let i=0;i<2;i++){
    const m=new THREE.MeshBasicMaterial({color:0x98ddf3,transparent:true,opacity:.50,depthWrite:false,blending:THREE.AdditiveBlending});
    const jet=new THREE.Mesh(new THREE.ConeGeometry(.19,1.7,9),m);
    jet.rotation.x=Math.PI/2;jet.visible=false;tilt.add(jet);jet.position.set(i?-.48:.48,.05,.52);jets.push(jet);
  }
  // Two cheap camera-readable airflow streaks, only active in fast flight.
  const windTrails=[];
  for(const side of [-1,1]){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({
      color:side<0?0xb1eaff:0xd1f1ff,transparent:true,opacity:.34,depthWrite:false
    }));
    line.visible=false;line.frustumCulled=false;scene.add(line);windTrails.push(line);
  }
  return {root,tilt,headRig,arms,elbows,legs,knees,blades,capeL,capeR,shadow,ropeLines,tips,jets,windTrails};
}
export function createPlayer(scene,world,camera){
  const model=avatar(scene);
  const form=new THREE.Group();const formMat=new THREE.MeshBasicMaterial({color:0x82e8ff,transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending});
  const formBody=new THREE.Mesh(new THREE.CapsuleGeometry(.72,2.1,5,10),formMat);formBody.position.y=1.75;form.add(formBody);
  const formCore=new THREE.Mesh(new THREE.SphereGeometry(.34,12,8),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.88}));formCore.position.y=2.7;form.add(formCore);form.visible=false;scene.add(form);
  const cameraAim=V(0,0,0);
  const state={position:V(8,1,-10),velocity:V(0,0,0),yaw:0,pitch:-.07,gas:100,health:100,blades:8,grabbed:false,grabEscape:0,grabProgress:createEscapeProgress(),grounded:true,
    hooks:[null,null],distance:0, boost:false, speed:0, bank:0,recoveries:0,attackTimer:0,aspect:null,world, camera,model,form,formMat,formCore,firstPerson:false,
    flightClock:0,lastGearAt:-Infinity,lastImpactAt:-Infinity,impactFeedback:0,combat:createScoutAttackState(),
    landingCompression:0,braking:false,hitStun:0};
  camera.position.set(9,5,3);
  const heading=()=>V(-Math.sin(state.yaw),0,-Math.cos(state.yaw));
  const viewDirection=()=>V(-Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),-Math.cos(state.yaw)*Math.cos(state.pitch));
  function target(index){
    // The visible reticle is the camera's optical axis. Never approximate it
    // with player yaw/pitch: shoulder offset and smooth camera look differ.
    const reticleRay=camera.getWorldDirection(new THREE.Vector3());
    return chooseGrappleTarget(world,camera.position,state.position,reticleRay,index===0?-1:1);
  }
  function fire(index){
    if(state.hooks[index])return false;
    const point=target(index);
    if(!point)return false;
    const dist=point.distanceTo(state.position);
    // A slack cable at attachment preserves momentum instead of snapping the body.
    if(state.gas<ODM_TUNING.gasFire)return false;
    state.gas=Math.max(0,state.gas-ODM_TUNING.gasFire);
    state.hooks[index]={point,length:Math.max(ODM_TUNING.minCable,dist),age:0};
    // Moderate initial take-up without an artificial high-speed teleport.
    // The reference does not apply an artificial firing velocity impulse.
    // A cable fired above ground lifts the pilot off the street rather than
    // letting the walking controller pin the gear to the floor.
    // Reference hooks do not give a free vertical launch from the ground.
    return true;
  }
  function release(index){state.hooks[index]=null;model.ropeLines[index].visible=false;model.tips[index].visible=false;}
  function reset(){
    state.position.copy(world.spawnPoint||DEPLOYMENT_POINT);state.velocity.set(0,0,0);state.gas=100;state.health=100;state.blades=8;state.grabbed=false;state.grabEscape=0;state.grabProgress=createEscapeProgress();state.grounded=true;state.aspect=null;form.visible=false;
    state.yaw=0;state.pitch=-.07;state.distance=0;state.speed=0;state.bank=0;state.boost=false;
    state.flightClock=0;state.lastGearAt=-Infinity;state.lastImpactAt=-Infinity;state.impactFeedback=0;
    state.landingCompression=0;state.braking=false;state.hitStun=0;model.tilt.position.y=0;
    resetScoutAttack(state.combat);
    release(0);release(1);model.root.position.copy(state.position);model.root.rotation.set(0,0,0);model.tilt.rotation.set(0,0,0);
    cameraAim.copy(state.position).add(V(0,.9,0));
    camera.position.copy(state.position).add(V(1.15,3.86,11.57));updateCamera(1,true);
  }
  const finiteVector=(v)=>[v.x,v.y,v.z].every(Number.isFinite);
  function ensureValid(){
    if(finiteVector(state.position)&&finiteVector(state.velocity)&&Number.isFinite(state.yaw)&&Number.isFinite(state.pitch)
      &&Math.abs(state.position.x)<560&&Math.abs(state.position.z)<560&&state.position.y>-40&&state.position.y<520)return true;
    state.recoveries++;reset();return false;
  }
  function update(dt,input,time){
    if(!ensureValid()){input.jumpQueued=false;return;}
    if(state.grabbed){
      state.velocity.set(0,0,0);state.speed=0;state.boost=false;
      for(let i=0;i<2;i++){
        smoothBone(model.arms[i],.42,0,i===0?-.35:.35,dt,14);
        smoothBone(model.legs[i],-.22,0,0,dt,12);
      }
      smoothBone(model.headRig,-.3,0,0,dt,12);
      input.jumpQueued=false;model.root.position.copy(state.position);
      return;
    }
    state.flightClock+=dt;
    state.impactFeedback=Math.max(0,state.impactFeedback-dt);
    state.hitStun=Math.max(0,state.hitStun-dt);
    state.landingCompression*=Math.exp(-dt*12);
    const buffered=advanceScoutAttack(state.combat,dt,{canStartBuffered:state.blades>0});
    if(buffered)state.blades=Math.max(0,state.blades-1);
    const prev=state.position.clone();let forward=heading(),right=V(-forward.z,0,forward.x);
    let wish=V(0,0,0);
    if(input.keys.has('KeyW'))wish.add(forward);
    if(input.keys.has('KeyS'))wish.sub(forward);
    if(input.keys.has('KeyD'))wish.add(right);
    if(input.keys.has('KeyA'))wish.sub(right);
    if(wish.lengthSq()>0)wish.normalize();
    const reeling=input.keys.has('ShiftLeft')||input.keys.has('ShiftRight');
    const activeHooks=state.hooks.filter(Boolean).length;
    if(activeHooks)state.lastGearAt=state.flightClock;
    const movingForward=wish.dot(forward)>0.01;
    if(state.grounded&&!activeHooks){
      const speedMultiplier=state.aspect?.speed||1;
      const goal=wish.clone().multiplyScalar((reeling&&movingForward?ODM_TUNING.sprint:ODM_TUNING.run)*speedMultiplier);
      groundVelocityBlend(state.velocity,goal,dt,false);
      // Hook forces are handled independently of the running controller.
      if(input.jumpQueued){state.velocity.y=9.6;state.grounded=false;}
      state.gas=clamp(state.gas+dt*15,0,100);
    }else{
      const acceleration=(activeHooks?ODM_TUNING.hookAirControl:ODM_TUNING.airControl)*(state.aspect?.speed||1);
      state.velocity.addScaledVector(wish,dt*acceleration);
      // The speed-dependent reference drag is applied after all forces.
    }
    input.jumpQueued=false;
    if(input.keys.has('Space')&&!state.grounded&&state.gas>0){
      const moveX=Number(input.keys.has('KeyD'))-Number(input.keys.has('KeyA'));
      const moveY=Number(input.keys.has('KeyW'))-Number(input.keys.has('KeyS'));
      const inputScale=Math.max(1,Math.hypot(moveX,moveY));
      applyDirectionalGasBoost(state.velocity,state.yaw,state.pitch,moveX/inputScale,moveY/inputScale,dt,{
        acceleration:ODM_TUNING.boost,gravity:ODM_TUNING.gravity,
        liftFactor:ODM_TUNING.boostVerticalGravity,multiplier:state.aspect?.boost||1
      });
      state.gas=Math.max(0,state.gas-ODM_TUNING.gasBoost*dt);state.boost=true;
    }else state.boost=false;
    state.braking=input.keys.has('KeyG')&&!state.grounded&&state.gas>0;
    if(state.braking){
      if(state.velocity.y< -2)state.velocity.y+=Math.min(-state.velocity.y-2,ODM_TUNING.brakeVertical*dt);
      if(!activeHooks){
        const k=Math.min(1,ODM_TUNING.brakeHorizontal*dt);
        state.velocity.x*=1-k;state.velocity.z*=1-k;
      }
      state.gas=Math.max(0,state.gas-ODM_TUNING.gasBrake*dt);
    }
    // Attached cables reel automatically and supply responsive, bounded
    // winch thrust; Shift accelerates the reel. No teleporting or speed reset.
    state.gas=Math.max(0,state.gas-applyODMMotor(
      state.position,state.velocity,state.hooks,dt,
      {reeling,gas:state.gas,reelMultiplier:state.aspect?.reel||1,forwardPump:movingForward}));
    for(const hook of state.hooks)if(hook)hook.age+=dt;
    state.velocity.y-=ODM_TUNING.gravity*dt;
    if(!state.grounded)applyReferenceAirDrag(state.velocity,dt);
    if(state.velocity.length()>ODM_TUNING.maxSpeed*(state.aspect?.speed||1))state.velocity.multiplyScalar(ODM_TUNING.maxSpeed*(state.aspect?.speed||1)/state.velocity.length());
    // Reference-style ropes do not pay out during boost. A taut rope
    // removes outward radial speed, preserving tangent/look-directed motion.
    state.position.addScaledVector(state.velocity,dt);
    // Symmetric dual-cable solve: preserve velocity along each cable tangent.
    solveTetherConstraints(state.position,state.velocity,state.hooks);
    const wasGrounded=state.grounded,fallSpeed=Math.max(0,-state.velocity.y);
    state.grounded=world.resolveCollision(state.position,prev,state.velocity);
    if(state.grounded&&!wasGrounded)state.landingCompression=Math.min(.23,Math.max(0,(fallSpeed-5)*.007));
    if(world.lastCollision){
      const collision=evaluateODMCollision(world.lastCollision,{
        gearActive:activeHooks>0,
        secondsSinceGear:state.flightClock-state.lastGearAt,
        secondsSinceImpact:state.flightClock-state.lastImpactAt
      });
      if(collision.damage>0){
        state.lastImpactAt=state.flightClock;
        state.impactFeedback=Math.min(1,collision.damage/40);
        const reduced=collision.damage*(1-(state.aspect?.armor||0));
        state.health=Math.max(0,state.health-reduced);
        if(state.health===0){state.recoveries++;reset();return;}
      }
    }
    if(!ensureValid())return;
    state.speed=Math.hypot(state.velocity.x,state.velocity.y,state.velocity.z);
    const sequence=state.combat.kind==='idle'?null:SCOUT_ATTACK_TIMING[state.combat.kind];
    state.attackTimer=sequence?Math.max(0,sequence.windup+sequence.strike+sequence.recover-state.combat.elapsed):0;
    state.distance+=state.position.distanceTo(prev);
    // Banking and sprint cycles animate the procedural player without borrowed character assets.
    const flatSpeed=Math.hypot(state.velocity.x,state.velocity.z);
    let desiredYaw=state.yaw;
    if(flatSpeed>3){desiredYaw=Math.atan2(-state.velocity.x,-state.velocity.z);}
    let yawDelta=((desiredYaw-model.root.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
    model.root.rotation.y+=yawDelta*(1-Math.exp(-dt*8));
    model.root.position.copy(state.position);
    const pose=pilotPoseTargets({
      velocity:state.velocity,position:state.position,forward,right,
      hooks:state.hooks,grounded:state.grounded,boost:state.boost,
      steer:Number(input.keys.has('KeyD'))-Number(input.keys.has('KeyA'))
    });
    state.bank=mix(state.bank,pose.bank,1-Math.exp(-dt*7));
    model.tilt.rotation.z=state.bank;
    model.tilt.position.y=-state.landingCompression;
    // Flutter cape in proportion to aerodynamic velocity, without touching physics.
    model.capeL.rotation.x=mix(model.capeL.rotation.x,clamp(-state.speed/105,-.66,-.06),1-Math.exp(-dt*5));
    model.capeR.rotation.x=mix(model.capeR.rotation.x,clamp(-state.speed/105,-.66,-.06),1-Math.exp(-dt*5));
    model.capeL.rotation.z=Math.sin(time*6)*.045;
    model.capeR.rotation.z=-Math.sin(time*6+.6)*.045;
    model.tilt.rotation.x=mix(model.tilt.rotation.x,pose.pitch+(state.braking?.16:0)+(state.hitStun>0?-.14:0),1-Math.exp(-dt*10));
    const walk=state.grounded?Math.sin(time*flatSpeed*.92)*clamp(flatSpeed/9,0,1):.28;
    const aerialPose=!state.grounded?clamp(flatSpeed/45,0,1):0;
    const action=state.combat,progress=scoutAttackProgress(action);
    const attackEntry=action.kind==='idle'?null:SCOUT_ATTACK_TIMING[action.kind];
    const sweep=action.phase==='strike'&&attackEntry
      ?cubicEaseOut((action.elapsed-attackEntry.windup)/attackEntry.strike):0;
    // The sword winds back, then travels forward across the strike window.
    // The hit event is generated at the center of that same animation.
    const slash=action.kind==='slash'
      ?(action.phase==='windup'?-0.38:action.phase==='strike'?-0.38+1.38*sweep:
         action.phase==='recover'?.18:0):0;
    const spinning=action.kind==='spin';
    // Visual spin is local to the pilot; neither camera yaw nor hook physics rotates.
    model.tilt.rotation.y=spinning?progress*Math.PI*8:0;
    const flying=!state.grounded;
    for(let i=0;i<2;i++){
      const side=i===0?-1:1,legWalk=side*walk*.72;
      const legAngle=legWalk+(flying?-.39-aerialPose*.12:state.landingCompression*1.8);
      smoothBone(model.legs[i],legAngle,0,side*(flying?.12:0),dt,16);
      smoothBone(model.knees[i],flying?.28+clamp(-legAngle,0,.23):Math.max(0,legWalk)*.19+state.landingCompression,0,0,dt,14);
      const reach=state.hooks[i]?-.92:(flying?state.braking?.2:-.6:-side*walk*.36);
      const slashArc=slash*(i===0?-.6:.78)+(spinning?(i===0?-.9:.9):0);
      if(state.hooks[i]&&action.kind==='idle')aimODMArm(model.arms[i],state.hooks[i].point,dt);
      else smoothBone(model.arms[i],reach+slashArc,side*slash*.22+(spinning?side*.20:0),side*(spinning?.55:state.hitStun>0?.39:.09),dt,action.phase==='strike'?45:18);
      smoothBone(model.elbows[i],state.hooks[i]?-.25:flying?-.32:-.14,0,side*slash*.18,dt,17);
      model.blades[i].visible=state.blades>0||state.attackTimer>0;
    }
    smoothBone(model.headRig,flying?-.1:0,clamp(state.bank*.24,-.16,.16),-state.bank*.23,dt,12);
    for(let i=0;i<2;i++){
      const hook=state.hooks[i],line=model.ropeLines[i],tip=model.tips[i];
      line.visible=!!hook;tip.visible=!!hook;
      if(!hook)continue;
      const start=V(i===0?-.67:.67,.18,-.65).applyAxisAngle(V(0,1,0),model.root.rotation.y).add(state.position);
      const arr=line.geometry.attributes.position.array;
      writeODMCableCurve(arr,start,hook.point,{
        length:hook.length,speed:state.speed,time,side:i===0?-1:1
      });
      line.geometry.attributes.position.needsUpdate=true;
      tip.position.copy(hook.point);tip.rotation.x+=dt*2.2;tip.rotation.z+=dt*1.4;
    }
    for(let i=0;i<2;i++){const jet=model.jets[i];jet.visible=state.boost;jet.scale.set(1,1+Math.sin(time*40+i)*.28,1);}
    const fastFlight=!state.grounded&&state.speed>23;
    const flightTail=state.velocity.clone().normalize().multiplyScalar(-clamp(state.speed*.13,2.5,9));
    for(let i=0;i<2;i++){
      const trail=model.windTrails[i];trail.visible=fastFlight;
      if(!fastFlight)continue;
      const p=trail.geometry.attributes.position.array;
      const side=i===0?-.48:.48,start=V(side,.2,.5).applyAxisAngle(V(0,1,0),model.root.rotation.y).add(state.position);
      p[0]=start.x;p[1]=start.y;p[2]=start.z;
      p[3]=start.x+flightTail.x;p[4]=start.y+flightTail.y;p[5]=start.z+flightTail.z;
      trail.material.opacity=clamp(.14+(state.speed-23)*.004,.14,.40);
      trail.geometry.attributes.position.needsUpdate=true;
    }
    model.shadow.position.set(state.position.x,.012,state.position.z);
    model.shadow.material.opacity=clamp(.24-state.position.y*.002,.05,.23);
    model.shadow.scale.setScalar(1+Math.min(state.position.y/32,4));
    form.position.copy(state.position);form.rotation.y=model.root.rotation.y;form.visible=!!state.aspect&&!state.firstPerson;
    form.scale.setScalar(1+Math.sin(time*9)*.035);
  }
  function setAspect(aspect){state.aspect=aspect;formMat.color.setHex(aspect.color);formCore.material.color.setHex(aspect.color);form.visible=true;}
  function clearAspect(){state.aspect=null;form.visible=false;}
  function takeDamage(amount){const reduced=amount*(1-(state.aspect?.armor||0));if(reduced>0){state.hitStun=.24;state.impactFeedback=Math.max(state.impactFeedback,Math.min(1,reduced/40));}state.health=Math.max(0,state.health-reduced);if(state.health===0){reset();return {downed:true,amount:reduced};}return {downed:false,amount:reduced};}
  function heal(amount){state.health=clamp(state.health+amount,0,100);}
  function refillGas(amount){state.gas=clamp(state.gas+amount,0,100);}
  function attack(){
    if(state.blades<=0||state.grabbed)return false;
    if(!beginScoutAttack(state.combat,'slash'))return false;
    state.blades--;state.attackTimer=.3;return true;
  }
  function spin(){
    if(state.blades<=0||state.grabbed)return false;
    if(!beginScoutAttack(state.combat,'spin'))return false;
    state.blades--;state.attackTimer=.6;return true;
  }
  function consumeAttackHit(){return consumeScoutHit(state.combat);}
  function refillBlades(amount){state.blades=clamp(state.blades+amount,0,8);}
  function grab(){if(state.grabbed)return false;resetScoutAttack(state.combat);state.grabbed=true;state.grabEscape=0;state.grabProgress=createEscapeProgress();state.velocity.set(0,0,0);release(0);release(1);return true;}
  function escapeGrab(key='',time=null){
    if(!state.grabbed)return {active:false,remaining:0};
    const result=registerEscapePress(state.grabProgress,{key,time});
    state.grabEscape=GRAB_ESCAPE.presses-result.remaining;
    if(!result.active){
      state.grabbed=false;state.grabEscape=0;state.grabProgress=createEscapeProgress();state.velocity.y=3;
    }
    return result;
  }
  function updateCamera(dt,snap=false){
    ensureValid();
    const dir=viewDirection();

    if(state.firstPerson){
      // First person has a single eye pivot and an exact, world-up view ray.
      // Position/aim are NOT independently interpolated while grappling.
      updateStableFirstPersonCamera(camera,state.position,dir,dt,{
        snap,speed:state.speed,boosting:state.boost
      });
      // Keep third-person look smoothing initialized for a clean view toggle.
      cameraAim.copy(camera.position).add(dir);
      model.root.visible=false;
      return;
    }

    const aim=state.position.clone().add(V(0,.9,0));
    const shoulder=V(Math.cos(state.yaw)*1.15,0,-Math.sin(state.yaw)*1.15);
    const desired=aim.clone().addScaledVector(dir,-11.6).add(V(0,2.15,0)).add(shoulder);
    let obstructed=false;
    const delta=desired.clone().sub(aim),dist=delta.length();
    const hit=world.grappleRay(aim,delta.clone().normalize(),dist);
    if(hit&&hit.distanceTo(aim)<dist){
      const closer=Math.max(.35,hit.distanceTo(aim)-.65);
      desired.copy(aim).addScaledVector(delta.normalize(),closer);
      obstructed=true;
    }
    desired.y=Math.max(.35,desired.y);
    if(snap||!finiteVector(camera.position))camera.position.copy(desired);
    else camera.position.lerp(desired,1-Math.exp(-dt*(obstructed?19:7.5)));
    if(state.speed>18){
      const flightLift=clamp((state.speed-18)*.018,0,.65);
      camera.position.y+=flightLift*(1-Math.exp(-dt*4));
    }
    camera.position.y=Math.max(.35,camera.position.y);
    const lookPoint=aim.clone().addScaledVector(dir,6.5);
    cameraAim.lerp(lookPoint,snap?1:1-Math.exp(-dt*11));
    camera.up.set(0,1,0);
    camera.lookAt(cameraAim);

    // Third-person cinematic roll remains separate from precise FPS targeting.
    const trauma=state.impactFeedback*state.impactFeedback;
    const shake=Math.sin(state.flightClock*83)*trauma*.024;
    camera.rotateZ(clamp(state.bank*.095+shake,-.07,.07));

    const movementFov=clamp((state.speed-9)*.42,0,25);
    const targetFov=72+movementFov+(state.boost?5:0)+(state.hooks.some(Boolean)&&state.speed>15?2:0);
    const nextFov=mix(camera.fov,targetFov,1-Math.exp(-dt*5));
    if(Math.abs(nextFov-camera.fov)>.002){
      camera.fov=nextFov;camera.updateProjectionMatrix();
    }
    model.root.visible=true;
  }
  reset();
  return {...state,update,updateCamera,target,fire,release,reset,setAspect,clearAspect,takeDamage,heal,refillGas,refillBlades,grab,escapeGrab,attack,spin,consumeAttackHit,viewDirection,get combat(){return state.combat;},get recoveries(){return state.recoveries;},get position(){return state.position;},get velocity(){return state.velocity;},get gas(){return state.gas;},get health(){return state.health;},get blades(){return state.blades;},get grabbed(){return state.grabbed;},get aspect(){return state.aspect;},get speed(){return state.speed;},get hooks(){return state.hooks;},get grounded(){return state.grounded;},get boost(){return state.boost;},get yaw(){return state.yaw;},set yaw(v){state.yaw=v;},get pitch(){return state.pitch;},set pitch(v){state.pitch=clamp(v,-1.12,.88);},get firstPerson(){return state.firstPerson;},set firstPerson(v){
    const next=!!v;
    if(state.firstPerson===next)return;
    state.firstPerson=next;
    updateCamera(1,true);
  }};
}
