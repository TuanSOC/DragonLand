// Vàng: chuồng sinh vàng theo rồng bên trong, có giới hạn kho.
import { BALANCE } from '../data/balance';
import { SPECIES } from '../data/dragons';
import type { Element } from '../data/elements';
import { addXp } from './progression';
import {
  dragonsIn,
  fail,
  ok,
  timerRemainingMs,
  type Dragon,
  type GameState,
  type Habitat,
  type Result,
  type Timer,
} from './state';

export function dragonGoldPerMin(d: Dragon): number {
  return SPECIES[d.species].goldPerMin * (1 + BALANCE.goldPerLevel * (d.level - 1));
}

export function habitatRate(state: GameState, h: Habitat): number {
  return dragonsIn(state, h.id).reduce((sum, d) => sum + dragonGoldPerMin(d), 0);
}

export function habitatCap(state: GameState, h: Habitat): number {
  return Math.max(BALANCE.habitatMinCap, Math.round(habitatRate(state, h) * BALANCE.habitatCapMinutes));
}

/** Vàng đang có trong kho chuồng ở thời điểm now (chưa thu). */
export function habitatGold(state: GameState, h: Habitat, now: number): number {
  const minutes = Math.max(0, now - h.lastSettle) / 60000;
  return Math.min(habitatCap(state, h), h.stored + minutes * habitatRate(state, h));
}

/**
 * Chốt sổ: cộng phần vàng đã sinh vào `stored` theo tốc độ CŨ.
 * Phải gọi TRƯỚC mọi thay đổi làm đổi tốc độ (thêm rồng, lên cấp...).
 */
export function settleHabitat(state: GameState, h: Habitat, now: number): void {
  h.stored = habitatGold(state, h, now);
  h.lastSettle = now;
}

export function collectGold(state: GameState, h: Habitat, now: number): Result {
  const amount = Math.floor(habitatGold(state, h, now));
  if (amount < 1) return fail('Chưa có vàng');
  state.gold += amount;
  h.stored = habitatGold(state, h, now) - amount; // giữ phần lẻ
  h.lastSettle = now;
  addXp(state, amount / BALANCE.xp.goldPerXp);
  return ok(`+${amount} vàng`);
}

export function collectAllGold(state: GameState, now: number): number {
  let total = 0;
  for (const b of state.buildings) {
    if (b.type !== 'habitat') continue;
    // đếm theo lượng thu được (không lấy chênh lệch số dư vì lên cấp cũng được thưởng vàng)
    const amount = Math.floor(habitatGold(state, b, now));
    if (collectGold(state, b, now).ok) total += amount;
  }
  return total;
}

export function canLiveIn(speciesElements: Element[], habitatElement: Element): boolean {
  return speciesElements.includes(habitatElement);
}

/** Số kim cương cần để hoàn thành ngay một bộ đếm giờ. */
export function speedUpCost(t: Timer, now: number): number {
  const sec = timerRemainingMs(t, now) / 1000;
  if (sec <= 0) return 0;
  return Math.max(1, Math.ceil(sec / BALANCE.secondsPerGem));
}

export function speedUp(state: GameState, t: Timer, now: number): Result {
  const cost = speedUpCost(t, now);
  if (cost === 0) return fail('Đã xong rồi');
  if (state.gems < cost) return fail(`Cần ${cost} 💎`);
  state.gems -= cost;
  t.startedAt = now - t.durationMs;
  return ok(`-${cost} 💎`);
}
