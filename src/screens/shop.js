// 商城：花铜钱直接买兵（买到的单位进兵营，受兵营格子数限制）
import { THEME, text, panel, button, coinBadge, hit, backButton, infoBadge, infoModal } from '../render/draw.js';
import { now as clockNow } from '../core/clock.js';
import { CONFIG } from '../data/config.js';
import { rosterSlots, shopPrice, buyUnit } from '../core/levels.js';
import { addChest, chestType, chestTotal } from '../core/chests.js';
import { adsLeft, shopAdsState, claimAdChest } from '../core/ads.js';
import { drawChest } from '../render/chest.js';
import { unitName, statsFor, spriteTierFor } from '../core/units.js';
import { drawFrame, sheetFor } from '../render/sprites.js';
import { playSfx } from '../core/audio.js';
import { DailyShopScreen } from './dailyShop.js';
import { dailyShopUnlocked, dailyShopOffers } from '../core/dailyShop.js';

const CARD_W = 160;
const CARD_H = 486;
const CARD_GAP = 12;
const CARD_X0 = 27;
const CARD_Y = 330;
const TAB_X0 = 300;
const TAB_Y = 258;
const TAB_W = 128;
const TAB_H = 56;
const TAB_GAP = 140;
const BUY_H = 60;

// 布局常量导出给冒烟测试复用
export const SHOP_LAYOUT = {
  cardW: CARD_W, cardH: CARD_H, cardGap: CARD_GAP, cardX0: CARD_X0, cardY: CARD_Y,
  tabX0: TAB_X0, tabY: TAB_Y, tabW: TAB_W, tabH: TAB_H, tabGap: TAB_GAP,
  buyOffsetY: 414, buyW: CARD_W - 32, buyH: BUY_H, buyOffsetX: 16,
  chestPanel: { x: 70, y: 840, w: 610, h: 252 },
  chestRowY: [894, 958],
  chestIconX: 112, chestIconS: 0.62,
  chestTextX: 168, chestPriceX: 500,
  chestBtn: { w: 112, h: 52, x: 552, offsetY: -4 },
  adNoteY: 1024,
  adRow: { x0: 82, y: 1034, w: 286, h: 50, gap: 12 },
};

export class ShopScreen {
  constructor(game) {
    this.game = game;
    this.tutorialId = 'shop';
    this.bgm = 'shop';
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.tabRects = [];
    this.cardRects = [];
    this.chestRects = [];
    this.adChestRects = [];
    this.level = CONFIG.shop.levels[0];
    // 每日商店入口（100 关解锁，每天刷新 6 个栏位）
    this.dailyRect = { x: 44, y: 138, w: 262, h: 64 };
    this.infoOpen = false;
    this.infoRect = { x: 664, y: 138, w: 56, h: 56 };
  }

  update() {}

