// 开发者通道：仅用于调试 / 体验，不属于正常玩家功能
// 兵营：一键给每个兵种（含全部特殊兵种）各发 1 个 Lv1 单位
import { CONFIG } from '../data/config.js';
import { addUnit } from './levels.js';

export function devGrantAllTroops(state) {
  const added = [];
  const full = [];
  for (const t of CONFIG.troops) {
    const u = addUnit(state, t.id, 1);
    if (u) added.push(t.id);
    else full.push(t.id);
  }
  return { ok: true, added, full, total: CONFIG.troops.length };
}
