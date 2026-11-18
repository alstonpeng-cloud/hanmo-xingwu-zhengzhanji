// 斗技场相机：斜 45° 俯视（地面纵向压扁、立绘仍然竖着站），支持缩放（布阵放大 / 开战拉远看全场）
// 世界坐标单位 = 格（x: 0..arena.cols，y: 0..arena.rows，y 越大越靠下 = 我方半场）
import { CONFIG } from '../data/config.js';

// 地面纵向压缩比：1 = 正上方纯俯视；0.66 ≈ 从斜 45° 看下去时地面在屏幕上的比例
export const TILT = 0.66;
// 近处略宽、远处略窄（±8%）→ 地面呈梯形，带出纵深，斜视感更强
export const PERSPECTIVE = 0.08;

// 相机可以越过战场边界多少格：贴边的兵也能拖到屏幕中间。
// 越界区域由 arenaField 画成围墙外的护坡，拖到极限也不会露白。
export const ARENA_MARGIN = 4;
// 顶部 HUD（战损面板）压住了画面上方约 11 行，顶部要多给一点余量，
// 否则最上面一排兵再怎么拖都藏在面板下面。
export const ARENA_MARGIN_TOP = 11;

// 世界某个 y 处的横向缩放（近大远小）
export function depthScale(cam, wy) {
  const ref = CONFIG.arena.rows / 2;
  return 1 + PERSPECTIVE * ((wy - cam.y) / ref);
}

// 屏幕 y → 该处的横向缩放（画立绘时按脚底所在的纵深缩放）
export function depthScaleAt(cam, sy) {
  const wy = cam.y + (sy - cam.view.y - cam.view.h / 2) / (cam.zoom * TILT);
  return depthScale(cam, wy);
}

// 让 rowsToFit 行刚好装进视口：宽高都要放得下，取较小的缩放比
// 宽度按「最近处最宽」算，避免梯形底边溢出
export function cameraZoom(view, rowsToFit = CONFIG.arena.rows) {
  return Math.min(
    view.w / (CONFIG.arena.cols * (1 + PERSPECTIVE)),
    view.h / (rowsToFit * TILT),
  );
}

function refreshBounds(cam) {
  const { cols, rows } = CONFIG.arena;
  const visY = cam.view.h / (cam.zoom * TILT);   // 视口能装下的格数（竖）
  const visX = cam.view.w / cam.zoom;            // 视口能装下的格数（横）
  // 可拖动范围整体放大：允许越过场地边界 ARENA_MARGIN 格，
  // 这样被挤到角落的兵也能拖到屏幕中间看（场外画成围墙护坡，不会露白）
  cam.minX = Math.min(visX / 2 - ARENA_MARGIN, cols / 2);
  cam.maxX = Math.max(cols - visX / 2 + ARENA_MARGIN, cols / 2);
  cam.minY = Math.min(visY / 2 - ARENA_MARGIN_TOP, rows / 2);
  cam.maxY = Math.max(rows - visY / 2 + ARENA_MARGIN, rows / 2);
  return cam;
}

// view = 屏幕上留给斗技场的矩形（像素）；opt: { zoom, rowsToFit, y }
export function makeCamera(view, opt = {}) {
  const cam = {
    view,
    zoom: opt.zoom ?? cameraZoom(view, opt.rowsToFit ?? CONFIG.arena.rows),
    x: CONFIG.arena.cols / 2,
    y: opt.y ?? CONFIG.arena.rows * 0.75,   // 默认对准我方半场
  };
  refreshBounds(cam);
  return clampCamera(cam);
}

// 改缩放（开战时的拉远动画用），边界跟着重算
export function setCameraZoom(cam, zoom) {
  cam.zoom = zoom;
  refreshBounds(cam);
  return clampCamera(cam);
}

export function clampCamera(cam) {
  cam.x = Math.max(cam.minX, Math.min(cam.maxX, cam.x));
  cam.y = Math.max(cam.minY, Math.min(cam.maxY, cam.y));
  return cam;
}

export function camToScreen(cam, wx, wy) {
  return {
    x: cam.view.x + cam.view.w / 2 + (wx - cam.x) * cam.zoom * depthScale(cam, wy),
    y: cam.view.y + cam.view.h / 2 + (wy - cam.y) * cam.zoom * TILT,
  };
}

export function camToWorld(cam, sx, sy) {
  const wy = cam.y + (sy - cam.view.y - cam.view.h / 2) / (cam.zoom * TILT);
  return {
    x: cam.x + (sx - cam.view.x - cam.view.w / 2) / (cam.zoom * depthScale(cam, wy)),
    y: wy,
  };
}

// 手指拖动（像素）→ 相机反向平移（画面跟手）
export function panCamera(cam, dxPx, dyPx) {
  cam.x -= dxPx / cam.zoom;
  cam.y -= dyPx / (cam.zoom * TILT);
  return clampCamera(cam);
}

// 相机是否已经拖到底部（我方半场）/ 顶部（敌方半场）
export function camAtBottom(cam) {
  return cam.y >= cam.maxY - 0.01;
}

export function camAtTop(cam) {
  return cam.y <= cam.minY + 0.01;
}

// 整场是否都已经在视口里（这时候不需要拖动，也就不该再提示「拖动看敌方半场」）
export function camCoversAll(cam) {
  const visY = cam.view.h / (cam.zoom * TILT);
  const visX = cam.view.w / cam.zoom;
  return visY >= CONFIG.arena.rows - 0.5 && visX >= CONFIG.arena.cols - 0.5;
}
