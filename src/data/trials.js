// 演武（精英兵种挑战）：200 关，关号 → 主线对标关号线性映射（150 → 2600）。
// 1~50 关是手写关卡（两章，保留原有兵种组合与站位）；51~200 关按对标主线关的
// 有效战力生成，用 statMult / difficulty 校准，终点第 200 关与主线 2600 终章等强。
// 电脑全部使用特殊兵种，兵少但等级高，靠阵容与克制智取。
import { CONFIG } from './config.js';
import { addChest } from '../core/chests.js';
import { rarityOf } from '../core/units.js';
import { levelDef } from '../core/levels.js';
import { troopPower } from '../core/power.js';
import { chapterOfLevel, cityOfLevel } from '../core/chapters.js';

// 演武难度（已连续两轮下调）：传奇卡在 25 关内统一压到 Lv5 以内，其他品级缓慢成长；
// 出场小队保持 4 → 12 的增长，用数量而不是高等级传奇来堆难度。
// 本轮再把整体等级下压一档（非传奇最高 Lv7），并让新手也能用略低于主线推荐战力的阵容通关。
// 只作用于手写 1~50 关：传奇压到 Lv5 以内，避免前期数值碾压；
// 51~200 关放开，等级跟随主线、难度由 statMult 精确对齐。
const LEGENDARY_TRIAL_CAP = 5;

// 敌方 5×5 站位模式（col 4 = 敌方后排，col 0 = 敌方前排；row 0~4 从左到右）
const PATTERNS = [
  // 楔形：中间厚、两翼薄
  [[4, 2], [3, 1], [3, 3], [2, 0], [2, 2], [2, 4], [1, 1], [1, 3], [0, 2], [0, 0], [0, 4], [1, 0]],
  // 一字长蛇：后排铺满，前排少
  [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [2, 0], [2, 4]],
  // 菱阵：中间一列尖出去
  [[4, 2], [3, 1], [3, 3], [2, 0], [2, 2], [2, 4], [1, 1], [1, 3], [0, 2], [0, 0], [0, 4], [1, 0]],
  // 双翼：两角强、中间空
  [[4, 0], [4, 4], [3, 0], [3, 4], [2, 1], [2, 3], [1, 2], [0, 2], [4, 1], [4, 3], [2, 0], [2, 4]],
  // 纵队：中路突破
  [[4, 2], [4, 1], [4, 3], [3, 2], [3, 1], [3, 3], [2, 2], [2, 1], [2, 3], [1, 2], [1, 1], [1, 3]],
  // 方阵：前后两圈
  [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [1, 0], [1, 4], [3, 0], [3, 4], [0, 0], [0, 4], [4, 0]],
];

