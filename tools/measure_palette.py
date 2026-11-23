# 板块 2/3 验收工具：参考图 / 改前 / 本阶段改后 三栏冷暖像素量化对比
# 用法：python tools/measure_palette.py s2.1
# 依赖：Pillow。输出控制台表格 + docs/精细化改造/<stage>/color-metrics.json
import colorsys
import json
import os
import shutil
import sys
from collections import Counter

from PIL import Image

STAGE = sys.argv[1] if len(sys.argv) > 1 else 's2.1'
ROOT = os.path.join('docs', '精细化改造')
BASE = json.load(open(os.path.join(ROOT, 'baseline.json'), encoding='utf-8'))
PAIRS = BASE['参考图与改前截图映射']
OUT = os.path.join(ROOT, STAGE)
os.makedirs(OUT, exist_ok=True)


def analyze(path):
    if not os.path.exists(path):
        return None
    im = Image.open(path).convert('RGB')
    im.thumbnail((180, 320))
    q = im.quantize(colors=48, method=2).convert('RGB')
    px = list(q.getdata())
    n = len(px)
    warm = cold = 0
    hue_sum = hue_w = 0.0
    for r, g, b in px:
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if v < 0.15:
            continue
        if r > b + 12 and r > g + 4:
            warm += 1
        elif b > r + 12:
            cold += 1
        if s > 0.2:
            hue_sum += h * 360 * s
            hue_w += s
    return {
        'warm': round(warm / n * 100, 1),
        'cold': round(cold / n * 100, 1),
        'hue': round(hue_sum / hue_w, 1) if hue_w else 0,
    }


def main():
    metrics = {}
    print(f"{'界面':<14}{'参考图 暖/冷':>15}{'改前 暖/冷':>15}{f'{STAGE} 暖/冷':>15}  判定")
    print('-' * 76)
    totals = {'ref': [0, 0], 'before': [0, 0], 'after': [0, 0]}
    count = 0
    for name, shot in PAIRS.items():
        src = os.path.join('assets', '_smoke', shot)
        dst = os.path.join(OUT, name + '.png')
        if os.path.exists(src):
            shutil.copyfile(src, dst)
        a = analyze(os.path.join(ROOT, 'ref', name + '.png'))
        b = analyze(os.path.join(ROOT, 'before', name + '.png'))
        c = analyze(dst)
        if not (a and b and c):
            print(f'{name}: 缺图（{shot}）')
            continue
        metrics[name] = {'shot': shot, 'ref': a, 'before': b, 'after': c}
        for key, val in [('ref', a), ('before', b), ('after', c)]:
            totals[key][0] += val['warm']
            totals[key][1] += val['cold']
        count += 1
        cold_ok = c['cold'] <= max(2.0, a['cold'] + 2)
        warm_up = c['warm'] > b['warm'] + 5
        verdict = '✓ 达标' if cold_ok and warm_up else ('· 冷色残留' if not cold_ok else '· 暖色待补')
        print(f"{name:<14}{a['warm']:6.1f}/{a['cold']:<6.1f}{b['warm']:7.1f}/{b['cold']:<6.1f}"
              f"{c['warm']:7.1f}/{c['cold']:<6.1f}  {verdict}")
    print('-' * 76)
    summary = {}
    for key, label in [('ref', '参考图平均'), ('before', '改前平均'), ('after', STAGE + ' 平均')]:
        w = totals[key][0] / count
        c = totals[key][1] / count
        summary[key] = {'warm': round(w, 1), 'cold': round(c, 1)}
        print(f'  {label}: 暖 {w:5.1f}%   冷 {c:5.1f}%')
    payload = {'stage': STAGE, 'summary': summary, 'screens': metrics}
    with open(os.path.join(OUT, 'color-metrics.json'), 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f'\n已保存 {count} 张截图与量化结果 → {OUT}/')


if __name__ == '__main__':
    main()
