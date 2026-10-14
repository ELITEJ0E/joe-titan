import * as THREE from 'three';
// A Minecraft Java Anvil world baked into a compact, greedy-meshed JTVX archive.
// The archive is user-supplied and optional: no copyrighted map ships in source.
const ORIGIN=new THREE.Vector3(-152,-10,-146);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const NON_SOLID=new Set([0,17,19]);
const NORMALS=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
function unpack(buffer){
  const view=new DataView(buffer),data=new Uint8Array(buffer);
  if(String.fromCharCode(...data.subarray(0,4))!=='JTVX'||view.getUint16(4,true)!==1)throw Error('Invalid JTVX header');
  const nx=view.getUint16(6,true),ny=view.getUint16(8,true),nz=view.getUint16(10,true);
  const count=view.getUint32(12,true),colorsCount=view.getUint32(16,true),paletteLen=view.getUint32(20,true);
  if(nx!==304||ny!==88||nz!==304||colorsCount!==32||count>600000||paletteLen>4096)throw Error('Invalid map dimensions');
  const colors=new TextDecoder().decode(data.subarray(24,24+paletteLen)).split('\n').map(s=>s.split('=')[1]);
  const start=24+paletteLen,size=nx*ny*nz;
  if(data.length!==start+size+count*9)throw Error('Truncated Shiganshina map');
  return {nx,ny,nz,count,colors,voxel:data.subarray(start,start+size),quads:new DataView(buffer,start+size,count*9)};
}
function atlasTexture(colors){
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const ctx=c.getContext('2d'),tile=32;
  const rand=i=>((Math.imul(i,1664525)+1013904223)>>>0)/4294967296;
  for(let t=0;t<32;t++){
    const x=(t%8)*tile,y=(3-Math.floor(t/8))*tile,base=new THREE.Color(colors[t]||'#888888');
    for(let j=0;j<tile;j+=2)for(let i=0;i<tile;i+=2){
      const n=rand(t*92771+i*231+j*901);
      ctx.fillStyle='#'+base.clone().offsetHSL((n-.5)*.016,0,(n-.5)*.085).getHexString();
      ctx.fillRect(x+i,y+j,2,2);
    }
    if([1,2,3,4,5,8,9,10,14,16,26].includes(t)){
      ctx.fillStyle='rgba(23,17,18,.23)';
      for(let j=0;j<32;j+=8){ctx.fillRect(x,y+j,32,1);for(let i=j%16?5:0;i<32;i+=11)ctx.fillRect(x+i,y+j,1,8);}
    }else if([6,7,23].includes(t)){
      ctx.fillStyle='rgba(38,21,18,.25)';for(let i=0;i<32;i+=6)ctx.fillRect(x+i,y,1,32);
    }else if(t===11){ctx.fillStyle='rgba(250,250,255,.4)';ctx.fillRect(x+3,y+3,1,26);ctx.fillRect(x+16,y+4,1,24);ctx.fillRect(x+3,y+16,26,1);}
    else if(t===27){ctx.fillStyle='rgba(255,241,205,.45)';ctx.fillRect(x+5,y+5,22,22);}
  }
  const texture=new THREE.CanvasTexture(c);
  texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
function voxelMaterial(texture){
  return new THREE.ShaderMaterial({
    uniforms:{uAtlas:{value:texture},uFog:{value:new THREE.Color(0xb8b0a8)},uSun:{value:V(-.65,.84,-.32).normalize()}},
    vertexShader:"attribute float aTile;varying float vTile;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;void main(){vTile=aTile;vUv=uv;vNormal=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
    fragmentShader:"uniform sampler2D uAtlas;uniform vec3 uFog;uniform vec3 uSun;varying float vTile;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;void main(){vec2 cell=vec2(mod(vTile,8.0),floor(vTile/8.0));vec2 uvAtlas=(cell+vec2(.018)+fract(vUv+.00001)*.964)/vec2(8.0,4.0);vec3 base=texture2D(uAtlas,uvAtlas).rgb;float light=max(0.0,dot(normalize(vNormal),uSun));float shade=(.60+light*.66)*(vNormal.y>0.9?1.05:vNormal.y<-.9?.48:.92);vec3 lit=base*shade*vec3(1.04,.97,.91);float haze=smoothstep(125.0,285.0,length(cameraPosition-vWorld))*.77;gl_FragColor=vec4(mix(lit,uFog,haze),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
    side:THREE.FrontSide,toneMapped:true
  });
}
function createSectors(scene,asset,material){
  const bins=new Map(),d=asset.quads;
  for(let i=0;i<asset.count;i++){
    const offset=i*9,key=(d.getUint16(offset,true)>>4)+','+(d.getUint16(offset+3,true)>>4);
    if(!bins.has(key))bins.set(key,[]);
    bins.get(key).push(offset);
  }
  for(const offsets of bins.values()){
    const n=offsets.length,positions=new Float32Array(n*12),normals=new Float32Array(n*12),uvs=new Float32Array(n*8),tiles=new Float32Array(n*4);
    const indices=n*4>65535?new Uint32Array(n*6):new Uint16Array(n*6);
    for(let i=0;i<n;i++){
      const o=offsets[i],x=d.getUint16(o,true),y=d.getUint8(o+2),z=d.getUint16(o+3,true);
      const width=d.getUint8(o+5),height=d.getUint8(o+6),type=d.getUint8(o+7),side=d.getUint8(o+8);
      const axis=side>>1,positive=(side&1)===1;
      const q=axis===0?[[x+(positive?1:0),y,z],[x+(positive?1:0),y,z+width],[x+(positive?1:0),y+height,z+width],[x+(positive?1:0),y+height,z]]
        :axis===1?[[x,y+(positive?1:0),z],[x+width,y+(positive?1:0),z],[x+width,y+(positive?1:0),z+height],[x,y+(positive?1:0),z+height]]
        :[[x,y,z+(positive?1:0)],[x+width,y,z+(positive?1:0)],[x+width,y+height,z+(positive?1:0)],[x,y+height,z+(positive?1:0)]];
      for(let j=0;j<4;j++){
        const p=i*12+j*3,t=i*8+j*2;
        positions[p]=q[j][0]+ORIGIN.x;positions[p+1]=q[j][1]+ORIGIN.y;positions[p+2]=q[j][2]+ORIGIN.z;
        normals.set(NORMALS[side],p);uvs[t]=(j===1||j===2)?width:0;uvs[t+1]=j>=2?height:0;tiles[i*4+j]=type;
      }
      const b=i*4,reverse=side===1||side===3||side===4;
      indices.set(reverse?[b,b+2,b+1,b,b+3,b+2]:[b,b+1,b+2,b,b+2,b+3],i*6);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
    geometry.setAttribute('aTile',new THREE.BufferAttribute(tiles,1));
    geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name='Shiganshina sector';mesh.frustumCulled=true;
    scene.add(mesh);
  }
  return bins.size;
}
function installVoxelPhysics(world,asset){
  const {nx,ny,nz,voxel}=asset;
  const tile=(x,y,z)=>{
    const ix=Math.floor(x-ORIGIN.x),iy=Math.floor(y-ORIGIN.y),iz=Math.floor(z-ORIGIN.z);
    return ix<0||iy<0||iz<0||ix>=nx||iy>=ny||iz>=nz?0:voxel[(ix*ny+iy)*nz+iz];
  };
  const solid=(x,y,z)=>!NON_SOLID.has(tile(x,y,z));
  const roof=(x,z,ceiling=ny-1)=>{
    const ix=Math.floor(x-ORIGIN.x),iz=Math.floor(z-ORIGIN.z);
    if(ix<0||iz<0||ix>=nx||iz>=nz)return ORIGIN.y;
    for(let y=Math.min(ny-1,Math.floor(ceiling));y>=0;y--)if(!NON_SOLID.has(voxel[(ix*ny+y)*nz+iz]))return ORIGIN.y+y+1;
    return ORIGIN.y;
  };
  world.terrainHeight=(x,z)=>roof(x,z);
  world.grappleRay=(origin,direction,maxDist=128)=>{
    const v=direction.clone().normalize(),p=origin.clone().sub(ORIGIN);
    let x=Math.floor(p.x),y=Math.floor(p.y),z=Math.floor(p.z);
    const sx=Math.sign(v.x),sy=Math.sign(v.y),sz=Math.sign(v.z);
    const dx=v.x?Math.abs(1/v.x):Infinity,dy=v.y?Math.abs(1/v.y):Infinity,dz=v.z?Math.abs(1/v.z):Infinity;
    let tx=v.x?((sx>0?x+1:x)-p.x)/v.x:Infinity;
    let ty=v.y?((sy>0?y+1:y)-p.y)/v.y:Infinity;
    let tz=v.z?((sz>0?z+1:z)-p.z)/v.z:Infinity;
    let t=0;
    for(let i=0;i<370&&t<=maxDist;i++){
      if(t>.2&&solid(x+ORIGIN.x+.5,y+ORIGIN.y+.5,z+ORIGIN.z+.5))return origin.clone().addScaledVector(v,t);
      if(tx<ty&&tx<tz){x+=sx;t=tx;tx+=dx;}else if(ty<tz){y+=sy;t=ty;ty+=dy;}else{z+=sz;t=tz;tz+=dz;}
      if(!Number.isFinite(t))break;
    }
    return null;
  };
  world.resolveCollision=(pos,prev,vel)=>{
    const torso=pos.y-.2;
    if(solid(pos.x,torso,pos.z)){
      if(!solid(prev.x,torso,pos.z)){pos.x=prev.x;vel.x=0;}
      if(!solid(pos.x,torso,prev.z)){pos.z=prev.z;vel.z=0;}
      if(solid(pos.x,torso,pos.z)){pos.x=prev.x;pos.z=prev.z;vel.x=0;vel.z=0;}
    }
    const feet=prev.y-1,ground=roof(pos.x,pos.z,feet-ORIGIN.y+.3);
    if(vel.y<=0&&feet>=ground-.38&&pos.y<=ground+1){pos.y=ground+1;vel.y=0;return true;}
    if(pos.y<=1){pos.y=1;if(vel.y<0)vel.y=0;return true;}
    pos.x=clamp(pos.x,-152,152);pos.z=clamp(pos.z,-146,158);
    return false;
  };
  world.anchors=[];
  // Navigation-only rooftop footprints; movement uses the actual voxel grid.
  // This preserves the tactical map without hundreds of physics box checks.
  for(let x=5;x<nx-5;x+=8)for(let z=5;z<nz-5;z+=8){
    const xx=x+ORIGIN.x+.5,zz=z+ORIGIN.z+.5,h=roof(xx,zz);
    if(h>10&&h<80)world.colliders.push({x:xx,z:zz,h,halfW:3.8,halfD:3.8});
  }
  for(let x=10;x<nx-10;x+=12)for(let z=10;z<nz-10;z+=12){
    const xx=x+ORIGIN.x+.5,zz=z+ORIGIN.z+.5,h=roof(xx,zz);
    if(h>6&&h<75)world.anchors.push(V(xx,h+1,zz));
  }
  world.bestAnchor=(pilot,direction,side)=>{
    const dir=direction.clone().normalize(),right=V(-dir.z,0,dir.x);
    let best=null,score=-Infinity;
    for(const a of world.anchors){
      const diff=a.clone().sub(pilot),dist=diff.length();if(dist<8||dist>118)continue;
      const align=diff.dot(dir)/dist;if(align<.35)continue;
      const rank=align*2.6-Math.abs(dist-44)*.012+clamp(diff.dot(right)*side/75,-.4,.4);
      if(rank>score){score=rank;best=a;}
    }
    return best?.clone()??null;
  };
}
function installMissions(scene,world){
  const active=new THREE.MeshBasicMaterial({color:0xffd17c}),idle=new THREE.MeshBasicMaterial({color:0x698fa5});
  const coords=[[-30,29],[-100,-70],[75,-94],[115,44],[28,115],[-97,110]];
  for(let i=0;i<coords.length;i++){
    const [x,z]=coords[i],point=V(x,Math.max(15,world.terrainHeight(x,z)+9),z),group=new THREE.Group();
    group.position.copy(point);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(4,.4,6,24),idle);
    group.add(ring);group.add(new THREE.Mesh(new THREE.OctahedronGeometry(1),active));
    scene.add(group);world.beacons.push({point,group,ring});
  }
  world.setBeaconActive=index=>world.beacons.forEach((b,i)=>{b.ring.material=i===index?active:idle;});
  world.animate=(time,dt)=>world.beacons.forEach((b,i)=>{b.group.position.y=b.point.y+Math.sin(time*2+i)*.35;b.ring.rotation.z+=dt*.8;});
  world.setBeaconActive(0);
}
export async function loadMinecraftWorld(scene,url='/maps/shiganshina.jtvx'){
  const response=await fetch(url);
  if(!response.ok)throw Error('Converted Minecraft map not installed ('+response.status+')');
  if(typeof DecompressionStream==='undefined')throw Error('Browser cannot decompress the map');
  const decompressed=await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
  const asset=unpack(decompressed);
  const world={style:'minecraft-world',spawnPoint:V(-30,19,29),colliders:[],beacons:[],districtRoads:[],grappleMeshes:[],smoke:[],lamps:[],
    landmarks:{cathedral:[0,-14],plaza:[-30,29],citadel:[0,-45],arena:[120,0],market:[40,30],townHall:[0,65],harbour:[90,110],canalZ:-10000}};
  scene.background=new THREE.Color(0xa9cad8);scene.fog=new THREE.Fog(0xb1b9b2,128,360);
  scene.add(new THREE.HemisphereLight(0xffead6,0x4f6570,1.8));
  const sun=new THREE.DirectionalLight(0xffd6ac,2.2);sun.position.set(-115,150,-80);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-180;sun.shadow.camera.right=180;
  sun.shadow.camera.top=180;sun.shadow.camera.bottom=-180;scene.add(sun);
  const sectors=createSectors(scene,asset,voxelMaterial(atlasTexture(asset.colors)));
  installVoxelPhysics(world,asset);installMissions(scene,world);
  world.stats={quads:asset.count,sectors,blocks:asset.voxel.length};
  return world;
}
