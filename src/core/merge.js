// 合成系统：2 个「同兵种 + 同等级」的单位合成 1 个高一级的单位（上限 10 级）
// 纯逻辑（只改 state），不碰存档读写与界面
import { CONFIG } from '../data/config.js';
import { maxUnitLevel, unitName, troopLevelCap } from './units.js';
import { noteMerge } from './daily.js';

// 一键合成入口门槛：兵营兵牌数达到这个值后才对玩家显示（只影响入口，不改合成数值）
export const AUTO_MERGE_MIN_UNITS = 25;

export function maxLevel() {
  return maxUnitLevel();
}

// 可以作为「材料」的候选：同兵种、同等级、且不是自己
// 试用兵（trialLeft > 0）不可作为合成目标或材料
export function mergeCandidates(state, uid) {
  const target = state.units.find((u) => u.id === uid);
  if (!target || target.trialLeft > 0 || target.level >= maxLevel()) return [];
  // 关卡档位上限（稀有 100~250 关 ≤ Lv4 / 史诗 200~250 关 ≤ Lv5）：到顶后不再给合成候选
  if (target.level + 1 > troopLevelCap(state, target.troop)) return [];
  return state.units.filter((u) => u.id !== uid && !(u.trialLeft > 0)
    && u.troop === target.troop && u.level === target.level);
}

// 详情页要展示的全部合成信息
export function mergeInfo(state, uid) {
  const unit = state.units.find((u) => u.id === uid) || null;
  if (!unit) return { unit: null, atMax: false, candidates: [], owned: 0, canMerge: false, nextName: '' };
  const atMax = unit.level >= maxLevel();
  const candidates = atMax ? [] : mergeCandidates(state, uid);
  return {
    unit,
    atMax,
    candidates,
    owned: candidates.length + 1,
    canMerge: candidates.length > 0,
    nextName: atMax ? '' : unitName(unit.troop, unit.level + 1),
  };
}

// 合成：本体保留（等级 +1、留在原布阵格），材料被消耗（同时从布阵里移除）
export function mergeUnits(state, uid, materialId) {
  const target = state.units.find((u) => u.id === uid);
  const material = state.units.find((u) => u.id === materialId);
  if (!target || !material || target.id === material.id) return { ok: false, reason: 'invalid' };
  if (target.trialLeft > 0 || material.trialLeft > 0) return { ok: false, reason: 'trial' };
  if (target.troop !== material.troop) return { ok: false, reason: 'troop' };
  if (target.level !== material.level) return { ok: false, reason: 'level' };
  if (target.level >= maxLevel()) return { ok: false, reason: 'max' };
  const cap = troopLevelCap(state, target.troop);
  if (target.level + 1 > cap) return { ok: false, reason: 'cap', cap };

  const fromLevel = target.level;
  state.units = state.units.filter((u) => u.id !== material.id);
  state.formation = state.formation.map((x) => (x === material.id ? null : x));
  target.level = fromLevel + 1;
  noteMerge(state, 1);
  return { ok: true, reason: 'ok', unit: target, fromLevel, toLevel: target.level };
}

// 一键合成：从最低等级开始，反复把「同兵种同等级」两两合成到不能合为止
export function autoMerge(state) {
  let merges = 0;
  for (let guard = 0; guard < 200; guard++) {
    let pair = null;
    for (let level = 1; level < maxLevel() && !pair; level++) {
      for (const t of CONFIG.troops) {
        if (level + 1 > troopLevelCap(state, t.id)) continue;
        const group = state.units.filter((u) => u.troop === t.id && u.level === level && !(u.trialLeft > 0));
        if (group.length >= 2) {
          pair = [group[0], group[1]];
          break;
        }
      }
    }
    if (!pair) break;
    mergeUnits(state, pair[0].id, pair[1].id);
    merges++;
  }
  return merges;
}
