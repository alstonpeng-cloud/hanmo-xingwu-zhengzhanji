// 开发者测试场（#dev-only）：任选兵种与等级，双方自由编队对打；英雄提供 Lv1 / 满级两档。
// 不写存档、不发奖励，只用于验证战斗表现与数值。
import { CONFIG } from '../data/config.js';
import { THEME, text, panel, button, hit } from '../render/draw.js';
import { HEROES, HERO_MAX_LEVEL, heroById } from '../data/heroes.js';
import { autoPlaceSquads } from '../core/formation.js';
import { BattleScreen } from './battle.js';
import { troopById } from '../core/units.js';
import { playSfx } from '../core/audio.js';

const L = {
  back: { x: 24, y: 24, w: 120, h: 64 },
  sidePlayer: { x: 34, y: 120, w: 330, h: 48 },
  sideEnemy: { x: 386, y: 120, w: 330, h: 48 },
  clearPlayer: { x: 34, y: 176, w: 150, h: 40 },
  clearEnemy: { x: 566, y: 176, w: 150, h: 40 },
  tabTroop: { x: 34, y: 244, w: 220, h: 54 },
  tabHero: { x: 266, y: 244, w: 220, h: 54 },
  levelDown: { x: 34, y: 690, w: 78, h: 62 },
  levelUp: { x: 638, y: 690, w: 78, h: 62 },
  lv1: { x: 126, y: 690, w: 120, h: 62 },
  lvMax: { x: 504, y: 690, w: 120, h: 62 },
  addPlayer: { x: 34, y: 776, w: 330, h: 76 },
  addEnemy: { x: 386, y: 776, w: 330, h: 76 },
  start: { x: 175, y: 884, w: 400, h: 96 },
};

const GRID = { x: 34, y: 316, w: 166, h: 74, gapX: 10, gapY: 10, cols: 4 };
const HERO_GRID = { x: 34, y: 316, w: 132, h: 84, gapX: 10, gapY: 12, cols: 5 };

// 手动布阵面板：点格子放置 / 移除，位置和正式布阵页的 5×5 同口径
const PLACE = {
  panel: { x: 40, y: 214, w: 670, h: 664 },
  grid: { x: 84, y: 318, w: 110, h: 82, gapX: 8, gapY: 8, cols: 5, rows: 5 },
  auto: { x: 84, y: 782, w: 270, h: 64 },
  done: { x: 396, y: 782, w: 270, h: 64 },
};

export class DevScreen {
  constructor(game, cfg = {}) {
    this.game = game;
    this.player = (cfg.player || []).slice(0, 25);
    this.enemy = (cfg.enemy || []).slice(0, 25);
    this.tab = cfg.tab || 'troop';
    this.troopId = cfg.troopId || 'shield';
    this.level = Math.max(1, Math.min(10, cfg.level || 1));
    this.heroId = cfg.heroId || HEROES[0].id;
    this.heroMax = cfg.heroMax === true;
    this.note = cfg.note || '';
    this.placeSide = null;
    this.fillMissing('player');
    this.fillMissing('enemy');
  }

  cfg() {
    return {
      player: this.player, enemy: this.enemy, tab: this.tab,
      troopId: this.troopId, level: this.level, heroId: this.heroId, heroMax: this.heroMax,
    };
  }

  onDown(x, y) {
    const g = this.game;
    if (this.placeSide) { this.onPlaceDown(x, y); return; }
    if (hit(L.back, x, y)) { playSfx('tap'); g.pop(); return; }
    if (hit(L.tabTroop, x, y)) { this.tab = 'troop'; playSfx('tap'); return; }
    if (hit(L.tabHero, x, y)) { this.tab = 'hero'; playSfx('tap'); return; }
    if (hit(L.clearPlayer, x, y)) { this.player = []; playSfx('tap'); return; }
    if (hit(L.clearEnemy, x, y)) { this.enemy = []; playSfx('tap'); return; }
    if (this.tab === 'troop') {
      const idx = this.pickIndex(x, y, CONFIG.troops.length, GRID);
      if (idx >= 0) { this.troopId = CONFIG.troops[idx].id; playSfx('tap'); return; }
      if (hit(L.levelDown, x, y)) { this.level = Math.max(1, this.level - 1); playSfx('tap'); return; }
      if (hit(L.levelUp, x, y)) { this.level = Math.min(10, this.level + 1); playSfx('tap'); return; }
      if (hit(L.lv1, x, y)) { this.level = 1; playSfx('tap'); return; }
      if (hit(L.lvMax, x, y)) { this.level = 10; playSfx('tap'); return; }
    } else {
      const idx = this.pickIndex(x, y, HEROES.length, HERO_GRID);
      if (idx >= 0) { this.heroId = HEROES[idx].id; playSfx('tap'); return; }
      if (hit(L.lv1, x, y)) { this.heroMax = false; playSfx('tap'); return; }
      if (hit(L.lvMax, x, y)) { this.heroMax = true; playSfx('tap'); return; }
    }
    if (hit(L.addPlayer, x, y)) { this.openPlace('player'); return; }
    if (hit(L.addEnemy, x, y)) { this.openPlace('enemy'); return; }
    if (hit(L.start, x, y)) this.start();
  }

