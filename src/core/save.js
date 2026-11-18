// 存档：状态结构 + 本地存储读写（存储实现由 platform 注入）
import { CONFIG } from '../data/config.js';
import { rosterSlots } from './levels.js';
import { sanitizeFormation, formationFromLineup } from './formation.js';
import { HEROES, HERO_MAX_LEVEL } from '../data/heroes.js';
import { refreshTroopUnlocks } from './units.js';
import { emptyTutorial, sanitizeTutorial } from './tutorial.js';
import { emptyIdleChest, sanitizeIdleChest } from './idleChest.js';
import { unlockNodeIds, seedUnlockSeen } from './unlocks.js';
import { TRIAL_ROUNDS } from './trialTroop.js';
import { AUTO_MERGE_MIN_UNITS } from './merge.js';
import { dateKey } from './daily.js';
import { CLOCK_ROLLBACK_TOLERANCE_MS } from './idle.js';
import { now as clockNow } from './clock.js';

export const SAVE_KEY = 'sgxb_save_v1';
// v13：全量重置（所有玩家从头走首次流程：序章 → 教学 → 东山再起）
// v14：自动战斗改为第 3 关开放 + 战败页广告改为 5 回合试用兵
// v15：全关卡难度重平衡 + 两军距离/远程射程调整 + 移除仇人字段 + 测试场
export const STATE_VERSION = 15;

// 数值清洗上限：只防脏数据/溢出，正常玩家的资产远低于这些值
const MAX_COINS = 1e9;
const MAX_TICKETS = 9999;
const MAX_SEQ = 1e6;
const MAX_STAT = 1e9;
const MAX_CHEST = 9999;

function clampInt(v, max, fallback = 0) {
  // 只接受真正的有限数字：null / 字符串 / NaN / Infinity 一律回退
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(max, Math.floor(v)));
}

function emptyChests() {
  const bag = {};
  for (const id of Object.keys(CONFIG.chests.types)) bag[id] = 0;
  return bag;
}

function emptyDaily() {
  return {
    day: '',
    clears: 0,
    merges: 0,
    chests: 0,
    shares: 0,
    dailyWins: 0,
    signed: false,
    claimed: [],
    loginDays: 0,
    loginDay: '',
  };
}

