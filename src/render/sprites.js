// 精灵表（SpriteSheet）与动画播放
// 一张图 = 一个兵种的一个档位，4 行（待机/攻击/受击/死亡），最多 4 列帧。
// 生成器只用最基础的 Canvas 2D 路径，浏览器、微信小游戏、Node(@napi-rs/canvas) 都能跑。
// 之后换真实美术：把 assets/sprites/<兵种>_<档位>.png 按同样网格替换即可，渲染代码不用改。

import { SPECIAL_DRAW } from './specialSprites.js';
import { inkShade, inkOutline, isInkFill } from './ink.js';
import { TROOP_FIGURE } from './troopFigure.js';
import { SPRITE_TIER_LEVELS, spriteTierFor } from '../core/units.js';
export const FRAME_W = 96;
export const FRAME_H = 96;
export const COLS = 4;
export const ACTIONS = ['idle', 'attack', 'hit', 'death'];
export const FEET_Y = 86;

// 精灵档位 0..3 → 代表等级（SPRITE_TIER_LEVELS = Lv1 / Lv3 / Lv6 / Lv9）。
// 即 spriteLevelOf(i) === SPRITE_TIER_LEVELS[i]，额外做夹取以兜住越界值：
// 并行改造期间若仍有调用方传入旧的 0..9 档位，也不会数组越界 / 多生成档位。
// paletteFor / gearFor / buildSheet / loadCustomSheet 统一按这套 4 档取外观，
// 保证 4 档外观与原本对应等级（Lv1/Lv3/Lv6/Lv9）完全一致。
function spriteLevelOf(tierIndex) {
  const n = Number(tierIndex);
  const i = Number.isFinite(n)
    ? Math.max(0, Math.min(SPRITE_TIER_LEVELS.length - 1, Math.floor(n)))
    : 0;
  return SPRITE_TIER_LEVELS[i];
}

const cache = new Map();
let createCanvasImpl = null;
let troopResolver = null;
let loadImageImpl = null;

// 真实美术（可选）：加载 assets/sprites/<兵种>_<档位>.png，加载成功后自动覆盖程序化生成图
const customSheets = new Map();

export function initSprites({ createCanvas, loadImage }) {
  createCanvasImpl = createCanvas;
  loadImageImpl = loadImage || null;
}

export function setTroopResolver(fn) {
  troopResolver = fn;
}

// 真实 PNG 不存在或还没加载完时返回 null，调用方继续用程序化精灵表
function loadCustomSheet(troopId, tierIndex) {
  if (!loadImageImpl) return null;
  // 特殊兵种（稀有/史诗/传奇）没有导出 PNG（省小游戏包体），直接用同风格的程序化精灵表
  const troop = troopResolver ? troopResolver(troopId) : null;
  if (troop && troop.procedural) return null;
  const key = `${troopId}:${tierIndex}`;
  const rec = customSheets.get(key);
  if (rec) return rec.ready ? rec.img : null;

  const entry = { img: null, ready: false, failed: false };
  customSheets.set(key, entry);
  try {
    // 4 档精灵档位 0..3 → 文件名用代表等级：shield_1 / shield_3 / shield_6 / shield_9.png
    loadImageImpl(`assets/sprites/${troopId}_${spriteLevelOf(tierIndex)}.png`, (img) => {
      if (img) {
        entry.img = img;
        entry.ready = true;
      } else {
        entry.failed = true;
      }
    });
  } catch (e) {
    entry.failed = true;
  }
  return null;
}

function makeCanvas(w, h) {
  if (!createCanvasImpl) throw new Error('initSprites({createCanvas}) 未调用');
  const canvas = createCanvasImpl(w, h);
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

/* ---------------- 基础绘制工具 ---------------- */

function fillEllipse(ctx, x, y, rx, ry, color) {
  const a = Math.max(0.1, rx);
  const b = Math.max(0.1, ry);
  ctx.beginPath();
  ctx.ellipse(x, y, a, b, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (isInkFill(color)) {
    inkShade(ctx, x - a, y - b, a * 2, b * 2);
    inkOutline(ctx, false, 1);
  }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke, lw = 2) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
    if (isInkFill(fill)) inkShade(ctx, x, y, w, h);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  if (isInkFill(fill)) inkOutline(ctx, !!stroke, lw);
}

function poly(ctx, pts, fill, stroke, lw = 2) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
    if (isInkFill(fill)) {
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      inkShade(ctx, x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0);
    }
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  if (isInkFill(fill)) inkOutline(ctx, !!stroke, lw);
}

