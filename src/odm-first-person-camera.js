import * as THREE from 'three';

// Stabilized first-person ODM camera. The pilot's physical position is used as
// the camera pivot: velocity, cable tension, body bank and hit reactions never
// alter the reticle's viewing direction. Camera motion is NOT part of physics.
export const FIRST_PERSON_CAMERA=Object.freeze({
  eyeHeight:1.3,baseFov:72,speedFovStart:18,
  speedFovGain:.12,maxSpeedFov:8,boostFov:1.5,fovResponse:5
});
const lookTarget=new THREE.Vector3();

export function firstPersonTargetFov(speed=0,boosting=false){
  const s=Number.isFinite(speed)?Math.max(0,speed):0;
  return FIRST_PERSON_CAMERA.baseFov+
    Math.min(FIRST_PERSON_CAMERA.maxSpeedFov,
      Math.max(0,s-FIRST_PERSON_CAMERA.speedFovStart)*FIRST_PERSON_CAMERA.speedFovGain)+
    (boosting?FIRST_PERSON_CAMERA.boostFov:0);
}

export function updateStableFirstPersonCamera(camera,position,direction,dt,{
  snap=false,speed=0,boosting=false
}={}){
  if(!camera||!position?.isVector3||!direction?.isVector3||
     !Number.isFinite(dt)||dt<0||direction.lengthSq()<1e-12)return false;

  // Do not smooth POSITION toward a separately smoothed aim point. At ODM
  // speeds that lag makes the apparent crosshair drift while swing forces act.
  camera.position.copy(position);
  camera.position.y=Math.max(.35,camera.position.y+FIRST_PERSON_CAMERA.eyeHeight);

  // World-up ensures the horizon is level, irrespective of the animated
  // character banking or spinning. Mouse/keyboard yaw and pitch remain exact.
  camera.up.set(0,1,0);
  lookTarget.copy(camera.position).add(direction);
  camera.lookAt(lookTarget);

  // Limit breathing/zoom during rapid gas bursts. This changes view angle
  // only, not target picking; the center ray matches direction every frame.
  const targetFov=firstPersonTargetFov(speed,boosting);
  const alpha=snap?1:1-Math.exp(-dt*FIRST_PERSON_CAMERA.fovResponse);
  const nextFov=camera.fov+(targetFov-camera.fov)*alpha;
  if(Math.abs(nextFov-camera.fov)>.002){
    camera.fov=nextFov;camera.updateProjectionMatrix();
  }
  return true;
}
