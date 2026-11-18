// 每日任务 / 每日签到 / 7 日登录（通关 30 关后开放）
// 纯逻辑：按本地日期切天，进度存进存档 state.daily，界面只负责展示与领取
import { CONFIG } from '../data/config.js';
import { addUnit } from './levels.js';
import { addChest } from './chests.js';
import { markTroopUnlocked, capTroopLevel } from './units.js';
import { now as clockNow } from './clock.js';

// 北京时间（UTC+8）日期 YYYY-MM-DD，跨天自动重置
// 强制用 UTC+8 不受设备本地时区影响——无论玩家手机在哪个时区，
// 每日任务 / 广告额度 / 签到都按北京时间 0 点切天
export const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
export function dateKey(now = clockNow()) {
  const d = new Date(now + BEIJING_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${d.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dailyUnlocked(state) {
  return (state?.maxCleared ?? 0) >= (CONFIG.daily.unlockLevel || 1);
}

// 跨天重置「每日」部分（任务进度、签到、已领任务）；7 日登录的累计天数不清零
export function ensureDaily(state, now = clockNow()) {
  if (!state.daily || typeof state.daily !== 'object') state.daily = {};
  const s = state.daily;
  s.day = typeof s.day === 'string' ? s.day : '';
  s.clears = Number.isFinite(s.clears) ? Math.max(0, s.clears) : 0;
  s.merges = Number.isFinite(s.merges) ? Math.max(0, s.merges) : 0;
  s.chests = Number.isFinite(s.chests) ? Math.max(0, s.chests) : 0;
  s.shares = Number.isFinite(s.shares) ? Math.max(0, s.shares) : 0;
  s.signed = s.signed === true;
  s.claimed = Array.isArray(s.claimed) ? s.claimed : [];
  s.dailyWins = Number.isFinite(s.dailyWins) ? Math.max(0, s.dailyWins) : 0;   // 每日挑战重复胜场
  s.loginDays = Number.isFinite(s.loginDays) ? Math.min(CONFIG.daily.login7.days.length, Math.max(0, s.loginDays)) : 0;
  s.loginDay = typeof s.loginDay === 'string' ? s.loginDay : '';
  const today = dateKey(now);
  if (s.day !== today) {
    s.day = today;
    s.clears = 0;
    s.merges = 0;
    s.chests = 0;
    s.shares = 0;
    s.signed = false;
    s.claimed = [];
    s.dailyWins = 0;   // 每日挑战的「前 3 胜小额奖励」每天归零
  }
  return s;
}

/* ---------- 计数（战斗胜利 / 合成 / 开箱时调用） ---------- */
export function noteClear(state, now = clockNow()) {
  if (!dailyUnlocked(state)) return;
  ensureDaily(state, now).clears += 1;
}

export function noteMerge(state, n = 1, now = clockNow()) {
  if (!dailyUnlocked(state)) return;
  ensureDaily(state, now).merges += Math.max(0, n);
}

export function noteChestOpened(state, n = 1, now = clockNow()) {
  if (!dailyUnlocked(state)) return;
  ensureDaily(state, now).chests += Math.max(0, n);
}

/* ---------- 任务进度 / 领取 ---------- */
export function taskProgress(state, taskId, now = clockNow()) {
  const s = ensureDaily(state, now);
  if (taskId === 'sign') return s.signed ? 1 : 0;
  if (taskId === 'clear') return s.clears;
  if (taskId === 'merge') return s.merges;
  if (taskId === 'open') return s.chests;
  return 0;
}

export function taskState(state, task, now = clockNow()) {
  const s = ensureDaily(state, now);
  const progress = Math.min(task.need, taskProgress(state, task.id, now));
  const done = progress >= task.need;
  const claimed = s.claimed.includes(task.id);
  return { progress, done, claimed, claimable: done && !claimed };
}

// 领取每日任务奖励：通关 10 关 / 合成 3 个 / 开 3 个宝箱 → 稀有宝箱；签到任务由 signIn 完成
export function claimTask(state, taskId, now = clockNow()) {
  if (!dailyUnlocked(state)) return { ok: false, reason: 'locked' };
  const s = ensureDaily(state, now);
  const task = (CONFIG.daily.tasks || []).find((t) => t.id === taskId);
  if (!task) return { ok: false, reason: 'unknown' };
  if (s.claimed.includes(taskId)) return { ok: false, reason: 'claimed' };
  if (taskProgress(state, taskId, now) < task.need) return { ok: false, reason: 'progress' };
  if (task.coins) state.coins += task.coins;
  if (task.chest) addChest(state, task.chest, 1);
  s.claimed.push(taskId);
  return { ok: true, reason: 'ok', task, chest: task.chest || null, coins: task.coins || 0 };
}

/* ---------- 每日签到（送 1 个稀有宝箱，同时完成签到任务） ---------- */
export function signIn(state, now = clockNow()) {
  if (!dailyUnlocked(state)) return { ok: false, reason: 'locked' };
  const s = ensureDaily(state, now);
  if (s.signed) return { ok: false, reason: 'signed' };
  s.signed = true;
  const chest = CONFIG.daily.signInChest || 'rare';
  addChest(state, chest, 1);
  // 签到额外送 1 张英雄招募券——只有已通关至少 1 场英雄战后才发放，
  // 避免「英雄战一场没打，却已经囤了一堆招募券」。
  const ticketUnlocked = Math.max(0, Math.floor(state.heroBattleCleared || 0)) > 0;
  if (ticketUnlocked) {
    state.heroTickets = Math.max(0, Math.floor(state.heroTickets || 0)) + 1;
  }
  // 签到本身就算完成「每日签到」任务，不再重复领一份奖励
  if (!s.claimed.includes('sign')) s.claimed.push('sign');
  return { ok: true, reason: 'ok', chest, heroTickets: ticketUnlocked ? 1 : 0 };
}

/* ---------- 7 日登录（每天可领 1 天，50 关解锁） ---------- */
export function login7Days() {
  return (CONFIG.daily.login7 && CONFIG.daily.login7.days) || [];
}

export function nextLoginDay(state, now = clockNow()) {
  const s = ensureDaily(state, now);
  if (s.loginDays >= login7Days().length) return null;
  return { index: s.loginDays, reward: login7Days()[s.loginDays], claimedToday: s.loginDay === s.day };
}

export function canClaimLogin(state, now = clockNow()) {
  if (!dailyUnlocked(state)) return false;
  const next = nextLoginDay(state, now);
  return !!next && !next.claimedToday;
}

// 领取当天那一档：chest 直接进仓库；unit 需要兵营有空位（满员则不消耗、不推进天数）；
// coins 直接进铜钱；hero 首次获得，已拥有则折算铜钱（防重复领取由 loginDay/loginDays 保证）
export function claimLoginDay(state, now = clockNow()) {
  if (!dailyUnlocked(state)) return { ok: false, reason: 'locked' };
  const next = nextLoginDay(state, now);
  if (!next) return { ok: false, reason: 'done' };
  if (next.claimedToday) return { ok: false, reason: 'today' };
  let unit = null;
  let duplicate = false;
  let coins = 0;
  let unlocked = false;
  const reward = next.reward;
  if (reward.kind === 'unit') {
    // 签到第 6 天的「6 级白马义从」是固定奖励：先写入解锁标记，再发兵。
    // 这样它不会绕过解锁机制（存档里留下已解锁记录，后续宝箱/商店才可能产出）
    unlocked = markTroopUnlocked(state, reward.troop);
    // 与宝箱/商店/广告/合成同一条关卡档位上限：奖励等级超出时夹到上限发放
    unit = addUnit(state, reward.troop, capTroopLevel(state, reward.troop, reward.level));
    if (!unit) {
      // 兵营满：回滚刚写入的解锁标记，保持「没领到就不改变存档」
      if (unlocked && Array.isArray(state.troopUnlocks)) {
        state.troopUnlocks = state.troopUnlocks.filter((id) => id !== reward.troop);
      }
      return { ok: false, reason: 'full', reward: next.reward, unlocked: false };
    }
  } else if (reward.kind === 'chest') {
    addChest(state, reward.chest, reward.n || 1);
  } else if (reward.kind === 'coins') {
    coins = Math.max(0, Math.floor(reward.coins || 0));
    state.coins += coins;
  } else if (reward.kind === 'hero') {
    if (!state.heroes || typeof state.heroes !== 'object') state.heroes = {};
    const lv = Math.max(0, Math.floor(state.heroes[reward.hero] || 0));
    if (lv > 0) {
      // 已拥有：折算成铜钱，避免「领了等于没领」
      duplicate = true;
      coins = Math.max(0, Math.floor(reward.dupCoins || CONFIG.daily.login7.dupHeroCoins || 30000));
      state.coins += coins;
    } else {
      state.heroes[reward.hero] = 1;
    }
  }
  const s = ensureDaily(state, now);
  s.loginDays += 1;
  s.loginDay = s.day;
  return { ok: true, reason: 'ok', reward, index: next.index, unit, duplicate, coins, unlocked };
}

// ============ 周常（1.2.5：每周积分选兵，周 key 变化整域重建） ============
// 周 key = 北京时间、周一起算的「年-W周」（如 "2026-W47"）。
// 和 dateKey 共用同一套可信时钟（clock.js），改系统时间刷不了周奖励。
export function weekKey(now = clockNow()) {
  const t = new Date(now + BEIJING_OFFSET_MS);
  const day = (t.getUTCDay() + 6) % 7;                        // 周一 = 0
  const mondayMs = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - day * 864e5;
  const m = new Date(mondayMs);
  const yearStart = Date.UTC(m.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((mondayMs - yearStart) / 864e5 + 1) / 7);
  return `${m.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
