// Màn đấu 3D: hai con rồng đối mặt trên đảo nổi, diễn hoạt từng sự kiện của lượt đánh.
import * as THREE from 'three';
import { ATTACK_BY_ID } from '../data/attacks';
import { ELEMENT_INFO } from '../data/elements';
import type { Fighter, Side, TurnEvent } from '../logic/battle';
import { spawn } from './assets';
import { seaMaterial, skyTexture } from './island';
import { createDragonView, type DragonLike } from './dragonView';
import { ParticleSystem } from './particles';

interface Tween {
  t: number;
  dur: number;
  fn: (p: number) => void;
  resolve: () => void;
}

const SPOT: Record<Side, THREE.Vector3> = {
  player: new THREE.Vector3(-3.2, 1.6, 0.8),
  enemy: new THREE.Vector3(3.2, 1.6, -0.8),
};

export class BattleView {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private views: Partial<Record<Side, DragonLike>> = {};
  /** vị trí thực tế mỗi bên: rồng 3D bay lơ lửng, rồng tranh vẽ đứng trên sàn */
  private at: Record<Side, THREE.Vector3> = { player: SPOT.player.clone(), enemy: SPOT.enemy.clone() };
  private tweens: Tween[] = [];
  private time = 0;
  /** thời gian còn "khựng" (hit-stop) */
  private freeze = 0;
  private seaMat = seaMaterial();
  private particles: ParticleSystem;
  private camBase = new THREE.Vector3(0, 4.6, 11);

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500);
    this.camera.position.copy(this.camBase);
    this.particles = new ParticleSystem(this.scene, 400);
    this.camera.lookAt(0, 1.7, 0);

    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog('#bfeeff', 60, 200);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this.seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -3;
    this.scene.add(sea);
    this.scene.add(new THREE.HemisphereLight('#fff6e0', '#6a4a3a', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    sun.position.set(6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    const arena = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 5, 1.2, 40),
      new THREE.MeshStandardMaterial({ color: '#c9a26b', roughness: 1 }),
    );
    arena.position.y = -0.6;
    arena.receiveShadow = true;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.6, 0.18, 8, 60),
      new THREE.MeshStandardMaterial({ color: '#8a5a2b' }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    const under = new THREE.Mesh(
      new THREE.ConeGeometry(5, 7, 30),
      new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 }),
    );
    under.rotation.x = Math.PI;
    under.position.y = -4.7;
    this.scene.add(arena, ring, under);
    for (const [x, z] of [[-5.5, -3], [5.5, 3], [-4, 4.5], [4.5, -4.5]]) {
      const r = spawn('rock', 1 + Math.random() * 0.6);
      r.position.set(x, 0, z);
      this.scene.add(r);
    }
  }

  setFighter(side: Side, f: Fighter): void {
    this.views[side]?.dispose();
    const v = createDragonView(f.species, f.level, { sizeMul: 0.85, faceRight: side === 'player' });
    this.at[side] = SPOT[side].clone().setY(v.flying ? SPOT[side].y : 0);
    v.root.position.copy(this.at[side]);
    v.root.lookAt(SPOT[side === 'player' ? 'enemy' : 'player'].clone().setY(this.at[side].y));
    this.scene.add(v.root);
    v.setFlapMode('idle');
    this.views[side] = v;
    // rồng mới ra sân thì phóng to dần
    v.root.scale.setScalar(0.01);
    void this.tween(0.35, (p) => v.root.scale.setScalar(Math.max(0.01, p)));
  }

  private tween(dur: number, fn: (p: number) => void): Promise<void> {
    return new Promise((resolve) => this.tweens.push({ t: 0, dur, fn, resolve }));
  }

  private wait(sec: number): Promise<void> {
    return this.tween(sec, () => {});
  }

  /** Diễn hoạt một sự kiện: lao tới, bắn chiêu, đối thủ trúng đòn/gục. */
  async play(ev: TurnEvent, onHit: () => void): Promise<void> {
    const atkSide = ev.side;
    const defSide: Side = atkSide === 'player' ? 'enemy' : 'player';
    const attacker = this.views[atkSide];
    const defender = this.views[defSide];
    if (!attacker || !defender) return;
    const attack = ATTACK_BY_ID[ev.attackId];
    const from = this.at[atkSide];
    const to = this.at[defSide];
    // đạn bay từ ngực rồng: rồng 3D gốc đã ở giữa thân, sprite thì gốc ở chân
    const chest = (v: DragonLike) => new THREE.Vector3(0, v.flying ? 0.4 : 1.6, 0);

    attacker.play(attack.power >= 1.6 ? 'attack2' : 'attack');
    if (attack.element === 'neutral') {
      // húc: lao thẳng vào đối thủ
      await this.tween(0.25, (p) => attacker.root.position.lerpVectors(from, to, p * 0.7));
      onHit();
      defender.play(ev.fainted ? 'death' : 'hit');
      await this.tween(0.3, (p) => attacker.root.position.lerpVectors(from, to, 0.7 * (1 - p)));
    } else {
      await this.tween(0.2, (p) => attacker.root.position.lerpVectors(from, to, p * 0.12));
      // luồng hơi thở theo hệ phun ra từ miệng về phía đối thủ
      const mouth = new THREE.Vector3();
      const aim = new THREE.Vector3();
      this.particles.breath(
        [attack.element],
        () => attacker.mouthWorld(mouth),
        () => aim.copy(to).add(chest(defender)).sub(attacker.mouthWorld(mouth)).normalize(),
        0.5,
      );
      const color = ELEMENT_INFO[attack.element].color;
      const size = 0.25 + attack.power * 0.18;
      const ball = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 1),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5 }),
      );
      const light = new THREE.PointLight(color, 25, 8);
      ball.add(light);
      this.scene.add(ball);
      const start = from.clone().add(chest(attacker));
      const end = to.clone().add(chest(defender));
      await this.tween(0.45, (p) => {
        ball.position.lerpVectors(start, end, p);
        ball.position.y += Math.sin(p * Math.PI) * 1.2;
        ball.rotation.x += 0.3;
      });
      ball.removeFromParent();
      ball.geometry.dispose();
      ball.material.dispose();
      onHit();
      defender.play(ev.fainted ? 'death' : 'hit');
      await this.tween(0.2, (p) => attacker.root.position.lerpVectors(from, to, 0.12 * (1 - p)));
    }
    // đòn khắc hệ: khựng hình + rung camera
    if (ev.mult > 1) {
      this.freeze = 0.09;
      void this.shake(0.3, 0.18);
    }
    // rung nhẹ khi trúng đòn
    const base = defender.root.position.clone();
    await this.tween(0.3, (p) => {
      defender.root.position.copy(base);
      defender.root.position.x += Math.sin(p * 40) * 0.12 * (1 - p);
    });
    defender.root.position.copy(base);
    await this.wait(ev.fainted ? 1.1 : 0.25);
  }

  private shake(dur: number, strength: number): Promise<void> {
    return this.tween(dur, (p) => {
      const k = strength * (1 - p);
      this.camera.position.set(
        this.camBase.x + (Math.random() - 0.5) * k,
        this.camBase.y + (Math.random() - 0.5) * k,
        this.camBase.z,
      );
      if (p >= 1) this.camera.position.copy(this.camBase);
    });
  }

  /** Vị trí trên màn hình (px) của rồng, để hiện số sát thương. */
  screenPos(side: Side, width: number, height: number): { x: number; y: number } {
    const p = this.at[side].clone().setY(3).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height };
  }

  update(dt: number): void {
    if (this.freeze > 0) {
      this.freeze -= dt;
      dt = 0; // đứng hình trong chốc lát cho đòn "nặng" hơn
    }
    this.time += dt;
    this.seaMat.uniforms.uTime.value = this.time;
    for (const v of Object.values(this.views)) v?.update(dt, this.time, this.camera);
    this.particles.update(dt);
    for (const tw of [...this.tweens]) {
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      tw.fn(p);
      if (p >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.resolve();
      }
    }
    // rồng bay nhấp nhô nhẹ
    for (const side of ['player', 'enemy'] as Side[]) {
      const v = this.views[side];
      if (v?.flying && !this.tweens.length) v.root.position.y = this.at[side].y + Math.sin(this.time * 2 + (side === 'enemy' ? 1 : 0)) * 0.12;
    }
  }

  clear(): void {
    this.views.player?.dispose();
    this.views.enemy?.dispose();
    this.views = {};
    this.tweens = [];
    this.camera.position.copy(this.camBase); // phòng khi đang rung dở
    this.particles.clearStreams();
  }

  resize(aspect: number, heightPx: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.particles.resize(heightPx, this.camera.fov);
  }
}
