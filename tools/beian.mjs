// 备案用截图：后台无头渲染 14 个界面，统一在画面底部叠加「汉末行伍征战记」名称条。
// 渲染的是玩家版产物（wechat/），因此不会出现任何开发者入口。
// 输出：assets/_beian/*.png（750 宽，PNG）
// 用法：node tools/build-wx.mjs 后运行 node tools/beian.mjs
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { Game } from '../wechat/src/game.js';
import { CONFIG } from '../wechat/src/data/config.js';
import { TUTORIAL_STEPS } from '../wechat/src/core/tutorial.js';
import { seedUnlockSeen } from '../wechat/src/core/unlocks.js';
import { addChest } from '../wechat/src/core/chests.js';
import { autoPlaceSquads } from '../wechat/src/core/formation.js';
import { LevelSelectScreen } from '../wechat/src/screens/levels.js';
import { DeployScreen } from '../wechat/src/screens/deploy.js';
import { TrialScreen } from '../wechat/src/screens/trial.js';
import { HeroBattleScreen } from '../wechat/src/screens/heroBattle.js';
import { HeroScreen } from '../wechat/src/screens/heroes.js';
import { ShopScreen } from '../wechat/src/screens/shop.js';
import { ChestScreen } from '../wechat/src/screens/chests.js';
import { DailyShopScreen } from '../wechat/src/screens/dailyShop.js';
import { BarracksScreen, BARRACKS_LAYOUT } from '../wechat/src/screens/barracks.js';
import { cardRect, CARD } from '../wechat/src/render/unitCard.js';

const W = 750;
const H = 1334;
const BAR = 64;          // 底部名称条高度，画面整体变为 750×1398
const TITLE = '汉末行伍征战记';
const OUT = path.resolve('assets/_beian');
fs.mkdirSync(OUT, { recursive: true });

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

const store = new Map();
const platform = {
  name: 'beian',
  storage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
  pixelRatio: () => 1,
  createCanvas: (w, h) => createCanvas(w, h),
  now: () => 0,
  requestFrame: () => 0,
  onTap: () => {},
  rewardedAd: null,
  audio: {
    createSound: () => ({ play() {}, stop() {}, setVolume() {}, destroy() {} }),
    createMusic: () => ({ play() {}, pause() {}, setVolume() {}, onError() {}, destroy() {} }),
  },
  vibrate() {},
};

const game = new Game(canvas, ctx, platform);
for (const s of TUTORIAL_STEPS) game.state.tutorial.seen[s.id] = true;
seedUnlockSeen(game.state, CONFIG.levelGen.total);

let errors = 0;
function ok(cond, msg) {
  if (cond) console.log(`  ✓ ${msg}`);
  else { errors++; console.error(`  ✗ ${msg}`); }
}

function tick(n = 1, dt = 1 / 60) {
  for (let i = 0; i < n; i++) game.update(dt);
}
function tap(x, y) {
  game.handleDown(x, y);
  game.handleUp(x, y);
}
function screenName() {
  return game.screen && game.screen.constructor ? game.screen.constructor.name : '';
}

// 底部名称条：不遮挡任何游戏界面，每张截图都能明确看到正式名
function drawTitleBar(c) {
  c.save();
  c.fillStyle = '#0b0d12';
  c.fillRect(0, H, W, BAR);
  c.fillStyle = 'rgba(214, 178, 92, 0.92)';
  c.fillRect(0, H, W, 2);
  c.font = '700 30px "Microsoft YaHei", "PingFang SC", sans-serif';
  c.fillStyle = '#e8c96e';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(TITLE, W / 2, H + BAR / 2 + 1);
  c.restore();
}

function shot(name) {
  try {
    game.draw();
    const out = createCanvas(W, H + BAR);
    const octx = out.getContext('2d');
    octx.drawImage(canvas, 0, 0);
    drawTitleBar(octx);
    const buf = out.toBuffer('image/png');
    const file = path.join(OUT, `${name}.png`);
    fs.writeFileSync(file, buf);
    const kb = Math.round(buf.length / 1024);
    console.log(`  截图 ${name}.png (${kb} KB)`);
    ok(buf.length >= 60 * 1024 && buf.length <= 5 * 1024 * 1024, `${name} 体积 ${kb}KB 在 60KB–5MB 内`);
  } catch (e) {
    errors++;
    console.error(`  ✗ ${name} 渲染失败:`, e.message);
  }
}

