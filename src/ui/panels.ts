// Các bảng (panel) tương tác: chuồng, ruộng, lò ấp, núi lai, cửa hàng, đấu trường, sổ rồng.
// Mỗi panel là một hàm render() trả về DOM; panel tự render lại khi state đổi.
// Đồng hồ đếm ngược / thanh tiến độ cập nhật nhẹ bằng liveUpdate() mà không render lại.
import { ARENA } from '../data/arena';
import { BALANCE, CROPS, FARM_COST, HABITAT_COST } from '../data/balance';
import { SPECIES, SPECIES_LIST, STAGE_NAMES, stageOf, type SpeciesId } from '../data/dragons';
import { hasSprite } from '../render/sprites';
import { getVolume, setVolume, type Channel } from './audio';
import { sfx } from './sound';
import { BEATS, ELEMENTS, ELEMENT_INFO, type Element } from '../data/elements';
import type { Game } from '../game';
import { attacksOf } from '../logic/battle';
import { breedingOutcomes, collectBreedingEgg, startBreeding } from '../logic/breeding';
import { collectGold, dragonGoldPerMin, habitatCap, habitatGold, habitatRate, speedUp, speedUpCost } from '../logic/economy';
import { feedCost, feedDragon, harvest, plantCrop } from '../logic/farm';
import { HABITAT_CAPACITY, type ShopItem } from '../logic/grid';
import { hatchEgg, moveDragon, validHabitatsFor } from '../logic/hatchery';
import { dragonsIn, findBuilding, timerDone, type Dragon, type GameState, type Habitat, type Timer } from '../logic/state';
import { h, timerBar } from './dom';
import { fmtNum, fmtTime } from './format';

export interface PanelHooks {
  /** vừa thu được tài nguyên từ công trình → hiệu ứng bay vào HUD */
  gain(kind: 'gold' | 'food', buildingId: number, amount: number): void;
  place(item: ShopItem): void;
  move(buildingId: number): void;
  battle(stage: number, dragonIds: number[]): void;
}

export function elementBadges(els: Element[]): HTMLElement[] {
  return els.map((e) =>
    h('span', { class: 'badge', style: { background: ELEMENT_INFO[e].color } }, `${ELEMENT_INFO[e].icon} ${ELEMENT_INFO[e].name}`),
  );
}

function swatch(species: SpeciesId): HTMLElement {
  const c = SPECIES[species].colors;
  return h('span', { class: 'swatch', style: { background: `linear-gradient(135deg, ${c.main} 55%, ${c.second} 55%)` } });
}

/** Ảnh chân dung rồng: dùng sprite đúng giai đoạn, thiếu thì lấy giai đoạn khác, không có thì chấm màu. */
export function portrait(species: SpeciesId, level = 4, size: 'sm' | 'md' | 'lg' = 'sm'): HTMLElement {
  const order = [stageOf(level), 1, 0, 2];
  const stage = order.find((st) => hasSprite(`${species}_${st}`));
  if (stage === undefined) return swatch(species);
  return h('img', { class: `portrait ${size}`, src: `${import.meta.env.BASE_URL}sprites/${species}_${stage}.png`, alt: SPECIES[species].name });
}

export function habitatName(hb: Habitat): string {
  return `Chuồng ${ELEMENT_INFO[hb.element].name} #${hb.id}`;
}

export class Panels {
  private root = document.getElementById('panel')!;
  private titleEl = document.getElementById('panel-title')!;
  private body = document.getElementById('panel-body')!;
  private render: (() => HTMLElement) | null = null;
  private lastRender = 0;

  // lựa chọn đang dở trong bảng lai tạo / đấu trường (giữ lại khi render lại)
  private breedA: number | null = null;
  private breedB: number | null = null;
  private team = new Set<number>();
  private resetArmed = false;

  constructor(private game: Game, private hooks: PanelHooks) {
    document.getElementById('panel-close')!.addEventListener('click', () => this.close());
    // chỉ đóng khi cả lúc nhấn lẫn lúc thả đều ở nền tối (tránh đóng nhầm khi nội dung vừa vẽ lại)
    let downOnBackdrop = false;
    this.root.addEventListener('pointerdown', (e) => (downOnBackdrop = e.target === this.root));
    this.root.addEventListener('click', (e) => {
      if (downOnBackdrop && e.target === this.root) this.close();
    });
  }

  private get s(): GameState {
    return this.game.state;
  }

  get isOpen(): boolean {
    return this.render !== null;
  }

