// Mobile input is deliberately separate from precise PC ODM controls.
export const MOBILE_ASSIST=Object.freeze({
  lookYawPerPixel:.0042,lookPitchPerPixel:.0031,
  autoBoostStrength:.82,autoBoostGasCost:.60,
  takeoffSpeed:6.5
});
export function lookDragDelta(deltaX,deltaY){
  const dx=Number.isFinite(deltaX)?Math.max(-110,Math.min(110,deltaX)):0;
  const dy=Number.isFinite(deltaY)?Math.max(-110,Math.min(110,deltaY)):0;
  return {yaw:dx===0?0:-dx*MOBILE_ASSIST.lookYawPerPixel,
    pitch:dy===0?0:-dy*MOBILE_ASSIST.lookPitchPerPixel};
}
export function mobileHookAssistance({mobileAssist=false,activeHooks=0,
  grounded=false,gas=0,manualBoost=false}={}){
  const assisted=!!mobileAssist&&activeHooks>0&&gas>0;
  return {
    reel:assisted,
    takeoff:assisted&&grounded,
    boost:manualBoost||assisted,
    boostedAutomatically:assisted&&!manualBoost,
    boostMultiplier:assisted&&!manualBoost?MOBILE_ASSIST.autoBoostStrength:1,
    gasCostMultiplier:assisted&&!manualBoost?MOBILE_ASSIST.autoBoostGasCost:1
  };
}
export function isMobileBackActive({started=false,finished=false,mobile=false}={}){
  return !!mobile&&!!started&&!finished;
}
