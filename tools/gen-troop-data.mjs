// 全兵种数据对照表生成器（单文件 HTML，可直接双击打开）
// 数据全部从 src/data/config.js / traits.js / core/units.js / core/arena.js / core/power.js / core/levels.js 读取，
// 不在模板里手写任何数值。用法：node tools/gen-troop-data.mjs
// 输出：docs/troop_data_table.html
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/data/config.js';
import { statsFor, baseTroopOf, rarityOf, unitName } from '../src/core/units.js';
import { squadSoldierCount } from '../src/core/arena.js';
import { troopPower } from '../src/core/power.js';
import { shopPrice } from '../src/core/levels.js';
import { combatTraits, TROOP_TRAITS } from '../src/data/traits.js';

const LINE = {
  shield: { name: '盾兵', cat: '步兵 · 盾' },
  archer: { name: '弓兵', cat: '远程 · 弓' },
  spear: { name: '枪兵', cat: '步兵 · 枪' },
  cavalry: { name: '骑兵', cat: '骑兵' },
};
const RARITY = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇' };
const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };

// ---- 与 tools/troop-table.mjs 相同的队秒伤口径（不含毒伤） ----
function baseDmgMod(troopId, lv) {
  const tr = combatTraits(troopId, lv);
  if (!tr) return 1;
  return (tr.dealtMult || 1) * (tr.atkMult || 1);
}
function intervalMod(troopId, lv) {
  const tr = combatTraits(troopId, lv);
  return (tr && tr.intervalMult) || 1;
}
function volleyFactor(troopId, lv) {
  const tr = combatTraits(troopId, lv);
  if (!tr || !tr.volley) return 1;
  const v = tr.volley;
  // burst 可能是固定值，也可能按等级跳点（元戎：Lv1~3=2 / Lv4~7=3 / Lv8+=4）
  let burst = v.burst;
  if (burst == null) {
    burst = 1;
    for (const [at, val] of (v.tier || [])) if (lv >= at) burst = val;
  }
  const shotsPerSec = burst / (burst * v.shotInterval + v.reload);
  const baseInterval = CONFIG.combat.intervals[troopId] * ((tr && tr.intervalMult) || 1);
  return shotsPerSec * baseInterval * (v.dmgMult || 1);
}
function squadDps(troopId, lv) {
  const s = statsFor(troopId, lv);
  const squad = squadSoldierCount(troopId, lv);
  return (s.atk / CONFIG.combat.intervals[troopId])
    * squad * baseDmgMod(troopId, lv) / intervalMod(troopId, lv) * volleyFactor(troopId, lv);
}
function poisonDps(troopId, lv) {
  const tr = combatTraits(troopId, lv);
  if (!tr || !tr.poisonPct) return 0;
  return statsFor(troopId, lv).atk * tr.poisonPct * squadSoldierCount(troopId, lv);
}

// ---- 攻击方式 / 目标说明（按真实逻辑：最近敌军，白马优先弓兵线） ----
function attackText(troop) {
  const id = troop.id;
  const base = baseTroopOf(id);
  if (id === 'baima') return '最近敌军（优先弓兵线）· 骑射箭矢：射程 18 格，走到 16 格开火';
  if (id === 'yuanyong') return '最近敌军 · 连弩齐射：射程 20 格（18 格开火），2/3/4 发一轮（按等级），每发间隔 0.5 秒，装填 4 秒；穿甲无视 30% 护甲';
  if (id === 'qingzhu') return '最近敌军 · 竹弓箭矢：射程 14 格（12 格开火），攻击间隔 ×0.75';
  if (id === 'wudang') return '最近敌军 · 箭矢：射程 14 格（12 格开火），命中挂 3 秒毒';
  if (base === 'archer') return '最近敌军 · 箭矢远程：射程 14 格，走到 12 格开火';
  if (base === 'shield') return '最近敌军 · 近战单体：0.5 格贴脸';
  if (base === 'spear') return '最近敌军 · 长枪突刺：1.2 格';
  if (base === 'cavalry') return '最近敌军 · 骑兵近战：1 格；虎豹骑首击冲锋 4×';
  return '未定义';
}

// ---- 克制：直接由 CONFIG.counters 反推（特殊兵种回退到基础兵种线） ----
function counterText(troopId) {
  const line = baseTroopOf(troopId);
  const out = CONFIG.counters.filter((c) => c.attacker === line);
  const inc = CONFIG.counters.filter((c) => c.defender === line);
  const fmt = (list, prefix) => list.map((c) => `${prefix}${LINE[c.defender]?.name || c.defender} ×${c.mult}`).join(' · ');
  const outText = out.length ? fmt(out, '对') : '无';
  const incText = inc.length ? inc.map((c) => `受${LINE[c.attacker]?.name || c.attacker} ×${c.mult}`).join(' · ') : '无';
  return `${outText}<br>${incText}`;
}

// ---- 造价 / 解锁 ----
function priceInfo(troop, lv) {
  if (troop.baseTroop) return { price: null, text: '未定义（不可购买；只能开箱）' };
  const formula = shopPrice(troop.id, lv);
  if (CONFIG.shop.levels.includes(lv)) return { price: formula, text: `${formula} 铜钱（商城可买）` };
  return { price: null, text: `未定义（商城仅售 Lv1/3/6；公式价 ${formula}）` };
}
function unlockText(troop) {
  const r = rarityOf(troop.id);
  if (r === 'common') return '开局赠送 1 个；商城常驻；小木箱 / 银箱可掉普通兵（金箱不掉普通）';
  if (r === 'rare') return '稀有箱 100%（每日签到 / 任务，50 关解锁；7 日 3~7 天）；小木箱 20% Lv1、银箱 40%、金箱 30%；敌军 101 关起';
  if (r === 'epic') return '史诗箱 100%（颍川 300 关里程碑 / 7 日第 1 天，50 关解锁）；银箱 20% Lv1、金箱 40%；敌军 201 关起';
  if (r === 'legendary') return '传奇箱 100%（通关整章 400 关）；金箱 30% Lv1；敌军 301 关起';
  return '未定义';
}

