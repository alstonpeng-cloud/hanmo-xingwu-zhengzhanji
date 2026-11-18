---
name: sprite-sheet-qa
description: "验收替换进 assets/sprites 的精灵表：网格 96×96 / 4 列 4 行、每动作帧数、脚底基线、透明边裁切、atlas.json 一致性与 4MB 包体预算。触发词：换真实美术、精灵表检查、精灵表验收、帧对齐、脚底基线、出图验收、包体预算。只验收，不改渲染代码。"
---

# 精灵表验收（sprite-sheet-qa）

来源：改写自 scenario-labs/skills 的 `scenario-sprite-animation` 与 `scenario-game-assets`（MIT，Copyright (c) 2026 Scenario Inc.，见 `.trae/skills/LICENSE-scenario-labs-skills.txt`）。本版删除了 Scenario MCP 调用链（`recommend` / `model_schema_get` / `model_run` / `jobs_wait` / `upload_asset`）、计费与 dry-run、视频抽帧 lane、Unity/Godot/Unreal 导出、像素风专用流程；只保留可测量的验收规则，路径与命令换成本仓库真实位置。

## 用途

把程序化占位精灵表换成真实立绘、或新增兵种档位之后，用可测量证据验收能否直接替换，而不是靠肉眼。

**只读验收。** 除用户明确要求外，不改 `src/render/sprites.js`，不重新生成 PNG。

## 不适用

- 写资产规格与出图 prompt → 用 `asset-spec`
- 改数值或平衡 → 用 `balance-check`
- 调用图像/视频接口、训练模型 → 本技能不涉及

## 先读真实规格（禁止硬编码）

| 项 | 位置 |
|---|---|
| 帧宽 / 帧高 / 列数 / 动作行 | `src/render/sprites.js` → `FRAME_W`、`FRAME_H`、`COLS`、`ACTIONS` |
| 脚底锚点 | `src/render/sprites.js` → `FEET_Y`（当前 86） |
| 每动作帧数 | `src/data/config.js` → `CONFIG.troops[].anim`；渲染取 `Math.max(1, troop.anim[action] 或 2)` |
| 真实美术加载规则 | `src/render/sprites.js` → `loadCustomSheet()`：只读 `assets/sprites/<troopId>_<tier>.png` |
| 特殊兵种 | `procedural: true` 的兵种不落盘，只验收运行时生成表 |
| 图集索引 | `assets/sprites/atlas.json` |
| 现有检查 | `tools/check-bounds.mjs`（只查贴边裁切） |

规格以代码为准；`atlas.json` 与代码常量不一致时，先报告冲突，不要二选一。

## 验收步骤

### 1. 网格与命名

- 单帧 `FRAME_W × FRAME_H`，整表 `FRAME_W*COLS × FRAME_H*ACTIONS.length`
- 文件名 `<troopId>_<tier>.png`，`tier` 从 1 开始，与 `CONFIG.troops[].tiers` 档位一致
- 必须是带 alpha 的 PNG；不接受 JPG 替换（无 alpha，运行时会露出白底）

### 2. 裁切（先跑脚本，再做人工项）

```
node tools/check-bounds.mjs
```

退出码 0 = 无贴边；1 = 有帧贴边。贴边即视为立绘被裁切，必须重出，不要靠缩小渲染比例掩盖。

### 3. 脚底基线（本技能核心项）

`drawFrame()` 把图内 `FEET_Y` 当作脚底原点。判定：

- 替换的真实美术：idle / attack / hit 每帧不透明像素 bbox 底边落在 `FEET_Y ± 3`
- 同一动作相邻帧 bbox 底边漂移 ≤ 2px（跑动、攻击不许整只上下跳）
- death 行允许身体贴地，底边不超过 `FEET_Y + 4`，也不允许整体上浮
- 程序化生成表把地面阴影烘焙进图时，bbox 底边会略低于脚底：此时只判「同行帧间漂移」，不判绝对位置

测量用 alpha 通道（阈值与 `check-bounds.mjs` 一致，`a > 8`），不看缩略图。

### 4. 帧数

