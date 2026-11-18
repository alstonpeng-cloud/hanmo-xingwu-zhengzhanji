// 特殊兵种「战法 / 特性」：展示文案 + 战斗数值（全部在这里改）
// 每条 = 详情页里的一行；desc(lv) 用当前等级算出真实数值，战斗逻辑读 combatTraits()

const lv10 = (lv) => Math.max(1, Math.min(10, Math.floor(lv || 1)));
// 从 lv1 的 from 线性长到 lv10 的 to
const lerp = (from, to, lv) => from + (to - from) * (lv10(lv) - 1) / 9;
const pct = (v) => `${Math.round(v * 100)}%`;
const num = (v) => `${Math.round(v)}`;
// 陷阵营锐甲反击：lv1 = 30%，每升一级 +5%，最高 80%（按受到的那一次伤害比例反弹）
const counterPct = (lv) => Math.min(0.80, 0.30 + 0.05 * (lv10(lv) - 1));
// 穿甲：30% 护甲穿透 = 无视目标 30% 护甲（只乘一次，不重复叠算）
const ARMOR_PEN = 0.30;
const ARMOR_PEN_DESC = `穿甲：无视目标 ${pct(ARMOR_PEN)} 护甲。`;
// 抵御冲锋：枪兵线通用被动，冲锋伤害 -75%，免疫冲锋眩晕，且对骑兵伤害 +130%
const ANTI_CHARGE = 0.75;
const SPEAR_VS_CAV = 1.30;
const ANTI_CHARGE_DESC = `抵御冲锋：受到骑兵冲锋伤害 -${pct(ANTI_CHARGE)}，免疫冲锋眩晕；对骑兵伤害 +${pct(SPEAR_VS_CAV)}。`;
// 普通骑兵冲锋（与稀有/传奇骑兵的专属冲锋区分）
// 普通骑兵冲锋削弱：激活距离 3 → 5 格（幽州突骑 / 虎豹骑 / 英雄的专属冲锋仍为 3 格）
const NORMAL_CHARGE = { moveNeeded: 5, speedMult: 1.3, dmgMult: 1.6 };
export const TROOP_TRAITS = {
  // ---- 基础兵种（普通）----
  spear: {
    note: '普通枪兵同样拥有枪兵线的「抵御冲锋」',
    skills: [{ name: '拒马', type: '被动', desc: () => ANTI_CHARGE_DESC }],
  },
  cavalry: {
    note: '普通骑兵拥有弱化版冲锋（低于幽州突骑 / 虎豹骑）',
    skills: [{
      name: '疾驰冲锋', type: '被动',
      desc: () => `连续未攻击状态下移动累计 ${NORMAL_CHARGE.moveNeeded} 格后进入冲锋：速度 ×${NORMAL_CHARGE.speedMult}，造成普攻 ${NORMAL_CHARGE.dmgMult} 倍伤害。`,
    }],
  },
  // ---- 枪兵线 ----
  qingzhou: {
    note: '开局 5 个兵，随等级增员，满级 10 个',
    skills: [{
      name: '群卒奋进', type: '被动',
      desc: () => `攻击 -20%；编制 5 人起步，随等级增员至 10 人。`,
    }, { name: '拒马', type: '被动', desc: () => ANTI_CHARGE_DESC }],
  },
  baier: {
    skills: [{
      name: '西上御骑', type: '被动',
      desc: () => `每个白毦兵首次受击时完全无伤（每人仅一次），挡住开局集火；之后正常承伤。`,
    }, { name: '拒马', type: '被动', desc: () => ANTI_CHARGE_DESC }],
  },
  daji: {
    skills: [
      {
        name: '重甲摧锋', type: '被动',
        desc: (lv) => `造成的伤害 +${pct(lerp(0.10, 0.40, lv))}。`,
      },
      {
        name: '突刺', type: '技能', cd: 15,
        desc: (lv) => `每 15 秒冲向最近的敌人，2 倍移速突进，这一下造成 ${pct(lerp(1.20, 2.40, lv))} 攻击力的伤害。`,
      },
      { name: '穿甲', type: '被动', desc: () => ARMOR_PEN_DESC },
      { name: '拒马', type: '被动', desc: () => ANTI_CHARGE_DESC },
    ],
  },
  // ---- 盾兵线 ----
  xiandeng: {
    skills: [{
      name: '巨盾御矢', type: '被动',
      desc: (lv) => `举巨盾挡箭：受到弓箭伤害 -${pct(lerp(0.30, 0.57, lv))}，弓兵越多越明显。`,
    }],
  },
  tengjia: {
    skills: [{
      name: '藤革坚躯', type: '被动',
      desc: (lv) => `受到伤害 -${pct(lerp(0.30, 0.60, lv))}，自身伤害 -50%，受到火焰伤害 +50%。`,
    }],
  },
  xianzhen: {
    skills: [
      {
        name: '锐甲反击', type: '被动',
        desc: (lv) => `受到近战攻击会自动反击，反击伤害 = 这次受到伤害的 ${pct(counterPct(lv))}（最高 80%）。`,
      },
      {
        name: '陷阵自疗', type: '被动',
        desc: (lv) => `每秒恢复自身最大血量的 ${pct(lerp(0.02, 0.05, lv))}（边打边回血）。`,
      },
    ],
  },
  // ---- 弓兵线 ----
  qingzhu: {
    note: '开局 4 个兵，Lv2 / 4 / 6 / 8 各 +1，满级 8 个',
    skills: [{
      name: '竹弓疾射', type: '被动',
      desc: () => `射速 +33%，单发伤害 -23%；编制 4 人起步，满级 8 人。`,
    }],
  },
  yuanyong: {
    skills: [{
      name: '连射不绝', type: '技能',
      desc: () => `射程 23 格（20 格开火）；每轮 2 / 3 / 4 连射，装弹 4.0 秒。`,
    },
    { name: '穿甲', type: '被动', desc: () => ARMOR_PEN_DESC }],
  },
  wudang: {
    skills: [{
      name: '毒矢齐射', type: '技能',
      desc: (lv) => `每轮 ${[2,2,2,3,3,3,3,4,4,4][lv10(lv)-1]} 支毒箭；毒伤每秒 ${pct(lerp(0.30, 0.60, lv))} 攻击力，持续 3 秒，可刷新。`,
    }],
  },
  // ---- 骑兵线 ----
  youzhou: {
    skills: [{
      name: '疾风冲锋', type: '被动',
      desc: (lv) => `连续未攻击状态下移动累计 3 格后进入冲锋：速度 ×1.5，造成普攻 ${lerp(1.2, 2.7, lv).toFixed(1)} 倍伤害。`,
    }],
  },
  baima: {
    skills: [{
      name: '射猎后阵', type: '被动',
      desc: () => `骑射：射程 19 格（17 格开火），优先攻击最近的敌方后排远程。`,
    }],
  },
  huhao: {
    note: '开局 2 个兵，Lv3 / 6 / 9 各 +1，满级 5 个',
    skills: [{
      name: '破阵冲锋', type: '被动',
      desc: (lv) => `连续未攻击状态下移动累计 3 格后进入冲锋：速度 ×2，造成普攻 ${num(lerp(3, 6, lv))} 倍伤害，并使命中目标眩晕 ${lerp(1.0, 2.0, lv).toFixed(1)} 秒。`,
    }],
  },
};

