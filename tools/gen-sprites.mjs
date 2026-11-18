// 用 Node 把精灵表生成为真实 PNG + atlas.json，方便：
// 1) 先看占位美术长什么样；2) 之后用真实美术直接替换同名 PNG。
// 用法：node tools/gen-sprites.mjs
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/data/config.js';
import { SPRITE_TIER_LEVELS } from '../src/core/units.js';
import {
  initSprites, setTroopResolver, sheetFor, FRAME_W, FRAME_H, COLS, ACTIONS,
} from '../src/render/sprites.js';

initSprites({ createCanvas });
setTroopResolver((id) => CONFIG.troops.find((t) => t.id === id));

const outDir = path.resolve('assets/sprites');
fs.mkdirSync(outDir, { recursive: true });

// 精灵只保留 4 档：Lv1 / Lv3 / Lv6 / Lv9（SPRITE_TIER_LEVELS 定义在 core/units.js）。
// 只有「普通兵种」导出 PNG（4 × 4 = 16 张），打进微信主包替代运行时程序化绘制；
// 稀有/史诗/传奇共 12 个兵种运行时用同一套程序化精灵表（procedural = true），只出预览图。
const BASE_TROOPS = CONFIG.troops.filter((t) => !t.procedural);
const SPECIAL_TROOPS = CONFIG.troops.filter((t) => t.procedural);
const TIER_COUNT = SPRITE_TIER_LEVELS.length;

const atlas = {
  frameWidth: FRAME_W,
  frameHeight: FRAME_H,
  cols: COLS,
  rows: ACTIONS,
  sheets: {},
};

for (const troop of BASE_TROOPS) {
  for (let tier = 0; tier < TIER_COUNT; tier++) {
    // 文件名用代表等级：shield_1 / shield_3 / shield_6 / shield_9.png
    const lv = SPRITE_TIER_LEVELS[tier];
    const sheet = sheetFor(troop.id, tier);
    const name = `${troop.id}_${lv}`;
    const file = path.join(outDir, `${name}.png`);
    fs.writeFileSync(file, sheet.toBuffer('image/png'));
    atlas.sheets[name] = {
      troop: troop.id,
      tier: lv,
      frames: { ...troop.anim },
      file: `assets/sprites/${name}.png`,
    };
  }
}

fs.writeFileSync(path.resolve('assets/sprites/atlas.json'), JSON.stringify(atlas, null, 2));

// 清掉非 4 档的旧 PNG（以前 10 档制留下的 2/4/5/7/8/10 档，以及换配置残留的更高档）。
// 按目录实际文件清理，保证反复执行后 assets/sprites 里只剩 16 张导出表。
const keepLevels = new Set(SPRITE_TIER_LEVELS);
const baseIds = new Set(BASE_TROOPS.map((t) => t.id));
let removed = 0;
for (const file of fs.readdirSync(outDir)) {
  const m = /^([a-z]+)_(\d+)\.png$/.exec(file);
  if (!m) continue;                       // 预览图 / atlas.json 等跳过
  const [, id, levelStr] = m;
  if (!baseIds.has(id) || !keepLevels.has(Number(levelStr))) {
    fs.unlinkSync(path.join(outDir, file));
    removed++;
  }
}
if (removed) console.log(`  已清理 ${removed} 张非 4 档旧精灵 PNG`);

// 总览图：全部 16 兵种 × 4 档（每档一张 384×384 的四动作表），缩到 0.4 并标注代表等级
const cellW = FRAME_W * COLS;
const cellH = FRAME_H * ACTIONS.length;
const scale = 0.4;
const preview = createCanvas(
  Math.ceil(CONFIG.troops.length * cellW * scale) + 52,
  Math.ceil(TIER_COUNT * cellH * scale)
);
const pctx = preview.getContext('2d');
pctx.fillStyle = '#14181f';
pctx.fillRect(0, 0, preview.width, preview.height);
pctx.font = 'bold 14px sans-serif';
pctx.textAlign = 'left';
pctx.textBaseline = 'middle';
CONFIG.troops.forEach((troop, ti) => {
  const ox = 52 + ti * cellW * scale;
  for (let tier = 0; tier < TIER_COUNT; tier++) {
    const lv = SPRITE_TIER_LEVELS[tier];
    const oy = tier * cellH * scale;
    pctx.drawImage(sheetFor(troop.id, tier),
      0, 0, cellW, cellH,
      ox, oy, cellW * scale, cellH * scale);
    if (ti === 0) {
      pctx.fillStyle = '#8fa0b4';
      pctx.fillText(`Lv${lv}`, 6, oy + cellH * scale / 2 + 2);
      pctx.fillStyle = '#c8d4e2';
    }
  }
  pctx.fillStyle = '#d8c07a';
  pctx.fillText(troop.id, ox + 4, 8);
});
fs.writeFileSync(path.resolve('assets/sprites/_preview_all.png'), preview.toBuffer('image/png'));

// 战斗动作放大图：检查每个动作的帧（最高档 = Lv9）
const TOP_TIER = TIER_COUNT - 1;
const TOP_LEVEL = SPRITE_TIER_LEVELS[TOP_TIER];
function zoomPreview(troops, zoomScale, file) {
  const zoom = createCanvas(FRAME_W * 4 * zoomScale * troops.length, FRAME_H * 4 * zoomScale + 22);
  const zctx = zoom.getContext('2d');
  zctx.fillStyle = '#14181f';
  zctx.fillRect(0, 0, zoom.width, zoom.height);
  zctx.imageSmoothingEnabled = false;
  zctx.font = 'bold 15px sans-serif';
  zctx.fillStyle = '#d8c07a';
  troops.forEach((troop, i) => {
    const sheet = sheetFor(troop.id, TOP_TIER);
    zctx.drawImage(
      sheet, 0, 0, FRAME_W * 4, FRAME_H * 4,
      i * FRAME_W * 4 * zoomScale, 22, FRAME_W * 4 * zoomScale, FRAME_H * 4 * zoomScale
    );
    zctx.fillText(`${troop.id} Lv${TOP_LEVEL}`, i * FRAME_W * 4 * zoomScale + 6, 14);
  });
  fs.writeFileSync(path.resolve(`assets/sprites/${file}`), zoom.toBuffer('image/png'));
}

zoomPreview(BASE_TROOPS, 2.0, '_preview_actions.png');
zoomPreview(SPECIAL_TROOPS, 1.2, '_preview_special.png');

console.log(`已生成 ${BASE_TROOPS.length * TIER_COUNT} 张普通兵种精灵表 PNG（${BASE_TROOPS.length} 兵种 × Lv${SPRITE_TIER_LEVELS.join(' / Lv')}）→ assets/sprites/`);
console.log(`特殊兵种 ${SPECIAL_TROOPS.length} 个 × ${TIER_COUNT} 档用程序化精灵表（不导出 PNG，省包体）`);
console.log('预览：assets/sprites/_preview_all.png、_preview_actions.png、_preview_special.png');
