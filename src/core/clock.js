// 可信时钟：防止玩家改本机 / 地区时间刷挂机、签到、广告、每日奖励。
//
// 背景：旧代码所有发奖路径都直接用 Date.now()，玩家只要把系统时间往前调，
// 就能反复吃满 8 小时挂机、跨天重置每日 / 广告 / 签到。dateKey 用 UTC+8
// 只对「时区」免疫，对「改系统时间」毫无防护。
//
// 三重防护（都不需要后端）：
//  1) 会话内单调：用 performance.now() 的差值推算时间，会话中改系统时间无效。
//  2) 启动时高水位钳制：拿存档里的 lastSeen 卡住本机时间。往前跳超过容忍值
//     时，先按 lastSeen + 容忍值起步——服务器时间回包前这段时间不给大额奖励。
//  3) 服务器校准：微信平台异步调用 wx.getServerTime() 重新锚定真实时间。
//     玩家改本机时间不影响服务器返回值，这是真机上的最终真相。
//
// 约定：所有「发奖 / 计时」代码必须用 now() 取时间，禁止直接 Date.now()。

// 单调时钟：微信小游戏与浏览器都提供 performance.now
function monoNow() {
  return (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();
}

// 允许的本机时间前跳：超过这个值就先按高水位处理（等服务器校准）
const FORWARD_TOLERANCE_MS = 5 * 60 * 1000;

let anchorMs = Date.now();
let anchorMono = monoNow();
let serverSynced = false;

// 可信的「当前毫秒时间戳」，可直接替换原来的 Date.now()
export function now() {
  return anchorMs + (monoNow() - anchorMono);
}

export function isServerSynced() {
  return serverSynced;
}

// 用给定时间戳重新锚定（微信服务器回包 / 测试用）
export function rebase(serverMs) {
  if (!Number.isFinite(serverMs) || serverMs <= 0) return false;
  anchorMs = Math.floor(serverMs);
  anchorMono = monoNow();
  serverSynced = true;
  return true;
}

// 游戏启动时调用：
//   - 先按存档 lastSeen 钳制本机时间（挡住开机瞬间的前跳）
//   - 再用微信服务器时间校准（真机上的权威时间）
// lastSeenMs 传存档里的 lastSeen；没有存档时用本机时间。
export function initClock(platform, lastSeenMs) {
  const local = Date.now();
  const seen = Number.isFinite(lastSeenMs) && lastSeenMs > 0 ? Math.floor(lastSeenMs) : local;
  // 回拨（本机时间比存档还早）或被改到很远的未来：都以高水位为锚
  anchorMs = local < seen - FORWARD_TOLERANCE_MS
    ? seen
    : Math.min(local, seen + FORWARD_TOLERANCE_MS);
  anchorMono = monoNow();
  serverSynced = false;

  if (!platform || typeof platform.getServerTime !== 'function') {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    try {
      platform.getServerTime({
        success: (res) => finish(rebase(res && res.time)),
        fail: () => finish(false),
      });
    } catch (_) {
      finish(false);
    }
    // 服务器无响应时不阻塞游戏：2 秒后用钳制过的本机锚点继续
    if (typeof setTimeout === 'function') setTimeout(() => finish(false), 2000);
  });
}