// 25 关：troops / 等级 / 站位模式 / 名字 / 一句话
// 难度曲线（本轮再降一档）：小队数保持 4 → 12，等级改为 3/4/5/6/7 五段爬升，
// 大台阶再用 mix 拆成「部分小队 +1 级」的小步，中后段不再出现陡升；传奇统一 ≤ Lv5。
const TRIAL_SPECS = [
  { name: '初试锋芒', desc: '先登绕后 + 青州人海，先看清绕后的节奏', troops: ['xiandeng', 'qingzhou', 'qingzhu', 'tengjia'], lv: 3, pattern: 0 },
  { name: '藤甲壁垒', desc: '藤甲巨盾 + 白毦枪阵，远程很难啃', troops: ['tengjia', 'xiandeng', 'baier', 'qingzhu', 'qingzhou'], lv: 3, pattern: 1 },
  { name: '幽州快骑', desc: '轻骑从两翼切入，别让后排被白嫖', troops: ['youzhou', 'baima', 'qingzhou', 'xiandeng', 'qingzhu'], lv: 3, mix: 0.5, pattern: 3 },
  { name: '弩雨压阵', desc: '元戎连弩 + 青竹箭雨，考验前排厚度', troops: ['yuanyong', 'qingzhu', 'baier', 'tengjia', 'xiandeng'], lv: 4, pattern: 4 },
  { name: '白马破阵', desc: '第一个传奇登场：大戟士 + 白马骑射', troops: ['baima', 'daji', 'xiandeng', 'qingzhu', 'yuanyong', 'baier'], lv: 3, pattern: 2 },
  { name: '陷阵死守', desc: '陷阵营反击 + 藤甲减伤，硬碰硬会吃亏', troops: ['tengjia', 'xianzhen', 'xiandeng', 'baier', 'qingzhu', 'qingzhou'], lv: 3, mix: 0.5, pattern: 5 },
  { name: '虎豹突袭', desc: '虎豹骑冲锋伤害高，前排别放太薄', troops: ['youzhou', 'huhao', 'baima', 'qingzhou', 'xiandeng', 'tengjia'], lv: 4, pattern: 0 },
  { name: '毒雨连营', desc: '无当毒矢 + 元戎连射，持续伤害很烦', troops: ['yuanyong', 'wudang', 'qingzhu', 'xianzhen', 'tengjia', 'baier'], lv: 4, pattern: 1 },
  { name: '青州白毦', desc: '人海枪阵 + 白毦抗骑，骑兵别硬冲', troops: ['qingzhou', 'baier', 'daji', 'baima', 'xiandeng', 'qingzhu', 'youzhou'], lv: 4, pattern: 3 },
  { name: '白马无双', desc: '白马骑射 + 三传奇，考验切后排', troops: ['baima', 'wudang', 'xianzhen', 'huhao', 'tengjia', 'yuanyong', 'qingzhu'], lv: 4, pattern: 4 },
  { name: '大戟重阵', desc: '大戟高伤 + 重甲，盾兵别单独顶', troops: ['daji', 'xianzhen', 'baier', 'qingzhou', 'tengjia', 'xiandeng', 'qingzhu'], lv: 4, mix: 0.2, pattern: 2 },
  { name: '毒弩齐发', desc: '无当 + 元戎 + 青竹，后排压力拉满', troops: ['wudang', 'yuanyong', 'qingzhu', 'baima', 'huhao', 'youzhou', 'baier'], lv: 5, mix: 0.5, pattern: 5 },
  { name: '虎豹铁流', desc: '虎豹 + 幽州双骑切入，后排要有人保护', troops: ['huhao', 'youzhou', 'baima', 'daji', 'xiandeng', 'yuanyong', 'tengjia', 'qingzhou'], lv: 4, mix: 0.5, pattern: 0 },
  { name: '陷阵铁壁', desc: '陷阵反击 + 藤甲减伤，缺爆发会打不动', troops: ['xianzhen', 'tengjia', 'xiandeng', 'baier', 'daji', 'qingzhou', 'qingzhu', 'yuanyong'], lv: 5, pattern: 1 },
  { name: '弓骑交错', desc: '骑射 + 毒弓 + 连弩，三层远程交错', troops: ['baima', 'youzhou', 'wudang', 'qingzhu', 'yuanyong', 'huhao', 'baier', 'tengjia', 'qingzhou'], lv: 5, mix: 1, pattern: 3 },
  { name: '重甲联军', desc: '多传奇前排，先用枪兵拆骑、再集火', troops: ['daji', 'xianzhen', 'tengjia', 'xiandeng', 'baier', 'qingzhou', 'qingzhu', 'youzhou'], lv: 5, mix: 0.5, pattern: 4 },
  { name: '毒雾骑阵', desc: '毒弓 + 骑射混合，别把后排堆在一起', troops: ['wudang', 'huhao', 'baima', 'youzhou', 'qingzhu', 'yuanyong', 'tengjia', 'xianzhen', 'baier'], lv: 6, pattern: 5 },
  { name: '大戟虎豹', desc: '高爆发重骑 + 大戟，前排会被瞬间撕开', troops: ['daji', 'huhao', 'xianzhen', 'baima', 'xiandeng', 'tengjia', 'qingzhou', 'qingzhu', 'youzhou'], lv: 6, pattern: 2 },
  { name: '藤甲连弩', desc: '坦克 + 远程，拖到超时会很危险', troops: ['tengjia', 'yuanyong', 'wudang', 'qingzhu', 'xianzhen', 'baier', 'xiandeng', 'qingzhou', 'youzhou'], lv: 6, mix: 0.5, pattern: 0 },
  { name: '青州白毦·二', desc: '人海 + 抗骑，枪兵与盾兵要配合', troops: ['qingzhou', 'baier', 'daji', 'xianzhen', 'tengjia', 'baima', 'qingzhu', 'yuanyong', 'huhao'], lv: 6, mix: 0.3, pattern: 1 },
  { name: '全明星 · 一', desc: '多个精英、多传奇，阵容开始不讲道理', troops: ['daji', 'xianzhen', 'wudang', 'huhao', 'baima', 'xiandeng', 'tengjia', 'qingzhou', 'youzhou', 'baier'], lv: 7, pattern: 3 },
  { name: '全明星 · 二', desc: '枪盾骑弓混编，换错阵型就会被克制', troops: ['daji', 'xianzhen', 'wudang', 'huhao', 'baier', 'qingzhou', 'yuanyong', 'qingzhu', 'youzhou', 'tengjia'], lv: 7, pattern: 4 },
  { name: '全明星 · 三', desc: '十队精英，双翼与中路同时压上', troops: ['daji', 'xianzhen', 'wudang', 'huhao', 'baima', 'youzhou', 'qingzhu', 'tengjia', 'xiandeng', 'baier'], lv: 7, pattern: 5 },
  { name: '最终试炼', desc: '十一队高等级精英，留好爆发与克制位', troops: ['daji', 'xianzhen', 'wudang', 'huhao', 'baima', 'xiandeng', 'tengjia', 'baier', 'qingzhou', 'youzhou', 'qingzhu'], lv: 7, pattern: 2 },
  { name: '无双演武', desc: '十二个特殊兵种全员上阵（传奇仍封顶 Lv5），第一章收官', troops: ['xiandeng', 'tengjia', 'xianzhen', 'qingzhou', 'baier', 'daji', 'qingzhu', 'yuanyong', 'wudang', 'youzhou', 'baima', 'huhao'], lv: 7, pattern: 0 },
  // ===== 第二章演武（26~50 关，随主线 400+ 解锁）=====
  // 沿用同一口径：等级平滑 +1 级、传奇仍 ≤ Lv5、小队数最多 12、每次通关小额铜钱
  { name: '汜水关 · 前哨', desc: '第二章演武开场：骑枪混编，先适应更重的冲阵', troops: ['huhao', 'youzhou', 'baier', 'tengjia', 'qingzhu', 'xiandeng'], lv: 7, mix: 0.5, pattern: 3 },
  { name: '汜水关 · 铁骑', desc: '双骑压上，后排别站太靠前', troops: ['huhao', 'youzhou', 'baima', 'daji', 'baier', 'qingzhu', 'tengjia'], lv: 7, pattern: 4 },
  { name: '汜水关 · 弩阵', desc: '元戎 + 青竹覆盖，考验前排厚度', troops: ['yuanyong', 'qingzhu', 'wudang', 'tengjia', 'xianzhen', 'baier', 'qingzhou'], lv: 7, mix: 0.5, pattern: 1 },
  { name: '汜水关 · 混编', desc: '八队精英混编，克制关系开始变复杂', troops: ['daji', 'huhao', 'baier', 'tengjia', 'wudang', 'yuanyong', 'qingzhu', 'xiandeng'], lv: 7, mix: 1, pattern: 2 },
  { name: '汜水关 · 城下', desc: '十队精英，城下决战（传奇封顶 Lv5）', troops: ['daji', 'xianzhen', 'huhao', 'youzhou', 'baier', 'tengjia', 'wudang', 'yuanyong', 'qingzhu', 'xiandeng'], lv: 8, pattern: 5 },
  { name: '虎牢关 · 重骑', desc: '虎牢重骑第一波：前排要能顶住冲锋', troops: ['huhao', 'daji', 'youzhou', 'baier', 'tengjia', 'xianzhen', 'qingzhu', 'qingzhou'], lv: 8, mix: 0.5, pattern: 0 },
  { name: '虎牢关 · 弓弩', desc: '骑射 + 连弩双线，注意拉开后排间距', troops: ['huhao', 'daji', 'youzhou', 'baier', 'tengjia', 'xianzhen', 'qingzhu', 'qingzhou'], lv: 8, mix: 0.5, pattern: 3 },
  { name: '虎牢关 · 夹击', desc: '双翼包夹，中路反而空虚', troops: ['huhao', 'youzhou', 'daji', 'baima', 'xianzhen', 'tengjia', 'baier', 'qingzhu', 'qingzhou'], lv: 8, mix: 0.5, pattern: 3 },
  { name: '虎牢关 · 鏖战', desc: '十队高强度混编，别指望一套阵打到底', troops: ['daji', 'xianzhen', 'huhao', 'wudang', 'baima', 'youzhou', 'baier', 'qingzhu', 'yuanyong', 'tengjia'], lv: 8, mix: 1, pattern: 4 },
  { name: '虎牢关 · 关前', desc: '十一队精英压境，留好爆发位', troops: ['daji', 'xianzhen', 'huhao', 'wudang', 'baima', 'youzhou', 'baier', 'qingzhu', 'yuanyong', 'tengjia', 'xiandeng'], lv: 9, pattern: 1 },
  { name: '洛阳 · 火阵', desc: '毒火远程 + 重甲前排，拖时间会吃亏', troops: ['wudang', 'yuanyong', 'qingzhu', 'tengjia', 'xianzhen', 'daji', 'baier', 'huhao'], lv: 9, mix: 0.6, pattern: 2 },
  { name: '洛阳 · 盾墙', desc: '藤甲 + 陷阵叠成盾墙，先拆远程再动前排', troops: ['tengjia', 'xianzhen', 'baier', 'qingzhou', 'yuanyong', 'wudang', 'qingzhu', 'daji', 'huhao'], lv: 9, mix: 0.3, pattern: 5 },
  { name: '洛阳 · 夜袭', desc: '先登绕后 + 轻骑切入，后排随时会被偷', troops: ['tengjia', 'xianzhen', 'baier', 'qingzhou', 'yuanyong', 'wudang', 'qingzhu', 'daji', 'huhao'], lv: 9, mix: 0.3, pattern: 0 },
  // mix 0.8→1：本轮防御下调、血量上调后，重甲单位在战力口径里的权重变低，
  // 本关相对上一关回落约 5%；把非传奇全部 +1 级后重新回到平滑区间。
  // 1.2.5 大戟增伤 1.9→1.4 后本关（含 2 支大戟）比上一关回落 5.3%，补 difficulty 1.02 拉回平滑
  { name: '洛阳 · 宫门', desc: '十队精英守宫门，正面硬碰硬', troops: ['daji', 'xianzhen', 'tengjia', 'huhao', 'yuanyong', 'wudang', 'qingzhu', 'baier', 'youzhou', 'qingzhou'], lv: 9, mix: 1, pattern: 4, difficulty: 1.02 },
  { name: '洛阳 · 焚城', desc: '十二队满编，火烧连营式的持续压制', troops: ['wudang', 'yuanyong', 'qingzhu', 'baima', 'huhao', 'youzhou', 'daji', 'xianzhen', 'tengjia', 'baier', 'qingzhou', 'xiandeng'], lv: 9, mix: 0.8, pattern: 3 },
  { name: '长安 · 西凉', desc: '西凉铁骑大举登场，枪兵价值拉满', troops: ['huhao', 'youzhou', 'daji', 'baier', 'xianzhen', 'tengjia', 'qingzhou', 'qingzhu', 'yuanyong'], lv: 9, mix: 0.5, pattern: 1 },
  { name: '长安 · 双骑', desc: '双骑线 + 毒弓，前后排都要兼顾', troops: ['huhao', 'daji', 'baima', 'youzhou', 'wudang', 'qingzhu', 'tengjia', 'baier', 'yuanyong', 'xianzhen'], lv: 9, mix: 0.5, pattern: 2 },
  { name: '长安 · 重甲', desc: '高等级重甲联军，缺穿透会打不动', troops: ['tengjia', 'xianzhen', 'daji', 'baier', 'huhao', 'qingzhou', 'wudang', 'yuanyong', 'qingzhu', 'youzhou'], lv: 9, mix: 0.6, pattern: 0 },
  { name: '长安 · 十面', desc: '十面埋伏：四面八方同时压上', troops: ['huhao', 'youzhou', 'baima', 'daji', 'xianzhen', 'tengjia', 'baier', 'qingzhou', 'qingzhu', 'yuanyong', 'wudang'], lv: 9, mix: 0.9, pattern: 4 },
  { name: '长安 · 死士', desc: '十一队死士，换阵速度要快', troops: ['xianzhen', 'daji', 'huhao', 'youzhou', 'baima', 'tengjia', 'baier', 'qingzhou', 'yuanyong', 'wudang', 'qingzhu'], lv: 9, mix: 0.7, pattern: 5 },
  { name: '第二章 · 全明星', desc: '十二队全特殊兵种，传奇仍封顶 Lv5', troops: ['xiandeng', 'tengjia', 'xianzhen', 'qingzhou', 'baier', 'daji', 'qingzhu', 'yuanyong', 'wudang', 'youzhou', 'baima', 'huhao'], lv: 9, mix: 0.6, pattern: 3 },
  { name: '长安 · 未央', desc: '未央宫前最后一轮演武，稳定输出即可', troops: ['daji', 'xianzhen', 'huhao', 'youzhou', 'baima', 'wudang', 'yuanyong', 'qingzhu', 'tengjia', 'baier', 'qingzhou', 'xiandeng'], lv: 9, mix: 0.7, pattern: 2 },
  { name: '长安 · 玄武', desc: '玄武阵：盾骑交错，考验持续输出', troops: ['tengjia', 'xianzhen', 'huhao', 'daji', 'baier', 'qingzhou', 'wudang', 'yuanyong', 'qingzhu', 'youzhou', 'baima', 'xiandeng'], lv: 9, mix: 0.8, pattern: 1 },
  { name: '长安 · 朱雀', desc: '朱雀阵：远程火力全开，前排要够厚', troops: ['yuanyong', 'wudang', 'qingzhu', 'baima', 'huhao', 'daji', 'xianzhen', 'tengjia', 'baier', 'qingzhou', 'youzhou', 'xiandeng'], lv: 9, mix: 0.9, pattern: 4 },
  { name: '天下演武', desc: '手写 50 关收官：十二队满编精英，后 150 关一路对标主线终章', troops: ['xiandeng', 'tengjia', 'xianzhen', 'qingzhou', 'baier', 'daji', 'qingzhu', 'yuanyong', 'wudang', 'youzhou', 'baima', 'huhao'], lv: 9, mix: 1, pattern: 0 },
];

