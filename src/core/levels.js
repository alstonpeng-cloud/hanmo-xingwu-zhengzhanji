// 关卡生成与解锁（数据驱动）
import { CONFIG } from '../data/config.js';
import { autoPlaceSquads, formationCell } from './formation.js';
import { sortUnits, baseTroopOf, rarityOf } from './units.js';
import { squadSoldierCount } from './arena.js';
import { troopPower } from './power.js';
import { heroById, heroIdFromEntry, HERO_MAX_LEVEL } from '../data/heroes.js';
import { chapterOfLevel } from './chapters.js';
import { enemyEngineFor } from './siege.js';
import { enemyBookScales } from './books.js';

export function autoBattleUnlocked(state) {
  return (state?.maxCleared ?? 0) >= CONFIG.autoBattle.unlockLevel;
}

export function levelTotal() {
  return CONFIG.levelGen.total;
}

/* ---------- 难度曲线：30 关起渐进 +10%（前期加压）+ 卡点 ---------- */
// 命中的卡点返回 { n, scale, label }，否则 null。卡点只在配置里点名的那几关生效，
// 前一关 / 后一关立刻回落到常规曲线，形成「稍微卡一下」而不是一堵长墙。
export function difficultyCheckpoint(n) {
  const c = CONFIG.levelGen.difficulty;
  if (!c || !Array.isArray(c.checkpoints)) return null;
  const hit = c.checkpoints.find((p) => (typeof p === 'number' ? p : p && p.n) === n);
  if (!hit) return null;
  if (typeof hit === 'number') return { n, scale: c.checkpointScale || 1.08, label: '敌将督战' };
  return { n: hit.n, scale: hit.scale || c.checkpointScale || 1.08, label: hit.label || '敌将督战' };
}

// 这一关敌军的属性倍率：1.00 = 原始难度；1.10 = 生命 / 攻击各 +10%
// （只放大生命与攻击，不动防御：否则玩家打敌军时会被「攻击-防御」二次放大，实际难度远超 10%）
export function enemyScaleFor(n) {
  const c = CONFIG.levelGen.difficulty;
  if (!c) return 1;
  let scale = 1;
  const tiers = Array.isArray(c.tiers) ? c.tiers : null;
  if (tiers && tiers.length) {
    // 分段表：每段从 from 起用 ramp 关线性过渡到该段目标倍率；最后一段直接取目标值
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (n < t.from) break;
      const next = tiers[i + 1];
      const prev = i === 0 ? 1 : tiers[i - 1].scale;
      if (!next) { scale = t.scale; break; }
      const ramp = Math.max(1, t.ramp || 1);
      const prog = Math.min(1, (n - t.from + 1) / ramp);
      scale = Math.max(scale, prev + (t.scale - prev) * prog);
      if (n < next.from) break;
    }
  } else if (Number.isFinite(c.lateFrom) && n >= c.lateFrom) {
    const ramp = Math.max(1, c.lateRamp || 1);
    const t = Math.min(1, (n - c.lateFrom + 1) / ramp);
    scale = 1 + ((c.lateScale || 1) - 1) * t;
  }
  const cp = difficultyCheckpoint(n);
  if (cp) scale *= cp.scale;
  const cap = c.maxScale || 1.2;
  return Math.round(Math.min(cap, scale) * 1000) / 1000;
}

/* ---------- 英雄 BOSS 关卡（150 关起每 10 关） ---------- */
export function isHeroBossLevel(n) {
  const b = CONFIG.levelGen.heroBoss;
  return !!b && n >= b.from && n % b.every === 0;
}

export function heroBossLevelFor(n) {
  const b = CONFIG.levelGen.heroBoss;
  if (!b) return 0;
  const step = Math.max(1, b.levelStep || 100);
  return Math.min(b.levelCap || HERO_MAX_LEVEL, b.levelBase + Math.floor(Math.max(0, n - b.from) / step));
}

export function heroBossCountFor(n) {
  const b = CONFIG.levelGen.heroBoss;
  if (!b) return 0;
  let count = 1;
  for (const t of b.countTiers || []) {
    if (n >= t.from) count = Math.max(count, t.count);
  }
  return count;
}

export function heroBossHpMultFor(n) {
  const b = CONFIG.levelGen.heroBoss;
  if (!b) return 1;
  const span = Math.max(1, CONFIG.levelGen.total - b.from);
  const t = Math.min(1, Math.max(0, (n - b.from) / span));
  const v = (b.hpMultFrom || 1.8) + ((b.hpMultTo || 3.2) - (b.hpMultFrom || 1.8)) * t;
  return Math.round(v * 100) / 100;
}

