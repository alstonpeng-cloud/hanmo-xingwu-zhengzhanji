// 成就系统（1.2.5）：进度读数 / 可领取判定 / 领奖（铜钱 + 宝箱）。
// 已领档位只存键 "成就id:档位下标"（state.achievements.claimed），进度实时算。
import { ACHIEVEMENTS, achievementById } from '../data/achievements.js';
import { addChest } from './chests.js';

const CLAIMED_CAP = 500;   // 与 save sanitize 白名单上限一致

export function achievementKey(id, tierIndex) {
  return `${id}:${tierIndex}`;
}

export function achievementProgress(a, state) {
  try {
    const v = Number(a && a.progress ? a.progress(state) : 0);
    return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  } catch (e) {
    return 0;
  }
}

function claimedList(state) {
  const list = state.achievements && Array.isArray(state.achievements.claimed)
    ? state.achievements.claimed : [];
  return list;
}

export function achievementClaimed(state, id, tierIndex) {
  return claimedList(state).includes(achievementKey(id, tierIndex));
}

// 单条成就的逐档状态：n / 是否达成 / 是否已领 / 是否可领（达成且未领）
export function achievementStates(a, state) {
  const p = achievementProgress(a, state);
  return a.tiers.map((t, i) => {
    const claimed = achievementClaimed(state, a.id, i);
    const done = p >= t.n;
    return { index: i, n: t.n, coins: t.coins, chest: t.chest || null, done, claimed, claimable: done && !claimed };
  });
}

// 界面行用：这条成就「当前要冲的档」——第一个未领档（全领完返回 null）
export function achievementNextTier(a, state) {
  const p = achievementProgress(a, state);
  const states = achievementStates(a, state);
  const idx = states.findIndex((s) => !s.claimed);
  if (idx < 0) return null;
  const s = states[idx];
  return { ...s, progress: p, ratio: s.n > 0 ? Math.min(1, p / s.n) : 1 };
}

export function claimableKeys(state) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    for (const s of achievementStates(a, state)) {
      if (s.claimable) out.push(achievementKey(a.id, s.index));
    }
  }
  return out;
}

export function claimableCount(state) {
  return claimableKeys(state).length;
}

// 领取一档：校验「达成 + 未领」，发放铜钱与宝箱，登记键。
// 返回 { ok, reason: 'ok'|'unknown'|'notDone'|'claimed'|'full', coins, chest }
export function claimAchievement(state, id, tierIndex) {
  const a = achievementById(id);
  if (!a) return { ok: false, reason: 'unknown' };
  const i = Math.floor(Number(tierIndex));
  const tier = a.tiers[i];
  if (!tier) return { ok: false, reason: 'unknown' };
  if (achievementClaimed(state, id, i)) return { ok: false, reason: 'claimed' };
  if (achievementProgress(a, state) < tier.n) return { ok: false, reason: 'notDone' };
  if (!state.achievements || !Array.isArray(state.achievements.claimed)) {
    state.achievements = { claimed: [] };
  }
  if (state.achievements.claimed.length >= CLAIMED_CAP) return { ok: false, reason: 'full' };
  state.achievements.claimed.push(achievementKey(id, i));
  state.coins = (Number(state.coins) || 0) + tier.coins;
  if (tier.chest) addChest(state, tier.chest, 1);
  return { ok: true, reason: 'ok', coins: tier.coins, chest: tier.chest || null };
}
