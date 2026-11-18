import { Game } from './game.js';
import { createWebPlatform } from './platform/web.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const platform = createWebPlatform(canvas);
const game = new Game(canvas, ctx, platform);

let last = platform.now();
let failStreak = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // 帧级兜底：单帧异常不黑屏，下一帧继续画；连续失败由 Game 做安全恢复
  try {
    game.update(dt);
    game.draw();
    failStreak = 0;
  } catch (e) {
    failStreak += 1;
    try { game.onFrameError(e, failStreak); } catch (err) {}
  }
  platform.requestFrame(loop);
}
platform.requestFrame(loop);

// 方便调试
window.__game = game;
