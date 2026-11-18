﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿// 汉末行伍征战记 —— 全量可配置数据
// 所有数值都在这里，逻辑层不写死任何数值。改这里 = 改游戏。

export const CONFIG = {
  design: { width: 750, height: 1334 },

  /* ============ 兵营 / 容量 ============ */
  roster: {
    initialSlots: 300,        // 开局就有 300 个兵营位（不再逐个解锁）
    maxSlots: 300,            // 兵营容量上限（不含武将位）
    heroSlots: 3,             // 预留武将位（本期不开放）
    // 不按关解锁格子：300 个全部开局可用（留空数组兼容旧逻辑）
    slotUnlockLevels: [],
  },

  /* ============ 编队 / 布阵 ============ */
  // 竖版斗技场：敌方在上、我方在下。布阵是 5×5（最多 25 个单位）
  // col = 前后纵深（col 4 = 前排，最靠中线；col 0 = 后排）
  // row = 左右横排（row 0..4 从左到右，row 2 居中）
  formation: {
    cols: 5,
    rows: 5,
    maxUnits: 25,
    lateralStep: 4.8,                                // 横排间距（格）
    depthStep: 5.8,                                  // 前后排间距（格）
    centerX: 15,                                     // 横排中心（= arena.cols / 2）
    playerFrontY: 45.5,                              // 我方前排所在行：与敌方前排中心相隔 7 格
    enemyFrontY: 38.5,                               // 敌方前排所在行：两军之间留 6 格空地，须走 6 格才接战
  },

  /* ============ 斗技场 ============ */
  // 竖版长方形：宽 30 格、高 84 格，上下半场各 42 格。
  // 渲染成「斜 45° 俯视」：地面纵向压扁、立绘仍然竖着站（见 render/camera.js 的 TILT）。
  // 布阵页放大看我方半场；开战后镜头不会缩到「整场一屏」，而是保持可读的缩放，
  // 让玩家左右 / 上下拖动查看全貌（顶部输出面板盖住的兵也能拖出来）。
  arena: {
    cols: 30,
    rows: 84,
  },

  /* ============ 战场主题（每个章节一套） ============ */
  // 战场地形配色全部在这里调：地面渐变、沙粒 / 草 / 水 / 雪等装饰、旗帜与旗杆
  // 第一章沿用黄沙旷野，后面 5 章各有一套主题，drawArenaField 按关卡所属章节切换
  arenaTheme: {
    name: '黄巾之乱 · 黄沙旷野',
    sandTop: '#d99a42',
    sandUpper: '#cf8a37',
    sandMid: '#b57028',
    sandLow: '#8a4e1c',
    speck: ['rgba(255,222,150,0.36)', 'rgba(116,70,26,0.42)', 'rgba(240,176,84,0.36)'],
    banner: '#f1c43a',
    bannerTrim: '#9e2f21',
    wood: '#4d2f15',
    bannerGlyph: '黄',
    decor: 'sand',
  },
  arenaThemes: {
    huangjin: {
      name: '黄巾之乱 · 黄沙旷野',
      sandTop: '#d99a42',
      sandUpper: '#cf8a37',
      sandMid: '#b57028',
      sandLow: '#8a4e1c',
      speck: ['rgba(255,222,150,0.36)', 'rgba(116,70,26,0.42)', 'rgba(240,176,84,0.36)'],
      banner: '#f1c43a',
      bannerTrim: '#9e2f21',
      wood: '#4d2f15',
      bannerGlyph: '黄',
      decor: 'sand',
    },
    dongzhuo: {
      name: '董卓乱京 · 焦土洛阳',
      sandTop: '#5c4638',
      sandUpper: '#4f3a2f',
      sandMid: '#3d2b24',
      sandLow: '#261a16',
      speck: ['rgba(255,150,80,0.30)', 'rgba(24,16,13,0.52)', 'rgba(214,84,46,0.30)'],
      banner: '#a62f24',
      bannerTrim: '#e2b45c',
      wood: '#2d1b12',
      bannerGlyph: '董',
      decor: 'ash',
      ember: true,
    },
    warlords: {
      name: '群雄逐鹿 · 中原沃野',
      sandTop: '#6b8450',
      sandUpper: '#5e7645',
      sandMid: '#4c6335',
      sandLow: '#344524',
      speck: ['rgba(214,232,150,0.30)', 'rgba(64,52,28,0.40)', 'rgba(154,186,96,0.30)'],
      banner: '#3f6d4a',
      bannerTrim: '#d9c06a',
      wood: '#3a2b17',
      bannerGlyph: '群',
      decor: 'plains',
    },
    chibi: {
      name: '赤壁烽火 · 长江水寨',
      sandTop: '#467089',
      sandUpper: '#3d6479',
      sandMid: '#31505f',
      sandLow: '#243c48',
      speck: ['rgba(210,240,255,0.30)', 'rgba(18,38,50,0.42)', 'rgba(120,190,214,0.30)'],
      banner: '#2f6c8a',
      bannerTrim: '#e0c070',
      wood: '#2b2118',
      bannerGlyph: '火',
      decor: 'river',
      water: true,
    },
    threekingdoms: {
      name: '三分鼎足 · 石垒山道',
      sandTop: '#6e6c58',
      sandUpper: '#615f4c',
      sandMid: '#4f4d3d',
      sandLow: '#39372b',
      speck: ['rgba(230,224,190,0.28)', 'rgba(52,48,36,0.42)', 'rgba(170,162,128,0.28)'],
      banner: '#8a5a2a',
      bannerTrim: '#e0c070',
      wood: '#3a2a18',
      bannerGlyph: '汉',
      decor: 'stone',
    },
    jin: {
      name: '天下归晋 · 霜雪洛阳',
      sandTop: '#778086',
      sandUpper: '#697277',
      sandMid: '#565e63',
      sandLow: '#3e4448',
      speck: ['rgba(244,248,252,0.34)', 'rgba(46,52,58,0.38)', 'rgba(214,222,228,0.30)'],
      banner: '#4a5a6a',
      bannerTrim: '#d8d0b0',
      wood: '#333234',
      bannerGlyph: '晋',
      decor: 'snow',
      snow: true,
    },
  },

  /* ============ 战场规则（自主行动 AI） ============ */
  combat: {
    // 一个兵营单位 = 一支小队，小队里有几个「自主行动的兵」
    // Lv1 编制：盾/枪/骑 3 人、弓兵 2 人；到 Lv3 / Lv5 / Lv8 各 +1 人，按 squadMax 封顶
    // 例：盾兵 Lv1=3、Lv3=4、Lv5=5、Lv8=6（满编）；弓兵 Lv1=2、Lv3=3、Lv5=4、Lv8=5（满编）
    squadSize: { shield: 3, archer: 2, spear: 3, cavalry: 3 },
    squadMax: { shield: 6, archer: 5, spear: 6, cavalry: 6 },
    squadGrowthLevels: [3, 5, 8],                    // 到达这些等级时小队 +1 个兵
    // 特殊兵种可以有自己的「增员等级」（由 SPECIAL_TROOPS 的 squad.levels 自动写入这里）
    squadGrowth: {},
    // 射程：从自身边缘到目标边缘的格数（近战 0.5 格贴脸，枪兵 1.2 格）
    // 弓兵 17 格（中心距离 18 格）：站第三排就能覆盖大半个战场；开火提前量 2 格 → 15 格开火
    ranges: { shield: 0.5, archer: 17, spear: 1.2, cavalry: 1 },
    // 先登死士：开战 1 秒后绕过敌军，出现在敌方最后一排的身后（同横排）
    xiandengTeleport: { delay: 1, behind: 1 },
    radius: 0.5,                                     // 一个兵的占位半径（格）→ 直径 1 格，有碰撞体积
    // 移速：整体放慢（打斗看得清、走位更有分量），骑兵拉得比步兵快得多
    // 骑兵 / 盾兵 = 1.73 倍、骑兵 / 枪兵 = 1.81 倍（之前只有 1.38 / 1.47 倍）
    speeds: { shield: 2.2, archer: 2.0, spear: 2.1, cavalry: 3.8 }, // 格/秒
    // 弓兵攻击间隔拉长（射程 17 格已经很强，再快就压过近战了）
    intervals: { shield: 1.15, archer: 2.25, spear: 1.3, cavalry: 1.05 }, // 攻击间隔（秒）
    retargetTime: 0.45,                              // 每隔多久重新找最近的敌人
    // 远程兵的开火提前量：走到「射程 - 2 格」就停下开火（留 2 格余量，避免被碰撞推开后
    // 反复在射程边缘进进出出、一直走动却不攻击）
    engageGap: 2,
    maxTime: 150,                                    // 超时判胜（按剩余血量比例）
    step: 1 / 30,                                    // 逻辑步长（秒）
  },

  /* ============ 攻城器械 ============ */
  // 唯一器械：全局只有一台，不进兵营 / 招募池 / 宝箱 / 商城，存档只记「有没有 + 几档 + 站哪」。
  // 基础强度跟随敌方等级锚点 enemyLevelFor(n)（和敌军同一条成长曲线），
  // 升级档位只提供额外增幅 —— 350 关拿到的霹雳车到 800 关不会变摆设。
  // 每局最多上阵 1 台（敌我各自 1 台），选出战器械互斥。
  siege: {
    // 三档站位：不占 5×5 阵位，只决定战场坐标（formation.js 的 col/row → 世界坐标）
    stanceRow: 2,                 // 三档都站中轴（第 3 行），只改前后
    stances: [
      { id: 'front', name: '前军', col: 4 },
      { id: 'center', name: '中军', col: 2 },
      { id: 'back', name: '后军', col: 0 },
    ],
    // 自动走位（只有霹雳车会动；鼓吹是常驻光环，站桩）。
    // 0.45 格/秒 ≈ 盾兵的 20%、骑兵的 12%：一场 30 秒的战斗最多挪 13 格，
    // 够补位、不够风筝；撤退速度远低于骑兵冲锋，所以「被贴脸」是真实代价。
    move: {
      speed: 0.45,                // 格/秒
      holdMin: 12,                // 最近敌人在 [12,34] 内不动
      holdMax: 34,                // 射程 10~36，各留 2 格滞回，避免边缘反复抖动
      playerMinY: 45.5,           // 我方前排线：器械不越过
      playerMaxY: 80,             // 我方底线
      enemyMinY: 4,
      enemyMaxY: 38.5,            // 敌方前排线
    },
    maxLevel: 10,                 // 1 档自带，2~10 档付费（9 个付费档）
    engineList: ['thunder', 'drum'],
    engines: {
      thunder: {
        id: 'thunder', name: '霹雳车', unlockLevel: 350,
        // 攻击距离 36 格（按玩家要求），最小射程 10：贴脸目标打不到，逼敌军进射程带
        minRange: 10, maxRange: 36,
        directRadius: 2.2,        // 落点直击半径
        // 冷却 16s → 12s（攻速更快），火圈单秒伤害同步下调（弓兵攻击 ×1.6，原 ×2.2）
        cooldown: 12, firstShot: 3, chargeTime: 1.0,
        // 火圈范围按玩家要求削弱 3.5 → 2.5 格
        fireRadius: 2.5, fireDuration: 6, fireInterval: 0.5,
        directHpFactor: 1.8,      // 直击 = 同关卡盾兵单兵血量 × 1.8
        fireAtkFactor: 1.6,       // 火圈 = 同关卡弓兵攻击 × 1.6 / 秒
        vsTengjia: 1.5,           // 沿用周瑜火攻对藤甲的克制
        hpFactor: 4,              // 本体血量 = 同等级盾兵单兵血量 × 4（战斗单位，可被索敌击杀）
        // 10 档成长曲线端点：伤害 ×1.0→×1.9，冷却 12→9.75s，火圈 2.5→3.0 格、6→7s
        tierCurve: { dmg: 1.9, cooldown: 9.75, fireRadius: 3.0, fireDuration: 7 },
        upgrade: { base: 4800, growth: 1.5 },
      },
      drum: {
        id: 'drum', name: '中军鼓吹', unlockLevel: 600,
        // 永久增伤光环：8~16 格、+4%~+16%，常驻不按周期触发，站桩不移动
        auraRadius: 8, auraRadiusMax: 16,
        auraDmg: 0.04, auraDmgMax: 0.16,
        hpFactor: 3,              // 本体血量 = 同等级盾兵单兵血量 × 3（战斗单位，可被索敌击杀）
        upgrade: { base: 6800, growth: 1.5 },
      },
    },
    // 敌方器械：每 5 关最多 1 台，替换敌方最后排的一支小队（总单位数仍 25）
    enemy: {
      every: 5,
      thunderFrom: 300,           // 300 关起，每 5 关必出霹雳车
      drumFrom: 500,              // 500 关起，同一周期按 50% 出鼓吹（同关不会两台）
      drumChance: 0.5,
      tierSpan: 2300,             // 档位 1→10 的关卡跨度（300 关到 2600 关）
    },
  },

  /* ============ 兵书（800 关解锁：全军永久三围加成，敌方 800 关后对等加） ============ */
  // 三卷各 10 级、每级 +2%：满级每项 +20%。价格几何增长（8000 × 1.6^n），
  // 单卷满级约 145 万铜钱，三卷约 436 万 —— 对 800~2600 关首通总收入（约 1320 万）约占 1/3，
  // 和「补兵 / 器械」抢同一笔钱，所以 800 关后是「先把兵书买到哪一卷」的选择而不是白送数值。
  // 敌方从 800 关开始按关卡线性补到 2000 关的 +20%（满档），和玩家满级时的单卷上限一致。
  books: {
    unlockLevel: 800,
    maxLevel: 10,
    perLevel: 0.02,
    tracks: [
      { id: 'atk', name: '武略', note: '全军攻击' },
      { id: 'hp', name: '兵势', note: '全军生命' },
      { id: 'def', name: '军纪', note: '全军防御' },
    ],
    upgrade: { base: 8000, growth: 1.6 },
    enemy: { from: 800, fullAt: 2000 },
  },

  /* ============ 成就系统（1.2.5 新增） ============ */
  achievements: {
    unlockLevel: 30,             // 与周常 / 每日挑战同期开放，首页入口常显
  },

  /* ============ 每日挑战（1.2.5 新增：30 关，敌方英雄带队） ============ */
  // 解锁：主线 30 关。前 12 关单英雄（史诗→传奇），13~24 关双英雄，25~30 关三英雄；
  // 难度锚点走 engineStageFor('daily', stage)：300 关起线性到第 30 关 = 主线 2000 关难度。
  dailyChallenge: {
    unlockLevel: 30,
    total: 30,
    doubleFrom: 13,        // 第 13 关起 2 个英雄
    tripleFrom: 25,        // 第 25 关起 3 个英雄
    hpMultFrom: 3,         // 第 1 关英雄血量倍率
    hpMultTo: 12,          // 第 30 关英雄血量倍率（极具攀升）
    dailyWinLimit: 3,      // 每天重复胜利前 3 场有小额奖励
    dailyWinCoins: 500,
    dailyWinChest: 'wood',
  },

  /* ============ 周常挑战（1.2.5 新增：5 档 × 10 小关，每周积分选兵） ============ */
  // 每周发放固定积分，给每个已解锁兵种「买等级」（等级越高越贵），下周归零重来。
  // 敌方难度 = 玩家理论 draft 战力上限 × 档位倍率 —— 差额只能靠玩家真实的
  // 英雄 / 器械 / 兵书进度来补（第 3 档起是硬门槛，正是养成动力所在）。
  weekly: {
    unlockLevel: 30,
    points: 1600,                 // 每周积分预算
    tiers: 5,
    stagesPerTier: 10,
    costBase: { common: 16, rare: 24, epic: 34, legendary: 48 },
    costGrowth: 1.45,             // 升一级 = 上一级的 1.45 倍
    tierMult: [0.90, 1.12, 1.30, 1.48, 1.68],   // × draft 战力上限
    stageGrowth: 0.02,            // 档内每小关 +2%
    tierAnchors: [350, 550, 800, 1200, 1700],   // 敌等级 / 兵书 / 难度标签锚点
    engineFromTier: 4,            // 第 4、5 档起敌方出器械
    sweepDailyLimit: 6,           // 已首通关每日扫荡次数
    sweepRatio: 0.6,              // 扫荡发首通铜钱的 60%（不给宝箱）
  },

  /* ============ 经济 ============ */
  // 铜钱只在「首通」时发放，重复挑战同一关不再产出铜钱（防刷关）
  // 日常缺钱靠「挂机收益」：打的关卡越远，每小时产得越多
  economy: {
    startCoins: 800,
    // 首通铜钱整体下调 20%：原 30 + 6×关号 → 现在 80%（第 1 关 28，第 200 关 984）
    clearCoins: (n) => Math.floor((30 + 6 * n) * 0.8),
    // 挂机（离线 / 在线累积）铜钱：基础 + 每通关一关的加成
    // 例：通关 50 关 = 40 + 10×50 = 540 / 小时；封顶 8 小时
    idle: {
      basePerHour: 40,
      perLevelPerHour: 10,
      capHours: 8,
    },
  },

  /* ============ 首页挂机宝箱 ============ */
  // 每天 8 个，链式计时：领走当前这个，下一个才开始计时（没领就一直停在待领）。
  // 每天北京时间 0 点重置回第 1 个；未领的跨天作废。
  // 品质按「当前最高通关关卡」：<200 小木箱 / ≥200 银箱 / ≥600 金箱。
  // 跨档时已经生成（正在计时 / 待领）的箱子保持原品质，下一个起升级。
  idleChests: {
    stepsMin: [1, 3, 5, 10, 10, 10, 60, 240],
    dailyLimit: 8,
    qualityByLevel: [
      { minLevel: 600, chest: 'gold' },
      { minLevel: 200, chest: 'silver' },
      { minLevel: 0, chest: 'wood' },
    ],
  },

  /* ============ 商城 ============ */
  // 用铜钱直接买兵：价格 = 兵种基础价 × 2^(等级-1)
  // （和合成等价：2 个同级 = 1 个高一级，所以高一级的价格 = 低一级的 2 倍）
  shop: {
    levels: [1, 3, 6],                     // 可选购买等级
    basePrice: { shield: 600, archer: 750, spear: 700, cavalry: 680 },
    levelFactor: (lv) => Math.pow(2, lv - 1),
    // 特殊宝箱：商城用铜钱直接买（稀有 5000 / 史诗 20000）
    chests: [
      { id: 'rare', price: 5000 },
      { id: 'epic', price: 20000 },
    ],
  },

  /* ============ 兵种解锁 ============ */
  // 只有已解锁的兵种才会出现在宝箱 / 每日商店 / 广告奖励等随机来源里；
  // initial 为开局即可获得的兵种（每个品级各 1 个），levels 按主线通关关数解锁。
  troopUnlocks: {
    initial: ['qingzhou', 'baier', 'xianzhen'],
    levels: {
      qingzhu: 20,
      youzhou: 50,
      xiandeng: 80,
      tengjia: 100,
      wudang: 120,
      yuanyong: 130,
      baima: 150,
      huhao: 180,
      daji: 200,
    },
  },

  /* ============ 每日商店 ============ */
  // 主线通关 100 关后解锁；每天 0 点（北京时间）刷新 6 个栏位，每个栏位限购 1 次
  //   前 4 个栏位：稀有兵种（Lv1）
  //   后 2 个栏位：史诗兵种（Lv1）
  dailyShop: {
    unlockLevel: 100,
    rareSlots: 4,
    epicSlots: 2,
    rarePrice: 3000,      // 稀有兵种 Lv1
    epicPrice: 12000,     // 史诗兵种 Lv1
    level: 1,
  },

  /* ============ 英雄系统 / 招募系统 ============ */
  // 主线 200 关解锁（第 250 关首通额外赠送「关平」）；英雄与兵种统一走「招募系统」抽卡获得
  heroes: {
    unlockLevel: 200,
    maxDeploy: 3,            // 最终上限：同时上阵 3 名英雄（含任何品级）
    // 上阵位随主线开放：200 关 1 格；500 关 2 格；1000 关 3 格
    slotLevels: [{ level: 500, slots: 2 }, { level: 1000, slots: 3 }],
    // 英雄等级上限：500 关之前封顶 20 级，通关 500 关后开放全部 30 级
    levelCapTiers: [{ level: 0, cap: 20 }, { level: 500, cap: 30 }],
    adLimit: 2,              // 每天看广告领招募券的次数（跨天重置）
    pullCost: 1,             // 单抽消耗 1 张券
    tenPull: 10,             // 十连消耗 10 张券
    levelUpBase: 400,        // 史诗升级铜钱 = 400 × 1.18^(等级-1)
    levelUpGrowth: 1.18,
    // 传奇升级价格 = 史诗价格 × (1.2 + (等级-1)/29 × 1.6)，Lv1 仅 +20%，满级前约 2.8 倍；
    // 全 30 级总花费约为史诗的 2.50 倍（≥2 倍要求）
    legendaryCostMult: { start: 1.2, growth: 1.6 },
    maxedCompensation: 3000, // 其它来源重复获得 / 满级补偿铜钱
    // 第 250 关（招募系统开放）首通赠送「关平」，需在结算页领取，存档里记录防止重复领取。
    // 400 关不再赠送武将；张飞改为 7 日登录第 7 天奖励。
    levelHeroRewards: { 250: 'guanping' },

    /* ---- 招募奖池（合计 100%） ---- */
    // 权重表即玩家看到的目标概率；20 抽保底会在内部压低基础传奇率做补偿，
    // 保证大样本实测仍贴合下表（原因见 core/heroes.js 的 solveBaseLegendaryRate）。
    recruit: {
      pool: [
        { id: 'box_common_5', kind: 'box', rarity: 'common', level: 5, weight: 20 },
        { id: 'troop_rare_3', kind: 'troop', rarity: 'rare', level: 3, weight: 15 },
        { id: 'troop_epic_3', kind: 'troop', rarity: 'epic', level: 3, weight: 15 },
        { id: 'troop_legendary_3', kind: 'troop', rarity: 'legendary', level: 3, weight: 10 },
        { id: 'box_common_6', kind: 'box', rarity: 'common', level: 6, weight: 10 },
        { id: 'troop_rare_5', kind: 'troop', rarity: 'rare', level: 5, weight: 10 },
        { id: 'troop_epic_5', kind: 'troop', rarity: 'epic', level: 5, weight: 3 },
        { id: 'troop_legendary_4', kind: 'troop', rarity: 'legendary', level: 4, weight: 2 },
        { id: 'hero_epic', kind: 'hero', tier: 'epic', weight: 10 },
        { id: 'hero_legendary', kind: 'hero', tier: 'legendary', weight: 5 },
      ],
      pity: 20,              // 20 抽必出传奇档（传奇兵或传奇英雄）；自选箱也计入抽数
      // 已拥有英雄的折算（未拥有则直接获得 Lv1）：
      //   史诗英雄 → 3000 铜钱
      //   传奇英雄 → 8000 铜钱 + 1 张招募券
      duplicateHero: {
        epic: { coins: 3000, tickets: 0 },
        legendary: { coins: 8000, tickets: 1 },
      },
    },
  },

  // 初始 4 个兵（4 个兵种各 1 个，5 个格子留 1 个空位承接第 1 关的新兵）
  startArmy: [
    { troop: 'shield', level: 1 },
    { troop: 'archer', level: 1 },
    { troop: 'spear', level: 1 },
    { troop: 'cavalry', level: 1 },
  ],

  /* ============ 合成（等级系统） ============ */
  // 2 个「同兵种 + 同等级」的单位合成 1 个高一级的单位，等级上限 10
  // 合成不消耗铜钱，消耗的是另一个同兵种同级的单位
  // 10 级 = 布衣 → 轻皮甲 → 局部铁片 → 老兵（外观见 render/sprites.js）
  merge: {
    maxLevel: 10,
    need: 2,
  },

  // 按关卡档位的兵种等级上限（防止中期过早拿到高等级特殊兵种把后排射穿）：
  // 100~250 关：稀有兵最高 4 级；200~250 关：史诗兵最高 5 级；250 关后放开
  troopLevelCaps: [
    { rarity: 'rare', fromLevel: 100, untilLevel: 250, cap: 4 },
    { rarity: 'epic', fromLevel: 200, untilLevel: 250, cap: 5 },
  ],

  /* ============ 战斗 ============ */
  battle: {
    defaultSpeed: 2,
    speedUnlockLevel: 10, // 主线 10 关前锁 1 倍速（按钮置灰 + 一句提示）
    attackAnimTime: 0.55, // 单次出手动画时长（1 倍速，秒）
    hitAnimTime: 0.30,
    // 阵亡单位当帧消失，不再保留倒地动画与尸体淡出配置
    // 出手顺序由兵种 order 决定：小 = 先出手
  },

  /* ============ 声音 ============ */
  // 主 BGM（首页 / 战斗 / 大部分页面）= 《战争进化史》(Age of War) 的 Glorious Morning；
  // 商城 BGM = tools/gen-audio.mjs 生成的英雄主题循环（原先的战斗占位曲，现在只在商城播）。
  // 音量在首页「声音」面板里可分别调 BGM / 音效，并写进存档。
  audio: {
    enabled: true,
    bgmVolume: 0.55,   // 默认 BGM 音量（0~1，滑条可调）
    sfxVolume: 0.85,   // 默认音效音量（0~1，滑条可调）
    bgm: {
      main: {
        src: 'assets/audio/glorious_morning.mp3',
        // 真实曲目没放进来时，主 BGM 暂时改用商城循环，避免整场静音
        fallback: 'assets/audio/bgm_heroic_loop.mp3',
      },
      shop: { src: 'assets/audio/bgm_heroic_loop.mp3' },
      loop: true,
    },
    maxVoices: 3,      // 同一个音效最多几路同时播放
    minGapMs: 40,      // 同名音效最短间隔（避免连续点击刷屏）
    // 战斗里同一音效会更密集，单独放宽间隔
    gaps: { slash: 70, arrow: 90, hit: 90, death: 140, poison: 220 },
    sounds: {
      tap: 'assets/audio/sfx/tap.wav',
      place: 'assets/audio/sfx/place.wav',
      withdraw: 'assets/audio/sfx/withdraw.wav',
      merge: 'assets/audio/sfx/merge.wav',
      error: 'assets/audio/sfx/error.wav',
      buy: 'assets/audio/sfx/buy.wav',
      reward: 'assets/audio/sfx/reward.wav',
      chest: 'assets/audio/sfx/chest.wav',
      slash: 'assets/audio/sfx/slash.wav',
      arrow: 'assets/audio/sfx/arrow.wav',
      hit: 'assets/audio/sfx/hit.wav',
      death: 'assets/audio/sfx/death.wav',
      charge: 'assets/audio/sfx/charge.wav',
      poison: 'assets/audio/sfx/poison.wav',
      victory: 'assets/audio/sfx/victory.mp3',
      defeat: 'assets/audio/sfx/defeat.mp3',
    },
  },

  /* ============ 章节（6 章 · 每城 100 关 · 1~2600 关） ============ */
  // 第一章 黄巾风起 1~400 / 第二章 董卓乱京 401~800 / 第三章 群雄逐鹿 801~1200
  // 第四章 赤壁烽火 1201~1700 / 第五章 三分鼎足 1701~2200 / 第六章 天下归晋 2201~2600
  // theme 对应 arenaThemes：每个章节一套战场地形与旗帜。
  chapters: [
    {
      id: 'huangjin',
      name: '第一章 · 黄巾风起',
      theme: 'huangjin',
      cities: [
        {
          name: '涿郡', from: 1, to: 100,
          desc: '黄巾初起 · 普通兵种为主，熟悉合成与基础兵种',
          reward: [{ unit: 'yuanyong', level: 3 }],
        },
        {
          name: '广宗', from: 101, to: 200,
          desc: '张角主力 · 稀有兵种开始登场',
          reward: [{ unit: 'huhao', level: 3 }],
        },
        {
          name: '颍川', from: 201, to: 300,
          desc: '官军围剿黄巾 · 史诗兵种登场',
          reward: [{ chest: 'epic', n: 1 }],
        },
        {
          name: '宛城', from: 301, to: 400,
          desc: '黄巾余部决战 · 传奇兵种登场',
          reward: [],
        },
      ],
      clearReward: [{ chest: 'legendary', n: 1 }],
      nextHint: '下一章：第二章 · 董卓乱京（第 401 关开启）',
    },
    {
      id: 'hulao',
      name: '第二章 · 董卓乱京',
      theme: 'dongzhuo',
      cities: [
        {
          name: '虎牢关', from: 401, to: 500,
          desc: '诸侯讨董 · 重骑守关，枪盾要顶住第一波冲锋',
          reward: [{ chest: 'gold', n: 2 }],
        },
        {
          name: '荥阳', from: 501, to: 600,
          desc: '荥阳鏖战 · 骑兵与弓弩混编，注意切后排',
          reward: [{ chest: 'epic', n: 1 }],
        },
        {
          name: '洛阳城郊', from: 601, to: 700,
          desc: '董卓焚城 · 焦土战场，盾阵与长枪交替',
          reward: [{ chest: 'legendary', n: 1 }],
        },
        {
          name: '函谷关', from: 701, to: 800,
          desc: '西凉铁骑 · 传奇兵种大规模登场',
          reward: [{ chest: 'legendary', n: 1 }],
        },
      ],
      clearReward: [{ chest: 'legendary', n: 2 }],
      nextHint: '下一章：第三章 · 群雄逐鹿（第 801 关开启）',
    },
    {
      id: 'warlords',
      name: '第三章 · 群雄逐鹿',
      theme: 'warlords',
      cities: [
        {
          name: '濮阳', from: 801, to: 900,
          desc: '吕布袭兖州 · 骑兵突袭，前排要能扛住冲阵',
          reward: [{ chest: 'gold', n: 2 }],
        },
        {
          name: '徐州', from: 901, to: 1000,
          desc: '陶谦让徐州 · 弓阵覆盖，考验切后排',
          reward: [{ chest: 'epic', n: 1 }],
        },
        {
          name: '寿春', from: 1001, to: 1100,
          desc: '袁术称帝 · 精英混编，注意兵种克制',
          reward: [{ chest: 'legendary', n: 1 }],
        },
        {
          name: '官渡外围', from: 1101, to: 1200,
          desc: '曹袁对峙 · 高强度混编，正面硬碰硬',
          reward: [{ chest: 'legendary', n: 1 }],
        },
      ],
      clearReward: [{ chest: 'legendary', n: 2 }],
      nextHint: '下一章：第四章 · 赤壁烽火（第 1201 关开启）',
    },
    {
      id: 'chibi',
      name: '第四章 · 赤壁烽火',
      theme: 'chibi',
      cities: [
        {
          name: '新野', from: 1201, to: 1300,
          desc: '刘备驻新野 · 水网边缘的混编遭遇战',
          reward: [{ chest: 'gold', n: 2 }],
        },
        {
          name: '长坂坡', from: 1301, to: 1400,
          desc: '长坂突围 · 骑兵冲阵，阵型容易被撕开',
          reward: [{ chest: 'epic', n: 1 }],
        },
        {
          name: '夏口', from: 1401, to: 1500,
          desc: '孙刘联军 · 弓弩与水军协同',
          reward: [{ chest: 'legendary', n: 1 }],
        },
        {
          name: '乌林', from: 1501, to: 1600,
          desc: '乌林对峙 · 火攻前夜，精英密度明显上升',
          reward: [{ chest: 'legendary', n: 1 }],
        },
        {
          name: '赤壁', from: 1601, to: 1700,
          desc: '赤壁决战 · 火船连营，最终强敌压阵',
          reward: [{ chest: 'legendary', n: 2 }],
        },
      ],
      clearReward: [{ chest: 'legendary', n: 3 }],
      nextHint: '下一章：第五章 · 三分鼎足（第 1701 关开启）',
    },
    {
      id: 'threekingdoms',
      name: '第五章 · 三分鼎足',
      theme: 'threekingdoms',
      cities: [
        {
          name: '荆南四郡', from: 1701, to: 1800,
          desc: '荆南平定 · 山地关口，枪盾推进',
          reward: [{ chest: 'gold', n: 2 }],
        },
        {
          name: '成都', from: 1801, to: 1900,
          desc: '益州归蜀 · 重装步阵，正面消耗',
          reward: [{ chest: 'epic', n: 1 }],
        },
        {
          name: '汉中', from: 1901, to: 2000,
          desc: '汉中之战 · 山道伏击，弓骑轮番上阵',
          reward: [{ chest: 'legendary', n: 1 }],
        },
        {
          name: '樊城', from: 2001, to: 2100,
          desc: '樊城水淹 · 盾阵与弓阵交替',
          reward: [{ chest: 'legendary', n: 1 }],
        },
        {
          name: '江陵', from: 2101, to: 2200,
          desc: '江陵终局 · 三国精锐尽出',
          reward: [{ chest: 'legendary', n: 2 }],
        },
      ],
      clearReward: [{ chest: 'legendary', n: 3 }],
      nextHint: '下一章：第六章 · 天下归晋（第 2201 关开启）',
    },
    {
      id: 'jin',
      name: '第六章 · 天下归晋',
      theme: 'jin',
      cities: [
        {
          name: '夷陵', from: 2201, to: 2300,
          desc: '夷陵之火 · 连营对攻，后排压力极大',
          reward: [{ chest: 'gold', n: 2 }],
        },
        {
          name: '街亭', from: 2301, to: 2400,
          desc: '街亭失守 · 山口遭遇，骑兵切后排',
          reward: [{ chest: 'epic', n: 1 }],
        },
        {
          name: '五丈原', from: 2401, to: 2500,
          desc: '五丈原对峙 · 重装与精英混编',
          reward: [{ chest: 'legendary', n: 1 }],
        },
        {
          name: '洛阳', from: 2501, to: 2600,
          desc: '天下归晋 · 最终决战',
          reward: [{ chest: 'legendary', n: 2 }],
        },
      ],
      clearReward: [{ chest: 'legendary', n: 4 }],
      nextHint: '全六章 2600 关已全部开放',
    },
  ],

  /* ============ 关卡 ============ */
  // 关卡是「公式生成」的：只要改 total 这一个数字，就能继续往上加关（至少上千关）
  // 曲线：第 1 关 3 支小队 → 第 56 关起满编 25 支（5×5 铺满）；敌方等级 400 关爬到 Lv4~5
  // （宝箱只给小木 / 银 / 金，玩家兵种成长比早期版本慢，所以敌军等级上限也压低；
  //   最后的难度墙放在后段，靠挂机收益补）
  levelGen: {
    total: 2600,
    /* ---- 难度曲线（本轮重做） ----
       1) 1~20 关保持原难度：先让玩家学会合成 / 布阵，不劝退。
       2) 21 / 49 两处「卡点」：单关小幅加强 8~10%，故意卡一下，
          提示玩家回头合成升阶、换克制兵种或调整阵型，过完这一关立刻回落到原曲线。
       3) 51 关起逐段抬升：tiers 是「分段表」，每段从 from 关开始用 ramp 关线性过渡到目标倍率，
          50 关后整体加压，150 / 400 / 800 / 1200 / 1700 / 2200 / 2600 逐段抬高，2600 关封顶 2.15。
       4) 卡点与分段倍率叠加时由 maxScale 封顶，避免后期出现离谱的难度墙。
       实现：levelDef 给每支敌军小队挂 statMult（只放大生命 / 攻击，防御不动），
       战场 / 布阵页 / 结算 / 测试共用同一个 difficulty 倍率，口径完全一致。          */
    difficulty: {
      checkpointScale: 1.08, // 卡点在当期基础上再叠一层
      checkpoints: [
        { n: 21, scale: 1.08, label: '校场试阵' },
        { n: 49, scale: 1.10, label: '黄巾屯兵' },
      ],
      maxScale: 2.30,
      /* 阶梯难度（参数化分段表，不写死 2600 条）：
         from = 该段起始关；scale = 该段目标倍率；ramp = 从上一段过渡到本段所需关数。
         最后一段（2600）直接取目标值，保证终章落在 2.15。 */
      tiers: [
        { from: 30, scale: 1.10, ramp: 21 }, // 前期加压：30 关起逐关抬，50 关到 +10% 后与下一段接上
        { from: 51, scale: 1.10, ramp: 10 },
        { from: 150, scale: 1.18, ramp: 10 },
        { from: 400, scale: 1.30, ramp: 20 },
        { from: 800, scale: 1.45, ramp: 20 },
        { from: 1200, scale: 1.62, ramp: 20 },
        { from: 1700, scale: 1.80, ramp: 20 },
        { from: 2200, scale: 1.98, ramp: 20 },
        { from: 2600, scale: 2.15, ramp: 20 },
      ],
    },
    /* 英雄 BOSS 关卡：150 关起每 10 关一次（150/160/…/2600，共 246 关）。
       BOSS 英雄等级 = levelBase + floor((n - from) / levelStep)，封顶 levelCap；
       数量按 countTiers 递增（800 关起 2 名、1700 关起 3 名）；
       血量倍率从 hpMultFrom 线性升到 hpMultTo，避免后期数值墙一刀切。 */
    heroBoss: {
      from: 150,
      every: 10,
      levelBase: 3,
      levelStep: 100,
      levelCap: 30,
      hpMultFrom: 1.8,
      hpMultTo: 3.2,
      heroScale: 1.3,
      countTiers: [{ from: 800, count: 2 }, { from: 1700, count: 3 }],
      pool: [
        'guanping', 'zhangren', 'huanggai', 'liru', 'zhangjiao', 'xiahouyuan',
        'zhangfei', 'guanyu', 'liubei', 'caocao', 'zhouyu', 'dongzhuo',
      ],
    },
    // 敌方等级曲线：锚点之间线性插值，允许小数（整数部分 = 小队等级，小数部分 = 这一关
    // 有多少比例的小队升 1 级）。1~800 关沿用旧曲线；801 关之后每章缓慢抬升，
    // 2600 关约 Lv8.5，配合精英比例提升难度，不靠把等级硬拉到上限。
    levelAnchors: [
      { n: 1, level: 1.0 },
      // 新手期（9~50 关）整体压平：第 9 关回到纯 Lv1，第 50 关只到 1.85（原来 2.0）
      { n: 9, level: 1.0 },
      { n: 50, level: 1.85 },
      { n: 80, level: 2.40 },
      { n: 100, level: 2.95 },
      { n: 120, level: 3.55 },
      { n: 140, level: 3.80 },
      { n: 150, level: 3.95 },
      { n: 160, level: 4.00 },
      { n: 200, level: 4.20 },
      { n: 250, level: 4.30 },
      { n: 300, level: 4.35 },
      { n: 400, level: 4.35 },
      // 第二章：敌方等级缓慢抬升（4.40 → 5.30），难度主要靠精英构成与数量
      { n: 450, level: 4.50 },
      { n: 500, level: 4.60 },
      { n: 600, level: 4.85 },
      { n: 700, level: 5.10 },
      { n: 800, level: 5.30 },
      // 第三章~第六章：每 100 关约 +0.12 级，2600 关收在 Lv7.6（不再陡增）
      { n: 900, level: 5.42 },
      { n: 1000, level: 5.55 },
      { n: 1100, level: 5.68 },
      { n: 1200, level: 5.80 },
      { n: 1300, level: 5.95 },
      { n: 1400, level: 6.08 },
      { n: 1500, level: 6.20 },
      { n: 1600, level: 6.32 },
      { n: 1700, level: 6.45 },
      { n: 1800, level: 6.58 },
      { n: 1900, level: 6.70 },
      { n: 2000, level: 6.82 },
      { n: 2100, level: 6.95 },
      { n: 2200, level: 7.08 },
      { n: 2300, level: 7.20 },
      { n: 2400, level: 7.32 },
      { n: 2500, level: 7.45 },
      { n: 2600, level: 7.60 },
    ],
    // 第 140 关要显示 Lv3~5：这一段允许部分小队一次多升 2 级（其余关卡最多 +1 级）
    levelSpreadRanges: [
      { from: 136, to: 140, spread: 2 },
    ],
    enemiesBase: 3,       // 第 1 关敌军小队数（少于玩家的 4 支，首战好过）
    enemiesPerLevel: 0.40, // 第 1~56 关按这个速度涨到 25 支
    enemiesMax: 25,
    // 第 56 关之后小队数微调：第 100 关压到 23 支，避免 Lv3 起步时总战力超过 20,000；
    // 第 120 关恢复到 25 支，后面保持满编
    enemyCountAnchors: [
      // 新手期（9~50 关）下调队数：9→5、15→6、25→9、35→12、50→16，
      // 之后再缓慢回升到满编 25，避免第 50→56 关出现陡升
      { n: 9, count: 5 },
      { n: 15, count: 6 },
      { n: 25, count: 9 },
      { n: 35, count: 12 },
      { n: 50, count: 17 },
      { n: 65, count: 18 },
      { n: 80, count: 21 },
      { n: 100, count: 23 },
      { n: 120, count: 25 },
      { n: 400, count: 25 },
      { n: 800, count: 25 },
    ],
    patterns: [
      ['shield', 'archer', 'spear', 'cavalry', 'shield'],
      ['archer', 'spear', 'cavalry', 'shield', 'archer'],
      ['spear', 'cavalry', 'shield', 'archer', 'spear'],
      ['cavalry', 'shield', 'archer', 'spear', 'cavalry'],
      ['shield', 'spear', 'archer', 'cavalry', 'shield'],
      ['archer', 'cavalry', 'spear', 'shield', 'archer'],
    ],
    // 第二章专属阵型：骑兵线明显加重（西凉铁骑 / 虎牢重骑），配合枪盾与后排弓弩
    chapter2Patterns: [
      ['cavalry', 'cavalry', 'spear', 'archer', 'shield'],
      ['shield', 'spear', 'cavalry', 'cavalry', 'archer'],
      ['cavalry', 'archer', 'shield', 'spear', 'cavalry'],
      ['spear', 'shield', 'archer', 'cavalry', 'cavalry'],
      ['archer', 'cavalry', 'shield', 'cavalry', 'spear'],
    ],
    // 第三~六章阵型：按章节 id 取（没配的章节回落到第二章阵型）
    chapterPatterns: {
      warlords: [
        ['shield', 'spear', 'archer', 'cavalry', 'shield'],
        ['spear', 'archer', 'shield', 'cavalry', 'spear'],
        ['archer', 'shield', 'spear', 'cavalry', 'archer'],
        ['cavalry', 'spear', 'shield', 'archer', 'cavalry'],
        ['shield', 'archer', 'spear', 'shield', 'cavalry'],
      ],
      chibi: [
        ['archer', 'archer', 'spear', 'shield', 'cavalry'],
        ['shield', 'spear', 'archer', 'archer', 'shield'],
        ['spear', 'shield', 'archer', 'cavalry', 'archer'],
        ['archer', 'spear', 'shield', 'archer', 'spear'],
        ['cavalry', 'archer', 'spear', 'shield', 'archer'],
      ],
      threekingdoms: [
        ['shield', 'spear', 'shield', 'archer', 'cavalry'],
        ['spear', 'shield', 'archer', 'spear', 'cavalry'],
        ['cavalry', 'shield', 'spear', 'archer', 'shield'],
        ['archer', 'spear', 'shield', 'cavalry', 'spear'],
        ['shield', 'cavalry', 'archer', 'spear', 'shield'],
      ],
      jin: [
        ['cavalry', 'shield', 'spear', 'archer', 'cavalry'],
        ['shield', 'spear', 'cavalry', 'archer', 'shield'],
        ['spear', 'cavalry', 'shield', 'archer', 'spear'],
        ['archer', 'shield', 'spear', 'cavalry', 'archer'],
        ['cavalry', 'spear', 'shield', 'archer', 'cavalry'],
      ],
    },
    // 特殊兵种登场：按关卡把一部分敌军小队换成本品级的特殊兵种（同一条兵种线替换，
    // 克制 / 射程 / 站位都不变，只是属性更强、战法更多）。
    // from   = 从第几关开始出现（涿郡 1~100 普通 / 广宗 101+ 稀有 / 颍川 201+ 史诗 / 宛城 301+ 传奇）
    // base   = 起始关的替换比例；perLevel = 每关再涨多少；cap = 比例封顶
    // 判定顺序从高品级往低，同一支小队只会被替换一次
    // 本轮：压平章节边界（101~400 精英比例下调、后段传奇占比回落），难度按关卡平滑上升
    specialTiers: [
      { rarity: 'rare', from: 101, to: 400, base: 0.04, perLevel: 0.0006, cap: 0.10 },
      { rarity: 'epic', from: 201, to: 400, base: 0.02, perLevel: 0.0004, cap: 0.07 },
      { rarity: 'legendary', from: 301, to: 400, base: 0.005, perLevel: 0.00015, cap: 0.03 },
      // 第二章（401~800）：精英比例整体再上一档，传奇兵种明显增多（章节感）
      { rarity: 'rare', from: 401, to: 800, base: 0.14, perLevel: 0.0002, cap: 0.22 },
      { rarity: 'epic', from: 401, to: 800, base: 0.12, perLevel: 0.00016, cap: 0.20 },
      { rarity: 'legendary', from: 401, to: 800, base: 0.04, perLevel: 0.00012, cap: 0.09 },
      // 第三章 群雄逐鹿（801~1200）
      { rarity: 'rare', from: 801, to: 1200, base: 0.22, perLevel: 0.0001, cap: 0.26 },
      { rarity: 'epic', from: 801, to: 1200, base: 0.20, perLevel: 0.0001, cap: 0.24 },
      { rarity: 'legendary', from: 801, to: 1200, base: 0.10, perLevel: 0.0001, cap: 0.14 },
      // 第四章 赤壁烽火（1201~1700）
      { rarity: 'rare', from: 1201, to: 1700, base: 0.26, perLevel: 0.00008, cap: 0.30 },
      { rarity: 'epic', from: 1201, to: 1700, base: 0.24, perLevel: 0.00008, cap: 0.28 },
      { rarity: 'legendary', from: 1201, to: 1700, base: 0.14, perLevel: 0.00008, cap: 0.18 },
      // 第五章 三分鼎足（1701~2200）：传奇占比回落，避免后段只靠高等级传奇堆难度
      { rarity: 'rare', from: 1701, to: 2200, base: 0.26, perLevel: 0.00008, cap: 0.30 },
      { rarity: 'epic', from: 1701, to: 2200, base: 0.22, perLevel: 0.00008, cap: 0.26 },
      { rarity: 'legendary', from: 1701, to: 2200, base: 0.12, perLevel: 0.00008, cap: 0.16 },
      // 第六章 天下归晋（2201~2600）
      { rarity: 'rare', from: 2201, base: 0.28, perLevel: 0.00008, cap: 0.32 },
      { rarity: 'epic', from: 2201, base: 0.24, perLevel: 0.00008, cap: 0.28 },
      { rarity: 'legendary', from: 2201, base: 0.14, perLevel: 0.00008, cap: 0.18 },
    ],
    // 传奇特殊兵种等级封顶：按章节逐步放开；相邻章节的封顶对齐，避免章节边界突然跳 1 级
    legendaryLevelCap: [
      { upTo: 400, level: 4 },
      { upTo: 800, level: 6 },
      { upTo: 1200, level: 6 },
      { upTo: 1700, level: 8 },
      { upTo: 2200, level: 8 },
      { upTo: 2600, level: 8 },
    ],
  },

  /* ============ 自动战斗 / 广告 ============ */
  autoBattle: { unlockLevel: 3 },
  // 三个独立的每日广告额度，各自跨天重置：
  //   - shopWood: 商店看广告领小木箱，每天 5 次，每次 1 个
  //   - shopSilver: 商店看广告领银箱，每天 2 次，每次 1 个
  //   - coin: 失败页看广告领铜钱，每天 10 次（200关内2000 / 201关后4000）
  ads: {
    shopWoodLimit: 5,
    shopSilverLimit: 2,
    coinLimit: 10,
    troopLimit: 10,         // 战败页「看广告立即得兵」每天次数
    // 战败页广告得兵的关卡档位（rarity='rare' 时若该稀有兵未解锁，回退到 common 档）
    // 与宝箱等级节奏对齐：只在 400 / 800 两个节点升级，200~399 不再提前放稀有 / 高级普通兵
    defeatTroopTiers: [
      { maxLevel: 150, commonLevel: 1 },
      { maxLevel: 399, commonLevel: 2 },
      { maxLevel: 799, rareLevel: 1, commonLevel: 2 },
      { maxLevel: 2600, rareLevel: 2, commonLevel: 3 },
    ],
    coinLow: 2000,          // 1~200 关失败时的广告铜钱
    coinHigh: 4000,         // 201~400 关失败时的广告铜钱
    highAfterLevel: 200,    // 超过这个关卡用 coinHigh
    // 商店广告宝箱：两个独立通道，各自独立计数
    shopOffers: [
      { id: 'ad-wood', chest: 'wood', count: 1, limitKey: 'shopWood', name: '小木箱 ×1' },
      { id: 'ad-silver', chest: 'silver', count: 1, limitKey: 'shopSilver', name: '银箱 ×1' },
    ],
  },

  /* ============ 演武（150 关后解锁，每 10 关开一关） ============ */
  // 演武：200 关。关号 → 主线对标关号线性映射（150 → 2600），
  // 1~50 关保留手写关卡，51~200 关按对标主线关的有效战力生成，终点与主线终章等强。
  trials: {
    unlockLevel: 150,
    every: 10,            // 兼容旧字段；实际解锁关号走 trials.js 的 trialMainLevel()
    total: 200,
    endLevel: 2600,      // 第 200 关对标主线终章第 2600 关
    // 首次通关每关 1 个黄金宝箱；里程碑额外 1 个传奇宝箱
    goldEveryStage: true,
    legendaryAt: [10, 20, 25, 30, 40, 50, 75, 100, 125, 150, 175, 200],
  },

  // 英雄战：主线 250 关后开放，共 150 关；每 10 关首通 1 张招募券
  // （招募券主来源仍为主线 200 关后每 10 关 1 张，英雄战作为额外来源）
  // 第 150 关为最终战：刘备 / 关羽 / 张飞三英雄同时登场。
  heroBattles: {
    unlockLevel: 250,
    total: 150,
    scrollEvery: 10,
    hpMultMin: 5,
    hpMultMax: 24,
  },

  /* ============ 过 5 关斩 6 将（主线 200 关后开放，共 12 章 60 关） ============ */
  // 每章 5 关 / 6 名敌将（前 4 关各 1 名，第 5 关 2 名）。
  // 难度曲线：章节峰值从 1.87 万按幂曲线平滑抬到主线 2600 终章（≈ 23.1 万），
  // 章内 5 关按 stageFactor 严格递增；用 statMult / difficulty 校准，只升不降，不削弱既有章节。
  gauntlet: {
    unlockLevel: 200,
    stagesPerChapter: 5,
    curve: {
      startPeak: 18721,
      endPeak: 231192,
      stageFactor: [0.78, 0.83, 0.88, 0.94, 1.0],
    },
    // 每天只能领 1 次通关奖励；章节首通额外给自选卡包（难度越高品级 / 等级越高）
    dailyCoins: 3000,
    dailyChest: 'silver',
    chapters: [
      {
        id: 'sishui', name: '汜水关', theme: 'huangjin',
        rarity: 'common', boxLevel: 2, firstClearCoins: 2000,
        generals: ['zhangjiao', 'liru', 'guanping', 'xiahouyuan', 'zhangren', 'huanggai'],
        bossLevel: 1, bossHpMult: 2,
        guards: ['qingzhou', 'baier'], guardLevel: 3, guardSquads: 4,
      },
      {
        id: 'hulao', name: '虎牢关', theme: 'dongzhuo',
        rarity: 'rare', boxLevel: 2, firstClearCoins: 5000,
        generals: ['huanggai', 'xiahouyuan', 'zhangren', 'guanping', 'liru', 'zhangjiao'],
        bossLevel: 2, bossHpMult: 2,
        guards: ['xianzhen', 'tengjia'], guardLevel: 4, guardSquads: 5,
      },
      {
        id: 'luoyang', name: '洛阳', theme: 'dongzhuo',
        rarity: 'epic', boxLevel: 2, firstClearCoins: 12000,
        generals: ['liru', 'zhangjiao', 'guanping', 'huanggai', 'xiahouyuan', 'zhangren'],
        bossLevel: 3, bossHpMult: 4,
        guards: ['tengjia', 'wudang'], guardLevel: 5, guardSquads: 5,
      },
      {
        id: 'changan', name: '长安', theme: 'warlords',
        rarity: 'epic', boxLevel: 4, firstClearCoins: 20000,
        generals: ['zhangfei', 'huanggai', 'zhangren', 'guanping', 'zhouyu', 'dongzhuo'],
        bossLevel: 3, bossHpMult: 3,
        guards: ['xianzhen', 'yuanyong'], guardLevel: 6, guardSquads: 6,
      },
      {
        id: 'wancheng', name: '宛城', theme: 'chibi',
        rarity: 'legendary', boxLevel: 2, firstClearCoins: 35000,
        generals: ['guanyu', 'zhangren', 'huanggai', 'guanping', 'zhangfei', 'zhouyu'],
        bossLevel: 4, bossHpMult: 4,
        guards: ['huhao', 'daji'], guardLevel: 7, guardSquads: 6,
      },
      {
        id: 'tianxia', name: '天下', theme: 'threekingdoms',
        rarity: 'legendary', boxLevel: 4, firstClearCoins: 50000,
        generals: ['liubei', 'caocao', 'guanyu', 'zhangfei', 'zhouyu', 'dongzhuo'],
        bossLevel: 5, bossHpMult: 4,
        guards: ['huhao', 'baima'], guardLevel: 8, guardSquads: 7,
      },
      // ===== 后 6 章：难度继续沿幂曲线抬到主线终章强度 =====
      {
        id: 'guandu', name: '官渡', theme: 'warlords',
        rarity: 'legendary', boxLevel: 6, firstClearCoins: 70000,
        generals: ['caocao', 'zhangren', 'xiahouyuan', 'guanping', 'huanggai', 'zhouyu'],
        bossLevel: 6, bossHpMult: 5,
        guards: ['huhao', 'baima'], guardLevel: 9, guardSquads: 7,
      },
      {
        id: 'chibi', name: '赤壁', theme: 'chibi',
        rarity: 'legendary', boxLevel: 7, firstClearCoins: 95000,
        generals: ['zhouyu', 'huanggai', 'caocao', 'guanyu', 'liru', 'zhangfei'],
        bossLevel: 7, bossHpMult: 5,
        guards: ['yuanyong', 'wudang'], guardLevel: 10, guardSquads: 7,
      },
      {
        id: 'hanzhong', name: '汉中', theme: 'threekingdoms',
        rarity: 'legendary', boxLevel: 8, firstClearCoins: 125000,
        generals: ['liubei', 'zhangfei', 'xiahouyuan', 'guanyu', 'dongzhuo', 'zhouyu'],
        bossLevel: 8, bossHpMult: 6,
        guards: ['xianzhen', 'daji'], guardLevel: 10, guardSquads: 8,
      },
      {
        id: 'yiling', name: '夷陵', theme: 'chibi',
        rarity: 'legendary', boxLevel: 9, firstClearCoins: 160000,
        generals: ['liubei', 'guanyu', 'zhangfei', 'zhouyu', 'caocao', 'huanggai'],
        bossLevel: 9, bossHpMult: 6,
        guards: ['tengjia', 'xiandeng'], guardLevel: 10, guardSquads: 8,
      },
      {
        id: 'wuzhangyuan', name: '五丈原', theme: 'threekingdoms',
        rarity: 'legendary', boxLevel: 10, firstClearCoins: 200000,
        generals: ['caocao', 'zhouyu', 'guanyu', 'liubei', 'zhangfei', 'dongzhuo'],
        bossLevel: 10, bossHpMult: 7,
        guards: ['baima', 'huhao'], guardLevel: 10, guardSquads: 8,
      },
      {
        id: 'guijin', name: '天下归晋', theme: 'threekingdoms',
        rarity: 'legendary', boxLevel: 10, firstClearCoins: 260000,
        generals: ['liubei', 'caocao', 'guanyu', 'zhangfei', 'zhouyu', 'dongzhuo'],
        bossLevel: 10, bossHpMult: 8,
        guards: ['daji', 'wudang'], guardLevel: 10, guardSquads: 9,
      },
    ],
  },

  /* ============ 宝箱 ============ */
  // 常规箱：小木箱 → 银箱 → 金箱 → 铂金箱 → 玄玉箱（铂金 / 玄玉保留到第二章之后再开放）
  // 特殊箱：稀有 / 史诗 / 传奇（必出本品级兵种，Lv1 60% / Lv2 40%）
  // 每个宝箱的 drops 按顺序累计概率：先判高等级，剩下的概率给最后一个
  chests: {
    regularOrder: ['wood', 'silver', 'gold', 'platinum', 'jade'],
    specialOrder: ['rare', 'epic', 'legendary'],
    types: {
      wood: {
        id: 'wood',
        name: '小木箱',
        desc: '80% 1~2 级普通兵（Lv1/Lv2 各 40%）/ 20% 稀有 Lv1',
        color: '#a98539',
        drops: [
          { rarity: 'common', level: 2, chance: 0.4 },
          { rarity: 'common', level: 1, chance: 0.4 },
          { rarity: 'rare', level: 1, chance: 0.2 },
        ],
      },
      silver: {
        id: 'silver',
        name: '银箱',
        desc: '40% 普通 Lv2~3 / 40% 稀有 Lv1~2 / 20% 史诗 Lv1',
        color: '#b9c4d0',
        drops: [
          { rarity: 'common', level: 3, chance: 0.2 },
          { rarity: 'common', level: 2, chance: 0.2 },
          { rarity: 'rare', level: 2, chance: 0.2 },
          { rarity: 'rare', level: 1, chance: 0.2 },
          { rarity: 'epic', level: 1, chance: 0.2 },
        ],
      },
      gold: {
        id: 'gold',
        name: '金箱',
        desc: '30% 稀有 Lv2~3 / 40% 史诗 Lv1~2 / 30% 传奇 Lv1',
        color: '#e0b95f',
        drops: [
          { rarity: 'rare', level: 3, chance: 0.15 },
          { rarity: 'rare', level: 2, chance: 0.15 },
          { rarity: 'epic', level: 2, chance: 0.2 },
          { rarity: 'epic', level: 1, chance: 0.2 },
          { rarity: 'legendary', level: 1, chance: 0.3 },
        ],
      },
      // 后两档只做占位：前 400 关不会掉，留给第二章之后的高关
      platinum: {
        id: 'platinum',
        name: '铂金箱',
        desc: '第二章之后开放',
        color: '#cfd6de',
        locked: true,
        drops: [],
      },
      jade: {
        id: 'jade',
        name: '玄玉箱',
        desc: '古玉重宝 · 更高一档，后续版本开放',
        color: '#3f7369',
        locked: true,
        drops: [],
      },
      rare: {
        id: 'rare',
        name: '稀有宝箱',
        desc: '必出稀有兵种（Lv1 60% / Lv2 40%）',
        color: '#4a6b82',
        drops: [
          { rarity: 'rare', level: 2, chance: 0.4 },
          { rarity: 'rare', level: 1, chance: 0.6 },
        ],
      },
      epic: {
        id: 'epic',
        name: '史诗宝箱',
        desc: '必出史诗兵种（Lv1 60% / Lv2 40%）',
        color: '#6f5b7d',
        drops: [
          { rarity: 'epic', level: 2, chance: 0.4 },
          { rarity: 'epic', level: 1, chance: 0.6 },
        ],
      },
      legendary: {
        id: 'legendary',
        name: '传奇宝箱',
        desc: '必出传奇兵种（Lv1 60% / Lv2 40%）',
        color: '#d8b46a',
        drops: [
          { rarity: 'legendary', level: 2, chance: 0.4 },
          { rarity: 'legendary', level: 1, chance: 0.6 },
        ],
      },
    },
    // 宝箱兵种等级加成：只在 400 / 800 关两个节点升级（原 200 关档位取消）
    // 400 关：+1 级；800 关：再 +1（累计 +2）。前期不再提前放大高级兵产出。
    levelBonusByClear: [
      { minLevel: 800, bonus: 2 },
      { minLevel: 400, bonus: 1 },
    ],
    // 关卡宝箱发放（可以一关拿多个）：
    // - 400 关前：第 1 关 + 每 5 关 1 小木箱；每 20 关银箱；每 50 关金箱
    //   例外：第 5 关改为「幽州突骑驰援」剧情关，不产出任何宝箱
    // - 400 关起：每 5 关银箱；每 20 关金箱（原 200 关的升级节点后移到 400）
    // - 800 关起：每 5 关金箱（第二个升级节点）
    levelChests: (n) => {
      const out = [];
      if (n >= 800) {
        if (n % 5 === 0) out.push('gold');
        return out;
      }
      if (n >= 400) {
        if (n % 5 === 0) out.push('silver');
        if (n % 20 === 0) out.push('gold');
        return out;
      }
      // 第 5 关是幽州突骑支援剧情关：以剧情代替宝箱奖励
      if ((n === 1 || n % 5 === 0) && n !== 5) out.push('wood');
      if (n % 20 === 0) out.push('silver');
      if (n % 50 === 0) out.push('gold');
      return out;
    },
  },

  /* ============ 每日任务 / 签到 / 7 日登录 ============ */
  // 通关 30 关后开放；每日任务产出以稀有宝箱为主（少量铜钱作为辅助奖励）
  daily: {
    unlockLevel: 30,
    tasks: [
      { id: 'clear', name: '通关 10 关', need: 10, chest: 'rare', coins: 0 },
      { id: 'merge', name: '合成 3 个兵种', need: 3, chest: 'rare', coins: 0 },
      { id: 'open', name: '开启 3 个宝箱', need: 3, chest: 'rare', coins: 0 },
      { id: 'sign', name: '每日签到', need: 1, chest: null, coins: 0 },
    ],
    signInChest: 'rare',
    // 7 日登录（50 关解锁）：顺延领取，漏登不清零；已拥有的英雄折算 3 万铜钱
    login7: {
      dupHeroCoins: 30000,
      days: [
        { name: '史诗宝箱 ×1', kind: 'chest', chest: 'epic', n: 1 },
        { name: '传奇宝箱 ×1', kind: 'chest', chest: 'legendary', n: 1 },
        { name: '黄 盖', kind: 'hero', hero: 'huanggai', dupCoins: 30000 },
        { name: '10 万铜钱', kind: 'coins', coins: 100000 },
        { name: '传奇宝箱 ×3', kind: 'chest', chest: 'legendary', n: 3 },
        { name: '白马义从', kind: 'unit', troop: 'baima', level: 6 },
        { name: '张 飞', kind: 'hero', hero: 'zhangfei', dupCoins: 30000 },
      ],
    },
  },

  /* ============ 稀有度 ============ */
  // 普通 → 稀有 → 史诗 → 传奇 → 英雄（武将）。
  // 特殊兵种在 troops 里标一个 rarity，兵牌边框 / 宝箱 / 详情页都按这个配色走。
  rarity: {
    common: { name: '普通', color: '#8c9199' },
    rare: { name: '稀有', color: '#4a6b82' },
    epic: { name: '史诗', color: '#6f5b7d' },
    legendary: { name: '传奇', color: '#b3934f' },
    hero: { name: '英雄', color: '#c0554f' },
  },
  // 特殊兵种相对「同兵种线普通兵」的属性倍率（只影响 1 级基础值，成长率沿用基础兵种）
  // 平衡目标：1 级传奇 ≈ 3 级史诗 ≈ 5~7 级稀有 / 8 级普通（单兵口径，含战法常驻倍率 / 毒伤）。
  // 倍率直接由目标反推：基础兵 1→8 级战力约 ×2.83、1→6 级约 ×1.23、1→3 级约 ×1.85，
  // 所以是传奇 2.83 / 史诗 1.85 / 稀有 1.23；被战法拉偏的兵种再用 SPECIAL_TROOPS[].statMult 拉回。
  rarityStats: {
    common: 1,
    rare: 1.23,
    epic: 1.85,
    legendary: 2.83,
  },

  /* ============ 兵种 ============ */
  // 每级成长系数：10 级封顶。血 +28% / 攻 +25% / 防 +10%
  // （1→10 级约 ×3.52 / ×3.25 / ×1.9）
  // 本轮平衡：防御整体下调、血量整体上调，让「防御」只提供小幅相对减伤，
  // 不再出现「攻击 - 防御 ≤ 0 → 只扣 1 点」的死区。弓兵血量涨幅明显小于其他三线（保持脆皮）。
  // 伤害公式：max(1, 攻击 - 防御) × 克制系数
  // tiers 对应 Lv1~Lv10，命名跟着装备走（布衣 → 皮甲 → 铁片甲 → 老兵）
  troops: [
    {
      id: 'shield', name: '盾兵', order: 4, hue: 205,
      // 盾兵整体更「肉」：高血量、低攻击。防御从 8 → 4（减半），血量 112 → 190（+70%）。
      role: '高血量、低防御、低攻击。职责是扛伤害，克制弓兵。',
      base: { hp: 190, atk: 12, def: 4 },
      growth: { hp: 0.28, atk: 0.25, def: 0.10 },
      anim: { idle: 2, attack: 3, hit: 2, death: 2 },
      tiers: ['布衣盾卒', '箍盾兵', '皮甲盾手', '铆钉盾卫', '短刀盾卫',
        '护肩守卒', '暗铜大盾', '铁片甲士', '重盾锐士', '铁盾老兵'],
    },
    {
      id: 'archer', name: '弓兵', order: 2, hue: 35,
      role: '高攻击、低血量、低防御；远程输出，克制枪兵。弓箭伤害整体 ×0.5（本轮平衡）。',
      // 弓兵保持脆皮：血量 60 → 78（仅 +30%，远小于其他线的 +70%），防御 6 → 3。
      base: { hp: 78, atk: 25, def: 3 },
      growth: { hp: 0.28, atk: 0.25, def: 0.10 },
      anim: { idle: 2, attack: 4, hit: 2, death: 2 },
      tiers: ['布衣弓手', '负箭袋弓手', '轻甲弓手', '木弓手', '满弦弓手',
        '铁片甲弓手', '铜饰弓手', '重箭袋弓士', '护臂弓士', '老兵弓手'],
    },
    {
      id: 'spear', name: '枪兵', order: 3, hue: 155,
      role: '攻击与血量均衡、刺击距离略长。克制骑兵；所有枪兵线都「抵御冲锋」。',
      // 血量 85 → 150（+76%），防御 7 → 4；枪兵是骑兵冲锋的正面答案。
      base: { hp: 150, atk: 21, def: 4 },
      growth: { hp: 0.28, atk: 0.25, def: 0.10 },
      anim: { idle: 2, attack: 3, hit: 2, death: 2 },
      tiers: ['布衣枪卒', '箍头枪卒', '皮甲枪手', '铁头枪手', '护肩枪兵',
        '绑腿枪兵', '红缨枪士', '铁片甲枪士', '臂甲长枪', '老兵铁枪'],
    },
    {
      id: 'cavalry', name: '骑兵', order: 1, hue: 352,
      role: '攻击和血量中等、机动优先。冲阵切后排，克制盾兵；普通骑兵也带冲锋。',
      // 血量 80 → 140（+75%），防御 7 → 4；普通骑兵获得弱化版冲锋（见 traits.js）。
      base: { hp: 140, atk: 22, def: 4 },
      growth: { hp: 0.28, atk: 0.25, def: 0.10 },
      anim: { idle: 2, attack: 3, hit: 2, death: 2 },
      tiers: ['轻装骑兵', '皮甲骑手', '鞍辔轻骑', '皮胸马甲骑', '肩甲骑兵',
        '铁扣马具骑', '长刀突骑', '覆腹铁骑', '精锐铁骑', '老兵铁骑'],
    },
  ],

  // 兵种克制环：盾 → 弓 → 枪 → 骑 → 盾
  // 克制方 ×1.2，被克制方 ×0.85：同强度单挑优势 = 1.2 / 0.85 ≈ 1.41×。
  // 取值依据：稀有品级差 1.23× < 1.41× < 史诗品级差 1.85×，
  // 也就是「克对兵种」能吃掉半级品级差（稀有→史诗半级约 1.36×），但吃不掉一整级，
  // 克制不再是唯一解（不会盖过品级，也不会让同品级内战失去意义）。
  counters: [
    { attacker: 'shield', defender: 'archer', mult: 1.2 },
    { attacker: 'archer', defender: 'shield', mult: 0.85 },
    { attacker: 'archer', defender: 'spear', mult: 1.2 },
    { attacker: 'spear', defender: 'archer', mult: 0.85 },
    { attacker: 'spear', defender: 'cavalry', mult: 1.2 },
    { attacker: 'cavalry', defender: 'spear', mult: 0.85 },
    { attacker: 'cavalry', defender: 'shield', mult: 1.2 },
    { attacker: 'shield', defender: 'cavalry', mult: 0.85 },
  ],
};

