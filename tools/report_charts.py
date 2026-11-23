# -*- coding: utf-8 -*-
"""纯 SVG 图表工具：无第三方依赖，输出可缩放矢量图，嵌入 HTML 报告。
配色贴合游戏「暖褐暗金」主题，同时保证深色背景上的可读性。"""
import math
from html import escape

C = {
    "bg": "#1a1610", "grid": "#3a3022", "axis": "#8a6a3a",
    "text": "#e8d9b8", "muted": "#a08b63",
    "gold": "#d59947", "goldLit": "#f4d488", "red": "#ce4a3a",
    "green": "#5ba877", "blue": "#6a9fc4", "purple": "#a878b8",
    "cyan": "#5fb3a8", "orange": "#e08a4a",
}
PALETTE = [C["gold"], C["red"], C["blue"], C["green"], C["purple"], C["cyan"], C["orange"]]


def _fmt(v):
    if abs(v) >= 1e8: return f"{v/1e8:.1f}亿"
    if abs(v) >= 1e4: return f"{v/1e4:.1f}万"
    if abs(v) >= 1000: return f"{v:,.0f}"
    if isinstance(v, int): return str(v)
    return f"{v:.2f}".rstrip("0").rstrip(".")


def _nice_ticks(lo, hi, n=5):
    if hi == lo: hi = lo + 1
    span = hi - lo
    raw = span / n
    mag = 10 ** math.floor(math.log10(raw)) if raw > 0 else 1
    for m in (1, 2, 2.5, 5, 10):
        if raw <= mag * m:
            step = mag * m; break
    else:
        step = mag * 10
    start = math.floor(lo / step) * step
    ticks = []
    v = start
    while v <= hi + step * 0.5:
        ticks.append(v); v += step
    return ticks, lo, hi


class Chart:
    def __init__(self, w=720, h=340, title="", xlabel="", ylabel="", logy=False):
        self.w, self.h = w, h
        self.title, self.xlabel, self.ylabel = title, xlabel, ylabel
        self.logy = logy
        self.series = []
        self.ml, self.mr, self.mt, self.mb = 78, 24, (46 if title else 20), 50

    def add(self, name, xs, ys, color=None, width=2, fill=False, dash=None):
        self.series.append({"name": name, "xs": xs, "ys": ys,
                            "color": color or PALETTE[len(self.series) % len(PALETTE)],
                            "width": width, "fill": fill, "dash": dash})

    def render(self):
        W, H = self.w, self.h
        x0, y0 = self.ml, self.mt
        pw, ph = W - self.ml - self.mr, H - self.mt - self.mb
        allx = [x for s in self.series for x in s["xs"]]
        ally = [y for s in self.series for y in s["ys"]]
        if not allx or not ally:
            return f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg"><text x="20" y="30" fill="{C["muted"]}">无数据</text></svg>'
        xlo, xhi = min(allx), max(allx)
        if self.logy:
            pos = [y for y in ally if y > 0] or [1]
            ylo, yhi = math.log10(min(pos)), math.log10(max(pos))
            def ty(v): return y0 + ph - (math.log10(max(v, 1e-9)) - ylo) / (yhi - ylo or 1) * ph
            yticks = [10 ** (ylo + i * (yhi - ylo) / 5) for i in range(6)]
        else:
            ylo, yhi = 0, max(ally) * 1.08
            yticks, ylo, yhi = _nice_ticks(0, max(ally), 5)
            yhi = yticks[-1]
            def ty(v): return y0 + ph - (v - ylo) / (yhi - ylo or 1) * ph
        def tx(v): return x0 + (v - xlo) / (xhi - xlo or 1) * pw

        p = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:system-ui,-apple-system,sans-serif">']
        p.append(f'<rect width="{W}" height="{H}" fill="{C["bg"]}" rx="10"/>')
        if self.title:
            p.append(f'<text x="{x0}" y="26" fill="{C["goldLit"]}" font-size="15" font-weight="600">{escape(self.title)}</text>')
        # 网格 + Y 轴标签
        for t in yticks:
            y = ty(t)
            p.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x0+pw}" y2="{y:.1f}" stroke="{C["grid"]}" stroke-width="1"/>')
            p.append(f'<text x="{x0-8}" y="{y+4:.1f}" fill="{C["muted"]}" font-size="11" text-anchor="end">{_fmt(t)}</text>')
        # X 轴刻度
        xticks = []
        if len(allx) > 1:
            for i in range(6):
                xticks.append(xlo + (xhi - xlo) * i / 5)
        else: xticks = allx[:1]
        for t in xticks:
            x = tx(t)
            p.append(f'<text x="{x:.1f}" y="{y0+ph+18}" fill="{C["muted"]}" font-size="11" text-anchor="middle">{_fmt(t)}</text>')
        # 坐标轴
        p.append(f'<line x1="{x0}" y1="{y0}" x2="{x0}" y2="{y0+ph}" stroke="{C["axis"]}" stroke-width="1.3"/>')
        p.append(f'<line x1="{x0}" y1="{y0+ph}" x2="{x0+pw}" y2="{y0+ph}" stroke="{C["axis"]}" stroke-width="1.3"/>')
        if self.xlabel:
            p.append(f'<text x="{x0+pw/2}" y="{H-8}" fill="{C["muted"]}" font-size="11" text-anchor="middle">{escape(self.xlabel)}</text>')
        if self.ylabel:
            p.append(f'<text x="14" y="{y0+ph/2}" fill="{C["muted"]}" font-size="11" text-anchor="middle" transform="rotate(-90 14 {y0+ph/2})">{escape(self.ylabel)}</text>')
        # 曲线
        for s in self.series:
            pts = [(tx(x), ty(y)) for x, y in zip(s["xs"], s["ys"])]
            if not pts: continue
            d = "M " + " L ".join(f"{px:.1f},{py:.1f}" for px, py in pts)
            if s["fill"]:
                area = d + f' L {pts[-1][0]:.1f},{y0+ph} L {pts[0][0]:.1f},{y0+ph} Z'
                p.append(f'<path d="{area}" fill="{s["color"]}" opacity="0.12"/>')
            dash = f' stroke-dasharray="{s["dash"]}"' if s["dash"] else ""
            p.append(f'<path d="{d}" fill="none" stroke="{s["color"]}" stroke-width="{s["width"]}" stroke-linejoin="round"{dash}/>')
        # 图例
        if len(self.series) > 1:
            lx, ly = x0 + 12, y0 + 14
            for s in self.series:
                p.append(f'<rect x="{lx}" y="{ly-4}" width="12" height="3" fill="{s["color"]}" rx="1.5"/>')
                p.append(f'<text x="{lx+17}" y="{ly}" fill="{C["text"]}" font-size="11">{escape(s["name"])}</text>')
                ly += 17
        p.append('</svg>')
        return "".join(p)


