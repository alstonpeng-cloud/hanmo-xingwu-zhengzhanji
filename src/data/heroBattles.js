// 英雄战：主线 250 关后开放的 Boss 挑战，共 150 关。
// 前 12 关为「体验序章」（6 史诗 + 6 传奇逐个登场），13~149 关按曲线逐关递增强度，
// 第 150 关为最终战：刘备 / 关羽 / 张飞三英雄同时登场。
// 每 10 关首通奖励 1 张招募券（本模式是招募券的额外来源；主来源为 200 关后主线每 10 关 1 张）。
import { CONFIG } from './config.js';
import { heroById } from './heroes.js';
import { heroPower } from '../core/heroes.js';
import { troopPower } from '../core/power.js';
import { baseTroopOf } from '../core/units.js';

// 体验序章（1~12 关）：保留原有登场顺序，让玩家逐个认识 6 史诗 / 6 传奇英雄。
const INTRO_BATTLES = [
  { stage: 1, hero: 'guanping', heroLevel: 1, hpMult: 5, name: '关平 · 初体验', desc: '史诗体验关：先熟悉英雄战节奏，Boss 血量已放大 5~10 倍' },
  { stage: 2, hero: 'zhangren', heroLevel: 14, hpMult: 5, name: '张任 · 初体验', desc: '史诗体验关：先熟悉英雄战节奏，Boss 血量已放大 5~10 倍' },
  { stage: 3, hero: 'huanggai', heroLevel: 16, hpMult: 7, name: '黄盖 · 初体验', desc: '史诗体验关：先熟悉英雄战节奏，Boss 血量已放大 5~10 倍' },
  { stage: 4, hero: 'liru', heroLevel: 7, hpMult: 10, name: '李儒 · 初体验', desc: '史诗体验关：先熟悉英雄战节奏，Boss 血量已放大 5~10 倍' },
  { stage: 5, hero: 'zhangjiao', heroLevel: 12, hpMult: 9, name: '张角 · 初体验', desc: '史诗体验关：先熟悉英雄战节奏，Boss 血量已放大 5~10 倍' },
  { stage: 6, hero: 'xiahouyuan', heroLevel: 18, hpMult: 9, name: '夏侯渊 · 初体验', desc: '史诗体验关：先熟悉英雄战节奏，Boss 血量已放大 5~10 倍' },
  // 英雄血量口径上调后，Boss 血量倍数同步下调，保持第 7 关 ≈ 主线 350 关的战力锚点。
  { stage: 7, hero: 'zhangfei', heroLevel: 4, hpMult: 6.2, name: '张飞 · 传奇登场', desc: '传奇登场：难度接近主线 350 关，之后每关都会更硬' },
  { stage: 8, hero: 'guanyu', heroLevel: 19, hpMult: 5, name: '关羽 · 传奇登场', desc: '传奇体验关：逐个体验 6 名传奇英雄的技能与强度' },
  { stage: 9, hero: 'liubei', heroLevel: 12, hpMult: 6, name: '刘备 · 传奇登场', desc: '传奇体验关：逐个体验 6 名传奇英雄的技能与强度' },
  { stage: 10, hero: 'caocao', heroLevel: 2, hpMult: 10, name: '曹操 · 传奇登场', desc: '传奇体验关：逐个体验 6 名传奇英雄的技能与强度' },
  { stage: 11, hero: 'zhouyu', heroLevel: 30, hpMult: 10, name: '周瑜 · 传奇登场', desc: '传奇体验关：逐个体验 6 名传奇英雄的技能与强度' },
  { stage: 12, hero: 'dongzhuo', heroLevel: 22, hpMult: 9, name: '董卓 · 传奇登场', desc: '传奇体验关：逐个体验 6 名传奇英雄的技能与强度' },
];

