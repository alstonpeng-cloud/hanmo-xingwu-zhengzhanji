// 布阵页 = 直接以「斗技场斜 45° 俯视角」布阵（竖版：敌人在上、我方在下）：
// 中间是放大的我方半场（5×5 个上阵位按真实出场坐标摆开），按住画面上下拖动能看到敌方半场；
// 下面只列「未上阵」的兵牌。
// 交互全部是拖拽：拖兵牌到斗技场上的上阵位 = 上阵；拖到别的上阵位 = 换位；
// 拖到同兵种同等级的单位 / 兵牌上 = 合成升级（目标亮绿框）；
// 拖到「不同兵种 / 不同等级」的上阵位 = 交换位置（从卡池拖过去则原单位回到未上阵）；拖回下方列表 = 撤下
// 点兵牌 = 选中后点空位上阵；点上阵位上的单位 = 进详情页
import {
  THEME, text, panel, button, coinBadge, hit, backButton, roundRectPath, infoBadge, infoModal, wrapText,
} from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import {
  levelDef, powerOf, undeployedUnits, autoBattleUnlocked, activeFormation, rosterSlots,
} from '../core/levels.js';
import { chestTotal, openAllChests } from '../core/chests.js';
import { noteChestOpened } from '../core/daily.js';
import { troopPower, formatPower, comparePower } from '../core/power.js';
import { bookBonus, enemyBookBonus } from '../core/books.js';
import {
  heroPower, heroLevel, heroLevelCap, unlockedHeroes, canDeployHero, deployedHeroCount,
  heroDeploySlots, nextHeroSlotLevel,
} from '../core/heroes.js';
import { HEROES, heroById, heroEntryId, heroIdFromEntry, heroStatsFor } from '../data/heroes.js';
import { unitName, spriteTierFor, rarityOf, rarityInfo, baseTroopOf } from '../core/units.js';
import { drawFrame, sheetFor } from '../render/sprites.js';
import { drawHeroFigure, drawHeroAura, heroAuraColor, heroNameColor } from '../render/heroArt.js';
import {
  formationIndex, formationCell, formationSize, emptyFormation, autoPlaceSquads, autoSlotIndexFor, slotToArena,
} from '../core/formation.js';
import { squadSoldierCount, squadSlotOffsets } from '../core/arena.js';
import {
  TILT, makeCamera, camToScreen, panCamera, depthScaleAt, camToWorld,
  setCameraZoom, clampCamera, depthScale,
} from '../render/camera.js';
import { drawArenaField } from '../render/arenaField.js';
import { chapterThemeOfLevel } from '../core/chapters.js';
import { CARD, drawUnitCard, drawUnitGhost } from '../render/unitCard.js';
import { mergeByDrag } from './unitDrag.js';
import { findMergePair, markTutorialSeen, tutorialSeen } from '../core/tutorial.js';
import { playSfx } from '../core/audio.js';
import { UnitDetailScreen } from './unitDetail.js';
import { BattleScreen } from './battle.js';
import { BarracksScreen } from './barracks.js';
import { PROLOGUE_NARRATION, TEACHING_TITLE } from '../data/prologue.js';
import { isTrialUnit, stripTrialFromFormation } from '../core/trialTroop.js';
import { trialMainLevel } from '../data/trials.js';
import {
  engineList, engineChoice, setEngineChoice, engineUnlocked, engineTier,
  engineUpgradeCost, upgradeEngine, enginePower, engineStats, stanceName, engineStageFor, engineName,
  enemyEngineFor, stancePoint,
} from '../core/siege.js';
import { gauntletChapterIndex } from '../data/gauntlet.js';
import { drawEngineFigure, drawAuraRing } from '../render/engineArt.js';
import { ensureWeekly, draftActiveFormation, draftDeployedIds } from '../core/weekly.js';

// 兵牌加大到 164×116 后，一行只放得下 4 张（4*164 + 3*10 = 686 ≤ 714）
const LIST_COLS = 4;
const LIST_ROWS = 2;
const LIST_PER_PAGE = LIST_COLS * LIST_ROWS;

// 兵牌列表的滚动视口：上方是「兵牌 / 英雄」标题，下方是出战按钮
// 高度正好 2 行整卡（2*116 + 6 = 238），底边不留半张卡
const LIST_VIEW = { x: 24, y: 978, w: 702, h: 238 };

// 铜钱千分位（器械面板里显示升级价）
const fmtNum = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// 手势判定（兵牌「拖拽放牌」与列表「上下滑」必须分开，否则两者互相抢手势）：
// 按下后先挂起，等手指移动：
//  - 横向为主（|dx| > horizontal 且 |dx| ≥ |dy| × ratio）= 拿起兵牌去放牌；
//  - 纵向为主 = 上下滑列表；
//  - 一次性滑出列表上沿（拖得够快）= 也当作拿起兵牌；
//  - 原地按住 hold 秒不动 = 直接拿起兵牌（解决「想竖着拖到场上」的歧义）。
// 卡片放大后手势阈值同步放宽：slop 10 / 横向 20 / 滑动 14，避免大卡片误拖或抢滚动
export const LIST_GESTURE = { slop: 10, horizontal: 20, ratio: 1.2, scroll: 14, hold: 0.25 };

// 斗技场面板：竖屏里尽量给高
const ARENA = { x: 36, y: 214, w: 678, h: 656 };
// 上阵位标记：一个框 = 一支小队（盾/枪/骑 Lv1 起 3 人、弓兵 2 人，Lv3/5/8 各 +1，
// 盾/枪/骑 最多 6 人、弓兵最多 5 人，各自独立行动），
// 方框 3.4×3.2 格圈住这 2~4 个小兵（5~6 人时框自动放大一点）；
// 单兵立绘 2.6 格（比战斗页的还大一点 = 布阵时是放大状态）
const SLOT_BOX = { w: 3.4, h: 3.2, spriteCells: 2.6 };

// 布阵是「稍微拉远」的镜头：左右留一点边、再把「敌方前排框 ~ 我方后排框」的整个高度装进面板，
// 这样 5×5 全部上阵位（含 6 人小队放大的框）都完整可见，不会被面板上下边裁掉
const FORM_WIDTH = (CONFIG.formation.rows - 1) * CONFIG.formation.lateralStep;
const ZOOM = ARENA.w / (FORM_WIDTH + 6);     // ≈26.9 px / 格（开战后的全场镜头约 27.9）
const CAM = makeCamera(ARENA, { zoom: ZOOM });
const FORM_TOP = CONFIG.formation.enemyFrontY;                        // 敌方前排脚底
const FORM_BOTTOM = CONFIG.formation.playerFrontY
  + (CONFIG.formation.cols - 1) * CONFIG.formation.depthStep;          // 我方最后一排脚底
// 最高的框 = 6 人小队且离镜头近（纵深缩放最大约 1.05）
const BOX_H_MAX = (SLOT_BOX.h + 0.62 * 0.8) * ZOOM * 1.05;
// 让「最上面框的顶」和「最下面框的底」留一样的边：框向上占的高度要折算回世界格
const CAM_Y0 = Math.max(CAM.minY, Math.min(CAM.maxY,
  (FORM_TOP + FORM_BOTTOM) / 2 + (6 - BOX_H_MAX) / (2 * ZOOM * TILT)));
const SLOT_HIT = 54;                        // 上阵位落点判定半径（横排间距 ~129px）

// 战场空位（我方可放置格）的视觉口径：白色描边 + 微弱填充，一眼看出还能放几个
export const EMPTY_SLOT_STYLE = {
  stroke: 'rgba(245,248,252,0.92)',
  fill: 'rgba(255,255,255,0.10)',
  plus: 'rgba(245,248,252,0.85)',
};

// 布阵页的品级边框配色：普通绿 / 稀有蓝 / 史诗紫 / 传奇金
const RARITY_BORDER = {
  common: THEME.green,
  rare: CONFIG.rarity.rare.color,
  epic: CONFIG.rarity.epic.color,
  legendary: CONFIG.rarity.legendary.color,
};

// '#4a6b82' → 'rgba(91,136,192,0.16)'：给方框 / 光圈按品级上色
function hexToRgba(hex, a) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const LIST_X0 = 32;
const LIST_Y0 = 978;

// 统一兵牌排序：传奇英雄 → 史诗英雄 → 传奇兵种 → 史诗兵种 → 稀有兵种 → 普通兵种
const HERO_CARD_RANK = { legendary: 0, epic: 1 };
const TROOP_CARD_RANK = { legendary: 2, epic: 3, rare: 4, common: 5 };

export function cardRank(card) {
  if (card.kind === 'hero') return HERO_CARD_RANK[card.hero.tier] ?? 1;
  return TROOP_CARD_RANK[rarityOf(card.unit.troop)] ?? 5;
}

// 同档内按当前实际等级降序；等级相同再按名称/ID 兜底
export function compareCards(a, b) {
  const ra = cardRank(a);
  const rb = cardRank(b);
  if (ra !== rb) return ra - rb;
  if (b.level !== a.level) return b.level - a.level;
  const na = a.kind === 'hero' ? a.hero.name : unitName(a.unit.troop, a.unit.level);
  const nb = b.kind === 'hero' ? b.hero.name : unitName(b.unit.troop, b.unit.level);
  if (na !== nb) return na.localeCompare(nb, 'zh-Hans-CN');
  return String(a.uid).localeCompare(String(b.uid));
}

export function sortCards(cards) {
  return [...cards].sort(compareCards);
}

// 布阵格 → 屏幕坐标（和真正开战时 slotToArena 的结果一致，所以看到的就是实际出场位置）
export function deploySlotPoint(index, camY = CAM_Y0, zoom = ZOOM) {
  const { col, row } = formationCell(index);
  const p = slotToArena('player', col, row);
  const s = camToScreen({ view: ARENA, zoom, x: CONFIG.arena.cols / 2, y: camY }, p.x, p.y);
  return { x: s.x, y: s.y, col, row };
}

// 一支小队方框（含 5~6 人放大）在屏幕上的矩形：冒烟测试用它确认「25 个框都完整落在面板里」
export function deploySquadBoxAt(p, size = 6, camY = CAM_Y0, zoom = ZOOM) {
  const cam = { view: ARENA, zoom, x: CONFIG.arena.cols / 2, y: camY };
  const ds = depthScaleAt(cam, p.y);
  // 所有上阵位的方框统一大小（不再按人数变大，避免大小不一）
  const bw = SLOT_BOX.w * zoom * ds;
  const bh = SLOT_BOX.h * zoom * ds;
  return { x: p.x - bw / 2, y: p.y + 6 - bh, w: bw, h: bh };
}

export function deploySlotBox(index, camY = CAM_Y0, zoom = ZOOM) {
  return deploySquadBoxAt(deploySlotPoint(index, camY, zoom), 6, camY, zoom);
}

// 我方可放置的空位（未上阵的格子）：画白框用，也供测试核对「空格数 = 总容量 - 已上阵」
export function emptySlotBoxes(formation, camY = CAM_Y0, zoom = ZOOM) {
  const out = [];
  for (let i = 0; i < formationSize(); i++) {
    if (formation[i]) continue;
    out.push({ index: i, ...deploySlotBox(i, camY, zoom), ...deploySlotPoint(i, camY, zoom) });
  }
  return out;
}

// 按钮文案：必须写清开的是「宝箱」，带数量时保持语义完整
export function openAllLabel(chests) {
  return chests > 0 ? `一键开启宝箱 ${chests}` : '一键开启宝箱';
}

// 布局常量导出给冒烟测试复用，避免坐标写死
export const DEPLOY_LAYOUT = {
  arena: ARENA,
  zoom: ZOOM,
  slotHit: SLOT_HIT,
  list: { x0: LIST_X0, y0: LIST_Y0, cols: LIST_COLS, rows: LIST_ROWS, perPage: LIST_PER_PAGE, view: LIST_VIEW },
  autoRect: { x: 36, y: 880, w: 170, h: 52 },
  clearRect: { x: 212, y: 880, w: 88, h: 52 },
  // 一键开启宝箱：把仓库里的待开宝箱一次全开，开出的兵直接进下方兵牌
  openAllRect: { x: 312, y: 880, w: 196, h: 52 },
  prevRect: { x: 470, y: 946, w: 56, h: 34 },
  nextRect: { x: 664, y: 946, w: 56, h: 34 },
  confirmRect: { x: 175, y: 1228, w: 400, h: 74 },
  autoBattleRect: { x: 592, y: 1218, w: 142, h: 88 },
  barracksRect: { x: 518, y: 880, w: 100, h: 52 },
  // 攻城器械入口（出战按钮左侧）：点开是器械/站位选择面板
  engineRect: { x: 24, y: 1218, w: 142, h: 88 },
  // 器械面板（模态，覆盖兵牌列表）
  enginePanel: { x: 36, y: 690, w: 678, h: 512 },
};

