// 序章：董卓率精锐大军压境，玩家必败。
// 这一战用实际阵容展示全部 16 个兵种（4 基础 + 12 特殊），敌方等级 9~10、带董卓本人；
// 我方 12 队 Lv7 精锐，能打出尊严但不可能翻盘。
import { autoPlaceSquads, formationIndex, emptyFormation } from '../core/formation.js';
import { heroById } from './heroes.js';

// 全部兵种（4 基础 + 稀有 / 史诗 / 传奇各 4）
export const ALL_TROOPS = [
  'shield', 'archer', 'spear', 'cavalry',
  'qingzhou', 'xiandeng', 'qingzhu', 'youzhou',
  'baier', 'tengjia', 'yuanyong', 'baima',
  'daji', 'xianzhen', 'wudang', 'huhao',
];

// 序章旁白（必须按这个顺序播放：第一段说完再点出第二段）
export const PROLOGUE_NARRATION = [
  '已是一方军阀的你遇上了权势正盛的董卓，是就此殒命还是讨伐奸佞，在此一举。',
  '然敌我差距悬殊，难以战胜。',
];

export const TEACHING_TITLE = '教学关卡';

export const PROLOGUE_ENEMY_TROOPS = ALL_TROOPS.map((troop) => ({
  troop,
  level: ['daji', 'xianzhen', 'wudang', 'huhao'].includes(troop) ? 10 : 9,
}));

export const PROLOGUE_PLAYER = [
  { troop: 'shield', level: 7 },
  { troop: 'shield', level: 7 },   // 同名同级：教学「合成」用
  { troop: 'spear', level: 7 },
  { troop: 'archer', level: 7 },
  { troop: 'cavalry', level: 7 },
  { troop: 'qingzhou', level: 7 },
  { troop: 'xiandeng', level: 7 },
  { troop: 'baier', level: 7 },
  { troop: 'yuanyong', level: 7 },
  { troop: 'daji', level: 7 },
  { troop: 'wudang', level: 7 },
  { troop: 'baima', level: 7 },
];

// 董卓本人站在敌方最前排的空位（col0 最靠近中线），找不到空位就退回中线
function bossSpot(placed) {
  const used = new Set(placed.map((q) => formationIndex(q.col, q.row)));
  for (const col of [0, 1, 2, 3, 4]) {
    for (const row of [2, 1, 3, 0, 4]) {
      if (!used.has(formationIndex(col, row))) return { col, row };
    }
  }
  return { col: 0, row: 2 };
}

export function prologueDef() {
  const placed = autoPlaceSquads(PROLOGUE_ENEMY_TROOPS.map((q) => ({ ...q })), 'enemy');
  const spot = bossSpot(placed);
  const bossTroop = (heroById('dongzhuo') || {}).troop || 'cavalry';
  const enemies = [
    {
      troop: bossTroop, level: 10, hero: 'dongzhuo', hpMult: 6,
      boss: true, heroScale: 1.45, col: spot.col, row: spot.row,
    },
    ...placed,
  ];
  return {
    n: 0,
    name: '序章 · 董卓',
    prologue: true,
    mustLose: true,
    enemies,
    enemyLevel: 9,
    enemyLevelMax: 10,
  };
}

// 把存档切换成「序章阵容」：12 队精锐全部自动上阵，主线进度归零。
export function seedPrologue(state) {
  state.maxCleared = 0;
  state.nextUnitId = 1;
  state.units = PROLOGUE_PLAYER.map((u) => ({
    id: `u${state.nextUnitId++}`,
    troop: u.troop,
    level: u.level,
  }));
  state.formation = emptyFormation();
  const placed = autoPlaceSquads(
    state.units.map((u) => ({ uid: u.id, troop: u.troop })),
    'player',
  );
  placed.forEach((s) => { state.formation[formationIndex(s.col, s.row)] = s.uid; });
  state.story = { introDone: false };
  state.seenTroops = [...new Set(state.units.map((u) => u.troop))];
  return state;
}
