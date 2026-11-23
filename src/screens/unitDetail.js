// 单位详情：展示属性 + 战法特性 + 合成升阶（2 个同兵种同等级 → 1 个高一级）
import { THEME, text, panel, button, coinBadge, hit, backButton, textWidth } from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import { troopById, unitName, statsFor, tierIndexFor, spriteTierFor, rarityOf, rarityInfo } from '../core/units.js';
import { troopPower, formatPower } from '../core/power.js';
import { traitSkills, traitNote } from '../data/traits.js';
import { mergeInfo, mergeUnits, maxLevel } from '../core/merge.js';
import { squadSoldierCount } from '../core/arena.js';
import { drawFrame, sheetFor, frameCount, currentFrame } from '../render/sprites.js';
import { playSfx } from '../core/audio.js';

// '#4a6b82' → 'rgba(91,136,192,0.2)'，用于按品级给立绘光环上色
function hexToRgba(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// 按宽度折行，最多 maxLines 行；放不下的部分用省略号收尾（战法文案比较长）
function wrapLines(ctx, str, maxWidth, size, maxLines) {
  const chars = Array.from(str);
  const all = [];
  let line = '';
  for (const ch of chars) {
    if (textWidth(ctx, line + ch, size) > maxWidth && line) {
      all.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) all.push(line);
  if (all.length <= maxLines) return all;
  const cut = all.slice(0, maxLines);
  let last = cut[maxLines - 1];
  while (last.length > 1 && textWidth(ctx, `${last}…`, size) > maxWidth) last = last.slice(0, -1);
  cut[maxLines - 1] = `${last}…`;
  return cut;
}

export class UnitDetailScreen {
  constructor(game, uid) {
    this.game = game;
    this.uid = uid;
    this.t = 0;
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.mergeRect = { x: 175, y: 1024, w: 400, h: 116 };
  }

  get unit() {
    return this.game.state.units.find((u) => u.id === this.uid) || null;
  }

  update(dt) {
    this.t += dt;
  }

  tap(x, y) {
    if (hit(this.backRect, x, y)) return this.game.pop();
    if (hit(this.mergeRect, x, y)) return this.merge();
  }

  merge() {
    const g = this.game;
    const unit = this.unit;
    if (!unit) return;
    const info = mergeInfo(g.state, this.uid);
    if (info.atMax) {
      playSfx('error', { volume: 0.7 });
      g.toast(`已达最高等级 Lv${maxLevel()}`);
      return;
    }
    if (!info.canMerge) {
      playSfx('error', { volume: 0.7 });
      g.toast(`还需 1 个 ${troopById(unit.troop).name} Lv${unit.level} 才能合成`);
      return;
    }
    const r = mergeUnits(g.state, this.uid, info.candidates[0].id);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      g.toast('合成失败：材料不匹配');
      return;
    }
    g.save();
    playSfx('merge');
    g.toast(`合成成功：Lv${r.fromLevel} → ${unitName(unit.troop, r.toLevel)} Lv${r.toLevel}`);
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const unit = this.unit;
    if (!unit) return;

    const troop = troopById(unit.troop);
    const sheet = sheetFor(unit.troop, spriteTierFor(unit.level));
    const stats = statsFor(unit.troop, unit.level);
    const info = mergeInfo(st, this.uid);
    const tierIdx = tierIndexFor(unit.level);
    const nextStats = info.atMax ? stats : statsFor(unit.troop, unit.level + 1);
    const power = troopPower(unit.troop, unit.level);
    const nextPower = info.atMax ? power : troopPower(unit.troop, unit.level + 1);
    // 小队编制：等级越高人越多（Lv3 / Lv5 / Lv8 各 +1 个兵）
    const squadSize = squadSoldierCount(unit.troop, unit.level);
    const squadMax = Math.max(squadSize, CONFIG.combat.squadMax[unit.troop] || squadSize);
    const nextSquad = info.atMax ? squadSize : squadSoldierCount(unit.troop, unit.level + 1);
    // 品级配色（普通 = 灰白，稀有蓝 / 史诗紫 / 传奇金）
    const rarity = rarityOf(unit.troop);
    const rar = rarityInfo(unit.troop);
    const special = rarity !== 'common';
    const accent = special ? rar.color : THEME.gold;

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '单位详情', W / 2 + 20, 76, { size: 34, weight: '600', align: 'center' });
    coinBadge(ctx, 700, 76, st.coins, { size: 24, align: 'right' });

    // 立绘区（边框跟着品级走）
    panel(ctx, 36, 140, 678, 300, {
      fill: '#182029', stroke: special ? rar.color : THEME.line, r: 20, lw: special ? 2 : 1,
    });
    ctx.save();
    const ringGrad = ctx.createRadialGradient(375, 380, 20, 375, 380, 150);
    ringGrad.addColorStop(0, special ? `rgba(255,255,255,0.02)` : 'rgba(213,153,71,0.16)');
    ringGrad.addColorStop(0.35, special ? hexToRgba(rar.color, 0.2) : 'rgba(213,153,71,0.08)');
    ringGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(375, 380, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const idleFrame = currentFrame('idle', frameCount(troop, 'idle'), this.t + 0.2, 0.8, { loop: true });
    drawFrame(ctx, sheet, 'idle', idleFrame, 375, 416, 2.6, false);

    text(ctx, unitName(unit.troop, unit.level), 70, 190, {
      size: 34, weight: '700', color: special ? rar.color : THEME.text, maxWidth: 400,
    });
    text(ctx, `${special ? `${rar.name} · ` : ''}${troop.name} · Lv${unit.level}`, 70, 234, {
      size: 24, color: special ? rar.color : THEME.textDim,
    });
    text(ctx, `等级 ${unit.level} / ${maxLevel()}`, 640, 190, { size: 22, color: accent, align: 'right' });
    // 战斗力（亮金色）：整支小队口径，和布阵页的「我方 / 敌方战力」一致
    text(ctx, `战力 ${formatPower(power)}`, 640, 234, {
      size: 22, weight: '700', color: '#f4d488', align: 'right',
    });

    // 等级小方块
    for (let i = 0; i < maxLevel(); i++) {
      const bx = 70 + i * 24;
      ctx.save();
      ctx.globalAlpha = i <= tierIdx ? 1 : 0.3;
      ctx.fillStyle = i === tierIdx ? THEME.gold : i < tierIdx ? THEME.goldDim : THEME.textWeak;
      ctx.fillRect(bx, 264, 18, 8);
      ctx.restore();
    }

    // 属性
    const cards = [
      { label: '生命', value: stats.hp, color: THEME.green, key: 'hp' },
      { label: '攻击', value: stats.atk, color: '#d98b57', key: 'atk' },
      { label: '防御', value: stats.def, color: THEME.blue, key: 'def' },
    ];
    cards.forEach((c, i) => {
      const x = 71 + i * 206;
      panel(ctx, x, 470, 196, 138, { fill: THEME.panel, stroke: THEME.line, r: 16 });
      text(ctx, c.label, x + 98, 506, { size: 22, align: 'center', color: THEME.textDim });
      text(ctx, `${c.value}`, x + 98, 556, { size: 38, weight: '700', align: 'center', color: c.color });
      text(ctx, `每级 +${Math.round(troop.growth[c.key] * 100)}%`, x + 98, 590, {
        size: 16, align: 'center', color: THEME.textWeak,
      });
    });

    // 战法 · 特性：这个兵种「凭什么特殊」，数值按当前等级实时算（普通兵种显示无特殊战法）
    const skills = traitSkills(unit.troop, unit.level);
    const note = traitNote(unit.troop);
    panel(ctx, 36, 624, 678, 186, {
      fill: special ? hexToRgba(rar.color, 0.09) : 'rgba(43,34,23,0.7)',
      stroke: special ? hexToRgba(rar.color, 0.5) : THEME.line, r: 18,
    });
    text(ctx, '战 法 · 特 性', 70, 652, { size: 21, weight: '600', color: special ? rar.color : THEME.text });
    const headerNote = note || (special ? `小队 ${squadSize} 个兵（满编 ${squadMax}）` : '');
    if (headerNote) {
      text(ctx, headerNote, 700, 654, {
        size: 15, align: 'right', color: THEME.textWeak, maxWidth: 430,
      });
    }
    if (skills.length) {
      // 两条战法时每条最多 2 行，一条战法时最多 4 行
      const maxLines = skills.length > 1 ? 2 : 4;
      let y = skills.length > 1 ? 686 : 690;
      for (const s of skills) {
        text(ctx, s.name, 70, y, { size: 20, weight: '600', color: special ? rar.color : THEME.gold });
        const tag = s.cd ? `${s.type} · ${s.cd} 秒` : s.type;
        text(ctx, tag, 70 + textWidth(ctx, s.name, 20, '600') + 14, y + 1, { size: 14, color: THEME.textWeak });
        let ly = y + 24;
        for (const ln of wrapLines(ctx, s.desc, 636, 16, maxLines)) {
          text(ctx, ln, 70, ly, { size: 16, color: THEME.textDim, maxWidth: 636 });
          ly += 18;
        }
        y = ly + 14;
      }
    } else {
      text(ctx, '普通兵种 · 无特殊战法', 70, 700, { size: 21, color: THEME.textDim });
      text(ctx, `小队 ${squadSize} 人（满编 ${squadMax} 人）`, 70, 736, {
        size: 17, color: THEME.textDim,
      });
    }

    // 合成面板
    panel(ctx, 36, 814, 678, 190, {
      fill: info.canMerge ? 'rgba(45,40,26,0.55)' : 'rgba(43,34,23,0.6)',
      stroke: info.canMerge ? THEME.goldDim : THEME.line, r: 18,
    });
    text(ctx, '合 成', 70, 852, { size: 24, color: THEME.textDim });
    if (info.atMax) {
      text(ctx, `已满级（Lv${maxLevel()}），不能再合成`, 70, 894, { size: 26, weight: '600', color: THEME.textWeak });
      text(ctx, `商城可买 Lv${CONFIG.shop.levels[CONFIG.shop.levels.length - 1]} 兵`, 70, 934, { size: 21, color: THEME.textDim });
    } else {
      text(ctx, `现有 ${troop.name} Lv${unit.level}：${info.owned} / ${CONFIG.merge.need} 个（含本体）`, 70, 894, {
        size: 25, weight: '600', color: info.canMerge ? THEME.gold : THEME.text,
      });
      text(ctx, info.canMerge
        ? `消耗 1 个同级单位，把本体升到 Lv${unit.level + 1}`
        : `还差 1 个同级单位，去闯关 / 商城再拿一个`, 70, 934, { size: 21, color: THEME.textDim });
      text(ctx, `合成后：血 ${nextStats.hp} · 攻 ${nextStats.atk} · 防 ${nextStats.def} · 战力 ${formatPower(nextPower)}`
        + (nextSquad > squadSize ? ` · 小队 ${nextSquad} 人` : ''), 70, 972, {
        size: 20, color: info.canMerge ? '#9fd0a8' : THEME.textWeak, maxWidth: 640,
      });
    }

    button(ctx, this.mergeRect, info.atMax ? '已 满 级' : info.canMerge ? '合 成' : '材料不足', {
      size: 38,
      fill: info.canMerge ? '#332c1d' : THEME.panel2,
      stroke: info.canMerge ? THEME.goldDim : THEME.line,
      textColor: info.canMerge ? THEME.gold : THEME.textWeak,
    });
    if (!info.atMax && !info.canMerge) {
      text(ctx, `集齐 2 个 ${troop.name} Lv${unit.level} 即可合成`, 375, 1158, {
        size: 20, align: 'center', color: THEME.goldDim,
      });
    }
  }
}
