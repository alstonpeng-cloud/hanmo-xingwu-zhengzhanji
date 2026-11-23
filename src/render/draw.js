// 极简 Canvas UI 工具箱：面板、按钮、文字、血条、货币徽章
// 不依赖 DOM，移植微信小游戏时可直接复用
//
// 设计系统「汉帛 · 朱金」v2 —— 单一设计令牌源 (design tokens)
// THEME 被 30+ 界面引用，改这里即全局换肤；保留全部历史 key 兼容旧代码。
//
// 风格基准：暖褐暗金，完全复刻 docs/ui-images/ 下 12 张参考视觉稿。
// 取色方式：对 12 张图做 48 色量化后按像素占比统计（见 docs/精细化改造/baseline.json）。
//   · 结构色（底/面板/文字）沿用原始暖褐层次 —— 与实测 #2A2218 / #372617 / #15120D 吻合
//   · 强调色（金/朱红/紫/青绿）直接采用实测值 #D59947 / #8D301B / #96659A / #3E885D
// 语义别名全部保留但映射到暖体系：商城/宝箱标题回归鎏金，失败回归暖褐+朱红。

// ── 色彩令牌：暖褐墨底 + 鎏金/朱砂/紫气/竹青 ──
const INK = {
  bg0: '#17130e', bg1: '#211a12', panel: '#2a2218',
  panel2: '#372617', panel3: '#4a3a24', line: '#8a6a3a', lineSoft: '#5a4528',
};
const SEMANTIC = {
  // 鎏金 · 胜利 / 货币 / 主描边（实测 #D59947）
  gold: '#d59947', goldDim: '#8a6a32', goldLit: '#f4d488',
  // 朱砂 · 品牌 / 一级操作（实测深色 #8D301B）；标题亮阶按参考图 13 实测 #CE4A3A
  red: '#8d301b', redDim: '#662718', redLit: '#ce4a3a',
  // 竹青 / 靛青 / 紫气（实测 #3E885D · #96659A）
  green: '#3e885d', blue: '#5b7c99', purple: '#96659a',
};
const TYPE_COLOR = { text: '#f2ead8', textDim: '#c2b394', textWeak: '#8a7d64' };

export const THEME = {
  ...INK, ...SEMANTIC, ...TYPE_COLOR,
  bg0: INK.bg0, bg1: INK.bg1, panel: INK.panel, panel2: INK.panel2,
  panel3: INK.panel3, line: INK.line, lineSoft: INK.lineSoft,
  gold: SEMANTIC.gold, goldDim: SEMANTIC.goldDim, goldLit: SEMANTIC.goldLit,
  red: SEMANTIC.red, redDim: SEMANTIC.redDim, redLit: SEMANTIC.redLit,
  green: SEMANTIC.green, blue: SEMANTIC.blue, purple: SEMANTIC.purple,
  text: TYPE_COLOR.text, textDim: TYPE_COLOR.textDim, textWeak: TYPE_COLOR.textWeak,
  // 兼容旧别名
  vermilion: SEMANTIC.red, jade: SEMANTIC.green, indigo: SEMANTIC.blue,
  // ── 语义别名（保留 key，值回退到暖褐暗金体系）──
  victory: SEMANTIC.gold,            // 凯旋 / 成功
  defeat: '#6b4a38',                 // 败 · 暖褐灰（不再是冷玄铁）
  defeatLit: '#c9ae8e',              // 败 · 亮阶文字
  blood: SEMANTIC.redLit,            // 朱砂亮阶 · 失败标题（参考图 13 实测 #CE4A3A）
  shop: SEMANTIC.gold,               // 商城标题回归鎏金
  shopDim: SEMANTIC.goldDim,
  treasure: '#c9a45c',               // 宝箱 / 招募 · 金木色
  treasureDim: SEMANTIC.goldDim,
  seal: SEMANTIC.red,                // 朱砂印章
  // ── v2 新增：S2.2 纹样 / 光效 / 品级用 ──
  goldSoft: '#aa8b58',               // 实测金中间调
  brown: '#5f452c',                  // 暖褐中间调
  inkDeep: '#15120d',                // 实测最深底
  haloGold: 'rgba(213,153,71,0.16)', // 金色氛围光
  haloRed: 'rgba(141,48,27,0.14)',   // 朱砂氛围光
};

