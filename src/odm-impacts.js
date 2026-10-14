// Damage thresholds measured in the reference game's extracted physics.
// Stun application remains separate because the provided report does not
// specify the source game's actual stun duration or recovery behavior.
export const IMPACT_TUNING=Object.freeze({safeLanding:22,safeWall:27,scale:2.4,stunAt:22});
export function impactDamage(speed,wall=false){
 if(!Number.isFinite(speed)||speed<=0)return 0;
 const safe=wall?IMPACT_TUNING.safeWall:IMPACT_TUNING.safeLanding;
 return speed<=safe?0:Math.round((speed-safe)*IMPACT_TUNING.scale);
}


// ODM-specific impact arbitration. The source game exempts gear-assisted
// collisions (including a brief window after release) and rate-limits severe
// non-geared collisions. JOE TITAN also caps damage so a single glancing
// voxel contact cannot immediately erase a full health bar.
export const ODM_IMPACT_RULES=Object.freeze({
 gearGrace:.45,repeatCooldown:.45,
 landingMultiplier:.65,wallMultiplier:.60,
 landingCap:45,wallCap:38
});
export function evaluateODMCollision(impact,{
  gearActive=false,secondsSinceGear=Infinity,secondsSinceImpact=Infinity
}={}){
  const wall=impactDamage(impact?.wallSpeed||0,true);
  const landing=impactDamage(impact?.landingSpeed||0,false);
  // A single high-speed contact may touch a wall AND the ground. Never count
  // the same physical impact as two independent lethal events.
  const type=wall>=landing?'wall':'landing';
  const raw=Math.max(wall,landing);
  if(!raw)return {damage:0,raw:0,type:'none',protected:false};
  if(gearActive||secondsSinceGear<ODM_IMPACT_RULES.gearGrace)
    return {damage:0,raw,type,protected:true,reason:'gear'};
  if(secondsSinceImpact<ODM_IMPACT_RULES.repeatCooldown)
    return {damage:0,raw,type,protected:true,reason:'cooldown'};
  const modifier=type==='wall'?ODM_IMPACT_RULES.wallMultiplier:ODM_IMPACT_RULES.landingMultiplier;
  const cap=type==='wall'?ODM_IMPACT_RULES.wallCap:ODM_IMPACT_RULES.landingCap;
  return {damage:Math.min(cap,Math.round(raw*modifier)),raw,type,protected:false};
}
