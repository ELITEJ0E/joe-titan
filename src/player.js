import * as THREE from 'three';

const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const mix=(a,b,t)=>a+(b-a)*t;
const mat=(color,metalness=0,roughness=.7)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const frameMat=mat(0x243540,.25),armorMat=mat(0x607581,.4),leatherMat=mat(0x40383c,.12),bronzeMat=mat(0xb79d73,.67,.36),faceMat=mat(0xe7b99b),scarfMat=mat(0xd48e6a),glowMat=new THREE.MeshBasicMaterial({color:0x9ceaf9,transparent:true,opacity:.72});
const box=(p,w,h,d,x,y,z,m)=>{let a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);a.position.set(x,y,z);a.castShadow=true;p.add(a);return a;};
function mesh(p,g,m,x,y,z){let a=new THREE.Mesh(g,m);a.position.set(x,y,z);a.castShadow=true;p.add(a);return a;}
function avatar(scene){
  const root=new THREE.Group();scene.add(root);
  const tilt=new THREE.Group();root.add(tilt);
  const coat=box(tilt,.89,1.2,.49,0,.46,.08,frameMat);
  box(tilt,.92,.09,.55,0,.84,-.02,bronzeMat);
  box(tilt,.3,.65,.67,0,.28,.07,leatherMat);
  box(tilt,.78,.15,.58,0,-.03,.08,bronzeMat);
  const collar=mesh(tilt,new THREE.CylinderGeometry(.34,.43,.25,8),scarfMat,0,1.17,-.04);
  const head=mesh(tilt,new THREE.SphereGeometry(.31,14,12),faceMat,0,1.47,-.01);
  head.scale.set(1,.99,.86);
  const helmet=mesh(tilt,new THREE.SphereGeometry(.33,14,8,0,Math.PI*2,0,Math.PI/2),frameMat,0,1.53,.01);
  box(tilt,.8,.12,.25,0,1.57,-.22,frameMat);
  box(tilt,.22,.12,.06,-.12,1.42,-.275,leatherMat);box(tilt,.22,.12,.06,.12,1.42,-.275,leatherMat);
  // Two compact independent grappling gas canisters and a turbine pack.
  for(const sign of [-1,1]){
    const can=mesh(tilt,new THREE.CylinderGeometry(.18,.18,.87,10),armorMat,sign*.32,.47,.46);
    can.rotation.z=sign*.14;
    box(tilt,.31,.11,.37,sign*.32,.85,.44,bronzeMat);
    mesh(tilt,new THREE.CylinderGeometry(.10,.14,.23,8),leatherMat,sign*.33,-.03,.54);
  }
  box(tilt,.7,.45,.25,0,.25,.44,leatherMat);
  const arms=[],legs=[];
  for(const sign of [-1,1]){
    const a=new THREE.Group();a.position.set(sign*.57,.92,0);tilt.add(a);arms.push(a);
    box(a,.31,.68,.31,sign*.045,-.29,0,armorMat);
    box(a,.38,.22,.35,sign*.045,-.61,-.02,leatherMat);
    const claw=box(a,.27,.36,.64,sign*.05,-.74,-.31,bronzeMat);
    box(a,.19,.14,.25,sign*.05,-.74,-.7,frameMat);
    const l=new THREE.Group();l.position.set(sign*.25,-.23,.09);tilt.add(l);legs.push(l);
    box(l,.35,.79,.38,0,-.31,0,leatherMat);
    box(l,.38,.52,.4,0,-.89,-.01,armorMat);
    box(l,.41,.19,.69,0,-1.1,-.16,frameMat);
    // Winglike cape panel is original to this prototype.
    const wing=box(tilt,.43,.95,.07,sign*.34,-.10,.36,frameMat);wing.rotation.z=sign*.13;
  }
  // Ground shadow decal, constant size to make landings easier.
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.85,20),new THREE.MeshBasicMaterial({color:0x111b23,transparent:true,opacity:.22,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  // Twin glowing wire lines; each buffer updates without allocating geometries each frame.
  const ropeLines=[],tips=[];
  for(const s of [-1,1]){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
    const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:s<0?0x7cdcf2:0xffb478,transparent:true,opacity:.96,depthTest:true}));
    line.visible=false;line.frustumCulled=false;scene.add(line);ropeLines.push(line);
    const tip=mesh(scene,new THREE.IcosahedronGeometry(.42,1),new THREE.MeshBasicMaterial({color:s<0?0xa1f0ff:0xffd09d}));tip.visible=false;tips.push(tip);
  }
  const jetMat=new THREE.MeshBasicMaterial({color:0x93dfff,transparent:true,opacity:.58,depthWrite:false,blending:THREE.AdditiveBlending});
  const jets=[];
  for(let i=0;i<2;i++){let jet=new THREE.Mesh(new THREE.ConeGeometry(.24,2.3,9),jetMat.clone());jet.rotation.x=Math.PI/2;jet.visible=false;tilt.add(jet);jet.position.set(i?-.32:.32,.15,.9);jets.push(jet);}
  return {root,tilt,arms,legs,shadow,ropeLines,tips,jets};
}
export function createPlayer(scene,world,camera){
  const model=avatar(scene);
  const form=new THREE.Group();const formMat=new THREE.MeshBasicMaterial({color:0x82e8ff,transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending});
  const formBody=new THREE.Mesh(new THREE.CapsuleGeometry(.72,2.1,5,10),formMat);formBody.position.y=1.75;form.add(formBody);
  const formCore=new THREE.Mesh(new THREE.SphereGeometry(.34,12,8),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.88}));formCore.position.y=2.7;form.add(formCore);form.visible=false;scene.add(form);
  const state={position:V(8,1,-10),velocity:V(0,0,0),yaw:0,pitch:-.07,gas:100,health:100,grounded:true,
    hooks:[null,null],distance:0, boost:false, speed:0, bank:0,recoveries:0,attackTimer:0,aspect:null,world, camera,model,form,formMat,formCore,firstPerson:false};
  camera.position.set(9,5,3);
  const heading=()=>V(-Math.sin(state.yaw),0,-Math.cos(state.yaw));
  const viewDirection=()=>V(-Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),-Math.cos(state.yaw)*Math.cos(state.pitch));
  function target(index){
    const dir=viewDirection();const side=index===0?-1:1;
    // An aimed raycast hits actual scene geometry; nearby roof anchors assist when the crosshair sees open sky.
    let point=world.grappleRay(camera.position,dir,128);
    const suggested=world.bestAnchor(state.position,dir,side);
    // Low wall hits get assisted to rooftop targets; two simultaneous hooks
    // favor distinct attachment points instead of clipping into one another.
    const other=state.hooks[1-index];
    if(!point||point.distanceTo(state.position)<7||(suggested&&point.y<state.position.y+3.5)
        ||(other&&point.distanceTo(other.point)<3&&suggested))point=suggested||point;
    if(!point)return null;
    const dist=point.distanceTo(state.position);
    if(dist<6||dist>129)return null;
    return point;
  }
  function fire(index){
    if(state.hooks[index])return false;
    const point=target(index);
    if(!point)return false;
    const dist=point.distanceTo(state.position);
    // A slack cable at attachment preserves momentum instead of snapping the body.
    state.hooks[index]={point,length:Math.max(7,dist),age:0};
    state.velocity.addScaledVector(point.clone().sub(state.position).normalize(),4.8);
    return true;
  }
  function release(index){state.hooks[index]=null;model.ropeLines[index].visible=false;model.tips[index].visible=false;}
  function reset(){
    state.position.set(8,1,-10);state.velocity.set(0,0,0);state.gas=100;state.health=100;state.grounded=true;state.aspect=null;form.visible=false;
    state.yaw=0;state.pitch=-.07;state.distance=0;state.speed=0;state.bank=0;state.boost=false;
    release(0);release(1);model.root.position.copy(state.position);model.root.rotation.set(0,0,0);model.tilt.rotation.set(0,0,0);
    camera.position.set(9.15,4.86,1.57);updateCamera(1,true);
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
      const goal=wish.clone().multiplyScalar((reeling?15:10.5)*speedMultiplier);const k=1-Math.exp(-dt*11);
      state.velocity.x=mix(state.velocity.x,goal.x,k);state.velocity.z=mix(state.velocity.z,goal.z,k);
      if(input.jumpQueued){state.velocity.y=12.6;state.grounded=false;}
      state.gas=clamp(state.gas+dt*15,0,100);
    }else{
      const acceleration=(activeHooks?19:13)*(state.aspect?.speed||1);
      state.velocity.addScaledVector(wish,dt*acceleration);
      const drag=Math.exp(-dt*(activeHooks?.11:.25));state.velocity.x*=drag;state.velocity.z*=drag;
    }
    input.jumpQueued=false;
    if(input.keys.has('Space')&&!state.grounded&&state.gas>0){
      const dir=viewDirection();state.velocity.addScaledVector(dir,dt*(activeHooks?37:32)*(state.aspect?.boost||1));
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
        const next=Math.max(minimum,hook.length-dt*21*(state.aspect?.reel||1));
        if(next<hook.length){hook.length=next;state.gas=Math.max(0,state.gas-dt*2.3);}
      }
      const towards=hook.point.clone().sub(state.position),dist=towards.length(),unit=towards.multiplyScalar(1/(dist||1));
      const excess=Math.max(0,dist-hook.length);
      if(excess>0){
        const radialSpeed=state.velocity.dot(unit);
        const force=Math.min(95,excess*12+Math.max(0,-radialSpeed)*6);
        state.velocity.addScaledVector(unit,force*dt);
      }
    }
    state.velocity.y-=25*dt;
    if(state.velocity.length()>77*(state.aspect?.speed||1))state.velocity.multiplyScalar(77*(state.aspect?.speed||1)/state.velocity.length());
    state.position.addScaledVector(state.velocity,dt);
    // Projection prevents rope stretching at high velocity or when reeling rapidly.
    for(let pass=0;pass<3;pass++)for(const hook of state.hooks){
      if(!hook)continue;
      const away=state.position.clone().sub(hook.point),len=away.length();
      if(len>hook.length){const normal=away.multiplyScalar(1/len);state.position.addScaledVector(normal,-(len-hook.length)*.94);
        const outward=state.velocity.dot(normal);if(outward>0)state.velocity.addScaledVector(normal,-outward*.94);
      }
    }
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
    const sideVel=state.velocity.dot(right);
    state.bank=mix(state.bank,clamp(-sideVel/60,-.5,.5),1-Math.exp(-dt*4.3));
    model.tilt.rotation.z=state.bank;
    model.tilt.rotation.x=mix(model.tilt.rotation.x,state.grounded?0:clamp(state.velocity.y/110-.22,-.65,.38),1-Math.exp(-dt*5));
    const walk=state.grounded?Math.sin(time*flatSpeed*.92)*clamp(flatSpeed/9,0,1):.28;
    model.legs[0].rotation.x=walk*.72+(state.grounded?0:-.39);
    model.legs[1].rotation.x=-walk*.72+(state.grounded?0:-.39);
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
    if(!state.firstPerson){
      const delta=desired.clone().sub(aim),dist=delta.length();let hit=world.grappleRay(aim,delta.clone().normalize(),dist);
      if(hit){const closer=Math.max(.35,hit.distanceTo(aim)-.55);desired.copy(aim).addScaledVector(delta.normalize(),closer);snap=true;}
    }
    desired.y=Math.max(.35,desired.y);
    if(snap||!finiteVector(camera.position))camera.position.copy(desired);
    else camera.position.lerp(desired,1-Math.exp(-dt*8));
    camera.position.y=Math.max(.35,camera.position.y);
    camera.lookAt(state.firstPerson?camera.position.clone().add(dir):aim.clone().addScaledVector(dir,9));
    const targetFov=state.speed>23?73+clamp((state.speed-23)*.12,0,8):72;
    camera.fov=mix(camera.fov,targetFov,1-Math.exp(-dt*3));camera.updateProjectionMatrix();
    model.root.visible=!state.firstPerson;
  }
  reset();
  return {...state,update,updateCamera,target,fire,release,reset,setAspect,clearAspect,takeDamage,heal,refillGas,attack,viewDirection,get recoveries(){return state.recoveries;},get position(){return state.position;},get velocity(){return state.velocity;},get gas(){return state.gas;},get health(){return state.health;},get aspect(){return state.aspect;},get speed(){return state.speed;},get hooks(){return state.hooks;},get grounded(){return state.grounded;},get yaw(){return state.yaw;},set yaw(v){state.yaw=v;},get pitch(){return state.pitch;},set pitch(v){state.pitch=clamp(v,-1.12,.88);},get firstPerson(){return state.firstPerson;},set firstPerson(v){state.firstPerson=v;}};
}
