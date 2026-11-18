// 征战进度（关卡不可视）：只显示「已经推进到第几关」+ 接下来 25 关的奖励进度条
// - 关卡只能一路向前，已通关的关卡锁掉（不可重复挑战）
// - 每 5 关一个节点：普通关小木箱 / 5 倍数银箱 / 20 倍数金箱
//
// 版面原则（本轮）：只留大号标题 + 关键数据 + 图标；规则 / 说明 / 下一章等文字全部收进右上角「!」详情弹层
import { THEME, text, panel, button, coinBadge, hit, backButton, bar, infoBadge, infoModal, lockIcon } from '../render/draw.js';
import { levelTotal, enemyLevelFor, enemyLevelMaxFor, difficultyCheckpoint, enemyScaleFor } from '../core/levels.js';
import { chestsForLevel, chestType } from '../core/chests.js';
import { chapterOfLevel, cityOfLevel, milestones, chapterRange } from '../core/chapters.js';
import { CONFIG } from '../data/config.js';
import { rarityOf } from '../core/units.js';
import { drawChest } from '../render/chest.js';
import { DeployScreen } from './deploy.js';

const WINDOW = 25;   // 一次只显示 25 关的奖励
const NODE = 5;      // 每 5 关一个节点

export const LEVELS_LAYOUT = {
  backRect: { x: 36, y: 44, w: 124, h: 64 },
  challengeRect: { x: 175, y: 1000, w: 400, h: 132 },
  windowPanel: { x: 40, y: 530, w: 670, h: 386 },
  infoRect: { x: 656, y: 548, w: 56, h: 56 },
  windowStart: 1,
  rows: [],
};

export class LevelSelectScreen {
  constructor(game) {
    this.game = game;
    this.backRect = { ...LEVELS_LAYOUT.backRect };
    this.challengeRect = { ...LEVELS_LAYOUT.challengeRect };
    this.infoRect = { ...LEVELS_LAYOUT.infoRect };
    this.rows = [];
    this.windowStart = 1;
    this.infoOpen = false;
  }

  update() {}

  // 当前该挑战的关（全部通关 = null）
  nextLevel() {
    const next = this.game.state.maxCleared + 1;
    return next <= levelTotal() ? next : null;
  }

  // 「接下来 25 关」窗口：对齐到 25 的整数区间，跨过一个窗口就自动往后翻
  computeWindow() {
    const next = this.nextLevel() ?? levelTotal();
    const start = Math.floor((next - 1) / WINDOW) * WINDOW + 1;
    const end = Math.min(levelTotal(), start + WINDOW - 1);
    this.windowStart = start;
    this.rows = [];
    for (let from = start; from <= end; from += NODE) {
      const to = Math.min(end, from + NODE - 1);
      const counts = {};
      let ids = [];
      for (let n = from; n <= to; n++) {
        ids = ids.concat(chestsForLevel(n));
        for (const id of chestsForLevel(n)) counts[id] = (counts[id] || 0) + 1;
      }
      this.rows.push({ from, to, ids, counts });
    }
    LEVELS_LAYOUT.windowStart = start;
    LEVELS_LAYOUT.rows = this.rows;
    return { start, end };
  }

  tap(x, y) {
    const g = this.game;
    if (this.infoOpen) { this.infoOpen = false; return; }
    if (hit(this.backRect, x, y)) return g.pop();
    if (hit(this.infoRect, x, y)) { this.infoOpen = true; return; }
    const next = this.nextLevel();
    if (next && hit(this.challengeRect, x, y)) {
      g.push(new DeployScreen(g, { mode: 'battle', level: next }));
    }
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const total = levelTotal();
    const next = this.nextLevel();
    const cur = Math.min(next ?? total, total);
    const chapter = chapterOfLevel(cur);
    const city = cityOfLevel(cur);
    const { start, end } = this.computeWindow();

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,18,12,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, `征战 · ${chapter ? (chapter.name.split(' · ')[1] || chapter.name) : ''}`, W / 2 + 20, 76, { size: 34, weight: '600', align: 'center' });
    coinBadge(ctx, 700, 76, st.coins, { size: 24, align: 'right' });

    this.drawChapterCard(ctx, chapter, city, next, total);
    this.drawMilestones(ctx, chapter, st.maxCleared);
    this.drawWindow(ctx, start, end, next, st.maxCleared);

