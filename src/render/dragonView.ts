// Hiển thị một con rồng: ưu tiên tranh vẽ (DragonMesh + shader), thiếu ảnh thì dùng model GLB.
import * as THREE from 'three';
import { SPECIES, isHybrid, stageOf, type SpeciesId } from '../data/dragons';
import { spriteMeta } from '../data/spriteMeta';
import { getAnimations, spawn, tintByName, type ModelKey } from './assets';
import { DragonMesh, type FlapMode } from './dragonMesh';
import { alphaAt, blobShadow, getSprite } from './sprites';

export type AnimName = 'idle' | 'attack' | 'attack2' | 'hit' | 'death' | 'happy' | 'roar' | 'breathe' | 'react' | 'sleep';

/** Giao diện chung cho mọi kiểu hiển thị rồng. */
export interface DragonLike {
  readonly root: THREE.Group;
  /** model 3D luôn bay lơ lửng; tranh vẽ thì đứng trên mặt đất */
  readonly flying: boolean;
  /** chiều cao xấp xỉ tính từ gốc */
  readonly height: number;
  play(name: AnimName): void;
  update(dt: number, time: number, camera: THREE.Camera): void;
  setFlapMode(mode: FlapMode): void;
  /** quay mặt theo hướng di chuyển (dx, dz); camRight để biết trái/phải trên màn hình */
  face(dx: number, dz: number, camRight: THREE.Vector3): void;
  mouthWorld(out: THREE.Vector3): THREE.Vector3;
  /** khoảng cách nếu tia chuột trúng phần nhìn thấy của rồng, không thì null */
  pick(raycaster: THREE.Raycaster): number | null;
  dispose(): void;
}

// ───────────────────────── Rồng 3D (GLB) ─────────────────────────

const QUATERNIUS_A: Partial<Record<AnimName, string>> = {
  idle: 'CharacterArmature|Flying_Idle',
  attack: 'CharacterArmature|Headbutt',
  attack2: 'CharacterArmature|Punch',
  hit: 'CharacterArmature|HitReact',
  death: 'CharacterArmature|Death',
  happy: 'CharacterArmature|Yes',
};

const QUATERNIUS_B: Partial<Record<AnimName, string>> = {
  idle: 'DragonArmature|Dragon_Flying',
  attack: 'DragonArmature|Dragon_Attack',
  attack2: 'DragonArmature|Dragon_Attack2',
  hit: 'DragonArmature|Dragon_Hit',
  death: 'DragonArmature|Dragon_Death',
  happy: 'DragonArmature|Dragon_Flying',
};

/** hành vi mới không có clip riêng → mượn clip gần giống */
const GLB_ALIAS: Partial<Record<AnimName, AnimName>> = { roar: 'attack', breathe: 'attack2', react: 'happy', sleep: 'idle' };

/** sải cánh (đơn vị thế giới) theo giai đoạn */
const STAGE_SIZE = [2.0, 2.7, 3.4];

function modelFor(species: SpeciesId, level: number): ModelKey {
  if (isHybrid(species)) return 'dragonHybrid';
  return stageOf(level) === 2 ? 'dragonAdult' : 'dragonBaby';
}

class GlbDragonView implements DragonLike {
  readonly root: THREE.Group;
  readonly flying = true;
  readonly height: number;
  private size: number;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<AnimName, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;

  constructor(species: SpeciesId, level: number, sizeMul = 1) {
    const key = modelFor(species, level);
    this.size = STAGE_SIZE[stageOf(level)] * sizeMul;
    this.root = spawn(key, this.size);
    this.height = this.size * 0.7;

    const { main, second } = SPECIES[species].colors;
    if (key === 'dragonHybrid') {
      const wing = new THREE.Color(main).lerp(new THREE.Color(second), 0.5);
      tintByName(this.root, { Main: main, Belly: second, Wings: wing });
    } else {
      tintByName(this.root, { Dragon_Main: main, Dragon_Secondary: second });
    }

    this.mixer = new THREE.AnimationMixer(this.root.children[0]);
    const names = key === 'dragonHybrid' ? QUATERNIUS_B : QUATERNIUS_A;
    const clips = getAnimations(key);
    for (const [anim, clipName] of Object.entries(names) as [AnimName, string][]) {
      const clip = clips.find((c) => c.name === clipName);
      if (clip) this.actions.set(anim, this.mixer.clipAction(clip));
    }
    this.mixer.addEventListener('finished', (e) => {
      const done = (e as unknown as { action: THREE.AnimationAction }).action;
      if (done === this.current && done !== this.actions.get('death')) this.play('idle');
    });
    this.play('idle');
    // lệch pha để các con rồng không vỗ cánh đồng loạt
    if (this.current) this.current.time = Math.random() * this.current.getClip().duration;
  }

  play(name: AnimName): void {
    const resolved = this.actions.has(name) ? name : (GLB_ALIAS[name] ?? 'idle');
    const next = this.actions.get(resolved) ?? this.actions.get('idle');
    if (!next || next === this.current) {
      if (next && resolved !== 'idle') next.reset().play();
      return;
    }
    const loop = resolved === 'idle';
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.play();
    if (this.current) this.current.crossFadeTo(next, 0.2, false);
    this.current = next;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  setFlapMode(mode: FlapMode): void {
    this.mixer.timeScale = mode === 'fly' ? 1.6 : mode === 'rest' ? 0.6 : 1;
  }

  face(dx: number, dz: number): void {
    if (Math.hypot(dx, dz) > 0.05) this.root.rotation.y = Math.atan2(dx, dz);
  }

  mouthWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.root.localToWorld(out.set(0, this.height * 0.55, this.size * 0.45));
  }

