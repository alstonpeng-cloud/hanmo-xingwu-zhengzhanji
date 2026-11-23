import { THEME, text, panel, button, coinBadge, hit, bar, screenDim, roundRectPath, primaryButton, eventOrb, menuBackdrop, carvedFrame } from '../render/draw.js';
import { now as clockNow } from '../core/clock.js';
import { CONFIG } from '../data/config.js';
import { levelTotal, rosterSlots, autoBattleUnlocked } from '../core/levels.js';
import { cityOfLevel, chapterOfLevel } from '../core/chapters.js';
import { maxLevel } from '../core/merge.js';
import { chestType } from '../core/chests.js';
import { ensureIdleAt, idleAccrued, claimIdle } from '../core/idle.js';
import { idleChestState, claimIdleChest, ensureIdleChest, formatIdleCountdown } from '../core/idleChest.js';
import { drawChest } from '../render/chest.js';
import { drawGameTitle } from '../render/title.js';
import { dailyUnlocked, ensureDaily, canClaimLogin, taskState, dateKey } from '../core/daily.js';
import { isAudioEnabled, setAudioEnabled, playSfx, getBgmVolume, getSfxVolume, setBgmVolume, setSfxVolume } from '../core/audio.js';
import { LevelSelectScreen } from './levels.js';
import { BarracksScreen } from './barracks.js';
import { HeroScreen } from './heroes.js';
import { DeployScreen } from './deploy.js';
import { ShopScreen } from './shop.js';
import { ChestScreen } from './chests.js';
import { DailyScreen } from './daily.js';
import { TrialScreen } from './trial.js';
import { HeroBattleScreen } from './heroBattle.js';
import { GauntletScreen } from './gauntlet.js';
import { WeeklyChallengeScreen } from './weekly.js';
import { DailyChallengeScreen } from './dailyChallenge.js';
import { AchievementsScreen } from './achievements.js';
import { ensureWeekly, weeklyOrbUnread } from '../core/weekly.js';
import { claimableCount } from '../core/achievements.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { dailyUnlocked as dailyChallengeUnlocked, dailyChallengeOrbUnread } from '../data/dailyChallenge.js';
import { GrowthScreen } from './growth.js';
import { HelpScreen } from './help.js';
import { GROWTH_NODES, growthStatus } from '../data/growth.js';
import { unlockedHeroes, heroTickets } from '../core/heroes.js';
import { HEROES } from '../data/heroes.js';
// #dev-only:start
import { DevScreen } from './dev.js';
// #dev-only:end

