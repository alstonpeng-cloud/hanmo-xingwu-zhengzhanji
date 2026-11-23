﻿﻿﻿﻿﻿// 微信小游戏发布打包：构建 → 检查 → 打 zip →（可选）调起微信开发者工具上传
// 用法：
//   $env:WX_APPID='wx1234567890abcdef'; $env:WX_VERSION='1.0.0'; npm run wx:release
//   $env:WX_UPLOAD='1'; npm run wx:release     # 额外执行 cli upload（需本机微信开发者工具已登录）
// 不传 WX_APPID 时使用 touristappid（只能本地预览，不能上传）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = path.join(ROOT, 'wechat');
// 上传目标目录：默认 wechat/；开启加固（WX_FORTIFY）后由下方加固段改写为加固产物
let UPLOAD_DIR = OUT;
const DIST = path.join(ROOT, 'dist');
const APP_ID = (process.env.WX_APPID || '').trim() || 'touristappid';
const VERSION = (process.env.WX_VERSION || '').trim() || '1.0.0';
const DESC = (process.env.WX_DESC || '').trim() || '汉末行伍征战记 微信小游戏';
const DO_UPLOAD = process.env.WX_UPLOAD === '1';
const IS_TOURIST = APP_ID === 'touristappid';
const APPID_OK = /^wx[0-9a-f]{16}$/.test(APP_ID);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// ---------- 1. 构建 ----------
console.log('== 微信小游戏发布打包 ==');
console.log(`AppID：${APP_ID}${IS_TOURIST ? '（测试号：只能预览，不能上传）' : ''}`);
console.log('正在构建 wechat/ ...');
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-wx.mjs')], {
  stdio: 'inherit',
  env: process.env,
});

// ---------- 2. 发布前检查 ----------
const required = ['game.js', 'game.json', 'project.config.json', 'src/game.js', 'src/platform/wx.js'];
for (const rel of required) {
  if (!fs.existsSync(path.join(OUT, rel))) fail(`缺少小游戏必需文件：wechat/${rel}`);
}
const cfg = JSON.parse(fs.readFileSync(path.join(OUT, 'project.config.json'), 'utf8'));
if (cfg.compileType !== 'game') fail(`project.config.json 的 compileType 必须是 "game"（当前 ${cfg.compileType}）`);
if (cfg.appid !== APP_ID) fail(`project.config.json 的 appid 与 WX_APPID 不一致（${cfg.appid}）`);
if (fs.existsSync(path.join(OUT, 'src', 'main.js'))) fail('wechat/ 不应包含浏览器入口 src/main.js');
if (fs.existsSync(path.join(OUT, 'src', 'screens', 'report.js'))) fail('wechat/ 不应包含已删除的战报页 report.js');

const files = walk(OUT);
// 分包目录 pkg_* 不计入 4MB 主包上限，但要计入 30MB 总包上限。
const packageRootOf = (f) => {
  const first = path.relative(OUT, f).split(path.sep)[0];
  return first.startsWith('pkg_') ? first : null;
};
const mainFiles = files.filter((f) => !packageRootOf(f));
const totalBytes = mainFiles.reduce((n, f) => n + fs.statSync(f).size, 0);   // 主包
const allBytes = files.reduce((n, f) => n + fs.statSync(f).size, 0);         // 主包 + 分包
const subpackageRoots = [...new Set(files.map(packageRootOf).filter(Boolean))];
const audioFiles = files.filter((f) => /assets[\\/]audio[\\/].+\.(wav|mp3|m4a|ogg)$/i.test(f));
if (!audioFiles.length) fail('缺少音效文件（assets/audio）');
const sfxCount = audioFiles.filter((f) => /[\\/]sfx[\\/]/.test(f)).length;
if (sfxCount < 16) fail(`音效文件不完整（期望 16 个，实际 ${sfxCount}）`);
const hasRealBgm = files.some((f) => /glorious_morning\.(mp3|m4a|ogg)$/i.test(f));
if (!hasRealBgm) {
  console.log('提示：assets/audio/glorious_morning.mp3 未放入，包内会播放占位英雄主题循环。');
}
if (totalBytes > 4 * 1024 * 1024) {
  fail(`主包 ${(totalBytes / 1024 / 1024).toFixed(2)} MB，超过微信小游戏 4 MB 主包上限`);
}
if (allBytes > 30 * 1024 * 1024) {
  fail(`主包 + 分包 ${(allBytes / 1024 / 1024).toFixed(2)} MB，超过微信小游戏 30 MB 总包上限`);
}

