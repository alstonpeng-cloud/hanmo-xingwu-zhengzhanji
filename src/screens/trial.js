// 演武（精英挑战）关卡选择：150 关后解锁，每 10 关开一关，共 25 关
import { THEME, text, panel, button, hit, backButton } from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import { TRIALS, trialUnlocked, trialUnlockLevel } from '../data/trials.js';
import { rarityOf } from '../core/units.js';
import { DeployScreen } from './deploy.js';
import { playSfx } from '../core/audio.js';

const COLS = 5;
const CARD_W = 128;
const CARD_H = 142;
const GAP_X = 8;
const GAP_Y = 12;
const X0 = 37;
const Y0 = 210;

export const TRIAL_LAYOUT = {
  cols: COLS, cardW: CARD_W, cardH: CARD_H, gapX: GAP_X, gapY: GAP_Y, x0: X0, y0: Y0,
  // 50 关改成一个可上下滑动的连续列表（视口内显示 5 行左右，手指上下拖）
  view: { x: 24, y: 204, w: 702, h: 812 },
  scrollHintY: 191,
};

function cardRect(i, scrollY = 0) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return {
    x: X0 + col * (CARD_W + GAP_X),
    y: Y0 + row * (CARD_H + GAP_Y) - scrollY,
    w: CARD_W, h: CARD_H,
  };
}

export class TrialScreen {
  constructor(game) {
    this.game = game;
    this.bgm = 'main';
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.cardRects = [];
    this.scrollY = 0;
    this.drag = null;
    this.t = 0;
  }

  update(dt) { this.t += dt; }

  maxScroll() {
    const rows = Math.ceil(TRIALS.length / COLS);
    const contentH = rows * (CARD_H + GAP_Y) - GAP_Y;
    return Math.max(0, contentH - TRIAL_LAYOUT.view.h);
  }

