import { describe, expect, it } from 'vitest';
import { moodAt } from '../src/render/sky';

describe('ngày – đêm', () => {
  it('trưa: không sao, đèn tắt, sprite gần như không bị tô màu', () => {
    const m = moodAt(12);
    expect(m.stars).toBe(0);
    expect(m.lantern).toBe(0);
    expect(Math.min(m.light.r, m.light.g, m.light.b)).toBeGreaterThan(0.85); // màu tuyến tính
  });
  it('22h: đêm đầy sao, đèn lồng sáng, sprite tối đi', () => {
    const m = moodAt(22);
    expect(m.stars).toBe(1);
    expect(m.lantern).toBe(1);
    expect(m.light.r).toBeLessThan(0.5);
  });
  it('hoàng hôn nằm giữa ngày và đêm, chuyển mượt', () => {
    const a = moodAt(18.4);
    const b = moodAt(18.6);
    expect(a.stars).toBeGreaterThanOrEqual(0);
    expect(Math.abs(a.sunI - b.sunI)).toBeLessThan(0.2);
  });
  it('giờ âm / quá 24 vẫn đúng chu kỳ', () => {
    expect(moodAt(-2).stars).toBe(moodAt(22).stars);
    expect(moodAt(36).light.getHexString()).toBe(moodAt(12).light.getHexString());
  });
});
