// Bộ điều khiển: giữ GameState, chạy hành động, báo cho UI/3D cập nhật và tự lưu.
import { resetGame, saveGame } from './core/save';
import { BALANCE } from './data/balance';
import { SPECIES, STAGE_NAMES, stageOf } from './data/dragons';
import type { GameState, Result } from './logic/state';
import { sfx, type Sfx } from './ui/sound';
import { toast } from './ui/toast';

type Listener = () => void;

/** Ảnh chụp trước khi hành động, để phát hiện lên cấp / tiến hóa. */
export interface Snapshot {
  level: number;
  stages: Map<number, number>;
}

export class Game {
  private listeners: Listener[] = [];
  private resetting = false;

  constructor(public state: GameState) {}

  now(): number {
    return Date.now();
  }

  rng = (): number => Math.random();

  /** Chạy một hành động logic. Thành công → lưu + báo thay đổi; thất bại → hiện lỗi. */
  act(fn: (s: GameState, now: number) => Result, opts: { quiet?: boolean; sfx?: Sfx } = {}): boolean {
    const snap = this.snapshot();
    const r = fn(this.state, this.now());
    if (!r.ok) {
      toast(r.reason, 'error');
      sfx('error');
      return false;
    }
    if (r.msg && !opts.quiet) toast(r.msg, 'ok');
    sfx(opts.sfx ?? 'ok');
    this.celebrate(snap);
    this.changed();
    return true;
  }

  snapshot(): Snapshot {
    return {
      level: this.state.playerLevel,
      stages: new Map(this.state.dragons.map((d) => [d.id, stageOf(d.level)])),
    };
  }

  /** So với ảnh chụp: người chơi lên cấp, rồng tiến hóa → chúc mừng. */
  celebrate(snap: Snapshot): void {
    for (const d of this.state.dragons) {
      const before = snap.stages.get(d.id);
      const now = stageOf(d.level);
      if (before !== undefined && now > before) {
        toast(`✨ ${SPECIES[d.species].name} tiến hóa thành ${STAGE_NAMES[now]}!`, 'level');
        sfx('evolve');
      }
    }
    if (this.state.playerLevel > snap.level) {
      const lv = this.state.playerLevel;
      toast(`⭐ Lên cấp ${lv}! +${BALANCE.levelReward.gems} 💎 +${BALANCE.levelReward.goldPerLevel * lv} vàng`, 'level');
      sfx('levelup');
    }
  }

  changed(): void {
    this.save();
    for (const l of this.listeners) l();
  }

  save(): void {
    if (!this.resetting) saveGame(this.state);
  }

  /** Xóa save và tải lại trang (chặn lưu đè lúc đóng trang). */
  reset(): void {
    this.resetting = true;
    resetGame();
    location.reload();
  }

  onChange(l: Listener): void {
    this.listeners.push(l);
  }
}
