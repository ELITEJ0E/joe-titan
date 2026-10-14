// Arcade-physical ODM winch. Hook impacts are precise; only subsequent force
// integration is assisted. These forces never alter the chosen anchor point.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const ODM_TUNING=Object.freeze({
  autoReel:6.5,fastReel:25,minimumCable:5.8,
  pullAcceleration:74,radialResponse:3.0,
  baseInwardSpeed:14,distanceSpeedGain:.23,maxInwardSpeed:36,
  autoGasRate:.7,fastGasRate:2.4,
});
export function applyODMMotor(position,velocity,hooks,dt,{reeling=false,gas=100,reelMultiplier=1}={}){
  if(!Number.isFinite(dt)||dt<=0)return 0;
  const active=hooks.filter(h=>h&&h.point&&Number.isFinite(h.length)&&h.length>0);
  if(!active.length||gas<=0)return 0;
  // Hooks sharing the same aimed point are valid. The force is divided across
  // live cables to avoid multiplying acceleration simply by holding Q+E.
  const divisor=Math.sqrt(active.length);
  let consumed=0;
  for(const hook of active){
    const to=hook.point.clone().sub(position),distance=to.length();
    if(distance<.1||!Number.isFinite(distance))continue;
    const direction=to.multiplyScalar(1/distance);
    const other=active.find(candidate=>candidate!==hook);
    const minimum=other?Math.max(ODM_TUNING.minimumCable,
      hook.point.distanceTo(other.point)-other.length+.35):ODM_TUNING.minimumCable;
    const reelSpeed=(reeling?ODM_TUNING.fastReel:ODM_TUNING.autoReel)*reelMultiplier;
    const nextLength=Math.max(minimum,hook.length-reelSpeed*dt);
    const reeled=Math.max(0,hook.length-nextLength);
    hook.length=nextLength;
    const radialSpeed=velocity.dot(direction);
    const target=clamp(
      ODM_TUNING.baseInwardSpeed+distance*ODM_TUNING.distanceSpeedGain+(reeling?8:0),
      0,ODM_TUNING.maxInwardSpeed);
    // A servo force responds immediately when an anchor attaches but doesn't
    // erase velocity if the player is already traveling toward the anchor fast.
    const acceleration=clamp((target-radialSpeed)*ODM_TUNING.radialResponse,
      0,ODM_TUNING.pullAcceleration)/divisor;
    velocity.addScaledVector(direction,acceleration*dt);
    consumed+=dt*(reeling?ODM_TUNING.fastGasRate:ODM_TUNING.autoGasRate)
      *(reeled>.001||acceleration>1?1:.2)/active.length;
  }
  return Math.min(gas,consumed);
}
