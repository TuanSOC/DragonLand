import { describe, expect, it } from 'vitest';
import { elementMultiplier } from '../src/data/elements';
import { breedingOutcomes, collectBreedingEgg, rollOutcome, startBreeding } from '../src/logic/breeding';
import { collectGold, habitatCap, habitatGold, speedUp } from '../src/logic/economy';
import { feedCost, feedDragon, harvest, plantCrop } from '../src/logic/farm';
import { canPlace, placeBuilding } from '../src/logic/grid';
import { hatchEgg } from '../src/logic/hatchery';
import { attacksOf, computeDamage, finishBattle, makeFighter, playTurn, startBattle } from '../src/logic/battle';
import { ATTACK_BY_ID } from '../src/data/attacks';
import { createNewGame, type GameState, type Habitat } from '../src/logic/state';
import { BALANCE } from '../src/data/balance';

const T0 = 1_000_000;
const MIN = 60_000;
const fixed = (v: number) => () => v;
const habitats = (s: GameState) => s.buildings.filter((b): b is Habitat => b.type === 'habitat');

describe('khắc chế hệ', () => {
  it('Lửa đánh Cây x2, Cây đánh Lửa x0.5', () => {
    expect(elementMultiplier('fire', ['plant'])).toBe(2);
    expect(elementMultiplier('plant', ['fire'])).toBe(0.5);
    expect(elementMultiplier('fire', ['earth'])).toBe(1);
    expect(elementMultiplier('neutral', ['fire'])).toBe(1);
  });
  it('rồng lai bị kẹp trong [0.5, 2]', () => {
    expect(elementMultiplier('fire', ['plant', 'water'])).toBe(1); // 2 * 0.5
  });
});

describe('vàng', () => {
  it('sinh vàng theo giờ thật và giới hạn kho', () => {
    const s = createNewGame(T0);
    const h = habitats(s)[0];
    expect(habitatGold(s, h, T0 + 2 * MIN)).toBeCloseTo(20); // Hỏa Long cấp 1: 10/phút
    expect(habitatGold(s, h, T0 + 1000 * MIN)).toBe(habitatCap(s, h));
  });
  it('thu vàng cộng vào tài khoản và giữ phần lẻ', () => {
    const s = createNewGame(T0);
    const h = habitats(s)[0];
    const gold = s.gold;
    expect(collectGold(s, h, T0 + 1.05 * MIN).ok).toBe(true);
    expect(s.gold).toBe(gold + 10);
    expect(h.stored).toBeCloseTo(0.5);
  });
  it('lên cấp không làm đổi vàng đã sinh trước đó', () => {
    const s = createNewGame(T0);
    s.food = 1000;
    const h = habitats(s)[0];
    const d = s.dragons.find((x) => x.habitatId === h.id)!;
    for (let i = 0; i < 4; i++) feedDragon(s, d.id, T0 + 5 * MIN);
    expect(d.level).toBe(2);
    expect(habitatGold(s, h, T0 + 5 * MIN)).toBeCloseTo(50);
  });
});

describe('xây dựng', () => {
  it('không đặt chồng lên công trình khác hoặc ra ngoài đảo', () => {
    const s = createNewGame(T0);
    expect(canPlace(s, 'habitat', 6, 7)).toBe(false);
    expect(canPlace(s, 'habitat', 0, 0)).toBe(false);
    expect(canPlace(s, 'habitat', 11, 4)).toBe(true);
  });
  it('trừ vàng khi xây', () => {
    const s = createNewGame(T0);
    const g = s.gold;
    expect(placeBuilding(s, { type: 'habitat', element: 'water' }, 11, 4, T0).ok).toBe(true);
    expect(s.gold).toBe(g - 250);
  });
});

