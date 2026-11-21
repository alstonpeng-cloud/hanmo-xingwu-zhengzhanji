# 1.2.9：移除全部广告奖励入口 + 分享即发奖 + 结算页分享按钮改版

## Context
- 玩家侧存在多处「看广告获取奖励」入口（战败页试用兵、商城广告宝箱、英雄页广告券、game.js 模拟激励视频浮层），本轮全部移除。**决策：只删界面入口，core 层逻辑（core/ads.js、heroAdLeft/claimHeroAdTicket、CONFIG.ads、wx.js rewardedAd 接入）与既有测试保留**，沿用仓库 claimAdCoins「无入口仅测试覆盖」的先例。
- 「分享后没有奖励」bug 根因：微信自 2021-10 移除 `wx.shareAppMessage` 的 success/fail 回调，`shareNow()` 里 success 回调永不执行。**用户已选定方案：点开分享面板即发奖**（放弃群聊限制）。
- 分享按钮改版：亮绿色、与「继续挑战」primary 同尺寸、动效（变大回弹 + 上下轻微抖动）；战败页原广告按钮位置换成同款分享按钮。
- 完成后发版 **1.2.9** 上传微信体验版 + 同步 GitHub（扫码/登录时喊用户）。

## 1. 移除广告 UI 入口（core 全保留）

### src/screens/result.js
- 删 L4 `adsLeft, rollDefeatTroop, claimDefeatTroop` import、L5 `trialUnits, TRIAL_ROUNDS` import（确认无其它引用）。
- 删 `watchTroopAd()`（L97-119）、`drawTroopAdButton()`（L571-604）、构造中 `troopReward`/`troopAdUsed`（L43-45）。
- tap()：lose 分支 `else this.watchTroopAd()`（L226）→ 改调 `this.shareNow()`。
- draw()：lose 分支 `this.drawTroopAdButton(ctx)`（L345）→ 由分享按钮绘制替代（见 §3）。
- 更新相关过时注释（L38/L44/L50/L53）。

### src/screens/shop.js
- 删 L7 import `adsLeft, shopAdsState, claimAdChest`、`adChestRects` 字段、`adChest()` 方法（L97-113）、tap 中遍历 adChestRects（L146-151）、draw 中广告宝箱按钮块（L278-296）。
- SHOP_LAYOUT 删 `adNoteY`、`adRow`（smoke 同步）。
- 文案：L250 标题改「特殊宝箱 · 铜钱直购」；L309 info 行删「商店广告…」；L247 注释更新。

### src/screens/heroes.js
- 删 L12 import `heroAdLeft, claimHeroAdTicket`、HERO_LAYOUT.`adRect`、tap L247、`watchAd()`（L257-270）、draw 中广告按钮块（L353-366，含 `ticketLocked`/`left` 计算）。
- L4 注释、L435 帮助文案去掉「每日广告 +1」。

### src/game.js（模拟激励视频浮层，playRewardedAd 全仓无外部调用者）
- 删 L17 `AD_CLOSE_RECT`、L37 `this.ad=null`、`playRewardedAd()`（L283-289）、handleDown 广告关闭分支（L301-312）、onFrameError 清 this.ad（L364-368）、update 广告计时分支（L390-398）、draw 中 `drawAd` 调用（L450）与 `drawAd()`（L467-485）。
- import L5 移除仅广告使用的 `hit, bar, screenDim`（逐一核对后再删）。

### 保留不动
core/ads.js、core/heroes.js 广告函数、CONFIG.ads、save.js 广告字段、wx.js rewardedAd 接入（L170-210）、build-wx.mjs AD_UNIT_ID。

## 2. 分享即发奖（修 bug）
- `src/screens/result.js shareNow()`（L244-269）改为：`sharesLeft<=0` 拦截 → **先 `claimShareReward(g.state)`**（失败同拦截）→ `g.save()` + `playSfx('reward')` + toast「已打开分享面板：{宝箱} ×1 已入宝箱仓库」→ 再 `g.platform.share({ title })`，**不再传 success/fail**。
- `src/platform/wx.js share()`（L319-332）：删 success/fail 传参，只留 title/imageUrl + try/catch，注释注明「微信 2021-10 起无回调，点开面板即发奖」。
- `src/platform/web.js share()`：保持 no-op（claim 已在 share 前完成，web 试玩版同样发奖；测试桩最简单）。

## 3. 分享按钮改版（亮绿 + 同尺寸 + 动效）
新增 `drawShareButton(ctx)`，win/lose 共用，替换原小 shareRect 绘制块（L348-357）：
- **胜利页布局**（H=1334 内不重叠）：`primary {175,976,400,96}` 不动；`shareRect {175,1084,400,96}`（原 secondary 位）；`secondary {175,1188,400,76}`（返回关卡进度）；`tertiary {275,1272,200,52}`；删原 `{275,1240,200,60}`。
  - ⚠️ smoke L822 `tap(375,1122)` 是 secondary 中心 → 改 `tap(375,1226)`。
