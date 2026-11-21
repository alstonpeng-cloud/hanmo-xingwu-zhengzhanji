# 体验版 1.2.8：红点 / 成就栏 / 周常积分重设计 / 每日卡片改版

## Context（为什么做）

用户验收 1.2.7 后提出 6 项改动，完成后发体验版 1.2.8：

1. **红点去数字**：首页每周/每日圆钮角标现在显示剩余关卡数（39/30），要求改为纯色呼吸红点，玩家点进面板后下次消失（按周期重显）。
2. **成就分类栏被裁切**：`ACHIEVEMENT_LAYOUT.tabs`（x0=27, w=132, gap=9）6 个页签总宽 837 > 750，第 6 个「经济」超出右边缘，且无法拖动看到。
3. **周常积分重设计**：现在开局一次性发 1600 分。要求改为「开局少、每通一个大关（档位）发递增积分」——第 1 档积分少到传奇兵种只能出几个，逐档递增，同时难度飙升。
4. **周常第 11 关 bug**：`battle.js` 结算页 `weeklyStageUnlocked(st, tier, stage+1)` 在 stage=10 时把 11 clamp 成 10 后检查第 9 关的位 → 恒真 → 出现「下一关 = 第 11 关」（第 5 档第 10 关后还会推出不存在的第 6 档）。
5. **每日挑战卡片**：卡片里放英雄模型（drawHeroFigure/drawHeroAura）太塑料，改为只写关卡号 + 战斗力数字。
6. **按钮太小**：每周/每日挑战面板的关卡卡片（128×150、字号 11~17）手机上看不清，需整体放大。

完成后：门禁（npm test + npm run smoke）→ 构建上传微信体验版 1.2.8 → 更新 README 版本记录 → mp 后台切体验版。历史挂起：1.2.7 上传核验（顺带在后台确认）、GitHub 私有仓库推送（gh 未登录，需用户设备码，本次不做）。

## 关键现状（探查结论）

- 红点绘制：[draw.js](d:\Projects\record\trae_project\game_demo\src\render\draw.js) `eventOrb` L347-353，`badge>0` 时画圆 + `text(String(badge))` 数字。
- 首页角标语义：[home.js](d:\Projects\record\trae_project\game_demo\src\screens\home.js) L479-493，badge = 剩余关卡数（weeklyLeft/dailyLeft）。
- 周常积分：`CONFIG.weekly.points = 1600`（[config.js](d:\Projects\record\trae_project\game_demo\src\data\config.js) L278）；`emptyWeekly` 直接发满；`draftCapPower(state)` 固定用 1600 做贪心预算；`weeklyLevelDef` 目标战力 = cap × tierMult[t] × (1+0.02×(s-1))。
- 第 11 关 bug：[battle.js](d:\Projects\record\trae_project\game_demo\src\screens\battle.js) L567-569。
- 成就页签：[achievements.js](d:\Projects\record\trae_project\game_demo\src\screens\achievements.js) L18 `tabs: { y:136, h:54, x0:27, w:132, gap:9 }`，`onDown` L56-63 用同一 layout 算热区（改 layout 即可）。
- 每日卡片：[dailyChallenge.js](d:\Projects\record\trae_project\game_demo\src\screens\dailyChallenge.js) L140-187 画英雄 aura+模型+将名+血量倍率+锚点；COLS=5、CARD 128×150。
- 周常关卡卡：[weekly.js](d:\Projects\record\trae_project\game_demo\src\screens\weekly.js) `STAGE_CARD 128×150`、5 列 2 行、下方「本档情报」面板 y 由 `y0 + 2*(h+gapY)+10` 推出（改行数要同步）。
- 存档白名单：[save.js](d:\Projects\record\trae_project\game_demo\src\core\save.js) `sanitizeWeekly`（L291，points clamp 到 `CONFIG.weekly.points`）、`sanitizeDailyChallenge`（L281）。
- 受影响测试/冒烟：`tools/test.mjs` L4936-4970（draftCapPower/weeklyLevelDef 目标战力公式断言）、L4996-5010（首通奖励）、L5217-5229（周常手势）；`tools/smoke.mjs` L3484（`points === 1600`）、L3490-3494（连买 3 张）、L3487（WEEKLY_LAYOUT.tabs[1]）。

