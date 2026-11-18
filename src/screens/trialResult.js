// 演武结算：每次通关发稳定铜钱，首通另发黄金宝箱 / 里程碑传奇宝箱，显示胜负、奖励与下一步
import { THEME, text, panel, button, hit, screenDim, bar } from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import { trialByStage } from '../data/trials.js';
import { chestType } from '../core/chests.js';
import { formatPower } from '../core/power.js';
import { drawChest } from '../render/chest.js';
import { DeployScreen } from './deploy.js';
import { TrialScreen } from './trial.js';
import { playSfx } from '../core/audio.js';
import { unitName, spriteTierFor, rarityOf, rarityInfo } from '../core/units.js';
import { heroById } from '../data/heroes.js';
import { drawFrame, sheetFor } from '../render/sprites.js';

export class TrialResultScreen {
  constructor(game, data) {
    this.game = game;
    this.d = data;
    this.trial = data.trial;
    this.win = data.win === true;
    this.rewards = Array.isArray(data.rewards) ? data.rewards : [];
    // 每次通关都发的稳定铜钱（含重复挑战）
    this.coins = Math.max(0, Math.floor(data.coins || 0));
    this.bgm = 'main';
    this.noTapSound = true;
    // 输出扛伤 Tab 状态
    this._rankTab = 'all';
    this.rankTabs = null;
    playSfx(this.win ? 'victory' : 'defeat', { volume: 0.75 });
  }

  get rankTab() { return this._rankTab ?? 'all'; }
  set rankTab(v) { this._rankTab = v; }

  update() {}

  tap(x, y) {
    const g = this.game;

    // 输出扛伤 Top5 Tab 点击
    if (this.rankTabs) {
      for (const t of this.rankTabs) {
        if (hit(t.rect, x, y)) { this.rankTab = t.key; return; }
      }
    }

    if (hit(this.primary, x, y)) {
      playSfx('tap', { volume: 0.8 });
      if (this.win) g.go(new TrialScreen(g));
      else g.go(new DeployScreen(g, {
        mode: 'battle', level: this.trial.stage, trial: this.trial, def: this.trial,
      }));
      return;
    }
    if (hit(this.secondary, x, y)) {
      playSfx('tap', { volume: 0.8 });
      if (this.win) g.home();
      else g.go(new TrialScreen(g));
    }
  }

  draw(ctx) {
    const g = this.game;
    const W = g.W;
    const trial = this.trial;
    const next = trialByStage(trial.stage + 1);
    const cleared = Math.max(0, g.state.trialCleared || 0);
    const color = this.win ? THEME.gold : THEME.red;
    const showRewards = this.win && this.rewards.length > 0;

    screenDim(ctx, W, g.H, 0.7);
    panel(ctx, 70, 200, 610, 1100, {
      fill: '#211a12', stroke: this.win ? THEME.gold : THEME.redDim, r: 24, lw: 3,
    });

    text(ctx, `演 武 · 第 ${trial.stage} 关`, W / 2, 264, {
      size: 24, align: 'center', color: THEME.textDim,
    });
    text(ctx, this.win ? '胜 利' : '失 败', W / 2, 338, {
      size: 64, weight: '700', align: 'center', color,
    });
    text(ctx, trial.name, W / 2, 402, { size: 30, weight: '600', align: 'center', color: THEME.gold });
    text(ctx, trial.desc, W / 2, 440, {
      size: 17, align: 'center', color: THEME.textDim, maxWidth: 520,
    });

    // trial 信息面板（压缩高度）
    panel(ctx, 120, 458, 510, 112, { fill: 'rgba(43,34,23,0.72)', stroke: THEME.line, r: 16 });
    text(ctx, `敌方 ${trial.enemies.length} 支精英小队 · Lv${trial.enemyLevel}${trial.enemyLevelMax > trial.enemyLevel ? `~${trial.enemyLevelMax}` : ''}`, W / 2, 484, {
      size: 20, align: 'center', color: '#e8c3a0',
    });
    text(ctx, `战斗用时 ${Math.round(this.d.time || 0)} 秒 · 演武进度 ${Math.min(CONFIG.trials.total, cleared)} / ${CONFIG.trials.total}`, W / 2, 520, {
      size: 17, align: 'center', color: THEME.textDim,
    });
    if (this.win && next) {
      text(ctx, `已解锁：第 ${next.stage} 关「${next.name}」`, W / 2, 548, {
        size: 16, align: 'center', color: THEME.green,
      });
    } else if (this.win && trial.stage >= CONFIG.trials.total) {
      text(ctx, '演武全部通关：无双演武达成', W / 2, 548, {
        size: 16, align: 'center', color: THEME.gold,
      });
    } else if (!this.win) {
      text(ctx, '调整站位再来', W / 2, 548, {
        size: 18, align: 'center', color: THEME.textDim,
      });
    }

    // 战斗统计 Top5 面板
    this.drawRankings(ctx, 578);

    // 奖励 / 提示
    if (showRewards) {
      this.drawRewards(ctx, W);
    } else if (this.win && this.coins > 0) {
      text(ctx, `重复 +${formatPower(this.coins)} 铜钱`, W / 2, 1088, {
        size: 18, align: 'center', color: THEME.textWeak,
      });
    } else {
      text(ctx, this.win ? '奖励已领' : '无损失', W / 2, 1088, {
        size: 18, align: 'center', color: THEME.textWeak,
      });
    }

    // 按钮
    this.primary = { x: 175, y: 1122, w: 400, h: 80 };
    this.secondary = { x: 175, y: 1212, w: 400, h: 66 };
    button(ctx, this.primary, this.win ? '继 续 演 武' : '重 新 布 阵', {
      size: 28, fill: '#332c1d', stroke: THEME.gold, textColor: THEME.gold,
    });
    button(ctx, this.secondary, this.win ? '返 回 首 页' : '返 回 演 武', {
      size: 22, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textDim,
    });
  }

