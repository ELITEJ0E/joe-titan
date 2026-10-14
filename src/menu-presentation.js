// Pure pause-state policy for keyboard and menu controls. Escape acts only on
// an active flight; browser key repeats cannot trigger multiple transitions.
export function escapeAction({started=false,paused=false,finished=false,repeat=false}={}){
 if(repeat||!started||finished)return 'none';
 return paused?'resume':'pause';
}

// Readable, lower-altitude title orbit; gameplay camera is controlled solely
// by the pilot controller and is never moved by this presentation helper.
export function titleCameraPose(seconds=0){
 const a=seconds*.065+.6;
 const radius=128,vertical=72+Math.sin(seconds*.19)*4;
 return {
   position:[Math.sin(a)*radius,vertical,Math.cos(a)*radius],
   target:[0,23,-8],
   fov:66
 };
}
