---
name: asset-spec
description: "为单个兵种/武将/界面/特效/背景写资产规格与 AI 出图 prompt：尺寸、格式、命名、包体预算、视觉描述、生成 prompt 与负向 prompt。触发词：资产规格、出图 prompt、画画提示词、兵种立绘、精灵表规格、美术资产清单、这个资产怎么做。只产规格文本，不调图像接口。"
---

# 资产规格与出图 Prompt（asset-spec）

来源：改写自 Donchitos/Claude-Code-Game-Studios v1.2.0 的 `asset-spec`（MIT，见 `.trae/skills/LICENSE-claude-code-game-studios.txt`）。**只保留"资产规格 + AI 出图 prompt"部分**；原版的 GDD 依赖编排、art-bible 前置闸门、art-director / technical-artist 子代理、asset-manifest 流程已移除。

## 用途

给一个明确目标（某个兵种 / 武将 / 界面 / 特效 / 背景）产出可直接执行的资产规格与出图 prompt。

**输出**：`docs/design/assets/specs/[目标名]-assets.md`（中文文件名用拼音或 id）。
**只写文本**：不调用任何图像接口，不生成图片文件。

---

## 第 1 步：先收集，再动笔

读以下内容（缺哪项就跳过并说明）：

| 内容 | 位置 |
|---|---|
| 兵种/精英的识别点与配色 | `src/data/config.js` → `CONFIG.troops[]`（`id/name/hue/role/tiers`）、`SPECIAL_TROOPS`（`style/palette/role`） |
| 精灵帧尺寸、动作、行列 | `src/render/sprites.js`（`FRAME_W`/`FRAME_H`/`COLS`/`ACTIONS`）、`assets/sprites/atlas.json` |
| 包体现状 | `dist/` 或 `wechat/` 构建产物；`assets/sprites` 各 PNG 体积 |
| 美术与数值意图 | `docs/troop-balance.md`、`docs/playtest-report.md` 中相关段落 |
| 既有资产 | `assets/sprites/`、`docs/preview/`（已有预览图） |

**包体红线（本项目硬约束）**：主包上限 4 MB，当前约 3.9 MB。任何新增 PNG 规格都必须回答"它占多少 KB、从哪省回来"。优先程序化绘制（`procedural: true`）而不是导出 PNG；参考 `tools/gen-sprites.mjs` 的取舍：普通兵种导出 40 张、特殊兵种只出预览图。

---

## 第 2 步：识别资产

从目标中提取**显式与隐含**资产：
- 兵种：精灵表（idle/attack/hit/death）、头像/立绘、兵种图标、等级外观差异（`tiers` 10 档）、克制提示图标
- 武将：立绘、半身像、技能图标、登场特效
- 界面：HUD、按钮、面板底图、字体（若自定义）
- 特效：命中、暴击、克制、升级、宝箱开启
- 背景：章节战场主题（`CONFIG.battleThemes`）、地图

按类别分组后，先把清单贴给用户确认，**确认前不写规格**。用户可以删项、补项、调整分类。

---

## 第 3 步：写规格

每个资产一个块：

```markdown
## ASSET-[NNN] — [资产名]

| 字段 | 值 |
|------|-----|
| 类别 | [精灵/立绘/图标/特效/背景/UI] |
| 尺寸 | [如 96×96px，4 帧横排；或"以 FRAME_W/H 为准"] |
| 格式 | PNG-8 / PNG-24 / SVG / 运行时程序化 |
| 体积预算 | [≤ KB；并说明省回来的来源] |
| 命名 | [如 sprite_shield_lv03.png，与 atlas.json 键一致] |
| 锚点/留白 | [脚底对齐基线；四边 4px 透明边距] |

**视觉描述：**
[2~3 句，具体到两个美术也能画出同一个东西：体型、甲片层数、武器形状、识别点位置、配色角色。]

**识别点（必须保留）：**
- [如"青州兵：背后铺盖卷 + 麻绳腰带"；"先登死士：窄长黑盾 + 红竖线"]

**生成 Prompt：**
[见下方规范]

**负向 Prompt：**
[见下方规范]

**状态**：Needed
```

---

## 第 4 步：出图 Prompt 规范

Prompt 用英文写（模型更稳），规格正文仍用中文。结构固定为五段：

1. **主体与构图**：`single [unit type] soldier, full body, 3/4 front view, centered, standing on ground line`
2. **风格关键词**：本项目是汉末三国 + 2D 游戏资产。基础串：`2D game sprite, clean silhouette, semi-realistic Chinese ink-and-wash influence, han dynasty militia, muted earthy palette`
3. **配色锚点**：从 `palette`/`hue` 取，例如盾兵 `hue 205` → `cold blue-grey armor`；弓兵 `hue 35` → `warm ochre leather`；骑兵 `hue 352` → `deep crimson accents`。**同一兵种线必须用同一组色**，只让等级改变配件。
4. **等级差异**：显式写出该档配件，如 `Lv1 plain cloth tunic, no armor` / `Lv5 leather shoulder guard` / `Lv10 riveted iron lamellar, veteran beard`。
5. **技术约束**：`flat transparent background, no text, no watermark, orthographic, consistent scale, pixel-clean edges`（若走像素风再加 `pixel art, 1px outline, limited 24-color palette`）。

**负向 Prompt（默认串，按需增删）**：
`photorealistic, 3d render, blurry, jpeg artifacts, extra limbs, extra weapons, text, watermark, signature, background scenery, cast shadow on ground, inconsistent proportions, western medieval armor, samurai, anime face`

**一致性技巧**：同一批资产先出 1 张定色定比例，后续 prompt 里加 `same style as reference, same palette, same proportions`；不要把 10 个等级分别写成 10 种风格。

**禁止**：不要在 prompt 里塞具体 UI 文案（模型会画出错别字）；不要在 prompt 里要求"精确 96×96"（用尺寸参数或后期缩放，不靠 prompt）。

---

## 第 5 步：落盘

确认后写入 `docs/design/assets/specs/[目标名]-assets.md`，头部：

```markdown
# 资产规格 — [目标类型]：[目标名]

> 来源数据：src/data/config.js（[具体字段]）
> 帧规格：src/render/sprites.js（FRAME_W×FRAME_H，COLS，ACTIONS）
> 生成日期：[YYYY-MM-DD]
> 包体预算：新增合计 [X] KB / 主包余量 [4MB − 当前体积]
```

同名文件已存在时**就地更新**，保留已有 `ASSET-NNN` 编号，只追加/修改本次批准的内容。

---

## 边界

- 不调用图像生成接口，不写 PNG/SVG 文件，不改进 `tools/gen-sprites.mjs`。
- 不写音频的生成 prompt（音频只能写"音色/时长/触发点"的描述性规格）。
- 任何会让主包超过 4 MB 的规格必须先标红并给替代方案。
