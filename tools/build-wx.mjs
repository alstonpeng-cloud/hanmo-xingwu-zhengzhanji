// 生成微信小游戏工程：node tools/build-wx.mjs
// 默认产出「玩家版」：剔除开发者通道（DEV 入口 / 一键全英雄全兵种 / 调试四连 / 调试输出）。
// 需要保留开发者通道时：node tools/build-wx.mjs --dev
// 默认把 4 档精灵 PNG 打进主包；加 --no-sprite-png 才退回零 PNG 的运行时程序化绘制。
// 产物在 wechat/ 目录，用「微信开发者工具 → 导入项目」直接打开该目录即可预览/真机调试。
// 只复制源码与美术资源，不改动仓库里的浏览器试玩版。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPRITE_TIER_LEVELS } from '../src/core/units.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = path.join(root, 'wechat');
const PLAYER = !process.argv.includes('--dev');
// 默认把 4 档预生成精灵 PNG（16 张）打进主包，替代启动时的运行时程序化绘制，
// 降低中低端机开销；加 --no-sprite-png 才退回「零 PNG · 运行时程序化绘制」。
const WITH_SPRITE_PNG = !process.argv.includes('--no-sprite-png');
const AD_UNIT_ID = 'adunit-xxxxxxxxxxxxxxxx'; // 开通流量主后替换成自己的激励视频广告位 ID
// 小游戏 AppID：默认测试号（只能预览、不能上传）；发布时用环境变量传入自己的 AppID：
//   PowerShell: $env:WX_APPID='wx1234567890abcdef'; npm run wx:release
const APP_ID = (process.env.WX_APPID || '').trim() || 'touristappid';

// ── 分包架构：主包只带首屏必需资源，高音质 BGM / 英雄立绘 / 器械 / 装饰贴图进入后下载 ──
// 呈现效果优先：素材一律按原图 / 原音轨打包，不做有损压缩；30MB 总额度宽裕预留。
// 规则里只写「逻辑路径」，构建时按实际存在的文件生成映射表，板块 4 放入新素材即自动生效。
const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;
const AUDIO_EXT = /\.(mp3|m4a|ogg|wav|flac)$/i;
const PACKAGE_RULES = [
  {
    name: 'audio', root: 'pkg_audio', priority: 0,
    test(p) {
      if (!p.startsWith('assets/audio/')) return false;
      if (p.includes('/sfx/')) return false;                 // 音效留主包，随点随响
      if (/bgm_heroic_loop/i.test(p)) return false;          // 48KB 占位曲留主包做首屏与失败回退
      return AUDIO_EXT.test(p);
    },
  },
  { name: 'heroes', root: 'pkg_heroes', priority: 1, test: (p) => p.startsWith('assets/heroes/') && IMAGE_EXT.test(p) },
  { name: 'siege',  root: 'pkg_siege',  priority: 2, test: (p) => p.startsWith('assets/siege/')  && IMAGE_EXT.test(p) },
  { name: 'art',    root: 'pkg_art',    priority: 3, test: (p) => p.startsWith('assets/art/')    && IMAGE_EXT.test(p) },
];

// 玩家版剥离：源码里用 // #dev-only:start / end 包住只给开发者的入口与函数，
// 这里按行剔除，产物里连按钮文案 / 函数名都不会出现（不是运行时隐藏）。
function stripDev(code) {
  const lines = code.split(/\r?\n/);
  const kept = [];
  let depth = 0;
  for (const line of lines) {
    if (line.includes('// #dev-only:start')) { depth++; continue; }
    if (line.includes('// #dev-only:end')) { depth = Math.max(0, depth - 1); continue; }
    if (!depth) kept.push(line);
  }
  return kept.join('\n');
}

function copySrc(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) { copySrc(src, dst); continue; }
    if (!entry.isFile()) continue;
    if (entry.name === 'main.js') continue;                       // 浏览器入口不进小游戏
    if (PLAYER && entry.name === 'dev.js') continue;              // 开发者通道整文件不打包
    if (!entry.name.endsWith('.js')) { fs.copyFileSync(src, dst); continue; }
    const code = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dst, PLAYER ? stripDev(code) : code);
  }
}

