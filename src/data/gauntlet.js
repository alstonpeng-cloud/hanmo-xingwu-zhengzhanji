// 过 5 关斩 6 将：静态关卡 / 奖励数据
// 每章 5 关，共 6 名敌将（前 4 关各 1 名，第 5 关 2 名）。
// 敌方强度刻意压低：考的是阵型与克制，不是数值碾压。
import { CONFIG } from './config.js';
import { heroById } from './heroes.js';
import { heroPower } from '../core/heroes.js';
import { troopPower } from '../core/power.js';

export function gauntletChapters() {
  return CONFIG.gauntlet.chapters;
}

export function gauntletChapter(id) {
  return gauntletChapters().find((c) => c.id === id) || null;
}

export function gauntletChapterIndex(id) {
  return gauntletChapters().findIndex((c) => c.id === id);
}

// 章节序号（0 起）：第 1 章恒开放；后续章节需要前一章首通。
// 首通记录永久保留，所以通过一章后，次日及以后都可以直接从后面的章节开始（跳过前面）。
export function gauntletChapterUnlocked(state, id) {
  const idx = gauntletChapterIndex(id);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const cleared = (state.gauntlet && state.gauntlet.cleared) || [];
  return cleared.includes(gauntletChapters()[idx - 1].id);
}

// 精锐护卫落位：5×5 内避开 Boss 前排，最多容纳 12 队且互不重叠
const GUARD_CELLS = [
  [1, 0], [1, 2], [1, 4], [2, 1], [2, 3], [2, 0],
  [2, 4], [1, 1], [1, 3], [3, 0], [3, 2], [3, 4],
];

// 原始编成（不含难度倍率）：Boss（1~2 名）+ 精锐护卫
function rawStageDef(chapterId, stage) {
  const ch = gauntletChapter(chapterId);
  if (!ch) return null;
  const total = CONFIG.gauntlet.stagesPerChapter;
  const n = Math.max(1, Math.min(total, Math.floor(stage || 1)));
  const isFinal = n === total;
  // 每章 6 名敌将：前 4 关各 1 名，第 5 关双将压阵（正好「过 5 关斩 6 将」）
  const bossIds = isFinal ? ch.generals.slice(4, 6) : [ch.generals[n - 1]];
  const bossLevel = ch.bossLevel + (isFinal ? 1 : 0);
  const bossRows = isFinal ? [1, 3] : [2];
  const bosses = bossIds.map((id, i) => {
    const cfg = heroById(id);
    return {
      troop: cfg.troop, level: bossLevel, hero: id, hpMult: ch.bossHpMult,
      boss: true, heroScale: 1.4, col: 0, row: bossRows[i] ?? 2,
    };
  });
  const guardCount = Math.max(2, ch.guardSquads - (isFinal ? 0 : 1));
  const guards = Array.from({ length: guardCount }, (_, i) => ({
    troop: ch.guards[i % ch.guards.length],
    level: ch.guardLevel + (n >= 4 ? 1 : 0),
    col: GUARD_CELLS[i % GUARD_CELLS.length][0],
    row: GUARD_CELLS[i % GUARD_CELLS.length][1],
  }));
  return {
    gauntlet: true,
    chapter: ch.id,
    stage: n,
    name: `${ch.name} · 第 ${n} 关`,
    enemies: [...bosses, ...guards],
    bosses,
    bossCount: bosses.length,
    squads: guards,
    enemyLevel: Math.min(bossLevel, ch.guardLevel + (n >= 4 ? 1 : 0)),
    enemyLevelMax: Math.max(bossLevel, ch.guardLevel + (n >= 4 ? 1 : 0)),
    desc: isFinal
      ? `${bossIds.map((b) => (heroById(b)?.name || b)).join(' / ')} 双将压阵 + ${guards.length} 队护卫`
      : `${heroById(bossIds[0])?.name || '敌将'} 坐镇 + ${guards.length} 队护卫`,
  };
}

// 难度曲线：章节峰值按幂曲线从 startPeak 抬到 endPeak（≈ 主线 2600 终章），
// 章内 5 关按 stageFactor 严格递增；前 6 章手写内容「只升不降」，后 6 章精确贴线。
// 每章峰值至少比上一章高 4%，消除旧版「换章反而变简单」的起伏。
const HAND_WRITTEN_CHAPTERS = 6;
const scaleCache = new Map();

function rawPower(enemies) {
  return enemies.reduce((sum, q) => sum
    + (q.hero ? heroPower(q.hero, q.level, q.hpMult || 1) : troopPower(q.troop, q.level)), 0);
}

function chapterPeak(idx) {
  const curve = CONFIG.gauntlet.curve;
  const chapters = gauntletChapters();
  const t = chapters.length <= 1 ? 0 : idx / (chapters.length - 1);
  const smooth = curve.startPeak * Math.pow(curve.endPeak / curve.startPeak, t);
  if (idx <= 0) return smooth;
  const prev = stagePlan(chapters[idx - 1].id);
  const prevPeak = prev ? Math.max(...prev.targets) : smooth;
  return Math.max(smooth, prevPeak * 1.04);
}

function stagePlan(chapterId) {
  if (scaleCache.has(chapterId)) return scaleCache.get(chapterId);
  const idx = gauntletChapterIndex(chapterId);
  if (idx < 0) return null;
  const curve = CONFIG.gauntlet.curve;
  const peak = chapterPeak(idx);
  const total = CONFIG.gauntlet.stagesPerChapter;
  const bases = [];
  const targets = [];
  for (let s = 1; s <= total; s++) {
    const raw = rawStageDef(chapterId, s);
    const base = rawPower(raw.enemies);
    bases.push(base);
    const smoothTarget = peak * (curve.stageFactor[s - 1] ?? 1);
    let target = idx < HAND_WRITTEN_CHAPTERS
      ? Math.max(base, smoothTarget) : smoothTarget;
    if (s > 1) target = Math.max(target, targets[s - 2] * 1.03);
    targets.push(target);
  }
  const plan = {
    targets,
    scales: targets.map((v, i) => Math.max(0.5, Math.min(3, v / Math.max(1, bases[i])))),
  };
  scaleCache.set(chapterId, plan);
  return plan;
}

// 单关敌方编成（含章节难度倍率）
export function gauntletStageDef(chapterId, stage) {
  const plan = stagePlan(chapterId);
  if (!plan) return null;
  const n = Math.max(1, Math.min(CONFIG.gauntlet.stagesPerChapter, Math.floor(stage || 1)));
  const raw = rawStageDef(chapterId, n);
  const scale = plan.scales[n - 1];
  // statMult 与主线 / 演武同机制：只放大生命与攻击，不动防御
  const statMult = Math.round(scale * 1000) / 1000;
  raw.enemies.forEach((q) => { q.statMult = statMult; });
  return {
    ...raw,
    difficulty: scale,
    targetPower: Math.round(plan.targets[n - 1]),
  };
}

// 有效战力（含难度倍率），布阵页 / 战斗 HUD / 测试都以此为准
export function gauntletStagePower(chapterId, stage) {
  const def = gauntletStageDef(chapterId, stage);
  if (!def) return 0;
  return Math.round(rawPower(def.enemies) * def.difficulty);
}

// 章节首通奖励：自选卡包（品级 / 等级随章节递增）+ 铜钱
export function gauntletFirstClear(chapter) {
  if (!chapter) return null;
  return {
    rarity: chapter.rarity,
    level: chapter.boxLevel,
    coins: chapter.firstClearCoins,
  };
}

export const GAUNTLET_NAME = '过 5 关斩 6 将';
