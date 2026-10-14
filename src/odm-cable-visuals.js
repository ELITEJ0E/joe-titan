// A purely visual 20-segment ODM cable. The actual tether in odm-physics.js
// remains a zero-thickness, tension-only distance constraint.
export const ODM_CABLE_SEGMENTS=20;
export function writeODMCableCurve(out,start,end,{length=null,speed=0,time=0,side=1}={}){
  if(!out||out.length!==(ODM_CABLE_SEGMENTS+1)*3)throw Error('Invalid ODM cable buffer');
  const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z;
  const dist=Math.hypot(dx,dy,dz);
  const extra=Number.isFinite(length)?Math.max(0,length-dist):0;
  const slack=Math.min(3,extra*.22);
  const sag=Math.min(2.2,Math.max(.025,dist*.008)+slack);
  const lateralX=dist>1e-6?-dz/dist:0;
  const lateralZ=dist>1e-6?dx/dist:0;
  const flutter=Math.min(.14,.015+speed*.0015);
  for(let i=0;i<=ODM_CABLE_SEGMENTS;i++){
    const f=i/ODM_CABLE_SEGMENTS;
    const bow=Math.sin(Math.PI*f);
    const wiggle=bow*Math.sin(f*13+time*11+side*1.7)*flutter;
    const offset=i*3;
    out[offset]=start.x+dx*f+lateralX*wiggle;
    out[offset+1]=start.y+dy*f-bow*sag;
    out[offset+2]=start.z+dz*f+lateralZ*wiggle;
  }
  return out;
}
