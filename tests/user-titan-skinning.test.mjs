import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyTitanVertex,TITAN_GLB_PATHS} from '../src/titan-glb-models.js';
test('user GLB assets are mapped for nine Titan identities',()=>{
 assert.equal(Object.keys(TITAN_GLB_PATHS).length,9);
 assert.ok(TITAN_GLB_PATHS.armored.endsWith('/armored_titan.glb'));
});
test('skinning weights normalize and select anatomy',()=>{
 const cases=[
  {coord:[0,.93,0],want:6},
  {coord:[0,.72,0],want:1},
  {coord:[-.4,.77,0],want:2},
  {coord:[.4,.77,0],want:4},
  {coord:[-.13,.21,0],want:8},
  {coord:[.13,.21,0],want:10},
 ];
 for(const {coord,want} of cases){
  const picks=classifyTitanVertex(...coord);
  assert.equal(picks[0][0],want,'selected proper anatomical limb');
  assert.ok(Math.abs(picks.reduce((sum,x)=>sum+x[1],0)-1)<1e-5,'weights sum to 1');
 }
});