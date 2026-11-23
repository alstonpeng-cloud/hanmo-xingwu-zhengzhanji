// 每日：签到（稀有宝箱）+ 7 日登录（第 1 天史诗箱 / 第 2 天 6 级弓箭手）+ 每日任务
// 通关 30 关后开放；跨天自动重置（7 日登录的累计天数不清零）
import { THEME, text, panel, button, coinBadge, hit, backButton, bar } from '../render/draw.js';
import { CONFIG } from '../data/config.js';
import {
  dailyUnlocked, signIn, canClaimLogin, nextLoginDay, claimLoginDay,
  taskState, claimTask, taskProgress,
} from '../core/daily.js';
import { chestType, chestTotal } from '../core/chests.js';
import { rosterSlots } from '../core/levels.js';
import { drawChest } from '../render/chest.js';
import { ChestScreen } from './chests.js';
import { playSfx } from '../core/audio.js';

const TASK_ROW_H = 66;
const TASK_ROW_GAP = 8;

export class DailyScreen {
  constructor(game) {
    this.game = game;
    this.backRect = { x: 36, y: 44, w: 124, h: 64 };
    this.signRect = { x: 470, y: 176, w: 210, h: 56 };
    this.loginRect = { x: 245, y: 452, w: 260, h: 48 };
    this.taskRects = [];
    this.chestRect = { x: 225, y: 1164, w: 300, h: 72 };
  }

  update() {}

  taskRows() {
    const st = this.game.state;
    return (CONFIG.daily.tasks || []).map((task) => ({ task, state: taskState(st, task) }));
  }

  tap(x, y) {
    const g = this.game;
    const st = g.state;
    if (hit(this.backRect, x, y)) return g.pop();
    if (!dailyUnlocked(st)) return;
    if (hit(this.chestRect, x, y)) return g.push(new ChestScreen(g));

    if (hit(this.signRect, x, y)) {
      const r = signIn(st);
      if (!r.ok) {
        playSfx('error', { volume: 0.7 });
        if (r.reason === 'signed') g.toast('今天已经签到过了，明天再来');
        else g.toast('签到暂不可用');
        return;
      }
      g.save();
      playSfx('reward');
      g.toast(`签到成功：获得 ${chestType(r.chest)?.name || '稀有宝箱'} ×1`);
      return;
    }

    if (canClaimLogin(st) && hit(this.loginRect, x, y)) {
      const r = claimLoginDay(st);
      if (!r.ok) {
        playSfx('error', { volume: 0.7 });
        if (r.reason === 'full') g.toast('兵营已满：先去兵营腾出格子再领');
        else if (r.reason === 'today') g.toast('今天已经领过了，明天再来');
        else if (r.reason === 'done') g.toast('7 日登录已全部领完');
        else g.toast('暂时不能领取');
        return;
      }
      g.save();
      playSfx('reward');
      const extra = r.duplicate
        ? `（已拥有，折算 ${r.coins} 铜钱）`
        : r.coins ? `（+${r.coins} 铜钱）` : '';
      const unlockHint = r.unlocked ? '，同时解锁该兵种' : '';
      const capHint = r.unit && r.unit.level < r.reward.level
        ? `（关卡档位限制：按 Lv${r.unit.level} 发放，第 250 关后放开）` : '';
      g.toast(`领取第 ${r.index + 1} 天奖励：${r.reward.name}${extra}${unlockHint}${capHint}`);
      if (r.unit && g.showcaseUnit) g.showcaseUnit(r.unit);
      return;
    }

    for (const rect of this.taskRects) {
      if (!hit(rect.rect, x, y)) continue;
      const r = claimTask(st, rect.id);
      if (!r.ok) {
        playSfx('error', { volume: 0.7 });
        if (r.reason === 'claimed') g.toast('这个任务今天已经领过了');
        else if (r.reason === 'progress') g.toast('任务还没完成');
        else g.toast('暂时不能领取');
        return;
      }
      g.save();
      playSfx('reward');
      const chestName = r.chest ? `${chestType(r.chest)?.name || '宝箱'} ×1` : '';
      const coinText = r.coins ? ` + ${r.coins} 铜钱` : '';
      g.toast(`任务奖励：${chestName}${coinText}`);
      return;
    }
  }

