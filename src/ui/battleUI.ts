// Giao diện màn đấu: thanh máu, nút chiêu, số sát thương bay lên, kết quả.
// Logic đã tính xong cả lượt ngay lập tức; UI giữ máu "đang hiển thị" riêng
// rồi trừ dần theo từng sự kiện để khớp với hoạt cảnh.
import { ARENA } from '../data/arena';
import { SPECIES } from '../data/dragons';
import { ELEMENT_INFO } from '../data/elements';
import type { Game } from '../game';
import { attacksOf, finishBattle, playTurn, type BattleState, type Fighter, type Side } from '../logic/battle';
import type { BattleView } from '../render/battleView';
import { h } from './dom';
import { sfx } from './sound';
import { elementBadges, portrait } from './panels';

export class BattleUI {
  private el = document.getElementById('battle')!;
  private b!: BattleState;
  private hp: Record<Side, number[]> = { player: [], enemy: [] };
  private idx: Record<Side, number> = { player: 0, enemy: 0 };
  private busy = false;
  private result: string | null = null;

  constructor(private game: Game, private view: BattleView, private onExit: () => void) {}

  start(b: BattleState): void {
    this.b = b;
    this.hp = { player: b.player.map((f) => f.hp), enemy: b.enemy.map((f) => f.hp) };
    this.idx = { player: b.pIdx, enemy: b.eIdx };
    this.busy = false;
    this.result = null;
    this.view.clear();
    this.view.setFighter('player', b.player[0]);
    this.view.setFighter('enemy', b.enemy[0]);
    this.el.classList.add('open');
    this.render();
  }

  private team(side: Side): Fighter[] {
    return side === 'player' ? this.b.player : this.b.enemy;
  }

  private fighterCard(side: Side): HTMLElement {
    const team = this.team(side);
    const i = this.idx[side];
    const f = team[i];
    const hp = this.hp[side][i];
    const pct = Math.max(0, (hp / f.maxHp) * 100);
    const color = pct > 50 ? '#4cd964' : pct > 20 ? '#ffcc00' : '#ff3b30';
    return h(
      'div',
      { class: `fighter ${side}` },
      h('div', { class: 'row' }, portrait(f.species, f.level, 'md'), h('div', {}, h('b', {}, SPECIES[f.species].name), ' ', h('span', { class: 'lvl' }, `Cấp ${f.level}`))),
      h('div', { class: 'row' }, ...elementBadges(SPECIES[f.species].elements)),
      h('div', { class: 'hp' }, h('div', { class: 'hp-fill', style: { width: `${pct}%`, background: color } })),
      h('div', { class: 'small' }, `❤ ${hp} / ${f.maxHp}`),
      h(
        'div',
        { class: 'team-dots' },
        team.map((_, k) => h('span', { class: `tdot ${this.hp[side][k] <= 0 ? 'dead' : ''} ${k === i ? 'cur' : ''}` })),
      ),
    );
  }

  private render(): void {
    const me = this.b.player[this.b.pIdx];
    const moves = attacksOf(me).map((a) => {
      const cd = me.cooldowns[a.id] ?? 0;
      const icon = a.element === 'neutral' ? '💥' : ELEMENT_INFO[a.element].icon;
      return h(
        'button',
        {
          class: `move ${a.element}`,
          disabled: this.busy || cd > 0 || !!this.b.over,
          onclick: () => void this.attack(a.id),
        },
        h('div', {}, `${icon} ${a.name}`),
        h('div', { class: 'small' }, cd > 0 ? `⏳ hồi ${cd} lượt` : `Sức mạnh ${a.power}`),
      );
    });
    const resultBox = this.result
      ? h(
          'div',
          { class: 'result' },
          h('div', { class: 'result-box' }, h('h2', {}, this.b.over === 'win' ? '🏆 CHIẾN THẮNG!' : '💀 THẤT BẠI'), h('p', {}, this.result), h('button', { class: 'btn ok', onclick: () => this.exit() }, '🏝️ Về đảo')),
        )
      : '';
    this.el.replaceChildren(
      h('div', { class: 'battle-top' }, this.fighterCard('player'), h('div', { class: 'vs' }, 'VS'), this.fighterCard('enemy')),
      h('div', { class: 'battle-stage-name' }, ARENA[this.b.stage].name),
      h(
        'div',
        { class: 'battle-bottom' },
        h('div', { class: 'moves' }, moves),
        h('button', { class: 'btn ghost flee', disabled: this.busy, onclick: () => this.exit() }, '🏳️ Bỏ chạy'),
      ),
      resultBox,
    );
  }

  private popup(side: Side, damage: number, mult: number): void {
    const rect = this.el.getBoundingClientRect();
    const p = this.view.screenPos(side, rect.width, rect.height);
    const tag = mult > 1 ? ' Hiệu quả!' : mult < 1 ? ' Yếu...' : '';
    const el = h('div', { class: `dmg ${mult > 1 ? 'super' : mult < 1 ? 'weak' : ''}`, style: { left: `${p.x}px`, top: `${p.y}px` } }, `-${damage}${tag}`);
    this.el.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  private async attack(attackId: string): Promise<void> {
    if (this.busy || this.b.over) return;
    this.busy = true;
    this.render();
    const events = playTurn(this.b, attackId, this.game.rng);
    for (const ev of events) {
      const target: Side = ev.side === 'player' ? 'enemy' : 'player';
      await this.view.play(ev, () => {
        const i = this.idx[target];
        this.hp[target][i] = Math.max(0, this.hp[target][i] - ev.damage);
        this.popup(target, ev.damage, ev.mult);
        sfx(ev.mult > 1 ? 'super' : 'hit');
        this.render();
      });
      if (ev.switchTo !== undefined) {
        this.idx[target] = ev.switchTo;
        this.view.setFighter(target, this.team(target)[ev.switchTo]);
      }
      this.render();
    }
    this.busy = false;
    if (this.b.over) {
      const snap = this.game.snapshot();
      const r = finishBattle(this.game.state, this.b);
      this.result = r.ok ? (r.msg ?? '') : r.reason;
      sfx(this.b.over === 'win' ? 'win' : 'lose');
      this.game.celebrate(snap);
      this.game.changed();
    }
    this.render();
  }

  private exit(): void {
    this.el.classList.remove('open');
    this.el.replaceChildren();
    this.view.clear();
    this.onExit();
  }
}
