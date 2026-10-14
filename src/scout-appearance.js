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


// Lightweight shared animation policy for replicated scout snapshots. These
// values animate the authoritative remote position rather than changing it.
export function animateRemoteScoutModel(model,physics,dt,time=0){
  if(!model)return;
  const flags=Number(physics?.f)||0;
  const grounded=(flags&1)!==0,boosting=(flags&2)!==0;
  const velocity=Array.isArray(physics?.v)?physics.v:[0,0,0];
  const speed=Math.hypot(Number(velocity[0])||0,Number(velocity[1])||0,Number(velocity[2])||0);
  const flat=Math.hypot(Number(velocity[0])||0,Number(velocity[2])||0);
  const turnRate=1-Math.exp(-Math.max(0,dt)*12);
  const flying=!grounded;
  const walk=grounded?Math.sin(time*Math.max(3,flat*.8))*Math.min(1,flat/8):0;
  model.tilt.rotation.x+=( (flying?-.16-Math.min(.37,speed/110):0)-model.tilt.rotation.x)*turnRate;
  model.tilt.position.y*=1-turnRate;
  model.headRig.rotation.x+=((flying?-.08:0)-model.headRig.rotation.x)*turnRate;
  for(let i=0;i<2;i++){
    const sign=i===0?-1:1;
    const arm=model.arms[i],leg=model.legs[i],elbow=model.elbows[i],knee=model.knees[i];
    arm.rotation.x+=((flying?-.67:-sign*walk*.44)-arm.rotation.x)*turnRate;
    leg.rotation.x+=((flying?-.42:sign*walk*.55)-leg.rotation.x)*turnRate;
    elbow.rotation.x+=((flying?-.28:-.13)-elbow.rotation.x)*turnRate;
    knee.rotation.x+=((flying?.28:Math.max(0,sign*walk)*.27)-knee.rotation.x)*turnRate;
    model.jets[i].visible=boosting;
    model.jets[i].scale.y=boosting?1+Math.sin(time*36+i)*.18:1;
    model.blades[i].visible=true;
  }
  model.capeL.rotation.x=-.19-Math.min(.4,speed*.007);
  model.capeR.rotation.x=-.19-Math.min(.4,speed*.007);
}
