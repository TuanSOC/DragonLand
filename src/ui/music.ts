// Nhạc nền tổng hợp (không cần file): thang ngũ cung, tiếng gảy kiểu đàn tranh (Karplus–Strong),
// sáo có rung, nền pad nhẹ, vang. Giai điệu sinh ngẫu nhiên theo câu → không lặp nhàm.
// Màn đấu: trống taiko + gảy dồn dập. Đổi chế độ thì chuyển dần (crossfade).
import { audioCtx, channelOut } from './audio';

export type MusicMode = 'island' | 'battle' | 'off';

/** Ngũ cung Đô (C D E G A) — chỉ số nửa cung tính từ C */
const PENTA = [0, 2, 4, 7, 9];
const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** các nốt dùng cho giai điệu: C4..A5 */
const MELODY = [60, 72].flatMap((base) => PENTA.map((p) => base + p));
/** vòng hợp âm (gốc): C – A – G – E */
const ROOTS = [48, 45, 43, 52];

const LOOKAHEAD = 0.35; // giây lập lịch trước
const TICK_MS = 120;

export class MusicPlayer {
  private mode: MusicMode = 'off';
  private bus: Record<'island' | 'battle', GainNode> | null = null;
  private reverb: ConvolverNode | null = null;
  private plucks = new Map<number, AudioBuffer>();
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private noteIdx = 4;

  /** Bắt đầu / đổi chế độ. Gọi sau thao tác đầu tiên của người chơi. */
  setMode(mode: MusicMode): void {
    if (mode === this.mode) return;
    const ctx = audioCtx();
    const out = channelOut('music');
    if (!ctx || !out) return;
    if (!this.bus) this.setup(ctx, out);
    const prev = this.mode;
    this.mode = mode;
    const now = ctx.currentTime;
    // chuyển dần 1.5s giữa nhạc đảo và nhạc trận
    for (const k of ['island', 'battle'] as const) {
      const g = this.bus![k].gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(k === mode ? 1 : 0, now + 1.5);
    }
    if (prev === 'off' || this.timer === null) {
      this.nextTime = now + 0.1;
      this.step = 0;
      this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    }
  }

  private setup(ctx: AudioContext, out: GainNode): void {
    // vang: xung ồn tắt dần 2.6s
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(out);
    this.bus = { island: ctx.createGain(), battle: ctx.createGain() };
    for (const g of Object.values(this.bus)) {
      g.gain.value = 0;
      g.connect(out);
      g.connect(this.reverb);
    }
  }

  /** Tiếng gảy dây: thuật toán Karplus–Strong tính sẵn thành buffer, cache theo nốt. */
  private pluckBuffer(ctx: AudioContext, midi: number): AudioBuffer {
    let buf = this.plucks.get(midi);
    if (buf) return buf;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 2.2);
    buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const n = Math.max(2, Math.round(sr / midiToHz(midi)));
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    for (let i = n; i < len; i++) d[i] = 0.996 * 0.5 * (d[i - n] + d[i - n + 1]);
    this.plucks.set(midi, buf);
    return buf;
  }

  private pluck(ctx: AudioContext, bus: GainNode, midi: number, t: number, vol: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.pluckBuffer(ctx, midi);
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(bus);
    src.start(t);
    src.onended = () => g.disconnect();
  }

  private flute(ctx: AudioContext, bus: GainNode, midi: number, t: number, dur: number, vol: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midiToHz(midi);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibAmt = ctx.createGain();
    vibAmt.gain.setValueAtTime(0, t);
    vibAmt.gain.linearRampToValueAtTime(midiToHz(midi) * 0.012, t + dur * 0.5); // rung dần
    vib.connect(vibAmt).connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.12);
    g.gain.setValueAtTime(vol, t + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    vib.start(t);
    osc.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
    osc.onended = () => g.disconnect();
  }

  private pad(ctx: AudioContext, bus: GainNode, root: number, t: number, dur: number): void {
    for (const [semi, detune] of [[0, -6], [7, 5], [12, 0]]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midiToHz(root + semi);
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + 1);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(bus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
      osc.onended = () => g.disconnect();
    }
  }

  private drum(ctx: AudioContext, bus: GainNode, t: number, kind: 'taiko' | 'rim'): void {
    if (kind === 'taiko') {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.35);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(g).connect(bus);
      osc.start(t);
      osc.stop(t + 0.5);
      osc.onended = () => g.disconnect();
    } else {
      const len = Math.floor(ctx.sampleRate * 0.08);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.12;
      src.connect(g).connect(bus);
      src.start(t);
      src.onended = () => g.disconnect();
    }
  }

  /** Lập lịch các nốt trong khoảng LOOKAHEAD tới — chạy nhẹ, không phụ thuộc khung hình. */
  private schedule(): void {
    const ctx = audioCtx();
    if (!ctx || !this.bus) return;
    if (this.mode === 'off') {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      return;
    }
    const battle = this.mode === 'battle';
    const bpm = battle ? 120 : 72;
    const eighth = 60 / bpm / 2;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const t = this.nextTime;
      const s = this.step;
      const bar = Math.floor(s / 8);
      const root = ROOTS[bar % ROOTS.length];
      if (battle) {
        const bus = this.bus.battle;
        if (s % 4 === 0) this.drum(ctx, bus, t, 'taiko');
        if (s % 8 === 6) this.drum(ctx, bus, t + eighth / 2, 'taiko');
        if (s % 2 === 1) this.drum(ctx, bus, t, 'rim');
        // gảy dồn dập: rải hợp âm ở quãng thấp
        this.pluck(ctx, bus, root + 12 + [0, 7, 12, 7][s % 4], t, 0.22);
      } else {
        const bus = this.bus.island;
        if (s % 8 === 0) this.pad(ctx, bus, root, t, eighth * 8 + 0.5);
        // giai điệu: đi bước ngẫu nhiên trên thang ngũ cung, thưa nốt
        if (Math.random() > 0.42) {
          this.noteIdx = Math.min(MELODY.length - 1, Math.max(0, this.noteIdx + Math.round((Math.random() - 0.5) * 4)));
          this.pluck(ctx, bus, MELODY[this.noteIdx], t, 0.32);
        }
        // sáo: mỗi 4 ô nhịp ngân vài nốt dài
        if (bar % 4 === 3 && s % 4 === 0) this.flute(ctx, bus, MELODY[Math.min(MELODY.length - 1, this.noteIdx + 2)], t, eighth * 3.5, 0.06);
      }
      this.nextTime += eighth;
      this.step++;
    }
  }
}

export const music = new MusicPlayer();
