// Sự sống trên đảo: cánh hoa anh đào rơi, bướm, hải âu, cá nhảy, bóng mây trôi, đom đóm ban đêm.
// Số lượng nhân theo hạng đồ hoạ (density). Mọi thứ đều nhẹ: vài draw call, không vật lý.
import * as THREE from 'three';
import type { IslandScenery } from './island';
import { ISLAND_RADIUS } from './island';
import type { ParticleSystem } from './particles';

function softDot(inner: string, outer: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Điểm bay lượn trong khối đặt trước, mỗi điểm có quỹ đạo riêng (cánh hoa, đom đóm). */
class Drifters {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private seed: Float32Array;

  constructor(
    count: number,
    material: THREE.PointsMaterial,
    private spawn: (out: THREE.Vector3) => void,
    private step: (p: Float32Array, j: number, seed: number, dt: number, t: number) => boolean,
  ) {
    this.pos = new Float32Array(count * 3);
    this.seed = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      spawn(v);
      this.pos.set([v.x, v.y * Math.random(), v.z], i * 3);
      this.seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(geo, material);
    this.points.frustumCulled = false;
  }

  update(dt: number, t: number): void {
    const v = new THREE.Vector3();
    for (let i = 0; i < this.seed.length; i++) {
      const j = i * 3;
      if (!this.step(this.pos, j, this.seed[i], dt, t)) {
        this.spawn(v);
        this.pos[j] = v.x;
        this.pos[j + 1] = v.y;
        this.pos[j + 2] = v.z;
      }
    }
    this.points.geometry.getAttribute('position').needsUpdate = true;
  }
}

const _dir = new THREE.Vector3();

class Butterfly {
  readonly group = new THREE.Group();
  private wings: THREE.Mesh[] = [];
  private target = new THREE.Vector3();
  private phase = Math.random() * 10;

  constructor(color: THREE.ColorRepresentation) {
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true });
    for (const side of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(0.28, 0.22).translate(0.14 * side, 0, 0);
      const w = new THREE.Mesh(geo, mat);
      w.rotation.x = -Math.PI / 2;
      this.wings.push(w);
      this.group.add(w);
    }
    this.pickTarget();
    this.group.position.copy(this.target);
  }

  private pickTarget(): void {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (ISLAND_RADIUS - 4);
    this.target.set(Math.cos(a) * r, rand(0.6, 2.2), Math.sin(a) * r);
  }

  update(dt: number, t: number): void {
    const p = this.group.position;
    const d = _dir.copy(this.target).sub(p);
    if (d.length() < 0.3) this.pickTarget();
    d.normalize();
    p.addScaledVector(d, dt * 1.3);
    p.y += Math.sin(t * 6 + this.phase) * dt * 0.6; // nhấp nhô
    this.group.rotation.y = Math.atan2(d.x, d.z);
    const flap = Math.sin(t * 22 + this.phase) * 1.1;
    this.wings[0].rotation.y = flap;
    this.wings[1].rotation.y = -flap;
  }
}

class Gull {
  readonly group = new THREE.Group();
  private wingL: THREE.Mesh;
  private wingR: THREE.Mesh;
  private a = Math.random() * Math.PI * 2;
  private r = rand(24, 36);
  private h = rand(13, 18);
  private speed = rand(0.12, 0.2) * (Math.random() < 0.5 ? 1 : -1);
  private phase = Math.random() * 10;

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: '#f4f6fb', side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(1.1, 0.28);
    this.wingL = new THREE.Mesh(geo.clone().translate(-0.55, 0, 0), mat);
    this.wingR = new THREE.Mesh(geo.clone().translate(0.55, 0, 0), mat);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat);
    body.scale.z = 2.2;
    this.group.add(this.wingL, this.wingR, body);
  }

  update(dt: number, t: number): void {
    this.a += this.speed * dt;
    const x = Math.cos(this.a) * this.r;
    const z = Math.sin(this.a) * this.r;
    this.group.position.set(x, this.h + Math.sin(t * 0.7 + this.phase) * 0.8, z);
    // hướng bay = tiếp tuyến vòng tròn
    this.group.rotation.y = Math.atan2(-Math.sin(this.a) * Math.sign(this.speed), Math.cos(this.a) * Math.sign(this.speed)) + Math.PI / 2;
    const flap = Math.sin(t * 5 + this.phase) * 0.5 + 0.15;
    this.wingL.rotation.z = flap;
    this.wingR.rotation.z = -flap;
  }
}

export class Ambient {
  private petals: Drifters | null = null;
  private fireflies: Drifters;
  private butterflies: Butterfly[] = [];
  private gulls: Gull[] = [];
  private cloudShadows: THREE.Mesh[] = [];
  private fish: THREE.Mesh;
  private fishJump = { t: 0, dur: 1.1, from: new THREE.Vector3(), to: new THREE.Vector3(), active: false, next: rand(3, 7) };
  private group = new THREE.Group();