  onUp() {}

  pickIndex(x, y, count, G) {
    for (let i = 0; i < count; i++) {
      const rect = {
        x: G.x + (i % G.cols) * (G.w + G.gapX),
        y: G.y + Math.floor(i / G.cols) * (G.h + G.gapY),
        w: G.w, h: G.h,
      };
      if (hit(rect, x, y)) return i;
    }
    return -1;
  }

  listFor(side) {
    return side === 'player' ? this.player : this.enemy;
  }

  // 当前选中的兵种 / 英雄（等级按当前 tab 的选择）
  currentUnit() {
    if (this.tab === 'hero') {
      const h = heroById(this.heroId) || HEROES[0];
      return { troop: h.troop, level: this.heroMax ? HERO_MAX_LEVEL : 1, hero: h.id };
    }
    return { troop: this.troopId, level: this.level };
  }

  unitName(u) {
    const cfg = u.hero ? heroById(u.hero) : troopById(u.troop);
    return `${(cfg && cfg.name) || u.troop} Lv${u.level}`;
  }

  // 找这一侧第一个空闲格：近战靠前、远程靠后与自动布阵同口径
  freeCell(side) {
    const used = new Set();
    for (const u of this.listFor(side)) {
      if (Number.isInteger(u.col) && Number.isInteger(u.row)) used.add(u.row * 5 + u.col);
    }
    const cols = side === 'player' ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
    for (const col of cols) {
      for (const row of [2, 1, 3, 0, 4]) {
        if (!used.has(row * 5 + col)) return { col, row };
      }
    }
    return null;
  }

  // 旧调用 / 外部编队可能没带位置：补齐到空位，保留已有位置
  fillMissing(side) {
    for (const u of this.listFor(side)) {
      if (Number.isInteger(u.col) && Number.isInteger(u.row)) continue;
      const cell = this.freeCell(side);
      if (!cell) break;
      u.col = cell.col;
      u.row = cell.row;
    }
  }

  add(side) {
    const list = this.listFor(side);
    if (list.length >= 25) {
      this.game.toast('这一侧已满 25 支小队');
      return;
    }
    const cell = this.freeCell(side);
    if (!cell) {
      this.game.toast('这一侧已满 25 支小队');
      return;
    }
    const unit = this.currentUnit();
    list.push({ ...unit, col: cell.col, row: cell.row });
    this.note = `已加入 ${this.unitName(unit)}（第 ${cell.col + 1} 列 / 第 ${cell.row + 1} 排）`;
    playSfx('buy');
  }

  openPlace(side) {
    this.placeSide = side;
    this.note = `正在布阵：${this.unitName(this.currentUnit())}`;
    playSfx('tap');
  }

  onPlaceDown(x, y) {
    const side = this.placeSide;
    if (hit(PLACE.done, x, y)) { this.placeSide = null; playSfx('tap'); return; }
    if (hit(PLACE.auto, x, y)) { this.autoSide(side); playSfx('tap'); return; }
    const G = PLACE.grid;
    for (let row = 0; row < G.rows; row++) {
      for (let col = 0; col < G.cols; col++) {
        const rect = {
          x: G.x + col * (G.w + G.gapX),
          y: G.y + row * (G.h + G.gapY),
          w: G.w, h: G.h,
        };
        if (!hit(rect, x, y)) continue;
        this.placeAt(side, col, row);
        return;
      }
    }
    if (!hit(PLACE.panel, x, y)) this.placeSide = null;
  }

  // 点空格放一支当前选中单位；点已有兵牌移除
  placeAt(side, col, row) {
    const list = this.listFor(side);
    const idx = list.findIndex((u) => u.col === col && u.row === row);
    if (idx >= 0) {
      const [gone] = list.splice(idx, 1);
      this.note = `已移除：${this.unitName(gone)}`;
      playSfx('tap');
      return;
    }
    if (list.length >= 25) {
      this.game.toast('这一侧已满 25 支小队');
      return;
    }
    const unit = this.currentUnit();
    list.push({ ...unit, col, row });
    this.note = `放置：${this.unitName(unit)}（第 ${col + 1} 列 / 第 ${row + 1} 排）`;
    playSfx('buy');
  }

