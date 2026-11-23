// 过 5 关斩 6 将：章节选择 + 一冲到底跑关
// 规则：用现有兵牌连闯 5 关；兵死不可复活（兵牌灰掉）、血量跨关不回复、
// 已上阵不能撤下只能调位置；每章首通给自选卡包，每日首次通关有额外奖励。
import { THEME, text, panel, button, bar, hit, backButton, infoBadge, infoModal } from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import { unitName, rarityOf, spriteTierFor } from '../core/units.js';
import { heroById } from '../data/heroes.js';
import { playSfx } from '../core/audio.js';
import { BattleScreen } from './battle.js';
import { DeployScreen } from './deploy.js';
import { drawFrame, sheetFor } from '../render/sprites.js';
import { drawHeroFigure, drawHeroAura, heroAuraColor } from '../render/heroArt.js';
import {
  gauntletUnlocked, gauntletChapterView, gauntletDailyAvailable,
  startGauntletRun, gauntletRunSquads, swapGauntletUnits,
  completeGauntletChapter, gauntletStageOf,
} from '../core/gauntlet.js';
import { gauntletStageDef } from '../data/gauntlet.js';
import { pendingRecruitBoxes, recruitBoxChoices, claimRecruitBox } from '../core/heroes.js';

const W = 750;
const CELL = { w: 132, h: 96, gapX: 6, gapY: 6, x0: 33, y0: 252 };

function troopLabel(u) {
  return u.hero ? ((heroById(u.hero) || {}).name || '英雄') : unitName(u.troop, u.level);
}

export class GauntletScreen {
  constructor(game, opts = {}) {
    this.game = game;
    this.bgm = 'main';
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.view = game.state.gauntlet && game.state.gauntlet.run ? 'run' : 'list';
    this.pickFirst = null; // 调位置：先点选的空格 / 兵牌
    this.boxPick = null;   // 正在选兵的自选卡包
    this.summary = opts.summary || null;
    this.flash = opts.flash || '';
    this.hitRects = [];
    this.t = 0;
    this.page = 0;      // 12 章分 2 页，避免 6 行卡片超出屏幕
    this.infoOpen = false;
    this.infoRect = { x: 656, y: 40, w: 64, h: 64 };
    if (this.flash) game.toast(this.flash);
  }

  update(dt) { this.t += dt; }

  chapterRects() {
    const list = gauntletChapterView(this.game.state);
    const pageSize = 6;   // 每页 2 列 × 3 行
    const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
    this.page = Math.max(0, Math.min(this.page, pageCount - 1));
    const slice = list.slice(this.page * pageSize, (this.page + 1) * pageSize);
    const w = 330;
    const h = 206;
    const gap = 20;
    return slice.map((ch, i) => ({
      ch,
      rect: {
        x: 32 + (i % 2) * (w + gap),
        y: 196 + Math.floor(i / 2) * (h + gap),
        w, h,
      },
    }));
  }

  pageCount() {
    return Math.max(1, Math.ceil(gauntletChapterView(this.game.state).length / 6));
  }

  onTapPage(id) {
    const max = this.pageCount();
    const next = id === 'prev' ? this.page - 1 : this.page + 1;
    if (next < 0 || next >= max) {
      playSfx('error', { volume: 0.7 });
      return;
    }
    this.page = next;
    playSfx('tap', { volume: 0.6 });
  }

  cellRect(col, row) {
    return {
      x: CELL.x0 + col * (CELL.w + CELL.gapX),
      y: CELL.y0 + row * (CELL.h + CELL.gapY),
      w: CELL.w, h: CELL.h,
    };
  }

  // 当前跑关：把兵牌按「col / row」落到 5×5 格子里
  unitAt(col, row) {
    const run = this.game.state.gauntlet && this.game.state.gauntlet.run;
    if (!run) return { unit: null, index: -1 };
    const index = run.units.findIndex((u) => u.col === col && u.row === row);
    return { unit: index >= 0 ? run.units[index] : null, index };
  }

