// 新手引导：只教「点哪里 / 拖到哪里」，不解释规则和原因
// - 强引导（遮罩 + 高亮 + 手势图标 + 指向动画）：首次布阵 / 首次合成 / 首次开箱
// - 每条只有一句最短动作指令（如「拖到白框」），说明性长句一律不写
// - demo：帮助页重看时的静态手势卡（不绑定页面锚点）
import { maxLevel } from './merge.js';
import { troopLevelCap } from './units.js';

export const TUTORIAL_VERSION = 1;

export function emptyTutorial() {
  return { version: TUTORIAL_VERSION, seen: {}, skipped: false };
}

// 读档清洗：只保留当前配置里存在的步骤，未知 id 一律丢弃（防止旧档 / 伪造数据）
// mergeAlreadyAvailable：这次更新前兵营已经 ≥25 张的老档，视为「已见过拖动合成」，不再补弹
export function sanitizeTutorial(raw, { legacy = false, maxCleared = 0, mergeAlreadyAvailable = false } = {}) {
  const out = emptyTutorial();
  if (legacy && maxCleared >= 10) {
    // 老玩家（已经打过 10 关）不补弹新手引导：直接标记为已跳过 + 全部看过
    out.skipped = true;
    for (const s of TUTORIAL_STEPS) out.seen[s.id] = true;
    return out;
  }
  if (!raw || typeof raw !== 'object') return out;
  out.skipped = raw.skipped === true;
  out.version = Number.isFinite(raw.version) ? Math.max(1, Math.floor(raw.version)) : TUTORIAL_VERSION;
  const known = new Set(TUTORIAL_STEPS.map((s) => s.id));
  if (raw.seen && typeof raw.seen === 'object') {
    for (const id of Object.keys(raw.seen)) {
      if (known.has(id) && raw.seen[id] === true) out.seen[id] = true;
    }
  }
  // 读档时已经满 25 张兵牌的老档：合成教程只对新达到 25 张的玩家触发
  if (mergeAlreadyAvailable) out.seen.merge = true;
  return out;
}

export function ensureTutorial(state) {
  if (!state.tutorial || typeof state.tutorial !== 'object') state.tutorial = emptyTutorial();
  const t = state.tutorial;
  if (!t.seen || typeof t.seen !== 'object') t.seen = {};
  if (typeof t.skipped !== 'boolean') t.skipped = false;
  return t;
}

export function tutorialSeen(state, id) {
  return ensureTutorial(state).seen[id] === true;
}

export function markTutorialSeen(state, id) {
  const t = ensureTutorial(state);
  if (id) t.seen[id] = true;
  return t;
}

// 跳过 = 全局一次性跳过所有「强制步骤」
export function skipTutorial(state) {
  const t = ensureTutorial(state);
  t.skipped = true;
  for (const s of TUTORIAL_STEPS) if (s.kind === 'strong') t.seen[s.id] = true;
  return t;
}

// 找出「两个可合成的兵牌」：同兵种、同等级、未到档位上限
// cards: [{ uid, troop, level, rect }]
export function findMergePair(state, cards) {
  const list = (cards || []).filter((c) => c && c.rect);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.uid === b.uid || a.troop !== b.troop || a.level !== b.level) continue;
      if (a.level >= maxLevel()) continue;
      if (a.level + 1 > troopLevelCap(state, a.troop)) continue;
      return [a, b];
    }
  }
  return null;
}

// 引导步骤表（全部是手势引导）
// screen：页面 id；anchor：要高亮的锚点 key；allow：强引导期间允许操作的锚点 key；
// gesture：图标手势（tap 点 / drag 拖 / merge 合到一起）；action：唯一的一句动作指令（≤5 字）
export const TUTORIAL_STEPS = [
  {
    id: 'deploy',
    kind: 'strong',
    screen: 'deploy',
    name: '布阵',
    gesture: 'drag',
    action: '拖到白框',
    prefer: 'above',   // 卡片放上方：下方是兵牌列表，不能挡住拖拽起点
    anchor: ['slots'],
    allow: ['arena', 'slots', 'list', 'confirm'],
    when: (st, ctx) => ctx.mode === 'battle' && !ctx.prologue,
  },
  {
    // 序章专用：不弹遮罩，由布阵页底部画「双指缩放」提示；
    // 必须真的缩放战场才算完成，没有跳过入口。
    id: 'zoom',
    kind: 'hint',
    screen: 'deploy',
    name: '缩放',
    gesture: 'pinch',
    action: '双指缩放',
    anchor: ['arena'],
    when: (st, ctx) => !!ctx.prologue && !ctx.zoomDone,
  },
  {
    // 兵营满 25 张兵牌后只教一次：拖两个同兵种到合成位
    id: 'merge',
    kind: 'strong',
    screen: 'barracks',
    name: '合成',
    gesture: 'merge',
    action: '拖到一起',
    prefer: 'above',
    anchor: ['mergePair'],
    allow: ['list', 'grid'],
    when: (st, ctx) => !!ctx.mergePair && ctx.mergeReady === true,
  },
  {
    id: 'chest',
    kind: 'strong',
    screen: 'chests',
    name: '开箱',
    gesture: 'tap',
    action: '点开箱',
    anchor: ['chestOpen'],
    allow: ['chestOpen'],
    when: (st, ctx) => !!ctx.chestOpen,
  },
];

export function findStep(id) {
  return TUTORIAL_STEPS.find((s) => s.id === id) || null;
}

function matchScreen(step, screenId) {
  return Array.isArray(step.screen) ? step.screen.includes(screenId) : step.screen === screenId;
}

// 选出当前页面上该出现的那一条
export function pickTutorial(state, ctx) {
  const t = ensureTutorial(state);
  return TUTORIAL_STEPS.find((s) => {
    // hint 步骤由页面自己画极简箭头，不走遮罩层
    if (s.kind === 'hint') return false;
    if (!matchScreen(s, ctx.screen)) return false;
    if (t.seen[s.id]) return false;
    if (s.kind === 'strong' && t.skipped) return false;
    return !s.when || s.when(state, ctx);
  }) || null;
}
