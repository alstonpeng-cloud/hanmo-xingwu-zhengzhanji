import { inkShade, inkOutline, isInkFill } from './ink.js';

// 12 个特殊兵种的专用程序化模型（2026-11 重做）
// 目标：每个兵种锁定「1 个主识别轮廓 + 1 个主色 + 1 个核心道具」，
// 按参考图的低模/极简风格重画，升级只加少量配件，不改变剪影。
// 坐标系：脚底 = 原点，向上为负；面向右。96×96 帧，自动 fit 由 sprites.js 的 paintFrame 处理。

/* ---------------- 基础绘制工具 ---------------- */
function ell(ctx, x, y, rx, ry, color) {
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

function rr(ctx, x, y, w, h, r, fill, stroke, lw = 1.6) {
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
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
    if (isInkFill(fill)) inkShade(ctx, x, y, w, h);
  }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  if (isInkFill(fill)) inkOutline(ctx, !!stroke, lw);
}

function poly(ctx, pts, fill, stroke, lw = 1.4) {
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
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
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

function arc(ctx, x, y, r, a0, a1, color, lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function hitFlash(ctx, x, y, rx, ry, t) {
  ell(ctx, x, y, rx, ry, `rgba(255,120,95,${t < 0.55 ? 0.18 : 0.1})`);
}

/* ---------------- 动画姿势 ---------------- */
// 近战：idle 轻微呼吸；attack 前压 → 突进 → 收势；hit/death 后仰/倒地
function meleePose(action, t) {
  let dx = 0, dy = 0, rot = 0, thrust = 0, swing = 0, lean = 0;
  if (action === 'idle') {
    dy = t > 0.5 ? 1 : 0;
    lean = t > 0.5 ? 0.01 : -0.01;
  } else if (action === 'attack') {
    if (t < 0.34) { dx = -3; thrust = -5; swing = -0.18; lean = -0.06; }
    else if (t < 0.72) { dx = 6; thrust = 9; swing = 0.25; lean = 0.1; }
    else { dx = 3; thrust = 2; swing = 0.04; lean = 0.02; }
  } else if (action === 'hit') {
    rot = -0.18 + t * 0.15;
    dx = -6 * (1 - t);
    dy = 1;
  } else if (action === 'death') {
    rot = -0.4 - 1.0 * t;
    dy = 3 * t;
    dx = -3 * t;
  }
  return { dx, dy, rot, thrust, swing, lean };
}

// 远程：抬弓 → 拉弦 → 放箭
function bowPose(action, t) {
  let dx = 0, dy = 0, rot = 0, bowRot = 0, pull = 0, arrowX = 0, arrowVis = true;
  if (action === 'idle') {
    dy = t > 0.5 ? 1 : 0;
  } else if (action === 'attack') {
    if (t < 0.3) { bowRot = -0.22; arrowVis = false; }
    else if (t < 0.62) { bowRot = -0.05; pull = 9; arrowX = -9; }
    else if (t < 0.85) { bowRot = 0.05; pull = 0; arrowX = 13; }
    else { bowRot = 0.12; arrowVis = false; }
  } else if (action === 'hit') {
    rot = -0.18 + t * 0.16;
    dx = -5 * (1 - t);
  } else if (action === 'death') {
    rot = 0.3 + 0.8 * t;
    dy = 4 * t;
    dx = 3 * t;
  }
  return { dx, dy, rot, bowRot, pull, arrowX, arrowVis };
}

function cavalryPose(action, t) {
  let dx = 0, dy = 0, rot = 0, legPhase = 0, weaponRot = -0.5;
  let bowRot = 0, bowPull = 0, bowArrowX = 0, bowArrowVis = true;
  if (action === 'idle') {
    dy = t > 0.5 ? 1 : 0;
    legPhase = t > 0.5 ? 0.5 : 0;
  } else if (action === 'attack') {
    if (t < 0.4) { dx = -5; weaponRot = -1.05; bowRot = -0.18; bowArrowVis = false; }
    else if (t < 0.75) { dx = 7; weaponRot = 0.3; bowRot = -0.04; bowPull = 9; bowArrowX = -8; }
    else { dx = 4; weaponRot = -0.2; bowRot = 0.08; bowArrowX = 13; }
    legPhase = t;
  } else if (action === 'hit') {
    rot = -0.14 + t * 0.12;
    dx = -6 * (1 - t);
  } else if (action === 'death') {
    rot = 0.2 + 0.55 * t;
    dy = 7 * t;
    dx = -3 * t;
  }
  return { dx, dy, rot, legPhase, weaponRot, bowRot, bowPull, bowArrowX, bowArrowVis };
}

/* ---------------- 通用身体部件 ---------------- */
const SKIN = '#c9a07a';
const SKIN_DARK = '#9c7557';
const INK = '#1b2128';

function face(ctx, y = -50, opt = {}) {
  const { skin = SKIN, eye = INK } = opt;
  const { shadow = false, grin = false } = opt;
  const fy = y - 1;
  ell(ctx, 1, fy, 7.0, 7.4, shadow ? '#493726' : skin);
  if (shadow) return;
  // 汉式侧脸：细眉、一点墨眼、鼻侧暗面、短嘴线，12 个兵种不再共用娃娃脸
  ell(ctx, -1.8, fy + 0.8, 2.2, 3.2, 'rgba(74,48,30,0.18)');
  line(ctx, 2.4, fy - 2.2, 5.8, fy - 2.8, eye, 1.2);
  ell(ctx, 4.4, fy - 0.6, 1.0, 0.8, eye);
  line(ctx, 2.8, fy + 3.4, 5.0, fy + 3.2, eye, 1.0);
  if (grin) line(ctx, 3.0, fy + 4.6, 5.4, fy + 4.2, eye, 0.9);
}

function legs(ctx, dark, boot = '#3a2b1c', wrap = null, w = 7.5) {
  rr(ctx, -9, -16, w, 13, 3, dark);
  rr(ctx, 1.5, -16, w, 13, 3, dark);
  if (wrap) {
    [-11.5, -8.5].forEach((yy) => {
      line(ctx, -9, yy, -1.5, yy, wrap, 1.6);
      line(ctx, 2, yy, 9, yy, wrap, 1.6);
    });
  }
  rr(ctx, -10, -5, 10, 5, 2, boot);
  rr(ctx, 1.5, -5, 10, 5, 2, boot);
}

function cloth(ctx, color, dark, top = -38, waist = -13, half = 10) {
  poly(ctx, [[-half, top], [half, top], [half + 2.5, waist], [-half - 2.5, waist]], color);
  poly(ctx, [[-half - 2, waist], [half + 2, waist], [half + 3.5, waist + 4], [-half - 3.5, waist + 4]], dark);
}

function lamellar(ctx, color, dark, top = -36, h = 19, half = 10, rows = 3) {
  rr(ctx, -half, top, half * 2, h, 3, color, dark, 2);
  for (let i = 1; i < rows; i++) line(ctx, -half + 1, top + (h / rows) * i, half - 1, top + (h / rows) * i, dark, 1.2);
  for (let x = -half + 4; x <= half - 4; x += 5) line(ctx, x, top + 1, x, top + h - 1, dark, 1);
}

function shoulderBlocks(ctx, color, dark, y = -41, wide = 9) {
  rr(ctx, -15 - wide * 0.2, y, wide, 7, 2.5, color, dark, 1.4);
  rr(ctx, 6 + wide * 0.2, y, wide, 7, 2.5, color, dark, 1.4);
}

function roundShield(ctx, x, y, r, color, rim, opt = {}) {
  ell(ctx, x, y, r, r * 1.04, color);
  arc(ctx, x, y, r - 0.6, 0, Math.PI * 2, rim, 2.4);
  if (opt.spokes) {
    [-0.6, 0, 0.6].forEach((k) => line(ctx, x + r * k, y - r * 0.85, x + r * k, y + r * 0.85, opt.spokes, 1));
  }
  if (opt.emblem) ell(ctx, x, y, r * 0.32, r * 0.32, opt.emblem);
  if (opt.boss) ell(ctx, x, y, 2.5, 2.5, opt.boss);
}

function towerShield(ctx, x, y, w, h, color, rim, opt = {}) {
  rr(ctx, x - w / 2, y - h / 2, w, h, 3.5, color, rim, 2.4);
  if (opt.stripe) rr(ctx, x - w * 0.18, y - h / 2 + 2, w * 0.36, h - 4, opt.stripe, null);
  if (opt.trim) {
    line(ctx, x - w / 2 + 1, y - h / 2 + 4, x + w / 2 - 1, y - h / 2 + 4, opt.trim, 2);
    line(ctx, x - w / 2 + 1, y + h / 2 - 4, x + w / 2 - 1, y + h / 2 - 4, opt.trim, 2);
  }
}

function strawHat(ctx, y = -61, r = 19, color = '#d8b96e', band = '#9b7432') {
  poly(ctx, [[-r, y], [r, y], [r * 0.55, y - 9], [-r * 0.55, y - 9]], color);
  line(ctx, -r + 1, y, r - 1, y, band, 2);
  ell(ctx, 0, y - 9, r * 0.55, 3.4, color);
  arc(ctx, 0, y, r, 0, Math.PI, band, 1.2);
}

function plume(ctx, x, y, color, h = 15, spread = 3) {
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + i * spread, y - h * 0.55, x + i * spread * 1.7, y - h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
}

/* ---------------- 先登死士：炭黑 + 赤红，矮壮 + 窄长黑盾 + 红竖线 ---------------- */
function drawXiandeng(ctx, p, action, t) {
  const a = meleePose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);
  ctx.translate(0, 2);
  ctx.scale(1, 0.96);

  legs(ctx, '#1f1b18', '#2a2118', '#6f2a24');
  cloth(ctx, '#2b2521', '#171412', -36, -13, 9);
  // 短皮甲 + 红腰带
  rr(ctx, -10, -34, 20, 15, 3, '#332b25', '#171412', 1.8);
  line(ctx, -9, -26, 9, -26, '#6f2a24', 2.2);
  line(ctx, -8, -31, 8, -31, '#171412', 1);
  // 头 + 红布带
  face(ctx, -49);
  poly(ctx, [[-9, -54], [10, -54], [11.5, -58], [-10.5, -58]], '#8c3b32');
  ell(ctx, 2, -59.5, 10, 3, '#8c3b32');
  poly(ctx, [[-10, -57], [-17, -48], [-13, -47], [-7, -54]], '#8c3b32');
  poly(ctx, [[10, -57], [17, -49], [13, -48], [7, -54]], '#8c3b32');
  rankGear(ctx, p, { shoulderY: -35, waistY: -20, headY: -52, side: -1 });

  // 长柄重撞矛：斜握
  ctx.save();
  ctx.translate(8, -30);
  ctx.rotate(-0.82 + a.swing);
  line(ctx, -30, 0, 30, 0, '#5c4528', 3.6);
  poly(ctx, [[30, 0], [39, -4], [39, 4]], '#adafb0', '#6a747f', 1.3);
  line(ctx, 27, 0, 31, 0, '#3d3125', 2);
  ell(ctx, 0, 0, 2.8, 3.2, SKIN);
  ctx.restore();

  // 窄长小黑盾 + 粗红竖线
  towerShield(ctx, 16, -19, 18, 42, '#39312b', '#1b1714', { stripe: '#8c3b32', trim: '#5d3029' });
  line(ctx, 11, -37, 21, -37, '#5d3029', 1.6);
  line(ctx, 11, -1, 21, -1, '#5d3029', 1.6);
  if (action === 'hit') hitFlash(ctx, 0, -30, 16, 21, t);
  ctx.restore();
}

/* ---------------- 藤甲兵：浅藤黄 + 草绿，圆润藤甲 + 大圆藤盾 ---------------- */
function drawTengjia(ctx, p, action, t) {
  const a = meleePose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  legs(ctx, '#6b5a34', '#4c3f24', '#7f6a3c', '#3d3018');
  // 圆润藤甲：躯干 + 一圈圈弧形纹
  ell(ctx, 0, -29, 14, 15, '#b79852');
  ell(ctx, 0, -36, 11, 8, '#c8aa62');
  for (let i = 0; i < 4; i++) {
    arc(ctx, 0, -27 - i * 4, 13 - i * 0.6, 0.15, Math.PI - 0.15, '#7d6334', 1.3);
    arc(ctx, 0, -29 - i * 4, 11 - i * 0.4, Math.PI + 0.15, Math.PI * 2 - 0.15, '#8d713c', 1.1);
  }
  // 草绿披肩
  poly(ctx, [[-13, -40], [12, -40], [10, -34], [-11, -34]], '#6f7d3b');
  // 头（草帽阴影，只露下半张脸）
  face(ctx, -52, { shadow: true });
  strawHat(ctx, -62, 20, '#d4b56a', '#8c6c32');
  line(ctx, -7, -53, 7, -53, '#5d472f', 2);
  rankGear(ctx, p, { shoulderY: -38, waistY: -24, headY: -59, side: -1 });

  // 背后短刀
  ctx.save();
  ctx.translate(-13, -27);
  ctx.rotate(0.55);
  rr(ctx, -2, -2, 5, 20, 2, '#4b3a22');
  poly(ctx, [[-2, 0], [3, -2], [4, 6], [-1, 7]], '#90959a', '#6e7782', 1);
  ctx.restore();

  // 覆盖整个身体的大圆藤盾：同心圆 + 放射藤条
  ctx.save();
  ctx.translate(15, -20);
  ell(ctx, 0, 0, 17, 18, '#c8a75a');
  arc(ctx, 0, 0, 16.4, 0, Math.PI * 2, '#7d6334', 2.2);
  for (let r = 5; r <= 14; r += 4) arc(ctx, 0, 0, r, 0, Math.PI * 2, '#8d713c', 1.1);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    line(ctx, Math.cos(ang) * 4, Math.sin(ang) * 4, Math.cos(ang) * 15, Math.sin(ang) * 15, '#9d8148', 1.1);
  }
  ell(ctx, 0, 0, 3, 3, '#5f4c27');
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, 0, -30, 17, 22, t);
  ctx.restore();
}

