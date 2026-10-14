// Flight animation targets are derived from actual velocity and cable pulls;
// these affect visuals only, never physics or camera aim.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function pilotPoseTargets({velocity,position,forward,right,hooks=[],grounded=false,boost=false,steer=0}){
  const speed=velocity.length();
  const fast=clamp((speed-5)/36,0,1);
  const attached=hooks.filter(Boolean);
  if(grounded&&!attached.length)return {pitch:0,bank:0};
  const sideSpeed=velocity.dot(right)/Math.max(15,speed);
  let hookSide=0;
  for(const hook of attached){
    const to=hook.point.clone().sub(position);
    if(to.lengthSq()>1e-6)hookSide+=to.normalize().dot(right);
  }
  if(attached.length)hookSide/=attached.length;
  // Positive rightward motion, or a hook to the right, leans the head right
  // (negative local Z roll) as the character cuts through the air.
  const bank=clamp(-sideSpeed*.54-hookSide*.22*fast-steer*.10,-.66,.66);
  const pitch=clamp(
    -.11-(attached.length?.19:0)-fast*.43-(boost?.08:0)
      +clamp(velocity.y/95,-.13,.11),
    -.79,.06
  );
  return {pitch,bank};
}
