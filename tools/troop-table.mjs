// 兵种数据汇总表：把 CONFIG 里的兵种属性 + 战法倍率算成一张可直接对照的表
// 用法：node tools/troop-table.mjs
import { CONFIG } from '../src/data/config.js';
import { statsFor, baseTroopOf, rarityOf, unitName } from '../src/core/units.js';
import { squadSoldierCount } from '../src/core/arena.js';
import { combatTraits, TROOP_TRAITS } from '../src/data/traits.js';
import { troopPower } from '../src/core/power.js';

const RARITY = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇' };
const LINES = { shield: '盾', archer: '弓', spear: '枪', cavalry: '骑' };

// 战法里影响「面板伤害」的倍率（不含条件增伤）
function baseDmgMod(troopId, lv) {
  const tr = combatTraits(troopId, lv);
  if (!tr) return 1;
  return (tr.dealtMult || 1) * (tr.atkMult || 1);
}
function intervalMod(troopId, lv) {
  const tr = combatTraits(troopId, lv);
  return (tr && tr.intervalMult) || 1;
}
// 元戎弩士：连射把「每发伤害 / 一轮总时长」折算成等效攻击（1 = 面板节奏）
function volleyFactor(troopId, lv) {
  const tr = combatTraits(troopId, lv);
  if (!tr || !tr.volley) return 1;
  const v = tr.volley;
  // burst 可能是固定值，也可能按等级跳点（元戎：Lv1~3=2 / Lv4~7=3 / Lv8+=4）
  let burst = v.burst;
  if (burst == null) {
    burst = 1;
    for (const [at, val] of v.tier || []) if (lv >= at) burst = val;
  }
  const shotsPerSec = burst / (burst * v.shotInterval + v.reload);
  const baseInterval = CONFIG.combat.intervals[troopId] * ((tr && tr.intervalMult) || 1);
  return shotsPerSec * baseInterval * (v.dmgMult || 1);
}

function row(id) {
  const t = CONFIG.troops.find((x) => x.id === id);
  const line = baseTroopOf(id);
  const range = (() => {
    const tr = combatTraits(id, 10);
    return (tr && tr.range) || CONFIG.combat.ranges[id];
  })();
  const squad1 = squadSoldierCount(id, 1);
  const squad10 = squadSoldierCount(id, 10);
  const s1 = statsFor(id, 1);
  const s5 = statsFor(id, 5);
  const s10 = statsFor(id, 10);
  const dps1 = s1.atk / CONFIG.combat.intervals[id] * squad1 * baseDmgMod(id, 1) / intervalMod(id, 1) * volleyFactor(id, 1);
  const dps10 = s10.atk / CONFIG.combat.intervals[id] * squad10 * baseDmgMod(id, 10) / intervalMod(id, 10) * volleyFactor(id, 10);
  return {
    id, name: t.name, line: LINES[line], rarity: RARITY[rarityOf(id)],
    hp1: s1.hp, atk1: s1.atk, def1: s1.def,
    hp5: s5.hp, atk5: s5.atk,
    hp10: s10.hp, atk10: s10.atk, def10: s10.def,
    range, speed: CONFIG.combat.speeds[id], interval: CONFIG.combat.intervals[id],
    squad1, squad10,
    squadHp1: s1.hp * squad1, squadHp10: s10.hp * squad10,
    dps1: Math.round(dps1), dps10: Math.round(dps10),
    pow1: troopPower(id, 1), pow10: troopPower(id, 10),
    skills: (TROOP_TRAITS[id]?.skills || []).map((k) => k.name).join(' / ') || '—',
    note: TROOP_TRAITS[id]?.note || '',
  };
}

const ids = CONFIG.troops.map((t) => t.id);
const rows = ids.map(row);
const common = rows.filter((r) => r.rarity === '普通');
const special = rows.filter((r) => r.rarity !== '普通');