// ---- 审查标记（与下方 CHECKS 的 id 对应） ----
const FLAGS = {
  baima: '跨线输出偏高',
  qingzhou: '稀有≈史诗',
  daji: '输出超线 / 首突 5s',
  tengjia: '极限坦克',
  yuanyong: 'Lv1 偏弱',
  huhao: '面板偏低',
  wudang: '后期成长偏高',
  xianzhen: '光环未计战力',
};

function skillsText(troopId) {
  const def = TROOP_TRAITS[troopId];
  if (!def || !def.skills) return '—';
  return def.skills.map((s) => `${s.name}（${s.type}${s.cd ? ` · CD${s.cd}s` : ''}）`).join(' / ') + (def.note ? `<br><span class="muted">${def.note}</span>` : '');
}

function buildRows() {
  const rows = [];
  for (const troop of CONFIG.troops) {
    const line = baseTroopOf(troop.id);
    const rarity = rarityOf(troop.id);
    for (let lv = 1; lv <= CONFIG.merge.maxLevel; lv++) {
      const s = statsFor(troop.id, lv);
      const squad = squadSoldierCount(troop.id, lv);
      const tr = combatTraits(troop.id, lv);
      const damageMult = (tr && tr.dealtMult ? tr.dealtMult : 1) * (tr && tr.atkMult ? tr.atkMult : 1);
      const range = (tr && tr.range) || CONFIG.combat.ranges[troop.id];
      const speed = CONFIG.combat.speeds[troop.id];
      const interval = CONFIG.combat.intervals[troop.id];
      const dps = Math.round(squadDps(troop.id, lv));
      const poison = Math.round(poisonDps(troop.id, lv));
      const power = troopPower(troop.id, lv);
      const price = priceInfo(troop, lv);
      rows.push({
        id: troop.id,
        name: troop.name,
        tier: unitName(troop.id, lv),
        line,
        lineName: LINE[line].name,
        category: LINE[line].cat,
        rarity,
        rarityName: RARITY[rarity],
        level: lv,
        atk: s.atk,
        damageMult,
        def: s.def,
        hp: s.hp,
        interval,
        speed,
        range,
        rangeText: range >= 10 ? `${range}（开火 ${range - CONFIG.combat.engageGap}）` : `${range}`,
        squad,
        squadHp: s.hp * squad,
        dps,
        dpsText: poison ? `${dps} <span class="poison">+毒 ${poison}</span>` : `${dps}`,
        poison,
        power,
        attack: attackText(troop),
        counters: counterText(troop.id),
        price: price.price,
        priceText: price.text,
        maintenance: '未定义',
        unlock: unlockText(troop),
        role: troop.role || '未定义',
        skills: skillsText(troop.id),
        flag: FLAGS[troop.id] || '',
      });
    }
  }
  return rows;
}