// 文字化的克制链说明，用于 UI 展示
export const COUNTER_CHAIN = ['shield', 'archer', 'spear', 'cavalry']; // 盾 → 弓 → 枪 → 骑 → 盾

/* ============ 特殊兵种（稀有 / 史诗 / 传奇） ============ */
// 每个特殊兵种 = 「同一条兵种线」的换皮精英：
// 沿用基础兵种的出手顺序、动画帧数、射程 / 速度 / 攻击间隔、克制关系、10 档装备节奏；
// 只改三件事：① 1 级基础属性（按 rarityStats 放大）② 名字与外观识别点（style / palette）③ 小队人数（可覆盖）。
// 建模原则（省钱）：每个兵种只做 1~2 个记忆点，升级只加配件、不重做模型（见 render/sprites.js 的 style* 分支）。

// 10 级名称后缀（去掉 Lv1 的本名后剩 9 个，凑满 10 档）
const SPECIAL_GEAR = {
  spear: ['箍头', '皮甲', '铁头', '护肩', '绑腿', '红缨', '铁甲', '臂甲', '老兵'],
  shield: ['箍盾', '皮甲', '铆钉', '短刀', '护肩', '暗铜', '铁片', '重盾', '老兵'],
  archer: ['箭袋', '轻甲', '木弓', '满弦', '铁片', '铜饰', '重箭', '护臂', '老兵'],
  cavalry: ['皮甲', '鞍辔', '皮胸', '肩甲', '马具', '长刀', '覆腹', '精锐', '老兵'],
};