export class DeployScreen {
  constructor(game, opts = {}) {
    this.game = game;
    this.tutorialId = 'deploy';
    this.mode = opts.mode || 'edit';   // 'battle' = 为某关布阵；'edit' = 从首页进来
    this.levelN = opts.level || 1;
    this.trial = opts.trial || null;
    this.heroBattle = opts.heroBattle || null;   // 英雄战：Boss + 两队精锐
    // 每日挑战（1.2.5）：与英雄战同一套 UI 通道，进度与结算独立（同时传 heroBattle def）
    this.dailyChallenge = opts.dailyChallenge || null;
    // 周常挑战（1.2.5）：draft 积分选兵 —— 兵牌与阵型全部读写 state.weekly
    this.weekly = opts.weekly || null;
    if (this.weekly) ensureWeekly(this.game.state);
    this.prologue = opts.prologue === true;      // 序章：董卓压境，必败，首次进入的落地页
    // 引导手册「缩放」重看：从普通布阵页进入，只显示双指缩放提示并做实景教学
    this.replayZoom = opts.replayZoom === true;
    // 斩将场（过 5 关斩 6 将）：复用普通闯关的整块布阵页——兵模型 / 拖拽 / 英雄卡全部一致，
    // 只是「出战」改成开始一次冲锋。回调由 GauntletScreen 提供，两个屏幕互不直接依赖。
    this.gauntletChapter = opts.gauntletChapter || null;
    this.onGauntletConfirm = opts.onGauntletConfirm || null;
    this.def = opts.def || levelDef(this.levelN);
    // 敌方器械（与 BattleScreen 完全同一套生成规则）：主线由 levelDef 写进 def.engine；
    // 演武 / 英雄战 / 斩将按 engineStage() 推算。演武与开战时一样「顶掉最靠后的普通小队」
    // 并把 engine 挂进 def —— def 会原样传给 BattleScreen，保证预览编成 = 实际出战编成。
    // 周常 1~3 档不给敌方器械（只认 def.engine，weeklyLevelDef 已把锚点器械剥掉）；
    // 其余模式按 engineStage() 推算。演武与开战时一样「顶掉最靠后的普通小队」
    // 并把 engine 挂进 def —— def 会原样传给 BattleScreen，保证预览编成 = 实际出战编成。
    this.enemyEngine = this.def.engine
      || (this.weekly
        ? null
        : enemyEngineFor(this.engineStage(), !!(this.heroBattle || this.gauntletChapter)) || null);
    if (this.enemyEngine && !this.def.engine && this.trial
      && this.def.enemies && this.def.enemies.length > 1) {
      let idx = -1;
      let bestCol = -1;
      this.def.enemies.forEach((e, i) => {
        if (e.hero || e.boss) return;
        const col = Number.isFinite(e.col) ? e.col : 0;
        if (col > bestCol) { bestCol = col; idx = i; }
      });
      if (idx >= 0) {
        this.def = {
          ...this.def,
          enemies: this.def.enemies.filter((_, i) => i !== idx),
          engine: this.enemyEngine,
        };
      }
    }
    // 试用兵（战败页广告）只能在主线闯关使用：演武 / 英雄战 / 斩将场一律撤下并置灰
    this.trialBlocked = !!(this.trial || this.heroBattle || this.gauntletChapter);
    if (this.trialBlocked) stripTrialFromFormation(game.state);
    // 战场主题：主线按章节切换；演武 / 英雄战沿用第一章黄沙；斩将按章节主题；序章用董卓的黑红战场
    const gch = this.gauntletChapter
      ? (CONFIG.gauntlet.chapters || []).find((c) => c.id === this.gauntletChapter) : null;
    this.fieldTheme = this.prologue ? 'dongzhuo'
      : gch ? (gch.theme || 'huangjin')
        : this.trial || this.heroBattle || this.weekly ? 'huangjin' : chapterThemeOfLevel(this.levelN);
    this.page = 0;
    this.selected = null;
    this.drag = null;
    this.pan = null;
    this.enginePanel = false;    // 器械 / 站位选择面板是否打开
    this.engineMsg = '';         // 面板内的一次性提示（铜钱不足 / 已满档）
    this.cam = makeCamera(ARENA, { zoom: ZOOM, y: CAM_Y0 });
    this.camBtnRect = { x: ARENA.x + ARENA.w - 152, y: ARENA.y + 12, w: 140, h: 44 };
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.cardRects = [];
    this.scrollY = 0;          // 兵牌列表的滚动偏移（英雄与兵种共用同一个序列）
    this.pending = null;       // 按下兵牌但还没决定「拖拽」还是「上下滑」
    this.listScroll = null;    // 从列表空白处开始的上下滑
    this.heroDetail = null;    // 点开的英雄详情
    this.infoOpen = false;     // 布阵规则详情弹层
    this.infoRect = { x: 548, y: 52, w: 48, h: 48 };
    this.t = 0;
    // 序章：先按顺序点完两段旁白，再出现「教学关卡」和缩放引导；
    // zoomDone 只认玩家真的做出过缩放动作（记录在引导存档里），没有跳过入口。
    this.narration = this.prologue && !this.replayZoom ? 0 : PROLOGUE_NARRATION.length;
    this.teachT = 0;
    this.zoomDone = this.replayZoom
      ? false
      : !this.prologue || tutorialSeen(game.state, 'zoom');
    this.pinching = false;
    this.zoomMin = ZOOM * 0.78;
    this.zoomMax = ZOOM * 1.65;
  }

  // ---- 周常 draft 抽象（1.2.5）----
  // draft 模式下兵牌 / 阵型读写 state.weekly；其余模式读写全局 units / formation。
  // 全部直读 state.units/state.formation 的地方都要经过这三个方法，否则周常模式静默失效。
  draft() {
    return !!this.weekly;
  }

  roster() {
    return this.weekly ? this.game.state.weekly.roster : this.game.state.units;
  }

  setFormation(form) {
    if (this.weekly) this.game.state.weekly.form = form;
    else this.game.state.formation = form;
  }

  undeployed() {
    if (this.weekly) {
      const deployed = draftDeployedIds(this.game.state);
      return this.roster().filter((u) => !deployed.has(u.id));
    }
    return undeployedUnits(this.game.state);
  }

  playerSquads() {
    return this.weekly ? draftActiveFormation(this.game.state) : activeFormation(this.game.state);
  }

  formation() {
    return this.weekly ? this.game.state.weekly.form : this.game.state.formation;
  }

  // 新手引导锚点：出战按钮 / 战场 / 兵牌列表 / 两个可合成的兵牌（场下或场上都算）
  tutorialAnchors() {
    const byId = new Map(this.game.state.units.map((u) => [u.id, u]));
    const cards = [];
    for (const c of this.cardRects) {
      if (c.kind !== 'unit') continue;
      const u = byId.get(c.uid);
      if (u) cards.push({ uid: u.id, troop: u.troop, level: u.level, rect: c.rect });
    }
    const form = this.formation();
    form.forEach((uid, i) => {
      const u = uid ? byId.get(uid) : null;
      if (!u) return;
      cards.push({ uid: u.id, troop: u.troop, level: u.level, rect: deploySlotBox(i, this.cam.y, this.cam.zoom) });
    });
    const pair = findMergePair(this.game.state, cards);
    const emptySlots = emptySlotBoxes(form, this.cam.y, this.cam.zoom);
    return {
      mode: this.mode,
      prologue: this.prologue,
      zoomDone: this.zoomDone,
      confirm: DEPLOY_LAYOUT.confirmRect,
      arena: ARENA,
      // 手势引导直接圈出「白框」（空上阵位）；阵型满了就退回整块战场
      slots: emptySlots.length ? emptySlots : ARENA,
      list: LIST_VIEW,
      grid: ARENA,
      mergePair: pair ? [pair[0].rect, pair[1].rect] : null,
    };
  }

  place(uid, index) {
    const form = this.formation();
    const prev = form.indexOf(uid);
    if (prev >= 0 && prev !== index) form[prev] = null;
    form[index] = uid;
    playSfx('place', { volume: 0.8 });
    this.game.save();
  }

  remove(uid) {
    const form = this.formation();
    const idx = form.indexOf(uid);
    if (idx >= 0) form[idx] = null;
    playSfx('withdraw', { volume: 0.8 });
    this.game.save();
  }

  autoArrange() {
    const g = this.game;
    const sorted = [...this.roster()]
      .filter((u) => !(this.trialBlocked && isTrialUnit(u)))
      .sort((a, b) => powerOf(b) - powerOf(a));
    const placed = autoPlaceSquads(sorted.map((u) => ({ uid: u.id, troop: u.troop })));
    const form = emptyFormation();
    placed.forEach((s) => { form[formationIndex(s.col, s.row)] = s.uid; });
    // 英雄也一起上阵：按战力从高到低，最多当前开放的英雄上阵位（1/2/3），
    // 每名英雄优先放进「自己兵种线」所在的横排（矛英雄找枪兵排、盾英雄找盾兵排…）
    const heroes = [...unlockedHeroes(g.state)]
      .sort((a, b) => heroPower(b.id, heroLevel(g.state, b.id)) - heroPower(a.id, heroLevel(g.state, a.id)))
      .slice(0, heroDeploySlots(g.state));
    let heroCount = 0;
    for (const h of heroes) {
      const idx = this.heroLineSlot(form, h.troop);
      if (idx === null || idx < 0) continue;
      form[idx] = heroEntryId(h.id);
      heroCount++;
    }
    this.setFormation(form);
    this.page = 0;
    playSfx('place', { volume: 0.8 });
    g.save();
    g.toast(heroCount
      ? `已按战力布阵：${placed.length} 个单位 + ${heroCount} 名英雄（按兵种线搭配）`
      : `已按战力布阵：${placed.length} 个单位（近战前排、弓兵后排）`);
  }

  // 英雄按兵种定排（与 autoPlaceSquads 同一套规则）：
  // 远程第 3 排及以后、骑兵第 2 排或最后一排、盾 / 枪第 1 排；找不到规则位才退回任意空位。
  heroLineSlot(form, troop) {
    const idx = autoSlotIndexFor(form, troop);
    return idx >= 0 ? idx : form.findIndex((v) => !v);
  }

  clearAll() {
    this.setFormation(emptyFormation());
    this.selected = null;
    this.page = 0;
    playSfx('withdraw', { volume: 0.8 });
    this.game.save();
    this.game.toast('已清空布阵');
  }

