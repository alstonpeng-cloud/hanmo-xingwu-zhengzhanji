// 板块 3/4 · 分包美术接入层
// ------------------------------------------------------------------
// assets/heroes|siege|art 里的 AI 立绘 / 3D 建模 / 背景插画由 build-wx.mjs
// 自动迁进 pkg_heroes / pkg_siege / pkg_art 并生成 asset-routes.js。
// 本模块把「逻辑路径」翻译成当前环境真正可加载的路径，负责：
//   · 分包未就绪 -> 返回 null，业务层无缝回退原有程序化绘制（首帧不空白）
//   · 分包就绪   -> 订阅 onPackageReady 后自动重试加载，玩家无感升级
//   · 图片缓存   -> 同一资源只 load 一次，逐帧绘制零开销
//   · 统一绘制   -> drawArt(等比 contain) / drawBackdrop(全屏 cover)
// 纯逻辑，不依赖 DOM；Node 单测没有 loadImage 时全部回退，1633 条断言不受影响。
import { resolveAsset, assetPackage, onPackageReady } from '../core/subpackage.js';

let loadImageImpl = null;
let enabled = true;
const cache = new Map();     // logical -> { img }
const waiting = new Set();   // 等分包就绪的 logical

export function initPackageArt({ loadImage, enabled: flag } = {}) {
  loadImageImpl = typeof loadImage === 'function' ? loadImage : null;
  if (typeof flag === 'boolean') enabled = flag;
}

// 回归冒烟可关掉位图，保留纯程序化绘制基线；正式包 / 浏览器试玩默认开启。
export function setArtEnabled(v) { enabled = !!v; }
export function isArtEnabled() { return enabled; }

// 五屏背景统一 4:4:4 q95 JPEG：全屏插画肉眼无差，但把总包从越线的
// 30.24MB 压回约 26MB，避开微信十进制 30MB 上限导致的上传 abort。
const BG_LOSSLESS = new Set();

// 逻辑路径工厂：素材文件名与 tools/prepare_art.py 的输出一一对应
export const ART = {
  hero: (id) => `assets/heroes/hero_${id}.png`,
  chest: (kind) => `assets/art/chest_${kind}.png`,
  siege: (id) => `assets/siege/siege_${id}.png`,
  troop: (id) => `assets/siege/troop_${id}.png`,
  bg: (name) => `assets/art/bg_${name}.${BG_LOSSLESS.has(name) ? 'png' : 'jpg'}`,
};

export const HERO_IDS = [
  'guanping', 'zhangren', 'huanggai', 'liru', 'zhangjiao', 'xiahouyuan',
  'zhangfei', 'guanyu', 'liubei', 'caocao', 'zhouyu', 'dongzhuo',
];
export const CHEST_KINDS = ['wood', 'silver', 'gold', 'rare', 'epic', 'legendary'];
export const SIEGE_IDS = ['catapult', 'ram', 'ballista', 'war_drum', 'shield_cart'];
export const BG_NAMES = ['home', 'recruit', 'result', 'shop', 'barracks'];

function request(logical) {
  if (!enabled || !logical || !loadImageImpl || cache.has(logical)) return;
  const real = resolveAsset(logical);
  if (!real) {
    // 微信分包尚未下载完：只订阅一次，就绪后清缓存重试；期间业务层走程序化兜底。
    const pkg = assetPackage(logical);
    if (pkg && !waiting.has(logical)) {
      waiting.add(logical);
      onPackageReady(pkg, () => {
        waiting.delete(logical);
        cache.delete(logical);
        request(logical);
      });
    }
    return;
  }
  cache.set(logical, { img: null });
  try {
    loadImageImpl(real, (img) => {
      cache.set(logical, { img: img || null });
    });
  } catch (e) {
    // 保持 img=null：调用方一律回退程序化绘制，绝不因为图片失败而黑屏
  }
}

export function getArt(logical) {
  request(logical);
  const rec = cache.get(logical);
  return rec ? rec.img : null;
}

// 首帧后预热：把常用素材挂上加载队列（分包未就绪时只登记订阅，不产生网络请求）
export function warmArt(list = []) {
  for (const p of list) request(p);
}

export function warmAllArt() {
  warmArt([
    ...BG_NAMES.map(ART.bg),
    ...HERO_IDS.map(ART.hero),
    ...CHEST_KINDS.map(ART.chest),
    ...SIEGE_IDS.map(ART.siege),
  ]);
}

/** 以 (cx, cy) 为中心等比 contain 绘制；返回是否真的画了位图。 */
export function drawArt(ctx, logical, cx, cy, maxW, maxH, opt = {}) {
  const img = getArt(logical);
  if (!img) return false;
  const {
    flip = false, alpha = 1, rotate = 0, shadow = 0, offsetY = 0,
  } = opt;
  const iw = img.width || 1;
  const ih = img.height || 1;
  const s = Math.min(maxW / iw, maxH / ih);
  const w = iw * s;
  const h = ih * s;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy + offsetY);
  if (rotate) ctx.rotate(rotate);
  if (flip) ctx.scale(-1, 1);
  if (shadow > 0) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = shadow;
  }
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

/** 全屏 cover 铺底，用于暖褐暗金插画背景。 */
export function drawBackdrop(ctx, logical, W, H, opt = {}) {
  const img = getArt(logical);
  if (!img) return false;
  const iw = img.width || 1;
  const ih = img.height || 1;
  const s = Math.max(W / iw, H / ih);
  const w = iw * s;
  const h = ih * s;
  ctx.save();
  ctx.globalAlpha = opt.alpha ?? 1;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  ctx.restore();
  return true;
}

// 给校验脚本 / 验收页读取：确认素材真的被加载进渲染层，而不是只躺在包里。
export function artStats() {
  let ready = 0;
  let pending = 0;
  for (const rec of cache.values()) {
    if (rec.img) ready += 1;
    else pending += 1;
  }
  return { enabled, ready, pending, waiting: waiting.size, total: cache.size };
}

export function resetArtForTest() {
  cache.clear();
  waiting.clear();
  loadImageImpl = null;
  enabled = true;
}
