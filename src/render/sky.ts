// Ngày – đêm theo giờ máy: nội suy giữa các mốc (rạng đông, bình minh, ngày, nắng vàng, hoàng hôn, chạng vạng, đêm)
// rồi áp lên trời, mặt trời/trăng, ánh sáng bầu trời, sương, biển, sprite "không chịu sáng", sao, đèn lồng.
import * as THREE from 'three';
import { cloudMaterial, type IslandScenery } from './island';
import { sceneLight } from './sprites';

interface Key {
  h: number;
  skyTop: string;
  skyBottom: string;
  sun: string;
  sunI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  fog: string;
  sea: string;
  /** màu nhân cho sprite/rồng tranh vẽ */
  light: string;
  stars: number;
  lantern: number;
}

const NIGHT: Omit<Key, 'h'> = {
  skyTop: '#0b1440', skyBottom: '#24356e', sun: '#9fb4ff', sunI: 0.55, hemiSky: '#4a5a9a', hemiGround: '#1a2a1a', hemiI: 0.6,
  fog: '#1a2550', sea: '#4a64a0', light: '#7d8cc0', stars: 1, lantern: 1,
};

const KEYS: Key[] = [
  { h: 0, ...NIGHT },
  { h: 5, skyTop: '#26305e', skyBottom: '#8a6aa0', sun: '#ffb08a', sunI: 0.7, hemiSky: '#8a7ab0', hemiGround: '#3a3a2a', hemiI: 0.8, fog: '#8a7aa0', sea: '#9aa0c8', light: '#b0a8c8', stars: 0.5, lantern: 0.8 },
  { h: 6.5, skyTop: '#5aa0e0', skyBottom: '#ffc08a', sun: '#ffc58a', sunI: 1.8, hemiSky: '#ffd8b0', hemiGround: '#5a7a3a', hemiI: 1.2, fog: '#ffd0a8', sea: '#e8e0d8', light: '#ffe6cc', stars: 0, lantern: 0.15 },
  { h: 8, skyTop: '#4fb8ff', skyBottom: '#e9fbff', sun: '#fff3dc', sunI: 2.6, hemiSky: '#ffffff', hemiGround: '#5a7a3a', hemiI: 1.5, fog: '#bfeeff', sea: '#ffffff', light: '#ffffff', stars: 0, lantern: 0 },
  { h: 17, skyTop: '#5aaef0', skyBottom: '#ffe2a8', sun: '#ffd890', sunI: 2.3, hemiSky: '#fff0d0', hemiGround: '#6a7a3a', hemiI: 1.4, fog: '#ffe8c0', sea: '#fff4e0', light: '#fff4e0', stars: 0, lantern: 0 },
  { h: 18.5, skyTop: '#3a5aa8', skyBottom: '#ff9a6a', sun: '#ff9a5a', sunI: 1.6, hemiSky: '#ffb890', hemiGround: '#5a4a3a', hemiI: 1.1, fog: '#ffb090', sea: '#f0c0b0', light: '#ffd6bc', stars: 0.1, lantern: 0.5 },
  { h: 19.5, skyTop: '#1e2a6a', skyBottom: '#8a4a8a', sun: '#c08ad0', sunI: 0.8, hemiSky: '#8a6ab0', hemiGround: '#2a2a3a', hemiI: 0.8, fog: '#5a4a7a', sea: '#8a8ab8', light: '#a898c8', stars: 0.6, lantern: 1 },
  { h: 21, ...NIGHT },
  { h: 24, ...NIGHT },
];

/** Bộ màu đã nội suy tại một giờ (Color ở không gian tuyến tính → nội suy mượt). */
interface Mood {
  skyTop: THREE.Color; skyBottom: THREE.Color; sun: THREE.Color; hemiSky: THREE.Color; hemiGround: THREE.Color;
  fog: THREE.Color; sea: THREE.Color; light: THREE.Color;
  sunI: number; hemiI: number; stars: number; lantern: number;
}

const COLOR_KEYS = ['skyTop', 'skyBottom', 'sun', 'hemiSky', 'hemiGround', 'fog', 'sea', 'light'] as const;
const NUM_KEYS = ['sunI', 'hemiI', 'stars', 'lantern'] as const;

export function moodAt(hour: number): Mood {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const k = (h - a.h) / (b.h - a.h);
  const out = {} as Mood;
  for (const c of COLOR_KEYS) out[c] = new THREE.Color(a[c]).lerp(new THREE.Color(b[c]), k);
  for (const n of NUM_KEYS) out[n] = a[n] + (b[n] - a[n]) * k;
  return out;
}

