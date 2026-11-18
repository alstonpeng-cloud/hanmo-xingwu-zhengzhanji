// 英雄系统运行时：招募券、招募（卡池）、升级、上阵（战斗外自动排位）
import { CONFIG } from '../data/config.js';
import {
  HEROES, HERO_MAX_LEVEL, heroById, heroEntryId, heroStatsFor, heroCombatTraits, heroesByTier,
} from '../data/heroes.js';
import { dateKey } from './daily.js';
import { now as clockNow } from './clock.js';
import { formationIndex, formationCell, autoSlotIndexFor } from './formation.js';
import { addUnit } from './levels.js';
import { unlockedTroops, rarityOf, capTroopLevel } from './units.js';

/* ---------- 招募券 ---------- */

export function heroTickets(state) {
  return Math.max(0, Math.floor(state.heroTickets || 0));
}

export function addHeroTickets(state, n = 1) {
  state.heroTickets = heroTickets(state) + Math.max(0, Math.floor(n));
  return state.heroTickets;
}

// 广告领招募券：每日独立额度（跨天重置）
export function ensureHeroAds(state, now = clockNow()) {
  const today = dateKey(now);
  if (!state.heroAdDay || typeof state.heroAdDay !== 'string') state.heroAdDay = '';
  if (state.heroAdDay !== today) {
    state.heroAdDay = today;
    state.heroAdCount = 0;
  }
}

export function heroAdLeft(state, now = clockNow()) {
  ensureHeroAds(state, now);
  return Math.max(0, CONFIG.heroes.adLimit - (state.heroAdCount || 0));
}

export function claimHeroAdTicket(state, now = clockNow()) {
  // 招募券只服务于英雄战养成：先通关至少 1 场英雄战，广告券通道才开放。
  if (Math.max(0, Math.floor(state.heroBattleCleared || 0)) <= 0) {
    return { ok: false, reason: 'locked', left: 0, tickets: heroTickets(state) };
  }
  ensureHeroAds(state, now);
  const left = heroAdLeft(state, now);
  if (left <= 0) return { ok: false, reason: 'limit', left: 0 };
  state.heroAdCount = (state.heroAdCount || 0) + 1;
  state.heroTickets = heroTickets(state) + 1;
  return { ok: true, reason: 'ok', left: left - 1, tickets: state.heroTickets };
}

/* ---------- 拥有 / 招募 ---------- */

export function heroLevel(state, id) {
  return Math.max(0, Math.floor((state.heroes && state.heroes[id]) || 0));
}

export function ownsHero(state, id) {
  return heroLevel(state, id) > 0;
}

export function unlockedHeroes(state) {
  return HEROES.filter((h) => ownsHero(state, h.id));
}

/* ---------- 上阵人数上限 ---------- */

// 当前布阵里已经上了几名英雄（上限 CONFIG.heroes.maxDeploy = 3）
export function deployedHeroCount(state) {
  const form = Array.isArray(state.formation) ? state.formation : [];
  const ids = new Set();
  for (const v of form) {
    if (v && String(v).startsWith('h:')) ids.add(String(v));
  }
  return ids.size;
}

// 当前可用的英雄上阵位：200 关 1 格；500 关 2 格；1000 关 3 格（CONFIG.heroes.slotLevels）
export function heroDeploySlots(state) {
  const max = Math.max(0, Math.floor(Number(state && state.maxCleared) || 0));
  if (max < CONFIG.heroes.unlockLevel) return 0;
  let slots = 1;
  for (const step of CONFIG.heroes.slotLevels || []) {
    if (max >= step.level) slots = Math.max(slots, step.slots);
  }
  return Math.min(slots, CONFIG.heroes.maxDeploy);
}

// 当前主线进度下的英雄等级上限：500 关前 20 级，500 关后 30 级
export function heroLevelCap(state) {
  const max = Math.max(0, Math.floor(Number(state && state.maxCleared) || 0));
  let cap = HERO_MAX_LEVEL;
  // tiers 按关卡升序排列，取「最后一个已达成的档位」
  for (const t of CONFIG.heroes.levelCapTiers || []) {
    if (max >= t.level) cap = t.cap;
  }
  return Math.min(cap, HERO_MAX_LEVEL);
}

