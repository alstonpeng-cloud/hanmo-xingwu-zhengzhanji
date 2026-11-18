// 周常挑战（1.2.5）：每周积分 draft 选兵 + 5 档 × 10 小关。
// 换周（北京周一起算）由 ensureWeekly 整域重建：积分 / 兵牌 / 进度全部归零。
// 难度模型：敌方目标战力 = draftCapPower(1600 分贪心满编上限) × 档位倍率 × 小关递增，
// 用 def.difficulty（hp/atk 倍数）把 levelDef 锚点关校准到目标 —— 差额只能靠
// 玩家的英雄 / 器械 / 兵书真实练度补，正是五档的养成门槛设计。
import { CONFIG } from '../data/config.js';
import { weekKey, dateKey } from './daily.js';
import { now as clockNow } from './clock.js';
import { levelDef } from './levels.js';
import { engineStageFor } from './siege.js';
import { troopPower } from './power.js';
import { heroById, heroIdFromEntry } from '../data/heroes.js';
import { formationCell } from './formation.js';
import {
  weeklyTierName, weeklyStageCoins, weeklyStageChest, weeklyTierBonusCoins,
  weeklyTroopCost, weeklyTroopUpgradeCost,
} from '../data/weekly.js';

export function weeklyUnlocked(state) {
  return (state?.maxCleared ?? 0) >= (CONFIG.weekly.unlockLevel || 1);
}

function emptyWeekly(key) {
  return {
    key,
    points: CONFIG.weekly.points,
    roster: [],
    form: [],
    tier: 1,
    nextId: 1,
    cleared: Array(CONFIG.weekly.tiers).fill(0),
    firstClear: Array(CONFIG.weekly.tiers).fill(0),
    sweepDay: '',
    sweepCount: 0,
  };
}

// 每周进入时调用：key 不一致 → 整域重建（积分全额回归 1600）；扫荡次数单独按天重置
export function ensureWeekly(state, now = clockNow()) {
  if (!state.weekly || typeof state.weekly !== 'object') state.weekly = emptyWeekly('');
  const s = state.weekly;
  const k = weekKey(now);
  if (s.key !== k) {
    const fresh = emptyWeekly(k);
    state.weekly = fresh;
    return fresh;
  }
  // 结构护栏（脏数据不炸界面）
  s.points = Number.isFinite(s.points) ? Math.max(0, Math.floor(s.points)) : CONFIG.weekly.points;
  s.tier = Math.max(1, Math.min(CONFIG.weekly.tiers, Math.floor(Number(s.tier) || 1)));
  if (!Array.isArray(s.roster)) s.roster = [];
  if (!Array.isArray(s.form)) s.form = [];
  const cells = CONFIG.formation.cols * CONFIG.formation.rows;
  while (s.form.length < cells) s.form.push(null);
  if (!Array.isArray(s.cleared) || s.cleared.length !== CONFIG.weekly.tiers) {
    s.cleared = Array(CONFIG.weekly.tiers).fill(0);
  }
  if (!Array.isArray(s.firstClear) || s.firstClear.length !== CONFIG.weekly.tiers) {
    s.firstClear = Array(CONFIG.weekly.tiers).fill(0);
  }
  // 扫荡次数按天重置
  const today = dateKey(now);
  if (s.sweepDay !== today) {
    s.sweepDay = today;
    s.sweepCount = 0;
  }
  s.sweepCount = Number.isFinite(s.sweepCount)
    ? Math.max(0, Math.min(CONFIG.weekly.sweepDailyLimit, Math.floor(s.sweepCount))) : 0;
  return s;
}

/* ---------- draft 选兵 ---------- */
// 玩家可用于 draft 的兵种 = 已解锁兵种（主线推进自动补齐）
export function weeklyAvailableTroops(state) {
  const unlocked = Array.isArray(state.troopUnlocks) && state.troopUnlocks.length
    ? state.troopUnlocks : CONFIG.startArmy.map((u) => u.troop);
  return CONFIG.troops
    .filter((t) => unlocked.includes(t.id))
    .map((t) => t.id);
}

