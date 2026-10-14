// Hạng đồ hoạ: 'high' cho máy tính, 'low' cho điện thoại / máy yếu (tắt bóng, giảm hạt & sinh vật).
// Đoán lúc khởi động, rồi đo fps 3 giây đầu — tụt dưới ngưỡng thì hạ xuống 'low'.
export type Tier = 'high' | 'low';

export const QUALITY = {
  /** fps trung bình 3s đầu thấp hơn ngưỡng này → hạ hạng */
  minFps: 45,
  probeSeconds: 3,
  /** hệ số số lượng hạt / sinh vật theo hạng */
  density: { high: 1, low: 0.35 } as Record<Tier, number>,
};

export function detectTier(): Tier {
  // ép hạng để thử: ?tier=low / ?tier=high
  const forced = new URLSearchParams(location.search).get('tier');
  if (forced === 'low' || forced === 'high') return forced;
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  return coarse || cores <= 4 ? 'low' : 'high';
}

/** Đo fps trong vài giây đầu; gọi `onLow` một lần nếu máy chạy không nổi. */
export class FpsProbe {
  private frames = 0;
  private elapsed = 0;
  private done = false;

  constructor(private onLow: () => void) {}

  tick(dt: number): void {
    if (this.done) return;
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < QUALITY.probeSeconds) return;
    this.done = true;
    if (this.frames / this.elapsed < QUALITY.minFps) this.onLow();
  }
}
