// 成长拆成三条独立曲线：血量大幅成长、攻击维持原节奏、防御只做极缓慢成长。
// 旧版三条都吃 1.03^(lv-1)，导致 Lv30 刘备 def132 / 曹操141，满级普通兵打上去只有 1 点。
// 本轮：血 1.05^(lv-1)（Lv30 ×4.32）、攻 1.03^(lv-1)（×2.36）、防 1.005^(lv-1)（×1.16）。
export const HERO_MAX_LEVEL = 30;
export const HERO_GROWTH = 0.03;          // 兼容旧引用：攻击成长率
export const HERO_HP_GROWTH = 0.05;
export const HERO_DEF_GROWTH = 0.005;

// 兵种表里写的是「矛兵 / 弓 / 盾」，按成长规则说明映射到现有四条兵种线
export const HERO_TIER = { epic: 'epic', legendary: 'legendary' };

export const HEROES = [
  {
    id: 'guanping', name: '关平', title: '关羽之子 · 少年将军', troop: 'spear', tier: 'epic',
    color: '#4fa87a',
    base: { hp: 2000, atk: 90, def: 10, interval: 1.0 },
    skill: { id: 'stunEveryHit', name: '拖刀计', desc: '每次攻击击晕目标 1.0→1.5 秒。' },
    unlock: '招募系统 / 第 250 关首通赠送',
  },
  {
    id: 'zhangren', name: '张任', title: '蜀中名将', troop: 'cavalry', tier: 'epic',
    color: '#7b90a8',
    base: { hp: 1750, atk: 102, def: 8, interval: 1.1 },
    skill: {
      id: 'charge', name: '冷峻铁骑',
      desc: '连续移动 3 格未攻击后冲锋：移速 ×1.6→×2.0，冲锋伤害 ×1.8→×2.6。',
    },
    unlock: '招募系统',
  },
  {
    id: 'huanggai', name: '黄盖', title: '东吴老将', troop: 'archer', tier: 'epic',
    color: '#a85a48',
    base: { hp: 1450, atk: 98, def: 7, interval: 1.5 },
    skill: { id: 'doubleShot', name: '苦肉连射', desc: '每次攻击射出 2 支箭，单箭伤害 100%→140%。' },
    unlock: '招募系统',
  },
  {
    id: 'liru', name: '李儒', title: '董卓智囊', troop: 'cavalry', tier: 'epic',
    color: '#6b4a7a',
    base: { hp: 1600, atk: 96, def: 7, interval: 1.2 },
    skill: {
      id: 'poisonHeal', name: '鸩谋急袭',
      desc: '每秒恢复自身最大生命 3%→5%；毒伤每秒 30%→45% 攻击力，不可叠加。',
    },
    unlock: '招募系统',
  },
  {
    id: 'zhangjiao', name: '张角', title: '太平道领袖', troop: 'archer', tier: 'epic',
    color: '#c9a13a',
    base: { hp: 1650, atk: 100, def: 9, interval: 2.1 },
    skill: {
      id: 'summonShield', name: '撒豆成兵',
      desc: '远程攻击；每 5 秒（满级 4 秒）召唤 1 名盾兵，召唤兵强度 100%→150%。',
    },
    unlock: '招募系统',
  },
  {
    id: 'xiahouyuan', name: '夏侯渊', title: '神速将军', troop: 'cavalry', tier: 'epic',
    color: '#9aa4b0',
    base: { hp: 1650, atk: 108, def: 8, interval: 1.05 },
    skill: {
      id: 'swiftAura', name: '神速奔袭',
      desc: '开局为自身与周围 6 名友军提供 30%→60% 攻速与移速，持续到死亡。',
    },
    unlock: '招募系统',
  },
  {
    id: 'zhangfei', name: '张飞', title: '燕人猛将', troop: 'spear', tier: 'legendary',
    color: '#3c3f46',
    base: { hp: 3500, atk: 93, def: 20, interval: 1.5 },
    skill: {
      id: 'roar', name: '燕人咆哮',
      desc: '接战怒吼：敌军恐慌 2→3 秒；普攻震地，半径 2→2.6 格、伤害 1.0→1.3 倍。',
    },
    unlock: '7 日登录第 3 天赠送',
  },
  {
    id: 'guanyu', name: '关羽', title: '武圣', troop: 'cavalry', tier: 'legendary',
    color: '#2f7a4a',
    base: { hp: 2900, atk: 180, def: 18, interval: 1.2 },
    skill: {
      id: 'qinglong', name: '青龙偃月',
      desc: '移动 3 格未攻击后冲锋：移速 ×2→×2.4、本次伤害 ×3→×4，并对前方 60°、半径 3 格造成同等伤害。开局获得 1000→4000 护盾，破碎时对周围 3 格造成 0.8→1.2 倍普攻伤害。',
    },
    unlock: '招募系统',
  },
  {
    id: 'liubei', name: '刘备', title: '汉室宗亲', troop: 'shield', tier: 'legendary',
    color: '#c8a15a',
    base: { hp: 4000, atk: 75, def: 24, interval: 1.5 },
    skill: {
      id: 'rende', name: '仁德之盾',
      desc: '盾击眩晕 1.5→2.5 秒；4 格范围每秒治疗 20→80 点；自身每秒固定回复 40 + 12×(等级-1) 点。',
    },
    unlock: '招募系统',
  },
  {
    id: 'caocao', name: '曹操', title: '乱世枭雄', troop: 'shield', tier: 'legendary',
    color: '#4a5b7a',
    // 曹操：高血量、中低防御。血量按「每格 800」口径：当前单英雄模型占 5 格 → 800×5 = 4000。
    base: { hp: 4000, atk: 50, def: 22, interval: 1.8 },
    skill: {
      id: 'dmgConvert', name: '宁可我负天下人',
      desc: '冷却 10 秒、持续 5 秒：受到伤害的 120% 转为治疗，并反弹 60%→100% 远程伤害，近战不反弹。',
    },
    unlock: '招募系统',
  },
  {
    id: 'zhouyu', name: '周瑜', title: '江东都督', troop: 'archer', tier: 'legendary',
    color: '#b0544a',
    base: { hp: 1600, atk: 105, def: 9, interval: 2.0 },
    skill: {
      id: 'fire', name: '火烧连营',
      desc: '射程 25 格（22 格开火）。普攻命中后在目标脚下生成直径 2 格的火焰圈，持续 3 秒、每 0.5 秒跳伤：圈内敌人每秒受到 50%→80% 普攻伤害，藤甲额外受 50% 火焰伤害。',
    },
    unlock: '招募系统',
  },
  {
    id: 'dongzhuo', name: '董卓', title: '西凉霸主', troop: 'spear', tier: 'legendary',
    color: '#7a2f2f',
    base: { hp: 2400, atk: 160, def: 16, interval: 1.2 },
    skill: {
      id: 'lifesteal', name: '权倾朝野',
      desc: '普攻吸血 50%→100%；开战 5 秒后获得 0.5→1.0 倍最大生命的护盾。',
    },
    unlock: '招募系统',
  },
];