  autoSide(side) {
    const placed = autoPlaceSquads(this.listFor(side), side);
    if (side === 'player') this.player = placed;
    else this.enemy = placed;
    this.note = `${side === 'player' ? '我方' : '敌方'}已自动布阵`;
  }

  start() {
    const g = this.game;
    if (!this.player.length || !this.enemy.length) {
      g.toast('双方至少各放 1 支小队');
      return;
    }
    this.fillMissing('player');
    this.fillMissing('enemy');
    // 手动摆放的 col / row 原样带进战斗，不再统一重排
    const playerSquads = this.player.map((u, i) => ({ ...u, uid: `dp${i}` }));
    const enemies = this.enemy.map((u, i) => ({ ...u, uid: `de${i}` }));
    const def = { level: 1, enemies, enemyLevel: 1, enemyLevelMax: 1, total: 1 };
    g.push(new BattleScreen(g, 1, Math.random, {
      dev: { playerSquads, def, back: () => g.pop() },
      def,
    }));
  }

  draw(ctx) {
    const g = this.game;
    const W = g.W;
    const H = g.H;
    ctx.fillStyle = '#0b0f16';
    ctx.fillRect(0, 0, W, H);
    button(ctx, L.back, '< 返回', { size: 24, fill: THEME.panel, stroke: THEME.line });
    text(ctx, '开发者测试场', W / 2, 56, {
      size: 34, weight: '700', align: 'center', color: THEME.gold,
    });
    text(ctx, '任选兵种 / 等级 · 双方对打 · 不写存档', W / 2, 92, {
      size: 15, align: 'center', color: THEME.textWeak,
    });

    panel(ctx, 24, 104, 702, 126, { fill: 'rgba(43,34,23,0.6)', stroke: THEME.line, r: 16 });
    text(ctx, this.player.length ? `我方 ${this.player.length} 支` : '我方（空）', 199, 144, {
      size: 20, align: 'center', color: this.player.length ? THEME.gold : THEME.textWeak,
    });
    text(ctx, this.enemy.length ? `敌方 ${this.enemy.length} 支` : '敌方（空）', 551, 144, {
      size: 20, align: 'center', color: this.enemy.length ? '#e0a0a0' : THEME.textWeak,
    });
    button(ctx, L.clearPlayer, '清空我方', { size: 16, fill: THEME.panel, stroke: THEME.line });
    button(ctx, L.clearEnemy, '清空敌方', { size: 16, fill: THEME.panel, stroke: THEME.line });

    button(ctx, L.tabTroop, '兵 种', {
      size: 22, fill: this.tab === 'troop' ? '#332c1d' : THEME.panel,
      stroke: this.tab === 'troop' ? THEME.gold : THEME.line,
      textColor: this.tab === 'troop' ? THEME.gold : THEME.text,
    });
    button(ctx, L.tabHero, '英 雄', {
      size: 22, fill: this.tab === 'hero' ? '#332c1d' : THEME.panel,
      stroke: this.tab === 'hero' ? THEME.gold : THEME.line,
      textColor: this.tab === 'hero' ? THEME.gold : THEME.text,
    });

    if (this.tab === 'troop') this.drawTroops(ctx);
    else this.drawHeroes(ctx);

    this.drawLevelRow(ctx);

    button(ctx, L.addPlayer, '我方布阵', {
      size: 24, fill: '#2b2217', stroke: THEME.goldDim, textColor: THEME.gold,
    });
    button(ctx, L.addEnemy, '敌方布阵', {
      size: 24, fill: '#2a1d1d', stroke: '#8a4a4a', textColor: '#e0a0a0',
    });

    button(ctx, L.start, '开始对打', {
      size: 32, primary: true, fill: '#332c1d', stroke: THEME.gold, textColor: THEME.gold,
    });
    if (this.note) {
      text(ctx, this.note, W / 2, 1012, { size: 16, align: 'center', color: THEME.textDim });
    }
    text(ctx, '提示：点「我方布阵 / 敌方布阵」后选格子摆放；战斗结束自动回到本页', W / 2, 1050, {
      size: 14, align: 'center', color: THEME.textWeak,
    });
    this.drawPlace(ctx);
  }