## 实施步骤

### 1. 红点：纯色呼吸 + 点进即消（按周期重显）

- **[draw.js](d:\Projects\record\trae_project\game_demo\src\render\draw.js) `eventOrb`**：badge 块改为纯色呼吸圆点——半径 `radius*0.30*(1+0.12*sin(t*3.2))`、alpha `0.72+0.28*…`，保留白描边与红光晕，**删掉 `text(String(badge))` 数字行**；`badge` 语义变为布尔（0/1），home 传 `badge: unread ? 1 : 0`。
- **新增周期未读判断**（可测的纯函数）：
  - [core/weekly.js](d:\Projects\record\trae_project\game_demo\src\core\weekly.js)：`weeklyOrbUnread(state, now)` = `weeklyUnlocked(state)` 且（`state.weekly` 不存在 / `key !== weekKey(now)` / `!state.weekly.seen`）。不依赖 ensureWeekly 先跑，跨周判定自洽。
  - [data/dailyChallenge.js](d:\Projects\record\trae_project\game_demo\src\data\dailyChallenge.js)：`dailyChallengeOrbUnread(state, now)` = `dailyUnlocked(state)` 且 `state.dailyChallenge?.seenDay !== dateKey(now)`（每日 0 点重显）。
- **点进置已读**：[home.js](d:\Projects\record\trae_project\game_demo\src\screens\home.js) `openWeekly()` 里 `ensureWeekly` 后置 `st.weekly.seen = true` 并 `g.save()`（仅当值变化）；`openDailyChallenge()` 置 `st.dailyChallenge.seenDay = dateKey(now)` 并 save。`draw()` 中圆钮 badge 改传上述 unread（删掉 weeklyLeft/dailyLeft 计算与不再使用的 import）。
- **存档白名单**：`sanitizeWeekly` 增 `seen: raw.seen === true`；`sanitizeDailyChallenge` 增 `seenDay: typeof raw.seenDay === 'string' ? raw.seenDay : ''`；`emptyWeekly` 增 `seen: false`。
- 语义说明：进入面板即视为已读 → 下次回首页不显示；每周一 / 每日 0 点重置重显（与「每周/每日」命名一致）。成就按钮的可领红点（无数字）不动。

### 2. 成就分类栏：6 个页签全部放进屏内

- [achievements.js](d:\Projects\record\trae_project\game_demo\src\screens\achievements.js) `ACHIEVEMENT_LAYOUT.tabs` → `{ y: 136, h: 56, x0: 24, w: 110, gap: 8 }`：6×110+5×8 = 700，右缘 724 ≤ 750，「经济」不再被裁。`onDown`/`draw` 都读同一 layout，热区自动跟随；字号 19/13 在 110 宽内放得下（「全 部」约 45px）。
- 无需滚动逻辑——全部可见即修复（用户说的「无法拖动滚动」是想拖被裁的页签）。补一条测试：最后一个页签右缘 ≤ 750。

### 3. 周常积分重设计：开局少 → 每通一档递增发放 + 难度飙升

**数值（CONFIG.weekly，[config.js](d:\Projects\record\trae_project\game_demo\src\data\config.js)）**：

```js
points: 1600,                 // 保留为「全周可获积分总额」口径（= ΣtierGrants），文案/上限用
startPoints: 320,             // 周初起始积分：贪心满编只够零星传奇，主力靠低稀有
tierGrants: [240, 280, 320, 360, 400],  // 每通一档大关发放（逐档递增，Σ=1600）
tierMult: [0.90, 1.15, 1.38, 1.62, 1.90],   // 难度飙升：0.90 → 1.90（原 0.90 → 1.68）
stageGrowth: 0.03,            // 档内每小关 +3%（原 +2%）
```

