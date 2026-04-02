"""Layout: inverted T from hex grid + red infills.

Run with --outline-only or --remove-hexagons to show only the exterior
dotted T (no fills, labels, or debug panel).
"""
import os
import matplotlib as mpl

_backend = os.environ.get("MPLBACKEND")
if _backend in (None, "", "auto"):
    mpl.use("TkAgg")
else:
    mpl.use(_backend)

import matplotlib.pyplot as plt
import numpy as np
from collections import Counter, defaultdict
from matplotlib.patches import Polygon
import string
import sys

def get_label(n):
    result = ""
    n += 1
    while n > 0:
        n, remainder = divmod(n - 1, 26)
        result = string.ascii_uppercase[remainder] + result
    return result


def _snap_pt(p, eps):
    return (round(float(p[0]) / eps) * eps, round(float(p[1]) / eps) * eps)


def _edge_key(p, q, eps):
    a, b = _snap_pt(p, eps), _snap_pt(q, eps)
    return tuple(sorted((a, b)))


def compute_union_exterior_path(hex_centers, red_triangles, s, angles, eps=1e-3):
    """Outer boundary of hex union plus red infill triangles."""
    cnt = Counter()
    for cx, cy in hex_centers:
        vx = [(cx + s * np.cos(a), cy + s * np.sin(a)) for a in angles[:6]]
        for i in range(6):
            cnt[_edge_key(vx[i], vx[(i + 1) % 6], eps)] += 1
    for tri in red_triangles:
        p, q, r = tri
        for a, b in ((p, q), (q, r), (r, p)):
            cnt[_edge_key(a, b, eps)] += 1
    boundary = [e for e, c in cnt.items() if c == 1]
    adj = defaultdict(list)
    for a, b in boundary:
        adj[a].append(b)
        adj[b].append(a)
    start = min(adj.keys())
    path = [start]
    prev, cur = None, start
    for _ in range(len(boundary) + 5):
        nbs = [n for n in adj[cur] if n != prev]
        if not nbs:
            break
        nxt = nbs[0]
        path.append(nxt)
        if nxt == start and len(path) > 2:
            break
        prev, cur = cur, nxt
    return path


