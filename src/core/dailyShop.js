// 每日商店：每天按日期生成固定 6 个栏位（前 4 稀有 / 后 2 史诗），每个栏位每天限购 1 次
// 同一天刷新出来的栏位完全一致（按 dateKey 做种子），跨天（北京时间 0 点）自动换新
import { CONFIG } from '../data/config.js';
import { dateKey } from './daily.js';
import { now as clockNow } from './clock.js';
import { addUnit, rosterSlots } from './levels.js';
import { troopUnlocked, capTroopLevel } from './units.js';

// 主线通关到 unlockLevel（100 关）才解锁
export function dailyShopUnlocked(state) {
  return (state.maxCleared || 0) >= CONFIG.dailyShop.unlockLevel;
}

// 字符串 → 32 位种子（同一天必定同一组栏位）
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 洗牌后取前 n 个：池子够大时不会重复兵种
function pick(pool, n, rnd) {
  if (!pool.length) return [];
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const out = [];
  while (out.length < n) out.push(arr[out.length % arr.length]);
  return out;
}

// 跨天清空已购买记录
export function ensureDailyShop(state, today = dateKey()) {
  if (!state.dailyShop || typeof state.dailyShop !== 'object') {
    state.dailyShop = { day: '', sold: [] };
  }
  if (!Array.isArray(state.dailyShop.sold)) state.dailyShop.sold = [];
  if (state.dailyShop.day !== today) {
    state.dailyShop.day = today;
    state.dailyShop.sold = [];
  }
}

// 当天 6 个栏位（带 sold 标记）
export function dailyShopOffers(state, now = clockNow()) {
  const today = dateKey(now);
  ensureDailyShop(state, today);
  const rnd = mulberry32(hashSeed(`daily-shop:${today}`));
  // 只上架已解锁的兵种：未解锁的不会出现在货架上
  const rarePool = CONFIG.troops
    .filter((t) => t.rarity === 'rare' && troopUnlocked(state, t.id)).map((t) => t.id);
  const epicPool = CONFIG.troops
    .filter((t) => t.rarity === 'epic' && troopUnlocked(state, t.id)).map((t) => t.id);
  const { rareSlots, epicSlots, rarePrice, epicPrice, level } = CONFIG.dailyShop;
  const slots = [];
  // 货架等级同样受关卡档位上限约束（稀有 ≤4 / 史诗 ≤5，250 关后放开）
  pick(rarePool, rareSlots, rnd).forEach((troop, i) => {
    slots.push({ index: i, troop, rarity: 'rare', level: capTroopLevel(state, troop, level), price: rarePrice });
  });
  pick(epicPool, epicSlots, rnd).forEach((troop, i) => {
    slots.push({
      index: rareSlots + i, troop, rarity: 'epic', level: capTroopLevel(state, troop, level), price: epicPrice,
    });
  });
  const sold = new Set(state.dailyShop.sold);
  return { day: today, slots: slots.map((s) => ({ ...s, sold: sold.has(s.index) })) };
}

// 购买某个栏位：兵营满 / 铜钱不足 / 已买过 → 拒绝（价格用每日商店自己的定价）
export function buyDailySlot(state, index, now = clockNow()) {
  if (!dailyShopUnlocked(state)) return { ok: false, reason: 'locked', price: 0 };
  const today = dateKey(now);
  ensureDailyShop(state, today);
  const offer = dailyShopOffers(state, now).slots.find((s) => s.index === index);
  if (!offer) return { ok: false, reason: 'unknown', price: 0 };
  if (offer.sold) return { ok: false, reason: 'sold', price: offer.price };
  const { unlocked } = rosterSlots(state.maxCleared);
  if (state.units.length >= unlocked) return { ok: false, reason: 'full', price: offer.price };
  if (state.coins < offer.price) return { ok: false, reason: 'poor', price: offer.price };
  state.coins -= offer.price;
  const unit = addUnit(state, offer.troop, offer.level);
  if (!unit) return { ok: false, reason: 'full', price: offer.price };
  state.dailyShop.sold.push(index);
  return { ok: true, reason: 'ok', unit, price: offer.price, offer };
}

// 距下次刷新（北京时间 0 点）还剩多少分钟
export function minutesUntilRefresh(now = clockNow()) {
  const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
  const d = new Date(now + BEIJING_OFFSET_MS);
  const passed = d.getUTCHours() * 60 + d.getUTCMinutes();
  return Math.max(0, 24 * 60 - passed);
}
