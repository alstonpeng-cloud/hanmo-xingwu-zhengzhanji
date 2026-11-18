// 英雄战关卡选择：主线 250 关后开放，150 关按顺序推进；每 10 关首通 1 张招募券
import { THEME, text, panel, button, hit, backButton, infoBadge, infoModal } from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import {
  HERO_BATTLES, heroBattleUnlocked, heroBattleDef,
} from '../data/heroBattles.js';
import { heroById } from '../data/heroes.js';
import { drawHeroFigure, drawHeroAura, heroAuraColor } from '../render/heroArt.js';
import { DeployScreen } from './deploy.js';
import { playSfx } from '../core/audio.js';

const COLS = 5;
const CARD_W = 128;
const CARD_H = 142;
const GAP_X = 8;
const GAP_Y = 12;
const X0 = 37;
const Y0 = 210;

export const HERO_BATTLE_LAYOUT = {
  cols: COLS, cardW: CARD_W, cardH: CARD_H, gapX: GAP_X, gapY: GAP_Y, x0: X0, y0: Y0,
  // 150 关改成连续滚动列表（上下拖动查看，底部说明保留）
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

export class HeroBattleScreen {
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
    const rows = Math.ceil(HERO_BATTLES.length / COLS);
    const contentH = rows * (CARD_H + GAP_Y) - GAP_Y;
    return Math.max(0, contentH - HERO_BATTLE_LAYOUT.view.h);
  }

  onDown(x, y) {
    if (this.infoOpen) { this.infoOpen = false; return; }
    if (hit(this.backRect, x, y)) return this.game.pop();
    if (hit(this.infoRect, x, y)) { this.infoOpen = true; return; }
    if (hit(HERO_BATTLE_LAYOUT.view, x, y)) {
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
    if (d && d.moved) return;   // 上下滑动后抬起不算点击
    const g = this.game;
    const st = g.state;
    for (const c of this.cardRects) {
      if (!hit(c.rect, x, y)) continue;
      if (!c.unlocked) {
        playSfx('error', { volume: 0.7 });
        if ((st.maxCleared || 0) < CONFIG.heroBattles.unlockLevel) {
          g.toast(`主线通关 ${CONFIG.heroBattles.unlockLevel} 关后解锁（还差 ${CONFIG.heroBattles.unlockLevel - (st.maxCleared || 0)} 关）`);
        } else {
          g.toast(`先通关英雄战第 ${c.spec.stage - 1} 关`);
        }
        return;
      }
      g.push(new DeployScreen(g, {
        mode: 'battle', level: c.spec.stage, heroBattle: c.spec, def: heroBattleDef(c.spec.stage),
      }));
      return;
    }
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const cleared = Math.max(0, Math.min(CONFIG.heroBattles.total, st.heroBattleCleared || 0));
    const unlockedAll = (st.maxCleared || 0) >= CONFIG.heroBattles.unlockLevel;

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,18,12,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '英 雄 战', W / 2 + 20, 72, { size: 38, weight: '700', align: 'center', color: THEME.gold });
    infoBadge(ctx, this.infoRect.x + 32, this.infoRect.y + 32, 24);

    text(ctx, `已通关 ${cleared} / ${CONFIG.heroBattles.total} 关`, 37, 156, {
      size: 24, color: THEME.text,
    });
    text(ctx, `招募券 ${st.heroTickets || 0} 张`, 713, 156, {
      size: 22, align: 'right', color: THEME.gold, maxWidth: 300,
    });
    this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.scrollY));

    this.cardRects = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(HERO_BATTLE_LAYOUT.view.x, HERO_BATTLE_LAYOUT.view.y, HERO_BATTLE_LAYOUT.view.w, HERO_BATTLE_LAYOUT.view.h);
    ctx.clip();
    HERO_BATTLES.forEach((spec, i) => {
      const rect = cardRect(i, this.scrollY);
      if (rect.y + rect.h < HERO_BATTLE_LAYOUT.view.y || rect.y > HERO_BATTLE_LAYOUT.view.y + HERO_BATTLE_LAYOUT.view.h) return;
      const unlocked = heroBattleUnlocked(spec.stage, st.maxCleared, cleared);
      const done = spec.stage <= cleared;
      const current = unlocked && !done;
      this.cardRects.push({ rect, spec, unlocked });

      const hero = heroById(spec.hero);
      const aura = hero ? heroAuraColor(hero) : THEME.gold;
      const tierName = hero && hero.tier === 'legendary' ? '传奇' : '史诗';
      panel(ctx, rect.x, rect.y, rect.w, rect.h, {
        fill: done ? 'rgba(58,46,22,0.82)' : unlocked ? '#2b2217' : '#1c1610',
        stroke: done ? THEME.gold : current ? aura : THEME.line,
        r: 12, lw: current ? 2 : 1,
      });

      text(ctx, `第 ${spec.stage} 关`, rect.x + 10, rect.y + 20, {
        size: 14, color: done ? THEME.gold : unlocked ? THEME.textDim : THEME.textWeak,
      });
      text(ctx, done ? '已通关' : current ? '可挑战' : '未解锁', rect.x + rect.w - 10, rect.y + 20, {
        size: 12, align: 'right', color: done ? THEME.gold : current ? aura : THEME.textWeak,
      });

      if (hero) {
        drawHeroAura(ctx, hero.tier, rect.x + rect.w / 2, rect.y + 74, 40, this.t + spec.stage * 0.4, unlocked ? 0.85 : 0.3);
        drawHeroFigure(ctx, hero.id, {
          x: rect.x + rect.w / 2, y: rect.y + 78, size: 48,
          action: 'idle', t: this.t + spec.stage * 0.2, alpha: unlocked ? 1 : 0.38, flip: true,
        });
      }

      const bossCount = (spec.bosses && spec.bosses.length) || 1;
      text(ctx, bossCount > 1 ? '三英' : (hero ? hero.name : '英雄'), rect.x + rect.w / 2, rect.y + 106, {
        size: 16, weight: '600', align: 'center',
        color: done ? THEME.gold : unlocked ? (hero ? hero.color : THEME.text) : THEME.textWeak,
        maxWidth: rect.w - 14,
      });
      if (unlocked) {
        text(ctx, `${bossCount > 1 ? '三英同时登场' : tierName} · Lv${spec.heroLevel} · 血量 ×${spec.hpMult}`, rect.x + rect.w / 2, rect.y + 128, {
          size: 12, align: 'center', color: tierColorFor(hero, done), maxWidth: rect.w - 10,
        });
      } else {
        text(ctx, (st.maxCleared || 0) < CONFIG.heroBattles.unlockLevel ? '需主线 250 关' : `需通关第 ${spec.stage - 1} 关`,
          rect.x + rect.w / 2, rect.y + 128, { size: 11, align: 'center', color: THEME.textWeak });
      }
    });
    ctx.restore();

    const max = this.maxScroll();
    if (max > 0) {
      const V = HERO_BATTLE_LAYOUT.view;
      const x = V.x + V.w - 8;
      panel(ctx, x, V.y + 2, 4, V.h - 4, { fill: 'rgba(255,255,255,0.07)', stroke: null, r: 2, lw: 0 });
      const ratio = V.h / (V.h + max);
      const h = Math.max(26, (V.h - 4) * ratio);
      const sy = V.y + 2 + (V.h - 4 - h) * (this.scrollY / max);
      panel(ctx, x - 1, sy, 6, h, { fill: 'rgba(216,180,106,0.75)', stroke: null, r: 3, lw: 0 });
    }

    if (!unlockedAll) {
      text(ctx, `主线还差 ${CONFIG.heroBattles.unlockLevel - (st.maxCleared || 0)} 关解锁英雄战`, 375, 1060, {
        size: 22, align: 'center', color: THEME.red,
      });
    }
    if (this.infoOpen) this.drawInfo(ctx, W);
  }

  drawInfo(ctx, W) {
    infoModal(ctx, W, this.game.H, '英 雄 战 说 明', [
      '主线 250 关后开放；150 关按顺序推进，不能跳关。',
      '每 10 关首通 +1 张招募券，是本模式的额外来源。',
      '敌将血量随关号从 5 倍抬到 24 倍；前 6 关史诗，第 7 关起传奇。',
      '敌将按兵种分列：近战第一排、骑兵第二排、远程压后排，前面有精锐掩护。',
      '远程 Boss 要先打穿前排精锐才能集火，骑兵 / 远程兵和英雄的位置很关键。',
      '第 150 关三名英雄同时登场，是最终目标。',
      '上下滑动查看全部 150 关。',
    ]);
  }
}

function tierColorFor(hero, done) {
  if (hero && hero.tier === 'legendary') return done ? THEME.gold : '#b3934f';
  return done ? THEME.gold : '#b3a1c2';
}
