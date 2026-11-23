// 周常挑战大厅（1.2.5，1.2.8 改版）：5 档 × 10 小关 + 按档发放积分 draft 选兵。
// 1.2.8：开局只发 320 分，每通一档大关 +240~400（逐档递增）；关卡格放大到 168×164。
// 两个页签：「挑战关卡」（档位切换 + 10 个关卡格 + 奖励/难度说明）与「积分选兵」
// （买兵 / 升级 / 卖出）；出战时进布阵页（DeployScreen weekly 模式），结算由 battle 页回收。
import {
  THEME, text, panel, button, hit, backButton, infoBadge, infoModal,
} from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import {
  ensureWeekly, weeklyUnlocked, weeklyAvailableTroops, draftCapPower,
  buyWeeklyTroop, upgradeWeeklyTroop, removeWeeklyTroop,
  weeklyTierUnlocked, weeklyStageUnlocked, weeklyTierClearedCount, weeklyClearedTotal,
  weeklyLevelDef, weeklySweep,
} from '../core/weekly.js';
import {
  weeklyTierName, weeklyTroopCost, weeklyTroopUpgradeCost,
  weeklyStageCoins, weeklyStageChest, weeklyTierBonusCoins,
  weeklyTotalPoints, weeklyBudgetForTier, weeklyStartPoints, weeklyTierGrant,
} from '../data/weekly.js';
import { engineStageFor } from '../core/siege.js';
import { formatPower, troopPower } from '../core/power.js';
import { unitName } from '../core/units.js';
import { drawUnitCard } from '../render/unitCard.js';
import { weekKey } from '../core/daily.js';
import { DeployScreen } from './deploy.js';
import { playSfx } from '../core/audio.js';

const TAB_STAGES = 0;
const TAB_DRAFT = 1;

// 兵牌格（与兵营同尺寸 164×116）+ 下方操作条 30：4 列 × (164+10) = 686 ≤ 702
const CELL = { w: 164, cardH: 116, stripH: 30, gapX: 10, gapY: 8, x0: 32 };
// 1.2.8 · 关卡格放大（128×150 → 168×164，字号同步加大）：4 列 × (168+10) + 10 = 702
const STAGE_CARD = { w: 168, h: 164, gapX: 10, gapY: 12, x0: 24 };

export const WEEKLY_LAYOUT = {
  tabs: [
    { x: 24, y: 172, w: 344, h: 60 },
    { x: 382, y: 172, w: 344, h: 60 },
  ],
  tier: { y: 240, h: 58, x0: 30, w: 132, gap: 9 },
  stageView: { x: 24, y: 306, w: 702, h: 884 },
  draftView: { x: 24, y: 240, w: 702, h: 950 },
  stageCard: { ...STAGE_CARD, y0: 322 },
  cell: CELL,
  infoRect: { x: 652, y: 40, w: 64, h: 64 },
  backRect: { x: 36, y: 44, w: 124, h: 64 },
};

const CHEST_NAMES = {
  wood: '小木箱', silver: '白银宝箱', gold: '黄金宝箱', rare: '稀有箱',
  epic: '史诗箱', legendary: '传奇箱',
};
function chestName(id) {
  return CHEST_NAMES[id] || id || '';
}

function stageRect(i, scrollY = 0) {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return {
    x: STAGE_CARD.x0 + col * (STAGE_CARD.w + STAGE_CARD.gapX),
    y: WEEKLY_LAYOUT.stageCard.y0 + row * (STAGE_CARD.h + STAGE_CARD.gapY) - scrollY,
    w: STAGE_CARD.w,
    h: STAGE_CARD.h,
  };
}

function cellRect(i, y0) {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const h = CELL.cardH + CELL.stripH;
  return {
    x: CELL.x0 + col * (CELL.w + CELL.gapX),
    y: y0 + row * (h + CELL.gapY),
    w: CELL.w,
    h,
  };
}