// 详情页用：当前等级下的战法文案（没有战法返回空数组）
export function traitSkills(troopId, level) {
  const def = TROOP_TRAITS[troopId];
  if (!def) return [];
  return def.skills.map((s) => ({
    name: s.name, type: s.type, cd: s.cd || 0, desc: s.desc(level),
  }));
}

export function traitNote(troopId) {
  const def = TROOP_TRAITS[troopId];
  return (def && def.note) || '';
}

// 战斗数值：普通兵种返回 null（无任何战法）
// 所有倍率都是「加法百分比」，例如 dealtMult = 1.4 表示伤害 +40%
export function combatTraits(troopId, level = 1) {
  const lv = lv10(level);
  switch (troopId) {
    case 'spear':
      // 普通枪兵：抵御冲锋（减免冲锋伤害 + 免疫冲锋眩晕 + 对骑兵增伤）
      return { takenCavalryCharge: ANTI_CHARGE, vsCavalry: SPEAR_VS_CAV };
    case 'cavalry':
      // 普通骑兵：弱化版冲锋（虎豹骑 ×6 / 幽州突骑 ×2.7，普通骑兵 ×1.6）
      return { charge3: { ...NORMAL_CHARGE } };
    case 'qingzhou':
      return { atkMult: 0.8, takenCavalryCharge: ANTI_CHARGE, vsCavalry: SPEAR_VS_CAV };
    case 'baier':
      // 每个白毦兵首次受击完全无伤（由 arena.js 判定每兵一次）+ 抵御冲锋
      return { firstHitBlock: true, takenCavalryCharge: ANTI_CHARGE, vsCavalry: SPEAR_VS_CAV };
    case 'daji':
      return {
        dealtMult: 1 + lerp(0.10, 0.40, lv),
        dash: { cd: 15, speedMult: 2, dmgMult: lerp(1.20, 2.40, lv) },
        armorPen: ARMOR_PEN,          // 穿甲：无视 30% 护甲
        takenCavalryCharge: ANTI_CHARGE,
        vsCavalry: SPEAR_VS_CAV,
      };
    case 'xiandeng':
      return { takenArrow: lerp(0.30, 0.57, lv) };
    case 'tengjia':
      return { dealtMult: 0.5, takenAll: lerp(0.30, 0.60, lv), fireTaken: 0.5 };
    case 'xianzhen':
      return {
        counterPct: counterPct(lv),
        // 每秒恢复最大血量百分比（lv1=2%, lv10=5%）
        selfHeal: lerp(0.02, 0.05, lv),
      };
    case 'qingzhu':
      return { intervalMult: 0.75, atkMult: 0.9 };
    case 'yuanyong':
      // 元戎弩手：射程 23 格，stopRange=20（arena.js 战法优先取 stopRange）
      // 每次攻击射出 N 发满伤害箭矢（lv1-3=2, lv4-7=3, lv8+=4），间隔 0.5s，装弹 4s
      return {
        range: 23,
        stopRange: 20,
        volley: {
          tier: [[1, 2], [4, 3], [8, 4]], // [达此lv, burst数]
          shotInterval: 0.50,
          reload: 4.0,
        },
        armorPen: ARMOR_PEN,          // 穿甲：无视 30% 护甲
      };
    case 'wudang':
      // 毒矢齐射：N 发满伤害毒箭 + 毒 DOT；无闪避光环
      return {
        poisonPct: lerp(0.30, 0.60, lv),
        multiArrow: tierBurst(lv, [[1, 2], [4, 3], [8, 4]]),
      };
    case 'youzhou':
      // 疾风冲锋：移动3格未攻击→speed×1.5, dmgMult lv1=1.2→lv10=2.7
      return {
        charge3: {
          moveNeeded: 3,
          speedMult: 1.5,
          dmgMult: lerp(1.2, 2.7, lv),
        },
      };
    case 'baima':
      // 白马义从是骑射：射程 19 格（提前 2 格 → 17 格开火），实际箭矢伤害保持原来的 80%
      // preferArcher 沿用旧字段名，实际含义是「优先锁后排（弓兵线 + 敌方白马义从）」
      return { preferArcher: true, range: 19, stopRange: 17, dealtMult: 0.8 };
    case 'huhao':
      // 破阵冲锋：移动3格未攻击→speed×2, dmgMult lv1=3→lv10=6, stun lv1=1.0→lv10=2.0s
      return {
        charge3: {
          moveNeeded: 3,
          speedMult: 2,
          dmgMult: lerp(3, 6, lv),
          stunSec: lerp(1.0, 2.0, lv),
        },
      };
    default:
      return null;
  }
}

// 小工具：根据 lv + 跳点表，返回该等级应有的 burst 数
// 例如 tier=[[1,2],[4,3],[8,4]] → lv1=2, lv4=3, lv8=4
function tierBurst(lv, tiers) {
  let n = tiers[0]?.[1] || 1;
  for (const [at, val] of tiers) if (lv >= at) n = val;
  return n;
}