/* ---------------- 陷阵营：铁灰 + 暗金，方正铁箱 + 方盾包金 ---------------- */
function drawXianzhen(ctx, p, action, t) {
  const a = meleePose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  legs(ctx, '#2d3542', '#1b222c', '#3b4654');
  lamellar(ctx, '#4b5463', '#252d38', -38, 21, 11, 4);
  // 直角方块肩甲
  rr(ctx, -18, -44, 11, 9, 1, '#556071', '#252d38', 1.6);
  rr(ctx, 7, -44, 11, 9, 1, '#556071', '#252d38', 1.6);
  // 方胸甲 + 金边
  rr(ctx, -9, -35, 18, 14, 1, '#4b5463', '#7a6338', 1.4);
  line(ctx, 0, -34, 0, -22, '#252d38', 1.2);

  // 高筒方形铁盔（平顶）
  face(ctx, -51, { skin: '#d8b18a' });
  rr(ctx, -9, -62, 18, 13, 1, '#5a6473', '#252d38', 1.5);
  rr(ctx, -10, -63, 20, 4, 1, '#6b7686', '#252d38', 1.2);
  line(ctx, -8, -62, 8, -62, '#7a6338', 1.4);
  poly(ctx, [[0, -67], [3.5, -75], [-3.5, -75]], '#6b7686', '#252d38', 1.2);
  rankGear(ctx, p, { shoulderY: -42, waistY: -18, headY: -56, side: -1 });

  // 长戟
  ctx.save();
  ctx.translate(9, -31);
  ctx.rotate(-0.75 + a.swing);
  line(ctx, -32, 0, 32, 0, '#4b3521', 3.2);
  poly(ctx, [[32, 0], [41, -4], [41, 4]], '#adafb0', '#5b6672', 1.2);
  poly(ctx, [[26, -1], [27.5, -10], [31.5, -9], [30.5, -1]], '#bfc9d4', '#5b6672', 1);
  line(ctx, 26, 0, 30, 0, '#7a6338', 1.2);
  ell(ctx, 0, 0, 2.8, 3.2, SKIN);
  ctx.restore();

  // 方大盾 + 暗金包边
  towerShield(ctx, 17, -20, 22, 38, '#3f4754', '#7a6338', { trim: '#b79a5a' });
  rr(ctx, 6, -38, 22, 5, 1, '#7a6338', '#6d5a33', 1);
  line(ctx, 17, -36, 17, -2, '#252d38', 1.4);
  if (action === 'hit') hitFlash(ctx, 0, -30, 17, 22, t);
  ctx.restore();
}

