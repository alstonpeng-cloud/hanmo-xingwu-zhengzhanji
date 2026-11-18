# 修复剩余 Bug + 一键合成门槛与教程

## Context

外部审查后用户已拍板，本轮只做四件事：修 B1–B8（不含 B10 已决策项）、给一键合成加入口门槛、补一次「拖动合成」教程、同步 README 口径。明确不动英雄战数值、`src/core/power.js`、不重置存档、不上传任何版本。

当前关键现状（已核对）：
- `deploy.js` 空态固定写“还没有可用兵牌”，不区分“已全部上阵”。
- `game.js` 的 `toast()` 是单槽覆盖，解锁提示会互相吞。
- `config.js` 的铂金箱 / 玄玉箱 `desc` 含“（占位）”“概率后续再定”，会经 `chests.js` 说明弹窗展示给玩家。
- 主循环（`src/main.js`、`tools/build-wx.mjs` 模板）无异常兜底；微信平台无 `wx.onError`。
- `wx.js` 用 `obeyMuteSwitch:false`（无视系统静音），音效池未挂 `onError`，无音频打断回调。
- `save.js` 的 `stats` 四个字段完全没洗；`coins/heroTickets/recruitBoxSeq/chests` 无上限。
- 无 `lastSeen`，时钟回拨会把 `idleAt` 卡在未来。
- 兵营「一键合成」按钮无条件绘制、无条件响应点击。
- `merge` 教程当前在 `deploy` + `barracks`、只要有两个可合成兵牌就弹。

## 一、Bug 修复

### B1 布阵页空态文案
文件：`src/screens/deploy.js`（`drawCardList()` 约 1465 行）

`!cards.length` 时按 `st.units.length` 分支：
- `> 0`：`已全部上阵 · 拖动上阵位可调整位置`
- `=== 0`：保留 `还没有可用兵牌 · 闯关 / 商城可以获得更多兵`

### B2 toast 队列
文件：`src/game.js`

- 构造函数、`resetGame`/`finishPrologue` 的教程状态重置处补 `this.toastQueue = []`。
- `toast(msg, dur)` 改为入队：与当前显示文案相同则续时，与队尾相同则忽略；队列上限 4 条；当前槽空闲时立即出队。
- 新增 `nextToast()`：出队并写入 `toastText/toastT`；队列空则清空。
- `update()` 中倒计时到 0 后调用 `nextToast()`；无显示但有积压时也出队。
- `showcaseUnit()` 现有 `this.toastT = 0` 同时清 `toastText`，保持“展示页不叠字”。
- 保留 `toastText/toastT` 字段，避免现有测试/调用失效。

### B3 玩家可见文案
文件：`src/data/config.js`

- 铂金箱 `desc`：`第二章之后开放`。
- 玄玉箱 `desc`：`古玉重宝 · 更高一档，后续版本开放`。
- 代码注释可保留（不面向玩家）。
- 核查 `src/screens/heroes.js` 招募说明：确认奖池权重与 `pity` 保底为配置真实值展示；若权重未展示，从 `CONFIG.heroes.recruit` 读取权重补一行展示（不新增数值）。
- 宝箱说明弹窗已按 `drops` 的 `desc` 展示真实概率，无需改逻辑。

### B7 帧级异常兜底
文件：`src/main.js`、`src/game.js`、`tools/build-wx.mjs`、`src/platform/wx.js`

- `main.js` 循环：`update/draw` 包 `try/catch`，失败累计；成功后清零。`catch` 里调用 `game.onFrameError(e, streak)`，且无论如何继续 `requestFrame`。
- `Game.onFrameError(e, streak)`：
  - 清 `pointer`；`ad` 存在则 resolve `'interrupt'` 防止 Promise 卡死；
  - 连续失败到第 3 帧时清空教程浮层并 `this.home()` 做安全恢复（仅触发一次）；
  - `typeof console !== 'undefined' && console.error` 记录错误（玩家版不禁止 `console.error`）。
- `build-wx.mjs` 生成的 `wechat/game.js` 模板同步同样的 try/catch + `game.onFrameError`。
- `wx.js` 平台新增 `onError(handler)`：注册 `wx.onError` 与 `wx.onUnhandledRejection`（存在才注册），把错误交给 `Game.onFrameError`（streak 传 1，不触发跳首页逻辑或按同一策略）。
- `Game` 构造函数中若 `platform.onError` 存在则接线。

### B8 音频
文件：`src/platform/wx.js`、`src/game.js`（`src/core/audio.js` 仅在必要时补充）

- `wx.setInnerAudioOption({ obeyMuteSwitch: true, mixWithOther: true })`，遵守系统静音；现有游戏内声音开关保持独立。
- 音效池每个 `InnerAudioContext` 挂 `onError(() => { try { a.stop(); } catch (e) {} })`。
- 平台新增 `onAudioInterruption(handler)`：`wx.onAudioInterruptionBegin → handler(false)`，`wx.onAudioInterruptionEnd → handler(true)`。
- `Game` 构造函数接线：`false → suspendForVisibility()`，`true → resumeForVisibility()`（复用现有暂停/续播逻辑，验证 `audio.js` 的暂停恢复对 BGM 生效）。

### B6/S5 存档数值清洗
文件：`src/core/save.js`

- 新增上限常量（文件内）：`MAX_COINS = 1e9`、`MAX_TICKETS = 9999`、`MAX_SEQ = 1e6`、`MAX_STAT = 1e9`、`MAX_CHEST = 9999`。
- `coins`：`Number.isFinite` 时 `clamp(0, MAX_COINS, floor)`，非法仍回退 `CONFIG.economy.startCoins`。
- `heroTickets`、`recruitBoxSeq`、`stats.battles/wins/adsFinished/adsInterrupted` 全部 `Number.isFinite` + `Math.max(0, floor)` + 上限；非法回退 0。
- `sanitizeChests` 每档数量加 `MAX_CHEST` 上限。
- 不改 `STATE_VERSION`（避免重置玩家存档）。

