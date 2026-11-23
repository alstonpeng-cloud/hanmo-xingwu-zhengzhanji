// 兵营：全部单位的小兵牌网格（容量 300），支持拖拽合成
// 拖一张兵牌到另一个同兵种同等级的兵牌上 = 合到它身上（目标 +1 级，拖动的被消耗）
// 点兵牌进详情页（可看属性 / 合成）；底部「一键合成」把全兵营两两合到不能再合
import { THEME, text, panel, button, coinBadge, hit, backButton, roundRectPath } from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import {
  engineList, engineUnlocked, engineUnlockLevel, engineTier, engineStats,
  engineUpgradeCost, upgradeEngine, engineChoice, engineName,
} from '../core/siege.js';
import { drawEngineFigure } from '../render/engineArt.js';
import { ART as ART_PATHS, drawArt } from '../render/packageArt.js';
import { rosterSlots } from '../core/levels.js';
import { autoMerge, AUTO_MERGE_MIN_UNITS } from '../core/merge.js';
import { sortUnits, troopUnlocked, troopUnlockLevel } from '../core/units.js';
import {
  CARD, drawUnitCard, drawUnitGhost, drawEmptyCard, drawLockedCard, drawAvailableCard,
} from '../render/unitCard.js';
import { mergeByDrag } from './unitDrag.js';
import { findMergePair } from '../core/tutorial.js';
import { playSfx } from '../core/audio.js';
import { UnitDetailScreen } from './unitDetail.js';
import { DeployScreen } from './deploy.js';
import {
  bookUnlocked, bookLevel, bookUpgradeCost, bookBonus, upgradeBook,
} from '../core/books.js';
// #dev-only:start
import { devGrantAllTroops } from '../core/dev.js';
// #dev-only:end

const COLS = 4;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;
const X0 = 32;
const Y0 = 204;
// 滚动视口：4 列 × 5 行整卡（4*164+3*10=686 宽，5*116+4*6=604 高），边缘不留半张卡
const VIEW = { x: 24, y: 204, w: 702, h: 604 };

// 兵书（800 关解锁）面板：三卷各 10 级、每级 +2%，铜钱升级
const BOOKS_VIEW = {
  entry: { x: 508, y: 860, w: 198, h: 60 },
  panel: { x: 56, y: 318, w: 638, h: 604 },
  close: { x: 258, y: 836, w: 234, h: 62 },
  rowH: 100,
  rowGap: 10,
  rowY: 440,
  btn: { x: 452, w: 170, h: 62, dy: 14 },
};

