import { inkShade, inkOutline, isInkFill, mute } from './ink.js';
import { ART as ART_PATHS, drawArt } from './packageArt.js';
import { CONFIG } from '../data/config.js';

// 英雄专属建模：12 名英雄各自一套剪影 / 配色 / 头饰 / 武器。
// 精细 Q 版：大头圆脸 + 完整五官 + 发冠纹样 + 札甲片 + 交领衣褶 + 有体积的手脚与武器。
// 坐标系：脚底为 (0,0)，向上为负 y，标准身高 100；渲染时按目标高度缩放。
// 同时提供品级光环：史诗黛紫、传奇暗金，战场 / 英雄页共用。

const ART = {
  guanping: {
    robe: '#3f8f68', dark: '#2a6448', armor: '#5d7078', trim: '#e0c98a', skin: '#d8ab82',
    head: 'plume', plume: '#8c3b32', weapon: 'spear', build: 1.0, cape: false, beard: 0,
    horse: false, shield: false,
  },
  zhangren: {
    robe: '#66809c', dark: '#44586e', armor: '#83878a', trim: '#c9c5b8', skin: '#d3a67f',
    head: 'pointed', plume: '#3f6fa0', weapon: 'lance', build: 1.02, cape: false, beard: 0,
    horse: true, shield: false,
  },
  huanggai: {
    robe: '#99503f', dark: '#6d3528', armor: '#8a7356', trim: '#d9c08a', skin: '#c99a74',
    head: 'old', beard: 2, weapon: 'bow', build: 1.02, cape: false, horse: false, shield: false,
  },
  liru: {
    robe: '#5b3a68', dark: '#3f2649', armor: '#4a4258', trim: '#a98fc0', skin: '#cfae8f',
    head: 'scholar', beard: 1, weapon: 'dagger', build: 0.98, cape: true, horse: true, shield: false,
  },
  zhangjiao: {
    robe: '#c8a33c', dark: '#9a7a22', armor: '#b28a2c', trim: '#f0d878', skin: '#d2a87f',
    head: 'turban', beard: 2, weapon: 'staff', build: 1.0, cape: true, horse: false, shield: false,
  },
  xiahouyuan: {
    robe: '#3b3f47', dark: '#262930', armor: '#989b9c', trim: '#d8d4c8', skin: '#d5aa84',
    head: 'horned', plume: '#b5b2a8', weapon: 'lance', build: 1.0, cape: true, beard: 0,
    horse: true, shield: false,
  },
  zhangfei: {
    robe: '#33363c', dark: '#1f2126', armor: '#4c525c', trim: '#8c8f91', skin: '#b98563',
    head: 'fierce', beard: 3, weapon: 'snake', build: 1.24, cape: true, horse: false, shield: false,
  },
  guanyu: {
    robe: '#2f7a4a', dark: '#1e5533', armor: '#3f7c55', trim: '#e6c46a', skin: '#c98b6a',
    head: 'longbeard', beard: 3, weapon: 'guandao', build: 1.16, cape: true, horse: true, shield: false,
  },
  liubei: {
    robe: '#b99a5f', dark: '#8a7040', armor: '#b7a06c', trim: '#f0dca8', skin: '#d8ad86',
    head: 'band', beard: 1, weapon: 'twin', build: 1.04, cape: true, horse: false, shield: false,
  },
  caocao: {
    robe: '#3d4f6e', dark: '#26344d', armor: '#5a6c8c', trim: '#d4b45c', skin: '#d5a980',
    head: 'crown', beard: 1, weapon: 'sword', build: 1.08, cape: true, horse: false, shield: false,
  },
  zhouyu: {
    robe: '#b95a4a', dark: '#83362b', armor: '#c8a56a', trim: '#f0d28a', skin: '#dcb088',
    head: 'elegant', beard: 0, weapon: 'bow', build: 0.98, cape: true, horse: false, shield: false,
  },
  dongzhuo: {
    robe: '#7a2f2f', dark: '#511c1c', armor: '#4a3a38', trim: '#c9a05a', skin: '#c99570',
    head: 'big', beard: 2, weapon: 'blade', build: 1.34, cape: true, horse: false, shield: true,
  },
};

// 「汉帛·朱金」v2 品级色（S2.1）：史诗=实测紫，传奇=实测金；与 CONFIG.rarity 同源
export const HERO_AURA = { epic: '#96659a', legendary: '#d59947' };

// 建模配置（测试 / 界面可读）：骑兵标识 horse、长兵器 weapon 等
export function heroArtFor(heroId) {
  return ART[heroId] || null;
}

export function heroAuraColor(hero) {
  return hero && hero.tier === 'legendary' ? HERO_AURA.legendary : HERO_AURA.epic;
}

// UI 卡片上的英雄名：主色太暗（如张飞 #3c3f46）时换成浅色，保证深色卡片上可读
export function heroNameColor(hero) {
  const hex = hero && hero.color ? hero.color : '#e0dcd0';
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r * 0.3 + g * 0.59 + b * 0.11 < 80 ? '#d8d4c8' : hex;
}

/* ---------------- 基础绘制原语 ---------------- */

function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (isInkFill(fill)) {
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    inkShade(ctx, x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0);
    inkOutline(ctx, false, 1);
  }
}

