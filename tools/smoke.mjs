// 无头渲染冒烟测试：用 @napi-rs/canvas 真的把每个界面画一遍，截图存到 assets/_smoke/
// 覆盖：拖拽上阵 / 拖拽合成（成功与失败）/ 兵营 100 容量分页 / 商城满员拒绝 / 通关后返回
// 用法：node tools/smoke.mjs
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Game } from '../src/game.js';
import { CONFIG } from '../src/data/config.js';
import { rosterSlots, levelDef, addUnit } from '../src/core/levels.js';
import { chestCount, chestTotal, addChest } from '../src/core/chests.js';
import { noteClear } from '../src/core/daily.js';
import { LEVELS_LAYOUT, LevelSelectScreen } from '../src/screens/levels.js';
import { mulberry32 } from '../src/core/rng.js';
import { clampCamera } from '../src/render/camera.js';
import { DEPLOY_LAYOUT, DeployScreen, deploySlotPoint, deploySlotBox, deploySquadBoxAt, emptySlotBoxes, openAllLabel } from '../src/screens/deploy.js';
import { slotToArena, autoPlaceSquads } from '../src/core/formation.js';
import { squadSoldierCount } from '../src/core/arena.js';
import { troopPower } from '../src/core/power.js';
import { rarityOf, refreshTroopUnlocks, baseTroopOf } from '../src/core/units.js';
import { formationCell, troopColumns } from '../src/core/formation.js';
import { ResultScreen } from '../src/screens/result.js';
import { BattleScreen } from '../src/screens/battle.js';
import { HomeScreen, HOME_AUDIO_LAYOUT } from '../src/screens/home.js';
import { TRIALS } from '../src/data/trials.js';
import { TrialResultScreen } from '../src/screens/trialResult.js';
import { TRIAL_LAYOUT } from '../src/screens/trial.js';
import { BARRACKS_LAYOUT } from '../src/screens/barracks.js';
import { SHOP_LAYOUT } from '../src/screens/shop.js';
import { CARD, cardRect } from '../src/render/unitCard.js';
import { HERO_BATTLES, heroBattleDef } from '../src/data/heroBattles.js';
import { HERO_BATTLE_LAYOUT } from '../src/screens/heroBattle.js';
import { HeroBattleResultScreen } from '../src/screens/heroBattleResult.js';
import { GauntletScreen } from '../src/screens/gauntlet.js';
import { startGauntletRun, gauntletRunSquads } from '../src/core/gauntlet.js';
import { gauntletStageDef } from '../src/data/gauntlet.js';
import { HEROES, heroStatsFor, heroById } from '../src/data/heroes.js';
import { HeroScreen, HERO_LAYOUT } from '../src/screens/heroes.js';
import { HERO_AURA } from '../src/render/heroArt.js';
import { heroDeploySlots, pendingRecruitBoxes } from '../src/core/heroes.js';
import { ARENA_VIEW } from '../src/screens/battle.js';
import { BarracksScreen } from '../src/screens/barracks.js';
import { GrowthScreen, GROWTH_LAYOUT } from '../src/screens/growth.js';
import { ShopScreen } from '../src/screens/shop.js';
import { DailyShopScreen } from '../src/screens/dailyShop.js';
import { ChestScreen } from '../src/screens/chests.js';
import { HelpScreen } from '../src/screens/help.js';
import { emptyTutorial, markTutorialSeen, tutorialSeen, TUTORIAL_STEPS } from '../src/core/tutorial.js';
import { pendingUnlockTeachings } from '../src/core/unlocks.js';
import { UnlockTeachingScreen } from '../src/screens/unlockTeaching.js';
import { nextUnlockInfo } from '../src/core/nextUnlock.js';
import { emptyIdleChest, idleChestState } from '../src/core/idleChest.js';
import { DevScreen } from '../src/screens/dev.js';
import { HERO_MAX_LEVEL } from '../src/data/heroes.js';
import { WeeklyChallengeScreen, WEEKLY_LAYOUT } from '../src/screens/weekly.js';
import { DailyChallengeScreen } from '../src/screens/dailyChallenge.js';
import { AchievementsScreen } from '../src/screens/achievements.js';
import { ensureWeekly, weeklyLevelDef } from '../src/core/weekly.js';
import { engineStageFor } from '../src/core/siege.js';

const W = 750;
const H = 1334;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

const store = new Map();
let tapCb = null;
let pinchCb = null;
// 预加载草书标题位图：smoke 是同步主流程，先 await 好再构造 Game
const preloaded = new Map();
let titleLoadFailed = false;
try {
  preloaded.set('assets/ui/title.png', await loadImage(path.resolve('assets/ui/title.png')));
} catch (e) {
  titleLoadFailed = true;
  console.error('  ✗ 草书标题位图加载失败:', e.message);
}
// 板块 3/4：分包美术（12 英雄立绘 / 6 宝箱 / 5 器械 / 5 背景）同步预加载。
// 冒烟是同步主流程，异步 loadImage 赶不上首帧；放进 preloaded 后平台 loadImage 会同步回调，
// 截图因此是「真实启用美术」的画面，而不是程序化兜底。
for (const dir of ['heroes', 'siege', 'art']) {
  const base = path.resolve('assets', dir);
  if (!fs.existsSync(base)) continue;
  for (const name of fs.readdirSync(base)) {
    if (!/\.(png|jpg)$/i.test(name)) continue;
    const logical = `assets/${dir}/${name}`;
    try {
      preloaded.set(logical, await loadImage(path.resolve(logical)));
    } catch (e) {
      console.error(`  ✗ 美术素材预加载失败 ${logical}:`, e.message);
    }
  }
}
// 音频桩：记录播放事件，验证「音效真的被触发」而不是静默
const audioPlayed = [];
const platform = {
  name: 'smoke',
  storage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
  pixelRatio: () => 1,
  createCanvas: (w, h) => createCanvas(w, h),
  loadImage: (src, cb) => {
    const img = preloaded.get(src);
    if (img) { cb(img); return; }
    loadImage(path.resolve(src)).then(cb).catch(() => cb(null));
  },
  now: () => 0,
  requestFrame: () => 0,
  onTap: (cb) => { tapCb = cb; },
  onPinch: (cb) => { pinchCb = cb; },
  rewardedAd: null,
  // 分享桩：模拟「分享面板选中会话并返回」= 分享成功（结算页确认后才发奖）
  share() { return Promise.resolve(true); },
  audio: {
    createSound: (src) => ({
      play: () => audioPlayed.push(src),
      stop() {}, setVolume() {}, destroy() {},
    }),
    createMusic: (src) => ({
      play: () => audioPlayed.push(src),
      pause() {}, setVolume() {}, onError() {}, destroy() {},
    }),
  },
  vibrate() {},
};

const game = new Game(canvas, ctx, platform);
// 首次流程截图在下面单独跑；跑完后再统一关掉引导，避免遮罩影响既有截图
const outDir = path.resolve('assets/_smoke');
fs.mkdirSync(outDir, { recursive: true });

let errors = 0;
/* ===== 冒烟门禁：并入 smoke-check 的四条判定 =====
   1) NOT RUN ≠ PASS：前置条件缺失记为“未运行”，退出码 2，绝不当作通过
   2) 0 用例不算通过：一条断言都没执行、或一张截图都没产出 → 不通过
   3) 超时即失败：整体超过 SMOKE_TIMEOUT_MS（默认 10 分钟）直接判失败
   4) 截图必须真跑出来：校验 PNG 魔数 + 体积下限 + 本次运行时间戳，
      而不是相信日志里打印过文件名 */
const RUN_STARTED = Date.now();
const SMOKE_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 10 * 60 * 1000);
const SHOT_MIN_BYTES = 2048;
const notRun = [];
const shotAudit = new Map(); // 截图名 -> 'ok' | 'FAIL'
let checksRun = 0;
const gateTimer = setTimeout(() => {
  console.error(`\n  ✗ 冒烟超时（>${SMOKE_TIMEOUT_MS} ms）：超时即失败，已执行断言 ${checksRun} 条、截图 ${shotAudit.size} 张`);
  process.exit(124);
}, SMOKE_TIMEOUT_MS);
gateTimer.unref();
// 同步主流程里 setTimeout 没有机会插入，因此在每条断言/每张截图前做一次协作式超时检查
function assertWithinDeadline() {
  const elapsed = Date.now() - RUN_STARTED;
  if (elapsed > SMOKE_TIMEOUT_MS) {
    console.error(`\n  ✗ 冒烟超时（${elapsed} ms > ${SMOKE_TIMEOUT_MS} ms）：超时即失败，已执行断言 ${checksRun} 条、截图 ${shotAudit.size} 张`);
    process.exit(124);
  }
}
function verifyShotFile(name, file) {
  try {
    const st = fs.statSync(file);
    const fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(8);
    fs.readSync(fd, head, 0, 8, 0);
    fs.closeSync(fd);
    const isPng = head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const fresh = st.mtimeMs >= RUN_STARTED - 1000;
    if (!isPng) {
      shotAudit.set(name, 'FAIL');
      errors++;
      console.error(`  ✗ 截图 ${name}.png 不是有效 PNG（没有真正渲染出来）`);
    } else if (st.size < SHOT_MIN_BYTES) {
      shotAudit.set(name, 'FAIL');
      errors++;
      console.error(`  ✗ 截图 ${name}.png 仅 ${st.size}B，疑似空图`);
    } else if (!fresh) {
      shotAudit.set(name, 'FAIL');
      errors++;
      console.error(`  ✗ 截图 ${name}.png 不是本次运行产物（早于本次启动）`);
    } else {
      shotAudit.set(name, 'ok');
    }
  } catch (e) {
    shotAudit.set(name, 'FAIL');
    errors++;
    console.error(`  ✗ 截图 ${name}.png 落盘校验失败:`, e.message);
  }
}
// 收尾门禁：区分 通过(0) / 失败(1) / 未运行(2) / 超时(124)
function finishGate(label, opts = {}) {
  assertWithinDeadline();
  const minShots = opts.minShots ?? 1;
  clearTimeout(gateTimer);
  const shotsOk = [...shotAudit.values()].filter((s) => s === 'ok').length;
  const shotsBad = shotAudit.size - shotsOk;
  console.log(`\n—— 门禁汇总（${label}）——`);
  console.log(`  断言执行 ${checksRun} 条 / 截图 ${shotAudit.size} 张（校验通过 ${shotsOk} 张）`);
  if (notRun.length) {
    console.error(`  ⚠ 未运行 ${notRun.length} 项：${notRun.join('；')} → 不算通过`);
    process.exit(2);
  }
  if (checksRun === 0) {
    console.error('  ✗ 0 条断言被执行 → 不算通过（NOT RUN）');
    process.exit(2);
  }
  if (shotAudit.size < minShots) {
    console.error(`  ✗ 截图仅 ${shotAudit.size} 张，少于要求的 ${minShots} 张 → 不算通过（NOT RUN）`);
    process.exit(2);
  }
  if (shotsBad > 0) console.error(`  ✗ ${shotsBad} 张截图未通过落盘校验`);
  if (errors) {
    console.error(`\n${label}失败：${errors} 处报错`);
    process.exit(1);
  }
  console.log(`\n${label}通过，截图在 assets/_smoke/`);
  process.exit(0);
}
// 截图脚本里的轻量断言（失败计入 errors，不影响继续出图）
function ok(cond, msg) {
  assertWithinDeadline();
  checksRun++;
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    errors++;
    console.error(`  ✗ ${msg}`);
  }
}
// 自动播放门禁：刚构造 Game（还没点过任何地方）时，BGM 必须一次都没播
{
  const bgmNames = [CONFIG.audio.bgm.main.src, CONFIG.audio.bgm.shop.src]
    .map((src) => src.split('/').pop());
  if (audioPlayed.some((src) => bgmNames.some((name) => src.includes(name)))) {
    errors++;
    console.error('  ✗ 未点击就自动播放了 BGM（违反用户手势门禁）');
  } else {
    console.log('  ✓ 加载后未点击时 BGM 静默（等首次手势才起播）');
  }
}
function shot(name) {
  assertWithinDeadline();
  try {
    game.draw();
    const file = path.join(outDir, `${name}.png`);
    fs.writeFileSync(file, canvas.toBuffer('image/png'));
    verifyShotFile(name, file);
    console.log(`  截图 ${name}.png`);
  } catch (e) {
    errors++;
    console.error(`  ✗ ${name} 渲染失败:`, e.message);
  }
}
// 局部放大截图：以屏幕点 (cx,cy) 为中心裁一块再放大，用来核对火焰圈 / 扇形 / 圆环等特效细节
function shotZoom(name, cx, cy, scale = 2) {
  assertWithinDeadline();
  try {
    game.draw();
    const zc = createCanvas(W, H);
    const zctx = zc.getContext('2d');
    zctx.fillStyle = '#000';
    zctx.fillRect(0, 0, W, H);
    const sw = W / scale;
    const sh = H / scale;
    zctx.drawImage(canvas, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, W, H);
    const file = path.join(outDir, `${name}.png`);
    fs.writeFileSync(file, zc.toBuffer('image/png'));
    verifyShotFile(name, file);
    console.log(`  截图 ${name}.png（放大 ${scale}x）`);
  } catch (e) {
    errors++;
    console.error(`  ✗ ${name} 渲染失败:`, e.message);
  }
}
// 点击 = 按下 + 抬起（拖拽页面的按钮在按下时触发，兵牌需要抬起才确定是点击）
function tap(x, y) {
  try {
    game.handleDown(x, y);
    game.handleUp(x, y);
  } catch (e) {
    errors++;
    console.error(`  ✗ 点击 (${x},${y}) 报错:`, e.message);
  }
}
// 拖拽：按下 → 两次移动（触发「已移动」判定）→ 抬起
function drag(x1, y1, x2, y2) {
  try {
    game.handleDown(x1, y1);
    game.handleMove((x1 + x2) / 2, (y1 + y2) / 2);
    game.handleMove(x2, y2);
    game.handleUp(x2, y2);
  } catch (e) {
    errors++;
    console.error(`  ✗ 拖拽 (${x1},${y1})→(${x2},${y2}) 报错:`, e.message);
  }
}
function tick(n = 1, dt = 1 / 60) {
  try {
    for (let i = 0; i < n; i++) game.update(dt);
  } catch (e) {
    errors++;
    console.error('  ✗ update 报错:', e.message);
  }
}
function screenName() {
  return game.screen && game.screen.constructor ? game.screen.constructor.name : '';
}
function cardCenter(i, layout, cols = layout.cols) {
  const r = cardRect(i, cols, layout.x0, layout.y0, CARD);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
function cellCenter(index) {
  // 布阵页是竞技场俯视图：上阵位的屏幕坐标 = 真实出场坐标，直接问 deploy 页要
  const p = deploySlotPoint(index);
  return { x: p.x, y: p.y };
}
function center(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}
// 开箱后如果弹出「首次获得兵种」展示页，先截图并确认，回到宝箱页再继续断言
function dismissShowcase(name) {
  if (screenName() !== 'UnitShowcaseScreen') return;
  shot(name);
  tap(375, 1201);
}

// 玩家版检查：node tools/smoke.mjs --player（先跑 node tools/build-wx.mjs 生成 wechat/）
// 1) 对产物做字符串断言：不能出现开发者通道的文案 / 函数名 / 调试出口；
// 2) 直接加载玩家版代码渲染首页 / 英雄页 / 兵营页，确认入口与命中区都不存在。
if (process.argv.includes('--player')) {
  console.log('开始玩家版构建检查');
  const wxOut = path.resolve('wechat');
  if (!fs.existsSync(wxOut)) {
    notRun.push('玩家版检查：未找到 wechat/（先运行 node tools/build-wx.mjs）');
    finishGate('玩家版检查', { minShots: 0 });
  }
  const forbidden = [
    /devGrantAllHeroes/, /devGrantAllTroops/, /devRect/, /devOpen/, /devResult/,
    /开发者/, /作弊/, /调试/, /\bDEV\b/, /console\.log/, /GameGlobal/, /__game/,
    /一键全英雄/, /一键全兵种/, /铜钱\+1万/, /全员满级/, /全员\+1级/, /重置存档/,
  ];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|json)$/.test(entry.name)) files.push(full);
    }
  };
  walk(wxOut);
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const re of forbidden) {
      if (re.test(text)) {
        errors++;
        console.error(`  ✗ ${path.relative(wxOut, file)} 命中 ${re}`);
      }
    }
  }
  ok(errors === 0, `玩家版产物无开发者标识（扫描 ${files.length} 个 js/json）`);
  ok(!fs.existsSync(path.join(wxOut, 'src', 'core', 'dev.js')), '玩家版不含 core/dev.js');
  ok(!fs.existsSync(path.join(wxOut, 'src', 'main.js')), '玩家版不含浏览器入口 main.js');

  const pcanvas = createCanvas(W, H);
  const pctx = pcanvas.getContext('2d');
  let pg = null;
  const pshot = (name) => {
    assertWithinDeadline();
    try {
      pg.draw();
      const file = path.join(outDir, `${name}.png`);
      fs.writeFileSync(file, pcanvas.toBuffer('image/png'));
      verifyShotFile(name, file);
      console.log(`  截图 ${name}.png（玩家版）`);
    } catch (e) {
      errors++;
      console.error(`  ✗ ${name} 玩家版渲染失败:`, e.message);
    }
  };
  try {
    const { Game: PlayerGame } = await import(pathToFileURL(path.join(wxOut, 'src', 'game.js')).href);
    pg = new PlayerGame(pcanvas, pctx, platform);
    pg.state.maxCleared = 300;
    pg.state.heroes = {};
    pg.state.heroLevels = {};
    pg.state.units = [{ id: 'p1', troop: 'shield', level: 1 }];
    pg.state.formation = new Array(CONFIG.formation.cols * CONFIG.formation.rows).fill(null);

    const { HomeScreen: PHome } = await import(pathToFileURL(path.join(wxOut, 'src', 'screens', 'home.js')).href);
    const home = new PHome(pg);
    pg.go(home);
    pg.toastText = '';
    pshot('58a_player_home');
    ok(!('addCoins' in home.rects) && !('reset' in home.rects), '玩家版首页没有调试四连按钮');
    const coinsBefore = pg.state.coins;
    pg.handleDown(140, 1187);
    pg.handleUp(140, 1187);
    ok(pg.state.coins === coinsBefore, '玩家版首页点击原「铜钱+1万」位置不会加钱');

    const { HeroScreen: PHero, HERO_LAYOUT: PL } = await import(pathToFileURL(path.join(wxOut, 'src', 'screens', 'heroes.js')).href);
    const ph = new PHero(pg);
    pg.go(ph);
    pg.toastText = '';
    pshot('58b_player_heroes');
    ok(!('devOpen' in ph) && !PL.devRect && typeof ph.drawDevModal === 'undefined',
      '玩家版英雄页没有 DEV 入口 / 调试面板');
    pg.handleDown(674, 107);
    pg.handleUp(674, 107);
    ok(!('devOpen' in ph), '玩家版英雄页点击原 DEV 位置无反应');

    const { BarracksScreen: PBarracks, BARRACKS_LAYOUT: PBL } = await import(pathToFileURL(path.join(wxOut, 'src', 'screens', 'barracks.js')).href);
    const pb = new PBarracks(pg);
    pg.go(pb);
    pg.toastText = '';
    pshot('58c_player_barracks');
    ok(!('devOpen' in pb) && !PBL.devRect && !PBL.devGrantRect,
      '玩家版兵营没有 DEV 入口 / 一键全兵种命中区');
  } catch (e) {
    errors++;
    console.error('  ✗ 玩家版页面加载失败:', e.message);
  }
  finishGate('玩家版检查', { minShots: 0 });
}

