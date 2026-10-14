import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ASPECTS, createAspectState, activateAspect, selectAspect, updateAspect} from '../src/aspects.js';
import {createEnemySimulation, strikeWeakPoint} from '../src/enemies.js';

test('nine original aspects have distinct identities, cooldowns and effects',()=>{
  assert.equal(ASPECTS.length,9);
  assert.equal(new Set(ASPECTS.map(aspect=>aspect.id)).size,9);
  assert.equal(new Set(ASPECTS.map(aspect=>aspect.key)).size,9);
  const state=createAspectState();
  for(let index=0;index<ASPECTS.length;index++){
    selectAspect(state,index);const result=activateAspect(state);
    assert.equal(result.ok,true,ASPECTS[index].id);
    assert.equal(state.active.id,ASPECTS[index].id);
    assert.ok(state.cooldown>0);assert.ok(state.duration>0);
    assert.equal(activateAspect(state).ok,false,'active aspect cannot stack');
    updateAspect(state,100);assert.equal(state.active,null);assert.equal(state.cooldown,0);
  }
});

test('roaming giants patrol, notice the player and pursue without leaving the ward',()=>{
  const enemies=createEnemySimulation([{id:'wanderer',position:[0,0,0],patrol:[20,0,0]}]);
  enemies.update(.1,new THREE.Vector3(100,1,100));assert.equal(enemies.enemies[0].state,'patrol');
  enemies.update(.1,new THREE.Vector3(14,1,0));assert.equal(enemies.enemies[0].state,'pursue');
  for(let i=0;i<1000;i++)enemies.update(.01,new THREE.Vector3(500,1,500));
  assert.ok(Math.abs(enemies.enemies[0].position.x)<=181);assert.ok(Math.abs(enemies.enemies[0].position.z)<=181);
});

test('only a rear weak point receives blade damage and defeats a giant',()=>{
  const enemy={id:'target',position:new THREE.Vector3(0,0,0),forward:new THREE.Vector3(0,0,-1),height:14,health:30,maxHealth:30,alive:true};
  assert.equal(strikeWeakPoint(enemy,new THREE.Vector3(0,13,-12),new THREE.Vector3(0,0,1)).hit,false);
  const hit=strikeWeakPoint(enemy,new THREE.Vector3(0,13,12),new THREE.Vector3(0,0,-1));
  assert.equal(hit.hit,true);assert.ok(enemy.health<30);
  strikeWeakPoint(enemy,new THREE.Vector3(0,13,12),new THREE.Vector3(0,0,-1),50);
  assert.equal(enemy.alive,false);
});

test('blade hits require a close nape pass when gameplay reach is limited',()=>{
  const target={id:'range',position:new THREE.Vector3(0,0,0),forward:new THREE.Vector3(0,0,-1),height:14,
    health:70,maxHealth:70,alive:true,stagger:0};
  const far=new THREE.Vector3(0,13,22),near=new THREE.Vector3(0,13,7),direction=new THREE.Vector3(0,0,-1);
  assert.equal(strikeWeakPoint(target,far,direction,30,9.5).hit,false);
  assert.equal(target.health,70,'a distant blade must not deal damage');
  assert.equal(strikeWeakPoint(target,near,direction,30,9.5).hit,true);
  assert.equal(target.health,40);
});
