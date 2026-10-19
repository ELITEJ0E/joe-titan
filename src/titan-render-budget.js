// Distance-based render and animation budget for non-player Titans.
// Collision, health and AI always continue at the original update cadence.
export function titanRenderBudget(distance,height=15,{human=false,previous='low'}={}){
 if(human)return {lod:'high',shadow:true,interval:1/60};
 const d=Number.isFinite(distance)?Math.max(0,distance):Infinity;
 const high=Math.max(95,Math.min(174,95+height*1.75));
 const low=previous==='high'?high+24:high;
 const hidden=Math.max(270,Math.min(385,260+height*2.2));
 if(d>hidden)return {lod:'hidden',shadow:false,interval:1/10};
 if(d<=low)return {lod:'high',shadow:d<Math.max(70,height*2),interval:1/48};
 return {lod:'low',shadow:false,interval:1/15};
}
export function applyTitanRenderBudget(rig,budget){
 if(!rig||!budget)return;
 const status=rig.modelStatus;
 const modelReady=status==='loaded'&&!!rig.modelVisual;
 const high=budget.lod==='high';
 // When the GLB is still loading, keep the existing voxel sculpt readable.
 const fallbackVisible=budget.lod!=='hidden'&&(!modelReady||!high);
 if(rig.fallbackMeshes)for(const mesh of rig.fallbackMeshes){
  const detail=mesh.name?.startsWith('detail /');
  mesh.visible=fallbackVisible&&(high||!detail);
  mesh.castShadow=budget.shadow&&!detail;
 }
 if(rig.modelVisual){
  rig.modelVisual.visible=high;
  if(rig.shadowEnabled!==budget.shadow||rig.lodLevel!==budget.lod){
   rig.modelVisual.traverse(obj=>{
    if(obj.isMesh)obj.castShadow=high&&budget.shadow;
   });
   rig.shadowEnabled=budget.shadow;
  }
 }
 rig.lodLevel=budget.lod;
 rig.renderBudget=budget;
 if(budget.lod==='hidden')rig.group.visible=false;
}