    // 主按钮：唯一可以进入的关卡（不能选关、不能回头）
    if (next) {
      const cp = difficultyCheckpoint(next);
      const diff = enemyScaleFor(next);
      const tag = cp ? ` ★ ${cp.label}` : diff > 1 ? ` · 强度 ${Math.round(diff * 100)}%` : '';
      button(ctx, this.challengeRect, `挑战第 ${next} 关`, {
        size: 40, fill: '#332c1d', stroke: THEME.goldDim, textColor: THEME.gold,
        sub: `${city ? city.name : ''} · 敌军 ${enemyLvLabel(next)}${tag}`,
        subSize: 22,
      });
    } else {
      button(ctx, this.challengeRect, '本章已通关', {
        size: 38, fill: THEME.panel2, stroke: THEME.line, textColor: THEME.textDim,
        sub: '后续章节敬请期待', subSize: 22,
      });
    }

    // 下一章：只留「旗标 + 关卡号」，完整章节名收进「!」
    const nextLv = chapter?.nextHint?.match(/第\s*(\d+)\s*关/);
    if (nextLv && chapter.nextHint.startsWith('下一章')) {
      drawFlag(ctx, 300, 1178, 14, THEME.textWeak);
      text(ctx, `下一章 · 第 ${nextLv[1]} 关`, W / 2 + 24, 1178, {
        size: 22, align: 'center', color: THEME.textWeak,
      });
    }

