// 每日商店：6 个栏位（前 4 稀有 / 后 2 史诗），每天 0 点（北京时间）刷新，每个栏位限购 1 次
import { THEME, text, panel, button, coinBadge, hit, backButton, infoBadge, infoModal } from '../render/draw.js';
import { now as clockNow } from '../core/clock.js';
import { CONFIG } from '../data/config.js';
import { rosterSlots } from '../core/levels.js';
import {
  dailyShopUnlocked, dailyShopOffers, buyDailySlot, minutesUntilRefresh,
} from '../core/dailyShop.js';
import { unitName, rarityInfo, statsFor, spriteTierFor } from '../core/units.js';
import { drawFrame, sheetFor } from '../render/sprites.js';
import { playSfx } from '../core/audio.js';

const CARD_W = 222;
const CARD_H = 330;
const CARD_GAP = 15;
const CARD_X0 = 27;
const CARD_Y0 = 210;
const CARD_ROW_GAP = 16;

export const DAILY_SHOP_LAYOUT = {
  cardW: CARD_W, cardH: CARD_H, cardGap: CARD_GAP, cardX0: CARD_X0,
  cardY0: CARD_Y0, cardRowGap: CARD_ROW_GAP,
  buyOffsetY: 272, buyOffsetX: 16, buyW: CARD_W - 32, buyH: 48,
};

export class DailyShopScreen {
  constructor(game) {
    this.game = game;
    this.tutorialId = 'dailyShop';
    this.bgm = 'shop';
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.cardRects = [];
    this.nowMs = clockNow();
    this.infoOpen = false;
    this.infoRect = { x: 44, y: 132, w: 56, h: 56 };
  }

  tutorialAnchors() {
    return { unlocked: dailyShopUnlocked(this.game.state) };
  }

  update() {
    this.nowMs = clockNow();
  }

