// 检查精灵表每帧有没有贴边（= 立绘被裁切）
// 覆盖：普通兵种 4 档导出 PNG（4 兵种 × 4 = 16 张）+ 12 个特殊兵种 × 4 档（运行时程序化生成，不落盘）= 64 张表
// 用法：node tools/check-bounds.mjs [代表等级 1/3/6/9，默认全部]
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/data/config.js';
import { SPRITE_TIER_LEVELS } from '../src/core/units.js';
import {
  initSprites, setTroopResolver, sheetFor, FRAME_W, FRAME_H, COLS, ACTIONS,
} from '../src/render/sprites.js';

initSprites({ createCanvas });
setTroopResolver((id) => CONFIG.troops.find((t) => t.id === id));

const dir = path.resolve('assets/sprites');
const only = process.argv[2] ? Number(process.argv[2]) : null;
const SHEET_W = FRAME_W * COLS;
const SHEET_H = FRAME_H * ACTIONS.length;

let problems = 0;
let frames = 0;
let sheets = 0;

// 一张精灵表：逐帧算不透明像素的 bbox，碰到画布边就是被裁切
function checkSheet(label, data, width) {
  sheets++;
  for (let row = 0; row < ACTIONS.length; row++) {
    for (let col = 0; col < COLS; col++) {
      const ox = col * FRAME_W;
      const oy = row * FRAME_H;
      let minX = FRAME_W;
      let maxX = -1;
      let minY = FRAME_H;
      let maxY = -1;
      for (let y = 0; y < FRAME_H; y++) {
        for (let x = 0; x < FRAME_W; x++) {
          const a = data[((oy + y) * width + ox + x) * 4 + 3];
          if (a > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) continue;
      frames++;
      const clip = minX <= 0 || maxX >= FRAME_W - 1 || minY <= 0 || maxY >= FRAME_H - 1;
      if (clip) {
        problems++;
        console.log(`  ! ${label} ${ACTIONS[row]}#${col} bbox=(${minX},${minY})-(${maxX},${maxY})`);
      }
    }
  }
}

// 1) 普通兵种：读导出的 4 档 PNG（文件名 = 兵种_代表等级.png，如 shield_3.png）
const files = fs.readdirSync(dir).filter((f) => /^[a-z]+_\d+\.png$/.test(f));
for (const file of files.sort()) {
  const lv = Number(file.split('_')[1].replace('.png', ''));
  if (only && lv !== only) continue;
  const img = await loadImage(path.join(dir, file));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  checkSheet(file, ctx.getImageData(0, 0, img.width, img.height).data, img.width);
}

// 2) 特殊兵种：按 4 档（Lv1/Lv3/Lv6/Lv9）直接画内存精灵表（和运行时同一套绘制代码）
const specials = CONFIG.troops.filter((t) => t.procedural);
for (const troop of specials) {
  for (let tier = 0; tier < SPRITE_TIER_LEVELS.length; tier++) {
    const lv = SPRITE_TIER_LEVELS[tier];
    if (only && lv !== only) continue;
    const sheet = sheetFor(troop.id, tier);
    const ctx = sheet.getContext('2d');
    checkSheet(`${troop.id}_${lv}`, ctx.getImageData(0, 0, SHEET_W, SHEET_H).data, SHEET_W);
  }
}

console.log(problems
  ? `\n共 ${sheets} 张表 / ${frames} 帧，发现 ${problems} 帧贴边（可能被裁切）`
  : `\n共 ${sheets} 张表 / ${frames} 帧：所有帧都在画布内，没有被裁切`);
process.exit(problems ? 1 : 0);