function clampVolume(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function createNewState() {
  const state = {
    version: STATE_VERSION,
    coins: CONFIG.economy.startCoins,
    maxCleared: 0,
    nextUnitId: 1,
    units: [],
    formation: [],
    chests: emptyChests(), // 宝箱仓库：{ wood: 2, silver: 1, ... }（首通奖励先入仓，玩家自己开）
    daily: emptyDaily(),   // 每日任务 / 签到 / 7 日登录（跨天重置，7 日登录天数不清零）
    autoBattle: false, // 自动战斗：胜利后自动进入下一关（失败即停止）
    // 剧情：introDone=false = 还没打过董卓开场战（首次进入停在序章布阵页）
    story: { introDone: false },
    audio: CONFIG.audio.enabled !== false, // 声音开关（BGM + 音效），首页可切换
    bgmVolume: CONFIG.audio.bgmVolume,     // BGM 音量（0~1，首页滑条可调）
    sfxVolume: CONFIG.audio.sfxVolume,     // 音效音量（0~1，首页滑条可调）
    idleAt: clockNow(), // 挂机收益的计时起点（真实时间毫秒）
    // 最近一次见到的时间戳：用于识别本机时间回拨（只做本地缓解）
    lastSeen: clockNow(),
    // 兵种卡片首次展示：初始 4 个兵种视为已认识，之后首次获得某兵种时弹一次
    seenTroops: CONFIG.startArmy.map((u) => u.troop),
    // 兵种解锁标记（按主线关数自动补齐；签到固定奖励等可额外写入）
    troopUnlocks: [],
    trialCleared: 0, // 演武已通关到第几关（1~25）
    adDay: '',       // 广告奖励的日期（三个通道共用一个日期字段，跨天统一重置）
    adWoodCount: 0,  // 当天商店小木箱广告次数（上限 CONFIG.ads.shopWoodLimit）
    adSilverCount: 0,// 当天商店银箱广告次数（上限 CONFIG.ads.shopSilverLimit）
    adCoinCount: 0,  // 当天失败页铜钱广告次数（上限 CONFIG.ads.coinLimit）
    adTroopCount: 0, // 当天失败页「看广告得兵」次数（上限 CONFIG.ads.troopLimit）
    // 每日商店：记录当天日期与已购买的栏位索引（跨天自动清空）
    dailyShop: { day: '', sold: [] },
    // 英雄系统 / 招募系统：已拥有英雄（id → 等级）、招募券、广告券日期与次数、
    // 保底计数、自选箱待选择队列、关卡赠将领取记录
    heroes: {},
    heroTickets: 0,
    heroAdDay: '',
    heroAdCount: 0,
    heroPity: 0,
    recruitBoxes: [],
    recruitBoxSeq: 0,
    heroLevelRewards: {},
    // 英雄战（150 关）：已通关关数
    heroBattleCleared: 0,
    // 过 5 关斩 6 将：已首通章节 / 今日奖励日期 / 进行中的一冲到底进度
    gauntlet: { cleared: [], dailyDay: '', run: null },
    // 每日挑战（30 关解锁，1.2.5）：首通进度（30 位 0/1 数组，顺序解锁常开）
    dailyChallenge: { progress: Array(CONFIG.dailyChallenge.total).fill(0) },
    // 周常挑战（30 关解锁，1.2.5）：本周积分 draft 选兵 + 5 档×10 小关进度。
    // key 与当前周不一致时由 ensureWeekly 整域重建（积分/购买/进度每周归零）
    weekly: {
      key: '', points: 0, roster: [], form: [], tier: 1, nextId: 1,
      cleared: [], firstClear: [], sweepDay: '', sweepCount: 0,
    },
    // 成就（1.2.5）：只存已领奖的档位键（"成就id:档位下标"），进度读档时实时算
    achievements: { claimed: [] },
    // 累计计数器（1.2.5 成就进度用，不随每日/每周重置；战斗场次/胜场复用 stats）
    counters: { chestsOpened: 0, sweeps: 0, weeklyClears: 0 },
    // 攻城器械：唯一装备，只记「档位」与「出战选择」（不存数量，结构上不可重复获取）
    siege: { tiers: {}, choice: null },
    // 兵书（800 关解锁）：三卷等级，只记 0~10 的整数
    books: { atk: 0, hp: 0, def: 0 },
    // 新手引导：只记「看过哪几条」与「是否全局跳过强制步骤」
    tutorial: emptyTutorial(),
    // 新内容解锁教学：记录弹过教学的功能 / 兵种节点
    unlockSeen: [],
    // 解锁引导态：回主页要高亮的模式入口（'trials' | 'heroBattle' | 'gauntlet'），点过即清空
    guideTarget: null,
    // 首页挂机宝箱：每天 8 个链式计时（day / 已领数 / 当前箱子品质 / 计时锚点 / 可领时间）
    idleChest: emptyIdleChest(clockNow(), 0, { fromDayStart: false }),
    stats: { battles: 0, wins: 0, adsFinished: 0, adsInterrupted: 0 },
  };
  CONFIG.startArmy.forEach((u) => {
    const id = `u${state.nextUnitId++}`;
    state.units.push({ id, troop: u.troop, level: u.level });
  });
  // 初始布阵：自动把现有单位摆上（近战前排、弓兵后排）
  state.formation = formationFromLineup(state.units.map((u) => u.id), state.units);
  refreshTroopUnlocks(state);
  return state;
}

function sanitizeChests(raw) {
  const bag = emptyChests();
  if (!raw || typeof raw !== 'object') return bag;
  // 旧版只有 common（= 旧普通宝箱，掉落和现在的小木箱一致）→ 迁移成 wood
  const woodExtra = Number.isFinite(raw.common) ? Math.max(0, Math.floor(raw.common)) : 0;
  for (const id of Object.keys(bag)) {
    const n = raw[id];
    if (Number.isFinite(n)) bag[id] = Math.min(MAX_CHEST, Math.max(0, Math.floor(n)));
  }
  bag.wood = Math.min(MAX_CHEST, (bag.wood || 0) + woodExtra);
  return bag;
}

// 兵书：三卷等级，只保留 0~maxLevel 的整数
function sanitizeBooks(raw) {
  const out = { atk: 0, hp: 0, def: 0 };
  if (!raw || typeof raw !== 'object') return out;
  for (const id of Object.keys(out)) {
    const lv = Math.floor(Number(raw[id]) || 0);
    out[id] = Math.max(0, Math.min(CONFIG.books.maxLevel, lv));
  }
  return out;
}

function sanitizeSiege(raw) {
  const out = { tiers: {}, choice: null };
  if (!raw || typeof raw !== 'object') return out;
  const ids = (CONFIG.siege.engineList || []);
  if (raw.tiers && typeof raw.tiers === 'object') {
    for (const id of ids) {
      const t = Math.floor(Number(raw.tiers[id]) || 1);
      if (Number.isFinite(t) && t > 1) out.tiers[id] = Math.max(1, Math.min(CONFIG.siege.maxLevel, t));
    }
  }
  const c = raw.choice;
  if (c && typeof c === 'object' && ids.includes(String(c.id))) {
    const stances = (CONFIG.siege.stances || []).map((s) => s.id);
    out.choice = { id: String(c.id), stance: stances.includes(String(c.stance)) ? String(c.stance) : 'center' };
  }
  return out;
}

// 斩将跑关快照里的器械（开跑时锁死；坏数据直接丢掉，退回「无器械」）
function sanitizeRunEngine(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const S = CONFIG.siege;
  if (!S || !S.engines || !S.engines[raw.id]) return null;
  const tier = Math.max(1, Math.min(S.maxLevel, Math.floor(Number(raw.tier) || 1)));
  const stance = S.stances.some((s) => s.id === raw.stance) ? raw.stance : 'center';
  return { id: raw.id, tier, stance };
}

function sanitizeGauntlet(raw) {
  const out = { cleared: [], dailyDay: '', run: null };
  if (!raw || typeof raw !== 'object') return out;
  const ids = (CONFIG.gauntlet.chapters || []).map((c) => c.id);
  if (Array.isArray(raw.cleared)) {
    out.cleared = [...new Set(raw.cleared.map(String).filter((id) => ids.includes(id)))];
  }
  out.dailyDay = typeof raw.dailyDay === 'string' ? raw.dailyDay : '';
  const run = raw.run;
  if (run && typeof run === 'object' && ids.includes(String(run.chapter))) {
    const units = Array.isArray(run.units)
      ? run.units
          .filter((u) => u && CONFIG.troops.some((t) => t.id === u.troop))
          .map((u) => ({
            troop: u.troop,
            level: Math.max(1, Math.min(CONFIG.merge.maxLevel, Math.floor(u.level || 1))),
            hero: typeof u.hero === 'string' ? u.hero : null,
            col: Math.max(0, Math.min(CONFIG.formation.cols - 1, Math.floor(u.col || 0))),
            row: Math.max(0, Math.min(CONFIG.formation.rows - 1, Math.floor(u.row || 0))),
            hpPct: Math.max(0, Math.min(1, Number(u.hpPct) || 0)),
            dead: u.dead === true,
          }))
      : [];
    if (units.length) {
      out.run = {
        chapter: String(run.chapter),
        stage: Math.max(1, Math.min(CONFIG.gauntlet.stagesPerChapter, Math.floor(run.stage || 1))),
        units,
        engine: sanitizeRunEngine(run.engine),
      };
    }
  }
  return out;
}

function sanitizeDaily(raw) {
  const d = emptyDaily();
  if (!raw || typeof raw !== 'object') return d;
  d.day = typeof raw.day === 'string' ? raw.day : '';
  d.clears = Number.isFinite(raw.clears) ? Math.max(0, Math.floor(raw.clears)) : 0;
  d.merges = Number.isFinite(raw.merges) ? Math.max(0, Math.floor(raw.merges)) : 0;
  d.chests = Number.isFinite(raw.chests) ? Math.max(0, Math.floor(raw.chests)) : 0;
  d.shares = Number.isFinite(raw.shares) ? Math.max(0, Math.floor(raw.shares)) : 0;
  d.dailyWins = Number.isFinite(raw.dailyWins) ? Math.max(0, Math.floor(raw.dailyWins)) : 0;
  d.signed = raw.signed === true;
  const known = (CONFIG.daily.tasks || []).map((t) => t.id);
  d.claimed = Array.isArray(raw.claimed)
    ? [...new Set(raw.claimed.map(String).filter((id) => known.includes(id)))]
    : [];
  d.loginDays = Number.isFinite(raw.loginDays)
    ? Math.min(CONFIG.daily.login7.days.length, Math.max(0, Math.floor(raw.loginDays)))
    : 0;
  d.loginDay = typeof raw.loginDay === 'string' ? raw.loginDay : '';
  return d;
}

function sanitizeDailyShop(raw) {
  const d = { day: '', sold: [] };
  if (!raw || typeof raw !== 'object') return d;
  d.day = typeof raw.day === 'string' ? raw.day : '';
  const total = CONFIG.dailyShop.rareSlots + CONFIG.dailyShop.epicSlots;
  d.sold = Array.isArray(raw.sold)
    ? [...new Set(raw.sold
      .map((n) => Math.floor(Number(n)))
      .filter((n) => Number.isFinite(n) && n >= 0 && n < total))]
    : [];
  return d;
}

function sanitizeStory(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    introDone: src.introDone === true,
  };
}

