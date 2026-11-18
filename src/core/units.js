// 单位规则：属性推导、等级命名、品阶
// 单位只记录「兵种 + 等级」，所有属性由这两项推导
// 等级 1~10 级：同名同等级的两个单位可以合成升一级（见 core/merge.js）

import { CONFIG } from '../data/config.js';

export function troopById(id) {
  return CONFIG.troops.find((t) => t.id === id);
}

// 特殊兵种（稀有/史诗/传奇）挂在某条基础兵种线上：克制、射程、站位都回退到它
export function baseTroopOf(troopId) {
  const t = troopById(troopId);
  return (t && t.baseTroop) || troopId;
}

// 阵型位置（后排）：弓兵线 + 白马义从。
// 注意这是「站位」概念，和 arena 里的 isRangedTroop（是否按远程箭矢结算）分开：
// 两者当前对白马都为 true，但语义不同，别用一个覆盖另一个。
export function isBacklineTroop(troopId) {
  return baseTroopOf(troopId) === 'archer' || troopId === 'baima';
}

export function rarityOf(troopId) {
  const t = troopById(troopId);
  return (t && t.rarity) || 'common';
}

// 稀有度展示信息（名称 + 配色），缺省按普通处理
export function rarityInfo(troopId) {
  return CONFIG.rarity[rarityOf(troopId)] || CONFIG.rarity.common;
}

export function allTroops() {
  return CONFIG.troops;
}

export function maxUnitLevel() {
  return CONFIG.merge.maxLevel;
}

export function statsFor(troopId, level) {
  const t = troopById(troopId);
  if (!t) return { hp: 0, atk: 0, def: 0 };
  // 等级归一化：undefined / null / NaN / 字符串都收敛成 1~10 的整数。
  // 否则 Math.min(maxLevel, NaN) 会得到 NaN，一路传进 troopPower，最后被 formatPower 兜底成 0。
  const n = Number(level);
  const lv = Number.isFinite(n) ? Math.min(maxUnitLevel(), Math.max(1, Math.floor(n))) : 1;
  const k = lv - 1;
  return {
    hp: Math.round(t.base.hp * (1 + k * t.growth.hp)),
    atk: Math.round(t.base.atk * (1 + k * t.growth.atk) * 10) / 10,
    def: Math.round(t.base.def * (1 + k * t.growth.def) * 10) / 10,
  };
}

// 等级 ↔ 命名/品阶档位（1 级 = 第 1 档，10 级 = 第 10 档）
// 仅供 unitName / nextTierInfo 等「兵种命名与详情」使用，勿与精灵档位混用。
export function tierIndexFor(level) {
  const n = Number(level);
  const lv = Number.isFinite(n) ? Math.floor(n) : 1;
  return Math.max(0, Math.min(maxUnitLevel() - 1, lv - 1));
}

/* ---------- 精灵外观档位（4 档） ---------- */
// 精灵表只保留 4 档：Lv1 / Lv3 / Lv6 / Lv9，对应索引 0..3。
// 与 tierIndexFor 的 0..9（命名/详情）是两套东西：命名仍逐级变化，精灵只按 4 档取用，
// 目的是把预生成 PNG 打进主包、减少中低端机启动时的程序化绘制开销。
export const SPRITE_TIER_LEVELS = [1, 3, 6, 9];

// 等级 → 精灵档位索引 0..3：
//   level < 3 → 0（Lv1 档）；3..5 → 1（Lv3 档）；6..8 → 2（Lv6 档）；>=9 → 3（Lv9 档）
// 以 SPRITE_TIER_LEVELS 为准遍历，改档位配置时无需同步改这里的分支。
export function spriteTierFor(level) {
  const n = Number(level);
  const lv = Number.isFinite(n) ? Math.floor(n) : 1;
  let idx = 0;
  for (let i = 0; i < SPRITE_TIER_LEVELS.length; i++) {
    if (lv >= SPRITE_TIER_LEVELS[i]) idx = i;
  }
  return idx;
}

// 兵种名 + 品阶名，例如 1 级 = 新募盾兵，2 级 = 朴刀盾兵
export function unitName(troopId, level) {
  const t = troopById(troopId);
  return t.tiers[tierIndexFor(level)];
}