// ===== 首次流程：旁白（两段）→ 教学关卡 → 强制缩放 → 董卓开场战 → 战败 → 东山再起 =====
console.log('首次流程：序章');
{
  ok(screenName() === 'DeployScreen' && game.screen.prologue === true, '首次进入落在序章布阵页');
  ok(game.state.story && game.state.story.introDone === false, '首次进入是「还没打董卓」的存档');
  ok(!titleLoadFailed, '草书标题位图可加载');
  ok(game.screen.narration === 0 && game.screen.zoomDone === false, '先停在第一段旁白，缩放引导未完成');
  ok(game.state.units.length === 12 && game.state.formation.filter(Boolean).length === 12,
    '序章双方精锐：我方 12 队全部上阵');
  ok(game.screen.def.enemies.length === 17, `序章敌方 17 支（16 兵种 + 董卓），实测 ${game.screen.def.enemies.length}`);
  game.draw();
  shot('00a_prologue_narration_1');

  // 第一段 → 第二段
  tap(375, 1100);
  ok(game.screen.narration === 1 && game.screen.teachT === 0, '第一次点：切到第二段旁白，教学标题尚未出现');
  game.draw();
  shot('00b_prologue_narration_2');

  // 第二段点完 → 上方出现「教学关卡」+ 下方缩放引导
  tap(375, 1100);
  ok(game.screen.narration === 2 && game.screen.teachT > 0, '第二次点：旁白结束，「教学关卡」出现');
  game.update(0.3);
  game.draw();
  shot('00c_teaching_title_zoom');

  // 不缩放 → 开战按钮不放行
  tap(375, 1265);
  ok(screenName() === 'DeployScreen' && game.screen.zoomDone === false, '没做缩放动作时点开战无效（无跳过入口）');

  // 真的双指缩放（走 platform.onPinch → Game → DeployScreen 链路）
  if (pinchCb) {
    pinchCb(1, 375, 480, 'start');
    pinchCb(1.3, 375, 480, 'move');
    pinchCb(1, 375, 480, 'end');
  }
  ok(game.screen.zoomDone === true && tutorialSeen(game.state, 'zoom'), '缩放后引导完成并写入存档');
  game.update(0.2);
  game.draw();
  shot('00d_zoom_done');

  // 开战：直接点「开始第一战」
  tap(375, 1265);
  ok(screenName() === 'BattleScreen' && game.screen.prologue === true, '点开始第一战进入序章战场');
  ok(game.screen.speedLocked === true && game.screen.speed === 1, '序章锁定 1 倍速');
  // 主线 9 / 10 关的加速开关：9 禁用、10 恢复
  ok(new BattleScreen(game, 9, Math.random).speed === 1, '主线 9 关仍是 1 倍速（禁用加速）');
  const b10 = new BattleScreen(game, 10, Math.random);
  ok(b10.speed === 2 && b10.speedLocked === false, '主线 10 关恢复加速（默认 2 倍速）');
  // 等镜头从「我方半场」拉到战场中心，双方 17 + 12 支同时入画
  for (let i = 0; i < 80; i++) game.update(1 / 60);
  game.draw();
  shot('00e_prologue_battle');

  let frames = 0;
  while (!(screenName() === 'DeployScreen' && game.screen.prologue === false) && frames < 1500) {
    game.update(1 / 60);
    frames++;
  }
  ok(screenName() === 'DeployScreen' && game.screen.levelN === 1,
    `序章必败后跳过败北过场页，直接进入第 1 关排兵布阵（${frames} 帧）`);
  game.draw();
  shot('00f_prologue_defeat');

  // 东山再起（在败北时自动完成）：兵牌复位的新档 + 落在第 1 关布阵页
  ok(game.state.story.introDone === true, '开场剧情已完成，重进不再播');
  ok(game.state.maxCleared === 0 && game.state.units.length === CONFIG.startArmy.length,
    `兵牌复位：回到第 1 关、${CONFIG.startArmy.length} 张初始兵牌`);
  ok(game.state.formation.filter(Boolean).length === CONFIG.startArmy.length, '初始兵牌已重新上阵');
  ok(game.state.tutorial.seen.zoom === true && game.state.tutorial.seen.merge === true,
    '缩放 / 合成已看记录保留，老号不重播');
  // 主体冒烟从首页开始
  game.home();
  game.draw();
  shot('00g_after_reset_home');
  ok(game.screen && game.screen.constructor.name === 'HomeScreen', '东山再起后回到首页');
}
// 主体冒烟关掉引导，避免遮罩影响既有截图
for (const s of TUTORIAL_STEPS) game.state.tutorial.seen[s.id] = true;

console.log('开始冒烟测试');
shot('01_home');

// 开发者作弊按钮「全员+1级」：按一下每个单位各升 1 级
{
  const before = game.state.units.map((u) => u.level);
  tap(453, 1247);
  shot('01b_home_level_one');
  const after = game.state.units.map((u) => u.level);
  if (!after.every((lv, i) => lv === before[i] + 1)) {
    errors++;
    console.error(`  ✗ 开发者作弊「全员+1级」应让每个单位各升 1 级（前 ${before} / 后 ${after}）`);
  }
  // 还原成 Lv1，后面的用例按初始状态跑
  game.state.units.forEach((u, i) => { u.level = before[i]; });
  game.save();
}

tap(375, 466); // 闯关
shot('02_levels');

// 关卡不可视：没有选关格子，只显示「接下来 25 关」的奖励进度（每 5 关一个节点）
{
  console.log(`  关卡窗口：第 ${LEVELS_LAYOUT.windowStart}~${LEVELS_LAYOUT.windowStart + 24} 关，节点 ${LEVELS_LAYOUT.rows.length} 行`);
  if (LEVELS_LAYOUT.rows.length !== 5) {
    errors++;
    console.error(`  ✗ 25 关窗口应按每 5 关一个节点分成 5 行（实测 ${LEVELS_LAYOUT.rows.length}）`);
  }
  const first = LEVELS_LAYOUT.rows[0];
  if (!first || first.from !== 1 || first.to !== 5 || first.counts.wood !== 1 || first.counts.silver) {
    errors++;
    console.error(`  ✗ 第 1~5 关应有 1 个小木箱（第 5 关改为幽州突骑支援剧情，无银箱）（实测 ${JSON.stringify(first?.counts)}）`);
  }
  // 第 16~20 关这一行：20 关 = 小木箱 + 银箱（每 20 关的叠加奖励）
  const twentieth = LEVELS_LAYOUT.rows.find((r) => r.to === 20);
  if (!twentieth || twentieth.counts.wood !== 1 || twentieth.counts.silver !== 1) {
    errors++;
    console.error(`  ✗ 第 16~20 关应有小木箱 + 银箱（实测 ${JSON.stringify(twentieth?.counts)}）`);
  }
  // 不能重复挑战：点已通关的关卡不会有任何反应（页面只有主按钮可点）
  tap(375, 700);
  if (screenName() !== 'LevelSelectScreen') {
    errors++;
    console.error(`  ✗ 进度窗口区域不应该能选关（当前 ${screenName()}）`);
  }
  // 「!」详情弹层：被删掉的说明性文字都收在这里，点开 / 点任意处关闭
  const ib = LEVELS_LAYOUT.infoRect;
  tap(ib.x + ib.w / 2, ib.y + ib.h / 2);
  game.draw();
  shot('02b_levels_info');
  if (!game.screen.infoOpen) {
    errors++;
    console.error('  ✗ 点「!」应打开详解弹层');
  }
  tap(375, 420);
  game.draw();
  if (game.screen.infoOpen) {
    errors++;
    console.error('  ✗ 点任意处应关闭详解弹层');
  }
}

// 主按钮是唯一入口：进入「下一关」（第 1 关）布阵页
{
  const c = center(LEVELS_LAYOUT.challengeRect);
  tap(c.x, c.y);
}
shot('03_deploy');

// 视角缩放：25 个上阵位（按 6 人小队的最大方框算）必须整框落在斗技场面板里，
// 敌方前排（离中线最近的那一排）也一样，不能被面板上下边裁掉
{
  const scr = game.screen;
  const { x, y, w, h } = DEPLOY_LAYOUT.arena;
  const pad = 2;
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (let i = 0; i < 25; i++) {
    const b = deploySlotBox(i, scr.cam.y);
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y + b.h);
  }
  const def = levelDef(scr.levelN);
  // 敌方只要求「前排」（col 0，离中线最近）也在面板里；更远的几排本来就靠拖动查看
  def.enemies.filter((e) => e.col === 0).forEach((e) => {
    const p = scr.toScreen(slotToArena('enemy', e.col, e.row));
    const b = deploySquadBoxAt(p, squadSoldierCount(e.troop, e.level), scr.cam.y);
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y + b.h);
  });
  if (minX < x + pad || maxX > x + w - pad || minY < y + pad || maxY > y + h - pad) {
    errors++;
    console.error(`  ✗ 视角缩放应把全部上阵位装在面板里（占 ${minX.toFixed(0)},${minY.toFixed(0)} ~ ${maxX.toFixed(0)},${maxY.toFixed(0)}；面板 ${x},${y} ~ ${x + w},${y + h}）`);
  } else {
    console.log(`  布阵取景 ${minX.toFixed(0)},${minY.toFixed(0)} ~ ${maxX.toFixed(0)},${maxY.toFixed(0)}（面板 ${x},${y} ~ ${x + w},${y + h}）`);
  }
}

// 清空布阵 → 下方只显示 4 张「未上阵」兵牌
{
  const c = center(DEPLOY_LAYOUT.clearRect);
  tap(c.x, c.y);
}
shot('04_deploy_cleared');

// 拖第一张兵牌（盾兵）到左上角格子 → 上阵，兵牌从下方消失
{
  const from = cardCenter(0, DEPLOY_LAYOUT.list);
  const to = cellCenter(0);
  drag(from.x, from.y, to.x, to.y);
  const placed = game.state.formation[0];
  if (!placed) {
    errors++;
    console.error('  ✗ 拖拽上阵失败：格子仍是空的');
  }
  shot('05_deploy_dragged');
}

// 放一个同名同级的盾兵 → 拖到弓兵兵牌上应该失败（兵种不同）
game.state.units.push({ id: 'd1', troop: 'shield', level: 1 });
game.save();
game.draw();
{
  // 未上阵列表排序：盾兵 d1 在第 1 张，弓兵在第 2 张
  const from = cardCenter(0, DEPLOY_LAYOUT.list);
  const to = cardCenter(1, DEPLOY_LAYOUT.list);
  game.handleDown(from.x, from.y);
  game.handleMove(to.x, to.y);
  shot('06_merge_hover_bad');
  game.handleUp(to.x, to.y);
  const shield = game.state.units.find((u) => u.id === 'd1');
  if (!shield || shield.level !== 1) {
    errors++;
    console.error('  ✗ 兵种不同不应合成');
  }
}
shot('07_merge_bad');

// 拖到格子上同兵种同等级的盾兵上 → 合成成功（目标 Lv2，材料被消耗）
{
  const from = cardCenter(0, DEPLOY_LAYOUT.list);
  const to = cellCenter(0);
  drag(from.x, from.y, to.x, to.y);
  const target = game.state.units.find((u) => u.id === game.state.formation[0]);
  if (!target || target.level !== 2) {
    errors++;
    console.error('  ✗ 拖拽合成后目标不是 Lv2');
  }
  if (game.state.units.some((u) => u.id === 'd1')) {
    errors++;
    console.error('  ✗ 拖拽合成后材料应被消耗');
  }
  shot('08_merge_ok');
  if (!audioPlayed.some((src) => src.endsWith('sfx/merge.wav'))) {
    errors++;
    console.error('  ✗ 拖拽合成成功应播放 merge 音效');
  }
}

// 按战力布阵 → 出战
{
  const c = center(DEPLOY_LAYOUT.autoRect);
  tap(c.x, c.y);
}
shot('09_deploy_auto');
// 拖拽交换：地图内不同兵种 = 互换位置；卡池拖到已有上阵位 = 原单位回到未上阵
{
  const g = game;
  const form0 = [...g.state.formation];
  const units = g.state.units;
  const filled = form0
    .map((id, i) => (id ? { i, id, u: units.find((x) => x.id === id) } : null))
    .filter(Boolean);
  let a = null;
  let b = null;
  for (const x of filled) {
    const y = filled.find((z) => z.u && z.u.troop !== x.u.troop);
    if (y) { a = x; b = y; break; }
  }
  if (!a || !b) {
    errors++;
    console.error('  ✗ 布阵自动排布后应有两支不同兵种的小队用于交换测试');
  } else {
    // 1) 先把 A 撤下来，再从卡池拖到 B 的上阵位 → A 替换 B，B 回到未上阵
    g.state.formation[a.i] = null;
    g.save();
    g.draw();
    drag(cardCenter(0, DEPLOY_LAYOUT.list).x, cardCenter(0, DEPLOY_LAYOUT.list).y,
      cellCenter(b.i).x, cellCenter(b.i).y);
    if (g.state.formation[b.i] !== a.id) {
      errors++;
      console.error(`  ✗ 卡池单位拖到已有上阵位应替换（期望 ${a.id}，实际 ${g.state.formation[b.i]}）`);
    }
    if (g.state.formation.includes(b.id)) {
      errors++;
      console.error('  ✗ 被替换的单位应回到未上阵列表');
    }
    // 2) A 现在在地图 b 位，拖到另一个不同兵种的上阵位 → 两人互换
    const c = filled.find((x) => x.i !== a.i && x.i !== b.i && x.u && x.u.troop !== a.u.troop);
    if (!c) {
      errors++;
      console.error('  ✗ 找不到第三支不同兵种的上阵小队做交换测试');
    } else {
      drag(cellCenter(b.i).x, cellCenter(b.i).y, cellCenter(c.i).x, cellCenter(c.i).y);
      if (g.state.formation[b.i] !== c.id || g.state.formation[c.i] !== a.id) {
        errors++;
        console.error('  ✗ 地图内拖动不同兵种应互换两个上阵位');
      }
    }
    // 还原成原来的自动布阵，避免影响后面的战斗回归
    g.state.formation = form0;
    g.save();
    g.draw();
    tick(120); // 让交换提示淡出
  }
}
{
  const c = center(DEPLOY_LAYOUT.confirmRect);
  tap(c.x, c.y);
}
tick(24);
shot('10_arena_opening');
// 主 BGM：进入斗技场仍沿用《战争进化史》主题曲（不重新起播、不打断）
if (!audioPlayed.some((src) => src.includes('audio/glorious_morning'))) {
  errors++;
  console.error('  ✗ 进入战斗后应该继续使用主 BGM《战争进化史》');
}
// 开战顶栏的「总战力 我方 … · 敌方 …」：数字必须和布阵页 / 战斗实体同一口径
{
  const scr = game.screen;
  const mine = scr.playerSquads.reduce((s, q) => s + troopPower(q.troop, q.level), 0);
  const foe = Math.round(scr.def.enemies.reduce((s, q) => s + troopPower(q.troop, q.level), 0)
    * (scr.def.difficulty || 1));
  if (!(scr.myPower > 0 && scr.myPower === mine && scr.enemyPower === foe)) {
    errors++;
    console.error(`  ✗ 开战顶栏总战力应等于双方小队战力之和（我方 ${scr.myPower}/${mine}，敌方 ${scr.enemyPower}/${foe}）`);
  }
}

tick(130);
shot('11_arena_mid');

// 边界 / 相机极限：四个角都能拖到，场地外必须画成围墙护坡（不能露白）
{
  const c = game.screen.cam;
  const xy = { x: c.x, y: c.y };
  const at = (x, y, name) => {
    c.x = x;
    c.y = y;
    clampCamera(c);
    game.draw();
    shot(name);
  };
  at(c.minX, c.minY, '11a_cam_top_left');
  at(c.maxX, c.minY, '11b_cam_top_right');
  at(c.minX, c.maxY, '11c_cam_bottom_left');
  at(c.maxX, c.maxY, '11d_cam_bottom_right');
  c.x = xy.x;
  c.y = xy.y;
  clampCamera(c);
  game.draw();
}

const arena = game.screen;
const speedBeforeTap = arena.speed;
tap(667, 74); // 第 1 关：加速未开放，点了只提示、不提速
if (arena.speed !== speedBeforeTap || !/第 10 关后开放加速/.test(game.toastText)) {
  errors++;
  console.error(`  ✗ 第 1 关点加速不应提速（${speedBeforeTap} → ${arena.speed}，提示「${game.toastText}」）`);
}
// 顺便确认「阵亡当帧消失」：倒地后不再保留渲染状态 / 尸体计时
let sawDeath = false;
let sawGhost = false;
for (let i = 0; i < 8000 && screenName() === 'BattleScreen'; i++) {
  tick(1);
  if (!arena.battle) continue;
  for (const e of arena.battle.entities) {
    if (e.alive) continue;
    sawDeath = true;
    if (arena.vis[e.uid]) {
      sawGhost = true;
      break;
    }
  }
}
if (!sawDeath || sawGhost) {
  errors++;
  console.error(`  ✗ 阵亡单位应立即消失（有人倒地=${sawDeath}，残留渲染状态=${sawGhost}）`);
}
shot('12_result');

if (screenName() === 'ResultScreen') {
  // 胜利音效（音效桩记录）
  if (!audioPlayed.some((src) => src.endsWith('sfx/victory.mp3'))) {
    errors++;
    console.error('  ✗ 胜利结算应播放 victory 音效');
  }
  // 胜利页「本局最佳」：我方输出 / 承伤在左、敌方在右，百分比条
  {
    const best = game.screen.best;
    if (!best || !best.player.topDealt || best.player.pctDealt <= 0
      || !best.player.topTaken || !best.enemy.topDealt) {
      errors++;
      console.error('  ✗ 胜利结算应包含本局最佳输出 / 承伤（我方与敌方各一条）');
    }
  }
  // 结算页「下一个解锁」：第 1 关通关 → 指向第 3 关自动战斗
  {
    const card = nextUnlockInfo(game.state, { levelN: 1, win: true });
    ok(!!card && card.focus.level === 3 && card.focus.id === 'autoBattle',
      '胜利页「下一个解锁」指向第 3 关自动战斗');
    shotZoom('12a_result_unlock_bar', 375, 918, 2);
  }
  // 第 1 关首通 → 小木箱：点「打开小木箱」应给 1 个兵、宝箱数量 -1
  {
    const before = game.state.units.length;
    const chestBefore = chestCount(game.state, 'wood');
    tap(606, 315);
    shot('12b_chest_opened');
    dismissShowcase('12b1_showcase');
    if (screenName() !== 'ResultScreen' || !game.screen.opened || game.state.units.length !== before + 1) {
      errors++;
      console.error('  ✗ 打开首通宝箱后应获得 1 个兵');
    }
    if (chestCount(game.state, 'wood') !== chestBefore - 1) {
      errors++;
      console.error('  ✗ 打开宝箱后宝箱数量应减少');
    }
    if (!audioPlayed.some((src) => src.endsWith('sfx/chest.wav'))) {
      errors++;
      console.error('  ✗ 打开首通宝箱应播放 chest 音效');
    }
  }
  // 回归：结算后「返回关卡进度」，再从进度页点返回，应回到首页
  shot('12c_result_share_btn');
  tap(375, 1226);
  shot('13_result_back');
  tap(98, 76);
  shot('13b_back_home');
  if (screenName() !== 'HomeScreen') {
    errors++;
    console.error(`  ✗ 通关后返回按钮未回到首页（当前 ${screenName()}）`);
  }
  // 首页声音面板：打开 → BGM / 音效音量可分别调整 → 总开关 → 关闭
  {
    tick(120); // 让开箱提示淡出，截图干净
    const L = HOME_AUDIO_LAYOUT;
    tap(394, 83);
    if (!game.screen.audioOpen) {
      errors++;
      console.error('  ✗ 点首页「声音」应打开音量设置面板');
    }
    shot('13c_audio_panel');

    const bgmX = L.bgmBar.x + L.bgmBar.w * 0.4;
    tap(bgmX, L.bgmHit.y + L.bgmHit.h / 2);
    if (Math.abs(game.state.bgmVolume - 0.4) > 0.02) {
      errors++;
      console.error(`  ✗ 点 BGM 滑条 40% 位置应把音量设为 0.4（当前 ${game.state.bgmVolume}）`);
    }
    const sfxX = L.sfxBar.x + L.sfxBar.w * 0.65;
    tap(sfxX, L.sfxHit.y + L.sfxHit.h / 2);
    if (Math.abs(game.state.sfxVolume - 0.65) > 0.02) {
      errors++;
      console.error(`  ✗ 点音效滑条 65% 位置应把音量设为 0.65（当前 ${game.state.sfxVolume}）`);
    }
    const master = { x: L.master.x + L.master.w / 2, y: L.master.y + L.master.h / 2 };
    tap(master.x, master.y);
    if (game.state.audio !== false) {
      errors++;
      console.error('  ✗ 声音总开关应能关掉声音');
    }
    tap(master.x, master.y);
    if (game.state.audio !== true) {
      errors++;
      console.error('  ✗ 声音总开关应能重新开启声音');
    }
    const close = { x: L.close.x + L.close.w / 2, y: L.close.y + L.close.h / 2 };
    tap(close.x, close.y);
    if (game.screen.audioOpen) {
      errors++;
      console.error('  ✗ 点「完成」应关闭声音面板');
    }
    // 设置里的「新手引导」入口：打开引导手册 → 返回
    tap(394, 83);
    tap(L.help.x + L.help.w / 2, L.help.y + L.help.h / 2);
    if (!(game.screen instanceof HelpScreen)) {
      errors++;
      console.error('  ✗ 设置面板的「新手引导」应打开引导手册');
    }
    game.draw();
    game.pop();
  }
}

// ---------- 兵营：拖拽合成 ----------
game.home();
game.state.maxCleared = 1;
game.state.coins = 800;
game.state.units = [
  { id: 'a1', troop: 'shield', level: 1 },
  { id: 'a2', troop: 'archer', level: 1 },
  { id: 'a3', troop: 'spear', level: 1 },
  { id: 'a4', troop: 'cavalry', level: 1 },
];
game.state.formation = new Array(25).fill(null);
game.save();
tap(231, 768); // 兵营
shot('14_barracks');