/* ---------------- 青州兵：土赭棕 + 米白，布衣流民 + 铺盖卷 ---------------- */
function drawQingzhou(ctx, p, action, t) {
  const a = meleePose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  legs(ctx, '#7a5c3b', '#5b4328');
  cloth(ctx, '#b08a5c', '#7c5c36', -35, -13, 9);
  // 粗麻短褐 + 腰间麻绳
  poly(ctx, [[-9, -27], [9, -27], [10, -14], [-10, -14]], '#9a7448');
  line(ctx, -9, -18, 9, -17, '#d8c49a', 2);
  ell(ctx, 0, -17, 2, 2, '#6d4e2d');

  // 背后铺盖卷（最大的识别点）
  ctx.save();
  ctx.translate(-12, -34);
  ctx.rotate(-0.35);
  rr(ctx, -6, -7, 13, 14, 5, '#b79a6a', '#6d5636', 1.4);
  line(ctx, -5, -5, 5, -5, '#8a6c45', 1.2);
  line(ctx, -5, 0, 5, 0, '#8a6c45', 1.2);
  line(ctx, -5, 5, 5, 5, '#8a6c45', 1.2);
  ell(ctx, 0, -7, 6, 2.5, '#cbb184');
  ctx.restore();

  // 头：布制软帽 + 米白头巾
  face(ctx, -48, { skin: SKIN_DARK });
  poly(ctx, [[-8, -54], [9, -54], [10, -59], [-9, -59]], '#b9a27c');
  ell(ctx, 2, -60, 9.5, 3, '#cbb184');
  line(ctx, -8, -55, 8, -55, '#7c5c36', 1.4);
  rankGear(ctx, p, { shoulderY: -36, waistY: -17, headY: -51, side: -1 });

  // 长矛斜握
  ctx.save();
  ctx.translate(7, -30);
  ctx.rotate(-0.85 + a.swing);
  line(ctx, -28, 0, 30, 0, '#7d5836', 3);
  poly(ctx, [[30, 0], [37, -3.2], [37, 3.2]], '#90959a', '#7d8792', 1.1);
  ell(ctx, 0, 0, 2.6, 3, SKIN);
  ctx.restore();

  // 腰间环首刀
  ctx.save();
  ctx.translate(-6, -16);
  ctx.rotate(0.42);
  rr(ctx, -3, -1.5, 7, 4, 1.5, '#5b4328');
  poly(ctx, [[3, -2], [17, -4], [18, 0], [3, 2]], '#aeb8c2', '#6e7782', 1);
  ell(ctx, -5, 1, 2.5, 2.5, '#8a6c45');
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, 0, -28, 15, 20, t);
  ctx.restore();
}

