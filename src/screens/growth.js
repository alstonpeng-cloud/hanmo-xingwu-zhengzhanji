// 成长之路：按关卡升序的解锁路线（兵种 + 系统功能），可上下滚动
import { THEME, text, panel, backButton, hit } from '../render/draw.js';
import { GROWTH_NODES, growthStatus } from '../data/growth.js';
import { drawFrame, sheetFor } from '../render/sprites.js';
import { CONFIG } from '../data/config.js';

export const GROWTH_LAYOUT = {
  view: { x: 30, y: 196, w: 690, h: 1014 },
  rowH: 132,
  cardX: 100,
  cardW: 590,
  cardH: 116,
  lineX: 62,
};

export class GrowthScreen {
  constructor(game) {
    this.game = game;
    this.bgm = 'main';
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.scrollY = 0;
    this.drag = null;
    this.t = 0;
  }

  update(dt) { this.t += dt; }

  maxScroll() {
    const contentH = GROWTH_NODES.length * GROWTH_LAYOUT.rowH;
    return Math.max(0, contentH - GROWTH_LAYOUT.view.h);
  }

  rowY(i, scrollY = this.scrollY) {
    return GROWTH_LAYOUT.view.y + 8 + i * GROWTH_LAYOUT.rowH - scrollY;
  }

  onDown(x, y) {
    if (hit(this.backRect, x, y)) return this.game.pop();
    if (hit(GROWTH_LAYOUT.view, x, y)) {
      this.drag = { y, scrollY: this.scrollY, moved: false };
    }
  }

  onMove(x, y) {
    if (!this.drag) return;
    const dy = this.drag.y - y;
    if (Math.abs(dy) > 5) this.drag.moved = true;
    this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.drag.scrollY + dy));
  }

  onUp() {
    this.drag = null;
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const L = GROWTH_LAYOUT;
    const unlockedCount = GROWTH_NODES.filter((n) => growthStatus(st, n).unlocked).length;
    // 下一个目标：第一个未解锁节点（route 上的高亮）
    let nextIdx = GROWTH_NODES.findIndex((n) => !growthStatus(st, n).unlocked);
    if (nextIdx < 0) nextIdx = GROWTH_NODES.length - 1;

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '成 长 之 路', W / 2 + 20, 56, {
      size: 34, weight: '600', align: 'center', color: THEME.gold,
    });
    text(ctx, `已通关 ${st.maxCleared} 关 · 已解锁 ${unlockedCount} / ${GROWTH_NODES.length} 个节点`,
      W / 2 + 20, 92, { size: 18, align: 'center', color: THEME.textDim });

    text(ctx, '按关卡升序：兵种解锁 + 系统功能开放', 37, 150, {
      size: 17, color: THEME.textWeak,
    });
    text(ctx, '上下滑动浏览 · 灰色为未解锁', 713, 150, {
      size: 16, align: 'right', color: THEME.textDim,
    });

    this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.scrollY));
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.view.x, L.view.y, L.view.w, L.view.h);
    ctx.clip();

    // 路线竖线（已解锁段金色，未解锁段灰色）
    const firstY = this.rowY(0) + L.rowH / 2;
    const lastY = this.rowY(GROWTH_NODES.length - 1) + L.rowH / 2;
    const gateY = this.rowY(nextIdx) + L.rowH / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(120,132,150,0.42)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(L.lineX, firstY);
    ctx.lineTo(L.lineX, lastY);
    ctx.stroke();
    if (st.maxCleared > 0) {
      ctx.strokeStyle = 'rgba(213,153,71,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(L.lineX, firstY);
      ctx.lineTo(L.lineX, Math.max(firstY, gateY));
      ctx.stroke();
    }
    ctx.restore();

    GROWTH_NODES.forEach((node, i) => {
      const cy = this.rowY(i) + L.rowH / 2;
      if (cy + L.rowH / 2 < L.view.y - 20 || cy - L.rowH / 2 > L.view.y + L.view.h + 20) return;
      const status = growthStatus(st, node);
      const isNext = i === nextIdx && !status.unlocked;
      const card = { x: L.cardX, y: cy - L.cardH / 2, w: L.cardW, h: L.cardH };

      // 时间轴节点圆点
      ctx.save();
      ctx.beginPath();
      ctx.arc(L.lineX, cy, status.unlocked ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = status.unlocked ? THEME.gold : '#241c12';
      ctx.fill();
      ctx.strokeStyle = status.unlocked ? '#f6e2a8' : isNext ? THEME.goldDim : '#4a5464';
      ctx.lineWidth = isNext ? 3 : 1.8;
      ctx.stroke();
      ctx.restore();

      panel(ctx, card.x, card.y, card.w, card.h, {
        fill: status.unlocked ? '#2b2217' : '#17130e',
        stroke: status.unlocked ? THEME.goldDim : isNext ? '#8a6f32' : THEME.line,
        r: 14, lw: isNext ? 2.2 : 1.2,
      });

      text(ctx, `第 ${node.level} 关`, card.x + 22, card.y + 26, {
        size: 15, color: status.unlocked ? THEME.gold : isNext ? THEME.goldDim : THEME.textWeak,
      });
      text(ctx, node.title, card.x + 22, card.y + 56, {
        size: 24, weight: '600', color: status.unlocked ? THEME.text : THEME.textDim,
        maxWidth: 390,
      });
      text(ctx, node.desc, card.x + 22, card.y + 88, {
        size: 14, color: status.unlocked ? THEME.textDim : THEME.textWeak,
        maxWidth: 390,
      });

      const sx = card.x + card.w - 56;
      if (node.kind === 'troop') {
        ctx.save();
        ctx.globalAlpha = status.unlocked ? 1 : 0.36;
        drawFrame(ctx, sheetFor(node.troop, 0), 'idle', 0, sx, card.y + 106, 0.56, false);
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, card.y + 58, 28, 0, Math.PI * 2);
        ctx.fillStyle = status.unlocked ? '#332c1d' : '#241c12';
        ctx.fill();
        ctx.strokeStyle = status.unlocked ? THEME.goldDim : '#3a4453';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
        text(ctx, node.badge || '?', sx, card.y + 64, {
          size: 25, align: 'center', weight: '600',
          color: status.unlocked ? THEME.gold : '#726450',
        });
      }

      if (status.unlocked) {
        text(ctx, '已解锁', card.x + card.w - 96, card.y + 26, {
          size: 15, align: 'right', color: THEME.gold,
        });
      } else {
        text(ctx, isNext ? `下一目标 · 还差 ${status.remain} 关` : `还差 ${status.remain} 关`,
          card.x + card.w - 96, card.y + 26, {
            size: 14, align: 'right', color: isNext ? THEME.gold : THEME.textWeak,
          });
      }
    });

    ctx.restore();

    // 滚动边界提示
    if (this.maxScroll() > 0) {
      text(ctx, this.scrollY >= this.maxScroll() ? '已到底部' : '上下滑动查看更多',
        713, L.view.y + L.view.h - 8, { size: 13, align: 'right', color: 'rgba(200,210,225,0.4)' });
    }
    // 当前进度（用于核对状态计算）
    text(ctx, `主线进度 ${st.maxCleared} 关`, 37, 1250, {
      size: 14, color: THEME.textWeak,
    });
  }
}