function sanitizeHeroes(raw) {
  const out = {};
  for (const h of HEROES) {
    const lv = Math.floor(Number(raw[h.id]));
    if (Number.isFinite(lv) && lv > 0) out[h.id] = Math.min(HERO_MAX_LEVEL, lv);
  }
  return out;
}

// 每日挑战：30 位首通进度（0/1）；缺档/脏档直接补 0（首通奖励按位判重）
function sanitizeDailyChallenge(raw) {
  const total = CONFIG.dailyChallenge.total;
  const out = { progress: Array(total).fill(0) };
  if (!raw || typeof raw !== 'object') return out;
  const src = Array.isArray(raw.progress) ? raw.progress : [];
  for (let i = 0; i < total; i++) out.progress[i] = Number(src[i]) ? 1 : 0;
  return out;
}

// 周常挑战：只保证结构合法（换周重建由 ensureWeekly 负责，sanitize 不碰业务重置）
function sanitizeWeekly(raw) {
  const cells = CONFIG.formation.cols * CONFIG.formation.rows;
  const out = {
    key: '', points: 0, roster: [], form: [], tier: 1, nextId: 1,
    cleared: [], firstClear: [], sweepDay: '', sweepCount: 0,
  };
  if (!raw || typeof raw !== 'object') return out;
  out.key = typeof raw.key === 'string' ? raw.key : '';
  out.points = clampInt(raw.points, CONFIG.weekly.points);
  out.tier = Math.max(1, Math.min(CONFIG.weekly.tiers, Math.floor(Number(raw.tier) || 1)));
  out.nextId = clampInt(raw.nextId, 1e6) || 1;
  out.sweepDay = typeof raw.sweepDay === 'string' ? raw.sweepDay : '';
  out.sweepCount = clampInt(raw.sweepCount, CONFIG.weekly.sweepDailyLimit);
  // roster：本周用积分买出的兵（{id:'w1', troop, level}），id 必须唯一、兵种合法、等级 1~10
  if (Array.isArray(raw.roster)) {
    const seenIds = new Set();
    out.roster = raw.roster
      .filter((r) => r && typeof r === 'object' && CONFIG.troops.some((t) => t.id === r.troop)
        && typeof r.id === 'string' && /^w\d+$/.test(r.id) && !seenIds.has(r.id))
      .slice(0, cells)
      .map((r) => {
        seenIds.add(r.id);
        return {
          id: r.id,
          troop: r.troop,
          level: Math.max(1, Math.min(CONFIG.merge.maxLevel, Math.floor(Number(r.level) || 1))),
        };
      });
  }
  // form：与普通布阵同构 —— null / "w:下标" 不用，直接存 roster 的 id 字符串 / "h:英雄id"；
  // 指向不存在兵牌或非法英雄的格子一律清空
  const heroIds = Object.keys(HEROES);
  const rosterIds = new Set(out.roster.map((r) => r.id));
  if (Array.isArray(raw.form)) {
    out.form = raw.form.slice(0, cells).map((v) => {
      if (v == null) return null;
      if (typeof v !== 'string') return null;
      if (v.startsWith('h:')) return heroIds.includes(v.slice(2)) ? v : null;
      return rosterIds.has(v) ? v : null;
    });
    while (out.form.length < cells) out.form.push(null);
  }
  // cleared / firstClear：每档一个 10 位掩码（bit0 = 第 1 小关），共 5 档
  const maxMask = (1 << CONFIG.weekly.stagesPerTier) - 1;
  const masks = (src) => {
    const arr = Array(CONFIG.weekly.tiers).fill(0);
    if (Array.isArray(src)) {
      for (let i = 0; i < arr.length && i < src.length; i++) {
        arr[i] = clampInt(src[i], maxMask);
      }
    }
    return arr;
  };
  out.cleared = masks(raw.cleared);
  out.firstClear = masks(raw.firstClear);
  return out;
}