// 1600 积分贪心买满的理论战力上限（不含英雄 / 器械 / 兵书 —— 纯 draft 标尺）
// 贪心按「战力 / 积分」比值取牌，同牌可重复买（布阵 25 格上限），确定性可断言。
export function draftCapPower(state) {
  const W = CONFIG.weekly;
  const pool = weeklyAvailableTroops(state);
  const options = [];
  for (const id of pool) {
    for (let lv = 1; lv <= CONFIG.merge.maxLevel; lv++) {
      const power = troopPower(id, lv);
      const cost = weeklyTroopCost(id, lv);
      if (power > 0 && cost > 0) options.push({ power, cost });
    }
  }
  options.sort((a, b) => (b.power / b.cost) - (a.power / a.cost));
  let pts = W.points;
  const slots = CONFIG.formation.cols * CONFIG.formation.rows;
  let sum = 0;
  for (let i = 0; i < slots; i++) {
    const opt = options.find((o) => o.cost <= pts);
    if (!opt) break;
    sum += opt.power;
    pts -= opt.cost;
  }
  return Math.round(sum);
}

export function buyWeeklyTroop(state, troopId) {
  if (!weeklyUnlocked(state)) return { ok: false, reason: 'locked' };
  const s = ensureWeekly(state);
  if (!weeklyAvailableTroops(state).includes(troopId)) return { ok: false, reason: 'lockedTroop' };
  const cells = CONFIG.formation.cols * CONFIG.formation.rows;
  if (s.roster.length >= cells) return { ok: false, reason: 'full' };
  const cost = weeklyTroopCost(troopId, 1);
  if (s.points < cost) return { ok: false, reason: 'points', cost };
  s.points -= cost;
  const entry = { id: `w${s.nextId++}`, troop: troopId, level: 1 };
  s.roster.push(entry);
  return { ok: true, reason: 'ok', cost, entry };
}

// 升级（只补差价，等级越高越贵）
export function upgradeWeeklyTroop(state, uid) {
  if (!weeklyUnlocked(state)) return { ok: false, reason: 'locked' };
  const s = ensureWeekly(state);
  const entry = s.roster.find((r) => r.id === uid);
  if (!entry) return { ok: false, reason: 'unknown' };
  if (entry.level >= CONFIG.merge.maxLevel) return { ok: false, reason: 'max' };
  const cost = weeklyTroopUpgradeCost(entry.troop, entry.level);
  if (s.points < cost) return { ok: false, reason: 'points', cost };
  s.points -= cost;
  entry.level += 1;
  return { ok: true, reason: 'ok', cost, level: entry.level };
}

// 卖出：全额退买断价，并从阵型里摘掉这格
export function removeWeeklyTroop(state, uid) {
  if (!weeklyUnlocked(state)) return { ok: false, reason: 'locked' };
  const s = ensureWeekly(state);
  const idx = s.roster.findIndex((r) => r.id === uid);
  if (idx < 0) return { ok: false, reason: 'unknown' };
  const entry = s.roster[idx];
  const refund = weeklyTroopCost(entry.troop, entry.level);
  s.points += refund;
  s.roster.splice(idx, 1);
  s.form = s.form.map((v) => (v === uid ? null : v));
  return { ok: true, reason: 'ok', refund };
}

/* ---------- draft 阵型 ---------- */
// 与 activeFormation 同构，但兵牌来自 state.weekly.roster：
// 同兵种多格天然允许（每格指向不同 w:id，不去重外的限制）；英雄格 "h:id" 只允许 1 个
export function draftActiveFormation(state) {
  const w = state.weekly || {};
  const roster = Array.isArray(w.roster) ? w.roster : [];
  const byId = new Map(roster.map((u) => [u.id, u]));
  const form = Array.isArray(w.form) ? w.form : [];
  const list = [];
  const seen = new Set();
  const seenHero = new Set();
  form.forEach((entry, idx) => {
    if (!entry || seen.has(entry)) return;
    const heroId = heroIdFromEntry(entry);
    if (heroId) {
      if (seenHero.has(heroId)) return;
      const lv = Math.floor((state.heroes && state.heroes[heroId]) || 0);
      const hero = heroById(heroId);
      if (!hero || lv <= 0) return;
      seenHero.add(heroId);
      seen.add(entry);
      const { col, row } = formationCell(idx);
      list.push({ uid: entry, troop: hero.troop, level: lv, hero: heroId, col, row });
      return;
    }
    const unit = byId.get(entry);
    if (!unit) return;
    seen.add(entry);
    const { col, row } = formationCell(idx);
    list.push({ uid: entry, unit, troop: unit.troop, level: unit.level, col, row });
  });
  return list.slice(0, CONFIG.formation.maxUnits);
}

