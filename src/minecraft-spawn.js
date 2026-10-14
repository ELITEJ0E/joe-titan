// Select an actual outdoor street spawn in a converted Minecraft region.
// The player's origin is one metre above the feet; Minecraft voxel coordinates
// are the lower corner of each block, not its top.
const PASSABLE=new Set([0,17,19]);
const ROAD=new Set([14,15,16]);
const isSolid=id=>!PASSABLE.has(id);
export function findSafeMinecraftSpawn(asset,origin,preferred={x:-30,z:29},radius=85){
  const {nx,ny,nz,voxel}=asset;
  const at=(x,y,z)=>voxel[(x*ny+y)*nz+z];
  const px=Math.floor(preferred.x-origin.x),pz=Math.floor(preferred.z-origin.z);
  let best=null,bestScore=Infinity;
  const minX=Math.max(3,px-radius),maxX=Math.min(nx-4,px+radius);
  const minZ=Math.max(3,pz-radius),maxZ=Math.min(nz-4,pz+radius);
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
    const wx=origin.x+x+.5,wz=origin.z+z+.5;
    const distance=Math.hypot(wx-preferred.x,wz-preferred.z);
    if(distance>radius)continue;
    // The highest solid voxel must be a street / courtyard surface rather
    // than a room floor hidden underneath a ceiling or an elevated rooftop.
    let support=-1;
    for(let y=ny-1;y>=0;y--)if(isSolid(at(x,y,z))){support=y;break;}
    if(support<0||support+7>=ny)continue;
    const groundTop=origin.y+support+1;
    if(groundTop<1||groundTop>13)continue;
    // Entire central sky column above the surface must be open.
    let sky=true;
    for(let y=support+1;y<ny;y++)if(isSolid(at(x,y,z))){sky=false;break;}
    if(!sky)continue;
    // A 5x5 footprint around the pilot, with clearance for the head and a
    // small movement margin, prevents spawning inside narrow doorways.
    let clear=true;
    for(let dx=-2;dx<=2&&clear;dx++)
      for(let dz=-2;dz<=2&&clear;dz++)
        for(let dy=1;dy<=4;dy++)
          if(isSolid(at(x+dx,support+dy,z+dz))){clear=false;break;}
    if(!clear)continue;
    // Prefer authentic cobblestone/path blocks over arbitrary roof slabs.
    const type=at(x,support,z);
    const score=distance+(ROAD.has(type)?0:10)+Math.max(0,groundTop-4)*1.4;
    if(score<bestScore){bestScore=score;best={x:wx,y:groundTop+1,z:wz};}
  }
  return best;
}
