// Lưới đặt công trình trên đảo. Đảo hình tròn nằm trong lưới GRID_SIZE x GRID_SIZE.
import { BALANCE, FARM_COST, HABITAT_COST } from '../data/balance';
import type { Element } from '../data/elements';
import { addXp } from './progression';
import { fail, newId, ok, type BuildingType, type GameState, type Result } from './state';

export const GRID_SIZE = 16;
/** bán kính vùng xây được, tính theo ô */
export const BUILD_RADIUS = 7.6;

export const FOOTPRINT: Record<BuildingType, number> = {
  habitat: 2,
  farm: 2,
  hatchery: 2,
  breeding: 3,
};

export function cellInsideIsland(cx: number, cz: number): boolean {
  const c = GRID_SIZE / 2;
  return Math.hypot(cx + 0.5 - c, cz + 0.5 - c) <= BUILD_RADIUS;
}

export function canPlace(state: GameState, type: BuildingType, x: number, z: number, ignoreId?: number): boolean {
  const size = FOOTPRINT[type];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (!cellInsideIsland(x + i, z + j)) return false;
    }
  }
  return !state.buildings.some((b) => {
    if (b.id === ignoreId) return false;
    const s = FOOTPRINT[b.type];
    return x < b.x + s && x + size > b.x && z < b.z + s && z + size > b.z;
  });
}

export type ShopItem = { type: 'habitat'; element: Element } | { type: 'farm' };

export function shopCost(item: ShopItem): number {
  return item.type === 'habitat' ? HABITAT_COST[item.element] : FARM_COST;
}

export function placeBuilding(state: GameState, item: ShopItem, x: number, z: number, now: number): Result {
  const cost = shopCost(item);
  if (state.gold < cost) return fail(`Cần ${cost} vàng`);
  if (!canPlace(state, item.type, x, z)) return fail('Không đặt được ở đây');
  state.gold -= cost;
  if (item.type === 'habitat') {
    state.buildings.push({ id: newId(state), type: 'habitat', element: item.element, x, z, stored: 0, lastSettle: now });
  } else {
    state.buildings.push({ id: newId(state), type: 'farm', x, z, crop: null });
  }
  addXp(state, BALANCE.xp.build);
  return ok('Xây xong!');
}

export function moveBuilding(state: GameState, id: number, x: number, z: number): Result {
  const b = state.buildings.find((v) => v.id === id);
  if (!b) return fail('Không tìm thấy công trình');
  if (!canPlace(state, b.type, x, z, id)) return fail('Không đặt được ở đây');
  b.x = x;
  b.z = z;
  return ok();
}

// re-export để UI không cần import balance riêng
export const HABITAT_CAPACITY = BALANCE.habitatCapacity;
