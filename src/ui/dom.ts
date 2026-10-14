// Hàm nhỏ để tạo phần tử DOM gọn hơn: h('button', { class: 'btn', onclick }, 'Bấm')
type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k === 'class') {
      el.className = String(v);
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

/** Thanh tiến độ tự cập nhật theo thời gian thật (xem liveUpdate trong panels). */
export function timerBar(startedAt: number, durationMs: number): HTMLElement {
  return h(
    'div',
    { class: 'bar' },
    h('div', { class: 'bar-fill', 'data-start': startedAt, 'data-dur': durationMs }),
    h('span', { class: 'bar-text', 'data-until': startedAt + durationMs }),
  );
}