function line(ctx, x1, y1, x2, y2, color, lw = 2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function arcStroke(ctx, x, y, r, a0, a1, color, lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

// 受击泛红（轻，只作用在躯干上，避免整只变粉/糊成一团）
function hitFlash(ctx, cx, cy, rx, ry, t) {
  const a = t < 0.55 ? 0.16 : 0.09;
  fillEllipse(ctx, cx, cy, rx, ry, `rgba(255,132,104,${a})`);
}

/* ---------------- 配色与装备阶段（Lv1~Lv10） ---------------- */

// 等级 → 装备阶段：布衣(1~2) → 轻皮甲(3~4) → 局部铁片(5~7) → 铁甲(8~9) → 老兵(10)
export function gearFor(tierIndex) {
  // tierIndex 是 4 档精灵档位 0..3，先映射回代表等级（SPRITE_TIER_LEVELS[tierIndex]
  // = Lv1/Lv3/Lv6/Lv9），再按原本的 Lv1~Lv10 规则判定装备阶段，
  // 保证 4 档外观与原本对应等级完全一致。
  const lv = spriteLevelOf(tierIndex);
  return {
    lv,
    clothOnly: lv <= 2,
    leatherArmor: lv >= 3,
    ironWeapon: lv >= 4,
    platePartial: lv >= 5,
    plateFull: lv >= 8,
    armGuard: lv >= 9,
    veteran: lv >= 10,
  };
}

export function paletteFor(troop, tierIndex) {
  // 收到 4 档精灵档位 0..3；装备/配色由 gearFor 按 SPRITE_TIER_LEVELS[tierIndex]
  // 映射回的代表等级（Lv1/Lv3/Lv6/Lv9）计算，主色固定不随等级变化。
  const g = gearFor(tierIndex);
  // 第二版哑光色板：只用赭石 / 褐 / 土黄 / 苍黄 / 墨绿 / 墨灰这一档自然土色。
  // 红、蓝、白、亮绿、紫，以及会读成蓝紫的中间色（黛青 / 藕荷）一律不用。
  // 10 个等级同一套颜色：升级只换装备 / 饰件 / 材质，主色不随等级变亮变艳。
  // 四条兵线靠色相 + 剪影 + 武器形态 + 材质区分；品级色与英雄配色不在这里。
  const TONES = {
    shield: [38, 6, 33],   // 墨灰：暖黄灰，不偏蓝
    spear: [100, 12, 31],  // 墨绿：橄榄绿，和白毦 148 / 青竹 146 的翠绿拉开
    archer: [48, 15, 40],  // 土黄 / 苍黄：避开青州、藤甲的金黄
    cavalry: [22, 18, 33], // 赭石：暗褐，不读到正红
  };
  const [h, s, l] = TONES[troop?.baseTroop || troop?.id] || [32, 9, 32];
  const primary = `hsl(${h}, ${s}%, ${l}%)`;
  const dark = `hsl(${h}, ${s}%, ${Math.max(14, l - 7)}%)`;
  const light = `hsl(${h}, ${Math.max(2, s - 2)}%, ${Math.min(44, l + 8)}%)`;
  // 皮 / 铁 / 铜 / 马全部固定，不随等级变亮：否则一屏十个等级会出现「一级一个颜色」。
  const leather = 'hsl(30, 14%, 30%)';
  const leatherDark = 'hsl(28, 15%, 19%)';
  const iron = 'hsl(34, 5%, 38%)';          // 暖玄铁，彻底去冷蓝
  const ironDark = 'hsl(30, 7%, 23%)';
  const bronze = 'hsl(36, 13%, 31%)';       // 暗铜，不是品级金
  const base = {
    ...g,
    primary, dark, light, leather, leatherDark, iron, ironDark, bronze,
    trim: g.platePartial ? bronze : light,
    skin: '#ab8a68',
    steel: '#716a60',
    wood: '#57401f',
    bamboo: '#7e6f4a',
    // 马固定深褐，保证「骑兵 = 马上有人」一眼可辨
    horse: 'hsl(25, 11%, 23%)',
    horseDark: 'hsl(24, 13%, 14%)',
    plumeColor: '#6a4a37',
    style: null,      // 特殊兵种的识别点（见下方 style* 分支）
    rarity: 'common',
    accent: '#6a4a37' // 识别点用色（黄巾、白毦、藤编、暗青布…）
  };
  // 特殊兵种：配色覆盖（军装/马/藤甲等）；识别点色统一放 accent
  if (troop && troop.palette) Object.assign(base, troop.palette);
  if (troop && troop.style) base.style = troop.style;
  if (troop && troop.rarity) base.rarity = troop.rarity;
  if (!base.plumeColor) base.plumeColor = '#6a4a37';
  if (base.accent === undefined) base.accent = base.plumeColor;
  return base;
}

/* ---------------- 通用部件（坐标系：脚底 = 原点，向上为负） ---------------- */

// 腿 + 靴；绑腿、护膝按等级解锁
function drawLegs(ctx, p, { wrapAt = 6, kneeAt = 9, bootsAt = 10 } = {}) {
  const lv = p.lv;
  // 裤管上宽下窄，左右各一片，内侧暗面 / 外侧受光
  poly(ctx, [[-10, -20], [-1.5, -20], [-2, -6], [-10.5, -6]], p.dark);
  poly(ctx, [[1.5, -20], [10, -20], [10.5, -6], [2, -6]], p.dark);
  line(ctx, -6.2, -19, -6.6, -7, 'rgba(20,14,8,0.20)', 0.9);
  line(ctx, 6.2, -19, 6.6, -7, 'rgba(242,230,200,0.07)', 0.9);
  if (lv >= wrapAt) {
    for (let i = 0; i < 3; i++) {
      const yy = -14 + i * 3;
      line(ctx, -10, yy, -2, yy - 1.2, p.leather, 1.3);
      line(ctx, 2, yy - 1.2, 10, yy, p.leather, 1.3);
    }
  }
  if (lv >= kneeAt) {
    poly(ctx, [[-10, -16], [-2, -16], [-2, -12], [-10, -12]], p.iron);
    poly(ctx, [[2, -16], [10, -16], [10, -12], [2, -12]], p.iron);
  }
  const boot = lv >= bootsAt ? p.leatherDark : p.wood;
  poly(ctx, [[-10, -7], [-2, -7], [-2, -1], [-11, -1]], boot);
  poly(ctx, [[2, -7], [10, -7], [11, -1], [2, -1]], boot);
  fillEllipse(ctx, -6.4, -1.2, 5.2, 2.0, boot);
  fillEllipse(ctx, 6.8, -1.2, 5.2, 2.0, boot);
  line(ctx, -10, -6.4, -2, -6.4, p.bronze, 0.8);
  line(ctx, 2, -6.4, 10, -6.4, p.bronze, 0.8);
}

// 交领右衽战袍 + 战裙 + 束带：取代纯梯形平涂
function drawTunic(ctx, p, { top = -38, waist = -18, half = 11 } = {}) {
  poly(ctx, [[-half, top], [half, top], [half + 3.5, waist], [-half - 3.5, waist]], p.primary);
  // 右衽：斜襟 + 半透明暖色领缘（不用高饱和亮线）
  poly(ctx, [[-half + 1, top], [1.6, top + 7], [-half + 2.6, waist], [-half - 1, waist]], p.dark);
  line(ctx, -half + 1, top, 1.6, top + 7, 'rgba(240,225,195,0.22)', 1.3);
  line(ctx, 1.6, top + 7, -half + 2.6, waist, 'rgba(240,225,195,0.14)', 1.0);
  // 战裙 + 竖向布褶
  poly(ctx, [[-half - 3.5, waist], [half + 3.5, waist], [half + 5, waist + 5], [-half - 5, waist + 5]], p.dark);
  for (let i = -2; i <= 2; i++) {
    line(ctx, i * 4.2, waist + 0.8, i * 4.9, waist + 4.6, 'rgba(20,14,8,0.24)', 0.9);
  }
  // 束带与带扣
  line(ctx, -half - 2, waist - 1.6, half + 2, waist - 1.6, p.leather, 2.2);
  fillEllipse(ctx, 0, waist - 1.6, 1.6, 1.4, p.bronze);
}

// 胸甲：皮甲为整片缝线；铁甲为逐片错缝札甲 + 护心镜，不再是圆角方块
function drawChestArmor(ctx, p, { leatherAt = 3, ironAt = 8, y = -34, h = 17, half = 10 } = {}) {
  const lv = p.lv;
  if (lv >= leatherAt && lv < ironAt) {
    poly(ctx, [[-half, y], [half, y], [half + 1, y + h], [-half - 1, y + h]], p.leather);
    for (let i = 1; i <= 2; i++) line(ctx, -half, y + i * 5, half, y + i * 5, p.leatherDark, 1.1);
    fillEllipse(ctx, -half + 2, y + 3, 1.1, 1.1, p.bronze);
    fillEllipse(ctx, half - 2, y + 3, 1.1, 1.1, p.bronze);
  }
  if (lv >= ironAt) {
    poly(ctx, [[-half - 1, y], [half + 1, y], [half + 2, y + h], [-half - 2, y + h]], p.ironDark);
    const cols = 4, rows = 4;
    const pw = (half * 2) / cols, ph = h / rows;
    // 甲片用纯填充，不逐片叠墨线，避免 20px 内糊成黑块
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = -half + c * pw + 0.7;
        const py = y + r * ph + 0.7;
        ctx.fillStyle = p.iron;
        ctx.fillRect(px, py, pw - 1.4, ph - 1.4);
        ctx.fillStyle = 'rgba(242,236,214,0.10)';
        ctx.fillRect(px, py, pw - 1.4, Math.max(0.8, ph * 0.24));
      }
    }
    line(ctx, -half - 1, y + h * 0.5, half + 1, y + h * 0.5, 'rgba(14,18,23,0.28)', 0.9);
    fillEllipse(ctx, 0, y + h * 0.46, 3.0, 3.0, p.bronze);
    fillEllipse(ctx, -0.8, y + h * 0.46 - 0.8, 0.8, 0.8, 'rgba(245,232,200,0.30)');
    line(ctx, -half - 1, y + h - 2, half + 1, y + h - 2, p.leatherDark, 2);
    if (p.veteran) scuffs(ctx, -3, y + 4, 2, '#6f6a60');
  }
}

// 披膊：弧形肩甲，取代两侧小方块
function drawShoulders(ctx, p, { leatherAt = 5, ironAt = 9 } = {}) {
  if (p.lv < leatherAt) return;
  const mat = p.lv >= ironAt ? p.iron : p.leather;
  const edge = p.lv >= ironAt ? p.ironDark : p.leatherDark;
  poly(ctx, [[-16, -40], [-10, -42], [-6, -36], [-8, -33], [-16, -35]], mat);
  poly(ctx, [[6, -36], [10, -42], [16, -40], [16, -35], [8, -33]], mat);
  line(ctx, -15, -38.5, -8, -35, edge, 1.0);
  line(ctx, 8, -35, 15, -38.5, edge, 1.0);
  fillEllipse(ctx, -12.5, -37.5, 1.0, 1.0, p.bronze);
  fillEllipse(ctx, 12.5, -37.5, 1.0, 1.0, p.bronze);
}

