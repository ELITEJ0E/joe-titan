export const ASPECTS=Object.freeze([
  {id:'skyrend',key:'1',name:'Skyrend',color:0x82e8ff,duration:6,cooldown:18,effect:'burst',speed:1.34,boost:1.45,vertical:15,description:'Aerial overdrive'},
  {id:'bastion',key:'2',name:'Bastion',color:0x93a8cb,duration:8,cooldown:24,effect:'guard',armor:.55,description:'Impact armor'},
  {id:'cinder',key:'3',name:'Cinder',color:0xff9864,duration:5,cooldown:20,effect:'pulse',damage:36,range:26,description:'Heat shockwave'},
  {id:'tempest',key:'4',name:'Tempest',color:0xaff5d8,duration:7,cooldown:22,effect:'gas',gas:48,description:'Propulsion surge'},
  {id:'warden',key:'5',name:'Warden',color:0xc0e890,duration:6,cooldown:22,effect:'recover',heal:46,description:'Repair field'},
  {id:'echo',key:'6',name:'Echo',color:0xd5a7ff,duration:8,cooldown:24,effect:'decoy',description:'Signal decoy'},
  {id:'breaker',key:'7',name:'Breaker',color:0xffc775,duration:4,cooldown:20,effect:'impact',damage:55,range:18,description:'Kinetic strike'},
  {id:'harrier',key:'8',name:'Harrier',color:0x8db7ff,duration:9,cooldown:27,effect:'reel',reel:1.9,description:'Cable mastery'},
  {id:'sovereign',key:'9',name:'Sovereign',color:0xf2d89b,duration:7,cooldown:30,effect:'command',slow:.48,description:'Suppression field'}
]);

export function createAspectState(){return {selected:0,active:null,duration:0,cooldown:0};}
export function selectAspect(state,index){state.selected=Math.max(0,Math.min(ASPECTS.length-1,index));return ASPECTS[state.selected];}
export function updateAspect(state,dt){
  state.cooldown=Math.max(0,state.cooldown-dt);
  if(!state.active)return {ended:false};
  state.duration=Math.max(0,state.duration-dt);
  if(state.duration>0)return {ended:false};
  const ended=state.active;state.active=null;return {ended:true,aspect:ended};
}
export function activateAspect(state){
  if(state.active)return {ok:false,reason:'ACTIVE'};
  if(state.cooldown>0)return {ok:false,reason:'COOLDOWN',remaining:state.cooldown};
  const aspect=ASPECTS[state.selected];state.active=aspect;state.duration=aspect.duration;state.cooldown=aspect.cooldown;
  return {ok:true,aspect};
}