  onDown(x, y) {
    if (hit(this.backRect, x, y)) return this.game.pop();
    if (hit(TRIAL_LAYOUT.view, x, y)) {
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
    if (d && d.moved) return;   // 上下滑动了就不当点击
    const g = this.game;
    const st = g.state;
    for (const c of this.cardRects) {
      if (!hit(c.rect, x, y)) continue;
      if (!c.unlocked) {
        playSfx('error', { volume: 0.7 });
        if (st.maxCleared < c.needLevel) g.toast(`主线通关 ${c.needLevel} 关后解锁（还差 ${c.needLevel - st.maxCleared} 关）`);
        else g.toast(`先通关演武第 ${c.trial.stage - 1} 关`);
        return;
      }
      g.push(new DeployScreen(g, {
        mode: 'battle', level: c.trial.stage, trial: c.trial, def: c.trial,
      }));
      return;
    }
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const cleared = Math.max(0, Math.min(CONFIG.trials.total, st.trialCleared || 0));

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '演 武', W / 2 + 20, 56, { size: 34, weight: '600', align: 'center', color: THEME.gold });
    text(ctx, `精英挑战 · 已通关 ${cleared} / ${CONFIG.trials.total} 关`, W / 2 + 20, 92, {
      size: 18, align: 'center', color: THEME.textDim,
    });

    text(ctx, `主线 ${CONFIG.trials.unlockLevel} 关解锁，每过 ${CONFIG.trials.every} 关开 1 关`, 37, 152, {
      size: 17, color: THEME.textWeak,
    });
    text(ctx, '敌方全为特殊兵种：兵少、等级高，按克制与站位智取', 713, 152, {
      size: 16, align: 'right', color: THEME.textWeak, maxWidth: 340,
    });
    // 连续滚动列表：全部 50 关按顺序铺开，手指上下拖动（与点击互不冲突）
    text(ctx, '上下滑动浏览全部关卡', 713, 191, {
      size: 14, align: 'right', color: THEME.textDim,
    });
    this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.scrollY));

    this.cardRects = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(TRIAL_LAYOUT.view.x, TRIAL_LAYOUT.view.y, TRIAL_LAYOUT.view.w, TRIAL_LAYOUT.view.h);
    ctx.clip();
    TRIALS.forEach((trial, i) => {
      const rect = cardRect(i, this.scrollY);
      if (rect.y + rect.h < TRIAL_LAYOUT.view.y || rect.y > TRIAL_LAYOUT.view.y + TRIAL_LAYOUT.view.h) return;
      const needLevel = trialUnlockLevel(trial.stage);
      const unlocked = trialUnlocked(trial.stage, st.maxCleared, cleared);
      const done = trial.stage <= cleared;
      const current = unlocked && !done;
      this.cardRects.push({ rect, trial, unlocked, needLevel });

      const rar = { rare: 0, epic: 0, legendary: 0 };
      trial.enemies.forEach((e) => { rar[rarityOf(e.troop)]++; });

      panel(ctx, rect.x, rect.y, rect.w, rect.h, {
        fill: done ? 'rgba(58,46,30,0.82)' : unlocked ? '#2b2217' : '#17130e',
        stroke: done ? THEME.gold : current ? THEME.goldDim : THEME.line,
        r: 12, lw: current ? 2 : 1,
      });

      text(ctx, `第 ${trial.stage} 关`, rect.x + 10, rect.y + 20, {
        size: 14, color: done ? THEME.gold : unlocked ? THEME.textDim : THEME.textWeak,
      });
      text(ctx, trial.name, rect.x + rect.w / 2, rect.y + 50, {
        size: 16, weight: '600', align: 'center',
        color: done ? THEME.gold : unlocked ? THEME.text : THEME.textWeak,
        maxWidth: rect.w - 14,
      });
      text(ctx, `Lv${trial.enemyLevel}~${trial.enemyLevelMax} · ${trial.enemies.length} 队`, rect.x + rect.w / 2, rect.y + 78, {
        size: 13, align: 'center', color: unlocked ? THEME.textDim : THEME.textWeak,
      });

      // 品级小点：稀有 / 史诗 / 传奇
      let dotX = rect.x + 20;
      ['rare', 'epic', 'legendary'].forEach((id) => {
        const n = rar[id];
        if (!n) return;
        const color = (CONFIG.rarity[id] && CONFIG.rarity[id].color) || THEME.textDim;
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(dotX, rect.y + 101, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        text(ctx, `${n}`, dotX + 8, rect.y + 101, { size: 11, color });
        dotX += 26;
      });

      if (done) {
        text(ctx, '已通关', rect.x + rect.w / 2, rect.y + 124, {
          size: 15, align: 'center', color: THEME.gold,
        });
      } else if (unlocked) {
        text(ctx, '点 击 挑 战', rect.x + rect.w / 2, rect.y + 124, {
          size: 15, align: 'center', color: current ? THEME.gold : THEME.textDim,
        });
      } else {
        const need = st.maxCleared < needLevel
          ? `主线 ${needLevel} 关`
          : `先胜第 ${trial.stage - 1} 关`;
        text(ctx, `锁定 · ${need}`, rect.x + rect.w / 2, rect.y + 124, {
          size: 13, align: 'center', color: THEME.textWeak, maxWidth: rect.w - 10,
        });
      }
    });
    ctx.restore();

    // 滚动条：内容超出视口时显示当前位置
    const max = this.maxScroll();
    if (max > 0) {
      const V = TRIAL_LAYOUT.view;
      const x = V.x + V.w - 8;
      panel(ctx, x, V.y + 2, 4, V.h - 4, { fill: 'rgba(255,255,255,0.07)', stroke: null, r: 2, lw: 0 });
      const ratio = V.h / (V.h + max);
      const h = Math.max(26, (V.h - 4) * ratio);
      const sy = V.y + 2 + (V.h - 4 - h) * (this.scrollY / max);
      panel(ctx, x - 1, sy, 6, h, { fill: 'rgba(213,153,71,0.75)', stroke: null, r: 3, lw: 0 });
    }

    const lockedAll = st.maxCleared < CONFIG.trials.unlockLevel;
    panel(ctx, 70, 1030, 610, 120, { fill: 'rgba(43,34,23,0.6)', stroke: THEME.line, r: 16 });
    if (lockedAll) {
      text(ctx, `演武在主线通关 ${CONFIG.trials.unlockLevel} 关后开放`, 375, 1062, {
        size: 20, align: 'center', color: THEME.text,
      });
      text(ctx, `当前已通关 ${st.maxCleared} / ${CONFIG.trials.unlockLevel} 关（还差 ${CONFIG.trials.unlockLevel - st.maxCleared} 关）`, 375, 1100, {
        size: 17, align: 'center', color: THEME.textDim,
      });
    } else {
      const nextStage = Math.min(CONFIG.trials.total, cleared + 1);
      const nextNeed = trialUnlockLevel(nextStage);
      text(ctx, '每胜利一关解锁下一关；失败可重新布阵再挑战', 375, 1062, {
        size: 19, align: 'center', color: THEME.text,
      });
      text(ctx, st.maxCleared >= nextNeed
        ? `当前可挑战：第 ${nextStage} 关 · 首通宝箱 + 每次小额铜钱`
        : `下一关：第 ${nextStage} 关 · 需主线通关 ${nextNeed} 关`, 375, 1100, {
        size: 17, align: 'center', color: THEME.textDim,
      });
    }
  }
}
