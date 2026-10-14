// Titan limb severance mechanics grounded in the supplied REA breakdown.
// Arms sever instantly, interrupt attacks, and regrow in 12s (6s for bosses).
// This is an independent rules module so hostile AI and effects can share it.
export const LIMB_RULES=Object.freeze({normalRegrow:12,bossRegrow:6});
export function severTitanArm(enemy,side,{boss=false}={}){
 if(!enemy?.alive||!['left','right'].includes(side))return {kind:'none'};
 const key=side==='left'?'armLeft':'armRight';
 if(enemy[key]>0)return {kind:'already-severed',side,remaining:enemy[key]};
 const duration=boss?LIMB_RULES.bossRegrow:LIMB_RULES.normalRegrow;
 enemy[key]=duration;
 enemy.attack=0;
 enemy.state='stagger';
 enemy.stagger=Math.max(enemy.stagger||0,.35);
 return {kind:'limb',side,regrow:duration,releaseGrab:true};
}
export function canTitanSwipe(enemy){
 return !!enemy?.alive&&!(enemy.stagger>0)&&!(enemy.armLeft>0&&enemy.armRight>0);
}
export function titanSwipeDamage(type){
 if(type==='runner')return 18;
 if(type==='colossus'||type==='beast')return 35;
 return 24;
}
