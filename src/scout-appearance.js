import * as THREE from 'three';

// Original procedural 16x16 pixel skins: no external assets, white fallback
// meshes, cross-origin texture requests or third-party Minecraft skins.
// Every remote scout uses the same detailed local rig and independently shaded
// cloth, hair and skin. Variation is a stable function of peer ID.
const PALETTES=Object.freeze([
  {jacket:0xb38b5a,cape:0x315b45,skin:0xdfa57e,hair:0x33241e},
  {jacket:0x857c6a,cape:0x33556a,skin:0xc58c69,hair:0x272222},
  {jacket:0x927b54,cape:0x4f513d,skin:0xf0c0a0,hair:0x57402e},
  {jacket:0x986e53,cape:0x59435d,skin:0xb98262,hair:0x242027},
  {jacket:0x9e8b70,cape:0x40594b,skin:0xd6a081,hair:0x402f28},
  {jacket:0xa17b65,cape:0x445773,skin:0xe9b391,hair:0x2d2b25}
]);

export function scoutAppearanceIndex(peerId=''){
  const input=String(peerId);
  let hash=2166136261;
  for(let i=0;i<input.length;i++)hash=Math.imul(hash^input.charCodeAt(i),16777619);
  return (hash>>>0)%PALETTES.length;
}

export function makeScoutPixelTexture(seed=1,kind='cloth'){
  let x=(seed|0)||1;
  const rand=()=>((x=Math.imul(x^x>>>15,2246822519)+3266489917|0)>>>0)/4294967296;
  const size=16,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let col=0;col<size;col++){
    const i=(y*size+col)*4;
    const seam=kind==='cloth'&&(y%7===0||col%8===0);
    const grain=kind==='skin'?rand()*.09:kind==='hair'?rand()*.15:rand()*.13;
    let shade=.88+grain-(seam?.12:0);
    if(kind==='hair'&&(y+col)%5===0)shade-=.08;
    shade=Math.max(.64,Math.min(1,shade));
    const channel=Math.round(255*shade);
    data[i]=channel;data[i+1]=channel;data[i+2]=channel;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.name='Scout pixel '+kind;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.generateMipmaps=false;texture.needsUpdate=true;
  return texture;
}

export function applyRemoteScoutAppearance(root,{peerId='',variant=null}={}){
  const index=Number.isInteger(variant)?((variant%PALETTES.length)+PALETTES.length)%PALETTES.length:scoutAppearanceIndex(peerId);
  const colors=PALETTES[index],originals=new Map();
  let seed=12345+index*157;
  root.traverse(node=>{
    if(!node.isMesh||!node.material?.isMeshStandardMaterial)return;
    const base=node.material;
    if(!originals.has(base)){
      const mat=base.clone(),key=base.color.getHex();
      let kind='cloth';
      if(key===0xa87b4e){mat.color.setHex(colors.jacket);}
      else if(key===0x284c3c){mat.color.setHex(colors.cape);}
      else if(key===0x193a30){mat.color.setHex(new THREE.Color(colors.cape).multiplyScalar(.64).getHex());}
      else if(key===0xe1aa88){mat.color.setHex(colors.skin);kind='skin';}
      else if(key===0x29201c){mat.color.setHex(colors.hair);kind='hair';}
      else if(key===0x86939a||key===0xc5d2d4||key===0xb99a62){
        // Metal blades and gas cylinders retain metallic surfaces, not
        // a coarse cloth map; strong color hierarchy remains readable.
        originals.set(base,mat);node.material=mat;return;
      }
      mat.map=makeScoutPixelTexture(seed+=83,kind);
      mat.needsUpdate=true;
      originals.set(base,mat);
    }
    node.material=originals.get(base);
  });
  return {variant:index,colors:{...colors},materials:[...originals.values()]};
}

export function disposeRemoteScoutVisual(root){
  const meshes=new Set(),materials=new Set(),textures=new Set();
  root.traverse(node=>{
    if(node.geometry)meshes.add(node.geometry);
    const mats=Array.isArray(node.material)?node.material:[node.material];
    for(const material of mats){
      if(!material)continue;
      materials.add(material);
      if(material.map)textures.add(material.map);
    }
  });
  for(const t of textures)t.dispose();
  for(const m of materials)m.dispose();
  for(const g of meshes)g.dispose();
}
