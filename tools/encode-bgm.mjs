// 把外部 BGM 压缩成微信小游戏可用的体积：node tools/encode-bgm.mjs <原文件路径>
// 默认输出 assets/audio/glorious_morning.mp3（80 kbps / 44.1kHz / 立体声，主包仍能装进 4 MB）
// 需要 devDependency ffmpeg-static（npm install 时自动下载 ffmpeg 可执行文件）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const input = process.argv[2] || process.env.BGM_SRC;
if (!input) {
  console.error('用法：node tools/encode-bgm.mjs "<你的 Glorious Morning.mp3>"');
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error(`找不到输入文件：${input}`);
  process.exit(1);
}

const out = path.join(ROOT, 'assets', 'audio', 'glorious_morning.mp3');
fs.mkdirSync(path.dirname(out), { recursive: true });

console.log(`输入：${input}`);
console.log('正在压缩为 80 kbps MP3（保证微信小游戏主包 < 4 MB）...');
execFileSync(ffmpegPath, [
  '-hide_banner',
  '-y',
  '-i', input,
  '-vn',
  '-map', '0:a:0',
  '-codec:a', 'libmp3lame',
  '-b:a', '80k',
  '-ac', '2',
  '-ar', '44100',
  '-write_xing', '1',
  out,
], { stdio: 'inherit' });

const size = fs.statSync(out).size;
console.log(`已生成：${path.relative(ROOT, out)}（${(size / 1024 / 1024).toFixed(2)} MB）`);
if (size > 2 * 1024 * 1024) {
  console.warn('提示：文件仍偏大，建议截短或降到 64 kbps，否则微信主包可能超过 4 MB。');
}