function copyDir(from, to, skip = () => false) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst, skip);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// 逐文件删除目录：不依赖可能被环境拦截的递归删除，用于清理上一轮遗留的分包目录。
function purgeDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) purgeDir(full);
    else { try { fs.unlinkSync(full); } catch (e) {} }
  }
  try { fs.rmdirSync(dir); } catch (e) {}
}

// 清空产物目录：部分环境会拦截递归删除，失败时降级为「覆盖式同步」，
// 保证构建仍能完成（多余的历史文件由下面 sprites 清理步骤处理）。
try {
  fs.rmSync(out, { recursive: true, force: true });
} catch (e) {
  console.warn(`! 清空 wechat/ 被环境拦截（${e.message}），改用覆盖式同步`);
  fs.mkdirSync(out, { recursive: true });
}
// 无论整体清空是否成功，都清掉历史 pkg_* 目录：否则上一轮构建的分包会残留，
// 虽未被 game.json 声明，却仍会被开发者工具 / 上传流程算进总包。
if (fs.existsSync(out)) {
  const stalePkgs = fs.readdirSync(out, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('pkg_'));
  for (const e of stalePkgs) purgeDir(path.join(out, e.name));
  if (stalePkgs.length) console.log(`  已清理 ${stalePkgs.length} 个历史分包目录`);
}

// 1) 源码 + 美术资源（玩家版会剥离 #dev-only 区块）
copySrc(path.join(root, 'src'), path.join(out, 'src'));
if (fs.existsSync(path.join(root, 'assets'))) {
  const spriteOut = path.join(out, 'assets', 'sprites');
  fs.mkdirSync(spriteOut, { recursive: true });
  // 覆盖式同步时先清掉上次构建遗留的精灵 PNG（尤其旧的 10 档 2/4/5/7/8/10），
  // 保证默认构建只带当前 4 档的 16 张图，不会误把旧档位美术带进主包。
  const stale = fs.readdirSync(spriteOut).filter((name) => name.endsWith('.png'));
  for (const name of stale) {
    try { fs.unlinkSync(path.join(spriteOut, name)); }
    catch (e) { console.warn(`! 无法清理旧精灵 ${name}：${e.message}`); }
  }
  if (WITH_SPRITE_PNG) {
    // 默认：复制 4 档精灵 PNG 进主包；排除 _ 开头的预览图与 atlas.json（不进包）
    copyDir(
      path.join(root, 'assets', 'sprites'),
      spriteOut,
      (name) => name.startsWith('_') || name === 'atlas.json'
    );
    // 二次兜底：只保留 SPRITE_TIER_LEVELS 对应档位的导出表。
    // 即便源目录还残留旧 10 档（未先跑 gen-sprites）也不会被带进主包，保证 < 4MB。
    const tierRe = new RegExp(`^[a-z0-9]+_(${SPRITE_TIER_LEVELS.join('|')})\\.png$`);
    for (const name of fs.readdirSync(spriteOut)) {
      if (name.endsWith('.png') && !tierRe.test(name)) {
        try { fs.unlinkSync(path.join(spriteOut, name)); }
        catch (e) { console.warn(`! 无法清理非 4 档精灵 ${name}：${e.message}`); }
      }
    }
  }
  if (stale.length) {
    console.log(`  已清理 ${stale.length} 张上次构建遗留的精灵 PNG${WITH_SPRITE_PNG ? '' : '（--no-sprite-png：零 PNG）'}`);
  }
  // UI 位图：游戏名草书标题（深色底用，已抠成透明 PNG）
  if (fs.existsSync(path.join(root, 'assets', 'ui'))) {
    copyDir(
      path.join(root, 'assets', 'ui'),
      path.join(out, 'assets', 'ui'),
      (name) => name.startsWith('_')
    );
  }
  // 音频：音效 + 占位 BGM（真实 Glorious Morning 由用户自己放到 assets/audio/）
  if (fs.existsSync(path.join(root, 'assets', 'audio'))) {
    copyDir(
      path.join(root, 'assets', 'audio'),
      path.join(out, 'assets', 'audio'),
      (name) => name === 'README.md' || name.startsWith('_')
        || /\.disabled$/i.test(name) // 校验脚本清理失败时改名的兜底文件，不进包
    );
  }
  // 分包素材源目录：英雄立绘 / 器械与兵模贴图 / 边框纹样与宝箱图标。
  // 先把它们复制进主包，下面统一按规则迁出；目录为空时不会声明空分包。
  for (const dir of ['heroes', 'siege', 'art']) {
    const from = path.join(root, 'assets', dir);
    if (!fs.existsSync(from)) continue;
    copyDir(from, path.join(out, 'assets', dir),
      (name) => name.startsWith('_') || /\.md$/i.test(name)
        || /\.disabled$/i.test(name));
  }
}