- **战败页**：`primary {175,850,400,112}` 不动；`shareRect = 原广告位 {175,976,400,96}`；`tertiary {275,1108,200,56}` 不动；删原小 shareRect `{275,1180,200,56}`（合并为一个按钮）。
- **样式**：微信亮绿 `fill:'#07c160'`、`stroke:'#059a4d'`、白字、`size:32`（与 primary 对齐）；label 沿用 `分享得${chestName}` / 额度尽 `今日已领完`（disabled）。THEME.green `#6e9b72` 太暗不用。
- **动效**（用已有 `this.t`）：
  ```js
  const pulse = on ? 1 + 0.04 * (0.5 + 0.5 * Math.sin(this.t * 3.0)) : 1; // 回弹 1.00→1.04
  const dy = on ? Math.sin(this.t * 6.28) * 3 : 0;                       // 上下 ±3px
  ctx.save(); ctx.translate(cx, cy + dy); ctx.scale(pulse, pulse); ctx.translate(-cx, -cy);
  button(ctx, r, label, { size: 32, fill: '#07c160', stroke: '#059a4d', textColor: '#fff', disabled: !on });
  ctx.restore();
  ```
- **命中区恒用原始 shareRect**（不做动画偏移，避免点不中）。

## 4. 测试与冒烟同步
### tools/test.mjs
- L1548-1577 分享用例改写：布局断言坐标更新；`tap` 后**直接断言**宝箱入仓/shares=1/saveCalled（删 `shareCalls[0].success()` 手动触发）；第 2 次发奖、第 3 次拦截逻辑保留；可补 lose 页 tap shareRect 发奖断言。
- core 广告用例（L1850-1887、L3723-3730、L3834-3837、L4192-4204）与 L25 import **全保留**（用户决策）。
### tools/smoke.mjs
- L98-99 分享桩改 `share() {}`；L822 坐标改 `(375,1226)`。
- 战败块：删 L1590-1631 广告 tap/试用兵断言及截图 `37a_result_fail_ad_ready`、`37b1`、`37b`、`37b2`、`37c`、`37d`；保留克制环截图与像素校验。
- 商城广告块 L1904-1929 删除（截图 `46b_shop_ad_chests`）；英雄广告 tap L1993-2000 删除（保留 48b/48c）。
- 新增截图 `12c_result_share_btn`（胜利页亮绿分享按钮目检）。

## 5. README / 文档过时信息更新
- 顶部新增 `### v1.0.36（本轮 · 微信后台 1.2.9）` 条目（六项改动 + 门禁数字 + progressSuccess 时间 + zip 名）；L376 上传记录段追加 1.2.9。
- 逐处更新：L11/L172-173/L412/L416/L421 门禁口径与覆盖描述（删广告字样）；L111 删「看广告领宝箱」句；L112 改为「广告奖励入口已全部移除（1.2.9）；core/ads.js、激励视频接入保留为遗留，无 UI 调用者」；L126 删「模拟激励视频」；L139 ads.js 描述改遗留口径；L156 加「分享无 success/fail 回调」；L379 激励视频条改写；L387 适配层描述改分享新机制；L401/L404 提审项改写。
- `.trae/documents/deep-protection-cli-and-share-chest.md` L14/L72、`docs/troop-balance.md` L114 同步去掉 success 回调/广告截图描述。

## 6. 发版与同步（完成后执行）
1. `npm test` + `npm run smoke` 全绿。
2. `$env:WX_APPID='wxa3c15f63d6e349d6'; $env:WX_VERSION='1.2.9'; $env:WX_UPLOAD='1'; $env:WX_DESC='移除广告入口、分享即发奖、分享按钮改版'; npm run wx:release`（release-wx.mjs L17 读 WX_VERSION）。
3. 成功判据：WeappLog 出现 `[uploadFile] progressSuccess`。
4. mp 后台把开发版设为体验版 —— **登录过期，喊用户扫码**。
5. GitHub：`gh auth login --web` 设备码 —— **喊用户**；commit + tag `v1.2.9` + push。

## 7. 验证
- `npm test`：预期 1620±1 通过 / 0 失败（仅分享 UI 用例改写）。
- `npm run smoke`：预期约 81-83 断言 / 193-194 截图 / 0 报错（删除 3 组广告检查所致，以实跑为准）。
- 目检截图：`12_result`（胜利页绿色大分享按钮、无重叠）、新增 `12c`、`37_result_fail_counter_ring`（战败页绿按钮占原广告位）、`46_shop_chests_bought`（广告行消失）、`48b_hero_screen`（右上广告券消失）、`13_result_back`（secondary 新坐标可点）。