/* ---------------- 白毦兵：素白 + 藏青，两侧白毦 + 小白圆盾 ---------------- */
function drawBaier(ctx, p, action, t) {
  const a = meleePose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  legs(ctx, '#25324a', '#182134', '#33425c');
  cloth(ctx, '#e7e9e4', '#c7cbc6', -36, -13, 10);
  // 藏青衬袍 + 白札甲
  poly(ctx, [[-10, -27], [10, -27], [9, -14], [-9, -14]], '#2c3c5c');
  rr(ctx, -10, -35, 20, 15, 3, '#cfc9ba', '#b9c0c2', 1.8);
  for (let y = -32; y <= -23; y += 4) line(ctx, -9, y, 9, y, '#c7cbc6', 1);
  line(ctx, -9, -29, 9, -21, '#dfe4e1', 2);

  // 头 + 两侧白毦（大而蓬松）
  face(ctx, -49);
  rr(ctx, -8, -59, 16, 8, 4, '#dfe4e1', '#a9b2bc', 1.2);
  plume(ctx, -7, -57, '#d5cfc0', 16, 4);
  plume(ctx, 9, -57, '#d5cfc0', 16, 4);
  ell(ctx, -10, -58, 4.5, 4, '#d5cfc0');
  ell(ctx, 11, -58, 4.5, 4, '#d5cfc0');
  line(ctx, -7, -54, 9, -54, '#2c3c5c', 1.4);
  rankGear(ctx, p, { shoulderY: -37, waistY: -17, headY: -54, side: -1 });

  // 短矛
  ctx.save();
  ctx.translate(8, -31);
  ctx.rotate(-0.8 + a.swing);
  line(ctx, -16, 0, 27, 0, '#6d4f31', 2.8);
  poly(ctx, [[27, 0], [36, -3.5], [36, 3.5]], '#e4e9ee', '#777e85', 1.1);
  ell(ctx, 0, 0, 2.7, 3, SKIN);
  ctx.restore();

  // 小圆白盾
  roundShield(ctx, 15, -20, 10, '#cfc9ba', '#2c3c5c', { boss: '#c7cbc6', emblem: '#8a9aac' });
  if (action === 'hit') hitFlash(ctx, 0, -29, 16, 21, t);
  ctx.restore();
}

/* ---------------- 大戟士：青灰 + 石蓝，高大 + 宽肩 + 超长大戟 ---------------- */
function drawDaji(ctx, p, action, t) {
  const a = meleePose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  legs(ctx, '#3c4654', '#242b35', '#4d5967');
  lamellar(ctx, '#566273', '#2c3542', -37, 20, 11, 4);
  // 宽大外扩肩甲
  shoulderBlocks(ctx, '#667386', '#2c3542', -43, 13);
  rr(ctx, -20, -38, 6, 13, 2, '#566273', '#2c3542', 1.2);
  rr(ctx, 14, -38, 6, 13, 2, '#566273', '#2c3542', 1.2);
  // 腰带
  rr(ctx, -11, -18, 22, 4, 2, '#3a3326');
  ell(ctx, 0, -16, 2.4, 2.4, '#a8863f');

  // 尖顶锥形铁盔 + 面甲
  face(ctx, -51, { skin: '#d3ab84' });
  poly(ctx, [[-9, -58], [9, -58], [7, -70], [-7, -70]], '#5f6b7d', '#2c3542', 1.4);
  poly(ctx, [[0, -69], [3, -79], [-3, -79]], '#6f7d90', '#2c3542', 1.2);
  line(ctx, -7, -61, 7, -61, '#a8863f', 1.5);
  rankGear(ctx, p, { shoulderY: -43, waistY: -18, headY: -56, side: -1 });

  // 超长重型大戟：主刃 + 宽横枝
  ctx.save();
  ctx.translate(8, -30);
  ctx.rotate(-0.78 + a.swing);
  line(ctx, -34, 0, 34, 0, '#4d3b25', 3.6);
  poly(ctx, [[34, 0], [44, -5], [44, 5]], '#8b8f94', '#69737e', 1.3);
  poly(ctx, [[28, -1], [29.5, -13], [36, -11], [34.5, -1]], '#c3ceda', '#69737e', 1.1);
  poly(ctx, [[28, 1], [29.5, 13], [36, 11], [34.5, 1]], '#c3ceda', '#69737e', 1.1);
  line(ctx, 30, -10, 35, -9, '#8e99a5', 1);
  line(ctx, 30, 10, 35, 9, '#8e99a5', 1);
  ell(ctx, 0, 0, 2.9, 3.3, SKIN);
  ell(ctx, -7, 0, 2.9, 3.3, SKIN);
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, 0, -30, 18, 23, t);
  ctx.restore();
}

