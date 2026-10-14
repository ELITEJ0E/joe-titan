import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {needsMouseCapture,captureClickAction,shouldPauseForUnlock} from '../src/mouse-capture.js';
import {createScoutAvatarModel,createPlayer} from '../src/player.js';
import {scoutAppearanceIndex,makeScoutPixelTexture,applyRemoteScoutAppearance,
  animateRemoteScoutModel,disposeRemoteScoutVisual} from '../src/scout-appearance.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('Escape resume requests capture, and first click is capture-only rather than grapple',()=>{
 const resumed={started:true,paused:false,finished:false,coarsePointer:false,locked:false};
 assert.equal(needsMouseCapture(resumed),true);
 assert.equal(captureClickAction(resumed),'capture');
 assert.equal(captureClickAction({...resumed,locked:true}),'gameplay');
 assert.equal(captureClickAction({...resumed,paused:true}),'ignore');
 assert.equal(captureClickAction({...resumed,finished:true}),'ignore');
 assert.equal(captureClickAction({...resumed,coarsePointer:true}),'gameplay');
 assert.equal(needsMouseCapture({...resumed,coarsePointer:true}),false);
 assert.equal(shouldPauseForUnlock({...resumed,wasLocked:true,locked:false}),true);
 assert.equal(shouldPauseForUnlock({...resumed,wasLocked:true,paused:true}),false);
});

test('remote pilots use the SAME detailed Minecraft-style scout rig as the local player',()=>{
 const remoteScene=new THREE.Scene(),model=createScoutAvatarModel(remoteScene,{remote:true});
 const localScene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const local=createPlayer(localScene,{spawnPoint:V(0,1,0),grappleRay:()=>null,resolveCollision:()=>true},camera);
 assert.equal(model.headRig.name,local.model.headRig.name);
 assert.equal(model.elbows.length,2);
 assert.equal(model.knees.length,2);
 assert.equal(model.blades.length,2);
 assert.equal(model.jets.length,2);
 assert.equal(model.capeL.geometry.type,local.model.capeL.geometry.type);
 assert.equal(model.shadow,null,'remote players need no extra world-space shadow object');
 assert.equal(model.ropeLines.length,0,'unused remote grapple lines are not allocated');
 assert.equal(model.windTrails.length,0);
 let remoteMeshes=0;
 model.root.traverse(o=>{if(o.isMesh)remoteMeshes++;});
 assert.ok(remoteMeshes>45,'remote avatar contains a detailed face, cloak, ODM gear and armor');
});

test('peer identities produce stable distinct pixel skins and preserve the locally shared materials',()=>{
 const scene=new THREE.Scene();
 const a=createScoutAvatarModel(scene,{remote:true});
 const b=createScoutAvatarModel(scene,{remote:true});
 const va=applyRemoteScoutAppearance(a.root,{variant:0});
 const vb=applyRemoteScoutAppearance(b.root,{variant:3});
 assert.equal(va.variant,0);assert.equal(vb.variant,3);
 assert.equal(scoutAppearanceIndex('peer-c14'),scoutAppearanceIndex('peer-c14'));
 const texturedA=[],texturedB=[];
 a.root.traverse(o=>{if(o.isMesh&&o.material?.map)texturedA.push(o.material);});
 b.root.traverse(o=>{if(o.isMesh&&o.material?.map)texturedB.push(o.material);});
 assert.ok(texturedA.length>25,'all clothing and skin have procedural pixel detail');
 assert.ok(texturedB.length>25);
 assert.ok(texturedA.every(m=>m.map.minFilter===THREE.NearestFilter));
 assert.ok(texturedA.every(m=>m.map.magFilter===THREE.NearestFilter));
 assert.ok(texturedA.every(m=>m.map.generateMipmaps===false));
 assert.notEqual(texturedA[0],texturedB[0],'different peers do not share mutable materials');
 assert.notEqual(va.colors.jacket,vb.colors.jacket);
 const t=makeScoutPixelTexture(123,'cloth');
 assert.equal(t.image.width,16);assert.equal(t.image.height,16);
 assert.ok(new Set(t.image.data).size>3,'procedural textile has visible pixel grain');
 t.dispose();
 disposeRemoteScoutVisual(a.root);
 assert.ok(texturedB[0].map,'disconnect cleanup does not remove remaining players skin');
 disposeRemoteScoutVisual(b.root);
});

test('remote animation uses velocity and replicated physics flags, not position teleports',()=>{
 const scene=new THREE.Scene(),model=createScoutAvatarModel(scene,{remote:true});
 const before=model.root.position.clone();
 animateRemoteScoutModel(model,{v:[38,-4,-38],f:2},1/60,.5);
 assert.equal(model.jets[0].visible,true);
 assert.ok(model.tilt.rotation.x<0);
 assert.ok(model.knees[0].rotation.x>0);
 assert.deepEqual(model.root.position.toArray(),before.toArray());
 animateRemoteScoutModel(model,{v:[0,0,0],f:1},.5,1);
 assert.equal(model.jets[0].visible,false);
 assert.ok(model.tilt.rotation.x>-.1);
});
