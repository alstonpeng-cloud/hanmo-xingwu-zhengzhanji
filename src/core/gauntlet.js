// 过 5 关斩 6 将：跑关状态机
// 一冲到底：进入章节时把当前布阵快照成 run；兵死不可复活、血量跨关不回复、只能调位置。
import { CONFIG } from '../data/config.js';
import { activeFormation } from './levels.js';
import { engineChoice } from './siege.js';
import { addChest } from './chests.js';
import { createRecruitBox } from './heroes.js';
import { dateKey } from './daily.js';
import { now as clockNow } from './clock.js';
import {
  gauntletChapter, gauntletChapters, gauntletChapterUnlocked,
  gauntletStageDef, gauntletFirstClear,
} from '../data/gauntlet.js';

export function gauntletUnlocked(state) {
  return (state.maxCleared || 0) >= CONFIG.gauntlet.unlockLevel;
}

export function gauntletState(state) {
  if (!state.gauntlet || typeof state.gauntlet !== 'object') {
    state.gauntlet = { cleared: [], dailyDay: '', run: null };
  }
  return state.gauntlet;
}

export function gauntletDailyAvailable(state, now = clockNow()) {
  return gauntletState(state).dailyDay !== dateKey(now);
}

// 开始一次冲锋：快照当前布阵（英雄格也算），全部满血
export function startGauntletRun(state, chapterId) {
  if (!gauntletUnlocked(state)) return { ok: false, reason: 'locked' };
  const st = gauntletState(state);
  if (st.run) return { ok: false, reason: 'running' };
  if (!gauntletChapter(chapterId)) return { ok: false, reason: 'unknown' };
  if (!gauntletChapterUnlocked(state, chapterId)) return { ok: false, reason: 'chapterLocked' };
  const units = activeFormation(state).filter((u) => !(u.unit && u.unit.trialLeft > 0)).map((u) => ({
    troop: u.troop, level: u.level, hero: u.hero || null,
    col: u.col, row: u.row, hpPct: 1, dead: false,
  }));
  if (!units.length) return { ok: false, reason: 'empty' };
  // 器械在开跑时锁死：整轮冲锋不能中途换器械 / 换站位（章节锚点与难度口径才不会漂）
  const engine = engineChoice(state);
  st.run = {
    chapter: chapterId, stage: 1, units,
    engine: engine ? { id: engine.id, tier: engine.tier, stance: engine.stance } : null,
  };
  return { ok: true, run: st.run };
}

// 本关实际出战的兵（死亡的兵牌灰掉，不再上场）
export function gauntletRunSquads(run) {
  if (!run) return [];
  return run.units
    .filter((u) => !u.dead && u.hpPct > 0)
    .map((u) => ({
      troop: u.troop, level: u.level, hero: u.hero,
      col: u.col, row: u.row, hpPct: u.hpPct,
    }));
}

// 战斗结束后回写：report 与「存活兵牌」顺序一一对应（战斗页按同一顺序生成）
export function applyGauntletReport(run, report) {
  if (!run || !Array.isArray(report)) return;
  let i = 0;
  for (const u of run.units) {
    if (u.dead || u.hpPct <= 0) continue;
    const r = report[i++];
    if (!r) continue;
    const pct = Math.max(0, Math.min(1, Number(r.hpPct)));
    u.hpPct = Number.isFinite(pct) ? pct : 0;
    if (r.dead || u.hpPct <= 0.001) {
      u.dead = true;
      u.hpPct = 0;
    }
  }
}

// 调整阵位：只能交换两个存活兵牌的格子，不能撤下 / 换人
export function swapGauntletUnits(run, a, b) {
  if (!run || a === b) return false;
  const ua = run.units[a];
  const ub = run.units[b];
  if (!ua || !ub || ua.dead || ub.dead) return false;
  const col = ua.col;
  const row = ua.row;
  ua.col = ub.col;
  ua.row = ub.row;
  ub.col = col;
  ub.row = row;
  return true;
}

// 一章打完：发首通 / 每日奖励并清空 run
export function completeGauntletChapter(state, now = clockNow()) {
  const st = gauntletState(state);
  const run = st.run;
  if (!run) return null;
  const ch = gauntletChapter(run.chapter);
  if (!ch) return null;
  const first = !st.cleared.includes(ch.id);
  if (first) st.cleared.push(ch.id);
  const fc = gauntletFirstClear(ch);
  let coins = 0;
  const chests = [];
  let box = null;
  if (first && fc) {
    coins += fc.coins;
    box = createRecruitBox(state, fc.rarity, fc.level);
  }
  // 每日首通奖励：每天只能拿一次（与主线首通错开：主线按关发铜钱，这里按天发）
  const today = dateKey(now);
  let daily = null;
  if (st.dailyDay !== today) {
    st.dailyDay = today;
    daily = { coins: CONFIG.gauntlet.dailyCoins, chest: CONFIG.gauntlet.dailyChest };
    coins += daily.coins;
    addChest(state, daily.chest, 1);
    chests.push(daily.chest);
  }
  state.coins += coins;
  st.run = null;
  return { chapter: ch, first, coins, box, daily, chests };
}

// 失败：本次冲锋结束（可无限重来，下一次重新满血从第 1 关开始）
export function failGauntletRun(state) {
  const st = gauntletState(state);
  const run = st.run;
  st.run = null;
  return run;
}

// 章节列表视图数据（首页 / 模式页共用）
export function gauntletChapterView(state) {
  const st = gauntletState(state);
  return gauntletChapters().map((ch, i) => ({
    ...ch,
    index: i,
    unlocked: gauntletChapterUnlocked(state, ch.id),
    cleared: st.cleared.includes(ch.id),
    current: st.run ? st.run.chapter === ch.id : false,
    stage: st.run && st.run.chapter === ch.id ? st.run.stage : 0,
  }));
}

export function gauntletStageOf(state) {
  const st = gauntletState(state);
  if (!st.run) return null;
  return gauntletStageDef(st.run.chapter, st.run.stage);
}