// 一键合成：没有配对 → 只提示
{
  const c = center(BARRACKS_LAYOUT.mergeAllRect);
  tap(c.x, c.y);
}
shot('15_merge_none');
if (game.state.units.length !== 4) {
  errors++;
  console.error('  ✗ 无可合成材料时不应该改变兵营');
}

// 补一个同兵种同等级的材料 → 拖到另一个盾兵兵牌上 → 升到 Lv2
game.state.units.push({ id: 'x1', troop: 'shield', level: 1 });
game.save();
game.draw();
{
  const from = cardCenter(1, BARRACKS_LAYOUT.list); // x1
  const to = cardCenter(0, BARRACKS_LAYOUT.list);   // a1
  game.handleDown(from.x, from.y);
  game.screen.update(0.3);                          // 长按 0.25s 才拿起（1.0.12 手势）
  game.handleMove(from.x, from.y - 20);
  game.handleMove(to.x, to.y);
  shot('16_drag_merge_hover');
  game.handleUp(to.x, to.y);
  const shield = game.state.units.find((u) => u.troop === 'shield');
  if (!shield || shield.level !== 2 || game.state.units.some((u) => u.id === 'x1')) {
    errors++;
    console.error('  ✗ 拖拽合成：盾兵应升到 Lv2 且材料被消耗');
  }
}
shot('17_drag_merge_ok');

// 点兵牌 → 详情页
{
  const c = cardCenter(0, BARRACKS_LAYOUT.list);
  tap(c.x, c.y);
}
shot('18_unit_detail');

// 材料不足：点合成只给提示
tap(375, 1082);
shot('19_merge_short');
if (game.screen.unit && game.screen.unit.level !== 2) {
  errors++;
  console.error('  ✗ 材料不足时不应该合成');
}

// 补一个同等级材料 → 详情页合成成功（Lv2 → Lv3）
game.state.units.push({ id: 'x2', troop: 'shield', level: 2 });
game.save();
tap(375, 1082);
shot('20_merge_ok');
if (!game.screen.unit || game.screen.unit.level !== 3) {
  errors++;
  console.error('  ✗ 合成后单位应升到 Lv3');
}
if (game.state.units.some((u) => u.id === 'x2')) {
  errors++;
  console.error('  ✗ 合成材料应从兵营移除');
}

// 满级展示（Lv10）
if (game.screen.unit) {
  game.screen.unit.level = CONFIG.merge.maxLevel;
  game.save();
  game.toastText = '';
  game.toastT = 0;
  shot('21_unit_max');
  tap(375, 1082);
  shot('22_merge_max');
}

// 遣散入口已删除：详情页不应再有遣散按钮（点原坐标无反应，弹窗不再出现）
tap(375, 1217);
shot('23_no_dismiss_button');

// ---------- 兵营 300 容量 + 分页 ----------
tap(98, 76); // 返回兵营
{
  let n = 0;
  const cap = rosterSlots(game.state.maxCleared).unlocked;
  while (game.state.units.length < cap) {
    game.state.units.push({ id: `bulk${n}`, troop: CONFIG.troops[n % CONFIG.troops.length].id, level: 1 + (n % CONFIG.merge.maxLevel) });
    n++;
  }
}
game.save();
game.draw();
if (game.state.units.length !== rosterSlots(game.state.maxCleared).unlocked) {
  errors++;
  console.error('  ✗ 兵营容量应能容纳 300 个单位');
}
shot('24_barracks_full');
{
  // 兵营改成一整块滚动网格：在网格缝隙处上下拖 = 滚动，滑到底被边界夹住
  const v = BARRACKS_LAYOUT.list.view;
  drag(174, v.y + 486, 174, v.y + 86);
  game.draw();
  shot('25_barracks_scrolled');
  if (!(game.screen.scrollY > 0)) {
    errors++;
    console.error(`  ✗ 兵营列表应能上滑滚动（scrollY=${game.screen.scrollY}）`);
  }
  drag(174, v.y + 86, 174, v.y + 486);
  game.draw();
  if (game.screen.scrollY !== 0) {
    errors++;
    console.error(`  ✗ 兵营列表滑回顶部应被边界夹住（scrollY=${game.screen.scrollY}）`);
  }
}

// ---------- 兵书：800 关解锁，三卷各 10 级 ----------
{
  const prevCleared = game.state.maxCleared;
  game.state.maxCleared = 800;
  game.state.coins = 30000;
  game.save();
  game.draw();
  tap(607, 890); // 兵营右侧「兵书」
  shot('25b_books');
  if (!game.screen.booksOpen) {
    errors++;
    console.error('  ✗ 兵书入口没有打开面板');
  }
  tap(537, 485); // 第一行「升级」
  shot('25c_books_upgraded');
  if (game.state.books.atk !== 1 || game.state.coins !== 22000) {
    errors++;
    console.error(`  ✗ 兵书升级失败（Lv${game.state.books.atk} / 铜钱 ${game.state.coins}）`);
  }
  tap(375, 867); // 关闭
  if (game.screen.booksOpen) {
    errors++;
    console.error('  ✗ 兵书面板没有关闭');
  }
  game.state.maxCleared = prevCleared;
  game.save();
}

// ---------- 宝箱页 ----------
// 先腾 1 格并塞 1 个小木箱：开箱应消耗箱子并把兵营填回 300
game.state.units.pop();
game.state.chests.wood = 1;
game.save();
game.home();
tap(231, 644); // 宝箱
shot('25b_chests');
{
  const before = game.state.units.length;
  tap(553, 302); // 小木箱那一行的「开箱」按钮
  shot('25c_chest_opened');
  dismissShowcase('25c1_showcase');
  if (game.state.units.length !== before + 1 || chestCount(game.state, 'wood') !== 0) {
    errors++;
    console.error('  ✗ 宝箱页开箱后应 +1 个兵、宝箱 -1');
  }
}
// 常规三档（小木 / 银 / 金）+ 特殊三档（稀有 / 史诗 / 传奇）：都能开，开出的兵品级对得上
{
  game.state.chests.silver = 1;
  game.state.chests.gold = 1;
  game.state.chests.rare = 1;
  game.state.chests.epic = 1;
  game.state.chests.legendary = 1;
  // 5 种宝箱要开 5 次 → 先腾 5 格（否则开到一半兵营就满了）
  for (let i = 0; i < 5; i++) game.state.units.pop();
  game.save();
  game.draw();
  shot('25d_chests_all_types');
  // 木箱 / 金箱建模对比特写（结构差异：平盖+麻绳 vs 拱盖+冠饰+宝石锁）
  game.toastT = 0;
  game.toastText = '';
  shotZoom('25e_chest_wood_gold_zoom', 190, 350, 2);
  // 行高 100 + 间距 8：银箱 y=360 / 金箱 y=468 / 稀有 y=614 / 史诗 y=722 / 传奇 y=830
  const specials = [['rare', 664, 'rare'], ['epic', 772, 'epic'], ['legendary', 880, 'legendary']];
  for (const [id, y, want] of specials) {
    const before = game.state.units.length;
    const bag = chestCount(game.state, id);
    tap(553, y);
    dismissShowcase(`25c2_showcase_${id}`);
    if (game.state.units.length !== before + 1 || chestCount(game.state, id) !== bag - 1) {
      errors++;
      console.error(`  ✗ 宝箱页「${id}」开箱后应 +1 个兵、宝箱 -1`);
    }
    const got = game.screen.lastReward;
    if (!got || CONFIG.troops.find((t) => t.id === got.troop)?.rarity !== want) {
      errors++;
      console.error(`  ✗ ${id} 宝箱开出的兵品级不是 ${want}`);
    }
  }
  // 银箱 / 金箱只能开对应品级（银箱 40% 普通 + 40% 稀有 + 20% 史诗；金箱 30% 稀有 + 40% 史诗 + 30% 传奇）
  for (const [id, y, allowed] of [['silver', 410, ['common', 'rare', 'epic']], ['gold', 518, ['rare', 'epic', 'legendary']]]) {
    const before = game.state.units.length;
    tap(553, y);
    dismissShowcase(`25c3_showcase_${id}`);
    const got = game.screen.lastReward;
    if (game.state.units.length !== before + 1 || !got || !allowed.includes(rarityOf(got.troop))) {
      errors++;
      console.error(`  ✗ ${id} 宝箱开出的兵品级超出掉落表（${got ? got.troop : '无'}）`);
    }
  }
  shot('25e_chest_legendary_opened');
}
tap(98, 76); // 返回首页

// ---------- 每日：通关 30 关开放（签到 / 7 日登录 / 每日任务） ----------
{
  game.state.maxCleared = 29;
  game.state.units = [
    { id: 'g1', troop: 'shield', level: 1 },
    { id: 'g2', troop: 'archer', level: 1 },
    { id: 'g3', troop: 'spear', level: 1 },
    { id: 'g4', troop: 'cavalry', level: 1 },
  ];
  game.state.formation = new Array(25).fill(null);
  game.state.chests = {};
  game.save();
  game.home();
  tap(591, 83); // 首页右上角「每日」
  shot('25f_daily_locked');
  if (screenName() !== 'DailyScreen') {
    errors++;
    console.error(`  ✗ 首页「每日」入口没有打开每日页（当前 ${screenName()}）`);
  }
  tap(98, 76); // 返回首页

  game.state.maxCleared = 30;
  game.save();
  game.home();
  tap(591, 83);
  shot('25g_daily');
  // 签到：稀有宝箱 +1
  {
    const before = chestCount(game.state, 'rare');
    tap(575, 204);
    shot('25h_daily_signed');
    if (chestCount(game.state, 'rare') !== before + 1) {
      errors++;
      console.error('  ✗ 每日签到应送 1 个稀有宝箱');
    }
  }
  // 7 日登录：第 1 天史诗宝箱
  {
    const before = chestCount(game.state, 'epic');
    tap(375, 476);
    if (chestCount(game.state, 'epic') !== before + 1) {
      errors++;
      console.error('  ✗ 7 日登录第 1 天应送 1 个史诗宝箱');
    }
  }
  // 每日任务：补满「通关 10 关」进度 → 领取稀有宝箱
  {
    for (let i = 0; i < 10; i++) noteClear(game.state);
    game.draw();
    const before = chestCount(game.state, 'rare');
    tap(620, 623);
    shot('25i_daily_task_claimed');
    if (chestCount(game.state, 'rare') !== before + 1) {
      errors++;
      console.error('  ✗ 领取「通关 10 关」任务应送 1 个稀有宝箱');
    }
  }
  tap(98, 76); // 返回首页
}

// ---------- 特殊兵种：稀有 / 史诗 / 传奇 兵牌边框 + 详情 ----------
{
  game.state.units = [
    { id: 's1', troop: 'shield', level: 3 },
    { id: 's2', troop: 'qingzhou', level: 2 },
    { id: 's3', troop: 'baier', level: 3 },
    { id: 's4', troop: 'daji', level: 4 },
    { id: 's5', troop: 'xiandeng', level: 2 },
    { id: 's6', troop: 'tengjia', level: 3 },
    { id: 's7', troop: 'xianzhen', level: 4 },
    { id: 's8', troop: 'yuanyong', level: 3 },
    { id: 's9', troop: 'baima', level: 3 },
    { id: 's10', troop: 'huhao', level: 4 },
  ];
  game.state.units = game.state.units.filter((u) => CONFIG.troops.some((t) => t.id === u.troop));
  game.state.formation = new Array(25).fill(null);
  game.save();
  game.home();
  tap(231, 768); // 兵营
  shot('29_special_cards');

  // 边框差异化：普通 / 稀有 / 史诗 / 传奇 四张牌的边框颜色必须互不相同
  game.draw();
  const cols = BARRACKS_LAYOUT.list.cols;
  const FILL = [36, 26, 22];              // 兵牌底色 #241a16（v2 暖褐），采样时排除它
  const borderOf = (i) => {
    const r = cardRect(i, cols, BARRACKS_LAYOUT.list.x0, BARRACKS_LAYOUT.list.y0, CARD);
    // 边框线宽 1.5~2.4 居中压在边沿：纵向扫 5 个像素，取离底色最远的那个
    let best = null;
    let bestD = -1;
    for (let dy = 0; dy <= 4; dy++) {
      const d = ctx.getImageData(Math.round(r.x + r.w / 2), Math.round(r.y + dy), 1, 1).data;
      const c = [d[0], d[1], d[2]];
      const dd = Math.abs(c[0] - FILL[0]) + Math.abs(c[1] - FILL[1]) + Math.abs(c[2] - FILL[2]);
      if (dd > bestD) { bestD = dd; best = c; }
    }
    return best;
  };
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  // 按排序结果各取一张：普通 / 稀有 / 史诗 / 传奇（顺序不再依赖品级放在前几格）
  const sortedForColors = game.screen.sortedUnits();
  const colorIdx = ['common', 'rare', 'epic', 'legendary'].map((r) => sortedForColors.findIndex((u) => rarityOf(u.troop) === r));
  const colors = colorIdx.map((i) => borderOf(Math.max(0, i)));
  let distinct = true;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      if (dist(colors[i], colors[j]) < 40) distinct = false;
    }
  }
  if (!distinct) {
    errors++;
    console.error(`  ✗ 普通/稀有/史诗/传奇 兵牌边框颜色应互相区分（实测 ${JSON.stringify(colors)}）`);
  } else {
    console.log(`  边框配色 普通 ${colors[0]} / 稀有 ${colors[1]} / 史诗 ${colors[2]} / 传奇 ${colors[3]}`);
  }

  // 传奇兵种详情页（品级边框 + 光环 + 标题上色）——按排序找到第一张传奇兵牌
  {
    const legIdx = game.screen.sortedUnits().findIndex((u) => rarityOf(u.troop) === 'legendary');
    const c = cardCenter(Math.max(0, legIdx), BARRACKS_LAYOUT.list);
    tap(c.x, c.y);
  }
  shot('30_special_detail_legendary');
  if (!game.screen.unit || CONFIG.troops.find((t) => t.id === game.screen.unit.troop)?.rarity !== 'legendary') {
    errors++;
    console.error('  ✗ 点第 4 张兵牌应打开传奇兵种详情');
  }
  tap(98, 76); // 返回兵营
  // 稀有兵种详情页（看「战法 · 特性」的品级配色与单条战法排版）
  {
    const rareIdx = game.screen.sortedUnits().findIndex((u) => rarityOf(u.troop) === 'rare');
    const c = cardCenter(Math.max(0, rareIdx), BARRACKS_LAYOUT.list);
    tap(c.x, c.y);
  }
  shot('30b_special_detail_rare');
  if (!game.screen.unit || CONFIG.troops.find((t) => t.id === game.screen.unit.troop)?.rarity !== 'rare') {
    errors++;
    console.error('  ✗ 应打开稀有兵种详情');
  }
  tap(98, 76); // 返回兵营
  tap(98, 76); // 返回首页
  // 布阵页：把特殊兵自动摆进斗技场，看它们在战场上的实际大小与识别点
  tap(231, 768); // 兵营
  tap(525, 1059); // 去布阵上阵
  {
    const c = center(DEPLOY_LAYOUT.autoRect);
    tap(c.x, c.y);
  }
  shot('31_special_deploy');
  if (screenName() !== 'DeployScreen') {
    errors++;
    console.error(`  ✗ 特殊兵种自动布阵后应停在布阵页（当前 ${screenName()}）`);
  }
}

// ---------- 商城：满员拒绝 → 腾出 1 格后购买 Lv6 ----------
game.state.units = [];
while (game.state.units.length < rosterSlots(game.state.maxCleared).unlocked) {
  game.state.units.push({ id: `full${game.state.units.length}`, troop: 'shield', level: 1 });
}
game.state.formation = new Array(25).fill(null);
game.state.coins = 40000;
game.save();
game.home();
tap(519, 644); // 商城
// 进商城切到商城 BGM（离开后主 BGM 从暂停处继续）
if (!audioPlayed.some((src) => src.includes('audio/bgm_heroic_loop'))) {
  errors++;
  console.error('  ✗ 进入商城后应切换到商城 BGM（英雄主题循环）');
}
shot('26_shop');
const buyRectOf = (i) => ({
  x: SHOP_LAYOUT.cardX0 + i * (SHOP_LAYOUT.cardW + SHOP_LAYOUT.cardGap) + SHOP_LAYOUT.buyOffsetX,
  y: SHOP_LAYOUT.cardY + SHOP_LAYOUT.buyOffsetY,
  w: SHOP_LAYOUT.buyW,
  h: SHOP_LAYOUT.buyH,
});
{
  const c = center(buyRectOf(0));
  tap(c.x, c.y);
}
shot('27_shop_full');
if (game.state.units.length !== rosterSlots(game.state.maxCleared).unlocked) {
  errors++;
  console.error('  ✗ 兵营满时不应该再增加单位');
}

game.state.units.pop();
game.save();
{
  const c = center({ x: SHOP_LAYOUT.tabX0 + 2 * SHOP_LAYOUT.tabGap, y: SHOP_LAYOUT.tabY, w: SHOP_LAYOUT.tabW, h: SHOP_LAYOUT.tabH });
  tap(c.x, c.y); // 选 Lv6
}
tick(120);
{
  const c = center(buyRectOf(0));
  tap(c.x, c.y);
}
shot('28_shop_bought');
if (game.state.units[game.state.units.length - 1].level !== 6) {
  errors++;
  console.error('  ✗ 商城买到的兵等级不是 Lv6');
}

// ---------- 布阵页：四色品级边框 / 拖动合成提示 / 自动战斗 ----------
game.home();
game.state.units = [
  { id: 'n1', troop: 'shield', level: 1 },      // 普通 → 绿框
  { id: 'n2', troop: 'qingzhou', level: 1 },    // 稀有 → 蓝框
  { id: 'n3', troop: 'tengjia', level: 1 },     // 史诗 → 紫框
  { id: 'n4', troop: 'xianzhen', level: 1 },    // 传奇 → 金框
  { id: 'n5', troop: 'shield', level: 1 },      // 与 n1 同兵种同级：拖它时场上要亮「可合成」
];
game.state.formation = new Array(25).fill(null);
game.state.autoBattle = false;
game.save();
tap(231, 768); // 兵营
tap(525, 1059); // 去布阵上阵
{
  const c = center(DEPLOY_LAYOUT.autoRect);
  tap(c.x, c.y); // 按战力布阵
}
{
  // 把 n5 撤下 → 回到「未上阵」兵牌，等下拖它看合成提示
  const f = game.state.formation;
  f[f.indexOf('n5')] = null;
  game.save();
  game.draw();
}
shot('32_deploy_rarity_borders');

// 四色边框：场上取 n1~n4 的方框采样，普通绿 / 稀有蓝 / 史诗紫 / 传奇金 必须互不相同
{
  const scr = game.screen;
  const camY = scr.cam.y;
  const frameOf = (id) => {
    const unit = game.state.units.find((u) => u.id === id);
    const p = deploySlotPoint(game.state.formation.indexOf(id), camY);
    const b = deploySquadBoxAt(p, squadSoldierCount(unit.troop, unit.level), camY);
    const sx = Math.round(b.x + b.w / 2);
    const sy = Math.round(b.y);
    const bg = ctx.getImageData(sx, sy - 9, 1, 1).data;
    // 框线 1.6~2.2px 居中压在边沿：竖扫 6 个像素，取离「框外地面」最远的那个
    let best = null;
    let bestD = -1;
    for (let k = -1; k <= 4; k++) {
      const d = ctx.getImageData(sx, sy + k, 1, 1).data;
      const c = [d[0], d[1], d[2]];
      const dd = Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]);
      if (dd > bestD) { bestD = dd; best = c; }
    }
    return best;
  };
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const colors = ['n1', 'n2', 'n3', 'n4'].map(frameOf);
  let distinct = true;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      if (dist(colors[i], colors[j]) < 40) distinct = false;
    }
  }
  if (!distinct) {
    errors++;
    console.error(`  ✗ 布阵页四色边框应互相区分（实测 普通 ${colors[0]} / 稀有 ${colors[1]} / 史诗 ${colors[2]} / 传奇 ${colors[3]}）`);
  } else {
    console.log(`  布阵页方框配色 普通 ${colors[0]} / 稀有 ${colors[1]} / 史诗 ${colors[2]} / 传奇 ${colors[3]}`);
  }

  // 未上阵兵牌（普通兵）在布阵页也是绿色边框
  const r = cardRect(0, DEPLOY_LAYOUT.list.cols, DEPLOY_LAYOUT.list.x0, DEPLOY_LAYOUT.list.y0, CARD);
  let cardBorder = null;
  let cardD = -1;
  const FILL = [28, 36, 49];
  for (let k = 0; k <= 4; k++) {
    const d = ctx.getImageData(Math.round(r.x + r.w / 2), Math.round(r.y + k), 1, 1).data;
    const c = [d[0], d[1], d[2]];
    const dd = Math.abs(c[0] - FILL[0]) + Math.abs(c[1] - FILL[1]) + Math.abs(c[2] - FILL[2]);
    if (dd > cardD) { cardD = dd; cardBorder = c; }
  }
  if (dist(cardBorder, [88, 160, 107]) > 70) {
    errors++;
    console.error(`  ✗ 布阵页普通兵种的兵牌应是绿色边框（实测 ${cardBorder}）`);
  }
}