/* ---------------- 丹阳青竹弓手：竹青 + 暖橙，宽斗笠 + 青竹长弓 + 橙箭囊 ---------------- */
function drawQingzhu(ctx, p, action, t) {
  const a = bowPose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  legs(ctx, '#6f7d4a', '#4d5632', '#8a6a42', '#3f3018');
  cloth(ctx, '#7f8d55', '#5a663a', -36, -13, 9);
  // 短褐 + 青绿腰带
  poly(ctx, [[-9, -26], [9, -26], [10, -14], [-10, -14]], '#6f7d4a');
  line(ctx, -9, -18, 9, -18, '#43502f', 2);
  // 橙色箭囊斜挎
  ctx.save();
  ctx.translate(-8, -23);
  ctx.rotate(0.62);
  rr(ctx, -5, -3, 10, 18, 3, '#c65a2c', '#7f3a1d', 1.4);
  line(ctx, -4, 0, 4, 0, '#e98a4e', 1.2);
  for (let i = 0; i < 3; i++) line(ctx, -3 + i * 3, -3, -3 + i * 3, -8, '#d4c4a2', 1.2);
  ctx.restore();

  // 头 + 宽檐竹斗笠
  face(ctx, -48, { skin: SKIN_DARK });
  strawHat(ctx, -61, 21, '#d6bb74', '#8f6e32');
  line(ctx, -9, -52, 8, -52, '#8a6a42', 1.4);
  rankGear(ctx, p, { shoulderY: -36, waistY: -17, headY: -55, side: -1 });

  // 青竹长弓 + 箭
  line(ctx, 4, -36, 14, -32, SKIN_DARK, 3);
  ctx.save();
  ctx.translate(15, -32);
  ctx.rotate(a.bowRot);
  const R = 17;
  arc(ctx, 0, 0, R, -1.2, 1.2, '#6f8b3f', 2.4);
  [-0.85, -0.35, 0.15, 0.65].forEach((ang) => ell(ctx, R * Math.cos(ang), R * Math.sin(ang), 1.5, 1.1, '#3f5528'));
  const tx = R * Math.cos(1.2);
  const ty = R * Math.sin(1.2);
  line(ctx, tx, -ty, -a.pull, 0, '#ded0b2', 1.5);
  line(ctx, -a.pull, 0, tx, ty, '#ded0b2', 1.5);
  if (a.arrowVis) {
    line(ctx, a.arrowX - 8, 0, a.arrowX + 16, 0, '#cdbf9f', 1.8);
    poly(ctx, [[a.arrowX + 16, 0], [a.arrowX + 11, -3], [a.arrowX + 11, 3]], '#b3b6b4');
    poly(ctx, [[a.arrowX - 8, 0], [a.arrowX - 4, -3], [a.arrowX - 4, 3]], '#c65a2c');
  }
  ell(ctx, 0, 0, 2.6, 2.8, SKIN_DARK);
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, 0, -28, 15, 20, t);
  ctx.restore();
}

/* ---------------- 元戎弩士：靛蓝 + 亮银，身前巨型横弩 ---------------- */
function drawYuanyong(ctx, p, action, t) {
  const a = bowPose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  legs(ctx, '#22314a', '#141e30', '#32445f');
  cloth(ctx, '#314463', '#1c2940', -36, -13, 10);
  // 紧身短甲
  rr(ctx, -10, -35, 20, 16, 3, '#3a506f', '#1c2940', 1.4);
  line(ctx, -9, -29, 9, -29, '#8b8f94', 1.2);
  // 窄面护额盔
  face(ctx, -49, { skin: '#d8b18a' });
  rr(ctx, -8.5, -59, 17, 9, 3, '#3a506f', '#1c2940', 1.4);
  rr(ctx, -6, -62, 12, 4, 2, '#8b8f94', '#777e85', 1);
  line(ctx, -8, -56, 8, -56, '#6d829d', 1.2);
  rankGear(ctx, p, { shoulderY: -36, waistY: -18, headY: -54, side: -1 });

  // 身前巨型元戎弩：横置方匣 + 银色弩臂
  line(ctx, 4, -36, 12, -30, SKIN, 3);
  line(ctx, 2, -27, 9, -24, SKIN, 2.8);
  ctx.save();
  ctx.translate(18, -31);
  ctx.rotate(a.bowRot * 0.6);
  rr(ctx, -16, -8, 30, 15, 2.5, '#29415f', '#132238', 1.8);      // 靛蓝弩身
  rr(ctx, -12, -4, 20, 3.5, 1, '#0f1828');                        // 箭槽
  line(ctx, 15, -12, 15, 12, '#8b8f94', 3);                       // 横向弩臂
  line(ctx, 15, -12, -6 - a.pull * 0.6, 0, '#dedbd2', 1.4);       // 弦
  line(ctx, -6 - a.pull * 0.6, 0, 15, 12, '#dedbd2', 1.4);
  line(ctx, -10 - a.pull * 0.5, 0, 3 - a.pull * 0.5, 0, '#9fb0c2', 2);
  if (a.arrowVis) {
    line(ctx, -10 + a.arrowX, 0, 17 + a.arrowX, 0, '#cdbf9f', 1.8);
    poly(ctx, [[17 + a.arrowX, 0], [13 + a.arrowX, -2.6], [13 + a.arrowX, 2.6]], '#e4eaf0');
  }
  ell(ctx, -5, 2, 2.6, 3, SKIN);
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, 0, -29, 16, 21, t);
  ctx.restore();
}

