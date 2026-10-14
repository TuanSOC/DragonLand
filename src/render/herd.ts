// Đàn rồng trên đảo: mỗi con có "bộ não" (DragonBrain) + "thân" (DragonLike).
// Rồng sống ở lớp riêng toạ độ thế giới (không gắn vào chuồng) để đi lại và bay vòng đảo.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SPECIES } from '../data/dragons';
import type { Element } from '../data/elements';
import type { GameState } from '../logic/state';
import { sfx } from '../ui/sound';
import { DragonBrain, type BrainEnv, type BrainEvent, type FlightToken } from './behavior';
import { createDragonView, type DragonLike, type HitZone } from './dragonView';
import type { ParticleSystem } from './particles';

/** bán kính đi lang thang quanh chuồng */
const WANDER_RADIUS = 3.5;
/** rồng 3D (GLB) bay lơ lửng cao hơn mặt đất */
const GLB_HOVER = 1.4;

interface Entry {
  brain: DragonBrain;
  view: DragonLike;
  sig: string;
  elements: Element[];
  habitatId: number;
  zzz: CSS2DObject;
  lastState: string;
  /** lần phản ứng tới: bị chọc đầu / bụng, hoặc đang được cho ăn */
  reactKind: 'head' | 'body' | 'eat';
  /** cho ăn mà lên cấp → thêm lấp lánh */
  leveled: boolean;
}

export interface HerdWorld {
  /** tâm chuồng (toạ độ thế giới) */
  homeOf(habitatId: number): { x: number; z: number } | null;
  /** điểm rồng đứng được (trong đảo, ngoài công trình khác chuồng của nó) */
  isFree(x: number, z: number, habitatId: number): boolean;
}

function label(className: string, text: string): CSS2DObject {
  const anchor = document.createElement('div');
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  anchor.appendChild(el);
  return new CSS2DObject(anchor);
}

const _mouth = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();

export class DragonHerd {
  readonly layer = new THREE.Group();
  private entries = new Map<number, Entry>();
  private flight: FlightToken = { holder: null };

  constructor(
    parent: THREE.Object3D,
    private particles: ParticleSystem,
    private world: HerdWorld,
    private rng: () => number = Math.random,
  ) {
    parent.add(this.layer);
  }

  sync(state: GameState): void {
    const alive = new Set(state.dragons.map((d) => d.id));
    for (const [id, e] of this.entries) {
      if (!alive.has(id)) {
        if (this.flight.holder === id) this.flight.holder = null;
        e.zzz.removeFromParent(); // CSS2DObject chỉ gỡ DOM khi chính nó bị gỡ
        e.view.dispose();
        this.entries.delete(id);
      }
    }
    for (const d of state.dragons) {
      const sig = `${d.species}:${d.level}`;
      let e = this.entries.get(d.id);
      if (!e) {
        const home = this.world.homeOf(d.habitatId) ?? { x: 0, z: 0 };
        const a = this.rng() * Math.PI * 2;
        const elements = SPECIES[d.species].elements;
        const brain = new DragonBrain(d.id, elements, this.rng, home.x + Math.cos(a) * 0.8, home.z + Math.sin(a) * 0.8);
        e = { brain, view: this.makeView(d.species, d.level), sig, elements, habitatId: d.habitatId, zzz: label('zzz', 'Zzz'), lastState: '', reactKind: 'body', leveled: false };
        this.attach(e);
        this.entries.set(d.id, e);
      } else if (e.sig !== sig) {
        // lên cấp (có thể đổi giai đoạn → ảnh mới): thay thân, giữ não
        e.zzz.removeFromParent();
        e.view.dispose();
        e.view = this.makeView(d.species, d.level);
        e.sig = sig;
        this.attach(e);
      }
      e.habitatId = d.habitatId;
    }
  }

  private makeView(species: keyof typeof SPECIES, level: number): DragonLike {
    const v = createDragonView(species, level);
    this.layer.add(v.root);
    return v;
  }

  private attach(e: Entry): void {
    e.zzz.position.set(0, e.view.height * 0.8, 0);
    e.zzz.visible = false;
    e.view.root.add(e.zzz);
  }

