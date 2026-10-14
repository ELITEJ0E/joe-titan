import * as THREE from 'three';
// Original Minecraft-inspired pixel atlas and physically evocative (not PBR) lighting.
// No third-party shader-pack or Minecraft textures are included.
export const VISUAL_PRESETS=Object.freeze({
  performance:Object.freeze({pixelRatio:1.12,exposure:1.13,fogNear:125,fogFar:390,cloudShadow:.06,edgeAO:.10,sunShadow:.70,bloom:false,shadowMap:1024}),
  cinematic:Object.freeze({pixelRatio:1.35,exposure:1.10,fogNear:105,fogFar:365,cloudShadow:.15,edgeAO:.16,sunShadow:1,bloom:true,shadowMap:2048})
});
export const normaliseVisualQuality=v=>v==='cinematic'?'cinematic':'performance';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
const stone=new Set([1,2,3,4,5,15,16,20,24,26,31]);
const timber=new Set([6,7,25]),roofs=new Set([8,9,10]);
const plants=new Set([12,18,19,30]);
export function createShiganshinaAtlas(colors){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d',{alpha:false});
  for(let t=0;t<32;t++){
    const x=(t%8)*32,y=(3-Math.floor(t/8))*32,rng=random(57833+t*97439);
    const base=new THREE.Color(colors[t]||'#89867c');
    for(let j=0;j<32;j+=2)for(let i=0;i<32;i+=2){
      const v=(rng()-.5)*(plants.has(t)?.14:.09);
      const c=base.clone().offsetHSL((rng()-.5)*.012,0,v);
      ctx.fillStyle='#'+c.getHexString();ctx.fillRect(x+i,y+j,2,2);
    }
    if(stone.has(t)){
      for(let row=0;row<4;row++){
        const py=y+row*8,shift=row%2?6:0;
        ctx.fillStyle='rgba(25,25,27,.28)';ctx.fillRect(x,py,32,1);
        for(let i=-shift;i<32;i+=13){
          ctx.fillRect(x+i,py,1,8);
          ctx.fillStyle='rgba(255,244,218,.14)';ctx.fillRect(x+i+1,py+1,9,1);
          ctx.fillStyle='rgba(27,22,20,.12)';ctx.fillRect(x+i+1,py+7,8,1);
          ctx.fillStyle='rgba(25,25,27,.28)';
        }
      }
      // Individual masonry chips, sand-grain highlights and uneven stone
      // patches add depth without introducing copyrighted block textures.
      for(let n=0;n<30;n++){
        const px=x+Math.floor(rng()*31),py=y+Math.floor(rng()*31);
        ctx.fillStyle=rng()>.52?'rgba(249,239,208,.19)':'rgba(34,40,43,.16)';
        ctx.fillRect(px,py,1+rng()*2,1+rng()*2);
      }
      if(t===24){ // mossy masonry: irregular green mineral staining
        for(let n=0;n<17;n++){
          ctx.fillStyle=rng()>.45?'rgba(72,98,59,.35)':'rgba(118,130,72,.22)';
          ctx.fillRect(x+rng()*30,y+rng()*30,2+rng()*4,1+rng()*2);
        }
      }
    }else if(roofs.has(t)){
      for(let row=0;row<4;row++){
        const py=y+row*8,shift=row%2?6:0;
        ctx.fillStyle='rgba(41,21,18,.34)';ctx.fillRect(x,py+7,32,1);
        ctx.fillStyle='rgba(255,212,162,.17)';ctx.fillRect(x,py,32,1);
        for(let i=-shift;i<32;i+=12){
          ctx.fillStyle='rgba(50,24,22,.24)';ctx.fillRect(x+i,py+1,1,6);
          ctx.fillStyle=rng()>.5?'rgba(251,210,158,.15)':'rgba(69,28,22,.12)';
          ctx.fillRect(x+i+2,py+2,7,3);
          ctx.fillStyle='rgba(255,234,190,.12)';ctx.fillRect(x+i+2,py+1,6,1);
        }
      }
    }else if(timber.has(t)){
      for(let i=1;i<32;i+=6){ctx.fillStyle='rgba(30,17,15,.27)';ctx.fillRect(x+i,y,1,32);ctx.fillStyle='rgba(239,189,136,.13)';ctx.fillRect(x+i+2,y,1,32);}
      for(let n=0;n<24;n++){ctx.fillStyle='rgba(29,18,13,.16)';ctx.fillRect(x+rng()*32,y+rng()*32,1,3+rng()*7);}
    }else if(plants.has(t)){
      for(let n=0;n<55;n++){ctx.fillStyle=rng()<.5?'rgba(25,55,26,.25)':'rgba(215,233,132,.22)';ctx.fillRect(x+rng()*30,y+rng()*30,2+rng()*3,2+rng()*3);}
    }
    if(t===11){ctx.fillStyle='rgba(212,243,245,.5)';ctx.fillRect(x+3,y+2,2,28);ctx.fillRect(x+17,y+2,2,28);ctx.fillRect(x+3,y+16,26,2);}
    if(t===17)for(let k=0;k<12;k++){ctx.fillStyle='rgba(196,237,235,.23)';ctx.fillRect(x+rng()*29,y+rng()*32,4+rng()*8,1);}
    if(t===27){ctx.fillStyle='rgba(255,244,193,.75)';ctx.fillRect(x+5,y+5,22,22);}
  }
  const tex=new THREE.CanvasTexture(canvas);
  tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestMipmapNearestFilter;
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=2;
  return tex;
}
const vs=`
attribute float aTile;
attribute float aShadow;
attribute float aAO;
varying float vTile;varying float vShadow;varying float vAO;
varying vec2 vUV;varying vec3 vWorld;varying vec3 vNormal;
void main(){
 vTile=aTile;vShadow=aShadow;vAO=aAO;vUV=uv;
 vec4 w=modelMatrix*vec4(position,1.);
 vWorld=w.xyz;vNormal=normalize(mat3(modelMatrix)*normal);
 gl_Position=projectionMatrix*viewMatrix*w;
}`;
const fs=`
uniform sampler2D uAtlas;
uniform vec3 uSunDir,uSunTint,uSkyTint,uFogColor;
uniform float uTime,uFogNear,uFogFar,uCloudShadow,uEdgeAO,uSunShadow;
varying float vTile;varying float vShadow;varying float vAO;
varying vec2 vUV;varying vec3 vWorld;varying vec3 vNormal;
void main(){
 vec2 tile=vec2(mod(vTile,8.),floor(vTile/8.));
 vec2 uv=fract(vUV+.00001);
 vec2 atlasUV=(tile+vec2(.02)+uv*.96)/vec2(8.,4.);
 vec3 base=texture2D(uAtlas,atlasUV).rgb;
 vec3 n=normalize(vNormal);
 float sun=max(dot(n,uSunDir),0.);
 // Color-temperature separation inspired by cinematic Minecraft shader packs.
 // Sunlight is baked from the imported voxel grid; it shades entire facades,
 // while the cool hemispheric fill keeps shadowed streets readable.
 float bakedSun=mix(1.0,clamp(vShadow,.28,1.0),uSunShadow);
 vec3 lit=base*(uSkyTint*(.56+max(n.y,0.)*.20)+uSunTint*sun*bakedSun*.96);
 lit*=mix(1.0,clamp(vAO,.52,1.0),.87);
 if(n.y<-.5)lit*=.62;
 // Screen-space AO is too costly in fast ODM flight. Approximate block seams.
 vec2 edges=min(uv,1.-uv);
 float seam=1.-smoothstep(.01,.075,min(edges.x,edges.y));
 lit*=1.-uEdgeAO*seam;
 if(vTile>7.5&&vTile<10.6){
   lit*=vec3(1.12,.98,.91);
   lit+=base*sun*bakedSun*.045;
 }else if(vTile>10.5&&vTile<11.5){
   float fresnel=pow(1.-abs(dot(n,normalize(cameraPosition-vWorld))),2.);
   lit=mix(lit,vec3(.40,.67,.84),.11+fresnel*.26);
 }else if(vTile>16.5&&vTile<17.5){
   float wave=sin(vWorld.x*.48+uTime*1.35)*sin(vWorld.z*.37-uTime*1.15);
   float fresnel=pow(1.-abs(dot(n,normalize(cameraPosition-vWorld))),2.3);
   lit=mix(lit,vec3(.34,.67,.76),.13+fresnel*.31);
   lit+=vec3(.09,.14,.12)*max(0.,wave)*sun;
 }else if(vTile>26.5&&vTile<27.5){
   lit+=base*vec3(.80,.46,.18);
 }
 if(uCloudShadow>0.){
   float cloud=sin(vWorld.x*.032+uTime*.022)*sin(vWorld.z*.029-uTime*.014);
   lit*=1.-uCloudShadow*smoothstep(-.15,.65,cloud)*sun;
 }
 float range=length(cameraPosition-vWorld);
 float fog=smoothstep(uFogNear,uFogFar,range);
 fog*=1.+.21*exp(-max(vWorld.y-5.,0.)*.065);
 // Keep distant walls recognisable; the old dense pink fog erased geometry.
 lit=mix(lit,uFogColor,clamp(fog*.60,0.,.68));
 gl_FragColor=vec4(lit,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const skyVS=`varying vec3 vDir;
