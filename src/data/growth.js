// 「成长之路」节点表：关卡数 / 解锁内容 / 一句话说明
// 兵种节点直接用 CONFIG.troopUnlocks.levels；功能节点直接用各系统实际配置，
// 避免界面文案和实际解锁条件对不上（以实际实现为准）。
import { CONFIG } from './config.js';

const TROOP_DESC = {
  qingzhu: '丹阳弓手，4 人编制，满级 8 人；射速快、单发伤害低。',
  youzhou: '轻装突骑，骑兵线中移速最高。',
  xiandeng: '开战 1 秒后突进至敌方最后一排。',
  tengjia: '南中藤甲，高生命、高减伤，输出偏低。',
  wudang: '南中劲卒，传奇弓手，箭矢附带持续毒伤。',
  yuanyong: '诸葛连弩，史诗弩士，单轮多发射击。',
  baima: '白马义从，19 格射程的骑射单位。',
  huhao: '曹魏虎豹骑，高生命、高伤害的重装冲骑。',
  daji: '袁绍麾下重装枪兵，持超长重型大戟。',
};

function troopNode(troopId, level, order) {
  const t = (CONFIG.troops || []).find((x) => x.id === troopId);
  const name = t ? t.name : troopId;
  const desc = TROOP_DESC[troopId] || (t && t.role) || '';
  return {
    id: `troop:${troopId}`,
    kind: 'troop',
    level,
    title: name,
    troop: troopId,
    desc,
    how: [
      `已可招募到新兵种「${name}」。`,
      desc,
      '打开「兵营」即可合成 / 上阵；宝箱、商店、招募也会产出。',
    ],
    order,
  };
}

function featureNode(id, level, title, desc, badge, how = []) {
  return { id, kind: 'feature', level, title, desc, badge, how };
}

// 宝箱兵种等级加成：直接读 CONFIG.chests.levelBonusByClear（400 / 800 两个节点）
const CHEST_BONUS_NODES = (CONFIG.chests.levelBonusByClear || [])
  .slice()
  .sort((a, b) => a.minLevel - b.minLevel)
  .map((t) => featureNode(
    `chestBonus${t.minLevel}`,
    t.minLevel,
    `宝箱兵种等级 +${t.bonus}`,
    `通关 ${t.minLevel} 关后，所有宝箱开出的兵种等级 +${t.bonus}（含挂机宝箱）。`,
    '箱',
    ['所有宝箱（含挂机宝箱）开出的兵种等级自动提升。', '当前加成可在宝箱页右上角的「!」里查看。'],
  ));

