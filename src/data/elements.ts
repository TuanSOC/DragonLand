// Các hệ của rồng và luật khắc chế.

export type Element = 'fire' | 'water' | 'earth' | 'plant';

export const ELEMENTS: Element[] = ['fire', 'water', 'earth', 'plant'];

export const ELEMENT_INFO: Record<Element, { name: string; color: string; icon: string }> = {
  fire: { name: 'Lửa', color: '#ff5a1f', icon: '🔥' },
  water: { name: 'Nước', color: '#2f8cff', icon: '💧' },
  earth: { name: 'Đất', color: '#b07a3c', icon: '🪨' },
  plant: { name: 'Cây', color: '#3fbf3f', icon: '🌿' },
};

// Vòng khắc chế: key khắc value. Lửa > Cây > Đất > Nước > Lửa
export const BEATS: Record<Element, Element> = {
  fire: 'plant',
  plant: 'earth',
  earth: 'water',
  water: 'fire',
};

/**
 * Hệ số sát thương khi chiêu hệ `attack` đánh vào rồng có các hệ `defender`.
 * Khắc = x2, bị khắc = x0.5. Rồng lai có 2 hệ nên nhân dồn, rồi kẹp trong [0.5, 2].
 */
export function elementMultiplier(attack: Element | 'neutral', defender: Element[]): number {
  if (attack === 'neutral') return 1;
  let mult = 1;
  for (const d of defender) {
    if (BEATS[attack] === d) mult *= 2;
    else if (BEATS[d] === attack) mult *= 0.5;
  }
  return Math.min(2, Math.max(0.5, mult));
}
