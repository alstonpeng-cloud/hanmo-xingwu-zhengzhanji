// 斗技场战斗（斜 45° 俯视，竖版 24×60 格）：敌方在上、我方在下；每个兵自主寻敌、走位、进入射程后攻击
// 镜头：开战瞬间像布阵页一样放大看我方半场，然后 1 秒多平滑拉到斗技场中心（整场一屏可见）
import { CONFIG } from '../data/config.js';
import { levelDef, rewardFor, activeFormation, addUnit } from '../core/levels.js';
import { chestsForLevel, addChest, chestCount } from '../core/chests.js';
import { milestoneUnitsAt } from '../core/chapters.js';
import { noteClear } from '../core/daily.js';
import { createArenaBattle } from '../core/arena.js';
import { engineChoice, engineStageFor, enemyEngineFor, enginePower, engineName } from '../core/siege.js';
import { playerBookScales, enemyBookScales } from '../core/books.js';
import { unitName, spriteTierFor, troopById, refreshTroopUnlocks } from '../core/units.js';
import { THEME, text, panel, button, bar, hit, roundRectPath } from '../render/draw.js';
import { heroHpSegmentCount, heroHpSegmentFill, heroCooldown } from '../core/heroBar.js';
import { drawFrame, sheetFor, frameCount, currentFrame } from '../render/sprites.js';
import { drawHeroFigure, drawHeroAura } from '../render/heroArt.js';
import { drawEngineFigure, drawAuraRing } from '../render/engineArt.js';
import {
  TILT, makeCamera, camToScreen, panCamera, camAtTop, camAtBottom, camCoversAll,
  setCameraZoom, depthScale, clampCamera,
} from '../render/camera.js';
import { drawArenaField } from '../render/arenaField.js';
import { chapterThemeOfLevel } from '../core/chapters.js';
import { ResultScreen } from './result.js';
import { TrialResultScreen } from './trialResult.js';
import { HeroBattleResultScreen } from './heroBattleResult.js';
import { DeployScreen } from './deploy.js';
import { grantTrialRewards, trialClearCoins, trialMainLevel } from '../data/trials.js';
import { heroBattleDef, recordHeroBattleClear } from '../data/heroBattles.js';
import {
  dailyBattleDef, recordDailyClear, recordDailyRepeatWin,
  dailyClearedCount, dailyFirstClearReward, dailyTotal,
} from '../data/dailyChallenge.js';
import { ChallengeResultScreen } from './challengeResult.js';
import { DailyChallengeScreen } from './dailyChallenge.js';
import {
  ensureWeekly, weeklyLevelDef, recordWeeklyClear, weeklySweep,
  weeklyTierClearedCount, weeklyClearedTotal, draftActiveFormation,
  weeklyNextStage,
} from '../core/weekly.js';
import { weeklyStageCoins, weeklyTotalPoints, weeklyTierGrant } from '../data/weekly.js';
import { WeeklyChallengeScreen } from './weekly.js';
import { gauntletStageDef, gauntletChapterIndex } from '../data/gauntlet.js';
import { gauntletRunSquads, applyGauntletReport, completeGauntletChapter, failGauntletRun } from '../core/gauntlet.js';
import { GauntletScreen } from './gauntlet.js';
import { troopPower, formatPower } from '../core/power.js';
import { playSfx, isAudioEnabled } from '../core/audio.js';
import {
  heroPower, addHeroTickets, pendingLevelHeroReward, claimLevelHeroReward,
  mainlineScrollReward,
} from '../core/heroes.js';
import { heroById, heroStatsFor } from '../data/heroes.js';
import { pendingUnlockTeachings, markUnlockSeen } from '../core/unlocks.js';
import { UnlockTeachingScreen } from './unlockTeaching.js';
import { tickTrialRounds } from '../core/trialTroop.js';
import {
  isSupportBattle, supportSquad, SUPPORT_TITLE, SUPPORT_BRIEF, SUPPORT_RESULT,
} from '../data/supportLevel.js';

// 斗技场视口：顶栏下面到屏幕底部，几乎占满全屏
export const ARENA_VIEW = { x: 0, y: 118, w: 750, h: 1104 };
// 兵的立绘尺寸 = 2.6 格（近处约 80px），立绘竖直站起、不跟着地面压扁 → 斜 45° 的立体感
// 注意：开战后只画「立绘 + 脚底光圈 + 血条」，不画方框（方框只在布阵页当位置提示）
const SPRITE_CELLS = 2.6;
// 本轮整体放大一档：只放大立绘本身，脚底光圈 / 血条 / 阻挡半径仍然按原尺寸算，
// 避免放大后和阵型、判定对不上（阵亡判定与走位半径都在 core/battle.js，未改动）。
const SOLDIER_SCALE = 1.16;
// 开战瞬间的镜头：正好装下我方 25 个上阵位的左右宽度（比布阵页更近，看着像「已布好阵」）
const FORM_WIDTH = (CONFIG.formation.rows - 1) * CONFIG.formation.lateralStep;
const START_ZOOM = ARENA_VIEW.w / (FORM_WIDTH + 3);
// 开战后的镜头：只装下约 48 行（而不是缩到整场一屏）。
// 这样 30×84 的战场在屏幕上放不下，玩家才能真的左右 / 上下拖动，
// 顶部输出面板盖住的兵也能拖出来；缩放仍然保持可读（约 35px/格）。
const BATTLE_ROWS_VISIBLE = 48;
const BATTLE_ZOOM = ARENA_VIEW.h / (BATTLE_ROWS_VISIBLE * TILT);
// 开战镜头拉远 / 上移的时长（秒）
const CAM_MOVE_TIME = 1.15;
// 序章最多打这么久（秒），到点无论战场还剩多少人都强制判负
const PROLOGUE_MAX_TIME = 16;

// 加速是否可用：主线 10 关前锁 1 倍速；序章必败，也不给加速；演武 / 英雄战 / 斩将不受限
export function speedUnlocked(levelN, opts = {}) {
  if (opts.prologue) return false;
  if (opts.dev || opts.trial || opts.heroBattle || opts.gauntlet) return true;
  return (Number(levelN) || 0) >= CONFIG.battle.speedUnlockLevel;
}

// 击杀震动的统一入口：和「声音总开关」共用同一个开关（关闭声音 = 同时关闭震动）
function vibrate(game, ms) {
  if (!isAudioEnabled()) return;
  if (game && game.platform && game.platform.vibrate) game.platform.vibrate(ms);
}

// 每日 / 周常挑战结算里的宝箱名
const CHEST_LABELS = { wood: '小木箱', silver: '白银宝箱', gold: '黄金宝箱', rare: '稀有箱' };
function chestLabel(id) {
  return CHEST_LABELS[id] || id || '';
}

