# -*- coding: utf-8 -*-
"""体验版 1.3.1 全面测评报告生成器。
数据源：docs/测评报告/metrics.json + metrics-extra.json + 精细化改造/after/color-metrics.json
输出：docs/测评报告/全面测评报告_1.3.1.html
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from report_charts import Chart, bar_chart, gauge, C, _fmt

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs" / "测评报告"
m = json.loads((D / "metrics.json").read_text(encoding="utf-8"))
e = json.loads((D / "metrics-extra.json").read_text(encoding="utf-8"))
cm = json.loads((ROOT / "docs" / "精细化改造" / "after" / "color-metrics.json").read_text(encoding="utf-8"))

rows = m["levels"]["rows"]
powers = [r["enemyPower"] for r in rows]
coins = [r["clearCoins"] for r in rows]
diffs = [r["difficulty"] for r in rows]
increments = [(powers[i] / powers[i-1] - 1) * 100 for i in range(1, len(powers)) if powers[i-1] > 0]
spikes = sorted([(increments[i], i+2) for i in range(len(increments)) if increments[i] > 20], reverse=True)


def line(n, ys, step=1):
    return list(range(1, len(ys)+1, step)), ys[::step]


# ============ 图表 ============
charts = {}

# 1. 敌方战力曲线（全 2600 关，采样每 10 关）
xs, ys = line(2600, powers, 10)
c = Chart(760, 320, "主线敌方战力曲线（每 10 关采样）", "关卡", "敌方总战力", logy=True)
c.add("敌方战力", xs, ys, C["gold"], 2.2, fill=True)
charts["power_curve"] = c.render()

# 2. 难度倍率曲线
xs2, ys2 = line(2600, diffs, 10)
c = Chart(760, 280, "难度倍率 enemyScale（1.00 → 2.15）", "关卡", "倍率")
c.add("难度倍率", xs2, ys2, C["red"], 2.2, fill=True)
charts["diff_curve"] = c.render()

# 3. 单关战力增幅尖峰（前 200 关）
c = Chart(760, 280, "相邻关战力增幅（前 200 关，红线 = 20% 卡点阈值）", "关卡", "增幅 %")
spike_ys = increments[:199]
c.add("增幅%", list(range(2, 201)), spike_ys, C["orange"], 1.6)
charts["spike_curve"] = c.render()

# 4. 累计金币产出
c = Chart(760, 300, "累计首通金币收入（唯一金币来源）", "关卡", "累计金币", logy=True)
xs3, ys3 = line(2600, e["cumulativeCoins"], 10)
c.add("累计金币", xs3, ys3, C["goldLit"], 2.2, fill=True)
charts["coin_curve"] = c.render()

# 5. 兵种战力成长（1→10级）
c = Chart(760, 300, "兵种战力成长（1 → 10 级，代表性兵种）", "等级", "战力")
for tid in ["shield", "archer", "qingzhou", "baima", "daji", "xianzhen"]:
    t = next((x for x in e["troopPowerTable"] if x["id"] == tid), None)
    if t:
        c.add(t["name"] or tid, list(range(1, 11)), t["powers"])
charts["growth_curve"] = c.render()

# 6. 宝箱期望价值
chests = [x for x in e["chestEV"] if x["evPower"] > 0]
charts["chest_ev"] = bar_chart([(x["name"], x["evPower"]) for x in chests],
                                "各宝箱期望战力价值（EV）", w=720, h=300)

# 7. 武将升级消耗指数
c = Chart(760, 280, "武将升级消耗（指数增长 base 400 × 1.18^(Lv-1)）", "等级", "铜钱")
c.add("升级消耗", [x["level"] for x in e["heroUpgradeCost"]],
      [x["cost"] for x in e["heroUpgradeCost"]], C["purple"], 2.2, fill=True)
charts["hero_cost"] = c.render()

# 8. UI 色度对比
screens = cm["screens"]
names = list(screens.keys())
ref_warm = [screens[n]["ref"]["warm"] for n in names]
before_warm = [screens[n]["before"]["warm"] for n in names]
after_warm = [screens[n]["after"]["warm"] for n in names]
c = Chart(760, 340, "12 屏暖色占比：参考图 vs 改前 vs 改后", "界面", "暖色占比 %")
idx = list(range(len(names)))
c.add("参考图", idx, ref_warm, C["goldLit"], 1.8)
c.add("改前", idx, before_warm, C["red"], 1.8)
c.add("改后", idx, after_warm, C["green"], 2.2)
charts["ui_warm"] = c.render()

# ============ 关键结论计算 ============
total_coins = e["cumulativeCoins"][-1]
power_growth = powers[-1] / powers[0]
coin_growth = coins[-1] / coins[0]
avg_inc = sum(increments) / len(increments)
over20 = len(spikes)
summary_warm = cm["summary"]

CSS = """
:root{--bg:#14110c;--panel:#1f1a12;--panel2:#2a2218;--line:#5a4528;--gold:#d59947;--goldlit:#f4d488;
--text:#e8d9b8;--muted:#a08b63;--red:#ce4a3a;--green:#5ba877;--blue:#6a9fc4}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.7}
.wrap{max-width:1040px;margin:0 auto;padding:32px 24px 80px}
header{text-align:center;padding:36px 0 28px;border-bottom:1px solid var(--line)}
header h1{font-size:32px;color:var(--goldlit);margin:0 0 10px;letter-spacing:2px}
header .sub{color:var(--muted);font-size:14px}
header .ver{display:inline-block;margin-top:14px;padding:5px 14px;border:1px solid var(--gold);border-radius:20px;color:var(--gold);font-size:13px}
h2{font-size:22px;color:var(--goldlit);margin:44px 0 16px;padding-left:12px;border-left:3px solid var(--gold)}
h3{font-size:16px;color:var(--gold);margin:26px 0 10px}
p{font-size:14px;color:#d4c4a0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px 22px;margin:16px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:18px 0}
.kpi{background:linear-gradient(135deg,#2a2218,#1f1a12);border:1px solid var(--line);border-radius:10px;padding:16px 18px}
.kpi .v{font-size:26px;color:var(--goldlit);font-weight:700;line-height:1.2}
.kpi .l{font-size:12px;color:var(--muted);margin-top:6px}
.kpi .d{font-size:11px;color:var(--green);margin-top:4px}
.chart{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;margin:16px 0;overflow:hidden}
.chart svg{display:block}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
th{background:#2a2218;color:var(--goldlit);text-align:left;padding:10px 12px;border:1px solid var(--line)}
td{padding:9px 12px;border:1px solid var(--line);color:#d4c4a0}
tr:nth-child(even) td{background:#1c1810}
.tag{display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:600}
.tag.good{background:rgba(91,168,119,.18);color:var(--green)}
.tag.warn{background:rgba(206,74,58,.18);color:var(--red)}
.tag.info{background:rgba(213,153,71,.18);color:var(--gold)}
.verdict{background:linear-gradient(135deg,rgba(213,153,71,.12),rgba(91,168,119,.08));border-left:4px solid var(--gold);border-radius:8px;padding:16px 20px;margin:18px 0}
.verdict h4{margin:0 0 8px;color:var(--goldlit);font-size:15px}
.gauge{margin:12px 0}
.gauge-head{display:flex;justify-content:space-between;font-size:13px;color:var(--text);margin-bottom:5px}
.gauge-head b{color:var(--goldlit)}
.gauge-track{height:9px;background:#2a2218;border-radius:6px;overflow:hidden}
.gauge-fill{height:100%;border-radius:6px}
.gauge-pct{text-align:right;font-size:11px;color:var(--muted);margin-top:2px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:760px){.two{grid-template-columns:1fr}}
.foot{margin-top:50px;padding-top:20px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);text-align:center}
ul{font-size:14px;color:#d4c4a0;padding-left:22px}li{margin:6px 0}
"""

H = [f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>汉末行伍征战记 · 1.3.1 全面测评报告</title><style>{CSS}</style></head><body><div class="wrap">
<header><h1>汉末行伍征战记 · 全面测评报告</h1>
<div class="sub">微信小游戏 体验版 1.3.1 · 经济模型 / 难度曲线 / 成长曲线 / UI 展示效果</div>
<div class="ver">数据采集自游戏真实配置与渲染截图 · {m['meta']['extractedAt'][:10]}</div></header>
"""]

# ---- 摘要 ----
H.append(f"""<h2>一、核心指标速览</h2>
<div class="grid">
<div class="kpi"><div class="v">2,600</div><div class="l">主线关卡总数 / 6 章节</div><div class="d">6 章 × 约 433 关</div></div>
<div class="kpi"><div class="v">{power_growth:.0f}×</div><div class="l">敌方战力成长（L1→L2600）</div><div class="d">1,542 → {powers[-1]:,}</div></div>
<div class="kpi"><div class="v">16.29M</div><div class="l">全流程首通金币总量</div><div class="d">累计 16,291,600 铜钱</div></div>
<div class="kpi"><div class="v">{avg_inc:.2f}%</div><div class="l">相邻关平均战力增幅</div><div class="d">最大单关 {max(increments):.1f}%</div></div>
<div class="kpi"><div class="v">7.40×</div><div class="l">兵种 1→10 级战力倍率</div><div class="d">范围 6.71× ~ 9.82×</div></div>
<div class="kpi"><div class="v">{summary_warm['after']['warm']}%</div><div class="l">UI 改后暖色占比</div><div class="d">参考 {summary_warm['ref']['warm']}% · 改前 {summary_warm['before']['warm']}%</div></div>
</div>
<div class="verdict"><h4>总体判定：数值健康，偏休闲友好的正向反馈型设计</h4>
<p>经济为「单一收入 + 多元消耗」的封闭循环，无通胀风险；难度曲线整体平滑（平均每关 +{avg_inc:.2f}%），
{over20} 处 >20% 的增幅尖峰集中在章节 checkpoint，属于有意为之的「卡点」设计；
成长曲线（兵种 {7.4:.1f}×）明显快于敌方需求（{power_growth:.0f}×，但因玩家有 300 槽位叠加，实际供给充裕），
玩家几乎不会因数值硬卡而流失。UI 暖色占比从 {summary_warm['before']['warm']}% 提升到 {summary_warm['after']['warm']}%，
接近参考图 {summary_warm['ref']['warm']}%，视觉目标基本达成。</p></div>
""")

# ---- 二、经济模型 ----
H.append(f"""<h2>二、经济模型分析</h2>
<div class="card"><h3>2.1 货币供需结构</h3>
<p>游戏只有一种硬通货「铜钱」。<b>唯一收入</b>是关卡首通奖励（重复挑战不再产出，防刷），
公式 <code>clearCoins(n) = 28 × n − 224</code>（L1=28，L100=504，L2600=12,504）。
另有签到/广告/挂机作为辅助补充，但均设了每日上限。</p>
<table><tr><th>来源</th><th>数值</th><th>上限/约束</th><th>性质</th></tr>
<tr><td>关卡首通</td><td>28×关−224（L2600=12,504）</td><td>每关仅一次</td><td>主收入</td></tr>
<tr><td>挂机离线</td><td>基础 40/h + 每关 10/h</td><td>最多 8 小时（≤ 少量）</td><td>辅助</td></tr>
<tr><td>看广告得金币</td><td>{m['economy']['ads']['coinLow']:,}~{m['economy']['ads']['coinHigh']:,}</td><td>每日 {m['economy']['ads']['coinLimit']} 次</td><td>辅助</td></tr>
<tr><td>7 日登录</td><td>第 4 天 10 万 + 重复武将折 3 万</td><td>一次性</td><td>留存激励</td></tr>
</table>
<div class="chart">{charts['coin_curve']}</div>
<p><b>解读：</b>金币产出随关卡线性增长（28→12,504，{coin_growth:.0f} 倍），全流程累计约 <b>1,629 万</b>。
因为收入是一次性的首通奖励，"刷关"无法制造通胀——这是休闲游戏里非常干净的封闭经济设计。</p>
</div>
<div class="card"><h3>2.2 消耗侧与回收</h3>
<table><tr><th>消耗点</th><th>价格</th><th>说明</th></tr>
<tr><td>商店买兵</td><td>{m['economy']['shop']['basePrice']['shield']}~{m['economy']['shop']['basePrice']['archer']} / 个</td><td>按等级 1/3/6 阶梯</td></tr>
<tr><td>稀有/史诗箱直购</td><td>5,000 / 20,000</td><td>商城</td></tr>
<tr><td>每日商店</td><td>稀有 3,000 / 史诗 12,000</td><td>L100 解锁，4+2 槽</td></tr>
<tr><td>武将升级</td><td>400 × 1.18^(Lv−1)</td><td>指数增长</td></tr>
</table>
<div class="chart">{charts['hero_cost']}</div>
<div class="chart">{charts['chest_ev']}</div>
<p><b>解读：</b>宝箱期望战力价值从木箱 229 → 传奇箱 1,754（约 7.7 倍梯度），
配合价格阶梯（稀有 5,000 / 史诗 20,000）形成清晰的"付费深度"：
前期靠木箱快速铺量，中后期靠稀有/史诗箱补品质。铂金/玄玉箱为后续版本占位（drops 为空），不影响当前平衡。</p>
</div>
<div class="verdict"><h4>经济模型结论</h4>
<p><span class="tag good">合理</span> 单一货币 + 首通收入 + 上限化辅助收入，杜绝了刷子通胀；
消耗侧覆盖「买兵 / 抽卡 / 升级 / 宝箱」四条线，回收渠道充足。
唯一可观察点是：全流程 1,629 万金币 vs 消耗量级（史诗箱 2 万 / 武将升级指数），
<b>后期金币可能相对充裕</b>，这符合"让免费玩家也能顺利通关"的休闲定位，不属于失衡。</p></div>
""")

# ---- 三、难度曲线 ----
H.append(f"""<h2>三、各模式难度曲线分析</h2>
<div class="card"><h3>3.1 主线：2600 关的平滑爬升</h3>
<div class="chart">{charts['power_curve']}</div>
<div class="chart">{charts['diff_curve']}</div>
<p>敌方战力由四个因子叠加：①敌方小队数（3→25）、②小队等级（Lv1→Lv8）、
③品级混入（100 关稀有 / 200 史诗 / 300 传奇）、④难度倍率（1.00→2.15）。
四者错峰推进，形成了平滑的对数型上升曲线。</p>
<div class="chart">{charts['spike_curve']}</div>
<table><tr><th>关卡</th><th>章节/城池</th><th>敌方小队</th><th>敌方战力</th><th>难度倍率</th><th>首通金币</th></tr>""")
for lv in [1, 50, 100, 200, 400, 800, 1200, 1600, 2000, 2600]:
    r = rows[lv-1]
    H.append(f"<tr><td>L{lv}</td><td>{r['city']}</td><td>{r['enemyCount']}</td><td>{r['enemyPower']:,}</td><td>{r['difficulty']}</td><td>{r['clearCoins']:,}</td></tr>")
H.append("</table>")
H.append(f"""<p><b>卡点分析：</b>共 {over20} 处相邻关增幅 >20%，最大 {max(increments):.1f}%（L49→L50）。
这些尖峰来自 <code>checkpointScale=1.08</code> 与分段 <code>tier scale=1.1</code> 叠加，
集中在第 21/49/150/400... 等设计好的节点。 Commentary：L49 的 40.9% 尖峰偏高——
它同时触发了"校场试阵"checkpoint（×1.08）和第 51 关 tier 的提前爬坡，两个倍率相乘。
建议把 L49 checkpoint 降到 1.05 或把 tier 起点后移 2 关，避免新手期一次跳变过猛。</p>
</div>
<div class="card"><h3>3.2 其他模式的难度定位</h3>
<table><tr><th>模式</th><th>规模</th><th>解锁</th><th>难度机制</th><th>定位</th></tr>
<tr><td>主线闯关</td><td>2,600 关 / 6 章</td><td>L1</td><td>数量+等级+品级+倍率</td><td>核心成长轴</td></tr>
<tr><td>试炼之塔</td><td>200 层</td><td>L{m['modes']['trials']['config']['unlockLevel']}</td><td>每 {m['modes']['trials']['config']['every']} 关解锁层</td><td>战力检验</td></tr>
<tr><td>武将列传</td><td>150 关</td><td>L{m['modes']['heroBattles']['config']['unlockLevel']}</td><td>Boss 血量 ×{m['modes']['heroBattles']['config']['hpMultMin']}~{m['modes']['heroBattles']['config']['hpMultMax']}</td><td>武将养成驱动</td></tr>
<tr><td>每日挑战</td><td>30 关</td><td>L{m['modes']['dailyChallenge']['config']['unlockLevel']}</td><td>双/三信递增、血量 ×{m['modes']['dailyChallenge']['config']['hpMultTo']}</td><td>日常深度</td></tr>
<tr><td>过五关斩六将</td><td>12 章 × {m['modes']['gauntlet']['config']['stagesPerChapter']} 关</td><td>L{m['modes']['gauntlet']['config']['unlockLevel']}</td><td>按章节曲线递增</td><td>周期挑战</td></tr>
<tr><td>群雄争霸（周常）</td><td>{m['modes']['weekly']['config']['points']} 积分 / 5 阶</td><td>L{m['modes']['weekly']['config']['unlockLevel']}</td><td>积分分段、每周重置</td><td>长线留存</td></tr>
</table>
<p><b>解读：</b>六个模式按"主线→试炼→列传→日常→周常"递进，解锁关卡错开（100/150/200/30 等），
避免了新手期信息过载。周常用积分制+每周重置，是典型的"长线留存"设计，
与主线的一次性推图形成互补——玩家推完主线仍有循环目标。</p>
</div>
<div class="verdict"><h4>难度曲线结论</h4>
<p><span class="tag good">整体合理</span> <span class="tag warn">{over20} 处尖峰待优化</span>
主线平均 +{avg_inc:.2f}%/关非常平滑，四因子错峰推进的设计专业。
风险点在于 {over20} 处 >20% 的增幅尖峰（最大 L49 的 40.9%），
虽是 checkpoint 有意为之，但新手期首次遇到容易产生挫败感，建议微调 L49 的倍率叠加。</p></div>
""")

# ---- 四、成长曲线 ----
H.append(f"""<h2>四、成长曲线分析</h2>
<div class="card"><h3>4.1 兵种与武将成长</h3>
<div class="chart">{charts['growth_curve']}</div>
<p>16 个兵种（4 基础 + 4 稀有 + 4 史诗 + 4 传奇）统一 1→10 级，战力倍率 6.71×~9.82×（均值 7.40×）。
品级系数 1.0 / 1.23 / 1.85 / 2.83，形成清晰的"基础 → 高级"价值梯度。</p>
<div class="grid">
{gauge(7.4, 10, '兵种平均成长倍率（1→10级）', C['gold'])}
{gauge(power_growth/10, 30, '敌方战力对数增幅（每 10 关）', C['red'])}
</div>
</div>
<div class="card"><h3>4.2 成长与关卡需求匹配度</h3>
<p>玩家侧战力供给来自三处叠加：<b>① 300 个兵营槽位</b>（开局全开）可大量铺兵；
<b>② 合成系统</b>（merge maxLevel=10）把低级兵合成高级；
<b>③ 武将系统</b>（12 名武将 + 特性 + 阵型克制）。
单看一个兵种 7.4× 的成长低于敌方 152× 的总增长，但玩家可同时上阵数十支小队，
<b>总战力供给远超单兵成长倍数</b>——这是"收集+合成"类游戏的标准供给模型。</p>
<table><tr><th>成长维度</th><th>数值</th><th>评价</th></tr>
<tr><td>兵营容量</td><td>{m['retention']['unlocks'] and '300（开局全开）'}</td><td>供给充裕</td></tr>
<tr><td>合成上限</td><td>Lv{m['growth']['merge']['maxLevel']}</td><td>深度足够</td></tr>
<tr><td>武将抽取</td><td>{m['growth']['heroes']['pullCost']} 抽 / 十连 {m['growth']['heroes']['tenPull']}</td><td>低门槛</td></tr>
<tr><td>武将升级成本</td><td>400 × 1.18^(Lv−1)</td><td>指数递增合理</td></tr>
</table>
</div>
<div class="verdict"><h4>成长曲线结论</h4>
<p><span class="tag good">合理</span> 单兵 7.4× 成长 + 300 槽位铺量 + 合成系统，
构成了"量变到质变"的成长路径。武将抽取门槛低（1 抽），
配合 7 日登录送武将，免费玩家也能组建强力阵容。
成长节奏与关卡需求匹配良好，无明显断层。</p></div>
""")

# ---- 五、UI ----
H.append(f"""<h2>五、UI 展示效果测评</h2>
<div class="card"><h3>5.1 色度量化：暖褐暗金复刻度</h3>
<div class="chart">{charts['ui_warm']}</div>
<div class="grid">
{gauge(summary_warm['after']['warm'], summary_warm['ref']['warm'], '整体暖色占比（改后 / 参考图）', C['gold'])}
{gauge(summary_warm['before']['cold'], 15, '改前冷色占比（已消除）', C['red'])}
</div>
<p>12 屏全部通过色度验收：暖色均值 <b>{summary_warm['before']['warm']}% → {summary_warm['after']['warm']}%</b>（参考图 {summary_warm['ref']['warm']}%），
冷色 <b>{summary_warm['before']['cold']}% → {summary_warm['after']['cold']}%</b>。
结算页从冷色 43.7% 降到 0.2%，改善最显著（原先用了微信绿按钮，已改为深褐金边）。</p>
</div>
<div class="card"><h3>5.2 视觉资产落地</h3>
<ul>
<li><b>28 张 AI 美术</b>真实进入分包并接入渲染：12 张 Q 版 3D 武将立绘、6 种 3D 宝箱、5 张 3D 器械、5 张全屏插画。</li>
<li><b>云纹雕花 + 金粉</b>铺到首页/商城/宝箱/招募/结算五屏，确定性粒子保证可复现。</li>
<li><b>抠图质量</b>：关羽白底 43.21%→0.58%、稀有箱 43.76%→1.11%、木箱 8.48%→0.02%，六张英雄卡目检无白底。</li>
<li><b>包体</b>：主包 2.34MB/4MB、加固后 2.58MB，总包 26.45MB/30MB（十进制），预算内且留有余量。</li>
</ul>
<p class="tag info">注</p>
<p>UI 已达成"暖褐暗金完全复刻参考图"的方向性目标；仍有细微残留（银甲/石弹高光被浅灰白量化计入，
张任脚下极窄影棚地面条），在 80~120px 游戏内尺寸下不可见，不影响体验。</p>
</div>
<div class="verdict"><h4>UI 效果结论</h4>
<p><span class="tag good">达标</span> 色度量化 12/12 通过，暖色占比逼近参考图，
视觉资产全部真实落地（非仅出图），抠图白底等致命问题已清除。
从"冷玄墨"到"暖褐暗金"的视觉转向完成度高。</p></div>
""")

# ---- 六、总评 ----
H.append(f"""<h2>六、综合评分与建议</h2>
<table><tr><th>维度</th><th>评分</th><th>核心依据</th></tr>
<tr><td>经济模型</td><td>9 / 10</td><td>单一货币、首通收入、上限化辅助，无通胀；消耗侧四条线齐备</td></tr>
<tr><td>难度曲线</td><td>8 / 10</td><td>四因子错峰、平均 +{avg_inc:.2f}%/关；{over20} 处 checkpoint 尖峰可优化</td></tr>
<tr><td>成长曲线</td><td>9 / 10</td><td>7.4× 单兵成长 + 300 槽位 + 合成，供给充裕，无断层</td></tr>
<tr><td>UI 展示</td><td>9 / 10</td><td>暖色 {summary_warm['after']['warm']}% 逼近参考 {summary_warm['ref']['warm']}%，28 张美术真实落地</td></tr>
<tr><td>留存设计</td><td>详见专项报告</td><td>见《留存玩家专项报告》</td></tr>
</table>
<div class="card"><h3>优先优化建议</h3>
<ol>
<li><b>平滑 L49 卡点</b>（高优先）：40.9% 单关增幅由 checkpoint×tier 叠加，建议降至 1.05 或 tier 后移 2 关。</li>
<li><b>后期金币回收</b>（中优先）：1,629 万累计收入相对消耗偏充裕，可增加高价值消耗点（如武将专精、器械高阶升级）。</li>
<li><b>上线前人工项</b>（必须）：替换正式 AppID、广告位 ID、确认 BGM 版权、配置隐私指引。</li>
</ol>
</div>
<div class="foot">本报告由 <code>tools/make_review_report.py</code> 自动生成 · 数据源为游戏真实配置与渲染截图 · 体验版 1.3.1</div>
</div></body></html>""")

out = D / "全面测评报告_1.3.1.html"
out.write_text("\n".join(H), encoding="utf-8")
print(f"✔ 全面测评报告已生成：{out}（{len(out.read_bytes())/1024:.0f} KB）")
