// Cá tính rồng theo hệ: trọng số chọn hành vi + tốc độ đi. Rồng lai = trung bình các hệ.
import type { Element } from './elements';

export interface Personality {
  idle: number;
  walk: number;
  sit: number;
  sleep: number;
  roar: number;
  breathe: number;
  fly: number;
  /** hệ số tốc độ đi */
  speed: number;
}

const BY_ELEMENT: Record<Element, Personality> = {
  // Lửa: nóng tính, hay gầm và phun lửa
  fire: { idle: 3, walk: 3, sit: 1, sleep: 1, roar: 2.5, breathe: 2.5, fly: 1, speed: 1.3 },
  // Nước: thích bay lượn
  water: { idle: 3, walk: 3, sit: 1.5, sleep: 1, roar: 1, breathe: 1.5, fly: 2.5, speed: 1.1 },
  // Đất: chậm chạp, chắc chắn, ít bay
  earth: { idle: 4, walk: 2.5, sit: 2, sleep: 1.5, roar: 1.5, breathe: 1, fly: 0.4, speed: 0.7 },
  // Cây: lười, ngủ nhiều
  plant: { idle: 3, walk: 2, sit: 2, sleep: 3, roar: 0.7, breathe: 1.5, fly: 1, speed: 0.9 },
};

export function personalityOf(elements: Element[]): Personality {
  const out = { idle: 0, walk: 0, sit: 0, sleep: 0, roar: 0, breathe: 0, fly: 0, speed: 0 };
  for (const e of elements) {
    for (const k of Object.keys(out) as (keyof Personality)[]) out[k] += BY_ELEMENT[e][k] / elements.length;
  }
  return out;
}
