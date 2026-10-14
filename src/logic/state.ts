// Kiểu dữ liệu trạng thái game + tạo game mới.
// Mọi bộ đếm giờ lưu dạng {startedAt, durationMs} theo giờ thật (ms),
// nên tắt game mở lại vẫn tính đúng tiến độ.
import type { Element } from '../data/elements';
import type { SpeciesId } from '../data/dragons';
import { BALANCE } from '../data/balance';

export const SAVE_VERSION = 1;

export interface Timer {
  startedAt: number;
  durationMs: number;
}

export interface Dragon {
  id: number;
  species: SpeciesId;
  level: number;
  /** số lần đã ăn trong cấp hiện tại */
  feeds: number;
  habitatId: number;
}

export interface Egg extends Timer {
  id: number;
  species: SpeciesId;
}

interface BuildingBase {
  id: number;
  /** ô lưới góc trên-trái */
  x: number;
  z: number;
}

export interface Habitat extends BuildingBase {
  type: 'habitat';
  element: Element;
  /** vàng đã "chốt sổ" trong kho, cộng thêm phần sinh ra từ lastSettle tới giờ */
  stored: number;
  lastSettle: number;
}

export interface Farm extends BuildingBase {
  type: 'farm';
  crop: (Timer & { cropId: string }) | null;
}

export interface Hatchery extends BuildingBase {
  type: 'hatchery';
  eggs: Egg[];
}

export interface Breeding extends BuildingBase {
  type: 'breeding';
  job: (Timer & { parentA: number; parentB: number; result: SpeciesId }) | null;
}

export type Building = Habitat | Farm | Hatchery | Breeding;
export type BuildingType = Building['type'];

export interface GameState {
  version: number;
  gold: number;
  gems: number;
  food: number;
  buildings: Building[];
  dragons: Dragon[];
  /** số trận đấu trường đã thắng lần đầu (= trận tiếp theo được mở) */
  arenaWins: number;
  nextId: number;
  /** cấp & kinh nghiệm của người chơi */
  playerLevel: number;
  xp: number;
}

export type Result = { ok: true; msg?: string } | { ok: false; reason: string };
export const ok = (msg?: string): Result => ({ ok: true, msg });
export const fail = (reason: string): Result => ({ ok: false, reason });

export type Rng = () => number;

export function newId(state: GameState): number {
  return state.nextId++;
}

export function findBuilding<T extends BuildingType>(
  state: GameState,
  id: number,
  type?: T,
): Extract<Building, { type: T }> | undefined {
  const b = state.buildings.find((x) => x.id === id);
  if (!b || (type && b.type !== type)) return undefined;
  return b as Extract<Building, { type: T }>;
}

export function findDragon(state: GameState, id: number): Dragon | undefined {
  return state.dragons.find((d) => d.id === id);
}

export function dragonsIn(state: GameState, habitatId: number): Dragon[] {
  return state.dragons.filter((d) => d.habitatId === habitatId);
}

export function timerRemainingMs(t: Timer, now: number): number {
  return Math.max(0, t.startedAt + t.durationMs - now);
}

export function timerDone(t: Timer, now: number): boolean {
  return timerRemainingMs(t, now) === 0;
}

export function timerProgress(t: Timer, now: number): number {
  if (t.durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, (now - t.startedAt) / t.durationMs));
}

export function createNewGame(now: number): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    gold: BALANCE.start.gold,
    gems: BALANCE.start.gems,
    food: BALANCE.start.food,
    buildings: [],
    dragons: [],
    arenaWins: 0,
    nextId: 1,
    playerLevel: 1,
    xp: 0,
  };
  const add = <B extends Building>(b: Omit<B, 'id'>): B => {
    const full = { ...b, id: newId(s) } as B;
    s.buildings.push(full);
    return full;
  };
  add<Breeding>({ type: 'breeding', x: 6, z: 2, job: null });
  add<Hatchery>({ type: 'hatchery', x: 2, z: 6, eggs: [] });
  const fire = add<Habitat>({ type: 'habitat', element: 'fire', x: 6, z: 7, stored: 0, lastSettle: now });
  const plant = add<Habitat>({ type: 'habitat', element: 'plant', x: 9, z: 7, stored: 0, lastSettle: now });
  add<Farm>({ type: 'farm', x: 5, z: 11, crop: null });
  add<Farm>({ type: 'farm', x: 8, z: 11, crop: null });
  s.dragons.push({ id: newId(s), species: 'fire', level: 1, feeds: 0, habitatId: fire.id });
  s.dragons.push({ id: newId(s), species: 'plant', level: 1, feeds: 0, habitatId: plant.id });
  return s;
}