// 无眼国风面庞：与英雄统一，靠眉骨暗影 / 鼻侧 / 短嘴交代体积
function drawFace(ctx, p, y = -48) {
  const fy = y - 1;
  fillEllipse(ctx, 1, fy, 5.4, 6.0, p.skin);
  fillEllipse(ctx, 3.6, fy + 0.6, 2.0, 3.0, 'rgba(88,56,34,0.14)');
  fillEllipse(ctx, 1.2, fy - 2.6, 4.4, 1.2, 'rgba(88,56,34,0.10)');
  // 鼻梁与下颌暗面：留白脸也有结构，不是空白面具
  line(ctx, 3.4, fy - 0.6, 4.0, fy + 1.8, 'rgba(88,56,34,0.22)', 0.8);
  fillEllipse(ctx, 1.4, fy + 4.2, 3.2, 1.2, 'rgba(88,56,34,0.09)');
  line(ctx, 2.2, fy + 3.0, 4.2, fy + 2.8, 'rgba(110,50,40,0.50)', 0.9);
  fillEllipse(ctx, -4.0, fy + 0.4, 1.5, 2.0, p.skin);
}

// 汉式巾帻（Lv1~2）：平顶 + 束带 + 单侧垂布
function drawClothWrap(ctx, p, y = -48) {
  poly(ctx, [[-7.4, y - 4.4], [8.6, y - 4.4], [9.6, y - 9.2], [-8.4, y - 9.2]], p.light);
  poly(ctx, [[-9.4, y - 9.2], [9.6, y - 9.2], [8.4, y - 11.2], [-8.4, y - 11.2]], p.primary);
  line(ctx, -8.6, y - 6.2, 9.0, y - 6.2, p.dark, 1.6);
  poly(ctx, [[-8.4, y - 8.2], [-11.4, y + 0.6], [-8.2, y + 1.2], [-6.4, y - 5.4]], p.light);
}

// 皮弁（Lv3~8）：尖顶皮帽 + 帽檐 + 铜钉
function drawLeatherCap(ctx, p, y = -48) {
  poly(ctx, [[-7.6, y - 3.6], [7.6, y - 3.6], [7.0, y - 8.6], [0, y - 10.2], [-7.0, y - 8.6]], p.leather);
  line(ctx, -7.4, y - 4.4, 7.4, y - 4.4, p.leatherDark, 2.2);
  line(ctx, -5, y - 8, 5, y - 8, 'rgba(240,225,195,0.12)', 0.9);
  fillEllipse(ctx, 0, y - 4.4, 1.2, 1.2, p.bronze);
}

// 兜鍪（Lv9~10）：弧顶 + 前檐 + 护颈札片 + 铜钉 / 盔缨
function drawHelmet(ctx, p, y = -48, { band = false, plume = false, plumeH = 15.5 } = {}) {
  fillEllipse(ctx, 0, y - 5.4, 8.0, 5.4, p.iron);
  poly(ctx, [[-9.2, y - 3.4], [9.2, y - 3.4], [8.0, y - 0.4], [-8.0, y - 0.4]], p.ironDark);
  poly(ctx, [[-9, y - 3.4], [-6.6, y - 3.4], [-7.2, y + 1.8], [-9.6, y + 1.2]], p.iron);
  poly(ctx, [[6.6, y - 3.4], [9, y - 3.4], [9.6, y + 1.2], [7.2, y + 1.8]], p.iron);
  line(ctx, -8.6, y + 0.2, -6.9, y + 1.6, p.ironDark, 0.9);
  line(ctx, 7.0, y + 1.6, 8.8, y + 0.2, p.ironDark, 0.9);
  if (band) line(ctx, -7, y - 6.6, 7, y - 6.6, p.bronze, 1.6);
  fillEllipse(ctx, 0, y - 4.0, 1.3, 1.3, p.bronze);
  if (plume) poly(ctx, [[0, y - 9.4], [4.2, y - plumeH], [-4.2, y - plumeH + 1]], p.plumeColor);
}

// 老兵磨损痕迹
function scuffs(ctx, x, y, n = 3, color = '#6f6a60') {
  for (let i = 0; i < n; i++) {
    line(ctx, x + i * 4 - 3, y + i * 3, x + i * 4 + 1.5, y + i * 3 + 3.5, color, 1);
  }
}

/* ---------------- 特殊兵种的识别点（每个兵种只做 1~2 个记忆点） ---------------- */

// 藤甲兵：藤条编织的斜纹（贴在胸甲 / 盾面 / 藤甲上，不重画护甲）
function drawVineWeave(ctx, x, y, w, h, color = 'rgba(70,52,22,0.5)') {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let i = -h; i < w + h; i += 3.4) {
    line(ctx, x + i, y, x + i + h, y + h, color, 1.1);
    line(ctx, x + i, y + h, x + i + h, y, 'rgba(40,28,10,0.32)', 0.9);
  }
  ctx.restore();
}

// 青州兵：褐色黄巾式包头（唯一识别点，混编感靠这一圈布）
function drawYellowTurban(ctx, p, y = -48) {
  poly(ctx, [[-8.6, y - 4.4], [9, y - 4.4], [11.4, y - 9], [-10.2, y - 9]], p.accent);
  fillEllipse(ctx, 0.4, y - 9, 11.2, 2.8, p.accent);
  // 两侧垂布
  poly(ctx, [[-10, y - 8.2], [-13.4, y + 1.6], [-9.6, y + 2.6], [-6.6, y - 5.4]], p.accent);
  line(ctx, -7.4, y - 6.4, 8.4, y - 6.4, 'rgba(35,24,8,0.28)', 1.2);
  fillEllipse(ctx, 0.4, y - 9.6, 2, 2, 'rgba(35,24,8,0.3)');
}

// 白毦兵：盔顶一束白色牦牛尾（向两侧散开）+ 胸前白缨边
function drawBaierPlume(ctx, p, y = -48) {
  const w = p.accent;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(0.4, y - 8.6);
    ctx.quadraticCurveTo(i * 5.4, y - 12.5, i * 7.2, y - 19 + Math.abs(i) * 1.6);
    ctx.strokeStyle = w;
    ctx.lineWidth = 2.1;
    ctx.stroke();
  }
  fillEllipse(ctx, 0.4, y - 8.4, 2.6, 2.6, w);
}

function drawBaierTrim(ctx, p) {
  // 胸前一圈白缨边（和盔上的白毦呼应）
  line(ctx, -9.5, -31, 9.5, -24.5, p.accent, 2.2);
  for (let i = -1; i <= 1; i++) line(ctx, i * 6.4, -30 + Math.abs(i) * 1.6, i * 6.4 + 1.8, -25, p.accent, 1.6);
}

/* ---------------- 兵种造型（面向右，原点在脚底） ---------------- */

