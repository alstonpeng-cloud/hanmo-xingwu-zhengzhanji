// 微信小游戏平台适配层（与 platform/web.js 接口一致）
// 只在微信小游戏环境里被 game.js 引用；浏览器试玩版走 web.js。
// 注意：小游戏里第一个 wx.createCanvas() 就是上屏 Canvas，之后的都是离屏 Canvas。

const PLACEHOLDER_AD_UNIT = 'adunit-xxxxxxxxxxxxxxxx';

function clampVolume(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

// 声音：微信小游戏用 InnerAudioContext（本地包内路径可直接播放）
// 音效同样用对象池做多声道复用；BGM 单独一个循环播放器，加载失败时回调 onError
function createWxAudio() {
  if (typeof wx === 'undefined' || !wx.createInnerAudioContext) return null;
  try {
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({ obeyMuteSwitch: true, mixWithOther: true });
    }
  } catch (e) {}
  return {
    createSound(src, opt = {}) {
      let base = clampVolume(opt.volume ?? 1);
      const voices = Math.max(1, opt.voices || 2);
      const pool = [];
      for (let i = 0; i < voices; i++) {
        const a = wx.createInnerAudioContext();
        a.autoplay = false;
        a.loop = false;
        a.volume = base;
        a.src = src;
        // 单条音效加载 / 播放失败时静默停掉，不影响其它声道与游戏主流程
        try {
          a.onError(() => { try { a.stop(); } catch (e) {} });
        } catch (e) {}
        pool.push(a);
      }
      let idx = 0;
      return {
        play(volume = 1) {
          const a = pool[idx++ % pool.length];
          try {
            a.stop();
            a.seek(0);
            a.volume = clampVolume(base * volume);
            a.play();
          } catch (e) {}
        },
        stop() {
          pool.forEach((a) => { try { a.stop(); } catch (e) {} });
        },
        setVolume(v) {
          base = clampVolume(v);
          pool.forEach((a) => { a.volume = base; });
        },
        destroy() {
          pool.forEach((a) => { try { a.destroy(); } catch (e) {} });
        },
      };
    },
    createMusic(src, opt = {}) {
      let a = null;
      try {
        a = wx.createInnerAudioContext();
        a.autoplay = false;
        a.loop = opt.loop !== false;
        a.volume = clampVolume(opt.volume ?? 1);
        a.src = src;
      } catch (e) {
        return null;
      }
      let onError = null;
      let failed = false;
      try {
        a.onError(() => {
          failed = true;
          if (onError) onError();
        });
      } catch (e) {}
      return {
        play() {
          try { a.play(); } catch (e) {}
        },
        pause() {
          try { a.pause(); } catch (e) {}
        },
        setVolume(v) {
          try { a.volume = clampVolume(v); } catch (e) {}
        },
        // 小游戏切后台同样淡出再暂停（定时器可能被节流，最终仍会静音并暂停）
        fadeOut(ms = 450) {
          let v = clampVolume(a.volume);
          const step = Math.max(1, Math.round(ms / 12));
          const timer = setInterval(() => {
            v = Math.max(0, v - (1 / 12));
            try { a.volume = v; } catch (e) {}
            if (v <= 0) {
              clearInterval(timer);
              try { a.pause(); } catch (e) {}
            }
          }, step);
          if (typeof timer === 'object' && timer.unref) timer.unref();
        },
        onError(cb) {
          onError = cb;
          if (failed) cb();
        },
        destroy() {
          try { a.destroy(); } catch (e) {}
        },
      };
    },
  };
}

