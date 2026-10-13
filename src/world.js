import * as THREE from 'three';
import {resolveWorldCollision} from './collision.js';
import {batchStaticScenery} from './batching.js';

const V = (x,y,z)=>new THREE.Vector3(x,y,z);
const palette = {
  limestone: [0xb8ad98,0xd0c2aa,0xdccdb6,0xa99e8b,0xc8b49e,0x978f82,0xc2b8a5],
  roof: [0x8d3e28,0xa64b2b,0x743523,0xb65b32,0x93432a,0x663126,0xc16b3a],
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function random(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)|0;return (seed>>>0)/4294967296;}}
function texturedCanvas(seed,kind){
  const rng=random(seed),c=document.createElement('canvas'); c.width=256;c.height=256;
  const ctx=c.getContext('2d');ctx.fillStyle=kind==='road'?'#68625a':kind==='roof'?'#9a4b2d':'#c9bca5';ctx.fillRect(0,0,256,256);
  if(kind==='road'){
    for(let y=0;y<256;y+=22){for(let x=0;x<256;x+=50){const xx=x+(Math.floor(y/22)%2)*25; const g=75+Math.floor(rng()*35);ctx.fillStyle=`rgb(${g},${g+4},${g+6})`;ctx.fillRect(xx+1,y+1,46,19);ctx.strokeStyle='rgba(29,42,47,.34)';ctx.strokeRect(xx+.5,y+.5,47,20);}}
  }else if(kind==='roof'){
    for(let y=0;y<256;y+=16){for(let x=0;x<256;x+=28){const xx=x+(Math.floor(y/16)%2)*14;ctx.fillStyle=`rgba(255,255,255,${rng()*.09})`;ctx.fillRect(xx,y,26,14);ctx.strokeStyle='rgba(4,10,20,.23)';ctx.strokeRect(xx,y,26,14);}}
  }else{
    for(let i=0;i<2600;i++){const a=0.01+rng()*.045;ctx.fillStyle=`rgba(${rng()>.5?'255,255,255':'0,0,0'},${a})`;ctx.fillRect(rng()*256,rng()*256,1+rng()*3,1+rng()*3);}
    for(let y=0;y<256;y+=48){ctx.strokeStyle='rgba(75,71,67,.07)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
  }
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;return tex;
}
const createMat=(color,roughness=0.87,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function box(parent,w,h,d,x,y,z,material,cast=true){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);o.castShadow=cast;o.receiveShadow=true;parent.add(o);return o;}
function cone(parent,r,h,x,y,z,mat,n=6){const o=new THREE.Mesh(new THREE.ConeGeometry(r,h,n),mat);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}

export function createWorld(scene){
  const rng=random(470712), world={colliders:[],grappleMeshes:[],anchors:[],beacons:[],lamps:[],smoke:[],districtRoads:[],landmarks:{cathedral:[0,-13],plaza:[46.5,31],canalZ:108}, elapsed:0};
  scene.background=new THREE.Color(0xd5ad86);scene.fog=new THREE.FogExp2(0xc9aa8c,.00172);
  // Untextured infinite sky dome — daybreak atmosphere with a warm horizon.
  const sky=new THREE.Mesh(new THREE.SphereGeometry(1450,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{sunDir:{value:V(-.48,.39,-.5).normalize()}},vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`varying vec3 vDir;uniform vec3 sunDir;void main(){vec3 d=normalize(vDir);float h=smoothstep(-.16,.78,d.y);vec3 horizon=vec3(.88,.77,.65);vec3 zenith=vec3(.19,.37,.55);vec3 col=mix(horizon,zenith,h);float sun=pow(max(dot(d,sunDir),0.),160.);float glow=pow(max(dot(d,sunDir),0.),9.);col+=vec3(1.,.7,.35)*glow*.32+vec3(1.,.84,.6)*sun*.7;gl_FragColor=vec4(col,1.);}`}));scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xffe3c1,0x5a4f45,1.95));
  const sun=new THREE.DirectionalLight(0xffc178,4.25);sun.position.set(-155,118,-190);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-210;sun.shadow.camera.right=210;sun.shadow.camera.top=210;sun.shadow.camera.bottom=-210;sun.shadow.camera.near=1;sun.shadow.camera.far=520;sun.shadow.bias=-.00018;sun.shadow.normalBias=.018;scene.add(sun);world.sun=sun;
  const skyFill=new THREE.DirectionalLight(0x9fc4dc,.55);skyFill.position.set(130,90,90);scene.add(skyFill);
  const roadTex=texturedCanvas(1337,'road');roadTex.repeat.set(55,55);
  const roadMat=new THREE.MeshStandardMaterial({map:roadTex,color:0x9da3a6,roughness:1});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),roadMat);ground.rotation.x=-Math.PI/2;ground.position.y=-.09;ground.receiveShadow=true;scene.add(ground);
  const roadSurface=createMat(0x62686b);
  for(let i=-5;i<=5;i++){
    const z=i*31;box(scene,386,.065,8,0,-.005,z,roadSurface,false);
    const x=i*31;box(scene,8,.065,386,x,-.004,0,roadSurface,false);
    world.districtRoads.push({a:[-188,z],b:[188,z]},{a:[x,-188],b:[x,188]});
  }
  // Secondary avenue seams help streets remain legible from the rooftops.
  const seamMat=createMat(0x959086);
  for(let i=-5;i<=5;i++){let x=i*31;for(let z=-164;z<165;z+=7){if(Math.abs(x)<.01 || rng()>.62)box(scene,.09,.012,2.1,x,.035,z,seamMat,false);}}
  const plaster=texturedCanvas(920,'wall');const tiles=texturedCanvas(202,'roof');
  const walls=palette.limestone.map(c=>new THREE.MeshStandardMaterial({color:c,map:plaster,roughness:.92}));
  const roofs=palette.roof.map(c=>new THREE.MeshStandardMaterial({color:c,map:tiles,roughness:.83,metalness:.04,side:THREE.DoubleSide}));
  const wood=createMat(0x584b45),trim=createMat(0xdbd0b7),dark=createMat(0x394856),gold=createMat(0xd9b780,.53,.2),stone=createMat(0x858e91);
  const windowLists={warm:[],cool:[],frame:[]};
  const treePoints=[];const step=31;
  function addAnchor(x,y,z){world.anchors.push(V(x,y,z));}
  function addCollider(x,z,h,w,d){world.colliders.push({x,z,h,halfW:w/2,halfD:d/2});}
  function addWindow(x,y,z,rot,lit){let dest=lit?windowLists.warm:windowLists.cool;
    const off=0.075;dest.push([x+Math.sin(rot)*off,y,z+Math.cos(rot)*off,rot]);
    windowLists.frame.push([x,y,z,rot]);}
  function makeRoof(x,z,w,d,h,rise,mat,alongX){
    const roofW=(alongX?w:d)+1.6, roofD=(alongX?d:w)+1.6;
    // Six vertices form two triangular ends of a pitched gable roof.
    const len=roofD/2;
    const v=[-roofW/2,h,-len,0,h+rise,-len,roofW/2,h,-len,
             -roofW/2,h,len,0,h+rise,len,roofW/2,h,len];
    // Two slopes, two visible gables and the underside.
    const idx=[0,3,1, 1,3,4, 1,4,2, 2,4,5,
               0,1,2, 3,5,4, 0,2,3, 2,5,3];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setIndex(idx);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,0,z);if(!alongX)mesh.rotation.y=Math.PI/2;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);world.grappleMeshes.push(mesh);
    return mesh;
  }
  function buildHouse(ix,iz){
    const x=ix*step+(rng()-.5)*2,z=iz*step+(rng()-.5)*2;
    if((ix===0&&Math.abs(iz)<=1)||(iz===1&&(ix===1||ix===2)))return;
    const edge=Math.max(Math.abs(ix),Math.abs(iz));
    const w=17+rng()*6.8,d=17+rng()*6.8,h=13+Math.floor(rng()*5)*3.6+(rng()<.13?10:0)+(edge>3?5:0);
    const rise=2.8+rng()*2.4;const p=Math.floor(rng()*walls.length),r=Math.floor(rng()*roofs.length);
    const base=box(scene,w,h,d,x,h/2,z,walls[p]);world.grappleMeshes.push(base);
    // Base / lintel bands, thin gutters and parapet.
    box(scene,w+.5,.62,d+.5,x,1.1,z,stone);box(scene,w+.85,.4,d+.85,x,h-.42,z,trim);
    const alongX=rng()>.5;
    makeRoof(x,z,w,d,h,rise,roofs[r],alongX);
    const roofY=h+rise;
    world.colliders.push({x,z,h:roofY,halfW:w/2,halfD:d/2});
    for(let t=-1;t<=1;t+=2){
      for(let k=-1;k<=1;k+=2){addAnchor(x+t*w*.48,h+1.4,z+k*d*.48);addAnchor(x+t*w*.34,roofY+.25,z+k*d*.34);}
    }
    addAnchor(x,roofY+1,z);
    const levels=Math.floor((h-3)/3.65);
    for(let f=0;f<levels;f++){
      const wy=3.3+f*3.65;
      const cX=Math.max(2,Math.floor(w/4.2)),cZ=Math.max(2,Math.floor(d/4.2));
      for(let j=0;j<cX;j++){
        let xx=x-w/2+(j+.5)*w/cX;
        addWindow(xx,wy,z+d/2+.085,0,rng()>.7);
        addWindow(xx,wy,z-d/2-.085,Math.PI,rng()>.73);
      }
      for(let j=0;j<cZ;j++){
        let zz=z-d/2+(j+.5)*d/cZ;
        addWindow(x+w/2+.085,wy,zz,Math.PI/2,rng()>.76);
        addWindow(x-w/2-.085,wy,zz,-Math.PI/2,rng()>.75);
      }
    }
    // Ground-floor framed door, arched canopy, and copper rain downpipes.
    box(scene,2.5,3.4,.28,x-w*.23,1.7,z+d/2+.18,dark);
    box(scene,3.2,.18,1.4,x-w*.23,3.58,z+d/2+.8,roofs[r]);
    for(const sign of [-1,1])box(scene,.18,h,.22,x+sign*(w/2-.45),h/2,z+d/2+.07,trim);
    // Timber framing, shutters and balconies give each street-facing facade a readable identity.
    if(rng()>.35){
      for(const sign of [-1,0,1])box(scene,.16,h*.7,.14,x+sign*w*.29,h*.58,z+d/2+.15,wood);
      for(let by=4.8;by<h-1;by+=3.6)box(scene,w*.88,.14,.16,x,by,z+d/2+.16,wood);
      const braceL=box(scene,.13,4.2,.14,x-w*.3,h*.58,z+d/2+.18,wood);braceL.rotation.z=.62;
      const braceR=box(scene,.13,4.2,.14,x+w*.3,h*.58,z+d/2+.18,wood);braceR.rotation.z=-.62;
    }
    if(rng()>.58){
      box(scene,w*.54,.18,1.35,x,h*.66,z+d/2+.75,wood);
      for(let rail=-2;rail<=2;rail++)box(scene,.09,1.05,.09,x+rail*w*.055,h*.66+.5,z+d/2+1.25,wood);
    }
    if(rng()>.57){
      const cx=x+(rng()-.5)*w*.55,cz=z+(rng()-.5)*d*.5;
      box(scene,2.3,3.7,2.3,cx,h+1.25,cz,stone);
      box(scene,2.7,.4,2.7,cx,h+3.12,cz,trim);
    }
    if(rng()>.66){
      box(scene,w*.68,.19,.45,x,h*.63,z+d/2+.3,wood);
    }
    if(rng()>.83){
      const s=box(scene,.16,6,.16,x+w/2-.4,h+3,z,wood);cone(scene,1.1,1.85,s.position.x,h+7,s.position.z,roofs[r],4);
    }
    if(rng()>.42){
      const count=rng()>.72?2:1;
      for(let dormer=0;dormer<count;dormer++){
        const dx=x+(dormer-(count-1)/2)*w*.34;
        box(scene,2.35,1.8,1.7,dx,h+rise*.5,z+d*.22,walls[p]);
        makeRoof(dx,z+d*.22,2.55,1.9,h+rise*.5+.9,1.05,roofs[r],true);
        box(scene,.72,.82,.1,dx,h+rise*.72,z+d*.22+.9,dark,false);
      }
    }
  }
  for(let ix=-5;ix<=5;ix++)for(let iz=-5;iz<=5;iz++)buildHouse(ix,iz);
  function instancedWindows(list,mat,isFrame){
    const geo=new THREE.BoxGeometry(isFrame?1.45:1.1,isFrame?2.25:1.85,isFrame?.12:.12);
    const mesh=new THREE.InstancedMesh(geo,mat,list.length),dummy=new THREE.Object3D();
    list.forEach(([x,y,z,ry],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,ry,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=false;scene.add(mesh);
  }
  instancedWindows(windowLists.frame,wood,true);
  instancedWindows(windowLists.warm,new THREE.MeshStandardMaterial({color:0xffc47a,emissive:0x9d531e,emissiveIntensity:.57,roughness:.35}),false);
  instancedWindows(windowLists.cool,new THREE.MeshStandardMaterial({color:0x3d596c,roughness:.25,metalness:.19}),false);
  // Grand cathedral and civic square form the visual heart of Asterfell.
  const cathedralWall=walls[2],cathedralRoof=roofs[1],glass=new THREE.MeshStandardMaterial({color:0x304f63,emissive:0xd18a4b,emissiveIntensity:.28,roughness:.2,metalness:.15});
  const nave=box(scene,25,22,48,0,11,-13,cathedralWall);world.grappleMeshes.push(nave);makeRoof(0,-13,25,48,22,8,cathedralRoof,true);addCollider(0,-13,30,25,48);
  const transept=box(scene,47,17,18,0,8.5,-15,cathedralWall);world.grappleMeshes.push(transept);makeRoof(0,-15,47,18,17,6,cathedralRoof,false);addCollider(0,-15,23,47,18);
  const bellTower=box(scene,11,46,12,0,23,13,cathedralWall);world.grappleMeshes.push(bellTower);addCollider(0,13,57,11,12);
  box(scene,13,2.3,14,0,44.8,13,trim);cone(scene,8.4,22,0,57,13,cathedralRoof,8);addAnchor(0,69,13);
  for(const sx of [-1,1]){
    const rearTower=box(scene,7.2,30,7.2,sx*9.5,15,-34,cathedralWall);world.grappleMeshes.push(rearTower);cone(scene,5.1,13,sx*9.5,36.5,-34,cathedralRoof,8);addCollider(sx*9.5,-34,43,7.2,7.2);addAnchor(sx*9.5,44,-34);
  }
  for(const side of [-1,1])for(let z=-31;z<=4;z+=8){
    box(scene,2.2,15,3.8,side*14,7.5,z,cathedralWall);
    const brace=box(scene,1.1,13,1.1,side*16,9,z,trim);brace.rotation.z=side*.38;
    addAnchor(side*14,17,z);
  }
  for(let z=-28;z<=2;z+=10){
    box(scene,.22,6.3,.16,-12.62,12,z,glass,false);box(scene,.22,6.3,.16,12.62,12,z,glass,false);
  }
  const rose=new THREE.Mesh(new THREE.TorusGeometry(2.7,.28,10,32),glass);rose.position.set(0,31.5,19.08);scene.add(rose);
  for(let i=0;i<8;i++){const spoke=box(scene,.16,5.2,.12,0,31.5,19.12,trim,false);spoke.rotation.z=i*Math.PI/4;}
  for(const sx of [-1,1])for(const z of [-2,8,18]){box(scene,.42,2.8,.38,sx*3.1,19,z,glass,false);}
  const cathedralLight=new THREE.PointLight(0xffb66e,22,42,2);cathedralLight.position.set(0,20,17);scene.add(cathedralLight);
  // Canal district, quay walls and stone bridges echo the layered infrastructure in the reference.
  const waterMat=new THREE.MeshPhysicalMaterial({color:0x315b69,roughness:.18,metalness:.08,transmission:.08,transparent:true,opacity:.88});
  const canal=new THREE.Mesh(new THREE.PlaneGeometry(330,10),waterMat);canal.rotation.x=-Math.PI/2;canal.position.set(0,-.02,108);canal.receiveShadow=true;scene.add(canal);
  box(scene,330,2.2,1.5,0,1.05,101.8,stone);box(scene,330,2.2,1.5,0,1.05,114.2,stone);
  for(let x=-145;x<=145;x+=48){
    const deck=box(scene,11,2.1,17,x,2.4,108,trim);world.grappleMeshes.push(deck);addCollider(x,108,3.45,11,17);
    for(const sx of [-1,1])box(scene,1.4,5.2,2.4,x+sx*4.5,2.6,108,stone);
    for(const sz of [-1,1])for(let rail=-4;rail<=4;rail+=2)box(scene,.15,1.5,.15,x+rail,4.15,108+sz*7.2,wood,false);
    addAnchor(x,5.2,108);
  }
  for(let x=-156;x<=156;x+=18){box(scene,.18,1.5,.18,x,2.9,101.2,wood,false);box(scene,.18,1.5,.18,x,2.9,114.8,wood,false);}
  // Outer fortifications frame the city and make its boundaries readable.
  const outer=188,wallH=38,wallT=11;
  for(let side=0;side<4;side++){
    const n=side<2?outer:0, x=side===0?-outer:side===1?outer:0, z=side===2?-outer:side===3?outer:0;
    const m=box(scene,side<2?wallT:outer*2+wallT,wallH,side<2?outer*2+wallT:wallT,x,wallH/2,z,stone);world.grappleMeshes.push(m);
    addCollider(x,z,wallH,side<2?wallT:outer*2+wallT,side<2?outer*2+wallT:wallT);
    // Perimeter crenellations, spaced to preserve performance.
    for(let k=-outer;k<=outer;k+=11){
      if(side<2)box(scene,wallT,3.9,5,x,wallH+1.95,k,trim);else box(scene,5,3.9,wallT,k,wallH+1.95,z,trim);
      if(side<2)addAnchor(x,wallH+4,k);else addAnchor(k,wallH+4,z);
    }
    const bannerMat=createMat(0x71352f);
    for(let k=-132;k<=132;k+=66){if(side<2)box(scene,.25,15,5.5,x+(side===0?6:-6),26,k,bannerMat,false);else box(scene,5.5,15,.25,k,26,z+(side===2?6:-6),bannerMat,false);}
  }
  // A second defensive ring divides the old city from the outer wards.
  const inner=142,innerH=20,innerT=4.6;
  function innerWall(x,z,w,d){const wall=box(scene,w,innerH,d,x,innerH/2,z,walls[0]);world.grappleMeshes.push(wall);addCollider(x,z,innerH,w,d);for(let offset=-Math.max(w,d)/2+5;offset<Math.max(w,d)/2;offset+=9){if(w>d){box(scene,4,2.3,d+.7,x+offset,innerH+1.15,z,trim);addAnchor(x+offset,innerH+2.5,z);}else{box(scene,w+.7,2.3,4,x,innerH+1.15,z+offset,trim);addAnchor(x,innerH+2.5,z+offset);}}}
  for(const side of [-1,1]){
    innerWall(side*inner,-78,innerT,128);innerWall(side*inner,78,innerT,128);
    innerWall(-78,side*inner,128,innerT);innerWall(78,side*inner,128,innerT);
    for(const gate of [[side*inner,0],[0,side*inner]]){
      const gx=gate[0],gz=gate[1],alongX=Math.abs(gx)<1;
      for(const flank of [-1,1]){
        const tx=gx+(alongX?flank*10:0),tz=gz+(alongX?0:flank*10);
        const gateTower=box(scene,9,30,9,tx,15,tz,walls[3]);world.grappleMeshes.push(gateTower);addCollider(tx,tz,37,9,9);cone(scene,7,10,tx,35,tz,roofs[2],8);addAnchor(tx,40,tz);
      }
      const beam=box(scene,alongX?29:innerT,7,alongX?innerT:29,gx,25,gz,trim);world.grappleMeshes.push(beam);
    }
  }
  function tower(x,z,h=62){
    const radius=8.5,wall=createMat(0x929c9e);
    const b=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius+1.1,h,10),wall);b.position.set(x,h/2,z);b.castShadow=true;b.receiveShadow=true;scene.add(b);world.grappleMeshes.push(b);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(radius+2,radius+2,2.4,10),trim);cap.position.set(x,h,z);cap.castShadow=true;scene.add(cap);
    cone(scene,radius+3,10,x,h+6,z,roofs[0],10);
    addCollider(x,z,h+11,radius*1.75,radius*1.75);
    for(let i=0;i<10;i++){const a=i*Math.PI*2/10;addAnchor(x+Math.sin(a)*9,h+2,z+Math.cos(a)*9);}
    addAnchor(x,h+11,z);
  }
  for(let x of [-outer,0,outer])for(let z of [-outer,outer])tower(x,z,x===0?72:59);
  for(let z of [-outer,outer])for(let x of [-outer,outer])tower(x,z,59);
  // Monument square with elevated landing platforms and wind ribbons.
  const plazaMat=createMat(0xb0afa4),marketCanvas=createMat(0x8d6356),marketCream=createMat(0xd7ba84);
  const plazaX=46.5,plazaZ=31;
  box(scene,48,.25,25,plazaX,.07,plazaZ,plazaMat,false);
  const obelisk=box(scene,3.6,18,3.6,plazaX,9,plazaZ,stone);world.grappleMeshes.push(obelisk);cone(scene,3,6,plazaX,21,plazaZ,gold,4);addAnchor(plazaX,25,plazaZ);addCollider(plazaX,plazaZ,24,3.6,3.6);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;const x=plazaX+Math.sin(a)*11,z=plazaZ+Math.cos(a)*11;
    box(scene,2.7,1.1,2.7,x,.58,z,stone);const l=box(scene,.24,5,.24,x,3.2,z,dark);cone(scene,1.45,1.6,x,6.4,z,gold,4);
  }
  for(let stall=-2;stall<=2;stall++){
    const sx=plazaX-18+stall*9;
    box(scene,7,.22,3.7,sx,3.5,plazaZ+9,stall%2?marketCanvas:marketCream,false);
    for(const px of [-3,3])box(scene,.16,3.4,.16,sx+px,1.7,plazaZ+9,wood,false);
  }
  // Lamps and small trees: silhouettes and warm lights make streets feel lived in.
  const bark=createMat(0x685646),leaf1=createMat(0x536e5b),leaf2=createMat(0x7d9275);
  for(let ix=-5;ix<=5;ix++)for(let iz=-5;iz<=5;iz++){
    if(Math.abs(ix)<1&&Math.abs(iz)<1)continue;
    const sx=ix*31+13.0,sz=iz*31+13.0;
    if(rng()>.45){
      const trunk=box(scene,.72,4.2,.72,sx,2.1,sz,bark,false);
      cone(scene,2.8,6.5,sx,6.4,sz,rng()>.5?leaf1:leaf2,7);
      cone(scene,2.1,4.5,sx,9.2,sz,rng()>.5?leaf1:leaf2,7);
    }else{
      const pole=box(scene,.22,5,.22,sx,2.5,sz,dark,false);
      box(scene,1.2,.15,1.2,sx,5.15,sz,dark,false);
      const flame=box(scene,.67,.82,.67,sx,4.66,sz,new THREE.MeshStandardMaterial({color:0xffce94,emissive:0xdd7938,emissiveIntensity:1.3}),false);
      world.lamps.push(flame);
    }
  }
  // Civic infrastructure breaks up the repeating city grid: covered market stalls,
  // signal flags and curb islands give the traversal routes a believable function.
  const canvasMat=createMat(0x8d6356),flagMat=createMat(0xe2b779),iron=createMat(0x304654);
  for(const [x,z,rotation] of [[-15,-39,0],[15,-39,0],[-39,15,Math.PI/2],[39,-15,Math.PI/2],[92,15,Math.PI/2],[-92,-15,Math.PI/2]]){
    box(scene,7.5,.35,3.2,x,2.1,z,canvasMat,false).rotation.y=rotation;
    for(const side of [-1,1]){const post=box(scene,.18,4,.18,x+Math.cos(rotation)*side*3,z?2:2,z+Math.sin(rotation)*side*3,iron,false);post.position.y=2;}
    const mast=box(scene,.16,7,.16,x+3.8*Math.sin(rotation),3.5,z-3.8*Math.cos(rotation),iron,false);box(scene,1.8,1.1,.06,mast.position.x+.8,mast.position.y+1.8,mast.position.z,flagMat,false);
  }
  // Low-poly mountains and hazy valley create depth beyond the walls.
  const mountainMats=[createMat(0x796f6a),createMat(0x716f72),createMat(0x8e8580)],snowMat=createMat(0xd8d4ca);
  for(let i=0;i<50;i++){
    const a=i/50*Math.PI*2+rng()*.14,r=350+rng()*190;
    const height=35+rng()*100;
    const peak=new THREE.Mesh(new THREE.ConeGeometry(36+rng()*75,height,3+Math.floor(rng()*4)),mountainMats[i%3]);
    peak.position.set(Math.cos(a)*r,height/2-10,Math.sin(a)*r);peak.rotation.y=rng()*6;scene.add(peak);
    if(height>82){const cap=new THREE.Mesh(new THREE.ConeGeometry(peak.geometry.parameters.radius*.34,height*.28,peak.geometry.parameters.radialSegments),snowMat);cap.position.set(peak.position.x,peak.position.y+height*.36,peak.position.z);cap.rotation.y=peak.rotation.y;scene.add(cap);}
  }
  const cloudMat=new THREE.MeshBasicMaterial({color:0xf4e6d0,transparent:true,opacity:.25,depthWrite:false});
  for(let i=0;i<27;i++){
    const a=rng()*Math.PI*2,dist=110+rng()*480;
    const g=new THREE.Group();g.position.set(Math.sin(a)*dist,95+rng()*85,Math.cos(a)*dist);
    for(let j=0;j<3;j++){const puff=new THREE.Mesh(new THREE.SphereGeometry(12+j*2,8,6),cloudMat);puff.scale.set(2.4,.34,1);puff.position.set(j*18,Math.sin(j)*2,0);g.add(puff);}scene.add(g);
  }
  const smokeMat=()=>new THREE.MeshBasicMaterial({color:0xb6aea4,transparent:true,opacity:.18,depthWrite:false});
  for(let i=0;i<14;i++){
    const plume=new THREE.Group(),x=(Math.floor(rng()*9)-4)*31+(rng()-.5)*12,z=(Math.floor(rng()*9)-4)*31+(rng()-.5)*12;
    plume.position.set(x,18+rng()*15,z);plume.userData.phase=rng()*6.28;
    for(let p=0;p<4;p++){const puff=new THREE.Mesh(new THREE.SphereGeometry(1.1+p*.45,7,5),smokeMat());puff.position.set(Math.sin(p)*.6,p*2.2,0);plume.add(puff);}scene.add(plume);world.smoke.push(plume);
  }
  const beaconLocations=[V(0,27,-51),V(-61,41,-105),V(-115,47,-5),V(-43,42,97),V(82,51,96),V(107,41,-81)];
  const torusMat=new THREE.MeshStandardMaterial({color:0xe2b977,emissive:0xc88c3d,emissiveIntensity:1.25,metalness:.65,roughness:.26});
  const inactiveMat=new THREE.MeshStandardMaterial({color:0x7294a3,emissive:0x274b5d,emissiveIntensity:.45,metalness:.65,roughness:.3});
  beaconLocations.forEach((point,i)=>{
    const group=new THREE.Group();group.position.copy(point);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(4.8,.28,9,56),i===0?torusMat:inactiveMat);ring.rotation.y=.35;group.add(ring);
    const pointLight=new THREE.PointLight(0xeaa759,i===0?18:1,21,2);group.add(pointLight);
    const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.8),new THREE.MeshBasicMaterial({color:0xffe7b8}));group.add(diamond);
    scene.add(group);world.beacons.push({group,ring,point:point.clone(),light:pointLight});
  });
  world.setBeaconActive=(index)=>{world.beacons.forEach((b,i)=>{b.ring.material=i===index?torusMat:inactiveMat;b.light.intensity=i===index?18:1;b.group.scale.setScalar(i===index?1.06:.87);});};
  world.animate=(time,dt)=>{world.beacons.forEach((b,i)=>{b.ring.rotation.z=time*.25*(i%2?1:-1);b.group.position.y=b.point.y+Math.sin(time*1.8+i)*.35;b.group.children[1].rotation.y+=dt*1.5;});world.smoke.forEach((plume,i)=>{plume.position.x+=Math.sin(time*.18+plume.userData.phase)*dt*.14;plume.children.forEach((puff,p)=>{puff.position.y=(p*2.2+time*.38+i*.7)%9;puff.material.opacity=.08+.13*(1-puff.position.y/9);const s=.8+puff.position.y*.08;puff.scale.setScalar(s);});});};
  world.grappleRay=(origin,dir,maxDist=125)=>{const ray=new THREE.Raycaster(origin,dir,.2,maxDist);const result=ray.intersectObjects(world.grappleMeshes,false);return result.length?result[0].point:null;};
  world.bestAnchor=(player,dir,side)=>{
    let best=null,bestScore=-Infinity;const right=V(-dir.z,0,dir.x).normalize();
    for(const a of world.anchors){const to=a.clone().sub(player),dist=to.length();if(dist<8||dist>118)continue;
      const alignment=to.clone().normalize().dot(dir),sideAlignment=to.dot(right)*side;
      if(alignment<.35)continue;
      const score=alignment*2.5-Math.abs(dist-47)*.013+clamp(sideAlignment/75,-.4,.42)+(a.y>player.y?0.11:0);
      if(score>bestScore){bestScore=score;best=a;}
    }
    return best?best.clone():null;
  };
  world.resolveCollision=(position,previous,velocity)=>{
    let grounded=resolveWorldCollision(world.colliders,position,previous,velocity);
    // The canal is a real traversal surface: pilots sink slightly and lose momentum,
    // while the raised stone bridges retain their ordinary collider behavior.
    const bridgeXs=[-145,-97,-49,-1,47,95,143];
    const onBridge=bridgeXs.some(x=>Math.abs(position.x-x)<6.2);
    if(!onBridge&&Math.abs(position.x)<165&&position.z>102&&position.z<114&&position.y<1.35){
      position.y=.45;velocity.x*=.86;velocity.z*=.86;velocity.y=Math.max(velocity.y,-.7);grounded=false;
    }
    return grounded;
  };
  // Raycasts can happen before the first render, including immediately after redeploying.
  batchStaticScenery(scene);
  return world;
}
