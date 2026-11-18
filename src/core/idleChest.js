// 首页挂机宝箱：每天 8 个阶梯、链式计时、按真实时间戳离线结算
// 规则（全部来自 CONFIG.idleChests）：
//   - 领走当前这个，下一个才开始计时；没领就一直停在待领，不后台累积
//   - 每天北京时间 0 点重置回第 1 个；未领的跨天作废
//   - 品质按当前最高通关关卡生成；已生成的箱子保持原品质，下一个起升级
import { CONFIG } from '../data/config.js';
import { addChest } from './chests.js';
import { dateKey, BEIJING_OFFSET_MS } from './daily.js';
import { now as clockNow } from './clock.js';

const DAY_MS = 86400000;

export function idleChestStepsMin() {
  return [...(CONFIG.idleChests.stepsMin || [])];
}

export function idleChestDailyLimit() {
  return Math.max(1, Math.floor(CONFIG.idleChests.dailyLimit || 8));
}

// 第 index 个（0 起）箱子需要计时多久（毫秒）
export function idleChestStepMs(index) {
  const steps = CONFIG.idleChests.stepsMin || [];
  const i = Math.max(0, Math.min(steps.length - 1, Math.floor(Number(index) || 0)));
  return Math.max(1, (Number(steps[i]) || 1) * 60000);
}

// 当前关卡对应的箱子品质：<200 小木箱 / ≥200 银箱 / ≥600 金箱
export function idleChestQuality(maxCleared = 0) {
  const cleared = Math.max(0, Math.floor(Number(maxCleared) || 0));
  const tiers = CONFIG.idleChests.qualityByLevel || [];
  let chest = 'wood';
  let best = -1;
  for (const tier of tiers) {
    const min = Math.max(0, Math.floor(Number(tier.minLevel) || 0));
    if (cleared >= min && min > best) {
      best = min;
      chest = tier.chest;
    }
  }
  return CONFIG.chests.types[chest] ? chest : 'wood';
}

// 北京时间当天 0 点（毫秒时间戳）
export function idleChestDayStart(now = clockNow()) {
  const shifted = now + BEIJING_OFFSET_MS;
  return shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS) - BEIJING_OFFSET_MS;
}

// 新的一天：第 1 个箱子从当天 0 点开始计时（0:01 就可领）
export function emptyIdleChest(now = clockNow(), maxCleared = 0, { fromDayStart = true } = {}) {
  const anchor = fromDayStart ? idleChestDayStart(now) : now;
  return {
    day: dateKey(now),
    claimed: 0,
    chest: idleChestQuality(maxCleared),
    anchor,
    readyAt: anchor + idleChestStepMs(0),
  };
}

function clampClaimed(n) {
  const limit = idleChestDailyLimit();
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(limit, v));
}

// 读档清洗：非法数据回落到「今天第 1 个」，老档（没有字段）也从第 1 个开始
export function sanitizeIdleChest(raw, { maxCleared = 0, legacy = false, now = clockNow() } = {}) {
  if (legacy || !raw || typeof raw !== 'object') {
    return emptyIdleChest(now, maxCleared, { fromDayStart: false });
  }
  const day = typeof raw.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.day)
    ? raw.day
    : dateKey(now);
  const claimed = clampClaimed(raw.claimed);
  const chest = CONFIG.chests.types[raw.chest] ? raw.chest : idleChestQuality(maxCleared);
  const anchor = Number.isFinite(raw.anchor) ? Math.max(0, Math.floor(raw.anchor)) : now;
  const readyAt = Number.isFinite(raw.readyAt) ? Math.max(0, Math.floor(raw.readyAt)) : now;
  return { day, claimed, chest, anchor, readyAt };
}

// 到点 / 跨天 / 时间异常都在这里统一修正（可重复调用，纯状态维护）
export function ensureIdleChest(state, now = clockNow()) {
  if (!state.idleChest || typeof state.idleChest !== 'object') {
    state.idleChest = emptyIdleChest(now, state.maxCleared, { fromDayStart: false });
    return state.idleChest;
  }
  const s = state.idleChest;
  const limit = idleChestDailyLimit();
  s.claimed = clampClaimed(s.claimed);
  if (!s.day || typeof s.day !== 'string') s.day = dateKey(now);
  if (!CONFIG.chests.types[s.chest]) s.chest = idleChestQuality(state.maxCleared);
  if (!Number.isFinite(s.anchor)) s.anchor = now;
  if (!Number.isFinite(s.readyAt)) s.readyAt = now;

  // 跨天判断要放在「已领满」之前，否则领满 8 个后第二天无法重置
  const today = dateKey(now);
  if (s.day !== today) {
    if (today > s.day) {
      // 正常跨天（只向前）：重置回第 1 个，计时锚点取当天 0 点
      const next = emptyIdleChest(now, state.maxCleared);
      Object.assign(s, next);
      return s;
    }
    // 系统时间回拨到更早日期：不回滚已领进度，也不让倒计时卡死；
    // 把可领时间压到「最多再等当前这一档」
    s.readyAt = Math.min(s.readyAt, now + idleChestStepMs(s.claimed));
    return s;
  }

  if (s.claimed >= limit) {
    s.readyAt = Number.MAX_SAFE_INTEGER;
    return s;
  }

  // 同一天内时间回拨：锚点拉回 now，可领时间不倒退（不白送、也不会永久卡住）
  if (now < s.anchor) {
    s.anchor = now;
    s.readyAt = Math.min(s.readyAt, now + idleChestStepMs(s.claimed));
  }
  return s;
}

// 界面读状态：不写存档，每帧都可以调
export function idleChestState(state, now = clockNow()) {
  const s = ensureIdleChest(state, now);
  const total = idleChestDailyLimit();
  const done = s.claimed >= total;
  const index = done ? total - 1 : s.claimed;
  const remainMs = done ? 0 : Math.max(0, s.readyAt - now);
  return {
    claimed: s.claimed,
    total,
    index,
    chest: s.chest,
    done,
    ready: !done && remainMs <= 0,
    remainMs,
    stepMs: idleChestStepMs(index),
  };
}

// 倒计时文案：<1 小时用 mm:ss，≥1 小时用 h:mm:ss
export function formatIdleCountdown(ms) {
  const total = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// 领取：入宝箱仓库（和普通宝箱一起开 / 一键开启），并开始下一个的计时
export function claimIdleChest(state, now = clockNow()) {
  const s = ensureIdleChest(state, now);
  const total = idleChestDailyLimit();
  if (s.claimed >= total) return { ok: false, reason: 'done', claimed: s.claimed, total };
  if (now < s.readyAt) {
    return { ok: false, reason: 'wait', remainMs: s.readyAt - now, claimed: s.claimed, total };
  }
  const chest = s.chest;
  addChest(state, chest, 1);
  s.claimed += 1;
  if (s.claimed >= total) {
    s.readyAt = Number.MAX_SAFE_INTEGER;
    return { ok: true, reason: 'ok', chest, index: total - 1, claimed: s.claimed, total, done: true };
  }
  // 下一个箱子在此刻「生成」：品质按当前最高关卡，之后跨档也不改这一个
  s.chest = idleChestQuality(state.maxCleared);
  s.anchor = now;
  s.readyAt = now + idleChestStepMs(s.claimed);
  return { ok: true, reason: 'ok', chest, index: s.claimed - 1, claimed: s.claimed, total, done: false };
}
