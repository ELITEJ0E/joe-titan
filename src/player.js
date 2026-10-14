import * as THREE from 'three';
import {solveTetherConstraints,groundVelocityBlend} from './odm-physics.js';
import {chooseGrappleTarget} from './odm-targeting.js';
import {pilotPoseTargets} from './odm-pose.js';

const DEPLOYMENT_POINT = new THREE.Vector3(34, 1, 31);

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const mix=(a,b,t)=>a+(b-a)*t;
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
  shape.quadraticCurveTo(side*.53,-1.17,side*.26,-1.04);shape.lineTo(0,-1.02);shape.closePath();
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
  // Head and short layered windswept hair (face points toward local -Z).
  mesh(tilt,new THREE.CylinderGeometry(.19,.25,.20,12),skin,0,1.16,0);
  const head=mesh(tilt,new THREE.SphereGeometry(.275,18,14),skin,0,1.49,-.018);head.scale.set(.95,1.06,.87);
  const hairCap=mesh(tilt,new THREE.SphereGeometry(.285,18,12,0,Math.PI*2,0,Math.PI*.60),hair,0,1.59,-.007);
  for(let k=0;k<7;k++){const t=(k-3)/3;const strand=mesh(tilt,new THREE.ConeGeometry(.083,.25,5),hair,t*.205,1.63,-.205);strand.rotation.z=.3+t*.45;strand.rotation.x=-.27;}
  for(const s of [-1,1]){
    mesh(tilt,new THREE.SphereGeometry(.025,7,5),leather,s*.108,1.50,-.252);
    rod(tilt,[s*.19,1.30,-.18],[s*.20,1.55,-.13],.013,hair);
  }
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
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const a=new THREE.Group();a.position.set(s*.51,.91,0);tilt.add(a);arms.push(a);
    box(a,.30,.54,.34,s*.02,-.25,0,jacket);
    box(a,.28,.19,.32,s*.02,-.58,0,shirt);
    box(a,.29,.20,.33,s*.02,-.76,0,leather);
    box(a,.19,.23,.26,s*.02,-.86,-.03,skin);
    const handle=box(a,.13,.35,.14,s*.02,-.93,-.22,leather);handle.rotation.x=-.25;
    box(a,.09,.08,.28,s*.02,-.75,-.28,brass);
    const l=new THREE.Group();l.position.set(s*.22,-.23,0);tilt.add(l);legs.push(l);
    box(l,.34,.79,.35,0,-.33,0,pants);
    box(l,.37,.52,.37,0,-.88,0,boot);
    box(l,.39,.17,.63,0,-1.13,-.15,boot);
    box(l,.40,.075,.42,0,-.66,0,leather);
    for(const y of [-.20,-.47]){const strap=box(l,.39,.055,.39,0,y,0,leather);strap.rotation.z=s*.055;}
    box(l,.10,.085,.05,s*.18,-.45,-.20,brass);
  }
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.85,20),new THREE.MeshBasicMaterial({color:0x111b23,transparent:true,opacity:.22,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  const ropeLines=[],tips=[];
  for(const s of [-1,1]){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
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
  return {root,tilt,arms,legs,capeL,capeR,shadow,ropeLines,tips,jets,windTrails};
}
export function createPlayer(scene,world,camera){
  const model=avatar(scene);
  const form=new THREE.Group();const formMat=new THREE.MeshBasicMaterial({color:0x82e8ff,transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending});
  const formBody=new THREE.Mesh(new THREE.CapsuleGeometry(.72,2.1,5,10),formMat);formBody.position.y=1.75;form.add(formBody);
  const formCore=new THREE.Mesh(new THREE.SphereGeometry(.34,12,8),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.88}));formCore.position.y=2.7;form.add(formCore);form.visible=false;scene.add(form);
  const cameraAim=V(0,0,0);
  const state={position:V(8,1,-10),velocity:V(0,0,0),yaw:0,pitch:-.07,gas:100,health:100,grounded:true,
    hooks:[null,null],distance:0, boost:false, speed:0, bank:0,recoveries:0,attackTimer:0,aspect:null,world, camera,model,form,formMat,formCore,firstPerson:false};
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
    state.hooks[index]={point,length:Math.max(7,dist),age:0};
    // Moderate initial take-up without an artificial high-speed teleport.
    state.velocity.addScaledVector(point.clone().sub(state.position).normalize(),2.6);
    return true;
  }
  function release(index){state.hooks[index]=null;model.ropeLines[index].visible=false;model.tips[index].visible=false;}
  function reset(){
    state.position.copy(world.spawnPoint||DEPLOYMENT_POINT);state.velocity.set(0,0,0);state.gas=100;state.health=100;state.grounded=true;state.aspect=null;form.visible=false;
    state.yaw=0;state.pitch=-.07;state.distance=0;state.speed=0;state.bank=0;state.boost=false;
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
    const prev=state.position.clone();let forward=heading(),right=V(-forward.z,0,forward.x);
    let wish=V(0,0,0);
    if(input.keys.has('KeyW'))wish.add(forward);
    if(input.keys.has('KeyS'))wish.sub(forward);
    if(input.keys.has('KeyD'))wish.add(right);
    if(input.keys.has('KeyA'))wish.sub(right);
    if(wish.lengthSq()>0)wish.normalize();
    const reeling=input.keys.has('ShiftLeft')||input.keys.has('ShiftRight');
    const activeHooks=state.hooks.filter(Boolean).length;
    if(state.grounded){
      const speedMultiplier=state.aspect?.speed||1;
      const goal=wish.clone().multiplyScalar((reeling?15:10.5)*speedMultiplier);
      groundVelocityBlend(state.velocity,goal,dt,activeHooks>0);
      if(activeHooks)state.velocity.addScaledVector(wish,dt*16*speedMultiplier);
      if(input.jumpQueued){state.velocity.y=12.6;state.grounded=false;}
      state.gas=clamp(state.gas+dt*15,0,100);
    }else{
      const acceleration=(activeHooks?19:13)*(state.aspect?.speed||1);
      state.velocity.addScaledVector(wish,dt*acceleration);
      const drag=Math.exp(-dt*(activeHooks?.11:.25));state.velocity.x*=drag;state.velocity.z*=drag;
    }
    input.jumpQueued=false;
    if(input.keys.has('Space')&&!state.grounded&&state.gas>0){
      const dir=viewDirection();
      // A little existing momentum bleeds into the thrust vector: releasing a
      // fast swing into a boost no longer makes an abrupt ninety-degree turn.
      const thrust=dir.multiplyScalar(.84).addScaledVector(state.velocity.clone().normalize(),.16).normalize();
      state.velocity.addScaledVector(thrust,dt*(activeHooks?37:32)*(state.aspect?.boost||1));
      state.velocity.y+=dt*5;state.gas=clamp(state.gas-dt*19,0,100);state.boost=true;
    }else state.boost=false;
    if(input.keys.has('KeyG')&&state.velocity.y<0&&state.gas>0){
      state.velocity.y+=dt*34;state.gas=Math.max(0,state.gas-dt*6);
    }
    // Grappling motor: tension + optional winch, never an unconditional teleport.
    for(const hook of state.hooks){
      if(!hook)continue;
      hook.age+=dt;
      if(reeling&&state.gas>0){
        const other=state.hooks.find(candidate=>candidate&&candidate!==hook);
        // Two cables must span their anchor separation; winching past this is impossible.
        const minimum=other?Math.max(5.7,hook.point.distanceTo(other.point)-other.length+.5):5.7;
        const next=Math.max(minimum,hook.length-dt*(18+Math.min(10,state.speed*.2))*(state.aspect?.reel||1));
        if(next<hook.length){hook.length=next;state.gas=Math.max(0,state.gas-dt*2.3);}
      }
      const towards=hook.point.clone().sub(state.position),dist=towards.length(),unit=towards.multiplyScalar(1/(dist||1));
      const excess=Math.max(0,dist-hook.length);
      if(excess>0||reeling&&state.gas>0){
        const radialSpeed=state.velocity.dot(unit);
        const tension=excess*16+Math.max(0,-radialSpeed)*5;
        const winch=reeling&&state.gas>0?20+Math.min(17,state.speed*.28):0;
        // Split simultaneous winch force so two hooks don't double the launch
        // acceleration. Both still constrain the same player trajectory.
        const force=Math.min(110,tension+winch)/Math.sqrt(activeHooks||1);
        state.velocity.addScaledVector(unit,force*dt);
      }
    }
    state.velocity.y-=25*dt;
    if(state.velocity.length()>77*(state.aspect?.speed||1))state.velocity.multiplyScalar(77*(state.aspect?.speed||1)/state.velocity.length());
    state.position.addScaledVector(state.velocity,dt);
    // Symmetric dual-cable solve: preserve velocity along each cable tangent.
    solveTetherConstraints(state.position,state.velocity,state.hooks);
    state.grounded=world.resolveCollision(state.position,prev,state.velocity);
    if(!ensureValid())return;
    state.speed=Math.hypot(state.velocity.x,state.velocity.y,state.velocity.z);
    state.attackTimer=Math.max(0,state.attackTimer-dt);
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
    // Flutter cape in proportion to aerodynamic velocity, without touching physics.
    model.capeL.rotation.x=mix(model.capeL.rotation.x,clamp(-state.speed/105,-.66,-.06),1-Math.exp(-dt*5));
    model.capeR.rotation.x=mix(model.capeR.rotation.x,clamp(-state.speed/105,-.66,-.06),1-Math.exp(-dt*5));
    model.capeL.rotation.z=Math.sin(time*6)*.045;
    model.capeR.rotation.z=-Math.sin(time*6+.6)*.045;
    model.tilt.rotation.x=mix(model.tilt.rotation.x,pose.pitch,1-Math.exp(-dt*7));
    const walk=state.grounded?Math.sin(time*flatSpeed*.92)*clamp(flatSpeed/9,0,1):.28;
    const aerialPose=!state.grounded?clamp(flatSpeed/45,0,1):0;
    model.legs[0].rotation.x=walk*.72+(state.grounded?0:-.39-aerialPose*.12);
    model.legs[1].rotation.x=-walk*.72+(state.grounded?0:-.39-aerialPose*.12);
    model.arms[0].rotation.x=state.hooks[0]?-.92:(state.grounded?-walk*.36:-.6);
    model.arms[1].rotation.x=state.hooks[1]?-.92:(state.grounded?walk*.36:-.6);
    for(let i=0;i<2;i++){
      const hook=state.hooks[i],line=model.ropeLines[i],tip=model.tips[i];
      line.visible=!!hook;tip.visible=!!hook;
      if(!hook)continue;
      const start=V(i===0?-.67:.67,.18,-.65).applyAxisAngle(V(0,1,0),model.root.rotation.y).add(state.position);
      const arr=line.geometry.attributes.position.array;
      arr[0]=start.x;arr[1]=start.y;arr[2]=start.z;arr[3]=hook.point.x;arr[4]=hook.point.y;arr[5]=hook.point.z;
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
  function takeDamage(amount){const reduced=amount*(1-(state.aspect?.armor||0));state.health=Math.max(0,state.health-reduced);if(state.health===0){reset();return {downed:true,amount:reduced};}return {downed:false,amount:reduced};}
  function heal(amount){state.health=clamp(state.health+amount,0,100);}
  function refillGas(amount){state.gas=clamp(state.gas+amount,0,100);}
  function attack(){if(state.attackTimer>0)return false;state.attackTimer=.32;return true;}
  function updateCamera(dt,snap=false){
    ensureValid();
    const aim=state.position.clone().add(V(0,.9,0)),dir=viewDirection();
    const shoulder=V(Math.cos(state.yaw)*1.15,.0,-Math.sin(state.yaw)*1.15);
    const desired=state.firstPerson?state.position.clone().add(V(0,1.3,0)):
      aim.clone().addScaledVector(dir,-11.6).add(V(0,2.15,0)).add(shoulder);
    let obstructed=false;
    if(!state.firstPerson){
      const delta=desired.clone().sub(aim),dist=delta.length();let hit=world.grappleRay(aim,delta.clone().normalize(),dist);
      if(hit&&hit.distanceTo(aim)<dist){const closer=Math.max(.35,hit.distanceTo(aim)-.65);desired.copy(aim).addScaledVector(delta.normalize(),closer);obstructed=true;}
    }
    desired.y=Math.max(.35,desired.y);
    if(snap||!finiteVector(camera.position))camera.position.copy(desired);
    else camera.position.lerp(desired,1-Math.exp(-dt*(obstructed?19:state.firstPerson?18:7.5)));
    if(!state.firstPerson&&state.speed>18){const flightLift=clamp((state.speed-18)*.018,0,.65);camera.position.y+=flightLift*(1-Math.exp(-dt*4));}
    camera.position.y=Math.max(.35,camera.position.y);
    const lookPoint=state.firstPerson?camera.position.clone().add(dir):aim.clone().addScaledVector(dir,6.5);
    cameraAim.lerp(lookPoint,snap?1:1-Math.exp(-dt*(state.firstPerson?19:11)));
    camera.lookAt(cameraAim);
    // Light roll echoes the pilot's sideways banking without disorienting
    // the player or moving the actual aim ray off the crosshair.
    if(!state.firstPerson)camera.rotateZ(clamp(state.bank*.095,-.046,.046));
    const targetFov=state.speed>20?72+clamp((state.speed-20)*.16,0,10):72;
    const nextFov=mix(camera.fov,targetFov,1-Math.exp(-dt*3));
    if(Math.abs(nextFov-camera.fov)>.002){camera.fov=nextFov;camera.updateProjectionMatrix();}
    model.root.visible=!state.firstPerson;
  }
  reset();
  return {...state,update,updateCamera,target,fire,release,reset,setAspect,clearAspect,takeDamage,heal,refillGas,attack,viewDirection,get recoveries(){return state.recoveries;},get position(){return state.position;},get velocity(){return state.velocity;},get gas(){return state.gas;},get health(){return state.health;},get aspect(){return state.aspect;},get speed(){return state.speed;},get hooks(){return state.hooks;},get grounded(){return state.grounded;},get yaw(){return state.yaw;},set yaw(v){state.yaw=v;},get pitch(){return state.pitch;},set pitch(v){state.pitch=clamp(v,-1.12,.88);},get firstPerson(){return state.firstPerson;},set firstPerson(v){state.firstPerson=v;}};
}
