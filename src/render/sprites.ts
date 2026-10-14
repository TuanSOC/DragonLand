// Sprite tranh vẽ 2D (2.5D): ảnh PNG trong suốt đặt trong cảnh 3D, luôn quay về camera.
// Danh sách sprite có sẵn đọc từ public/sprites/manifest.json (do tools/cutout.cjs tạo).
// Thiếu sprite nào thì nơi gọi tự dùng model GLB thay thế.
import * as THREE from 'three';

const textures = new Map<string, THREE.Texture>();
const sizes = new Map<string, { w: number; h: number }>();

export async function loadSprites(): Promise<void> {
  const base = `${import.meta.env.BASE_URL}sprites/`;
  let manifest: Record<string, { w: number; h: number }> = {};
  try {
    const res = await fetch(`${base}manifest.json`);
    if (res.ok) manifest = await res.json();
  } catch {
    return; // chưa có sprite nào → dùng GLB
  }
  const loader = new THREE.TextureLoader();
  await Promise.all(
    Object.entries(manifest).map(async ([id, size]) => {
      try {
        const tex = await loader.loadAsync(`${base}${id}.png`);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        textures.set(id, tex);
        sizes.set(id, size);
      } catch {
        /* bỏ qua ảnh lỗi */
      }
    }),
  );
}

export function hasSprite(id: string): boolean {
  return textures.has(id);
}

/** Texture + kích thước gốc của sprite (dùng cho DragonMesh). */
export function getSprite(id: string): { texture: THREE.Texture; w: number; h: number } | null {
  const texture = textures.get(id);
  const size = sizes.get(id);
  return texture && size ? { texture, ...size } : null;
}

const alphaMaps = new Map<string, { data: Uint8ClampedArray; w: number; h: number }>();

/** Độ đục (0..1) tại toạ độ UV (v = 0 ở dưới) — để bấm vào vùng trong suốt không tính là trúng. */
export function alphaAt(id: string, u: number, v: number): number {
  let m = alphaMaps.get(id);
  if (!m) {
    const img = textures.get(id)?.image as CanvasImageSource | undefined;
    if (!img) return 1;
    const w = 128;
    const h = 128;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, w, h);
    m = { data: g.getImageData(0, 0, w, h).data, w, h };
    alphaMaps.set(id, m);
  }
  const x = Math.min(m.w - 1, Math.max(0, Math.floor(u * m.w)));
  const y = Math.min(m.h - 1, Math.max(0, Math.floor((1 - v) * m.h)));
  return m.data[(y * m.w + x) * 4 + 3] / 255;
}

/**
 * Tạo sprite cao `height` đơn vị, gốc ở chân (giữa-dưới).
 * @param anchorY 0 = chân sprite chạm đất; >0 để phần đáy (ví dụ nền chuồng) lún xuống dưới mặt đất một chút
 */
export function makeSprite(
  id: string,
  height: number,
  opts: { flip?: boolean; anchorY?: number; byWidth?: boolean; byMax?: boolean } = {},
): THREE.Sprite | null {
  const base = textures.get(id);
  const size = sizes.get(id);
  if (!base || !size) return null;
  let map = base;
  if (opts.flip) {
    map = base.clone();
    map.wrapS = THREE.RepeatWrapping;
    map.repeat.x = -1;
    map.needsUpdate = true;
  }
  const mat = new THREE.SpriteMaterial({ map, transparent: true, alphaTest: 0.08, depthWrite: true });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, opts.anchorY ?? 0);
  // byWidth: `height` là chiều rộng (công trình vừa ô lưới); byMax: `height` là cạnh lớn nhất (rồng sải cánh rộng)
  const byWidth = opts.byWidth || (opts.byMax && size.w > size.h);
  if (byWidth) sprite.scale.set(height, (height * size.h) / size.w, 1);
  else sprite.scale.set((height * size.w) / size.h, height, 1);
  return sprite;
}

/** Bóng tròn mờ dưới chân nhân vật để sprite "đứng" trên đất. */
let shadowTex: THREE.Texture | null = null;
const shadowGeo = new THREE.PlaneGeometry(1, 1);

export function blobShadow(radius: number): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const mesh = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  mesh.scale.set(radius * 2, radius * 2, 1);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}