/* ---------------- 无当飞军：石青 + 朱红，尖头巾 + 邪笑 + 短弓 + 红纹盾 ---------------- */
function drawWudang(ctx, p, action, t) {
  const a = bowPose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  legs(ctx, '#3e4b52', '#232d32', '#6f3a30');
  // 赤腿绑裹腿
  line(ctx, -9, -10, -1.5, -10, '#b9a27c', 1.6);
  line(ctx, 2, -10, 9, -10, '#b9a27c', 1.6);
  cloth(ctx, '#5d8a8a', '#3b5d5d', -36, -13, 9);
  rr(ctx, -10, -34, 20, 15, 3, '#557a7b', '#2d4a4b', 1.6);
  line(ctx, -9, -27, 9, -27, '#8c3b32', 1.8);
  // 朱红腰带
  rr(ctx, -10, -18, 20, 4, 2, '#8c3b32');

  // 头 + 尖头布巾 + 邪笑
  face(ctx, -49, { skin: SKIN_DARK, grin: true });
  poly(ctx, [[-8.5, -55], [8.5, -55], [6.5, -62], [0, -69], [-6.5, -62]], '#2d4a4b');
  poly(ctx, [[-8, -54], [8, -54], [9, -58], [-9, -58]], '#8c3b32');
  line(ctx, 0, -63, 0, -69, '#2d4a4b', 1.4);
  rankGear(ctx, p, { shoulderY: -37, waistY: -18, headY: -53, side: 1 });

  // 短弓
  line(ctx, 4, -34, 13, -30, SKIN_DARK, 2.6);
  ctx.save();
  ctx.translate(14, -30);
  ctx.rotate(a.bowRot);
  const R = 13;
  arc(ctx, 0, 0, R, -1.15, 1.15, '#7a4a2a', 2.2);
  const tx = R * Math.cos(1.15);
  const ty = R * Math.sin(1.15);
  line(ctx, tx, -ty, -a.pull, 0, '#d4c4a2', 1.3);
  line(ctx, -a.pull, 0, tx, ty, '#d4c4a2', 1.3);
  if (a.arrowVis) {
    line(ctx, a.arrowX - 7, 0, a.arrowX + 13, 0, '#cdbf9f', 1.6);
    poly(ctx, [[a.arrowX + 13, 0], [a.arrowX + 9, -2.6], [a.arrowX + 9, 2.6]], '#b3b6b4');
  }
  ell(ctx, 0, 0, 2.4, 2.6, SKIN_DARK);
  ctx.restore();

  // 红纹小圆盾
  roundShield(ctx, -14, -21, 10, '#3f4b54', '#1f272d', { emblem: '#8c3b32', boss: '#7a8a8d' });
  if (action === 'hit') hitFlash(ctx, 0, -28, 15, 20, t);
  ctx.restore();
}

/* ---------------- 骑兵通用：马 + 骑手 ---------------- */
function horse(ctx, opt) {
  const {
    color, dark, mane = dark, legPhase = 0, action = 'idle',
    barding = null, faceArmor = null, saddle = '#6a4a2f',
  } = opt;
  // 马尾
  ctx.beginPath();
  ctx.moveTo(-25, -38);
  ctx.quadraticCurveTo(-36, -33 + legPhase * 3, -30, -13);
  ctx.strokeStyle = mane;
  ctx.lineWidth = 4.5;
  ctx.stroke();

  // 马腿
  const legs = [[-15, 0], [-10, 0.15], [11, 0.5], [16, 0.65]];
  legs.forEach(([lx, ph]) => {
    const swing = Math.sin((legPhase + ph) * Math.PI * 2) * (action === 'idle' ? 1.5 : 4.5);
    rr(ctx, lx - 2 + swing * 0.4, -27, 4.5, 25, 2, dark);
    rr(ctx, lx - 3 + swing, -6, 7.5, 6, 2, '#2a2018');
  });

  // 身体
  ell(ctx, -19, -34, 11.5, 11, color);
  ell(ctx, -3, -35, 20, 11.5, color);
  line(ctx, -25, -27, 12, -27, dark, 1.1);
  // 颈 + 头
  poly(ctx, [[7, -42], [14, -39], [30, -48], [22, -56]], color);
  ell(ctx, 32, -49, 8, 5.2, color);
  poly(ctx, [[29, -51], [36, -52.5], [41, -47], [37, -43], [30, -44.5]], color);
  line(ctx, 12, -44, 27, -54, mane, 4);
  poly(ctx, [[27, -54], [28.4, -60], [31.4, -54]], mane);
  ell(ctx, 34, -51, 1.5, 1.5, '#2a2018');
  ell(ctx, 39.5, -46.5, 1, 1, '#2a2018');
  // 鞍褥
  poly(ctx, [[-13, -46], [7, -46], [9, -41], [-14, -41]], saddle);
  line(ctx, -14, -43, 9, -43, '#38281a', 1.2);

  if (barding) {
    poly(ctx, [[14, -38], [25, -36], [26, -27], [15, -25]], barding.fill, barding.stroke, 1.2);
    poly(ctx, [[-20, -39], [6, -39], [7, -27], [-18, -27]], barding.fill, barding.stroke, 1.2);
    [-14, -8, -2].forEach((x) => line(ctx, x, -38, x, -28, barding.stroke, 1.1));
  }
  if (faceArmor) {
    poly(ctx, [[28.5, -52], [35, -54.4], [41.5, -48.6], [38, -44], [30, -45]], faceArmor.fill, faceArmor.stroke, 1.3);
    line(ctx, 33, -51.5, 39.5, -47, faceArmor.trim, 1.2);
    ell(ctx, 34, -51, 1.4, 1.4, '#0e1116');
  }
}

