import * as THREE from 'three';
import {enhanceTitanRig,TITAN_FORMS} from './titan-forms.js';
import {attachTitanGLB,animateTitanGLB,disposeTitanGLBVisual} from './titan-glb-models.js';

// Original Minecraft-style Titan rig. All dimensions are fractions of height;
// the front faces local -Z and the nape is on the opposite (+Z) side.
// No external textures, reference-game meshes, or rigs are used.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const boxGeometry=new THREE.BoxGeometry(1,1,1);

function cube(parent,name,size,position,material){
  const part=new THREE.Mesh(boxGeometry,material);
  part.name=name;part.scale.set(...size);part.position.set(...position);
  part.castShadow=true;part.receiveShadow=true;parent.add(part);
  return part;
}
function pivot(parent,name,position){
  const node=new THREE.Group();node.name=name;node.position.set(...position);
  parent.add(node);return node;
}
function pixelMark(kind){
  const size=32;
  if(typeof document!=='undefined'&&typeof document.createElement==='function'){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d');
    if(ctx){
      ctx.clearRect(0,0,size,size);
      ctx.fillStyle=kind==='alert'?'rgba(255,40,30,0.95)':'rgba(255,220,90,1)';
      if(kind==='alert'){
        ctx.beginPath();ctx.moveTo(16,2);ctx.lineTo(30,28);ctx.lineTo(2,28);ctx.closePath();ctx.fill();
        ctx.fillStyle='#50100b';ctx.fillRect(15,12,2,9);ctx.fillRect(15,24,2,2);
      }else{
        ctx.beginPath();ctx.arc(16,16,13,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff5bc';ctx.fillRect(13,7,6,18);ctx.fillRect(7,13,18,6);
      }
      const tex=new THREE.CanvasTexture(canvas);
      tex.magFilter=tex.minFilter=THREE.NearestFilter;
      tex.generateMipmaps=false;tex.colorSpace=THREE.SRGBColorSpace;
      return tex;
    }
  }
  // Node tests do not expose a DOM. Keep the procedural texture portable.
  const bytes=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const on=kind==='alert'?(y>2&&y<29&&Math.abs(x-16)<y*.48):((x-16)**2+(y-16)**2<169);
    if(!on)continue;
    const i=(y*size+x)*4;
    bytes[i]=255;bytes[i+1]=kind==='alert'?40:220;bytes[i+2]=kind==='alert'?30:90;bytes[i+3]=255;
  }
  const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function createVoxelTitanRig(scene,enemy,{color=0x9b675c,height=15}={}){
  const group=new THREE.Group();group.name='Voxel Titan '+enemy.id;
  // Moving Titans receive dynamic sun illumination and physically plausible
  // roughness; the static voxel buildings still use cheap baked lighting.
  const skin=new THREE.MeshStandardMaterial({color,roughness:.82,metalness:0,emissive:0x000000});
  const shade=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(.69),roughness:.88,metalness:0});
  const highlight=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(1.17),roughness:.75,metalness:0});
  const eye=new THREE.MeshStandardMaterial({color:0x221b1b,roughness:.29,metalness:0});
  const mouth=new THREE.MeshStandardMaterial({color:0x542a2e,roughness:.92,metalness:0});
  const gear=new THREE.MeshStandardMaterial({color:0x48443c,roughness:.66,metalness:.04});
  const armor=new THREE.MeshStandardMaterial({color:0x8a8275,roughness:.48,metalness:.05});
  const hips=pivot(group,'hips',[0,.54,0]);
  cube(hips,'pelvis',[.25,.13,.165],[0,-.025,0],shade);
  const torso=pivot(hips,'torso',[0,.06,0]);
  cube(torso,'chest',[.29,.33,.19],[0,.135,0],skin);
  cube(torso,'sternum',[.135,.20,.016],[0,.145,-.102],highlight);
  cube(torso,'collar',[.33,.055,.21],[0,.29,0],shade);
  // Ribs and block-scale anatomical accents improve readability at long range.
  for(const sign of [-1,1]){
    cube(torso,'rib',[.062,.11,.025],[sign*.105,.125,-.108],shade);
  }
  const neck=pivot(torso,'neck',[0,.355,0]);
  cube(neck,'neck block',[.1,.095,.11],[0,-.005,0],skin);
  const head=pivot(neck,'head',[0,.08,0]);
  cube(head,'head block',[.235,.235,.22],[0,.025,0],skin);
  cube(head,'brow',[.235,.045,.02],[0,.087,-.119],shade);
  for(const sign of [-1,1]){
    cube(head,'eye',[.040,.032,.018],[sign*.061,.035,-.119],eye);
    cube(head,'cheek',[.056,.045,.020],[sign*.076,-.039,-.117],highlight);
  }
  cube(head,'mouth',[.098,.023,.018],[0,-.065,-.122],mouth);
  const arms={};
  for(const side of ['left','right']){
    const sign=side==='left'?-1:1;
    const shoulder=pivot(torso,side+' shoulder',[sign*.182,.265,0]);
    cube(shoulder,side+' upper arm',[.095,.22,.12],[sign*.002,-.105,0],skin);
    cube(shoulder,side+' deltoid',[.121,.08,.136],[sign*.002,-.034,0],highlight);
    const elbow=pivot(shoulder,side+' elbow',[0,-.214,0]);
    cube(elbow,side+' forearm',[.090,.218,.116],[0,-.103,-.007],shade);
    cube(elbow,side+' fist',[.113,.096,.133],[0,-.234,-.025],skin);
    arms[side]={shoulder,elbow};
  }
  const legs={};
  for(const side of ['left','right']){
    const sign=side==='left'?-1:1;
    const hip=pivot(hips,side+' hip',[sign*.072,-.080,0]);
    cube(hip,side+' thigh',[.115,.225,.132],[0,-.115,0],skin);
    const knee=pivot(hip,side+' knee',[0,-.222,0]);
    cube(knee,side+' shin',[.105,.223,.116],[0,-.112,0],shade);
    cube(knee,side+' foot',[.121,.071,.203],[0,-.246,-.048],skin);
    legs[side]={hip,knee};
  }
  if(enemy.type==='armored'){
    cube(torso,'armored breastplate',[.296,.21,.028],[0,.16,-.114],armor);
    cube(head,'armor crest',[.19,.055,.244],[0,.155,0],armor);
    for(const side of ['left','right'])cube(arms[side].shoulder,'armor shoulder',[.133,.095,.15],[0,-.08,0],armor);
  }else if(enemy.type==='beast'){
    cube(torso,'beast mantle',[.38,.13,.25],[0,.29,0],gear);
    for(const side of ['left','right'])cube(head,'beast ear',[.065,.125,.08],[side==='left'?-.126:.126,.132,0],gear);
  }else if(enemy.type==='colossus'){
    for(const sign of [-1,1])cube(torso,'muscle plate',[.12,.24,.027],[sign*.09,.14,-.12],mouth);
  }
  const weak=new THREE.Sprite(new THREE.SpriteMaterial({
    map:pixelMark('nape'),transparent:true,depthWrite:false,alphaTest:.1,opacity:.92
  }));
  weak.name='nape marker';weak.position.set(0,.81,.18);weak.scale.set(.12,.12,1);
  group.add(weak);
  const alert=new THREE.Sprite(new THREE.SpriteMaterial({
    map:pixelMark('alert'),transparent:true,depthWrite:false,alphaTest:.1,opacity:.95
  }));
  alert.name='alert marker';alert.position.set(0,1.28,0);alert.scale.set(.14,.14,1);
  alert.visible=false;group.add(alert);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.30,12),
    new THREE.MeshBasicMaterial({color:0x171b20,transparent:true,opacity:.24,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.003;group.add(shadow);
  group.scale.setScalar(height);group.position.copy(enemy.position);
  scene.add(group);
  const rig={group,hips,torso,neck,head,arms,legs,weak,alert,skin,
    materials:[skin,shade,highlight,eye,mouth,gear,armor],height,flash:0,gait:0,death:0};
  if(TITAN_FORMS[enemy.type])enhanceTitanRig(rig,enemy.type);
  // Keep the lightweight voxel fallback for distance LOD. Enemy GLBs load
  // only once the player gets close; player-controlled Titans load at once.
  rig.fallbackMeshes=[];
  rig.group.traverse(node=>{
    if(node.isMesh&&node.geometry?.type!=='CircleGeometry')rig.fallbackMeshes.push(node);
  });
  if(TITAN_FORMS[enemy.type]){
    if(enemy.id==='human-shifter')attachTitanGLB(rig,enemy.type);
    else rig.modelStatus='deferred';
  }
  return rig;
}

const targetQuat=(x=0,y=0,z=0)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'XYZ'));
export function smoothVoxelJoint(node,x,y,z,dt,response=12){
  node.quaternion.slerp(targetQuat(x,y,z),clamp(1-Math.exp(-Math.max(0,dt)*response),0,1));
}