export const GROWTH_NODES = [
  troopNode('qingzhu', CONFIG.troopUnlocks.levels.qingzhu, 0),
  featureNode('autoBattle', CONFIG.autoBattle.unlockLevel, '自动战斗',
    '胜利后 3 秒自动进入下一关，离线挂机更省心。', '战',
    ['结算页底部可开启自动战斗。', '开启后胜利 3 秒自动进入下一关。']),
  featureNode('speed', CONFIG.battle.speedUnlockLevel, '战斗加速',
    `主线第 ${CONFIG.battle.speedUnlockLevel} 关后，战斗内可切换 1 / 2 / 4 倍速。`, '速',
    ['战斗右上角点「加速」切换倍速。', '演武 / 英雄战 / 斩将不受主线关数限制。']),
  troopNode('youzhou', CONFIG.troopUnlocks.levels.youzhou, 1),
  featureNode('daily', CONFIG.daily.unlockLevel, '每日登录奖励',
    '签到、每日任务与 7 日登录奖励开放。', '签',
    ['首页点「每日」进入。', '每天签到、做每日任务、领 7 日登录奖励。']),
  troopNode('xiandeng', CONFIG.troopUnlocks.levels.xiandeng, 2),
  troopNode('tengjia', CONFIG.troopUnlocks.levels.tengjia, 3),
  featureNode('dailyShop', CONFIG.dailyShop.unlockLevel, '每日商店',
    '每天 6 个栏位，可用铜钱买已解锁的稀有 / 史诗兵。', '店',
    ['首页点「商场」→「每日商店」进入。', '每天 6 个栏位，0 点刷新，每个栏位限购 1 次。']),
  troopNode('wudang', CONFIG.troopUnlocks.levels.wudang, 4),
  troopNode('yuanyong', CONFIG.troopUnlocks.levels.yuanyong, 5),
  troopNode('baima', CONFIG.troopUnlocks.levels.baima, 6),
  featureNode('trials', CONFIG.trials.unlockLevel, '演武',
    '精英挑战逐关开放，首通奖励宝箱与铜钱。', '演',
    ['首页点「演武」进入。', '逐关挑战精英，首通送宝箱和铜钱。']),
  troopNode('huhao', CONFIG.troopUnlocks.levels.huhao, 7),
  troopNode('daji', CONFIG.troopUnlocks.levels.daji, 8),
  featureNode('heroBattle', CONFIG.heroBattles.unlockLevel, '英雄战与招募系统',
    '150 关 Boss 挑战 + 招募 / 升级 / 上阵。', '英',
    ['首页点「英雄战」进入。', '先用招募券抽英雄 → 升级 → 上阵挑战 Boss 关。']),
  featureNode('gauntlet', CONFIG.gauntlet.unlockLevel, '过 5 关斩 6 将',
    '用现有兵牌连闯 5 关，兵死不可复活、血量不回复。', '斩',
    ['首页点「斩将」进入。', '从已解锁章节里选一章，用现有兵牌连打 5 关。',
      '兵一旦阵亡即灰掉，血量跨关不回复；中途只能调整站位。',
      '每章首通给自选卡包，每日首次通关另有奖励。']),
  // 1.2.5 · 三模式（30 关同期开放，教学关闭后回首页高亮对应入口）
  featureNode('weekly', CONFIG.weekly.unlockLevel, '周常挑战',
    '5 档 × 10 小关，每周 1600 积分选兵，首通与扫荡拿奖励。', '周',
    [`通关主线 ${CONFIG.weekly.unlockLevel} 关后开放。`, '首页点左侧「每周」圆钮进入：5 个档位各 10 小关，用每周 1600 积分买兵、升等级、排出阵。',
      '档位越高敌方越强（必须靠英雄 / 器械 / 兵书练度）；首通给铜钱与宝箱，已通关关卡每天可扫荡 6 次。']),
  featureNode('dailyChallenge', CONFIG.dailyChallenge.unlockLevel, '每日挑战',
    '敌方英雄带队的 30 关，单将到三将，难度对标主线 2000 关。', '日',
    [`通关主线 ${CONFIG.dailyChallenge.unlockLevel} 关后开放。`, '首页点「每日」进入：30 关从史诗单将一路升到传奇三将，用你当前阵容应战。',
      '每天前 3 场胜利另有铜钱与木箱，首通每关都有铜钱 + 宝箱。']),
  featureNode('achievements', CONFIG.achievements.unlockLevel, '成就系统',
    '五大类成就，达标直接领铜钱与宝箱。', '成',
    [`通关主线 ${CONFIG.achievements.unlockLevel} 关后开放。`, '首页点「成就」进入：征战 / 挑战 / 图鉴 / 养成 / 经济五类，分档达标点「领取」即到账。',
      '进度按累计值统计，不随每日 / 每周重置。']),
  ...CHEST_BONUS_NODES,
].sort((a, b) => a.level - b.level
  || (a.kind === b.kind ? 0 : a.kind === 'troop' ? -1 : 1));

// 状态：用存档 maxCleared 驱动（距离解锁还差多少关）
export function growthStatus(state, node) {
  const cleared = Math.max(0, Math.floor(Number(state && state.maxCleared) || 0));
  const unlocked = cleared >= node.level;
  return {
    unlocked,
    cleared,
    remain: unlocked ? 0 : Math.max(0, node.level - cleared),
  };
}
