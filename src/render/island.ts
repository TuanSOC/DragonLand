// Cảnh quan: trời, mây, biển nhiệt đới, đảo viền lượn có bãi cát, cây cối trang trí.
// Lấy cảm hứng từ Đảo Rồng Zing Me: màu tươi, nước xanh trong, anh đào hồng, nấm, đèn lồng.
import * as THREE from 'three';
import { seeded } from '../core/rng';
import { spawn, tintByName, type ModelKey } from './assets';
import { blobShadow, makeSprite } from './sprites';

export const ISLAND_RADIUS = 19.5;

/** Bán kính mép đảo theo góc — vài sóng sin để viền lượn tự nhiên. */
export function islandRadius(a: number, scale = 1): number {
  return ISLAND_RADIUS * scale * (1 + 0.06 * Math.sin(3 * a + 0.5) + 0.04 * Math.sin(5 * a + 2) + 0.025 * Math.sin(8 * a + 1));
}

function islandShape(scale: number): THREE.Shape {
  const shape = new THREE.Shape();
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = islandRadius(a, scale);
    // shape nằm trên mặt XY; geo.rotateX(-90°) biến (x, y) → thế giới (x, z = -y).
    // Đặt y = -sin·r để điểm thế giới là (cos·r, sin·r) — khớp islandRadius(atan2(z, x)).
    const x = Math.cos(a) * r;
    const y = -Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

/** Khối đảo: mặt trên ở y = top, đùn xuống `depth`. */
function slab(scale: number, top: number, depth: number, bevel: number, color: string): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(islandShape(scale), {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  mesh.position.y = top - depth - bevel;
  mesh.receiveShadow = true;
  return mesh;
}

export function skyTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#4fb8ff');
  grad.addColorStop(0.55, '#a8e4ff');
  grad.addColorStop(1, '#e9fbff');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Biển: gần đảo xanh ngọc trong, ra xa xanh thẫm, có gợn lấp lánh. */
export function seaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color('#5ff2e2') },
      uMid: { value: new THREE.Color('#22c3ea') },
      uDeep: { value: new THREE.Color('#1478d4') },
      uR: { value: ISLAND_RADIUS },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uSparkle: { value: 0.22 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform float uR;
      uniform vec3 uTint; uniform float uSparkle;
      varying vec2 vPos;
      void main() {
        float d = length(vPos);
        vec3 col = mix(uShallow, uMid, smoothstep(uR * 1.05, uR * 1.7, d));
        col = mix(col, uDeep, smoothstep(uR * 1.7, uR * 4.0, d));
        // gợn sóng lấp lánh
        float w = sin(vPos.x * 0.9 + uTime * 1.3) * sin(vPos.y * 0.8 - uTime * 1.1)
                + sin((vPos.x + vPos.y) * 0.45 + uTime * 0.7);
        col = col * uTint + smoothstep(1.35, 1.9, w) * uSparkle;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Vật liệu mây dùng chung — ngày–đêm chỉnh độ tự sáng. */
export const cloudMaterial = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#dff4ff', emissiveIntensity: 0.35 });

function cloud(rnd: () => number): THREE.Group {
  const g = new THREE.Group();
  const mat = cloudMaterial;
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.6 + rnd() * 1.6, 14, 10), mat);
    s.position.set(i * 2.2 - n, rnd() * 0.8, (rnd() - 0.5) * 2);
    s.scale.y = 0.75;
    g.add(s);
  }
  return g;
}

/** Đèn lồng đỏ trên cột gỗ (dùng khi chưa có ảnh vẽ). Phần đèn tên 'lanternLamp' để ngày–đêm cho phát sáng. */
function proceduralLantern(size: number): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: '#6e4120' });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, size, 6), wood);
  pole.position.y = size / 2;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), wood);
  arm.position.set(0.22, size * 0.95, 0);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#e0321e', emissive: '#ff7a2a', emissiveIntensity: 0.2, roughness: 0.6 }),
  );
  lamp.name = 'lanternLamp';
  lamp.scale.y = 1.25;
  lamp.position.set(0.42, size * 0.95 - 0.32, 0);
  g.add(pole, arm, lamp);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

/** Đồ trang trí: sprite tranh vẽ nếu có, không thì model GLB tô lại màu cho rực rỡ. */
type DecorKind = 'sakura' | 'gold' | 'palm' | 'mushrooms' | 'flowers' | 'lantern' | 'rocks';

function decor(kind: DecorKind, size: number): THREE.Object3D {
  const spriteIds: Record<DecorKind, string> = {
    sakura: 'tree_sakura', gold: 'tree_gold', palm: 'tree_palm', mushrooms: 'mushrooms',
    flowers: 'flowers', lantern: 'lantern', rocks: 'rocks',
  };
  const sprite = makeSprite(spriteIds[kind], size);
  if (sprite) {
    const g = new THREE.Group();
    g.add(blobShadow(size * 0.28), sprite);
    return g;
  }
  if (kind === 'lantern') return proceduralLantern(size);
  const glb: Record<DecorKind, [ModelKey, 'height' | 'max']> = {
    sakura: ['tree', 'height'], gold: ['autumnTree', 'height'], palm: ['tree2', 'height'],
    mushrooms: ['bushBerries', 'max'], flowers: ['flowers', 'max'], lantern: ['bushFlowers', 'max'], rocks: ['rock', 'max'],
  };
  const [key, fit] = glb[kind];
  const obj = spawn(key, size * (fit === 'height' ? 1 : 0.5), fit);
  if (kind === 'sakura') tintByName(obj, { Green: '#ff9fd0', Wood: '#7a4a3a' });
  if (kind === 'gold') tintByName(obj, { Orange: '#ffc83d', LightOrange: '#ffe066' });
  if (kind === 'palm') tintByName(obj, { Green: '#4fd35a' });
  if (kind === 'mushrooms') tintByName(obj, { Green: '#46c94f', Berry: '#4aa8ff' });
  return obj;
}