- 每行有效帧数 ≤ `COLS`；超出的帧 `currentFrame()` 永远播不到，等于白占包体
- `atlas.json` 的 `frames` 必须与实际切图帧数一致；动作缺帧时渲染回退到 2 帧，动作会卡顿
- 帧数 1 合法（静态待机），但 idle 建议 ≥2，否则战斗画面没有呼吸感

### 5. atlas.json 与文件一致

- 每个 `sheets[<name>].file` 指向的文件存在
- `sheets` 键集合 = `assets/sprites/*.png`（排除 `_preview_*.png`）集合，无孤儿、无缺失
- `frameWidth / frameHeight / cols / rows` 与代码常量一致
- 普通兵种为 4 条兵线 × 10 档 = 40 张；`procedural: true` 的特殊兵种不导出

### 6. 视觉一致性（人工，但给判据）

- 同一条兵线跨等级：比例、朝向、脚底一致，只换配件；不允许每档换画风
- 角色朝右（敌方由 `flip` 镜像）；朝向反了会背对冲锋
- 同线共用一组主色，等级只做材质与磨损差异
- 替换真实美术后地面阴影会消失（程序化表的 `drawShadow` 不作用于自定义 PNG）：确认是否接受，或另开需求补渲染层阴影

### 7. 包体预算

- 先测现状：`assets/sprites` 体积 + `npm run build:wx` 产物主包体积（以上传器显示为准）
- 红线 4 MB；新增预算 = 4 MB − 当前主包体积，并预留 ≥100 KB 余量
- 超预算时的取舍顺序：降单帧尺寸或帧数 → 只对高等级档位导出 PNG → 该兵种改回 `procedural: true` → 压缩 PNG（不得牺牲 alpha）

### 8. 回归

```
npm run sprites              # 仅在用户要求重新生成占位表时执行
node tools/check-bounds.mjs
npm test
node tools/smoke.mjs
```

`smoke.mjs` 退出码：0 通过 / 1 断言失败 / 2 启动或环境错误 / 124 超时。非 0 一律视为未通过，不要只贴日志尾部。

## 报告模板

```
## 精灵表验收：[兵种/档位范围]

### 规格来源
- FRAME_W×FRAME_H / COLS / ACTIONS / FEET_Y：[值，文件:行]
- 涉及文件：[清单，数量]

### 结果
| 检查项 | 结论 | 证据 |
|---|---|---|
| 网格与命名 | PASS/FAIL | |
| 贴边裁切 | PASS/FAIL | 命令退出码、帧坐标 |
| 脚底基线 | PASS/FAIL | bbox 底边范围、最大漂移 |
| 帧数 ≤ COLS | PASS/FAIL | |
| atlas 一致 | PASS/FAIL | 缺失/孤儿文件 |
| 朝向/比例/配色 | PASS/FAIL | |
| 包体预算 | PASS/FAIL | 当前主包 MB、新增 KB |

### 必须修
1. [问题] — [文件:帧坐标]

### 结论
[可替换 / 需重出 N 张 / NOT ASSESSED]
```

**NOT ASSESSED**：缺文件、读不到 `atlas.json`、或没有可对照的代码常量时使用，不填 PASS。

## 常见错误

- 用肉眼在缩略图上看「差不多」：缩到 0.4 倍后 3px 的基线漂移看不出来，必须量 bbox
- 只跑 `check-bounds.mjs` 就宣布通过：它只查贴边，不查基线、帧数、atlas 与包体
- 帧数超过 `COLS`：多出来的列永远不播，却实打实占包体
- 每档独立调色：换装看起来像换兵种，破坏「同一条兵线」的认知
- 用缩小渲染比例掩盖裁切：战斗中立绘会比同排小一圈
- 替换后忘记核对 `atlas.json`：文件在但索引不在，运行时会静默回退程序化表，看起来「改了没效果」

## 边界

- 不生成图片、不调外部接口、不改 `src/`、`tools/`、`wechat/`
- 不评估战斗数值（交给 `balance-check`）
- 发现渲染代码与新规格冲突时，先报告，等用户决定改规格还是改代码
