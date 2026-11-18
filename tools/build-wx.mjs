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

// 清空产物目录：部分环境会拦截递归删除，失败时降级为「覆盖式同步」，
// 保证构建仍能完成（多余的历史文件由下面 sprites 清理步骤处理）。
try {
  fs.rmSync(out, { recursive: true, force: true });
} catch (e) {
  console.warn(`! 清空 wechat/ 被环境拦截（${e.message}），改用覆盖式同步`);
  fs.mkdirSync(out, { recursive: true });
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
    );
  }
}

// 2) 小游戏入口 game.js
write(path.join(out, 'game.js'), `// 微信小游戏入口（由 tools/build-wx.mjs 生成，请勿手改）
import { Game } from './src/game.js';
import { createWxPlatform } from './src/platform/wx.js';

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
${PLAYER ? '' : `
// 调试用：真机 vConsole / 开发者工具控制台可访问
if (typeof GameGlobal !== 'undefined') GameGlobal.__game = game;
`}`);

// 3) game.json（竖屏、隐藏状态栏）
write(path.join(out, 'game.json'), JSON.stringify({
  deviceOrientation: 'portrait',
  showStatusBar: false,
  networkTimeout: { request: 10000 },
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
