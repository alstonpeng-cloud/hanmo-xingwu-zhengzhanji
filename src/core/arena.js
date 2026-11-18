// 斗技场战斗（纯逻辑，可被 Node 直接跑测试）
// 竖版场地（默认 24×60 格）：敌方在上、我方在下；每个兵营单位 = 一支小队（含 2~10 个兵），
// 每个兵自主找最近的敌人、移动到自己的射程内再攻击（近战 0.5 格、弓兵 12 格、枪兵 1.2 格）。
// 特殊兵种的战法也在这里落地：数据全部来自 data/traits.js（combatTraits），这里只负责执行。
import { CONFIG } from '../data/config.js';
import { statsFor, baseTroopOf, isBacklineTroop } from './units.js';
import { computeDamage, counterMultiplier } from './battle.js';
import { slotToArena } from './formation.js';
import { combatTraits } from '../data/traits.js';
import { heroById, heroStatsFor, heroCombatTraits } from '../data/heroes.js';
import { engineDef, engineStats, stancePoint } from './siege.js';

const POISON_INTERVAL = 0.5;   // 毒伤每 0.5 秒结算一次
const POISON_TIME = 3;         // 一次中毒持续 3 秒（再次命中会刷新）
const AURA_RADIUS = 14;        // 光环（陷阵加攻 / 龙胆虎威攻速）的作用半径（格）

// 远程兵：弓兵线全部算，另外白马义从是骑射（也按远程结算箭矢和提前量）
export function isRangedTroop(troopId) {
  return baseTroopOf(troopId) === 'archer' || troopId === 'baima';
}

// 一支小队里有几个兵：Lv1 按兵种的初始编制，到「增员等级」各 +1，封顶 squadMax
// 普通兵种：盾/枪/骑 Lv1=3、Lv3/5/8 各 +1（满编 6）；弓兵 Lv1=2、满编 5
// 特殊兵种可以覆盖编制（青州兵 5→10、青竹弓手 4→8、虎豹骑 2→5）
export function squadSoldierCount(troopId, level = 1) {
  const base = Math.max(1, CONFIG.combat.squadSize[troopId] || 2);
  const max = Math.max(base, CONFIG.combat.squadMax[troopId] || base);
  const lv = Math.max(1, Math.floor(level || 1));
  const growth = CONFIG.combat.squadGrowth[troopId] || CONFIG.combat.squadGrowthLevels || [];
  const steps = growth.filter((at) => lv >= at).length;
  return Math.min(max, base + steps);
}

