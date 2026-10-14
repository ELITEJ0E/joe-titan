import * as THREE from 'three';

// Purely visual IK-style anchor aiming. The arm's natural local down axis is
// rotated toward the world-space hook attachment point. Root yaw, bank, torso
// lean and even spin are handled by the inverse world rotation of its parent.
// Nothing here changes player velocity, cable length, or targeting.
const down=new THREE.Vector3(0,-1,0),target=new THREE.Vector3(),armPos=new THREE.Vector3();
const worldRotation=new THREE.Quaternion(),desired=new THREE.Quaternion();
export function aimODMArm(arm,anchor,dt,{response=12}={}){
 if(!arm?.parent||!anchor||!Number.isFinite(dt)||dt<=0)return false;
 arm.parent.updateWorldMatrix(true,false);
 arm.getWorldPosition(armPos);
 target.copy(anchor).sub(armPos);
 if(target.lengthSq()<1e-8)return false;
 arm.parent.getWorldQuaternion(worldRotation);
 target.normalize().applyQuaternion(worldRotation.invert());
 desired.setFromUnitVectors(down,target);
 arm.quaternion.slerp(desired,Math.min(1,1-Math.exp(-response*dt)));
 return true;
}