// 13~149 关：按英雄基础战力从低到高分 6 段（周瑜 → 张飞 → 刘备 → 曹操 → 董卓 → 关羽），
// 每段内英雄等级 / 血量倍数连续抬升；跨段时自动把下一名英雄的起始血量倍数抬到
// 「不低于上一关战力」的位置，保证 1~150 关逐关递增、没有回撤。
const GROWTH_BLOCKS = [
  { from: 13, to: 35, hero: 'zhouyu', lvFrom: 8, lvTo: 14, multTo: 8 },
  { from: 36, to: 58, hero: 'zhangfei', lvFrom: 14, lvTo: 19, multTo: 9 },
  { from: 59, to: 81, hero: 'liubei', lvFrom: 18, lvTo: 22, multTo: 10 },
  { from: 82, to: 104, hero: 'caocao', lvFrom: 21, lvTo: 25, multTo: 12 },
  { from: 105, to: 127, hero: 'dongzhuo', lvFrom: 24, lvTo: 28, multTo: 13 },
  { from: 128, to: 149, hero: 'guanyu', lvFrom: 27, lvTo: 30, multTo: 15 },
];

function squadPowerAt(stage) {
  return heroBattleSquads(stage)
    .reduce((sum, q) => sum + troopPower(q.troop, q.level), 0);
}

function buildGrowthBattles() {
  const out = [];
  // 从第 12 关（体验序章最后一关）的战力起步，保证第 13 关不回撤
  let prev = squadPowerAt(12) + heroPower('dongzhuo', 22, 9);
  for (const blk of GROWTH_BLOCKS) {
    const span = Math.max(1, blk.to - blk.from);
    // 起点血量倍数：至少 5，并保证这一关战力不低于上一关（+0.5% 余量）
    let multFrom = 5;
    while (squadPowerAt(blk.from) + heroPower(blk.hero, blk.lvFrom, multFrom) < prev * 1.005
      && multFrom < 24) {
      multFrom += 0.1;
    }
    const multTo = Math.max(multFrom, blk.multTo);
    for (let stage = blk.from; stage <= blk.to; stage++) {
      const t = (stage - blk.from) / span;
      const heroLevel = Math.round(blk.lvFrom + (blk.lvTo - blk.lvFrom) * t);
      // 用小数血量倍数插值；再逐关校正，保证每一关战力都严格高于上一关
      let hpMult = Math.round((multFrom + (multTo - multFrom) * t) * 10) / 10;
      let guard = 0;
      while (squadPowerAt(stage) + heroPower(blk.hero, heroLevel, hpMult) <= prev && guard < 500) {
        hpMult = Math.round((hpMult + 0.05) * 100) / 100;
        guard++;
      }
      out.push({
        stage,
        hero: blk.hero,
        heroLevel,
        hpMult,
        name: `${heroById(blk.hero)?.name || '英雄'} · 试炼 ${stage}`,
        desc: 'Boss + 多队精锐，越往后血量与精锐等级越高，硬核挑战',
      });
      prev = squadPowerAt(stage) + heroPower(blk.hero, heroLevel, hpMult);
    }
  }
  return out;
}

// 第 150 关：三英雄同时登场（最终目标 / 最终 Boss）。
const FINAL_BATTLE = {
  stage: 150,
  hero: 'liubei',
  heroLevel: 30,
  hpMult: 10,
  bosses: [
    { hero: 'liubei', heroLevel: 30, hpMult: 10 },
    { hero: 'guanyu', heroLevel: 30, hpMult: 10 },
    { hero: 'zhangfei', heroLevel: 30, hpMult: 10 },
  ],
  name: '三英聚首 · 最终战',
  desc: '最终战：刘备、关羽、张飞三英雄同时登场，配合精锐护卫，硬碰硬收尾',
};