// 声音设置面板的布局（导出给冒烟测试复用）
export const HOME_AUDIO_LAYOUT = {
  panel: { x: 95, y: 430, w: 560, h: 420 },
  master: { x: 420, y: 530, w: 160, h: 54 },
  bgmBar: { x: 270, y: 614, w: 290, h: 18 },
  bgmHit: { x: 270, y: 596, w: 290, h: 54 },
  sfxBar: { x: 270, y: 684, w: 290, h: 18 },
  sfxHit: { x: 270, y: 666, w: 290, h: 54 },
  close: { x: 275, y: 780, w: 200, h: 54 },
  help: { x: 120, y: 786, w: 140, h: 42 },
};

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export class HomeScreen {
  constructor(game) {
    this.game = game;
    // 引导态兜底：解锁的模式一旦已有通关记录，进主页就自动清掉高亮，避免老玩家被卡住
    const st0 = game.state;
    const gt0 = st0.guideTarget;
    if (gt0 && (
      (gt0 === 'trials' && Number(st0.trialCleared) > 0)
      || (gt0 === 'heroBattle' && Number(st0.heroBattleCleared) > 0)
      || (gt0 === 'gauntlet' && st0.gauntlet
        && Array.isArray(st0.gauntlet.cleared) && st0.gauntlet.cleared.length > 0)
      || (gt0 === 'weekly' && Array.isArray(st0.weekly?.cleared)
        && st0.weekly.cleared.some((v) => Number(v) > 0))
      || (gt0 === 'dailyChallenge' && Array.isArray(st0.dailyChallenge?.progress)
        && st0.dailyChallenge.progress.some((v) => Number(v) > 0))
      || (gt0 === 'achievements' && Array.isArray(st0.achievements?.claimed)
        && st0.achievements.claimed.length > 0)
    )) {
      st0.guideTarget = null;
      game.save();
    }
    this.tutorialId = 'home';
    this.t = 0;
    this.nowMs = clockNow();
    ensureIdleAt(game.state, this.nowMs);
    ensureIdleChest(game.state, this.nowMs);
    this.bgm = 'main';
    this.audioOpen = false;
    this.dragSlider = null;
    this.rects = {
      battle: { x: 95, y: 446, w: 560, h: 128 },
      // 宝箱 / 商城 一排；兵营（含布阵）/ 英雄 一排
      chests: { x: 95, y: 590, w: 272, h: 108 },
      shop: { x: 383, y: 590, w: 272, h: 108 },
      barracks: { x: 95, y: 714, w: 272, h: 108 },
      hero: { x: 383, y: 714, w: 272, h: 108 },
      daily: { x: 486, y: 52, w: 210, h: 62 },
      sound: { x: 320, y: 52, w: 148, h: 62 },
      // 三个模式入口：一行 3 个大按钮（标题及下方元素整体下移后仍在标题之上）
      trial: { x: 24, y: 120, w: 226, h: 112 },
      heroBattle: { x: 262, y: 120, w: 226, h: 112 },
      gauntlet: { x: 500, y: 120, w: 226, h: 112 },
      // 1.2.6 · 周常/每日挑战只留左侧悬浮圆钮（底部方框入口重复已移除），底部这行仅成就
      achievements: { x: 262, y: 994, w: 226, h: 94 },
      // 成长之路入口移到下方空白区，做成一条宽按钮
      growth: { x: 70, y: 1110, w: 610, h: 64 },
      idleClaim: { x: 96, y: 922, w: 250, h: 44 },
      // 挂机宝箱：和挂机铜钱同一面板的右半区，整块可点（链式计时 + 每日 8 个）
      idleChest: { x: 372, y: 852, w: 296, h: 120 },
      // 左侧悬浮挑战圆钮（汉帛朱金）：每周 / 每日挑战快捷入口 + 呼吸光晕 + 红点角标
      weeklyOrb: { x: 8, y: 596, w: 84, h: 84 },
      dailyOrb: { x: 8, y: 700, w: 84, h: 84 },
      // #dev-only:start
      // 试玩调试四连（开发者作弊）：铜钱 / 满级 / 每单位 +1 级 / 重置存档
      addCoins: { x: 70, y: 1216, w: 139, h: 62 },
      levelUp: { x: 227, y: 1216, w: 139, h: 62 },
      levelOne: { x: 384, y: 1216, w: 139, h: 62 },
      reset: { x: 541, y: 1216, w: 139, h: 62 },
      devTest: { x: 70, y: 1290, w: 610, h: 56 },
      // #dev-only:end
    };
  }

  update(dt) {
    this.t += dt;
    this.nowMs = clockNow();
    // 挂机宝箱要处理跨天重置 / 时间回拨，所以每帧都校验一次（纯状态维护）
    ensureIdleChest(this.game.state, this.nowMs);
    // 周常挑战：跨周重建积分 / 兵牌 / 进度（解锁前不建域；key 不变时只是几行比较）
    if ((Number(this.game.state.maxCleared) || 0) >= CONFIG.weekly.unlockLevel) {
      ensureWeekly(this.game.state, this.nowMs);
    }
  }

  // 面板打开时滑条支持按住拖动；其余点击沿用 tap()
  onDown(x, y) {
    if (!this.audioOpen) return this.tap(x, y);
    const L = HOME_AUDIO_LAYOUT;
    if (hit(L.bgmHit, x, y)) {
      this.dragSlider = 'bgm';
      this.applyVolumeSlider('bgm', x, false);
      return;
    }
    if (hit(L.sfxHit, x, y)) {
      this.dragSlider = 'sfx';
      this.applyVolumeSlider('sfx', x, true);
      return;
    }
    this.tapAudio(x, y);
  }

  onMove(x) {
    if (!this.dragSlider) return;
    this.applyVolumeSlider(this.dragSlider, x, false);
  }

  onUp() {
    this.dragSlider = null;
  }

  applyVolumeSlider(kind, x, feedback) {
    const L = HOME_AUDIO_LAYOUT;
    const b = kind === 'bgm' ? L.bgmBar : L.sfxBar;
    const v = clamp01((x - b.x) / b.w);
    if (kind === 'bgm') {
      setBgmVolume(v);
      this.game.state.bgmVolume = v;
    } else {
      setSfxVolume(v);
      this.game.state.sfxVolume = v;
    }
    this.game.save();
    if (feedback) playSfx('tap', { volume: 0.85, force: true });
  }

  tap(x, y) {
    const g = this.game;
    const r = this.rects;
    const st = g.state;
    if (this.audioOpen) return this.tapAudio(x, y);
    if (hit(r.battle, x, y)) return g.push(new LevelSelectScreen(g));
    if (hit(r.chests, x, y)) return g.push(new ChestScreen(g));
    if (hit(r.shop, x, y)) return g.push(new ShopScreen(g));
    if (hit(r.barracks, x, y)) return g.push(new BarracksScreen(g));
    if (hit(r.hero, x, y)) {
      if (st.maxCleared < CONFIG.heroes.unlockLevel) {
        playSfx('error', { volume: 0.7 });
        g.toast(`通关第 ${CONFIG.heroes.unlockLevel} 关后解锁英雄`);
        return;
      }
      return g.push(new HeroScreen(g));
    }
    if (hit(r.daily, x, y)) return g.push(new DailyScreen(g));
    if (hit(r.growth, x, y)) return g.push(new GrowthScreen(g));
    if (hit(r.trial, x, y)) {
      this.clearGuideIfTarget('trials');
      return g.push(new TrialScreen(g));
    }
    if (hit(r.heroBattle, x, y)) {
      if (st.maxCleared < CONFIG.heroBattles.unlockLevel) {
        playSfx('error', { volume: 0.7 });
        g.toast(`通关第 ${CONFIG.heroBattles.unlockLevel} 关后解锁英雄战（还差 ${CONFIG.heroBattles.unlockLevel - st.maxCleared} 关）`);
        return;
      }
      this.clearGuideIfTarget('heroBattle');
      return g.push(new HeroBattleScreen(g));
    }
    if (hit(r.gauntlet, x, y)) {
      if (st.maxCleared < CONFIG.gauntlet.unlockLevel) {
        playSfx('error', { volume: 0.7 });
        g.toast(`通关第 ${CONFIG.gauntlet.unlockLevel} 关后解锁「过 5 关斩 6 将」`);
        return;
      }
      this.clearGuideIfTarget('gauntlet');
      return g.push(new GauntletScreen(g));
    }
    // 1.2.5 · 周常挑战（左侧悬浮圆钮唯一入口）
    if (hit(r.weeklyOrb, x, y)) return this.openWeekly();
    // 1.2.5 · 每日挑战（左侧悬浮圆钮唯一入口）
    if (hit(r.dailyOrb, x, y)) return this.openDailyChallenge();
    // 1.2.5 · 成就（30 关开放；入口常显，可领时带红点）
    if (hit(r.achievements, x, y)) {
      if ((st.maxCleared || 0) < CONFIG.achievements.unlockLevel) {
        playSfx('error', { volume: 0.7 });
        g.toast(`通关第 ${CONFIG.achievements.unlockLevel} 关后开放成就系统（还差 ${CONFIG.achievements.unlockLevel - (st.maxCleared || 0)} 关）`);
        return;
      }
      this.clearGuideIfTarget('achievements');
      return g.push(new AchievementsScreen(g));
    }
    if (hit(r.sound, x, y)) {
      this.audioOpen = true;
      return;
    }
    if (hit(r.idleChest, x, y)) {
      const res = claimIdleChest(st, clockNow());
      if (!res.ok) {
        playSfx('error', { volume: 0.7 });
        if (res.reason === 'done') g.toast('今日挂机宝箱已领完，明天 0 点重置');
        else g.toast(`宝箱还在计时，还需 ${formatIdleCountdown(res.remainMs)}`);
        return;
      }
      g.save();
      playSfx('chest', { volume: 0.85 });
      const type = chestType(res.chest);
      g.toast(`领取${type ? type.name : '宝箱'} ×1（已放入宝箱仓库）`);
      return;
    }
    if (hit(r.idleClaim, x, y)) {
      const res = claimIdle(g.state, clockNow());
      if (!res.ok) {
        playSfx('error', { volume: 0.7 });
        g.toast('挂机收益还没攒出来，过一会儿再来领');
        return;
      }
      g.save();
      playSfx('reward');
      g.toast(`领取挂机铜钱 +${res.amount}`);
      return;
    }
    // #dev-only:start
    if (hit(r.addCoins, x, y)) {
      g.state.coins += 10000;
      g.save();
      g.toast('调试：铜钱 +10000');
      return;
    }
    if (hit(r.levelUp, x, y)) {
      g.state.units.forEach((u) => {
        u.level = maxLevel();
      });
      g.save();
      g.toast(`调试：所有单位升到 Lv${maxLevel()}`);
      return;
    }
    if (hit(r.levelOne, x, y)) {
      // 开发者作弊：每个单位各升 1 级（满级的不动），方便逐级看模型 / 试合成
      const max = maxLevel();
      let n = 0;
      g.state.units.forEach((u) => {
        if (u.level < max) {
          u.level += 1;
          n++;
        }
      });
      if (!n) {
        g.toast(`所有单位都已经 Lv${max} 了`);
        return;
      }
      g.save();
      g.toast(`调试：${n} 个单位各 +1 级`);
      return;
    }
    if (hit(r.reset, x, y)) {
      g.resetGame();
      g.toast('存档已重置');
      return;
    }
    if (hit(r.devTest, x, y)) {
      g.push(new DevScreen(g));
      return;
    }
    // #dev-only:end
  }

  // 周常挑战入口（左侧悬浮圆钮）
  openWeekly() {
    const g = this.game;
    const st = g.state;
    if ((st.maxCleared || 0) < CONFIG.weekly.unlockLevel) {
      playSfx('error', { volume: 0.7 });
      g.toast(`通关第 ${CONFIG.weekly.unlockLevel} 关后解锁周常挑战（还差 ${CONFIG.weekly.unlockLevel - (st.maxCleared || 0)} 关）`);
      return;
    }
    this.clearGuideIfTarget('weekly');
    ensureWeekly(st, this.nowMs);
    // 1.2.8 · 点进面板即视为已读：本周红点消失，下周重建后重显
    if (st.weekly && st.weekly.seen !== true) {
      st.weekly.seen = true;
      g.save();
    }
    return g.push(new WeeklyChallengeScreen(g));
  }

  // 每日挑战入口（左侧悬浮圆钮）
  openDailyChallenge() {
    const g = this.game;
    const st = g.state;
    if (!dailyChallengeUnlocked(st)) {
      playSfx('error', { volume: 0.7 });
      g.toast(`通关第 ${CONFIG.dailyChallenge.unlockLevel} 关后解锁每日挑战（还差 ${CONFIG.dailyChallenge.unlockLevel - (st.maxCleared || 0)} 关）`);
      return;
    }
    this.clearGuideIfTarget('dailyChallenge');
    // 1.2.8 · 点进面板即视为已读：当日红点消失，次日 0 点重显
    if (!st.dailyChallenge) st.dailyChallenge = { progress: Array(CONFIG.dailyChallenge.total).fill(0), seenDay: '' };
    const dk = dateKey(this.nowMs);
    if (st.dailyChallenge.seenDay !== dk) {
      st.dailyChallenge.seenDay = dk;
      g.save();
    }
    return g.push(new DailyChallengeScreen(g));
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;

    // 哑光金底纹：衬托整页内容，透明度低、不抢焦点
    menuBackdrop(ctx, W, g.H, { t: this.t });

    // 顶部信息条
    panel(ctx, 40, 40, 670, 74, { fill: 'rgba(43,34,23,0.75)', stroke: THEME.line, r: 18 });
    carvedFrame(ctx, 40, 40, 670, 74, { color: THEME.goldSoft, alpha: 0.55, corner: 20, inset: 3, lw: 1.6, r: 18, inner: false });
    text(ctx, '铜钱', 74, 77, { size: 24, color: THEME.textDim });
    coinBadge(ctx, 138, 77, st.coins, { size: 26 });

    // 每日入口（通关 30 关开放）：签到 / 每日任务 / 7 日登录
    const dailyReady = this.dailyHasReward();
    button(ctx, this.rects.daily, '每 日', {
      size: 21,
      sub: dailyUnlocked(st) ? '签到 · 任务 · 7 日登录' : `通关 ${CONFIG.daily.unlockLevel} 关开放`,
      subSize: 14,
      fill: dailyReady ? '#332c1d' : THEME.panel,
      stroke: dailyReady ? THEME.goldDim : THEME.line,
      textColor: dailyReady ? THEME.gold : THEME.textDim,
    });
    if (dailyReady) {
      ctx.save();
      ctx.fillStyle = THEME.red;
      ctx.beginPath();
      ctx.arc(this.rects.daily.x + this.rects.daily.w - 12, this.rects.daily.y + 12, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 演武入口（150 关后解锁；每 10 关开一关，共 25 关）
    const trialOpen = st.maxCleared >= CONFIG.trials.unlockLevel;
    button(ctx, this.rects.trial, '演 武', {
      size: 32,
      sub: trialOpen
        ? `精英挑战 · ${Math.min(CONFIG.trials.total, st.trialCleared || 0)}/${CONFIG.trials.total} 关`
        : `主线 ${CONFIG.trials.unlockLevel} 关解锁`,
      subSize: 16,
      fill: trialOpen ? '#2f2438' : THEME.panel,
      stroke: trialOpen ? '#a678b8' : THEME.line,
      textColor: trialOpen ? '#c9a8d8' : THEME.textWeak,
    });

    // 成长之路入口：兵种解锁链 + 系统功能开放路线（可滚动）
    const growthDone = GROWTH_NODES.filter((n) => growthStatus(st, n).unlocked).length;
    const hbOpen = st.maxCleared >= CONFIG.heroBattles.unlockLevel;
    button(ctx, this.rects.heroBattle, '英 雄 战', {
      size: 32,
      sub: hbOpen
        ? `Boss 挑战 · ${Math.min(CONFIG.heroBattles.total, st.heroBattleCleared || 0)}/${CONFIG.heroBattles.total} 关`
        : `主线 ${CONFIG.heroBattles.unlockLevel} 关解锁`,
      subSize: 16,
      fill: hbOpen ? '#3a241e' : THEME.panel,
      stroke: hbOpen ? '#8d301b' : THEME.line,
      textColor: hbOpen ? '#e8a094' : THEME.textWeak,
    });

    // 过 5 关斩 6 将：主线 200 关后开放，用现有兵牌一冲到底
    const gtOpen = st.maxCleared >= CONFIG.gauntlet.unlockLevel;
    const gtCleared = (st.gauntlet && st.gauntlet.cleared ? st.gauntlet.cleared.length : 0);
    button(ctx, this.rects.gauntlet, '斩 将', {
      size: 32,
      sub: gtOpen ? `过 5 关斩 6 将 · ${gtCleared}/${CONFIG.gauntlet.chapters.length} 章` : `主线 ${CONFIG.gauntlet.unlockLevel} 关解锁`,
      subSize: 16,
      fill: gtOpen ? '#2c2418' : THEME.panel,
      stroke: gtOpen ? THEME.goldDim : THEME.line,
      textColor: gtOpen ? THEME.gold : THEME.textWeak,
    });

    button(ctx, this.rects.growth, '成 长 之 路', {
      size: 26,
      sub: `节点 ${growthDone}/${GROWTH_NODES.length}`,
      subSize: 16,
      fill: growthDone >= GROWTH_NODES.length ? '#332c1d' : THEME.panel,
      stroke: growthDone >= GROWTH_NODES.length ? THEME.goldDim : THEME.line,
      textColor: growthDone >= GROWTH_NODES.length ? THEME.gold : THEME.text,
    });

    // 声音开关（打开音量面板：BGM / 音效分别可调）
    const soundOn = isAudioEnabled();
    button(ctx, this.rects.sound, '声 音', {
      size: 21,
      sub: soundOn ? 'BGM · 音效 设置' : '已静音',
      subSize: 14,
      fill: this.audioOpen || soundOn ? '#332c1d' : THEME.panel,
      stroke: this.audioOpen || soundOn ? THEME.goldDim : THEME.line,
      textColor: this.audioOpen || soundOn ? THEME.gold : THEME.textWeak,
    });

    // 标题（金色草书位图；加载失败时回退到文字）
    drawGameTitle(ctx, W / 2, 292, 112, { fallbackSize: 68 });

    // 首页只展示「当前城池」的 100 关进度，不暴露总关卡数；进入下一座城自动切换
    const cur = Math.min(levelTotal(), st.maxCleared + 1);
    const city = cityOfLevel(cur) || cityOfLevel(levelTotal());
    const chapter = chapterOfLevel(cur) || chapterOfLevel(levelTotal());
    const cityFrom = city ? city.from : 1;
    const cityTo = city ? city.to : 100;
    const citySpan = Math.max(1, cityTo - cityFrom + 1);
    const cityDone = Math.max(0, Math.min(citySpan, st.maxCleared - cityFrom + 1));
    const chapterShort = chapter ? (chapter.name.split(' · ')[1] || chapter.name) : '';
    text(ctx, `${chapterShort} · ${city ? city.name : ''} ${cityFrom}-${cityTo}`, W / 2, 390, {
      size: 26, align: 'center', color: THEME.text,
    });
    text(ctx, `${cityDone}/${citySpan} 关`, 706, 390, {
      size: 22, align: 'right', color: THEME.textDim,
    });
    bar(ctx, 165, 414, 420, 8, cityDone / citySpan, { fill: THEME.gold, r: 4 });

    const r = this.rects;
    // 朱砂主按钮（汉帛·朱金）：一级行动视觉焦点，宋体大字 + 金边内发光
    primaryButton(ctx, r.battle, '闯 关', {
      sub: autoBattleUnlocked(st)
        ? `第 ${st.maxCleared + 1} 关待挑战 · 自动战斗已开放`
        : `第 ${st.maxCleared + 1} 关待挑战 · 主线 ${CONFIG.autoBattle.unlockLevel} 关开放自动战斗`,
      size: 44, subSize: 20, t: this.t,
    });
    // S2.2：主按钮四角云纹雕花，复刻参考图 01 朱砂「闯关」牌的鎏金角花
    carvedFrame(ctx, r.battle.x, r.battle.y, r.battle.w, r.battle.h, {
      color: THEME.goldLit, alpha: 0.8, corner: 34, inset: 3, lw: 2.2, r: 18, glow: 6,
    });
    // 三个常用入口用金色 / 淡紫色 / 亮绿色实底，并配同色外发光
    const entryGlow = (rect, rgb) => {
      ctx.save();
      ctx.shadowColor = `rgba(${rgb},0.42)`;
      ctx.shadowBlur = 24;
      roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 18);
      ctx.strokeStyle = `rgba(${rgb},0.55)`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    };
    // 四个入口：参考图 01 为「深褐近黑实底 + 细描边 + 亮色文字」，
    // 不用高饱和纯色块（S2.1 回退时一并修正，避免破坏暖褐暗金的整体氛围）。
    entryGlow(r.barracks, '170,150,110');
    button(ctx, r.barracks, '兵 营', {
      size: 36, fill: '#241c14', stroke: THEME.goldDim,
      textColor: THEME.text, subColor: THEME.textDim,
      sub: `${st.units.length} / ${rosterSlots(st.maxCleared).unlocked} 个兵`,
      subSize: 17,
    });
    const heroOpen = st.maxCleared >= CONFIG.heroes.unlockLevel;
    // 招募系统：深紫褐底 + 紫气描边，与兵营的深褐底拉开层级
    button(ctx, r.hero, '招 募 系 统', {
      sub: heroOpen
        ? `招募券 ${heroTickets(st)} · 已拥有 ${unlockedHeroes(st).length}/${HEROES.length}`
        : `通关 ${CONFIG.heroes.unlockLevel} 关开放`,
      size: 27, subSize: heroOpen ? 19 : 16,
      fill: heroOpen ? '#2a1f2b' : THEME.panel2,
      stroke: heroOpen ? THEME.purple : THEME.line,
      textColor: heroOpen ? '#c9a0d0' : THEME.textWeak,
    });
    entryGlow(r.chests, '213,153,71');
    button(ctx, r.chests, '宝 箱', {
      size: 34, fill: '#2a2016', stroke: THEME.gold,
      textColor: THEME.goldLit,
    });
    entryGlow(r.shop, '120,150,150');
    button(ctx, r.shop, '商 城', {
      size: 36, fill: '#202a2c', stroke: '#5b7280',
      textColor: '#dce4e6',
    });

    // 挂机收益（离线 / 在线都在累积，封顶 8 小时）
    this.drawIdle(ctx);

    // 左侧悬浮挑战圆钮（汉帛·朱金）：呼吸光晕 + 漂浮粒子 + 红点角标
    // 1.2.8 · 角标 = 纯色呼吸点（不带数字）：本周/当日没点进过面板就亮，点进即消
    const orbWeeklyOpen = (st.maxCleared || 0) >= CONFIG.weekly.unlockLevel;
    const orbDailyOpen = dailyChallengeUnlocked(st);
    const weeklyUnread = orbWeeklyOpen && weeklyOrbUnread(st, this.nowMs) ? 1 : 0;
    const dailyUnread = orbDailyOpen && dailyChallengeOrbUnread(st, this.nowMs) ? 1 : 0;
    eventOrb(ctx, r.weeklyOrb.x + r.weeklyOrb.w / 2, r.weeklyOrb.y + r.weeklyOrb.h / 2,
      r.weeklyOrb.w / 2 - 4, '每周', {
        t: this.t, badge: weeklyUnread,
        active: orbWeeklyOpen, phase: 0, color: THEME.gold,
      });
    eventOrb(ctx, r.dailyOrb.x + r.dailyOrb.w / 2, r.dailyOrb.y + r.dailyOrb.h / 2,
      r.dailyOrb.w / 2 - 4, '每日', {
        t: this.t, badge: dailyUnread,
        active: orbDailyOpen, phase: 1.6, color: THEME.gold,
      });

    // 1.2.5 新行：底部只留成就入口（周常 / 每日挑战与左侧圆钮重复，方框已移除）
    const achOpen = (st.maxCleared || 0) >= CONFIG.achievements.unlockLevel;
    const claimable = achOpen ? claimableCount(st) : 0;
    button(ctx, r.achievements, '成 就', {
      size: 34,
      sub: achOpen
        ? (claimable > 0 ? `可领取 ${claimable} 项奖励` : `已解锁 ${ACHIEVEMENTS.length} 条成就`)
        : `通关 ${CONFIG.achievements.unlockLevel} 关开放`,
      subSize: 15,
      fill: claimable > 0 ? '#332c1d' : THEME.panel2,
      stroke: claimable > 0 ? THEME.goldDim : THEME.line,
      textColor: claimable > 0 ? THEME.gold : achOpen ? THEME.text : THEME.textWeak,
    });
    if (claimable > 0) {
      // 可领红点：成就入口右上角
      ctx.beginPath();
      ctx.arc(r.achievements.x + r.achievements.w - 10, r.achievements.y + 10, 9, 0, Math.PI * 2);
      ctx.fillStyle = THEME.red;
      ctx.fill();
    }

    // #dev-only:start
    button(ctx, r.addCoins, '铜钱+1万', { size: 22, fill: THEME.panel, stroke: THEME.line });
    button(ctx, r.levelUp, '全员满级', { size: 22, fill: THEME.panel, stroke: THEME.line });
    button(ctx, r.levelOne, '全员+1级', {
      size: 22, fill: THEME.panel, stroke: THEME.goldDim, textColor: THEME.gold,
    });
    button(ctx, r.reset, '重置存档', { size: 22, fill: THEME.panel, stroke: THEME.redDim, textColor: THEME.textDim });
    button(ctx, r.devTest, '开发者测试场', {
      size: 22, fill: '#2b2217', stroke: THEME.goldDim, textColor: THEME.gold,
    });
    text(ctx, '以上按钮为开发者通道，正式版会移除', W / 2, 1364, { size: 18, align: 'center', color: THEME.textWeak });
    // #dev-only:end

    // 解锁引导态：顶部提示 + 目标模式按钮的脉冲高亮（画在最上层，其他按钮照常可点）
    this.drawUnlockGuide(ctx, st);

    if (this.audioOpen) this.drawAudioPanel(ctx);
  }

  // ---------- 声音设置 ----------
  tapAudio(x, y) {
    const g = this.game;
    const st = g.state;
    const L = HOME_AUDIO_LAYOUT;
    if (hit(L.help, x, y)) {
      this.audioOpen = false;
      g.push(new HelpScreen(g));
      return;
    }
    if (!hit(L.panel, x, y) || hit(L.close, x, y)) {
      this.audioOpen = false;
      return;
    }
    if (hit(L.master, x, y)) {
      const on = !isAudioEnabled();
      setAudioEnabled(on);
      st.audio = on;
      g.save();
      if (on) playSfx('tap', { volume: 0.9, force: true });
      return;
    }
    if (hit(L.bgmHit, x, y)) {
      this.applyVolumeSlider('bgm', x, false);
      return;
    }
    if (hit(L.sfxHit, x, y)) {
      this.applyVolumeSlider('sfx', x, true);
    }
  }

  drawAudioPanel(ctx) {
    const L = HOME_AUDIO_LAYOUT;
    const W = this.game.W;
    const H = this.game.H;
    const on = isAudioEnabled();
    const bgm = getBgmVolume();
    const sfx = getSfxVolume();

    screenDim(ctx, W, H, 0.72);
    panel(ctx, L.panel.x, L.panel.y, L.panel.w, L.panel.h, {
      fill: THEME.panel, stroke: THEME.goldDim, r: 24,
    });
    text(ctx, '声音 / 震动', W / 2, 482, { size: 34, weight: '600', align: 'center', color: THEME.gold });

    // 总开关（声音与击杀震动共用这一个键，不额外加震动按钮）
    text(ctx, '声音 / 震动总开关', 130, 570, { size: 22, color: THEME.text });
    button(ctx, L.master, on ? '开 启' : '已 关 闭', {
      size: 22,
      fill: on ? '#332c1d' : THEME.panel2,
      stroke: on ? THEME.goldDim : THEME.line,
      textColor: on ? THEME.gold : THEME.textWeak,
    });

    // 音量滑条：点击轨道直接设置，圆点显示当前位置
    const drawSlider = (b, ratio, color, label, yText) => {
      text(ctx, label, 130, yText, { size: 22, color: THEME.text });
      bar(ctx, b.x, b.y, b.w, b.h, ratio, { fill: color, stroke: '#4a3a24', r: 9 });
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x + b.w * ratio, b.y + b.h / 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#100c08';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      text(ctx, `${Math.round(ratio * 100)}%`, b.x + b.w, yText, {
        size: 22, align: 'right', color,
      });
    };

    drawSlider(L.bgmBar, bgm, THEME.gold, 'BGM 音量', 628);
    drawSlider(L.sfxBar, sfx, THEME.blue, '音效音量', 698);

    button(ctx, L.help, '新手引导', {
      size: 18, fill: THEME.panel2, stroke: THEME.line, textColor: THEME.textDim,
    });
    button(ctx, L.close, '完 成', { size: 24, fill: THEME.panel2, stroke: THEME.line });
  }

  // 每日入口是否亮红点：今天没签到 / 有任务可领 / 7 日登录可领
  dailyHasReward() {
    const st = this.game.state;
    if (!dailyUnlocked(st)) return false;
    const s = ensureDaily(st, this.nowMs);
    const taskReady = (CONFIG.daily.tasks || []).some((t) => {
      if (t.id === 'sign') return false; // 签到由上面的按钮点亮
      return taskState(st, t).claimable;
    });
    return !s.signed || taskReady || canClaimLogin(st);
  }

  drawIdle(ctx) {
    const g = this.game;
    const st = g.state;
    const r = this.rects.idleClaim;
    const coins = idleAccrued(st, this.nowMs);

    panel(ctx, 70, 842, 610, 138, { fill: 'rgba(43,34,23,0.6)', stroke: THEME.line, r: 18 });

    // 左半：只留一个大的铜钱图标 + 当前可领取数量（不写任何说明小字）
    coinBadge(ctx, 100, 882, coins, { size: 42 });
    button(ctx, r, coins > 0 ? '领 取' : '暂无可领', {
      size: 24,
      fill: coins > 0 ? '#332c1d' : THEME.panel,
      stroke: coins > 0 ? THEME.goldDim : THEME.line,
      textColor: coins > 0 ? THEME.gold : THEME.textWeak,
      disabled: coins <= 0,
    });

    // 竖向分隔线：和铜钱并列，但视觉上分开
    ctx.save();
    ctx.strokeStyle = 'rgba(120,140,170,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(370, 860);
    ctx.lineTo(370, 962);
    ctx.stroke();
    ctx.restore();

    // 右半：只留 箱子模型 + 倒计时 / 可领取状态
    const info = idleChestState(st, this.nowMs);
    const type = chestType(info.chest) || { name: '宝箱', color: '#c8a86a' };

    drawChest(ctx, 418, 922, 0.62, {
      color: info.done ? '#8a7d64' : type.color,
      kind: type.id || info.chest || '',
      glow: !info.done && info.ready,
      alpha: info.done ? 0.55 : 1,
    });

    if (info.done) {
      text(ctx, '已领完', 478, 922, { size: 28, weight: '600', color: THEME.textWeak });
    } else if (info.ready) {
      text(ctx, '可领取', 478, 922, { size: 32, weight: '700', color: THEME.gold });
    } else {
      text(ctx, formatIdleCountdown(info.remainMs), 478, 922, {
        size: 34, weight: '600', color: THEME.text,
      });
    }
  }

  // 引导态：点中高亮入口进入对应模式时清掉引导标记（随存档持久化）
  clearGuideIfTarget(target) {
    const st = this.game.state;
    if (st.guideTarget === target) {
      st.guideTarget = null;
      this.game.save();
    }
  }

  // 解锁引导态：顶部提示条 + 目标模式按钮的脉冲金圈 / 箭头 / 一句引导文案
  // 只做绘制，不拦截任何点击，其他按钮在引导态下照常可点
  drawUnlockGuide(ctx, st) {
    const gt = st.guideTarget;
    const rect = gt === 'trials' ? this.rects.trial
      : gt === 'heroBattle' ? this.rects.heroBattle
        : gt === 'gauntlet' ? this.rects.gauntlet
          : gt === 'weekly' ? this.rects.weeklyOrb
            : gt === 'dailyChallenge' ? this.rects.dailyOrb
              : gt === 'achievements' ? this.rects.achievements : null;
    if (!rect) return;
    const W = this.game.W;
    const t = this.t;
    const cx = rect.x + rect.w / 2;

    // 顶部提示：新玩法已解锁
    panel(ctx, 95, 6, 560, 32, {
      fill: 'rgba(51,44,29,0.92)', stroke: THEME.goldDim, r: 14,
    });
    text(ctx, '新玩法已解锁 · 点这里试试', W / 2, 22, {
      size: 18, align: 'center', color: THEME.gold,
    });

    // 脉冲金圈：呼吸描边 + 两圈向外扩散的光环
    const breath = 0.5 + 0.5 * Math.sin(t * 3.2);
    ctx.save();
    ctx.strokeStyle = THEME.gold;
    ctx.globalAlpha = 0.55 + breath * 0.45;
    ctx.lineWidth = 2 + breath * 3;
    roundRectPath(ctx, rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6, 20);
    ctx.stroke();
    const wave = (t % 1.6) / 1.6;
    for (let i = 0; i < 2; i++) {
      const p = (wave + i * 0.5) % 1;
      const grow = 2 + p * 8;
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.lineWidth = 2;
      roundRectPath(ctx, rect.x - grow, rect.y - grow,
        rect.w + grow * 2, rect.h + grow * 2, 18 + grow);
      ctx.stroke();
    }
    ctx.restore();

    // 箭头指示：按钮上沿一个上下浮动的金色向下箭头
    const ay = rect.y + 2 + Math.sin(t * 4) * 3;
    ctx.save();
    ctx.fillStyle = THEME.gold;
    ctx.beginPath();
    ctx.moveTo(cx, ay + 14);
    ctx.lineTo(cx - 10, ay);
    ctx.lineTo(cx + 10, ay);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 一句引导文案：按钮底部的金色胶囊标签（圆钮靠左，标签钳在屏幕内）
    const tagW = 176;
    const tagH = 30;
    const tagY = rect.y + rect.h - tagH - 6;
    const tagX = Math.max(8, Math.min(cx - tagW / 2, W - tagW - 8));
    panel(ctx, tagX, tagY, tagW, tagH, {
      fill: THEME.gold, stroke: null, r: 15, alpha: 0.92,
    });
    text(ctx, '点这里试试', tagX + tagW / 2, tagY + tagH / 2, {
      size: 18, align: 'center', weight: '600', color: '#2a2110',
    });
  }
}
