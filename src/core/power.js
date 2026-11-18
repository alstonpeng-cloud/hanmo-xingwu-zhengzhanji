// 兵种战斗力评定：把「同等级的一支小队」折算成一个可比较的战力值
// 战力 = 小队总血量 + 每秒输出 × 3 + 防御换算 × 2（含战法常驻倍率 / 连射平均节奏 / 毒伤）
// 用途：布阵页「我方 vs 敌方」战力对比、按战力排序、开战顶栏总战力、胜利页本局最佳
import { CONFIG } from '../data/config.js';
import { statsFor } from './units.js';
import { squadSoldierCount } from './arena.js';
import { combatTraits } from '../data/traits.js';

// 远程连射：按「一轮总时长」把连发折算成等效攻击（和 troop-table / duel 的口径一致）
function volleyFactor(tr, troopId, level = 1) {
  if (!tr || !tr.volley) return 1;
  const v = tr.volley;
  // 连射的 burst 可能是固定值，也可能按等级跳点（元戎：Lv1~3=2 / Lv4~7=3 / Lv8+=4）
  let burst = v.burst;
  if (burst == null) {
    burst = 1;
    for (const [at, val] of v.tier || []) if (level >= at) burst = val;
  }
  const baseInterval = CONFIG.combat.intervals[troopId] * ((tr && tr.intervalMult) || 1);
  const shotsPerSec = burst / (burst * v.shotInterval + v.reload);
  return shotsPerSec * baseInterval * (v.dmgMult || 1);
}

// 一支小队（单位）在指定等级的战斗力
export function troopPower(troopId, level = 1) {
  const s = statsFor(troopId, level);
  // 未知兵种兜底：statsFor 会返回 0/0/0，这里显式返回 0，避免 NaN 被 formatPower 当成 0 后
  // 又和「真的 0」混在一起、难以排查。
  if (!s.hp && !s.atk && !s.def) return 0;
  const tr = combatTraits(troopId, level) || {};
  const soldiers = squadSoldierCount(troopId, level);
  const interval = CONFIG.combat.intervals[troopId] * (tr.intervalMult || 1);

  const atkMult = (tr.atkMult || 1) * (tr.dealtMult || 1);
  const atk = s.atk * atkMult;
  const dps = (atk / interval) * volleyFactor(tr, troopId, level) * soldiers;
  // 毒矢：命中后常驻刷新，按每秒毒伤补进输出；弓箭整体倍率也同步作用于毒伤
  const poisonDps = tr.poisonPct ? s.atk * tr.poisonPct * soldiers * (tr.dealtMult || 1) : 0;

  const squadHp = s.hp * soldiers;
  const squadDef = s.def * soldiers;
  const power = squadHp + (dps + poisonDps) * 3 + squadDef * 2;
  // 最后一道护栏：任何异常数值都退回按 1 级算，保证顶栏不出现 0 / NaN
  if (!Number.isFinite(power)) {
    return level === 1 ? 0 : troopPower(troopId, 1);
  }
  return Math.round(power);
}

export function unitPower(unit) {
  return troopPower(unit.troop, unit.level);
}

export function sumPower(units) {
  return units.reduce((sum, u) => sum + troopPower(u.troop, u.level), 0);
}

// 千分位（不依赖 toLocaleString，小游戏端也稳）
export function formatPower(n) {
  const v = Math.max(0, Math.round(n || 0));
  const s = String(v);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

// 战力对比文案：1.25× / 优势 / 劣势 / 势均力敌
export function comparePower(my, enemy) {
  const a = Math.max(1, my || 0);
  const b = Math.max(1, enemy || 0);
  const ratio = a / b;
  const label = ratio >= 1.15 ? '优势' : ratio <= 0.87 ? '劣势' : '势均力敌';
  return {
    ratio,
    ratioText: `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(2)}×`,
    label,
    tone: label === '优势' ? 'good' : label === '劣势' ? 'bad' : 'even',
  };
}