function drawShield(ctx, p, action, t) {
  const lv = p.lv;
  let dx = 0, dy = 0, rot = 0, push = 0;
  if (action === 'idle') {
    dy = t > 0.5 ? 1 : 0;
  } else if (action === 'attack') {
    if (t < 0.4) { dx = -3; push = -5; rot = -0.07; }
    else if (t < 0.75) { dx = 6; push = 10; rot = 0.1; }
    else { dx = 2; push = 2; rot = 0.02; }
  } else if (action === 'hit') {
    rot = -0.2 + t * 0.18;
    dx = -6 * (1 - t);
    dy = 1;
  } else if (action === 'death') {
    rot = -0.4 - 1.0 * t;
    dy = 3 * t;
    dx = -3 * t;
  }

  ctx.save();
  ctx.translate(dx, dy);
  ctx.rotate(rot);
  // 先登死士：压低身体躲在巨盾后面（识别点 = 蹲姿 + 长方巨盾）
  if (p.style === 'xiandeng') {
    ctx.translate(0, 2);
    ctx.scale(1, 0.95);
  }

  drawLegs(ctx, p, { wrapAt: 6, kneeAt: 9, bootsAt: 10 });

  // 布衣战袍 → Lv3 皮甲 → Lv8 铁片甲
  drawTunic(ctx, p);
  drawChestArmor(ctx, p, { leatherAt: p.style === 'tengjia' ? 2 : 3, ironAt: 8 });
  // 藤甲兵：胸甲上压一层藤编斜纹（唯一识别点）
  if (p.style === 'tengjia') drawVineWeave(ctx, -10, -35, 20, 17);

  // 腰带：Lv3 束带，Lv7 加铜扣
  if (lv >= 3) {
    roundRect(ctx, -11.5, -18, 23, 4, 2, p.leatherDark);
    if (lv >= 7) fillEllipse(ctx, 0, -16, 2.3, 2.3, p.bronze);
  }

  // 护肩：Lv6 皮护肩，Lv8 铁护肩；Lv9 加臂甲
  drawShoulders(ctx, p, { leatherAt: 6, ironAt: 8 });
  if (lv >= 9) roundRect(ctx, 8, -30, 8, 13, 3, p.iron, p.ironDark, 1.1);

  // 头：布巾(1~2) → 皮帽(3~5) → 铁盔(6~10)
  drawFace(ctx, p, -48);
  if (lv <= 2) drawClothWrap(ctx, p, -48);
  else if (lv <= 5) drawLeatherCap(ctx, p, -48);
  else drawHelmet(ctx, p, -48, { plume: lv >= 9 });

  // 腰刀：Lv5 起「不只是纯防御」，Lv8 起换铁刀
  if (lv >= 5) {
    // 持刀的手臂
    line(ctx, 4, -34, 11 + push * 0.5, -23, p.skin, 3);
    ctx.save();
    ctx.translate(12 + push * 0.5, -23);
    ctx.rotate(-0.42);
    roundRect(ctx, -3.5, -2.5, 8, 4.5, 2, p.leatherDark);
    poly(ctx, [[4, -3], [18, -5.5], [20.5, -1], [4.5, 2.5]],
      lv >= 8 ? p.steel : '#a89f8e', lv >= 8 ? p.ironDark : '#6f6656', 1);
    ctx.restore();
  }

  // 盾：小圆木盾(Lv1) → 铁圈(Lv2) → 铆钉(Lv4) → 加大+暗铜包边(Lv7) → 铁盾+磨损(Lv10)
  // 特殊兵种：先登死士 = 长方巨盾、陷阵营 = 方盾 + 暗铜角、藤甲兵 = 藤编盾面
  const r = lv >= 7 ? 13.5 : lv >= 4 ? 11.5 : 9.5;
  // 持盾的手臂：让盾看起来是"举着"的，而不是浮在身上
  line(ctx, 3, -33, 10 + push, -22, p.skin, 3.2);
  ctx.save();
  ctx.translate(13 + push, p.style === 'xiandeng' ? -22 : -19);
  if (p.style === 'xiandeng') {
    // 长方巨盾：从脚边一直接到胸口，盾沿暗红漆
    roundRect(ctx, -11, -24, 22, 45, 4, p.wood, '#463320', 2.4);
    line(ctx, 0, -22, 0, 19, '#5f452c', 1.2);
    line(ctx, -11, -8, 11, -8, '#5f452c', 1.2);
    roundRect(ctx, -11, -24, 22, 6.5, 3, p.accent, '#5b231c', 1.2);
    fillEllipse(ctx, 0, 2, 4, 4, p.steel);
    fillEllipse(ctx, 0, 2, 2, 2, '#5f452c');
  } else if (p.style === 'xianzhen') {
    // 方盾 + 暗铜四角，表面最整齐（陷阵营唯一的识别点）
    roundRect(ctx, -11, -19, 21, 31, 3, p.iron, p.ironDark, 2.2);
    [[-8, -16], [8, -16], [-8, 9], [8, 9]].forEach(([cx, cy]) => {
      roundRect(ctx, cx - 2.6, cy - 2.6, 5.2, 5.2, 1.4, p.accent, null);
    });
    line(ctx, 0, -17, 0, 10, p.ironDark, 1.6);
    line(ctx, -9, -3, 9, -3, p.ironDark, 1.6);
  } else if (lv >= 10) {
    fillEllipse(ctx, 0, 0, r, r * 1.05, p.iron);
    arcStroke(ctx, 0, 0, r - 0.6, 0, Math.PI * 2, p.ironDark, 2.2);
    fillEllipse(ctx, 0, 0, 3.2, 3.2, p.ironDark);
    scuffs(ctx, -5, -7, 2, '#6f6a60');
  } else {
    fillEllipse(ctx, 0, 0, r, r * 1.05, lv >= 4 ? p.wood : '#9c7a4c');
    line(ctx, -r * 0.62, -r * 0.75, -r * 0.62, r * 0.75, '#5f452c', 1);
    line(ctx, 0, -r * 0.95, 0, r * 0.95, '#5f452c', 1);
    line(ctx, r * 0.62, -r * 0.75, r * 0.62, r * 0.75, '#5f452c', 1);
    if (lv >= 2) arcStroke(ctx, 0, 0, r - 0.5, 0, Math.PI * 2, p.steel, 2.2);
    if (lv >= 4) {
      [[-4.6, -5.4], [4.6, -5.4], [-4.6, 5.4], [4.6, 5.4]].forEach(([rx, ry]) => {
        fillEllipse(ctx, rx, ry, 1.2, 1.2, p.steel);
      });
    }
    if (lv >= 7) arcStroke(ctx, 0, 0, r - 1.7, 0, Math.PI * 2, p.bronze, 1.6);
  }
  // 藤甲兵：盾面也是藤编（和胸甲同一套斜纹）
  if (p.style === 'tengjia') drawVineWeave(ctx, -r * 0.78, -r * 0.85, r * 1.56, r * 1.7, 'rgba(52,38,14,0.62)');
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, 0, -30, 17, 22, t);

  ctx.restore();
}

