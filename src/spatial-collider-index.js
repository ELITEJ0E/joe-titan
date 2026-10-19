// Static two-dimensional broadphase for collision footprints. The city uses
// hundreds of Box2 footprints but only a few can touch a pilot/Titan per step.
// Rebuild only when structures are destroyed/restored, never every physics tick.
export function createSpatialColliderIndex(colliders=[],cellSize=24){
  if(!Number.isFinite(cellSize)||cellSize<=0)throw Error('Cell size must be positive');
  const cells=new Map(),key=(x,z)=>x+','+z;
  let indexed=0;
  function rebuild(items=colliders){
    cells.clear();indexed=0;
    for(const box of items){
      if(!box||![box.x,box.z,box.halfW,box.halfD].every(Number.isFinite))continue;
      const minX=Math.floor((box.x-box.halfW)/cellSize),maxX=Math.floor((box.x+box.halfW)/cellSize);
      const minZ=Math.floor((box.z-box.halfD)/cellSize),maxZ=Math.floor((box.z+box.halfD)/cellSize);
      for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
        const k=key(x,z);
        if(!cells.has(k))cells.set(k,[]);
        cells.get(k).push(box);
      }
      indexed++;
    }
  }
  function query(x,z,radius=0){
    if(!Number.isFinite(x)||!Number.isFinite(z))return [];
    const r=Math.max(0,Number.isFinite(radius)?radius:0),
      minX=Math.floor((x-r)/cellSize),maxX=Math.floor((x+r)/cellSize),
      minZ=Math.floor((z-r)/cellSize),maxZ=Math.floor((z+r)/cellSize);
    const result=[],seen=new Set();
    for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++){
      const group=cells.get(key(ix,iz));
      if(!group)continue;
      for(const box of group){
        if(seen.has(box))continue;
        seen.add(box);
        if(Math.abs(x-box.x)>box.halfW+r||Math.abs(z-box.z)>box.halfD+r)continue;
        result.push(box);
      }
    }
    return result;
  }
  rebuild();
  return {query,rebuild,get count(){return indexed},get cellCount(){return cells.size}};
}
