// Independent, deterministic scout weapon timing based on observed action
// phases, not source code from another game. Physics and grapple controls never
// wait for these visual/combat windows.
export const SCOUT_ATTACK_TIMING=Object.freeze({
 slash:Object.freeze({windup:.07,strike:.14,recover:.09}), // 0.30 s
 spin:Object.freeze({windup:.05,strike:.45,recover:.10}),  // 0.60 s
 buffer:.45
});
export function createScoutAttackState(){
 return {kind:'idle',phase:'idle',elapsed:0,remaining:0,buffer:null,bufferTime:0,hitQueued:null,hitDone:false};
}
export function beginScoutAttack(state,kind='slash'){
 if(!(kind in SCOUT_ATTACK_TIMING))return false;
 if(state.kind!=='idle'){
   state.buffer=kind;state.bufferTime=SCOUT_ATTACK_TIMING.buffer;
   return false;
 }
 state.kind=kind;state.phase='windup';state.remaining=SCOUT_ATTACK_TIMING[kind].windup;
 state.elapsed=0;state.hitQueued=null;state.hitDone=false;state.buffer=null;state.bufferTime=0;
 return true;
}
export function advanceScoutAttack(state,dt,{canStartBuffered=true}={}){
 if(!Number.isFinite(dt)||dt<=0)return null;
 if(state.buffer) {
   state.bufferTime-=dt;
   if(state.bufferTime<=0){state.buffer=null;state.bufferTime=0;}
 }
 let left=dt,startedBuffered=null;
 while(state.kind!=='idle'&&left>0){
   const elapsed=Math.min(left,state.remaining);
   state.elapsed+=elapsed;state.remaining-=elapsed;left-=elapsed;
   const timing=SCOUT_ATTACK_TIMING[state.kind];
   // Resolve contact after the animated arm has traversed the center of its
   // cut (58% of the strike phase), not on the windup/strike boundary.
   // Both the timing and visual pose use the SAME strike progress.
   if(state.phase==='strike'&&!state.hitDone&&
       state.remaining<=timing.strike*.42+1e-8){
     state.hitQueued=state.kind;state.hitDone=true;
   }
   if(state.remaining>1e-8)break;
   if(state.phase==='windup'){
     state.phase='strike';state.remaining=timing.strike;
   }else if(state.phase==='strike'){
     state.phase='recover';state.remaining=timing.recover;
   }else{
     state.kind='idle';state.phase='idle';state.remaining=0;
     state.elapsed=0;
     if(state.buffer&&canStartBuffered){
       const queued=state.buffer;
       beginScoutAttack(state,queued);
       startedBuffered=queued;
     }else state.buffer=null;
   }
 }
 return startedBuffered;
}
export function consumeScoutHit(state){
 const hit=state.hitQueued;
 state.hitQueued=null;return hit;
}
export function resetScoutAttack(state){
 Object.assign(state,createScoutAttackState());
}
export function scoutAttackProgress(state){
 if(state.kind==='idle')return 0;
 const timing=SCOUT_ATTACK_TIMING[state.kind];
 const total=timing.windup+timing.strike+timing.recover;
 return Math.min(1,state.elapsed/total);
}
export function cubicEaseOut(t){
 const v=Math.max(0,Math.min(1,t));
 return 1-(1-v)**3;
}
