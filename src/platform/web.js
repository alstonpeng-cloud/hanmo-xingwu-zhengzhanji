// Web 平台适配层：存储 + 离屏 Canvas + 点击输入
// 移植微信小游戏时，照这个接口再写一个 platform/wx.js 即可（存储换 wx.setStorageSync，
// 广告换 wx.createRewardedVideoAd，输入换 wx.onTouchStart）。

// 声音：用 HTMLAudioElement（浏览器自带，不需要 WebAudio 解码）
// 音效用小对象池做多声道复用；BGM 单独一个元素，循环播放并在真实文件缺失时回调 onError
function clampVolume(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

// 单文件版（三国小兵军团.html）会把音效内联成 data URI，放在 __AUDIO_EMBED 里；
// 普通服务器版没有这个变量，直接走相对路径 assets/audio/...
function resolveAudioSrc(src) {
  try {
    if (typeof __AUDIO_EMBED !== 'undefined' && __AUDIO_EMBED && __AUDIO_EMBED[src]) {
      return __AUDIO_EMBED[src];
    }
  } catch (e) {}
  return src;
}

function createWebAudio() {
  if (typeof Audio === 'undefined') return null;
  return {
    createSound(src, opt = {}) {
      let base = clampVolume(opt.volume ?? 1);
      const voices = Math.max(1, opt.voices || 2);
      const pool = [];
      const url = resolveAudioSrc(src);
      for (let i = 0; i < voices; i++) {
        const el = new Audio(url);
        el.preload = 'auto';
        el.volume = base;
        pool.push(el);
      }
      let idx = 0;
      return {
        play(volume = 1) {
          const el = pool[idx++ % pool.length];
          try {
            el.pause();
            el.currentTime = 0;
            el.volume = clampVolume(base * volume);
            const p = el.play();
            if (p && p.catch) p.catch(() => {});
          } catch (e) {}
        },
        stop() {
          pool.forEach((el) => { try { el.pause(); el.currentTime = 0; } catch (e) {} });
        },
        setVolume(v) {
          base = clampVolume(v);
          pool.forEach((el) => { el.volume = base; });
        },
        destroy() {
          pool.forEach((el) => { try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {} });
        },
      };
    },
    createMusic(src, opt = {}) {
      const el = new Audio();
      el.preload = 'auto';
      el.loop = opt.loop !== false;
      el.volume = clampVolume(opt.volume ?? 1);
      let onError = null;
      let failed = false;
      el.addEventListener('error', () => {
        failed = true;
        if (onError) onError();
      });
      el.src = resolveAudioSrc(src);
      return {
        play() {
          try {
            const p = el.play();
            if (p && p.catch) p.catch(() => {}); // 浏览器自动播放限制：等用户第一次点击再重试
          } catch (e) {}
        },
        pause() {
          try { el.pause(); } catch (e) {}
        },
        setVolume(v) {
          el.volume = clampVolume(v);
        },
        // 页面隐藏时淡出再暂停：约 450ms 内把音量线性降到 0，避免"啪"地一声断掉
        fadeOut(ms = 450) {
          const startVol = el.volume;
          const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const tick = () => {
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const k = Math.min(1, (now - t0) / Math.max(1, ms));
            el.volume = clampVolume(startVol * (1 - k));
            if (k >= 1) {
              try { el.pause(); } catch (e) {}
              return;
            }
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tick);
            else setTimeout(tick, 16);
          };
          try { tick(); } catch (e) { try { el.pause(); } catch (err) {} }
        },
        onError(cb) {
          onError = cb;
          if (failed) setTimeout(cb, 0);
        },
        destroy() {
          try {
            el.pause();
            el.removeAttribute('src');
            el.load();
          } catch (e) {}
        },
      };
    },
  };
}