// 下一个上阵位的解锁关（已全开返回 0）
export function nextHeroSlotLevel(state) {
  const max = Math.max(0, Math.floor(Number(state && state.maxCleared) || 0));
  const step = (CONFIG.heroes.slotLevels || []).find((s) => max < s.level);
  return step ? step.level : 0;
}

export function canDeployHero(state, heroId) {
  const uid = heroEntryId(heroId);
  const form = Array.isArray(state.formation) ? state.formation : [];
  if (form.includes(uid)) return true;
  return deployedHeroCount(state) < heroDeploySlots(state);
}

// 新获得英雄时自动摆进「符合兵种站位规则」的空位（上阵已满 / 布阵已满则不自动摆）
export function autoPlaceHero(state, heroId) {
  const uid = heroEntryId(heroId);
  if (!Array.isArray(state.formation)) return false;
  if (state.formation.includes(uid)) return true;
  if (!canDeployHero(state, heroId)) return false;
  const hero = heroById(heroId);
  let idx = hero ? autoSlotIndexFor(state.formation, hero.troop) : -1;
  if (idx < 0) idx = state.formation.findIndex((v) => !v);
  if (idx < 0) return false;
  state.formation[idx] = uid;
  return true;
}

// 获得英雄：没有 → 1 级；已有 → 升 1 级（到达当前等级上限给铜钱补偿）
export function grantHero(state, id, extraLevels = 1) {
  const hero = heroById(id);
  if (!hero) return { ok: false, reason: 'unknown' };
  if (!state.heroes || typeof state.heroes !== 'object') state.heroes = {};
  const cur = heroLevel(state, id);
  const cap = heroLevelCap(state);
  const steps = Math.max(1, Math.floor(extraLevels));
  if (cur >= cap) {
    const coins = CONFIG.heroes.maxedCompensation;
    state.coins += coins;
    return { ok: true, isNew: false, maxed: true, level: cur, coins };
  }
  const next = Math.min(cap, cur + steps);
  state.heroes[id] = next;
  if (cur === 0) autoPlaceHero(state, id);
  return { ok: true, isNew: cur === 0, maxed: false, level: next };
}

/* ---------- 招募系统：奖池 / 自选箱 / 保底 ---------- */

// 主线招募券：200 关后每 10 关（200/210/220…）首通 1 张；199 关及以前不发
export function mainlineScrollReward(levelN) {
  const n = Math.max(0, Math.floor(Number(levelN) || 0));
  return n >= 200 && n % 10 === 0 ? 1 : 0;
}

export function recruitPool() {
  return CONFIG.heroes.recruit.pool;
}

export function recruitPoolTotal() {
  return recruitPool().reduce((sum, e) => sum + (Number(e.weight) || 0), 0);
}

export function isLegendaryRecruitEntry(entry) {
  if (!entry) return false;
  return entry.kind === 'hero' ? entry.tier === 'legendary' : entry.rarity === 'legendary';
}

function isLegendaryResult(result) {
  if (!result) return false;
  if (result.kind === 'hero') return result.rarity === 'legendary';
  if (result.kind === 'box') return false;
  return result.rarity === 'legendary';
}

// 20 抽保底会额外抬升传奇概率。为了让最终分布仍等于权重表，
// 这里按「目标传奇率 → 基础传奇率」反解：p / (1-(1-p)^20) = 目标传奇率。
// 例：目标 17% → 基础约 10.3%，保底补齐后大样本仍回到 17%。
function pityCycleRate(p, pity) {
  if (p <= 0) return 0;
  const q = 1 - p;
  return p / (1 - Math.pow(q, pity));
}

