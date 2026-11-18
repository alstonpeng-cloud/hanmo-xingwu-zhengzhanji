---
name: balance-check
description: "检查《汉末行伍征战记》的数值平衡：战斗/经济/成长/掉落四域的离群值、断裂成长曲线、退化解法与无限资源循环。触发词：查平衡、数值平衡、平衡检查、兵种强度、经济通胀、掉落概率、成长曲线。数据缺失时输出 NOT ASSESSED 而不是编造结论。"
---

# 数值平衡检查（balance-check）

来源：改写自 Donchitos/Claude-Code-Game-Studios v1.2.0 的 `balance-check`（MIT，见 `.trae/skills/LICENSE-claude-code-game-studios.txt`）。原版面向 Godot/Unity/Unreal + `assets/data/` 目录，本版已改为本仓库的真实数据结构，并移除了 Claude Code 专属机制（斜杠命令执行、AskUserQuestion、yaml-helper、subagent）。

## 使用方式

直接说"跑一次平衡检查"或"查一下盾兵/骑兵强度、经济、掉率"，也可指定目标：`balance-check 战斗`、`balance-check 经济`、`balance-check src/data/config.js`。

**只读分析。** 默认不改任何文件；只有在用户明确同意后才写报告或改数值。

---

## 输入核对（先做，做不成就不出报告）

**缺数据的正确答案是"跑不了"，不是填一份空报告。**

1. 按目标列出需要读的文件（见下方"数据源映射"）。
2. 逐个标记 `FOUND` / `ABSENT`，不许写"假设存在"。
3. 某个小节所需的输入 ABSENT，该小节写 **`NOT ASSESSED — NO DATA`**，并说明缺什么、该由谁产出。不要用相邻数据推测，不要把空格留给读者去猜。
4. 如果全部必需输入都 ABSENT，整个结论就是 **`NOT ASSESSED — NO DATA`**，直接停止。

**没有证据 ≠ 没有问题。** 扫描不到匹配项，要说清是"确实没有"还是"根本没东西可扫"——读者无法从绿色的结论里区分这两种情况。

### 数据源映射（本仓库真实路径）

| 需要的输入 | 本仓库位置 | 说明 |
|---|---|---|
| 兵种基础属性/成长 | `src/data/config.js` → `CONFIG.troops`（4 基础兵种，`base`/`growth`/`tiers`） | 数值唯一真源 |
| 特殊兵种 | `src/data/config.js` → `SPECIAL_TROOPS`（`statMult`/`squad`/`rarity`） | 注意 `statMult` 与 `squad` 的叠加效应 |
| 克制关系 | `src/data/config.js` → `CONFIG.counters` | 克制 ×1.1 / 被克制 ×0.9 |
| 战斗节奏 | `src/data/config.js` → `CONFIG.combat.intervals`、`src/data/traits.js` | 攻速、战法倍率、连射、毒伤 |
| 战力折算公式 | `src/core/power.js` `troopPower()`：`squadHp + (dps+poisonDps)*3 + squadDef*2` | 判定"强度"的统一口径，必须用它 |
| 属性派生 | `src/core/units.js` `statsFor()`、`src/core/arena.js` `squadSoldierCount()` | 等级/小队人数如何影响属性 |
| 关卡与难度曲线 | `src/data/config.js` → `CONFIG.levelGen`（`levelAnchors`/`enemiesBase`/`enemiesPerLevel`/`enemiesMax`）、`src/core/levels.js` `levelDef()` | 敌方战力随关卡的曲线 |
| 经济 | `src/data/config.js` → `CONFIG.economy`、`CONFIG.shop`、`CONFIG.chests`、`CONFIG.dailyShop`、`CONFIG.tasks`/`CONFIG.signIn` | 金币产出/消耗、商城、宝箱、每日 |
| 既有平衡文档 | `docs/troop-balance.md`（兵种数值与调整记录）、`docs/playtest-report.md` | 目标值/历史意图的来源 |
| 现成探针脚本 | `tools/power-curve.mjs`、`tools/troop-table.mjs`、`tools/sim.mjs`、`tools/duel.mjs` | 优先复用，不要另造一套口径 |

**目标值的来源优先级**：`docs/troop-balance.md` 里写明的设计区间/锚点 > `docs/playtest-report.md` 的实测结论 > `src/data/config.js` 注释里声明的设计意图（例如"战力基本持平"）。三者都没有的数值，标记 `no stated range — not judged`，不硬判。

---

## 第 1 步：确定分析域

- **战斗** — 四个兵种线在各等级的 DPS / 有效血量 / 战力、克制环是否形成支配解、"纯抗线"是否不可击杀
- **经济** — 金币等资源的水龙头与水池、产出/消耗比、是否存在无限循环、商城是否存在"永远不值得买"的项
- **成长** — 1→10 级的属性/战力曲线、章节锚点曲线（`levelAnchors`）、死区与突变
- **掉落** — 宝箱概率、保底、稀有度分布、期望获取时间
- **关卡** — 敌方战力曲线 vs 玩家可达战力，是否出现"战力够也打不过"或"一路平推"