  // 一键开启：仓库里的宝箱一次全开，开出的兵直接进兵营（下方兵牌列表会立刻多出来）
  // 兵牌满了就停下，剩下的箱子留在仓库里，不会静默丢兵
  openAllChests() {
    // 周常 draft：兵牌来自积分商店，宝箱不开进本模式（照常留在仓库里）
    if (this.weekly) {
      this.game.toast('周常挑战用积分选兵，宝箱留到兵营开');
      return;
    }
    const g = this.game;
    const st = g.state;
    const slots = rosterSlots(st.maxCleared);
    const total = chestTotal(st);
    if (!total) {
      playSfx('error', { volume: 0.7 });
      g.toast('没有待开启的宝箱');
      return;
    }
    if (st.units.length >= slots.unlocked) {
      playSfx('error', { volume: 0.7 });
      g.toast(`兵牌已满（${st.units.length}/${slots.unlocked}）：先合成再开箱`);
      return;
    }
    const r = openAllChests(st);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      g.toast('没有可以开启的宝箱');
      return;
    }
    noteChestOpened(st, r.count);
    g.tutorialDone?.('chest');
    g.save();
    playSfx(r.count > 1 ? 'reward' : 'chest');
    const names = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇' };
    const parts = ['rare', 'epic', 'legendary', 'common']
      .filter((k) => r.byRarity[k])
      .map((k) => `${names[k]}×${r.byRarity[k]}`)
      .join(' · ');
    const full = r.reason === 'full' && r.remaining > 0;
    g.toast(`已开启 ${r.count} 个宝箱，获得 ${parts || `${r.count} 个兵`}${full ? `；兵牌已满，还剩 ${r.remaining} 个宝箱` : ''}`);
  }

  confirm() {
    const g = this.game;
    if (!this.formation().some(Boolean)) {
      playSfx('error', { volume: 0.7 });
      g.toast('至少放 1 个单位上场');
      return;
    }
    if (this.gauntletChapter) {
      // 布阵写回全局 formation，冲锋快照由 GauntletScreen 的回调负责；
      // 回调返回 null 表示快照失败（例如一个兵都没上阵），留在布阵页让玩家修正。
      if (this.onGauntletConfirm) this.onGauntletConfirm(g.state);
      return;
    }
    if (this.mode === 'battle') {
      if (this.prologue) {
        // 缩放引导必须真的做出缩放动作才能开战（没有跳过入口）
        if (!this.zoomDone) {
          playSfx('error', { volume: 0.7 });
          g.toast('先双指缩放战场，再开始第一战');
          return;
        }
        markTutorialSeen(g.state, 'zoom');
        markTutorialSeen(g.state, 'merge');
        g.save();
        g.toastText = '';
        g.toastT = 0;
        g.push(new BattleScreen(g, 1, Math.random, { prologue: true, def: this.def }));
        return;
      }
      g.tutorialDone?.('deploy');
      if (this.weekly) {
        g.push(new BattleScreen(g, this.levelN, Math.random, { weekly: this.weekly, def: this.def }));
      } else if (this.dailyChallenge) {
        g.push(new BattleScreen(g, this.levelN, Math.random, {
          heroBattle: this.heroBattle, dailyChallenge: this.dailyChallenge, def: this.def,
        }));
      } else if (this.heroBattle) g.push(new BattleScreen(g, this.levelN, Math.random, { heroBattle: this.heroBattle, def: this.def }));
      else if (this.trial) g.push(new BattleScreen(g, this.levelN, Math.random, { trial: this.trial, def: this.def }));
      else g.push(new BattleScreen(g, this.levelN));
    } else {
      g.save();
      g.toast('布阵已保存');
      g.pop();
    }
  }

  /* ---------- 上阵位命中判定（按当前相机找最近的一个） ---------- */
  toggleCam() {
    const half = CONFIG.arena.rows / 2;
    // 现在看我方半场 → 跳到敌方半场；否则回到我方半场
    this.cam.y = this.cam.y > half ? this.cam.minY : CAM_Y0;
  }

  slotAt(x, y) {
    if (!hit(ARENA, x, y)) return null;
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < formationSize(); i++) {
      const p = deploySlotPoint(i, this.cam.y, this.cam.zoom);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return bestD <= SLOT_HIT ? best : null;
  }

  /* ---------- 兵牌顺序：英雄与兵种混排 ---------- */
  // 传奇英雄 → 史诗英雄 → 传奇兵种 → 史诗兵种 → 稀有兵种 → 普通兵种；
  // 同一档里按「当前实际等级」从高到低（不是品级内部的固定 ID 顺序）。
  buildCards() {
    const st = this.game.state;
    const heroes = unlockedHeroes(st).map((h) => ({
      kind: 'hero', uid: heroEntryId(h.id), id: h.id, hero: h, level: heroLevel(st, h.id),
    }));
    const units = this.undeployed().map((u) => ({
      kind: 'unit', uid: u.id, unit: u, level: u.level,
    }));
    return sortCards([...heroes, ...units]);
  }

  maxScroll() {
    const n = (this.cards || []).length;
    const rows = Math.ceil(n / LIST_COLS);
    const contentH = rows * (CARD.h + CARD.gapY) - CARD.gapY;
    return Math.max(0, contentH - LIST_VIEW.h);
  }

  setScroll(v) {
    this.scrollY = Math.max(0, Math.min(v, this.maxScroll()));
  }

  /* ---------- 指针：按下 → 拖动 / 上下滑 → 抬起 ---------- */
  onDown(x, y) {
    const g = this.game;
    const L = DEPLOY_LAYOUT;
    this.pan = null;
    // 序章旁白：按顺序一段一段点过去，点完才出现「教学关卡」和缩放引导
    if (this.narration < PROLOGUE_NARRATION.length) {
      this.narration += 1;
      if (this.narration >= PROLOGUE_NARRATION.length) this.teachT = 0.001;
      playSfx('tap', { volume: 0.55 });
      return;
    }
    // 英雄详情弹窗：点任意位置关闭
    if (this.heroDetail) { this.heroDetail = null; return; }
    // 器械面板是模态：点面板内处理，点面板外关闭
    if (this.enginePanel) return this.enginePanelDown(x, y);
    if (this.infoOpen) { this.infoOpen = false; return; }
    if (hit(this.infoRect, x, y)) { this.infoOpen = true; return; }
    if (hit(this.backRect, x, y)) return this.prologue ? undefined : g.pop();
    // 布阵里的兵营只用来查阅，整理兵营回首页进（避免布阵时误拖）
    if (hit(L.barracksRect, x, y)) return g.push(new BarracksScreen(g, { viewOnly: true }));
    if (hit(this.camBtnRect, x, y)) return this.toggleCam();
    if (hit(L.autoRect, x, y)) return this.autoArrange();
    if (hit(L.clearRect, x, y)) return this.clearAll();
    if (hit(L.openAllRect, x, y)) return this.openAllChests();
    if (!this.trial && !this.gauntletChapter && !this.heroBattle && !this.weekly
      && hit(L.autoBattleRect, x, y)) return this.toggleAuto();
    if (hit(L.engineRect, x, y)) { this.enginePanel = true; playSfx('tap', { volume: 0.5 }); return; }
    if (hit(L.confirmRect, x, y)) return this.confirm();

    // 兵牌：先挂起，等移动方向决定是「拖拽上阵」还是「上下滑」
    // 只认列表视口内的点：滚动后卡片坐标会上移，视口外的（被裁掉的）卡不能再接住手指
    const inListView = y >= LIST_VIEW.y && y <= LIST_VIEW.y + LIST_VIEW.h;
    const card = inListView ? this.cardRects.find((c) => hit(c.rect, x, y)) : null;
    if (card) {
      if (this.trialBlocked && card.kind === 'unit') {
        const u = this.roster().find((v) => v.id === card.uid);
        if (isTrialUnit(u)) {
          playSfx('error', { volume: 0.7 });
          g.toast('试用兵只能在主线闯关使用');
          return;
        }
      }
      this.pending = { kind: card.kind, id: card.uid, x, y, t: this.t };
      return;
    }
    // 列表空白处：直接上下滑
    if (hit(LIST_VIEW, x, y)) {
      this.listScroll = { y, scrollY: this.scrollY, moved: false };
      return;
    }

    const slot = this.slotAt(x, y);
    if (slot !== null) {
      const uid = this.formation()[slot];
      if (uid) return this.startDrag(uid, 'grid', x, y);
      // 空位：有点选的单位就直接摆上
      if (this.selected) {
        this.place(this.selected, slot);
        g.toast('已上阵');
        this.selected = null;
      }
      return;
    }
    // 按在场地上但没按到上阵位 = 拖动画面看敌方半场
    if (hit(ARENA, x, y)) {
      this.pan = { x, y, camX: this.cam.x, camY: this.cam.y, moved: false };
      return;
    }
    this.selected = null;
  }

  // 双指缩放战场：只改镜头 zoom，所有上阵位 / 命中判定都按当前 zoom 重新算
  onPinch(scale, x, y, phase) {
    if (phase === 'start') {
      this.pinching = true;
      this.pending = null;
      this.drag = null;
      this.pan = null;
      this.listScroll = null;
      return;
    }
    if (phase === 'end') {
      this.pinching = false;
      return;
    }
    if (!Number.isFinite(scale) || scale <= 0) return;
    const before = camToWorld(this.cam, x, y);
    const next = Math.max(this.zoomMin, Math.min(this.zoomMax, this.cam.zoom * scale));
    if (Math.abs(next - this.cam.zoom) < 0.01) return;
    setCameraZoom(this.cam, next);
    // 让手指中心下的战场坐标保持不动，缩放才跟手
    this.cam.y = before.y - (y - ARENA.y - ARENA.h / 2) / (this.cam.zoom * TILT);
    this.cam.x = before.x - (x - ARENA.x - ARENA.w / 2) / (this.cam.zoom * depthScale(this.cam, before.y));
    clampCamera(this.cam);

    // 序章 / 引导手册重看：只有真的把视野缩放到位，才算完成（没有跳过入口）
    // 重看不写存档（引导手册约定：重看不改进度），只结束本次教学
    if ((this.prologue || this.replayZoom) && !this.zoomDone
      && Math.abs(this.cam.zoom / ZOOM - 1) >= 0.06) {
      this.zoomDone = true;
      if (!this.replayZoom) {
        markTutorialSeen(this.game.state, 'zoom');
        this.game.save();
      }
      playSfx('reward', { volume: 0.6 });
      this.game.toast(this.replayZoom ? '缩放教学完成' : '视野已缩放 · 可以开始第一战');
    }
  }

  // 把「挂起的兵牌」真正拿起来：英雄与普通兵走同一条路径（存 'h:id'，落点按 uid 判定）
  liftCard(p, x, y) {
    this.startDrag(p.id, 'pool', p.x, p.y);
    this.drag.x = x;
    this.drag.y = y;
    this.drag.moved = true;
    this.pending = null;
  }

  startDrag(uid, source, x, y) {
    // 试用兵在演武 / 英雄战里不可上阵（列表里也置灰）
    if (this.trialBlocked) {
      const u = this.roster().find((v) => v.id === uid);
      if (isTrialUnit(u)) {
        playSfx('error', { volume: 0.7 });
        this.game.toast('试用兵只能在主线闯关使用');
        this.pending = null;
        return;
      }
    }
    // 从下方兵牌开始拖时，镜头自动回到我方半场，保证 25 个上阵位都在视野里
    if (source === 'pool') this.cam.y = CAM_Y0;
    this.drag = { uid, source, x, y, startX: x, startY: y, moved: false };
    this.selected = null;
  }

  onMove(x, y) {
    if (this.pinching) return;
    if (this.pan) {
      if (Math.hypot(x - this.pan.x, y - this.pan.y) > 6) this.pan.moved = true;
      this.cam.x = this.pan.camX;
      this.cam.y = this.pan.camY;
      panCamera(this.cam, x - this.pan.x, y - this.pan.y);
      return;
    }
    // 已经进入「上下滑列表」
    if (this.listScroll) {
      const dy = this.listScroll.y - y;
      if (Math.abs(dy) > 4) this.listScroll.moved = true;
      this.setScroll(this.listScroll.scrollY + dy);
      return;
    }
    // 按着兵牌还没决定：横向为主 = 拿起兵牌放牌；纵向为主 = 上下滑列表
    if (this.pending && !this.drag) {
      const p = this.pending;
      const dx = x - p.x;
      const dy = y - p.y;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (Math.hypot(dx, dy) <= LIST_GESTURE.slop) return;
      if (ax > LIST_GESTURE.horizontal && ax >= ay * LIST_GESTURE.ratio) {
        this.liftCard(p, x, y);
        return;
      }
      // 一次滑出列表上沿 = 想拖到场上
      if (y < LIST_VIEW.y - 10) {
        this.liftCard(p, x, y);
        return;
      }
      if (ay >= LIST_GESTURE.scroll) {
        this.listScroll = { y: p.y, scrollY: this.scrollY, moved: true };
        this.pending = null;
        this.setScroll(this.scrollY + (p.y - y));
      }
      return;
    }
    if (!this.drag) return;
    this.drag.x = x;
    this.drag.y = y;
    if (Math.hypot(x - this.drag.startX, y - this.drag.startY) > 10) this.drag.moved = true;
  }

  onUp(x, y) {
    if (this.pinching) return;
    if (this.pan) {
      this.pan = null;
      return;
    }
    if (this.listScroll) {
      const s = this.listScroll;
      this.listScroll = null;
      if (!s.moved) this.selected = null;
      return;
    }
    // 兵牌没被拖走 = 轻点：英雄看详情，普通兵切换选中
    if (this.pending && !this.drag) {
      const p = this.pending;
      this.pending = null;
      if (p.kind === 'hero') { this.heroDetail = p.id; return; }
      this.selected = this.selected === p.id ? null : p.id;
      return;
    }
    this.pending = null;
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    const g = this.game;
    // 英雄格：拖到上阵位就占一格，拖回下方列表就撤下，轻点看详情
    // 从场上拖起的英雄也算（source 是 'grid'，需要按 uid 再判一次）
    if (drag.source === 'hero' || heroIdFromEntry(drag.uid)) return this.dropHero(drag, x, y);
    const unit = this.roster().find((u) => u.id === drag.uid);
    if (!unit) return;

    // 没怎么动 = 点击
    if (!drag.moved) {
      if (drag.source === 'pool') {
        this.selected = this.selected === drag.uid ? null : drag.uid;
      } else {
        // draft 模式没有兵牌详情页（w:id 不在全局兵营里），点击只做选中
        if (this.weekly) this.selected = drag.uid;
        else g.push(new UnitDetailScreen(g, drag.uid));
      }
      return;
    }


    const card = this.cardRects.find((c) => hit(c.rect, x, y));
    if (card && card.kind === 'unit') {
      // draft 禁合成：等级只在周常页花积分买，战场上合成会绕过积分消耗
      if (!this.weekly && card.uid !== drag.uid) mergeByDrag(g, card.uid, drag.uid);
      return;
    }

    const slot = this.slotAt(x, y);
    if (slot === null) {
      // 从上阵位拖回下方列表 = 撤下
      if (drag.source === 'grid' && y >= LIST_VIEW.y) {
        this.remove(drag.uid);
        g.toast('已撤下该单位');
      }
      return;
    }
    // 落到上阵位：同兵种同等级 = 合成；不同单位 = 交换位置 / 替换上阵
    const occupant = this.formation()[slot];
    if (occupant && occupant !== drag.uid) {
      const draggedUnit = this.roster().find((u) => u.id === drag.uid);
      const occupantUnit = this.roster().find((u) => u.id === occupant);
      const canMerge = !this.weekly && draggedUnit && occupantUnit
        && draggedUnit.troop === occupantUnit.troop
        && draggedUnit.level === occupantUnit.level
        && draggedUnit.level < CONFIG.merge.maxLevel;
      if (canMerge) {
        mergeByDrag(g, occupant, drag.uid);
        return;
      }
      this.swapOnDrop(drag, slot, occupant);
      return;
    }
    this.place(drag.uid, slot);
    g.toast(drag.source === 'grid' ? '已换位' : '已上阵');
  }

  // 英雄落到上阵位：占 1 格；已有单位则互换；拖回下方列表 = 撤下
  dropHero(drag, x, y) {
    const g = this.game;
    const heroId = heroIdFromEntry(drag.uid);
    const cfg = heroById(heroId);
    if (!drag.moved) {
      this.heroDetail = heroId;
      return;
    }
    const form = this.formation();
    const slot = this.slotAt(x, y);
    if (slot === null) {
      if (y >= LIST_VIEW.y) {
        this.remove(drag.uid);
        g.toast('英雄已撤下');
      }
      return;
    }
    const from = form.indexOf(drag.uid);
    // 最多上阵 3 名英雄：从英雄卡池新拖上场要先检查，超选给明确提示
    // draft 模式的英雄按周常阵型数（不能读全局 formation）
    const draftHeroCount = this.weekly
      ? form.filter((v) => typeof v === 'string' && v.startsWith('h:')).length
      : -1;
    const heroBlocked = this.weekly
      ? from < 0 && draftHeroCount >= heroDeploySlots(g.state)
      : from < 0 && !canDeployHero(g.state, heroId);
    if (heroBlocked) {
      playSfx('error', { volume: 0.7 });
      const slots = heroDeploySlots(g.state);
      const next = nextHeroSlotLevel(g.state);
      const used = this.weekly ? draftHeroCount : deployedHeroCount(g.state);
      g.toast(next
        ? `当前只能上阵 ${slots} 名英雄（已上阵 ${used} 名），第 ${next} 关开放下一个英雄位`
        : `最多同时上阵 ${slots} 名英雄（已上阵 ${used} 名），请先撤下一名`);
      return;
    }
    const occupant = form[slot];
    if (from >= 0 && occupant && occupant !== drag.uid) {
      // 场上的英雄 / 单位互换位置
      form[from] = occupant;
      form[slot] = drag.uid;
    } else if (from >= 0) {
      form[from] = null;
      form[slot] = drag.uid;
    } else {
      form[slot] = drag.uid;   // 从英雄卡池拖来：占掉这个格子
    }
    playSfx('place', { volume: 0.8 });
    g.save();
    g.toast(`${cfg ? cfg.name : '英雄'} 已上阵`);
  }

  // 不同单位落到已有上阵位：地图内互换位置；从卡池拖来则原单位回到未上阵
  // 英雄格和普通兵格同样支持互换（英雄与普通兵牌直接拖拽换位）
  swapOnDrop(drag, slot, occupantId) {
    const g = this.game;
    const form = this.formation();
    const dragged = this.roster().find((u) => u.id === drag.uid);
    const occupantHeroId = heroIdFromEntry(occupantId);
    if (occupantHeroId) {
      const hcfg = heroById(occupantHeroId);
      if (drag.source === 'grid') {
        const from = form.indexOf(drag.uid);
        if (from >= 0 && from !== slot) {
          form[from] = occupantId;
          form[slot] = drag.uid;
          playSfx('place', { volume: 0.8 });
          g.save();
          g.toast(`已互换位置：${unitName(dragged.troop, dragged.level)} ↔ 英雄 ${hcfg ? hcfg.name : ''}`);
          return;
        }
      }
      // 卡池 → 英雄格：英雄撤回兵牌列表，普通兵上阵
      form[slot] = drag.uid;
      playSfx('place', { volume: 0.8 });
      g.save();
      g.toast(`${unitName(dragged.troop, dragged.level)} 替换上阵，英雄 ${hcfg ? hcfg.name : ''} 回到兵牌列表`);
      return;
    }
    const occupant = this.roster().find((u) => u.id === occupantId);
    if (!dragged || !occupant) {
      this.place(drag.uid, slot);
      return;
    }
    if (drag.source === 'grid') {
      const from = form.indexOf(drag.uid);
      if (from < 0 || from === slot) {
        this.place(drag.uid, slot);
        return;
      }
      form[from] = occupantId;
      form[slot] = drag.uid;
      playSfx('place', { volume: 0.8 });
      g.save();
      g.toast(`已交换位置：${unitName(occupant.troop, occupant.level)} ↔ ${unitName(dragged.troop, dragged.level)}`);
      return;
    }
    // 卡池 → 上阵位：被替换的单位自动回到未上阵列表
    form[slot] = drag.uid;
    playSfx('place', { volume: 0.8 });
    g.save();
    g.toast(`${unitName(dragged.troop, dragged.level)} 替换上阵，${unitName(occupant.troop, occupant.level)} 回到未上阵`);
  }

  update(dt) {
    this.t += dt || 0;
    if (this.teachT > 0) this.teachT += dt || 0;
    // 按住兵牌不动超过阈值 = 直接拿起（之后竖着拖到场上也算放牌，不会再被当成滚动）
    const p = this.pending;
    if (p && !this.drag && !this.listScroll && this.t - p.t >= LIST_GESTURE.hold) {
      this.liftCard(p, p.x, p.y);
      this.drag.moved = false;
    }
  }

  // 自动战斗开关（胜利后自动进入下一关，失败即停止；设置存进存档）
  // 主线 30 关后才开放
  toggleAuto() {
    const g = this.game;
    if (!autoBattleUnlocked(g.state)) {
      playSfx('error', { volume: 0.7 });
      g.toast(`自动战斗在主线第 ${CONFIG.autoBattle.unlockLevel} 关通关后开放`);
      return;
    }
    g.state.autoBattle = !g.state.autoBattle;
    g.save();
    g.toast(g.state.autoBattle
      ? '自动战斗已开启：胜利后自动进入下一关，失败即停止'
      : '自动战斗已关闭');
  }

  /* ---------- 场上还能和手里这张牌合成的单位（同兵种、同等级、未满级） ---------- */
  mergeTargets(uid) {
    if (this.weekly) return [];   // draft 禁合成：没有可点的合成目标
    const u = this.game.state.units.find((x) => x.id === uid);
    if (!u || u.level >= CONFIG.merge.maxLevel) return [];
    const byId = new Map(this.game.state.units.map((x) => [x.id, x]));
    const form = this.formation();
    const out = [];
    for (let i = 0; i < formationSize(); i++) {
      const o = form[i];
      if (!o || o === uid) continue;
      const ou = byId.get(o);
      if (ou && ou.troop === u.troop && ou.level === u.level) out.push(i);
    }
    return out;
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const def = this.def;
    const pool = undeployedUnits(st);

    // 顶栏
    panel(ctx, 0, 0, W, 118, { fill: 'rgba(12,16,19,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, this.prologue ? '序章 · 董卓'
      : this.gauntletChapter ? '斩将 · 布阵'
        : this.weekly ? `周常 · ${['壹', '贰', '叁', '肆', '伍'][this.weekly.tier - 1]} 档 · 第 ${this.weekly.stage} 关`
        : this.dailyChallenge ? `每日挑战 · 第 ${this.dailyChallenge.stage} 关`
        : this.heroBattle ? `英雄战 · 第 ${this.heroBattle.stage} 关`
          : this.trial ? `演武 · ${this.trial.name}` : this.mode === 'battle' ? `布阵 · 第 ${this.levelN} 关` : '布阵', W / 2 + 20, 76, {
      size: 34, weight: '600', align: 'center',
    });
    coinBadge(ctx, 700, 76, st.coins, { size: 24, align: 'right' });
    infoBadge(ctx, this.infoRect.x + this.infoRect.w / 2, this.infoRect.y + this.infoRect.h / 2, 19);

    this.drawEnemy(ctx, def, st);
    this.drawArenaView(ctx, def, st);
    this.drawTools(ctx, pool);
    this.cards = this.buildCards();
    this.setScroll(this.scrollY);
    this.drawListHeader(ctx, st);
    this.drawHeroSlots(ctx, st);
    this.drawCardList(ctx, st);
    this.drawHover(ctx, st);
    this.drawFooter(ctx, pool);
    if (this.enginePanel) this.drawEnginePanel(ctx, st);

    // 拖动中的兵牌画在最上层（英雄与普通兵同一套拖拽状态，按 uid 判断画什么）
    if (this.drag) {
      const heroDragId = heroIdFromEntry(this.drag.uid);
      if (heroDragId) {
        drawHeroFigure(ctx, heroDragId, {
          x: this.drag.x, y: this.drag.y + 10, size: 96, action: 'idle', t: this.t, alpha: 0.9,
        });
      } else {
        const unit = this.roster().find((u) => u.id === this.drag.uid);
        if (unit) drawUnitGhost(ctx, unit, this.drag.x, this.drag.y, { tinted: true });
      }
    }
    // 英雄详情（点卡片打开）
    if (this.heroDetail) this.drawHeroDetail(ctx, W);
    if (this.infoOpen) this.drawInfo(ctx, W);
    this.drawPrologueGuide(ctx);
  }

  // 序章引导：下方旁白区（两段按顺序）→ 上方「教学关卡」→ 强制缩放战场
  drawPrologueGuide(ctx) {
    if (!this.prologue && !this.replayZoom) return;
    const W = this.game.W;
    const H = this.game.H;

    // 1) 旁白：一次只显示一段，点一下进入下一段；两段都点完才露出战场教学
    if (this.narration < PROLOGUE_NARRATION.length) {
      ctx.save();
      ctx.fillStyle = 'rgba(3,6,10,0.72)';
      ctx.fillRect(0, 0, W, H);

      const px = 24;
      const py = 982;
      const pw = W - 48;
      const ph = 322;
      panel(ctx, px, py, pw, ph, {
        fill: 'rgba(13,17,24,0.97)', stroke: 'rgba(248,225,172,0.85)', r: 26, lw: 2,
      });
      // 顶部金线 + 「旁白」标签
      ctx.strokeStyle = 'rgba(248,225,172,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 34, py + 58);
      ctx.lineTo(px + pw - 34, py + 58);
      ctx.stroke();
      text(ctx, '旁 白', px + 34, py + 38, { size: 22, weight: '600', color: THEME.goldDim });

      const line = PROLOGUE_NARRATION[this.narration];
      wrapText(ctx, line, px + 34, py + 122, pw - 68, 48, {
        size: 30, weight: '600', color: '#f4ead6',
      });

      // 段落提示点（当前段亮金）
      const dotsX = px + pw / 2;
      for (let i = 0; i < PROLOGUE_NARRATION.length; i++) {
        ctx.beginPath();
        ctx.arc(dotsX + (i - (PROLOGUE_NARRATION.length - 1) / 2) * 26, py + ph - 58, 6, 0, Math.PI * 2);
        ctx.fillStyle = i === this.narration ? THEME.gold : 'rgba(255,255,255,0.22)';
        ctx.fill();
      }
      const pulse = 0.55 + 0.45 * Math.sin(this.t * 4.2);
      ctx.globalAlpha = pulse;
      text(ctx, '轻触继续 ▼', px + pw - 34, py + ph - 30, {
        size: 22, weight: '600', align: 'right', color: THEME.gold,
      });
      ctx.restore();
      return;
    }

    // 2) 旁白点完 → 上方醒目「教学关卡」（占住敌方信息条左侧，缩放完成后再让回信息）
    const k = Math.max(0, Math.min(1, (this.teachT || 0) / 0.28));
    if (k > 0 && !this.zoomDone) {
      ctx.save();
      ctx.globalAlpha = k;
      const bx = 46;
      const by = 128 - (1 - k) * 14;
      const bw = 330;
      const bh = 78;
      roundRectPath(ctx, bx, by, bw, bh, 14);
      ctx.fillStyle = '#0b0f16';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,120,0.95)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      // 左右小菱形装饰
      ctx.fillStyle = '#f8e1ac';
      for (const dx of [8, bw - 8]) {
        ctx.beginPath();
        ctx.moveTo(bx + dx, by + bh / 2);
        ctx.lineTo(bx + dx + 7, by + bh / 2 - 6);
        ctx.lineTo(bx + dx + 14, by + bh / 2);
        ctx.lineTo(bx + dx + 7, by + bh / 2 + 6);
        ctx.closePath();
        ctx.fill();
      }
      text(ctx, TEACHING_TITLE, bx + bw / 2, by + bh / 2 + 2, {
        size: 38, weight: '700', align: 'center', color: '#ffe08a',
      });
      ctx.restore();
    }

    // 3) 缩放引导：必须真的双指缩放战场，没有跳过入口
    if (!this.zoomDone) {
      const px = 150;
      const py = 986;
      const pw = W - 300;
      const ph = 158;
      panel(ctx, px, py, pw, ph, {
        fill: 'rgba(9,12,18,0.99)', stroke: 'rgba(248,225,172,0.72)', r: 22, lw: 2,
      });
      this.drawPinchIcon(ctx, px + 58, py + ph / 2, 1 + 0.06 * Math.sin(this.t * 4));
      text(ctx, '双指缩放战场', px + 106, py + 62, {
        size: 32, weight: '700', color: '#ffe6a3',
      });
      text(ctx, '放大或缩小后才能开战', px + 106, py + 102, {
        size: 20, color: THEME.textDim,
      });
    }
  }

  // 双指缩放的小图标：两根手指 + 向外箭头
  drawPinchIcon(ctx, cx, cy, k = 1) {
    ctx.save();
    const off = 15 * k;
    ctx.strokeStyle = 'rgba(255,224,150,0.95)';
    ctx.fillStyle = 'rgba(255,224,150,0.95)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      const fx = cx + dir * off;
      ctx.beginPath();
      ctx.arc(fx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      // 指向外侧的箭头
      ctx.beginPath();
      ctx.moveTo(fx + dir * 14, cy);
      ctx.lineTo(fx + dir * 28, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx + dir * 28, cy);
      ctx.lineTo(fx + dir * 21, cy - 6);
      ctx.lineTo(fx + dir * 21, cy + 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 布阵规则：页面只留一句动作提示，完整规则收进战场右下角的「!」
  drawInfo(ctx, W) {
    infoModal(ctx, W, this.game.H, '布 阵 说 明', [
      '拖兵牌到白框 = 上阵；拖到另一个上阵位 = 换位。',
      '拖到同兵种同等级的兵上 = 升一级（绿框就是可以合）。',
      '场上的每个框 = 一支小队，挡住敌人前进。',
      '按住画面上下拖动，或点右上角按钮，查看敌方半场。',
    ]);
  }

  /* ---------- 敌方情报 / 布阵说明 ---------- */
  drawEnemy(ctx, def, st) {
    const totalSoldiers = def.enemies.reduce((n, e) => n + squadSoldierCount(e.troop, e.level), 0);
    // 布阵里可能含英雄格：战力按实际出场阵容算（和开战后顶栏口径一致）
    const mySquads = this.playerSquads();
    const myArmyPower = mySquads.reduce((sum, q) => sum + (q.hero ? heroPower(q.hero, q.level) : troopPower(q.troop, q.level)), 0);
    // 器械战力同口径计入（鼓吹按全阵战力 × 增伤 × 覆盖面折算）
    const ech = engineChoice(st);
    const myPower = myArmyPower + (ech ? enginePower(ech.id, ech.tier, this.engineStage(), myArmyPower) : 0);
    // 英雄战的 Boss 带血量倍数，战力必须按 hpMult 算，不能只算普通兵种
    // 难度倍率（卡点 / 50 关后 +10%）由 levelDef 统一给出，战力对比必须同口径，
    // 否则布阵页会低估敌军，玩家按「优势」出战却打不过。
    const difficulty = Number.isFinite(def.difficulty) ? def.difficulty : 1;
    const enemyArmyPower = (this.mode === 'battle'
      ? def.enemies.reduce((sum, q) => sum
        + (q.hero ? heroPower(q.hero, q.level, q.hpMult || 1) : troopPower(q.troop, q.level)), 0)
      : 0);
    const enemyPower = (enemyArmyPower + (def.engine
      ? enginePower(def.engine.id, def.engine.tier, this.engineStage(), enemyArmyPower) : 0)) * difficulty;
    // 兵书同口径：玩家三卷取攻 / 血平均（防御不计入战力口径），敌方按关卡对等加成
    const book = bookBonus(st);
    const myBookMult = 1 + (book.atk + book.hp) / 2;
    const enemyBookMult = 1 + enemyBookBonus(this.engineStage());
    const cmp = comparePower(myPower * myBookMult, enemyPower * enemyBookMult);

    panel(ctx, 36, 128, 678, 78, {
      fill: this.mode === 'battle' ? 'rgba(55,30,30,0.55)' : 'rgba(27,34,39,0.6)',
      stroke: this.mode === 'battle' ? THEME.redDim : THEME.line, r: 16,
    });

    // 战力对比（亮金黄色，放在布阵场地上方，一眼看出这一关能不能打）
    panel(ctx, 494, 134, 204, 66, {
      fill: 'rgba(39,48,56,0.94)', stroke: THEME.gold, r: 14, lw: 2,
    });
    const toneColor = cmp.tone === 'good' ? THEME.green : cmp.tone === 'bad' ? THEME.red : THEME.textDim;
    if (this.mode === 'battle') {
      text(ctx, '我方', 510, 153, { size: 15, color: THEME.textDim });
      text(ctx, formatPower(myPower * myBookMult), 618, 153, { size: 19, weight: '700', align: 'right', color: '#f8e1ac' });
      text(ctx, '敌方', 510, 183, { size: 15, color: THEME.textDim });
      text(ctx, formatPower(enemyPower * enemyBookMult), 618, 183, { size: 19, weight: '700', align: 'right', color: '#f8e1ac' });
      text(ctx, `${cmp.ratioText} ${cmp.label}`, 684, 183, {
        size: 13, align: 'right', color: toneColor, maxWidth: 64,
      });
    } else {
      text(ctx, '阵型战力', 510, 157, { size: 15, color: THEME.textDim });
      text(ctx, formatPower(myPower * myBookMult), 684, 178, { size: 24, weight: '700', align: 'right', color: '#f8e1ac' });
    }

    if (this.mode !== 'battle') {
      text(ctx, '拖兵牌上阵 · 同名同级 = 升级', 62, 174, { size: 22, color: THEME.text, maxWidth: 412 });
      return;
    }
    // 斩将场：情报条写清第 1 关的敌将 + 护卫，规则提示常驻（避免玩家以为能中途换兵）
    if (this.gauntletChapter) {
      const bossNames = (def.bosses && def.bosses.length
        ? def.bosses : def.enemies.filter((e) => e.hero))
        .map((b) => (heroById(b.hero) || {}).name || b.hero).join(' / ') || '敌将';
      const guards = (def.squads || []).length;
      text(ctx, `第 1 关 · ${bossNames} 坐镇 + ${guards} 队护卫`, 62, 160, {
        size: 21, weight: '600', color: '#e0a19a', maxWidth: 420,
      });
      text(ctx, '兵牌阵亡不可复活 · 血量跨关不回复 · 英雄可上阵', 62, 190, {
        size: 17, color: THEME.textDim, maxWidth: 420,
      });
      return;
    }
    // 序章：一句话说明对面是董卓全部精锐，不堆数值
    if (this.prologue) {
      text(ctx, `董卓精锐 ${def.enemies.length} 队 · Lv${def.enemyLevel}~${def.enemyLevelMax}`, 62, 160, {
        size: 22, weight: '600', color: '#e0a19a', maxWidth: 420,
      });
      text(ctx, '盾 弓 枪 骑 · 全兵种登场', 62, 190, {
        size: 18, color: THEME.textDim, maxWidth: 420,
      });
      return;
    }
    // 英雄战：Boss 情报优先，突出「1 英雄 + 多队精锐」
    if (this.dailyChallenge) {
      const def = this.def || {};
      const bosses = def.bosses || [];
      const bossNames = bosses
        .map((b) => (heroById(b.hero) || {}).name || b.hero).join(' / ');
      const bossLv = bosses.length ? Math.min(...bosses.map((b) => b.level)) : 1;
      text(ctx, `${bossNames || '敌将'} Lv${bossLv} · 血量 ×${def.hpMult || 1} · 对标主线 ${def.anchor || this.levelN} 关`, 62, 160, {
        size: 16, color: '#b88a32',
      });
      text(ctx, `站位 ${def.rankText || '敌阵'} · 敌军 ${(def.enemies || []).length} 队（${(def.squads || []).length} 队小队 + ${bosses.length} 将）`, 62, 190, {
        size: 16, color: THEME.text,
      });
      return;
    }
    if (this.heroBattle) {
      const h = heroById(this.heroBattle.hero);
      const tierName = h && h.tier === 'legendary' ? '传奇' : '史诗';
      // 体验序章（1~12 关）的关卡表没有内联 squads，使用 heroBattleDef 生成的精锐列表
      const squads = this.heroBattle.squads || (this.def && this.def.squads) || [];
      const guards = squads
        .slice(0, 3)
        .map((q) => {
          // heroBattle 可能是原始关卡表（squads 为 [兵种, 等级] 数组）或 heroBattleDef（对象）
          const troop = Array.isArray(q) ? q[0] : q.troop;
          const lv = Array.isArray(q) ? q[1] : q.level;
          return `${unitName(troop, lv)} Lv${lv}`;
        }).join(' / ');
      const more = squads.length > 3 ? ` 等 ${squads.length} 队` : '';
      const bossNames = (this.heroBattle.bosses && this.heroBattle.bosses.length > 1)
        ? this.heroBattle.bosses.map((b) => (heroById(b.hero) || {}).name || b.hero).join(' / ')
        : (h ? h.name : '英雄');
      text(ctx, `${tierName} Boss · ${bossNames} Lv${this.heroBattle.heroLevel} · 血量 ×${this.heroBattle.hpMult}`, 62, 160, {
        size: 21, weight: '600', color: '#e8b4a6', maxWidth: 420,
      });
      // 站位规则：Boss 按兵种线分纵深，玩家得据此决定要不要带远程 / 骑兵绕后
      const ranks = def.rankText || (def.enemies || []).filter((e) => e.boss)
        .map((e) => e.rankLabel).filter(Boolean).join(' / ');
      text(ctx, `站位 ${ranks || '第一排'} · 精锐 ${squads.length} 队 ${guards}${more}`, 62, 190, {
        size: 16, color: THEME.textDim, maxWidth: 420,
      });
      return;
    }
    // 兵种按「兵种线」统计（稀有/史诗/传奇兵种也归到 盾/弓/枪/骑），另标出本关混编的特殊兵种数量
    const counts = { shield: 0, archer: 0, spear: 0, cavalry: 0 };
    const special = { rare: 0, epic: 0, legendary: 0 };
    def.enemies.forEach((e) => {
      counts[baseTroopOf(e.troop)]++;
      const r = rarityOf(e.troop);
      if (special[r] !== undefined) special[r]++;
    });
    const specialText = (special.rare || special.epic || special.legendary)
      ? ` · 稀 ${special.rare} / 史 ${special.epic}${special.legendary ? ` / 传 ${special.legendary}` : ''}`
      : '';
    // 卡点 / 分段加压 / 英雄 BOSS：在情报条右侧标出这一关的特殊强度，玩家能预判要不要先回去合成
    const diffTag = def.heroBoss
      ? `☠ 英雄BOSS×${def.bossCount} · ${Math.round(difficulty * 100)}%`
      : def.checkpoint
        ? `★ ${def.checkpoint} · 强度 ${Math.round(difficulty * 100)}%`
        : difficulty > 1 ? `敌军强度 ${Math.round(difficulty * 100)}%` : '';
    text(ctx, `敌 ${def.enemies.length} 队 · ${totalSoldiers} 兵 · Lv${def.enemyLevel}${def.enemyLevelMax > def.enemyLevel ? `~${def.enemyLevelMax}` : ''}`, 62, 160, {
      size: 22, weight: '600', color: '#e0a19a', maxWidth: 420,
    });
    text(ctx, `盾${counts.shield} 弓${counts.archer} 枪${counts.spear} 骑${counts.cavalry}${specialText}`, 62, 190, {
      size: 18, color: THEME.textDim, maxWidth: diffTag ? 286 : 420,
    });
    if (diffTag) {
      text(ctx, diffTag, 480, 190, {
        size: 16, align: 'right', maxWidth: 190,
        color: (def.heroBoss || def.checkpoint) ? THEME.gold : THEME.textWeak,
      });
    }
  }

  /* ---------- 竞技场俯视图（布阵主区域，竖版、可拖动） ---------- */
  drawArenaView(ctx, def, st) {
    const { x, y, w, h } = ARENA;
    const form = this.formation();
    const byId = new Map(this.roster().map((u) => [u.id, u]));

    panel(ctx, x, y, w, h, { fill: '#141c26', stroke: THEME.line, r: 14, lw: 2 });
    drawArenaField(ctx, this.cam, { theme: this.fieldTheme });

    // 敌方站位（只在对战布阵时显示，方便看自己会被谁顶上来）
    if (this.mode === 'battle') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2, y + 2, w - 4, h - 4);
      ctx.clip();
      def.enemies.forEach((e) => {
        const p = this.toScreen(slotToArena('enemy', e.col, e.row));
        const cfg = e.hero ? heroById(e.hero) : null;
        if (cfg) this.drawHeroMark(ctx, cfg, e.level, p, false, true);
        else this.drawSquadMark(ctx, { troop: e.troop, level: e.level, x: p.x, y: p.y }, 'enemy', true);
      });
      ctx.restore();
    }

    // 我方 25 个上阵位
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, w - 4, h - 4);
    ctx.clip();
    for (let i = 0; i < formationSize(); i++) {
      const p = deploySlotPoint(i, this.cam.y, this.cam.zoom);
      const uid = form[i];
      const heroId = uid ? heroIdFromEntry(uid) : null;
      const heroCfg = heroId ? heroById(heroId) : null;
      const unit = uid && !heroCfg ? byId.get(uid) : null;
      const dim = this.drag && this.drag.source === 'grid' && this.drag.uid === uid;

      if (heroCfg) {
        this.drawHeroMark(ctx, heroCfg, heroLevel(st, heroId), p, dim);
      } else if (unit) {
        this.drawSquadMark(ctx, { ...unit, x: p.x, y: p.y }, 'player', false, dim);
      } else {
        const ds = depthScaleAt(this.cam, p.y);
        const bw = SLOT_BOX.w * this.cam.zoom * ds;
        const bh = SLOT_BOX.h * this.cam.zoom * ds;
        const bx = p.x - bw / 2;
        const by = p.y + 6 - bh;
        // 空位 = 白色描边 + 微弱填充（只画我方半场的可放置格，敌方半场不画）
        ctx.save();
        roundRectPath(ctx, bx, by, bw, bh, Math.min(8, this.cam.zoom * 0.2));
        ctx.fillStyle = EMPTY_SLOT_STYLE.fill;
        ctx.fill();
        ctx.strokeStyle = EMPTY_SLOT_STYLE.stroke;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
        text(ctx, '+', p.x, p.y - bh / 2 + 4, {
          size: 15, align: 'center', color: EMPTY_SLOT_STYLE.plus,
        });
      }
    }
    // 器械建模（所有模式都画）：我方按当前出战选择 + 站位，敌方按本关生成规则；
    // 与战斗页 drawEngines 同口径 —— 画在兵模之上、3.3 格 × 纵深缩放
    const myEngine = engineChoice(st);
    if (myEngine) {
      const p = this.toScreen(stancePoint('player', myEngine.stance));
      // 中军鼓吹：布阵时就画增益范围圈（与 auraRadius 伤害判定同源）
      if (myEngine.id === 'drum') {
        const r = engineStats('drum', myEngine.tier, this.engineStage()).auraRadius * this.cam.zoom;
        drawAuraRing(ctx, { x: p.x, y: p.y + 3, r, ry: r * TILT, t: this.t });
      }
      drawEngineFigure(ctx, myEngine.id, {
        x: p.x, y: p.y,
        size: 3.3 * this.cam.zoom * depthScaleAt(this.cam, p.y),
        flip: true, t: this.t, color: '#6e9b72',
      });
    }
    if (this.enemyEngine) {
      const p = this.toScreen(stancePoint('enemy', this.enemyEngine.stance));
      if (this.enemyEngine.id === 'drum') {
        const r = engineStats('drum', this.enemyEngine.tier || 1, this.engineStage()).auraRadius * this.cam.zoom;
        drawAuraRing(ctx, { x: p.x, y: p.y + 3, r, ry: r * TILT, t: this.t });
      }
      drawEngineFigure(ctx, this.enemyEngine.id, {
        x: p.x, y: p.y,
        size: 3.3 * this.cam.zoom * depthScaleAt(this.cam, p.y),
        flip: false, t: this.t, color: '#c0392b',
      });
    }
    // 拖动时：场上所有「能和手里这张牌合成」的小队亮绿框 + 贴「可合成」标签
    if (this.drag) this.drawMergeHints(ctx, form, byId);
    ctx.restore();
    text(ctx, '↑ 前排（先接敌）', x + 16, y + 24, { size: 16, color: THEME.goldDim });
    // 容量提示：放在战场左上角的深色小条上，一眼看出总格数与剩余空位
    const used = form.filter(Boolean).length;
    const totalSlots = formationSize();
    panel(ctx, x + 12, y + 34, 206, 28, {
      fill: 'rgba(16,22,31,0.78)', stroke: 'rgba(255,255,255,0.22)', r: 9, lw: 1,
    });
    text(ctx, `已上阵 ${used}/${totalSlots} · 空位 ${totalSlots - used}`, x + 24, y + 53, {
      size: 15, color: 'rgba(238,244,251,0.96)',
    });
    text(ctx, '↓ 后排', x + 16, y + h - 18, { size: 16, color: THEME.goldDim });
    const atBottom = this.cam.y > CONFIG.arena.rows / 2;
    button(ctx, this.camBtnRect, atBottom ? '看敌方 ↓' : '回我方 ↑', {
      size: 17, fill: 'rgba(18,24,34,0.88)', stroke: THEME.line,
    });
  }

  toScreen(p) {
    return camToScreen(this.cam, p.x, p.y);
  }

  /* ---------- 拖动时提示：场上哪些小队能和手里这张牌合成（不悬停也看得见） ---------- */
  drawMergeHints(ctx, form, byId) {
    const targets = this.mergeTargets(this.drag.uid);
    if (!targets.length) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4.6);
    targets.forEach((i) => {
      const unit = byId.get(form[i]);
      if (!unit) return;
      const p = deploySlotPoint(i, this.cam.y, this.cam.zoom);
      const ds = depthScaleAt(this.cam, p.y);
      const bw = SLOT_BOX.w * this.cam.zoom * ds + 10;
      const bh = SLOT_BOX.h * this.cam.zoom * ds + 10;
      const top = p.y + 6 - bh;

      ctx.save();
      ctx.globalAlpha = 0.45 + 0.55 * pulse;
      ctx.strokeStyle = THEME.green;
      ctx.lineWidth = 2.8;
      ctx.setLineDash([]);
      ctx.strokeRect(p.x - bw / 2, top, bw, bh);
      ctx.restore();

      // 「可合成」小标签贴在框上方
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      roundRectPath(ctx, p.x - 33, top - 24, 66, 19, 8);
      ctx.fillStyle = 'rgba(40,102,63,0.94)';
      ctx.fill();
      ctx.strokeStyle = THEME.green;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      text(ctx, '可合成', p.x, top - 14, { size: 13, align: 'center', color: '#cdf3d7' });
    });
  }

  // 英雄将领在布阵页的标记：专属建模 + 品级光环（史诗紫 / 传奇金）+ 方框
  drawHeroMark(ctx, heroCfg, lv, p, dim, flip = false) {
    const ds = depthScaleAt(this.cam, p.y);
    const bw = SLOT_BOX.w * this.cam.zoom * ds;
    const bh = SLOT_BOX.h * this.cam.zoom * ds;
    const spritePx = SLOT_BOX.spriteCells * this.cam.zoom * ds * 1.1;
    const aura = heroAuraColor(heroCfg);
    ctx.save();
    if (dim) ctx.globalAlpha = 0.45;
    roundRectPath(ctx, p.x - bw / 2, p.y + 6 - bh, bw, bh, Math.min(8, this.cam.zoom * 0.2));
    ctx.strokeStyle = aura;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    drawHeroAura(ctx, heroCfg.tier, p.x, p.y + 2, spritePx * 0.7, 0.8, 0.8);
    drawHeroFigure(ctx, heroCfg.id, {
      x: p.x, y: p.y - bh * 0.05 + spritePx * 0.18, size: spritePx, action: 'idle', t: 0.8, flip,
    });
    ctx.restore();
    text(ctx, heroCfg.name, p.x, p.y + 6 - bh - 12, { size: 15, align: 'center', color: aura });
  }

  // 一个单位（= 一支小队）在俯视图里的标记：
  // 方框（布阵页才有的位置提示）+ 框内 2~6 个独立小兵（站位和开战出生时一致）
  drawSquadMark(ctx, unit, side, ghost = false, dim = false) {
    const sheet = sheetFor(unit.troop, spriteTierFor(unit.level));
    // 斜 45° 视角：近处的兵略大、远处的兵略小（和地面同一个纵深缩放）
    const ds = depthScaleAt(this.cam, unit.y);
    // 所有上阵位方框统一大小；小兵整体缩小，保证不溢出框、不超过中线
    const bw = SLOT_BOX.w * this.cam.zoom * ds;
    const bh = SLOT_BOX.h * this.cam.zoom * ds;
    const spritePx = SLOT_BOX.spriteCells * this.cam.zoom * ds * 0.62;
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.5;

    // 方框颜色 = 品级（我方：普通绿 / 稀有蓝 / 史诗紫 / 传奇金；敌方统一红）
    const rar = side === 'player' ? rarityOf(unit.troop) : null;
    const frameColor = side === 'enemy' ? '#e08278' : (RARITY_BORDER[rar] || THEME.green);
    const footColor = side === 'enemy' ? 'rgba(192,85,79,0.26)' : hexToRgba(frameColor, 0.34);

    // 方框，标出这支小队在斗技场上的位置
    ctx.beginPath();
    const rx = unit.x - bw / 2;
    const ry = unit.y + 6 - bh;
    const r = Math.min(8, this.cam.zoom * 0.2);
    ctx.moveTo(rx + r, ry);
    ctx.lineTo(rx + bw - r, ry);
    ctx.quadraticCurveTo(rx + bw, ry, rx + bw, ry + r);
    ctx.lineTo(rx + bw, ry + bh - r);
    ctx.quadraticCurveTo(rx + bw, ry + bh, rx + bw - r, ry + bh);
    ctx.lineTo(rx + r, ry + bh);
    ctx.quadraticCurveTo(rx, ry + bh, rx, ry + bh - r);
    ctx.lineTo(rx, ry + r);
    ctx.quadraticCurveTo(rx, ry, rx + r, ry);
    ctx.closePath();
    ctx.fillStyle = side === 'enemy' ? 'rgba(192,85,79,0.12)' : hexToRgba(frameColor, 0.13);
    ctx.fill();
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = side === 'player' && rar !== 'common' ? 2.2 : 1.6;
    ctx.stroke();

    // 框里的小兵：有多少人画多少个（站位和开战出生时一致），整体收拢缩小，保证不溢出方框
    const spread = 0.55;
    const baseY = unit.y - bh * 0.26;
    const offsets = squadSlotOffsets(unit.troop, side === 'enemy' ? Math.PI : 0, unit.level)
      .slice()
      .sort((a, b) => a.dy - b.dy);
    for (const o of offsets) {
      const sx = unit.x + o.dx * spread * this.cam.zoom * ds;
      const sy = baseY + o.dy * spread * this.cam.zoom * TILT;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, spritePx * 0.2, spritePx * 0.2 * TILT, 0, 0, Math.PI * 2);
      ctx.fillStyle = footColor;
      ctx.fill();
      drawFrame(ctx, sheet, 'idle', 0, sx, sy, spritePx / 96, side === 'enemy', dim ? 0.4 : 1);
    }
    ctx.restore();

    // 等级：半透明深色圆角底 + 亮色字，保证在任意战场纹理（深色 / 橙色地面）上都清楚
    // 旧版是纯黑字直接压在地面上，深色关卡里几乎看不见（玩家截图反馈）。
    const lx = unit.x - bw / 2 + 4;
    const ly = unit.y + 6 - bh + 3;
    ctx.save();
    if (ghost) ctx.globalAlpha = 0.5;
    if (dim) ctx.globalAlpha = 0.6;
    roundRectPath(ctx, lx, ly, 40, 22, 6);
    ctx.fillStyle = 'rgba(8,12,19,0.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,190,112,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    text(ctx, `Lv${unit.level}`, lx + 6, ly + 11, {
      size: 15, weight: '700', align: 'left',
      color: dim ? 'rgba(236,226,200,0.72)' : '#ffe6a8',
    });
  }

  /* ---------- 中间工具条 ---------- */
  drawTools(ctx, pool) {
    button(ctx, DEPLOY_LAYOUT.autoRect, '按战力布阵', { size: 22, fill: THEME.panel, stroke: THEME.line });
    button(ctx, DEPLOY_LAYOUT.clearRect, '清空', { size: 22, fill: THEME.panel, stroke: THEME.line });
    // 一键开启：没有待开宝箱 / 兵牌已满时置灰，点了会明确提示原因
    const st = this.game.state;
    const chests = chestTotal(st);
    const slots = rosterSlots(st.maxCleared);
    const full = st.units.length >= slots.unlocked;
    const canOpen = chests > 0 && !full;
    button(ctx, DEPLOY_LAYOUT.openAllRect, openAllLabel(chests), {
      size: 20,
      fill: canOpen ? THEME.panel3 : THEME.panel,
      stroke: canOpen ? THEME.gold : THEME.line,
      textColor: canOpen ? THEME.gold : THEME.textWeak,
      disabled: !canOpen,
    });
    const sel = this.selected ? this.roster().find((u) => u.id === this.selected) : null;
    if (this.drag) {
      const n = this.mergeTargets(this.drag.uid).length;
      text(ctx, n ? `可合成 ${n} 个（绿框）` : '拖到上阵位 · 绿框可合成', 706, 906, {
        size: 16, color: n ? THEME.green : THEME.gold, align: 'right', maxWidth: 186,
      });
    } else if (sel) {
      text(ctx, `已选 Lv${sel.level} · 点空位上阵`, 706, 906, {
        size: 16, color: THEME.gold, align: 'right', maxWidth: 186,
      });
    }
  }

  /* ---------- 拖拽悬停反馈：可合成 = 绿框，空位 = 金框，冲突出 = 红框 ---------- */
  drawHover(ctx, st) {
    if (!this.drag) return;
    const target = this.hoverTarget();
    if (!target) return;
    const dragged = this.roster().find((u) => u.id === this.drag.uid);
    if (!dragged) return;

    if (target.type === 'card') {
      const unit = this.roster().find((u) => u.id === target.uid);
      const ok = unit && unit.troop === dragged.troop && unit.level === dragged.level && target.uid !== dragged.id;
      ctx.save();
      ctx.strokeStyle = ok ? THEME.green : THEME.red;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(target.rect.x + 1, target.rect.y + 1, target.rect.w - 2, target.rect.h - 2);
      ctx.restore();
      return;
    }

    const p = deploySlotPoint(target.index, this.cam.y, this.cam.zoom);
    const occupantId = this.formation()[target.index];
    const occupant = occupantId ? this.roster().find((u) => u.id === occupantId) : null;
    const mergeable = occupant && occupant.id !== dragged.id
      && occupant.troop === dragged.troop && occupant.level === dragged.level
      && occupant.level < CONFIG.merge.maxLevel;
    const swap = occupant && !mergeable;
    const color = mergeable ? THEME.green : swap ? THEME.blue : THEME.gold;
    const ds = depthScaleAt(this.cam, p.y);
    const bw = SLOT_BOX.w * this.cam.zoom * ds + 6;
    const bh = SLOT_BOX.h * this.cam.zoom * ds + 6;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(p.x - bw / 2, p.y + 9 - bh, bw, bh);
    ctx.restore();
    const label = mergeable ? '可合成'
      : swap ? (this.drag.source === 'grid' ? '交换位置' : '替换上阵')
        : '上阵';
    text(ctx, label, p.x, p.y + 16 - bh - 8, {
      size: 16, align: 'center', color,
    });
  }

  hoverTarget() {
    const { x, y } = this.drag;
    for (const c of this.cardRects) if (hit(c.rect, x, y)) {
      return { type: 'card', uid: c.uid, rect: c.rect };
    }
    const slot = this.slotAt(x, y);
    if (slot !== null) return { type: 'slot', index: slot };
    return null;
  }

  /* ---------- 统一兵牌列表（英雄 + 普通兵种） ---------- */
  drawListHeader(ctx, st) {
    const L = DEPLOY_LAYOUT;
    const draftHeroes = this.weekly
      ? this.formation().filter((v) => typeof v === 'string' && v.startsWith('h:')).length
      : deployedHeroCount(st);
    text(ctx, `兵牌（英雄位 ${draftHeroes}/${heroDeploySlots(st)} · 已拥有 ${unlockedHeroes(st).length}/${HEROES.length}）`, 44, 964, {
      size: 19, weight: '600', maxWidth: 390,
    });
    // 英雄的招募 / 升级只在首页「英雄」页（200 关解锁）提供，这里不再放入口，避免绕过解锁
    // 兵营入口（合成升阶 / 详情）
    button(ctx, L.barracksRect, '兵 营', { size: 21, fill: THEME.panel, stroke: THEME.line });
  }

  // 英雄上阵位：200 关解锁第 1 格、500 关开第 2 格、1000 关开第 3 格（锁定的格子灰色、不可点）
  drawHeroSlots(ctx, st) {
    const total = CONFIG.heroes.maxDeploy;
    const open = heroDeploySlots(st);
    const w = 70;
    const gap = 4;
    const y = 941;
    const h = 32;
    const x0 = 690 - total * w - (total - 1) * gap;
    for (let i = 0; i < total; i++) {
      const on = i < open;
      // 第 1 格在英雄系统解锁关（200）开放；之后按 slotLevels 的 slots 对应关卡
      const need = i === 0
        ? CONFIG.heroes.unlockLevel
        : (CONFIG.heroes.slotLevels || []).find((s) => s.slots === i + 1)?.level;
      const x = x0 + i * (w + gap);
      panel(ctx, x, y, w, h, {
        fill: on ? 'rgba(48,60,80,0.9)' : 'rgba(17,22,30,0.9)',
        stroke: on ? THEME.goldDim : '#33291a', r: 8, lw: on ? 1.6 : 1.2,
      });
      text(ctx, on ? `英雄位${i + 1}` : (need ? `${need} 关` : '未开放'), x + w / 2, y + h / 2, {
        size: 13, align: 'center', color: on ? THEME.gold : '#6b7684', weight: on ? '600' : '400',
      });
    }
  }

  // 统一兵牌网格：上下可滑动，滚动区域裁剪在 LIST_VIEW 内
  drawCardList(ctx, st) {
    this.cardRects = [];
    const cards = this.cards || [];
    if (!cards.length) {
      // 兵牌全上阵时列表是空的，但不是「没有兵」：文案必须区分，避免误报
      const msg = this.weekly
        ? (this.roster().length ? '已全部上阵 · 拖动上阵位可以调整位置' : '先回周常用积分买兵')
        : st.units.length > 0
          ? '已全部上阵 · 拖动上阵位可以调整位置'
          : '还没有可用兵牌 · 闯关 / 商城可以获得更多兵';
      text(ctx, msg, 375, 1060, {
        size: 22, align: 'center', color: THEME.textDim,
      });
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(LIST_VIEW.x, LIST_VIEW.y, LIST_VIEW.w, LIST_VIEW.h);
    ctx.clip();
    cards.forEach((card, i) => {
      const col = i % LIST_COLS;
      const row = Math.floor(i / LIST_COLS);
      const rect = {
        x: LIST_X0 + col * (CARD.w + CARD.gapX),
        y: LIST_Y0 + row * (CARD.h + CARD.gapY) - this.scrollY,
        w: CARD.w, h: CARD.h,
      };
      if (rect.y + rect.h < LIST_VIEW.y || rect.y > LIST_VIEW.y + LIST_VIEW.h) return;
      this.cardRects.push({ rect, uid: card.uid, kind: card.kind });
      const dragging = this.drag && this.drag.uid === card.uid;
      if (card.kind === 'hero') {
        this.drawHeroMiniCard(ctx, card, rect, st, dragging);
      } else {
        const blockedTrial = this.trialBlocked && isTrialUnit(card.unit);
        drawUnitCard(ctx, card.unit, rect, {
          selected: this.selected === card.uid, alpha: dragging ? 0.4 : blockedTrial ? 0.42 : 1, tinted: true,
        });
      }
    });
    ctx.restore();
    this.drawScrollBar(ctx);
  }

  // 英雄也做成和普通兵牌同尺寸的卡片，混在同一个序列里
  drawHeroMiniCard(ctx, card, rect, st, dragging) {
    const h = card.hero;
    const tierColor = heroAuraColor(h);
    const onGrid = this.formation().includes(card.uid);
    const { x, y, w, h: hh } = rect;
    panel(ctx, x, y, w, hh, { fill: '#1b2227', stroke: tierColor, r: 12, lw: 2 });
    ctx.save();
    ctx.globalAlpha = dragging ? 0.4 : 1;
    // 左上角「将」标记
    ctx.beginPath();
    ctx.arc(x + 19, y + 19, 11, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(tierColor, 0.22);
    ctx.fill();
    ctx.strokeStyle = tierColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    text(ctx, '将', x + 19, y + 25, { size: 14, weight: '700', align: 'center', color: tierColor });
    text(ctx, `Lv${card.level}`, x + w - 8, y + 20, { size: 13, align: 'right', color: tierColor });
    text(ctx, h.name, x + w / 2, y + 36, { size: 18, weight: '600', align: 'center', color: heroNameColor(h), maxWidth: w - 12 });
    text(ctx, h.tier === 'legendary' ? '传奇' : '史诗', x + w / 2, y + 51, {
      size: 12, align: 'center', color: tierColor,
    });
    drawHeroFigure(ctx, h.id, {
      x: x + w / 2, y: y + hh - 1, size: 46, action: 'idle', t: this.t, alpha: 1,
    });
    if (onGrid) {
      panel(ctx, x + w - 50, y + hh - 22, 44, 16, { fill: 'rgba(18,23,27,0.85)', stroke: THEME.goldDim, r: 6, lw: 1 });
      text(ctx, '已上阵', x + w - 28, y + hh - 10, { size: 10, align: 'center', color: THEME.gold });
    }
    ctx.restore();
  }

  // 滚动条：有内容溢出时才显示，滑动时能看出当前位置
  drawScrollBar(ctx) {
    const max = this.maxScroll();
    if (max <= 0) return;
    const x = LIST_VIEW.x + LIST_VIEW.w - 2;
    panel(ctx, x, LIST_VIEW.y + 2, 3, LIST_VIEW.h - 4, { fill: 'rgba(255,255,255,0.07)', stroke: null, r: 2, lw: 0 });
    const ratio = LIST_VIEW.h / (LIST_VIEW.h + max);
    const h = Math.max(26, (LIST_VIEW.h - 4) * ratio);
    const y = LIST_VIEW.y + 2 + (LIST_VIEW.h - 4 - h) * (this.scrollY / max);
    panel(ctx, x - 1, y, 5, h, { fill: 'rgba(232,180,76,0.75)', stroke: null, r: 2.5, lw: 0 });
  }

  // 英雄详情弹窗：显示模型 + 完整数值 + 战法说明
  drawHeroDetail(ctx, W) {
    const h = heroById(this.heroDetail);
    if (!h) return;
    const st = this.game.state;
    const lv = heroLevel(st, h.id);
    const owned = lv > 0;
    const showLv = owned ? lv : 1;
    const s = heroStatsFor(h.id, showLv);

    const tierColor = heroAuraColor(h);
    const tierName = h.tier === 'legendary' ? '传奇' : '史诗';
    panel(ctx, 0, 0, W, 1334, { fill: 'rgba(6,10,16,0.72)', stroke: null, r: 0, lw: 0 });
    panel(ctx, 75, 300, 600, 470, { fill: '#12171b', stroke: tierColor, r: 22, lw: 2 });

    const figH = 150;
    drawHeroAura(ctx, h.tier, 375, 496, figH * 0.75, 0.8, owned ? 0.9 : 0.4);
    drawHeroFigure(ctx, h.id, {
      x: 375, y: 496, size: figH, action: 'idle', t: 1.2, alpha: owned ? 1 : 0.45,
    });
    text(ctx, h.name, 375, 538, { size: 32, weight: '600', align: 'center', color: owned ? heroNameColor(h) : THEME.textWeak });
    text(ctx, owned ? `${tierName} · Lv${lv} / ${heroLevelCap(this.game.state)}` : `${tierName} · 未获得`, 375, 572, {
      size: 18, align: 'center', color: owned ? tierColor : THEME.textWeak,
    });
    text(ctx, h.title, 375, 600, {
      size: 14, align: 'center', color: THEME.textWeak, maxWidth: 520,
    });

    text(ctx, `生命 ${s.hp}    攻击 ${s.atk}    防御 ${s.def}    攻击间隔 ${s.interval} 秒`,
      375, 634, { size: 18, align: 'center', color: THEME.text });
    text(ctx, `战力 ${heroPower(h.id, showLv)}`, 375, 662, {
      size: 17, align: 'center', color: THEME.gold,
    });

    text(ctx, `战法 · ${h.skill.name}`, 110, 696, { size: 17, color: '#d9c4f2' });
    const lines = this.wrapText(h.skill.desc, 22, 2);
    lines.forEach((ln, i) => {
      text(ctx, ln, 110, 722 + i * 20, { size: 14, color: THEME.textDim });
    });
    text(ctx, owned ? '招募 / 升级请到首页「招募系统」页 · 点任意位置关闭' : '去首页「招募系统」页用招募券获得 · 点任意位置关闭',
      375, 752, { size: 13, align: 'center', color: THEME.textWeak });
  }

  // 中文按字数折行
  wrapText(str, perLine, maxLines) {
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
    if (lines.length > 1 && lines[lines.length - 1].length <= 1) {
      lines[lines.length - 2] += lines.pop();
    }
    return lines;
  }

  /* ---------- 攻城器械 ---------- */
  // 器械数值的关卡锚点（与 BattleScreen 同一套映射）
  engineStage() {
    if (this.weekly) return engineStageFor('weekly', this.weekly.tier);
    if (this.dailyChallenge) return engineStageFor('daily', this.dailyChallenge.stage);
    if (this.trial) return Number(this.def.mainLevel) || trialMainLevel(this.levelN);
    if (this.heroBattle) return engineStageFor('hero', this.heroBattle.stage);
    if (this.gauntletChapter) return engineStageFor('gauntlet', gauntletChapterIndex(this.gauntletChapter) + 1);
    return this.levelN;
  }

  engineLayout() {
    const P = DEPLOY_LAYOUT.enginePanel;
    const cards = engineList().map((e, i) => {
      const x = P.x + 16 + i * 340;
      const y = P.y + 78;
      return {
        id: e.id, tier: engineTier(this.game.state, e.id), def: e,
        rect: { x, y, w: 320, h: 236 },
        // 升级按钮收窄到左半边，右边整块留给器械模型
        upRect: { x: x + 16, y: y + 158, w: 190, h: 52 },
      };
    });
    const stances = (CONFIG.siege.stances || []).map((s, i) => ({
      id: s.id, name: s.name,
      rect: { x: P.x + 16 + i * 220, y: P.y + 344, w: 200, h: 62 },
    }));
    const close = { x: P.x + P.w - 108, y: P.y + 14, w: 92, h: 44 };
    return { cards, stances, close };
  }

  drawEngineButton(ctx, st) {
    const r = DEPLOY_LAYOUT.engineRect;
    const ch = engineChoice(st);
    panel(ctx, r.x, r.y, r.w, r.h, {
      fill: 'rgba(27,34,39,0.72)', stroke: ch ? THEME.gold : THEME.line, r: 14, lw: 1,
    });
    const locked = !engineUnlocked(st, 'thunder');
    text(ctx, '器 械', r.x + r.w / 2, r.y + 26, {
      size: 17, weight: '600', align: 'center', color: ch ? THEME.gold : THEME.textDim,
    });
    text(ctx, ch ? `${engineName(ch.id)} ${ch.tier}档` : (locked ? '第 350 关解锁' : '未选择'),
      r.x + r.w / 2, r.y + 52, {
        size: 14, align: 'center', color: ch ? THEME.text : THEME.textWeak, maxWidth: r.w - 14,
      });
    text(ctx, ch ? stanceName(ch.stance) : '点击选择', r.x + r.w / 2, r.y + 72, {
      size: 13, align: 'center', color: THEME.textWeak,
    });
  }

  drawEnginePanel(ctx, st) {
    const P = DEPLOY_LAYOUT.enginePanel;
    const L = this.engineLayout();
    const W = this.game.W;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, this.game.H);
    ctx.restore();
    panel(ctx, P.x, P.y, P.w, P.h, { fill: 'rgba(18,23,27,0.985)', stroke: THEME.line, r: 18, lw: 1 });
    text(ctx, '攻城器械', P.x + 22, P.y + 36, { size: 24, weight: '700', color: THEME.gold });
    text(ctx, '每局只能上阵 1 台 · 唯一装备，不可重复获取', P.x + 22, P.y + 62, {
      size: 14, color: THEME.textWeak,
    });
    button(ctx, L.close, '关闭', { size: 18, fill: THEME.panel, stroke: THEME.line });

    const ch = engineChoice(st);
    const stage = this.engineStage();
    for (const c of L.cards) {
      const unlocked = engineUnlocked(st, c.id);
      const selected = !!(ch && ch.id === c.id);
      const r = c.rect;
      panel(ctx, r.x, r.y, r.w, r.h, {
        fill: selected ? 'rgba(39,48,56,0.92)' : 'rgba(27,34,39,0.8)',
        stroke: selected ? THEME.gold : THEME.line, r: 14, lw: selected ? 2 : 1,
      });
      text(ctx, c.def.name, r.x + 16, r.y + 32, {
        size: 22, weight: '700', color: unlocked ? THEME.text : THEME.textWeak,
      });
      text(ctx, unlocked ? `${c.tier} / ${CONFIG.siege.maxLevel} 档` : `第 ${c.def.unlockLevel} 关解锁`,
        r.x + r.w - 16, r.y + 32, {
          size: 15, align: 'right', color: unlocked ? THEME.gold : THEME.textWeak,
        });
      const s = engineStats(c.id, c.tier, stage);
      const lines = c.id === 'thunder'
        ? [`直击 ${s.direct} · 火圈 ${s.fireDps}/秒`, `冷却 ${s.cooldown.toFixed(1)}s · 半径 ${s.fireRadius.toFixed(1)} 格 · 持续 ${s.fireDuration.toFixed(0)}s`]
        : [`光环 ${s.auraRadius.toFixed(1)} 格 · 增伤 +${Math.round(s.auraDmg * 100)}%`, '常驻不触发 · 站桩不移动'];
      text(ctx, lines[0], r.x + 16, r.y + 70, { size: 15, color: THEME.textDim });
      text(ctx, lines[1], r.x + 16, r.y + 96, { size: 15, color: THEME.textDim });
      text(ctx, c.id === 'thunder' ? '锁最近目标 · 太远前进 / 太近后撤' : '半径内友军伤害提升', r.x + 16, r.y + 124, {
        size: 13, color: THEME.textWeak,
      });
      // 器械模型：站在升级按钮右侧（模型高 90px，脚底与按钮底对齐）
      drawEngineFigure(ctx, c.id, {
        x: r.x + 258, y: r.y + 214, size: 90, t: this.t || 0,
        alpha: unlocked ? 1 : 0.35,
      });
      const cost = engineUpgradeCost(c.id, c.tier);
      const maxed = c.tier >= CONFIG.siege.maxLevel;
      const can = unlocked && !maxed && st.coins >= cost;
      if (!unlocked) {
        button(ctx, c.upRect, '未解锁', {
          size: 18, fill: 'rgba(39,48,56,0.9)', stroke: THEME.line, textColor: 'rgba(230,230,230,0.4)',
        });
      } else if (maxed) {
        button(ctx, c.upRect, '已满档', {
          size: 18, fill: 'rgba(39,48,56,0.9)', stroke: THEME.line, textColor: THEME.textWeak,
        });
      } else {
        button(ctx, c.upRect, `升级 → ${fmtNum(cost)} 铜钱`, {
          size: 18,
          fill: can ? '#273038' : 'rgba(39,48,56,0.9)',
          stroke: can ? THEME.gold : THEME.line,
          textColor: can ? THEME.gold : 'rgba(230,230,230,0.4)',
        });
      }
      text(ctx, selected ? '当前出战' : (unlocked ? '点击卡片切换' : '炮车 / 鼓吹二者择一'), r.x + 16, r.y + 226, {
        size: 12, color: selected ? THEME.gold : THEME.textWeak,
      });
    }

    text(ctx, '站位（不占 5×5 阵位）', P.x + 22, P.y + 330, { size: 16, weight: '600', color: THEME.textDim });
    for (const s of L.stances) {
      const on = !!(ch && ch.stance === s.id);
      button(ctx, s.rect, s.name, {
        size: 20, fill: on ? '#273038' : THEME.panel, stroke: on ? THEME.gold : THEME.line,
        textColor: on ? THEME.gold : THEME.textDim,
      });
    }
    const hint = this.engineMsg || (ch ? '战前可自由切换；进入战斗后锁定' : '先选一台器械，再选站位');
    text(ctx, hint, P.x + 22, P.y + 440, { size: 13, color: this.engineMsg ? THEME.gold : THEME.textWeak });
    text(ctx, '前军打得更远但会挨冲；中军居中；后军只能清冲脸的前排', P.x + 22, P.y + 464, {
      size: 13, color: THEME.textWeak,
    });
    text(ctx, '器械强度跟随关卡自动成长，升级只提供额外增幅', P.x + 22, P.y + 488, {
      size: 13, color: THEME.textWeak,
    });
  }

  enginePanelDown(x, y) {
    const L = this.engineLayout();
    const st = this.game.state;
    const ch = engineChoice(st);
    if (hit(L.close, x, y)) { this.enginePanel = false; return; }
    for (const s of L.stances) {
      if (!hit(s.rect, x, y)) continue;
      if (!ch) { this.engineMsg = '先选择一台器械'; return; }
      setEngineChoice(st, ch.id, s.id);
      this.engineMsg = '';
      playSfx('tap', { volume: 0.5 });
      this.game.save();
      return;
    }
    for (const c of L.cards) {
      if (hit(c.upRect, x, y)) {
        const res = upgradeEngine(st, c.id);
        this.engineMsg = res.ok ? `${c.def.name} 升到 ${res.tier} 档（-${fmtNum(res.cost)} 铜钱）`
          : res.reason === 'max' ? '已经满档'
            : res.reason === 'locked' ? `第 ${c.def.unlockLevel} 关解锁`
              : '铜钱不足';
        if (res.ok) {
          if (!ch) setEngineChoice(st, c.id, 'center');
          this.game.save();
        }
        return;
      }
      if (hit(c.rect, x, y)) {
        if (!engineUnlocked(st, c.id)) { this.engineMsg = `第 ${c.def.unlockLevel} 关解锁`; return; }
        setEngineChoice(st, c.id, ch ? ch.stance : 'center');
        this.engineMsg = '';
        playSfx('tap', { volume: 0.5 });
        this.game.save();
        return;
      }
    }
    // 点面板外关闭
    const P = DEPLOY_LAYOUT.enginePanel;
    if (!hit({ x: P.x, y: P.y, w: P.w, h: P.h }, x, y)) this.enginePanel = false;
  }

  drawFooter(ctx, pool) {
    if (this.prologue) {
      const rect = DEPLOY_LAYOUT.confirmRect;
      if (!this.zoomDone) {
        // 未缩放：按钮置灰，点了也只会提示，不进入下一步
        button(ctx, rect, '先缩放战场', {
          size: 32, fill: '#242830', stroke: 'rgba(255,255,255,0.18)', textColor: 'rgba(230,230,230,0.45)',
        });
        return;
      }
      button(ctx, rect, '开始第一战', {
        size: 32, fill: '#3a2b16', stroke: THEME.gold, textColor: '#ffe6a3',
      });
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
      ctx.save();
      roundRectPath(ctx, rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8, 18);
      ctx.strokeStyle = `rgba(255,216,108,${0.3 + 0.55 * pulse})`;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
      text(ctx, '点这里开始第一战', 375, 1196, {
        size: 26, weight: '600', align: 'center', color: THEME.gold,
      });
      return;
    }
    this.drawEngineButton(ctx, this.game.state);
    button(ctx, DEPLOY_LAYOUT.confirmRect,
      this.gauntletChapter ? '开 始 冲 锋' : this.mode === 'battle' ? '出 战' : '保存布阵', {
        size: 34,
        fill: '#273038', stroke: THEME.goldDim, textColor: THEME.gold,
      });
    if (!this.trial && !this.heroBattle && !this.gauntletChapter && !this.weekly) this.drawAutoBattle(ctx);
    if (this.gauntletChapter) {
      // 自动战斗位换成斩将规则卡，明示「冲锋开始后不能换兵 / 补兵」
      const r = DEPLOY_LAYOUT.autoBattleRect;
      panel(ctx, r.x, r.y, r.w, r.h, { fill: 'rgba(27,34,39,0.72)', stroke: THEME.line, r: 14, lw: 1 });
      text(ctx, '5 关 6 将', r.x + r.w / 2, r.y + 26, { size: 17, weight: '600', align: 'center', color: THEME.gold });
      text(ctx, '一冲到底', r.x + r.w / 2, r.y + 54, { size: 15, align: 'center', color: THEME.textDim });
      text(ctx, '阵亡不复活', r.x + r.w / 2, r.y + 74, { size: 13, align: 'center', color: THEME.textWeak });
    }
    if (this.gauntletChapter) {
      text(ctx, '拖兵牌 / 英雄卡到白框上阵 · 冲锋开始后只能交换阵位', 375, 1324, {
        size: 17, align: 'center', color: THEME.gold,
      });
    } else if (this.trial) {
      text(ctx, '演武：敌方全为精英特殊兵种，按克制与站位智取', 375, 1324, {
        size: 17, align: 'center', color: THEME.textWeak,
      });
    } else if (this.dailyChallenge) {
      text(ctx, '每日挑战：用当前阵容迎战敌方英雄 · 首通铜钱最高 20000', 375, 1324, {
        size: 17, align: 'center', color: THEME.textWeak,
      });
    } else if (this.heroBattle) {
      const hint = this.def.formationHint || '近战第一排 / 骑兵二排 / 远程后排';
      text(ctx, `英雄战：${hint} · 首通每 10 关 +1 招募券`, 375, 1324, {
        size: 17, align: 'center', color: THEME.textWeak,
      });
    } else if (!this.formation().some(Boolean)) {
      text(ctx, '还没放任何单位上场', 375, 1324, { size: 19, align: 'center', color: THEME.red });
    } else if (this.def.checkpoint && !this.trial && !this.heroBattle && !this.prologue) {
      // 卡点：明确告诉玩家这一关是「故意难一点」，并给出可执行的破局动作
      text(ctx, `★ 卡点关 · 敌军强度 ${Math.round((this.def.difficulty || 1) * 100)}% · 可先合成升阶 / 调整阵型再出战`,
        375, 1324, { size: 17, align: 'center', color: THEME.gold });
    } else {
      text(ctx, `场上 ${this.formation().filter(Boolean).length} 支小队 · 未上阵 ${pool.length} 张兵牌`, 375, 1324, {
        size: 18, align: 'center', color: THEME.textWeak,
      });
    }
  }

  // 「自动战斗」开关（摆在出战线右侧）：开了以后胜利自动进下一关，输了就停
  drawAutoBattle(ctx) {
    const r = DEPLOY_LAYOUT.autoBattleRect;
    const unlocked = autoBattleUnlocked(this.game.state);
    const on = unlocked && this.game.state.autoBattle === true;
    panel(ctx, r.x, r.y, r.w, r.h, {
      fill: on ? '#273038' : THEME.panel,
      stroke: on ? THEME.gold : THEME.line,
      r: 14, lw: on ? 2 : 1,
    });
    text(ctx, '自动战斗', r.x + r.w / 2, r.y + 22, {
      size: 17, weight: '600', align: 'center',
      color: on ? THEME.gold : unlocked ? THEME.textDim : THEME.textWeak,
    });
    if (!unlocked) {
      // 未解锁：不画拨钮，只显示解锁条件与当前进度
      text(ctx, `主线 ${CONFIG.autoBattle.unlockLevel} 关开放`, r.x + r.w / 2, r.y + 52, {
        size: 14, align: 'center', color: THEME.textDim,
      });
      text(ctx, `当前 ${Math.max(0, this.game.state.maxCleared || 0)} 关`, r.x + r.w / 2, r.y + 74, {
        size: 12, align: 'center', color: THEME.textWeak,
      });
      return;
    }
    // 小拨钮：开 = 金色靠右，关 = 灰白靠左
    const sw = { x: r.x + r.w / 2 - 26, y: r.y + 38, w: 52, h: 16 };
    roundRectPath(ctx, sw.x, sw.y, sw.w, sw.h, 9);
    ctx.fillStyle = on ? 'rgba(232,180,76,0.85)' : 'rgba(120,136,158,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(on ? sw.x + sw.w - 8 : sw.x + 8, sw.y + sw.h / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = on ? '#fff3d2' : '#c7d2de';
    ctx.fill();
    text(ctx, on ? '胜利自动下一关' : '点击开启', r.x + r.w / 2, r.y + 72, {
      size: 12, align: 'center', color: on ? THEME.goldDim : THEME.textWeak,
    });
  }
}
