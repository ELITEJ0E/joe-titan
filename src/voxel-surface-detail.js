import * as THREE from 'three';

// Original labPBR-inspired low-cost normal/roughness detail generated per tile.
// Each RGBA texel packs tangent-space XY normals in RG, normal Z in B,
// and material roughness in A. It is not a copied Minecraft resource pack.
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const tileKind=t=>[1,2,3,4,5,15,16,20,24,26,31].includes(t)?'stone':
  [6,7,25].includes(t)?'wood':
  [8,9,10].includes(t)?'roof':
  [12,18,19,30].includes(t)?'plants':
  t===17?'water':t===11?'glass':t===27?'emissive':'plaster';
const frac=x=>x-Math.floor(x);

export function surfaceHeight(x,y,type,seed=0){
  const u=frac(x),v=frac(y),grain=(Math.sin((u*41+seed)*12.9898+(v*47)*78.233)*43758.5453)%1;
  const g=grain-Math.floor(grain);
  if(type==='stone'){
    const row=Math.floor(v*4),offset=row%2?.1875:0;
    const tx=frac(u+offset);
    const mortar=Math.min(frac(v*4),1-frac(v*4))<.045||
      Math.min(frac(tx*2.45),1-frac(tx*2.45))<.075;
    return (mortar?-.19:.08)+g*.055;
  }
  if(type==='roof'){
    const row=Math.floor(v*4);
    const x1=frac(u+(row%2)*.19);
    return (frac(v*4)<.075?-.19:.065)+
      (frac(x1*3.1)<.08?-.11:0)+g*.025;
  }
  if(type==='wood'){
    return Math.sin(u*31+Math.sin(v*5)*.44)*.095+
      (frac(u*5.5)<.065?-.14:0)+g*.035;
  }
  if(type==='plants')return Math.sin(u*53+v*31)*.09+g*.12;
  if(type==='water')return Math.sin(u*9+v*7)*.08;
  if(type==='glass')return 0;
  return g*.036;
}

export function roughnessForTile(t){
  const kind=tileKind(t);
  return ({stone:.85,wood:.78,roof:.73,plants:.96,water:.14,
    glass:.2,emissive:.27,plaster:.91})[kind];
}

export function createVoxelSurfaceAtlas(){
  const tileSize=32,cols=8,rows=4,width=cols*tileSize,height=rows*tileSize;
  const data=new Uint8Array(width*height*4);
  for(let t=0;t<32;t++){
    const kind=tileKind(t);
    for(let y=0;y<tileSize;y++)for(let x=0;x<tileSize;x++){
      const u=(x+.5)/tileSize,v=(y+.5)/tileSize;
      const hx=surfaceHeight((x+1.5)/tileSize,v,kind,t)-
        surfaceHeight((x-.5)/tileSize,v,kind,t);
      const hy=surfaceHeight(u,(y+1.5)/tileSize,kind,t)-
        surfaceHeight(u,(y-.5)/tileSize,kind,t);
      // Sign conforms to a tangent-space bump gradient. Slope is limited
      // so masonry stays convincingly blocky, not rounded.
      const nx=clamp(-hx*2.2,-.57,.57),ny=clamp(-hy*2.2,-.57,.57);
      const nz=Math.sqrt(Math.max(.12,1-nx*nx-ny*ny));
      const len=Math.hypot(nx,ny,nz);
      const px=(t%cols)*tileSize+x,py=Math.floor(t/cols)*tileSize+y;
      const i=(py*width+px)*4;
      data[i]=Math.round((nx/len*.5+.5)*255);
      data[i+1]=Math.round((ny/len*.5+.5)*255);
      data[i+2]=Math.round((nz/len*.5+.5)*255);
      data[i+3]=Math.round(roughnessForTile(t)*255);
    }
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
  // Packed normals/roughness are data, NOT sRGB color.
  texture.colorSpace=THREE.NoColorSpace;
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.generateMipmaps=false;
  texture.needsUpdate=true;
  texture.name='JOE TITAN original voxel normal/roughness atlas';
  return texture;
}

// A physical material with tactile texture for the instanced fallback city.
// Geometry stays unchanged; this only replaces flat-looking Lambert shading.

export function makeVoxelNormalTile(kind='stone',seed=0){
  const type=/roof|tile|slate/.test(kind)?'roof':
    /stone|rock|limestone|brick|road|cobble|trim/.test(kind)?'stone':
    /wood|timber|plank/.test(kind)?'wood':
    /grass|leaf|shrub|moss/.test(kind)?'plants':'plaster';
  const size=64,rgba=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const v=(y+.5)/size,u=(x+.5)/size;
    const dx=surfaceHeight((x+1.5)/size,v,type,seed)-
      surfaceHeight((x-.5)/size,v,type,seed);
    const dy=surfaceHeight(u,(y+1.5)/size,type,seed)-
      surfaceHeight(u,(y-.5)/size,type,seed);
    const nx=clamp(-dx*1.6,-.44,.44),ny=clamp(-dy*1.6,-.44,.44);
    const nz=Math.sqrt(Math.max(.2,1-nx*nx-ny*ny)),len=Math.hypot(nx,ny,nz);
    const index=(y*size+x)*4;
    rgba[index]=Math.round((nx/len*.5+.5)*255);
    rgba[index+1]=Math.round((ny/len*.5+.5)*255);
    rgba[index+2]=Math.round((nz/len*.5+.5)*255);
    rgba[index+3]=255;
  }
  const texture=new THREE.DataTexture(rgba,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.generateMipmaps=false;texture.colorSpace=THREE.NoColorSpace;
  texture.needsUpdate=true;return texture;
}

export function makeVoxelPBRMaterial(map,kind='stone',seed=1){
  const roof=/roof|tile|slate/.test(kind),stone=/stone|rock|limestone|brick|road|cobble|trim/.test(kind);
  const wood=/wood|timber|plank/.test(kind),foliage=/grass|leaf|shrub|moss/.test(kind);
  const roughness=foliage?.91:roof?.73:wood?.78:stone?.83:.86;
  const material=new THREE.MeshStandardMaterial({map,roughness,metalness:.0,
    side:THREE.FrontSide});
  if(kind!=='water'&&kind!=='glass'&&kind!=='glow'){
    material.normalMap=makeVoxelNormalTile(kind,seed);
    material.normalScale.set(.55,.55);
  }
  return material;
}
