// 数值模拟：用"贪心玩家"自动跑关卡曲线，检查能不能打得过。
// 默认（抽样）：1 个 seed + 每 20 关抽 1 关 + 里程碑（城池/章节/难度档/BOSS 档），
// 未抽到的关按"已通关"结算首通奖励，只跑抽样战斗，几分钟内跑完 2600 关。
// 全量：node tools/sim.mjs --full（默认 8 个 seed × 每关都打，耗时以小时计）
// 其他：--seed=N / --seeds=1,2 / --stride=N / --cap=N / --from=N；兼容旧用法 node tools/sim.mjs 1 300
// --from=N 从第 N 关起跑（默认抽样卡在前 200 关的经济墙，用它验证 800 关后的兵书 / 器械）
// 经济模型和游戏一致：铜钱只给首通；每关首通按轮换给宝箱；挂机收益默认 1 小时/场
// （SIM_IDLE_HOURS=0 是严格下界，=8 是每次战斗都等满 8 小时封顶）
// 用法：node tools/sim.mjs [--full] [--seed=N] [--seeds=1,2] [--stride=N] [--cap=N]
import { CONFIG } from '../src/data/config.js';
import { createNewState } from '../src/core/save.js';
import { levelDef, rewardFor, rosterSlots, powerOf, shopPrice, buyUnit, enemyLevelFor } from '../src/core/levels.js';
import { baseTroopOf } from '../src/core/units.js';
import { chestsForLevel, chestTypes, addChest, chestCount, chestTotal, openChest } from '../src/core/chests.js';
import { idleRatePerHour } from '../src/core/idle.js';
import { simulateArena } from '../src/core/arena.js';
import { autoPlaceSquads } from '../src/core/formation.js';
import { mergeUnits, maxLevel } from '../src/core/merge.js';
import { noteClear } from '../src/core/daily.js';
import { mulberry32 } from '../src/core/rng.js';
import {
  engineUnlocked, engineChoice, engineTier, setEngineChoice, upgradeEngine, engineUpgradeCost,
} from '../src/core/siege.js';
import {
  bookUnlocked, bookLevel, bookUpgradeCost, upgradeBook, playerBookScales,
} from '../src/core/books.js';

const BASE_LINES = ['shield', 'spear', 'cavalry', 'archer'];

// 玩家：挑 25 个最强单位上阵，但保持前排 / 后排平衡（近战最多 15 个，弓兵最多 10 个，
// 近战不够时弓兵补位），再按「近战前排、弓兵后排」自动布阵
function pickSquads(state) {
  const sorted = [...state.units].sort((a, b) => powerOf(b) - powerOf(a));
  const melee = sorted.filter((u) => baseTroopOf(u.troop) !== 'archer');
  const ranged = sorted.filter((u) => baseTroopOf(u.troop) === 'archer');
  const front = melee.slice(0, 15);
  const back = ranged.slice(0, 10);
  const picked = [...front, ...back]
    .sort((a, b) => powerOf(b) - powerOf(a))
    .slice(0, 25);
  return autoPlaceSquads(picked.map((u) => ({ uid: u.id, troop: u.troop, level: u.level })));
}

function freeSlots(state) {
  return rosterSlots(state.maxCleared).unlocked - state.units.length;
}

// 花钱：把兵营铺满（宽阵型 = 斗技场里更多小队），优先补「最缺的那条兵种线」凑出均衡阵容，
// 四线都够多之后再往「数量最多」的兵种上堆，最快凑出同级配对
function spendCoins(state) {
  let bought = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (freeSlots(state) <= 0) break;
    const lineCounts = { shield: 0, spear: 0, cavalry: 0, archer: 0 };
    const troopCounts = {};
    state.units.forEach((u) => {
      const line = baseTroopOf(u.troop);
      lineCounts[line] = (lineCounts[line] || 0) + 1;
      troopCounts[u.troop] = (troopCounts[u.troop] || 0) + 1;
    });
    const thinLine = [...BASE_LINES].sort((a, b) => lineCounts[a] - lineCounts[b])[0];
    // 缺线不足 8 个时先补线，否则买数量最多的兵种凑合成
    const trooped = state.units.length;
    const troop = trooped < 25 || lineCounts[thinLine] >= 8
      ? CONFIG.troops.map((t) => t.id)
        .sort((a, b) => (troopCounts[b] || 0) - (troopCounts[a] || 0)
          || CONFIG.shop.basePrice[a] - CONFIG.shop.basePrice[b])[0]
      : CONFIG.troops
        .filter((t) => baseTroopOf(t.id) === thinLine)
        .map((t) => t.id)
        .sort((a, b) => CONFIG.shop.basePrice[a] - CONFIG.shop.basePrice[b])[0];
    if (state.coins < shopPrice(troop, 1)) break;
    if (!buyUnit(state, troop, 1).ok) break;
    bought++;
  }
  return bought;
}

