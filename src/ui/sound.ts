// Âm thanh tổng hợp bằng WebAudio (không cần file mp3). Có thể tắt trong Hướng dẫn & Cài đặt.
export type Sfx = 'click' | 'coin' | 'ok' | 'error' | 'levelup' | 'evolve' | 'hit' | 'super' | 'hatch' | 'win' | 'lose' | 'roar';

const MUTE_KEY = 'dao-rong-muted';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean): void {
  muted = v;
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
}

/** Một nốt: tần số (Hz), bắt đầu sau `at` giây, dài `dur` giây, có thể trượt tần số tới `to`. */
function note(freq: number, at: number, dur: number, type: OscillatorType = 'triangle', vol = 0.12, to?: number): void {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Tiếng "rè" ngắn cho cú đánh. */
function noise(at: number, dur: number, vol = 0.2): void {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.buffer = buf;
  src.connect(gain).connect(ctx.destination);
  src.start(ctx.currentTime + at);
}

export function sfx(name: Sfx): void {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    return;
  }
  switch (name) {
    case 'click':
      note(660, 0, 0.06, 'square', 0.04);
      break;
    case 'coin':
      note(988, 0, 0.08, 'square', 0.06);
      note(1319, 0.07, 0.18, 'square', 0.06);
      break;
    case 'ok':
      note(523, 0, 0.09);
      note(784, 0.08, 0.14);
      break;
    case 'error':
      note(220, 0, 0.12, 'sawtooth', 0.06);
      note(180, 0.1, 0.16, 'sawtooth', 0.06);
      break;
    case 'levelup':
      [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.09, 0.22, 'triangle', 0.12));
      break;
    case 'evolve':
      note(300, 0, 0.6, 'sawtooth', 0.06, 900);
      [784, 988, 1175, 1568].forEach((f, i) => note(f, 0.45 + i * 0.08, 0.25, 'triangle', 0.1));
      break;
    case 'hatch':
      note(880, 0, 0.05, 'square', 0.05);
      note(660, 0.08, 0.05, 'square', 0.05);
      [523, 784, 1047].forEach((f, i) => note(f, 0.2 + i * 0.1, 0.2));
      break;
    case 'hit':
      noise(0, 0.15, 0.25);
      note(140, 0, 0.15, 'square', 0.08, 60);
      break;
    case 'super':
      noise(0, 0.25, 0.35);
      note(220, 0, 0.3, 'sawtooth', 0.1, 50);
      break;
    case 'win':
      [523, 659, 784, 659, 784, 1047].forEach((f, i) => note(f, i * 0.12, 0.25, 'triangle', 0.12));
      break;
    case 'roar':
      // tiếng gầm: sóng răng cưa trầm trượt xuống + tiếng rè
      note(150, 0, 0.55, 'sawtooth', 0.09, 70);
      note(95, 0.02, 0.6, 'square', 0.05, 55);
      noise(0, 0.45, 0.12);
      break;
    case 'lose':
      [392, 330, 262].forEach((f, i) => note(f, i * 0.2, 0.35, 'sine', 0.12));
      break;
  }
}
