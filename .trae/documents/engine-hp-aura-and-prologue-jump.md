# 器械战斗化 + 序章直进布阵（6 项改动）实施计划

## Context

用户 6 项需求：① 霹雳车伤害范围 3.5→2.5 格；② 霹雳车加攻击动画；③ 中军鼓吹加增益范围可视化；④ 两器械加血量成为战斗单位；⑤ 霹雳车算远程、被白马义从当远程锁定；⑥ 序章教学战斗失败后直接进闯关排兵布阵。全部完成并过门禁后上传体验版 1.2.3（覆盖当前开发版本；已有加固链路与模块加载扫描门禁，本轮无新资源，包体不变）。

现状要点（已侦察）：器械独立于 `entities`（不可被攻击）；战斗页 `drawEngines` 已有鼓吹淡金光环渐变圈但**部署页没有**；序章必败（battle.js L270/L449）→ `PrologueResultScreen`（败北过场页）→ `finishPrologue()` → 回首页；`unitName('thunder')` 会崩（t.tiers 不存在）。

## 改动分阶段

### 1. 范围削弱（需求①）
`src/data/config.js`（L197-210 附近）：
- `fireRadius: 3.5 → 2.5`；`tierCurve.fireRadius: 4.0 → 3.0`（保持每档 +0.5 成长口径，否则满档仍是 4.0 等于没削）。
- 新增 `thunder.hpFactor: 4`、`drum.hpFactor: 3`（阶段 2 用）。
- `engineStats`（src/core/siege.js L114-141）的 lerp 自动生效；部署页「半径 X 格」文案、fireZone 半径随数据走，不需另改。

### 2. 器械成为战斗单位（需求④⑤）——核心改动
**src/core/siege.js `engineStats`**：thunder/drum 分支各增
```js
hp: Math.round(statsFor('shield', lv).hp * e.hpFactor),
def: statsFor('shield', lv).def,
```
（盾兵为基：thunder ≈4 倍盾兵血、drum ≈3 倍。）

**src/core/arena.js `spawnEngine`**（L216-238）：`Object.assign(eng, { engine:true, troop, level, squad:null, hp/maxHp/baseMaxHp, atk:0, def, ranged: id==='thunder', backline: id==='thunder', range:0, stopRange:0, radius:1.4, speed:0, interval:Infinity, moving:false, targetId:null, facing, vx/vy:0, aura*:0, poison:null, stunTimer:0, shield:0, shieldMax:0, fireT:999, teleport:null, hero:null, heroScale:1, boss:false, dashCd:0, dashT:0 })` 并 **push 进 `entities`**（必须在 squads 之后 push，保住「先 squads 后 engines」的既有查找顺序）。

四个既有遍历点加守卫（缺一即崩）：
- 主循环 L643 后、刘备回血循环 L664：`if (e.engine) continue;`
- `retarget()` L309：`if (e.engine) continue;`（器械不开火走 retarget；开火仍由 fireEngine 负责）
- `separate()` L321：任一侧为 engine 只推开另一侧（器械不位移）
- `battle.js drawEntities` L853：`if (e.engine) continue;`（防 troopById/精灵渲染崩；生命条改在 drawEngines 画）

**索敌（需求⑤）**：`pickTarget` L294 backlineOnly 分支改为 `if (backlineOnly && !isBacklineTroop(o.troop) && !o.backline) continue;` —— thunder 的 `backline:true` 使白马义从把它当远程锁定。

**死亡联动**：引擎循环 L631-634 与 `applyEngineAuras` L574 加 `if (!eng.alive) continue;` → 死后停火、停光环（已铺火圈按原时长烧完）。胜负/超时（L1146/L1151）不改——器械计入存活数与总血量；只剩鼓吹一方会拖到超时按血量判，可接受。

**src/screens/battle.js**：
- `'death'` 事件分支（L431 附近）：器械名用 `engineName(ent.troop)`（否则 unitName 崩）。
- `drawEngines` L812：`!eng.alive` 跳过；`eng.hp < eng.maxHp` 时按 unitBars 同款 `bar(...)` 画生命条（p.y+10）。
- 承伤/击杀统计走既有 `applyDamageTo` + feed（L1480 已有 `r.engine` 分支，无需新代码）。