export class IslandScenery {
  readonly sea: THREE.ShaderMaterial;
  /** vị trí (mặt đất) các cây anh đào, mọi cây, đèn lồng — cho cánh hoa, đom đóm, ánh đèn */
  readonly sakuraSpots: THREE.Vector3[] = [];
  readonly treeSpots: THREE.Vector3[] = [];
  readonly lanternSpots: THREE.Vector3[] = [];
  /** phần đèn lồng (mesh) để bật sáng ban đêm */
  readonly lanternLamps: THREE.Mesh[] = [];
  private foam: THREE.Mesh;
  private clouds: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    scene.background = skyTexture();
    scene.fog = new THREE.Fog('#bfeeff', 90, 240);

    // biển
    this.sea = seaMaterial();
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), this.sea);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.9;
    scene.add(sea);

    // đảo: vách đất ← bãi cát ← cỏ
    scene.add(slab(1.12, -0.95, 5, 0.6, '#b88a5a'));
    scene.add(slab(1.09, -0.55, 0.3, 0.35, '#ffe2a1'));
    scene.add(slab(1.0, 0, 0.5, 0.35, '#7fdc4f'));

    // bọt sóng quanh bãi cát
    const ringGeo = new THREE.RingGeometry(0.5, 1, 96);
    const pos = ringGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const a = Math.atan2(-y, x);
      const outer = Math.hypot(x, y) > 0.75;
      const r = islandRadius(a, outer ? 1.2 : 1.12);
      pos.setXY(i, Math.cos(a) * r, -Math.sin(a) * r);
    }
    this.foam = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }),
    );
    (this.foam.material as THREE.MeshBasicMaterial).userData.unlit = true; // tối theo giờ
    this.foam.rotation.x = -Math.PI / 2;
    this.foam.position.y = -0.85;
    scene.add(this.foam);

    const rnd = seeded(11);

    // cây cối ở viền đảo (ngoài vùng xây dựng)
    const ring: [DecorKind, number][] = [
      ['sakura', 4.2], ['gold', 3.8], ['sakura', 3.6], ['palm', 4.5], ['mushrooms', 1.4],
      ['flowers', 1.2], ['lantern', 2.2], ['rocks', 1.3], ['flowers', 1.1],
    ];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + rnd() * 0.1;
      const r = islandRadius(a) - 1.4 - rnd() * 2.2;
      const [kind, size] = ring[Math.floor(rnd() * ring.length)];
      const obj = decor(kind, size * (0.85 + rnd() * 0.35));
      obj.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      obj.rotation.y = rnd() * Math.PI * 2;
      scene.add(obj);
      const spot = obj.position.clone();
      if (kind === 'sakura') this.sakuraSpots.push(spot);
      if (kind === 'sakura' || kind === 'gold' || kind === 'palm') this.treeSpots.push(spot);
      if (kind === 'lantern') {
        this.lanternSpots.push(spot);
        const lamp = obj.getObjectByName('lanternLamp') as THREE.Mesh | undefined;
        if (lamp) this.lanternLamps.push(lamp);
      }
    }

    // đảo nhỏ xung quanh
    for (const [a, d, s] of [[0.4, 31, 3.2], [2.3, 33, 2.4], [4.1, 30, 2.8], [5.4, 36, 2]] as const) {
      const g = new THREE.Group();
      const sand = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 1.25, 1.2, 20), new THREE.MeshLambertMaterial({ color: '#ffe2a1' }));
      sand.position.y = -0.7;
      const grass = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.8, s, 0.4, 20), new THREE.MeshLambertMaterial({ color: '#7fdc4f' }));
      grass.position.y = -0.05;
      g.add(sand, grass, decor(a > 3 ? 'palm' : 'sakura', 3.4));
      g.position.set(Math.cos(a) * d, 0, -Math.sin(a) * d);
      scene.add(g);
    }

    // mây
    for (let i = 0; i < 7; i++) {
      const c = cloud(rnd);
      const a = rnd() * Math.PI * 2;
      const d = 45 + rnd() * 40;
      c.position.set(Math.cos(a) * d, 18 + rnd() * 14, Math.sin(a) * d);
      c.userData.speed = 0.4 + rnd() * 0.6;
      scene.add(c);
      this.clouds.push(c);
    }
  }

  update(dt: number, t: number): void {
    this.sea.uniforms.uTime.value = t;
    (this.foam.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 1.5) * 0.15;
    this.foam.scale.setScalar(1 + Math.sin(t * 1.5) * 0.008);
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 110) c.position.x = -110;
    }
  }
}
