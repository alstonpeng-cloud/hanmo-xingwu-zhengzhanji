// 数值测评数据提取器：把所有可量化配置导出为 JSON，供报告与图表脚本消费。
// 用法：node tools/extract_metrics.mjs  → docs/测评报告/metrics.json
import fs from 'node:fs';
import path from 'node:path';
globalThis.wx = globalThis.wx || new Proxy({}, { get: () => () => null });

const { CONFIG } = await import('../src/data/config.js');
const { GROWTH_NODES } = await import('../src/data/growth.js');
const { ACHIEVEMENTS, ACHIEVEMENT_CATS } = await import('../src/data/achievements.js');
const { TRIALS } = await import('../src/data/trials.js');
const { HERO_BATTLES } = await import('../src/data/heroBattles.js');
const levels = await import('../src/core/levels.js');
const power = await import('../src/core/power.js');
const chests = await import('../src/core/chests.js');
const ads = await import('../src/core/ads.js');
const siege = await import('../src/core/siege.js');
const daily = await import('../src/core/daily.js');
const idle = await import('../src/core/idleChest.js');
const g = await import('../src/data/gauntlet.js');
const dc = await import('../src/data/dailyChallenge.js');
const wk = await import('../src/data/weekly.js');

const M = { meta: { extractedAt: new Date().toISOString() } };

// ---------- 1. 经济模型 ----------
M.economy = {
  startCoins: CONFIG.economy.startCoins,
  clearCoins: CONFIG.economy.clearCoins,
  idle: CONFIG.economy.idle,
  ads: CONFIG.ads,
  shop: CONFIG.shop,
  dailyShop: CONFIG.dailyShop,
  chestTypes: CONFIG.chests.types,
  chestLevelBonus: CONFIG.chests.levelBonusByClear,
  levelChests: CONFIG.chests.levelChests,
  adCoinReward: typeof ads.adCoinReward === 'function' ? 'fn:adCoinReward' : ads.adCoinReward,
  idleChest: { stepsMin: CONFIG.idleChests.stepsMin, dailyLimit: CONFIG.idleChests.dailyLimit, qualityByLevel: CONFIG.idleChests.qualityByLevel },
};

// ---------- 2. 关卡难度曲线 ----------
// 用真实函数逐关计算：敌方每支小队战力 × statMult 累加 = 该关敌方总战力
const { troopPower } = await import('../src/core/power.js');
const TOTAL = CONFIG.levelGen.total;
const chapterOf = (n) => {
  for (const ch of CONFIG.chapters) for (const c of ch.cities) if (n >= c.from && n <= c.to) return { chapter: ch.name, city: c.name, id: ch.id };
  return { chapter: '未知', city: '未知', id: '?' };
};
const levelRows = [];
for (let lv = 1; lv <= TOTAL; lv++) {
  const def = levels.levelDef(lv);
  const enemyPower = def.enemies.reduce((sum, e) => sum + troopPower(e.troop, e.level) * (e.statMult || 1), 0);
  const loc = chapterOf(lv);
  levelRows.push({
    level: lv, chapter: loc.chapter, city: loc.city, chapterId: loc.id,
    enemyLevel: def.enemyLevel, enemyLevelMax: def.enemyLevelMax,
    enemyCount: def.enemies.length, enemyPower: Math.round(enemyPower),
    difficulty: def.difficulty, checkpoint: def.checkpoint || null,
    boss: def.bossCount > 0, heroBoss: !!def.heroBoss,
    clearCoins: CONFIG.economy.clearCoins(lv),
  });
}
M.levels = { total: TOTAL, levelGen: CONFIG.levelGen, chapters: CONFIG.chapters, rows: levelRows };

// ---------- 3. 各模式 ----------
M.modes = {
  trials: { config: CONFIG.trials, total: TRIALS.length, rewards: TRIALS.map(t => ({stage:t.stage, coins:t.coins, level:t.level})) },
  heroBattles: { config: CONFIG.heroBattles, total: HERO_BATTLES.length },
  gauntlet: { config: CONFIG.gauntlet, chapters: g.gauntletChapters().map(c => ({id:c.id, name:c.name, stages:c.stages})) },
  dailyChallenge: { config: CONFIG.dailyChallenge, total: dc.dailyTotal() },
  weekly: { config: CONFIG.weekly, tiers: wk.weeklyTierNames(), totalPoints: wk.weeklyTotalPoints() },
  arena: { config: CONFIG.arena },
};