function fmtNum(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 器械升级页（与兵书同款模态）：两张器械卡，左半边模型、右半边数值 + 升级按钮
const SIEGE_VIEW = {
  entry: { x: 288, y: 860, w: 198, h: 60 },   // 兵营底部「器械」入口（兵书左边）
  panel: { x: 40, y: 236, w: 670, h: 796 },
  close: { x: 258, y: 954, w: 234, h: 62 },
  cardX: 64, cardW: 622, cardH: 250, cardY0: 396, cardGap: 18,
  up: { dx: 200, dy: 176, w: 250, h: 56 },
};

function siegeCards() {
  return engineList().map((e, i) => ({
    id: e.id,
    rect: {
      x: SIEGE_VIEW.cardX,
      y: SIEGE_VIEW.cardY0 + i * (SIEGE_VIEW.cardH + SIEGE_VIEW.cardGap),
      w: SIEGE_VIEW.cardW, h: SIEGE_VIEW.cardH,
    },
  }));
}

function siegeUpRect(card) {
  return {
    x: card.rect.x + SIEGE_VIEW.up.dx, y: card.rect.y + SIEGE_VIEW.up.dy,
    w: SIEGE_VIEW.up.w, h: SIEGE_VIEW.up.h,
  };
}

export const BARRACKS_LAYOUT = {
  list: { x0: X0, y0: Y0, cols: COLS, rows: ROWS, perPage: PER_PAGE, view: VIEW },
  mergeAllRect: { x: 70, y: 1020, w: 260, h: 78 },
  deployRect: { x: 370, y: 1020, w: 310, h: 78 },
  // #dev-only:start
  // 开发者通道：右下角小入口，明确标注 DEV
  devRect: { x: 638, y: 92, w: 72, h: 30 },
  devGrantRect: { x: 160, y: 640, w: 430, h: 74 },
  devCloseRect: { x: 195, y: 760, w: 360, h: 60 },
  // #dev-only:end
};

// 手势口径（与布阵页一致）：按下先挂起 → 手指移动 = 上下滚列表；原地按住 0.25 秒才拿起兵牌
// 卡片放大后 slop 放宽到 12px，避免大卡片上一按就误判成滚动
export const BARRACKS_GESTURE = { hold: 0.25, slop: 12 };

export class BarracksScreen {
  // opts.viewOnly：仅查看（从布阵进入时用），彻底禁用拿起 / 拖拽
  constructor(game, opts = {}) {
    this.game = game;
    this.artBg = 'barracks';
    this.tutorialId = 'barracks';
    this.viewOnly = !!opts.viewOnly;
    this.page = 0;
    this.drag = null;
    this.pending = null;      // 按住兵牌但还没到长按阈值
    this.tapCard = null;      // 仅查看模式下的轻点（只用来进详情，不进拖拽态）
    this.t = 0;               // 页面时钟（长按计时）
    this.scrollY = 0;
    this.listScroll = null;
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.cardRects = [];
    this.booksOpen = false;
    this.booksMsg = null;
    this.siegeOpen = false;
    this.siegeMsg = null;
    // #dev-only:start
    this.devOpen = false;
    this.devResult = null;
    // #dev-only:end
  }

  // 未解锁兵种图鉴：按解锁关数升序排在兵牌后面，灰色展示「第 X 关解锁」
  lockedTroops() {
    const st = this.game.state;
    return CONFIG.troops
      .filter((t) => t.baseTroop && !troopUnlocked(st, t.id))
      .sort((a, b) => troopUnlockLevel(a.id) - troopUnlockLevel(b.id));
  }

  // 可获得兵种：已解锁、但兵营里一个都没有（青州兵 / 白毦兵 / 陷阵营开局就属于这种）
  // 之前图鉴只列「未解锁」，这三类既不算未解锁又不在兵牌里，就整块漏掉了
  availableTroops() {
    const st = this.game.state;
    const owned = new Set(st.units.map((u) => u.troop));
    return CONFIG.troops.filter((t) => t.baseTroop && troopUnlocked(st, t.id) && !owned.has(t.id));
  }

  totalSlots(info = rosterSlots(this.game.state.maxCleared)) {
    const n = this.game.state.units.length + this.availableTroops().length + this.lockedTroops().length;
    return Math.max(n, info.unlocked);
  }

  maxScroll(info = rosterSlots(this.game.state.maxCleared)) {
    const total = this.totalSlots(info);
    const rows = Math.ceil(total / COLS);
    const contentH = rows * (CARD.h + CARD.gapY) - CARD.gapY;
    return Math.max(0, contentH - VIEW.h);
  }

  sortedUnits() {
    return sortUnits(this.game.state.units);
  }

  // 一键合成只在兵营兵牌数达到门槛后出现；不到门槛时按钮完全不渲染、不响应点击
  canAutoMerge() {
    return this.game.state.units.length >= AUTO_MERGE_MIN_UNITS;
  }

  // 新手引导锚点：滚动视口 + 两个可合成的兵牌（仅查看模式不能合，直接不给）
  tutorialAnchors() {
    if (this.viewOnly) return { list: VIEW, mergePair: null, mergeReady: false };
    const byId = new Map(this.game.state.units.map((u) => [u.id, u]));
    const cards = [];
    for (const c of this.cardRects) {
      const u = c.uid ? byId.get(c.uid) : null;
      if (u) cards.push({ uid: u.id, troop: u.troop, level: u.level, rect: c.rect });
    }
    const pair = findMergePair(this.game.state, cards);
    return {
      list: VIEW,
      mergePair: pair ? [pair[0].rect, pair[1].rect] : null,
      mergeReady: this.game.state.units.length >= AUTO_MERGE_MIN_UNITS,
    };
  }

  update(dt) {
    this.t += dt || 0;
    // 按住兵牌不动超过阈值 = 拿起（可交互模式）；仅查看模式永远不拿起
    const p = this.pending;
    if (this.viewOnly || !p || this.drag || this.listScroll) return;
    if (this.t - p.t >= BARRACKS_GESTURE.hold) this.liftCard(p.uid, p.x, p.y);
  }

  liftCard(uid, x, y) {
    this.drag = { uid, x, y, startX: x, startY: y, moved: true };
    this.pending = null;
  }

  mergeAll() {
    const g = this.game;
    const merges = autoMerge(g.state);
    if (!merges) {
      playSfx('error', { volume: 0.7 });
      g.toast('没有可以合成的单位：需要 2 个同兵种同等级');
      return;
    }
    g.save();
    playSfx('merge');
    const slots = rosterSlots(g.state.maxCleared);
    g.toast(`一键合成 ${merges} 次（兵营 ${g.state.units.length}/${slots.unlocked}）`);
  }

  /* ---------- 指针：按下 → 拖动 → 抬起 ---------- */
  onDown(x, y) {
    const g = this.game;
    const L = BARRACKS_LAYOUT;
    // #dev-only:start
    // 开发者通道弹窗：模态，先吃掉所有点击
    if (this.devOpen) {
      if (this.devResult) { this.devResult = null; this.devOpen = false; return; }
      if (hit(L.devGrantRect, x, y)) {
        const r = devGrantAllTroops(g.state);
        this.devResult = r;
        g.save();
        playSfx('chest', { volume: 0.8 });
        return;
      }
      if (hit(L.devCloseRect, x, y)) { this.devOpen = false; return; }
      return;
    }
    // #dev-only:end
    if (hit(this.backRect, x, y)) return g.pop();
    // 兵书面板：模态，先吃掉所有点击
    if (this.booksOpen) return this.booksDown(x, y);
    if (hit(BOOKS_VIEW.entry, x, y)) {
      if (!bookUnlocked(g.state)) {
        g.toast(`兵书第 ${CONFIG.books.unlockLevel} 关解锁`);
        playSfx('error', { volume: 0.6 });
        return;
      }
      this.booksOpen = true;
      this.booksMsg = null;
      return;
    }
    // 器械升级面板：模态，吃掉面板内所有点击
    if (this.siegeOpen) return this.siegeDown(x, y);
    if (hit(SIEGE_VIEW.entry, x, y)) {
      this.siegeOpen = true;
      this.siegeMsg = null;
      return;
    }
    // #dev-only:start
    if (hit(L.devRect, x, y)) { this.devOpen = true; return; }
    // #dev-only:end
    if (hit(L.mergeAllRect, x, y) && this.canAutoMerge()) return this.mergeAll();
    // 仅查看模式（从布阵进来）：底部按钮回退到布阵，而不是再叠一层布阵页
    if (hit(L.deployRect, x, y)) {
      return this.viewOnly ? g.pop() : g.push(new DeployScreen(g, { mode: 'edit' }));
    }

    // 只认视口内、且这一帧真的画出来的兵牌（滚出视口的卡不能接住手指）
    const inView = y >= VIEW.y && y <= VIEW.y + VIEW.h;
    const card = inView ? this.cardRects.find((c) => hit(c.rect, x, y)) : null;
    if (card) {
      // 仅查看：只记一个轻点，永远不进拿起流程
      if (this.viewOnly) {
        this.tapCard = { uid: card.uid, x, y };
        return;
      }
      // 先挂起：只有原地按住 0.25 秒才拿起；滑动一律当滚动
      // 合成教程进行中例外：按下即可拖，和教程「拖到一起」的动作保持一致
      if (g.tutorial?.active?.step.id === 'merge') {
        this.liftCard(card.uid, x, y);
        return;
      }
      this.pending = { uid: card.uid, x, y, t: this.t, scrollY: this.scrollY };
      return;
    }
    // 网格空白 / 空位：上下滑动
    if (hit(VIEW, x, y)) this.listScroll = { y, scrollY: this.scrollY, moved: false };
  }

  onMove(x, y) {
    if (this.listScroll) {
      const dy = this.listScroll.y - y;
      if (Math.abs(dy) > 5) this.listScroll.moved = true;
      this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.listScroll.scrollY + dy));
      return;
    }
    // 仅查看：点着兵牌一移就转成滚列表
    if (this.tapCard) {
      if (Math.hypot(x - this.tapCard.x, y - this.tapCard.y) <= BARRACKS_GESTURE.slop) return;
      this.listScroll = { y: this.tapCard.y, scrollY: this.scrollY, moved: true };
      this.tapCard = null;
      this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.scrollY + (this.listScroll.y - y)));
      return;
    }
    // 按着兵牌但没到长按：一旦移动就转成滚列表（滑动 = 滚动，不拿起）
    if (this.pending && !this.drag) {
      const p = this.pending;
      if (Math.hypot(x - p.x, y - p.y) <= BARRACKS_GESTURE.slop) return;
      this.listScroll = { y: p.y, scrollY: p.scrollY, moved: true };
      this.pending = null;
      this.scrollY = Math.max(0, Math.min(this.maxScroll(), p.scrollY + (p.y - y)));
      return;
    }
    if (!this.drag) return;
    this.drag.x = x;
    this.drag.y = y;
    if (Math.hypot(x - this.drag.startX, y - this.drag.startY) > 10) this.drag.moved = true;
  }

  onUp(x, y) {
    if (this.listScroll) {
      this.listScroll = null;
      return;
    }
    const drag = this.drag;
    const pending = this.pending;
    const tap = this.tapCard;
    this.drag = null;
    this.pending = null;
    this.tapCard = null;
    if (!drag) {
      // 没拿起就抬手 = 轻点，进详情页（仅查看模式也允许看详情）
      const uid = pending ? pending.uid : (tap ? tap.uid : null);
      if (uid && this.game.state.units.some((u) => u.id === uid)) {
        this.game.push(new UnitDetailScreen(this.game, uid));
      }
      return;
    }
    const g = this.game;
    const unit = g.state.units.find((u) => u.id === drag.uid);
    if (!unit) return;

    if (!drag.moved) {
      g.push(new UnitDetailScreen(g, drag.uid));
      return;
    }
    const target = this.targetAt(x, y);
    if (!target || target.uid === drag.uid) return;
    mergeByDrag(g, target.uid, drag.uid);
  }

  targetAt(x, y) {
    return this.cardRects.find((c) => hit(c.rect, x, y)) || null;
  }

  /* ---------- 兵书（800 关解锁：三卷各 10 级，每级 +2%） ---------- */
  bookRows() {
    const st = this.game.state;
    return CONFIG.books.tracks.map((track, i) => {
      const y = BOOKS_VIEW.rowY + i * (BOOKS_VIEW.rowH + BOOKS_VIEW.rowGap);
      const level = bookLevel(st, track.id);
      return {
        track,
        level,
        cost: bookUpgradeCost(track.id, level),
        rect: { x: 92, y, w: 566, h: BOOKS_VIEW.rowH },
        btn: { x: BOOKS_VIEW.btn.x, y: y + BOOKS_VIEW.btn.dy, w: BOOKS_VIEW.btn.w, h: BOOKS_VIEW.btn.h },
      };
    });
  }

  booksDown(x, y) {
    const g = this.game;
    if (hit(BOOKS_VIEW.close, x, y)) {
      this.booksOpen = false;
      return;
    }
    for (const row of this.bookRows()) {
      if (!hit(row.btn, x, y)) continue;
      const r = upgradeBook(g.state, row.track.id);
      if (r.ok) {
        g.save();
        playSfx('buy');
        this.booksMsg = `${row.track.name} 升到 Lv${r.level}（-${fmtNum(r.cost)}）`;
      } else if (r.reason === 'poor') {
        playSfx('error', { volume: 0.7 });
        this.booksMsg = `铜钱不够：需要 ${fmtNum(r.cost)}`;
      } else if (r.reason === 'max') {
        this.booksMsg = `${row.track.name} 已满级`;
      }
      return;
    }
  }

  drawBooks(ctx) {
    const g = this.game;
    const st = g.state;
    const b = bookBonus(st);
    const P = BOOKS_VIEW.panel;
    ctx.save();
    ctx.fillStyle = 'rgba(13,10,7,0.8)';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();
    panel(ctx, P.x, P.y, P.w, P.h, { fill: 'rgba(33,26,18,0.98)', stroke: THEME.goldDim, r: 22, lw: 2 });
    text(ctx, '兵 书', 375, P.y + 54, { size: 32, weight: '600', align: 'center' });
    text(ctx, `每卷 ${CONFIG.books.maxLevel} 级 · 每级 +2% · 铜钱升级`, 375, P.y + 92, {
      size: 18, align: 'center', color: THEME.textWeak,
    });
    for (const row of this.bookRows()) {
      panel(ctx, row.rect.x, row.rect.y, row.rect.w, row.rect.h, {
        fill: 'rgba(43,34,23,0.9)', stroke: THEME.line, r: 16,
      });
      text(ctx, row.track.name, row.rect.x + 22, row.rect.y + 42, { size: 26, weight: '600' });
      text(ctx, row.track.note, row.rect.x + 22, row.rect.y + 74, { size: 18, color: THEME.textWeak });
      const pct = Math.round(row.level * CONFIG.books.perLevel * 100);
      text(ctx, `Lv${row.level}/${CONFIG.books.maxLevel}`, row.rect.x + 190, row.rect.y + 40, {
        size: 22, color: THEME.gold,
      });
      text(ctx, `+${pct}%`, row.rect.x + 190, row.rect.y + 74, { size: 18, color: THEME.goldDim });
      if (row.level >= CONFIG.books.maxLevel) {
        button(ctx, row.btn, '已 满 级', {
          size: 20, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak,
        });
      } else {
        const afford = st.coins >= row.cost;
        button(ctx, row.btn, `升级 ${fmtNum(row.cost)}`, {
          size: 18,
          fill: afford ? '#332c1d' : THEME.panel,
          stroke: afford ? THEME.goldDim : THEME.line,
          textColor: afford ? THEME.gold : THEME.textWeak,
        });
      }
    }
    text(ctx, `当前全军：攻 +${Math.round(b.atk * 100)}% · 血 +${Math.round(b.hp * 100)}% · 防 +${Math.round(b.def * 100)}%`,
      375, P.y + 462, { size: 20, align: 'center', color: THEME.goldDim });
    if (this.booksMsg) {
      text(ctx, this.booksMsg, 375, P.y + 494, { size: 18, align: 'center', color: THEME.text });
    }
    button(ctx, BOOKS_VIEW.close, '关 闭', {
      size: 20, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak,
    });
  }

  /* ---------- 器械升级（350 关起解锁霹雳车、600 关解锁中军鼓吹，各 1~10 档） ---------- */
  siegeDown(x, y) {
    const g = this.game;
    if (hit(SIEGE_VIEW.close, x, y)) {
      this.siegeOpen = false;
      return;
    }
    for (const card of siegeCards()) {
      if (!hit(siegeUpRect(card), x, y)) continue;
      const st = g.state;
      if (!engineUnlocked(st, card.id)) {
        playSfx('error', { volume: 0.7 });
        this.siegeMsg = `${engineName(card.id)} 第 ${engineUnlockLevel(card.id)} 关解锁`;
        return;
      }
      const r = upgradeEngine(st, card.id);
      if (r.ok) {
        g.save();
        playSfx('buy');
        this.siegeMsg = `${engineName(card.id)} 升到 ${r.tier} 档（-${fmtNum(r.cost)} 铜钱）`;
      } else if (r.reason === 'coins') {
        playSfx('error', { volume: 0.7 });
        this.siegeMsg = `铜钱不够：需要 ${fmtNum(r.cost)}`;
      } else if (r.reason === 'max') {
        this.siegeMsg = `${engineName(card.id)} 已满 ${CONFIG.siege.maxLevel} 档`;
      }
      return;
    }
  }

  drawSiege(ctx) {
    const g = this.game;
    const st = g.state;
    const P = SIEGE_VIEW.panel;
    // 数值锚点用已通最高关（兵营是全局页，不在某一关里）
    const stage = Math.max(1, Number(st.maxCleared) || 1);
    const choice = engineChoice(st);
    ctx.save();
    ctx.fillStyle = 'rgba(13,10,7,0.8)';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();
    panel(ctx, P.x, P.y, P.w, P.h, { fill: 'rgba(33,26,18,0.98)', stroke: THEME.goldDim, r: 22, lw: 2 });
    text(ctx, '器 械', 375, P.y + 54, { size: 32, weight: '600', align: 'center' });
    text(ctx, `每台 ${CONFIG.siege.maxLevel} 档 · 基础强度跟随关卡，升级只加额外增幅`, 375, P.y + 92, {
      size: 17, align: 'center', color: THEME.textWeak, maxWidth: P.w - 50,
    });
    // 板块 4a · 器械图谱：标题与卡片之间原本是 68px 空带，铺成「器械陈列」。
    // 5 张 3D 建模贴图全部在此真实出镜（战场只用到其中 2 张），
    // 未下载好分包时 drawArt 返回 false，静默留空不影响任何交互。
    const GALLERY = ['catapult', 'ram', 'ballista', 'war_drum', 'shield_cart'];
    const gy = P.y + 106;
    const cellW = 118;
    const cellGap = (P.w - 32 - GALLERY.length * cellW) / (GALLERY.length - 1);
    for (let i = 0; i < GALLERY.length; i += 1) {
      const gx = P.x + 16 + i * (cellW + cellGap);
      ctx.save();
      roundRectPath(ctx, gx, gy, cellW, 54, 8);
      ctx.fillStyle = 'rgba(58,46,30,0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(213,153,71,0.34)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      drawArt(ctx, ART_PATHS.siege(GALLERY[i]), gx + cellW / 2, gy + 27,
        cellW - 6, 50, { alpha: 0.92, shadow: 3 });
    }
    for (const card of siegeCards()) {
      const r = card.rect;
      const unlocked = engineUnlocked(st, card.id);
      const tier = engineTier(st, card.id);
      const picked = !!choice && choice.id === card.id;
      const s = engineStats(card.id, tier, stage);
      panel(ctx, r.x, r.y, r.w, r.h, {
        fill: 'rgba(43,34,23,0.9)',
        stroke: picked ? THEME.gold : THEME.line, r: 16,
      });
      // 左半边：器械建模（未解锁压暗）
      drawEngineFigure(ctx, card.id, {
        x: r.x + 108, y: r.y + 198, size: 140, t: this.t,
        alpha: unlocked ? 1 : 0.35,
      });
      text(ctx, engineName(card.id), r.x + 200, r.y + 46, {
        size: 26, weight: '600', color: unlocked ? THEME.text : THEME.textWeak,
      });
      text(ctx, unlocked ? `${tier} / ${CONFIG.siege.maxLevel} 档` : `第 ${engineUnlockLevel(card.id)} 关解锁`,
        r.x + r.w - 18, r.y + 44, { size: 20, align: 'right', color: unlocked ? THEME.gold : THEME.textWeak });
      const lines = card.id === 'thunder'
        ? [`直击 ${s.direct} · 火圈 ${s.fireDps}/秒`,
          `冷却 ${s.cooldown.toFixed(1)}s · 火圈 ${s.fireRadius.toFixed(1)} 格 / ${s.fireDuration.toFixed(0)}s`]
        : [`光环 ${s.auraRadius.toFixed(1)} 格 · 增伤 +${Math.round(s.auraDmg * 100)}%`, '常驻不触发 · 站桩不移动'];
      text(ctx, lines[0], r.x + 200, r.y + 96, { size: 17, color: THEME.textDim, alpha: unlocked ? 1 : 0.55 });
      text(ctx, lines[1], r.x + 200, r.y + 130, { size: 17, color: THEME.textDim, alpha: unlocked ? 1 : 0.55 });
      text(ctx, card.id === 'thunder' ? '前军 / 中军 / 后军三档站位 · 自动前后走位' : '半径内友军伤害提升',
        r.x + 200, r.y + 160, { size: 14, color: THEME.textWeak, alpha: unlocked ? 1 : 0.55, maxWidth: 400 });
      if (picked) {
        text(ctx, '当前出战', r.x + r.w - 18, r.y + 216, { size: 16, align: 'right', color: THEME.green });
      }
      const btn = siegeUpRect(card);
      const cost = engineUpgradeCost(card.id, tier);
      if (!unlocked) {
        button(ctx, btn, '未 解 锁', { size: 20, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak });
      } else if (tier >= CONFIG.siege.maxLevel) {
        button(ctx, btn, '已 满 档', { size: 20, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak });
      } else {
        const afford = st.coins >= cost;
        button(ctx, btn, `升级 ${fmtNum(cost)}`, {
          size: 19,
          fill: afford ? '#332c1d' : THEME.panel,
          stroke: afford ? THEME.goldDim : THEME.line,
          textColor: afford ? THEME.gold : THEME.textWeak,
        });
      }
    }
    text(ctx, this.siegeMsg || '铜钱升级只加额外增幅 · 器械强度本身按关卡自动成长',
      375, 934, { size: 16, align: 'center', color: this.siegeMsg ? THEME.gold : THEME.textWeak, maxWidth: 620 });
    button(ctx, SIEGE_VIEW.close, '关 闭', {
      size: 20, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak,
    });
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const info = rosterSlots(st.maxCleared);
    const units = this.sortedUnits();
    const available = this.availableTroops();
    const locked = this.lockedTroops();
    const deployed = new Set((Array.isArray(st.formation) ? st.formation : []).filter(Boolean));
    const undeployed = units.filter((u) => !deployed.has(u.id)).length;

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '兵 营', W / 2 + 20, 76, { size: 34, weight: '600', align: 'center' });
    coinBadge(ctx, 700, 76, st.coins, { size: 24, align: 'right' });

    text(ctx, `兵营 ${units.length} / ${info.unlocked}`, 44, 152, { size: 24, color: THEME.textDim });
    text(ctx, `已上阵 ${units.length - undeployed} / ${CONFIG.formation.maxUnits} · 未上阵 ${undeployed}`, 706, 152, {
      size: 20, align: 'right', color: THEME.textWeak,
    });
    text(ctx, this.viewOnly
      ? '仅查看 · 点兵牌看详情'
      : '长按拿起 → 拖到同级兵牌', 44, 186, {
      size: 20, color: this.viewOnly ? THEME.textDim : THEME.goldDim, maxWidth: 380,
    });
    text(ctx, `灰色未解锁 ${locked.length} · 绿色可获得 ${available.length}`, 713, 186, {
      size: 15, align: 'right', color: THEME.textWeak,
    });

    // 连续滚动网格：兵牌 + 可获得图鉴 + 未解锁图鉴 + 剩余空位都在同一个列表里上下翻
    const totalSlots = Math.max(units.length + available.length + locked.length, info.unlocked);
    this.scrollY = Math.max(0, Math.min(this.maxScroll(info), this.scrollY));
    this.cardRects = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    ctx.clip();
    for (let i = 0; i < totalSlots; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const rect = {
        x: X0 + col * (CARD.w + CARD.gapX),
        y: Y0 + row * (CARD.h + CARD.gapY) - this.scrollY,
        w: CARD.w, h: CARD.h,
      };
      if (rect.y + rect.h < VIEW.y || rect.y > VIEW.y + VIEW.h) continue;
      const unit = units[i];
      if (!unit) {
        const avail = available[i - units.length];
        if (avail) {
          drawAvailableCard(ctx, avail.id, rect);
          continue;
        }
        const lock = locked[i - units.length - available.length];
        if (lock) {
          drawLockedCard(ctx, lock.id, rect, troopUnlockLevel(lock.id));
        } else {
          drawEmptyCard(ctx, rect);
        }
        continue;
      }
      this.cardRects.push({ rect, uid: unit.id });
      const dragging = this.drag && this.drag.uid === unit.id;
      drawUnitCard(ctx, unit, rect, { onGrid: deployed.has(unit.id), alpha: dragging ? 0.4 : 1 });
    }
    ctx.restore();

    const max = this.maxScroll(info);
    if (max > 0) {
      const x = VIEW.x + VIEW.w - 8;
      panel(ctx, x, VIEW.y + 2, 4, VIEW.h - 4, { fill: 'rgba(255,255,255,0.07)', stroke: null, r: 2, lw: 0 });
      const ratio = VIEW.h / (VIEW.h + max);
      const h = Math.max(26, (VIEW.h - 4) * ratio);
      const sy = VIEW.y + 2 + (VIEW.h - 4 - h) * (this.scrollY / max);
      panel(ctx, x - 1, sy, 6, h, { fill: 'rgba(213,153,71,0.75)', stroke: null, r: 3, lw: 0 });
    }

    // 拖拽悬停反馈
    if (this.drag) {
      const target = this.targetAt(this.drag.x, this.drag.y);
      const dragged = st.units.find((u) => u.id === this.drag.uid);
      if (target && target.uid !== this.drag.uid) {
        const unit = st.units.find((u) => u.id === target.uid);
        const ok = dragged && unit && unit.troop === dragged.troop && unit.level === dragged.level;
        ctx.save();
        ctx.strokeStyle = ok ? THEME.green : THEME.red;
        ctx.lineWidth = 4;
        ctx.strokeRect(target.rect.x, target.rect.y, target.rect.w, target.rect.h);
        ctx.restore();
      }
      if (dragged) drawUnitGhost(ctx, dragged, this.drag.x, this.drag.y);
    }

    if (!units.length) {
      text(ctx, '还没有单位，先去闯关获得小兵', 375, 480, { size: 26, align: 'center', color: THEME.textDim });
    }

    // 武将位（本期不开放）
    // #dev-only:start
    // 开发者通道：小 DEV 入口（右下），点击后弹明确标注的调试面板
    button(ctx, BARRACKS_LAYOUT.devRect, 'DEV', {
      size: 13, fill: 'rgba(43,34,23,0.5)', stroke: '#8a6a32', textColor: '#d59947',
    });
    // #dev-only:end
    text(ctx, `武将位 ×${CONFIG.roster.heroSlots}（预留）`, 44, 892, {
      size: 21, color: THEME.textWeak,
    });
    // 兵书入口：800 关解锁（未解锁时是灰的，点了给提示）
    const booksOn = bookUnlocked(st);
    button(ctx, BOOKS_VIEW.entry, booksOn ? '兵 书' : `兵书 · ${CONFIG.books.unlockLevel} 关`, {
      size: 20,
      fill: '#2b2419',
      stroke: booksOn ? THEME.goldDim : THEME.line,
      textColor: booksOn ? THEME.gold : THEME.textWeak,
    });
    // 器械入口：350 关解锁霹雳车（未解锁时按钮带上解锁关卡）
    const engineOn = engineList().some((e) => engineUnlocked(st, e.id));
    button(ctx, SIEGE_VIEW.entry, engineOn ? '器 械' : `器械 · ${engineUnlockLevel('thunder')} 关`, {
      size: 20,
      fill: '#1f2531',
      stroke: engineOn ? THEME.goldDim : THEME.line,
      textColor: engineOn ? THEME.gold : THEME.textWeak,
    });
    // 合成规则只留一行图形化的等式，详细说明不写在页面上
    text(ctx, `同名同 Lv ×2 → +1 级（上限 Lv${CONFIG.merge.maxLevel}）`, 375, 940, {
      size: 21, align: 'center', color: THEME.textDim,
    });

    if (this.canAutoMerge()) {
      button(ctx, BARRACKS_LAYOUT.mergeAllRect, '一键合成', {
        size: 26, fill: '#332c1d', stroke: THEME.goldDim, textColor: THEME.gold,
      });
    }
    button(ctx, BARRACKS_LAYOUT.deployRect, this.viewOnly ? '返回布阵' : '去布阵上阵', {
      size: 20, fill: THEME.panel, stroke: THEME.line,
    });

    if (this.booksOpen) this.drawBooks(ctx);
    if (this.siegeOpen) this.drawSiege(ctx);

    // #dev-only:start
    // 开发者通道面板：明确标注只给调试 / 体验
    if (this.devOpen) {
      ctx.save();
      ctx.fillStyle = 'rgba(13,10,7,0.78)';
      ctx.fillRect(0, 0, W, g.H);
      ctx.restore();
      panel(ctx, 100, 420, 550, 460, { fill: 'rgba(33,26,18,0.98)', stroke: '#8a6a32', r: 22, lw: 2 });
      text(ctx, '开发者通道 · 兵营', W / 2, 468, { size: 26, align: 'center', color: '#d59947' });
      text(ctx, '仅用于调试 / 体验，不属于正常玩家功能', W / 2, 506, {
        size: 15, align: 'center', color: THEME.textWeak,
      });
      if (this.devResult) {
        text(ctx, `已发放 ${this.devResult.added.length} / ${this.devResult.total} 个兵种`, W / 2, 590, {
          size: 20, align: 'center', color: THEME.gold,
        });
        text(ctx, this.devResult.full.length
          ? `兵营已满，未发放：${this.devResult.full.length} 个（点任意处关闭）`
          : '每个兵种各 1 个 Lv1 单位（点任意处关闭）', W / 2, 622, {
          size: 15, align: 'center', color: THEME.textDim,
        });
      } else {
        button(ctx, BARRACKS_LAYOUT.devGrantRect, '每个兵种各发 1 个', {
          size: 24, fill: '#332c1d', stroke: '#d59947', textColor: '#f4d488',
        });
        text(ctx, '包含全部特殊兵种；兵营满时只发能放下的', W / 2, 730, {
          size: 15, align: 'center', color: THEME.textDim,
        });
      }
      button(ctx, BARRACKS_LAYOUT.devCloseRect, '关 闭', {
        size: 18, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak,
      });
    }
    // #dev-only:end
  }
}
