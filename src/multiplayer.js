import {Peer} from 'peerjs';
import * as THREE from 'three';

const COLORS=['#8fe8ff','#f4bd88','#c6a7ff','#9be6a0'];
const ICE_SERVERS=[
  {urls:'stun:stun.l.google.com:19302'},
  {urls:'stun:stun1.l.google.com:19302'},
  {urls:'stun:stun.cloudflare.com:3478'}
];

function makeRemoteAvatar(scene,index=0){
  const group=new THREE.Group();
  const accent=COLORS[index%COLORS.length];
  const armor=new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.28,roughness:.5,metalness:.18});
  const dark=new THREE.MeshStandardMaterial({color:'#172532',roughness:.72,metalness:.35});
  const glow=new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.8});
  const box=(w,h,d,material,position)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(...position);group.add(mesh);return mesh;};
  const torso=box(.62,.78,.38,armor,[0,1.18,0]);torso.rotation.z=.02;
  const chest=box(.42,.32,.405,dark,[0,1.34,-.015]);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8),dark);head.position.set(0,1.78,0);group.add(head);
  const visor=box(.3,.08,.27,glow,[0,1.8,-.21]);
  const helmetRing=new THREE.Mesh(new THREE.TorusGeometry(.28,.025,6,16),glow);helmetRing.rotation.x=Math.PI/2;helmetRing.position.set(0,1.78,0);group.add(helmetRing);
  const shoulderL=box(.2,.22,.28,armor,[-.43,1.42,0]);const shoulderR=box(.2,.22,.28,armor,[.43,1.42,0]);
  shoulderL.rotation.z=-.18;shoulderR.rotation.z=.18;
  box(.16,.58,.18,dark,[-.39,1.03,0]);box(.16,.58,.18,dark,[.39,1.03,0]);
  box(.2,.68,.22,armor,[-.18,.38,0]);box(.2,.68,.22,armor,[.18,.38,0]);
  box(.27,.12,.36,dark,[-.18,.02,-.03]);box(.27,.12,.36,dark,[.18,.02,-.03]);
  const belt=new THREE.Mesh(new THREE.TorusGeometry(.37,.035,6,18),dark);belt.rotation.x=Math.PI/2;belt.position.y=.84;group.add(belt);
  const reelL=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.12,10),glow);reelL.rotation.z=Math.PI/2;reelL.position.set(-.4,.78,.08);group.add(reelL);
  const reelR=reelL.clone();reelR.position.x=.4;group.add(reelR);
  box(.08,.1,.7,glow,[-.39,.9,.2]).rotation.x=-.24;box(.08,.1,.7,glow,[.39,.9,.2]).rotation.x=-.24;
  const jetL=new THREE.Mesh(new THREE.ConeGeometry(.1,.3,8),glow);jetL.rotation.x=-Math.PI/2;jetL.position.set(-.23,.72,.31);group.add(jetL);
  const jetR=jetL.clone();jetR.position.x=.23;group.add(jetR);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.025,8,24),glow);ring.rotation.x=Math.PI/2;ring.position.y=.06;group.add(ring);
  group.userData={accent,visor,ring,jetL,jetR};
  group.visible=false;scene.add(group);return group;
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
      const state={x:Number(message.state?.x)||0,y:Number(message.state?.y)||0,z:Number(message.state?.z)||0,yaw:Number(message.state?.yaw)||0,aspect:String(message.state?.aspect||'')};
      remoteStates.set(connection.peer,state);
      let avatar=avatars.get(connection.peer);if(!avatar){avatar=makeRemoteAvatar(scene,avatars.size);avatars.set(connection.peer,avatar);}
      avatar.visible=true;avatar.position.lerp(new THREE.Vector3(state.x,state.y,state.z),.35);avatar.rotation.y=state.yaw;
      avatar.userData.ring.rotation.z+=.035;avatar.userData.jetL.scale.y=state.aspect?1.25:1;avatar.userData.jetR.scale.y=state.aspect?1.25:1;
      onCount(connections.size);
    });
    const close=()=>{clearTimeout(timeout);connections.delete(connection.peer);remoteStates.delete(connection.peer);const avatar=avatars.get(connection.peer);if(avatar){scene.remove(avatar);avatar.traverse((node)=>{node.geometry?.dispose?.();node.material?.dispose?.();});avatars.delete(connection.peer);}onCount(connections.size);if(!timedOut)setStatus(connections.size?'CONNECTED':'READY',connections.size?`${connections.size} pilot online`:'Room ready');};
    connection.on('close',close);connection.on('error',()=>{timedOut=true;setStatus('ERROR','ROOM CONNECTION FAILED · RETRY JOIN');close();});
  };
  return {
    start:ensurePeer,
    createRoom(){ensurePeer();return peerId;},
    joinRoom(room){ensurePeer();const code=String(room||'').replace(/\s+/g,'').trim();if(!code)return false;if(!peerId){pendingRoom=code;return true;}const connection=peer.connect(code,{reliable:true,serialization:'json'});bindConnection(connection);return true;},
    update(state,time){if(!peerId||time-lastBroadcast<.08)return;lastBroadcast=time;const packet={type:'state',state:{x:state.position.x,y:state.position.y,z:state.position.z,yaw:state.yaw,aspect:state.aspect?.name||''}};connections.forEach((connection)=>{if(connection.open)connection.send(packet);});},
    roomCode(){return peerId;},
    playerCount(){return connections.size;},
    destroy(){connections.forEach((connection)=>connection.close());peer?.destroy();peer=null;started=false;}
  };
}
