// Thế giới 3D của đảo: đọc GameState và dựng/cập nhật mesh tương ứng.
// Không thay đổi state — chỉ hiển thị.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CROPS } from '../data/balance';
import { SPECIES } from '../data/dragons';
import { ELEMENT_INFO, type Element } from '../data/elements';
import { habitatCap, habitatGold } from '../logic/economy';
import { FOOTPRINT, GRID_SIZE } from '../logic/grid';
import {
  dragonsIn,
  timerDone,
  timerProgress,
  timerRemainingMs,
  type Building,
  type GameState,
} from '../logic/state';
import { fmtTime } from '../ui/format';
import { spawn, tintAll, tintByName } from './assets';
import { DragonHerd } from './herd';
import { IslandScenery, islandRadius } from './island';
import { ParticleSystem } from './particles';
import { makeSprite } from './sprites';

export const CELL = 2;

/** Tâm (thế giới) của công trình có góc trên-trái ở ô (x, z). */
export function cellToWorld(x: number, z: number, size: number): THREE.Vector3 {
  return new THREE.Vector3((x + size / 2 - GRID_SIZE / 2) * CELL, 0, (z + size / 2 - GRID_SIZE / 2) * CELL);
}

/** Ô góc trên-trái để công trình kích thước `size` nằm giữa quanh điểm p. */
export function worldToCell(p: THREE.Vector3, size: number): { x: number; z: number } {
  return {
    x: Math.round(p.x / CELL + GRID_SIZE / 2 - size / 2),
    z: Math.round(p.z / CELL + GRID_SIZE / 2 - size / 2),
  };
}

const PLATFORM_COLOR: Record<Element, string> = {
  fire: '#7a3b2a',
  water: '#4f8fb3',
  earth: '#9a7448',
  plant: '#5d9c3a',
};

/** Chiều rộng sprite công trình (vừa với ô lưới). */
const SPRITE_WIDTH: Record<Building['type'], number> = { habitat: 4.6, hatchery: 4.4, breeding: 6.4, farm: 4.2 };

function place(obj: THREE.Object3D, x: number, y: number, z: number, rotY = 0): THREE.Object3D {
  obj.position.set(x, y, z);
  obj.rotation.y = rotY;
  return obj;
}

/** Mô hình công trình (phần tĩnh). */
export function buildingModel(type: Building['type'], element?: Element): THREE.Group {
  const g = new THREE.Group();
  const sprite = makeSprite(type === 'habitat' ? `habitat_${element}` : type, SPRITE_WIDTH[type], { byWidth: true, anchorY: 0.04 });
  if (sprite) {
    g.add(sprite);
    g.userData.sprite = true;
    g.userData.top = sprite.scale.y * 0.96;
  } else if (type === 'habitat' && element) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.95, 0.35, 28),
      new THREE.MeshStandardMaterial({ color: PLATFORM_COLOR[element], roughness: 0.9 }),
    );
    base.position.y = 0.175;
    base.receiveShadow = true;
    g.add(base);
    const top = 0.35;
    if (element === 'fire') {
      const lava = new THREE.Mesh(
        new THREE.CircleGeometry(0.75, 20),
        new THREE.MeshStandardMaterial({ color: '#ff6a00', emissive: '#ff3300', emissiveIntensity: 1.2 }),
      );
      lava.rotation.x = -Math.PI / 2;
      lava.position.set(0.5, top + 0.01, 0.6);
      g.add(lava);
      const rock = spawn('rockLarge', 1.5);
      tintAll(rock, '#3b2a26');
      g.add(place(rock, -0.8, top, -0.7));
      const crystal = spawn('mineral', 1.0);
      tintByName(crystal, { Pink: '#ff7a1a', Grey: '#2a1d1a' });
      g.add(place(crystal, 0.9, top, -0.8, 0.6));
    } else if (element === 'water') {
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(1.25, 28),
        new THREE.MeshStandardMaterial({ color: '#39b4ff', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0.15, top + 0.01, 0.2);
      g.add(pool);
      g.add(place(spawn('rocks', 0.9), -1.1, top, -0.9));
      g.add(place(spawn('well', 1.3, 'height'), 1.05, top, -0.95, -0.5));
    } else if (element === 'earth') {
      g.add(place(spawn('rockLarge', 1.6), -0.6, top, -0.6));
      g.add(place(spawn('rocks', 1.0), 1.0, top, -0.4, 1.2));
      g.add(place(spawn('rock', 0.6), 0.9, top, 0.9));
    } else {
      g.add(place(spawn('tree', 2.6, 'height'), -0.8, top, -0.8));
      g.add(place(spawn('bushFlowers', 0.9), 1.0, top, -0.6));
      g.add(place(spawn('flowers', 0.7), 0.9, top, 1.0));
    }
  } else if (type === 'hatchery') {
    g.add(place(spawn('house', 3.2, 'max'), 0, 0, -0.4, Math.PI / 4));
    const nest = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.25, 8, 20),
      new THREE.MeshStandardMaterial({ color: '#a8743a', roughness: 1 }),
    );
    nest.rotation.x = -Math.PI / 2;
    nest.position.set(0.8, 0.2, 1.2);
    nest.castShadow = true;
    g.add(nest);
  } else if (type === 'breeding') {
    g.add(spawn('mountain', 5.2, 'max'));
  } else if (type === 'farm') {
    g.add(spawn('farmDirt', 3.6, 'max'));
  }
  if (type === 'breeding') {
    // trái tim hồng nhấp nháy khi đang lai tạo
    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 12),
      new THREE.MeshStandardMaterial({ color: '#ff5fa2', emissive: '#ff2f7a', emissiveIntensity: 0.8 }),
    );
    heart.name = 'pulse';
    heart.visible = false;
    g.add(heart);
  }
  return g;
}

