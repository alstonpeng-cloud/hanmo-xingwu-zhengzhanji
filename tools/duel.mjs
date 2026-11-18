// 平衡对局检查：跑真实斗技场 AI，验证「品级 / 等级」之间的强弱关系
// 用法：node tools/duel.mjs
// 口径：单兵战力用「血量 × 攻击 ÷ 间隔」比较（不含克制、地形、随机站位）；
// 对局用 1 支小队打 1 支小队，分「同人数」和「实际编制」两套。
import { CONFIG } from '../src/data/config.js';
import { statsFor, baseTroopOf } from '../src/core/units.js';
import { simulateArena } from '../src/core/arena.js';
import { combatTraits } from '../src/data/traits.js';
import { mulberry32 } from '../src/core/rng.js';

// 临时改编制，保证两边人数一致（只用于「同人数」对局）
function withSquad(troopIds, n, fn) {
  const saved = {};
  for (const id of troopIds) {
    saved[id] = {
      size: CONFIG.combat.squadSize[id],
      max: CONFIG.combat.squadMax[id],
      growth: CONFIG.combat.squadGrowth[id],
    };
  }
  for (const id of troopIds) {
    CONFIG.combat.squadSize[id] = n;
    CONFIG.combat.squadMax[id] = n;
    CONFIG.combat.squadGrowth[id] = [];
  }
  try { return fn(); } finally {
    for (const id of troopIds) {
      CONFIG.combat.squadSize[id] = saved[id].size;
      CONFIG.combat.squadMax[id] = saved[id].max;
      CONFIG.combat.squadGrowth[id] = saved[id].growth;
    }
  }
}

function duel(a, la, b, lb, sameCount = true, count = 4) {
  const run = () => {
    let win = 0; let lose = 0; let draw = 0; let t = 0;
    for (let s = 1; s <= 5; s++) {
      const r = simulateArena(
        [{ troop: a, level: la, col: 2, row: 2 }],
        [{ troop: b, level: lb, col: 2, row: 2 }],
        mulberry32(s * 17 + 3),
      );
      if (r.winner === 'player') win++;
      else if (r.winner === 'enemy') lose++;
      else draw++;
      t += r.time;
    }
    return { win, lose, draw, time: t / 5 };
  };
  if (sameCount) return withSquad([a, b], count, run);
  return run();
}

function statPower(troopId, level) {
  const s = statsFor(troopId, level);
  const tr = combatTraits(troopId, level) || {};
  const interval = (CONFIG.combat.intervals[troopId] || 1.8) * (tr.intervalMult || 1);
  const atkMod = tr.dealtMult || 1;
  // 元戎连射按「每发伤害×发数 / 一轮总时长」折算成等效攻击
  let effAtk = s.atk * atkMod * (tr.atkMult || 1);
  if (tr.volley) {
    const { burst, shotInterval, reload, dmgMult } = tr.volley;
    effAtk *= (burst * (dmgMult || 1)) / (burst * shotInterval + reload) * interval;
  }
  return { hp: s.hp, atk: effAtk, def: s.def, interval, power: s.hp * (effAtk / interval) };
}

const pad = (v, n) => String(v).padEnd(n);
const P = ['daji', 'xianzhen', 'wudang', 'huhao'];
const E = ['baier', 'tengjia', 'yuanyong', 'baima'];
const R = ['qingzhou', 'xiandeng', 'qingzhu', 'youzhou'];
const C = ['spear', 'shield', 'archer', 'cavalry'];
const LINE_NAME = { daji: '枪', xianzhen: '盾', wudang: '弓', huhao: '骑' };
const LABEL = {
  daji: '大戟士', xianzhen: '陷阵营', wudang: '无当飞军', huhao: '虎豹骑',
  baier: '白毦兵', tengjia: '藤甲兵', yuanyong: '元戎弩士', baima: '白马义从',
  qingzhou: '青州兵', xiandeng: '先登死士', qingzhu: '丹阳青竹弓手', youzhou: '幽州突骑',
  spear: '枪兵', shield: '盾兵', archer: '弓兵', cavalry: '骑兵',
};