void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const skyFS=`
uniform float uTime,uCloudOpacity;
varying vec3 vDir;
void main(){
 vec3 dir=normalize(vDir);
 float altitude=smoothstep(-.18,.75,dir.y);
 vec3 sky=mix(vec3(.77,.70,.69),vec3(.27,.53,.77),altitude);
 float facing=max(dot(dir,normalize(vec3(-.66,.69,-.30))),0.);
 sky+=vec3(1.,.51,.27)*pow(facing,22.)*.29;
 sky+=vec3(1.,.84,.53)*pow(facing,550.)*.78;
 if(uCloudOpacity>0.){
  vec2 p=dir.xz/max(.16,dir.y+.45);
  float drift=uTime*.0012;
  float bands=sin(p.x*4.9+drift)*sin(p.y*4.-drift*.68)
    +.35*sin(p.x*10.3-p.y*3.1+drift*1.3);
  float cloud=smoothstep(.23,.69,bands)*smoothstep(-.1,.18,dir.y);
  sky=mix(sky,vec3(.98,.81,.69),cloud*uCloudOpacity);
 }
 gl_FragColor=vec4(sky,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export function createShiganshinaVisuals(scene,colors,mode='performance'){
 const atlas=createShiganshinaAtlas(colors);
 const sunDir=new THREE.Vector3(-.66,.69,-.30).normalize();
 const uniforms={
   uAtlas:{value:atlas},uSunDir:{value:sunDir},
   uSunTint:{value:new THREE.Color(0xffd0a1)},uSkyTint:{value:new THREE.Color(0xbad3f0)},
   uFogColor:{value:new THREE.Color(0xbac9d5)},uTime:{value:0},
   uFogNear:{value:125},uFogFar:{value:390},uCloudShadow:{value:0},uEdgeAO:{value:0},uSunShadow:{value:0}
 };
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:vs,fragmentShader:fs,side:THREE.FrontSide,toneMapped:true});
 const skyUniforms={uTime:{value:0},uCloudOpacity:{value:.12}};
 const sky=new THREE.Mesh(new THREE.SphereGeometry(1200,28,18),
   new THREE.ShaderMaterial({uniforms:skyUniforms,vertexShader:skyVS,fragmentShader:skyFS,
     side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,toneMapped:true}));
 sky.name='Shiganshina Golden Sky';sky.frustumCulled=false;sky.renderOrder=-1000;
 sky.onBeforeRender=(_r,_s,camera)=>{sky.position.copy(camera.position);sky.updateMatrixWorld();};
 scene.add(sky);
 const ambient=new THREE.HemisphereLight(0xf4e8d3,0x5c7695,1.75);
 scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xffd2a8,2.45);
 sun.position.copy(sunDir).multiplyScalar(220);
 sun.castShadow=true;
 sun.shadow.camera.left=-130;sun.shadow.camera.right=130;
 sun.shadow.camera.top=130;sun.shadow.camera.bottom=-130;
 sun.shadow.camera.near=1;sun.shadow.camera.far=480;
 sun.shadow.bias=-.00025;sun.shadow.normalBias=.045;
 scene.add(sun);
 scene.background=new THREE.Color(0xaec3d6);
 scene.fog=new THREE.Fog(0xbac9d5,125,418);
 let currentPreset=VISUAL_PRESETS[normaliseVisualQuality(mode)],menuClarity=false;
 function refreshFog(){
  // The custom voxel shader has its own fog uniforms; update BOTH that
  // shader and Three.js fog so the title screen actually looks clearer.
  uniforms.uFogNear.value=menuClarity?210:currentPreset.fogNear;
  uniforms.uFogFar.value=menuClarity?710:currentPreset.fogFar;
  scene.fog.near=menuClarity?200:currentPreset.fogNear;
  scene.fog.far=menuClarity?760:currentPreset.fogFar+28;
 }
 function setMenuClarity(value){
  menuClarity=!!value;refreshFog();
 }
 function setQuality(quality){
  const p=VISUAL_PRESETS[normaliseVisualQuality(quality)];
  currentPreset=p;refreshFog();
  uniforms.uCloudShadow.value=p.cloudShadow;uniforms.uEdgeAO.value=p.edgeAO;
  uniforms.uSunShadow.value=p.sunShadow;
  skyUniforms.uCloudOpacity.value=p.bloom ? .34 : .12;
  sun.shadow.mapSize.set(p.shadowMap,p.shadowMap);
  if(sun.shadow.map)sun.shadow.map.dispose();
  sun.shadow.map=null;sun.shadow.needsUpdate=true;
 }
 function animate(time){uniforms.uTime.value=time;skyUniforms.uTime.value=time;}
 setQuality(mode);
 return {material,setQuality,setMenuClarity,animate,sky,sun,ambient};
}
