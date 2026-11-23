// 游戏主循环 / 屏幕栈 / 提示
import { CONFIG } from './data/config.js';
import { initSprites, setTroopResolver } from './render/sprites.js';
import { loadState, saveState, resetState, readLastSeen } from './core/save.js';
import { text, panel, THEME, goldDust } from './render/draw.js';
import { initAudio, unlockAudio, playSfx, setAudioEnabled, startBgm, stopBgm, setBgmVolume, setSfxVolume, suspendForVisibility, resumeForVisibility } from './core/audio.js';
import { HomeScreen } from './screens/home.js';
import { DeployScreen } from './screens/deploy.js';
import { ChestScreen } from './screens/chests.js';
import { prologueDef, seedPrologue } from './data/prologue.js';
import { UnitShowcaseScreen } from './screens/unitShowcase.js';
import { pickTutorial, markTutorialSeen, skipTutorial, findStep, tutorialSeen } from './core/tutorial.js';
import { drawTutorialOverlay, tutorialPointer } from './render/tutorialOverlay.js';
import { initTitleImage } from './render/title.js';
import { initPackageArt, warmAllArt, drawBackdrop, ART } from './render/packageArt.js';
import { initClock, now as clockNow } from './core/clock.js';

export class Game {
  constructor(canvas, ctx, platform) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.platform = platform;
    // 可信时钟：先用存档 lastSeen 钳制本机时间，再异步用服务器时间校准（防改系统时间刷奖励）
    initClock(platform, readLastSeen(platform.storage));
    this.W = CONFIG.design.width;
    this.H = CONFIG.design.height;
    this.state = loadState(platform.storage);
    this.time = 0;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.toastText = '';
    this.toastT = 0;
    // 提示队列：同一帧内多条解锁/奖励提示排队播放，不互相吞
    this.toastQueue = [];
    this.screens = [];
    // 新手引导运行时：active = 当前展示的步骤；cardShown = 当前页面已经弹过提示卡
    this.tutorial = { active: null, cardShown: false, screenRef: null, nudge: 0 };