    if (this.infoOpen) this.drawInfo(ctx, chapter, city, next, total, start, end);
  }

  // 章节 + 城池 + 整章进度条（大号标题 + 大号进度，说明文字全部去掉）
  drawChapterCard(ctx, chapter, city, next, total) {
    const st = this.game.state;
    const x = 40;
    const y = 134;
    const w = 670;
    const h = 214;
    panel(ctx, x, y, w, h, { fill: THEME.panel, stroke: THEME.line, r: 20 });

    const range = chapter ? chapterRange(chapter) : { from: 1, to: total };
    const chCount = Math.max(1, range.to - range.from + 1);
    const chDone = Math.max(0, Math.min(chCount, st.maxCleared - range.from + 1));
    const chRatio = chDone / chCount;

    text(ctx, chapter ? chapter.name : '章节', x + 26, y + 48, { size: 36, weight: '700', color: THEME.gold, maxWidth: 420 });
    text(ctx, `${chDone} / ${chCount}`, x + w - 26, y + 50, {
      size: 40, align: 'right', weight: '700', color: THEME.text,
    });

    // 本章进度条（只画当前章节，5 座城池的标记才不会被挤在一起）
    const bx = x + 26;
    const by = y + 82;
    const bw = w - 52;
    bar(ctx, bx, by, bw, 22, chRatio, { fill: '#6f8f5f', stroke: '#4a3a24' });
    const cities = chapter?.cities || [];
    for (let i = 0; i < cities.length; i++) {
      const c = cities[i];
      const mx = bx + bw * ((c.to - range.from + 1) / chCount);
      const here = city && city.name === c.name;
      ctx.save();
      ctx.strokeStyle = here ? THEME.gold : THEME.line;
      ctx.lineWidth = here ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(mx, by - 8);
      ctx.lineTo(mx, by + 30);
      ctx.stroke();
      ctx.restore();
      text(ctx, c.name, mx, by + 52, {
        size: here ? 22 : 19,
        align: 'center',
        weight: here ? '700' : '400',
        color: st.maxCleared >= c.to ? THEME.gold : here ? THEME.text : THEME.textWeak,
      });
    }

    // 当前城池：大号一行；右侧只放「银箱 / 金箱还差几关」的图标 + 数字
    text(ctx, city ? `${city.name} · 第 ${city.from}~${city.to} 关` : '本章已全部通关', x + 26, y + 186, {
      size: 30, weight: '600', color: THEME.text,
    });
    const up = upcomingChests(st.maxCleared);
    let iconX = x + w - 30;
    if (up.gold !== null) {
      iconX -= 34;
      drawChest(ctx, iconX, y + 176, 0.34, { color: chestType('gold')?.color || THEME.gold, glow: false });
      text(ctx, `${up.gold}`, iconX, y + 198, { size: 20, align: 'center', color: chestType('gold')?.color || THEME.gold });
      iconX -= 76;
    }
    if (up.silver !== null) {
      drawChest(ctx, iconX, y + 176, 0.34, { color: chestType('silver')?.color || '#c9d2dc', glow: false });
      text(ctx, `${up.silver}`, iconX, y + 198, { size: 20, align: 'center', color: THEME.textDim });
    }
  }

  // 城池 / 章节里程碑：只留「图标 + 关卡号 + 名称」，达成状态用勾 / 锁图标表达
  drawMilestones(ctx, chapter, maxCleared) {
    const x = 40;
    const y = 364;
    const w = 670;
    const h = 150;
    panel(ctx, x, y, w, h, { fill: 'rgba(43,34,23,0.86)', stroke: THEME.line, r: 20 });

    const list = milestones().filter((m) => m.chapter === chapter && (m.chests.length || (m.units || []).length));
    const gap = 10;
    const chipW = Math.min(152, Math.floor((w - 52 - gap * Math.max(0, list.length - 1)) / Math.max(1, list.length)));
    list.forEach((m, i) => {
      const cx = x + 26 + i * (chipW + gap);
      const cy = y + 12;
      const reached = maxCleared >= m.level;
      const unitReward = (m.units || [])[0];
      const primary = chestType(m.chests[0]);
      const color = unitReward ? (CONFIG.rarity[rarityOf(unitReward.unit)]?.color || THEME.gold) : (primary?.color || THEME.gold);
      panel(ctx, cx, cy, chipW, 126, {
        fill: reached ? 'rgba(45,56,44,0.9)' : 'rgba(30,24,16,0.9)',
        stroke: reached ? color : '#4a3a24',
        r: 14, lw: reached ? 2 : 1.5,
      });

      // 奖励图标：固定兵种用「兵」字圆章，宝箱直接画箱子
      const iconY = cy + 44;
      if (unitReward) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx + chipW / 2, iconY, 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(58,46,30,0.95)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = reached ? 1 : 0.55;
        ctx.stroke();
        ctx.restore();
        text(ctx, '兵', cx + chipW / 2, iconY, {
          size: 26, align: 'center', weight: '700', color, alpha: reached ? 1 : 0.55,
        });
      } else {
        drawChest(ctx, cx + chipW / 2, iconY, 0.34, { color, glow: false, alpha: reached ? 1 : 0.55 });
      }

      text(ctx, m.kind === 'chapter' ? '章节' : m.name, cx + chipW / 2, cy + 88, {
        size: 22, align: 'center', weight: '600',
        color: reached ? THEME.text : THEME.textDim, maxWidth: chipW - 8,
      });
      text(ctx, `${m.level}`, cx + chipW / 2, cy + 114, {
        size: 24, align: 'center', weight: '700', color: reached ? color : THEME.textWeak,
      });

      if (reached) {
        drawCheck(ctx, cx + chipW - 20, cy + 20, 11, THEME.green);
      } else {
        lockIcon(ctx, cx + chipW - 20, cy + 20, 18, 'rgba(140,152,168,0.8)');
      }
    });
  }

  // 接下来 25 关的奖励：5 个节点（每 5 关一个），只画「宝箱图标 + 数量 + 状态图标」
  drawWindow(ctx, start, end, next, maxCleared) {
    const { x, y, w, h } = LEVELS_LAYOUT.windowPanel;
    panel(ctx, x, y, w, h, { fill: THEME.panel, stroke: THEME.line, r: 20 });
    text(ctx, `第 ${start}~${end} 关`, x + 26, y + 42, { size: 32, weight: '600', color: THEME.text });
    infoBadge(ctx, this.infoRect.x + 28, this.infoRect.y + 28, 22);

    // 25 关的整体进度（一格 = 1 关）
    const bx = x + 26;
    const by = y + 58;
    const bw = w - 52;
    const ratio = Math.max(0, Math.min(1, (maxCleared - (start - 1)) / (end - start + 1)));
    bar(ctx, bx, by, bw, 12, ratio, { fill: '#6f8f5f', stroke: '#4a3a24' });

    // 5 个节点横排：节点宽 = 可用宽度均分，每个节点 = 5 关
    const gap = 10;
    const nodeW = Math.floor((w - 52 - gap * 4) / 5);
    const nodeH = 250;
    const top = y + 90;

    this.rows.forEach((row, i) => {
      const nx = x + 26 + i * (nodeW + gap);
      const cx = nx + nodeW / 2;
      const active = next !== null && next >= row.from && next <= row.to;
      const done = maxCleared >= row.to;

      panel(ctx, nx, top, nodeW, nodeH, {
        fill: active ? '#2c2a1d' : done ? '#202b22' : 'rgba(33,26,18,0.9)',
        stroke: active ? THEME.gold : done ? '#3d5442' : '#4a3a24',
        r: 14, lw: active ? 2.5 : 1.5,
      });
      text(ctx, `${row.from}–${row.to}`, cx, top + 34, {
        size: 24, align: 'center', weight: '700',
        color: done ? '#9fd0a8' : active ? THEME.gold : THEME.textDim,
      });

      // 宝箱：图标 + ×数量（最多 3 种，已经是这 5 关的全部产出）
      const ids = Object.keys(row.counts).slice(0, 3);
      ids.forEach((id, j) => {
        const type = chestType(id);
        const ry = top + 84 + j * 50;
        drawChest(ctx, cx - 26, ry, 0.36, {
          color: type?.color || THEME.gold,
          glow: active,
          alpha: done ? 0.6 : 1,
        });
        text(ctx, `×${row.counts[id]}`, cx + 12, ry + 2, {
          size: 23, weight: '700', color: done ? THEME.textDim : type?.color || THEME.gold,
        });
      });

      // 状态：已完成 = 勾，进行中 = 实心金点，未到 = 空心点（不再写文字）
      const sy = top + nodeH - 26;
      if (done) drawCheck(ctx, cx, sy, 13, THEME.green);
      else if (active) drawDot(ctx, cx, sy, 9, THEME.gold, true);
      else drawDot(ctx, cx, sy, 8, THEME.textWeak, false);
    });
  }

  // 详情弹层：所有被删掉的说明性文字集中放这里
  drawInfo(ctx, chapter, city, next, total, start, end) {
    const g = this.game;
    const late = (next ?? total) > 200;
    const lines = [
      city ? `${city.name}：${city.desc}` : '',
      chapter?.nextHint || '',
      late
        ? '首通掉落：200 关后每 5 关 1 银箱，每 20 关额外 1 金箱。'
        : '首通掉落：第 1 关与每 5 关 1 小木箱，20 关加银箱，50 关加金箱；城池 / 章节另有里程碑宝箱。',
      `当前窗口：第 ${start}~${end} 关，每个节点 = 5 关。`,
      '关卡只能向前推进，已通关的关卡不能重复挑战。',
    ].filter(Boolean);
    infoModal(ctx, g.W, g.H, '征 战 说 明', lines);
  }
}

