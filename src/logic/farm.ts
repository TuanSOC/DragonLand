// Ruộng trồng thức ăn và cho rồng ăn để lên cấp.
import { BALANCE, CROPS } from '../data/balance';
import { settleHabitat } from './economy';
import { addXp } from './progression';
import { fail, findBuilding, findDragon, ok, timerDone, type GameState, type Result } from './state';

export function plantCrop(state: GameState, farmId: number, cropId: string, now: number): Result {
  const farm = findBuilding(state, farmId, 'farm');
  const crop = CROPS.find((c) => c.id === cropId);
  if (!farm || !crop) return fail('Không hợp lệ');
  if (farm.crop) return fail('Ruộng đang trồng');
  if (state.gold < crop.cost) return fail(`Cần ${crop.cost} vàng`);
  state.gold -= crop.cost;
  farm.crop = { cropId, startedAt: now, durationMs: crop.growSec * 1000 };
  return ok(`Đã gieo ${crop.name}`);
}

export function harvest(state: GameState, farmId: number, now: number): Result {
  const farm = findBuilding(state, farmId, 'farm');
  if (!farm?.crop) return fail('Ruộng trống');
  if (!timerDone(farm.crop, now)) return fail('Chưa chín');
  const crop = CROPS.find((c) => c.id === farm.crop!.cropId);
  const food = crop?.food ?? 0;
  state.food += food;
  farm.crop = null;
  addXp(state, food / BALANCE.xp.foodPerXp);
  return ok(`+${food} thức ăn`);
}

export function feedCost(level: number): number {
  return BALANCE.foodPerFeedBase * level;
}

export function feedDragon(state: GameState, dragonId: number, now: number): Result {
  const d = findDragon(state, dragonId);
  if (!d) return fail('Không có rồng');
  if (d.level >= BALANCE.maxLevel) return fail('Đã cấp tối đa');
  const cost = feedCost(d.level);
  if (state.food < cost) return fail(`Cần ${cost} thức ăn`);
  state.food -= cost;
  d.feeds++;
  addXp(state, BALANCE.xp.feed);
  if (d.feeds >= BALANCE.feedsPerLevel) {
    // lên cấp làm đổi tốc độ sinh vàng → chốt sổ chuồng trước
    const h = findBuilding(state, d.habitatId, 'habitat');
    if (h) settleHabitat(state, h, now);
    d.level++;
    d.feeds = 0;
    state.gems += BALANCE.gemsPerLevelUp;
    addXp(state, BALANCE.xp.dragonLevelUp);
    return ok(`Lên cấp ${d.level}! +${BALANCE.gemsPerLevelUp} 💎`);
  }
  return ok('Ngon quá!');
}
