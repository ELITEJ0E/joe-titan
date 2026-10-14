import * as THREE from 'three';

// The gas jet follows the pilot's LOOK direction (not the grapple anchor).
// Movement keys bend it gently, but cannot overwhelm the optical axis.
export function gasThrustDirection(aim,wish){
  const direction=aim.clone().normalize();
  if(direction.lengthSq()<1e-9)return new THREE.Vector3(0,0,-1);
  if(wish?.lengthSq()>1e-8){
    const lateral=wish.clone().addScaledVector(direction,-wish.dot(direction));
    if(lateral.lengthSq()>1e-8)direction.addScaledVector(lateral.normalize(),.18);
  }
  return direction.normalize();
}

// When a jet pushes away from a taut rope, let the cable pay out while gas
// is firing. Otherwise the hard rope constraint removes that acceleration,
// making propulsion feel like reeling toward the building.
export function allowBoostCablePayout(position,velocity,hooks,dt,{
  boosting=false,gas=0,maxPayoutSpeed=24,maxLength=128
}={}){
  if(!boosting||gas<=0||dt<=0)return 0;
  let paid=0;
  for(const hook of hooks){
    if(!hook?.point||!Number.isFinite(hook.length))continue;
    const away=position.clone().sub(hook.point);
    const dist=away.length();
    if(dist<1e-6||dist<hook.length-.35)continue;
    const outward=velocity.dot(away)/dist;
    if(outward<=0)continue;
    const addition=Math.min(outward,maxPayoutSpeed)*dt;
    const next=Math.min(maxLength,hook.length+addition);
    paid+=Math.max(0,next-hook.length);
    hook.length=next;
  }
  return paid;
}
