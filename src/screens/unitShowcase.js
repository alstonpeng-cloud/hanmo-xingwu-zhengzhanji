// 首次获得某兵种时的「兵种卡片详情」展示：全屏卡片 + 确认
// 每个兵种只弹一次（state.seenTroops 记录），确认后回到原页面
import { THEME, text, panel, button, hit, screenDim, wrapText } from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import { unitName, spriteTierFor, statsFor, rarityInfo, rarityOf } from '../core/units.js';
import { squadSoldierCount } from '../core/arena.js';
import { traitSkills, traitNote } from '../data/traits.js';
import { drawFrame, sheetFor } from '../render/sprites.js';
import { troopPower, formatPower } from '../core/power.js';
import { playSfx } from '../core/audio.js';

const CONFIRM = { x: 175, y: 1160, w: 400, h: 82 };

export class UnitShowcaseScreen {
  constructor(game, unit) {
    this.game = game;
    this.unit = unit;
    this.t = 0;
    this.confirmRect = CONFIRM;
    this.noTapSound = true;
  }

  enter() {
    playSfx('reward', { volume: 0.85, force: true });
  }

  update(dt) { this.t += dt; }

  tap(x, y) {
    if (hit(this.confirmRect, x, y)) {
      playSfx('tap', { volume: 0.8 });
      this.game.pop();
    }
  }

  draw(ctx) {
    const g = this.game;
    const W = g.W;
    const u = this.unit;
    const troop = CONFIG.troops.find((t) => t.id === u.troop);
    const rar = rarityInfo(u.troop);
    const s = statsFor(u.troop, u.level);
    const squad = squadSoldierCount(u.troop, u.level);
    const skills = traitSkills(u.troop, u.level);
    const note = traitNote(u.troop);
    const pow = troopPower(u.troop, u.level);

    screenDim(ctx, W, g.H, 0.82);
    panel(ctx, 82, 150, 586, 1010, { fill: '#12171b', stroke: rar.color, r: 26, lw: 3 });

    // 顶部：新兵种解锁
    text(ctx, '新 兵 种 解 锁', W / 2, 210, { size: 22, align: 'center', color: THEME.textDim });
    text(ctx, troop ? troop.name : u.troop, W / 2, 262, {
      size: 42, weight: '700', align: 'center', color: rar.color,
    });
    text(ctx, `${unitName(u.troop, u.level)} · Lv${u.level}${rarityOf(u.troop) === 'common' ? '' : ` · ${rar.name}`}`, W / 2, 300, {
      size: 21, align: 'center', color: THEME.gold,
    });

    // 立绘
    const sheet = sheetFor(u.troop, spriteTierFor(u.level));
    drawFrame(ctx, sheet, 'idle', 0, W / 2, 640, 3.05, false);

    // 属性
    panel(ctx, 118, 676, 514, 104, { fill: 'rgba(27,34,39,0.72)', stroke: THEME.line, r: 16 });
    const cols = [
      { label: '生命', value: `${s.hp}`, x: 178 },
      { label: '攻击', value: `${s.atk}`, x: 328 },
      { label: '防御', value: `${s.def}`, x: 478 },
      { label: '战力', value: formatPower(pow), x: 618 },
    ];
    for (const c of cols) {
      text(ctx, c.label, c.x, 708, { size: 16, align: 'center', color: THEME.textDim });
      text(ctx, c.value, c.x, 748, { size: 26, weight: '600', align: 'center', color: THEME.text });
    }
    text(ctx, `小队 ${squad} 个兵 · ${rar.name}`, W / 2, 806, { size: 18, align: 'center', color: THEME.textWeak });

    // 定位
    wrapText(ctx, troop ? troop.role : '', 130, 858, 490, 25, {
      size: 17, color: '#cfd7e2',
    });

    // 战法
    if (skills.length) {
      let y = 926;
      text(ctx, '战法 · 特性', 140, y, { size: 18, color: rar.color });
      y += 28;
      for (const sk of skills.slice(0, 2)) {
        text(ctx, `【${sk.name}】${sk.type}${sk.cd ? ` · CD ${sk.cd}s` : ''}`, 150, y, {
          size: 17, color: THEME.gold,
        });
        y += 23;
        y = wrapText(ctx, sk.desc, 150, y, 450, 20, {
          size: 15, color: THEME.textDim,
        });
        y += 8;
        if (y > 1050) break;
      }
      if (note) text(ctx, note, 375, 1080, { size: 14, align: 'center', color: THEME.textWeak });
    } else {
      text(ctx, '普通兵种 · 无特殊战法', 375, 938, { size: 19, align: 'center', color: THEME.textDim });
    }

    button(ctx, this.confirmRect, '确 认', {
      size: 28, fill: '#273038', stroke: rar.color, textColor: THEME.gold,
    });
  }
}
