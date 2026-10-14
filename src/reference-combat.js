// Source-informed combat timings and projectile ballistics.
// Projectile gravity is 4 units/s² as reported; 4 is NOT half of player gravity (26).
export const REFERENCE_COMBAT=Object.freeze({
  bulletSpeed:110,bulletGravity:4,bulletDamage:30,bulletLife:1.4,
  reload:1.6,shotCooldown:.28,hitRadius:.9,parryRadius:1.9,
  slashParryWindow:.3,spinParryWindow:.6,swipeRunt:18,swipeBoss:35,
  fuelRadius:3.6,fuelVertical:3.4,fuelGas:60,fuelHP:15,fuelBlades:2
});
export const roundWire=value=>Math.round(value*100)/100;
export const vectorWire=v=>[roundWire(v.x),roundWire(v.y),roundWire(v.z)];
export function encodeScoutState(player){
 return {
  p:vectorWire(player.position),v:vectorWire(player.velocity),
  a:player.hooks.map(h=>h?{p:vectorWire(h.point),l:roundWire(h.length)}:null),
  f:(player.grounded?1:0)|(player.boost?2:0)
 };
}
export function stepBullet(bullet,dt){
 if(bullet.life<=0)return false;
 bullet.position.addScaledVector(bullet.velocity,dt);
 bullet.velocity.y-=REFERENCE_COMBAT.bulletGravity*dt;
 bullet.life=Math.max(0,bullet.life-dt);
 return bullet.life>0;
}
export function createBullet(position,direction,{damage=REFERENCE_COMBAT.bulletDamage}={}){
 return {position:position.clone(),velocity:direction.clone().normalize().multiplyScalar(REFERENCE_COMBAT.bulletSpeed),
 damage,life:REFERENCE_COMBAT.bulletLife};
}
export function parryBullet(bullet,pilot,slashAge,spinAge=Infinity){
 const active=slashAge>=0&&slashAge<REFERENCE_COMBAT.slashParryWindow
   ||spinAge>=0&&spinAge<REFERENCE_COMBAT.spinParryWindow;
 if(!active||bullet.position.distanceTo(pilot)>REFERENCE_COMBAT.parryRadius)return false;
 bullet.velocity.multiplyScalar(-1);
 return true;
}
export function pickupAvailable(player,item){
 const dx=player.position.x-item.position.x,dz=player.position.z-item.position.z;
 return Math.hypot(dx,dz)<=REFERENCE_COMBAT.fuelRadius &&
   Math.abs(player.position.y-item.position.y)<=REFERENCE_COMBAT.fuelVertical;
}
export function segmentNapeHealth(hp){return Math.max(0,Math.ceil(hp/100));}
export function napeHit({hp,napeHP=segmentNapeHealth(hp),shifter=false,guard=false,armor=false,deep=false}){
 if(hp<=0)return {kind:'none',hp:0,napeHP:0};
 if(armor)return {kind:'armor',hp,napeHP};
 if(guard)return {kind:'guard',hp,napeHP};
 if(!shifter)return deep?{kind:'kill',hp:0,napeHP:0}:{kind:'shallow',hp,napeHP};
 if(!deep)return {kind:'shallow',hp,napeHP};
 const next=Math.max(0,napeHP-1);
 return next===0?{kind:'kill',hp:0,napeHP:0}:{kind:'napecrack',hp:Math.min(hp,next*100),napeHP:next,stagger:1};
}
