import { describe, expect, it } from 'vitest';
import { seeded } from '../src/core/rng';
import { DragonBrain, type BrainEnv, type BrainEvent, type FlightToken } from '../src/render/behavior';

const DT = 1 / 30;

function env(flight: FlightToken, over: Partial<BrainEnv> = {}): BrainEnv {
  return {
    home: { x: 4, z: 2 },
    center: { x: 0, z: 0 },
    radius: 3.5,
    night: false,
    // cấm ô vuông quanh (8, 2) để thử né công trình
    isFree: (x, z) => Math.hypot(x, z) < 16 && !(x > 6.5 && x < 9.5 && z > 0.5 && z < 3.5),
    flight,
    ...over,
  };
}

function run(brains: DragonBrain[], e: BrainEnv, seconds: number, each?: (b: DragonBrain, ev: BrainEvent[]) => void) {
  for (let i = 0; i < seconds / DT; i++) {
    for (const b of brains) {
      const ev = b.update(DT, e);
      each?.(b, ev);
    }
  }
}

describe('hành vi rồng', () => {
  it('đi lang thang không ra khỏi bán kính, không đứng trong vùng cấm', () => {
    const e = env({ holder: null });
    const b = new DragonBrain(1, ['earth'], seeded(3), 4, 2);
    run([b], e, 300, (br) => {
      if (br.flying) return;
      expect(Math.hypot(br.x - 4, br.z - 2)).toBeLessThanOrEqual(3.5 + 1e-6);
      expect(e.isFree(br.x, br.z)).toBe(true);
    });
  });

  it('không bao giờ có 2 con cùng bay', () => {
    const e = env({ holder: null });
    const brains = [1, 2, 3, 4, 5].map((id) => new DragonBrain(id, ['water'], seeded(id * 7), 4, 2));
    let flewAtAll = false;
    for (let i = 0; i < 600 / DT; i++) {
      for (const b of brains) b.update(DT, e);
      const flying = brains.filter((b) => b.flying).length;
      expect(flying).toBeLessThanOrEqual(1);
      if (flying) flewAtAll = true;
    }
    expect(flewAtAll).toBe(true);
  });

  it('bay xong đáp đúng về nhà, phát sự kiện land, trả vé bay', () => {
    const e = env({ holder: null });
    const b = new DragonBrain(9, ['water'], seeded(11), 4, 2);
    let landed = false;
    run([b], e, 600, (br, ev) => {
      if (ev.includes('land')) {
        landed = true;
        expect(Math.hypot(br.x - 4, br.z - 2)).toBeLessThan(0.1);
        expect(br.y).toBe(0);
        expect(e.flight.holder).toBeNull();
      }
    });
    expect(landed).toBe(true);
  });

  it('ban đêm ngủ nhiều hơn ban ngày, và không bay', () => {
    const sleepShare = (night: boolean) => {
      const e = env({ holder: null }, { night });
      const b = new DragonBrain(1, ['plant'], seeded(5), 4, 2);
      let sleep = 0;
      let flew = false;
      let total = 0;
      run([b], e, 900, (br) => {
        total++;
        if (br.state === 'sleep') sleep++;
        if (br.flying) flew = true;
      });
      return { share: sleep / total, flew };
    };
    const day = sleepShare(false);
    const night = sleepShare(true);
    expect(night.share).toBeGreaterThan(day.share);
    expect(night.flew).toBe(false);
  });

  it('cất cánh lướt mượt từ chỗ đang đứng, không "nhảy cóc" về nhà', () => {
    const e = env({ holder: null });
    const b = new DragonBrain(1, ['water'], seeded(13), 4, 2);
    let prev = { x: b.x, z: b.z };
    let sawTakeoff = false;
    run([b], e, 600, (br) => {
      if (br.state === 'takeoff') sawTakeoff = true;
      // mỗi khung hình (1/30s) không được dịch chuyển quá 1 đơn vị
      expect(Math.hypot(br.x - prev.x, br.z - prev.z)).toBeLessThan(1);
      prev = { x: br.x, z: br.z };
    });
    expect(sawTakeoff).toBe(true);
  });

  it('teleport: đứng yên tại chỗ mới, chạm đất', () => {
    const e = env({ holder: null });
    const b = new DragonBrain(1, ['fire'], seeded(4), 4, 2);
    run([b], e, 5);
    b.teleport(-3, -3);
    expect(b.state).toBe('idle');
    expect(b.y).toBe(0);
    b.update(DT, e);
    expect(Math.hypot(b.x + 3, b.z + 3)).toBeLessThan(0.1);
  });

  it('bấm rồng → react (trừ khi đang bay)', () => {
    const e = env({ holder: null });
    const b = new DragonBrain(1, ['fire'], seeded(2), 4, 2);
    b.react();
    expect(b.state).toBe('react');
    expect(b.update(DT, e)).toContain('react');
  });
});
