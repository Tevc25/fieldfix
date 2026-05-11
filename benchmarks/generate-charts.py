#!/usr/bin/env python3
"""Generate comparison charts for FieldFix server benchmarks."""

import json
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

RESULTS_DIR = os.path.join(os.path.dirname(__file__), 'results')

# ── Measured data ─────────────────────────────────────────────────────────────
cold_start = json.load(open(os.path.join(RESULTS_DIR, 'cold-start.json')))
node_k6 = json.load(open(os.path.join(RESULTS_DIR, 'k6-node.json')))
bun_k6 = json.load(open(os.path.join(RESULTS_DIR, 'k6-bun.json')))

def k6_metric(data, metric, stat):
    return data['metrics'][metric]['values'][stat]

# Cold-start averages (ms)
cs_node = sum(cold_start['node']) / len(cold_start['node'])
cs_bun  = sum(cold_start['bun'])  / len(cold_start['bun'])

# Throughput (req/s)
rps_node = k6_metric(node_k6, 'http_reqs', 'rate')
rps_bun  = k6_metric(bun_k6,  'http_reqs', 'rate')

# Latency (ms)
p50_node = k6_metric(node_k6, 'http_req_duration', 'med')
p50_bun  = k6_metric(bun_k6,  'http_req_duration', 'med')
p90_node = k6_metric(node_k6, 'http_req_duration', 'p(90)')
p90_bun  = k6_metric(bun_k6,  'http_req_duration', 'p(90)')
p95_node = k6_metric(node_k6, 'http_req_duration', 'p(95)')
p95_bun  = k6_metric(bun_k6,  'http_req_duration', 'p(95)')

# Memory (MB) — measured separately
mem_idle  = {'Node': 118, 'Bun': 83}
mem_peak  = {'Node': 231, 'Bun': 145}

# LOC
loc = {'Node': 529, 'Bun': 393, 'Deno': 418}

# ── Colour palette ────────────────────────────────────────────────────────────
C = {'Node': '#68a063', 'Bun': '#fbf0df', 'Deno': '#70c8be'}
EDGE = {'Node': '#3d7a37', 'Bun': '#c8a060', 'Deno': '#3a8a84'}

plt.rcParams.update({
    'figure.facecolor': '#1e1e2e',
    'axes.facecolor':   '#181825',
    'axes.edgecolor':   '#45475a',
    'axes.labelcolor':  '#cdd6f4',
    'xtick.color':      '#cdd6f4',
    'ytick.color':      '#cdd6f4',
    'text.color':       '#cdd6f4',
    'grid.color':       '#313244',
    'grid.linestyle':   '--',
    'grid.alpha':       0.5,
    'font.size':        11,
})

def bar_labels(ax, bars, fmt='{:.0f}'):
    for b in bars:
        h = b.get_height()
        ax.text(b.get_x() + b.get_width() / 2, h + h * 0.02,
                fmt.format(h), ha='center', va='bottom', fontsize=10,
                color='#cdd6f4', fontweight='bold')

# ── 1. Cold-start ─────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(6, 4))
variants = ['Node', 'Bun']
vals = [cs_node, cs_bun]
bars = ax.bar(variants, vals, color=[C['Node'], C['Bun']],
              edgecolor=[EDGE['Node'], EDGE['Bun']], linewidth=1.4, width=0.5)
bar_labels(ax, bars, fmt='{:.0f} ms')
ax.set_title('Čas hladnega zagona (ms)', pad=12, fontweight='bold', color='#cba6f7')
ax.set_ylabel('ms')
ax.yaxis.grid(True)
ax.set_axisbelow(True)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
fig.tight_layout()
fig.savefig(os.path.join(RESULTS_DIR, 'chart-cold-start.png'), dpi=150)
plt.close(fig)
print('Saved chart-cold-start.png')

# ── 2. Throughput (req/s) ─────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(6, 4))
vals = [rps_node, rps_bun]
bars = ax.bar(variants, vals, color=[C['Node'], C['Bun']],
              edgecolor=[EDGE['Node'], EDGE['Bun']], linewidth=1.4, width=0.5)