interface View {
  id: number;
  group: THREE.Group;
  dyn: THREE.Group;
  sig: string;
  pos: string;
  labelEl: HTMLDivElement;
  /** nửa cạnh footprint (đơn vị thế giới) — để rồng tránh đi xuyên */
  half: number;
  coin?: THREE.Object3D;
  crop?: THREE.Object3D;
  eggs: { obj: THREE.Object3D; done: boolean }[];
  pulse?: THREE.Object3D;
  /** độ cao nhãn tối thiểu theo loại công trình */
  baseTop: number;
  top: number;
  label: CSS2DObject;
}

export class IslandWorld {
  readonly root = new THREE.Group();
  private views = new Map<number, View>();
  private scenery: IslandScenery;
  readonly particles: ParticleSystem;
  readonly herd: DragonHerd;

  constructor(scene: THREE.Scene, particleCapacity = 600) {
    scene.add(this.root);
    this.scenery = new IslandScenery(scene);
    this.particles = new ParticleSystem(scene, particleCapacity);
    this.herd = new DragonHerd(this.root, this.particles, {
      homeOf: (id) => {
        const v = this.views.get(id);
        return v ? { x: v.group.position.x, z: v.group.position.z } : null;
      },
      isFree: (x, z, own) => this.isFree(x, z, own),
    });
  }

  /** Rồng đứng được ở (x, z): trong đảo (chừa mép) và ngoài công trình khác chuồng của nó. */
  private isFree(x: number, z: number, ownHabitatId: number): boolean {
    if (Math.hypot(x, z) > islandRadius(Math.atan2(z, x)) - 2) return false;
    for (const v of this.views.values()) {
      if (v.id === ownHabitatId) continue;
      const p = v.group.position;
      const half = v.half + 0.3;
      if (Math.abs(x - p.x) < half && Math.abs(z - p.z) < half) return false;
    }
    return true;
  }

  pickDragon(raycaster: THREE.Raycaster): { id: number; distance: number } | null {
    return this.herd.pick(raycaster);
  }

  /** Chữ bay lên trên công trình (ví dụ "+120 💰"). */
  floatText(buildingId: number, text: string): void {
    const v = this.views.get(buildingId);
    if (!v) return;
    const anchor = document.createElement('div');
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    anchor.appendChild(el);
    const obj = new CSS2DObject(anchor);
    obj.position.set(0, v.top - 0.4, 0);
    v.group.add(obj);
    setTimeout(() => obj.removeFromParent(), 1300);
  }

  /** Bấm trúng đồng xu nào (đang hiện) → id chuồng. */
  pickCoin(raycaster: THREE.Raycaster): number | null {
    for (const v of this.views.values()) {
      if (v.coin?.visible && raycaster.intersectObject(v.coin, true).length) return v.id;
    }
    return null;
  }