function buildEnemies(spec, padToFull = false, capLegendary = true) {
  const pattern = PATTERNS[spec.pattern] || PATTERNS[0];
  // 第二章演武（26 关起）强制 12 队满编：兵种不足时循环补位，
  // 让第 26 关与第一章第 25 关战力衔接，不出现「换章节反而变简单」的断崖。
  let troops = spec.troops;
  if (padToFull && troops.length < 12) {
    troops = Array.from({ length: 12 }, (_, i) => troops[i % spec.troops.length]);
  }
  const n = Math.min(troops.length, pattern.length);
  // mix：前 round(n × mix) 支小队额外 +1 级。
  // 用「部分小队升级」代替整数整档跳级，把 4→5、5→6 这类台阶拆成 1/n 的细步，
  // 避免中后段出现某一关整体战力陡升。
  const mix = Math.max(0, Math.min(1, spec.mix || 0));
  const mixCount = Math.round(mix * n);
  const enemies = [];
  for (let i = 0; i < n; i++) {
    const [col, row] = pattern[i];
    const troop = troops[i];
    let level = Math.min(CONFIG.merge.maxLevel, spec.lv + (i < mixCount ? 1 : 0));
    // 传奇卡统一压到 Lv5 以内（其他品级照常成长）
    if (capLegendary && rarityOf(troop) === 'legendary') level = Math.min(level, LEGENDARY_TRIAL_CAP);
    enemies.push({ troop, level, col, row });
  }
  return enemies;
}

