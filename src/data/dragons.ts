// Danh sách loài rồng. Muốn thêm loài mới chỉ cần thêm vào bảng này.
import type { Element } from './elements';

export type SpeciesId =
  | 'fire' | 'water' | 'earth' | 'plant'
  | 'steam' | 'lava' | 'blossom' | 'mud' | 'swamp' | 'woodstone';

export type Rarity = 'common' | 'rare';

export interface Species {
  id: SpeciesId;
  name: string;
  elements: Element[];
  rarity: Rarity;
  /** vàng/phút ở cấp 1 */
  goldPerMin: number;
  /** thời gian lai tạo và ấp (giây) */
  hatchSec: number;
  /** màu thân chính và màu phụ (bụng/cánh) dùng để tô model GLB */
  colors: { main: string; second: string };
  desc: string;
}

const list: Species[] = [
  { id: 'fire', name: 'Hỏa Long', elements: ['fire'], rarity: 'common', goldPerMin: 10, hatchSec: 30,
    colors: { main: '#e2401c', second: '#ffb43a' }, desc: 'Bờm lửa cháy rực dọc sống lưng, hơi thở thiêu chảy cả đá.' },
  { id: 'water', name: 'Thủy Long', elements: ['water'], rarity: 'common', goldPerMin: 10, hatchSec: 30,
    colors: { main: '#1f7be0', second: '#8fe3ff' }, desc: 'Chúa tể biển sâu, mỗi cú vỗ cánh dấy lên sóng dữ.' },
  { id: 'earth', name: 'Thổ Long', elements: ['earth'], rarity: 'common', goldPerMin: 10, hatchSec: 30,
    colors: { main: '#8a5a2b', second: '#d9b27a' }, desc: 'Giáp đá granite không gì xuyên thủng, bước chân làm rung chuyển mặt đất.' },
  { id: 'plant', name: 'Mộc Long', elements: ['plant'], rarity: 'common', goldPerMin: 10, hatchSec: 30,
    colors: { main: '#2fa83a', second: '#d6f56b' }, desc: 'Cánh lá và gai gỗ, gọi cả cánh rừng nổi giận.' },

  { id: 'steam', name: 'Rồng Hơi Nước', elements: ['fire', 'water'], rarity: 'rare', goldPerMin: 18, hatchSec: 120,
    colors: { main: '#b9c7d6', second: '#ff7a45' }, desc: 'Lò lửa trong ngực phun hơi nước bỏng rát qua các khe giáp.' },
  { id: 'lava', name: 'Rồng Dung Nham', elements: ['fire', 'earth'], rarity: 'rare', goldPerMin: 18, hatchSec: 120,
    colors: { main: '#3a2420', second: '#ff6a00' }, desc: 'Da obsidian nứt toác, dung nham sôi sục bên trong.' },
  { id: 'blossom', name: 'Rồng Hỏa Hoa', elements: ['fire', 'plant'], rarity: 'rare', goldPerMin: 18, hatchSec: 120,
    colors: { main: '#ff4f8b', second: '#ffd23f' }, desc: 'Đôi cánh cánh hoa bốc cháy như phượng hoàng tái sinh.' },
  { id: 'mud', name: 'Rồng Bùn Lầy', elements: ['water', 'earth'], rarity: 'rare', goldPerMin: 18, hatchSec: 150,
    colors: { main: '#5b4a2e', second: '#4fa3b8' }, desc: 'Khoác giáp bùn dày, nanh to xé toạc mọi đầm lầy.' },
  { id: 'swamp', name: 'Rồng Đầm Lầy', elements: ['water', 'plant'], rarity: 'rare', goldPerMin: 18, hatchSec: 150,
    colors: { main: '#2e7d6b', second: '#a8e05f' }, desc: 'Kẻ săn mồi phát quang ẩn mình dưới đầm sâu.' },
  { id: 'woodstone', name: 'Rồng Gỗ Đá', elements: ['earth', 'plant'], rarity: 'rare', goldPerMin: 18, hatchSec: 180,
    colors: { main: '#6d6f3a', second: '#c9a66b' }, desc: 'Cổ thụ nghìn năm hóa rồng, rune hổ phách cháy sáng trên thân đá.' },
];

export const SPECIES: Record<SpeciesId, Species> = Object.fromEntries(list.map((s) => [s.id, s])) as Record<
  SpeciesId,
  Species
>;
export const SPECIES_LIST = list;

export function isHybrid(id: SpeciesId): boolean {
  return SPECIES[id].elements.length > 1;
}

/** Giai đoạn phát triển theo cấp: 0 = non (1-3), 1 = trưởng thành (4-6), 2 = huyền thoại (7+). */
export type Stage = 0 | 1 | 2;

export function stageOf(level: number): Stage {
  return level >= 7 ? 2 : level >= 4 ? 1 : 0;
}

export const STAGE_NAMES = ['Rồng Non', 'Trưởng Thành', 'Huyền Thoại'] as const;
