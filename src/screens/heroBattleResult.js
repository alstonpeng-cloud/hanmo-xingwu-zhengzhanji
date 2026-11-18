// 英雄战结算：显示 Boss 战结果、首通招募券奖励与下一步（下一关 / 重试 / 返回）
import { THEME, text, panel, button, hit, screenDim } from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import { heroBattleByStage, heroBattleDef } from '../data/heroBattles.js';
import { unitName, troopById } from '../core/units.js';
import { heroById } from '../data/heroes.js';
import { DeployScreen } from './deploy.js';
import { HeroBattleScreen } from './heroBattle.js';
import { playSfx } from '../core/audio.js';

export class HeroBattleResultScreen {
  constructor(game, data) {
    this.game = game;
    this.d = data;
    this.stage = data.stage;
    this.spec = heroBattleByStage(data.stage);
    this.win = data.win === true;
    this.scrolls = Math.max(0, data.scrolls || 0);
    this.bgm = 'main';
    this.noTapSound = true;
    // 与闯关 / 演武结算同一套统计口径：输出 / 承伤 × 我方 / 敌方
    this.rankTab = 'all';
    this.rankTabs = [];
    playSfx(this.win ? 'victory' : 'defeat', { volume: 0.75 });
  }

  update() {}

  nextSpec() {
    return this.win ? heroBattleByStage(this.stage + 1) : null;
  }

  tap(x, y) {
    const g = this.game;
    for (const t of this.rankTabs) {
      if (hit(t.rect, x, y)) {
        this.rankTab = t.key;
        playSfx('tap', { volume: 0.6 });
        return;
      }
    }
    if (hit(this.primary, x, y)) {
      playSfx('tap', { volume: 0.8 });
      if (!this.win) {
        g.go(new DeployScreen(g, { mode: 'battle', level: this.stage, heroBattle: this.spec, def: heroBattleDef(this.stage) }));
        return;
      }
      const next = this.nextSpec();
      if (next) g.go(new DeployScreen(g, { mode: 'battle', level: next.stage, heroBattle: next, def: heroBattleDef(next.stage) }));
      else g.go(new HeroBattleScreen(g));
      return;
    }
    if (hit(this.secondary, x, y)) {
      playSfx('tap', { volume: 0.8 });
      g.go(new HeroBattleScreen(g));
    }
  }

