// 新手引导浮层：纯手势引导
// 只用「高亮 + 四角括号 + 呼吸光晕 + 指向箭头 + 手势图标 + 一句动作指令」告诉玩家点哪里、拖到哪里
// 不写规则解释，也不写原因；帮助页重看时用 demo 模式展示同一套手势图标
import { THEME, text, panel, button, hit, roundRectPath } from './draw.js';

export const TUTORIAL_UI = {
  x: 36,
  w: 678,
  top: 128,
  skipW: 96,
  skipH: 40,
  chipW: 440,
  chipH: 104,
};

function union(rects) {
  const list = (rects || []).filter(Boolean);
  if (!list.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of list) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// 把 step.anchor 里的 key 解析成矩形列表
export function tutorialHighlights(step, anchors) {
  const keys = step.anchor || [];
  const out = [];
  for (const key of keys) {
    const v = anchors ? anchors[key] : null;
    if (!v) continue;
    if (Array.isArray(v)) out.push(...v.filter(Boolean));
    else out.push(v);
  }
  return out;
}

// 强引导允许点击的区域：anchor + allow（去重）
export function tutorialAllowRects(step, anchors) {
  const keys = [...new Set([...(step.allow || []), ...(step.anchor || [])])];
  const out = [];
  for (const key of keys) {
    const v = anchors ? anchors[key] : null;
    if (!v) continue;
    if (Array.isArray(v)) out.push(...v.filter(Boolean));
    else out.push(v);
  }
  return out;
}

function demoLayout(W, H) {
  const rect = { x: Math.max(64, W / 2 - 260), y: H / 2 - 180, w: Math.min(W - 128, 520), h: 360 };
  return {
    mode: 'demo',
    rect,
    close: { x: rect.x + 60, y: rect.y + rect.h - 88, w: rect.w - 120, h: 60 },
    highlights: [],
  };
}

export function computeTutorialLayout(step, anchors, W, H) {
  if (step.kind === 'demo') return demoLayout(W, H);
  const highlights = tutorialHighlights(step, anchors);
  // 没有锚点（帮助页重看 / 页面还没布局完）→ 退化成静态手势卡
  if (!highlights.length) return demoLayout(W, H);

  const band = union(highlights);
  const chip = { x: (W - TUTORIAL_UI.chipW) / 2, y: 0, w: TUTORIAL_UI.chipW, h: TUTORIAL_UI.chipH };
  // 卡片优先放在「不挡操作」的一侧：布阵 / 合成把卡片放到目标上方（下方是兵牌列表）
  const above = step.prefer === 'above'
    ? band.y - chip.h - 26 >= TUTORIAL_UI.top
    : band.y + band.h + 26 + chip.h > H - 20;
  let y = above ? band.y - chip.h - 26 : band.y + band.h + 26;
  // 两侧都放不下 → 贴底，但不能盖住目标
  if (y < TUTORIAL_UI.top) y = Math.min(H - 20 - chip.h, band.y + band.h + 14);
  chip.y = y;
  return {
    mode: 'strong',
    bubble: chip,
    skip: {
      x: chip.x + chip.w - TUTORIAL_UI.skipW - 12,
      y: chip.y + (chip.h - TUTORIAL_UI.skipH) / 2,
      w: TUTORIAL_UI.skipW,
      h: TUTORIAL_UI.skipH,
    },
    pointerDown: chip.y + chip.h <= band.y,   // 卡片在目标上方 = 箭头朝下
    band,
    highlights,
    allow: tutorialAllowRects(step, anchors),
  };
}

// 指针命中：skip / allow（可操作目标）/ inside（卡片内部）/ outside
export function tutorialPointer(active, x, y) {
  const L = active && active.layout;
  if (!L) return 'outside';
  if (hit(L.skip || L.close, x, y)) return L.mode === 'demo' ? 'close' : 'skip';
  if (L.mode === 'demo') return hit(L.rect, x, y) ? 'inside' : 'outside';
  if ((L.allow || []).some((r) => hit(r, x, y))) return 'allow';
  if (hit(L.bubble, x, y)) return 'inside';
  return 'outside';
}

function dimExcept(ctx, W, H, band) {
  const pad = 6;
  const b = band
    ? { x: band.x - pad, y: band.y - pad, w: band.w + pad * 2, h: band.h + pad * 2 }
    : null;
  ctx.save();
  ctx.fillStyle = 'rgba(6,9,13,0.8)';
  if (!b) {
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillRect(0, 0, W, Math.max(0, b.y));
    ctx.fillRect(0, b.y + b.h, W, Math.max(0, H - b.y - b.h));
    ctx.fillRect(0, b.y, Math.max(0, b.x), b.h);
    ctx.fillRect(b.x + b.w, b.y, Math.max(0, W - b.x - b.w), b.h);
  }
  ctx.restore();
}

// 呼吸光晕 + 四角括号：让目标区域自己「跳出来」
function drawSpotlight(ctx, band, time) {
  const pulse = 0.5 + 0.5 * Math.abs(Math.sin(time * 2.6));
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.16 * pulse;
  ctx.strokeStyle = THEME.gold;
  ctx.lineWidth = 12;
  roundRectPath(ctx, band.x - 9, band.y - 9, band.w + 18, band.h + 18, 18);
  ctx.stroke();
  ctx.globalAlpha = 0.35 + 0.45 * pulse;
  ctx.lineWidth = 3;
  roundRectPath(ctx, band.x - 3, band.y - 3, band.w + 6, band.h + 6, 14);
  ctx.stroke();
  ctx.restore();

  // 四角括号（随呼吸微微外扩）
  const grow = 4 + 4 * pulse;
  const len = Math.max(18, Math.min(46, Math.min(band.w, band.h) / 3));
  ctx.save();
  ctx.strokeStyle = '#ffe2a1';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const corners = [
    [band.x - grow, band.y - grow, 1, 1],
    [band.x + band.w + grow, band.y - grow, -1, 1],
    [band.x - grow, band.y + band.h + grow, 1, -1],
    [band.x + band.w + grow, band.y + band.h + grow, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * len);
    ctx.stroke();
  }
  ctx.restore();
}

// 指向箭头：从卡片边缘朝目标方向，上下轻微跳动
function drawArrow(ctx, chip, band, down, time) {
  const cx = Math.max(chip.x + 50, Math.min(chip.x + chip.w - 50, band.x + band.w / 2));
  const bob = Math.sin(time * 4) * 6;
  const baseY = down ? chip.y + chip.h + 4 : chip.y - 4;
  const dir = down ? 1 : -1;
  const tip = baseY + dir * (24 + bob);
  ctx.save();
  ctx.fillStyle = 'rgba(8,11,16,0.55)';
  ctx.beginPath();
  ctx.moveTo(cx, tip + dir * 5);
  ctx.lineTo(cx - 22, baseY + dir * 2);
  ctx.lineTo(cx + 22, baseY + dir * 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd873';
  ctx.beginPath();
  ctx.moveTo(cx, tip);
  ctx.lineTo(cx - 18, baseY);
  ctx.lineTo(cx + 18, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundRectP(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
}

// 手势图标：点 / 拖 / 合
function drawGestureIcon(ctx, kind, x, y, size, time) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'pinch') {
    // 双指：两个指尖沿相反方向拉开，中间两条短箭头
    const k = 0.5 + 0.5 * Math.sin(time * 4);
    const off = size * (0.16 + 0.1 * k);
    for (const dir of [-1, 1]) {
      ctx.fillStyle = '#ffe2a1';
      ctx.beginPath();
      ctx.arc(dir * off, 0, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,216,115,0.92)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dir * off * 1.4, 0);
      ctx.lineTo(dir * off * 1.4 + dir * size * 0.2, 0);
      ctx.stroke();
      ctx.fillStyle = '#ffd873';
      ctx.beginPath();
      ctx.moveTo(dir * off * 1.4 + dir * size * 0.24, 0);
      ctx.lineTo(dir * off * 1.4 + dir * size * 0.14, -size * 0.06);
      ctx.lineTo(dir * off * 1.4 + dir * size * 0.14, size * 0.06);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === 'tap') {
    // 指尖圆点 + 两圈向外扩散的波纹
    for (let i = 0; i < 2; i++) {
      const k = (time * 1.25 + i * 0.5) % 1;
      ctx.globalAlpha = 0.55 * (1 - k);
      ctx.strokeStyle = '#ffd873';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size * (0.18 + k * 0.42), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffe2a1';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
    // 手指
    ctx.fillStyle = '#ffd873';
    ctx.beginPath();
    ctx.arc(size * 0.1, size * 0.02, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(size * 0.04, size * 0.02, size * 0.12, size * 0.3);
  } else if (kind === 'drag') {
    // 小兵牌 → 虚线箭头 → 目标白框
    ctx.fillStyle = 'rgba(88,160,107,0.92)';
    roundRectP(ctx, -size * 0.46, -size * 0.2, size * 0.3, size * 0.42, size * 0.06);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,226,161,0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -time * 18;
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, size * 0.02);
    ctx.lineTo(size * 0.26, size * 0.02);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#ffd873';
    ctx.lineWidth = 3;
    roundRectP(ctx, size * 0.2, -size * 0.22, size * 0.32, size * 0.46, size * 0.06);
    ctx.stroke();
    // 箭头尖
    ctx.fillStyle = '#ffd873';
    ctx.beginPath();
    ctx.moveTo(size * 0.3, -size * 0.08);
    ctx.lineTo(size * 0.3, size * 0.12);
    ctx.lineTo(size * 0.42, size * 0.02);
    ctx.closePath();
    ctx.fill();
  } else {
    // 两张兵牌向中间合拢
    const k = 0.5 + 0.5 * Math.sin(time * 3);
    const gap = size * (0.1 + 0.12 * k);
    ctx.fillStyle = 'rgba(88,160,107,0.92)';
    roundRectP(ctx, -gap - size * 0.26, -size * 0.22, size * 0.26, size * 0.44, size * 0.05);
    ctx.fill();
    roundRectP(ctx, gap, -size * 0.22, size * 0.26, size * 0.44, size * 0.05);
    ctx.fill();
    ctx.strokeStyle = '#ffd873';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-size * 0.08, 0);
    ctx.lineTo(size * 0.08, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffd873';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawTutorialOverlay(ctx, active, W, H, time = 0) {
  if (!active || !active.step) return;
  const step = active.step;
  const layout = computeTutorialLayout(step, active.anchors, W, H);
  active.layout = layout;

  if (layout.mode === 'demo') {
    drawDemo(ctx, step, layout, W, H, time);
    return;
  }

  dimExcept(ctx, W, H, layout.band);
  drawSpotlight(ctx, layout.band, time);
  drawArrow(ctx, layout.bubble, layout.band, layout.pointerDown, time);
  drawChip(ctx, step, layout, time);
}

// 只显示手势图标 + 一句动作指令（没有说明文字）
function drawChip(ctx, step, layout, time) {
  const b = layout.bubble;
  panel(ctx, b.x, b.y, b.w, b.h, { fill: 'rgba(19,26,37,0.97)', stroke: THEME.gold, r: 22, lw: 2 });
  drawGestureIcon(ctx, step.gesture || 'tap', b.x + 62, b.y + b.h / 2, 66, time);
  text(ctx, step.action || '', b.x + 118, b.y + b.h / 2, {
    size: 34, weight: '700', color: THEME.gold, maxWidth: b.w - 236,
  });
  button(ctx, layout.skip, '跳过', {
    size: 17, fill: 'rgba(38,49,65,0.9)', stroke: THEME.line, textColor: THEME.textDim,
  });
}

function drawDemo(ctx, step, layout, W, H, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(6,9,13,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const r = layout.rect;
  panel(ctx, r.x, r.y, r.w, r.h, { fill: 'rgba(19,26,37,0.98)', stroke: THEME.gold, r: 24, lw: 2 });
  text(ctx, step.name || '手势引导', r.x + r.w / 2, r.y + 56, {
    size: 22, align: 'center', color: THEME.textDim,
  });
  drawGestureIcon(ctx, step.gesture || 'tap', r.x + r.w / 2, r.y + 150, 110, time);
  text(ctx, step.action || '', r.x + r.w / 2, r.y + 258, {
    size: 40, weight: '700', align: 'center', color: THEME.gold, maxWidth: r.w - 40,
  });
  button(ctx, layout.close, '知道了', { size: 26, primary: true });
}