// ---------- 4. 成长曲线 ----------
M.growth = {
  nodes: GROWTH_NODES,
  heroes: { levelUpBase: CONFIG.heroes.levelUpBase, levelUpGrowth: CONFIG.heroes.levelUpGrowth, legendaryCostMult: CONFIG.heroes.legendaryCostMult, pullCost: CONFIG.heroes.pullCost, tenPull: CONFIG.heroes.tenPull, levelCapTiers: CONFIG.heroes.levelCapTiers, slotLevels: CONFIG.heroes.slotLevels },
  rarity: CONFIG.rarity, rarityStats: CONFIG.rarityStats,
  siege: { maxLevel: CONFIG.siege.maxLevel, engines: CONFIG.siege.engines, enemy: CONFIG.siege.enemy },
  books: CONFIG.books,
  merge: CONFIG.merge,
  troopLevelCaps: CONFIG.troopLevelCaps,
  troops: CONFIG.troops,
};

// ---------- 5. 留存钩子 ----------
M.retention = {
  daily: { config: CONFIG.daily, tasks: CONFIG.daily.tasks, login7: CONFIG.daily.login7, signInChest: CONFIG.daily.signInChest },
  achievements: { cats: ACHIEVEMENT_CATS, total: ACHIEVEMENTS.length, items: ACHIEVEMENTS.map(a => ({id:a.id, cat:a.cat, tier:a.tier, name:a.name})) },
  unlocks: { levelChests: CONFIG.chests.levelChests, troopUnlocks: CONFIG.troopUnlocks, autoBattle: CONFIG.autoBattle, heroesUnlock: CONFIG.heroes.unlockLevel, trialsUnlock: CONFIG.trials.unlockLevel, gauntletUnlock: CONFIG.gauntlet.unlockLevel, dailyUnlock: CONFIG.daily.unlockLevel, weeklyUnlock: CONFIG.weekly.unlockLevel },
  idleChest: M.economy.idleChest,
  ads: CONFIG.ads,
};

const outDir = path.resolve('docs/测评报告');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'metrics.json');
fs.writeFileSync(out, JSON.stringify(M, null, 2));
console.log(`✔ 数值提取完成：${out}`);
console.log(`  关卡 ${TOTAL} 关 · 试炼 ${TRIALS.length} · 武将战 ${HERO_BATTLES.length} · 成就 ${ACHIEVEMENTS.length} · 成长节点 ${GROWTH_NODES.length}`);

// ---------- 6. 补充：玩家侧战力成长 + 宝箱期望价值 ----------
const extra = {};
// 各兵种 1~10 级战力表
extra.troopPowerTable = CONFIG.troops.map(t => ({
  id: t.id, name: t.name, rarity: t.rarity,
  powers: Array.from({length: CONFIG.merge.maxLevel}, (_, i) => troopPower(t.id, i+1)),
}));
// 宝箱期望战力价值：按 drops 概率 × 该兵种Lv1战力
extra.chestEV = Object.values(CONFIG.chests.types).map(ct => {
  const ev = (ct.drops || []).reduce((s,d) => {
    const tp = CONFIG.troops.find(t => t.rarity === d.rarity);
    return s + (tp ? troopPower(tp.id, d.level||1) : 0) * d.chance;
  }, 0);
  return { id: ct.id, name: ct.name, evPower: Math.round(ev), drops: ct.drops };
});
// 每关"累计首通金币"：估算玩家到第N关的总收入
let cum = 0;
extra.cumulativeCoins = M.levels.rows.map(r => { cum += r.clearCoins; return cum; });
// 升级消耗：武将升级 base*growth^(lv-1)
extra.heroUpgradeCost = Array.from({length: 31}, (_,i) => {
  const lv=i+1;
  return { level: lv, cost: Math.round(CONFIG.heroes.levelUpBase * Math.pow(CONFIG.heroes.levelUpGrowth, lv-1)) };
});
fs.writeFileSync(path.join(outDir, 'metrics-extra.json'), JSON.stringify(extra, null, 2));
console.log(`✔ 补充数据：${path.join(outDir,'metrics-extra.json')}（兵种战力表 / 宝箱期望 / 累计金币 / 升级消耗）`);