// 阵上的兵牌 id 集合（布阵页判断「未上阵」用）
export function draftDeployedIds(state) {
  const form = (state.weekly && Array.isArray(state.weekly.form)) ? state.weekly.form : [];
  return new Set(form.filter((v) => typeof v === 'string' && !v.startsWith('h:')));
}

/* ---------- 档位与关卡解锁 ---------- */
export function weeklyTierUnlocked(state, tier) {
  if (!weeklyUnlocked(state)) return false;
  const s = ensureWeekly(state);
  const t = Math.max(1, Math.min(CONFIG.weekly.tiers, Math.floor(Number(tier) || 1)));
  if (t === 1) return true;
  const prevMask = (1 << CONFIG.weekly.stagesPerTier) - 1;
  return (s.cleared[t - 2] & prevMask) === prevMask;
}

export function weeklyStageUnlocked(state, tier, stage) {
  if (!weeklyUnlocked(state)) return false;
  const s = ensureWeekly(state);
  const t = Math.max(1, Math.min(CONFIG.weekly.tiers, Math.floor(Number(tier) || 1)));
  const st = Math.max(1, Math.min(CONFIG.weekly.stagesPerTier, Math.floor(Number(stage) || 1)));
  if (!weeklyTierUnlocked(state, t)) return false;
  if (st === 1) return true;
  return !!(s.cleared[t - 1] & (1 << (st - 2)));
}

export function weeklyTierClearedCount(state, tier) {
  const s = ensureWeekly(state);
  const t = Math.max(1, Math.min(CONFIG.weekly.tiers, Math.floor(Number(tier) || 1)));
  const mask = s.cleared[t - 1] || 0;
  let n = 0;
  for (let i = 0; i < CONFIG.weekly.stagesPerTier; i++) if (mask & (1 << i)) n++;
  return n;
}

export function weeklyClearedTotal(state) {
  let n = 0;
  for (let t = 1; t <= CONFIG.weekly.tiers; t++) n += weeklyTierClearedCount(state, t);
  return n;
}

/* ---------- 难度模型 ---------- */
// 敌方目标战力 = draft 上限 × 档位倍率 × 小关递增；从 levelDef(档位锚点) 起手，
// 剥掉敌方英雄位（周常考的是「你带英雄打敌阵」，不给敌方送英雄）与低档位敌方器械，
// 再把 hp/atk 倍数整体缩放到目标 —— display（×difficulty）与真实战场同一口径。
export function weeklyLevelDef(state, tier, stage) {
  const t = Math.max(1, Math.min(CONFIG.weekly.tiers, Math.floor(Number(tier) || 1)));
  const st = Math.max(1, Math.min(CONFIG.weekly.stagesPerTier, Math.floor(Number(stage) || 1)));
  const anchor = engineStageFor('weekly', t);
  const def = levelDef(anchor);
  const W = CONFIG.weekly;
  if (t < W.engineFromTier) def.engine = null;

  // 剥离敌方英雄位：还原成普通小队（借邻位兵种 / 等级 / 倍率，保留站位）
  const enemies = def.enemies.map((e) => ({ ...e }));
  enemies.forEach((e, i) => {
    if (!e.hero) return;
    const tpl = enemies[i - 1] && !enemies[i - 1].hero ? enemies.find((x) => !x.hero) : enemies.find((x) => !x.hero);
    if (!tpl) return;
    const out = { ...e, troop: tpl.troop, level: tpl.level };
    delete out.hero;
    delete out.boss;
    delete out.heroScale;
    if ('hpMult' in tpl) out.hpMult = tpl.hpMult; else delete out.hpMult;
    if ('atkScale' in tpl) out.atkScale = tpl.atkScale; else delete out.atkScale;
    if ('defScale' in tpl) out.defScale = tpl.defScale; else delete out.defScale;
    delete out.rankLabel;
    enemies[i] = out;
  });

  const cap = draftCapPower(state);
  const target = Math.round(
    cap * (W.tierMult[t - 1] || 1) * (1 + (W.stageGrowth || 0) * (st - 1)),
  );
  const base = enemies.reduce((sum, q) => sum + troopPower(q.troop, q.level), 0)
    * (Number(def.difficulty) || 1);
  const k = base > 0 ? Math.max(0.2, Math.min(6, target / base)) : 1;
  const scaled = enemies.map((e) => ({
    ...e,
    hpMult: (e.hpMult || 1) * k,
    atkScale: (e.atkScale || 1) * k,
  }));
  const difficulty = (Number(def.difficulty) || 1) * k;
  return {
    ...def,
    enemies: scaled,
    engine: def.engine || null,
    difficulty,
    name: `周常 · ${weeklyTierName(t)} 档 · 第 ${st} 关`,
    desc: `1600 积分选兵对抗：敌方战力 ${target}（你的纯兵上限 ${cap} × ${W.tierMult[t - 1]}）`,
    weekly: { tier: t, stage: st },
    targetPower: target,
    draftCap: cap,
    heroBoss: false,
    bosses: [],
    squads: scaled,
    bossCount: 0,
  };
}

