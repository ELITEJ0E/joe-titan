import * as THREE from 'three';

// Original, hand-directed block sculpture layers for JOE TITAN.
// These are geometry approximations of nine recognizable silhouettes, not
// mesh reconstructions from the 2D reference renders.
export const TITAN_FORMS=Object.freeze({
  attack:   {name:'Attack Titan',height:15,speed:12,health:300,damage:40,reach:8,special:'Berserk Rush',cooldown:13,color:0xa87861},
  armored:  {name:'Armored Titan',height:15,speed:8,health:450,damage:55,reach:9,special:'Armor Charge',cooldown:16,color:0xb9a487},
  colossal: {name:'Colossal Titan',height:60,speed:4,health:850,damage:100,reach:20,special:'Steam Eruption',cooldown:22,color:0xa64138},
  female:   {name:'Female Titan',height:14,speed:13,health:320,damage:40,reach:8,special:'Crystal Hardening',cooldown:15,color:0xc79c85},
  beast:    {name:'Beast Titan',height:17,speed:9,health:370,damage:48,reach:12,special:'Boulder Barrage',cooldown:18,color:0x654437},
  jaw:      {name:'Jaw Titan',height:5,speed:20,health:215,damage:40,reach:5,special:'Predator Leap',cooldown:11,color:0xbe9071},
  cart:     {name:'Cart Titan',height:4,speed:18,health:220,damage:28,reach:6,special:'Stampede',cooldown:12,color:0xa67e65},
  warhammer:{name:'War Hammer Titan',height:15,speed:9,health:390,damage:65,reach:13,special:'Crystal Hammer',cooldown:16,color:0xd5d1c6},
  founding: {name:'Founding Titan',height:55,speed:5,health:1000,damage:95,reach:25,special:'Spinal Shockwave',cooldown:25,color:0x957b71}
});
export const TITAN_ORDER=Object.freeze(Object.keys(TITAN_FORMS));
const GEO=new THREE.BoxGeometry(1,1,1);
const C={skin:0xcfa184,skin2:0xe0b596,muscle:0x873b38,muscle2:0xb65449,
  tendon:0xe8c8aa,bone:0xd8c6aa,armor:0xc6aa7e,armorDark:0x9c815d,
  fur:0x523729,fur2:0x70503a,hair:0x271c1a,blond:0xc4a174,
  white:0xece8dc,ice:0xd9edf0,black:0x211b1c,
  eyes:0x73d5b2,blue:0x8fb9c8,teeth:0xe9ded0,shadow:0x522c2b};
