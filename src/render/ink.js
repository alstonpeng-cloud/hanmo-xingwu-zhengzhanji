// 共享绘制语言：墨线轮廓 + 左上光源三层明暗 + 去饱和色板。
// 普通兵种 / 特殊兵种 / 英雄三个渲染模块共用，保证 16 兵种与 12 英雄口径一致。
// 只作用于不透明填充，半透明特效层（受击泛红、阴影、光环）保持原样。

export const INK = 'rgba(14,18,23,0.46)';

const LIT = 'rgba(242,244,244,0.10)';
const SHADE = 'rgba(10,15,22,0.20)';
const RIM = 'rgba(242,244,244,0.08)';

export function isInkFill(fill) {
  return typeof fill === 'string' && fill.length > 0 && !fill.startsWith('rgba') && !fill.startsWith('rgb(');
}

// 形状填充后调用：clip 在当前路径内，铺左侧受光面 / 右下背光面 / 顶部高光条。
export function inkShade(ctx, x, y, w, h) {
  const ax = Math.min(x, x + w);
  const ay = Math.min(y, y + h);
  const aw = Math.abs(w);
  const ah = Math.abs(h);
  if (aw < 9 && ah < 9) return;
  ctx.save();
  ctx.clip();
  ctx.fillStyle = LIT;
  ctx.fillRect(ax, ay, aw * 0.42, ah);
  ctx.fillStyle = SHADE;
  ctx.fillRect(ax + aw * 0.48, ay + ah * 0.32, aw * 0.52, ah * 0.68);
  ctx.fillStyle = RIM;
  ctx.fillRect(ax, ay, aw, Math.max(1, ah * 0.12));
  ctx.restore();
}

// 形状描边后补一层细墨线，取代均匀塑料描边。
export function inkOutline(ctx, hasStroke, lw) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = hasStroke ? Math.max(0.8, lw * 0.5) : 1.1;
  ctx.stroke();
  ctx.restore();
}

// #rrggbb 去饱和并压暗，用于把旧高饱和配色收进国风色板。
export function mute(hex, amount = 0.16) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  r = Math.round((r + (l - r) * amount) * 0.94);
  g = Math.round((g + (l - g) * amount) * 0.94);
  b = Math.round((b + (l - b) * amount) * 0.94);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  return `#${((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1)}`;
}
