// 宝箱页：常规箱（小木 / 银 / 金）+ 特殊箱（稀有 / 史诗 / 传奇），铂金 / 玄玉先占位
import { THEME, text, panel, button, coinBadge, hit, backButton, infoBadge, infoModal } from '../render/draw.js';
import { chestTypes, chestCount, chestTotal, openChest, chestLevelBonus } from '../core/chests.js';
import { rosterSlots } from '../core/levels.js';
import { unitName, rarityOf, rarityInfo } from '../core/units.js';
import { noteChestOpened } from '../core/daily.js';
import { drawChest } from '../render/chest.js';
import { playSfx } from '../core/audio.js';

const ROW_X = 70;
const ROW_W = 610;
const ROW_H = 100;
const ROW_GAP = 8;

export class ChestScreen {
  constructor(game) {
    this.game = game;
    this.tutorialId = 'chests';
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.rows = [];
    this.lastReward = null;
    this.infoOpen = false;
    this.infoRect = { x: 664, y: 138, w: 56, h: 56 };
  }

  // 新手引导锚点：第一个能开的「开箱」按钮
  tutorialAnchors() {
    const row = this.rows.find((r) => r.openRect);
    return {
      chestOpen: row ? row.openRect : null,
      chestTotal: chestTotal(this.game.state),
    };
  }

  update() {}

  open(id) {
    const g = this.game;
    const r = openChest(g.state, id);
    if (!r.ok) {
      playSfx('error', { volume: 0.7 });
      if (r.reason === 'none') g.toast('这个宝箱已经开完了');
      else if (r.reason === 'full') g.toast('兵营已满：先去兵营合成同级兵，腾出格子再开');
      else if (r.reason === 'locked') g.toast('这一档宝箱还没开放（后续章节解锁）');
      else g.toast('这个宝箱暂时打不开');
      return;
    }
    this.lastReward = r.unit;
    noteChestOpened(g.state);
    // 开箱：普通 / 稀有用开箱号角，史诗 / 传奇再叠一层领奖风铃
    playSfx(rarityOf(r.unit.troop) === 'common' ? 'chest' : 'reward');
    g.tutorialDone?.('chest');
    g.save();
    g.toast(`开箱获得 ${unitName(r.unit.troop, r.unit.level)} Lv${r.unit.level}`);
    if (g.showcaseUnit) g.showcaseUnit(r.unit);
  }

  tap(x, y) {
    const g = this.game;
    if (this.infoOpen) { this.infoOpen = false; return; }
    if (hit(this.backRect, x, y)) return g.pop();
    if (hit(this.infoRect, x, y)) { this.infoOpen = true; return; }
    for (const row of this.rows) {
      if (row.openRect && hit(row.openRect, x, y)) {
        this.open(row.type.id);
        return;
      }
    }
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const slots = rosterSlots(st.maxCleared);
    const full = st.units.length >= slots.unlocked;
    const total = chestTotal(st);

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,18,12,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '宝 箱', W / 2 + 20, 76, { size: 34, weight: '600', align: 'center' });
    coinBadge(ctx, 700, 76, st.coins, { size: 24, align: 'right' });

    const late = st.maxCleared + 1 > 200;
    // 只保留大号主信息；掉落规则 / 加成 / 来源全部收进右上角「!」
    text(ctx, `宝箱 ${total} 个 · 兵营 ${st.units.length} / ${slots.unlocked}`, 44, 170, {
      size: 26, color: full ? THEME.red : THEME.textDim,
    });
    infoBadge(ctx, this.infoRect.x + 28, this.infoRect.y + 28, 22);

    this.rows = [];
    const regular = chestTypes().filter((t) => !t.locked && isRegularChest(t));
    const special = chestTypes().filter((t) => !t.locked && !isRegularChest(t));
    const locked = chestTypes().filter((t) => t.locked);

