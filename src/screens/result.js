import { THEME, text, panel, button, coinBadge, bar, hit, roundRectPath, carvedFrame } from '../render/draw.js';
import { drawChest } from '../render/chest.js';
import { CONFIG } from '../data/config.js';
import { levelTotal, rosterSlots, autoBattleUnlocked } from '../core/levels.js';
import { chestType, openChest } from '../core/chests.js';
import { cityOfLevel, chapterOfLevel, milestoneChestsAt } from '../core/chapters.js';
import { noteChestOpened } from '../core/daily.js';
import { unitName, spriteTierFor, rarityOf, rarityInfo } from '../core/units.js';
import { drawFrame, sheetFor } from '../render/sprites.js';
import { drawHeroFigure } from '../render/heroArt.js';
import { drawEngineFigure } from '../render/engineArt.js';
import { engineName } from '../core/siege.js';
import { drawGameTitle } from '../render/title.js';
import { nextUnlockInfo } from '../core/nextUnlock.js';
import { DeployScreen } from './deploy.js';
import { LevelSelectScreen } from './levels.js';
import { ChestScreen } from './chests.js';
import { BattleScreen } from './battle.js';
import { formatPower } from '../core/power.js';
import { playSfx } from '../core/audio.js';
import { heroById } from '../data/heroes.js';
import { claimLevelHeroReward } from '../core/heroes.js';
import { shareRewardFor, sharesLeft, claimShareReward } from '../core/shareReward.js';

// 自动战斗：胜利结算停 3 秒后自动进入下一关（失败不自动重来）
const AUTO_DELAY = 3.0;

export class ResultScreen {
  constructor(game, data) {
    this.game = game;
    this.d = data;
    this.t = 0;
    // 板块 3：结算页使用专属战报背景插画（bg_result.jpg），不再fallback到首页底图
    this.artBg = 'result';
    this.opened = null;                       // 本次结算里刚开出来的兵
    this.sharing = false;                     // 分享进行中（等待平台返回是否成功）
    this.rewardPopup = null;                  // 分享奖励弹窗：{ chest, name, count }
    // 胜利页要把「本场最佳」和「下一个解锁」都塞进统计区下方，按钮整体下移；失败页保持原布局
    const win = data.win === true;
    this.primary = win ? { x: 175, y: 976, w: 400, h: 96 } : { x: 175, y: 850, w: 400, h: 112 };
    // 分享得宝箱（亮绿大按钮，带回弹/抖动动效）：胜利页在主按钮下方，战败页占原广告按钮位
    this.shareRect = win ? { x: 175, y: 1084, w: 400, h: 96 } : { x: 175, y: 976, w: 400, h: 96 };
    // 胜利页次按钮（返回关卡进度）；战败页原广告按钮位已并入分享按钮
    this.secondary = win ? { x: 175, y: 1188, w: 400, h: 76 } : null;
    this.tertiary = win ? { x: 275, y: 1272, w: 200, h: 52 } : { x: 275, y: 1108, w: 200, h: 56 };
    this.chestRect = { x: 542, y: 290, w: 128, h: 50 };
    // 关卡赠将（250 关关平）：首通结算页弹一次领取卡，领完置 claimed 防重复
    this.heroRewardClaimed = null;
    this.heroClaimRect = { x: 195, y: 660, w: 360, h: 82 };
    this.autoTextY = win ? 962 : 838;
    this.bestRect = { x: 70, y: 372, w: 610, h: 508 };
    // 「下一个解锁」进度卡：胜利页在统计区下方，失败页在克制面板与按钮之间（不挤压克制圈 / 分享键）
    this.unlockRect = win ? { x: 70, y: 888, w: 610, h: 60 } : { x: 70, y: 768, w: 610, h: 60 };
    this.best = this.computeBest(data.stats);
    // 有解锁教学时先暂停自动战斗；教学结束后由玩家手动继续
    this.pauseAuto = data.pauseAuto === true;
    // 结算继续播主 BGM（尽量不打断），胜利 / 失败音效直接叠在上面
    playSfx(data.win === true ? 'victory' : 'defeat', { volume: 0.75 });
    // 自动战斗：只在「胜利 + 还有下一关 + 玩家开着自动战斗 + 已达解锁关」时倒计时
    this.autoNext = !this.pauseAuto && data.win && game.state.autoBattle && autoBattleUnlocked(game.state)
      && data.levelN < levelTotal()
      ? data.levelN + 1
      : null;
    this.autoT = this.autoNext ? AUTO_DELAY : null;
  }

  update(dt) {
    this.t += dt;
    if (this.autoT === null || this.autoNext === null) return;
    this.autoT -= dt;
    if (this.autoT <= 0) this.jumpNext();
  }

  jumpNext() {
    if (this.autoNext === null) return;
    const next = this.autoNext;
    this.autoNext = null;
    this.autoT = null;
    this.game.go(new BattleScreen(this.game, next));
  }

  stopAuto() {
    const g = this.game;
    g.state.autoBattle = false;
    g.save();
    this.autoT = null;
    this.autoNext = null;
    g.toast('已停止自动战斗');
  }

