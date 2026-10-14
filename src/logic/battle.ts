// Đấu rồng theo lượt. Người chơi chọn chiêu, AI đáp trả.
// Hàm thuần: nhận BattleState + rng, trả về danh sách sự kiện để màn 3D diễn hoạt.
import { ARENA } from '../data/arena';
import { ATTACKS, ATTACK_BY_ID, type Attack } from '../data/attacks';
import { BALANCE } from '../data/balance';
import { SPECIES, type SpeciesId } from '../data/dragons';
import { elementMultiplier } from '../data/elements';
import { addXp } from './progression';
import { fail, ok, type GameState, type Result, type Rng } from './state';

export interface Fighter {
  dragonId?: number;
  species: SpeciesId;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  /** attackId -> số lượt còn phải chờ */
  cooldowns: Record<string, number>;
}

export type Side = 'player' | 'enemy';

export interface BattleState {
  stage: number;
  player: Fighter[];
  enemy: Fighter[];
  pIdx: number;
  eIdx: number;
  over: null | 'win' | 'lose';
}

export interface TurnEvent {
  side: Side;
  attackId: string;
  damage: number;
  mult: number;
  fainted: boolean;
  /** index rồng mới ra sân bên bị đánh (nếu có) */
  switchTo?: number;
}

export function makeFighter(species: SpeciesId, level: number, dragonId?: number): Fighter {
  const b = BALANCE.battle;
  const mul = SPECIES[species].rarity === 'rare' ? b.rareStatMul : 1;
  const maxHp = Math.round((b.baseHp + b.hpPerLevel * (level - 1)) * mul);
  const atk = Math.round((b.baseAtk + b.atkPerLevel * (level - 1)) * mul);
  return { dragonId, species, level, hp: maxHp, maxHp, atk, cooldowns: {} };
}

/** Tối đa 4 chiêu: chiêu thường + chiêu theo hệ đã mở, ưu tiên chiêu mạnh. */
export function attacksOf(f: Pick<Fighter, 'species' | 'level'>): Attack[] {
  const els = SPECIES[f.species].elements;
  const learned = ATTACKS.filter(
    (a) => a.unlockLevel <= f.level && (a.element === 'neutral' || els.includes(a.element)),
  );
  if (learned.length <= 4) return learned;
  const neutral = learned.filter((a) => a.element === 'neutral');
  const strongest = learned
    .filter((a) => a.element !== 'neutral')
    .sort((x, y) => y.power - x.power)
    .slice(0, 4 - neutral.length);
  return [...neutral, ...strongest];
}

export function canUse(f: Fighter, attackId: string): boolean {
  return (f.cooldowns[attackId] ?? 0) === 0 && attacksOf(f).some((a) => a.id === attackId);
}

export function computeDamage(attacker: Fighter, attack: Attack, defender: Fighter, rng: Rng) {
  const mult = elementMultiplier(attack.element, SPECIES[defender.species].elements);
  const variance = 0.9 + rng() * 0.2;
  const damage = Math.max(1, Math.round(attacker.atk * attack.power * mult * variance));
  return { damage, mult };
}

export function startBattle(state: GameState, stage: number, dragonIds: number[]): BattleState | Result {
  const st = ARENA[stage];
  if (!st) return fail('Không có trận này');
  if (stage > state.arenaWins) return fail('Trận chưa mở khóa');
  const size = st.team.length;
  const unique = [...new Set(dragonIds)];
  if (unique.length !== size) return fail(`Chọn đúng ${size} rồng`);
  const player = unique.map((id) => {
    const d = state.dragons.find((x) => x.id === id);
    return d ? makeFighter(d.species, d.level, d.id) : null;
  });
  if (player.some((p) => !p)) return fail('Rồng không hợp lệ');
  return {
    stage,
    player: player as Fighter[],
    enemy: st.team.map((t) => makeFighter(t.species, t.level)),
    pIdx: 0,
    eIdx: 0,
    over: null,
  };
}

function act(b: BattleState, side: Side, attackId: string, rng: Rng): TurnEvent {
  const me = side === 'player' ? b.player[b.pIdx] : b.enemy[b.eIdx];
  const team = side === 'player' ? b.enemy : b.player;
  const target = side === 'player' ? b.enemy[b.eIdx] : b.player[b.pIdx];
  const attack = ATTACK_BY_ID[attackId];
  const { damage, mult } = computeDamage(me, attack, target, rng);
  target.hp = Math.max(0, target.hp - damage);

  // giảm hồi chiêu của mình rồi đặt hồi cho chiêu vừa dùng
  for (const k of Object.keys(me.cooldowns)) me.cooldowns[k] = Math.max(0, me.cooldowns[k] - 1);
  if (attack.cooldown > 0) me.cooldowns[attack.id] = attack.cooldown;

  const ev: TurnEvent = { side, attackId, damage, mult, fainted: target.hp === 0 };
  if (ev.fainted) {
    const next = team.findIndex((f) => f.hp > 0);
    if (next === -1) b.over = side === 'player' ? 'win' : 'lose';
    else {
      ev.switchTo = next;
      if (side === 'player') b.eIdx = next;
      else b.pIdx = next;
    }
  }
  return ev;
}

/** AI: chọn chiêu sát thương kỳ vọng cao nhất, thỉnh thoảng (20%) chọn ngẫu nhiên. */
export function aiChoose(b: BattleState, rng: Rng): string {
  const me = b.enemy[b.eIdx];
  const target = b.player[b.pIdx];
  const usable = attacksOf(me).filter((a) => canUse(me, a.id));
  if (rng() < 0.2) return usable[Math.floor(rng() * usable.length)].id;
  const score = (a: Attack) => a.power * elementMultiplier(a.element, SPECIES[target.species].elements);
  return usable.reduce((best, a) => (score(a) > score(best) ? a : best)).id;
}

/** Một lượt đầy đủ: người chơi đánh, nếu đối thủ còn sống (và không vừa thay rồng) thì AI đánh lại. */
export function playTurn(b: BattleState, attackId: string, rng: Rng): TurnEvent[] {
  if (b.over) return [];
  if (!canUse(b.player[b.pIdx], attackId)) return [];
  const events = [act(b, 'player', attackId, rng)];
  if (!b.over && !events[0].fainted) {
    events.push(act(b, 'enemy', aiChoose(b, rng), rng));
  }
  return events;
}

/** Nhận thưởng sau trận. Đánh lại trận cũ chỉ được nửa vàng, không có kim cương. */
export function finishBattle(state: GameState, b: BattleState): Result {
  if (b.over !== 'win') return ok('Thua rồi, luyện thêm nhé!');
  const st = ARENA[b.stage];
  const firstWin = b.stage === state.arenaWins;
  const gold = firstWin ? st.reward.gold : Math.floor(st.reward.gold / 2);
  const gems = firstWin ? st.reward.gems : 0;
  state.gold += gold;
  state.gems += gems;
  if (firstWin) state.arenaWins++;
  addXp(state, firstWin ? BALANCE.xp.battleWin : BALANCE.xp.battleReplay);
  return ok(`Thắng! +${gold} vàng${gems ? ` +${gems} 💎` : ''}`);
}