function line(ctx, x1, y1, x2, y2, color, w) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function ell(ctx, x, y, rx, ry, fill, stroke, lw = 1.1) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.2, rx), Math.max(0.2, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  // 小点（高光 / 铆钉 / 瞳孔）不叠明暗与墨线，否则 1px 墨线会把亮点整个吞掉
  if (isInkFill(fill) && rx * 2 >= 5 && ry * 2 >= 5) {
    inkShade(ctx, x - rx, y - ry, rx * 2, ry * 2);
    inkOutline(ctx, !!stroke, lw);
  }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function rr(ctx, x, y, w, h, r, fill, stroke, lw = 1.1) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  // 窄条（腿 / 甲片 / 护腕）不叠明暗，避免被压成黑棍
  if (isInkFill(fill) && Math.abs(w) >= 9 && Math.abs(h) >= 9) {
    inkShade(ctx, x, y, w, h);
    inkOutline(ctx, !!stroke, lw);
  }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/* ---------------- 坐骑 ---------------- */

function horse(ctx, c, t, attack) {
  const bob = Math.sin(t * 4) * 1.2;
  const y = -26 + bob;
  const hide = c.horseHide;
  const horseShade = c.horseShade;
  const gallop = attack ? Math.sin(t * 11) * 5 : 0;
  // 四条腿改成带关节的锥形肢体，不再是四根"桌腿"
  drawLimb(ctx, { x: -18, y: -20 }, { x: -22, y: -8 + gallop * 0.35 }, 4.6, 3.0, horseShade, c.ink);
  drawLimb(ctx, { x: -22, y: -8 + gallop * 0.35 }, { x: -19, y: 0 }, 3.0, 2.2, horseShade, c.ink);
  drawLimb(ctx, { x: -8, y: -21 }, { x: -7, y: -9 - gallop * 0.3 }, 4.6, 3.0, horseShade, c.ink);
  drawLimb(ctx, { x: -7, y: -9 - gallop * 0.3 }, { x: -5, y: 0 }, 3.0, 2.2, horseShade, c.ink);
  drawLimb(ctx, { x: 12, y: -20 }, { x: 14, y: -8 + gallop }, 4.8, 3.1, horseShade, c.ink);
  drawLimb(ctx, { x: 14, y: -8 + gallop }, { x: 17, y: 0 }, 3.1, 2.2, horseShade, c.ink);
  drawLimb(ctx, { x: 21, y: -19 }, { x: 26, y: -9 - gallop }, 4.8, 3.1, horseShade, c.ink);
  drawLimb(ctx, { x: 26, y: -9 - gallop }, { x: 24, y: 0 }, 3.1, 2.2, horseShade, c.ink);
  // 躯干：左上受光、右下背光的渐变体积
  gradPoly(ctx, [[-24, -34], [2, -40], [30, -34], [28, -16], [-22, -16]],
    shade(hide, 0.20), shade(hide, -0.28), c.ink);
  poly(ctx, [[-21, -36], [1, -39], [26, -35], [18, -31], [-19, -29]], c.horseLit);
  // 颈 / 头：向右侧探出，避开骑手躯干
  gradPoly(ctx, [[24, -34], [39, -52], [48, -49], [35, -28]],
    shade(hide, 0.16), shade(hide, -0.26), c.ink);
  gradPoly(ctx, [[42, -55], [56, -50], [55, -42], [40, -44]],
    shade(hide, 0.18), shade(hide, -0.30), c.ink);
  poly(ctx, [[54, -43], [58, -40], [50, -39]], horseShade);
  ell(ctx, 50, -48, 1.4, 1.3, c.ink);
  // 鬃毛与尾巴
  line(ctx, 30, -46, 18, -30, horseShade, 2.6);
  line(ctx, 33, -49, 22, -33, c.trim, 1.1);
  line(ctx, 37, -52, 27, -36, horseShade, 1.4);
  line(ctx, -24, -32, -34, -12, horseShade, 3.0);
  line(ctx, -25, -31, -33, -16, hide, 1.3);
  // 鞍 / 辔 / 镫
  poly(ctx, [[-13, -39], [10, -40], [12, -32], [-14, -31]], c.dark);
  line(ctx, -12, -38, 10, -39, c.trim, 1.2);
  line(ctx, 43, -49, 53, -45, c.dark, 1.5);
  line(ctx, 4, -32, 6, -22, c.trim, 1.1);
  return y;
}

/* ---------------- 头：Q 版圆脸 + 五官 + 冠 ---------------- */

function head(ctx, c, hero, kind) {
  const s = c.skin;
  const ink = c.ink;
  // 颈 + 后发（压在脸后）
  rr(ctx, -3.4, -71, 9, 9, 3, s, ink, 1);
  ell(ctx, 2, -80.5, 14.4, 15.2, c.dark, ink, 1.2);
  // 脸
  ell(ctx, 2.4, -79.5, 12.4, 13.2, s, ink, 1.2);
  ell(ctx, 8.6, -77.5, 4.0, 9.2, 'rgba(88,56,34,0.15)');
  ell(ctx, -3.6, -85, 5.0, 5.8, 'rgba(255,246,226,0.09)');
  ell(ctx, -10.2, -78.4, 2.5, 3.4, s, ink, 0.9);
  // 面部不画眼球：留白国风面庞，只靠眉骨暗面与鼻嘴交代体积
  ell(ctx, 2.4, -82.0, 9.0, 2.0, 'rgba(88,56,34,0.08)');
  // 眉：猛将上挑，儒将细平；无眼时降低对比，避免显得怒目
  const brow = 'rgba(43,33,23,0.55)';
  const fierce = kind === 'fierce' || kind === 'big' || kind === 'horned' || kind === 'longbeard';
  const mw = fierce ? 1.7 : 1.1;
  if (fierce) {
    line(ctx, -6.2, -86.4, -0.6, -88.4, brow, mw);
    line(ctx, 5.6, -88.4, 11.2, -86.2, brow, mw);
  } else {
    line(ctx, -5.6, -86.3, -0.8, -86.7, brow, mw);
    line(ctx, 5.6, -86.7, 10.6, -86.3, brow, mw);
  }
  // 鼻 / 嘴 / 腮
  line(ctx, 3.0, -77.8, 4.0, -75.8, 'rgba(90,58,36,0.5)', 1);
  line(ctx, 1.4, -72.8, 5.2, -72.6, 'rgba(110,50,40,0.65)', 1.1);
  ell(ctx, -6.0, -74.0, 2.3, 1.3, 'rgba(168,80,62,0.14)');
  ell(ctx, 10.4, -74.0, 2.3, 1.3, 'rgba(168,80,62,0.14)');

  // 冠 / 巾 / 发式：每种都有底冠 + 纹样 + 缨或鬓发
  switch (kind) {
    case 'plume':
      poly(ctx, [[-11, -90], [15, -92], [16, -97.5], [-12, -95.5]], c.armor);
      line(ctx, -9, -93.4, 13, -95, c.trim, 1.1);
      poly(ctx, [[0, -96], [5, -113], [-2.5, -108.5]], c.plume);
      ell(ctx, 2, -95, 1.5, 1.5, c.trim, ink, 0.7);
      break;
    case 'pointed':
      poly(ctx, [[-10, -90], [16, -92], [8, -116]], c.armor);
      poly(ctx, [[4, -104], [8, -116], [12, -104]], c.armorShade);
      line(ctx, 8, -113, 10, -124, c.trim, 2);
      line(ctx, -8, -94, 14, -95, c.trim, 1);
      break;
    case 'old':
      poly(ctx, [[-11, -91], [18, -93], [16, -101], [-11, -99]], c.armor);
      line(ctx, -9, -96, 16, -97.5, c.trim, 1.1);
      poly(ctx, [[-1, -83], [10, -83], [9, -71], [2, -68]], '#d5cbb7');
      line(ctx, -8, -86.5, -1, -87.4, '#d5cbb7', 1.4);
      break;
    case 'scholar':
      poly(ctx, [[-8, -96], [16, -98], [15, -105], [-6, -103]], c.dark);
      poly(ctx, [[-11, -97], [19, -99], [19, -103], [-11, -101]], c.trim);
      line(ctx, -8, -100, 16, -101.5, c.ink, 0.8);
      ell(ctx, 4, -106, 2, 2, c.trim, ink, 0.7);
      break;
    case 'turban':
      poly(ctx, [[-11, -91], [19, -94], [20, -105], [-10, -102]], '#b0935f');
      line(ctx, -9, -95, 18, -97, '#8d7444', 1.2);
      line(ctx, -8, -99, 18, -101, '#8d7444', 1.2);
      line(ctx, 20, -99, 30, -92, '#b0935f', 3);
      poly(ctx, [[26, -94], [32, -90], [27, -88]], '#8d7444');
      break;
    case 'horned':
      poly(ctx, [[-10, -90], [17, -92], [16, -103], [-9, -101]], c.armor);
      line(ctx, -8, -100, -17, -110, c.trim, 3.2);
      line(ctx, 16, -100, 25, -110, c.trim, 3.2);
      line(ctx, 4, -102, 4, -113, c.plume, 2.4);
      line(ctx, -8, -95, 15, -96.5, c.trim, 1);
      break;
    case 'fierce':
      poly(ctx, [[-12, -89], [19, -92], [17, -103], [-10, -100]], c.armor);
      line(ctx, -10, -96, 17, -98, c.trim, 1.2);
      line(ctx, 4, -101, 2, -119, c.dark, 2.6);
      line(ctx, -4, -99, -11, -113, c.dark, 2.6);
      line(ctx, 10, -100, 18, -113, c.dark, 2.6);
      ell(ctx, 3, -96, 1.6, 1.6, c.trim, ink, 0.7);
      break;
    case 'longbeard':
      poly(ctx, [[-10, -90], [18, -92], [16, -103], [-9, -100]], c.armor);
      poly(ctx, [[-8, -100], [16, -102], [14, -106], [-6, -104]], c.dark);
      line(ctx, -9, -95, 16, -97, c.trim, 1.1);
      ell(ctx, 4, -103, 1.6, 1.6, c.trim, ink, 0.7);
      break;
    case 'band':
      poly(ctx, [[-10, -90], [18, -92], [17, -100], [-9, -98]], c.trim);
      line(ctx, -8, -94, 16, -96, c.dark, 1);
      line(ctx, 17, -98, 27, -104, c.trim, 2.6);
      poly(ctx, [[24, -102], [29, -106], [26, -98]], c.trim);
      break;
    case 'crown':
      poly(ctx, [[-10, -91], [18, -93], [17, -101], [-9, -99]], c.armor);
      poly(ctx, [[-8, -101], [18, -102], [18, -111], [12, -107], [6, -113], [1, -107], [-7, -109]], c.trim);
      line(ctx, -8, -96, 16, -97.5, c.trim, 1.1);
      ell(ctx, 5, -105, 1.4, 1.4, '#8c3b32', ink, 0.7);
      break;
    case 'elegant':
      poly(ctx, [[-10, -90], [18, -92], [17, -101], [-9, -99]], c.dark);
      poly(ctx, [[-9, -99], [17, -100], [15, -103], [-8, -102]], c.trim);
      line(ctx, 17, -100, 28, -95, c.trim, 2);
      ell(ctx, 4, -101, 1.4, 1.4, c.trim, ink, 0.7);
      break;
    case 'big':
      poly(ctx, [[-13, -89], [20, -92], [19, -103], [-12, -100]], c.armor);
      line(ctx, -11, -95, 18, -97, c.trim, 1.3);
      poly(ctx, [[-6, -102], [3, -110], [11, -103]], c.trim);
      ell(ctx, 3, -100, 1.8, 1.8, c.trim, ink, 0.7);
      break;
    default:
      break;
  }

  // 鬓发（统一压在脸侧，让头不飘）
  poly(ctx, [[-11, -88], [-8, -86], [-9, -74], [-13, -78]], c.dark);
  poly(ctx, [[14, -88], [17, -86], [15, -74], [12, -78]], c.dark);

  // 胡须：短须 / 花白长须 / 络腮长髯
  if (c.beard === 1) {
    poly(ctx, [[0, -73.5], [9, -73.5], [7, -68], [3, -67]], c.ink);
    line(ctx, 0.4, -73, -2.6, -71.6, c.ink, 1.2);
    line(ctx, 8.4, -73, 11.2, -71.6, c.ink, 1.2);
  } else if (c.beard === 2) {
    poly(ctx, [[-1, -74], [11, -74], [10, -62], [4, -57], [-2, -66]], '#cfc6b4');
    line(ctx, 1, -71, 8, -71, '#a89e8c', 1);
    line(ctx, 4, -66, 8, -64, '#a89e8c', 1);
  } else if (c.beard === 3) {
    poly(ctx, [[-3, -76], [12, -76], [12, -66], [5, -58], [-3, -64]], c.ink);
    poly(ctx, [[-4, -77], [0, -75], [-2, -68], [-6, -70]], c.ink);
    poly(ctx, [[11, -77], [15, -75], [13, -68], [10, -70]], c.ink);
    line(ctx, 2, -69, 8, -68, 'rgba(220,210,190,0.16)', 1);
  }
}

/* ---------------- 武器：明暗双线 + 缠绳 + 护手 + 刃纹 ---------------- */

function weapon(ctx, c, kind, swing, twoHand) {
  const hx = 14, hy = -58;
  const sw = swing * 6;
  const shaft = c.wood;
  const metal = c.metal;
  const metalDark = c.metalDark;
  const lit = 'rgba(255,240,210,0.20)';
  switch (kind) {
    case 'spear':
      line(ctx, hx - 18, hy + 6, hx + 38, hy - 26 + sw, shaft, 2.8);
      line(ctx, hx - 18, hy + 5, hx + 38, hy - 27 + sw, lit, 0.9);
      poly(ctx, [[hx + 36, hy - 27 + sw], [hx + 52, hy - 33 + sw], [hx + 38, hy - 20 + sw]], metal);
      poly(ctx, [[hx + 38, hy - 25 + sw], [hx + 52, hy - 33 + sw], [hx + 42, hy - 22 + sw]], metalDark);
      line(ctx, hx + 38, hy - 25 + sw, hx + 48, hy - 29 + sw, c.trim, 0.9);
      poly(ctx, [[hx + 30, hy - 24 + sw], [hx + 40, hy - 27 + sw], [hx + 33, hy - 18 + sw]], '#8c3b32');
      rr(ctx, hx - 20, hy + 4, 3, 5, 1, metalDark);
      break;
    case 'lance':
      line(ctx, hx - 20, hy + 8, hx + 42, hy - 30 + swing * 5, '#4a3a2a', 3);
      line(ctx, hx - 20, hy + 7, hx + 42, hy - 31 + swing * 5, lit, 0.9);
      poly(ctx, [[hx + 40, hy - 31 + swing * 5], [hx + 58, hy - 36 + swing * 5], [hx + 44, hy - 24 + swing * 5]], metal);
      poly(ctx, [[hx + 44, hy - 28 + swing * 5], [hx + 58, hy - 36 + swing * 5], [hx + 47, hy - 25 + swing * 5]], metalDark);
      line(ctx, hx + 38, hy - 24, hx + 46, hy - 21, c.trim, 2);
      for (let i = 0; i < 3; i++) line(ctx, hx + 30 + i * 2.6, hy - 19 + i * 2.4, hx + 33 + i * 2.6, hy - 16 + i * 2.4, c.trim, 0.9);
      break;
    case 'snake':
      line(ctx, hx - 20, hy + 8, hx + 34, hy - 18 + sw, '#3a3a3a', 3.2);
      line(ctx, hx - 20, hy + 7, hx + 34, hy - 19 + sw, lit, 0.9);
      ctx.beginPath();
      ctx.moveTo(hx + 32, hy - 18 + sw);
      ctx.quadraticCurveTo(hx + 44, hy - 30 + sw, hx + 52, hy - 20 + sw);
      ctx.quadraticCurveTo(hx + 58, hy - 34 + sw, hx + 64, hy - 24 + sw);
      ctx.strokeStyle = metal;
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.strokeStyle = metalDark;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      break;
    case 'guandao':
      line(ctx, hx - 24, hy + 10, hx + 36, hy - 24 + sw, '#3f2c1c', 3.4);
      line(ctx, hx - 24, hy + 9, hx + 36, hy - 25 + sw, lit, 0.9);
      for (let i = 0; i < 3; i++) line(ctx, hx + 24 + i * 2.6, hy - 18 + sw + i * 2, hx + 27 + i * 2.6, hy - 15 + sw + i * 2, c.trim, 1);
      poly(ctx, [[hx + 32, hy - 22 + sw], [hx + 58, hy - 40 + sw], [hx + 66, hy - 16 + sw], [hx + 38, hy - 12 + sw]], metal);
      poly(ctx, [[hx + 46, hy - 23 + sw], [hx + 66, hy - 16 + sw], [hx + 38, hy - 12 + sw]], metalDark);
      line(ctx, hx + 36, hy - 18 + sw, hx + 58, hy - 30 + sw, c.trim, 1.6);
      rr(ctx, hx + 31, hy - 25 + sw, 3.5, 8, 1, c.trim);
      poly(ctx, [[hx - 26, hy + 8], [hx - 22, hy + 13], [hx - 20, hy + 7]], metalDark);
      break;
    case 'bow':
      ctx.beginPath();
      ctx.arc(hx + 26, hy - 6, 22, -Math.PI * 0.62, Math.PI * 0.62);
      ctx.strokeStyle = '#7a4a26';
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx + 26, hy - 6, 20.5, -Math.PI * 0.62, Math.PI * 0.62);
      ctx.strokeStyle = lit;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      line(ctx, hx + 12, hy - 24, hx + 12, hy + 12, c.eyeWhite, 1.4);
      rr(ctx, hx + 10, hy - 8, 4, 9, 1.5, c.dark);
      if (swing > 0.2) {
        line(ctx, hx + 12, hy - 10, hx + 52, hy - 10, '#c4b790', 1.6);
        poly(ctx, [[hx + 48, hy - 12], [hx + 55, hy - 10], [hx + 48, hy - 8]], metal);
      }
      break;
    case 'dagger':
      line(ctx, hx - 6, hy + 8, hx + 24, hy - 6, metalDark, 2.8);
      poly(ctx, [[hx + 22, hy - 8], [hx + 32, hy - 12], [hx + 26, hy - 3]], metal);
      poly(ctx, [[hx + 24, hy - 7], [hx + 32, hy - 12], [hx + 27, hy - 5]], c.eyeWhite);
      rr(ctx, hx + 18, hy - 9, 3, 8, 1, c.trim);
      break;
    case 'staff':
      line(ctx, hx - 10, hy + 24, hx + 22, hy - 46, '#6a4a2a', 3.2);
      line(ctx, hx - 10, hy + 23, hx + 22, hy - 47, lit, 0.9);
      for (let i = 0; i < 4; i++) line(ctx, hx - 4 + i * 3.2, hy + 12 - i * 4, hx - 2 + i * 3.2, hy + 9 - i * 4, c.trim, 0.9);
      ell(ctx, hx + 25, hy - 52, 7, 7, '#b99a42', '#7a6328', 1.6);
      ell(ctx, hx + 23, hy - 54, 2.2, 2.2, 'rgba(255,246,214,0.55)');
      break;
    case 'twin':
      line(ctx, hx - 6, hy + 6, hx + 20, hy - 8 + swing * 8, metal, 2.6);
      line(ctx, hx + 2, hy + 6, hx + 34, hy - 2 - swing * 8, metal, 2.6);
      line(ctx, hx - 4, hy + 5, hx + 18, hy - 9 + swing * 8, c.eyeWhite, 0.8);
      rr(ctx, hx - 8, hy + 3, 3.5, 8, 1, c.dark);
      break;
    case 'sword':
      line(ctx, hx - 4, hy + 6, hx + 32, hy - 24 + swing * 8, metal, 3);
      line(ctx, hx - 3, hy + 5, hx + 33, hy - 25 + swing * 8, c.eyeWhite, 0.9);
      line(ctx, hx + 10, hy - 6, hx + 18, hy - 12, c.trim, 2.4);
      rr(ctx, hx - 6, hy + 3, 4, 8, 1.2, c.dark);
      ell(ctx, hx - 4, hy + 11, 1.8, 1.8, c.trim, c.ink, 0.7);
      break;
    case 'blade':
      line(ctx, hx - 14, hy + 16, hx + 30, hy - 18 + sw, '#4a3020', 3.4);
      line(ctx, hx - 14, hy + 15, hx + 30, hy - 19 + sw, lit, 0.9);
      poly(ctx, [[hx + 26, hy - 20 + sw], [hx + 52, hy - 34 + sw], [hx + 44, hy + 4 + sw]], metal);
      poly(ctx, [[hx + 40, hy - 16 + sw], [hx + 52, hy - 34 + sw], [hx + 44, hy + 4 + sw]], metalDark);
      line(ctx, hx + 30, hy - 18 + sw, hx + 48, hy - 28 + sw, c.trim, 1.2);
      rr(ctx, hx + 22, hy - 20 + sw, 4, 9, 1, c.trim);
      break;
    default:
      break;
  }
  // 双手已在主体里画好，这里只补握柄处的一点亮边，不再叠第三个"拳头"
  if (twoHand) line(ctx, hx - 2, hy + 3, hx + 4, hy + 1, 'rgba(226,196,152,0.18)', 1);
}