- 各档开战预算（决定敌方锚点）：`budget(t) = startPoints + Σ_{i<t} tierGrants[i]` → 档 1~5 = 320 / 560 / 840 / 1160 / 1520。敌我纯兵比 = tierMult[t]，第 1 档 0.90 倍可打、第 5 档要 1.90 倍练度补差——绝对战力随预算 320→1520 飙升，相对门槛随 tierMult 飙升。
- **[data/weekly.js](d:\Projects\record\trae_project\game_demo\src\data\weekly.js) 新增纯函数**（供 core/屏幕/测试共用）：`weeklyStartPoints()`、`weeklyTierGrant(tier)`、`weeklyBudgetForTier(tier)`、`weeklyTotalPoints()`（start + Σgrants = 1920）。
- **[core/weekly.js](d:\Projects\record\trae_project\game_demo\src\core\weekly.js)**：
  - `emptyWeekly`：`points: weeklyStartPoints()`，增 `granted: 0`（5 位掩码）。
  - `ensureWeekly` 结构护栏：`s.points` 上限改 `weeklyTotalPoints()`；`granted` 掩码补齐；**迁移回填**——任一档已通完但掩码位未置 → 补发该档积分并置位（老存档本周已通的档补发一次，幂等）。
  - `draftCapPower(state, budget = weeklyTotalPoints())`：预算参数化（档位锚点用 `weeklyBudgetForTier(t)`，草稿页展示用当前档预算）。
  - `weeklyLevelDef`：`cap = draftCapPower(state, weeklyBudgetForTier(t))`，target 公式其余不变；desc 文案同步。
  - `recordWeeklyClear`：`st === stagesPerTier` 时 `s.points += grant`、置掩码位、`out.tierPoints = grant`。
  - 新增 `weeklyNextStage(state, tier, stage)`（供结算页与测试）：`stage < stagesPerTier → [tier, stage+1]`；否则 `tier < tiers → [tier+1, 1]`；否则 `null`。**顺带修掉第 5 档后推出「第 6 档」的潜在 bug**。
- **[battle.js](d:\Projects\record\trae_project\game_demo\src\screens\battle.js) 周常结算**（L567）：nextStage 改调 `weeklyNextStage`；`rewardLines` 在 `rec.tierDone` 时追加 `档位通关积分 +${rec.tierPoints}`；infoLines `剩余积分 X / 1600` → `剩余积分 X · 下档通关 +Y`（用 `weeklyTierGrant`）。
- **[weekly.js 屏幕](d:\Projects\record\trae_project\game_demo\src\screens\weekly.js)**：状态行 `积分 X / 1920`（`weeklyTotalPoints()`）+ `下档 +Y`；草稿页头部「纯兵理论上限」改用 `draftCapPower(st, weeklyBudgetForTier(s.tier))`；`drawInfo` 文案改为新发放规则（开局 320、每通一档 +240~400、敌我比 = tierMult）。
- **[save.js](d:\Projects\record\trae_project\game_demo\src\core\save.js)**：`sanitizeWeekly` points 上限 → `weeklyTotalPoints()`；增 `granted` 掩码清洗、`seen`（见步骤 1）。

### 4. 每日挑战卡片：去英雄模型，只留关卡号 + 战力；周常/每日卡片与按钮放大

**每日卡片（[dailyChallenge.js](d:\Projects\record\trae_project\game_demo\src\screens\dailyChallenge.js)）**：
- 删除 `drawHeroFigure/drawHeroAura/heroAuraColor/heroById/dailyHeroes` 相关绘制与 import。
- 布局改 4 列大卡：`COLS=4, CARD_W=168, CARD_H=164, GAP_X=10, GAP_Y=12, X0=24, Y0=210`（4×168+3×10=702 正好；30 关 8 行，滚动照旧）。
- 卡面内容：`第 N 关`（18px）+ 右上状态（已通关/可挑战/未解锁，14px）+ **战力大数字**（`formatPower(dailyBattlePower(stage))`，24px 居中）+ 底部一行小字（13px：可挑战→`首通 X 钱 · Y 箱`；已通关→`已通关`；未解锁→`需通关第 N-1 关`）。`dailyBattlePower` 加可选参 `def` 复用本帧已算好的 `dailyBattleDef(stage)`，避免每卡双重建阵。

