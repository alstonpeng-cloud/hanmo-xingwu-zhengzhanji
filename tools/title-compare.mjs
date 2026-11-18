// 一次性脚本：输出标题两种方案的对比图（assets/_smoke/title_compare.png）
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

const W = 1000; const H = 620;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
// 上：深色底抠图；中：浅色底抠图；下：华文行楷
ctx.fillStyle = '#151b24'; ctx.fillRect(0, 0, W, 400);
ctx.fillStyle = '#f2ede2'; ctx.fillRect(0, 400, W, 110);
ctx.fillStyle = '#151b24'; ctx.fillRect(0, 510, W, 110);
const title = await loadImage(path.resolve('assets/ui/title.png'));
const tw = 920; const th = tw * title.height / title.width;
ctx.drawImage(title, (W - tw) / 2, 200 - th / 2, tw, th);
const tw2 = 720; const th2 = tw2 * title.height / title.width;
ctx.drawImage(title, (W - tw2) / 2, 455 - th2 / 2, tw2, th2);

const font = 'C:/Windows/Fonts/STXINGKA.TTF';
if (fs.existsSync(font)) GlobalFonts.registerFromPath(font, 'Xingkai');
ctx.font = '82px Xingkai';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
const grad = ctx.createLinearGradient(0, 520, 0, 600);
grad.addColorStop(0, '#f6dc94');
grad.addColorStop(0.55, '#d9ad4e');
grad.addColorStop(1, '#9c6a22');
ctx.fillStyle = grad;
ctx.fillText('汉末行伍征战记', W / 2, 566);
ctx.font = '18px sans-serif';
ctx.fillStyle = 'rgba(255,255,255,0.55)';
ctx.fillText('下方：华文行楷（仅对比，授权不明确，不用于发布）', W / 2, 610);
fs.mkdirSync('assets/_smoke', { recursive: true });
fs.writeFileSync('assets/_smoke/title_compare.png', canvas.toBuffer('image/png'));
console.log('ok');
