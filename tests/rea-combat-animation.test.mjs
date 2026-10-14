import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createScoutAttackState,beginScoutAttack,advanceScoutAttack,consumeScoutHit,cubicEaseOut} from '../src/scout-combat-state.js';
import {ODM_CABLE_SEGMENTS,writeODMCableCurve} from '../src/odm-cable-visuals.js';
import {createPlayer} from '../src/player.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('slash has readable windup, one strike event and recovery',()=>{
 const action=createScoutAttackState();
 assert.equal(beginScoutAttack(action,'slash'),true);
 assert.equal(action.phase,'windup');
 advanceScoutAttack(action,.07);
 assert.equal(action.phase,'strike');
 assert.equal(consumeScoutHit(action),'slash');
 assert.equal(consumeScoutHit(action),null);
 advanceScoutAttack(action,.14);
 assert.equal(action.phase,'recover');
 advanceScoutAttack(action,.09);
 assert.equal(action.phase,'idle');
});

test('spin is distinct and queued actions wait for recovery',()=>{
 const action=createScoutAttackState();
 beginScoutAttack(action,'spin');
 advanceScoutAttack(action,.3); // wait until the last 0.3 s of spin
 assert.equal(beginScoutAttack(action,'slash'),false);
 assert.equal(action.buffer,'slash');
 advanceScoutAttack(action,.3);
 assert.equal(action.kind,'slash');
 assert.equal(action.phase,'windup');
 assert.equal(cubicEaseOut(0),0);
 assert.equal(cubicEaseOut(1),1);
 assert.ok(cubicEaseOut(.5)>.5);
});

test('buffer expires and never triggers an unrelated late attack',()=>{
 const action=createScoutAttackState();
 beginScoutAttack(action,'spin');
 beginScoutAttack(action,'slash');
 advanceScoutAttack(action,.5);
 advanceScoutAttack(action,.1);
 assert.equal(action.kind,'idle');
});

test('cable sag keeps anchored endpoints exact and middle strand hangs downward',()=>{
 const out=new Float32Array((ODM_CABLE_SEGMENTS+1)*3);
 const start=V(0,10,0),end=V(30,22,-20);
 writeODMCableCurve(out,start,end,{length:45,time:.4,speed:60});
 assert.deepEqual([...out.slice(0,3)],[0,10,0]);
 assert.ok(Math.abs(out.at(-3)-30)<1e-6);
 assert.ok(Math.abs(out.at(-2)-22)<1e-6);
 assert.ok(Math.abs(out.at(-1)+20)<1e-6);
 assert.ok(out[(ODM_CABLE_SEGMENTS/2)*3+1] < 16);
});

test('player consumes blades on slash/spin, preserves attack events and keeps cable geometry',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const world={spawnPoint:V(0,1,0),grappleRay:()=>null,resolveCollision:()=>true};
 const player=createPlayer(scene,world,camera);
 const input={keys:new Set(),jumpQueued:false};
 assert.equal(player.attack(),true);
 assert.equal(player.blades,7);
 player.update(.07,input,.07);
 assert.equal(player.consumeAttackHit(),'slash');
 assert.equal(player.consumeAttackHit(),null);
 assert.equal(player.spin(),false,'spin is buffered until slash recovery');
 player.update(.23,input,.3);
 assert.equal(player.combat.kind,'spin');
 assert.equal(player.blades,6);
 player.update(.05,input,.35);
 assert.equal(player.consumeAttackHit(),'spin');
 assert.equal(player.model.ropeLines[0].geometry.attributes.position.count,ODM_CABLE_SEGMENTS+1);
});
