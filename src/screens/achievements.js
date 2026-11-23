// 成就系统（1.2.5）：分类页签 + 进度条 + 一键领取。
// 每条成就一行，展示「当前要冲的下一档」；领完全部档显示已达成。
import { THEME, text, panel, button, hit, backButton, infoBadge, infoModal } from '../render/draw.js';
import {
  ACHIEVEMENT_CATS, achievementsOfCat, achievementRewardText,
} from '../data/achievements.js';
import {
  achievementStates, achievementNextTier, claimAchievement, claimableCount,
} from '../core/achievements.js';
import { playSfx } from '../core/audio.js';

const ROW_H = 118;
const ROW_GAP = 10;
const ROW_X = 24;
const ROW_W = 702;

export const ACHIEVEMENT_LAYOUT = {
  // 1.2.8 · 6 个页签全部放进 750 宽屏内（6×110 + 5×8 = 700，右缘 724）：
  // 旧值 x0=27/w=132 总宽 837，「经济」被右边缘裁掉且无法拖动看到
  tabs: { y: 136, h: 56, x0: 24, w: 110, gap: 8 },
  view: { x: 24, y: 204, w: 702, h: 946 },
  row: { h: ROW_H, gap: ROW_GAP, x: ROW_X, w: ROW_W },
  infoRect: { x: 652, y: 40, w: 64, h: 64 },
  backRect: { x: 36, y: 44, w: 124, h: 64 },
};

export class AchievementsScreen {
  constructor(game) {
    this.game = game;
    this.bgm = 'main';
    this.cat = 'all';
    this.scrollY = 0;
    this.drag = null;
    this.t = 0;
    this.infoOpen = false;
    this.infoRect = ACHIEVEMENT_LAYOUT.infoRect;
    this.backRect = ACHIEVEMENT_LAYOUT.backRect;
    this.rows = [];
    this.claimRects = [];
  }

  update(dt) { this.t += dt || 0; }

  list() {
    return achievementsOfCat(this.cat === 'all' ? null : this.cat);
  }

  maxScroll() {
    const contentH = this.list().length * (ROW_H + ROW_GAP) - ROW_GAP;
    return Math.max(0, contentH - ACHIEVEMENT_LAYOUT.view.h);
  }

  onDown(x, y) {
    if (this.infoOpen) { this.infoOpen = false; return; }
    if (hit(this.backRect, x, y)) return this.game.pop();
    if (hit(this.infoRect, x, y)) { this.infoOpen = true; return; }
    const T = ACHIEVEMENT_LAYOUT.tabs;
    for (let i = 0; i <= ACHIEVEMENT_CATS.length; i++) {
      const rect = { x: T.x0 + i * (T.w + T.gap), y: T.y, w: T.w, h: T.h };
      if (hit(rect, x, y)) {
        const c = i === 0 ? 'all' : ACHIEVEMENT_CATS[i - 1].id;
        if (this.cat !== c) { this.cat = c; this.scrollY = 0; playSfx('tap', { volume: 0.55 }); }
        return;
      }
    }
    if (hit(ACHIEVEMENT_LAYOUT.view, x, y)) {
      this.drag = { y, scrollY: this.scrollY, moved: false };
    }
  }

