// Original button-mash input policy. Reference reports seven presses to
// escape but does not prove exact timing, so timings remain game-tunable.
export const GRAB_ESCAPE=Object.freeze({presses:7,maxGap:1.55,minGap:.045});
export function createEscapeProgress(){return {count:0,lastAt:-Infinity,lastKey:''};}
export function registerEscapePress(progress,{key='',time=null}={}){
 const clock=Number.isFinite(time)?time:null;
 if(clock!==null){
  if(clock-progress.lastAt>GRAB_ESCAPE.maxGap)progress.count=0;
  if(clock-progress.lastAt<GRAB_ESCAPE.minGap)return {active:true,remaining:GRAB_ESCAPE.presses-progress.count,accepted:false};
 }
 // Repeated keydown (held F or Space) is ignored by the browser binding;
 // independent keyup/keydown events are counted even when the same key is reused.
 progress.count++;
 progress.lastAt=clock===null?progress.lastAt:clock;
 progress.lastKey=key;
 const escaped=progress.count>=GRAB_ESCAPE.presses;
 return {active:!escaped,remaining:escaped?0:GRAB_ESCAPE.presses-progress.count,accepted:true};
}
