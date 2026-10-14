// Source-measured TitanCraft-inspired ODM motor. Hook selection stays exactly
// crosshair-based; these values affect motion after attachment only.
export const ODM_TUNING=Object.freeze({
  gravity:26,run:8.5,sprint:11.5,groundResponse:16,
  airControl:9,hookAirControl:15,maxSpeed:85,minCable:2.8,
  autoReel:3,fastReel:26,autoPull:2.5,fastPull:38,
  swingPump:7,dragBase:.015,dragSpeed:.0011,
  boost:36,boostVerticalGravity:.35,brakeVertical:110,brakeHorizontal:2.4,
  gasFire:.25,gasBoost:7,gasReel:3.5,gasHang:.35,gasBrake:2.5
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function applyODMMotor(position,velocity,hooks,dt,{reeling=false,gas=100,reelMultiplier=1,forwardPump=false}={}){
  if(!Number.isFinite(dt)||dt<=0)return 0;
  const active=hooks.filter(h=>h&&h.point&&Number.isFinite(h.length)&&h.length>0);
  if(!active.length)return 0;
  const reelK=reeling?clamp(reelMultiplier,0,1):0;
  for(const hook of active){
    const toward=hook.point.clone().sub(position);
    const dist=toward.length();
    if(dist<1e-6)continue;
    toward.multiplyScalar(1/dist);
    if(gas>0){
      const reel=ODM_TUNING.autoReel+(ODM_TUNING.fastReel-ODM_TUNING.autoReel)*reelK;
      // Never pull a cable beyond the triangle-inequality limit of its peer.
      const other=active.find(h=>h!==hook);
      const minimum=other?Math.max(ODM_TUNING.minCable,hook.point.distanceTo(other.point)-other.length+.001):ODM_TUNING.minCable;
      hook.length=Math.max(minimum,Math.min(hook.length,dist)-reel*dt);
      velocity.addScaledVector(toward,(ODM_TUNING.autoPull+(ODM_TUNING.fastPull-ODM_TUNING.autoPull)*reelK)*dt);
    }
    if(forwardPump){
      const radial=velocity.dot(toward);
      const tangent=velocity.clone().addScaledVector(toward,-radial);
      const magnitude=tangent.length();
      if(magnitude>2)velocity.addScaledVector(tangent,ODM_TUNING.swingPump*dt/magnitude);
    }
  }
  // GAS.reel and GAS.hang are per-second costs, not per-hook charges.
  return gas>0?Math.min(gas,(reelK>0?ODM_TUNING.gasReel:ODM_TUNING.gasHang)*dt):0;
}
export function applyReferenceAirDrag(velocity,dt){
  const speed=velocity.length();
  velocity.multiplyScalar(1-Math.min(.5,(ODM_TUNING.dragBase+speed*ODM_TUNING.dragSpeed)*dt));
}
