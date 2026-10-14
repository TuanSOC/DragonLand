// Lai tạo: ghép 2 rồng ra trứng. Kết quả ngẫu nhiên có trọng số.
import { BALANCE } from '../data/balance';
import { SPECIES, SPECIES_LIST, type SpeciesId } from '../data/dragons';
import { addXp } from './progression';
import {
  fail,
  findBuilding,
  findDragon,
  newId,
  ok,
  timerDone,
  type GameState,
  type Result,
  type Rng,
} from './state';

export interface Outcome {
  species: SpeciesId;
  weight: number;
}

/**
 * Các loài có thể ra khi lai A x B.
 * Luật: mọi loài có TẤT CẢ hệ nằm trong tập hệ của bố mẹ, và có ít nhất 1 hệ
 * của mỗi bên bố/mẹ hoặc là loài thuần của một bên.
 */
export function breedingOutcomes(a: SpeciesId, b: SpeciesId): Outcome[] {
  const ea = SPECIES[a].elements;
  const eb = SPECIES[b].elements;
  const pool = new Set([...ea, ...eb]);
  return SPECIES_LIST.filter((s) => {
    if (!s.elements.every((e) => pool.has(e))) return false;
    if (s.elements.length === 1) return true;
    // loài lai phải lấy hệ từ cả hai phía (tránh A thuần x A thuần ra lai)
    return s.elements.some((e) => ea.includes(e)) && s.elements.some((e) => eb.includes(e)) && pool.size > 1;
  }).map((s) => ({ species: s.id, weight: BALANCE.breedWeight[s.rarity] }));
}

export function rollOutcome(outcomes: Outcome[], rng: Rng): SpeciesId {
  const total = outcomes.reduce((s, o) => s + o.weight, 0);
  let r = rng() * total;
  for (const o of outcomes) {
    r -= o.weight;
    if (r < 0) return o.species;
  }
  return outcomes[outcomes.length - 1].species;
}

export function startBreeding(
  state: GameState,
  breedingId: number,
  dragonA: number,
  dragonB: number,
  now: number,
  rng: Rng,
): Result {
  const site = findBuilding(state, breedingId, 'breeding');
  if (!site) return fail('Không có núi lai tạo');
  if (site.job) return fail('Núi đang lai tạo');
  if (dragonA === dragonB) return fail('Chọn 2 rồng khác nhau');
  const a = findDragon(state, dragonA);
  const b = findDragon(state, dragonB);
  if (!a || !b) return fail('Thiếu rồng');
  if (a.level < BALANCE.breedMinLevel || b.level < BALANCE.breedMinLevel) {
    return fail(`Rồng cần cấp ${BALANCE.breedMinLevel} trở lên`);
  }
  const result = rollOutcome(breedingOutcomes(a.species, b.species), rng);
  site.job = { parentA: a.id, parentB: b.id, result, startedAt: now, durationMs: SPECIES[result].hatchSec * 1000 };
  addXp(state, BALANCE.xp.breed);
  return ok('Bắt đầu lai tạo!');
}

/** Lấy trứng từ núi lai bỏ vào lò ấp (cần lò còn chỗ). */
export function collectBreedingEgg(state: GameState, breedingId: number, now: number): Result {
  const site = findBuilding(state, breedingId, 'breeding');
  if (!site?.job) return fail('Chưa có trứng');
  if (!timerDone(site.job, now)) return fail('Chưa lai xong');
  const hatchery = state.buildings.find((b) => b.type === 'hatchery');
  if (!hatchery || hatchery.type !== 'hatchery') return fail('Không có lò ấp');
  if (hatchery.eggs.length >= BALANCE.hatcherySlots) return fail('Lò ấp đã đầy');
  const species = site.job.result;
  hatchery.eggs.push({ id: newId(state), species, startedAt: now, durationMs: SPECIES[species].hatchSec * 1000 });
  site.job = null;
  return ok(`Được trứng ${SPECIES[species].name}!`);
}