### 3. 霹雳车开火动画（需求②）
- **arena.js `fireEngine`**（L618 附近）：开火时 `eng.fireT = 0;`；引擎 step 循环 `eng.fireT = Math.min(999, eng.fireT + dt);`
- **engineArt.js**：新增 `export function thunderKick(fire) { return fire>=1 ? 0 : 1.25*Math.pow(1-fire,3); }`（释放瞬间甩满、余速回弹）；`drawThunder(ctx,t,color,fire)` 在 pivot 内叠加 `thunderKick(fire)` 旋转（抛臂+配重+石弹同组，形成「配重下坠—长臂上扬」）；`drawEngineFigure` opts 增 `fire`（默认 0，透传 thunder）。
- **battle.js drawEngines**：`fire: Math.min(1, eng.fireT / CONFIG.battle.attackAnimTime)`（常量名执行时核对，取既有攻击动画时长）。

### 4. 鼓吹增益范围可视化（需求③）
- **engineArt.js** 新增 `export function drawAuraRing(ctx, { x, y, r, ry(r*TILT), color:'#ffd86c', alpha, dashed })`：渐变填充 + 虚线边界 + 呼吸透明度。
- **deploy.js**（L1279-1294 器械建模处）：drum（我方与敌方）先画 `drawAuraRing(r: engineStats().auraRadius * zoom * depthScale)` 再画模型 —— 这是需求③的主落点（战斗内已有圈，部署页此前完全没有）。
- **battle.js drawEngines L817-835**：现有渐变圈重构为调用 `drawAuraRing`（同源渲染，加虚线边界提高辨识）。

### 5. 序章失败直进布阵（需求⑥）
- **game.js `finishPrologue(dest = 'home')`**（L124-142）：重置/教学标记/save 全保留；末尾 `dest==='deploy' ? this.go(new DeployScreen(this, { mode:'battle', level:1 })) : this.home();`（DeployScreen 已 import；与 result.js L220 失败主按钮同一调用形态）。
- **battle.js `finish()` L449-453**：
```js
if (this.prologue) {
  this.outcome = 'enemy';
  playSfx('defeat', { volume: 0.75 });
  g.toast('败北 · 兵牌清空，从第 1 关开始');
  g.finishPrologue('deploy');   // 不再 new PrologueResultScreen
  return;
}
```
两条必败路径（L270 计时、L249）都汇入 `finish()`，改一处即可。`prologueResult.js` 文件保留（test.mjs 有引用），仅不再被流程走到。

## 测试（tools/test.mjs）
新增断言：
1. `engineStats('thunder').fireRadius === 2.5`；火圈实测 `fireZones[0].radius === 2.5`（延伸既有 L4591 段）。
2. 器械入 entities：`entities.includes(eng) && eng.hp>0 && eng.def>0 && eng.ranged && eng.backline && eng.engine`。
3. 可被攻击/会死：敌方近战跑出 `eng.hp < eng.maxHp` 或 death 事件；`eng.hp=1` 后继续 → `over && winner==='enemy'`。
4. 死亡失效：drum `alive=false` 后队友 `siegeDmgMult===0`；thunder `alive=false` 后长跑无 `siegeShot`。
5. 白马锁远程：玩家侧仅 thunder → 敌 baima `targetId` 指向它。
6. 开火动画：`siegeShot` 当帧 `fireT===0`，再 step 后 `fireT>0`；`thunderKick(0)>0 && thunderKick(1)===0`。
7. 序章跳转：fake game 增 `finishPrologue(dest){ this.dest=dest; }`，断言 `dest==='deploy' && finished && outcome==='enemy'` 且未收到 PrologueResultScreen。
8. 可视化：`readSrc` 断言 deploy.js / battle.js 含 `drawAuraRing`。

需改的既有断言：tierCurve 4.0→3.0 相关（L4554 附近 `s10.fireRadius`）；序章 fake game 补 `finishPrologue`；其余 simulateArena 类测试不传 engine opts，实体数不受影响。

## 验证与交付
1. `npm test`（1481+新增全过）→ `npm run smoke`
2. `$env:WX_APPID='wxa3c15f63d6e349d6'; npm run build:wx`
3. 跑帧复现（TEMP 现有 fortify-repro 可复用，可选）
4. `$env:WX_APPID='wxa3c15f63d6e349d6'; $env:WX_VERSION='1.2.3'; $env:WX_UPLOAD='1'; npm run wx:release`（加固 level 1 默认 + 模块加载扫描门禁）
5. mp.weixin.qq.com → 版本管理 → 把 1.2.3 设为**体验版**（浏览器自动化，覆盖 1.2.2）

## 风险
- 最大回归点：器械入 `entities` 后所有遍历点漏防 → 上述 4 处守卫必须齐（drawEntities / death 名字 / retarget / separate / 主循环 / aura）。
- `unitName('thunder')` 崩溃路径：凡渲染伤亡 feed、统计的地方统一走 engineName 分支。
- 包体无新增资源，仍 3.07MB 加固产物；序章必败逻辑与跳转不冲突（必败只改 outcome，最终走 finish()）。
