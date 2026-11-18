// 生成游戏内置音效（WAV，16kHz 单声道）+ 一段「英雄主题」的占位 BGM 循环
// 用法：node tools/gen-audio.mjs
// 说明：真实 BGM（Glorious Morning）不随仓库分发，放进 assets/audio/glorious_morning.mp3 即可；
//       文件不存在时运行时会自动退回到这里生成的 bgm_heroic_loop.wav。
import fs from 'node:fs';
import path from 'node:path';

const SR = 16000;
const ROOT = process.cwd();
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');
const SFX_DIR = path.join(AUDIO_DIR, 'sfx');

fs.mkdirSync(SFX_DIR, { recursive: true });

/* ---------- WAV 写入 ---------- */
function writeWav(file, samples) {
  const n = samples.length;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + n * 2, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);          // PCM
  header.writeUInt16LE(1, 22);          // 单声道
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);     // byteRate
  header.writeUInt16LE(2, 32);          // blockAlign
  header.writeUInt16LE(16, 34);         // 16 bit
  header.write('data', 36);
  header.writeUInt32LE(n * 2, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
  return n * 2 + 44;
}

/* ---------- 合成小工具 ---------- */
function makeBuffer(dur) {
  return new Float32Array(Math.max(1, Math.ceil(dur * SR)));
}

function wave(type, freq, t) {
  const ph = freq * t;
  if (type === 'square') return Math.sin(2 * Math.PI * ph) >= 0 ? 1 : -1;
  if (type === 'tri') return (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * ph));
  if (type === 'saw') return 2 * (ph - Math.floor(ph + 0.5));
  return Math.sin(2 * Math.PI * ph);
}

// 往缓冲区叠加一个音符：可指定滑音（glide）与起止包络
function addTone(buf, at, dur, freq, amp, opt = {}) {
  const { type = 'sine', attack = 0.008, release = 0.06, glide = 0, tremolo = 0 } = opt;
  const i0 = Math.max(0, Math.floor(at * SR));
  const n = Math.min(buf.length - i0, Math.floor(dur * SR));
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = glide ? freq + (glide - freq) * (t / dur) : freq;
    const a = (t < attack ? t / attack : 1)
      * (t > dur - release ? Math.max(0, (dur - t) / release) : 1);
    const trem = tremolo ? 1 + tremolo * Math.sin(2 * Math.PI * 9 * t) : 1;
    buf[i0 + k] += wave(type, f, t) * amp * a * trem;
  }
}

// 确定性噪声：同一版本生成的文件完全一致
function makeNoise(seed) {
  let x = (seed * 2654435761) | 0;
  return () => {
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    x ^= x >>> 16;
    return ((x >>> 0) / 2147483648) - 1;
  };
}

function addNoise(buf, at, dur, amp, opt = {}) {
  const { attack = 0.004, release = 0.05, lowpass = 0.2, seed = 1 } = opt;
  const rand = makeNoise(seed);
  const i0 = Math.max(0, Math.floor(at * SR));
  const n = Math.min(buf.length - i0, Math.floor(dur * SR));
  let lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const a = (t < attack ? t / attack : 1)
      * (t > dur - release ? Math.max(0, (dur - t) / release) : 1);
    lp += lowpass * (rand() - lp);
    buf[i0 + k] += lp * amp * a;
  }
}

