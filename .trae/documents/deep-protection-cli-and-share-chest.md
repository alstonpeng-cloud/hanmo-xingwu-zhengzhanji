# 深度保护 CLI 接入 + 分享得宝箱 + 补传 1.2.2

> **状态更新（2026-11-21 · v1.0.36 / 微信后台 1.2.9）**：微信自 2021-10 起移除 `wx.shareAppMessage` 的 success/fail 回调，本文「success 回调即发奖」的方案已失效并被替换——现为**点开分享面板即发奖**（`result.js shareNow` 先 `claimShareReward` 再调起面板，完全不依赖回调），每日 2 次额度与金箱 / 史诗箱分档不变。同时 1.2.9 已**移除全部看广告奖励入口**（本文不涉及）。以下正文保留为当时的实施记录。

## Context

用户提出两项新需求：① 接入微信官方「游戏深度保护」插件（已确认走 **CLI 流水线方式**，加固能力集成进发布链路，两种接入方式加固能力等价）；② 结算页增加分享功能——**每天限 2 次，奖励分档：`maxCleared < 200` 送黄金箱（`gold`）、`≥ 200` 送史诗宝箱（`epic`）**（基于用户对判定口径的改写「200关后分享送史诗宝箱」）。

另有一项遗留：上一轮 1.2.2 体验版**上传实际失败**（cli.bat 报 `getClients timeout` 仍返回退出码 0，[release-wx.mjs](file:///d:/Projects/record/trae_project/game_demo/tools/release-wx.mjs#L113) 只检查退出码导致打出假「✔ 已提交」），需补传并修复该假成功 bug。

技术前提（已调研核实）：
- npm 包 `minigame-code-fortify-cli@0.1.8`，Node≥17.5（本机 v24 ✓）；`id_rsa.conf`＝`[appid]` + `[private_key]`（PKCS#1 PEM）；`code.fortify.config.json`＝`{"obfuscation":{"name":"代码混淆","tasks":[{level,files}]}}`；配置由 package.json 的 `minigame_code_fortify_cli` 块指定 workDir/outputDir/secretConfig/timeout_minute（**outputDir ≠ workDir 是官方硬性要求**）。
- 错误码：`-1100002` 每日限频（同 md5 24h 内复用，重跑只补缺失）、`-10000404` MP 后台未配公钥、`-10000401` 密钥不匹配；首次加固是网络加密服务，80 文件耗时可达分钟级（timeout_minute 设 30）。
- 当前主包 3.46MB / 4MB 上限，混淆会膨胀 → 加固产物必须重跑体积校验；sourcemap（`*.js.map`）体积豁免。
- 源码预检通过：无 `eval`/`with`/`function.toString`/`constructor.name` 依赖。
- 分享：小游戏**本地无法判定"发到了群"**（shareTicket 只在他人从群卡片回流时给且需服务端解密）→ 分享成功回调即发奖，文案引导「分享到微信群」，不开 withShareTicket（它会强制单选联系人、禁二次转发，反损传播）。

## 执行顺序

**C → B → A → 打 1.2.3 上传**。C 必须最先：任何 `build:wx` 都会 `fs.rmSync` 重建 `wechat/`，先动 A/B 就拿不到 1.2.2 原产物了。

### C. 补传 1.2.2 + 修假成功 bug（先做）

1. 补传（当前 `wechat/` 与 1.2.2 zip 同源，直接传）：
   ```powershell
   D:/wechat_tool/微信web开发者工具/cli.bat upload --project D:/Projects/record/trae_project/game_demo/wechat --version 1.2.2 --desc "汉末行伍征战记 1.2.2 体验版"
   ```
   以 `EXIT=0` 且输出无 `getClients timeout|did not connect` 为准（1.2.1 就是这么补传成功的）。成功后到 mp.weixin.qq.com 版本管理把 1.2.2 选为体验版（浏览器自动化，需扫码）。
2. [release-wx.mjs](file:///d:/Projects/record/trae_project/game_demo/tools/release-wx.mjs#L109-L114)：上传改为捕获输出（`encoding:'buffer'`、latin1 解码回显尾部），`status !== 0 || /getClients timeout|did not connect|error/i.test(out)` 即 `fail()`，失败自动重试 1 次。

### B. 分享得宝箱

1. **新增** [src/core/shareReward.js](file:///d:/Projects/record/trae_project/game_demo/src/core/shareReward.js)：`SHARE_DAILY_LIMIT = 2`；`shareRewardFor(maxCleared)` → `maxCleared >= 200 ? 'epic' : 'gold'`；`sharesLeft(state, now)`；`claimShareReward(state, now)` → `ensureDaily` 后超限返回 `{ok:false, reason:'limit'}`，否则 `s.shares += 1` + `addChest(state, chest, 1)` 返回 `{ok:true, chest, left}`（发放走 [chests.js `addChest`](file:///d:/Projects/record/trae_project/game_demo/src/core/chests.js#L61)）。
2. [src/core/daily.js](file:///d:/Projects/record/trae_project/game_demo/src/core/daily.js#L25-L46)：`ensureDaily` 初始化加 `s.shares`（仿 `s.clears`），跨天重置块加 `s.shares = 0`；切天口径复用 `dateKey()`（北京时间）。
3. 平台层接口对齐 `share({title, imageUrl, success, fail})`：
   - [src/platform/wx.js](file:///d:/Projects/record/trae_project/game_demo/src/platform/wx.js#L115-L307)：`createWxPlatform` 里 try 包裹 `wx.showShareMenu({menus:['shareAppMessage']})` + `wx.onShareAppMessage(() => ({title}))`（右上角胶囊被动分享），新增 `share()` 调 `wx.shareAppMessage`。
   - `src/platform/web.js`：`share(opts)` → `fail({errMsg:'unsupported'})`。
   - tools/test.mjs 与 tools/smoke.mjs 的平台桩加 `share(opts){ opts?.success?.(); }`。
4. [src/screens/result.js](file:///d:/Projects/record/trae_project/game_demo/src/screens/result.js#L36-L51)：
   - 构造器加 `this.shareRect = win ? {x:275,y:1240,w:200,h:60} : {x:275,y:1180,w:200,h:56}`（已核对：win 底排 tertiary 止于 y1222、败者止于 y1164，不重叠）。
   - `onDown`/`tap` 加 `hit(this.shareRect, ...)` → `shareNow()`。
   - `shareNow()`：`sharesLeft <= 0` → `playSfx('error') + game.toast('今日分享奖励已领完（每天 2 次）')`；否则 `game.platform.share?.({title, success(){ claimShareReward → game.save() + playSfx('reward') + toast(`史诗宝箱/黄金箱 ×1 已入宝箱仓库`)}, fail(){ toast('分享未完成，未发放奖励') }})`。
   - 按钮文案随档位：`分享得黄金箱` / `分享得史诗宝箱`，额度用尽置灰并显示「今日已领完」。
5. [tools/test.mjs](file:///d:/Projects/record/trae_project/game_demo/tools/test.mjs)：新增断言组（仿 L535-568 风格）：199→gold、200→epic、800→epic；连领 2 次 ok、第 3 次 limit；`chestCount` +1；改 `state.daily.day` 为昨天后可再领；ResultScreen 构造后 `shareRect` 与 primary/secondary/tertiary 不相交、中心 `hit()` 为真、点击触发桩 share 且回调后箱子入仓。

### A. 深度保护 CLI 接入

1. **密钥（我生成）**：仓库根跑 node crypto 生成 RSA-2048 → `id_rsa`（PKCS#1 私钥）/ `id_rsa.pub`（公钥）→ 拼出 `id_rsa.conf`（`[appid]\nwx3c15f63d6e349d6\n[private_key]\n<PEM>`）。新增 `.gitignore`（`id_rsa*`、`node_modules/`、`dist/`、`wechat/`——当前目录非 git 仓库也先建，防日后 init 泄漏）。
2. **人工前置（需要你）**：管理员微信扫码登录 mp.weixin.qq.com → 开发支持 → 研发工具箱 → 密钥管理 → 添加公钥，粘贴 `id_rsa.pub` 全文。（届时我可用浏览器自动化带你走一遍。）
3. [package.json](file:///d:/Projects/record/trae_project/game_demo/package.json)：`devDependencies` 加 `minigame-code-fortify-cli@^0.1.8`；scripts 加 `"code-fortify": "minigame-code-fortify-cli-package-run"`；新增配置块：
   ```json
   "minigame_code_fortify_cli": {
     "workDir": "./wechat", "outputDir": "./dist/fortify",
     "secretConfig": ".", "timeout_minute": 30
   }
   ```
4. [tools/build-wx.mjs](file:///d:/Projects/record/trae_project/game_demo/tools/build-wx.mjs)：构建收尾时 walk `wechat/` 收集全部 js（约 75 个含 game.js）→ 写 `wechat/code.fortify.config.json`（单 task，`level = Number(process.env.WX_FORTIFY_LEVEL || 2)`——**首跑保守用 2**，3.46MB 余量仅 0.54MB，避免触碰日限频后没法降级）；`packOptions.ignore` 加 `code.fortify.config.json`（否则计入主包体积）。
5. [tools/release-wx.mjs](file:///d:/Projects/record/trae_project/game_demo/tools/release-wx.mjs)：构建与体积校验之后、zip 之前插入加固段（`WX_FORTIFY='0'` 可显式跳过，**不默认静默跳过**）：
   - `spawnSync(process.execPath, [binFile], {cwd: ROOT, encoding:'buffer', timeout: 40min})`（读 node_modules 包 package.json 的 bin，绕开 .cmd/shell 问题）；输出 latin1 解码回显。
   - 失败判定：`status !== 0` 或输出匹配 `-1100002|-10000404|-10000401|-1022200|10018` → `fail()`，`-1100002` 文案注明「今日限频，明日再试」；非限频错误自动重跑 1 次。
   - 产物断言（**不假设全量镜像**）：`dist/fortify` 必需文件齐全、配置列出的每个 js 存在且非空、≥90% 有同名 `.map`；缺非 js 文件（game.json/assets/project.config.json 等）则从 `wechat/` 补拷。
   - **在 `dist/fortify` 上重跑 4MB 校验且排除 `*.map`**；超限则失败并提示 `WX_FORTIFY_LEVEL=1` 或 `WX_FORTIFY_FILES=key`（只加固 game.js + src/core + src/data）重打，不做自动无限阶梯。
   - zip 与 `cli.bat upload --project` 改指向 `dist/fortify`。
6. **MP 后台未配公钥前**，release 走 `WX_FORTIFY='0'` 保持可上传；配好后再开。

### 收尾：1.2.3 上传

A+B 全绿后：`$env:WX_APPID='wxa3c15f63d6e349d6'; $env:WX_VERSION='1.2.3'; $env:WX_UPLOAD='1'; npm run wx:release` → mp.weixin.qq.com 把 1.2.3 选为体验版（浏览器自动化 + 扫码）。

## 验证

1. `npm test`（1468+ 新断言）→ `npm run smoke`（result 页截图为落盘校验、非基线对比，自动覆盖）。
2. `npm run build:wx`（带 WX_APPID）→ 玩家版自检通过。
3. 分享功能：test/smoke 桩走通逻辑层；真机/开发者工具预览里点结算页分享按钮 → 调起微信分享 → success 回调箱子入库、toast 提示、连点 2 次后第 3 次提示已领完、跨天恢复。
4. 加固：先 `WX_UPLOAD='0' npm run wx:release` 跑通 build→fortify→断言→体积校验；微信开发者工具**导入 `dist/fortify` 目录**预览真跑（战斗/开箱/分享无报错、vConsole 干净）；确认后才 `WX_UPLOAD='1'`。
5. 补传与新上传均以「cli 输出无 `getClients timeout` + 微信后台版本管理出现对应开发版本」为成功标准。

## 风险

- 加固产物是否全量镜像目录未实测 → 以断言 + 补拷兜底（最大不确定点）。
- 3.46MB 混淆后可能超 4MB → 首跑 level 2、体积校验硬失败、可降文件集；受每日限频约束不做多次自动重试。
- `cli.bat upload` 对未导入过的新目录 `dist/fortify` 可能报工程不存在 → 先用开发者工具手动导入一次。
- MP 公钥配置需管理员权限，是 A 的硬前置；未配前 release 显式跳过加固。
