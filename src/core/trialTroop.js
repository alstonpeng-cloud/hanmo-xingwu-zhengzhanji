// 战败页广告奖励：试用兵（史诗 / 传奇各半概率），持续 5 场主线战斗
// - 不可合成、不能在闯关以外模式上阵
// - 每打完一场主线（胜 / 负都算）扣 1 回合，第 5 场结束后自动消失
// - 同一时间只保留 1 个试用兵：再次领取会替换旧的
import { CONFIG } from '../data/config.js';

export const TRIAL_ROUNDS = 5;

// 等级按主线进度分档（史诗 / 传奇各自一档）
export const TRIAL_LEVEL_TIERS = [
  { from: 1, to: 200, epic: 3, legendary: 2 },
  { from: 201, to: 400, epic: 4, legendary: 3 },
  { from: 401, to: 600, epic: 5, legendary: 4 },
  { from: 601, to: 1000, epic: 6, legendary: 5 },
  { from: 1001, to: 2600, epic: 7, legendary: 6 },
];

export function trialLevelFor(levelN, rarity) {
  const n = Math.max(1, Math.floor(Number(levelN) || 1));
  const tier = TRIAL_LEVEL_TIERS.find((t) => n <= t.to)
    || TRIAL_LEVEL_TIERS[TRIAL_LEVEL_TIERS.length - 1];
  return rarity === 'legendary' ? tier.legendary : tier.epic;
}

export function isTrialUnit(unit) {
  return !!unit && Number(unit.trialLeft) > 0;
}

export function trialUnits(state) {
  return (state.units || []).filter(isTrialUnit);
}

// 随机池：只从史诗 / 传奇里抽，各半概率
export function rollTrialTroop(levelN, rand = Math.random) {
  const rarity = rand() < 0.5 ? 'epic' : 'legendary';
  const pool = (CONFIG.troops || []).filter((t) => t.rarity === rarity).map((t) => t.id);
  const troop = pool.length ? pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))] : 'baier';
  return { troop, level: trialLevelFor(levelN, rarity), rarity, trial: true, rounds: TRIAL_ROUNDS };
}

export function removeTrialUnits(state) {
  const ids = new Set(trialUnits(state).map((u) => u.id));
  if (!ids.size) return [];
  state.units = state.units.filter((u) => !ids.has(u.id));
  state.formation = (state.formation || []).map((uid) => (ids.has(uid) ? null : uid));
  return [...ids];
}

// 非闯关模式（演武 / 英雄战）开局前：把试用兵从布阵里撤下
export function stripTrialFromFormation(state) {
  const ids = new Set(trialUnits(state).map((u) => u.id));
  if (!ids.size) return 0;
  let pulled = 0;
  state.formation = (state.formation || []).map((uid) => {
    if (!ids.has(uid)) return uid;
    pulled++;
    return null;
  });
  return pulled;
}

// 发放试用兵：先替换旧的，再占用一个兵营格（id 与普通兵同一套自增）
export function addTrialUnit(state, roll) {
  removeTrialUnits(state);
  const id = `u${state.nextUnitId++}`;
  const unit = {
    id, troop: roll.troop, level: roll.level, trialLeft: TRIAL_ROUNDS,
  };
  state.units.push(unit);
  return unit;
}

// 每场主线战斗结束调用：全体试用兵 -1 回合，归零的自动清出（含布阵）
export function tickTrialRounds(state) {
  const expired = [];
  for (const u of trialUnits(state)) {
    u.trialLeft = Math.max(0, Math.floor(Number(u.trialLeft) || 0) - 1);
    if (u.trialLeft <= 0) expired.push(u);
  }
  if (!expired.length) return [];
  const ids = new Set(expired.map((u) => u.id));
  state.units = state.units.filter((u) => !ids.has(u.id));
  state.formation = (state.formation || []).map((uid) => (ids.has(uid) ? null : uid));
  return expired;
}
