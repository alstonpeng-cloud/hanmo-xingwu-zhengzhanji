// 敌方总战力曲线（用于难度设计）：打印指定关卡的小队数 / 等级 / 总战力
import { CONFIG } from '../src/data/config.js';
import { levelDef } from '../src/core/levels.js';
import { troopPower } from '../src/core/power.js';

const at = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300, 350, 400];
for (const n of at) {
  const def = levelDef(n);
  const total = def.enemies.reduce((s, e) => s + troopPower(e.troop, e.level), 0);
  const avg = def.enemies.length ? total / def.enemies.length : 0;
  console.log(
    `Lv${String(n).padStart(3)}  小队 ${String(def.enemies.length).padStart(2)}`
    + `  敌方等级 Lv${def.enemyLevel}${def.enemyLevelMax > def.enemyLevel ? `~${def.enemyLevelMax}` : ''}`
    + `  总战力 ${Math.round(total).toLocaleString()}  平均 ${Math.round(avg)}`,
  );
}

// 各兵种线在不同等级的单队战力（设计参考）
console.log('\n单队战力参考：');
for (const id of ['shield', 'archer', 'spear', 'cavalry']) {
  const row = [1, 2, 3, 4, 5].map((lv) => `Lv${lv}:${Math.round(troopPower(id, lv))}`).join('  ');
  console.log(`${id.padEnd(8)} ${row}`);
}
console.log(`等级锚点 ${(CONFIG.levelGen.levelAnchors || []).map((a) => `${a.n}关:Lv${a.level}`).join(' → ')}`
  + `  enemiesBase=${CONFIG.levelGen.enemiesBase}  enemiesPerLevel=${CONFIG.levelGen.enemiesPerLevel}  enemiesMax=${CONFIG.levelGen.enemiesMax}`);
