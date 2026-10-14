import * as THREE from 'three';

// Original Three.js lighting model informed by voxel shader research.
// Sun direction stays close to the voxel bake direction: moving it far from
// baked visibility would incorrectly light interiors and occluded facades.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const color=(v)=>new THREE.Color(v);

export const ATMOSPHERE_DEFAULTS=Object.freeze({
 timeOfDay:.47,stormAmount:0,steamAmount:0,weather:'clear'
});

export function sampleCinematicAtmosphere(overrides={}){
 const v={...ATMOSPHERE_DEFAULTS,...overrides};
 const time=clamp(Number.isFinite(v.timeOfDay)?v.timeOfDay:.47,0,1);
 const storm=clamp(v.stormAmount||0,0,1);
 const steam=clamp(v.steamAmount||0,0,1);
 // Exterior appearance changes throughout the day, while static voxel
 // visibility remains compatible with the precomputed sunlight bake.
 const solar=Math.max(0,Math.sin(Math.PI*time));
 const daylight=clamp((solar-.13)/.45,0,1);
 const dusk=clamp((.8-solar)/.8,0,1)*daylight;
 const zenith=color(0x244d7e).lerp(color(0x6b9cc6),daylight);
 const horizon=color(0x49536a).lerp(color(0xd5d3c7),daylight)
   .lerp(color(0xefb98a),dusk*.38);
 const fog=horizon.clone().lerp(color(0xb6c7d2),.4*daylight);
 const sunColor=color(0xfff2d7).lerp(color(0xffc186),dusk*.57);
 const skyFill=color(0x8492b1).lerp(color(0xc5d5e4),daylight);
 const stormMix=storm*.55+steam*.15;
 zenith.lerp(color(0x667282),stormMix);
 horizon.lerp(color(0x9ba3aa),stormMix);
 fog.lerp(color(0x9aa8b1),stormMix);
 sunColor.lerp(color(0xc8d8de),storm*.7);
 skyFill.lerp(color(0x92a6b6),stormMix);
 const intensity=(.55+2.05*daylight)*(1-storm*.35);
 const sunDirection=new THREE.Vector3(-.66,.69+(.5-time)*.06,-.30).normalize();
 return {
  sunDirection,sunColor,skyFill,zenith,horizon,fog,
  sunlight:intensity,ambient:.65+1.05*daylight,daylight,
  sunStrength:daylight*(1-storm*.7),
  stars:1-daylight,clouds:clamp(.16+storm*.44,0,.72),
  fogStrength:clamp(.62+storm*.31+steam*.22,.2,1.15),
  wetness:v.weather==='rain'?clamp(.35+storm*.5,0,1):storm*.25,
  skyLuminance:mix(.38,1,daylight)
 };
}

// Shared sky shader: consistent sky/sun colors for fallback and imported voxel
// worlds, two inexpensive animated cloud bands and a tiny sun disc.
export const CINEMATIC_SKY_VERTEX=`
varying vec3 vDir;
void main(){
 vDir=position;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
export const CINEMATIC_SKY_FRAGMENT=`
uniform vec3 uZenith,uHorizon,uSunColor,uSunDir;
uniform float uTime,uCloudOpacity,uSunStrength,uStars;
varying vec3 vDir;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec3 d=normalize(vDir);
 float above=smoothstep(-.18,.76,d.y);
 vec3 sky=mix(uHorizon,uZenith,above);
 float facing=max(dot(d,normalize(uSunDir)),0.0);
 float glow=pow(facing,15.0)*uSunStrength;
 float disc=smoothstep(.99942,.99983,facing)*uSunStrength;
 sky+=uSunColor*(glow*.16+disc*.95);
 vec2 plane=d.xz/max(.18,d.y+.42);
 float drift=uTime*.00085;
 float broad=sin(plane.x*4.3+drift)*sin(plane.y*3.5-drift*.7);
 float fine=sin(plane.x*9.2-plane.y*2.7+drift*1.2)*.30;
 float cover=smoothstep(.20,.72,broad+fine)*smoothstep(-.08,.22,d.y);
 float edgeLight=pow(facing,3.0)*.24;
 vec3 cloudTint=mix(uHorizon,vec3(1.0,.96,.88),.62);
 sky=mix(sky,cloudTint+uSunColor*edgeLight,cover*uCloudOpacity);
 float star=step(.9989,hash(floor(d.xz*570.0+d.y*123.0)));
 sky+=vec3(.62,.72,.92)*star*uStars*step(.16,d.y);
 gl_FragColor=vec4(max(sky,vec3(0.0)),1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export function createSkyUniforms(sample){
 return {
  uZenith:{value:sample.zenith.clone()},
  uHorizon:{value:sample.horizon.clone()},
  uSunColor:{value:sample.sunColor.clone()},
  uSunDir:{value:sample.sunDirection.clone()},
  uTime:{value:0},
  uCloudOpacity:{value:sample.clouds},
  uSunStrength:{value:sample.sunStrength},
  uStars:{value:sample.stars}
 };
}
export function updateSkyUniforms(uniforms,sample,time,cloudScale=1){
 uniforms.uZenith.value.copy(sample.zenith);
 uniforms.uHorizon.value.copy(sample.horizon);
 uniforms.uSunColor.value.copy(sample.sunColor);
 uniforms.uSunDir.value.copy(sample.sunDirection);
 uniforms.uTime.value=time;
 uniforms.uCloudOpacity.value=sample.clouds*cloudScale;
 uniforms.uSunStrength.value=sample.sunStrength;
 uniforms.uStars.value=sample.stars;
}