// 敌方精锐按关卡真实扩兵：队数 2~10、兵种从稀有→史诗→传奇、等级从 Lv2→Lv10。
// 单 Boss 阶段靠 Boss 等级 / 血量倍数连续抬升；后段队数逐档增加（每 20 关 +1 队）。
const SQUAD_BANDS = [
  // 关卡上限, [兵种, 等级]...
  { max: 6, squads: [['qingzhou', 2], ['xiandeng', 2]] },
  { max: 12, squads: [['huhao', 8], ['daji', 8]] },
  { max: 20, squads: [['xianzhen', 8], ['tengjia', 8], ['baier', 8]] },
  { max: 22, squads: [['xianzhen', 9], ['tengjia', 9], ['baier', 9]] },
  { max: 27, squads: [['xianzhen', 9], ['daji', 9], ['tengjia', 9], ['wudang', 8]] },
  { max: 33, squads: [['xianzhen', 10], ['daji', 9], ['tengjia', 9], ['wudang', 9]] },
  { max: 40, squads: [['xianzhen', 10], ['daji', 10], ['huhao', 9], ['tengjia', 10], ['wudang', 9]] },
  { max: 47, squads: [['xianzhen', 10], ['daji', 10], ['huhao', 10], ['wudang', 10], ['tengjia', 10], ['baier', 10]] },
  { max: 64, squads: [['xianzhen', 10], ['daji', 10], ['huhao', 10], ['wudang', 10], ['tengjia', 10], ['baier', 10], ['baima', 10]] },
  { max: 84, squads: [['xianzhen', 10], ['daji', 10], ['huhao', 10], ['wudang', 10], ['tengjia', 10], ['baier', 10], ['baima', 10], ['qingzhou', 10]] },
  { max: 104, squads: [['xianzhen', 10], ['daji', 10], ['huhao', 10], ['wudang', 10], ['tengjia', 10], ['baier', 10], ['baima', 10], ['qingzhou', 10], ['yuanyong', 10]] },
  { max: 124, squads: [['xianzhen', 10], ['daji', 10], ['huhao', 10], ['wudang', 10], ['tengjia', 10], ['baier', 10], ['baima', 10], ['qingzhou', 10], ['yuanyong', 10], ['xiandeng', 10]] },
  { max: 150, squads: [['xianzhen', 10], ['daji', 10], ['huhao', 10], ['wudang', 10], ['tengjia', 10], ['baier', 10], ['baima', 10], ['qingzhou', 10], ['yuanyong', 10], ['xiandeng', 10]] },
];

// ---------------------------------------------------------------------------
// 英雄战阵型：Boss 按兵种线分纵深站位，不再每关都是「一个前排肉盾 + 无脑对撞」。
// 敌方 col 0 = 最前排（离中线最近），col 越大越靠后：
//   近战（盾 / 枪）压第一排，直接顶住；骑兵压第二排，留出冲锋加速距离；
//   远程（弓）压后排，前面由精锐结成掩护墙，玩家必须考虑怎么绕开 / 打穿前排。
// 后排取 col3 而不是 col4：开战镜头按 Boss 纵深上移后，col3 的 Boss 刚好落在
// 输出榜下方、我方前排也还在视口内；col4 会把两军挤到视口两端，谁都看不清。
// ---------------------------------------------------------------------------
export const HERO_BATTLE_RANK = { melee: 0, cavalry: 1, ranged: 3 };
const RANK_LABEL = { 0: '第一排', 1: '第二排', 3: '后排' };

export function heroBattleRankCol(troopId) {
  const line = baseTroopOf(troopId);
  if (line === 'cavalry') return HERO_BATTLE_RANK.cavalry;
  if (line === 'archer') return HERO_BATTLE_RANK.ranged;
  return HERO_BATTLE_RANK.melee;
}

export function heroBattleRankLabel(troopId) {
  return RANK_LABEL[heroBattleRankCol(troopId)] || '第一排';
}