// 开箱：兵营满就留着不开（先合成腾格子）；常规箱和特殊箱按顺序开
// 直接用游戏里的 openChest，保证和界面完全是同一套掉落 / 容量规则
const OPEN_ORDER = chestTypes({ includeLocked: false }).map((t) => t.id);

function openChests(state, rng) {
  let opened = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (freeSlots(state) <= 0) break;
    const id = OPEN_ORDER.find((k) => chestCount(state, k) > 0);
    if (!id) break;
    const r = openChest(state, id, rng);
    if (!r.ok) break;
    opened++;
  }
  return opened;
}

// 日常维护：开箱 + 合成 + 用铜钱补兵，反复滚到「合不动、也买不起」为止
// 布阵上限是 25 格，所以只把「多出 25 个」的部分合成掉：低于 25 个时继续堆数量，
// 否则会出现「一堆兵全合到 1 个 7 级、其余格子空着」的极端阵容。
const KEEP_UNITS = CONFIG.formation.maxUnits;

// 只合「多出来」的部分：合完还要留住 KEEP_UNITS 个单位，保证 5×5 布阵始终能站满
function mergeExcess(state, keep) {
  let merges = 0;
  for (let guard = 0; guard < 300; guard++) {
    if (state.units.length - 1 < keep) break;
    let pair = null;
    for (let level = 1; level < maxLevel() && !pair; level++) {
      for (const t of CONFIG.troops) {
        const group = state.units.filter((u) => u.troop === t.id && u.level === level);
        if (group.length >= 2) {
          pair = [group[0], group[1]];
          break;
        }
      }
    }
    if (!pair) break;
    mergeUnits(state, pair[0].id, pair[1].id);
    merges++;
  }
  return merges;
}

function upkeep(state, rng) {
  for (let guard = 0; guard < 400; guard++) {
    const opened = openChests(state, rng);
    const merges = mergeExcess(state, KEEP_UNITS);
    const bought = spendCoins(state);
    if (!opened && !merges && !bought) break;
  }
  spendMeta(state);
}

// 器械 / 兵书：和补兵抢同一笔钱，所以只花「当前铜钱的一半」，
// 兵书三卷按等级最低的先买（拉平），器械固定选霹雳车并把档位往上顶。
function spendMeta(state) {
  let budget = Math.floor((Number(state.coins) || 0) * 0.5);
  if (budget <= 0) return 0;
  let spent = 0;
  if (!engineChoice(state) && engineUnlocked(state, 'thunder')) {
    setEngineChoice(state, 'thunder', 'center');
  }
  const choice = engineChoice(state);
  if (choice) {
    for (let guard = 0; guard < 20; guard++) {
      const tier = engineTier(state, choice.id);
      const cost = engineUpgradeCost(choice.id, tier);
      if (!Number.isFinite(cost) || cost > budget) break;
      if (!upgradeEngine(state, choice.id).ok) break;
      budget -= cost;
      spent += cost;
    }
  }
  if (bookUnlocked(state)) {
    for (let guard = 0; guard < 60; guard++) {
      const target = CONFIG.books.tracks
        .slice()
        .sort((a, b) => bookLevel(state, a.id) - bookLevel(state, b.id))[0];
      const lv = bookLevel(state, target.id);
      if (lv >= CONFIG.books.maxLevel) break;
      const cost = bookUpgradeCost(target.id, lv);
      if (cost > budget) break;
      if (!upgradeBook(state, target.id).ok) break;
      budget -= cost;
      spent += cost;
    }
  }
  return spent;
}

