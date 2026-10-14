// Client-side representation smoothing; does not change collision or hit
// authority. 120ms prediction cap prevents excessive extrapolation during loss.
export const MAX_EXTRAPOLATION=.12;
export function remoteTarget(state,ageSeconds=0){
 const elapsed=Math.max(0,Math.min(MAX_EXTRAPOLATION,ageSeconds));
 const p=state.physics?.p;
 const v=state.physics?.v;
 const position=Array.isArray(p)?p:[state.x,state.y,state.z];
 if(!Array.isArray(v)||v.length!==3)return position;
 return [0,1,2].map(i=>position[i]+v[i]*elapsed);
}
export function smoothFactor(dt,response=12){
 return 1-Math.exp(-Math.max(0,Math.min(dt,.12))*response);
}