  // 演武战斗统计 Top5（布局与结算页一致：综合 = 左右双栏，单项 = 单列带进度条，全部显示百分比）
  drawRankings(ctx, top) {
    const p = { x: 70, y: top, w: 610, h: 470 };
    panel(ctx, p.x, p.y, p.w, p.h, { fill: 'rgba(58,46,30,0.72)', stroke: THEME.line, r: 18 });
    text(ctx, '战斗统计', p.x + p.w / 2, p.y + 24, { size: 17, align: 'center', color: THEME.gold });

    const TABS = [
      { key: 'all',     label: '综合' },
      { key: 'pDealt',  label: '我方输出' },
      { key: 'eDealt',  label: '敌方输出' },
      { key: 'pTaken',  label: '我方承伤' },
      { key: 'eTaken',  label: '敌方承伤' },
    ];
    const tabH = 38;
    const tabGap = 8;
    const tabY = p.y + 46;
    const tabW = Math.floor((p.w - 32 - tabGap * (TABS.length - 1)) / TABS.length);
    this.rankTabs = TABS.map((t, i) => ({
      key: t.key,
      label: t.label,
      rect: { x: p.x + 16 + i * (tabW + tabGap), y: tabY, w: tabW, h: tabH },
    }));
    for (const t of this.rankTabs) {
      const active = t.key === this.rankTab;
      panel(ctx, t.rect.x, t.rect.y, t.rect.w, t.rect.h, {
        fill: active ? 'rgba(154,116,44,0.92)' : 'rgba(30,24,16,0.85)',
        stroke: active ? THEME.goldDim : THEME.line, r: 8, lw: active ? 2 : 1,
      });
      text(ctx, t.label, t.rect.x + t.rect.w / 2, t.rect.y + t.rect.h / 2, {
        size: 17, align: 'center', color: active ? THEME.gold : THEME.textDim,
      });
    }

    const list = Array.isArray(this.d.stats) ? this.d.stats : [];
    const rowH = 70;
    const headY = tabY + tabH + 16;
    const rowY = headY + 20;

    if (list.length === 0) {
      text(ctx, '没有数据', p.x + p.w / 2, rowY + 30, { size: 16, align: 'center', color: THEME.textWeak });
      return;
    }

    if (this.rankTab === 'all') {
      const players = list.filter((s) => s.side === 'player').sort((a, b) => b.dealt - a.dealt).slice(0, 5);
      const enemies = list.filter((s) => s.side === 'enemy').sort((a, b) => b.dealt - a.dealt).slice(0, 5);
      const colW = (p.w - 32 - 16) / 2;
      const colL = p.x + 16;
      const colR = p.x + 16 + colW + 16;
      const sumP = list.filter((s) => s.side === 'player').reduce((n, s) => n + s.dealt, 0);
      const sumE = list.filter((s) => s.side === 'enemy').reduce((n, s) => n + s.dealt, 0);
      text(ctx, '我方输出', colL, headY, { size: 13, color: THEME.green });
      text(ctx, '敌方输出', colR, headY, { size: 13, color: THEME.red });
      this.drawRankColumn(ctx, players, colL, colW, rowY, rowH, 'dealt', sumP, THEME.green);
      this.drawRankColumn(ctx, enemies, colR, colW, rowY, rowH, 'dealt', sumE, THEME.red);
      return;
    }

    const side = this.rankTab.startsWith('p') ? 'player' : 'enemy';
    const key = this.rankTab.includes('Dealt') ? 'dealt' : 'taken';
    const rows = list.filter((s) => s.side === side).sort((a, b) => b[key] - a[key]).slice(0, 5);
    const sum = list.filter((s) => s.side === side).reduce((n, s) => n + s[key], 0);
    const sideLabel = side === 'player' ? '我方' : '敌方';
    const unitLabel = key === 'dealt' ? '输出' : '承伤';
    text(ctx, `${sideLabel}${unitLabel}`, p.x + p.w / 2, headY, {
      size: 13, align: 'center', color: THEME.textWeak,
    });
    this.drawRankColumn(ctx, rows, p.x + 16, p.w - 32, rowY, rowH, key, sum, side === 'player' ? THEME.green : THEME.red, true);
  }