**周常关卡卡（[weekly.js](d:\Projects\record\trae_project\game_demo\src\screens\weekly.js)）**：
- `STAGE_CARD` → `{ w:168, h:164, gapX:10, gapY:12, x0:24, y0:318 }`，`stageRect` 改 4 列（`col = i%4, row = floor(i/4)`），3 行（4+4+2）止于 y=834。
- 「本档情报」面板 y 改 `y0 + 3*(h+gapY) + 6 = 852`、h 236 → 底 1088 < 1190，屏内放得下。
- 卡内字号整体 +3~7：关名 14→18、状态 12→14、敌战力 17→24、你的上限 12→14、奖励 11→13、出战/扫荡 16→20。
- 档位页签 `tier: { h:54→58, size:23→25 }`、页签 `tabs` 高 56→60、字号 26→28（微调，保证「做大些」）。

### 5. 测试与冒烟同步（tools/test.mjs、tools/smoke.mjs）

- `weeklyLevelDef` 目标战力断言（L4954-4967）：cap 改按档预算 `draftCapPower(st3, weeklyBudgetForTier(t))`，stageGrowth 读 `CONFIG.weekly.stagesGrowth` 新值 0.03，tierMult 读 config。
- `draftCapPower`（L4936）：默认参数改 `weeklyTotalPoints()`，断言不变；新增按档预算单调递增断言。
- `recordWeeklyClear` 档位完成（L4996 附近）：新增 `out.tierPoints === weeklyTierGrant(t)` 且 `points` 相应增加。
- `weeklyNextStage` 新测：1-10 通完 → `[2,1]`；5-10 通完 → `null`；1-5 通完 → `[1,6]`（**第 11 关回归**）。
- 存档往返：`seen`/`granted`/`seenDay` 保留；sanitize 上限 1920。
- 页签布局：`TA.x0 + 5*(TA.w+TA.gap) + TA.w <= 750`。
- 源码断言（沿用 L4457 风格）：`dailyChallenge.js` 不含 `drawHeroFigure`；`draw.js` badge 块不含 `String(badge)`。
- 红点：`weeklyOrbUnread`/`dailyChallengeOrbUnread` 真值表（未解锁 false、seen false→true、跨周/跨天重显）。
- smoke：L3484 `points === 1600` → `=== CONFIG.weekly.startPoints`；L3490 连买 3 张在 320 分下仍成立（最便宜 16×3=48）；截图 200 张自动重生成。

### 6. 门禁与发版 1.2.8

1. `npm test`（1598+ 断言）与 `npm run smoke`（90 断言 / 200 截图）全绿。
2. 发版：`$env:WX_APPID='wxa3c15f63d6e349d6'; $env:WX_VERSION='1.2.8'; $env:WX_UPLOAD='1'; $env:WX_DESC='红点改呼吸角标；成就页签全显示；周常积分按档发放+难度飙升；修周常第11关；每日挑战卡片简化放大'; npm run wx:release`。加固接口若 ECONNRESET，用已成功加固的 zip 恢复 `dist/fortify` 后直接 `cli.bat upload --project`（1.2.7 成功路径）。
3. 核验：WeappLog 出现 `progressSuccess`；顺带确认 1.2.7 是否也在开发版本列表（补历史核验）。
4. 更新 [README.md](d:\Projects\record\trae_project\game_demo\README.md) L376 版本记录 → 「当前已上传版本：1.2.8」，写明本次六项改动与门禁数据。
5. mp 后台（浏览器自动化）把开发版本 1.2.8 设为体验版。

### 不在本次范围

- GitHub 私有仓库推送：`gh` 仍需用户设备码登录，保持挂起（等用户授权后再做）。
- `docs/` 宣传图与 `tools/make_promo*.py`（用户未跟踪文件）不动。

## 验证

1. `npm test` 全绿（含新增：weeklyNextStage 回归、积分发放、页签宽度、unread 真值表、源码断言）。
2. `npm run smoke` 全绿并产出 200 张截图；目检 `64_home_125_unlocked`（红点无数字）、`65a_weekly_stages`（4 列大卡 + 新积分状态行）、`66_daily_challenge`（无英雄模型、战力大数字、4 列大卡）、`67a_achievements_claimable`（6 页签完整显示）。
3. 手动路径（smoke 已覆盖交互）：首页点每周圆钮 → 回首页红点消失；`weeklyNextStage` 单测覆盖第 10 关后不再出现第 11 关。
4. 上传后 WeappLog `progressSuccess` + mp 后台开发版本出现 1.2.8 → 切体验版。
