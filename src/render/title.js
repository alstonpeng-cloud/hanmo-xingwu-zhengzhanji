// 游戏名标题：优先使用从参考图抠出的金色草书位图（assets/ui/title.png），
// 图还没加载好时回退到原来的文字标题，保证任何环境（单测 / 首帧）都能正常显示。
import { THEME, text } from './draw.js';

let titleImg = null;
let requested = false;

export function initTitleImage(loadImage) {
  if (titleImg || requested || typeof loadImage !== 'function') return;
  requested = true;
  try {
    loadImage('assets/ui/title.png', (img) => {
      if (img) titleImg = img;
    });
  } catch (e) {
    // 加载失败就继续用文字兜底
  }
}

// 以 (cx, cy) 为中心、h 为高度画标题；返回实际宽度
export function drawGameTitle(ctx, cx, cy, h, opt = {}) {
  const alpha = opt.alpha ?? 1;
  if (titleImg) {
    const w = h * titleImg.width / titleImg.height;
    ctx.save();
    ctx.globalAlpha = alpha;
    // 深色底上给一层柔和投影，保证金色笔画的边缘不糊在背景里
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.max(6, h * 0.09);
    ctx.shadowOffsetY = Math.max(2, h * 0.03);
    ctx.drawImage(titleImg, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
    return w;
  }
  const size = opt.fallbackSize || Math.round(h * 0.55);
  text(ctx, '汉末行伍征战记', cx, cy, {
    size, weight: '700', align: 'center', color: opt.color || THEME.gold, alpha,
  });
  return size * 7;
}
