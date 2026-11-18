// 每日挑战（1.2.5）：主线 30 关后解锁，30 关按顺序推进、常开不轮换。
// 每关 = 主线锚点关（300 → 2000）的满编敌军 + K 名敌方英雄带队：
//   1~12 单将（先史诗后传奇）、13~24 双将、25~30 三将；Boss 血量 ×3 → ×12。
// 首通永久记录（30 位进度）+ 铜钱/宝箱阶梯；重复挑战每天前 3 胜各发一份小额奖励。
import { CONFIG } from './config.js';
import { levelDef } from '../core/levels.js';
import { engineStageFor } from '../core/siege.js';
import { enemyBookScales } from '../core/books.js';
import { ensureDaily } from '../core/daily.js';
import { heroById } from './heroes.js';
import { heroBattleRankLabel } from './heroBattles.js';
import { troopPower } from '../core/power.js';
import { heroPower } from '../core/heroes.js';

// 30 关英雄出场表（与 CONFIG.dailyChallenge.doubleFrom / tripleFrom 对应）
const STAGE_HEROES = [
  // 1~6：史诗单将
  ['guanping'], ['zhangren'], ['huanggai'], ['liru'], ['zhangjiao'], ['xiahouyuan'],
  // 7~12：传奇单将
  ['zhangfei'], ['guanyu'], ['liubei'], ['caocao'], ['zhouyu'], ['dongzhuo'],
  // 13~24：双将
  ['guanping', 'zhangfei'], ['zhangren', 'guanyu'], ['huanggai', 'liubei'], ['liru', 'caocao'],
  ['zhangjiao', 'zhouyu'], ['xiahouyuan', 'dongzhuo'], ['zhangfei', 'guanyu'], ['liubei', 'caocao'],
  ['zhouyu', 'dongzhuo'], ['guanping', 'dongzhuo'], ['zhangjiao', 'guanyu'], ['caocao', 'dongzhuo'],
  // 25~30：三将（第 30 关收尾）
  ['zhangfei', 'guanyu', 'liubei'], ['zhangfei', 'caocao', 'dongzhuo'],
  ['guanyu', 'liubei', 'zhouyu'], ['zhangfei', 'guanyu', 'dongzhuo'],
  ['liubei', 'caocao', 'zhouyu'], ['dongzhuo', 'caocao', 'guanyu'],
];

function stageOf(v) {
  const s = Math.floor(Number(v) || 1);
  return Math.max(1, Math.min(CONFIG.dailyChallenge.total, s));
}

export function dailyTotal() {
  return CONFIG.dailyChallenge.total;
}

// 每关英雄数：1~12 单将 / 13~24 双将 / 25~30 三将
export function dailyHeroCount(stage) {
  const s = stageOf(stage);
  if (s >= CONFIG.dailyChallenge.tripleFrom) return 3;
  if (s >= CONFIG.dailyChallenge.doubleFrom) return 2;
  return 1;
}

export function dailyHeroes(stage) {
  return [...(STAGE_HEROES[stageOf(stage) - 1] || ['guanping'])];
}

// Boss 血量倍数：3 → 12 线性递增（1 位小数）
export function dailyHpMult(stage) {
  const s = stageOf(stage);
  const { hpMultFrom: a, hpMultTo: b } = CONFIG.dailyChallenge;
  const v = a + (b - a) * ((s - 1) / (CONFIG.dailyChallenge.total - 1));
  return Math.round(v * 10) / 10;
}

// Boss 英雄等级：2 → 30 线性递增（与锚点 300 → 2000 同步攀升）
export function dailyHeroLevel(stage) {
  const s = stageOf(stage);
  return Math.max(1, Math.min(30, Math.round(2 + 28 * ((s - 1) / (CONFIG.dailyChallenge.total - 1)))));
}

// 关卡锚点：300 → 2000（engineStageFor('daily', ...)，与主线战力口径对齐）
export function dailyAnchor(stage) {
  return engineStageFor('daily', stageOf(stage));
}

// 把每日英雄写进敌阵：接管 base 里已有的英雄位（主线 heroBoss / 守将），
// 不够的从队尾补；多余的英雄位还原成普通小队（借相邻普通队的兵种与等级，
// 保留原站位与倍率，保证 25 队编制与格子不重叠）。
function buildEnemies(base, heroes, hpMult, heroLevel, book) {
  const enemies = base.enemies.map((e) => ({ ...e }));
  const heroSlots = [];
  enemies.forEach((e, i) => { if (e.hero) heroSlots.push(i); });
  const slots = [];
  for (const i of heroSlots) {
    if (slots.length < heroes.length) slots.push(i);
  }
  for (let i = enemies.length - 1; i >= 0 && slots.length < heroes.length; i--) {
    if (!enemies[i].hero && !slots.includes(i)) slots.push(i);
  }
  // 多余英雄位还原成普通小队
  for (const i of heroSlots) {
    if (slots.includes(i)) continue;
    const tpl = enemies[i - 1] && !enemies[i - 1].hero ? enemies[i - 1] : enemies.find((e) => !e.hero);
    if (!tpl) continue;
    const out = { ...enemies[i], troop: tpl.troop, level: tpl.level };
    delete out.hero;
    delete out.boss;
    delete out.heroScale;
    if ('hpMult' in tpl) out.hpMult = tpl.hpMult;
    else delete out.hpMult;
    enemies[i] = out;
  }
  // 每日英雄就位（保留原格子；敌方兵书加成与普通队同口径：血量倍数同时相乘）
  slots.forEach((i, k) => {
    const h = heroById(heroes[k]);
    if (!h) return;
    const out = {
      ...enemies[i],
      troop: h.troop,
      level: heroLevel,
      hero: h.id,
      boss: true,
      heroScale: 1.45,
      hpMult: book ? Math.round(hpMult * book.hpMult * 100) / 100 : hpMult,
      rankLabel: heroBattleRankLabel(h.troop),
    };
    if (book) {
      out.atkScale = (out.atkScale || 1) * book.atkScale;
      out.defScale = (out.defScale || 1) * book.defScale;
    }
    enemies[i] = out;
  });
  return enemies;
}

