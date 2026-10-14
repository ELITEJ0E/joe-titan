// Original close-range blade arc targeting. The camera aim remains unchanged;
// limited in-arc magnetism selects a nape point only when a real sword swing
// could reach it. This is not an aim-bot for distant Titans.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const BLADE_ARC=Object.freeze({reach:9.5,slashAngle:.42,spinAngle:.64,occlusionMargin:.55});

export function scoreNapeArc(enemy,origin,aim,{
 reach=BLADE_ARC.reach,halfAngle=BLADE_ARC.slashAngle,world=null
}={}){
 if(!enemy?.alive||!origin||!aim||!enemy.forward)return null;
 const fromEnemy=origin.clone().sub(enemy.position);
 // Back of skull must face the sword-bearing scout.
 if(fromEnemy.dot(enemy.forward)>=-.5)return null;
 const point=enemy.position.clone().addScaledVector(enemy.forward,-enemy.height*.18);
 point.y+=enemy.height*.82;
 const delta=point.clone().sub(origin),distance=delta.length();
 if(distance>reach||distance<.001)return null;
 const toward=delta.divideScalar(distance);
 const forward=aim.clone().normalize();
 const alignment=clamp(forward.dot(toward),-1,1);
 if(alignment<Math.cos(halfAngle))return null;
 const obstruction=world?.grappleRay?.(origin,toward,distance);
 if(obstruction&&obstruction.distanceTo(origin)<distance-BLADE_ARC.occlusionMargin)return null;
 return {enemy,point,direction:toward,distance,alignment,
   score:(1-alignment)*6+distance*.065};
}

export function chooseNapeArcTarget(enemies,origin,aim,options={}){
 let selected=null;
 for(const enemy of enemies){
  const candidate=scoreNapeArc(enemy,origin,aim,options);
  if(candidate&&(!selected||candidate.score<selected.score))selected=candidate;
 }
 return selected;
}
