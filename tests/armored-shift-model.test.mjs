import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createArmoredNative,updateArmoredNative,shouldUseArmoredRun,disposeArmoredNative} from '../src/armored-native-rig.js';
import {ARMORED_IDLE_PATH} from '../src/titan-glb-models.js';

function readGLB(path){
 const bytes=readFileSync(new URL(path,import.meta.url));
 assert.equal(bytes.toString('utf8',0,4),'glTF',path);
 const jsonChunkLength=bytes.readUInt32LE(12);
 return JSON.parse(bytes.toString('utf8',20,20+jsonChunkLength));
}
function fakeGLTF(running){
 const scene=new THREE.Group(),mesh=new THREE.Mesh(
   new THREE.BoxGeometry(.35,1,.28),
   new THREE.MeshStandardMaterial({color:0xc2a17c})
 );
 mesh.position.y=.5;
 scene.add(mesh);
 const animations=running?[new THREE.AnimationClip('Run_Stealth',1,[
   new THREE.NumberKeyframeTrack('.rotation[y]',[0,.5,1],[0,.2,0])
 ])]:[];
 return {scene,animations};
}
test('two distinct Armored GLBs ship: colored standing model and rigged Run_Stealth model',()=>{
 assert.equal(ARMORED_IDLE_PATH,'/models/titans/armored_idle.glb');
 const idle=readGLB('../public/models/titans/armored_idle.glb');
 const sprint=readGLB('../public/models/titans/armored_titan.glb');
 assert.ok(idle.meshes?.length>0);
 assert.ok(sprint.skins?.length>0);
 assert.ok(sprint.animations?.some(a=>/run[_ -]?stealth/i.test(a.name)));
});
test('only Shift plus movement triggers the player sprint mesh',()=>{
 assert.equal(shouldUseArmoredRun({id:'human-shifter',moving:0,sprinting:true}),false);
 assert.equal(shouldUseArmoredRun({id:'human-shifter',moving:.5,sprinting:false}),false);
 assert.equal(shouldUseArmoredRun({id:'human-shifter',moving:.5,sprinting:true}),true);
 assert.equal(shouldUseArmoredRun({id:'human-shifter',moving:.5}),false);
});
test('switching between rest and run models does not animate the standing mesh',()=>{
 const native=createArmoredNative(fakeGLTF(true),fakeGLTF(false));
 const rig={nativeArmored:native,gait:2};
 const actor={id:'human-shifter',moving:0,sprinting:false,speed:12};
 assert.equal(native.root.rotation.y,Math.PI);
 assert.equal(native.idle.visible,true);
 assert.equal(native.run.visible,false);
 updateArmoredNative(rig,actor,.016);
 assert.equal(native.idle.visible,true);
 assert.equal(native.run.visible,false);
 actor.moving=.8;
 updateArmoredNative(rig,actor,.016);
 assert.equal(native.idle.visible,true);
 assert.equal(native.run.visible,false);
 actor.sprinting=true;
 updateArmoredNative(rig,actor,.05);
 assert.equal(native.idle.visible,false);
 assert.equal(native.run.visible,true);
 actor.sprinting=false;
 updateArmoredNative(rig,actor,.016);
 assert.equal(native.idle.visible,true);
 assert.equal(native.run.visible,false);
 actor.sprinting=true;
 actor.moving=0;
 updateArmoredNative(rig,actor,.016);
 assert.equal(native.idle.visible,true);
 assert.equal(native.run.visible,false);
 disposeArmoredNative(native);
});