// 每日挑战关卡 def：走 BattleScreen 的英雄战 UI 通道（heroBattle: true），
// 但结算走独立分支（不写 heroBattleCleared）
export function dailyBattleDef(stage) {
  const s = stageOf(stage);
  const anchor = dailyAnchor(s);
  const base = levelDef(anchor);
  const heroes = dailyHeroes(s).filter((id) => heroById(id));
  const hpMult = dailyHpMult(s);
  const heroLevel = dailyHeroLevel(s);
  const book = enemyBookScales(anchor);
  const enemies = buildEnemies(base, heroes, hpMult, heroLevel, book);
  const bosses = enemies.filter((e) => e.boss);
  const squads = enemies.filter((e) => !e.boss);
  const names = bosses.map((b) => (heroById(b.hero) || {}).name || b.hero).join(' / ');
  const rankText = [...new Set(bosses.map((b) => b.rankLabel))].join(' / ');
  return {
    ...base,
    stage: s,
    anchor,
    enemies,
    squads,
    bosses,
    bossCount: bosses.length,
    heroes: bosses.map((b) => b.hero),
    hero: bosses[0] ? bosses[0].hero : null,
    hpMult,
    name: `每日挑战 · 第 ${s} 关`,
    desc: `${names} 带队：血量 ×${hpMult} + ${squads.length} 队敌军（对标主线第 ${anchor} 关）`,
    rankText,
    enemyLevel: Math.min(...enemies.map((e) => e.level)),
    enemyLevelMax: Math.max(...enemies.map((e) => e.level)),
    heroBattle: true,
    dailyChallenge: true,
  };
}

// 关卡战力预览（不含器械，与英雄战口径一致）
export function dailyBattlePower(stage) {
  const def = dailyBattleDef(stage);
  return def.enemies.reduce((sum, e) => sum + (e.hero
    ? heroPower(e.hero, e.level, e.hpMult || 1)
    : troopPower(e.troop, e.level)), 0);
}

/* ---------- 解锁与进度 ---------- */
export function dailyUnlocked(state) {
  return (state?.maxCleared ?? 0) >= CONFIG.dailyChallenge.unlockLevel;
}

export function dailyClearedCount(state) {
  const p = state?.dailyChallenge?.progress;
  if (!Array.isArray(p)) return 0;
  let n = 0;
  for (let i = 0; i < CONFIG.dailyChallenge.total; i++) if (p[i]) n++;
  return n;
}

// 顺序解锁：第 N 关需要先过 N-1（30 关全通后全开）
export function dailyStageUnlocked(state, stage) {
  if (!dailyUnlocked(state)) return false;
  return stageOf(stage) <= dailyClearedCount(state) + 1;
}

export function dailyFirstClearReward(stage) {
  const s = stageOf(stage);
  const coins = Math.min(20000, Math.round(800 * Math.pow(1.12, s - 1)));
  const chest = s <= 10 ? 'wood' : s <= 20 ? 'silver' : 'rare';
  return { coins, chest };
}

// 首通记录：进度位 + 铜钱 + 宝箱一次性发放（重复通关不发）
export function recordDailyClear(state, stage, addChestFn) {
  const s = stageOf(stage);
  if (!state.dailyChallenge || !Array.isArray(state.dailyChallenge.progress)) {
    state.dailyChallenge = { progress: Array(CONFIG.dailyChallenge.total).fill(0) };
  }
  if (state.dailyChallenge.progress[s - 1]) return { firstClear: false, coins: 0, chest: null };
  state.dailyChallenge.progress[s - 1] = 1;
  const r = dailyFirstClearReward(s);
  state.coins += r.coins;
  if (addChestFn) addChestFn(r.chest, 1);
  return { firstClear: true, coins: r.coins, chest: r.chest };
}

// 重复挑战胜场：每天前 3 胜各发铜钱 + 小木箱（跨天由 ensureDaily 重置）
export function recordDailyRepeatWin(state, addChestFn) {
  const cfg = CONFIG.dailyChallenge;
  const s = ensureDaily(state);
  if (s.dailyWins >= cfg.dailyWinLimit) {
    return { rewarded: false, coins: 0, chest: null, wins: s.dailyWins };
  }
  s.dailyWins += 1;
  state.coins += cfg.dailyWinCoins;
  if (addChestFn) addChestFn(cfg.dailyWinChest, 1);
  return { rewarded: true, coins: cfg.dailyWinCoins, chest: cfg.dailyWinChest, wins: s.dailyWins };
}