  open(title: string, render: () => HTMLElement): void {
    this.titleEl.textContent = title;
    this.render = render;
    this.root.classList.add('open');
    this.refresh();
  }

  close(): void {
    this.render = null;
    this.root.classList.remove('open');
    this.body.replaceChildren();
  }

  refresh(): void {
    if (!this.render) return;
    // đang chọn trong <select> thì đừng render lại kẻo đóng dropdown
    if (this.body.contains(document.activeElement) && document.activeElement?.tagName === 'SELECT') return;
    const scroll = this.body.scrollTop;
    this.body.replaceChildren(this.render());
    this.body.scrollTop = scroll;
    this.lastRender = Date.now();
    const now = this.game.now();
    this.body.querySelectorAll<HTMLElement>('[data-until]').forEach((el) => {
      if (Number(el.dataset.until) > now) el.dataset.pending = '1';
    });
    this.liveUpdate(now);
  }

  /** Gọi vài lần mỗi giây: cập nhật số liệu chạy theo giờ; xong bộ đếm nào thì render lại. */
  tick(): void {
    if (!this.render) return;
    const now = this.game.now();
    const finished = [...this.body.querySelectorAll<HTMLElement>('[data-pending="1"]')].some(
      (el) => Number(el.dataset.until) <= now,
    );
    // vẽ lại định kỳ (cập nhật giá tăng tốc) chỉ khi bảng có đồng hồ đang chạy
    const hasTimers = this.body.querySelector('[data-pending="1"]') !== null;
    if (finished || (hasTimers && now - this.lastRender > 5000)) this.refresh();
    else this.liveUpdate(now);
  }

  private liveUpdate(now: number): void {
    this.body.querySelectorAll<HTMLElement>('[data-until]').forEach((el) => {
      const left = Number(el.dataset.until) - now;
      el.textContent = left > 0 ? fmtTime(left) : 'Xong!';
    });
    this.body.querySelectorAll<HTMLElement>('[data-start]').forEach((el) => {
      const p = (now - Number(el.dataset.start)) / Number(el.dataset.dur);
      el.style.width = `${Math.min(100, Math.max(0, p * 100))}%`;
    });
    this.body.querySelectorAll<HTMLElement>('[data-hab-gold]').forEach((el) => {
      const hb = findBuilding(this.s, Number(el.dataset.habGold), 'habitat');
      if (hb) el.textContent = `${fmtNum(habitatGold(this.s, hb, now))} / ${fmtNum(habitatCap(this.s, hb))}`;
    });
  }

  private speedBtn(t: Timer): HTMLElement {
    const cost = speedUpCost(t, this.game.now());
    return h(
      'button',
      { class: 'btn gem', onclick: () => this.game.act((s, now) => speedUp(s, t, now)) },
      `⚡ Xong ngay (${cost} 💎)`,
    );
  }

  // ───────────── Mở panel theo công trình ─────────────
  openBuilding(id: number): void {
    const b = this.s.buildings.find((x) => x.id === id);
    if (!b) return;
    if (b.type === 'habitat') this.open(`${ELEMENT_INFO[b.element].icon} ${habitatName(b)}`, () => this.habitat(id));
    else if (b.type === 'farm') this.open('🌾 Ruộng Thức Ăn', () => this.farm(id));
    else if (b.type === 'hatchery') this.open('🐣 Lò Ấp Trứng', () => this.hatchery());
    else this.open('💞 Núi Lai Tạo', () => this.breeding(id));
  }

  private habitat(id: number): HTMLElement {
    const hb = findBuilding(this.s, id, 'habitat');
    if (!hb) return h('div', {}, 'Không còn chuồng này');
    const dragons = dragonsIn(this.s, id);
    return h(
      'div',
      {},
      h(
        'div',
        { class: 'row card' },
        h('div', { class: 'grow' }, h('div', { class: 'big', 'data-hab-gold': id }), h('div', { class: 'muted' }, `+${fmtNum(habitatRate(this.s, hb))} vàng/phút`)),
        h('button', { class: 'btn gold', onclick: () => {
            const amount = Math.floor(habitatGold(this.s, hb, this.game.now()));
            if (this.game.act((s, now) => collectGold(s, hb, now), { sfx: 'coin' })) this.hooks.gain('gold', id, amount);
          } }, '💰 Thu vàng'),
        h('button', { class: 'btn ghost', onclick: () => { this.close(); this.hooks.move(id); } }, '⇄ Di chuyển'),
      ),
      h('h3', {}, `Rồng trong chuồng (${dragons.length}/${HABITAT_CAPACITY})`),
      dragons.map((d) => this.dragonCard(d)),
      dragons.length < HABITAT_CAPACITY
        ? h('div', { class: 'card empty' }, 'Còn chỗ trống — lai tạo & ấp trứng để có rồng mới')
        : null,
    );
  }