    initSprites({ createCanvas: platform.createCanvas, loadImage: platform.loadImage });
    initTitleImage(platform.loadImage);
    // 板块 3/4：分包美术（英雄立绘 / 3D 宝箱 / 器械 / 暖金背景）接入渲染层。
    // 微信侧分包未就绪时只登记订阅，业务层自动走程序化兜底；就绪后无感升级。
    initPackageArt({ loadImage: platform.loadImage });
    warmAllArt();
    setTroopResolver((id) => CONFIG.troops.find((t) => t.id === id));
    // 声音：平台提供播放器（Web = HTMLAudio，微信 = InnerAudioContext）；没有实现时全部静默
    initAudio(platform.audio || null, {
      enabled: this.state.audio !== false,
      bgmVolume: this.state.bgmVolume,
      sfxVolume: this.state.sfxVolume,
    });
    // 按下 = 点击；同时提供 move / up 给「拖拽兵牌」的页面用
    this.pointer = null;
    platform.onTap((x, y) => this.handleDown(x, y));
    if (platform.onMove) platform.onMove((x, y) => this.handleMove(x, y));
    if (platform.onUp) platform.onUp((x, y) => this.handleUp(x, y));
    // 双指缩放：只转给当前页面（布阵页用它做序章缩放引导）
    if (platform.onPinch) {
      platform.onPinch((scale, cx, cy, phase) => {
        const screen = this.screen;
        if (!screen || !screen.onPinch) return;
        const p = this.toLogical(cx, cy);
        screen.onPinch(scale, p.x, p.y, phase);
      });
    }
    // 页面切后台 / 恢复：BGM 淡出暂停，回来后再续播（避免后台继续响）
    if (platform.onVisibility) {
      platform.onVisibility((visible) => (visible ? resumeForVisibility() : suspendForVisibility()));
    }
    // 音频被系统打断（来电等）：先暂停，恢复后自动续播
    if (platform.onAudioInterruption) {
      platform.onAudioInterruption((resumed) => (resumed ? resumeForVisibility() : suspendForVisibility()));
    }
    // 微信侧全局错误：记录并清掉输入态，避免异常后一直黑屏
    if (platform.onError) platform.onError((err) => this.onFrameError(err, 1));
    // 首次进入（含旧档升级清空）：停在序章布阵页，先打董卓这一仗。
    if (!this.state.story || this.state.story.introDone !== true) {
      seedPrologue(this.state);
      this.save();
      this.go(new DeployScreen(this, {
        mode: 'battle', level: 1, prologue: true, def: prologueDef(),
      }));
    } else {
      this.go(new HomeScreen(this));
    }
  }

  /* ---------- 屏幕栈 ---------- */
  get screen() {
    return this.screens[this.screens.length - 1];
  }
  go(screen) {
    this.screens = [screen];
    if (screen.enter) screen.enter();
    this.syncBgm();
  }
  push(screen) {
    this.screens.push(screen);
    if (screen.enter) screen.enter();
    this.syncBgm();
  }
  pop() {
    if (this.screens.length > 1) this.screens.pop();
    // 栈只剩一层时（结算页等会用 go 直接进入某个页面）没有上一层可退，回首页兜底
    else this.home();
    if (this.screens.length > 1 || this.screen) this.syncBgm();
  }
  home() {
    this.go(new HomeScreen(this));
  }

  // 按当前页面切换 BGM：商城 bgm='shop'，其余页面默认 'main'（战斗 / 首页 / 结算共用同一首，尽量不打断）
  syncBgm() {
    const kind = (this.screen && this.screen.bgm) || 'main';
    if (kind === 'none') stopBgm();
    else startBgm(kind);
  }

  /* ---------- 存档 ---------- */
  save() {
    // 单调时间锚点：只向前推进，供下次读档识别本机时间回拨
    this.state.lastSeen = Math.max(Number(this.state.lastSeen) || 0, clockNow());
    saveState(this.platform.storage, this.state);
  }

  // 序章战败 → 东山再起：兵牌 / 铜钱 / 宝箱 / 各模式进度全部回到初始状态，
  // 只保留玩家的声音设置；已看过的两条教学记成已看，后面不再重播。
  // dest='deploy'：直进第 1 关排兵布阵（闯关起点）；默认 'home' 回首页。
  finishPrologue(dest = 'home') {
    const keep = {
      audio: this.state.audio,
      bgmVolume: this.state.bgmVolume,
      sfxVolume: this.state.sfxVolume,
    };
    this.state = resetState(this.platform.storage);
    this.state.story = { introDone: true };
    this.state.audio = keep.audio !== false;
    this.state.bgmVolume = keep.bgmVolume;
    this.state.sfxVolume = keep.sfxVolume;
    for (const id of ['zoom', 'merge', 'deploy']) markTutorialSeen(this.state, id);
    setAudioEnabled(this.state.audio);
    setBgmVolume(this.state.bgmVolume);
    setSfxVolume(this.state.sfxVolume);
    this.tutorial = { active: null, cardShown: false, screenRef: null, nudge: 0 };
    this.save();
    if (dest === 'deploy') this.go(new DeployScreen(this, { mode: 'battle', level: 1 }));
    else this.home();
  }
  // #dev-only:start
  resetGame() {
    this.state = resetState(this.platform.storage);
    // 重置存档 = 回到初始设置（声音默认开、音量回到默认）
    setAudioEnabled(this.state.audio !== false);
    setBgmVolume(this.state.bgmVolume);
    setSfxVolume(this.state.sfxVolume);
    this.toastText = '';
    this.toastT = 0;
    this.toastQueue = [];
    this.home();
  }
  // #dev-only:end

  /* ---------- 首次获得兵种：兵种卡片展示 ---------- */
  showcaseUnit(unit) {
    if (!unit || !unit.troop) return false;
    const st = this.state;
    if (!Array.isArray(st.seenTroops)) st.seenTroops = [];
    if (st.seenTroops.includes(unit.troop)) return false;
    st.seenTroops.push(unit.troop);
    this.save();
    // 展示页自己会写兵种信息，清掉刚刚的开箱 toast，避免两层文字叠在一起
    this.toastText = '';
    this.toastT = 0;
    this.push(new UnitShowcaseScreen(this, { troop: unit.troop, level: unit.level || 1 }));
    return true;
  }

  /* ---------- 提示 ---------- */
  // 最新提示立即显示（保证点击反馈不滞后）；被顶掉的提示回到队首稍后补播，
  // 同一帧内的多条解锁提示因此不会互相吞掉（队列最多积压 4 条）
  toast(msg, dur = 1.8) {
    if (!msg) return;
    if (this.toastText === msg && this.toastT > 0) {
      this.toastT = Math.max(this.toastT, dur);
      return;
    }
    if (this.toastQueue.some((t) => t.msg === msg)) return;
    if (this.toastT > 0 && this.toastText) {
      this.toastQueue.unshift({ msg: this.toastText, dur: this.toastT });
    }
    this.toastText = msg;
    this.toastT = dur;
    if (this.toastQueue.length > 4) this.toastQueue.length = 4;
  }

  nextToast() {
    const next = this.toastQueue.shift();
    this.toastText = next ? next.msg : '';
    this.toastT = next ? next.dur : 0;
  }

  /* ---------- 新手引导 ---------- */
  // 页面画完后调用：用这一帧真实的锚点坐标决定要不要出引导
  refreshTutorial() {
    if (this.tutorial.active) return;
    const screen = this.screen;
    if (!screen) return;
    const ctx = {
      screen: screen.tutorialId || '',
      ...(screen.tutorialAnchors ? screen.tutorialAnchors() : {}),
    };
    // 引导手册重看：目标页已画出锚点后，挂一条不写存档的实景强引导。
    // 必须等一帧让页面把 rows / 卡片画出来，锚点才有效。
    if (this.tutorial.pendingReplay) {
      const id = this.tutorial.pendingReplay;
      const step = findStep(id);
      const waited = this.time - (this.tutorial.pendingReplayAt || this.time);
      if (step && ctx.screen === step.screen) {
        const need = step.anchor && step.anchor[0];
        // 有明确锚点的引导要等锚点就绪（开箱要等有可开的箱、合成要等有可合的牌）
        if (!need || ctx[need] || waited > 1.2) {
          this.tutorial.pendingReplay = null;
          this.tutorial.screenRef = screen;
          this.tutorial.active = {
            step: { ...step, kind: (need && !ctx[need]) ? 'demo' : step.kind },
            anchors: ctx, t: 0, layout: null, replay: true,
          };
          return;
        }
      } else if (waited > 1.2) {
        this.tutorial.pendingReplay = null;
      }
    }
    const step = pickTutorial(this.state, ctx);
    if (!step) return;
    this.tutorial.screenRef = screen;
    this.tutorial.active = { step, anchors: ctx, t: 0, layout: null };
  }

  dismissTutorial() {
    const a = this.tutorial.active;
    if (!a) return;
    if (!a.replay) {
      markTutorialSeen(this.state, a.step.id);
      this.save();
    }
    this.tutorial.active = null;
  }

  // 玩家真的完成了这一步（点了出兵 / 合成了 / 开了箱）→ 记一次，之后不再弹
  tutorialDone(id) {
    const a = this.tutorial.active;
    if (a && a.step.id === id) return this.dismissTutorial();
    if (!a && !tutorialSeen(this.state, id)) {
      markTutorialSeen(this.state, id);
      this.save();
    }
  }

  // 帮助页「重看 / 查看」：全部跳到对应界面做「实景教学」，必须真的做出手势才算完成。
  //   布阵 / 缩放 / 合成 → 布阵页（这三个手势在布阵页都能做：拖兵、双指缩放、拖合成）
  //   开箱 → 宝箱页
  // 重看不写存档：直接挂一条 replay 强引导，锚点就绪后显示，玩家做完后不记进度。
  replayTutorial(id) {
    const step = findStep(id);
    if (!step) return false;
    this.tutorial.active = null;
    if (id === 'chest') {
      this.go(new ChestScreen(this));
    } else if (id === 'zoom') {
      // 缩放是 hint 型（由布阵页自己画提示），用 replayZoom 强制重开
      this.tutorial.pendingReplay = null;
      this.go(new DeployScreen(this, { mode: 'edit', replayZoom: true }));
      return true;
    } else {
      // 布阵 / 合成：进布阵页，安放强引导到真实白框 / 可合成兵牌上
      this.go(new DeployScreen(this, { mode: 'edit' }));
    }
    this.tutorial.pendingReplay = id;
    this.tutorial.pendingReplayAt = this.time;
    return true;
  }

  handleTap(cssX, cssY) {
    // 兼容旧调用（冒烟测试直接喂点击）：等同按下
    this.handleDown(cssX, cssY);
  }

  // 屏幕坐标 → 750×1334 逻辑坐标
  toLogical(cssX, cssY) {
    return { x: (cssX - this.ox) / this.scale, y: (cssY - this.oy) / this.scale };
  }

  handleDown(cssX, cssY) {
    const { x, y } = this.toLogical(cssX, cssY);
    // 浏览器要求先有用户手势才允许出声：第一次按下时再启动 / 恢复 BGM
    unlockAudio();
    // 新手引导：强引导只放行高亮区域；静态手势卡只响应关闭
    const tut = this.tutorial.active;
    if (tut) {
      const p = tutorialPointer(tut, x, y);
      if (p === 'skip') {
        skipTutorial(this.state);
        this.save();
        this.tutorial.active = null;
        return;
      }
      if (p === 'close') return this.dismissTutorial();
      if (tut.step.kind === 'strong') {
        if (p !== 'allow') {
          this.tutorial.nudge = 0.6;
          return;
        }
      } else {
        return;
      }
    }
    const screen = this.screen;
    // 通用按钮点击音（战斗页拖镜头会频繁按下，所以由战斗页自己决定播哪些声音）
    if (screen && screen.noTapSound !== true) playSfx('tap', { volume: 0.55 });
    this.pointer = screen ? { screen } : null;
    if (screen && screen.onDown) screen.onDown(x, y);
    else if (screen && screen.tap) screen.tap(x, y);
  }

  handleMove(cssX, cssY) {
    const p = this.pointer;
    if (!p || p.screen !== this.screen) return;
    if (!p.screen.onMove) return;
    const { x, y } = this.toLogical(cssX, cssY);
    p.screen.onMove(x, y);
  }

  handleUp(cssX, cssY) {
    const p = this.pointer;
    this.pointer = null;
    if (!p || !p.screen || !p.screen.onUp) return;
    const { x, y } = this.toLogical(cssX, cssY);
    p.screen.onUp(x, y);
  }

  /* ---------- 帧级异常兜底 ---------- */
  // 单帧 update/draw 出错不黑屏：清输入态；连续失败 3 帧回首页重建页面
  onFrameError(err, streak = 1) {
    try {
      if (typeof console !== 'undefined' && console.error) console.error('[frame]', err);
    } catch (e) {}
    this.pointer = null;
    if (streak === 3) {
      this.tutorial.active = null;
      try { this.home(); } catch (e) {}
    }
  }

  update(dt) {
    this.time += dt;
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.nextToast();
    } else if (this.toastQueue.length) {
      this.nextToast();
    }
    if (this.tutorial.nudge > 0) this.tutorial.nudge -= dt;
    const tut = this.tutorial.active;
    if (tut) {
      tut.t += dt;
      // 提示卡不阻断操作，但也不能一直挂着：12 秒后自动收起并记为已看过
      if (tut.step.kind === 'card' && tut.t >= 12) this.dismissTutorial();
    }
    if (this.screen && this.screen.update) this.screen.update(dt);
  }

  draw() {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const dpr = this.platform.pixelRatio ? this.platform.pixelRatio() : 1;
    // 平台提供逻辑视口尺寸（Web 用 canvas.clientWidth，微信小游戏用 windowWidth/windowHeight）
    const vp = this.platform.viewport ? this.platform.viewport() : null;
    const cw = (vp && vp.width) || canvas.clientWidth || this.W;
    const ch = (vp && vp.height) || canvas.clientHeight || this.H;
    const bw = Math.round(cw * dpr);
    const bh = Math.round(ch * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }

    const scale = Math.min(cw / this.W, ch / this.H);
    this.scale = scale || 1;
    this.ox = (cw - this.W * scale) / 2;
    this.oy = (ch - this.H * scale) / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0a07';
    ctx.fillRect(0, 0, bw, bh);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, this.ox * dpr, this.oy * dpr);

    // 板块 3/4：分包暖褐暗金插画底纹（云纹 + 金粉 + 纸纹）。
    // 页面可用 artBg 指定专属背景；未就绪时 drawBackdrop 返回 false，
    // 下面原有的程序化渐变照常铺满，首帧与降级场景都不会空白。
    const bgKey = (this.screen && this.screen.artBg) || 'home';
    const hasArtBg = drawBackdrop(ctx, ART.bg(bgKey), this.W, this.H);

    // 暖褐墨底（汉帛·朱金 v2 / S2.1）：深褐渐变 + 参考图那种大面积暖金氛围光
    // 光晕只作用于背景，面板为不透明实底，不会冲淡内容；强度按 12 张参考图实测克制设定
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#241a12');
    g.addColorStop(0.55, '#1a130d');
    g.addColorStop(1, '#0f0a06');
    ctx.save();
    // 有插画底时只压一层薄渐变统一色调，保留云纹与金粉细节；无插画时全量铺底
    ctx.globalAlpha = hasArtBg ? 0.42 : 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
    // 主光：上方偏右的局部暖金（参考图是局部纸纹暖光，不是整屏发橙）
    const haloTop = ctx.createRadialGradient(this.W * 0.78, this.H * 0.10, 10, this.W * 0.78, this.H * 0.10, this.W * 0.78);
    haloTop.addColorStop(0, 'rgba(213,153,71,0.085)');
    haloTop.addColorStop(0.55, 'rgba(190,110,50,0.035)');
    haloTop.addColorStop(1, 'rgba(190,110,50,0)');
    ctx.fillStyle = haloTop; ctx.fillRect(0, 0, this.W, this.H);
    // 辅光：左下角朱砂余晖，压住大面积纯黑、让暗部也有暖褐层次
    const haloBot = ctx.createRadialGradient(this.W * 0.14, this.H * 0.90, 10, this.W * 0.14, this.H * 0.90, this.W * 0.92);
    haloBot.addColorStop(0, 'rgba(141,48,27,0.055)');
    haloBot.addColorStop(1, 'rgba(141,48,27,0)');
    ctx.fillStyle = haloBot; ctx.fillRect(0, 0, this.W, this.H);

    if (this.screen && this.screen.draw) this.screen.draw(ctx);
    // S2.2：全屏金色浮尘（确定性分布，低透明度，浮在内容之上但不挡文字；
    // toast 与新手引导在其后绘制，始终盖住粒子）
    goldDust(ctx, this.W, this.H, this.time, { count: 30, alpha: 0.42 });
    // 页面已经切走：提示卡 / 强引导不能跟着漂到新页面上
    if (this.tutorial.active && this.tutorial.screenRef !== this.screen) {
      if (!this.tutorial.active.replay) {
        markTutorialSeen(this.state, this.tutorial.active.step.id);
        this.save();
      }
      this.tutorial.active = null;
    }
    this.refreshTutorial();
    this.drawToast(ctx);
    // 引导浮层最后画：提示卡不会被 toast 压住
    if (this.tutorial.active) {
      drawTutorialOverlay(ctx, this.tutorial.active, this.W, this.H, this.time);
    }
  }

  drawToast(ctx) {
    if (this.toastT <= 0 || !this.toastText) return;
    const a = Math.min(1, this.toastT / 0.4);
    const w = 560;
    const x = (this.W - w) / 2;
    // 放在顶栏下方：高度压到 72，避免盖住兵营/布阵页第一排兵牌（y≥208）
    const y = 124;
    ctx.save();
    ctx.globalAlpha = a;
    panel(ctx, x, y, w, 72, { fill: 'rgba(33,26,18,0.94)', stroke: THEME.goldDim, r: 14 });
    text(ctx, this.toastText, this.W / 2, y + 36, { size: 24, align: 'center', color: THEME.text, maxWidth: w - 24 });
    ctx.restore();
  }
}
