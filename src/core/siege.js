// 攻城器械：唯一装备（全局只有一台），每局最多上阵 1 台。
// 纯计算 + 存档读写，不碰斗技场循环；斗技场在 arena.js 里按这里给出的数值执行。
//
// 设计口径：
// - 基础强度跟随敌方等级锚点 enemyLevelFor(关卡)，和敌军同一条成长曲线，
//   所以 350 关拿到的霹雳车到 800 关不会变摆设；
// - 升级档位（1~10）只提供额外增幅，价格按几何增长；
// - 敌方器械由关卡确定（每 5 关一台，500 关后 50/50 决定是鼓吹还是霹雳车），
//   用确定性哈希，保证同一关每次生成完全一致。
import { CONFIG } from '../data/config.js';
import { enemyLevelFor } from './levels.js';
import { statsFor } from './units.js';
import { slotToArena } from './formation.js';

const S = CONFIG.siege;

// 确定性伪随机（与 levels.js 的 roll01 同一套哈希）：同一关永远得到同一个结果
function roll01(n, i, salt = 0) {
  let x = (n * 374761393 + (i + 1) * 668265263 + salt * 2246822519) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function lerp(a, b, u) {
  return a + (b - a) * u;
}

export function engineDef(id) {
  return S.engines[id] || null;
}

export function engineList() {
  return S.engineList.map((id) => S.engines[id]).filter(Boolean);
}

export function engineUnlockLevel(id) {
  const e = engineDef(id);
  return e ? e.unlockLevel : Infinity;
}

export function engineUnlocked(state, id) {
  return !!engineDef(id) && (Number(state && state.maxCleared) || 0) >= engineUnlockLevel(id);
}

// 存档里的档位（1~10）。没有记录 = 1 档。
export function engineTier(state, id) {
  const raw = state && state.siege && state.siege.tiers ? state.siege.tiers[id] : 1;
  const n = Math.floor(Number(raw) || 1);
  return Math.max(1, Math.min(S.maxLevel, n));
}

// 当前出战器械：{ id, stance, tier }，未解锁 / 未选择时返回 null
export function engineChoice(state) {
  const c = state && state.siege ? state.siege.choice : null;
  if (!c || !engineDef(c.id) || !engineUnlocked(state, c.id)) return null;
  const stance = S.stances.some((s) => s.id === c.stance) ? c.stance : 'center';
  return { id: c.id, stance, tier: engineTier(state, c.id) };
}

// 选择 / 切换出战器械与站位（战前调用；进战斗后不再改）
export function setEngineChoice(state, id, stance) {
  if (!state) return false;
  if (!engineDef(id) || !engineUnlocked(state, id)) return false;
  const st = S.stances.some((s) => s.id === stance) ? stance : 'center';
  state.siege = state.siege || { tiers: {}, choice: null };
  state.siege.choice = { id, stance: st };
  return true;
}

// 档位 t → t+1 的铜钱价格（几何增长）
export function engineUpgradeCost(id, tier) {
  const e = engineDef(id);
  if (!e) return Infinity;
  return Math.round(e.upgrade.base * Math.pow(e.upgrade.growth, tier - 1));
}

export function engineMaxUpgradeTotal(id) {
  let total = 0;
  for (let t = 1; t < S.maxLevel; t++) total += engineUpgradeCost(id, t);
  return total;
}

// 升一档：返回 { ok, reason, cost, tier }
export function upgradeEngine(state, id) {
  if (!engineUnlocked(state, id)) return { ok: false, reason: 'locked' };
  const tier = engineTier(state, id);
  if (tier >= S.maxLevel) return { ok: false, reason: 'max' };
  const cost = engineUpgradeCost(id, tier);
  if ((Number(state.coins) || 0) < cost) return { ok: false, reason: 'coins', cost };
  state.coins -= cost;
  state.siege = state.siege || { tiers: {}, choice: null };
  state.siege.tiers = state.siege.tiers || {};
  state.siege.tiers[id] = tier + 1;
  return { ok: true, cost, tier: tier + 1 };
}

// 三档站位的战场坐标：前军 = 前排中间，中军 = 5×5 正中间，后军 = 最后一排中间
export function stancePoint(side, stance) {
  const st = S.stances.find((s) => s.id === stance) || S.stances[1];
  return slotToArena(side, st.col, S.stanceRow);
}

export function stanceName(stance) {
  const st = S.stances.find((s) => s.id === stance);
  return st ? st.name : '中军';
}

export function engineName(id) {
  const e = engineDef(id);
  return e ? e.name : '';
}

// 器械在当前关卡下的实际数值。
// 霹雳车：直击 / 火圈秒伤都以「同关卡盾兵血量、弓兵攻击」为锚点，再乘档位系数；
// 鼓吹：光环半径与增伤比例在 1~10 档之间线性插值。
export function engineStats(id, tier, stage) {
  const e = engineDef(id);
  const lvRaw = Math.round(enemyLevelFor(Math.max(1, stage || 1)));
  const lv = Math.max(1, Math.min(CONFIG.merge.maxLevel, lvRaw));
  const t = Math.max(1, Math.min(S.maxLevel, Math.floor(tier || 1)));
  const u = (t - 1) / (S.maxLevel - 1);
  if (id === 'thunder') {
    const dmgMult = lerp(1, e.tierCurve.dmg, u);
    const shield = statsFor('shield', lv);
    return {
      id, lv, dmgMult,
      direct: Math.round(shield.hp * e.directHpFactor * dmgMult),
      fireDps: Math.round(statsFor('archer', lv).atk * e.fireAtkFactor * dmgMult),
      cooldown: lerp(e.cooldown, e.tierCurve.cooldown, u),
      fireRadius: lerp(e.fireRadius, e.tierCurve.fireRadius, u),
      fireDuration: lerp(e.fireDuration, e.tierCurve.fireDuration, u),
      directRadius: e.directRadius,
      minRange: e.minRange,
      maxRange: e.maxRange,
      // 本体也是战斗单位（可被索敌攻击）：血量/护甲以同关卡盾兵为锚
      hp: Math.round(shield.hp * (e.hpFactor || 4)),
      def: shield.def,
    };
  }
  const drumShield = statsFor('shield', lv);
  return {
    id,
    auraRadius: lerp(e.auraRadius, e.auraRadiusMax, u),
    auraDmg: lerp(e.auraDmg, e.auraDmgMax, u),
    hp: Math.round(drumShield.hp * (e.hpFactor || 3)),
    def: drumShield.def,
  };
}

// 战力折算：和 troopPower 的「秒伤 × 3」同口径。
// 霹雳车按「一发期望命中 2.5 支小队」折算；鼓吹按「全阵战力 × 增伤 × 覆盖率 0.6」折算。
export const ENGINE_AURA_COVERAGE = 0.6;

export function enginePower(id, tier, stage, armyPower = 0) {
  if (id === 'thunder') {
    const s = engineStats(id, tier, stage);
    const perShot = s.direct * 2.5 + s.fireDps * s.fireDuration * 2.5 * 0.5;
    return Math.round((perShot / Math.max(1, s.cooldown)) * 3);
  }
  if (id === 'drum') {
    const s = engineStats(id, tier, stage);
    return Math.round(Math.max(0, armyPower) * s.auraDmg * ENGINE_AURA_COVERAGE);
  }
  return 0;
}

// 模式 → 主线锚点关卡：
// 演武直接用 def.mainLevel；英雄战 1~150 关映射主线 200~2600；
// 斩将第 k 章（1~12）映射主线 200 + (k-1)×220（第 2 章 = 420，符合「第 2 章起出霹雳车」）。
export function engineStageFor(mode, value) {
  if (mode === 'hero') {
    const s = Math.max(1, Math.min(150, Number(value) || 1));
    return Math.round(200 + (s - 1) * (2400 / 149));
  }
  if (mode === 'gauntlet') {
    const k = Math.max(1, Math.min(12, Number(value) || 1));
    // 12 章按 220 关步长会推到 2620，钳到主线最后一关，锚点不越界
    return Math.min(CONFIG.levelGen.total, 200 + (k - 1) * 220);
  }
  if (mode === 'daily') {
    // 每日挑战 30 关：300 关起线性铺到第 30 关 = 主线 2000 关难度
    const total = CONFIG.dailyChallenge.total;
    const s = Math.max(1, Math.min(total, Number(value) || 1));
    return 300 + Math.round(((s - 1) * 1700) / (total - 1));
  }
  if (mode === 'weekly') {
    // 周常按档位取锚点（第 1 档 350 → 第 5 档 1700）
    const t = Math.max(1, Math.min(CONFIG.weekly.tiers, Number(value) || 1));
    return CONFIG.weekly.tierAnchors[t - 1];
  }
  return Number(value) || 1;
}

// 敌方器械：主线每 5 关最多一台。
// 300~499：霹雳车；500 起：同一周期按 50% 决定出鼓吹还是霹雳车（同关不会两台）。
// force = true：英雄战 / 斩将这种「一关一关」的模式不用 %5 抽签，每关都有一台
// （斩将第 2 章映射到 420 关，所以正好从第 2 章开始出霹雳车）。
export function enemyEngineFor(n, force = false) {
  const R = S.enemy;
  if (!Number.isFinite(n) || n < R.thunderFrom) return null;
  if (!force && n % R.every !== 0) return null;
  const id = n >= R.drumFrom && roll01(n, 0, 91) < R.drumChance ? 'drum' : 'thunder';
  const from = id === 'drum' ? R.drumFrom : R.thunderFrom;
  const tier = Math.max(1, Math.min(S.maxLevel,
    1 + Math.floor(((n - from) * (S.maxLevel - 1)) / R.tierSpan)));
  const r = roll01(n, 1, 37);
  const stance = r < 0.34 ? 'front' : (r < 0.67 ? 'center' : 'back');
  return { id, tier, stance };
}
