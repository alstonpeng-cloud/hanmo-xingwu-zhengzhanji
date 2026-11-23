// 声音管理：主 BGM / 商城 BGM 双轨缓存 + 音效（播放器由 platform.audio 提供）
// 逻辑层不依赖 DOM：负责「按场景切 BGM、音量、静音、音效节流、主曲缺失时回退」
// 切场景时只暂停 / 恢复两套缓存播放器，不销毁重建，尽量不打断正在播的音乐。
import { CONFIG } from '../data/config.js';
import { resolveAsset, onPackageReady } from './subpackage.js';

let backend = null;
let unsubPackage = null;
let enabled = true;
let bgmVolume = CONFIG.audio.bgmVolume;
let sfxVolume = CONFIG.audio.sfxVolume;

let desiredKind = 'main';    // 'main' | 'shop' | 'none'
// 浏览器 / WebView 的自动播放策略：没有用户手势前一律不出声。
// 这里用显式门禁兜住所有 play() 调用（Trae 内置浏览器等环境默认允许自动播放，
// 只靠浏览器拦截并不保险）。
let hasGesture = false;
const tracks = new Map();    // kind -> { kind, player, fallback, gaveUp, token }

const players = new Map();   // 音效名 → 播放器（平台内部做多声道复用）
const lastPlayed = new Map(); // 音效名 → 上次播放时间（节流）

