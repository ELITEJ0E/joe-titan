// Damage thresholds measured in the reference game's extracted physics.
// Stun application remains separate because the provided report does not
// specify the source game's actual stun duration or recovery behavior.
export const IMPACT_TUNING=Object.freeze({safeLanding:22,safeWall:27,scale:2.4,stunAt:22});
export function impactDamage(speed,wall=false){
 if(!Number.isFinite(speed)||speed<=0)return 0;
 const safe=wall?IMPACT_TUNING.safeWall:IMPACT_TUNING.safeLanding;
 return speed<=safe?0:Math.round((speed-safe)*IMPACT_TUNING.scale);
}