/* ---------------- 战场 2.5D 可动骨架 ---------------- */
// UI 卡片继续用 AI 立绘（静态观赏）；战场传 animated:true 走这套骨架。
// 骨架以脚底为原点、身高 100：肩关节 → 肘关节 → 手 → 武器分段驱动，
// 攻击 / 受击 / 技能都是分阶段小动画，不是整张贴图抖一下。
const HERO_ACTION_TIME = {
  attack: CONFIG.battle.attackAnimTime,
  hit: CONFIG.battle.hitAnimTime,
  skill: CONFIG.battle.skillAnimTime || 0.85,
  death: 1.2,
};

export function heroActionTime(action) {
  return HERO_ACTION_TIME[action] || 0.72;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);
const easeInOut = (v) => {
  const p = clamp01(v);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
};
const lerp = (a, b, k) => a + (b - a) * k;

function mixHex(a, b, t) {
  const ma = /^#?([0-9a-f]{6})$/i.exec(String(a || ''));
  const mb = /^#?([0-9a-f]{6})$/i.exec(String(b || ''));
  if (!ma || !mb) return a;
  const x = parseInt(ma[1], 16);
  const y = parseInt(mb[1], 16);
  const q = clamp01(t);
  const r = Math.round(lerp((x >> 16) & 255, (y >> 16) & 255, q));
  const g = Math.round(lerp((x >> 8) & 255, (y >> 8) & 255, q));
  const bl = Math.round(lerp(x & 255, y & 255, q));
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}
function shade(hex, amount) {
  return mixHex(hex, amount >= 0 ? '#ffffff' : '#000000', Math.abs(amount));
}