// 界面用的强度文案：'110%' / '108%'
export function difficultyLabel(n) {
  return `${Math.round(enemyScaleFor(n) * 100)}%`;
}

export function enemyCountFor(n) {
  const g = CONFIG.levelGen;
  const anchors = g.enemyCountAnchors;
  if (anchors && anchors.length) {
    const first = anchors[0];
    if (n >= first.n) {
      const last = anchors[anchors.length - 1];
      if (n >= last.n) return Math.min(g.enemiesMax, last.count);
      for (let i = 1; i < anchors.length; i++) {
        if (n <= anchors[i].n) {
          const a = anchors[i - 1];
          const b = anchors[i];
          const t = (n - a.n) / (b.n - a.n);
          const count = Math.round(a.count + (b.count - a.count) * t);
          return Math.min(g.enemiesMax, Math.max(1, count));
        }
      }
    }
  }
  const extra = Math.floor((n - 1) * g.enemiesPerLevel);
  return Math.min(g.enemiesMax, g.enemiesBase + extra);
}

export function enemyLevelFor(n) {
  return Math.floor(enemyLevelScoreFor(n));
}

// 敌方等级曲线（允许小数）：整数部分 = 基础等级，小数部分 = 这一关升 1 级的小队比例
export function enemyLevelScoreFor(n) {
  const anchors = CONFIG.levelGen.levelAnchors || [{ n: 1, level: 1 }];
  if (n <= anchors[0].n) return anchors[0].level;
  for (let i = 1; i < anchors.length; i++) {
    if (n <= anchors[i].n) {
      const a = anchors[i - 1];
      const b = anchors[i];
      const t = (n - a.n) / (b.n - a.n);
      return a.level + (b.level - a.level) * t;
    }
  }
  return anchors[anchors.length - 1].level;
}

export function enemyLevelMaxFor(n) {
  const score = enemyLevelScoreFor(n);
  const spread = levelSpreadFor(n);
  return Math.min(CONFIG.merge.maxLevel, Math.floor(score) + spread);
}

// 这一关允许「一次多升几级」：默认 1（基础 / 基础+1），第 140 关附近为 2（基础 / +1 / +2）
export function levelSpreadFor(n) {
  const ranges = CONFIG.levelGen.levelSpreadRanges || [];
  for (const r of ranges) {
    if (n >= r.from && n <= r.to) return Math.max(1, Math.min(2, r.spread));
  }
  return 1;
}

export function agentCountFor(n) {
  const def = levelDef(n);
  return def.enemies.reduce((sum, e) => sum + squadSoldierCount(e.troop, e.level), 0);
}