// 一支小队里各个兵相对「上阵位中心」的偏移（世界格坐标）：
// 第 1 个居中当队长，其余绕一圈；圈半径按「两个兵至少相隔 2 个 radius」推出来，
// 保证一出生就有碰撞体积、不会叠在一个点上（人多时略微撑开，免得立绘完全叠住）。
// 出生（随机角度）和布阵页预览（固定角度）共用这份站位，看到的站位就是开战后的站位。
export function squadSlotOffsets(troopId, baseAngle = 0, level = 1) {
  const size = squadSoldierCount(troopId, level);
  const gap = CONFIG.combat.radius * 2 + 0.05;        // 1.05 格：两个兵刚好不重叠的最小圈半径
  const ringCount = Math.max(1, size - 1);
  // 人越多，圈子撑得越开（1.6 格弦长 ≈ 立绘能看出是几个人），但最多到 1.35 倍
  const spread = ringCount >= 3 ? 1.6 / (2 * Math.sin(Math.PI / ringCount)) : gap;
  const ring = Math.max(gap, Math.min(spread, gap * 1.35));
  const out = [];
  for (let i = 0; i < size; i++) {
    const r = i === 0 ? 0 : ring;
    const angle = i === 0 ? 0 : baseAngle + (i - 1) * ((Math.PI * 2) / Math.max(1, ringCount));
    out.push({ dx: Math.cos(angle) * r, dy: Math.sin(angle) * r });
  }
  return out;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createArenaBattle(playerSquads, enemySquads, rng = Math.random, opts = {}) {
  const cols = CONFIG.arena.cols;
  const rows = CONFIG.arena.rows;
  const entities = [];
  let seq = 0;
  let squadSeq = 0;
  // 本局最佳统计：按「小队」累计输出 / 承伤 / 击倒（一个小队里的几个兵合并统计）
  const squadStats = {};

  const spawnSquad = (side, squad) => {
    // 英雄：自己的指数成长数值 + 1 个将领模型（不走普通兵种的小队编制）
    const isHero = !!squad.hero;
    const heroCfg = isHero ? heroById(squad.hero) : null;
    // 关卡难度倍率（卡点 / 50 关后 +10%）：只放大生命与攻击，防御保持原值。
    // 若连防御一起放大，computeDamage 的「攻击 - 防御」会被二次放大，实际难度会明显超过设定值。
    const statMult = Number.isFinite(squad.statMult)
      ? Math.max(0.5, Math.min(3, squad.statMult)) : 1;
    // 兵书倍率：玩家三卷 / 敌方对等加成，攻、血、防各自单独乘。
    // hpMult 同时承载「英雄战 Boss 血量倍数」（5~10 倍），所以只钳下限、不钳上限。
    const atkScale = Number.isFinite(squad.atkScale) ? Math.max(0.5, Math.min(3, squad.atkScale)) : 1;
    const hpScale = Number.isFinite(squad.hpMult) ? Math.max(0.5, squad.hpMult) : 1;
    const defScale = Number.isFinite(squad.defScale) ? Math.max(0.5, Math.min(3, squad.defScale)) : 1;
    const rawStats = isHero ? heroStatsFor(squad.hero, squad.level) : statsFor(squad.troop, squad.level);
    const stats = statMult === 1 ? rawStats : {
      ...rawStats,
      hp: Math.round(rawStats.hp * statMult),
      atk: Math.round(rawStats.atk * statMult * 100) / 100,
    };
    const tr = isHero ? heroCombatTraits(squad.hero, squad.level) : combatTraits(squad.troop, squad.level);
    const center = slotToArena(side, squad.col, squad.row);
    const squadKey = `${side}-${squadSeq++}`;
    squadStats[squadKey] = {
      side, troop: squad.troop, level: squad.level,
      hero: squad.hero || null,
      dealt: 0, taken: 0, kills: 0,
    };
    // 远程兵：射程取战法覆盖值（元戎 20 / 白马 16），默认提前 2 格停下开火
    const fireRange = tr && tr.range ? tr.range : CONFIG.combat.ranges[squad.troop];
    const ranged = isRangedTroop(squad.troop);
    // 战法可以直接指定 stopRange（如元戎：range=20, stopRange=18），否则用默认 engageGap
    const stopRange = ranged
      ? (tr && tr.stopRange ? tr.stopRange : Math.max(0.5, fireRange - (CONFIG.combat.engageGap || 0)))
      : fireRange;
    // 小队内部站位（队长居中、其余绕圈），角度随机一点点，避免两边完全对称
    const offsets = isHero ? [{ dx: 0, dy: 0 }] : squadSlotOffsets(squad.troop, rng() * Math.PI * 2, squad.level);
    // 先登死士：开战 1 秒后从敌方最后一排身后冒出来（同横排），实现绕后包抄
    const teleport = squad.troop === 'xiandeng' && CONFIG.combat.xiandengTeleport
      ? { at: CONFIG.combat.xiandengTeleport.delay, done: false, row: squad.row }
      : null;
    for (const o of offsets) {
      const x = center.x + o.dx + (rng() - 0.5) * 0.16;
      const y = center.y + o.dy + (rng() - 0.5) * 0.16;
      entities.push({
        uid: `${side === 'player' ? 'p' : 'e'}${seq++}`,
        side, squad, squadKey,
        troop: squad.troop,
        level: squad.level,
        x: clamp(x, 0.6, cols - 0.6),
        y: clamp(y, 0.6, rows - 0.6),
        slotDx: o.dx, slotDy: o.dy,
        teleport: teleport ? { ...teleport } : null,
        // 英雄战：Boss 英雄血量 5~10 倍（通过 squad.hpMult 传入），其他数值不变
        // 过 5 关斩 6 将：squad.hpPct 携带上一关剩余血量（上限仍是满血，回血技能按满血比例算）
        hp: (() => {
          const full = Math.round(stats.hp * hpScale);
          const pct = Number.isFinite(squad.hpPct) ? clamp(squad.hpPct, 0, 1) : 1;
          return Math.round(full * pct);
        })(),
        maxHp: Math.round(stats.hp * hpScale),
        // 基础最大血量（未乘英雄战 Boss 倍数）：所有「按最大血量百分比」的技能只认它，
        // 避免 Boss 血量 5~10 倍时把回血/护盾一并放大成变相免伤。
        baseMaxHp: Math.round(stats.hp),
        // 战法：面板攻击倍率（青州 -10% / 藤甲输出减半）
        atk: Math.round(stats.atk * atkScale * (tr && tr.atkMult ? tr.atkMult : 1) * 100) / 100,
        def: stats.def * defScale,
        tr,                                        // 战法数值（详情页文案共用同一份）
        range: fireRange,
        ranged,
        stopRange,                                 // 走路时停在「射程 - 2 格」，保证停住就开火
        radius: CONFIG.combat.radius,
        // 英雄：速度/间隔走英雄自己的配置（并支持移速/攻速加成）
        speed: CONFIG.combat.speeds[squad.troop] * (tr && tr.speedMult ? tr.speedMult : 1),
        interval: (isHero ? stats.interval : CONFIG.combat.intervals[squad.troop]) * (tr && tr.intervalMult ? tr.intervalMult : 1),
        // 英雄标识：渲染放大 1.3 倍 + 品阶主色光圈 + 统计榜显示英雄名
        hero: squad.hero || null,
        heroTier: heroCfg ? heroCfg.tier : null,
        heroColor: heroCfg ? heroCfg.color : null,
        heroScale: isHero ? (squad.heroScale || 1.3) : 1,
        boss: !!(isHero && squad.boss),
        heroAtkCount: 0,
        cooldown: rng() * 0.6,
        alive: true,
        moving: false,
        targetId: null,
        facing: side === 'player' ? 1 : -1,
        vx: 0, vy: 0,
        // 光环字段（已删三种光环但保留 auraAtk 给锐甲反击和 counter 伤害加成）
        auraAtk: 0, auraHaste: 0, auraDodge: 0,
        // 虎豹骑/幽州突骑：移动 3 格未攻击后进入冲锋（速度 / 伤害 / 眩晕）
        moveAccum: 0,     // 连续未攻击状态下累计移动的格数（出手时清零）
        charging3: false,// 当前是否在冲锋（由 charge3 触发）
        // 白毦兵：每个兵首次受击完全无伤
        firstHitBlocked: !!(tr && tr.firstHitBlock),
        // 陷阵营：每秒恢复 maxHp * selfHeal
        selfHeal: tr && tr.selfHeal ? tr.selfHeal : 0,
        // 晕：目标被冲锋眩晕后 stunTimer > 0 期间不能攻击
        stunTimer: 0,
        // 大戟士：突刺（15 秒冷却，2 倍速突进，这一下按倍率结算）
        dashCd: tr && tr.dash ? 5 : 0,
        dashT: 0,
        dashReady: false,
        // 元戎弩士：连射弹匣（现在 volley.burst 是 tier，运行时用这个字段）
        burstLeft: tr && tr.volley ? null : 0,  // null = 运行时从 tier 动态算
        poison: null,
        // 无当飞军多箭齐射：运行时从 multiArrow 字段读（lv1-3=2, lv4-7=3, lv8+=4）
        multiArrow: tr && tr.multiArrow ? tr.multiArrow : 1,
        // 英雄战法新增字段：护盾 / 回血光环 / 召唤 / 恐慌 / 嘲讽
        shield: 0, shieldMax: 0,
        healTimer: 0,
        summonTimer: tr && tr.summon ? tr.summon.every : 0,
        fearTimer: 0, fearFromX: 0, fearFromY: 0, fearDone: false,
        tauntId: null, tauntUntil: 0, tauntDone: false,
        // 曹操「宁可我负天下人」：主动技能的持续窗口与冷却
        convertUntil: 0, convertCd: 0,
        summonCfg: tr && tr.summon
          ? {
            troop: tr.summon.troop,
            level: Math.max(1, Math.min(10, Math.floor(squad.level / tr.summon.levelStep))),
            every: tr.summon.every,
            mult: tr.summon.mult || 1,
            timer: tr.summon.every,
          }
          : null,
      });
    }
  };

  playerSquads.forEach((s) => spawnSquad('player', s));
  enemySquads.forEach((s) => spawnSquad('enemy', s));

  const byUid = {};
  entities.forEach((e) => { byUid[e.uid] = e; });

  // ---- 本局最佳累计（伤害来源 / 承伤 / 击倒） ----
  const addStat = (uid, key, n) => {
    const e = byUid[uid];
    if (!e || !n) return;
    const s = squadStats[e.squadKey];
    if (s) s[key] += n;
  };
  const addDealt = (uid, n) => addStat(uid, 'dealt', n);
  const addTaken = (uid, n) => addStat(uid, 'taken', n);
  const addKill = (uid) => addStat(uid, 'kills', 1);

  // ---- 攻城器械实体 ----
  // 也进 entities（按玩家要求：有血量、可被索敌攻击、会阵亡、计入胜负）。
  // 位置只在战场坐标系里前后移动，永远不写回 5×5 阵型，所以「不占格」是结构性保证；
  // 主循环对 engine:true 整段跳过（不开普攻、不走位、不吃状态 tick），开火仍由 fireEngine 负责。
  const engines = [];
  function spawnEngine(side, cfg) {
    if (!cfg) return;
    const p = stancePoint(side, cfg.stance);
    const eng = {
      uid: `${side === 'player' ? 'p' : 'e'}eng`,
      side,
      engineId: cfg.id,
      tier: cfg.tier,
      stance: cfg.stance,
      x: p.x,
      y: p.y,
      squadKey: `${side}-engine`,
      stats: engineStats(cfg.id, cfg.tier, opts.stage || 1),
      cooldown: cfg.id === 'thunder' ? (engineDef('thunder').firstShot || 3) : Infinity,
      alive: true,
    };
    const s = eng.stats;
    Object.assign(eng, {
      engine: true,
      troop: cfg.id,                     // 死亡 feed / 统计用 engineName 分支识别
      level: cfg.tier,
      squad: null,
      hp: s.hp, maxHp: s.hp, baseMaxHp: s.hp,
      atk: 0, def: s.def,
      tr: null,
      ranged: cfg.id === 'thunder',      // 霹雳车算远程：被白马义从当远程目标锁定
      backline: cfg.id === 'thunder',
      range: 0, stopRange: 0,
      radius: 1.4,                       // 比士兵大一圈，索敌 stop / 碰撞用
      speed: 0, interval: Infinity,      // 不普攻不移动（主循环已整段跳过，仅作兜底）
      moving: false, targetId: null,
      facing: side === 'player' ? 1 : -1,
      vx: 0, vy: 0,
      auraAtk: 0, auraHaste: 0, auraDodge: 0,
      poison: null, stunTimer: 0,
      shield: 0, shieldMax: 0,
      fireT: 999,                        // 开火动画计时（999 = 静止待发）
      teleport: null, summonCfg: null,
      hero: null, heroTier: null, heroColor: null, heroScale: 1, heroAtkCount: 0,
      boss: false, dashCd: 0, dashT: 0, dashReady: false,
      moveAccum: 0, charging3: false, burstLeft: 0,
      selfHeal: 0, firstHitBlocked: false, siegeDmgMult: 0,
    });
    squadStats[eng.squadKey] = {
      side, troop: cfg.id, level: cfg.tier, hero: null,
      dealt: 0, taken: 0, kills: 0, engine: true,
    };
    byUid[eng.uid] = eng;
    engines.push(eng);
    entities.push(eng);                   // 必须在 squads 之后 push（既有查找依赖「先兵后器械」顺序）
  }
  spawnEngine('player', opts.playerEngine);
  spawnEngine('enemy', opts.enemyEngine);

  const aliveCount = (side) => entities.reduce((n, e) => n + (e.alive && e.side === side ? 1 : 0), 0);
  const totalHp = (side) => entities.reduce((n, e) => n + (e.alive && e.side === side ? e.hp : 0), 0);

  // 同阵营、指定半径内最近的 N 个兵（光环作用对象；含自己，距离 0）
  function nearestAllies(src, count, radius) {
    return entities
      .filter((o) => o.alive && o.side === src.side)
      .map((o) => ({ o, d: Math.hypot(o.x - src.x, o.y - src.y) }))
      .filter((x) => x.d <= radius)
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((x) => x.o);
  }

  // 开战光环：夏侯渊「神速奔袭」给最近 6 名友军 +30% 攻速/移速；
  // 曹操「乱世奸雄」给最近 6 名友军 +护甲；关羽 / 董卓开局护盾。
  function applyAuras() {
    for (const e of entities) {
      const tr = e.tr;
      if (!tr || !e.hero) continue;
      if (tr.teamHaste) {
        const pct = tr.teamHaste.pct || 0.3;
        for (const a of nearestAllies(e, tr.teamHaste.count || 6, tr.teamHaste.radius || 14)) {
          a.speed *= 1 + pct;
          a.interval = Math.max(0.2, a.interval / (1 + pct));
        }
      }
      if (tr.allyArmor) {
        for (const a of nearestAllies(e, tr.allyArmor.count || 6, 99)) a.def += tr.allyArmor.def || 0;
      }
      if (tr.shieldStart) {
        // 按基础血量计算：英雄战 Boss 血量倍数不放大护盾
        const value = tr.shieldStart.hpMult
          ? Math.round(e.baseMaxHp * tr.shieldStart.hpMult)
          : Math.round(tr.shieldStart.hp || 0);
        e.shield = value;
        e.shieldMax = value;
      }
    }
  }
  applyAuras();

  let targetClock = 0;

  // 找「最近」的敌人；白马义从优先锁定最近的敌方后排（弓兵线 + 敌方白马义从），
  // 没有后排再退回最近目标。这里用阵型位置 isBacklineTroop，而不是只看弓兵线。
  function pickTarget(e) {
    let best = null;
    let bestD = Infinity;
    const scan = (backlineOnly) => {
      for (const o of entities) {
        if (!o.alive || o.side === e.side) continue;
        if (backlineOnly && !(o.backline || isBacklineTroop(o.troop))) continue;
        const d = (e.x - o.x) ** 2 + (e.y - o.y) ** 2;
        if (d < bestD) { bestD = d; best = o; }
      }
    };
    if (e.tr && e.tr.preferArcher) {
      scan(true);
      if (!best) { bestD = Infinity; scan(false); }
    } else {
      scan(false);
    }
    return best;
  }

  function retarget() {
    for (const e of entities) {
      if (!e.alive || e.engine) continue;   // 器械目标由 engineTarget（射程环带）单独管
      const best = pickTarget(e);
      e.targetId = best ? best.uid : null;
    }
  }

  // 同队/敌我都做一次软分离，避免一堆兵叠在同一个格子里
  function separate() {
    const list = entities.filter((e) => e.alive);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        // 器械不位移：与器械重叠时只把另一侧推开
        if (a.engine || b.engine) {
          const fixed = a.engine ? a : b;      // 器械（不动的一侧）
          const other = a.engine ? b : a;      // 被推开的一侧
          if (other.engine) continue;
          const odx = other.x - fixed.x;
          const ody = other.y - fixed.y;
          const od = Math.hypot(odx, ody) || 1;
          const oMin = fixed.radius + other.radius;
          if (od >= oMin) continue;
          const push = (oMin - od);
          other.x = clamp(other.x + (odx / od) * push, 0.6, cols - 0.6);
          other.y = clamp(other.y + (ody / od) * push, 0.6, rows - 0.6);
          continue;
        }
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (d >= min) continue;
        if (d < 1e-6) {
          // 完全重合时用序号给一个固定方向，保持可复现
          dx = Math.cos(i * 2.399);
          dy = Math.sin(i * 2.399);
          d = 1;
        }
        const push = (min - d) * 0.5;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        a.x = clamp(a.x, 0.6, cols - 0.6);
        a.y = clamp(a.y, 0.6, rows - 0.6);
        b.x = clamp(b.x, 0.6, cols - 0.6);
        b.y = clamp(b.y, 0.6, rows - 0.6);
      }
    }
  }

  const battle = {
    entities, byUid, time: 0, over: false, winner: null,
    // 攻城器械（每方最多 1 台；独立数组，不进 entities）
    engines,
    // 周瑜「火烧连营」留下的地面火焰圈（有持续时间、按间隔跳伤；渲染与测试共用）
    fireZones: [],
    // 本局最佳：每个小队的输出 / 承伤 / 击倒（按出场顺序：先我方后敌方）
    squadStats,
    statsList() {
      return Object.entries(squadStats).map(([key, s]) => ({ key, ...s, dealt: Math.round(s.dealt), taken: Math.round(s.taken) }));
    },
    aliveCount, totalHp,
    alive(side) { return aliveCount(side); },
    squadCount(side) {
      const ids = new Set();
      entities.forEach((e) => { if (e.alive && e.side === side) ids.add(e.squad?.uid ?? `${side}-${e.squad?.col}-${e.squad?.row}`); });
      return ids.size;
    },
  };

  function finish(winner, events) {
    battle.over = true;
    battle.winner = winner;
    events.push({ t: 'end', winner, time: battle.time });
  }

  // 统一的扣血入口：处理曹操「宁可我负天下人」的伤害转治疗。
  // 期间受到的全部伤害（普攻 / 箭矢 / 毒 / 火圈 / 范围伤害 / 反击 / 反弹）先扣血，
  // 再把其中 120% 立刻补回 → 等价于净承伤 = -20%（回血），但治疗量始终受最大生命封顶。
  function applyDamageTo(o, amount, events) {
    if (!o.alive || !(amount > 0)) return { applied: 0, killed: !o.alive, healed: 0 };
    const before = o.hp;
    o.hp = Math.max(0, o.hp - amount);
    const applied = Math.min(amount, before);
    let healed = 0;
    const tr = o.tr;
    if (applied > 0 && tr && tr.dmgConvert && o.convertUntil > battle.time) {
      healed = Math.min(o.maxHp - o.hp, Math.floor(applied * tr.dmgConvert.healPct));
      if (healed > 0) {
        o.hp += healed;
        events.push({
          t: 'convert', uid: o.uid, side: o.side, x: o.x, y: o.y,
          heal: healed, damage: applied,
        });
      }
    }
    const killed = o.hp <= 0;
    if (killed) { o.alive = false; o.charging3 = false; o.poison = null; }
    return { applied, killed, healed };
  }

  // 中毒（无当飞军的毒矢）：每 0.5 秒结算一次，可以刷新持续时间
  function tickPoison(e, dt, events) {
    const p = e.poison;
    if (!p) return;
    p.left -= dt;
    p.tick -= dt;
    if (p.tick <= 0) {
      p.tick += POISON_INTERVAL;
      const dmg = Math.max(1, Math.floor(p.dps * POISON_INTERVAL));
      const { applied, killed } = applyDamageTo(e, dmg, events);
      addDealt(p.from, applied);
      addTaken(e.uid, applied);
      if (killed) addKill(p.from);
      events.push({
        t: 'poison', uid: e.uid, side: e.side, troop: e.troop, level: e.level,
        x: e.x, y: e.y, damage: dmg, hpAfter: e.hp, killed, from: p.from,
      });
      if (killed) {
        e.poison = null;
        events.push({ t: 'death', uid: e.uid, side: e.side, troop: e.troop, level: e.level, x: e.x, y: e.y });
      }
      return;
    }
    if (p.left <= 0) e.poison = null;
  }

  // 周瑜「火烧连营」：地面火焰圈，每 interval 秒对圈内所有敌人跳一次伤害
  function tickFireZones(dt, events) {
    for (let i = battle.fireZones.length - 1; i >= 0; i--) {
      const z = battle.fireZones[i];
      z.left -= dt;
      z.tick += dt;
      if (z.tick >= z.interval) {
        z.tick -= z.interval;
        for (const o of entities) {
          if (!o.alive || o.side === z.side) continue;
          if (Math.hypot(o.x - z.x, o.y - z.y) > z.radius) continue;
          let dmg = Math.max(1, Math.floor(z.dps * z.interval));
          if (o.troop === 'tengjia') dmg = Math.max(1, Math.floor(dmg * (z.vsTengjia || 1)));
          const { applied, killed: kd } = applyDamageTo(o, dmg, events);
          addDealt(z.from, applied);
          addTaken(o.uid, applied);
          if (kd) addKill(z.from);
          events.push({
            t: 'fire', uid: o.uid, side: o.side, troop: o.troop, level: o.level,
            x: o.x, y: o.y, damage: dmg, hpAfter: o.hp, killed: kd, from: z.from,
            zoneX: z.x, zoneY: z.y, radius: z.radius,
          });
          if (kd) events.push({ t: 'death', uid: o.uid, side: o.side, troop: o.troop, level: o.level, x: o.x, y: o.y });
        }
      }
      if (z.left <= 0) battle.fireZones.splice(i, 1);
    }
  }

  // 范围伤害的落点结算（张飞圆环 / 关羽扇形共用）：扣血、统计、补事件
  function splashHit(e, o, dmg, kind, events) {
    const { applied, killed: kd } = applyDamageTo(o, dmg, events);
    addDealt(e.uid, applied);
    addTaken(o.uid, applied);
    if (kd) addKill(e.uid);
    events.push({
      t: 'attack', actor: e.uid, target: o.uid,
      actorSide: e.side, actorTroop: e.troop, actorLevel: e.level,
      targetTroop: o.troop, targetLevel: o.level,
      damage: dmg, hpAfter: o.hp, killed: kd, splash: kind,
      x1: e.x, y1: e.y, x2: o.x, y2: o.y,
    });
    if (kd) events.push({ t: 'death', uid: o.uid, side: o.side, troop: o.troop, level: o.level, x: o.x, y: o.y });
  }

  // 张角召唤：在英雄身边生成一个真实参战的盾兵（数值按召唤等级）
  function spawnSummon(owner, events) {
    const cfg = owner.summonCfg;
    const rawSt = statsFor(cfg.troop, cfg.level);
    const mult = cfg.mult || 1;
    const st = {
      hp: Math.round(rawSt.hp * mult),
      atk: Math.round(rawSt.atk * mult),
      def: Math.round(rawSt.def * mult),
    };
    const ctr = combatTraits(cfg.troop, cfg.level) || {};
    const fireRange = CONFIG.combat.ranges[cfg.troop];
    const uid = `${owner.side === 'player' ? 'p' : 'e'}${seq++}`;
    const ent = {
      uid, side: owner.side, squad: owner.squad, squadKey: owner.squadKey, summon: true,
      troop: cfg.troop, level: cfg.level,
      x: clamp(owner.x + (rng() - 0.5) * 1.4, 0.6, cols - 0.6),
      y: clamp(owner.y + (rng() - 0.5) * 1.4, 0.6, rows - 0.6),
      slotDx: 0, slotDy: 0, teleport: null,
      hp: st.hp, maxHp: st.hp, atk: st.atk, def: st.def, tr: ctr,
      range: fireRange, ranged: false, stopRange: fireRange, radius: CONFIG.combat.radius,
      speed: CONFIG.combat.speeds[cfg.troop],
      interval: CONFIG.combat.intervals[cfg.troop],
      hero: null, heroTier: null, heroColor: null, heroScale: 1, boss: false, heroAtkCount: 0,
      cooldown: 0.3, alive: true, moving: false, targetId: null,
      facing: owner.facing, vx: 0, vy: 0, auraAtk: 0, auraHaste: 0, auraDodge: 0,
      moveAccum: 0, charging3: false,
      firstHitBlocked: !!(ctr && ctr.firstHitBlock),
      selfHeal: ctr && ctr.selfHeal ? ctr.selfHeal : 0,
      stunTimer: 0, dashCd: ctr && ctr.dash ? 5 : 0, dashT: 0, dashReady: false,
      burstLeft: ctr && ctr.volley ? null : 0, poison: null,
      multiArrow: ctr && ctr.multiArrow ? ctr.multiArrow : 1,
      shield: 0, shieldMax: 0, healTimer: 0, summonTimer: 0, summonCfg: null,
      fearTimer: 0, fearFromX: 0, fearFromY: 0, fearDone: false,
      tauntId: null, tauntUntil: 0, tauntDone: false,
      convertUntil: 0, convertCd: 0,
    };
    entities.push(ent);
    byUid[ent.uid] = ent;
    events.push({ t: 'summon', uid: ent.uid, side: ent.side, troop: ent.troop, level: ent.level, x: ent.x, y: ent.y });
  }

  if (aliveCount('player') === 0 || aliveCount('enemy') === 0) {
    battle.over = true;
    battle.winner = aliveCount('player') > 0 ? 'player' : 'enemy';
  }

  // ---- 器械：自动走位 + 开火 + 增伤光环 ----
  const SIEGE_MOVE = CONFIG.siege.move;
  const THUNDER_DEF = engineDef('thunder');

  function engineBounds(side) {
    return side === 'player'
      ? { minY: SIEGE_MOVE.playerMinY, maxY: SIEGE_MOVE.playerMaxY }
      : { minY: SIEGE_MOVE.enemyMinY, maxY: SIEGE_MOVE.enemyMaxY };
  }

  // 最近的存活敌人（不限射程）：用来判断该前进还是后撤
  function nearestEnemy(eng) {
    let target = null;
    let best = Infinity;
    for (const o of entities) {
      if (!o.alive || o.side === eng.side) continue;
      const d = Math.hypot(o.x - eng.x, o.y - eng.y);
      if (d < best) { best = d; target = o; }
    }
    return { target, d: best };
  }

  // 射程环带 [minRange, maxRange] 内最近的敌人：没有就不开火（不空放、不浪费冷却）
  function engineTarget(eng) {
    const s = eng.stats;
    let target = null;
    let best = Infinity;
    for (const o of entities) {
      if (!o.alive || o.side === eng.side) continue;
      const d = Math.hypot(o.x - eng.x, o.y - eng.y);
      if (d < s.minRange || d > s.maxRange) continue;
      if (d < best) { best = d; target = o; }
    }
    return { target, d: best };
  }

  // 自动走位：只在前后方向（y）移动，x 恒为中轴。
  // 最近敌人在 [holdMin, holdMax] 内不动（射程两端各留 2 格滞回，避免边缘抖动）；
  // 太远就缓慢前压，太近就缓慢后撤，撞到我方前排线 / 己方底线即停。
  function moveEngine(eng, dt) {
    if (eng.engineId !== 'thunder') return; // 鼓吹是常驻光环，站桩
    const near = nearestEnemy(eng);
    if (!near.target) return;
    const forward = eng.side === 'player' ? -1 : 1;
    let dy = 0;
    if (near.d > SIEGE_MOVE.holdMax) dy = forward * SIEGE_MOVE.speed * dt;
    else if (near.d < SIEGE_MOVE.holdMin) dy = -forward * SIEGE_MOVE.speed * dt;
    if (!dy) return;
    const b = engineBounds(eng.side);
    eng.y = clamp(eng.y + dy, b.minY, b.maxY);
  }

  // 鼓吹：常驻增伤光环。每帧先清零再取同源最高值（不叠乘），只作用于本方小队。
  function applyEngineAuras() {
    if (!engines.some((e) => e.engineId === 'drum')) return;
    for (const e of entities) e.siegeDmgMult = 0;
    for (const eng of engines) {
      if (eng.engineId !== 'drum' || !eng.alive) continue;   // 鼓吹阵亡：光环即刻失效
      const s = eng.stats;
      for (const o of entities) {
        if (!o.alive || o.side !== eng.side) continue;
        if (Math.hypot(o.x - eng.x, o.y - eng.y) > s.auraRadius) continue;
        if (s.auraDmg > (o.siegeDmgMult || 0)) o.siegeDmgMult = s.auraDmg;
      }
    }
  }

  function fireEngine(eng, dt, events) {
    if (eng.engineId !== 'thunder') return;
    if (eng.cooldown > 0) { eng.cooldown -= dt; return; }
    const pick = engineTarget(eng);
    if (!pick.target) return;
    const s = eng.stats;
    const tx = pick.target.x;
    const ty = pick.target.y;
    // 落点直击：小范围秒伤
    for (const o of entities) {
      if (!o.alive || o.side === eng.side) continue;
      if (Math.hypot(o.x - tx, o.y - ty) > s.directRadius) continue;
      let dmg = s.direct;
      if (o.troop === 'tengjia') dmg = Math.round(dmg * (THUNDER_DEF.vsTengjia || 1));
      const { applied, killed } = applyDamageTo(o, dmg, events);
      addDealt(eng.uid, applied);
      addTaken(o.uid, applied);
      if (killed) addKill(eng.uid);
      events.push({
        t: 'siege', uid: o.uid, side: o.side, troop: o.troop, level: o.level,
        x: o.x, y: o.y, damage: dmg, hpAfter: o.hp, killed,
        from: eng.uid, zoneX: tx, zoneY: ty,
      });
      if (killed) events.push({ t: 'death', uid: o.uid, side: o.side, troop: o.troop, level: o.level, x: o.x, y: o.y });
    }
    // 落点地面火圈：持续伤害（跳伤逻辑复用周瑜那套 tickFireZones）
    battle.fireZones.push({
      x: tx, y: ty, radius: s.fireRadius,
      left: s.fireDuration, tick: 0, interval: THUNDER_DEF.fireInterval,
      dps: s.fireDps, from: eng.uid, side: eng.side,
      vsTengjia: THUNDER_DEF.vsTengjia,
    });
    if (battle.fireZones.length > 12) battle.fireZones.shift();
    events.push({
      t: 'siegeShot', side: eng.side, uid: eng.uid,
      fromX: eng.x, fromY: eng.y, x: tx, y: ty, radius: s.fireRadius,
    });
    eng.cooldown = s.cooldown;
    eng.fireT = 0;   // 开火动画：抛臂从释放瞬间回摆
  }

  battle.step = (dt) => {
    const events = [];
    if (battle.over) return events;
    battle.time += dt;
    tickFireZones(dt, events);
    applyEngineAuras();
    for (const eng of engines) {
      if (!eng.alive) continue;              // 阵亡停火、停走位（已铺火圈按原时长烧完）
      moveEngine(eng, dt);
      fireEngine(eng, dt, events);
      eng.fireT = Math.min(999, eng.fireT + dt);   // 开火动画计时
    }

    targetClock -= dt;
    if (targetClock <= 0) {
      retarget();
      targetClock = CONFIG.combat.retargetTime;
    }

    for (const e of entities) {
      if (!e.alive || e.engine) continue;    // 器械不普攻不移动，状态 tick 全跳过（开火走上面的引擎循环）
      if (e.cooldown > 0) e.cooldown -= dt;
      if (e.dashCd > 0) e.dashCd -= dt;
      if (e.dashT > 0) e.dashT -= dt;
      // 眩晕：stunTimer > 0 时不能攻击（tick 末尾才检查，但也提前跳过攻击间隔处理）
      if (e.stunTimer > 0) e.stunTimer -= dt;
      // 陷阵营 / 李儒 selfHeal：每秒恢复「基础最大血量」* selfHeal（Boss 倍数不放大）
      if (e.selfHeal > 0 && e.hp < e.maxHp) {
        const heal = Math.min(e.maxHp - e.hp, Math.max(1, Math.floor(e.baseMaxHp * e.selfHeal * dt)));
        e.hp += heal;
      }
      // 刘备「仁德之盾」：4 格回血光环（每秒 20 → 满级 80），只治疗友军（不含自己）。
      // 光环半径就是判定半径，渲染层用同一个 tr.healAura.radius 画圈，二者永不漂移。
      if (e.tr && e.tr.healAura && e.alive) {
        const hps = e.tr.healAura.hps || 0;
        e.auraHealFx = (e.auraHealFx || 0) + dt;
        const showFx = e.auraHealFx >= 1;
        if (showFx) e.auraHealFx -= 1;
        for (const a of entities) {
          if (!a.alive || a.side !== e.side || a.uid === e.uid || a.engine) continue;
          if (Math.hypot(a.x - e.x, a.y - e.y) > e.tr.healAura.radius) continue;
          if (a.hp < a.maxHp) {
            const before = a.hp;
            a.hp = Math.min(a.maxHp, a.hp + hps * dt);
            if (showFx && a.hp > before) {
              events.push({
                t: 'heal', uid: a.uid, side: a.side, x: a.x, y: a.y,
                amount: Math.round(hps), aura: true, from: e.uid,
              });
            }
          }
        }
      }
      // 刘备自身：每秒固定回复 tr.selfHealHps 点（Boss 血量倍数不放大；满血封顶）
      // 兼容旧的百分比口径 tr.selfHealPct（按基础最大血量）
      if (e.tr && e.alive && e.hp < e.maxHp) {
        if (e.tr.selfHealHps) {
          e.hp = Math.min(e.maxHp, e.hp + e.tr.selfHealHps * dt);
        } else if (e.tr.selfHealPct) {
          e.hp = Math.min(e.maxHp, e.hp + e.baseMaxHp * e.tr.selfHealPct * dt);
        }
      }
      // 张角「撒豆成兵」：每 5 秒 → 满级 4 秒在英雄身边召唤一个盾兵（召唤强度随等级成长）
      if (e.summonCfg && e.alive) {
        e.summonCfg.timer -= dt;
        if (e.summonCfg.timer <= 0) {
          e.summonCfg.timer = e.summonCfg.every;
          spawnSummon(e, events);
        }
      }
      // 曹操「乱世奸雄」：第 3 秒嘲讽 4 格内敌军 5 秒
      if (e.tr && e.tr.taunt && !e.tauntDone && e.alive && battle.time >= e.tr.taunt.at) {
        e.tauntDone = true;
        for (const o of entities) {
          if (!o.alive || o.side === e.side) continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) > e.tr.taunt.radius) continue;
          o.tauntId = e.uid;
          o.tauntUntil = battle.time + e.tr.taunt.dur;
        }
        events.push({ t: 'taunt', uid: e.uid, x: e.x, y: e.y, radius: e.tr.taunt.radius });
      }
      // 曹操「宁可我负天下人」：开战即进入第一次持续窗口，之后按冷却循环（10 秒一次、持续 5 秒）
      if (e.tr && e.tr.dmgConvert && e.alive) {
        if (e.convertCd > 0) e.convertCd -= dt;
        if (e.convertCd <= 0) {
          e.convertCd = e.tr.dmgConvert.cd;
          e.convertUntil = battle.time + e.tr.dmgConvert.dur;
          events.push({
            t: 'skill', kind: 'dmgConvert', uid: e.uid, side: e.side,
            x: e.x, y: e.y, until: e.convertUntil,
          });
        }
      }
      tickPoison(e, dt, events);
      if (!e.alive) continue;

      // 先登死士绕后：1 秒后出现在敌方（或我方）最后一排的身后，同横排
      if (e.teleport && !e.teleport.done && battle.time >= e.teleport.at) {
        e.teleport.done = true;
        const f = CONFIG.formation;
        const targetSide = e.side === 'player' ? 'enemy' : 'player';
        const backCol = targetSide === 'enemy' ? f.cols - 1 : 0;
        const target = slotToArena(targetSide, backCol, e.teleport.row);
        const outward = targetSide === 'enemy' ? -1 : 1;
        e.x = clamp(target.x + e.slotDx, 0.6, cols - 0.6);
        e.y = clamp(target.y + outward * CONFIG.combat.xiandengTeleport.behind + e.slotDy, 0.6, rows - 0.6);
        e.targetId = null;
        e.moving = false;
        e.charging = false;
        events.push({
          t: 'teleport', uid: e.uid, side: e.side, troop: e.troop, level: e.level,
          x: e.x, y: e.y,
        });
      }

      // 张飞「燕人咆哮」：被恐惧的士兵向反方向奔跑，2 秒内不能攻击
      if (e.fearTimer > 0) {
        e.fearTimer -= dt;
        const dx = e.x - e.fearFromX;
        const dy = e.y - e.fearFromY;
        const d = Math.hypot(dx, dy) || 1;
        const len = e.speed * 1.5 * dt;
        e.x = clamp(e.x + (dx / d) * len, 0.6, cols - 0.6);
        e.y = clamp(e.y + (dy / d) * len, 0.6, rows - 0.6);
        e.moving = true;
        continue;
      }

      let t = byUid[e.targetId];
      // BUG 修复：锁定的目标一旦死亡（或消失），立刻改打下一个最近的敌人，绝不原地发呆
      if (!t || !t.alive) {
        t = pickTarget(e);
        e.targetId = t ? t.uid : null;
        if (!t) { e.moving = false; e.charging = false; continue; }
      }
      // 曹操嘲讽：期间强制攻击嘲讽者
      if (e.tauntId && e.tauntUntil > battle.time) {
        const ta = byUid[e.tauntId];
        if (ta && ta.alive) { t = ta; e.targetId = ta.uid; }
      }

      const dx = t.x - e.x;
      const dy = t.y - e.y;
      const dist = Math.hypot(dx, dy);
      const stop = (e.stopRange ?? e.range) + e.radius + t.radius;
      if (dx !== 0) e.facing = dx > 0 ? 1 : -1;

      // 大戟士「突刺」：冷却好了还在赶路，就 2 倍速突进，这一击按倍率结算
      if (e.tr && e.tr.dash && e.dashCd <= 0 && dist > stop + 0.4) {
        e.dashT = 0.8;
        e.dashReady = true;
        e.dashCd = e.tr.dash.cd;
        events.push({
          t: 'dash', uid: e.uid, troop: e.troop, level: e.level,
          x: e.x, y: e.y, x2: t.x, y2: t.y,
        });
      }

      // 骑兵 charge3：只要「连续未攻击状态下移动满 moveNeeded 格」就进入冲锋（速度 × speedMult）。
      // 激活距离按兵种区分：普通骑兵 5 格（已削弱），幽州突骑 / 虎豹骑仍为 3 格。
      // 不能用 e.attacked 做永久门槛：一旦普攻过就再也不会冲锋；moveAccum 在出手时清零，
      // 所以「攻击后重新走满所需格数」能再次触发，符合期望行为。
      let charge3 = e.tr && e.tr.charge3 ? e.tr.charge3 : null;
      const charging3 = !!(charge3 && (e.charging3 || e.moveAccum >= charge3.moveNeeded));
      e.charging3 = charging3;

      if (dist > stop + 0.02) {
        let speed = e.speed;
        if (charging3) speed *= charge3.speedMult;
        if (e.dashT > 0 && e.tr && e.tr.dash) speed *= e.tr.dash.speedMult;
        const len = Math.min(speed * dt, dist - stop);
        e.vx = dx / dist;
        e.vy = dy / dist;
        e.x = clamp(e.x + e.vx * len, 0.6, cols - 0.6);
        e.y = clamp(e.y + e.vy * len, 0.6, rows - 0.6);
        e.moving = true;
        // 累计移动格数（出手时清零；只要持续走、没普攻就一直累加）
        if (charge3) e.moveAccum += len;
        continue;
      }

      e.moving = false;
      // 被眩晕：不能攻击，等 stunTimer 自然归零
      if (e.stunTimer > 0) continue;
      if (e.cooldown > 0) continue;

      // 元戎弩士：连射弹匣（burstLeft=null 时从 tier 动态算）
      if (e.tr && e.tr.volley) {
        if (e.burstLeft == null) {
          // 从 tier 跳点表算当前等级应有的 burst 数
          let b = 1;
          for (const [at, val] of e.tr.volley.tier || []) if (e.level >= at) b = val;
          e.burstLeft = b;
        }
        if (e.burstLeft <= 0) {
          let b = 1;
          for (const [at, val] of e.tr.volley.tier || []) if (e.level >= at) b = val;
          e.burstLeft = b;
        }
      }
      const isVolley = !!(e.tr && e.tr.volley && e.burstLeft > 0);

      // ---- 出手 ----
      let mult = 1;
      let charge3Flag = false;
      let dashed = false;
      // charge3：虎豹骑/幽州突骑冲锋
      if (charging3 && charge3) {
        mult *= charge3.dmgMult;
        charge3Flag = true;
        // 虎豹骑冲锋有 stunSec；枪兵线「抵御冲锋」会打断眩晕（但伤害仍按减免后结算）
        if (charge3.stunSec && t.alive && !(t.tr && t.tr.takenCavalryCharge)) {
          t.stunTimer = Math.max(t.stunTimer || 0, charge3.stunSec);
          events.push({ t: 'stun', uid: t.uid, side: t.side, troop: t.troop, level: t.level, duration: charge3.stunSec, x: t.x, y: t.y });
        }
      }
      if (e.dashReady && e.tr && e.tr.dash) {
        mult = Math.max(mult, e.tr.dash.dmgMult);
        dashed = true;
        e.dashReady = false;
        e.dashT = 0;
      }

      // 出手后清零：下一次需要重新走满 moveNeeded 格才能再次触发 charge3
      e.moveAccum = 0;
      e.charging3 = false;

      // 白毦兵 firstHitBlock：每个兵首次受击完全无伤（每人仅一次）
      // 其他闪避来源：现在已经全删掉了（dodgeAura 删除）
      const evade = !!(t.firstHitBlocked && t.alive);
      const damage = evade ? 0 : computeDamage(e, t, { mult, charge: charge3Flag });
      if (evade) {
        t.firstHitBlocked = false;  // 触发一次后关闭，恢复正常承伤
      }
      let poisoned = false;
      const hpBefore = t.hp;
      let shieldBroke = false;
      let hpDmg = damage;
      let mainHit = { applied: 0, killed: false };
      if (!evade) {
        // 护盾（关羽青龙护体 / 董卓权倾朝野）：先扣盾，盾破时触发范围反击
        if (t.shield > 0) {
          const use = Math.min(t.shield, hpDmg);
          t.shield -= use;
          hpDmg -= use;
          if (t.shield <= 0 && t.tr && t.tr.shieldBurst) shieldBroke = true;
        }
        mainHit = applyDamageTo(t, hpDmg, events);
        // 毒矢 / 周瑜火攻：命中立刻挂上 3 秒持续伤害（再次命中刷新，不叠加）
        if (t.alive && e.tr && (e.tr.poisonPct || e.tr.burnPct)) {
          const pct = e.tr.burnPct || e.tr.poisonPct;
          t.poison = {
            dps: (e.atk + e.auraAtk) * pct * (e.tr.dealtMult || 1),
            left: POISON_TIME,
            tick: POISON_INTERVAL,
            from: e.uid,
            burn: !!e.tr.burnPct,
          };
          poisoned = true;
        }
      }
      const killed = !t.alive;
      if (!evade) {
        addDealt(e.uid, Math.min(damage, hpBefore));
        addTaken(t.uid, Math.min(damage, hpBefore));
        if (killed) addKill(e.uid);
        // 董卓「权倾朝野」：普攻吸血
        if (e.tr && e.tr.lifesteal && e.alive && e.hp < e.maxHp) {
          const heal = Math.min(e.maxHp - e.hp, damage * e.tr.lifesteal);
          if (heal > 0) e.hp += heal;
        }
        // 关羽「青龙护体」破碎：周围 3 格造成 0.8 倍普攻伤害
        if (shieldBroke) {
          const burstR = t.tr.shieldBurst.radius || 3;
          const burstD = (t.atk + t.auraAtk) * (t.tr.shieldBurst.dmgMult || 0.8);
          for (const o of entities) {
            if (!o.alive || o.side === t.side) continue;
            if (Math.hypot(o.x - t.x, o.y - t.y) > burstR) continue;
            const { applied: burstApplied, killed: kd } = applyDamageTo(o, burstD, events);
            addDealt(t.uid, burstApplied);
            addTaken(o.uid, burstApplied);
            if (kd) addKill(t.uid);
            events.push({
              t: 'attack', actor: t.uid, target: o.uid,
              actorSide: t.side, actorTroop: t.troop, actorLevel: t.level,
              targetTroop: o.troop, targetLevel: o.level,
              damage: burstD, hpAfter: o.hp, killed: kd, shieldBurst: true,
              x1: t.x, y1: t.y, x2: o.x, y2: o.y,
            });
            if (kd) events.push({ t: 'death', uid: o.uid, side: o.side, troop: o.troop, level: o.level, x: o.x, y: o.y });
          }
          events.push({ t: 'impact', kind: 'shieldBreak', uid: t.uid, x: t.x, y: t.y, damage: burstD });
        }
      }

      events.push({
        t: 'attack',
        actor: e.uid,
        target: t.uid,
        actorSide: e.side,
        actorTroop: e.troop,
        actorLevel: e.level,
        targetTroop: t.troop,
        targetLevel: t.level,
        damage,
        hpAfter: t.hp,
        killed,
        counter: counterMultiplier(e.troop, t.troop),
        ranged: !!e.ranged,
        miss: evade,
        charge3: charge3Flag,     // 虎豹骑/幽州突骑冲锋
        dashed: dashed,
        poison: poisoned,
        firstHitBlock: evade,
        x1: e.x, y1: e.y, x2: t.x, y2: t.y,
      });
      if (charge3Flag && !evade) {
        events.push({ t: 'impact', kind: 'charge3', uid: e.uid, x: t.x, y: t.y, damage });
      }

      // 曹操「宁可我负天下人」：技能持续期间，反弹远程伤害的一定比例给攻击者。
      // 判定看「这一击是否为远程箭矢」（e.ranged），与陷阵营 counterPct 的近战判定分开；
      // 白马义从 e.ranged=true，仍按远程反弹，不改变原有远程判定。
      if (!evade && e.alive && t.alive && mainHit.applied > 0 && t.tr && t.tr.dmgConvert
        && t.convertUntil > battle.time && e.ranged) {
        const rdmg = Math.max(1, Math.floor(mainHit.applied * t.tr.dmgConvert.reflectPct));
        const rr = applyDamageTo(e, rdmg, events);
        addDealt(t.uid, rr.applied);
        addTaken(e.uid, rr.applied);
        if (rr.killed) addKill(t.uid);
        events.push({
          t: 'attack', actor: t.uid, target: e.uid,
          actorSide: t.side, actorTroop: t.troop, actorLevel: t.level,
          targetTroop: e.troop, targetLevel: e.level,
          damage: rdmg, hpAfter: e.hp, killed: rr.killed,
          ranged: false, reflect: true,
          x1: t.x, y1: t.y, x2: e.x, y2: e.y,
        });
        if (rr.killed) {
          events.push({ t: 'death', uid: e.uid, side: e.side, troop: e.troop, level: e.level, x: e.x, y: e.y });
        }
      }

      // 关平「拖刀计」每次攻击击晕 1 秒；刘备「仁德之盾」盾击眩晕 1.5 秒
      if (!evade && t.alive && e.tr && (e.tr.stunEveryHit || e.tr.stunEvery3)) {
        e.heroAtkCount = (e.heroAtkCount || 0) + 1;
        if (e.tr.stunEveryHit || e.heroAtkCount % 3 === 0) {
          const sec = e.tr.stunEveryHit || e.tr.stunEvery3;
          t.stunTimer = Math.max(t.stunTimer || 0, sec);
          events.push({
            t: 'stun', uid: t.uid, side: t.side, troop: t.troop, level: t.level,
            duration: sec, x: t.x, y: t.y,
          });
        }
      }

      // 张飞「燕人咆哮」：圆环震地 —— 以自身为圆心、半径 2 格，对圈内其他敌人造成普攻伤害
      if (!evade && e.tr && e.tr.spinAttack) {
        const spin = e.tr.spinAttack;
        const rad = spin.radius || 2;
        for (const o of entities) {
          if (!o.alive || o.side === e.side || o.uid === t.uid) continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) > rad) continue;
          splashHit(e, o, computeDamage(e, o, { mult: spin.dmgMult || 1 }), 'spin', events);
        }
        events.push({ t: 'impact', kind: 'spin', uid: e.uid, x: e.x, y: e.y, radius: rad });
      }

      // 关羽「青龙偃月」：只在这一击是冲锋时，对攻击方向 60 度、半径 3 格内的其他敌人
      // 造成 3 倍普攻伤害；后续普通攻击不再触发扇形，恢复单体。
      if (!evade && charge3Flag && e.tr && e.tr.chargeSplash) {
        const sec = e.tr.chargeSplash;
        const rad = sec.radius || 3;
        const angle = sec.angle || 60;
        const half = (angle * Math.PI / 180) / 2;
        const dir = Math.atan2(t.y - e.y, t.x - e.x);
        for (const o of entities) {
          if (!o.alive || o.side === e.side || o.uid === t.uid) continue;
          const dx = o.x - e.x;
          const dy = o.y - e.y;
          const d = Math.hypot(dx, dy);
          if (d > rad || d < 1e-6) continue;
          let da = Math.atan2(dy, dx) - dir;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) > half) continue;
          splashHit(e, o, computeDamage(e, o, { mult: sec.dmgMult || 2 }), 'sector', events);
        }
        events.push({
          t: 'impact', kind: 'sector', uid: e.uid, x: e.x, y: e.y,
          radius: rad, angle, dirX: Math.cos(dir), dirY: Math.sin(dir),
        });
      }

      // 周瑜「火烧连营」：箭落在目标脚下生成直径 2 格的火焰圈，持续 3 秒、每 0.5 秒跳伤
      if (!evade && e.tr && e.tr.fireZone) {
        const fz = e.tr.fireZone;
        battle.fireZones.push({
          x: t.x, y: t.y,
          radius: fz.radius || 1,
          left: fz.duration || 3,
          duration: fz.duration || 3,
          tick: 0,
          interval: fz.interval || 0.5,
          dps: (e.atk + e.auraAtk) * (fz.dmgPct || 0.5) * (e.tr.dealtMult || 1),
          vsTengjia: fz.vsTengjia || 1,
          from: e.uid,
          side: e.side,
        });
        // 同屏最多保留 12 个圈，避免后期远程齐射堆满特效
        if (battle.fireZones.length > 12) battle.fireZones.shift();
        events.push({
          t: 'fireZone', uid: e.uid, side: e.side, x: t.x, y: t.y,
          radius: fz.radius || 1, duration: fz.duration || 3, interval: fz.interval || 0.5,
        });
      }

      // 张飞「燕人咆哮」：接战时吼退周围敌军 2 秒（每个英雄只触发一次）
      if (e.tr && e.tr.fear && !e.fearDone && e.alive) {
        e.fearDone = true;
        const fr = e.tr.fear.radius || 2;
        for (const o of entities) {
          if (!o.alive || o.side === e.side) continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) > fr) continue;
          o.fearTimer = e.tr.fear.sec || 2;
          o.fearFromX = e.x;
          o.fearFromY = e.y;
        }
        events.push({ t: 'fear', uid: e.uid, x: e.x, y: e.y, radius: fr, duration: e.tr.fear.sec });
      }

      // 多箭齐射（无当飞军毒矢 / 英雄黄盖苦肉连射）：已打出 1 支，追加 multiArrow-1 支
      if (e.tr && e.tr.multiArrow && e.multiArrow > 1) {
        for (let k = 1; k < e.multiArrow; k++) {
          if (!t.alive) break;
          const dmg2 = computeDamage(e, t, { mult: mult, charge: charge3Flag });
          const hit2 = applyDamageTo(t, dmg2, events);
          const killed2 = hit2.killed;
          // 曹操技能：多箭齐射的每一支远程箭也按比例反弹
          if (hit2.applied > 0 && e.alive && t.tr && t.tr.dmgConvert
            && t.convertUntil > battle.time && e.ranged) {
            const rdmg = Math.max(1, Math.floor(hit2.applied * t.tr.dmgConvert.reflectPct));
            const rr = applyDamageTo(e, rdmg, events);
            addDealt(t.uid, rr.applied);
            addTaken(e.uid, rr.applied);
            if (rr.killed) addKill(t.uid);
            events.push({
              t: 'attack', actor: t.uid, target: e.uid,
              actorSide: t.side, actorTroop: t.troop, actorLevel: t.level,
              targetTroop: e.troop, targetLevel: e.level,
              damage: rdmg, hpAfter: e.hp, killed: rr.killed,
              ranged: false, reflect: true,
              x1: t.x, y1: t.y, x2: e.x, y2: e.y,
            });
            if (rr.killed) {
              events.push({ t: 'death', uid: e.uid, side: e.side, troop: e.troop, level: e.level, x: e.x, y: e.y });
            }
          }
          if (t.alive && e.tr.poisonPct) {
            t.poison = {
              dps: (e.atk + e.auraAtk) * e.tr.poisonPct * (e.tr.dealtMult || 1),
              left: POISON_TIME,
              tick: POISON_INTERVAL,
              from: e.uid,
            };
          }
          addDealt(e.uid, hit2.applied);
          addTaken(t.uid, hit2.applied);
          if (killed2) addKill(e.uid);
          events.push({
            t: 'attack',
            actor: e.uid, target: t.uid,
            actorSide: e.side, actorTroop: e.troop, actorLevel: e.level,
            targetTroop: t.troop, targetLevel: t.level,
            damage: dmg2, hpAfter: t.hp, killed: killed2,
            ranged: !!e.ranged, poison: !!(e.tr && e.tr.poisonPct), multiArrowExtra: true,
            x1: e.x, y1: e.y, x2: t.x, y2: t.y,
          });
          if (killed2) {
            events.push({ t: 'death', uid: t.uid, side: t.side, troop: t.troop, level: t.level, x: t.x, y: t.y });
          }
        }
      }

      // 陷阵营「锐甲反击」：只对近战伤害反击，反弹这次受到伤害的一定比例（反击不再触发反击）
      // 判定看「这次攻击是否远程」而不是兵种线：白马义从仍算骑兵线，但打出的是箭矢 = 远程，不触发反射
      if (!evade && t.alive && !e.ranged && t.tr && t.tr.counterPct) {
        const cdmg = Math.max(1, Math.floor(Math.min(damage, hpBefore) * t.tr.counterPct));
        const counterHit = applyDamageTo(e, cdmg, events);
        const cKill = counterHit.killed;
        addDealt(t.uid, counterHit.applied);
        addTaken(e.uid, counterHit.applied);
        if (cKill) addKill(t.uid);
        events.push({
          t: 'attack',
          actor: t.uid, target: e.uid,
          actorSide: t.side, actorTroop: t.troop, actorLevel: t.level,
          targetTroop: e.troop, targetLevel: e.level,
          damage: cdmg, hpAfter: e.hp, killed: cKill,
          counter: 1,
          counterAttack: true,
          ranged: false,
          x1: t.x, y1: t.y, x2: e.x, y2: e.y,
        });
        if (cKill) {
          events.push({ t: 'death', uid: e.uid, side: e.side, troop: e.troop, level: e.level, x: e.x, y: e.y });
        }
      }

      if (killed) {
        events.push({ t: 'death', uid: t.uid, side: t.side, troop: t.troop, level: t.level, x: t.x, y: t.y });
      }

      // 攻击间隔：连射打在弹匣节奏上，打完装弹；其余按基础 interval（攻速光环已删除）
      if (isVolley) {
        e.burstLeft -= 1;
        e.cooldown = e.burstLeft > 0 ? e.tr.volley.shotInterval : e.tr.volley.reload;
      } else {
        e.cooldown = e.interval;
      }
    }

    separate();

    if (aliveCount('player') === 0 || aliveCount('enemy') === 0) {
      const winner = aliveCount('player') > 0 ? 'player' : aliveCount('enemy') > 0 ? 'enemy' : 'draw';
      finish(winner, events);
      return events;
    }
    if (battle.time >= CONFIG.combat.maxTime) {
      const p = totalHp('player');
      const en = totalHp('enemy');
      finish(p >= en ? 'player' : 'enemy', events);
    }
    return events;
  };

  return battle;
}

// 快进整场战斗（测试 / 模拟器用），返回结果摘要
// opts 透传给 createArenaBattle（模拟器用它带上器械与兵书倍率，和真机一致）
export function simulateArena(playerSquads, enemySquads, rng = Math.random, capSeconds = 200, opts = {}) {
  const battle = createArenaBattle(playerSquads, enemySquads, rng, opts);
  const step = CONFIG.combat.step;
  let guard = 0;
  while (!battle.over && battle.time < capSeconds && guard < capSeconds * 40) {
    battle.step(step);
    guard++;
  }
  if (!battle.over) {
    battle.over = true;
    battle.winner = 'draw';
  }
  return battlesummary(battle);
}

function battlesummary(battle) {
  return {
    winner: battle.winner,
    time: battle.time,
    playerAlive: battle.aliveCount('player'),
    enemyAlive: battle.aliveCount('enemy'),
    playerTotal: battle.entities.filter((e) => e.side === 'player').length,
    enemyTotal: battle.entities.filter((e) => e.side === 'enemy').length,
    stats: battle.statsList(),
  };
}