// 成就已领奖键：白名单式清洗（"id:档位下标" 格式），未知键丢弃
function sanitizeAchievements(raw) {
  const out = { claimed: [] };
  if (!raw || typeof raw !== 'object') return out;
  if (Array.isArray(raw.claimed)) {
    out.claimed = [...new Set(raw.claimed
      .map(String)
      .filter((k) => /^[a-zA-Z][\w-]*:\d+$/.test(k)))].slice(0, 500);
  }
  return out;
}

function sanitizeCounters(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    chestsOpened: clampInt(src.chestsOpened, MAX_STAT),
    sweeps: clampInt(src.sweeps, MAX_STAT),
    weeklyClears: clampInt(src.weeklyClears, MAX_STAT),
  };
}

function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // 存档版本迁移：v11 起不再兼容旧档（旧档进游戏直接回到全新开局，
  // 解锁记录 / 引导已看 / 招募券 / 英雄全部清零，不会出现旧资产混进新档）
  // v13：序章旁白 + 教学关卡 + 缩放引导上线，所有玩家从头走一遍首次流程（铜钱 / 兵牌 /
  // 英雄 / 宝箱 / 各模式进度 / 引导记录一并清空，不做保留式迁移）。
  const rawVersion = Number(raw.version) || 0;
  if (rawVersion < STATE_VERSION) return createNewState();
  const nowMs = clockNow();
  const prevSeen = Number.isFinite(raw.lastSeen) ? Math.floor(raw.lastSeen) : nowMs;
  // 本机时间回拨：以 lastSeen 为准，偏差超过容忍值就按回拨处理
  const clockRolledBack = nowMs + CLOCK_ROLLBACK_TOLERANCE_MS < prevSeen;
  const s = {
    version: STATE_VERSION,
    coins: clampInt(raw.coins, MAX_COINS, CONFIG.economy.startCoins),
    maxCleared: Number.isFinite(raw.maxCleared) ? Math.max(0, Math.min(CONFIG.levelGen.total, Math.floor(raw.maxCleared))) : 0,
    nextUnitId: Number.isFinite(raw.nextUnitId) ? Math.max(1, Math.floor(raw.nextUnitId)) : 1,
    units: Array.isArray(raw.units)
      ? raw.units
          .filter((u) => u && CONFIG.troops.some((t) => t.id === u.troop))
          .map((u) => ({
            id: String(u.id),
            troop: u.troop,
            level: Math.max(1, Math.min(CONFIG.merge.maxLevel, Math.floor(u.level || 1))),
            // 试用兵：保留剩余回合；非法值按 0 处理（不写入 = 普通兵）
            ...(Number.isFinite(u.trialLeft) && u.trialLeft > 0
              ? { trialLeft: Math.min(TRIAL_ROUNDS, Math.max(1, Math.floor(u.trialLeft))) }
              : {}),
          }))
      : [],
    formation: Array.isArray(raw.formation) ? raw.formation.map((v) => (v ? String(v) : null)) : null,
    legacyLineup: Array.isArray(raw.lineup) ? raw.lineup.map(String) : null,
    chests: sanitizeChests(raw.chests),
    daily: sanitizeDaily(raw.daily),
    story: sanitizeStory(raw.story),
    autoBattle: raw.autoBattle === true,
    // 旧档没有声音开关：默认开（读档后首页可以关掉）
    audio: raw.audio !== false,
    bgmVolume: clampVolume(raw.bgmVolume, CONFIG.audio.bgmVolume),
    sfxVolume: clampVolume(raw.sfxVolume, CONFIG.audio.sfxVolume),
    // 旧档没有挂机计时点：以读档时间为起点，避免凭空结算；
    // 时间回拨时同样把计时点拉到 now：不白给挂机收益，也不会把玩家卡在未来
    idleAt: clockRolledBack ? nowMs : (Number.isFinite(raw.idleAt) ? Math.max(0, Math.floor(raw.idleAt)) : nowMs),
    // 单调时间锚点：每次读档刷新为当前时间
    lastSeen: nowMs,
    // 兵种解锁标记：只保留配置里存在的兵种 id（旧档由 maxCleared / 已有单位补齐）
    troopUnlocks: Array.isArray(raw.troopUnlocks)
      ? [...new Set(raw.troopUnlocks.map(String).filter((id) => CONFIG.troops.some((t) => t.id === id)))]
      : [],
    // 旧档没有 seenTroops：把当前已有的兵种都标成已认识，避免读档后连弹旧兵种
    seenTroops: Array.isArray(raw.seenTroops)
      ? [...new Set(raw.seenTroops.map(String).filter((id) => CONFIG.troops.some((t) => t.id === id)))]
      : [],
    trialCleared: Number.isFinite(raw.trialCleared)
      ? Math.max(0, Math.min(CONFIG.trials.total, Math.floor(raw.trialCleared)))
      : 0,
    adDay: typeof raw.adDay === 'string' ? raw.adDay : '',
    // 三个独立计数器；旧档只有 adCount（一个总次数）→ 迁移过来直接全置 0（跨天也会重置）
    adWoodCount: Number.isFinite(raw.adWoodCount)
      ? Math.max(0, Math.min(CONFIG.ads.shopWoodLimit, Math.floor(raw.adWoodCount)))
      : 0,
    adSilverCount: Number.isFinite(raw.adSilverCount)
      ? Math.max(0, Math.min(CONFIG.ads.shopSilverLimit, Math.floor(raw.adSilverCount)))
      : 0,
    adCoinCount: Number.isFinite(raw.adCoinCount)
      ? Math.max(0, Math.min(CONFIG.ads.coinLimit, Math.floor(raw.adCoinCount)))
      : 0,
    adTroopCount: Number.isFinite(raw.adTroopCount)
      ? Math.max(0, Math.min(CONFIG.ads.troopLimit, Math.floor(raw.adTroopCount)))
      : 0,
    // 旧档没有每日商店：给一份空的，等当天开局会自动生成栏位
    dailyShop: sanitizeDailyShop(raw.dailyShop),
    heroes: sanitizeHeroes(raw.heroes),
    heroTickets: clampInt(raw.heroTickets, MAX_TICKETS),
    heroAdDay: typeof raw.heroAdDay === 'string' ? raw.heroAdDay : '',
    heroAdCount: Number.isFinite(raw.heroAdCount)
      ? Math.max(0, Math.min(CONFIG.heroes.adLimit, Math.floor(raw.heroAdCount)))
      : 0,
    heroPity: Number.isFinite(raw.heroPity)
      ? Math.max(0, Math.min(CONFIG.heroes.recruit.pity - 1, Math.floor(raw.heroPity)))
      : 0,
    // 自选箱待选择队列：只保留结构合法的项（id / 品级 / 等级），选完即从队列移除
    recruitBoxes: (() => {
      const out = [];
      const rarities = Object.keys(CONFIG.rarity || {});
      if (Array.isArray(raw.recruitBoxes)) {
        for (const b of raw.recruitBoxes) {
          if (!b || typeof b !== 'object') continue;
          if (typeof b.id !== 'string' || !b.id) continue;
          if (!rarities.includes(b.rarity)) continue;
          if (!Number.isFinite(b.level)) continue;
          const level = Math.max(1, Math.min(CONFIG.merge.maxLevel, Math.floor(b.level)));
          out.push({ id: b.id, rarity: b.rarity, level });
          if (out.length >= 200) break;
        }
      }
      return out;
    })(),
    recruitBoxSeq: clampInt(raw.recruitBoxSeq, MAX_SEQ),
    // 关卡赠将领取记录：只保留配置里存在的关号，且英雄 id 必须匹配（防止旧档伪造）。
    // 旧档 400 关记录是 zhangfei（1.0.10 及以前），现改为 guanping：
    // 视为「已领过」，保留关号防重复，不再给旧玩家补发关平（他们已拿过张飞）。
    heroLevelRewards: (() => {
      const out = {};
      const cfg = CONFIG.heroes.levelHeroRewards || {};
      const legacy = { 400: 'zhangfei' };
      if (raw.heroLevelRewards && typeof raw.heroLevelRewards === 'object') {
        for (const key of Object.keys(cfg)) {
          if (raw.heroLevelRewards[key] === cfg[key] || raw.heroLevelRewards[key] === legacy[key]) {
            out[key] = cfg[key];
          }
        }
      }
      // 1.0.16 及以前：250 关是直接送黄盖（没有领取记录）。现在 250 改为赠送关平，
      // 老档若已拥有黄盖，视为 250 奖励已领，不再补发关平（避免同一关双份武将）。
      const ver = Number(raw.version) || 0;
      const cleared = Number.isFinite(raw.maxCleared) ? Math.floor(raw.maxCleared) : 0;
      if (ver < 10 && cfg[250] && !out[250] && cleared >= 250
        && raw.heroes && Number(raw.heroes.huanggai) > 0) {
        out[250] = cfg[250];
      }
      return out;
    })(),
    heroBattleCleared: Number.isFinite(raw.heroBattleCleared)
      ? Math.max(0, Math.min(CONFIG.heroBattles.total, Math.floor(raw.heroBattleCleared)))
      : 0,
    gauntlet: sanitizeGauntlet(raw.gauntlet),
    // 1.2.5 新域：缺档时 sanitize 补默认结构（不提版本号，避免老档整体重置）
    dailyChallenge: sanitizeDailyChallenge(raw.dailyChallenge),
    weekly: sanitizeWeekly(raw.weekly),
    achievements: sanitizeAchievements(raw.achievements),
    counters: sanitizeCounters(raw.counters),
    siege: sanitizeSiege(raw.siege),
    books: sanitizeBooks(raw.books),
    // 新手引导：旧档（没有 tutorial 字段）且已经打过 10 关的玩家不再补弹
    tutorial: sanitizeTutorial(raw.tutorial, {
      legacy: !raw.tutorial,
      maxCleared: Number.isFinite(raw.maxCleared) ? Math.max(0, Math.floor(raw.maxCleared)) : 0,
      // 本次更新前就已经满 25 张兵牌的老档：不再补弹合成教程
      mergeAlreadyAvailable: !Number.isFinite(raw.lastSeen)
        && (Array.isArray(raw.units) ? raw.units.length : 0) >= AUTO_MERGE_MIN_UNITS,
    }),
    // 新内容解锁教学：老档没有字段 → 把已解锁的节点都标记为看过，避免更新后连弹
    unlockSeen: (() => {
      const valid = unlockNodeIds();
      if (Array.isArray(raw.unlockSeen)) {
        return [...new Set(raw.unlockSeen.map(String).filter((id) => valid.includes(id)))];
      }
      const s = { unlockSeen: [] };
      seedUnlockSeen(s, Number.isFinite(raw.maxCleared) ? Math.max(0, Math.floor(raw.maxCleared)) : 0);
      return s.unlockSeen;
    })(),
    // 解锁引导态：只接受合法模式 id（1.2.5 增加周常/每日/成就）；老档没有该字段 → null
    guideTarget: (['trials', 'heroBattle', 'gauntlet', 'weekly', 'dailyChallenge', 'achievements']
      .includes(raw.guideTarget)) ? raw.guideTarget : null,
    // 挂机宝箱：老档没有字段 → 从第 1 个开始（计时从读档时刻起），不会报错也不会白送
    idleChest: sanitizeIdleChest(raw.idleChest, {
      legacy: !raw.idleChest,
      maxCleared: Number.isFinite(raw.maxCleared) ? Math.max(0, Math.floor(raw.maxCleared)) : 0,
    }),
    stats: {
      battles: clampInt(raw.stats?.battles, MAX_STAT),
      wins: clampInt(raw.stats?.wins, MAX_STAT),
      adsFinished: clampInt(raw.stats?.adsFinished, MAX_STAT),
      adsInterrupted: clampInt(raw.stats?.adsInterrupted, MAX_STAT),
    },
  };
  // 本机时间回拨：每日进度 / 7 日登录按今天重新对齐，避免停留在未来日期或重复领奖
  if (clockRolledBack) {
    const today = dateKey(nowMs);
    if (s.daily.day !== today) {
      s.daily.day = today;
      s.daily.clears = 0;
      s.daily.merges = 0;
      s.daily.chests = 0;
      s.daily.signed = false;
      s.daily.claimed = [];
    }
    if (s.daily.loginDay > today) s.daily.loginDay = today;
  }
  // 兵营容量校验：超出当前格子数的单位保留（避免吞掉玩家资产），仅停止继续获得
  const { unlocked } = rosterSlots(s.maxCleared);
  if (s.units.length > Math.max(unlocked, CONFIG.roster.initialSlots)) {
    s.units = s.units.slice(0, Math.max(unlocked, CONFIG.roster.initialSlots));
  }
  // 布阵：新档直接清洗；旧档（只有 lineup）迁移成 5×5 布阵
  const heroEntries = Object.keys(s.heroes || {}).map((id) => `h:${id}`);
  s.formation = raw.formation
    ? sanitizeFormation(s.formation, s.units, heroEntries)
    : formationFromLineup(s.legacyLineup, s.units);
  delete s.legacyLineup;
  if (!s.units.length) {
    const fresh = createNewState();
    return fresh;
  }
  // 旧档（没有 seenTroops 字段）默认把当前拥有的兵种都视为已认识
  if (!Array.isArray(raw.seenTroops)) {
    s.seenTroops = [...new Set(s.units.map((u) => u.troop))];
  }
  // 读档时按 maxCleared 补齐解锁标记，并把已拥有的兵种一并标记（避免自己的兵反被锁）
  refreshTroopUnlocks(s);
  for (const u of s.units) {
    if (!s.troopUnlocks.includes(u.troop)) s.troopUnlocks.push(u.troop);
  }
  return s;
}

// 读取存档里的时间高水位（供可信时钟在 loadState 之前钳制本机时间）
export function readLastSeen(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return NaN;
    const parsed = JSON.parse(raw);
    const v = Number(parsed && parsed.lastSeen);
    return Number.isFinite(v) && v > 0 ? v : NaN;
  } catch (e) {
    return NaN;
  }
}

export function loadState(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return createNewState();
    const parsed = JSON.parse(raw);
    const ver = Number(parsed && parsed.version) || 0;
    // 旧版本档：立刻写入全新档，避免每次进游戏都重复迁移
    if (ver < STATE_VERSION) return resetState(storage);
    return sanitize(parsed) || createNewState();
  } catch (e) {
    return createNewState();
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function resetState(storage) {
  const fresh = createNewState();
  saveState(storage, fresh);
  return fresh;
}

// 存档快照（供自动化测试）
export function snapshot(state) {
  return JSON.parse(JSON.stringify(state));
}