const pad = (v, n) => String(v).padEnd(n);
const lpad = (v, n) => String(v).padStart(n);
function printTable(list, title) {
  console.log(`\n### ${title}`);
  console.log([
    pad('id', 10), pad('兵种', 12), '线', '品级', lpad('Lv1血', 5), lpad('Lv1攻', 5), lpad('Lv1防', 4),
    lpad('Lv10血', 6), lpad('Lv10攻', 6), lpad('Lv10防', 5),
    lpad('射程', 4), lpad('移速', 4), lpad('间隔', 4), lpad('兵Lv1', 5), lpad('兵Lv10', 5),
    lpad('队血Lv1', 7), lpad('队血Lv10', 7), lpad('队秒伤Lv1', 9), lpad('队秒伤Lv10', 9),
    lpad('战力Lv1', 8), lpad('战力Lv10', 9), ' 战法',
  ].join(' '));
  for (const r of list) {
    console.log([
      pad(r.id, 10), pad(r.name, 12), r.line, r.rarity, lpad(r.hp1, 5), lpad(r.atk1, 5), lpad(r.def1, 4),
      lpad(r.hp10, 6), lpad(r.atk10, 6), lpad(r.def10, 5),
      lpad(r.range, 4), lpad(r.speed, 4), lpad(r.interval, 4), lpad(r.squad1, 5), lpad(r.squad10, 5),
      lpad(r.squadHp1, 7), lpad(r.squadHp10, 7), lpad(r.dps1, 9), lpad(r.dps10, 9),
      lpad(r.pow1, 8), lpad(r.pow10, 9), ` ${r.skills}`,
    ].join(' '));
  }
}

console.log('兵种数据汇总（成长率统一：血 +28%/级、攻 +25%/级、防 +18%/级；Lv<=10）');
console.log('品级倍率：稀有 ×1.35 / 史诗 ×1.85 / 传奇 ×2.85（只放大 1 级基础值）');
console.log('克制环：盾→弓→枪→骑→盾（克制方 ×1.1，被克制 ×0.9）');
console.log('队秒伤已按战法常驻倍率折算（含元戎连射的平均出手节奏）');
console.log('战力 = 小队总血量 + 队秒伤×3 + 防御换算×2（和布阵页「我方/敌方战力」同一口径）');
printTable(common, '普通兵种（4）');
printTable(special, '特殊兵种（12）');

// 同兵种线的横向对比：以普通兵种为 1，看特殊兵种的小队血量 / 秒伤倍率
console.log('\n### 同一兵种线对比（以该线普通兵为 1.00）');
for (const line of ['shield', 'archer', 'spear', 'cavalry']) {
  const base = rows.find((r) => r.id === line);
  console.log(`\n${LINES[line]}兵线（基准：${base.name}）`);
  for (const r of rows.filter((x) => x.id === base.id || x.line === LINES[line])) {
    console.log([
      pad(r.name, 12), pad(r.rarity, 4),
      `队血Lv1 ×${(r.squadHp1 / base.squadHp1).toFixed(2)}`,
      `队血Lv10 ×${(r.squadHp10 / base.squadHp10).toFixed(2)}`,
      `队秒伤Lv1 ×${(r.dps1 / base.dps1).toFixed(2)}`,
      `队秒伤Lv10 ×${(r.dps10 / base.dps10).toFixed(2)}`,
    ].join('  '));
  }
}

console.log('\n### 战法一览');
for (const t of ids) {
  const skills = TROOP_TRAITS[t];
  if (!skills) continue;
  console.log(`- ${t}：${skills.skills.map((s) => `${s.name}（${s.type}）`).join(' / ')}${skills.note ? ` ｜ ${skills.note}` : ''}`);
}

console.log('\n### 等级命名（Lv1 / Lv5 / Lv10）');
for (const t of ids) {
  console.log(`${pad(t, 10)} ${unitName(t, 1)} / ${unitName(t, 5)} / ${unitName(t, 10)}`);
}