// 抽样关卡集：新手 1~10 逐关 + 每 stride 关 + 卡点/难度档/BOSS 档 + 城池/章节首尾 + 终章
function buildSampleSet(stride) {
  const total = CONFIG.levelGen.total;
  const set = new Set();
  for (let n = 1; n <= Math.min(10, total); n++) set.add(n);
  for (let n = stride; n <= total; n += stride) set.add(n);
  for (const cp of CONFIG.levelGen.difficulty.checkpoints) set.add(cp.n);
  for (const t of CONFIG.levelGen.difficulty.tiers) {
    set.add(t.from);
    set.add(Math.min(total, t.from + Math.max(0, t.ramp - 1)));
  }
  set.add(CONFIG.levelGen.heroBoss.from);
  for (const c of CONFIG.levelGen.heroBoss.countTiers) set.add(c.from);
  for (const chapter of CONFIG.chapters) {
    for (const city of chapter.cities) {
      set.add(city.from);
      set.add(city.to);
    }
  }
  set.add(total);
  return new Set([...set].filter((n) => n >= 1 && n <= total));
}

// 未抽到的关：不打战斗，按首通结算铜钱/宝箱/日常，并折算 1 小时挂机收益
function autoClear(state, stage, idleHours) {
  if (idleHours > 0) state.coins += Math.floor(idleRatePerHour(state.maxCleared) * idleHours);
  const firstClear = stage > state.maxCleared;
  state.coins += rewardFor(stage, firstClear);
  state.maxCleared = Math.max(state.maxCleared, stage);
  if (firstClear) {
    for (const id of chestsForLevel(stage)) addChest(state, id, 1);
    noteClear(state);
  }
}

function run(seed, opts) {
  const { battleCap, sampleSet, idleHours } = opts;
  const rng = mulberry32(seed);
  const state = createNewState();
  const from = Math.max(1, Math.floor(opts.from || 1));
  if (from > 1) bootstrap(state, from);
  let stage = from;
  let battles = 0;
  let skipped = from - 1;
  let totalTime = 0;
  let lastWin = 0;
  let stalled = false;
  const marks = [];
  let lastStage = 0;
  // 连续 120 场都打不过就判定「卡死」（真实玩家还能靠挂机攒钱，这里直接报出来）
  const STALL_LIMIT = 120;

  while (stage <= CONFIG.levelGen.total && battles < battleCap) {
    if (battles - lastWin >= STALL_LIMIT) {
      stalled = true;
      break;
    }
    // 抽样模式：跳过未抽中的关，只结算奖励，不打战斗
    if (sampleSet && !sampleSet.has(stage)) {
      autoClear(state, stage, idleHours);
      skipped++;
      stage++;
      // 与全量逐关一致：每关结算后都做一次维护（开箱/合成/买兵），避免经济节奏漂移
      upkeep(state, rng);
      continue;
    }
    battles++;
    const squads = pickSquads(state);
    // 兵书加成挂到玩家小兵上（和战斗页一致：攻 / 血 / 防各乘一次）
    const bookScales = playerBookScales(state);
    const battleSquads = bookScales ? squads.map((s) => ({ ...s, ...bookScales })) : squads;
    const def = levelDef(stage);
    const result = simulateArena(battleSquads, def.enemies, rng, 200, {
      stage,
      playerEngine: engineChoice(state),
      enemyEngine: def.engine,
    });
    totalTime += result.time;

    // 挂机收益：SIM_IDLE_HOURS 小时/场（默认 1 小时，严格下界用 0）
    if (idleHours > 0) state.coins += Math.floor(idleRatePerHour(state.maxCleared) * idleHours);

    if (result.winner === 'player') {
      lastWin = battles;
      const firstClear = stage > state.maxCleared;
      state.coins += rewardFor(stage, firstClear);
      state.maxCleared = Math.max(state.maxCleared, stage);
      if (firstClear) {
        // 首通宝箱和游戏一致：常规轮换 + 城池 / 章节里程碑特殊箱
        for (const id of chestsForLevel(stage)) addChest(state, id, 1);
        noteClear(state);
      }
      stage++;
      upkeep(state, rng);
      const markDue = sampleSet
        ? true
        : stage % 5 === 1 && stage !== lastStage;
      if (markDue && stage !== lastStage) {
        marks.push({
          stage: stage - 1,
          battles,
          coins: Math.round(state.coins),
          chests: chestTotal(state),
          lv: avgLevel(state),
          maxLv: Math.max(...state.units.map((u) => u.level)),
          units: state.units.length,
          power: Math.round(squads.reduce((s, q) => s + powerOf({ troop: q.troop, level: q.level }), 0)),
          seconds: Math.round(totalTime / battles * 10) / 10,
          engine: engineTier(state, 'thunder'),
          books: CONFIG.books.tracks.reduce((s, t) => s + bookLevel(state, t.id), 0),
        });
        lastStage = stage;
      }
    } else {
      // 打不过：不合钱、不刷关，只做合成/开箱/买兵，再挑战同一关
      upkeep(state, rng);
    }
    if (battles % 50 === 0) upkeep(state, rng);
  }

  return {
    seed, stalled, reached: Math.min(stage - 1, CONFIG.levelGen.total), battles, skipped, state, marks,
    avgSeconds: totalTime / Math.max(1, battles),
  };
}