// 带左上光源的渐变面：比纯色多边形更有体积，仍是同一套国风墨线语言。
function gradPoly(ctx, pts, c1, c2, stroke) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const g = ctx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  inkOutline(ctx, !!stroke, 1);
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function limbPts(sx, sy, upperA, foreA, upperLen = 12, foreLen = 10) {
  const elbow = { x: sx + Math.cos(upperA) * upperLen, y: sy + Math.sin(upperA) * upperLen };
  return {
    elbow,
    hand: { x: elbow.x + Math.cos(foreA) * foreLen, y: elbow.y + Math.sin(foreA) * foreLen },
  };
}

function drawLimb(ctx, a, b, r1, r2, fill, stroke) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  gradPoly(ctx, [
    [a.x + nx * r1, a.y + ny * r1],
    [b.x + nx * r2, b.y + ny * r2],
    [b.x - nx * r2, b.y - ny * r2],
    [a.x - nx * r1, a.y - ny * r1],
  ], shade(fill, 0.18), shade(fill, -0.30), stroke);
}

const POSE_IDLE = Object.freeze({
  upperR: 1.18, foreR: 1.48, upperL: 1.96, foreL: 2.28,
  weapon: -0.12, lean: 0, twist: 0, head: 0,
  charge: 0, release: 0, shake: 0,
});

function lerpPose(a, b, k) {
  const out = {};
  for (const key in a) out[key] = lerp(a[key], b[key], k);
  return out;
}

