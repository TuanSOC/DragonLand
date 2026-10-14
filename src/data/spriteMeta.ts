// Thông số từng ảnh rồng để shader uốn cánh đúng chỗ và hơi thở phun ra từ miệng.
// Toạ độ UV: u = 0 trái → 1 phải; v = 0 dưới → 1 trên (ảnh rồng vẽ hướng sang TRÁI, đã cắt sát).
export interface SpriteMeta {
  /** vị trí miệng (u, v) */
  mouth: [number, number];
  /** tâm thân theo chiều ngang */
  bodyU: number;
  /** khoảng cách ngang từ tâm thân bắt đầu tính là cánh */
  wingInner: number;
  /** cánh chỉ nằm phía trên mức v này */
  wingTop: number;
  /** hệ số biên độ vỗ cánh (0 = tắt khi ảnh không hợp) */
  flapAmp: number;
  /** khoảng trống dưới chân (v) — dời ảnh xuống để chân chạm đất */
  footV: number;
}

/** Mặc định theo giai đoạn: _0 rồng non bò 4 chân, đầu thấp; _1 trưởng thành; _2 huyền thoại đầu cao */
const STAGE_DEFAULT: Record<string, SpriteMeta> = {
  '0': { mouth: [0.16, 0.55], bodyU: 0.5, wingInner: 0.14, wingTop: 0.5, flapAmp: 0.6, footV: 0.02 },
  '1': { mouth: [0.31, 0.69], bodyU: 0.44, wingInner: 0.12, wingTop: 0.45, flapAmp: 1, footV: 0.02 },
  '2': { mouth: [0.36, 0.8], bodyU: 0.47, wingInner: 0.14, wingTop: 0.42, flapAmp: 1, footV: 0.02 },
};

/** Chỉnh riêng từng ảnh (đo trên public/sprites sau khi cắt nền). */
const OVERRIDES: Record<string, Partial<SpriteMeta>> = {
  mud_1: { mouth: [0.33, 0.68] },
  swamp_1: { mouth: [0.31, 0.7] },
  water_1: { mouth: [0.31, 0.7] },
  woodstone_1: { mouth: [0.3, 0.66], bodyU: 0.47 },
};

export function spriteMeta(id: string): SpriteMeta {
  const stage = id.slice(-1);
  return { ...(STAGE_DEFAULT[stage] ?? STAGE_DEFAULT['1']), ...OVERRIDES[id] };
}
