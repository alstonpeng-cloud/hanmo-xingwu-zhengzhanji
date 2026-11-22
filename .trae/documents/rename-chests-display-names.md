# 宝箱改名：小木箱 / 白银宝箱 / 黄金宝箱

## Context

用户要求更改箱子显示名：**wood=小木箱（已同名，不动）、silver 银箱→白银宝箱、gold 金箱→黄金宝箱**。宝箱 id（`wood/silver/gold`）、掉落表、存档数据全部不变，只改玩家可见的显示字符串。稀有/史诗/传奇箱不在本次范围。

现状：显示名有**两类来源**——① `CONFIG.chests.types[id].name`（`core/chests.js chestType()` 读取，多数界面自动生效）；② 4 处硬编码 label map + 若干帮助文案，需手工同步。`tools/` 中对旧名只有**断言描述文字**（不影响结果），无 `=== '银箱'` 类值断言。

## 改动

### 1. 定义源（自动生效：chests 页、结算页分享按钮/toast、商城、签到、演武结算、首页挂机箱等）

- `src/data/config.js`
  - L1076 `name: '银箱'` → `name: '白银宝箱'`
  - L1089 `name: '金箱'` → `name: '黄金宝箱'`
  - L923 广告遗留 offer `name: '银箱 ×1'` → `name: '白银宝箱 ×1'`（core 保留，无 UI，仅顺手一致）
  - 注释不改（开发侧措辞，非玩家可见）

### 2. 硬编码 label map（4 处）

- `src/data/achievements.js` L15：`silver: '银箱', gold: '金箱'` → `白银宝箱 / 黄金宝箱`
- `src/screens/battle.js` L94 `CHEST_LABELS`
- `src/screens/dailyChallenge.js` L215 `CHEST_NAMES`
- `src/screens/weekly.js` L51 `CHEST_NAMES`

### 3. 玩家可见帮助/结算文案

- `src/screens/chests.js` L120-121：「每 5 关 1 银箱…加银箱，50 关加金箱」→ 白银宝箱 / 黄金宝箱
- `src/screens/levels.js` L318-319：同上两行
- `src/screens/dailyChallenge.js` L207：「发木箱 / 银箱 / 稀有箱」→「发小木箱 / 白银宝箱 / 稀有箱」
- `src/screens/weekly.js` L566：「第 5 关银箱」→「第 5 关白银宝箱」
- `src/screens/result.js` L771：「（兵营满，折算金箱）」→「（兵营满，折算黄金宝箱）」

### 4. 文档同步（仅当前态描述，历史 changelog 不动）

- `README.md` L198 配置表行：「每 20 关银箱 / 每 50 关金箱…每 5 关银箱 / 每 20 关金箱」→ 新名；其余历史条目（如 1.2.9 移除的「银箱 ×2」广告按钮）保留原样。

### 不改

- id、存档、掉落表、`levelChests` 逻辑；`core/*`、`render/chest.js` 注释；`docs/`（历史报告）；tools 中断言描述文字。
- 结果页分享按钮 `分享得${chestName}`、签到/开箱 toast 走 `chestType().name`，改 config 后自动变为新名，无需改代码。

## 验证

1. `npm test` —— 预期 1625 通过 / 0 失败（已确认无 `=== '银箱'/'金箱'` 值断言；`chestType('jade').name` 断言不受影响）。
2. `npm run smoke` —— 预期 90 断言 / 196 截图 / 0 报错；目检 `chests` 页截图确认列表显示「白银宝箱 / 黄金宝箱」，`12c` 结算页分享按钮显示「分享得黄金宝箱」。
3. 与待上传的 1.2.9 合并为同一次发版（版本号仍 1.2.9，尚未上传成功）。
