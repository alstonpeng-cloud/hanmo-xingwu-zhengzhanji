# -*- coding: utf-8 -*-
"""生成微信小游戏「详细推广图（竖版）」1080x1920。
主体用实机战斗截图，保证画风与游戏一致，避免审核判货不对板。"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

ROOT = r"D:/Projects/record/trae_project/game_demo"
OUT = os.path.join(ROOT, "docs", "推广图_竖版_1080x1920.png")
W, H = 1080, 1920

FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_HEI = "C:/Windows/Fonts/simhei.ttf"

def f(path, size):
    return ImageFont.truetype(path, size)

def text_center(d, xy, s, font, fill, anchor="mm"):
    d.text(xy, s, font=font, fill=fill, anchor=anchor)

# ---------- 1. 深棕古风渐变背景 ----------
bg = Image.new("RGB", (W, H))
d = ImageDraw.Draw(bg)
top, bot = (40, 30, 20), (12, 9, 7)
for y in range(H):
    t = y / (H - 1)
    c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    d.line([(0, y), (W, y)], fill=c)

# 背景淡淡的光晕
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse((W//2-420, 60, W//2+420, 620), fill=(180, 130, 50, 40))
glow = glow.filter(ImageFilter.GaussianBlur(90))
bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
d = ImageDraw.Draw(bg)

GOLD = (222, 178, 92)
GOLD_L = (245, 214, 145)
CREAM = (226, 210, 180)
RED = (168, 51, 42)

# ---------- 2. 顶部标题区 ----------
# 细金线框（左右留白，不贴边）
d.line([(70, 96), (W-70, 96)], fill=(120, 92, 48), width=2)
d.line([(70, 486), (W-70, 486)], fill=(120, 92, 48), width=2)
text_center(d, (W//2, 68), "汉 末 策 略 · 放 置 布 阵", f(FONT_HEI, 26), (168, 140, 96))

title = Image.open(os.path.join(ROOT, "assets", "ui", "title.png")).convert("RGBA")
tw = 880
th = int(title.height * tw / title.width)
title = title.resize((tw, th), Image.LANCZOS)
bg.paste(title, ((W-tw)//2, 120), title)
d = ImageDraw.Draw(bg)

text_center(d, (W//2, 400), "单机放置 · 布阵冲阵 · 过关斩将", f(FONT_BOLD, 38), GOLD_L)
text_center(d, (W//2, 452), "挂机合成 收集传奇英雄", f(FONT_HEI, 28), CREAM)

# ---------- 3. 实机战斗画面（主体视觉焦点）----------
im = Image.open(os.path.join(ROOT, "docs", "落地效果_战斗.png")).convert("RGB")
# 裁掉实机 UI（顶部伤害排行榜、底部按钮栏），只留战场主体
scene = im.crop((0, 470, 750, 1130))
scene = scene.resize((W, int(scene.height * W / scene.width)), Image.LANCZOS)
SY = 500
bg.paste(scene, (0, SY))
scene_bottom = SY + scene.height

# 上下渐隐遮罩，衔接标题区与底部区
def voverlay(y0, y1, top_alpha, bot_alpha, color=(16, 11, 8)):
    ov = Image.new("RGBA", (W, y1-y0), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for i in range(y1-y0):
        a = int(top_alpha + (bot_alpha-top_alpha) * i/(y1-y0-1))
        od.line([(0,i),(W,i)], fill=color+(a,))
    bg.paste(ov.convert("RGB"), (0, y0)) if False else bg.paste(Image.alpha_composite(bg.crop((0,y0,W,y1)).convert("RGBA"), ov).convert("RGB"), (0,y0))

voverlay(SY, SY+130, 235, 0)
voverlay(scene_bottom-150, scene_bottom, 0, 255)
d = ImageDraw.Draw(bg)

# ---------- 4. 底部卖点 + 引导 ----------
BY = scene_bottom + 6
# 三个卖点胶囊
caps = [("挂机放置", 0), ("武将合成", 1), ("传奇英雄", 2)]
cap_w, gap, x0 = 296, 26, 62
for label, i in caps:
    x = x0 + i*(cap_w+gap)
    y = BY + 18
    d.rounded_rectangle((x, y, x+cap_w, y+74), radius=16,
                        fill=(46, 34, 22), outline=(150, 114, 56), width=2)
    text_center(d, (x+cap_w//2, y+37), label, f(FONT_BOLD, 34), GOLD_L)

# 主标语（两行）
text_center(d, (W//2, BY+150), "全 免 费 · 无 游 戏 内 购", f(FONT_BOLD, 46), (238, 196, 118))
text_center(d, (W//2, BY+228), "闯关斩将 一统汉末", f(FONT_HEI, 34), CREAM)

# 底部金线与落款
d.line([(70, BY+292), (W-70, BY+292)], fill=(120, 92, 48), width=2)
text_center(d, (W//2, BY+336), "汉末行伍征战记", f(FONT_HEI, 26), (168, 140, 96))

# 裁剪到 1920 并保存
if bg.height > H:
    bg = bg.crop((0, 0, W, H))
else:
    pad = Image.new("RGB", (W, H), (12, 9, 7))
    pad.paste(bg, (0, 0))
    bg = pad

bg.save(OUT, "PNG", optimize=True)
print("saved:", OUT, bg.size, "bytes:", os.path.getsize(OUT))