console.log(`\n✔ 主包大小：${(totalBytes / 1024 / 1024).toFixed(2)} MB / 4 MB（${mainFiles.length} 个文件）`);
console.log(`✔ 分包：${subpackageRoots.length} 个（${subpackageRoots.join(' / ') || '无'}）· 合计 ${(allBytes / 1024 / 1024).toFixed(2)} MB / 30 MB`);
console.log(`✔ 音效：${sfxCount} 个；BGM：${hasRealBgm ? '真实曲目' : '占位循环'}`);
console.log(`✔ 编译类型：${cfg.compileType}；基础库 ${cfg.libVersion}；压缩 ${cfg.setting?.minified ? '开' : '关'}`);

// ---------- 2.5 游戏深度保护：代码加固（CLI 流水线接入） ----------
// 默认尝试加固；WX_FORTIFY='0' 显式跳过（MP 后台还没配公钥时用，明文直传不建议常态）。
// 加固 = 网络加密服务：同 md5 24 小时内复用，重跑只补缺失文件；每日限频 -1100002。
const DO_FORTIFY = process.env.WX_FORTIFY !== '0';
const FORTIFY_OUT = path.join(DIST, 'fortify');
if (DO_FORTIFY) {
  const binPkg = path.join(ROOT, 'node_modules', 'minigame-code-fortify-cli', 'package.json');
  if (!fs.existsSync(binPkg)) {
    fail("未安装 minigame-code-fortify-cli（先 npm install），或用 $env:WX_FORTIFY='0' 跳过加固");
  }
  if (!fs.existsSync(path.join(ROOT, 'id_rsa.conf'))) {
    fail("缺少 id_rsa.conf（RSA 密钥配置），或用 $env:WX_FORTIFY='0' 跳过加固");
  }
  const fortifyCfgPath = path.join(OUT, 'code.fortify.config.json');
  if (!fs.existsSync(fortifyCfgPath)) fail('wechat/code.fortify.config.json 缺失（build-wx.mjs 应自动生成）');

  console.log('\n== 游戏深度保护：代码加固 ==');
  // 清空上次输出，避免新旧产物混淆。运行环境对单轮批量删除有阈值保护
  // （dist/fortify 常有两三百个文件），直接 rmSync 会被拦截并中断发布；
  // 被拦截时改用「改名归档」：零删除、同样得到干净的全新输出目录，旧版产物还能回溯。
  if (fs.existsSync(FORTIFY_OUT)) {
    try {
      fs.rmSync(FORTIFY_OUT, { recursive: true, force: true });
    } catch (e) {
      const backup = path.join(DIST, `fortify_prev_${Date.now()}`);
      try {
        fs.renameSync(FORTIFY_OUT, backup);
        console.log(`! 清空加固目录被环境拦截，已归档为 ${path.relative(ROOT, backup)}`);
      } catch (e2) {
        console.warn(`! 加固目录无法清空也无法归档（${e2.message}），改用覆盖式加固`);
      }
    }
  }

  const binJson = JSON.parse(fs.readFileSync(binPkg, 'utf8'));
  const binRel = typeof binJson.bin === 'string' ? binJson.bin : Object.values(binJson.bin || {})[0];
  if (!binRel) fail('无法解析 minigame-code-fortify-cli 的 bin 入口');
  const binFile = path.join(ROOT, 'node_modules', 'minigame-code-fortify-cli', binRel);
  const runFortify = () => spawnSync(process.execPath, [binFile], {
    cwd: ROOT, encoding: 'buffer', timeout: (30 + 10) * 60 * 1000,   // timeout_minute 30 + 余量 10
  });
  // 错误码是 ASCII，utf8 解码同样精确匹配；utf8 才能让 CLI 的中文提示正常显示
  const decode = (r) => Buffer.concat([r.stdout || Buffer.alloc(0), r.stderr || Buffer.alloc(0)]).toString('utf8');
  const FORTIFY_HARD_ERR = /-1100002|-10000404|-10000401|-1022200|10018/;
  const fortifyFailed = (r, out) => r.status !== 0 || FORTIFY_HARD_ERR.test(out) || /error_code|✖/.test(out);
  const fortifyHint = (out) => (/-1100002/.test(out) ? '-1100002：今日加固次数已达上限，明日再试（同 md5 24h 复用）'
    : /-10000404/.test(out) ? '-10000404：MP 后台未配置公钥（mp.weixin.qq.com → 开发支持 → 研发工具箱 → 密钥管理）'
      : /-10000401/.test(out) ? '-10000401：id_rsa.conf 与后台公钥不匹配'
        : /10018/.test(out) ? '10018：代码语法错误，加固失败' : '');

  let fr = runFortify();
  let fo = decode(fr);
  console.log(fo);
  if (fortifyFailed(fr, fo)) {
    if (FORTIFY_HARD_ERR.test(fo)) {
      fail(`加固失败：${fortifyHint(fo)}\n临时绕过：$env:WX_FORTIFY='0'（明文直传，不建议常态使用）`);
    }
    console.log('加固输出疑似失败，10 秒后自动重试 1 次 ...');
    const { setTimeout: wait } = await import('node:timers/promises');
    await wait(10_000);
    fr = runFortify();
    fo = decode(fr);
    console.log(fo);
    if (fortifyFailed(fr, fo)) fail(`加固失败：${fortifyHint(fo) || '详见上方输出'}（可 $env:WX_FORTIFY='0' 绕过）`);
  }

  // 产物断言：不假设 CLI 全量镜像目录
  if (!fs.existsSync(FORTIFY_OUT)) fail('加固输出目录 dist/fortify 不存在');
  const cfgList = JSON.parse(fs.readFileSync(fortifyCfgPath, 'utf8'));
  const tasks = (cfgList.obfuscation && cfgList.obfuscation.tasks) || [];
  const cfgFiles = tasks.flatMap((t) => (t.files || []).map((f) => (typeof f === 'string' ? f : f.path)));
  if (!cfgFiles.length) fail('code.fortify.config.json 里没有待加固文件');
  const relOut = (rel) => path.join(FORTIFY_OUT, rel.replace(/^\.\//, ''));
  const missing = cfgFiles.filter((rel) => !fs.existsSync(relOut(rel)) || fs.statSync(relOut(rel)).size === 0);
  if (missing.length) fail(`加固产物缺 ${missing.length} 个 js（首个：${missing[0]}）`);
  const mapped = cfgFiles.filter((rel) => fs.existsSync(`${relOut(rel)}.map`));
  if (mapped.length < cfgFiles.length * 0.9) {
    console.warn(`! sourcemap 覆盖偏低 ${mapped.length}/${cfgFiles.length}（可上传，但线上堆栈无映射）`);
  }
  // 模块加载扫描：混淆器（cli 0.1.8 level 2 已实测）会插入未声明的残留赋值，
  // ESM 严格模式下模块加载即 ReferenceError → 真机黑屏。node --check 查不出这类错误，必须真加载。
  globalThis.wx = globalThis.wx || new Proxy({}, { get: () => () => null });
  globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || (() => 0);
  const { pathToFileURL } = await import('node:url');
  const loadBad = [];
  for (const rel of cfgFiles) {
    if (rel === './game.js') continue;   // 入口顶层会启动游戏，依赖健康由 src 扫描覆盖
    try { await import(pathToFileURL(relOut(rel)).href); }
    catch (e) { loadBad.push(`${rel}: ${e.constructor.name}: ${e.message}`); }
  }
  if (loadBad.length) {
    fail(`加固产物模块加载失败 ${loadBad.length} 个（混淆缺陷，已拦截勿上传）：\n  `
      + loadBad.slice(0, 8).join('\n  ') + (loadBad.length > 8 ? `\n  ...（共 ${loadBad.length} 个）` : ''));
  }
  console.log(`✔ 模块加载扫描通过（${cfgFiles.length - 1} 个 src js 全部可加载）`);
  // 非 js 文件（game.json / 音效 / 图片 / project.config.json）：CLI 若未镜像则从 wechat/ 补拷
  let patched = 0;
  for (const f of walk(OUT)) {
    const dst = path.join(FORTIFY_OUT, path.relative(OUT, f));
    if (!fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(f, dst);
      patched += 1;
    }
  }
  if (patched) console.log(`✔ 补拷 ${patched} 个文件到 dist/fortify（CLI 未输出的非 js / 配置）`);

  // 加固产物上重跑 4MB 主包校验（*.map 体积豁免；packOptions.ignore 已排除加固配置 json）
  const fortAll = walk(FORTIFY_OUT);
  const isFortSub = (f) => path.relative(FORTIFY_OUT, f).split(path.sep)[0].startsWith('pkg_');
  const fortBytes = fortAll.filter((f) => !f.endsWith('.map') && !isFortSub(f))
    .reduce((n, f) => n + fs.statSync(f).size, 0);
  const fortAllBytes = fortAll.filter((f) => !f.endsWith('.map'))
    .reduce((n, f) => n + fs.statSync(f).size, 0);
  if (fortAllBytes > 30 * 1024 * 1024) {
    fail(`加固后主包 + 分包 ${(fortAllBytes / 1024 / 1024).toFixed(2)} MB 超 30MB 总包上限`);
  }
  if (fortBytes > 4 * 1024 * 1024) {
    fail(`加固后主包 ${(fortBytes / 1024 / 1024).toFixed(2)} MB 超 4MB：用 $env:WX_FORTIFY_FILES='key' 只加固`
      + ' game.js + src/core + src/data（受每日限频约束，勿反复降级重跑；'
      + '勿用 WX_FORTIFY_LEVEL=2，cli 0.1.8 该等级产物有未声明变量 bug 会黑屏）');
  }
  console.log(`✔ 加固产物：${(fortBytes / 1024 / 1024).toFixed(2)} MB / 4 MB`
    + `（${cfgFiles.length} 个 js 已混淆，${fortAll.length - cfgFiles.filter((r) => !r.endsWith('.map')).length} 个配套文件）`);
  // 源码映射（.map）不随包上传：加固 CLI 会额外产出 93 个约 2.2 MB 的 .map，
  // 打进包会让主包突破 4 MB（微信上传直接 abort），且会暴露源码结构。
  let droppedMaps = 0;
  for (const f of walk(FORTIFY_OUT)) {
    if (f.endsWith('.map')) { fs.rmSync(f, { force: true }); droppedMaps += 1; }
  }
  if (droppedMaps) console.log(`✔ 已剔除 ${droppedMaps} 个 sourcemap（不随包上传）`);
  const finalMain = walk(FORTIFY_OUT).filter((f) => !isFortSub(f))
    .reduce((n, f) => n + fs.statSync(f).size, 0);
  const finalAll = walk(FORTIFY_OUT).reduce((n, f) => n + fs.statSync(f).size, 0);
  console.log(`✔ 实际上传包：主包 ${(finalMain / 1024 / 1024).toFixed(2)} MB / 4 MB · `
    + `合计 ${(finalAll / 1024 / 1024).toFixed(2)} MB / 30 MB`);
  UPLOAD_DIR = FORTIFY_OUT;
} else {
  console.log("\n（WX_FORTIFY=0：跳过游戏深度保护加固，明文直传）");
}

// ---------- 3. 打 zip（便于备份 / 传给测试同学） ----------
fs.mkdirSync(DIST, { recursive: true });
const zipPath = path.join(DIST, `hanmo-xingwu-zhengzhanji-wechat-${VERSION}.zip`);
if (process.platform === 'win32') {
  try {
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${UPLOAD_DIR}' -DestinationPath '${zipPath}' -Force`,
    ], { stdio: 'inherit' });
    console.log(`✔ 已打包：${path.relative(ROOT, zipPath)}（${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB）`);
    console.log(`  注意：微信开发者工具要导入的是解压后的 ${path.relative(ROOT, UPLOAD_DIR)} 目录，不是 zip。`);
  } catch (e) {
    console.warn(`! 打 zip 失败（不影响工程目录）：${e.message}`);
  }
} else {
  console.log('（非 Windows 环境跳过 zip；直接使用上面的工程目录）');
}

