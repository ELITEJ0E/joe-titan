// Precomputed voxel lighting for the imported Shiganshina greedy mesh.
// One inexpensive sun visibility query per visible quad + 4 local corner AO
// probes. No new geometry, runtime shadow pass or collision modifications.
export const SHIGANSHINA_SUN=Object.freeze({x:-0.66,y:0.69,z:-0.30});
const DIRECTIONS=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
const opaque=(id)=>id!==0&&id!==17&&id!==19;
export function blockAt(asset,x,y,z){
 const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z);
 if(a<0||b<0||c<0||a>=asset.nx||b>=asset.ny||c>=asset.nz)return 0;
 return asset.voxel[(a*asset.ny+b)*asset.nz+c];
}
export function sunVisibility(asset,faceCenter,side,maximum=95){
 const normal=DIRECTIONS[side];
 const slope=normal[0]*SHIGANSHINA_SUN.x+normal[1]*SHIGANSHINA_SUN.y+normal[2]*SHIGANSHINA_SUN.z;
 if(slope<=.06)return 1;
 const px=faceCenter[0]+normal[0]*.12,py=faceCenter[1]+normal[1]*.12,pz=faceCenter[2]+normal[2]*.12;
 const length=Math.hypot(SHIGANSHINA_SUN.x,SHIGANSHINA_SUN.y,SHIGANSHINA_SUN.z);
 const dx=SHIGANSHINA_SUN.x/length,dy=SHIGANSHINA_SUN.y/length,dz=SHIGANSHINA_SUN.z/length;
 for(let t=.7;t<maximum;t+=1.1){
   const id=blockAt(asset,px+dx*t,py+dy*t,pz+dz*t);
   if(id===18)return .62; // leaves filter light rather than blacking it out
   if(opaque(id))return .28;
   if(py+dy*t>=asset.ny)break;
 }
 return 1;
}
export function cornerOcclusion(asset,vertex,side,corner){
 const n=DIRECTIONS[side],axis=side>>1;
 const t1=axis===0?[0,0,1]:[1,0,0];
 const t2=axis===1?[0,0,1]:[0,1,0];
 const s1=corner===1||corner===2?1:-1;
 const s2=corner===2||corner===3?1:-1;
 const px=vertex[0]+n[0]*.28,py=vertex[1]+n[1]*.28,pz=vertex[2]+n[2]*.28;
 const sample=(a,b)=>opaque(blockAt(asset,
   px+(t1[0]*a*s1+t2[0]*b*s2)*.32,
   py+(t1[1]*a*s1+t2[1]*b*s2)*.32,
   pz+(t1[2]*a*s1+t2[2]*b*s2)*.32));
 const first=sample(1,0),second=sample(0,1),diagonal=sample(1,1);
 return first&&second ? .52 : 1-(Number(first)+Number(second)+Number(diagonal))*.115;
}
