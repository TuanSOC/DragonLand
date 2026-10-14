import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { stageOf } from '../src/data/dragons';
import { collectAllGold } from '../src/logic/economy';
import { feedDragon, harvest, plantCrop } from '../src/logic/farm';
import { placeBuilding } from '../src/logic/grid';
import { addXp, xpToNext } from '../src/logic/progression';
import { createNewGame } from '../src/logic/state';

const T0 = 1_000_000;

describe('cấp người chơi', () => {
  it('đủ XP thì lên cấp, nhận thưởng, giữ phần XP dư', () => {
    const s = createNewGame(T0);
    const gems = s.gems;
    const gold = s.gold;
    expect(addXp(s, xpToNext(1) + 5)).toBe(1);
    expect(s.playerLevel).toBe(2);
    expect(s.xp).toBe(5);
    expect(s.gems).toBe(gems + BALANCE.levelReward.gems);
    expect(s.gold).toBe(gold + BALANCE.levelReward.goldPerLevel * 2);
  });
  it('nhiều XP một lúc thì lên nhiều cấp', () => {
    const s = createNewGame(T0);
    expect(addXp(s, xpToNext(1) + xpToNext(2))).toBe(2);
    expect(s.playerLevel).toBe(3);
  });
  it('hành động cho XP: xây, thu hoạch, cho ăn', () => {
    const s = createNewGame(T0);
    placeBuilding(s, { type: 'farm' }, 11, 4, T0);
    expect(s.xp).toBe(BALANCE.xp.build);
    const farm = s.buildings.find((b) => b.type === 'farm')!;
    plantCrop(s, farm.id, 'grass', T0);
    harvest(s, farm.id, T0 + 60_000);
    expect(s.xp).toBe(BALANCE.xp.build + 2);
    feedDragon(s, s.dragons[0].id, T0);
    expect(s.xp).toBe(BALANCE.xp.build + 2 + BALANCE.xp.feed);
  });
  it('thu hết vàng chỉ đếm vàng từ chuồng, không tính vàng thưởng lên cấp', () => {
    const s = createNewGame(T0);
    s.xp = xpToNext(1) - 1; // sắp lên cấp
    const got = collectAllGold(s, T0 + 10 * 60_000);
    expect(got).toBe(200); // 2 chuồng x 10 vàng/phút x 10 phút
  });
});

describe('giai đoạn rồng', () => {
  it('cấp 1-3 non, 4-6 trưởng thành, 7+ huyền thoại', () => {
    expect([1, 3, 4, 6, 7, 10].map(stageOf)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});