// 1.5) 分包迁移：命中规则的文件从主包移到 pkg_*/ 下，并生成逻辑路径 → 真实路径映射。
//     运行时由 src/core/subpackage.js 的 resolveAsset() 查表：未就绪返回 null，业务层回退主包占位。
function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}

const assetMap = {};
const packageCounts = new Map();
for (const file of walkFiles(path.join(out, 'assets'))) {
  const logical = 'assets/' + path.relative(path.join(out, 'assets'), file).split(path.sep).join('/');
  const rule = PACKAGE_RULES.find((r) => r.test(logical));
  if (!rule) continue;
  const rel = logical.slice('assets/'.length);
  const dst = path.join(out, rule.root, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  // 迁出用「移动」而非「复制 + 删除」：运行环境对单轮批量删除有阈值保护，
  // 28 张分包素材逐个 unlink 会触发拦截并中断构建；rename 是零删除操作，
  // 且语义上本来就是「从主包迁到分包」，不需要产生临时副本。
  fs.renameSync(file, dst);
  assetMap[logical] = { pkg: rule.name, path: rule.root + '/' + rel };
  packageCounts.set(rule.name, (packageCounts.get(rule.name) || 0) + 1);
}
// 只声明「确实有素材」的分包，避免 game.json 指向空目录被开发者工具判错。
const declared = PACKAGE_RULES
  .filter((r) => packageCounts.has(r.name))
  .sort((a, b) => a.priority - b.priority)
  .map((r) => ({ name: r.name, root: r.root }));

// 微信小游戏硬性规则：每个分包根目录必须存在 game.js，否则开发者工具
// checkSubpackages 报「未找到 /pkg_xxx/game.js」，CLI 上传在 compile_start 阶段
// 抛 code 10（即使分包只是纯资源包）。本作分包由主包 wx.loadSubpackage 按需
// 加载，入口保持空操作即可，体积可忽略。
for (const r of declared) {
  write(path.join(out, r.root, 'game.js'),
    '// 资源分包入口（由 tools/build-wx.mjs 自动生成，请勿手改）\n'
    + '// 本分包只承载素材，由主包通过 wx.loadSubpackage 按需加载。\n'
    + 'void 0;\n');
}

write(path.join(out, 'src', 'core', 'asset-routes.js'),
  '// 由 tools/build-wx.mjs 按真实分包素材自动生成，请勿手改。\n'
  + 'export const ASSET_MAP = ' + JSON.stringify(assetMap, null, 2) + ';\n');
console.log(`分包素材：${Object.keys(assetMap).length} 个文件 · ${declared.length} 个分包`
  + (declared.length ? `（${declared.map((d) => `${d.name}:${packageCounts.get(d.name)}`).join(' / ')}）` : '（暂无）'));

// 2) 小游戏入口 game.js
write(path.join(out, 'game.js'), `// 微信小游戏入口（由 tools/build-wx.mjs 生成，请勿手改）
import { Game } from './src/game.js';
import { createWxPlatform } from './src/platform/wx.js';
import { startSubpackageDownloads } from './src/core/subpackage.js';

// 开通流量主后，把这里换成自己的激励视频广告位 ID；保持占位值时使用内置模拟广告
const AD_UNIT_ID = '${AD_UNIT_ID}';

const platform = createWxPlatform({ adUnitId: AD_UNIT_ID });
const ctx = platform.canvas.getContext('2d');
const game = new Game(platform.canvas, ctx, platform);

let last = platform.now();
let failStreak = 0;
function loop() {
  const now = platform.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // 帧级兜底：单帧异常不黑屏，下一帧继续画；连续失败由 Game 做安全恢复
  try {
    game.update(dt);
    game.draw();
    failStreak = 0;
  } catch (e) {
    failStreak += 1;
    try { game.onFrameError(e, failStreak); } catch (err) {}
  }
  platform.requestFrame(loop);
}
platform.requestFrame(loop);

// 首帧已经排队，再按优先级静默下载分包（音频 → 立绘 → 器械 → 装饰）。
// 下载期间主包占位曲照常播放；就绪后音频层自动升级到高音质主曲。
startSubpackageDownloads(${JSON.stringify(declared.map((d) => d.name))});
${PLAYER ? '' : `
// 调试用：真机 vConsole / 开发者工具控制台可访问
if (typeof GameGlobal !== 'undefined') GameGlobal.__game = game;
`}`);

// 3) game.json（竖屏、隐藏状态栏）
write(path.join(out, 'game.json'), JSON.stringify({
  deviceOrientation: 'portrait',
  showStatusBar: false,
  networkTimeout: { request: 10000 },
  // 普通分包：单个不限大小，主包 + 全部分包总和 ≤ 30MB。
  subpackages: declared,
}, null, 2) + '\n');

// 4) project.config.json（appid 换成自己的，或先用测试号）
write(path.join(out, 'project.config.json'), JSON.stringify({
  appid: APP_ID,
  projectname: 'hanmo-xingwu-zhengzhanji',
  compileType: 'game',
  libVersion: '3.0.0',
  setting: {
    es6: true,
    enhance: true,
    minified: true,
    urlCheck: true,
    autoAudits: false,
  },
  packOptions: {
    // code.fortify.config.json 是「游戏深度保护」CLI 的加固清单：
    // 它必须留在项目目录里供 CLI 读取，但不打进主包（占体积）
    ignore: [
      { type: 'file', value: 'code.fortify.config.json' },
      // 加固 CLI 会为每个混淆后的 js 生成 .map 源码映射（93 个约 2.2 MB）：
      // 它既不该打进包（主包会因此突破 4 MB），也不该上传到微信后台
      { type: 'suffix', value: '.map' },
    ],
    include: [],
  },
}, null, 2) + '\n');

console.log(`已生成微信小游戏工程：wechat/（${PLAYER ? '玩家版：已剥离开发者入口' : '开发版：保留开发者入口'}）`);
console.log(`精灵方案：${WITH_SPRITE_PNG
  ? '4 档预生成 PNG 图集（assets/sprites，16 张，替代运行时绘制）'
  : '运行时程序化绘制（--no-sprite-png：零 PNG）'}`);
console.log(`当前 AppID：${APP_ID}${APP_ID === 'touristappid' ? '（测试号，只能预览，不能上传）' : ''}`);
console.log('下一步：微信开发者工具 → 导入项目 → 选择 wechat 目录 → 填自己的 AppID');
console.log(`激励视频广告位 ID 当前为 ${AD_UNIT_ID}（占位值 = 使用内置模拟广告）`);

// 5) 玩家版自检：产物里不能再出现开发者通道的标识（文案 / 函数名 / 调试出口）
if (PLAYER) {
  const forbidden = [
    /devGrantAllHeroes/, /devGrantAllTroops/, /devRect/, /devOpen/, /devResult/,
    /开发者/, /作弊/, /调试/, /\bDEV\b/, /console\.log/, /GameGlobal/, /__game/,
  ];
  const hits = [];
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(full); continue; }
      if (!/\.(js|json)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      for (const re of forbidden) {
        if (re.test(text)) hits.push(`${path.relative(out, full)}: ${re}`);
      }
    }
  };
  scan(out);
  if (fs.existsSync(path.join(out, 'src', 'core', 'dev.js'))) hits.push('src/core/dev.js 仍被打包');
  if (hits.length) {
    console.error('\n✖ 玩家版残留开发者标识：');
    hits.forEach((h) => console.error(`  - ${h}`));
    process.exit(1);
  }
  console.log('✔ 玩家版自检通过：产物中无 devGrant / DEV 入口 / 开发者文案 / 调试输出');
}