// 确定性伪随机：同一关、同一个小队位置永远得到同一个结果（关卡可复现，测试可断言）
function roll01(n, i, salt = 0) {
  let x = (n * 374761393 + (i + 1) * 668265263 + salt * 2246822519) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// 某一关「特殊兵种」的替换比例（{ rare: 0.2, epic: 0.15 }）——没到登场关就不出现在结果里
export function specialRatioFor(n) {
  const out = {};
  for (const t of CONFIG.levelGen.specialTiers || []) {
    if (n < t.from) continue;
    if (t.to && n > t.to) continue;   // 分章节区间：400 关后换第二章的精英比例
    out[t.rarity] = Math.min(t.cap, t.base + (n - t.from) * t.perLevel);
  }
  return out;
}

// 第 n 关每个位置该换成哪个品级（null = 保持普通兵种）。
// 数量按「比例 × 小队数」四舍五入（只要到了登场关，至少混进 1 支），
// 具体占哪几个位置用确定性伪随机排位，保证同一关每次生成完全一致。
function specialSlotsFor(n, count) {
  const tiers = CONFIG.levelGen.specialTiers || [];
  const assigned = new Array(count).fill(null);
  // 高品级优先占位，低品级再填剩下的位置（史诗不会把稀有挤没，也不会同一队重复替换）
  for (let k = tiers.length - 1; k >= 0; k--) {
    const t = tiers[k];
    if (n < t.from) continue;
    if (t.to && n > t.to) continue;
    const ratio = Math.min(t.cap, t.base + (n - t.from) * t.perLevel);
    if (ratio <= 0) continue;
    const free = [];
    for (let i = 0; i < count; i++) if (!assigned[i]) free.push(i);
    const want = Math.min(free.length, Math.max(1, Math.round(ratio * count)));
    free.sort((a, b) => roll01(n, a, k + 1) - roll01(n, b, k + 1));
    for (let j = 0; j < want; j++) assigned[free[j]] = t.rarity;
  }
  return assigned;
}

// 把基础兵种（盾/弓/枪/骑）换成同一条兵种线上的本品级特殊兵种
function specialTroopFor(baseTroop, rarity) {
  const hit = CONFIG.troops.find((t) => t.rarity === rarity && baseTroopOf(t.id) === baseTroop);
  return hit ? hit.id : null;
}

// 敌军：每关 N 支小队（每支小队含数个兵），按兵种自动布阵（近战前排、弓兵后排）
// 按城池逐步混入特殊兵种：广宗 101+ 稀有 / 颍川 201+ 史诗 / 宛城 301+ 传奇（同兵种线替换，克制/站位不变）
export function levelDef(n) {
  const g = CONFIG.levelGen;
  const count = enemyCountFor(n);
  const score = enemyLevelScoreFor(n);
  const level = Math.floor(score);
  const levelFrac = score - level;         // 这一关有 levelFrac 比例的小队升 1 级
  const spread = levelSpreadFor(n);
  const levelMax = Math.min(CONFIG.merge.maxLevel, level + spread);
  // 章节阵型：按章节 id 取专属阵型（第三~六章），第二章沿用骑兵加重的旧阵型
  const ch = chapterOfLevel(n);
  const own = (g.chapterPatterns && ch && g.chapterPatterns[ch.id]) || [];
  const pats = own.length
    ? own
    : (n > 400 && g.chapter2Patterns && g.chapter2Patterns.length ? g.chapter2Patterns : g.patterns);
  const pattern = pats[(n - 1) % pats.length];
  const slots = specialSlotsFor(n, count);
  // 「这一关有多少支小队升 1 / 2 级」按 levelFrac 精确取整，再用确定性伪随机排位挑位置。
  // 旧实现逐支小队独立掷骰（r < levelFrac），实际升级队数会在期望值上下随机浮动，
  // 相邻两关敌方战力会忽高忽低（实测 47→48 掉 21%、48→49 涨 31%，根本不是设计出来的难度）。
  // 改成精确 k 支后曲线随 levelFrac 平滑上升，卡点才真的只由 difficulty 配置决定。
  const upgradeCount = Math.max(0, Math.min(count, Math.round(levelFrac * count)));
  const doubleCount = spread >= 2
    ? Math.max(0, Math.min(upgradeCount, Math.round(Math.max(0, levelFrac - 0.6) * 0.5 * count)))
    : 0;
  const upgradeOrder = Array.from({ length: count }, (_, i) => i)
    .sort((a, b) => roll01(n, a, 11) - roll01(n, b, 11));
  const extraBySlot = new Map();
  for (let j = 0; j < upgradeCount; j++) {
    extraBySlot.set(upgradeOrder[j], j < doubleCount ? 2 : 1);
  }
  const squads = [];
  for (let i = 0; i < count; i++) {
    const base = pattern[i % pattern.length];
    const special = slots[i] ? specialTroopFor(base, slots[i]) : null;
    // 确定性伪随机：同一关每次生成完全一致；
    // spread=2 时（第 140 关附近）部分小队一次 +2 级，用来做出 Lv3~5 的混编。
    let lv = level + (extraBySlot.get(i) || 0);
    // 传奇特殊兵种等级封顶（前 400 关 Lv4）：避免靠高等级传奇卡关，难度改由数量与其他品级承担
    // legendaryLevelCap 支持数组：按关卡区间选择封顶等级（400 前 Lv4，401~800 Lv5）
    const caps = Array.isArray(g.legendaryLevelCap) ? g.legendaryLevelCap : [g.legendaryLevelCap];
    const cap = caps.find((c) => c && n <= c.upTo) || caps[caps.length - 1];
    if (cap && n <= cap.upTo && rarityOf(special || base) === 'legendary') {
      lv = Math.min(lv, cap.level);
    }
    squads.push({ troop: special || base, level: Math.min(CONFIG.merge.maxLevel, lv) });
  }
  // 英雄 BOSS 关卡：把最后 1~3 支小队替换成英雄小队（等级随关卡递增，血量倍率同步抬高）。
  // 必须在守将（GUARDS）之前处理，守将再跳过已占用的 BOSS 位。
  const bossInfo = isHeroBossLevel(n) ? CONFIG.levelGen.heroBoss : null;
  if (bossInfo && squads.length) {
    const cnt = Math.min(squads.length, Math.max(1, heroBossCountFor(n)));
    const blv = Math.min(HERO_MAX_LEVEL, Math.max(1, heroBossLevelFor(n)));
    for (let i = 0; i < cnt; i++) {
      const idx = squads.length - 1 - i;
      const heroId = bossInfo.pool[(Math.floor(n / bossInfo.every) + i) % bossInfo.pool.length];
      const hc = heroById(heroId);
      if (!hc) continue;
      squads[idx] = {
        troop: hc.troop,
        level: blv,
        hero: hc.id,
        heroScale: bossInfo.heroScale || 1.3,
        hpMult: heroBossHpMultFor(n),
        boss: true,
      };
    }
  }
  // 各章末关「守将」：章节收尾安排 1 名敌方将领
  // （不额外加位，替换掉最后一支普通小队；数值仍按该关等级，不单独膨胀）
  const GUARDS = {
    500: { hero: 'guanyu', level: 2 },
    600: { hero: 'zhangfei', level: 3 },
    700: { hero: 'caocao', level: 4 },
    800: { hero: 'dongzhuo', level: 6 },
    1200: { hero: 'caocao', level: 7 },
    1700: { hero: 'zhouyu', level: 8 },
    2200: { hero: 'liubei', level: 8 },
    2600: { hero: 'xiahouyuan', level: 9 },
  };
  if (GUARDS[n] && squads.length) {
    const gd = GUARDS[n];
    const hc = heroById(gd.hero);
    // 从后往前找「不是 BOSS」的位置，避免把英雄 BOSS 顶掉
    let slot = squads.length - 1;
    while (slot >= 0 && squads[slot].boss) slot--;
    if (hc && slot >= 0) {
      squads[slot] = {
        troop: hc.troop, level: Math.min(CONFIG.merge.maxLevel, gd.level), hero: hc.id, heroScale: 1.25,
      };
    }
  }
  // 难度倍率：卡点 / 50 关后 +10% 都折算成敌军的 statMult（只放大生命与攻击）。
  // 注意守将（GUARDS）也要一起吃到倍率，所以在 autoPlaceSquads 之后统一挂。
  const difficulty = enemyScaleFor(n);
  let placed = autoPlaceSquads(squads, 'enemy');
  // 敌方攻城器械：每 5 关最多 1 台。1.2.5 起器械**不再顶替**一支小队 —— 原先「器械占位
  // 换掉一队」会让 300 关起的器械关掉到 24 队，形成 -8% 战力凹点（体检发现）；
  // 现在保持 25 队满编 + 1 台器械（器械走独立站位，不占 25 格，与英雄战「12 队+器械」同口径）。
  const engine = enemyEngineFor(n);
  const enemies = placed
    .map((e) => {
      const book = enemyBookScales(n);
      if (difficulty === 1 && !book) return e;
      const out = { ...e };
      if (difficulty !== 1) out.statMult = difficulty;
      if (book) {
        // 兵书对等加成：攻 / 血 / 防各自乘；hpMult 同时承载英雄 BOSS 血量倍数，要相乘
        out.atkScale = (out.atkScale || 1) * book.atkScale;
        out.hpMult = (out.hpMult || 1) * book.hpMult;
        out.defScale = (out.defScale || 1) * book.defScale;
      }
      return out;
    });
  const cp = difficultyCheckpoint(n);
  return {
    n, name: `第 ${n} 关`, enemies,
    engine,
    enemyLevel: level,
    enemyLevelMax: levelMax,
    difficulty,
    checkpoint: cp ? cp.label : null,
    heroBoss: !!bossInfo,
    bossCount: bossInfo ? Math.min(squads.length, heroBossCountFor(n)) : 0,
  };
}

export function isUnlocked(n, maxCleared) {
  return n <= maxCleared + 1 && n <= levelTotal();
}

export function isCleared(n, maxCleared) {
  return n <= maxCleared;
}

// 关卡不可重复挑战：只能打「下一关」（maxCleared + 1），通关后这一关就锁掉了
export function canChallenge(n, maxCleared) {
  return Number.isFinite(n) && n === maxCleared + 1 && n >= 1 && n <= levelTotal();
}

// 下一关关号（全部通关返回 null）
export function nextLevelFor(state) {
  const next = (state?.maxCleared ?? 0) + 1;
  return next <= levelTotal() ? next : null;
}

// 铜钱只在「首通」时发放：重复挑战同一关不再产出铜钱（防止刷关）
export function rewardFor(n, firstClear) {
  return firstClear ? CONFIG.economy.clearCoins(n) : 0;
}

// 兵营容量：上限 300，开局全部可用（slotUnlockLevels 为空时不再按关解锁）
export function rosterSlots(maxCleared) {
  const { initialSlots, maxSlots, slotUnlockLevels } = CONFIG.roster;
  const unlocked = Math.min(maxSlots, initialSlots + slotUnlockLevels.filter((l) => maxCleared >= l).length);
  const slots = [];
  for (let i = 0; i < maxSlots; i++) {
    slots.push({ index: i, unlocked: i < unlocked });
  }
  return { unlocked, total: maxSlots, slots };
}

// 每个未解锁格子对应的解锁关卡（用于界面提示）
export function slotUnlockLevelFor(slotIndex) {
  const { initialSlots, slotUnlockLevels } = CONFIG.roster;
  if (slotIndex < initialSlots) return 0;
  return slotUnlockLevels[slotIndex - initialSlots] ?? null;
}

// 新增单位：兵营满则返回 null（不静默替换玩家单位）
export function addUnit(state, troop, level = 1) {
  const { unlocked } = rosterSlots(state.maxCleared);
  if (state.units.length >= unlocked) return null;
  const id = `u${state.nextUnitId++}`;
  const unit = { id, troop, level };
  state.units.push(unit);
  return unit;
}

export function unitById(state, id) {
  return state.units.find((u) => u.id === id) || null;
}

// 商城价格：兵种基础价 × 2^(等级-1)（合成经济：高一级 = 低一级的两倍）
export function shopPrice(troopId, level = 1) {
  const base = CONFIG.shop.basePrice[troopId] || 0;
  return Math.round(base * CONFIG.shop.levelFactor(level));
}

// 商城买兵：兵营满 / 铜钱不足时不扣钱、不添兵
export function buyUnit(state, troopId, level = 1) {
  if (!CONFIG.troops.some((t) => t.id === troopId)) return { ok: false, reason: 'unknown', price: 0 };
  const lv = Math.max(1, Math.min(CONFIG.merge.maxLevel, Math.floor(level)));
  const price = shopPrice(troopId, lv);
  const { unlocked } = rosterSlots(state.maxCleared);
  if (state.units.length >= unlocked) return { ok: false, reason: 'full', price };
  if (state.coins < price) return { ok: false, reason: 'poor', price };
  state.coins -= price;
  const unit = addUnit(state, troopId, lv);
  return { ok: true, reason: 'ok', unit, price };
}

// 布阵：按格子索引取出场上的单位（过滤掉已不存在/重复的），最多 25 个
// 布阵里允许出现英雄格 "h:英雄id"（占 1 格，属性和等级走英雄自己那份配置）
export function activeFormation(state) {
  const byId = new Map(state.units.map((u) => [u.id, u]));
  const form = Array.isArray(state.formation) ? state.formation : [];
  const list = [];
  const seen = new Set();
  form.forEach((uid, idx) => {
    if (!uid || seen.has(uid)) return;
    const heroId = heroIdFromEntry(uid);
    if (heroId) {
      const lv = Math.floor((state.heroes && state.heroes[heroId]) || 0);
      const hero = heroById(heroId);
      if (!hero || lv <= 0) return;
      seen.add(uid);
      const { col, row } = formationCell(idx);
      list.push({ uid, troop: hero.troop, level: lv, hero: heroId, col, row });
      return;
    }
    const unit = byId.get(uid);
    if (!unit) return;
    seen.add(uid);
    const { col, row } = formationCell(idx);
    list.push({ uid, unit, troop: unit.troop, level: unit.level, col, row });
  });
  return list.slice(0, CONFIG.formation.maxUnits);
}

// 未上阵的单位（布阵页下方只显示这些兵牌），按兵种/等级排序方便找合成材料
export function undeployedUnits(state) {
  const deployed = new Set((Array.isArray(state.formation) ? state.formation : []).filter(Boolean));
  return sortUnits(state.units.filter((u) => !deployed.has(u.id)));
}

// 战力排序：用于「按战力布阵」（含小队人数 / 战法倍率 / 远程连射的完整战力）
export function powerOf(unit) {
  return troopPower(unit.troop, unit.level);
}
