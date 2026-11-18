// 挂机收益（离线 / 在线累积铜钱）：通关越远，每小时产得越多，最多累积 capHours 小时
// 用可信时钟 now() 计算（会话内单调 + 启动时服务器校准），防止改系统时间刷奖励
import { CONFIG } from '../data/config.js';
import { now as clockNow } from './clock.js';

// 本机时间回拨容忍：小于这个偏差视为正常抖动
export const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;

export function idleRatePerHour(maxCleared = 0) {
  const c = CONFIG.economy.idle;
  return c.basePerHour + c.perLevelPerHour * Math.max(0, maxCleared);
}

export function idleCapHours() {
  return CONFIG.economy.idle.capHours;
}

export function idleCapMs() {
  return idleCapHours() * 3600 * 1000;
}

// 首次进入游戏（或旧档没有 idleAt）时以当前时间为起点：不会凭空给钱；
// 运行中检测到时间回拨（计时点在明显未来）同样拉回 now：不白给收益，也不会卡死
export function ensureIdleAt(state, nowMs = clockNow()) {
  if (!Number.isFinite(state.idleAt)) state.idleAt = nowMs;
  else if (state.idleAt > nowMs + CLOCK_ROLLBACK_TOLERANCE_MS) state.idleAt = nowMs;
  return state.idleAt;
}

// 已经累计了多久（毫秒，含封顶）
export function idleElapsedMs(state, nowMs = clockNow()) {
  const last = ensureIdleAt(state, nowMs);
  return Math.min(idleCapMs(), Math.max(0, nowMs - last));
}

// 当前可领取的铜钱（不写存档，界面每帧都可以调）
export function idleAccrued(state, nowMs = clockNow()) {
  const coins = idleRatePerHour(state.maxCleared) * (idleElapsedMs(state, nowMs) / 3600 / 1000);
  return Math.max(0, Math.floor(coins));
}

// 领取：把可领铜钱加进存档，并把计时点推到 now（封顶溢出不再保留）
export function claimIdle(state, nowMs = clockNow()) {
  const amount = idleAccrued(state, nowMs);
  if (amount <= 0) return { ok: false, reason: 'empty', amount: 0 };
  state.coins += amount;
  state.idleAt = nowMs;
  return { ok: true, reason: 'ok', amount };
}
