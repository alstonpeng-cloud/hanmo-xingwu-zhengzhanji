// 斗技场场地绘制（战斗页 / 布阵页共用）：斜 45° 地面（近宽远窄的梯形）
// 黄巾之乱主题：高饱和黄沙、龟裂地面、枯草、碎石、断兵与黄巾旗，整体苍凉但不遮挡兵种
// 坐标一律走相机（世界格 → 屏幕像素），拖动 / 缩放相机后地形装饰跟着走
import { CONFIG } from '../data/config.js';
import { camToScreen, camToWorld, depthScale, ARENA_MARGIN, ARENA_MARGIN_TOP } from './camera.js';
import { text } from './draw.js';
import { mulberry32 } from '../core/rng.js';

const COLS = CONFIG.arena.cols;
const ROWS = CONFIG.arena.rows;
const DEFAULT_THEME = CONFIG.arenaTheme;

// 各章节的装饰构成（数量按主题切换，位置仍用确定性随机，保证同一场永远一样）
const DECOR_PRESET = {
  sand: { speck: 260, pebble: 26, grass: 34, crack: 16, weapon: 9, cart: 2, ember: 0, reed: 0, stone: 0, snow: 0 },
  ash: { speck: 220, pebble: 20, grass: 2, crack: 34, weapon: 16, cart: 3, ember: 44, reed: 0, stone: 0, snow: 0 },
  plains: { speck: 240, pebble: 18, grass: 72, crack: 6, weapon: 6, cart: 1, ember: 0, reed: 10, stone: 0, snow: 0 },
  river: { speck: 220, pebble: 10, grass: 18, crack: 0, weapon: 5, cart: 0, ember: 0, reed: 46, stone: 0, snow: 0 },
  stone: { speck: 220, pebble: 8, grass: 16, crack: 10, weapon: 8, cart: 1, ember: 0, reed: 0, stone: 42, snow: 0 },
  snow: { speck: 240, pebble: 12, grass: 4, crack: 8, weapon: 10, cart: 1, ember: 0, reed: 0, stone: 14, snow: 56 },
};

const DUNE_TONES = {
  sand: ['rgba(255,222,150,0.10)', 'rgba(110,58,20,0.10)'],
  ash: ['rgba(255,140,80,0.08)', 'rgba(10,6,4,0.22)'],
  plains: ['rgba(210,232,150,0.08)', 'rgba(30,48,20,0.16)'],
  river: ['rgba(200,238,255,0.10)', 'rgba(8,28,40,0.18)'],
  stone: ['rgba(230,224,190,0.08)', 'rgba(26,24,18,0.18)'],
  snow: ['rgba(255,255,255,0.14)', 'rgba(40,48,56,0.18)'],
};

const GROUND_BANDS = {
  sand: ['rgba(105,58,20,0.26)', 'rgba(255,205,110,0.10)', 'rgba(255,218,130,0.09)', 'rgba(205,135,52,0.12)', 'rgba(92,50,16,0.30)'],
  ash: ['rgba(10,6,4,0.34)', 'rgba(255,120,60,0.08)', 'rgba(120,50,30,0.10)', 'rgba(60,24,16,0.16)', 'rgba(8,4,3,0.38)'],
  plains: ['rgba(30,48,20,0.24)', 'rgba(210,232,150,0.09)', 'rgba(180,208,120,0.08)', 'rgba(70,90,40,0.12)', 'rgba(24,36,16,0.26)'],
  river: ['rgba(6,26,38,0.30)', 'rgba(200,238,255,0.10)', 'rgba(170,220,240,0.09)', 'rgba(20,54,72,0.14)', 'rgba(4,18,28,0.34)'],
  stone: ['rgba(24,22,16,0.26)', 'rgba(230,224,190,0.08)', 'rgba(200,192,160,0.07)', 'rgba(50,46,34,0.12)', 'rgba(20,18,14,0.28)'],
  snow: ['rgba(28,34,40,0.24)', 'rgba(255,255,255,0.12)', 'rgba(240,248,255,0.10)', 'rgba(70,80,90,0.12)', 'rgba(20,26,32,0.28)'],
};

const GRID_RGB = {
  sand: '255,230,180',
  ash: '255,190,150',
  plains: '226,240,190',
  river: '210,240,255',
  stone: '232,226,190',
  snow: '245,250,255',
};