// ---- 合理性检查（人工汇总 + 代码/数值依据；状态区分「已核实」与「待确认」） ----
const CHECKS = [
  {
    id: 'baima',
    severity: '高',
    status: '已核实',
    title: '白马义从的跨线输出明显偏离同类',
    detail: '同为史诗，白马 Lv1 队秒伤 93（Lv10 605），元戎弩士 35（334）；白马是 18 格远程、1.05 秒骑兵间隔和 3.8 格/秒移速，约是元戎的 2.7 倍。',
    evidence: 'src/data/config.js:596-602（白马定义）、src/data/config.js:652-654（特殊兵种自动继承 intervals/speeds）、src/data/traits.js:181-183（射程 18 + dealtMult 0.8）；数值由 tools/gen-troop-data.mjs 计算。',
    impact: '骑射在射程、机动、出手频率三项同时占优；对弓兵线同品级单位形成 2.7 倍以上输出差（Lv1）。',
    advice: '给白马单独攻击间隔（约 2.0~2.25 秒）或降低骑射单发伤害；否则应按传奇品级定价。',
  },
  {
    id: 'qingzhou',
    severity: '高',
    status: '已核实',
    title: '青州兵（稀有）与白毦兵（史诗）小队面板几乎相同',
    detail: 'Lv1：青州 460 队血 / 87 队秒伤 / 5 兵；白毦 471 / 90 / 3 兵。Lv10：3240/568 对 3318/583。青州只低约 3%，却多 2 个兵。',
    evidence: 'src/data/config.js:523-530（青州 squad 5→10、hp 0.8）、src/data/traits.js:137-138（青州 atkMult 0.8）、src/data/config.js:656（squad 覆盖）；同线对比 1.80× 对 1.85×。',
    impact: '史诗白毦的品级溢价只剩约 3%，且被动只对骑兵；多数对局青州更划算。',
    advice: '压低青州单兵伤害/人数，或提高白毦的专属减伤/属性，确保史诗对稀有有 ≥10~15% 的综合优势。',
  },
  {
    id: 'daji',
    severity: '高',
    status: '已核实',
    title: '大戟士首次突刺是 5 秒，不是文案写的 15 秒',
    detail: '开战时 dashCd 初始化为 5 秒，第一次突刺 5 秒后就能用；之后才按 15 秒冷却。详情页写的是“每 15 秒”。',
    evidence: 'src/core/arena.js:115（dashCd: tr && tr.dash ? 5 : 0）；src/data/traits.js:33（“每 15 秒”）；src/data/traits.js:144-148（dash cd 15）；src/core/arena.js:333-336（触发后 dashCd = tr.dash.cd）。',
    impact: '首轮爆发比文案早 10 秒，影响首战节奏与战力评估。',
    advice: '要么把初始值改成 15，要么文案改成“首次 5 秒，之后 15 秒”。',
  },
  {
    id: 'xiandeng',
    severity: '中高',
    status: '已核实',
    title: '先登死士的“巨盾御矢”只对弓兵线生效，白马骑射不减免',
    detail: 'takenArrow 只在 atkLine === archer 时应用；白马义从 baseTroopOf = cavalry，所以它的箭矢被当作骑兵攻击，完全绕过巨盾御矢。',
    evidence: 'src/core/battle.js:21-38（takenMultiplier，27 行按 line===\'archer\'）、src/data/traits.js:149-150、src/core/units.js:12-14（baseTroopOf）、src/core/arena.js:16-18（白马按远程结算）。',
    impact: '同为“箭矢”，玩家会看到盾兵被白马射穿，和“巨盾御矢”的说明不一致。',
    advice: '按攻击方式（ranged/arrow）而不是兵种线判断，或把白马单独纳入 takenArrow。',
  },
  {
    id: 'xianzhen',
    severity: '中',
    status: '已修复（本轮）',
    title: '陷阵营反击改为按「是否远程」判定，白马骑射不再被反射',
    detail: '反击条件从 line !== archer 改为 !attacker.ranged：白马义从虽然属于骑兵线，但攻击按箭矢（远程）结算，因此不再触发锐甲反击；近战骑兵仍会被反击。',
    evidence: 'src/core/arena.js 反击判定（!e.ranged && counterPct）；src/core/arena.js 白马按 ranged 结算；tools/test.mjs「陷阵营不对白马义从的远程伤害触发反击」。',
    impact: '修复后骑射不再被反伤，步弓与骑射口径一致；近战骑兵的反击保持不变。',
    advice: '已按 attack.ranged 统一口径，无需再改。',
  },
  {
    id: 'wudang',
    severity: '中',
    status: '已移除（闪避机制不再存在）',
    title: '无当飞军闪避光环已随旧机制移除',
    detail: '当前无当飞军只保留「毒矢齐射」，旧的 auraDodge / 闪避判定已从战法与结算中移除，只剩 arena 里未被赋值的兼容字段。',
    evidence: 'src/data/traits.js（wudang 仅 poisonPct）；src/core/arena.js（auraDodge 恒为 0，无 miss 分支）。',
    impact: '不会再出现「文案 1 格 / 实际 1.6 格」的不一致。',
    advice: '后续若要恢复闪避，需要重新定义数据字段与结算。',
  },
  {
    id: 'tengjia',
    severity: '低',
    status: '已核实',
    title: '藤甲兵 fireTaken 字段已定义但战斗结算未使用',
    detail: 'traits.js 返回 fireTaken: 0.5，详情页也写“火伤 +50%”；但 takenMultiplier 没有读取该字段，也没有火伤来源。',
    evidence: 'src/data/traits.js:151-152；src/core/battle.js:21-38（只处理 takenAll/takenArrow/takenCavalry/takenShield/takenSpearExtra）；src/core/arena.js 无 fire 伤害事件。',
    impact: '当前是死字段；后续武将火伤上线前不会生效，容易误判平衡。',
    advice: '要么在火伤系统里接入，要么先删除该字段和文案。',
  },
  {
    id: 'hero',
    severity: '低',
    status: '已核实',
    title: '英雄品级有配色但没有属性倍率',
    detail: 'CONFIG.rarity 有 hero，但 rarityStats 没有 hero；若以后用同一条 buildSpecialTroop 建武将，mult 回退 1，和普通兵一样。',
    evidence: 'src/data/config.js:427-433（rarity 含 hero）、src/data/config.js:437-442（rarityStats 缺 hero）、src/data/config.js:619（CONFIG.rarityStats[spec.rarity] || 1）。',
    impact: '未来武将数据容易静默用错倍率。',
    advice: '补 rarityStats.hero 或禁止用该路径建武将。',
  },
  {
    id: 'ranged',
    severity: '低',
    status: '已核实',
    title: 'isRangedTroop 硬编码白马义从',
    detail: '只有 baseTroopOf === archer 或 troopId === baima 算远程；以后新增骑射/器械等远程兵种会漏判。',
    evidence: 'src/core/arena.js:16-18；白马定义 src/data/config.js:596-602；src/data/traits.js:181-183 用 range 18 + preferArcher。',
    impact: '新增远程特殊兵种时，箭矢动画/开火提前量/远程判定会静默失效。',
    advice: '把 isRanged 改成数据字段（如 troop.ranged = true），由兵种定义驱动。',
  },
  {
    id: 'price',
    severity: '中',
    status: '已核实',
    title: '商城高价档性价比快速崩塌',
    detail: '价格按 2^(Lv-1) 翻倍，Lv6 = 32×Lv1；但同兵种 Lv1→Lv6 战力只涨约 3.8 倍。铜钱/战力：盾 1.23→10.21、弓 3.55→24.82、枪 1.58→13.18、骑 1.44→12.09。弓兵在所有档位都是最差性价比。',
    evidence: 'src/data/config.js:103-107（basePrice/levelFactor）、src/core/levels.js:211-215（shopPrice）、src/core/power.js 战力口径；数值由 tools/gen-troop-data.mjs 计算。',
    impact: '商城 Lv6 基本是“用 32 倍价格买 4 倍战力”，除非作为合成跳板，否则不划算；玩家会倾向只买 Lv1。',
    advice: '要么把 levelFactor 改成与战力曲线匹配（约 1.4~1.5/级），要么把高等级定价明确标注为“跳板溢价”。',
  },
  {
    id: 'unlock',
    severity: '中高',
    status: '已核实（是否为设计意图待确认）',
    title: '高品级获取节奏早于敌军登场',
    detail: '小木箱 20% 稀有 Lv1（第 1 关就能掉）、银箱 20% 史诗 Lv1（第 20 关）、金箱 30% 传奇 Lv1（第 50 关）；但敌军稀有 101 关、史诗 201 关、传奇 301 关才出现。',
    evidence: 'src/data/config.js:294-332（wood/silver/gold drops）、src/data/config.js:272-276（specialTiers from 101/201/301）、src/data/config.js:384-390（关卡宝箱）。',
    impact: '玩家可能在极早期拿到后期品级，导致推图难度骤降；也可能让“城池解锁兵种”的叙事失效。',
    advice: '给高品级宝箱加关卡门槛（如木箱稀有需 50 关、银箱史诗需 100 关、金箱传奇需 200 关），或明确接受随机提前掉落。',
  },
  {
    id: 'power',
    severity: '中',
    status: '已核实',
    title: '战力公式不含光环/反击/冲锋/突刺/闪避，面板会低估部分特殊兵种',
    detail: 'troopPower 只计队血、常驻秒伤（含 atkMult/dealtMult/连射）、毒伤、防御；陷阵营的 +30~110 攻击光环、锐甲反击，虎豹骑 4× 冲锋/攻速光环，大戟士 15 秒突刺，无当闪避都没有折算。',
    evidence: 'src/core/power.js:19-33（公式只含 dps/poison）；src/data/traits.js:144-157（daji/xianzhen）、src/data/traits.js:184-188（huhao）、src/data/traits.js:170-174（wudang）；src/core/arena.js:163-172（光环）、src/core/arena.js:372-382（冲锋/突刺）、src/core/arena.js:389（闪避）。',
    impact: '布阵页“我方/敌方战力”和胜利页对比会系统性低估这些兵种；用战力自动布阵也排不准。',
    advice: '在 power 里加入技能期望值，或 UI 明确标注“战力不含战法触发效果”。',
  },
  {
    id: 'naming',
    severity: '低',
    status: '已核实',
    title: '特殊兵种的等级名是通用装备后缀，不是独立形态',
    detail: 'SPECIAL_GEAR 每条线只给 9 个通用词（箍头/皮甲/铁头…），特殊兵种 tiers 变成“青州兵·护肩”“白毦兵·护肩”等；普通兵种每级都有独立名字。',
    evidence: 'src/data/config.js:512-517（SPECIAL_GEAR）、src/data/config.js:638（tiers 拼接）、src/data/config.js:451-486（普通兵独立 tiers）。',
    impact: '特殊兵种的“10 级形态”命名辨识度低，详情页/战报里同线特殊兵种容易重名。',
    advice: '给 12 个特殊兵种各写一套 10 级形态名。',
  },
  {
    id: 'qingzhu',
    severity: '低',
    status: '已核实',
    title: '青竹弓手“-23%”文案是相对稀有基准，不是相对普通弓兵',
    detail: '面板 atk 已按 statMult atk 0.85 调低，战斗中再乘 atkMult 0.9；相对普通弓兵实际约 +3%，相对“稀有 ×1.35 基准”才是约 -23%。',
    evidence: 'src/data/config.js:570-575（statMult atk 0.85）、src/data/traits.js:68（文案 -23%）、src/data/traits.js:158-159（intervalMult 0.75 / atkMult 0.9）、src/core/power.js:25-27。',
    impact: '玩家按文案以为单发很弱，实际面板/战斗数值高于普通弓兵，容易误判。',
    advice: '文案改成“相对稀有弓兵基准 -23%，实际对普通弓兵 +3%”，或直接写最终倍率。',
  },
  {
    id: 'youzhou',
    severity: '低',
    status: '已核实',
    title: '幽州突骑“受枪 +30%”在结算里还会叠加兵种克制 1.1×',
    detail: '战法 takenSpearExtra = 0.30；同时 counters 里枪→骑 1.1；实际受枪伤害 = 1.1 × 1.3 = 1.43×。',
    evidence: 'src/data/traits.js:175-180（takenSpearExtra 0.30）、src/data/config.js:473-484（spear→cavalry 1.1）、src/core/battle.js:42-57（先乘 counter 再乘 takenMultiplier）。',
    impact: '文案说 +30%，实际 +43%；和枪兵对骑兵的通用克制叠加，容易被误读。',
    advice: '文案写“在通用克制之外再 +30%”，或把 takenSpearExtra 改成 0。',
  },
  {
    id: 'outlier',
    severity: '中',
    status: '待确认（设计意图）',
    title: '大戟士 / 藤甲兵 / 虎豹骑的数值明显偏离同线基准',
    detail: '大戟士 Lv10 队秒伤 = 5.42× 枪兵（传奇基准 2.85×）；藤甲兵队秒伤 0.91× 盾兵（低于稀有先登 31%），但减伤 30~60%；虎豹骑 Lv1 队秒伤 1.89×、Lv10 2.37×，面板低于传奇基准，靠 4× 冲锋/攻速光环。',
    evidence: 'src/data/traits.js:144-148（大戟 +40~90%）、src/data/traits.js:151-152（藤甲输出 0.5×/减伤）、src/data/traits.js:184-188（虎豹冲锋/攻速）；tools/troop-table.mjs 同线对比输出。',
    impact: '大戟是“输出传奇”、藤甲是“坦克传奇”、虎豹是“爆发传奇”，定位不同但面板战力无法体现；按战力匹配会低估大戟/高估藤甲。',
    advice: '把三者定位写进 UI；或给 power 加技能期望值后再做同战力匹配。',
  },
  {
    id: 'growth',
    severity: '中',
    status: '待确认（设计意图）',
    title: '无当飞军 / 元戎弩士 / 虎豹骑的 1→10 级战力成长明显高于同线',
    detail: '无当 ×9.72（毒伤 30%→60% + 人数 2→5）、元戎 ×8.78（连射 7→10 发 + 人数 2→5）、虎豹 ×8.33（人数 2→5）；同线其它特殊兵种约 ×6.7。',
    evidence: 'src/core/power.js:19-33（毒伤计入）、src/data/traits.js:160-173（元戎连射/无当毒伤）、src/data/config.js:605-613（虎豹 squad 2→5）。',
    impact: '后期同品级内部强度差距拉大；Lv1 元戎偏弱（1.59× 线），Lv10 无当偏强。',
    advice: '确认成长曲线是否符合预期；若要拉平，可让毒伤百分比封顶或让连射发数不随等级增长。',
  },
  {
    id: 'maintenance',
    severity: '提示',
    status: '已核实',
    title: '全项目没有维护成本 / 工资字段',
    detail: '兵种只定义基础属性、成长、动画、10 级名称；经济只有首通铜钱、挂机收益、商城价格；没有任何按时间/按兵种扣费的字段。对照表的“维护成本”只能写未定义。',
    evidence: 'src/data/config.js:87-107（经济/商城）、src/data/config.js:451-486（兵种字段）、src/data/config.js:519-614（特殊兵种字段）；src/core/levels.js:174-177、211-228。',
    impact: '如果设计上需要维护费，需要新增系统；当前不影响运行。',
    advice: '确认是否要做维护成本；不做就把该列永久标为未定义。',
  },
  {
    id: 'traitcounter',
    severity: '低',
    status: '已核实',
    title: '战法级克制是单向的，且不在 counters 表里',
    detail: '兵种线克制环本身对称（4 组 1.1 / 0.9）；但先登减弓伤、白毦减骑伤、幽州减盾伤 / 加枪伤等只在 traits.js 的 taken* 字段里单向生效，UI 的“克制”只读 counters，看不到这些。',
    evidence: 'src/data/config.js:473-484（counters 4 组对称）、src/data/config.js:486（COUNTER_CHAIN 只用于文字说明）、src/data/traits.js:137-198（taken*/vs* 战法）。',
    impact: '玩家按兵线克制表选阵，会漏算特殊兵种的战法克制。',
    advice: '在详情页把 taken*/vs* 也列成“战法克制”，或把这些倍率并入统一克制表。',
  },
];

