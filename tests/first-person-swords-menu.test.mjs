import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createFirstPersonSwords,animateFirstPersonSwords,swordMotion} from '../src/scout-sword-visuals.js';
import {createScoutAttackState,beginScoutAttack,advanceScoutAttack} from '../src/scout-combat-state.js';
import {createPlayer} from '../src/player.js';
import {ACKERMAN_MODE} from '../src/aspects.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('camera-mounted first-person swords are separate from the hidden third-person model',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const player=createPlayer(scene,{spawnPoint:V(0,1,0),grappleRay:()=>null,resolveCollision:()=>true},camera);
 player.firstPerson=true;
 assert.equal(player.model.root.visible,false);
 assert.equal(player.fpsWeapons.group.parent,camera);
 assert.equal(player.fpsWeapons.group.visible,true);
 assert.equal(player.fpsWeapons.models.length,2);
 for(const pivot of player.fpsWeapons.models){
   let bladeCount=0;
   pivot.traverse(node=>{if(node.isMesh)bladeCount++;});
   assert.ok(bladeCount>=3);
 }
 player.firstPerson=false;
 assert.equal(player.fpsWeapons.group.visible,false);
 assert.equal(player.model.root.visible,true);
});

test('sword windup, strong slash and recovery have distinct poses in FPS view',()=>{
 const camera=new THREE.PerspectiveCamera(),model=createFirstPersonSwords(camera);
 const attack=createScoutAttackState();
 beginScoutAttack(attack,'slash');
 advanceScoutAttack(attack,.04);
 const winding=swordMotion(attack,1);
 animateFirstPersonSwords(model,attack,.04,.04);
 const initial=model.models[1].rotation.x;
 advanceScoutAttack(attack,.12);
 const striking=swordMotion(attack,1);
 animateFirstPersonSwords(model,attack,.12,.16);
 const active=model.models[1].rotation.x;
 assert.ok(striking.swing>winding.swing+.25);
 assert.ok(Math.abs(active-initial)>.15,'sword should travel across view on an actual attack');
 assert.equal(model.group.visible,true);
});

test('Q is Ackerman, Z is optional left grapple, and menu scrollbars are visually hidden',()=>{
 assert.equal(ACKERMAN_MODE.key,'Q');
 assert.equal(ACKERMAN_MODE.duration,12);
 const js=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.ok(js.includes("event.code==='KeyQ')activateSelectedAspect()"));
 assert.ok(js.includes("event.code==='KeyZ'){if(player.fire(0))"));
 assert.ok(js.includes("input.keys.has('KeyZ')"));
 assert.ok(html.includes('LMB / Z'));
 assert.ok(html.includes('Q · ACTIVATE'));
 assert.ok(css.includes('scrollbar-width:none'));
 assert.ok(css.includes('.overlay .menu-shell::-webkit-scrollbar'));
});