  private dragonCard(d: Dragon): HTMLElement {
    const sp = SPECIES[d.species];
    const max = d.level >= BALANCE.maxLevel;
    const cost = feedCost(d.level);
    const others = validHabitatsFor(this.s, d.species, d.id).filter((x) => x.id !== d.habitatId);
    const dots = Array.from({ length: BALANCE.feedsPerLevel }, (_, i) => h('span', { class: `dot ${i < d.feeds ? 'on' : ''}` }));
    return h(
      'div',
      { class: 'card dragon' },
      h('div', { class: 'row' }, portrait(d.species, d.level, 'md'), h('div', { class: 'grow' }, h('div', { class: 'row' }, h('b', {}, sp.name), h('span', { class: 'lvl' }, `Cấp ${d.level}`)), h('div', { class: 'row' }, h('span', { class: 'stage' }, STAGE_NAMES[stageOf(d.level)]), ...elementBadges(sp.elements)))),
      h('div', { class: 'row muted' }, `💰 ${fmtNum(dragonGoldPerMin(d))}/phút · ⚔️ ${attacksOf(d).map((a) => a.name).join(', ')}`),
      h(
        'div',
        { class: 'row' },
        max ? h('span', { class: 'muted' }, '⭐ Cấp tối đa') : h('span', { class: 'dots' }, dots),
        h('span', { class: 'grow' }),
        max
          ? null
          : h('button', { class: 'btn food', onclick: () => this.game.act((s, now) => feedDragon(s, d.id, now)) }, `🍖 Cho ăn (${cost})`),
        others.length
          ? h(
              'select',
              {
                class: 'sel',
                onchange: (e: Event) => {
                  const v = Number((e.target as HTMLSelectElement).value);
                  (e.target as HTMLSelectElement).blur();
                  if (v) this.game.act((s, now) => moveDragon(s, d.id, v, now));
                },
              },
              h('option', { value: '' }, 'Chuyển chuồng…'),
              others.map((o) => h('option', { value: o.id }, habitatName(o))),
            )
          : null,
      ),
    );
  }

  private farm(id: number): HTMLElement {
    const farm = findBuilding(this.s, id, 'farm');
    if (!farm) return h('div', {}, 'Không còn ruộng này');
    const move = h('button', { class: 'btn ghost', onclick: () => { this.close(); this.hooks.move(id); } }, '⇄ Di chuyển');
    if (farm.crop) {
      const crop = CROPS.find((c) => c.id === farm.crop!.cropId)!;
      const done = timerDone(farm.crop, this.game.now());
      return h(
        'div',
        {},
        h('div', { class: 'card' }, h('b', {}, `${crop.name} → 🍖 ${crop.food}`), timerBar(farm.crop.startedAt, farm.crop.durationMs)),
        h(
          'div',
          { class: 'row' },
          done
            ? h('button', { class: 'btn food', onclick: () => {
                if (this.game.act((s, now) => harvest(s, id, now), { sfx: 'coin' })) this.hooks.gain('food', id, crop.food);
              } }, '🧺 Thu hoạch')
            : this.speedBtn(farm.crop),
          move,
        ),
      );
    }
    return h(
      'div',
      {},
      h('p', { class: 'muted' }, `Đang có 🍖 ${fmtNum(this.s.food)} thức ăn. Chọn cây để gieo:`),
      CROPS.map((c) =>
        h(
          'div',
          { class: 'card row' },
          h('div', { class: 'grow' }, h('b', {}, c.name), h('div', { class: 'muted' }, `⏱ ${fmtTime(c.growSec * 1000)} · 🍖 +${c.food}`)),
          h('button', { class: 'btn gold', onclick: () => this.game.act((s, now) => plantCrop(s, id, c.id, now)) }, `Gieo (${c.cost} 💰)`),
        ),
      ),
      h('div', { class: 'row' }, move),
    );
  }