// 关号 → 主线对标关号：第 1 关 = 150，第 200 关 = 2600（终章）。
// 解锁主线关数直接用它，所以「演武难度」与当时主线进度严格同步。
export function trialMainLevel(stage) {
  const total = CONFIG.trials.total;
  const s = Math.max(1, Math.min(total, Math.floor(stage || 1)));
  const from = CONFIG.trials.unlockLevel;
  const to = CONFIG.trials.endLevel || 2600;
  if (total <= 1) return from;
  return Math.round(from + (s - 1) * (to - from) / (total - 1));
}

function mainlinePowerAt(levelN) {
  const d = levelDef(levelN);
  const base = d.enemies.reduce((sum, e) => sum + troopPower(e.troop, e.level), 0);
  return base * (Number.isFinite(d.difficulty) ? d.difficulty : 1);
}

// 手写第 50 关的实际战力：新增关从这里接住，避免「第 50 → 51 关」出现断崖。
const LAST_HAND_WRITTEN = TRIAL_SPECS[TRIAL_SPECS.length - 1];
const SEED_POWER = buildEnemies(LAST_HAND_WRITTEN, true, true)
  .reduce((sum, e) => sum + troopPower(e.troop, e.level), 0);

// 51~200 关目标战力：起点 = 手写第 50 关，终点 = 主线 2600 终章有效战力。
// 主线自身因 6 套阵型轮换有 ±15% 抖动，这里用幂曲线平滑掉，保证演武难度严格单调；
// 关号 → 主线对标关号的映射仍决定解锁进度与关卡命名，整体量级始终贴着主线走。
function generatedTarget(stage) {
  const total = CONFIG.trials.total;
  const first = TRIAL_SPECS.length + 1;
  const t = Math.max(0, Math.min(1, (stage - first) / Math.max(1, total - first)));
  const end = mainlinePowerAt(CONFIG.trials.endLevel || 2600);
  return SEED_POWER + (end - SEED_POWER) * Math.pow(t, 0.92);
}

