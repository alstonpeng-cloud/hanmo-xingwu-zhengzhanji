// 汉末军伍 · 普通兵种造型（曲线汉俑风）
//
// 契约：导出 4 个 draw(ctx, p, action, t)，脚底为原点 (0,0)，向上为负。
// 与旧实现的差别：不再用「直角多边形 + 圆角矩形 + 正圆」逐层堆零件，
// 改用连续曲线勾出人体剪影，再在整体轮廓内做明暗与衣甲层次。
//
// 四条兵线共用同一套色板（暖褐 / 墨灰 / 暗朱），色调完全一致；
// 靠剪影、兵器、姿态区分，不靠色相。服制参照汉末：交领右衽短褐、
// 袴与行縢、平巾帻 / 武弁 / 兜鍪、皮甲与札甲、披膊、环首刀、
// 反曲角弓、长矛、木马鞍。面部无眼，靠眉骨与鼻颌暗影交代体积。

/* ---------------- 统一色板 ---------------- */

const INK = 'rgba(31,24,17,0.60)';        // 墨线：深褐，不是纯黑
const INK_SOFT = 'rgba(31,24,17,0.32)';
const LIT = 'rgba(240,224,193,';          // 左上受光（拼接 alpha）
const SHADE = 'rgba(21,16,11,';           // 右下背光（拼接 alpha）

const CLOTH = '#6d5c46';                  // 袍：茶褐
const CLOTH_L = '#897359';
const CLOTH_D = '#4a3e2f';
const SKIN = '#c2a07b';                   // 肤：暖土黄，不粉不白
const SKIN_SHADOW = 'rgba(96,64,40,0.24)';
const LEATHER = '#584632';
const LEATHER_D = '#3a3022';
const ARMOR = '#5f5d51';                  // 墨灰（暖调，绝不偏蓝）
const ARMOR_L = '#7d7968';
const ARMOR_D = '#403e35';
const WOOD = '#6a4d31';
const WOOD_D = '#45321f';
const METAL = '#8b8677';                  // 哑光铁
const METAL_D = '#59554b';
const ACCENT = '#8a4234';                 // 暗朱：盔缨 / 盾纹 / 枪缨，面积极小
const HEMP = '#9b8867';                   // 麻绳 / 行縢
const HORSE = '#5b4a38';
const HORSE_L = '#73604a';
const HORSE_D = '#3c3125';

/* ---------------- 曲线原语 ---------------- */

