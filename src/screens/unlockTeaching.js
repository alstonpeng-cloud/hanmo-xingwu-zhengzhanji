// 新内容解锁教学：每解锁一个新功能 / 新兵种，首次过关后强制中断闯关并弹出。
// 功能类：说明入口 + 怎么用；兵种类：展示兵牌 + 详情。只弹一次（unlockSeen 记录）。
import {
  THEME, text, panel, button, hit, screenDim, wrapText,
} from '../render/draw.js';
import { CARD, drawUnitCard } from '../render/unitCard.js';
import { statsFor, rarityInfo } from '../core/units.js';
import { traitSkills } from '../data/traits.js';
import { playSfx } from '../core/audio.js';

// 三个模式节点：教学里补一句「回主页点高亮入口试试」
const GUIDE_MODE_IDS = ['trials', 'heroBattle', 'gauntlet'];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const PANEL = { x: 44, y: 132, w: 662, h: 1070 };
const CLOSE = { x: 195, y: 1108, w: 360, h: 72 };

export class UnlockTeachingScreen {
  constructor(game, nodes, opt = {}) {
    this.game = game;
    this.nodes = Array.isArray(nodes) ? nodes.slice() : [];
    this.after = opt.after || null;
    this.index = 0;
    // 动画时钟：t 累加供呼吸 / 扩散，pageStart 记录本页进入时刻，翻页后重新淡入
    this.t = 0;
    this.pageStart = 0;
  }

  get node() {
    return this.nodes[this.index] || null;
  }

  update(dt) {
    this.t += Number(dt) || 0;
  }

  onDown(x, y) {
    if (!hit(CLOSE, x, y)) return;
    playSfx('tap');
    this.index++;
    if (this.index >= this.nodes.length) {
      if (this.after) this.after();
    } else {
      this.pageStart = this.t; // 换页后从 0 重新淡入
    }
  }

  onUp() {}

  draw(ctx) {
    const g = this.game;
    const W = g.W;
    const H = g.H;
    const node = this.node;
    screenDim(ctx, W, H, 0.86);
    if (!node) return;
    const shown = this.t - this.pageStart;
    const fade = clamp01(shown / 0.45); // 本页淡入进度 0→1
    panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, {
      fill: '#12171b', stroke: THEME.gold, r: 24, lw: 2.4,
    });
    // 标题渐显：比面板内容稍晚一点浮现
    text(ctx, '新 内 容 解 锁', W / 2, 196, {
      size: 34, align: 'center', weight: '700', color: THEME.gold,
      alpha: clamp01((shown - 0.12) / 0.5),
    });
    if (node.kind === 'troop') this.drawTroop(ctx, g, node);
    else this.drawFeature(ctx, g, node, fade);
    button(ctx, CLOSE, '知道了', { size: 34, primary: true });
    // 淡入：面板内部盖一层与底色相同的遮罩，由不透明渐退到透明
    // 金色边框始终可见，按钮 / 文案统一从底色中浮现（button() 自身不支持 alpha）
    if (fade < 1) {
      panel(ctx, PANEL.x + 3, PANEL.y + 3, PANEL.w - 6, PANEL.h - 6, {
        fill: '#12171b', stroke: null, alpha: 1 - fade, r: 21,
      });
    }
  }

  drawFeature(ctx, g, node, fade) {
    const W = g.W;
    const cx = W / 2;
    const cy = 310;
    // 金色光环：两圈随时间向外扩散、逐渐淡出
    ctx.save();
    ctx.strokeStyle = THEME.gold;
    for (let i = 0; i < 2; i++) {
      const p = (this.t * 0.55 + i * 0.5) % 1;
      ctx.globalAlpha = (1 - p) * 0.55 * fade;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 62 + p * 54, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 图标：金色圆 + 单字，圆本身带脉冲发光
    const glow = 0.5 + 0.5 * Math.sin(this.t * 3.4);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201,162,74,0.16)';
    ctx.shadowColor = THEME.gold;
    ctx.shadowBlur = 12 + glow * 26;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = THEME.gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    text(ctx, node.badge || '新', cx, 326, {
      size: 52, align: 'center', weight: '700', color: THEME.gold,
    });
    text(ctx, node.title, cx, 438, {
      size: 46, align: 'center', weight: '700',
    });
    let y = 520;
    y = wrapText(ctx, node.desc, 96, y, W - 192, 48, { size: 32, color: THEME.text });
    y += 28;
    for (const line of node.how || []) {
      y = wrapText(ctx, line, 96, y, W - 192, 44, { size: 28, color: THEME.textDim });
      y += 8;
    }
    // 三个模式：补一句回主页点高亮入口的提示
    if (GUIDE_MODE_IDS.includes(node.id)) {
      y += 12;
      text(ctx, '回主页点高亮入口试试', W / 2, y + 10, {
        size: 26, align: 'center', color: THEME.gold, alpha: fade,
      });
    }
  }

  drawTroop(ctx, g, node) {
    const W = g.W;
    const rar = rarityInfo(node.troop);
    text(ctx, `已可招募到「${node.title}」`, W / 2, 276, {
      size: 38, align: 'center', weight: '700', color: rar.color,
    });

    // 兵牌（放大展示）
    const scale = 1.7;
    const cw = CARD.w * scale;
    const ch = CARD.h * scale;
    ctx.save();
    ctx.translate(W / 2 - cw / 2, 318);
    ctx.scale(scale, scale);
    drawUnitCard(ctx, { troop: node.troop, level: 1 }, { x: 0, y: 0, w: CARD.w, h: CARD.h });
    ctx.restore();

    const st = statsFor(node.troop, 1);
    text(ctx, `生命 ${st.hp} · 攻击 ${st.atk} · 防御 ${st.def}`, W / 2, 556, {
      size: 28, align: 'center', color: THEME.text,
    });
    let y = 606;
    y = wrapText(ctx, node.desc, 96, y, W - 192, 44, { size: 30, color: THEME.text });
    y += 16;
    for (const s of traitSkills(node.troop, 1)) {
      y = wrapText(ctx, `${s.name}：${s.desc}`, 96, y, W - 192, 42, { size: 26, color: THEME.textDim });
      y += 8;
    }
    y += 20;
    for (const line of (node.how || []).slice(-1)) {
      wrapText(ctx, line, 96, y, W - 192, 42, { size: 26, color: THEME.goldDim });
    }
  }
}