  draw(ctx) {
    const g = this.game;
    const st = g.state;
    const W = g.W;
    const unlocked = dailyUnlocked(st);
    const slots = rosterSlots(st.maxCleared);
    const total = chestTotal(st);

    panel(ctx, 0, 0, W, 118, { fill: 'rgba(23,19,14,0.9)', stroke: THEME.line, r: 0, lw: 0 });
    backButton(ctx, this.backRect);
    text(ctx, '每日 · 签到与任务', W / 2 + 20, 76, { size: 32, weight: '600', align: 'center' });
    coinBadge(ctx, 700, 76, st.coins, { size: 24, align: 'right' });

    if (!unlocked) {
      this.drawLocked(ctx, W);
      return;
    }

    this.drawSignIn(ctx);
    this.drawLogin7(ctx);
    this.drawTasks(ctx);

    text(ctx, `仓库 ${total} · 兵营 ${st.units.length}/${slots.unlocked}`, W / 2, 1120, {
      size: 22, align: 'center', color: THEME.textDim, maxWidth: 660,
    });
    button(ctx, this.chestRect, '去宝箱页开箱', { size: 24, fill: THEME.panel2, stroke: THEME.line });
  }

  drawLocked(ctx, W) {
    const st = this.game.state;
    const unlock = CONFIG.daily.unlockLevel;
    const left = Math.max(0, unlock - st.maxCleared);
    panel(ctx, 70, 170, 610, 420, { fill: 'rgba(43,34,23,0.8)', stroke: THEME.line, r: 20 });
    text(ctx, '每日系统尚未开放', W / 2, 250, { size: 34, align: 'center', color: THEME.text });
    text(ctx, `通关 ${unlock} 关后开放：每日任务、每日签到、7 日登录`, W / 2, 310, {
      size: 23, align: 'center', color: THEME.textDim, maxWidth: 560,
    });
    bar(ctx, 135, 366, 480, 24, st.maxCleared / unlock, { fill: THEME.green, stroke: '#4a3a24' });
    text(ctx, `已通关 ${st.maxCleared} / ${unlock} 关（还差 ${left} 关）`, W / 2, 424, {
      size: 24, align: 'center', color: THEME.gold,
    });
    text(ctx, '开放后每天可领：稀有宝箱签到 1 个 + 任务 3 个 + 7 日登录 1 档', W / 2, 508, {
      size: 21, align: 'center', color: THEME.textDim, maxWidth: 560,
    });
  }

  drawSignIn(ctx) {
    const st = this.game.state;
    const s = st.daily || {};
    const chest = CONFIG.daily.signInChest || 'rare';
    const type = chestType(chest);
    panel(ctx, 40, 134, 670, 148, {
      fill: 'rgba(58,46,30,0.72)', stroke: type?.color || THEME.line, r: 20,
    });
    drawChest(ctx, 110, 208, 0.62, { color: type?.color || THEME.gold, kind: type?.id || '', glow: !s.signed });
    text(ctx, '每日签到', 170, 178, { size: 28, weight: '600', color: THEME.text });
    text(ctx, `签到送 ${type?.name || '稀有宝箱'} ×1 · 每天 1 次`, 170, 218, {
      size: 20, color: THEME.textDim,
    });
    text(ctx, s.signed ? '今天已签到 ✓' : '今天还没签到', 170, 252, {
      size: 19, color: s.signed ? THEME.green : THEME.gold,
    });
    button(ctx, this.signRect, s.signed ? '已签到' : '签 到', {
      size: 24, fill: s.signed ? THEME.panel : '#241a16',
      stroke: type?.color || THEME.gold, textColor: s.signed ? THEME.textWeak : THEME.gold,
      disabled: !!s.signed,
    });
  }

