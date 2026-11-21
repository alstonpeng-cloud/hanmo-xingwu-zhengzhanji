# -*- coding: utf-8 -*-
"""生成微信小游戏「分享图片」5:4 (1080x864)。三张不同风格供选。
会话分享卡片上方系统会自带游戏名+邀请标题，图片侧重画面冲击力+一句钩子。"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

ROOT = r"D:/Projects/record/trae_project/game_demo"
SMOKE = os.path.join(ROOT, "assets", "_smoke")
OUTDIR = os.path.join(ROOT, "docs")
W, H = 1080, 864

FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_HEI = "C:/Windows/Fonts/simhei.ttf"

def font(p, s): return ImageFont.truetype(p, s)

def gradient_bg(c1=(42,31,20), c2=(14,10,7)):
    bg = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y/(H-1)
        c = tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(3))
        d.line([(0,y),(W,y)], fill=c)
    return bg

def cover_crop(im, top_cut, bottom_cut):
    im = im.convert("RGB")
    crop = im.crop((0, top_cut, im.width, im.height-bottom_cut))
    scale = max(W/crop.width, H/crop.height)
    nw, nh = int(crop.width*scale), int(crop.height*scale)
    crop = crop.resize((nw,nh), Image.LANCZOS)
    return crop.crop(((nw-W)//2,(nh-H)//2,(nw-W)//2+W,(nh-H)//2+H)).convert("RGBA")

def caption_bar(frame, text, sub=None):
    bar = Image.new("RGBA",(W,170),(0,0,0,0))
    bd = ImageDraw.Draw(bar)
    for i in range(170):
        a = int(215*(i/170)**0.55)
        bd.line([(0,i),(W,i)], fill=(14,10,7,a))
    d = ImageDraw.Draw(bar)
    d.text((W//2, 62), text, font=font(FONT_BOLD,50), fill=(242,208,132,255), anchor="mm")
    if sub:
        d.text((W//2, 126), sub, font=font(FONT_HEI,28), fill=(214,196,160,255), anchor="mm")
    frame.alpha_composite(bar,(0,H-170))
    return frame

# ---- A 版：三英战 Boss 高光画面 ----
im = Image.open(os.path.join(SMOKE,"49g_hero_battle_final_three_bosses.png"))
a = cover_crop(im, 175, 120)   # 裁掉顶部信息栏与底部操作栏
a = caption_bar(a, "三英聚首 · 共战群雄", "单机放置 布阵冲阵 过关斩将")
a.convert("RGB").save(os.path.join(OUTDIR,"分享图_5比4_A_战斗.png"), optimize=True)
print("A saved")

# ---- B 版：宝箱/稀有武将 ----
im2 = Image.open(os.path.join(SMOKE,"25d_chests_all_types.png"))
b = cover_crop(im2, 175, 0)
b = caption_bar(b, "开传奇宝箱 · 收稀有武将", "挂机合成 收集传奇英雄")
b.convert("RGB").save(os.path.join(OUTDIR,"分享图_5比4_B_宝箱.png"), optimize=True)
print("B saved")

# ---- C 版：书法标题 + 卖点（极简，画面冲击靠字）----
c = gradient_bg().convert("RGBA")
glow = Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(glow)
gd.ellipse((W//2-360,80,W//2+360,620), fill=(190,140,55,50))
glow = glow.filter(ImageFilter.GaussianBlur(80))
c = Image.alpha_composite(c,glow)
d = ImageDraw.Draw(c)
title = Image.open(os.path.join(ROOT,"assets","ui","title.png")).convert("RGBA")
tw = 760; th = int(title.height*tw/title.width)
c.alpha_composite(title.resize((tw,th),Image.LANCZOS), ((W-tw)//2, 210))
d = ImageDraw.Draw(c)
d.text((W//2, 500), "一起来汉末称霸天下！", font=font(FONT_BOLD,52), fill=(245,214,145,255), anchor="mm")
d.text((W//2, 590), "挂机放置 · 武将合成 · 传奇英雄 · 全免费", font=font(FONT_HEI,30), fill=(214,196,160,255), anchor="mm")
d.line([(200,660),(W-200,660)], fill=(120,92,48,255), width=2)
c.convert("RGB").save(os.path.join(OUTDIR,"分享图_5比4_C_标题.png"), optimize=True)
print("C saved")

for n in ["分享图_5比4_A_战斗.png","分享图_5比4_B_宝箱.png","分享图_5比4_C_标题.png"]:
    p = os.path.join(OUTDIR,n); print(n, os.path.getsize(p),"bytes")
