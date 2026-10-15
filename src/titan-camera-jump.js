const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function changeOrbitZoom(current,delta,{min=2.4,max=28,sensitivity=.00145}={}){
 if(!Number.isFinite(delta)||!Number.isFinite(current))return current;
 return clamp(current*Math.exp(clamp(delta,-700,700)*sensitivity),min,max);
}
export const TITAN_JUMPS=Object.freeze({
 jaw:{height:24,airSpeed:1.75,launch:1.6},
 attack:{height:10.5,airSpeed:1.22,launch:1.12},
 female:{height:11.5,airSpeed:1.3,launch:1.2},
 armored:{height:7.3,airSpeed:1.10,launch:1.07},
 beast:{height:9,airSpeed:1.16,launch:1.1},
 cart:{height:8.5,airSpeed:1.25,launch:1.17},
 warhammer:{height:7.1,airSpeed:1.1,launch:1.07},
 colossal:{height:3.2,airSpeed:.85,launch:1},
 founding:{height:2.6,airSpeed:.8,launch:1}
});
export function titanJumpVelocity(id,gravity=25){
 const h=TITAN_JUMPS[id]?.height??8;
 return Math.sqrt(2*Math.max(0,gravity)*h);
}
export function titanCameraLimits(height){
 const h=Math.max(1,Number(height)||15);
 return {min:Math.max(3.5,h*.67),max:Math.max(32,h*3.7),
   initial:clamp(h*1.55,12,105)};
}