无参数时问用户查哪个域；给了文件路径就直接读文件并按内容推断。

---

## 第 2 步：读数据

按上方映射读文件，**记下每个读过的文件**（要写进报告的 Data Sources）。读 `config.js` 这种大文件时用 Grep 定位段落后再按行段读取，不要整文件硬读。

---

## 第 3 步：读目标/设计意图

读 `docs/troop-balance.md` 对应章节，拿到"设计上应该是什么样"。这是判断"离群"的基线。

若数据 FOUND 但目标缺失：`Outliers Detected` 与 `Progression Analysis` 写 `NOT ASSESSED — NO DATA`，并注明缺的是哪一段设计意图。

---

## 第 4 步：执行分析

**通用规则：每个数值都和它的目标比。** 目标来自设计文档/注释；超出即离群。没有目标的数值单独列进"需要关注"，标 `no stated range — not judged`。

**战斗**
- 用 `troopPower()` 口径算四个兵种 Lv1~Lv10 的战力，而不是只看 `base` 三项裸值
- 算等效 DPS = `atk * (1+atk增长)^(lv-1) / interval * 小队人数`，以及等效血量 = `hp * soldiers`
- 时间到击杀（TTK）在同一等级内是否出现跨数量级差异
- 是否存在严格更优选项（某兵种在所有场景都更强）
- 克制环：`counters` 是否闭合、是否出现"克制方反而打不过"
- 防御型是否形成不可击杀（`def >= atk` 导致伤害被压到 `max(1, ...)` 下限）

**经济**
- 列出全部产出（关卡奖励、挂机宝箱、任务、签到、广告）与全部消耗（合成、招募、商城、抽取）
- 按"每小时/每关卡"折算净流，判断通胀或紧缩
- 找无限循环（可重复兑换、免费刷新、无上限产出）
- 水池是否随产出同步放大
- 找出"永远不值得买"的商品（性价比低于等价金币产出）

**成长**
- 画出/列出 1→10 级属性与战力曲线，算 1→10 的倍率
- 找死区（长时间无有效提升）与突变（单级跳变过大，例如 >1.5×）
- 用 `levelAnchors` 对齐"关卡 N 的敌人等级"与"玩家该有的等级/战力"
- 检查跳关/刷级策略是否破坏节奏

**掉落**
- 各稀有度期望获取次数/时间
- 保底数学是否正确（保底是否真的在 N 次内必出）
- 是否存在某阶段完全无用的掉落
- 库存/背包压力 vs 获取速度（本作是兵营 300 格，检查是否会长期爆仓）

**关卡**
- 跑 `node tools/power-curve.mjs` 拿敌方总战力曲线
- 与我方同关卡可达战力（等级锚点 × 小队人数 × 兵种）对比，标出比值异常段

---

## 第 5 步：输出报告

```
## Balance Check: [系统名]

### Data Sources Analyzed
- [每个读过的文件，含行号区间]

### Health Summary: [NOT ASSESSED / HEALTHY / CONCERNS / CRITICAL ISSUES]

### Outliers Detected
| 数值/条目 | 期望范围 | 实际 | 问题 | 证据（文件:行） |

### Degenerate Strategies Found
- [支配解/无限循环，以及为什么是问题]

### Progression Analysis
[曲线表格或分段说明：1→10 级倍率、章节锚点、死区/突变]

### Recommendations
| 优先级 | 问题 | 建议改法 | 影响面 |

### Values That Need Attention
[无目标值或需要人工确认的具体数值]
```

**Health Summary 取最严重的一条，先匹配先赢：**
- **CRITICAL ISSUES** — 存在支配解（一个选择压倒所有替代）、成长卡死/无法通关、无水池的经济循环
- **CONCERNS** — 离群或曲线问题，一轮调参可修，且没有上述致命项
- **NOT ASSESSED** — 无数据、需要目标值的小节缺目标、或数值没有可比范围。它排在两个"发现问题"的结论之下、`HEALTHY` 之上
- **HEALTHY** — 每个数值都有目标且都在范围内，无离群、无支配解、成长在目标内

**硬性要求**：结论里出现的每个数字都必须能追溯到文件与行号；不许出现"大致""应该差不多"；没算的部分明确写未评估。

---

## 第 6 步：修复与复验

报告后给出三个选项（用普通文字提问，等用户回答）：
- `[A] 现在就修最高优先级问题`
- `[B] 保存报告到 docs/balance/balance-check-[系统]-[YYYY-MM-DD].md`
- `[C] 先停，自己看结论`

选 A：按 Recommendations 的优先级逐条改，**每次改完重跑对应检查**，确认没有引入新离群；改动只在 `src/data/config.js`（或对应数据文件）里做，不要改 `src/core/*` 的公式来"凑"结果。
选 B：写到 `docs/balance/`（目录不存在就建），写完确认文件已落盘，结尾提示"修完再跑一次 /balance-check 复验"。
选 C：汇总未解决项，同样以"修完再跑一次复验"结尾。

---

## 边界

- 本技能不做美术、不做性能、不改代码结构。
- 不把"没有目标值"当成"健康"。
- 不在未获批准时修改 `src/data/config.js`。