// 一段路径：build(ctx) 自己负责 closePath；fill / stroke 可选。
function shape(ctx, build, fill, stroke = INK, lw = 1.05) {
  ctx.beginPath();
  build(ctx);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

// 有体积的形状：填固有色 → clip 到轮廓 → 斜向连续明暗 → 沿轮廓描墨线。
// 明暗用渐变而不是左右两块 fillRect，避免出现一条硬生生的竖直分界线。
function vol(ctx, build, base, opt = {}) {
  const lit = opt.lit === undefined ? 1 : opt.lit;
  const shade = opt.shade === undefined ? 1 : opt.shade;
  const stroke = opt.stroke === undefined ? INK : opt.stroke;
  ctx.save();
  ctx.beginPath();
  build(ctx);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.clip();
  let grad = null;
  try {
    const g = ctx.createLinearGradient(-42, -80, 36, 6);
    g.addColorStop(0, `rgba(244,229,199,${(0.19 * lit).toFixed(3)})`);
    g.addColorStop(0.42, 'rgba(244,229,199,0.015)');
    g.addColorStop(0.60, 'rgba(21,16,11,0.015)');
    g.addColorStop(1, `rgba(21,16,11,${(0.31 * shade).toFixed(3)})`);
    grad = g;
  } catch (_) { grad = null; }
  if (grad) {
    ctx.fillStyle = grad;
    ctx.fillRect(-48, -88, 100, 100);
  } else {
    ctx.fillStyle = `${LIT}${(0.12 * lit).toFixed(3)})`;
    ctx.fillRect(-48, -88, 46, 100);
    ctx.fillStyle = `${SHADE}${(0.20 * shade).toFixed(3)})`;
    ctx.fillRect(-2, -88, 52, 100);
  }
  ctx.restore();
  if (stroke) {
    ctx.beginPath();
    build(ctx);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = opt.lw || 1.15;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function strokePath(ctx, build, color, lw = 1.4) {
  ctx.beginPath();
  build(ctx);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function dot(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// 一段有粗细变化的肢体（袖 / 臂 / 腿），用两条相向曲线围成纺锤形。
function limb(ctx, x1, y1, x2, y2, w1, w2, fill, bend = 0, stroke = INK_SOFT) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mx = (x1 + x2) / 2 + nx * bend;
  const my = (y1 + y2) / 2 + ny * bend;
  shape(ctx, (c) => {
    c.moveTo(x1 + nx * w1, y1 + ny * w1);
    c.quadraticCurveTo(mx + nx * ((w1 + w2) / 2), my + ny * ((w1 + w2) / 2), x2 + nx * w2, y2 + ny * w2);
    c.quadraticCurveTo(x2 - nx * w2, y2 - ny * w2, x2 - nx * w2, y2 - ny * w2);
    c.quadraticCurveTo(mx - nx * ((w1 + w2) / 2), my - ny * ((w1 + w2) / 2), x1 - nx * w1, y1 - ny * w1);
    c.closePath();
  }, fill, stroke, 0.95);
}

// 握拳的手：小圆 + 一道指节暗线
function fist(ctx, x, y, r = 2.9) {
  dot(ctx, x, y, r, SKIN);
  strokePath(ctx, (c) => {
    c.moveTo(x - r * 0.6, y + r * 0.35);
    c.quadraticCurveTo(x, y + r * 0.75, x + r * 0.6, y + r * 0.2);
  }, SKIN_SHADOW, 0.8);
}

/* ---------------- 人体：腿 / 袍 / 甲 / 头 ---------------- */

// 袴 + 行縢 + 圆头履。两条裤管都带弧线，不是等宽圆柱。
function drawLegs(ctx, p, { stride = 0, hide = false } = {}) {
  if (hide) return;
  const lv = p.lv;
  const back = stride * 1.6;
  // 后腿（略暗，压在袍下）
  limb(ctx, -5.5, -22, -7 - back, -3.2, 4.6, 3.3, CLOTH_D, -0.6, INK_SOFT);
  // 前腿
  limb(ctx, 5.5, -22, 7 + back, -3.2, 4.8, 3.5, CLOTH, 0.5, INK_SOFT);
  // 行縢：Lv3 起斜缠三道，顺腿形而不是水平等距线
  if (lv >= 3) {
    for (let i = 0; i < 3; i++) {
      const yy = -15 + i * 3.6;
      strokePath(ctx, (c) => {
        c.moveTo(-10.3, yy + 0.9);
        c.quadraticCurveTo(-6.5, yy - 0.7, -3.2, yy - 1.4);
      }, HEMP, 1.25);
      strokePath(ctx, (c) => {
        c.moveTo(3.2, yy - 1.4);
        c.quadraticCurveTo(6.5, yy - 0.6, 10.4, yy + 1.0);
      }, HEMP, 1.25);
    }
  }
  // 圆头履：前端微翘，不是圆柱加椭圆
  shape(ctx, (c) => {
    c.moveTo(-10.5, -4.2);
    c.quadraticCurveTo(-10.8, -0.6, -7.6, -0.2);
    c.quadraticCurveTo(-3.2, 0.2, -2.4, -1.6);
    c.quadraticCurveTo(-2.2, -4.2, -3.4, -4.6);
    c.closePath();
  }, lv >= 7 ? LEATHER_D : WOOD_D, INK, 1.0);
  shape(ctx, (c) => {
    c.moveTo(2.4, -4.6);
    c.quadraticCurveTo(3.2, -4.2, 3.4, -1.6);
    c.quadraticCurveTo(4.4, 0.2, 8.8, -0.2);
    c.quadraticCurveTo(12.0, -0.6, 11.7, -4.2);
    c.closePath();
  }, lv >= 7 ? LEATHER_D : WOOD_D, INK, 1.0);
  // 履面一道浅线
  strokePath(ctx, (c) => { c.moveTo(-9, -2.4); c.quadraticCurveTo(-6, -3.2, -3.4, -2.6); }, CLOTH_L, 0.7);
  strokePath(ctx, (c) => { c.moveTo(3.6, -2.6); c.quadraticCurveTo(7, -3.2, 10.4, -2.4); }, CLOTH_L, 0.7);
}

// 交领右衽短褐：一条连续曲线勾出圆肩 / 收腰 / 外张下摆。
function robePath(c, { narrow = 0, short = 0 } = {}) {
  const sh = 13.5 - narrow;       // 肩半宽
  const hem = 15.5 - narrow;      // 摆半宽
  const top = -43;
  const bottom = -12 + short;
  c.moveTo(-7.5, top);
  c.quadraticCurveTo(-sh - 1, top + 1, -sh, -36.5);
  c.quadraticCurveTo(-sh + 1.5, -30, -10.6 - narrow, -25.5);
  c.quadraticCurveTo(-hem + 1, -19, -hem, bottom + 2.5);
  c.quadraticCurveTo(-8, bottom + 5, 0, bottom + 4.2);
  c.quadraticCurveTo(8, bottom + 5, hem, bottom + 2.5);
  c.quadraticCurveTo(hem - 1, -19, 10.6 + narrow, -25.5);
  c.quadraticCurveTo(sh - 1.5, -30, sh, -36.5);
  c.quadraticCurveTo(sh + 1, top + 1, 7.5, top);
  c.quadraticCurveTo(0, top - 2.4, -7.5, top);
  c.closePath();
}

function drawRobe(ctx, p, opt = {}) {
  vol(ctx, (c) => robePath(c, opt), CLOTH, { lit: 1.05, shade: 1.0 });
  // 交领右衽：右颈斜下到左腰的襟带 + 一道浅色领缘
  shape(ctx, (c) => {
    c.moveTo(6.8, -42.4);
    c.quadraticCurveTo(1.0, -37.5, -2.6, -31.0);
    c.lineTo(-6.2, -27.2);
    c.quadraticCurveTo(-1.0, -31.8, 3.0, -38.0);
    c.closePath();
  }, CLOTH_D, INK_SOFT, 0.8);
  strokePath(ctx, (c) => {
    c.moveTo(-7.0, -42.0);
    c.quadraticCurveTo(-1.5, -36.0, -5.4, -27.6);
  }, CLOTH_L, 1.15);
  // 衣褶：顺着体型走的三条弧，不再等距竖线
  strokePath(ctx, (c) => { c.moveTo(-8.0, -24.5); c.quadraticCurveTo(-9.6, -18.5, -11.4, -13.2); }, 'rgba(28,21,13,0.26)', 0.95);
  strokePath(ctx, (c) => { c.moveTo(1.0, -23.5); c.quadraticCurveTo(0.4, -18.0, -0.2, -11.8); }, 'rgba(240,224,193,0.10)', 0.95);
  strokePath(ctx, (c) => { c.moveTo(8.6, -24.5); c.quadraticCurveTo(10.0, -18.5, 11.8, -13.2); }, 'rgba(28,21,13,0.26)', 0.95);
  // 束带 + 带扣：Lv2 起
  if (p.lv >= 2) {
    strokePath(ctx, (c) => {
      c.moveTo(-11.6, -25.0);
      c.quadraticCurveTo(0, -23.4, 11.6, -25.0);
    }, LEATHER_D, 2.6);
    dot(ctx, 0, -24.2, 1.7, p.lv >= 6 ? METAL : LEATHER);
  }
}

// 胸廓路径（甲片会被 clip 到这里面，贴合身体，不会浮空成砖墙）
function chestPath(c) {
  c.moveTo(-9.6, -40.5);
  c.quadraticCurveTo(-11.4, -34, -10.2, -27.2);
  c.quadraticCurveTo(0, -25.4, 10.2, -27.2);
  c.quadraticCurveTo(11.4, -34, 9.6, -40.5);
  c.quadraticCurveTo(0, -42.6, -9.6, -40.5);
  c.closePath();
}

function drawArmor(ctx, p) {
  const lv = p.lv;
  if (lv < 3) return;
  if (lv < 8) {
    // 革甲：整片随胸廓，两道缝线 + 肩带
    vol(ctx, chestPath, LEATHER, { lit: 0.9, shade: 1.0 });
    strokePath(ctx, (c) => { c.moveTo(-9.4, -35.2); c.quadraticCurveTo(0, -33.8, 9.4, -35.2); }, LEATHER_D, 1.0);
    strokePath(ctx, (c) => { c.moveTo(-9.8, -30.5); c.quadraticCurveTo(0, -29.3, 9.8, -30.5); }, LEATHER_D, 1.0);
    strokePath(ctx, (c) => { c.moveTo(-6.4, -40.4); c.quadraticCurveTo(-7.2, -35, -7.0, -28.2); }, LEATHER_D, 1.5);
    strokePath(ctx, (c) => { c.moveTo(6.4, -40.4); c.quadraticCurveTo(7.2, -35, 7.0, -28.2); }, LEATHER_D, 1.5);
    dot(ctx, 0, -33.0, 1.9, METAL_D);
    return;
  }
  // 札甲：底甲 + 纵向长甲片（弧顶、错缝），全部 clip 在胸廓内
  vol(ctx, chestPath, ARMOR_D, { lit: 0.6, shade: 0.8 });
  ctx.save();
  ctx.beginPath();
  chestPath(ctx);
  ctx.clip();
  const cols = 5, rows = 3;
  const pw = 4.5, ph = 4.6;
  for (let r = 0; r < rows; r++) {
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const px = -11.2 + cIdx * pw + (r % 2 ? 0.9 : 0);
      const py = -41.0 + r * ph;
      shape(ctx, (c) => {
        c.moveTo(px, py + ph - 0.5);
        c.lineTo(px, py + 1.3);
        c.quadraticCurveTo(px + pw / 2, py - 0.4, px + pw - 0.5, py + 1.3);
        c.lineTo(px + pw - 0.5, py + ph - 0.5);
        c.quadraticCurveTo(px + pw / 2, py + ph + 0.6, px, py + ph - 0.5);
        c.closePath();
      }, ARMOR, INK_SOFT, 0.7);
      // 甲片顶端一道极淡高光
      strokePath(ctx, (c) => {
        c.moveTo(px + 0.7, py + 1.5);
        c.quadraticCurveTo(px + pw / 2, py + 0.5, px + pw - 1.0, py + 1.5);
      }, ARMOR_L, 0.6);
    }
  }
  ctx.restore();
  // 束甲带 + 小护心（不是大圆镜）
  strokePath(ctx, (c) => { c.moveTo(-10.4, -31.2); c.quadraticCurveTo(0, -29.8, 10.4, -31.2); }, LEATHER_D, 2.0);
  shape(ctx, (c) => {
    c.moveTo(-2.6, -34.4);
    c.quadraticCurveTo(0, -36.0, 2.6, -34.4);
    c.quadraticCurveTo(2.4, -31.4, 0, -30.8);
    c.quadraticCurveTo(-2.4, -31.4, -2.6, -34.4);
    c.closePath();
  }, METAL_D, INK_SOFT, 0.8);
  if (p.veteran) {
    strokePath(ctx, (c) => { c.moveTo(-6, -37); c.quadraticCurveTo(-3, -36, -1, -37.6); }, 'rgba(240,224,193,0.20)', 0.8);
  }
}

// 披膊：贴肩的两片叠瓦，沿肩弧向下垂，不再向外张成刺猬
function drawPauldron(ctx, p) {
  const lv = p.lv;
  if (lv < 5) return;
  const mat = lv >= 8 ? ARMOR : LEATHER;
  const edge = lv >= 8 ? ARMOR_D : LEATHER_D;
  for (const side of [-1, 1]) {
    shape(ctx, (c) => {
      c.moveTo(side * 7.6, -41.2);
      c.quadraticCurveTo(side * 13.6, -40.4, side * 15.0, -35.6);
      c.quadraticCurveTo(side * 14.0, -31.8, side * 10.2, -31.0);
      c.quadraticCurveTo(side * 8.0, -35.0, side * 7.4, -38.6);
      c.closePath();
    }, mat, edge, 0.9);
    strokePath(ctx, (c) => {
      c.moveTo(side * 9.0, -38.4);
      c.quadraticCurveTo(side * 12.4, -37.0, side * 13.8, -34.4);
    }, 'rgba(244,229,199,0.14)', 0.9);
    if (lv >= 8) {
      strokePath(ctx, (c) => {
        c.moveTo(side * 10.0, -35.4);
        c.quadraticCurveTo(side * 12.0, -34.6, side * 13.6, -33.0);
      }, edge, 0.8);
    }
  }
}

// 头：颈 + 3/4 侧脸（无眼，靠额—眉骨—鼻梁—唇颌的轮廓起伏与暗面交代体积）
function drawHead(ctx, p, y = -52, opt = {}) {
  const lv = p.lv;
  // 颈：带喉侧暗面，不再是脖子上一块方色
  shape(ctx, (c) => {
    c.moveTo(-3.8, y + 4.8);
    c.quadraticCurveTo(-3.4, y + 8.6, -6.6, y + 10.2);
    c.quadraticCurveTo(0, y + 11.6, 6.0, y + 10.2);
    c.quadraticCurveTo(3.2, y + 8.6, 3.6, y + 4.8);
    c.closePath();
  }, SKIN, INK_SOFT, 0.8);
  strokePath(ctx, (c) => {
    c.moveTo(-2.2, y + 6.2);
    c.quadraticCurveTo(-1.0, y + 9.2, -4.4, y + 10.0);
  }, SKIN_SHADOW, 1.5);

  // 侧脸轮廓：额头 → 眉骨 → 鼻梁 → 鼻尖 → 鼻底 → 唇 → 颏 → 下颌 → 颊 → 耳后
  const faceBuild = (c) => {
    c.moveTo(-6.4, y - 5.8);                                  // 额顶（被头巾压住）
    c.quadraticCurveTo(-0.6, y - 8.8, 4.8, y - 6.2);         // 额线
    c.quadraticCurveTo(6.8, y - 4.6, 6.6, y - 2.8);          // 眉骨
    c.quadraticCurveTo(6.0, y - 1.4, 6.6, y - 0.6);          // 鼻根
    c.quadraticCurveTo(8.8, y + 1.0, 8.4, y + 1.8);          // 鼻尖前突
    c.quadraticCurveTo(7.4, y + 2.6, 6.2, y + 2.6);          // 鼻底
    c.quadraticCurveTo(6.8, y + 3.4, 6.0, y + 3.9);          // 上唇
    c.quadraticCurveTo(6.4, y + 4.8, 5.2, y + 5.2);          // 下唇
    c.quadraticCurveTo(5.6, y + 6.8, 2.2, y + 7.0);          // 颏
    c.quadraticCurveTo(-2.8, y + 6.8, -5.4, y + 4.2);        // 下颌
    c.quadraticCurveTo(-7.4, y + 1.0, -6.8, y - 2.2);        // 颊
    c.quadraticCurveTo(-7.6, y - 4.4, -6.4, y - 5.8);        // 耳后
    c.closePath();
  };
  vol(ctx, faceBuild, SKIN, { lit: 0.9, shade: 1.15, lw: 1.15 });

  // 面部体积：clip 在脸轮廓内铺侧向暗面与下颌暗面，让无眼脸也有明显起伏。
  // 仍然不画眼球 / 瞳孔（沿用「留白国风面庞」的既定口径）。
  ctx.save();
  ctx.beginPath();
  faceBuild(ctx);
  ctx.clip();
  let faceGrad = null;
  try {
    const g = ctx.createLinearGradient(-8, y - 6, 10, y + 8);
    g.addColorStop(0, 'rgba(246,230,202,0.10)');
    g.addColorStop(0.46, 'rgba(90,60,38,0.02)');
    g.addColorStop(0.72, 'rgba(84,55,34,0.20)');
    g.addColorStop(1, 'rgba(70,45,28,0.34)');
    faceGrad = g;
  } catch (_) { faceGrad = null; }
  if (faceGrad) {
    ctx.fillStyle = faceGrad;
    ctx.fillRect(-10, y - 10, 22, 20);
  }
  // 眉骨下方 / 眼窝的柔和暗面（面积，不是一条细线，也不是眼睛）
  shape(ctx, (c) => {
    c.moveTo(0.6, y - 2.8);
    c.quadraticCurveTo(3.8, y - 3.8, 6.6, y - 2.0);
    c.quadraticCurveTo(5.0, y - 0.2, 2.0, y - 0.6);
    c.closePath();
  }, 'rgba(78,52,32,0.24)', null);
  // 鼻侧与颊下暗面
  shape(ctx, (c) => {
    c.moveTo(4.2, y - 0.6);
    c.quadraticCurveTo(6.6, y + 1.4, 5.0, y + 4.8);
    c.quadraticCurveTo(3.0, y + 3.6, 3.2, y + 0.4);
    c.closePath();
  }, 'rgba(84,55,34,0.20)', null);
  // 下颌与颏底
  shape(ctx, (c) => {
    c.moveTo(-5.0, y + 4.0);
    c.quadraticCurveTo(0.4, y + 8.0, 5.4, y + 5.6);
    c.quadraticCurveTo(0.4, y + 10.0, -5.0, y + 4.0);
    c.closePath();
  }, 'rgba(76,50,31,0.22)', null);
  // 颧骨受光
  shape(ctx, (c) => {
    c.moveTo(-2.8, y + 0.4);
    c.quadraticCurveTo(0.4, y - 0.6, 2.2, y + 1.2);
    c.quadraticCurveTo(-0.4, y + 2.8, -2.8, y + 0.4);
    c.closePath();
  }, 'rgba(246,230,202,0.16)', null);
  ctx.restore();

  // 眉骨暗面：一道斜向弧影（不是眼睛，只是眶上缘的转折）
  strokePath(ctx, (c) => {
    c.moveTo(1.0, y - 2.6);
    c.quadraticCurveTo(3.8, y - 3.4, 6.2, y - 2.2);
  }, 'rgba(78,52,32,0.46)', 1.8);
  // 眼窝下方一道更淡的过渡，让眉骨不显得孤立
  strokePath(ctx, (c) => {
    c.moveTo(2.0, y - 0.8);
    c.quadraticCurveTo(4.2, y - 1.2, 6.0, y - 0.2);
  }, 'rgba(96,64,40,0.18)', 1.2);
  // 鼻梁受光 + 鼻侧暗面
  strokePath(ctx, (c) => {
    c.moveTo(5.4, y - 1.6);
    c.quadraticCurveTo(5.0, y + 0.4, 6.4, y + 1.6);
  }, 'rgba(246,230,202,0.26)', 1.0);
  strokePath(ctx, (c) => {
    c.moveTo(3.8, y - 0.6);
    c.quadraticCurveTo(3.4, y + 1.6, 5.0, y + 2.4);
  }, 'rgba(88,58,36,0.30)', 1.1);
  // 鼻底 / 唇缝 / 颏下
  strokePath(ctx, (c) => { c.moveTo(5.6, y + 2.8); c.quadraticCurveTo(6.6, y + 3.0, 7.0, y + 2.6); }, 'rgba(88,58,36,0.34)', 0.9);
  strokePath(ctx, (c) => { c.moveTo(4.4, y + 4.2); c.quadraticCurveTo(5.6, y + 4.0, 6.2, y + 4.0); }, 'rgba(112,66,48,0.46)', 0.95);
  strokePath(ctx, (c) => { c.moveTo(0.6, y + 6.6); c.quadraticCurveTo(3.0, y + 7.6, 4.8, y + 6.0); }, SKIN_SHADOW, 1.1);
  // 耳
  shape(ctx, (c) => {
    c.moveTo(-6.4, y - 1.0);
    c.quadraticCurveTo(-9.0, y - 0.6, -8.0, y + 2.8);
    c.quadraticCurveTo(-6.8, y + 3.4, -5.8, y + 1.6);
    c.closePath();
  }, SKIN, INK_SOFT, 0.8);
  strokePath(ctx, (c) => { c.moveTo(-7.6, y + 0.2); c.quadraticCurveTo(-7.0, y + 1.2, -6.6, y + 1.4); }, SKIN_SHADOW, 0.8);
  // 鬓发 / 发际：从头衣下缘贴到耳前
  shape(ctx, (c) => {
    c.moveTo(-6.8, y - 5.6);
    c.quadraticCurveTo(-7.6, y - 1.2, -6.0, y + 1.4);
    c.quadraticCurveTo(-5.0, y - 0.8, -5.0, y - 4.8);
    c.closePath();
  }, LEATHER_D, null);

  // 头衣：平巾帻(Lv1~2) / 武弁(Lv3~7) / 兜鍪(Lv8~10)
  if (lv <= 2) drawJinze(ctx, y);
  else if (lv <= 7) drawWubian(ctx, y, lv);
  else drawDoumou(ctx, y, lv, opt);
}

// 平巾帻：软布罩住发髻，前有颜题额带，后有两片垂脚
function drawJinze(ctx, y) {
  vol(ctx, (c) => {
    c.moveTo(-7.4, y - 4.6);
    c.quadraticCurveTo(-8.0, y - 11.4, -0.6, y - 12.0);
    c.quadraticCurveTo(7.4, y - 11.6, 7.6, y - 4.8);
    c.quadraticCurveTo(0, y - 7.0, -7.4, y - 4.6);
    c.closePath();
  }, CLOTH_D, { lit: 0.9, shade: 1.0 });
  strokePath(ctx, (c) => { c.moveTo(-7.0, y - 5.4); c.quadraticCurveTo(0, y - 7.6, 7.2, y - 5.4); }, CLOTH_L, 1.5);
  // 后垂脚
  shape(ctx, (c) => {
    c.moveTo(-7.0, y - 7.6);
    c.quadraticCurveTo(-10.6, y - 3.4, -9.4, y + 2.0);
    c.quadraticCurveTo(-7.4, y + 1.0, -5.8, y - 5.0);
    c.closePath();
  }, CLOTH_D, INK_SOFT, 0.8);
  // 发髻微凸
  vol(ctx, (c) => {
    c.moveTo(-3.4, y - 11.4);
    c.quadraticCurveTo(0, y - 14.4, 3.4, y - 11.4);
    c.closePath();
  }, CLOTH_D, { lit: 0.5, shade: 0.8, stroke: INK_SOFT, lw: 0.8 });
}

// 武弁：略尖顶皮弁 + 前檐 + 护耳，Lv6 起加一道暗铜箍
function drawWubian(ctx, y, lv) {
  vol(ctx, (c) => {
    c.moveTo(-7.6, y - 4.4);
    c.quadraticCurveTo(-7.0, y - 10.2, -2.0, y - 12.4);
    c.quadraticCurveTo(0, y - 14.2, 2.0, y - 12.4);
    c.quadraticCurveTo(7.0, y - 10.2, 7.6, y - 4.4);
    c.quadraticCurveTo(0, y - 6.6, -7.6, y - 4.4);
    c.closePath();
  }, LEATHER, { lit: 0.95, shade: 1.0 });
  strokePath(ctx, (c) => { c.moveTo(-7.8, y - 5.0); c.quadraticCurveTo(0, y - 7.2, 7.8, y - 5.0); }, LEATHER_D, 2.0);
  strokePath(ctx, (c) => { c.moveTo(-4.0, y - 10.4); c.quadraticCurveTo(0, y - 12.4, 4.0, y - 10.4); }, 'rgba(240,224,193,0.13)', 0.9);
  // 护耳
  shape(ctx, (c) => {
    c.moveTo(-7.2, y - 5.2);
    c.quadraticCurveTo(-8.8, y - 0.4, -6.6, y + 1.8);
    c.quadraticCurveTo(-5.4, y - 0.6, -5.6, y - 4.6);
    c.closePath();
  }, LEATHER_D, INK_SOFT, 0.75);
  if (lv >= 6) {
    strokePath(ctx, (c) => { c.moveTo(-6.6, y - 8.0); c.quadraticCurveTo(0, y - 9.6, 6.6, y - 8.0); }, METAL_D, 1.3);
    dot(ctx, 0, y - 6.6, 1.2, METAL);
  }
}

// 兜鍪：弧锥顶 + 前檐 + 两侧护颈札片，纵向甲缝（不是横条纹西瓜）
function drawDoumou(ctx, y, lv, opt = {}) {
  vol(ctx, (c) => {
    c.moveTo(-8.2, y - 4.6);
    c.quadraticCurveTo(-8.4, y - 11.4, -2.4, y - 13.6);
    c.quadraticCurveTo(0, y - 14.6, 2.4, y - 13.6);
    c.quadraticCurveTo(8.4, y - 11.4, 8.2, y - 4.6);
    c.quadraticCurveTo(0, y - 7.0, -8.2, y - 4.6);
    c.closePath();
  }, ARMOR, { lit: 1.0, shade: 1.0 });
  // 甲片叠压：两道横向弧缝 + 一条中缝，不用密集纵缝（否则像毛线帽 / 西瓜纹）
  strokePath(ctx, (c) => { c.moveTo(-7.4, y - 8.2); c.quadraticCurveTo(0, y - 6.2, 7.4, y - 8.2); }, ARMOR_D, 1.0);
  strokePath(ctx, (c) => { c.moveTo(-8.0, y - 5.8); c.quadraticCurveTo(0, y - 3.8, 8.0, y - 5.8); }, ARMOR_D, 0.9);
  strokePath(ctx, (c) => { c.moveTo(0, y - 13.4); c.quadraticCurveTo(0.4, y - 10.4, 0, y - 7.2); }, ARMOR_D, 0.85);
  strokePath(ctx, (c) => { c.moveTo(-4.6, y - 11.0); c.quadraticCurveTo(-5.6, y - 9.0, -4.8, y - 7.0); }, 'rgba(244,229,199,0.12)', 0.8);
  // 前檐
  strokePath(ctx, (c) => { c.moveTo(-8.6, y - 5.0); c.quadraticCurveTo(0, y - 7.4, 8.6, y - 5.0); }, ARMOR_D, 2.4);
  dot(ctx, 0, y - 6.2, 1.25, METAL_D);
  // 护颈札片：两侧垂下，弧边
  for (const side of [-1, 1]) {
    shape(ctx, (c) => {
      c.moveTo(side * 7.6, y - 5.0);
      c.quadraticCurveTo(side * 9.6, y - 0.6, side * 8.2, y + 3.6);
      c.quadraticCurveTo(side * 5.8, y + 3.0, side * 5.8, y - 4.2);
      c.closePath();
    }, ARMOR, ARMOR_D, 0.85);
    strokePath(ctx, (c) => { c.moveTo(side * 6.6, y - 0.4); c.quadraticCurveTo(side * 7.8, y + 0.6, side * 8.6, y + 0.2); }, ARMOR_D, 0.7);
  }
  // 暗朱盔缨：极小一簇
  if (lv >= 9 || opt.plume) {
    shape(ctx, (c) => {
      c.moveTo(-1.2, y - 14.2);
      c.quadraticCurveTo(-3.4, y - 18.0, -0.6, y - 19.4);
      c.quadraticCurveTo(2.6, y - 17.4, 1.4, y - 14.2);
      c.closePath();
    }, ACCENT, INK_SOFT, 0.7);
  }
}

/* ---------------- 兵器 ---------------- */

// 汉式木盾：上圆下方、纵向中脊、皮面暗朱云纹、四枚小乳钉
function hanShield(ctx, p, x, y, r = 12) {
  const build = (c) => {
    c.moveTo(-r * 0.86, -r * 0.62);
    c.quadraticCurveTo(0, -r * 1.22, r * 0.86, -r * 0.62);
    c.quadraticCurveTo(r * 1.02, r * 0.30, r * 0.60, r * 0.98);
    c.quadraticCurveTo(0, r * 1.18, -r * 0.60, r * 0.98);
    c.quadraticCurveTo(-r * 1.02, r * 0.30, -r * 0.86, -r * 0.62);
    c.closePath();
  };
  ctx.save();
  ctx.translate(x, y);
  vol(ctx, build, p.lv >= 8 ? ARMOR_D : WOOD, { lit: 1.0, shade: 1.05, lw: 1.35 });
  // 皮面包边
  strokePath(ctx, (c) => {
    c.moveTo(-r * 0.70, -r * 0.52);
    c.quadraticCurveTo(0, -r * 1.02, r * 0.70, -r * 0.52);
    c.quadraticCurveTo(r * 0.84, r * 0.26, r * 0.50, r * 0.82);
    c.quadraticCurveTo(0, r * 1.00, -r * 0.50, r * 0.82);
    c.quadraticCurveTo(-r * 0.84, r * 0.26, -r * 0.70, -r * 0.52);
    c.closePath();
  }, LEATHER_D, 1.6);
  // 中脊
  strokePath(ctx, (c) => { c.moveTo(0, -r * 0.98); c.quadraticCurveTo(1.0, 0, 0, r * 0.98); }, WOOD_D, 1.4);
  strokePath(ctx, (c) => { c.moveTo(-1.0, -r * 0.88); c.quadraticCurveTo(0, 0, -1.0, r * 0.88); }, 'rgba(240,224,193,0.12)', 0.8);
  // 暗铜云纹：两道极淡的弧，不用高饱和朱红
  strokePath(ctx, (c) => { c.moveTo(-r * 0.50, -r * 0.26); c.quadraticCurveTo(-r * 0.12, -r * 0.48, -r * 0.14, -r * 0.06); }, WOOD_D, 1.15);
  strokePath(ctx, (c) => { c.moveTo(r * 0.50, r * 0.26); c.quadraticCurveTo(r * 0.12, r * 0.48, r * 0.14, r * 0.06); }, WOOD_D, 1.15);
  // 四枚小乳钉：暗铜，不用亮银
  [[-0.52, -0.44], [0.52, -0.44], [-0.46, 0.52], [0.46, 0.52]].forEach(([a, b]) => {
    dot(ctx, r * a, r * b, 1.15, p.lv >= 6 ? METAL_D : WOOD_D);
  });
  ctx.restore();
}

// 汉式反曲角弓：双曲弓臂 + 弓弣 + 弓弦；拉弓时弦中点后移
function hanBow(ctx, p, x, y, pull = 0, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const R = 15;
  const wood = p.lv >= 4 ? WOOD : HEMP;
  strokePath(ctx, (c) => {
    c.moveTo(-R * 0.42, -R * 1.02);
    c.quadraticCurveTo(R * 0.34, -R * 0.72, R * 0.30, -R * 0.16);
  }, wood, 2.9);
  strokePath(ctx, (c) => {
    c.moveTo(R * 0.30, R * 0.16);
    c.quadraticCurveTo(R * 0.34, R * 0.72, -R * 0.42, R * 1.02);
  }, wood, 2.9);
  // 弓梢回勾
  strokePath(ctx, (c) => { c.moveTo(-R * 0.42, -R * 1.02); c.quadraticCurveTo(-R * 0.76, -R * 1.10, -R * 0.74, -R * 0.82); }, wood, 2.2);
  strokePath(ctx, (c) => { c.moveTo(-R * 0.42, R * 1.02); c.quadraticCurveTo(-R * 0.76, R * 1.10, -R * 0.74, R * 0.82); }, wood, 2.2);
  // 弓弣缠绳
  strokePath(ctx, (c) => { c.moveTo(R * 0.26, -R * 0.22); c.quadraticCurveTo(R * 0.40, 0, R * 0.26, R * 0.22); }, LEATHER_D, 3.4);
  for (let i = -1; i <= 1; i++) strokePath(ctx, (c) => { c.moveTo(R * 0.20, i * 2.0 - 0.7); c.lineTo(R * 0.38, i * 2.0 + 0.5); }, HEMP, 0.8);
  // 弓弦
  const tx = -R * 0.74;
  strokePath(ctx, (c) => {
    c.moveTo(tx, -R * 0.82);
    c.lineTo(-pull, 0);
    c.lineTo(tx, R * 0.82);
  }, HEMP, 1.15);
  fist(ctx, R * 0.32, 0, 2.7);
  ctx.restore();
}

// 箭箙：斜背在身后，露出三支箭羽
function quiver(ctx, p, x, y, rot = -0.28) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  shape(ctx, (c) => {
    c.moveTo(-4.8, -9.0);
    c.quadraticCurveTo(0, -10.4, 4.8, -9.0);
    c.quadraticCurveTo(5.6, 2.0, 3.8, 10.0);
    c.quadraticCurveTo(0, 11.2, -3.8, 10.0);
    c.quadraticCurveTo(-5.6, 2.0, -4.8, -9.0);
    c.closePath();
  }, LEATHER_D, INK, 1.0);
  strokePath(ctx, (c) => { c.moveTo(-4.2, -1.0); c.quadraticCurveTo(0, 0.6, 4.2, -1.0); }, LEATHER, 1.5);
  for (let i = -1; i <= 1; i++) {
    strokePath(ctx, (c) => { c.moveTo(i * 2.6, -8.0); c.lineTo(i * 2.2, -16.0); }, HEMP, 1.2);
    shape(ctx, (c) => {
      c.moveTo(i * 2.2, -16.0);
      c.quadraticCurveTo(i * 2.2 + 1.6, -18.2, i * 2.2 + 0.4, -19.4);
      c.quadraticCurveTo(i * 2.2 - 1.6, -17.6, i * 2.2, -16.0);
      c.closePath();
    }, CLOTH_L, INK_SOFT, 0.6);
  }
  ctx.restore();
}

// 环首刀：直刃、刀尖上挑、柄端环首
function hanSabre(ctx, p, x, y, rot = -0.35) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  strokePath(ctx, (c) => { c.moveTo(-3, 0); c.lineTo(11, 0); }, LEATHER_D, 3.0);
  dot(ctx, -3.6, 0, 1.9, LEATHER_D);           // 环首
  dot(ctx, -3.6, 0, 0.9, CLOTH_D);
  shape(ctx, (c) => {
    c.moveTo(11, -1.7);
    c.quadraticCurveTo(20, -2.1, 25, -4.2);
    c.quadraticCurveTo(22, 0.4, 11, 1.5);
    c.closePath();
  }, p.lv >= 8 ? METAL : WOOD_D, INK_SOFT, 0.8);
  strokePath(ctx, (c) => { c.moveTo(12, -0.6); c.quadraticCurveTo(19, -0.8, 23, -2.6); }, 'rgba(240,224,193,0.20)', 0.7);
  fist(ctx, 10.6, 0, 2.7);
  ctx.restore();
}

// 长矛：杆 + 柳叶形矛头 + 暗朱缨；沿 rot 倾斜，长度由 len 控制
function hanSpear(ctx, p, len = 34, rot = -0.95, { thick = 2.8, tuft = true } = {}) {
  ctx.save();
  ctx.rotate(rot);
  strokePath(ctx, (c) => { c.moveTo(-len * 0.6, 0); c.lineTo(len * 0.62, 0); }, p.lv >= 7 ? WOOD_D : WOOD, thick);
  // 杆上缠绳
  for (let i = -1; i <= 1; i++) strokePath(ctx, (c) => { c.moveTo(i * 4.0 - 1, -thick * 0.55); c.lineTo(i * 4.0 + 1, thick * 0.55); }, HEMP, 0.8);
  // 柳叶矛头
  const tip = len * 0.62;
  shape(ctx, (c) => {
    c.moveTo(tip - 1, -2.5);
    c.quadraticCurveTo(tip + 6, -2.2, tip + 11, 0);
    c.quadraticCurveTo(tip + 6, 2.2, tip - 1, 2.5);
    c.quadraticCurveTo(tip + 1.5, 0, tip - 1, -2.5);
    c.closePath();
  }, p.lv >= 8 ? METAL : WOOD_D, INK_SOFT, 0.8);
  strokePath(ctx, (c) => { c.moveTo(tip + 1, -0.4); c.quadraticCurveTo(tip + 6, -0.6, tip + 9.4, 0); }, 'rgba(240,224,193,0.22)', 0.7);
  // 矛缨
  if (tuft && p.lv >= 5) {
    shape(ctx, (c) => {
      c.moveTo(tip - 2, -1.4);
      c.quadraticCurveTo(tip + 1, -6.6, tip + 3.4, -5.2);
      c.quadraticCurveTo(tip + 2.4, -1.4, tip - 2, -1.4);
      c.closePath();
    }, ACCENT, INK_SOFT, 0.6);
    shape(ctx, (c) => {
      c.moveTo(tip - 2, 1.4);
      c.quadraticCurveTo(tip + 1, 6.6, tip + 3.4, 5.2);
      c.quadraticCurveTo(tip + 2.4, 1.4, tip - 2, 1.4);
      c.closePath();
    }, ACCENT, INK_SOFT, 0.6);
  }
  ctx.restore();
}

/* ---------------- 马：曲线侧影 ---------------- */

function horseBody(c) {
  c.moveTo(-22, -38);
  c.quadraticCurveTo(-18, -44, -6, -43);       // 臀 → 背
  c.quadraticCurveTo(4, -43, 9, -39);          // 鬐甲
  c.quadraticCurveTo(13, -36, 13, -30);        // 胸
  c.quadraticCurveTo(8, -24, -2, -25);         // 腹
  c.quadraticCurveTo(-14, -25, -20, -29);      // 后腹
  c.quadraticCurveTo(-24, -32, -22, -38);
  c.closePath();
}

function drawHorse(ctx, p, legPhase = 0, action = 'idle') {
  // 马尾（在身体之后）
  strokePath(ctx, (c) => {
    c.moveTo(-22, -38);
    c.quadraticCurveTo(-33, -33 + legPhase * 3, -30, -14);
  }, HORSE_D, 3.4);
  strokePath(ctx, (c) => {
    c.moveTo(-22.4, -37);
    c.quadraticCurveTo(-29, -31 + legPhase * 3, -28, -17);
  }, HORSE, 1.6);
  // 四条腿：大腿 / 小腿两段带膝关节，前后错开，蹄子有外撇。
  // 远侧两腿更暗、更细，压在马身之后；近侧两腿带步态摆动。
  const legSets = [
    { x: -17, ph: 0.15, dark: true, back: true },
    { x: 7, ph: 0.65, dark: true, back: true },
    { x: -13, ph: 0.5, dark: false, back: false },
    { x: 11, ph: 0.0, dark: false, back: false },
  ];
  legSets.forEach(({ x, ph, dark, back }) => {
    const swing = Math.sin((legPhase + ph) * Math.PI * 2) * (action === 'idle' ? 1.1 : 3.8);
    const col = dark ? HORSE_D : HORSE;
    const kneeX = x + (back ? -1.4 : 1.6) + swing * 0.35;
    const footX = x + (back ? -1.0 : 2.2) + swing;
    // 大腿：从马腹斜下到膝
    limb(ctx, x, -28, kneeX, -15, dark ? 3.0 : 3.5, dark ? 2.1 : 2.5, col, -0.9, INK_SOFT);
    // 小腿：膝到跗关节，反向微弯
    limb(ctx, kneeX, -15, footX, -4.6, dark ? 2.1 : 2.5, dark ? 1.5 : 1.8, col, 0.9, INK_SOFT);
    // 膝部一小片暗面，交代转折
    dot(ctx, kneeX, -15, dark ? 1.9 : 2.3, dark ? HORSE_D : 'rgba(40,32,23,0.34)');
    // 蹄：前端外撇
    shape(ctx, (c) => {
      c.moveTo(footX - 2.4, -5.2);
      c.quadraticCurveTo(footX + 0.6, -6.0, footX + 3.4, -4.0);
      c.quadraticCurveTo(footX + 3.0, -1.2, footX - 2.0, -1.4);
      c.closePath();
    }, HORSE_D, INK_SOFT, 0.7);
  });
  // 马身
  vol(ctx, horseBody, HORSE, { lit: 1.0, shade: 1.05, lw: 1.25 });
  // 颈：从鬐甲斜上，带弧度
  vol(ctx, (c) => {
    c.moveTo(5, -40);
    c.quadraticCurveTo(12, -46, 20, -55);
    c.quadraticCurveTo(24, -58, 26, -54);
    c.quadraticCurveTo(18, -42, 12, -34);
    c.quadraticCurveTo(8, -36, 5, -40);
    c.closePath();
  }, HORSE, { lit: 0.9, shade: 0.9, lw: 1.1 });
  // 鬃毛：沿颈上缘一排短弧笔触
  for (let i = 0; i < 5; i++) {
    const bx = 9 + i * 3.2;
    const by = -44 - i * 2.3;
    strokePath(ctx, (c) => { c.moveTo(bx, by); c.quadraticCurveTo(bx - 2.0, by - 2.4, bx - 3.6, by - 1.0); }, HORSE_D, 1.25);
  }
  // 马头：额 → 鼻梁 → 口鼻 → 下颌
  vol(ctx, (c) => {
    c.moveTo(21, -57);
    c.quadraticCurveTo(27, -60, 31, -56);
    c.quadraticCurveTo(38, -52, 39, -46);
    c.quadraticCurveTo(37, -42, 32, -43);
    c.quadraticCurveTo(26, -45, 23, -50);
    c.quadraticCurveTo(20, -53, 21, -57);
    c.closePath();
  }, HORSE_L, { lit: 0.85, shade: 1.0, lw: 1.1 });
  // 耳
  shape(ctx, (c) => {
    c.moveTo(22.6, -57.4);
    c.quadraticCurveTo(21.6, -62.4, 24.4, -61.0);
    c.quadraticCurveTo(25.4, -59.0, 24.2, -57.0);
    c.closePath();
  }, HORSE_D, INK_SOFT, 0.7);
  // 眼（马保留一点，因为不是「人面」）、鼻孔、口线
  dot(ctx, 30.5, -51.4, 1.1, HORSE_D);
  dot(ctx, 37.2, -45.6, 0.85, HORSE_D);
  strokePath(ctx, (c) => { c.moveTo(33.4, -43.4); c.quadraticCurveTo(36.0, -43.0, 37.4, -44.2); }, HORSE_D, 0.8);
  // 辔头 / 缰绳
  strokePath(ctx, (c) => { c.moveTo(28.0, -55.0); c.quadraticCurveTo(33.0, -50.0, 38.0, -47.0); }, LEATHER_D, 1.5);
  strokePath(ctx, (c) => { c.moveTo(38.0, -46.4); c.quadraticCurveTo(24, -42, 7, -56); }, LEATHER_D, 1.25);
  dot(ctx, 32.0, -51.0, 1.0, METAL_D);
  // 鞍褥：一块弧边毡垫
  shape(ctx, (c) => {
    c.moveTo(-13, -44.4);
    c.quadraticCurveTo(-2, -47.0, 7, -43.6);
    c.quadraticCurveTo(8, -39.0, 4, -38.0);
    c.quadraticCurveTo(-5, -38.6, -13, -40.4);
    c.closePath();
  }, p.lv >= 5 ? CLOTH_D : LEATHER, INK, 1.0);
  strokePath(ctx, (c) => { c.moveTo(-12, -41.4); c.quadraticCurveTo(-3, -43.6, 6, -41.4); }, CLOTH_L, 1.1);
  // 马镫
  strokePath(ctx, (c) => { c.moveTo(-2, -39.4); c.lineTo(-2.6, -31.0); }, LEATHER_D, 1.2);
  strokePath(ctx, (c) => { c.moveTo(-5.2, -30.6); c.quadraticCurveTo(-2.6, -29.0, 0, -30.6); c.lineTo(-2.6, -32.4); c.closePath(); }, METAL_D, 1.2);
}

/* ---------------- 受击泛红 ---------------- */

function hitTint(ctx, x, y, rx, ry, t) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(178,72,52,${t < 0.55 ? 0.15 : 0.08})`;
  ctx.fill();
  ctx.restore();
}

/* ---------------- 四个兵种的姿态 ---------------- */

function poseFor(action, t, kind) {
  let dx = 0, dy = 0, rot = 0, lunge = 0, weapon = 0, pull = 0, arrow = 0, arrowVis = true, legPhase = 0;
  if (action === 'idle') {
    dy = t > 0.5 ? 0.9 : 0;
    legPhase = t > 0.5 ? 0.5 : 0;
  } else if (action === 'attack') {
    if (t < 0.4) { dx = -3; weapon = -0.22; }
    else if (t < 0.75) { dx = 5; lunge = 7; weapon = 0.30; }
    else { dx = 2; lunge = 2; weapon = 0.06; }
    if (kind === 'archer') {
      pull = t < 0.4 ? 0 : t < 0.75 ? 8 : 0;
      arrow = t < 0.4 ? 0 : t < 0.75 ? -8 : 13;
      arrowVis = t >= 0.4;
    }
    legPhase = t;
  } else if (action === 'hit') {
    rot = -0.16 + t * 0.14;
    dx = -5 * (1 - t);
    dy = 0.8;
  } else if (action === 'death') {
    rot = kind === 'cavalry' ? 0.18 + 0.5 * t : -0.32 - 0.85 * t;
    dy = (kind === 'cavalry' ? 6 : 3) * t;
    dx = -2.5 * t;
  }
  return { dx, dy, rot, lunge, weapon, pull, arrow, arrowVis, legPhase };
}

// 共通人体组装（供四个兵种调用）：腿 → 袍 → 甲 → 披膊 → 头
function soldier(ctx, p, { narrow = 0, short = 0, headY = -52, stride = 0, noLegs = false, noPauldron = false } = {}) {
  drawLegs(ctx, p, { stride, hide: noLegs });
  drawRobe(ctx, p, { narrow, short });
  drawArmor(ctx, p);
  if (!noPauldron) drawPauldron(ctx, p);
  drawHead(ctx, p, headY);
}

/* ---- 盾兵：矮壮沉稳，左盾右刀 ---- */
function drawShieldTroop(ctx, p, action, t) {
  const s = poseFor(action, t, 'shield');
  ctx.save();
  ctx.translate(s.dx, s.dy);
  ctx.rotate(s.rot);

  // 持盾臂（后）与刀臂（前）先画在身后的部分
  limb(ctx, -9, -38, -12 - s.lunge * 0.35, -26, 4.4, 3.0, CLOTH_D, -0.8, INK_SOFT);

  soldier(ctx, p, { narrow: 0, stride: 0, headY: -52 });

  // 右臂：握环首刀
  limb(ctx, 9, -38, 12 + s.lunge * 0.4, -27, 4.2, 2.9, CLOTH, 0.7, INK_SOFT);
  hanSabre(ctx, p, 12 + s.lunge * 0.4, -27, -0.34 + s.weapon * 0.6);

  // 盾：椭圆汉盾，压在身前，随突进前移。握盾的手先画，被盾沿遮住，
  // 只在上缘露出一点拳背，不再出现「盾心一个大橙圆点」。
  const sx = -12 - s.lunge * 0.35;
  fist(ctx, sx + 5.5, -31, 2.4);
  hanShield(ctx, p, sx - 1, -22, p.lv >= 7 ? 12.6 : 11.0);

  if (action === 'hit') hitTint(ctx, 0, -30, 15, 20, t);
  ctx.restore();
}

/* ---- 弓兵：瘦长侧身，反曲弓 + 斜背箭箙 ---- */
function drawArcherTroop(ctx, p, action, t) {
  const s = poseFor(action, t, 'archer');
  ctx.save();
  ctx.translate(s.dx, s.dy);
  ctx.rotate(s.rot);

  // 箭箙斜背身后
  if (p.lv >= 2) quiver(ctx, p, -13, -36, -0.30);

  soldier(ctx, p, { narrow: 1.6, short: 1.0, headY: -53, noPauldron: p.lv < 8 });

  // 拉弦臂（后）与持弓臂（前）
  limb(ctx, -8.5, -38, -5 - s.pull * 0.45, -30, 3.8, 2.6, CLOTH_D, -0.6, INK_SOFT);
  limb(ctx, 8.5, -38, 13.5, -32, 3.9, 2.6, CLOTH, 0.6, INK_SOFT);
  hanBow(ctx, p, 15.5, -32, s.pull, s.weapon * 0.5);
  fist(ctx, 6 - s.pull * 0.45, -30, 2.5);
  // 箭（拉弦 / 放箭阶段可见）
  if (s.arrowVis && p.lv >= 2) {
    ctx.save();
    ctx.translate(15.5, -32);
    strokePath(ctx, (c) => { c.moveTo(s.arrow - 9, 0); c.lineTo(s.arrow + 14, 0); }, HEMP, 1.5);
    shape(ctx, (c) => {
      c.moveTo(s.arrow + 14, 0);
      c.lineTo(s.arrow + 10, -2.2);
      c.lineTo(s.arrow + 10, 2.2);
      c.closePath();
    }, METAL, INK_SOFT, 0.6);
    ctx.restore();
  }

  if (action === 'hit') hitTint(ctx, 0, -30, 13, 19, t);
  ctx.restore();
}

/* ---- 枪兵：修长，长矛斜贯画面，双手前后握杆 ---- */
function drawSpearTroop(ctx, p, action, t) {
  const s = poseFor(action, t, 'spear');
  ctx.save();
  ctx.translate(s.dx, s.dy);
  ctx.rotate(s.rot);

  soldier(ctx, p, { narrow: 0.8, headY: -53, stride: 0 });

  // 后手（靠腰）
  limb(ctx, -8.5, -38, -9, -29, 3.9, 2.7, CLOTH_D, -0.6, INK_SOFT);
  fist(ctx, -9, -29, 2.5);
  // 长矛：从身后斜贯到身前
  ctx.save();
  ctx.translate(5 + s.lunge * 0.35, -34);
  hanSpear(ctx, p, 36, -0.92 + s.weapon * 0.9, { thick: 2.9, tuft: true });
  ctx.restore();
  // 前手
  limb(ctx, 8.5, -38, 11 + s.lunge * 0.5, -30, 4.0, 2.7, CLOTH, 0.7, INK_SOFT);
  fist(ctx, 11 + s.lunge * 0.5, -30, 2.7);

  if (action === 'hit') hitTint(ctx, 0, -30, 14, 20, t);
  ctx.restore();
}

/* ---- 骑兵：曲线马侧影 + 鞍上缩小骑手 + 长槊 ---- */
function drawCavalryTroop(ctx, p, action, t) {
  const s = poseFor(action, t, 'cavalry');
  ctx.save();
  ctx.translate(s.dx, s.dy);
  ctx.rotate(s.rot);

  drawHorse(ctx, p, s.legPhase, action);

  // 鞍上骑手：整体上移并缩小。屈膝踩镫的大腿 / 小腿两段，脚落在马镫处，
  // 与四条马腿明确分开，避免变成「半人马」或「半身像插在马背上」。
  ctx.save();
  ctx.translate(-1, -38);
  ctx.scale(0.78, 0.78);
  // 远侧腿（暗，先画，随后被躯干与马鞍遮去大半）
  limb(ctx, -5.0, -12, -9.0, -2.5, 3.3, 2.6, CLOTH_D, -0.8, INK_SOFT);
  limb(ctx, -9.0, -2.5, -4.0, 8.2, 2.6, 2.0, CLOTH_D, 0.8, INK_SOFT);
  shape(ctx, (c) => {
    c.moveTo(-6.4, 7.0);
    c.quadraticCurveTo(-3.6, 6.4, -1.8, 8.6);
    c.quadraticCurveTo(-2.8, 11.0, -6.8, 10.0);
    c.closePath();
  }, LEATHER_D, INK_SOFT, 0.8);
  drawRobe(ctx, p, { narrow: 0.6, short: 2.4 });
  drawArmor(ctx, p);
  drawPauldron(ctx, p);
  drawHead(ctx, p, -52);
  // 近侧腿（明）：大腿前伸、小腿回收踩镫
  limb(ctx, 5.0, -12, 9.4, -2.5, 3.5, 2.7, CLOTH, -0.8, INK_SOFT);
  limb(ctx, 9.4, -2.5, 3.6, 8.2, 2.7, 2.1, CLOTH, 0.8, INK_SOFT);
  dot(ctx, 9.4, -2.5, 2.0, 'rgba(40,32,23,0.22)');
  shape(ctx, (c) => {
    c.moveTo(1.0, 7.0);
    c.quadraticCurveTo(4.0, 6.4, 6.0, 8.6);
    c.quadraticCurveTo(4.8, 11.0, 0.8, 10.0);
    c.closePath();
  }, LEATHER_D, INK, 0.9);
  strokePath(ctx, (c) => { c.moveTo(1.6, 8.6); c.quadraticCurveTo(3.8, 8.0, 5.4, 9.0); }, CLOTH_L, 0.7);
  // 持槊臂
  limb(ctx, 8.5, -38, 13, -30, 4.0, 2.8, CLOTH, 0.7, INK_SOFT);
  fist(ctx, 13, -30, 2.6);
  ctx.restore();

  // 长槊：骑手手上斜指前方
  ctx.save();
  ctx.translate(9 + s.lunge * 0.4, -62);
  hanSpear(ctx, p, 40, -0.42 + s.weapon * 0.8, { thick: 3.2, tuft: true });
  ctx.restore();

  if (action === 'hit') hitTint(ctx, -2, -42, 18, 18, t);
  ctx.restore();
}

/* ---------------- 导出：保持 (ctx, p, action, t) 契约 ---------------- */

export const TROOP_FIGURE = {
  shield: drawShieldTroop,
  archer: drawArcherTroop,
  spear: drawSpearTroop,
  cavalry: drawCavalryTroop,
};
