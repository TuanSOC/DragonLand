// Hệ hạt dùng chung: lửa, khói, nước, đá, lá, bụi, lấp lánh. Mỗi lớp = 1 draw call (THREE.Points).
import * as THREE from 'three';
import type { Element } from '../data/elements';

export type ParticleKind = 'fire' | 'smoke' | 'water' | 'earth' | 'plant' | 'dust' | 'sparkle' | 'heart' | 'crumb';

interface KindSpec {
  additive: boolean;
  /** màu đầu → màu cuối đời */
  from: THREE.Color;
  to: THREE.Color;
  life: [number, number];
  size: [number, number]; // đầu → cuối
  speed: number;
  gravity: number; // dương = rơi xuống
  drag: number;
  flutter?: number; // lá bay lượn
  /** 1 = vẽ hình trái tim thay vì chấm tròn */
  shape?: number;
}

const C = (hex: string) => new THREE.Color(hex);

const KINDS: Record<ParticleKind, KindSpec> = {
  fire: { additive: true, from: C('#ffc94a'), to: C('#c2280a'), life: [0.45, 0.75], size: [0.55, 1.2], speed: 7, gravity: -2, drag: 1.5 },
  smoke: { additive: false, from: C('#8a8a8a'), to: C('#3a3a3a'), life: [0.9, 1.4], size: [0.5, 1.6], speed: 2.5, gravity: -1.5, drag: 1 },
  water: { additive: false, from: C('#dff7ff'), to: C('#2f8cff'), life: [0.5, 0.8], size: [0.35, 0.2], speed: 7, gravity: 9, drag: 0.5 },
  earth: { additive: false, from: C('#d9b27a'), to: C('#6b4a2a'), life: [0.6, 0.9], size: [0.35, 0.3], speed: 6, gravity: 12, drag: 0.3 },
  plant: { additive: false, from: C('#c8ff7a'), to: C('#2fa83a'), life: [0.9, 1.4], size: [0.35, 0.3], speed: 5, gravity: 1.5, drag: 1.2, flutter: 3 },
  dust: { additive: false, from: C('#f6e7c6'), to: C('#c9b48a'), life: [0.5, 0.9], size: [0.6, 1.4], speed: 2.6, gravity: -0.3, drag: 2.5 },
  sparkle: { additive: true, from: C('#fff8c0'), to: C('#ffb300'), life: [0.4, 0.8], size: [0.3, 0.05], speed: 2, gravity: -0.5, drag: 1 },
  heart: { additive: false, from: C('#ff6fae'), to: C('#ff2f7a'), life: [1.0, 1.5], size: [0.95, 0.6], speed: 1.6, gravity: -1.4, drag: 1.5, flutter: 2, shape: 1 },
  crumb: { additive: false, from: C('#e0a060'), to: C('#8a5a2b'), life: [0.5, 0.8], size: [0.18, 0.14], speed: 3, gravity: 10, drag: 0.4 },
};