  onMove(x, y) {
    if (!this.drag) return;
    const dy = this.drag.y - y;
    if (Math.abs(dy) > 5) this.drag.moved = true;
    this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.drag.scrollY + dy));
  }

  onUp(x, y) {
    const d = this.drag;
    this.drag = null;
    if (d && d.moved) return;
    for (const c of this.claimRects) {
      if (!hit(c.rect, x, y)) continue;
      const g = this.game;
      const r = claimAchievement(g.state, c.id, c.index);
      if (r.ok) {
        g.save();
        playSfx('buy');
        g.toast(`成就达成：铜钱 +${r.coins}${r.chest ? ' · 宝箱已入仓' : ''}`);
      } else {
        playSfx('error', { volume: 0.7 });
        g.toast(r.reason === 'claimed' ? '该档奖励已领取' : '还未达成');
      }
      return;
    }
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const claimable = claimableCount(st);

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '成 就 系 统', W / 2 + 20, 72, { size: 38, weight: '700', align: 'center', color: THEME.gold });
    infoBadge(ctx, this.infoRect.x + 32, this.infoRect.y + 32, 24);

    text(ctx, claimable > 0 ? `可领取 ${claimable} 项` : '暂无可领取成就',
      30, 152, { size: 22, weight: '600', color: claimable > 0 ? THEME.gold : THEME.textDim });
    text(ctx, '奖励直接入账：铜钱 + 宝箱', W - 30, 152, {
      size: 19, align: 'right', color: THEME.textWeak, maxWidth: 320,
    });

    // 分类页签：全部 + 5 类
    const T = ACHIEVEMENT_LAYOUT.tabs;
    const tabs = [{ id: 'all', name: '全 部' }, ...ACHIEVEMENT_CATS];
    tabs.forEach((t, i) => {
      const rect = { x: T.x0 + i * (T.w + T.gap), y: T.y, w: T.w, h: T.h };
      const n = achievementsOfCat(t.id === 'all' ? null : t.id).length;
      button(ctx, rect, t.name, {
        size: 19, sub: `${n} 条`, subSize: 13, active: this.cat === t.id,
      });
    });

    this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.scrollY));
    const V = ACHIEVEMENT_LAYOUT.view;
    this.rows = [];
    this.claimRects = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(V.x, V.y, V.w, V.h);
    ctx.clip();
    this.list().forEach((a, i) => {
      const y = V.y + i * (ROW_H + ROW_GAP) - this.scrollY;
      if (y + ROW_H < V.y || y > V.y + V.h) return;
      const rect = { x: ROW_X, y, w: ROW_W, h: ROW_H };
      const states = achievementStates(a, st);
      const next = achievementNextTier(a, st);
      const allDone = !next;
      const claimable = next && next.claimable;
      this.rows.push({ rect, id: a.id });

      panel(ctx, rect.x, rect.y, rect.w, rect.h, {
        fill: claimable ? 'rgba(45,38,20,0.92)' : '#171e29',
        stroke: claimable ? THEME.gold : THEME.line,
        r: 12, lw: claimable ? 2 : 1,
      });
      text(ctx, a.name, rect.x + 16, rect.y + 30, {
        size: 21, weight: '600', color: claimable ? THEME.gold : allDone ? THEME.green : THEME.text,
      });
      text(ctx, a.desc, rect.x + 16, rect.y + 56, { size: 14, color: THEME.textDim, maxWidth: 360 });
      text(ctx, `档位 ${states.filter((s) => s.claimed).length}/${states.length} · 奖励 ${achievementRewardText(
        allDone ? states[states.length - 1] : { ...next },
      )}`, rect.x + 400, rect.y + 30, {
        size: 14, color: allDone ? THEME.green : THEME.gold, maxWidth: 130,
      });

      if (allDone) {
        text(ctx, '已全部达成', rect.x + 16, rect.y + 96, { size: 15, color: THEME.green });
      } else {
        // 进度条：当前累计 / 本档目标
        const barX = rect.x + 16;
        const barY = rect.y + 72;
        const barW = 360;
        const ratio = next.n > 0 ? Math.min(1, next.progress / next.n) : 0;
        panel(ctx, barX, barY, barW, 16, { fill: '#100c08', stroke: '#2a3442', r: 8, lw: 1 });
        if (ratio > 0) {
          panel(ctx, barX, barY, Math.max(8, barW * ratio), 16, {
            fill: claimable ? THEME.gold : THEME.green, stroke: null, r: 8, lw: 0,
          });
        }
        text(ctx, `${Math.min(next.progress, next.n)} / ${next.n}`, barX, rect.y + 108, {
          size: 14, color: claimable ? THEME.gold : THEME.textDim,
        });
      }

      const btnRect = { x: rect.x + rect.w - 156, y: rect.y + 34, w: 140, h: 52 };
      if (allDone) {
        button(ctx, btnRect, '已达成', { size: 20, disabled: true });
      } else if (claimable) {
        button(ctx, btnRect, '领 取', { size: 22, fill: 'rgba(58,46,30,0.9)', stroke: THEME.gold, textColor: THEME.gold });
        this.claimRects.push({ rect: btnRect, id: a.id, index: next.index });
      } else {
        button(ctx, btnRect, `差 ${next.n - next.progress}`, { size: 18, disabled: true });
      }
    });
    ctx.restore();

    // 滚动条
    const max = this.maxScroll();
    if (max > 0) {
      const x = V.x + V.w - 8;
      panel(ctx, x, V.y + 2, 4, V.h - 4, { fill: 'rgba(255,255,255,0.07)', stroke: null, r: 2, lw: 0 });
      const ratio = V.h / (V.h + max);
      const bh = Math.max(26, (V.h - 4) * ratio);
      const by = V.y + 2 + (V.h - 4 - bh) * (this.scrollY / max);
      panel(ctx, x - 1, by, 6, bh, { fill: 'rgba(213,153,71,0.75)', stroke: null, r: 3, lw: 0 });
    }

    if (this.infoOpen) this.drawInfo(ctx, W);
  }

  drawInfo(ctx, W) {
    infoModal(ctx, W, this.game.H, '成 就 说 明', [
      '成就按「累计值」统计：战斗、开箱、扫荡、周常首通都不受每日 / 每周重置影响。',
      '每条成就分 2~3 档，达标后点「领取」，铜钱与宝箱直接入账，不能重复领取。',
      '主线、演武、英雄战、斩将、每日 / 周常挑战的进度都会推进对应成就。',
      '图鉴与养成类成就看的是兵种解锁、英雄持有、兵书、器械等级与满级兵牌。',
      `奖励按档位递增：最高档可达铜钱 6000 + 高品宝箱。`,
    ]);
  }
}
