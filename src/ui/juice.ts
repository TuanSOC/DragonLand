// "Juice": phản hồi thị giác cho thao tác — icon bay vào HUD, ô HUD nảy, số đếm chạy dần.
import { fmtNum } from './format';
import { icon, type IconName } from './icons';

/** Tối đa bao nhiêu icon bay mỗi lần (giữ mượt). */
const MAX_FLYERS = 12;

/** Ô HUD nảy nhẹ. */
export function bump(el: HTMLElement): void {
  el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
    { duration: 260, easing: 'ease-out' },
  );
}

/**
 * Bắn `count` icon từ toạ độ màn hình (x, y) bay theo đường cong vào phần tử `target`.
 * Icon cuối tới nơi thì gọi `onArrive` (vd. bump ô HUD).
 */
interface Flyer {
  el: HTMLElement;
  t: number; // giây đã trôi (âm = đang chờ xuất phát)
  dur: number;
  // điểm đầu, điểm toả ra, điểm uốn, điểm đích (đường cong Bézier bậc 3)
  p: [number, number][];
  done?: () => void;
}

const flyers: Flyer[] = [];
let last = 0;

/** Tự tính vị trí mỗi khung hình (không phụ thuộc Web Animations API). */
function step(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    f.t += dt;
    if (f.t < 0) continue;
    const k = Math.min(1, f.t / f.dur);
    const e = k * k * (3 - 2 * k); // nhanh dần rồi chậm lại
    const u = 1 - e;
    const [a, b, c, d] = f.p;
    const x = u * u * u * a[0] + 3 * u * u * e * b[0] + 3 * u * e * e * c[0] + e * e * e * d[0];
    const y = u * u * u * a[1] + 3 * u * u * e * b[1] + 3 * u * e * e * c[1] + e * e * e * d[1];
    const s = k < 0.2 ? 0.4 + k * 3.5 : 1.1 - (k - 0.2) * 0.6;
    f.el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    f.el.style.opacity = String(k < 0.15 ? k / 0.15 : 1);
    if (k >= 1) {
      f.el.remove();
      flyers.splice(i, 1);
      f.done?.();
    }
  }
  if (flyers.length) requestAnimationFrame(step);
}

export function flyIcons(name: IconName, from: { x: number; y: number }, target: HTMLElement, count: number, onArrive?: () => void): void {
  const n = Math.max(1, Math.min(MAX_FLYERS, Math.round(count)));
  const to = target.getBoundingClientRect();
  const tx = to.left + to.width * 0.25;
  const ty = to.top + to.height / 2;
  const wasIdle = flyers.length === 0;
  for (let i = 0; i < n; i++) {
    const el = icon(name, 'sm');
    el.classList.add('flyer');
    el.style.opacity = '0';
    document.body.appendChild(el);
    // toả ra một chút rồi bay vòng lên HUD
    const sx = from.x + (Math.random() - 0.5) * 80;
    const sy = from.y + (Math.random() - 0.5) * 50;
    const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 160;
    const my = Math.min(sy, ty) - 40 - Math.random() * 80;
    flyers.push({
      el,
      t: -i * 0.045,
      dur: 0.65 + Math.random() * 0.2,
      p: [[from.x, from.y], [sx, sy], [mx, my], [tx, ty]],
      done: i === n - 1 ? onArrive : undefined,
    });
  }
  if (wasIdle) {
    last = performance.now();
    requestAnimationFrame(step);
  }
}

/**
 * Số trên HUD chạy dần tới giá trị thật (thay vì nhảy cóc).
 * Gọi `update()` mỗi khung hình; tăng thì ô nảy.
 */
export class Counter {
  private shown: number;
  private target: number;

  constructor(private el: HTMLElement, value: number, private bumpEl: HTMLElement = el) {
    this.shown = value;
    this.target = value;
    el.textContent = fmtNum(value);
  }

  set(value: number): void {
    this.target = value;
  }

  /** Nhảy thẳng tới giá trị (lúc khởi động). */
  snap(value: number): void {
    this.shown = this.target = value;
    this.el.textContent = fmtNum(value);
  }

  update(dt: number): void {
    if (this.shown === this.target) return;
    const before = Math.floor(this.shown);
    const diff = this.target - this.shown;
    // đuổi theo ~0.6s, tối thiểu 1 đơn vị/khung để không kéo dài
    const step = Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dt * 6));
    this.shown = Math.abs(step) >= Math.abs(diff) ? this.target : this.shown + step;
    const now = Math.floor(this.shown);
    if (now !== before) this.el.textContent = fmtNum(now);
    if (this.shown === this.target && diff > 0) bump(this.bumpEl);
  }
}