  draw(ctx) {
    const g = this.game;
    const W = g.W;
    const hero = this.spec ? heroById(this.spec.hero) : null;
    const next = this.nextSpec();
    const color = this.win ? THEME.gold : THEME.red;
    const cleared = Math.max(0, g.state.heroBattleCleared || 0);

    screenDim(ctx, W, g.H, 0.72);
    panel(ctx, 70, 220, 610, 1010, {
      fill: '#211a12', stroke: this.win ? THEME.gold : THEME.redDim, r: 24, lw: 3,
    });

    text(ctx, `英 雄 战 · 第 ${this.stage} 关`, W / 2, 282, {
      size: 24, align: 'center', color: THEME.textDim,
    });
    text(ctx, this.win ? '胜 利' : '失 败', W / 2, 356, {
      size: 64, weight: '700', align: 'center', color,
    });
    text(ctx, this.spec ? this.spec.name : '', W / 2, 420, {
      size: 30, weight: '600', align: 'center', color: THEME.gold,
    });
    const bossNames = (this.spec.bosses && this.spec.bosses.length > 1)
      ? this.spec.bosses.map((b) => (heroById(b.hero) || {}).name || b.hero).join(' / ')
      : (hero ? hero.name : '英雄');
    text(ctx, `${bossNames} · Boss 血量 ×${this.spec.hpMult} · ${(this.spec.squads || []).length} 队精锐`,
      W / 2, 458, { size: 18, align: 'center', color: '#e0a19a' });

    panel(ctx, 120, 486, 510, 96, { fill: 'rgba(43,34,23,0.72)', stroke: THEME.line, r: 16 });
    text(ctx, `战斗用时 ${Math.round(this.d.time || 0)} 秒 · 英雄战进度 ${cleared} / ${CONFIG.heroBattles.total}`, W / 2, 514, {
      size: 19, align: 'center', color: THEME.textDim,
    });
    if (this.win && next) {
      text(ctx, `已解锁：第 ${next.stage} 关「${next.name}」`, W / 2, 548, {
        size: 16, align: 'center', color: THEME.green,
      });
    } else if (this.win) {
      text(ctx, `英雄战 ${CONFIG.heroBattles.total} 关全通`, W / 2, 548, {
        size: 18, align: 'center', color: THEME.gold,
      });
    } else {
      text(ctx, '调整阵容再来', W / 2, 548, {
        size: 18, align: 'center', color: THEME.textDim,
      });
    }

    // 招募券奖励（本模式是额外来源）
    panel(ctx, 120, 598, 510, 90, { fill: 'rgba(58,44,22,0.6)', stroke: THEME.goldDim, r: 16 });
    if (this.win && this.scrolls > 0) {
      text(ctx, `首通奖励：招募券 +${this.scrolls}`, W / 2, 628, {
        size: 24, weight: '700', align: 'center', color: THEME.gold,
      });
      text(ctx, `每 ${CONFIG.heroBattles.scrollEvery} 关首通 1 张`, W / 2, 660, {
        size: 16, align: 'center', color: THEME.textDim,
      });
    } else if (this.win && this.d.firstClear) {
      text(ctx, '首通已记录', W / 2, 632, {
        size: 21, align: 'center', color: THEME.goldDim,
      });
      text(ctx, `再 ${CONFIG.heroBattles.scrollEvery - (this.stage % CONFIG.heroBattles.scrollEvery)} 关 +1 张`, W / 2, 660, {
        size: 16, align: 'center', color: THEME.textDim,
      });
    } else if (this.win) {
      text(ctx, '重复无券', W / 2, 632, { size: 21, align: 'center', color: THEME.textDim });
    } else {
      text(ctx, '无损失', W / 2, 632, { size: 21, align: 'center', color: THEME.textDim });
      text(ctx, '先清护卫 · 再打 Boss', W / 2, 660, { size: 16, align: 'center', color: THEME.textWeak });
    }

    this.drawStats(ctx, 720);

    this.primary = { x: 175, y: 1080, w: 400, h: 80 };
    this.secondary = { x: 175, y: 1170, w: 400, h: 62 };
    button(ctx, this.primary, !this.win ? '重 新 布 阵' : next ? '下 一 关' : '返 回 英 雄 战', {
      size: 28, fill: '#332c1d', stroke: THEME.gold, textColor: THEME.gold,
    });
    button(ctx, this.secondary, '返 回 英 雄 战', {
      size: 22, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textDim,
    });
  }