function drawArcher(ctx, p, action, t) {
  const lv = p.lv;
  let dx = 0, dy = 0, bowRot = 0, rot = 0, pull = 0, arrowX = 0, arrowVis = true;
  if (action === 'idle') {
    dy = t > 0.5 ? 1 : 0;
  } else if (action === 'attack') {
    if (t < 0.3) { bowRot = -0.2; arrowVis = false; }
    else if (t < 0.62) { bowRot = -0.05; pull = 9; arrowVis = true; arrowX = -9; }
    else if (t < 0.85) { bowRot = 0.05; pull = 0; arrowX = 13; arrowVis = true; }
    else { bowRot = 0.12; arrowVis = false; }
  } else if (action === 'hit') {
    rot = -0.18 + t * 0.16;
    dx = -5 * (1 - t);
  } else if (action === 'death') {
    rot = 0.3 + 0.8 * t;
    dy = 4 * t;
    dx = 3 * t;
  }

  ctx.save();
  ctx.translate(dx, dy);
  ctx.rotate(rot);

  drawLegs(ctx, p, { wrapAt: 8, kneeAt: 9, bootsAt: 9 });
  drawTunic(ctx, p, { top: -37, waist: -13, half: 10 });
  // 胸甲：Lv3 皮甲，Lv6 铁片（弓兵比盾兵更早穿甲）
  drawChestArmor(ctx, p, { leatherAt: 3, ironAt: 6, y: -33, h: 15, half: 9 });
  // 无当飞军：暗青色斑纹布（腰带一块，南中风格，唯一识别点）
  if (p.style === 'wudang') {
    poly(ctx, [[-11, -21], [11, -21], [11, -14], [-11, -14]], p.accent);
    for (let i = 0; i < 3; i++) fillEllipse(ctx, -6 + i * 6, -17.5, 2.2, 1.5, 'rgba(240,244,240,0.16)');
  }

  // 箭袋：Lv2 出现（挂左腰），Lv5 加大，Lv8 满装 + 箭头清楚；无当飞军的箭袋更大
  if (lv >= 2) {
    const big = lv >= 5 || p.style === 'wudang';
    const qw = p.style === 'wudang' ? 10 : big ? 8.5 : 7;
    const qh = p.style === 'wudang' ? 20 : big ? 18 : 14;
    const qx = -17;
    const qy = big ? -35 : -32;
    roundRect(ctx, qx, qy, qw, qh, 3, p.leatherDark);
    const n = lv >= 8 || p.style === 'wudang' ? 4 : big ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const ax = qx + 2.2 + i * (qw - 4) / Math.max(1, n - 1);
      line(ctx, ax, qy + 1, ax - 0.8, qy - 6, '#b7a37a', 1.3);
      if (lv >= 8) poly(ctx, [[ax - 0.8, qy - 6], [ax - 3.4, qy - 6.2], [ax - 3.4, qy - 8.4]], p.steel);
    }
    if (big) line(ctx, qx + 1, qy + qh * 0.45, qx + qw - 1, qy + qh * 0.45, p.leather, 1.4);
  }

  // 肩部：Lv3 加轻皮甲披肩；Lv9 换成成套肩甲 + 护腕
  if (lv >= 3 && lv < 9) {
    poly(ctx, [[-11, -38], [10, -38], [10, -33], [-11, -33]], p.leather);
  }
  if (lv >= 9) {
    drawShoulders(ctx, p, { leatherAt: 9, ironAt: 9 });
    roundRect(ctx, 8, -28, 7.5, 11, 3, p.leather, p.leatherDark, 1.1);
  }

  // 头：布巾(1~5) → 皮帽(6~8) → 皮帽+铜箍(9~10)
  drawFace(ctx, p, -46);
  if (lv <= 5) drawClothWrap(ctx, p, -46);
  else {
    drawLeatherCap(ctx, p, -46);
    if (lv >= 9) line(ctx, -6.5, -56, 6.5, -56, p.bronze, 1.5);
  }

  // 弓：Lv1~3 竹弓（细、浅黄），Lv4 起木弓；Lv5 起弓弦更明显，Lv7 弓臂加铜饰
  // 特殊兵种：丹阳青竹弓手 = 青绿色细长竹弓；元戎弩士 = 换成方形连弩匣（核心识别点）
  if (p.style === 'yuanyong') {
    // ---- 元戎弩士：双手端方形连弩匣 ----
    line(ctx, 4, -36, 12, -30, p.skin, 3.2);   // 端弩的手臂
    line(ctx, 2, -27, 9, -24, p.skin, 3);
    ctx.save();
    ctx.translate(16, -30);
    ctx.rotate(bowRot * 0.7);
    roundRect(ctx, -12, -6.5, 26, 13, 2.5, p.wood, '#3d2c1c', 1.4);   // 方匣弩身
    roundRect(ctx, -9, -3.2, 16, 3, 1, '#2a2118');                    // 箭槽
    line(ctx, 12, -9, 12, 9, p.iron, 2.6);                            // 横向弩臂
    line(ctx, 12, -9, -4 - pull * 0.6, 0, '#d6c8ab', 1.2);            // 弓弦（后拉）
    line(ctx, -4 - pull * 0.6, 0, 12, 9, '#d6c8ab', 1.2);
    if (arrowVis) {
      line(ctx, -8 + arrowX, 0, 16 + arrowX, 0, '#cdbf9f', 1.8);
      poly(ctx, [[16 + arrowX, 0], [12 + arrowX, -2.6], [12 + arrowX, 2.6]], p.steel);
    }
    fillEllipse(ctx, -4, 2, 2.6, 3, p.skin);                           // 握把的手
    ctx.restore();
  } else {
    // ---- 普通弓手 / 青竹弓手 / 无当飞军：常规弓 ----
    const R = p.style === 'qingzhu' ? 16 : lv >= 4 ? 15 : 14;
    const bowColor = p.style === 'qingzhu' ? p.accent : (lv >= 4 ? p.wood : p.bamboo);
    const bowW = p.style === 'qingzhu' ? 1.8 : (lv >= 4 ? 3.2 : 2.3);
    // 持弓的手臂（肩 → 弓把），让弓不是浮在半空
    line(ctx, 4, -36, 14, -32.5, p.skin, 3.2);
    ctx.save();
    ctx.translate(15, -32);
    ctx.rotate(bowRot);
    arcStroke(ctx, 0, 0, R, -1.2, 1.2, bowColor, bowW);
    if (p.style === 'qingzhu') {
      // 青竹弓：弓身更细长、竹节分明
      [-0.85, -0.35, 0.15, 0.65].forEach((a) => {
        fillEllipse(ctx, R * Math.cos(a), R * Math.sin(a), 1.5, 1.1, 'rgba(24,48,30,0.5)');
      });
    } else if (lv < 4) {
      line(ctx, 0, -R + 1, 0, -7, '#a58f5c', 1);
    }
    const tipX = R * Math.cos(1.2);
    const tipY = R * Math.sin(1.2);
    if (lv >= 7) {
      fillEllipse(ctx, tipX, -tipY, 1.9, 1.9, p.bronze);
      fillEllipse(ctx, tipX, tipY, 1.9, 1.9, p.bronze);
    }
    const strColor = lv >= 5 ? '#c2b190' : '#ab9c7c';
    const strW = lv >= 5 ? 1.6 : 1.1;
    line(ctx, tipX, -tipY, -pull, 0, strColor, strW);
    line(ctx, -pull, 0, tipX, tipY, strColor, strW);
    if (arrowVis) {
      line(ctx, arrowX - 8, 0, arrowX + 15, 0, '#b7a37a', 1.8);
      poly(ctx, [[arrowX + 15, 0], [arrowX + 10.5, -3.2], [arrowX + 10.5, 3.2]], p.steel);
      poly(ctx, [[arrowX - 8, 0], [arrowX - 3.8, -3], [arrowX - 3.8, 3]], p.plumeColor);
    }
    ctx.restore();
  }

  if (action === 'hit') hitFlash(ctx, 0, -28, 15, 20, t);

  ctx.restore();
}

