// 结算页「下一个解锁」：目标全部从真实配置派生，不写死文案
//   - 兵种 / 系统：直接复用「成长之路」的节点表（其数值来自 CONFIG）
//   - 关卡赠送英雄：CONFIG.heroes.levelHeroRewards
//   - 7 日登录：CONFIG.daily.login7（随每日系统一起在 CONFIG.daily.unlockLevel 开放）
import { CONFIG } from '../data/config.js';
import { GROWTH_NODES } from '../data/growth.js';
import { heroById } from '../data/heroes.js';

function login7Target() {
  const days = (CONFIG.daily && CONFIG.daily.login7 && CONFIG.daily.login7.days) || [];
  if (!days.length) return null;
  const label = (r) => {
    if (!r) return '';
    if (r.kind === 'hero') {
      const hero = heroById(r.hero);
      return hero ? hero.name : (r.name || '');
    }
    return r.name || '';
  };
  const firstDay = label(days[0]);
  const lastDay = label(days[days.length - 1]);
  return {
    id: 'login7',
    kind: 'login7',
    level: CONFIG.daily.unlockLevel,
    title: '7 日登录奖励',
    desc: `第 1 天 ${firstDay} · 第 ${days.length} 天 ${lastDay}`,
    badge: '签',
    order: 900,
  };
}

function heroTarget(level, heroId) {
  const hero = heroById(heroId);
  return {
    id: `hero:${heroId}`,
    kind: 'hero',
    level,
    title: hero ? hero.name : String(heroId),
    desc: hero
      ? `${hero.tier === 'legendary' ? '传奇' : '史诗'}英雄 · ${hero.title}`
      : '关卡首通赠送英雄',
    hero: heroId,
    badge: '将',
    // 同关有多个目标时，赠将优先展示（400 关先看到关平，再看到宝箱加成）
    order: -10,
  };
}

let cache = null;

// 全部解锁目标（按关卡升序；同关按成长之路顺序）
export function unlockTargets() {
  if (cache) return cache;
  const list = GROWTH_NODES.map((node, i) => ({ ...node, order: i }));
  const login = login7Target();
  if (login) list.push(login);
  const rewards = (CONFIG.heroes && CONFIG.heroes.levelHeroRewards) || {};
  for (const key of Object.keys(rewards)) {
    const level = Math.floor(Number(key));
    if (Number.isFinite(level) && level > 0) list.push(heroTarget(level, rewards[key]));
  }
  cache = list.sort((a, b) => a.level - b.level || a.order - b.order);
  return cache;
}

// 计算当前该展示哪个目标：
//   - 胜利且刚通关的那一关正好是解锁关 → 展示该目标并标记「已解锁」
//   - 否则取第一个还没到的目标（战败页用同一口径）
//   - 所有目标都已解锁 → 返回 null（整块隐藏）
export function nextUnlockInfo(state, { levelN = 0, win = false } = {}) {
  const cleared = Math.max(0, Math.floor(Number(state && state.maxCleared) || 0));
  const targets = unlockTargets();
  let focusIdx = -1;

  if (win && levelN > 0 && cleared >= levelN) {
    focusIdx = targets.findIndex((t) => t.level === levelN);
  }
  if (focusIdx < 0) focusIdx = targets.findIndex((t) => t.level > cleared);
  if (focusIdx < 0) return null;

  const focus = targets[focusIdx];
  const achieved = focus.level <= cleared;
  const targetLevel = Math.max(1, focus.level);

  const upcoming = [];
  for (let i = focusIdx + 1; i < targets.length && upcoming.length < 2; i++) {
    upcoming.push(targets[i]);
  }

  return {
    focus,
    achieved,
    cleared,
    targetLevel,
    remain: achieved ? 0 : Math.max(0, focus.level - cleared),
    ratio: Math.max(0, Math.min(1, cleared / targetLevel)),
    upcoming,
  };
}