  // 输出 / 承伤 Top5：与闯关、演武结算完全同一套统计字段与 Tab 口径
  drawStats(ctx, top) {
    const W = this.game.W;
    const p = { x: 70, y: top, w: 610, h: 330 };
    panel(ctx, p.x, p.y, p.w, p.h, { fill: 'rgba(58,46,30,0.72)', stroke: THEME.line, r: 18 });
    text(ctx, '战斗统计', W / 2, p.y + 26, { size: 18, align: 'center', color: THEME.gold });

    const TABS = [
      { key: 'all', label: '综合' },
      { key: 'pDealt', label: '我方输出' },
      { key: 'eDealt', label: '敌方输出' },
      { key: 'pTaken', label: '我方承伤' },
      { key: 'eTaken', label: '敌方承伤' },
    ];
    const tabY = p.y + 42;
    const tabH = 32;
    const tabGap = 6;
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
        size: 14, align: 'center', color: active ? THEME.gold : THEME.textDim,
      });
    }

    const list = Array.isArray(this.d.stats) ? this.d.stats : [];
    const headY = tabY + tabH + 18;
    const rowY = headY + 12;
    const rowH = 44;
    if (!list.length) {
      text(ctx, '没有数据', W / 2, rowY + 60, { size: 16, align: 'center', color: THEME.textWeak });
      return;
    }

    if (this.rankTab === 'all') {
      const players = list.filter((s) => s.side === 'player').sort((a, b) => b.dealt - a.dealt).slice(0, 5);
      const enemies = list.filter((s) => s.side === 'enemy').sort((a, b) => b.dealt - a.dealt).slice(0, 5);
      const colW = (p.w - 32 - 12) / 2;
      const colL = p.x + 16;
      const colR = colL + colW + 12;
      text(ctx, '我方输出', colL, headY, { size: 13, color: THEME.green });
      text(ctx, '敌方输出', colR, headY, { size: 13, color: THEME.red });
      this.drawStatRows(ctx, players, colL, colW, rowY, rowH, 'dealt', THEME.green, false);
      this.drawStatRows(ctx, enemies, colR, colW, rowY, rowH, 'dealt', THEME.red, false);
      return;
    }

    const side = this.rankTab.startsWith('p') ? 'player' : 'enemy';
    const key = this.rankTab.includes('Dealt') ? 'dealt' : 'taken';
    const rows = list.filter((s) => s.side === side).sort((a, b) => b[key] - a[key]).slice(0, 5);
    const sum = list.filter((s) => s.side === side).reduce((n, s) => n + (s[key] || 0), 0);
    const unitLabel = key === 'dealt' ? '输出' : '承伤';
    const sideLabel = side === 'player' ? '我方' : '敌方';
    text(ctx, `${sideLabel}${unitLabel}`, W / 2, headY, {
      size: 13, align: 'center', color: THEME.textWeak,
    });
    this.drawStatRows(ctx, rows, p.x + 16, p.w - 32, rowY, rowH, key, side === 'player' ? THEME.green : THEME.red, true, sum);
  }

  // rank rows：数字 + 名字 + 百分比 / 数值；wide 模式带进度条
  drawStatRows(ctx, rows, x0, w, rowY, rowH, key, accent, wide = false, sumArg) {
    if (!rows.length) {
      text(ctx, '暂无', x0 + w / 2, rowY + 30, { size: 15, align: 'center', color: THEME.textWeak });
      return;
    }
    const sum = Math.max(1, sumArg || rows.reduce((n, s) => n + (s[key] || 0), 0));
    const rankColors = ['#ffd86c', '#c0c6d0', '#c87a3d'];
    for (let i = 0; i < rows.length; i++) {
      const s = rows[i];
      const y = rowY + i * rowH;
      const pct = Math.round((s[key] || 0) / sum * 100);
      text(ctx, `${i + 1}`, x0 + 10, y + 14, { size: 15, weight: '700', color: rankColors[i] || THEME.textWeak });
      const hero = s.hero ? heroById(s.hero) : null;
      const troop = s.troop && troopById(s.troop);
      const name = hero ? `${hero.name} Lv${s.level}`
        : troop ? `${unitName(s.troop, s.level)} Lv${s.level}`
          : `${heroById(s.troop) ? heroById(s.troop).name : (s.troop || '单位')} Lv${s.level || 1}`;
      text(ctx, name, x0 + 26, y + 14, {
        size: wide ? 16 : 13, color: hero ? '#c2b3c9' : THEME.text, maxWidth: wide ? 200 : 118,
      });
      if (wide) {
        text(ctx, `${pct}%`, x0 + 26, y + 32, { size: 12, color: THEME.textDim });
        text(ctx, `${s[key] || 0}`, x0 + w - 4, y + 14, { size: 17, weight: '700', align: 'right', color: accent });
        const barW = Math.max(40, w - 260);
        panel(ctx, x0 + 92, y + 18, barW, 12, { fill: 'rgba(18,14,10,0.8)', stroke: THEME.line, r: 6, lw: 1 });
        panel(ctx, x0 + 92, y + 18, barW * (s[key] || 0) / sum, 12, { fill: accent, stroke: accent, r: 6, lw: 0 });
      } else {
        text(ctx, `${s[key] || 0}`, x0 + w - 4, y + 14, { size: 14, weight: '700', align: 'right', color: accent });
      }
    }
  }
}
