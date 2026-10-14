import {Peer} from 'peerjs';
import * as THREE from 'three';
import {encodeScoutState} from './reference-combat.js';
import {remoteTarget,smoothFactor} from './network-interpolation.js';
import {createScoutAvatarModel} from './player.js';
import {applyRemoteScoutAppearance,animateRemoteScoutModel,disposeRemoteScoutVisual,scoutAppearanceIndex} from './scout-appearance.js';

const COLORS=['#8fe8ff','#f4bd88','#c6a7ff','#9be6a0'];
const ICE_SERVERS=[
  {urls:'stun:stun.l.google.com:19302'},
  {urls:'stun:stun1.l.google.com:19302'},
  {urls:'stun:stun.cloudflare.com:3478'},
  {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
  {urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
  {urls:'turns:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}
];


// One tiny, pixel-sharp label texture per remote scout. Browser multiplayer
// creates these lazily; the Node test environment never needs a DOM.
function makeScoutNameTag(text,color){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');
  canvas.width=128;canvas.height=32;
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.fillStyle='rgba(13,22,30,.78)';ctx.fillRect(0,0,128,32);
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(1,1,126,30);
  ctx.font='bold 17px monospace';ctx.textAlign='center';
  ctx.fillStyle='#ffffff';ctx.fillText(text.slice(0,13),64,22);
  const texture=new THREE.CanvasTexture(canvas);
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
    map:texture,transparent:true,depthWrite:false,alphaTest:.1
  }));
  sprite.position.set(0,2.3,0);sprite.scale.set(1.35,.34,1);
  return sprite;
}

function makeRemoteAvatar(scene,peerId=''){
  // Replicated pilots are the SAME voxel scout body used by the local player,
  // including face, jacket, cloak emblem, swords, ODM cylinders and joints.
  // Remote-only construction omits unused local rope geometry and shadows.
  const model=createScoutAvatarModel(scene,{remote:true});
  const variant=scoutAppearanceIndex(peerId);
  const appearance=applyRemoteScoutAppearance(model.root,{peerId});
  const tint=['#8fe8ff','#f4bd88','#c6a7ff','#9be6a0','#ffd49a','#9dc7ed'][variant];
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.025,8,24),
    new THREE.MeshBasicMaterial({color:tint,transparent:true,opacity:.65,depthWrite:false}));
  ring.rotation.x=Math.PI/2;ring.position.y=.06;model.root.add(ring);
  const tag=makeScoutNameTag('SCOUT '+String(variant+1).padStart(2,'0'),tint);
  if(tag)model.root.add(tag);
  model.root.userData={model,appearance,ring,tag};
  model.root.visible=false;
  return model.root;
}

export function createMultiplayer(scene,{onStatus=()=>{},onCount=()=>{}}={}){
  let peer=null,peerId='',started=false,pendingRoom='',connections=new Map(),avatars=new Map(),lastBroadcast=0;
  const remoteStates=new Map();
  const setStatus=(status,detail='')=>onStatus({status,detail,peerId});
  const ensurePeer=()=>{
    if(peer||started)return;
    started=true;setStatus('CONNECTING');
    peer=new Peer({config:{iceServers:ICE_SERVERS},debug:1});
    peer.on('open',(id)=>{peerId=id;setStatus('READY','Create a room or enter a room code');if(pendingRoom){const room=pendingRoom;pendingRoom='';bindConnection(peer.connect(room,{reliable:true,serialization:'json'}));}});
    peer.on('connection',(connection)=>bindConnection(connection));
    peer.on('error',(error)=>setStatus('ERROR',error.type==='peer-unavailable'?'Room not found':'Peer connection unavailable'));
  };
  const bindConnection=(connection)=>{
    connections.set(connection.peer,connection);
    let timedOut=false;
    const timeout=setTimeout(()=>{if(connection.open)return;timedOut=true;connection.close();setStatus('ERROR','ROOM CONNECTION TIMED OUT · RETRY JOIN');},12000);
    connection.on('open',()=>{clearTimeout(timeout);connection.send({type:'hello',name:'JOE TITAN pilot'});setStatus('CONNECTED',`${connections.size} pilot${connections.size===1?'':'s'} online`);onCount(connections.size);});
    connection.on('data',(message)=>{
      if(!message||message.type!=='state')return;
      const encoded=message.state?.physics;
      const p=Array.isArray(encoded?.p)?encoded.p:null;
      const state={x:Number(p?.[0]??message.state?.x)||0,y:Number(p?.[1]??message.state?.y)||0,z:Number(p?.[2]??message.state?.z)||0,yaw:Number(message.state?.yaw)||0,aspect:String(message.state?.aspect||''),physics:encoded};
      state.receivedAt=performance.now()/1000;
      remoteStates.set(connection.peer,state);
      let avatar=avatars.get(connection.peer);if(!avatar){avatar=makeRemoteAvatar(scene,connection.peer);avatars.set(connection.peer,avatar);}
      avatar.visible=true;avatar.rotation.y=state.yaw;
      avatar.userData.ring.material.opacity=state.aspect?.8:.65;
      onCount(connections.size);
    });
    const close=()=>{clearTimeout(timeout);connections.delete(connection.peer);remoteStates.delete(connection.peer);const avatar=avatars.get(connection.peer);if(avatar){scene.remove(avatar);disposeRemoteScoutVisual(avatar);avatars.delete(connection.peer);}onCount(connections.size);if(!timedOut)setStatus(connections.size?'CONNECTED':'READY',connections.size?`${connections.size} pilot online`:'Room ready');};
    connection.on('close',close);connection.on('error',()=>{timedOut=true;setStatus('ERROR','ROOM CONNECTION FAILED · RETRY JOIN');close();});
  };
  return {
    render(dt){
      const now=performance.now()/1000;
      for(const [id,state] of remoteStates){
        const avatar=avatars.get(id);if(!avatar)continue;
        const pos=remoteTarget(state,now-state.receivedAt);
        avatar.position.lerp(new THREE.Vector3(...pos),smoothFactor(dt));
        animateRemoteScoutModel(avatar.userData.model,state.physics,dt,now);
        avatar.userData.ring.rotation.z+=dt*.7;
      }
    },
    start:ensurePeer,
    createRoom(){ensurePeer();return peerId;},
    joinRoom(room){ensurePeer();const code=String(room||'').replace(/\s+/g,'').trim();if(!code)return false;if(!peerId){pendingRoom=code;return true;}const connection=peer.connect(code,{reliable:true,serialization:'json'});bindConnection(connection);return true;},
    update(state,time){if(!peerId||time-lastBroadcast<.08)return;lastBroadcast=time;const physics=encodeScoutState(state);
      const packet={type:'state',state:{x:physics.p[0],y:physics.p[1],z:physics.p[2],yaw:state.yaw,aspect:state.aspect?.name||'',physics}};connections.forEach((connection)=>{if(connection.open)connection.send(packet);});},
    roomCode(){return peerId;},
    playerCount(){return connections.size;},
    destroy(){connections.forEach((connection)=>connection.close());peer?.destroy();peer=null;started=false;}
  };
}