const ALL_SPECIALS = [
  'xiandeng', 'tengjia', 'xianzhen', 'qingzhou', 'baier', 'daji',
  'qingzhu', 'yuanyong', 'wudang', 'youzhou', 'baima', 'huhao',
];
const BANDS = ['先锋', '锐阵', '铁壁', '骑冲', '弩阵', '毒阵', '重甲', '全明星', '决胜', '无双'];

// 51~200 关：12 队特殊兵种满编，等级跟随对标主线关，阵型 / 兵种轮换。
function generatedSpec(stage) {
  const main = trialMainLevel(stage);
  const city = cityOfLevel(main);
  const chapter = chapterOfLevel(main);
  const k = stage - TRIAL_SPECS.length - 1;
  const d = levelDef(main);
  const lv = Math.min(CONFIG.merge.maxLevel, Math.max(5, d.enemyLevelMax || 6));
  const troops = Array.from({ length: 12 }, (_, i) => ALL_SPECIALS[(i + k) % ALL_SPECIALS.length]);
  return {
    name: `${city ? city.name : (chapter ? chapter.name : '演武')} · ${BANDS[k % BANDS.length]}`,
    desc: `对标主线第 ${main} 关 · 12 队精英满编`,
    troops, lv, mix: (k % 5) / 5, pattern: k % PATTERNS.length,
    generated: true, mainLevel: main,
  };
}