/* ---------- 各音效 ---------- */
const SFX = {
  // 点击：清脆短促
  tap() {
    const b = makeBuffer(0.07);
    addTone(b, 0, 0.055, 780, 0.28, { glide: 560, attack: 0.004, release: 0.03 });
    addNoise(b, 0, 0.02, 0.06, { lowpass: 0.5 });
    return b;
  },
  // 上阵 / 换位：木屐落地
  place() {
    const b = makeBuffer(0.15);
    addTone(b, 0, 0.13, 210, 0.42, { type: 'tri', glide: 130, attack: 0.004, release: 0.06 });
    addNoise(b, 0, 0.03, 0.18, { lowpass: 0.12 });
    return b;
  },
  // 撤下：往回抽走
  withdraw() {
    const b = makeBuffer(0.14);
    addTone(b, 0, 0.12, 620, 0.22, { glide: 260, attack: 0.005, release: 0.04 });
    return b;
  },
  // 合成成功：三连上行 + 一点火花
  merge() {
    const b = makeBuffer(0.42);
    addTone(b, 0.00, 0.16, 523, 0.22, { type: 'tri', release: 0.06 });
    addTone(b, 0.09, 0.16, 659, 0.22, { type: 'tri', release: 0.06 });
    addTone(b, 0.18, 0.20, 784, 0.24, { type: 'tri', release: 0.08 });
    addTone(b, 0.26, 0.14, 1046, 0.14, { type: 'sine', release: 0.06 });
    addNoise(b, 0.18, 0.18, 0.05, { lowpass: 0.5, seed: 7 });
    return b;
  },
  // 操作失败：低沉的短促提示
  error() {
    const b = makeBuffer(0.24);
    addTone(b, 0, 0.2, 230, 0.22, { type: 'square', glide: 150, attack: 0.005, release: 0.06 });
    addTone(b, 0, 0.2, 115, 0.1, { attack: 0.005, release: 0.06 });
    return b;
  },
  // 买兵：两枚铜钱
  buy() {
    const b = makeBuffer(0.32);
    addTone(b, 0.00, 0.16, 1250, 0.22, { attack: 0.003, release: 0.08 });
    addTone(b, 0.09, 0.16, 1660, 0.18, { attack: 0.003, release: 0.08 });
    addTone(b, 0.16, 0.12, 2100, 0.1, { attack: 0.003, release: 0.06 });
    return b;
  },
  // 领奖 / 签到：三声风铃
  reward() {
    const b = makeBuffer(0.52);
    addTone(b, 0.00, 0.2, 784, 0.2, { attack: 0.004, release: 0.1 });
    addTone(b, 0.13, 0.24, 1046, 0.2, { attack: 0.004, release: 0.1 });
    addTone(b, 0.26, 0.22, 1318, 0.16, { attack: 0.004, release: 0.1 });
    return b;
  },
  // 开箱：小号角 + 闪光
  chest() {
    const b = makeBuffer(0.82);
    const notes = [392, 523, 659, 784, 1046];
    notes.forEach((f, i) => {
      addTone(b, i * 0.11, 0.2, f, i === notes.length - 1 ? 0.24 : 0.16, { type: 'tri', release: 0.08 });
    });
    addNoise(b, 0.42, 0.3, 0.06, { lowpass: 0.55, seed: 11 });
    return b;
  },
  // 近战挥砍
  slash() {
    const b = makeBuffer(0.16);
    addNoise(b, 0, 0.12, 0.32, { lowpass: 0.28, release: 0.06, seed: 3 });
    addTone(b, 0, 0.1, 900, 0.13, { type: 'tri', glide: 500, attack: 0.003, release: 0.04 });
    return b;
  },
  // 弓箭 / 弩箭离弦
  arrow() {
    const b = makeBuffer(0.18);
    addNoise(b, 0, 0.16, 0.18, { lowpass: 0.08, attack: 0.01, release: 0.09, seed: 5 });
    addTone(b, 0, 0.14, 1500, 0.08, { glide: 720, attack: 0.004, release: 0.05 });
    return b;
  },
  // 受击：闷响
  hit() {
    const b = makeBuffer(0.11);
    addNoise(b, 0, 0.075, 0.34, { lowpass: 0.16, release: 0.03, seed: 9 });
    addTone(b, 0, 0.08, 280, 0.24, { type: 'tri', glide: 170, attack: 0.003, release: 0.03 });
    return b;
  },
  // 倒地：低沉的闷响 + 一点甲片轻响，不刺耳
  death() {
    const b = makeBuffer(0.4);
    addTone(b, 0, 0.34, 190, 0.26, { type: 'tri', glide: 90, attack: 0.004, release: 0.2 });
    addNoise(b, 0.03, 0.24, 0.1, { lowpass: 0.06, attack: 0.008, release: 0.14, seed: 13 });
    addTone(b, 0.13, 0.1, 520, 0.035, { type: 'tri', attack: 0.002, release: 0.05 });
    return b;
  },
  // 虎豹骑冲锋撞击
  charge() {
    const b = makeBuffer(0.44);
    addTone(b, 0, 0.3, 280, 0.1, { type: 'saw', glide: 880, attack: 0.02, release: 0.1 });
    addNoise(b, 0, 0.28, 0.12, { lowpass: 0.06, attack: 0.04, release: 0.12, seed: 15 });
    addTone(b, 0.25, 0.13, 220, 0.36, { type: 'tri', glide: 150, attack: 0.003, release: 0.05 });
    addNoise(b, 0.25, 0.12, 0.3, { lowpass: 0.2, release: 0.06, seed: 17 });
    return b;
  },
  // 中毒：气泡
  poison() {
    const b = makeBuffer(0.32);
    [0.02, 0.12, 0.21].forEach((at, i) => {
      addTone(b, at, 0.1, 560 + i * 160, 0.1, { tremolo: 0.35, attack: 0.006, release: 0.05 });
    });
    addNoise(b, 0.02, 0.24, 0.04, { lowpass: 0.3, seed: 19 });
    return b;
  },
  // 胜利：古风战场得胜 —— 低沉战鼓 + 青铜编钟 + 短竹笛，3 秒，干净不吵闹
  victory() {
    const b = makeBuffer(3.0);
    // 低沉战鼓（只在重拍上，音量克制）
    [0.0, 0.55, 1.1, 2.42].forEach((at, i) => {
      addTone(b, at, 0.36, 108, 0.15, { type: 'tri', glide: 66, attack: 0.004, release: 0.22 });
      addNoise(b, at, 0.16, 0.09, { lowpass: 0.05, attack: 0.004, release: 0.1, seed: 23 + i });
    });
    // 青铜编钟：中低音、长余韵，没有刺耳高音
    [[0.24, 392], [0.8, 494], [1.34, 587]].forEach(([at, f]) => {
      addTone(b, at, 0.8, f, 0.085, { type: 'tri', attack: 0.006, release: 0.58 });
      addTone(b, at, 0.55, f * 1.5, 0.02, { type: 'sine', attack: 0.006, release: 0.4 });
    });
    // 短竹笛：中音区小乐句，带一点气息声
    [[1.52, 523, 0.3], [1.82, 587, 0.3], [2.1, 659, 0.42], [2.54, 587, 0.36]].forEach(([at, f, dur], i) => {
      addTone(b, at, dur, f, 0.14, { type: 'sine', attack: 0.03, release: 0.16, tremolo: 0.05 });
      addNoise(b, at, dur, 0.018, { lowpass: 0.4, attack: 0.05, release: 0.12, seed: 41 + i });
    });
    // 收尾低音铺底，让结尾从容落下
    addTone(b, 2.2, 0.75, 196, 0.04, { attack: 0.05, release: 0.5 });
    addTone(b, 2.2, 0.75, 262, 0.03, { attack: 0.05, release: 0.5 });
    return b;
  },
  // 失败：闷鼓 + 低沉古琴残音 + 微弱铜铃，3 秒，克制不吓人
  defeat() {
    const b = makeBuffer(3.0);
    // 闷鼓：收兵回营的两声
    [0.0, 1.18].forEach((at, i) => {
      addTone(b, at, 0.5, 96, 0.11, { type: 'tri', glide: 58, attack: 0.012, release: 0.32 });
      addNoise(b, at, 0.26, 0.06, { lowpass: 0.04, attack: 0.01, release: 0.2, seed: 51 + i });
    });
    // 古琴：低音残音，一音一收
    [[0.24, 196, 1.1], [1.02, 174, 1.0], [1.78, 147, 1.0], [2.34, 131, 0.55]].forEach(([at, f, dur]) => {
      addTone(b, at, dur, f, 0.095, { type: 'tri', attack: 0.01, release: dur * 0.75 });
      addTone(b, at, dur * 0.8, f * 2, 0.022, { attack: 0.01, release: dur * 0.7 });
    });
    // 微弱铜铃：只在两个位置轻点一下
    [0.55, 2.25].forEach((at) => {
      addTone(b, at, 0.4, 587, 0.032, { type: 'sine', attack: 0.01, release: 0.3 });
    });
    // 低音持续音，平稳收尾
    addTone(b, 0, 2.6, 98, 0.028, { attack: 0.08, release: 0.8 });
    return b;
  },
};