// --from N：从第 N 关起跑。默认抽样会卡在前 200 关的经济墙（见 README），
// 800 关后的兵书 / 器械没法直接验证，所以这里按「通到 N-1 关的预期进度」造一份状态：
// 30 个兵、等级对标 enemyLevelFor(N)；器械档位按 350→800 关线性折算；兵书按 800→2000 关折算。
// 这是估算值，不是真实玩家存档 —— 只用来回答「800 关后这套系统在数值上成不成立」。
function bootstrap(state, from) {
  // 兵种等级在 Lv10 封顶，后期成长靠兵书 / 器械；所以起跑档按「等级已在cap附近」造：
  // 30 个兵、等级 enemyLevelFor(N)+3（钳到 10），再上下浮动 0~2 级。
  const lv = Math.max(1, Math.min(CONFIG.merge.maxLevel, Math.round(enemyLevelFor(from)) + 3));
  const ids = CONFIG.troops.map((t) => t.id);
  state.units = [];
  for (let i = 0; i < 30; i++) {
    state.units.push({ id: `boot${i}`, troop: ids[i % ids.length], level: Math.max(1, lv - (i % 3)) });
  }
  state.maxCleared = from - 1;
  const tier = Math.max(1, Math.min(CONFIG.siege.maxLevel,
    1 + Math.floor(((from - 350) * (CONFIG.siege.maxLevel - 1)) / 450)));
  state.siege = { tiers: { thunder: tier }, choice: { id: 'thunder', tier, stance: 'center' } };
  const bookLv = Math.max(0, Math.min(CONFIG.books.maxLevel,
    Math.round(((from - 800) / 1200) * CONFIG.books.maxLevel)));
  state.books = { atk: bookLv, hp: bookLv, def: bookLv };
}

function avgLevel(state) {
  if (!state.units.length) return 0;
  return Math.round((state.units.reduce((s, u) => s + u.level, 0) / state.units.length) * 10) / 10;
}

