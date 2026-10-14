// Hệ âm thanh dùng chung: một AudioContext, hai kênh âm lượng (nhạc / hiệu ứng) lưu trong localStorage.
// AudioContext chỉ được tạo sau thao tác đầu tiên của người chơi (chính sách autoplay của trình duyệt).
export type Channel = 'music' | 'sfx';

const KEYS: Record<Channel, string> = { music: 'dao-rong-vol-music', sfx: 'dao-rong-vol-sfx' };
/** mặc định: nhạc nhỏ để không át, hiệu ứng vừa */
const DEFAULT: Record<Channel, number> = { music: 0.35, sfx: 0.8 };
const OLD_MUTE_KEY = 'dao-rong-muted';

function read(ch: Channel): number {
  try {
    const v = localStorage.getItem(KEYS[ch]);
    if (v !== null) return Math.min(1, Math.max(0, Number(v)));
    // bản cũ có nút tắt âm → chuyển thành âm lượng 0
    if (ch === 'sfx' && localStorage.getItem(OLD_MUTE_KEY) === '1') return 0;
  } catch {
    /* bỏ qua */
  }
  return DEFAULT[ch];
}

const volume: Record<Channel, number> = { music: read('music'), sfx: read('sfx') };

let ctx: AudioContext | null = null;
const gains: Partial<Record<Channel, GainNode>> = {};

/** AudioContext (tạo nếu chưa có). Trả null nếu trình duyệt không hỗ trợ. */
export function audioCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    for (const ch of ['music', 'sfx'] as Channel[]) {
      const g = ctx.createGain();
      g.gain.value = volume[ch];
      g.connect(ctx.destination);
      gains[ch] = g;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Điểm nối đầu ra cho một kênh. */
export function channelOut(ch: Channel): GainNode | null {
  return audioCtx() ? gains[ch]! : null;
}

export function getVolume(ch: Channel): number {
  return volume[ch];
}

export function setVolume(ch: Channel, v: number): void {
  volume[ch] = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem(KEYS[ch], String(volume[ch]));
  } catch {
    /* bỏ qua */
  }
  const g = gains[ch];
  if (g && ctx) g.gain.setTargetAtTime(volume[ch], ctx.currentTime, 0.05);
}
