// 新内容解锁教学：每解锁一个新功能 / 新兵种，首次过关后强制弹一次教学。
// 节点直接复用「成长之路」的 GROWTH_NODES，保证教学内容和实际解锁条件一致。
import { GROWTH_NODES } from '../data/growth.js';

export function unlockNodeIds() {
  return GROWTH_NODES.map((n) => n.id);
}

export function unlockSeenList(state) {
  return Array.isArray(state && state.unlockSeen) ? state.unlockSeen : [];
}

export function hasSeenUnlock(state, id) {
  return unlockSeenList(state).includes(id);
}

export function markUnlockSeen(state, id) {
  if (!state || !id || hasSeenUnlock(state, id)) return;
  state.unlockSeen = unlockSeenList(state).concat(id);
}

// 本次通关（level）新解锁、且还没弹过教学的节点。
// 一次可能返回多个（例如 150 关同时解锁白马义从 + 演武）。
export function pendingUnlockTeachings(state, level) {
  const n = Math.max(0, Math.floor(Number(level) || 0));
  if (!n) return [];
  return GROWTH_NODES.filter((node) => node.level === n && !hasSeenUnlock(state, node.id));
}

// 老存档迁移：已经解锁过的内容不再补弹教学（避免更新后被一堆弹窗轰炸）
export function seedUnlockSeen(state, maxCleared) {
  const cleared = Math.max(0, Math.floor(Number(maxCleared) || 0));
  state.unlockSeen = GROWTH_NODES.filter((n) => n.level <= cleared).map((n) => n.id);
}
