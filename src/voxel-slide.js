// Continuous horizontal slide against a binary Minecraft voxel occupancy.
// The player is a ~0.68m-wide capsule approximation whose origin is 1m
// above the feet. Substeps prevent an ODM pilot tunneling through thin walls.
export function slideVoxelHorizontal(position,previous,velocity,solid,{
  radius=.3,maxStep=.3
}={}){
  const dx=position.x-previous.x,dz=position.z-previous.z;
  const dy=position.y-previous.y;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz),Math.abs(dy))/maxStep));
  let x=previous.x,z=previous.z,blockedX=false,blockedZ=false;
  const probe=(px,py,pz)=>{
    for(const yOffset of [-.95,-.05,.77]){
      for(const ox of [-radius,radius]){
        for(const oz of [-radius,radius]){
          if(solid(px+ox,py+yOffset,pz+oz))return true;
        }
      }
    }
    return false;
  };
  for(let i=1;i<=steps;i++){
    const y=previous.y+dy*i/steps;
    if(!blockedX){
      const proposed=x+dx/steps;
      if(probe(proposed,y,z)){blockedX=true;velocity.x*=-.05;}
      else x=proposed;
    }
    if(!blockedZ){
      const proposed=z+dz/steps;
      if(probe(x,y,proposed)){blockedZ=true;velocity.z*=-.05;}
      else z=proposed;
    }
  }
  position.x=x;position.z=z;
  return {blockedX,blockedZ};
}