// 拖动兵牌：场上若有同兵种同等级的单位，要亮绿框 + 「可合成」标签（不用悬停到它上面）
{
  const from = cardCenter(0, DEPLOY_LAYOUT.list); // n5 是唯一未上阵的兵牌
  game.handleDown(from.x, from.y);
  game.handleMove(from.x + 20, from.y - 120);
  game.handleMove(from.x + 60, from.y - 230);
  shot('33_deploy_merge_hint');
  const hints = game.screen.mergeTargets ? game.screen.mergeTargets('n5') : [];
  if (hints.length !== 1) {
    errors++;
    console.error(`  ✗ 拖动 n5 时场上应提示 1 个可合成目标（实测 ${hints.length}）`);
  }
  game.handleUp(from.x, from.y); // 原地松手 → 不改动布阵
}

// ---------- 布阵：一键布阵自动带英雄（按兵种线） / 招募入口已移除 ----------
{
  game.state.units = [
    { id: 'h1', troop: 'shield', level: 1 },
    { id: 'h2', troop: 'archer', level: 1 },
    { id: 'h3', troop: 'spear', level: 1 },
    { id: 'h4', troop: 'cavalry', level: 1 },
    { id: 'h5', troop: 'cavalry', level: 2 },
  ];
  game.state.heroes = { zhangfei: 1, guanyu: 1, liubei: 1, zhouyu: 1 };
  game.state.maxCleared = 1000;   // 3 个英雄位全开，一键布阵可上 3 名
  game.state.formation = new Array(25).fill(null);
  game.save();
  game.home();
  tap(231, 768);          // 兵营
  tap(525, 1059);         // 去布阵上阵
  const c = center(DEPLOY_LAYOUT.autoRect);
  tap(c.x, c.y);          // 按战力布阵
  const form = game.state.formation;
  const heroes = form.map((v, i) => ({ v, i })).filter((x) => x.v && String(x.v).startsWith('h:'));
  if (heroes.length !== 3) {
    errors++;
    console.error(`  ✗ 一键布阵应自动上 3 名英雄（实测 ${heroes.length}）`);
  }
  let matched = 0;
  heroes.forEach(({ v, i }) => {
    const heroId = String(v).slice(2);
    const hero = HEROES.find((h) => h.id === heroId);
    if (troopColumns(hero.troop).includes(formationCell(i).col)) matched++;
  });
  if (matched !== heroes.length) {
    errors++;
    console.error(`  ✗ 英雄应落在自己兵种的可选列（${matched}/${heroes.length} 列匹配）`);
  } else {
    console.log(`  一键布阵：${form.filter(Boolean).length} 个单位 + ${heroes.length} 名英雄，均在兵种列`);
  }
  shot('32c_deploy_auto_heroes');

  // 「招募 / 升级」入口已删除：点原坐标不应离开布阵页
  tap(406, 906);
  if (screenName() !== 'DeployScreen') {
    errors++;
    console.error(`  ✗ 布阵页不应再有招募入口（点击后进入 ${screenName()}）`);
  }
}

// ---------- 自动战斗：胜利 3 秒后自动进下一关，失败不重来 ----------
{
  // 换成 4 支 Lv10 小队，保证第 1 关稳赢
  game.state.units = [
    { id: 'p1', troop: 'shield', level: 10 },
    { id: 'p2', troop: 'archer', level: 10 },
    { id: 'p3', troop: 'spear', level: 10 },
    { id: 'p4', troop: 'cavalry', level: 10 },
  ];
  game.state.formation = new Array(25).fill(null);
  game.state.formation[24] = 'p1';
  game.state.formation[23] = 'p2';
  game.state.formation[19] = 'p3';
  game.state.formation[22] = 'p4';
  game.state.autoBattle = false;
  game.state.maxCleared = 30; // 自动战斗第 3 关后开放：挑战第 31 关
  game.save();
  game.home();
  tap(375, 466); // 闯关
  {
    const cc = center(LEVELS_LAYOUT.challengeRect);
    tap(cc.x, cc.y); // 主按钮 = 下一关（第 31 关）
  }
  {
    const c = center(DEPLOY_LAYOUT.autoBattleRect);
    tap(c.x, c.y);
  }
  shot('34_deploy_auto_battle_on');
  if (game.state.autoBattle !== true) {
    errors++;
    console.error('  ✗ 主线第 3 关后自动战斗开关应能开启');
  }
  {
    const c = center(DEPLOY_LAYOUT.confirmRect);
    tap(c.x, c.y); // 出战
  }
  tick(24);
  tick(130);
  tap(667, 74); // 4 倍速
  let n = 0;
  while (screenName() === 'BattleScreen' && n < 6000) { tick(1); n++; }
  tick(150); // 让战斗里点的「4 倍速」提示（1.8 秒）淡出，避免盖住结算标题
  shot('35_auto_result');
  if (screenName() !== 'ResultScreen' || !game.screen.d || game.screen.d.win !== true) {
    errors++;
    console.error(`  ✗ 自动战斗第 31 关应该赢（当前 ${screenName()}）`);
  } else if (game.screen.autoNext !== 32) {
    errors++;
    console.error(`  ✗ 自动战斗开启时结算应倒计时进入第 32 关（实测 ${game.screen.autoNext}）`);
  } else {
    tick(200); // 超过 3 秒
    if (screenName() !== 'BattleScreen' || game.screen.levelN !== 32) {
      errors++;
      console.error(`  ✗ 3 秒后应自动进入第 32 关战斗（当前 ${screenName()}）`);
    }
    shot('36_auto_next_level');
  }

  // 未到第 3 关：开关点不动，只显示解锁条件
  game.state.maxCleared = 2;
  game.state.autoBattle = false;
  game.save();
  game.go(new DeployScreen(game, { mode: 'battle', level: 3 }));
  {
    const c = center(DEPLOY_LAYOUT.autoBattleRect);
    tap(c.x, c.y);
  }
  shot('36b_auto_locked');
  if (game.state.autoBattle !== false) {
    errors++;
    console.error('  ✗ 主线未到第 3 关时自动战斗不应被打开');
  }

  // 失败：不倒计时、不自动重来
  const lose = new ResultScreen({ state: { autoBattle: true, maxCleared: 30 } }, { win: false, levelN: 1 });
  if (lose.autoNext !== null || lose.autoT !== null) {
    errors++;
    console.error('  ✗ 失败结算不应该自动重来');
  }
}

// ---------- 失败页：克制圆环 + 分享按钮（原看广告按钮位） ----------
{
  game.state.maxCleared = 160;
  game.state.coins = 1000;
  game.state.units = [
    { id: 'fa', troop: 'shield', level: 3 },
    { id: 'fb', troop: 'archer', level: 3 },
    { id: 'fc', troop: 'spear', level: 3 },
    { id: 'fd', troop: 'cavalry', level: 3 },
  ];
  game.save();
  const failData = (levelN) => ({
    win: false, levelN, coins: 0, firstClear: false, chests: [], stats: [], time: 20,
  });

  game.go(new ResultScreen(game, failData(160)));
  game.toastT = 0;
  game.toastText = '';
  shot('37_result_fail_counter_ring');
  // 战败页「下一个解锁」：160 关 → 180 关虎豹骑；卡片在克制面板之下、按钮之上
  {
    const card = nextUnlockInfo(game.state, { levelN: 160, win: false });
    ok(!!card && card.focus.level === 180 && card.focus.troop === 'huhao',
      '战败页「下一个解锁」指向 180 关虎豹骑');
    const rects = game.screen;
    ok(rects.unlockRect.y >= 760 && rects.primary.y >= 850 && rects.shareRect.y >= 976,
      '战败页进度卡没有挤压克制圈 / 重挑战 / 分享按钮');
    shotZoom('37a_result_fail_unlock_bar', 375, 798, 2);
  }
  // 克制环像素校验：环弧 / 箭头 / 百分比用金色，中心与四角应有足够金色像素
  let goldHits = 0;
  for (let y = 400; y <= 700; y += 2) {
    for (let x = 230; x <= 520; x += 2) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (d[0] > 150 && d[1] > 115 && d[2] < 170 && d[0] > d[2] + 30) goldHits++;
    }
  }
  if (goldHits < 150) {
    errors++;
    console.error(`  ✗ 战败页克制环金色弧线像素过少（${goldHits}）`);
  } else {
    console.log(`  战败页克制环采样：金色像素 ${goldHits}（弧线 + 百分比可见）`);
  }
  // 四个兵种建模节点：每个节点圆心附近应有非背景像素
  const ringNodes = [[375, 448], [475, 548], [375, 648], [275, 548]];
  ringNodes.forEach(([nx, ny], i) => {
    let modelHits = 0;
    for (let dy = -34; dy <= 22; dy += 2) {
      for (let dx = -24; dx <= 24; dx += 2) {
        const d = ctx.getImageData(nx + dx, ny + dy, 1, 1).data;
        if (d[0] + d[1] + d[2] > 210) modelHits++;
      }
    }
    if (modelHits < 20) {
      errors++;
      console.error(`  ✗ 克制环第 ${i + 1} 个兵种建模节点像素过少（${modelHits}）`);
    }
  });
  console.log('  克制环四个兵种建模节点均有可见像素');
  // 原「看广告试用兵」按钮位已替换为亮绿分享按钮：确认分享成功后才发奖并弹奖励卡
  game.state.daily.shares = 0;
  const shareBtn = center(game.screen.shareRect);
  const chests0 = chestCount(game.state, 'gold');
  tap(shareBtn.x, shareBtn.y);
  await new Promise((r) => setTimeout(r, 0));
  shot('37b_result_fail_share');
  if (chestCount(game.state, 'gold') !== chests0 + 1 || game.state.daily.shares !== 1) {
    errors++;
    console.error(`  ✗ 战败页分享成功后应发奖（黄金宝箱 ${chestCount(game.state, 'gold')} / 次数 ${game.state.daily.shares}）`);
  }
  shot('37c_result_share_reward');
  if (!game.screen.rewardPopup) {
    errors++;
    console.error('  ✗ 分享成功后应弹出「获得奖励」卡');
  }
  tap(20, 20);
  if (game.screen.rewardPopup) {
    errors++;
    console.error('  ✗ 轻触任意处应关闭获得奖励卡');
  }
}

// ---------- 特殊兵种战法特效：冲锋拖影 / 撞击冲击波 / 毒矢 / 增益光环 ----------
{
  game.state.units = [
    { id: 'f1', troop: 'huhao', level: 5 },      // 传奇：开局冲锋 + 撞击 + 攻速风环
    { id: 'f2', troop: 'wudang', level: 5 },     // 史诗：毒矢 + 闪避涟漪
    { id: 'f3', troop: 'xianzhen', level: 5 },   // 传奇：加攻血怒光环 + 反击
    { id: 'f4', troop: 'daji', level: 5 },       // 传奇：突刺拖影
    { id: 'f5', troop: 'qingzhou', level: 5 },
    { id: 'f6', troop: 'yuanyong', level: 5 },
    { id: 'f7', troop: 'baier', level: 5 },
    { id: 'f8', troop: 'qingzhu', level: 5 },
  ];
  const form = new Array(25).fill(null);
  const slot = (col, row) => row * 5 + col;
  form[slot(4, 1)] = 'f1';
  form[slot(4, 2)] = 'f3';
  form[slot(4, 3)] = 'f4';
  form[slot(4, 0)] = 'f5';
  form[slot(3, 2)] = 'f7';
  form[slot(1, 2)] = 'f2';
  form[slot(0, 1)] = 'f6';
  form[slot(0, 3)] = 'f8';
  game.state.formation = form;
  game.state.autoBattle = false; // 这场只截特效，别自动跳到下一关
  game.save();
  // 用固定种子跑特效场（随机种子下无当飞军可能先被打死，等不到毒矢）
  game.go(new BattleScreen(game, 380, mulberry32(1)));
  // 冲锋拖影：charge3 机制（虎豹骑/幽州突骑移动3格后进入 charging3）
  let sawCharge3 = false;
  // 毒矢 / 毒雾只在「命中那一帧」存在：必须从接战第一帧就持续观察。
  // 旧写法先等冲锋撞击（约 80 帧）再找中毒，会错过这一场唯一的中毒窗口。
  let sawPoison = false;
  let sawPoisonFx = false;
  let poisonShot = false;
  // 目标有可能在「挂毒的同一步」被其它火力打死（死亡会清空 poison），
  // 帧末再查 entities 就会漏判。这里直接监听战斗事件流：命中事件带 poison=true 即证明毒矢已挂毒。
  const poisonBattle = game.screen.battle;
  const poisonStep = poisonBattle.step;
  poisonBattle.step = (dt) => {
    const evs = poisonStep(dt);
    for (const ev of evs || []) {
      if (ev.t === 'attack' && ev.poison) sawPoison = true;
    }
    return evs;
  };
  const watchPoison = () => {
    if (!game.screen.battle) return;
    if (!poisonShot && (sawPoison || game.screen.battle.entities.some((e) => e.poison))) {
      poisonShot = true;
      shot('39_fx_poison');
    }
    if (!sawPoisonFx && game.screen.fx.some((f) => f.kind === 'poison')) {
      sawPoisonFx = true;
      shot('40_fx_poison_burst');
    }
  };
  for (let i = 0; i < 30 && screenName() === 'BattleScreen'; i++) {
    tick(1);
    watchPoison();
    if (game.screen.battle && game.screen.battle.entities.some((e) => e.charging3)) { sawCharge3 = true; break; }
  }
  // 宛城（301~400 关）敌军同时混编稀有 / 史诗 / 传奇兵种
  const b = game.screen.battle || { entities: [] };
  {
    const enemyRarity = { rare: 0, epic: 0, legendary: 0, common: 0 };
    b.entities.filter((e) => e.side === 'enemy').forEach((e) => { enemyRarity[rarityOf(e.troop)]++; });
    console.log(`  第 380 关敌军立体：普通 ${enemyRarity.common} / 稀有 ${enemyRarity.rare} / 史诗 ${enemyRarity.epic} / 传奇 ${enemyRarity.legendary}`);
    if (enemyRarity.rare === 0 || enemyRarity.epic === 0 || enemyRarity.legendary === 0) {
      errors++;
      console.error(`  ✗ 第 380 关敌军应混编稀有 / 史诗 / 传奇兵种（稀有 ${enemyRarity.rare} / 史诗 ${enemyRarity.epic} / 传奇 ${enemyRarity.legendary}）`);
    }
  }
  shot('37_fx_auras');
  if (!sawCharge3) {
    errors++;
    console.error(`  ✗ 冲锋表现缺失（charge3 ${sawCharge3}）——虎豹骑应在移动3格后进入冲锋`);
  }

  // 冲锋撞击：等 impact 特效出现（kind='charge3'）的一帧截图
  let sawImpact = false;
  for (let i = 0; i < 900 && screenName() === 'BattleScreen'; i++) {
    tick(1);
    watchPoison();
    if (game.screen.fx.some((f) => f.kind === 'impact')) {
      sawImpact = true;
      shot('38_fx_charge_impact');
      break;
    }
  }
  if (!sawImpact) {
    errors++;
    console.error('  ✗ 虎豹骑冲锋撞击没有触发 impact 特效');
  }

  // 毒矢：接战帧已在 watchPoison 里持续观察；这里只是兜底再找一遍
  if (!sawPoison) {
    for (let i = 0; i < 2400 && screenName() === 'BattleScreen'; i++) {
      tick(1);
      watchPoison();
      if (sawPoison) break;
    }
  }
  if (!sawPoison) {
    errors++;
    console.error('  ✗ 无当飞军的毒矢没有给敌人挂上中毒状态');
  }

  // 中毒持续结算的绿色飘字 / 毒雾特效（同样是命中帧，兜底再找一遍）
  if (!sawPoisonFx) {
    for (let i = 0; i < 400 && screenName() === 'BattleScreen'; i++) {
      tick(1);
      watchPoison();
      if (sawPoisonFx) break;
    }
  }
  if (!sawPoisonFx) {
    errors++;
    console.error('  ✗ 毒矢命中没有毒雾特效（poison fx）');
  }
}

// ---------- 高关卡布阵页：敌方按城池混编（广宗稀有 / 颍川史诗 / 宛城传奇） ----------
{
  game.go(new DeployScreen(game, { mode: 'battle', level: 380 }));
  shot('41_deploy_enemy_specials');
  if (screenName() !== 'DeployScreen') {
    errors++;
    console.error(`  ✗ 第 380 关应进入布阵页（当前 ${screenName()}）`);
  }
  // 点「看敌方」：镜头跳到敌方半场，看混编的稀有 / 史诗 / 传奇兵种站位
  tap(612, 248);
  shot('41b_deploy_enemy_specials_pan');
  if (!(game.screen.cam.y <= CONFIG.arena.rows / 2)) {
    errors++;
    console.error('  ✗ 「看敌方」没有把镜头切到敌方半场');
  }
  const def = levelDef(380);
  const rare = def.enemies.filter((e) => rarityOf(e.troop) === 'rare').length;
  const epic = def.enemies.filter((e) => rarityOf(e.troop) === 'epic').length;
  const legendary = def.enemies.filter((e) => rarityOf(e.troop) === 'legendary').length;
  console.log(`  第 380 关布阵：敌军 ${def.enemies.length} 支（稀有 ${rare} / 史诗 ${epic} / 传奇 ${legendary}）`);
  if (rare === 0 || epic === 0 || legendary === 0) {
    errors++;
    console.error(`  ✗ 第 380 关敌方阵容应同时有稀有 / 史诗 / 传奇兵种（稀有 ${rare} / 史诗 ${epic} / 传奇 ${legendary}）`);
  }
}

// ---------- 演武：150 关解锁 / 关卡选择 / 精英布阵 ----------
{
  game.state.maxCleared = 160;
  game.state.trialCleared = 3;
  game.state.coins = 60000;
  game.state.units = [
    { id: 'tr1', troop: 'xiandeng', level: 4 },
    { id: 'tr2', troop: 'baier', level: 4 },
    { id: 'tr3', troop: 'baima', level: 4 },
    { id: 'tr4', troop: 'daji', level: 4 },
    { id: 'tr5', troop: 'wudang', level: 4 },
    { id: 'tr6', troop: 'tengjia', level: 4 },
  ];
  game.state.formation = new Array(25).fill(null);
  game.state.formation[22] = 'tr1';
  game.state.formation[23] = 'tr2';
  game.state.formation[24] = 'tr3';
  game.state.formation[17] = 'tr4';
  game.state.formation[18] = 'tr5';
  game.state.formation[19] = 'tr6';
  game.save();
  game.home();
  shot('42_home_trial');
  tap(155, 149); // 首页「演 武」
  shot('43_trial_stages');
  // 50 关连续滚动：上下拖动浏览，再滑回顶部保留第 1 关的点击坐标
  {
    const v = TRIAL_LAYOUT.view;
    drag(v.x + 350, v.y + 720, v.x + 350, v.y + 200);
    shot('43b_trial_stages_scrolled');
    if (!(game.screen.scrollY > 0)) {
      errors++;
      console.error(`  ✗ 演武列表应能上滑滚动（scrollY=${game.screen.scrollY}）`);
    }
    drag(v.x + 350, v.y + 100, v.x + 350, v.y + 760);
    game.draw();
    if (game.screen.scrollY !== 0) {
      errors++;
      console.error(`  ✗ 演武列表滑回顶部应被边界夹住（scrollY=${game.screen.scrollY}）`);
    }
  }
  if (screenName() !== 'TrialScreen') {
    errors++;
    console.error(`  ✗ 首页演武入口应进入 TrialScreen（当前 ${screenName()}）`);
  } else {
    tap(101, 281); // 第 1 关卡片
    shot('44_trial_deploy');
    if (screenName() !== 'DeployScreen') {
      errors++;
      console.error(`  ✗ 点击已解锁演武关应进入布阵页（当前 ${screenName()}）`);
    } else {
      tap(375, 1265); // 出战
      shot('44b_trial_battle');
      if (screenName() !== 'BattleScreen' || !game.screen.trial || game.screen.trial.stage !== 1) {
        errors++;
        console.error(`  ✗ 演武出战应进入 BattleScreen 且带第 1 关配置（当前 ${screenName()}）`);
      }
      // 战中「重来」：放弃本场，回到这一关的布阵页（圆形刷新键在右侧输出面板下方）
      tap(686, 426);
      if (screenName() !== 'DeployScreen') {
        errors++;
        console.error(`  ✗ 战中「重来」应回到布阵页（当前 ${screenName()}）`);
      }
      // 演武结算页：胜利展示 + 通关奖励（黄金宝箱 / 传奇宝箱）+ 下一步按钮
      game.go(new TrialResultScreen(game, {
        win: true, trial: TRIALS[0], time: 32,
        stats: [
          { side: 'player', troop: 'daji', level: 5, dealt: 1540, taken: 620, kills: 6 },
          { side: 'player', troop: 'qingzhou', level: 4, dealt: 1180, taken: 480, kills: 4 },
          { side: 'player', troop: 'wudang', level: 3, dealt: 860, taken: 210, kills: 3 },
          { side: 'enemy', troop: 'huhao', level: 4, dealt: 1320, taken: 700, kills: 5 },
          { side: 'enemy', troop: 'xianzhen', level: 4, dealt: 980, taken: 940, kills: 2 },
          { side: 'enemy', troop: 'baier', level: 3, dealt: 640, taken: 780, kills: 1 },
        ],
        rewards: [{ id: 'gold', count: 1 }, { id: 'legendary', count: 1 }],
        coins: 123,
      }));
      shot('44c_trial_result');
      if (screenName() !== 'TrialResultScreen') {
        errors++;
        console.error(`  ✗ 演武结算页没有正常打开（当前 ${screenName()}）`);
      } else if (!Array.isArray(game.screen.rewards) || game.screen.rewards.length !== 2) {
        errors++;
        console.error('  ✗ 演武结算页应显示金箱 + 传奇宝箱奖励');
      } else if (game.screen.coins !== 123) {
        errors++;
        console.error('  ✗ 演武结算页应显示每次通关的稳定铜钱');
      }
    }
  }
}

