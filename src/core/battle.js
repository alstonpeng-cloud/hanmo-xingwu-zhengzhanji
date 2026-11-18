// 伤害公式（纯函数，斗技场逻辑与测试共用）
// PRD 5.2：伤害 = max(1, 攻击 - 防御) × 克制系数，向下取整，不暴击不浮动
// 特殊兵种的战法（增伤 / 减伤）以倍率形式接进来，数值全部来自 data/traits.js
import { CONFIG } from '../data/config.js';
import { baseTroopOf } from './units.js';

// 克制关系只看「兵种线」：稀有/史诗/传奇兵种按它的基础兵种（枪/盾/弓/骑）参与克制
export function counterMultiplier(attackerTroop, defenderTroop) {
  const a = baseTroopOf(attackerTroop);
  const d = baseTroopOf(defenderTroop);
  const hit = CONFIG.counters.find((c) => c.attacker === a && c.defender === d);
  return hit ? hit.mult : 1;
}

// 防守方战法减伤：
// takenAll（藤甲：所有伤害 -X）
// takenArrow（先登：弓箭伤害 -X）
// takenCavalry / takenCavalryCharge（白毦：骑兵普攻 / 骑兵冲锋伤害 -X）
// takenShield（幽州：受盾兵伤害 -X）、takenSpearExtra（幽州：受枪兵伤害 +X）
// opt.atkLine = 攻击方的兵种线（archer / cavalry / shield / spear），opt.charge = 是否冲锋撞击
export function takenMultiplier(defender, opt = {}) {
  const tr = defender && defender.tr;
  if (!tr) return 1;
  const line = opt.atkLine || '';
  let k = 1;
  if (tr.takenAll) k *= 1 - tr.takenAll;
  if (line === 'archer' && tr.takenArrow) k *= 1 - tr.takenArrow;
  if (line === 'cavalry') {
    if (opt.charge) {
      if (tr.takenCavalryCharge) k *= 1 - tr.takenCavalryCharge;
    } else if (tr.takenCavalry) {
      k *= 1 - tr.takenCavalry;
    }
  }
  if (line === 'shield' && tr.takenShield) k *= 1 - tr.takenShield;
  if (line === 'spear' && tr.takenSpearExtra) k *= 1 + tr.takenSpearExtra;
  return k;
}

// attacker / defender 都是斗技场里的兵（带 troop / atk / def，可选 tr、auraAtk）
// opt = { mult: 技能额外倍率（冲锋 4 倍 / 突刺倍率）, charge: 是否冲锋撞击 }
export function computeDamage(attacker, defender, opt = {}) {
  const atk = attacker.atk + (attacker.auraAtk || 0);
  const atr = attacker && attacker.tr;
  // 穿甲：无视目标 X% 护甲（有效护甲只乘一次，不与其他穿甲重复叠算）
  const armorPen = atr && atr.armorPen ? atr.armorPen : 0;
  const effDef = defender.def * (1 - armorPen);
  const raw = atk - effDef;
  const base = raw > 0 ? raw : 1;
  const atkLine = baseTroopOf(attacker.troop);
  const defLine = baseTroopOf(defender.troop);

  let k = counterMultiplier(attacker.troop, defender.troop);
  if (atr) {
    if (atr.dealtMult) k *= atr.dealtMult;               // 大戟增伤 / 藤甲自身输出减半 / 青州略低
    if (atr.arrowDmgMult) k *= atr.arrowDmgMult;         // 黄盖苦肉连射：单箭伤害随等级成长
    if (atr.vsShield && defLine === 'shield') k *= 1 + atr.vsShield; // 幽州破盾
    if (atr.vsCavalry && defLine === 'cavalry') k *= 1 + atr.vsCavalry; // 枪兵拒马：对骑兵伤害加成
  }
  if (opt.mult && opt.mult !== 1) k *= opt.mult;
  // 中军鼓吹：常驻增伤光环（由斗技场每帧写入 siegeDmgMult，取同源最高值，不叠乘）
  if (attacker.siegeDmgMult) k *= 1 + attacker.siegeDmgMult;
  k *= takenMultiplier(defender, { atkLine, charge: !!opt.charge });

  return Math.max(1, Math.floor(base * k));
}