// ---- 统计 ----
const rows = buildRows();
const meta = {
  generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  troopCount: CONFIG.troops.length,
  rowCount: rows.length,
  commonCount: CONFIG.troops.filter((t) => !t.baseTroop).length,
  specialCount: CONFIG.troops.filter((t) => t.baseTroop).length,
  levelMax: CONFIG.merge.maxLevel,
  checkCount: CHECKS.length,
};

const css = `
:root{
  --bg:#0d1117; --bg2:#111823; --panel:#151d28; --panel2:#1a2430;
  --line:#2a3644; --line2:#364657; --text:#e8e2d4; --dim:#a7b0bd; --weak:#76818f;
  --gold:#d8b46a; --gold2:#f0d79b; --red:#e06c5f; --green:#7fc08a; --blue:#6aa7d8; --purple:#b382d6;
  --common:#9aa5b7; --rare:#5b88c0; --epic:#a874c8; --legendary:#d8b46a;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC",system-ui,sans-serif}
a{color:var(--gold2)}
.hero{padding:34px 30px 24px;background:linear-gradient(180deg,#1b2431 0%,#0d1117 100%);border-bottom:1px solid var(--line)}
.hero h1{margin:0 0 8px;font-size:30px;letter-spacing:1px;color:var(--gold2)}
.hero .sub{color:var(--dim);font-size:14px;line-height:1.7;max-width:1100px}
.hero .stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.stat{background:#121a24;border:1px solid var(--line);border-radius:10px;padding:8px 14px;font-size:13px;color:var(--dim)}
.stat b{color:var(--gold2);font-size:17px;margin-right:5px}
main{padding:20px 20px 40px;max-width:1680px;margin:0 auto}
.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:14px;background:var(--panel);border:1px solid var(--line);border-radius:14px;margin-bottom:14px}
.group-label{font-size:12px;color:var(--weak);letter-spacing:1px;margin-right:2px}
.btn{background:#1b2634;border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;transition:.15s}
.btn:hover{border-color:var(--gold);color:var(--gold2)}
.btn.on{background:#3a3020;border-color:var(--gold);color:var(--gold2)}
select,input{background:#121a24;border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:7px 10px;font-size:13px;outline:none}
input{min-width:190px}
input:focus,select:focus{border-color:var(--gold)}
.count{color:var(--weak);font-size:13px;margin-left:auto}
.table-wrap{overflow:auto;max-height:76vh;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
table{border-collapse:separate;border-spacing:0;min-width:1980px;width:100%;font-size:13px}
thead th{position:sticky;top:0;z-index:2;background:#1a2431;color:var(--gold2);font-weight:600;text-align:left;padding:10px 10px;border-bottom:2px solid var(--line2);white-space:nowrap;cursor:pointer;user-select:none}
thead th:hover{background:#223040}
thead th:first-child{left:0;z-index:4}
td.name{position:sticky;left:0;z-index:1;background:var(--panel)}
tbody tr:hover td.name{background:#18222e}
tbody tr.rarity-common td.name{box-shadow:inset 3px 0 0 var(--common)}
tbody tr.rarity-rare td.name{box-shadow:inset 3px 0 0 var(--rare)}
tbody tr.rarity-epic td.name{box-shadow:inset 3px 0 0 var(--epic)}
tbody tr.rarity-legendary td.name{box-shadow:inset 3px 0 0 var(--legendary)}
thead th.sorted-asc::after{content:" ▲";color:var(--green);font-size:11px}
thead th.sorted-desc::after{content:" ▼";color:var(--red);font-size:11px}
th.num,td.num{text-align:right}
tbody td{padding:8px 10px;border-bottom:1px solid #1e2834;vertical-align:top;line-height:1.55}
tbody tr:hover td{background:#18222e}

tr.group td{background:#0f151d;color:var(--gold2);font-weight:700;letter-spacing:1px;padding:10px 12px;border-top:2px solid var(--line2);border-bottom:1px solid var(--line2)}
tr.group .g-count{color:var(--weak);font-weight:400;letter-spacing:0;margin-left:10px;font-size:12px}
td.name{min-width:150px}
td.name strong{font-size:14px}
td.name .sub{color:var(--weak);font-size:11px;margin-top:2px}
.badge{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;line-height:1.6;margin-right:5px;border:1px solid}
.rarity-badge-common{color:var(--common);border-color:var(--common)}
.rarity-badge-rare{color:var(--rare);border-color:var(--rare)}
.rarity-badge-epic{color:var(--epic);border-color:var(--epic)}
.rarity-badge-legendary{color:var(--legendary);border-color:var(--legendary)}
.line-badge{display:inline-block;padding:1px 7px;border-radius:5px;font-size:11px;border:1px solid var(--line2)}
.line-shield{color:var(--blue);border-color:var(--blue)}
.line-archer{color:var(--gold);border-color:var(--gold)}
.line-spear{color:var(--green);border-color:var(--green)}
.line-cavalry{color:var(--red);border-color:var(--red)}
.flag{display:inline-block;margin-bottom:3px;padding:1px 7px;border-radius:5px;background:#3a2c12;border:1px solid #8a6a2c;color:#f0c97a;font-size:10px;white-space:nowrap}
.muted{color:var(--weak);font-size:11px}
.poison{color:#8ed38a;font-size:11px;margin-left:3px}
td.attack{min-width:230px;color:#cfd7e2}
td.counters{min-width:170px;color:#cfd7e2}
td.unlock{min-width:240px;color:#c8d0da}
td.role{min-width:220px;color:#c8d0da}
td.skills{min-width:210px;color:#d6c7a8}
td.dmg{color:#f0c97a}
td.price{min-width:190px;color:#e6d2a2}
.tip{background:#121a24;border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:10px;padding:12px 16px;margin:14px 0;color:var(--dim);font-size:13px;line-height:1.75}
.tip b{color:var(--gold2)}
h2{font-size:20px;color:var(--gold2);margin:28px 0 12px;letter-spacing:1px}
h3{font-size:15px;color:var(--gold2);margin:0 0 8px}
.checks{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px}
.check{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;line-height:1.65}
.check.sev-高{border-left:4px solid var(--red)}
.check.sev-中高{border-left:4px solid #e39a5c}
.check.sev-中{border-left:4px solid var(--gold)}
.check.sev-低{border-left:4px solid var(--blue)}
.check.sev-提示{border-left:4px solid var(--weak)}
.check .top{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}
.sev{padding:1px 7px;border-radius:5px;font-size:11px;border:1px solid}
.sev-高 .sev{color:var(--red);border-color:var(--red)}
.sev-中高 .sev{color:#e39a5c;border-color:#e39a5c}
.sev-中 .sev{color:var(--gold);border-color:var(--gold)}
.sev-低 .sev{color:var(--blue);border-color:var(--blue)}
.sev-提示 .sev{color:var(--weak);border-color:var(--weak)}
.status{font-size:11px;color:var(--dim);border:1px dashed var(--line2);border-radius:5px;padding:1px 7px}
.check .detail{color:#d6dde6;font-size:13px;margin:6px 0}
.check .meta{font-size:12px;color:var(--dim);margin-top:6px}
.check .meta b{color:var(--gold2);font-weight:600}
.check code{background:#0c1219;border:1px solid var(--line);border-radius:4px;padding:1px 5px;color:#cfd8e4;font-size:11px;word-break:break-all}
.empty{padding:28px;text-align:center;color:var(--weak)}
footer{color:var(--weak);font-size:12px;line-height:1.8;padding:18px 4px 0;border-top:1px solid var(--line);margin-top:28px}
@media (max-width:760px){.hero h1{font-size:23px}main{padding:12px}.checks{grid-template-columns:1fr}thead th{font-size:12px}tbody td{font-size:12px}}
`;