export class WeeklyChallengeScreen {
  constructor(game) {
    this.game = game;
    this.bgm = 'main';
    this.tab = TAB_STAGES;
    this.tier = 1;
    this.scrollA = 0;
    this.scrollB = 0;
    this.drag = null;
    this.t = 0;
    this.infoOpen = false;
    this.infoRect = WEEKLY_LAYOUT.infoRect;
    this.backRect = WEEKLY_LAYOUT.backRect;
    this.tierRects = [];
    this.stageCards = [];
    this.shopCells = [];
    this.rosterCells = [];
    const st = game.state;
    if (weeklyUnlocked(st)) {
      const s = ensureWeekly(st);
      this.tier = s.tier || 1;
    }
  }

  update(dt) { this.t += dt || 0; }

  activeView() {
    return this.tab === TAB_STAGES ? WEEKLY_LAYOUT.stageView : WEEKLY_LAYOUT.draftView;
  }

  maxScroll() {
    const st = this.game.state;
    if (this.tab === TAB_STAGES) return 0;   // 关卡页一屏放下，不滚动
    const troops = weeklyAvailableTroops(st);
    const s = ensureWeekly(st);
    const h = CELL.cardH + CELL.stripH;
    const shopRows = Math.ceil(troops.length / 4);
    const rosterRows = Math.ceil(Math.max(1, s.roster.length) / 4);
    const contentH = 46 + shopRows * (h + CELL.gapY) + 46 + rosterRows * (h + CELL.gapY);
    return Math.max(0, contentH - WEEKLY_LAYOUT.draftView.h);
  }

  onDown(x, y) {
    if (this.infoOpen) { this.infoOpen = false; return; }
    if (hit(this.backRect, x, y)) return this.game.pop();
    if (hit(this.infoRect, x, y)) { this.infoOpen = true; return; }
    for (let i = 0; i < WEEKLY_LAYOUT.tabs.length; i++) {
      if (hit(WEEKLY_LAYOUT.tabs[i], x, y)) {
        if (this.tab !== i) { this.tab = i; playSfx('tap', { volume: 0.55 }); }
        return;
      }
    }
    if (this.tab === TAB_STAGES) {
      for (const tr of this.tierRects) {
        if (hit(tr.rect, x, y)) {
          if (tr.tier !== this.tier) {
            this.tier = tr.tier;
            const st = this.game.state;
            if (weeklyUnlocked(st)) ensureWeekly(st).tier = tr.tier;
            playSfx('tap', { volume: 0.55 });
          }
          return;
        }
      }
    }
    const v = this.activeView();
    if (hit(v, x, y)) {
      this.drag = {
        y, x, scrollA: this.scrollA, scrollB: this.scrollB,
        moved: false, tab: this.tab, axis: null,
      };
    }
  }

  onMove(x, y) {
    const d = this.drag;
    if (!d) return;
    const dx = x - d.x;
    const dy = d.y - y;
    if (!d.axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      d.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
    }
    if (d.axis !== 'y') return;
    if (Math.abs(dy) > 5) d.moved = true;
    const max = this.tab === TAB_STAGES ? 0 : this.maxScroll();
    if (this.tab === TAB_STAGES) this.scrollA = 0;
    else this.scrollB = Math.max(0, Math.min(max, d.scrollB + dy));
  }

  onUp(x, y) {
    const d = this.drag;
    this.drag = null;
    if (d && d.moved) return;
    const g = this.game;
    const st = g.state;

    if (this.tab === TAB_STAGES) {
      for (const c of this.stageCards) {
        if (!hit(c.rect, x, y)) continue;
        this.tapStage(c);
        return;
      }
      return;
    }
    for (const c of this.shopCells) {
      if (!hit(c.rect, x, y)) continue;
      this.tapBuy(c.troop);
      return;
    }
    for (const c of this.rosterCells) {
      if (hit(c.up, x, y)) return this.tapUpgrade(c.uid);
      if (hit(c.sell, x, y)) return this.tapSell(c.uid);
    }
    void st;
  }

