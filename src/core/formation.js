// 布阵（5×5）：格子索引、布阵与斗技场坐标的换算、自动布阵
// 纯函数，不依赖存档/界面，方便被 save / levels / 界面共用。
import { CONFIG } from '../data/config.js';
import { baseTroopOf, isBacklineTroop } from './units.js';

export function formationCols() {
  return CONFIG.formation.cols;
}

export function formationRows() {
  return CONFIG.formation.rows;
}

export function formationSize() {
  return CONFIG.formation.cols * CONFIG.formation.rows;
}

export function formationIndex(col, row) {
  return row * CONFIG.formation.cols + col;
}

export function formationCell(index) {
  return { col: index % CONFIG.formation.cols, row: Math.floor(index / CONFIG.formation.cols) };
}

export function emptyFormation() {
  return new Array(formationSize()).fill(null);
}

// 布阵格 → 斗技场格子坐标（竖版：敌方在上、我方在下）
// player：col4 = 前排（最靠中线），col0 = 后排；enemy 镜像（col0 = 前排）
// row = 左右横排，row2 居中
export function slotToArena(side, col, row) {
  const f = CONFIG.formation;
  const x = f.centerX + (row - (f.rows - 1) / 2) * f.lateralStep;
  const y = side === 'player'
    ? f.playerFrontY + (f.cols - 1 - col) * f.depthStep
    : f.enemyFrontY - col * f.depthStep;
  return { x, y };
}

// 自动布阵（按兵种定排）：玩家视角 col4 = 第 1 排（最前），col0 = 最后一排。
//   · 盾兵 / 枪兵 → 第 1 排（正面扛线、抵冲锋）
//   · 骑兵       → 第 2 排或最后一排（留出冲刺距离，能冲起来）
//   · 弓兵 / 远程 → 第 3 排及以后（col2 / col1 / col0）
// 后面的列是「首选排满了」时的溢出顺序，保证 25 格都能用上、不会丢小队。
// 同一纵深从中间横排往两边填；side='enemy' 时前后镜像（敌军前排也靠中线一侧）。
const TROOP_COLUMNS = {
  front: [4, 3, 2, 1, 0],
  cavalry: [3, 0, 2, 1, 4],
  back: [2, 1, 0, 3, 4],
};

const ROW_PREF = [2, 1, 3, 0, 4];

// 某兵种的优先纵深顺序（左侧为最优先）
export function troopColumns(troopId) {
  // 位置口径优先于基础兵种线：白马义从基础线是骑兵，但按远程/后排站位。
  if (isBacklineTroop(troopId)) return TROOP_COLUMNS.back;
  const line = baseTroopOf(troopId);
  if (line === 'cavalry') return TROOP_COLUMNS.cavalry;
  return TROOP_COLUMNS.front; // 盾 / 枪，以及未知兵种一律按前排
}

// 在一套布阵里按兵种规则找空位（找不到返回 -1）
export function autoSlotIndexFor(form, troopId) {
  for (const col of troopColumns(troopId)) {
    for (const row of ROW_PREF) {
      const idx = formationIndex(col, row);
      if (!form[idx]) return idx;
    }
  }
  return -1;
}

export function autoPlaceSquads(squads, side = 'player') {
  const occupied = new Set();
  const mirror = (col) => (side === 'enemy' ? CONFIG.formation.cols - 1 - col : col);
  const placed = [];
  for (const squad of squads) {
    let spot = null;
    for (const col of troopColumns(squad.troop)) {
      for (const row of ROW_PREF) {
        const idx = formationIndex(mirror(col), row);
        if (!occupied.has(idx)) {
          spot = { col: mirror(col), row };
          break;
        }
      }
      if (spot) break;
    }
    if (!spot) break; // 25 个位置已满
    occupied.add(formationIndex(spot.col, spot.row));
    placed.push({ ...squad, col: spot.col, row: spot.row });
  }
  return placed;
}

// 把「单位 id 列表」写回布阵数组：去重、只保留仍然存在的单位、截断到 25
// extraIds：额外允许的 id（英雄格 "h:英雄id"）
export function sanitizeFormation(raw, units, extraIds = []) {
  const ids = new Set(units.map((u) => u.id));
  for (const id of extraIds) ids.add(id);
  const form = emptyFormation();
  if (!Array.isArray(raw)) return form;
  const seen = new Set();
  for (let i = 0; i < form.length && i < raw.length; i++) {
    const id = raw[i];
    if (!id || !ids.has(id) || seen.has(id)) continue;
    seen.add(id);
    form[i] = id;
  }
  return form;
}

// 旧存档只有 lineup（最多 5 个），迁移成布阵
export function formationFromLineup(lineup, units) {
  const byId = new Map(units.map((u) => [u.id, u]));
  const squads = (Array.isArray(lineup) ? lineup : [])
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((u) => ({ uid: u.id, troop: u.troop }));
  const placed = autoPlaceSquads(squads);
  const form = emptyFormation();
  placed.forEach((s) => {
    form[formationIndex(s.col, s.row)] = s.uid;
  });
  return form;
}
