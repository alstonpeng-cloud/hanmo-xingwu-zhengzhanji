// 每日挑战关卡选择（1.2.5，1.2.8 改版）：主线 30 关后解锁，30 关按顺序推进。
// 前 12 关单英雄（史诗→传奇）、13~24 双将、25~30 三将，难度对标主线 300 → 2000 关。
// 1.2.8 · 卡面去掉英雄模型（太塑料）：只写「第 N 关 + 敌军战力数字」，
// 卡片整体放大 128×150 → 168×164（5 列 → 4 列），手机上看得清。
import { THEME, text, panel, hit, backButton, infoBadge, infoModal } from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import {
  dailyBattleDef, dailyBattlePower, dailyUnlocked, dailyStageUnlocked,
  dailyClearedCount, dailyFirstClearReward,
} from '../data/dailyChallenge.js';
import { ensureDaily } from '../core/daily.js';
import { formatPower } from '../core/power.js';
import { DeployScreen } from './deploy.js';
import { playSfx } from '../core/audio.js';

const COLS = 4;
const CARD_W = 168;
const CARD_H = 164;
const GAP_X = 10;
const GAP_Y = 12;
const X0 = 24;
const Y0 = 210;

export const DAILY_LAYOUT = {
  cols: COLS, cardW: CARD_W, cardH: CARD_H, gapX: GAP_X, gapY: GAP_Y, x0: X0, y0: Y0,
  view: { x: 24, y: 204, w: 702, h: 792 },
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

export class DailyChallengeScreen {
  constructor(game) {
    this.game = game;
    this.bgm = 'main';
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.cardRects = [];
    this.scrollY = 0;
    this.drag = null;
    this.t = 0;
    this.infoOpen = false;
    this.infoRect = { x: 652, y: 40, w: 64, h: 64 };
  }

  update(dt) { this.t += dt || 0; }

  maxScroll() {
    const rows = Math.ceil(CONFIG.dailyChallenge.total / COLS);
    const contentH = rows * (CARD_H + GAP_Y) - GAP_Y;
    return Math.max(0, contentH - DAILY_LAYOUT.view.h);
  }

  onDown(x, y) {
    if (this.infoOpen) { this.infoOpen = false; return; }
    if (hit(this.backRect, x, y)) return this.game.pop();
    if (hit(this.infoRect, x, y)) { this.infoOpen = true; return; }
    if (hit(DAILY_LAYOUT.view, x, y)) {
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
    const g = this.game;
    const st = g.state;
    for (const c of this.cardRects) {
      if (!hit(c.rect, x, y)) continue;
      if (!c.unlocked) {
        playSfx('error', { volume: 0.7 });
        if (!dailyUnlocked(st)) {
          g.toast(`主线通关 ${CONFIG.dailyChallenge.unlockLevel} 关后解锁（还差 ${CONFIG.dailyChallenge.unlockLevel - (st.maxCleared || 0)} 关）`);
        } else {
          g.toast(`先通关第 ${c.stage - 1} 关`);
        }
        return;
      }
      g.push(new DeployScreen(g, {
        mode: 'battle',
        level: c.stage,
        heroBattle: c.def,
        dailyChallenge: { stage: c.stage },
        def: c.def,
      }));
      return;
    }
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const total = CONFIG.dailyChallenge.total;
    const cleared = dailyClearedCount(st);
    const unlockedAll = dailyUnlocked(st);
    const day = ensureDaily(st);

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '每 日 挑 战', W / 2 + 20, 72, { size: 38, weight: '700', align: 'center', color: THEME.gold });
    infoBadge(ctx, this.infoRect.x + 32, this.infoRect.y + 32, 24);

    text(ctx, `已通关 ${cleared} / ${total} 关`, 37, 156, { size: 24, color: THEME.text });
    const winLeft = Math.max(0, CONFIG.dailyChallenge.dailyWinLimit - (day.dailyWins || 0));
    text(ctx, `今日重复胜奖 ${winLeft} / ${CONFIG.dailyChallenge.dailyWinLimit} 剩余`, 713, 156, {
      size: 22, align: 'right', color: winLeft > 0 ? THEME.gold : THEME.textDim, maxWidth: 320,
    });
    this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.scrollY));

    this.cardRects = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(DAILY_LAYOUT.view.x, DAILY_LAYOUT.view.y, DAILY_LAYOUT.view.w, DAILY_LAYOUT.view.h);
    ctx.clip();
    for (let i = 0; i < total; i++) {
      const stage = i + 1;
      const rect = cardRect(i, this.scrollY);
      if (rect.y + rect.h < DAILY_LAYOUT.view.y || rect.y > DAILY_LAYOUT.view.y + DAILY_LAYOUT.view.h) continue;
      const unlocked = dailyStageUnlocked(st, stage);
      const done = stage <= cleared;
      const current = unlocked && !done;
      const def = dailyBattleDef(stage);
      this.cardRects.push({ rect, stage, unlocked, def });

      // 1.2.8 · 卡面只写「第 N 关 + 敌军战力」：去掉英雄模型 / 将名 / 血量倍率行
      panel(ctx, rect.x, rect.y, rect.w, rect.h, {
        fill: done ? 'rgba(58,46,30,0.82)' : unlocked ? '#2b2217' : '#17130e',
        stroke: done ? THEME.gold : current ? THEME.green : THEME.line,
        r: 14, lw: current ? 2.5 : 1.5,
      });

      text(ctx, `第 ${stage} 关`, rect.x + 12, rect.y + 26, {
        size: 18, weight: '600', color: done ? THEME.gold : unlocked ? THEME.text : THEME.textWeak,
      });
      text(ctx, done ? '已通关' : current ? '可挑战' : '未解锁', rect.x + rect.w - 12, rect.y + 26, {
        size: 14, align: 'right', color: done ? THEME.gold : current ? THEME.green : THEME.textWeak,
      });

      // 战力大数字（卡面主角）
      text(ctx, '敌军战力', rect.x + rect.w / 2, rect.y + 62, {
        size: 13, align: 'center', color: unlocked ? THEME.textDim : THEME.textWeak,
      });
      text(ctx, formatPower(dailyBattlePower(stage, def)), rect.x + rect.w / 2, rect.y + 96, {
        size: 28, weight: '700', align: 'center',
        color: done ? THEME.gold : unlocked ? THEME.text : THEME.textWeak,
        maxWidth: rect.w - 12,
      });

      // 底部一行：可挑战 → 首通奖励；已通关 → 可重复；未解锁 → 差哪关
      if (unlocked) {
        const r = dailyFirstClearReward(stage);
        text(ctx, done ? '可重复挑战（有日限奖励）' : `首通 ${r.coins} 钱 · ${chestName(r.chest)}`,
          rect.x + rect.w / 2, rect.y + 142, {
            size: 13, align: 'center', color: done ? THEME.textWeak : THEME.gold, maxWidth: rect.w - 8,
          });
      } else {
        text(ctx, !unlockedAll
          ? `需主线 ${CONFIG.dailyChallenge.unlockLevel} 关`
          : `需通关第 ${stage - 1} 关`,
        rect.x + rect.w / 2, rect.y + 142, {
          size: 13, align: 'center', color: THEME.textWeak, maxWidth: rect.w - 8,
        });
      }
    }
    ctx.restore();

    const max = this.maxScroll();
    if (max > 0) {
      const V = DAILY_LAYOUT.view;
      const x = V.x + V.w - 8;
      panel(ctx, x, V.y + 2, 4, V.h - 4, { fill: 'rgba(255,255,255,0.07)', stroke: null, r: 2, lw: 0 });
      const ratio = V.h / (V.h + max);
      const h = Math.max(26, (V.h - 4) * ratio);
      const sy = V.y + 2 + (V.h - 4 - h) * (this.scrollY / max);
      panel(ctx, x - 1, sy, 6, h, { fill: 'rgba(213,153,71,0.75)', stroke: null, r: 3, lw: 0 });
    }

    if (!unlockedAll) {
      text(ctx, `主线还差 ${CONFIG.dailyChallenge.unlockLevel - (st.maxCleared || 0)} 关解锁每日挑战`, 375, 1060, {
        size: 22, align: 'center', color: THEME.red,
      });
    }
    if (this.infoOpen) this.drawInfo(ctx, W);
  }

  drawInfo(ctx, W) {
    const cfg = CONFIG.dailyChallenge;
    infoModal(ctx, W, this.game.H, '每 日 挑 战 说 明', [
      `主线 ${cfg.unlockLevel} 关后开放；${cfg.total} 关按顺序推进，不能跳关。`,
      '每关由敌方英雄带队：前 12 关单将（史诗→传奇），13~24 关双将，25 关起三将同时登场。',
      '敌军对标主线 300 → 2000 关满编强度，Boss 血量从 ×3 抬到 ×12。',
      '首通永久记录：铜钱 800 起逐关递增（上限 20000），并按进度发小木箱 / 白银宝箱 / 稀有箱。',
      `重复挑战每天前 ${cfg.dailyWinLimit} 胜各发铜钱 ${cfg.dailyWinCoins} + 小木箱。`,
      '已解锁的英雄、器械、兵书在本模式同样生效，练度越高越稳。',
      '上下滑动查看全部关卡。',
    ]);
  }
}

const CHEST_NAMES = { wood: '小木箱', silver: '白银宝箱', rare: '稀有箱' };
function chestName(id) {
  return CHEST_NAMES[id] || id;
}