// 单位动作计时：播完回到待机
export class BattleScreen {
  constructor(game, levelN, rng = Math.random, opts = {}) {
    this.game = game;
    this.trial = opts.trial || null;
    this.heroBattle = opts.heroBattle || null;
    // 每日挑战（1.2.5）：走英雄战 UI 通道（heroBattle 同时传入），结算走独立分支
    this.dailyChallenge = opts.dailyChallenge || null;
    // 周常挑战（1.2.5）：draft 积分选兵，结算独立（不传 trial/heroBattle/gauntlet）
    this.weekly = opts.weekly || null;
    this.gauntlet = opts.gauntlet || null;
    this.prologue = opts.prologue === true;
    this.dev = opts.dev || null;
    this.levelN = this.gauntlet ? this.gauntlet.stage
      : this.heroBattle ? this.heroBattle.stage : this.trial ? this.trial.stage : levelN;
    // 战场主题：主线按章节切换；演武 / 英雄战沿用第一章黄沙；斩将按章节主题；序章黑红
    this.fieldTheme = this.prologue ? 'dongzhuo'
      : this.gauntlet
        ? (CONFIG.gauntlet.chapters.find((c) => c.id === this.gauntlet.run.chapter) || {}).theme || 'huangjin'
        : this.trial || this.heroBattle || this.weekly ? 'huangjin' : chapterThemeOfLevel(this.levelN);
    // 关卡数据兜底：重开 / 演武 / 英雄战链路偶尔会传进不带 enemies 的 def（或被上游覆盖成 undefined），
    // 旧实现直接 reduce 空数组 → 敌方总战力 0；这里统一回退到按关号重新生成。
    const fallbackDef = this.weekly
      ? weeklyLevelDef(game.state, this.weekly.tier, this.weekly.stage)
      : this.dailyChallenge ? dailyBattleDef(this.dailyChallenge.stage)
        : this.heroBattle ? heroBattleDef(this.levelN)
          : this.gauntlet ? gauntletStageDef(this.gauntlet.run.chapter, this.gauntlet.stage)
            : levelDef(this.levelN);
    this.def = opts.def && Array.isArray(opts.def.enemies) && opts.def.enemies.length
      ? opts.def : fallbackDef;

    // 斩将：用跑关快照里「仍存活」的兵牌出战，血量按上一关剩余比例带入
    const formation = this.dev && Array.isArray(this.dev.playerSquads)
      ? this.dev.playerSquads
      : this.gauntlet
        ? gauntletRunSquads(this.gauntlet.run)
        : this.weekly
          ? draftActiveFormation(game.state)
          : activeFormation(game.state);
    // 布阵里可能包含英雄格（h:xxx），activeFormation 已经解析成 {troop, level, hero}
    // 等级统一归一化：旧存档 / 异常数据里的 undefined / NaN 会一路传进属性与战力计算，
    // 最后被 formatPower 兜底成「0」。英雄等级上限独立（可到 30），普通兵按 1~10 收敛。
    this.playerSquads = formation.map((f) => {
      const n = Number(f.level);
      const lv = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
      return {
        troop: f.troop,
        level: f.hero ? lv : Math.min(CONFIG.merge.maxLevel, lv),
        col: f.col,
        row: f.row,
        hero: f.hero || null,
        hpPct: Number.isFinite(f.hpPct) ? f.hpPct : 1,
      };
    });

    // 第 5 关剧情支援：幽州突骑临时助战（只在主线第 5 关，不写存档、不占兵营）。
    // 若支援位已被玩家占用就往后找一个空位，确保援军真的出现在战场上。
    this.supportBattle = isSupportBattle(this.levelN,
      this.trial || this.heroBattle || this.gauntlet || this.prologue || this.dev || this.weekly
        ? 'other' : 'main');
    if (this.supportBattle) {
      const sq = supportSquad();
      const used = new Set(this.playerSquads.map((s) => `${s.col},${s.row}`));
      if (used.has(`${sq.col},${sq.row}`)) {
        outer: for (const col of [4, 3, 2, 1, 0]) {
          for (const row of [1, 0, 2, 3, 4]) {
            if (!used.has(`${col},${row}`)) { sq.col = col; sq.row = row; break outer; }
          }
        }
      }
      this.playerSquads.push({ ...sq, hpPct: 1 });
    }

    // 兵书：玩家三卷加成（未解锁 / 全 0 时返回 null，不额外挂字段）
    const bookScales = playerBookScales(game.state);
    if (bookScales) {
      this.playerSquads = this.playerSquads.map((s) => ({ ...s, ...bookScales }));
    }

    // 器械数值的关卡锚点：主线用关卡号；演武用对标主线关；英雄战 / 斩将用映射关号，
    // 保证「器械随关卡自动成长」在四个模式里是同一条曲线。
    // 演武：首 50 关是手写关（没有 mainLevel），统一按 trialMainLevel 折算对标主线关，
    // 否则这 50 关会一直锚在 1~50 关 —— 器械 / 兵书在演武里永远不会成长。
    const engineStage = this.weekly
      ? engineStageFor('weekly', this.weekly.tier)
      : this.dailyChallenge
      ? engineStageFor('daily', this.dailyChallenge.stage)
      : this.trial
      ? (Number(this.def.mainLevel) || trialMainLevel(this.levelN))
      : this.heroBattle ? engineStageFor('hero', this.heroBattle.stage)
        : this.gauntlet ? engineStageFor('gauntlet', gauntletChapterIndex(this.gauntlet.run.chapter) + 1)
          : this.levelN;
    this.engineStage = engineStage;
    // 玩家器械：整局只有一台；斩将整轮锁定（开跑时快照，中途不能换器械 / 换站位）。
    // 老存档里已在跑、但没有快照的 run 退回当前选择，不至于半路把器械清零。
    const chosen = this.gauntlet && this.gauntlet.run
      ? (this.gauntlet.run.engine || engineChoice(game.state))
      : engineChoice(game.state);
    const playerEngine = chosen
      ? { id: chosen.id, tier: chosen.tier, stance: chosen.stance }
      : null;
    // 敌方器械：主线由 levelDef 生成（已替换掉一支后排小队）；演武 / 英雄战 / 斩将在这里补上。
    // 演武是 12 队满编，同样「器械顶掉最靠后的一支普通小队」（阵位不变）；
    // 英雄战 / 斩将的敌方编成是手工设定的（BOSS + 护卫），器械直接追加，不删护卫。
    let enemyEngine = this.def.engine || null;
    if (!enemyEngine && (this.trial || this.heroBattle || this.gauntlet)) {
      enemyEngine = enemyEngineFor(engineStage, !!this.heroBattle || !!this.gauntlet);
      if (enemyEngine && this.trial && this.def.enemies.length > 1) {
        let idx = -1;
        let bestCol = -1;
        this.def.enemies.forEach((e, i) => {
          if (e.hero || e.boss) return;
          const col = Number.isFinite(e.col) ? e.col : 0;
          if (col > bestCol) { bestCol = col; idx = i; }
        });
        if (idx >= 0) {
          this.def = { ...this.def, enemies: this.def.enemies.filter((_, i) => i !== idx) };
        }
      }
    }
    // 兵书对等加成：主线在 levelDef 里挂好了；演武 / 英雄战 / 斩将在各自 def 外补一刀。
    // 每日挑战不走这里：它的 def 来自 levelDef(锚点)，兵书已在关卡生成里乘过，再来一刀会翻倍。
    if (!this.dailyChallenge && (this.trial || this.heroBattle || this.gauntlet)) {
      const book = enemyBookScales(engineStage);
      if (book) {
        this.def = {
          ...this.def,
          enemies: this.def.enemies.map((e) => ({
            ...e,
            atkScale: (e.atkScale || 1) * book.atkScale,
            hpMult: (e.hpMult || 1) * book.hpMult,
            defScale: (e.defScale || 1) * book.defScale,
          })),
        };
      }
    }

    this.battle = createArenaBattle(this.playerSquads, this.def.enemies, rng, {
      playerEngine, enemyEngine, stage: engineStage,
    });
    this.totalPlayer = this.battle.entities.filter((e) => e.side === 'player').length;
    this.totalEnemy = this.battle.entities.filter((e) => e.side === 'enemy').length;
    // 开场总战力（和布阵页 / 结算数据同一口径）：可以在开战后顶栏的留白一直显示
    this.myPower = this.playerSquads.reduce((sum, q) => sum
      + (q.hero ? heroPower(q.hero, q.level) : troopPower(q.troop, q.level)), 0);
    // 难度倍率与布阵页同口径（卡点 / 50 关后 +10% 已计入 levelDef 的 difficulty）
    this.difficulty = Number.isFinite(this.def.difficulty) ? this.def.difficulty : 1;
    this.enemyPower = Math.round(this.def.enemies.reduce((sum, q) => sum
      + (q.hero ? heroPower(q.hero, q.level, q.hpMult || 1) : troopPower(q.troop, q.level)), 0)
      * this.difficulty);
    this.enemyLvText = this.def.enemyLevelMax > this.def.enemyLevel
      ? `Lv${this.def.enemyLevel}~${this.def.enemyLevelMax}`
      : `Lv${this.def.enemyLevel}`;

    // 镜头：开战瞬间是我方半场的放大视图，然后平滑推到战场中心。
    // 注意这里不再用 cameraZoom（整场一屏），否则玩家没法拖动、顶部面板也会一直压着兵。
    this.cam = makeCamera(ARENA_VIEW, { zoom: START_ZOOM });
    this.camFrom = { zoom: this.cam.zoom, y: this.cam.y };
    // 英雄战 Boss 不再固定前排：按最靠后的 Boss 纵深把镜头往敌方半场压。
    // 每多一排只补偿 depthStep/2 格（约 3 格 ≈ 69px）：输出榜在开战无数据时已收成窄条，
    // 半程补偿就足以让后排 Boss 完整露在 HUD 下方，同时我方前排仍留在视口内。
    // 若按完整 depthStep(5.8) 补偿，Boss 是露出来了，我方部队却会被整个推出画面。
    const bossDepth = this.heroBattle
      ? Math.max(0, ...(this.def.enemies || []).filter((e) => e.boss).map((e) => e.col || 0))
      : 0;
    this.camTo = {
      zoom: BATTLE_ZOOM,
      y: this.heroBattle
        ? 36 - Math.round(CONFIG.formation.depthStep / 2) * bossDepth
        : CONFIG.arena.rows / 2,
    };
    this.camT = 0;
    this.speedLocked = !speedUnlocked(this.levelN, opts);
    this.speed = this.speedLocked ? 1 : CONFIG.battle.defaultSpeed;
    this.accum = 0;
    this.idleClock = 0;
    this.vis = {};
    this.battle.entities.forEach((e, i) => { this.vis[e.uid] = { action: 'idle', t: 0, phase: i * 0.31 }; });
    this.floats = [];
    this.shots = [];
    this.fx = [];
    this.feed = [];
    this.pan = null;
    this.endTimer = null;
    this.outcome = null;
    this.finished = false;
    this.bannerT = 1.4;
    // 第 5 关：开场播一段「幽州突骑驰援」剧情提示（3.6 秒），不写存档
    this.supportStoryT = this.supportBattle ? 3.6 : 0;
    this.speedRect = { x: 612, y: 40, w: 110, h: 68 };
    // 战中实时输出榜：左上角我方 Top5、右上角敌方 Top5，每 0.25 秒刷新
    this.hudT = 0;
    this.hudP = [];
    this.hudE = [];
    this.hudPTotal = 0;
    this.hudETotal = 0;
    // 重来：直接回到这一关的布阵页（不结算、不消耗）。
    // 英雄战顶部有 Boss 血条，输出榜整体下移 82px，重来键同步下移，避免与面板重叠。
    this.retryRect = { x: 648, y: this.heroBattle ? 470 : 388, w: 76, h: 76 };
    // 战斗页按下多半是在拖镜头，不播通用点击音（只给倍速按钮等明确操作配音）
    this.noTapSound = true;
    // 主 BGM：和首页 / 结算共用《战争进化史》，由 Game.syncBgm 控制，进入战斗不重新起播
    this.bgm = 'main';

    if (this.battle.over) {
      this.outcome = this.prologue ? 'enemy' : this.battle.winner;
      this.endTimer = 1.0;
    }
  }

  update(dt) {
    this.idleClock += dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.supportStoryT > 0) this.supportStoryT -= dt;
    this.updateCamera(dt);
    if (this.finished) return;

    const dtS = dt * this.speed;
    this.accum += Math.min(dtS, 0.2);
    const step = CONFIG.combat.step;
    let guard = 0;
    while (this.accum >= step && !this.battle.over && guard < 12) {
      this.accum -= step;
      guard++;
      this.handle(this.battle.step(step));
    }

    if (this.prologue) {
      // 序章必败：打赢也算输，超过 16 秒还没打完直接结束，避免玩家卡在不可能翻盘的局里
      if (this.battle.over || this.battle.time >= PROLOGUE_MAX_TIME) {
        this.outcome = 'enemy';
        if (this.endTimer === null) this.endTimer = 1.1;
      }
    } else if (this.battle.over && !this.outcome) {
      this.outcome = this.battle.winner;
      this.endTimer = 1.1;
    }

    // 单位动作计时：播完回到待机（阵亡单位已从渲染层移除，不再保留任何死亡状态）
    for (const uid in this.vis) {
      const v = this.vis[uid];
      const ent = this.battle.byUid[uid];
      if (!ent || !ent.alive || v.action === 'idle') continue;
      v.t += dtS;
      if (v.t >= this.durationOf(v.action)) {
        v.action = 'idle';
        v.t = 0;
      }
    }

    this.floats = this.floats.filter((f) => (f.t += dtS) < f.dur);
    this.shots = this.shots.filter((s) => (s.t += dtS) < s.dur);
    this.fx = this.fx.filter((f) => (f.t += dtS) < f.dur);

    // 实时输出榜节流刷新（不分倍速，始终按 0.25 秒真实时间更新一次）
    this.hudT += dt;
    if (this.hudT >= 0.25) {
      this.hudT = 0;
      const stats = this.battle.statsList();
      const top = (side) => stats.filter((s) => s.side === side)
        .sort((a, b) => b.dealt - a.dealt).slice(0, 5);
      this.hudP = top('player');
      this.hudE = top('enemy');
      // 百分比按「本方全部输出」算（英雄也算在里面）
      this.hudPTotal = stats.reduce((n, s) => n + (s.side === 'player' ? s.dealt : 0), 0);
      this.hudETotal = stats.reduce((n, s) => n + (s.side === 'enemy' ? s.dealt : 0), 0);
    }