const js = `
(function(){
  var LINES = [
    {id:'shield', name:'盾兵线', cls:'line-shield'},
    {id:'archer', name:'弓兵线', cls:'line-archer'},
    {id:'spear', name:'枪兵线', cls:'line-spear'},
    {id:'cavalry', name:'骑兵线', cls:'line-cavalry'}
  ];
  var RARITY_ORDER = {common:0, rare:1, epic:2, legendary:3};
  var LINE_ORDER = {shield:0, archer:1, spear:2, cavalry:3};
  var state = {line:'all', rarity:'all', level:'all', q:'', sortKey:null, sortDir:1};
  var tbody = document.getElementById('tbody');
  var countEl = document.getElementById('count');
  var hintEl = document.getElementById('sortHint');

  function esc(v){
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }
  function fmt(n){
    var s = String(Math.round(n||0));
    return s.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  }
  function lineName(id){ for (var i=0;i<LINES.length;i++) if (LINES[i].id===id) return LINES[i].name; return id; }
  function lineCls(id){ for (var i=0;i<LINES.length;i++) if (LINES[i].id===id) return LINES[i].cls; return ''; }

  function filtered(){
    var q = state.q.trim().toLowerCase();
    return DATA.filter(function(r){
      if (state.line !== 'all' && r.line !== state.line) return false;
      if (state.rarity !== 'all' && r.rarity !== state.rarity) return false;
      if (state.level !== 'all' && String(r.level) !== String(state.level)) return false;
      if (q){
        var hay = [r.name, r.tier, r.lineName, r.rarityName, r.attack, r.counters, r.role, r.skills].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function cmpVal(a,b,key){
    var va = a[key], vb = b[key];
    if (key === 'price'){
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return va - vb;
    }
    if (typeof va === 'number' && typeof vb === 'number') return va - vb;
    return String(va).localeCompare(String(vb), 'zh-Hans-CN');
  }

  function rowHtml(r){
    var flag = r.flag ? '<span class="flag">⚠ ' + esc(r.flag) + '</span><br>' : '';
    return '<tr class="rarity-'+r.rarity+'">' +
      '<td class="name">' + flag + '<strong>' + esc(r.name) + '</strong><div class="sub">' + esc(r.lineName) + ' · ' + esc(r.rarityName) + '</div></td>' +
      '<td>' + esc(r.tier) + '</td>' +
      '<td><span class="line-badge ' + lineCls(r.line) + '">' + esc(r.lineName) + '</span><div class="muted">' + esc(r.category) + '</div></td>' +
      '<td><span class="badge rarity-badge-'+r.rarity+'">' + esc(r.rarityName) + '</span></td>' +
      '<td class="num">' + r.level + '</td>' +
      '<td class="num">' + r.atk + '</td>' +
      '<td class="num dmg">' + r.damageMult.toFixed(2) + '</td>' +
      '<td class="num">' + r.def + '</td>' +
      '<td class="num">' + r.hp + '</td>' +
      '<td class="num">' + r.interval + '</td>' +
      '<td class="num">' + r.speed + '</td>' +
      '<td class="num">' + esc(r.rangeText) + '</td>' +
      '<td class="num">' + r.squad + '</td>' +
      '<td class="attack">' + esc(r.attack) + '</td>' +
      '<td class="counters">' + r.counters + '</td>' +
      '<td class="price">' + esc(r.priceText) + '</td>' +
      '<td>' + esc(r.maintenance) + '</td>' +
      '<td class="unlock">' + esc(r.unlock) + '</td>' +
      '<td class="role">' + esc(r.role) + '</td>' +
      '<td class="num">' + r.squadHp + '</td>' +
      '<td class="num">' + r.dpsText + '</td>' +
      '<td class="num">' + fmt(r.power) + '</td>' +
      '<td class="skills">' + r.skills + '</td>' +
    '</tr>';
  }

  function render(){
    var rows = filtered();
    var html = '';
    if (state.sortKey){
      rows.sort(function(a,b){
        var c = cmpVal(a,b,state.sortKey);
        if (c !== 0) return c * state.sortDir;
        return LINE_ORDER[a.line]-LINE_ORDER[b.line] || a.level-b.level || a.name.localeCompare(b.name);
      });
      for (var i=0;i<rows.length;i++) html += rowHtml(rows[i]);
      hintEl.textContent = '当前：全局排序（' + state.sortKey + (state.sortDir>0?' ▲':' ▼') + '），点击表头切换，按「重置排序」恢复分组';
    } else {
      rows.sort(function(a,b){
        return LINE_ORDER[a.line]-LINE_ORDER[b.line] || RARITY_ORDER[a.rarity]-RARITY_ORDER[b.rarity] || a.level-b.level || a.name.localeCompare(b.name);
      });
      var current = null, group = [];
      function flush(){
        if (!group.length) return;
        html += '<tr class="group"><td colspan="23"><span class="line-badge '+lineCls(group[0].line)+'">'+esc(lineName(group[0].line))+'</span><span class="g-count">'+group.length+' 行</span></td></tr>';
        for (var j=0;j<group.length;j++) html += rowHtml(group[j]);
        group = [];
      }
      for (var k=0;k<rows.length;k++){
        if (rows[k].line !== current){ flush(); current = rows[k].line; }
        group.push(rows[k]);
      }
      flush();
      hintEl.textContent = '当前：按兵线分组（普通→稀有→史诗→传奇，同级按 Lv1→Lv10）；点击任意表头可改为全局排序';
    }
    tbody.innerHTML = html || '<tr><td colspan="23" class="empty">没有匹配的行，清空筛选试试</td></tr>';
    countEl.textContent = '显示 ' + rows.length + ' / ' + DATA.length + ' 行';
    document.querySelectorAll('thead th[data-key]').forEach(function(th){
      th.classList.remove('sorted-asc','sorted-desc');
      if (th.getAttribute('data-key') === state.sortKey) th.classList.add(state.sortDir>0?'sorted-asc':'sorted-desc');
    });
  }

  function setFilter(key, val, btn){
    state[key] = val;
    if (btn){
      var group = btn.parentNode.querySelectorAll('.btn');
      for (var i=0;i<group.length;i++) group[i].classList.remove('on');
      btn.classList.add('on');
    }
    render();
  }

  document.querySelectorAll('[data-line]').forEach(function(btn){
    btn.addEventListener('click', function(){ setFilter('line', this.getAttribute('data-line'), this); });
  });
  document.getElementById('rarity').addEventListener('change', function(){ state.rarity = this.value; render(); });
  document.getElementById('level').addEventListener('change', function(){ state.level = this.value; render(); });
  document.getElementById('q').addEventListener('input', function(){ state.q = this.value; render(); });
  document.getElementById('reset').addEventListener('click', function(){
    state = {line:'all', rarity:'all', level:'all', q:'', sortKey:null, sortDir:1};
    document.getElementById('rarity').value = 'all';
    document.getElementById('level').value = 'all';
    document.getElementById('q').value = '';
    document.querySelectorAll('[data-line]').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-line')==='all'); });
    render();
  });
  document.querySelectorAll('thead th[data-key]').forEach(function(th){
    th.addEventListener('click', function(){
      var key = this.getAttribute('data-key');
      if (state.sortKey === key){ state.sortDir = -state.sortDir; }
      else { state.sortKey = key; state.sortDir = 1; }
      render();
    });
  });

  // 合理性检查卡片
  var box = document.getElementById('checks');
  box.innerHTML = CHECKS.map(function(c){
    return '<div class="check sev-'+c.severity+'">' +
      '<div class="top"><span class="sev">'+esc(c.severity)+'</span><span class="status">'+esc(c.status)+'</span></div>' +
      '<h3>'+esc(c.title)+'</h3>' +
      '<div class="detail">'+esc(c.detail)+'</div>' +
      '<div class="meta"><b>依据：</b><code>'+esc(c.evidence)+'</code></div>' +
      '<div class="meta"><b>影响：</b>'+esc(c.impact)+'</div>' +
      '<div class="meta"><b>建议：</b>'+esc(c.advice)+'</div>' +
    '</div>';
  }).join('');

  render();
})();
`;

const headerHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>汉末行伍征战记 · 全兵种数据对照表</title>
<style>${css}</style>
</head>
<body>
<header class="hero">
  <h1>汉末行伍征战记 · 全兵种数据对照表</h1>
  <div class="sub">从代码真实读取：<code>src/data/config.js</code>、<code>src/data/traits.js</code>、<code>src/core/units.js</code>、<code>src/core/arena.js</code>、<code>src/core/power.js</code>、<code>src/core/levels.js</code>。共 ${meta.troopCount} 个兵种 × Lv1~Lv${meta.levelMax} = ${meta.rowCount} 行；普通 ${meta.commonCount} / 特殊 ${meta.specialCount}。表格可横向滚动，点击表头按数值排序。</div>
  <div class="stats">
    <div class="stat"><b>${meta.troopCount}</b>兵种</div>
    <div class="stat"><b>${meta.rowCount}</b>等级行</div>
    <div class="stat"><b>${meta.commonCount}</b>普通 / <b>${meta.specialCount}</b>特殊</div>
    <div class="stat"><b>${meta.checkCount}</b>条合理性检查</div>
    <div class="stat">生成：${meta.generatedAt}</div>
  </div>
</header>
<main>
  <div class="toolbar">
    <span class="group-label">兵线</span>
    <button class="btn on" data-line="all">全部</button>
    <button class="btn" data-line="shield">盾兵</button>
    <button class="btn" data-line="archer">弓兵</button>
    <button class="btn" data-line="spear">枪兵</button>
    <button class="btn" data-line="cavalry">骑兵</button>
    <span class="group-label">品级</span>
    <select id="rarity">
      <option value="all">全部</option>
      <option value="common">普通</option>
      <option value="rare">稀有</option>
      <option value="epic">史诗</option>
      <option value="legendary">传奇</option>
    </select>
    <span class="group-label">等级</span>
    <select id="level">
      <option value="all">全部</option>
      <option value="1">Lv1</option><option value="2">Lv2</option><option value="3">Lv3</option>
      <option value="4">Lv4</option><option value="5">Lv5</option><option value="6">Lv6</option>
      <option value="7">Lv7</option><option value="8">Lv8</option><option value="9">Lv9</option>
      <option value="10">Lv10</option>
    </select>
    <input id="q" placeholder="搜索兵种 / 形态 / 战法">
    <button class="btn" id="reset">重置排序 / 筛选</button>
    <span class="count" id="count"></span>
  </div>
  <div class="tip" id="sortHint"></div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th data-key="name">兵种名称</th>
          <th data-key="tier">形态（等级名）</th>
          <th data-key="line">兵种类别</th>
          <th data-key="rarity">品级</th>
          <th data-key="level" class="num">等级</th>
          <th data-key="atk" class="num">攻击</th>
          <th data-key="damageMult" class="num">伤害倍率</th>
          <th data-key="def" class="num">防御</th>
          <th data-key="hp" class="num">生命</th>
          <th data-key="interval" class="num">攻速 / 间隔（秒）</th>
          <th data-key="speed" class="num">移速（格/秒）</th>
          <th data-key="range" class="num">射程（格）</th>
          <th data-key="squad" class="num">小队人数</th>
          <th data-key="attack">攻击目标 / 攻击方式</th>
          <th data-key="counters">克制 / 被克制</th>
          <th data-key="price" class="num">造价（铜钱）</th>
          <th data-key="maintenance">维护成本</th>
          <th data-key="unlock">解锁条件</th>
          <th data-key="role">一句话定位</th>
          <th data-key="squadHp" class="num">队血</th>
          <th data-key="dps" class="num">队秒伤（不含毒）</th>
          <th data-key="power" class="num">战力</th>
          <th data-key="skills">战法 / 特性</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>

  <div class="tip">
    <b>口径说明：</b>
    攻击 / 防御是单兵面板值（攻击、防御保留 1 位小数，无单位；伤害点）；生命是单兵整数 HP。
    攻速列写的是“攻击间隔（秒/次）”，越小越快；移速是“格/秒”。
    伤害倍率 = 该兵种在当前等级的常驻伤害倍率（dealtMult × atkMult）；白马义从保留 0.80，其余弓兵已恢复 1.00。
    射程是“边缘到边缘”的格数；远程兵实际走到“射程 - ${CONFIG.combat.engageGap} 格”就停下开火（所以 14 格射程显示开火 12）。
    队血 = 单兵生命 × 小队人数；队秒伤按 <code>tools/troop-table.mjs</code> 口径（面板 × 人数 × 常驻战法倍率 / 间隔，元戎按一轮连射平均），<b>不含毒伤</b>；战力按 <code>src/core/power.js</code>（队血 + 队秒伤×3 + 防御×2，<b>含毒伤</b>，不含光环/反击/冲锋/突刺/闪避）。
    造价是商城铜钱价（仅 Lv1/3/6 可买）；特殊兵种只能开箱，写“未定义”；全项目没有维护成本字段，写“未定义”。
    解锁条件写的是代码里真实可获得的路径；敌军从第几关开始出现只代表敌方，不代表玩家解锁。
  </div>

  <div class="tip">
    <b>先看结论：</b>
    ① 最需要复核的是<b>白马义从</b>（18 格远程 + 骑兵 1.05 秒间隔 + 3.8 格/秒，Lv1 队秒伤 93 对同品级元戎 35，约 2.7 倍）、<b>青州兵≈白毦兵</b>（稀有 460/87 对史诗 471/90，且青州多 2 个兵）、<b>大戟士首突刺 5 秒</b>（文案写 15 秒）。
    ② 结构性问题：全项目没有维护成本；战力公式不含光环/反击/冲锋/突刺/闪避；高品级宝箱可在第 1/20/50 关提前掉出稀有/史诗/传奇，而敌军 101/201/301 关才登场。
    ③ 设计意图型偏离（待确认）：大戟士 Lv10 队秒伤 5.42× 枪兵（传奇基准 2.85×）、藤甲兵 0.91× 盾兵但减伤 30~60%、虎豹骑面板低于传奇基准但靠 4× 冲锋/攻速光环。
  </div>

  <h2>数据合理性检查</h2>
  <div class="checks" id="checks"></div>

  <footer>
    生成脚本：<code>node tools/gen-troop-data.mjs</code>（输出 <code>docs/troop_data_table.html</code>）。<br>
    数据源：<code>src/data/config.js</code>（兵种基础值 / 成长 / 品级倍率 / 射程 / 移速 / 间隔 / 宝箱 / 商城 / 关卡）、
    <code>src/data/traits.js</code>（战法与战斗倍率）、<code>src/core/units.js</code>（等级推导）、
    <code>src/core/arena.js</code>（小队人数 / 索敌 / 战法落地）、<code>src/core/power.js</code>（战力口径）、
    <code>src/core/levels.js</code>（商城价格 / 首通奖励）。<br>
    “已核实”= 可直接从代码或数值计算复现；“待确认”= 数值偏离明显但可能是有意设计，需要策划确认。
  </footer>
</main>
<script>
var DATA = ${JSON.stringify(rows).replace(/</g, '\\u003c')};
var CHECKS = ${JSON.stringify(CHECKS).replace(/</g, '\\u003c')};
${js}
</script>
</body>
</html>
`;

const outDir = path.resolve('docs');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'troop_data_table.html');
fs.writeFileSync(outFile, headerHtml, 'utf8');
console.log(`已生成 ${path.relative(process.cwd(), outFile)}（${meta.troopCount} 兵种 / ${meta.rowCount} 行 / ${meta.checkCount} 条检查）`);