  onDown(x, y) {
    const st = this.game.state;
    if (this.infoOpen) {
      this.infoOpen = false;
      return;
    }
    if (this.summary) {
      this.summary = null;
      this.game.save();
      return;
    }
    if (this.boxPick) {
      for (const c of this.boxPickRects || []) {
        if (hit(c.rect, x, y)) {
          const r = claimRecruitBox(st, this.boxPick.id, c.troop.id);
          if (r.ok) {
            playSfx('reward', { volume: 0.7 });
            this.game.toast(`获得 ${unitName(c.troop.id, r.level)} Lv${r.level}`);
            this.boxPick = null;
            this.game.save();
          } else {
            playSfx('error', { volume: 0.7 });
            this.game.toast(r.reason === 'full' ? '兵营已满，先清理兵营' : '暂时不能选择这个兵种');
          }
          return;
        }
      }
      this.boxPick = null;
      return;
    }
    if (hit(this.backRect, x, y)) {
      // 跑关页的返回先回章节列表，不要直接退出整个模式
      if (this.view === 'run') { this.view = 'list'; this.pickFirst = null; return; }
      return this.game.pop();
    }
    if (hit(this.infoRect, x, y)) {
      this.infoOpen = true;
      return;
    }

    for (const c of this.hitRects) {
      if (!hit(c.rect, x, y)) continue;
      if (c.kind === 'chapter') return this.onTapChapter(c.ch);
      if (c.kind === 'page') return this.onTapPage(c.id);
      if (c.kind === 'cell') return this.onTapCell(c.unit);
      if (c.kind === 'btn') return this.onTapButton(c.id);
      if (c.kind === 'box') return this.openBoxPicker(c.box);
    }
  }

  onTapChapter(ch) {
    const g = this.game;
    const st = g.state;
    if (!gauntletUnlocked(st)) {
      g.toast(`主线通关 ${CONFIG.gauntlet.unlockLevel} 关后开放`);
      return;
    }
    if (st.gauntlet && st.gauntlet.run) {
      if (st.gauntlet.run.chapter === ch.id) {
        this.view = 'run';
        return;
      }
      g.toast('当前有一场冲锋进行中，先打完或放弃');
      return;
    }
    if (!ch.unlocked) {
      playSfx('error', { volume: 0.7 });
      g.toast(`先首通上一章「${ch.name}」`);
      return;
    }
    // 先走和普通闯关完全相同的布阵页：看得见兵模型、能拖拽调阵、能上英雄，
    // 点「开始冲锋」才把当前布阵快照成一次 run。
    this.openDeploy(ch);
  }

  openDeploy(ch) {
    const g = this.game;
    const begin = (state) => {
      const r = startGauntletRun(state, ch.id);
      if (!r.ok) {
        playSfx('error', { volume: 0.7 });
        g.toast(r.reason === 'empty'
          ? '先在布阵页至少上阵 1 个兵 / 英雄' : '暂时无法开始冲锋');
        return null;
      }
      playSfx('tap', { volume: 0.6 });
      g.save();
      g.go(new GauntletScreen(g, { flash: '布阵完成 · 开始冲锋' }));
      return r;
    };
    g.push(new DeployScreen(g, {
      mode: 'battle',
      level: 1,
      def: gauntletStageDef(ch.id, 1),
      gauntletChapter: ch.id,
      onGauntletConfirm: begin,
    }));
  }

  onTapCell(unit) {
    if (!unit) return;
    if (unit.dead) {
      this.game.toast('该兵牌已阵亡，本场不能再上场');
      return;
    }
    const run = this.game.state.gauntlet.run;
    if (!this.pickFirst) {
      this.pickFirst = unit;
      this.game.toast(`已选 ${troopLabel(unit)}，再点一个存活兵牌交换位置`);
      return;
    }
    const a = run.units.indexOf(this.pickFirst);
    const b = run.units.indexOf(unit);
    if (a === b) {
      this.pickFirst = null;
      return;
    }
    swapGauntletUnits(run, a, b);
    playSfx('tap', { volume: 0.5 });
    this.pickFirst = null;
    this.game.save();
  }

  onTapButton(id) {
    const g = this.game;
    const st = g.state;
    const run = st.gauntlet && st.gauntlet.run;
    if (id === 'back' && this.view === 'run') {
      this.view = 'list';
      this.pickFirst = null;
      return;
    }
    if (!run) return;
    // 重新布阵 = 放弃本次冲锋，回到和主线一样的布阵页（可换兵、可上英雄）
    if (id === 'redeploy') {
      const ch = gauntletChapterView(st).find((c) => c.id === run.chapter);
      st.gauntlet.run = null;
      this.pickFirst = null;
      this.view = 'list';   // 从布阵页返回时落在章节列表，不会停在空的跑关页
      g.save();
      if (ch) this.openDeploy(ch);
      else this.view = 'list';
      g.toast('已放弃本次冲锋 · 重新布阵（可上英雄）');
      return;
    }
    if (id === 'abandon') {
      st.gauntlet.run = null;
      this.view = 'list';
      this.pickFirst = null;
      g.toast('已放弃本次冲锋（可重新开始，兵力恢复满血）');
      g.save();
      return;
    }
    if (id === 'fight') {
      const def = gauntletStageDef(run.chapter, run.stage);
      const squads = gauntletRunSquads(run);
      if (!squads.length) {
        g.toast('没有可出战的兵牌了');
        return;
      }
      g.push(new BattleScreen(g, run.stage, Math.random, {
        gauntlet: { run, stage: run.stage },
        def,
      }));
    }
  }

