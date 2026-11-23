# 音频目录

## 两条 BGM：主 / 商城

- **主 BGM**：`glorious_morning.mp3`（《战争进化史》/ Age of War 的 Glorious Morning），首页、关卡、布阵、兵营、宝箱、每日、战斗、结算都共用这一条，切换页面只暂停 / 恢复，不重新起播。
- **商城 BGM**：`bgm_heroic_loop.wav`（`node tools/gen-audio.mjs` 生成的 8 秒英雄主题循环），只在商城里播放；离开商城会暂停，再进商城从上次位置继续。
- 主曲缺失 / 解码失败时，主轨会自动换成商城循环兜底，不会整场静音。
- 首页顶部「声音」打开设置面板，可分别调 **BGM 音量**和**音效音量**（点击 / 拖动滑条），总开关与音量都写进存档。

### 放入真实主 BGM

1. 把**你有授权的**《战争进化史》/《Glorious Morning》音频命名为 `glorious_morning.mp3`，放到本目录。
2. **主 BGM 会自动进入 `pkg_audio` 分包**（进入游戏后静默下载），不占 4 MB 主包额度；音质优先，不需要为了体积做有损压缩。除 `bgm_heroic_loop.mp3` 与 `sfx/` 之外，本目录下的音频文件都会被构建脚本自动迁入分包。
3. 分包未就绪或下载失败时，主包里的 `bgm_heroic_loop.mp3`（48KB）先顶上；下载完成后音频层自动平滑升级到高音质主曲，玩家不会遇到整场静音。
4. 命令行编码工具仍保留备用：`node tools/encode-bgm.mjs "D:\你的文件.mp3"`。
5. 单文件版 `三国小兵军团.html` 也按相对路径读取，`assets/` 目录要和 HTML 放在一起。

## 音效

`sfx/*.wav` 由 `node tools/gen-audio.mjs` 生成（16kHz 单声道 PCM，体积很小）：

| 文件 | 触发 |
| --- | --- |
| `tap.wav` | 通用点击 / 切倍速 |
| `place.wav` | 上阵 / 换位 / 按战力布阵 |
| `withdraw.wav` | 撤下 |
| `merge.wav` | 合成成功 / 一键合成 |
| `error.wav` | 合成失败 / 铜钱不足 / 兵营满 / 宝箱打不开 |
| `buy.wav` | 商城买兵 |
| `reward.wav` | 签到 / 每日任务 / 7 日登录 / 挂机领取 / 高级宝箱 |
| `chest.wav` | 打开宝箱 |
| `slash.wav` | 近战出手 |
| `arrow.wav` | 远程 / 骑射出手 |
| `death.wav` | 单位被击倒 |
| `charge.wav` | 虎豹骑冲锋撞击 |
| `poison.wav` | 中毒持续伤害 |
| `victory.wav` | 胜利结算 |
| `defeat.wav` | 失败结算 |

改音量 / 节流：`CONFIG.audio`（`sfxVolume`、`bgm.volume`、`gaps`）；首页「声音 开/关」
会把 `state.audio` 写进存档。
