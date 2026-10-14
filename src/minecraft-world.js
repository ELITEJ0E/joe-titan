import * as THREE from 'three';
import {findSafeMinecraftSpawn} from './minecraft-spawn.js';
import {slideVoxelHorizontal} from './voxel-slide.js';
import {createShiganshinaVisuals} from './shiganshina-visuals.js';
import {sunVisibility,cornerOcclusion} from './voxel-illumination.js';
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
function createSectors(scene,asset,material){
  const bins=new Map(),d=asset.quads;
  for(let i=0;i<asset.count;i++){
    const offset=i*9,key=(d.getUint16(offset,true)>>4)+','+(d.getUint16(offset+3,true)>>4);
    if(!bins.has(key))bins.set(key,[]);
    bins.get(key).push(offset);
  }
  for(const offsets of bins.values()){
    const n=offsets.length,positions=new Float32Array(n*12),normals=new Float32Array(n*12),uvs=new Float32Array(n*8),tiles=new Float32Array(n*4),shadows=new Float32Array(n*4),occlusion=new Float32Array(n*4);
    const indices=n*4>65535?new Uint32Array(n*6):new Uint16Array(n*6);
    for(let i=0;i<n;i++){
      const o=offsets[i],x=d.getUint16(o,true),y=d.getUint8(o+2),z=d.getUint16(o+3,true);
      const width=d.getUint8(o+5),height=d.getUint8(o+6),type=d.getUint8(o+7),side=d.getUint8(o+8);
      const axis=side>>1,positive=(side&1)===1;
      const q=axis===0?[[x+(positive?1:0),y,z],[x+(positive?1:0),y,z+width],[x+(positive?1:0),y+height,z+width],[x+(positive?1:0),y+height,z]]
        :axis===1?[[x,y+(positive?1:0),z],[x+width,y+(positive?1:0),z],[x+width,y+(positive?1:0),z+height],[x,y+(positive?1:0),z+height]]
        :[[x,y,z+(positive?1:0)],[x+width,y,z+(positive?1:0)],[x+width,y+height,z+(positive?1:0)],[x,y+height,z+(positive?1:0)]];
      const faceCenter=[(q[0][0]+q[2][0])*.5,(q[0][1]+q[2][1])*.5,(q[0][2]+q[2][2])*.5];
      const sunlight=sunVisibility(asset,faceCenter,side);
      for(let j=0;j<4;j++){
        shadows[i*4+j]=sunlight;
        occlusion[i*4+j]=cornerOcclusion(asset,q[j],side,j);
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
    geometry.setAttribute('aShadow',new THREE.BufferAttribute(shadows,1));
    geometry.setAttribute('aAO',new THREE.BufferAttribute(occlusion,1));
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
    world.lastCollision={wallSpeed:0,landingSpeed:0};
    // If an outdated save or a geometry edge starts inside a solid wall,
    // recover to the verified street spawn instead of endlessly reverting
    // to the same trapped position.
    if(solid(prev.x,prev.y-.2,prev.z)){
      pos.copy(world.spawnPoint);vel.set(0,0,0);return true;
    }
    // Swept horizontal capsule approximation glides along buildings instead
    // of zeroing both horizontal axes whenever a high-speed hook hits a wall.
    const beforeX=vel.x,beforeZ=vel.z;
    const horizontal=slideVoxelHorizontal(pos,prev,vel,solid);
    if(horizontal.blockedX||horizontal.blockedZ){
      // Damage measures the component normal to the actual obstructing
      // voxel face, not total horizontal speed. A pilot sliding sideways
      // past a wall should not receive head-on collision damage.
      world.lastCollision.wallSpeed=Math.max(
        horizontal.blockedX?Math.abs(beforeX):0,
        horizontal.blockedZ?Math.abs(beforeZ):0
      );
    }
    const feet=prev.y-1,ground=roof(pos.x,pos.z,feet-ORIGIN.y+.3);
    if(vel.y<=0&&feet>=ground-.38&&pos.y<=ground+1){
      world.lastCollision.landingSpeed=-vel.y;
      pos.y=ground+1;vel.y=0;return true;
    }
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
  // The full-detail converted world now shares a configurable, original
  // Minecraft-shader-inspired light and texture pipeline (no extra geometry).
  const visuals=createShiganshinaVisuals(scene,asset.colors,'performance');
  const sectors=createSectors(scene,asset,visuals.material);
  installVoxelPhysics(world,asset);
  // The former fixed (-30,19,29) point was inside authored masonry.
  // Choose a genuinely outdoor, clear-headed street using the loaded voxels.
  const safeSpawn=findSafeMinecraftSpawn(asset,ORIGIN);
  if(!safeSpawn)throw Error('No collision-safe Shiganshina street spawn found');
  world.spawnPoint.set(safeSpawn.x,safeSpawn.y,safeSpawn.z);
  installMissions(scene,world);
  const animateMissions=world.animate;
  world.animate=(time,dt)=>{visuals.animate(time);animateMissions(time,dt);};
  world.setVisualQuality=visuals.setQuality;
  world.setMenuClarity=visuals.setMenuClarity;
  world.stats={quads:asset.count,sectors,blocks:asset.voxel.length,lighting:'baked sun visibility and voxel corner AO'};
  return world;
}