// ---------- 4. 可选：调起微信开发者工具上传 ----------
if (DO_UPLOAD) {
  if (IS_TOURIST || !APPID_OK) fail('上传需要真实的小游戏 AppID（wx + 16 位十六进制），不能用 touristappid');
  const cliCandidates = [
    'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat',
    'C:/Program Files/Tencent/微信web开发者工具/cli.bat',
    'C:/Program Files (x86)/Tencent/微信开发者工具/cli.bat',
    'C:/Program Files/Tencent/微信开发者工具/cli.bat',
    'D:/wechat_tool/微信web开发者工具/cli.bat',
  ];
  const cli = cliCandidates.find((p) => fs.existsSync(p));
  if (!cli) fail('没找到微信开发者工具 CLI，请手动在开发者工具里点「上传」');
  console.log(`\n正在调用微信开发者工具上传 v${VERSION} ...`);
  // cli.bat 路径含空格：不能用 shell:true 直接拼字符串（会被拆成 'C:/Program'）。
  // 改由 PowerShell 起进程，中文上传描述也能按 Unicode 正确传给 .bat。
  const ps = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const psCmd = `& ${ps(cli)} upload --project ${ps(UPLOAD_DIR)} --version ${ps(VERSION)} --desc ${ps(DESC)}`;
  // 上传必须捕获输出来判断成败：cli.bat 内部报错（如 getClients timeout code 10）
  // 仍会以退出码 0 结束，只看 status 会打出假「✔ 已提交」。
  // 错误串是 ASCII，用 latin1 解码做匹配不受终端编码影响。
  const runUpload = () => spawnSync('powershell.exe', ['-NoProfile', '-Command', psCmd], {
    encoding: 'buffer', timeout: 15 * 60 * 1000,
  });
  let up = runUpload();
  let upOut = Buffer.concat([up.stdout || Buffer.alloc(0), up.stderr || Buffer.alloc(0)]).toString('latin1');
  const uploadFailed = (r, out) => r.status !== 0
    || /getClients timeout|did not connect|✖|\berror\b|失败/i.test(out);
  if (uploadFailed(up, upOut)) {
    console.error(`上传输出（尾部）：\n${upOut.slice(-1500)}`);
    console.log('首次上传未成功，10 秒后自动重试 1 次 ...');
    const { setTimeout: wait } = await import('node:timers/promises');
    await wait(10_000);
    up = runUpload();
    upOut = Buffer.concat([up.stdout || Buffer.alloc(0), up.stderr || Buffer.alloc(0)]).toString('latin1');
    if (uploadFailed(up, upOut)) {
      console.error(`上传输出（尾部）：\n${upOut.slice(-1500)}`);
      fail('上传失败：请检查微信开发者工具是否已登录、AppID 是否为小游戏、网络是否正常');
    }
  }
  console.log('✔ 已提交到微信后台的「开发版本」。下一步：mp.weixin.qq.com → 版本管理 → 提交审核 → 发布。');
} else {
  console.log('\n下一步（二选一）：');
  console.log('  A. 微信开发者工具 → 导入项目 → 选择 wechat/ → 上传（推荐先手动确认 AppID / 类目）');
  console.log(`  B. 已登录开发者工具时执行：$env:WX_UPLOAD='1'; $env:WX_APPID='${IS_TOURIST ? 'wx你的AppID' : APP_ID}'; npm run wx:release`);
}

console.log('\n发布前还需要人工确认：');
console.log('  · AppID 是「小游戏」类型（不是普通小程序），并已开通对应类目 / 资质；');
if (hasRealBgm) {
  console.log('  · 主 BGM 已放入 assets/audio/glorious_morning.mp3（请确认版权 / 授权范围）；');
} else {
  console.log('  · 正式 BGM 尚未放入 assets/audio/glorious_morning.mp3（当前用商城循环兜底）；');
}
console.log('  · 激励视频广告位 ID（tools/build-wx.mjs 里的 AD_UNIT_ID）是否已换成自己的；');
console.log('  · 微信后台补齐用户隐私保护指引（本作只本地存档，不联网、不收集个人信息）；');
console.log('  · 上传后到 mp.weixin.qq.com 提交审核，审核通过再点「发布」。');