    if (this.endTimer !== null) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.finish();
    }
  }

  // 开战镜头：从「我方半场放大」平滑推到「斗技场中心 + 整场」，缓出（先快后慢）
  updateCamera(dt) {
    if (this.camT >= 1) return;
    this.camT = Math.min(1, this.camT + dt / CAM_MOVE_TIME);
    const k = 1 - Math.pow(1 - this.camT, 3);
    setCameraZoom(this.cam, this.camFrom.zoom + (this.camTo.zoom - this.camFrom.zoom) * k);
    this.cam.y = this.camFrom.y + (this.camTo.y - this.camFrom.y) * k;
    this.cam.x = CONFIG.arena.cols / 2;
    clampCamera(this.cam);
  }

  durationOf(action) {
    if (action === 'attack') return CONFIG.battle.attackAnimTime;
    if (action === 'hit') return CONFIG.battle.hitAnimTime;
    return 0.72;
  }

  // 世界格坐标 → 屏幕像素（走相机）
  px(x, y) {
    return camToScreen(this.cam, x, y);
  }

  setAction(uid, action) {
    const v = this.vis[uid];
    if (!v) return;
    v.action = action;
    v.t = 0;
  }

  handle(events) {
    for (const e of events) {
      if (e.t === 'attack') {
        this.setAction(e.actor, 'attack');
        if (!e.miss) this.setAction(e.target, 'hit');
        // 战斗音效：远程放箭 / 近战挥砍（同名音效在 audio 层做节流，不会糊成一片）
        if (e.ranged) playSfx('arrow', { volume: 0.45 });
        else playSfx('slash', { volume: 0.4 });
        if (e.miss) {
          // 被无当飞军的光环闪避：不扣血，只飘一个「闪避」
          this.floats.push({
            wx: e.x2, wy: e.y2, text: '闪避', color: '#a6bec4', size: 18, t: 0, dur: 0.7,
          });
        } else {
          this.floats.push({
            // 存世界坐标，镜头拖动时飘字也跟着兵走
            wx: e.x2, wy: e.y2,
            text: `-${e.damage}`,
            counter: e.counter > 1 ? '克制' : e.counter < 1 ? '被克制' : '',
            kill: e.killed,
            // 毒伤绿色、冲锋撞击金色、突刺暖白、普通伤害红
            color: e.poison ? '#8fe08a' : e.charge3 ? '#ffd479' : e.dashed ? '#ffe0a8' : null,
            size: e.charge3 ? 28 : null,
            label: e.reflect ? '反弹' : e.counterAttack ? '反击' : e.charge3 ? '冲锋' : e.dashed ? '突刺' : '',
            t: 0, dur: 0.8,
          });
        }
        // 无当飞军毒矢命中：绿色毒雾气泡
        if (e.poison) this.fx.push({ kind: 'poison', wx: e.x2, wy: e.y2, t: 0, dur: 0.55 });
        if (e.ranged) {
          this.shots.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, t: 0, dur: 0.16, poison: e.poison });
        }
      } else if (e.t === 'heal') {
        // 刘备回血光环：淡绿 +N 飘字（每秒一次，仅视觉；实际治疗按帧连续结算）
        this.floats.push({
          wx: e.x, wy: e.y, text: `+${e.amount}`, color: '#8ee6aa', size: 17,
          label: e.aura ? '光环' : '', t: 0, dur: 0.7,
        });
      } else if (e.t === 'convert') {
        // 曹操「宁可我负天下人」：伤害转治疗，绿色回复飘字
        this.floats.push({
          wx: e.x, wy: e.y, text: `+${e.heal}`, color: '#7fe0a0', size: 18, label: '转化', t: 0, dur: 0.7,
        });
      } else if (e.t === 'poison') {
        // 持续毒伤：绿色小飘字 + 气泡声
        playSfx('poison', { volume: 0.35 });
        this.floats.push({ wx: e.x, wy: e.y, text: `-${e.damage}`, color: '#8fe08a', size: 17, t: 0, dur: 0.6 });
      } else if (e.t === 'impact') {
        // 虎豹骑冲锋撞击 / 张飞圆环 / 关羽扇形：按类型分开画，三种范围技能各有辨识度
        if (e.kind === 'sector') {
          playSfx('slash', { volume: 0.6 });
          this.fx.push({
            kind: 'sector', wx: e.x, wy: e.y,
            dirX: e.dirX || 1, dirY: e.dirY || 0,
            radius: e.radius || 3, angle: e.angle || 60,
            t: 0, dur: 0.45,
          });
        } else if (e.kind === 'spin') {
          playSfx('charge', { volume: 0.55 });
          this.fx.push({ kind: 'ring', wx: e.x, wy: e.y, radius: e.radius || 2, t: 0, dur: 0.55 });
          vibrate(this.game, 6);
        } else {
          // 虎豹骑冲锋撞击：地面扩散的冲击波
          playSfx('charge', { volume: 0.6 });
          this.fx.push({ kind: 'impact', wx: e.x, wy: e.y, t: 0, dur: 0.6 });
          // 击杀震动：统一走声音总开关（关闭声音时不再震）
          vibrate(this.game, 8);
        }
      } else if (e.t === 'fire') {
        // 火焰圈跳伤：橙色飘字（和毒伤的绿色区分开）
        this.floats.push({ wx: e.x, wy: e.y, text: `-${e.damage}`, color: '#ff9b4a', size: 17, t: 0, dur: 0.6 });
      } else if (e.t === 'fireZone') {
        // 火箭落地生成火焰圈：地面炸开一圈火星（常驻火圈由 drawFireZones 绘制）
        playSfx('poison', { volume: 0.25 });
        this.fx.push({ kind: 'fireBurst', wx: e.x, wy: e.y, radius: e.radius || 1, t: 0, dur: 0.5 });
      } else if (e.t === 'stun') {
        // 关平拖刀计 / 冲锋眩晕：目标头顶「眩晕」金字
        this.floats.push({ wx: e.x, wy: e.y, text: '眩晕', color: '#ffe08a', size: 20, t: 0, dur: 0.9 });
      } else if (e.t === 'dash') {
        // 大戟士突刺起手（后续拖影由实体状态渲染）
        this.floats.push({ wx: e.x, wy: e.y, text: '突刺', color: '#ffe0a8', size: 18, t: 0, dur: 0.6 });
      } else if (e.t === 'death') {
        // 阵亡当帧清掉渲染状态：单位从战场上直接消失，不留尸体或幽灵实体
        delete this.vis[e.uid];
        playSfx('death', { volume: 0.45 });
        // 器械阵亡没有 troopById 记录，用 engineName 出 feed
        this.feed.unshift(e.troop === 'thunder' || e.troop === 'drum'
          ? `${engineName(e.troop)} 被击倒`
          : `${unitName(e.troop, e.level)} 被击倒`);
        if (this.feed.length > 4) this.feed.length = 4;
        // 击杀震动：和声音总开关共用同一个开关
        if (e.side === 'player') vibrate(this.game, 10);
      } else if (e.t === 'end') {
        this.outcome = e.winner;
        this.endTimer = 1.1;
      }
    }
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.endTimer = null;

    const g = this.game;
    // 序章：不结算、不发奖、不计战绩，直接进东山再起
    if (this.prologue) {
      this.outcome = 'enemy';
      // 序章败北：跳过败北过场页，直接重置存档进第 1 关排兵布阵（闯关起点）
      playSfx('defeat', { volume: 0.75 });
      g.toast('败北 · 兵牌清空，从第 1 关开始');
      g.finishPrologue('deploy');
      return;
    }
    // #dev-only:start
    // 测试场：不结算、不发奖，直接回到测试场继续配队
    if (this.dev) {
      const msg = this.outcome === 'player' ? '测试结束：我方胜'
        : this.outcome === 'enemy' ? '测试结束：敌方胜' : '测试结束：平局';
      g.toast(msg, 2.2);
      if (this.dev.back) this.dev.back();
      return;
    }
    // #dev-only:end
    const st = g.state;
    st.stats.battles++;
    const win = this.outcome === 'player';
    if (win) st.stats.wins++;

    // 斩将：把本关的剩余血量 / 阵亡状态回写进跑关快照
    if (this.gauntlet) {
      const run = this.gauntlet.run;
      const report = this.playerSquads.map((q) => {
        const list = this.battle.entities.filter((e) => e.side === 'player' && e.squad === q);
        const maxHp = list.reduce((sum, e) => sum + Math.max(0, e.maxHp), 0);
        const hp = list.reduce((sum, e) => sum + Math.max(0, e.hp), 0);
        return { hpPct: maxHp > 0 ? hp / maxHp : 0, dead: hp <= 0 };
      });
      applyGauntletReport(run, report);
      let summary = null;
      if (win) {
        if (run.stage >= CONFIG.gauntlet.stagesPerChapter) {
          summary = completeGauntletChapter(st);
        } else {
          run.stage += 1;
        }
      } else {
        failGauntletRun(st);
      }
      g.save();
      g.go(new GauntletScreen(g, {
        summary,
        flash: win
          ? (summary ? '' : `第 ${this.gauntlet.stage} 关突破，继续冲`)
          : '冲锋失败：本次结束，可无限重来',
      }));
      return;
    }

    // 周常挑战（1.2.5）：首通记 5×10 掩码 + 铜钱/宝箱 + 档位完成大赏；
    // 重复胜利在结算页可扫荡（每日 6 次、60% 铜钱、无宝箱）。必须在主线分支之前。
    if (this.weekly) {
      const { tier, stage } = this.weekly;
      let rec = null;
      if (win) rec = recordWeeklyClear(st, tier, stage, (id) => addChest(st, id, 1));
      const s = ensureWeekly(st);
      // 1.2.8 修：档内 stage+1 只在未到档末时推进（旧实现把 11 clamp 成 10 恒真 → 第 11 关）
      const nextStage = weeklyNextStage(st, tier, stage);
      const sweepCoins = Math.round(weeklyStageCoins(tier) * CONFIG.weekly.sweepRatio);
      const sweepLeft = CONFIG.weekly.sweepDailyLimit - s.sweepCount;
      const rewardLines = [];
      if (win && rec && rec.firstClear) {
        rewardLines.push({ text: `首通奖励：铜钱 +${rec.coins}` });
        if (rec.chest) rewardLines.push({ text: `${chestLabel(rec.chest)}已入仓`, dim: true });
        if (rec.tierDone) rewardLines.push({ text: `档位通关大赏：铜钱 +${rec.tierCoins}` });
        if (rec.tierDone && rec.tierPoints > 0) {
          rewardLines.push({ text: `档位通关积分 +${rec.tierPoints}` });
        }
      } else if (win && sweepLeft > 0) {
        rewardLines.push({ text: `重复胜利 · 可扫荡：铜钱 +${sweepCoins}` });
        rewardLines.push({ text: `今日扫荡剩 ${sweepLeft} / ${CONFIG.weekly.sweepDailyLimit} 次（无宝箱）`, dim: true });
      } else if (win) {
        rewardLines.push({ text: '今日扫荡次数已用完', dim: true });
      }
      const sweepAvailable = win && !rec?.firstClear && sweepLeft > 0;
      const goWeeklyDeploy = (gg, t2, s2, def2) => gg.go(new DeployScreen(gg, {
        mode: 'battle',
        level: engineStageFor('weekly', t2),
        weekly: { tier: t2, stage: s2 },
        def: def2,
      }));
      g.save();
      g.go(new ChallengeResultScreen(g, {
        title: `周常挑战 · ${['壹', '贰', '叁', '肆', '伍'][tier - 1]} 档`,
        subtitle: `敌方战力 ${formatPower(this.def.targetPower || 0)} · 你的纯兵上限 ${formatPower(this.def.draftCap || 0)}`,
        infoLines: [
          `战斗用时 ${Math.round(this.battle.time || 0)} 秒 · 总进度 ${weeklyClearedTotal(st)} / ${CONFIG.weekly.tiers * CONFIG.weekly.stagesPerTier} 关`,
          `剩余积分 ${s.points}/${weeklyTotalPoints()}${tier < CONFIG.weekly.tiers
            ? ` · 下档通关 +${weeklyTierGrant(tier + 1)}` : ''} · 档位进度 ${weeklyTierClearedCount(st, tier)} / ${CONFIG.weekly.stagesPerTier}`,
        ],
        rewardLines,
        win,
        time: this.battle.time,
        stats: this.battle.statsList(),
        primary: win
          ? (nextStage && rec && rec.firstClear
            ? {
              label: '下 一 关',
              go: (gg) => goWeeklyDeploy(gg, nextStage[0], nextStage[1],
                weeklyLevelDef(gg.state, nextStage[0], nextStage[1])),
            }
            : sweepAvailable
              ? {
                label: '扫 荡 本 关',
                go: (gg) => {
                  const r = weeklySweep(gg.state, tier, stage);
                  gg.save();
                  gg.toast(r.ok ? `扫荡成功：铜钱 +${r.coins}` : '扫荡失败');
                  gg.go(new WeeklyChallengeScreen(gg));
                },
              }
              : { label: '返 回 周 常', go: (gg) => gg.go(new WeeklyChallengeScreen(gg)) })
          : {
            label: '重 新 布 阵',
            go: (gg) => goWeeklyDeploy(gg, tier, stage, this.def),
          },
        secondary: { label: '返 回 周 常', go: (gg) => gg.go(new WeeklyChallengeScreen(gg)) },
      }));
      return;
    }

    // 每日挑战（1.2.5）：首通永久记录 + 铜钱/宝箱阶梯；重复挑战每天前 3 胜小额奖。
    // 走英雄战 UI 通道但进度独立 —— 必须插在英雄战分支之前，不能写 heroBattleCleared。
    if (this.dailyChallenge) {
      const stage = this.dailyChallenge.stage;
      let firstClear = false;
      let repeat = null;
      let coins = 0;
      let chest = null;
      if (win) {
        const r = recordDailyClear(st, stage, (id) => addChest(st, id, 1));
        firstClear = r.firstClear;
        coins = r.coins;
        chest = r.chest;
        if (firstClear) {
          g.toast(`每日挑战首通：铜钱 +${coins}`);
        } else {
          repeat = recordDailyRepeatWin(st, (id) => addChest(st, id, 1));
        }
      }
      const rewardLines = [];
      if (win && firstClear) {
        rewardLines.push({ text: `首通奖励：铜钱 +${coins}` });
        rewardLines.push({ text: `${chestLabel(chest)}已入仓`, dim: true });
      } else if (win && repeat && repeat.rewarded) {
        rewardLines.push({ text: `今日胜奖：铜钱 +${repeat.coins} + ${chestLabel(repeat.chest)}` });
        rewardLines.push({ text: `今日已领 ${repeat.wins} / ${CONFIG.dailyChallenge.dailyWinLimit} 次`, dim: true });
      } else if (win) {
        rewardLines.push({ text: '今日重复胜奖已领完', dim: true });
      }
      const clearedN = dailyClearedCount(st);
      g.save();
      const def = this.def;
      g.go(new ChallengeResultScreen(g, {
        title: '每 日 挑 战',
        subtitle: `${(def.bosses || []).map((b) => (heroById(b.hero) || {}).name || b.hero).join(' / ')} · 第 ${stage} 关`,
        infoLines: [
          `战斗用时 ${Math.round(this.battle.time || 0)} 秒 · 进度 ${clearedN} / ${dailyTotal()} 关`,
          firstClear ? `已解锁：第 ${stage + 1} 关` : (win ? '重复挑战无首通奖励' : '调整阵容再来'),
        ],
        rewardLines,
        win,
        time: this.battle.time,
        stats: this.battle.statsList(),
        primary: win
          ? (firstClear && stage < dailyTotal()
            ? {
              label: '下 一 关',
              go: (gg) => gg.go(new DeployScreen(gg, {
                mode: 'battle',
                level: stage + 1,
                heroBattle: dailyBattleDef(stage + 1),
                dailyChallenge: { stage: stage + 1 },
                def: dailyBattleDef(stage + 1),
              })),
            }
            : {
              label: '返 回 列 表',
              go: (gg) => gg.go(new DailyChallengeScreen(gg)),
            })
          : {
            label: '重 新 布 阵',
            go: (gg) => gg.go(new DeployScreen(gg, {
              mode: 'battle',
              level: stage,
              heroBattle: def,
              dailyChallenge: { stage },
              def,
            })),
          },
        secondary: { label: '返 回 列 表', go: (gg) => gg.go(new DailyChallengeScreen(gg)) },
      }));
      return;
    }

    // 英雄战：首通记录进度，每 10 关发 1 张招募券；重复挑战不发券
    if (this.heroBattle) {
      let firstClear = false;
      let scrolls = 0;
      if (win) {
        const r = recordHeroBattleClear(st, this.heroBattle.stage);
        firstClear = r.firstClear;
        scrolls = r.scrolls;
        if (scrolls > 0) {
          addHeroTickets(st, scrolls);
          g.toast(`英雄战首通奖励：招募券 +${scrolls}`);
        }
      }
      g.save();
      g.go(new HeroBattleResultScreen(g, {
        win,
        stage: this.heroBattle.stage,
        firstClear,
        scrolls,
        time: this.battle.time,
        stats: this.battle.statsList(),
      }));
      return;
    }

    // 演武：每次通关发稳定铜钱；首通另发黄金宝箱 / 里程碑传奇宝箱
    if (this.trial) {
      const coins = win ? trialClearCoins(this.trial.stage) : 0;
      const rewards = win ? grantTrialRewards(st, this.trial.stage) : [];
      g.save();
      g.go(new TrialResultScreen(g, {
        win, trial: this.trial, rewards, coins,
        time: this.battle.time,
        stats: this.battle.statsList(),
      }));
      return;
    }

    // 试用兵：每打完一场主线（胜 / 负都算）扣 1 回合，第 5 场结束后自动消失
    const expired = tickTrialRounds(st);
    if (expired.length) {
      g.toast(`试用兵已到期：${expired.map((u) => unitName(u.troop, u.level)).join('、')}`);
    }

    let coins = 0;
    let firstClear = false;
    let chests = [];
    let unitRewards = [];
    let teaches = [];

    if (win) {
      // 铜钱只在首通发放：关卡不可重复挑战，这里只可能是首通
      firstClear = this.levelN > st.maxCleared;
      coins = rewardFor(this.levelN, firstClear);
      st.coins += coins;
      st.maxCleared = Math.max(st.maxCleared, this.levelN);
      // 兵种解锁：通关跨过阈值时写进存档，并即时提示（宝箱/商店/广告从这里开始产出）
      const unlockBefore = (st.troopUnlocks || []).length;
      refreshTroopUnlocks(st);
      const newTroops = (st.troopUnlocks || []).slice(unlockBefore);
      if (newTroops.length) {
        g.toast(`解锁新兵种：${newTroops.map((id) => unitName(id, 1)).join('、')}`);
      }
      // 新功能 / 新兵种教学：本次过关刚好跨过解锁线时，强制中断并弹一次
      teaches = firstClear ? pendingUnlockTeachings(st, this.levelN) : [];

      if (firstClear) {
        // 首通宝箱：常规轮换（普通关小木箱 / 5 倍数银箱 / 20 倍数金箱 / 200 关后银+金）
        // + 城池 / 章节里程碑额外奖励
        chests = chestsForLevel(this.levelN).map((id) => {
          addChest(st, id, 1);
          return { id, count: chestCount(st, id) };
        });
        // 城池里程碑固定兵种（100 关 3 级元戎弩手 / 200 关 3 级虎豹骑）
        unitRewards = milestoneUnitsAt(this.levelN).map((r) => {
          const added = addUnit(st, r.unit, r.level);
          return { ...r, name: unitName(r.unit, r.level), added: !!added };
        });
        for (const r of unitRewards) {
          if (!r.added) {
            // 兵营满员时不静默吞掉：折算成 1 个金箱，并在结算页说明
            addChest(st, 'gold', 1);
          }
        }
        noteClear(st);
        // 招募券：200 关后每 10 关首通 +1 张（200/210/220…）。
        // 只有已通关至少 1 场英雄战后才发放，避免「一场英雄战没打就囤券」。
        if (Math.max(0, Math.floor(st.heroBattleCleared || 0)) > 0) {
          const scrolls = mainlineScrollReward(this.levelN);
          if (scrolls) {
            addHeroTickets(st, scrolls);
            g.toast(`主线首通奖励：招募券 +${scrolls}`);
          }
        }
        if (this.levelN === CONFIG.heroes.unlockLevel) {
          g.toast('招募系统开放：结算页可领取史诗英雄「关平」');
        }
      }
    }
    const stats = this.battle.statsList();
    const sumPower = (side, engineArmyPower) => {
      const list = stats.filter((s) => s.side === side);
      const army = list.filter((s) => !s.engine).reduce((sum, s) => sum
        + (s.hero ? heroPower(s.hero, s.level, side === 'enemy' ? s.maxHp / Math.max(1, heroStatsFor(s.hero, s.level).hp) : 1)
          : troopPower(s.troop, s.level)), 0);
      const eng = list.filter((s) => s.engine)
        .reduce((sum, s) => sum + enginePower(s.troop, s.level, this.engineStage, army), 0);
      return army + eng;
    };
    const myPower = sumPower('player');
    const enemyPower = sumPower('enemy');
    g.save();
    const result = new ResultScreen(g, {
      win, levelN: this.levelN, coins, firstClear, chests, unitRewards,
      // 第 5 关支援剧情：结算页的宝箱位换成剧情文案
      storyText: this.supportBattle && win ? SUPPORT_RESULT : null,
      storyTitle: this.supportBattle && win ? SUPPORT_TITLE : null,
      // 250 关首通赠关平：结算页领取，防重复由 claimLevelHeroReward 记录
      heroReward: firstClear ? pendingLevelHeroReward(st, this.levelN) : null,
      // 有解锁教学时先中断自动战斗，教学关闭后回到结算页，由玩家手动继续
      pauseAuto: teaches.length > 0,
      stats, myPower, enemyPower, time: this.battle.time,
    });
    if (teaches.length) {
      // 标记为已弹过：同一内容只弹一次
      for (const node of teaches) markUnlockSeen(st, node.id);
      g.save();
      g.go(new UnlockTeachingScreen(g, teaches, {
        after: () => {
          // 教学关闭：本次解锁若含高亮目标之一，回主页高亮对应入口（新字段，老档由 save 兜底）
          const guide = teaches.find((n) => n.id === 'trials' || n.id === 'heroBattle' || n.id === 'gauntlet'
            || n.id === 'weekly' || n.id === 'dailyChallenge' || n.id === 'achievements');
          if (guide) {
            st.guideTarget = guide.id;
            g.save();
          }
          g.go(result); // 仍回到结算页，不跳过奖励结算
        },
      }));
      return;
    }
    g.go(result);
  }

  /* ---------- 输入：拖动看整场（一动手就接管开战镜头），点右上角换倍速 ---------- */
  onDown(x, y) {
    if (hit(this.speedRect, x, y)) {
      if (this.speedLocked) {
        playSfx('error', { volume: 0.7 });
        this.game.toast(`第 ${CONFIG.battle.speedUnlockLevel} 关后开放加速`);
        return;
      }
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
      playSfx('tap', { volume: 0.8 });
      this.game.toast(`${this.speed} 倍速`);
      return;
    }
    // 重来：放弃本场，回到这一关的布阵页调整阵容（序章不给重来，只能打完）
    if (hit(this.retryRect, x, y)) {
      if (this.prologue) return;
      // #dev-only:start
      if (this.dev) { if (this.dev.back) this.dev.back(); return; }
      // #dev-only:end
      playSfx('tap', { volume: 0.8 });
      const g = this.game;
      if (this.gauntlet) {
        // 斩将：本场不算数，回到跑关页（血量 / 阵亡仍是本关开战前的状态）
        g.go(new GauntletScreen(g, { flash: '本场重来：从当前关重新开始' }));
      } else if (this.weekly) {
        g.go(new DeployScreen(g, {
          mode: 'battle', level: engineStageFor('weekly', this.weekly.tier),
          weekly: this.weekly, def: this.def,
        }));
      } else if (this.dailyChallenge) {
        g.go(new DeployScreen(g, {
          mode: 'battle', level: this.dailyChallenge.stage,
          heroBattle: this.heroBattle, dailyChallenge: this.dailyChallenge, def: this.def,
        }));
      } else if (this.heroBattle) {
        g.go(new DeployScreen(g, {
          mode: 'battle', level: this.heroBattle.stage, heroBattle: this.heroBattle, def: this.def,
        }));
      } else if (this.trial) {
        g.go(new DeployScreen(g, {
          mode: 'battle', level: this.trial.stage, trial: this.trial, def: this.trial,
        }));
      } else {
        g.go(new DeployScreen(g, { mode: 'battle', level: this.levelN }));
      }
      return;
    }
    this.camT = 1;   // 玩家自己拖 = 取消开战镜头的自动推进
    this.pan = { x, y, camX: this.cam.x, camY: this.cam.y, moved: false };
  }

  onMove(x, y) {
    if (!this.pan) return;
    if (Math.hypot(x - this.pan.x, y - this.pan.y) > 6) this.pan.moved = true;
    this.cam.x = this.pan.camX;
    this.cam.y = this.pan.camY;
    panCamera(this.cam, x - this.pan.x, y - this.pan.y);
  }

  onUp() {
    this.pan = null;
  }

  draw(ctx) {
    const g = this.game;
    const W = g.W;
    const aliveP = this.battle.aliveCount('player');
    const aliveE = this.battle.aliveCount('enemy');

    // 顶栏
    panel(ctx, 0, 0, W, 118, { fill: 'rgba(12,16,19,0.92)', stroke: THEME.line, r: 0, lw: 0 });
    const heroBoss = this.heroBattle ? heroById(this.heroBattle.hero) : null;
    // 英雄战标题缩短，避免和中间的「我方 / 敌军」人数叠在一起
    text(ctx, this.prologue ? '序章 · 董卓'
      : this.gauntlet ? `斩将 · 第 ${this.gauntlet.stage} 关`
        : this.weekly ? `周常挑战 ${this.weekly.tier}-${this.weekly.stage} 关`
        : this.dailyChallenge ? `每日挑战 ${this.dailyChallenge.stage} 关`
        : this.heroBattle ? `英雄战 ${this.heroBattle.stage} 关`
          : this.trial ? `演武 · 第 ${this.trial.stage} 关` : `第 ${this.levelN} 关`, 44, 56, { size: 30, weight: '600' });
    const hbBossCount = (this.def && this.def.bosses && this.def.bosses.length) || this.heroBattle?.bossCount || 1;
    const hbSquads = (this.def && this.def.squads) || this.heroBattle?.squads || [];
    text(ctx, this.prologue
      ? `董卓精锐 ${this.def.enemies.length} 支 · 敌军 ${this.enemyLvText}`
      : this.weekly
      ? `${this.weekly.tier} 档第 ${this.weekly.stage} 关 · 敌军 ${this.def.enemies.length} 队 · 强度 ${Math.round((this.def.difficulty || 1) * 100)}%`
      : this.dailyChallenge
      ? `${(this.def.bosses || []).map((b) => (heroById(b.hero) || {}).name || b.hero).join(' / ')} · 血量 ×${this.def.hpMult} · ${((this.def.squads) || []).length} 队敌军`
      : this.heroBattle
      ? `${hbBossCount > 1 ? '三英同时登场' : (heroBoss ? heroBoss.name : 'Boss')} · 血量 ×${this.heroBattle.hpMult} · ${hbSquads.length} 队精锐`
      : this.gauntlet ? `${this.def.name} · 敌军 ${this.enemyLvText} · ${this.def.enemies.length} 支`
        : this.trial ? `${this.trial.name} · 敌军 ${this.enemyLvText} · ${this.def.enemies.length} 支`
          : `敌军 ${this.enemyLvText} · ${this.def.enemies.length} 支小队${this.def.heroBoss ? ` · ☠ 英雄BOSS×${this.def.bossCount}` : ''}${this.def.checkpoint ? ` · ★ ${this.def.checkpoint}` : ''}${this.difficulty > 1 ? ` · 强度 ${Math.round(this.difficulty * 100)}%` : ''}`, 44, 88, { size: 19, color: THEME.textDim, maxWidth: 300 });
    text(ctx, '我方', W / 2 - 96, 70, { size: 22, align: 'center', color: THEME.green });
    text(ctx, `${aliveP}`, W / 2 - 54, 68, { size: 34, weight: '700', align: 'center', color: THEME.green });
    text(ctx, ':', W / 2, 68, { size: 28, align: 'center', color: THEME.textDim });
    text(ctx, `${aliveE}`, W / 2 + 36, 68, { size: 34, weight: '700', align: 'center', color: THEME.red });
    text(ctx, '敌军', W / 2 + 96, 70, { size: 22, align: 'center', color: THEME.red });
    // 开战后的顶栏留白：一直显示双方总战力（金色，方便对照这一关的难度）
    text(ctx, `总战力 我方 ${formatPower(this.myPower)} · 敌方 ${formatPower(this.enemyPower)}`, W / 2, 107, {
      size: 15, align: 'center', color: '#f2ce78',
    });
    if (this.speedLocked) {
      // 10 关前：置灰 + 直接写解锁条件，点一下再给一句提示
      button(ctx, this.speedRect, `加速 Lv${CONFIG.battle.speedUnlockLevel}`, {
        size: 19, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak,
      });
    } else {
      button(ctx, this.speedRect, `${this.speed}× 速`, { size: 24, fill: THEME.panel2, stroke: THEME.line });
    }

    // 战场内容裁剪在竞技场视口内：镜头放大后，靠近边缘的兵 / 飘字不会画到顶栏和底部信息条上
    ctx.save();
    ctx.beginPath();
    ctx.rect(ARENA_VIEW.x, ARENA_VIEW.y, ARENA_VIEW.w, ARENA_VIEW.h);
    ctx.clip();
    this.drawArena(ctx);
    // 刘备回血光环画在单位之下：外圈半径与 arena 实际治疗判定半径完全同源
    this.drawHealAuras(ctx);
    this.drawEntities(ctx);
    this.drawEngines(ctx);
    // 火焰圈画在单位之上：地面持续伤害区域必须一眼可见（只画环与火苗，不会挡住兵）
    this.drawFireZones(ctx);
    // 英雄战 Boss：在所有单位之上叠一圈脉动金环，群战里也能一眼锁定
    if (this.heroBattle) this.drawBossMarker(ctx);
    this.drawFx(ctx);
    this.drawShots(ctx);
    this.drawFloats(ctx);
    ctx.restore();
    this.drawHint(ctx);
    if (this.heroBattle) {
      this.drawBossBar(ctx);
      // 输出 / 承伤榜与闯关、演武共用；下移 82px 让开 Boss 血条，互不重叠
      this.drawHud(ctx, 82);
    } else {
      this.drawHud(ctx);
    }
    if (!this.prologue) this.drawRetry(ctx);
    this.drawBottomBar(ctx, aliveP, aliveE);

    // 开场 / 结算文字（都在视口正中）
    const cx = ARENA_VIEW.x + ARENA_VIEW.w / 2;
    if (this.bannerT > 0.3) {
      const a = Math.min(1, this.bannerT / 0.5);
      text(ctx, this.bannerT > 0.85 ? '斗技场开战' : '全军出击', cx, ARENA_VIEW.y + ARENA_VIEW.h / 2, {
        size: 54, weight: '700', align: 'center', color: THEME.gold, alpha: a,
      });
    }
    // 第 5 关剧情：开战横幅淡出后，在屏幕下方播一段幽州突骑支援的旁白
    if (this.supportStoryT > 0 && this.bannerT <= 0.3) {
      const a = Math.min(1, this.supportStoryT / 0.6);
      const by = ARENA_VIEW.y + ARENA_VIEW.h - 250;
      panel(ctx, 46, by, ARENA_VIEW.w - 92, 108, {
        fill: 'rgba(8,12,18,0.93)', stroke: 'rgba(248,225,172,0.78)', r: 20, lw: 2, alpha: a,
      });
      text(ctx, SUPPORT_TITLE, 76, by + 36, {
        size: 26, weight: '700', color: '#ffe0a0', alpha: a,
      });
      text(ctx, SUPPORT_BRIEF, 76, by + 76, {
        size: 19, color: THEME.text, maxWidth: ARENA_VIEW.w - 152, alpha: a,
      });
    }
    if (!this.finished && this.endTimer !== null && this.outcome) {
      panel(ctx, cx - 210, ARENA_VIEW.y + ARENA_VIEW.h / 2 - 66, 420, 132, {
        fill: 'rgba(10,14,20,0.86)', stroke: this.outcome === 'player' ? THEME.goldDim : THEME.redDim, r: 20,
      });
      text(ctx, this.outcome === 'player' ? '胜 利' : this.outcome === 'draw' ? '平 局' : '失 败', cx, ARENA_VIEW.y + ARENA_VIEW.h / 2, {
        size: 54, weight: '700', align: 'center',
        color: this.outcome === 'player' ? THEME.gold : THEME.red,
      });
    }
  }

  drawArena(ctx) {
    const { x, y, w, h } = ARENA_VIEW;
    panel(ctx, x, y, w, h, { fill: '#0d141d', stroke: THEME.line, r: 0, lw: 0 });
    drawArenaField(ctx, this.cam, { theme: this.fieldTheme });
  }

  // 英雄战 Boss 专用：压在所有小兵之上的粗金环（Boss 光环在混战里也不会被挡）
  drawBossMarker(ctx) {
    const bosses = this.battle.entities.filter((e) => e.boss && e.alive);
    for (const boss of bosses) {
      const pos = this.px(boss.x, boss.y);
      const z = this.cam.zoom * depthScale(this.cam, boss.y);
      const r = z * 1.08 * (boss.heroScale || 1.45);
      ctx.save();
      ctx.strokeStyle = boss.heroTier === 'legendary' ? '#ffd873' : '#bfb0cb';
      ctx.globalAlpha = 0.9 + 0.1 * Math.sin(this.idleClock * 3);
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 2, r, r * TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 2, r * 1.1, r * 1.1 * TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 攻城器械：走 render/engineArt.js 的专属建模（木架 + 抛臂 + 配重 / 战鼓 + 号角 + 阵营旗）。
  // 鼓吹先画一圈常驻金色光环；模型按战场缩放（2.7 格高），敌方水平镜像成对向而立。
  drawEngines(ctx) {
    const list = this.battle.engines || [];
    if (!list.length) return;
    const zoom = this.cam.zoom;
    for (const eng of list) {
      if (!eng.alive) continue;                 // 阵亡当帧从战场消失（与 drawEntities 同口径）
      if (eng.engineId === 'drum') {
        // 增益范围可视化：与 auraRadius 伤害判定同源（呼吸 + 虚线流转边界）
        const p0 = this.px(eng.x, eng.y);
        drawAuraRing(ctx, {
          x: p0.x, y: p0.y + 3,
          r: eng.stats.auraRadius * zoom,
          ry: eng.stats.auraRadius * zoom * TILT,
          t: this.idleClock,
        });
      }
      const p = this.px(eng.x, eng.y);
      if (p.y < ARENA_VIEW.y - 120 || p.y > ARENA_VIEW.y + ARENA_VIEW.h + 120) continue;
      const ds = depthScale(this.cam, eng.y);
      drawEngineFigure(ctx, eng.engineId, {
        x: p.x, y: p.y, size: 3.3 * zoom * ds,
        flip: eng.side === 'player', t: this.idleClock,
        color: eng.side === 'player' ? '#6e9b72' : '#c0392b',
        // 霹雳车开火动画进度：0 = 开火当帧（甩臂甩满）→ 1 回摆结束
        fire: eng.engineId === 'thunder'
          ? Math.min(1, (eng.fireT ?? 999) / CONFIG.battle.attackAnimTime) : 0,
      });
      // 器械血条：受伤才显示，与普通兵血条同款
      if (eng.hp < eng.maxHp) {
        const z = zoom * ds;
        const hw = z * 3;
        const bx = p.x - hw / 2;
        const by = p.y + 10;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        roundRectPath(ctx, bx - 1.5, by - 1.5, hw + 3, 8, 4);
        ctx.fill();
        bar(ctx, bx, by, hw, 5, eng.hp / eng.maxHp, {
          fill: eng.side === 'player' ? THEME.green : THEME.red, r: 3, bg: 'rgba(0,0,0,0.65)',
        });
      }
    }
  }

  drawEntities(ctx) {
    const zoom = this.cam.zoom;
    const list = [...this.battle.entities].sort((a, b) => a.y - b.y);
    // 血条统一收集，等单位图层全部画完后再单独画一遍：不会被前排单位遮住
    const unitBars = [];
    const heroBars = [];
    for (const e of list) {
      // 阵亡当帧就从战场消失：不画倒地动画、不留尸体、不留可交互残留
      if (!e.alive) continue;
      // 器械（霹雳车/鼓吹）由 drawEngines 单独绘制：troopById('thunder') 不存在会崩
      if (e.engine) continue;
      const pos = this.px(e.x, e.y);
      // 近大远小：脚底所在纵深的横向缩放（地面被压扁，但立绘竖直站起）
      const ds = depthScale(this.cam, e.y);
      const z = zoom * ds;
      // 英雄将领：模型放大 1.3 倍；普通兵再整体放大一档（SOLDIER_SCALE）
      const spritePx = SPRITE_CELLS * z * (e.heroScale || 1) * (e.hero ? 1 : SOLDIER_SCALE);
      // 视口外的兵直接跳过（拖到敌方半场时省一点开销）
      const pad = spritePx + 20;
      if (pos.y < ARENA_VIEW.y - pad || pos.y > ARENA_VIEW.y + ARENA_VIEW.h + pad) continue;

      const v = this.vis[e.uid] || { action: 'idle', t: 0, phase: 0 };
      const action = v.action;
      const troop = troopById(e.troop);
      const sheet = sheetFor(e.troop, spriteTierFor(e.level));
      let frame;
      if (action === 'idle') {
        frame = currentFrame('idle', frameCount(troop, 'idle'),
          this.idleClock + v.phase, 0.72, { loop: true });
      } else {
        frame = currentFrame(action, frameCount(troop, action),
          v.t, this.durationOf(action), { holdEnd: true });
      }

      // 落点脚标（开战后只有这个小光圈，方框是布阵页才有的位置提示）
      // 地面是斜的，所以光圈是一个压扁的椭圆
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + 2, z * 0.55, z * 0.55 * TILT, 0, 0, Math.PI * 2);
      ctx.fillStyle = e.side === 'player' ? 'rgba(88,160,107,0.35)' : 'rgba(192,85,79,0.3)';
      ctx.fill();
      ctx.restore();

      // 英雄：史诗紫 / 传奇金品级光环（战场上一眼能分出品级）
      if (e.hero) {
        const hcfg = heroById(e.hero);
        drawHeroAura(ctx, e.heroTier || (hcfg && hcfg.tier) || 'epic',
          pos.x, pos.y + 2, spritePx * 0.78, this.idleClock + (v.phase || 0), 1);
      }

      // 增益 / 状态可视化：血怒红光环（加攻）、风环（攻速 / 冲锋 / 突刺）、闪避涟漪、毒泡、冲锋拖影
      this.drawUnitFx(ctx, e, pos, z, 1);

      if (e.hero) {
        drawHeroFigure(ctx, e.hero, {
          x: pos.x, y: pos.y, size: spritePx * (e.heroScale || 1),
          action,
          t: action === 'idle' ? this.idleClock + (v.phase || 0) : (v.t || 0),
          flip: e.side === 'enemy', alpha: 1,
        });
        heroBars.push({ e, x: pos.x, y: pos.y + 10, z });
      } else {
        drawFrame(ctx, sheet, action, Math.max(0, frame), pos.x, pos.y, spritePx / 96, e.side === 'enemy', 1);
        if (e.hp < e.maxHp) unitBars.push({ e, x: pos.x, y: pos.y + 10, z });
      }
    }

    // 普通兵血条先画，英雄血条最后画：三英雄同场时英雄条也不会被小兵血条盖住
    for (const { e, x, y, z } of unitBars) {
      const hw = z * 1.9;
      // 深色衬底：浅色沙地 / 密集单位上也能看清血条边界
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      roundRectPath(ctx, x - hw / 2 - 1.5, y - 1.5, hw + 3, 8, 4);
      ctx.fill();
      bar(ctx, x - hw / 2, y, hw, 5, e.hp / e.maxHp, {
        fill: e.side === 'player' ? THEME.green : THEME.red, r: 3, bg: 'rgba(0,0,0,0.65)',
      });
    }
    for (const { e, x, y, z } of heroBars) this.drawHeroBars(ctx, e, x, y, z);
  }

  // 英雄粗厚分段血条：每 500 点血一段，段间留缝；下面再挂一条技能 CD 读条。
  // 英雄战的 Boss 顶部大血条仍在 drawBossHud 里单独绘制，这里不合并、不覆盖。
  drawHeroBars(ctx, e, cx, topY, z) {
    const segs = heroHpSegmentCount(e.maxHp);
    const hh = Math.max(10, Math.min(15, z * 0.42));
    const hw = Math.max(66, z * 3.1);
    const gap = Math.max(2, hh * 0.18);
    const x = cx - hw / 2;
    const segW = (hw - gap * (segs - 1)) / segs;

    // 血条永远画在单位图层之上；0.9 透明 + 深色底衬，压下人群和浅色沙地也清楚
    ctx.save();
    ctx.globalAlpha = 0.9;
    roundRectPath(ctx, x - 5, topY - 5, hw + 10, hh + 10, (hh + 10) / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    // 外框：深色底 + 金色（我方）/ 暗铜（敌方）描边
    roundRectPath(ctx, x - 2.5, topY - 2.5, hw + 5, hh + 5, (hh + 5) / 2);
    ctx.fillStyle = 'rgba(10,9,8,0.86)';
    ctx.fill();
    ctx.strokeStyle = e.side === 'player' ? 'rgba(238,208,128,0.95)' : 'rgba(224,150,118,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < segs; i++) {
      const sx = x + i * (segW + gap);
      roundRectPath(ctx, sx, topY, segW, hh, Math.min(3, segW / 2));
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();

      const ratio = heroHpSegmentFill(e.hp, e.maxHp, i);
      if (ratio <= 0.001) continue;
      const fw = Math.max(0.5, segW * ratio);
      const grad = ctx.createLinearGradient(0, topY, 0, topY + hh);
      if (e.side === 'player') {
        grad.addColorStop(0, '#9df29a');
        grad.addColorStop(0.5, '#4fc36a');
        grad.addColorStop(1, '#247a44');
      } else {
        grad.addColorStop(0, '#ff9c8c');
        grad.addColorStop(0.5, '#d7544c');
        grad.addColorStop(1, '#7f2420');
      }
      roundRectPath(ctx, sx, topY, fw, hh, Math.min(3, fw / 2));
      ctx.fillStyle = grad;
      ctx.fill();
      // 顶部高光，让厚血条有体积
      ctx.fillStyle = 'rgba(255,255,255,0.24)';
      ctx.fillRect(sx + 1, topY + 1, Math.max(0, fw - 2), Math.max(1, hh * 0.18));
    }

    // 技能 CD 读条：深色轨道 + 金色进度（满 = 就绪），技能发动中则整条高亮
    const cd = heroCooldown(e, this.battle ? this.battle.time : 0);
    if (cd) {
      const chh = Math.max(6, hh * 0.66);
      const cy2 = topY + hh + 5;
      // 外描边 + 深色轨道
      roundRectPath(ctx, x - 1, cy2 - 1, hw + 2, chh + 2, (chh + 2) / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fill();
      roundRectPath(ctx, x, cy2, hw, chh, chh / 2);
      ctx.fillStyle = 'rgba(13,15,21,0.97)';
      ctx.fill();
      // 金色进度
      const cw = Math.max(0, hw * cd.ratio);
      if (cw > 1) {
        const g2 = ctx.createLinearGradient(0, cy2, 0, cy2 + chh);
        if (cd.active) {
          g2.addColorStop(0, '#fff8dd');
          g2.addColorStop(0.5, '#ffd873');
          g2.addColorStop(1, '#c98d22');
        } else {
          g2.addColorStop(0, '#f0d79c');
          g2.addColorStop(0.5, '#d3a84c');
          g2.addColorStop(1, '#96681c');
        }
        roundRectPath(ctx, x, cy2, cw, chh, Math.min(chh / 2, cw / 2));
        ctx.fillStyle = g2;
        ctx.fill();
        // 领先端亮边：读条走到哪一眼可读
        if (cw > 3) {
          ctx.fillStyle = 'rgba(255,252,235,0.92)';
          ctx.fillRect(x + cw - Math.min(2.5, cw), cy2 + 1, Math.min(2.5, cw), chh - 2);
        }
      }
      ctx.strokeStyle = cd.active ? 'rgba(255,236,170,0.85)' : 'rgba(196,166,104,0.5)';
      ctx.lineWidth = 1;
      roundRectPath(ctx, x, cy2, hw, chh, chh / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 单个兵身上的增益 / 状态：
  // 加攻（陷阵、血怒）= 红色脉冲光环；加攻速（龙胆虎威）、冲锋 / 突刺 = 青白风环 + 速度拖影；
  // 闪避（屏卫掩护）= 青色涟漪；中毒（毒矢）= 头顶绿色气泡。
  drawUnitFx(ctx, e, pos, z, alpha) {
    if (!e.alive || alpha <= 0.02) return;
    const t = this.idleClock;
    const phase = (this.vis[e.uid] && this.vis[e.uid].phase) || 0;
    ctx.save();
    ctx.globalAlpha = alpha;

    // 旧光环（血怒 auroAtk / 风环 auraHaste / 闪避 auraDodge）已全部删除
    // 陷阵营改成 selfHeal 每秒回血、虎豹骑/幽州突骑改成 charge3、无当飞军改成 multiArrow 毒矢齐射

    // charge3 冲锋 / 突刺：身后拉出一串速度残影 + 速度线
    if (e.charging3 || e.dashT > 0) {
      const trailColor = e.charging3 ? 'rgba(196,222,255,' : 'rgba(255,224,168,';
      const vx = e.vx || 0;
      const vy = (e.vy || 0) * TILT;
      // 残影（越远越淡、越扁）
      for (let i = 1; i <= 4; i++) {
        const k = i * 0.34;
        const gx = pos.x - vx * z * k;
        const gy = pos.y - vy * z * k;
        ctx.globalAlpha = alpha * (0.5 - i * 0.1);
        ctx.fillStyle = `${trailColor}0.55)`;
        ctx.beginPath();
        ctx.ellipse(gx, gy + 2, z * 0.3 * (1 - i * 0.14), z * 0.3 * (1 - i * 0.14) * TILT, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 速度线：从身后汇聚到脚下
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2.5;
      for (let i = -1; i <= 1; i++) {
        const off = i * z * 0.26;
        const bx = pos.x - vx * z * 1.5 - vy * off * 0.6;
        const by = pos.y - vy * z * 1.5 + vx * off * 0.6;
        ctx.strokeStyle = `${trailColor}0.5)`;
        ctx.beginPath();
        ctx.moveTo(bx, by + 2);
        ctx.lineTo(pos.x - vx * z * 0.2 - vy * off * 0.6, pos.y - vy * z * 0.2 + 2 + vx * off * 0.6);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
    }

    // 中毒：脚底一层绿色毒气 + 头顶冒绿色气泡
    if (e.poison) {
      const glow = ctx.createRadialGradient(pos.x, pos.y - z * 0.25, 2, pos.x, pos.y - z * 0.25, z * 1.0);
      glow.addColorStop(0, 'rgba(110,220,120,0.28)');
      glow.addColorStop(1, 'rgba(110,220,120,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - z * 0.25, z * 1.0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.9 + i * 0.25 + phase) % 1;
        const bx = pos.x + Math.sin((t + i) * 4 + phase) * z * 0.34;
        const by = pos.y - z * 1.2 - k * z * 1.2;
        ctx.globalAlpha = alpha * (1 - k) * 0.9;
        ctx.fillStyle = i % 2 ? '#9cf2a4' : '#6bd97a';
        ctx.beginPath();
        ctx.arc(bx, by, 3 + z * 0.16 * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(50,150,70,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
    }
    ctx.restore();
  }

  // 刘备「仁德之盾」回血光环：淡绿柔边圆环 + 呼吸感（只呼吸透明度，不缩放半径）
  drawHealAuras(ctx) {
    const zoom = this.cam.zoom;
    const t = this.battle.time;
    for (const e of this.battle.entities) {
      if (!e.alive || !e.tr || !e.tr.healAura) continue;
      const p = this.px(e.x, e.y);
      const r = e.tr.healAura.radius * zoom;
      const breath = 0.5 + 0.5 * Math.sin(t * 2.2);
      ctx.save();
      // 柔边填充：中心淡绿、边缘透明
      const grad = ctx.createRadialGradient(p.x, p.y, r * 0.15, p.x, p.y, r);
      grad.addColorStop(0, `rgba(120,220,150,${0.10 + 0.05 * breath})`);
      grad.addColorStop(0.72, `rgba(120,220,150,${0.06 + 0.03 * breath})`);
      grad.addColorStop(1, 'rgba(120,220,150,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 3, r, r * TILT, 0, 0, Math.PI * 2);
      ctx.fill();
      // 外圈描边（柔光）
      ctx.shadowColor = 'rgba(120,220,150,0.8)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = `rgba(120,220,150,${0.45 + 0.2 * breath})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 3, r, r * TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 周瑜「火烧连营」的地面火焰圈：常驻显示，火苗按 battle.time 抖动，消失前 0.6 秒淡出
  drawFireZones(ctx) {
    const zones = this.battle.fireZones || [];
    if (!zones.length) return;
    const zoom = this.cam.zoom;
    const t = this.battle.time;
    for (const z of zones) {
      const p = this.px(z.x, z.y);
      const r = z.radius * zoom;
      const fade = Math.min(1, Math.max(0, (z.left || 0) / 0.6));
      ctx.save();
      // 焦土底色（加深一点，和橘色地面拉开对比）
      ctx.fillStyle = `rgba(46,14,8,${0.34 * fade})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 3, r * 1.04, r * 1.04 * TILT, 0, 0, Math.PI * 2);
      ctx.fill();
      // 外圈火光（饱和红橙，避免和土黄地面糊在一起）
      ctx.strokeStyle = `rgba(255,84,26,${0.95 * fade})`;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 3, r, r * TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 内圈亮焰
      ctx.strokeStyle = `rgba(255,232,150,${0.8 * fade})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 3, r * 0.72, r * 0.72 * TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 沿圆周跳动的火苗
      const n = 10;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + t * 0.7;
        const rr = r * 0.9;
        const fx = p.x + Math.cos(ang) * rr;
        const fy = p.y + Math.sin(ang) * rr * TILT + 3;
        const h = r * (0.42 + 0.18 * Math.sin(t * 11 + i * 1.7));
        const w = r * 0.13;
        ctx.fillStyle = `rgba(255,${130 + Math.round(40 * Math.sin(t * 9 + i))},52,${0.9 * fade})`;
        ctx.beginPath();
        ctx.moveTo(fx - w, fy);
        ctx.lineTo(fx, fy - h);
        ctx.lineTo(fx + w, fy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255,238,170,${0.8 * fade})`;
        ctx.beginPath();
        ctx.moveTo(fx - w * 0.45, fy);
        ctx.lineTo(fx, fy - h * 0.62);
        ctx.lineTo(fx + w * 0.45, fy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 一次性特效（事件驱动）：冲锋撞击的冲击波、毒矢命中的毒雾
  drawFx(ctx) {
    const zoom = this.cam.zoom;
    for (const f of this.fx) {
      const k = Math.min(1, f.t / f.dur);
      const a = 1 - k;
      const pos = this.px(f.wx, f.wy);
      ctx.save();
      if (f.kind === 'impact') {
        const r = zoom * (0.9 + k * 5.2);
        ctx.strokeStyle = `rgba(255,214,140,${0.85 * a})`;
        ctx.lineWidth = 3 * a + 1;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 2, r, r * TILT, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * a})`;
        ctx.lineWidth = 2 * a + 0.5;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 2, r * 0.6, r * 0.6 * TILT, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,240,200,${0.35 * a})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - zoom * 0.6, zoom * (1.1 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (f.kind === 'poison') {
        // 毒矢命中：绿色毒雾炸开（一圈扩散的毒气 + 气泡）
        const r = zoom * (0.5 + k * 2.6);
        ctx.strokeStyle = `rgba(130,230,140,${0.7 * a})`;
        ctx.lineWidth = 3 * a + 1;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 2, r, r * TILT, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const rr = zoom * (0.3 + k * 2.2);
          ctx.globalAlpha = a * 0.9;
          ctx.fillStyle = i % 2 ? '#9cf2a4' : '#6bd97a';
          ctx.beginPath();
          ctx.arc(pos.x + Math.cos(ang) * rr, pos.y - zoom * 0.9 + Math.sin(ang) * rr * TILT - k * 20,
            5 - k * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (f.kind === 'sector') {
        // 关羽扇形劈砍：按世界空间扇角采样后投影，保证和真实判定范围一致（60°/3 格）
        const ang0 = Math.atan2(f.dirY, f.dirX);
        const half = ((f.angle || 60) * Math.PI / 180) / 2;
        const rad = f.radius || 3;
        const steps = 16;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        for (let i = 0; i <= steps; i++) {
          const ang = ang0 - half + (2 * half) * (i / steps);
          const s = this.px(f.wx + Math.cos(ang) * rad, f.wy + Math.sin(ang) * rad);
          ctx.lineTo(s.x, s.y);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(170,255,190,${0.3 * a})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(230,255,235,${0.85 * a})`;
        ctx.lineWidth = 2.6 * a + 0.6;
        ctx.stroke();
        // 刀光：沿扇形中线扫过的一道亮线
        const nowAng = ang0 - half + 2 * half * Math.min(1, k * 1.15);
        const tip = this.px(f.wx + Math.cos(nowAng) * rad, f.wy + Math.sin(nowAng) * rad);
        ctx.strokeStyle = `rgba(255,255,255,${0.75 * a})`;
        ctx.lineWidth = 3 * a + 1;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
      } else if (f.kind === 'ring') {
        // 张飞圆环震地：以自身为圆心的扩散土环 + 扬尘
        const r0 = zoom * (f.radius || 2);
        const r = r0 * (0.2 + k * 0.95);
        // 亮金冲击环 + 内侧暗环，在土黄地面上也能一眼看清
        ctx.strokeStyle = `rgba(255,244,206,${0.98 * a})`;
        ctx.lineWidth = 6 * a + 2;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 2, r, r * TILT, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(120,96,70,${0.55 * a})`;
        ctx.lineWidth = 2 * a + 1;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 2, r * 0.82, r * 0.82 * TILT, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2;
          const rr = r * 0.95;
          ctx.globalAlpha = a * 0.8;
          ctx.fillStyle = '#c8ae86';
          ctx.beginPath();
          ctx.arc(pos.x + Math.cos(ang) * rr, pos.y + Math.sin(ang) * rr * TILT - k * 8,
            4 * (1 - k) + 1, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (f.kind === 'fireBurst') {
        // 火箭落地：橙色火环炸开 + 火星
        const r = zoom * (f.radius || 1) * (0.4 + k * 0.9);
        ctx.strokeStyle = `rgba(255,150,60,${0.9 * a})`;
        ctx.lineWidth = 3 * a + 1;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 2, r, r * TILT, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 9; i++) {
          const ang = (i / 9) * Math.PI * 2 + 0.4;
          const rr = r * (0.5 + k * 1.1);
          ctx.globalAlpha = a;
          ctx.fillStyle = i % 2 ? '#ffb04a' : '#ff7a2a';
          ctx.beginPath();
          ctx.arc(pos.x + Math.cos(ang) * rr, pos.y + Math.sin(ang) * rr * TILT - k * 16,
            3.5 * (1 - k) + 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  drawShots(ctx) {
    for (const s of this.shots) {
      const k = Math.min(1, s.t / s.dur);
      const wx = s.x1 + (s.x2 - s.x1) * k;
      const wy = s.y1 + (s.y2 - s.y1) * k;
      const a = this.px(s.x1, s.y1);
      const b = this.px(s.x2, s.y2);
      const cur = this.px(wx, wy);
      cur.y -= Math.sin(k * Math.PI) * this.cam.zoom * 0.4;
      ctx.save();
      // 毒矢 = 绿色箭（无当飞军的毒），普通箭 = 米白
      ctx.strokeStyle = s.poison ? '#9be08a' : '#e8dcc0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cur.x - 10 * Math.sign(b.x - a.x || 1), cur.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawFloats(ctx) {
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
      const pos = this.px(f.wx, f.wy);
      const y = pos.y - this.cam.zoom * 2.4 - k * 22;
      text(ctx, f.text, pos.x, y, {
        size: f.size || (f.kill ? 24 : 21),
        weight: '700',
        align: 'center',
        color: f.color || (f.kill ? '#ffd479' : '#ff9a86'),
        alpha: Math.max(0, a),
      });
      const sub = f.counter || f.label;
      if (sub) {
        text(ctx, sub, pos.x, y + 18, {
          size: 14, align: 'center',
          color: f.label ? (f.color || THEME.gold) : THEME.gold,
          alpha: Math.max(0, a * 0.85),
        });
      }
    }
  }

  // 视口底部提示：镜头拉远后整场都在屏里，就不必再教「拖动看敌方半场」了
  drawHint(ctx) {
    const y = ARENA_VIEW.y + ARENA_VIEW.h - 26;
    const cx = ARENA_VIEW.x + ARENA_VIEW.w / 2;
    if (camCoversAll(this.cam)) {
      text(ctx, '全场合击 · 每个兵自主寻敌', cx, y, {
        size: 17, align: 'center', color: 'rgba(200,214,232,0.45)',
      });
      return;
    }
    const atTop = camAtTop(this.cam);
    const atBottom = camAtBottom(this.cam);
    const label = atBottom ? '↓ 拖动 · 看敌方半场（左右也可拖）'
      : atTop ? '↑ 拖动 · 回到我方半场（左右也可拖）'
        : '左右 / 上下拖动 · 查看战场全貌';
    text(ctx, label, cx, y, {
      size: 17, align: 'center', color: 'rgba(200,214,232,0.6)',
    });
  }

  // 英雄战 Boss 血条：很粗的一条长条，只显示百分比，不显示具体血量
  drawBossBar(ctx) {
    const bosses = this.battle.entities.filter((e) => e.side === 'enemy' && e.hero && e.boss);
    if (!bosses.length) return;
    const hp = bosses.reduce((sum, e) => sum + Math.max(0, e.hp), 0);
    const maxHp = bosses.reduce((sum, e) => sum + Math.max(1, e.maxHp), 0);
    const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    const boss = bosses[0];
    const hero = heroById(boss.hero);
    const tierColor = boss.heroTier === 'legendary' ? '#b88a32' : '#7556a6';
    const tierName = bosses.length > 1
      ? `三英 · ${bosses.map((e) => (heroById(e.hero) || {}).name || '').join('/')}`
      : `${boss.heroTier === 'legendary' ? '传奇' : '史诗'} · ${hero ? hero.name : 'Boss'}`;
    const x = 24;
    const y = ARENA_VIEW.y + 8;
    const w = this.game.W - 48;
    panel(ctx, x, y, w, 74, { fill: 'rgba(10,14,20,0.88)', stroke: tierColor, r: 16, lw: 2 });
    // Boss 名字用品级色：深色英雄主色在暗面板上看不清，统一按紫 / 金显示
    text(ctx, bosses.length > 1 ? '三英聚首' : (hero ? hero.name : 'Boss'), x + 18, y + 24, {
      size: 24, weight: '700', color: tierColor,
    });
    text(ctx, `BOSS · ${tierName} · 血量 ×${this.heroBattle.hpMult}`, x + 138, y + 24, {
      size: 15, color: tierColor,
    });
    text(ctx, `${Math.round(ratio * 100)}%`, x + w - 18, y + 24, {
      size: 20, weight: '700', align: 'right', color: ratio > 0.25 ? '#ffd9c4' : THEME.red,
    });
    // 很粗的长条：30px 高，横贯屏幕
    bar(ctx, x + 18, y + 36, w - 36, 30, ratio, {
      fill: '#b23a2f', stroke: tierColor, bg: '#1a1114', r: 15,
    });
    // 条内百分比（大字，读得清）
    text(ctx, `${Math.round(ratio * 100)}%`, x + w / 2, y + 51, {
      size: 22, weight: '700', align: 'center', color: '#fff3e6',
    });
  }

  // 战中实时输出榜：左上角我方 Top5、右上角敌方 Top5（半透明覆盖在战场上方）
  drawHud(ctx, topOffset = 0) {
    const W = this.game.W;
    const w = 336;
    const top = ARENA_VIEW.y + 8 + topOffset;
    this.drawHudPanel(ctx, 6, top, w, '我方输出 Top5', this.hudP, THEME.green, 'rgba(88,160,107,0.45)', 'player', this.hudPTotal || 0);
    this.drawHudPanel(ctx, W - 6 - w, top, w, '敌方输出 Top5', this.hudE, '#e0a19a', 'rgba(192,85,79,0.45)', 'enemy', this.hudETotal || 0);
  }

  // 重来键：参考图的圆形刷新图标，放在右侧输出面板正下方（不和面板 / 倍速键重叠）
  drawRetry(ctx) {
    const r = this.retryRect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    ctx.save();
    // 圆形底 + 金色描边
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,11,8,0.8)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = THEME.goldDim;
    ctx.stroke();
    // 顺时针圆箭头（参考图样式）
    ctx.strokeStyle = THEME.gold;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, 15, -Math.PI * 0.72, Math.PI * 0.5);
    ctx.stroke();
    const a = Math.PI * 0.5;
    const tx = cx + Math.cos(a) * 15;
    const ty = cy + Math.sin(a) * 15;
    ctx.fillStyle = THEME.gold;
    ctx.beginPath();
    ctx.moveTo(tx + 7, ty - 2);
    ctx.lineTo(tx - 7, ty - 6);
    ctx.lineTo(tx - 2, ty + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text(ctx, '重来', cx, r.y + r.h + 14, {
      size: 13, align: 'center', color: 'rgba(242,206,120,0.75)',
    });
  }

  drawHudPanel(ctx, x, y, w, title, rows, color, stroke, side, sumTotal) {
    // 开战 / 双方接近阶段还没有任何输出：246px 的空白大板会盖住敌方后排 Boss
    // 和掩护精锐。收成一条窄标题条，等真正有输出数据再展开（重来键位置按展开态固定，不跳动）。
    const h = rows.length ? 246 : 48;
    panel(ctx, x, y, w, h, { fill: 'rgba(15,11,8,0.62)', stroke, r: 12, lw: 1.5 });
    text(ctx, title, x + 12, y + (rows.length ? 20 : h / 2), { size: 18, weight: '600', color });
    if (!rows.length) {
      text(ctx, '暂无输出', x + w - 12, y + h / 2, {
        size: 15, align: 'right', color: 'rgba(200,214,232,0.55)',
      });
      return;
    }
    const sum = sumTotal || rows.reduce((n, r) => n + r.dealt, 0);
    const rowH = 41;
    const rankColors = ['#f8e1ac', '#c0c6d0', '#c87a3d'];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ry = y + 42 + i * rowH;
      const cy = ry + rowH / 2;

      text(ctx, `${i + 1}`, x + 20, cy, { size: 20, weight: '700', align: 'center', color: rankColors[i] || THEME.textWeak });
      // 单个兵牌模型（英雄用专属建模；器械走 engineArt 的器械模型）
      if (r.hero) {
        drawHeroFigure(ctx, r.hero, { x: x + 50, y: ry + rowH - 4, size: 34, action: 'idle', t: 0.4 });
      } else if (r.engine) {
        drawEngineFigure(ctx, r.troop, {
          x: x + 50, y: ry + rowH - 4, size: 34, t: 0.4,
          color: side === 'player' ? '#6e9b72' : '#c0392b',
        });
      } else {
        drawFrame(ctx, sheetFor(r.troop, spriteTierFor(r.level)), 'idle', 0,
          x + 50, ry + rowH - 4, 0.34, false, 0.95);
      }

      const hero = r.hero ? heroById(r.hero) : null;
      const name = r.engine ? engineName(r.troop) : hero ? hero.name : unitName(r.troop, r.level);
      text(ctx, name, x + 74, cy, {
        size: 17, color: hero ? '#d9c4f2' : THEME.text, maxWidth: 104,
      });

      // 柱状条 + 条上百分比
      const pct = sum > 0 ? r.dealt / sum : 0;
      const barX = x + 190;
      const barW = 84;
      const barH = 19;
      bar(ctx, barX, cy - barH / 2, barW, barH, pct, {
        fill: side === 'player' ? THEME.green : THEME.red, stroke: '#36404a', r: 5,
      });
      text(ctx, `${Math.round(pct * 100)}%`, barX + barW / 2, cy, {
        size: 13, weight: '600', align: 'center', color: '#f4efe2',
      });

      text(ctx, `${r.dealt}`, x + w - 10, cy, { size: 18, weight: '700', align: 'right', color: '#f2ce78' });
    }
  }

  drawBottomBar(ctx, aliveP, aliveE) {
    const W = this.game.W;
    const top = ARENA_VIEW.y + ARENA_VIEW.h;
    panel(ctx, 0, top, W, 1334 - top, { fill: 'rgba(12,16,19,0.94)', stroke: THEME.line, r: 0, lw: 0 });
    text(ctx, `${this.battle.time.toFixed(1)} 秒`, 40, top + 42, { size: 22, weight: '600' });
    text(ctx, `我方 ${aliveP} / ${this.totalPlayer}`, 180, top + 42, { size: 21, color: THEME.green });
    text(ctx, `敌军 ${aliveE} / ${this.totalEnemy}`, 380, top + 42, { size: 21, color: '#e0a19a' });
    const line = this.feed[0] || '双方正在接近，准备接敌…';
    text(ctx, `· ${line}`, 40, top + 82, { size: 18, color: THEME.textDim, maxWidth: W - 80 });
  }
}