function poseFor(action, p) {
  if (action === 'walk') {
    const q = { ...POSE_IDLE };
    const s = Math.sin(p * Math.PI * 2);
    q.upperR += s * 0.18;
    q.upperL -= s * 0.18;
    q.lean = s * 0.03;
    return q;
  }
  if (action === 'attack') {
    // 起手蓄力 → 挥砍命中 → 收势，武器与手臂全程跟着关节走
    const wind = { ...POSE_IDLE, upperR: -1.17, foreR: 0.73, weapon: -0.87, lean: -0.10, twist: -0.18, head: -0.05 };
    const hit = { ...POSE_IDLE, upperR: 0.93, foreR: 0.98, weapon: 0.83, lean: 0.12, twist: 0.18, head: 0.07, release: 1 };
    if (p < 0.30) return lerpPose(POSE_IDLE, wind, easeOut(p / 0.30));
    if (p < 0.58) return lerpPose(wind, hit, easeOut((p - 0.30) / 0.28));
    return lerpPose(hit, POSE_IDLE, easeInOut((p - 0.58) / 0.42));
  }
  if (action === 'hit') {
    // 受击：身体后仰 + 握武器的手脱力下垂 + 阻尼抖动，而不是只抖一下
    const back = { ...POSE_IDLE, upperR: 2.05, foreR: 1.85, weapon: 0.78, lean: 0.18, twist: 0.12, head: 0.20, shake: 1 };
    if (p < 0.18) return lerpPose(POSE_IDLE, back, easeOut(p / 0.18));
    if (p < 0.55) {
      const k = 1 - (p - 0.18) / 0.37;
      const q = lerpPose(POSE_IDLE, back, 0.38 * k);
      q.shake = 0.6 * k * Math.sin((p - 0.18) * 52);
      return q;
    }
    return lerpPose(back, POSE_IDLE, easeInOut((p - 0.55) / 0.45));
  }
  if (action === 'skill') {
    // 技能：举武器过顶聚气 → 前刺/横扫释放 → 收势
    const charge = { ...POSE_IDLE, upperR: -1.45, foreR: 0.52, weapon: -1.28, lean: -0.15, twist: -0.26, head: -0.10, charge: 1 };
    const release = { ...POSE_IDLE, upperR: 1.48, foreR: 1.08, weapon: 0.98, lean: 0.20, twist: 0.26, head: 0.12, release: 1 };
    if (p < 0.42) return lerpPose(POSE_IDLE, charge, easeOut(p / 0.42));
    if (p < 0.68) return lerpPose(charge, release, easeOut((p - 0.42) / 0.26));
    return lerpPose(release, POSE_IDLE, easeInOut((p - 0.68) / 0.32));
  }
  return { ...POSE_IDLE };
}

// 武器以握把为原点、指向 +x；调用方把手部坐标与旋转角传进来。
function drawWeaponRig(ctx, c, kind, hand, rot, glow = 0) {
  const metal = c.metal;
  const md = c.metalDark;
  const trim = c.trim;
  const wood = c.wood;
  const lit = 'rgba(255,244,220,0.24)';
  const edge = glow > 0 ? mixHex('#fff7df', trim, 0.32) : metal;
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(rot);
  switch (kind) {
    case 'spear':
      line(ctx, -18, 4, 50, -14, wood, 3);
      line(ctx, -18, 3, 50, -15, lit, 0.9);
      poly(ctx, [[48, -16], [66, -22], [52, -8]], edge);
      poly(ctx, [[52, -14], [66, -22], [55, -9]], md);
      poly(ctx, [[39, -12], [49, -16], [43, -5]], c.plume || '#8c3b32');
      break;
    case 'lance':
      line(ctx, -20, 6, 56, -16, '#4a3a2a', 3.2);
      line(ctx, -20, 5, 56, -17, lit, 0.9);
      poly(ctx, [[54, -18], [74, -24], [58, -10]], edge);
      poly(ctx, [[58, -16], [74, -24], [61, -11]], md);
      for (let i = 0; i < 3; i++) line(ctx, 40 + i * 3, -11 + i * 2, 44 + i * 3, -8 + i * 2, trim, 1);
      break;
    case 'snake':
      line(ctx, -20, 6, 36, -12, '#3a3a3a', 3.4);
      line(ctx, -20, 5, 36, -13, lit, 0.9);
      ctx.beginPath();
      ctx.moveTo(34, -12);
      ctx.quadraticCurveTo(50, -30, 58, -14);
      ctx.quadraticCurveTo(66, -32, 72, -16);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 3.6;
      ctx.stroke();
      ctx.strokeStyle = md;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      break;
    case 'guandao':
      line(ctx, -24, 8, 46, -14, '#3f2c1c', 3.6);
      line(ctx, -24, 7, 46, -15, lit, 0.9);
      gradPoly(ctx, [[42, -20], [70, -34], [78, -12], [48, -6]], shade(metal, 0.22), shade(metal, -0.28), c.ink);
      poly(ctx, [[54, -20], [78, -12], [48, -6]], md);
      line(ctx, 46, -14, 68, -26, trim, 1.6);
      poly(ctx, [[30, -12], [42, -18], [36, -5]], '#8c3b32');
      break;
    case 'bow':
      ctx.beginPath();
      ctx.arc(28, -6, 23, -Math.PI * 0.62, Math.PI * 0.62);
      ctx.strokeStyle = '#7a4a26';
      ctx.lineWidth = 3.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(28, -6, 21, -Math.PI * 0.62, Math.PI * 0.62);
      ctx.strokeStyle = lit;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      line(ctx, 14, -25, 14, 13, c.eyeWhite, 1.5);
      rr(ctx, 10, -9, 5, 10, 1.6, c.dark);
      if (glow > 0) {
        line(ctx, 14, -8, 62, -8, '#e8dcc0', 1.8);
        poly(ctx, [[58, -11], [68, -8], [58, -5]], edge);
      }
      break;
    case 'dagger':
      line(ctx, -6, 5, 22, -5, md, 3);
      poly(ctx, [[20, -7], [34, -12], [26, -1]], edge);
      poly(ctx, [[23, -6], [34, -12], [27, -3]], c.eyeWhite);
      rr(ctx, 16, -8, 4, 9, 1, trim);
      break;
    case 'staff':
      line(ctx, -10, 18, 26, -44, '#6a4a2a', 3.4);
      line(ctx, -10, 17, 26, -45, lit, 0.9);
      for (let i = 0; i < 4; i++) line(ctx, -4 + i * 3.2, 8 - i * 5, -2 + i * 3.2, 5 - i * 5, trim, 1);
      ell(ctx, 29, -50, 8, 8, glow > 0 ? '#f6df9a' : '#b99a42', '#7a6328', 1.8);
      ell(ctx, 27, -52, 2.4, 2.4, 'rgba(255,246,214,0.6)');
      break;
    case 'twin':
      line(ctx, -8, 4, 24, -12 + glow * 5, edge, 2.8);
      line(ctx, 2, 6, 36, 6 - glow * 7, edge, 2.8);
      line(ctx, -7, 3, 22, -13 + glow * 5, c.eyeWhite, 0.8);
      rr(ctx, -10, 1, 4, 9, 1, c.dark);
      break;
    case 'sword':
      line(ctx, -5, 5, 36, -20 + glow * 5, edge, 3.2);
      line(ctx, -4, 4, 37, -21 + glow * 5, c.eyeWhite, 0.9);
      line(ctx, 12, -6, 22, -12, trim, 2.6);
      rr(ctx, -8, 2, 4.5, 9, 1.2, c.dark);
      ell(ctx, -6, 11, 2, 2, trim, c.ink, 0.7);
      break;
    case 'blade':
      line(ctx, -14, 14, 34, -14, '#4a3020', 3.6);
      line(ctx, -14, 13, 34, -15, lit, 0.9);
      gradPoly(ctx, [[30, -18], [60, -34], [52, 6], [38, -2]], shade(metal, 0.2), shade(metal, -0.32), c.ink);
      poly(ctx, [[46, -14], [60, -34], [52, 6]], md);
      line(ctx, 34, -14, 54, -26, trim, 1.3);
      rr(ctx, 26, -18, 4.5, 10, 1, trim);
      break;
    default:
      break;
  }
  ctx.restore();
  // 拳头压在握把上，武器才像真被握住
  ell(ctx, hand.x, hand.y, 3.9, 3.5, c.skin, c.ink, 0.9);
}

