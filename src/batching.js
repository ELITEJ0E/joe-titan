import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Bake static city meshes by material. Original grapple meshes keep their geometry
// and world matrices for raycasts, while the renderer draws the merged equivalents.
export function batchStaticScenery(scene) {
  scene.updateMatrixWorld(true);
  const buckets=new Map();
  for(const mesh of scene.children) {
    if(!mesh.isMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||mesh.material.isShaderMaterial)continue;
    const attributes=Object.keys(mesh.geometry.attributes).sort().join(',');
    const key=`${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${!!mesh.geometry.index}:${attributes}`;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(mesh);
  }
  for(const meshes of buckets.values()) {
    if(meshes.length<2)continue;
    const geometries=meshes.map(mesh=>mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const merged=mergeGeometries(geometries);
    for(const geometry of geometries)geometry.dispose();
    if(!merged)continue;
    merged.computeBoundingSphere();
    const batch=new THREE.Mesh(merged,meshes[0].material);
    batch.castShadow=meshes[0].castShadow;batch.receiveShadow=meshes[0].receiveShadow;
    batch.name='Static city batch';scene.add(batch);
    for(const mesh of meshes)scene.remove(mesh);
  }
}
