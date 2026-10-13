import {Peer} from 'peerjs';
import * as THREE from 'three';

const COLORS=['#8fe8ff','#f4bd88','#c6a7ff','#9be6a0'];

function makeRemoteAvatar(scene,index=0){
  const group=new THREE.Group();
  const material=new THREE.MeshStandardMaterial({color:COLORS[index%COLORS.length],emissive:COLORS[index%COLORS.length],emissiveIntensity:.35,roughness:.5});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,1.05,4,8),material);body.position.y=.9;group.add(body);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.035,8,24),new THREE.MeshBasicMaterial({color:COLORS[index%COLORS.length],transparent:true,opacity:.75}));ring.rotation.x=Math.PI/2;ring.position.y=.08;group.add(ring);
  group.visible=false;scene.add(group);return group;
}

export function createMultiplayer(scene,{onStatus=()=>{},onCount=()=>{}}={}){
  let peer=null,peerId='',started=false,pendingRoom='',connections=new Map(),avatars=new Map(),lastBroadcast=0;
  const remoteStates=new Map();
  const setStatus=(status,detail='')=>onStatus({status,detail,peerId});
  const ensurePeer=()=>{
    if(peer||started)return;
    started=true;setStatus('CONNECTING');
    peer=new Peer();
    peer.on('open',(id)=>{peerId=id;setStatus('READY','Create a room or enter a room code');if(pendingRoom){const room=pendingRoom;pendingRoom='';bindConnection(peer.connect(room,{reliable:true,serialization:'json'}));}});
    peer.on('connection',(connection)=>bindConnection(connection));
    peer.on('error',(error)=>setStatus('ERROR',error.type==='peer-unavailable'?'Room not found':'Peer connection unavailable'));
  };
  const bindConnection=(connection)=>{
    connections.set(connection.peer,connection);
    connection.on('open',()=>{connection.send({type:'hello',name:'JOE TITAN pilot'});setStatus('CONNECTED',`${connections.size} pilot${connections.size===1?'':'s'} online`);onCount(connections.size);});
    connection.on('data',(message)=>{
      if(!message||message.type!=='state')return;
      const state={x:Number(message.state?.x)||0,y:Number(message.state?.y)||0,z:Number(message.state?.z)||0,yaw:Number(message.state?.yaw)||0,aspect:String(message.state?.aspect||'')};
      remoteStates.set(connection.peer,state);
      let avatar=avatars.get(connection.peer);if(!avatar){avatar=makeRemoteAvatar(scene,avatars.size);avatars.set(connection.peer,avatar);}
      avatar.visible=true;avatar.position.lerp(new THREE.Vector3(state.x,state.y,state.z),.35);avatar.rotation.y=state.yaw;
      onCount(connections.size);
    });
    const close=()=>{connections.delete(connection.peer);remoteStates.delete(connection.peer);const avatar=avatars.get(connection.peer);if(avatar){scene.remove(avatar);avatar.traverse((node)=>{node.geometry?.dispose?.();node.material?.dispose?.();});avatars.delete(connection.peer);}onCount(connections.size);setStatus(connections.size?'CONNECTED':'READY',connections.size?`${connections.size} pilot online`:'Room ready');};
    connection.on('close',close);connection.on('error',close);
  };
  return {
    start:ensurePeer,
    createRoom(){ensurePeer();return peerId;},
    joinRoom(room){ensurePeer();const code=String(room||'').trim();if(!code)return false;if(!peerId){pendingRoom=code;return true;}const connection=peer.connect(code,{reliable:true,serialization:'json'});bindConnection(connection);return true;},
    update(state,time){if(!peerId||time-lastBroadcast<.08)return;lastBroadcast=time;const packet={type:'state',state:{x:state.position.x,y:state.position.y,z:state.position.z,yaw:state.yaw,aspect:state.aspect?.name||''}};connections.forEach((connection)=>{if(connection.open)connection.send(packet);});},
    roomCode(){return peerId;},
    playerCount(){return connections.size;},
    destroy(){connections.forEach((connection)=>connection.close());peer?.destroy();peer=null;started=false;}
  };
}
