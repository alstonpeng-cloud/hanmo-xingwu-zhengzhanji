// 12 个特殊兵种模型预览：导出 docs/preview/special_models.png
// 用法：node tools/gen-special-preview.mjs
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/data/config.js';
import { initSprites, setTroopResolver, sheetFor } from '../src/render/sprites.js';
import { rarityInfo } from '../src/core/units.js';

const ids = ['xiandeng', 'tengjia', 'xianzhen', 'qingzhou', 'baier', 'daji',
  'qingzhu', 'yuanyong', 'wudang', 'youzhou', 'baima', 'huhao'];
const NAMES = {
  xiandeng: '先登死士', tengjia: '藤甲兵', xianzhen: '陷阵营', qingzhou: '青州兵',
  baier: '白毦兵', daji: '大戟士', qingzhu: '丹阳青竹弓手', yuanyong: '元戎弩士',
  wudang: '无当飞军', youzhou: '幽州突骑', baima: '白马义从', huhao: '虎豹骑',
};

initSprites({ createCanvas });
setTroopResolver((id) => CONFIG.troops.find((t) => t.id === id));

const S = 226;
const COLS = 4;
const ROWS = 3;
const PAD = 22;
const LABEL = 54;
const W = COLS * S + (COLS + 1) * PAD;
const H = ROWS * (S + LABEL) + (ROWS + 1) * PAD;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#e9e2d2';
ctx.fillRect(0, 0, W, H);

ids.forEach((id, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = PAD + col * (S + PAD);
  const y = PAD + row * (S + LABEL + PAD);
  const rar = rarityInfo(id);
  ctx.save();
  ctx.fillStyle = '#f7f3e8';
  ctx.strokeStyle = rar.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, S, S, 14);
  ctx.fill();
  ctx.stroke();
  // 精灵表 idle 第一帧：96×96
  const sheet = sheetFor(id, 4); // Lv5 外观
  if (sheet) {
    ctx.drawImage(sheet, 0, 0, 96, 96, x + 4, y + 4, S - 8, S - 8);
  }
  ctx.fillStyle = '#4a3b27';
  ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(NAMES[id], x + S / 2, y + S + 30);
  ctx.fillStyle = rar.color;
  ctx.font = '16px "Microsoft YaHei", sans-serif';
  ctx.fillText(`${id} · ${rar.name}`, x + S / 2, y + S + 50);
  ctx.restore();
});

const outDir = path.resolve('docs', 'preview');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'special_models.png');
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log(`已生成 ${path.relative(process.cwd(), out)}（${W}×${H}）`);

// 等级配件对照：Lv1 / 3 / 5 / 7 / 9（每 2 级加一件）
{
  const tiers = [0, 2, 4, 6, 8];
  const CELL = 116;
  const LH = 24;
  const PW = 150 + tiers.length * CELL;
  const PH = ids.length * (CELL + LH) + 24;
  const pc = createCanvas(PW, PH);
  const pctx = pc.getContext('2d');
  pctx.fillStyle = '#e9e2d2';
  pctx.fillRect(0, 0, PW, PH);
  pctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
  pctx.fillStyle = '#4a3b27';
  pctx.textAlign = 'left';
  pctx.fillText('特殊兵种等级配件：Lv1 / Lv3 / Lv5 / Lv7 / Lv9', 20, 32);
  tiers.forEach((tier, ti) => {
    pctx.textAlign = 'center';
    pctx.fillText(`Lv${tier + 1}`, 150 + ti * CELL + CELL / 2, 32);
  });
  ids.forEach((id, ri) => {
    const y = 50 + ri * (CELL + LH);
    pctx.textAlign = 'left';
    pctx.font = 'bold 17px "Microsoft YaHei", sans-serif';
    pctx.fillStyle = '#4a3b27';
    pctx.fillText(NAMES[id], 16, y + CELL / 2);
    tiers.forEach((tier, ti) => {
      const x = 150 + ti * CELL;
      const sheet = sheetFor(id, tier);
      if (!sheet) return;
      pctx.fillStyle = '#f7f3e8';
      pctx.strokeStyle = '#c9bba0';
      pctx.lineWidth = 1;
      pctx.beginPath();
      pctx.roundRect(x + 6, y, CELL - 12, CELL, 8);
      pctx.fill();
      pctx.stroke();
      pctx.drawImage(sheet, 0, 0, 96, 96, x + 10, y + 10, CELL - 20, CELL - 20);
    });
  });
  const out2 = path.join(outDir, 'special_models_levels.png');
  fs.writeFileSync(out2, pc.toBuffer('image/png'));
  console.log(`已生成 ${path.relative(process.cwd(), out2)}（${PW}×${PH}）`);
}