/** Hơi thở theo hệ: [loại hạt chính, loại phụ (hoặc null)] */
const BREATH: Record<Element, [ParticleKind, ParticleKind | null]> = {
  fire: ['fire', 'smoke'],
  water: ['water', null],
  earth: ['earth', 'dust'],
  plant: ['plant', null],
};

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aShape;
  uniform float uScale;
  uniform float uGain;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vShape;
  void main() {
    vShape = aShape;
    vAlpha = aAlpha * uGain;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vShape;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.15, d) * vAlpha;
    if (vShape > 0.5) {
      // trái tim (công thức cực của Inigo Quilez), toạ độ y hướng lên
      vec2 p = (gl_PointCoord - 0.5) * vec2(2.2, -2.2);
      p.y += 0.3;
      float ang = abs(atan(p.x, p.y) / 3.141593);
      float r = length(p);
      float hd = (13.0 * ang - 22.0 * ang * ang + 10.0 * ang * ang * ang) / (6.0 - 5.0 * ang);
      a = smoothstep(hd, hd - 0.12, r) * vAlpha;
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }`;

const _color = new THREE.Color();

class Layer {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private shape: Float32Array;
  private vel: Float32Array;
  private life: Float32Array; // còn lại
  private max: Float32Array; // tổng
  private kind: (KindSpec | null)[];
  private cursor = 0;

  constructor(private capacity: number, additive: boolean, uScale: { value: number }) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.shape = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity);
    this.kind = new Array(capacity).fill(null);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1));
    const mat = new THREE.ShaderMaterial({
      // lớp cộng sáng chồng nhiều hạt dễ "cháy trắng" → giảm độ đậm
      uniforms: { uScale, uGain: { value: additive ? 0.5 : 1 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  spawn(spec: KindSpec, x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity; // vòng tròn: hết chỗ thì ghi đè hạt cũ nhất
    const j = i * 3;
    this.pos[j] = x;
    this.pos[j + 1] = y;
    this.pos[j + 2] = z;
    this.vel[j] = vx;
    this.vel[j + 1] = vy;
    this.vel[j + 2] = vz;
    const life = spec.life[0] + Math.random() * (spec.life[1] - spec.life[0]);
    this.life[i] = life;
    this.max[i] = life;
    this.kind[i] = spec;
    this.shape[i] = spec.shape ?? 0;
  }

  update(dt: number, t: number): void {
    const c = _color;
    for (let i = 0; i < this.capacity; i++) {
      const spec = this.kind[i];
      if (!spec) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.kind[i] = null;
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      const k = 1 - this.life[i] / this.max[i]; // 0 → 1 theo tuổi
      const j = i * 3;
      const damp = Math.max(0, 1 - spec.drag * dt);
      this.vel[j] *= damp;
      this.vel[j + 2] *= damp;
      this.vel[j + 1] = this.vel[j + 1] * damp - spec.gravity * dt;
      const fl = spec.flutter ? Math.sin(t * spec.flutter + i) * 0.8 : 0;
      this.pos[j] += (this.vel[j] + fl) * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] < 0.02 && spec.gravity > 0) {
        this.pos[j + 1] = 0.02; // nằm trên mặt đất
        this.vel[j] *= 0.6;
        this.vel[j + 2] *= 0.6;
      }
      c.copy(spec.from).lerp(spec.to, k);
      this.col[j] = c.r;
      this.col[j + 1] = c.g;
      this.col[j + 2] = c.b;
      this.size[i] = spec.size[0] + (spec.size[1] - spec.size[0]) * k;
      this.alpha[i] = Math.min(1, (1 - k) * 1.6) * Math.min(1, k * 8 + 0.2);
    }
    const g = this.points.geometry;
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha', 'aShape']) g.getAttribute(name).needsUpdate = true;
  }
}

interface Stream {
  kinds: ParticleKind[];
  origin: () => THREE.Vector3;
  dir: () => THREE.Vector3;
  left: number;
  rate: number;
  acc: number;
}

export class ParticleSystem {
  private uScale = { value: 600 };
  private add: Layer;
  private normal: Layer;
  private streams: Stream[] = [];
  private time = 0;

  constructor(scene: THREE.Scene, capacity = 600) {
    this.add = new Layer(Math.ceil(capacity / 2), true, this.uScale);
    this.normal = new Layer(Math.ceil(capacity / 2), false, this.uScale);
    scene.add(this.add.points, this.normal.points);
  }

  /** Gọi khi đổi kích thước canvas: cỡ hạt tính theo chiều cao màn hình. */
  resize(heightPx: number, fovDeg: number): void {
    this.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  /** Bắn một chùm hạt. `dir` = hướng chính; không có thì toả đều. */
  burst(kind: ParticleKind, origin: THREE.Vector3, count: number, dir?: THREE.Vector3, spread = 0.35): void {
    const spec = KINDS[kind];
    const layer = spec.additive ? this.add : this.normal;
    for (let n = 0; n < count; n++) {
      let vx: number, vy: number, vz: number;
      const s = spec.speed * (0.6 + Math.random() * 0.6);
      if (dir) {
        vx = (dir.x + (Math.random() - 0.5) * spread * 2) * s;
        vy = (dir.y + (Math.random() - 0.5) * spread * 2) * s;
        vz = (dir.z + (Math.random() - 0.5) * spread * 2) * s;
      } else {
        const a = Math.random() * Math.PI * 2;
        vx = Math.cos(a) * s;
        vz = Math.sin(a) * s;
        vy = kind === 'dust' ? Math.random() * 0.6 : (Math.random() - 0.3) * s;
      }
      layer.spawn(spec, origin.x, origin.y, origin.z, vx, vy, vz);
    }
  }

  /** Luồng hơi thở kéo dài `duration` giây; origin/dir là hàm để bám theo rồng đang di chuyển. */
  breath(elements: Element[], origin: () => THREE.Vector3, dir: () => THREE.Vector3, duration: number): void {
    const kinds = elements.flatMap((e) => BREATH[e].filter((k): k is ParticleKind => k !== null));
    this.streams.push({ kinds, origin, dir, left: duration, rate: 70, acc: 0 });
  }

  /** Dừng mọi luồng hơi thở đang phun (vd. khi rời màn đấu). */
  clearStreams(): void {
    this.streams = [];
  }

  update(dt: number): void {
    this.time += dt;
    for (const s of this.streams) {
      s.left -= dt;
      s.acc += s.rate * dt;
      const o = s.origin();
      const d = s.dir();
      while (s.acc >= 1) {
        s.acc -= 1;
        const kind = s.kinds[Math.floor(Math.random() * s.kinds.length)];
        this.burst(kind, o, 1, d, 0.18);
      }
    }
    this.streams = this.streams.filter((s) => s.left > 0);
    this.add.update(dt, this.time);
    this.normal.update(dt, this.time);
  }
}
