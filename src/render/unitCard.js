// 小兵牌：兵营 / 布阵页共用的卡片（164×116，4 列一排，字与立绘同步放大）
// 兵牌只画「兵种色标 + 等级 + 品阶名 + 立绘」；稀有 / 史诗 / 传奇 用不一样的边框
import { THEME, text, panel, roundRectPath } from './draw.js';
import { CONFIG } from '../data/config.js';
import { unitName, spriteTierFor, troopById, rarityOf, rarityInfo } from '../core/units.js';
import { squadSoldierCount } from '../core/arena.js';
import { drawFrame, sheetFor } from './sprites.js';

export const CARD = { w: 164, h: 116, gapX: 10, gapY: 6 };
const TROOP_CHAR = { shield: '盾', archer: '弓', spear: '枪', cavalry: '骑' };

// 第 i 张牌的位置（cols 列，x0/y0 为左上角）
export function cardRect(i, cols, x0, y0, card = CARD) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  return {
    x: x0 + col * (card.w + card.gapX),
    y: y0 + row * (card.h + card.gapY),
    w: card.w,
    h: card.h,
  };
}

// 画一张兵牌。opt: selected 选中 / onGrid 已上阵 / hover 'ok'|'bad' 拖拽悬停反馈 / alpha
// tinted: 部署页专用 —— 普通兵种也用绿色边框（和稀有蓝 / 史诗紫 / 传奇金凑成四色）
export function drawUnitCard(ctx, unit, rect, opt = {}) {
  const { selected = false, onGrid = false, hover = null, alpha = 1, ghost = false, tinted = false } = opt;
  const troop = troopById(unit.troop);
  const { x, y, w, h } = rect;

  ctx.save();
  ctx.globalAlpha = alpha;

  // 品级：普通沿用原有边框，稀有蓝 / 史诗紫 / 传奇金 + 四角金线（一眼能分出档次）
  const rarity = rarityOf(unit.troop);
  const rar = rarityInfo(unit.troop);
  const special = rarity !== 'common';
  const commonStroke = tinted ? THEME.green : THEME.line;
  const stroke = hover === 'ok' ? THEME.green
    : hover === 'bad' ? THEME.red
      : selected ? THEME.gold
        : special ? rar.color
          : onGrid ? THEME.goldDim : commonStroke;
  panel(ctx, x, y, w, h, {
    fill: ghost ? '#243042' : onGrid ? '#2b3748' : '#1c2431',
    stroke, r: 10, lw: hover || selected ? 3 : special ? 2.4 : (tinted ? 2.2 : 1.5),
  });
  if (special || tinted) {
    // 内圈描边加一层同色细线，让边框更"厚实"
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    roundRectPath(ctx, x + 3.5, y + 3.5, w - 7, h - 7, 8);
    ctx.strokeStyle = special ? rar.color : THEME.green;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  if (special) {
    if (rarity === 'legendary') {
      // 传奇：四角金线（横竖各一笔，像徽章的角标）
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = rar.color;
      ctx.lineWidth = 2;
      [[x + 4, y + 4, 1, 1], [x + w - 4, y + 4, -1, 1],
        [x + 4, y + h - 4, 1, -1], [x + w - 4, y + h - 4, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + sx * 9, cy);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy + sy * 9);
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  // 兵种色标（左上角小圆点 + 单字）：低饱和国风土色，不用高饱和蓝 / 紫 / 青
  const TROOP_MARK = {
    shield: '#6e6a60', archer: '#8a7757', spear: '#6b6a52', cavalry: '#7a5b4c',
  };
  ctx.save();
  ctx.fillStyle = TROOP_MARK[troop?.baseTroop || unit.troop] || '#6e6a60';
  ctx.beginPath();
  ctx.arc(x + 24, y + 23, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  text(ctx, TROOP_CHAR[troop?.baseTroop || unit.troop] || troop?.name?.[0] || '兵', x + 24, y + 24, {
    size: 19, align: 'center', color: '#f4efe2', weight: '600',
  });

  // 等级（特殊兵种前面带上品级，颜色跟着品级走）
  text(ctx, special ? `${rar.name} Lv${unit.level}` : `Lv${unit.level}`, x + w - 9, y + 23, {
    size: special ? 16 : 19, align: 'right', color: special ? rar.color : THEME.gold, weight: '600',
  });

  // 试用兵：顶部橙色角标（剩余回合），避免被当成永久资产
  if (unit.trialLeft > 0) {
    const bw = 70;
    ctx.save();
    ctx.globalAlpha = alpha * 0.96;
    roundRectPath(ctx, x + w / 2 - bw / 2, y + 10, bw, 22, 8);
    ctx.fillStyle = 'rgba(72,42,12,0.95)';
    ctx.fill();
    ctx.strokeStyle = '#e0a34a';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    text(ctx, `试用 ${unit.trialLeft}`, x + w / 2, y + 21, {
      size: 13, align: 'center', color: '#ffd28a', weight: '600',
    });
  }

  // 品阶名（特殊兵种用品级配色）
  text(ctx, unitName(unit.troop, unit.level), x + w / 2, y + 51, {
    size: 19, align: 'center', color: special ? rar.color : THEME.text, maxWidth: w - 12,
  });

  // 立绘（脚底贴卡片下沿）
  const sheet = sheetFor(unit.troop, spriteTierFor(unit.level));
  drawFrame(ctx, sheet, 'idle', 0, x + w / 2, y + h - 6, 0.66, false);

  // 小队人数：等级越高人越多（Lv3 / Lv5 / Lv8 各 +1）
  const size = squadSoldierCount(unit.troop, unit.level);
  ctx.save();
  ctx.globalAlpha = alpha * 0.92;
  roundRectPath(ctx, x + 5, y + h - 29, 46, 24, 8);
  ctx.fillStyle = 'rgba(11,16,24,0.82)';
  ctx.fill();
  ctx.restore();
  text(ctx, `${size} 人`, x + 28, y + h - 12, {
    size: 15, align: 'center', color: THEME.textDim, weight: '600',
  });

  ctx.restore();
}

// 未解锁兵种图鉴卡：灰色立绘 + 锁定态 + 「第 X 关解锁」
export function drawLockedCard(ctx, troopId, rect, unlockLevel) {
  const troop = troopById(troopId);
  const { x, y, w, h } = rect;
  panel(ctx, x, y, w, h, {
    fill: 'rgba(16,21,29,0.88)', stroke: '#39414e', r: 10, lw: 1.4,
  });
  // 灰色立绘：缩小一档并压低透明度，给「未解锁 / 兵种名 / 解锁关卡」让出清晰的文字底
  ctx.save();
  ctx.globalAlpha = 0.22;
  drawFrame(ctx, sheetFor(troopId, 0), 'idle', 0, x + w / 2, y + h - 6, 0.5, false);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(13,17,24,0.55)';
  roundRectPath(ctx, x + 4, y + 4, w - 8, h - 8, 8);
  ctx.fill();
  ctx.restore();

  text(ctx, '未解锁', x + w / 2, y + 32, {
    size: 21, align: 'center', color: '#8d97a4', weight: '600',
  });
  text(ctx, troop ? troop.name : troopId, x + w / 2, y + 62, {
    size: 17, align: 'center', color: '#7c8794', maxWidth: w - 12,
  });
  text(ctx, `第 ${unlockLevel} 关解锁`, x + w / 2, y + 88, {
    size: 15, align: 'center', color: '#b9904a',
  });
}

// 空兵营位：回到改动前的暗色空框（白色空框是布阵战场那一轮的需求，不属于兵牌/图鉴）
export function drawEmptyCard(ctx, rect) {
  panel(ctx, rect.x, rect.y, rect.w, rect.h, {
    fill: 'rgba(20,26,36,0.5)', stroke: '#28323f', r: 10, lw: 1,
  });
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.strokeStyle = '#33404f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();
  ctx.restore();
}

// 可获得兵种卡（图鉴补全）：已解锁但兵营里还没有的兵种，亮色立绘 + 绿色「可获得」
export function drawAvailableCard(ctx, troopId, rect) {
  const troop = troopById(troopId);
  const { x, y, w, h } = rect;
  panel(ctx, x, y, w, h, {
    fill: 'rgba(24,38,32,0.85)', stroke: THEME.green, r: 10, lw: 1.8,
  });
  ctx.save();
  ctx.globalAlpha = 0.92;
  drawFrame(ctx, sheetFor(troopId, 0), 'idle', 0, x + w / 2, y + h - 6, 0.66, false);
  ctx.restore();

  roundRectPath(ctx, x + w / 2 - 36, y + 9, 72, 24, 9);
  ctx.fillStyle = 'rgba(18,32,25,0.92)';
  ctx.fill();
  text(ctx, '可获得', x + w / 2, y + 26, {
    size: 15, align: 'center', color: THEME.green, weight: '600',
  });
  text(ctx, troop ? troop.name : troopId, x + w / 2, y + h - 13, {
    size: 17, align: 'center', color: '#dcefe2', maxWidth: w - 12,
  });
}

// 拖动中的兵牌（跟随手指，半透明）
export function drawUnitGhost(ctx, unit, x, y, opt = {}) {
  const rect = { x: x - CARD.w / 2, y: y - CARD.h / 2 - 14, w: CARD.w, h: CARD.h };
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 14;
  drawUnitCard(ctx, unit, rect, { ...opt, ghost: true });
  ctx.restore();
}

// 兵牌页脚（“第 x / y 页”）+ 翻页按钮，两个页面共用样式
export function pager(ctx, rects, page, pages) {
  const { prev, next } = rects;
  const cx = (prev.x + prev.w + next.x) / 2;
  // 这里用 button 会循环依赖（draw.js 已导入），所以直接画两个小方块
  [[prev, '◀', page > 0], [next, '▶', page < pages - 1]].forEach(([r, label, on]) => {
    ctx.save();
    ctx.globalAlpha = on ? 1 : 0.35;
    roundRectPath(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = THEME.panel2;
    ctx.fill();
    ctx.strokeStyle = THEME.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, {
      size: 20, align: 'center', color: on ? THEME.text : THEME.textWeak,
    });
  });
  text(ctx, `${page + 1} / ${pages}`, cx, prev.y + prev.h / 2, {
    size: 18, align: 'center', color: THEME.textDim,
  });
}