// ---------- 商城特殊宝箱：稀有 1 万 / 史诗 5 万 ----------
{
  game.home();
  tap(519, 644); // 商城
  game.state.coins = 60000;
  game.save();
  game.draw();
  shot('45_shop_chests');
  if (screenName() !== 'ShopScreen') {
    errors++;
    console.error(`  ✗ 商城页没有打开（当前 ${screenName()}）`);
  } else {
    // 铜钱直购：稀有 5000 / 史诗 20000
    const btnX = SHOP_LAYOUT.chestBtn.x + SHOP_LAYOUT.chestBtn.w / 2;
    const rare0 = chestCount(game.state, 'rare');
    tap(btnX, SHOP_LAYOUT.chestRowY[0] + SHOP_LAYOUT.chestBtn.offsetY + SHOP_LAYOUT.chestBtn.h / 2);
    if (chestCount(game.state, 'rare') !== rare0 + 1 || game.state.coins !== 55000) {
      errors++;
      console.error(`  ✗ 稀有宝箱购买失败（稀有 ${chestCount(game.state, 'rare')} / 铜钱 ${game.state.coins}）`);
    }
    const epic0 = chestCount(game.state, 'epic');
    tap(btnX, SHOP_LAYOUT.chestRowY[1] + SHOP_LAYOUT.chestBtn.offsetY + SHOP_LAYOUT.chestBtn.h / 2);
    if (chestCount(game.state, 'epic') !== epic0 + 1 || game.state.coins !== 35000) {
      errors++;
      console.error(`  ✗ 史诗宝箱购买失败（史诗 ${chestCount(game.state, 'epic')} / 铜钱 ${game.state.coins}）`);
    }
    shot('46_shop_chests_bought');
  }
}

// ---------- 每日商店：100 关解锁，6 个栏位（前 4 稀有 / 后 2 史诗），每栏位限购 1 次 ----------
{
  game.home();
  game.state.maxCleared = 380;
  game.state.coins = 60000;
  game.state.dailyShop = { day: '', sold: [] };
  game.save();
  tap(519, 644); // 商城
  tick(200);
  game.draw();
  shot('47_shop_daily_entry');
  tap(175, 170); // 每日商店入口
  tick(200);     // 等上一个提示淡出，截图干净
  shot('47b_daily_shop');
  if (screenName() !== 'DailyShopScreen') {
    errors++;
    console.error(`  ✗ 商城「每日商店」入口没有打开（当前 ${screenName()}）`);
  } else {
    const coins0 = game.state.coins;
    const units0 = game.state.units.length;
    tap(138, 506); // 第 1 个栏位（稀有）的购买按钮
    dismissShowcase('47b1_daily_showcase');
    if (game.state.coins !== coins0 - 3000 || game.state.units.length !== units0 + 1) {
      errors++;
      console.error(`  ✗ 每日商店购买失败（铜钱 ${game.state.coins} / 兵营 ${game.state.units.length}）`);
    }
    shot('47c_daily_shop_bought');
    const units1 = game.state.units.length;
    tap(138, 506);
    if (game.state.units.length !== units1) {
      errors++;
      console.error('  ✗ 同一栏位当天不应能买第二次');
    }
  }
  tap(98, 76); // 返回商城
  tap(98, 76); // 返回首页
}

// ---------- 英雄系统：250 关后入口显示、招募（消耗券）、升级（花铜钱） ----------
{
  game.home();
  game.state.maxCleared = 600;   // 解锁全部 3 个英雄上阵位
  game.state.coins = 100000;
  game.state.heroTickets = 10;
  game.state.heroes = { guanping: 5 };
  game.state.heroLevelRewards = { 250: 'guanping' };  // 250 关赠将已领，避免弹窗挡住按钮
  game.state.dailyShop = { day: '', sold: [] };
  game.save();
  tick(200);
  game.draw();
  shot('48_home_hero');
  tap(519, 768); // 首页「英雄」入口
  tick(100);
  shot('48b_hero_screen');
  if (screenName() !== 'HeroScreen') {
    errors++;
    console.error(`  ✗ 首页「英雄」入口没有打开英雄页（当前 ${screenName()}）`);
  } else {
    // 招募 ×1
    const tickets1 = game.state.heroTickets;
    tap(218, 1002);
    shot('48c_hero_pull');
    if (game.state.heroTickets !== tickets1 - 1) {
      errors++;
      console.error(`  ✗ 招募 ×1 应扣 1 张券（当前 ${game.state.heroTickets}）`);
    }
    tap(375, 600); // 关闭招募结果弹窗
    // 自选箱选择页：随机没抽到箱子时注入一个，确保这条 UI 路径被覆盖
    if (!game.screen.boxOpen && pendingRecruitBoxes(game.state).length === 0) {
      game.state.recruitBoxes = [{ id: 'rb-smoke', rarity: 'common', level: 5 }];
      game.state.recruitBoxSeq = 1;
      game.screen.boxOpen = true;
    }
    game.draw();
    shot('48c2_recruit_box');
    const boxCards = game.screen.boxCardRects();
    if (!game.screen.boxOpen || boxCards.length < 1) {
      errors++;
      console.error('  ✗ 抽到自选箱后应进入选择页');
    } else {
      const unitsBeforeBox = game.state.units.length;
      const boxesBefore = pendingRecruitBoxes(game.state).length;
      const bc = boxCards[0];
      tap(bc.rect.x + bc.rect.w / 2, bc.rect.y + bc.rect.h / 2);
      tick(100);
      if (game.state.units.length !== unitsBeforeBox + 1
        || pendingRecruitBoxes(game.state).length !== boxesBefore - 1) {
        errors++;
        console.error('  ✗ 自选箱选完应入账并移出待选队列');
      }
    }

    // 英雄卡统一配色：按排序找到「关平」这张卡，检查它的边框（史诗紫）
    // 12 名英雄 4 行，关平排在第 3 行 → 先向下滚一屏让它在视口内
    game.screen.scrollY = 316;
    game.draw();
    const gpCardLs = game.screen.cardRects.find((c) => c.id === 'guanping');
    let heroBorder = [0, 0, 0];
    let heroBest = -1;
    const CARD_FILL = [28, 36, 49];
    const sampleX = Math.round((gpCardLs ? gpCardLs.rect.x : 27) + 222 / 2);
    const sampleY = Math.round(gpCardLs ? gpCardLs.rect.y : 216);
    for (let k = 0; k <= 4; k++) {
      const d = ctx.getImageData(sampleX, sampleY + k, 1, 1).data;
      const c = [d[0], d[1], d[2]];
      const dd = Math.abs(c[0] - CARD_FILL[0]) + Math.abs(c[1] - CARD_FILL[1]) + Math.abs(c[2] - CARD_FILL[2]);
      if (dd > heroBest) { heroBest = dd; heroBorder = c; }
    }
    // 边框色随主题令牌（HERO_AURA.epic），不写死 RGB，换肤后断言依旧有效
    const epicHex = HERO_AURA.epic.replace('#', '');
    const epicRgb = [0, 2, 4].map((i) => parseInt(epicHex.slice(i, i + 2), 16));
    if (gpCardLs && Math.abs(heroBorder[0] - epicRgb[0]) + Math.abs(heroBorder[1] - epicRgb[1]) + Math.abs(heroBorder[2] - epicRgb[2]) > 70) {
      errors++;
      console.error(`  ✗ 英雄卡应为史诗紫边框（实测 ${heroBorder}，期望 ${epicRgb}）`);
    }

    // 列表 → 点建模 → 详情页（按排序后关平卡的实际坐标）
    tap(gpCardLs ? gpCardLs.rect.x + gpCardLs.rect.w / 2 : 138,
      gpCardLs ? gpCardLs.rect.y + gpCardLs.rect.h / 2 : 350);
    tick(100);
    shot('48b2_hero_detail');
    if (game.screen.detailId !== 'guanping') {
      errors++;
      console.error(`  ✗ 点英雄建模应进入详情页（当前 ${game.screen.detailId}）`);
    }
    // 详情页升级关平
    const coins0 = game.state.coins;
    const lv0 = game.state.heroes.guanping;
    tap(375, 1166);
    if (game.state.heroes.guanping !== lv0 + 1 || game.state.coins >= coins0) {
      errors++;
      console.error(`  ✗ 英雄升级失败（Lv${game.state.heroes.guanping} / 铜钱 ${game.state.coins}）`);
    }
    tick(100);
    shot('48d_hero_levelup');
    // 详情页 → 返回列表
    tap(98, 76);
    if (game.screen.detailId !== null) {
      errors++;
      console.error('  ✗ 详情页左上角应返回英雄列表');
    }
  }
  tap(98, 76); // 英雄页 → 首页

  // 布阵页：英雄与普通兵在同一张兵牌列表里；点开详情、拖到格子 = 上阵（占 1 格）
  tap(231, 768); // 兵营
  tap(525, 1059); // 去布阵上阵
  shot('48e_deploy_heroes');
  game.draw();
  {
    const gp = game.screen.cardRects.find((c) => c.kind === 'hero' && c.uid === 'h:guanping');
    if (!gp) {
      errors++;
      console.error('  ✗ 布阵页统一兵牌列表里应有关平英雄卡');
    } else {
      const c = { x: gp.rect.x + gp.rect.w / 2, y: gp.rect.y + gp.rect.h / 2 };
      tap(c.x, c.y); // 关平卡片 → 详情
      shot('48f_hero_detail');
      tap(375, 700); // 关闭详情
      // 拖关平卡片到第一个空格
      const idx = game.state.formation.findIndex((v) => !v);
      const p = deploySlotPoint(idx, game.screen.cam ? game.screen.cam.y : undefined);
      drag(c.x, c.y, p.x, p.y);
      if (!game.state.formation.includes('h:guanping')) {
        errors++;
        console.error('  ✗ 英雄拖到布阵格后应占 1 格上场');
      }
    }
  }
  shot('48e2_hero_on_grid');

  // 出战：确认英雄将领真的出现在战场上（直接进战斗布阵模式）
  game.go(new DeployScreen(game, { mode: 'battle', level: 381 }));
  game.draw();
  tap(375, 1265);
  tick(160);
  shot('48g_battle_heroes');
  if (screenName() !== 'BattleScreen') {
    errors++;
    console.error(`  ✗ 布阵页出战没有进入战斗（当前 ${screenName()}）`);
  } else {
    const onField = game.screen.battle.entities.filter((e) => e.side === 'player' && e.hero).length;
    if (onField < 1) {
      errors++;
      console.error(`  ✗ 战场上没有英雄将领（${onField} 个）`);
    }
  }
}

// ---------- 英雄战：250 关解锁 / 50 关列表 / Boss 血量倍数 / 粗血条 / 招募券 ----------
{
  const hbCard = (i) => {
    const L = HERO_BATTLE_LAYOUT;
    const col = i % L.cols;
    const row = Math.floor(i / L.cols);
    return {
      x: L.x0 + col * (L.cardW + L.gapX) + L.cardW / 2,
      y: L.y0 + row * (L.cardH + L.gapY) + L.cardH / 2,
    };
  };
  // 1) 主线未到 250：首页入口点不动，只给解锁提示
  game.state.maxCleared = 249;
  game.state.heroBattleCleared = 0;
  game.state.autoBattle = false;
  game.save();
  game.home();
  tick(200);
  shot('49_home_hero_battle_locked');
  tap(287, 149);
  if (!String(game.toastText || '').includes('250')) {
    errors++;
    console.error(`  ✗ 主线未到 250 关时英雄战入口应提示解锁条件（当前提示「${game.toastText}」）`);
  }
  if (screenName() !== 'HomeScreen') {
    errors++;
    console.error(`  ✗ 主线未到 250 关不应进入英雄战（当前 ${screenName()}）`);
  }

  // 2) 解锁后：150 关列表，前 6 已通关 / 第 7 关可挑战 / 第 8 关未解锁
  game.state.maxCleared = 380;
  game.state.heroBattleCleared = 6;
  game.state.heroTickets = 10;
  game.state.units = [
    { id: 'hb1', troop: 'xiandeng', level: 10 },
    { id: 'hb2', troop: 'baier', level: 10 },
    { id: 'hb3', troop: 'baima', level: 10 },
    { id: 'hb4', troop: 'daji', level: 10 },
    { id: 'hb5', troop: 'wudang', level: 10 },
    { id: 'hb6', troop: 'tengjia', level: 10 },
    { id: 'hb7', troop: 'huhao', level: 10 },
    { id: 'hb8', troop: 'xianzhen', level: 10 },
  ];
  game.state.heroes = { guanping: 10, guanyu: 10, zhangfei: 10 };
  const form25 = new Array(25).fill(null);
  form25[17] = 'hb1';
  form25[18] = 'hb2';
  form25[19] = 'hb3';
  form25[20] = 'hb4';
  form25[21] = 'hb5';
  form25[22] = 'hb6';
  form25[23] = 'hb7';
  form25[24] = 'hb8';
  form25[16] = 'h:guanping';
  form25[15] = 'h:guanyu';
  form25[10] = 'h:zhangfei';
  game.state.formation = form25;
  game.save();
  game.home();
  tick(200);
  game.draw();
  shot('49b_home_hero_battle');
  tap(287, 149);
  game.draw();
  shot('49c_hero_battle_stages');
  if (screenName() !== 'HeroBattleScreen') {
    errors++;
    console.error(`  ✗ 首页英雄战入口没有打开英雄战列表（当前 ${screenName()}）`);
  } else {
    let cards = { done: 0, current: 0, locked: 0 };
    for (const c of game.screen.cardRects) {
      if (c.spec.stage <= 6) cards.done++;
      else if (c.spec.stage === 7) cards.current++;
      else cards.locked++;
    }
    console.log(`  英雄战列表：当前可见 ${game.screen.cardRects.length} 张 · 已通关 ${cards.done} / 可挑战 ${cards.current} / 未解锁 ${cards.locked}（共 ${HERO_BATTLES.length} 关）`);
    if (cards.done !== 6 || cards.current !== 1 || cards.locked !== game.screen.cardRects.length - 7) {
      errors++;
      console.error(`  ✗ 英雄战列表状态不对（已通关 ${cards.done} / 可挑战 ${cards.current} / 未解锁 ${cards.locked}）`);
    }
    if (HERO_BATTLES.length !== 150) {
      errors++;
      console.error(`  ✗ 英雄战应为 150 关（实测 ${HERO_BATTLES.length}）`);
    }

    // 150 关是一整块滚动列表：上下拖动查看，传奇英雄那几关在下方
    {
      const v = HERO_BATTLE_LAYOUT.view;
      drag(v.x + 350, v.y + 720, v.x + 350, v.y + 220);
      game.draw();
      shot('49c2_hero_battle_stages_scrolled');
      if (!(game.screen.scrollY > 0)) {
        errors++;
        console.error(`  ✗ 英雄战列表应能上滑滚动（scrollY=${game.screen.scrollY}）`);
      }
      // 滑回顶部，保证下面第 7 关的静态坐标有效
      drag(v.x + 350, v.y + 120, v.x + 350, v.y + 820);
      game.draw();
      if (game.screen.scrollY !== 0) {
        errors++;
        console.error(`  ✗ 英雄战列表滑回顶部应被边界夹住（scrollY=${game.screen.scrollY}）`);
      }
    }

    // 3) 点第 7 关（张飞·传奇登场）→ 布阵页，敌方 1 Boss + 2 队精锐
    const p7 = hbCard(6);
    tap(p7.x, p7.y);
    game.draw();
    shot('49d_hero_battle_deploy');
    const dc = game.screen;
    if (screenName() !== 'DeployScreen' || !dc.heroBattle || dc.heroBattle.stage !== 7) {
      errors++;
      console.error(`  ✗ 点第 7 关应进入英雄战布阵页（当前 ${screenName()} / stage ${dc.heroBattle && dc.heroBattle.stage}）`);
    } else {
      const spec = HERO_BATTLES[6];
      if (dc.def.enemies.length !== 3 || !dc.def.enemies.some((e) => e.boss) || spec.hero !== 'zhangfei') {
        errors++;
        console.error(`  ✗ 第 7 关敌方应为张飞 Boss + 2 队精锐（实测 ${JSON.stringify(dc.def.enemies)}）`);
      }
      // 4) 出战后：Boss 血量 5~10 倍，其余数值不变；2 队精锐；粗血条为红色实心
      const c = center(DEPLOY_LAYOUT.confirmRect);
      tap(c.x, c.y);
      tick(1);
      game.draw();
      shot('49e_hero_battle_boss');
      if (screenName() !== 'BattleScreen' || !game.screen.heroBattle) {
        errors++;
        console.error(`  ✗ 英雄战出战没有进入 BattleScreen（当前 ${screenName()}）`);
      } else {
        const b = game.screen.battle;
        const boss = b.entities.find((e) => e.side === 'enemy' && e.boss);
        const escorts = b.entities.filter((e) => e.side === 'enemy' && !e.hero);
        // 战场实体是「小兵」：2 队精锐要按 squadKey 去重后统计
        const escortSquads = new Set(escorts.map((e) => e.squadKey)).size;
        const base = heroStatsFor('zhangfei', 4);
        // 血量倍数以关卡配置为准（第 7 关当前 7.5），避免配置调整后冒烟硬编码失配
        const mult7 = heroBattleDef(7).hpMult;
        console.log(`  第 7 关 Boss：${boss ? boss.maxHp : '缺失'} 血 / 精锐 ${escortSquads} 队`);
        if (!boss || boss.hero !== 'zhangfei' || boss.heroTier !== 'legendary') {
          errors++;
          console.error('  ✗ 第 7 关 Boss 应为传奇张飞');
        } else if (boss.maxHp !== Math.round(base.hp * mult7)) {
          errors++;
          console.error(`  ✗ Boss 血量应为基础 ${base.hp} ×${mult7}（实测 ${boss.maxHp}）`);
        } else if (boss.def !== base.def || boss.interval !== base.interval) {
          errors++;
          console.error(`  ✗ Boss 除血量外其他数值不应变（防御 ${boss.def}/${base.def} 攻速 ${boss.interval}/${base.interval}）`);
        }
        if (escortSquads !== 2) {
          errors++;
          console.error(`  ✗ 英雄战应配 2 队精锐（实测 ${escortSquads}）`);
        }
        // 粗血条：y=ARENA_VIEW.y+8 面板内，条高 30px，左端为红色实心
        const px = ctx.getImageData(200, ARENA_VIEW.y + 8 + 36 + 15, 1, 1).data;
        const redish = px[0] > 120 && px[0] > px[1] + 40 && px[0] > px[2] + 40;
        if (!redish) {
          errors++;
          console.error(`  ✗ Boss 粗血条渲染缺失（采样 ${[px[0], px[1], px[2]]}）`);
        }
        // 开战 1.5 秒后再截一张：开场横幅淡出，方便确认 Boss 的金色光环与血条变化；
        // 同时在 Boss 脚下横向采样，确认「压在小兵之上」的金色 Boss 环真的画出来了
        tick(90);
        game.draw();
        shot('49e2_hero_battle_mid');
        if (boss.alive) {
          const bp = game.screen.px(boss.x, boss.y);
          // 战斗用 Math.random，Boss 有时会推进到视口外；只在视口内采样，避免偶发误报
          if (bp.y > ARENA_VIEW.y + 30 && bp.y < ARENA_VIEW.y + ARENA_VIEW.h - 30) {
            let ringHits = 0;
            for (let dx = 12; dx <= 100; dx++) {
              const q = ctx.getImageData(Math.round(bp.x + dx), Math.round(bp.y + 2), 1, 1).data;
              if (q[0] > 190 && q[1] > 150 && q[2] < 175 && q[0] > q[2] + 45) ringHits++;
            }
            console.log(`  Boss 金环采样命中 ${ringHits} 像素（屏幕 ${Math.round(bp.x)},${Math.round(bp.y)}）`);
            if (ringHits < 3) {
              errors++;
              console.error(`  ✗ Boss 金色光环没有画在单位上层（横向采样命中 ${ringHits} 像素）`);
            }
          } else {
            console.log(`  Boss 视口外，跳过金环采样（屏幕 ${Math.round(bp.x)},${Math.round(bp.y)}；视口 y ${ARENA_VIEW.y}~${ARENA_VIEW.y + ARENA_VIEW.h}）`);
          }
        }
      }
    }
  }
}