describe('lai tạo', () => {
  it('Lửa x Nước có thể ra Hơi Nước', () => {
    const out = breedingOutcomes('fire', 'water').map((o) => o.species);
    expect(out.sort()).toEqual(['fire', 'steam', 'water']);
  });
  it('Lửa x Lửa chỉ ra Lửa', () => {
    expect(breedingOutcomes('fire', 'fire').map((o) => o.species)).toEqual(['fire']);
  });
  it('rollOutcome theo trọng số', () => {
    const out = breedingOutcomes('fire', 'water');
    expect(rollOutcome(out, fixed(0))).toBe(out[0].species);
    expect(rollOutcome(out, fixed(0.9999))).toBe(out[out.length - 1].species);
  });
  it('cần cấp 4 để lai, rồi trứng vào lò ấp và nở ra rồng', () => {
    const s = createNewGame(T0);
    const site = s.buildings.find((b) => b.type === 'breeding')!;
    const [a, b] = s.dragons;
    expect(startBreeding(s, site.id, a.id, b.id, T0, fixed(0.99)).ok).toBe(false);
    a.level = 4;
    b.level = 4;
    expect(startBreeding(s, site.id, a.id, b.id, T0, fixed(0.99)).ok).toBe(true);
    expect(collectBreedingEgg(s, site.id, T0 + 1000).ok).toBe(false);
    expect(collectBreedingEgg(s, site.id, T0 + 10 * MIN).ok).toBe(true);
    const hatchery = s.buildings.find((x) => x.type === 'hatchery');
    if (hatchery?.type !== 'hatchery') throw new Error('no hatchery');
    const egg = hatchery.eggs[0];
    expect(egg).toBeDefined();
    // chuồng Lửa (đang có 1 rồng) còn chỗ cho loài có hệ Lửa
    const fireHab = habitats(s).find((h) => h.element === 'fire')!;
    const plantHab = habitats(s).find((h) => h.element === 'plant')!;
    const target = egg.species === 'plant' ? plantHab : fireHab;
    expect(hatchEgg(s, egg.id, target.id, egg.startedAt + egg.durationMs).ok).toBe(true);
    expect(s.dragons.length).toBe(3);
  });
  it('tăng tốc bằng kim cương', () => {
    const s = createNewGame(T0);
    const site = s.buildings.find((b) => b.type === 'breeding');
    if (site?.type !== 'breeding') throw new Error();
    s.dragons.forEach((d) => (d.level = 4));
    startBreeding(s, site.id, s.dragons[0].id, s.dragons[1].id, T0, fixed(0));
    const gems = s.gems;
    expect(speedUp(s, site.job!, T0).ok).toBe(true);
    expect(s.gems).toBeLessThan(gems);
    expect(collectBreedingEgg(s, site.id, T0).ok).toBe(true);
  });
});

describe('ruộng và cho ăn', () => {
  it('trồng → chờ → thu thức ăn', () => {
    const s = createNewGame(T0);
    const farm = s.buildings.find((b) => b.type === 'farm')!;
    const food = s.food;
    expect(plantCrop(s, farm.id, 'grass', T0).ok).toBe(true);
    expect(harvest(s, farm.id, T0 + 1000).ok).toBe(false);
    expect(harvest(s, farm.id, T0 + MIN).ok).toBe(true);
    expect(s.food).toBe(food + 20);
  });
  it('ăn đủ 4 lần thì lên cấp và được kim cương', () => {
    const s = createNewGame(T0);
    s.food = 1000;
    const d = s.dragons[0];
    const gems = s.gems;
    for (let i = 0; i < BALANCE.feedsPerLevel; i++) feedDragon(s, d.id, T0);
    expect(d.level).toBe(2);
    expect(s.gems).toBe(gems + 1);
    expect(s.food).toBe(1000 - 4 * feedCost(1));
  });
});

describe('đấu rồng', () => {
  it('công thức sát thương dùng khắc chế', () => {
    const fire = makeFighter('fire', 1);
    const plant = makeFighter('plant', 1);
    const mid = fixed(0.5); // variance = 1
    expect(computeDamage(fire, ATTACK_BY_ID.fire1, plant, mid)).toEqual({ damage: 24, mult: 2 });
    expect(computeDamage(plant, ATTACK_BY_ID.plant1, fire, mid)).toEqual({ damage: 6, mult: 0.5 });
  });
  it('mở chiêu theo cấp, tối đa 4 chiêu', () => {
    expect(attacksOf({ species: 'fire', level: 1 }).map((a) => a.id)).toEqual(['tackle', 'fire1']);
    expect(attacksOf({ species: 'steam', level: 10 }).length).toBe(4);
  });
  it('Hỏa Long thắng trận 1 và nhận thưởng, trận 2 được mở', () => {
    const s = createNewGame(T0);
    const fireDragon = s.dragons.find((d) => d.species === 'fire')!;
    const b = startBattle(s, 0, [fireDragon.id]);
    if ('ok' in b) throw new Error(b.ok ? '' : b.reason);
    let guard = 0;
    while (!b.over && guard++ < 50) playTurn(b, 'fire1', fixed(0.5));
    expect(b.over).toBe('win');
    const gold = s.gold;
    finishBattle(s, b);
    expect(s.arenaWins).toBe(1);
    expect(s.gold).toBe(gold + 150);
  });
  it('không vào được trận chưa mở', () => {
    const s = createNewGame(T0);
    const r = startBattle(s, 3, [1]);
    expect('ok' in r && !r.ok).toBe(true);
  });
});
