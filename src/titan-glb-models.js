import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// These are the character mesh assets, not NPC hitboxes or animation rigs.
// They are static GLBs with embedded base-color, roughness/metalness and normal maps.
export const TITAN_GLB_PATHS = Object.freeze({
  attack: '/models/titans/attack_titan.glb',
  armored: '/models/titans/armored_titan.glb',
  colossal: '/models/titans/colossal_titan.glb',
  female: '/models/titans/female_titan.glb',
  beast: '/models/titans/beast_titan.glb',
  jaw: '/models/titans/jaw_titan.glb',
  cart: '/models/titans/cart_titan.glb',
  warhammer: '/models/titans/war_hammer_titan.glb',
  founding: '/models/titans/founding_titan.glb'
});

const modelLoader = new GLTFLoader();
const cache = new Map();
const ALIGN_Z_UP_FRONT_NEG_Y = new THREE.Matrix4().set(
  -1, 0, 0, 0,
   0, 0, 1, 0,
   0, 1, 0, 0,
   0, 0, 0, 1
);

function getModel(kind) {
  if (!TITAN_GLB_PATHS[kind]) return Promise.reject(new Error('Unknown Titan: '+kind));
  if (!cache.has(kind)) {
    cache.set(kind, modelLoader.loadAsync(TITAN_GLB_PATHS[kind]).catch(error => {
      // A missing or interrupted download should be retried next time.
      cache.delete(kind);
      throw error;
    }));
  }
  return cache.get(kind);
}

// Preserve the existing rig and its collision/gameplay markers as a fallback.
// A GLB becomes the visible skin only after it has finished loading.
export function attachTitanGLB(rig, kind) {
  if (typeof document === 'undefined' || typeof window === 'undefined' || !TITAN_GLB_PATHS[kind]) return rig;
  rig.modelStatus = 'loading';
  rig.modelReady = getModel(kind).then(gltf => {
    if (rig.disposed) return false;
    const oldMeshes = [];
    rig.group.traverse(node => {
      if (node.isMesh && node.geometry?.type !== 'CircleGeometry') oldMeshes.push(node);
    });
    const display = new THREE.Group();
    display.name = 'GLB visual / ' + kind;
    const aligned = new THREE.Group();
    aligned.quaternion.setFromRotationMatrix(ALIGN_Z_UP_FRONT_NEG_Y);
    const asset = gltf.scene.clone(true);
    aligned.add(asset);
    display.add(aligned);
    display.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(aligned);
    const dims = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(dims.y) || dims.y <= 0) throw new Error('Invalid Titan model bounds: ' + kind);
    // The old rig uses normalized height=1; parent scale applies metres.
    const factor = 1 / dims.y;
    const center = bounds.getCenter(new THREE.Vector3());
    aligned.scale.setScalar(factor);
    aligned.position.set(-center.x*factor, -bounds.min.y*factor, -center.z*factor);
    display.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false;
      }
    });
    rig.group.add(display);
    oldMeshes.forEach(mesh => {mesh.visible=false;});
    rig.modelVisual = display;
    rig.modelStatus = 'loaded';
    return true;
  }).catch(error => {
    rig.modelStatus = 'fallback';
    if (!rig.disposed) console.warn('GLB Titan visual unavailable, using procedural rig:', kind, error);
    return false;
  });
  return rig;
}

export function preloadTitanGLBs(kinds=Object.keys(TITAN_GLB_PATHS)) {
  if (typeof window === 'undefined') return Promise.resolve([]);
  return Promise.allSettled(kinds.map(getModel));
}