  /** Các object có thể bấm chọn (chứa userData.buildingId). */
  pickables(): THREE.Object3D[] {
    return [...this.views.values()].map((v) => v.group);
  }

  sync(state: GameState): void {
    const alive = new Set(state.buildings.map((b) => b.id));
    for (const [id, v] of this.views) {
      if (!alive.has(id)) {
        v.group.removeFromParent();
        this.views.delete(id);
      }
    }
    for (const b of state.buildings) {
      let v = this.views.get(b.id);
      if (!v) {
        v = this.createView(b);
        this.views.set(b.id, v);
      }
      const pos = `${b.x},${b.z}`;
      if (v.pos !== pos) {
        v.group.position.copy(cellToWorld(b.x, b.z, FOOTPRINT[b.type]));
        v.pos = pos;
      }
      const sig = this.signature(b);
      if (sig !== v.sig) {
        this.rebuildDynamic(b, v);
        v.sig = sig;
      }
    }
    this.herd.sync(state);
  }

  private createView(b: Building): View {
    const group = new THREE.Group();
    group.userData.buildingId = b.id;
    group.add(buildingModel(b.type, b.type === 'habitat' ? b.element : undefined));
    const dyn = new THREE.Group();
    group.add(dyn);

    // thẻ ngoài do CSS2DRenderer định vị (transform); thẻ trong mới được nhún nhảy bằng CSS
    const anchor = document.createElement('div');
    const labelEl = document.createElement('div');
    labelEl.className = 'world-label';
    anchor.appendChild(labelEl);
    const label = new CSS2DObject(anchor);
    const model = group.children[0];
    const minTop = b.type === 'breeding' ? 4.6 : b.type === 'farm' ? 1.8 : 3.6;
    const top = Math.max(minTop, ((model.userData.top as number | undefined) ?? 0) + 0.4);
    label.position.set(0, top, 0);
    group.add(label);

    this.root.add(group);
    const v: View = { id: b.id, group, dyn, sig: '', pos: '', labelEl, half: (FOOTPRINT[b.type] * CELL) / 2, eggs: [], baseTop: top, top, label };
    v.pulse = group.getObjectByName('pulse');
    if (v.pulse) v.pulse.position.set(0, top - 0.4, 0);
    return v;
  }

  private signature(b: Building): string {
    switch (b.type) {
      case 'habitat':
        return 'coin'; // rồng do DragonHerd quản lý; chuồng chỉ có đồng xu
      case 'hatchery':
        return b.eggs.map((e) => e.id).join('|');
      case 'farm':
        return b.crop ? `${b.crop.cropId}:${b.crop.startedAt}` : '';
      case 'breeding':
        return b.job ? `${b.job.startedAt}` : '';
    }
  }

  private rebuildDynamic(b: Building, v: View): void {
    v.eggs = [];
    v.coin = undefined;
    v.crop = undefined;
    v.dyn.clear();

    if (b.type === 'habitat') {
      const coin = spawn('coin', 0.7);
      // vùng bấm vô hình to hơn đồng xu cho dễ trúng
      coin.add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
      coin.position.set(0, v.top - 0.6, 0);
      coin.userData.baseY = coin.position.y;
      v.dyn.add(coin);
      v.coin = coin;
    } else if (b.type === 'hatchery') {
      b.eggs.forEach((e, i) => {
        let egg: THREE.Object3D | null = makeSprite(`egg_${e.species}`, 1.0);
        if (egg) {
          egg.userData.slot = { fwd: 1.6, side: -0.5 + i * 1.0 };
        } else {
          egg = spawn('egg', 0.75, 'height');
          tintAll(egg, SPECIES[e.species].colors.main);
          egg.position.set(0.55 + i * 0.55, 0.25, 1.2 - i * 0.2);
        }
        v.dyn.add(egg);
        v.eggs.push({ obj: egg, done: false });
      });
    } else if (b.type === 'farm' && b.crop) {
      const crop = CROPS.find((c) => c.id === b.crop!.cropId);
      if (crop) {
        const plants = new THREE.Group();
        const offsets = [-0.9, 0, 0.9];
        for (const ox of offsets) for (const oz of offsets) {
          const plant = makeSprite(`crop_${crop.id}`, 1.1) ?? spawn(crop.model, 0.9, 'height');
          plants.add(place(plant, ox, 0.15, oz, (ox + oz) * 2));
        }
        v.dyn.add(plants);
        v.crop = plants;
      }
    }
  }

