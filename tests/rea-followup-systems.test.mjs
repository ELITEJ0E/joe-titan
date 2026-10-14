import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {scoreNapeArc,chooseNapeArcTarget} from '../src/scout-blade-arc.js';
import {GRAB_ESCAPE,createEscapeProgress,registerEscapePress} from '../src/grab-escape.js';
import {chooseTitanSteering,crowdSeparation} from '../src/titan-navigation.js';
import {createScoutCutEffects} from '../src/scout-cut-effects.js';
import {createEnemyManager} from '../src/enemies.js';
import {createPlayer} from '../src/player.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('nape targeting only helps within a short, visible rear-facing sword arc',()=>{
 const enemy={id:'test',alive:true,height:15,position:V(0,0,0),forward:V(0,0,-1)};
 const behind=V(0,12,7),aim=V(0,0,-1);
 const hit=scoreNapeArc(enemy,behind,aim);
 assert.ok(hit&&hit.distance<9.5);
 assert.equal(scoreNapeArc(enemy,behind,V(1,0,0)),null);
 assert.equal(scoreNapeArc(enemy,V(0,12,-7),V(0,0,1)),null);
 assert.equal(scoreNapeArc(enemy,V(0,12,22),aim),null);
 assert.equal(scoreNapeArc(enemy,behind,aim,{
   world:{grappleRay:(start,direction)=>start.clone().addScaledVector(direction,1)}
 }),null,'solid voxel geometry prevents striking a nape through a wall');
 assert.equal(chooseNapeArcTarget([enemy],behind,aim).enemy,enemy);
});

test('live Titan manager resolves physically valid arc without camera mutation',()=>{
 const scene=new THREE.Scene(),world={grappleRay:()=>null};
 const manager=createEnemyManager(scene,world),enemy=manager.enemies[0];
 enemy.position.set(0,0,0);enemy.forward.set(0,0,-1);
 const hit=manager.strikeArc(V(0,enemy.height*.82,7),V(0,0,-1),30);
 assert.equal(hit.hit,true);
 assert.ok(enemy.health<enemy.maxHealth);
 const miss=manager.strikeArc(V(0,enemy.height*.82,-7),V(0,0,1),30);
 assert.equal(miss.hit,false);
});

test('grab escape counts seven fresh presses while filtering rapid repeats',()=>{
 const progress=createEscapeProgress();
 assert.deepEqual(registerEscapePress(progress,{key:'KeyF',time:0}),
  {active:true,remaining:6,accepted:true});
 assert.equal(registerEscapePress(progress,{key:'KeyF',time:.01}).accepted,false);
 for(let i=1;i<GRAB_ESCAPE.presses;i++){
   const feedback=registerEscapePress(progress,{key:i%2?'Space':'KeyF',time:i*.10});
   if(i===GRAB_ESCAPE.presses-1)assert.equal(feedback.active,false);
 }
 const expired=createEscapeProgress();
 registerEscapePress(expired,{time:0,key:'Space'});
 const after=registerEscapePress(expired,{time:GRAB_ESCAPE.maxGap+.5,key:'Space'});
 assert.equal(after.remaining,GRAB_ESCAPE.presses-1,'combination resets after a long pause');
});

test('player keeps legacy seven-press escape and adds optional timed input',()=>{
 const player=createPlayer(new THREE.Scene(),{spawnPoint:V(0,1,0),
   grappleRay:()=>null,resolveCollision:()=>true},new THREE.PerspectiveCamera());
 assert.equal(player.grab(),true);
 assert.equal(player.escapeGrab('KeyF',0).remaining,6);
 assert.equal(player.escapeGrab('KeyF',.01).remaining,6);
 for(let i=1;i<7;i++)player.escapeGrab(i%2?'Space':'KeyF',i*.1);
 assert.equal(player.grabbed,false);
});

test('voxel pathfinding deflects Titans from solid blocks and separates crowds',()=>{
 const blocker={grappleRay:(origin,direction,range)=>direction.z<-.9?
    origin.clone().addScaledVector(direction,Math.min(1,range)):null};
 const desired=V(0,0,-1),pos=V(0,1,0);
 const steer=chooseTitanSteering(blocker,pos,desired,{height:15});
 assert.ok(Math.abs(steer.x)>.2,'alternative headings deflect around walls');
 assert.ok(chooseTitanSteering(null,pos,desired).distanceTo(desired)<1e-9);
 const a={id:'a',height:15,alive:true,position:V(0,0,0)};
 const b={id:'b',height:15,alive:true,position:V(.5,0,0)};
 assert.ok(crowdSeparation(a,[a,b],.1).x<0);
 assert.deepEqual(crowdSeparation(a,[a],.1).toArray(),[0,0,0]);
});

test('cut effects reuse a bounded pool and fade completely',()=>{
 const scene=new THREE.Scene(),fx=createScoutCutEffects(scene);
 for(let i=0;i<50;i++)fx.cut(V(i,1,0),V(0,0,-1),{spin:i%2===0});
 assert.equal(fx.activeCount(),12);
 fx.update(.1);assert.equal(fx.activeCount(),12);
 fx.update(.23);assert.equal(fx.activeCount(),0);
 assert.equal(scene.children.length,12);
 fx.clear();assert.equal(fx.activeCount(),0);
});