  tapStage(c) {
    const g = this.game;
    const st = g.state;
    if (!weeklyUnlocked(st)) {
      playSfx('error', { volume: 0.7 });
      g.toast(`主线通关 ${CONFIG.weekly.unlockLevel} 关后解锁（还差 ${CONFIG.weekly.unlockLevel - (st.maxCleared || 0)} 关）`);
      return;
    }
    if (!c.tierUnlocked) {
      playSfx('error', { volume: 0.7 });
      g.toast(`先通完第 ${c.tier - 1} 档全部 10 关`);
      return;
    }
    if (!c.unlocked) {
      playSfx('error', { volume: 0.7 });
      g.toast(`先通关本档第 ${c.stage - 1} 关`);
      return;
    }
    const s = ensureWeekly(st);
    if (c.cleared) {
      // 已首通的关卡：点击直接扫荡（每日 6 次、60% 铜钱、无宝箱）
      const r = weeklySweep(st, c.tier, c.stage);
      if (r.ok) {
        g.save();
        playSfx('buy');
        g.toast(`扫荡成功：铜钱 +${r.coins}（今日 ${r.wins}/${CONFIG.weekly.sweepDailyLimit} 次）`);
      } else {
        playSfx('error', { volume: 0.7 });
        g.toast(r.reason === 'limit'
          ? `今日扫荡已用完（${CONFIG.weekly.sweepDailyLimit} 次）`
          : '扫荡失败：该关还未首通');
      }
      return;
    }
    if (!s.roster.length) {
      playSfx('error', { volume: 0.7 });
      g.toast('还没有兵牌：先去「积分选兵」买兵');
      this.tab = TAB_DRAFT;
      return;
    }
    playSfx('tap', { volume: 0.55 });
    g.push(new DeployScreen(g, {
      mode: 'battle',
      level: engineStageFor('weekly', c.tier),
      weekly: { tier: c.tier, stage: c.stage },
      def: weeklyLevelDef(st, c.tier, c.stage),
    }));
  }

  tapBuy(troopId) {
    const g = this.game;
    const r = buyWeeklyTroop(g.state, troopId);
    if (r.ok) {
      g.save();
      playSfx('buy');
      g.toast(`购入 Lv1 ${unitName(troopId, 1)}：积分 -${r.cost}`);
    } else {
      playSfx('error', { volume: 0.7 });
      g.toast(this.failText(r));
    }
  }

  tapUpgrade(uid) {
    const g = this.game;
    const r = upgradeWeeklyTroop(g.state, uid);
    if (r.ok) {
      g.save();
      playSfx('buy');
      g.toast(`升到 Lv${r.level}：积分 -${r.cost}`);
    } else {
      playSfx('error', { volume: 0.7 });
      g.toast(this.failText(r));
    }
  }

  tapSell(uid) {
    const g = this.game;
    const r = removeWeeklyTroop(g.state, uid);
    if (r.ok) {
      g.save();
      playSfx('tap', { volume: 0.55 });
      g.toast(`卖出成功：积分 +${r.refund}`);
    } else {
      playSfx('error', { volume: 0.7 });
      g.toast(this.failText(r));
    }
  }

  failText(r) {
    const st = this.game.state;
    const s = ensureWeekly(st);
    switch (r.reason) {
      case 'points': return `积分不足（需 ${r.cost}，剩 ${s.points}）`;
      case 'full': return `兵牌已满（${CONFIG.formation.cols * CONFIG.formation.rows} 格上限）`;
      case 'max': return '这张兵牌已满级（Lv10）';
      case 'locked': return `主线通关 ${CONFIG.weekly.unlockLevel} 关后解锁周常挑战`;
      default: return '操作失败';
    }
  }

