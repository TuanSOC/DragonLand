// "Bộ não" của một con rồng trên đảo: máy trạng thái chọn hành vi theo cá tính.
// Chỉ dùng số thuần (không three.js) để test được bằng Vitest. View đọc x/y/z/state để vẽ.
import type { Element } from '../data/elements';
import { personalityOf, type Personality } from '../data/personality';
import type { Rng } from '../logic/state';

export type BrainState = 'idle' | 'walk' | 'sit' | 'sleep' | 'roar' | 'breathe' | 'react' | 'takeoff' | 'fly' | 'land';
export type BrainEvent = 'roar' | 'breathe' | 'react' | 'takeoff' | 'land';

/** Chỉ một con được giữ "vé bay" tại một thời điểm. */
export interface FlightToken {
  holder: number | null;
}

export interface BrainEnv {
  home: { x: number; z: number };
  /** tâm vòng bay quanh đảo */
  center: { x: number; z: number };
  radius: number;
  night: boolean;
  /** điểm đứng được: trong đảo và ngoài công trình khác */
  isFree(x: number, z: number): boolean;
  flight: FlightToken;
}

export const BEHAVIOR = {
  /** [min, max] giây cho các trạng thái tính giờ */
  duration: {
    idle: [2, 5],
    sit: [4, 9],
    sleep: [8, 16],
    roar: [1.2, 1.2],
    breathe: [1.6, 1.6],
    react: [1.6, 1.6],
    takeoff: [1.0, 1.0],
    land: [1.2, 1.2],
  } as Record<string, [number, number]>,
  walkSpeed: 1.4,
  hopHeight: 0.12,
  flyHeight: [6, 8] as [number, number],
  flyRadius: [14, 17] as [number, number],
  flyTime: [8, 12] as [number, number],
  flyCooldown: [40, 90] as [number, number],
  /** lần bay đầu tiên sau khi xuất hiện */
  firstFly: [15, 45] as [number, number],
  nightSleepMul: 4,
  wanderTries: 8,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

export class DragonBrain {
  x: number;
  y = 0;
  z: number;
  /** vận tốc ngang (để view quay mặt theo hướng đi) */
  vx = 0;
  vz = 0;
  state: BrainState = 'idle';

  private t = 0;
  private dur = 0;
  private tx = 0;
  private tz = 0;
  private flyCd: number;
  private fly = { a0: 0, r0: 0, r: 0, h: 0, time: 0, dir: 1, fromX: 0, fromZ: 0 };
  private pending: BrainEvent[] = [];
  private wantFly = false;
  private p: Personality;

  constructor(
    readonly id: number,
    elements: Element[],
    private rng: Rng,
    x: number,
    z: number,
  ) {
    this.x = x;
    this.z = z;
    this.p = personalityOf(elements);
    this.flyCd = this.range(BEHAVIOR.firstFly);
    this.dur = this.range(BEHAVIOR.duration.idle) * this.rng();
  }

  get flying(): boolean {
    return this.state === 'takeoff' || this.state === 'fly' || this.state === 'land';
  }

  /** Người chơi bấm vào rồng. Đang bay thì bỏ qua. */
  react(): void {
    if (this.flying) return;
    this.set('react');
  }

  /** Dịch chuyển tức thời (đổi chuồng / chuồng bị dời): đứng yên tại chỗ mới. */
  teleport(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.tx = x;
    this.tz = z;
    this.set('idle');
  }

  /** Dev: bay ngay khi có thể (kết thúc hành vi hiện tại). */
  forceFly(): void {
    if (this.flying) return;
    this.wantFly = true;
    this.flyCd = 0;
    if (this.state !== 'walk') this.dur = 0;
  }

  update(dt: number, env: BrainEnv): BrainEvent[] {
    const px = this.x;
    const pz = this.z;
    this.t += dt;
    this.flyCd -= dt;

    switch (this.state) {
      case 'walk': {
        const dx = this.tx - this.x;
        const dz = this.tz - this.z;
        const d = Math.hypot(dx, dz);
        const step = BEHAVIOR.walkSpeed * this.p.speed * dt;
        if (d <= step) {
          this.x = this.tx;
          this.z = this.tz;
          this.y = 0;
          this.next(env);
        } else {
          this.x += (dx / d) * step;
          this.z += (dz / d) * step;
          this.y = Math.abs(Math.sin(this.t * 8)) * BEHAVIOR.hopHeight;
        }
        break;
      }
      case 'takeoff': {
        const k = Math.min(1, this.t / this.dur);
        this.y = ease(k) * this.fly.h;
        // vừa bay lên vừa lướt từ chỗ đang đứng về nhà (điểm bắt đầu vòng bay)
        this.x = lerp(this.fly.fromX, env.home.x, ease(k));
        this.z = lerp(this.fly.fromZ, env.home.z, ease(k));
        if (k >= 1) this.set('fly', this.fly.time);
        break;
      }
      case 'fly': {
        const k = Math.min(1, this.t / this.dur);
        // một vòng quanh tâm đảo: bắt đầu và kết thúc đúng tại nhà
        const a = this.fly.a0 + this.fly.dir * k * Math.PI * 2;
        const r = lerp(this.fly.r0, this.fly.r, Math.sin(k * Math.PI));
        this.x = env.center.x + Math.cos(a) * r;
        this.z = env.center.z + Math.sin(a) * r;
        this.y = this.fly.h + Math.sin(this.t * 1.5) * 0.4;
        if (k >= 1) {
          this.x = env.home.x;
          this.z = env.home.z;
          this.set('land');
        }
        break;
      }
      case 'land': {
        const k = Math.min(1, this.t / this.dur);
        this.y = (1 - ease(k)) * this.fly.h;
        if (k >= 1) {
          this.y = 0;
          if (env.flight.holder === this.id) env.flight.holder = null;
          this.flyCd = this.range(BEHAVIOR.flyCooldown);
          this.pending.push('land');
          this.next(env);
        }
        break;
      }
      default:
        if (this.t >= this.dur) this.next(env);
    }

    this.vx = dt > 0 ? (this.x - px) / dt : 0;
    this.vz = dt > 0 ? (this.z - pz) / dt : 0;
    const out = this.pending;
    this.pending = [];
    return out;
  }

  private range([a, b]: [number, number]): number {
    return a + (b - a) * this.rng();
  }

  private set(state: BrainState, dur?: number): void {
    // rời trạng thái đi/bay giữa chừng (vd. bị bấm) → chạm đất
    if (state !== 'walk' && state !== 'takeoff' && state !== 'fly' && state !== 'land') this.y = 0;
    this.state = state;
    this.t = 0;
    this.dur = dur ?? this.range(BEHAVIOR.duration[state] ?? [1, 1]);
    if (state === 'roar' || state === 'breathe' || state === 'react' || state === 'takeoff') this.pending.push(state);
  }

  /** Chọn hành vi tiếp theo theo trọng số cá tính. */
  private next(env: BrainEnv): void {
    const canFly = this.flyCd <= 0 && env.flight.holder === null && !env.night;
    const w: [BrainState, number][] = [
      ['idle', this.p.idle],
      ['walk', this.p.walk],
      ['sit', this.p.sit],
      ['sleep', this.p.sleep * (env.night ? BEHAVIOR.nightSleepMul : 0.3)],
      ['roar', this.p.roar * (env.night ? 0.2 : 1)],
      ['breathe', this.p.breathe * (env.night ? 0.2 : 1)],
      ['takeoff', canFly ? this.p.fly * 3 : 0],
    ];
    const total = w.reduce((s, [, v]) => s + v, 0);
    let r = this.rng() * total;
    let pick: BrainState = 'idle';
    for (const [s, v] of w) {
      r -= v;
      if (r < 0) {
        pick = s;
        break;
      }
    }
    if (this.wantFly && canFly) pick = 'takeoff';
    this.wantFly = false;

    if (pick === 'walk' && !this.pickTarget(env)) pick = 'idle';
    if (pick === 'takeoff') {
      env.flight.holder = this.id;
      this.fly = {
        a0: Math.atan2(env.home.z - env.center.z, env.home.x - env.center.x),
        r0: Math.hypot(env.home.x - env.center.x, env.home.z - env.center.z),
        r: this.range(BEHAVIOR.flyRadius),
        h: this.range(BEHAVIOR.flyHeight),
        time: this.range(BEHAVIOR.flyTime),
        dir: this.rng() < 0.5 ? 1 : -1,
        fromX: this.x,
        fromZ: this.z,
      };
    }
    this.set(pick, pick === 'walk' ? Infinity : undefined);
  }

  /** Chọn điểm đi tới quanh nhà; thử vài lần, không được thì đứng yên. */
  private pickTarget(env: BrainEnv): boolean {
    for (let i = 0; i < BEHAVIOR.wanderTries; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = Math.sqrt(this.rng()) * env.radius;
      const x = env.home.x + Math.cos(a) * d;
      const z = env.home.z + Math.sin(a) * d;
      // kiểm tra cả vài điểm dọc đường đi để không đi xuyên công trình
      const pathOk = [0.25, 0.5, 0.75, 1].every((k) => env.isFree(lerp(this.x, x, k), lerp(this.z, z, k)));
      if (pathOk) {
        this.tx = x;
        this.tz = z;
        return true;
      }
    }
    return false;
  }
}
