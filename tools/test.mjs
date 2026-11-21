// 核心规则自动测试：node tools/test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/data/config.js';
import { statsFor, unitName, tierIndexFor, nextTierInfo, rarityOf, rarityInfo, baseTroopOf, troopById, isBacklineTroop, sortUnits, troopUnlockLevel, troopUnlocked, refreshTroopUnlocks, unlockedTroops, troopLevelCap, capTroopLevel } from '../src/core/units.js';
import { maxLevel, mergeInfo, mergeUnits, mergeCandidates, autoMerge } from '../src/core/merge.js';
import { levelDef, levelTotal, enemyCountFor, agentCountFor, specialRatioFor, rewardFor, rosterSlots, slotUnlockLevelFor, addUnit, activeFormation, undeployedUnits, shopPrice, buyUnit, canChallenge, nextLevelFor, enemyLevelFor, enemyLevelScoreFor, enemyLevelMaxFor, autoBattleUnlocked, enemyScaleFor, difficultyCheckpoint, difficultyLabel, isHeroBossLevel, heroBossLevelFor, heroBossCountFor } from '../src/core/levels.js';
import { chestType, chestTypes, chestsForLevel, troopPool, addChest, chestCount, chestTotal, rollChest, openChest, openAllChests, chestLevelBonus } from '../src/core/chests.js';
import { shareRewardFor, sharesLeft, claimShareReward, SHARE_DAILY_LIMIT } from '../src/core/shareReward.js';
import { ResultScreen } from '../src/screens/result.js';
import { chapterOfLevel, cityOfLevel, chapterRange, totalLevels, milestoneChestsAt, milestoneUnitsAt, milestones, progressInRange, chapterThemeOfLevel } from '../src/core/chapters.js';
import {
  dateKey, ensureDaily, dailyUnlocked, noteClear, noteMerge, noteChestOpened,
  taskProgress, taskState, claimTask, signIn, login7Days, nextLoginDay, canClaimLogin, claimLoginDay,
} from '../src/core/daily.js';
import { idleRatePerHour, idleAccrued, claimIdle, idleCapHours } from '../src/core/idle.js';
import { troopPower, sumPower, formatPower, comparePower, unitPower } from '../src/core/power.js';
import { initAudio, startBgm, playSfx, setAudioEnabled, isAudioEnabled, audioState, setBgmVolume, setSfxVolume, destroyAudio, unlockAudio, suspendForVisibility, resumeForVisibility } from '../src/core/audio.js';
import { computeDamage, counterMultiplier, takenMultiplier } from '../src/core/battle.js';
import { createArenaBattle, simulateArena, squadSoldierCount, squadSlotOffsets, isRangedTroop } from '../src/core/arena.js';
import { traitSkills, traitNote, combatTraits } from '../src/data/traits.js';
import { autoPlaceSquads, sanitizeFormation, formationSize, formationCell, emptyFormation, formationIndex, slotToArena, troopColumns } from '../src/core/formation.js';
import { createNewState, saveState, loadState, STATE_VERSION } from '../src/core/save.js';
import { TRIALS, trialUnlocked, trialUnlockLevel, trialMainLevel, grantTrialRewards, trialClearCoins } from '../src/data/trials.js';
import { ensureAds, adsLeft, adCoinReward, claimAdCoins, claimAdChest, defeatTroopTier, rollDefeatTroop, claimDefeatTroop } from '../src/core/ads.js';
import { BattleScreen, ARENA_VIEW, speedUnlocked } from '../src/screens/battle.js';
import { panCamera, ARENA_MARGIN } from '../src/render/camera.js';
import { HERO_EPIC_BORDER, HERO_LAYOUT, HeroScreen, sortHeroesByLevel } from '../src/screens/heroes.js';
import { DeployScreen, DEPLOY_LAYOUT, sortCards, compareCards, cardRank, deploySlotPoint, LIST_GESTURE, EMPTY_SLOT_STYLE, emptySlotBoxes, openAllLabel } from '../src/screens/deploy.js';
import { TrialScreen, TRIAL_LAYOUT } from '../src/screens/trial.js';
import { HeroBattleScreen, HERO_BATTLE_LAYOUT } from '../src/screens/heroBattle.js';
import { BarracksScreen, BARRACKS_LAYOUT, BARRACKS_GESTURE } from '../src/screens/barracks.js';
import { mulberry32 } from '../src/core/rng.js';
import {
  engineDef, engineList, engineUnlocked, engineTier, engineChoice, setEngineChoice,
  engineUpgradeCost, engineMaxUpgradeTotal, upgradeEngine, engineStats, enginePower,
  stancePoint, enemyEngineFor, engineStageFor, ENGINE_AURA_COVERAGE,
} from '../src/core/siege.js';
import {
  bookUnlocked, bookLevel, bookUpgradeCost, bookMaxTotal, upgradeBook,
  bookBonus, playerBookScales, enemyBookBonus, enemyBookScales,
} from '../src/core/books.js';
import { dailyShopUnlocked, dailyShopOffers, buyDailySlot, minutesUntilRefresh } from '../src/core/dailyShop.js';
import { HEROES, HERO_MAX_LEVEL, heroStatsFor, heroById, heroesByTier, heroCombatTraits, heroIdFromEntry, heroSkillNumbers, heroSkillSummary } from '../src/data/heroes.js';
import { heroArtFor } from '../src/render/heroArt.js';
import { thunderKick } from '../src/render/engineArt.js';
import {
  pullHeroes, grantHero, upgradeHero, heroUpgradeCost, placeHeroSquads,
  deployedHeroCount, canDeployHero, pendingLevelHeroReward, claimLevelHeroReward,
  devGrantAllHeroes, heroPower, heroLevel, unlockedHeroes,
  heroDeploySlots, nextHeroSlotLevel, mainlineScrollReward, recruitPool,
  recruitPoolTotal, pendingRecruitBoxes, claimRecruitBox, recruitedTroopFor,
  recruitHeroResult, rollRecruitEntry, legendaryCostMult, claimHeroAdTicket,
} from '../src/core/heroes.js';
import { devGrantAllTroops } from '../src/core/dev.js';
import { GROWTH_NODES, growthStatus } from '../src/data/growth.js';
import { GrowthScreen, GROWTH_LAYOUT } from '../src/screens/growth.js';
import { weekKey } from '../src/core/daily.js';
import {
  weeklyUnlocked, ensureWeekly, weeklyLevelDef, draftCapPower, buyWeeklyTroop,
  upgradeWeeklyTroop, removeWeeklyTroop, weeklyTierUnlocked, weeklyStageUnlocked,
  weeklyTierClearedCount, weeklyClearedTotal, recordWeeklyClear, weeklySweep,
  weeklyAvailableTroops, draftActiveFormation, draftDeployedIds,
  weeklyNextStage, weeklyOrbUnread,
} from '../src/core/weekly.js';
import {
  weeklyCost, weeklyTroopCost, weeklyTroopUpgradeCost, weeklyStageCoins,
  weeklyStageChest, weeklyTierBonusCoins, weeklyTierName,
  weeklyStartPoints, weeklyTierGrant, weeklyBudgetForTier, weeklyTotalPoints,
} from '../src/data/weekly.js';
import {
  dailyBattleDef, dailyHpMult, dailyHeroCount, dailyHeroes, dailyAnchor, dailyTotal,
  dailyUnlocked as dailyChallengeUnlocked, dailyClearedCount, dailyStageUnlocked,
  recordDailyClear, recordDailyRepeatWin, dailyFirstClearReward,
  dailyChallengeOrbUnread,
} from '../src/data/dailyChallenge.js';
import { ACHIEVEMENTS, ACHIEVEMENT_CATS, achievementsOfCat, achievementRewardText } from '../src/data/achievements.js';
import {
  achievementKey, achievementProgress, achievementStates, achievementNextTier,
  claimableKeys, claimableCount, claimAchievement,
} from '../src/core/achievements.js';
import { WeeklyChallengeScreen, WEEKLY_LAYOUT } from '../src/screens/weekly.js';
import { DailyChallengeScreen, DAILY_LAYOUT } from '../src/screens/dailyChallenge.js';
import { AchievementsScreen, ACHIEVEMENT_LAYOUT } from '../src/screens/achievements.js';
import {
  HERO_BATTLES, heroBattleDef, heroBattlePower, heroBattleUnlocked, heroBattleSquads,
  heroBattleScrollReward, heroBattleUnlockLevel, recordHeroBattleClear,
  heroBattleRankCol, heroBattleBossCells, HERO_BATTLE_RANK,
} from '../src/data/heroBattles.js';
import {
  emptyTutorial, sanitizeTutorial, tutorialSeen, markTutorialSeen, skipTutorial,
  findMergePair, pickTutorial, TUTORIAL_STEPS, TUTORIAL_VERSION,
} from '../src/core/tutorial.js';
import {
  idleChestStepsMin, idleChestDailyLimit, idleChestStepMs, idleChestQuality,
  idleChestDayStart, emptyIdleChest, sanitizeIdleChest, ensureIdleChest,
  idleChestState, claimIdleChest, formatIdleCountdown,
} from '../src/core/idleChest.js';
import {
  prologueDef, seedPrologue, ALL_TROOPS, PROLOGUE_PLAYER,
  PROLOGUE_NARRATION, TEACHING_TITLE,
} from '../src/data/prologue.js';
import {
  isSupportBattle, supportSquad, SUPPORT_TROOP, SUPPORT_LEVEL_LV, SUPPORT_RESULT,
} from '../src/data/supportLevel.js';
import { CHEST_MODEL } from '../src/render/chest.js';
import { heroHpSegmentCount, heroHpSegmentFill, heroCooldown } from '../src/core/heroBar.js';
import {
  TRIAL_ROUNDS, TRIAL_LEVEL_TIERS, trialLevelFor, isTrialUnit, trialUnits,
  rollTrialTroop, addTrialUnit, tickTrialRounds, stripTrialFromFormation,
} from '../src/core/trialTroop.js';
import { unlockTargets, nextUnlockInfo } from '../src/core/nextUnlock.js';
import { pendingUnlockTeachings, markUnlockSeen, seedUnlockSeen } from '../src/core/unlocks.js';
import {
  gauntletUnlocked, startGauntletRun, gauntletRunSquads, applyGauntletReport,
  swapGauntletUnits, completeGauntletChapter, gauntletDailyAvailable, gauntletChapterView,
} from '../src/core/gauntlet.js';
import { gauntletStageDef, gauntletChapter, gauntletStagePower } from '../src/data/gauntlet.js';

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

console.log('\n== 兵种属性与命名（10 级制） ==');
{
  const s1 = statsFor('shield', 1);
  const s10 = statsFor('shield', 10);
  ok(s1.hp === 190 && s1.atk === 12, '盾兵 1 级：hp190 / atk12（本轮抬血、降防）');
  ok(s10.hp === Math.round(190 * (1 + 9 * 0.28)) && s10.atk === Math.round(12 * (1 + 9 * 0.25) * 10) / 10
    && s10.def === Math.round(4 * (1 + 9 * 0.10) * 10) / 10,
    `盾兵 10 级：hp${s10.hp} / atk${s10.atk} / def${s10.def}（成长 +28% / +25% / +10% / 级）`);
  ok(statsFor('archer', 10).hp === Math.round(78 * (1 + 9 * 0.28))
    && statsFor('archer', 10).atk === Math.round(25 * (1 + 9 * 0.25) * 10) / 10, '弓兵 10 级按新成长率算');
  ok(!combatTraits('archer', 1) && (combatTraits('baima', 1) || {}).dealtMult === 0.8,
    '弓箭恢复原状；白马义从伤害保持原来的 80%');
  ok(statsFor('shield', 10).hp / statsFor('shield', 1).hp > 3.4,
    `升级提升更大：盾兵 1 级 → 10 级血量 ×${(statsFor('shield', 10).hp / statsFor('shield', 1).hp).toFixed(2)}（>3.4）`);
  ok(maxLevel() === 10, '等级上限 10 级');
  ok(unitName('shield', 1) === '布衣盾卒', '1 级 = 布衣盾卒');
  ok(unitName('shield', 2) === '箍盾兵', '2 级 = 箍盾兵（每级换名）');
  ok(unitName('archer', 10) === '老兵弓手', '弓兵 10 级 = 老兵弓手');
  ok(unitName('spear', 1) === '布衣枪卒' && unitName('spear', 10) === '老兵铁枪', '枪兵 1/10 级命名');
  ok(unitName('cavalry', 10) === '老兵铁骑', '骑兵 10 级 = 老兵铁骑');
  const nt = nextTierInfo('shield', 9);
  ok(nt.nextLevel === 10 && nt.nextName === '铁盾老兵', '9 级时提示下一级名称');
  ok(nextTierInfo('shield', 10) === null, '满级没有下一级');
  ok(tierIndexFor(10) === 9 && tierIndexFor(1) === 0, '等级 ↔ 外观档位 1~10');
}

console.log('\n== 合成系统 ==');
{
  const st = createNewState();       // 4 个兵种各 1 个，300 个兵营位
  ok(st.units.length === 4, '初始 4 个单位（4 个兵种各 1 个）');
  const first = st.units[0];
  ok(mergeInfo(st, first.id).canMerge === false, '没有同级同兵种时不能合成');

  const dup = { id: 'x1', troop: first.troop, level: 1 };
  st.units.push(dup);
  const info = mergeInfo(st, first.id);
  ok(info.canMerge && info.candidates.length === 1 && info.owned === 2, '凑齐 2 个同级同兵种后可以合成');
  ok(info.nextName === unitName(first.troop, 2), '合成目标等级命名正确');

  const before = st.units.length;
  const r = mergeUnits(st, first.id, dup.id);
  ok(r.ok && r.fromLevel === 1 && r.toLevel === 2, '合成成功：1 级 → 2 级');
  ok(st.units.length === before - 1, '材料单位被消耗（总数 -1）');
  ok(st.units.find((u) => u.id === dup.id) === undefined, '材料已从兵营移除');
  ok(st.formation.indexOf(dup.id) === -1, '材料同时从布阵里移除');
  ok(mergeInfo(st, first.id).canMerge === false, '合成后没有同级材料，不能继续');

  const st2 = createNewState();
  const a = st2.units[0];
  const mate = { id: 'x2', troop: a.troop, level: 1 };
  st2.units.push(mate);
  ok(mergeUnits(st2, a.id, a.id).ok === false, '不能拿自己当材料');
  ok(mergeUnits(st2, a.id, 'ghost').ok === false, '材料不存在时拒绝');
  const otherTroop = { id: 'x3', troop: 'archer', level: 1 };
  st2.units.push(otherTroop);
  const aShield = st2.units.find((u) => u.troop === 'shield');
  if (aShield) ok(mergeUnits(st2, aShield.id, otherTroop.id).reason === 'troop', '兵种不同不能合成');
  const lv2 = { id: 'x4', troop: a.troop, level: 2 };
  st2.units.push(lv2);
  const lv1b = { id: 'x5', troop: a.troop, level: 1 };
  st2.units.push(lv1b);
  ok(mergeUnits(st2, lv1b.id, lv2.id).reason === 'level', '等级不同不能合成');

  // 一键合成：4 个 Lv1 → 1 个 Lv3（3 次合成）
  const st3 = createNewState();
  st3.units = [
    { id: 'a', troop: 'shield', level: 1 },
    { id: 'b', troop: 'shield', level: 1 },
    { id: 'c', troop: 'shield', level: 1 },
    { id: 'd', troop: 'shield', level: 1 },
  ];
  st3.formation = new Array(25).fill(null);
  const merges = autoMerge(st3);
  ok(merges === 3 && st3.units.length === 1 && st3.units[0].level === 3, '一键合成：4 个 Lv1 → 1 个 Lv3（3 次）');
  ok(autoMerge(st3) === 0, '没有可合成组合时一键合成返回 0');

  const st4 = createNewState();
  st4.units = [
    { id: 'm1', troop: 'spear', level: 10 },
    { id: 'm2', troop: 'spear', level: 10 },
  ];
  st4.formation = new Array(25).fill(null);
  const infoMax = mergeInfo(st4, 'm1');
  ok(infoMax.atMax === true && infoMax.canMerge === false, '两个满级兵也不能再合成');
  ok(mergeUnits(st4, 'm1', 'm2').reason === 'max', '满级合成被拒绝');

  // 拖拽合成：拖动的（材料）可能已上阵 → 只清空格子，目标留在原格并升一级
  const st5 = createNewState();
  st5.units = [
    { id: 'g1', troop: 'shield', level: 1 },
    { id: 'g2', troop: 'shield', level: 1 },
  ];
  st5.formation = new Array(25).fill(null);
  st5.formation[3] = 'g1';
  st5.formation[10] = 'g2';
  const dragMerge = mergeUnits(st5, 'g1', 'g2');
  ok(dragMerge.ok && st5.units.length === 1 && st5.units[0].level === 2, '拖拽合成：材料被消耗、目标升一级');
  ok(st5.formation[3] === 'g1' && st5.formation[10] === null, '拖拽合成：目标留在原布阵格，材料格清空');
}

console.log('\n== 关卡与兵营格子 ==');
{
  const d1 = levelDef(1);
  const d30 = levelDef(30);
  ok(d1.enemies.length === CONFIG.levelGen.enemiesBase && d1.enemyLevel === 1,
    `第 1 关：${d1.enemies.length} 支 Lv1 敌军小队（少于我方初始 4 支，首战好过）`);
  ok(d30.enemies.length === enemyCountFor(30) && d30.enemies.length <= CONFIG.levelGen.enemiesMax,
    `第 30 关：${d30.enemies.length} 支敌军小队（按曲线递增，不超过上限 ${CONFIG.levelGen.enemiesMax} 与 25 格）`);
  ok(d30.enemyLevel === enemyLevelFor(30) && d30.enemyLevel <= 10,
    `第 30 关敌军 Lv${d30.enemyLevel}（等级曲线锚点插值，不超过 10 级）`);
  ok(d30.enemies.every((e) => e.level === d30.enemyLevel || e.level === d30.enemyLevel + 1),
    '混编小队的等级在「基础等级 / 基础+1」之间（小数等级 = 部分小队升 1 级）');
  ok(enemyCountFor(10) === 5,
    `第 10 关敌军数（${enemyCountFor(10)} 支）符合新手期下调后的锚点曲线`);
  ok(d1.enemies.every((e) => e.col >= 0 && e.col < 5 && e.row >= 0 && e.row < 5), '敌军都落在 5×5 布阵格内');
  const spots = new Set(d30.enemies.map((e) => `${e.col},${e.row}`));
  ok(spots.size === d30.enemies.length, '敌军不会站到同一个格子上');
  const allTroops = new Set(CONFIG.levelGen.patterns.flat());
  ok(allTroops.has('spear') && allTroops.size === 4, '敌军阵容包含枪兵（4 兵种）');
  ok(squadSoldierCount('shield') === 3 && squadSoldierCount('archer') === 2 && squadSoldierCount('spear') === 3,
    '小队含多个兵（Lv1：盾3/弓2/枪3）');
  // 小队随等级变多：Lv3 / Lv5 / Lv8 各 +1 个兵（盾/枪/骑 封顶 6，弓兵封顶 5）
  ok(squadSoldierCount('shield', 2) === 3 && squadSoldierCount('shield', 3) === 4,
    '盾兵 Lv2 = 3 人、Lv3 = 4 人（升级到 3 级多 1 个兵）');
  ok(squadSoldierCount('shield', 5) === 5 && squadSoldierCount('shield', 8) === 6,
    '盾兵 Lv5 = 5 人、Lv8 = 6 人（满编 6）');
  ok(squadSoldierCount('shield', 10) === 6 && squadSoldierCount('cavalry', 10) === 6
    && squadSoldierCount('spear', 10) === 6, '盾/枪/骑满级都是 6 人（封顶不再增加）');
  ok(squadSoldierCount('archer', 2) === 2 && squadSoldierCount('archer', 3) === 3
    && squadSoldierCount('archer', 5) === 4 && squadSoldierCount('archer', 8) === 5
    && squadSoldierCount('archer', 10) === 5, '弓兵：2 → Lv3 3 → Lv5 4 → Lv8 5（封顶 5 人）');
  ok(squadSlotOffsets('shield', 0, 1).length === 3 && squadSlotOffsets('shield', 0, 3).length === 4
    && squadSlotOffsets('archer', 0, 8).length === 5 && squadSlotOffsets('shield', 0, 10).length === 6,
    '小队站位数量跟着等级走（开战出生时每人都占一个位置）');
  {
    const far = squadSlotOffsets('shield', 0, 10).slice(1);
    let minDist = Infinity;
    for (let i = 0; i < far.length; i++) {
      for (let j = i + 1; j < far.length; j++) {
        minDist = Math.min(minDist, Math.hypot(far[i].dx - far[j].dx, far[i].dy - far[j].dy));
      }
    }
    ok(minDist >= CONFIG.combat.radius * 2, `6 人小队的站位之间至少 ${minDist.toFixed(2)} 格（不叠在一个点上）`);
  }
  {
    const d200 = levelDef(200);
    const soldiers = d200.enemies.reduce((n, e) => n + squadSoldierCount(e.troop, e.level), 0);
    ok(agentCountFor(200) === soldiers && soldiers > d200.enemies.length * 2.5,
      `第 200 关敌军 ${d200.enemies.length} 支小队 = ${agentCountFor(200)} 个兵（人数按等级算）`);
  }
  ok(rosterSlots(0).unlocked === 300, '兵营容量 300（开局全部可用）');
  ok(rosterSlots(30).unlocked === 300, '通完 30 关容量仍为 300');
  ok(slotUnlockLevelFor(5) === 0, '兵营位不再按关解锁（全部开局可用）');
  const state = createNewState();
  state.maxCleared = 30;
  while (state.units.length < 300) state.units.push({ id: `f${state.units.length}`, troop: 'shield', level: 1 });
  const added = addUnit(state, 'shield', 1);
  ok(added === null && state.units.length === 300, '300 个兵营位满了不再加入新兵');

  ok(CONFIG.levelGen.total === 2600, '关卡总数 2600 = 六章 26 座城池 × 100 关');
  ok(levelTotal() === CONFIG.levelGen.total, 'levelTotal() 与配置一致');
  const d400 = levelDef(400);
  ok(d400.enemies.length <= CONFIG.levelGen.enemiesMax && d400.enemies.length <= 25,
    `第 400 关：${d400.enemies.length} 支 Lv${d400.enemyLevel} 敌军小队（数量不超过上限、难度不陡）`);
  // 1.2.5 起敌方器械不再顶替小队：满编 25 支小队 + 1 台器械（器械走独立站位，不占阵格）
  const unitCount = (d) => d.enemies.length + (d.engine ? 1 : 0);
  ok(CONFIG.levelGen.enemiesMax === 25 && d400.enemies.length === 25 && unitCount(d400) === 26,
    `敌方满编 + 器械：第 400 关共 26 个战斗单位（${d400.enemies.length} 支小队 + ${d400.engine ? 1 : 0} 台器械）`);
  ok(agentCountFor(400) > 100, `第 400 关敌军总兵数 ${agentCountFor(400)} 个（25 支小队 × 每队多人）`);
  ok(d400.enemyLevel === 4 && d400.enemyLevelMax === 5 && d400.enemyLevel <= CONFIG.merge.maxLevel,
    `第 400 关敌军 Lv${d400.enemyLevel}~${d400.enemyLevelMax}（大部分 Lv4、少量 Lv5 混编）`);

  // 难度设计目标（本轮重新平衡）：第 50 / 80 / 100 / 120 / 140 / 160 关敌方总战力
  // 9,860 / 16,240 / 24,880 / 27,800 / 30,750 / 35,770
  {
    const powerAt = (n) => levelDef(n).enemies.reduce((s, e) => s + troopPower(e.troop, e.level), 0);
    for (const [n, target] of [[50, 9860], [80, 16240], [100, 24880], [120, 27800], [140, 30750], [160, 35770]]) {
      ok(Math.abs(powerAt(n) - target) <= target * 0.06,
        `第 ${n} 关敌方总战力 ${Math.round(powerAt(n)).toLocaleString()}（目标 ${target.toLocaleString()} ±6%）`);
    }
    ok(powerAt(160) > powerAt(140) && powerAt(140) > powerAt(120)
      && powerAt(120) > powerAt(100) && powerAt(100) > powerAt(80) && powerAt(80) > powerAt(50),
      '敌方战力在 50 / 80 / 100 / 120 / 140 / 160 关逐段递增');
    // 等级区间：80 关 Lv2-3 / 100 关 Lv2-3 / 120 关 Lv3-4 / 140 关 Lv3-5 / 160 关 Lv4-5
    ok(enemyLevelFor(80) === 2 && enemyLevelMaxFor(80) === 3, '第 80 关敌军 Lv2~3');
    ok(enemyLevelFor(100) === 2 && enemyLevelMaxFor(100) === 3, '第 100 关敌军 Lv2~3');
    ok(enemyLevelFor(120) === 3 && enemyLevelMaxFor(120) === 4, '第 120 关敌军 Lv3~4');
    ok(enemyLevelFor(140) === 3 && enemyLevelMaxFor(140) === 5, '第 140 关敌军 Lv3~5');
    ok(enemyLevelFor(160) === 4 && enemyLevelMaxFor(160) === 5, '第 160 关敌军 Lv4~5');
    ok(enemyCountFor(100) === 23 && enemyCountFor(120) === 25,
      `第 100 关压到 ${enemyCountFor(100)} 支小队、第 120 关恢复 ${enemyCountFor(120)} 支`);
    ok(powerAt(400) > powerAt(300) && powerAt(400) <= 55000,
      `第 400 关敌方总战力 ${Math.round(powerAt(400)).toLocaleString()}（不超过 5.5 万，血量口径上调后的新锚点）`);
    // 第二章不能靠数值拉伸：800 关战力必须显著高于 400，但仍在可控范围内（不溢出）
    ok(powerAt(800) > powerAt(400) && powerAt(800) <= 90000,
      `第 800 关敌方总战力 ${Math.round(powerAt(800)).toLocaleString()}（≤ 9 万，战力不溢出）`);

    // 801~2600：每章末与下一章初都生成正常（25 支小队）；普通兵≤10 级，英雄 BOSS 走 1~30 级成长
    for (const n of [801, 1200, 1201, 1700, 1701, 2200, 2201, 2600]) {
      const d = levelDef(n);
      const troops = d.enemies.filter((e) => !e.hero);
      const guards = d.enemies.filter((e) => e.hero && !e.boss);
      const bosses = d.enemies.filter((e) => e.boss);
      const bossLv = Math.min(HERO_MAX_LEVEL, heroBossLevelFor(n));
      const wantBoss = isHeroBossLevel(n) ? heroBossCountFor(n) : 0;
      ok(unitCount(d) === 25 + (d.engine ? 1 : 0)
        && d.enemies.length === 25
        && troops.every((e) => e.level >= 1 && e.level <= CONFIG.merge.maxLevel)
        && guards.every((e) => e.level >= 1 && e.level <= CONFIG.merge.maxLevel)
        && bosses.length === wantBoss
        && bosses.every((e) => e.level === bossLv),
        `第 ${n} 关：${d.enemies.length} 支小队 + 器械 ${d.engine ? 1 : 0} 台；普通兵 Lv1~${CONFIG.merge.maxLevel}，英雄 BOSS ×${bosses.length} Lv${bossLv}`);
    }
    {
      const boss = levelDef(2600).enemies.find((e) => e.boss);
      ok(boss && boss.level > CONFIG.merge.maxLevel
        && heroPower(boss.hero, boss.level, boss.hpMult || 1) > troopPower(boss.troop, boss.level),
        `Lv${boss && boss.level} 英雄 BOSS 用英雄成长口径（heroPower 高于被钳到 10 级的 troopPower）`);
    }
    ok(powerAt(2600) > powerAt(1200) && powerAt(2600) > powerAt(1700)
      && powerAt(2600) <= 200000,
      `第 2600 关敌方总战力 ${Math.round(powerAt(2600)).toLocaleString()}（≤ 20 万，曲线不失控）`);
  }

console.log('\n== 难度曲线：30 关起渐进 +10%（前期加压）+ 卡点 ==');
{
  // 教学期不动
  let earlyClean = true;
  for (let n = 1; n <= 20; n++) if (enemyScaleFor(n) !== 1) earlyClean = false;
  ok(earlyClean && levelDef(1).enemies.every((e) => e.statMult === undefined),
    '第 1~20 关保持原难度（新手教学期不额外加压）');

  // 21 / 49 两处卡点：只卡一关，前一关后一关都回落
  ok(enemyScaleFor(21) === 1.08 && enemyScaleFor(20) === 1 && enemyScaleFor(22) === 1,
    '第 21 关 +8%，20 / 22 关立刻回落到 1.00（卡点只卡一关）');
  ok(enemyScaleFor(49) === 1.205 && enemyScaleFor(48) === 1.09 && enemyScaleFor(50) === 1.1,
    `第 49 关在当期 1.095 上再叠 10% 到 ${enemyScaleFor(49)}，48 / 50 关回到当期曲线`);
  ok(difficultyCheckpoint(21)?.label === '校场试阵'
    && difficultyCheckpoint(49)?.label === '黄巾屯兵'
    && !difficultyCheckpoint(50) && !difficultyCheckpoint(80),
    '卡点只在 21 / 49 关，其他关没有卡点标记');
  ok(levelDef(21).checkpoint === '校场试阵' && levelDef(80).checkpoint === null,
    'levelDef 带出卡点名称，普通关为空');
  ok(levelDef(21).difficulty === 1.08
    && levelDef(21).enemies.every((e) => e.statMult === 1.08),
    '卡点关每支敌军小队都挂上 statMult（含守将）');

  // 30~50 渐进加压 → 51 起恒定，之后按 8 档分段抬升，2600 关封顶 2.15
  ok(enemyScaleFor(30) === 1.005 && enemyScaleFor(40) === 1.052 && enemyScaleFor(50) === 1.1
    && enemyScaleFor(51) === 1.1 && enemyScaleFor(61) === 1.1,
    `第 30~50 关从 ${enemyScaleFor(30)} 线性抬到 1.10，51 关起恒定（不出现一刀切）`);
  const tierAnchors = [
    [80, 1.1], [149, 1.1], [150, 1.108], [160, 1.18], [400, 1.186], [420, 1.3],
    [800, 1.308], [820, 1.45], [1200, 1.459], [1220, 1.62],
    [1700, 1.629], [1720, 1.8], [2200, 1.809], [2220, 1.98], [2600, 2.15],
  ];
  ok(tierAnchors.every(([n, scale]) => enemyScaleFor(n) === scale),
    `难度 8 档锚点：80 ${enemyScaleFor(80)} → 2600 ${enemyScaleFor(2600)}`);
  ok(tierAnchors.every(([, scale], i) => i === 0 || scale >= tierAnchors[i - 1][1])
    && difficultyLabel(2600) === '215%',
    `难度只升不降，终章 ${difficultyLabel(2600)}`);
  ok(levelDef(80).difficulty === 1.1
    && levelDef(80).enemies.every((e) => e.statMult === 1.1),
    '50 关后每支敌军小队都带 1.10 倍属性');
  ok(enemyScaleFor(2600) <= CONFIG.levelGen.difficulty.maxScale,
    `倍率不超过封顶 ${CONFIG.levelGen.difficulty.maxScale}`);

  // 战场里真的更耐打、更疼，但防御不动（避免「攻击-防御」二次放大）
  const mk = (mult) => createArenaBattle(
    [{ troop: 'shield', level: 1, col: 4, row: 2 }],
    [{ troop: 'shield', level: 1, col: 0, row: 2, ...(mult ? { statMult: mult } : {}) }],
    () => 0.5,
  ).entities.filter((e) => e.side === 'enemy');
  const plain = mk(0);
  const buffed = mk(1.1);
  ok(buffed.length === plain.length
    && buffed.every((e, i) => e.maxHp === Math.round(plain[i].maxHp * 1.1)),
    '敌军生命按难度倍率放大 10%');
  ok(buffed.every((e, i) => e.atk > plain[i].atk && e.def === plain[i].def),
    '敌军攻击放大、防御保持原值');

  // 卡点确实比相邻关难（同一口径的「有效战力」= 小队战力 × 难度倍率）
  const effective = (n) => {
    const d = levelDef(n);
    return d.enemies.reduce((s, e) => s + troopPower(e.troop, e.level), 0) * d.difficulty;
  };
  ok(effective(21) > effective(20) * 1.05 && effective(49) > effective(48) * 1.05,
    '21 / 49 关的有效战力明显高于前一关（玩家会被卡一下）');
  ok(effective(70) > effective(50) && effective(100) > effective(70),
    '50 关之后整体难度仍随关卡推进而上升');

  // 小数等级不再是「逐队掷骰」：升级队数精确等于 round(小数部分 × 队数)，
  // 否则相邻两关会因为随机多 / 少升几支队而出现不是设计出来的难度抖动
  {
    const n = 30;
    const d = levelDef(n);
    const score = enemyLevelScoreFor(n);
    const want = Math.round((score - Math.floor(score)) * d.enemies.length);
    const got = d.enemies.filter((e) => e.level === Math.floor(score) + 1).length;
    ok(got === want, `第 ${n} 关升 1 级的小队数 = ${want}（精确取整，不再随机浮动）`);
  }
}

  // 章节 / 城池：6 章 × 每城 100 关 = 2600
  {
    const ch = chapterOfLevel(1);
    ok(ch && ch.name.includes('黄巾风起'), `第一章 = ${ch ? ch.name : '缺失'}`);
    ok(ch.cities.length === 4, '第一章共 4 座城池（每城 100 关）');
    ok(ch.cities.every((c) => c.to - c.from + 1 === 100), '每座城池正好 100 关');
    ok(cityOfLevel(1).name === '涿郡' && cityOfLevel(100).name === '涿郡', '第 1~100 关 = 涿郡');
    ok(cityOfLevel(101).name === '广宗' && cityOfLevel(200).name === '广宗', '第 101~200 关 = 广宗');
    ok(cityOfLevel(201).name === '颍川' && cityOfLevel(300).name === '颍川', '第 201~300 关 = 颍川');
    ok(cityOfLevel(301).name === '宛城' && cityOfLevel(400).name === '宛城', '第 301~400 关 = 宛城');
    ok(chapterRange(ch).from === 1 && chapterRange(ch).to === 400, '第一章覆盖 1~400 关');

    // 第二章 董卓乱京：虎牢关 → 荥阳 → 洛阳城郊 → 函谷关
    const ch2 = chapterOfLevel(401);
    ok(ch2 && ch2.name.includes('董卓乱京'), `第二章 = ${ch2 ? ch2.name : '缺失'}`);
    ok(ch2.cities.map((c) => c.name).join(',') === '虎牢关,荥阳,洛阳城郊,函谷关',
      '第二章城池：虎牢关 / 荥阳 / 洛阳城郊 / 函谷关');
    ok(cityOfLevel(401).name === '虎牢关' && cityOfLevel(500).name === '虎牢关'
      && cityOfLevel(501).name === '荥阳' && cityOfLevel(600).name === '荥阳'
      && cityOfLevel(601).name === '洛阳城郊' && cityOfLevel(700).name === '洛阳城郊'
      && cityOfLevel(701).name === '函谷关' && cityOfLevel(800).name === '函谷关',
      '第二章城池归属 401~800');

    // 第三章 群雄逐鹿 → 第四章 赤壁烽火 → 第五章 三分鼎足 → 第六章 天下归晋
    const ch3 = chapterOfLevel(801);
    ok(ch3 && ch3.name.includes('群雄逐鹿'), `第三章 = ${ch3 ? ch3.name : '缺失'}`);
    ok(ch3.cities.map((c) => c.name).join(',') === '濮阳,徐州,寿春,官渡外围',
      '第三章城池：濮阳 / 徐州 / 寿春 / 官渡外围');
    ok(chapterRange(ch3).from === 801 && chapterRange(ch3).to === 1200, '第三章覆盖 801~1200 关');

    const ch4 = chapterOfLevel(1201);
    ok(ch4 && ch4.name.includes('赤壁烽火'), `第四章 = ${ch4 ? ch4.name : '缺失'}`);
    ok(ch4.cities.map((c) => c.name).join(',') === '新野,长坂坡,夏口,乌林,赤壁',
      '第四章城池：新野 / 长坂坡 / 夏口 / 乌林 / 赤壁');
    ok(chapterRange(ch4).from === 1201 && chapterRange(ch4).to === 1700, '第四章覆盖 1201~1700 关');

    const ch5 = chapterOfLevel(1701);
    ok(ch5 && ch5.name.includes('三分鼎足'), `第五章 = ${ch5 ? ch5.name : '缺失'}`);
    ok(ch5.cities.map((c) => c.name).join(',') === '荆南四郡,成都,汉中,樊城,江陵',
      '第五章城池：荆南四郡 / 成都 / 汉中 / 樊城 / 江陵');
    ok(chapterRange(ch5).from === 1701 && chapterRange(ch5).to === 2200, '第五章覆盖 1701~2200 关');

    const ch6 = chapterOfLevel(2201);
    ok(ch6 && ch6.name.includes('天下归晋'), `第六章 = ${ch6 ? ch6.name : '缺失'}`);
    ok(ch6.cities.map((c) => c.name).join(',') === '夷陵,街亭,五丈原,洛阳',
      '第六章城池：夷陵 / 街亭 / 五丈原 / 洛阳');
    ok(chapterRange(ch6).from === 2201 && chapterRange(ch6).to === 2600, '第六章覆盖 2201~2600 关');
    ok(cityOfLevel(2600).name === '洛阳' && cityOfLevel(2601) === null, '第 2600 关是洛阳终点，2601 越界');

    ok(totalLevels() === 2600 && totalLevels() === levelTotal(), '章节关卡总数 = 关卡总数（2600）');
    ok(cityOfLevel(0) === null, '关卡范围外没有城池归属');
    ok(progressInRange(50, ch.cities[0]) === 0.5 && progressInRange(100, ch.cities[0]) === 1,
      '城池内进度按 100 关换算（第 50 关 50% / 第 100 关 100%）');

    // 每个章节都有独立战场主题
    const themes = [...new Set([1, 401, 801, 1201, 1701, 2201].map((n) => chapterThemeOfLevel(n)))];
    ok(themes.length === 6, `六个章节战场主题互不相同：${themes.join(' / ')}`);
    ok(themes.every((id) => CONFIG.arenaThemes && CONFIG.arenaThemes[id]
      && CONFIG.arenaThemes[id].sandTop && CONFIG.arenaThemes[id].bannerGlyph),
      '六个战场主题都有配色与章节旗帜字');
    ok(chapterThemeOfLevel(801) === 'warlords' && chapterThemeOfLevel(1201) === 'chibi'
      && chapterThemeOfLevel(1701) === 'threekingdoms' && chapterThemeOfLevel(2201) === 'jin',
      '章节 → 战场主题映射正确');
  }

  // 关卡不可视 / 不可重复：只能挑战 maxCleared + 1
  {
    ok(nextLevelFor({ maxCleared: 0 }) === 1 && nextLevelFor({ maxCleared: 99 }) === 100, '下一关 = 已通关 + 1');
    ok(nextLevelFor({ maxCleared: 2600 }) === null, '全部通关后没有下一关');
    ok(nextLevelFor({ maxCleared: 400 }) === 401, '第 400 关后继续进入第二章 401 关');
    ok(nextLevelFor({ maxCleared: 800 }) === 801, '第 800 关后继续进入第三章 801 关');
    ok(canChallenge(11, 10) && !canChallenge(10, 10) && !canChallenge(12, 10),
      '只能挑战下一关：已通关的关卡不能再打，也不能跳关');
    ok(!canChallenge(0, -1) && !canChallenge(2601, 2600), '越界关卡不可挑战');
  }

  // 特殊兵种按城池登场：涿郡 1~100 普通 / 广宗 101+ 稀有 / 颍川 201+ 史诗 / 宛城 301+ 传奇
  {
    const countRarity = (def, r) => def.enemies.filter((e) => rarityOf(e.troop) === r).length;
    const d100 = levelDef(100);
    const d101 = levelDef(101);
    const d200 = levelDef(200);
    const d201 = levelDef(201);
    const d300 = levelDef(300);
    const d301 = levelDef(301);
    ok(countRarity(d100, 'rare') === 0 && countRarity(d100, 'epic') === 0 && countRarity(d100, 'legendary') === 0,
      '涿郡（1~100 关）敌军还全是普通兵种');
    ok(countRarity(d101, 'rare') >= 1, `广宗第 101 关开始混入稀有兵种（${countRarity(d101, 'rare')} 支）`);
    ok(countRarity(d200, 'epic') === 0 && countRarity(d200, 'legendary') === 0,
      '广宗（101~200 关）还没有史诗 / 传奇兵种');
    ok(countRarity(d201, 'epic') >= 1, `颍川第 201 关开始混入史诗兵种（${countRarity(d201, 'epic')} 支）`);
    ok(countRarity(d300, 'legendary') === 0, '颍川（201~300 关）还没有传奇兵种');
    ok(countRarity(d301, 'legendary') >= 1, `宛城第 301 关开始混入传奇兵种（${countRarity(d301, 'legendary')} 支）`);
    const leg400 = d400.enemies.filter((e) => rarityOf(e.troop) === 'legendary');
    ok(leg400.length >= 1 && leg400.every((e) => e.level <= 4),
      `前 400 关传奇特殊兵种封顶 Lv4（第 400 关 ${leg400.map((e) => `Lv${e.level}`).join('/')}）`);
    ok(countRarity(d400, 'rare') >= 3 && countRarity(d400, 'epic') >= 2,
      `第 400 关稀有/史诗数量上调（稀有 ${countRarity(d400, 'rare')} / 史诗 ${countRarity(d400, 'epic')}）`);
    const r100 = specialRatioFor(100);
    const r101 = specialRatioFor(101);
    const r400 = specialRatioFor(400);
    ok(r100.rare === undefined && r100.epic === undefined && r100.legendary === undefined && r101.rare > 0,
      '特殊兵种比例只在对应城池起点关之后才出现');
    ok(r400.rare <= CONFIG.levelGen.specialTiers[0].cap
      && r400.epic <= CONFIG.levelGen.specialTiers[1].cap
      && r400.legendary <= CONFIG.levelGen.specialTiers[2].cap,
      `第 400 关特殊兵比例封顶（稀有 ${(r400.rare * 100).toFixed(0)}% / 史诗 ${(r400.epic * 100).toFixed(0)}% / 传奇 ${(r400.legendary * 100).toFixed(0)}%）`);
    const ratio400 = (countRarity(d400, 'rare') + countRarity(d400, 'epic') + countRarity(d400, 'legendary')) / d400.enemies.length;
    ok(ratio400 > 0.15 && ratio400 < 0.75, `第 400 关特殊兵种占 ${(ratio400 * 100).toFixed(0)}%（不是清一色特殊兵）`);
    const d120a = levelDef(120);
    const d120b = levelDef(120);
    ok(d120a.enemies.map((e) => `${e.troop}@${e.col},${e.row}`).join('|')
      === d120b.enemies.map((e) => `${e.troop}@${e.col},${e.row}`).join('|'),
      '同一关每次生成完全一致（特殊兵种位置可复现）');
    const lines = new Set(d400.enemies.map((e) => baseTroopOf(e.troop)));
    ok(lines.size === 4 && [...lines].every((b) => ['shield', 'archer', 'spear', 'cavalry'].includes(b)),
      '特殊兵种按同一条兵种线替换（盾/弓/枪/骑 4 条线都在）');
    ok(d400.enemies.every((e) => e.level >= d400.enemyLevel && e.level <= d400.enemyLevelMax),
      `混编的小队等级在「本关基础等级 ${d400.enemyLevel} ~ ${d400.enemyLevelMax}」之间`);
    ok(d101.enemies.length > levelDef(30).enemies.length,
      `敌军小队数上调：第 30 关 ${levelDef(30).enemies.length} 支 → 第 101 关 ${d101.enemies.length} 支`);
  }
}

console.log('\n== 经济：铜钱只在首通 ==');
{
  ok(rewardFor(10, true) === CONFIG.economy.clearCoins(10), '首通给铜钱');
  ok(rewardFor(10, false) === 0, '重复挑战同一关不再产出铜钱');
  ok(CONFIG.economy.clearCoins(1) === 28 && CONFIG.economy.clearCoins(400) === 1944,
    `首通铜钱整体下调 20%：第 1 关 ${CONFIG.economy.clearCoins(1)} / 第 400 关 ${CONFIG.economy.clearCoins(400)}`);
  ok(CONFIG.economy.clearCoins(50) === 264 && CONFIG.economy.clearCoins(200) === 984,
    '第 50 关 264 / 第 200 关 984（原值 330 / 1230 的 80%）');
  ok(CONFIG.economy.clearCoins(400) < 3000 && CONFIG.economy.clearCoins(50) < 660,
    '首通铜钱仍然压得很低（主要收入靠挂机）');
}

console.log('\n== 宝箱 ==');
{
  // ---------- 关卡宝箱发放 ----------
  const lc = (n) => CONFIG.chests.levelChests(n);
  ok(lc(1).join() === 'wood', '第 1 关也给 1 个小木箱');
  ok(lc(4).length === 0, '非 5 倍数关不发常规箱');
  ok(lc(5).length === 0 && lc(15).join() === 'wood' && lc(101).length === 0,
    '每 5 关 1 个小木箱；第 5 关是幽州突骑支援剧情关，不发箱');
  ok(lc(20).join() === 'wood,silver', '每 20 关：小木箱 + 银箱');
  ok(lc(40).join() === 'wood,silver', '第 40 关：小木箱 + 银箱（金箱要 50 关）');
  ok(lc(50).join() === 'wood,gold', '每 50 关：小木箱 + 金箱（50 不是 20 的倍数，没有银箱）');
  ok(lc(100).join() === 'wood,silver,gold', '第 100 关：小木箱 + 银箱 + 金箱（20 / 50 的倍数叠加）');

  // 首通宝箱 = 常规箱 + 城池 / 章节里程碑额外奖励
  ok(chestsForLevel(1).join() === 'wood', '第 1 关首通给 1 个小木箱');
  ok(chestsForLevel(5).length === 0, '第 5 关改为幽州突骑支援剧情，首通不发宝箱');
  ok(isSupportBattle(5, 'main') && !isSupportBattle(4, 'main')
    && !isSupportBattle(5, 'trial') && !isSupportBattle(5, 'hero') && !isSupportBattle(5, 'other'),
    '幽州突骑支援只在主线第 5 关，演武 / 英雄战 / 斩将都不触发');
  const sup = supportSquad();
  ok(sup.troop === SUPPORT_TROOP && sup.level === SUPPORT_LEVEL_LV && sup.support === true,
    '支援小队 = 幽州突骑 Lv3，标记为剧情单位（不进兵营 / 不写存档）');
  ok(typeof SUPPORT_RESULT === 'string' && SUPPORT_RESULT.includes('不另赐宝箱'),
    '第 5 关结算文案说明「不另赐宝箱」');
  ok(chestsForLevel(20).join() === 'wood,silver', '第 20 关首通 = 小木箱 + 银箱');
  ok(chestsForLevel(50).join() === 'wood,gold', '第 50 关首通 = 小木箱 + 金箱');
  ok(chestsForLevel(100).join() === 'wood,silver,gold',
    `第 100 关（涿郡通关）= 小木 + 银 + 金（城池奖励改为 3 级元戎弩手，实测 ${chestsForLevel(100).join()}）`);
  ok(milestoneUnitsAt(100).length === 1 && milestoneUnitsAt(100)[0].unit === 'yuanyong'
    && milestoneUnitsAt(100)[0].level === 3, '第 100 关城池奖励 = 1 个 3 级元戎弩手');
  ok(chestsForLevel(200).join() === 'wood,silver,gold',
    `第 200 关（广宗通关）= 小木 + 银 + 金（城池奖励改为 3 级虎豹骑，实测 ${chestsForLevel(200).join()}）`);
  ok(milestoneUnitsAt(200).length === 1 && milestoneUnitsAt(200)[0].unit === 'huhao'
    && milestoneUnitsAt(200)[0].level === 3, '第 200 关城池奖励 = 1 个 3 级虎豹骑');
  ok(chestsForLevel(300).join() === 'wood,silver,gold,epic',
    `第 300 关（400 前沿用旧档位）= 小木 + 银 + 金 + 城池奖励史诗宝箱（实测 ${chestsForLevel(300).join()}）`);
  ok(chestsForLevel(400).join() === 'silver,gold,legendary',
    `第 400 关（新档位节点）= 银箱 + 金箱 + 章节传奇宝箱（实测 ${chestsForLevel(400).join()}）`);
  ok(chestsForLevel(405).join() === 'silver', '400 关后每 5 关发 1 个银箱（不再发小木箱）');
  ok(chestsForLevel(420).join() === 'silver,gold', '400 关后每 20 关额外 1 个金箱');
  ok(chestsForLevel(450).join() === 'silver', '400 关后非 20 倍数的 5 倍数关只有银箱');
  ok(chestsForLevel(800).join() === 'gold,legendary,legendary,legendary',
    `800 关起每 5 关发 1 个金箱，并叠加城中里程碑奖励（实测 ${chestsForLevel(800).join()}）`);
  ok(chestsForLevel(805).join() === 'gold', '800 关起升到金箱档（第二个升级节点）');
  ok(chestsForLevel(399).length === 0, '里程碑之外的普通关（非 5 倍数）没有常规箱');

  // 里程碑列表：4 座城池 + 1 个章节终点
  const ms = milestones().filter((m) => m.chapter === chapterOfLevel(1));
  ok(ms.length === 5, '第一章里程碑 = 4 座城池通关 + 1 个章节通关');
  ok(ms.filter((m) => m.kind === 'city').map((m) => m.city.name).join() === '涿郡,广宗,颍川,宛城',
    '城池里程碑按顺序：涿郡 → 广宗 → 颍川 → 宛城');
  ok(milestoneChestsAt(100).length === 0 && milestoneChestsAt(200).length === 0,
    '涿郡 / 广宗改为固定兵种奖励，不再发金箱');
  ok(milestoneChestsAt(300).join() === 'epic' && milestoneChestsAt(400).join() === 'legendary',
    '颍川给史诗宝箱 / 通关整章给传奇宝箱');
  ok(milestoneChestsAt(50).length === 0 && milestoneChestsAt(401).length === 0, '非终点关不发里程碑奖励');

  // ---------- 宝箱档位 ----------
  ok(chestTypes().length === 8, '宝箱共 8 种：常规 5 档 + 特殊 3 档');
  ok(CONFIG.chests.regularOrder.join() === 'wood,silver,gold,platinum,jade',
    '常规宝箱顺序：小木箱 → 银箱 → 金箱 → 铂金箱 → 玄玉箱');
  ok(chestTypes({ includeLocked: false }).length === 6,
    '当前开放 6 种：小木 / 银 / 金 + 稀有 / 史诗 / 传奇');
  ok(chestType('platinum').locked && chestType('jade').locked,
    '铂金箱 / 玄玉箱先占位（第二章之后再开放）');
  ok(chestType('jade').name === '玄玉箱' && chestType('jade').color === '#3f7369',
    '玄玉箱：古玉重宝（暗青带墨色，比铂金高一档）');
  ok(chestType('platinum').drops.length === 0 && chestType('jade').drops.length === 0,
    '占位档位还没有掉落表');

  // 前 400 关只会出小木 / 银 / 金，不会出铂金 / 玄玉
  {
    const seen = new Set();
    for (let n = 1; n <= levelTotal(); n++) for (const id of chestsForLevel(n)) seen.add(id);
    ok(!seen.has('platinum') && !seen.has('jade'), '前 400 关不会掉铂金箱 / 玄玉箱（避免前期传奇泛滥）');
    ok(seen.has('wood') && seen.has('silver') && seen.has('gold')
      && seen.has('epic') && seen.has('legendary'), '400 关内能拿到：小木 / 银 / 金 + 史诗 / 传奇箱');
    const lockedState = createNewState();
    addChest(lockedState, 'jade', 1);
    ok(openChest(lockedState, 'jade').reason === 'locked', '未开放的玄玉箱打不开');
  }

  // ---------- 掉落表：品级 / 等级 / 概率 ----------
  const expectRarity = {
    wood: ['common', 'rare'], silver: ['common', 'rare', 'epic'], gold: ['rare', 'epic', 'legendary'],
    rare: ['rare'], epic: ['epic'], legendary: ['legendary'],
  };
  for (const type of chestTypes({ includeLocked: false })) {
    const rng2 = mulberry32(7);
    const seen = new Set();
    for (let i = 0; i < 800; i++) {
      const r = rollChest(type.id, rng2);
      seen.add(r.troop);
    }
    const allowed = expectRarity[type.id].map((r) => CONFIG.rarity[r].name).join(' / ');
    ok([...seen].every((id) => expectRarity[type.id].includes(rarityOf(id))),
      `${type.name}只会开出${allowed}兵种`);
    ok(expectRarity[type.id].every((r) => troopPool(r).length === 4),
      `${type.name}的兵种池来自对应品级的 4 个兵种`);
  }

  // 概率（按用户给的配比）：
  // 小木：40% 普通 Lv1 / 40% 普通 Lv2 / 20% 稀有 Lv1
  // 银箱：各 20% 普通 Lv2、普通 Lv3、稀有 Lv1、稀有 Lv2、史诗 Lv1
  // 金箱：15% 稀有 Lv2 / 15% 稀有 Lv3 / 20% 史诗 Lv1 / 20% 史诗 Lv2 / 30% 传奇 Lv1
  const rateOf = (id, bucket) => {
    const rng2 = mulberry32(99);
    const N = 8000;
    let hit = 0;
    for (let i = 0; i < N; i++) {
      const r = rollChest(id, rng2);
      if (bucket(r)) hit++;
    }
    return hit / N;
  };
  ok(Math.abs(rateOf('wood', (r) => r.rarity === 'common' && r.level === 1) - 0.4) < 0.03,
    '小木箱：普通 Lv1 40%');
  ok(Math.abs(rateOf('wood', (r) => r.rarity === 'common' && r.level === 2) - 0.4) < 0.03,
    '小木箱：普通 Lv2 40%');
  ok(Math.abs(rateOf('wood', (r) => r.rarity === 'rare' && r.level === 1) - 0.2) < 0.03,
    '小木箱：稀有 Lv1 20%');
  ok(Math.abs(rateOf('wood', (r) => r.rarity === 'common') - 0.8) < 0.03,
    '小木箱 1~2 级普通兵合计 80%');
  ok(Math.abs(rateOf('silver', (r) => r.rarity === 'common') - 0.4) < 0.03,
    '银箱：普通 Lv2~3 合计 40%（各 20%）');
  ok(Math.abs(rateOf('silver', (r) => r.rarity === 'rare') - 0.4) < 0.03,
    '银箱：稀有 Lv1~2 合计 40%（各 20%）');
  ok(Math.abs(rateOf('silver', (r) => r.rarity === 'epic' && r.level === 1) - 0.2) < 0.03,
    '银箱：史诗 Lv1 20%');
  ok(Math.abs(rateOf('gold', (r) => r.rarity === 'rare') - 0.3) < 0.03,
    '金箱：稀有 Lv2~3 合计 30%（各 15%）');
  ok(Math.abs(rateOf('gold', (r) => r.rarity === 'epic') - 0.4) < 0.03,
    '金箱：史诗 Lv1~2 合计 40%（各 20%）');
  ok(Math.abs(rateOf('gold', (r) => r.rarity === 'legendary' && r.level === 1) - 0.3) < 0.03,
    '金箱：传奇 Lv1 30%');
  for (const id of ['rare', 'epic', 'legendary']) {
    const type = chestType(id);
    const own = expectRarity[id][0];
    ok(Math.abs(rateOf(id, (r) => r.rarity === own && r.level === 1) - 0.6) < 0.03,
      `${type.name}：Lv1 60%`);
    ok(Math.abs(rateOf(id, (r) => r.rarity === own && r.level === 2) - 0.4) < 0.03,
      `${type.name}：Lv2 40%（必出本品级）`);
  }

  // 小木箱真的能开出稀有、金箱真的能开出传奇（保底检查）
  ok(rollChest('wood', () => 0.9).rarity === 'rare', '小木箱 20% 档：稀有 Lv1');
  ok(rollChest('gold', () => 0.9).rarity === 'legendary'
    && rollChest('gold', () => 0.9).level === 1, '金箱 30% 档：传奇 Lv1');

  // 宝箱兵种等级加成：只在 400 / 800 关两个节点升级（原 200 档取消）
  {
    ok(chestLevelBonus(399) === 0 && chestLevelBonus(400) === 1 && chestLevelBonus(799) === 1,
      '399 关无加成 / 400~799 关 +1');
    ok(chestLevelBonus(800) === 2 && chestLevelBonus(2600) === 2,
      '800 关起 +2（只有这两个升级节点）');
    const st = createNewState();
    st.maxCleared = 400;
    // 小木箱最后一条掉落 = 稀有 Lv1；rand()=0.99 命中它
    const r400 = rollChest('wood', () => 0.99, st);
    ok(r400 && r400.rarity === 'rare' && r400.level === 2 && r400.bonus === 1,
      `400 关开小木箱：稀有 Lv1 + 1 = Lv${r400 && r400.level}`);
    st.maxCleared = 800;
    const r800 = rollChest('wood', () => 0.99, st);
    ok(r800 && r800.level === 3 && r800.bonus === 2,
      `800 关开小木箱：稀有 Lv1 + 2 = Lv${r800 && r800.level}`);
  }

  // ---------- 开箱 ----------
  const st = createNewState();
  addChest(st, 'wood', 2);
  addChest(st, 'gold', 1);
  ok(chestCount(st, 'wood') === 2 && chestTotal(st) === 3, '首通宝箱可以攒在仓库里');
  const open1 = openChest(st, 'wood', () => 0.5);
  ok(open1.ok && open1.unit.level === 1 && chestCount(st, 'wood') === 1,
    '开箱消耗 1 个宝箱并给 1 个 Lv1 兵');
  const open2 = openChest(st, 'wood', () => 0.1);
  ok(open2.ok && open2.unit.troop === 'shield' && open2.unit.level === 2, '20% 概率开出的兵直接是 Lv2');
  ok(openChest(st, 'wood').reason === 'none', '没有宝箱时开不了');

  // 传奇宝箱：开出的兵带传奇品级（边框 / 详情页都按它上色），Lv1 60% / Lv2 40%
  const leg = createNewState();
  addChest(leg, 'legendary', 2);
  const leg1 = openChest(leg, 'legendary', () => 0.9);
  const leg2 = openChest(leg, 'legendary', () => 0.1);
  ok(leg1.ok && rarityOf(leg1.unit.troop) === 'legendary' && leg1.unit.level === 1,
    '传奇宝箱：60% 段开出 Lv1 传奇兵种');
  ok(leg2.ok && rarityOf(leg2.unit.troop) === 'legendary' && leg2.unit.level === 2,
    '传奇宝箱：40% 段开出 Lv2 传奇兵种');

  const full = createNewState();
  addChest(full, 'wood', 1);
  while (full.units.length < 300) full.units.push({ id: `c${full.units.length}`, troop: 'shield', level: 1 });
  const r = openChest(full, 'wood');
  ok(!r.ok && r.reason === 'full' && chestCount(full, 'wood') === 1, '兵营满时不消耗宝箱');
  ok(openChest(st, 'unknown').reason === 'unknown', '未知宝箱 id 返回 unknown');

  // ---------- 一键开启：全部开掉 / 无箱 / 满仓 / 溢出 ----------
  {
    const all = createNewState();
    addChest(all, 'wood', 2);
    addChest(all, 'gold', 3);
    const beforeUnits = all.units.length;
    const r = openAllChests(all, () => 0.5);
    ok(r.ok && r.count === 5 && chestTotal(all) === 0,
      `一键开启：5 个箱全开完、仓库归零（count=${r.count}）`);
    ok(all.units.length === beforeUnits + 5,
      `一键开启：开出的 5 个兵全部进兵营（${beforeUnits}→${all.units.length}）`);
    ok(Object.values(r.byRarity).reduce((a, b) => a + b, 0) === 5, '一键开启：按品级汇总数量对得上');

    const none = openAllChests(all);
    ok(!none.ok && none.reason === 'none' && none.count === 0, '无宝箱时一键开启返回 none（按钮置灰口径）');

    const full = createNewState();
    addChest(full, 'wood', 5);
    while (full.units.length < 300) full.units.push({ id: `f${full.units.length}`, troop: 'shield', level: 1 });
    const fr = openAllChests(full);
    ok(!fr.ok && fr.reason === 'full' && fr.remaining === 5 && chestTotal(full) === 5,
      '兵牌已满：一键开启不吞箱子（5 个原样留仓）');

    const over = createNewState();
    addChest(over, 'wood', 5);
    while (over.units.length < 298) over.units.push({ id: `o${over.units.length}`, troop: 'shield', level: 1 });
    const orr = openAllChests(over);
    ok(orr.count === 2 && over.units.length === 300 && chestTotal(over) === 3,
      `溢出处理：只开 2 个把兵牌填满（${orr.count}），剩余 3 个留在仓库`);
    ok(orr.reason === 'full' && orr.remaining === 3, '溢出时 reason=full 且报剩余数量，不静默丢兵');
  }
}

console.log('\n== 特殊兵种（稀有 / 史诗 / 传奇） ==');
{
  const specials = CONFIG.troops.filter((t) => t.baseTroop);
  ok(specials.length === 12, `共 12 个特殊兵种（实际 ${specials.length} 个）`);
  ok(CONFIG.troops.length === 16, `兵种总数 16 = 4 普通 + 12 特殊（实际 ${CONFIG.troops.length}）`);
  const byRarity = (r) => specials.filter((t) => t.rarity === r);
  ok(byRarity('rare').length === 4 && byRarity('epic').length === 4 && byRarity('legendary').length === 4,
    '稀有 / 史诗 / 传奇 各 4 个（每条兵种线 3 个）');
  ok(['spear', 'shield', 'archer', 'cavalry'].every((b) => specials.filter((t) => t.baseTroop === b).length === 3),
    '枪 / 盾 / 弓 / 骑 每条线各 3 个特殊兵种');
  // 12 个 id 一个不少
  const ids = ['qingzhou', 'baier', 'daji', 'xiandeng', 'tengjia', 'xianzhen',
    'qingzhu', 'yuanyong', 'wudang', 'youzhou', 'baima', 'huhao'];
  ok(ids.every((id) => troopById(id) && rarityOf(id) !== 'common'), '12 个特殊兵种 id 全部存在且品级非普通');
  ok(ids.every((id) => troopById(id).style), '每个特殊兵种都带渲染识别点 style');
  ok(ids.every((id) => troopById(id).tiers.length === 10), '每个特殊兵种都有 10 档名字');

  ok(rarityOf('shield') === 'common' && rarityInfo('shield').name === '普通', '普通兵种默认品级 = 普通');
  ok(rarityInfo('qingzhou').name === '稀有' && rarityInfo('baier').name === '史诗'
    && rarityInfo('daji').name === '传奇', '品级名称：稀有 / 史诗 / 传奇');

  // 属性倍率：稀有 1.23 / 史诗 1.85 / 传奇 2.83（只放大 1 级基础值，成长率沿用基础兵种）
  // 平衡目标：1 级传奇 ≈ 3 级史诗 ≈ 5~7 级稀有 / 8 级普通
  // 本轮：稀有 1.35→1.23、传奇 2.85→2.83 是按目标阶梯反推的结果（见 config.js rarityStats 注释）
  const q = statsFor('qingzhou', 1);
  ok(q.hp === Math.round(150 * 1.23 * 0.93) && q.atk === Math.round(21 * 1.23 * 10) / 10,
    `稀有枪兵 Lv1：hp${q.hp} / atk${q.atk}（×1.23，青州兵 5→10 人所以单兵血量 ×0.93）`);
  const b = statsFor('baier', 1);
  ok(b.hp === Math.round(150 * 1.85) && b.atk === Math.round(21 * 1.85 * 10) / 10, `史诗枪兵 Lv1 ×1.85：hp${b.hp} / atk${b.atk}`);
  const d = statsFor('daji', 1);
  ok(d.hp === Math.round(150 * 2.83 * 0.88) && d.atk === Math.round(21 * 2.83 * 0.88 * 10) / 10,
    `传奇枪兵 Lv1 ×2.83×0.88：hp${d.hp} / atk${d.atk}（大戟士常驻增伤被口径计入，用 statMult 0.88 压回传奇带）`);
  ok(statsFor('daji', 10).hp === Math.round(troopById('daji').base.hp * (1 + 9 * 0.28)),
    '特殊兵种 10 级沿用基础兵种成长率（血 +28% / 级）');
  // 品级阶梯：只比「面板血量 × 面板攻击」（含常驻 atkMult，但不含藤甲这种用输出换减伤的取舍）
  {
    const pw = (id) => {
      const s1 = statsFor(id, 1);
      const tr = combatTraits(id, 1) || {};
      return s1.hp * s1.atk * (tr.atkMult || 1);
    };
    for (const [leg, epi, rar] of [['daji', 'baier', 'qingzhou'], ['xianzhen', 'tengjia', 'xiandeng'],
      ['wudang', 'yuanyong', 'qingzhu'], ['huhao', 'baima', 'youzhou']]) {
      ok(pw(leg) > pw(epi) && pw(epi) > pw(rar), `品级阶梯：传奇 > 史诗 > 稀有（${leg} / ${epi} / ${rar}）`);
    }
    ok(statsFor('tengjia', 1).hp > statsFor('xiandeng', 1).hp
      && (combatTraits('tengjia', 10).dealtMult || 1) < 0.6,
      '藤甲兵：血量高于稀有先登，代价是输出 −50%（减伤换输出，属于特性取舍）');
  }

  // 克制 / 站位 / 射程都回退到基础兵种线
  ok(baseTroopOf('baima') === 'cavalry' && baseTroopOf('xianzhen') === 'shield', '特殊兵种知道自己的基础兵种线');
  ok(counterMultiplier('qingzhou', 'cavalry') === 1.2, '稀有枪兵照样克骑兵（按枪兵线算）');
  ok(counterMultiplier('baima', 'shield') === 1.2, '史诗骑兵照样克盾兵');
  ok(counterMultiplier('yuanyong', 'spear') === 1.2, '史诗弩士照样克枪兵');
  ok(counterMultiplier('xianzhen', 'archer') === 1.2, '传奇盾兵照样克弓兵');
  ok(CONFIG.combat.ranges.yuanyong === CONFIG.combat.ranges.archer,
    `特殊弓兵射程沿用弓兵（${CONFIG.combat.ranges.archer} 格）`);
  ok(CONFIG.combat.speeds.daji === CONFIG.combat.speeds.spear, '特殊枪兵移动速度沿用枪兵');
  ok(CONFIG.combat.intervals.huhao === CONFIG.combat.intervals.cavalry, '特殊骑兵攻击间隔沿用骑兵');

  // 小队人数：默认沿用基础兵种；青州兵人多、青竹弓手多、虎豹骑精而不多
  ok(squadSoldierCount('baier', 1) === squadSoldierCount('spear', 1), '特殊枪兵默认沿用基础枪兵人数');
  ok(squadSoldierCount('qingzhou', 1) === 5 && squadSoldierCount('qingzhou', 10) === 10,
    '青州兵 Lv1 = 5 人、满级 10 人');
  ok(squadSoldierCount('qingzhu', 1) === 4 && squadSoldierCount('qingzhu', 10) === 8,
    '青竹弓手 Lv1 = 4 人、满级 8 人');
  ok(squadSoldierCount('huhao', 1) === 2 && squadSoldierCount('huhao', 3) === 3
    && squadSoldierCount('huhao', 10) === 5, '虎豹骑 Lv1 = 2 人、Lv3 起增员、满级 5 人');
  ok(squadSlotOffsets('qingzhou', 0, 1).length === 5 && squadSlotOffsets('qingzhou', 0, 10).length === 10,
    '青州兵出生站位数量跟着自定义编制走');
}

console.log('\n== 挂机收益 ==');
{
  const idle = CONFIG.economy.idle;
  const st = createNewState();
  st.maxCleared = 10;
  ok(idleRatePerHour(10) === idle.basePerHour + idle.perLevelPerHour * 10, '每小时收益 = 基础 + 关卡加成');
  ok(idleRatePerHour(100) > idleRatePerHour(10), '打的关卡越远，挂机收益越高');

  const t0 = 1700000000000;
  st.idleAt = t0; // 直接把计时点拨到 t0，避免用到 createNewState 里的真实时间
  ok(idleAccrued(st, t0) === 0, '刚进入游戏时没有可领收益');
  ok(idleAccrued(st, t0 + 3600 * 1000) === idleRatePerHour(10), '挂机 1 小时 = 每小时收益');
  ok(idleAccrued(st, t0 + 30 * 3600 * 1000) === Math.floor(idleRatePerHour(10) * idleCapHours()),
    `超过封顶时长按 ${idleCapHours()} 小时封顶计算`);

  const before = st.coins;
  const claimed = claimIdle(st, t0 + 2 * 3600 * 1000);
  ok(claimed.ok && st.coins === before + 2 * idleRatePerHour(10), '领取后铜钱增加');
  ok(st.idleAt === t0 + 2 * 3600 * 1000, '领取后挂机计时点重置');
  ok(!claimIdle(st, st.idleAt).ok, '刚领完没有可领收益');
}

console.log('\n== 商城买兵 ==');
{
  ok(shopPrice('shield', 1) === 600 && shopPrice('archer', 1) === 750, '兵种基础价');
  ok(shopPrice('shield', 3) === 2400 && shopPrice('shield', 6) === 19200, '价格按 2^(等级-1) 翻倍');
  const st = createNewState();
  const r1 = buyUnit(st, 'shield', 1);
  ok(r1.ok && st.coins === CONFIG.economy.startCoins - 600 && st.units.length === 5 && r1.unit.level === 1,
    '花 600 铜钱买到 1 个盾兵并扣钱');
  // 填满 300 个兵营位后再买 → 兵营满
  while (st.units.length < 300) st.units.push({ id: `z${st.units.length}`, troop: 'shield', level: 1 });
  const r2 = buyUnit(st, 'shield', 1);
  ok(!r2.ok && r2.reason === 'full', '兵营满（300/300）时买不到');
  ok(st.coins === CONFIG.economy.startCoins - 600, '兵营满时不扣钱');
  const st2 = createNewState();
  st2.coins = 100;
  const r3 = buyUnit(st2, 'cavalry', 1);
  ok(!r3.ok && r3.reason === 'poor' && st2.coins === 100 && st2.units.length === 4, '铜钱不足时不扣钱也不给兵');
  const st3 = createNewState();
  st3.maxCleared = 4;
  st3.coins = 26000;
  const r4 = buyUnit(st3, 'archer', 6);
  ok(r4.ok && r4.unit.level === 6 && st3.coins === 26000 - shopPrice('archer', 6), '可以买 Lv6 弓兵');
  const st4 = createNewState();
  st4.coins = 400000;
  const r5 = buyUnit(st4, 'shield', 80);
  ok(r5.ok && r5.unit.level === CONFIG.merge.maxLevel, `购买等级不超过上限 ${CONFIG.merge.maxLevel}`);
  const st5 = createNewState();
  st5.maxCleared = 0;
  ok(buyUnit(st5, 'none', 1).reason === 'unknown', '未知兵种直接拒绝');
}

console.log('\n== 伤害与克制 ==');
{
  const A = (troop, atk) => ({ troop, atk, def: 0 });
  const D = (troop, def) => ({ troop, def, atk: 0 });
  // 克制系数本轮 1.1/0.9 → 1.2/0.85（克制单挑优势 1.22× → 1.41×）
  ok(computeDamage(A('shield', 100), D('archer', 40)) === 72, '盾打弓 = 60 ×1.2 = 72');
  ok(computeDamage(A('archer', 100), D('archer', 40)) === 60, '同兵种无加成 = 60');
  ok(computeDamage(A('archer', 100), D('shield', 40)) === 51, '弓打盾 = 60 ×0.85 = 51');
  ok(computeDamage(A('cavalry', 100), D('shield', 40)) === 72, '骑打盾 = ×1.2');
  ok(computeDamage(A('archer', 100), D('spear', 40)) === 72, '弓打枪 = ×1.2');
  ok(computeDamage(A('spear', 100), D('cavalry', 40)) === 72, '枪打骑 = ×1.2');
  ok(computeDamage(A('cavalry', 100), D('spear', 40)) === 51, '骑打枪 = ×0.85（被枪克制）');
  ok(computeDamage(A('spear', 100), D('archer', 40)) === 51, '枪打弓 = ×0.85（被弓克制）');
  ok(computeDamage(A('shield', 100), D('cavalry', 40)) === 51, '盾打骑 = ×0.85');
  // 弓箭恢复原状；白马义从只保留 80% 伤害
  {
    const arrowHit = (troop) => computeDamage(
      { troop, atk: 100, tr: combatTraits(troop, 1) },
      { troop: 'shield', def: 40 }
    );
    ok(['archer', 'qingzhu', 'wudang'].every((id) => arrowHit(id) === 51)
      && arrowHit('baima') === 57 && arrowHit('yuanyong') === 61,
      '弓箭伤害：弓兵线 60×0.85=51，白马 60×1.2×0.8=57，元戎穿甲后 72×0.85=61');
  }
  ok(computeDamage(A('shield', 1), D('shield', 100)) === 1, '伤害下限为 1');
  const sS = computeDamage({ troop: 'shield', atk: statsFor('shield', 5).atk }, { troop: 'shield', def: statsFor('shield', 5).def });
  const sA = computeDamage({ troop: 'shield', atk: statsFor('shield', 5).atk }, { troop: 'archer', def: statsFor('archer', 5).def });
  ok(sA > sS, `盾打弓(${sA}) > 盾打盾(${sS})`);
}

console.log('\n== 斗技场 AI ==');
{
  ok(CONFIG.combat.ranges.shield === 0.5 && CONFIG.combat.ranges.archer === 17,
    '射程配置：近战 0.5 格 / 弓兵 17 格（远程全线 +3）');
  ok(CONFIG.combat.ranges.archer >= 17, '弓兵射程 17 格（站第三排就能覆盖前方大部分敌人）');

  // 移速：整体放慢，而且骑兵比步兵快得多（差异化）
  {
    const sp = CONFIG.combat.speeds;
    ok(sp.shield <= 2.4 && sp.spear <= 2.3 && sp.archer <= 2.1, '步兵 / 弓兵移速整体放慢（≤ 2.4 / 2.3 / 2.1 格每秒）');
    ok(sp.cavalry / sp.shield > 1.7, `骑兵明显比盾兵快（${(sp.cavalry / sp.shield).toFixed(2)} 倍 > 1.7）`);
    ok(sp.cavalry / sp.spear > 1.8, `骑兵明显比枪兵快（${(sp.cavalry / sp.spear).toFixed(2)} 倍 > 1.8）`);
    ok(sp.archer < sp.spear && sp.spear < sp.shield, '弓兵最慢、盾兵略快于枪兵');
  }

  // 弓兵从后排出发，也要能在射程内开火；现在会提前 2 格停下，不会在射程边缘反复走动
  const bA = createArenaBattle(
    [{ troop: 'archer', level: 1, col: 0, row: 2 }],
    [{ troop: 'shield', level: 1, col: 0, row: 2 }],
    mulberry32(11)
  );
  let firstArcherShot = null;
  for (let i = 0; i < 900 && !bA.over; i++) {
    const evs = bA.step(CONFIG.combat.step);
    const shot = evs.find((e) => e.t === 'attack' && e.actorSide === 'player');
    if (shot) { firstArcherShot = shot; break; }
  }
  const archerDist = firstArcherShot ? Math.hypot(firstArcherShot.x1 - firstArcherShot.x2, firstArcherShot.y1 - firstArcherShot.y2) : 0;
  ok(!!firstArcherShot && firstArcherShot.ranged && archerDist > 14.4 && archerDist <= 16.1,
    `弓兵停在 ${archerDist.toFixed(2)} 格外开火（射程 17，提前 2 格停下）`);

  // 所有远程兵：走路停在「射程 - engageGap」，保证停住就能开火
  {
    const expectedRange = { archer: 17, qingzhu: 17, yuanyong: 23, wudang: 17, baima: 19 };
    for (const id of ['archer', 'qingzhu', 'yuanyong', 'wudang', 'baima']) {
      const bb = createArenaBattle(
        [{ troop: id, level: 1, col: 2, row: 2 }],
        [{ troop: 'shield', level: 1, col: 2, row: 2 }],
        mulberry32(31)
      );
      const e = bb.entities.find((x) => x.side === 'player');
      const expectedStop = id === 'yuanyong' ? 20 : Math.max(0.5, e.range - CONFIG.combat.engageGap);
      ok(e.ranged && e.range === expectedRange[id]
        && e.stopRange === expectedStop,
        `${id}：射程 ${e.range} → 停 ${e.stopRange} 格开火（远程全线 +3）`);
    }
  }

  // 站在「我方第三排」（col 2）的弓兵，2 秒内就能开火，不用顶到前排
  {
    const b3 = createArenaBattle(
      [{ troop: 'archer', level: 1, col: 2, row: 2 }],
      [{ troop: 'shield', level: 1, col: 0, row: 2 }],
      mulberry32(19)
    );
    let t3 = null;
    for (let i = 0; i < 300 && !b3.over; i++) {
      const evs = b3.step(CONFIG.combat.step);
      if (evs.some((e) => e.t === 'attack' && e.actorSide === 'player')) { t3 = b3.time; break; }
    }
    ok(t3 !== null && t3 < 2.0,
      `站第三排的弓兵 ${t3 === null ? '一直没开火' : `${t3.toFixed(2)} 秒就开火`}（< 2 秒）`);
  }

  // 近战要贴到 0.5 格才打
  const bM = createArenaBattle(
    [{ troop: 'shield', level: 1, col: 4, row: 2 }],
    [{ troop: 'shield', level: 1, col: 0, row: 2 }],
    mulberry32(12)
  );
  let firstMelee = null;
  for (let i = 0; i < 900 && !bM.over; i++) {
    const evs = bM.step(CONFIG.combat.step);
    const hitEv = evs.find((e) => e.t === 'attack');
    if (hitEv) { firstMelee = hitEv; break; }
  }
  const meleeDist = firstMelee ? Math.hypot(firstMelee.x1 - firstMelee.x2, firstMelee.y1 - firstMelee.y2) : 0;
  // 近战射程 0.5 + 双方碰撞半径 0.5×2 = 1.5 格；步进是离散的，留一点点余量
  ok(!!firstMelee && !firstMelee.ranged && meleeDist <= 1.55,
    `近战贴到 ${meleeDist.toFixed(2)} 格才出手（射程 0.5 + 碰撞半径）`);

  // 枪兵：比近战远一点（1.2 格），但仍是近战突刺（不画箭矢）
  const bS = createArenaBattle(
    [{ troop: 'spear', level: 1, col: 4, row: 2 }],
    [{ troop: 'cavalry', level: 1, col: 0, row: 2 }],
    mulberry32(14)
  );
  let firstSpear = null;
  for (let i = 0; i < 900 && !bS.over; i++) {
    const evs = bS.step(CONFIG.combat.step);
    const hitEv = evs.find((e) => e.t === 'attack');
    if (hitEv) { firstSpear = hitEv; break; }
  }
  const spearDist = firstSpear ? Math.hypot(firstSpear.x1 - firstSpear.x2, firstSpear.y1 - firstSpear.y2) : 0;
  ok(!!firstSpear && !firstSpear.ranged && spearDist <= 2.4,
    `枪兵在 ${spearDist.toFixed(2)} 格突刺（射程 1.2 格）`);

  // 每个兵都找「最近的」敌人
  const bT = createArenaBattle(
    [{ troop: 'archer', level: 1, col: 4, row: 2 }],
    [{ troop: 'shield', level: 1, col: 0, row: 0 }, { troop: 'shield', level: 1, col: 4, row: 2 }],
    mulberry32(13)
  );
  bT.step(0.02);
  const me = bT.entities.find((e) => e.side === 'player');
  const enemies = bT.entities.filter((e) => e.side === 'enemy');
  const nearest = enemies
    .map((e) => ({ e, d: Math.hypot(e.x - me.x, e.y - me.y) }))
    .sort((a, b) => a.d - b.d)[0];
  ok(me.targetId === nearest.e.uid, '自动锁定最近的敌人');

  // 多兵混战：每个兵独立行动，全部能分出胜负且不越界
  let ended = 0;
  let timeouts = 0;
  let hpOk = true;
  let dmgOk = true;
  let inBounds = true;
  for (let seed = 1; seed <= 120; seed++) {
    const rng = mulberry32(seed);
    const lv = 1 + (seed % 6);
    const b = createArenaBattle(
      [{ troop: 'shield', level: lv, col: 4, row: 2 }, { troop: 'archer', level: lv, col: 1, row: 2 }],
      [{ troop: 'cavalry', level: lv, col: 0, row: 2 }, { troop: 'shield', level: lv, col: 4, row: 2 }],
      rng
    );
    while (!b.over && b.time < CONFIG.combat.maxTime) {
      const evs = b.step(CONFIG.combat.step);
      for (const e of evs) {
        if (e.t === 'attack' && e.damage < 1) dmgOk = false;
      }
    }
    if (b.over) ended++;
    else timeouts++;
    if (b.entities.some((e) => e.hp < 0)) hpOk = false;
    if (b.entities.some((e) => e.x < 0 || e.x > CONFIG.arena.cols || e.y < 0 || e.y > CONFIG.arena.rows)) inBounds = false;
  }
  ok(ended === 120, '120 场混战全部正常分出胜负');
  ok(timeouts === 0, '没有卡死到超时的战斗');
  ok(dmgOk, '所有伤害 ≥ 1');
  ok(hpOk, '血量不会为负');
  ok(inBounds, '所有单位都在 50×50 场地内');

  // 同一随机种子 → 同一结果（可复现）
  const r1 = simulateArena([{ troop: 'shield', level: 3, col: 4, row: 2 }], [{ troop: 'archer', level: 3, col: 4, row: 2 }], mulberry32(21));
  const r2 = simulateArena([{ troop: 'shield', level: 3, col: 4, row: 2 }], [{ troop: 'archer', level: 3, col: 4, row: 2 }], mulberry32(21));
  ok(r1.winner === r2.winner && Math.abs(r1.time - r2.time) < 1e-6, `同种子结果一致（${r1.winner} / ${r1.time.toFixed(2)}s）`);

  // BUG 修复：目标死亡后立刻改打下一个最近的敌人（不能原地发呆）
  {
    const b = createArenaBattle(
      [{ troop: 'spear', level: 1, col: 4, row: 2 }],
      [{ troop: 'shield', level: 1, col: 4, row: 0 }, { troop: 'shield', level: 1, col: 4, row: 4 }],
      mulberry32(31)
    );
    b.step(CONFIG.combat.step); // 先让开局的全量索敌跑完，下一帧不再全量重选
    const players = b.entities.filter((e) => e.side === 'player');
    const enemies = b.entities.filter((e) => e.side === 'enemy');
    enemies[0].alive = false;   // 模拟「目标刚刚被打死」
    for (const p of players) p.targetId = enemies[0].uid;
    const before = players.map((p) => ({ x: p.x, y: p.y }));
    b.step(CONFIG.combat.step);
    const moved = players.every((p, i) => p.moving || Math.hypot(p.x - before[i].x, p.y - before[i].y) > 0);
    ok(moved, '目标阵亡后立刻改打下一个敌人（不站桩发呆）');
    ok(players.every((p) => p.targetId && b.byUid[p.targetId].alive && b.byUid[p.targetId].side === 'enemy'),
      '换目标后锁定的仍是活着的敌人');
  }
}

console.log('\n== 特殊兵种战法 ==');
{
  const ids = CONFIG.troops.filter((t) => t.baseTroop).map((t) => t.id);
  ok(ids.length === 12, '12 个特殊兵种都登记了战法');
  ok(ids.every((id) => traitSkills(id, 1).length >= 1), '每个特殊兵种至少 1 条战法');
  ok(ids.every((id) => traitSkills(id, 1).every((s) => s.desc && s.desc.length > 8)), '战法都有按等级求值的说明文案');
  ok(ids.every((id) => !!combatTraits(id, 1)), '每个特殊兵种都能拿出战斗数值');
  ok(traitSkills('shield', 1).length === 0 && !combatTraits('shield', 1), '普通兵种没有特殊战法');
  ok(traitSkills('daji', 1).length === 4 && traitSkills('daji', 1)[1].cd === 15
    && traitSkills('daji', 1)[2].name === '穿甲' && traitSkills('daji', 1)[3].name === '拒马',
    '大戟士：被动 + 15 秒突刺 + 穿甲 + 抵御冲锋');
  ok(traitSkills('daji', 1)[0].desc.includes('10%') && traitSkills('daji', 10)[0].desc.includes('40%'),
    '战法说明按当前等级显示数值（大戟 Lv1 +10% / Lv10 +40%）');
  ok(traitNote('qingzhou').includes('10'), '青州兵有「开局 5 个、满级 10 个」的编制备注');

  // ---- 伤害倍率：增伤 / 减伤都走 computeDamage（含 opt.mult）----
  const A = (troop, level = 1) => ({ troop, atk: 100, def: 0, tr: combatTraits(troop, level) });
  const D = (troop, level = 1) => ({ troop, def: 40, atk: 0, tr: combatTraits(troop, level) });
  ok(computeDamage(A('daji', 1), D('shield')) > computeDamage(A('spear', 1), D('shield')),
    '大戟士「重甲摧锋」：同样攻击力打盾兵伤害更高');
  ok(computeDamage(A('daji', 10), D('shield')) > computeDamage(A('daji', 1), D('shield')), '大戟士增伤随等级成长');
  ok(computeDamage(A('tengjia', 1), D('shield')) < computeDamage(A('shield', 1), D('shield')),
    '藤甲兵「藤革坚躯」：自己造成的伤害减半');
  ok(computeDamage(A('huhao', 1), D('shield'), { mult: 4, charge: true })
    > computeDamage(A('cavalry', 1), D('shield')) * 3, '虎豹骑冲锋撞击是 4 倍伤害');
  ok(combatTraits('baier', 1).firstHitBlock === true, '白毦兵「西上御骑」：每个兵首次受击免伤');
  ok(takenMultiplier(D('xiandeng', 10), { atkLine: 'archer' }) < 0.5, '先登死士「巨盾御矢」：弓箭伤害大幅减少');
  ok(takenMultiplier(D('tengjia', 10), { atkLine: 'spear' }) < 1, '藤甲兵「藤革坚躯」：所有伤害减少');
  ok(combatTraits('qingzhou', 1).atkMult === 0.8, '青州兵「群卒奋进」：单体伤害再偏低，靠人数');

  // ---- 穿甲：无视 30% 护甲（只乘一次，不重复叠算）----
  {
    const Pen = (pen) => ({ troop: 'daji', atk: 100, def: 0, tr: { ...combatTraits('daji', 1), armorPen: pen } });
    const heavy = { troop: 'xianzhen', def: statsFor('xianzhen', 10).def, atk: 0, tr: combatTraits('xianzhen', 10) };
    const low = { troop: 'shield', def: statsFor('shield', 1).def, atk: 0 };
    ok(computeDamage(Pen(0.3), heavy) > computeDamage(Pen(0), heavy),
      '穿甲对高护甲目标提升伤害');
    ok(computeDamage(Pen(0.3), low) > computeDamage(Pen(0), low),
      '穿甲对低护甲目标也有提升');
    ok((computeDamage(Pen(0.3), heavy) / computeDamage(Pen(0), heavy))
      > (computeDamage(Pen(0.3), low) / computeDamage(Pen(0), low)),
      '护甲越高，穿甲收益越大（有效护甲 = 护甲 × 0.7，只结算一次）');
    ok(combatTraits('daji', 1).armorPen === 0.3 && combatTraits('yuanyong', 1).armorPen === 0.3,
      '大戟士 / 元戎弩士都带 30% 穿甲');
  }

  // ---- 虎豹骑：不普攻、连续移动满 3 格 → 进入冲锋；出手后清零，可再次触发 ----
  {
    const b = createArenaBattle(
      [{ troop: 'huhao', level: 4, col: 4, row: 2 }],
      [{ troop: 'shield', level: 4, col: 0, row: 0 }, { troop: 'shield', level: 4, col: 0, row: 4 }],
      mulberry32(41)
    );
    const cav = b.entities.find((e) => e.troop === 'huhao');
    ok(cav.tr.charge3 && cav.moveAccum === 0 && !cav.charging3, '虎豹骑带 charge3 标记（连续移动 3 格起冲）');
    let firstCharged = null;
    for (let i = 0; i < 900 && !b.over; i++) {
      const evs = b.step(CONFIG.combat.step);
      const hit = evs.find((e) => e.t === 'attack' && e.actor === cav.uid && !e.counterAttack);
      if (hit) { firstCharged = hit; break; }
    }
    ok(!!firstCharged && firstCharged.charge3 === true,
      '虎豹骑在未普攻状态下走满 3 格 → 第一次命中就是冲锋撞击');
    // 出手后 moveAccum 已清零；把敌人挪远，逼它重新走 3 格，应能再次进入冲锋
    cav.moveAccum = 0;
    for (const e of b.entities) {
      if (e.side === 'enemy' && e.alive) { e.x = cav.x; e.y = cav.y - 20; }
    }
    let chargedAgain = false;
    for (let i = 0; i < 160 && !b.over; i++) {
      b.step(CONFIG.combat.step);
      if (cav.charging3) { chargedAgain = true; break; }
    }
    ok(chargedAgain && cav.moveAccum >= 3,
      `普攻后重新走满 3 格可再次进入冲锋（moveAccum=${cav.moveAccum.toFixed(1)}）`);
  }

  // ---- 无当飞军：毒矢 DoT ----
  {
    const b = createArenaBattle(
      [{ troop: 'wudang', level: 3, col: 4, row: 2 }],
      [{ troop: 'shield', level: 10, col: 0, row: 2 }],
      mulberry32(51)
    );
    let poisonHits = 0;
    let poisonTicks = 0;
    let poisonDmg = 0;
    for (let i = 0; i < 900 && !b.over; i++) {
      for (const e of b.step(CONFIG.combat.step)) {
        if (e.t === 'attack' && e.poison) poisonHits++;
        if (e.t === 'poison') { poisonTicks++; poisonDmg += e.damage; }
      }
    }
    ok(poisonHits > 0, '无当飞军「毒矢」：命中会给敌人挂毒');
    ok(poisonTicks > 0 && poisonDmg >= poisonTicks, `毒伤持续结算（${poisonTicks} 次 / 共 ${poisonDmg} 伤害）`);
    ok(combatTraits('wudang', 1).poisonPct > 0, '无当飞军战法里有毒伤比例');
  }

  // ---- 元戎弩士：射程 20 格（18 格停火）+ 按等级的连射弹匣 ----
  {
    const b = createArenaBattle(
      [{ troop: 'yuanyong', level: 10, col: 4, row: 2 }],
      [0, 1, 2, 3, 4].map((row) => ({ troop: 'shield', level: 10, col: 0, row })),
      mulberry32(61)
    );
    const y = b.entities.find((e) => e.troop === 'yuanyong');
    ok(y.range === 23 && y.stopRange === 20 && y.burstLeft === null,
      '元戎弩士：射程 23 格、20 格停下开火；弹匣按等级动态计算（10 级 = 4 连射）');
    ok(y.tr.volley.reload === 4.0 && y.tr.volley.shotInterval === 0.5,
      '连射每 0.5 秒一发、打完装弹 4.0 秒');
    let shots = 0;
    for (let i = 0; i < 160 && !b.over; i++) {
      for (const e of b.step(CONFIG.combat.step)) {
        if (e.t === 'attack' && e.actor === y.uid) shots++;
      }
    }
    ok(shots >= 3 && shots <= 5, `连射不绝：5 秒内（含装弹）射出 ${shots} 支箭`);
    ok(y.tr.armorPen === 0.3, '元戎弩士带穿甲：无视 30% 护甲');
    ok(troopPower('yuanyong', 1) > 0 && troopPower('yuanyong', 10) > troopPower('yuanyong', 1),
      '元戎弩士战力按实际弹匣计算，不再是 NaN');
  }

  // ---- 陷阵营：反击 + 陷阵加攻 ----
  {
    const b = createArenaBattle(
      [{ troop: 'xianzhen', level: 4, col: 4, row: 2 }],
      [{ troop: 'shield', level: 4, col: 4, row: 2 }],
      mulberry32(71)
    );
    let counters = 0;
    for (let i = 0; i < 900 && !b.over; i++) {
      for (const e of b.step(CONFIG.combat.step)) {
        if (e.t === 'attack' && e.counterAttack && b.byUid[e.actor].troop === 'xianzhen') counters++;
      }
    }
    const xz = b.entities.find((e) => e.troop === 'xianzhen');
    ok(xz.selfHeal > 0, `陷阵自疗：每秒回血 ${(xz.selfHeal * 100).toFixed(1)}% maxHP`);
    ok(counters > 0, `锐甲反击：被近战打中会反击（${counters} 次）`);
  }

  // ---- 白马义从：后排位置 + 远程结算、优先锁定敌方后排（含敌方白马义从） ----
  {
    ok(isBacklineTroop('baima') && isRangedTroop('baima') && !isBacklineTroop('youzhou'),
      '白马义从：既算后排站位、也按远程结算（普通骑兵不算后排）');
    ok(!isRangedTroop('shield') && !isBacklineTroop('shield'),
      '「远程」与「后排」两个概念独立：盾兵两者都不是');
    const b = createArenaBattle(
      [{ troop: 'baima', level: 3, col: 4, row: 2 }],
      [{ troop: 'shield', level: 3, col: 4, row: 2 }, { troop: 'archer', level: 3, col: 0, row: 0 }],
      mulberry32(81)
    );
    const bm = b.entities.find((e) => e.troop === 'baima');
    ok(combatTraits('baima', 1).range === 19 && bm.range === 19,
      '白马义从骑射：射程 19 格、17 格开火');
    ok(bm.ranged && bm.stopRange === 17, '白马义从按远程兵结算：提前 2 格（17 格）停下开火');
    b.step(CONFIG.combat.step);
    ok(baseTroopOf(b.byUid[bm.targetId].troop) === 'archer', '射猎后阵：白马义从优先锁定敌方弓兵');
    // 敌方同时有白马义从 + 弓兵时：优先锁更近的那个后排（不再是"只认弓兵线"）
    const b2 = createArenaBattle(
      [{ troop: 'baima', level: 3, col: 0, row: 0 }],
      [{ troop: 'baima', level: 3, col: 0, row: 0 }, { troop: 'archer', level: 3, col: 0, row: 4 }],
      mulberry32(83)
    );
    const bm2 = b2.entities.find((e) => e.side === 'player');
    b2.step(CONFIG.combat.step);
    ok(b2.byUid[bm2.targetId].troop === 'baima',
      '白马义从优先索敌包含敌方白马义从（后排互锁，不只认弓兵线）');
    // 射出去的箭要按「远程事件」走，前端才会画箭矢飞行
    let rangedShot = null;
    for (let i = 0; i < 600 && !b.over; i++) {
      const evs = b.step(CONFIG.combat.step);
      const hit = evs.find((e) => e.t === 'attack' && e.actor === bm.uid);
      if (hit) { rangedShot = hit; break; }
    }
    ok(!!rangedShot && rangedShot.ranged, '白马义从的攻击按远程箭矢结算（画箭矢飞行）');
  }

  // ---- 陷阵营：只反射近战；白马义从是远程伤害 → 不反射 ----
  {
    const b = createArenaBattle(
      [{ troop: 'xianzhen', level: 4, col: 4, row: 2 }],
      [{ troop: 'baima', level: 4, col: 4, row: 2 }],
      mulberry32(82)
    );
    let baimaShots = 0;
    let reflected = 0;
    for (let i = 0; i < 900 && !b.over; i++) {
      for (const e of b.step(CONFIG.combat.step)) {
        if (e.t !== 'attack') continue;
        if (e.actor === b.entities.find((x) => x.troop === 'baima').uid) baimaShots++;
        if (e.counterAttack && b.byUid[e.actor].troop === 'xianzhen') reflected++;
      }
    }
    ok(baimaShots > 0, `白马义从至少射出 ${baimaShots} 箭（远程伤害）`);
    ok(reflected === 0, '陷阵营不对白马义从的远程伤害触发反击 / 反弹');
  }

  // ---- 青竹弓手：射速更快、单发伤害下调 ----
  {
    const b = createArenaBattle(
      [{ troop: 'qingzhu', level: 1, col: 0, row: 2 }],
      [{ troop: 'shield', level: 1, col: 4, row: 2 }],
      mulberry32(91)
    );
    const q = b.entities.find((e) => e.troop === 'qingzhu');
    ok(q.interval < CONFIG.combat.intervals.archer && q.atk < statsFor('qingzhu', 1).atk,
      '竹弓疾射：射速更快、单发伤害下调');
    ok(troopById('qingzhu').base.atk === Math.round(25 * 1.23 * 0.85 * 10) / 10,
      '丹阳青竹弓手：稀有倍率 1.23 的基础上单兵攻击再压 15%（面板不另砍）');
  }

  // ---- 弓兵整体攻速削弱（射程太强，攻击间隔从 1.8 拉到 2.25 秒） ----
  {
    ok(CONFIG.combat.intervals.archer >= 2.2 && CONFIG.combat.intervals.archer <= 2.4,
      `弓兵攻击间隔 ${CONFIG.combat.intervals.archer} 秒（≥ 2.2，整体射速下调）`);
    ok(combatTraits('qingzhu', 1).intervalMult === 0.75, '青竹弓手仍然比普通弓兵快 33%（相对优势没丢）');
  }
}

console.log('\n== 阵亡立即消失 ==');
{
  const uiGame = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {},
  };
  const b = new BattleScreen(uiGame, 1);
  const dead = b.battle.entities.find((e) => e.alive);
  dead.alive = false;
  b.vis[dead.uid] = { action: 'hit', t: 0.1, phase: 0 };
  b.handle([{ t: 'death', uid: dead.uid, troop: dead.troop, level: dead.level, side: dead.side }]);
  ok(b.vis[dead.uid] === undefined, '阵亡当帧清掉渲染状态，不再保留尸体计时');
  ok(CONFIG.battle.corpseFade === undefined && CONFIG.battle.deathAnimTime === undefined,
    '不再保留尸体淡出 / 倒地动画配置');
}

console.log('\n== 布阵 ==');
{
  ok(formationSize() === 25, '布阵一共 25 格（5×5）');
  const placed = autoPlaceSquads([
    { uid: 's', troop: 'shield' },
    { uid: 'a1', troop: 'archer' },
    { uid: 'c', troop: 'cavalry' },
    { uid: 'a2', troop: 'archer' },
  ]);
  ok(placed.length === 4, '4 个单位都排进去了');
  const spots = new Set(placed.map((p) => `${p.col},${p.row}`));
  ok(spots.size === placed.length, '不会重叠占格');
  const meleeCols = placed.filter((p) => p.troop !== 'archer').map((p) => p.col);
  const archerCols = placed.filter((p) => p.troop === 'archer').map((p) => p.col);
  ok(Math.min(...meleeCols) > Math.max(...archerCols), '近战站前排、弓兵站后排');
  {
    const bmPlaced = autoPlaceSquads([{ uid: 'c', troop: 'cavalry' }, { uid: 'b', troop: 'baima' }]);
    const bmSpot = bmPlaced.find((p) => p.troop === 'baima');
    const cavSpot = bmPlaced.find((p) => p.troop === 'cavalry');
    ok(bmSpot.col === 2 && bmSpot.col < cavSpot.col,
      `白马义从按后排（col${bmSpot.col}），普通骑兵仍在前排（col${cavSpot.col}）`);
  }

  const many = Array.from({ length: 30 }, (_, i) => ({ uid: `m${i}`, troop: 'shield' }));
  ok(autoPlaceSquads(many).length === 25, '最多只能放 25 个单位');

  const units = [{ id: 'u1', troop: 'shield', level: 2 }, { id: 'u2', troop: 'archer', level: 1 }];
  const raw = new Array(25).fill(null);
  raw[0] = 'u1';
  raw[1] = 'u1';        // 重复
  raw[9] = 'ghost';     // 不存在
  raw[12] = 'u2';
  const clean = sanitizeFormation(raw, units);
  ok(clean.length === 25 && clean[0] === 'u1' && clean[1] === null && clean[9] === null, '布阵清洗：去重 + 去掉已不存在的单位');
  ok(clean[12] === 'u2', '合法单位保留在原格');

  const st = createNewState();
  const form = activeFormation(st);
  ok(form.length === 4, '初始 4 个单位自动上阵');
  ok(form.every((f) => formationCell(f.col + f.row * 5).col === f.col), '布阵格坐标换算一致');
  ok(undeployedUnits(st).length === 0, '开局 4 个单位都已上阵 → 未上阵列表为空');
  // 撤下一个（拖回下方）+ 新增一个 → 未上阵列表里正好 2 张兵牌
  const firstUid = form[0].uid;
  st.formation[st.formation.indexOf(firstUid)] = null;
  st.units.push({ id: 'pend', troop: 'spear', level: 2 });
  const pool = undeployedUnits(st);
  ok(pool.length === 2 && pool.every((u) => !st.formation.includes(u.id)), '未上阵列表只包含没上阵的单位');
  ok(pool.some((u) => u.id === firstUid), '撤下的单位回到未上阵列表');
}

console.log('\n== 每日任务 / 签到 / 7 日登录 ==');
{
  const day1 = new Date(2026, 10, 3, 10, 0, 0).getTime();
  const day2 = new Date(2026, 10, 4, 10, 0, 0).getTime();
  ok(dateKey(day1) === '2026-11-03' && dateKey(day2) === '2026-11-04', 'dateKey 按本地日期切天（YYYY-MM-DD）');

  const st = createNewState();
  st.maxCleared = 29;
  ok(!dailyUnlocked(st), '通关 29 关时每日系统未解锁');
  noteClear(st, day1);
  ok(taskProgress(st, 'clear', day1) === 0, '未解锁时通关不计入每日任务');
  st.maxCleared = 30;
  ok(dailyUnlocked(st), '通关 30 关解锁每日系统（每日任务 / 签到 / 7 日登录）');

  const d = ensureDaily(st, day1);
  ok(d.day === '2026-11-03' && d.clears === 0 && d.signed === false, '首次进入生成当天记录');
  noteClear(st, day1);
  noteClear(st, day1);
  noteMerge(st, 2, day1);
  noteChestOpened(st, 1, day1);
  ok(taskProgress(st, 'clear', day1) === 2 && taskProgress(st, 'merge', day1) === 2
    && taskProgress(st, 'open', day1) === 1, '通关 / 合成 / 开箱分别累计进度');

  for (let i = 0; i < 8; i++) noteClear(st, day1);
  const clearTask = CONFIG.daily.tasks.find((t) => t.id === 'clear');
  ok(taskState(st, clearTask, day1).claimable && taskState(st, clearTask, day1).progress === 10,
    '通关 10 关后每日任务可领取');
  const r = claimTask(st, 'clear', day1);
  ok(r.ok && r.chest === 'rare' && chestCount(st, 'rare') === 1, '领取「通关 10 关」→ 稀有宝箱 ×1');
  ok(taskState(st, clearTask, day1).claimed && !taskState(st, clearTask, day1).claimable,
    '任务领过就不能再领');
  ok(claimTask(st, 'clear', day1).reason === 'claimed', '重复领取返回 claimed');
  ok(claimTask(st, 'merge', day1).reason === 'progress', '进度没满的任务不能领');

  st.daily.loginDays = 2;
  const nd = ensureDaily(st, day2);
  ok(nd.day === '2026-11-04' && nd.clears === 0 && nd.merges === 0 && nd.chests === 0
    && nd.signed === false && nd.claimed.length === 0, '跨天后每日进度 / 签到 / 已领任务重置');
  ok(nd.loginDays === 2, '7 日登录累计天数跨天不清零');

  // 签到
  const st2 = createNewState();
  st2.maxCleared = 30;
  const lowSt = createNewState();
  lowSt.maxCleared = 10;
  ok(signIn(lowSt, day1).reason === 'locked', '未通关 30 关不能签到');
  const s1 = signIn(st2, day1);
  ok(s1.ok && s1.chest === 'rare' && chestCount(st2, 'rare') === 1, '每日签到送稀有宝箱 ×1');
  ok(signIn(st2, day1).reason === 'signed', '同一天只能签到一次');
  ok(signIn(st2, day2).ok, '第二天跨天后可以继续签到');
  const signTask = CONFIG.daily.tasks.find((t) => t.id === 'sign');
  ok(!taskState(st2, signTask, day2).claimable && taskState(st2, signTask, day2).claimed,
    '签到自动完成签到任务（不重复发奖）');

  // 合成成功后自动累计每日任务进度
  const mst = createNewState();
  mst.maxCleared = 50;
  const u0 = mst.units[0];
  mst.units.push({ id: 'mm', troop: u0.troop, level: u0.level });
  ok(mergeUnits(mst, u0.id, 'mm').ok, '合成成功（用于每日任务计数）');
  ok(taskProgress(mst, 'merge') >= 1, '合成后自动累计「合成 3 个兵种」进度');

  // 7 日登录（新版 7 天：宝箱 / 铜钱 / 英雄 / 单位）
  const st3 = createNewState();
  st3.maxCleared = 50;
  const days = login7Days();
  ok(days.length === 7, '7 日登录一共 7 天（通关 30 关解锁）');
  ok(days[0].kind === 'chest' && days[0].chest === 'epic', '第 1 天 = 史诗宝箱');
  ok(days[1].kind === 'chest' && days[1].chest === 'legendary' && days[1].n === 1, '第 2 天 = 传奇宝箱 ×1');
  ok(days[2].kind === 'hero' && days[2].hero === 'huanggai', '第 3 天 = 黄盖');
  ok(days[3].kind === 'coins' && days[3].coins === 100000, '第 4 天 = 10 万铜钱');
  ok(days[4].kind === 'chest' && days[4].chest === 'legendary' && days[4].n === 3, '第 5 天 = 传奇宝箱 ×3');
  ok(days[5].kind === 'unit' && days[5].troop === 'baima' && days[5].level === 6, '第 6 天 = 6 级白马义从');
  ok(days[6].kind === 'hero' && days[6].hero === 'zhangfei', '第 7 天 = 张飞');

  ok(canClaimLogin(st3, day1) && nextLoginDay(st3, day1).index === 0, '第 1 天奖励可领');
  const r1 = claimLoginDay(st3, day1);
  ok(r1.ok && r1.index === 0 && chestCount(st3, 'epic') === 1, '领取第 1 天：史诗宝箱 ×1 入仓');
  ok(!canClaimLogin(st3, day1) && nextLoginDay(st3, day1).claimedToday, '同一天只能领 1 天');
  const again = claimLoginDay(st3, day1);
  ok(!again.ok && again.reason === 'today' && st3.daily.loginDays === 1, '重复领取被拒绝且不推进天数');

  // 漏登不重置：隔了几天再来，仍从第 2 天顺延
  const r2 = claimLoginDay(st3, new Date(2026, 10, 7, 10).getTime());
  ok(r2.ok && r2.index === 1 && chestCount(st3, 'legendary') === 1,
    '漏登不重置：隔天回来顺延领第 2 天传奇宝箱');
  const r3 = claimLoginDay(st3, new Date(2026, 10, 8, 10).getTime());
  ok(r3.ok && r3.index === 2 && st3.heroes.huanggai === 1, '第 3 天：黄盖直接加入英雄列表');
  const r4 = claimLoginDay(st3, new Date(2026, 10, 9, 10).getTime());
  ok(r4.ok && r4.index === 3 && r4.coins === 100000, '第 4 天：10 万铜钱入账');
  const r5 = claimLoginDay(st3, new Date(2026, 10, 10, 10).getTime());
  ok(r5.ok && chestCount(st3, 'legendary') === 4, '第 5 天：传奇宝箱 ×3（累计 4 个）');
  const r6 = claimLoginDay(st3, new Date(2026, 10, 11, 10).getTime());
  ok(r6.ok && r6.unit && r6.unit.troop === 'baima' && r6.unit.level === 6,
    '第 6 天：6 级白马义从直接入营');
  const r7 = claimLoginDay(st3, new Date(2026, 10, 12, 10).getTime());
  ok(r7.ok && st3.heroes.zhangfei === 1, '第 7 天：张飞直接加入英雄列表');
  ok(st3.daily.loginDays === 7 && nextLoginDay(st3, day2) === null, '7 天全部领完后不再刷新');

  // 已拥有的英雄再领：折算 3 万铜钱，等级不变
  const dupSt = createNewState();
  dupSt.maxCleared = 50;
  dupSt.heroes = { huanggai: 5 };
  claimLoginDay(dupSt, day1);
  claimLoginDay(dupSt, day2);
  const coinsBefore = dupSt.coins;
  const rd = claimLoginDay(dupSt, new Date(2026, 10, 8, 10).getTime());
  ok(rd.ok && rd.duplicate && dupSt.coins === coinsBefore + 30000 && dupSt.heroes.huanggai === 5,
    '已拥有英雄折算 3 万铜钱（等级不变）');

  const fullSt = createNewState();
  fullSt.maxCleared = 50;
  while (fullSt.units.length < 300) fullSt.units.push({ id: `f${fullSt.units.length}`, troop: 'shield', level: 1 });
  for (let i = 1; i <= 5; i++) claimLoginDay(fullSt, new Date(2026, 10, 2 + i, 10).getTime());
  const rFull = claimLoginDay(fullSt, new Date(2026, 10, 2 + 6, 10).getTime());
  ok(!rFull.ok && rFull.reason === 'full' && fullSt.daily.loginDays === 5,
    '兵营满时第 6 天单位不消耗天数（腾出格子还能领）');
}

console.log('\n== 分享得宝箱 ==');
{
  // 奖励分档：前 200 关黄金箱、200 关起史诗箱
  ok(shareRewardFor(0) === 'gold' && shareRewardFor(199) === 'gold', '未到 200 关分享送黄金箱');
  ok(shareRewardFor(200) === 'epic' && shareRewardFor(800) === 'epic', '200 关起分享送史诗箱');

  const day1 = new Date(2026, 10, 16, 10).getTime();
  const st = createNewState();
  st.maxCleared = 30;
  const r1 = claimShareReward(st, day1);
  ok(r1.ok && r1.chest === 'gold' && r1.left === 1 && chestCount(st, 'gold') === 1,
    '第 1 次分享：黄金箱 ×1 入仓，今天还剩 1 次');
  const r2 = claimShareReward(st, day1);
  ok(r2.ok && r2.left === 0 && sharesLeft(st, day1) === 0, '第 2 次分享后额度用完');
  const r3 = claimShareReward(st, day1);
  ok(!r3.ok && r3.reason === 'limit' && chestCount(st, 'gold') === 2, '同一天第 3 次不发放');
  const day2 = day1 + 24 * 3600 * 1000;
  ok(sharesLeft(st, day2) === SHARE_DAILY_LIMIT && claimShareReward(st, day2).ok,
    '跨天（按北京时间切天）后额度恢复 2 次');

  const st2 = createNewState();
  st2.maxCleared = 260;
  const epic = claimShareReward(st2, day1);
  ok(epic.ok && epic.chest === 'epic' && chestCount(st2, 'epic') === 1, '200 关后分享：史诗箱 ×1 入仓');

  // 结算页分享按钮：不与既有按钮重叠，点击点开分享面板即发奖（微信无 success 回调）
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const shareCalls = [];
  const stR = createNewState();
  stR.maxCleared = 30;
  const stubGame = {
    state: stR, msgs: [], saveCalled: 0,
    toast(m) { this.msgs.push(m); },
    save() { this.saveCalled += 1; },
    platform: { share(opts) { shareCalls.push(opts); } },
  };
  const winR = new ResultScreen(stubGame, { win: true, levelN: 30, stats: [], chests: [] });
  const loseR = new ResultScreen(stubGame, { win: false, levelN: 30, stats: [], chests: [] });
  for (const r of [winR, loseR]) {
    const others = [r.primary, r.tertiary, ...(r.secondary ? [r.secondary] : [])];
    ok(others.every((b) => !overlap(r.shareRect, b)),
      `分享按钮与底部主按钮不重叠（${r.d.win ? '胜利' : '失败'}页）`);
    ok(r.shareRect.w === 400 && r.shareRect.h === 96,
      `分享按钮与主按钮同尺寸 400×96（${r.d.win ? '胜利' : '失败'}页）`);
  }
  ok(loseR.secondary === null, '战败页不再有广告次按钮（原广告位并入分享按钮）');
  const cx = winR.shareRect.x + winR.shareRect.w / 2;
  const cy = winR.shareRect.y + winR.shareRect.h / 2;
  winR.tap(cx, cy);
  ok(shareCalls.length === 1, '点击分享按钮调起平台分享');
  ok(chestCount(stR, 'gold') === 1 && stR.daily.shares === 1 && stubGame.saveCalled === 1,
    '点开分享面板即发奖：黄金箱入仓 + 当日计数 +1 + 存档');
  ok(stubGame.msgs.some((m) => m.includes('已打开分享面板')), '提示已打开分享面板且宝箱入仓');
  winR.tap(cx, cy);
  ok(chestCount(stR, 'gold') === 2 && stR.daily.shares === 2 && shareCalls.length === 2, '第 2 次分享：额度用满');
  winR.tap(cx, cy);
  ok(shareCalls.length === 2 && stubGame.msgs.some((m) => m.includes('已领完')),
    '第 3 次点击不再调起分享，提示今日已领完');
  // 战败页：点原广告按钮位（现为分享按钮）同样点开面板即发奖
  const stL = createNewState();
  stL.maxCleared = 30;
  const loseGame = {
    state: stL, msgs: [], saveCalled: 0,
    toast(m) { this.msgs.push(m); },
    save() { this.saveCalled += 1; },
    platform: { share(opts) { shareCalls.push(opts); } },
  };
  const loseR2 = new ResultScreen(loseGame, { win: false, levelN: 30, stats: [], chests: [] });
  loseR2.tap(loseR2.shareRect.x + loseR2.shareRect.w / 2, loseR2.shareRect.y + loseR2.shareRect.h / 2);
  ok(shareCalls.length === 3 && chestCount(stL, 'gold') === 1 && stL.daily.shares === 1,
    '战败页点分享：点开面板即发奖');
}

console.log('\n== 战斗力评定 / 本局最佳统计 ==');
{
  const p = (id, lv = 1) => troopPower(id, lv);
  ok(p('shield', 10) > p('shield', 5) && p('shield', 5) > p('shield', 1), '战力随等级上升（同一个兵种越高级越强）');
  ok(p('daji', 1) > p('baier', 1) && p('baier', 1) > p('qingzhou', 1) && p('qingzhou', 1) > p('spear', 1),
    '同线战力：传奇 > 史诗 > 稀有 > 普通（单兵口径）');
  // 战力是「整支小队」口径：普通兵 Lv7 有 6 个兵，人数会把小队总战力拉高（单兵口径见 duel）
  ok(p('daji', 1) > p('spear', 3), '1 级传奇小队战力高于 3 级普通兵小队（人数越多总战力越高）');
  ok(unitPower({ troop: 'daji', level: 1 }) === p('daji', 1), '单位战力按「兵种 + 等级」推导');
  ok(sumPower([{ troop: 'daji', level: 1 }, { troop: 'shield', level: 1 }])
    === p('daji', 1) + p('shield', 1), '多支小队的战力可以累加（布阵页 / 开战顶栏共用）');
  ok(formatPower(12345) === '12,345' && formatPower(0) === '0' && formatPower(999) === '999',
    '战力显示带千分位（小游戏端不依赖 toLocaleString）');
  ok(formatPower(p('daji', 1)).includes(','), `传奇 Lv1 战力 ${formatPower(p('daji', 1))}（带千分位）`);
  {
    const good = comparePower(1200, 1000);
    const bad = comparePower(800, 1000);
    const even = comparePower(1000, 1000);
    ok(good.label === '优势' && good.ratioText === '1.20×', '战力对比：1.20× 优势');
    ok(bad.label === '劣势' && bad.ratioText === '0.80×', '战力对比：0.80× 劣势');
    ok(even.label === '势均力敌' && even.tone === 'even', '战力对比：同战力 = 势均力敌');
  }

  // ---- 本局最佳：按小队统计输出 / 承伤 / 击倒 ----
  const summary = simulateArena(
    [{ troop: 'daji', level: 1, col: 2, row: 2 }],
    [{ troop: 'shield', level: 1, col: 2, row: 2 }],
    mulberry32(101)
  );
  const mine = summary.stats.filter((s) => s.side === 'player');
  const foe = summary.stats.filter((s) => s.side === 'enemy');
  const totalDealt = summary.stats.reduce((n, s) => n + s.dealt, 0);
  const totalTaken = summary.stats.reduce((n, s) => n + s.taken, 0);
  ok(mine.length === 1 && foe.length === 1, '本局最佳按小队记录（我方 1 支 / 敌方 1 支）');
  ok(mine[0].troop === 'daji' && foe[0].troop === 'shield' && mine[0].level === 1,
    '本局最佳带兵种 / 等级，胜利页能直接显示名字');
  ok(totalDealt > 0 && totalDealt === totalTaken, `输出与承伤守恒（${totalDealt} = ${totalTaken}）`);
  ok(totalDealt < 100000, '输出按实际打掉的血量累计（不会因为超杀把数字吹爆）');
  ok(summary.stats.reduce((n, s) => n + s.kills, 0) > 0, '击倒数被记录');
  ok(mine[0].dealt > 0 && foe[0].taken > 0, '我方输出 > 0、敌方承伤 > 0（对应关系正确）');
}

console.log('\n== 声音系统 ==');
{
  const played = [];
  const bgm = [];
  const created = [];
  const paused = [];
  const playing = new Set();
  const volumes = new Map();
  const errors = new Map();
  const mainSrc = CONFIG.audio.bgm.main.src;
  const shopSrc = CONFIG.audio.bgm.shop.src;
  let playerSeq = 0;
  const backend = {
    createSound: (src) => ({
      play: (v) => played.push({ src, v }),
      stop() {}, setVolume() {}, destroy() {},
    }),
    createMusic: (src) => {
      const id = ++playerSeq;
      created.push({ id, src });
      return {
        play: () => { playing.add(id); bgm.push(src); },
        pause: () => { playing.delete(id); paused.push(src); },
        setVolume: (v) => { volumes.set(id, v); },
        destroy: () => { playing.delete(id); volumes.delete(id); },
        onError: (cb) => { errors.set(src, cb); },
      };
    },
  };
  initAudio(backend, { enabled: true, bgmVolume: 0.5, sfxVolume: 0.8 });
  ok(bgm.length === 0, '初始化时不自动播放 BGM（由页面场景决定）');
  startBgm('main');
  ok(bgm.length === 0 && created.length === 0 && audioState().desiredKind === 'main'
    && audioState().hasGesture === false,
    '没有用户手势时 startBgm 只记录场景、不创建播放器、不播放');
  // 后台/前台切换也不能绕过手势门禁
  suspendForVisibility();
  resumeForVisibility();
  ok(bgm.length === 0 && created.length === 0, '未解锁手势时即使页面恢复可见也不起播');
  unlockAudio();
  const mainId = created[0].id;
  ok(bgm.length === 1 && bgm[0] === mainSrc && audioState().desiredKind === 'main'
    && audioState().hasGesture === true,
    `用户第一次手势后才补播主 BGM《战争进化史》（${mainSrc}）`);
  startBgm('shop');
  const shopId = created[1].id;
  ok(bgm[1] === shopSrc && audioState().desiredKind === 'shop',
    `商城内切换为英雄主题循环（${shopSrc}）`);
  ok(paused.includes(mainSrc) && !playing.has(mainId) && volumes.get(mainId) === 0,
    '进商城时主 BGM 被暂停并静音（不会和商城 BGM 同时响）');
  ok(playing.has(shopId) && volumes.get(shopId) === 0.5 && playing.size === 1,
    '商城里只有商城 BGM 在响');
  startBgm('main');
  ok(bgm[bgm.length - 1] === mainSrc
    && audioState().tracks.length === 2 && created.length === 2,
    '从商城回首页复用缓存的主 BGM（不重新创建、不打断）');
  ok(paused.includes(shopSrc) && !playing.has(shopId) && volumes.get(shopId) === 0,
    '离开商城时商城 BGM 被暂停并静音');
  ok(playing.has(mainId) && volumes.get(mainId) === 0.5 && playing.size === 1,
    '主页面只有主 BGM 在响');
  // 页面 hidden / pagehide：淡出并暂停；恢复可见后（已有手势）再续播
  suspendForVisibility();
  ok(playing.size === 0 && paused.includes(mainSrc) && volumes.get(mainId) === 0,
    '页面切后台时 BGM 淡出并暂停');
  resumeForVisibility();
  ok(playing.size === 1 && playing.has(mainId) && volumes.get(mainId) === 0.5,
    '页面恢复可见且已有手势时 BGM 续播');
  ok(audioState().hasMusic && !audioState().usingFallback, '主 BGM 当前用真实曲目');
  // 模拟真实主曲文件不存在 / 解码失败 → 同一条主轨换成英雄主题循环
  const mainErr = errors.get(mainSrc);
  if (mainErr) mainErr();
  const fallbackId = created[2].id;
  ok(created.some((c) => c.src === CONFIG.audio.bgm.main.fallback) && audioState().usingFallback,
    '主 BGM 缺失时自动退回到英雄主题循环（不切到商城轨）');

  setBgmVolume(0.35);
  setSfxVolume(0.4);
  ok(audioState().bgmVolume === 0.35 && audioState().sfxVolume === 0.4,
    'BGM / 音效音量可以分别调整');
  ok(volumes.get(fallbackId) === 0.35 && volumes.get(shopId) === 0,
    '调 BGM 音量只作用于当前场景，商城轨保持静音');
  playSfx('merge');
  ok(played.some((p) => p.src === CONFIG.audio.sounds.merge), '合成音效走配置里的文件路径');
  const beforeMute = played.length;
  setAudioEnabled(false);
  ok(isAudioEnabled() === false && playing.size === 0, '关闭声音后 BGM 暂停、音效不再播放');
  playSfx('merge');
  ok(played.length === beforeMute, '关闭声音后不再播放音效');
  setAudioEnabled(true);
  ok(isAudioEnabled() === true && bgm.length >= 4, '重新开启声音会恢复当前场景 BGM');
  ok(playing.size === 1 && playing.has(fallbackId) && volumes.get(fallbackId) === 0.35,
    '恢复后只播放当前主 BGM，音量沿用上次设置');
  startBgm('shop');
  ok(audioState().desiredKind === 'shop'
    && bgm[bgm.length - 1] === shopSrc
    && !playing.has(fallbackId) && volumes.get(fallbackId) === 0,
    '再次进商城复用缓存，从上次暂停处继续，并静音主 BGM');

  // 没有音频后端（无头环境 / 不支持音频）时全部静默，不报错
  initAudio(null, { enabled: true });
  playSfx('tap');
  ok(audioState().hasBackend === false, '没有平台音频后端时静默且不崩溃');
  destroyAudio();
}

console.log('\n== 演武 / 先登绕后 ==');
{
  ok(TRIALS.length === CONFIG.trials.total && TRIALS.length === 200,
    '演武共 200 关（手写 50 + 对标主线生成 150）');
  ok(TRIALS.every((t) => t.enemies.length >= 3
    && t.enemies.every((e) => rarityOf(e.troop) !== 'common')),
    '演武敌方全部是特殊兵种（没有普通兵）');
  ok(TRIALS.slice(4).every((t) => t.enemies.some((e) => rarityOf(e.troop) === 'legendary')),
    '第 5 关起每关至少 1 个传奇兵种');
  ok(TRIALS[24].enemies.length === 12
    && new Set(TRIALS[24].enemies.map((e) => e.troop)).size === 12,
    '第 25 关 = 12 个特殊兵种全员上阵');
  ok(TRIALS.slice(0, 50).every((t) => t.enemies.filter((e) => rarityOf(e.troop) === 'legendary')
    .every((e) => e.level <= 5)),
    '手写 1~50 关：传奇卡全部压到 Lv5 以内');
  ok(TRIALS.slice(0, 5).every((t) => t.enemies.filter((e) => rarityOf(e.troop) === 'legendary')
    .every((e) => e.level <= 4)) && TRIALS[5].enemies.length >= 6,
    '前 5 关传奇 ≤ Lv4；第 6 关起小队数 ≥ 6（用数量承担难度）');
  ok(TRIALS.every((t) => t.enemies.length >= 4) && TRIALS[12].enemies.length >= 8,
    '演武小队数整体上调（第 1 关 ≥4、第 13 关 ≥8）');
  // 难度再降一档：非传奇最高 Lv7，中后段战力明显下移且没有陡升节点
  // 第一章（1~25）非传奇封顶 Lv7；第二章（26~50）平滑升到 Lv9+（mix 拆分台阶）
  ok(TRIALS.slice(0, 25).every((t) => t.enemies.every((e) => e.level <= 7)),
    '演武第一章非传奇等级封顶 Lv7');
  ok(TRIALS.slice(25).every((t) => t.enemies.every((e) => e.level <= 10)),
    '演武第二章非传奇等级不超过 Lv10');
  ok(TRIALS.length === 200 && TRIALS.every((t) => t.enemies.length >= 3)
    && trialUnlockLevel(200) === 2600 && trialMainLevel(1) === 150
    && trialUnlockLevel(50) === trialMainLevel(50),
  '演武 200 关按关号对标主线 150 → 2600，解锁进度与难度同步');
  {
    // 51~200 关由 statMult / difficulty 校准，战力统一按「有效战力」口径比较
    const powers = TRIALS.map((t) => t.enemies.reduce((s, e) => s + troopPower(e.troop, e.level), 0)
      * (t.difficulty || 1));
    const jumps = powers.slice(1).map((p, i) => p / powers[i] - 1);
    ok(Math.max(...jumps.slice(0, 25)) < 0.35,
      `第一章相邻关最大涨幅 ${(Math.max(...jumps.slice(0, 25)) * 100).toFixed(1)}%（<35%）`);
    ok(Math.max(...jumps.slice(14, 24)) < 0.20,
      `第 15~25 关最大涨幅 ${(Math.max(...jumps.slice(14, 24)) * 100).toFixed(1)}%（<20%，中后段平滑）`);
    ok(powers[9] < 20000 && powers[14] < 33000 && powers[19] < 43000 && powers[24] < 55000,
      `中后段战力下移：第 10/15/20/25 关 = ${Math.round(powers[9])}/${Math.round(powers[14])}/${Math.round(powers[19])}/${Math.round(powers[24])}`);
    // 25 关内每关都至少要比上一关更接近 Boss（允许 ±10% 的小回落，不允许掉档）
    ok(powers.slice(0, 25).every((p, i) => i === 0 || p >= powers[i - 1] * 0.9),
      '演武第一章战力整体递增（允许小幅回落，不会越往后越简单）');
    // 26 关接续 25 关不掉档，26~200 关平滑递增（每条腿的混编台阶 <22%）
    ok(powers[25] >= powers[24] * 0.95,
      `第二章第 26 关与第一章第 25 关衔接（${Math.round(powers[24])} → ${Math.round(powers[25])}）`);
    ok(powers.slice(25).every((p, i) => i === 0 || p >= powers[24 + i] * 0.95),
      '第 26~200 关有效战力单调递增（允许 5% 混编回落）');
    ok(Math.max(...jumps.slice(25)) < 0.22,
      `第 26~200 关相邻关最大涨幅 ${(Math.max(...jumps.slice(25)) * 100).toFixed(1)}%（<22%）`);
    // 新增 150 关：严格单调平滑，终点与主线 2600 终章等强
    ok(powers.slice(50).every((p, i) => i === 0 || p >= powers[49 + i]),
      '生成段 51~200 关严格单调递增（无难度回落）');
    const endMain = levelDef(2600);
    const endPower = endMain.enemies.reduce((s, e) => s + troopPower(e.troop, e.level), 0)
      * (endMain.difficulty || 1);
    ok(Math.abs(powers[199] / endPower - 1) < 0.02,
      `演武第 200 关有效战力 ${Math.round(powers[199])} ≈ 主线 2600 终章 ${Math.round(endPower)}`);
  }
  ok(trialUnlockLevel(1) === 150 && trialUnlockLevel(25) === trialMainLevel(25),
    '演武第 1 关 150 关解锁，第 25 关按对标主线关号解锁');
  ok(!trialUnlocked(1, 149, 0) && trialUnlocked(1, 150, 0), '演武解锁看主线 150 关');
  const lv2 = trialUnlockLevel(2);
  ok(!trialUnlocked(2, lv2, 0) && trialUnlocked(2, lv2, 1), '下一关还需要上一关已通关');

  const b = createArenaBattle(
    [{ troop: 'xiandeng', level: 1, col: 4, row: 2 }],
    [{ troop: 'shield', level: 1, col: 2, row: 2 }],
    mulberry32(5)
  );
  const x = b.entities.find((e) => e.troop === 'xiandeng');
  ok(x.teleport && x.teleport.at === CONFIG.combat.xiandengTeleport.delay,
    '先登死士带「开战 1 秒绕后」标记');
  const y0 = x.y;
  for (let i = 0; i < 31; i++) b.step(CONFIG.combat.step);
  ok(x.teleport.done && x.y < CONFIG.formation.enemyFrontY && x.y < y0,
    `先登死士 1 秒后从 ${y0.toFixed(1)} 行绕到敌方半场身后（y=${x.y.toFixed(1)}）`);
}

console.log('\n== 演武奖励 / 自动战斗解锁 / 广告奖励 ==');
{
  // 演武：前 25 关每关 1 个黄金宝箱（金箱）；10 / 20 / 25 关额外传奇宝箱
  const st = createNewState();
  st.chests = {};
  st.trialCleared = 0;
  for (let i = 1; i <= 25; i++) grantTrialRewards(st, i);
  ok(chestCount(st, 'gold') === 25, `演武前 25 关每关 1 个黄金宝箱（实测 ${chestCount(st, 'gold')}）`);
  ok(chestCount(st, 'legendary') === 3,
    `演武 10 / 20 / 25 关各 1 个传奇宝箱（实测 ${chestCount(st, 'legendary')}）`);
  ok(st.trialCleared === 25, '演武通关进度更新到 25');
  // 稳定收益：重复挑战不再发宝箱，但每次都给铜钱
  ok(trialClearCoins(1) > 0 && trialClearCoins(25) >= trialClearCoins(1),
    `演武每次通关给铜钱：第 1 关 +${trialClearCoins(1)} / 第 25 关 +${trialClearCoins(25)}`);
  const coinsBeforeRepeat = st.coins;
  const again = grantTrialRewards(st, 12);
  ok(again.length === 0 && chestCount(st, 'gold') === 25 && chestCount(st, 'legendary') === 3,
    '重复挑战已通关的演武关不再发奖');
  ok(st.coins - coinsBeforeRepeat === trialClearCoins(12),
    `重复挑战仍发放稳定铜钱 +${st.coins - coinsBeforeRepeat}`);

  const one = createNewState();
  one.chests = {};
  const first = grantTrialRewards(one, 1);
  ok(first.length === 1 && first[0].id === 'gold' && first[0].count === 1,
    '演武第 1 关首通只发 1 个金箱');
  const ten = grantTrialRewards(one, 10);
  ok(ten.length === 2 && ten.map((r) => r.id).join() === 'gold,legendary' && one.trialCleared === 10,
    '演武第 10 关首通 = 金箱 + 传奇宝箱');

  // 自动战斗：主线第 3 关开放
  const s2 = createNewState();
  s2.maxCleared = 2;
  const s3 = createNewState();
  s3.maxCleared = 3;
  ok(!autoBattleUnlocked(s2) && autoBattleUnlocked(s3), '自动战斗第 2 关锁定、第 3 关开放');
  ok(CONFIG.autoBattle.unlockLevel === 3, '自动战斗解锁关卡配置 = 3');

  // 广告：失败页铜钱（1~200 关 2000 / 201~400 关 4000），每日 10 次独立额度
  const now = new Date(2026, 10, 4, 15, 0, 0).getTime();
  ok(CONFIG.ads.coinLimit === 10, '失败页广告铜钱每日独立 10 次');
  const low = createNewState();
  low.coins = 0;
  const a1 = claimAdCoins(low, 200, now);
  ok(a1.ok && a1.amount === 2000 && low.coins === 2000 && a1.left === 9,
    `第 200 关失败看广告 +2000 铜钱（剩 ${a1.left} 次）`);
  const high = createNewState();
  high.coins = 0;
  const a2 = claimAdCoins(high, 201, now);
  ok(a2.ok && a2.amount === 4000 && high.coins === 4000, '第 201 关失败看广告 +4000 铜钱');
  ok(adCoinReward(200) === 2000 && adCoinReward(400) === 4000,
    '200 关（含）以内 2000 铜钱，201~400 关 4000 铜钱');

  const cap = createNewState();
  cap.coins = 0;
  let claims = 0;
  for (let i = 0; i < 10; i++) if (claimAdCoins(cap, 100, now).ok) claims++;
  const over = claimAdCoins(cap, 100, now);
  ok(claims === 10 && !over.ok && over.reason === 'limit' && cap.coins === 20000 && adsLeft(cap, 'coin', now) === 0,
    '同一天最多领 10 次广告铜钱，第 11 次被拒绝');
  const nextDay = new Date(2026, 10, 5, 15, 0, 0).getTime();
  ok(claimAdCoins(cap, 100, nextDay).ok && cap.coins === 22000, '跨天后铜钱广告次数重置');

  // 商店广告宝箱：小木5次/银箱2次（各自独立额度，与失败页互不干扰）
  const shop = createNewState();
  const w = claimAdChest(shop, 'ad-wood', now);
  ok(w.ok && w.offer.chest === 'wood' && w.offer.count === 1 && chestCount(shop, 'wood') === 1,
    '商店看广告得小木箱 ×1');
  const sv = claimAdChest(shop, 'ad-silver', now);
  ok(sv.ok && sv.offer.chest === 'silver' && chestCount(shop, 'silver') === 1,
    '商店看广告得银箱 ×1');
  ok(!claimAdChest(shop, 'not-exist', now).ok, '未知的广告宝箱 id 不消耗次数');

  const separate = createNewState();
  for (let i = 0; i < 5; i++) claimAdChest(separate, 'ad-wood', now);
  for (let i = 0; i < 2; i++) claimAdChest(separate, 'ad-silver', now);
  ok(!claimAdChest(separate, 'ad-wood', now).ok, '小木用完 5 次后不能再领');
  ok(!claimAdChest(separate, 'ad-silver', now).ok, '银箱用完 2 次后不能再领');
  ok(claimAdCoins(separate, 1, now).ok, '商店额度用完不影响失败页铜钱广告（三通道独立）');
  const resets = ensureAds(separate, nextDay);
  ok(adsLeft(separate, 'coin', nextDay) === 10 && adsLeft(separate, 'shopWood', nextDay) === 5 && adsLeft(separate, 'shopSilver', nextDay) === 2,
    '跨天三个广告通道全部清零重置');
}

console.log('\n== UI 修复（战力 / 英雄紫框 / 两级英雄页 / 竞技场拖动 / 震动 / 重来键） ==');
{
  // 1) 战力不为 0：等级 NaN / 缺失以前会让 statsFor 产出 NaN，最后被 formatPower 显示成 0
  ok(troopPower('shield', NaN) > 0 && troopPower('shield', NaN) === troopPower('shield', 1),
    '等级为 NaN 时战力按 Lv1 计算，不再变成 0');
  ok(troopPower('shield', undefined) === troopPower('shield', 1), '等级缺失时战力按 Lv1 计算');
  const uiGame = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {},
  };
  const b1 = new BattleScreen(uiGame, 1);
  ok(b1.myPower > 0 && b1.enemyPower > 0,
    `第 1 关双方战力非 0（我方 ${b1.myPower} / 敌方 ${b1.enemyPower}）`);
  for (const n of [100, 400]) {
    const b = new BattleScreen(uiGame, n);
    ok(b.myPower > 0 && b.enemyPower > 0, `第 ${n} 关双方战力非 0`);
  }
  for (const t of [TRIALS[0], TRIALS[24]]) {
    const b = new BattleScreen(uiGame, t.stage, Math.random, { trial: t, def: t });
    ok(b.myPower > 0 && b.enemyPower > 0, `演武第 ${t.stage} 关双方战力非 0`);
  }

  // 2) 英雄卡统一史诗紫
  ok(HERO_EPIC_BORDER === CONFIG.rarity.epic.color, '英雄卡边框使用史诗紫（与 CONFIG.rarity.epic 一致）');

  // 3) 英雄页两级：列表 → 点建模 → 详情 → 返回列表
  const hs = new HeroScreen(uiGame);
  ok(hs.detailId === null, '英雄页初始进入列表页');
  const cx = HERO_LAYOUT.cardX0 + HERO_LAYOUT.cardW / 2;
  const cy = HERO_LAYOUT.cardY0 + HERO_LAYOUT.cardH / 2;
  hs.tap(cx, cy);
  ok(hs.detailId === sortHeroesByLevel(uiGame.state)[0].id,
    '点列表第一张卡片（传奇优先）进入该英雄详情页');
  hs.tap(hs.backRect.x + hs.backRect.w / 2, hs.backRect.y + hs.backRect.h / 2);
  ok(hs.detailId === null, '详情页左上角返回英雄列表');

  // 4) 竞技场加长 + 可拖动且有边界
  ok(CONFIG.arena.cols === 30 && CONFIG.arena.rows === 84, '竞技场扩大到 30 格 × 84 格');
  const bd = new BattleScreen(uiGame, 1);
  ok(bd.cam.minX < bd.cam.maxX, '开战后镜头可左右拖动');
  ok(bd.cam.minY < bd.cam.maxY, '开战后镜头可上下拖动');
  panCamera(bd.cam, 4000, 0);
  ok(bd.cam.x <= bd.cam.maxX + 0.01, `向右拖动被边界拦住（x=${bd.cam.x} ≤ ${bd.cam.maxX}）`);
  panCamera(bd.cam, -4000, 0);
  ok(bd.cam.x >= bd.cam.minX - 0.01, `向左拖动被边界拦住（x=${bd.cam.x} ≥ ${bd.cam.minX}）`);
  // 可拖动范围要越过场地边界 ARENA_MARGIN 格：兵被挤到角落时也能拖到屏幕中间（场外画成护坡，不露白）
  const visX = bd.cam.view.w / bd.cam.zoom;
  ok(bd.cam.maxX >= CONFIG.arena.cols - visX / 2 + ARENA_MARGIN - 0.01,
    `相机可越过右边界 ${ARENA_MARGIN} 格（maxX=${bd.cam.maxX.toFixed(2)}）`);
  ok(bd.cam.minX <= visX / 2 - ARENA_MARGIN + 0.01,
    `相机可越过左边界 ${ARENA_MARGIN} 格（minX=${bd.cam.minX.toFixed(2)}）`);

  // 5) 击杀震动并入声音总开关
  const vib = { n: 0 };
  const vibGame = { ...uiGame, platform: { vibrate() { vib.n++; } } };
  setAudioEnabled(false);
  const off = new BattleScreen(vibGame, 400);
  for (let i = 0; i < 1200 && !off.finished; i++) off.update(0.05);
  ok(vib.n === 0, '声音总开关关闭时击杀震动 0 次');
  setAudioEnabled(true);
  vib.n = 0;
  const on = new BattleScreen(vibGame, 400);
  for (let i = 0; i < 1200 && !on.finished; i++) on.update(0.05);
  ok(vib.n > 0, `声音总开关开启时击杀震动触发 ${vib.n} 次`);

  // 6) 重来键在右侧输出面板正下方，不和面板 / 倍速键重叠
  const hud = { x: 750 - 6 - 336, y: ARENA_VIEW.y + 8, w: 336, h: 246 };
  const speedRect = { x: 612, y: 40, w: 110, h: 68 };
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  ok(!overlap(bd.retryRect, hud), '重来键不与右侧输出面板重叠');
  ok(!overlap(bd.retryRect, speedRect), '重来键不与倍速键重叠');
  ok(bd.retryRect.y >= hud.y + hud.h, `重来键在输出面板下方（y=${bd.retryRect.y} ≥ ${hud.y + hud.h}）`);
}

console.log('\n== 存档 ==');
{
  const mem = (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, v),
      removeItem: (k) => m.delete(k),
    };
  })();
  const s = createNewState();
  s.coins = 999;
  s.maxCleared = 5;
  s.units[0].level = 12;
  s.chests = { common: 3 };
  s.daily = {
    day: '2026-11-03', clears: 4, merges: 2, chests: 3, signed: true,
    claimed: ['clear', '不存在的任务'], loginDays: 2, loginDay: '2026-11-03',
  };
  s.idleAt = 1700000000123;
  s.autoBattle = true;
  s.audio = false;
  s.bgmVolume = 0.3;
  s.sfxVolume = 0.6;
  s.seenTroops = ['shield', 'xiandeng'];
  s.trialCleared = 7;
  s.adDay = '2026-11-04';
  s.adCoinCount = 3;
  s.adWoodCount = 1;
  s.adSilverCount = 0;
  const slot = s.formation.indexOf(s.units[1].id);
  ok(saveState(mem, s), '保存成功');
  const loaded = loadState(mem);
  ok(loaded.coins === 999 && loaded.maxCleared === 5 && loaded.units[0].level === 10, '读档完整（单位与铜钱，等级夹到 10 级上限）');
  ok(loaded.formation.length === 25 && loaded.formation.filter(Boolean).length === 4, '读档保留 5×5 布阵（4 个单位）');
  ok(loaded.formation[slot] === s.units[1].id, '布阵位置不变');
  ok(loaded.version === STATE_VERSION && loaded.chests.wood === 3,
    '读档保留宝箱仓库（旧 common 字段自动迁移成小木箱）');
  ok(loaded.daily.clears === 4 && loaded.daily.merges === 2 && loaded.daily.signed === true,
    '读档保留每日任务进度与签到状态');
  ok(loaded.daily.claimed.length === 1 && loaded.daily.claimed[0] === 'clear',
    '每日已领任务只保留已知任务 id');
  ok(loaded.daily.loginDays === 2 && loaded.daily.loginDay === '2026-11-03', '读档保留 7 日登录进度');
  ok(loaded.idleAt === 1700000000123, '读档保留挂机计时点');
  ok(loaded.autoBattle === true, '读档保留自动战斗开关');
  ok(loaded.audio === false, '读档保留声音开关（静音状态）');
  ok(loaded.bgmVolume === 0.3 && loaded.sfxVolume === 0.6, '读档保留 BGM / 音效音量');
  ok(loaded.seenTroops.includes('xiandeng') && loaded.seenTroops.includes('shield'),
    '读档保留兵种首次展示记录');
  ok(loaded.trialCleared === 7, '读档保留演武通关进度');
  ok(loaded.adDay === '2026-11-04' && loaded.adCoinCount === 3 && loaded.adWoodCount === 1,
    '读档保留广告日期与当天三次独立计数');

  mem.setItem('sgxb_save_v1', '{{坏档');
  const bad = loadState(mem);
  ok(bad.coins === CONFIG.economy.startCoins, '坏档自动回退为初始档，不崩溃');

  // 版本迁移：v10 及更早的旧档一律重置为全新开局（不报错、不保留旧资产）
  const oldSave = {
    version: 10,
    coins: 500, maxCleared: 800, heroBattleCleared: 50,
    heroTickets: 14, heroes: { liubei: 20 }, unlockSeen: ['heroBattle'], tutorial: { skipped: true },
    units: [
      { id: 'u1', troop: 'shield', level: 3 },
      { id: 'u2', troop: 'archer', level: 2 },
      { id: 'u3', troop: 'cavalry', level: 1 },
    ],
    lineup: ['u1', 'u2', 'u3'],
    adDay: 123, adCount: 99,
  };
  mem.setItem('sgxb_save_v1', JSON.stringify(oldSave));
  const migrated = loadState(mem);
  const fresh = createNewState();
  ok(migrated.version === fresh.version && migrated.version >= 11,
    `旧档 v10 迁移后存档版本升到 v${migrated.version}`);
  ok(migrated.coins === CONFIG.economy.startCoins && migrated.maxCleared === 0,
    '旧档铜钱与通关进度清零（回到全新开局）');
  ok(migrated.heroTickets === 0 && Object.keys(migrated.heroes || {}).length === 0,
    '旧档招募券与英雄清零（不会出现新档带旧资产）');
  ok(migrated.heroBattleCleared === 0 && (migrated.unlockSeen || []).length === 0,
    '旧档英雄战进度与解锁记录清零');
  ok(migrated.tutorial.skipped === false && Object.keys(migrated.tutorial.seen).length === 0,
    '旧档新手引导已看记录清零（新档重新引导）');
  ok(migrated.formation && migrated.formation.filter(Boolean).length === fresh.formation.filter(Boolean).length
    && migrated.formation.filter(Boolean).length > 0,
    '旧档重置后是标准初始布阵');
  const savedFresh = JSON.parse(mem.getItem('sgxb_save_v1'));
  ok(savedFresh.version === fresh.version && savedFresh.maxCleared === 0,
    '旧档读取后立刻覆写为新档（不会每次进游戏重复迁移）');
}

console.log('\n== 每日商店 ==');
{
  const need = CONFIG.dailyShop.unlockLevel;
  const st = createNewState();
  st.maxCleared = need - 1;
  ok(!dailyShopUnlocked(st), `第 ${need - 1} 关未解锁每日商店`);
  st.maxCleared = need;
  ok(dailyShopUnlocked(st), `第 ${need} 关解锁每日商店`);

  const t1 = new Date('2026-11-04T00:05:00+08:00').getTime();
  const offers1 = dailyShopOffers(st, t1);
  ok(offers1.slots.length === 6, '每天刷新 6 个栏位');
  ok(offers1.slots.slice(0, 4).every((s) => rarityOf(s.troop) === 'rare'), '前 4 个栏位都是稀有兵种');
  ok(offers1.slots.slice(4).every((s) => rarityOf(s.troop) === 'epic'), '后 2 个栏位都是史诗兵种');
  ok(offers1.slots.slice(0, 4).every((s) => s.price === CONFIG.dailyShop.rarePrice), '稀有栏位价格一致');
  ok(offers1.slots.slice(4).every((s) => s.price === CONFIG.dailyShop.epicPrice), '史诗栏位价格一致');
  ok(new Set(offers1.slots.slice(0, 4).map((s) => s.troop)).size === 4, '4 个稀有栏位不重复兵种');

  const again = dailyShopOffers(st, t1 + 3600 * 1000);
  ok(JSON.stringify(again.slots.map((s) => s.troop)) === JSON.stringify(offers1.slots.map((s) => s.troop)),
    '同一天刷新的栏位固定不变');

  st.coins = 50000;
  const coinsBefore = st.coins;
  const unitsBefore = st.units.length;
  const r = buyDailySlot(st, 0, t1);
  ok(r.ok && st.coins === coinsBefore - CONFIG.dailyShop.rarePrice, '购买稀有栏位扣除对应铜钱');
  ok(st.units.length === unitsBefore + 1 && st.units[st.units.length - 1].troop === offers1.slots[0].troop,
    '购买后对应兵种直接进兵营');
  const r2 = buyDailySlot(st, 0, t1);
  ok(!r2.ok && r2.reason === 'sold', '同一栏位当天只能购买一次');
  ok(dailyShopOffers(st, t1).slots[0].sold === true, '已购买栏位标记为售罄');

  const t2 = new Date('2026-11-05T00:10:00+08:00').getTime();
  const offers2 = dailyShopOffers(st, t2);
  ok(offers2.slots.every((s) => !s.sold), '跨天后已购买记录清空');
  st.coins = 50000;
  ok(buyDailySlot(st, 0, t2).ok, '跨天后 0 号栏位可以再次购买');

  const locked = createNewState();
  locked.maxCleared = 0;
  const rl = buyDailySlot(locked, 0, t1);
  ok(!rl.ok && rl.reason === 'locked', '未解锁时不能购买每日商店');

  // 兵营满：不扣钱、不给兵
  const full = createNewState();
  full.maxCleared = need;
  full.coins = 50000;
  while (full.units.length < 300) full.units.push({ id: `u${full.nextUnitId++}`, troop: 'shield', level: 1 });
  const before = full.coins;
  const rf = buyDailySlot(full, 4, t1);
  ok(!rf.ok && rf.reason === 'full' && full.coins === before, '兵营满时不扣钱也买不到');

  ok(minutesUntilRefresh(new Date('2026-11-04T23:00:00+08:00').getTime()) === 60,
    '距刷新时间按北京时间 0 点计算');
}

console.log('\n== 英雄系统 ==');
{
  const st = createNewState();
  ok(HEROES.length === 12, `共 12 名英雄（实际 ${HEROES.length}）`);
  ok(HEROES.filter((h) => h.tier === 'epic').length === 6, '史诗 6 名');
  ok(HEROES.filter((h) => h.tier === 'legendary').length === 6, '传奇 6 名（表后 6 个）');
  ok(HEROES.every((h) => CONFIG.troops.some((t) => t.id === h.troop)), '每个英雄的兵种都在兵种表里');

  const s1 = heroStatsFor('guanping', 1);
  ok(s1.hp === 2000 && s1.atk === 90 && s1.def === 10, '关平 Lv1：血 2000 / 攻 90 / 防 10');
  const s30 = heroStatsFor('guanping', 30);
  ok(s30.hp === Math.round(2000 * Math.pow(1.05, 29)), `关平 Lv30 按血量成长 1.05^：hp${s30.hp}`);
  ok(s30.def === Math.round(10 * Math.pow(1.005, 29) * 10) / 10,
    `英雄防御不再高速成长：关平 Lv30 def${s30.def}（仅 ×${Math.pow(1.005, 29).toFixed(2)}）`);
  ok(HERO_MAX_LEVEL === 30, '英雄满级 30 级');
  ok(heroUpgradeCost(1) === CONFIG.heroes.levelUpBase, `升级费用从 ${CONFIG.heroes.levelUpBase} 铜钱起`);
  // 传奇升级总花费 ≥ 史诗 2 倍；前几级只小幅上浮，后期曲线递增
  const epicCost = Array.from({ length: HERO_MAX_LEVEL - 1 }, (_, i) => heroUpgradeCost(i + 1, 'epic'));
  const legCost = Array.from({ length: HERO_MAX_LEVEL - 1 }, (_, i) => heroUpgradeCost(i + 1, 'legendary'));
  const epicTotal = epicCost.reduce((a, b) => a + b, 0);
  const legTotal = legCost.reduce((a, b) => a + b, 0);
  ok(legTotal >= epicTotal * 2, `传奇总花费 ${legTotal} ≥ 史诗 ${epicTotal} × 2`);
  ok(legCost.every((c, i) => c >= epicCost[i]), '传奇每级价格均不低于史诗');
  ok(legCost[0] <= Math.round(epicCost[0] * 1.5), `传奇 Lv1 仅上浮 ${Math.round(legCost[0] / epicCost[0] * 100)}%（前几级不狠涨）`);
  ok(legendaryCostMult(30) > legendaryCostMult(1), '传奇倍率随等级递增');
  console.log(`  升级总花费：史诗 ${epicTotal} / 传奇 ${legTotal}（${(legTotal / epicTotal).toFixed(2)} 倍）`);
  console.log(`  史诗每级：${epicCost.join(',')}`);
  console.log(`  传奇每级：${legCost.join(',')}`);

  st.heroTickets = 0;
  ok(pullHeroes(st, 1).reason === 'ticket', '没有招募券不能招募');
  st.heroTickets = 3;
  const pr = pullHeroes(st, 1, mulberry32(7));
  ok(pr.ok && st.heroTickets === 2 && pr.results.length === 1, '招募 ×1 消耗 1 张券');
  st.heroTickets = 10;
  const pr10 = pullHeroes(st, 10, mulberry32(9));
  ok(pr10.ok && st.heroTickets === 0 && pr10.results.length === 10, '十连消耗 10 张券并返回 10 个结果');
  ok([...pr.results, ...pr10.results].every((r) => ['troop', 'hero', 'box'].includes(r.kind)),
    '招募结果覆盖兵种 / 英雄 / 自选箱三类');

  grantHero(st, 'guanping', 1);
  const owned = 'guanping';
  const lvBefore = st.heroes[owned];
  const dup = grantHero(st, owned, 1);
  ok(dup.level === lvBefore + 1, '重复获得同一英雄 → 自动 +1 级');

  st.coins = 100000;
  const up = upgradeHero(st, owned);
  ok(up.ok && st.heroes[owned] === lvBefore + 2 && st.coins === 100000 - up.cost, '花铜钱升级英雄');
  st.coins = 0;
  ok(upgradeHero(st, owned).reason === 'poor', '铜钱不足不能升级');
  ok(CONFIG.heroes.unlockLevel === 200, '英雄系统 200 关解锁');

  const st3 = createNewState();
  st3.maxCleared = 380;
  grantHero(st3, 'guanping', 1);
  const placed = placeHeroSquads(st3);
  ok(placed.length === 1 && placed[0].hero === 'guanping' && typeof placed[0].col === 'number',
    '已拥有英雄会自动排进布阵空格');

  // 布阵 25 格全满时，英雄仍要上场（放到方阵外侧）
  const fullSt = createNewState();
  fullSt.maxCleared = 380;
  fullSt.units = [];
  for (let i = 0; i < 25; i++) fullSt.units.push({ id: `uf${i}`, troop: 'shield', level: 1 });
  fullSt.formation = fullSt.units.map((u) => u.id);
  grantHero(fullSt, 'guanping', 1);
  const placedFull = placeHeroSquads(fullSt);
  ok(placedFull.length === 1 && placedFull[0].col >= 5,
    '布阵 25 格全满时英雄仍会站到方阵外侧上场');

  // 战斗：英雄只出 1 个将领模型 + 关平每 3 次攻击眩晕
  const battle = createArenaBattle(
    [{ troop: 'spear', level: 30, hero: 'guanping', col: 4, row: 2 }],
    [{ troop: 'xianzhen', level: 10, col: 4, row: 2 }],
    mulberry32(11),
  );
  const heroEnt = battle.entities.find((e) => e.hero === 'guanping');
  ok(!!heroEnt && heroEnt.maxHp === s30.hp && heroEnt.heroScale === 1.3,
    '英雄上场放大 1.3 倍，血量用英雄自己的成长数值');
  ok(battle.entities.filter((e) => e.side === 'player').length === 1, '英雄只出 1 个将领模型（不走小队编制）');
  let stunEvents = 0;
  for (let i = 0; i < 600 && !battle.over; i++) {
    const evs = battle.step(CONFIG.combat.step);
    for (const e of evs) if (e.t === 'stun') stunEvents++;
  }
  ok(stunEvents > 0, `关平每 3 次攻击触发一次眩晕（实测 ${stunEvents} 次）`);

  // 12 名英雄基础数值逐项比对（张角/夏侯渊为 1.0.10 重做后的新数值）
  const TABLE = [
    ['guanping', 2000, 90, 10, 1.0], ['zhangren', 1750, 102, 8, 1.1],
    ['huanggai', 1450, 98, 7, 1.5], ['liru', 1600, 96, 7, 1.2],
    ['zhangjiao', 1650, 100, 9, 2.1], ['xiahouyuan', 1650, 108, 8, 1.05],
    ['zhangfei', 3500, 93, 20, 1.5], ['guanyu', 2900, 180, 18, 1.2],
    ['liubei', 4000, 75, 24, 1.5], ['caocao', 4000, 50, 22, 1.8],
    ['zhouyu', 1600, 105, 9, 2.0], ['dongzhuo', 2400, 160, 16, 1.2],
  ];
  for (const [id, hp, atk, def, interval] of TABLE) {
    const s = heroStatsFor(id, 1);
    ok(s.hp === hp && s.atk === atk && s.def === def && s.interval === interval,
      `${heroById(id).name} 基础数值与表一致（${hp}/${atk}/${def}/${interval}）`);
  }
  ok(HEROES.slice(0, 6).every((h) => h.tier === 'epic') && HEROES.slice(6).every((h) => h.tier === 'legendary'),
    '表格前 6 名为史诗、后 6 名为传奇');
  ok(HEROES.every((h) => typeof h.skill.desc === 'string' && h.skill.desc.length > 0),
    '12 名英雄都有技能描述（表未定义项已单独标注）');

  // ===== 全部 12 名英雄：技能/被动随等级连续成长，不跳档 =====
  // 取每个英雄技能数值对象里的所有数字（排除固定参数 cd / dur / radius 等）
  // 固定参数 + 按设计不成长/反向成长的项不参与「必须递增」检查
  const FIXED_KEYS = new Set(['auraRadius', 'fireRadius', 'fireDuration', 'fireInterval', 'vsTengjia',
    'cd', 'dur', 'arrows', 'levelStep', 'range', 'stopRange', 'shieldDelay', 'selfHealPct',
    'healPct', 'every']);
  const lv = (id, level) => heroSkillNumbers(id, level);
  const growthKeys = (id) => Object.keys(lv(id, 1)).filter((k) => !FIXED_KEYS.has(k));
  const L = [1, 10, 20, 30];
  const rows = HEROES.map((h) => {
    const vals = L.map((level) => lv(h.id, level));
    return { id: h.id, name: h.name, L: vals };
  });
  const fmtRow = (r) => `${r.name}: ${L.map((level, i) => `Lv${level} ${JSON.stringify(r.L[i])}`).join(' | ')}`;
  console.log('  英雄等级成长表（Lv1 / Lv10 / Lv20 / Lv30）');
  for (const r of rows) console.log(`   · ${fmtRow(r)}`);

  for (const r of rows) {
    const keys = growthKeys(r.id);
    for (const k of keys) {
      const seq = r.L.map((v) => v[k]);
      const rising = seq.every((v, i) => i === 0 || v >= seq[i - 1]);
      const span = seq[3] - seq[0];
      ok(rising && span > 0,
        `${r.name} ${k} 随等级单调递增（Lv1 ${seq[0]} → Lv30 ${seq[3]}，跨度 ${Math.round(span * 1000) / 1000}）`);
    }
    // 相邻等级之间必须连续变化（不允许「只在 3/6/9 级跳档」的阶梯）
    const midKeys = keys.filter((k) => r.L[1][k] !== r.L[0][k]);
    ok(midKeys.length === keys.length,
      `${r.name} 所有成长项在 Lv1→Lv10 之间都已变化（无跳档）：${keys.join('/')}`);
    const summary1 = heroSkillSummary(r.id, 1);
    const summary30 = heroSkillSummary(r.id, HERO_MAX_LEVEL);
    ok(summary1.length > 0 && summary30.length > 0 && summary1 !== summary30,
      `${r.name} 详情页当前等级/满级文案不同（展示实际数值）`);
  }
  // 张角召唤间隔 5 秒 → 4 秒（数字递减也是连续成长）
  const zj1 = lv('zhangjiao', 1).every;
  const zj30 = lv('zhangjiao', 30).every;
  ok(zj1 === 5 && zj30 === 4 && lv('zhangjiao', 10).every > 4 && lv('zhangjiao', 10).every < 5,
    '张角召唤间隔 5→4 秒连续缩短，非跳档');
  // 曹操治疗固定 120%，不随等级成长（用户新要求）
  ok(lv('caocao', 1).healPct === 1.2 && lv('caocao', 30).healPct === 1.2,
    '曹操治疗率固定 120%（Lv1 与满级一致）');
  ok(Math.abs(lv('caocao', 1).reflectPct - 0.6) < 1e-9
    && Math.abs(lv('caocao', 30).reflectPct - 1) < 1e-9
    && lv('caocao', 10).reflectPct > 0.6 && lv('caocao', 10).reflectPct < 1,
    '曹操反弹 60%→100% 连续成长（Lv10 处于中间值）');

  // 英雄上阵位随关卡开放：200 关前 0 位、200 关 1 位、500 关 2 位、1000 关 3 位
  for (const [level, want] of [[0, 0], [199, 0], [200, 1], [499, 1], [500, 2], [999, 2], [1000, 3], [2600, 3]]) {
    const st = createNewState();
    st.maxCleared = level;
    ok(heroDeploySlots(st) === want, `第 ${level} 关可用英雄位 ${heroDeploySlots(st)}（期望 ${want}）`);
  }
  const slot499 = createNewState();
  slot499.maxCleared = 499;
  ok(nextHeroSlotLevel(slot499) === 500, '499 关下一个英雄位的解锁关卡 = 500');
  const slot1000 = createNewState();
  slot1000.maxCleared = 1000;
  ok(nextHeroSlotLevel(slot1000) === 0, '1000 关后不再有下一个英雄位');

  // 最多上阵 3 名英雄（core 与布阵页双重限制）
  const limitSt = createNewState();
  limitSt.maxCleared = 1000;
  limitSt.formation = new Array(25).fill(null);
  for (const h of HEROES.slice(0, 4)) grantHero(limitSt, h.id, 1);
  ok(CONFIG.heroes.maxDeploy === 3, '上阵上限配置为 3');
  ok(deployedHeroCount(limitSt) === 3, `自动上阵只放 3 名（实际 ${deployedHeroCount(limitSt)}）`);
  ok(canDeployHero(limitSt, HEROES[0].id) === true, '已在阵上的英雄仍可再次选中');
  ok(canDeployHero(limitSt, HEROES[3].id) === false, '第 4 名英雄超选会被拒绝');
  ok(placeHeroSquads(limitSt).length === 3, '英雄战/主线出战只取前 3 名英雄');

  // 第 250 关首通赠送关平（400 关起不再赠将；张飞改为 7 日登录第 7 天奖励）
  const rewardSt = createNewState();
  rewardSt.maxCleared = 250;
  rewardSt.heroLevelRewards = {};
  ok(pendingLevelHeroReward(rewardSt, 250) === 'guanping', '250 关首通奖励为关平');
  ok(pendingLevelHeroReward(rewardSt, 400) === null, '400 关不再赠送武将');
  const claim1 = claimLevelHeroReward(rewardSt, 250);
  ok(claim1.ok && claim1.hero === 'guanping' && rewardSt.heroes.guanping >= 1, '领取后关平加入英雄列表');
  ok(pendingLevelHeroReward(rewardSt, 250) === null, '领取后不再提示');
  ok(claimLevelHeroReward(rewardSt, 250).ok === false, '同一关不能重复领取');

  // 已拥有关平：250 关奖励按重复英雄规则折算（3000 铜钱），不升级、不重复发英雄
  const rewardDupSt = createNewState();
  rewardDupSt.maxCleared = 250;
  rewardDupSt.heroLevelRewards = {};
  rewardDupSt.heroes.guanping = 8;
  rewardDupSt.coins = 1000;
  const dupReward = claimLevelHeroReward(rewardDupSt, 250);
  ok(dupReward.ok && dupReward.duplicate === true && dupReward.coins === 3000
    && rewardDupSt.coins === 4000 && rewardDupSt.heroes.guanping === 8,
    '已拥有 250 关赠将 → 折算 3000 铜钱，等级不变');
  ok(claimLevelHeroReward(rewardDupSt, 250).ok === false, '折算领取后仍记为已领取，不能再领');

  // 开发者通道：一键全部英雄 + 每个兵种各 1 个
  const devSt = createNewState();
  devSt.heroes = {};
  devSt.formation = new Array(25).fill(null);
  const devHeroes = devGrantAllHeroes(devSt);
  ok(devHeroes.added.length === HEROES.length && Object.keys(devSt.heroes).length === HEROES.length,
    `开发者通道一次发放全部 ${HEROES.length} 名英雄`);
  const beforeTroops = devSt.units.length;
  const devTroops = devGrantAllTroops(devSt);
  ok(devTroops.ok && devTroops.added.length === CONFIG.troops.length
    && devSt.units.length === beforeTroops + CONFIG.troops.length,
    `开发者通道一次发放 ${CONFIG.troops.length} 个兵种各 1 个`);

  // ===== 招募系统：奖池 / 自选箱 / 保底 / 招募券来源 =====
  ok(recruitPool().length === 10 && recruitPoolTotal() === 100,
    `奖池 10 个档位、权重合计 ${recruitPoolTotal()}%`);
  const goldTarget = recruitPool().filter((e) => (e.kind === 'hero' ? e.tier === 'legendary' : e.rarity === 'legendary'))
    .reduce((s, e) => s + e.weight, 0);
  ok(goldTarget === 17, `传奇档合计 ${goldTarget}%（传奇兵 12% + 传奇英雄 5%）`);

  // 大样本：10 万抽，每个档位与目标权重误差 ≤1 个百分点。
  // 新规则「已拥有英雄不再入池」会让集齐英雄后的分布向其他档位倾斜，
  // 因此每抽前清空英雄拥有状态（等价于验证「全部英雄未拥有」时的原始奖池权重），
  // 保底计数 heroPity 仍然连续累计，20 抽保底的补偿也一并纳入。
  const distSt = createNewState();
  distSt.maxCleared = 250;          // 250 关全兵种已解锁
  distSt.heroTickets = 100000;
  distSt.heroPity = 0;
  const distRng = mulberry32(20261105);
  const counts = {};
  let totalDraws = 0;
  for (let i = 0; i < 100000; i++) {
    distSt.heroes = {};
    distSt.recruitBoxes = [];
    const res = pullHeroes(distSt, 1, distRng).results[0];
    counts[res.entryId] = (counts[res.entryId] || 0) + 1;
    totalDraws++;
  }
  ok(totalDraws === 100000, `大样本实抽 ${totalDraws} 次`);
  for (const e of recruitPool()) {
    const pct = (counts[e.id] || 0) / totalDraws * 100;
    ok(Math.abs(pct - e.weight) <= 1,
      `${e.id}：目标 ${e.weight}% / 实测 ${pct.toFixed(2)}%（偏差 ${(pct - e.weight >= 0 ? '+' : '') + (pct - e.weight).toFixed(2)}pp）`);
  }

  // 未解锁兵种不出现：10 关进度下，所有兵种结果都必须来自「已解锁」列表
  const lockSt = createNewState();
  lockSt.maxCleared = 10;
  lockSt.heroTickets = 300;
  const lockRng = mulberry32(77);
  const unlockedIds = new Set(unlockedTroops(lockSt, null).map((t) => t.id));
  let troopResults = 0;
  const lockedAppeared = [];
  for (let i = 0; i < 30; i++) {
    const r = pullHeroes(lockSt, 10, lockRng);
    for (const res of r.results) {
      if (res.kind !== 'troop') continue;
      troopResults++;
      if (!unlockedIds.has(res.troop)) lockedAppeared.push(res.troop);
    }
  }
  ok(troopResults > 0 && lockedAppeared.length === 0,
    `低关卡抽取 ${troopResults} 个兵种结果，未解锁兵种出现 ${lockedAppeared.length} 次`);
  ok(!unlockedIds.has('baima') && !unlockedIds.has('huhao'), '150/180 关兵种在 10 关进度下确实未解锁');
  // 回退规则：某品级一个已解锁兵种都没有时，向下降档并标记 fallback
  const savedInitial = CONFIG.troopUnlocks.initial;
  const savedLevels = CONFIG.troopUnlocks.levels;
  let fallbackPick = null;
  try {
    CONFIG.troopUnlocks.initial = [];
    // 非普通兵全部设到 999 关解锁 → 只有普通兵可用，传奇档必须一路降到普通
    CONFIG.troopUnlocks.levels = {};
    for (const t of CONFIG.troops) {
      if (rarityOf(t.id) !== 'common') CONFIG.troopUnlocks.levels[t.id] = 999;
    }
    fallbackPick = recruitedTroopFor({ maxCleared: 0, troopUnlocks: [] }, 'legendary', () => 0);
  } finally {
    CONFIG.troopUnlocks.initial = savedInitial;
    CONFIG.troopUnlocks.levels = savedLevels;
  }
  ok(!!fallbackPick && fallbackPick.fallback === true && fallbackPick.rarity === 'common',
    '传奇档无已解锁兵种时降档到普通并标记 fallback');

  // 自选箱：必须选择后才入账，不能反悔 / 重复选
  const boxSt = createNewState();
  boxSt.maxCleared = 250;
  boxSt.heroTickets = 2;
  const unitsBeforeBox = boxSt.units.length;
  const boxPull = pullHeroes(boxSt, 1, () => 0.2);
  ok(boxPull.results[0].kind === 'box' && boxPull.results[0].level === 5,
    '0.2 权重落在 5 级普通兵自选箱');
  ok(boxSt.units.length === unitsBeforeBox && pendingRecruitBoxes(boxSt).length === 1,
    '自选箱抽出后不直接入账，进入待选择队列');
  const boxId = boxPull.results[0].boxId;
  const boxClaim = claimRecruitBox(boxSt, boxId, 'shield');
  ok(boxClaim.ok && boxClaim.level === 5 && boxSt.units.length === unitsBeforeBox + 1
    && pendingRecruitBoxes(boxSt).length === 0,
    '选择盾兵后按 Lv5 入账，并移出待选队列');
  ok(claimRecruitBox(boxSt, boxId, 'shield').reason === 'missing', '同一个自选箱不能重复选');
  const boxPull2 = pullHeroes(boxSt, 1, () => 0.2);
  ok(claimRecruitBox(boxSt, boxPull2.results[0].boxId, 'baier').reason === 'invalid',
    '自选箱不能选不同品级的兵种');
  ok(claimRecruitBox(boxSt, boxPull2.results[0].boxId, 'archer').ok, '改选同品级兵种仍可正常入账');

  // 已拥有英雄不再作为结果：该品级全部拥有时 recruitHeroResult 返回 null（不再重复折算），
  // 奖池层会把整个英雄档位剔除并按剩余权重重新归一化。
  const convSt = createNewState();
  convSt.maxCleared = 250;
  convSt.heroes = {};
  convSt.coins = 1000;
  convSt.heroTickets = 10;
  for (const h of heroesByTier('epic')) convSt.heroes[h.id] = 2;
  for (const h of heroesByTier('legendary')) convSt.heroes[h.id] = 3;
  ok(recruitHeroResult(convSt, 'epic', () => 0) === null, '史诗英雄全部拥有 → 不再返回重复英雄');
  ok(recruitHeroResult(convSt, 'legendary', () => 0) === null, '传奇英雄全部拥有 → 不再返回重复英雄');
  ok(convSt.coins === 1000 && convSt.heroTickets === 10
    && convSt.heroes[heroesByTier('epic')[0].id] === 2,
    '不返回重复英雄时不会产生折算铜钱/券，等级也不变');
  const allOwnedRng = mulberry32(99);
  const ownedPicks = Array.from({ length: 1000 }, () => rollRecruitEntry(convSt, allOwnedRng));
  ok(ownedPicks.every((e) => e.kind !== 'hero'),
    '英雄全部拥有：1000 次掷档没有一次落到英雄条目（权重重新归一化到其余条目）');
  const newSt = createNewState();
  newSt.maxCleared = 250;
  const newHero = recruitHeroResult(newSt, 'epic', () => 0);
  ok(!newHero.owned && newHero.isNew && newHero.level === 1 && newSt.heroes[newHero.hero] === 1,
    '未拥有英雄 → 直接获得 Lv1');
  // 部分拥有：只会在未拥有的英雄里出结果
  const someSt = createNewState();
  someSt.maxCleared = 250;
  someSt.heroes = {};
  heroesByTier('epic').slice(0, -1).forEach((h) => { someSt.heroes[h.id] = 3; });
  const lastEpic = heroesByTier('epic')[heroesByTier('epic').length - 1];
  const partHero = recruitHeroResult(someSt, 'epic', () => 0.99);
  ok(partHero && partHero.hero === lastEpic.id, '部分拥有时只会抽到仍未拥有的英雄');
  ok(recruitHeroResult(someSt, 'epic', () => 0.99) === null,
    '最后一名未拥有英雄被抽到后，该档位立即退出奖池');

  // 20 抽保底：连续 19 抽非传奇 → 第 20 抽强制传奇；自选箱也计入抽数
  const pitySt = createNewState();
  pitySt.maxCleared = 250;
  pitySt.heroes = {};
  pitySt.heroTickets = 20;
  pitySt.heroPity = 0;
  pitySt.recruitBoxes = [];
  const pityRes = [];
  for (let i = 0; i < 2; i++) pityRes.push(...pullHeroes(pitySt, 10, () => 0.5).results);
  const pityGold = (r) => (r.kind === 'hero' ? r.rarity === 'legendary' : r.kind === 'troop' && r.rarity === 'legendary');
  ok(pityRes.length === 20 && pityRes.slice(0, 19).every((r) => !pityGold(r)) && pityGold(pityRes[19]),
    '连续 19 抽非传奇后，第 20 抽强制传奇（保底生效）');
  ok(pitySt.heroPity === 0, '保底出金后计数归零');
  const boxPitySt = createNewState();
  boxPitySt.maxCleared = 250;
  boxPitySt.heroTickets = 20;
  boxPitySt.heroPity = 0;
  boxPitySt.recruitBoxes = [];
  const boxPityRes = [];
  for (let i = 0; i < 2; i++) boxPityRes.push(...pullHeroes(boxPitySt, 10, () => 0.2).results);
  ok(boxPityRes.length === 20 && boxPityRes.slice(0, 19).every((r) => r.kind === 'box') && pityGold(boxPityRes[19]),
    '自选箱也计入保底抽数（19 个自选箱后第 20 抽强制传奇）');

  // 主线发券：200 关后每 10 关 1 张；199 关不发
  ok(mainlineScrollReward(199) === 0, '199 关不发招募券');
  ok(mainlineScrollReward(200) === 1, '200 关发 1 张招募券');
  ok(mainlineScrollReward(210) === 1, '210 关发 1 张招募券');
  ok(mainlineScrollReward(220) === 1, '220 关发 1 张招募券');
  ok(mainlineScrollReward(205) === 0 && mainlineScrollReward(250) === 1,
    '非 10 倍数不发（205、250 校验）');

  // ===== 英雄战 150 关 =====
  ok(CONFIG.heroBattles.total === 150 && HERO_BATTLES.length === 150, '英雄战共 150 关');
  ok(heroBattleUnlockLevel(1) === 250 && CONFIG.heroBattles.unlockLevel === 250, '主线 250 关后开放');
  ok(heroBattleUnlocked(1, 249, 0) === false && heroBattleUnlocked(1, 250, 0) === true,
    '250 关前不可进入，250 关解锁第 1 关');
  ok(heroBattleUnlocked(2, 250, 0) === false && heroBattleUnlocked(2, 250, 1) === true,
    '第 N 关需要先通关第 N-1 关');
  ok(HERO_BATTLES.every((s) => s.hpMult >= 5 && s.hpMult <= 30), 'Boss 血量倍数全部在 5~30 倍（英雄血量上调后上限同步放宽）');
  ok(HERO_BATTLES.slice(0, 6).every((s) => heroById(s.hero).tier === 'epic'),
    '前 6 关为史诗英雄体验关');
  ok(HERO_BATTLES.slice(6, 12).every((s) => heroById(s.hero).tier === 'legendary'),
    '第 7~12 关为 6 名传奇英雄依次登场');
  ok(new Set(HERO_BATTLES.slice(0, 12).map((s) => s.hero)).size === 12, '前 12 关英雄不重复');
  const hb7 = heroBattleDef(7);
  ok(hb7.enemies.length === 3 && hb7.enemies[0].boss && hb7.enemies[0].hero === 'zhangfei'
    && hb7.enemies[0].hpMult === 6.2 && hb7.enemies.filter((e) => !e.hero).length === 2,
    '第 7 关 = 1 名 Boss + 2 队精锐（早期只 2 队）');
  // 敌方按关卡真实扩兵：队数 2→7、兵种品级与等级逐段提升
  const squadCounts = [7, 13, 23, 35, 42, 50].map((n) => heroBattleSquads(n).length);
  ok(squadCounts.join(',') === '2,3,4,5,6,7',
    `英雄战精锐队数随关卡递增：第 7/13/23/35/42/50 关 = ${squadCounts.join('/')} 队`);
  const squadLevels = [7, 13, 23, 35, 42, 50].map((n) => {
    const q = heroBattleSquads(n);
    return Math.max(...q.map((s) => s.level));
  });
  ok(squadLevels.join(',') === '8,8,9,10,10,10',
    `英雄战精锐等级随关卡提升：第 7/13/23/35/42/50 关最高 Lv${squadLevels.join('/Lv')}`);
  ok(heroBattleSquads(50).length === 7 && new Set(heroBattleSquads(50).map((q) => q.troop)).size === 7,
    '第 50 关精锐 7 队、覆盖 7 种不同兵种（不再固定 2 队）');
  ok(heroBattleSquads(50).every((q) => q.level === 10)
    && heroBattleSquads(1).every((q) => q.level === 2),
    '第 1 关精锐 Lv2、第 50 关全 Lv10（等级真实随难度增长）');
  const hb30 = heroBattleDef(30);
  ok(hb30.squads.length === 4 && Math.max(...hb30.squads.map((q) => q.level)) === 10,
    '第 30 关为 Boss + 4 队精锐（最高 Lv10）');
  ok(hb30.desc.includes('4 队精锐') && !hb30.desc.includes('两队精锐'),
    '第 30 关文案按实际队数重写（不再固定「两队精锐」）');

  const powerAt = (n) => levelDef(n).enemies.reduce((s, e) => s + troopPower(e.troop, e.level), 0);
  const lv350 = powerAt(350);
  const lv800 = powerAt(800);
  const p7 = heroBattlePower(7);
  ok(Math.abs(p7 - lv350) / lv350 < 0.05,
    `第 7 关战力 ${p7} ≈ 主线 350 关 ${lv350}（偏差 <5%）`);
  ok(heroBattlePower(30) > lv800,
    `第 30 关战力 ${heroBattlePower(30)} 超过主线 800 关 ${lv800}`);
  let hbMonotonic = true;
  for (let i = 2; i <= 150; i++) {
    if (heroBattlePower(i) < heroBattlePower(i - 1)) hbMonotonic = false;
  }
  ok(hbMonotonic, '英雄战 1~150 关战力单调递增（越往后越难）');
  ok(heroBattlePower(150) > heroBattlePower(149), '第 150 关为最终挑战，战力高于第 149 关');
  const finalDef = heroBattleDef(150);
  ok(finalDef.bossCount === 3
    && finalDef.bosses.map((b) => b.hero).join() === 'liubei,guanyu,zhangfei',
    '第 150 关最终 Boss = 刘备 / 关羽 / 张飞三英雄同时登场');

  // 英雄战阵型：Boss 按兵种线分纵深（近战第一排 / 骑兵第二排 / 远程后排）
  const rankOf = (id) => heroBattleRankCol(heroById(id).troop);
  ok(['guanping', 'zhangfei', 'dongzhuo', 'liubei', 'caocao']
    .every((id) => rankOf(id) === HERO_BATTLE_RANK.melee),
    '近战英雄（枪 / 盾）一律第一排');
  ok(['zhangren', 'liru', 'xiahouyuan', 'guanyu']
    .every((id) => rankOf(id) === HERO_BATTLE_RANK.cavalry),
    '骑兵英雄一律第二排');
  ok(['huanggai', 'zhangjiao', 'zhouyu']
    .every((id) => rankOf(id) === HERO_BATTLE_RANK.ranged),
    '远程英雄一律后排');
  let hbRankOK = true;
  let hbCellOK = true;
  let hbOverlapOK = true;
  let hbScreenOK = true;
  for (let n = 1; n <= 150; n++) {
    const d = heroBattleDef(n);
    const bosses = d.enemies.filter((e) => e.boss);
    const cells = heroBattleBossCells(n);
    if (bosses.some((b, i) => b.col !== cells[i].col || b.row !== cells[i].row
      || b.col !== rankOf(b.hero))) hbRankOK = false;
    const seen = new Set();
    for (const e of d.enemies) {
      const k = `${e.col},${e.row}`;
      if (seen.has(k)) hbOverlapOK = false;
      seen.add(k);
      if (e.col < 0 || e.col > 4 || e.row < 0 || e.row > 4) hbCellOK = false;
    }
    // 后排 / 二排 Boss 前面必须有精锐掩护墙，否则「先破前排」无从谈起
    for (const b of bosses) {
      if (b.col > 0 && !d.squads.some((q) => q.col < b.col)) hbScreenOK = false;
    }
  }
  ok(hbRankOK, '英雄战 1~150 关 Boss 都按兵种线落在指定纵深');
  ok(hbCellOK, '英雄战 1~150 关所有敌军格子都在 5×5 内');
  ok(hbOverlapOK, '英雄战 1~150 关 Boss 与精锐、精锐之间无同格重叠');
  ok(hbScreenOK, '远程 / 骑兵 Boss 前方一定有精锐结阵掩护');
  ok(heroBattleDef(1).enemies[0].rankLabel === '第一排'
    && heroBattleDef(2).enemies[0].rankLabel === '第二排'
    && heroBattleDef(3).enemies[0].rankLabel === '后排'
    && heroBattleDef(3).formationHint.includes('先破前排'),
    '序章 1/2/3 关依次示范前排 / 二排 / 后排，并给出破局提示');
  ok(heroBattleDef(12).squads[0].col === 1
    && heroBattleDef(30).squads[0].col === 0,
    '近战 Boss 由精锐从第二排压上；后排 Boss 由精锐在第一排结墙');
  // 英雄战输出/承伤面板：与闯关、演武同一套 battle.statsList 字段，Boss 血条下移不重叠
  const hbSpec = HERO_BATTLES[0];
  const hbGame = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {},
  };
  const hbScreen = new BattleScreen(hbGame, hbSpec.stage, mulberry32(7), {
    heroBattle: hbSpec, def: heroBattleDef(hbSpec.stage),
  });
  const hbStats = hbScreen.battle.statsList();
  ok(hbStats.length > 0
    && hbStats.some((s) => s.side === 'player') && hbStats.some((s) => s.side === 'enemy')
    && hbStats.every((s) => Number.isFinite(s.dealt) && Number.isFinite(s.taken)),
    `英雄战统计字段非空（${hbStats.length} 条，含输出/承伤）`);
  ok(hbScreen.retryRect.y === 470,
    '英雄战重来键下移到 Boss 血条 + 输出榜下方，布局不重叠');
  // 后排 Boss 不能被顶部 Boss 血条 / 输出榜盖住：镜头按 Boss 纵深上移
  const frontCam = new BattleScreen(hbGame, 1, mulberry32(7), {
    heroBattle: HERO_BATTLES[0], def: heroBattleDef(1),
  });
  const backCam = new BattleScreen(hbGame, 3, mulberry32(7), {
    heroBattle: HERO_BATTLES[2], def: heroBattleDef(3),
  });
  // 半程补偿：既把后排 Boss 拉出顶部 HUD，又不把我方前排推出视口。
  const backDepth = heroBattleDef(3).enemies.filter((e) => e.boss)
    .reduce((m, e) => Math.max(m, e.col || 0), 0);
  const expectBackCam = 36 - Math.round(CONFIG.formation.depthStep / 2) * backDepth;
  ok(Math.abs(frontCam.camTo.y - 36) < 1e-6
    && Math.abs(backCam.camTo.y - expectBackCam) < 1e-6
    && backCam.camTo.y < frontCam.camTo.y - 6
    && backCam.camTo.y > 20,
  `英雄战镜头按 Boss 纵深半程补偿（前排 ${frontCam.camTo.y} / 后排 ${backCam.camTo.y.toFixed(1)}）`);
  ok([10, 20, 30, 40, 50, 60, 100, 150].every((n) => heroBattleScrollReward(n) === 1)
    && heroBattleScrollReward(1) === 0 && heroBattleScrollReward(6) === 0,
    '每 10 关首通发 1 张招募券，其余关卡不发');
  const clearSt = createNewState();
  clearSt.heroBattleCleared = 0;
  ok(recordHeroBattleClear(clearSt, 1).firstClear === true
    && recordHeroBattleClear(clearSt, 1).firstClear === false, '英雄战首通只记录一次');
  clearSt.heroBattleCleared = 9;
  const c10 = recordHeroBattleClear(clearSt, 10);
  ok(c10.firstClear && c10.scrolls === 1 && clearSt.heroBattleCleared === 10, '第 10 关首通发 1 张招募券');

  // ---- 兵种平衡四项验收（本轮：降防御、抬血量、枪兵拒马、普通骑兵冲锋）----
  console.log('\n== 兵种平衡四项验收 ==');
  {
    const atkOf = (id, lv) => ({ troop: id, atk: statsFor(id, lv).atk, def: 0, tr: combatTraits(id, lv) });
    const defOf = (id, lv) => ({ troop: id, atk: 0, def: statsFor(id, lv).def, tr: combatTraits(id, lv) });

    // 1) 满级普通弓 → 满级大戟士，必须有有效伤害
    const archerVsDaji = computeDamage(atkOf('archer', 10), defOf('daji', 10));
    ok(archerVsDaji >= 40,
      `验收2 满级普通弓打满级大戟士 ${archerVsDaji} 点（弓 atk${statsFor('archer', 10).atk} − 戟 def${statsFor('daji', 10).def}，×1.2）`);

    // 2) 满级普通盾能抗满级元戎弩手 3~4 箭
    const shieldHp = statsFor('shield', 10).hp;
    const arrow = computeDamage(atkOf('yuanyong', 10), defOf('shield', 10));
    const arrowsToKill = Math.ceil(shieldHp / arrow);
    ok(arrowsToKill >= 4 && arrowsToKill <= 8,
      `验收3 满级盾 hp${shieldHp} 扛元戎每箭 ${arrow} 点：可扛 ${arrowsToKill - 1} 箭（3箭剩 ${shieldHp - arrow * 3} / 4箭剩 ${shieldHp - arrow * 4}）`);
    // 无当飞军口径：同样要求能扛至少 3 箭
    const wudangArrow = computeDamage(atkOf('wudang', 10), defOf('shield', 10));
    const wudangArrows = Math.ceil(shieldHp / wudangArrow);
    ok(wudangArrows >= 4 && wudangArrows <= 8,
      `验收3 满级盾 hp${shieldHp} 扛无当每箭 ${wudangArrow} 点：可扛 ${wudangArrows - 1} 箭（4箭剩 ${shieldHp - wudangArrow * 4}）`);

    // 3) 满级普通兵打高防英雄不再是 1 点
    const heroesHighDef = ['liubei', 'caocao', 'dongzhuo'];
    for (const hid of heroesHighDef) {
      const hd = heroStatsFor(hid, 30);
      const dd = { troop: 'shield', atk: 0, def: hd.def };
      const dmgs = ['shield', 'archer', 'spear', 'cavalry'].map((id) => computeDamage(atkOf(id, 10), dd));
      ok(dmgs.every((d) => d > 1),
        `验收4 满级普通兵打 ${hid}（def${hd.def}）：盾${dmgs[0]} / 弓${dmgs[1]} / 枪${dmgs[2]} / 骑${dmgs[3]}`);
    }

    // 4) 2~3 队满级普通枪 vs 1 队满级虎豹骑（多种子）
    for (const [n, spots, minWins] of [
      [2, [[4, 1], [4, 3]], 8],
      [3, [[4, 0], [4, 2], [4, 4]], 10],
    ]) {
      const ps = spots.map(([col, row]) => ({ troop: 'spear', level: 10, col, row }));
      let wins = 0;
      for (let s = 1; s <= 10; s++) {
        const r = simulateArena(ps, [{ troop: 'huhao', level: 10, col: 4, row: 2 }], mulberry32(s * 31 + 5));
        if (r.winner === 'player') wins++;
      }
      ok(wins >= minWins, `验收1 ${n} 队满级普通枪 vs 1 队虎豹骑：${wins}/10 胜（≥${minWins}）`);
    }
    // 5) 特性：普通骑兵有冲锋；全部枪兵线（含大戟士）有抵御冲锋
    ok(combatTraits('cavalry', 10)?.charge3?.dmgMult === 1.6
      && combatTraits('cavalry', 10).charge3.dmgMult < combatTraits('huhao', 10).charge3.dmgMult,
      '普通骑兵获得弱化版冲锋（×1.6，低于虎豹骑 ×6）');
    ok(combatTraits('cavalry', 10).charge3.moveNeeded === 5,
      '普通骑兵冲锋激活距离削弱为 5 格（低于幽州突骑/虎豹骑的 3 格）');
    for (const id of ['spear', 'qingzhou', 'baier', 'daji']) {
      const tr = combatTraits(id, 10);
      ok(tr && tr.takenCavalryCharge === 0.75 && tr.vsCavalry === 1.3,
        `${id} 具备抵御冲锋（冲锋伤害 -75% / 对骑 +130% / 免疫冲锋眩晕）`);
    }
  }
  const strongForm = [];
  const elite = ['huhao', 'daji', 'xianzhen', 'wudang', 'baima'];
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      strongForm.push({ troop: elite[(col + row) % elite.length], level: 10, col: col + 5, row });
    }
  }
  for (const [n, cap] of [[400, 52000], [500, 58000], [600, 64000], [700, 70000], [800, 90000],
    [1200, 95000], [1700, 95000], [2200, 110000], [2600, 140000]]) {
    // 800 关后敌方带「兵书对等加成」，这里给玩家挂同一份倍率 —— 模拟玩家把兵书追平后的终局战力
    const book = enemyBookScales(n);
    const simForm = book ? strongForm.map((s) => ({ ...s, ...book })) : strongForm;
    const sim = simulateArena(simForm, levelDef(n).enemies, mulberry32(n), 200);
    ok(sim.winner === 'player', `第 ${n} 关满编 Lv10 阵容可通关（${sim.winner}）`);
    ok(powerAt(n) <= cap, `第 ${n} 关敌方战力 ${powerAt(n)} 不溢出（<=${cap}）`);
  }

  // 存档：英雄与招募券
  const store = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = v; },
  };
  st3.heroTickets = 4;
  saveState(store, st3);
  const loaded = loadState(store);
  ok(loaded.heroes.guanping === 1 && loaded.heroTickets === 4, '读档保留英雄等级与招募券');
}

console.log('\n== 传奇英雄 AOE：张飞圆环 / 关羽扇形 / 周瑜火圈 ==');
{
  // 1 名英雄 vs 数支敌军；手动摆位后推进，验证热区形状与伤害
  const mkHeroBattle = (heroId, enemies, seed) => createArenaBattle(
    [{ hero: heroId, troop: heroById(heroId).troop, level: 1, col: 4, row: 2 }],
    enemies, mulberry32(seed)
  );
  const heroOf = (b) => b.entities.find((e) => e.hero);
  const foesOf = (b) => b.entities.filter((e) => e.side === 'enemy');

  // 战法数值：形状 / 倍率 / 持续伤害参数
  const zfT = heroCombatTraits('zhangfei', 1);
  const gyT = heroCombatTraits('guanyu', 1);
  const zyT = heroCombatTraits('zhouyu', 1);
  ok(zfT.spinAttack.radius === 2 && zfT.spinAttack.dmgMult === 1,
    '张飞战法：以自身为圆心、半径 2 格圆环（普攻 1 倍）');
  ok(gyT.chargeSplash && gyT.chargeSplash.radius === 3 && gyT.chargeSplash.angle === 60
    && gyT.chargeSplash.dmgMult === 3 && !gyT.splashSector,
    '关羽战法：仅冲锋那一击触发 60 度 / 半径 3 格 / 3 倍普攻扇形，普攻无扇形');
  ok(zyT.range === 25 && zyT.stopRange === 22,
    '周瑜战法：开火距离 22 格、射程 25 格');
  ok(zyT.fireZone.radius === 1 && zyT.fireZone.duration === 3 && zyT.fireZone.interval === 0.5
    && zyT.fireZone.dmgPct === 0.5,
    '周瑜战法：直径 2 格火圈（半径 1）、持续 3 秒、每 0.5 秒跳伤、每秒 50% 普攻');

  // ---- 张飞：圆环震地 ----
  const zf = mkHeroBattle('zhangfei', [
    { troop: 'shield', level: 1, col: 0, row: 2 },
    { troop: 'shield', level: 1, col: 0, row: 0 },
  ], 11);
  const zfHero = heroOf(zf);
  const zfFoes = foesOf(zf);
  zfHero.x = 15; zfHero.y = 45; zfHero.cooldown = 0; zfHero.interval = 999;
  const setPos = (o, x, y) => { o.x = x; o.y = y; o.hp = 5000; o.maxHp = 5000; };
  setPos(zfFoes[0], 15, 44.2);    // 主目标 0.8 格
  setPos(zfFoes[1], 16.5, 45);    // 1.5 格，圈内
  setPos(zfFoes[2], 15, 43.05);   // 1.95 格，圈内（贴着边界）
  setPos(zfFoes[3], 18, 45);      // 3 格，圈外
  setPos(zfFoes[4], 15, 48);      // 3 格，圈外
  setPos(zfFoes[5], 12, 45);      // 3 格，圈外
  const zfHpBefore = zfFoes.map((o) => o.hp);
  const zfEvents = zf.step(CONFIG.combat.step);
  const zfMainHit = computeDamage(zfHero, zfFoes[0]);
  ok(zfFoes[0].hp === zfHpBefore[0] - zfMainHit, '张飞普攻命中主目标');
  ok(zfFoes[1].hp === zfHpBefore[1] - computeDamage(zfHero, zfFoes[1])
    && zfFoes[2].hp === zfHpBefore[2] - computeDamage(zfHero, zfFoes[2]),
    '张飞圆环震地命中半径 2 格内的其他 2 名敌人（1 倍普攻）');
  ok(zfFoes.slice(3).every((o, i) => o.hp === zfHpBefore[3 + i]),
    '张飞圆环不命中半径 2 格以外的敌人');
  ok(zfEvents.some((ev) => ev.t === 'impact' && ev.kind === 'spin' && ev.radius === 2),
    '张飞震地产生圆环冲击特效事件（radius 2）');

  // ---- 关羽：冲锋那一击 = 60 度 / 半径 3 格 / 3 倍；普攻恢复单体 ----
  const gy = mkHeroBattle('guanyu', [
    { troop: 'shield', level: 1, col: 0, row: 2 },
    { troop: 'shield', level: 1, col: 0, row: 0 },
  ], 12);
  const gyHero = heroOf(gy);
  const gyFoes = foesOf(gy);
  gyHero.x = 15; gyHero.y = 45; gyHero.cooldown = 0; gyHero.interval = 999;
  setPos(gyFoes[0], 15, 44.2);     // 主目标，正上方（-90 度）
  setPos(gyFoes[1], 15.7, 43.4);   // 距攻击方向约 23.6 度、1.75 格 → 扇形内
  setPos(gyFoes[2], 14.3, 43.4);   // 距攻击方向约 23.6 度、1.75 格 → 扇形内
  setPos(gyFoes[3], 15, 42);       // 正方向、恰好 3 格 → 半径边界内
  setPos(gyFoes[4], 15.8, 44.5);   // 约 58 度偏角 → 扇形外
  setPos(gyFoes[5], 15.8, 41.4);   // 方向内但 3.67 格 → 半径外
  // 冻结敌人，只观察关羽一击
  gyFoes.forEach((o) => { o.speed = 0; o.interval = 999; o.cooldown = 999; });

  // 强制进入冲锋：连续移动累计 >= 3 格
  gyHero.moveAccum = 3;
  const gyHpBefore = gyFoes.map((o) => o.hp);
  const gyEvents = gy.step(CONFIG.combat.step);
  const gySectorDmg = computeDamage(gyHero, gyFoes[1], { mult: 3 });
  ok(gyFoes[0].hp === gyHpBefore[0] - computeDamage(gyHero, gyFoes[0], { mult: 3, charge: true }),
    '关羽冲锋主目标受到 3 倍普攻伤害');
  ok([gyFoes[1], gyFoes[2], gyFoes[3]].every((o, i) => o.hp === gyHpBefore[[1, 2, 3][i]] - gySectorDmg),
    '关羽冲锋扇形：60 度 / 3 格内其他敌人也受到 3 倍普攻伤害');
  ok(gyFoes[4].hp === gyHpBefore[4] && gyFoes[5].hp === gyHpBefore[5],
    '关羽冲锋扇形不命中偏角 58 度、或半径 3 格以外的敌人');
  ok(gyEvents.some((ev) => ev.t === 'impact' && ev.kind === 'sector' && ev.radius === 3 && ev.angle === 60),
    '关羽冲锋产生扇形特效事件（60 度 / radius 3 / 含方向向量）');

  // 同样站位，不再冲锋 → 普攻只打主目标，扇形队友不掉血
  gyFoes.forEach((o) => { o.hp = 5000; o.maxHp = 5000; });
  gyHero.moveAccum = 0;
  gyHero.charging3 = false;
  gyHero.cooldown = 0;
  const gyNormalBefore = gyFoes.map((o) => o.hp);
  const gyNormalEvents = gy.step(CONFIG.combat.step);
  ok(gyFoes[0].hp === gyNormalBefore[0] - computeDamage(gyHero, gyFoes[0]),
    '关羽非冲锋的普通攻击只对主目标造成 1 倍伤害');
  ok(gyFoes.slice(1).every((o, i) => o.hp === gyNormalBefore[i + 1]),
    '关羽普攻恢复单体：扇形范围内的其他敌人不再掉血');
  ok(!gyNormalEvents.some((ev) => ev.t === 'impact' && ev.kind === 'sector'),
    '关羽普攻不再产生扇形特效事件');

  // ---- 周瑜：直径 2 格火焰圈、持续 3 秒、每 0.5 秒跳伤 ----
  const zy = mkHeroBattle('zhouyu', [
    { troop: 'shield', level: 1, col: 0, row: 2 },
    { troop: 'shield', level: 1, col: 0, row: 0 },
  ], 13);
  const zyHero = heroOf(zy);
  const zyFoes = foesOf(zy);
  zyHero.x = 15; zyHero.y = 45; zyHero.cooldown = 0; zyHero.interval = 999;
  setPos(zyFoes[0], 15, 44.2);    // 主目标：火圈落在它脚下
  setPos(zyFoes[1], 15.6, 44.2);  // 距火圈中心 0.6 格，圈内
  setPos(zyFoes[2], 17.5, 44.2);  // 距火圈中心 2.5 格，圈外
  zyFoes.slice(3).forEach((o, i) => setPos(o, 20 + i, 40));  // 其余远离
  // 冻结敌人（速度 0 / 不攻击），只观察火焰持续伤害
  zyFoes.forEach((o) => { o.speed = 0; o.interval = 999; o.cooldown = 999; });
  const zyHpAtZone = zyFoes[1].hp;
  const zyHpOut = zyFoes[2].hp;
  const zyEvents = zy.step(CONFIG.combat.step);
  const zoneEv = zyEvents.find((ev) => ev.t === 'fireZone');
  ok(zoneEv && zoneEv.radius === 1 && zoneEv.duration === 3 && zoneEv.interval === 0.5,
    '周瑜普攻后在目标脚下生成火圈（半径 1 / 持续 3 秒 / 间隔 0.5 秒）');
  ok(zy.fireZones.length === 1 && zy.fireZones[0].radius === 1,
    '火焰圈进入战场 fireZones（供渲染画火焰特效）');
  let fireOnZone = 0;
  let fireOnOut = 0;
  for (let i = 0; i < 96; i++) {          // 再推进 3.2 秒
    const evs = zy.step(CONFIG.combat.step);
    for (const ev of evs) {
      if (ev.t !== 'fire') continue;
      if (ev.uid === zyFoes[1].uid) fireOnZone++;
      if (ev.uid === zyFoes[2].uid) fireOnOut++;
    }
  }
  const tickDmg = Math.max(1, Math.floor((zyHero.atk + (zyHero.auraAtk || 0)) * 0.5 * 0.5));
  ok(fireOnZone === 6, `火圈 3 秒内跳伤 6 次（每 0.5 秒一次，实测 ${fireOnZone} 次）`);
  ok(zyHpAtZone - zyFoes[1].hp === tickDmg * 6,
    `火圈内敌人持续掉血（每次 ${tickDmg}，共 ${tickDmg * 6}）`);
  ok(fireOnOut === 0 && zyFoes[2].hp === zyHpOut, '火圈外的敌人不受持续伤害');
  ok(zy.fireZones.length === 0, '火焰圈 3 秒后自动消失');
}

console.log('\n== 1.0.10 英雄改动：夏侯渊 / 曹操 / 张角 / 周瑜射程 ==');
{
  const mkHeroBattle = (heroId, enemies, seed) => createArenaBattle(
    [{ hero: heroId, troop: heroById(heroId).troop, level: 1, col: 4, row: 2 }],
    enemies, mulberry32(seed)
  );
  const heroOf = (b) => b.entities.find((e) => e.hero);
  const foesOf = (b) => b.entities.filter((e) => e.side === 'enemy');
  const setPos = (o, x, y) => { o.x = x; o.y = y; o.hp = 5000; o.maxHp = 5000; };

  // ---- 夏侯渊：骑兵模型 + 骑兵数值 ----
  const xyArt = heroArtFor('xiahouyuan');
  ok(xyArt && xyArt.horse === true && xyArt.weapon === 'lance',
    `夏侯渊模型：骑兵坐骑 + 长兵器（horse=${!!xyArt.horse}, weapon=${xyArt && xyArt.weapon}）`);
  ok(heroById('xiahouyuan').troop === 'cavalry', '夏侯渊兵种线 = 骑兵');
  const xyB = mkHeroBattle('xiahouyuan', [{ troop: 'shield', level: 1, col: 0, row: 2 }], 21);
  const xyE = heroOf(xyB);
  const xyFoe = foesOf(xyB)[0];
  xyE.x = 15; xyE.y = 45; xyE.cooldown = 0; xyE.interval = 999;
  setPos(xyFoe, 15, 44.2);
  xyFoe.speed = 0; xyFoe.interval = 999; xyFoe.cooldown = 999;
  const xyEvents = xyB.step(CONFIG.combat.step);
  const xyHit = xyEvents.find((ev) => ev.t === 'attack' && ev.actor === xyE.uid);
  ok(xyE.ranged === false && xyE.range === CONFIG.combat.ranges.cavalry
    && Math.abs(xyE.speed - CONFIG.combat.speeds.cavalry * 1.3) < 1e-9,
    '夏侯渊：近战骑兵口径（无射程、骑兵移速 + 神速 30%）');
  ok(xyHit && xyHit.ranged === false && xyHit.damage > 0, '夏侯渊以近战方式命中目标（不射箭）');

  // ---- 曹操「宁可我负天下人」：10s 冷却 / 5s 持续 / 治疗固定 120%，反弹 60%→100% ----
  const cc1 = heroCombatTraits('caocao', 1).dmgConvert;
  const cc30 = heroCombatTraits('caocao', 30).dmgConvert;
  ok(heroById('caocao').skill.name === '宁可我负天下人', '曹操技能已更名为「宁可我负天下人」');
  ok(cc1.cd === 10 && cc1.dur === 5 && cc1.healPct === 1.2 && cc30.healPct === 1.2,
    '曹操技能：冷却 10 秒、持续 5 秒、治疗固定 120%（Lv1 与满级相同）');
  ok(Math.abs(cc1.reflectPct - 0.6) < 1e-9 && Math.abs(cc30.reflectPct - 1.0) < 1e-9,
    '曹操反弹远程：1 级 60% → 满级 100%（随等级成长）');

  const ccB = mkHeroBattle('caocao', [
    { troop: 'archer', level: 1, col: 0, row: 2 },
    { troop: 'shield', level: 1, col: 0, row: 0 },
  ], 22);
  const ccE = heroOf(ccB);
  const ccFoes = foesOf(ccB);
  const ccMax = ccE.maxHp;
  ccE.x = 15; ccE.y = 45; ccE.cooldown = 999; ccE.interval = 999;
  ccFoes.forEach((o, i) => setPos(o, 15, i < 2 ? 37 : 44));  // 前 2 个是弓手（远程），其余盾兵（近战）
  // 提高攻击力，保证 120% 转化后的整数治疗 > 0（Lv1 打 60 防只有保底 1 点）
  ccFoes.forEach((o) => { o.atk = 400; o.speed = 0; o.interval = 999; o.cooldown = 0; });
  ccE.hp = Math.round(ccE.maxHp / 2);   // 留出治疗空间，避免 120% 治疗被满血封顶干扰断言
  const ccHpBefore = ccE.hp;
  const ccEvents = ccB.step(CONFIG.combat.step);
  const ccSkill = ccEvents.find((ev) => ev.t === 'skill' && ev.kind === 'dmgConvert');
  ok(ccSkill && Math.abs(ccSkill.until - CONFIG.combat.step - 5) < 1e-6
    && ccE.convertUntil > ccB.time, '曹操开战进入 5 秒持续窗口');
  const ccHitOnSelf = ccEvents.filter((ev) => ev.t === 'attack' && ev.target === ccE.uid && ev.damage > 0);
  const ccConvert = ccEvents.filter((ev) => ev.t === 'convert');
  const ccReflect = ccEvents.filter((ev) => ev.t === 'attack' && ev.reflect);
  ok(ccHitOnSelf.length >= 2, `曹操在持续窗口内受到 ${ccHitOnSelf.length} 次伤害`);
  ok(ccConvert.length === ccHitOnSelf.length
    && ccConvert.every((ev) => ev.heal === Math.floor(ev.damage * 1.2)),
    '曹操受到的每笔伤害都按固定 120% 立即转化为治疗');
  const ccTaken = ccHitOnSelf.reduce((s, ev) => s + ev.damage, 0);
  const ccHealed = ccConvert.reduce((s, ev) => s + ev.heal, 0);
  ok(ccE.hp - ccHpBefore === ccHealed - ccTaken,
    `曹操净承伤 = -20%（受到 ${ccTaken}，治疗 ${ccHealed}，血量变化 ${ccE.hp - ccHpBefore}）`);
  ok(ccReflect.length === 2 && ccReflect.every((ev) => ev.targetTroop === 'archer'),
    `曹操只反弹远程伤害：2 支箭各反弹一次，近战不反弹（实测 ${ccReflect.length} 次）`);

  // 关闭技能窗口后再挨打 → 不转化、不反弹
  ccFoes.forEach((o) => { o.hp = 5000; o.cooldown = 0; });
  ccE.hp = ccMax; ccE.convertUntil = 0; ccE.convertCd = 999;
  const ccOff = ccB.step(CONFIG.combat.step);
  ok(!ccOff.some((ev) => ev.t === 'convert')
    && !ccOff.some((ev) => ev.t === 'attack' && ev.reflect),
    '技能窗口外：不转化伤害、不反弹远程');

  // 冷却循环：持续 5 秒，10 秒后再次触发
  const ccCycle = mkHeroBattle('caocao', [{ troop: 'shield', level: 1, col: 0, row: 2 }], 23);
  const ccCycleHero = heroOf(ccCycle);
  const ccCycleFoe = foesOf(ccCycle)[0];
  ccCycleHero.x = 15; ccCycleHero.y = 45; ccCycleHero.cooldown = 999; ccCycleHero.interval = 999;
  setPos(ccCycleFoe, 15, 2); ccCycleFoe.speed = 0; ccCycleFoe.interval = 999; ccCycleFoe.cooldown = 999;
  let ccSkillEvents = 0;
  for (let i = 0; i < 320; i++) {
    const evs = ccCycle.step(CONFIG.combat.step);
    for (const ev of evs) if (ev.t === 'skill' && ev.kind === 'dmgConvert') ccSkillEvents++;
  }
  ok(ccSkillEvents === 2, `曹操 10 秒冷却循环：10.4 秒内触发 ${ccSkillEvents} 次（期望 2 次）`);

  // ---- 刘备：4 格回血光环 + 自身每秒固定回血（满血封顶） ----
  const lbT = heroCombatTraits('liubei', 1);
  ok(lbT.healAura.radius === 4 && lbT.healAura.hps === 20 && lbT.selfHealHps === 40,
    '刘备战法：4 格光环每秒 20 点，自身每秒固定 40 点（Lv1）');
  const lb = createArenaBattle(
    [
      { hero: 'liubei', troop: 'shield', level: 1, col: 4, row: 2 },
      { troop: 'shield', level: 1, col: 2, row: 1 },
    ],
    [{ troop: 'shield', level: 1, col: 0, row: 2 }],
    mulberry32(26)
  );
  const lbHero = heroOf(lb);
  const lbAllyIn = lb.entities.find((e) => e.side === 'player' && !e.hero);
  const lbFoe = foesOf(lb)[0];
  lb.entities.forEach((e) => {
    e.speed = 0; e.cooldown = 999; e.interval = 999; e.moveAccum = 0;
  });
  lbHero.x = 15; lbHero.y = 45;
  lbAllyIn.x = 18; lbAllyIn.y = 45; lbAllyIn.hp = 20;       // 距刘备 3 格，圈内
  lbFoe.x = 20.5; lbFoe.y = 45;                              // 距刘备 5.5 格，圈外
  lbHero.hp = lbHero.maxHp - 200;                            // 留出自愈空间
  const lbSelfBefore = lbHero.hp;
  const lbInBefore = lbAllyIn.hp;
  const lbOutBefore = lbFoe.hp;
  let lbAuraHealEvent = null;
  for (let i = 0; i < 31; i++) {
    const evs = lb.step(CONFIG.combat.step);
    const healEv = evs.find((ev) => ev.t === 'heal' && ev.uid === lbAllyIn.uid);
    if (healEv) lbAuraHealEvent = healEv;
  }
  ok(lbAllyIn.hp > lbInBefore + 19 && lbAllyIn.hp <= lbInBefore + 21,
    `刘备光环治疗 4 格内友军：1 秒 +${(lbAllyIn.hp - lbInBefore).toFixed(2)}（期望 20）`);
  ok(lbFoe.hp === lbOutBefore, '刘备光环不治疗 4 格外的单位（半径与判定一致）');
  ok(lbAuraHealEvent && lbAuraHealEvent.amount === 20,
    '刘备光环产生 +20 淡绿治疗飘字事件（供 UI 辨认）');
  ok(Math.abs((lbHero.hp - lbSelfBefore) - 40 * 31 / 30) < 2,
    `刘备自身每秒固定回复 40 点（实测 +${(lbHero.hp - lbSelfBefore).toFixed(2)} / 期望 41.33）`);
  lbHero.hp = lbHero.maxHp;
  for (let i = 0; i < 30; i++) lb.step(CONFIG.combat.step);
  ok(lbHero.hp === lbHero.maxHp, '刘备满血时自愈不溢出、不叠加');

  // ---- 基础血量口径：Boss 血量倍数（英雄战 hpMult 5~10）不得放大百分比回复/护盾 ----
  ok(lbHero.baseMaxHp === lbHero.maxHp,
    `闯关口径（无血量倍数）：baseMaxHp = maxHp = ${lbHero.maxHp}`);
  const lbBase = heroStatsFor('liubei', 1).hp;
  const lbBoss = createArenaBattle(
    [{ hero: 'liubei', troop: 'shield', level: 1, col: 4, row: 2, hpMult: 7 }],
    [{ troop: 'shield', level: 1, col: 0, row: 4 }],
    mulberry32(27)
  );
  const lbBossHero = heroOf(lbBoss);
  lbBoss.entities.forEach((e) => { e.speed = 0; e.cooldown = 999; e.interval = 999; });
  ok(lbBossHero.baseMaxHp === lbBase && lbBossHero.maxHp === lbBase * 7,
    `英雄战 hpMult=7：baseMaxHp=${lbBossHero.baseMaxHp} / maxHp=${lbBossHero.maxHp}（基础部分不放大）`);
  lbBossHero.hp = lbBossHero.maxHp - 1000;
  const lbBossBefore = lbBossHero.hp;
  for (let i = 0; i < 31; i++) lbBoss.step(CONFIG.combat.step);
  const lbBossGain = lbBossHero.hp - lbBossBefore;
  // 31 帧 = 1.033 秒；若误用倍数放大，这里不会是 ~41
  ok(Math.abs(lbBossGain - 40 * 31 / 30) < 0.1,
    `刘备 Boss 血量 7 倍时每秒回复 ${lbBossGain.toFixed(2)}（固定 40 点，不随倍数放大）`);

  const lrBase = heroStatsFor('liru', 30).hp;
  const lrSelf = heroCombatTraits('liru', 30).selfHeal;
  const lrBoss = createArenaBattle(
    [{ hero: 'liru', troop: 'archer', level: 30, col: 4, row: 2, hpMult: 5 }],
    [{ troop: 'shield', level: 1, col: 0, row: 4 }],
    mulberry32(28)
  );
  const lrE = lrBoss.entities.find((e) => e.hero);
  lrBoss.entities.forEach((e) => { e.speed = 0; e.cooldown = 999; e.interval = 999; });
  ok(lrE.baseMaxHp === lrBase && lrE.maxHp === lrBase * 5,
    `李儒 hpMult=5：baseMaxHp=${lrE.baseMaxHp} / maxHp=${lrE.maxHp}（未被放大）`);
  lrE.hp = lrE.maxHp - 1000;
  const lrBefore = lrE.hp;
  for (let i = 0; i < 31; i++) lrBoss.step(CONFIG.combat.step);
  const lrGain = lrE.hp - lrBefore;
  const lrExpect = lrBase * lrSelf;                      // 每秒理论值（未放大）
  const lrPerFrame = Math.max(1, Math.floor(lrBase * lrSelf * CONFIG.combat.step));
  ok(lrGain === lrPerFrame * 31 && lrGain < lrExpect,
    `李儒 Boss 5 倍时自愈 ${lrGain}（逐帧取整 ≈ baseHp×${lrSelf}=${lrExpect.toFixed(1)}/秒；若按 5 倍 maxHp 会是 ${(lrExpect * 5).toFixed(0)}）`);

  const dzBase = heroStatsFor('dongzhuo', 30).hp;
  const dzMult = heroCombatTraits('dongzhuo', 30).shieldStart.hpMult;
  const dz = createArenaBattle(
    [{ hero: 'dongzhuo', troop: 'spear', level: 30, col: 4, row: 2, hpMult: 7 }],
    [{ troop: 'shield', level: 1, col: 0, row: 4 }],
    mulberry32(29)
  );
  const dzE = dz.entities.find((e) => e.hero);
  ok(dzE.shieldMax === Math.round(dzBase * dzMult) && dzE.shieldMax < dzE.maxHp,
    `董卓 Boss 7 倍时开局护盾 ${dzE.shieldMax} = baseHp×${dzMult}（未按 7 倍 maxHp 放大）`);

  // ---- 张角：模型不变、攻击改远程弓兵口径 ----
  ok(heroById('zhangjiao').troop === 'archer' && heroArtFor('zhangjiao').weapon === 'staff',
    '张角：兵种线改远程，模型仍为法杖（不变）');
  const zjB = mkHeroBattle('zhangjiao', [{ troop: 'shield', level: 1, col: 0, row: 2 }], 24);
  const zjE = heroOf(zjB);
  const zjFoe = foesOf(zjB)[0];
  zjE.x = 15; zjE.y = 45; zjE.cooldown = 0; zjE.interval = 999;
  setPos(zjFoe, 15, 32); zjFoe.speed = 0; zjFoe.interval = 999; zjFoe.cooldown = 999;
  const zjEvents = zjB.step(CONFIG.combat.step);
  const zjHit = zjEvents.find((ev) => ev.t === 'attack' && ev.actor === zjE.uid);
  ok(zjE.ranged === true && zjE.range === CONFIG.combat.ranges.archer && zjE.stopRange === zjE.range - 2,
    `张角：远程开火（range=${zjE.range} / stopRange=${zjE.stopRange}）`);
  ok(zjE.troop === 'archer' && zjHit && zjHit.ranged === true, '张角以箭矢远程命中目标');

  // ---- 周瑜：开火 22 格 / 射程 25 格，且仍在战场可视范围内 ----
  const zyR = mkHeroBattle('zhouyu', [{ troop: 'shield', level: 1, col: 0, row: 2 }], 25);
  const zyRE = heroOf(zyR);
  const zyRFoe = foesOf(zyR)[0];
  zyRE.x = 15; zyRE.y = 45; zyRE.cooldown = 0; zyRE.interval = 999;
  setPos(zyRFoe, 15, 20); zyRFoe.speed = 0; zyRFoe.interval = 999; zyRFoe.cooldown = 999;
  ok(zyRE.range === 25 && zyRE.stopRange === 22,
    `周瑜：射程 ${zyRE.range} 格、开火距离 ${zyRE.stopRange} 格`);
  const zyREvents = zyR.step(CONFIG.combat.step);
  const zyRHit = zyREvents.find((ev) => ev.t === 'attack' && ev.actor === zyRE.uid);
  ok(zyRHit && zyRHit.damage > 0, '周瑜在 25 格射程内即可开火命中');
}

console.log('\n== 英雄战敌方构成随关卡扩兵 ==');
{
  // 队数 / 最高等级 / 出战场地都随关卡真实增长；Boss 血量倍数保持 5~10
  const rows = [1, 7, 13, 23, 28, 35, 42, 48, 50].map((n) => ({
    n,
    count: heroBattleSquads(n).length,
    maxLv: Math.max(...heroBattleSquads(n).map((q) => q.level)),
    rarity: new Set(heroBattleSquads(n).map((q) => rarityOf(q.troop))),
  }));
  ok(rows.every((r, i) => i === 0 || r.count >= rows[i - 1].count),
    `精锐队数逐关不降：${rows.map((r) => r.n + '关' + r.count + '队').join(' / ')}`);
  ok(rows.every((r, i) => i === 0 || r.maxLv >= rows[i - 1].maxLv),
    `精锐等级逐关不降：${rows.map((r) => r.n + '关Lv' + r.maxLv).join(' / ')}`);
  ok(rows[0].rarity.has('rare') && [...rows[rows.length - 1].rarity].includes('legendary'),
    '前期精锐为稀有兵种，后期加入传奇兵种（品级真实提升）');
  ok(HERO_BATTLES.every((s) => s.hpMult >= 5 && s.hpMult <= 30), 'Boss 血量倍数在 5~30 倍之间');
  ok(HERO_BATTLES.filter((s) => s.stage >= 13 && s.stage < 150)
    .every((s) => s.hpMult >= 5), '150 关扩展段血量倍数有下限，不会退化成秒杀');
}

console.log('\n== 兵牌统一排序（英雄 + 兵种混排，等级降序） ==');
{
  const st = createNewState();
  st.heroes = {};
  // 4 传奇 + 2 史诗，等级刻意打乱
  st.heroes.zhangfei = 5;
  st.heroes.guanyu = 3;
  st.heroes.dongzhuo = 5;
  st.heroes.caocao = 1;
  st.heroes.guanping = 4;
  st.heroes.zhangjiao = 2;
  st.formation = emptyFormation();
  st.units = [
    { id: 'u-legend-a', troop: 'wudang', level: 6 },   // 传奇兵种 Lv6
    { id: 'u-legend-b', troop: 'daji', level: 3 },     // 传奇兵种 Lv3
    { id: 'u-epic-a', troop: 'tengjia', level: 5 },    // 史诗兵种 Lv5
    { id: 'u-epic-b', troop: 'baier', level: 2 },      // 史诗兵种 Lv2
    { id: 'u-rare', troop: 'qingzhou', level: 4 },     // 稀有 Lv4
    { id: 'u-common', troop: 'spear', level: 7 },      // 普通 Lv7
  ];
  const game = {
    state: st, W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {}, push() {},
  };
  const ds = new DeployScreen(game, { mode: 'edit' });
  const cards = ds.buildCards();
  const ranks = cards.map((c) => cardRank(c));
  ok(ranks.join(',') === '0,0,0,0,1,1,2,2,3,3,4,5',
    '排序：传奇英雄 → 史诗英雄 → 传奇兵种 → 史诗兵种 → 稀有 → 普通');
  let descent = true;
  for (let i = 1; i < cards.length; i++) {
    if (ranks[i] !== ranks[i - 1]) continue;
    // 同档内英雄/兵种都按当前实际等级降序
    if (cards[i - 1].level < cards[i].level) descent = false;
  }
  ok(descent, `同档内按当前实际等级降序（${cards.filter((c) => c.kind === 'hero').map((c) => `${c.hero.name}${c.level}`).join('/')}）`);
  const heroLevels = cards.filter((c) => c.kind === 'hero' && c.hero.tier === 'legendary').map((c) => c.level);
  ok(heroLevels.join(',') === '5,5,3,1', `传奇英雄按等级 5/5/3/1 而不是表内 ID 顺序（实际 ${heroLevels.join('/')}）`);
  ok(cards.filter((c) => c.kind === 'hero' && c.hero.tier === 'epic').map((c) => c.level).join(',') === '4,2',
    '史诗英雄按等级 4/2 降序');

  // 兵营的 sortUnits 同一规则
  const barracksOrder = sortUnits(st.units).map((u) => `${rarityOf(u.troop)}-${u.level}`);
  ok(barracksOrder.join(',') === 'legendary-6,legendary-3,epic-5,epic-2,rare-4,common-7',
    `兵营 sortUnits 同样按品级→等级降序（${barracksOrder.join(' / ')}）`);
}

console.log('\n== 列表上下滚动（演武 / 英雄战 / 布阵 / 兵营 / 英雄页） ==');
{
  const game = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {}, push() {},
  };

  // 演武：50 关连续列表
  const trial = new TrialScreen(game);
  const tv = TRIAL_LAYOUT.view;
  ok(trial.maxScroll() > 0, `演武 50 关内容高于视口，需要上下滑（maxScroll=${trial.maxScroll()}）`);
  trial.onDown(tv.x + tv.w / 2, tv.y + 100);
  trial.onMove(tv.x + tv.w / 2, tv.y + 100 - 300);
  trial.onUp(tv.x + tv.w / 2, tv.y + 100 - 300);
  ok(trial.scrollY === 300, `演武列表手指上滑 → 内容随之下滚（scrollY=${trial.scrollY}）`);
  trial.onDown(tv.x + tv.w / 2, tv.y + 100);
  trial.onMove(tv.x + tv.w / 2, tv.y + 100 + 3000);
  trial.onUp(tv.x + tv.w / 2, tv.y + 100 + 3000);
  ok(trial.scrollY === 0, '演武列表向下拖到头被边界夹住（scrollY=0）');

  // 英雄战：50 关连续列表
  const hb = new HeroBattleScreen(game);
  const hv2 = HERO_BATTLE_LAYOUT.view;
  ok(hb.maxScroll() > 0, `英雄战 50 关需要上下滑（maxScroll=${hb.maxScroll()}）`);
  hb.onDown(hv2.x + hv2.w / 2, hv2.y + 100);
  hb.onMove(hv2.x + hv2.w / 2, hv2.y + 100 - 260);
  hb.onUp(hv2.x + hv2.w / 2, hv2.y + 100 - 260);
  ok(hb.scrollY === 260, `英雄战列表可上下滑（scrollY=${hb.scrollY}）`);
  hb.onDown(hv2.x + hv2.w / 2, hv2.y + 100);
  hb.onMove(hv2.x + hv2.w / 2, hv2.y + 100 - 9000);
  hb.onUp(hv2.x + hv2.w / 2, hv2.y + 100 - 9000);
  ok(hb.scrollY === hb.maxScroll(), `英雄战列表滑到底被夹住（scrollY=${hb.scrollY}/${hb.maxScroll()}）`);

  // 英雄页：12 名英雄一个连续列表
  const hs = new HeroScreen(game);
  const hv = HERO_LAYOUT.view;
  ok(hs.maxScroll() > 0, `英雄页 12 名英雄需要上下滑（maxScroll=${hs.maxScroll()}）`);
  hs.onDown(hv.x + 20, hv.y + 40);
  hs.onMove(hv.x + 20, hv.y + 40 - 220);
  hs.onUp(hv.x + 20, hv.y + 40 - 220);
  ok(hs.scrollY === 220 && hs.detailId === null, '英雄页上下滑翻看，不会误触发卡片点击进入详情');

  // 布阵：兵牌列表（空白处与兵牌上竖滑都算滚动）
  const depGame = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {}, push() {},
  };
  for (let i = 0; i < 14; i++) depGame.state.units.push({ id: `x${i}`, troop: 'shield', level: 1 });
  const dep = new DeployScreen(depGame, { mode: 'edit' });
  dep.cardRects = [];
  dep.cards = dep.buildCards();
  const dv = DEPLOY_LAYOUT.list.view;
  ok(dep.maxScroll() > 0, `布阵兵牌超过一屏，需要上下滑（maxScroll=${dep.maxScroll()}）`);
  dep.onDown(dv.x + 20, dv.y + 60);
  dep.onMove(dv.x + 20, dv.y + 60 - 300);
  dep.onUp(dv.x + 20, dv.y + 60 - 300);
  ok(dep.scrollY === dep.maxScroll(), `布阵列表空白处上滑到底被夹住（scrollY=${dep.scrollY}）`);

  // 兵牌上竖滑 = 滚动（不是拖拽，也不会触发点击上阵）
  dep.scrollY = 0;
  dep.cards = dep.buildCards();
  dep.cardRects = [{ rect: { x: DEPLOY_LAYOUT.list.x0, y: DEPLOY_LAYOUT.list.y0, w: 124, h: 112 }, uid: dep.cards[0].uid, kind: dep.cards[0].kind }];
  const cx0 = DEPLOY_LAYOUT.list.x0 + 60;
  const cy0 = DEPLOY_LAYOUT.list.y0 + 50;
  dep.onDown(cx0, cy0);
  dep.onMove(cx0, cy0 - 40);
  dep.onUp(cx0, cy0 - 40);
  ok(dep.scrollY === 40 && dep.pending === null && dep.drag === null, '在兵牌上竖滑只滚动列表，不误触发拖拽/点击');

  // 兵营：30 个兵牌一个连续网格
  const barracks = new BarracksScreen(game);
  game.state.units = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, troop: 'shield', level: 1 }));
  const bv = BARRACKS_LAYOUT.list.view;
  ok(barracks.maxScroll() > 0, `兵营 30 个兵牌需要上下滑（maxScroll=${barracks.maxScroll()}）`);
  barracks.cardRects = [];
  barracks.onDown(bv.x + 20, bv.y + 60);
  barracks.onMove(bv.x + 20, bv.y + 60 - 400);
  barracks.onUp(bv.x + 20, bv.y + 60 - 400);
  ok(barracks.scrollY === 400 && barracks.scrollY <= barracks.maxScroll(),
    `兵营列表可上下滑（scrollY=${barracks.scrollY} / max ${barracks.maxScroll()}）`);
  barracks.onDown(bv.x + 20, bv.y + 60);
  barracks.onMove(bv.x + 20, bv.y + 60 - 30000);
  barracks.onUp(bv.x + 20, bv.y + 60 - 30000);
  ok(barracks.scrollY === barracks.maxScroll(), `兵营列表滑到底被下边界夹住（scrollY=${barracks.scrollY}）`);

  // ---- 1.0.12：手势（长按才拿起）/ 仅查看 / 图鉴补全 / 空位白色 ----
  {
    const g = {
      state: createNewState(), W: 750, H: 1334,
      platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {}, push() {},
    };
    g.state.units = Array.from({ length: 6 }, (_, i) => ({ id: `g${i}`, troop: 'shield', level: 1 }));
    const card = { uid: 'g0', rect: { x: bv.x + 10, y: bv.y + 10, w: 120, h: 110 } };

    // 滑动 = 只滚列表，不拿起
    const slide = new BarracksScreen(g);
    slide.cardRects = [card];
    slide.onDown(bv.x + 60, bv.y + 60);
    slide.onMove(bv.x + 60, bv.y + 20);
    ok(slide.drag === null && slide.pending === null && slide.listScroll !== null,
      '可交互模式：在兵牌上滑动只滚列表，不拿起');
    slide.onUp(bv.x + 60, bv.y + 20);

    // 长按 0.25 秒才拿起
    const hold = new BarracksScreen(g);
    hold.cardRects = [card];
    hold.onDown(bv.x + 60, bv.y + 60);
    hold.update(BARRACKS_GESTURE.hold - 0.05);
    ok(hold.drag === null, `长按 ${BARRACKS_GESTURE.hold - 0.05}s 还没拿起`);
    hold.update(0.06);
    ok(hold.drag && hold.drag.uid === 'g0', `长按满 ${BARRACKS_GESTURE.hold}s 才拿起兵牌`);

    // 仅查看：拖多久都不拿起，也不会进拖拽态
    const view = new BarracksScreen(g, { viewOnly: true });
    view.cardRects = [card];
    view.onDown(bv.x + 60, bv.y + 60);
    view.update(1.5);
    ok(view.drag === null && view.pending === null, '仅查看模式：按住 1.5s 也不拿起（drag=null）');
    view.onMove(bv.x + 60, bv.y - 20);
    ok(view.drag === null && view.listScroll !== null, '仅查看模式：滑动只滚列表');

    // 图鉴：可获得 / 未解锁 / 空位三态互不重叠
    const codex = new BarracksScreen(g);
    const avail = codex.availableTroops().map((t) => t.id);
    const locked = codex.lockedTroops().map((t) => t.id);
    ok(['qingzhou', 'baier', 'xianzhen'].every((id) => avail.includes(id)),
      `图鉴包含开局三兵种（${avail.join(' / ')}）`);
    ok(!avail.some((id) => locked.includes(id)), '可获得列表与未解锁列表不重叠');
    g.state.units.push({ id: 'q1', troop: 'qingzhou', level: 1 });
    ok(!codex.availableTroops().some((t) => t.id === 'qingzhou'),
      '已拥有的青州兵不再出现在「可获得」里');
    ok(codex.totalSlots() >= g.state.units.length + codex.availableTroops().length + codex.lockedTroops().length,
      '空位网格把可获得 + 未解锁都算进总槽位');

    // 兵牌/图鉴空位已回到改动前的暗色空框（白色空框属于布阵战场，见下一节）
  }
}

console.log('\n== 布阵战场空位白框 ==');
{
  const rgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
  ok(rgb(EMPTY_SLOT_STYLE.stroke).every((c) => c >= 230),
    `布阵空位描边是白色（${EMPTY_SLOT_STYLE.stroke}）`);
  ok(EMPTY_SLOT_STYLE.fill !== EMPTY_SLOT_STYLE.stroke, '布阵空位填充与描边分开配置');

  const form = emptyFormation();
  const all = emptySlotBoxes(form);
  ok(all.length === formationSize(), `空场地画出全部 ${formationSize()} 个白框（实测 ${all.length}）`);

  form[0] = 'u1';
  form[7] = 'u2';
  const left = emptySlotBoxes(form);
  ok(left.length === formationSize() - 2, `放 2 个兵后白框数 = 总格数 - 已上阵（${left.length}）`);
  ok(left.every((b) => b.index !== 0 && b.index !== 7), '已放置单位的格子不再画白框');
  ok(left.length + form.filter(Boolean).length === formationSize(), '空格数 + 已上阵数 = 总容量（供「已上阵 x/N」提示）');

  const mid = CONFIG.arena.rows / 2;
  const onPlayerHalf = left.every((b) => {
    const { col, row } = formationCell(b.index);
    return slotToArena('player', col, row).y > mid;
  });
  ok(onPlayerHalf, '白框只落在我方半场（敌方半场不画可放置白框）');

  ok(openAllLabel(5).includes('宝箱') && openAllLabel(5).includes('5'),
    `按钮文案写清宝箱并带数量（${openAllLabel(5)}）`);
  ok(openAllLabel(0).includes('宝箱'), `无宝箱时文案仍写清宝箱（${openAllLabel(0)}）`);
}

console.log('\n== 布阵页一键开启宝箱 ==');
{
  const L = DEPLOY_LAYOUT;
  const a = L.clearRect, o = L.openAllRect, b = L.barracksRect;
  ok(o.x >= a.x + a.w && o.x + o.w <= b.x, '一键开启按钮夹在「清空」与「兵营」之间，不重叠');
  ok(o.y === L.autoRect.y && o.h === L.autoRect.h, '一键开启与同排按钮等高对齐');

  const mkGame = () => {
    const msgs = [];
    const g = {
      state: createNewState(), W: 750, H: 1334,
      platform: { vibrate() {} }, toast: (m) => msgs.push(String(m)),
      save() {}, pop() {}, go() {}, push() {}, msgs,
    };
    return g;
  };
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;

  // 没有宝箱：点了只提示，不会悄悄什么都不做
  const g0 = mkGame();
  const d0 = new DeployScreen(g0, { mode: 'edit' });
  d0.onDown(cx, cy);
  ok(g0.state.units.length === 4 && g0.msgs.some((m) => m.includes('没有待开启的宝箱')),
    `无宝箱时按钮不可用：${g0.msgs[0] || '（无提示）'}`);

  // 有宝箱：一次开完，兵直接进兵牌
  const g1 = mkGame();
  addChest(g1.state, 'wood', 2);
  addChest(g1.state, 'gold', 2);
  const d1 = new DeployScreen(g1, { mode: 'edit' });
  const n0 = g1.state.units.length;
  d1.onDown(cx, cy);
  ok(chestTotal(g1.state) === 0 && g1.state.units.length === n0 + 4,
    `一键开启后宝箱归零、兵牌 +4（${n0}→${g1.state.units.length}）`);
  ok(g1.msgs.some((m) => m.includes('已开启 4 个宝箱')), `汇总提示写清宝箱：${g1.msgs[0]}`);

  // 兵牌已满：不消耗宝箱，明确提示
  const g2 = mkGame();
  addChest(g2.state, 'wood', 3);
  while (g2.state.units.length < 300) g2.state.units.push({ id: `z${g2.state.units.length}`, troop: 'shield', level: 1 });
  const d2 = new DeployScreen(g2, { mode: 'edit' });
  d2.onDown(cx, cy);
  ok(chestTotal(g2.state) === 3 && g2.msgs.some((m) => m.includes('兵牌已满')),
    '兵牌已满时不开箱、给出「兵牌已满」提示');
}

console.log('\n== 英雄拖动放置与普通兵互换 ==');
{
  const game = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {}, push() {},
  };
  const ds = new DeployScreen(game, { mode: 'edit' });
  game.state.maxCleared = 200; // 1 个英雄位，用于验证「列表拖到空位上阵」
  const p0 = deploySlotPoint(0);
  const p5 = deploySlotPoint(5);

  // 1) 场上的普通兵拖到英雄格 = 两者互换
  game.state.heroes = { zhangfei: 1 };
  game.state.formation = emptyFormation();
  const unitId = game.state.units[0].id;
  game.state.formation[0] = unitId;
  game.state.formation[5] = 'h:zhangfei';
  ds.onDown(p0.x, p0.y);
  ds.onMove(p0.x, p0.y - 40);
  ds.onUp(p5.x, p5.y);
  ok(game.state.formation[5] === unitId && game.state.formation[0] === 'h:zhangfei',
    '普通兵拖到英雄格：双方直接互换位置');

  // 2) 场上的英雄拖到普通兵格 = 反向互换
  ds.onDown(p0.x, p0.y);      // slot0 现在是英雄
  ds.onMove(p0.x, p0.y - 40);
  ds.onUp(p5.x, p5.y);
  ok(game.state.formation[0] === unitId && game.state.formation[5] === 'h:zhangfei',
    '英雄从场上拖到普通兵格：反向互换成功');

  // 3) 从兵牌列表把英雄拖到空位上阵
  game.state.formation = emptyFormation();
  const heroCardIndex = ds.buildCards().findIndex((c) => c.kind === 'hero');
  const cardX = DEPLOY_LAYOUT.list.x0 + (heroCardIndex % 5) * 134 + 60;
  const cardY = DEPLOY_LAYOUT.list.y0 + Math.floor(heroCardIndex / 5) * 122 + 50;
  ds.cardRects = [{
    rect: { x: cardX - 60, y: cardY - 50, w: 124, h: 112 },
    uid: 'h:zhangfei', kind: 'hero',
  }];
  ds.onDown(cardX, cardY);
  ds.onMove(cardX, DEPLOY_LAYOUT.list.view.y - 120);
  const p7 = deploySlotPoint(7);
  ds.onUp(p7.x, p7.y);
  ok(game.state.formation[7] === 'h:zhangfei', '英雄可拖动放置：从兵牌列表拖到空位上阵');

  // 4) 英雄拖回列表 = 撤下
  ds.onDown(p7.x, p7.y);
  ds.onMove(p7.x, DEPLOY_LAYOUT.list.view.y + 80);
  ds.onUp(p7.x, DEPLOY_LAYOUT.list.view.y + 80);
  ok(!game.state.formation.includes('h:zhangfei'), '英雄拖回兵牌列表 = 撤下');
}

console.log('\n== 布阵手势 / 招募入口 / 按战力布阵带英雄 ==');
{
  const pushed = [];
  const game = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {},
    push(s) { pushed.push(s.constructor ? s.constructor.name : String(s)); },
  };
  const ds = new DeployScreen(game, { mode: 'edit' });
  // 4 张普通兵牌都在列表里（开局存档可能已经把它们摆上场）
  game.state.formation = emptyFormation();
  // 12 张兵牌 → 3 行，列表确实能滚（否则 maxScroll=0，测不出「竖滑=滚动」）
  game.state.units = Array.from({ length: 12 }, (_, i) => ({
    id: `x${i + 1}`, troop: ['shield', 'archer', 'spear', 'cavalry'][i % 4], level: 1,
  }));
  ds.cards = ds.buildCards();
  // 与真实绘制一致的兵牌位置（首行前 5 张）
  const mkRects = () => ds.cards.slice(0, 10).map((c, i) => ({
    rect: {
      x: DEPLOY_LAYOUT.list.x0 + (i % 5) * (124 + 10),
      y: DEPLOY_LAYOUT.list.y0 + Math.floor(i / 5) * (112 + 10) - ds.scrollY,
      w: 124, h: 112,
    },
    uid: c.uid, kind: c.kind,
  }));
  ds.cardRects = mkRects();
  const card0 = ds.cardRects[0];
  const cx = card0.rect.x + 60;
  const cy = card0.rect.y + 50;

  // 1) 横向拖动 → 拿起兵牌 → 拖到上阵位 → 位置真的变了
  ds.onDown(cx, cy);
  ds.onMove(cx + LIST_GESTURE.horizontal + 6, cy + 2);
  ok(ds.drag && ds.drag.uid === card0.uid, `横向拖动 ${LIST_GESTURE.horizontal + 6}px 拿起兵牌（${ds.drag && ds.drag.source}）`);
  const slot0 = deploySlotPoint(0);
  ds.onMove(slot0.x, slot0.y);
  ds.onUp(slot0.x, slot0.y);
  ok(game.state.formation[0] === card0.uid, '拖动放牌后上阵位写入该兵牌（位置真的变了）');
  ok(game.state.units.every((u) => game.state.formation.indexOf(u.id) === -1
    || game.state.formation.indexOf(u.id) === 0), '该兵牌已从下方列表上阵，不会重复出现');
  ok(ds.scrollY === 0, '拖拽放牌不会顺带滚动列表');

  // 2) 竖滑 → 只滚动，不拿起、不误触发点击
  ds.scrollY = 0;
  ds.cardRects = mkRects();
  const c2 = ds.cardRects[1];
  ds.onDown(c2.rect.x + 60, c2.rect.y + 50);
  ds.onMove(c2.rect.x + 60, c2.rect.y + 50 - 40);
  ok(ds.drag === null && ds.pending === null, '纵向滑动不会拿起兵牌');
  ds.onUp(c2.rect.x + 60, c2.rect.y + 50 - 40);
  ok(ds.scrollY === 40, `纵向滑动只滚动列表（scrollY=${ds.scrollY}）`);

  // 3) 按住不动超过阈值 → 拿起（之后竖着拖也算放牌）
  ds.scrollY = 0;
  ds.cardRects = mkRects();
  const c3 = ds.cardRects[2];
  ds.onDown(c3.rect.x + 60, c3.rect.y + 50);
  ds.update(LIST_GESTURE.hold + 0.02);
  ok(ds.drag && ds.drag.uid === c3.uid, '按住兵牌 0.25 秒直接拿起（竖拖也能放牌）');
  ds.onMove(c3.rect.x + 60, c3.rect.y - 300);
  ok(ds.drag.moved === true, '拿起后向上竖拖仍是放牌，不会变成滚动');
  ds.onUp(50, 40);  // 丢在场上以外 = 不落位
  ok(game.state.formation.filter(Boolean).length === 1, '拖到无效位置不会多摆单位');

  // 4) 「招募 / 升级」入口已移除：原地点击不再跳英雄页
  ok(DEPLOY_LAYOUT.heroRecruitRect === undefined, '布阵页布局里已没有「招募 / 升级」按钮');
  ds.heroDetail = null;
  ds.onDown(306 + 100, 880 + 26);
  ds.onUp(306 + 100, 880 + 26);
  ok(pushed.length === 0, `原招募入口位置点击不再打开任何页面（push=${pushed.join('/') || '无'}）`);

  // 5) 按战力布阵：英雄按兵种线自动入阵，最多 3 名（1000 关后 3 个英雄位全开）
  const st2 = createNewState();
  st2.maxCleared = 1000;
  st2.heroes = { zhangfei: 1, guanyu: 1, liubei: 1, zhouyu: 1 };
  st2.formation = emptyFormation();
  st2.units = [
    { id: 's1', troop: 'shield', level: 1 }, { id: 's2', troop: 'shield', level: 2 },
    { id: 'a1', troop: 'archer', level: 1 }, { id: 'p1', troop: 'spear', level: 1 },
    { id: 'c1', troop: 'cavalry', level: 1 },
  ];
  const game2 = {
    state: st2, W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {}, push() {},
  };
  const ds2 = new DeployScreen(game2, { mode: 'edit' });
  ds2.autoArrange();
  const heroSlots = st2.formation.map((v, i) => ({ v, i })).filter((x) => x.v && String(x.v).startsWith('h:'));
  ok(heroSlots.length === 3, `一键布阵上阵英雄 ${heroSlots.length} 名（上限 3）`);
  let allMatch = true;
  for (const { v, i } of heroSlots) {
    const hero = heroById(heroIdFromEntry(v));
    const col = formationCell(i).col;
    if (!troopColumns(hero.troop).includes(col)) allMatch = false;
  }
  ok(allMatch, '每个英雄都落在自己兵种的可选列（盾/枪前排、骑兵第 2 排、弓兵后排）');
  ok(st2.formation.filter((v) => v && String(v).startsWith('h:')).length <= CONFIG.heroes.maxDeploy,
    `英雄数量不超过上限 ${CONFIG.heroes.maxDeploy}`);

  // 6) 没有可用英雄时，一键布阵照常按兵种布阵
  const st3 = createNewState();
  st3.heroes = {};
  st3.formation = emptyFormation();
  const game3 = { state: st3, W: 750, H: 1334, toast() {}, save() {}, pop() {} };
  new DeployScreen(game3, { mode: 'edit' }).autoArrange();
  ok(st3.formation.filter(Boolean).length > 0 && !st3.formation.some((v) => v && String(v).startsWith('h:')),
    '没有英雄时仍能正常按兵种布阵');
}

console.log('\n== 英雄卡走同一套列表拖拽 / 上阵位限制 ==');
{
  const mkGame = (maxCleared, heroes) => {
    const state = createNewState();
    state.maxCleared = maxCleared;
    state.heroes = heroes;
    state.formation = emptyFormation();
    state.units = Array.from({ length: 12 }, (_, i) => ({
      id: `u${i + 1}`, troop: ['shield', 'archer', 'spear', 'cavalry'][i % 4], level: 1,
    }));
    const toasts = [];
    return {
      state, W: 750, H: 1334, platform: { vibrate() {} }, toasts,
      toast(m) { toasts.push(m); }, save() {}, pop() {}, go() {}, push() {},
    };
  };
  const game = mkGame(600, { zhangfei: 1, guanyu: 1 });
  const ds = new DeployScreen(game, { mode: 'edit' });
  // 模拟列表已经向上滚了 30px：兵牌命中框必须跟着 scrollY 偏移
  ds.scrollY = 30;
  ds.cards = ds.buildCards();
  ds.cardRects = ds.cards.slice(0, 10).map((c, i) => ({
    rect: {
      x: DEPLOY_LAYOUT.list.x0 + (i % 5) * (124 + 10),
      y: DEPLOY_LAYOUT.list.y0 + Math.floor(i / 5) * (112 + 10) - ds.scrollY,
      w: 124, h: 112,
    },
    uid: c.uid, kind: c.kind,
  }));
  const heroCard = ds.cardRects.find((c) => c.uid === 'h:zhangfei');
  ok(heroCard, '滚动后英雄卡仍在可命中的列表视口内');
  const hx = heroCard.rect.x + 60;
  const hy = heroCard.rect.y + 50;
  ds.onDown(hx, hy);
  ds.onMove(hx + LIST_GESTURE.horizontal + 6, hy + 2);
  ok(ds.drag && ds.drag.uid === 'h:zhangfei' && ds.drag.source === 'pool',
    `英雄卡与普通兵同一套 pending→liftCard 路径（source=${ds.drag && ds.drag.source}）`);
  const slot1 = deploySlotPoint(1);
  ds.onMove(slot1.x, slot1.y);
  ds.onUp(slot1.x, slot1.y);
  ok(game.state.formation[1] === 'h:zhangfei', '英雄卡从列表拖到上阵位：位置真的变了');

  // 英雄卡竖滑不抢滚动（从列表顶部开始，避免滑出列表上沿被当成「拖到场上」）
  ds.scrollY = 0;
  ds.cardRects = ds.cards.slice(0, 10).map((c, i) => ({
    rect: {
      x: DEPLOY_LAYOUT.list.x0 + (i % 5) * (124 + 10),
      y: DEPLOY_LAYOUT.list.y0 + Math.floor(i / 5) * (112 + 10) - ds.scrollY,
      w: 124, h: 112,
    },
    uid: c.uid, kind: c.kind,
  }));
  const gc = ds.cardRects.find((c) => c.uid === 'h:guanyu');
  ds.onDown(gc.rect.x + 60, gc.rect.y + 50);
  ds.onMove(gc.rect.x + 60, gc.rect.y + 50 - 40);
  ok(ds.drag === null && ds.pending === null, '英雄卡纵向滑动不会误拿起');
  ds.onUp(gc.rect.x + 60, gc.rect.y + 50 - 40);
  ok(ds.scrollY === 40, `英雄卡竖滑只滚动列表（scrollY=${ds.scrollY}）`);

  // 英雄拖回列表 = 撤下
  const p1 = deploySlotPoint(1);
  ds.onDown(p1.x, p1.y);
  ds.onMove(p1.x, DEPLOY_LAYOUT.list.view.y + 80);
  ds.onUp(p1.x, DEPLOY_LAYOUT.list.view.y + 80);
  ok(!game.state.formation.includes('h:zhangfei'), '英雄拖回兵牌列表 = 取消上阵');

  // 499 关只有 1 个英雄位：第 2 名英雄从列表拖上场被拒绝并提示 500 关
  const game499 = mkGame(499, { zhangfei: 1, guanyu: 1 });
  const ds499 = new DeployScreen(game499, { mode: 'edit' });
  ds499.cards = ds499.buildCards();
  ds499.cardRects = ds499.cards.slice(0, 10).map((c, i) => ({
    rect: {
      x: DEPLOY_LAYOUT.list.x0 + (i % 5) * (124 + 10),
      y: DEPLOY_LAYOUT.list.y0 + Math.floor(i / 5) * (112 + 10),
      w: 124, h: 112,
    },
    uid: c.uid, kind: c.kind,
  }));
  const zf = ds499.cardRects.find((c) => c.uid === 'h:zhangfei');
  ds499.onDown(zf.rect.x + 60, zf.rect.y + 50);
  ds499.onMove(zf.rect.x + 60 + LIST_GESTURE.horizontal + 6, zf.rect.y + 50);
  const s0 = deploySlotPoint(0);
  ds499.onMove(s0.x, s0.y);
  ds499.onUp(s0.x, s0.y);
  ok(game499.state.formation[0] === 'h:zhangfei', '499 关：第 1 名英雄可以上阵');
  const gy = ds499.cardRects.find((c) => c.uid === 'h:guanyu');
  ds499.onDown(gy.rect.x + 60, gy.rect.y + 50);
  ds499.onMove(gy.rect.x + 60 + LIST_GESTURE.horizontal + 6, gy.rect.y + 50);
  const s2 = deploySlotPoint(2);
  ds499.onMove(s2.x, s2.y);
  ds499.onUp(s2.x, s2.y);
  ok(!game499.state.formation.includes('h:guanyu') && game499.toasts.some((t) => t.includes('500')),
    `499 关：第 2 名英雄被上阵位限制拒绝并提示 500 关（${game499.toasts.join(' / ')}）`);
}

console.log('\n== 兵种解锁机制（宝箱 / 商店 / 广告过滤） ==');
{
  const st0 = createNewState();
  ok(troopUnlockLevel('qingzhou') === 0 && troopUnlockLevel('baier') === 0 && troopUnlockLevel('xianzhen') === 0,
    '开局已解锁：稀有青州兵 / 史诗白毦兵 / 传奇陷阵营');
  const table = {
    qingzhu: 20, youzhou: 50, xiandeng: 80, tengjia: 100, wudang: 120,
    yuanyong: 130, baima: 150, huhao: 180, daji: 200,
  };
  for (const [id, lv] of Object.entries(table)) {
    const t = troopById(id);
    ok(troopUnlockLevel(id) === lv, `${t.name} 解锁阈值 = 第 ${lv} 关`);
  }
  let st = createNewState();
  st.maxCleared = 19;
  ok(!troopUnlocked(st, 'qingzhu'), '第 19 关：青竹弓手仍未解锁');
  st.maxCleared = 20;
  refreshTroopUnlocks(st);
  ok(troopUnlocked(st, 'qingzhu') && st.troopUnlocks.includes('qingzhu'),
    '第 20 关：青竹弓手解锁并写入存档 troopUnlocks');
  ok(troopUnlocked(st, 'baima') === false, '第 20 关：白马义从仍锁定（150 关）');
  ok(!troopUnlocked(st, 'huhao') && troopUnlockLevel('huhao') - st.maxCleared === 160,
    '未解锁节点可算出「还差多少关」');

  // 宝箱：所有品级池都只出已解锁兵种
  let lockedDrop = null;
  for (const type of chestTypes()) {
    for (let i = 0; i < 30 && !lockedDrop; i++) {
      const r = rollChest(type.id, mulberry32(i + 1), st);
      if (r && !troopUnlocked(st, r.troop)) lockedDrop = { chest: type.id, troop: r.troop };
    }
  }
  ok(!lockedDrop, lockedDrop ? `宝箱掉出了未解锁兵种 ${lockedDrop.troop}（${lockedDrop.chest}）`
    : '全部宝箱在 20 关进度下都不会掉出未解锁兵种');
  ok(troopPool('rare', st).join(',') === 'qingzhou,qingzhu',
    `稀有宝箱池只剩已解锁的 ${troopPool('rare', st).join(' / ')}`);
  ok(troopPool('legendary', st).join(',') === 'xianzhen',
    '传奇宝箱池只剩开局的陷阵营（无当 / 虎豹 / 大戟仍锁）');

  // 每日商店：货架只上已解锁兵种（100 关：稀有 4 个全开、史诗只开白毦）
  st.maxCleared = 100;
  const offers = dailyShopOffers(st, 1700000000000).slots;
  ok(offers.length > 0 && offers.every((s) => troopUnlocked(st, s.troop)),
    `每日商店 ${offers.length} 个货架全部是已解锁兵种`);
  ok(!offers.some((s) => ['yuanyong', 'baima'].includes(s.troop)),
    '每日商店不会提前上架元戎弩士 / 白马义从');
}

console.log('\n== 主线 9–50 关战力曲线（本轮抬血后）==');
{
  // 全兵种血量上调后，战力口径随之上移；这里守住「整体递增 + 不出现离谱跳变」两条线。
  const powerAt = (n) => levelDef(n).enemies.reduce((s, e) => s + troopPower(e.troop, e.level), 0);
  ok(powerAt(50) > powerAt(25) && powerAt(25) > powerAt(15) && powerAt(15) > powerAt(9),
    `9/15/25/50 关战力 ${Math.round(powerAt(9))} → ${Math.round(powerAt(15))} → ${Math.round(powerAt(25))} → ${Math.round(powerAt(50))}`);
  let prev = null;
  let maxRise = 0;
  let at = '';
  for (let n = 9; n <= 50; n++) {
    const p = powerAt(n);
    if (prev && p / prev > maxRise) {
      maxRise = p / prev;
      at = `${n - 1}→${n}`;
    }
    prev = p;
  }
  ok(maxRise <= 1.38, `9–50 关相邻关最大涨幅 ${((maxRise - 1) * 100).toFixed(1)}%（${at}，≤38%）`);
  ok(powerAt(50) < powerAt(80), '第 50 关仍低于第 80 关（没有为了新手期把后段压塌）');
}

console.log('\n== 战败页：克制闭环 & 广告得兵 ==');
{
  const order = ['shield', 'archer', 'spear', 'cavalry'];
  const pct = (a, b) => {
    const c = CONFIG.counters.find((x) => x.attacker === a && x.defender === b);
    return Math.round((c.mult - 1) * 100);
  };
  const links = order.map((a, i) => [a, order[(i + 1) % order.length]]);
  ok(links.map(([a, b]) => `${a}>${b}`).join(',') === 'shield>archer,archer>spear,spear>cavalry,cavalry>shield',
    '克制闭环：盾→弓→枪→骑→盾');
  // 克制系数本轮 1.1/0.9 → 1.2/0.85，界面百分比随配置走：克制 +20% / 被克 −15%
  for (const [a, b] of links) {
    ok(pct(a, b) === 20 && pct(b, a) === -15,
      `${unitName(b, 1)} 对 ${unitName(a, 1)}：克制 ${pct(a, b)}% / 被克 ${pct(b, a)}%`);
  }
  ok(CONFIG.counters.length === 8, 'CONFIG.counters 8 条正反关系，界面百分比直接取实际倍率');

  // 战败页广告：试用兵（史诗 / 传奇各半），5 场主线后消失
  const seq = (...vals) => {
    let i = 0;
    return () => vals[Math.min(i++, vals.length - 1)];
  };
  ok(TRIAL_ROUNDS === 5, '试用兵持续 5 个回合（= 5 场主线）');
  const tierCases = [
    [1, 3, 2], [200, 3, 2], [201, 4, 3], [400, 4, 3], [401, 5, 4],
    [600, 5, 4], [601, 6, 5], [1000, 6, 5], [1001, 7, 6], [2600, 7, 6],
  ];
  for (const [lvl, epic, legendary] of tierCases) {
    ok(trialLevelFor(lvl, 'epic') === epic && trialLevelFor(lvl, 'legendary') === legendary,
      `第 ${lvl} 关试用兵档位：史诗 Lv${epic} / 传奇 Lv${legendary}`);
  }
  ok(TRIAL_LEVEL_TIERS.length === 5, '试用兵等级共 5 档');
  const tr = createNewState();
  const epicRoll = rollTrialTroop(160, seq(0.1, 0.5));
  ok(epicRoll.rarity === 'epic' && epicRoll.level === 3 && epicRoll.trial && epicRoll.rounds === 5,
    `rand<0.5 抽史诗：Lv${epicRoll.level} ${unitName(epicRoll.troop, 1)}`);
  const legRoll = rollTrialTroop(160, seq(0.9, 0.5));
  ok(legRoll.rarity === 'legendary' && legRoll.level === 2,
    `rand>=0.5 抽传奇：Lv${legRoll.level} ${unitName(legRoll.troop, 1)}`);
  ok(rarityOf(epicRoll.troop) === 'epic' && rarityOf(legRoll.troop) === 'legendary',
    '试用兵从史诗 / 传奇池抽取');
  // 连抽 200 次：两种品级都出现，且等级永远落在档位内
  let sawEpic = false;
  let sawLegendary = false;
  for (let i = 0; i < 200; i++) {
    const r = rollTrialTroop(700, mulberry32(i + 5));
    sawEpic = sawEpic || r.rarity === 'epic';
    sawLegendary = sawLegendary || r.rarity === 'legendary';
    ok(r.level === trialLevelFor(700, r.rarity), `第 700 关 ${r.rarity} 等级 = ${r.level}`);
  }
  ok(sawEpic && sawLegendary, '史诗 / 传奇各半概率（连抽 200 次两者都出）');

  // 领取：进兵营、带 5 回合；再次领取替换旧的（只保留 1 个试用兵）
  ensureAds(tr, 1700000000000);
  const trialReward = rollTrialTroop(300, seq(0.1, 0.4));
  const claimed = claimDefeatTroop(tr, trialReward, 1700000000000);
  ok(claimed.ok && isTrialUnit(claimed.unit) && claimed.unit.trialLeft === TRIAL_ROUNDS,
    '看广告发放的是带 5 回合倒计时的试用兵');
  ok(tr.units.filter(isTrialUnit).length === 1, '同时只保留 1 个试用兵');
  const reward2 = rollTrialTroop(300, seq(0.9, 0.4));
  claimDefeatTroop(tr, reward2, 1700000000000);
  ok(tr.units.filter(isTrialUnit).length === 1 && trialUnits(tr)[0].troop === reward2.troop,
    '再次领取会替换旧的试用兵，不会叠加');

  // 5 场主线：每场 -1，第 5 场结束后从兵营与布阵里一起消失
  const tt = createNewState();
  const tu = addTrialUnit(tt, { troop: 'huhao', level: 4 });
  tt.formation[0] = tu.id;
  ok(tu.trialLeft === 5 && isTrialUnit(tu), '新试用兵剩余 5 回合');
  for (let i = 4; i >= 1; i--) {
    const gone = tickTrialRounds(tt);
    ok(gone.length === 0 && tu.trialLeft === i, `打完第 ${5 - i} 场主线，剩余 ${tu.trialLeft} 回合`);
  }
  const expired = tickTrialRounds(tt);
  ok(expired.length === 1 && tt.units.indexOf(tu) === -1 && tt.formation[0] === null,
    '第 5 场结束后试用兵自动消失（兵营 + 布阵同时清掉）');

  // 不可合成：目标 / 材料任一方是试用兵都拒绝，一键合成也会跳过
  const mt = createNewState();
  mt.units = [];
  mt.formation = new Array(25).fill(null);
  const mtTrial = addTrialUnit(mt, { troop: 'shield', level: 1 });
  mt.units.push({ id: 'normal1', troop: 'shield', level: 1 });
  ok(mergeUnits(mt, mtTrial.id, 'normal1').reason === 'trial', '试用兵作为合成目标会被拒绝');
  ok(mergeUnits(mt, 'normal1', mtTrial.id).reason === 'trial', '试用兵作为合成材料会被拒绝');
  ok(!mergeCandidates(mt, mtTrial.id).length, '试用兵没有合成候选');
  ok(autoMerge(mt) === 0, '一键合成跳过试用兵');
  mt.units.push({ id: 'normal2', troop: 'shield', level: 1 });
  ok(autoMerge(mt) === 1 && mt.units.some(isTrialUnit), '一键合成只合并普通兵，试用兵原样保留');

  // 闯关以外的模式：斩将快照不含试用兵
  const gt = createNewState();
  gt.maxCleared = CONFIG.gauntlet.unlockLevel;
  gt.units = [];
  gt.formation = new Array(25).fill(null);
  const gtTrial = addTrialUnit(gt, { troop: 'huhao', level: 3 });
  gt.units.push({ id: 'gn1', troop: 'shield', level: 1 });
  gt.formation[0] = gtTrial.id;
  gt.formation[1] = 'gn1';
  const gStarted = startGauntletRun(gt, 'sishui');
  ok(gStarted.ok && gt.gauntlet.run.units.length === 1
    && !gt.gauntlet.run.units.some((u) => u.troop === 'huhao'),
    '斩将快照排除试用兵（只剩正常兵）');
  // 演武 / 英雄战开局：试用兵从布阵里撤下（列表里再置灰）
  const ht = createNewState();
  ht.units = [];
  ht.formation = new Array(25).fill(null);
  const hTrial = addTrialUnit(ht, { troop: 'daji', level: 4 });
  ht.formation[2] = hTrial.id;
  ok(stripTrialFromFormation(ht) === 1 && ht.formation[2] === null && ht.units.length === 1,
    '演武 / 英雄战开局把试用兵撤下布阵（兵牌仍留在兵营）');
}

console.log('\n== 特殊兵种关卡档位等级上限 ==');
{
  // 100~249 关：稀有 ≤ Lv4；200~249 关：史诗 ≤ Lv5；250 关后放开
  const capCase = (level, troop, want) => {
    const st = createNewState();
    st.maxCleared = level;
    ok(troopLevelCap(st, troop) === want, `第 ${level} 关 ${unitName(troop, 1)} 等级上限 ${troopLevelCap(st, troop)}（期望 ${want}）`);
    ok(capTroopLevel(st, troop, 99) === want, `第 ${level} 关 ${unitName(troop, 1)} Lv99 夹到 ${capTroopLevel(st, troop, 99)}（期望 ${want}）`);
  };
  capCase(99, 'qingzhou', 10);
  capCase(100, 'qingzhou', 4);
  capCase(199, 'qingzhou', 4);
  capCase(249, 'qingzhou', 4);
  capCase(250, 'qingzhou', 10);
  capCase(199, 'baima', 10);
  capCase(200, 'baima', 5);
  capCase(249, 'baima', 5);
  capCase(250, 'baima', 10);
  const commonSt = createNewState();
  commonSt.maxCleared = 150;
  ok(troopLevelCap(commonSt, 'shield') === 10, '普通兵不受档位上限影响（盾兵仍可到 Lv10）');

  // 路径 1：宝箱产出（任意随机序列都不越过上限）
  for (const level of [150, 220]) {
    const st = createNewState();
    st.maxCleared = level;
    let bad = null;
    for (const id of ['wood', 'silver', 'gold', 'epic', 'legendary', 'rare']) {
      for (let i = 0; i < 30; i++) {
        const r = rollChest(id, mulberry32(i + level), st);
        if (r && r.level > troopLevelCap(st, r.troop)) bad = `${id}:${r.troop}:Lv${r.level}`;
      }
    }
    ok(!bad, bad ? `第 ${level} 关宝箱越上限 ${bad}` : `第 ${level} 关宝箱产出全部 ≤ 档位上限`);
  }

  // 路径 2：每日商店货架
  for (const level of [150, 220]) {
    const st = createNewState();
    st.maxCleared = level;
    const offers = dailyShopOffers(st, 1700000000000).slots;
    ok(offers.every((o) => o.level <= troopLevelCap(st, o.troop)),
      `第 ${level} 关商店货架等级全部 ≤ 档位上限（${offers.map((o) => `${o.troop}Lv${o.level}`).join('/')}）`);
  }

  // 路径 3：失败页广告奖励
  for (const level of [150, 220]) {
    const st = createNewState();
    st.maxCleared = level;
    let bad = null;
    for (let i = 0; i < 30; i++) {
      const r = rollDefeatTroop(st, level + 60, mulberry32(i + 1));
      if (r.level > troopLevelCap(st, r.troop)) bad = `${r.troop}:Lv${r.level}`;
    }
    ok(!bad, bad ? `第 ${level} 关广告兵越上限 ${bad}` : `第 ${level} 关广告奖励全部 ≤ 档位上限`);
  }

  // 路径 4：合成升级（到顶后 mergeCandidates / mergeUnits / autoMerge 全部拦截）
  const mergeSt = createNewState();
  mergeSt.maxCleared = 150;
  mergeSt.formation = emptyFormation();
  mergeSt.units = [
    { id: 'r1', troop: 'qingzhou', level: 4 }, { id: 'r2', troop: 'qingzhou', level: 4 },
    { id: 'r3', troop: 'qingzhou', level: 3 }, { id: 'r4', troop: 'qingzhou', level: 3 },
  ];
  ok(mergeCandidates(mergeSt, 'r1').length === 0, '150 关稀有 Lv4 不再有合成候选');
  ok(mergeUnits(mergeSt, 'r1', 'r2').reason === 'cap', '150 关稀有 Lv4 → Lv5 被拒绝（reason=cap）');
  ok(mergeCandidates(mergeSt, 'r3').length === 1, '150 关稀有 Lv3 仍可合成到 Lv4');
  ok(mergeUnits(mergeSt, 'r3', 'r4').ok && mergeSt.units.find((u) => u.id === 'r3').level === 4,
    '150 关稀有 Lv3 → Lv4 合成成功');
  ok(autoMerge(mergeSt) === 0, '150 关 autoMerge 不会把稀有兵推过 Lv4');

  const epicSt = createNewState();
  epicSt.maxCleared = 220;
  epicSt.formation = emptyFormation();
  epicSt.units = [
    { id: 'e1', troop: 'baima', level: 5 }, { id: 'e2', troop: 'baima', level: 5 },
  ];
  ok(mergeUnits(epicSt, 'e1', 'e2').reason === 'cap', '220 关史诗 Lv5 → Lv6 被拒绝');
  epicSt.maxCleared = 250;
  ok(mergeUnits(epicSt, 'e1', 'e2').ok && epicSt.units.find((u) => u.id === 'e1').level === 6,
    '250 关后史诗 Lv5 → Lv6 解禁');

  // 附加：7 日登录第 6 天「6 级白马义从」同样受上限约束（不能绕开）
  const loginSt = createNewState();
  loginSt.maxCleared = 220;
  ensureDaily(loginSt, 1700000000000);
  loginSt.daily.loginDays = 5;
  const loginReward = claimLoginDay(loginSt, 1700000000000);
  ok(loginReward.ok && loginReward.unit && loginReward.unit.troop === 'baima'
    && loginReward.unit.level === 5,
    `220 关领取第 6 天奖励：白马义从夹到 Lv${loginReward.unit && loginReward.unit.level}（奖励标注 Lv${loginReward.reward.level}）`);
}

console.log('\n== 成长之路节点 & 滚动 ==');
{
  const levels = GROWTH_NODES.map((n) => n.level);
  ok(GROWTH_NODES.length === 21, `成长之路共 ${GROWTH_NODES.length} 个节点（9 兵种 + 12 功能）`);
  ok(levels.join(',') === '3,10,20,30,30,30,30,50,80,100,100,120,130,150,150,180,200,200,250,400,800',
    `节点按关卡升序：${levels.join(' / ')}`);
  const troopNodes = GROWTH_NODES.filter((n) => n.kind === 'troop');
  ok(troopNodes.length === 9 && troopNodes.every((n) => n.troop && CONFIG.troops.some((t) => t.id === n.troop)),
    '9 个兵种节点都带可用建模图标（troop id）');
  ok(GROWTH_NODES.filter((n) => n.kind === 'feature').length === 12,
    '12 个功能节点：自动战斗 / 战斗加速 / 每日登录 / 每日商店 / 演武 / 英雄战 / 周常 / 每日挑战 / 成就 + 3 个宝箱加成');
  ok(GROWTH_NODES.find((n) => n.id === 'speed').level === 10,
    '战斗加速节点跟随 CONFIG：第 10 关开放');
  ok(['weekly', 'dailyChallenge', 'achievements'].every((id) => {
    const n = GROWTH_NODES.find((x) => x.id === id);
    return n && n.level === 30 && n.kind === 'feature';
  }), '1.2.5 三模式节点（周常 / 每日挑战 / 成就）都在第 30 关');

  const st = createNewState();
  st.maxCleared = 100;
  const unlocked = GROWTH_NODES.filter((n) => growthStatus(st, n).unlocked);
  ok(unlocked.length === 11, `100 关进度：已解锁 ${unlocked.length} 个节点（≤100 关的 11 个）`);
  const next = GROWTH_NODES.find((n) => !growthStatus(st, n).unlocked);
  ok(next.level === 120 && growthStatus(st, next).remain === 20,
    `下一目标第 ${next.level} 关 ${next.title}（还差 ${growthStatus(st, next).remain} 关）`);
  st.maxCleared = 2;
  ok(!growthStatus(st, GROWTH_NODES.find((n) => n.id === 'autoBattle')).unlocked,
    '第 2 关：自动战斗仍锁定');
  st.maxCleared = 3;
  ok(growthStatus(st, GROWTH_NODES.find((n) => n.id === 'autoBattle')).unlocked
    && !growthStatus(st, GROWTH_NODES.find((n) => n.id === 'daily')).unlocked,
    '第 3 关：自动战斗已解锁，每日登录仍未开放');

  const game = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {}, push() {},
  };
  const gs = new GrowthScreen(game);
  ok(gs.maxScroll() > 0, `成长之路内容高于视口，需要上下滑（maxScroll=${gs.maxScroll()}）`);
  const v = GROWTH_LAYOUT.view;
  gs.onDown(v.x + 200, v.y + 200);
  gs.onMove(v.x + 200, v.y + 200 - 420);
  gs.onUp();
  ok(gs.scrollY === 420, `成长之路手指上滑 420 → scrollY=${gs.scrollY}`);
  gs.onDown(v.x + 200, v.y + 200);
  gs.onMove(v.x + 200, v.y + 200 - 5000);
  gs.onUp();
  ok(gs.scrollY === gs.maxScroll(), `成长之路滑到底被下边界夹住（scrollY=${gs.scrollY}）`);
}

console.log('\n== 新手引导（纯手势）==');
{
  const ids = TUTORIAL_STEPS.map((s) => s.id);
  ok(ids.join(',') === 'deploy,zoom,merge,chest', `引导含布阵 / 序章缩放 / 合成 / 开箱（${ids.join(' / ')}）`);
  ok(new Set(ids).size === ids.length, '引导 id 不重复');
  ok(TUTORIAL_STEPS.filter((s) => s.kind !== 'hint').every((s) => s.kind === 'strong'), '除序章缩放箭头外全部是强引导');
  ok(TUTORIAL_STEPS.every((s) => ['tap', 'drag', 'merge', 'pinch'].includes(s.gesture)), '每条都带手势图标');
  ok(TUTORIAL_STEPS.every((s) => s.action && Array.from(s.action).length <= 6), '每条只有一句 ≤6 字的动作指令');
  ok(TUTORIAL_STEPS.every((s) => !s.lines && !s.title && !s.tip), '不再有说明性长句 / 规则解释');

  // 初始档带 tutorial 字段
  const st = createNewState();
  ok(st.tutorial && st.tutorial.version === TUTORIAL_VERSION && st.tutorial.skipped === false,
    '新档默认带引导存档（未跳过）');

  // 首次布阵：只在「为关卡布阵」时出，编辑阵型不弹
  ok(pickTutorial(st, { screen: 'deploy', mode: 'edit' }) === null, '编辑布阵不弹强引导');
  ok(pickTutorial(st, { screen: 'deploy', mode: 'battle' })?.id === 'deploy', '首次为关卡布阵弹强引导');

  // 只触发一次
  markTutorialSeen(st, 'deploy');
  ok(pickTutorial(st, { screen: 'deploy', mode: 'battle' }) === null, '布阵引导看过一次后不再弹');
  ok(tutorialSeen(st, 'deploy'), '布阵引导已写入存档');

  // 合成引导：没有可合成材料时绝不弹
  ok(pickTutorial(st, { screen: 'deploy', mode: 'edit', mergePair: null }) === null,
    '没有两个可合成兵牌时不弹合成引导');
  const pair = [{ rect: { x: 0, y: 0, w: 10, h: 10 } }, { rect: { x: 20, y: 0, w: 10, h: 10 } }];
  ok(pickTutorial(st, { screen: 'barracks', mergePair: pair, mergeReady: false }) === null,
    '兵营不足 25 张兵牌时不弹合成引导');
  ok(pickTutorial(st, { screen: 'barracks', mergePair: pair, mergeReady: true })?.id === 'merge',
    '有两个同兵种同等级兵牌时才弹合成引导');

  // 宝箱：没有可开的箱子时不弹
  ok(pickTutorial(st, { screen: 'chests', chestOpen: null }) === null, '无箱可开时不弹引导');
  ok(pickTutorial(st, { screen: 'chests', chestOpen: { x: 0, y: 0, w: 10, h: 10 } })?.id === 'chest',
    '有箱可开时弹开箱强引导');

  // 说明性页面（商城 / 首页）不再弹提示卡
  const st2 = createNewState();
  ok(pickTutorial(st2, { screen: 'shop' }) === null, '商城不再弹说明卡');
  ok(pickTutorial(st2, { screen: 'home' }) === null, '首页不再弹玩法预告卡');

  // 全局跳过：强引导不再出现
  const st5 = createNewState();
  skipTutorial(st5);
  ok(st5.tutorial.skipped === true, '跳过写入存档');
  ok(pickTutorial(st5, { screen: 'deploy', mode: 'battle' }) === null, '跳过后不再弹布阵强引导');
  ok(pickTutorial(st5, { screen: 'deploy', mergePair: pair }) === null, '跳过后不再弹合成强引导');

  // 合成本身：同兵种同等级才成对，到档位上限不给
  const st6 = createNewState();
  const card = (uid, level) => ({ uid, troop: 'shield', level, rect: { x: 0, y: 0, w: 10, h: 10 } });
  ok(findMergePair(st6, [card('a', 1), card('b', 1)])?.length === 2, '同兵种同等级识别为可合成');
  ok(findMergePair(st6, [card('a', 1), card('b', 2)]) === null, '等级不同不算可合成');
  const cap = troopLevelCap(st6, 'shield');
  ok(findMergePair(st6, [card('a', cap), card('b', cap)]) === null,
    `到达兵种档位上限 Lv${cap} 时不再提示合成`);

  // 存档往返：看过 / 跳过都要保留
  const mem = (() => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  })();
  const s = createNewState();
  markTutorialSeen(s, 'deploy');
  markTutorialSeen(s, 'merge');
  s.tutorial.skipped = true;
  saveState(mem, s);
  const loaded = loadState(mem);
  ok(tutorialSeen(loaded, 'deploy') && tutorialSeen(loaded, 'merge') && loaded.tutorial.skipped === true,
    '读档保留「看过哪几条」与「全局跳过」');
  ok(tutorialSeen(loaded, 'chest') === false, '没看过的引导读档后仍会出现');

  // 旧档（没有 tutorial 字段）不骚扰老玩家
  const legacyMem = (() => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  })();
  legacyMem.setItem('sgxb_save_v1', JSON.stringify({
    coins: 100, maxCleared: 120, units: [{ id: 'u1', troop: 'shield', level: 3 }], lineup: ['u1'],
  }));
  const old = loadState(legacyMem);
  ok(old.maxCleared === 0 && old.coins === CONFIG.economy.startCoins
    && old.tutorial.skipped === false && Object.keys(old.tutorial.seen).length === 0,
    '旧档（无 version）直接重置为全新档，引导记录一并清空');

  const young = sanitizeTutorial(undefined, { legacy: true, maxCleared: 3 });
  ok(young.skipped === false && Object.keys(young.seen).length === 0, '旧档但只打了 3 关：仍然保留新手引导');

  // 脏数据：未知 id 丢弃
  const dirty = sanitizeTutorial({ version: 1, skipped: true, seen: { deploy: true, hack: true } });
  ok(dirty.seen.deploy === true && dirty.seen.hack === undefined, '读档丢弃未知引导 id（不崩溃）');
}

// ======================================================================
// 首页挂机宝箱：阶梯 / 链式 / 每日重置 / 上限 / 品质 / 离线 / 回拨 / 入仓
// ======================================================================
{
  ok(JSON.stringify(idleChestStepsMin()) === JSON.stringify([1, 3, 5, 10, 10, 10, 60, 240]),
    '挂机宝箱阶梯时长 = 1/3/5/10/10/10/60/240 分钟');
  ok(idleChestDailyLimit() === 8, '挂机宝箱每天 8 个');
  ok(idleChestStepMs(0) === 60000 && idleChestStepMs(6) === 3600000 && idleChestStepMs(7) === 14400000,
    '阶梯换算成毫秒正确（1 分钟 / 1 小时 / 4 小时）');

  // 固定时间：2026-11-06 12:00 北京时间
  const T0 = Date.UTC(2026, 10, 6, 4, 0, 0);
  const day0 = idleChestDayStart(T0);
  ok(dateKey(T0) === '2026-11-06', '测试基准日期正确');
  ok(day0 + 12 * 3600 * 1000 === T0, '北京时间当天 0 点计算正确');

  const mkState = (maxCleared = 0) => ({ maxCleared, chests: {}, units: [], lineup: [] });
  const fresh = (maxCleared = 0) => {
    const st = mkState(maxCleared);
    st.idleChest = emptyIdleChest(T0, maxCleared);
    return st;
  };

  // 链式计时：领走当前这个，下一个才开始
  const st1 = fresh();
  const s0 = idleChestState(st1, T0);
  ok(s0.claimed === 0 && s0.index === 0 && s0.ready === true, '当天第 1 个（1 分钟）12 点时已可领');
  const c1 = claimIdleChest(st1, T0);
  ok(c1.ok && c1.chest === 'wood' && c1.claimed === 1, '领取第 1 个成功并入仓（小木箱）');
  ok(st1.idleChest.readyAt === T0 + 3 * 60000, '领完后第 2 个（3 分钟）才从领取时刻开始计时');
  const c2 = claimIdleChest(st1, T0);
  ok(!c2.ok && c2.reason === 'wait' && c2.remainMs === 3 * 60000, '没到时间不能重复领');
  ok(claimIdleChest(st1, T0 + 3 * 60000).ok, '3 分钟后第 2 个可领');
  // 不领就一直停着：隔 1 小时也只累积「当前这一个」，不会连出多个
  const st2 = fresh();
  claimIdleChest(st2, T0);
  const later = idleChestState(st2, T0 + 3600 * 1000);
  ok(later.claimed === 1 && later.index === 1 && later.done === false,
    '离线 1 小时未领：仍停在待领的第 2 个，不后台累积多个');

  // 8 个上限
  const st3 = fresh();
  let t = T0;
  let allOk = true;
  for (let i = 0; i < 8; i++) {
    const r = claimIdleChest(st3, t);
    if (!r.ok) allOk = false;
    t += idleChestStepMs(Math.min(7, i + 1));
  }
  ok(allOk, '连续领取 8 个都成功');
  ok(idleChestState(st3, t).done === true, '领满 8 个后显示今日已领完');
  ok(claimIdleChest(st3, t).reason === 'done', '第 9 个被上限拦住');

  // 每日 0 点重置：回到第 1 个（1 分钟）
  const nextDay = T0 + 24 * 3600 * 1000;
  ensureIdleChest(st3, nextDay);
  const reset = idleChestState(st3, nextDay);
  ok(reset.claimed === 0 && reset.index === 0 && reset.ready === true,
    '跨天 0 点重置回第 1 个，且当天 0:01 起就可领');
  ok(st3.idleChest.readyAt === idleChestDayStart(nextDay) + 60000, '重置后的第 1 个从当天 0 点开始计时');

  // 品质随最高通关关卡：<200 木 / ≥200 银 / ≥600 金
  ok(idleChestQuality(0) === 'wood' && idleChestQuality(199) === 'wood', '低于 200 关为小木箱');
  ok(idleChestQuality(200) === 'silver' && idleChestQuality(599) === 'silver', '200~599 关为银箱');
  ok(idleChestQuality(600) === 'gold' && idleChestQuality(999) === 'gold', '600 关起为金箱');

  // 跨档口径：已生成的保持原品质，未生成的从下一个起升级
  const st4 = fresh(199);
  ok(st4.idleChest.chest === 'wood', '199 关生成的小木箱');
  st4.maxCleared = 650;
  const up = claimIdleChest(st4, T0);
  ok(up.ok && up.chest === 'wood', '跨档后正在计时的箱子仍按原品质（小木箱）发放');
  ok(st4.idleChest.chest === 'gold', '跨档后下一个箱子升级为金箱');

  // 离线结算：按真实时间戳，只结算当前这一个
  const st5 = fresh();
  const offline = idleChestState(st5, T0 + 5 * 3600 * 1000);
  ok(offline.ready === true && offline.claimed === 0 && offline.index === 0,
    '离线 5 小时回来：第 1 个可领，且没有凭空多出后续箱子');
  const oc = claimIdleChest(st5, T0 + 5 * 3600 * 1000);
  ok(oc.ok && st5.idleChest.claimed === 1, '离线后只领到 1 个');

  // 时间回拨：不倒退、不白送、不长时间卡死
  const st6 = fresh();
  claimIdleChest(st6, T0); // 第 2 个计时到 T0+3min
  const back = T0 - 3600 * 1000; // 同一天回拨 1 小时
  const rb = claimIdleChest(st6, back);
  ok(!rb.ok && rb.reason === 'wait' && rb.remainMs > 0, '同一天时间回拨：不能白领，返回正数倒计时');
  ok(st6.idleChest.claimed === 1, '时间回拨不会撤销已领进度');
  const st7 = fresh();
  claimIdleChest(st7, T0);
  ensureIdleChest(st7, T0 - 24 * 3600 * 1000); // 回拨到前一天
  ok(st7.idleChest.claimed === 1, '回拨到前一天不会重置每日进度（防刷）');
  ok(st7.idleChest.readyAt <= (T0 - 24 * 3600 * 1000) + idleChestStepMs(1),
    '回拨到前一天：可领时间被压到最多再等一档，不会卡死数天');

  // 领取入宝箱仓库：和普通宝箱一起计数 / 可开
  const st8 = fresh();
  const before = chestCount(st8, 'wood');
  claimIdleChest(st8, T0);
  ok(chestCount(st8, 'wood') === before + 1, '领取后箱子进入宝箱仓库');
  ok(chestTotal(st8) >= 1, '宝箱仓库总数 +1（可走一键开启）');

  // 老档 / 脏数据迁移
  const legacy = sanitizeIdleChest(undefined, { legacy: true, maxCleared: 300 });
  ok(legacy.claimed === 0 && legacy.chest === 'silver' && legacy.readyAt > Date.now(),
    '老档没有字段：从第 1 个开始计时（按当前关卡取品质），不报错不白送');
  const dirty = sanitizeIdleChest({ day: 'hack', claimed: 999, chest: 'nope', readyAt: -5, anchor: 'x' }, { maxCleared: 0 });
  ok(dirty.claimed === 8 && dirty.chest === 'wood' && Number.isFinite(dirty.readyAt),
    '脏数据被清洗到合法范围');
  ok(formatIdleCountdown(59000) === '00:59' && formatIdleCountdown(3661000) === '1:01:01',
    '倒计时文案 mm:ss / h:mm:ss 正确');
}

// ======================================================================
// 结算页「下一个解锁」：目标来自真实配置 + 下一目标 / 已解锁 / 全解锁隐藏
// ======================================================================
{
  const targets = unlockTargets();
  ok(targets.length >= 18, '解锁目标来自真实配置（兵种 + 系统 + 英雄 + 7 日登录 + 宝箱加成）');
  ok(targets.some((t) => t.kind === 'troop' && t.level === 20 && t.troop === 'qingzhu'),
    '包含 20 关青竹弓');
  ok(targets.some((t) => t.id === 'speed' && t.level === CONFIG.battle.speedUnlockLevel),
    '包含 10 关战斗加速（与 CONFIG 一致）');
  ok(targets.some((t) => t.kind === 'feature' && t.level === 250),
    '包含 250 关英雄战等系统解锁');
  ok(targets.some((t) => t.kind === 'hero' && t.level === 250 && t.hero === 'guanping'),
    '包含 250 关赠送英雄关平');
  ok(targets.some((t) => t.kind === 'login7' && t.level === CONFIG.daily.unlockLevel),
    '包含 7 日登录奖励（跟随每日系统解锁关）');
  ok([400, 800].every((n) => targets.some((t) => t.id === `chestBonus${n}`))
    && !targets.some((t) => t.id === 'chestBonus200'),
    '宝箱兵种等级加成节点只剩 400 / 800 关（200 关档已取消）');
  for (let i = 1; i < targets.length; i++) {
    if (targets[i].level < targets[i - 1].level) { ok(false, '解锁目标按关卡升序'); break; }
  }

  const speed = nextUnlockInfo({ maxCleared: 10 }, { levelN: 10, win: true });
  ok(speed && speed.focus.id === 'speed' && speed.focus.level === 10 && speed.achieved === true,
    '10 关通关：结算页显示「战斗加速」已解锁');

  const low = nextUnlockInfo({ maxCleared: 10 }, { levelN: 11, win: false });
  ok(low && low.focus.level === 20 && low.focus.troop === 'qingzhu' && low.remain === 10 && low.achieved === false,
    '10 关之后：下一目标是 20 关青竹弓，还需 10 关');
  ok(low.ratio > 0 && low.ratio < 1, '进度条比例在 0~1 之间');
  ok(low.upcoming.length <= 2, '紧随其后的目标最多列 2 个');

  const hit = nextUnlockInfo({ maxCleared: 20 }, { levelN: 20, win: true });
  ok(hit && hit.focus.level === 20 && hit.achieved === true && hit.remain === 0 && hit.ratio === 1,
    '刚通关解锁关：显示「已解锁」而不是还差 0 关');

  const miss = nextUnlockInfo({ maxCleared: 20 }, { levelN: 21, win: false });
  ok(miss && miss.focus.level === 30 && miss.achieved === false,
    '战败页跳过已解锁目标，指向下一个未解锁目标（30 关每日登录）');

  const afterHero = nextUnlockInfo({ maxCleared: 250 }, { levelN: 251, win: true });
  ok(afterHero && afterHero.focus.id === 'chestBonus400' && afterHero.focus.level === 400,
    '250 关之后下一目标是 400 关宝箱兵种等级 +1');

  const all = nextUnlockInfo({ maxCleared: 800 }, { levelN: 801, win: true });
  ok(all === null, '全部目标解锁后整块隐藏（返回 null）');

  const heroHit = nextUnlockInfo({ maxCleared: 250 }, { levelN: 250, win: true });
  ok(heroHit && heroHit.focus.kind === 'hero' && heroHit.achieved === true,
    '250 关结算重点展示关平并标记已解锁');
}

// ======================================================================
// 招募券来源门禁：没打过英雄战，任何路径都不发券
// ======================================================================
{
  const st = createNewState();
  st.maxCleared = 250;
  st.heroTickets = 0;
  st.heroAdDay = '';
  st.heroAdCount = 0;
  const si = signIn(st);
  ok(si.ok && si.heroTickets === 0 && st.heroTickets === 0, '未通关英雄战：签到不发招募券');
  const ad = claimHeroAdTicket(st);
  ok(!ad.ok && ad.reason === 'locked' && st.heroTickets === 0, '未通关英雄战：广告券通道锁定');
  st.heroBattleCleared = 1;
  const ad2 = claimHeroAdTicket(st);
  ok(ad2.ok && st.heroTickets === 1, '通关 1 场英雄战后：广告券恢复 +1');
  ok(mainlineScrollReward(200) === 1 && mainlineScrollReward(210) === 1,
    '主线 200 后每 10 关仍是 1 券（发放时机由战斗页按英雄战门禁控制）');

  // 刘备来源：7 日登录改为张飞后，必须仍能从传奇招募池抽到
  const lbState = createNewState();
  lbState.heroes = {};
  for (const h of heroesByTier('legendary')) {
    if (h.id !== 'liubei') lbState.heroes[h.id] = 1;
  }
  const lb = recruitHeroResult(lbState, 'legendary', () => 0.99);
  ok(lb && lb.hero === 'liubei', '刘备仍可从招募系统抽到（传奇池仅剩他时必出）');
}

// ======================================================================
// 新内容解锁教学：每个功能 / 兵种只弹一次
// ======================================================================
{
  const st = createNewState();
  const at20 = pendingUnlockTeachings(st, 20);
  ok(at20.length === 1 && at20[0].id === 'troop:qingzhu' && at20[0].kind === 'troop',
    '20 关解锁青竹弓：生成 1 条兵种教学');
  markUnlockSeen(st, at20[0].id);
  ok(pendingUnlockTeachings(st, 20).length === 0, '同一条教学只弹一次');
  const at150 = pendingUnlockTeachings(st, 150).map((n) => n.id);
  ok(at150.includes('troop:baima') && at150.includes('trials'),
    '150 关同时解锁白马义从 + 演武：两条教学都会排队');
  const seeded = createNewState();
  seedUnlockSeen(seeded, 200);
  ok(pendingUnlockTeachings(seeded, 150).length === 0 && pendingUnlockTeachings(seeded, 200).length === 0,
    '老档迁移：已解锁内容不补弹教学');
}

// ======================================================================
// 过 5 关斩 6 将
// ======================================================================
{
  const st = createNewState();
  st.maxCleared = CONFIG.gauntlet.unlockLevel - 1;
  ok(!gauntletUnlocked(st) && startGauntletRun(st, 'sishui').reason === 'locked',
    `主线 ${CONFIG.gauntlet.unlockLevel} 关前不可进入斩将场`);
  st.maxCleared = CONFIG.gauntlet.unlockLevel;
  ok(gauntletUnlocked(st), `主线 ${CONFIG.gauntlet.unlockLevel} 关解锁斩将场`);

  const initialFormation = activeFormation(st).length;
  ok(initialFormation > 0, '新档自带初始布阵，可直接开始');
  const started = startGauntletRun(st, 'sishui');
  ok(started.ok && st.gauntlet.run && st.gauntlet.run.stage === 1,
    '开始冲锋：进入第 1 关');
  ok(st.gauntlet.run.units.length === initialFormation
    && st.gauntlet.run.units.every((u) => u.hpPct === 1 && !u.dead),
    '冲锋快照 = 当前布阵全部兵牌，开局满血');

  // 共用布阵页上阵的英雄（h:英雄id）必须一起进冲锋快照，等级取英雄自己的等级
  {
    const st2 = createNewState();
    st2.maxCleared = CONFIG.gauntlet.unlockLevel;
    st2.heroes = { ...st2.heroes, huanggai: 5 };
    st2.formation[12] = 'h:huanggai';
    const r2 = startGauntletRun(st2, 'sishui');
    const heroUnits = r2.ok ? r2.run.units.filter((u) => u.hero === 'huanggai') : [];
    ok(r2.ok && heroUnits.length === 1 && heroUnits[0].level === 5,
      '斩将场：布阵页上阵的英雄进入冲锋快照（保留英雄等级）');
  }

  // 每章 5 关 / 6 名不同敌将
  const ch1 = gauntletChapter('sishui');
  const bossIds = [];
  for (let i = 1; i <= 5; i++) {
    const def = gauntletStageDef('sishui', i);
    ok(def.enemies.length >= 3 && def.bossCount === (i === 5 ? 2 : 1),
      `第 ${i} 关：${def.bossCount} 名敌将 + ${def.squads.length} 队护卫`);
    def.bosses.forEach((b) => bossIds.push(b.hero));
  }
  ok(bossIds.length === 6 && new Set(bossIds).size === 6
    && bossIds.every((id) => ch1.generals.includes(id)),
    '一章 5 关共 6 名不同敌将（过 5 关斩 6 将）');

  // 血量跨关不回复 + 阵亡灰掉
  const run = st.gauntlet.run;
  // 第 1 张残血 40%，第 2 张阵亡，其余保留 80% 血量
  applyGauntletReport(run, run.units.map((u, i) => (
    i === 1 ? { hpPct: 0, dead: true } : { hpPct: i === 0 ? 0.4 : 0.8, dead: false }
  )));
  ok(run.units[0].hpPct === 0.4 && !run.units[0].dead && run.units[1].dead,
    '战斗结算：幸存兵牌保留剩余血量，全灭兵牌标记阵亡');
  ok(gauntletRunSquads(run).length === run.units.length - 1,
    '阵亡兵牌不再进入下一关出战名单');
  const alive = run.units.filter((u) => !u.dead);
  if (alive.length >= 2) {
    const a = run.units.indexOf(alive[0]);
    const b = run.units.indexOf(alive[1]);
    const posA = [alive[0].col, alive[0].row];
    const posB = [alive[1].col, alive[1].row];
    ok(swapGauntletUnits(run, a, b), '存活兵牌之间可以交换阵位');
    ok(alive[0].col === posB[0] && alive[0].row === posB[1] && alive[1].col === posA[0],
      '交换后位置互换');
    const deadIdx = run.units.findIndex((u) => u.dead);
    ok(!swapGauntletUnits(run, a, deadIdx), '阵亡兵牌不能参与换位（也不能被撤下）');
  }

  // 章节解锁 / 每日奖励 / 首通奖励
  const st2 = createNewState();
  st2.maxCleared = 200;
  const views = gauntletChapterView(st2);
  ok(views[0].unlocked && !views[1].unlocked, '仅第 1 章开放，后续章节锁定');
  st2.gauntlet.run = {
    chapter: 'sishui', stage: 5,
    units: [{ troop: 'shield', level: 3, col: 2, row: 2, hpPct: 1, dead: false }],
  };
  ok(gauntletDailyAvailable(st2), '当天尚未领取每日奖励');
  const r1 = completeGauntletChapter(st2, new Date('2026-11-08T10:00:00+08:00').getTime());
  ok(r1 && r1.first && r1.box && r1.box.rarity === 'common' && r1.box.level === 2,
    '汜水关首通：普通自选卡包 Lv2');
  ok(r1.coins === 2000 + CONFIG.gauntlet.dailyCoins && r1.daily,
    `首通 + 每日奖励共 ${r1.coins} 铜钱`);
  ok(st2.gauntlet.cleared.includes('sishui') && gauntletChapterView(st2)[1].unlocked,
    '首通后解锁第 2 章（次日可直接从第 2 章开始，跳过第 1 章）');
  ok(!gauntletDailyAvailable(st2, new Date('2026-11-08T23:00:00+08:00').getTime()),
    '同一天再通关不再发每日奖励');
  st2.gauntlet.run = {
    chapter: 'sishui', stage: 5,
    units: [{ troop: 'shield', level: 3, col: 2, row: 2, hpPct: 1, dead: false }],
  };
  const r2 = completeGauntletChapter(st2, new Date('2026-11-08T12:00:00+08:00').getTime());
  ok(r2 && !r2.first && r2.coins === 0 && !r2.daily, '重复通关：不重复发首通 / 每日奖励');
  st2.gauntlet.run = {
    chapter: 'hulao', stage: 5,
    units: [{ troop: 'shield', level: 3, col: 2, row: 2, hpPct: 1, dead: false }],
  };
  const r3 = completeGauntletChapter(st2, new Date('2026-11-09T09:00:00+08:00').getTime());
  ok(r3 && r3.first && r3.daily && r3.box.rarity === 'rare',
    '次日通关第 2 章：每日奖励重置，首通给稀有自选包');

  // 奖励梯度：普通 → 稀有 → 史诗 → 传奇，等级随章节走高
  const rewards = CONFIG.gauntlet.chapters.map((c) => `${c.rarity}${c.boxLevel}`);
  ok(rewards[0] === 'common2' && rewards[1] === 'rare2' && rewards[2] === 'epic2'
    && rewards[3] === 'epic4' && rewards[4] === 'legendary2' && rewards[5] === 'legendary4',
    `章节奖励梯度：${rewards.join(' → ')}`);

  // 难度：对手战力逐章递增，且远低于同期主线（奖励不与主线冲突）
  const powers = CONFIG.gauntlet.chapters.map((c, i) => gauntletStagePower(c.id, 5));
  ok(powers.every((p, i) => i === 0 || p > powers[i - 1]),
    `章节末关战力递增：${powers.map((p) => Math.round(p / 1000) + 'k').join(' → ')}`);

  // 12 章 60 关曲线：章内严格递增、格子不重叠、最终章与主线终章等强
  ok(CONFIG.gauntlet.chapters.length === 12 && CONFIG.gauntlet.stagesPerChapter === 5,
    '斩将扩到 12 章 60 关，难度逐章抬高');
  const stagePowers = CONFIG.gauntlet.chapters.map((c) =>
    Array.from({ length: 5 }, (_, i) => gauntletStagePower(c.id, i + 1)));
  ok(stagePowers.every((arr) => arr.every((p, i) => i === 0 || p > arr[i - 1])),
    '斩将每章内 5 关难度严格递增');
  const gauntletEndMain = levelDef(2600);
  const gauntletEndPower = gauntletEndMain.enemies
    .reduce((s, e) => s + troopPower(e.troop, e.level), 0) * (gauntletEndMain.difficulty || 1);
  ok(Math.abs(powers[11] / gauntletEndPower - 1) < 0.02,
    `斩将最终章第 5 关 ${powers[11]} ≈ 主线 2600 终章 ${Math.round(gauntletEndPower)}`);
  ok(CONFIG.gauntlet.chapters.every((c) => Array.from({ length: 5 }, (_, i) => gauntletStageDef(c.id, i + 1))
    .every((d) => new Set(d.enemies.map((e) => `${e.col},${e.row}`)).size === d.enemies.length)),
  '斩将 60 关敌方编成格子互不重叠');
}

console.log('\n== 序章 / 首次流程 / 加速锁 ==');
{
  // 加速：9 关禁用、10 关可用
  ok(speedUnlocked(9) === false && speedUnlocked(10) === true, '主线 9 关禁用加速 / 10 关开放');
  ok(speedUnlocked(1, { prologue: true }) === false, '序章不给加速');
  ok(speedUnlocked(1, { trial: {} }) === true, '演武 / 英雄战 / 斩将不受主线关数限制');

  // 序章敌人：全部 16 兵种 + 董卓本人
  const def = prologueDef();
  const troops = def.enemies.map((e) => e.troop);
  ok(ALL_TROOPS.every((t) => troops.includes(t)), '开场战敌方阵容覆盖全部 16 个兵种');
  ok(def.enemies.some((e) => e.hero === 'dongzhuo'), '开场战由董卓本人带队');
  ok(def.enemies.length === ALL_TROOPS.length + 1, '敌方 = 16 兵种 + 董卓');

  // 序章玩家阵容：12 队精锐，含同名同级（可合成）
  const st = createNewState();
  seedPrologue(st);
  ok(st.units.length === PROLOGUE_PLAYER.length && st.units.every((u) => u.level === 7), '序章我方 12 队 Lv7 精锐');
  const shields = st.units.filter((u) => u.troop === 'shield');
  ok(shields.length >= 2 && shields[0].level === shields[1].level, '序章阵容自带同名同级兵牌（合成教学）');
  ok(st.formation.filter(Boolean).length === st.units.length, '序章兵牌全部自动上阵');
  ok(st.story.introDone === false && !('revenge' in st.story), '序章存档：未完成开场战（不再记录仇人）');

  // 东山再起：新档回到 4 张初始兵牌、无英雄、0 关
  const fresh = createNewState();
  ok(fresh.units.length === CONFIG.startArmy.length && fresh.maxCleared === 0
    && Object.keys(fresh.heroes).length === 0 && chestTotal(fresh) === 0,
    '东山再起后兵牌 / 进度 / 英雄 / 宝箱全部回到初始');
  ok(fresh.story.introDone === false, '全新档默认还没看过开场');

  // 存档版本升级：旧档（v11）直接清空（重置所有玩家存档）
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  saveState(storage, { ...createNewState(), version: 12, coins: 99999, maxCleared: 500 });
  const loaded = loadState(storage);
  ok(STATE_VERSION === 15 && loaded.maxCleared === 0 && loaded.coins === CONFIG.economy.startCoins,
    '旧档升级到 v15：铜钱 / 关卡进度全部清零');
  ok(loaded.story && loaded.story.introDone === false, '旧档清空后要重新走首次流程');

  // 序章旁白：两段固定顺序；第二段点完才出现「教学关卡」
  ok(PROLOGUE_NARRATION.length === 2, '旁白固定两段');
  ok(PROLOGUE_NARRATION[0].includes('董卓') && PROLOGUE_NARRATION[0].includes('在此一举'),
    '第一段是「遇上董卓 / 在此一举」');
  ok(PROLOGUE_NARRATION[1].includes('敌我差距悬殊') && PROLOGUE_NARRATION[1].includes('难以战胜'),
    '第二段是「敌我差距悬殊 / 难以战胜」');
  ok(TEACHING_TITLE === '教学关卡', '教学标题文案正确');

  // 缩放引导：必须先点完旁白，再真的缩放，未缩放无法开战
  const nav = { pushed: 0 };
  const dg = {
    state: createNewState(), W: 750, H: 1334, save() {}, toast() {}, platform: {},
    push() { nav.pushed++; }, go() {}, home() {}, tutorialDone() {},
  };
  seedPrologue(dg.state);
  const ds = new DeployScreen(dg, { mode: 'battle', level: 1, prologue: true, def });
  ok(ds.narration === 0 && ds.zoomDone === false && ds.teachT === 0, '进页面先停在第一段旁白，教学标题未出现');
  ds.onDown(375, 1100);
  ok(ds.narration === 1 && ds.teachT === 0, '第一次点：只切到第二段旁白，教学标题仍未出现');
  ds.onDown(375, 1100);
  ok(ds.narration === 2 && ds.teachT > 0, '第二次点：旁白结束，「教学关卡」出现');
  const cr = DEPLOY_LAYOUT.confirmRect;
  ds.onDown(cr.x + 20, cr.y + 20);
  ok(nav.pushed === 0 && ds.zoomDone === false, '没做缩放动作时开战按钮不放行');
  ds.onPinch(1.2, 375, 500, 'start');
  ds.onPinch(1.2, 375, 500, 'move');
  ds.onPinch(1, 375, 500, 'end');
  ok(ds.zoomDone === true && tutorialSeen(dg.state, 'zoom'), '真的缩放后引导完成并写入存档');
  ds.onDown(cr.x + 20, cr.y + 20);
  ok(nav.pushed === 1, '缩放完成后才能进入第一战');
  const ctx = { screen: 'deploy', mode: 'battle', prologue: true, zoomDone: false, mergePair: null };
  ok(pickTutorial({ tutorial: emptyTutorial() }, ctx) === null, '缩放提示不弹遮罩、没有跳过入口');

  // 文案清理：广告奖励入口已于 1.2.9 全部移除，首页删掉说明小字（渲染文本无法反查，按源码断言）
  const readSrc = (rel) => fs.readFileSync(path.resolve(rel), 'utf8');
  const screenNames = ['home', 'shop', 'result', 'heroes', 'chests', 'daily', 'dailyShop', 'gauntlet', 'trial', 'heroBattle', 'levels', 'barracks'];
  const allScreenSrc = screenNames.map((n) => readSrc(`src/screens/${n}.js`)).join('\n');
  ok(!/今日还剩|剩\s*\$\{left\}|今日剩余|每天最多|每日 \$\{CONFIG\.ads/.test(allScreenSrc),
    '全站广告入口不再出现「剩余次数 / 每日上限」文案');
  ok(!allScreenSrc.includes('广告 · ') && !allScreenSrc.includes('看广告 · +1 券')
    && !allScreenSrc.includes('watchTroopAd') && !allScreenSrc.includes('adChest('),
    '广告奖励按钮已全部移除');
  const homeSrc = readSrc('src/screens/home.js');
  ok(!homeSrc.includes('武将位'), '首页不再出现「武将位未开放」提示');
  ok(!homeSrc.includes('每小时 +') && !homeSrc.includes('最多累计'), '挂机收益下方小字说明已删除');
  ok(homeSrc.includes('coinBadge(ctx, 100, 882, coins') && homeSrc.includes("size: 42"),
    '挂机收益保留铜钱图标 + 大号可领数量（整体下移 60px 后坐标 882）');
  ok(!homeSrc.includes('合成升阶 · 布阵上阵') && !homeSrc.includes('铜钱买兵直入营') && !homeSrc.includes('个待开'),
    '宝箱 / 兵营 / 商城入口说明文字已删除');
  ok(!homeSrc.includes('领走后才开始下一个') && !homeSrc.includes('点击入宝箱仓库') && !homeSrc.includes('第 ${info.index + 1}'),
    '挂机宝箱区只剩倒计时 / 模型 / 可领取状态');
  // 1.2.6：周常 / 每日挑战与左侧圆钮重复的底部方框已移除，只留圆钮；未解锁圆钮带锁
  ok(!homeSrc.includes('button(ctx, r.weekly,') && !homeSrc.includes('button(ctx, r.dailyChallenge,'),
    '首页底部周常 / 每日挑战方框已移除（左侧圆钮为唯一入口）');
  ok(homeSrc.includes('r.weeklyOrb, x, y') && homeSrc.includes('r.dailyOrb, x, y')
    && homeSrc.includes('this.rects.weeklyOrb') && homeSrc.includes('this.rects.dailyOrb'),
    '入口点击与解锁引导都指向左侧圆钮');
  ok(readSrc('src/render/draw.js').includes('圆钮外沿挂一把锁'),
    '未解锁的圆钮外侧绘制锁态');
  // 1.2.8：红点去数字（纯色呼吸）+ 每日挑战卡面去英雄模型
  const drawSrc = readSrc('src/render/draw.js');
  ok(!drawSrc.includes('text(ctx, String(badge)'), '圆钮红点不再绘制数字（纯色呼吸角标）');
  ok(drawSrc.includes('1.2.8 · 纯色呼吸角标'), '红点走呼吸缩放 + 透明度脉动');
  const dailyChSrc = readSrc('src/screens/dailyChallenge.js');
  ok(!dailyChSrc.includes('drawHeroFigure') && !dailyChSrc.includes('drawHeroAura')
    && !dailyChSrc.includes('heroById'),
    '每日挑战卡面不再画英雄模型 / 光环 / 将名');

  // 兵种 / 英雄文案：不出现设计口径与占位符，只写机制与数值
  const copySrc = ['src/data/traits.js', 'src/data/heroes.js', 'src/data/growth.js', 'src/screens/unitDetail.js']
    .map(readSrc).join('\n');
  ok(!/围殴|靠箭雨压制|不能压过|随等级连续成长|表未定义|战力全靠人数/.test(copySrc),
    '战法 / 英雄说明已精炼：无设计口径、无占位符');
  ok(!homeSrc.includes('仇人') && !readSrc('src/screens/prologueResult.js').includes('仇人'),
    '首页与序章结算不再显示「仇人·董卓」');

  // 两军距离：前排中心 7 格 = 中间 6 格空地（远程射程已全线 +3）
  const fgap = CONFIG.formation.playerFrontY - CONFIG.formation.enemyFrontY;
  ok(fgap === 7, `两军前排中心相隔 ${fgap} 格 → 中间留 6 格，需要走 6 格才能接战`);

  // 关卡等级锚点必须单调不降，且不再陡增
  let anchorsOk = true;
  let maxSlope = 0;
  const anchors = CONFIG.levelGen.levelAnchors;
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i].level < anchors[i - 1].level) anchorsOk = false;
    const span = Math.max(1, anchors[i].n - anchors[i - 1].n);
    maxSlope = Math.max(maxSlope, ((anchors[i].level - anchors[i - 1].level) / span) * 100);
  }
  ok(anchorsOk && maxSlope <= 3.2, `关卡等级锚点单调不降，最快每 100 关 +${maxSlope.toFixed(2)} 级`);

  // 两个宝箱必须是结构差异，不是换色
  ok(CHEST_MODEL.wood.dome === false && CHEST_MODEL.gold.dome === true, '木箱平盖 / 金箱拱盖');
  ok(CHEST_MODEL.wood.lid !== CHEST_MODEL.gold.lid && CHEST_MODEL.wood.lock !== CHEST_MODEL.gold.lock,
    '盖子与锁扣结构不同');
  ok(CHEST_MODEL.wood.metalBands === 0 && CHEST_MODEL.gold.metalBands === 2
    && CHEST_MODEL.wood.heightRatio !== CHEST_MODEL.gold.heightRatio, '金属箍与箱体高度不同');

  // 英雄分段血条：每 500 血一段；CD 读条
  ok(heroHpSegmentCount(2500) === 5, '2500 血 = 5 段');
  ok(heroHpSegmentCount(500) === 1 && heroHpSegmentCount(501) === 2, '500 / 501 血分别是 1 / 2 段');
  ok(heroHpSegmentCount(6608) === 14 && heroHpSegmentCount(36000) === 16, '高血量按上限收口（6608→14，Boss→16）');
  ok(heroHpSegmentFill(750, 2500, 1) === 0.5 && heroHpSegmentFill(750, 2500, 2) === 0, '分段填充按 500 血一段递减');
  const cdHero = {
    hero: true, alive: true, maxHp: 2500, hp: 2000,
    tr: { dmgConvert: { cd: 10, dur: 5 } }, convertCd: 4, convertUntil: 0,
  };
  const cd1 = heroCooldown(cdHero, 100);
  ok(cd1 && cd1.active === false && Math.abs(cd1.ratio - 0.2) < 1e-9, '曹操 CD：回充期剩 4 秒 / 5 秒 → 20%');
  const cd2 = heroCooldown({ ...cdHero, convertUntil: 105 }, 100);
  ok(cd2 && cd2.active === true && cd2.ratio === 1, '技能生效中：CD 条满格');
  const cd3 = heroCooldown({ hero: true, alive: true, summonCfg: { every: 4, timer: 1 } }, 10);
  ok(cd3 && Math.abs(cd3.ratio - 0.75) < 1e-9, '召唤类 CD：剩 1 秒 / 4 秒 → 75%');
  ok(heroCooldown({ hero: false, alive: true }, 1) === null, '普通兵不画 CD 条');

  // 序章战斗：无论战况如何都判负；败北后直进第 1 关排兵布阵（不过败北过场页、不回首页）
  const st2 = createNewState();
  seedPrologue(st2);
  const fake = {
    state: st2, W: 750, H: 1334, save() {}, toast() {}, platform: {}, tutorialDone() {},
    go(s) { this.lastGo = s; },
    finishPrologue(dest) { this.dest = dest; },
  };
  const b = new BattleScreen(fake, 1, mulberry32(7), { prologue: true, def });
  let frames = 0;
  while (!b.finished && frames < 3000) { b.update(1 / 60); frames++; }
  ok(b.finished && b.outcome === 'enemy', `序章开战必败（${frames} 帧后结束）`);
  ok(fake.dest === 'deploy' && fake.lastGo === undefined, '败北直进第 1 关排兵布阵（跳过败北过场页）');
  ok(b.speed === 1 && b.speedLocked === true, '序章锁定 1 倍速');
}

console.log('\n== 攻城器械 ==');
{
  // 配置与解锁
  const ids = engineList().map((e) => e.id);
  ok(ids.join(',') === 'thunder,drum', `器械列表：${ids.join(' / ')}（霹雳车 / 中军鼓吹）`);
  ok(engineDef('thunder').unlockLevel === 350 && engineDef('drum').unlockLevel === 600,
    '解锁关：霹雳车 350 关、中军鼓吹 600 关');
  ok(CONFIG.siege.maxLevel === 10, '两件器械都是 10 档（1 档自带 + 9 个付费档）');
  const st = createNewState();
  st.maxCleared = 349;
  ok(!engineUnlocked(st, 'thunder') && !engineUnlocked(st, 'drum'), '349 关前两件器械都未解锁');
  st.maxCleared = 350;
  ok(engineUnlocked(st, 'thunder') && !engineUnlocked(st, 'drum'), '350 关只解锁霹雳车');
  st.maxCleared = 800;
  ok(engineUnlocked(st, 'drum'), '800 关两件都解锁');

  // 价格：几何增长，10 档累计 ≈ 24 万 / 33.9 万的 1.5 倍
  const tTotal = engineMaxUpgradeTotal('thunder');
  const dTotal = engineMaxUpgradeTotal('drum');
  ok(tTotal === 359457 && dTotal === 509230,
    `10 档累计：霹雳车 ${tTotal.toLocaleString()} / 鼓吹 ${dTotal.toLocaleString()}（原方案 ×1.5）`);
  const ratios = [];
  for (let t = 2; t < CONFIG.siege.maxLevel; t++) {
    ratios.push(engineUpgradeCost('thunder', t + 1) / engineUpgradeCost('thunder', t));
  }
  ok(ratios.every((r) => Math.abs(r - 1.5) < 0.02), '每档价格都是上一档的 1.5 倍（几何增长，无散装数字）');

  // 升级与存档
  st.coins = 1000000;
  const before = st.coins;
  const up = upgradeEngine(st, 'thunder');
  ok(up.ok && up.tier === 2 && st.coins === before - engineUpgradeCost('thunder', 1),
    '升一档扣对应铜钱并记档');
  ok(setEngineChoice(st, 'thunder', 'front'), '选择霹雳车 + 前军站位');
  ok(engineChoice(st).id === 'thunder' && engineChoice(st).stance === 'front', '出战选择写入存档');
  const mem = new Map();
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };
  saveState(store, st);
  const loaded = loadState(store);
  ok(engineTier(loaded, 'thunder') === 2 && engineChoice(loaded).stance === 'front',
    '读档保留器械档位与站位');
  const poor = createNewState();
  poor.maxCleared = 350;
  poor.coins = 0;
  ok(upgradeEngine(poor, 'thunder').reason === 'coins', '铜钱不足时升级失败且不扣钱');
  ok(!setEngineChoice(poor, 'drum', 'center'), '未解锁的器械不能被选中');

  // 三档站位的战场坐标（前军/中军/后军各差 2 列 = 11.6 格）
  const pf = stancePoint('player', 'front');
  const pc = stancePoint('player', 'center');
  const pb = stancePoint('player', 'back');
  ok(Math.abs(pf.y - 45.5) < 0.01 && Math.abs(pc.y - 57.1) < 0.01 && Math.abs(pb.y - 68.7) < 0.01,
    `站位纵坐标：前军 ${pf.y} / 中军 ${pc.y} / 后军 ${pb.y}`);
  ok(pf.x === pc.x && pc.x === pb.x, '三档站位都在中轴线上（只改前后）');

  // 射程结论：前军打不到贴脸第一排；中军/后军打不到更远的排
  const distTo = (p, col) => Math.hypot(15 - p.x, 38.5 - col * 5.8 - p.y);
  ok(distTo(pf, 0) < CONFIG.siege.engines.thunder.minRange,
    `前军到敌方第一排 ${distTo(pf, 0).toFixed(1)} 格 < 最小射程 10（不能平射贴脸目标）`);
  ok(CONFIG.siege.engines.thunder.maxRange === 36
    && CONFIG.siege.move.holdMax === 34,
    '霹雳车最大射程 36 / 走位滞回 34（按玩家要求的攻击距离 36 格）');
  ok(distTo(pf, 0) < CONFIG.siege.engines.thunder.minRange
    && distTo(pf, 4) < CONFIG.siege.engines.thunder.maxRange,
    `前军打不到贴脸第 1 排（${distTo(pf, 0).toFixed(1)} 格 < 10），但覆盖到最后一排（${distTo(pf, 4).toFixed(1)} 格 < 36）`);
  ok(distTo(pc, 2) < CONFIG.siege.engines.thunder.maxRange
    && distTo(pc, 4) > CONFIG.siege.engines.thunder.maxRange,
    `中军覆盖敌方前 3 排，打不到最后两排（第 5 排 ${distTo(pc, 4).toFixed(1)} 格 > 36）`);
  ok(distTo(pb, 0) < CONFIG.siege.engines.thunder.maxRange
    && distTo(pb, 2) > CONFIG.siege.engines.thunder.maxRange,
    `后军初始只够到敌方第 1 排（第 3 排 ${distTo(pb, 2).toFixed(1)} 格 > 36），需要前压`);

  // 数值锚点：跟随 enemyLevelFor，档位只做增幅
  const s1 = engineStats('thunder', 1, 350);
  const s10 = engineStats('thunder', 10, 350);
  ok(s1.lv === 4 && s1.direct === 630 && s1.fireDps === 70,
    `350 关 1 档：直击 ${s1.direct} / 火圈 ${s1.fireDps}/秒（= 盾兵 Lv4 血量 ×1.8 / 弓兵攻击 ×1.6）`);
  ok(Math.abs(s1.fireRadius - 2.5) < 0.01,
    `1 档火圈按玩家要求削弱为 2.5 格（实测 ${s1.fireRadius}）`);
  ok(s10.direct > s1.direct && Math.abs(s10.cooldown - 9.75) < 0.01
    && Math.abs(s10.fireRadius - 3.0) < 0.01 && Math.abs(s10.fireDuration - 7) < 0.01,
    `10 档：直击 ${s10.direct}、冷却 ${s10.cooldown}s、火圈 ${s10.fireRadius} 格 / ${s10.fireDuration}s`);
  const d1 = engineStats('drum', 1, 800);
  const d10 = engineStats('drum', 10, 800);
  ok(Math.abs(d1.auraRadius - 8) < 0.01 && Math.abs(d1.auraDmg - 0.04) < 0.001
    && Math.abs(d10.auraRadius - 16) < 0.01 && Math.abs(d10.auraDmg - 0.16) < 0.001,
    '鼓吹 1 档 8 格 +4% → 10 档 16 格 +16%');
  const dlv = Math.max(1, Math.min(CONFIG.merge.maxLevel, Math.round(enemyLevelFor(800))));
  ok(s1.hp === Math.round(statsFor('shield', s1.lv).hp * 4) && s1.def === statsFor('shield', s1.lv).def
    && d1.hp === Math.round(statsFor('shield', dlv).hp * 3) && d1.def === statsFor('shield', dlv).def,
    `器械算战斗单位有血量：霹雳车 hp${s1.hp}/def${s1.def}（盾兵×4）、鼓吹 hp${d1.hp}/def${d1.def}（×3）`);
  ok(enginePower('thunder', 1, 350) > 0 && enginePower('drum', 1, 800, 20000) > 0,
    `战力折算：霹雳车 ${enginePower('thunder', 1, 350)} / 鼓吹 ${enginePower('drum', 1, 800, 20000)}`);
  ok(Math.abs(enginePower('drum', 10, 800, 20000) - Math.round(20000 * 0.16 * ENGINE_AURA_COVERAGE)) <= 1,
    '鼓吹战力 = 全阵战力 × 增伤 × 覆盖率 0.6');

  // 敌方器械：每 5 关一台；300~499 必是霹雳车；500 起 50/50 且同关只有一台
  ok(enemyEngineFor(295) === null && enemyEngineFor(299) === null, '非 5 倍数关卡不出器械');
  ok(enemyEngineFor(300).id === 'thunder' && enemyEngineFor(495).id === 'thunder',
    '300~499 的 5 关周期只出霹雳车');
  const late = [];
  for (let n = 500; n <= 1200; n += 5) late.push(enemyEngineFor(n).id);
  ok(late.every((id) => id === 'thunder' || id === 'drum'), '500 关后每个周期只出一台（不会同关两台）');
  const drumShare = late.filter((id) => id === 'drum').length / late.length;
  ok(drumShare > 0.3 && drumShare < 0.7, `500~1200 关鼓吹占比 ${(drumShare * 100).toFixed(0)}%（50/50 随机）`);
  ok(JSON.stringify(enemyEngineFor(1040)) === JSON.stringify(enemyEngineFor(1040)),
    '敌方器械用确定性哈希，同一关每次生成一致');
  ok(enemyEngineFor(300).tier === 1 && enemyEngineFor(2600).tier >= 9,
    `敌方档位随关卡递增：300 关 ${enemyEngineFor(300).tier} 档 → 2600 关 ${enemyEngineFor(2600).tier} 档`);
  ok(levelDef(300).engine && levelDef(300).enemies.length === 25,
    '主线第 300 关：器械不再替换小队，保持 25 支满编 + 1 台器械（修复 25→24 战力凹点）');

  // 斗技场集成：器械会开火、生成火圈、鼓吹给友军增伤
  {
    const b = createArenaBattle(
      [{ troop: 'shield', level: 5, col: 4, row: 2 }],
      [{ troop: 'shield', level: 5, col: 4, row: 2 }, { troop: 'archer', level: 5, col: 0, row: 2 }],
      mulberry32(5),
      { playerEngine: { id: 'thunder', tier: 1, stance: 'front' }, stage: 350 }
    );
    ok(b.engines.length === 1 && b.engines[0].engineId === 'thunder', '斗技场生成 1 台我方霹雳车');
    let shot = false;
    for (let i = 0; i < 600 && !b.over; i++) {
      const evs = b.step(CONFIG.combat.step);
      if (evs.some((e) => e.t === 'siegeShot')) { shot = true; break; }
    }
    ok(shot, '霹雳车会在开战后自动开火');
    ok(b.fireZones.length > 0, '落点生成火圈（持续伤害区域）');
    const eng = b.engines[0];
    ok(b.entities.includes(eng) && eng.engine && eng.hp > 0 && eng.def >= 0,
      `霹雳车进 entities 算战斗单位（hp${eng.hp} / def${eng.def}，可被索敌攻击）`);
    ok(eng.ranged === true && eng.backline === true && eng.troop === 'thunder',
      '霹雳车标记为远程 + 后排（白马义从按远程优先锁定它）');
    ok(eng.fireT > 0 && eng.fireT < CONFIG.battle.attackAnimTime,
      `开火当帧进入甩臂动画（fireT=${eng.fireT.toFixed(3)}s < ${CONFIG.battle.attackAnimTime}s）`);
    ok(b.fireZones.every((z) => Math.abs(z.radius - 2.5) < 0.01),
      `火圈半径按玩家要求削弱为 2.5 格（实测 ${b.fireZones[0].radius}）`);
    // 霹雳车阵亡：立刻停火，不再产生新的开火事件
    eng.alive = false;
    let shotAfterDeath = false;
    for (let i = 0; i < 3000 && !b.over; i++) {
      const evs = b.step(CONFIG.combat.step);
      if (evs.some((e2) => e2.t === 'siegeShot')) { shotAfterDeath = true; break; }
    }
    ok(!shotAfterDeath, '霹雳车阵亡后立刻停火（不再开炮）');

    const bd = createArenaBattle(
      [{ troop: 'shield', level: 5, col: 2, row: 2 }],
      [{ troop: 'shield', level: 5, col: 2, row: 2 }],
      mulberry32(6),
      { playerEngine: { id: 'drum', tier: 1, stance: 'center' }, stage: 800 }
    );
    bd.step(CONFIG.combat.step);
    const mate = bd.entities.find((e) => e.side === 'player');
    ok(Math.abs((mate.siegeDmgMult || 0) - 0.04) < 0.001, '鼓吹给半径内友军写入 +4% 增伤');
    ok(bd.entities.includes(bd.engines[0]) && bd.engines[0].hp > 0 && bd.engines[0].def >= 0,
      `鼓吹也进 entities 算战斗单位（hp${bd.engines[0].hp} / def${bd.engines[0].def}）`);
    ok(bd.engines[0].cooldown === Infinity && bd.engines[0].y === stancePoint('player', 'center').y,
      '鼓吹站桩不移动、不攻击');
    // 鼓吹阵亡：光环立刻失效
    bd.engines[0].alive = false;
    bd.step(CONFIG.combat.step);
    ok((mate.siegeDmgMult || 0) === 0, '鼓吹阵亡：增伤光环立刻失效');

    // 敌军能攻击器械本体：我方只有一台不还手的鼓吹，被清光即判负
    const lone = createArenaBattle(
      [],
      [{ troop: 'cavalry', level: 10, col: 4, row: 2 }],
      mulberry32(13),
      { playerEngine: { id: 'drum', tier: 1, stance: 'center' }, stage: 800 }
    );
    ok(lone.entities.includes(lone.engines[0]) && lone.engines[0].hp > 0,
      '空阵 + 鼓吹：器械是我方唯一战斗单位（有血量）');
    for (let i = 0; i < 6000 && !lone.over; i++) lone.step(CONFIG.combat.step);
    ok(lone.over && lone.winner === 'enemy',
      `敌军击毁器械后判负（鼓吹 hp${lone.entities.find((e) => e.engine).maxHp} 被清光）`);

    // 白马义从优先锁定我方后排的远程霹雳车；霹雳车阵亡后改锁剩余目标
    const bw = createArenaBattle(
      [{ troop: 'shield', level: 5, col: 4, row: 8 }],
      [{ troop: 'baima', level: 5, col: 4, row: 2 }],
      mulberry32(11),
      { playerEngine: { id: 'thunder', tier: 1, stance: 'front' }, stage: 350 }
    );
    bw.step(CONFIG.combat.step);
    const baima = bw.entities.find((e) => e.troop === 'baima');
    ok(baima && baima.targetId === 'peng', `白马义从优先锁定远程霹雳车（targetId=${baima && baima.targetId}）`);
    bw.engines[0].alive = false;
    let switched = false;
    for (let i = 0; i < 120 && !bw.over; i++) {
      bw.step(CONFIG.combat.step);
      if (baima.targetId && baima.targetId !== 'peng') { switched = true; break; }
    }
    ok(switched, '霹雳车阵亡后白马义从改锁剩余目标');

    // 开火动画曲线 + 光环可视化 / 序章直进布阵的源码断言
    ok(thunderKick(0) === 1.25 && Math.abs(thunderKick(0.5) - 0.15625) < 1e-9
      && thunderKick(1) === 0 && thunderKick(9) === 0,
      '霹雳车开火动画曲线：开火瞬间满甩 1.25 → 播完归零');
    const readSrc2 = (rel) => fs.readFileSync(path.resolve(rel), 'utf8');
    ok(readSrc2('src/screens/battle.js').includes('drawAuraRing')
      && readSrc2('src/screens/deploy.js').includes('drawAuraRing'),
      '战斗页与布阵页都画鼓吹增益范围圈');
    ok(readSrc2('src/game.js').includes("dest === 'deploy'"),
      '序章败北 finishPrologue 直进第 1 关排兵布阵');
  }

  // ---------- 兵书（800 关解锁） ----------
  {
    const st = createNewState();
    ok(st.books && st.books.atk === 0 && st.books.hp === 0 && st.books.def === 0, '新档兵书三卷默认 0 级');
    ok(!bookUnlocked(st) && !upgradeBook(st, 'atk').ok, '未到 800 关：兵书锁定、升不了');
    st.maxCleared = 800;
    ok(bookUnlocked(st), '第 800 关解锁兵书');

    ok(bookUpgradeCost('atk', 0) === 8000 && bookUpgradeCost('atk', 9) === 549756,
      '兵书价格 8000 起、1.6 倍几何（第 10 级 549,756）');
    ok(bookMaxTotal('atk') === 1452682 && bookMaxTotal('hp') === 1452682, '单卷满级 1,452,682 铜钱');
    ok(bookMaxTotal('atk') + bookMaxTotal('hp') + bookMaxTotal('def') === 4358046,
      '三卷满级 4,358,046 铜钱（约 800~2600 关首通总收入 1320 万的 1/3）');

    st.coins = 5000;
    const poor = upgradeBook(st, 'atk');
    ok(!poor.ok && poor.reason === 'poor' && st.coins === 5000, '铜钱不够时升级失败且不扣钱');
    st.coins = 100000;
    const up = upgradeBook(st, 'atk');
    ok(up.ok && st.coins === 92000 && bookLevel(st, 'atk') === 1, '升级扣 8000、等级 +1');
    ok(Math.abs(bookBonus(st).atk - 0.02) < 1e-9, '1 级 = 全军攻击 +2%');
    const scales = playerBookScales(st);
    ok(scales && Math.abs(scales.atkScale - 1.02) < 1e-9 && Math.abs(scales.hpMult - 1) < 1e-9,
      '兵书倍率按卷分开：只有武略影响攻击');

    st.books = { atk: 10, hp: 10, def: 10 };
    ok(!upgradeBook(st, 'atk').ok, '满级后不能再升');
    ok(Math.abs(bookBonus(st).def - 0.2) < 1e-9, '三卷满级每项 +20%');

    // 敌方对等加成：800 关 0% → 2000 关 +20% → 之后维持
    ok(enemyBookBonus(799) === 0 && enemyBookBonus(800) === 0, '敌方 800 关前没有兵书加成');
    ok(Math.abs(enemyBookBonus(1400) - 0.1) < 1e-9, '第 1400 关敌方 +10%');
    ok(Math.abs(enemyBookBonus(2000) - 0.2) < 1e-9 && Math.abs(enemyBookBonus(2600) - 0.2) < 1e-9,
      '第 2000 关敌方 +20% 后维持');
    const e800 = levelDef(800).enemies[0];
    ok(Math.abs((e800.atkScale || 1) - 1) < 1e-9, '800 关敌方还没吃到兵书加成');
    const e2000 = levelDef(2000).enemies[0];
    ok(Math.abs((e2000.atkScale || 1) - 1.2) < 1e-9, '2000 关敌方三项 +20%');
    // 英雄 BOSS 的血量倍数不能被兵书覆盖，只能相乘
    const bossSquad = levelDef(1600).enemies.find((e) => e.boss);
    if (bossSquad) {
      ok((bossSquad.hpMult || 1) > 1.1, `1600 关 BOSS 血量倍数与兵书相乘（${(bossSquad.hpMult || 1).toFixed(2)}）`);
    }

    // 斩将：第 2 章起出霹雳车（章节映射 200 → 无、420 → 霹雳车）
    ok(!enemyEngineFor(engineStageFor('gauntlet', 1)), '斩将第 1 章不出器械');
    ok(enemyEngineFor(engineStageFor('gauntlet', 2))?.id === 'thunder', '斩将第 2 章起出霹雳车');
  }

  // ---------- 横向铺开：演武 / 英雄战 / 斩将 ----------
  {
    // 锚点映射：三种模式都折算成主线关，器械 / 兵书走同一条成长曲线
    ok(engineStageFor('hero', 1) === 200 && engineStageFor('hero', 150) === 2600,
      `英雄战 1~150 关映射主线 200~2600（实测 ${engineStageFor('hero', 1)} / ${engineStageFor('hero', 150)}）`);
    ok(engineStageFor('gauntlet', 1) === 200 && engineStageFor('gauntlet', 2) === 420
      && engineStageFor('gauntlet', 12) === 2600,
      `斩将 1 章 → 200、2 章 → 420、12 章钳到 2600（不越界）`);

    // 演武：首 50 关是手写关（没有 mainLevel），用 trialMainLevel 折算，不能锚在 1~50
    ok(trialMainLevel(1) === CONFIG.trials.unlockLevel && trialMainLevel(200) === 2600,
      `演武 1~200 关对标主线 ${trialMainLevel(1)}~${trialMainLevel(200)} 关`);
    const trialGame = {
      state: createNewState(), W: 750, H: 1334,
      platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {},
    };
    const trial14 = new BattleScreen(trialGame, 14, mulberry32(3), { trial: TRIALS[13], def: TRIALS[13] });
    const trial50 = new BattleScreen(trialGame, 50, mulberry32(3), { trial: TRIALS[49], def: TRIALS[49] });
    ok(trial14.engineStage === trialMainLevel(14) && trial50.engineStage === trialMainLevel(50),
      `演武器械锚点 = 对标主线关（第 14 关 ${trial14.engineStage} / 第 50 关 ${trial50.engineStage}）`);
    ok(trial14.def.enemies.length === TRIALS[13].enemies.length - 1
      && trial14.battle.engines.some((e) => e.side === 'enemy'),
      `演武第 14 关（对标主线 ${trial14.engineStage}）敌方出器械，替换一支后排小队`);
    ok(trial50.def.enemies.length === TRIALS[49].enemies.length
      && !trial50.battle.engines.some((e) => e.side === 'enemy'),
      `演武第 50 关（对标主线 ${trial50.engineStage}，非 %5 周期）不出器械，阵位不减少`);

    // 英雄战：一关一关，不抽 %5；锚点 <300 时没有器械，第 8 关起每关都有
    ok(!enemyEngineFor(engineStageFor('hero', 1), true), '英雄战前 7 关（锚点 <300）没有敌方器械');
    const hbDef8 = heroBattleDef(8);
    const hero8 = new BattleScreen(trialGame, 8, mulberry32(3), {
      heroBattle: { stage: 8 }, def: hbDef8,
    });
    ok(hero8.engineStage === engineStageFor('hero', 8)
      && hero8.battle.engines.some((e) => e.side === 'enemy'),
      `英雄战第 8 关（锚点 ${hero8.engineStage}）起每关都有敌方器械`);
    ok(hero8.def.enemies.length === hbDef8.enemies.length
      && hero8.battle.engines.filter((e) => e.side === 'enemy').length === 1,
      `英雄战器械直接追加、不动手工编成（${hbDef8.enemies.length} 支小队 + 1 台器械）`);

    // 斩将：开跑锁定器械，中途换器械 / 换站位不影响本轮；存档往返保留、脏数据清洗
    const gs = createNewState();
    gs.maxCleared = 400;
    gs.siege = { tiers: { thunder: 3, drum: 2 }, choice: { id: 'thunder', tier: 3, stance: 'front' } };
    const gsRun = startGauntletRun(gs, 'sishui');
    ok(gsRun.ok && gs.gauntlet.run.engine
      && gs.gauntlet.run.engine.id === 'thunder' && gs.gauntlet.run.engine.stance === 'front',
      '斩将开跑时快照器械与站位（霹雳车 / 前军）');
    setEngineChoice(gs, 'drum', 'back');
    ok(gs.gauntlet.run.engine.id === 'thunder' && gs.gauntlet.run.engine.stance === 'front',
      '冲锋中途换器械 / 换站位不影响本轮（整轮锁定）');
    // 第 2 章（锚点 420）：双方各一台霹雳车，敌方手工编成不减少
    const ch2 = CONFIG.gauntlet.chapters[1];
    const ch2Def = gauntletStageDef(ch2.id, 1);
    const gb2 = new BattleScreen(gs, 1, mulberry32(3), {
      gauntlet: { run: { ...gs.gauntlet.run, chapter: ch2.id, stage: 1 }, stage: 1 },
    });
    ok(gb2.engineStage === 420
      && gb2.def.enemies.length === ch2Def.enemies.length
      && gb2.battle.engines.some((e) => e.side === 'enemy')
      && gb2.battle.engines.some((e) => e.side === 'player'),
      `斩将第 2 章（锚点 420）双方各一台霹雳车，敌方编成不减少（${ch2Def.enemies.length} 支 + 1 台）`);
    const gb = new BattleScreen({
      state: gs, W: 750, H: 1334, platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {},
    }, 1, mulberry32(3), { gauntlet: { run: gs.gauntlet.run, stage: 1 } });
    ok(gb.engineStage === 200 && gb.battle.engines.length === 1
      && gb.battle.engines[0].engineId === 'thunder',
      '斩将第 1 章锚点 200：玩家用锁定的霹雳车、敌方无器械');
    const gStore = { data: {}, getItem(k) { return this.data[k] || null; }, setItem(k, v) { this.data[k] = v; } };
    saveState(gStore, gs);
    const gBack = loadState(gStore);
    ok(gBack.gauntlet.run && gBack.gauntlet.run.engine
      && gBack.gauntlet.run.engine.id === 'thunder' && gBack.gauntlet.run.engine.tier === 3,
      '存档往返保留斩将锁定的器械（id / 档位）');
    const gRaw = JSON.parse(gStore.data[Object.keys(gStore.data)[0]]);
    gRaw.gauntlet.run.engine = { id: 'nope', tier: 99, stance: 'xx' };
    gStore.data[Object.keys(gStore.data)[0]] = JSON.stringify(gRaw);
    const gBad = loadState(gStore);
    ok(!gBad.gauntlet.run.engine, '存档里的未知器械 / 非法站位被清洗掉');
  }
}

console.log('\n== 1.2.5：大戟士口径 / 周常挑战 / 每日挑战 / 成就系统 ==');
{
  // ---- 1. 大戟士（daji）秒伤口径：满级 1.9 → 1.40，只砍大戟士 ----
  const dj1 = combatTraits('daji', 1);
  const dj10 = combatTraits('daji', 10);
  ok(dj1 && Math.abs(dj1.dealtMult - 1.10) < 1e-9,
    `大戟士 1 级 dealtMult=${dj1 && dj1.dealtMult}（+10%）`);
  ok(dj10 && Math.abs(dj10.dealtMult - 1.40) < 1e-9,
    `大戟士 10 级 dealtMult=${dj10 && dj10.dealtMult}（P1 从 1.9 档砍到 1.40）`);
  ok(!combatTraits('qingzhou', 10).dealtMult && !combatTraits('baier', 10).dealtMult,
    '青州兵 / 白毦兵都没有 dealtMult（只砍大戟士口径）');

  // ---- 2. 周常积分 draft：发分 / 换周重置 / 定价 / 升级补差 / 满编与不足 ----
  const wst = createNewState();
  wst.maxCleared = 40;
  ensureWeekly(wst);            // 首次：key 不一致 → 整域重建
  const wInit = ensureWeekly(wst);   // 同周再进：结构护栏补齐 25 格
  ok(wInit.points === weeklyStartPoints() && wInit.key === weekKey(),
    `周常初始化：开局积分 ${wInit.points}（weeklyStartPoints=${weeklyStartPoints()}） / 本周 key=${wInit.key}`);
  ok(wInit.form.length === 25 && wInit.form.every((v) => v === null),
    'form 补满 25 格空位');
  ok(wInit.cleared.length === 5 && wInit.cleared.every((v) => v === 0),
    '5 档进度掩码全 0');

  ok(weeklyCost('common', 1) === 16 && weeklyCost('rare', 1) === 24
    && weeklyCost('epic', 1) === 34 && weeklyCost('legendary', 1) === 48,
    '买断价 base：common16 / rare24 / epic34 / legendary48');
  ok(weeklyCost('common', 5) === 71
    && weeklyCost('common', 5) === Math.round(16 * Math.pow(1.45, 4)),
    `按 1.45^(lv−1)：common Lv5 = ${weeklyCost('common', 5)} = round(16×1.45⁴)`);

  const p0 = wInit.points;
  const buy1 = buyWeeklyTroop(wst, 'shield');
  ok(buy1.ok && buy1.cost === 16 && wst.weekly.points === p0 - 16,
    `买断 Lv1 扣 16 分：${p0} → ${wst.weekly.points}`);
  const uid1 = buy1.entry.id;
  let upOk = true;
  let upSpent = 0;
  for (let lv = 1; lv <= 3; lv++) {
    const want = weeklyTroopCost('shield', lv + 1) - weeklyTroopCost('shield', lv);
    const r = upgradeWeeklyTroop(wst, uid1);
    upOk = upOk && r.ok && r.cost === want && r.level === lv + 1;
    upSpent += r.cost;
  }
  ok(upOk, `升级只补差价：每档 = 买断价L+1 − 买断价L（Lv1→4 共 ${upSpent} 分）`);
  const ent = wst.weekly.roster.find((r) => r.id === uid1);
  ok(upSpent + buy1.cost === weeklyTroopCost('shield', ent.level),
    `累计投入 ${upSpent + buy1.cost} = 最终买断价 ${weeklyTroopCost('shield', ent.level)}（差分求和相消）`);
  const rem = removeWeeklyTroop(wst, uid1);
  ok(rem.ok && rem.refund === weeklyTroopCost('shield', ent.level) && wst.weekly.points === p0,
    `买→升→卖往返后积分守恒回 ${wst.weekly.points}`);

  // 积分不足（此时 roster 还没满，先验 points 分支）
  wst.weekly.points = 5;
  const poorBuy = buyWeeklyTroop(wst, 'archer');
  ok(!poorBuy.ok && poorBuy.reason === 'points', '积分不足（5 < 16）买兵返回 reason:points');
  wst.weekly.points = 1600;

  // 25 格满编后第 26 张被拒
  let fullRes = null;
  for (let i = 0; i < 26; i++) {
    const r = buyWeeklyTroop(wst, 'shield');
    if (!r.ok) { fullRes = r; break; }
  }
  ok(wst.weekly.roster.length === 25 && fullRes && fullRes.reason === 'full',
    `连买 26 张：25 格满编后第 26 张返回 full（roster=${wst.weekly.roster.length}）`);

  const dcpA = draftCapPower(wst);
  const dcpB = draftCapPower(wst);
  ok(dcpA === dcpB && dcpA > 0, `draftCapPower 两次调用同值且 >0（${dcpA}）`);

  // 换周（北京周一起算）：key 变化 → 积分 / 兵牌 / 进度整域重建
  wst.weekly.cleared[0] = 0b1111111111;
  const keyOld = wst.weekly.key;
  const now2 = Date.now() + 8 * 864e5;
  const wNew = ensureWeekly(wst, now2);
  ok(wNew.key === weekKey(now2) && wNew.key !== keyOld,
    `加 8 天换周：key ${keyOld} → ${wNew.key}`);
  ok(wNew.points === weeklyStartPoints() && wNew.roster.length === 0 && wNew.cleared.every((v) => v === 0)
    && wNew.granted === 0 && wNew.seen === false,
    `换周后积分回开局 ${weeklyStartPoints()}、兵牌 / 布阵 / 进度 / 发赏掩码全部归零`);

  // ---- 3. 五档难度与结算 ----
  const st3 = createNewState();
  st3.maxCleared = 40;
  ensureWeekly(st3);
  let defOk = true;
  let budgetPrev = 0;
  for (let t = 1; t <= 5; t++) {
    const capT = draftCapPower(st3, weeklyBudgetForTier(t));
    if (weeklyBudgetForTier(t) <= budgetPrev) defOk = false;   // 开战预算逐档递增
    budgetPrev = weeklyBudgetForTier(t);
    for (const s of [1, 5, 10]) {
      const d = weeklyLevelDef(st3, t, s);
      const want = Math.round(capT * CONFIG.weekly.tierMult[t - 1]
        * (1 + CONFIG.weekly.stageGrowth * (s - 1)));
      if (d.targetPower !== want) defOk = false;
      if (!d.weekly || d.weekly.tier !== t || d.weekly.stage !== s) defOk = false;
      if (d.bossCount !== 0 || d.heroBoss !== false) defOk = false;
      if (d.enemies.some((e) => e.hero || e.boss)) defOk = false;
    }
  }
  ok(defOk,
    `五档×(1/5/10) 关：targetPower=round(该档预算 ${weeklyBudgetForTier(1)}→${weeklyBudgetForTier(5)} 的纯兵上限 × tierMult[t] × (1+${CONFIG.weekly.stageGrowth}×(s−1)))，预算逐档递增、敌阵无 hero/boss`);
  ok(weeklyBudgetForTier(1) === weeklyStartPoints()
    && weeklyTierGrant(1) < weeklyTierGrant(5)
    && weeklyTotalPoints() === weeklyStartPoints() + CONFIG.weekly.tierGrants.reduce((a, b) => a + b, 0),
    `按档发放：开局 ${weeklyStartPoints()}、第 1 档赏 ${weeklyTierGrant(1)} < 第 5 档赏 ${weeklyTierGrant(5)}、总额 ${weeklyTotalPoints()}`);

  let engLow = true;
  for (let t = 1; t <= 3; t++) if (weeklyLevelDef(st3, t, 1).engine !== null) engLow = false;
  ok(engLow, 'engineFromTier=4：第 1~3 档 def.engine 恒为 null（敌方无器械）');
  const anc4 = engineStageFor('weekly', 4);
  const anc5 = engineStageFor('weekly', 5);
  const eng4 = levelDef(anc4).engine || null;
  const eng5 = levelDef(anc5).engine || null;
  const wEng4 = weeklyLevelDef(st3, 4, 1).engine || null;
  const wEng5 = weeklyLevelDef(st3, 5, 1).engine || null;
  ok(!!wEng4 === !!eng4 && !!wEng5 === !!eng5
    && (eng4 ? wEng4.id === eng4.id : true)
    && (eng5 ? wEng5.id === eng5.id : true),
    `第 4/5 档不剥器械（锚点 ${anc4} / ${anc5}：${eng4 ? eng4.id : '无'} / ${eng5 ? eng5.id : '无'} → 周常 def ${wEng4 ? wEng4.id : '无'} / ${wEng5 ? wEng5.id : '无'}）`);

  ok(weeklyTierUnlocked(st3, 2) === false, '第 2 档默认锁死（第 1 档没通完）');
  st3.weekly.cleared[0] = 0b1111111111;
  ok(weeklyTierUnlocked(st3, 2) === true, '第 1 档 10 关全亮 → 第 2 档解锁');
  st3.weekly.cleared[0] = 0;
  ok(weeklyStageUnlocked(st3, 1, 2) === false, '第 1 档第 2 关默认锁');
  st3.weekly.cleared[0] |= 1;
  ok(weeklyStageUnlocked(st3, 1, 2) === true, '通掉第 1 档第 1 关 → 第 2 关解锁');
  st3.weekly.cleared[0] = 0;
  // 上面把 cleared[0] 置满又清零的窗口里，ensureWeekly 回填已给第 1 档发过赏并置掩码 —— 复位后再断言逐档发放
  st3.weekly.granted = 0;
  st3.weekly.points = weeklyStartPoints();

  const add3 = (type, n) => addChest(st3, type, n);
  const coins30 = st3.coins;
  const c1 = recordWeeklyClear(st3, 1, 1, add3);
  ok(c1.firstClear && c1.coins === 500 && st3.coins === coins30 + 500
    && st3.counters.weeklyClears === 1,
    `第 1 档首通发 500 铜钱（累计周常首通 ${st3.counters.weeklyClears} 次）`);
  const c1b = recordWeeklyClear(st3, 1, 1, add3);
  ok(!c1b.firstClear && c1b.coins === 0 && !c1b.tierDone && st3.counters.weeklyClears === 1,
    '重复通关不发奖、counters 不涨');
  const c5 = recordWeeklyClear(st3, 1, 5, add3);
  ok(c5.chest === 'silver', '每 5 关首通发银箱');
  const c10 = recordWeeklyClear(st3, 1, 10, add3);
  ok(c10.tierDone && c10.tierCoins === 10000 && c10.chest === 'rare',
    `第 1 档第 10 关：档位大赏 ${c10.tierCoins} + ${c10.chest} 箱`);
  const c510 = recordWeeklyClear(st3, 5, 10, add3);
  ok(c510.tierCoins === 25000 && c510.chest === 'legendary',
    `第 5 档第 10 关：档位大赏 ${c510.tierCoins} + legendary 箱`);
  ok(st3.counters.weeklyClears === 4,
    `counters.weeklyClears 累计 ${st3.counters.weeklyClears} 次首通`);

  // 1.2.8 · 档位积分赏：第 1/5 档通关各发一笔、只发一次
  const grantSum = weeklyStartPoints() + weeklyTierGrant(1) + weeklyTierGrant(5);
  ok(c10.tierPoints === weeklyTierGrant(1) && c510.tierPoints === weeklyTierGrant(5)
    && st3.weekly.points === grantSum,
    `档位通关积分赏：+${c10.tierPoints} / +${c510.tierPoints}，累计积分 ${st3.weekly.points}（开局+两档=${grantSum}）`);
  const c10b = recordWeeklyClear(st3, 1, 10, add3);
  ok(c10b.tierPoints === 0 && st3.weekly.points === grantSum,
    '档位积分赏幂等：重复通关第 10 关不补发');

  // 1.2.8 · 「下一关」推进回归：第 10 关后不得出现第 11 关，第 5 档后不得出现第 6 档
  const stN = createNewState();
  stN.maxCleared = 40;
  ensureWeekly(stN);
  stN.weekly.cleared[0] = 0b1111111111;
  ok(weeklyNextStage(stN, 1, 5) && weeklyNextStage(stN, 1, 5).join('-') === '1-6',
    '档中推进：第 1 档第 5 关 → 第 1-6 关');
  ok(weeklyNextStage(stN, 1, 10) && weeklyNextStage(stN, 1, 10).join('-') === '2-1',
    '档末推进：打完第 1 档第 10 关 → 第 2 档第 1 关（不出第 11 关）');
  stN.weekly.cleared = [0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111, 0b1111111111];
  ok(weeklyNextStage(stN, 5, 10) === null,
    '全通回归：第 5 档第 10 关后返回 null（不出第 11 关 / 第 6 档）');
  ok(weeklyNextStage(stN, 5, 1) && weeklyNextStage(stN, 5, 1).join('-') === '5-2',
    '第 5 档档中推进仍在档内');

  // 1.2.8 · 首页红点：点进即消、按周/日周期重显、未解锁恒不显示
  const stR = createNewState();
  stR.maxCleared = 40;
  ok(weeklyOrbUnread(stR) === true, '周常红点：未建域（没点进过）→ 未读');
  ensureWeekly(stR);
  ok(weeklyOrbUnread(stR) === true, '周常红点：已建域但未点进 → 未读');
  stR.weekly.seen = true;
  ok(weeklyOrbUnread(stR) === false, '周常红点：点进面板后消失');
  ok(weeklyOrbUnread(stR, Date.now() + 8 * 864e5) === true, '周常红点：跨周自动重显');
  const stRL = createNewState();
  stRL.maxCleared = 10;
  ok(weeklyOrbUnread(stRL) === false, '周常红点：未解锁恒不显示');
  const stD = createNewState();
  stD.maxCleared = 40;
  ok(dailyChallengeOrbUnread(stD) === true, '每日红点：当日未点进 → 未读');
  stD.dailyChallenge = { progress: Array(CONFIG.dailyChallenge.total).fill(0), seenDay: dateKey() };
  ok(dailyChallengeOrbUnread(stD) === false, '每日红点：点进面板后消失');
  ok(dailyChallengeOrbUnread(stD, Date.now() + 864e5) === true, '每日红点：次日 0 点重显');
  const stDL = createNewState();
  stDL.maxCleared = 10;
  ok(dailyChallengeOrbUnread(stDL) === false, '每日红点：未解锁恒不显示');

  const swNo = weeklySweep(st3, 1, 2);
  ok(!swNo.ok && swNo.reason === 'notCleared', '未首通的关不能扫荡（notCleared）');
  const coinsS0 = st3.coins;
  const sweeps0 = st3.counters.sweeps;
  const sw1 = weeklySweep(st3, 1, 1);
  ok(sw1.ok && sw1.coins === 300 && st3.coins === coinsS0 + 300,
    `扫荡发首通铜钱 60%：${sw1.coins} = round(500×1 档×0.6)`);
  ok(st3.counters.sweeps === sweeps0 + 1, `counters.sweeps 递增 → ${st3.counters.sweeps}`);
  let swOkN = 0;
  let swLimit = null;
  for (let i = 0; i < 6; i++) {
    const r = weeklySweep(st3, 1, 5);
    if (r.ok) swOkN++; else swLimit = r;
  }
  ok(swOkN === 5 && swLimit && swLimit.reason === 'limit',
    `每日 6 次封顶：已用 1 次再扫 ${swOkN} 次后返回 limit`);
  ok(st3.counters.sweeps === sweeps0 + 1 + swOkN,
    `counters.sweeps 累计 ${st3.counters.sweeps} 次`);

  // ---- 4. draft 布阵与战斗接线 ----
  const st4 = createNewState();
  st4.maxCleared = 40;
  ensureWeekly(st4);
  const buys4 = ['shield', 'archer', 'spear'].map((t) => buyWeeklyTroop(st4, t));
  ok(buys4.every((b) => b.ok), 'draft 买入 3 张兵牌');
  const ids4 = st4.weekly.roster.map((r) => r.id);
  st4.weekly.form[0] = ids4[0];
  st4.weekly.form[6] = ids4[1];
  st4.weekly.form[12] = ids4[2];
  st4.heroes.guanping = 5;
  st4.weekly.form[18] = 'h:guanping';
  const draft4 = draftActiveFormation(st4);
  ok(draft4.length === 4,
    `draftActiveFormation 解析 4 支小队（3 兵牌 + 1 英雄，实际 ${draft4.length}）`);
  ok(draft4.every((d) => d.troop && Number.isFinite(d.level) && d.level > 0
    && Number.isInteger(d.col) && Number.isInteger(d.row)),
    '每项都带 troop / level / col / row');
  const hero4 = draft4.find((d) => d.hero === 'guanping');
  ok(hero4 && hero4.level === 5, '英雄格 h:guanping 生效并读到 state.heroes 等级 5');
  const cell0 = formationCell(0);
  const it0 = draft4.find((d) => d.uid === ids4[0]);
  ok(it0 && it0.col === cell0.col && it0.row === cell0.row, '兵牌格坐标与 formationCell 对齐');
  const depIds = draftDeployedIds(st4);
  ok(depIds.size === 3 && ids4.every((i) => depIds.has(i))
    && ![...depIds].some((v) => v.startsWith('h:')),
    'draftDeployedIds 只收兵牌 id、英雄格不入集合');

  const g4 = {
    state: st4, W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {}, push() {},
  };
  const bs4 = new BattleScreen(g4, 1, mulberry32(3), {
    weekly: { tier: 2, stage: 3 }, def: weeklyLevelDef(st4, 2, 3),
  });
  ok(bs4.engineStage === engineStageFor('weekly', 2),
    `周常战 engineStage = 档位锚点 ${engineStageFor('weekly', 2)}`);
  ok(bs4.weekly && bs4.weekly.tier === 2 && bs4.def.weekly
    && bs4.def.weekly.tier === 2 && bs4.def.weekly.stage === 3,
    'BattleScreen 认得 weekly opts，def.weekly={tier,stage} 透传');
  ok(bs4.playerSquads.length === draft4.length,
    `playerSquads 全部来自 draft（${bs4.playerSquads.length} 支 = 阵上 ${draft4.length} 支）`);

  // ---- 5. 每日挑战 ----
  ok(dailyTotal() === 30, '每日挑战共 30 关');
  ok(dailyHeroCount(1) === 1 && dailyHeroCount(12) === 1 && dailyHeroCount(13) === 2
    && dailyHeroCount(24) === 2 && dailyHeroCount(25) === 3 && dailyHeroCount(30) === 3,
    '英雄数分段：1~12 单将 / 13~24 双将 / 25~30 三将');
  const dh1 = dailyHeroes(1);
  const dh30 = dailyHeroes(30);
  ok(dh1.length === 1 && dh30.length === 3 && [...dh1, ...dh30].every((id) => !!heroById(id)),
    `出场英雄都存在（第 1 关 ${dh1[0]} / 第 30 关 ${dh30.join('/')}）`);
  ok(dailyAnchor(1) === 300 && dailyAnchor(30) === 2000,
    `锚点 300 → 2000（实测 ${dailyAnchor(1)} → ${dailyAnchor(30)}）`);
  ok(dailyHpMult(1) === 3 && dailyHpMult(30) === 12,
    `Boss 血量 ×3 → ×12（实测 ${dailyHpMult(1)} → ${dailyHpMult(30)}）`);
  const rD1 = dailyFirstClearReward(1);
  const rD30 = dailyFirstClearReward(30);
  ok(rD1.coins === 800 && rD30.coins === 20000,
    `首通 800 起逐关递增、封顶 20000（实测 ${rD1.coins} → ${rD30.coins}）`);
  ok(rD1.chest === 'wood' && dailyFirstClearReward(15).chest === 'silver'
    && dailyFirstClearReward(25).chest === 'rare',
    '首通宝箱分段：1 → wood / 15 → silver / 25 → rare');
  const bd1 = dailyBattleDef(1);
  ok(bd1.heroBattle === true && bd1.dailyChallenge === true && bd1.bossCount === 1
    && bd1.heroes.length === 1 && bd1.name.includes('每日挑战'),
    `每日 def 走英雄战通道（bossCount=${bd1.bossCount} · ${bd1.name}）`);
  ok(dailyBattleDef(25).bossCount === 3, '第 25 关起三将同场（bossCount=3）');

  const st5 = createNewState();
  st5.maxCleared = 40;
  ok(dailyStageUnlocked(st5, 2) === false, '第 2 关需要先过第 1 关');
  const chT0 = chestTotal(st5);
  const dc1 = recordDailyClear(st5, 1, (t, n) => addChest(st5, t, n));
  ok(dc1.firstClear && dc1.coins === 800 && chestTotal(st5) === chT0 + 1,
    `首通发 800 铜钱 + ${dc1.chest} 箱入仓（宝箱 ${chT0} → ${chestTotal(st5)}）`);
  ok(dailyStageUnlocked(st5, 2) === true, '过掉第 1 关 → 第 2 关解锁');
  const dc1b = recordDailyClear(st5, 1, () => {});
  ok(!dc1b.firstClear && dc1b.coins === 0, '重复通关不再发首通奖');
  const rep = [1, 2, 3, 4].map(() => recordDailyRepeatWin(st5, (t, n) => addChest(st5, t, n)));
  ok(rep.slice(0, 3).every((r) => r.rewarded && r.coins === 500) && rep[3].rewarded === false,
    '重复胜每天前 3 胜各 500，第 4 胜不再发');

  const g5 = {
    state: st5, W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {}, push() {},
  };
  const bd5 = dailyBattleDef(1);
  const bs5 = new BattleScreen(g5, 1, mulberry32(3), {
    heroBattle: bd5, dailyChallenge: { stage: 1 }, def: bd5,
  });
  ok(bs5.engineStage === engineStageFor('daily', 1) && bs5.engineStage === 300,
    `每日战 engineStage = 锚点 300（实测 ${bs5.engineStage}）`);
  ok(bs5.dailyChallenge && bs5.dailyChallenge.stage === 1 && bs5.def.dailyChallenge === true,
    'BattleScreen 认得 dailyChallenge opts，def.dailyChallenge=true');

  // ---- 6. 成就系统：16 条 × 2~3 档 / 领奖流程 / 存档白名单清洗 ----
  ok(ACHIEVEMENTS.length === 16, `成就 16 条（实际 ${ACHIEVEMENTS.length}）`);
  ok(ACHIEVEMENT_CATS.length === 5 && new Set(ACHIEVEMENTS.map((a) => a.cat)).size === 5,
    `5 个分类，成就屏「全部 + 5 类」共 ${ACHIEVEMENT_CATS.length + 1} 个页签`);
  ok(ACHIEVEMENTS.every((a) => a.tiers.length >= 2
    && a.tiers.every((t, i, arr) => i === 0 || t.n > arr[i - 1].n)),
    '每条 2~3 档且阈值 n 严格递增');
  ok(ACHIEVEMENTS.every((a) => typeof a.progress === 'function'),
    '每条都带 progress(state) 实时读档、不落档');

  const mainAch = ACHIEVEMENTS.find((a) => a.id === 'main_progress');
  const stP = createNewState();
  stP.maxCleared = 10;
  ok(achievementProgress(mainAch, stP) === 10, '进度实时读 state（maxCleared=10 → 问鼎中原 10）');

  const stA = createNewState();
  ok(claimAchievement(stA, 'main_progress', 0).reason === 'notDone', '未达成领取 → notDone');
  stA.maxCleared = 10;
  const coinsA0 = stA.coins;
  const chA0 = chestTotal(stA);
  const crA = claimAchievement(stA, 'main_progress', 0);
  ok(crA.ok && crA.coins === 400 && stA.coins === coinsA0 + 400 && chestTotal(stA) === chA0 + 1,
    `达成领取：铜钱 +${crA.coins}、${crA.chest} 箱入仓`);
  ok(stA.achievements.claimed.includes('main_progress:0'), '已领键 main_progress:0 已登记');
  ok(claimAchievement(stA, 'main_progress', 0).reason === 'claimed', '同档再领 → claimed');
  ok(claimAchievement(stA, 'no_such_achievement', 0).reason === 'unknown', '未知 id → unknown');
  ok(claimAchievement(stA, 'main_progress', 9).reason === 'unknown', '越档次位下标 → unknown');

  const stB = createNewState();
  stB.maxCleared = 10;
  stB.stats.wins = 60;
  const keys0 = claimableKeys(stB);
  ok(keys0.includes('main_progress:0') && keys0.includes('total_wins:0')
    && claimableCount(stB) === keys0.length,
    `claimableKeys / claimableCount 同口径（${keys0.length} 项可领：${keys0.join(' , ')}）`);
  claimAchievement(stB, 'main_progress', 0);
  ok(!claimableKeys(stB).includes('main_progress:0') && claimableCount(stB) === keys0.length - 1,
    '领取后可领数 -1');

  stB.counters = { chestsOpened: 20, sweeps: 10, weeklyClears: 10 };
  ok(achievementProgress(ACHIEVEMENTS.find((a) => a.id === 'chest_open'), stB) === 20,
    'counters.chestsOpened 实时读数 20');
  ok(claimAchievement(stB, 'chest_open', 0).ok && claimAchievement(stB, 'sweep_count', 0).ok
    && claimAchievement(stB, 'weekly_clear', 0).ok,
    '开箱 / 扫荡 / 周常首通三条 counters 成就达标可领');

  const gStore6 = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = v; },
  };
  saveState(gStore6, stA);
  ok(loadState(gStore6).achievements.claimed.includes('main_progress:0'),
    '存档往返保留已领键');

  const rawKey6 = Object.keys(gStore6.data)[0];
  const raw6 = JSON.parse(gStore6.data[rawKey6]);
  raw6.achievements.claimed = ['main_progress:0', 'bad key', 'x:notnum', '9lead:1', 'ok:abc',
    ...Array.from({ length: 600 }, (_, i) => `total_wins:${i}`)];
  gStore6.data[rawKey6] = JSON.stringify(raw6);
  const cl6 = loadState(gStore6).achievements.claimed;
  ok(cl6.includes('main_progress:0') && !cl6.includes('bad key') && !cl6.includes('x:notnum')
    && !cl6.includes('9lead:1') && !cl6.includes('ok:abc'),
    '非法已领键按白名单 /^[a-zA-Z][\\w-]*:\\d+$/ 清洗');
  ok(cl6.length === 500, `清洗后键数封顶 500（实际 ${cl6.length}）`);

  stA.counters = { chestsOpened: 7, sweeps: 3, weeklyClears: 2 };
  saveState(gStore6, stA);
  const backC = loadState(gStore6);
  ok(backC.counters.chestsOpened === 7 && backC.counters.sweeps === 3
    && backC.counters.weeklyClears === 2,
    'counters 存档往返保留（不随每日 / 每周重置）');
  // 1.2.8 · 红点已读标记与档位发赏掩码进白名单
  const stW8 = createNewState();
  stW8.maxCleared = 40;
  ensureWeekly(stW8);
  stW8.weekly.seen = true;
  stW8.weekly.granted = 0b00101;
  stW8.weekly.points = weeklyTotalPoints();
  stW8.dailyChallenge = { progress: Array(CONFIG.dailyChallenge.total).fill(1), seenDay: dateKey() };
  saveState(gStore6, stW8);
  const backW8 = loadState(gStore6);
  ok(backW8.weekly.seen === true && backW8.weekly.granted === 0b00101
    && backW8.weekly.points === weeklyTotalPoints(),
    `存档往返保留周常 seen / granted 掩码 / 积分 ${backW8.weekly.points}`);
  ok(backW8.dailyChallenge.seenDay === dateKey()
    && backW8.dailyChallenge.progress.every((v) => v === 1),
    '存档往返保留每日挑战 seenDay 与 30 位进度');

  // ---- 7. 三个新屏手势 ----
  const pushedW = [];
  const gW = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {},
    push(s) { pushedW.push(s); },
  };
  gW.state.maxCleared = 10;
  const wLocked = new WeeklyChallengeScreen(gW);
  ok(!weeklyUnlocked(gW.state) && wLocked.tab === 0,
    `未解锁（maxCleared=10<30）构造不炸、tab=${wLocked.tab}`);
  gW.state.maxCleared = 40;
  const wS = new WeeklyChallengeScreen(gW);
  ok(wS.tab === 0, '解锁态默认停在「挑战关卡」页签（tab=0）');
  const cardW = { rect: { x: 0, y: 0, w: 8, h: 8 }, tier: 1, stage: 1, unlocked: true, tierUnlocked: true, cleared: false, def: null };
  wS.tapStage(cardW);
  ok(wS.tab === 1, '还没买兵牌时点第 1 关 → 自动切到「积分选兵」页签（tab=1）');
  const ptsW0 = gW.state.weekly.points;
  wS.tapBuy('shield');
  ok(gW.state.weekly.roster.length === 1 && gW.state.weekly.points === ptsW0 - 16,
    `点买兵：roster=1、积分 ${ptsW0} → ${gW.state.weekly.points}`);
  recordWeeklyClear(gW.state, 1, 1, (t, n) => addChest(gW.state, t, n));
  const coinsW0 = gW.state.coins;
  wS.tapStage({ ...cardW, cleared: true });
  ok(gW.state.coins === coinsW0 + 300 && gW.state.weekly.sweepCount === 1,
    '点已通关关卡 → weeklySweep 入账 300（今日 1/6 次）');
  wS.tapStage({ ...cardW, stage: 2 });
  ok(pushedW.length === 1 && pushedW[0].constructor.name === 'DeployScreen'
    && pushedW[0].weekly && pushedW[0].weekly.tier === 1 && pushedW[0].weekly.stage === 2,
    '有兵牌后点未通关关卡 → push DeployScreen（带 weekly 1-2）');

  const pushedD = [];
  const gD = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() {}, pop() {}, go() {},
    push(s) { pushedD.push(s); },
  };
  gD.state.maxCleared = 40;
  const dS = new DailyChallengeScreen(gD);
  ok(dS.cardRects.length === 0 && dS.scrollY === 0, '每日屏构造：未绘制前卡片列表为空');
  const vD = DAILY_LAYOUT.view;
  dS.onDown(vD.x + 350, vD.y + 120);
  dS.onMove(vD.x + 350, vD.y + 70);
  dS.onUp(vD.x + 350, vD.y + 70);
  ok(dS.drag === null && dS.scrollY > 0 && dS.scrollY <= dS.maxScroll(),
    `onDown/onMove/onUp 不炸（scrollY=${dS.scrollY} / 上限 ${dS.maxScroll()}）`);
  dS.scrollY = 0;
  const rectD1 = {
    x: DAILY_LAYOUT.x0, y: DAILY_LAYOUT.y0,
    w: DAILY_LAYOUT.cardW, h: DAILY_LAYOUT.cardH,
  };
  dS.cardRects = [{
    rect: rectD1, stage: 1, unlocked: dailyStageUnlocked(gD.state, 1), def: dailyBattleDef(1),
  }];
  dS.onUp(rectD1.x + rectD1.w / 2, rectD1.y + rectD1.h / 2);
  ok(pushedD.length === 1 && pushedD[0].dailyChallenge && pushedD[0].dailyChallenge.stage === 1
    && pushedD[0].heroBattle && pushedD[0].def,
    '第 1 关可点：push DeployScreen（heroBattle + dailyChallenge）');

  let saveN = 0;
  const gA = {
    state: createNewState(), W: 750, H: 1334,
    platform: { vibrate() {} }, toast() {}, save() { saveN++; }, pop() {}, go() {}, push() {},
  };
  gA.state.maxCleared = 10;
  const aS = new AchievementsScreen(gA);
  ok(aS.cat === 'all' && aS.claimRects.length === 0, '成就屏构造：默认「全部」页签、领取热区为空');
  const TA = ACHIEVEMENT_LAYOUT.tabs;
  aS.onDown(TA.x0 + 5, TA.y + 5);
  aS.onDown(TA.x0 + (TA.w + TA.gap) + 5, TA.y + 5);
  ok(aS.cat === 'battle', `点分类页签切换 → cat=${aS.cat}（ACHIEVEMENT_CATS[0]「征战」）`);
  // 1.2.8：6 个页签（全部 + 5 类）必须全部落在 750 宽屏内（旧布局 837 宽，「经济」被右边缘裁掉）
  const tabRight = TA.x0 + (ACHIEVEMENT_CATS.length + 1) * (TA.w + TA.gap) - TA.gap;
  ok(tabRight <= 750,
    `成就分类栏 6 页签右缘 ${tabRight} ≤ 750（x0=${TA.x0} w=${TA.w} gap=${TA.gap}，全部可见）`);
  const coinsA2 = gA.state.coins;
  aS.claimRects = [{ rect: { x: 200, y: 300, w: 140, h: 52 }, id: 'main_progress', index: 0 }];
  aS.onUp(260, 320);
  ok(saveN === 1 && gA.state.coins === coinsA2 + 400
    && gA.state.achievements.claimed.includes('main_progress:0'),
    '注入领取热区后 onUp：铜钱 +400 入账且 game.save 被调用');
  aS.onUp(260, 320);
  ok(saveN === 1, '已领的档再点不重复发奖、不重复存档');
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
