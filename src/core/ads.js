// 广告奖励：当前没有真实广告，点击即发奖；后续接入激励视频时只替换 UI 的「播放」步骤
// 三个独立计数器：商店小木箱 / 商店银箱 / 失败页铜钱，各自每日独立限额，跨天统一重置
import { CONFIG } from '../data/config.js';
import { dateKey } from './daily.js';
import { now as clockNow } from './clock.js';
import { addChest } from './chests.js';
import { rosterSlots } from './levels.js';
import {
  rollTrialTroop, addTrialUnit, trialUnits, TRIAL_ROUNDS,
} from './trialTroop.js';

// 三个通道的 limitKey → 存档字段 + 上限
const CHANNEL_MAP = {
  shopWood: { countKey: 'adWoodCount', limitKey: 'shopWoodLimit' },
  shopSilver: { countKey: 'adSilverCount', limitKey: 'shopSilverLimit' },
  coin:     { countKey: 'adCoinCount',  limitKey: 'coinLimit' },
  defeatTroop: { countKey: 'adTroopCount', limitKey: 'troopLimit' },
};

// 跨天统一重置（三个通道共用一个 adDay）
export function ensureAds(state, now = clockNow()) {
  if (!state || typeof state !== 'object') {
    return {
      day: dateKey(now),
      shopWood: CONFIG.ads.shopWoodLimit,
      shopSilver: CONFIG.ads.shopSilverLimit,
      coin: CONFIG.ads.coinLimit,
      defeatTroop: CONFIG.ads.troopLimit,
    };
  }
  const today = dateKey(now);
  if (typeof state.adDay !== 'string' || state.adDay !== today) {
    state.adDay = today;
    state.adWoodCount = 0;
    state.adSilverCount = 0;
    state.adCoinCount = 0;
    state.adTroopCount = 0;
  }
  // 清洗三个计数
  for (const key of Object.keys(CHANNEL_MAP)) {
    const { countKey, limitKey } = CHANNEL_MAP[key];
    const limit = CONFIG.ads[limitKey];
    if (!Number.isFinite(state[countKey])) state[countKey] = 0;
    state[countKey] = Math.max(0, Math.min(limit, Math.floor(state[countKey])));
  }
}

// 查询某个通道还剩多少次
export function adsLeft(state, channel, now = clockNow()) {
  ensureAds(state, now);
  const map = CHANNEL_MAP[channel];
  if (!map) return 0;
  return Math.max(0, CONFIG.ads[map.limitKey] - state[map.countKey]);
}

// 为 UI 方便，把商店两个通道的剩余额度一起返回
export function shopAdsState(state, now = clockNow()) {
  ensureAds(state, now);
  return {
    woodLeft: adsLeft(state, 'shopWood'),
    silverLeft: adsLeft(state, 'shopSilver'),
    coinLeft: adsLeft(state, 'coin'),
    troopLeft: adsLeft(state, 'defeatTroop'),
  };
}

// 失败页铜钱奖励（200关内2000 / 201关后4000）
export function adCoinReward(levelN) {
  return (levelN || 0) > CONFIG.ads.highAfterLevel ? CONFIG.ads.coinHigh : CONFIG.ads.coinLow;
}

// 内部：消耗一次某个通道
function consume(state, channel, now) {
  ensureAds(state, now);
  const map = CHANNEL_MAP[channel];
  if (!map) return false;
  const limit = CONFIG.ads[map.limitKey];
  if (state[map.countKey] >= limit) return false;
  state[map.countKey] += 1;
  return true;
}

// 失败页：看广告换铜钱
export function claimAdCoins(state, levelN, now = clockNow()) {
  const amount = adCoinReward(levelN);
  if (!consume(state, 'coin', now)) return { ok: false, reason: 'limit', amount: 0, left: 0 };
  state.coins += amount;
  return { ok: true, amount, left: adsLeft(state, 'coin', now) };
}

// 商店：看广告换宝箱（wood / silver 两个独立通道，各每天 5 / 2 次）
// offerId: CONFIG.ads.shopOffers 里的 id
export function claimAdChest(state, offerId, now = clockNow()) {
  const offer = (CONFIG.ads.shopOffers || []).find((o) => o.id === offerId);
  if (!offer) return { ok: false, reason: 'offer', left: 0 };
  const channel = offer.limitKey; // 'shopWood' or 'shopSilver'
  if (!consume(state, channel, now)) return { ok: false, reason: 'limit', left: 0, offer };
  addChest(state, offer.chest, offer.count);
  return { ok: true, offer, left: adsLeft(state, channel, now) };
}

// 失败页广告：试用一个随机兵种（史诗 / 传奇各半），持续 5 场主线
export function defeatTroopTier(levelN) {
  const n = Math.max(0, Math.floor(levelN || 0));
  const tiers = CONFIG.ads.defeatTroopTiers || [];
  return tiers.find((t) => n <= t.maxLevel) || tiers[tiers.length - 1] || { commonLevel: 1 };
}

export function rollDefeatTroop(state, levelN, rand = Math.random) {
  return rollTrialTroop(levelN, rand);
}

// 发放已经展示给玩家的那一份（避免「按钮显示骑兵、实际给弓兵」）
export function claimDefeatTroop(state, reward, now = clockNow()) {
  if (!reward || !reward.troop) return { ok: false, reason: 'reward', left: 0 };
  const { unlocked } = rosterSlots(state.maxCleared);
  // 试用兵会替换旧的：容量按「去掉现有试用兵」计算
  const used = state.units.length - trialUnits(state).length;
  if (used >= unlocked) return { ok: false, reason: 'full', left: adsLeft(state, 'defeatTroop', now) };
  if (!consume(state, 'defeatTroop', now)) {
    return { ok: false, reason: 'limit', left: 0 };
  }
  const unit = addTrialUnit(state, { troop: reward.troop, level: reward.level });
  return {
    ok: true, unit, troop: reward.troop, level: reward.level,
    rarity: reward.rarity, trial: true, rounds: TRIAL_ROUNDS,
    left: adsLeft(state, 'defeatTroop', now),
  };
}

export function claimAdTroop(state, levelN, rand = Math.random, now = clockNow()) {
  const reward = rollDefeatTroop(state, levelN, rand);
  return claimDefeatTroop(state, reward, now);
}
