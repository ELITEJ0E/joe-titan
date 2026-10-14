// Mouse capture state is independent from the paused game state. Browsers can
// reject a pointer-lock request immediately after Escape; a new physical click
// on the game canvas must be allowed to retry without activating ODM grapples.
export function needsMouseCapture({started=false,paused=false,finished=false,
  coarsePointer=false,locked=false}={}){
  return !!started&&!paused&&!finished&&!coarsePointer&&!locked;
}

export function captureClickAction(state){
  // An unlocked first click is only for capturing. A second, locked click
  // may safely fire a grapple; game-over/menu/paused clicks are never attacks.
  if(!state?.started||state.paused||state.finished)return 'ignore';
  if(state.coarsePointer)return 'gameplay';
  return state.locked?'gameplay':'capture';
}

export function shouldPauseForUnlock({wasLocked=false,locked=false,
  started=false,paused=false,finished=false}={}){
  return !!wasLocked&&!locked&&!!started&&!paused&&!finished;
}
