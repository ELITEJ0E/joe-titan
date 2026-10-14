import * as THREE from 'three';
import {createVoxelWorld} from './voxel-city.js';
import {loadMinecraftWorld} from './minecraft-world.js';
import {createPlayer} from './player.js';
import {createNavigation} from './navigation.js';
import {ASPECTS, activateAspect, createAspectState, selectAspect, updateAspect} from './aspects.js';
import {createEnemyManager} from './enemies.js';
import {createMultiplayer} from './multiplayer.js';
import {MISSION_MODES,MISSION_RECORDS_KEY,readMissionRecords,recordMission} from './missions.js';

const $=(id)=>document.getElementById(id);
const canvas=$('game');
const hud=$('hud'),menu=$('menu'),missionSelect=$('missionSelect'),pause=$('pause'),complete=$('complete'),toast=$('toast'),mobileControls=$('mobileControls');
const input={keys:new Set(),mouse:{left:false,right:false},jumpQueued:false};
const mobileInput={movePointer:null,lookPointer:null,move:{x:0,y:0},look:{x:0,y:0}};
let renderer,scene,camera,world,player,navigation,enemies,aspectState,multiplayer;
let started=false,paused=false,finished=false,courseIndex=0,elapsed=0,best=null,toastUntil=0,lastHud=0,gameTime=0;
let hadPointerLock=false,practice=false,missionMode='course',debugVisible=false,lastRecovery=0;
let hookRetryClock=0;
const TOTAL=6;
let missionRecords;
try{missionRecords=readMissionRecords(localStorage);}catch{missionRecords=readMissionRecords(null);}
best=missionRecords.bestTimes.course||null;
const formatTime=(t)=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}.${String(Math.floor((t%1)*100)).padStart(2,'0')}`;
$('bestTime').textContent=best?formatTime(best):'--:--.--';
function persistMissionRecords(){try{localStorage.setItem(MISSION_RECORDS_KEY,JSON.stringify(missionRecords));if(missionRecords.bestTimes.course)localStorage.setItem('joe-titan-best',String(missionRecords.bestTimes.course));}catch{}}
function updateMissionBoard(){
  for(const mission of MISSION_MODES){
    const card=document.querySelector(`[data-mission="${mission.id}"]`),record=missionRecords.bestTimes[mission.id];
    const label=$(mission.id==='course'?'courseRecord':mission.id==='hunt'?'huntRecord':'survivalRecord');
    if(card)card.setAttribute('aria-label',`${mission.name}. ${mission.description}${record?`. Best time ${formatTime(record)}`:missionRecords.completed.includes(mission.id)?'. Cleared':'. New operation'}`);
    if(label)label.textContent=record?`BEST ${formatTime(record)}`:missionRecords.completed.includes(mission.id)?'OPERATION CLEARED':mission.id==='survival'?'UNSECURED':'NEW RECORD';
  }
}
updateMissionBoard();
function showToast(message){toast.textContent=message;toast.classList.add('show');toastUntil=performance.now()/1000+2.4;}
function playBeep(type='hook'){
  // Tiny synth feedback, no borrowed music or sound libraries.
  try{const ctx=playBeep.ctx||(playBeep.ctx=new (window.AudioContext||window.webkitAudioContext)());if(ctx.state==='suspended')ctx.resume();
    let osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
    osc.type=type==='beacon'?'sine':'triangle';
    osc.frequency.setValueAtTime(type==='beacon'?600:220,now);osc.frequency.exponentialRampToValueAtTime(type==='beacon'?990:90,now+.16);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(type==='beacon'?.07:.03,now+.014);gain.gain.exponentialRampToValueAtTime(.0001,now+.22);osc.connect(gain).connect(ctx.destination);osc.start(now);osc.stop(now+.24);
  }catch{}
}
async function init(){
  scene=new THREE.Scene();
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setSize(innerWidth,innerHeight,false);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.14;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.15,1600);
  // Prefer the converted Java Minecraft district when its licensed asset is
  // installed. Otherwise create the lightweight original voxel city.
  // The legacy realistic GLB is never fetched or allocated.
  try {
    world=await loadMinecraftWorld(scene);
    console.info('[JOE TITAN] Minecraft Shiganshina world loaded:',world.stats);
    const cityLabel=document.querySelector('.city-label');
    if(cityLabel?.lastChild?.nodeType===3)cityLabel.lastChild.textContent=' SHIGANSHINA · WALLED DISTRICT';
    const mapLabel=document.querySelector('#mapPanel > div > span');
    if(mapLabel)mapLabel.textContent='SHIGANSHINA · TACTICAL MAP';
  } catch(error) {
    console.info('[JOE TITAN] Optional Minecraft world unavailable; using procedural city:',error.message);
    world=createVoxelWorld(scene);
  }
  player=createPlayer(scene,world,camera);
  enemies=createEnemyManager(scene,world);aspectState=createAspectState();navigation=createNavigation(world,player,camera);
  multiplayer=createMultiplayer(scene,{onStatus:({status,detail,peerId})=>{const label=$('networkStatus');if(label)label.textContent=status;const message=$('roomMessage');if(message&&detail)message.textContent=peerId&&status==='READY'?`ROOM CODE: ${peerId}`:detail;if(peerId&&status==='READY'&&!$('roomCodeInput').value)$('roomCodeInput').value=peerId;},onCount:(count)=>{$('networkCount').textContent=`${count} PILOT${count===1?'':'S'}`;}});
  camera.position.set(115,91,102);camera.lookAt(0,24,-10);
  window.addEventListener('resize',resize);
  attachEvents();
  requestAnimationFrame(loop);
}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));}
function clearInputs(){input.keys.clear();input.mouse.left=false;input.mouse.right=false;input.jumpQueued=false;mobileInput.movePointer=null;mobileInput.lookPointer=null;mobileInput.move={x:0,y:0};mobileInput.look={x:0,y:0};mobileControls?.querySelectorAll('.touch-btn.active').forEach((button)=>button.classList.remove('active'));mobileControls?.querySelectorAll('.touch-stick span').forEach((knob)=>knob.style.transform='translate(-50%,-50%)');player?.release(0);player?.release(1);}
function requestControl(){
  if(matchMedia('(pointer: coarse)').matches)return;
  if(document.pointerLockElement!==canvas&&canvas.requestPointerLock){
    try{const result=canvas.requestPointerLock();result?.catch?.(()=>{showToast('MOUSE CAPTURE UNAVAILABLE · DRAG TO AIM OR USE ARROW KEYS');});}catch{showToast('DRAG TO AIM · Q / E TO GRAPPLE');}
  }
}
async function enterImmersive(){
  try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'});}catch{}
  try{if(screen.orientation?.lock)await screen.orientation.lock('landscape');}catch{}
}
function startOrResume(){
  started=true;paused=false;finished=false;
  menu.classList.add('hidden');missionSelect.classList.add('hidden');pause.classList.add('hidden');complete.classList.add('hidden');hud.classList.remove('hidden');
  mobileControls?.classList.remove('hidden');
  canvas.focus();accumulator=0;
  if(matchMedia('(pointer: coarse)').matches)enterImmersive();
  requestControl();
}
function halt(){if(!started||finished)return;paused=true;clearInputs();mobileControls?.classList.add('hidden');pause.classList.remove('hidden');$('pauseTitle').textContent='FLIGHT PAUSED';$('pauseMessage').textContent='Unhook, reset your aim, and resume the run.';}
function startFresh(mode='course'){
  missionMode=MISSION_MODES.some(mission=>mission.id===mode)?mode:'course';
  practice=missionMode!=='course';courseIndex=missionMode==='course'?0:TOTAL;elapsed=0;finished=false;
  player.reset();enemies.reset();aspectState=createAspectState();world.setBeaconActive(missionMode==='course'?0:-1);
  $('checkpointNumber').textContent=missionMode==='course'?'01':missionMode==='hunt'?`${enemies.living()}`:'--';
  $('trialButton').textContent='START SKYLINE CIRCUIT ↗';
  clearInputs();startOrResume();hudUpdate();
}
function clearActiveAspect(){aspectState.active=null;aspectState.duration=0;player.clearAspect();}
function activateSelectedAspect(){
  const result=activateAspect(aspectState);
  if(!result.ok){showToast(result.reason==='ACTIVE'?'ASPECT ALREADY ACTIVE':`RECHARGING · ${Math.ceil(result.remaining)} S`);return;}
  const aspect=result.aspect;player.setAspect(aspect);
  if(aspect.effect==='burst')player.velocity.addScaledVector(player.viewDirection(),28),player.velocity.y+=aspect.vertical;
  if(aspect.effect==='gas')player.refillGas(aspect.gas);
  if(aspect.effect==='recover')player.heal(aspect.heal);
  if(aspect.effect==='pulse'||aspect.effect==='impact'){const hits=enemies.pulse(player.position,aspect.range,aspect.damage);showToast(`${aspect.name.toUpperCase()} · ${hits} RIFTBORN STAGGERED`);}
  if(aspect.effect==='decoy')enemies.setDecoy(player.position);
  if(aspect.effect==='command')enemies.suppress();
  showToast(`${aspect.name.toUpperCase()} ASPECT ENGAGED`);
}
function bladeStrike(){
  if(!player.attack())return;
  const alignment=player.speed>1?Math.max(0,player.velocity.clone().normalize().dot(player.viewDirection())):0;
  const flightBonus=Math.min(18,Math.max(0,player.speed-14)*.36)*(.5+.5*alignment);
  const damage=(player.aspect?.effect==='impact'?42:22)+flightBonus;
  const origin=player.position.clone().add(new THREE.Vector3(0,1.35,0));
  const result=enemies.strike(origin,player.viewDirection(),damage);
  if(result.hit)showToast(result.defeated?'RIFTBORN DISPERSED':'WEAK POINT STRIKE');
  else showToast('BLADE MISSED · AIM FOR THE GLOWING NAPE');
}
function savePhoto(){
  renderer.render(scene,camera);
  canvas.toBlob((blob)=>{
    if(!blob){showToast('PHOTO COULD NOT BE SAVED');return;}
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='joe-titan-flight.png';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('FLIGHT PHOTO SAVED');
  },'image/png');
}
function mobileKey(code,pressed){if(pressed)input.keys.add(code);else input.keys.delete(code);}
function hookHeld(index){return index===0?(input.mouse.left||input.keys.has('KeyQ')):(input.mouse.right||input.keys.has('KeyE'));}
function releaseUnheld(index){if(!hookHeld(index))player?.release(index);}
function setupTouchStick(id,type){
  const stick=$(id);if(!stick)return;
  const end=(event)=>{
    const pointer=type==='move'?mobileInput.movePointer:mobileInput.lookPointer;
    if(event?.pointerId!=null&&pointer!==event.pointerId)return;
    if(type==='move'){mobileInput.movePointer=null;mobileInput.move={x:0,y:0};['KeyW','KeyA','KeyS','KeyD'].forEach((key)=>mobileKey(key,false));}
    else {mobileInput.lookPointer=null;mobileInput.look={x:0,y:0};}
    stick.classList.remove('active');stick.querySelector('span').style.transform='translate(-50%,-50%)';
  };
  const update=(event)=>{
    const rect=stick.getBoundingClientRect(),radius=Math.max(28,Math.min(rect.width,rect.height)*.37);
    const dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2),length=Math.hypot(dx,dy),scale=length>radius?radius/length:1;
    const x=dx*scale/radius,y=dy*scale/radius;stick.querySelector('span').style.transform=`translate(calc(-50% + ${x*radius}px),calc(-50% + ${y*radius}px))`;
    if(type==='move'){
      mobileInput.move={x,y};
      mobileKey('KeyA',x<-.2);mobileKey('KeyD',x>.2);mobileKey('KeyW',y<-.2);mobileKey('KeyS',y>.2);
    }else mobileInput.look={x,y};
  };
  stick.addEventListener('pointerdown',(event)=>{if(!started||paused||finished)return;event.preventDefault();stick.setPointerCapture(event.pointerId);if(type==='move')mobileInput.movePointer=event.pointerId;else mobileInput.lookPointer=event.pointerId;stick.classList.add('active');update(event);});
  stick.addEventListener('pointermove',(event)=>{if((type==='move'?mobileInput.movePointer:mobileInput.lookPointer)!==event.pointerId)return;event.preventDefault();update(event);});
  stick.addEventListener('pointerup',end);stick.addEventListener('pointercancel',end);stick.addEventListener('lostpointercapture',end);
  window.addEventListener('pointermove',(event)=>{if((type==='move'?mobileInput.movePointer:mobileInput.lookPointer)===event.pointerId)update(event);});
  window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
  if(!window.PointerEvent){
    stick.addEventListener('touchstart',(event)=>{if(!started||paused||finished)return;const touch=event.changedTouches[0];event.preventDefault();if(type==='move')mobileInput.movePointer=touch.identifier;else mobileInput.lookPointer=touch.identifier;stick.classList.add('active');update(touch);},{passive:false});
    stick.addEventListener('touchmove',(event)=>{const pointer=type==='move'?mobileInput.movePointer:mobileInput.lookPointer;const touch=[...event.changedTouches].find((item)=>item.identifier===pointer);if(!touch)return;event.preventDefault();update(touch);},{passive:false});
    stick.addEventListener('touchend',(event)=>{const pointer=type==='move'?mobileInput.movePointer:mobileInput.lookPointer;if([...event.changedTouches].some((item)=>item.identifier===pointer))end({pointerId:pointer});});
  }
}
function setupTouchButton(button){
  const action=button.dataset.touchAction;
  const set=(pressed)=>{
    if(!started||paused||finished)return;
    button.classList.toggle('active',pressed);
    if(action==='jump'){if(pressed&&player.grounded)input.jumpQueued=true;return;}
    if(action==='attack'){if(pressed)bladeStrike();return;}
    if(action==='aspect'){if(pressed)activateSelectedAspect();return;}
    const key={leftCable:'KeyQ',rightCable:'KeyE',boost:'Space'}[action];
    if(key){
      mobileKey(key,pressed);
      if(!pressed){if(key==='KeyQ')releaseUnheld(0);if(key==='KeyE')releaseUnheld(1);}
      else if(key==='KeyQ'&&player.fire(0)||key==='KeyE'&&pressed&&player.fire(1))playBeep();
    }
  };
  button.addEventListener('pointerdown',(event)=>{event.preventDefault();button.setPointerCapture(event.pointerId);set(true);});
  button.addEventListener('pointerup',()=>set(false));button.addEventListener('pointercancel',()=>set(false));button.addEventListener('lostpointercapture',()=>set(false));
}
function setupTouchControls(){
  setupTouchStick('moveStick','move');setupTouchStick('lookStick','look');
  mobileControls?.querySelectorAll('[data-touch-action]').forEach(setupTouchButton);
}
function showMissionBoard(){updateMissionBoard();menu.classList.add('hidden');pause.classList.add('hidden');complete.classList.add('hidden');missionSelect.classList.remove('hidden');}
function attachEvents(){
  $('startButton').onclick=()=>startFresh('course');$('practiceButton').onclick=()=>startFresh('free');$('missionSelectButton').onclick=showMissionBoard;
  $('missionsBackButton').onclick=()=>{missionSelect.classList.add('hidden');menu.classList.remove('hidden');};
  missionSelect.querySelectorAll('[data-mission]').forEach((button)=>{button.onclick=()=>startFresh(button.dataset.mission);});
  $('resumeButton').onclick=()=>startOrResume();$('restartButton').onclick=()=>startFresh(missionMode);$('againButton').onclick=()=>startFresh(missionMode);
  $('freeFlightButton').onclick=()=>startFresh('free');$('resultsBoardButton').onclick=showMissionBoard;
  $('trialButton').onclick=()=>startFresh('course');
  $('photoButton').onclick=()=>savePhoto();
  $('createRoomButton').onclick=()=>{multiplayer.start();const code=multiplayer.createRoom();if(code){$('roomCodeInput').value=code;$('roomMessage').textContent=`ROOM CODE: ${code} · SHARE IT WITH A FRIEND`;}else $('roomMessage').textContent='CONNECTING TO PEER SERVER… YOUR ROOM CODE WILL APPEAR HERE';};
  $('joinRoomButton').onclick=()=>{const code=$('roomCodeInput').value.trim();if(!code){$('roomMessage').textContent='ENTER A ROOM CODE FIRST';return;}multiplayer.joinRoom(code);$('roomMessage').textContent='CONNECTING TO ROOM…';};
  $('helpButton').onclick=()=>{if(document.pointerLockElement===canvas)document.exitPointerLock();halt();};
  setupTouchControls();
  canvas.addEventListener('contextmenu',(e)=>e.preventDefault());
  window.addEventListener('blur',()=>{halt();if(document.pointerLockElement===canvas)document.exitPointerLock();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();});
  document.addEventListener('pointerlockchange',()=>{
    const locked=document.pointerLockElement===canvas;
    if(hadPointerLock&&!locked&&started&&!paused&&!finished)halt();
    hadPointerLock=locked;
  });
  document.addEventListener('mousemove',(event)=>{
    if(!started||paused||finished)return;
    if(document.pointerLockElement!==canvas&&(document.activeElement!==canvas||!event.buttons))return;
    const sensitivity=.00225;
    player.yaw-=event.movementX*sensitivity;
    player.pitch-=event.movementY*sensitivity;
  });
  canvas.addEventListener('mousedown',(event)=>{
    if(!started||paused||finished)return;
    canvas.focus();
    if(event.button===0){input.mouse.left=true;if(player.fire(0))playBeep();}
    else if(event.button===2){input.mouse.right=true;if(player.fire(1))playBeep();}
  });
  document.addEventListener('mouseup',(event)=>{
    if(event.button===0){input.mouse.left=false;releaseUnheld(0);}
    if(event.button===2){input.mouse.right=false;releaseUnheld(1);}
  });
  document.addEventListener('keydown',(event)=>{
    if(started&&!paused&&!finished&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
    if(event.code==='Escape'){halt();if(document.pointerLockElement===canvas)document.exitPointerLock();return;}
    if(event.code==='KeyH'&&started&&!finished){if(document.pointerLockElement===canvas)document.exitPointerLock();halt();return;}
    if(!started||paused||finished)return;
    if(document.pointerLockElement!==canvas&&document.activeElement!==canvas)return;
    if(!input.keys.has(event.code)){
      if(event.code==='Space'&&player.grounded)input.jumpQueued=true;
      if(event.code==='KeyQ'){if(player.fire(0))playBeep();}
      if(event.code==='KeyE'){if(player.fire(1))playBeep();}
      if(event.code==='KeyV'){player.firstPerson=!player.firstPerson;showToast(player.firstPerson?'FIRST-PERSON CAMERA':'THIRD-PERSON CAMERA');}
      if(event.code==='KeyR'){player.reset();clearActiveAspect();showToast('REDEPLOYED TO CENTRAL PLAZA');}
      if(event.code==='KeyM'){$('mapPanel').classList.toggle('hidden');}
      if(event.code==='F3'){event.preventDefault();debugVisible=!debugVisible;$('diagnostics').classList.toggle('hidden',!debugVisible);}
      if(event.code==='KeyP')savePhoto();
      if(event.code==='KeyF')bladeStrike();
      if(event.code==='KeyX')activateSelectedAspect();
      if(/^Digit[1-9]$/.test(event.code)){const aspect=selectAspect(aspectState,Number(event.code.slice(-1))-1);showToast(`${aspect.name.toUpperCase()} SELECTED · X TO ENGAGE`);}
    }
    input.keys.add(event.code);
  });
  document.addEventListener('keyup',(event)=>{
    input.keys.delete(event.code);
    if(event.code==='KeyQ')releaseUnheld(0);
    if(event.code==='KeyE')releaseUnheld(1);
  });
}
function completeMission(success=true){
  if(finished)return;
  finished=true;clearInputs();mobileControls?.classList.add('hidden');hud.classList.add('hidden');missionSelect.classList.add('hidden');complete.classList.remove('hidden');
  const records=success?recordMission(missionRecords,missionMode,missionMode==='course'||missionMode==='hunt'?elapsed:undefined):{newBest:false};
  if(success&&missionMode!=='free'){missionRecords=records.records;persistMissionRecords();updateMissionBoard();}
  best=missionRecords.bestTimes[missionMode]||null;
  $('bestTime').textContent=missionRecords.bestTimes.course?formatTime(missionRecords.bestTimes.course):'--:--.--';
  $('completeEyebrow').textContent=success?'ASTERFELL AERIAL REGIMENT / OPERATION CLEARED':'ASTERFELL AERIAL REGIMENT / PILOT RECOVERED';
  $('completeTitle').textContent=success?(missionMode==='course'?'CERTIFICATION COMPLETE':'OPERATION COMPLETE'):'FLIGHT LOST';
  $('completeHeading').textContent=!success?'THE WARD HOLDS FOR ANOTHER DAY.':missionMode==='course'?'THE SKY IS YOURS.':missionMode==='hunt'?'THE RIFT IS QUIET.':missionMode==='survival'?'ASTERFELL STANDS.':'FREE FLIGHT COMPLETE.';
  $('completeMessage').textContent=!success?`You held the ward for ${formatTime(elapsed)}. Redeploy to try again.`:missionMode==='course'?'All six signal beacons captured. Your flight time:':missionMode==='hunt'?'Every Riftborn dispersed. Your clear time:':missionMode==='survival'?'The 90-second assault is over. Your survival time:':'Asterfell is open for your next flight.';
  $('finalTime').textContent=formatTime(elapsed);
  $('recordMessage').textContent=!success?'The operation was not recorded.':missionMode==='free'?'Free Flight is always available from the operations board.':records.newBest?'NEW PERSONAL BEST — FLIGHT RECORDED':missionMode==='survival'?'OPERATION CLEARED — RECORD SECURED':`PERSONAL BEST — ${formatTime(best||elapsed)}`;
  $('againButton').textContent=missionMode==='free'?'FLY AGAIN':'REDEPLOY';
  if(document.pointerLockElement===canvas)document.exitPointerLock();if(success)playBeep('beacon');
}
function updateChallenge(dt){
  if(missionMode!=='course'||courseIndex>=TOTAL)return;
  const beacon=world.beacons[courseIndex],dist=player.position.distanceTo(beacon.group.position);
  if(dist<7.4){
    courseIndex++;playBeep('beacon');
    if(courseIndex===TOTAL){completeMission(true);return;}
    world.setBeaconActive(courseIndex);showToast(`SIGNAL CAPTURED — ${String(courseIndex).padStart(2,'0')} / 06`);
    $('checkpointNumber').textContent=String(courseIndex+1).padStart(2,'0');
  }
}
function updateMission(dt){
  if(finished||missionMode==='free')return;
  elapsed+=dt;
  if(missionMode==='hunt'&&enemies.living()===0){completeMission(true);return;}
  if(missionMode==='survival'&&elapsed>=90)completeMission(true);
}
function hudUpdate(){
  $('speed').textContent=String(Math.round(player.speed*3.6)).padStart(3,'0');
  $('altitude').textContent=String(Math.max(0,Math.round(player.position.y-1))).padStart(3,'0');
  $('gasPercent').textContent=Math.round(player.gas)+'%';$('gasFill').style.width=Math.round(player.gas)+'%';
  $('gasFill').style.background=player.gas<19?'linear-gradient(90deg,#d67567,#f2a28d)':'linear-gradient(90deg,#e8b27a,#f9dcb0)';
  $('timer').textContent=formatTime(missionMode==='survival'?Math.max(0,90-elapsed):elapsed);
  $('vertical').textContent=player.velocity.y>1?'↑ CLIMB':player.velocity.y< -1?'↓ DESCEND':'— LEVEL';
  const l=!!player.hooks[0],r=!!player.hooks[1];
  $('leftHook').classList.toggle('active',l);$('rightHook').classList.toggle('active',r);
  $('leftState').textContent=l?'LOCKED':'STANDBY';$('rightState').textContent=r?'LOCKED':'STANDBY';
  $('bearingLabel').textContent=['N','NE','E','SE','S','SW','W','NW'][(Math.round(((-player.yaw%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI/4)))%8];
  if(missionMode==='course'&&courseIndex<TOTAL){
    const d=player.position.distanceTo(world.beacons[courseIndex].point);
    $('beaconDistance').textContent=Math.round(d);
    $('missionText').textContent=`Skyline Circuit · Signal beacon ${String(courseIndex+1).padStart(2,'0')} / 06`;
  }else if(missionMode==='hunt'){
    $('beaconDistance').textContent=`${enemies.living()} LEFT`;$('checkpointNumber').textContent=String(enemies.living()).padStart(2,'0');
    $('missionText').textContent='Riftborn Hunt · Disperse every giant';
  }else if(missionMode==='survival'){
    $('beaconDistance').textContent=`${Math.max(0,90-elapsed).toFixed(0)} SEC`;$('checkpointNumber').textContent='HOLD';
    $('missionText').textContent='Last Light · Survive the Riftborn assault';
  }else{$('beaconDistance').textContent='--';$('missionText').textContent='Free Flight · Explore '+(world.style==='minecraft-world'?'Shiganshina':'Asterfell');}
  $('reticleText').textContent=l&&r?'DUAL HOOKS · SWING / REEL':l?'LEFT HOOK · RIGHT READY':r?'RIGHT HOOK · LEFT READY':'LMB / RMB OR Q / E TO GRAPPLE';
  if(!l&&!r){const target=player.target(0);$('reticle').classList.toggle('available',!!target);$('reticleText').textContent=target?`ANCHOR READY · ${Math.round(target.distanceTo(player.position))} M`:'NO ANCHOR IN RANGE';}
  else {const freeSide=l?1:0;const suggestion=l&&r?null:player.target(freeSide);
    $('reticle').classList.toggle('available',!!suggestion);
    if(suggestion)$('reticleText').textContent=`${l?'RIGHT':'LEFT'} ANCHOR READY · ${Math.round(suggestion.distanceTo(player.position))} M`;
  }
  $('trialButton').classList.toggle('hidden',missionMode!=='free');
  $('timer').parentElement.previousElementSibling.textContent=missionMode==='survival'?'TIME TO HOLD':'ELAPSED';
  const selected=ASPECTS[aspectState.selected],active=aspectState.active;
  $('aspectName').textContent=active?active.name.toUpperCase():selected.name.toUpperCase();
  $('aspectDescription').textContent=active?`${Math.ceil(aspectState.duration)} S ACTIVE`:selected.description.toUpperCase();
  $('aspectKey').textContent=active?'X ACTIVE':`${selected.key} SELECT · X ENGAGE`;
  $('aspectFill').style.width=`${active?aspectState.duration/active.duration*100:Math.max(0,1-aspectState.cooldown/selected.cooldown)*100}%`;
  $('healthFill').style.width=`${player.health}%`;$('healthValue').textContent=`${Math.ceil(player.health)}%`;
  $('threatCount').textContent=String(enemies.living()).padStart(2,'0');
  navigation.update(courseIndex,practice,enemies.enemies,active);
  if(debugVisible)$('diagnostics').textContent=`POSITION ${player.position.toArray().map(n=>n.toFixed(1)).join(' / ')}\nSPEED ${player.speed.toFixed(1)} m/s · ${player.grounded?'GROUNDED':'AIRBORNE'}\nCAMERA ${camera.position.toArray().map(n=>n.toFixed(1)).join(' / ')}\nRECOVERIES ${player.recoveries} · DRAW CALLS ${renderer.info.render.calls}`;
}
let prevTime=0,accumulator=0;
function loop(ms){
  requestAnimationFrame(loop);
  const seconds=ms*.001,dt=Math.min(prevTime?seconds-prevTime:.016,.06);prevTime=seconds;
  gameTime+=dt;
  if(started&&!paused&&!finished){
    accumulator+=dt;
    let steps=0;
    while(accumulator>=1/100&&steps<6){
      player.yaw+=(Number(input.keys.has('ArrowLeft'))-Number(input.keys.has('ArrowRight')))*.018;
      player.pitch+=(Number(input.keys.has('ArrowUp'))-Number(input.keys.has('ArrowDown')))*.013;
      player.yaw-=mobileInput.look.x*.022;
      player.pitch-=mobileInput.look.y*.016;
      // Holding a missed hook retries as the reticle moves onto a building;
      // simultaneous keyboard + mouse binds remain independently attached.
      hookRetryClock-=.01;
      if(hookRetryClock<=0){
        for(let i=0;i<2;i++)if(hookHeld(i)&&!player.hooks[i]&&player.fire(i))playBeep();
        hookRetryClock=.10;
      }
      player.update(1/100,input,gameTime);
      multiplayer?.update(player,gameTime);
      const aspectUpdate=updateAspect(aspectState,1/100);if(aspectUpdate.ended){player.clearAspect();showToast(`${aspectUpdate.aspect.name.toUpperCase()} ASPECT FADED`);}
      const danger=enemies.update(1/100,player.position,gameTime);if(danger.damage){const result=player.takeDamage(danger.damage);if(result.downed){clearActiveAspect();if(missionMode==='survival')completeMission(false);}showToast(result.downed?'FLIGHT LOST · REDEPLOYED':'RIFTBORN STRIKE · ARMOR ABSORBED DAMAGE');}
      if(!finished)updateMission(1/100);
      updateChallenge(1/100);
      accumulator-=1/100;steps++;
      if(paused||finished){accumulator=0;break;}
    }
    if(steps>=6)accumulator=0;
    player.updateCamera(dt);
    if(player.recoveries>lastRecovery){lastRecovery=player.recoveries;clearInputs();showToast('FLIGHT RECOVERED · REDEPLOYED TO CENTRAL PLAZA');}
    if(gameTime-lastHud>.08){hudUpdate();lastHud=gameTime;}
  }else if(!started){
    // A gently orbiting live world is the title screen background.
    const a=seconds*.075+.6;
    camera.position.set(Math.sin(a)*218,142+Math.sin(seconds*.21)*8,Math.cos(a)*218);
    camera.lookAt(0,9,-4);
  }
  world.animate(gameTime,dt);
  if(toast.classList.contains('show')&&seconds>toastUntil)toast.classList.remove('show');
  renderer.render(scene,camera);
}
init().catch(error=>{console.error(error);$('startMessage').textContent='Unable to initialize 3D renderer: '+error.message;$('startButton').disabled=true;});
