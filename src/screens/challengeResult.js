// 挑战结算（1.2.5）：每日挑战 / 周常挑战共用。
// 与英雄战结算同一套统计口径（输出 / 扩伤 Tab），奖励与跳转由调用方注入。
import { THEME, text, panel, button, hit, screenDim } from '../render/draw.js';
import { unitName, troopById } from '../core/units.js';
import { heroById } from '../data/heroes.js';
import { playSfx } from '../core/audio.js';

export class ChallengeResultScreen {
  // data: { title, subtitle, infoLines:[[主文字, 次文字]...], rewardLines:[{text, dim}] ,
  //         win, time, stats, primary:{label, go}, secondary:{label, go} }
  constructor(game, data) {
    this.game = game;
    this.d = data;
    this.win = data.win === true;
    this.bgm = 'main';
    this.noTapSound = true;
    this.rankTab = 'all';
    this.rankTabs = [];
    playSfx(this.win ? 'victory' : 'defeat', { volume: 0.75 });
  }

  update() {}

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
      if (this.d.primary && this.d.primary.go) this.d.primary.go(g);
      return;
    }
    if (hit(this.secondary, x, y)) {
      playSfx('tap', { volume: 0.8 });
      if (this.d.secondary && this.d.secondary.go) this.d.secondary.go(g);
    }
  }

  draw(ctx) {
    const g = this.game;
    const W = g.W;
    const color = this.win ? THEME.gold : THEME.red;
    const d = this.d;

    screenDim(ctx, W, g.H, 0.72);
    panel(ctx, 70, 220, 610, 1010, {
      fill: '#12171b', stroke: this.win ? THEME.gold : THEME.redDim, r: 24, lw: 3,
    });

    text(ctx, d.title || '挑 战', W / 2, 282, { size: 24, align: 'center', color: THEME.textDim });
    text(ctx, this.win ? '胜 利' : '失 败', W / 2, 356, {
      size: 64, weight: '700', align: 'center', color,
    });
    text(ctx, d.subtitle || '', W / 2, 420, {
      size: 28, weight: '600', align: 'center', color: THEME.gold, maxWidth: 560,
    });

    // 情报 / 进度两行
    const lines = Array.isArray(d.infoLines) ? d.infoLines.slice(0, 2) : [];
    panel(ctx, 120, 446, 510, 96, { fill: 'rgba(27,34,39,0.72)', stroke: THEME.line, r: 16 });
    lines.forEach((ln, i) => {
      text(ctx, ln, W / 2, 478 + i * 32, {
        size: i === 0 ? 19 : 16, align: 'center',
        color: i === 0 ? THEME.textDim : THEME.text,
      });
    });

    // 奖励区
    const rewards = Array.isArray(d.rewardLines) ? d.rewardLines : [];
    panel(ctx, 120, 558, 510, 90, { fill: 'rgba(58,44,22,0.6)', stroke: THEME.goldDim, r: 16 });
    if (rewards.length) {
      rewards.forEach((r, i) => {
        text(ctx, r.text || String(r), W / 2, 588 + i * 30, {
          size: i === 0 ? 22 : 16, weight: i === 0 ? '700' : '400',
          align: 'center', color: r.dim ? THEME.textDim : THEME.gold, maxWidth: 470,
        });
      });
    } else {
      text(ctx, this.win ? '无额外奖励' : '无损失', W / 2, 604, {
        size: 20, align: 'center', color: THEME.textDim,
      });
    }

    this.drawStats(ctx, 668);

    this.primary = { x: 175, y: 1080, w: 400, h: 80 };
    this.secondary = { x: 175, y: 1170, w: 400, h: 62 };
    button(ctx, this.primary, (this.d.primary && this.d.primary.label) || (this.win ? '继 续' : '重 试'), {
      size: 28, fill: '#273038', stroke: THEME.gold, textColor: THEME.gold,
    });
    button(ctx, this.secondary, (this.d.secondary && this.d.secondary.label) || '返 回', {
      size: 22, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textDim,
    });
  }

  // 输出 / 扩伤 Top5：与闯关、英雄战结算完全同一套统计字段与 Tab 口径
  drawStats(ctx, top) {
    const W = this.game.W;
    const p = { x: 70, y: top, w: 610, h: 390 };
    panel(ctx, p.x, p.y, p.w, p.h, { fill: 'rgba(39,48,56,0.72)', stroke: THEME.line, r: 18 });
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
        fill: active ? 'rgba(138,100,32,0.92)' : 'rgba(18,23,27,0.85)',
        stroke: active ? THEME.goldDim : THEME.line, r: 8, lw: active ? 2 : 1,
      });
      text(ctx, t.label, t.rect.x + t.rect.w / 2, t.rect.y + t.rect.h / 2, {
        size: 14, align: 'center', color: active ? THEME.gold : THEME.textDim,
      });
    }

    const list = Array.isArray(this.d.stats) ? this.d.stats : [];
    const headY = tabY + tabH + 14;
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

  drawStatRows(ctx, rows, x0, w, rowY, rowH, key, accent, wide = false, sumArg) {
    if (!rows.length) {
      text(ctx, '暂无', x0 + w / 2, rowY + 30, { size: 15, align: 'center', color: THEME.textWeak });
      return;
    }
    const sum = Math.max(1, sumArg || rows.reduce((n, s) => n + (s[key] || 0), 0));
    const rankColors = ['#f8e1ac', '#c0c6d0', '#c87a3d'];
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
        size: wide ? 16 : 13, color: hero ? '#d9c4f2' : THEME.text, maxWidth: wide ? 200 : 118,
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
