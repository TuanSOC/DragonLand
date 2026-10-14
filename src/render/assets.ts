// Nạp toàn bộ model GLB một lần lúc khởi động, sau đó clone ra dùng.
// Model gốc có kích thước/gốc tọa độ khác nhau → spawn() chuẩn hóa về kích thước mong muốn,
// đáy nằm ở y = 0, tâm ở giữa.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const MODEL_FILES = {
  dragonBaby: 'dragon-baby.glb',
  dragonAdult: 'dragon-adult.glb',
  dragonHybrid: 'dragon-hybrid.glb',
  egg: 'egg.glb',
  tree: 'tree.glb',
  tree2: 'tree2.glb',
  autumnTree: 'autumn-tree.glb',
  rock: 'rock.glb',
  rockLarge: 'rock-large.glb',
  rocks: 'rocks.glb',
  mineral: 'mineral.glb',
  mountain: 'mountain.glb',
  bush: 'bush.glb',
  bushFlowers: 'bush-flowers.glb',
  bushBerries: 'bush-berries.glb',
  flowers: 'flowers.glb',
  farmDirt: 'farm-dirt.glb',
  wheat: 'wheat.glb',
  corn: 'corn.glb',
  house: 'fantasy-house.glb',
  well: 'well.glb',
  coin: 'coin.glb',
} as const;

export type ModelKey = keyof typeof MODEL_FILES;

/** model có xương (skinned) phải clone bằng SkeletonUtils, không thì animation hỏng */
const SKINNED = new Set<ModelKey>(['dragonBaby', 'dragonAdult', 'dragonHybrid']);

interface Entry {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  box: THREE.Box3;
}

const cache = new Map<ModelKey, Entry>();

export async function loadAllModels(onProgress: (done: number, total: number) => void): Promise<void> {
  const loader = new GLTFLoader();
  const base = `${import.meta.env.BASE_URL}models/`;
  const keys = Object.keys(MODEL_FILES) as ModelKey[];
  let done = 0;
  await Promise.all(
    keys.map(async (key) => {
      const gltf = await loader.loadAsync(base + MODEL_FILES[key]);
      gltf.scene.updateMatrixWorld(true);
      // precise = true để tính bbox đúng cho mesh có xương
      const box = new THREE.Box3().setFromObject(gltf.scene, true);
      cache.set(key, { scene: gltf.scene, animations: gltf.animations, box });
      onProgress(++done, keys.length);
    }),
  );
}

export function getAnimations(key: ModelKey): THREE.AnimationClip[] {
  return cache.get(key)?.animations ?? [];
}

/**
 * Tạo bản sao model, chuẩn hóa kích thước.
 * @param size kích thước mong muốn (đơn vị thế giới)
 * @param fit 'height' = theo chiều cao, 'max' = theo cạnh lớn nhất
 */
export function spawn(key: ModelKey, size: number, fit: 'height' | 'max' = 'max'): THREE.Group {
  const entry = cache.get(key);
  if (!entry) throw new Error(`Model chưa nạp: ${key}`);
  const inner = (SKINNED.has(key) ? cloneSkinned(entry.scene) : entry.scene.clone(true)) as THREE.Object3D;
  const dims = entry.box.getSize(new THREE.Vector3());
  const ref = fit === 'height' ? dims.y : Math.max(dims.x, dims.y, dims.z);
  const s = size / (ref || 1);
  const center = entry.box.getCenter(new THREE.Vector3());
  inner.scale.multiplyScalar(s);
  inner.position.set(-center.x * s, -entry.box.min.y * s, -center.z * s);

  inner.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // bbox của mesh có xương hay sai khi đang animate → tắt cull cho chắc
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
  });

  const wrapper = new THREE.Group();
  wrapper.name = key;
  wrapper.add(inner);
  return wrapper;
}

/** Đổi màu các material theo tên (clone material để không ảnh hưởng bản khác). */
export function tintByName(obj: THREE.Object3D, colors: Record<string, THREE.ColorRepresentation>): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((m) => {
      const c = colors[m.name];
      if (c === undefined) return m;
      const copy = (m as THREE.MeshStandardMaterial).clone();
      copy.color.set(c);
      return copy;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

/** Đổi màu MỌI material (dùng cho trứng, đá...). */
export function tintAll(obj: THREE.Object3D, color: THREE.ColorRepresentation, emissive?: THREE.ColorRepresentation): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = (mesh.material as THREE.MeshStandardMaterial).clone();
    m.color.set(color);
    if (emissive !== undefined) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = 0.6;
    }
    mesh.material = m;
  });
}

/** Làm model trong suốt (dùng cho bóng ma khi đặt công trình). */
export function makeGhost(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(o as THREE.Sprite).isSprite) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((m) => {
      const c = m.clone();
      c.transparent = true;
      c.opacity = 0.55;
      c.depthWrite = false;
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
    mesh.castShadow = false;
  });
}
