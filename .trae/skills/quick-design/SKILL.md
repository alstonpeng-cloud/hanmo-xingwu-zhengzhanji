---
name: quick-design
description: "轻量设计规格：给调数值、小行为改动、小机制新增写一份可直接实现的短规格，跳过完整 GDD。触发词：快速设计、改个数值、小改动规格、调平衡、加个小机制、写个 quick spec。超过一周工作量的改动会被拒绝并要求走完整设计流程。"
---

# 快速设计（quick-design）

来源：改写自 Donchitos/Claude-Code-Game-Studios v1.2.0 的 `quick-design`（MIT，见 `.trae/skills/LICENSE-claude-code-game-studios.txt`）。已移除斜杠命令链、AskUserQuestion、yaml-helper 与 GDD/故事流水线依赖，路径换成本仓库真实位置。

## 用途

改动小到不值得写完整设计文档、又大到不写清楚就会做错的场景。上限约"一个人一周内能实现完"。

**输出**：`docs/design/quick-specs/[kebab-case-标题]-[YYYY-MM-DD].md`

**不适用**：引入新系统且跨多个系统、超过一周、或改动现有系统的核心规则 → 停下来，改走完整设计（先写进 `docs/troop-balance.md` 的设计段，再实现）。

---

## 第 1 步：归类

读用户描述，判断属于哪一类：

- **Tuning（调数值）** — 只改数字，无行为变化。例："骑兵基础攻击 22 → 24"、"弓兵箭伤整体 ×0.5"。
- **Tweak（微调）** — 现有系统的小行为变化，不引入新状态/分支。例："盾兵被克制时不再额外掉 10%"。
- **Addition（新增）** — 给现有系统加一个小机制，可能引入 1~2 个新状态。例："枪兵对骑兵的克制系数从 1.1 提到 1.15，并加破甲提示"。
- **New Small System（小型新系统）** — 独立小功能，无既有文档，一周内可完成。例："战斗结算页的连击评级"。

把判断结果和理由用一句话说给用户，请其确认；如果用户选"太大了"，停止并建议走完整设计。

---

## 第 2 步：读上下文（先读再写）

- 相关设计记录：`docs/troop-balance.md`（兵种/数值设计意图与历史调整）、`docs/playtest-report.md`（实测结论）。用 Grep 定位标题再按行段读，不要整文件硬读。
- 数据落点：`src/data/config.js`（`CONFIG.troops` / `SPECIAL_TROOPS` / `counters` / `economy` / `chests` / `levelGen` …），必要时 `src/data/traits.js`。
- 派生逻辑（只在需要判断影响时读）：`src/core/power.js`、`src/core/units.js`、`src/core/levels.js`。
- 已有 quick spec：`docs/design/quick-specs/` 下是否改过同一系统——**即使一致也要点名**，否则"无冲突"和"没有旧规格"读起来一样。
- 测试落点：`tools/test.mjs`（`npm test`），冒烟 `node tools/smoke.mjs`。

汇报一句："参考了 [文件/章节]；同系统的旧 quick spec：[路径/无]，与本改动[一致/冲突/无]"。

---

## 第 3 步：起草规格

### Tuning（只改数值）

```markdown
# Quick Design Spec: [标题]

**Type**: Tuning
**System**: [系统名]
**参考设计**: docs/troop-balance.md — [章节]
**日期**: [YYYY-MM-DD]

## 改动

| 参数 | 旧值 | 新值 | 理由 |
|------|------|------|------|
| [参数] | [旧] | [新] | [为什么] |

## 与设计区间的关系

对应设计区间：[区间或"原文未写区间"]。
新值处于 [区间内 / 边界 / 区间外]。[区间外时说明为什么要扩区间。]

## 验收标准

- [ ] `src/data/config.js` 中 [参数] 读出来是 [新值]
- [ ] 在 [具体场景] 能看到行为差异
- [ ] [相关行为] 无回归
```

### Tweak / Addition

```markdown
# Quick Design Spec: [标题]

**Type**: [Tweak / Addition]
**System**: [系统名]
**参考设计**: docs/troop-balance.md — [章节]
**日期**: [YYYY-MM-DD]

## 改动摘要

[1~2 句：改什么、为什么。]

## 动机

[解决什么体验问题？引用实测/试玩反馈。]

## 设计增量

现状（引用 docs/troop-balance.md 原文）：

> [原文]

改为：

[用和设计文档同等精度写清楚新规则，程序员只看这段就能实现。]

## 新规则 / 新数值

[无歧义地写出替换内容；新状态要列全，新参数要给出取值范围。]

## 影响面

| 系统 | 影响 | 需要做什么 |
|------|------|-----------|
| [系统] | [如何被影响] | [改数据 / 改文档 / 不动] |

## 验收标准

- [ ] [可测的标准 1]
- [ ] [可测的标准 2]
- [ ] 无回归：[不能被破坏的原有行为]

## 是否需要更新设计文档？

[是 / 否]
[是：哪个文件、哪一节、改成什么。]
```

### New Small System

```markdown
# Quick Design Spec: [标题]

**Type**: New Small System
**范围**: [1~2 句：这个系统做什么、不做什么]
**日期**: [YYYY-MM-DD]
**预估工时**: [小时]

## 概述

[一段话讲清楚：做什么、什么时候触发、产出什么。]

## 核心规则

[编号列表写顺序行为，项目符号写条件。精确到不需要再问。]

## 可调参数

| 参数 | 默认 | 范围 | 类别 | 理由 |
|------|------|------|------|------|
| [名] | [值] | [min–max] | [手感/曲线/门槛] | [为什么] |

所有数值必须落在 `src/data/config.js`，不要在逻辑层硬编码。

## 验收标准

- [ ] 功能：做对的事
- [ ] 边界：异常输入/极端值不崩
- [ ] 体验：试玩能确认的手感目标
- [ ] 回归：不影响相邻系统
```

---

## 第 4 步：确认与落盘

把完整草稿贴给用户，问："按这个写？还是要改？还是太大了要转完整设计？"

确认后：
1. 建目录（如不存在）：`docs/design/quick-specs/`
2. 写入 `docs/design/quick-specs/[kebab-case-标题]-[YYYY-MM-DD].md`
3. 若规格里标了"需要更新设计文档"，**单独再问一次**，并展示原文 vs 新文；未获批准不得改 `docs/troop-balance.md`。

文件名示例：`cavalry-atk-tuning-2026-11-09.md`、`shield-counter-tweak-2026-11-09.md`。

---

## 第 5 步：交接

```
Quick Design Spec 已写入：docs/design/quick-specs/[文件名].md
类型：[Tuning / Tweak / Addition / New Small System]
系统：[系统名]
设计文档更新：[需要（待批准） / 已更新 / 不需要]

下一步：按验收标准实现 → 跑 npm test → 跑 node tools/smoke.mjs → 复跑 balance-check 确认没引入离群。
```

**quick-spec 有意跳过 `design-review` 全流程**——它是给低风险小改动用的，评审成本高于风险本身。

以下任一成立就转完整设计：
- 新系统需要进入系统清单/跨系统契约
- 明显改变跨系统行为
- 引入新的玩家可感知机制并影响整体手感平衡
- 实现预计超过一周

---

## 边界

- 不写完整 GDD，不建系统清单，不生成故事/任务台账。
- 不覆盖已有 quick spec；同名文件存在就更新并说明改了什么。
- 不在未获批准时改 `docs/troop-balance.md`。