const SPECIAL_PALETTE={
  colossal:{skin:'muscle2',skin2:'muscle',muscle:'muscle2'},
  armored:{skin:'muscle',skin2:'muscle2'},
  beast:{skin:'fur',skin2:'fur2',muscle:'fur'},
  warhammer:{skin:'white',skin2:'white',muscle:'white',tendon:'white'},
  founding:{skin:'bone',skin2:'muscle',muscle:'muscle'},
};
function material(k){return new THREE.MeshStandardMaterial({
  color:C[k],roughness:k==='ice'?.47:.86,metalness:0,
  flatShading:true
});}
// Per-joint, per-material instancing keeps detailed geometry inexpensive.
// Each part still follows the existing rig's shoulders/elbows/hips/knees.
class Sculpt {
  constructor(){this.instances=new Map();this.materials=new Map();this.tmp=new THREE.Object3D();this.meshes=[];}
  add(parent,k,x,y,z,w,h,d,rx=0,ry=0,rz=0){
    let byMat=this.instances.get(parent);
    if(!byMat){byMat=new Map();this.instances.set(parent,byMat);}
    if(!byMat.has(k))byMat.set(k,[]);
    byMat.get(k).push([x,y,z,w,h,d,rx,ry,rz]);
  }
  beam(parent,k,a,b,r=.012){
    const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),dir=B.clone().sub(A);
    if(dir.length()<.00001)return;
    const center=A.add(B).multiplyScalar(.5);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());
    const e=new THREE.Euler().setFromQuaternion(q);
    this.add(parent,k,center.x,center.y,center.z,r,dir.length(),r,e.x,e.y,e.z);
  }
  // Faceted elliptical cross-sections form muscle groups with fine, visibly
  // square facets instead of low-poly capsules / featureless Minecraft cubes.
  shell(parent,center,radii,materialFn,{layers=9,sides=13}={}){
    const [cx,cy,cz]=center,[rx,ry,rz]=radii;
    for(let i=0;i<layers;i++){
      const t=(i+.5)/layers*2-1;
      const ring=Math.sqrt(Math.max(.09,1-t*t));
      for(let j=0;j<sides;j++){
        const a=(j+.5)*Math.PI*2/sides;
        const x=cx+rx*ring*Math.cos(a),z=cz+rz*ring*Math.sin(a);
        const kind=materialFn(i,j,a,t);
        if(!kind)continue;
        this.add(parent,kind,x,cy+ry*t,z,
          Math.max(.009,rx*ring*2.45/sides),Math.max(.011,ry*2/layers*1.17),
          Math.max(.009,rz*ring*2.45/sides),0,-a,0);
      }
    }
  }
  finish(){
    for(const [parent,sets] of this.instances){
      for(const [kind,items] of sets){
        if(!this.materials.has(kind))this.materials.set(kind,material(kind));
        const mesh=new THREE.InstancedMesh(GEO,this.materials.get(kind),items.length);
        mesh.name='detail / '+kind;
        mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
        items.forEach(([x,y,z,w,h,d,rx,ry,rz],i)=>{
          this.tmp.position.set(x,y,z);this.tmp.scale.set(w,h,d);
          this.tmp.rotation.set(rx,ry,rz);this.tmp.updateMatrix();
          mesh.setMatrixAt(i,this.tmp.matrix);
        });
        mesh.instanceMatrix.needsUpdate=true;
        parent.add(mesh);this.meshes.push(mesh);
      }
    }
    return {meshes:this.meshes,materials:[...this.materials.values()]};
  }
}
const stripes=(i,j)=>((i*7+j*3)%9<3?'tendon':(j%4===0?'muscle2':'muscle'));
function sculptHead(s,head,kind){
  const armored=kind==='armored',colossal=kind==='colossal',white=kind==='warhammer';
  const face=white?'white':armored?'armor':colossal?'muscle2':'skin';
  // Layered forehead, angular brows, deep sockets, block teeth, cheek hollows.
  for(let side of [-1,1]){
    s.add(head,face,side*.074,.064,-.125,.078,.068,.026);
    s.add(head,colossal?'tendon':armored?'armorDark':'shadow',side*.063,.043,-.143,.058,.030,.024);
    s.add(head,kind==='female'?'blue':kind==='attack'?'eyes':white?'shadow':armored?'eyes':'eyes',
      side*.061,.034,-.162,.023,.017,.014);
    s.add(head,colossal?'muscle':'muscle2',side*.112,-.028,-.108,.028,.079,.022);
    if(['attack','beast','jaw','founding'].includes(kind)){
      const ear=kind==='beast'?'skin':'tendon';
      s.add(head,ear,side*.155,.038,-.007,.073,.060,.055,0,0,side*.32);
    }
  }
  s.add(head,kind==='jaw'?'bone':face,0,.114,-.108,.19,.060,.060);
  s.add(head,white?'white':kind==='jaw'?'bone':kind==='colossal'?'tendon':'skin2',
    0,-.068,-.146,.17,.058,.031);
  s.add(head,'shadow',0,-.063,-.168,.146,.033,.013);
  for(let i=0;i<11;i++){
    s.add(head,'teeth',(i-5)*.0129,-.058,-.178,.010,.025,.009);
  }
  if(armored){
    for(let side of [-1,1]){
      s.add(head,'armor',side*.092,.11,-.093,.091,.072,.056);
      s.add(head,'armorDark',side*.12,-.017,-.113,.054,.095,.044);
      s.add(head,'armor',side*.06,-.09,-.16,.075,.048,.035);
    }
    s.add(head,'armor',0,.176,0,.21,.036,.20);
  }
  if(white){
    for(let i=0;i<7;i++)s.add(head,'white',(i-3)*.026,-.065,-.17,.015,.10,.033);
    s.add(head,'white',0,.153,0,.22,.080,.23);
  }
  if(kind==='jaw'){
    s.add(head,'bone',0,.14,-.12,.23,.055,.11);
    for(let side of [-1,1]){
      s.add(head,'bone',side*.119,-.034,-.16,.066,.17,.069);
      for(let i=0;i<4;i++)s.add(head,'teeth',side*(.035+i*.03),-.102,-.181,.016,.060,.016);
    }
  }
  if(kind==='beast'){
    for(let i=0;i<8;i++)s.add(head,'fur',(i-3.5)*.027,-.098,-.106,.025,.10,.031);
  }
}
function sculptHair(s,head,kind){
  if(['colossal','warhammer'].includes(kind))return;
  const hair=kind==='female'||kind==='armored'||kind==='jaw'?'blond':kind==='beast'?'fur':'hair';
  const long=['attack','founding','beast'].includes(kind);
  const count=long?34:28;
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2;
    const x=Math.cos(a)*.124,z=Math.sin(a)*.115;
    const front=z<-.015;
    const len=kind==='armored'?.055:kind==='female'?.14:kind==='jaw'?.16:long?(front?.22:.29):.12;
    const y=.15-len*.48;
    s.add(head,hair,x,y,z,.028,len,.030,Math.cos(a)*.055,0,Math.sin(a)*.048);
    if(long&&i%3===0)s.add(head,hair,x*1.13,y-len*.43,z*1.17,.019,len*.69,.020);
  }
  for(let i=0;i<14;i++){
    const a=i*Math.PI*2/14;
    s.add(head,hair,Math.cos(a)*.095,.169,Math.sin(a)*.093,.046,.044,.051);
  }
}
function sculptHumanoid(s,rig,kind){
  const pal=SPECIAL_PALETTE[kind]||{};
  const sk=pal.skin||'skin',alt=pal.skin2||'skin2',mus=pal.muscle||'muscle';
  const tissue=(i,j,a)=>kind==='beast'?'fur':kind==='warhammer'?'white':
    kind==='armored'?(Math.sin(a)<-.24&&(i+j)%3!==0?'armor':'muscle'):
    kind==='colossal'?stripes(i,j):
    kind==='founding'?(i+j)%4===0?'bone':mus:
    (Math.sin(a)<-.25&&(i+j)%5>1?mus:(i+j)%3===0?'tendon':sk);
  s.shell(rig.torso,[0,.152,0],[kind==='beast'?.205:.168,.177,.128],tissue,{layers:13,sides:16});
  // Defined separate pectorals and nested abdominal muscle fibers.
  for(let sign of [-1,1]){
    s.shell(rig.torso,[sign*.089,.228,-.108],[.088,.072,.048],
      (i,j)=>kind==='armored'?'armor':kind==='warhammer'?'white':(i+j)%3?'muscle2':'tendon',
      {layers:7,sides:12});
    for(let k=0;k<4;k++){
      s.add(rig.torso,kind==='warhammer'?'white':kind==='armored'?'armor':'tendon',
        sign*.05,.185-k*.062,-.147,.078,.039,.019);
    }
    const sh=rig.arms[sign<0?'left':'right'];
    s.shell(sh.shoulder,[0,-.102,0],[kind==='beast'?.104:.082,.135,.082],
      (i,j)=>kind==='armored'?'armor':kind==='beast'?(j%4?'fur':'fur2'):tissue(i,j,1),{layers:12,sides:12});
    s.shell(sh.elbow,[0,-.105,0],[.064,.124,.070],
      (i,j)=>kind==='armored'?'armor':kind==='beast'?(j%3?'fur':'fur2'):tissue(i,j,.7),{layers:10,sides:11});
    const leg=rig.legs[sign<0?'left':'right'];
    s.shell(leg.hip,[0,-.115,0],[kind==='beast'?.097:.087,.152,.098],
      (i,j)=>kind==='armored'?'armor':kind==='beast'?'fur2':tissue(i,j,1),{layers:11,sides:12});
    s.shell(leg.knee,[0,-.116,0],[.068,.139,.078],
      (i,j)=>kind==='armored'?'armor':kind==='beast'?'fur':tissue(i,j,1),{layers:10,sides:11});
    // Articulated fingers rather than a single featureless fist.
    for(let f=0;f<4;f++){
      s.add(sh.elbow,kind==='jaw'?'bone':kind==='warhammer'?'white':'tendon',
        (f-1.5)*.025,-.288,-.054,.019,.084,.024,0,0,(f-1.5)*.08);
    }
    for(let f=0;f<4;f++){
      s.add(leg.knee,kind==='jaw'?'bone':kind==='warhammer'?'white':'tendon',
        (f-1.5)*.027,-.282,-.159,.022,.024,.102);
    }
    if(kind==='armored'){
      const plate=sh.shoulder;
      s.add(plate,'armor',0,-.042,-.045,.174,.10,.155);
      s.add(leg.hip,'armor',0,-.102,-.079,.137,.173,.056);
      s.add(leg.knee,'armor',0,-.113,-.074,.116,.181,.051);
    }
    if(kind==='beast'){
      for(let f=0;f<18;f++){
        const a=f*2.399,r=.078+(f%3)*.011;
        s.add(sh.shoulder,f%3?'fur':'fur2',Math.cos(a)*r,-.11+(f%8)*.025,Math.sin(a)*r,.028,.071,.029);
      }
    }
    if(kind==='warhammer'){
      s.beam(rig.torso,'ice',[sign*.12,.33,.11],[sign*.23,.55,.29],.038);
      s.beam(sh.elbow,'white',[0,-.03,-.12],[sign*.13,-.19,-.24],.034);
    }
  }
  sculptHead(s,rig.head,kind);sculptHair(s,rig.head,kind);
  if(kind==='colossal'){
    for(let k=0;k<10;k++)for(let sign of [-1,1])
      s.beam(rig.torso,k%3?'tendon':'skin2',[sign*.03,.29-k*.027,-.144],[sign*(.14+(k%2)*.01),.29-k*.030,-.115],.013);
  }
  if(kind==='warhammer'){
    // Crystal hammer uses a continuous angled shaft and a heavy, faceted head.
    const wrist=rig.arms.right.elbow;
    s.beam(wrist,'white',[0,-.17,-.06],[.24,-.95,-.26],.048);
    for(let a=0;a<12;a++){
      const theta=a/12*Math.PI*2;
      s.add(wrist,'ice',.24+Math.cos(theta)*.103,-.95+Math.sin(theta)*.095,-.26,
        .064,.28,.064,0,theta,0);
    }
    s.add(wrist,'white',.24,-.95,-.26,.28,.38,.23);
  }
  if(kind==='founding'){
    // The enormous ribbed spinal outline is the recognizable defining feature.
    for(let k=0;k<22;k++){
      const y=.33-k*.055,z=.12+k*.045;
      s.add(rig.group,'bone',0,y,z,.067,.04,.086);
      if(k%2===0)for(let sign of [-1,1]){
        const x=.20+(k%4)*.025;
        s.beam(rig.group,'bone',[0,y,z],[sign*x,y-.055,z+.18],.020);
        s.beam(rig.group,'bone',[sign*x,y-.055,z+.18],[sign*(x+.12),y-.23,z+.24],.016);
      }
    }
    for(let i=0;i<9;i++)for(let sign of [-1,1]){
      const z=.22+i*.078;
      s.beam(rig.group,'bone',[sign*.10,.72,z],[sign*(.4+i*.055),.46,z+.16],.018);
      s.beam(rig.group,'bone',[sign*(.4+i*.055),.46,z+.16],[sign*(.45+i*.067),-.14,z+.25],.016);
    }
  }
}
function sculptCart(s,rig){
  rig.hips.visible=false;
  const body=new THREE.Group();body.name='cart quadruped';rig.group.add(body);
  s.shell(body,[0,.49,.05],[.205,.165,.41],(i,j)=>j%4===0?'muscle':'skin',{layers:11,sides:17});
  // Low, elongated muzzle and paired eyes.
  s.shell(body,[0,.48,-.45],[.126,.128,.18],()=>'skin2',{layers:9,sides:12});
  s.add(body,'shadow',0,.42,-.618,.17,.052,.019);
  for(let side of [-1,1]){
    s.add(body,'eyes',side*.069,.522,-.613,.021,.020,.014);
    s.add(body,'teeth',side*.045,.421,-.635,.056,.021,.014);
  }
  for(let i=0;i<21;i++){
    const x=(i%7-3)*.040,z=-.43+Math.floor(i/7)*.058;
    s.add(body,'hair',x,.598,z,.036,.13,.027);
  }
  const legs=[];
  for(const front of [-1,1])for(const side of [-1,1]){
    const joint=new THREE.Group();
    joint.name='cart '+(front<0?'front':'rear')+' '+(side<0?'left':'right');
    joint.position.set(side*.157,.43,front<0?-.23:.32);body.add(joint);
    s.shell(joint,[0,-.18,0],[.068,.23,.078],(i,j)=>j%4===0?'muscle':'skin',{layers:10,sides:12});
    s.add(joint,'skin2',0,-.362,-.044,.102,.073,.16);
    for(let f=0;f<4;f++)s.add(joint,'tendon',(f-1.5)*.029,-.391,-.124,.024,.041,.07);
    legs.push(joint);
  }
  // Cargo rack is canonical for Cart's equipment configuration.
  s.add(body,'armorDark',0,.68,.13,.39,.055,.52);
  for(let side of [-1,1])for(let z of [-.04,.19,.39]){
    s.add(body,'armor',side*.14,.77,z,.16,.18,.19);
    s.add(body,'shadow',side*.14,.86,z,.17,.028,.20);
  }
  rig.cart={body,legs};rig.head.visible=false;
}
export function enhanceTitanRig(rig,kind){
  if(!TITAN_FORMS[kind])return rig;
  const s=new Sculpt();
  if(kind==='cart')sculptCart(s,rig);
  else sculptHumanoid(s,rig,kind);
  const result=s.finish();
  rig.variant=kind;rig.detailMeshes=result.meshes;rig.materials.push(...result.materials);
  return rig;
}