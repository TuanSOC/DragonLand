// Công cụ test nhanh — chỉ hiện khi mở game với ?dev=1 trong URL.
import { BALANCE } from '../data/balance';
import { SPECIES_LIST } from '../data/dragons';
import type { Game } from '../game';
import { settleHabitat } from '../logic/economy';
import { addXp, xpToNext } from '../logic/progression';
import { ok, type GameState, type Timer } from '../logic/state';
import { h } from './dom';
import type { Panels } from './panels';

function allTimers(s: GameState): Timer[] {
  const list: Timer[] = [];
  for (const b of s.buildings) {
    if (b.type === 'farm' && b.crop) list.push(b.crop);
    if (b.type === 'breeding' && b.job) list.push(b.job);
    if (b.type === 'hatchery') list.push(...b.eggs);
  }
  return list;
}

export function setupDevTools(game: Game, panels: Panels, hooks: { flyNow(): void }): void {
  if (!new URLSearchParams(location.search).has('dev')) return;
  const btn = h('button', { id: 'btn-dev', title: 'Dev tools' }, '🛠');
  document.body.appendChild(btn);
  btn.onclick = () =>
    panels.open('🛠 Dev tools', () => {
      const action = (label: string, fn: (s: GameState, now: number) => void) =>
        h('button', { class: 'btn ghost', onclick: () => game.act((s, now) => (fn(s, now), ok(label))) }, label);
      return h(
        'div',
        { class: 'grid' },
        action('+5000 💰 +100 💎 +2000 🍖', (s) => {
          s.gold += 5000;
          s.gems += 100;
          s.food += 2000;
        }),
        action('⏩ Xong mọi bộ đếm', (s, now) => {
          for (const t of allTimers(s)) t.startedAt = now - t.durationMs;
        }),
        action('🐉 Mọi rồng +3 cấp', (s, now) => {
          for (const b of s.buildings) if (b.type === 'habitat') settleHabitat(s, b, now);
          for (const d of s.dragons) {
            d.level = Math.min(BALANCE.maxLevel, d.level + 3);
            d.feeds = 0;
          }
        }),
        action('⭐ +1 cấp người chơi', (s) => {
          addXp(s, xpToNext(s.playerLevel) - s.xp);
        }),
        h('button', { class: 'btn ghost', onclick: () => { hooks.flyNow(); panels.close(); } }, '🕊 Gọi 1 rồng bay'),
        action('🐉 +6 rồng (test hiệu năng)', (s) => {
          // bỏ qua giới hạn chuồng — chỉ để đo fps trên save dev
          const homes = s.buildings.filter((b) => b.type === 'habitat');
          if (!homes.length) return;
          const kinds = SPECIES_LIST.map((x) => x.id);
          for (let i = 0; i < 6; i++) {
            const home = homes[i % homes.length];
            s.dragons.push({ id: s.nextId++, species: kinds[i % kinds.length], level: 4, feeds: 0, habitatId: home.id });
          }
        }),
        action('⏱ Tua nhanh 30 phút', (s) => {
          // dời mọi mốc thời gian lùi lại 30 phút = như đã trôi qua 30 phút
          const shift = 30 * 60_000;
          for (const t of allTimers(s)) t.startedAt -= shift;
          for (const b of s.buildings) if (b.type === 'habitat') b.lastSettle -= shift;
        }),
      );
    });
}
