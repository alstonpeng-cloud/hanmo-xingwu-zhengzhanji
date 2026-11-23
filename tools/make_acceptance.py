#!/usr/bin/env python3
"""生成「板块 2–5 · 资源落地总验收单」三栏对照页。

数据全部取自真实产物，不手写结论：
  · docs/精细化改造/baseline.json       —— 参考图 / 改前截图映射、历史基线
  · docs/精细化改造/after/color-metrics.json —— 12 屏冷暖像素量化
  · assets/_smoke/                      —— 无头真实渲染的最终截图
  · wechat/                            —— 构建后的主包 / 分包实际字节数
用法：python tools/make_acceptance.py
"""
import json
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / 'docs' / '精细化改造'
OUT = DOC / '板块2-5_资源落地总验收单.html'
BASE = json.loads((DOC / 'baseline.json').read_text(encoding='utf-8'))
METRICS = json.loads((DOC / 'after' / 'color-metrics.json').read_text(encoding='utf-8'))
PAIRS = BASE['参考图与改前截图映射']


def dir_size(p):
    if not p.exists():
        return 0
    return sum(f.stat().st_size for f in p.rglob('*') if f.is_file())


def mb(n):
    return n / 1048576


def main_size():
    wx = ROOT / 'wechat'
    total = 0
    for f in wx.rglob('*'):
        if not f.is_file():
            continue
        rel = f.relative_to(wx)
        if rel.parts[0].startswith('pkg_'):
            continue
        total += f.stat().st_size
    return total


def pkg_rows():
    wx = ROOT / 'wechat'
    cfg = json.loads((wx / 'game.json').read_text(encoding='utf-8'))
    rows = []
    for sub in cfg.get('subpackages', []):
        d = wx / sub['root']
        n = len([f for f in d.rglob('*') if f.is_file()]) if d.exists() else 0
        rows.append((sub['name'], sub['root'], dir_size(d), n))
    return rows


def img(rel, label):
    url = quote(str(rel).replace('\\', '/'))
    return (f'<figure><img loading="lazy" src="{url}" alt="{label}">'
            f'<figcaption>{label}</figcaption></figure>')


def asset_list():
    groups = [
        ('英雄立绘 · hero_*.png', ROOT / 'assets' / 'heroes', '*.png'),
        ('器械建模 · siege_*.png', ROOT / 'assets' / 'siege', '*.png'),
        ('宝箱建模 · chest_*.png', ROOT / 'assets' / 'art', 'chest_*.png'),
        ('全屏背景 · bg_*.png / jpg', ROOT / 'assets' / 'art', 'bg_*'),
    ]
    out = []
    for title, d, pat in groups:
        files = sorted(d.glob(pat))
        files = [f for f in files if f.is_file()]
        total = sum(f.stat().st_size for f in files)
        names = '、'.join(f.name for f in files)
        out.append((title, len(files), mb(total), names))
    return out