export function createWxPlatform(options = {}) {
  let sys = wx.getSystemInfoSync();
  const canvas = wx.createCanvas();          // 上屏 Canvas
  const adUnitId = (options.adUnitId || '').trim();

  // 分享：开启右上角胶囊的被动分享（onShareAppMessage 返回卡片内容）。
  // 不开 withShareTicket：小游戏本地无法据此判定"发到了群"，
  // 它还会强制单选联系人、禁止二次转发，反而伤害传播。
  try {
    if (typeof wx.showShareMenu === 'function') wx.showShareMenu({ menus: ['shareAppMessage'] });
    if (typeof wx.onShareAppMessage === 'function') {
      wx.onShareAppMessage(() => ({ title: '汉末行伍征战记：排兵布阵，征战天下' }));
    }
  } catch (e) { /* 分享能力不可用不影响游戏本体 */ }

  // 屏幕旋转 / 窗口变化时刷新尺寸（竖屏小游戏一般不会触发，保险起见）
  if (typeof wx.onWindowResize === 'function') {
    wx.onWindowResize(() => { sys = wx.getSystemInfoSync(); });
  }

  // 双指缩放状态
  let pinchCb = null;
  let pinchOn = false;
  let pinchPrev = 0;
  const touchPair = (e) => {
    const ts = (e && e.touches) || [];
    if (ts.length < 2) return null;
    const a = ts[0];
    const b = ts[1];
    return {
      d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      cx: (a.clientX + b.clientX) / 2,
      cy: (a.clientY + b.clientY) / 2,
    };
  };
  const emitPinch = (phase, scale, cx, cy) => {
    if (pinchCb) pinchCb(scale, cx, cy, phase);
  };

  const storage = {
    getItem(key) {
      try {
        const v = wx.getStorageSync(key);
        return v === '' || v === undefined ? null : v;
      } catch (e) {
        return null;
      }
    },
    setItem(key, value) {
      try {
        wx.setStorageSync(key, value);
      } catch (e) {
        /* 存储不可写时游戏仍可继续（只是不存档） */
      }
    },
    removeItem(key) {
      try {
        wx.removeStorageSync(key);
      } catch (e) {}
    },
  };

  // 激励视频：广告位 ID 未配置时返回 null，游戏会自动使用内置的"模拟广告"，
  // 这样开通流量主之前也能完整跑通"看广告恢复等级"的流程。
  let rewardedAd = null;
  if (adUnitId && adUnitId !== PLACEHOLDER_AD_UNIT) {
    const ad = wx.createRewardedVideoAd({ adUnitId });
    rewardedAd = () =>
      new Promise((resolve) => {
        let settled = false;
        const done = (result) => {
          if (settled) return;
          settled = true;
          ad.offClose(onClose);
          ad.offError(onError);
          resolve(result);
        };
        const onClose = (res) => {
          // res.isEnded === true 表示完整看完；旧版本 res 为空时按看完处理
          done(!res || res.isEnded ? 'finish' : 'interrupt');
        };
        const onError = () => done('interrupt');
        ad.onClose(onClose);
        ad.onError(onError);
        ad.show().catch(() => ad.load().then(() => ad.show()).catch(() => done('interrupt')));
      });
  }

  return {
    name: 'wx',
    canvas,
    storage,
    viewport() {
      return { width: sys.windowWidth, height: sys.windowHeight };
    },
    pixelRatio() {
      return Math.min(3, sys.pixelRatio || 1);
    },
    createCanvas(w, h) {
      const c = wx.createCanvas();
      c.width = w;
      c.height = h;
      return c;
    },
    // 真实美术替换用：assets/sprites/*.png 存在时自动用图，不存在则回退程序化生成
    loadImage(src, cb) {
      const img = wx.createImage();
      img.onload = () => cb(img);
      img.onerror = () => cb(null);
      img.src = src;
    },
    now() {
      return Date.now();
    },
    // 服务器时间：核心发奖逻辑用它校准可信时钟，防玩家改本机时间刷奖励。
    // getServerTime 基础库 1.9.90+ 支持；失败由 clock.js 回退本机锚点，不影响游戏。
    getServerTime(opts) {
      if (typeof wx.getServerTime !== 'function') {
        if (opts && opts.fail) opts.fail({ errMsg: 'getServerTime:unsupported' });
        return;
      }
      wx.getServerTime(opts);
    },
    requestFrame(cb) {
      if (canvas.requestAnimationFrame) return canvas.requestAnimationFrame(cb);
      return requestAnimationFrame(cb);
    },
    onTap(handler) {
      // 小游戏触摸坐标已是逻辑像素，与铺满整屏的上屏 Canvas 对齐
      wx.onTouchStart((e) => {
        const pair = touchPair(e);
        if (pair) {
          pinchOn = true;
          pinchPrev = pair.d;
          emitPinch('start', 1, pair.cx, pair.cy);
          return;
        }
        const t = e.touches && e.touches[0];
        if (!t) return;
        handler(t.clientX, t.clientY);
      });
    },
    onMove(handler) {
      wx.onTouchMove((e) => {
        const pair = touchPair(e);
        if (pair) {
          if (!pinchOn) {
            pinchOn = true;
            pinchPrev = pair.d;
            emitPinch('start', 1, pair.cx, pair.cy);
            return;
          }
          const scale = pinchPrev > 0 ? pair.d / pinchPrev : 1;
          pinchPrev = pair.d;
          if (Math.abs(scale - 1) > 1e-4) emitPinch('move', scale, pair.cx, pair.cy);
          return;
        }
        const t = e.touches && e.touches[0];
        if (!t) return;
        handler(t.clientX, t.clientY);
      });
    },
    onUp(handler) {
      const end = (e) => {
        if (pinchOn) {
          if (!e.touches || e.touches.length < 2) {
            pinchOn = false;
            pinchPrev = 0;
            emitPinch('end', 1, 0, 0);
          }
          return;
        }
        // touchend / touchcancel 时 touches 已清空，用 changedTouches 取最后一帧位置
        const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
        if (!t) return;
        handler(t.clientX, t.clientY);
      };
      wx.onTouchEnd(end);
      if (typeof wx.onTouchCancel === 'function') wx.onTouchCancel(end);
    },
    onPinch(handler) {
      pinchCb = handler;
    },
    // 小游戏切后台 / 回前台：hidden 时暂停 BGM，回来再续播
    onVisibility(handler) {
      if (typeof wx.onHide === 'function') wx.onHide(() => handler(false));
      if (typeof wx.onShow === 'function') wx.onShow(() => handler(true));
    },
    // 音频被系统打断（来电 / 其它 App 抢占）：暂停 BGM，结束后再续播
    onAudioInterruption(handler) {
      if (typeof wx.onAudioInterruptionBegin === 'function') {
        wx.onAudioInterruptionBegin(() => handler(false));
      }
      if (typeof wx.onAudioInterruptionEnd === 'function') {
        wx.onAudioInterruptionEnd(() => handler(true));
      }
    },
    // 全局错误兜底：交给 Game 记录并做安全恢复，避免一直黑屏
    onError(handler) {
      if (typeof wx.onError === 'function') wx.onError((err) => handler(err));
      if (typeof wx.onUnhandledRejection === 'function') {
        wx.onUnhandledRejection((res) => handler(res && res.reason ? res.reason : res));
      }
    },
    rewardedAd,
    // 主动分享：只调起分享面板。微信 2021-10 起 wx.shareAppMessage 不再回调
    // success/fail/complete，奖励由结算页在点开面板时立即发放（shareNow）
    share(opts = {}) {
      try {
        wx.shareAppMessage({
          title: opts.title || '汉末行伍征战记：排兵布阵，征战天下',
          imageUrl: opts.imageUrl,
        });
      } catch (e) { /* 非微信环境静默：奖励已在调用前发放 */ }
    },
    audio: createWxAudio(),
    vibrate() {
      try {
        wx.vibrateShort({ type: 'light' });
      } catch (e) {}
    },
  };
}

export { PLACEHOLDER_AD_UNIT };
