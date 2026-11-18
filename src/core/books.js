// 兵书：800 关解锁的全军永久加成（三卷：武略 = 攻击 / 兵势 = 生命 / 军纪 = 防御）。
// 纯计算 + 存档读写；斗技场通过 squad 上的 atkScale / hpMult / defScale 三个字段吃加成。
//
// 设计口径：
// - 每卷 10 级、每级 +2%，满级 +20%；三卷互不干扰，玩家自己决定先买哪一卷；
// - 价格几何增长（8000 × 1.6^当前等级），单卷满级约 145 万、三卷约 436 万铜钱；
// - 敌方 800 关起「对等加成」：从 800 关的 0% 线性补到 2000 关的 +20%，之后维持，
//   和玩家单卷满级上限一致 —— 敌方不会无限膨胀，玩家把书买满就能追平。
import { CONFIG } from '../data/config.js';

const B = CONFIG.books;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function bookUnlocked(state) {
  return (Number(state && state.maxCleared) || 0) >= B.unlockLevel;
}

export function bookTrack(id) {
  return B.tracks.find((t) => t.id === id) || null;
}

// 存档里的等级（0 = 还没买过）
export function bookLevel(state, id) {
  const raw = state && state.books ? state.books[id] : 0;
  return Math.max(0, Math.min(B.maxLevel, Math.floor(Number(raw) || 0)));
}

// 当前等级 → 下一级的铜钱价格（level 0 = 买第 1 级）
export function bookUpgradeCost(id, level) {
  if (!bookTrack(id)) return Infinity;
  return Math.round(B.upgrade.base * Math.pow(B.upgrade.growth, Math.max(0, Math.min(B.maxLevel - 1, level))));
}

// 一卷从 0 级买到满级的总价（用于平衡核算 / 测试）
export function bookMaxTotal(id) {
  let total = 0;
  for (let lv = 0; lv < B.maxLevel; lv++) total += bookUpgradeCost(id, lv);
  return total;
}

export function upgradeBook(state, id) {
  if (!bookTrack(id)) return { ok: false, reason: 'unknown' };
  if (!bookUnlocked(state)) return { ok: false, reason: 'locked' };
  const lv = bookLevel(state, id);
  if (lv >= B.maxLevel) return { ok: false, reason: 'max' };
  const cost = bookUpgradeCost(id, lv);
  if (state.coins < cost) return { ok: false, reason: 'poor', cost };
  state.coins -= cost;
  state.books = state.books || { atk: 0, hp: 0, def: 0 };
  state.books[id] = lv + 1;
  return { ok: true, level: lv + 1, cost };
}

// 玩家当前三围加成（0.02 × 等级）
export function bookBonus(state) {
  return {
    atk: B.perLevel * bookLevel(state, 'atk'),
    hp: B.perLevel * bookLevel(state, 'hp'),
    def: B.perLevel * bookLevel(state, 'def'),
  };
}

// 玩家小队的倍率字段（未解锁 / 全 0 时返回 null，避免给每个兵都挂一遍 1.0）
export function playerBookScales(state) {
  const b = bookBonus(state);
  if (!b.atk && !b.hp && !b.def) return null;
  return { atkScale: 1 + b.atk, hpMult: 1 + b.hp, defScale: 1 + b.def };
}

// 敌方对等加成：800 关 0% → 2000 关 +20%（与玩家单卷满级上限一致）
export function enemyBookBonus(stage) {
  const u = clamp01(((Number(stage) || 0) - B.enemy.from) / (B.enemy.fullAt - B.enemy.from));
  return B.maxLevel * B.perLevel * u;
}

export function enemyBookScales(stage) {
  const b = enemyBookBonus(stage);
  if (b <= 0) return null;
  return { atkScale: 1 + b, hpMult: 1 + b, defScale: 1 + b };
}
