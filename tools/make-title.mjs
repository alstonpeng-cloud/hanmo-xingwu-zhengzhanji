// 一次性脚本：把参考图里的金色草书标题抠成透明 PNG（输出 assets/ui/title.png）
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

const src = 'c:/Users/haoch/.trae-cn/attachments/30e02494-4587-4183-b022-ab7be5b5477d_96f6208c-8d79-4f6e-b4f6-35cff1f3fd5f_image.png';
const outDir = path.resolve('assets/ui');
fs.mkdirSync(outDir, { recursive: true });

const img = await loadImage(src);
const w = img.width;
const h = img.height;
const canvas = createCanvas(w, h);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const data = ctx.getImageData(0, 0, w, h);
const px = data.data;

let minX = w; let minY = h; let maxX = -1; let maxY = -1;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const r = px[i]; const g = px[i + 1]; const b = px[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx - mn;
    let a = 0;
    if (mn < 246 || sat > 12) {
      if (sat < 22 && mx < 212) {
        a = 0; // 灰黑投影丢弃
      } else {
        a = Math.round(((255 - b) / (255 - 66)) * 255);
        if (sat < 26) a = Math.round(a * 0.35);
      }
    }
    a = Math.max(0, Math.min(255, a));
    px[i + 3] = a;
    if (a > 2) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
ctx.putImageData(data, 0, 0);

const pad = 3;
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(w - 1, maxX + pad);
maxY = Math.min(h - 1, maxY + pad);
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

const out = createCanvas(cw * 2, ch * 2);
const octx = out.getContext('2d');
octx.imageSmoothingEnabled = true;
octx.imageSmoothingQuality = 'high';
octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw * 2, ch * 2);
fs.writeFileSync(path.join(outDir, 'title.png'), out.toBuffer('image/png'));
console.log(`title.png = ${cw * 2}x${ch * 2} (crop ${cw}x${ch})`);