function drawSlashFx(ctx, hand, rot, c, strength) {
  ctx.save();
  ctx.globalAlpha = 0.82 * strength;
  ctx.strokeStyle = mixHex('#fff7df', c.trim, 0.35);
  ctx.lineWidth = 6 * strength;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, 52, rot - 0.95, rot + 0.32);
  ctx.stroke();
  ctx.globalAlpha = 0.5 * strength;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawHitFx(ctx, c, strength) {
  ctx.save();
  ctx.globalAlpha = 0.8 * strength;
  ctx.strokeStyle = '#ffe6c2';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const r1 = 9;
    const r2 = 18 + (i % 2) * 5;
    line(ctx, Math.cos(a) * r1, -58 + Math.sin(a) * r1,
      Math.cos(a) * r2, -58 + Math.sin(a) * r2, '#ffe6c2', 2.4);
  }
  ctx.restore();
}

function drawSkillFx(ctx, c, hand, rot, strength, tier) {
  const color = tier === 'legendary' ? HERO_AURA.legendary : HERO_AURA.epic;
  const tip = { x: hand.x + Math.cos(rot) * 58, y: hand.y + Math.sin(rot) * 58 };
  ctx.save();
  ctx.globalAlpha = 0.85 * strength;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 12 + 18 * strength, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.45 * strength;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    line(ctx, tip.x + Math.cos(a) * 16, tip.y + Math.sin(a) * 16,
      tip.x + Math.cos(a) * (30 + 16 * strength), tip.y + Math.sin(a) * (30 + 16 * strength), color, 2.2);
  }
  ctx.globalAlpha = 0.35 * strength;
  ell(ctx, tip.x, tip.y, 9 + 8 * strength, 9 + 8 * strength, 'rgba(255,246,222,0.55)');
  ctx.restore();
}

function drawHeroRig(ctx, c, hero, id, opts, p, action) {
  const {
    x = 0, y = 0, size = 96, flip = false, alpha = 1, t = 0,
  } = opts;
  const pose = poseFor(action, p);
  const tier = hero && hero.tier;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  const k = size / 100;
  ctx.scale(k, k);
  const bw = 1 + (c.build - 1) * 0.85;
  const bh = 1 + (c.build - 1) * 0.18;
  ctx.scale(bw, bh);
  if (action === 'death') {
    ctx.rotate(-Math.PI / 2.2 * easeOut(clamp01(p / 0.7)));
    ctx.globalAlpha = alpha * (1 - p * 0.5);
  }
  ctx.rotate(pose.lean);
  if (pose.shake) ctx.translate(Math.sin(t * 62) * pose.shake * 2.6, 0);

  // 沙地接触阴影
  ctx.beginPath();
  ctx.ellipse(0, 1.5, 19 * c.build, 5.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fill();

  const hy = c.horse ? horse(ctx, c, t, action === 'attack' || action === 'skill') : -2;
  const legTop = -34;
  const legH = legTop - hy > 4 ? legTop - hy : 4;
  const gait = action === 'walk' ? Math.sin(p * Math.PI * 2) * 6 : 0;

  if (c.cape) {
    const flutter = 2 + Math.sin(t * 3) * 1.8 + (action === 'skill' ? pose.charge * 6 : 0);
    gradPoly(ctx, [[-11, -70], [-26 - flutter, -32], [-14, -22], [-5, -52]], shade(c.dark, 0.12), shade(c.dark, -0.30), c.ink);
    gradPoly(ctx, [[-12, -68], [-22 - flutter, -34], [-17, -30], [-8, -52]], shade(c.capeLining, 0.18), shade(c.capeLining, -0.18));
    line(ctx, -14, -62, -20 - flutter, -36, 'rgba(255,240,210,0.10)', 1.2);
  }

  // 远侧手臂：压在躯干后面，盾也在这一层
  const shL = { x: -12 + pose.twist * 4, y: -69 };
  const armL = limbPts(shL.x, shL.y, pose.upperL, pose.foreL);
  drawLimb(ctx, shL, armL.elbow, 5.4, 4.4, c.robe, c.ink);
  drawLimb(ctx, armL.elbow, armL.hand, 4.4, 3.5, c.armor, c.ink);
  ell(ctx, armL.hand.x, armL.hand.y, 3.4, 3.1, c.skin, c.ink, 0.8);
  if (c.shield) {
    ell(ctx, armL.hand.x - 4, armL.hand.y - 2, 11, 11, c.armor, c.ink, 1.4);
    ell(ctx, armL.hand.x - 4, armL.hand.y - 2, 7.4, 7.4, c.armorShade, c.trim, 1.1);
    ell(ctx, armL.hand.x - 4, armL.hand.y - 2, 2.6, 2.6, c.trim, c.ink, 0.8);
  }

  // 腿：走路时前后摆，站定时稳住重心
  drawLimb(ctx, { x: -8 + gait * 0.35, y: legTop }, { x: -6 + gait, y: hy - 3 }, 5.2, 3.8, c.pants, c.ink);
  drawLimb(ctx, { x: 4 - gait * 0.35, y: legTop }, { x: 6 - gait, y: hy - 3 }, 5.2, 3.8, c.pants, c.ink);
  rr(ctx, -11 + gait, hy - 3.6, 10, 4.4, 2, c.ink);
  rr(ctx, 1 - gait, hy - 3.6, 10, 4.4, 2, c.ink);

  // 躯干：渐变面 + 交领 + 札甲，整个人不再是纯色纸片
  const tx = pose.twist * 5;
  gradPoly(ctx, [[-14 + tx, -72], [14 + tx, -72], [15, -48], [-15, -48]], shade(c.robe, 0.14), shade(c.robe, -0.26), c.ink);
  gradPoly(ctx, [[-15, -48], [15, -48], [17, -26], [5, -30], [0, -40], [-5, -30], [-17, -26]], shade(c.robe, 0.08), shade(c.robe, -0.30), c.ink);
  poly(ctx, [[-8 + tx, -71], [2 + tx, -62], [9 + tx, -71], [2 + tx, -74]], c.trim);
  poly(ctx, [[-8 + tx, -71], [-2 + tx, -63], [-4 + tx, -71]], c.dark);
  gradPoly(ctx, [[-11 + tx, -68], [11 + tx, -68], [12 + tx, -49], [-12 + tx, -49]], shade(c.armor, 0.22), shade(c.armor, -0.30), c.ink);
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 4; col++) {
      rr(ctx, -10 + tx + col * 5.3, -67 + r * 6, 4.5, 5, 1.2, (r + col) % 2 ? c.armorShade : c.armor);
    }
  }
  ell(ctx, 1 + tx, -58, 3.6, 3.6, c.trim, c.ink, 0.9);
  ell(ctx, 0.2 + tx, -59, 1.2, 1.2, 'rgba(255,246,214,0.42)');
  rr(ctx, -12, -52, 24, 4.6, 1.5, c.dark, c.ink, 0.9);
  rr(ctx, -2, -53.2, 4.6, 6.2, 1, c.trim, c.ink, 0.8);
  // 肩甲
  gradPoly(ctx, [[-18 + tx, -72], [-8 + tx, -76], [-7 + tx, -65], [-17 + tx, -63]], shade(c.armor, 0.20), shade(c.armor, -0.28), c.ink);
  gradPoly(ctx, [[8 + tx, -76], [18 + tx, -72], [17 + tx, -63], [7 + tx, -65]], shade(c.armor, 0.20), shade(c.armor, -0.28), c.ink);
  line(ctx, -16 + tx, -70, -9 + tx, -72.5, c.trim, 1.1);
  line(ctx, 9 + tx, -72.5, 16 + tx, -70, c.trim, 1.1);

  // 头：跟随身体转体与受击仰头
  ctx.save();
  ctx.translate(tx * 0.8, pose.head * 8 + Math.sin(t * 2.4) * 0.8);
  ctx.rotate(pose.head);
  head(ctx, c, hero, c.head);
  ctx.restore();

  // 近侧手臂 + 武器：最后画，确保武器压在身体前面且跟着肘/腕转
  const shR = { x: 12 + tx, y: -69 };
  const armR = limbPts(shR.x, shR.y, pose.upperR, pose.foreR);
  drawLimb(ctx, shR, armR.elbow, 6, 4.8, c.robe, c.ink);
  drawLimb(ctx, armR.elbow, armR.hand, 4.8, 3.8, c.armor, c.ink);
  rr(ctx, armR.elbow.x - 3, armR.elbow.y - 2.5, 6, 5, 1.5, c.armor, c.ink, 0.8);
  const glow = action === 'attack'
    ? (p > 0.30 && p < 0.64 ? 1 : 0)
    : action === 'skill' ? (p > 0.42 && p < 0.76 ? 1 : 0) : 0;
  drawWeaponRig(ctx, c, c.weapon, armR.hand, pose.weapon, glow);

  if (glow && action === 'attack') drawSlashFx(ctx, armR.hand, pose.weapon, c, glow);
  if (action === 'hit' && p < 0.34) drawHitFx(ctx, c, 1 - p / 0.34);
  if (glow && action === 'skill') drawSkillFx(ctx, c, armR.hand, pose.weapon, glow, tier);
  ctx.restore();
}

