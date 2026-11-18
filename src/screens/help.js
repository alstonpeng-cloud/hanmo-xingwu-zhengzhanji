// 引导手册：设置面板里的「新手引导」入口
// 只做两件事：看哪些已经触发过 + 随时重看（重看不改存档，也不再自动弹）
import { THEME, text, panel, button, hit, backButton } from '../render/draw.js';
import { TUTORIAL_STEPS, tutorialSeen } from '../core/tutorial.js';

const ROW_H = 96;
const ROW_GAP = 10;
const X = 44;
const W = 662;

export const HELP_LAYOUT = {
  rows: { x: X, y: 226, w: W, h: ROW_H, gap: ROW_GAP },
  back: { x: 36, y: 44, w: 124, h: 64 },
};

export class HelpScreen {
  constructor(game) {
    this.game = game;
    this.backRect = HELP_LAYOUT.back;
    this.rows = [];
  }

  update() {}

  tap(x, y) {
    const g = this.game;
    if (hit(this.backRect, x, y)) return g.pop();
    for (const r of this.rows) {
      if (hit(r.rect, x, y)) {
        g.replayTutorial(r.id);
        return;
      }
    }
  }

  draw(ctx) {
    const g = this.game;
    const WIDTH = g.W;

    panel(ctx, 0, 0, WIDTH, 118, { fill: 'rgba(23,18,12,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '引 导 手 册', WIDTH / 2 + 20, 76, { size: 34, weight: '600', align: 'center' });

    text(ctx, '每条引导只自动出现一次，通关进度不会重复弹', 44, 152, {
      size: 19, color: THEME.textDim,
    });
    text(ctx, '点任意一条进入对应界面重做教学（不会写入存档）', 44, 184, {
      size: 18, color: THEME.textWeak,
    });

    this.rows = [];
    TUTORIAL_STEPS.forEach((step, i) => {
      const rect = { x: X, y: HELP_LAYOUT.rows.y + i * (ROW_H + ROW_GAP), w: W, h: ROW_H };
      if (rect.y + rect.h > 1232) return;
      this.rows.push({ id: step.id, rect });
      panel(ctx, rect.x, rect.y, rect.w, rect.h, {
        fill: 'rgba(26,35,50,0.9)',
        stroke: THEME.goldDim,
        r: 16,
        lw: 2,
      });
      text(ctx, step.name, rect.x + 22, rect.y + 36, {
        size: 23, color: THEME.text, maxWidth: rect.w - 190,
      });
      text(ctx, step.action, rect.x + 22, rect.y + 68, {
        size: 18, color: THEME.goldDim, maxWidth: rect.w - 190,
      });
      const seen = tutorialSeen(g.state, step.id);
      button(ctx, { x: rect.x + rect.w - 132, y: rect.y + 24, w: 112, h: 48 },
        seen ? '重 看' : '查 看', {
          size: 19,
          fill: seen ? '#4a3a24' : '#332c1d',
          stroke: seen ? THEME.line : THEME.goldDim,
          textColor: seen ? THEME.textDim : THEME.gold,
        });
    });
  }
}