  /** Gọi mỗi khung hình. */
  update(state: GameState, now: number, dt: number, t: number, camera: THREE.Camera, night = false): void {
    this.scenery.update(dt, t);
    this.herd.update(dt, t, camera, night);
    this.particles.update(dt);
    const toCam = new THREE.Vector3();
    const right = new THREE.Vector3();
    for (const b of state.buildings) {
      const v = this.views.get(b.id);
      if (!v) continue;
      // hướng ngang từ công trình tới camera: đặt rồng/trứng tranh vẽ ở phía trước để không bị che
      toCam.subVectors(camera.position, v.group.position).setY(0).normalize();
      right.set(toCam.z, 0, -toCam.x);
      v.dyn.children.forEach((o) => {
        const slot = o.userData.slot as { fwd: number; side: number } | undefined;
        if (!slot) return;
        o.position.x = toCam.x * slot.fwd + right.x * slot.side;
        o.position.z = toCam.z * slot.fwd + right.z * slot.side;
      });
      if (b.type === 'habitat' && v.coin) {
        const gold = habitatGold(state, b, now);
        v.coin.visible = gold >= 10;
        v.coin.rotation.y = t * 2;
        v.coin.position.y = (v.coin.userData.baseY as number) + Math.sin(t * 3) * 0.1;
        const full = gold >= habitatCap(state, b) - 0.5;
        v.coin.scale.setScalar(full ? 1.3 : 1);
      }
      if (b.type === 'farm' && v.crop && b.crop) {
        const p = timerProgress(b.crop, now);
        v.crop.scale.setScalar(0.25 + 0.75 * p);
        v.crop.position.y = p >= 1 ? Math.abs(Math.sin(t * 4)) * 0.05 : 0;
      }
      if (b.type === 'hatchery') {
        b.eggs.forEach((e, i) => {
          const egg = v.eggs[i];
          if (!egg) return;
          // trứng sắp nở thì lắc lư
          egg.obj.rotation.z = timerDone(e, now) ? Math.sin(t * 10) * 0.25 : Math.sin(t * 2 + i) * 0.04;
        });
      }
      if (b.type === 'breeding' && v.pulse) {
        v.pulse.visible = !!b.job;
        const s = b.job && timerDone(b.job, now) ? 1.6 : 1 + Math.sin(t * 4) * 0.15;
        v.pulse.scale.setScalar(s);
      }
    }
  }

  /** Cập nhật chữ trên đầu công trình (gọi vài lần/giây là đủ). */
  updateLabels(state: GameState, now: number): void {
    for (const b of state.buildings) {
      const v = this.views.get(b.id);
      if (!v) continue;
      let text = '';
      let ready = false;
      if (b.type === 'habitat') {
        const gold = Math.floor(habitatGold(state, b, now));
        const n = dragonsIn(state, b.id).length;
        text = n === 0 ? `${ELEMENT_INFO[b.element].icon} Chuồng trống` : `💰 ${gold}`;
        ready = gold >= habitatCap(state, b) - 0.5 && n > 0;
      } else if (b.type === 'farm') {
        if (!b.crop) text = '🌱 Trống';
        else if (timerDone(b.crop, now)) {
          text = '✅ Thu hoạch';
          ready = true;
        } else text = `🌾 ${fmtTime(timerRemainingMs(b.crop, now))}`;
      } else if (b.type === 'hatchery') {
        const done = b.eggs.filter((e) => timerDone(e, now)).length;
        if (b.eggs.length === 0) text = '🏠 Lò ấp';
        else if (done > 0) {
          text = `🐣 ${done} trứng nở!`;
          ready = true;
        } else text = `🥚 ${fmtTime(Math.min(...b.eggs.map((e) => timerRemainingMs(e, now))))}`;
      } else if (b.type === 'breeding') {
        if (!b.job) text = '💞 Núi Lai Tạo';
        else if (timerDone(b.job, now)) {
          text = '🥚 Có trứng!';
          ready = true;
        } else text = `💞 ${fmtTime(timerRemainingMs(b.job, now))}`;
      }
      if (v.labelEl.textContent !== text) v.labelEl.textContent = text;
      v.labelEl.classList.toggle('ready', ready);
    }
  }
}