  openBoxPicker(box) {
    this.boxPick = box;
    this.boxPickRects = [];
    this.game.save();
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    this.hitRects = [];

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.92)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '过 5 关 斩 6 将', W / 2 + 20, 76, { size: 36, weight: '700', align: 'center', color: THEME.gold });
    infoBadge(ctx, this.infoRect.x + 32, this.infoRect.y + 32, 24);

    if (!gauntletUnlocked(st)) {
      this.drawLocked(ctx);
      return;
    }
    if (this.view === 'run' && st.gauntlet && st.gauntlet.run) this.drawRun(ctx);
    else this.drawList(ctx);
    if (this.boxPick) this.drawBoxPicker(ctx);
    if (this.summary) this.drawSummary(ctx);
    if (this.infoOpen) this.drawInfo(ctx);
  }

  drawInfo(ctx) {
    const g = this.game;
    infoModal(ctx, g.W, g.H, '斩 将 场 规 则', [
      '开跑前先进入布阵页：和普通闯关一样，能看到兵模型、拖拽调阵、也能上英雄。',
      '共 12 章 60 关，章节越往后敌将越强，最终章强度约等于主线终章。',
      '用现有兵牌连闯 5 关，每关 1 名敌将，一章共 6 将。',
      '兵牌阵亡本场不可复活，对应兵牌直接灰掉；血量跨关不回复。',
      '冲锋期间只能两两交换阵位；想换兵 / 上英雄点「重新布阵」。',
      '可无限重来；每章首通给自选卡包，每日首通另有奖励。',
      '已通关章节次日可直接从后面的章节开始。',
    ]);
  }

  drawLocked(ctx) {
    const st = this.game.state;
    panel(ctx, 70, 300, 610, 240, { fill: 'rgba(43,34,23,0.7)', stroke: THEME.line, r: 18 });
    text(ctx, '尚 未 开 放', 375, 360, { size: 30, weight: '600', align: 'center', color: THEME.text });
    text(ctx, `主线通关 ${CONFIG.gauntlet.unlockLevel} 关后开启`, 375, 420, {
      size: 22, align: 'center', color: THEME.textDim,
    });
    text(ctx, `当前 ${st.maxCleared} / ${CONFIG.gauntlet.unlockLevel} 关`, 375, 470, {
      size: 20, align: 'center', color: THEME.gold,
    });
  }

  drawList(ctx) {
    const st = this.game.state;
    const daily = gauntletDailyAvailable(st);
    text(ctx, '选择章节', 44, 164, { size: 28, weight: '600', color: THEME.text });
    text(ctx, daily ? '今日奖励 可领' : '今日奖励 已领', 704, 160, {
      size: 19, align: 'right', color: daily ? THEME.gold : THEME.textWeak,
    });

    for (const c of this.chapterRects()) {
      const ch = c.ch;
      const r = c.rect;
      this.hitRects.push({ kind: 'chapter', rect: r, ch });
      panel(ctx, r.x, r.y, r.w, r.h, {
        fill: ch.cleared ? 'rgba(58,46,30,0.82)' : ch.unlocked ? '#2b2217' : '#17130e',
        stroke: ch.cleared ? THEME.gold : ch.unlocked ? THEME.goldDim : THEME.line,
        r: 14, lw: ch.unlocked && !ch.cleared ? 2 : 1,
      });
      text(ctx, `第 ${ch.index + 1} 章 · 6 将`, r.x + 16, r.y + 28, {
        size: 15, color: ch.cleared ? THEME.gold : THEME.textWeak,
      });
      text(ctx, ch.name, r.x + 16, r.y + 66, { size: 30, weight: '700', color: ch.cleared ? THEME.gold : THEME.text });
      const rewardColor = (CONFIG.rarity[ch.rarity] && CONFIG.rarity[ch.rarity].color) || THEME.textDim;
      const rarName = CONFIG.rarity[ch.rarity] ? CONFIG.rarity[ch.rarity].name : ch.rarity;
      text(ctx, `${rarName}自选 Lv${ch.boxLevel}`, r.x + 16, r.y + 104, {
        size: 18, color: rewardColor, maxWidth: r.w - 150,
      });
      // 铜钱用图标 + 右对齐数字，不再写「铜钱」两个字
      ctx.save();
      ctx.beginPath();
      ctx.arc(r.x + r.w - 66, r.y + 98, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#d59947';
      ctx.fill();
      ctx.strokeStyle = '#7c5f2a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      text(ctx, `${ch.firstClearCoins}`, r.x + r.w - 16, r.y + 104, {
        size: 18, align: 'right', color: '#d59947',
      });
      text(ctx, ch.cleared ? '已首通 · 可重复刷' : ch.unlocked ? '布 阵 后 开 跑' : '先通上一章',
        r.x + 16, r.y + 152, {
          size: 19, weight: '600',
          color: ch.cleared ? THEME.gold : ch.unlocked ? THEME.green : THEME.textWeak,
        });
      if (ch.current) {
        text(ctx, `进行中 · 第 ${ch.stage} 关`, r.x + r.w - 16, r.y + 28, {
          size: 15, align: 'right', color: THEME.green,
        });
      }
    }

    // 自选卡包（可能来自章节首通）：放在列表底部，点击直接选兵
    const boxes = pendingRecruitBoxes(st);
    if (boxes.length) {
      const r = { x: 32, y: 902, w: 686, h: 62 };
      this.hitRects.push({ kind: 'box', rect: r, box: boxes[0] });
      panel(ctx, r.x, r.y, r.w, r.h, { fill: 'rgba(58,44,22,0.75)', stroke: THEME.goldDim, r: 14 });
      const rar = CONFIG.rarity[boxes[0].rarity] || {};
      text(ctx, `自选卡包 ×${boxes.length} · ${rar.name || boxes[0].rarity} Lv${boxes[0].level}`,
        r.x + 18, r.y + 38, { size: 21, weight: '600', color: THEME.gold });
      text(ctx, '点 击 选 兵', r.x + r.w - 18, r.y + 38, {
        size: 18, align: 'right', color: THEME.text,
      });
    }

    // 12 章分 2 页：翻页按钮放在自选卡包下方，不占卡片区
    const pageCount = this.pageCount();
    if (pageCount > 1) {
      const prev = { x: 70, y: 990, w: 210, h: 64 };
      const next = { x: 470, y: 990, w: 210, h: 64 };
      this.hitRects.push({ kind: 'page', id: 'prev', rect: prev });
      this.hitRects.push({ kind: 'page', id: 'next', rect: next });
      button(ctx, prev, '上 一 页', {
        size: 22, fill: this.page > 0 ? THEME.panel2 : THEME.panel,
        stroke: THEME.line, textColor: this.page > 0 ? THEME.text : THEME.textWeak,
      });
      button(ctx, next, '下 一 页', {
        size: 22, fill: this.page < pageCount - 1 ? THEME.panel2 : THEME.panel,
        stroke: THEME.line, textColor: this.page < pageCount - 1 ? THEME.text : THEME.textWeak,
      });
      text(ctx, `${this.page + 1} / ${pageCount} 页`,
        375, 1022, { size: 20, align: 'center', color: THEME.textDim });
      text(ctx, `共 ${gauntletChapterView(st).length} 章 · 难度逐章递增`,
        375, 1080, { size: 18, align: 'center', color: THEME.goldDim });
    }
  }

  drawRun(ctx) {
    const st = this.game.state;
    const run = st.gauntlet.run;
    const ch = gauntletChapterView(st).find((c) => c.id === run.chapter);
    const alive = run.units.filter((u) => !u.dead).length;
    const hpAvg = run.units.filter((u) => !u.dead).reduce((s, u) => s + u.hpPct, 0) / Math.max(1, alive);

    text(ctx, `${ch ? ch.name : run.chapter} · 第 ${run.stage} / ${CONFIG.gauntlet.stagesPerChapter} 关`,
      W / 2, 160, { size: 28, weight: '600', align: 'center', color: THEME.gold });

    // 关卡进度点
    for (let i = 0; i < CONFIG.gauntlet.stagesPerChapter; i++) {
      const x = 375 + (i - 2) * 46;
      const done = i + 1 < run.stage;
      const cur = i + 1 === run.stage;
      ctx.save();
      ctx.fillStyle = done ? THEME.gold : cur ? THEME.green : '#2a3342';
      ctx.beginPath();
      ctx.arc(x, 218, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5×5 阵位：和普通闯关布阵页用同一套兵模型 / 英雄立绘，阵亡的灰掉
    this.hitRects = [];
    for (let col = 0; col < CONFIG.formation.cols; col++) {
      for (let row = 0; row < CONFIG.formation.rows; row++) {
        const r = this.cellRect(col, row);
        const { unit } = this.unitAt(col, row);
        const picked = unit && unit === this.pickFirst;
        const heroCfg = unit && unit.hero ? heroById(unit.hero) : null;
        const frameColor = heroCfg ? heroAuraColor(heroCfg)
          : (CONFIG.rarity[unit ? rarityOf(unit.troop) : ''] || {}).color || THEME.textDim;
        panel(ctx, r.x, r.y, r.w, r.h, {
          fill: unit ? (unit.dead ? '#1a1e24' : '#2b2217') : 'rgba(20,26,35,0.5)',
          stroke: picked ? THEME.green : unit && !unit.dead ? frameColor : THEME.line,
          r: 10, lw: picked ? 2.5 : 1,
        });
        if (!unit) continue;
        this.hitRects.push({ kind: 'cell', rect: r, unit });
        // 顶栏小字：名称 / 等级 / 血量，模型居中占主要面积
        text(ctx, troopLabel(unit), r.x + 6, r.y + 14, {
          size: 12, weight: '600', align: 'left',
          color: unit.dead ? '#5b636f' : frameColor, maxWidth: r.w - 50,
        });
        text(ctx, unit.hero ? '将' : `Lv${unit.level}`, r.x + r.w - 6, r.y + 14, {
          size: 11, align: 'right', color: unit.dead ? '#4a515c' : THEME.textDim,
        });
        const cx = r.x + r.w / 2;
        const feet = r.y + 82;
        ctx.save();
        if (unit.dead) ctx.globalAlpha = 0.28;
        if (heroCfg) {
          drawHeroAura(ctx, heroCfg.tier, cx, feet - 3, 58, this.t, unit.dead ? 0.25 : 0.7);
          drawHeroFigure(ctx, heroCfg.id, { x: cx, y: feet, size: 64, action: 'idle', t: this.t });
        } else {
          // 普通兵：运行时程序化精灵（和普通闯关 / 战斗页完全一致）
          drawFrame(ctx, sheetFor(unit.troop, spriteTierFor(unit.level)), 'idle', 0, cx, feet, 0.62);
        }
        ctx.restore();
        if (unit.dead) {
          panel(ctx, r.x + 6, r.y + 58, r.w - 12, 22, { fill: 'rgba(10,12,16,0.84)', stroke: null, r: 6, lw: 0 });
          text(ctx, '阵 亡', cx, r.y + 70, { size: 15, weight: '600', align: 'center', color: '#a35b54' });
        } else {
          bar(ctx, r.x + 8, r.y + 85, r.w - 16, 7, unit.hpPct, {
            fill: unit.hpPct > 0.5 ? THEME.green : unit.hpPct > 0.25 ? '#d8a74a' : THEME.red,
            stroke: null, bg: '#10151d', r: 4,
          });
          text(ctx, `${Math.round(unit.hpPct * 100)}%`, r.x + r.w - 6, r.y + 29, {
            size: 11, align: 'right',
            color: unit.hpPct > 0.5 ? THEME.green : unit.hpPct > 0.25 ? '#d8a74a' : THEME.red,
          });
        }
      }
    }

    text(ctx, `存活 ${alive} / ${run.units.length} · 平均血量 ${Math.round(hpAvg * 100)}%`, 375, 816, {
      size: 24, weight: '600', align: 'center', color: THEME.text,
    });
    text(ctx, '点两个存活兵牌 = 交换阵位 · 想换兵 / 上英雄请「重新布阵」', 375, 864, {
      size: 17, align: 'center', color: THEME.textWeak,
    });

    const b1 = { x: 48, y: 930, w: 300, h: 76 };
    const b2 = { x: 402, y: 930, w: 300, h: 76 };
    const b3 = { x: 225, y: 1024, w: 300, h: 58 };
    this.hitRects.push({ kind: 'btn', rect: b1, id: 'redeploy' });
    this.hitRects.push({ kind: 'btn', rect: b2, id: 'fight' });
    this.hitRects.push({ kind: 'btn', rect: b3, id: 'abandon' });
    button(ctx, b1, '重 新 布 阵', { size: 24, fill: THEME.panel, stroke: THEME.goldDim, textColor: THEME.gold });
    button(ctx, b2, run.stage === 1 ? '开 战' : '继 续 闯 关', {
      size: 26, fill: '#332c1d', stroke: THEME.gold, textColor: THEME.gold,
    });
    button(ctx, b3, '放 弃 本 次', { size: 20, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak });
    text(ctx, '重新布阵会放弃本次冲锋进度（兵力恢复满血）', 375, 1112, {
      size: 15, align: 'center', color: THEME.textWeak,
    });
  }

  drawBoxPicker(ctx) {
    const st = this.game.state;
    const box = this.boxPick;
    ctx.save();
    ctx.fillStyle = 'rgba(13,10,7,0.86)';
    ctx.fillRect(0, 0, W, 1334);
    ctx.restore();
    const choices = recruitBoxChoices(st, box);
    const cols = 3;
    const cw = 206;
    const chh = 108;
    const gap = 14;
    const x0 = (W - (cols * cw + (cols - 1) * gap)) / 2;
    const y0 = 300;
    panel(ctx, 36, 200, W - 72, 750, { fill: '#17130e', stroke: THEME.gold, r: 20 });
    const rar = CONFIG.rarity[box.rarity] || {};
    text(ctx, `自选卡包 · ${rar.name || box.rarity} Lv${box.level}`, W / 2, 262, {
      size: 30, weight: '700', align: 'center', color: THEME.gold,
    });
    this.boxPickRects = [];
    choices.forEach((t, i) => {
      const r = {
        x: x0 + (i % cols) * (cw + gap),
        y: y0 + Math.floor(i / cols) * (chh + gap),
        w: cw, h: chh,
      };
      this.boxPickRects.push({ rect: r, troop: t });
      panel(ctx, r.x, r.y, r.w, r.h, { fill: '#2b2217', stroke: THEME.line, r: 12 });
      text(ctx, t.name, r.x + r.w / 2, r.y + 42, {
        size: 20, weight: '600', align: 'center', color: (rar.color || THEME.text), maxWidth: r.w - 16,
      });
      text(ctx, `Lv${box.level}`, r.x + r.w / 2, r.y + 76, {
        size: 16, align: 'center', color: THEME.textDim,
      });
    });
    if (!choices.length) {
      text(ctx, '该品级暂无已解锁兵种', W / 2, 360, { size: 20, align: 'center', color: THEME.textWeak });
    }
    text(ctx, '点空白处取消', W / 2, 900, { size: 17, align: 'center', color: THEME.textWeak });
  }

  drawSummary(ctx) {
    const s = this.summary;
    ctx.save();
    ctx.fillStyle = 'rgba(13,10,7,0.86)';
    ctx.fillRect(0, 0, W, 1334);
    ctx.restore();
    panel(ctx, 70, 360, 610, 470, { fill: '#17130e', stroke: THEME.gold, r: 20 });
    text(ctx, `${s.chapter.name} · 章节通关`, W / 2, 428, {
      size: 30, weight: '600', align: 'center', color: THEME.gold,
    });
    let y = 500;
    if (s.box) {
      const rar = CONFIG.rarity[s.box.rarity] || {};
      text(ctx, `首通奖励：${rar.name || s.box.rarity}自选卡包 Lv${s.box.level}`, W / 2, y, {
        size: 21, align: 'center', color: THEME.gold,
      });
      y += 44;
    }
    if (s.coins > 0) {
      text(ctx, `铜钱 +${s.coins}`, W / 2, y, { size: 21, align: 'center', color: THEME.text });
      y += 44;
    }
    if (s.daily) {
      text(ctx, `每日首通奖励：${CONFIG.chests.types[s.daily.chest].name} ×1`, W / 2, y, {
        size: 20, align: 'center', color: THEME.green,
      });
      y += 44;
    }
    if (s.first) {
      text(ctx, '已解锁下一章；次日可直接从后面的章节开始', W / 2, y + 10, {
        size: 17, align: 'center', color: THEME.textDim,
      });
    }
    button(ctx, { x: 215, y: 700, w: 320, h: 78 }, '收 下', {
      size: 28, fill: '#332c1d', stroke: THEME.gold, textColor: THEME.gold,
    });
  }
}
