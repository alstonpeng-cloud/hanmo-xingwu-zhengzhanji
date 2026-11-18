// 成就系统（1.2.5）：条目定义 + 档位阈值 + 进度读数。
// 进度全部读 state 实时计算，不落档；已领奖的档位键存 state.achievements.claimed（"id:档位下标"）。
import { CONFIG } from './config.js';
import { dailyClearedCount } from './dailyChallenge.js';

export const ACHIEVEMENT_CATS = [
  { id: 'battle', name: '征 战' },
  { id: 'challenge', name: '挑 战' },
  { id: 'collection', name: '图 鉴' },
  { id: 'growth', name: '养 成' },
  { id: 'economy', name: '经 济' },
];

const CHEST_NAMES = {
  wood: '小木箱', silver: '银箱', gold: '金箱', rare: '稀有箱',
  epic: '史诗箱', legendary: '传奇箱',
};

export function achievementChestName(id) {
  return CHEST_NAMES[id] || id || '';
}

export function achievementRewardText(tier) {
  const parts = [`铜钱 ${tier.coins}`];
  if (tier.chest) parts.push(achievementChestName(tier.chest));
  return parts.join(' · ');
}

const nUnitsAtLv = (st, lv) => (Array.isArray(st.units) ? st.units.filter((u) => Number(u.level) >= lv).length : 0);
const ownedHeroes = (st) => Object.values(st.heroes || {}).filter((v) => Number(v) > 0).length;
const maxHeroLevel = (st) => Math.max(0, ...Object.values(st.heroes || {}).map((v) => Number(v) || 0));
const bookSum = (st) => (Number(st.books?.atk) || 0) + (Number(st.books?.hp) || 0) + (Number(st.books?.def) || 0);
const maxEngineTier = (st) => Math.max(0, ...Object.values(st.siege?.tiers || {}).map((v) => Number(v) || 0));

/* ---------- 首批成就（16 条 × 2~3 档） ----------
 * tiers 的 n 必须严格递增；progress 返回「累计值」，与各档 n 直接比较。 */
