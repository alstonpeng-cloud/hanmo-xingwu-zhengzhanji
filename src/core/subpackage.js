// 分包资源调度：主包只带首屏必需资源，高音质 BGM / 英雄立绘 / 器械与装饰贴图进入后静默下载。
// 纯逻辑模块，不依赖 DOM。本地预览与自动化环境一律视为「素材在原路径、全部就绪」。
// 映射表来自 asset-routes.js（微信版由构建脚本按真实素材生成）。
import { ASSET_MAP } from './asset-routes.js';

// 下载优先级：先让声音到位，再补立绘与贴图；同类素材按分包整体下载，避免多次握手。
const PACKAGE_ORDER = ['audio', 'heroes', 'siege', 'art'];
const MAX_RETRY = 2;

const state = new Map();       // name -> { status, progress, attempts, promise }
const listeners = new Set();   // { name, cb }
let started = false;
let settled = false;

function wxEnv() {
  return typeof wx !== 'undefined' && typeof wx.loadSubpackage === 'function';
}

function recOf(name) {
  let rec = state.get(name);
  if (!rec) {
    rec = { status: 'idle', progress: 0, attempts: 0, promise: null };
    state.set(name, rec);
  }
  return rec;
}

function emit(name) {
  for (const item of [...listeners]) {
    if (item.name !== name) continue;
    listeners.delete(item);
    try { item.cb(name); } catch (e) {}
  }
}

/**
 * 资源逻辑路径 → 当前环境可用的真实路径。
 * 主包资源 / 本地预览：原样返回；分包资源未就绪：返回 null，由业务层走主包占位或程序化绘制。
 */
export function resolveAsset(logical) {
  if (!logical || typeof logical !== 'string') return logical;
  const hit = ASSET_MAP[logical];
  if (!hit) return logical;
  if (!wxEnv()) return logical;
  const rec = state.get(hit.pkg);
  if (!rec || rec.status !== 'ready') return null;
  return hit.path;
}

// 该资源属于哪个分包（不属于返回 null），供界面提示「素材准备中」使用。
export function assetPackage(logical) {
  const hit = logical && ASSET_MAP[logical];
  return hit ? hit.pkg : null;
}

export function isPackageReady(name) {
  if (!wxEnv()) return true;
  const rec = state.get(name);
  return !!(rec && rec.status === 'ready');
}

// 订阅单个分包就绪（一次性）；已就绪或本地预览时立即回调。
export function onPackageReady(name, cb) {
  if (typeof cb !== 'function') return () => {};
  if (isPackageReady(name)) {
    try { cb(name); } catch (e) {}
    return () => {};
  }
  const item = { name, cb };
  listeners.add(item);
  return () => listeners.delete(item);
}

// 状态快照：界面可做「素材准备中 62%」提示，校验脚本也可直接读取。
export function packageSnapshot() {
  const packages = {};
  for (const [name, rec] of state) {
    packages[name] = {
      status: rec.status,
      progress: rec.progress,
      attempts: rec.attempts,
    };
  }
  return { env: wxEnv() ? 'wx' : 'local', started, settled, packages };
}

function loadOne(name, opts = {}) {
  const rec = recOf(name);
  if (rec.status === 'ready') return Promise.resolve(true);
  if (rec.promise) return rec.promise;
  rec.status = 'loading';
  const delay = Number(opts.retryDelay ?? 900);
  rec.promise = new Promise((resolve) => {
    const attempt = () => {
      rec.attempts += 1;
      const retry = () => {
        if (rec.attempts <= MAX_RETRY) {
          setTimeout(attempt, delay * rec.attempts);
          return;
        }
        rec.status = 'failed';
        rec.progress = 0;
        rec.promise = null;
        resolve(false);
      };
      let task = null;
      try {
        task = wx.loadSubpackage({
          name,
          success: () => {
            rec.status = 'ready';
            rec.progress = 100;
            emit(name);
            resolve(true);
          },
          fail: () => retry(),
        });
      } catch (e) {
        retry();
        return;
      }
      if (task && typeof task.onProgressUpdate === 'function') {
        try {
          task.onProgressUpdate((res) => {
            rec.progress = Math.max(0, Math.min(100, Number(res && res.progress) || 0));
            if (typeof opts.onProgress === 'function') {
              try { opts.onProgress(name, rec.progress); } catch (e) {}
            }
          });
        } catch (e) {}
      }
    };
    attempt();
  });
  return rec.promise;
}

export function initPackages(names = []) {
  for (const name of names) recOf(name);
  if (!wxEnv()) {
    for (const rec of state.values()) {
      rec.status = 'ready';
      rec.progress = 100;
    }
    settled = true;
    for (const name of state.keys()) emit(name);
  }
}

/**
 * 进入游戏后按优先级静默下载。names 由微信入口按 game.json 里真实声明的分包传入，
 * 不下载不存在的分包；单个包失败重试 2 次后标记 failed，业务层保持主包回退。
 */
export async function startSubpackageDownloads(names = [], opts = {}) {
  if (started) return packageSnapshot();
  started = true;
  const rank = (n) => {
    const i = PACKAGE_ORDER.indexOf(n);
    return i < 0 ? PACKAGE_ORDER.length : i;
  };
  const order = [...names].sort((a, b) => rank(a) - rank(b));
  initPackages(order);
  if (!wxEnv()) return packageSnapshot();
  for (const name of order) {
    await loadOne(name, opts);
    if (typeof opts.onPackageDone === 'function') {
      try { opts.onPackageDone(name, state.get(name).status); } catch (e) {}
    }
  }
  settled = true;
  if (typeof opts.onSettled === 'function') {
    try { opts.onSettled(packageSnapshot()); } catch (e) {}
  }
  return packageSnapshot();
}

// 按需下载（进入招募页再要英雄立绘等场景），与静默下载共用同一份状态与重试逻辑。
export function ensureSubpackage(name, opts = {}) {
  if (!wxEnv()) return Promise.resolve(true);
  recOf(name);
  return loadOne(name, opts);
}

// 重置调度状态：换账号 / 重新进入 / 校验脚本都可用。
export function resetPackages() {
  state.clear();
  listeners.clear();
  started = false;
  settled = false;
}