function drawCavalry(ctx, p, action, t) {
  const lv = p.lv;
  let dx = 0, dy = 0, rot = 0, legPhase = 0;
  // 白马义从是骑射：不跟着近战挥砍旋转武器，而是用弓的「抬弓 / 拉弦 / 放箭」
  let weaponRot = p.style === 'baima' ? 0 : -0.5;
  let bowRot = 0, bowPull = 0, bowArrowX = 0, bowArrowVis = true;
  if (action === 'idle') {
    dy = t > 0.5 ? 1 : 0;
    legPhase = t > 0.5 ? 0.5 : 0;
  } else if (action === 'attack') {
    if (p.style === 'baima') {
      // 3 帧：0 = 抬弓，0.5 = 拉满弦，1 = 放箭（和弓兵的动作节奏一致）
      if (t < 0.4) { bowRot = -0.18; bowArrowVis = false; }
      else if (t < 0.75) { bowRot = -0.04; bowPull = 9; bowArrowX = -8; bowArrowVis = true; }
      else { bowRot = 0.08; bowPull = 0; bowArrowX = 13; bowArrowVis = true; }
    } else if (t < 0.4) { dx = -6; weaponRot = -1.1; }
    else if (t < 0.75) { dx = 8; weaponRot = 0.35; }
    else { dx = 4; weaponRot = -0.2; }
    legPhase = t;
  } else if (action === 'hit') {
    rot = -0.14 + t * 0.12;
    dx = -6 * (1 - t);
  } else if (action === 'death') {
    rot = 0.2 + 0.55 * t;
    dy = 7 * t;
    dx = -3 * t;
  }

  ctx.save();
  ctx.translate(dx, dy);
  ctx.rotate(rot);

  // 马尾（在身体后面）
  ctx.beginPath();
  ctx.moveTo(-25, -38);
  ctx.quadraticCurveTo(-36, -33 + legPhase * 3, -30, -13);
  ctx.strokeStyle = p.horseDark;
  ctx.lineWidth = 4.5;
  ctx.stroke();

  // 马腿（4 条，带步态）
  const legs = [[-15, 0], [-10, 0.15], [11, 0.5], [16, 0.65]];
  legs.forEach(([lx, ph]) => {
    const swing = Math.sin((legPhase + ph) * Math.PI * 2) * (action === 'idle' ? 1.5 : 4.5);
    roundRect(ctx, lx - 2 + swing * 0.4, -27, 4.5, 25, 2, p.horseDark);
    roundRect(ctx, lx - 3 + swing, -6, 7.5, 6, 2, '#2a2018');
  });

  // 马身：后臀 + 躯干（两段椭圆拼出马背与腹部），腹线让轮廓更清楚
  fillEllipse(ctx, -19, -34, 11.5, 11, p.horse);
  fillEllipse(ctx, -3, -35, 20, 11.5, p.horse);
  line(ctx, -25, -27, 12, -27, p.horseDark, 1.1);

  // 马颈：从马肩斜上，接到马头
  poly(ctx, [[7, -42], [14, -39], [30, -48], [22, -56]], p.horse);

  // 鞍褥（Lv3 起更清楚的马具）
  if (lv >= 3) {
    poly(ctx, [[-13, -46], [7, -46], [9, -41], [-14, -41]], lv >= 5 ? p.primary : p.leather);
    line(ctx, -14, -43, 9, -43, p.leatherDark, 1.2);
  }

  // 马甲：Lv4 胸前皮甲 → Lv6 铁扣护胸 → Lv8 覆腹札甲 → Lv10 磨损
  // 幽州突骑是轻骑：马不披甲（识别点 = 精简的 "快" 剪影）
  const noBarding = p.style === 'youzhou';
  if (lv >= 4 && !noBarding) {
    const plate = lv >= 8 ? p.ironDark : p.leather;
    const stroke = lv >= 8 ? '#2a2018' : p.leatherDark;
    poly(ctx, [[14, -38], [25, -36], [26, -27], [15, -25]], plate, stroke, 1.2);
    if (lv >= 6) {
      line(ctx, 15, -31.5, 26, -31.5, stroke, 1.2);
      fillEllipse(ctx, 20, -35, 1.4, 1.4, p.steel);
      fillEllipse(ctx, 20, -28.5, 1.4, 1.4, p.steel);
    }
    if (lv >= 8) {
      poly(ctx, [[-20, -39], [6, -39], [7, -27], [-18, -27]], plate, stroke, 1.2);
      [-14, -8, -2].forEach((x) => line(ctx, x, -38, x, -28, stroke, 1.1));
      fillEllipse(ctx, 1, -33, 1.3, 1.3, p.steel);
      if (p.veteran) scuffs(ctx, -13, -36, 2, '#6f6a60');
    }
  }

  // 马头 + 口鼻 + 鬃毛 + 耳朵
  fillEllipse(ctx, 32, -49, 8, 5.2, p.horse);
  poly(ctx, [[29, -51], [36, -52.5], [41, -47], [37, -43], [30, -44.5]], p.horse);
  line(ctx, 12, -44, 27, -54, p.horseDark, 4);
  poly(ctx, [[27, -54], [28.4, -60], [31.4, -54]], p.horseDark);
  fillEllipse(ctx, 34, -51, 1.5, 1.5, '#2a2018');
  fillEllipse(ctx, 39.5, -46.5, 1, 1, '#2a2018');
  // 虎豹骑：马面护甲（盖上额与鼻梁，识别点之一）
  if (p.style === 'huhao') {
    poly(ctx, [[28.5, -52], [35, -54.4], [41.5, -48.6], [38, -44], [30, -45]],
      p.ironDark, '#12161d', 1.3);
    line(ctx, 33, -51.5, 39.5, -47, p.iron, 1.2);
    fillEllipse(ctx, 34, -51, 1.4, 1.4, '#0e1116');
  }

  // 缰绳：从马嘴连到骑手手上
  if (lv >= 3) {
    line(ctx, 39, -46, 22, -45, p.leatherDark, 1.6);
    line(ctx, 22, -45, 9, -56, p.leatherDark, 1.4);
  } else {
    line(ctx, 39, -46, 9, -56, p.trim, 1.4);
  }

  // 骑手：腿、躯干、甲、肩、头（虎豹骑从 Lv1 就是深色重甲）
  const heavy = p.style === 'huhao';
  // 白马义从：背后的箭袋（骑射识别点，和弓兵的箭袋同一套画法）
  if (p.style === 'baima') {
    roundRect(ctx, -20, -71, 8, 19, 3, p.leatherDark);
    for (let i = 0; i < 3; i++) {
      const ax = -18.5 + i * 2.4;
      line(ctx, ax, -70, ax - 1, -76, '#cdbf9f', 1.3);
      poly(ctx, [[ax - 1, -76], [ax - 3.6, -76.4], [ax - 3.6, -78.2]], p.steel);
    }
    line(ctx, -19, -64, -12, -64, p.leather, 1.4);
  }
  roundRect(ctx, -6, -50, 6, 12, 3, p.dark);
  drawTunic(ctx, p, { top: -64, waist: -47, half: 8 });
  if (lv >= 2 || heavy) {
    const plate = lv >= 9 || heavy;
    roundRect(ctx, -9, -62, 17, 13, 4, plate ? p.iron : p.leather,
      plate ? p.ironDark : p.leatherDark, 1.2);
    if (plate) line(ctx, 0, -60, 0, -50, p.ironDark, 1.2);
  }
  if (lv >= 5) {
    const iron = lv >= 9;
    roundRect(ctx, -12, -66, 8, 6, 3, iron ? p.iron : p.leather, iron ? p.ironDark : p.leatherDark, 1);
    roundRect(ctx, 4, -66, 8, 6, 3, iron ? p.iron : p.leather, iron ? p.ironDark : p.leatherDark, 1);
  }
  if (lv >= 9) roundRect(ctx, 6, -58, 6, 9, 2.5, p.iron, p.ironDark, 1);

  drawFace(ctx, p, -70);
  if (lv <= 3) drawClothWrap(ctx, p, -70);
  else if (lv <= 7) drawLeatherCap(ctx, p, -70);
  else drawHelmet(ctx, p, -70, { band: lv >= 9, plume: lv >= 9, plumeH: 12 });

  // 武器：Lv1~6 长枪 → Lv7 起换长刀
  // 特殊兵种：幽州突骑 = 短枪、白马义从 = 马上持弓、虎豹骑 = 长枪前倾
  ctx.save();
  ctx.translate(5, -60);
  ctx.rotate(weaponRot);
  if (p.style === 'baima') {
    // 白马义从：骑射（弓的位置、拉弦、箭头都和弓兵一致，只是骑在马上）
    ctx.translate(13, -2);                 // 相对武器原点 (5,-60) → 弓把落在 (18,-62)
    ctx.rotate(bowRot);
    line(ctx, -12, -4, 0, 0, p.skin, 3);    // 持弓手臂（肩 → 弓把）
    const R = 15;
    arcStroke(ctx, 0, 0, R, -1.15, 1.15, p.wood, 2.6);
    const tx = R * Math.cos(1.15);
    const ty = R * Math.sin(1.15);
    line(ctx, tx, -ty, -bowPull, 0, '#ded0b2', 1.5);
    line(ctx, -bowPull, 0, tx, ty, '#ded0b2', 1.5);
    if (lv >= 7) {
      fillEllipse(ctx, tx, -ty, 1.8, 1.8, p.bronze);
      fillEllipse(ctx, tx, ty, 1.8, 1.8, p.bronze);
    }
    if (bowArrowVis) {
      line(ctx, bowArrowX - 8, 0, bowArrowX + 15, 0, '#cdbf9f', 1.8);
      poly(ctx, [[bowArrowX + 15, 0], [bowArrowX + 10.5, -3.2], [bowArrowX + 10.5, 3.2]], p.steel);
      poly(ctx, [[bowArrowX - 8, 0], [bowArrowX - 3.8, -3], [bowArrowX - 3.8, 3]], p.plumeColor);
    }
    fillEllipse(ctx, 0, 0, 2.8, 2.8, p.skin); // 弓把上的手
  } else if (p.style === 'youzhou') {
    // 幽州突骑：短枪斜挎（轻骑的 "快" 剪影）
    line(ctx, -8, 0, 20, 0, p.wood, 2.6);
    poly(ctx, [[20, 0], [26, -3.4], [26, 3.4]], '#92979c', '#777e85', 1.1);
  } else if (p.style === 'huhao') {
    // 虎豹骑：长枪前倾、带枪缨（重骑冲锋）
    line(ctx, -14, 0, 32, 0, '#4b3521', 3.4);
    poly(ctx, [[32, 0], [40, -4], [40, 4]], p.steel, p.ironDark, 1.2);
    poly(ctx, [[28, -1.4], [31.5, -7], [30, 1]], p.plumeColor);
    poly(ctx, [[28, 1.4], [31.5, 7], [30, -1]], p.plumeColor);
  } else if (lv >= 7) {
    line(ctx, -10, 0, 14, 0, p.leatherDark, 3);
    poly(ctx, [[14, -1.5], [26, -6], [30, -1], [26, 4], [14, 1.5]],
      lv >= 9 ? p.steel : '#8d8579', p.ironDark, 1.1);
  } else {
    line(ctx, -8, 0, 24, 0, p.wood, 3);
    poly(ctx, [[24, 0], [30, -4], [30, 4]], '#8d8579', '#655d51', 1.1);
  }
  fillEllipse(ctx, 0, 0, 3, 3, p.skin); // 握持的手
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, -2, -38, 16, 18, t);

  ctx.restore();
}