### B5/S2 本机时间回拨
文件：`src/core/save.js`、`src/core/idle.js`、`src/game.js`、`src/core/idleChest.js`（只读现有字段后 rebase）

- `createNewState()` 增加 `lastSeen: Date.now()`。
- `sanitize()`：
  - `lastSeen = Number.isFinite(raw.lastSeen) ? floor(raw.lastSeen) : now`；
  - 回拨判定：`now + 5min < lastSeen`；
  - 回拨时：`idleAt = now`（不白给挂机收益）、重设挂机宝箱计时锚点到 `now`（只改时间锚点，不重置进度）、`daily.day = dateKey(now)`、若 `daily.loginDay` 晚于今天则改为今天（防止回拨日重复领 7 日登录）；
  - 最终 `lastSeen = now`（避免永久判定回拨导致永远没有挂机收益）。
- `Game.save()` 写档前 `state.lastSeen = Math.max(Number(state.lastSeen) || 0, Date.now())`。
- `idle.js` 的 `ensureIdleAt()`：若 `state.idleAt > nowMs + 5min`（运行中回拨）则 `state.idleAt = nowMs`，`idleElapsedMs` 仍保持 `Math.max(0, ...)`，玩家不会卡死也不会白拿。
- 不做后端校验。

### B9 README 口径
文件：`README.md`

测试与构建跑完后，按真实值统一：版本号（`package.json` 当前值，预计 1.0.26）、`npm test` 断言数、smoke 断言/截图数、关卡总数（`CONFIG.levelGen.total`，预计 2600）与章节描述、游戏名「汉末行伍征战记」。替换旧值（v0.1 / 1.1.5 / 400 关 / 73 截图 / 436 断言），不重写整篇文档。

## 二、一键合成按钮门槛

文件：`src/core/merge.js`、`src/screens/barracks.js`

- `merge.js` 导出唯一常量：`export const AUTO_MERGE_MIN_UNITS = 25;`。
- `barracks.js` 导入该常量：
  - 新增 `canAutoMerge()`：`this.game.state.units.length >= AUTO_MERGE_MIN_UNITS`；
  - `draw()` 中仅 `canAutoMerge()` 为真时绘制按钮；
  - `onDown()` 中仅 `canAutoMerge()` 为真时处理 `mergeAllRect` 命中。
- 不改 `autoMerge` 数值与战力收益，不改布局坐标。

## 三、达到 25 兵牌后的一次拖动合成教程

文件：`src/core/tutorial.js`、`src/screens/barracks.js`、`src/core/save.js`

- `barracks.tutorialAnchors()` 增加 `mergeReady: state.units.length >= AUTO_MERGE_MIN_UNITS`（仅非 `viewOnly`）。
- `TUTORIAL_STEPS` 的 `merge` 步骤：
  - `screen: 'barracks'`（不再在布阵页触发）；
  - `when: (st, ctx) => !!ctx.mergePair && ctx.mergeReady === true`；
  - 文案/手势保持现状（`gesture:'merge'`、`action:'拖到一起'`），只教拖动合成。
- 老存档不补触发：
  - `sanitizeTutorial(raw, { legacy, maxCleared, unitCount })` 增加 `unitCount`；
  - 读档时 `unitCount >= 25` 且该档尚未看过 `merge` → 直接标记 `seen.merge = true`（这次更新前就已经 ≥25 的档视为老档，不补弹）；
  - `legacy` 逻辑保持不变（无 tutorial 字段且 maxCleared≥10 全部标已看）。
- 持久化沿用现有 `tutorial.seen` + `markTutorialSeen`，`dismissTutorial` / 完成拖合后只触发一次。
- 触发时机：进入兵营且 25 张兵牌、存在可见合成对时，强引导遮罩中断操作（`pickTutorial` 每帧刷新机制）。

## 四、明确不改

- 英雄战 `hpMult`、精锐等级、150 关配置全部不动。
- `src/core/power.js` 不动；仅在 README 说明战力口径（已含战法倍率/连射/毒伤，未含英雄技能，英雄另有 `heroPower`）。
- 不重置存档、不提升 `STATE_VERSION`。
- 不上传体验版或任何版本。

## 验证

1. `npm test`：全部通过；如现有断言依赖被改行为（toast/教程 trigger/兵营按钮），按新行为同步断言，不改测试意图。
2. `node tools/smoke.mjs`：通过，记录真实断言数与截图数。
3. `node tools/smoke.mjs --player`：通过，记录断言/截图数。
4. 补充针对性手工验证（可用 smoke/临时脚本）：
   - 兵全上阵时空态显示“已全部上阵”；
   - 连续两次 `toast` 都能依次看到；
   - `units.length < 25` 时兵营无「一键合成」按钮且点击该区域无效，`>= 25` 出现；
   - 新档在兵营达到 25 张时弹一次拖动合成引导；看完后重进不再弹；读入 25 张旧档不弹；
   - `coins/heroTickets/stats` 传入 `NaN/Infinity/超大值` 读档后为合法值；
   - 模拟 `lastSeen` 为未来时间读档：`idleAt/lastSeen` 被纠正，挂机收益为 0 且后续正常累积。
5. `$env:WX_APPID='wxa3c15f63d6e349d6'; node tools/build-wx.mjs` 重建 `wechat/` 玩家版（不上传），确认自检通过、`#dev-only` 剥离、`__game/DEV/开发者/调试` 零命中。
6. 最后按真实值同步 README（B9）。