function solveBaseLegendaryRate(target, pity) {
  if (target <= 0) return 0;
  if (target >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (pityCycleRate(mid, pity) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

let recruitWeightCache = null;
function recruitWeights() {
  if (recruitWeightCache) return recruitWeightCache;
  const pity = Math.max(1, Math.floor(Number(CONFIG.heroes.recruit.pity) || 20));
  const pool = recruitPool();
  const total = recruitPoolTotal();
  const goldWeight = pool.filter(isLegendaryRecruitEntry)
    .reduce((sum, e) => sum + (Number(e.weight) || 0), 0);
  const targetGold = total > 0 ? goldWeight / total : 0;
  const baseGold = solveBaseLegendaryRate(targetGold, pity);
  const goldMult = targetGold > 0 ? baseGold / targetGold : 0;
  const otherMult = targetGold < 1 ? (1 - baseGold) / (1 - targetGold) : 0;
  recruitWeightCache = {
    total,
    targetGold,
    baseGold,
    pity,
    entries: pool.map((e) => ({
      ...e,
      effectiveWeight: Math.max(0, Number(e.weight) || 0)
        * (isLegendaryRecruitEntry(e) ? goldMult : otherMult),
    })),
  };
  return recruitWeightCache;
}

function rollWeighted(entries, rng) {
  const sum = entries.reduce((s, e) => s + e.effectiveWeight, 0);
  if (sum <= 0) return entries[entries.length - 1] || null;
  let r = rng() * sum;
  for (const e of entries) {
    r -= e.effectiveWeight;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1] || null;
}

// 已拥有英雄不再作为结果：某品级英雄全部拥有时，整个英雄条目退出候选，
// 其余条目按原权重重新归一化（分母自动变成剩余权重之和）。
function heroTierAvailable(state, tier) {
  return heroesByTier(tier).some((h) => !ownsHero(state, h.id));
}

function eligibleRecruitEntries(state, entries) {
  return entries.filter((e) => (e.kind === 'hero' ? heroTierAvailable(state, e.tier) : true));
}

export function rollRecruitEntry(state, rng = Math.random, forcedLegendary = false) {
  const w = recruitWeights();
  const all = eligibleRecruitEntries(state, w.entries);
  const legendary = all.filter(isLegendaryRecruitEntry);
  if (forcedLegendary) {
    // 保底只在「能真正出传奇」的档位里选：传奇兵必须已有解锁兵种，否则跳过
    const usable = legendary.filter((e) => (e.kind === 'hero'
      ? heroTierAvailable(state, e.tier)
      : unlockedTroops(state, e.rarity).length > 0));
    // 传奇档全部不可用（英雄已集齐 + 传奇兵未解锁）时退回剩余奖池，
    // 结果不算出金、保底计数继续累计，下一次仍会尝试。
    return rollWeighted(usable.length ? usable : all, rng);
  }
  return rollWeighted(all, rng);
}

// 兵种随机：同品级内随机；该品级没有已解锁兵种时向下降档（传奇→史诗→稀有→普通）。
const RARITY_DOWN = { legendary: ['epic', 'rare', 'common'], epic: ['rare', 'common'], rare: ['common'], common: [] };

export function recruitedTroopFor(state, rarity, rng = Math.random) {
  const chain = [rarity, ...(RARITY_DOWN[rarity] || [])];
  for (const r of chain) {
    const pool = unlockedTroops(state, r);
    if (pool.length) {
      const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
      return { troop: pool[idx].id, rarity: r, fallback: r !== rarity };
    }
  }
  const any = unlockedTroops(state, null);
  if (any.length) {
    const idx = Math.min(any.length - 1, Math.floor(rng() * any.length));
    return { troop: any[idx].id, rarity: rarityOf(any[idx].id), fallback: true };
  }
  return null;
}

// 只在「未拥有」的该品级英雄里随机；全部拥有返回 null（由调用方回退到兵种/降档）。
// 保留 duplicateHero 折算仅供旧调用方兜底，正常抽卡不会再走到重复英雄。
export function recruitHeroResult(state, tier, rng = Math.random) {
  const pool = heroesByTier(tier).filter((h) => !ownsHero(state, h.id));
  if (!pool.length) return null;
  const h = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const r = grantHero(state, h.id, 1);
  return {
    kind: 'hero', hero: h.id, rarity: tier, owned: false, isNew: true,
    level: r.level, coins: 0, tickets: 0,
  };
}

/* ---------- 自选箱（抽到后必须选完才入账） ---------- */

export function pendingRecruitBoxes(state) {
  if (!Array.isArray(state.recruitBoxes)) state.recruitBoxes = [];
  return state.recruitBoxes;
}

// 自选箱可选兵种：该品级且已解锁；当前奖池只发普通兵箱
export function recruitBoxChoices(state, box) {
  if (!box) return [];
  return unlockedTroops(state, box.rarity);
}

export function createRecruitBox(state, rarity, level) {
  const boxes = pendingRecruitBoxes(state);
  const seq = Math.max(0, Math.floor(Number(state.recruitBoxSeq) || 0)) + 1;
  state.recruitBoxSeq = seq;
  const box = {
    id: `rb${seq}`,
    rarity,
    level: Math.max(1, Math.floor(level)),
  };
  boxes.push(box);
  return box;
}

// 选定兵种后才入账：成功即移除箱子（不能反悔 / 重复选）；兵营满则保留箱子
export function claimRecruitBox(state, boxId, troopId) {
  const boxes = pendingRecruitBoxes(state);
  const idx = boxes.findIndex((b) => b && b.id === boxId);
  if (idx < 0) return { ok: false, reason: 'missing' };
  const box = boxes[idx];
  if (!troopId || rarityOf(troopId) !== box.rarity) return { ok: false, reason: 'invalid' };
  const unlocked = unlockedTroops(state, box.rarity).some((t) => t.id === troopId);
  if (!unlocked) return { ok: false, reason: 'locked' };
  const level = capTroopLevel(state, troopId, box.level);
  const unit = addUnit(state, troopId, level);
  if (!unit) return { ok: false, reason: 'full' };
  boxes.splice(idx, 1);
  return { ok: true, reason: 'ok', box, unit, troop: troopId, level };
}

/* ---------- 单抽 / 十连 ---------- */

function resolveRecruitEntry(state, entry, rng) {
  if (entry.kind === 'hero') {
    const r = recruitHeroResult(state, entry.tier, rng);
    if (r) return { entryId: entry.id, ...r };
    // 兜底（正常已被 rollRecruitEntry 过滤）：该品级英雄全部拥有 → 同品级兵种，
    // 兵种也没解锁则继续按既有规则降档，不让这一次抽空转。
    const pick = recruitedTroopFor(state, entry.tier, rng);
    if (!pick) return null;
    const level = capTroopLevel(state, pick.troop, CONFIG.heroes.recruit.levelByRarity[pick.rarity] || 3);
    const unit = addUnit(state, pick.troop, level);
    return {
      kind: 'troop', entryId: entry.id, troop: pick.troop, rarity: pick.rarity,
      requestedRarity: entry.tier, fallback: true, heroPoolFallback: true, level, unit, full: !unit,
    };
  }
  if (entry.kind === 'box') {
    const box = createRecruitBox(state, entry.rarity, entry.level);
    return {
      kind: 'box', entryId: entry.id, rarity: entry.rarity, level: box.level, boxId: box.id,
    };
  }
  const pick = recruitedTroopFor(state, entry.rarity, rng);
  if (!pick) return null;
  const level = capTroopLevel(state, pick.troop, entry.level);
  const unit = addUnit(state, pick.troop, level);
  return {
    kind: 'troop', entryId: entry.id, troop: pick.troop, rarity: pick.rarity,
    requestedRarity: entry.rarity, fallback: pick.fallback, level, unit, full: !unit,
  };
}

function pullOnce(state, rng) {
  const w = recruitWeights();
  const pity = w.pity;
  const misses = Math.max(0, Math.min(pity - 1, Math.floor(Number(state.heroPity) || 0)));
  // 连续 pity-1 抽没出传奇 → 这一抽强制传奇档（含自选箱在内的所有抽数都累计）
  const forced = misses >= pity - 1;
  const entry = rollRecruitEntry(state, rng, forced);
  const result = resolveRecruitEntry(state, entry, rng);
  // 「出金」按实际结果判定（未解锁传奇兵被降档时不算出金，保底会继续累计）
  state.heroPity = isLegendaryResult(result) ? 0 : Math.min(pity - 1, misses + 1);
  return result;
}

// 招募：每次消耗 1 张券；奖池按 CONFIG.heroes.recruit.pool 的权重落档。
// 20 抽保底：连续 19 抽未出传奇时第 20 抽强制传奇；出金后计数清零，自选箱计入抽数。
export function pullHeroes(state, count = 1, rng = Math.random) {
  const n = Math.max(1, Math.min(CONFIG.heroes.tenPull, Math.floor(count)));
  const need = n * CONFIG.heroes.pullCost;
  const have = heroTickets(state);
  if (have < need) return { ok: false, reason: 'ticket', need, have, results: [] };
  state.heroTickets = have - need;
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = pullOnce(state, rng);
    if (r) results.push(r);
  }
  return {
    ok: true, reason: 'ok', need, have: state.heroTickets, results,
    pendingBoxCount: pendingRecruitBoxes(state).length,
  };
}

/* ---------- 关卡赠送英雄（400 关关平，可领取、防重复；已拥有则按重复英雄规则折算） ---------- */

// 该关是否有「未领取」的英雄首通奖励
export function pendingLevelHeroReward(state, level) {
  const id = CONFIG.heroes.levelHeroRewards && CONFIG.heroes.levelHeroRewards[level];
  if (!id) return null;
  const claimed = state.heroLevelRewards && state.heroLevelRewards[level];
  return claimed ? null : id;
}

// 领取：同一关只能领一次（state.heroLevelRewards 记录）。
// 未拥有 → 获得 Lv1；已拥有 → 按招募的重复英雄规则折算（不再升级）。
export function claimLevelHeroReward(state, level) {
  const id = pendingLevelHeroReward(state, level);
  if (!id) return { ok: false, reason: 'claimed' };
  if (!state.heroLevelRewards || typeof state.heroLevelRewards !== 'object') state.heroLevelRewards = {};
  state.heroLevelRewards[level] = id;
  const h = heroById(id);
  if (!ownsHero(state, id)) {
    const r = grantHero(state, id, 1);
    return { ok: true, hero: id, duplicate: false, coins: 0, tickets: 0, ...r };
  }
  const tier = (h && h.tier) || 'epic';
  const conv = (CONFIG.heroes.recruit.duplicateHero || {})[tier] || { coins: 0, tickets: 0 };
  const coins = Math.max(0, Math.floor(conv.coins || 0));
  const tickets = Math.max(0, Math.floor(conv.tickets || 0));
  state.coins = (Number(state.coins) || 0) + coins;
  if (tickets) addHeroTickets(state, tickets);
  return {
    ok: true, hero: id, duplicate: true, coins, tickets,
    level: heroLevel(state, id), tier,
  };
}

// #dev-only:start
// 开发者通道：一键获得全部 12 名英雄（各 1 级，已拥有的不重复升）
export function devGrantAllHeroes(state) {
  const added = [];
  for (const h of HEROES) {
    if (ownsHero(state, h.id)) continue;
    const r = grantHero(state, h.id, 1);
    if (r.ok) added.push(h.id);
  }
  return { ok: true, added, total: HEROES.length };
}
// #dev-only:end

/* ---------- 升级 ---------- */

// 升级价格按品质：史诗为基准；传奇用 1.2→2.8 倍曲线，总花费约为史诗的 2.50 倍。
// tier 可传品质字符串或英雄 id（id 会自动解析品质）。
export function legendaryCostMult(level) {
  const cfg = CONFIG.heroes.legendaryCostMult || { start: 1, growth: 0 };
  const lv = Math.max(1, Math.min(HERO_MAX_LEVEL, Math.floor(level)));
  const m = HERO_MAX_LEVEL > 1 ? (lv - 1) / (HERO_MAX_LEVEL - 1) : 0;
  return cfg.start + cfg.growth * m;
}

export function heroUpgradeCost(level, tier = 'epic') {
  const lv = Math.max(1, Math.floor(level));
  const base = CONFIG.heroes.levelUpBase * Math.pow(CONFIG.heroes.levelUpGrowth, lv - 1);
  const t = tier && heroById(tier) ? heroById(tier).tier : tier;
  return Math.round(base * (t === 'legendary' ? legendaryCostMult(lv) : 1));
}

export function canUpgradeHero(state, id) {
  const lv = heroLevel(state, id);
  return lv > 0 && lv < heroLevelCap(state);
}

export function upgradeHero(state, id) {
  const lv = heroLevel(state, id);
  if (lv <= 0) return { ok: false, reason: 'notOwned', cost: 0 };
  if (lv >= heroLevelCap(state)) return { ok: false, reason: 'max', cost: 0 };
  const cost = heroUpgradeCost(lv, id);
  if (state.coins < cost) return { ok: false, reason: 'poor', cost };
  state.coins -= cost;
  state.heroes[id] = lv + 1;
  return { ok: true, reason: 'ok', cost, level: lv + 1 };
}

/* ---------- 上阵 ---------- */

// 英雄战力（单个将领，口径：血量 + 每秒输出×3 + 防御×2）
// hpMult：英雄战 Boss 血量 5~10 倍时同步放大，保证战力显示不虚
export function heroPower(id, level, hpMult = 1) {
  const s = heroStatsFor(id, level);
  if (!s) return 0;
  const tr = heroCombatTraits(id, level) || {};
  const interval = s.interval * (tr.intervalMult || 1);
  const dps = s.atk / interval * (tr.heroAtkMult || tr.multiArrow || 1);
  const healBonus = tr.selfHeal ? s.hp * tr.selfHeal * 3 : 0;
  const shieldBonus = tr.shieldStart ? (tr.shieldStart.hpMult ? s.hp * tr.shieldStart.hpMult : tr.shieldStart.hp) : 0;
  return Math.round(s.hp * hpMult + dps * 3 + s.def * 2 + healBonus + shieldBonus);
}

// 把已拥有的英雄排进布阵里空着的格子（前排优先），返回 { troop, level, hero, col, row }
export function placeHeroSquads(state) {
  const heroes = unlockedHeroes(state);
  if (!heroes.length) return [];
  const used = new Set();
  const form = Array.isArray(state.formation) ? state.formation : [];
  for (let i = 0; i < form.length; i++) {
    if (form[i]) {
      const cell = formationCell(i);
      used.add(formationIndex(cell.col, cell.row));
    }
  }
  const cols = CONFIG.formation.cols;
  const rows = CONFIG.formation.rows;
  const rowPref = [2, 1, 3, 0, 4];
  const colPref = [cols - 1, cols - 2, cols - 3, cols - 4, 0];
  const out = [];
  // 按当前开放的英雄上阵位（1/2/3）上阵：超出部分留在英雄列表里，不自动出场
  for (const h of heroes.slice(0, heroDeploySlots(state))) {
    let spot = null;
    for (const col of colPref) {
      for (const row of rowPref) {
        const idx = formationIndex(col, row);
        if (!used.has(idx)) { spot = { col, row }; break; }
      }
      if (spot) break;
    }
    // 25 个布阵格塞满时，把英雄放到方阵外侧（前排两侧），保证将领一定上场
    if (!spot) {
      const extRows = [2, 1, 3];
      for (const col of [cols, cols - 1, -1]) {
        for (const row of extRows) {
          const key = 100000 + (col + 10) * 100 + (row + 10);
          if (!used.has(key)) { spot = { col, row, ext: true }; used.add(key); break; }
        }
        if (spot) break;
      }
    }
    if (!spot) break;
    if (!spot.ext) used.add(formationIndex(spot.col, spot.row));
    out.push({ troop: h.troop, level: heroLevel(state, h.id), hero: h.id, col: spot.col, row: spot.row });
  }
  return out;
}
