// 板块 2 · S2.1 —— THEME v2 全局回退脚本（幂等，可复跑）
// 把上一轮「墨韵丹符 · 冷玄墨」引入的冷色硬编码回退为参考图暖褐暗金色板。
// 只处理 UI 层；兵种 / 战场 / 精灵美术文件本来就是暖褐，排除不动。
// 用法：node tools/recolor-theme-v2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 冷玄墨字面量 → 暖褐暗金目标色（结构色沿用原始令牌，强调色采用 12 图实测值）
const HEX = {
  // 结构色
  '#080b0d': '#0d0a07', // 画布外底
  '#0c1013': '#17130e', // bg0
  '#12171b': '#211a12', // bg1
  '#1b2227': '#2b2217', // panel
  '#273038': '#332c1d', // 按钮 / 面板亮底
  '#36404a': '#4a3a24', // panel3
  '#46535e': '#8a6a3a', // 金线
  '#313c45': '#5a4528', // 暗金线
  '#221f2b': '#241a16', // UI 深底（宝箱 / 每日）
  '#332927': '#3d2b23', // 禁用按钮底
  // 鎏金
  '#e8b44c': '#d59947',
  '#8a6420': '#8a6a32',
  '#f8e1ac': '#f4d488',
  '#b88a32': '#aa8b58',
  // 朱砂
  '#c0392b': '#8d301b',
  '#8e2e26': '#662718',
  '#ec8870': '#c0553c',
  '#a6433a': '#8d301b',
  // 青绿 / 靛青 / 紫气
  '#3e9a85': '#3e885d',
  '#5b9bd5': '#5b7c99',
  '#9b77cf': '#96659a',
  '#256357': '#375148',
  '#5c4385': '#4e334c',
  '#7556a6': '#96659a',
  '#d9c4f2': '#c2b3c9',
  // 失败态（冷玄铁 → 暖褐）
  '#5b6b78': '#6b4a38',
  '#aebbc4': '#c9ae8e',
  // 文字
  '#ecf1f4': '#f2ead8',
  '#b2bec7': '#c2b394',
  '#8c9ba7': '#8a7d64',
  '#c0c6d0': '#b9a88c', // 排名银 → 暖银
  // 兵牌 / 图鉴卡：原本偏蓝灰，参考图 06 / 11 是深褐近黑
  '#243042': '#2a2018', // 拖动 ghost
  '#2b3748': '#332519', // 已上阵
  '#1c2431': '#241a16', // 默认兵牌底
  '#39414e': '#4a3a28', // 未解锁描边
  '#8d97a4': '#9a8a72', // 未解锁文字
  '#7c8794': '#8a7d64', // 未解锁次文字
  '#28323f': '#3a2c1e', // 空位描边
  '#33404f': '#4a3a28', // 空位十字
  '#dcefe2': '#e8e0c8', // 可获得卡文字
};

// 完整 rgba 字面量 / 注释文字（含括号，不能用正则直接匹配）
const LITERAL = [
  ['rgba(11,16,24,0.82)', 'rgba(21,15,10,0.82)'],
  ['rgba(16,21,29,0.88)', 'rgba(28,21,14,0.88)'],
  ['rgba(13,17,24,0.55)', 'rgba(23,17,11,0.55)'],
  ['rgba(20,26,36,0.5)', 'rgba(30,22,14,0.5)'],
  ['rgba(24,38,32,0.85)', 'rgba(34,36,22,0.85)'],
  ['rgba(18,32,25,0.92)', 'rgba(28,30,18,0.92)'],
  ['rgba(91, 107, 120, 0.92)', 'rgba(74, 56, 38, 0.92)'],   // infoBadge 底
  ['rgba(174, 187, 196, 0.85)', 'rgba(213, 153, 71, 0.85)'], // infoBadge 金边
  ['// 冷玄墨底（墨韵丹符）：冷青灰渐变 + 极淡的丹砂/鎏金角落辉光',
    '// 暖褐墨底（汉帛·朱金 v2）：深褐渐变 + 极淡的朱砂/鎏金角落辉光'],
  ['「墨韵丹符」质感：冷玄墨卡面', '「汉帛·朱金」质感：暖褐卡面'],
  ['// ① 卡面：冷玄墨底', '// ① 卡面：暖褐底'],
  ['（「墨韵丹符」）', '（「汉帛·朱金」v2）'],
];

const RGB = [
  [/rgba\(27,\s*34,\s*39/gi, 'rgba(43,34,23'],
  [/rgba\(232,\s*180,\s*76/gi, 'rgba(213,153,71'],
  [/rgba\(12,\s*16,\s*19/gi, 'rgba(23,19,14'],
  [/rgba\(39,\s*48,\s*56/gi, 'rgba(58,46,30'],
  [/rgba\(18,\s*23,\s*27/gi, 'rgba(33,26,18'],
  [/rgba\(6,\s*9,\s*14/gi, 'rgba(13,10,7'],
  [/rgba\(248,\s*225,\s*172/gi, 'rgba(244,212,136'],
  [/rgba\(138,\s*100,\s*32/gi, 'rgba(138,106,50'],
  [/rgba\(192,\s*57,\s*43/gi, 'rgba(141,48,27'],
  [/rgba\(142,\s*46,\s*38/gi, 'rgba(90,51,41'],
  [/rgba\(88,\s*98,\s*112/gi, 'rgba(110,90,66'],
  [/rgba\(176,\s*186,\s*200/gi, 'rgba(200,180,145'],
];

// 兵种 / 战场 / 精灵美术：本来就是暖褐或角色识别色，禁止改动
const EXCLUDE = /specialSprites|sprites|heroArt|troopFigure|arenaField|engineArt|ink|title/i;

const files = [];
for (const dir of ['src/screens', 'src/render']) {
  const abs = path.join(ROOT, dir);
  for (const f of fs.readdirSync(abs)) {
    if (!f.endsWith('.js') || EXCLUDE.test(f)) continue;
    files.push(path.join(dir, f));
  }
}
files.push('src/game.js');

let changedFiles = 0;
let changedHits = 0;
for (const rel of files) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  let hits = 0;
  for (const [from, to] of Object.entries(HEX)) {
    const re = new RegExp(`${from}\\b`, 'gi');
    s = s.replace(re, (m) => { hits++; return to; });
  }
  for (const [re, to] of RGB) {
    s = s.replace(re, (m) => { hits++; return to; });
  }
  for (const [from, to] of LITERAL) {
    const parts = s.split(from);
    if (parts.length < 2) continue;
    s = parts.join(to);
    hits += parts.length - 1;
  }
  if (s !== before) {
    fs.writeFileSync(file, s);
    changedFiles++;
    changedHits += hits;
    console.log(`  ${String(hits).padStart(3)} 处  ${rel}`);
  }
}
console.log(`\n共 ${changedFiles} 个文件、${changedHits} 处颜色回退。`);
console.log('注意：src/data/config.js 的 rarity 与 src/render/heroArt.js 的光环需单独同步（见 S2.1 验收单）。');