// style 是渲染层认的「识别点」，palette 是配色覆盖（缺省项沿用基础兵种的等级配色）
const SPECIAL_TROOPS = [
  // ---- 枪兵线 ----
  {
    id: 'qingzhou', name: '青州兵', base: 'spear', rarity: 'rare', style: 'qingzhou',
    role: '黄巾归降的青州兵：土赭布衣、背后铺盖卷、麻绳腰带，靠人数堆。',
    scale: 0.94,                                   // 单个体型略小
    squad: { base: 5, max: 10, levels: [2, 4, 6, 8, 9] }, // 人多（Lv1 就 5 个兵，满级 10）
    // 平衡：稀有倍率下调到 1.23 后，5→10 的编制要维持「队总量 ≈ 同线史诗」，单兵血量压到 ×0.93
    // （单兵回到稀有带 Lv5~6，满级队总量与白毦兵基本持平）
    statMult: { hp: 0.93 },
    palette: { accent: '#a98539' },                // 黄巾褐包头
  },
  {
    id: 'baier', name: '白毦兵', base: 'spear', rarity: 'epic', style: 'baier',
    role: '蜀系精锐：两侧白毦、藏青衬袍、白札甲，小白圆盾。',
    palette: {
      primary: 'hsl(148, 17%, 30%)', dark: 'hsl(150, 19%, 18%)', light: 'hsl(148, 16%, 47%)',
      accent: '#eff2f0',                           // 白毦 / 白缨
    },
  },
  {
    id: 'daji', name: '大戟士', base: 'spear', rarity: 'legendary', style: 'daji',
    role: '袁绍麾下重装：青灰宽肩、尖顶锥盔、超长重型大戟。',
    // 平衡（1.2.5）：重甲摧锋 +10%~+40%（原 +40%~+90% 太离谱，Lv10 队秒伤 5.42 → 3.99），
    // 仍高于其他传奇（≈2.85）但不再一骑绝尘；statMult 0.88 保持不动。
    statMult: { hp: 0.88, atk: 0.88, def: 0.88 },
    palette: {
      iron: 'hsl(212, 10%, 62%)', ironDark: 'hsl(214, 13%, 33%)', accent: '#c8a15a',
    },
  },
  // ---- 盾兵线 ----
  {
    id: 'xiandeng', name: '先登死士', base: 'shield', rarity: 'rare', style: 'xiandeng',
    role: '麴义先登：炭黑短皮甲、红布带、窄长黑盾（红竖线）；开战 1 秒后绕到敌军最后一排身后。',
    palette: { accent: '#8a3a30' },                // 盾沿暗红漆
  },
  {
    id: 'tengjia', name: '藤甲兵', base: 'shield', rarity: 'epic', style: 'tengjia',
    role: '南中藤甲：圆藤帽、一圈圈藤条圆甲、大圆藤盾，偏黄褐不反光。',
    // 纯抗线：血量再 +10%、攻击再压到 80%（叠加战法自带的输出 −50%，明显低于同线盾兵）
    statMult: { hp: 1.1, atk: 0.8 },
    palette: {
      leather: 'hsl(42, 30%, 44%)', leatherDark: 'hsl(38, 32%, 27%)',
      iron: 'hsl(44, 26%, 56%)', ironDark: 'hsl(40, 28%, 30%)', accent: '#7a5f2a',
    },
  },
  {
    id: 'xianzhen', name: '陷阵营', base: 'shield', rarity: 'legendary', style: 'xianzhen',
    role: '高顺陷阵：方正铁盔、方块肩甲、包金方大盾，像移动铁箱。',
    // 盾兵本体这轮提高了血量、降低了攻击；陷阵营不在调整范围内，用倍率抵消回原数值
    statMult: { hp: 0.892, atk: 1.5 },
    palette: {
      iron: 'hsl(216, 12%, 40%)', ironDark: 'hsl(218, 15%, 22%)',
      leatherDark: 'hsl(218, 14%, 20%)', accent: '#8f7743',
    },
  },
  // ---- 弓兵线 ----
  {
    id: 'qingzhu', name: '丹阳青竹弓手', base: 'archer', rarity: 'rare', style: 'qingzhu',
    role: '丹阳山越：宽檐竹斗笠、青紫色长弓、橙红箭囊，轻布衣。',
    squad: { base: 4, max: 8, levels: [2, 4, 6, 8] },
    // 平衡：稀有弓手人数太多（4→8），单兵攻击再压 15%，不能反超史诗弩士
    statMult: { atk: 0.85 },
    palette: { bamboo: 'hsl(146, 30%, 40%)', accent: 'hsl(146, 30%, 40%)' },
  },
  {
    id: 'yuanyong', name: '元戎弩士', base: 'archer', rarity: 'epic', style: 'yuanyong',
    role: '诸葛连弩：靛蓝横置巨型元戎弩、亮银机括，箭如连珠。',
    palette: { wood: 'hsl(28, 28%, 34%)', accent: '#5f8792' },
  },
  {
    id: 'wudang', name: '无当飞军', base: 'archer', rarity: 'legendary', style: 'wudang',
    role: '南中劲卒：尖头布巾、邪笑、石青短甲、红纹小盾、雨林短弓。',
    // 平衡：毒矢的持续毒伤被战力口径计入，Lv1 单兵战力 ≈×3.46（目标 ×2.83），
    // 用 statMult 0.82 拉回传奇带；多箭齐射不计入口径（与射程同属显示口径问题，另记）。
    statMult: { hp: 0.82, atk: 0.82, def: 0.82 },
    palette: { skin: '#c8976f', accent: 'hsl(178, 32%, 24%)' },
  },
  // ---- 骑兵线 ----
  {
    id: 'youzhou', name: '幽州突骑', base: 'cavalry', rarity: 'rare', style: 'youzhou',
    role: '轻骑突袭：生铁色轻札甲、浅白长披风、高尖盔、骑枪，主打一个「快」的剪影。',
    palette: {
      horse: 'hsl(28, 22%, 34%)', horseDark: 'hsl(26, 20%, 20%)', accent: '#a98539',
    },
  },
  {
    id: 'baima', name: '白马义从', base: 'cavalry', rarity: 'epic', style: 'baima',
    role: '公孙瓒白马义从：纯白马、月白短披风、盔顶金毛；射程 19 格（17 格开火），伤害保留 80%。',
    palette: {
      horse: 'hsl(42, 16%, 88%)', horseDark: 'hsl(40, 12%, 66%)', accent: '#f4f2ea',
      plumeColor: '#f2f0e6',      // 白缨，和白马一个色系（别让默认红缨抢走「白」的识别点）
      light: '#e7e5dd',           // 头巾 / 束带也用象牙白，避免骑兵默认的粉色头巾压过「白马」
    },
  },
  {
    id: 'huhao', name: '虎豹骑', base: 'cavalry', rarity: 'legendary', style: 'huhao',
    role: '曹魏虎豹骑：墨黑全包面铁盔、橙色虎纹、黑马重甲、马槊；高血量 + 高伤害的重装冲骑。',
    // 平衡：旧版「血量 +35% / 伤害 +30%」把 Lv1 单兵推到 ≈×3.70（目标 ×2.83），远超传奇带，
    // 这里撤掉补强，强度回到传奇基准；它仍靠 2→5 人的精兵编制与 4× 首击冲锋做身份。
    squad: { base: 2, max: 5, levels: [3, 6, 9] },  // 虎豹骑精而不多：开局 2 个，满级 5 个
    palette: {
      horse: 'hsl(220, 8%, 22%)', horseDark: 'hsl(220, 10%, 13%)',
      iron: 'hsl(216, 12%, 40%)', ironDark: 'hsl(218, 15%, 22%)', accent: '#726450',
      plumeColor: '#41474f',      // 深铁缨，保持「黑 + 深色重甲」的整体暗色剪影
    },
  },
];