function drawCheck(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f1a13';
  ctx.lineWidth = Math.max(2, r * 0.26);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.45, y + r * 0.02);
  ctx.lineTo(x - r * 0.12, y + r * 0.38);
  ctx.lineTo(x + r * 0.5, y - r * 0.36);
  ctx.stroke();
  ctx.restore();
}

function drawDot(ctx, x, y, r, color, filled) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.stroke();
  }
  ctx.restore();
}

function drawFlag(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 1, y - s);
  ctx.lineTo(x + s * 1.7, y - s * 0.55);
  ctx.lineTo(x + 1, y - s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 敌军等级文案（有“升 1 级”的混编小队时显示 Lv1~2）
function enemyLvLabel(n) {
  const a = enemyLevelFor(n);
  const b = enemyLevelMaxFor(n);
  return a === b ? `Lv${a}` : `Lv${a}~${b}`;
}

// 距下一个银箱 / 金箱还差几关（200 关后发放节奏变快）
function upcomingChests(maxCleared) {
  const next = maxCleared + 1;
  if (next > levelTotal()) return { silver: null, gold: null };
  const late = next > 200;
  const silverStep = late ? 5 : 20;
  const goldStep = late ? 20 : 50;
  const silver = Math.ceil(next / silverStep) * silverStep;
  const gold = Math.ceil(next / goldStep) * goldStep;
  return {
    silver: silver <= levelTotal() ? silver - maxCleared : null,
    gold: gold <= levelTotal() ? gold - maxCleared : null,
  };
}