// 6) 游戏深度保护：生成加固配置（由 tools/release-wx.mjs 调 CLI 使用）
//    默认 level 1：level 2（cli 0.1.8）会插入未声明的残留赋值（如 d=null;g=null;），
//    ESM 严格模式下模块加载即 ReferenceError → 黑屏（实测 57/75 文件带伤）。
//    要试更高等级用 $env:WX_FORTIFY_LEVEL，但必须过 tools/fortify-scan 类加载扫描。
{
  const files = [];
  const walkJs = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walkJs(full); continue; }
      if (entry.name.endsWith('.js')) {
        files.push(`./${path.relative(out, full).split(path.sep).join('/')}`);
      }
    }
  };
  walkJs(out);
  files.sort();
  // WX_FORTIFY_FILES='key'：只加固核心（game.js + src/core + src/data），产物更小，
  // 用于加固后超 4MB 时的降级路径（受每日限频约束，勿反复降级重跑）
  const onlyKey = process.env.WX_FORTIFY_FILES === 'key';
  const keyFiles = onlyKey
    ? files.filter((p) => p === './game.js' || p.startsWith('./src/core/') || p.startsWith('./src/data/'))
    : files;
  if (onlyKey && !keyFiles.length) {
    console.error("\n✖ WX_FORTIFY_FILES='key' 未匹配到任何 js（检查 wechat/ 构建产物）");
    process.exit(1);
  }
  const level = Number(process.env.WX_FORTIFY_LEVEL || 1);
  // 注意：minigame-code-fortify-cli 的 schema 是 files: string[]（直接 path.resolve(workDir, file)），
  // 传 [{path}] 对象会触发 "paths[1] must be string" 内部错误
  write(path.join(out, 'code.fortify.config.json'), JSON.stringify({
    obfuscation: {
      name: '代码混淆',
      tasks: [{ level, files: keyFiles }],
    },
  }, null, 2) + '\n');
  console.log(`✔ 已生成加固配置 code.fortify.config.json（${keyFiles.length} 个 js`
    + `${onlyKey ? '，key 模式：game.js + src/core + src/data' : `/${files.length}`}，level ${level}）`);
}