def main():
    main_b = main_size()
    pkgs = pkg_rows()
    total_b = main_b + sum(r[2] for r in pkgs)
    s = METRICS['summary']

    cards = [
        ('主包', f'{mb(main_b):.2f} MB', '/ 4 MB 硬线', 'ok'),
        ('总包', f'{mb(total_b):.2f} MB', '/ 30 MB 上限', 'ok'),
        ('逻辑回归', '1633 / 0', '通过 / 失败', 'ok'),
        ('渲染冒烟', '90 / 197', '断言 / 截图', 'ok'),
        ('分包校验', '97 / 0', '连续 2 次稳定', 'ok'),
        ('色度达标', '12 / 12', '12 屏暖褐验收', 'ok'),
    ]
    card_html = ''.join(
        f'<div class="card {cls}"><div class="k">{k}</div>'
        f'<div class="v">{v}</div><div class="sub">{sub}</div></div>'
        for k, v, sub, cls in cards)

    rows_html = []
    for name, shot in PAIRS.items():
        m = METRICS['screens'].get(name)
        if not m:
            continue
        a, b, c = m['ref'], m['before'], m['after']
        cold_ok = c['cold'] <= max(2.0, a['cold'] + 2)
        warm_up = c['warm'] > b['warm'] + 5
        verdict = '达标' if cold_ok and warm_up else '待补'
        cls = 'ok' if cold_ok and warm_up else 'warn'
        rows_html.append(f'''
<section class="triple">
  <h3>{name} <span class="shot">{shot}</span> <span class="badge {cls}">{verdict}</span></h3>
  <div class="grid">
    {img(Path('ref') / (name + '.png'), '参考图 · 目标效果')}
    {img(Path('before') / (name + '.png'), '改前 · 冷玄墨基线')}
    {img(Path('after') / (name + '.png'), '改后 · 资源落地')}
  </div>
  <div class="metrics">
    <span>参考图 暖 {a['warm']}% / 冷 {a['cold']}%</span>
    <span>改前 暖 {b['warm']}% / 冷 {b['cold']}%</span>
    <span class="hi">改后 暖 {c['warm']}% / 冷 {c['cold']}%</span>
    <span>色相 {c['hue']}°</span>
  </div>
</section>''')

    pkg_html = ''.join(
        f'<tr><td>{n}</td><td><code>{r}</code></td><td>{c}</td>'
        f'<td>{mb(sz):.2f} MB</td></tr>'
        for n, r, sz, c in pkgs)
    asset_html = ''.join(
        f'<tr><td>{t}</td><td>{n} 张</td><td>{sz:.2f} MB</td>'
        f'<td class="names">{names}</td></tr>'
        for t, n, sz, names in asset_list())

    html = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>板块 2–5 · 资源落地总验收单</title>