  private hatchery(): HTMLElement {
    const hatch = this.s.buildings.find((b) => b.type === 'hatchery');
    if (!hatch || hatch.type !== 'hatchery') return h('div', {}, 'Không có lò ấp');
    const now = this.game.now();
    return h(
      'div',
      {},
      h('p', { class: 'muted' }, `Ô ấp: ${hatch.eggs.length}/${BALANCE.hatcherySlots}. Trứng có được từ Núi Lai Tạo.`),
      hatch.eggs.length === 0 ? h('div', { class: 'card empty' }, '🥚 Chưa có trứng nào') : null,
      hatch.eggs.map((e) => {
        const sp = SPECIES[e.species];
        const done = timerDone(e, now);
        const homes = validHabitatsFor(this.s, e.species);
        return h(
          'div',
          { class: 'card' },
          h('div', { class: 'row' }, portrait(e.species, 1), h('b', {}, `Trứng ${sp.name}`), ...elementBadges(sp.elements)),
          done
            ? homes.length
              ? h(
                  'div',
                  { class: 'row wrap' },
                  h('span', { class: 'muted' }, 'Nở vào:'),
                  homes.map((hb) =>
                    h('button', { class: 'btn ok', onclick: () => this.game.act((s, t) => hatchEgg(s, e.id, hb.id, t), { sfx: 'hatch' }) }, `🐣 ${habitatName(hb)}`),
                  ),
                )
              : h('div', { class: 'warn' }, `Cần chuồng hệ ${sp.elements.map((x) => ELEMENT_INFO[x].name).join(' hoặc ')} còn chỗ — hãy xây thêm trong 🏗️ Xây dựng`)
            : h('div', {}, timerBar(e.startedAt, e.durationMs), this.speedBtn(e)),
        );
      }),
    );
  }

