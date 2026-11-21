// 序章战败结算：一屏只讲一件事 —— 东山再起。
import { THEME, text, button, hit, screenDim } from '../render/draw.js';
import { drawGameTitle } from '../render/title.js';
import { playSfx } from '../core/audio.js';

export class PrologueResultScreen {
  constructor(game) {
    this.game = game;
    this.bgm = 'main';
    this.noTapSound = true;
    this.primary = { x: 125, y: 948, w: 500, h: 96 };
    playSfx('defeat', { volume: 0.75 });
  }

  update() {}

  tap(x, y) {
    if (hit(this.primary, x, y)) {
      playSfx('tap', { volume: 0.8 });
      this.game.finishPrologue();
    }
  }

  draw(ctx) {
    const g = this.game;
    screenDim(ctx, g.W, g.H, 0.84);
    drawGameTitle(ctx, g.W / 2, 240, 52, { fallbackSize: 30 });
    text(ctx, '败 北', g.W / 2, 360, {
      size: 72, weight: '800', align: 'center', color: THEME.red,
    });
    text(ctx, '东山再起', g.W / 2, 500, {
      size: 84, weight: '700', align: 'center', color: THEME.gold,
    });
    text(ctx, '兵牌清空 · 从第 1 关开始', g.W / 2, 660, {
      size: 28, align: 'center', color: THEME.textDim,
    });
    button(ctx, this.primary, '从第 1 关开始', {
      size: 32, fill: '#273038', stroke: THEME.gold, textColor: THEME.gold,
    });
  }
}