/* ---------------- 主绘制 ---------------- */

// 画一个英雄。size = 像素身高（含坐骑），默认 96。
export function drawHeroFigure(ctx, heroId, opts = {}) {
  const hero = heroId && typeof heroId === 'object' ? heroId : null;
  const id = hero ? hero.id : heroId;
  const raw = ART[id];
  if (!raw) return;
  // ART 结构不动（测试 / 界面依赖），运行时把高饱和色收进国风色板并派生材质色
  const c = {
    ...raw,
    robe: mute(raw.robe),
    dark: mute(raw.dark),
    armor: mute(raw.armor),
    trim: mute(raw.trim, 0.10),
    skin: mute(raw.skin, 0.08),
    plume: mute(raw.plume, 0.12),
    ink: '#241a14',
    metal: '#8b8f94',
    metalDark: '#565b60',
    wood: '#6b4a2c',
    armorShade: mute(raw.armor, 0.38),
    capeLining: mute(raw.trim, 0.34),
    pants: '#726554',
    eyeWhite: '#eee7d8',
    horseHide: '#7a5a3f',
    horseShade: '#4a3527',
    horseLit: 'rgba(226,196,152,0.16)',
  };
  const {
    x = 0, y = 0, size = 96, action = 'idle', t = 0, flip = false, alpha = 1,
    animated = false,
  } = opts;
  // 战场专用：可动骨架。UI 卡片仍走下面的 AI 立绘，保证静态展示质感；
  // 战场上手 / 武器 / 身体必须分段运动，不能只把整张贴图旋转一下。
  if (animated) {
    const dur = heroActionTime(action);
    const p = action === 'idle' || action === 'walk' ? 0 : clamp01(t / dur);
    drawHeroRig(ctx, c, hero, id, { ...opts, action }, p, action);
    return;
  }
  // 板块 3/4：优先用分包里的 AI Q版 3D 英雄立绘。图片未就绪 / 加载失败时
  // drawArt 返回 false，下面原有的程序化建模照常绘制，首帧与单测都不受影响。
  if (raw) {
    const bob = (action === 'idle' || action === 'walk')
      ? Math.sin(t * 2.4) * 1.6 * (size / 100) : 0;
    let lean = action === 'attack' ? -7 : 0;
    if (action === 'hit') lean = 9;
    const drawn = drawArt(ctx, ART_PATHS.hero(id), x, y - size * 0.5,
      size * 1.36, size * 1.22, {
        flip,
        alpha: action === 'death' ? alpha * 0.72 : alpha,
        rotate: (lean * Math.PI) / 180 + (action === 'death' ? -Math.PI / 2.2 : 0),
        offsetY: bob,
        shadow: Math.max(4, size * 0.12),
      });
    if (drawn) return;
  }
  const k = size / 100;
  const bob = action === 'idle' || action === 'walk' ? Math.sin(t * 2.4) * 1.6 : 0;
  const swing = action === 'attack' ? Math.sin(t * 14) : 0;
  let lean = action === 'attack' ? -7 : 0;
  if (action === 'hit') lean = 9;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(flip ? -k : k, k);
  const bw = 1 + (c.build - 1) * 0.85;
  const bh = 1 + (c.build - 1) * 0.18;
  if (bw !== 1 || bh !== 1) ctx.scale(bw, bh);
  if (action === 'death') {
    ctx.rotate(-Math.PI / 2.2);
    ctx.globalAlpha = alpha * 0.72;
  }
  ctx.rotate((lean * Math.PI) / 180);

  // 沙地反光 + 接触阴影
  ctx.beginPath();
  ctx.ellipse(0, 1.4, 19 * c.build, 5.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(122,92,56,0.10)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 2, 16 * c.build, 4.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fill();

  const hy = c.horse ? horse(ctx, c, t, action === 'attack') : -2;
  const legTop = -34;
  const legH = legTop - hy > 4 ? legTop - hy : 4;

  // 披风：外层 + 内衬 + 两道褶皱
  if (c.cape) {
    poly(ctx, [[-11, -70], [-26 - bob, -32], [-14, -22], [-5, -52]], c.dark);
    poly(ctx, [[-12, -68], [-22 - bob, -34], [-17, -30], [-8, -52]], c.capeLining);
    line(ctx, -14, -62, -20 - bob, -36, 'rgba(255,240,210,0.10)', 1.2);
    line(ctx, -10, -58, -15 - bob, -33, 'rgba(20,14,10,0.28)', 1.2);
  }

  // 腿：亮一档的裤色 + 描边，绑腿与靴不再像悬浮零件
  rr(ctx, -10, legTop, 8, legH, 3, c.pants, c.ink, 1);
  rr(ctx, 2, legTop, 8, legH, 3, c.pants, c.ink, 1);
  line(ctx, -8.6, legTop + 2, -8.6, hy - 3, 'rgba(255,240,210,0.16)', 1.2);
  line(ctx, 3.4, legTop + 2, 3.4, hy - 3, 'rgba(255,240,210,0.16)', 1.2);
  if (!c.horse) {
    // 斜向绑腿：暗线而非亮横线，避免形成"梯子腿"
    for (let i = 0; i < 2; i++) {
      line(ctx, -10, -22 + i * 9, -2, -24 + i * 9, 'rgba(36,26,20,0.55)', 1.4);
      line(ctx, 2, -24 + i * 9, 10, -22 + i * 9, 'rgba(36,26,20,0.55)', 1.4);
    }
    line(ctx, -10, -6, -2, -6, c.trim, 1);
    line(ctx, 2, -6, 10, -6, c.trim, 1);
  }
  rr(ctx, -11, hy - 3.6, 10, 4.4, 2, c.ink);
  rr(ctx, 1, hy - 3.6, 10, 4.4, 2, c.ink);
  line(ctx, -9, hy - 2.4, -3, hy - 2.4, 'rgba(226,196,152,0.20)', 1);
  line(ctx, 3, hy - 2.4, 9, hy - 2.4, 'rgba(226,196,152,0.20)', 1);

  // 战袍下摆：开衩 + 布褶 + 暗边
  poly(ctx, [[-15, -48], [15, -48], [17, -26], [5, -30], [0, -40], [-5, -30], [-17, -26]], c.robe);
  line(ctx, -11, -44, -13, -30, 'rgba(20,14,10,0.26)', 1.2);
  line(ctx, 11, -44, 13, -30, 'rgba(20,14,10,0.26)', 1.2);
  line(ctx, -4, -46, -2, -34, 'rgba(255,240,210,0.09)', 1.1);
  poly(ctx, [[-17, -27], [17, -27], [17, -25], [-17, -25]], c.dark);

  // 躯干 + 交领右衽
  poly(ctx, [[-14, -48], [14, -48], [15, -72], [-14, -72]], c.robe);
  poly(ctx, [[-8, -71], [2, -62], [9, -71], [2, -74]], c.trim);
  poly(ctx, [[-8, -71], [-2, -63], [-4, -71]], c.dark);
  line(ctx, 2, -63, 9, -71, c.ink, 0.9);

  // 胸甲：札甲片阵列 + 铆钉 + 护心镜
  rr(ctx, -11, -68, 22, 19, 3, c.armor, c.ink, 1.1);
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 4; col++) {
      rr(ctx, -10 + col * 5.3, -67 + r * 6, 4.5, 5, 1.2, (r + col) % 2 ? c.armorShade : c.armor);
    }
  }
  ell(ctx, -8.5, -65, 0.9, 0.9, c.trim);
  ell(ctx, 9.5, -65, 0.9, 0.9, c.trim);
  ell(ctx, 1, -58, 3.6, 3.6, c.trim, c.ink, 0.9);
  ell(ctx, 0.2, -59, 1.2, 1.2, 'rgba(255,246,214,0.42)');

  // 束甲带 + 带扣 + 垂绦
  rr(ctx, -12, -52, 24, 4.6, 1.5, c.dark, c.ink, 0.9);
  rr(ctx, -2, -53.2, 4.6, 6.2, 1, c.trim, c.ink, 0.8);
  poly(ctx, [[-10, -48], [-7, -48], [-8, -38], [-10, -40]], c.trim);

  // 肩甲：两层 + 甲片
  poly(ctx, [[-18, -72], [-8, -76], [-7, -65], [-17, -63]], c.armor);
  poly(ctx, [[8, -76], [18, -72], [17, -63], [7, -65]], c.armor);
  line(ctx, -16, -70, -9, -72.5, c.trim, 1.1);
  line(ctx, 9, -72.5, 16, -70, c.trim, 1.1);
  line(ctx, -15, -66, -9, -67, c.ink, 0.9);
  line(ctx, 9, -67, 15, -66, c.ink, 0.9);

  // 手臂：上臂 / 前臂 / 护腕 / 握拳（不再是一根线）
  poly(ctx, [[-16, -70], [-11, -71], [-9, -58], [-14, -57]], c.robe);
  poly(ctx, [[11, -71], [16, -70], [15, -57], [10, -58]], c.robe);
  rr(ctx, -13, -60, 6, 5, 1.5, c.armor, c.ink, 0.8);
  rr(ctx, 10, -60, 6, 5, 1.5, c.armor, c.ink, 0.8);
  ell(ctx, -11, -54, 3.6, 3.2, c.skin, c.ink, 0.8);
  ell(ctx, 14, -56, 3.6, 3.2, c.skin, c.ink, 0.8);

  head(ctx, c, hero, c.head);
  weapon(ctx, c, c.weapon, swing, true);
  if (c.shield) {
    ell(ctx, -16, -52, 11, 11, c.armor, c.ink, 1.4);
    ell(ctx, -16, -52, 7.4, 7.4, c.armorShade, c.trim, 1.1);
    ell(ctx, -16, -52, 2.6, 2.6, c.trim, c.ink, 0.8);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ell(ctx, -16 + Math.cos(a) * 9, -52 + Math.sin(a) * 9, 0.9, 0.9, c.trim);
    }
  }
  ctx.restore();
}