  private breeding(id: number): HTMLElement {
    const site = findBuilding(this.s, id, 'breeding');
    if (!site) return h('div', {});
    const now = this.game.now();
    if (site.job) {
      const job = site.job;
      const a = this.s.dragons.find((d) => d.id === job.parentA);
      const b = this.s.dragons.find((d) => d.id === job.parentB);
      const done = timerDone(job, now);
      return h(
        'div',
        {},
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'row' }, h('b', {}, `${a ? SPECIES[a.species].name : '?'} 💞 ${b ? SPECIES[b.species].name : '?'}`)),
          done ? h('div', { class: 'big' }, '🥚 Trứng bí ẩn đã sẵn sàng!') : timerBar(job.startedAt, job.durationMs),
        ),
        done
          ? h('button', { class: 'btn ok', onclick: () => this.game.act((s, t) => collectBreedingEgg(s, id, t)) }, '🥚 Đưa trứng vào lò ấp')
          : this.speedBtn(job),
      );
    }

    const dragons = [...this.s.dragons].sort((x, y) => y.level - x.level);
    const eligible = (d: Dragon) => d.level >= BALANCE.breedMinLevel;
    const select = (value: number | null, set: (v: number | null) => void) =>
      h(
        'select',
        {
          class: 'sel wide',
          onchange: (e: Event) => {
            const el = e.target as HTMLSelectElement;
            set(el.value ? Number(el.value) : null);
            el.blur();
            this.refresh();
          },
        },
        h('option', { value: '' }, '— Chọn rồng —'),
        dragons.map((d) =>
          h(
            'option',
            { value: d.id, selected: d.id === value, disabled: !eligible(d) },
            `${SPECIES[d.species].name} (cấp ${d.level})${eligible(d) ? '' : ' 🔒'}`,
          ),
        ),
      );
    const a = this.s.dragons.find((d) => d.id === this.breedA);
    const b = this.s.dragons.find((d) => d.id === this.breedB);
    let preview: HTMLElement | null = null;
    if (a && b && a.id !== b.id) {
      const out = breedingOutcomes(a.species, b.species);
      const total = out.reduce((s, o) => s + o.weight, 0);
      preview = h(
        'div',
        { class: 'card' },
        h('b', {}, 'Có thể ra:'),
        out.map((o) =>
          h('div', { class: 'row' }, portrait(o.species, 1), SPECIES[o.species].name, h('span', { class: 'grow' }), h('span', { class: 'muted' }, `${Math.round((o.weight / total) * 100)}%`)),
        ),
      );
    }
    return h(
      'div',
      {},
      h('p', { class: 'muted' }, `Chọn 2 rồng cấp ${BALANCE.breedMinLevel}+ để lai. Rồng bố mẹ không mất đi.`),
      h('div', { class: 'row' }, select(this.breedA, (v) => (this.breedA = v)), h('span', { class: 'big' }, '💞'), select(this.breedB, (v) => (this.breedB = v))),
      preview,
      h(
        'button',
        {
          class: 'btn ok',
          onclick: () => {
            if (this.breedA === null || this.breedB === null) return;
            const [x, y] = [this.breedA, this.breedB];
            if (this.game.act((s, t) => startBreeding(s, id, x, y, t, this.game.rng))) {
              this.breedA = this.breedB = null;
            }
          },
        },
        '💞 Bắt đầu lai tạo',
      ),
    );
  }

  // ───────────── Cửa hàng ─────────────
  openShop(): void {
    this.open('🏗️ Xây Dựng', () => {
      const items: { item: ShopItem; icon: string; name: string; cost: number; desc: string }[] = [
        ...ELEMENTS.map((e) => ({
          item: { type: 'habitat', element: e } as ShopItem,
          icon: ELEMENT_INFO[e].icon,
          name: `Chuồng ${ELEMENT_INFO[e].name}`,
          cost: HABITAT_COST[e],
          desc: `Nuôi rồng có hệ ${ELEMENT_INFO[e].name}, chứa ${HABITAT_CAPACITY} con`,
        })),
        { item: { type: 'farm' }, icon: '🌾', name: 'Ruộng', cost: FARM_COST, desc: 'Trồng thức ăn cho rồng' },
      ];
      return h(
        'div',
        { class: 'grid' },
        items.map((it) =>
          h(
            'div',
            { class: 'card shop' },
            h('div', { class: 'shop-icon' }, it.icon),
            h('b', {}, it.name),
            h('div', { class: 'muted small' }, it.desc),
            h(
              'button',
              {
                class: 'btn gold',
                disabled: this.s.gold < it.cost,
                onclick: () => {
                  this.close();
                  this.hooks.place(it.item);
                },
              },
              `${fmtNum(it.cost)} 💰`,
            ),
          ),
        ),
      );
    });
  }

  // ───────────── Đấu trường ─────────────
  openArena(): void {
    this.open('⚔️ Đấu Trường', () =>
      h(
        'div',
        {},
        h('p', { class: 'muted' }, `Khắc chế: ${ELEMENTS.map((e) => `${ELEMENT_INFO[e].icon}>${ELEMENT_INFO[BEATS[e]].icon}`).join('  ')} (x2 sát thương)`),
        ARENA.map((st, i) => {
          const won = i < this.s.arenaWins;
          const open = i <= this.s.arenaWins;
          return h(
            'div',
            { class: `card row ${open ? '' : 'locked'}` },
            h('div', { class: 'stage-no' }, won ? '✅' : open ? `${i + 1}` : '🔒'),
            h(
              'div',
              { class: 'grow' },
              h('b', {}, st.name),
              h('div', { class: 'row wrap small' }, st.team.map((t) => h('span', { class: 'chip' }, portrait(t.species, t.level), `${SPECIES[t.species].name} Lv${t.level}`))),
              h('div', { class: 'muted small' }, won ? `Đánh lại: +${Math.floor(st.reward.gold / 2)} 💰` : `Thưởng: +${st.reward.gold} 💰 +${st.reward.gems} 💎`),
            ),
            open ? h('button', { class: 'btn ok', onclick: () => this.openTeam(i) }, 'Chọn') : null,
          );
        }),
      ),
    );
  }

  private openTeam(stage: number): void {
    const st = ARENA[stage];
    const size = st.team.length;
    this.team.clear();
    this.open(`⚔️ ${st.name} — chọn ${size} rồng`, () => {
      const enemyEls = new Set(st.team.flatMap((t) => SPECIES[t.species].elements));
      const counters = ELEMENTS.filter((e) => [...enemyEls].includes(BEATS[e]));
      return h(
        'div',
        {},
        h('p', { class: 'muted' }, `Gợi ý: dùng rồng hệ ${counters.map((e) => ELEMENT_INFO[e].icon + ELEMENT_INFO[e].name).join(', ') || 'bất kỳ'}`),
        [...this.s.dragons]
          .sort((a, b) => b.level - a.level)
          .map((d) => {
            const picked = this.team.has(d.id);
            return h(
              'div',
              {
                class: `card row pick ${picked ? 'picked' : ''}`,
                onclick: () => {
                  if (picked) this.team.delete(d.id);
                  else if (this.team.size < size) this.team.add(d.id);
                  this.refresh();
                },
              },
              h('span', { class: `check ${picked ? 'on' : ''}` }),
              portrait(d.species, d.level),
              h('b', {}, SPECIES[d.species].name),
              h('span', { class: 'lvl' }, `Cấp ${d.level}`),
              ...elementBadges(SPECIES[d.species].elements),
            );
          }),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn ghost', onclick: () => this.openArena() }, '← Quay lại'),
          h('span', { class: 'grow' }),
          h(
            'button',
            {
              class: 'btn ok',
              disabled: this.team.size !== size,
              onclick: () => {
                const ids = [...this.team];
                this.close();
                this.hooks.battle(stage, ids);
              },
            },
            `⚔️ Vào trận (${this.team.size}/${size})`,
          ),
        ),
      );
    });
  }

  // ───────────── Sổ rồng ─────────────
  openBook(): void {
    this.open('📖 Sổ Tay Rồng', () =>
      h(
        'div',
        {},
        SPECIES_LIST.map((sp) => {
          const owned = this.s.dragons.filter((d) => d.species === sp.id).length;
          const parents = sp.elements.length > 1 ? sp.elements.map((e) => SPECIES[e as SpeciesId].name).join(' × ') : null;
          return h(
            'div',
            { class: `card ${owned ? '' : 'unknown'}` },
            h('div', { class: 'row' }, portrait(sp.id, 4, 'lg'), h('div', { class: 'grow' }, h('div', { class: 'row' }, h('b', {}, sp.name), h('span', { class: 'grow' }), h('span', { class: 'muted' }, owned ? `Có ${owned}` : 'Chưa có')), h('div', { class: 'row' }, ...elementBadges(sp.elements)))),
            h('div', { class: 'muted small' }, sp.desc),
            h('div', { class: 'small' }, `💰 ${sp.goldPerMin}/phút · 🥚 ${fmtTime(sp.hatchSec * 1000)}${parents ? ` · Lai: ${parents}` : ''}`),
          );
        }),
      ),
    );
  }

  /** Thanh trượt âm lượng 0–100, lưu ngay khi kéo (0 = tắt). */
  private volumeSlider(ch: Channel, label: string): HTMLElement {
    const value = h('b', { class: 'vol-value' }, `${Math.round(getVolume(ch) * 100)}`);
    const input = h('input', {
      type: 'range',
      min: 0,
      max: 100,
      value: Math.round(getVolume(ch) * 100),
      class: 'vol',
      oninput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        setVolume(ch, v / 100);
        value.textContent = String(v);
      },
      onchange: () => sfx('click'),
    });
    return h('label', { class: 'row vol-row' }, h('span', { class: 'vol-label' }, label), input, value);
  }

  // ───────────── Cài đặt / hướng dẫn ─────────────
  openSettings(): void {
    this.resetArmed = false;
    this.open('⚙️ Hướng Dẫn & Cài Đặt', () =>
      h(
        'div',
        {},
        h(
          'ol',
          { class: 'guide' },
          h('li', {}, '🌾 Bấm Ruộng để gieo, chờ chín rồi thu 🍖 thức ăn.'),
          h('li', {}, `🍖 Bấm Chuồng → Cho ăn. Ăn ${BALANCE.feedsPerLevel} lần lên 1 cấp, rồng lớn dần và sinh nhiều vàng hơn.`),
          h('li', {}, `💞 Rồng cấp ${BALANCE.breedMinLevel}+ đem lai ở Núi Lai Tạo → trứng → Lò Ấp → nở rồng mới.`),
          h('li', {}, '🏗️ Xây thêm chuồng đúng hệ để chứa rồng mới.'),
          h('li', {}, '⚔️ Đấu Trường: chọn chiêu khắc hệ đối thủ để thắng lấy 💎.'),
          h('li', {}, 'Kéo chuột trái để xoay, chuột phải để di chuyển, cuộn để phóng to.'),
        ),
        h('p', { class: 'muted small' }, 'Game tự lưu trên trình duyệt. Model 3D: Quaternius & Kenney (CC0).'),
        this.volumeSlider('music', 'Nhạc nền'),
        this.volumeSlider('sfx', 'Hiệu ứng'),
        h(
          'button',
          {
            class: 'btn danger',
            onclick: () => {
              if (!this.resetArmed) {
                this.resetArmed = true;
                this.refresh();
                return;
              }
              this.game.reset();
            },
          },
          this.resetArmed ? 'Bấm lần nữa để XÓA HẾT' : 'Chơi lại từ đầu',
        ),
      ),
    );
  }
}