function buildSpecialTroop(spec) {
  const base = CONFIG.troops.find((t) => t.id === spec.base);
  if (!base) throw new Error(`特殊兵种的 base 不存在：${spec.base}`);
  const mult = CONFIG.rarityStats[spec.rarity] || 1;
  const sm = spec.statMult || {};          // 单兵属性微调（人数多 / 攻击虚高时单独压一压）
  const gear = SPECIAL_GEAR[spec.base] || [];
  return {
    id: spec.id,
    name: spec.name,
    baseTroop: spec.base,          // 逻辑层用它回退克制 / 射程 / 站位等「兵种线」参数
    rarity: spec.rarity,
    style: spec.style,
    order: base.order,
    hue: base.hue,
    role: spec.role,
    base: {
      hp: Math.round(base.base.hp * mult * (sm.hp || 1)),
      atk: Math.round(base.base.atk * mult * (sm.atk || 1) * 10) / 10,
      def: Math.round(base.base.def * mult * (sm.def || 1) * 10) / 10,
    },
    growth: { ...base.growth },
    anim: { ...base.anim },
    tiers: [spec.name, ...gear.map((g) => `${spec.name}·${g}`)],
    palette: spec.palette || null,
    scale: spec.scale || 1,
    procedural: true,              // 不导出 PNG（省小游戏包体），运行时用同风格程序化精灵表
  };
}

for (const spec of SPECIAL_TROOPS) {
  if (!CONFIG.troops.some((t) => t.id === spec.id)) CONFIG.troops.push(buildSpecialTroop(spec));
}

// 特殊兵种自动沿用同兵种线的战斗参数；小队人数默认沿用基础兵种，可用 spec.squad 覆盖
for (const t of CONFIG.troops) {
  if (!t.baseTroop) continue;
  for (const key of ['ranges', 'speeds', 'intervals']) {
    if (CONFIG.combat[key][t.id] === undefined) CONFIG.combat[key][t.id] = CONFIG.combat[key][t.baseTroop];
  }
  const squad = SPECIAL_TROOPS.find((s) => s.id === t.id)?.squad;
  CONFIG.combat.squadSize[t.id] = squad ? squad.base : CONFIG.combat.squadSize[t.baseTroop];
  CONFIG.combat.squadMax[t.id] = squad ? squad.max : CONFIG.combat.squadMax[t.baseTroop];
  CONFIG.combat.squadGrowth[t.id] = (squad && squad.levels)
    || CONFIG.combat.squadGrowth[t.baseTroop]
    || CONFIG.combat.squadGrowthLevels;
}