  buy(troopId) {
    const g = this.game;
    const r = buyUnit(g.state, troopId, this.level);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      if (r.reason === 'full') g.toast(`兵营已满（${CONFIG.roster.maxSlots}）：先去合成同级兵腾出格子`);
      else if (r.reason === 'poor') g.toast(`铜钱不足，还差 ${r.price - g.state.coins}`);
      else g.toast('这个兵种暂时买不到');
      return;
    }
    g.save();
    playSfx('buy');
    const { unlocked } = rosterSlots(g.state.maxCleared);
    g.toast(`已招募 ${unitName(troopId, this.level)} Lv${this.level}（兵营 ${g.state.units.length}/${unlocked}）`);
    // 第一次获得这个兵种：弹一次兵种卡片展示
    if (r.unit && g.showcaseUnit) g.showcaseUnit(r.unit);
  }

  buyChest(id) {
    const g = this.game;
    const st = g.state;
    const item = (CONFIG.shop.chests || []).find((c) => c.id === id);
    const type = chestType(id);
    if (!item || !type) return;
    if (st.coins < item.price) {
      playSfx('error', { volume: 0.7 });
      g.toast(`铜钱不足，还差 ${item.price - st.coins}`);
      return;
    }
    st.coins -= item.price;
    addChest(st, id, 1);
    g.save();
    playSfx('buy');
    g.toast(`已购买 ${type.name} ×1（宝箱仓库 ${chestTotal(st)}）`);
  }

  // 看广告换宝箱：两个独立通道（木5/银2），各自独立计数
  adChest(id) {
    const g = this.game;
    const st = g.state;
    const offer = CONFIG.ads.shopOffers.find((o) => o.id === id);
    const r = claimAdChest(st, id);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      g.toast(r.reason === 'limit'
        ? `今日「${offer ? offer.name : '广告宝箱'}」已领完，明天再来`
        : '这个广告宝箱暂时拿不到');
      return;
    }
    g.save();
    playSfx('buy');
    const type = chestType(r.offer.chest);
    g.toast(`广告奖励 ${type ? type.name : '宝箱'} ×${r.offer.count}`);
  }

  tap(x, y) {
    const g = this.game;
    if (this.infoOpen) { this.infoOpen = false; return; }
    if (hit(this.backRect, x, y)) return g.pop();
    if (hit(this.infoRect, x, y)) { this.infoOpen = true; return; }
    if (hit(this.dailyRect, x, y)) {
      if (!dailyShopUnlocked(g.state)) {
        playSfx('error', { volume: 0.7 });
        g.toast(`通关第 ${CONFIG.dailyShop.unlockLevel} 关后解锁每日商店`);
        return;
      }
      return g.push(new DailyShopScreen(g));
    }
    for (const t of this.tabRects) {
      if (hit(t.rect, x, y)) {
        this.level = t.level;
        return;
      }
    }
    for (const c of this.cardRects) {
      if (hit(c.rect, x, y)) {
        this.buy(c.troop);
        return;
      }
    }
    for (const c of this.chestRects) {
      if (hit(c.rect, x, y)) {
        this.buyChest(c.id);
        return;
      }
    }
    for (const c of this.adChestRects) {
      if (hit(c.rect, x, y)) {
        this.adChest(c.id);
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

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,18,12,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '商 城', W / 2 + 20, 76, { size: 34, weight: '600', align: 'center' });
    coinBadge(ctx, 700, 76, st.coins, { size: 24, align: 'right' });

    // 每日商店入口
    const dailyOn = dailyShopUnlocked(st);
    const soldCount = dailyOn
      ? dailyShopOffers(st, clockNow()).slots.filter((s) => s.sold).length
      : 0;
    button(ctx, this.dailyRect, dailyOn ? '每 日 商 店' : '每日商店 · 100关解锁', {
      size: dailyOn ? 26 : 20,
      fill: dailyOn ? '#2a2416' : THEME.panel,
      stroke: dailyOn ? THEME.goldDim : THEME.line,
      textColor: dailyOn ? THEME.gold : THEME.textWeak,
      disabled: !dailyOn,
    });
    if (dailyOn) {
      text(ctx, `今日已购 ${soldCount} / 6`, 322, 172, {
        size: 24, color: THEME.textDim,
      });
    }
    infoBadge(ctx, this.infoRect.x + 28, this.infoRect.y + 28, 22);

    text(ctx, `兵营 ${st.units.length} / ${slots.unlocked}`, 706, 232, {
      size: 26, align: 'right', color: full ? THEME.red : THEME.textDim,
    });

    // 购买等级
    text(ctx, '购买等级', 44, 286, { size: 23, color: THEME.text });
    this.tabRects = [];
    CONFIG.shop.levels.forEach((lv, i) => {
      const rect = { x: TAB_X0 + i * TAB_GAP, y: TAB_Y, w: TAB_W, h: TAB_H };
      this.tabRects.push({ rect, level: lv });
      const on = this.level === lv;
      button(ctx, rect, `Lv${lv}`, {
        size: 26,
        fill: on ? '#332c1d' : THEME.panel,
        stroke: THEME.line,
        textColor: on ? THEME.gold : THEME.text,
        active: on,
      });
    });

    this.cardRects = [];
    // 商城只卖 4 个普通兵种；稀有 / 史诗 / 传奇兵种只能靠首通宝箱获得
    const wares = CONFIG.troops.filter((t) => !t.baseTroop);
    wares.forEach((t, i) => {
      const x = CARD_X0 + i * (CARD_W + CARD_GAP);
      const y = CARD_Y;
      const price = shopPrice(t.id, this.level);
      const s = statsFor(t.id, this.level);
      const affordable = st.coins >= price;
      const buyRect = { x: x + 16, y: y + SHOP_LAYOUT.buyOffsetY, w: CARD_W - 32, h: BUY_H };
      this.cardRects.push({ rect: buyRect, troop: t.id });

      panel(ctx, x, y, CARD_W, CARD_H, { fill: '#2b2217', stroke: THEME.line, r: 18 });

      text(ctx, t.name, x + CARD_W / 2, y + 32, { size: 28, weight: '600', align: 'center' });
      text(ctx, unitName(t.id, this.level), x + CARD_W / 2, y + 66, {
        size: 20, align: 'center', color: THEME.gold, maxWidth: CARD_W - 12,
      });

      text(ctx, '生命', x + 14, y + 104, { size: 18, color: THEME.textDim });
      text(ctx, `${s.hp}`, x + CARD_W - 14, y + 104, { size: 20, align: 'right' });
      text(ctx, '攻击', x + 14, y + 136, { size: 18, color: THEME.textDim });
      text(ctx, `${s.atk}`, x + CARD_W - 14, y + 136, { size: 20, align: 'right' });
      text(ctx, '防御', x + 14, y + 168, { size: 18, color: THEME.textDim });
      text(ctx, `${s.def}`, x + CARD_W - 14, y + 168, { size: 20, align: 'right' });

      const sheet = sheetFor(t.id, spriteTierFor(this.level));
      drawFrame(ctx, sheet, 'idle', 0, x + CARD_W / 2, y + 330, 0.95, false);

      coinBadge(ctx, x + CARD_W / 2, y + 382, price, {
        size: 22, align: 'center',
      });

      const canBuy = affordable && !full;
      button(ctx, buyRect, full ? '兵营已满' : affordable ? '购 买' : '铜钱不足', {
        size: 24,
        fill: canBuy ? '#332c1d' : THEME.panel,
        stroke: canBuy ? THEME.goldDim : THEME.line,
        textColor: canBuy ? THEME.gold : THEME.textWeak,
      });
    });

    // 特殊宝箱：稀有 / 史诗铜钱直购；木箱 ×3、银箱 ×1 看广告获取（共用每日额度）
    const P = SHOP_LAYOUT.chestPanel;
    panel(ctx, P.x, P.y, P.w, P.h, { fill: 'rgba(43,34,23,0.6)', stroke: THEME.line, r: 18 });
    text(ctx, '特殊宝箱 · 铜钱直购 / 看广告领取', 100, P.y + 30, {
      size: 26, color: THEME.goldDim,
    });
    this.chestRects = [];
    (CONFIG.shop.chests || []).forEach((item, i) => {
      const type = chestType(item.id);
      const y = SHOP_LAYOUT.chestRowY[i];
      if (!type) return;
      const affordable = st.coins >= item.price;
      drawChest(ctx, SHOP_LAYOUT.chestIconX, y + 22, SHOP_LAYOUT.chestIconS, { color: type.color });
      text(ctx, type.name, SHOP_LAYOUT.chestTextX, y + 12, { size: 26, color: THEME.text });
      text(ctx, `${item.price} 铜钱`, SHOP_LAYOUT.chestPriceX, y + 14, {
        size: 24, align: 'right', color: affordable ? THEME.gold : THEME.red,
      });
      const btn = {
        x: SHOP_LAYOUT.chestBtn.x, y: y + SHOP_LAYOUT.chestBtn.offsetY,
        w: SHOP_LAYOUT.chestBtn.w, h: SHOP_LAYOUT.chestBtn.h,
      };
      this.chestRects.push({ rect: btn, id: item.id });
      button(ctx, btn, affordable ? '购 买' : '铜钱不足', {
        size: 22,
        fill: affordable ? '#332c1d' : THEME.panel,
        stroke: affordable ? THEME.goldDim : THEME.line,
        textColor: affordable ? THEME.gold : THEME.textWeak,
        disabled: !affordable,
      });
    });

    // 广告宝箱：两个并排按钮，只显示按钮本身（不暴露剩余次数/上限）
    const state = shopAdsState(st);
    this.adChestRects = [];
    (CONFIG.ads.shopOffers || []).forEach((offer, i) => {
      const A = SHOP_LAYOUT.adRow;
      const rect = {
        x: A.x0 + i * (A.w + A.gap), y: A.y, w: A.w, h: A.h,
      };
      const channel = offer.limitKey;
      const left = adsLeft(st, channel);
      this.adChestRects.push({ rect, id: offer.id });
      button(ctx, rect, left > 0 ? `广告 · ${offer.name}` : `${offer.name} 已领完`, {
        size: 18,
        fill: left > 0 ? '#2a2416' : THEME.panel,
        stroke: left > 0 ? THEME.goldDim : THEME.line,
        textColor: left > 0 ? THEME.gold : THEME.textWeak,
        disabled: left <= 0,
      });
    });

    if (this.infoOpen) {
      const lines = [
        '每日商店：通关 100 关开放，每天 6 个栏位，0 点刷新，每栏限购 1 次。',
        '铜钱买兵：买到的单位直接进兵营；去「布阵」页安排上场。',
        `价格 = 基础价 ×2^(等级-1)：买 Lv${this.level} 约等于 ${Math.pow(2, this.level - 1)} 个 Lv1。`,
        '兵营格子满了就买不了，先去兵营合成。',
        '稀有 / 史诗宝箱可铜钱直购；传奇兵种仍靠首通 / 传奇宝箱。',
        ...(CONFIG.shop.chests || []).map((c) => {
          const t = chestType(c.id);
          return t ? `${t.name}：${t.desc}` : '';
        }).filter(Boolean),
        '商店广告：小木箱、银箱都可以看广告领取，领完明天再来。',
        '铜钱来自关卡首通 + 首页挂机收益（重复挑战不产出）。',
      ];
      infoModal(ctx, W, g.H, '商 城 说 明', lines);
    }
  }
}