export function heroById(id) {
  return HEROES.find((h) => h.id === id) || null;
}

export function heroesByTier(tier) {
  return HEROES.filter((h) => h.tier === tier);
}

// 布阵数组里用 "h:英雄id" 表示一个英雄格（和兵营单位 id "u12" 区分开）
export function heroEntryId(heroId) {
  return `h:${heroId}`;
}

export function heroIdFromEntry(uid) {
  const s = String(uid || '');
  return s.startsWith('h:') ? s.slice(2) : null;
}

// 英雄战斗数值：血 / 攻 / 防三条独立成长曲线，永远是 1 个将领模型
export function heroStatsFor(heroId, level = 1) {
  const h = heroById(heroId);
  if (!h) return null;
  const lv = Math.max(1, Math.min(HERO_MAX_LEVEL, Math.floor(level || 1)));
  const kh = Math.pow(1 + HERO_HP_GROWTH, lv - 1);
  const ka = Math.pow(1 + HERO_GROWTH, lv - 1);
  const kd = Math.pow(1 + HERO_DEF_GROWTH, lv - 1);
  return {
    hp: Math.round(h.base.hp * kh),
    atk: Math.round(h.base.atk * ka * 10) / 10,
    def: Math.round(h.base.def * kd * 10) / 10,
    interval: h.base.interval,
    soldiers: 1,
  };
}