  // 输出扛伤 Tab：综合 / 我方输出 / 敌方输出 / 我方承伤 / 敌方承伤
  get rankTab() { return this._rankTab ?? 'all'; }
  set rankTab(v) { this._rankTab = v; }

  // 本局最佳输出 / 最佳承伤（两侧各取第一名，并按本方总量算百分比）
  computeBest(stats) {
    const list = Array.isArray(stats) ? stats : [];
    const side = (key) => {
      const rows = list.filter((s) => s.side === key);
      const dealt = rows.reduce((n, s) => n + s.dealt, 0);
      const taken = rows.reduce((n, s) => n + s.taken, 0);
      const topDealt = rows.length ? [...rows].sort((a, b) => b.dealt - a.dealt)[0] : null;
      const topTaken = rows.length ? [...rows].sort((a, b) => b.taken - a.taken)[0] : null;
      return {
        dealt, taken, topDealt, topTaken,
        pctDealt: topDealt && dealt > 0 ? topDealt.dealt / dealt : 0,
        pctTaken: topTaken && taken > 0 ? topTaken.taken / taken : 0,
        kills: topDealt ? topDealt.kills : 0,
      };
    };
    return { player: side('player'), enemy: side('enemy') };
  }

  // 还能开的第一个宝箱（列表里按顺序找）
  nextChest() {
    return this.d.chests.find((c) => c.count > 0) || null;
  }