function themeFor(id) {
  return (CONFIG.arenaThemes && CONFIG.arenaThemes[id]) || DEFAULT_THEME;
}

function themeSeed(id) {
  let h = 2166136261;
  const s = String(id || 'huangjin');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) || 0x51ab1e;
}

// 一次性生成确定性的地形装饰（每个主题一份，同一场永远一样，不随机跳）
const DECOR_CACHE = {};
function decorFor(themeId) {
  if (DECOR_CACHE[themeId]) return DECOR_CACHE[themeId];
  const theme = themeFor(themeId);
  const preset = DECOR_PRESET[theme.decor] || DECOR_PRESET.sand;
  const rand = mulberry32(themeSeed(themeId));
  const list = [];
  const inCenter = (y) => y > 20 && y < 40;
  const edgeX = () => (rand() < 0.5 ? rand() * 4 : COLS - rand() * 4);

  // 沙粒 / 亮点
  for (let i = 0; i < preset.speck; i++) {
    list.push({
      type: 'speck',
      x: rand() * COLS,
      y: rand() * ROWS,
      s: 0.07 + rand() * 0.15,
      tone: Math.floor(rand() * 3),
    });
  }

  // 碎石：优先放在两侧，保证中间交战区干净
  for (let i = 0; i < preset.pebble; i++) {
    const y = rand() * ROWS;
    const x = inCenter(y) ? edgeX() : rand() * COLS;
    list.push({ type: 'pebble', x, y, s: 0.17 + rand() * 0.18, tone: Math.floor(rand() * 2) });
  }

  // 枯草
  for (let i = 0; i < preset.grass; i++) {
    const y = rand() * ROWS;
    const x = inCenter(y) ? edgeX() : rand() * COLS;
    list.push({ type: 'grass', x, y, s: 0.2 + rand() * 0.18, a: rand() * Math.PI });
  }

  // 龟裂
  for (let i = 0; i < preset.crack; i++) {
    list.push({
      type: 'crack',
      x: rand() * COLS,
      y: rand() * ROWS,
      len: 0.28 + rand() * 0.42,
      a: rand() * Math.PI * 2,
      bend: (rand() - 0.5) * 0.7,
    });
  }

  // 断兵 / 残枪
  for (let i = 0; i < preset.weapon; i++) {
    const y = rand() * ROWS;
    const x = inCenter(y) ? (rand() < 0.5 ? rand() * 3.5 : COLS - rand() * 3.5) : rand() * COLS;
    list.push({ type: 'weapon', x, y, len: 0.55 + rand() * 0.35, a: rand() * Math.PI * 2 });
  }

  // 破车
  for (let i = 0; i < preset.cart; i++) {
    list.push({
      type: 'cart',
      x: i % 2 ? COLS - 3.2 : 3.2,
      y: i % 2 ? 10.5 : 49.5,
      s: 0.95,
      a: i % 2 ? Math.PI + 0.25 : -0.25,
    });
  }

  // 余烬（董卓焦土）
  for (let i = 0; i < preset.ember; i++) {
    const y = rand() * ROWS;
    list.push({ type: 'ember', x: inCenter(y) ? edgeX() : rand() * COLS, y, s: 0.08 + rand() * 0.14 });
  }

  // 芦苇（赤壁水岸）
  for (let i = 0; i < preset.reed; i++) {
    const y = rand() * ROWS;
    list.push({ type: 'reed', x: inCenter(y) ? edgeX() : rand() * COLS, y, s: 0.22 + rand() * 0.16, a: rand() * Math.PI });
  }

  // 石块（三分石垒）
  for (let i = 0; i < preset.stone; i++) {
    const y = rand() * ROWS;
    list.push({ type: 'stone', x: inCenter(y) ? edgeX() : rand() * COLS, y, s: 0.2 + rand() * 0.18, a: rand() * Math.PI });
  }

  // 积雪
  for (let i = 0; i < preset.snow; i++) {
    list.push({ type: 'snow', x: rand() * COLS, y: rand() * ROWS, s: 0.18 + rand() * 0.3 });
  }

  // 四面旗帜（颜色 / 字随章节主题）
  [
    { x: 1.4, y: 7.5 },
    { x: COLS - 1.4, y: 7.5 },
    { x: 1.4, y: ROWS - 7.5 },
    { x: COLS - 1.4, y: ROWS - 7.5 },
  ].forEach((b) => list.push({
    type: 'banner', ...b, color: theme.banner, trim: theme.bannerTrim, glyph: theme.bannerGlyph || '黄',
  }));

  DECOR_CACHE[themeId] = list;
  return list;
}

