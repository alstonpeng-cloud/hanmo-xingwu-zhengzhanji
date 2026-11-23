// 攻城器械建模：霹雳车（配重抛石机）与中军鼓吹（战鼓车）。
// 和 heroArt.js 同一套绘制语言：墨线轮廓 + 左上光源三层明暗 + 去饱和国风色板。
// 坐标系：脚底中心 (0,0)，向上为负 y，标准高度 100；调用方按目标像素高度整体缩放。
// 战场、布阵器械面板、兵营器械升级页、战报输出榜图标共用同一份模型。
import { inkShade, inkOutline, isInkFill, mute } from './ink.js';
import { ART as ART_PATHS, drawArt } from './packageArt.js';

const INK = '#241a14';

const WOOD = mute('#7c5a36');
const WOOD_DARK = mute('#4e3823');
const WOOD_LIT = mute('#9a7446', 0.10);
const METAL = mute('#8b8f94');
const METAL_DARK = mute('#575c61');
const STONE = mute('#8d8677');
const STONE_DARK = mute('#615c51');
const BRASS = mute('#c2a052');
const BRASS_DARK = mute('#8e6f30');
const DRUM_RED = mute('#96463a');
const DRUM_DARK = mute('#672e27');
const HIDE = mute('#d9c49a');
const HIDE_DARK = mute('#b39c72');
const ROPE = mute('#b8a377');

/* ---------------- 绘制原语（与 heroArt 同口径） ---------------- */

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
  if (isInkFill(fill) && Math.abs(w) >= 9 && Math.abs(h) >= 9) {
    inkShade(ctx, x, y, w, h);
    inkOutline(ctx, !!stroke, lw);
  }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/* ---------------- 公共零件 ---------------- */

// 木轮：轮辋 + 辐条 + 铁毂（近端 / 远端各一只，做出车体纵深）
function wheel(ctx, cx, cy, r, spoke) {
  ell(ctx, cx, cy, r, r, WOOD_DARK, INK, 1.4);
  ell(ctx, cx, cy, r * 0.76, r * 0.76, WOOD, INK, 1);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    line(ctx, cx, cy, cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72,
      spoke, Math.max(1.4, r * 0.15));
  }
  ell(ctx, cx, cy, r * 0.22, r * 0.22, METAL, INK, 1);
}

// 阵营旗：旗杆立在车尾，旗面向后（背敌一侧）飘
function flag(ctx, x, yBase, yTop, t, color) {
  line(ctx, x, yBase, x, yTop, WOOD_DARK, 3);
  const f = Math.sin(t * 2.6) * 4;
  const y0 = yTop + 3;
  poly(ctx, [[x, y0], [x - 24 + f, y0 + 3], [x - 17 + f, y0 + 8], [x - 24 + f, y0 + 13], [x, y0 + 16]], color);
  ell(ctx, x, yTop, 2.4, 2.4, BRASS, INK, 0.8);
}

/* ---------------- 霹雳车（配重抛石机） ---------------- */

// 开火动画曲线：fire ∈ [0,1]（0 = 开火当帧，1 = 动画结束）。
// 释放瞬间抛臂甩满（配重下坠、长端上扬），随后按三次方余速回弹归零。
export function thunderKick(fire) {
  if (!(fire < 1)) return 0;
  return 1.25 * Math.pow(1 - Math.max(0, fire), 3);
}

