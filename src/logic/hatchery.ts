// Lò ấp: trứng nở xong thì đặt rồng vào chuồng phù hợp.
import { BALANCE } from '../data/balance';
import { SPECIES } from '../data/dragons';
import { canLiveIn, settleHabitat } from './economy';
import { addXp } from './progression';
import {
  dragonsIn,
  fail,
  findBuilding,
  newId,
  ok,
  timerDone,
  type GameState,
  type Habitat,
  type Result,
} from './state';

/** Chuồng còn chỗ và hợp hệ cho loài này. */
export function validHabitatsFor(state: GameState, species: keyof typeof SPECIES, exceptDragonId?: number): Habitat[] {
  const els = SPECIES[species].elements;
  return state.buildings.filter(
    (b): b is Habitat =>
      b.type === 'habitat' &&
      canLiveIn(els, b.element) &&
      dragonsIn(state, b.id).filter((d) => d.id !== exceptDragonId).length < BALANCE.habitatCapacity,
  );
}

export function hatchEgg(state: GameState, eggId: number, habitatId: number, now: number): Result {
  const hatchery = state.buildings.find((b) => b.type === 'hatchery');
  if (!hatchery || hatchery.type !== 'hatchery') return fail('Không có lò ấp');
  const egg = hatchery.eggs.find((e) => e.id === eggId);
  if (!egg) return fail('Không có trứng');
  if (!timerDone(egg, now)) return fail('Trứng chưa nở');
  const habitat = findBuilding(state, habitatId, 'habitat');
  if (!habitat) return fail('Chọn chuồng');
  if (!validHabitatsFor(state, egg.species).some((h) => h.id === habitatId)) {
    return fail('Chuồng không hợp hệ hoặc đã đầy');
  }
  settleHabitat(state, habitat, now);
  state.dragons.push({ id: newId(state), species: egg.species, level: 1, feeds: 0, habitatId });
  hatchery.eggs = hatchery.eggs.filter((e) => e.id !== eggId);
  addXp(state, SPECIES[egg.species].rarity === 'rare' ? BALANCE.xp.hatchRare : BALANCE.xp.hatchCommon);
  return ok(`${SPECIES[egg.species].name} đã nở!`);
}

export function moveDragon(state: GameState, dragonId: number, habitatId: number, now: number): Result {
  const d = state.dragons.find((x) => x.id === dragonId);
  if (!d) return fail('Không có rồng');
  if (d.habitatId === habitatId) return fail('Rồng đang ở đây rồi');
  const target = findBuilding(state, habitatId, 'habitat');
  const from = findBuilding(state, d.habitatId, 'habitat');
  if (!target) return fail('Chọn chuồng');
  if (!validHabitatsFor(state, d.species, d.id).some((h) => h.id === habitatId)) {
    return fail('Chuồng không hợp hệ hoặc đã đầy');
  }
  if (from) settleHabitat(state, from, now);
  settleHabitat(state, target, now);
  d.habitatId = habitatId;
  return ok('Đã chuyển chuồng');
}