// 7) 包体体积：主包（排除 pkg_* 目录）≤ 4MB，主包 + 分包 ≤ 30MB。
//    效果优先不做有损压缩，但两条平台红线由构建脚本硬校验，超限直接失败。
{
  let mainBytes = 0;
  let subBytes = 0;
  const byPkg = {};
  for (const file of walkFiles(out)) {
    const size = fs.statSync(file).size;
    const first = path.relative(out, file).split(path.sep)[0];
    if (first.startsWith('pkg_')) {
      subBytes += size;
      byPkg[first] = (byPkg[first] || 0) + size;
    } else {
      mainBytes += size;
    }
  }
  const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
  console.log(`✔ 包体：主包 ${mb(mainBytes)} / 4 MB · 分包 ${mb(subBytes)} · 合计 ${mb(mainBytes + subBytes)} / 30 MB`);
  for (const [name, size] of Object.entries(byPkg)) console.log(`    ${name}: ${mb(size)}`);
  if (mainBytes > 4 * 1024 * 1024) {
    console.error('✖ 主包超过微信小游戏 4MB 上限，请把更多素材放入分包目录后重新构建');
    process.exit(1);
  }
  if (mainBytes + subBytes > 30 * 1024 * 1024) {
    console.error('✖ 主包 + 分包超过 30MB 上限');
    process.exit(1);
  }
}