function drawThunder(ctx, t, color, fire = 0) {
  // 接地阴影
  ell(ctx, 0, 2, 34, 7.5, 'rgba(0,0,0,0.30)');
  // 旗在车体后面：旗杆只露在车体上方，被配重箱挡住时读起来是正确遮挡关系
  flag(ctx, -31, -27, -74, t, color);
  // 远端车轮（浅一档做纵深）
  wheel(ctx, -14, -9, 8.5, WOOD_DARK);
  // 底盘：木板 + 板缝 + 受光面
  rr(ctx, -31, -27, 62, 17, 3, WOOD, INK, 1.3);
  line(ctx, -27, -24, 27, -24, 'rgba(255,240,210,0.14)', 1.4);
  line(ctx, -12, -26, -12, -11, 'rgba(36,26,20,0.35)', 1.2);
  line(ctx, 6, -26, 6, -11, 'rgba(36,26,20,0.35)', 1.2);
  // 近端车轮（压在底盘前面）
  wheel(ctx, 16, -9, 10, METAL_DARK);

  // A 形木架 + 横撑 + 轴承
  poly(ctx, [[-24, -27], [-17, -27], [-6, -63], [-11, -63]], WOOD_DARK);
  poly(ctx, [[14, -27], [21, -27], [2, -63], [-3, -63]], WOOD);
  rr(ctx, -16, -46, 30, 6, 2, WOOD_DARK, INK, 1);
  ell(ctx, -4.5, -63, 5, 5, METAL_DARK, INK, 1.2);
  ell(ctx, -4.5, -63, 2, 2, METAL, null);
  // 拉索
  line(ctx, -4.5, -63, 26, -27, ROPE, 1.6);
  line(ctx, -4.5, -63, -24, -27, ROPE, 1.6);

  // 抛臂组：绕轴小幅摆动（呼吸）+ 开火甩臂（fire 越接近 0 甩得越高，回弹归零）
  ctx.save();
  ctx.translate(-4.5, -63);
  ctx.rotate(Math.sin(t * 1.5) * 0.035 - thunderKick(fire));
  line(ctx, -20, 16, 42, -36, INK, 9.5);
  line(ctx, -20, 16, 42, -36, WOOD, 7);
  line(ctx, -18, 13, 37, -33, 'rgba(255,240,210,0.16)', 1.6);
  // 配重箱（短端）
  rr(ctx, -30, 14, 20, 22, 3, WOOD_DARK, INK, 1.3);
  line(ctx, -30, 21, -10, 21, METAL, 2.4);
  line(ctx, -30, 30, -10, 30, METAL, 2.4);
  // 吊索 + 石弹（长端）
  ctx.beginPath();
  ctx.moveTo(42, -36);
  ctx.quadraticCurveTo(50, -26, 51, -16);
  ctx.strokeStyle = ROPE;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ell(ctx, 51, -11, 7, 6.5, STONE, INK, 1.2);
  ell(ctx, 49, -13.5, 2.4, 2, 'rgba(255,246,214,0.35)');
  ctx.restore();

  // 弹药堆
  ell(ctx, -20, -31, 7, 5.5, STONE, INK, 1.1);
  ell(ctx, -9, -32, 5.5, 4.5, STONE_DARK, INK, 1.1);

  // 朝敌一侧的挡板（阵营色包边）
  poly(ctx, [[26, -27], [36, -25], [36, -12], [26, -10]], WOOD_DARK);
  line(ctx, 34, -23, 34, -13, color, 2.6);
}

/* ---------------- 中军鼓吹（战鼓车） ---------------- */