export function createWebPlatform(canvas) {
  const storage = {
    getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        /* 忽略：隐私模式下不可写时游戏仍可玩 */
      }
    },
    removeItem(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    },
  };

  const toLogical = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // 双指缩放：记录所有按下的指针，两根手指的距离变化 → scale
  const pointers = new Map();
  let pinchCb = null;
  let pinchOn = false;
  let pinchPrev = 0;
  const emitPinch = (phase, scale, cx, cy) => {
    if (pinchCb) pinchCb(scale, cx, cy, phase);
  };
  const pinchPair = () => {
    const list = [...pointers.values()];
    if (list.length < 2) return null;
    const a = list[0];
    const b = list[1];
    return {
      d: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  };

  return {
    name: 'web',
    storage,
    viewport() {
      return { width: canvas.clientWidth, height: canvas.clientHeight };
    },
    pixelRatio() {
      return Math.min(2, window.devicePixelRatio || 1);
    },
    createCanvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    },
    // 真实美术替换用：assets/sprites/*.png 存在时自动用图，不存在则回退程序化生成
    loadImage(src, cb) {
      const img = new Image();
      img.onload = () => cb(img);
      img.onerror = () => cb(null);
      img.src = src;
    },
    now() {
      return performance.now();
    },
    requestFrame(cb) {
      return requestAnimationFrame(cb);
    },
    onTap(handler) {
      canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        const p = toLogical(e.clientX, e.clientY);
        pointers.set(e.pointerId, p);
        if (pointers.size === 1) {
          handler(p.x, p.y);
        } else if (pointers.size === 2) {
          // 第二根手指落下：进入缩放，取消单指拖拽
          pinchOn = true;
          pinchPrev = 0;
          const pair = pinchPair();
          emitPinch('start', 1, pair ? pair.cx : p.x, pair ? pair.cy : p.y);
        }
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    // 拖拽：pointermove 持续上报，pointerup / pointercancel 结束；双指时改报缩放
    onMove(handler) {
      canvas.addEventListener('pointermove', (e) => {
        if (!e.buttons && e.pointerType === 'mouse') return;
        const p = toLogical(e.clientX, e.clientY);
        if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
        if (pointers.size >= 2) {
          const pair = pinchPair();
          if (!pair) return;
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
        handler(p.x, p.y);
      });
    },
    onUp(handler) {
      let last = { x: 0, y: 0 };
      const end = (e) => {
        const p = e.clientX === undefined ? last : toLogical(e.clientX, e.clientY);
        last = p;
        pointers.delete(e.pointerId);
        if (pinchOn) {
          if (pointers.size < 2) {
            pinchOn = false;
            pinchPrev = 0;
            emitPinch('end', 1, p.x, p.y);
          }
          return;
        }
        handler(p.x, p.y);
      };
      canvas.addEventListener('pointermove', (e) => {
        last = toLogical(e.clientX, e.clientY);
      });
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
    },
    onPinch(handler) {
      pinchCb = handler;
    },
    // 页面可见性：hidden / pagehide → handler(false)；visible / pageshow → handler(true)
    onVisibility(handler) {
      const emit = (visible) => handler(visible);
      const onVisibilityChange = () => emit(!document.hidden);
      const onPageHide = () => emit(false);
      const onPageShow = () => emit(true);
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('pagehide', onPageHide);
        window.addEventListener('pageshow', onPageShow);
      }
      return () => {
        if (typeof document !== 'undefined' && document.removeEventListener) {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        }
        if (typeof window !== 'undefined' && window.removeEventListener) {
          window.removeEventListener('pagehide', onPageHide);
          window.removeEventListener('pageshow', onPageShow);
        }
      };
    },
    // null = 游戏已移除广告奖励入口（1.2.9），rewardedAd 接口仅保留给 core 遗留逻辑
    rewardedAd: null,
    // 浏览器没有微信分享：不调起任何面板；奖励已在结算页 shareNow 里发放
    share() {},
    audio: createWebAudio(),
    vibrate() {},
  };
}
