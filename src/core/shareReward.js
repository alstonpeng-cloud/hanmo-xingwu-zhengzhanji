// 分享得宝箱：结算页把小游戏分享到微信群，成功后发 1 个宝箱，每天限 2 次
// 奖励分档：进度未到 200 关送黄金箱，200 关起送史诗宝箱
// 纯逻辑：跨天按北京时间切天（复用 daily.js 的 ensureDaily），界面只负责调起分享
import { ensureDaily } from './daily.js';
import { addChest } from './chests.js';
import { now as clockNow } from './clock.js';

export const SHARE_DAILY_LIMIT = 2;

// 分享奖励档位
export function shareRewardFor(maxCleared = 0) {
  return (Number(maxCleared) || 0) >= 200 ? 'epic' : 'gold';
}

// 今天还剩几次分享奖励额度
export function sharesLeft(state, now = clockNow()) {
  const s = ensureDaily(state, now);
  return Math.max(0, SHARE_DAILY_LIMIT - (Number.isFinite(s.shares) ? s.shares : 0));
}

// 分享成功回调里调用：额度不足不发放（不改存档）
// 返回 { ok, reason: 'ok'|'limit', chest, left }
export function claimShareReward(state, now = clockNow()) {
  const chest = shareRewardFor(state?.maxCleared || 0);
  const s = ensureDaily(state, now);
  const used = Number.isFinite(s.shares) ? Math.max(0, s.shares) : 0;
  if (used >= SHARE_DAILY_LIMIT) return { ok: false, reason: 'limit', chest, left: 0 };
  s.shares = used + 1;
  addChest(state, chest, 1);
  return { ok: true, reason: 'ok', chest, left: SHARE_DAILY_LIMIT - s.shares };
}
