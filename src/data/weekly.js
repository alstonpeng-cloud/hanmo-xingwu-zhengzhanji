// 周常挑战（1.2.5）：纯数据与定价 —— 积分成本 / 档位名 / 首通与扫荡奖励表。
// 进度与存档逻辑在 core/weekly.js；关卡难度模型见 core/weekly.js weeklyLevelDef。
import { CONFIG } from './config.js';
import { rarityOf, troopById } from '../core/units.js';

const TIER_LABELS = ['壹', '贰', '叁', '肆', '伍'];

export function weeklyTierNames() {
  return TIER_LABELS.slice(0, CONFIG.weekly.tiers);
}

export function weeklyTierName(tier) {
  const t = Math.max(1, Math.min(CONFIG.weekly.tiers, Math.floor(Number(tier) || 1)));
  return TIER_LABELS[t - 1];
}

/* ---------- 积分定价 ----------
 * 单价模型：等级 L 的兵牌「买断价」= base[rarity] × 1.45^(L-1)。
 * 升级只补差价（升级花费 = 买断价L+1 − 买断价L），卖出全额退买断价 ——
 * 花费恒等于最终买断价，存档里不需要另记「已投入积分」。 */
export function weeklyCost(rarity, level) {
  const base = CONFIG.weekly.costBase[rarity] || CONFIG.weekly.costBase.common;
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return Math.round(base * Math.pow(CONFIG.weekly.costGrowth, lv - 1));
}

export function weeklyUpgradeCost(rarity, level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return Math.max(0, weeklyCost(rarity, lv + 1) - weeklyCost(rarity, lv));
}

export function weeklyTroopCost(troopId, level) {
  const t = troopById(troopId);
  return weeklyCost(t ? rarityOf(troopId) : 'common', level);
}

export function weeklyTroopUpgradeCost(troopId, level) {
  const t = troopById(troopId);
  return weeklyUpgradeCost(t ? rarityOf(troopId) : 'common', level);
}

/* ---------- 首通奖励 ----------
 * 小关首通：铜钱 500 × 档位；
 * 每 5 关：额外银箱；档位第 10 关 = 档位完成，叠加档位大赏。 */
export function weeklyStageCoins(tier) {
  const t = Math.max(1, Math.min(CONFIG.weekly.tiers, Math.floor(Number(tier) || 1)));
  return 500 * t;
}

export function weeklyStageChest(tier, stage) {
  if (stage % 5 !== 0) return null;
  if (stage < CONFIG.weekly.stagesPerTier) return 'silver';
  return ['rare', 'epic', 'epic', 'legendary', 'legendary'][tier - 1] || 'rare';
}

// 档位完成大赏：铜钱（前 3 档 10000 / 后 2 档 25000）+ 宝箱由上面 stage10 一并发
export function weeklyTierBonusCoins(tier) {
  return tier <= 3 ? 10000 : 25000;
}
