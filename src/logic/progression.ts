// Cấp người chơi: mọi hành động cho XP, đủ XP thì lên cấp và nhận thưởng.
import { BALANCE } from '../data/balance';
import type { GameState } from './state';

export function xpToNext(level: number): number {
  return BALANCE.xpPerLevel * level;
}

/** Cộng XP, tự lên (nhiều) cấp nếu đủ. Trả về số cấp vừa lên. */
export function addXp(state: GameState, amount: number): number {
  if (amount <= 0) return 0;
  state.xp += Math.floor(amount);
  let gained = 0;
  while (state.xp >= xpToNext(state.playerLevel)) {
    state.xp -= xpToNext(state.playerLevel);
    state.playerLevel++;
    gained++;
    state.gems += BALANCE.levelReward.gems;
    state.gold += BALANCE.levelReward.goldPerLevel * state.playerLevel;
  }
  return gained;
}