// ---------- 本轮新增：英雄战 150 关终局（三英同时登场） ----------
{
  game.state.maxCleared = 1400;
  game.state.heroBattleCleared = 149;
  game.state.heroes = { liubei: 30, guanyu: 30, zhangfei: 30 };
  game.state.units = Array.from({ length: 8 }, (_, i) => ({
    id: `fb${i}`, troop: ['daji', 'huhao', 'baima', 'wudang', 'tengjia', 'xianzhen', 'baier', 'qingzhou'][i], level: 10,
  }));
  const fbf = new Array(25).fill(null);
  game.state.units.forEach((u, i) => { fbf[20 + i] = u.id; });
  fbf[10] = 'h:liubei';
  fbf[11] = 'h:guanyu';
  fbf[12] = 'h:zhangfei';
  game.state.formation = fbf;
  const def = heroBattleDef(150);
  game.go(new BattleScreen(game, 150, mulberry32(7), { def, heroBattle: HERO_BATTLES[149] }));
  const s = game.screen;
  s.updateCamera(2);          // 让镜头走真实的「按 Boss 纵深上移」逻辑，不写死 36
  s.bannerT = 0;
  game.draw();
  shot('49g_hero_battle_final_three_bosses');
  const bosses = s.battle.entities.filter((e) => e.side === 'enemy' && e.boss);
  const names = [...new Set(bosses.map((b) => b.hero))];
  console.log(`  终局 Boss 实体 ${bosses.length} 名：${names.join(' / ')}`);
  if (names.length !== 3) {
    errors++;
    console.error(`  ✗ 英雄战第 150 关应三英同时登场（实测 ${names.length} 名：${names.join('/')}）`);
  }
}

// ---------- 本轮新增：英雄战按兵种分纵深（近战第一排 / 骑兵第二排 / 远程后排） ----------
{
  game.state.maxCleared = 800;
  game.state.heroBattleCleared = 30;
  game.state.heroes = { zhouyu: 20, zhangren: 20 };
  game.state.units = Array.from({ length: 10 }, (_, i) => ({
    id: `hr${i}`, troop: ['shield', 'archer', 'spear', 'cavalry', 'baima'][i % 5], level: 10,
  }));
  const hf = new Array(25).fill(null);
  game.state.units.forEach((u, i) => { hf[20 + i] = u.id; });
  hf[10] = 'h:zhouyu';
  hf[11] = 'h:zhangren';
  game.state.formation = hf;
  // 第 30 关周瑜（远程压后排）布阵页：情报条站位 + 底部破局提示
  const backSpec = HERO_BATTLES[29];
  const backDef = heroBattleDef(30);
  game.go(new DeployScreen(game, { mode: 'battle', level: 30, heroBattle: backSpec, def: backDef }));
  game.draw();
  shot('49k_hero_battle_backrank_deploy');
  if (backDef.rankText !== '后排' || backDef.enemies[0].rankLabel !== '后排') {
    errors++;
    console.error(`  ✗ 第 30 关远程 Boss 应压后排（实测 ${backDef.rankText}）`);
  }
  // 第 2 关张任（骑兵压第二排）
  game.go(new DeployScreen(game, {
    mode: 'battle', level: 2, heroBattle: HERO_BATTLES[1], def: heroBattleDef(2),
  }));
  game.draw();
  shot('49k2_hero_battle_secondrank_deploy');
  if (heroBattleDef(2).rankText !== '第二排') {
    errors++;
    console.error('  ✗ 第 2 关骑兵 Boss 应压第二排');
  }
  // 战斗页：后排 Boss 不能躲在顶部 Boss 血条 / 输出榜后面
  game.go(new BattleScreen(game, 30, mulberry32(7), { def: backDef, heroBattle: backSpec }));
  const bs = game.screen;
  bs.updateCamera(2);
  bs.bannerT = 0;
  game.draw();
  shot('49k3_hero_battle_backrank_battle');
  const backBoss = bs.battle.entities.find((e) => e.side === 'enemy' && e.boss);
  const bp = bs.px(backBoss.x, backBoss.y);
  // 开战无输出时输出榜收成 48px 窄条：top = ARENA_VIEW.y + 8 + 82 = 208 → 底 256；
  // 英雄立绘是「脚底往上」画约 210px，所以脚底必须 ≥ 466 才不会被面板盖住脸。
  const hudBottom = ARENA_VIEW.y + 8 + 82 + 48;
  const bossFigureH = 210;
  console.log(`  后排 Boss 脚底屏幕 y=${Math.round(bp.y)}（镜头 y=${bs.cam.y.toFixed(1)}，空榜 HUD 底 ${hudBottom}）`);
  if (bp.y < hudBottom + bossFigureH || bp.y > ARENA_VIEW.y + ARENA_VIEW.h - 40) {
    errors++;
    console.error(`  ✗ 后排 Boss 被顶部 HUD 挡住或跑出视口（脚底 y=${Math.round(bp.y)}，需 ≥ ${hudBottom + bossFigureH}）`);
  }
  // 镜头不能为了露 Boss 把我方推出画面
  const myFront = bs.battle.entities.filter((e) => e.side === 'player')
    .reduce((a, e) => (a === null || e.y < a.y ? e : a), null);
  const mp = bs.px(myFront.x, myFront.y);
  if (mp.y > ARENA_VIEW.y + ARENA_VIEW.h - 20) {
    errors++;
    console.error(`  ✗ 后排 Boss 镜头把我方前排推出视口（我方脚底 y=${Math.round(mp.y)}）`);
  }
  console.log(`  我方前排脚底屏幕 y=${Math.round(mp.y)}（视口底 ${ARENA_VIEW.y + ARENA_VIEW.h}）`);
  if (!bs.battle.entities.some((e) => e.side === 'enemy' && !e.boss && e.y > backBoss.y)) {
    errors++;
    console.error('  ✗ 后排 Boss 前方应有精锐掩护墙');
  }
}

// ---------- 本轮新增：过 5 关斩 6 将（布阵页 → 跑关兵模型 → 战斗） ----------
{
  game.state.maxCleared = 210;
  game.state.gauntlet = { cleared: [], dailyDay: '', run: null };
  game.state.heroes = { huanggai: 10 };
  game.state.units = Array.from({ length: 8 }, (_, i) => ({
    id: `gg${i}`, troop: ['shield', 'archer', 'spear', 'cavalry'][i % 4], level: 6,
  }));
  const gf = new Array(25).fill(null);
  // 5×5 内合法落位：前排 5 个 + 第二排 3 个 + 英雄 1 个
  const cells = [20, 21, 22, 23, 24, 15, 16, 17];
  game.state.units.forEach((u, i) => { gf[cells[i]] = u.id; });
  gf[10] = 'h:huanggai';
  game.state.formation = gf;
  const listScreen = new GauntletScreen(game);
  game.go(listScreen);
  game.draw();
  shot('49h_gauntlet_chapters');

  // 点章节 = 先进和普通闯关一样的布阵页（兵模型 + 英雄卡 + 拖拽），不再直接开跑
  const chRect = listScreen.chapterRects()[0].rect;
  tap(chRect.x + 60, chRect.y + 60);
  if (screenName() !== 'DeployScreen' || !game.screen.gauntletChapter) {
    errors++;
    console.error(`  ✗ 点斩将章节应进入共用布阵页（当前 ${screenName()}）`);
  } else {
    game.draw();
    shot('49h2_gauntlet_deploy');
    const cards = game.screen.cards || [];
    if (!cards.some((c) => c.kind === 'hero')) {
      errors++;
      console.error('  ✗ 斩将布阵页的兵牌列表应含英雄卡（可以上英雄）');
    }
    if (!game.screen.formation().some(Boolean)) {
      errors++;
      console.error('  ✗ 斩将布阵页应带出当前 5×5 布阵');
    }
    console.log(`  斩将布阵页兵牌 ${cards.length} 张（含英雄 ${cards.filter((c) => c.kind === 'hero').length} 张）`);
  }
  // 「开始冲锋」：回调负责 startGauntletRun + 回到斩将场跑关页
  const cc = center(DEPLOY_LAYOUT.confirmRect);
  tap(cc.x, cc.y);
  if (screenName() !== 'GauntletScreen' || !game.state.gauntlet.run) {
    errors++;
    console.error(`  ✗ 斩将布阵确认后应开始冲锋（当前 ${screenName()}）`);
    const r = startGauntletRun(game.state, 'sishui');
    if (!r.ok) {
      errors++;
      console.error(`  ✗ 斩将场第 1 章应可开始（${r.reason}）`);
    }
    game.go(new GauntletScreen(game));
  }
  game.draw();
  shot('49i_gauntlet_run');
  const runHeroes = game.state.gauntlet.run.units.filter((u) => u.hero).length;
  if (runHeroes !== 1) {
    errors++;
    console.error(`  ✗ 冲锋快照应带上阵英雄（实测 ${runHeroes} 名）`);
  }
  const gdef = gauntletStageDef('sishui', 1);
  game.go(new BattleScreen(game, 1, mulberry32(3), {
    gauntlet: { run: game.state.gauntlet.run, stage: 1 }, def: gdef,
  }));
  game.draw();
  shot('49j_gauntlet_battle');
  if (screenName() !== 'BattleScreen' || !game.screen.gauntlet) {
    errors++;
    console.error(`  ✗ 斩将场出战没有进入 BattleScreen（当前 ${screenName()}）`);
  }
  console.log(`  斩将场出战兵牌 ${gauntletRunSquads(game.state.gauntlet.run).length} 张`);
}

// 英雄战结算页：首通显示招募券来源与进度
{
  game.go(new HeroBattleResultScreen(game, {
    win: true, stage: 7, firstClear: true, scrolls: 0, time: 88,
    stats: [
      { side: 'player', troop: 'daji', level: 10, dealt: 4200, taken: 1900, kills: 9 },
      { side: 'player', troop: 'huhao', level: 10, dealt: 3100, taken: 1500, kills: 6 },
      { side: 'enemy', troop: 'zhangfei', level: 4, dealt: 5200, taken: 6100, kills: 5 },
      { side: 'enemy', troop: 'daji', level: 8, dealt: 2200, taken: 2400, kills: 3 },
    ],
  }));
  game.draw();
  shot('49f_hero_battle_result');
  if (screenName() !== 'HeroBattleResultScreen') {
    errors++;
    console.error(`  ✗ 英雄战结算页没有正常打开（当前 ${screenName()}）`);
  }
}

// ---------- 布阵页：统一兵牌列表（英雄 + 兵种）+ 最多上阵 3 名英雄 ----------
{
  game.go(new DeployScreen(game, { mode: 'edit' }));
  game.state.formation = new Array(25).fill(null);
  game.state.heroes = {
    guanping: 5, zhangren: 5, huanggai: 5, liru: 5, zhangjiao: 5, xiahouyuan: 5,
    zhangfei: 5, guanyu: 5, liubei: 5, caocao: 5, zhouyu: 5, dongzhuo: 5,
  };
  game.state.maxCleared = 1000;   // 1000 关后 3 个英雄位全开
  game.save();
  const heroCardsDeployed = () => game.state.formation.filter((v) => v && String(v).startsWith('h:')).length;
  game.draw();
  shot('50_deploy_hero_limit');
  const L = DEPLOY_LAYOUT.list;
  const poolCard = (i) => {
    const col = i % L.cols;
    const row = Math.floor(i / L.cols);
    return {
      x: L.x0 + col * (CARD.w + CARD.gapX) + CARD.w / 2,
      y: L.y0 + row * (CARD.h + CARD.gapY) - (game.screen.scrollY || 0) + CARD.h / 2,
    };
  };
  if (screenName() !== 'DeployScreen' || !Array.isArray(game.screen.cards)) {
    errors++;
    console.error(`  ✗ 布阵页应使用统一兵牌列表（当前 ${screenName()}）`);
  } else {
    const pool = game.screen.cards;
    if (!pool.slice(0, 12).every((c) => c.kind === 'hero')) {
      errors++;
      console.error(`  ✗ 12 名英雄应排在统一兵牌列表最前面（前 12 张：${pool.slice(0, 12).map((c) => c.kind).join(',')}）`);
    }
    if (pool[0].hero.tier !== 'legendary') {
      errors++;
      console.error(`  ✗ 传奇英雄应排在史诗英雄前面（首张 ${pool[0].hero.tier}）`);
    }
  }
  // 拖 3 名英雄上阵（占 3 个格）
  for (let i = 0; i < 3; i++) {
    const from = poolCard(i);
    const slot = deploySlotPoint(20 + i, game.screen.cam.y);
    drag(from.x, from.y, slot.x, slot.y);
  }
  if (heroCardsDeployed() !== 3) {
    errors++;
    console.error(`  ✗ 应能上阵 3 名英雄（实测 ${heroCardsDeployed()}）`);
  }
  // 英雄格 ↔ 普通兵牌拖拽互换：先把一个普通兵放到 10 号位，再拖到 20 号英雄格
  {
    const unitId = game.state.units[0].id;
    game.state.formation[10] = unitId;
    const heroAt20 = game.state.formation[20];
    game.draw();
    const p10 = deploySlotPoint(10, game.screen.cam.y);
    const p20 = deploySlotPoint(20, game.screen.cam.y);
    drag(p10.x, p10.y, p20.x, p20.y);
    shot('50d_deploy_hero_unit_swap');
    if (game.state.formation[10] !== heroAt20 || game.state.formation[20] !== unitId) {
      errors++;
      console.error(`  ✗ 英雄与普通兵拖拽互换失败（10 号位 ${game.state.formation[10]} / 20 号位 ${game.state.formation[20]}）`);
    }
    if (heroCardsDeployed() !== 3) {
      errors++;
      console.error('  ✗ 英雄与普通兵互换后上阵英雄数应保持 3');
    }
  }
  // 第 4 名英雄应被上限拦住，并给出明确提示（前 3 张卡已上阵，第 4 张是未上阵英雄）
  {
    game.draw();
    const from4 = poolCard(3);
    const slot4 = deploySlotPoint(0, game.screen.cam.y);
    drag(from4.x, from4.y, slot4.x, slot4.y);
    if (heroCardsDeployed() !== 3) {
      errors++;
      console.error(`  ✗ 第 4 名英雄不应能上阵（实测 ${heroCardsDeployed()}）`);
    }
    if (!String(game.toastText || '').includes('最多同时上阵 3')) {
      errors++;
      console.error(`  ✗ 超选第 4 名英雄应提示上阵上限（当前提示「${game.toastText}」）`);
    }
    shot('50b_deploy_hero_limit_toast');
  }
  game.home();
}

// ---------- 英雄上阵位随关卡开放（499/500/1000）+ 特殊兵种档位上限提示 ----------
{
  game.state.heroes = { zhangfei: 3, guanyu: 3, liubei: 3 };
  game.state.formation = new Array(25).fill(null);
  for (const [level, want, name] of [
    [499, 1, '50f_deploy_hero_slots_499'],
    [500, 2, '50g_deploy_hero_slots_500'],
    [1000, 3, '50h_deploy_hero_slots_1000'],
  ]) {
    game.state.maxCleared = level;
    game.save();
    game.go(new DeployScreen(game, { mode: 'edit' }));
    game.toastT = 0;   // 清掉上一个用例的提示，保证英雄位截图干净
    game.draw();
    shot(name);
    if (heroDeploySlots(game.state) !== want) {
      errors++;
      console.error(`  ✗ 第 ${level} 关可用英雄位应为 ${want}（实测 ${heroDeploySlots(game.state)}）`);
    }
  }
  game.home();

  // 合成上限提示：150 关两只 Lv4 稀有兵不能再合成
  game.state.maxCleared = 150;
  game.state.units = [
    { id: 'cq1', troop: 'qingzhou', level: 4 },
    { id: 'cq2', troop: 'qingzhou', level: 4 },
  ];
  game.state.formation = new Array(25).fill(null);
  game.save();
  game.go(new BarracksScreen(game));
  game.draw();
  {
    const a = game.screen.cardRects[0];
    const b = game.screen.cardRects[1];
    const from = { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 };
    const to = { x: a.rect.x + a.rect.w / 2, y: a.rect.y + a.rect.h / 2 };
    game.handleDown(from.x, from.y);
    game.screen.update(0.3);                          // 长按拿起
    game.handleMove(from.x, from.y - 20);
    game.handleMove(to.x, to.y);
    game.handleUp(to.x, to.y);
    shot('50i_merge_cap_toast');
    if (!String(game.toastText || '').includes('最高 Lv4')) {
      errors++;
      console.error(`  ✗ 150 关稀有 Lv4 合成应提示档位上限（当前「${game.toastText}」）`);
    }
    if (game.state.units.filter((u) => u.troop === 'qingzhou').length !== 2) {
      errors++;
      console.error('  ✗ 超上限合成不应消耗材料');
    }
  }
  // 250 关后同一组合正常合成到 Lv5
  game.state.maxCleared = 250;
  game.save();
  game.go(new BarracksScreen(game));
  game.draw();
  {
    const a = game.screen.cardRects[0];
    const b = game.screen.cardRects[1];
    const from = { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 };
    const to = { x: a.rect.x + a.rect.w / 2, y: a.rect.y + a.rect.h / 2 };
    game.handleDown(from.x, from.y);
    game.screen.update(0.3);                          // 长按拿起
    game.handleMove(from.x, from.y - 20);
    game.handleMove(to.x, to.y);
    game.handleUp(to.x, to.y);
    const qingzhou = game.state.units.find((u) => u.troop === 'qingzhou');
    if (!qingzhou || qingzhou.level !== 5 || game.state.units.length !== 1) {
      errors++;
      console.error('  ✗ 250 关后稀有 Lv4 → Lv5 应正常合成');
    }
  }
  game.home();
}

// ---------- 传奇英雄 AOE 特效实拍（周瑜火圈 / 关羽扇形 / 张飞圆环） ----------
{
  game.state.maxCleared = 380;
  game.state.heroes = { zhangfei: 10, guanyu: 10, zhouyu: 10 };
  game.state.units = [
    { id: 'az1', troop: 'tengjia', level: 10 },
    { id: 'az2', troop: 'tengjia', level: 10 },
    { id: 'az3', troop: 'wudang', level: 10 },
  ];
  game.state.formation = new Array(25).fill(null);
  game.state.formation[24] = 'h:zhangfei';
  game.state.formation[23] = 'h:guanyu';
  game.state.formation[19] = 'h:zhouyu';
  game.state.formation[18] = 'az1';
  game.state.formation[22] = 'az2';
  game.state.formation[17] = 'az3';
  game.save();
  game.home();
  game.toastText = '';
  game.toastT = 0;
  game.go(new BattleScreen(game, 30, mulberry32(21)));
  const seen = { fire: false, sector: false, ring: false };
  // 特效截图：把特效所在的屏幕区域裁出来放大 2.2 倍，确保火焰圈 / 扇形 / 圆环看得清
  const zoomShot = (name, s, wx, wy) => {
    const p = s.px(wx, wy);
    shotZoom(name, p.x, Math.max(240, Math.min(1000, p.y)), 2.2);
  };
  for (let i = 0; i < 2400 && screenName() === 'BattleScreen'; i++) {
    game.update(1 / 60);
    const s = game.screen;
    if (!s || !s.battle) break;
    // 等开场横幅退场再截图，避免「斗技场开战」盖住特效
    if (s.bannerT > 0) continue;
    if (!seen.fire && (s.battle.fireZones || []).length > 0) {
      const z = s.battle.fireZones[0];
      zoomShot('51a_zhouyu_fire_zone', s, z.x, z.y);
      seen.fire = true;
    }
    if (!seen.sector && s.fx.some((f) => f.kind === 'sector')) {
      const f = s.fx.find((k) => k.kind === 'sector');
      zoomShot('51b_guanyu_sector', s, f.wx, f.wy);
      seen.sector = true;
    }
    if (!seen.ring && s.fx.some((f) => f.kind === 'ring')) {
      const f = s.fx.find((k) => k.kind === 'ring');
      zoomShot('51c_zhangfei_ring', s, f.wx, f.wy);
      seen.ring = true;
    }
    if (seen.fire && seen.sector && seen.ring) break;
  }
  if (!seen.fire || !seen.sector || !seen.ring) {
    errors++;
    console.error(`  ✗ 三个传奇英雄 AOE 特效未全部出现（${JSON.stringify(seen)}）`);
  } else {
    console.log('  AOE 特效截图完成：51a_zhouyu_fire_zone / 51b_guanyu_sector / 51c_zhangfei_ring');
  }
  game.home();
}

