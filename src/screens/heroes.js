// 英雄页：两级结构
//   列表页：只展示「等级 + 将领建模 + 史诗边框」，点卡片（建模）进入详情；
//   详情页：生命 / 攻击 / 防御 / 战力、战法说明与升级按钮。
// 招募入口仍在列表页底部。
import { THEME, text, panel, button, coinBadge, hit, backButton, infoBadge, infoModal, roundRectPath, carvedFrame } from '../render/draw.js';
import { now as clockNow } from '../core/clock.js';
import { CONFIG } from '../data/config.js';
import { HEROES, HERO_MAX_LEVEL, heroById, heroStatsFor, heroSkillSummary } from '../data/heroes.js';
import { drawHeroFigure, drawHeroAura, drawHeroHalo, heroAuraColor, heroNameColor } from '../render/heroArt.js';
import {
  heroLevel, heroLevelCap, ownsHero, unlockedHeroes, heroTickets, pullHeroes,
  upgradeHero, heroUpgradeCost, heroPower,
  pendingLevelHeroReward, claimLevelHeroReward,
  pendingRecruitBoxes, claimRecruitBox, recruitBoxChoices,
} from '../core/heroes.js';
// #dev-only:start
import { devGrantAllHeroes } from '../core/heroes.js';
// #dev-only:end
import { troopById, rarityInfo, unitName, spriteTierFor } from '../core/units.js';
import { drawFrame, sheetFor } from '../render/sprites.js';
import { playSfx } from '../core/audio.js';

// 品级色单一来源：史诗紫气 / 传奇鎏金，与 CONFIG.rarity 全局一致（「汉帛·朱金」v2）
export const HERO_EPIC_BORDER = CONFIG.rarity.epic.color;
const HERO_EPIC_TEXT = '#c2b3c9';

// 招募概率展示：直接读 CONFIG 权重表，保证玩家看到的就是实际概率
const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇' };
function recruitPoolLines() {
  const pool = CONFIG.heroes.recruit.pool || [];
  const fmt = (p) => {
    const rarity = RARITY_LABEL[p.rarity] || RARITY_LABEL[p.tier] || p.rarity || p.tier;
    if (p.kind === 'hero') return `${rarity}英雄 ${p.weight}%`;
    if (p.kind === 'box') return `${rarity}自选箱 Lv${p.level} ${p.weight}%`;
    return `${rarity}兵 Lv${p.level} ${p.weight}%`;
  };
  return [
    `招募概率：${pool.slice(0, 5).map(fmt).join(' / ')}`,
    pool.slice(5).map(fmt).join(' / '),
  ];
}

const CARD_W = 222;
const CARD_H = 300;
const CARD_GAP = 15;
const CARD_X0 = 27;
const CARD_Y0 = 216;
const CARD_ROW_GAP = 16;
// 12 名英雄不再分页：传奇在前、史诗在后，同品级按当前等级降序，放进一个可上下滑的列表
const VIEW = { x: 18, y: 208, w: 714, h: 634 };

export const HERO_LAYOUT = {
  cardW: CARD_W, cardH: CARD_H, cardGap: CARD_GAP, cardX0: CARD_X0,
  cardY0: CARD_Y0, cardRowGap: CARD_ROW_GAP, view: VIEW,
  // 详情页的升级按钮（列表页不再放升级键）
  detailUpRect: { x: 120, y: 1128, w: 510, h: 76 },
  // #dev-only:start
  // 开发者通道：右下角不显眼的小入口，明确标注 DEV
  devRect: { x: 638, y: 92, w: 72, h: 30 },
  // #dev-only:end
  claimRect: { x: 195, y: 700, w: 360, h: 80 },
  pullRect: { x: 100, y: 984, w: 236, h: 72 },
  tenRect: { x: 404, y: 984, w: 236, h: 72 },
};

// 自选箱弹窗：2×2 的兵种卡（带建模图标），选完才入账
export const BOX_LAYOUT = {
  panel: { x: 60, y: 250, w: 630, h: 790 },
  cardW: 238, cardH: 222, gapX: 30, gapY: 26, x0: 122, y0: 468,
};

// 英雄排序：传奇 → 史诗，同品级按当前实际等级从高到低（等级相同按名称兜底）
export function sortHeroesByLevel(st) {
  const rank = { legendary: 0, epic: 1 };
  return [...HEROES].sort((a, b) => {
    const ra = rank[a.tier] ?? 1;
    const rb = rank[b.tier] ?? 1;
    if (ra !== rb) return ra - rb;
    const la = heroLevel(st, a.id);
    const lb = heroLevel(st, b.id);
    if (lb !== la) return lb - la;
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });
}