def bar_chart(items, title="", ylabel="", w=720, h=340, color=None, horizontal=False):
    """items: [(label, value), ...]"""
    W, H = w, h
    ml, mr, mt, mb = (120, 30, 40, 30) if horizontal else (70, 24, 40, 70)
    x0, y0 = ml, mt
    pw, ph = W - ml - mr, H - mt - mb
    mx = max((v for _, v in items), default=1) * 1.1 or 1
    p = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:system-ui,-apple-system,sans-serif">']
    p.append(f'<rect width="{W}" height="{H}" fill="{C["bg"]}" rx="10"/>')
    if title:
        p.append(f'<text x="{ml}" y="26" fill="{C["goldLit"]}" font-size="15" font-weight="600">{escape(title)}</text>')
    n = len(items)
    if horizontal:
        bh = ph / max(n, 1) * 0.68
        gap = ph / max(n, 1)
        for i, (lab, val) in enumerate(items):
            y = y0 + i * gap + (gap - bh) / 2
            bw = (val / mx) * pw
            col = color or PALETTE[i % len(PALETTE)]
            p.append(f'<rect x="{x0}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="{col}" rx="3" opacity="0.85"/>')
            p.append(f'<text x="{x0-8}" y="{y+bh/2+4:.1f}" fill="{C["text"]}" font-size="11" text-anchor="end">{escape(str(lab))}</text>')
            p.append(f'<text x="{x0+bw+6:.1f}" y="{y+bh/2+4:.1f}" fill="{C["muted"]}" font-size="11">{_fmt(val)}</text>')
    else:
        bw = pw / max(n, 1) * 0.7
        gap = pw / max(n, 1)
        for i, (lab, val) in enumerate(items):
            x = x0 + i * gap + (gap - bw) / 2
            bh = (val / mx) * ph
            col = color or PALETTE[i % len(PALETTE)]
            p.append(f'<rect x="{x:.1f}" y="{y0+ph-bh:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="{col}" rx="3" opacity="0.85"/>')
            p.append(f'<text x="{x+bw/2:.1f}" y="{y0+ph-bh-5:.1f}" fill="{C["muted"]}" font-size="10" text-anchor="middle">{_fmt(val)}</text>')
            p.append(f'<text x="{x+bw/2:.1f}" y="{y0+ph+16}" fill="{C["text"]}" font-size="10" text-anchor="middle">{escape(str(lab))}</text>')
    p.append('</svg>')
    return "".join(p)


def gauge(value, maximum, label, color=None, w=300, h=120):
    """横向进度条卡片"""
    pct = min(100, max(0, value / maximum * 100)) if maximum else 0
    col = color or C["gold"]
    return (f'<div class="gauge"><div class="gauge-head"><span>{escape(label)}</span>'
            f'<b>{_fmt(value)} / {_fmt(maximum)}</b></div>'
            f'<div class="gauge-track"><div class="gauge-fill" style="width:{pct:.1f}%;background:{col}"></div></div>'
            f'<div class="gauge-pct">{pct:.0f}%</div></div>')