// 只取 Boss 的英雄 id 用于定站位：不依赖 HERO_BATTLES（模块初始化时它还在 TDZ，
// buildGrowthBattles() 会先调用 squadPowerAt → heroBattleSquads → 这里）。
function bossHeroIdsForStage(stage) {
  const n = Math.max(1, Math.min(CONFIG.heroBattles.total, Math.floor(stage || 1)));
  if (n === CONFIG.heroBattles.total) return FINAL_BATTLE.bosses.map((b) => b.hero);
  const intro = INTRO_BATTLES.find((s) => s.stage === n);
  if (intro) return [intro.hero];
  const blk = GROWTH_BLOCKS.find((b) => n >= b.from && n <= b.to)
    || GROWTH_BLOCKS[GROWTH_BLOCKS.length - 1];
  return [blk.hero];
}

// 多 Boss（最终战）时：同纵深的 Boss 分开横排，单名 Boss 一律居中。
export function heroBattleBossCells(stage) {
  const cols = bossHeroIdsForStage(stage)
    .map((id) => heroBattleRankCol((heroById(id) || {}).troop));
  const counts = new Map();
  cols.forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
  const used = new Map();
  return cols.map((col) => {
    const rows = counts.get(col) > 1 ? [1, 3, 0, 4, 2] : [2];
    const taken = used.get(col) || new Set();
    const row = rows.find((r) => !taken.has(r)) ?? 2;
    taken.add(row);
    used.set(col, taken);
    return { col, row };
  });
}

// 精锐落位：列优先级随 Boss 纵深变化。
// 近战 Boss 自己顶第一排 → 精锐从第二排压上（Boss 是矛头，能被优先集火）；
// 骑兵 / 远程 Boss 靠后 → 精锐先在第一排结成掩护墙，逼玩家先破阵再够到 Boss。
// Boss 占掉的格子一律跳过，保证敌阵不会两支部队重叠。
function guardCellsFor(stage) {
  const bosses = heroBattleBossCells(stage);
  const reserved = new Set(bosses.map((c) => `${c.col},${c.row}`));
  const spearhead = bosses.length === 1 && bosses[0].col === HERO_BATTLE_RANK.melee;
  const colOrder = spearhead ? [1, 2, 3, 0, 4] : [0, 1, 2, 3, 4];
  const rowOrder = [1, 3, 0, 2, 4];
  const cells = [];
  for (const col of colOrder) {
    for (const row of rowOrder) {
      if (!reserved.has(`${col},${row}`)) cells.push([col, row]);
    }
  }
  return cells;
}

// 最终战的护卫：6 队满级精锐（三英雄按兵种分列，护卫在前面压阵；多 2 队拉长收尾战）
const FINAL_SQUADS = [
  ['huhao', 10], ['daji', 10], ['yuanyong', 10], ['wudang', 10], ['xianzhen', 10], ['tengjia', 10],
];

export const HERO_BATTLES = [
  ...INTRO_BATTLES,
  ...buildGrowthBattles(),
  FINAL_BATTLE,
];

export function heroBattleSquads(stage) {
  const n = Math.max(1, Math.min(CONFIG.heroBattles.total, Math.floor(stage || 1)));
  const squads = n === CONFIG.heroBattles.total
    ? FINAL_SQUADS
    : (SQUAD_BANDS.find((b) => n <= b.max) || SQUAD_BANDS[SQUAD_BANDS.length - 1]).squads;
  const cells = guardCellsFor(n);
  return squads.map(([troop, level], i) => ({
    troop, level, col: cells[i][0], row: cells[i][1],
  }));
}

export function heroBattleByStage(stage) {
  return HERO_BATTLES.find((s) => s.stage === stage) || null;
}

// 归一化 Boss 列表：普通关 1 名，最终战 3 名
export function heroBattleBosses(spec) {
  if (!spec) return [];
  if (Array.isArray(spec.bosses) && spec.bosses.length) {
    return spec.bosses.map((b) => ({ ...b }));
  }
  return [{ hero: spec.hero, heroLevel: spec.heroLevel, hpMult: spec.hpMult }];
}

