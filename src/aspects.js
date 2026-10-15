// Ackerman Mode replaces the previous nine unrelated Aspect skills.
// It is deliberately short and cinematic: the pilot stays responsive while
// nearby Titans, projectiles and world animation run at a reduced time scale.
export const ACKERMAN_MODE=Object.freeze({
  id:'ackerman',key:'X',name:'Ackerman Mode',color:0xb4dcff,
  duration:7,cooldown:26,effect:'ackerman',
  speed:1.52,boost:1.3,reel:1.45,gravityScale:.34,
  worldTimeScale:.27,description:'7s bullet-time ODM · fast movement · low gravity'
});
export const ASPECTS=Object.freeze([ACKERMAN_MODE]);

export function createAspectState(){return {selected:0,active:null,duration:0,cooldown:0};}
export function selectAspect(state,index){
  state.selected=0;return ASPECTS[0];
}
export function updateAspect(state,dt){
  if(!Number.isFinite(dt)||dt<=0)return {ended:false};
  state.cooldown=Math.max(0,state.cooldown-dt);
  if(!state.active)return {ended:false};
  state.duration=Math.max(0,state.duration-dt);
  if(state.duration>0)return {ended:false};
  const ended=state.active;state.active=null;return {ended:true,aspect:ended};
}
export function activateAspect(state){
  if(state.active)return {ok:false,reason:'ACTIVE'};
  if(state.cooldown>0)return {ok:false,reason:'COOLDOWN',remaining:state.cooldown};
  const aspect=ASPECTS[0];state.active=aspect;state.duration=aspect.duration;
  state.cooldown=aspect.cooldown;return {ok:true,aspect};
}
export function ackermanWorldScale(state){
  return state?.active?.effect==='ackerman'?state.active.worldTimeScale:1;
}