    text(ctx, '常规宝箱（关卡轮换）', 44, 226, { size: 28, color: THEME.textDim });
    regular.forEach((type, i) => this.drawRow(ctx, type, 44, 246 + i * (ROW_H + ROW_GAP), full));

    const specialTop = 246 + regular.length * (ROW_H + ROW_GAP) + 12;
    text(ctx, '特殊宝箱（必出对应品级）', 44, specialTop, { size: 28, color: THEME.textDim });
    special.forEach((type, i) => this.drawRow(ctx, type, 44, specialTop + 20 + i * (ROW_H + ROW_GAP), full));

    const bottom = specialTop + 20 + special.length * (ROW_H + ROW_GAP);

    if (this.lastReward) {
      const rar = rarityInfo(this.lastReward.troop);
      const specialUnit = rarityOf(this.lastReward.troop) !== 'common';
      text(ctx, `最近开出：${unitName(this.lastReward.troop, this.lastReward.level)} Lv${this.lastReward.level}`,
        W / 2, bottom + 20, {
          size: 26, align: 'center', color: specialUnit ? rar.color : THEME.gold,
        });
    }

    if (this.infoOpen) {
      const bonus = chestLevelBonus(st.maxCleared);
      const all = chestTypes();
      const lines = [
        late
          ? '首通掉落：200 关后每 5 关 1 银箱，每 20 关额外 1 金箱。'
          : '首通掉落：第 1 关与每 5 关 1 小木箱，20 关加银箱，50 关加金箱。',
        `当前通关加成：所有宝箱开出的兵种等级 +${bonus}（含挂机宝箱）。`,
        ...all.filter((t) => !t.locked).map((t) => `${t.name}：${t.desc}`),
        locked.length ? `后续档位：${locked.map((t) => `${t.name}（${t.desc}）`).join(' / ')}` : '',
        '宝箱来源：关卡首通、城池 / 章节通关、每日任务、签到、7 日登录、挂机。',
        '兵营已满时无法开箱，先去兵营合成腾出格子。',
      ].filter(Boolean);
      infoModal(ctx, W, g.H, '宝 箱 说 明', lines);
    }
  }

  // 一行：图标 + 名称 + 数量 + 掉落说明 + 开箱按钮
  drawRow(ctx, type, x, y, full) {
    const st = this.game.state;
    const count = chestCount(st, type.id);
    const canOpen = count > 0 && !full;
    const openRect = { x: x + ROW_W - 176, y: y + 24, w: 150, h: 52 };
    this.rows.push({ type, openRect: canOpen ? openRect : null });

    panel(ctx, x, y, ROW_W, ROW_H, {
      fill: count > 0 ? 'rgba(58,46,30,0.72)' : 'rgba(33,26,18,0.6)',
      stroke: count > 0 ? type.color : THEME.line,
      r: 18,
      lw: count > 0 ? 2 : 1,
    });

    drawChest(ctx, x + 58, y + 50, 0.5, {
      color: type.color,
      kind: type.id,
      alpha: count > 0 ? 1 : 0.4,
      glow: count > 0,
    });
    text(ctx, type.name, x + 104, y + 40, {
      size: 28, weight: '600', color: count > 0 ? THEME.text : THEME.textDim,
    });
    text(ctx, `×${count}`, x + 248, y + 40, {
      size: 26, color: count > 0 ? type.color : THEME.textWeak,
    });

    if (canOpen) {
      button(ctx, openRect, '开 箱', {
        size: 26, fill: '#221f2b', stroke: type.color, textColor: type.color,
      });
    } else {
      button(ctx, openRect, full ? '兵营已满' : '暂无宝箱', {
        size: 24, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak, disabled: true,
      });
    }
  }
}

// 常规箱 = 小木 / 银 / 金（按关卡发放）；特殊箱 = 稀有 / 史诗 / 传奇
function isRegularChest(type) {
  return type.id === 'wood' || type.id === 'silver' || type.id === 'gold';
}