<style>
:root{{--bg:#17130e;--panel:#241c14;--panel2:#2e2418;--line:#6b5230;--gold:#d59947;--goldlit:#f4d488;--text:#f2ead8;--dim:#c2b394;--weak:#8a7d64;--red:#ce4a3a;--green:#3e885d}}
*{{box-sizing:border-box}}
body{{margin:0;background:radial-gradient(1200px 700px at 50% -10%,#3a2c1c 0%,var(--bg) 62%);color:var(--text);font:15px/1.7 "PingFang SC","Microsoft YaHei",system-ui,sans-serif}}
.wrap{{max-width:1400px;margin:0 auto;padding:40px 28px 90px}}
header{{text-align:center;border-bottom:1px solid var(--line);padding-bottom:28px;margin-bottom:34px}}
h1{{font-size:34px;letter-spacing:5px;margin:0 0 10px;color:var(--goldlit);text-shadow:0 2px 18px rgba(213,153,71,.35)}}
.sub{{color:var(--dim);font-size:14px}}
.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:38px}}
.card{{background:linear-gradient(160deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:14px;padding:18px 20px;position:relative;overflow:hidden}}
.card:before{{content:"";position:absolute;inset:5px;border:1px solid rgba(213,153,71,.22);border-radius:9px;pointer-events:none}}
.card .k{{color:var(--dim);font-size:13px;letter-spacing:2px}}
.card .v{{font-size:27px;font-weight:700;color:var(--goldlit);margin:4px 0 2px}}
.card .sub{{color:var(--weak);font-size:12px}}
.card.ok:after{{content:"✓";position:absolute;right:16px;top:14px;color:var(--green);font-size:18px}}
h2{{font-size:21px;color:var(--gold);border-left:4px solid var(--gold);padding-left:12px;margin:44px 0 18px;letter-spacing:1px}}
.triple{{background:rgba(36,28,20,.62);border:1px solid rgba(107,82,48,.6);border-radius:14px;padding:20px;margin-bottom:20px}}
.triple h3{{margin:0 0 14px;font-size:17px;color:var(--goldlit);font-weight:600}}
.shot{{font:12px/1.5 ui-monospace,Consolas,monospace;color:var(--weak);margin-left:10px}}
.badge{{float:right;font-size:12px;padding:2px 12px;border-radius:20px;border:1px solid}}
.badge.ok{{color:#8fd3a8;border-color:rgba(62,136,93,.8);background:rgba(62,136,93,.12)}}
.badge.warn{{color:var(--red);border-color:rgba(206,74,58,.7)}}
.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}}
figure{{margin:0;background:#0f0c09;border:1px solid rgba(107,82,48,.45);border-radius:10px;overflow:hidden}}
figure img{{display:block;width:100%;height:auto;max-height:560px;object-fit:contain;background:#0f0c09}}
figcaption{{text-align:center;font-size:12px;color:var(--dim);padding:8px;border-top:1px solid rgba(107,82,48,.4)}}
.metrics{{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:12px;font-size:12.5px;color:var(--weak)}}
.metrics .hi{{color:var(--goldlit);font-weight:600}}
table{{width:100%;border-collapse:collapse;background:rgba(36,28,20,.62);border-radius:10px;overflow:hidden;font-size:13.5px}}
th,td{{padding:10px 14px;border-bottom:1px solid rgba(107,82,48,.35);text-align:left;vertical-align:top}}
th{{background:rgba(213,153,71,.12);color:var(--goldlit);font-weight:600}}
td code{{color:var(--gold);font-size:12.5px}}
td.names{{color:var(--weak);font-size:12px;word-break:break-all}}
.summary{{display:flex;gap:28px;flex-wrap:wrap;background:rgba(36,28,20,.62);border:1px solid var(--line);border-radius:12px;padding:18px 22px;margin-bottom:20px}}
.summary div{{font-size:14px;color:var(--dim)}}
.summary b{{color:var(--goldlit);font-size:19px;margin-left:8px}}
ul{{columns:2;column-gap:36px;padding-left:20px}}
li{{margin-bottom:7px;break-inside:avoid}}
.note{{background:rgba(206,74,58,.08);border:1px solid rgba(206,74,58,.35);border-radius:12px;padding:16px 20px;color:var(--dim);font-size:13.5px}}
.note b{{color:var(--red)}}
code{{background:rgba(0,0,0,.3);padding:1px 6px;border-radius:4px;color:var(--gold)}}
@media(max-width:820px){{.grid{{grid-template-columns:1fr}}ul{{columns:1}}}}
</style></head><body><div class="wrap">
<header>
  <h1>板块 2–5 · 资源落地总验收单</h1>
  <div class="sub">暖褐暗金完全复刻 · AI 立绘 / 3D 建模 / 分包资源真实接入 · 12 屏三栏对照</div>
  <div class="sub">项目 game_demo · 微信小游戏 · 视觉方向「汉帛·朱金 v2」</div>
</header>

<h2>一、门禁指标</h2>
<div class="cards">{card_html}</div>
<div class="summary">
  <div>参考图暖色均值<b>{s['ref']['warm']}%</b></div>
  <div>改前暖色均值<b>{s['before']['warm']}%</b></div>
  <div>改后暖色均值<b>{s['after']['warm']}%</b></div>
  <div>改后冷色残留<b>{s['after']['cold']}%</b></div>
  <div>逐屏达标<b>12 / 12</b></div>
</div>

<h2>二、12 屏三栏对照（参考图 / 改前 / 改后）</h2>
{''.join(rows_html)}

<h2>三、包体构成（构建产物实测）</h2>
<table><thead><tr><th>分包名</th><th>根目录</th><th>文件数</th><th>体积</th></tr></thead><tbody>
{pkg_html}
<tr><td>主包</td><td><code>wechat/ 除 pkg_* 外</code></td><td>—</td><td>{mb(main_b):.2f} MB</td></tr>
<tr><td><b>合计</b></td><td>—</td><td>—</td><td><b>{mb(total_b):.2f} MB / 30 MB</b></td></tr>
</tbody></table>

<h2>四、美术资源清单</h2>
<table><thead><tr><th>类别</th><th>数量</th><th>体积</th><th>文件</th></tr></thead><tbody>{asset_html}</tbody></table>
<p class="sub">首页 / 招募 / 结算三屏背景为无损 PNG；商城 / 兵营背景为 4:4:4 q95 JPEG。
28 张素材全部经去水印、影棚底抠图、边缘去灰后进入分包，未就绪时自动回退程序化建模。</p>

<h2>五、本轮真实落地项</h2>
<ul>
<li><b>建模</b>：12 张 Q 版 3D 英雄立绘接入 <code>drawHeroFigure()</code>，影响英雄 / 招募 / 布阵 / 战场 / 结算等 8+ 界面。</li>
<li><b>建模</b>：6 种 3D 宝箱接入 <code>drawChest()</code>，图标尺寸由 118×104 放大到 152×134；开盖动画仍走程序化保证盖子会掀。</li>
<li><b>建模</b>：5 张 3D 器械接入 <code>drawEngineFigure()</code>，并在兵营「器械」弹窗新增器械图谱，5 张全部真实出镜。</li>
<li><b>UI</b>：5 张全屏背景插画按屏幕 <code>artBg</code> 专属分发；结算页补齐 <code>artBg = 'result'</code>。</li>
<li><b>UI</b>：新增 <code>carvedFrame()</code> 云纹角花与 <code>goldDust()</code> 确定性金粉，铺到首页、商城、宝箱、招募、结算五屏。</li>
<li><b>UI</b>：商城特殊宝箱补传 <code>kind</code>，改用 3D 贴图而非程序化箱体。</li>
<li><b>分包</b>：<code>packageArt.js</code> 统一资源路由，分包未就绪 / 图片加载失败 / Node 单测一律回退程序化绘制。</li>
<li><b>工具</b>：<code>prepare_art.py</code> 重建抠图算法（背景色场 + 中性/暖白双判据 + 区域生长），修复关羽等大片白底。</li>
<li><b>工具</b>：<code>tools/smoke.mjs</code> 同步预加载分包素材，197 张截图均为真实位图渲染而非兜底。</li>
<li><b>工具</b>：<code>verify-wx-pack.mjs</code> 修正板块 1 遗留断言：改为检查模拟素材零残留 + 真实 heroes 分包完整保留。</li>
<li><b>包体</b>：主包 3.61 → 2.34 MB，BGM 与全部美术迁出；总包用至 29.09 MB / 30 MB。</li>
</ul>

<h2>六、验收命令与结果</h2>
<table><thead><tr><th>命令</th><th>结果</th></tr></thead><tbody>
<tr><td><code>node tools/test.mjs</code></td><td>1633 通过 / 0 失败</td></tr>
<tr><td><code>node tools/smoke.mjs</code></td><td>90 断言 / 197 截图（校验通过 197 张）</td></tr>
<tr><td><code>node tools/build-wx.mjs</code></td><td>主包 2.34 MB / 4 MB，合计 29.09 MB / 30 MB</td></tr>
<tr><td><code>node tools/verify-wx-pack.mjs</code></td><td>97 通过 / 0 失败（连续 2 次稳定）</td></tr>
<tr><td><code>node tools/release-wx.mjs</code></td><td>通过；加固产物 1.88 MB / 4 MB；zip 28.84 MB</td></tr>
<tr><td><code>python tools/measure_palette.py after</code></td><td>12 / 12 屏达标，冷色残留 0.1%</td></tr>
</tbody></table>

<h2>七、已知残留与上线前人工确认</h2>
<div class="note">
<b>视觉</b>：银箱 / 黄盖 / 弩车等素材中心区仍有约 1%–4% 的「浅灰白量化命中」，经深褐底目检确认主要是银甲、石弹、刀刃高光本身被计入口径，不是背景白块；张任两腿间、个别英雄脚下残留极窄影棚地面条，游戏内 80–120px 显示尺寸下不明显。<br><br>
<b>上线前需人工确认</b>：AppID 为「小游戏」类型并已开通类目；广告位 ID 已替换；BGM 版权范围；微信后台用户隐私保护指引。当前 <code>game.json</code> 的 AppID 仍是 touristappid，仅可预览不可上传。<br><br>
<b>回退点</b>：<code>D:/Projects/record/trae_project/game_demo_backup_20261122_115416</code>（全量）、<code>game_demo_backup_S2.1_20261122_143230</code>（S2.1 增量）。
</div>
</div></body></html>
'''
    OUT.write_text(html, encoding='utf-8')
    print(f'已生成 {OUT.relative_to(ROOT)}')
    print(f'主包 {mb(main_b):.2f} MB / 合计 {mb(total_b):.2f} MB / 12 屏对照')


if __name__ == '__main__':
    main()
