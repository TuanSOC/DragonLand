// Thông báo nhỏ hiện rồi tự tắt.
import { setRich } from './icons';
export function toast(text: string, kind: 'ok' | 'error' | 'info' | 'level' = 'info'): void {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  setRich(el, text);
  box.appendChild(el);
  setTimeout(() => el.classList.add('hide'), 2200);
  setTimeout(() => el.remove(), 2600);
}
