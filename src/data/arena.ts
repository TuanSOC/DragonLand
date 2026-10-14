// 8 trận đấu trường, khó dần. 3 trận đầu 1v1, sau đó 3v3.
import type { SpeciesId } from './dragons';

export interface ArenaStage {
  name: string;
  team: { species: SpeciesId; level: number }[];
  reward: { gold: number; gems: number };
}

export const ARENA: ArenaStage[] = [
  { name: 'Tập Sự Mộc Lâm', team: [{ species: 'plant', level: 1 }], reward: { gold: 150, gems: 2 } },
  { name: 'Thợ Mỏ Thổ Sơn', team: [{ species: 'earth', level: 2 }], reward: { gold: 250, gems: 2 } },
  { name: 'Ngư Dân Thủy Cung', team: [{ species: 'water', level: 4 }], reward: { gold: 400, gems: 3 } },
  {
    name: 'Bộ Ba Nguyên Tố',
    team: [{ species: 'fire', level: 3 }, { species: 'plant', level: 3 }, { species: 'water', level: 3 }],
    reward: { gold: 600, gems: 4 },
  },
  {
    name: 'Đầm Lầy Sương Mù',
    team: [{ species: 'swamp', level: 4 }, { species: 'mud', level: 4 }, { species: 'earth', level: 5 }],
    reward: { gold: 900, gems: 5 },
  },
  {
    name: 'Hỏa Diệm Sơn',
    team: [{ species: 'lava', level: 5 }, { species: 'fire', level: 6 }, { species: 'blossom', level: 6 }],
    reward: { gold: 1300, gems: 6 },
  },
  {
    name: 'Rừng Đá Cổ',
    team: [{ species: 'woodstone', level: 7 }, { species: 'steam', level: 7 }, { species: 'swamp', level: 7 }],
    reward: { gold: 1800, gems: 8 },
  },
  {
    name: 'Long Vương Đảo Rồng',
    team: [{ species: 'lava', level: 9 }, { species: 'woodstone', level: 9 }, { species: 'steam', level: 10 }],
    reward: { gold: 3000, gems: 15 },
  },
];

export function teamSize(stage: ArenaStage): number {
  return stage.team.length;
}