  pick(raycaster: THREE.Raycaster): number | null {
    return raycaster.intersectObject(this.root, true)[0]?.distance ?? null;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}

// ───────────────────────── Rồng tranh vẽ ─────────────────────────

/** cạnh lớn nhất của ảnh (đơn vị thế giới) theo giai đoạn */
const SPRITE_SIZE = [3.0, 4.0, 5.2];

/**
 * Rồng tranh vẽ: shader lo vỗ cánh/thở/vẫy đuôi; các động tác (nhảy, gầm, trúng đòn, gục)
 * làm bằng biến đổi nhóm `body` + uniform.
 */
class SpriteDragonView implements DragonLike {
  readonly root = new THREE.Group();
  readonly flying = false;
  private body = new THREE.Group();
  private mesh: DragonMesh;
  private shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private anim: AnimName = 'idle';
  private t = 0;

  constructor(private id: string, size: number, flip: boolean) {
    const s = getSprite(id)!;
    const [w, h] = s.w > s.h ? [size, (size * s.h) / s.w] : [(size * s.w) / s.h, size];
    this.mesh = new DragonMesh(s.texture, w, h, spriteMeta(id));
    this.mesh.setFlip(flip);
    this.body.add(this.mesh);
    this.shadow = blobShadow(Math.max(w, h) * 0.3);
    this.root.add(this.shadow, this.body);
  }

  get height(): number {
    return this.mesh.h;
  }

  private get shadowSize(): number {
    return Math.max(this.mesh.w, this.mesh.h) * 0.6;
  }

  play(name: AnimName): void {
    this.anim = name;
    this.t = 0;
  }

  setFlapMode(mode: FlapMode): void {
    this.mesh.setFlapMode(mode);
  }

  face(dx: number, dz: number, camRight: THREE.Vector3): void {
    const s = dx * camRight.x + dz * camRight.z;
    // ảnh vẽ hướng sang trái → đi sang phải màn hình thì lật
    if (Math.abs(s) > 0.05) this.mesh.setFlip(s > 0);
  }

  mouthWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.body.localToWorld(this.mesh.mouthLocal(out));
  }

  pick(raycaster: THREE.Raycaster): number | null {
    const hit = raycaster.intersectObject(this.mesh, false)[0];
    if (!hit?.uv) return null;
    const u = this.mesh.flipped ? 1 - hit.uv.x : hit.uv.x;
    return alphaAt(this.id, u, hit.uv.y) > 0.3 ? hit.distance : null;
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    this.t += dt;
    const u = this.mesh.u;
    let sx = 1;
    let sy = 1;
    let y = 0;
    let x = 0;
    u.uFlash.value = 0;
    u.uOpacity.value = 1;
    this.mesh.tilt = 0;
    const done = (dur: number) => {
      const p = Math.min(1, this.t / dur);
      if (p >= 1) this.play('idle');
      return p;
    };
    switch (this.anim) {
      case 'attack':
      case 'attack2':
      case 'happy':
      case 'react': {
        const big = this.anim === 'attack2' || this.anim === 'react';
        const k = Math.sin(done(big ? 0.6 : 0.45) * Math.PI);
        y = k * (big ? 0.35 : 0.2) * this.mesh.h;
        sx = sy = 1 + k * 0.08;
        break;
      }
      case 'roar': {
        const p = done(1.2);
        const k = Math.sin(p * Math.PI);
        sx = sy = 1 + k * 0.07;
        x = Math.sin(this.t * 40) * 0.04 * k * this.mesh.w; // run rẩy khi gầm
        break;
      }
      case 'breathe': {
        const k = Math.sin(done(1.6) * Math.PI);
        sx = 1 + k * 0.04;
        break;
      }
      case 'hit': {
        const p = done(0.4);
        u.uFlash.value = Math.sin(p * Math.PI * 4) > 0 ? 1 : 0;
        sx = 1 + (1 - p) * 0.06;
        sy = 1 - (1 - p) * 0.06;
        break;
      }
      case 'death': {
        const p = Math.min(1, this.t / 0.9);
        this.mesh.tilt = p * 1.3;
        u.uOpacity.value = 1 - p * 0.85;
        y = -p * this.mesh.h * 0.15;
        break;
      }
      case 'sleep':
        sy = 0.95;
        break;
    }
    this.body.scale.set(sx, sy, 1);
    this.body.position.set(x, y, 0);
    // bóng luôn nằm trên mặt đất; rồng càng cao bóng càng nhỏ và mờ
    const alt = Math.max(0, this.root.position.y);
    const k = Math.max(0.35, 1 - alt / 10);
    this.shadow.position.y = -this.root.position.y + 0.02;
    this.shadow.scale.set(this.shadowSize * k, this.shadowSize * k, 1);
    this.shadow.material.opacity = k;
    this.mesh.update(dt, time, camera);
  }

  dispose(): void {
    this.mesh.material.dispose(); // hình học dùng chung — không dispose
    this.shadow.material.dispose();
    this.root.removeFromParent();
  }
}

export function spriteId(species: SpeciesId, level: number): string {
  return `${species}_${stageOf(level)}`;
}

/**
 * Tạo rồng: ưu tiên tranh vẽ, thiếu thì dùng model 3D.
 * @param faceRight ảnh vẽ quay sang trái; true để lật sang phải
 */
export function createDragonView(species: SpeciesId, level: number, opts: { sizeMul?: number; faceRight?: boolean } = {}): DragonLike {
  const id = spriteId(species, level);
  const mul = opts.sizeMul ?? 1;
  if (getSprite(id)) return new SpriteDragonView(id, SPRITE_SIZE[stageOf(level)] * mul, !!opts.faceRight);
  return new GlbDragonView(species, level, mul);
}