// 下一级信息：下一级叫什么（满级返回 null）
export function nextTierInfo(troopId, level) {
  const idx = tierIndexFor(level);
  if (idx >= maxUnitLevel() - 1 || level >= maxUnitLevel()) return null;
  return {
    nextLevel: level + 1,
    nextName: troopById(troopId).tiers[idx + 1],
    tierIndex: idx,
  };
}

/* ---------- 兵种等级上限（按关卡档位） ---------- */
// 100~250 关：稀有兵 ≤ Lv4；200~250 关：史诗兵 ≤ Lv5；250 关后放开（见 CONFIG.troopLevelCaps）
export function troopLevelCap(state, troopId) {
  const max = Math.max(0, Math.floor(Number(state && state.maxCleared) || 0));
  const rarity = rarityOf(troopId);
  for (const rule of CONFIG.troopLevelCaps || []) {
    if (rule.rarity === rarity && max >= rule.fromLevel && max < rule.untilLevel) return rule.cap;
  }
  return maxUnitLevel();
}

// 把掉落/购买/广告给的等级夹到上限内（不会出现「能拿到但不能用」的单位）
export function capTroopLevel(state, troopId, level) {
  return Math.min(Math.max(1, Math.floor(level)), troopLevelCap(state, troopId));
}

/* ---------- 兵种解锁 ---------- */
// 解锁关卡：开局兵种 = 0；其余按 CONFIG.troopUnlocks.levels
export function troopUnlockLevel(troopId) {
  const cfg = CONFIG.troopUnlocks;
  if (!cfg) return 0;
  if ((cfg.initial || []).includes(troopId)) return 0;
  const lv = cfg.levels ? cfg.levels[troopId] : 0;
  return Number.isFinite(lv) ? Math.max(0, Math.floor(lv)) : 0;
}

// 已解锁：主线关数达到阈值，或存档里已有显式解锁标记（如签到固定奖励）
export function troopUnlocked(state, troopId) {
  const max = typeof state === 'number'
    ? state
    : Math.max(0, Math.floor(Number(state && state.maxCleared) || 0));
  if (max >= troopUnlockLevel(troopId)) return true;
  return !!(state && typeof state === 'object' && Array.isArray(state.troopUnlocks)
    && state.troopUnlocks.includes(troopId));
}

// 写入「已解锁」标记（幂等）；返回是否为新解锁
export function markTroopUnlocked(state, troopId) {
  if (!state || typeof state !== 'object') return false;
  if (!Array.isArray(state.troopUnlocks)) state.troopUnlocks = [];
  if (state.troopUnlocks.includes(troopId)) return false;
  state.troopUnlocks.push(troopId);
  return true;
}

// 按当前主线进度补齐解锁标记（读档 / 通关后调用）
export function refreshTroopUnlocks(state) {
  if (!state || typeof state !== 'object') return [];
  const out = [];
  for (const t of CONFIG.troops) {
    if (troopUnlockLevel(t.id) <= (state.maxCleared || 0)) out.push(t.id);
  }
  for (const id of out) markTroopUnlocked(state, id);
  return state.troopUnlocks || [];
}

// 某个品级里当前已解锁的兵种（随机来源只从这里抽）
export function unlockedTroops(state, rarity = null) {
  return CONFIG.troops.filter((t) => (rarity ? rarityOf(t.id) === rarity : true)
    && troopUnlocked(state, t.id));
}

// 品级顺序：传奇 → 史诗 → 稀有 → 普通（数字越小越靠前，英雄与兵种统一用这套顺序）
export const RARITY_RANK = { legendary: 0, epic: 1, rare: 2, common: 3 };

// 展示用排序：先按品级（传奇/史诗/稀有/普通），同品级内按「当前实际等级」从高到低，
// 再按兵种配置顺序、id 兜底。不再用品级内部的固定 ID 顺序当主排序。
export function sortUnits(units) {
  const order = CONFIG.troops.map((t) => t.id);
  return [...units].sort((a, b) => {
    const ra = RARITY_RANK[rarityOf(a.troop)] ?? 3;
    const rb = RARITY_RANK[rarityOf(b.troop)] ?? 3;
    if (ra !== rb) return ra - rb;
    if (a.level !== b.level) return b.level - a.level;
    const ta = order.indexOf(a.troop);
    const tb = order.indexOf(b.troop);
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
}