function drawSpear(ctx, p, action, t) {
  const lv = p.lv;
  let dx = 0, dy = 0, rot = 0, thrust = 0, tilt = -0.9;
  if (action === 'idle') {
    dy = t > 0.5 ? 1 : 0;
    tilt = t > 0.5 ? -0.88 : -0.92;
  } else if (action === 'attack') {
    // 突刺：先后撤半步、再整支枪往前送（枪尖始终留在画面内）
    if (t < 0.35) { dx = -3; thrust = -6; tilt = -1.05; }
    else if (t < 0.7) { dx = 2; thrust = 6; tilt = -0.24; }
    else { dx = 1; thrust = 2; tilt = -0.6; }
  } else if (action === 'hit') {
    rot = -0.18 + t * 0.16;
    dx = -6 * (1 - t);
    dy = 1;
  } else if (action === 'death') {
    rot = -0.35 - 0.9 * t;
    dy = 3 * t;
    dx = -3 * t;
  }

  ctx.save();
  ctx.translate(dx, dy);
  ctx.rotate(rot);

  drawLegs(ctx, p, { wrapAt: 6, kneeAt: 9, bootsAt: 10 });
  drawTunic(ctx, p, { half: 10 });
  drawChestArmor(ctx, p, { leatherAt: 3, ironAt: 8, half: 10 });
  // 白毦兵：胸前一圈白缨边（和盔顶的白毦呼应）
  if (p.style === 'baier') drawBaierTrim(ctx, p);

  // 腰带：Lv5 起更清楚，Lv7 起加铜扣
  if (lv >= 5) {
    roundRect(ctx, -11.5, -18, 23, 4, 2, p.leatherDark);
    if (lv >= 7) fillEllipse(ctx, 0, -16, 2.3, 2.3, p.bronze);
  }

  // 护肩：Lv5 皮 / Lv9 铁；Lv9 加臂甲；大戟士从 Lv1 起就是加宽的肩甲
  drawShoulders(ctx, p, { leatherAt: 5, ironAt: 9 });
  if (lv >= 9) roundRect(ctx, 8, -31, 8, 14, 3, p.iron, p.ironDark, 1.1);
  if (p.style === 'daji') {
    roundRect(ctx, -17.5, -43, 12, 9, 3, p.iron, p.ironDark, 1.2);
    roundRect(ctx, 5.5, -43, 12, 9, 3, p.iron, p.ironDark, 1.2);
  }

  // 头：布巾(1~4) → 皮帽(5~8) → 铁盔(9~10)
  // 特殊兵种：青州兵 = 褐色黄巾包头、白毦兵 = 盔顶白毦、大戟士 = 重盔
  drawFace(ctx, p, -48);
  if (p.style === 'qingzhou') drawYellowTurban(ctx, p, -48);
  else if (p.style === 'baier') {
    drawHelmet(ctx, p, -48, { band: true });
    drawBaierPlume(ctx, p, -48);
  } else if (p.style === 'daji') {
    drawHelmet(ctx, p, -48, { band: true, plume: lv >= 10, plumeH: 13 });
  } else if (lv <= 4) drawClothWrap(ctx, p, -48);
  else if (lv <= 8) drawLeatherCap(ctx, p, -48);
  else drawHelmet(ctx, p, -48, { plume: lv >= 10 });

  // 长枪：木枪(Lv1) → 铁箍(Lv2) → 铁枪头(Lv4) → 枪缨(Lv7) → 铁枪(Lv10)
  // 大戟士：武器换成「卜字戟」——主刃 + 两侧出刃的横枝（唯一识别点）
  ctx.save();
  ctx.translate(6 + thrust, -36);
  ctx.rotate(tilt);
  if (p.style === 'daji') {
    line(ctx, -30, 0, 28, 0, '#5c3f27', 3.6);
    poly(ctx, [[28, 0], [37, -3.4], [37, 3.4]], p.steel, p.ironDark, 1.2);
    poly(ctx, [[22, -1.2], [23.4, -10], [27.4, -9], [26.4, -1.2]], p.steel, p.ironDark, 1.1);
    poly(ctx, [[22, 1.2], [23.4, 10], [27.4, 9], [26.4, 1.2]], p.steel, p.ironDark, 1.1);
    line(ctx, 22.6, -7.6, 26.8, -7.6, p.ironDark, 1);
    line(ctx, 22.6, 7.6, 26.8, 7.6, p.ironDark, 1);
    fillEllipse(ctx, 0, 0, 2.9, 3.3, p.skin); // 握戟的手
    if (lv >= 7) {
      poly(ctx, [[27, -1.4], [31.5, -7], [29.5, 1]], p.plumeColor);
      poly(ctx, [[27, 1.4], [31.5, 7], [29.5, -1]], p.plumeColor);
    }
    if (p.veteran) line(ctx, 0, -1, 14, -1, '#7c838a', 1);
  } else {
    line(ctx, -26, 0, 30, 0, lv >= 7 ? '#6b452a' : p.wood, lv >= 7 ? 3.2 : 2.8);
    fillEllipse(ctx, 0, 0, 2.9, 3.3, p.skin); // 握枪的手
    if (lv >= 4) {
      const head = lv >= 8 ? p.steel : '#8a8377';
      poly(ctx, [[30, 0], [36, -3.2], [36, 3.2]], head, lv >= 8 ? p.ironDark : '#655d51', 1.1);
      line(ctx, 30, 0, 33, 0, p.ironDark, 1.1);
    } else {
      poly(ctx, [[30, 0], [35, -2.4], [35, 2.4]], lv >= 2 ? '#b9a374' : '#9c7a4c');
      if (lv >= 2) roundRect(ctx, 27.5, -2.6, 3, 5.2, 1, p.steel);
    }
    if (lv >= 7) {
      poly(ctx, [[29, -1.4], [33.5, -7], [31.5, 1]], p.plumeColor);
      poly(ctx, [[29, 1.4], [33.5, 7], [31.5, -1]], p.plumeColor);
    }
    if (p.veteran) line(ctx, 0, -1, 14, -1, '#6f6a60', 1);
  }
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, 0, -30, 16, 21, t);

  ctx.restore();
}

// 普通兵种走「曲线汉俑造型」模块；旧的直角堆叠实现保留为兼容参考，不再参与生成。
// 特殊兵种仍走 SPECIAL_DRAW（独立剪影），不受影响。
const TROOP_DRAW = TROOP_FIGURE;

// 新版造型模块内部已按兵线做了体型差异（肩宽 / 袍长 / 站姿），
// 这里不再叠加整体缩放，否则会二次变形。
const BODY_SHAPE = {
  shield: { sx: 1, sy: 1 },
  archer: { sx: 1, sy: 1 },
  spear: { sx: 1, sy: 1 },
  cavalry: { sx: 1, sy: 1 },
};