function parseArgs(argv) {
  const opts = { mode: 'sample', seeds: [1], stride: 20, cap: 8000, from: 1 };
  const positional = [];
  let seedsSet = false;
  for (const arg of argv) {
    if (arg === '--full') {
      opts.mode = 'full';
      opts.stride = 1;
    } else if (arg.startsWith('--seed=')) {
      opts.seeds = [Number(arg.slice(7))];
      seedsSet = true;
    } else if (arg.startsWith('--seeds=')) {
      opts.seeds = arg.slice(8).split(',').map(Number);
      seedsSet = true;
    } else if (arg.startsWith('--stride=')) {
      opts.stride = Math.max(1, Math.floor(Number(arg.slice(9))) || 20);
    } else if (arg.startsWith('--cap=')) {
      opts.cap = Math.max(1, Math.floor(Number(arg.slice(6))) || 8000);
    } else if (arg.startsWith('--from=')) {
      opts.from = Math.max(1, Math.floor(Number(arg.slice(7))) || 1);
    } else if (arg.startsWith('--')) {
      console.error(`未知参数：${arg}`);
      console.error('用法：node tools/sim.mjs [--full] [--seed=N] [--seeds=1,2] [--stride=N] [--cap=N] [--from=N]');
      process.exit(1);
    } else {
      positional.push(arg);
    }
  }
  // 兼容旧用法：node tools/sim.mjs 1 300 = seed 1、cap 300、全量逐关
  if (positional.length) {
    opts.mode = 'full';
    opts.stride = 1;
    opts.seeds = [Number(positional[0])];
    if (positional[1]) opts.cap = Math.max(1, Math.floor(Number(positional[1])) || 8000);
    seedsSet = true;
  }
  if (opts.mode === 'full' && !seedsSet) opts.seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  opts.seeds = opts.seeds.filter(Number.isFinite);
  if (!opts.seeds.length) opts.seeds = [1];
  return opts;
}

function compressStages(list) {
  const parts = [];
  let start = null;
  let prev = null;
  for (const n of list) {
    if (start === null) { start = prev = n; continue; }
    if (n === prev + 1) { prev = n; continue; }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = n;
  }
  if (start !== null) parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(',');
}

// 表格超过 30 行时按步长抽稀，保留首尾
function thin(rows, max = 30) {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  return rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
}

const opts = parseArgs(process.argv.slice(2));
const idleHours = Number(process.env.SIM_IDLE_HOURS ?? 1);
const sampleSet = opts.mode === 'full' ? null : buildSampleSet(opts.stride);
if (sampleSet) {
  console.log(`mode=sample seeds=${opts.seeds.join(',')} stride=${opts.stride} 采样关 ${sampleSet.size}/${CONFIG.levelGen.total} cap=${opts.cap}${opts.from > 1 ? ` 起跑关=${opts.from}` : ''}`);
} else {
  console.log(`mode=full seeds=${opts.seeds.join(',')} stride=1 cap=${opts.cap}${opts.from > 1 ? ` 起跑关=${opts.from}` : ''}`);
}

for (const seed of opts.seeds) {
  const r = run(seed, { battleCap: opts.cap, sampleSet, idleHours, from: opts.from });
  const coins = Math.round(r.state.coins);
  if (!sampleSet) {
    console.log(
      `seed=${seed} ${r.stalled ? '卡在' : '通关到'}第 ${r.reached} 关 | 战斗 ${r.battles} 场 | 单位 ${r.state.units.length} 个 | 平均等级 ${avgLevel(r.state)} | 器械 Lv${engineTier(r.state, 'thunder')} | 兵书 ${CONFIG.books.tracks.map((t) => bookLevel(r.state, t.id)).join('/')} | 单场 ${r.avgSeconds.toFixed(1)}s | 剩余铜钱 ${coins}`
    );
    if (opts.seeds.length === 1) console.table(r.marks);
  } else {
    console.log(
      `seed=${seed} ${r.stalled ? '卡在' : '抽样通关到'}第 ${r.reached} 关 | 跳过 ${r.skipped} 关 | 实战 ${r.battles} 场 | 单位 ${r.state.units.length} 个 | 平均等级 ${avgLevel(r.state)} | 器械 Lv${engineTier(r.state, 'thunder')} | 兵书 ${CONFIG.books.tracks.map((t) => bookLevel(r.state, t.id)).join('/')} | 单场 ${r.avgSeconds.toFixed(1)}s | 剩余铜钱 ${coins}`
    );
    if (opts.seeds.length === 1) {
      console.log(`采样关：${compressStages([...sampleSet])}`);
      console.table(thin(r.marks));
    }
  }
  if (opts.seeds.length === 1) {
    console.table(
      [...r.state.units]
        .sort((a, b) => b.level - a.level)
        .map((u) => ({ 兵种: u.troop, 等级: u.level }))
    );
  }
}
