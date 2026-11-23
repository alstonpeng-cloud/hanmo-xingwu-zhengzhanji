#!/usr/bin/env python3
"""板块 3/4 · AI 美术后处理：把 docs/_artgen/<key>/*.png 变成可进分包的游戏素材。

模型输出固定带右下角「AI生成 WORKBUDDY」水印，且 transparent 参数对部分模型不生效
（立绘仍是浅灰渐变底）。本脚本做两件事：
  1) matte  —— 透明底资源（英雄 / 宝箱 / 器械 / 纹样）：从画面边界做 flood fill，
     只吃掉「连通到边缘的浅灰白低饱和背景」，人物内部的银色刀刃、皮肤高光不会被误抠；
     再强制清掉右下角水印区，最后 0.7px 羽化，避免硬边。
  2) dewmark —— 不透明资源（背景插画）：用水印区左侧紧邻块的水平镜像做羽化覆盖，
     接缝处保持纹理连续，不裁掉底部云纹。

目录名即输出文件名；前缀决定进入哪个分包目录：
  hero_*  -> assets/heroes/   (matte)
  siege_* -> assets/siege/    (matte)
  chest_* -> assets/art/      (matte)
  orn_*   -> assets/art/      (matte)
  bg_*    -> assets/art/      (dewmark)
另有 --preview：把 matte 结果叠到暖褐底 #2a2218 上，输出到 docs/_artgen/_preview/ 供人工目检。
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / 'docs' / '_artgen'
ASSETS = ROOT / 'assets'
PREVIEW = GEN / '_preview'

RULES = [
    ('hero_',  'heroes', 'matte'),
    ('siege_', 'siege',  'matte'),
    ('troop_', 'siege',  'matte'),
    ('chest_', 'art',    'matte'),
    ('orn_',   'art',    'matte'),
    ('bg_',    'art',    'dewmark'),
]

# 水印占右下角；宁可多覆盖一点，也不要让模型标识进游戏
WM_X0 = 0.82
WM_Y0 = 0.925

# 五张全屏背景统一用 4:4:4 q95 JPEG。
# 三屏曾改无损 PNG 填满预算，但微信按十进制算 30MB 红线时 zip 达 30.24MB 越线，
# 上传被 abort。退回 q95 后总包回落到约 26MB，全屏插画肉眼无差。
# 与 src/render/packageArt.js 的 BG_LOSSLESS 保持一致（此处为空集）。
LOSSLESS_BG = set()


def newest_png(folder):
    files = sorted(folder.glob('*.png'), key=lambda p: p.stat().st_mtime)
    return files[-1] if files else None


def edge_strength(rgb):
    """四邻域最大灰度差。影棚底是绝对平滑渐变（值≈1~5），
    甲片鳞纹 / 刀刃高光 / 木纹 / 绳索都有明显局部起伏（值>15）。
    这是区分「浅灰背景」与「浅色实体」最可靠的维度。"""
    g = rgb.astype(np.float32).mean(axis=2)
    return np.maximum.reduce([
        np.abs(g - np.roll(g, 1, axis=0)), np.abs(g - np.roll(g, -1, axis=0)),
        np.abs(g - np.roll(g, 1, axis=1)), np.abs(g - np.roll(g, -1, axis=1)),
    ])


def erode(mask, steps=1):
    out = mask
    for _ in range(steps):
        shrunk = out.copy()
        shrunk[1:, :] &= out[:-1, :]
        shrunk[:-1, :] &= out[1:, :]
        shrunk[:, 1:] &= out[:, :-1]
        shrunk[:, :-1] &= out[:, 1:]
        out = shrunk
    return out


def dilate(mask, steps=1):
    out = mask
    for _ in range(steps):
        grown = out.copy()
        grown[1:, :] |= out[:-1, :]
        grown[:-1, :] |= out[1:, :]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def flood(mask, seed, iters=700):
    """在 mask 允许范围内，从 seed 做四邻域区域生长。"""
    visited = seed.copy()
    frontier = seed.copy()
    for _ in range(iters):
        nxt = dilate(frontier, 1) & mask & ~visited
        if not nxt.any():
            break
        visited |= nxt
        frontier = nxt
    return visited


def background_field(rgb):
    """拟合该图的影棚渐变底色场。
    先取四边框（排除右下水印）作样本，再按「色差小 + 低饱和」迭代提纯，
    使拟合只吃真正的背景像素，不受贴边主体 / 水印文字干扰。"""
    src = rgb.astype(np.float64)
    h, w, _ = rgb.shape
    k = max(24, int(min(h, w) * 0.05))
    border = np.zeros((h, w), dtype=bool)
    border[:k, :] = border[-k:, :] = True
    border[:, :k] = border[:, -k:] = True
    border[int(h * WM_Y0):, int(w * WM_X0):] = False
    a = rgb.astype(np.int16)
    sat = a.max(axis=2) - a.min(axis=2)
    field = fit_background_field(rgb, border)
    for _ in range(3):
        d = np.linalg.norm(src - field, axis=2)
        field = fit_background_field(rgb, (d < 22) & (sat < 50))
    return field


def outside_region(rgb, field, preset):
    """从边界按「接近背景色场 + 低饱和 + 较亮 + 低纹理」做区域生长。
    相比旧版两处关键修正：
      1) 不再要求暖灰 R>B —— chest_rare / hero_zhangren 的背景是中性灰甚至微冷灰，
         旧判据直接把它们排除在外，留下整片浅灰底。
      2) 用「与背景色场的色差」而非纯边缘强度作扩散条件 —— 关羽那类带水平
         渐变纹理的影棚底，边缘强度处处 >12，旧版只能吃掉很窄一圈。
    主体轮廓（饱和衣饰 / 深色甲片 / 冷灰刀刃）色差大或饱和高，天然形成屏障。"""
    src = rgb.astype(np.float64)
    d = np.linalg.norm(src - field, axis=2)
    a = rgb.astype(np.int16)
    sat = a.max(axis=2) - a.min(axis=2)
    bright = (a.max(axis=2) + a.min(axis=2)) / 2
    e = edge_strength(rgb)
    grow = ((d < preset['d']) & (sat < preset['sat']) &
            (bright > preset['bright']) & (e < preset['edge']))
    h, w = grow.shape
    seed = np.zeros((h, w), dtype=bool)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    seed &= grow
    return flood(grow, seed), d


# 两档抠图强度：先用保守档，残留超标自动升级到激进档（见 matte 的自适应选择）
PRESET_SAFE = dict(d=38, sat=58, bright=92, edge=26)
PRESET_STRONG = dict(d=52, sat=70, bright=78, edge=38)


def fit_background_field(rgb, sample_mask):
    """最小二乘拟合「影棚渐变底」的逐像素颜色场。
    基函数 1,x,y,x²,y²,xy,x³,y³ 足够描述模型那种对角暖灰渐变。"""
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    u = (xx / (w - 1)) * 2 - 1
    v = (yy / (h - 1)) * 2 - 1
    A = np.stack([np.ones_like(u), u, v, u * u, v * v, u * v,
                  u * u * u, v * v * v], axis=-1).reshape(-1, 8)
    idx = np.flatnonzero(sample_mask.reshape(-1))
    if not len(idx):
        return np.broadcast_to(rgb.mean(axis=(0, 1)), (h, w, 3)).copy()
    if len(idx) > 80000:
        idx = idx[::max(1, len(idx) // 80000)]
    coef = np.linalg.lstsq(A[idx], rgb.reshape(-1, 3)[idx].astype(np.float64), rcond=None)[0]
    return (A @ coef).reshape(h, w, 3)


def residual_pct(alpha, rgb):
    """残留的「不透明浅灰白」占比，与验收脚本同一口径。"""
    a = rgb.astype(np.int16)
    r, b = a[:, :, 0], a[:, :, 2]
    sat = a.max(axis=2) - a.min(axis=2)
    bright = (a.max(axis=2) + a.min(axis=2)) / 2
    return ((alpha > 200) & (sat < 45) & (bright > 150) & (r >= b - 3)).mean() * 100


def keep_pct(alpha):
    """中心主体区不透明占比，用于识别「背景清干净了但主体也被吃掉」。"""
    h, w = alpha.shape
    core = alpha[int(h * 0.18):int(h * 0.88), int(w * 0.18):int(w * 0.88)]
    return (core > 200).mean() * 100


def build_alpha(rgb, field, preset):
    """按一档强度生成 alpha。外部影棚底 + 底部白色地面条分别处理。"""
    h, w, _ = rgb.shape
    outer, _ = outside_region(rgb, field, preset)
    a = rgb.astype(np.int16)
    sat = a.max(axis=2) - a.min(axis=2)
    bright = (a.max(axis=2) + a.min(axis=2)) / 2
    e = edge_strength(rgb)
    # 模型常在底部画一条白色影棚地面，与渐变底之间有亮度台阶，区域生长够不到。
    # 从「底边 + 下半部左右边界」同时起种子：银箱右下 / 张任脚下的白块往往
    # 被中间暗色阴影带与底边隔开，只从最底行起种子会漏掉。
    # 连通限定保证人物/箱体内部的浅色高光（不贴边）不会被误伤。
    lower = np.broadcast_to((np.arange(h)[:, None] > h * 0.55), (h, w))
    # 影棚地面有两种：中性浅灰（sat<58）与米白暖地面（刘备那块 sat≈66）。
    # 用「暖度 R-B>25」专门识别后者：银甲 / 银箱包边是中性色(R-B≈0)，
    # 深色木纹虽暖但亮度低，衣袍金纹虽暖但有高频纹理，三者都不会进入候选。
    # 两个判据取并集，保持原有中性灰地面的连通路径完全不变。
    r, b = a[:, :, 0], a[:, :, 2]
    neutral_ground = (sat < 58) & (bright > 100)
    warm_ground = (r - b > 25) & (bright > 150) & (sat < 90)
    floor_mask = lower & (e < 34) & (neutral_ground | warm_ground)
    floor_seed = np.zeros((h, w), dtype=bool)
    y0 = int(h * 0.55)
    floor_seed[-1, :] = True
    floor_seed[y0:, :int(w * 0.10)] = True
    floor_seed[y0:, int(w * 0.90):] = True
    floor_seed &= floor_mask
    floor = flood(floor_mask, floor_seed, iters=400)
    bg = dilate(outer, 1) | dilate(floor, 1)

    # 3) 二次扩散：底部影棚地面条里被主体挡住的孤立白块（两腿之间 / 箱底），
    #    从「所有已清背景的边缘」而非仅画面边界再扩散一轮即可覆盖。
    #    这里必须用比第 2 步严格得多的「近白」条件：否则银箱右下的暗木纹
    #    也会被当成地面啃出一块黑洞。只清几乎纯白的影棚地面，不动任何有
    #    颜色 / 纹理的实体表面。
    strict = lower & (sat < 42) & (bright > 175) & (e < 26)
    seed2 = dilate(bg, 1) & strict
    if seed2.any():
        bg = bg | flood(strict, seed2, iters=200)

    # 4) 最后收一类：被主体完全包围、连「已清背景边缘」都挨不到的近白块，
    #    典型是张任两腿之间那块薄薄的影棚地面。限定在画面中下部矩形内，
    #    且只认「近白 + 低饱和 + 低纹理」；宝箱中央是深色木纹（饱和高）、
    #    英雄衣袍是米金色（饱和高）都不在候选内，不会重演银箱被啃洞。
    #    这里不再用开运算挑大块：白条本身很薄，腐蚀会把它的核心吃没。
    zone = np.zeros((h, w), dtype=bool)
    zone[int(h * 0.70):int(h * 0.97), int(w * 0.28):int(w * 0.72)] = True
    bg = bg | (zone & (sat < 40) & (bright > 170) & (e < 30) & ~bg)
    return np.where(bg, 0, 255).astype(np.uint8)


def choose_alpha(rgb):
    """保守档优先；残留超标才升级，并要求主体保留度不显著下降。"""
    field = background_field(rgb)
    alpha = build_alpha(rgb, field, PRESET_SAFE)
    res = residual_pct(alpha, rgb)
    if res > 2.5:
        alt = build_alpha(rgb, field, PRESET_STRONG)
        if (residual_pct(alt, rgb) < res * 0.6 and
                keep_pct(alt) > keep_pct(alpha) * 0.72):
            alpha = alt
    return alpha


def matte(im, forced=None):
    """输出透明底素材。forced 用于 --exp 调试：直接指定某一档强度。"""
    im = im.convert('RGBA')
    arr = np.array(im)
    rgb = arr[:, :, :3]
    h, w, _ = rgb.shape
    if forced:
        alpha = build_alpha(rgb, background_field(rgb),
                            PRESET_STRONG if forced == 'strong' else PRESET_SAFE)
    else:
        alpha = choose_alpha(rgb)

    # 水印区强制透明（主体居中，右下角不会有角色/箱体）
    alpha[int(h * WM_Y0):, int(w * WM_X0):] = 0
    alpha_img = Image.fromarray(alpha).filter(ImageFilter.MedianFilter(3))
    soft = np.array(alpha_img.filter(ImageFilter.GaussianBlur(0.7)))
    arr[:, :, 3] = soft
    # 无损体积优化：全透明像素的 RGB 归零，PNG 对大片零值压缩率极高。
    dead = soft == 0
    arr[dead, 0] = 0
    arr[dead, 1] = 0
    arr[dead, 2] = 0
    # 边缘去灰：半透明像素把残留的浅灰影棚色拉向暖褐，避免一圈白边
    edge = (soft > 0) & (soft < 250)
    if edge.any():
        f = (soft[edge] / 255.0).astype(np.float32)[:, None]
        orig = arr[:, :, :3][edge].astype(np.float32)
        arr[:, :, :3][edge] = (orig * f + np.array([42, 34, 24], np.float32) * (1 - f)).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def dewmark(im):
    im = im.convert('RGB')
    arr = np.array(im).astype(np.float32)
    h, w, _ = arr.shape
    x0, y0 = int(w * WM_X0), int(h * WM_Y0)
    pw, ph = w - x0, h - y0
    sx0, sx1 = x0 - pw, x0
    if sx0 < 0:
        sx0, sx1 = 0, pw
    patch = arr[y0:y0 + ph, sx0:sx1][:, ::-1, :].copy()
    wy = np.clip(np.arange(ph, dtype=np.float32) / 22.0, 0, 1)[:, None]
    wx = np.clip(np.arange(pw, dtype=np.float32) / 22.0, 0, 1)[None, :]
    m = (wy * wx)[:, :, None]
    region = arr[y0:y0 + ph, x0:x0 + pw]
    arr[y0:y0 + ph, x0:x0 + pw] = region * (1 - m) + patch * m
    # 背景是不透明插画，直接存 RGB（不带 alpha 通道）：少一个全 255 通道，
    # PNG 每行少 25% 字节且滤波效率更高，属于完全无损优化。
    return Image.fromarray(arr.astype(np.uint8), 'RGB')


def exp_main(args):
    """--exp [--only k1,k2]：只在临时目录生成保守/激进/自适应三档对比，不写 assets。"""
    out = GEN / '_exp'
    out.mkdir(parents=True, exist_ok=True)
    only = None
    if '--only' in args:
        only = set(args[args.index('--only') + 1].split(','))
    keys = [f.name for f in sorted(GEN.iterdir())
            if f.is_dir() and not f.name.startswith('_')
            and f.name.startswith(('hero_', 'chest_', 'siege_'))
            and (not only or f.name in only)]
    for key in keys:
        src = newest_png(GEN / key)
        if not src:
            continue
        im = Image.open(src).convert('RGBA')
        rgb = np.array(im)[:, :, :3]
        field = background_field(rgb)
        print(f'\n{key}')
        for tag, preset in [('safe', PRESET_SAFE), ('strong', PRESET_STRONG)]:
            al = build_alpha(rgb, field, preset)
            al[int(rgb.shape[0] * WM_Y0):, int(rgb.shape[1] * WM_X0):] = 0
            print(f'  {tag:<7} 残留 {residual_pct(al, rgb):6.2f}%  主体保留 {keep_pct(al):6.2f}%')
            comp = Image.new('RGBA', im.size, (42, 34, 24, 255))
            tmp = np.array(im)
            tmp[:, :, 3] = al
            comp.alpha_composite(Image.fromarray(tmp, 'RGBA'))
            comp.convert('RGB').save(out / f'{key}_{tag}.png')
        auto = choose_alpha(rgb)
        auto[int(rgb.shape[0] * WM_Y0):, int(rgb.shape[1] * WM_X0):] = 0
        print(f'  auto    残留 {residual_pct(auto, rgb):6.2f}%  主体保留 {keep_pct(auto):6.2f}%')
        comp = Image.new('RGBA', im.size, (42, 34, 24, 255))
        tmp = np.array(im)
        tmp[:, :, 3] = auto
        comp.alpha_composite(Image.fromarray(tmp, 'RGBA'))
        comp.convert('RGB').save(out / f'{key}_auto.png')
    print(f'\n对比图已写入 {out.relative_to(ROOT)}')


def main():
    args = sys.argv[1:]
    if '--exp' in args:
        return exp_main(args)
    do_preview = '--preview' in args
    only = None
    if '--only' in args:
        only = set(args[args.index('--only') + 1].split(','))
    if do_preview:
        PREVIEW.mkdir(parents=True, exist_ok=True)
    rows = []
    for folder in sorted(GEN.iterdir()):
        if not folder.is_dir() or folder.name.startswith('_'):
            continue
        key = folder.name
        if only and key not in only:
            continue
        rule = next((r for r in RULES if key.startswith(r[0])), None)
        if not rule:
            continue
        _, pkg, mode = rule
        src = newest_png(folder)
        if not src:
            continue
        im = Image.open(src)
        out = (matte(im) if mode == 'matte' else dewmark(im))
        dst_dir = ASSETS / pkg
        dst_dir.mkdir(parents=True, exist_ok=True)
        if mode == 'dewmark':
            # 后缀可能因「有损/无损」切换而变化，两种旧文件都先清掉，
            # 否则同一张背景会同时以 .jpg 和 .png 进分包，白占体积。
            for ext in ('png', 'jpg'):
                legacy = dst_dir / (key + '.' + ext)
                if legacy.exists():
                    legacy.unlink()
            if key in LOSSLESS_BG:
                dst = dst_dir / (key + '.png')
                out.convert('RGB').save(dst, optimize=True)
            else:
                dst = dst_dir / (key + '.jpg')
                out.convert('RGB').save(dst, quality=95, subsampling=0, optimize=True)
        else:
            dst = dst_dir / (key + '.png')
            out.save(dst, optimize=True)
        if do_preview:
            if mode == 'matte':
                bg = Image.new('RGBA', out.size, (42, 34, 24, 255))
                bg.alpha_composite(out)
                bg.convert('RGB').save(PREVIEW / (key + '.png'))
            else:
                out.convert('RGB').save(PREVIEW / (key + '.png'))
        rows.append((str(dst.relative_to(ROOT)).replace('\\', '/'), mode,
                     out.size[0], out.size[1], dst.stat().st_size))
    total = 0
    for name, mode, w, h, size in rows:
        total += size
        print(f'{name:<44} {mode:<8} {w}x{h:<5} {size/1048576:6.2f} MB')
    print(f'{"TOTAL":<44} {"":<8} {"":<11} {total/1048576:6.2f} MB  ({len(rows)} files)')


if __name__ == '__main__':
    main()