function riderBase(ctx, opt) {
  const { body, dark, armor, armorDark, skin = SKIN, cape = null } = opt;
  // 披风（在身后扬起）
  if (cape) {
    poly(ctx, [[-4, -62], [-26, -54], [-31, -38], [-18, -47], [-2, -50]], cape.fill, cape.stroke, 1.4);
    line(ctx, -24, -52, -29, -40, cape.stroke, 1.2);
  }
  rr(ctx, -6, -50, 6, 12, 3, dark);
  cloth(ctx, body, dark, -64, -47, 8);
  if (armor) {
    rr(ctx, -9, -62, 17, 13, 4, armor, armorDark, 1.2);
    line(ctx, 0, -60, 0, -50, armorDark, 1.2);
  }
}

/* ---------------- 幽州突骑：生铁色 + 浅白披风 + 骑枪 ---------------- */
function drawYouzhou(ctx, p, action, t) {
  const a = cavalryPose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  horse(ctx, {
    color: '#7a5437', dark: '#4a3321', mane: '#d7c9a8',
    legPhase: a.legPhase, action, saddle: '#6b4a2f',
  });

  riderBase(ctx, {
    body: '#4f5a66', dark: '#2c333b', armor: '#596674', armorDark: '#2c333b',
    cape: { fill: '#d8d3c4', stroke: '#a89f8d' },
  });
  // 高尖盔
  face(ctx, -70, { skin: '#d8b18a' });
  poly(ctx, [[-8, -77], [8, -77], [5, -88], [-5, -88]], '#4f5a66', '#2c333b', 1.3);
  line(ctx, -7, -79, 7, -79, '#90959a', 1.2);
  rankGear(ctx, p, { shoulderY: -65, waistY: -49, headY: -78, side: -1, horse: true });

  // 骑枪
  ctx.save();
  ctx.translate(5, -60);
  ctx.rotate(a.weaponRot);
  line(ctx, -18, 0, 32, 0, '#5c4528', 3);
  poly(ctx, [[32, 0], [42, -4], [42, 4]], '#8b8f94', '#69737e', 1.2);
  poly(ctx, [[27, -1.4], [31, -7], [30, 1]], '#8c3b32');
  ell(ctx, 0, 0, 2.8, 3, SKIN);
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, -2, -38, 16, 18, t);
  ctx.restore();
}

/* ---------------- 白马义从：月白 + 鎏金，白马 + 金毛盔 + 骑射 ---------------- */
function drawBaima(ctx, p, action, t) {
  const a = cavalryPose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  horse(ctx, {
    color: '#eeeae0', dark: '#cfc8ba', mane: '#f7f4ea',
    legPhase: a.legPhase, action, saddle: '#c9b27c',
    barding: { fill: '#e6e9e5', stroke: '#9aa9b4' },
  });

  riderBase(ctx, {
    body: '#e7e5dd', dark: '#c5c1b6', armor: '#cfc9ba', armorDark: '#9aa9b4',
    cape: { fill: '#f3f1e8', stroke: '#b9c0c2' },
  });
  // 银盔 + 一撮金毛
  face(ctx, -70, { skin: '#d8b18a' });
  rr(ctx, -8, -80, 16, 9, 3, '#8b8f94', '#777e85', 1.4);
  line(ctx, -7, -78, 7, -78, '#f0d79b', 1.6);
  plume(ctx, 1, -79, '#e8b84a', 12, 3);
  ell(ctx, 1, -81, 4, 3, '#e8b84a');
  rankGear(ctx, p, { shoulderY: -65, waistY: -49, headY: -78, side: -1, horse: true });

  // 骑射
  ctx.save();
  ctx.translate(5, -60);
  ctx.rotate(a.weaponRot);
  if (action === 'attack') {
    ctx.translate(13, -2);
    ctx.rotate(a.bowRot);
    line(ctx, -12, -4, 0, 0, SKIN, 2.8);
    const R = 15;
    arc(ctx, 0, 0, R, -1.15, 1.15, '#c9a55a', 2.4);
    const tx = R * Math.cos(1.15);
    const ty = R * Math.sin(1.15);
    line(ctx, tx, -ty, -a.bowPull, 0, '#ded0b2', 1.4);
    line(ctx, -a.bowPull, 0, tx, ty, '#ded0b2', 1.4);
    if (a.bowArrowVis) {
      line(ctx, a.bowArrowX - 8, 0, a.bowArrowX + 15, 0, '#cdbf9f', 1.7);
      poly(ctx, [[a.bowArrowX + 15, 0], [a.bowArrowX + 10.5, -3], [a.bowArrowX + 10.5, 3]], '#b3b6b4');
    }
    ell(ctx, 0, 0, 2.6, 2.8, SKIN);
  } else {
    // 待机时斜持长枪
    ctx.rotate(-0.5);
    line(ctx, -10, 0, 30, 0, '#c9a55a', 2.8);
    poly(ctx, [[30, 0], [38, -3.4], [38, 3.4]], '#8b8f94', '#777e85', 1.1);
    ell(ctx, 0, 0, 2.6, 2.8, SKIN);
  }
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, -2, -38, 16, 18, t);
  ctx.restore();
}

