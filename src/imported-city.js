import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Daniel Vicente's "Medieval Modular City Realistic - WIP" (CC BY 4.0).
// Asterfell remains playable if these optional local assets are absent.
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
async function readCollision(){
  const res=await fetch('/models/city-collision.json');
  if(!res.ok)throw Error('Missing city-collision.json ('+res.status+')');
  const meta=await res.json();
  if(meta.encoding!=='uint16le-zlib-base64'||typeof DecompressionStream==='undefined')throw Error('Unsupported collision format');
  const binary=Uint8Array.from(atob(meta.data),c=>c.charCodeAt(0));
  const decoded=await new Response(new Blob([binary]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
  if(decoded.byteLength!==meta.size*meta.size*2)throw Error('Corrupted city collision grid');
  const cells=new Uint16Array(decoded);
  const height=(x,z)=>{const ix=Math.floor((x+meta.half)/meta.cell),iz=Math.floor((z+meta.half)/meta.cell);
    return ix<0||iz<0||ix>=meta.size||iz>=meta.size?0:cells[iz*meta.size+ix]/meta.heightUnits;};
  return {meta,height};
}
const loadCity=()=>new Promise((resolve,reject)=>new GLTFLoader().load('/models/medieval-city.glb',resolve,undefined,reject));
function chooseSpawn(height){
  for(let radius=0;radius<140;radius+=6)for(let a=0;a<Math.PI*2;a+=Math.PI/10){
    const x=8+Math.cos(a)*radius,z=-10+Math.sin(a)*radius,h=height(x,z);
    if(Math.abs(x)>165||Math.abs(z)>165||h>1.4)continue;
    if([[2,0],[-2,0],[0,2],[0,-2]].every(([dx,dz])=>height(x+dx,z+dz)<h+2.5))return V(x,Math.max(1,h+1),z);
  }
  return V(8,height(8,-10)+1,-10);
}
export async function installMedievalCity(scene,world,oldObjects,{onReady=()=>{},onError=()=>{}}={}){
  try{
    const [{meta,height},{scene:city}]=await Promise.all([readCollision(),loadCity()]);
    if(!city)throw Error('GLB has no scene');
    const bounds=new THREE.Box3().setFromObject(city),size=bounds.getSize(new THREE.Vector3());
    if(!size.x||!size.y||!size.z)throw Error('GLB has invalid dimensions');
    city.scale.setScalar(meta.scale);
    city.position.set(-meta.centerXZ[0]*meta.scale,0,-meta.centerXZ[1]*meta.scale);
    city.updateMatrixWorld(true);
    let meshCount=0;
    const raycastables=[];
    city.traverse(obj=>{if(obj.isMesh){
      meshCount++;obj.receiveShadow=true;obj.castShadow=false;obj.frustumCulled=true;
      if(obj.geometry?.attributes?.position)raycastables.push(obj);
    }});
    if(!meshCount)throw Error('GLB contains no meshes');
    const anchors=[];
    for(let iz=4;iz<meta.size-4;iz+=3)for(let ix=4;ix<meta.size-4;ix+=3){
      const x=ix*meta.cell-meta.half+meta.cell*.5,z=iz*meta.cell-meta.half+meta.cell*.5,h=height(x,z);
      if(h>4&&h<70)anchors.push(V(x,h+.6,z));
    }
    if(anchors.length<10)throw Error('Insufficient city grapple anchors');
    const spawn=chooseSpawn(height);
    // Accurate surface raycasts on the GLB, with cheap world-space bounding-box
    // rejection before asking Three.js to test mesh triangles. Build once.
    const spatialMeshes=raycastables.map(mesh=>({mesh,box:new THREE.Box3().setFromObject(mesh)}));
    const raycaster=new THREE.Raycaster();
    const boxRay=new THREE.Ray();
    const grappleRay=(origin,direction,maxDist=125)=>{
      const dir=direction.clone().normalize();
      raycaster.set(origin,dir);raycaster.near=0.2;raycaster.far=maxDist;
      boxRay.set(origin,dir);
      let closest=null,nearest=maxDist;
      for(const candidate of spatialMeshes){
        if(!boxRay.intersectsBox(candidate.box))continue;
        const intersections=raycaster.intersectObject(candidate.mesh,false);
        if(intersections.length&&intersections[0].distance<nearest){
          nearest=intersections[0].distance;closest=intersections[0].point.clone();
        }
      }
      return closest;
    };
    const bestAnchor=(position,direction,side)=>{
      const dir=direction.clone().normalize(),right=V(-dir.z,0,dir.x).normalize();
      let best=null,bestScore=-Infinity;
      for(const anchor of anchors){
        const delta=anchor.clone().sub(position),dist=delta.length();
        if(dist<8||dist>118)continue;
        const align=delta.dot(dir)/dist;if(align<.35)continue;
        const score=align*2.5-Math.abs(dist-45)*.013+clamp(delta.dot(right)*side/75,-.4,.42)+(anchor.y>position.y?.11:0);
        if(score>bestScore){bestScore=score;best=anchor;}
      }
      return best?.clone()??null;
    };
    const resolveCollision=(position,previous,velocity)=>{
      let h=height(position.x,position.z),feet=position.y-1,oldFeet=previous.y-1,grounded=false;
      if(h>1.7&&feet<h-.08&&oldFeet<h-.5){
        if(height(position.x,previous.z)>oldFeet+.6){position.x=previous.x;velocity.x=0;}
        if(height(previous.x,position.z)>oldFeet+.6){position.z=previous.z;velocity.z=0;}
      }
      h=height(position.x,position.z);
      if(velocity.y<=0&&oldFeet>=h-.45&&position.y<=h+1){position.y=h+1;velocity.y=0;grounded=true;}
      if(position.y<=1){position.y=1;if(velocity.y<0)velocity.y=0;grounded=true;}
      for(const axis of ['x','z']){
        if(position[axis]>179){position[axis]=179;velocity[axis]=Math.min(0,velocity[axis]);}
        if(position[axis]<-179){position[axis]=-179;velocity[axis]=Math.max(0,velocity[axis]);}
      }
      return grounded;
    };
    const beacons=new Set(world.beacons.map(b=>b.group));
    for(const obj of oldObjects)if(!beacons.has(obj)&&!obj.isLight&&!obj.material?.isShaderMaterial)scene.remove(obj);
    world.grappleRay=grappleRay;world.bestAnchor=bestAnchor;world.resolveCollision=resolveCollision;
    world.spawnPoint=spawn;world.terrainHeight=height;world.anchors=anchors;world.colliders=[];world.districtRoads=[];
    world.grappleMeshes.length=0;world.smoke.length=0;world.lamps.length=0;world.importedCity=city;
    world.landmarks={...world.landmarks,canalZ:-10000};
    for(const b of world.beacons){b.point.y=height(b.point.x,b.point.z)+10;b.group.position.copy(b.point);}
    scene.add(city);onReady({meshes:meshCount,anchors:anchors.length,spawn});
    return true;
  }catch(error){console.warn('[JOE TITAN] City asset unavailable; retained original map.',error);onError(error);return false;}
}
