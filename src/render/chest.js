// 宝箱图标（纯 Canvas 绘制，结算页 / 宝箱页 / 关卡选择页共用）
// 小木箱与金箱不是换色：木箱是「矮胖木板箱 + 平盖 + 麻绳捆扎」，
// 金箱是「高箱体 + 拱形盖 + 金属包角 + 宝石锁 + 顶部冠饰」，轮廓与结构一眼可分。
import { roundRectPath } from './draw.js';

// 两种箱子的结构参数（导出给自动化测试核对「不是只换颜色」）
export const CHEST_MODEL = {
  wood: {
    id: 'wood',
    silhouette: 'squat-crate',
    lid: 'flat-overhang',
    lock: 'rope-knot',
    trim: 'wood-seams',
    heightRatio: 0.8,
    dome: false,
    metalBands: 0,
  },
  gold: {
    id: 'gold',
    silhouette: 'tall-ornate',
    lid: 'arched-dome',
    lock: 'gem-plate',
    trim: 'corner-caps',
    heightRatio: 1,
    dome: true,
    metalBands: 2,
  },
};

// 以 (cx, cy) 为中心画一个宝箱，s 是缩放（1 ≈ 96×72）
export function drawChest(ctx, cx, cy, s = 1, opt = {}) {
  const {
    color = '#c8a86a',
    kind = '',
    alpha = 1,
    open = false,
    glow = true,
  } = opt;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (kind === 'wood') drawWoodChest(ctx, cx, cy, s, open);
  else if (kind === 'gold') drawGoldChest(ctx, cx, cy, s, open, glow);
  else drawClassicChest(ctx, cx, cy, s, { color, open, glow });
  ctx.restore();
}