  // 开箱：兵营满则不消耗、不添加，只提示
  openChestNow() {
    const g = this.game;
    const d = this.d;
    const entry = this.nextChest();
    if (!entry) {
      g.toast('本次的宝箱都开完了');
      return;
    }
    const r = openChest(g.state, entry.id);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      if (r.reason === 'full') {
        g.toast('兵营已满：去兵营合成腾出格子，再回来开箱');
      } else {
        g.toast('宝箱已经开完了');
      }
      return;
    }
    noteChestOpened(g.state);
    this.opened = r.unit;
    entry.count = r.remaining;
    playSfx('chest', { volume: 0.8 });
    g.save();
    g.toast(`开箱获得 ${unitName(r.unit.troop, r.unit.level)} Lv${r.unit.level}`);
    if (g.showcaseUnit) g.showcaseUnit(r.unit);
  }

  // 领取 250 关首通赠将（关平）：领过之后按钮消失，二次点击也不会重复发放
  claimHeroReward() {
    const g = this.game;
    if (!this.d.heroReward) return;
    const r = claimLevelHeroReward(g.state, this.d.levelN);
    if (!r.ok) { this.heroRewardClaimed = this.d.heroReward; return; }
    this.heroRewardClaimed = r.hero;
    playSfx('reward');
    g.save();
    if (r.duplicate) {
      const extra = r.tickets ? ` + ${r.tickets} 张招募券` : '';
      g.toast(`已拥有该英雄，折算 ${r.coins} 铜钱${extra}`);
      return;
    }
    g.toast(`领取成功：${heroById(r.hero).tier === 'legendary' ? '传奇' : '史诗'}英雄「${heroById(r.hero).name}」加入上阵`);
    if (g.showcaseHero) g.showcaseHero(r.hero, r.level);
  }

  tap(x, y) {
    const g = this.game;
    const d = this.d;
    const total = levelTotal();
    // 赠将领取卡是模态：没领之前先吃掉点击，避免误触下面的按钮
    if (d.heroReward && !this.heroRewardClaimed) {
      if (hit(this.heroClaimRect, x, y)) this.claimHeroReward();
      return;
    }
    // 分享奖励弹窗是轻量模态：轻触任意处关闭
    if (this.rewardPopup) {
      this.rewardPopup = null;
      return;
    }

    // 输出扛伤 Top5 Tab 点击
    if (this.rankTabs) {
      for (const t of this.rankTabs) {
        if (hit(t.rect, x, y)) { this.rankTab = t.key; return; }
      }
    }

    const entry = this.nextChest();
    if (d.win && entry && !this.opened && hit(this.chestRect, x, y)) {
      this.openChestNow();
      return;
    }
    if (hit(this.primary, x, y)) {
      if (d.win) {
        if (this.autoNext !== null) this.jumpNext();
        else if (d.levelN < total) g.go(new DeployScreen(g, { mode: 'battle', level: d.levelN + 1 }));
        else g.go(new LevelSelectScreen(g));
      } else {
        // 失败 = 这一关还没通过，可以重新挑战
        g.go(new DeployScreen(g, { mode: 'battle', level: d.levelN }));
      }
      return;
    }
    if (this.secondary && hit(this.secondary, x, y)) {
      g.go(new LevelSelectScreen(g));
      return;
    }
    if (hit(this.tertiary, x, y)) {
      if (this.autoT !== null) {
        this.stopAuto();
      } else if (d.win) {
        g.go(new ChestScreen(g));
      } else {
        g.go(new LevelSelectScreen(g));
      }
      return;
    }
    if (hit(this.shareRect, x, y)) return this.shareNow();
  }

  // 分享得宝箱：每天限 2 次，前 200 关黄金箱 / 200 关起史诗箱。
  // 微信已无分享 success 回调 → 由平台层用「切到会话再返回」判断是否真的分享成功；
  // 只有确认分享成功才发奖，并弹一个轻触即关的奖励卡让玩家看到宝箱。
  shareNow() {
    const g = this.game;
    if (this.sharing) return undefined;
    if (sharesLeft(g.state) <= 0) {
      playSfx('error', { volume: 0.7 });
      g.toast('今日分享奖励已领完（每天 2 次，明天再来）');
      return undefined;
    }
    if (!g.platform || typeof g.platform.share !== 'function') {
      g.toast('请在微信小游戏里分享');
      return undefined;
    }
    const title = `我已在《汉末行伍征战记》通关第 ${Math.max(1, (g.state.maxCleared || 0) + 1)} 关，来布阵过关！`;
    let p = null;
    try {
      p = g.platform.share({ title });
    } catch (e) {
      p = null;
    }
    // 平台不支持完成判定（旧版 / 非微信）：退回「点开面板即发奖」
    if (!p || typeof p.then !== 'function') {
      this.grantShareReward();
      return undefined;
    }
    this.sharing = true;
    g.toast('分享中…回到游戏后自动结算');
    return p
      .then((ok) => {
        this.sharing = false;
        if (!ok) {
          playSfx('error', { volume: 0.7 });
          g.toast('分享未完成，未获得宝箱');
          return;
        }
        this.grantShareReward();
      })
      .catch(() => {
        this.sharing = false;
        g.toast('分享未完成，未获得宝箱');
      });
  }

  // 确认分享成功后发奖：入宝箱仓库 + 存档 + 弹出「获得奖励」卡
  grantShareReward() {
    const g = this.game;
    const r = claimShareReward(g.state);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      g.toast('今日分享奖励已领完（每天 2 次，明天再来）');
      return;
    }
    g.save();
    playSfx('reward');
    const chestName = chestType(r.chest) ? chestType(r.chest).name : '宝箱';
    this.rewardPopup = { chest: r.chest, name: chestName, count: 1 };
    g.toast(`分享成功：${chestName} ×1 已入宝箱仓库`);
  }

  // 「获得奖励」轻量弹窗：宝箱图标 + 名称，轻触任意处关闭
  drawRewardPopup(ctx) {
    const g = this.game;
    const W = g.W;
    ctx.save();
    ctx.fillStyle = 'rgba(13,10,7,0.76)';
    ctx.fillRect(0, 0, W, g.H);
    ctx.restore();
    const px = 135;
    const py = 452;
    const pw = 480;
    const ph = 330;
    panel(ctx, px, py, pw, ph, { fill: 'rgba(34,28,18,0.98)', stroke: THEME.gold, r: 24, lw: 3 });
    carvedFrame(ctx, px, py, pw, ph, {
      color: THEME.goldLit, alpha: 0.72, corner: 40, inset: 6, lw: 2, r: 24, glow: 4,
    });
    ctx.save();
    roundRectPath(ctx, px + 8, py + 8, pw - 16, ph - 16, 18);
    ctx.strokeStyle = 'rgba(244,212,136,0.30)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    text(ctx, '获 得 奖 励', W / 2, py + 46, { size: 24, align: 'center', color: THEME.gold });
    const type = chestType(this.rewardPopup.chest);
    const kind = this.rewardPopup.chest === 'gold' ? 'gold'
      : this.rewardPopup.chest === 'wood' ? 'wood' : '';
    drawChest(ctx, W / 2, py + 152, 1.35, { color: (type && type.color) || '#c8a86a', kind });
    text(ctx, `${this.rewardPopup.name} ×${this.rewardPopup.count}`, W / 2, py + 258, {
      size: 34, weight: '700', align: 'center', serif: true,
      color: (type && type.color) || THEME.gold,
    });
    text(ctx, '轻触屏幕任意处关闭', W / 2, py + 296, {
      size: 18, align: 'center', color: THEME.textDim,
    });
  }

  // 分享按钮（win/lose 共用）：亮绿大按钮 + 动效——周期回弹（1.00→1.04）与上下轻抖（±3px）；
  // 命中区始终用原始 shareRect，动画只影响绘制，避免点不中
  drawShareButton(ctx) {
    const g = this.game;
    const r = this.shareRect;
    const on = sharesLeft(g.state) > 0 && !this.sharing;
    const chest = shareRewardFor(g.state.maxCleared);
    const chestName = chestType(chest) ? chestType(chest).name : '宝箱';
    const pulse = on ? 1 + 0.04 * (0.5 + 0.5 * Math.sin(this.t * 3.0)) : 1;
    const dy = on ? Math.sin(this.t * 6.28) * 3 : 0;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    ctx.save();
    ctx.translate(cx, cy + dy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);
    const label = this.sharing ? '分 享 中…'
      : sharesLeft(g.state) > 0 ? `分享得${chestName}` : '今日已领完';
    // S2.1：微信绿改为参考图 13 的「深褐实底 + 鎏金描边 + 金字」
    button(ctx, r, label, {
      size: 32, fill: on ? THEME.panel2 : THEME.panel,
      stroke: on ? THEME.gold : THEME.line,
      textColor: on ? THEME.goldLit : THEME.textWeak, disabled: !on,
    });
    ctx.restore();
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const d = this.d;
    const W = g.W;
    const total = levelTotal();
    const city = cityOfLevel(d.levelN);
    const chapter = chapterOfLevel(d.levelN);

    coinBadge(ctx, 700, 76, st.coins, { size: 24, align: 'right' });
    // 游戏名草书标题：结算页顶部的小号品牌位（不参与胜负文案排版）
    drawGameTitle(ctx, W / 2, 46, 44, { fallbackSize: 26 });

    // 胜利页顶部整体上移，给「下一个解锁」进度卡腾位置；失败页保持原样
    const titleY = d.win ? 176 : 190;
    const subY = d.win ? 226 : 244;
    const chapY = d.win ? 254 : 274;
    text(ctx, d.win ? '胜 利' : '战斗失败', W / 2, titleY, {
      size: 66, weight: '700', align: 'center', serif: true,
      // 胜利=鎏金；失败=残赤点睛（玄铁冷调由底部面板承载，避免大红与喜庆语义冲突）
      color: d.win ? THEME.gold : THEME.blood,
      glow: d.win ? 18 : 0,
    });
    text(ctx, `第 ${d.levelN} 关${d.win ? ' 通关' : ''}${city ? ` · ${city.name}` : ''}`, W / 2, subY, {
      size: 26, align: 'center', color: THEME.textDim,
    });
    if (chapter) {
      text(ctx, chapter.name, W / 2, chapY, { size: 19, align: 'center', color: THEME.textWeak });
    }

    if (d.win) {
      // 铜钱 + 首通奖励合并成一条窄条，把空间全留给战斗统计
      this.drawRewardStrip(ctx);
      this.drawRankings(ctx);
    } else {
      this.drawDefeatPanel(ctx);
    }
    // 胜利 / 失败都展示「下一个解锁」；全部解锁后整块隐藏
    const unlockInfo = nextUnlockInfo(st, { levelN: d.levelN, win: d.win === true });
    this.drawNextUnlock(ctx, unlockInfo);

    // 自动战斗状态：胜利倒计时 / 失败已停止 / 已通关
    // 有进度卡时这里让位（胜利倒计时已在主按钮文案里，失败页保留按钮布局）
    const autoOn = st.autoBattle === true && autoBattleUnlocked(st);
    if (unlockInfo) {
      // 进度卡占用了这行空间，不再叠文字
    } else if (this.autoT !== null && this.autoNext !== null) {
      text(ctx, `自动战斗中 · ${Math.max(1, Math.ceil(this.autoT))} 秒后自动进入第 ${this.autoNext} 关`, W / 2, this.autoTextY, {
        size: 22, align: 'center', color: THEME.gold,
      });
    } else if (autoOn && !d.win) {
      text(ctx, '自动战斗已停止（本关失败，不会自动重来）', W / 2, this.autoTextY, {
        size: 22, align: 'center', color: THEME.red,
      });
    } else if (autoOn && d.win && d.levelN >= total) {
      text(ctx, '自动战斗：已通关全部关卡', W / 2, this.autoTextY, {
        size: 22, align: 'center', color: THEME.gold,
      });
    }

    if (d.win) {
      const label = d.levelN < total
        ? (this.autoNext !== null
          ? `进入第 ${this.autoNext} 关（${Math.max(1, Math.ceil(this.autoT))}）`
          : `继续挑战第 ${d.levelN + 1} 关`)
        : '返回关卡进度';
      button(ctx, this.primary, label, {
        size: 32, fill: '#332c1d', stroke: THEME.goldDim, textColor: THEME.gold,
      });
      button(ctx, this.secondary, '返回关卡进度', { size: 30, fill: THEME.panel2, stroke: THEME.line });
      button(ctx, this.tertiary, this.autoT !== null ? '停止自动战斗' : '去宝箱页开箱', {
        size: 22, fill: THEME.panel, stroke: THEME.line,
        textColor: this.autoT !== null ? THEME.red : THEME.textDim,
      });
    } else {
      // 失败主按钮用玄铁冷调，与胜利鎏金形成色温对立
      button(ctx, this.primary, '重新挑战', { size: 32, fill: '#332c1d', stroke: THEME.defeat, textColor: THEME.defeatLit });
      button(ctx, this.tertiary, '返回关卡进度', { size: 22, fill: THEME.panel, stroke: THEME.line });
    }
    // 分享得宝箱：亮绿大按钮 + 回弹/抖动动效，额度用尽置灰
    this.drawShareButton(ctx);
    // 分享奖励弹窗最后画：盖住结算页内容，轻触即关
    if (this.rewardPopup) this.drawRewardPopup(ctx);
    if (d.heroReward && !this.heroRewardClaimed) this.drawHeroRewardModal(ctx);
  }

  // 「下一个解锁」进度卡：一次只重点展示最近的目标，顺带列紧随其后的 1–2 个
  drawNextUnlock(ctx, info) {
    if (!info) return;
    const d = this.d;
    const r = this.unlockRect;
    const focus = info.focus;

    panel(ctx, r.x, r.y, r.w, r.h, {
      fill: info.achieved ? 'rgba(51,44,29,0.9)' : 'rgba(43,34,23,0.92)',
      stroke: info.achieved ? THEME.goldDim : THEME.line,
      r: 16, lw: info.achieved ? 2 : 1.4,
    });

    // 图标：兵种建模 / 英雄立绘 / 系统徽标，一眼看出送的是什么
    this.drawUnlockIcon(ctx, focus, r.x + 44, r.y + 31);

    const left = r.x + 76;
    const right = r.x + r.w - 18;
    const rar = focus.kind === 'troop' ? rarityInfo(focus.troop) : null;
    const titleColor = info.achieved ? THEME.gold : (rar ? rar.color : THEME.text);

    let tag;
    if (info.achieved) tag = '已解锁';
    else if (!d.win) tag = '再来一次';
    else if (focus.kind === 'troop') tag = '新兵种';
    else if (focus.kind === 'hero') tag = '新英雄';
    else if (focus.kind === 'login7') tag = '登录奖励';
    else tag = '新系统';
    text(ctx, tag, left, r.y + 21, {
      size: 11, color: info.achieved ? THEME.gold : THEME.goldDim,
    });
    text(ctx, focus.title, left + 52, r.y + 21, {
      size: 18, weight: '600', color: titleColor, maxWidth: 260,
    });

    if (info.achieved) {
      text(ctx, `已过 ${info.cleared} 关 · 已解锁`, right, r.y + 21, {
        size: 14, align: 'right', color: THEME.gold,
      });
    } else {
      text(ctx, `已过 ${info.cleared} 关 / 还需 ${info.remain} 关`, right, r.y + 21, {
        size: 14, align: 'right', color: THEME.gold,
      });
    }

    bar(ctx, left, r.y + 33, r.w - 94, 9, info.ratio, {
      fill: info.achieved ? THEME.gold : '#c9a44c', bg: '#100c08', r: 4,
    });

    const nextText = info.upcoming.length
      ? `后续：${info.upcoming.map((t) => `${t.title} · 第 ${t.level} 关`).join('　')}`
      : '全部达成';
    text(ctx, nextText, left, r.y + 52, {
      size: 11, color: THEME.textWeak, maxWidth: r.w - 94,
    });
  }

  drawUnlockIcon(ctx, target, cx, cy) {
    if (target.kind === 'troop' && target.troop) {
      drawFrame(ctx, sheetFor(target.troop, 0), 'idle', 0, cx, cy + 20, 0.46, false, 0.98);
      return;
    }
    if (target.kind === 'hero' && target.hero) {
      drawHeroFigure(ctx, target.hero, { x: cx, y: cy + 22, size: 50, action: 'idle', t: 0.4 });
      return;
    }
    // 系统 / 登录：和成长之路一致的圆形徽标
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, Math.PI * 2);
    ctx.fillStyle = '#332c1d';
    ctx.fill();
    ctx.strokeStyle = THEME.goldDim;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    text(ctx, target.badge || '?', cx, cy + 1, {
      size: 24, align: 'center', weight: '600', color: THEME.gold,
    });
  }

  // 首通赠将领取卡（250 关关平）：明显标注「首通奖励」，二次领取被 core 层拦掉
  drawHeroRewardModal(ctx) {
    const W = this.game.W;
    ctx.save();
    ctx.fillStyle = 'rgba(13,10,7,0.72)';
    ctx.fillRect(0, 0, W, this.game.H);
    ctx.restore();
    panel(ctx, 135, 430, 480, 330, {
      fill: 'rgba(43,34,23,0.98)', stroke: '#d59947', r: 22, lw: 3,
    });
    text(ctx, '首 通 奖 励', W / 2, 480, { size: 26, align: 'center', color: '#d59947' });
    const hero = heroById(this.d.heroReward);
    text(ctx, hero ? hero.name : this.d.heroReward, W / 2, 552, {
      size: 46, weight: '700', align: 'center', color: hero ? hero.color : THEME.gold,
    });
    const tierLabel = hero && hero.tier === 'legendary' ? '传奇' : '史诗';
    const owned = this.game.state.heroes && Number(this.game.state.heroes[this.d.heroReward]) > 0;
    text(ctx, `${tierLabel}英雄 · ${owned ? '已拥有，领取后按重复规则折算' : '领取后加入上阵'}`, W / 2, 596, {
      size: 18, align: 'center', color: THEME.textDim,
    });
    button(ctx, this.heroClaimRect, `领 取 ${hero ? hero.name : ''}`, {
      size: 28, fill: '#332c1d', stroke: '#d59947', textColor: '#f4d488',
    });
  }

  // 失败页主面板：兵种克制循环圆环（四个普通兵建模沿环排列，箭头首尾相接）
  drawDefeatPanel(ctx) {
    const W = this.game.W;
    panel(ctx, 70, 318, 610, 442, { fill: THEME.panel, stroke: THEME.redDim, r: 20 });
    text(ctx, '无损失', W / 2, 350, { size: 30, align: 'center', color: THEME.text });
    text(ctx, '兵种克制环', W / 2, 382, {
      size: 18, align: 'center', color: THEME.goldDim,
    });
    this.drawCounterRing(ctx);
    text(ctx, '前排近战 · 后排弓兵', W / 2, 730, {
      size: 20, align: 'center', color: THEME.textDim,
    });
  }

  // 取 CONFIG.counters 的实际倍率 → 百分比（+10% / −10%）
  counterPercent(attacker, defender) {
    const c = (CONFIG.counters || []).find((x) => x.attacker === attacker && x.defender === defender);
    return c ? Math.round((c.mult - 1) * 100) : 0;
  }

  drawCounterRing(ctx) {
    const cx = 375;
    const cy = 548;
    const R = 112;
    const order = ['shield', 'archer', 'spear', 'cavalry']; // 盾 → 弓 → 枪 → 骑 → 盾
    const names = { shield: '盾兵', archer: '弓兵', spear: '枪兵', cavalry: '骑兵' };
    const angles = order.map((_, i) => -Math.PI / 2 + i * Math.PI / 2);
    const gap = Math.PI / 7.5; // 箭弧和兵种模型之间留出缺口

    // 环底：内外两圈细线
    ctx.save();
    ctx.strokeStyle = 'rgba(213,153,71,0.18)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < order.length; i++) {
      const a = order[i];
      const b = order[(i + 1) % order.length];
      const angA = angles[i];
      const angB = angles[i] + Math.PI / 2;
      // 顺时针（克制）：金色弧 + 箭头
      ctx.save();
      ctx.strokeStyle = 'rgba(213,153,71,0.82)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, angA + gap, angB - gap, false);
      ctx.stroke();
      ctx.restore();
      this.drawArrowHead(ctx, cx + Math.cos(angB - gap) * R, cy + Math.sin(angB - gap) * R,
        angB - gap + Math.PI / 2, '#d59947', 11);
      // 逆时针（被克）：暗红内弧 + 反方向箭头
      ctx.save();
      ctx.strokeStyle = 'rgba(178,80,64,0.72)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R - 11, angA + gap, angB - gap, false);
      ctx.stroke();
      ctx.restore();
      this.drawArrowHead(ctx, cx + Math.cos(angA + gap) * (R - 11), cy + Math.sin(angA + gap) * (R - 11),
        angA + gap - Math.PI / 2, '#b25040', 10);

      // 每条弧的中间标出两个方向的增减伤
      const mid = (angA + angB) / 2;
      const lx = cx + Math.cos(mid) * (R + 46);
      const ly = cy + Math.sin(mid) * (R + 46);
      text(ctx, `克制 ${this.counterPercent(a, b) > 0 ? '+' : ''}${this.counterPercent(a, b)}%`,
        lx, ly - 9, { size: 12, align: 'center', color: '#d59947' });
      text(ctx, `被克 ${this.counterPercent(b, a)}%`, lx, ly + 9, {
        size: 12, align: 'center', color: '#c26a5a',
      });

      // 兵种建模：沿环摆放（盾上 / 弓右 / 枪下 / 骑左）
      const nx = cx + Math.cos(angA) * R;
      const ny = cy + Math.sin(angA) * R;
      this.tileTroopNode(ctx, nx, ny, order[i], names[order[i]]);
    }

    // 环心：大号字直接写明克制增益 / 被克减益（数值取自 CONFIG.counters）
    const plus = this.counterPercent('shield', 'archer');
    const minus = this.counterPercent('archer', 'shield');
    text(ctx, `克制 +${plus}%`, cx, cy - 8, {
      size: 26, align: 'center', weight: '700', color: THEME.gold,
    });
    text(ctx, `被克 ${minus}%`, cx, cy + 28, {
      size: 22, align: 'center', weight: '600', color: '#d98b7a',
    });
  }

  drawArrowHead(ctx, x, y, angle, color, size = 10) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(angle - 0.42) * size, y - Math.sin(angle - 0.42) * size);
    ctx.lineTo(x - Math.cos(angle + 0.42) * size, y - Math.sin(angle + 0.42) * size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 环上的普通兵建模节点（盾 / 弓 / 枪 / 骑）
  tileTroopNode(ctx, cx, cy, troopId, name) {
    ctx.save();
    ctx.fillStyle = 'rgba(16,22,32,0.92)';
    ctx.strokeStyle = 'rgba(213,153,71,0.42)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    drawFrame(ctx, sheetFor(troopId, 0), 'idle', 0, cx, cy + 24, 0.72, false);
    text(ctx, name, cx, cy + 50, { size: 15, align: 'center', color: THEME.text });
  }

  // 输出 / 承伤 Top5：综合 = 左右双栏（我方输出 / 敌方输出）+ 四个单项 Tab，全部带百分比
  drawRankings(ctx) {
    const p = this.bestRect;
    panel(ctx, p.x, p.y, p.w, p.h, { fill: 'rgba(58,46,30,0.72)', stroke: THEME.line, r: 18 });
    text(ctx, '战斗统计', p.x + p.w / 2, p.y + 24, { size: 17, align: 'center', color: THEME.gold });

    const TABS = [
      { key: 'all',     label: '综合' },
      { key: 'pDealt',  label: '我输出' },
      { key: 'eDealt',  label: '敌输出' },
      { key: 'pTaken',  label: '我承伤' },
      { key: 'eTaken',  label: '敌承伤' },
    ];
    const tabH = 38;
    const tabGap = 8;
    const tabY = p.y + 46;
    const tabW = Math.floor((p.w - 32 - tabGap * (TABS.length - 1)) / TABS.length);
    this.rankTabs = TABS.map((t, i) => ({
      key: t.key,
      label: t.label,
      rect: { x: p.x + 16 + i * (tabW + tabGap), y: tabY, w: tabW, h: tabH },
    }));
    for (const t of this.rankTabs) {
      const active = t.key === this.rankTab;
      panel(ctx, t.rect.x, t.rect.y, t.rect.w, t.rect.h, {
        fill: active ? 'rgba(138,106,50,0.92)' : 'rgba(33,26,18,0.85)',
        stroke: active ? THEME.goldDim : THEME.line, r: 8, lw: active ? 2 : 1,
      });
      text(ctx, t.label, t.rect.x + t.rect.w / 2, t.rect.y + t.rect.h / 2, {
        size: 17, align: 'center', color: active ? THEME.gold : THEME.textDim,
      });
    }

    const list = Array.isArray(this.d.stats) ? this.d.stats : [];
    const rowH = 76;
    const headY = tabY + tabH + 16;
    const rowY = headY + 20;

    if (list.length === 0) {
      text(ctx, '没有数据', p.x + p.w / 2, rowY + 30, { size: 16, align: 'center', color: THEME.textWeak });
      return;
    }

    if (this.rankTab === 'all') {
      // 综合：左我方输出 / 右敌方输出，各 Top5
      const players = list.filter((s) => s.side === 'player').sort((a, b) => b.dealt - a.dealt).slice(0, 5);
      const enemies = list.filter((s) => s.side === 'enemy').sort((a, b) => b.dealt - a.dealt).slice(0, 5);
      const colW = (p.w - 32 - 16) / 2;
      const colL = p.x + 16;
      const colR = p.x + 16 + colW + 16;
      const sumP = list.filter((s) => s.side === 'player').reduce((n, s) => n + s.dealt, 0);
      const sumE = list.filter((s) => s.side === 'enemy').reduce((n, s) => n + s.dealt, 0);
      text(ctx, '我方输出', colL, headY, { size: 13, color: THEME.green });
      text(ctx, '敌方输出', colR, headY, { size: 13, color: THEME.red });
      this.drawRankColumn(ctx, players, colL, colW, rowY, rowH, 'dealt', sumP, THEME.green);
      this.drawRankColumn(ctx, enemies, colR, colW, rowY, rowH, 'dealt', sumE, THEME.red);
      return;
    }

    // 单项 Tab：我方/敌方 × 输出/承伤，单列 Top5 + 进度条 + 百分比
    const side = this.rankTab.startsWith('p') ? 'player' : 'enemy';
    const key = this.rankTab.includes('Dealt') ? 'dealt' : 'taken';
    const rows = list.filter((s) => s.side === side).sort((a, b) => b[key] - a[key]).slice(0, 5);
    const sum = list.filter((s) => s.side === side).reduce((n, s) => n + s[key], 0);
    const sideLabel = side === 'player' ? '我方' : '敌方';
    const unitLabel = key === 'dealt' ? '输出' : '承伤';
    text(ctx, `${sideLabel}${unitLabel}`, p.x + p.w / 2, headY, {
      size: 13, align: 'center', color: THEME.textWeak,
    });
    this.drawRankColumn(ctx, rows, p.x + 16, p.w - 32, rowY, rowH, key, sum, side === 'player' ? THEME.green : THEME.red, true);
  }

  // 排名列表：单兵模型 + 兵种名 + 柱状条（条上显示百分比）+ 条后数字
  drawRankColumn(ctx, rows, x0, w, rowY, rowH, key, sum, accent, wide = false) {
    if (rows.length === 0) {
      text(ctx, '暂无', x0 + w / 2, rowY + 30, { size: 15, align: 'center', color: THEME.textWeak });
      return;
    }
    const rankColors = ['#f4d488', '#b9a88c', '#c87a3d'];
    const iconScale = wide ? 0.62 : 0.44;
    const rankR = wide ? 16 : 12;
    const nameX = wide ? x0 + 100 : x0 + 66;
    const barX = wide ? x0 + 316 : x0 + 66;
    const barW = wide ? 210 : w - 66 - 62;
    const barH = wide ? 26 : 19;
    for (let i = 0; i < rows.length; i++) {
      const s = rows[i];
      const y = rowY + i * rowH;
      const cy = y + rowH / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x0 + rankR, cy, rankR, 0, Math.PI * 2);
      ctx.fillStyle = '#17130e';
      ctx.fill();
      ctx.strokeStyle = rankColors[i] || THEME.textDim;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = rankColors[i] || THEME.textDim;
      ctx.font = wide ? 'bold 18px Consolas' : 'bold 13px Consolas';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x0 + rankR, cy);
      ctx.restore();

      const isEng = !!s.engine;
      if (isEng) {
        // 器械行没有兵牌：直接放器械模型，档位写进名字
        drawEngineFigure(ctx, s.troop, {
          x: wide ? x0 + 62 : x0 + 40, y: y + rowH - 10,
          size: wide ? 56 : 44, t: 0.4,
          color: s.side === 'player' ? '#6e9b72' : '#8d301b',
        });
      } else {
        drawFrame(ctx, sheetFor(s.troop, spriteTierFor(s.level)), 'idle', 0,
          wide ? x0 + 62 : x0 + 40, y + rowH - 8, iconScale, false, 0.95);
      }

      const rar = s.hero ? CONFIG.rarity.epic : (isEng ? { color: THEME.gold } : rarityInfo(s.troop));
      const special = !!s.hero || isEng || rarityOf(s.troop) !== 'common';
      const hero = s.hero ? heroById(s.hero) : null;
      const name = hero ? `${hero.name} Lv${s.level}`
        : isEng ? `${engineName(s.troop)} ${s.level} 档`
          : `${unitName(s.troop, s.level)} Lv${s.level}`;
      text(ctx, name, nameX, wide ? cy - 14 : y + 20, {
        size: wide ? 24 : 17, color: special ? rar.color : THEME.text,
        maxWidth: wide ? 190 : w - 66 - 78,
      });
      if (wide) {
        text(ctx, `击杀 ${s.kills || 0}`, nameX, cy + 16, { size: 14, color: THEME.textWeak });
      }

      const val = s[key] || 0;
      const pct = sum > 0 ? val / sum : 0;
      const pctText = `${Math.round(pct * 100)}%`;

      const bY = wide ? cy - barH / 2 : y + 40;
      bar(ctx, barX, bY, barW, barH, pct, { fill: accent, stroke: '#4a3a24', r: 6 });
      text(ctx, pctText, barX + barW / 2, bY + barH / 2, {
        size: wide ? 20 : 13, weight: '700', align: 'center', color: '#f4efe2',
      });

      text(ctx, `${val}`, x0 + w - 6, cy, {
        size: wide ? 30 : 19, weight: '700', align: 'right', color: THEME.gold,
      });
    }
  }

  // 铜钱 + 首通奖励的窄条：压缩到 92 高，给战斗统计和「下一个解锁」让空间
  drawRewardStrip(ctx) {
    const st = this.game.state;
    const d = this.d;
    panel(ctx, 70, 272, 610, 92, { fill: 'rgba(58,46,30,0.72)', stroke: THEME.line, r: 18 });

    // 左：铜钱
    text(ctx, '铜钱', 100, 296, { size: 20, color: THEME.textDim });
    text(ctx, `+${d.coins}`, 340, 298, {
      size: 32, weight: '700', align: 'right', color: d.coins > 0 ? THEME.gold : THEME.textWeak,
    });
    text(ctx, d.firstClear ? '首通' : '不可重复', 100, 336, {
      size: 15, color: d.firstClear ? THEME.gold : THEME.textWeak,
    });
    ctx.save();
    ctx.strokeStyle = 'rgba(120,140,170,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(358, 284);
    ctx.lineTo(358, 352);
    ctx.stroke();
    ctx.restore();

    // 右：首通奖励
    const entry = this.nextChest();
    const type = entry ? chestType(entry.id) : null;
    text(ctx, '首通', 374, 296, { size: 20, color: THEME.goldDim });

    if (this.opened) {
      const unit = this.opened;
      const rar = rarityInfo(unit.troop);
      const special = rarityOf(unit.troop) !== 'common';
      text(ctx, `开箱获得 ${unitName(unit.troop, unit.level)} Lv${unit.level}`, 374, 330, {
        size: 16, color: special ? rar.color : THEME.gold, maxWidth: 160,
      });
      text(ctx, `兵营 ${st.units.length} / ${rosterSlots(st.maxCleared).unlocked}`, 374, 352, {
        size: 12, color: THEME.textWeak,
      });
      return;
    }

    // 第 5 关支援剧情：首通奖励位换成剧情文案，不再显示「本关没有宝箱」
    if (d.storyText) {
      if (d.storyTitle) {
        text(ctx, d.storyTitle, 374, 316, { size: 17, color: THEME.gold, maxWidth: 160 });
      }
      text(ctx, d.storyText, 374, 340, {
        size: 14, color: THEME.text, maxWidth: 164,
      });
    } else {
      const names = [];
      if (d.chests.length) {
        names.push(d.chests.map((c) => `${chestType(c.id)?.name || c.id} ×${c.count}`).join(' / '));
      }
      for (const u of d.unitRewards || []) {
        names.push(u.added ? `${u.name} Lv${u.level} ×1` : `${u.name}（兵营满，折算黄金宝箱）`);
      }
      text(ctx, names.length ? names.join('　') : '本关没有宝箱', 374, 330, {
        size: 15, color: names.length ? THEME.text : THEME.textWeak, maxWidth: 160,
      });
    }
    const extra = milestoneChestsAt(d.levelN);
    if (extra.length) {
      text(ctx, '含城池奖励', 374, 352, { size: 13, color: THEME.gold });
    } else if ((d.unitRewards || []).length) {
      text(ctx, '城池奖励', 374, 352, { size: 13, color: THEME.gold });
    }

    if (entry) {
      button(ctx, this.chestRect, `打 开 ${type.name}`, {
        size: 18, fill: '#241a16', stroke: type.color || THEME.goldDim,
        textColor: type.color || THEME.gold,
      });
    } else {
      button(ctx, this.chestRect, '已 开 完', {
        size: 18, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak, disabled: true,
      });
    }
  }
}