// 转成战斗页可直接使用的 def：Boss（带 hpMult）+ 随关卡递增的多队精锐
export function heroBattleDef(stage) {
  const spec = heroBattleByStage(stage);
  if (!spec) return null;
  const bosses = heroBattleBosses(spec).filter((b) => heroById(b.hero));
  if (!bosses.length) return null;
  const squads = heroBattleSquads(stage);
  const bossCells = heroBattleBossCells(stage);
  const enemies = [
    ...bosses.map((b, i) => {
      const troop = heroById(b.hero).troop;
      return {
        troop, level: b.heroLevel, hero: b.hero,
        // 近战第一排 / 骑兵第二排 / 远程后排：按兵种线分纵深，不再全部堆在最前排
        hpMult: b.hpMult, boss: true, heroScale: 1.45,
        col: bossCells[i]?.col ?? HERO_BATTLE_RANK.melee,
        row: bossCells[i]?.row ?? 2,
        rankLabel: heroBattleRankLabel(troop),
      };
    }),
    ...squads.map((q) => ({ troop: q.troop, level: q.level, col: q.col, row: q.row })),
  ];
  const levels = squads.map((q) => q.level);
  const rankText = [...new Set(bosses.map((b) => heroBattleRankLabel(heroById(b.hero).troop)))].join(' / ');
  return {
    ...spec,
    bosses,
    bossCount: bosses.length,
    squads,
    enemies,
    rankText,
    // 后排 Boss 需要玩家自己想办法打穿掩护墙，情报里先讲清楚
    formationHint: rankText === '后排'
      ? '远程 Boss 压后排，先破前排精锐再集火'
      : rankText === '第二排'
        ? '骑兵 Boss 压第二排，前排顶住再反打冲锋'
        : rankText === '第一排'
          ? '近战 Boss 压第一排，硬碰硬拼前排'
          : '多将分列压阵：先破前排，再切第二排与后排',
    // 后期关卡不再固定「两队精锐」，文案按实际队数/等级生成
    desc: bosses.length > 1
      ? `${bosses.map((b) => heroById(b.hero)?.name || b.hero).join(' / ')} 同时登场：血量 ×${bosses[0].hpMult} + ${squads.length} 队精锐（Lv${Math.min(...levels)}~${Math.max(...levels)}）`
      : spec.stage >= 13
        ? `Boss 血量 ×${spec.hpMult} + ${squads.length} 队精锐（Lv${Math.min(...levels)}~${Math.max(...levels)}），越往后兵队越多、等级与品级越高`
        : spec.desc,
    enemyLevel: Math.min(...bosses.map((b) => b.heroLevel), ...levels),
    enemyLevelMax: Math.max(...bosses.map((b) => b.heroLevel), ...levels),
    heroBattle: true,
  };
}

// 解锁：主线 250 关 + 按顺序通关（第 N 关需要先过 N-1）
export function heroBattleUnlockLevel() {
  return CONFIG.heroBattles.unlockLevel;
}

export function heroBattleUnlocked(stage, maxCleared, cleared) {
  if ((maxCleared || 0) < CONFIG.heroBattles.unlockLevel) return false;
  return stage <= (cleared || 0) + 1;
}

// 每 10 关首通 1 张招募券（第 10/20/…/150 关）
export function heroBattleScrollReward(stage) {
  return stage % CONFIG.heroBattles.scrollEvery === 0 ? 1 : 0;
}

export function heroBattlePower(stage) {
  const def = heroBattleDef(stage);
  if (!def) return 0;
  return def.enemies.reduce((sum, q) => sum
    + (q.hero ? heroPower(q.hero, q.level, q.hpMult || 1) : troopPower(q.troop, q.level)), 0);
}

// 记录首通（顺序推进）；重复挑战不再发券
export function recordHeroBattleClear(state, stage) {
  const before = Math.max(0, state.heroBattleCleared || 0);
  if (stage > before) {
    state.heroBattleCleared = stage;
    return { firstClear: true, scrolls: heroBattleScrollReward(stage) };
  }
  return { firstClear: false, scrolls: 0 };
}
