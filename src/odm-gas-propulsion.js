import * as THREE from 'three';

// REA flight hypothesis: the gas jet follows the camera optical axis exactly.
// WASD steering belongs to air control, never to the boost force vector.
export function gasThrustDirection(aim){
  if(!aim||!Number.isFinite(aim.x)||!Number.isFinite(aim.y)||!Number.isFinite(aim.z)||aim.lengthSq()<1e-12)
    return new THREE.Vector3(0,0,-1);
  return aim.clone().normalize();
}

// Explicit separate gas force: thrust 36 u/s² along camera look plus the
// source-reported fixed vertical 0.35*gravity. Does not touch rope anchors.
export function applyGazeGasBoost(velocity,aim,dt,{acceleration=36,gravity=26,liftFactor=.35,multiplier=1}={}){
  if(!Number.isFinite(dt)||dt<=0)return;
  velocity.addScaledVector(gasThrustDirection(aim),acceleration*multiplier*dt);
  velocity.y+=gravity*liftFactor*dt;
}

// An optional accommodation from the earlier arcade variant, retained as an
// exported helper for diagnostic comparisons. Reference-mode flight does NOT
// invoke this: ropes must constrain outward motion instead of paying out.
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


// Input-directed Titan Siege style gas jet. A forward/strafe input controls
// the thrust vector; looking up/down contributes pitch when moving forward.
// At neutral input, the camera heading receives a small vertical bias.
// The jet ACCELERATES the pilot; it never sets position or resets momentum.
export function directionalGasThrust(yaw,pitch,moveX=0,moveY=0){
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);
  const cp=Math.cos(pitch),sp=Math.sin(pitch);
  let bx,by,bz;
  if(moveX||moveY){
    bx=fx*cp*moveY+rx*moveX;
    by=sp*moveY+.28;
    bz=fz*cp*moveY+rz*moveX;
  }else{
    bx=fx*cp;
    by=sp+.2;
    bz=fz*cp;
  }
  const jet=new THREE.Vector3(bx,by,bz);
  return jet.lengthSq()>1e-12?jet.normalize():new THREE.Vector3(0,1,0);
}

export function applyDirectionalGasBoost(velocity,yaw,pitch,moveX,moveY,dt,{
  acceleration=36,gravity=26,liftFactor=.35,multiplier=1
}={}){
  if(!Number.isFinite(dt)||dt<=0)return;
  velocity.addScaledVector(directionalGasThrust(yaw,pitch,moveX,moveY),acceleration*multiplier*dt);
  velocity.y+=gravity*liftFactor*dt;
  // Airborne jet braking while falling rapidly. An additional directional
  // impulse remains independent of this capped descent assist.
  if(velocity.y< -6)velocity.y+=Math.min(-velocity.y-6,50*dt);
}