// 品级光环：史诗黛紫 / 传奇暗金；战场和英雄页都用这一套，保证一眼能分出品级。
export function drawHeroAura(ctx, tier, x, y, size = 70, t = 0, alpha = 0.9) {
  const color = tier === 'legendary' ? HERO_AURA.legendary : HERO_AURA.epic;
  const rx = size * 0.52;
  const ry = size * 0.16;
  ctx.save();
  ctx.globalAlpha = alpha;
  // 地面光晕
  const g = ctx.createRadialGradient(x, y, 2, x, y, rx);
  g.addColorStop(0, tier === 'legendary' ? 'rgba(213,153,71,0.34)' : 'rgba(150,101,154,0.32)');
  g.addColorStop(0.6, tier === 'legendary' ? 'rgba(213,153,71,0.14)' : 'rgba(150,101,154,0.13)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // 品级光柱
  const beamH = size * 1.5;
  const tint = tier === 'legendary' ? '213,153,71' : '150,101,154';
  const beam = ctx.createLinearGradient(x, y - beamH, x, y);
  beam.addColorStop(0, `rgba(${tint},0)`);
  beam.addColorStop(0.55, `rgba(${tint},0.16)`);
  beam.addColorStop(1, `rgba(${tint},0.42)`);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(x - rx * 0.55, y);
  ctx.lineTo(x - rx * 0.18, y - beamH);
  ctx.lineTo(x + rx * 0.18, y - beamH);
  ctx.lineTo(x + rx * 0.55, y);
  ctx.closePath();
  ctx.fill();
  // 两道旋转光环
  for (let i = 0; i < 2; i++) {
    const rot = t * (i ? -1.2 : 1.5) + i * 1.7;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * (0.9 + i * 0.14), ry * (0.9 + i * 0.14), rot * 0.12, 0, Math.PI * 2);
    ctx.lineWidth = i ? 2.5 : 4;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha * (i ? 0.65 : 0.95);
    ctx.stroke();
  }
  // 上升粒子
  for (let i = 0; i < 5; i++) {
    const p = (t * 0.6 + i * 0.2) % 1;
    const px = x + Math.sin(t * 1.4 + i * 1.9) * rx * 0.8;
    const py = y - p * size * 1.7;
    ctx.globalAlpha = alpha * (1 - p) * 0.9;
    ctx.beginPath();
    ctx.arc(px, py, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
}

// 给 UI 卡片用的小光环（不带粒子，避免列表里太乱）
export function drawHeroHalo(ctx, tier, x, y, w, h, alpha = 1) {
  const color = tier === 'legendary' ? HERO_AURA.legendary : HERO_AURA.epic;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 2, x, y, w / 2);
  g.addColorStop(0, tier === 'legendary' ? 'rgba(213,153,71,0.22)' : 'rgba(150,101,154,0.2)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = alpha * 0.75;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