/* ---------- 占位 BGM：8 秒可循环的英雄主题 ---------- */
function buildBgmLoop() {
  const b = makeBuffer(8);
  const chords = [
    { bass: 146.8, notes: [293.7, 349.9, 440.0] },   // Dm
    { bass: 116.5, notes: [233.1, 293.7, 349.9] },   // Bb
    { bass: 174.6, notes: [261.6, 349.9, 440.0] },   // F
    { bass: 130.8, notes: [261.6, 329.6, 392.0] },   // C
  ];
  for (let c = 0; c < 4; c++) {
    const t0 = c * 2;
    const ch = chords[c];
    addTone(b, t0, 2.0, ch.bass, 0.09, { type: 'tri', attack: 0.05, release: 0.2 });
    addTone(b, t0, 2.0, ch.bass * 2, 0.03, { attack: 0.05, release: 0.2 });
    for (let i = 0; i < 8; i++) {
      const f = ch.notes[i % ch.notes.length];
      addTone(b, t0 + i * 0.25, 0.22, f, 0.055, { type: 'tri', attack: 0.01, release: 0.08 });
    }
    // 每两拍一记轻轻的鼓点
    for (let i = 0; i < 2; i++) {
      addNoise(b, t0 + i, 0.05, 0.12, { lowpass: 0.2, attack: 0.002, release: 0.03, seed: 31 + c * 3 + i });
    }
    // 主旋律：简单的 4 音动机（原创）
    const motif = [ch.notes[2], ch.notes[1], ch.notes[0], ch.notes[1]];
    motif.forEach((f, i) => addTone(b, t0 + 0.25 + i * 0.45, 0.32, f * 1.0, 0.07, { type: 'sine', release: 0.12 }));
  }
  // 首尾各做 20ms 淡入淡出，避免循环接缝爆音
  const fade = Math.floor(0.02 * SR);
  for (let i = 0; i < fade; i++) {
    b[i] *= i / fade;
    b[b.length - 1 - i] *= i / fade;
  }
  return b;
}

/* ---------- 输出 ---------- */
let total = 0;
for (const [name, fn] of Object.entries(SFX)) {
  const file = path.join(SFX_DIR, `${name}.wav`);
  const bytes = writeWav(file, fn());
  total += bytes;
  console.log(`  ${name.padEnd(10)} ${String(Math.round(bytes / 1024)).padStart(4)} KB`);
}

const bgm = path.join(AUDIO_DIR, 'bgm_heroic_loop.wav');
const bgmBytes = writeWav(bgm, buildBgmLoop());
total += bgmBytes;
console.log(`  ${'bgm_loop'.padEnd(10)} ${String(Math.round(bgmBytes / 1024)).padStart(4)} KB（占位循环，真实 BGM 放 assets/audio/glorious_morning.mp3）`);
console.log(`已生成 ${Object.keys(SFX).length + 1} 个音频文件，共 ${Math.round(total / 1024)} KB → assets/audio/`);