export const ACHIEVEMENTS = [
  /* 征战 */
  {
    id: 'main_progress', cat: 'battle', name: '问鼎中原', desc: '主线通关关卡',
    tiers: [
      { n: 10, coins: 400, chest: 'wood' },
      { n: 50, coins: 1500, chest: 'silver' },
      { n: 150, coins: 5000, chest: 'gold' },
    ],
    progress: (st) => Number(st.maxCleared) || 0,
  },
  {
    id: 'total_wins', cat: 'battle', name: '百战之师', desc: '累计战斗胜利',
    tiers: [
      { n: 50, coins: 300 },
      { n: 300, coins: 1200, chest: 'wood' },
      { n: 1000, coins: 4000, chest: 'silver' },
    ],
    progress: (st) => Number(st.stats?.wins) || 0,
  },
  {
    id: 'total_battles', cat: 'battle', name: '沙场老将', desc: '累计出战场次',
    tiers: [
      { n: 100, coins: 200 },
      { n: 500, coins: 800 },
      { n: 2000, coins: 3000, chest: 'wood' },
    ],
    progress: (st) => Number(st.stats?.battles) || 0,
  },

  /* 挑战 */
  {
    id: 'trial_progress', cat: 'challenge', name: '演武称雄', desc: '演武通关关卡',
    tiers: [
      { n: 10, coins: 400 },
      { n: 50, coins: 1500, chest: 'silver' },
      { n: 150, coins: 5000, chest: 'gold' },
    ],
    progress: (st) => Number(st.trialCleared) || 0,
  },
  {
    id: 'hero_battle_progress', cat: 'challenge', name: '斩将夺旗', desc: '英雄战通关关卡',
    tiers: [
      { n: 5, coins: 400 },
      { n: 30, coins: 1500, chest: 'silver' },
      { n: 80, coins: 5000, chest: 'gold' },
    ],
    progress: (st) => Number(st.heroBattleCleared) || 0,
  },
  {
    id: 'gauntlet_chapters', cat: 'challenge', name: '过关斩将', desc: '斩将（过 5 关斩 6 将）通关章节数',
    tiers: [
      { n: 1, coins: 500, chest: 'wood' },
      { n: 4, coins: 2000, chest: 'gold' },
      { n: 8, coins: 6000, chest: 'rare' },
    ],
    progress: (st) => (Array.isArray(st.gauntlet?.cleared) ? st.gauntlet.cleared.length : 0),
  },
  {
    id: 'daily_clear', cat: 'challenge', name: '每日砥砺', desc: '每日挑战首通关卡',
    tiers: [
      { n: 5, coins: 500 },
      { n: 15, coins: 2000, chest: 'silver' },
      { n: 30, coins: 6000, chest: 'rare' },
    ],
    progress: (st) => dailyClearedCount(st),
  },
  {
    id: 'weekly_clear', cat: 'challenge', name: '周常征伐', desc: '周常挑战累计首通小关',
    tiers: [
      { n: 10, coins: 500 },
      { n: 30, coins: 2000, chest: 'silver' },
      { n: 50, coins: 6000, chest: 'epic' },
    ],
    progress: (st) => Number(st.counters?.weeklyClears) || 0,
  },
  {
    id: 'sweep_count', cat: 'challenge', name: '兵贵神速', desc: '累计扫荡次数',
    tiers: [
      { n: 10, coins: 200 },
      { n: 50, coins: 800 },
      { n: 150, coins: 3000, chest: 'wood' },
    ],
    progress: (st) => Number(st.counters?.sweeps) || 0,
  },

  /* 图鉴 */
  {
    id: 'troop_collect', cat: 'collection', name: '兵种图鉴', desc: '解锁兵种数',
    tiers: [
      { n: 6, coins: 400, chest: 'wood' },
      { n: 10, coins: 1500, chest: 'silver' },
      { n: CONFIG.troops.length, coins: 5000, chest: 'gold' },
    ],
    progress: (st) => (Array.isArray(st.troopUnlocks) ? st.troopUnlocks.length : 0),
  },
  {
    id: 'hero_collect', cat: 'collection', name: '英雄集结', desc: '拥有的英雄数',
    tiers: [
      { n: 1, coins: 500, chest: 'wood' },
      { n: 4, coins: 2000, chest: 'silver' },
      { n: 8, coins: 6000, chest: 'gold' },
    ],
    progress: ownedHeroes,
  },
  {
    id: 'max_level_unit', cat: 'collection', name: '登峰造极', desc: `培养出满级（Lv${CONFIG.merge.maxLevel}）兵牌`,
    tiers: [
      { n: 1, coins: 400 },
      { n: 5, coins: 1500, chest: 'silver' },
      { n: 12, coins: 5000, chest: 'gold' },
    ],
    progress: (st) => nUnitsAtLv(st, CONFIG.merge.maxLevel),
  },

  /* 养成 */
  {
    id: 'book_study', cat: 'growth', name: '熟读兵书', desc: '兵书三卷累计等级',
    tiers: [
      { n: 5, coins: 500 },
      { n: 15, coins: 2000, chest: 'silver' },
      { n: 30, coins: 6000, chest: 'epic' },
    ],
    progress: bookSum,
  },
  {
    id: 'engine_upgrade', cat: 'growth', name: '器械淬炼', desc: '攻城器械最高档位',
    tiers: [
      { n: 3, coins: 400 },
      { n: 6, coins: 1500, chest: 'silver' },
      { n: 10, coins: 5000, chest: 'rare' },
    ],
    progress: maxEngineTier,
  },
  {
    id: 'hero_level', cat: 'growth', name: '猛将如云', desc: '英雄最高等级',
    tiers: [
      { n: 10, coins: 400 },
      { n: 20, coins: 1500, chest: 'silver' },
      { n: 30, coins: 5000, chest: 'gold' },
    ],
    progress: maxHeroLevel,
  },

  /* 经济 */
  {
    id: 'chest_open', cat: 'economy', name: '开箱达人', desc: '累计开启宝箱',
    tiers: [
      { n: 20, coins: 300, chest: 'wood' },
      { n: 100, coins: 1200, chest: 'silver' },
      { n: 300, coins: 4000, chest: 'gold' },
    ],
    progress: (st) => Number(st.counters?.chestsOpened) || 0,
  },
];

export function achievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}

export function achievementsOfCat(cat) {
  return cat ? ACHIEVEMENTS.filter((a) => a.cat === cat) : ACHIEVEMENTS.slice();
}
