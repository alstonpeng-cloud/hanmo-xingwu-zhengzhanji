// 英雄血条 / 技能冷却的纯计算（绘制在 battle.js，单测可直接断言这里）
// 规则：英雄每 500 点最大生命值一段；Boss 的顶部大血条不在这里处理（保持原样）。
export const HERO_HP_PER_SEGMENT = 500;
// Boss 血量会按关卡倍率放大到几万，战场上只保留可读的分段；顶部大血条仍是精确血量
export const HERO_HP_MAX_SEGMENTS = 16;

export function heroHpSegmentCount(maxHp) {
  const hp = Math.max(0, Number(maxHp) || 0);
  if (hp <= 0) return 1;
  return Math.max(1, Math.min(HERO_HP_MAX_SEGMENTS, Math.ceil(hp / HERO_HP_PER_SEGMENT)));
}

// 第 i 段的填充比例（0~1）：血条按「每段 500 血」从左到右消耗
export function heroHpSegmentFill(hp, maxHp, index) {
  const max = Math.max(1, Number(maxHp) || 0);
  const segs = heroHpSegmentCount(max);
  const segHp = max / segs;
  const rest = Math.max(0, Math.min(max, Number(hp) || 0)) - index * segHp;
  return Math.max(0, Math.min(1, rest / segHp));
}

// 英雄技能冷却：目前只有曹操「宁可我负天下人」与张角「撒豆成兵」有可读的循环，
// Boss 也走同一套字段，所以 Boss 头顶同样会出现 CD 条。
export function heroCooldown(e, time) {
  if (!e || !e.hero || !e.alive) return null;
  const now = Number(time) || 0;
  // 曹操：持续窗口内是「技能生效中」，窗口结束后按剩余冷却回充（空 → 满）
  if (e.tr && e.tr.dmgConvert && (e.tr.dmgConvert.cd || 0) > 0) {
    const cd = e.tr.dmgConvert.cd;
    const dur = e.tr.dmgConvert.dur || 0;
    if (e.convertUntil > now) {
      return { kind: 'dmgConvert', active: true, ratio: 1, remain: (e.convertUntil - now) / cd };
    }
    const recharge = Math.max(0.001, cd - dur);
    const left = Math.max(0, Math.min(recharge, e.convertCd || 0));
    return { kind: 'dmgConvert', active: false, ratio: 1 - left / recharge };
  }
  // 张角：召唤读条（timer 从 every 倒数到 0）
  if (e.summonCfg && e.summonCfg.every > 0) {
    const every = e.summonCfg.every;
    const timer = Math.max(0, Math.min(every, e.summonCfg.timer ?? every));
    return { kind: 'summon', active: false, ratio: 1 - timer / every };
  }
  return null;
}
