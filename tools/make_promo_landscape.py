# -*- coding: utf-8 -*-
"""生成微信小游戏「详细推广图（横版）」1920x1080，用于发现-游戏-游戏圈信息流。
左侧文案区 + 右侧实机战场，画风与游戏一致。"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

ROOT = r"D:/Projects/record/trae_project/game_demo"
OUT = os.path.join(ROOT, "docs", "推广图_横版_1920x1080.png")
W, H = 1920, 1080

FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_HEI = "C:/Windows/Fonts/simhei.ttf"

def f(path, size):
    return ImageFont.truetype(path, size)

def text_center(d, xy, s, font, fill, anchor="mm"):
    d.text(xy, s, font=font, fill=fill, anchor=anchor)

# ---------- 1. 深棕古风渐变背景 ----------
bg = Image.new("RGB", (W, H))
d = ImageDraw.Draw(bg)
left_c, right_c = (42, 31, 20), (14, 10, 7)
for x in range(W):
    t = x / (W - 1)
    c = tuple(int(left_c[i] + (right_c[i] - left_c[i]) * t) for i in range(3))
    d.line([(x, 0), (x, H)], fill=c)

glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse((0, 80, 700, 780), fill=(180, 130, 50, 42))
glow = glow.filter(ImageFilter.GaussianBlur(90))
bg = Image.alpha_composite(bg.convert("RGBA"), glow).convert("RGB")
d = ImageDraw.Draw(bg)

GOLD = (222, 178, 92)
GOLD_L = (245, 214, 145)
CREAM = (226, 210, 180)

# ---------- 2. 左侧文案区 ----------
LX = 60
d.line([(LX, 150), (LX + 700, 150)], fill=(120, 92, 48), width=2)
d.text((LX, 108), "汉末策略 · 放置布阵", font=f(FONT_HEI, 30), fill=(168, 140, 96))

title = Image.open(os.path.join(ROOT, "assets", "ui", "title.png")).convert("RGBA")
tw = 720
th = int(title.height * tw / title.width)
title = title.resize((tw, th), Image.LANCZOS)
bg.paste(title, (LX, 205), title)
d = ImageDraw.Draw(bg)

d.text((LX + 4, 445), "单机放置 · 布阵冲阵 · 过关斩将", font=f(FONT_BOLD, 36), fill=GOLD_L)
d.text((LX + 4, 505), "挂机合成 · 收集传奇英雄", font=f(FONT_HEI, 28), fill=CREAM)

# 三个卖点胶囊
caps = ["挂机放置", "武将合成", "传奇英雄"]
cap_w, gap = 216, 18
for i, label in enumerate(caps):
    x = LX + 4 + i*(cap_w+gap)
    y = 580
    d.rounded_rectangle((x, y, x+cap_w, y+66), radius=14,
                        fill=(46, 34, 22), outline=(150, 114, 56), width=2)
    text_center(d, (x+cap_w//2, y+33), label, f(FONT_BOLD, 30), GOLD_L)

d.text((LX + 4, 700), "全免费 · 无游戏内购", font=f(FONT_BOLD, 44), fill=(238, 196, 118))
d.line([(LX, 790), (LX + 700, 790)], fill=(120, 92, 48), width=2)
d.text((LX + 4, 815), "汉末行伍征战记", font=f(FONT_HEI, 26), fill=(168, 140, 96))

# ---------- 3. 右侧实机战斗画面 ----------
im = Image.open(os.path.join(ROOT, "docs", "落地效果_战斗.png")).convert("RGB")
# 取战场主体（避开顶部排行榜与底部按钮栏），裁成接近 1100:900 的比例
scene = im.crop((0, 430, 750, 1045))
RX, RY, RW, RH = 820, 90, 1100, 900
scene = scene.resize((RW, RH), Image.LANCZOS)
bg.paste(scene, (RX, RY))

# 四边渐隐，融入背景
def edge_fade(x0, y0, x1, y1, sides):
    ov = Image.new("RGBA", (x1-x0, y1-y0), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    w, h = x1-x0, y1-y0
    if "top" in sides:
        for i in range(90):
            a = int(220 * (1 - i/90))
            od.line([(0,i),(w,i)], fill=(14,10,7,a))
    if "bottom" in sides:
        for i in range(90):
            a = int(255 * i/90)
            od.line([(0,h-90+i),(w,h-90+i)], fill=(14,10,7,a))
    if "left" in sides:
        for i in range(70):
            a = int(230 * (1 - i/70))
            od.line([(i,0),(i,h)], fill=(42,31,20,a))
    region = bg.crop((x0,y0,x1,y1)).convert("RGBA")
    region = Image.alpha_composite(region, ov).convert("RGB")
    bg.paste(region, (x0,y0))

edge_fade(RX, RY, RX+RW, RY+RH, {"top", "bottom", "left"})

bg.save(OUT, "PNG", optimize=True)
print("saved:", OUT, bg.size, "bytes:", os.path.getsize(OUT))