/* ---------- 存档准备 ---------- */
function fillUnits(levels = 4) {
  const troops = [
    'shield', 'shield', 'shield', 'spear', 'spear', 'spear',
    'cavalry', 'cavalry', 'cavalry', 'archer', 'archer', 'archer',
    'shield', 'spear', 'cavalry', 'archer', 'shield', 'spear',
    'cavalry', 'archer', 'qingzhu', 'qingzhu', 'baima', 'baima', 'huhao',
  ];
  game.state.units = troops.map((troop, i) => ({
    id: `u${i}`, troop, level: levels + (i % 3 === 0 ? 2 : i % 2),
  }));
}
function autoFormation() {
  const squads = autoPlaceSquads(game.state.units.slice(0, 25).map((u, i) => ({
    uid: `s${i}`, troop: u.troop, level: u.level,
  })));
  const form = new Array(CONFIG.formation.cols * CONFIG.formation.rows).fill(null);
  for (const s of squads) form[s.row * CONFIG.formation.cols + s.col] = s.uid;
  game.state.formation = form;
}

game.state.maxCleared = 350;
game.state.coins = 98000;
game.state.heroTickets = 30;
game.state.heroAdDay = '';
game.state.heroAdCount = 0;
game.state.heroes = { guanping: 6, guanyu: 4, zhangfei: 3, huanggai: 2 };
game.state.heroLevelRewards = { 250: 'guanping' };
game.state.heroBattleCleared = 6;
game.state.trialCleared = 5;
game.state.dailyShop = { day: '', sold: [] };
fillUnits(4);
autoFormation();
for (const id of ['wood', 'wood', 'wood', 'silver', 'silver', 'gold']) addChest(game.state, id, 1);
game.save();

/* ---------- 01 首页 ---------- */
game.home();
tick(3);
shot('01_首页');

/* ---------- 02 关卡 ---------- */
game.go(new LevelSelectScreen(game));
tick(2);
shot('02_关卡');

/* ---------- 03 布阵 ---------- */
game.state.maxCleared = 11; // 让第 12 关成为待挑战关
autoFormation();
game.go(new DeployScreen(game, { mode: 'battle', level: 12 }));
tap(121, 906); // 按战力布阵
tick(3);
game.toastText = '';
shot('03_布阵');

/* ---------- 04 战斗 + 05 胜利结算 ---------- */
tap(375, 1265); // 出战
tick(75);
game.toastText = ''; // 清掉「已按战力布阵」提示，避免遮挡战斗统计
shot('04_战斗');
let guard = 0;
while (screenName() !== 'ResultScreen' && guard++ < 4000) tick(1);
shot('05_胜利结算');
ok(screenName() === 'ResultScreen', '战斗结束进入结算页');

/* ---------- 06-13 其余页面 ---------- */
game.state.maxCleared = 350;
game.go(new TrialScreen(game));
tick(2);
shot('06_演武');

game.go(new HeroBattleScreen(game));
tick(2);
shot('07_英雄战');

game.go(new HeroScreen(game));
tick(2);
shot('08_招募');

game.go(new ShopScreen(game));
tick(2);
shot('09_商城');

game.go(new ChestScreen(game));
tick(2);
shot('10_宝箱');

game.go(new DailyShopScreen(game));
tick(2);
shot('11_每日');

game.go(new BarracksScreen(game, { viewOnly: true }));
tick(2);
shot('12_兵营');

const L = BARRACKS_LAYOUT.list;
const rc = cardRect(0, L.cols, L.x0, L.y0, CARD);
tap(rc.x + rc.w / 2, rc.y + rc.h / 2);
tick(2);
shot('13_兵种详情');

/* ---------- 14 战败广告页 ---------- */
game.state.maxCleared = 349;
game.state.units = [
  { id: 'w0', troop: 'shield', level: 1 },
  { id: 'w1', troop: 'spear', level: 1 },
  { id: 'w2', troop: 'archer', level: 1 },
  { id: 'w3', troop: 'cavalry', level: 1 },
];
autoFormation();
game.go(new DeployScreen(game, { mode: 'battle', level: 350 }));
tap(121, 906);
tap(375, 1265);
guard = 0;
while (screenName() !== 'ResultScreen' && guard++ < 8000) tick(1);
shot('14_战败广告');
ok(screenName() === 'ResultScreen' && game.screen.d && game.screen.d.win === false,
  '战败结算页正常打开');

console.log(errors ? `\n完成但有 ${errors} 个问题` : '\n备案截图全部生成');
process.exitCode = errors ? 1 : 0;
