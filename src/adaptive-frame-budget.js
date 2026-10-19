// Slow-feedback adaptive resolution. No readback, GPU timers or FPS polling:
// uses the RAF frame durations already supplied by the game. Expensive
// framebuffer reallocation happens at most once per multi-second window.
export function createFrameBudgetController({low=48,high=58,minScale=.59,maxScale=1,windowSeconds=2.6}={}){
 let scale=maxScale,seconds=0,frames=0,lastFps=60;
 function update(dt){
  if(!Number.isFinite(dt)||dt<=0)return false;
  seconds+=Math.min(dt,.12);frames++;
  if(seconds<windowSeconds)return false;
  lastFps=frames/seconds;
  seconds=0;frames=0;
  const next=lastFps<low?Math.max(minScale,Math.round((scale-.11)*100)/100):
    lastFps>high?Math.min(maxScale,Math.round((scale+.055)*100)/100):scale;
  if(Math.abs(next-scale)<.001)return false;
  scale=next;return true;
 }
 function reset(){scale=maxScale;seconds=0;frames=0;lastFps=60;}
 return {update,reset,get scale(){return scale;},get fps(){return lastFps;}};
}