  constructor(scene: THREE.Scene, scenery: IslandScenery, private particles: ParticleSystem, density: number) {
    scene.add(this.group);
    const n = (x: number) => Math.max(1, Math.round(x * density));

    // cánh hoa anh đào rơi quanh các cây anh đào
    const sakura = scenery.sakuraSpots;
    if (sakura.length) {
      this.petals = new Drifters(
        n(90),
        new THREE.PointsMaterial({ map: softDot('rgba(255,200,225,1)', 'rgba(255,170,205,0)'), size: 0.28, transparent: true, depthWrite: false, color: '#ffd0e4' }),
        (out) => {
          const s = sakura[Math.floor(Math.random() * sakura.length)];
          out.set(s.x + rand(-1.6, 1.6), rand(2.4, 4.2), s.z + rand(-1.6, 1.6));
        },
        (p, j, seed, dt, t) => {
          p[j] += (Math.sin(t * 1.3 + seed) * 0.5 + 0.35) * dt; // gió nhẹ
          p[j + 1] -= (0.45 + (seed % 1) * 0.3) * dt;
          p[j + 2] += Math.cos(t * 1.1 + seed) * 0.4 * dt;
          return p[j + 1] > 0.03;
        },
      );
      this.group.add(this.petals.points);
    }

    // đom đóm quanh cây (chỉ hiện ban đêm)
    const trees = scenery.treeSpots.length ? scenery.treeSpots : [new THREE.Vector3()];
    this.fireflies = new Drifters(
      n(45),
      new THREE.PointsMaterial({
        map: softDot('rgba(230,255,140,1)', 'rgba(180,255,80,0)'), size: 0.35, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, color: '#e8ff9a',
      }),
      (out) => {
        const s = trees[Math.floor(Math.random() * trees.length)];
        out.set(s.x + rand(-2.5, 2.5), rand(0.5, 2.6), s.z + rand(-2.5, 2.5));
      },
      (p, j, seed, dt, t) => {
        p[j] += Math.sin(t * 0.8 + seed) * 0.5 * dt;
        p[j + 1] += Math.sin(t * 1.3 + seed * 2) * 0.25 * dt;
        p[j + 2] += Math.cos(t * 0.7 + seed) * 0.5 * dt;
        return true;
      },
    );
    this.group.add(this.fireflies.points);

    const colors = ['#ffd84a', '#ff8fc8', '#8fd8ff', '#ffffff', '#ffb35a'];
    for (let i = 0; i < n(8); i++) {
      const b = new Butterfly(colors[i % colors.length]);
      this.butterflies.push(b);
      this.group.add(b.group);
    }
    for (let i = 0; i < n(3); i++) {
      const g = new Gull();
      this.gulls.push(g);
      this.group.add(g.group);
    }

    // bóng mây trôi trên đảo
    const shadowTex = softDot('rgba(20,40,30,0.55)', 'rgba(20,40,30,0)');
    for (let i = 0; i < n(3); i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.35 }),
      );
      m.rotation.x = -Math.PI / 2;
      const s = rand(14, 24);
      m.scale.set(s, s * rand(0.5, 0.8), 1);
      m.position.set(rand(-40, 40), 0.06, rand(-14, 14));
      m.userData.speed = rand(0.6, 1.2);
      this.cloudShadows.push(m);
      this.group.add(m);
    }

    this.fish = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshLambertMaterial({ color: '#ff8a3c' }));
    this.fish.scale.set(0.6, 0.7, 1.6);
    this.fish.visible = false;
    this.group.add(this.fish);
  }

  /** nightness: 0 ngày → 1 đêm */
  update(dt: number, t: number, nightness: number): void {
    const day = 1 - nightness;
    this.petals?.update(dt, t);
    this.fireflies.update(dt, t);
    const ff = this.fireflies.points.material as THREE.PointsMaterial;
    ff.opacity = nightness * (0.65 + Math.sin(t * 3) * 0.35);
    this.fireflies.points.visible = nightness > 0.05;

    for (const b of this.butterflies) {
      b.group.visible = day > 0.4;
      if (b.group.visible) b.update(dt, t);
    }
    for (const g of this.gulls) {
      g.group.visible = day > 0.3;
      if (g.group.visible) g.update(dt, t);
    }
    for (const m of this.cloudShadows) {
      m.position.x += m.userData.speed * dt;
      if (m.position.x > 45) m.position.x = -45;
      (m.material as THREE.MeshBasicMaterial).opacity = 0.35 * day;
    }
    this.updateFish(dt);
  }

  private updateFish(dt: number): void {
    const j = this.fishJump;
    if (!j.active) {
      j.next -= dt;
      if (j.next > 0) return;
      const a = Math.random() * Math.PI * 2;
      const r = rand(ISLAND_RADIUS + 5, ISLAND_RADIUS + 12);
      j.from.set(Math.cos(a) * r, -0.9, Math.sin(a) * r);
      const a2 = a + rand(-0.08, 0.08);
      j.to.set(Math.cos(a2) * (r + rand(-2, 2)), -0.9, Math.sin(a2) * (r + rand(-2, 2)));
      j.t = 0;
      j.active = true;
      this.fish.visible = true;
      this.particles.burst('water', j.from.clone().setY(-0.7), 10, new THREE.Vector3(0, 1, 0), 0.5);
      return;
    }
    j.t += dt;
    const k = Math.min(1, j.t / j.dur);
    this.fish.position.lerpVectors(j.from, j.to, k);
    this.fish.position.y = -0.9 + Math.sin(k * Math.PI) * 2.2;
    this.fish.lookAt(j.to.x, -0.9 + Math.cos(k * Math.PI) * 2.2, j.to.z);
    if (k >= 1) {
      j.active = false;
      j.next = rand(4, 9);
      this.fish.visible = false;
      this.particles.burst('water', j.to.clone().setY(-0.7), 12, new THREE.Vector3(0, 1, 0), 0.6);
    }
  }
}