console.log('== 单兵等效等级（血量 × 有效攻击，含战法常驻倍率） ==');
for (let i = 0; i < P.length; i++) {
  const leg = statPower(P[i], 1).power;
  const line = LINE_NAME[P[i]];
  const match = { epic: 0, rare: 0, common: 0 };
  for (const [list, key] of [[E, 'epic'], [R, 'rare'], [C, 'common']]) {
    let best = null;
    for (let lv = 1; lv <= 10; lv++) {
      const p = statPower(list[i], lv).power;
      if (best === null || Math.abs(p - leg) < Math.abs(best.power - leg)) best = { lv, power: p };
    }
    match[key] = best.lv;
  }
  console.log(`${pad(LABEL[P[i]], 10)}（${line}）Lv1 战力 ${Math.round(leg)}  ≈  史诗 Lv${match.epic} / 稀有 Lv${match.rare} / 普通 Lv${match.common}`);
}

console.log('\n== 1 级传奇 vs 3 级史诗（同人数 4） ==');
for (let i = 0; i < P.length; i++) {
  const r = duel(P[i], 1, E[i], 3, true, 4);
  console.log(`${pad(LABEL[P[i]], 10)} Lv1 vs ${pad(LABEL[E[i]], 10)} Lv3  胜 ${r.win}/5  负 ${r.lose}  平 ${r.draw}  平均 ${r.time.toFixed(1)}s`);
}

console.log('\n== 1 级传奇 vs 5~7 级稀有（同人数 4） ==');
for (let i = 0; i < P.length; i++) {
  for (const lv of [5, 7]) {
    const r = duel(P[i], 1, R[i], lv, true, 4);
    console.log(`${pad(LABEL[P[i]], 10)} Lv1 vs ${pad(LABEL[R[i]], 10)} Lv${lv}  胜 ${r.win}/5  负 ${r.lose}  平 ${r.draw}`);
  }
}

console.log('\n== 1 级传奇 vs 7~8 级普通（同人数 4） ==');
for (let i = 0; i < P.length; i++) {
  for (const lv of [7, 8]) {
    const r = duel(P[i], 1, C[i], lv, true, 4);
    console.log(`${pad(LABEL[P[i]], 10)} Lv1 vs ${pad(LABEL[C[i]], 10)} Lv${lv}  胜 ${r.win}/5  负 ${r.lose}  平 ${r.draw}`);
  }
}

console.log('\n== 稀有 vs 史诗（Lv1 同人数 4）：史诗应明显更强 ==');
for (let i = 0; i < R.length; i++) {
  const r = duel(R[i], 1, E[i], 1, true, 4);
  console.log(`${pad(LABEL[R[i]], 10)} Lv1 vs ${pad(LABEL[E[i]], 10)} Lv1  胜 ${r.win}/5  负 ${r.lose}  平 ${r.draw}`);
}

console.log('\n== 实际编制（不改人数）：1 级传奇 vs 5/7 级稀有 ==');
for (let i = 0; i < P.length; i++) {
  const r5 = duel(P[i], 1, R[i], 5, false);
  const r7 = duel(P[i], 1, R[i], 7, false);
  console.log(`${pad(LABEL[P[i]], 10)} Lv1 vs ${pad(LABEL[R[i]], 10)}：Lv5 胜 ${r5.win}/5（负 ${r5.lose}）/ Lv7 胜 ${r7.win}/5（负 ${r7.lose}）`);
}

console.log('\n== 实际编制：1 级传奇 vs 3 级史诗 ==');
for (let i = 0; i < P.length; i++) {
  const r = duel(P[i], 1, E[i], 3, false);
  console.log(`${pad(LABEL[P[i]], 10)} Lv1 vs ${pad(LABEL[E[i]], 10)} Lv3  胜 ${r.win}/5  负 ${r.lose}`);
}
