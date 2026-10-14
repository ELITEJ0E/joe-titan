import * as THREE from 'three';

// Camera-centered aiming is authoritative. Left/right offsets are attempted
// only if both cables would otherwise attach to the same spot.
const RIGHT=new THREE.Vector3();
function valid(point,pilot,maxDistance,other){
  if(!point||!point.isVector3||!point.toArray().every(Number.isFinite))return false;
  const d=point.distanceTo(pilot);
  return d>=6&&d<=maxDistance&&(other==null||point.distanceTo(other)>=2.5);
}
export function chooseGrappleTarget(world,cameraOrigin,pilot,direction,side,other=null,maxDistance=128){
  if(!world?.grappleRay)return null;
  const dir=direction.clone().normalize();
  const primary=world.grappleRay(cameraOrigin,dir,maxDistance);
  if(valid(primary,pilot,maxDistance,other))return primary.clone();
  RIGHT.set(-dir.z,0,dir.x);
  if(RIGHT.lengthSq()<.001)RIGHT.set(1,0,0);
  RIGHT.normalize();
  // If the second cable is already at the central hit, search to that side.
  const displaced=cameraOrigin.clone().addScaledVector(RIGHT,side*.45);
  const spread=dir.clone().addScaledVector(RIGHT,side*.085).normalize();
  const secondary=world.grappleRay(displaced,spread,maxDistance);
  if(valid(secondary,pilot,maxDistance,other))return secondary.clone();
  // Assist is only for open sky or a blocked second cable; never replace a
  // perfectly valid directly aimed surface merely to prefer a rooftop.
  const assisted=world.bestAnchor?.(pilot,dir,side);
  if(!valid(assisted,pilot,maxDistance,other))return null;
  const delta=assisted.clone().sub(cameraOrigin),distance=delta.length();
  if(distance<1||delta.dot(dir)/distance<.53)return null;
  // Don't allow assisted aiming through a closer facade.
  const obstruction=world.grappleRay(cameraOrigin,delta.multiplyScalar(1/distance),distance+.3);
  if(obstruction&&valid(obstruction,pilot,maxDistance,other)&&obstruction.distanceTo(cameraOrigin)<distance-1.1)
    return obstruction.clone();
  return assisted.clone();
}
