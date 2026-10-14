// Mọi con số cân bằng game nằm ở đây — chỉnh file này để game dễ/khó hơn.
import type { Element } from './elements';

export const BALANCE = {
  start: { gold: 600, gems: 15, food: 100 },

  maxLevel: 10,
  feedsPerLevel: 4,
  /** thức ăn cho 1 lần ăn = foodPerFeedBase * cấp hiện tại */
  foodPerFeedBase: 5,
  /** thưởng kim cương mỗi lần lên cấp */
  gemsPerLevelUp: 1,

  /** vàng/phút = goldPerMin * (1 + goldPerLevel * (cấp - 1)) */
  goldPerLevel: 0.35,
  /** kho chuồng chứa tối đa bằng N phút sản lượng (ít nhất habitatMinCap) */
  habitatCapMinutes: 30,
  habitatMinCap: 200,
  habitatCapacity: 2,

  breedMinLevel: 4,
  hatcherySlots: 2,
  /** trọng số kết quả lai: thuần dễ ra, lai hiếm hơn */
  breedWeight: { common: 40, rare: 20 },

  /** 1 kim cương = 30 giây tăng tốc */
  secondsPerGem: 30,

  battle: { baseHp: 100, hpPerLevel: 25, baseAtk: 12, atkPerLevel: 3, rareStatMul: 1.2 },

  /** Kinh nghiệm người chơi nhận từ mỗi hành động */
  xp: {
    build: 20,
    feed: 2,
    dragonLevelUp: 10,
    breed: 15,
    hatchCommon: 25,
    hatchRare: 50,
    /** thu hoạch: 1 XP mỗi N thức ăn */
    foodPerXp: 10,
    /** thu vàng: 1 XP mỗi N vàng */
    goldPerXp: 25,
    battleWin: 50,
    battleReplay: 15,
  },
  /** XP cần để lên cấp kế tiếp = xpPerLevel * cấp hiện tại */
  xpPerLevel: 60,
  /** thưởng khi người chơi lên cấp */
  levelReward: { gems: 2, goldPerLevel: 100 },
};

export const HABITAT_COST: Record<Element, number> = { fire: 200, water: 250, earth: 250, plant: 200 };
export const FARM_COST = 120;

export interface Crop {
  id: string;
  name: string;
  cost: number;
  food: number;
  growSec: number;
  model: 'wheat' | 'corn' | 'bushBerries';
}

export const CROPS: Crop[] = [
  { id: 'grass', name: 'Lúa Rồng', cost: 15, food: 20, growSec: 30, model: 'wheat' },
  { id: 'corn', name: 'Ngô Lửa', cost: 50, food: 80, growSec: 120, model: 'corn' },
  { id: 'berry', name: 'Dâu Rừng', cost: 150, food: 220, growSec: 300, model: 'bushBerries' },
];
