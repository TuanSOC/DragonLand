// Chiêu thức theo hệ. Chiêu mạnh mở ở cấp cao và có thời gian hồi (cooldown, tính bằng lượt).
import type { Element } from './elements';

export interface Attack {
  id: string;
  name: string;
  element: Element | 'neutral';
  power: number;
  unlockLevel: number;
  cooldown: number;
}

export const ATTACKS: Attack[] = [
  { id: 'tackle', name: 'Húc Đầu', element: 'neutral', power: 0.8, unlockLevel: 1, cooldown: 0 },

  { id: 'fire1', name: 'Phun Lửa', element: 'fire', power: 1.0, unlockLevel: 1, cooldown: 0 },
  { id: 'fire2', name: 'Cầu Lửa', element: 'fire', power: 1.6, unlockLevel: 4, cooldown: 2 },
  { id: 'fire3', name: 'Bão Lửa', element: 'fire', power: 2.3, unlockLevel: 7, cooldown: 3 },

  { id: 'water1', name: 'Tia Nước', element: 'water', power: 1.0, unlockLevel: 1, cooldown: 0 },
  { id: 'water2', name: 'Sóng Dữ', element: 'water', power: 1.6, unlockLevel: 4, cooldown: 2 },
  { id: 'water3', name: 'Vòi Rồng', element: 'water', power: 2.3, unlockLevel: 7, cooldown: 3 },

  { id: 'earth1', name: 'Ném Đá', element: 'earth', power: 1.0, unlockLevel: 1, cooldown: 0 },
  { id: 'earth2', name: 'Động Đất', element: 'earth', power: 1.6, unlockLevel: 4, cooldown: 2 },
  { id: 'earth3', name: 'Thiên Thạch', element: 'earth', power: 2.3, unlockLevel: 7, cooldown: 3 },

  { id: 'plant1', name: 'Roi Gai', element: 'plant', power: 1.0, unlockLevel: 1, cooldown: 0 },
  { id: 'plant2', name: 'Lá Kiếm', element: 'plant', power: 1.6, unlockLevel: 4, cooldown: 2 },
  { id: 'plant3', name: 'Rừng Giận Dữ', element: 'plant', power: 2.3, unlockLevel: 7, cooldown: 3 },
];

export const ATTACK_BY_ID: Record<string, Attack> = Object.fromEntries(ATTACKS.map((a) => [a.id, a]));