  buy(index) {
    const g = this.game;
    const st = g.state;
    const r = buyDailySlot(st, index);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      if (r.reason === 'sold') g.toast('这个栏位今天已经买过了，明天刷新后再来');
      else if (r.reason === 'full') g.toast(`兵营已满（${CONFIG.roster.maxSlots}）：先去合成同级兵腾出格子`);
      else if (r.reason === 'poor') g.toast(`铜钱不足，还差 ${r.price - st.coins}`);
      else if (r.reason === 'locked') g.toast(`通关第 ${CONFIG.dailyShop.unlockLevel} 关后解锁每日商店`);
      else g.toast('这个栏位暂时买不到');
      return;
    }
    g.save();
    playSfx('buy');
    const name = unitName(r.unit.troop, r.unit.level);
    const { unlocked } = rosterSlots(st.maxCleared);
    g.toast(`已招募 ${name} Lv${r.unit.level}（兵营 ${st.units.length}/${unlocked}）`);
    if (g.showcaseUnit) g.showcaseUnit(r.unit);
  }

  tap(x, y) {
    const g = this.game;
    if (this.infoOpen) { this.infoOpen = false; return; }
    if (hit(this.backRect, x, y)) return g.pop();
    if (hit(this.infoRect, x, y)) { this.infoOpen = true; return; }
    for (const c of this.cardRects) {
      if (hit(c.rect, x, y)) {
        this.buy(c.index);
        return;
      }
    }
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const slots = rosterSlots(st.maxCleared);
    const full = st.units.length >= slots.unlocked;
    const unlocked = dailyShopUnlocked(st);
    const mins = minutesUntilRefresh(this.nowMs);
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '每 日 商 店', W / 2 + 20, 76, { size: 34, weight: '600', align: 'center' });
    coinBadge(ctx, 700, 76, st.coins, { size: 24, align: 'right' });

    text(ctx, `距刷新 ${hh} 小时 ${mm} 分`, 108, 160, {
      size: 24, color: THEME.goldDim,
    });
    text(ctx, `兵营 ${st.units.length} / ${slots.unlocked}`, 706, 160, {
      size: 22, align: 'right', color: full ? THEME.red : THEME.textDim,
    });
    infoBadge(ctx, this.infoRect.x + 28, this.infoRect.y + 28, 22);

    if (!unlocked) {
      this.drawLocked(ctx, st);
      if (this.infoOpen) this.drawInfo(ctx, W, g.H);
      return;
    }

    const offers = dailyShopOffers(st, this.nowMs);
    this.cardRects = [];
    offers.slots.forEach((s, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = CARD_X0 + col * (CARD_W + CARD_GAP);
      const y = CARD_Y0 + row * (CARD_H + CARD_ROW_GAP);
      this.drawCard(ctx, s, x, y, full);
    });

    if (this.infoOpen) this.drawInfo(ctx, W, g.H);
  }

  drawInfo(ctx, W, H) {
    infoModal(ctx, W, H, '每 日 商 店', [
      `通关第 ${CONFIG.dailyShop.unlockLevel} 关后开放，每天 6 个栏位。`,
      '每天 0 点（北京时间）刷新，每个栏位限购 1 次。',
      '前 4 个栏位必出稀有兵种，后 2 个栏位必出史诗兵种。',
      '买到的兵直接进兵营；兵营满时买不了，先合成腾格子。',
      '商城只能买普通兵；这里每天刷新一次随机兵种。',
    ]);
  }

  drawLocked(ctx, st) {
    const need = CONFIG.dailyShop.unlockLevel;
    const cur = Math.min(st.maxCleared, need);
    panel(ctx, 70, 240, 610, 380, { fill: 'rgba(43,34,23,0.7)', stroke: THEME.line, r: 20 });
    text(ctx, '每日商店尚未解锁', 375, 320, { size: 30, weight: '600', align: 'center', color: THEME.textDim });
    text(ctx, `通关第 ${need} 关后开放`, 375, 380, {
      size: 24, align: 'center', color: THEME.gold,
    });
    text(ctx, `当前进度 ${cur} / ${need}`, 375, 430, {
      size: 24, align: 'center', color: THEME.text,
    });
  }

  drawCard(ctx, s, x, y, full) {
    const rar = rarityInfo(s.troop);
    const price = s.price;
    const affordable = this.game.state.coins >= price;
    const canBuy = !s.sold && affordable && !full;
    const buyRect = {
      x: x + DAILY_SHOP_LAYOUT.buyOffsetX,
      y: y + DAILY_SHOP_LAYOUT.buyOffsetY,
      w: DAILY_SHOP_LAYOUT.buyW,
      h: DAILY_SHOP_LAYOUT.buyH,
    };
    this.cardRects.push({ rect: buyRect, index: s.index });

    panel(ctx, x, y, CARD_W, CARD_H, {
      fill: s.sold ? 'rgba(43,34,23,0.85)' : '#2b2217',
      stroke: s.sold ? THEME.line : rar.color, r: 18, lw: s.sold ? 1 : 2,
    });

    // 品阶标签
    panel(ctx, x + 12, y + 12, 66, 28, { fill: 'rgba(0,0,0,0.35)', stroke: rar.color, r: 8, lw: 1 });
    text(ctx, rar.name, x + 45, y + 26, { size: 18, align: 'center', color: rar.color });

    text(ctx, unitName(s.troop, s.level), x + 14, y + 64, {
      size: 26, weight: '600', color: s.sold ? THEME.textWeak : THEME.text, maxWidth: CARD_W - 28,
    });
    text(ctx, `Lv${s.level}`, x + 14, y + 94, { size: 20, color: s.sold ? THEME.textWeak : rar.color });

    const sheet = sheetFor(s.troop, spriteTierFor(s.level));
    drawFrame(ctx, sheet, 'idle', 0, x + CARD_W / 2, y + 214, 1.0, false, s.sold ? 0.45 : 1);

    // 属性小字（攻击 / 生命）
    const st2 = statsFor(s.troop, s.level);
    text(ctx, `生命 ${st2.hp}  攻击 ${st2.atk}`, x + CARD_W / 2, y + 238, {
      size: 18, align: 'center', color: s.sold ? THEME.textWeak : THEME.textDim,
    });

    coinBadge(ctx, x + CARD_W / 2, y + 262, price, { size: 20, align: 'center' });

    button(ctx, buyRect, s.sold ? '今 日 已 购 买'
      : full ? '兵营已满'
        : affordable ? '购 买' : '铜钱不足', {
      size: 22,
      fill: canBuy ? '#332c1d' : THEME.panel,
      stroke: canBuy ? rar.color : THEME.line,
      textColor: canBuy ? THEME.gold : THEME.textWeak,
      disabled: !canBuy,
    });

    if (s.sold) {
      text(ctx, '已售罄', x + CARD_W - 16, y + 30, {
        size: 18, align: 'right', color: THEME.textWeak,
      });
    }
  }
}