/* ---------------- 小木箱：矮、平盖、麻绳、木纹、无金属 ---------------- */
function drawWoodChest(ctx, cx, cy, s, open) {
  const w = 92 * s;
  const h = 58 * s;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const bodyY = y + h * 0.34;
  const bodyH = h * 0.62;
  const lidH = h * 0.22;

  // 地面阴影
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.99, w * 0.46, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 箱体：木板拼接
  roundRectPath(ctx, x, bodyY, w, bodyH, 4 * s);
  ctx.fillStyle = '#6b4527';
  ctx.fill();
  ctx.strokeStyle = '#3b2716';
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(38,24,14,0.65)';
  ctx.lineWidth = 1.4 * s;
  for (const k of [0.26, 0.52, 0.78]) {
    ctx.beginPath();
    ctx.moveTo(x + w * k, bodyY + 3 * s);
    ctx.lineTo(x + w * k, bodyY + bodyH - 3 * s);
    ctx.stroke();
  }
  // 板缝高光，让木板看起来有厚度
  ctx.strokeStyle = 'rgba(196,144,86,0.35)';
  ctx.lineWidth = 1 * s;
  for (const k of [0.28, 0.54, 0.8]) {
    ctx.beginPath();
    ctx.moveTo(x + w * k, bodyY + 3 * s);
    ctx.lineTo(x + w * k, bodyY + bodyH - 3 * s);
    ctx.stroke();
  }

  // 平盖：比箱体宽一点，向外探出（木箱的标志性轮廓）
  ctx.save();
  const lidY = open ? y - h * 0.42 : y + h * 0.12;
  if (open) {
    ctx.translate(cx, lidY + lidH);
    ctx.rotate(-0.24);
    ctx.translate(-cx, -(lidY + lidH));
  }
  roundRectPath(ctx, x - 4 * s, lidY, w + 8 * s, lidH, 3 * s);
  ctx.fillStyle = '#8a5b33';
  ctx.fill();
  ctx.strokeStyle = '#3b2716';
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  // 盖面两根横木条
  ctx.strokeStyle = 'rgba(58,37,21,0.7)';
  ctx.lineWidth = 1.4 * s;
  for (const k of [0.3, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(x - 4 * s, lidY + lidH * k);
    ctx.lineTo(x + w + 4 * s, lidY + lidH * k);
    ctx.stroke();
  }
  ctx.restore();

  // 四角铁钉（不是金属包边，只是小钉头）
  ctx.fillStyle = '#2e241b';
  for (const px of [x + 5 * s, x + w - 5 * s]) {
    for (const py of [bodyY + 5 * s, bodyY + bodyH - 5 * s]) {
      ctx.beginPath();
      ctx.arc(px, py, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 麻绳：一道竖捆 + 正面打结，木箱一眼可辨
  ctx.strokeStyle = '#c9a86b';
  ctx.lineWidth = 6 * s;
  ctx.beginPath();
  ctx.moveTo(cx, open ? y - h * 0.36 : y + h * 0.14);
  ctx.lineTo(cx, bodyY + bodyH);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,52,26,0.55)';
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 2 * s, open ? y - h * 0.34 : y + h * 0.16);
  ctx.lineTo(cx - 2 * s, bodyY + bodyH - 2 * s);
  ctx.stroke();
  // 绳结
  ctx.fillStyle = '#d8b982';
  ctx.beginPath();
  ctx.arc(cx, bodyY + bodyH * 0.56, 5.2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a6534';
  ctx.lineWidth = 1.6 * s;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, bodyY + bodyH * 0.6);
  ctx.lineTo(cx - 6 * s, bodyY + bodyH * 0.86);
  ctx.moveTo(cx, bodyY + bodyH * 0.6);
  ctx.lineTo(cx + 5 * s, bodyY + bodyH * 0.88);
  ctx.stroke();
}

/* ---------------- 金箱：高、拱盖、金属包角、宝石锁、冠饰 ---------------- */
function drawGoldChest(ctx, cx, cy, s, open, glow) {
  const w = 96 * s;
  const h = 72 * s;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const bodyY = y + h * 0.38;
  const bodyH = h * 0.56;

  // 金色光晕
  if (glow) {
    const g = ctx.createRadialGradient(cx, cy + h * 0.1, 2 * s, cx, cy + h * 0.1, w * 0.72);
    g.addColorStop(0, 'rgba(238,198,108,0.5)');
    g.addColorStop(1, 'rgba(238,198,108,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.1, w * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }

  // 箱体：金属渐变
  const body = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  body.addColorStop(0, '#b17c24');
  body.addColorStop(0.45, '#e6bd60');
  body.addColorStop(1, '#8a5a16');
  roundRectPath(ctx, x, bodyY, w, bodyH, 6 * s);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = '#f7dc94';
  ctx.lineWidth = 2.4 * s;
  ctx.stroke();

  // 拱形盖：圆弧顶（木箱是平盖，轮廓差别最大）
  ctx.save();
  const lidLift = open ? h * 0.34 : 0;
  ctx.translate(0, -lidLift);
  const lidBottom = bodyY + 2 * s;
  const lidTop = y + h * 0.02;
  ctx.beginPath();
  ctx.moveTo(x - 2 * s, lidBottom);
  ctx.lineTo(x - 2 * s, lidBottom - h * 0.12);
  ctx.quadraticCurveTo(cx, lidTop - h * 0.08, x + w + 2 * s, lidBottom - h * 0.12);
  ctx.lineTo(x + w + 2 * s, lidBottom);
  ctx.closePath();
  const lid = ctx.createLinearGradient(0, lidTop, 0, lidBottom);
  lid.addColorStop(0, '#f4d27c');
  lid.addColorStop(0.55, '#c9952f');
  lid.addColorStop(1, '#8f5d13');
  ctx.fillStyle = lid;
  ctx.fill();
  ctx.strokeStyle = '#ffe9ab';
  ctx.lineWidth = 2.4 * s;
  ctx.stroke();

  // 盖顶冠饰：三个小尖（金箱专属）
  ctx.fillStyle = '#f7d87f';
  ctx.strokeStyle = '#8a5a16';
  ctx.lineWidth = 1.2 * s;
  for (const [dx, dy, r] of [[0, -h * 0.2, 5], [-13, -h * 0.16, 3.4], [13, -h * 0.16, 3.4]]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * s, lidTop + dy * s + 6 * s);
    ctx.lineTo(cx + dx * s - r * s, lidTop + dy * s);
    ctx.lineTo(cx + dx * s + r * s, lidTop + dy * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // 两道金属竖箍 + 铆钉
  for (const k of [0.16, 0.84]) {
    roundRectPath(ctx, x + w * k - 5 * s, bodyY - 2 * s, 10 * s, bodyH + 4 * s, 3 * s);
    ctx.fillStyle = '#f0cc70';
    ctx.fill();
    ctx.strokeStyle = '#7a4d12';
    ctx.lineWidth = 1.4 * s;
    ctx.stroke();
  }

  // 四角包角（木箱没有的结构）
  ctx.fillStyle = '#f7dc94';
  ctx.strokeStyle = '#7a4d12';
  ctx.lineWidth = 1.4 * s;
  for (const [px, py] of [[x, bodyY], [x + w, bodyY], [x, bodyY + bodyH], [x + w, bodyY + bodyH]]) {
    const sx = px === x ? 1 : -1;
    const sy = py === bodyY ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + sx * 13 * s, py);
    ctx.lineTo(px, py + sy * 13 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 宝石锁：菱形金框 + 红色宝石（木箱是麻绳结）
  const lockY = bodyY + bodyH * 0.42;
  ctx.beginPath();
  ctx.moveTo(cx, lockY - 13 * s);
  ctx.lineTo(cx + 12 * s, lockY);
  ctx.lineTo(cx, lockY + 13 * s);
  ctx.lineTo(cx - 12 * s, lockY);
  ctx.closePath();
  ctx.fillStyle = '#ffdf95';
  ctx.fill();
  ctx.strokeStyle = '#7a4d12';
  ctx.lineWidth = 1.8 * s;
  ctx.stroke();
  const gem = ctx.createRadialGradient(cx - 2 * s, lockY - 2 * s, 1, cx, lockY, 8 * s);
  gem.addColorStop(0, '#ff9b8a');
  gem.addColorStop(0.5, '#d8392f');
  gem.addColorStop(1, '#791a18');
  ctx.fillStyle = gem;
  ctx.beginPath();
  ctx.arc(cx, lockY, 5.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,190,0.8)';
  ctx.lineWidth = 1.2 * s;
  ctx.stroke();
}

/* ---------------- 其它宝箱：沿用原来的通用造型 ---------------- */
function drawClassicChest(ctx, cx, cy, s, { color, open, glow }) {
  const w = 96 * s;
  const h = 72 * s;
  const x = cx - w / 2;
  const y = cy - h / 2;

  if (glow) {
    const g = ctx.createRadialGradient(cx, cy + h * 0.1, 2 * s, cx, cy + h * 0.1, w * 0.72);
    g.addColorStop(0, 'rgba(232,180,76,0.45)');
    g.addColorStop(1, 'rgba(232,180,76,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.1, w * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }

  const bodyY = y + h * 0.36;
  const bodyH = h * 0.6;
  roundRectPath(ctx, x, bodyY, w, bodyH, 8 * s);
  ctx.fillStyle = '#553b28';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5 * s;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5 * s;
  for (const k of [0.3, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(x + w * k, bodyY + 4 * s);
    ctx.lineTo(x + w * k, bodyY + bodyH - 4 * s);
    ctx.stroke();
  }

  const lidY = open ? y - h * 0.34 : y + 2 * s;
  const lidH = h * 0.42;
  ctx.save();
  if (open) {
    ctx.translate(cx, lidY + lidH);
    ctx.rotate(-0.28);
    ctx.translate(-cx, -(lidY + lidH));
  }
  roundRectPath(ctx, x, lidY, w, lidH, 8 * s);
  ctx.fillStyle = '#6b4a31';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5 * s;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = color;
  ctx.fillRect(x + w * 0.09, bodyY - 2 * s, w * 0.12, bodyH + 4 * s);
  ctx.fillRect(x + w * 0.79, bodyY - 2 * s, w * 0.12, bodyH + 4 * s);
  roundRectPath(ctx, cx - w * 0.075, open ? bodyY + h * 0.02 : bodyY - h * 0.09, w * 0.15, h * 0.26, 4 * s);
  ctx.fillStyle = color;
  ctx.fill();

  if (open) {
    const og = ctx.createRadialGradient(cx, bodyY, 2 * s, cx, bodyY, w * 0.5);
    og.addColorStop(0, 'rgba(255,232,168,0.85)');
    og.addColorStop(1, 'rgba(255,232,168,0)');
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.ellipse(cx, bodyY, w * 0.42, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