function drawShadow(ctx, alpha = 0.3) {
  // 沙地暖反光 + 接触阴影 + 核心暗部：小兵站进场地，不再浮在网格上
  fillEllipse(ctx, 0, 1.2, 22, 5.6, `rgba(122,92,56,${alpha * 0.28})`);
  fillEllipse(ctx, 0, 0, 18, 4.2, `rgba(0,0,0,${alpha})`);
  fillEllipse(ctx, 0, -0.6, 8, 2.0, `rgba(0,0,0,${alpha * 0.6})`);
}

/* ---------------- 出框自动纠正 ---------------- */

// 量出画布上可见像素的包围盒（alpha > 8）
function alphaBounds(ctx, w, h) {
  const { data } = ctx.getImageData(0, 0, w, h);
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) {
    const base = y * w;
    for (let x = 0; x < w; x++) {
      if (data[(base + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, maxX, minY, maxY };
}

// 把一帧画到精灵表的指定格子里：先在 2×2 格大小的「探针画布」上试画一次，
// 量出真实包围盒（包括已经越界到邻格的部分）。姿势出框（倒地、长武器突刺）就把整帧
// 缩小 / 平移回格子内，保证立绘不会被格子边界裁掉。
// 缩放与平移都以「脚底基准点」为锚，本来就正常的帧（待机等）保持 s=1、偏移 0。
const FIT_PAD = 2;
const PROBE_SIZE = FRAME_W * 2;   // 探针画布边长
const PROBE_OFF = 48;             // 探针画布上「格子左上角」的位置，四周各留 48px 余量

function paintFrame(targetCtx, cellX, cellY, probe, paint) {
  const anchorX = FRAME_W / 2;
  const anchorY = FEET_Y;
  const render = (c, ox, oy, s) => {
    c.save();
    c.translate(ox, oy);
    c.translate(anchorX, anchorY);
    c.scale(s, s);
    paint(c);
    c.restore();
  };

  probe.ctx.clearRect(0, 0, PROBE_SIZE, PROBE_SIZE);
  render(probe.ctx, PROBE_OFF, PROBE_OFF, 1);
  const b = alphaBounds(probe.ctx, PROBE_SIZE, PROBE_SIZE);
  let s = 1, ox = 0, oy = 0;
  if (b) {
    const minX = b.minX - PROBE_OFF;
    const maxX = b.maxX - PROBE_OFF;
    const minY = b.minY - PROBE_OFF;
    const maxY = b.maxY - PROBE_OFF;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const availW = FRAME_W - FIT_PAD * 2;
    const availH = FRAME_H - FIT_PAD * 2;
    if (bw > availW || bh > availH) s = Math.min(1, availW / bw, availH / bh);
    // 缩放后重新算位置（仍以脚底为锚点），再把越界的那一侧挪回格子内
    const x0 = anchorX + (minX - anchorX) * s;
    const x1 = anchorX + (maxX - anchorX) * s;
    const y0 = anchorY + (minY - anchorY) * s;
    const y1 = anchorY + (maxY - anchorY) * s;
    if (x0 < FIT_PAD) ox = FIT_PAD - x0;
    else if (x1 > FRAME_W - FIT_PAD) ox = FRAME_W - FIT_PAD - x1;
    if (y0 < FIT_PAD) oy = FIT_PAD - y0;
    else if (y1 > FRAME_H - FIT_PAD) oy = FRAME_H - FIT_PAD - y1;
  }
  // #dev-only:start
  if (typeof process !== 'undefined' && process.env && process.env.FIT_DEBUG) {
    console.log(`fit cell=(${cellX},${cellY}) bbox=${b ? `${b.minX},${b.minY}-${b.maxX},${b.maxY}` : 'none'} s=${s.toFixed(2)} ox=${ox} oy=${oy}`);
  }
  // #dev-only:end
  render(targetCtx, cellX + ox, cellY + oy, s);
}

/* ---------------- 生成 / 取用精灵表 ---------------- */

function buildSheet(troopId, tierIndex) {
  const key = `${troopId}:${tierIndex}`;
  if (cache.has(key)) return cache.get(key);
  const troop = troopResolver ? troopResolver(troopId) : null;
  if (!troop) return null;
  // paletteFor 内部按 SPRITE_TIER_LEVELS[tierIndex] 映射回代表等级，
  // 所以 4 档外观与原本对应等级（Lv1/Lv3/Lv6/Lv9）一致。
  const p = paletteFor(troop, tierIndex);
  // 特殊兵种走专用模型（12 个兵种各自独立剪影），不再借用基础兵线的 style 分支
  const draw = SPECIAL_DRAW[troop.id] || TROOP_DRAW[troop.baseTroop || troop.id];
  if (!draw) return null;
  const scale = troop.scale && troop.scale > 0 ? troop.scale : 1;
  const shape = SPECIAL_DRAW[troop.id] ? { sx: 1, sy: 1 } : (BODY_SHAPE[troop.id] || { sx: 1, sy: 1 });
  const { canvas, ctx } = makeCanvas(FRAME_W * COLS, FRAME_H * ACTIONS.length);
  const probe = makeCanvas(PROBE_SIZE, PROBE_SIZE);

  ACTIONS.forEach((action, row) => {
    const frames = Math.max(1, troop.anim[action] || 2);
    for (let f = 0; f < frames; f++) {
      const t = frames > 1 ? f / (frames - 1) : 0;
      const paint = (c) => {
        drawShadow(c, action === 'death' ? 0.16 : 0.3);
        // 基础体型 + 特殊兵种自带 scale，都以脚底为锚，不影响站位
        c.save();
        c.scale(scale * shape.sx, scale * shape.sy);
        draw(c, p, action, t);
        c.restore();
      };
      paintFrame(ctx, f * FRAME_W, row * FRAME_H, probe, paint);
    }
  });
  cache.set(key, canvas);
  return canvas;
}

export function sheetFor(troopId, tierIndex) {
  // 调用方应传 spriteTierFor(level)（4 档精灵档位 0..3）。
  // 并行改造期间若仍有旧的 0..9 档位索引传入，按「档位 + 1 = 等级」反推
  // spriteTierFor，避免 Lv4~Lv10 一律落成 Lv9 档的视觉错位；合法 0..3 原样透传。
  const n = Number(tierIndex);
  const raw = Number.isFinite(n) ? Math.floor(n) : 0;
  const t = raw > SPRITE_TIER_LEVELS.length - 1
    ? spriteTierFor(raw + 1)
    : Math.max(0, raw);
  const real = loadCustomSheet(troopId, t);
  if (real) return real;
  return buildSheet(troopId, t);
}

export function frameRect(action, frameIndex) {
  const row = Math.max(0, ACTIONS.indexOf(action));
  return { sx: frameIndex * FRAME_W, sy: row * FRAME_H, sw: FRAME_W, sh: FRAME_H };
}

// 把某一帧画到 (x, y)（y = 脚底位置），flip 让敌方朝左
export function drawFrame(ctx, sheet, action, frameIndex, x, y, scale, flip = false, alpha = 1) {
  if (!sheet || frameIndex < 0) return;
  const { sx, sy, sw, sh } = frameRect(action, frameIndex);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(flip ? -scale : scale, scale);
  ctx.drawImage(sheet, sx, sy, sw, sh, -FRAME_W / 2, -FEET_Y, FRAME_W, FRAME_H);
  ctx.restore();
}

// 根据动作已播放时长（秒）与总时长求当前帧
export function currentFrame(action, frames, elapsed, total, { loop = false, holdEnd = false } = {}) {
  const n = Math.max(1, frames);
  if (loop) {
    const per = total / n;
    return n > 0 ? Math.floor(elapsed / per) % n : 0;
  }
  if (total <= 0) return n - 1;
  const per = total / n;
  const idx = Math.floor(elapsed / per);
  if (idx >= n) return holdEnd ? n - 1 : -1;
  return idx;
}

export function frameCount(troop, action) {
  return Math.max(1, troop.anim[action] || 2);
}
