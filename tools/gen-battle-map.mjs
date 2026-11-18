// 生成黄巾之乱主题战场地图预览（导出 PNG，方便直接查看 / 当宣传素材）
// 游戏内实际战场是运行时按同一套地形装饰程序化绘制（不占微信包体）。
// 用法：node tools/gen-battle-map.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { CONFIG } from '../src/data/config.js';
import { makeCamera } from '../src/render/camera.js';
import { drawArenaField } from '../src/render/arenaField.js';

const SCALE = 2; // 2 倍导出：1500 × 2208
const W = 750 * SCALE;
const H = 1104 * SCALE;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// 地图外围的深土色底，避免四角透明
ctx.fillStyle = '#170f08';
ctx.fillRect(0, 0, W, H);

const view = { x: 0, y: 0, w: W, h: H };
const cam = makeCamera(view, { y: CONFIG.arena.rows / 2 });
drawArenaField(ctx, cam, { labels: false });

const outDir = path.resolve('docs', 'preview');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'huangjin_battle_map.png');
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log(`已生成战场地图预览：${path.relative(process.cwd(), out)}（${Math.round(fs.statSync(out).size / 1024)} KB，${W}×${H}）`);
console.log('游戏内战场由 src/render/arenaField.js 程序化绘制，同一套黄沙 / 碎石 / 枯草 / 黄巾旗。');