// 中文按字数折行（labels 不参与排版，纯粹为了卡片里的战法说明不糊成一条）
function wrapCJK(str, perLine, maxLines) {
  const plain = String(str).replace(/[。；]$/, '');
  const lines = [];
  let cur = '';
  for (const ch of plain) {
    cur += ch;
    if (cur.length >= perLine) {
      lines.push(cur);
      cur = '';
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // 避免最后一行只剩一个标点（并到上一行）
  if (lines.length > 1 && lines[lines.length - 1].length <= 1) {
    lines[lines.length - 2] += lines.pop();
  }
  return lines;
}

export class HeroScreen {
  constructor(game) {
    this.game = game;
    this.artBg = 'recruit';
    this.bgm = 'main';
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    // 12 名英雄一个连续列表：传奇在前，同品级按当前等级降序
    this.scrollY = 0;
    this.listDrag = null;
    this.cardRects = [];
    this.pullResult = null;
    // 抽到自选箱后强制进入选择页（未选完不入账；存档里也保留待选队列）
    this.boxOpen = pendingRecruitBoxes(game.state).length > 0;
    // #dev-only:start
    this.devOpen = false;
    this.devResult = null;
    // #dev-only:end
    // null = 列表页；heroId = 该英雄的详情页
    this.detailId = null;
    // 关卡首通赠将（当前配置：250 关关平）：进入英雄页时自动弹领取卡（防重复由 core 记录）
    const rewardLevels = Object.keys(CONFIG.heroes.levelHeroRewards || {})
      .map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    this.claimLevel = rewardLevels.find((n) => (game.state.maxCleared || 0) >= n
      && pendingLevelHeroReward(game.state, n)) || null;
    this.claimOpen = !!this.claimLevel;
    this.claimDone = false;
    this.nowMs = clockNow();
    this.infoOpen = false;
    this.infoRect = { x: 602, y: 866, w: 56, h: 56 };
  }

  // 按当前滚动偏移计算所有卡片的点击热区（draw 与 tap 共用一份）
  layoutCards() {
    const st = this.game.state;
    return sortHeroesByLevel(st).map((h, i) => ({
      id: h.id,
      hero: h,
      rect: {
        x: CARD_X0 + (i % 3) * (CARD_W + CARD_GAP),
        y: CARD_Y0 + Math.floor(i / 3) * (CARD_H + CARD_ROW_GAP) - this.scrollY,
        w: CARD_W,
        h: CARD_H,
      },
    }));
  }

  maxScroll() {
    const rows = Math.ceil(HEROES.length / 3);
    const contentH = rows * (CARD_H + CARD_ROW_GAP) - CARD_ROW_GAP;
    return Math.max(0, contentH - VIEW.h);
  }

  onDown(x, y) {
    // 弹窗 / 详情页不参与列表滚动
    const modalOpen = this.detailId || this.pullResult || this.boxOpen
      // #dev-only:start
      || this.devOpen
      // #dev-only:end
      || (this.claimOpen && !this.claimDone);
    if (modalOpen) return;
    if (hit(VIEW, x, y)) this.listDrag = { y, scrollY: this.scrollY, moved: false };
  }

  onMove(x, y) {
    if (!this.listDrag) return;
    const dy = this.listDrag.y - y;
    if (Math.abs(dy) > 5) this.listDrag.moved = true;
    this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.listDrag.scrollY + dy));
  }

  onUp(x, y) {
    const d = this.listDrag;
    this.listDrag = null;
    if (d && d.moved) return;   // 上下滑动了就不触发点击
    this.tap(x, y);
  }

  update() {
    this.nowMs = clockNow();
  }

  tap(x, y) {
    const g = this.game;
    // 招募结果弹窗：点任意位置关闭；若有自选箱，随后强制进入选择页
    if (this.pullResult) {
      this.pullResult = null;
      this.boxOpen = pendingRecruitBoxes(g.state).length > 0;
      return;
    }
    // 自选箱选择页：必须选一个兵种才入账，不能关闭 / 反悔
    if (this.boxOpen) return this.tapBox(x, y);
    // 说明弹层：点任意位置关闭
    if (this.infoOpen) { this.infoOpen = false; return; }
    // 关卡赠将领取卡（模态，领取或点「稍后」关闭）
    if (this.claimOpen && !this.claimDone) {
      if (hit(HERO_LAYOUT.claimRect, x, y)) {
        const r = claimLevelHeroReward(g.state, this.claimLevel);
        if (r.ok) {
          this.claimDone = true;
          this.claimOpen = false;
          g.save();
          playSfx('reward');
          if (r.duplicate) {
            const extra = r.tickets ? ` + ${r.tickets} 张招募券` : '';
            g.toast(`已拥有该英雄，折算 ${r.coins} 铜钱${extra}`);
          } else {
            g.toast(`领取成功：${heroById(r.hero).tier === 'legendary' ? '传奇' : '史诗'}英雄「${heroById(r.hero).name}」加入上阵`);
          }
        }
      } else {
        this.claimOpen = false;
      }
      return;
    }
    // #dev-only:start
    // 开发者通道弹窗（只给调试用）
    if (this.devOpen) {
      if (this.devResult) { this.devResult = null; this.devOpen = false; return; }
      if (hit({ x: 160, y: 640, w: 430, h: 74 }, x, y)) {
        const r = devGrantAllHeroes(g.state);
        this.devResult = r;
        g.save();
        playSfx('chest', { volume: 0.8 });
        return;
      }
      if (hit({ x: 195, y: 760, w: 360, h: 60 }, x, y)) { this.devOpen = false; return; }
      return;
    }
    // #dev-only:end
    // 详情页：左上角返回列表；否则只响应升级键
    if (this.detailId) {
      if (hit(this.backRect, x, y)) { this.detailId = null; return; }
      if (hit(HERO_LAYOUT.detailUpRect, x, y)) return this.levelUp(this.detailId);
      return;
    }
    if (hit(this.backRect, x, y)) return g.pop();
    if (hit(this.infoRect, x, y)) { this.infoOpen = true; return; }
    // #dev-only:start
    if (hit(HERO_LAYOUT.devRect, x, y)) { this.devOpen = true; return; }
    // #dev-only:end
    if (hit(HERO_LAYOUT.pullRect, x, y)) return this.pull(1);
    if (hit(HERO_LAYOUT.tenRect, x, y)) return this.pull(CONFIG.heroes.tenPull);
    // 列表页：点卡片（将军建模）进入详情页（只认视口内、未滚出的卡片）
    for (const c of (this.cardRects.length ? this.cardRects : this.layoutCards())) {
      if (c.rect.y + c.rect.h < VIEW.y || c.rect.y > VIEW.y + VIEW.h) continue;
      if (hit(c.rect, x, y)) { this.detailId = c.id; this.nowMs = clockNow(); return; }
    }
  }

  pull(count) {
    const g = this.game;
    const r = pullHeroes(g.state, count);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      g.toast(`招募券不足：需要 ${r.need} 张，当前 ${r.have} 张`);
      return;
    }
    g.save();
    playSfx('chest', { volume: 0.8 });
    this.pullResult = r.results;
  }

  // 自选箱当前可选的兵种卡（draw 与 tap 共用一份热区）
  boxCardRects() {
    const box = pendingRecruitBoxes(this.game.state)[0];
    if (!box) return [];
    return recruitBoxChoices(this.game.state, box).map((troop, i) => ({
      troop,
      rect: {
        x: BOX_LAYOUT.x0 + (i % 2) * (BOX_LAYOUT.cardW + BOX_LAYOUT.gapX),
        y: BOX_LAYOUT.y0 + Math.floor(i / 2) * (BOX_LAYOUT.cardH + BOX_LAYOUT.gapY),
        w: BOX_LAYOUT.cardW,
        h: BOX_LAYOUT.cardH,
      },
    }));
  }

  tapBox(x, y) {
    const g = this.game;
    const box = pendingRecruitBoxes(g.state)[0];
    if (!box) { this.boxOpen = false; return; }
    const card = this.boxCardRects().find((c) => hit(c.rect, x, y));
    if (!card) return;
    const r = claimRecruitBox(g.state, box.id, card.troop.id);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      g.toast(r.reason === 'full' ? '兵营已满，腾出位置后再选' : '该兵种当前不可选');
      return;
    }
    g.save();
    playSfx('chest', { volume: 0.8 });
    g.toast(`自选箱：${unitName(r.troop, r.level)} Lv${r.level} 已入营`);
    if (!pendingRecruitBoxes(g.state).length) this.boxOpen = false;
  }

  levelUp(id) {
    const g = this.game;
    const r = upgradeHero(g.state, id);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      if (r.reason === 'max') g.toast('该英雄已经满级');
      else if (r.reason === 'poor') g.toast(`铜钱不足，还差 ${r.cost - g.state.coins}`);
      else g.toast('还没有获得这位英雄，先招募');
      return;
    }
    g.save();
    playSfx('buy');
    const hero = heroById(id);
    g.toast(`${hero.name} 升到 Lv${r.level}（花费 ${r.cost} 铜钱）`);
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const detail = this.detailId ? heroById(this.detailId) : null;

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, detail ? '英雄详情' : '招 募 系 统', W / 2 + 20, 76, {
      size: 34, weight: '600', align: 'center',
    });
    coinBadge(ctx, 700, 76, st.coins, { size: 24, align: 'right' });
    if (detail) {
      text(ctx, '‹ 返回列表', 104, 126, { size: 20, align: 'center', color: THEME.textWeak });
      this.drawDetail(ctx, detail, W);
      return;
    }

    const owned = unlockedHeroes(st).length;
    text(ctx, `招募券 ×${heroTickets(st)}`, 44, 160, { size: 28, color: THEME.gold });
    text(ctx, `已拥有 ${owned} / ${HEROES.length}`, 44, 196, { size: 20, color: THEME.textDim });

    // #dev-only:start
    // 开发者通道：小型 DEV 入口，点击后弹明确标注的调试面板
    button(ctx, HERO_LAYOUT.devRect, 'DEV', {
      size: 13, fill: 'rgba(43,34,23,0.5)', stroke: '#8a6a32', textColor: '#d59947',
    });
    // #dev-only:end

    const sorted = sortHeroesByLevel(st);
    this.scrollY = Math.max(0, Math.min(this.maxScroll(), this.scrollY));
    this.cardRects = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    ctx.clip();
    const cards = this.layoutCards();
    this.cardRects = cards;
    sorted.forEach((h, i) => {
      const { rect } = cards[i];
      const x = rect.x;
      const y = rect.y;
      if (y + CARD_H < VIEW.y || y > VIEW.y + VIEW.h) return;
      this.drawCard(ctx, h, x, y);
    });
    ctx.restore();

    const max = this.maxScroll();
    if (max > 0) {
      const x = VIEW.x + VIEW.w - 6;
      panel(ctx, x, VIEW.y + 4, 4, VIEW.h - 8, { fill: 'rgba(255,255,255,0.07)', stroke: null, r: 2, lw: 0 });
      const ratio = VIEW.h / (VIEW.h + max);
      const hh = Math.max(26, (VIEW.h - 8) * ratio);
      const sy = VIEW.y + 4 + (VIEW.h - 8 - hh) * (this.scrollY / max);
      panel(ctx, x - 1, sy, 6, hh, { fill: 'rgba(213,153,71,0.75)', stroke: null, r: 3, lw: 0 });
    }

    // 底部：招募入口（说明收进右上角「!」）
    panel(ctx, 70, 850, 610, 226, { fill: 'rgba(43,34,23,0.6)', stroke: THEME.line, r: 18 });
    carvedFrame(ctx, 70, 850, 610, 226, {
      color: THEME.gold, alpha: 0.62, corner: 34, inset: 5, lw: 1.8, r: 18, glow: 3,
    });
    text(ctx, `1 券 1 抽 · ${CONFIG.heroes.recruit.pity} 抽必出传奇`, 375, 900, {
      size: 28, align: 'center', color: THEME.text,
    });
    infoBadge(ctx, this.infoRect.x + 28, this.infoRect.y + 28, 22);
    const tickets = heroTickets(st);
    button(ctx, HERO_LAYOUT.pullRect, `招募 ×1（${CONFIG.heroes.pullCost} 券）`, {
      size: 26,
      fill: tickets >= 1 ? '#332c1d' : THEME.panel,
      stroke: tickets >= 1 ? HERO_EPIC_BORDER : THEME.line,
      textColor: tickets >= 1 ? HERO_EPIC_TEXT : THEME.textWeak,
      disabled: tickets < 1,
    });
    button(ctx, HERO_LAYOUT.tenRect, `十连招募（${CONFIG.heroes.tenPull} 券）`, {
      size: 24,
      fill: tickets >= 10 ? '#332c1d' : THEME.panel,
      stroke: tickets >= 10 ? HERO_EPIC_BORDER : THEME.line,
      textColor: tickets >= 10 ? HERO_EPIC_TEXT : THEME.textWeak,
      disabled: tickets < 10,
    });

    if (this.claimOpen && !this.claimDone) this.drawClaimModal(ctx, W);
    // #dev-only:start
    if (this.devOpen) this.drawDevModal(ctx, W);
    // #dev-only:end
    if (this.boxOpen) this.drawBoxModal(ctx, W);
    if (this.pullResult) this.drawPullResult(ctx, W);
    if (this.infoOpen) {
      infoModal(ctx, W, g.H, '招 募 说 明', [
        `1 券 1 抽，${CONFIG.heroes.recruit.pity} 抽必出传奇（自选箱也计入保底）。`,
        ...recruitPoolLines(),
        '已拥有的英雄不会重复进入招募池。',
        '招募券来源：英雄战每 5 关首通 +1；主线 200 关后每 10 关 +1（需先通关 1 场英雄战）；演武首通 +1。',
        `重复获得英雄会折算铜钱与招募券；点英雄建模进入详情，可花铜钱升级（满级 ${HERO_MAX_LEVEL}）。`,
        '上下滑动可浏览全部英雄；传奇在前，同品级按等级排序。',
      ]);
    }
  }

  // 自选箱选择页：列出该品级已解锁兵种（带建模），点卡片才入账
  drawBoxModal(ctx, W) {
    const st = this.game.state;
    const box = pendingRecruitBoxes(st)[0];
    if (!box) { this.boxOpen = false; return; }
    const rar = CONFIG.rarity[box.rarity] || CONFIG.rarity.common;
    ctx.save();
    ctx.fillStyle = 'rgba(13,10,7,0.78)';
    ctx.fillRect(0, 0, W, this.game.H);
    ctx.restore();
    const p = BOX_LAYOUT.panel;
    panel(ctx, p.x, p.y, p.w, p.h, {
      fill: 'rgba(43,34,23,0.98)', stroke: rar.color, r: 22, lw: 2,
    });
    text(ctx, '自 选 箱', W / 2, p.y + 50, { size: 28, align: 'center', color: rar.color });
    text(ctx, `${rar.name}兵自选箱 · Lv${box.level}`, W / 2, p.y + 92, {
      size: 20, align: 'center', color: THEME.text,
    });
    text(ctx, '选 1 个兵种，选完立即入营', W / 2, p.y + 126, {
      size: 17, align: 'center', color: THEME.textWeak, maxWidth: 540,
    });
    for (const c of this.boxCardRects()) this.drawBoxCard(ctx, c.troop, c.rect, box.level);
    const left = pendingRecruitBoxes(st).length;
    text(ctx, `待选自选箱：${left} 个`, W / 2, p.y + p.h - 30, {
      size: 14, align: 'center', color: THEME.textWeak,
    });
  }

  drawBoxCard(ctx, troop, rect, level) {
    const rar = rarityInfo(troop.id);
    const tx = rect.x + rect.w / 2;
    panel(ctx, rect.x, rect.y, rect.w, rect.h, {
      fill: '#1b2433', stroke: rar.color, r: 14, lw: 2,
    });
    text(ctx, troop.name, tx, rect.y + 34, { size: 23, align: 'center', color: THEME.text });
    text(ctx, `${rar.name} · ${unitName(troop.id, level)}`, tx, rect.y + 62, {
      size: 14, align: 'center', color: THEME.textDim,
    });
    const sheet = sheetFor(troop.id, spriteTierFor(level));
    drawFrame(ctx, sheet, 'idle', 0, tx, rect.y + rect.h - 12, 1.3);
    text(ctx, `Lv${level}`, rect.x + rect.w - 14, rect.y + rect.h - 12, {
      size: 17, align: 'right', color: THEME.gold,
    });
  }

  // 400 关首通关平领取卡：与结算页共用同一套 core 领取逻辑，防重复
  drawClaimModal(ctx, W) {
    ctx.save();
    ctx.fillStyle = 'rgba(13,10,7,0.72)';
    ctx.fillRect(0, 0, W, this.game.H);
    ctx.restore();
    panel(ctx, 135, 430, 480, 360, { fill: 'rgba(43,34,23,0.98)', stroke: '#d59947', r: 22, lw: 3 });
    text(ctx, '首 通 奖 励', W / 2, 480, { size: 26, align: 'center', color: '#d59947' });
    const rewardId = pendingLevelHeroReward(this.game.state, this.claimLevel) || 'guanping';
    const rewardHero = heroById(rewardId);
    text(ctx, (rewardHero ? rewardHero.name : '关平').split('').join(' '), W / 2, 558, {
      size: 48, weight: '700', align: 'center', color: '#d59947',
    });
    text(ctx, `${rewardHero && rewardHero.tier === 'legendary' ? '传奇' : '史诗'}英雄 · 第 ${this.claimLevel} 关首通奖励（仅可领取一次）`, W / 2, 600, {
      size: 17, align: 'center', color: THEME.textDim,
    });
    button(ctx, HERO_LAYOUT.claimRect, `领 取 ${rewardHero ? rewardHero.name : '关平'}`, {
      size: 28, fill: '#332c1d', stroke: '#d59947', textColor: '#f4d488',
    });
    text(ctx, '点空白处稍后再领', W / 2, 810, {
      size: 14, align: 'center', color: THEME.textWeak,
    });
  }

  // #dev-only:start
  // 开发者通道：明确标注「开发者功能」，方便调试一键拿全部英雄
  drawDevModal(ctx, W) {
    ctx.save();
    ctx.fillStyle = 'rgba(13,10,7,0.78)';
    ctx.fillRect(0, 0, W, this.game.H);
    ctx.restore();
    panel(ctx, 100, 420, 550, 460, { fill: 'rgba(33,26,18,0.98)', stroke: '#8a6a32', r: 22, lw: 2 });
    text(ctx, '开发者通道 · 英雄', W / 2, 468, { size: 26, align: 'center', color: '#d59947' });
    text(ctx, '仅用于调试 / 体验，不属于正常玩家功能', W / 2, 506, {
      size: 15, align: 'center', color: THEME.textWeak,
    });
    if (this.devResult) {
      text(ctx, `已发放 ${this.devResult.added.length} 名新英雄`, W / 2, 596, {
        size: 20, align: 'center', color: THEME.gold,
      });
      text(ctx, `当前共拥有 ${unlockedHeroes(this.game.state).length} / ${HEROES.length} 名（点任意处关闭）`, W / 2, 628, {
        size: 15, align: 'center', color: THEME.textDim,
      });
    } else {
      button(ctx, { x: 160, y: 640, w: 430, h: 74 }, '一键获得全部英雄', {
        size: 24, fill: '#332c1d', stroke: '#d59947', textColor: '#f4d488',
      });
      text(ctx, '已拥有的英雄不会重复升级', W / 2, 730, {
        size: 15, align: 'center', color: THEME.textDim,
      });
    }
    button(ctx, { x: 195, y: 760, w: 360, h: 60 }, '关 闭', {
      size: 18, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak,
    });
  }
  // #dev-only:end

  // 列表卡片：品级 + 名字 + 等级 + 专属建模 + 品级光环
  // 「汉帛·朱金」质感：暖褐卡面 + 品级色晕染 + 双描边 + 顶部高光 + 传奇四角金饰
  drawCard(ctx, h, x, y) {
    const st = this.game.state;
    const lv = heroLevel(st, h.id);
    const cap = heroLevelCap(st);
    const owned = lv > 0;
    const legendary = h.tier === 'legendary';
    const tierColor = heroAuraColor(h);
    const tierName = legendary ? '传奇' : '史诗';
    // 品级色 RGB（用于渐变），传奇=鎏金 史诗=紫气
    const rgb = legendary ? '232,180,76' : '155,119,207';

    ctx.save();
    // ① 卡面：暖褐底 + 品级色径向晕染（上亮下暗，营造立体）
    roundRectPath(ctx, x, y, CARD_W, CARD_H, 18);
    const bg = ctx.createLinearGradient(x, y, x, y + CARD_H);
    bg.addColorStop(0, owned ? '#232d34' : '#2b2217');
    bg.addColorStop(1, owned ? '#141a1f' : '#0f1418');
    ctx.fillStyle = bg; ctx.fill();
    // 品级晕染（顶部一圈柔光）
    const glow = ctx.createRadialGradient(x + CARD_W / 2, y + 96, 8, x + CARD_W / 2, y + 120, CARD_W * 0.86);
    glow.addColorStop(0, `rgba(${rgb},${owned ? 0.20 : 0.11})`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow; ctx.fill();
    ctx.restore();

    // ② 外描边（品级色）
    panel(ctx, x, y, CARD_W, CARD_H, { fill: null, stroke: tierColor, r: 18, lw: legendary ? 2.5 : 2 });
    // ③ 内圈细描边（史诗双线 / 传奇金线）——方案里"史诗紫内圈双描边、传奇四角金线"
    ctx.save();
    roundRectPath(ctx, x + 5, y + 5, CARD_W - 10, CARD_H - 10, 14);
    ctx.strokeStyle = `rgba(${rgb},0.42)`; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    // ④ 顶部高光条（金属质感）
    ctx.save();
    roundRectPath(ctx, x + 9, y + 9, CARD_W - 18, 3, 2);
    const hi = ctx.createLinearGradient(x, 0, x + CARD_W, 0);
    hi.addColorStop(0, `rgba(${rgb},0)`); hi.addColorStop(0.5, `rgba(${rgb},0.55)`); hi.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = hi; ctx.fill();
    ctx.restore();
    // ⑤ 传奇四角金饰（L 形角线）
    if (legendary) {
      ctx.save();
      ctx.strokeStyle = '#f4d488'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      const m = 9, len = 18;
      const corners = [
        [x + m, y + m, 1, 1], [x + CARD_W - m, y + m, -1, 1],
        [x + m, y + CARD_H - m, 1, -1], [x + CARD_W - m, y + CARD_H - m, -1, -1],
      ];
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * len, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 品级角标
    panel(ctx, x + 12, y + 12, 62, 26, { fill: 'rgba(23,19,14,0.7)', stroke: tierColor, r: 8, lw: 1 });
    text(ctx, tierName, x + 43, y + 25, { size: 14, align: 'center', color: tierColor });

    text(ctx, h.name, x + 14, y + 56, {
      size: 28, weight: '600', color: owned ? heroNameColor(h) : THEME.textWeak,
    });
    text(ctx, owned ? `Lv${lv} / ${cap}` : '未获得', x + 14, y + 88, {
      size: 19, color: owned ? THEME.text : THEME.textWeak,
    });

    // 建模（列表页的核心信息）：专属剪影 + 脚下品级光环
    drawHeroHalo(ctx, h.tier, x + CARD_W / 2, y + 248, 136, 42, owned ? 0.95 : 0.5);
    drawHeroFigure(ctx, h.id, {
      x: x + CARD_W / 2, y: y + 256, size: 148, action: 'idle', t: 0.9, alpha: owned ? 1 : 0.55,
    });
  }

  // 详情页：数值、战力、战法、升级
  drawDetail(ctx, h, W) {
    const st = this.game.state;
    const lv = heroLevel(st, h.id);
    const owned = lv > 0;
    const cap = heroLevelCap(st);
    const showLv = owned ? lv : 1;
    const s = heroStatsFor(h.id, showLv);
    const cost = owned && lv < cap ? heroUpgradeCost(lv, h.id) : 0;
    const affordable = cost > 0 && st.coins >= cost;
    const tierColor = heroAuraColor(h);
    const tierName = h.tier === 'legendary' ? '传奇' : '史诗';

    panel(ctx, 75, 150, 600, 1190, {
      fill: 'rgba(22,28,38,0.94)', stroke: tierColor, r: 22, lw: 2,
    });
    panel(ctx, 100, 172, 70, 28, { fill: 'rgba(0,0,0,0.32)', stroke: tierColor, r: 8, lw: 1 });
    text(ctx, tierName, 135, 186, { size: 15, align: 'center', color: tierColor });

    text(ctx, h.name, 375, 208, { size: 38, weight: '600', align: 'center', color: heroNameColor(h) });
    text(ctx, h.title, 375, 242, { size: 18, align: 'center', color: THEME.textDim });
    text(ctx, owned ? `Lv${lv} / ${cap}` : '未获得（去列表页招募）', 375, 274, {
      size: 20, align: 'center', color: owned ? THEME.text : THEME.textWeak,
    });

    drawHeroAura(ctx, h.tier, 375, 424, 150, 0.9, owned ? 0.9 : 0.45);
    drawHeroFigure(ctx, h.id, {
      x: 375, y: 424, size: 150, action: 'idle', t: 1.4, alpha: owned ? 1 : 0.55,
    });

    // 数值三连 + 战力
    const statY = 486;
    const cols = [
      { label: '生命', value: s.hp, x: 190 },
      { label: '攻击', value: s.atk, x: 375 },
      { label: '防御', value: s.def, x: 560 },
    ];
    for (const c of cols) {
      text(ctx, c.label, c.x, statY, { size: 16, align: 'center', color: THEME.textDim });
      text(ctx, `${c.value}`, c.x, statY + 34, { size: 26, align: 'center', weight: '600' });
    }
    text(ctx, `战力 ${heroPower(h.id, showLv)}`, 375, statY + 78, {
      size: 22, align: 'center', color: THEME.gold,
    });

    // 战法（新表技能描述更长，按 22 字折 4 行）
    text(ctx, `战法 · ${h.skill.name}`, 110, 590, { size: 20, color: tierColor });
    wrapCJK(h.skill.desc, 22, 4).forEach((ln, k) => {
      text(ctx, ln, 110, 618 + k * 22, { size: 15, color: THEME.textDim });
    });

    // 获取 / 成长说明
    text(ctx, `获取：${h.unlock}`, 110, 736, { size: 15, color: THEME.textDim, maxWidth: 530 });
    const dupNote = h.tier === 'legendary'
      ? '已拥有 → 招募池不再出现（其它来源重复时折算 8000 铜钱 +1 券）'
      : '已拥有 → 招募池不再出现（其它来源重复时折算 3000 铜钱）';
    text(ctx, h.note || `招募系统可获得该英雄；${dupNote}；升级请花铜钱`, 110, 768, {
      size: 15, color: THEME.textWeak, maxWidth: 530,
    });

    // 当前等级技能数值（与战斗 traits 同源，升级后立即变化）
    text(ctx, `当前 Lv${showLv} 技能数值`, 110, 808, { size: 18, color: tierColor });
    wrapCJK(heroSkillSummary(h.id, showLv), 30, 2).forEach((ln, k) => {
      text(ctx, ln, 110, 836 + k * 22, { size: 15, color: THEME.text });
    });
    text(ctx, `当前上限 Lv${cap}：${heroSkillSummary(h.id, cap)}${cap < HERO_MAX_LEVEL ? `（通关 500 关后开放至 Lv${HERO_MAX_LEVEL}）` : ''}`, 110, 890, {
      size: 13, color: THEME.textWeak, maxWidth: 530,
    });

    // 升级按钮（详情页唯一的操作键）
    if (!owned) {
      button(ctx, HERO_LAYOUT.detailUpRect, '未获得 · 返回列表招募', {
        size: 18, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak, disabled: true,
      });
    } else if (lv >= cap) {
      button(ctx, HERO_LAYOUT.detailUpRect, cap < HERO_MAX_LEVEL ? '已 达 上 限（500 关后开放）' : '已 满 级', {
        size: 20, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak, disabled: true,
      });
    } else {
      button(ctx, HERO_LAYOUT.detailUpRect, `升级 ${cost} 铜钱 → Lv${lv + 1}`, {
        size: 22,
        fill: affordable ? '#332c1d' : THEME.panel,
        stroke: affordable ? HERO_EPIC_BORDER : THEME.line,
        textColor: affordable ? THEME.gold : THEME.textWeak,
        disabled: !affordable,
      });
    }
    text(ctx, '点左上角返回英雄列表', 375, 1300, {
      size: 14, align: 'center', color: THEME.textWeak,
    });
  }

  drawPullResult(ctx, W) {
    const rows = this.pullResult;
    const h = 120 + rows.length * 34;
    panel(ctx, 90, 360, 570, h, { fill: 'rgba(15,20,28,0.97)', stroke: HERO_EPIC_BORDER, r: 20, lw: 2 });
    text(ctx, `招募结果 ×${rows.length}`, W / 2, 400, { size: 24, align: 'center', color: HERO_EPIC_TEXT });
    rows.forEach((r, i) => {
      const y = 440 + i * 34;
      const left = this.resultLabel(r);
      text(ctx, left.label, 130, y, { size: 18, color: left.color });
      text(ctx, left.note, 620, y, {
        size: 15, align: 'right', color: left.noteColor || THEME.textDim,
      });
    });
    const pending = pendingRecruitBoxes(this.game.state).length;
    text(ctx, pending ? '点任意位置关闭 → 进入自选箱选择' : '点任意位置关闭', W / 2, 360 + h - 26, {
      size: 15, align: 'center', color: THEME.textWeak,
    });
  }

  // 招募结果单行文案：兵种 / 自选箱 / 英雄（已拥有与未拥有分开显示）
  resultLabel(r) {
    if (r.kind === 'box') {
      return {
        label: `普通自选箱 · Lv${r.level}`,
        color: CONFIG.rarity.common.color,
        note: '待选择 · 关闭后自选',
        noteColor: '#7fd6a6',
      };
    }
    if (r.kind === 'troop') {
      const t = troopById(r.troop);
      const rar = rarityInfo(r.troop);
      return {
        label: `${rar.name} · ${t ? t.name : r.troop} Lv${r.level}`,
        color: rar.color,
        note: r.full ? '兵营已满，未入账' : (r.fallback ? '已降档入营' : '已入营'),
        noteColor: r.full ? '#c96b6b' : THEME.textDim,
      };
    }
    const h = heroById(r.hero);
    const gold = r.rarity === 'legendary';
    return {
      label: `${gold ? '传奇' : '史诗'}英雄 · ${h ? h.name : r.hero}`,
      color: gold ? '#aa8b58' : (h ? h.color : THEME.text),
      note: r.owned
        ? `已拥有 · +${r.coins} 铜钱${r.tickets ? ` +${r.tickets} 券` : ''}`
        : 'NEW · 获得新英雄',
      noteColor: r.owned ? THEME.textDim : THEME.gold,
    };
  }
}