// 0（1 级）→ 1（30 级）：满级成长项的插值系数
export function heroLevelScale(level) {
  const lv = Math.max(1, Math.min(HERO_MAX_LEVEL, Math.floor(level || 1)));
  return (lv - 1) / (HERO_MAX_LEVEL - 1);
}

// 各英雄技能/被动的「当前等级数值」：Lv1 → 满级 30 全部线性成长，无跳档。
// 详情页、战斗 traits、测试成长表都从这里取数，确保三者永不漂移。
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

export function heroSkillNumbers(heroId, level = 1) {
  const h = heroById(heroId);
  if (!h) return null;
  const m = heroLevelScale(level);
  switch (h.skill.id) {
    case 'stunEveryHit':
      return { stunSec: r2(1.0 + 0.5 * m) };
    case 'charge':
      return { speedMult: r2(1.6 + 0.4 * m), dmgMult: r2(1.8 + 0.8 * m) };
    case 'doubleShot':
      return { arrows: 2, arrowDmgMult: r2(1 + 0.4 * m) };
    case 'poisonHeal':
      return { selfHeal: r3(0.03 + 0.02 * m), poisonPct: r2(0.3 + 0.15 * m) };
    case 'summonShield':
      return { every: r2(5 - 1 * m), levelStep: 3, summonMult: r2(1 + 0.5 * m) };
    case 'swiftAura':
      return { hastePct: r2(0.3 + 0.3 * m) };
    case 'roar':
      return {
        fearSec: r2(2 + 1 * m), fearRadius: r2(2.2 + 0.8 * m),
        spinRadius: r2(2 + 0.6 * m), spinDmgMult: r2(1 + 0.3 * m),
      };
    case 'qinglong':
      return {
        chargeSpeed: r2(2 + 0.4 * m), chargeDmg: r2(3 + 1 * m),
        shieldHp: Math.round(1000 + 3000 * m), burstDmgMult: r2(0.8 + 0.4 * m),
      };
    case 'rende':
      return {
        stunSec: r2(1.5 + 1 * m), auraRadius: 4,
        auraHps: Math.round(20 + 60 * m),
        // 自身回血改为每秒固定点数：40 + 12×(等级-1)，Lv1 40 / Lv30 388 点/秒
        selfHealHps: Math.round(40 + 12 * (Math.max(1, Math.min(HERO_MAX_LEVEL, Math.floor(level || 1))) - 1)),
      };
    case 'dmgConvert':
      // 治疗固定 120%（不随等级）；反弹 60% → 满级 100%
      return { healPct: 1.2, reflectPct: r2(0.6 + 0.4 * m), cd: 10, dur: 5 };
    case 'fire':
      return {
        range: 25, stopRange: 22,
        fireRadius: 1, fireDuration: 3, fireInterval: 0.5,
        dmgPct: r2(0.5 + 0.3 * m), vsTengjia: 1.5,
      };
    case 'lifesteal':
      return { lifesteal: r2(0.5 + 0.5 * m), shieldHpMult: r2(0.5 + 0.5 * m), shieldDelay: 5 };
    default:
      return null;
  }
}

// 详情页「当前等级效果」文案：所有数值都来自 heroSkillNumbers，避免文案与战斗脱节
export function heroSkillSummary(heroId, level = 1) {
  const n = heroSkillNumbers(heroId, level);
  if (!n) return '';
  switch (heroId) {
    case 'guanping': return `每次攻击眩晕 ${n.stunSec} 秒`;
    case 'zhangren': return `冲锋移速 ×${n.speedMult}，冲锋伤害 ×${n.dmgMult}`;
    case 'huanggai': return `每次 ${n.arrows} 箭，单箭伤害 ${Math.round(n.arrowDmgMult * 100)}%`;
    case 'liru': return `每秒自愈 ${Math.round(n.selfHeal * 1000) / 10}% 最大生命，毒伤 ${Math.round(n.poisonPct * 100)}%/秒`;
    case 'zhangjiao': return `每 ${n.every} 秒召唤盾兵，召唤兵强度 ${Math.round(n.summonMult * 100)}%`;
    case 'xiahouyuan': return `开局友军攻速/移速 +${Math.round(n.hastePct * 100)}%`;
    case 'zhangfei': return `恐慌 ${n.fearSec} 秒/半径 ${n.fearRadius} 格，震地半径 ${n.spinRadius} 格、${n.spinDmgMult} 倍伤害`;
    case 'guanyu': return `冲锋移速 ×${n.chargeSpeed}、伤害 ×${n.chargeDmg}；护盾 ${n.shieldHp}，破碎 ${n.burstDmgMult} 倍`;
    case 'liubei': return `盾击眩晕 ${n.stunSec} 秒；光环 ${n.auraHps} 点/秒（半径 ${n.auraRadius} 格）；自身 ${n.selfHealHps} 点/秒`;
    case 'caocao': return `持续 5 秒：受伤转治疗固定 ${Math.round(n.healPct * 100)}%，远程反弹 ${Math.round(n.reflectPct * 100)}%`;
    case 'zhouyu': return `射程 ${n.range} 格（${n.stopRange} 格开火），火焰每秒 ${Math.round(n.dmgPct * 100)}% 普攻`;
    case 'dongzhuo': return `吸血 ${Math.round(n.lifesteal * 100)}%，开局护盾 ${n.shieldHpMult} 倍血量`;
    default: return '';
  }
}