// 高频硬编码色收口参考（逐步替换为 THEME.xxx）
export const LEGACY = { goldButtonFill: '#332c1d', topBarFill: 'rgba(23,19,14,0.92)' };

// ── 字体令牌：宋体撑题材(标题/大字) + 黑体保可读(正文/数值) ──
export const FONT_SANS = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Hiragino Sans GB", sans-serif';
export const FONT_SERIF = '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", "Noto Serif SC", serif';
export const FONT = FONT_SANS;
export const FONT_SIZE = { xs: 13, sm: 16, md: 19, lg: 22, xl: 26, xxl: 32, h1: 40, hero: 54 };

export function setFont(ctx, size, weight = '400', serif = false) {
  ctx.font = `${weight} ${Math.round(size)}px ${serif ? FONT_SERIF : FONT_SANS}`;
}

export function text(ctx, str, x, y, opt = {}) {
  const {
    size = 28, color = THEME.text, align = 'left', baseline = 'middle',
    weight = '400', maxWidth = 0, alpha = 1, serif = false, glow = 0,
  } = opt;
  ctx.save();
  setFont(ctx, size, weight, serif);
  if (glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (maxWidth > 0) ctx.fillText(str, x, y, maxWidth);
  else ctx.fillText(str, x, y);
  ctx.restore();
}

export function textWidth(ctx, str, size, weight = '400') {
  setFont(ctx, size, weight);
  return ctx.measureText(str).width;
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
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
}

export function panel(ctx, x, y, w, h, opt = {}) {
  const { fill = THEME.panel, stroke = THEME.line, r = 20, alpha = 1, lw = 2 } = opt;
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRectPath(ctx, x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.restore();
}

export function fillRect(ctx, x, y, w, h, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

export function button(ctx, rect, label, opt = {}) {
  const {
    sub = '', fill = THEME.panel2, stroke = THEME.line, textColor = THEME.text,
    disabled = false, size = 34, subSize = 22, subColor = THEME.textDim, active = false, r = 18,
  } = opt;
  const { x, y, w, h } = rect;
  const a = disabled ? 0.42 : 1;
  ctx.save();
  ctx.globalAlpha = a;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = active ? THEME.panel3 : fill;
  ctx.fill();
  if (active) {
    ctx.strokeStyle = THEME.gold;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  const cx = x + w / 2;
  if (sub) {
    text(ctx, label, cx, y + h / 2 - size * 0.32, { size, color: disabled ? THEME.textWeak : textColor, align: 'center', weight: '600', alpha: a });
    text(ctx, sub, cx, y + h / 2 + size * 0.62, { size: subSize, color: subColor, align: 'center', alpha: a });
  } else {
    text(ctx, label, cx, y + h / 2, { size, color: disabled ? THEME.textWeak : textColor, align: 'center', weight: '600', alpha: a });
  }
}

export function hit(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function bar(ctx, x, y, w, h, ratio, opt = {}) {
  const { bg = '#17130e', fill = THEME.green, r = 4, stroke = null } = opt;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = bg;
  ctx.fill();
  const rr = Math.max(0, Math.min(1, ratio));
  if (rr > 0) {
    roundRectPath(ctx, x, y, Math.max(w * rr, 2), h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

// 铜钱图标 + 数量
export function coinBadge(ctx, x, y, amount, opt = {}) {
  const { size = 26, align = 'left' } = opt;
  const n = Number(amount);
  // 铜钱上到 5 位数后，完整数字会把金币图标往左顶，压到旁边的「!」按钮上；
  // 统一在 1 万以上用「万」缩写（9.9万 / 10万 / 123.5万），宽度稳定不串位。
  const label = Number.isFinite(n) && n >= 10000 ? `${+(n / 10000).toFixed(1)}万` : String(amount);
  const w = size * 1.6 + 12 + textWidth(ctx, label, size, '600');
  const bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save();
  fillEllipse(ctx, bx + size * 0.8, y, size * 0.8, size * 0.8, '#d59947');
  fillEllipse(ctx, bx + size * 0.8, y, size * 0.45, size * 0.45, '#8a6a32');
  ctx.restore();
  text(ctx, label, bx + size * 1.7 + 10, y, { size, color: THEME.gold, weight: '600' });
  return w;
}

function fillEllipse(ctx, x, y, rx, ry, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
  ctx.fillStyle = color;
  ctx.fill();
}

export function lockIcon(ctx, x, y, size, color = THEME.textWeak) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.16;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.22, size * 0.26, Math.PI, 0);
  ctx.stroke();
  roundRectPath(ctx, x - size * 0.34, y - size * 0.1, size * 0.68, size * 0.5, size * 0.1);
  ctx.fill();
  ctx.restore();
}

export function screenDim(ctx, w, h, alpha = 0.72) {
  ctx.save();
  ctx.fillStyle = `rgba(6, 9, 13, ${alpha})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// 灰色圆圈 + 内嵌感叹号：把「说明性小字」收进可点开的详情
export function infoBadge(ctx, x, y, r = 24) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(74, 56, 38, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(213, 153, 71, 0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  text(ctx, '!', x, y + 1, { size: r * 1.25, align: 'center', color: '#f2ead8', weight: '700' });
}

// 通用说明弹层：标题 + 多段大号正文（替代页面里的小字说明）
export function infoModal(ctx, W, H, title, lines = []) {
  screenDim(ctx, W, H, 0.8);
  const x = 46;
  const w = W - 92;
  const y = 150;
  const lineH = 44;
  let cy = y + 126;
  for (const line of lines) {
    cy = wrapText(ctx, line, x + 42, cy, w - 84, lineH, { size: 28, color: THEME.text });
  }
  const h = Math.max(360, cy - y + 120);
  panel(ctx, x, y, w, h, { fill: THEME.bg1, stroke: THEME.goldDim, r: 20, lw: 2 });
  text(ctx, title, W / 2, y + 64, { size: 36, align: 'center', weight: '700', color: THEME.gold });
  // 重新画正文（panel 会盖住上面预排版的内容）
  let ty = y + 126;
  for (const line of lines) ty = wrapText(ctx, line, x + 42, ty, w - 84, lineH, { size: 28, color: THEME.text });
  button(ctx, { x: x + 90, y: y + h - 96, w: w - 180, h: 64 }, '知道了', { size: 30, primary: true });
}


export function wrapText(ctx, str, x, y, maxWidth, lineHeight, opt = {}) {
  const chars = Array.from(str);
  let line = '';
  let cy = y;
  for (const ch of chars) {
    const test = line + ch;
    if (textWidth(ctx, test, opt.size || 24, opt.weight || '400') > maxWidth && line) {
      text(ctx, line, x, cy, opt);
      line = ch;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) text(ctx, line, x, cy, opt);
  return cy + lineHeight;
}

// ── 「汉帛·朱金」新组件 ──────────────────────────────────
// 朱砂主按钮：暖朱砂底 + 金边 + 宋体字 + 内发光，用于一级行动
export function primaryButton(ctx, rect, label, opt = {}) {
  const { sub = '', size = 40, subSize = 20, disabled = false, t = 0, r = 18, glow = true } = opt;
  const { x, y, w, h } = rect;
  const a = disabled ? 0.45 : 1;
  ctx.save();
  ctx.globalAlpha = a;
  if (glow && !disabled) { ctx.shadowColor = 'rgba(141,48,27,0.5)'; ctx.shadowBlur = 24; }
  roundRectPath(ctx, x, y, w, h, r);
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, disabled ? '#4a3b3a' : '#a83c26');
  grad.addColorStop(1, disabled ? '#3d2b23' : '#662718');
  ctx.fillStyle = grad; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = disabled ? THEME.line : THEME.gold; ctx.lineWidth = 2.5; ctx.stroke();
  roundRectPath(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(0, r - 4));
  ctx.strokeStyle = 'rgba(244,212,136,0.42)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  const cx = x + w / 2;
  if (sub) {
    text(ctx, label, cx, y + h / 2 - size * 0.30, { size, color: '#fdf4e8', align: 'center', weight: '600', serif: true, alpha: a });
    text(ctx, sub, cx, y + h / 2 + size * 0.60, { size: subSize, color: 'rgba(253,244,232,0.82)', align: 'center', alpha: a });
  } else {
    text(ctx, label, cx, y + h / 2, { size, color: '#fdf4e8', align: 'center', weight: '600', serif: true, alpha: a });
  }
}

// 菜单页哑光金底纹：极淡鎏金氛围 + 汉镜同心暗纹 + 四角收敛暗角。
// 只铺在内容之下，透明度很低，不抢按钮与文字的可读性。
export function menuBackdrop(ctx, W, H, opt = {}) {
  const t = opt.t || 0;
  ctx.save();
  // 顶部中央哑光金雾（主光源）
  let g = ctx.createRadialGradient(W * 0.5, H * 0.26, 20, W * 0.5, H * 0.26, W * 0.92);
  g.addColorStop(0, 'rgba(208,164,88,0.085)');
  g.addColorStop(0.55, 'rgba(180,140,70,0.032)');
  g.addColorStop(1, 'rgba(180,140,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 左下角次级金雾（错位摆放，避免上下对称的呆板感）
  g = ctx.createRadialGradient(W * 0.16, H * 0.94, 20, W * 0.16, H * 0.94, W * 0.78);
  g.addColorStop(0, 'rgba(213,153,71,0.055)');
  g.addColorStop(1, 'rgba(213,153,71,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 汉镜同心暗纹：极淡金线 + 极慢呼吸缩放
  const cx = W * 0.5;
  const cy = H * 0.32;
  const breath = 1 + 0.012 * Math.sin(t * 0.6);
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(213,153,71,0.045)' : 'rgba(213,153,71,0.075)';
    ctx.beginPath();
    ctx.arc(cx, cy, (86 + i * 62) * breath, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 八向短刻（汉镜纹样）
  ctx.strokeStyle = 'rgba(213,153,71,0.085)';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r0 = 338 * breath;
    const r1 = r0 + 15;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }

  // 四边收敛暗角：让中间内容更聚光
  const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.34, W * 0.5, H * 0.5, H * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// 圆形悬浮提醒按钮：金环 + 呼吸光晕 + 漂浮粒子 + 红点角标
export function eventOrb(ctx, cx, cy, radius, label, opt = {}) {
  const { t = 0, badge = 0, color = THEME.gold, active = true, phase = 0 } = opt;
  const breath = 0.5 + 0.5 * Math.sin(t * 2.6 + phase);
  ctx.save();
  if (active) {
    const g = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * (1.7 + breath * 0.35));
    g.addColorStop(0, 'rgba(213,153,71,0.30)'); g.addColorStop(1, 'rgba(213,153,71,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, radius * (1.7 + breath * 0.35), 0, Math.PI * 2); ctx.fill();
    const wave = (t * 0.7 + phase * 0.2) % 1;
    ctx.globalAlpha = (1 - wave) * 0.5; ctx.strokeStyle = THEME.gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, radius * (1 + wave * 0.55), 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const body = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
  body.addColorStop(0, active ? '#4a3a24' : '#2b2217');
  body.addColorStop(1, active ? '#211a12' : '#17130e');
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(244,212,136,0.32)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2); ctx.stroke();
  if (active) {
    for (let i = 0; i < 4; i++) {
      const a = t * 0.9 + i * Math.PI / 2 + phase;
      const pr = radius * (1.22 + 0.08 * Math.sin(t * 2 + i));
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3 + i);
      ctx.fillStyle = THEME.goldLit;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  text(ctx, label, cx, cy + 1, { size: radius * 0.72, color: active ? THEME.goldLit : THEME.textWeak, align: 'center', weight: '600', serif: true, glow: active ? 10 : 0 });
  if (!active) {
    // 未解锁：圆钮外沿挂一把锁，外侧一眼可见上锁态
    const lx = cx + radius * 0.78, ly = cy - radius * 0.78;
    const bw = radius * 0.46, bh = radius * 0.36;
    const sr = bw * 0.30;
    ctx.save();
    ctx.strokeStyle = '#8a7d64';
    ctx.lineWidth = Math.max(2.4, radius * 0.09);
    ctx.beginPath();
    ctx.arc(lx, ly - bh * 0.42, sr, Math.PI, 0);
    ctx.stroke();
    roundRectPath(ctx, lx - bw / 2, ly - bh / 2, bw, bh, radius * 0.06);
    ctx.fillStyle = '#6b4a38';
    ctx.fill();
    ctx.strokeStyle = '#c9ae8e';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#2b2217';
    ctx.beginPath();
    ctx.arc(lx, ly - bh * 0.02, Math.max(1.6, bw * 0.10), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (badge > 0) {
    // 1.2.8 · 纯色呼吸角标：不带数字，靠缩放/透明度呼吸提醒（点进面板后按周期消失）
    const bx = cx + radius * 0.78, by = cy - radius * 0.78;
    const pulse = 1 + 0.14 * Math.sin(t * 3.2);
    const br = radius * 0.30 * pulse;
    ctx.save();
    ctx.shadowColor = 'rgba(200,71,62,0.8)';
    ctx.shadowBlur = 8 + 6 * pulse;
    ctx.globalAlpha = 0.74 + 0.26 * (0.5 + 0.5 * Math.sin(t * 3.2));
    ctx.fillStyle = THEME.red;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff2e2';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

// ── S2.2 · 雕花边框 / 金色浮尘（复刻参考图 01 / 09 / 10 的云纹角花与金粉氛围）──
// 作为「叠加装饰」使用：不改动 panel / button 的既有绘制，也不影响命中区域，
// 只对指定面板额外加一层雕花，既有布局与自动化断言完全不变。
export function carvedFrame(ctx, x, y, w, h, opt = {}) {
  const {
    color = THEME.gold, alpha = 0.88, lw = 2, corner = 30,
    inset = 5, inner = true, glow = 0, r = 18,
  } = opt;
  const c = Math.max(8, Math.min(corner, w / 3, h / 3));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (glow > 0) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  for (const [ax, ay, sx, sy] of [
    [x + inset, y + inset, 1, 1],
    [x + w - inset, y + inset, -1, 1],
    [x + inset, y + h - inset, 1, -1],
    [x + w - inset, y + h - inset, -1, -1],
  ]) {
    // 外框 L 型主笔
    ctx.beginPath();
    ctx.moveTo(ax + sx * (c + 14), ay + sy * 2);
    ctx.lineTo(ax + sx * c * 0.55, ay + sy * 2);
    ctx.quadraticCurveTo(ax + sx * 2, ay + sy * 2, ax + sx * 2, ay + sy * c * 0.55);
    ctx.lineTo(ax + sx * 2, ay + sy * (c + 14));
    ctx.stroke();
    // 云头回旋 + 两道短须
    ctx.beginPath();
    ctx.moveTo(ax + sx * (c + 12), ay + sy * 12);
    ctx.quadraticCurveTo(ax + sx * (c + 2), ay + sy * 15, ax + sx * (c - 2), ay + sy * 9);
    ctx.quadraticCurveTo(ax + sx * (c - 8), ay + sy * 3, ax + sx * (c - 14), ay + sy * 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax + sx * 12, ay + sy * (c + 12));
    ctx.quadraticCurveTo(ax + sx * 15, ay + sy * (c + 2), ax + sx * 9, ay + sy * (c - 2));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax + sx * 2, ay + sy * 13);
    ctx.lineTo(ax + sx * 8, ay + sy * 7);
    ctx.lineTo(ax + sx * 13, ay + sy * 2);
    ctx.stroke();
  }
  if (inner) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.38;
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + inset + 8, y + inset + 8,
      Math.max(2, w - (inset + 8) * 2), Math.max(2, h - (inset + 8) * 2),
      Math.max(4, r - 6));
    ctx.stroke();
  }
  ctx.restore();
}

// 确定性金色浮尘：不用 Math.random，保证冒烟截图逐帧可复现；
// 两层实心圆代替逐粒子径向渐变，每帧开销恒定，适合 60fps 小游戏。
export function goldDust(ctx, W, H, t, opt = {}) {
  const { count = 30, alpha = 0.5, seed = 7 } = opt;
  const fract = (v) => v - Math.floor(v);
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const px = fract(Math.sin((i + 1) * 127.1 + seed) * 43758.5453) * W;
    const baseY = fract(Math.sin((i + 1) * 311.7 + seed * 3) * 22578.145) * H;
    const speed = 7 + (i % 5) * 3.5;
    const span = H + 100;
    const py = (((baseY - t * speed) % span) + span) % span - 50;
    const r = 1.0 + fract(Math.sin(i * 78.233) * 12345.6789) * 2.0;
    const a = alpha * (0.30 + 0.70 * (0.5 + 0.5 * Math.sin(t * 1.5 + i * 1.7)));
    ctx.fillStyle = `rgba(213,153,71,${(a * 0.20).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(px, py, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,238,190,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function backButton(ctx, rect, label = '返回') {
  ctx.save();
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 14);
  ctx.fillStyle = THEME.panel2;
  ctx.fill();
  ctx.strokeStyle = THEME.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2, { size: 26, color: THEME.text, align: 'center' });
  // 左箭头
  const cx = rect.x + 22;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.strokeStyle = THEME.text;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + 8, cy - 9);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + 8, cy + 9);
  ctx.stroke();
  ctx.restore();
}
