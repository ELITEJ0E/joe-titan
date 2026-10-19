import * as THREE from 'three';
import {resolveWorldCollision} from './collision.js';
import {decorateReferenceLandmarks} from './voxel-landmarks.js';
import {ATMOSPHERE_DEFAULTS,sampleCinematicAtmosphere,createSkyUniforms,updateSkyUniforms,CINEMATIC_SKY_VERTEX,CINEMATIC_SKY_FRAGMENT} from './cinematic-atmosphere.js';
import {makeVoxelPBRMaterial} from './voxel-surface-detail.js';
import {createSpatialColliderIndex} from './spatial-collider-index.js';

// A self-contained, low-draw-call voxel-inspired medieval city.
// All building blocks sharing a material and 120m chunk become one InstancedMesh;
// no third-party textures, GLB downloads or per-block draw calls are required.
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const random=(seed)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
const CHUNK=150;
// Small generated Minecraft-inspired block textures. Patterns are original
// (no Mojang textures); nearest filtering retains individual pixel edges.
function pixelMaterial(color,seed,variation=27,kind=''){
  if(typeof document==='undefined')return new THREE.MeshStandardMaterial({color,roughness:.84});
  const rng=random(seed),canvas=document.createElement('canvas');
  canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext('2d');
  const base=new THREE.Color(color);
  const masonry=/stone|rock|limestone|brick|road|slate|trim|cobble/.test(kind);
  const roof=/roof|tile|slate/.test(kind);
  const timber=/timber|wood|plank/.test(kind);
  const foliage=/leaf|grass|moss|shrub/.test(kind);
  for(let y=0;y<64;y+=4)for(let x=0;x<64;x+=4){
    const grain=(rng()-.5)*variation/255;
    const c=base.clone().offsetHSL((rng()-.5)*.009,0,grain);
    ctx.fillStyle='#'+c.getHexString();
    ctx.fillRect(x,y,4,4);
    if(rng()<.11){ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(x+1,y+1,2,2);}
  }
  // Irregular masonry courses and staggered terracotta roof shingles.
  if(masonry||roof){
    const row=roof?8:12,unit=roof?12:18;
    for(let y=0;y<64;y+=row){
      ctx.fillStyle=roof?'rgba(35,16,12,.28)':'rgba(45,39,38,.22)';
      ctx.fillRect(0,y,64,1);
      const shift=(Math.floor(y/row)%2)*Math.floor(unit/2);
      for(let x=-shift;x<64;x+=unit)ctx.fillRect(x,y,1,row);
      if(roof){ctx.fillStyle='rgba(255,206,132,.11)';ctx.fillRect(0,y+1,64,1);}
    }
  }
  if(timber){
    for(let x=2;x<64;x+=12){ctx.fillStyle='rgba(27,17,14,.22)';ctx.fillRect(x,0,2,64);}
    for(let i=0;i<45;i++){ctx.fillStyle=rng()<.5?'rgba(245,186,115,.1)':'rgba(40,24,15,.18)';ctx.fillRect(rng()*64,rng()*64,1,3+rng()*11);}
  }
  if(foliage)for(let i=0;i<92;i++){ctx.fillStyle=rng()<.5?'rgba(19,50,20,.18)':'rgba(220,227,116,.18)';ctx.fillRect(rng()*64,rng()*64,4,4);}
  const texture=new THREE.CanvasTexture(canvas);
  texture.magFilter=THREE.NearestFilter;
  texture.minFilter=THREE.NearestFilter;
  texture.generateMipmaps=false;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=1;
  if(kind==='water')return new THREE.MeshPhysicalMaterial({
    map:texture,color:0xbad9e7,roughness:.18,metalness:.04,
    clearcoat:.85,clearcoatRoughness:.17,
    transparent:true,opacity:.82,depthWrite:false,side:THREE.DoubleSide
  });
  return makeVoxelPBRMaterial(texture,kind,seed);
}
function makePalette(){
  const p={
    limestone:0xd3c8b6,stone:0x9d978d,stoneDark:0x605e60,
    rock:0x92928b,rockDeep:0x5f6667,moss:0x627b54,
    plaster:0xd8c3a6,plasterCream:0xece0c6,plasterDark:0xc6b79c,
    timber:0x50382d,wood:0x896244,woodDark:0x392a27,
    roofRed:0xa75137,roofOrange:0xc2744d,roofDark:0x703f3a,roofTile:0xba6044,
    slate:0x64717a,trim:0xe0c5a3,brick:0xae745b,
    grass:0x668451,leaves:0x477b43,leavesLight:0x7ea75c,shrub:0x648f44,
    road:0x9c9a90,roadLight:0xb9aa91,cobble:0x777771,water:0x387e9e,foam:0x94c6cd,
    gold:0xd2ab62,glass:0x6a8eab,glow:0xffcb85,banner:0xb34c43,
    sand:0xc8b78c,flower:0xc68d6a
  };
  return Object.fromEntries(Object.entries(p).map(([name,color],i)=>[name,pixelMaterial(color,3001+i*918,24+8*(i%3),name)]));
}
function addAtmosphere(scene,sample){
  const uniforms=createSkyUniforms(sample);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(1000,24,16),
    new THREE.ShaderMaterial({uniforms,vertexShader:CINEMATIC_SKY_VERTEX,
      fragmentShader:CINEMATIC_SKY_FRAGMENT,side:THREE.BackSide,depthWrite:false,
      depthTest:false,fog:false,toneMapped:true}));
  sky.name='Voxel atmospheric sky';
  sky.frustumCulled=false;sky.renderOrder=-1000;
  sky.onBeforeRender=(_r,_s,camera)=>{sky.position.copy(camera.position);sky.updateMatrixWorld();};
  scene.add(sky);
  return {sky,uniforms};
}
export function createVoxelWorld(scene){
  const rng=random(406157),palette=makePalette();
  const world={
    colliders:[],anchors:[],grappleMeshes:[],beacons:[],lamps:[],smoke:[],districtRoads:[],
    landmarks:{cathedral:[0,-28],plaza:[42,30],citadel:[-98,-90],arena:[-92,38],market:[93,51],townHall:[91,5],harbour:[105,98],canalZ:117},
    spawnPoint:V(35,1,32),style:'voxel',elapsed:0
  };
  const atmosphereValues={...ATMOSPHERE_DEFAULTS};
  let atmosphere=sampleCinematicAtmosphere(atmosphereValues);
  scene.background=atmosphere.horizon.clone();
  scene.fog=new THREE.FogExp2(atmosphere.fog,.00135*atmosphere.fogStrength);
  const skyLayer=addAtmosphere(scene,atmosphere);
  const hemisphere=new THREE.HemisphereLight(0xffe8ce,0x5c675f,atmosphere.ambient);
  scene.add(hemisphere);
  scene.add(new THREE.AmbientLight(0xffedd7,.22));
  const sunlight=new THREE.DirectionalLight(atmosphere.sunColor,atmosphere.sunlight);
  sunlight.position.copy(atmosphere.sunDirection).multiplyScalar(260);
  sunlight.castShadow=true;sunlight.shadow.mapSize.set(1024,1024);
  sunlight.shadow.camera.left=-194;sunlight.shadow.camera.right=194;
  sunlight.shadow.camera.top=194;sunlight.shadow.camera.bottom=-194;
  sunlight.shadow.camera.near=1;sunlight.shadow.camera.far=460;
  sunlight.shadow.bias=-.00022;sunlight.shadow.normalBias=.04;
  scene.add(sunlight);world.sun=sunlight;
  const groundMaterial=pixelMaterial(0x70905c,1911,12);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(810,810),groundMaterial);
  ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=true;
  scene.add(ground);

  const collections=new Map();
  const collidable=[];
  function block(kind,x,y,z,w,h,d){
    if(![x,y,z,w,h,d].every(Number.isFinite)||Math.min(w,h,d)<=0)return;
    const cx=Math.floor((x+192)/CHUNK),cz=Math.floor((z+192)/CHUNK);
    const key=kind+':'+cx+':'+cz;
    if(!collections.has(key))collections.set(key,{kind,boxes:[],cx,cz});
    collections.get(key).boxes.push([x,y,z,w,h,d]);
  }
  function terrain(x,z,w,d,kind='road'){
    block(kind,x,.01,z,w,.17,d);
  }
  function obstacle(x,z,w,d,h,{anchors=true}={}){
    const c={x,z,h,halfW:w/2,halfD:d/2};
    world.colliders.push(c);collidable.push(c);
    if(anchors)for(const sx of [-1,1])for(const sz of [-1,1]){
      world.anchors.push(V(x+sx*w*.43,h+.8,z+sz*d*.43));
    }
    return c;
  }
  function road(x,z,w,d){
    terrain(x,z,w,d);
    if(w>d)world.districtRoads.push({a:[x-w/2,z],b:[x+w/2,z]});
    else world.districtRoads.push({a:[x,z-d/2],b:[x,z+d/2]});
  }
  // Cross streets, small cobbled courtyards and gates are left clear of houses.
  for(const x of [-132,-66,0,66,132])road(x,0,8,348);
  for(const z of [-132,-66,0,66,132])road(0,z,348,8);
  road(42,30,76,32);road(0,-28,66,88);
  terrain(42,30,66,29,'roadLight');
  terrain(91,51,58,42,'roadLight');
  const exclusion=[
    [42,30,41,28],[0,-28,37,49],[-98,-90,34,34],
    [-92,38,31,26],[91,51,41,32],[91,5,23,20],[105,98,29,23],
    [35,32,11,13],[8,-12,12,12]
  ];
  const intersectsReserved=(x,z,w,d)=>exclusion.some(([px,pz,pw,pd])=>Math.abs(px-x)<pw+w*.5&&Math.abs(pz-z)<pd+d*.5);
  const closeToRoad=(x,z,w,d)=>[-132,-66,0,66,132].some(v=>Math.abs(x-v)<(w+8)*.5||Math.abs(z-v)<(d+8)*.5);

  function roof(x,z,w,d,h,rise,kind='roofRed'){
    const step=1.55;
    const levels=Math.max(2,Math.ceil(w/2/step));
    const roofHalf=(w+1.3)/2;
    for(let k=0;k<levels;k++){
      const xx=roofHalf-k*step;
      const y=h+.52+k*(rise/levels);
      // Stepped gables read as chunky voxel roofs from ground and air.
      block(kind,x-xx,y,z,step+1.15,rise/levels+.65,d+1.8);
      block(kind,x+xx,y,z,step+1.15,rise/levels+.65,d+1.8);
    }
    block(kind,x,h+rise+.8,z,1.8,.9,d+2.2);
    return h+rise+1.2;
  }
  function window(x,y,z,side=0){
    if(side===0||side===2){
      block('timber',x,y,z,.3,2.3,1.9);
      block('glass',x+(side===0?.17:-.17),y,z,.12,1.35,1.12);
      block('trim',x,y-1.1,z,.5,.24,2.1);
    }else{
      block('timber',x,y,z,1.9,2.3,.3);
      block('glass',x,y,z+(side===1?.17:-.17),1.1,1.35,.12);
      block('trim',x,y-1.1,z,2.1,.24,.5);
    }
  }
  function house(x,z,w,d,h,roofKind='roofRed',wallKind='plaster',variant=0){
    block('stone',x,1.1,z,w+.35,2.1,d+.35);
    block(wallKind,x,h/2+1,z,w,h-2,d);
    // Wood framing is separated from stucco by visible voxel-scale depth.
    for(const sx of [-1,1])for(const sz of [-1,1]){
      block('timber',x+sx*(w/2+.16),h/2,z+sz*(d/2+.16),.55,h,.55);
    }
    for(let y=5.2;y<h-1;y+=4.3){
      block('wood',x,y,z+d/2+.19,w+.3,.55,.42);
      block('wood',x,y,z-d/2-.19,w+.3,.55,.42);
    }
    for(let ix=-1;ix<=1;ix++)for(let y=5.4;y<h-1.6;y+=5.4){
      const xx=x+ix*w*.27;
      window(xx,y,z+d/2+.27,3);
      if(variant%3!==0)window(xx,y,z-d/2-.27,1);
    }
    for(let iz=-1;iz<=1;iz++)for(let y=5.4;y<h-1.6;y+=5.4){
      const zz=z+iz*d*.27;
      if(variant%3!==1)window(x+w/2+.25,y,zz,0);
      window(x-w/2-.25,y,zz,2);
    }
    // Chunky door and lintel; some houses get balconies and stone chimneys.
    block('timber',x-w*.18,1.85,z+d/2+.28,2.65,3.7,.4);
    block('trim',x-w*.18,3.85,z+d/2+.4,3.2,.4,1.15);
    if(variant%4===0){
      block('wood',x,h*.65,z+d/2+1,Math.min(w*.60,9),.55,2.5);
      for(let i=-2;i<=2;i++)block('timber',x+i*w*.063,h*.65+1,z+d/2+2.05,.34,2.1,.36);
      block('wood',x,h*.65+2,z+d/2+2.1,w*.58,.35,.35);
    }
    const roofRise=3.9+(variant%3)*.75;
    const top=roof(x,z,w,d,h,roofRise,roofKind);
    // Terracotta ridge tiles, overhanging eaves and individual roof dormers.
    block('roofTile',x,h+roofRise+1.15,z,1.45,.35,d+2.6);
    for(const edge of [-1,1]){
      block('woodDark',x+edge*(w/2+.7),h+.1,z,1,.45,d+2.1);
      for(let k=-1;k<=1;k++){
        const zz=z+k*d*.28;
        block('timber',x+edge*(w*.3),h+roofRise*.61,zz,2,2.3,2.3);
        block('glass',x+edge*(w*.3),h+roofRise*.67,zz+1.2,1.2,1.15,.23);
        block(roofKind,x+edge*(w*.3),h+roofRise*.61+1.3,zz,3,.6,3);
      }
    }
    // Subtle trim and shutters separate each medieval frontage from the next.
    for(let ix=-1;ix<=1;ix++){
      const xx=x+ix*w*.27;
      block('woodDark',xx-1.28,h*.46,z+d/2+.42,.3,2.5,.45);
      block('woodDark',xx+1.28,h*.46,z+d/2+.42,.3,2.5,.45);
    }
    if(variant%5===0){
      block('glow',x-w*.29,4.35,z+d/2+.7,1.1,1.5,1);
      block('timber',x-w*.29,5.25,z+d/2+.7,1.6,.4,1.5);
    }
    if(variant%3!==2){
      const cx=x+w*.25,cz=z+d*.2;
      block('stoneDark',cx,h+2.4,cz,2.9,4.3,2.8);
      block('stone',cx,h+4.75,cz,3.3,.6,3.3);
    }
    obstacle(x,z,w,d,top);
    world.anchors.push(V(x,top+1,z));
  }
  let houseCount=0;
  for(let gx=-150;gx<=150;gx+=20){
    for(let gz=-150;gz<=150;gz+=20){
      const w=12.7+rng()*3.5,d=12.5+rng()*4;
      const x=gx+(rng()-.5)*2.8,z=gz+(rng()-.5)*2.8;
      if(Math.abs(x)>164||Math.abs(z)>164||intersectsReserved(x,z,w,d)||closeToRoad(x,z,w,d))continue;
      const height=11+Math.floor(rng()*3)*3.5+(rng()<.19?4:0),n=houseCount++;
      house(x,z,w,d,height,['roofRed','roofOrange','roofDark','slate'][n%4],['plaster','plasterCream','plasterDark'][n%3],n);
    }
  }
  // Vast crenellated perimeter, corner keeps and watchtowers. Gated gaps at
  // the cardinal approaches make the walls useful for movement and navigation.
  function wallSegment(x,z,w,d,h){
    // Divide the curtain wall into individually destructible spans instead
    // of making a single 160-metre object vanish on a local Titan impact.
    const alongX=w>d,span=alongX?w:d,sections=Math.ceil(span/12);
    for(let i=0;i<sections;i++){
      const length=span/sections,offset=-span/2+(i+.5)*length;
      const bx=x+(alongX?offset:0),bz=z+(alongX?0:offset);
      block('stone',bx,h/2,bz,alongX?length:w,h,alongX?d:length);
      block('stoneDark',bx,h-.65,bz,alongX?length+.1:w+.1,1.3,alongX?d+.1:length+.1);
      obstacle(bx,bz,alongX?length:w,alongX?d:length,h);
    }
    for(let t=-(alongX?w:d)/2+2;t<(alongX?w:d)/2;t+=5){
      const cx=x+(alongX?t:0),cz=z+(alongX?0:t);
      block('limestone',cx,h+1.55,cz,alongX?2.8:w,3.1,alongX?d:2.8);
      world.anchors.push(V(cx,h+3.2,cz));
    }
  }
  for(const edge of [-180,180]){
    wallSegment(edge,-97,8,160,35);
    wallSegment(edge,97,8,160,35);
    wallSegment(-97,edge,160,8,35);
    wallSegment(97,edge,160,8,35);
  }
  function tower(x,z,h=46,wide=13,roofKind='slate'){
    block('stoneDark',x,h/2,z,wide,h,wide);
    block('limestone',x,h+.3,z,wide+3,1.3,wide+3);
    for(let k=-wide/2+1.4;k<wide/2-1;k+=3.3){
      block('stone',x+k,h+2.2,z+wide/2,2.2,3.5,2);
      block('stone',x+k,h+2.2,z-wide/2,2.2,3.5,2);
    }
    for(let k=-wide/2+1.4;k<wide/2-1;k+=3.3){
      block('stone',x+wide/2,h+2.2,z+k,2,3.5,2.2);
      block('stone',x-wide/2,h+2.2,z+k,2,3.5,2.2);
    }
    for(let i=0;i<5;i++){
      const half=wide/2-i*1.4;
      block(roofKind,x,h+4+i*1.5,z,Math.max(2,half*2),1.5,Math.max(2,half*2));
    }
    obstacle(x,z,wide,wide,h+4);
    world.anchors.push(V(x,h+12,z));
  }
  for(const x of [-180,180])for(const z of [-180,180])tower(x,z,51,14,'roofDark');
  // Flanking towers, rather than one blocking the gate passage.
  for(const x of [-180,180])for(const z of [-27,27])tower(x,z,56,12,'roofDark');
  for(const z of [-180,180])for(const x of [-27,27])tower(x,z,56,12,'roofDark');
  for(const z of [-180,180]){
    // Lintel spans rather than blocking the gate opening.
    block('stoneDark',0,33,z,31,7,8);
  }
  for(const x of [-180,180])block('stoneDark',x,33,0,8,7,31);

  // Cathedral: a long nave, stepped copper-blue roof, buttresses, stained-glass
  // windows and twin tall towers form the city's most visible flying landmark.
  const cx=0,cz=-28;
  block('limestone',cx,13,cz,25,26,44);
  for(let z=-44;z<=-11;z+=8){
    for(const side of [-1,1]){
      const x=side*13.4;
      block('stone',x,9,z,3.2,18,4);
      window(side*12.66,14,z,side===1?0:2);
    }
  }
  roof(cx,cz,25,44,26,8,'slate');
  block('limestone',cx,18,-4,32,36,7);
  block('timber',cx,5.2,.1,6,10,1);
  block('glass',cx,22,.38,7,7,.4);
  block('gold',cx,22,.64,1.2,7.5,.65);
  for(const x of [-12.5,12.5])tower(x,1,43,8,'slate');
  tower(0,-42,58,10,'slate');
  obstacle(cx,cz,25,44,34);
  world.anchors.push(V(0,65,-42));

  // Citadel and low arena establish distinct rooflines outside the center.
  block('stoneDark',-98,3.1,-90,47,6,46);
  block('limestone',-98,20,-90,27,34,25);
  roof(-98,-90,27,25,37,8,'roofDark');
  obstacle(-98,-90,47,46,7);
  obstacle(-98,-90,27,25,46);
  for(const sx of [-1,1])for(const sz of [-1,1])tower(-98+sx*23,-90+sz*22,41,10,'roofDark');
  for(let i=0;i<12;i++){
    const a=i*Math.PI*2/12,x=-92+Math.cos(a)*22,z=38+Math.sin(a)*22;
    block('stone',x,5,z,5.2,10,5.2);
    obstacle(x,z,5.2,5.2,10);
  }
  // Market buildings, shops, striped stalls and a clock tower.
  house(94,5,13,13,20,'slate','plasterCream',13);
  tower(91,5,47,9,'roofRed');
  house(112,52,15,15,16,'roofOrange','plaster',17);
  for(let i=0;i<10;i++){
    const x=77+(i%5)*9,z=39+Math.floor(i/5)*13;
    block('wood',x,2,z,6.8,.85,4.8);
    const canvas=i%2===0?'banner':'trim';
    block(canvas,x,4.1,z,8,1.0,6);
    for(const sx of [-1,1])for(const sz of [-1,1])block('timber',x+sx*3,2,z+sz*2.5,.35,4,.35);
  }
  // Water district: short blue canal with voxel quay and walkable bridges.
  terrain(0,117,345,11,'water');
  for(const bank of [-1,1])block('stone',0,1.2,117+bank*6.8,346,2.4,2.2);
  for(const x of [-124,-66,0,66,126]){
    block('limestone',x,3.6,117,10,2.2,19);
    obstacle(x,117,10,19,4.7);
    for(const z of [108,126])block('timber',x,5.5,z,10,.7,.7);
  }
  house(116,86,16,14,19,'slate','plasterDark',25);

  // Pixel foliage and lamps emphasize street scale without per-object lights.
  for(let i=0;i<82;i++){
    const x=-160+rng()*320,z=-158+rng()*316;
    if(closeToRoad(x,z,5,5)||intersectsReserved(x,z,5,5))continue;
    block('timber',x,3,z,1.5,6,1.5);
    block('leaves',x,7,z,7,4,6);
    block('leavesLight',x+1.7,9,z-1.5,5,4.4,5);
  }
  for(const x of [-124,-64,0,64,124])for(const z of [-124,-64,0,64,124]){
    if(Math.abs(x)<20&&Math.abs(z)<20)continue;
    block('timber',x+7,2.3,z+7,.9,4.5,.9);
    block('glow',x+7,4.8,z+7,2,1.7,2);
  }
  // High-detail zones modeled after the supplied castle, island and mountain
  // town references. Distant ridges remain decoration, never physics objects.
  decorateReferenceLandmarks({block,world,rng});
  // Batch by both shared voxel material and spatial chunk for frustum culling.
  const unit=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
  let voxelCount=0,drawMeshes=0;
  const destructibleMeshes=[];
  for(const group of collections.values()){
    if(!group.boxes.length)continue;
    const mesh=new THREE.InstancedMesh(unit,palette[group.kind],group.boxes.length);
    mesh.name='voxel-'+group.kind;mesh.castShadow=group.kind!=='water'&&group.kind!=='glass'&&group.kind!=='glow';
    if(group.kind==='water')mesh.renderOrder=1;
    mesh.receiveShadow=true;
    group.boxes.forEach(([x,y,z,w,h,d],i)=>{
      dummy.position.set(x,y,z);dummy.scale.set(w,h,d);
      dummy.rotation.set(0,0,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    scene.add(mesh);drawMeshes++;voxelCount+=group.boxes.length;
    if(!['road','roadLight','water','grass','leaves','leavesLight','glow'].includes(group.kind)){
      destructibleMeshes.push({mesh,boxes:group.boxes,removed:new Set()});
    }
  }
  // Precompute AABBs once. Camera checks can run each frame, so they must not
  // allocate hundreds of temporary boxes per ray.
  const colliderIndex=createSpatialColliderIndex(world.colliders,24);
  const collisionBoxes=new Map();
  function refreshCollisionIndex(){
    colliderIndex.rebuild(world.colliders);
    collisionBoxes.clear();
    for(const c of world.colliders)collisionBoxes.set(c,new THREE.Box3(
      V(c.x-c.halfW,0,c.z-c.halfD),V(c.x+c.halfW,c.h,c.z+c.halfD)));
  }
  refreshCollisionIndex();
  world.nearbyColliders=(point,radius=2)=>colliderIndex.query(point.x,point.z,radius);
  const ray=new THREE.Ray(),nearPoint=V(0,0,0);
  const originalColliders=[...world.colliders],originalAnchors=[...world.anchors];
  const zeroMatrix=new THREE.Matrix4().makeScale(0,0,0),savedMatrix=new THREE.Matrix4();
  const originalMatrices=new Map();
  const boxDistance=(x,y,z,w,h,d,p)=>{
    const dx=Math.max(Math.abs(p.x-x)-w*.5,0);
    const dy=Math.max(Math.abs(p.y-y)-h*.5,0);
    const dz=Math.max(Math.abs(p.z-z)-d*.5,0);
    return Math.hypot(dx,dy,dz);
  };
  world.damageStructures=(center,radius,{height=0}={})=>{
    if(!center||!Number.isFinite(radius)||radius<=0)return {pieces:0,colliders:0};
    const c=V(center.x,center.y+height*.5,center.z),r=Math.min(68,radius);
    let pieces=0,colliders=0;
    for(const entry of destructibleMeshes){
      for(let i=0;i<entry.boxes.length;i++){
        if(entry.removed.has(i))continue;
        const [x,y,z,w,h,d]=entry.boxes[i];
        if(y+h*.5<1.25||boxDistance(x,y,z,w,h,d,c)>r)continue;
        const key=entry.mesh.uuid+':'+i;
        entry.mesh.getMatrixAt(i,savedMatrix);
        originalMatrices.set(key,savedMatrix.clone());
        entry.mesh.setMatrixAt(i,zeroMatrix);
        entry.removed.add(i);pieces++;
      }
      if(entry.removed.size)entry.mesh.instanceMatrix.needsUpdate=true;
    }
    for(let i=world.colliders.length-1;i>=0;i--){
      const b=world.colliders[i];
      if(boxDistance(b.x,b.h*.5,b.z,b.halfW*2,b.h,b.halfD*2,c)<=r){
        world.colliders.splice(i,1);colliders++;
      }
    }
    if(colliders){
      refreshCollisionIndex();
      world.anchors=world.anchors.filter(a=>a.distanceTo(c)>r+3);
    }
    return {pieces,colliders};
  };
  world.resetDestruction=()=>{
    for(const entry of destructibleMeshes){
      for(const i of entry.removed){
        const key=entry.mesh.uuid+':'+i,original=originalMatrices.get(key);
        if(original)entry.mesh.setMatrixAt(i,original);
      }
      if(entry.removed.size)entry.mesh.instanceMatrix.needsUpdate=true;
      entry.removed.clear();
    }
    originalMatrices.clear();
    world.colliders.splice(0,world.colliders.length,...originalColliders);
    world.anchors=[...originalAnchors];
    refreshCollisionIndex();
  };
  world.grappleRay=(origin,dir,maxDist=125)=>{
    ray.set(origin,dir.clone().normalize());
    let best=null,closest=maxDist;
    // Narrow queries for enemy navigation's frequent 3-10m rays; the
    // broadphase still covers the full segment for long-range grapple aiming.
    const mid=maxDist*.5;
    const candidates=colliderIndex.query(origin.x+ray.direction.x*mid,
      origin.z+ray.direction.z*mid,mid+2);
    for(const candidate of candidates){
      const hit=ray.intersectBox(collisionBoxes.get(candidate),nearPoint);
      if(!hit)continue;
      const dist=origin.distanceTo(hit);
      if(dist>.2&&dist<closest){closest=dist;best=hit.clone();}
    }
    return best;
  };
  world.bestAnchor=(position,direction,side)=>{
    let best=null,score=-Infinity;
    const heading=direction.clone().normalize(),right=V(-heading.z,0,heading.x);
    for(const anchor of world.anchors){
      const delta=anchor.clone().sub(position),dist=delta.length();
      if(dist<7||dist>118)continue;
      const alignment=delta.dot(heading)/dist;
      if(alignment<.32)continue;
      const n=alignment*2.4-Math.abs(dist-47)*.012+
        clamp(delta.dot(right)*side/75,-.4,.4)+(anchor.y>position.y?.1:0);
      if(n>score){score=n;best=anchor;}
    }
    return best?.clone()??null;
  };
  world.resolveCollision=(position,previous,velocity)=>{
    const nearby=world.nearbyColliders(position,2.4);
    const grounded=resolveWorldCollision(nearby,position,previous,velocity);
    return grounded;
  };
  // Single batched emissive waypoint mesh per marker; no dynamic point lights.
  const active=new THREE.MeshBasicMaterial({color:0xffd57f}),inactive=new THREE.MeshBasicMaterial({color:0x719db0});
  const positions=[V(0,47,-57),V(-61,45,-107),V(-118,46,-4),V(-42,42,96),V(82,49,96),V(108,44,-79)];
  for(let i=0;i<positions.length;i++){
    const point=positions[i],group=new THREE.Group();
    group.position.copy(point);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(4.2,.38,5,18),inactive);
    group.add(ring);
    const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.9,0),active);group.add(diamond);
    scene.add(group);world.beacons.push({group,ring,point});
  }
  world.setBeaconActive=(index)=>{
    world.beacons.forEach((b,i)=>{b.ring.material=i===index?active:inactive;b.group.scale.setScalar(i===index?1.07:.92);});
  };
  let skyLastUpdate=-Infinity,skyDirty=true;
  world.setAtmosphere=(updates={})=>{
    for(const key of ['timeOfDay','weather','stormAmount','steamAmount']){
      if(Object.hasOwn(updates,key))atmosphereValues[key]=updates[key];
    }
    skyDirty=true;
  };
  world.animate=(time,dt)=>{
    skyLayer.uniforms.uTime.value=time;
    if(skyDirty||time-skyLastUpdate>=.25||time<skyLastUpdate){
      skyDirty=false;skyLastUpdate=time;
      atmosphere=sampleCinematicAtmosphere(atmosphereValues);
      updateSkyUniforms(skyLayer.uniforms,atmosphere,time,fallbackCinematic?1.45:1);
      skyLayer.uniforms.uSkyQuality.value=fallbackCinematic?1:0;
      sunlight.color.copy(atmosphere.sunColor);
      sunlight.intensity=atmosphere.sunlight*(fallbackCinematic?1.08:1);
      sunlight.position.copy(atmosphere.sunDirection).multiplyScalar(260);
      hemisphere.color.copy(atmosphere.skyFill);hemisphere.intensity=atmosphere.ambient;
      scene.background.copy(atmosphere.horizon);
      scene.fog.color.copy(atmosphere.fog);
      scene.fog.density=(menuClarity?.00042:(fallbackCinematic?.00175:.00135))*atmosphere.fogStrength;
    }
    world.beacons.forEach((b,i)=>{
      b.ring.rotation.z=time*.32*(i%2?1:-1);
      b.group.position.y=b.point.y+Math.sin(time*2+i)*.36;
      b.group.children[1].rotation.y+=dt*1.6;
    });
  };
  // Fallback world keeps the same game-wide graphics setting without adding
  // extra scene geometry or changing the voxel/ODM collision model.
  let fallbackCinematic=false,menuClarity=false;
  world.setMenuClarity=(value)=>{
    menuClarity=!!value;
    scene.fog.density=(menuClarity?.00042:(fallbackCinematic?.00175:.00135))*atmosphere.fogStrength;
  };
  world.setVisualQuality=(quality)=>{
    const cinematic=quality==='cinematic';
    fallbackCinematic=cinematic;
    skyLayer.uniforms.uSkyQuality.value=cinematic?1:0;
    sunlight.intensity=atmosphere.sunlight*(cinematic?1.08:1);
    scene.fog.density=(menuClarity?.00042:(cinematic?.00175:.00135))*atmosphere.fogStrength;
    sunlight.shadow.mapSize.set(cinematic?2048:1024,cinematic?2048:1024);
    if(sunlight.shadow.map)sunlight.shadow.map.dispose();
    sunlight.shadow.map=null;sunlight.shadow.needsUpdate=true;
  };
  world.stats={houses:houseCount,instances:voxelCount,drawMeshes, ...world.referenceStats};
  world.setBeaconActive(0);
  return world;
}