// 世界四边形 → 屏幕路径（4 个角依次连起来）
function quadPath(ctx, cam, x0, y0, x1, y1) {
  const a = camToScreen(cam, x0, y0);
  const b = camToScreen(cam, x1, y0);
  const c = camToScreen(cam, x1, y1);
  const d = camToScreen(cam, x0, y1);
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

function fillBand(ctx, cam, y0, y1, color) {
  ctx.beginPath();
  quadPath(ctx, cam, 0, y0, COLS, y1);
  ctx.fillStyle = color;
  ctx.fill();
}

/* ---------- 地形装饰 ---------- */
const DECOR_PALETTE = {
  sand: { pebble: '#5a3819', pebble2: '#6d4721', grass: 'rgba(118,104,42,0.72)', crack: 'rgba(82,48,20,0.46)' },
  ash: { pebble: '#31231c', pebble2: '#412d23', grass: 'rgba(120,92,60,0.45)', crack: 'rgba(14,8,6,0.62)' },
  plains: { pebble: '#4c5a2e', pebble2: '#5e6e3a', grass: 'rgba(74,110,52,0.78)', crack: 'rgba(48,58,28,0.40)' },
  river: { pebble: '#2c4a56', pebble2: '#3a5c68', grass: 'rgba(96,140,120,0.70)', crack: 'rgba(10,30,40,0.50)' },
  stone: { pebble: '#55503e', pebble2: '#66604a', grass: 'rgba(118,118,84,0.62)', crack: 'rgba(28,26,18,0.48)' },
  snow: { pebble: '#4a5258', pebble2: '#5a646a', grass: 'rgba(150,160,160,0.55)', crack: 'rgba(36,42,48,0.52)' },
};

function drawSpeck(ctx, p, s, tone, colors) {
  ctx.fillStyle = colors[tone % 3];
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, Math.max(1, s), Math.max(0.7, s * 0.55), 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPebble(ctx, p, s, tone, pal) {
  ctx.fillStyle = 'rgba(20,16,10,0.22)';
  ctx.beginPath();
  ctx.ellipse(p.x + s * 0.25, p.y + s * 0.3, s * 1.05, s * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tone ? pal.pebble2 : pal.pebble;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, s, s * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,244,220,0.22)';
  ctx.beginPath();
  ctx.ellipse(p.x - s * 0.28, p.y - s * 0.28, s * 0.45, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrass(ctx, p, s, a, pal) {
  ctx.strokeStyle = pal.grass;
  ctx.lineWidth = Math.max(1, s * 0.12);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(
      p.x + Math.cos(a + i * 0.35) * s * 0.5,
      p.y - s * 1.2,
      p.x + Math.cos(a + i * 0.35) * s * 0.9,
      p.y - s * 2.4,
    );
    ctx.stroke();
  }
}

function drawCrack(ctx, p, s, d, pal) {
  const len = s * d.len * 2.2;
  ctx.strokeStyle = pal.crack;
  ctx.lineWidth = 1.1;
  const ex = p.x + Math.cos(d.a) * len;
  const ey = p.y + Math.sin(d.a) * len * 0.6;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.quadraticCurveTo(
    p.x + Math.cos(d.a) * len * 0.5 + d.bend * 10,
    p.y + Math.sin(d.a) * len * 0.3,
    ex, ey,
  );
  ctx.stroke();
  // 两条分叉
  for (let k = 0; k < 2; k++) {
    const t = 0.38 + k * 0.3;
    const bx = p.x + Math.cos(d.a) * len * t;
    const by = p.y + Math.sin(d.a) * len * 0.6 * t;
    const br = d.a + (k ? 1 : -1) * (0.55 + d.bend);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(br) * len * 0.3, by + Math.sin(br) * len * 0.2);
    ctx.stroke();
  }
}

// 余烬：焦土上的暗红光点
function drawEmber(ctx, p, s) {
  ctx.fillStyle = 'rgba(255,110,40,0.16)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, s * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,170,70,0.78)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(0.8, s * 0.65), 0, Math.PI * 2);
  ctx.fill();
}

// 芦苇：水岸边的细长草秆 + 穗
function drawReed(ctx, p, s, a) {
  ctx.strokeStyle = 'rgba(72,96,74,0.78)';
  ctx.lineWidth = Math.max(1, s * 0.1);
  for (let i = -1; i <= 1; i++) {
    const bend = Math.cos(a + i * 0.4) * s * 0.7;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + bend * 0.5, p.y - s * 1.6, p.x + bend, p.y - s * 2.8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(156,132,80,0.85)';
    ctx.beginPath();
    ctx.ellipse(p.x + bend, p.y - s * 2.9, s * 0.18, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 石块：石垒山道的碎岩
function drawStone(ctx, p, s, a) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(a * 0.12);
  ctx.fillStyle = 'rgba(20,18,14,0.28)';
  ctx.beginPath();
  ctx.ellipse(s * 0.2, s * 0.25, s * 1.1, s * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5b5645';
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.lineTo(-s * 0.4, -s * 0.72);
  ctx.lineTo(s * 0.5, -s * 0.55);
  ctx.lineTo(s, s * 0.1);
  ctx.lineTo(s * 0.2, s * 0.5);
  ctx.lineTo(-s * 0.6, s * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(232,226,196,0.24)';
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, -s * 0.7);
  ctx.lineTo(s * 0.5, -s * 0.52);
  ctx.lineTo(s * 0.1, -s * 0.18);
  ctx.lineTo(-s * 0.5, -s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 积雪：霜雪洛阳的白色残雪
function drawSnow(ctx, p, s) {
  ctx.fillStyle = 'rgba(244,250,255,0.30)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, s * 1.5, s * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(p.x - s * 0.25, p.y - s * 0.12, s * 0.7, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawWeapon(ctx, p, s, d) {
  const len = s * d.len * 2;
  const ex = p.x + Math.cos(d.a) * len;
  const ey = p.y + Math.sin(d.a) * len * 0.5;
  ctx.strokeStyle = 'rgba(58,46,34,0.8)';
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  // 断掉的枪头 / 刀身
  ctx.strokeStyle = 'rgba(120,100,70,0.75)';
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex + Math.cos(d.a + 0.5) * len * 0.22, ey + Math.sin(d.a + 0.5) * len * 0.12);
  ctx.stroke();
}

function drawCart(ctx, p, s, d) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(d.a);
  ctx.fillStyle = 'rgba(58,34,14,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.35, s * 1.15, s * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6e4520';
  ctx.fillRect(-s * 0.8, -s * 0.45, s * 1.6, s * 0.55);
  ctx.strokeStyle = '#4b2e15';
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.strokeRect(-s * 0.8, -s * 0.45, s * 1.6, s * 0.55);
  // 两个车轮
  [-s * 0.5, s * 0.5].forEach((wx) => {
    ctx.strokeStyle = '#4c2f17';
    ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.beginPath();
    ctx.arc(wx, s * 0.1, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx - s * 0.3, s * 0.1);
    ctx.lineTo(wx + s * 0.3, s * 0.1);
    ctx.stroke();
  });
  ctx.restore();
}

function drawBanner(ctx, cam, d, p, theme) {
  const s = cam.zoom * depthScale(cam, d.y) * 1.15;
  const poleH = s * 2.35;
  const flagW = s * 0.95;
  const flagH = s * 0.62;

  // 地面阴影
  ctx.fillStyle = 'rgba(50,30,12,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, s * 0.5, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // 旗杆
  ctx.strokeStyle = theme.wood;
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - poleH);
  ctx.stroke();

  // 旗面（微微飘动）
  ctx.fillStyle = d.color;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - poleH + s * 0.08);
  ctx.lineTo(p.x + flagW, p.y - poleH + s * 0.2);
  ctx.quadraticCurveTo(p.x + flagW * 0.62, p.y - poleH + flagH * 0.55, p.x + flagW * 0.95, p.y - poleH + flagH);
  ctx.lineTo(p.x, p.y - poleH + flagH * 0.9);
  ctx.closePath();
  ctx.fill();

  // 旗面上的章节字（黄 / 董 / 群 / 火 / 汉 / 晋）
  text(ctx, d.glyph || '黄', p.x + flagW * 0.42, p.y - poleH + flagH * 0.66, {
    size: Math.max(11, s * 0.42),
    weight: '700',
    align: 'center',
    color: d.trim,
  });

  // 边条
  ctx.strokeStyle = d.trim;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.beginPath();
  ctx.moveTo(p.x + s * 0.08, p.y - poleH + flagH * 0.78);
  ctx.lineTo(p.x + flagW * 0.92, p.y - poleH + flagH * 0.55);
  ctx.stroke();
}

// 沙丘脊线：横向起伏的半透明亮 / 暗带，让大片地面有地形层次
function drawDunes(ctx, cam, tones) {
  const [light, dark] = tones;
  const ridges = [
    { y: 12, amp: 0.9, freq: 0.32, color: light, w: 30 },
    { y: 20, amp: 0.6, freq: 0.42, color: dark, w: 24 },
    { y: 30, amp: 0.8, freq: 0.28, color: light, w: 34 },
    { y: 42, amp: 0.55, freq: 0.38, color: dark, w: 26 },
    { y: 52, amp: 0.7, freq: 0.3, color: light, w: 30 },
  ];
  ctx.lineJoin = 'round';
  for (const r of ridges) {
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.w;
    ctx.beginPath();
    for (let x = 0; x <= COLS; x += 1.5) {
      const wy = r.y + Math.sin(x * r.freq) * r.amp;
      const p = camToScreen(cam, x, wy);
      if (x === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

// 赤壁：横向水波 + 中央浅色河道
function drawWater(ctx, cam) {
  for (let k = 0; k < 5; k++) {
    const y0 = 8 + k * 16;
    ctx.strokeStyle = `rgba(214,244,255,${0.06 + (k % 2) * 0.03})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let x = 0; x <= COLS; x += 1.5) {
      const wy = y0 + Math.sin(x * 0.35 + k) * 1.2;
      const p = camToScreen(cam, x, wy);
      if (x === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  fillBand(ctx, cam, 36, 48, 'rgba(180,224,240,0.06)');
}

// 霜雪：上下边缘的白霜
function drawSnowOverlay(ctx, cam) {
  fillBand(ctx, cam, 0, 10, 'rgba(255,255,255,0.10)');
  fillBand(ctx, cam, 70, ROWS, 'rgba(255,255,255,0.08)');
}

// 焦土：边缘的暗红余温
function drawEmberHaze(ctx, cam) {
  fillBand(ctx, cam, 2, 12, 'rgba(255,96,40,0.06)');
  fillBand(ctx, cam, 72, ROWS, 'rgba(255,80,30,0.06)');
}

export function drawArenaField(ctx, cam, opts = {}) {
  const { x, y, w, h } = cam.view;
  const showLabels = opts.labels !== false;
  const theme = themeFor(opts.theme);
  const decor = decorFor(opts.theme);
  const pal = DECOR_PALETTE[theme.decor] || DECOR_PALETTE.sand;
  const bands = GROUND_BANDS[theme.decor] || GROUND_BANDS.sand;
  const grid = GRID_RGB[theme.decor] || GRID_RGB.sand;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // 视口覆盖的世界格范围（地形 / 网格 / 装饰都按它裁剪）
  const tl = camToWorld(cam, x, y);
  const br = camToWorld(cam, x + w, y + h);
  const gx0 = Math.max(0, Math.floor(Math.min(tl.x, br.x)));
  const gx1 = Math.min(COLS, Math.ceil(Math.max(tl.x, br.x)));
  const gy0 = Math.max(0, Math.floor(Math.min(tl.y, br.y)));
  const gy1 = Math.min(ROWS, Math.ceil(Math.max(tl.y, br.y)));

  // 场外：先铺满深色底，再把场地外围 ARENA_MARGIN 格画成压暗的护坡。
  // 相机可以越过边界，这两层保证拖到极限也不会露出空白。
  ctx.fillStyle = '#0b0806';
  ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  quadPath(ctx, cam, -ARENA_MARGIN, -ARENA_MARGIN, COLS + ARENA_MARGIN, ROWS + ARENA_MARGIN);
  ctx.fillStyle = theme.sandLow;
  ctx.fill();
  // 顶部因为 HUD 遮挡多留了 ARENA_MARGIN_TOP 格，护坡向上补一段，避免出现色块断层
  ctx.beginPath();
  quadPath(ctx, cam, -ARENA_MARGIN, -ARENA_MARGIN_TOP, COLS + ARENA_MARGIN, 0);
  ctx.fillStyle = theme.sandLow;
  ctx.fill();
  // 两块护坡一起压暗
  ctx.beginPath();
  quadPath(ctx, cam, -ARENA_MARGIN, -ARENA_MARGIN, COLS + ARENA_MARGIN, ROWS + ARENA_MARGIN);
  quadPath(ctx, cam, -ARENA_MARGIN, -ARENA_MARGIN_TOP, COLS + ARENA_MARGIN, 0);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#0a0705';
  ctx.fill();
  ctx.restore();
  // 护坡上的两道收边线（地面一路向外沉下去，边界更明确）
  for (const inset of [1.2, 2.6]) {
    ctx.beginPath();
    quadPath(ctx, cam, -inset, -inset, COLS + inset, ROWS + inset);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 地面底色：按章节主题渐变，近处略深
  const topP = camToScreen(cam, COLS / 2, 0).y;
  const botP = camToScreen(cam, COLS / 2, ROWS).y;
  const grad = ctx.createLinearGradient(0, topP, 0, botP);
  grad.addColorStop(0, theme.sandTop);
  grad.addColorStop(0.18, theme.sandUpper);
  grad.addColorStop(0.55, theme.sandMid);
  grad.addColorStop(1, theme.sandLow);
  ctx.beginPath();
  quadPath(ctx, cam, 0, 0, COLS, ROWS);
  ctx.fillStyle = grad;
  ctx.fill();

  // 深浅地形带：横向铺开，避免大片纯色
  fillBand(ctx, cam, 0, 8, bands[0]);
  fillBand(ctx, cam, 8, 22, bands[1]);
  fillBand(ctx, cam, 22, 40, bands[2]);
  fillBand(ctx, cam, 40, 54, bands[3]);
  fillBand(ctx, cam, 54, ROWS, bands[4]);
  drawDunes(ctx, cam, DUNE_TONES[theme.decor] || DUNE_TONES.sand);

  // 主题专属氛围
  if (theme.water) drawWater(ctx, cam);
  if (theme.snow) drawSnowOverlay(ctx, cam);
  if (theme.ember) drawEmberHaze(ctx, cam);

  // 上下半场淡色区分（上 = 敌方红，下 = 我方绿）
  ctx.beginPath();
  quadPath(ctx, cam, 0, 0, COLS, ROWS / 2);
  ctx.fillStyle = 'rgba(172,54,34,0.10)';
  ctx.fill();
  ctx.beginPath();
  quadPath(ctx, cam, 0, ROWS / 2, COLS, ROWS);
  ctx.fillStyle = 'rgba(52,108,62,0.08)';
  ctx.fill();

  // 地面装饰（按章节主题切换：沙粒 / 草 / 裂痕 / 断兵 / 破车 / 余烬 / 芦苇 / 石块 / 积雪）
  for (const d of decor) {
    if (d.type === 'banner') continue;
    if (d.x < gx0 - 2 || d.x > gx1 + 2 || d.y < gy0 - 2 || d.y > gy1 + 2) continue;
    const p = camToScreen(cam, d.x, d.y);
    if (p.x < x - 30 || p.x > x + w + 30 || p.y < y - 30 || p.y > y + h + 30) continue;
    const s = cam.zoom * depthScale(cam, d.y);
    if (d.type === 'speck') drawSpeck(ctx, p, s * d.s, d.tone, theme.speck);
    else if (d.type === 'pebble') drawPebble(ctx, p, s * d.s, d.tone, pal);
    else if (d.type === 'grass') drawGrass(ctx, p, s * d.s, d.a, pal);
    else if (d.type === 'crack') drawCrack(ctx, p, s, d, pal);
    else if (d.type === 'weapon') drawWeapon(ctx, p, s, d);
    else if (d.type === 'cart') drawCart(ctx, p, s * d.s, d);
    else if (d.type === 'ember') drawEmber(ctx, p, s * d.s);
    else if (d.type === 'reed') drawReed(ctx, p, s * d.s, d.a);
    else if (d.type === 'stone') drawStone(ctx, p, s * d.s, d.a);
    else if (d.type === 'snow') drawSnow(ctx, p, s * d.s);
  }

  // 网格：每格细线，每 5 格稍亮，每 10 格最亮（颜色跟随章节）
  ctx.lineWidth = 1;
  for (let i = gx0; i <= gx1; i++) {
    const grade = i % 10 === 0 ? 2 : i % 5 === 0 ? 1 : 0;
    ctx.strokeStyle = `rgba(${grid},${grade === 2 ? 0.22 : grade === 1 ? 0.13 : 0.06})`;
    const a = camToScreen(cam, i, gy0);
    const b = camToScreen(cam, i, gy1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let i = gy0; i <= gy1; i++) {
    const grade = i % 10 === 0 ? 2 : i % 5 === 0 ? 1 : 0;
    ctx.strokeStyle = `rgba(${grid},${grade === 2 ? 0.22 : grade === 1 ? 0.13 : 0.06})`;
    const a = camToScreen(cam, gx0, i);
    const b = camToScreen(cam, gx1, i);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // 中线（双方上下对阵）
  const m0 = camToScreen(cam, gx0, ROWS / 2);
  const m1 = camToScreen(cam, gx1, ROWS / 2);
  ctx.strokeStyle = `rgba(${grid},0.55)`;
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(m0.x, m0.y);
  ctx.lineTo(m1.x, m1.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // 场地边界：外阴影 + 围墙 + 内侧高光 + 立柱，拖到极限也一眼看得出墙在哪
  const wallPath = (inset) => {
    ctx.beginPath();
    quadPath(ctx, cam, -inset, -inset, COLS + inset, ROWS + inset);
  };
  ctx.save();
  ctx.lineJoin = 'round';
  wallPath(0.35);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 18;
  ctx.stroke();
  wallPath(0);
  ctx.strokeStyle = theme.wall || '#3a2a18';
  ctx.lineWidth = 9;
  ctx.stroke();
  wallPath(0);
  ctx.strokeStyle = `rgba(${grid},0.72)`;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // 围墙立柱：沿四条边均匀立起，近大远小（用金色柱头点出边界）
  const post = (wx, wy) => {
    const p = camToScreen(cam, wx, wy);
    if (p.x < x - 20 || p.x > x + w + 20 || p.y < y - 60 || p.y > y + h + 30) return;
    const z = cam.zoom * depthScale(cam, wy);
    const hgt = z * 0.95;
    ctx.strokeStyle = '#241708';
    ctx.lineWidth = Math.max(2, z * 0.1);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 1);
    ctx.lineTo(p.x, p.y - hgt);
    ctx.stroke();
    ctx.fillStyle = '#c9a35a';
    ctx.beginPath();
    ctx.arc(p.x, p.y - hgt, Math.max(1.6, z * 0.065), 0, Math.PI * 2);
    ctx.fill();
  };
  for (let wx = 0; wx <= COLS; wx += 5) {
    post(wx, 0);
    post(wx, ROWS);
  }
  for (let wy = 6; wy < ROWS; wy += 7) {
    post(0, wy);
    post(COLS, wy);
  }

  // 章节旗帜（站在地面上，画在网格之上，但不会盖住中间兵种）
  for (const d of decor) {
    if (d.type !== 'banner') continue;
    if (d.x < gx0 - 2 || d.x > gx1 + 2 || d.y < gy0 - 2 || d.y > gy1 + 2) continue;
    const p = camToScreen(cam, d.x, d.y);
    if (p.x < x - 50 || p.x > x + w + 50 || p.y < y - 120 || p.y > y + h + 40) continue;
    drawBanner(ctx, cam, d, p, theme);
  }

  // 半场标签（暖色底上加深色描边感）
  if (showLabels) {
    const labelE = camToScreen(cam, COLS / 2, ROWS * 0.25);
    const labelP = camToScreen(cam, COLS / 2, ROWS * 0.75);
    if (labelE.y > y - 30 && labelE.y < y + h + 30) {
      text(ctx, '敌方半场', labelE.x, labelE.y, { size: 22, align: 'center', color: 'rgba(255,214,185,0.72)' });
    }
    if (labelP.y > y - 30 && labelP.y < y + h + 30) {
      text(ctx, '我方半场', labelP.x, labelP.y, { size: 22, align: 'center', color: 'rgba(214,242,196,0.68)' });
    }
  }
  ctx.restore();
}
