// 英雄 2.5D 动作预览：导出 docs/preview/hero_animations.png
// 用法：node tools/hero-anim-preview.mjs
// 每名英雄 6 个关键帧：待机 / 攻击起手 / 攻击命中 / 受击 / 技能聚气 / 技能释放。
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawHeroFigure, heroActionTime } from '../src/render/heroArt.js';
import { heroById } from '../src/data/heroes.js';

const IDS = ['guanyu', 'zhangfei', 'liubei', 'zhouyu', 'dongzhuo', 'guanping'];
const FRAMES = [
  { label: '待机', action: 'idle', p: 0 },
  { label: '攻击起手', action: 'attack', p: 0.20 },
  { label: '攻击命中', action: 'attack', p: 0.46 },
  { label: '受击', action: 'hit', p: 0.10 },
  { label: '技能聚气', action: 'skill', p: 0.30 },
  { label: '技能释放', action: 'skill', p: 0.55 },
];

const CELL_W = 190;
const CELL_H = 210;
const LABEL_H = 34;
const LEFT = 156;
const TOP = 46;
const GAP = 8;
const W = LEFT + FRAMES.length * (CELL_W + GAP) + GAP;
const H = TOP + IDS.length * (CELL_H + LABEL_H + GAP) + GAP;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#1d1712';
ctx.fillRect(0, 0, W, H);

// 顶部帧名
ctx.textAlign = 'center';
ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
FRAMES.forEach((f, col) => {
  ctx.fillStyle = '#e8cf94';
  ctx.fillText(f.label, LEFT + col * (CELL_W + GAP) + CELL_W / 2, 28);
});

IDS.forEach((id, row) => {
  const hero = heroById(id);
  const y0 = TOP + row * (CELL_H + LABEL_H + GAP);
  ctx.fillStyle = '#d9cbb0';
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
  ctx.fillText(hero ? hero.name : id, LEFT - 18, y0 + CELL_H / 2 + 8);

  FRAMES.forEach((f, col) => {
    const x = LEFT + col * (CELL_W + GAP);
    const y = y0;
    ctx.fillStyle = '#2a2118';
    ctx.strokeStyle = '#4d3c28';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, CELL_W, CELL_H, 10);
    ctx.fill();
    ctx.stroke();
    // 地面参考线：看脚底是否贴地、身体是否只是平移
    ctx.strokeStyle = 'rgba(226,196,152,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 16, y + CELL_H - 34);
    ctx.lineTo(x + CELL_W - 16, y + CELL_H - 34);
    ctx.stroke();
    const t = f.action === 'idle' ? 0.4 : f.p * heroActionTime(f.action);
    drawHeroFigure(ctx, id, {
      x: x + CELL_W / 2,
      y: y + CELL_H - 34,
      size: 170,
      action: f.action,
      t,
      flip: false,
      alpha: 1,
      animated: true,
    });
  });
});

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = path.join(root, 'docs', 'preview');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'hero_animations.png');
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log(`已生成 ${path.relative(root, out)}（${W}×${H}）`);
