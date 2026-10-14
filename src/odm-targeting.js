import * as THREE from 'three';

// ODM reticle targeting: only an actual hit along the camera's center ray is
// allowed. Never choose a "better" rooftop, nearby anchor, or offset ray.
// Both left and right cables can attach to the same aimed surface, independently.
export function chooseGrappleTarget(world,cameraOrigin,pilot,direction,_side=0,_other=null,maxDistance=128){
  if(typeof world?.grappleRay!=='function')return null;
  if(!direction?.isVector3||direction.lengthSq()<1e-12)return null;
  const ray=direction.clone().normalize();
  const hit=world.grappleRay(cameraOrigin,ray,maxDistance);
  if(!hit?.isVector3||![hit.x,hit.y,hit.z].every(Number.isFinite))return null;
  // Keep cables off the body itself but permit wall/roof hits up close.
  const pilotDistance=hit.distanceTo(pilot);
  if(pilotDistance<2.5||pilotDistance>maxDistance)return null;
  const projection=hit.clone().sub(cameraOrigin).dot(ray);
  // The ray intersection must be in front of the reticle, not behind/sideways.
  if(projection<0.1||projection>maxDistance+.01)return null;
  if(hit.distanceToSquared(cameraOrigin.clone().addScaledVector(ray,projection))>0.04)return null;
  return hit.clone();
}