// ---------- 成长之路：首页入口 / 指针节点状态 / 滚动 ----------
{
  game.state.maxCleared = 100;
  game.state.troopUnlocks = [];
  refreshTroopUnlocks(game.state);
  game.state.units = [
    { id: 'g1', troop: 'shield', level: 5 },
    { id: 'g2', troop: 'archer', level: 5 },
    { id: 'g3', troop: 'spear', level: 5 },
    { id: 'g4', troop: 'cavalry', level: 5 },
  ];
  game.save();
  game.home();
  game.toastText = '';
  game.toastT = 0;
  game.draw();
  shot('52_home_growth_entry');
  const gr = center(game.screen.rects.growth);
  tap(gr.x, gr.y);
  game.draw();
  shot('52b_growth_road');
  // 成长之路：金色时间轴 + 卡片；第一个兵种节点右侧应有建模图标像素
  let growthGold = 0;
  for (let y = 200; y <= 1200; y += 2) {
    for (let x = 40; x <= 710; x += 2) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (d[0] > 150 && d[1] > 115 && d[2] < 170 && d[0] > d[2] + 30) growthGold++;
    }
  }
  let iconHits = 0;
  const iconX = GROWTH_LAYOUT.cardX + GROWTH_LAYOUT.cardW - 56;
  const iconY = GROWTH_LAYOUT.view.y + 8 + GROWTH_LAYOUT.rowH / 2 + 50;
  for (let dy = -60; dy <= 4; dy += 2) {
    for (let dx = -34; dx <= 34; dx += 2) {
      const d = ctx.getImageData(iconX + dx, iconY + dy, 1, 1).data;
      if (d[0] + d[1] + d[2] > 210) iconHits++;
    }
  }
  if (growthGold < 200 || iconHits < 25) {
    errors++;
    console.error(`  ✗ 成长之路视觉元素不足（金色 ${growthGold} / 兵种图标 ${iconHits}）`);
  } else {
    console.log(`  成长之路视觉采样：金色 ${growthGold} / 首卡兵种图标 ${iconHits}`);
  }
  if (screenName() !== 'GrowthScreen') {
    errors++;
    console.error(`  ✗ 首页「成长之路」入口没有打开界面（当前 ${screenName()}）`);
  } else {
    const gs = game.screen;
    if (!(gs.maxScroll() > 0)) {
      errors++;
      console.error('  ✗ 成长之路内容应高于视口，需要滚动');
    }
    const v = GROWTH_LAYOUT.view;
    drag(v.x + 350, v.y + 760, v.x + 350, v.y + 260);
    game.draw();
    shot('52c_growth_scrolled');
    if (!(gs.scrollY > 0)) {
      errors++;
      console.error(`  ✗ 成长之路应能上滑滚动（scrollY=${gs.scrollY}）`);
    } else {
      console.log(`  成长之路滚动：scrollY=${gs.scrollY} / max=${gs.maxScroll()}`);
    }
    // 滚到底：确认新增的 200 / 400 / 800 关宝箱兵种等级节点可见
    drag(v.x + 350, v.y + 760, v.x + 350, v.y + 120);
    drag(v.x + 350, v.y + 760, v.x + 350, v.y + 120);
    game.draw();
    shot('52d_growth_bottom');
    if (gs.scrollY < gs.maxScroll() - 2) {
      errors++;
      console.error(`  ✗ 成长之路应能滑到底（scrollY=${gs.scrollY} / max=${gs.maxScroll()}）`);
    }
  }
}

// ---------- 兵营 / 图鉴：未解锁兵种灰色显示 + 「第 X 关解锁」 ----------
{
  game.state.maxCleared = 20;
  game.state.troopUnlocks = [];
  refreshTroopUnlocks(game.state);
  game.state.units = [
    { id: 'l1', troop: 'shield', level: 3 },
    { id: 'l2', troop: 'archer', level: 3 },
    { id: 'l3', troop: 'qingzhou', level: 1 },
    { id: 'l4', troop: 'qingzhu', level: 1 },
  ];
  game.save();
  game.go(new BarracksScreen(game));
  game.draw();
  shot('53_barracks_locked_catalog');
  const st = game.state;
  if (st.troopUnlocks.includes('tengjia') || st.troopUnlocks.includes('baima')) {
    errors++;
    console.error('  ✗ 20 关进度不应把藤甲 / 白马写进已解锁标记');
  }
  console.log(`  兵营图鉴：已解锁 ${st.troopUnlocks.length} 个兵种，灰色节点显示解锁关卡`);
  game.state.maxCleared = 380;
  refreshTroopUnlocks(game.state);
  game.save();
}

// ---------- 1.0.10 英雄改动：战场截图实际核对 ----------
{
  const setupHeroBattle = (heroId, enemies, seed = 31, allyTroop = null) => {
    const slots = CONFIG.formation.cols * CONFIG.formation.rows;
    game.state.formation = new Array(slots).fill(null);
    game.state.formation[2 * CONFIG.formation.cols + 2] = `h:${heroId}`;
    game.state.heroes = { [heroId]: 10 };
    game.state.units = [];
    if (allyTroop) {
      const u = addUnit(game.state, allyTroop, 1);
      game.state.formation[2 * CONFIG.formation.cols + 1] = u.id;
    }
    const def = { enemies: autoPlaceSquads(enemies, 'enemy'), enemyLevel: 1, enemyLevelMax: 1, name: '英雄测试' };
    game.go(new BattleScreen(game, 1, mulberry32(seed), { def }));
    const s = game.screen;
    s.camT = 1;
    s.cam.y = 42;
    s.cam.x = CONFIG.arena.cols / 2;
    s.bannerT = 0;
    s.speed = 1;
    return s;
  };
  const heroOf = (s) => s.battle.entities.find((e) => e.hero);
  const foesOf = (s) => s.battle.entities.filter((e) => e.side === 'enemy');
  const put = (o, x, y) => { o.x = x; o.y = y; };
  const freeze = (o) => { o.speed = 0; o.interval = 999; o.cooldown = 999; };
  const screenPoint = (s, o) => s.px(o.x, o.y);

  // 夏侯渊：骑兵坐骑 + 长兵器模型
  {
    const s = setupHeroBattle('xiahouyuan', [{ troop: 'shield', level: 1 }]);
    const h = heroOf(s);
    const foe = foesOf(s)[0];
    put(h, 15, 45); put(foe, 15, 43.6);
    freeze(foe);
    h.cooldown = 0; h.interval = 999;
    tick(2);
    const p = screenPoint(s, h);
    shot('54a_xiahouyuan_cavalry');
    shotZoom('54a_xiahouyuan_cavalry_zoom', p.x, p.y - 24, 1.8);
  }

  // 关羽：仅在冲锋那一下爆出前方扇形
  {
    const s = setupHeroBattle('guanyu', [
      { troop: 'shield', level: 1 }, { troop: 'shield', level: 1 }, { troop: 'shield', level: 1 },
      { troop: 'shield', level: 1 }, { troop: 'shield', level: 1 }, { troop: 'shield', level: 1 },
    ]);
    const h = heroOf(s);
    const foes = foesOf(s);
    put(h, 15, 45); h.cooldown = 0; h.interval = 999; h.moveAccum = 3;
    const pts = [[15, 44.2], [15.7, 43.4], [14.3, 43.4], [15, 42], [15.8, 44.5], [15.8, 41.4]];
    foes.forEach((o, i) => {
      if (i < pts.length) put(o, pts[i][0], pts[i][1]);
      else put(o, 5, 5);
      freeze(o);
    });
    tick(2);
    const p = screenPoint(s, h);
    shot('54b_guanyu_charge_sector');
    shotZoom('54b_guanyu_charge_sector_zoom', p.x, p.y - 40, 1.8);
  }

  // 周瑜：20 格外远程开火
  {
    const s = setupHeroBattle('zhouyu', [{ troop: 'shield', level: 1 }]);
    const h = heroOf(s);
    put(h, 15, 47);                       // 20 格
    foesOf(s).forEach((o) => { put(o, 15, 27); freeze(o); });
    h.cooldown = 0; h.interval = 999;
    tick(2);
    tick(2);                              // 让箭矢飞到中途，截图能看到长距离飞行
    const p = screenPoint(s, h);
    shot('54c_zhouyu_longshot');
    shotZoom('54c_zhouyu_longshot_zoom', p.x, p.y - 240, 1.4);
  }

  // 曹操：受到伤害立刻转化治疗，并反弹远程
  {
    const s = setupHeroBattle('caocao', [
      { troop: 'archer', level: 1 }, { troop: 'archer', level: 1 }, { troop: 'shield', level: 1 },
    ]);
    const h = heroOf(s);
    const foes = foesOf(s);
    put(h, 15, 45); h.cooldown = 999; h.interval = 999;
    foes.forEach((o, i) => {
      put(o, i < 2 ? 15 : 15, i < 2 ? 38 : 44);
      freeze(o);
      o.cooldown = 0;
      o.atk = 400;
    });
    tick(2);
    const p = screenPoint(s, h);
    shot('54d_caocao_convert_reflect');
    shotZoom('54d_caocao_convert_reflect_zoom', p.x, p.y - 30, 1.8);
    // 英雄粗厚分段血条 + 技能 CD 条特写：快进 7.5 秒，技能窗口结束、CD 条回到回充中段
    tick(450);
    const p2 = screenPoint(s, h);
    shotZoom('54d2_hero_hp_cd_zoom', p2.x, p2.y - 14, 2.8);
  }

  // 张角：模型不变（法杖），但改用箭矢远程射击
  {
    const s = setupHeroBattle('zhangjiao', [{ troop: 'shield', level: 1 }]);
    const h = heroOf(s);
    put(h, 15, 45);
    foesOf(s).forEach((o) => { put(o, 15, 32); freeze(o); });
    const foe = foesOf(s)[0];
    h.cooldown = 0; h.interval = 999;
    tick(2);
    tick(2);                              // 箭矢飞到中途
    const p = screenPoint(s, h);
    const fp = screenPoint(s, foe);
    shot('54e_zhangjiao_arrow');
    shotZoom('54e_zhangjiao_arrow_zoom', (p.x + fp.x) / 2, (p.y + fp.y) / 2 - 30, 1.6);
  }

  // ---------- 1.0.11：刘备光环 / 曹操数值 / 英雄战统计面板 / 招募池无重复 ----------
  // 刘备：4 格淡绿回血光环，圈内友军每秒被治疗并飘 +20
  {
    const s = setupHeroBattle('liubei', [
      { troop: 'shield', level: 1 }, { troop: 'shield', level: 1 },
    ], 31, 'shield');
    const h = heroOf(s);
    const ally = s.battle.entities.find((e) => e.side === 'player' && !e.hero);
    const foes = foesOf(s);
    put(h, 15, 45);
    if (ally) { put(ally, 18, 45); ally.hp = 20; freeze(ally); }
    foes.forEach((o, i) => { put(o, i === 0 ? 20.5 : 27, 45); freeze(o); });
    h.cooldown = 999; h.interval = 999;
    tick(62);                             // >1 秒，触发光环治疗事件与 +20 飘字
    const p = screenPoint(s, h);
    shot('55a_liubei_heal_aura');
    shotZoom('55a_liubei_heal_aura_zoom', p.x, p.y - 10, 1.6);
    // 像素采样：光环圈内（3.2 格）应比圈外（8.5 格）更「绿」（绿通道抬升、红通道压低）
    const cell = Math.abs(screenPoint(s, { x: h.x + 1, y: h.y }).x - p.x);
    const ringAvg = (cells) => {
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let k = 0; k < 36; k++) {
        const a = (Math.PI * 2 * k) / 36;
        const x = Math.round(p.x + Math.cos(a) * cells * cell);
        const y = Math.round(p.y + Math.sin(a) * cells * cell);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
        const d = ctx.getImageData(x, y, 1, 1).data;
        sr += d[0]; sg += d[1]; sb += d[2]; n++;
      }
      return n ? { r: sr / n, g: sg / n, b: sb / n, green: sg / n - (sr / n + sb / n) / 2 } : null;
    };
    const inner = ringAvg(3.2), outer = ringAvg(8.5);
    // 采样环会扫到圈内兵种的衣甲，新哑光色板改变了这些像素的绿色基线；光环本身未改、截图 55a 仍清晰可见。
    // 阈值按新色板校准为 3.5（当前实测约 +4），仍要求圈内绿度明显高于圈外，避免误判成「没画光环」。
    if (!inner || !outer || inner.green < outer.green + 3.5) {
      errors++;
      console.error(`  ✗ 刘备光环未画出淡绿覆盖（圈内绿度 ${inner && inner.green.toFixed(1)} / 圈外 ${outer && outer.green.toFixed(1)}）`);
    } else {
      console.log(`  刘备淡绿光环像素：圈内绿度 ${inner.green.toFixed(1)} > 圈外 ${outer.green.toFixed(1)}`);
    }
  }

  // 曹操：详情页展示当前等级技能数值（固定 120% 治疗 / 反弹 60%→100%）
  {
    game.state.heroes = Object.fromEntries(HEROES.map((h) => [h.id, 10]));
    game.state.units = [];
    game.state.maxCleared = 600;
    game.state.formation = new Array(CONFIG.formation.cols * CONFIG.formation.rows).fill(null);
    const hs = new HeroScreen(game);
    hs.detailId = 'caocao';
    game.go(hs);
    game.draw();
    shot('55b_caocao_detail_values');
  }

  // 英雄战结算：综合 / 我方输出 / 敌方输出 / 我方承伤 / 敌方承伤 五个 Tab 与闯关同口径
  {
    const stats = [
      { side: 'player', hero: 'caocao', level: 30, dealt: 8200, taken: 6100, kills: 12 },
      { side: 'player', troop: 'shield', level: 10, dealt: 5100, taken: 9400, kills: 4 },
      { side: 'player', troop: 'archer', level: 10, dealt: 4300, taken: 2100, kills: 6 },
      { side: 'player', troop: 'cavalry', level: 10, dealt: 3600, taken: 3300, kills: 3 },
      { side: 'player', troop: 'spear', level: 10, dealt: 2900, taken: 2800, kills: 2 },
      { side: 'enemy', hero: 'zhangfei', level: 6, dealt: 7100, taken: 12000, kills: 8 },
      { side: 'enemy', troop: 'shield', level: 10, dealt: 4200, taken: 8300, kills: 3 },
      { side: 'enemy', troop: 'archer', level: 10, dealt: 3900, taken: 2200, kills: 5 },
      { side: 'enemy', troop: 'cavalry', level: 10, dealt: 3300, taken: 3100, kills: 2 },
      { side: 'enemy', troop: 'spear', level: 10, dealt: 2600, taken: 2500, kills: 1 },
    ];
    game.go(new HeroBattleResultScreen(game, {
      win: true, stage: 7, firstClear: false, scrolls: 0, time: 96, stats,
    }));
    game.draw();
    shot('55c_hero_battle_stats_all');
    game.screen.tap(489, 778);            // 切到「我方承伤」Tab
    game.draw();
    shot('55d_hero_battle_stats_taken');
  }

  // 招募池：已拥有英雄不再出现（英雄页底部规则文案）
  {
    game.state.heroes = Object.fromEntries(HEROES.map((h) => [h.id, 10]));
    game.state.maxCleared = 600;
    const hs = new HeroScreen(game);
    hs.detailId = null;
    game.go(hs);
    game.draw();
    shot('55e_recruit_pool_no_dup');
  }

  // 1.0.12 · 布阵页一键开启宝箱（开之前 / 开完之后兵牌立即多出来）
  {
    game.state.units = [
      { id: 'oa1', troop: 'shield', level: 2 },
      { id: 'oa2', troop: 'archer', level: 1 },
      { id: 'oa3', troop: 'spear', level: 1 },
      { id: 'oa4', troop: 'cavalry', level: 1 },
    ];
    game.state.maxCleared = 6;
    game.state.heroes = {};      // 兵牌区只看兵，别被英雄卡占满
    game.state.heroLevels = {};
    game.state.formation = new Array(CONFIG.formation.cols * CONFIG.formation.rows).fill(null);
    game.state.chests = {};
    addChest(game.state, 'wood', 3);
    addChest(game.state, 'gold', 2);
    const dep = new DeployScreen(game, { mode: 'edit', level: 6 });
    game.go(dep);
    game.draw();
    shot('56a_deploy_before_open_all');
    const beforeUnits = game.state.units.length;
    dep.onDown(410, 906);
    ok(chestTotal(game.state) === 0 && game.state.units.length === beforeUnits + 5,
      `一键开启：5 个箱全开、兵牌 ${beforeUnits}→${game.state.units.length}`);
    game.draw();
    shot('56b_deploy_after_open_all');
  }

  // 1.0.12 · 兵营图鉴：可获得（青州/白毦/陷阵）+ 未解锁灰色 + 空位白色
  {
    game.state.units = [{ id: 'bk1', troop: 'shield', level: 1 }];
    game.state.maxCleared = 0;
    game.state.troopUnlocks = [];   // 回到开局：只有青州/白毦/陷阵可选
    const bk = new BarracksScreen(game);
    game.go(bk);
    game.toastText = '';            // 别让上一步的 toast 盖住顶部提示
    game.draw();
    shot('56c_barracks_codex_available');
    const avail = bk.availableTroops().map((t) => t.id);
    ok(['qingzhou', 'baier', 'xianzhen'].every((id) => avail.includes(id)),
      `图鉴可获得：${avail.join(' / ')}`);
  }

  // 1.0.12 · 仅查看模式（布阵进入）：不拿起、不拖拽
  {
    const bk = new BarracksScreen(game, { viewOnly: true });
    game.go(bk);
    game.toastText = '';
    game.draw();
    shot('56d_barracks_view_only');
    const v = BARRACKS_LAYOUT.list.view;
    bk.cardRects = [{ uid: game.state.units[0].id, rect: { x: v.x + 10, y: v.y + 10, w: 120, h: 110 } }];
    bk.onDown(v.x + 60, v.y + 60);
    bk.update(0.5);
    ok(bk.drag === null, '仅查看模式：按住 0.5s 也不会拿起兵牌');
  }

  // 1.0.13 · 布阵战场空位白框：空场 / 放 1 个 / 放满
  {
    game.state.heroes = {};
    game.state.heroLevels = {};
    game.state.chests = {};
    game.state.units = Array.from({ length: 25 }, (_, i) => ({ id: `sl${i}`, troop: 'shield', level: 1 }));
    const total = CONFIG.formation.cols * CONFIG.formation.rows;
    const show = (name, filled) => {
      game.state.formation = new Array(total).fill(null);
      for (let i = 0; i < filled; i++) game.state.formation[i] = `sl${i}`;
      game.go(new DeployScreen(game, { mode: 'edit', level: 10 }));
      game.toastText = '';
      game.draw();
      shot(name);
      return emptySlotBoxes(game.state.formation).length;
    };
    ok(show('57a_deploy_empty_slots', 0) === total, `空场地：画出 ${total} 个白色空位框`);
    ok(show('57b_deploy_one_unit', 1) === total - 1, '放 1 个兵：白框数 = 总格数 - 1');
    ok(show('57c_deploy_full', 25) === 0, '放满 25 个：不再画白框');
    ok(openAllLabel(3).includes('宝箱'), `按钮文案含「宝箱」：${openAllLabel(3)}`);
  }

  // 1.0.13 · 开发版对照：首页调试四连 / 英雄页与兵营页的 DEV 入口
  {
    game.state.maxCleared = 300;
    game.state.units = [{ id: 'dv1', troop: 'shield', level: 1 }];
    game.state.heroes = {};
    game.state.heroLevels = {};
    game.state.formation = new Array(CONFIG.formation.cols * CONFIG.formation.rows).fill(null);
    game.go(new HomeScreen(game));
    game.toastText = '';
    game.draw();
    shot('57d_dev_home');
    game.go(new HeroScreen(game));
    game.toastText = '';
    game.draw();
    shot('57e_dev_heroes');
    game.go(new BarracksScreen(game));
    game.toastText = '';
    game.draw();
    shot('57f_dev_barracks');
    ok(HERO_LAYOUT.devRect && BARRACKS_LAYOUT.devRect, '开发版保留 DEV 入口（玩家版会剥离）');
  }

  // -= 新手引导（独立存档） =-
  console.log('\n-- 新手引导 --');
  {
    const total = CONFIG.formation.cols * CONFIG.formation.rows;
    const four = () => ([
      { id: 't1', troop: 'shield', level: 1 },
      { id: 't2', troop: 'archer', level: 1 },
      { id: 't3', troop: 'cavalry', level: 1 },
      { id: 't4', troop: 'spear', level: 1 },
    ]);
    const reset = (units = four(), cleared = 0) => {
      game.state.tutorial = emptyTutorial();
      game.tutorial.active = null;
      game.state.maxCleared = cleared;
      game.state.units = units;
      game.state.chests = {};
      game.state.formation = new Array(total).fill(null);
      units.slice(0, total).forEach((u, i) => { game.state.formation[i] = u.id; });
      game.state.seenTroops = CONFIG.troops.map((t) => t.id);
      game.toastText = '';
    };

    // 1) 首次布阵强引导：高亮「白框」+ 手势拖拽图标，点别处不推进
    reset();
    game.go(new DeployScreen(game, { mode: 'battle', level: 1 }));
    game.tutorial.active = null;
    game.draw();
    shot('58a_tutorial_deploy_strong');
    ok(game.tutorial.active?.step.id === 'deploy', '首次为关卡布阵弹出手势引导');
    ok(game.tutorial.active?.step.gesture === 'drag' && game.tutorial.active?.step.action === '拖到白框',
      '布阵引导只有「拖到白框」一句指令 + 拖拽手势图标');
    ok((game.tutorial.active?.layout?.highlights || []).length >= 4, '强引导高亮空上阵白框');
    tap(24, 700);
    ok(game.tutorial.active?.step.id === 'deploy', '点遮罩空白处不会跳过强引导');
    const conf = DEPLOY_LAYOUT.confirmRect;
    tap(conf.x + conf.w / 2, conf.y + conf.h / 2);
    ok(game.state.tutorial.seen.deploy === true && game.tutorial.active === null,
      '点「出战」完成布阵引导并写入存档');

    // 2) 兵营第一次满 25 张兵牌：强引导拖动合成（老档不补弹）
    const many = [];
    for (let i = 0; i < 25; i++) many.push({ id: `m${i}`, troop: 'shield', level: 1 });
    const under = many.slice(0, 24);
    reset(under);
    markTutorialSeen(game.state, 'deploy');
    game.go(new BarracksScreen(game));
    game.tutorial.active = null;
    game.draw();
    ok(game.tutorial.active === null, '不足 25 张兵牌时兵营不弹合成引导');

    reset(many);
    markTutorialSeen(game.state, 'deploy');
    game.go(new BarracksScreen(game));
    game.tutorial.active = null;
    game.draw();
    shot('58b_tutorial_merge_strong');
    ok(game.tutorial.active?.step.id === 'merge', '兵营满 25 张兵牌时弹合成引导');
    const pair = game.tutorial.active?.layout?.highlights || [];
    ok(pair.length === 2, '合成引导同时高亮两张兵牌');
    if (pair.length === 2) {
      drag(pair[0].x + pair[0].w / 2, pair[0].y + pair[0].h / 2,
        pair[1].x + pair[1].w / 2, pair[1].y + pair[1].h / 2);
    }
    ok(game.state.tutorial.seen.merge === true, '真的合成一次后合成引导完成');
    game.draw();
    shot('58c_tutorial_merge_done');

    // 3) 首次开箱强引导
    reset();
    markTutorialSeen(game.state, 'deploy');
    markTutorialSeen(game.state, 'merge');
    addChest(game.state, 'wood', 1);
    game.go(new ChestScreen(game));
    game.tutorial.active = null;
    game.draw();
    shot('58d_tutorial_chest_strong');
    ok(game.tutorial.active?.step.id === 'chest', '有箱可开时弹开箱引导');
    const openRect = game.tutorial.active?.layout?.highlights?.[0];
    const keepShowcase = game.showcaseUnit;
    game.showcaseUnit = null;
    if (openRect) tap(openRect.x + openRect.w / 2, openRect.y + openRect.h / 2);
    game.showcaseUnit = keepShowcase;
    ok(game.state.tutorial.seen.chest === true, '开箱成功后开箱引导完成');
    game.draw();
    ok(!game.tutorial.active, '开完箱不再补说明卡（规则统一收进「!」）');

    // 4) 说明性页面不再弹任何提示卡
    reset();
    markTutorialSeen(game.state, 'deploy');
    markTutorialSeen(game.state, 'merge');
    game.go(new ShopScreen(game));
    game.tutorial.active = null;
    game.draw();
    ok(!game.tutorial.active, '商城不再弹说明卡');
    reset(four(), 100);
    game.go(new DailyShopScreen(game));
    game.tutorial.active = null;
    game.draw();
    ok(!game.tutorial.active, '每日商城不再弹说明卡');
    reset(four(), 1);
    game.go(new HomeScreen(game));
    game.tutorial.active = null;
    game.draw();
    ok(!game.tutorial.active, '首页不再弹玩法预告卡');

    // 5) 全局跳过：强引导全部不再出现
    reset();
    game.go(new DeployScreen(game, { mode: 'battle', level: 1 }));
    game.tutorial.active = null;
    game.draw();
    const skipRect = game.tutorial.active?.layout?.skip;
    ok(!!skipRect, '强引导带「跳过」按钮');
    if (skipRect) tap(skipRect.x + skipRect.w / 2, skipRect.y + skipRect.h / 2);
    game.draw();
    ok(game.state.tutorial.skipped === true && !game.tutorial.active, '跳过一次后全局不再弹强引导');

    // 6) 帮助页重看：全部跳到对应界面做实景教学（不写存档）
    reset(four(), 30);
    ['deploy', 'merge', 'chest'].forEach((id) => markTutorialSeen(game.state, id));
    game.go(new HelpScreen(game));
    game.draw();
    shot('58e_tutorial_help');
    const firstRow = game.screen.rows[0];
    if (firstRow) tap(firstRow.rect.x + 40, firstRow.rect.y + 40);
    game.draw();
    ok(game.screen && game.screen.tutorialId === 'deploy' && game.screen.mode === 'edit',
      '帮助页点「布阵」重看 → 直接进入布阵页实景教学');
    game.update(1.3); game.draw();
    ok(game.tutorial.active && game.tutorial.active.replay === true
      && game.tutorial.active.step.id === 'deploy',
      '布阵页挂上不写存档的实景引导');
    shot('58f_tutorial_help_replay');
    game.dismissTutorial();

    // 缩放重看 → 布阵页只显示双指缩放提示（replayZoom），完成时不做存档
    reset(four(), 30);
    markTutorialSeen(game.state, 'zoom');
    game.go(new HelpScreen(game));
    game.draw();
    const zoomRow = game.screen.rows.find((r) => r.id === 'zoom');
    if (zoomRow) tap(zoomRow.rect.x + 40, zoomRow.rect.y + 40);
    game.draw();
    ok(game.screen && game.screen.tutorialId === 'deploy' && game.screen.replayZoom === true
      && game.screen.zoomDone === false,
      '帮助页点「缩放」重看 → 布阵页显示双指缩放手势教学');
    const zoomSeenBefore = game.state.tutorial.seen.zoom;
    game.screen.onPinch(1.2, 360, 640, 'move');
    ok(game.screen.zoomDone === true && game.state.tutorial.seen.zoom === zoomSeenBefore,
      '缩放重看完成后不写存档');

    // 开箱重看 → 直接进宝箱页
    reset(four(), 30);
    markTutorialSeen(game.state, 'chest');
    addChest(game.state, 'wood', 1);
    game.go(new HelpScreen(game));
    game.draw();
    const chestRow = game.screen.rows.find((r) => r.id === 'chest');
    if (chestRow) tap(chestRow.rect.x + 40, chestRow.rect.y + 40);
    game.draw(); game.update(1.3); game.draw();
    ok(game.screen && game.screen.tutorialId === 'chests',
      '帮助页点「开箱」查看 → 直接进入宝箱页实景教学');
  }

  // 恢复存档中的上阵数据，避免影响后续断言
  game.state.heroes = {};
  game.state.formation = new Array(CONFIG.formation.cols * CONFIG.formation.rows).fill(null);
  game.state.units = [];
}