export function animateVoxelTitanRig(rig,enemy,dt,time=0){
  const moving=clamp(enemy.moving||0,0,1),alerted=['pursue','windup','lunge','strike','recover'].includes(enemy.state);
  const speed=enemy.speed||3;
  if(moving>0.03)rig.gait+=dt*(enemy.cycleRate||Math.max(.7,speed*.48))*Math.PI*2*clamp(moving,.2,1);
  const walk=Math.sin(rig.gait)*.53*moving;
  const breathing=Math.sin(time*1.5+rig.height)*.014;
  const phase=enemy.attackPhase||'idle';
  const windup=phase==='windup',lunge=phase==='lunge',strike=phase==='strike';
  const stagger=enemy.stagger>0;
  // Procedural pose bones are invisible when a GLB is displayed. Avoid
  // computing dozens of slerps at 48 Hz for hidden fallback geometry.
  const displayingGLB=rig.modelStatus==='loaded'&&rig.modelVisual?.visible;
  if(!displayingGLB){
  rig.hips.position.y=.54+Math.abs(Math.sin(rig.gait))*.007*moving;
  smoothVoxelJoint(rig.torso,breathing+(lunge?-.33:windup?.23:strike?-.29:0)+(stagger?.23:0),
    strike?.17:Math.sin(time*.65)*.035,walk*.085,dt,11);
  smoothVoxelJoint(rig.neck,windup?-.12:strike?.16:0,Math.sin(time*.8)*.13,0,dt,9);
  smoothVoxelJoint(rig.head,alerted?-.06:.04,Math.sin(time*.58)*.055,0,dt,8);
  for(const side of ['left','right']){
    const sign=side==='left'?-1:1,arm=rig.arms[side],leg=rig.legs[side];
    const held=enemy[side==='left'?'armLeft':'armRight']>0;
    arm.shoulder.visible=!held;
    const attackArm=(side==='right'&&!(enemy.armRight>0))||(side==='left'&&enemy.armRight>0);
    const attackPose=attackArm?(windup?-1.05:lunge?-.45:strike?.97:0):0;
    smoothVoxelJoint(arm.shoulder,sign*walk*.72+attackPose,0,-sign*(.08+(windup?.15:0)),dt,14);
    smoothVoxelJoint(arm.elbow,windup?.43:attackArm&&strike?-1.02:-.13,0,0,dt,15);
    smoothVoxelJoint(leg.hip,-sign*walk*.85+(lunge?-.17:0),0,sign*.045,dt,10);
    smoothVoxelJoint(leg.knee,Math.max(0,sign*walk)*.65+.08,0,0,dt,10);
  }
  }
  if(displayingGLB)animateTitanGLB(rig,enemy,dt,time);
  rig.alert.visible=alerted;
  rig.alert.material.opacity=.72+.25*Math.sin(time*5)**2;
  rig.weak.material.opacity=enemy.state==='stagger'?1:.7+.26*Math.sin(time*3)**2;
  rig.weak.scale.setScalar(enemy.state==='stagger'?.18:.12);
  rig.weak.scale.z=1;
  rig.flash=Math.max(0,rig.flash-dt*3.5);
  const alertPower=alerted?.12:0;
  // Restrained emissive pulse makes attacks readable under voxel lighting.
  rig.skin.emissive.setRGB(
    .55*alertPower+rig.flash*.6,
    .06*alertPower+rig.flash*.6,
    .03*alertPower+rig.flash*.6
  );
  if(!enemy.alive){
    rig.death=Math.min(1.5,rig.death+dt);
    smoothVoxelJoint(rig.hips,0,0,-Math.min(1,rig.death)*1.45,dt,6);
    rig.group.visible=rig.death<1.5;
    rig.alert.visible=false;rig.weak.visible=false;
  }else{
    rig.death=0;rig.group.visible=true;rig.weak.visible=true;
    smoothVoxelJoint(rig.hips,0,0,0,dt,8);
  }
}

export function disposeVoxelTitanRig(scene,rig){
  rig.disposed=true;
  disposeTitanGLBVisual(rig);
  scene.remove(rig.group);
  for(const marker of [rig.weak,rig.alert]){
    marker.material.map?.dispose();marker.material.dispose();
  }
  for(const material of [...rig.materials])material.dispose();
}