const TOTAL_STAGES = CONFIG.trials.total;
const ALL_SPECS = [
  ...TRIAL_SPECS,
  ...Array.from(
    { length: Math.max(0, TOTAL_STAGES - TRIAL_SPECS.length) },
    (_, i) => generatedSpec(TRIAL_SPECS.length + i + 1),
  ),
];

export const TRIALS = ALL_SPECS.map((spec, i) => {
  // 手写关保留传奇 Lv5 封顶；生成关放开，等级跟随主线（难度靠 statMult 精确对齐）。
  const enemies = buildEnemies(spec, i >= 25, !spec.generated);
  const levels = enemies.map((e) => e.level);
  const out = {
    stage: i + 1,
    name: spec.name,
    desc: spec.desc,
    enemies,
    enemyLevel: Math.min(...levels),
    enemyLevelMax: Math.max(...levels),
    // 手写关可用 spec.difficulty 微调（1.2.5 大戟增伤下调后，个别手写关需要补回 1~2% 保持平滑）
    difficulty: spec.difficulty || 1,
  };
  if (spec.generated) {
    const base = enemies.reduce((sum, e) => sum + troopPower(e.troop, e.level), 0);
    const target = generatedTarget(i + 1);
    const scale = Math.max(1, target / Math.max(1, base));
    out.difficulty = Math.round(scale * 1000) / 1000;
    out.mainLevel = spec.mainLevel;
    out.targetPower = Math.round(target);
    // statMult 与主线 difficulty 同机制：只放大生命与攻击，不动防御
    enemies.forEach((e) => { e.statMult = out.difficulty; });
  }
  return out;
});

