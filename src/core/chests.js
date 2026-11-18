// 宝箱：常规轮换（小木箱 / 银箱 / 金箱 / 铂金箱 / 玄玉箱）+ 特殊宝箱（稀有 / 史诗 / 传奇）
// 首通发箱 → 仓库累积 → 开箱按掉落表随机给兵；纯逻辑，随机源可注入
import { CONFIG } from '../data/config.js';
import { rosterSlots, addUnit } from './levels.js';
import { milestoneChestsAt } from './chapters.js';
import { rarityOf, troopUnlocked, capTroopLevel } from './units.js';

export function chestType(id) {
  return CONFIG.chests.types[id] || null;
}

// 全部宝箱（常规在前、特殊在后，顺序稳定；界面按这个顺序排）
export function chestTypes({ includeLocked = true } = {}) {
  const { regularOrder = [], specialOrder = [], types } = CONFIG.chests;
  const ordered = [...regularOrder, ...specialOrder].filter((id) => types[id]);
  const rest = Object.keys(types).filter((id) => !ordered.includes(id));
  return [...ordered, ...rest]
    .map((id) => types[id])
    .filter((t) => includeLocked || !t.locked);
}

// 某个宝箱能掉哪些兵种（按品级池）
// 传 state 时只返回「已解锁」的兵种；未解锁的不会从宝箱里掉出来
export function troopPool(rarity, state = null) {
  const list = CONFIG.troops
    .filter((t) => rarityOf(t.id) === rarity
      && (!state || troopUnlocked(state, t.id)))
    .map((t) => t.id);
  if (list.length) return list;
  // 该品级没有已解锁兵种 → 回退到普通兵（普通兵默认全部解锁）
  const common = CONFIG.troops
    .filter((t) => rarityOf(t.id) === 'common' && (!state || troopUnlocked(state, t.id)))
    .map((t) => t.id);
  return common.length ? common : CONFIG.troops.filter((t) => rarityOf(t.id) === 'common').map((t) => t.id);
}

// 某关首通发哪些宝箱（可以多个）：
// 小木箱（第 1 关 + 每 5 关）+ 银箱（每 20 关）+ 金箱（每 50 关）
// 再叠加城池 / 章节里程碑奖励（涿郡金箱、广宗金箱×2、颍川史诗箱、宛城传奇箱）
export function chestsForLevel(levelN) {
  const ids = [...(CONFIG.chests.levelChests(levelN) || []), ...milestoneChestsAt(levelN)];
  return ids.filter((id) => chestType(id));
}

function chestBag(state) {
  if (!state.chests || typeof state.chests !== 'object') state.chests = {};
  return state.chests;
}

export function chestCount(state, id = 'wood') {
  const n = chestBag(state)[id];
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function chestTotal(state) {
  return Object.keys(chestBag(state)).reduce(
    (sum, id) => sum + (chestType(id) ? chestCount(state, id) : 0), 0
  );
}

export function addChest(state, id = 'wood', n = 1) {
  if (!chestType(id)) return 0;
  chestBag(state)[id] = chestCount(state, id) + Math.max(0, Math.floor(n));
  return chestBag(state)[id];
}

// 宝箱兵种等级加成：只在 400 / 800 关两个节点各 +1 级（配置驱动）
export function chestLevelBonus(maxCleared = 0) {
  const cleared = Math.max(0, Math.floor(Number(maxCleared) || 0));
  const tiers = CONFIG.chests.levelBonusByClear || [];
  let bonus = 0;
  for (const t of tiers) {
    if (cleared >= t.minLevel) bonus = Math.max(bonus, Math.floor(t.bonus) || 0);
  }
  return bonus;
}

// 只摇掉落结果、不改存档：返回 { troop, level, rarity }
// state 可选：传入后按解锁池过滤；不传则保留全部兵种（图鉴 / 旧测试用）
export function rollChest(id = 'wood', rand = Math.random, state = null) {
  const type = chestType(id);
  if (!type || !Array.isArray(type.drops) || !type.drops.length) return null;
  const r = rand();
  let acc = 0;
  let drop = type.drops[type.drops.length - 1];
  for (const d of type.drops) {
    acc += d.chance;
    if (r < acc) {
      drop = d;
      break;
    }
  }
  const pool = troopPool(drop.rarity, state);
  const troop = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
  // 关卡档位加成 + 兵种等级上限（稀有 ≤4 / 史诗 ≤5 等）：超出的等级夹到上限
  const bonus = state ? chestLevelBonus(state.maxCleared) : 0;
  const level = state ? capTroopLevel(state, troop, drop.level + bonus) : drop.level;
  return { troop, level, rarity: drop.rarity, bonus };
}

// 开箱：兵营满 / 没有箱子时不消耗、不添加
// 返回 { ok, reason: 'ok'|'none'|'full'|'unknown'|'locked', reward, unit, remaining }
export function openChest(state, id = 'wood', rand = Math.random) {
  const type = chestType(id);
  if (!type) return { ok: false, reason: 'unknown' };
  if (type.locked) return { ok: false, reason: 'locked', remaining: chestCount(state, id) };
  if (chestCount(state, id) <= 0) return { ok: false, reason: 'none', remaining: 0 };
  const { unlocked } = rosterSlots(state.maxCleared);
  if (state.units.length >= unlocked) return { ok: false, reason: 'full', remaining: chestCount(state, id) };

  const reward = rollChest(id, rand, state);
  if (!reward) return { ok: false, reason: 'unknown', remaining: chestCount(state, id) };
  const unit = addUnit(state, reward.troop, reward.level);
  if (!unit) return { ok: false, reason: 'full', remaining: chestCount(state, id) };

  chestBag(state)[id] = chestCount(state, id) - 1;
  // 成就计数器：累计开箱数（一键开箱也走这里，天然覆盖）
  if (!state.counters) state.counters = { chestsOpened: 0, sweeps: 0, weeklyClears: 0 };
  state.counters.chestsOpened = (state.counters.chestsOpened || 0) + 1;
  return { ok: true, reason: 'ok', reward, unit, remaining: chestBag(state)[id] };
}

// 一键开启：按界面顺序（常规箱 → 特殊箱）把仓库里的箱子全部开掉，兵直接进兵营
// 兵营满之后立刻停下：剩下的箱子原样留在仓库里，不会静默吞掉
// 返回 { ok, reason: 'ok'|'none'|'full', opened: [{chest, troop, level, rarity, unit}], count, byRarity, remaining }
export function openAllChests(state, rand = Math.random) {
  const before = chestTotal(state);
  const opened = [];
  const byRarity = {};
  if (!before) return { ok: false, reason: 'none', opened, count: 0, byRarity, remaining: 0 };

  let reason = 'ok';
  for (const type of chestTypes({ includeLocked: false })) {
    while (chestCount(state, type.id) > 0) {
      const r = openChest(state, type.id, rand);
      if (!r.ok) {
        reason = r.reason === 'full' ? 'full' : 'unknown';
        break;
      }
      opened.push({ chest: type.id, troop: r.reward.troop, level: r.reward.level, rarity: r.reward.rarity, unit: r.unit });
      byRarity[r.reward.rarity] = (byRarity[r.reward.rarity] || 0) + 1;
    }
    if (reason !== 'ok') break;
  }
  return {
    ok: opened.length > 0, reason, opened, count: opened.length, byRarity,
    remaining: chestTotal(state),
  };
}
