import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const supplied=['armored_idle','armored_titan','attack_titan','beast_titan','colossal_titan','female_titan','founding_titan'];
function asset(name){
 const bytes=readFileSync(new URL(`../public/models/titans/${name}.glb`,import.meta.url));
 assert.equal(bytes.readUInt32LE(8),bytes.length,'complete GLB container');
 const length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+length));
 return {bytes,doc,binary:bytes.subarray(28+length)};
}
function colors({doc,binary}){
 const primitive=doc.meshes[0].primitives[0],a=doc.accessors[primitive.attributes.COLOR_0],view=doc.bufferViews[a.bufferView];
 assert.equal(a.count,doc.accessors[primitive.attributes.POSITION].count);
 assert.equal(a.componentType,5121);assert.equal(a.normalized,true);assert.equal(a.type,'VEC4');
 const start=(view.byteOffset||0)+(a.byteOffset||0);
 return binary.subarray(start,start+a.count*4);
}

test('all supplied meshes carry portable colored, nonmetallic materials',()=>{
 for(const name of supplied){
  const model=asset(name),data=colors(model),unique=new Set();
  for(let i=0;i<data.length;i+=4){assert.equal(data[i+3],255);unique.add(data.readUInt32LE(i));}
  assert.ok(unique.size>20,`${name}: multiple embedded palette colors`);
  for(const p of model.doc.meshes.flatMap(m=>m.primitives)){
   const mat=model.doc.materials[p.material].pbrMetallicRoughness;
   assert.equal(mat.metallicFactor,0,`${name}: bone/skin is nonmetallic`);
   assert.deepEqual(mat.baseColorFactor,[1,1,1,1],'neutral multiplier preserves vertex colors');
  }
 }
});

test('standing and animated Armored Titans have identical colors and the run clip remains playable',async()=>{
 const idle=asset('armored_idle'),run=asset('armored_titan');
 assert.deepEqual(colors(run),colors(idle));
 const bytes=run.bytes;
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 assert.ok(gltf.animations.some(c=>/run[_ -]?stealth/i.test(c.name)));
 let meshes=0;
 gltf.scene.traverse(node=>{
  if(!node.isMesh)return;meshes++;
  assert.ok(node.isSkinnedMesh);assert.ok(node.skeleton.bones.length>0);
  assert.ok(node.geometry.getAttribute('normal'));assert.ok(node.material.vertexColors);
 });
 assert.ok(meshes>0);
});

test('all supplied static exports load with the game loader and retain their embedded colors',async()=>{
 for(const name of supplied.filter(n=>n!=='armored_titan')){
  const {bytes}=asset(name);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let count=0;
  gltf.scene.traverse(node=>{if(node.isMesh){count++;assert.ok(node.material.vertexColors);assert.ok(node.geometry.attributes.color);}});
  assert.ok(count>0,name);
 }
});

test('Jaw and War Hammer retain self-contained textures and use the game Y-up orientation',()=>{
 for(const name of ['jaw_titan','war_hammer_titan']){
  const {doc,binary}=asset(name);
  const root=doc.nodes[doc.scenes[doc.scene||0].nodes[0]];
  assert.ok(Math.abs(root.rotation[0]+Math.SQRT1_2)<1e-8);
  assert.ok(Math.abs(root.rotation[3]-Math.SQRT1_2)<1e-8);
  for(const image of doc.images){
   assert.ok(!image.uri,'no external texture dependency');
   const view=doc.bufferViews[image.bufferView],start=view.byteOffset||0;
   assert.equal(binary.toString('ascii',start+1,start+4),'PNG');
   assert.ok(start+view.byteLength<=binary.length);
  }
 }
});