  /* ---------- 绘制 ---------- */
  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const unlockedAll = weeklyUnlocked(st);
    const s = unlockedAll ? ensureWeekly(st) : null;

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '周 常 挑 战', W / 2 + 20, 72, { size: 38, weight: '700', align: 'center', color: THEME.gold });
    infoBadge(ctx, this.infoRect.x + 32, this.infoRect.y + 32, 24);

    // 状态行：积分 / 进度 / 今日扫荡 / 本周周次（1.2.8：总额 = 开局 + 各档大赏）
    text(ctx, `积分 ${s ? s.points : weeklyStartPoints()} / ${weeklyTotalPoints()}`, 30, 152, {
      size: 24, weight: '600', color: THEME.gold,
    });
    text(ctx, `进度 ${unlockedAll ? weeklyClearedTotal(st) : 0} / ${CONFIG.weekly.tiers * CONFIG.weekly.stagesPerTier} 关`,
      W / 2, 152, { size: 22, align: 'center', color: THEME.text, maxWidth: 240 });
    text(ctx, `扫荡 ${s ? s.sweepCount : 0}/${CONFIG.weekly.sweepDailyLimit} · ${weekKey()}`,
      W - 30, 152, { size: 20, align: 'right', color: THEME.textDim, maxWidth: 300 });

    // 两个页签
    const tabs = [['挑 战 关 卡', '首通 / 扫荡拿奖励'], ['积 分 选 兵', '买兵 · 升级 · 卖出']];
    WEEKLY_LAYOUT.tabs.forEach((r, i) => {
      button(ctx, r, tabs[i][0], {
        size: 28, sub: tabs[i][1], subSize: 16, active: this.tab === i,
      });
    });

    if (!unlockedAll) {
      text(ctx, `主线还差 ${CONFIG.weekly.unlockLevel - (st.maxCleared || 0)} 关解锁周常挑战`, 375, 700, {
        size: 26, align: 'center', color: THEME.red,
      });
      if (this.infoOpen) this.drawInfo(ctx, W);
      return;
    }

    if (this.tab === TAB_STAGES) this.drawStages(ctx, W, s);
    else this.drawDraft(ctx, W, s);

    if (this.infoOpen) this.drawInfo(ctx, W);
  }

  drawStages(ctx, W, s) {
    const g = this.game;
    const st = g.state;
    const V = WEEKLY_LAYOUT.stageView;
    const T = WEEKLY_LAYOUT.tier;

    // 档位切换
    this.tierRects = [];
    for (let t = 1; t <= CONFIG.weekly.tiers; t++) {
      const rect = { x: T.x0 + (t - 1) * (T.w + T.gap), y: T.y, w: T.w, h: T.h };
      const locked = !weeklyTierUnlocked(st, t);
      const done = weeklyTierClearedCount(st, t);
      this.tierRects.push({ rect, tier: t });
      button(ctx, rect, `${weeklyTierName(t)} 档`, {
        size: 25,
        sub: `${done}/${CONFIG.weekly.stagesPerTier}${locked ? ' · 锁' : ''}`,
        subSize: 15,
        active: this.tier === t,
        disabled: locked,
      });
    }

    // 10 个关卡格
    this.stageCards = [];
    ctx.save();
    ctx.beginPath();
    ctx.rect(V.x, V.y, V.w, V.h);
    ctx.clip();
    const tier = this.tier;
    for (let i = 0; i < CONFIG.weekly.stagesPerTier; i++) {
      const stage = i + 1;
      const rect = stageRect(i, 0);
      if (rect.y + rect.h < V.y || rect.y > V.y + V.h) continue;
      const tierUnlocked = weeklyTierUnlocked(st, tier);
      const unlocked = weeklyStageUnlocked(st, tier, stage);
      const bit = s.cleared[tier - 1] & (1 << (stage - 1));
      const cleared = !!bit;
      const def = weeklyLevelDef(st, tier, stage);
      this.stageCards.push({ rect, tier, stage, unlocked, tierUnlocked, cleared, def });

      const current = unlocked && !cleared;
      panel(ctx, rect.x, rect.y, rect.w, rect.h, {
        fill: cleared ? 'rgba(58,46,30,0.82)' : unlocked ? '#2b2217' : '#17130e',
        stroke: cleared ? THEME.gold : current ? THEME.green : THEME.line,
        r: 14, lw: current ? 2.5 : 1.5,
      });
      text(ctx, `第 ${stage} 关`, rect.x + 12, rect.y + 26, {
        size: 18, weight: '600', color: cleared ? THEME.gold : unlocked ? THEME.text : THEME.textWeak,
      });
      text(ctx, cleared ? '已通关' : current ? '可出战' : '未解锁', rect.x + rect.w - 12, rect.y + 26, {
        size: 14, align: 'right', color: cleared ? THEME.gold : current ? THEME.green : THEME.textWeak,
      });

      if (unlocked) {
        text(ctx, `敌 ${formatPower(def.targetPower)}`, rect.x + rect.w / 2, rect.y + 74, {
          size: 24, weight: '700', align: 'center',
          color: cleared ? THEME.gold : THEME.text, maxWidth: rect.w - 12,
        });
        text(ctx, `你的上限 ${formatPower(def.draftCap)}`, rect.x + rect.w / 2, rect.y + 104, {
          size: 14, align: 'center', color: THEME.textDim, maxWidth: rect.w - 12,
        });
        const chest = weeklyStageChest(tier, stage);
        const reward = `首通 ${weeklyStageCoins(tier)} 钱${chest ? ` · ${chestName(chest)}` : ''}`;
        text(ctx, reward, rect.x + rect.w / 2, rect.y + 130, {
          size: 13, align: 'center', color: cleared ? THEME.textWeak : THEME.gold, maxWidth: rect.w - 8,
        });
        if (cleared) {
          const left = CONFIG.weekly.sweepDailyLimit - s.sweepCount;
          text(ctx, left > 0 ? `点击扫荡 · 剩 ${left}` : '扫荡次数用完', rect.x + rect.w / 2, rect.y + 152, {
            size: 16, align: 'center', color: left > 0 ? THEME.gold : THEME.textWeak, maxWidth: rect.w - 8,
          });
        } else {
          text(ctx, '出 战', rect.x + rect.w / 2, rect.y + 152, {
            size: 20, weight: '600', align: 'center', color: THEME.green,
          });
        }
      } else {
        text(ctx, !tierUnlocked ? `需通完第 ${tier - 1} 档` : `需通关第 ${stage - 1} 关`,
          rect.x + rect.w / 2, rect.y + 96, {
            size: 15, align: 'center', color: THEME.textWeak, maxWidth: rect.w - 8,
          });
      }
    }

    // 档位奖励 + 难度说明两块面板（3 行大卡后下移：322 + 3×176 + 6 = 856）
    const y = WEEKLY_LAYOUT.stageCard.y0 + 3 * (STAGE_CARD.h + STAGE_CARD.gapY) + 6;
    const w = V.w - 12;
    const x = V.x + 6;
    const anchor = CONFIG.weekly.tierAnchors[tier - 1];
    const d1 = weeklyLevelDef(st, tier, 1);
    const d10 = weeklyLevelDef(st, tier, CONFIG.weekly.stagesPerTier);
    panel(ctx, x, y, w, 236, { fill: 'rgba(20,27,37,0.9)', stroke: THEME.line, r: 14, lw: 1.5 });
    text(ctx, '本 档 情 报', x + 18, y + 32, { size: 20, weight: '600', color: THEME.gold });
    const lines = [
      `敌方战力 ${formatPower(d1.targetPower)} → ${formatPower(d10.targetPower)}（对标主线 ${anchor} 关 · 档位倍率 ×${CONFIG.weekly.tierMult[tier - 1]}）`,
      `首通铜钱 ${weeklyStageCoins(tier)} / 关；第 5 关发${chestName(weeklyStageChest(tier, 5))}，第 10 关发${chestName(weeklyStageChest(tier, 10))} + 档位大赏 ${weeklyTierBonusCoins(tier)} 铜钱`,
      tier >= 3
        ? '敌军强度已越过纯兵上限：英雄、器械、兵书的练度就是通关钥匙'
        : `开局只发 ${weeklyStartPoints()} 分（传奇只够零星几张）：每通一档大关 +${CONFIG.weekly.tierGrants.join('/')} 分`,
      tier >= 4 ? '本档敌方出器械：记得带上你最好的攻城器械与站位' : '本档敌方无器械、无英雄，正面拼配置',
      `扫荡：本周已首通的关每天 ${CONFIG.weekly.sweepDailyLimit} 次，得首通铜钱的 ${Math.round(CONFIG.weekly.sweepRatio * 100)}%（不给宝箱）`,
    ];
    let ty = y + 64;
    for (const line of lines) {
      text(ctx, `· ${line}`, x + 18, ty, { size: 17, color: THEME.text, maxWidth: w - 36 });
      ty += 36;
    }
    ctx.restore();
  }

  drawDraft(ctx, W, s) {
    const st = this.game.state;
    const V = WEEKLY_LAYOUT.draftView;
    const h = CELL.cardH + CELL.stripH;
    const troops = weeklyAvailableTroops(st);
    // 1.2.8 · 理论上限按「当前档开战预算」算，与关卡格的「你的上限」同口径
    const cap = draftCapPower(st, weeklyBudgetForTier(s.tier));
    const deployed = new Set(s.form.filter((v) => typeof v === 'string' && !v.startsWith('h:')));

    this.shopCells = [];
    this.rosterCells = [];
    this.scrollB = Math.max(0, Math.min(this.maxScroll(), this.scrollB));

    ctx.save();
    ctx.beginPath();
    ctx.rect(V.x, V.y, V.w, V.h);
    ctx.clip();
    const sy = this.scrollB;

    let y = V.y + 34 - sy;
    text(ctx, `已购 ${s.roster.length}/${CONFIG.formation.cols * CONFIG.formation.rows} · 剩余积分 ${s.points} · 本档理论上限 ${formatPower(cap)}`,
      V.x + 8, y, { size: 20, weight: '600', color: THEME.gold, maxWidth: V.w - 16 });

    // 招兵区
    y += 30;
    text(ctx, '招 兵 — 点兵牌用积分买 Lv1（等级越高越贵）', V.x + 8, y, {
      size: 17, color: THEME.textDim, maxWidth: V.w - 16,
    });
    y += 16;
    const shopY = y;
    troops.forEach((troopId, i) => {
      const r = cellRect(i, shopY);
      if (r.y + r.h < V.y || r.y > V.y + V.h) return;
      this.shopCells.push({ rect: r, troop: troopId });
      drawUnitCard(ctx, { troop: troopId, level: 1 }, { x: r.x, y: r.y, w: r.w, h: CELL.cardH });
      const cost = weeklyTroopCost(troopId, 1);
      const afford = s.points >= cost;
      panel(ctx, r.x, r.y + CELL.cardH + 3, r.w, CELL.stripH - 3, {
        fill: afford ? 'rgba(24,40,30,0.92)' : 'rgba(34,26,26,0.92)',
        stroke: afford ? THEME.green : '#7a4b4b', r: 8, lw: 1.4,
      });
      text(ctx, `积分 ${cost}`, r.x + 10, r.y + CELL.cardH + 23, {
        size: 15, weight: '600', color: afford ? THEME.green : '#c98a8a',
      });
      text(ctx, `${formatPower(troopPower(troopId, 1))}`, r.x + r.w - 10, r.y + CELL.cardH + 23, {
        size: 13, align: 'right', color: THEME.textDim,
      });
    });
    y = shopY + Math.ceil(troops.length / 4) * (h + CELL.gapY) + 16;

    // 我的兵牌
    text(ctx, '我 的 兵 牌 — 「升」提等级（补差价）·「退」卖出全额返还', V.x + 8, y, {
      size: 17, color: THEME.textDim, maxWidth: V.w - 16,
    });
    y += 16;
    const rosterY = y;
    if (!s.roster.length) {
      text(ctx, '还没有兵牌 —— 上面点兵牌购买，买完再出战布阵', V.x + 8, rosterY + 34, {
        size: 18, color: THEME.textWeak,
      });
    }
    s.roster.forEach((entry, i) => {
      const r = cellRect(i, rosterY);
      if (r.y + r.h < V.y || r.y > V.y + V.h) return;
      const upRect = { x: r.x, y: r.y + CELL.cardH + 3, w: 79, h: CELL.stripH - 3 };
      const sellRect = { x: r.x + 85, y: r.y + CELL.cardH + 3, w: 79, h: CELL.stripH - 3 };
      this.rosterCells.push({ uid: entry.id, up: upRect, sell: sellRect });
      drawUnitCard(ctx, { troop: entry.troop, level: entry.level }, {
        x: r.x, y: r.y, w: r.w, h: CELL.cardH,
      }, { onGrid: deployed.has(entry.id) });
      const upCost = weeklyTroopUpgradeCost(entry.troop, entry.level);
      const maxed = entry.level >= CONFIG.merge.maxLevel;
      const canUp = !maxed && s.points >= upCost;
      panel(ctx, upRect.x, upRect.y, upRect.w, upRect.h, {
        fill: canUp ? 'rgba(24,40,30,0.92)' : 'rgba(28,32,40,0.92)',
        stroke: canUp ? THEME.green : '#3a4452', r: 7, lw: 1.3,
      });
      text(ctx, maxed ? '满级' : `升 ${upCost}`, upRect.x + upRect.w / 2, upRect.y + 20, {
        size: 15, weight: '600', align: 'center',
        color: maxed ? THEME.textWeak : canUp ? THEME.green : '#9a8a72',
      });
      panel(ctx, sellRect.x, sellRect.y, sellRect.w, sellRect.h, {
        fill: 'rgba(34,30,24,0.92)', stroke: '#8a7757', r: 7, lw: 1.3,
      });
      text(ctx, `退 ${weeklyTroopCost(entry.troop, entry.level)}`, sellRect.x + sellRect.w / 2, sellRect.y + 20, {
        size: 15, weight: '600', align: 'center', color: '#d9b978',
      });
    });
    ctx.restore();

    // 滚动条
    const max = this.maxScroll();
    if (max > 0) {
      const x = V.x + V.w - 8;
      panel(ctx, x, V.y + 2, 4, V.h - 4, { fill: 'rgba(255,255,255,0.07)', stroke: null, r: 2, lw: 0 });
      const ratio = V.h / (V.h + max);
      const bh = Math.max(26, (V.h - 4) * ratio);
      const by = V.y + 2 + (V.h - 4 - bh) * (this.scrollB / max);
      panel(ctx, x - 1, by, 6, bh, { fill: 'rgba(213,153,71,0.75)', stroke: null, r: 3, lw: 0 });
    }

    text(ctx, '积分每周一 0 点归零重置 —— 买好的兵只在本周有效', 375, 1236, {
      size: 19, align: 'center', color: THEME.textWeak,
    });
  }

  drawInfo(ctx, W) {
    const cfg = CONFIG.weekly;
    infoModal(ctx, W, this.game.H, '周 常 挑 战 说 明', [
      `主线 ${cfg.unlockLevel} 关后开放；每周一北京时间 0 点重置，积分、兵牌与进度全部归零。`,
      `积分按档发放：开局只发 ${cfg.startPoints} 分（传奇只够零星几张），每通完一个大关 +${cfg.tierGrants.join('/')} 分（共 ${weeklyTotalPoints()} 分）。`,
      `用积分买兵（普通 ${cfg.costBase.common} 分起，升一级 ×${cfg.costGrowth}，越高等越贵），卖出全额退还；布阵上限 25 格。`,
      `5 个档位 × 10 小关顺序解锁，通完上一档才开下一档；敌方战力 = 该档开战预算的纯兵上限 × 档位倍率（×${cfg.tierMult.join(' / ')}），难度逐档飙升。`,
      '第一档靠选兵就能过；第二档要硬啃配置；第三档起必须英雄 + 器械；第四档起要兵书；第五档全养成都考。',
      '你已解锁的英雄、器械、兵书在本模式全部生效（第 4 档起敌方也出器械），练度越高越稳。',
      `首通铜钱 500 × 档位 / 关，第 5 关白银宝箱、第 10 关高品箱 + 档位大赏；已通关关卡每天扫荡 ${cfg.sweepDailyLimit} 次，得 ${Math.round(cfg.sweepRatio * 100)}% 铜钱、无宝箱。`,
    ]);
  }
}