bar_labels(ax, bars, fmt='{:.0f} req/s')
ax.set_title('Prepustnost (req/s) — 100 VU, 60 s', pad=12, fontweight='bold', color='#cba6f7')
ax.set_ylabel('req/s')
ax.yaxis.grid(True)
ax.set_axisbelow(True)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
fig.tight_layout()
fig.savefig(os.path.join(RESULTS_DIR, 'chart-throughput.png'), dpi=150)
plt.close(fig)
print('Saved chart-throughput.png')

# ── 3. Latency (p50 / p90 / p95) ─────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(7, 4))
x = np.arange(3)
w = 0.35
bars_n = ax.bar(x - w/2, [p50_node, p90_node, p95_node],
                width=w, color=C['Node'], edgecolor=EDGE['Node'], linewidth=1.2, label='Node')
bars_b = ax.bar(x + w/2, [p50_bun,  p90_bun,  p95_bun],
                width=w, color=C['Bun'],  edgecolor=EDGE['Bun'],  linewidth=1.2, label='Bun')
for bars in (bars_n, bars_b):
    for b in bars:
        h = b.get_height()
        ax.text(b.get_x() + b.get_width() / 2, h + 0.15,
                f'{h:.2f}', ha='center', va='bottom', fontsize=9, color='#cdd6f4')
ax.set_xticks(x)
ax.set_xticklabels(['p50 (median)', 'p90', 'p95'])
ax.set_title('Zakasnitev zahtev (ms)', pad=12, fontweight='bold', color='#cba6f7')
ax.set_ylabel('ms')
ax.yaxis.grid(True)
ax.set_axisbelow(True)
ax.legend(framealpha=0.2)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
fig.tight_layout()
fig.savefig(os.path.join(RESULTS_DIR, 'chart-latency.png'), dpi=150)
plt.close(fig)
print('Saved chart-latency.png')

# ── 4. Memory (idle / peak) ───────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(6, 4))
x = np.arange(2)
w = 0.35
bars_i = ax.bar(x - w/2, [mem_idle['Node'], mem_idle['Bun']],
                width=w, color=[C['Node'], C['Bun']],
                edgecolor=[EDGE['Node'], EDGE['Bun']], linewidth=1.2, label='Idle RSS')
bars_p = ax.bar(x + w/2, [mem_peak['Node'], mem_peak['Bun']],
                width=w, color=[C['Node'], C['Bun']],
                edgecolor=[EDGE['Node'], EDGE['Bun']], linewidth=1.2,
                alpha=0.55, label='Peak RSS')
for bars in (bars_i, bars_p):
    for b in bars:
        h = b.get_height()
        ax.text(b.get_x() + b.get_width() / 2, h + 1.5,
                f'{int(h)} MB', ha='center', va='bottom', fontsize=9, color='#cdd6f4')
ax.set_xticks(x)
ax.set_xticklabels(['Node', 'Bun'])
ax.set_title('Poraba pomnilnika (RSS, MB)', pad=12, fontweight='bold', color='#cba6f7')
ax.set_ylabel('MB')
ax.yaxis.grid(True)
ax.set_axisbelow(True)
ax.legend(framealpha=0.2)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
fig.tight_layout()
fig.savefig(os.path.join(RESULTS_DIR, 'chart-memory.png'), dpi=150)
plt.close(fig)
print('Saved chart-memory.png')

# ── 5. LOC ────────────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(6, 4))
loc_variants = list(loc.keys())
loc_vals = list(loc.values())
loc_colors = [C[v] for v in loc_variants]
loc_edges  = [EDGE[v] for v in loc_variants]
bars = ax.bar(loc_variants, loc_vals, color=loc_colors, edgecolor=loc_edges,
              linewidth=1.4, width=0.5)
bar_labels(ax, bars, fmt='{:.0f}')
ax.set_title('Število vrstic kode (src/)', pad=12, fontweight='bold', color='#cba6f7')
ax.set_ylabel('LOC')
ax.yaxis.grid(True)
ax.set_axisbelow(True)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
fig.tight_layout()
fig.savefig(os.path.join(RESULTS_DIR, 'chart-loc.png'), dpi=150)
plt.close(fig)
print('Saved chart-loc.png')

print('All charts generated.')