/* ---------- 结算：首通 / 档位完成 / 扫荡 ---------- */
export function recordWeeklyClear(state, tier, stage, addChestFn) {
  const s = ensureWeekly(state);
  const t = Math.max(1, Math.min(CONFIG.weekly.tiers, Math.floor(Number(tier) || 1)));
  const st = Math.max(1, Math.min(CONFIG.weekly.stagesPerTier, Math.floor(Number(stage) || 1)));
  const bit = 1 << (st - 1);
  const out = { firstClear: false, coins: 0, chest: null, tierDone: false, tierCoins: 0, tierChest: null };
  if (s.cleared[t - 1] & bit) return out;
  s.cleared[t - 1] |= bit;
  s.firstClear[t - 1] |= bit;
  // 累计计数器：成就「周常征伐」按累计首通计（周常进度本身每周归零）
  if (!state.counters) state.counters = { chestsOpened: 0, sweeps: 0, weeklyClears: 0 };
  state.counters.weeklyClears = (state.counters.weeklyClears || 0) + 1;
  const coins = weeklyStageCoins(t);
  state.coins += coins;
  out.firstClear = true;
  out.coins = coins;
  out.chest = weeklyStageChest(t, st);
  if (out.chest && addChestFn) addChestFn(out.chest, 1);
  // 档位第 10 关 = 档位完成大赏
  if (st === CONFIG.weekly.stagesPerTier) {
    const bonus = weeklyTierBonusCoins(t);
    state.coins += bonus;
    out.tierDone = true;
    out.tierCoins = bonus;
  }
  return out;
}

// 扫荡：只扫本周已通关的小关，每日 6 次，拿该关首通铜钱的 60%，不给宝箱
export function weeklySweep(state, tier, stage, now = clockNow()) {
  if (!weeklyUnlocked(state)) return { ok: false, reason: 'locked' };
  const s = ensureWeekly(state);
  const t = Math.max(1, Math.min(CONFIG.weekly.tiers, Math.floor(Number(tier) || 1)));
  const st = Math.max(1, Math.min(CONFIG.weekly.stagesPerTier, Math.floor(Number(stage) || 1)));
  if (!(s.cleared[t - 1] & (1 << (st - 1)))) return { ok: false, reason: 'notCleared' };
  if (s.sweepCount >= CONFIG.weekly.sweepDailyLimit) return { ok: false, reason: 'limit' };
  const coins = Math.round(weeklyStageCoins(t) * CONFIG.weekly.sweepRatio);
  s.sweepCount += 1;
  state.coins += coins;
  if (!state.counters) state.counters = { chestsOpened: 0, sweeps: 0, weeklyClears: 0 };
  state.counters.sweeps = (state.counters.sweeps || 0) + 1;
  return { ok: true, reason: 'ok', coins, wins: s.sweepCount, chest: null };
}