def draw_pointy_t_container_with_debug(outline_only=None):
    if outline_only is None:
        outline_only = any(
            a in sys.argv for a in ("--outline-only", "--remove-hexagons")
        )

    s = 1.0
    h = np.sqrt(3) / 2
    angles = [
        0.0,
        1.0471975511965976,
        2.0943951023931953,
        3.141592653589793,
        4.1887902047863905,
        5.235987755982989,
        0.0,
    ]

    h_dist, v_dist = 2.0 * s, 1.73205 * s
    hex_centers = [
        (-h_dist, 0),
        (0, 0),
        (h_dist, 0),
        (0, v_dist),
        (0, 2 * v_dist),
        (0, 3 * v_dist),
    ]
    red_triangles = [
        ([-1.5, h], [-0.5, h], [-1.0, 0]),
        ([-1.5, -h], [-0.5, -h], [-1.0, 0]),
        ([0.5, h], [1.5, h], [1.0, 0]),
        ([0.5, -h], [1.5, -h], [1.0, 0]),
    ]

    outline_path = compute_union_exterior_path(hex_centers, red_triangles, s, angles)

    if outline_only:
        fig, ax = plt.subplots(1, 1, figsize=(10, 12))
        ax.set_aspect("equal")
        ax.axis("off")
        xs = [p[0] for p in outline_path]
        ys = [p[1] for p in outline_path]
        ax.plot(xs, ys, linestyle=":", color="black", linewidth=2.5)
        ax.set_title("Inverted T (outline only - hexes hidden)")
        plt.tight_layout()
        plt.show()
        return

    fig, (ax, ax_debug) = plt.subplots(
        1, 2, figsize=(16, 10), gridspec_kw={"width_ratios": [1, 1]}
    )
    ax.set_aspect("equal")
    ax.axis("off")
    ax_debug.axis("off")

    debug_logs = []
    label_counter = 0
    vertex_points = {}

    def log_debug(msg):
        debug_logs.append(msg)
        print(msg)

    def add_vertex_labels(label, v1, v2, v3, tx, ty):
        nonlocal vertex_points
        inset = 0.15
        vertices = [v2, v3, v1]
        for idx, v in enumerate(vertices, start=1):
            vertex_points[f"{label}_{idx}"] = [float(v[0]), float(v[1])]
            vx = v[0] * (1 - inset) + tx * inset
            vy = v[1] * (1 - inset) + ty * inset
            ax.text(
                vx,
                vy,
                f"{label}_{idx}",
                fontsize=6,
                color="red",
                weight="bold",
                ha="center",
                va="center",
            )

    def draw_hexagon(cx, cy, hex_num):
        nonlocal label_counter
        log_debug(f"Hexagon {hex_num} start: ({cx}, {cy})")
        for i in range(6):
            v1 = [cx, cy]
            v2 = [cx + s * np.cos(angles[i]), cy + s * np.sin(angles[i])]
            v3 = [cx + s * np.cos(angles[i + 1]), cy + s * np.sin(angles[i + 1])]
            tx = (v1[0] + v2[0] + v3[0]) / 3.0
            ty = (v1[1] + v2[1] + v3[1]) / 3.0
            tri = Polygon([v1, v2, v3], closed=True, facecolor="#FDEBD0", edgecolor="black", linewidth=0.5)
            ax.add_patch(tri)
            label = get_label(label_counter)
            ax.text(tx, ty, label, fontsize=8, ha="center", va="center")
            add_vertex_labels(label, v1, v2, v3, tx, ty)
            if label == "M":
                ax.plot(
                    [v3[0], v1[0]],
                    [v3[1], v1[1]],
                    color="green",
                    linewidth=3,
                    solid_capstyle="round",
                    zorder=10,
                )
            label_counter += 1
        hx = [cx + s * np.cos(a) for a in angles]
        hy = [cy + s * np.sin(a) for a in angles]
        ax.plot(hx, hy, color="black", linewidth=2)
        ax.text(cx, cy, str(hex_num), fontsize=20, weight="bold", ha="center", va="center", alpha=0.2)

    def draw_red_infill(v1, v2, v3):
        nonlocal label_counter
        filler = Polygon([v1, v2, v3], closed=True, facecolor="red", edgecolor="black", linewidth=1.2)
        ax.add_patch(filler)
        tx = (v1[0] + v2[0] + v3[0]) / 3.0
        ty = (v1[1] + v2[1] + v3[1]) / 3.0
        label = get_label(label_counter)
        ax.text(tx, ty, label, fontsize=9, color="white", weight="bold", ha="center", va="center")
        add_vertex_labels(label, v1, v2, v3, tx, ty)
        if label == "M":
            ax.plot([v3[0], v1[0]], [v3[1], v1[1]], color="green", linewidth=3, solid_capstyle="round", zorder=10)
        log_debug(f"Red Infill: Label {label}")
        label_counter += 1

    for cx, cy, n in [
        (-h_dist, 0, 1),
        (0, 0, 2),
        (h_dist, 0, 3),
        (0, v_dist, 4),
        (0, 2 * v_dist, 5),
        (0, 3 * v_dist, 6),
    ]:
        draw_hexagon(cx, cy, n)

    for t in red_triangles:
        draw_red_infill(t[0], t[1], t[2])

    if "Y_1" in vertex_points and "AE_1" in vertex_points:
        py1 = vertex_points["Y_1"]
        ae1 = vertex_points["AE_1"]
        ax.plot(
            [py1[0], ae1[0]],
            [py1[1], ae1[1]],
            linestyle=":",
            color="mediumblue",
            linewidth=2.0,
            zorder=12,
        )

    ox = [p[0] for p in outline_path]
    oy = [p[1] for p in outline_path]
    ax.plot(ox, oy, linestyle=":", color="black", linewidth=2.5, zorder=15)

    debug_text = "\n".join(debug_logs)
    ax_debug.text(
        0,
        1,
        f"DEBUG OUTPUT LOGS:\n\n{debug_text}",
        fontsize=11,
        family="monospace",
        verticalalignment="top",
    )

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    plt.close("all")
    draw_pointy_t_container_with_debug()