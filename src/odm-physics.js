// Position-based unilateral rope constraints for ODM movement.
// Each cable limits maximum distance but never pushes the pilot away.
// Alternating solve order avoids consistently favoring one hook.
export function solveTetherConstraints(position, velocity, hooks, iterations=8) {
  const active=hooks.filter(h=>h&&h.length>0&&Number.isFinite(h.length));
  if(!active.length)return;
  const epsilon=0.0001;
  for(let pass=0;pass<iterations;pass++){
    const order=pass%2===0?active:[...active].reverse();
    for(const hook of order){
      const away=position.clone().sub(hook.point);
      const distance=away.length();
      if(distance<=hook.length+epsilon||distance<epsilon)continue;
      const normal=away.multiplyScalar(1/distance);
      position.addScaledVector(normal,hook.length-distance);
    }
  }
  // Remove only the velocity component that would stretch a taut cable.
  // Retain tangential velocity, which is essential for carrying swing momentum.
  for(let pass=0;pass<3;pass++){
    const order=pass%2===0?active:[...active].reverse();
    for(const hook of order){
      const away=position.clone().sub(hook.point),dist=away.length();
      if(dist<epsilon||dist<hook.length-0.015)continue;
      const outward=velocity.dot(away)/dist;
      if(outward>0)velocity.addScaledVector(away,-outward/dist);
    }
  }
}

// On the ground a tethered pilot steers with acceleration, not a walking
// velocity override. A normal running controller is still used without hooks.
export function groundVelocityBlend(velocity,goal,dt,hasTether) {
  if(hasTether)return;
  const blend=1-Math.exp(-dt*11);
  velocity.x+=(goal.x-velocity.x)*blend;
  velocity.z+=(goal.z-velocity.z)*blend;
}