function glowTexture(inner: string, outer: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Số đèn lồng tối đa có PointLight thật (còn lại chỉ có quầng sáng) — giữ fps. */
const MAX_LANTERN_LIGHTS = 4;

export class DayNight {
  private override: number | null = null;
  private skyCanvas = document.createElement('canvas');
  private skyTex: THREE.CanvasTexture;
  private stars: THREE.Points;
  private moon: THREE.Sprite;
  private glows: THREE.Sprite[] = [];
  private lights: THREE.PointLight[] = [];
  private lastHour = -1;
  private mood: Mood = moodAt(12);

  constructor(
    private scene: THREE.Scene,
    private sun: THREE.DirectionalLight,
    private hemi: THREE.HemisphereLight,
    private scenery: IslandScenery,
    tier: 'high' | 'low',
  ) {
    this.skyCanvas.width = 2;
    this.skyCanvas.height = 256;
    this.skyTex = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    scene.background = this.skyTex;

    // sao: điểm ngẫu nhiên trên nửa vòm trời
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = 0.12 + Math.random() * 0.88 * (Math.PI / 2);
      pos.set([Math.cos(a) * Math.cos(e) * 180, Math.sin(e) * 180, Math.sin(a) * Math.cos(e) * 180], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }),
    );
    scene.add(this.stars);

    this.moon = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,240,1)', 'rgba(200,220,255,0)'), transparent: true, depthWrite: false, fog: false }),
    );
    this.moon.scale.setScalar(22);
    scene.add(this.moon);

    // đèn lồng: quầng sáng cho mọi đèn, PointLight cho vài đèn (tắt hẳn ở hạng thấp)
    const glowTex = glowTexture('rgba(255,170,80,0.9)', 'rgba(255,120,40,0)');
    scenery.lanternSpots.forEach((p, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.set(p.x + 0.4, 1.8, p.z);
      s.scale.setScalar(3);
      scene.add(s);
      this.glows.push(s);
      if (tier === 'high' && i < MAX_LANTERN_LIGHTS) {
        const l = new THREE.PointLight('#ffa050', 0, 9, 1.6);
        l.position.set(p.x + 0.4, 1.8, p.z);
        scene.add(l);
        this.lights.push(l);
      }
    });
  }

  /** Dev: xem trước một giờ cố định (null = theo giờ máy). */
  setHour(h: number | null): void {
    this.override = h;
    this.lastHour = -1;
  }

  get hour(): number {
    if (this.override !== null) return this.override;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  get isNight(): boolean {
    return this.mood.stars > 0.5;
  }

  /** Mức đêm 0..1 (để sinh vật khác dùng: đom đóm, bóng mây…) */
  get nightness(): number {
    return this.mood.stars;
  }

  /** Gọi vài lần mỗi giây là đủ — màu trời đổi chậm. */
  update(): void {
    const hour = this.hour;
    if (Math.abs(hour - this.lastHour) < 0.01) return;
    this.lastHour = hour;
    const m = (this.mood = moodAt(hour));

    // trời: gradient trên → dưới
    const g = this.skyCanvas.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, `#${m.skyTop.getHexString()}`);
    grad.addColorStop(1, `#${m.skyBottom.getHexString()}`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
    this.skyTex.needsUpdate = true;
    (this.scene.fog as THREE.Fog).color.copy(m.fog);

    // mặt trời (ngày) / trăng (đêm) chạy theo cung
    const dayK = (hour - 6) / 12; // 0 lúc 6h → 1 lúc 18h
    const isDay = dayK > 0 && dayK < 1;
    const arc = isDay ? dayK : ((hour + 6) % 24) / 12; // trăng 18h → 6h
    const elev = Math.max(0.25, Math.sin(arc * Math.PI));
    const az = arc * Math.PI;
    this.sun.position.set(Math.cos(az) * 30, elev * 35, Math.sin(az) * 18 + 6);
    this.sun.color.copy(m.sun);
    this.sun.intensity = m.sunI;
    this.hemi.color.copy(m.hemiSky);
    this.hemi.groundColor.copy(m.hemiGround);
    this.hemi.intensity = m.hemiI;
    this.moon.position.set(-Math.cos(az) * 150, 40 + elev * 60, -Math.sin(az) * 90 - 40);
    this.moon.material.opacity = m.stars;
    this.moon.visible = m.stars > 0.02;
    (this.stars.material as THREE.PointsMaterial).opacity = m.stars;
    this.stars.visible = m.stars > 0.02;

    cloudMaterial.emissiveIntensity = 0.35 * (1 - m.stars * 0.85);

    // biển
    const sea = this.scenery.sea.uniforms;
    sea.uTint.value.copy(m.sea);
    sea.uSparkle.value = 0.22 * (1 - m.stars * 0.75);

    // đèn lồng
    for (const s of this.glows) {
      s.material.opacity = m.lantern;
      s.visible = m.lantern > 0.02;
    }
    for (const l of this.lights) l.intensity = m.lantern * 14;
    for (const lamp of this.scenery.lanternLamps) {
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + m.lantern * 2.2;
    }

    // sprite & rồng tranh vẽ không chịu ánh sáng cảnh → tô theo màu trời
    sceneLight.copy(m.light);
    this.scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (!mat || Array.isArray(mat)) return;
      if (mat.userData.unlit) (mat as THREE.SpriteMaterial).color.copy(m.light);
      else if (mat.userData.unlitUniform) (mat as THREE.ShaderMaterial).uniforms.uLight.value.copy(m.light);
    });
  }
}
