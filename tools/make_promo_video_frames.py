# -*- coding: utf-8 -*-
"""为微信小游戏推广视频准备实机画面帧（9:16, 1080x1920）。
从 _smoke 实机截图裁掉 toast/调试区，统一成竖版满屏帧。"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

ROOT = r"D:/Projects/record/trae_project/game_demo"
SMOKE = os.path.join(ROOT, "assets", "_smoke")
FRAMES = os.path.join(ROOT, "docs", "_promo_frames")
os.makedirs(FRAMES, exist_ok=True)

W, H = 1080, 1920
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_HEI = "C:/Windows/Fonts/simhei.ttf"

def font(p, s): return ImageFont.truetype(p, s)

# (文件名, 裁切上边, 裁切下边, 字幕文案) —— 裁掉 toast 区与底部调试按钮
SCENES = [
    ("00c_prologue_battle.png", 150, 95, "千军对冲 · 实时战报"),
    ("12_result.png",            175, 0,  "过关斩将 · 首通得铜钱"),
    ("57c_deploy_full.png",      165, 0,  "自由布阵 · 兵种搭配"),
    ("25d_chests_all_types.png", 175, 0,  "开传奇宝箱 · 收稀有武将"),
]

def make_frame(idx, fn, top, bottom, caption):
    im = Image.open(os.path.join(SMOKE, fn)).convert("RGB")
    # 裁掉顶部 toast 和底部调试/提示按钮
    crop = im.crop((0, top, im.width, im.height - bottom))
    # 缩放铺满 1080x1920（保持比例，居中裁切补齐）
    scale = max(W / crop.width, H / crop.height)
    nw, nh = int(crop.width * scale), int(crop.height * scale)
    crop = crop.resize((nw, nh), Image.LANCZOS)
    x = (nw - W) // 2
    y = (nh - H) // 2
    frame = crop.crop((x, y, x + W, y + H)).convert("RGBA")

    # 底部字幕条（半透明黑 + 金色字）
    bar = Image.new("RGBA", (W, 150), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar)
    for i in range(150):
        a = int(200 * (i / 150) ** 0.6)
        bd.line([(0, i), (W, i)], fill=(14, 10, 7, a))
    d = ImageDraw.Draw(bar)
    d.text((W // 2, 66), caption, font=font(FONT_BOLD, 52),
           fill=(240, 205, 130, 255), anchor="mm")
    frame.alpha_composite(bar, (0, H - 150))
    out = os.path.join(FRAMES, f"scene_{idx:02d}.png")
    frame.convert("RGB").save(out)
    print("frame", idx, fn, "->", out)

for i, (fn, t, b, cap) in enumerate(SCENES):
    make_frame(i, fn, t, b, cap)

# 落版帧：书法标题 + 卖点
title = Image.open(os.path.join(ROOT, "assets", "ui", "title.png")).convert("RGBA")
last = Image.new("RGBA", (W, H), (18, 13, 9, 255))
d = ImageDraw.Draw(last)
for y in range(H):
    t = y / (H - 1)
    c = (int(40 - 24*t), int(29 - 19*t), int(18 - 11*t))
    d.line([(0, y), (W, y)], fill=c + (255,))
tw = 860
th = int(title.height * tw / title.width)
last.alpha_composite(title.resize((tw, th), Image.LANCZOS), ((W-tw)//2, 560))
d = ImageDraw.Draw(last)
d.text((W//2, 900), "挂机放置 · 武将合成 · 传奇英雄", font=font(FONT_BOLD, 46),
       fill=(245, 214, 145), anchor="mm")
d.text((W//2, 1000), "全免费 · 无游戏内购", font=font(FONT_BOLD, 56),
       fill=(238, 196, 118), anchor="mm")
d.line([(160, 1100), (W-160, 1100)], fill=(120, 92, 48), width=2)
d.text((W//2, 1160), "立即体验 汉末行伍征战记", font=font(FONT_HEI, 38),
       fill=(226, 210, 180), anchor="mm")
last.convert("RGB").save(os.path.join(FRAMES, "scene_99_end.png"))
print("end frame saved")