export function trialByStage(stage) {
  return TRIALS[Math.max(0, Math.min(TRIALS.length - 1, Math.floor(stage || 1) - 1))] || null;
}

// 解锁条件 = 该关对标的主线关数（150 → 2600），并且上一关已通关（第 1 关只看主线）
export function trialUnlockLevel(stage) {
  return trialMainLevel(stage);
}

export function trialUnlocked(stage, maxCleared, trialCleared) {
  const s = Math.max(1, Math.floor(stage || 1));
  return maxCleared >= trialUnlockLevel(s) && s <= Math.max(1, trialCleared + 1);
}

// 演武每次通关的稳定铜钱（含重复挑战）：按该关解锁时主线首通铜钱的 10% 折算。
// 演武定位是「给奖励、辅助过主线」，不是一次性宝箱仓库——重复刷也能有稳定收益。
export function trialClearCoins(stage) {
  const s = Math.max(1, Math.min(CONFIG.trials.total, Math.floor(stage || 1)));
  return Math.floor(CONFIG.economy.clearCoins(trialUnlockLevel(s)) * 0.1);
}

// 演武首通奖励：每关 1 个黄金宝箱；10 / 20 / 25 关额外 1 个传奇宝箱
// 每次通关（含重复）都发铜钱；宝箱只在首通发。
// 返回本次实际发放的宝箱奖励（重复挑战已通关的关卡返回空数组）
export function grantTrialRewards(state, stage) {
  const s = Math.max(1, Math.min(CONFIG.trials.total, Math.floor(stage || 1)));
  const prev = Math.max(0, Math.floor(state.trialCleared || 0));
  // 铜钱与是否首通无关：每次打赢都给，作为稳定收益
  state.coins = Math.max(0, Math.floor(state.coins || 0)) + trialClearCoins(s);
  if (s <= prev) return [];
  const rewards = [];
  if (CONFIG.trials.goldEveryStage) {
    addChest(state, 'gold', 1);
    rewards.push({ id: 'gold', count: 1 });
  }
  if ((CONFIG.trials.legendaryAt || []).includes(s)) {
    addChest(state, 'legendary', 1);
    rewards.push({ id: 'legendary', count: 1 });
  }
  // 演武首通额外送 1 张英雄招募券（需先通关至少 1 场英雄战，避免未玩英雄战就囤券）
  if (Math.max(0, Math.floor(state.heroBattleCleared || 0)) > 0) {
    state.heroTickets = Math.max(0, Math.floor(state.heroTickets || 0)) + 1;
  }
  state.trialCleared = Math.max(prev, s);
  return rewards;
}