  update(dt: number, time: number, camera: THREE.Camera, night: boolean): void {
    _right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    for (const e of this.entries.values()) {
      const home = this.world.homeOf(e.habitatId);
      if (!home) {
        if (this.flight.holder === e.brain.id) this.flight.holder = null;
        continue;
      }
      const b = e.brain;
      // chuyển chuồng hoặc chuồng bị dời đi xa → "phép thuật" dịch chuyển về nhà
      if (!b.flying && Math.hypot(b.x - home.x, b.z - home.z) > WANDER_RADIUS + 1) {
        b.teleport(home.x, home.z);
        this.particles.burst('sparkle', new THREE.Vector3(b.x, 1, b.z), 20);
      }
      const env: BrainEnv = {
        home,
        center: { x: 0, z: 0 },
        radius: WANDER_RADIUS,
        night,
        isFree: (x, z) => this.world.isFree(x, z, e.habitatId),
        flight: this.flight,
      };
      const events = b.update(dt, env);

      const v = e.view;
      v.root.position.set(b.x, b.y + (v.flying ? GLB_HOVER : 0), b.z);
      if (Math.hypot(b.vx, b.vz) > 0.1) v.face(b.vx, b.vz, _right);
      v.setFlapMode(b.flying ? 'fly' : b.state === 'sit' || b.state === 'sleep' ? 'rest' : 'idle');
      e.zzz.visible = b.state === 'sleep';
      if (b.state !== e.lastState) {
        if (b.state === 'sleep') v.play('sleep');
        else if (e.lastState === 'sleep') v.play('idle');
        e.lastState = b.state;
      }
      for (const ev of events) this.handle(e, ev);
      v.update(dt, time, camera);
    }
  }

  private handle(e: Entry, ev: BrainEvent): void {
    const v = e.view;
    const ground = new THREE.Vector3(e.brain.x, 0.1, e.brain.z);
    switch (ev) {
      case 'roar':
        v.play('roar');
        break;
      case 'breathe':
        v.play('breathe');
        this.breath(e, 1.2);
        break;
      case 'react': {
        const head = new THREE.Vector3(e.brain.x, e.view.height * 0.9, e.brain.z);
        if (e.reactKind === 'eat') {
          // ngửa cổ → đớp → vụn thức ăn rơi + tim bay lên
          v.play('eat');
          setTimeout(() => this.particles.burst('crumb', v.mouthWorld(new THREE.Vector3()), 10), 380);
          setTimeout(() => this.particles.burst('heart', head, 6, new THREE.Vector3(0, 1, 0), 0.6), 550);
          if (e.leveled) setTimeout(() => this.particles.burst('sparkle', head, 30), 600);
        } else if (e.reactKind === 'head') {
          // chọc đầu: rụt cổ, gầm gừ, phì hơi thở
          v.play('flinch');
          this.breath(e, 0.5);
          sfx('roar');
          this.tooltip(e);
        } else {
          // chọc bụng: nhảy múa, tim bay
          v.play('dance');
          this.particles.burst('heart', head, 5, new THREE.Vector3(0, 1, 0), 0.6);
          sfx('ok');
          this.tooltip(e);
        }
        break;
      }
      case 'takeoff':
        this.particles.burst('dust', ground, 16);
        break;
      case 'land':
        this.particles.burst('dust', ground, 22);
        v.play('happy');
        break;
    }
  }

  /** Luồng hơi thở bám theo miệng rồng, hướng từ thân ra miệng. */
  private breath(e: Entry, duration: number): void {
    const v = e.view;
    const origin = () => v.mouthWorld(_mouth);
    const dir = () => {
      v.mouthWorld(_dir);
      _dir.sub(v.root.position).setY(0);
      if (_dir.lengthSq() < 1e-4) _dir.set(1, 0, 0);
      return _dir.normalize().setY(-0.12).normalize();
    };
    this.particles.breath(e.elements, origin, dir, duration);
  }

  private tooltip(e: Entry): void {
    const d = SPECIES[e.sig.split(':')[0] as keyof typeof SPECIES];
    const tip = label('dragon-tip', `${d.name} · Cấp ${e.sig.split(':')[1]}`);
    tip.position.set(0, e.view.height + 0.6, 0);
    e.view.root.add(tip);
    setTimeout(() => tip.removeFromParent(), 2000);
  }

  /** Rồng nào bị bấm trúng (gần camera nhất) → id + khoảng cách + vùng đầu/thân. */
  pick(raycaster: THREE.Raycaster): { id: number; distance: number; zone: HitZone } | null {
    let best: { id: number; distance: number; zone: HitZone } | null = null;
    for (const [id, e] of this.entries) {
      const hit = e.view.pick(raycaster);
      if (hit && (!best || hit.distance < best.distance)) best = { id, ...hit };
    }
    return best;
  }

  /** Người chơi chọc vào rồng (đầu → rụt cổ gầm gừ, thân → nhảy múa). */
  react(dragonId: number, zone: HitZone = 'body'): void {
    const e = this.entries.get(dragonId);
    if (!e) return;
    e.reactKind = zone;
    e.brain.react();
  }

  /** Vừa được cho ăn (từ bảng chuồng): đớp mồi, tim bay; lên cấp thì lấp lánh. */
  feed(dragonId: number, leveled: boolean): void {
    const e = this.entries.get(dragonId);
    if (!e) return;
    e.reactKind = 'eat';
    e.leveled = leveled;
    e.brain.react();
  }

  /** Dev: ép một con rồng cất cánh ngay. */
  flyNow(): void {
    const e = [...this.entries.values()].find((x) => !x.brain.flying);
    if (!e || this.flight.holder !== null) return;
    e.brain.forceFly();
  }
}