  drawRankColumn(ctx, rows, x0, w, rowY, rowH, key, sum, accent, wide = false) {
    if (rows.length === 0) {
      text(ctx, '暂无', x0 + w / 2, rowY + 30, { size: 15, align: 'center', color: THEME.textWeak });
      return;
    }
    const rankColors = ['#ffd86c', '#c0c6d0', '#c87a3d'];
    const iconScale = wide ? 0.62 : 0.44;
    const rankR = wide ? 16 : 12;
    const nameX = wide ? x0 + 100 : x0 + 66;
    const barX = wide ? x0 + 316 : x0 + 66;
    const barW = wide ? 210 : w - 66 - 62;
    const barH = wide ? 26 : 19;
    for (let i = 0; i < rows.length; i++) {
      const s = rows[i];
      const y = rowY + i * rowH;
      const cy = y + rowH / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x0 + rankR, cy, rankR, 0, Math.PI * 2);
      ctx.fillStyle = '#1c1610';
      ctx.fill();
      ctx.strokeStyle = rankColors[i] || THEME.textDim;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = rankColors[i] || THEME.textDim;
      ctx.font = wide ? 'bold 18px Consolas' : 'bold 13px Consolas';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x0 + rankR, cy);
      ctx.restore();

      drawFrame(ctx, sheetFor(s.troop, spriteTierFor(s.level)), 'idle', 0,
        wide ? x0 + 62 : x0 + 40, y + rowH - 8, iconScale, false, 0.95);

      const rar = s.hero ? CONFIG.rarity.epic : rarityInfo(s.troop);
      const special = !!s.hero || rarityOf(s.troop) !== 'common';
      const hero = s.hero ? heroById(s.hero) : null;
      const name = hero ? `${hero.name} Lv${s.level}` : `${unitName(s.troop, s.level)} Lv${s.level}`;
      text(ctx, name, nameX, wide ? cy - 14 : y + 20, {
        size: wide ? 24 : 17, color: special ? rar.color : THEME.text,
        maxWidth: wide ? 190 : w - 66 - 78,
      });
      if (wide) {
        text(ctx, `击杀 ${s.kills || 0}`, nameX, cy + 16, { size: 14, color: THEME.textWeak });
      }

      const val = s[key] || 0;
      const pct = sum > 0 ? val / sum : 0;
      const pctText = `${Math.round(pct * 100)}%`;

      const bY = wide ? cy - barH / 2 : y + 40;
      bar(ctx, barX, bY, barW, barH, pct, { fill: accent, stroke: '#4a3a24', r: 6 });
      text(ctx, pctText, barX + barW / 2, bY + barH / 2, {
        size: wide ? 20 : 13, weight: '700', align: 'center', color: '#f4efe2',
      });

      text(ctx, `${val}`, x0 + w - 6, cy, {
        size: wide ? 30 : 19, weight: '700', align: 'right', color: THEME.gold,
      });
    }
  }

  // 通关奖励：首通每关 1 个黄金宝箱；10 / 20 / 25 关额外 1 个传奇宝箱
  drawRewards(ctx, W) {
    const list = this.rewards.slice(0, 3);
    panel(ctx, 100, 1054, 550, 58, {
      fill: 'rgba(58,44,22,0.55)', stroke: THEME.goldDim, r: 16,
    });

    const step = 550 / list.length;
    text(ctx, '通关奖励', 112, 1076, {
      size: 17, color: THEME.gold,
    });
    if (this.coins > 0) {
      text(ctx, `铜钱 +${formatPower(this.coins)}`, 638, 1076, {
        size: 15, align: 'right', color: THEME.gold,
      });
    }
    list.forEach((r, i) => {
      const type = chestType(r.id);
      if (!type) return;
      const cx = 100 + step * (i + 0.5);
      text(ctx, `${type.name} ×${r.count}`, cx, 1098, {
        size: 15, align: 'center', color: type.color,
      });
    });
  }
}