function drawDrum(ctx, t, color) {
  // 接地阴影
  ell(ctx, 0, 2, 31, 7, 'rgba(0,0,0,0.30)');
  flag(ctx, -27, -25, -68, t, color);
  // 远端车轮
  wheel(ctx, -12, -8, 8, WOOD_DARK);
  // 车盘
  rr(ctx, -29, -25, 58, 15, 3, WOOD, INK, 1.3);
  line(ctx, -25, -22, 25, -22, 'rgba(255,240,210,0.14)', 1.3);
  line(ctx, -4, -24, -4, -11, 'rgba(36,26,20,0.35)', 1.2);
  wheel(ctx, 14, -8, 9.5, METAL_DARK);

  // 鼓架：两根立柱 + 顶梁
  poly(ctx, [[-20, -25], [-14, -25], [-11, -58], [-16, -58]], WOOD_DARK);
  poly(ctx, [[8, -25], [14, -25], [11, -58], [6, -58]], WOOD);
  rr(ctx, -20, -62, 34, 6, 2, WOOD_DARK, INK, 1);

  // 鼓身（在鼓面后面，红漆 + 两道鼓箍）
  rr(ctx, 4, -95, 26, 36, 7, DRUM_RED, INK, 1.3);
  line(ctx, 10, -93, 10, -61, DRUM_DARK, 2.2);
  line(ctx, 24, -93, 24, -61, DRUM_DARK, 2.2);

  // 鼓面（朝向观者）：红漆圈 + 皮面 + 铜钉 + 鼓心
  ell(ctx, -4, -76, 24, 24, DRUM_RED, INK, 1.4);
  ell(ctx, -4, -76, 19.5, 19.5, HIDE, INK, 1.1);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.4;
    ell(ctx, -4 + Math.cos(a) * 21.6, -76 + Math.sin(a) * 21.6, 2, 2, BRASS, INK, 0.7);
  }
  ell(ctx, -4, -76, 7.5, 7.5, HIDE_DARK, INK, 0.9);
  ell(ctx, -4, -76, 2.6, 2.6, DRUM_DARK, null);

  // 鼓槌：交叉搭在鼓面上（轻点时微微起落）
  const lift = Math.sin(t * 2.2) * 1.4;
  line(ctx, -22, -62, 12, -84 - lift, INK, 5.4);
  line(ctx, -22, -62, 12, -84 - lift, WOOD_LIT, 3.4);
  ell(ctx, 13, -85 - lift, 3, 3, WOOD_DARK, INK, 0.8);
  line(ctx, -18, -88 + lift, 14, -64, INK, 5.4);
  line(ctx, -18, -88 + lift, 14, -64, WOOD_LIT, 3.4);
  ell(ctx, 15, -63, 3, 3, WOOD_DARK, INK, 0.8);

  // 号角：斜挂在鼓架右侧，喇叭口朝下
  ctx.beginPath();
  ctx.moveTo(16, -60);
  ctx.quadraticCurveTo(34, -54, 40, -34);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 6.5;
  ctx.stroke();
  ell(ctx, 41, -31, 6.5, 7.5, BRASS, INK, 1.2);
  ell(ctx, 42, -30, 3.2, 4.2, BRASS_DARK, null);
  ell(ctx, 16, -60, 3.4, 3.4, BRASS_DARK, INK, 0.9);
}

/* ---------------- 中军鼓吹增益范围圈 ---------------- */

// 鼓吹光环范围可视化：地面透视椭圆 + 呼吸渐变 + 虚线流转边界。
// 战斗页与部署页共用；半径一律传 engineStats().auraRadius 换算后的像素，与伤害判定同源。
export function drawAuraRing(ctx, opts = {}) {
  const { x = 0, y = 0, r, ry = null, alpha = 1, t = 0 } = opts;
  if (!(r > 0)) return;
  const ryPx = ry == null ? r * 0.45 : ry;
  const breathe = 0.82 + Math.sin(t * 2.2) * 0.18;
  ctx.save();
  const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0, `rgba(255,216,108,${(0.16 * alpha * breathe).toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,216,108,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, ryPx, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([7, 6]);
  ctx.lineDashOffset = -((t * 14) % 13);
  ctx.strokeStyle = `rgba(255,222,130,${(0.55 * alpha * breathe).toFixed(3)})`;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

/* ---------------- 入口 ---------------- */

// 画一台器械。size = 模型像素高度（脚底到顶端），默认 100。
// flip = true 时水平镜像（敌方朝向相反）；color = 阵营旗颜色；t = 页面时钟（飘旗 / 摆臂用）。
// fire = 开火动画进度（霹雳车专用，0 = 开火当帧甩臂）。
export function drawEngineFigure(ctx, engineId, opts = {}) {
  const { x = 0, y = 0, size = 100, flip = false, t = 0, color = '#5f90b8', alpha = 1, fire = 0 } = opts;
  if (engineId !== 'thunder' && engineId !== 'drum') return;
  // 板块 3/4：3D 器械建模位图。霹雳车开火当帧（fire>0）保留程序化甩臂动画，
  // 其余帧用位图；未就绪则整体回退原建模。
  const artId = engineId === 'thunder' ? 'catapult' : 'war_drum';
  if (fire <= 0 && drawArt(ctx, ART_PATHS.siege(artId), x, y - size * 0.5,
    size * 1.3, size * 1.3, { flip, alpha, shadow: 8 })) return;
  const k = size / 100;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(flip ? -k : k, k);
  if (engineId === 'thunder') drawThunder(ctx, t, color, fire);
  else drawDrum(ctx, t, color);
  ctx.restore();
}
