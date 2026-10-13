// Player origin is one metre above their feet; buildings use simplified flat roofs.
export function resolveWorldCollision(colliders, position, previous, velocity) {
  let grounded = false;
  const radius = .52;
  for (const building of colliders) {
    const dx = position.x - building.x, dz = position.z - building.z;
    if (Math.abs(dx) > building.halfW + radius || Math.abs(dz) > building.halfD + radius) continue;
    const feet = position.y - 1, previousFeet = previous.y - 1;
    if (previousFeet >= building.h - .4 && feet <= building.h && velocity.y <= 0) {
      position.y = building.h + 1;
      velocity.y = 0;
      grounded = true;
      continue;
    }
    // A player entirely above a roof must never be pushed sideways by its footprint.
    if (feet >= building.h - .02 || position.y + 1.8 <= 0) continue;
    const overlapX = building.halfW + radius - Math.abs(dx);
    const overlapZ = building.halfD + radius - Math.abs(dz);
    if (overlapX < overlapZ) {
      const sign = Math.sign(dx || previous.x - building.x || 1);
      position.x += sign * overlapX;
      if (velocity.x * sign < 0) velocity.x = 0;
    } else {
      const sign = Math.sign(dz || previous.z - building.z || 1);
      position.z += sign * overlapZ;
      if (velocity.z * sign < 0) velocity.z = 0;
    }
  }
  if (position.y <= 1) {
    position.y = 1;
    if (velocity.y < 0) velocity.y = 0;
    grounded = true;
  }
  if (position.y < 39) {
    for (const axis of ['x', 'z']) {
      if (position[axis] > 181) { position[axis] = 181; velocity[axis] = Math.min(0, velocity[axis]); }
      else if (position[axis] < -181) { position[axis] = -181; velocity[axis] = Math.max(0, velocity[axis]); }
    }
  }
  return grounded;
}
