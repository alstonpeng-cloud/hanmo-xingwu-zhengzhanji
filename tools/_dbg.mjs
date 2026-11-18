// 临时调试：把指定精灵表的某些帧放大拼成一张图，方便肉眼检查是否被裁切
// 用法：node tools/_dbg.mjs shield 1 idle,death        （普通兵种，读 PNG）
//      node tools/_dbg.mjs baier 3 idle,attack        （特殊兵种，现画内存表）
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/data/config.js';
import {
  FRAME_W, FRAME_H, COLS, ACTIONS, initSprites, setTroopResolver, sheetFor,
} from '../src/render/sprites.js';

const [troop = 'shield', tier = '1', actionsArg = ''] = process.argv.slice(2);
const actions = actionsArg ? actionsArg.split(',') : ACTIONS;
const scale = 3;

// 普通兵种读导出的 PNG；特殊兵种（procedural，不落盘）现画一张内存表
const file = path.resolve(`assets/sprites/${troop}_${tier}.png`);
let img;
if (fs.existsSync(file)) {
  img = await loadImage(file);
} else {
  initSprites({ createCanvas });
  setTroopResolver((id) => CONFIG.troops.find((t) => t.id === id));
  img = sheetFor(troop, Number(tier) - 1);
  if (!img) {
    console.error(`找不到兵种 ${troop} 的精灵表`);
    process.exit(1);
  }
}

const w = FRAME_W * COLS * scale;
const h = FRAME_H * actions.length * scale;
const canvas = createCanvas(w, h);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = '#101418';
ctx.fillRect(0, 0, w, h);
// 画网格（帧边界）与中线
actions.forEach((action, i) => {
  const row = ACTIONS.indexOf(action);
  for (let col = 0; col < COLS; col++) {
    ctx.drawImage(img, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H,
      col * FRAME_W * scale, i * FRAME_H * scale, FRAME_W * scale, FRAME_H * scale);
    ctx.strokeStyle = col === 0 ? '#5af' : '#2b3540';
    ctx.lineWidth = 1;
    ctx.strokeRect(col * FRAME_W * scale + 0.5, i * FRAME_H * scale + 0.5, FRAME_W * scale - 1, FRAME_H * scale - 1);
  }
});
const out = path.resolve(`assets/_smoke/dbg_${troop}_${tier}.png`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log(`已输出 ${out}`);