/* ---------------- 虎豹骑：墨黑 + 灼橙，全包面盔 + 虎纹橙线 + 重甲 ---------------- */
function drawHuhao(ctx, p, action, t) {
  const a = cavalryPose(action, t);
  ctx.save();
  ctx.translate(a.dx, a.dy);
  ctx.rotate(a.rot);

  horse(ctx, {
    color: '#24272d', dark: '#131518', mane: '#3a3f47',
    legPhase: a.legPhase, action, saddle: '#4a2f24',
    barding: { fill: '#2c3037', stroke: '#171a1f' },
    faceArmor: { fill: '#20242a', stroke: '#111419', trim: '#a9703f' },
  });
  // 马身橙色细纹
  line(ctx, -18, -34, 4, -34, '#8c3f22', 1.2);
  line(ctx, -15, -31, 2, -31, '#8c3f22', 1);

  riderBase(ctx, {
    body: '#2c3037', dark: '#171a1f', armor: '#3a4048', armorDark: '#171a1f',
    cape: { fill: '#1e2126', stroke: '#111419' },
  });
  // 封闭式全包面铁盔 + 两道橙色虎纹
  rr(ctx, -9, -82, 18, 15, 4, '#3b4149', '#171a1f', 1.5);
  poly(ctx, [[-9, -69], [9, -69], [7, -64], [-7, -64]], '#2a2f36', '#171a1f', 1.3);
  line(ctx, -7, -77, 3, -73, '#a9703f', 2.2);
  line(ctx, 2, -79, 7, -76, '#a9703f', 1.8);
  line(ctx, -5, -70, 5, -70, '#111419', 1.2);
  // 盔顶红缨
  plume(ctx, 0, -82, '#8c3b32', 11, 3);
  rankGear(ctx, p, { shoulderY: -64, waistY: -49, headY: -75, side: -1, horse: true });

  // 重马槊
  ctx.save();
  ctx.translate(5, -60);
  ctx.rotate(a.weaponRot - 0.08);
  line(ctx, -14, 0, 36, 0, '#3d2b1d', 3.6);
  poly(ctx, [[36, 0], [45, -4.5], [45, 4.5]], '#adafb0', '#5b6672', 1.3);
  poly(ctx, [[30, -1.6], [34, -8], [33, 1]], '#a9703f');
  poly(ctx, [[30, 1.6], [34, 8], [33, -1]], '#a9703f');
  ell(ctx, 0, 0, 3, 3.2, '#c99a72');
  ctx.restore();

  if (action === 'hit') hitFlash(ctx, -2, -38, 16, 18, t);
  ctx.restore();
}

/* ---------------- 等级配件（每 2 级加一件，剪影不变） ---------------- */
// Lv3 腰带/护腕，Lv5 肩甲，Lv7 护膝/披风扣，Lv9 头饰金边 + 侧翎
function rankGear(ctx, p, opt = {}) {
  const lv = p.lv || 1;
  if (lv < 3) return;
  const shoulderY = opt.shoulderY ?? -40;
  const waistY = opt.waistY ?? -18;
  const headY = opt.headY ?? -55;
  const side = opt.side ?? -1;
  const horse = !!opt.horse;
  const bronze = p.bronze || '#a8863f';
  const iron = p.iron || '#90959a';
  const ironDark = p.ironDark || '#6e7782';

  // Lv3：腰带 + 铜扣 + 手腕护带 + 领巾（最容易看见的第一件配件）
  line(ctx, -9, waistY, 9, waistY, p.leather || '#6b4a2f', 2);
  ell(ctx, 0, waistY, 2.2, 2.2, bronze);
  rr(ctx, 5, shoulderY + 9, 5, 4, 1.5, p.leather || '#6b4a2f', p.leatherDark || '#3f2c1c', 1);
  poly(ctx, [[-7, headY + 9], [7, headY + 9], [9, headY + 13], [-9, headY + 13]], p.plumeColor || '#c0554f');
  line(ctx, -7, headY + 10, 7, headY + 10, p.leatherDark || '#3f2c1c', 1);

  // Lv5：两侧加铁肩甲（武器/盾会盖住右侧一部分，左侧仍清晰可见）
  rr(ctx, -15, shoulderY, 8, 7, 2.5, iron, ironDark, 1.2);
  rr(ctx, 7, shoulderY, 8, 7, 2.5, iron, ironDark, 1.2);
  line(ctx, -13, shoulderY + 3, -8, shoulderY + 3, bronze, 1);
  line(ctx, 9, shoulderY + 3, 14, shoulderY + 3, bronze, 1);

  // Lv7：胸前三枚铜扣 + 步兵护膝（骑兵换成马鞍边缘的铜线）
  ell(ctx, -4, waistY - 12, 1.8, 1.8, bronze);
  ell(ctx, 0, waistY - 12, 1.8, 1.8, bronze);
  ell(ctx, 4, waistY - 12, 1.8, 1.8, bronze);
  if (horse) {
    line(ctx, -13, shoulderY + 17, 7, shoulderY + 17, bronze, 1.4);
  } else {
    rr(ctx, -9, -14, 7.5, 4, 2, iron, ironDark, 1);
    rr(ctx, 1.5, -14, 7.5, 4, 2, iron, ironDark, 1);
  }

  // Lv9：头饰金边 + 背后小旗（老兵阶段）
  line(ctx, -7.5, headY - 8, 7.5, headY - 8, bronze, 1.6);
  ell(ctx, 0, headY - 8, 2.2, 1.8, bronze);
  if (lv >= 9) {
    line(ctx, -13, waistY - 1, -13, waistY - 20, '#5c4528', 1.3);
    poly(ctx, [[-13, waistY - 20], [-5, waistY - 17], [-13, waistY - 12]], p.plumeColor || '#c0554f');
  }
}

/* ---------------- 导出 ---------------- */
export const SPECIAL_DRAW = {
  xiandeng: drawXiandeng,
  tengjia: drawTengjia,
  xianzhen: drawXianzhen,
  qingzhou: drawQingzhou,
  baier: drawBaier,
  daji: drawDaji,
  qingzhu: drawQingzhu,
  yuanyong: drawYuanyong,
  wudang: drawWudang,
  youzhou: drawYouzhou,
  baima: drawBaima,
  huhao: drawHuhao,
};
