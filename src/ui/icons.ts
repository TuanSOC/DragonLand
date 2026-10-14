// Icon giao diện tranh vẽ (Antigravity vẽ → public/sprites/icon_*.png). Chưa có ảnh thì hiện emoji.
// rich(): đổi emoji trong chuỗi thành icon, để mọi chữ trên UI tự dùng icon mà không phải sửa từng chỗ.
import type { Element } from '../data/elements';
import { hasImage } from '../render/sprites';

export type IconName =
  | 'gold' | 'gem' | 'food' | 'xp' | 'dragon' | 'trophy' | 'build' | 'arena' | 'book' | 'settings' | 'collect'
  | 'fire' | 'water' | 'earth' | 'plant' | 'egg' | 'timer' | 'heart' | 'speed' | 'farm' | 'lock' | 'check';

/** Emoji dự phòng khi chưa có ảnh icon */
const FALLBACK: Record<IconName, string> = {
  gold: '💰', gem: '💎', food: '🍖', xp: '⭐', dragon: '🐉', trophy: '🏆', build: '🏗️', arena: '⚔️',
  book: '📖', settings: '⚙️', collect: '💰', fire: '🔥', water: '💧', earth: '🪨', plant: '🌿',
  egg: '🥚', timer: '⏳', heart: '💞', speed: '⚡', farm: '🌾', lock: '🔒', check: '✅',
};

/** Emoji nào trong chữ thì đổi sang icon nào */
const FROM_EMOJI: Record<string, IconName> = {
  '💰': 'gold', '💎': 'gem', '🍖': 'food', '⭐': 'xp', '✨': 'xp', '🐉': 'dragon', '🏆': 'trophy',
  '🏗': 'build', '⚔': 'arena', '💥': 'arena', '📖': 'book', '⚙': 'settings', '🔥': 'fire', '💧': 'water',
  '🪨': 'earth', '🌿': 'plant', '🥚': 'egg', '🐣': 'egg', '🏠': 'egg', '⏳': 'timer', '⏱': 'timer',
  '💞': 'heart', '❤': 'heart', '⚡': 'speed', '🌾': 'farm', '🌱': 'farm', '🧺': 'farm', '🔒': 'lock', '✅': 'check',
};

const EMOJI_RE = new RegExp(`(${Object.keys(FROM_EMOJI).join('|')})\\uFE0F?`, 'gu');

export type IconSize = 'xs' | 'sm' | 'md' | 'lg';

export function icon(name: IconName, size: IconSize = 'sm'): HTMLElement {
  const id = `icon_${name}`;
  if (hasImage(id)) {
    const img = document.createElement('img');
    img.className = `ico ico-${size}`;
    img.src = `${import.meta.env.BASE_URL}sprites/${id}.png`;
    img.alt = '';
    img.draggable = false;
    return img;
  }
  const span = document.createElement('span');
  span.className = `ico-emoji ico-${size}`;
  span.textContent = FALLBACK[name];
  return span;
}

export function elementIcon(e: Element, size: IconSize = 'sm'): HTMLElement {
  return icon(e, size);
}

/** Tách chuỗi có emoji thành [chữ, icon, chữ, ...]. Chuỗi không có emoji trả về nguyên chuỗi. */
export function rich(text: string): (string | HTMLElement)[] {
  EMOJI_RE.lastIndex = 0;
  if (!EMOJI_RE.test(text)) return [text];
  const out: (string | HTMLElement)[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(icon(FROM_EMOJI[m[1]], 'xs'));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Ghi chữ có emoji vào phần tử (thay toàn bộ nội dung). */
export function setRich(el: HTMLElement, text: string): void {
  el.replaceChildren(...rich(text));
}