function clampVolume(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function createMusic(src, onFail) {
  if (!backend || !backend.createMusic) return null;
  let player = null;
  try {
    player = backend.createMusic(src, { loop: CONFIG.audio.bgm.loop !== false, volume: bgmVolume });
  } catch (e) {
    return null;
  }
  if (!player) return null;
  if (onFail && player.onError) player.onError(onFail);
  return player;
}

// 给某条 BGM 装播放器；主曲加载失败时在同一条轨上换成 fallback，不切到商城轨
function loadTrack(rec, src, allowFallback) {
  const conf = CONFIG.audio.bgm[rec.kind];
  const token = ++rec.token;
  const player = createMusic(src, () => {
    if (rec.token !== token) return;
    if (allowFallback && conf && conf.fallback && !rec.fallback) {
      rec.fallback = true;
      if (rec.player) {
        try { rec.player.destroy(); } catch (e) {}
        rec.player = null;
      }
      loadTrack(rec, conf.fallback, false);
      if (desiredKind === rec.kind && enabled) playKind(rec.kind);
      return;
    }
    if (rec.player) {
      try { rec.player.destroy(); } catch (e) {}
      rec.player = null;
    }
    rec.gaveUp = true;
  });
  rec.player = player;
  if (player) player.setVolume(bgmVolume);
}

function ensureTrack(kind) {
  const conf = CONFIG.audio.bgm[kind];
  if (!conf) return null;
  let rec = tracks.get(kind);
  if (!rec) {
    rec = { kind, player: null, fallback: false, gaveUp: false, pendingUpgrade: false, token: 0 };
    tracks.set(kind, rec);
  }
  if (!rec.player && !rec.gaveUp) {
    const real = resolveAsset(conf.src);
    if (real === null) {
      // 高音质主曲还在分包里：先用主包 48KB 占位循环顶上，避免首屏静音。
      // 分包就绪后 upgradeTracks() 会在同一条轨道上换成正式曲目。
      rec.pendingUpgrade = true;
      if (conf.fallback) loadTrack(rec, conf.fallback, false);
    } else {
      rec.pendingUpgrade = false;
      rec.fallback = false;
      loadTrack(rec, real, true);
    }
  }
  return rec;
}

// 分包下载完成：把「占位循环」平滑升级为高音质主曲，不断开正在播放的场景轨。
function upgradeTracks() {
  if (!backend) return;
  for (const [kind, rec] of tracks) {
    if (!rec.pendingUpgrade) continue;
    const conf = CONFIG.audio.bgm[kind];
    const real = conf && resolveAsset(conf.src);
    if (!real) continue;
    rec.pendingUpgrade = false;
    rec.gaveUp = false;
    rec.fallback = false;
    if (rec.player) {
      try { rec.player.destroy(); } catch (e) {}
      rec.player = null;
    }
    loadTrack(rec, real, true);
  }
  if (desiredKind !== 'none' && enabled && hasGesture) playKind(desiredKind);
}

function pauseAllMusic() {
  for (const rec of tracks.values()) {
    if (rec.player) {
      try { rec.player.setVolume(0); } catch (e) {}
      try { rec.player.pause(); } catch (e) {}
    }
  }
}

// 淡出后暂停：平台播放器提供 fadeOut 就用它，否则退化为「静音 + 暂停」
function fadeOutMusic(ms = 450) {
  for (const rec of tracks.values()) {
    if (!rec.player) continue;
    if (typeof rec.player.fadeOut === 'function') {
      try { rec.player.fadeOut(ms); } catch (e) {}
    } else {
      try { rec.player.setVolume(0); } catch (e) {}
      try { rec.player.pause(); } catch (e) {}
    }
  }
}

function playKind(kind) {
  desiredKind = CONFIG.audio.bgm[kind] ? kind : 'main';
  if (!backend || !enabled) return;
  // 没有用户手势：只记住「想放哪首」，不创建播放器、不调用 play()。
  // 玩家第一次按下时由 unlockAudio() 补播当前场景。
  if (!hasGesture) return;

  // 先把「非当前场景」的 BGM 静音 + 暂停：即使某些平台 pause 有延迟 / 失败，
  // 也不会出现主 BGM 与商城 BGM 同时出声。
  for (const [k, rec] of tracks) {
    if (k === desiredKind || !rec.player) continue;
    try { rec.player.setVolume(0); } catch (e) {}
    try { rec.player.pause(); } catch (e) {}
  }

  const rec = ensureTrack(desiredKind);
  if (rec && rec.player) {
    try { rec.player.setVolume(bgmVolume); } catch (e) {}
    try { rec.player.play(); } catch (e) {}
  }
}

// 初始化 / 重置（Game 构造时调用一次；存档里的开关与音量作为初始状态）
export function initAudio(audioBackend, opts = {}) {
  for (const rec of tracks.values()) {
    if (rec.player) {
      try { rec.player.destroy(); } catch (e) {}
    }
  }
  tracks.clear();
  for (const p of players.values()) {
    try { p.destroy(); } catch (e) {}
  }
  players.clear();
  lastPlayed.clear();
  desiredKind = 'main';
  hasGesture = false;   // 新会话 / 重置后重新等用户手势
  backend = audioBackend || null;
  enabled = opts.enabled !== false;
  bgmVolume = clampVolume(opts.bgmVolume ?? CONFIG.audio.bgmVolume, CONFIG.audio.bgmVolume);
  sfxVolume = clampVolume(opts.sfxVolume ?? CONFIG.audio.sfxVolume, CONFIG.audio.sfxVolume);
  // 不自动起 BGM：由 Game.syncBgm 根据当前页面（主 / 商城）决定
  // 订阅高音质 BGM 分包：就绪时把占位循环升级成正式主曲（本地预览会立即回调）。
  if (unsubPackage) {
    try { unsubPackage(); } catch (e) {}
    unsubPackage = null;
  }
  unsubPackage = onPackageReady('audio', () => upgradeTracks());
}

export function isAudioEnabled() {
  return enabled;
}

// 总开关（BGM 与音效一起；状态由调用方写进存档）
export function setAudioEnabled(on) {
  enabled = !!on;
  if (!enabled) {
    pauseAllMusic();
    return;
  }
  if (desiredKind !== 'none') playKind(desiredKind);
}
// 切换 BGM 场景：'main' 首页 / 战斗 / 大部分页面；'shop' 商城；'none' 暂停全部
export function startBgm(kind = 'main') {
  playKind(kind);
}

export function stopBgm() {
  desiredKind = 'none';
  pauseAllMusic();
}

// 浏览器要求「先有用户手势」才允许出声：第一次按下时解锁并补播当前场景 BGM
export function unlockAudio() {
  hasGesture = true;
  if (!backend || !enabled || desiredKind === 'none') return;
  playKind(desiredKind);
}

// 页面切到后台 / 被隐藏：暂停并淡出，避免在后台继续出声
export function suspendForVisibility() {
  fadeOutMusic(450);
}

// 页面恢复可见：只有「已经有手势 + 声音开着 + 场景要 BGM」时才续播
export function resumeForVisibility() {
  if (!backend || !enabled || !hasGesture || desiredKind === 'none') return;
  playKind(desiredKind);
}

export function setBgmVolume(v) {
  bgmVolume = clampVolume(v, bgmVolume);
  // 只有当前场景的 BGM 用新音量；另一条轨道保持静音，避免两边同时出声
  for (const [kind, rec] of tracks) {
    if (!rec.player) continue;
    try { rec.player.setVolume(kind === desiredKind && enabled ? bgmVolume : 0); } catch (e) {}
  }
}

export function setSfxVolume(v) {
  sfxVolume = clampVolume(v, sfxVolume);
  for (const p of players.values()) {
    try { p.setVolume(sfxVolume); } catch (e) {}
  }
}

export function getBgmVolume() {
  return bgmVolume;
}

export function getSfxVolume() {
  return sfxVolume;
}

// 播放音效：volume 是相对音量；同名音效做节流，避免集火时几十个声音同时炸开
export function playSfx(name, opts = {}) {
  if (!backend || !enabled) return;
  const src = CONFIG.audio.sounds[name];
  if (!src || !backend.createSound) return;
  const now = Date.now();
  const gap = (CONFIG.audio.gaps && CONFIG.audio.gaps[name]) ?? CONFIG.audio.minGapMs ?? 40;
  const last = lastPlayed.get(name);
  if (!opts.force && last !== undefined && now - last < gap) return;
  lastPlayed.set(name, now);

  let player = players.get(name);
  if (!player) {
    try {
      player = backend.createSound(src, {
        volume: sfxVolume,
        voices: CONFIG.audio.maxVoices,
      });
    } catch (e) {
      player = null;
    }
    if (!player) return;
    players.set(name, player);
  }
  try {
    player.play(opts.volume ?? 1);
  } catch (e) {}
}

// 内部状态查询（供自动化测试）
export function audioState() {
  const main = tracks.get('main');
  const shop = tracks.get('shop');
  return {
    enabled,
    hasGesture,
    hasBackend: !!backend,
    hasMusic: [...tracks.values()].some((rec) => !!rec.player),
    desiredKind,
    tracks: [...tracks.keys()],
    mainReady: !!(main && main.player),
    shopReady: !!(shop && shop.player),
    usingFallback: !!(main && main.fallback),
    pendingUpgrade: !!(main && main.pendingUpgrade),
    bgmVolume,
    sfxVolume,
  };
}

export function destroyAudio() {
  initAudio(null, { enabled: false });
}