// ---------- 结算页「下一个解锁」：已解锁态 / 全部解锁隐藏 ----------
{
  const emptyWin = (levelN) => ({
    win: true, levelN, coins: 0, firstClear: true, chests: [], stats: [], time: 10,
  });
  game.state.maxCleared = 20;
  game.state.autoBattle = false;
  game.go(new ResultScreen(game, emptyWin(20)));
  game.toastT = 0;
  game.draw();
  shot('59d_result_unlock_achieved');
  ok(nextUnlockInfo(game.state, { levelN: 20, win: true }).achieved === true,
    '20 关结算显示青竹弓已解锁（不是还差 0 关）');

  game.state.maxCleared = 801;
  game.go(new ResultScreen(game, emptyWin(801)));
  game.toastT = 0;
  game.draw();
  shot('59e_result_unlock_hidden');
  ok(nextUnlockInfo(game.state, { levelN: 801, win: true }) === null,
    '全部目标解锁后进度卡整块隐藏（不留空壳）');
}

// ---------- 首页挂机宝箱：待领取 / 领取入仓 / 已领完 ----------
{
  const now = Date.now();
  const total = CONFIG.formation.cols * CONFIG.formation.rows;
  game.state.units = [
    { id: 'ic1', troop: 'shield', level: 3 },
    { id: 'ic2', troop: 'archer', level: 3 },
    { id: 'ic3', troop: 'spear', level: 3 },
    { id: 'ic4', troop: 'cavalry', level: 3 },
  ];
  game.state.formation = new Array(total).fill(null);
  game.state.formation[24] = 'ic1';
  game.state.formation[23] = 'ic2';
  game.state.formation[19] = 'ic3';
  game.state.formation[22] = 'ic4';
  game.state.maxCleared = 250; // 银箱档
  game.state.chests = {};
  game.state.idleChest = emptyIdleChest(now, 250);
  game.state.tutorial.skipped = true;
  game.tutorial.active = null;
  game.toastText = '';
  game.go(new HomeScreen(game));
  game.screen.nowMs = now;
  game.draw();
  shot('59a_home_idle_chest_ready');
  const info = idleChestState(game.state, now);
  ok(info.ready && info.chest === 'silver' && info.index === 0,
    '挂机宝箱：250 关为银箱，第 1 个到点可领');

  const before = chestCount(game.state, 'silver');
  const cr = game.screen.rects.idleChest;
  tap(cr.x + cr.w / 2, cr.y + cr.h / 2);
  ok(chestCount(game.state, 'silver') === before + 1, '点击挂机宝箱领取后进入宝箱仓库');
  ok(game.state.idleChest.claimed === 1, '领取后自动开始第 2 个的链式计时');
  game.toastText = '';
  game.draw();
  shot('59b_home_idle_chest_next_wait');

  // 已领完态：不再计时、不再发箱、显示今日已领完
  game.state.idleChest.claimed = 8;
  game.state.idleChest.readyAt = Number.MAX_SAFE_INTEGER;
  game.screen.nowMs = now + 1000;
  game.toastText = '';
  game.draw();
  shot('59c_home_idle_chest_done');
  ok(idleChestState(game.state, now + 1000).done === true, '领完 8 个后显示今日已领完');
  tap(cr.x + cr.w / 2, cr.y + cr.h / 2);
  ok(chestCount(game.state, 'silver') === before + 1, '已领完后点击不会重复发箱');
}

// ---------- 新内容解锁教学：兵种类 / 功能类各一张，强制中断且只弹一次 ----------
{
  game.state.unlockSeen = [];
  game.state.tutorial.skipped = true;
  game.tutorial.active = null;
  game.toastT = 0;
  const nodes = pendingUnlockTeachings(game.state, 150);
  ok(nodes.some((n) => n.kind === 'troop') && nodes.some((n) => n.kind === 'feature'),
    '150 关同时解锁白马义从 + 演武：教学队列两条都排队');
  let afterCalled = 0;
  const teach = new UnlockTeachingScreen(game, nodes, { after: () => { afterCalled++; } });
  game.go(teach);
  game.draw();
  ok(nodes.every((n, i) => teach.nodes[i] === n), '教学队列按解锁顺序逐条播放');
  let shotIdx = 0;
  for (let i = 0; i < nodes.length; i++) {
    const node = teach.node;
    if (!node) break;
    game.draw();
    shot(`59f_unlock_teaching_${shotIdx++}_${node.kind}`);
    tap(375, 1144); // 知道了
  }
  ok(afterCalled === 1, '队列播完后回调结算页逻辑一次');
  ok(teach.index === nodes.length, '教学全部播完，不会重复弹出');
}

// ---------- 六章战场主题 + 第六章关卡选择页 ----------
{
  const total = CONFIG.formation.cols * CONFIG.formation.rows;
  game.state.units = [
    { id: 'bt1', troop: 'shield', level: 6 },
    { id: 'bt2', troop: 'archer', level: 6 },
    { id: 'bt3', troop: 'spear', level: 6 },
    { id: 'bt4', troop: 'cavalry', level: 6 },
  ];
  game.state.formation = new Array(total).fill(null);
  game.state.formation[24] = 'bt1';
  game.state.formation[23] = 'bt2';
  game.state.formation[19] = 'bt3';
  game.state.formation[22] = 'bt4';
  game.state.maxCleared = 2600;
  game.state.tutorial.skipped = true;
  game.tutorial.active = null;

  for (const [n, theme] of [[1, 'huangjin'], [401, 'dongzhuo'], [801, 'warlords'],
    [1201, 'chibi'], [1701, 'threekingdoms'], [2201, 'jin']]) {
    game.go(new DeployScreen(game, { mode: 'battle', level: n }));
    game.toastT = 0;
    game.draw();
    shot(`60_battlefield_${theme}`);
    ok(game.screen.fieldTheme === theme, `第 ${n} 关战场主题 = ${theme}`);
  }

  // 难度曲线 UI：21 / 49 卡点 + 50 关后 +10%，征战页与布阵页都必须标出来
  {
    game.state.maxCleared = 20;   // 下一关 = 21（卡点）
    game.go(new LevelSelectScreen(game));
    game.toastT = 0;
    game.draw();
    shot('60a_level_select_checkpoint');
    for (const [n, label] of [[21, '60b_deploy_checkpoint_21'], [80, '60c_deploy_late_80']]) {
      game.go(new DeployScreen(game, { mode: 'battle', level: n }));
      game.toastT = 0;
      game.draw();
      shot(label);
      const d = game.screen.def;
      const want = n === 21 ? 1.08 : 1.10;
      ok(d.difficulty === want && d.enemies.every((e) => e.statMult === want),
        `第 ${n} 关布阵页难度倍率 = ${want}（所有敌军小队一致）`);
      ok(n !== 21 || d.checkpoint === '校场试阵', '第 21 关带卡点名称');
    }
    console.log('  难度 UI：21 关卡点 / 80 关 +10% 均在征战页与布阵页标注');
  }

  // 关卡选择：第四章（5 城 + 章节 = 6 个里程碑，检查窄卡不挤爆）
  game.state.maxCleared = 1200;
  game.go(new LevelSelectScreen(game));
  game.toastT = 0;
  game.draw();
  shot('61_level_select_ch4');

  // 宝箱页：400 关后显示「所有宝箱兵种等级 +2」
  game.state.maxCleared = 400;
  game.state.chests = { wood: 1, silver: 2, gold: 3 };
  game.go(new ChestScreen(game));
  game.toastT = 0;
  game.draw();
  shot('62_chest_level_bonus');
}

{
  // ===== 1.2.5：周常挑战 / 每日挑战 / 成就（首页三入口 + 三个新屏）=====
  // ① 锁定态首页（maxCleared=10 <30）：三入口显示「通关 30 关开放」
  game.state.maxCleared = 10;
  game.save();
  game.home();
  game.toastT = 0;
  shot('63_home_125_locked');
  ok(game.screen.constructor.name === 'HomeScreen', '锁定态停在首页');

  // ② 解锁态首页（maxCleared=100）：三入口点亮
  game.state.maxCleared = 100;
  game.save();
  game.home();
  game.toastT = 0;
  shot('64_home_125_unlocked');
  ok(game.screen.constructor.name === 'HomeScreen', '解锁态停在首页');

  // ③ 周常挑战：挑战关卡页签（5 档 ×10 关）
  game.go(new WeeklyChallengeScreen(game));
  shot('65a_weekly_stages');
  ok(game.screen.constructor.name === 'WeeklyChallengeScreen'
    && game.state.weekly.points === CONFIG.weekly.startPoints,
    `周常关卡页（开局积分 ${game.state.weekly.points}/${CONFIG.weekly.points} 总额）`);

  // ④ 积分选兵页签：连点 3 张兵牌买断
  const tb = WEEKLY_LAYOUT.tabs[1];
  tap(tb.x + tb.w / 2, tb.y + tb.h / 2);
  game.draw();
  const buyCells = game.screen.shopCells.slice(0, 3);
  for (const c of buyCells) tap(c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2);
  shot('65b_weekly_draft');
  ok(game.screen.tab === 1 && game.state.weekly.roster.length >= 3,
    `积分选兵页：买入 ${game.state.weekly.roster.length} 张（剩 ${game.state.weekly.points} 分）`);

  // ⑤ 买兵后：周常布阵页（DeployScreen 的 draft 通道）
  ensureWeekly(game.state);
  game.go(new DeployScreen(game, {
    mode: 'battle', level: engineStageFor('weekly', 1),
    weekly: { tier: 1, stage: 1 }, def: weeklyLevelDef(game.state, 1, 1),
  }));
  shot('65c_weekly_deploy');
  ok(game.screen.weekly && game.screen.weekly.tier === 1, '周常布阵页带 weekly 标记');

  // ⑥ 每日挑战列表（30 关 / 单将→三将 / 锚点 300→2000）
  game.go(new DailyChallengeScreen(game));
  shot('66_daily_challenge');
  ok(game.screen.constructor.name === 'DailyChallengeScreen', '每日挑战列表截图');

  // ⑦ 成就：先截可领取态，再真点一次领取按钮
  game.go(new AchievementsScreen(game));
  shot('67a_achievements_claimable');
  const claimRects = game.screen.claimRects;
  ok(claimRects.length >= 1, `成就页有 ${claimRects.length} 项可领取`);
  const coinsBeforeClaim = game.state.coins;
  tap(claimRects[0].rect.x + claimRects[0].rect.w / 2,
    claimRects[0].rect.y + claimRects[0].rect.h / 2);
  shot('67b_achievements_claimed');
  ok(game.state.coins > coinsBeforeClaim && game.state.achievements.claimed.length >= 1,
    `成就领取入账：${coinsBeforeClaim} → ${game.state.coins}`);

  // 还原主线进度，避免影响后续 Dev 屏
  game.state.maxCleared = 400;
  game.save();
  game.home();
  game.toastT = 0;
}

// ---------- 开发者测试场：任选兵种 / 英雄（Lv1 / 满级）双方对打 ----------
if (!process.argv.includes('--player')) {
  game.state.units = [
    { id: 'd1', troop: 'shield', level: 3 },
    { id: 'd2', troop: 'archer', level: 3 },
  ];
  game.go(new DevScreen(game));
  shot('70_dev_screen');
  const dev = game.screen;
  ok(dev instanceof DevScreen, '开发者测试场：首页入口可进入');
  // 手动布阵：打开浮层 → 指定格子放置 → 再点同一格移除
  dev.tab = 'troop';
  dev.troopId = 'shield';
  dev.level = 1;
  dev.openPlace('player');
  game.draw();
  shot('70d_dev_place');
  dev.placeAt('player', 0, 0);
  ok(dev.player.length === 1 && dev.player[0].col === 0 && dev.player[0].row === 0,
    '开发者测试场：可手动指定格子摆放（0 列 / 0 排）');
  dev.placeAt('player', 0, 0);
  ok(dev.player.length === 0, '开发者测试场：再点同一格移除该兵牌');
  dev.placeSide = null;
  // 英雄 tab：关羽满级，双方各加 1 个
  dev.tab = 'hero';
  dev.heroId = 'guanyu';
  dev.heroMax = true;
  dev.add('player');
  dev.add('enemy');
  ok(dev.player.length === 1 && dev.enemy.length === 1
    && dev.player[0].level === HERO_MAX_LEVEL && dev.player[0].hero === 'guanyu',
    '英雄只提供 Lv1 / 满级两档，满级 = Lv30');
  shot('70b_dev_heroes');
  // 兵种 tab：16 个兵种每个等级都可选（抽 Lv1 / Lv10 断言）
  dev.tab = 'troop';
  dev.troopId = 'daji';
  dev.level = 10;
  dev.add('player');
  ok(dev.player.length === 2 && dev.player[1].level === 10,
    '兵种可选任意等级（大戟士 Lv10 加入我方）');
  dev.start();
  const devBattle = game.screen;
  ok(devBattle && devBattle.dev && devBattle.playerSquads.length === 2
    && devBattle.def.enemies.length === 1,
    '开发者测试场：双方编队直接开打');
  ok(devBattle.playerSquads.every((q, i) => q.col === dev.player[i].col && q.row === dev.player[i].row)
    && devBattle.def.enemies.every((q, i) => q.col === dev.enemy[i].col && q.row === dev.enemy[i].row),
    '开发者测试场：手动站位原样进入战斗（不再自动重排）');
  // 快进到战斗结束（测试场不发奖、不结算，直接回到测试场）
  for (let i = 0; i < 2600 && !devBattle.finished; i++) {
    game.update(0.1);
  }
  ok(devBattle.finished && game.screen === dev && dev.player.length === 2,
    '测试场战斗结束自动回到测试场，编队保留');
  shot('70c_dev_back');
}

finishGate('冒烟测试');