  // 手动布阵浮层：5×5 与正式布阵同口径；点空格放置当前选中单位，点已有兵牌移除
  drawPlace(ctx) {
    if (!this.placeSide) return;
    const g = this.game;
    const side = this.placeSide;
    const list = this.listFor(side);
    ctx.fillStyle = 'rgba(5,7,11,0.82)';
    ctx.fillRect(0, 0, g.W, g.H);
    panel(ctx, PLACE.panel.x, PLACE.panel.y, PLACE.panel.w, PLACE.panel.h, {
      fill: '#101722', stroke: THEME.goldDim, r: 18,
    });
    text(ctx, `${side === 'player' ? '我方' : '敌方'}布阵`, g.W / 2, 252, {
      size: 26, weight: '700', align: 'center', color: THEME.gold,
    });
    text(ctx, `点空格放置：${this.unitName(this.currentUnit())} · 点已有兵牌移除`, g.W / 2, 286, {
      size: 15, align: 'center', color: THEME.textDim,
    });
    const G = PLACE.grid;
    for (let row = 0; row < G.rows; row++) {
      for (let col = 0; col < G.cols; col++) {
        const rect = {
          x: G.x + col * (G.w + G.gapX),
          y: G.y + row * (G.h + G.gapY),
          w: G.w, h: G.h,
        };
        const u = list.find((x) => x.col === col && x.row === row);
        const front = side === 'player' ? col === G.cols - 1 : col === 0;
        panel(ctx, rect.x, rect.y, rect.w, rect.h, {
          fill: u ? '#2b2217' : '#151c27',
          stroke: u ? THEME.gold : (front ? THEME.goldDim : THEME.line),
          r: 10,
        });
        text(ctx, u ? this.unitName(u) : '+', rect.x + rect.w / 2, rect.y + rect.h / 2, {
          size: u ? 13 : 26, align: 'center', color: u ? THEME.gold : THEME.textWeak,
        });
      }
    }
    button(ctx, PLACE.auto, '自动布阵', { size: 20, fill: THEME.panel, stroke: THEME.line });
    button(ctx, PLACE.done, '完成', {
      size: 20, primary: true, fill: '#332c1d', stroke: THEME.gold, textColor: THEME.gold,
    });
    text(ctx, `当前 ${list.length} / 25 支 · 靠近中线的一列用金边标出`, g.W / 2, 866, {
      size: 14, align: 'center', color: THEME.textWeak,
    });
  }

  drawTroops(ctx) {
    const list = CONFIG.troops;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const rect = {
        x: GRID.x + (i % GRID.cols) * (GRID.w + GRID.gapX),
        y: GRID.y + Math.floor(i / GRID.cols) * (GRID.h + GRID.gapY),
        w: GRID.w, h: GRID.h,
      };
      const on = t.id === this.troopId;
      button(ctx, rect, `${t.name} Lv${this.level}`, {
        size: 15,
        fill: on ? '#3a3020' : THEME.panel,
        stroke: on ? THEME.gold : THEME.line,
        textColor: on ? THEME.gold : THEME.text,
      });
    }
  }

  drawHeroes(ctx) {
    for (let i = 0; i < HEROES.length; i++) {
      const h = HEROES[i];
      const rect = {
        x: HERO_GRID.x + (i % HERO_GRID.cols) * (HERO_GRID.w + HERO_GRID.gapX),
        y: HERO_GRID.y + Math.floor(i / HERO_GRID.cols) * (HERO_GRID.h + HERO_GRID.gapY),
        w: HERO_GRID.w, h: HERO_GRID.h,
      };
      const on = h.id === this.heroId;
      button(ctx, rect, `${h.name} Lv${this.heroMax ? HERO_MAX_LEVEL : 1}`, {
        size: 15,
        fill: on ? '#332c1d' : THEME.panel,
        stroke: on ? THEME.gold : THEME.line,
        textColor: on ? THEME.gold : THEME.text,
      });
    }
  }

  drawLevelRow(ctx) {
    const hero = this.tab === 'hero';
    const cur = hero ? (this.heroMax ? HERO_MAX_LEVEL : 1) : this.level;
    const max = hero ? HERO_MAX_LEVEL : 10;
    button(ctx, L.levelDown, '-', { size: 30, fill: THEME.panel, stroke: THEME.line });
    button(ctx, L.levelUp, '+', { size: 30, fill: THEME.panel, stroke: THEME.line });
    text(ctx, `Lv ${cur} / ${max}`, 375, 721, {
      size: 30, weight: '700', align: 'center', color: THEME.gold,
    });
    button(ctx, L.lv1, 'Lv 1', {
      size: 18, fill: cur === 1 ? '#3a3020' : THEME.panel,
      stroke: cur === 1 ? THEME.gold : THEME.line,
      textColor: cur === 1 ? THEME.gold : THEME.text,
    });
    button(ctx, L.lvMax, hero ? '满级' : 'Lv 10', {
      size: 18, fill: cur === max ? '#3a3020' : THEME.panel,
      stroke: cur === max ? THEME.gold : THEME.line,
      textColor: cur === max ? THEME.gold : THEME.text,
    });
  }
}
