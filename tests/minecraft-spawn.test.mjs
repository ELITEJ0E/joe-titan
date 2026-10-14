import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {findSafeMinecraftSpawn} from '../src/minecraft-spawn.js';

const open=new Set([0,17,19]);
const assetPath=new URL('../public/maps/shiganshina.jtvx',import.meta.url);
function getCell(asset,x,y,z){return asset.voxel[(x*asset.ny+y)*asset.nz+z];}
test('an enclosed building at the preferred spawn is rejected for an open street',()=>{
  const nx=32,ny=32,nz=32,voxel=new Uint8Array(nx*ny*nz);
  const set=(x,y,z,id)=>voxel[(x*ny+y)*nz+z]=id;
  for(let x=0;x<nx;x++)for(let z=0;z<nz;z++)set(x,12,z,15);
  for(let x=13;x<=18;x++)for(let z=13;z<=18;z++){
    for(let y=13;y<=20;y++){
      if(x===13||x===18||z===13||z===18)set(x,y,z,2);
    }
    set(x,21,z,8);
  }
  const asset={nx,ny,nz,voxel},origin={x:-16,y:-10,z:-16};
  const safe=findSafeMinecraftSpawn(asset,origin,{x:0,z:0},13);
  assert.ok(safe,'should find a safe outdoor alternative');
  assert.ok(!(safe.x>=-3&&safe.x<3&&safe.z>=-3&&safe.z<3),'should not spawn inside building footprint');
  assert.equal(safe.y,4,'feet should rest on top of the original street');
});
test('without any walkable outdoor voxels the spawn finder fails safely',()=>{
  const asset={nx:20,ny:20,nz:20,voxel:new Uint8Array(20*20*20)};
  assert.equal(findSafeMinecraftSpawn(asset,{x:-10,y:-10,z:-10},{x:0,z:0}),null);
});
test('actual converted Shiganshina map produces clear outdoor spawn with headroom', {skip:!existsSync(assetPath)},()=>{
  const raw=inflateSync(readFileSync(assetPath));
  assert.equal(raw.toString('ascii',0,4),'JTVX');
  const nx=raw.readUInt16LE(6),ny=raw.readUInt16LE(8),nz=raw.readUInt16LE(10);
  const first=24+raw.readUInt32LE(20);
  const asset={nx,ny,nz,voxel:raw.subarray(first,first+nx*ny*nz)};
  const origin={x:-152,y:-10,z:-146},safe=findSafeMinecraftSpawn(asset,origin);
  assert.ok(safe,'the uploaded region should contain a safe spawn');
  assert.ok(safe.y>=2&&safe.y<=15,'pilot should start at street-level rather than inside a tower');
  const x=Math.floor(safe.x-origin.x),z=Math.floor(safe.z-origin.z);
  const support=Math.floor(safe.y-origin.y)-2;
  assert.ok(!open.has(getCell(asset,x,support,z)),'feet need solid support');
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)
    for(let dy=1;dy<=4;dy++)
      assert.ok(open.has(getCell(asset,x+dx,support+dy,z+dz)),'pilot needs 5x5 clear surroundings');
  for(let y=support+1;y<ny;y++)
    assert.ok(open.has(getCell(asset,x,y,z)),'pilot must be outdoors, not under a roof');
});