  drawLogin7(ctx) {
    const g = this.game;
    const st = g.state;
    const days = CONFIG.daily.login7.days;
    const next = nextLoginDay(st);
    const claimed = (st.daily && st.daily.loginDays) || 0;
    const canClaim = canClaimLogin(st);

    panel(ctx, 40, 300, 670, 216, { fill: 'rgba(43,34,23,0.86)', stroke: THEME.line, r: 20 });
    text(ctx, '7 日登录', 66, 332, { size: 24, color: THEME.text });
    text(ctx, `已领 ${claimed} / ${days.length} 天 · 每天可领 1 天`, 686, 332, {
      size: 18, align: 'right', color: THEME.textDim,
    });

    days.forEach((reward, i) => {
      const chipX = 52 + i * 93;
      const chipW = 88;
      const done = i < claimed;
      const current = i === claimed;
      panel(ctx, chipX, 344, chipW, 90, {
        fill: done ? '#202b22' : current ? '#2c2a1d' : 'rgba(33,26,18,0.9)',
        stroke: done ? '#3d5442' : current ? THEME.goldDim : '#4a3a24',
        r: 12, lw: current ? 2.5 : 1.5,
      });
      text(ctx, `第 ${i + 1} 天`, chipX + chipW / 2, 362, { size: 14, align: 'center', color: done ? '#9fd0a8' : THEME.textDim });
      const isChest = reward.kind === 'chest';
      const color = isChest
        ? (chestType(reward.chest)?.color || THEME.gold)
        : reward.kind === 'hero' ? CONFIG.rarity.legendary.color
          : reward.kind === 'coins' ? THEME.gold : THEME.blue;
      const label = isChest
        ? (chestType(reward.chest)?.name || '宝箱')
        : reward.kind === 'coins'
          ? `${Math.round(reward.coins / 10000)} 万铜钱`
          : reward.name;
      text(ctx, label, chipX + chipW / 2, 386, {
        size: isChest ? 13 : 12, align: 'center', color: done ? THEME.textDim : color, maxWidth: 80,
      });
      const sub = isChest ? `×${reward.n || 1}`
        : reward.kind === 'unit' ? `Lv${reward.level} 单位`
          : reward.kind === 'hero' ? '传奇英雄' : '铜 钱';
      text(ctx, sub, chipX + chipW / 2, 408, {
        size: 12, align: 'center', color: done ? THEME.textWeak : THEME.textDim,
      });
      if (done) text(ctx, '✓', chipX + chipW - 10, 356, { size: 13, align: 'center', color: THEME.green });
    });

    button(ctx, this.loginRect, next
      ? (next.claimedToday ? '今天已领取' : `领取第 ${next.index + 1} 天奖励`)
      : '7 日登录已领完', {
      size: 20, fill: '#241a16', stroke: THEME.goldDim,
      textColor: canClaim ? THEME.gold : THEME.textWeak,
      disabled: !canClaim,
    });
  }

  drawTasks(ctx) {
    const st = this.game.state;
    const rows = this.taskRows();
    const panelTop = 536;
    const panelH = 400;
    panel(ctx, 40, panelTop, 670, panelH, { fill: THEME.panel, stroke: THEME.line, r: 20 });
    text(ctx, '每日任务', 66, panelTop + 30, { size: 24, color: THEME.text });
    text(ctx, '领取奖励：稀有宝箱 ×1', 686, panelTop + 30, {
      size: 18, align: 'right', color: THEME.textDim,
    });

    this.taskRects = [];
    rows.forEach(({ task, state }, i) => {
      const y = panelTop + 54 + i * (TASK_ROW_H + TASK_ROW_GAP);
      const done = state.done;
      const claimed = state.claimed;
      panel(ctx, 56, y, 638, TASK_ROW_H, {
        fill: claimed ? '#202b22' : done ? '#2c2a1d' : 'rgba(43,34,23,0.9)',
        stroke: claimed ? '#3d5442' : done ? THEME.goldDim : '#4a3a24',
        r: 14, lw: done && !claimed ? 2 : 1,
      });
      text(ctx, task.name, 78, y + 24, { size: 20, color: claimed ? THEME.textDim : THEME.text });
      const progress = Math.min(task.need, taskProgress(st, task.id));
      const rewardName = task.chest ? `${chestType(task.chest)?.name || '宝箱'} ×1` : '签到奖励';
      text(ctx, `${progress} / ${task.need}  ·  奖励 ${rewardName}`, 78, y + 48, {
        size: 16, color: claimed ? THEME.textWeak : THEME.textDim, maxWidth: 380,
      });

      const btn = { x: 56 + 638 - 132, y: y + 11, w: 116, h: 44 };
      if (claimed) {
        button(ctx, btn, task.id === 'sign' ? '已签到' : '已领取', {
          size: 18, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak, disabled: true,
        });
      } else if (done) {
        this.taskRects.push({ id: task.id, rect: btn });
        button(ctx, btn, task.id === 'sign' ? '已签到' : '领取', {
          size: 18, fill: '#241a16', stroke: THEME.gold, textColor: THEME.gold,
        });
      } else {
        button(ctx, btn, '未完成', {
          size: 17, fill: THEME.panel, stroke: THEME.line, textColor: THEME.textWeak, disabled: true,
        });
      }
    });
  }
}
