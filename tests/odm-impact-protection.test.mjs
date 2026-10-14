import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {impactDamage,evaluateODMCollision,ODM_IMPACT_RULES} from '../src/odm-impacts.js';
import {createPlayer} from '../src/player.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

test('reference unprotected impact thresholds remain unchanged',()=>{
  assert.equal(impactDamage(22,false),0);
  assert.equal(impactDamage(27,true),0);
  assert.equal(impactDamage(40,true),31);
  assert.equal(impactDamage(30,false),19);
});

test('attached or recently released ODM cables shield violent landings',()=>{
  const hit={wallSpeed:75,landingSpeed:74};
  assert.equal(evaluateODMCollision(hit,{gearActive:true}).damage,0);
  assert.equal(evaluateODMCollision(hit,{secondsSinceGear:.2}).damage,0);
  assert.ok(evaluateODMCollision(hit,{secondsSinceGear:ODM_IMPACT_RULES.gearGrace+.01}).damage>0);
});

test('wall skim uses only actual normal contact and cannot double charge landing',()=>{
  assert.deepEqual(evaluateODMCollision({wallSpeed:0,landingSpeed:15}).damage,0);
  const wall=evaluateODMCollision({wallSpeed:50,landingSpeed:48});
  assert.equal(wall.type,'landing'); // raw vertical landing is larger than wall contact
  assert.ok(wall.damage<=ODM_IMPACT_RULES.landingCap);
  assert.ok(wall.damage<impactDamage(50,true)+impactDamage(48,false));
  assert.equal(evaluateODMCollision({wallSpeed:80},{secondsSinceImpact:.2}).damage,0);
});

test('one extreme wall impact is nonlethal but repeated unprotected hits remain dangerous',()=>{
  const hit=evaluateODMCollision({wallSpeed:85,landingSpeed:0});
  assert.ok(hit.damage>0&&hit.damage<=38);
});

test('player does not instantly die from tethered contact nor chained collision frames',()=>{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const world={style:'minecraft-world',spawnPoint:V(0,1,0),grappleRay:()=>null,
    lastCollision:{wallSpeed:65,landingSpeed:70},
    resolveCollision:()=>false};
  const player=createPlayer(scene,world,camera),input={keys:new Set(),jumpQueued:false};
  player.hooks[0]={point:V(0,40,-40),length:80,age:0};
  player.update(.02,input,0);
  assert.equal(player.health,100);
  player.release(0);
  player.update(.1,input,.1);
  assert.equal(player.health,100);
  for(let i=0;i<4;i++)player.update(.1,input,.2+i*.1);
  assert.ok(player.health>=55);
  const hp=player.health;
  player.update(.02,input,.6);
  assert.equal(player.health,hp,'impact cooldown prevents rapid multi-hit death');
});
