// 第 5 关剧情：幽州突骑驰援。
// 这一关是主线第一次「剧情支援」：玩家阵中临时多出一队幽州突骑助战，
// 本关不产出任何宝箱（把奖励叙事换成支援剧情）。支援兵只在第 5 关战场上出现，
// 不进兵营、不写存档、不计入招募解锁，纯剧情单位。
import { formationIndex } from '../core/formation.js';

export const SUPPORT_LEVEL = 5;
export const SUPPORT_TROOP = 'youzhou';

// 支援队等级：第 5 关玩家一般 1~3 级兵，给一队 Lv3 稀有幽州突骑足够翻盘但不喧宾夺主
export const SUPPORT_LEVEL_LV = 3;

// 支援队的固定站位：我方后排（col 4）中间偏上，不覆盖玩家已有上阵位时也能单独出现
export const SUPPORT_POS = { col: 4, row: 1 };

// 支援剧情文案（进关提示 + 结算页奖励位替换文案）
export const SUPPORT_TITLE = '幽州突骑驰援';
export const SUPPORT_BRIEF = '公孙瓒遣幽州突骑来援，白马义从自侧翼杀入，助你破敌。';
// 第 5 关剧情：援军幽州突骑战后永久编入兵营（本关不另发宝箱）
export const SUPPORT_RESULT = '援军之力 · 幽州突骑已编入兵营，永为麾下';

export function isSupportBattle(levelN, mode = 'main') {
  return mode === 'main' && levelN === SUPPORT_LEVEL;
}

// 生成支援小队（用负数 uid 避免与存档兵牌 id 冲突；battle.js 会补 col/row/level）
export function supportSquad() {
  return {
    uid: 'support-youzhou-l5',
    troop: SUPPORT_TROOP,
    level: SUPPORT_LEVEL_LV,
    col: SUPPORT_POS.col,
    row: SUPPORT_POS.row,
    support: true,
  };
}

export function supportSlot() {
  return formationIndex(SUPPORT_POS.col, SUPPORT_POS.row);
}
