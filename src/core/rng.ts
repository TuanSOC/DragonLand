// Bộ sinh số ngẫu nhiên có seed (LCG) — cùng seed cho cùng dãy số, dùng cho cảnh cố định và test.
import type { Rng } from '../logic/state';

export function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