// 英雄战法 → arena 用的 combatTraits 结构（所有成长数值统一来自 heroSkillNumbers）
export function heroCombatTraits(heroId, level = 1) {
  const h = heroById(heroId);
  if (!h) return null;
  const n = heroSkillNumbers(heroId, level);
  switch (h.skill.id) {
    case 'stunEveryHit':
      return { stunEveryHit: n.stunSec };
    case 'charge':
      return { charge3: { moveNeeded: 3, speedMult: n.speedMult, dmgMult: n.dmgMult, splash: 1, splashAngle: 60 } };
    case 'doubleShot':
      return { multiArrow: n.arrows, arrowDmgMult: n.arrowDmgMult, poisonPct: 0 };
    case 'poisonHeal':
      return { selfHeal: n.selfHeal, poisonPct: n.poisonPct };
    case 'summonShield':
      return { summon: { troop: 'shield', every: n.every, levelStep: n.levelStep, mult: n.summonMult } };
    case 'swiftAura':
      // 骑兵近战：骑兵口径移速（CONFIG.combat.speeds.cavalry）+ 自身与 6 名友军加速
      return { teamHaste: { pct: n.hastePct, count: 6, radius: 14 } };
    case 'roar':
      return {
        fear: { sec: n.fearSec, radius: n.fearRadius },
        // 圆环震地：以自身为圆心，命中半径内所有其他敌人
        spinAttack: { radius: n.spinRadius, dmgMult: n.spinDmgMult },
      };
    case 'qinglong':
      return {
        charge3: { moveNeeded: 3, speedMult: n.chargeSpeed, dmgMult: n.chargeDmg },
        // 扇形劈砍只在冲锋那一下触发：攻击方向 60 度、半径 3 格；普攻恢复单体
        chargeSplash: { radius: 3, angle: 60, dmgMult: n.chargeDmg },
        shieldStart: { hp: n.shieldHp },
        shieldBurst: { radius: 3, dmgMult: n.burstDmgMult },
      };
    case 'rende':
      return {
        stunEveryHit: n.stunSec,
        healAura: { radius: n.auraRadius, hps: n.auraHps },
        selfHealHps: n.selfHealHps,
      };
    case 'dmgConvert':
      return {
        // 曹操「宁可我负天下人」：10 秒冷却、5 秒持续；治疗固定 120%，反弹远程 60% → 100%
        dmgConvert: {
          cd: n.cd,
          dur: n.dur,
          healPct: n.healPct,
          reflectPct: n.reflectPct,
        },
      };
    case 'fire':
      return {
        // 周瑜：开火 20 格、射程 22 格（战场 30×84 格，22 格仍在可视场内）
        range: n.range,
        stopRange: n.stopRange,
        // 地面火焰圈：直径 2 格（半径 1），持续 3 秒、每 0.5 秒跳伤；dmgPct = 每秒伤害占普攻比例
        fireZone: {
          radius: n.fireRadius,
          duration: n.fireDuration,
          interval: n.fireInterval,
          dmgPct: n.dmgPct,
          vsTengjia: n.vsTengjia,
        },
      };
    case 'lifesteal':
      return {
        lifesteal: n.lifesteal,
        shieldStart: { hpMult: n.shieldHpMult, delay: n.shieldDelay },
      };
    default:
      return null;
  }
}
