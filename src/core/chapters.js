// 章节 / 城池：全部从 CONFIG.chapters 读（新增章节只改配置）
// 结构：章节 → 城池（每城 100 关）→ 每关首通宝箱（常规轮换 + 城池 / 章节里程碑额外奖励）
import { CONFIG } from '../data/config.js';

export function chapterList() {
  return Array.isArray(CONFIG.chapters) ? CONFIG.chapters : [];
}

export function chapterRange(ch) {
  const cities = ch?.cities || [];
  if (!cities.length) return { from: 1, to: 0 };
  return { from: cities[0].from, to: cities[cities.length - 1].to };
}

// 所有章节加起来的关卡数（= levelGen.total，配错时也能自洽）
export function totalLevels() {
  return chapterList().reduce((sum, ch) => {
    const r = chapterRange(ch);
    return sum + Math.max(0, r.to - r.from + 1);
  }, 0);
}

export function chapterOfLevel(n) {
  return chapterList().find((ch) => n >= chapterRange(ch).from && n <= chapterRange(ch).to) || null;
}

export function chapterIndexOf(ch) {
  return chapterList().indexOf(ch);
}

// 关卡对应的战场主题 id（arenaThemes 的键）；配置缺失时回落到第一章黄沙
export function chapterThemeOfLevel(n) {
  return chapterOfLevel(n)?.theme || 'huangjin';
}

export function cityOfLevel(n) {
  for (const ch of chapterList()) {
    for (const city of ch.cities || []) {
      if (n >= city.from && n <= city.to) return city;
    }
  }
  return null;
}

export function cityRange(city) {
  return { from: city?.from ?? 1, to: city?.to ?? 0 };
}

// 关卡在城池 / 章节里的位置（0 起）
export function progressInRange(n, range) {
  const total = Math.max(1, range.to - range.from + 1);
  return Math.min(1, Math.max(0, (n - range.from + 1) / total));
}

// 某关首通额外奖励（城池通关 + 章节通关）——常规宝箱由 chests.levelChests 单独算
// 返回 [{ chest: 'gold', n: 1 }, ...] 扁平列表（只取宝箱奖励）
export function milestoneChestsAt(n) {
  const list = [];
  const city = cityOfLevel(n);
  if (city && n === city.to && Array.isArray(city.reward)) {
    for (const r of city.reward) {
      if (!r || !r.chest) continue;
      for (let i = 0; i < (r.n || 1); i++) list.push(r.chest);
    }
  }
  const ch = chapterOfLevel(n);
  if (ch && n === chapterRange(ch).to && Array.isArray(ch.clearReward)) {
    for (const r of ch.clearReward) {
      if (!r || !r.chest) continue;
      for (let i = 0; i < (r.n || 1); i++) list.push(r.chest);
    }
  }
  return list;
}

// 某关首通额外赠送的固定兵种（如 100 关 3 级元戎弩手 / 200 关 3 级虎豹骑）
// 返回 [{ unit: 'yuanyong', level: 3 }, ...]
export function milestoneUnitsAt(n) {
  const list = [];
  const city = cityOfLevel(n);
  if (city && n === city.to && Array.isArray(city.reward)) {
    for (const r of city.reward) {
      if (!r || !r.unit) continue;
      for (let i = 0; i < (r.n || 1); i++) {
        list.push({ unit: r.unit, level: Math.max(1, Math.floor(r.level || 1)) });
      }
    }
  }
  const ch = chapterOfLevel(n);
  if (ch && n === chapterRange(ch).to && Array.isArray(ch.clearReward)) {
    for (const r of ch.clearReward) {
      if (!r || !r.unit) continue;
      for (let i = 0; i < (r.n || 1); i++) {
        list.push({ unit: r.unit, level: Math.max(1, Math.floor(r.level || 1)) });
      }
    }
  }
  return list;
}

// 里程碑列表（城池终点 + 章节终点），用于进度条 / 章节卡片展示
export function milestones() {
  const out = [];
  for (const ch of chapterList()) {
    for (const city of ch.cities || []) {
      out.push({
        kind: 'city',
        chapter: ch,
        city,
        level: city.to,
        from: city.from,
        name: city.name,
        chests: Array.isArray(city.reward) ? city.reward.filter((r) => r && r.chest).map((r) => r.chest) : [],
        units: Array.isArray(city.reward) ? city.reward.filter((r) => r && r.unit).map((r) => ({ unit: r.unit, level: r.level || 1 })) : [],
      });
    }
    out.push({
      kind: 'chapter',
      chapter: ch,
      city: null,
      level: chapterRange(ch).to,
      from: chapterRange(ch).from,
      name: ch.name,
      chests: Array.isArray(ch.clearReward) ? ch.clearReward.filter((r) => r && r.chest).map((r) => r.chest) : [],
      units: Array.isArray(ch.clearReward) ? ch.clearReward.filter((r) => r && r.unit).map((r) => ({ unit: r.unit, level: r.level || 1 })) : [],
    });
  }
  return out;
}

// 关卡所属的「城池终点里程碑」，用于「距离本城通关还差 X 关」
export function cityEndLevel(n) {
  const city = cityOfLevel(n);
  return city ? city.to : totalLevels();
}
