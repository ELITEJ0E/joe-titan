// Titan gait settings are independent from combat attack cooldowns.
// Patrol is readable walking, pursuit gives a meaningful run transition.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const TITAN_GAIT=Object.freeze({
 wanderer:{walk:1.7,run:4.7,frequency:.95},
 runner:{walk:2.2,run:8.1,frequency:1.3},
 bruiser:{walk:1.35,run:3.9,frequency:.79},
 armored:{walk:1.75,run:6.4,frequency:.88},
 beast:{walk:1.65,run:5.2,frequency:.91},
 colossus:{walk:.78,run:2.7,frequency:.55}
});
export function gaitForTitan(enemy,{pursuing=false,remaining=Infinity}={}){
 const g=TITAN_GAIT[enemy?.type]||TITAN_GAIT.wanderer;
 const shouldRun=pursuing&&remaining>Math.max(10,(enemy.height||15)*.85);
 return {speed:shouldRun?g.run:g.walk,running:shouldRun,
   cycleRate:g.frequency*(shouldRun?1.56:1),walkSpeed:g.walk,runSpeed:g.run};
}
export function armoredClipPose(enemy,hasClip=true){
 const moving=clamp(enemy?.moving||0,0,1);
 if(!hasClip||moving<.035)return {mode:'idle',rate:0,weight:0};
 const run=enemy?.sprinting===true;
 return {mode:run?'run':'walk',
   rate:(run?1:.44)*clamp(moving,.35,1.15),
   weight:run?1:.64};
}
