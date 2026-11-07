#!/usr/bin/env python3
"""GeoMind backend.

Stdlib HTTP server + high-precision verification + autonomous problem
discovery.  No third-party web framework is required; SymPy/mpmath are used
only for the symbolic / high-precision layer.
"""
from __future__ import annotations

import base64
import gzip
import hashlib
import io
import json
import math
import mimetypes
import os
import random
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import mpmath as mp
from symbolic_geometry import prove as symbolic_prove

mp.mp.dps = 50

ROOT = Path(__file__).resolve().parent
STATIC_ROOTS = (ROOT / "index.html", ROOT / "css", ROOT / "js", ROOT / "data")
STARTED = time.time()
VERSION = "1.0.0"
MAX_BODY = 14 * 1024 * 1024

# ---------------------------------------------------------------------------
# small caches
# ---------------------------------------------------------------------------
_CACHE_LOCK = threading.Lock()
_VERIFY_CACHE: dict[str, tuple[float, dict]] = {}
_GENERATE_CACHE: dict[str, list] = {}
_OCR_CACHE: dict[str, dict] = {}
_VISION_CACHE: dict[str, dict] = {}
_PROOF_CACHE: dict[str, dict] = {}
_PROOF_JOBS: dict[str, dict] = {}
_PROOF_JOBS_LOCK = threading.Lock()
_LOG_LOCK = threading.Lock()
_LOG_ENTRIES: list[dict] = []
_LLM_SEM = threading.Semaphore(2)


def add_log(kind: str, **fields) -> None:
    entry = {"kind": kind, "time": time.strftime("%Y-%m-%d %H:%M:%S"), **fields}
    with _LOG_LOCK:
        _LOG_ENTRIES.append(entry)
        if len(_LOG_ENTRIES) > 80:
            del _LOG_ENTRIES[:len(_LOG_ENTRIES) - 80]


def client_log(kind: str, **fields) -> None:
    add_log(kind, **fields)


def get_logs(limit: int = 60) -> list[dict]:
    with _LOG_LOCK:
        return list(reversed(_LOG_ENTRIES[-limit:]))
_OCR_ENGINE = None
_OCR_LOCK = threading.Lock()


def cache_get(cache, key, ttl=300):
    with _CACHE_LOCK:
        item = cache.get(key)
        if not item:
            return None
        if isinstance(item, tuple) and len(item) == 2 and isinstance(item[0], (int, float)):
            ts, value = item
            if time.time() - ts > ttl:
                cache.pop(key, None)
                return None
            return value
        return item


def cache_put(cache, key, value):
    with _CACHE_LOCK:
        if len(cache) > 512:
            cache.clear()
        cache[key] = (time.time(), value)


def F(x) -> mp.mpf:
    return mp.mpf(str(x))


def fmt(x, n=5) -> str:
    try:
        x = mp.mpf(x)
        if abs(x) < mp.mpf("1e-30"):
            return "0"
        return mp.nstr(x, n)
    except Exception:
        return str(x)


def dist(a, b):
    return mp.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def norm(a):
    l = mp.sqrt(dot(a, a))
    return (a[0] / l, a[1] / l) if l > 0 else (0, 0)


def circumcenter(a, b, c):
    d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
    if abs(d) < mp.mpf("1e-40"):
        return None
    a2 = a[0] ** 2 + a[1] ** 2
    b2 = b[0] ** 2 + b[1] ** 2
    c2 = c[0] ** 2 + c[1] ** 2
    return (
        (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d,
        (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d,
    )


def line_intersection(a1, d1, a2, d2):
    den = cross(d1, d2)
    if abs(den) < mp.mpf("1e-30"):
        return None
    q = sub(a2, a1)
    t = cross(q, d2) / den
    return (a1[0] + d1[0] * t, a1[1] + d1[1] * t)


def parse_points(payload):
    pts = {}
    for p in payload.get("points", []):
        try:
            pts[p["name"]] = (F(p["x"]), F(p["y"]))
        except Exception:
            continue
    return pts


def parse_lines(payload):
    lines = {}
    for l in payload.get("lines", []):
        try:
            lines[l["name"]] = ((F(l["a"]["x"]), F(l["a"]["y"])), (F(l["d"]["x"]), F(l["d"]["y"])))
        except Exception:
            continue
    return lines


def parse_circles(payload):
    circles = {}
    for c in payload.get("circles", []):
        try:
            circles[c["name"]] = ((F(c["center"]["x"]), F(c["center"]["y"])), F(c["r"]))
        except Exception:
            continue
    return circles


# ---------------------------------------------------------------------------
# verification
# ---------------------------------------------------------------------------
GENERIC_HINTS = {
    "collinear": ["优先用梅涅劳斯定理或位似/中位线把三点放到同一构造链上。", "也可建立复平面，验证 (c−a)/(b−a) 为实数。"],
    "concyclic": ["寻找同弧所对的等角，或证明对角互补。", "垂足结构常给出 90° 共圆，可作为中间引理。"],
    "parallel": ["寻找截线形成的等角，或用三角形中位线/位似。"],
    "perpendicular": ["寻找直径所对圆周角、切线半径或勾股逆定理。"],
    "concurrent": ["若三线经过三角形顶点与对边点，用塞瓦定理逆定理：三组有向比乘积为 1。"],
    "midpoint": ["寻找平行四边形对角线或三角形中位线。"],
    "equalLength": ["构造全等三角形，或使用同圆半径/切割线定理。"],
    "equalAngle": ["寻找四点共圆，把角转移到同弧上；或用相似/等角共轭。"],
    "tangent": ["直线与圆相切 ⇔ 圆心到直线距离等于半径；两圆相切 ⇔ 圆心距等于半径和或差。"],
    "onCircle": ["证明点到圆心距离等于半径，或证明与圆上三点共圆。"],
    "ratio": ["把比例转化为面积比、正弦比或梅涅劳斯/塞瓦中的有向比。"],
}


def verify_payload(payload: dict) -> dict:
    goal = payload.get("goal") or {}
    kind = goal.get("kind")
    pts = parse_points(payload)
    lines = parse_lines(payload)
    circles = parse_circles(payload)
    allpts = list(pts.values()) or [(mp.mpf(0), mp.mpf(0))]
    xs = [p[0] for p in allpts]
    ys = [p[1] for p in allpts]
    scale = max(mp.mpf(1), max(xs) - min(xs), max(ys) - min(ys))
    threshold = mp.mpf("2e-6")
    checks = []
    comp = []
    values = {}
    names = goal.get("names") or goal.get("pointNames") or []
    line_names = goal.get("lineNames") or []
    residual = mp.inf

    def add_check(name, value, note=""):
        checks.append({"name": name, "value": fmt(value, 8), "note": note})

    if kind == "collinear":
        P = [pts[n] for n in names if n in pts]
        if len(P) >= 3:
            A, B = P[0], P[1]
            u = norm(sub(B, A))
            ds = [abs(cross(sub(p, A), u)) for p in P[2:]]
            residual = max(ds) / scale if ds else mp.inf
            comp.append(f"A={fmt_point(A)}, B={fmt_point(B)}, C={fmt_point(P[2])}")
            comp.append(f"det(B−A,C−A) = {fmt(cross(sub(B,A), sub(P[2],A)), 12)}")
            comp.append(f"最大点到直线距离 = {fmt(max(ds) if ds else 0, 12)}")
            add_check("行列式", cross(sub(B, A), sub(P[2], A)), "应为 0")
            add_check("最大距离/尺度", residual)
        else:
            comp.append("点数不足，无法判定共线。")
    elif kind == "concyclic":
        P = [pts[n] for n in names if n in pts]
        if len(P) >= 4:
            O = circumcenter(P[0], P[1], P[2])
            if O:
                r = dist(O, P[0])
                dev = [abs(dist(O, p) - r) for p in P]
                residual = max(dev) / scale
                comp.append(f"圆心 O={fmt_point(O)}，r={fmt(r, 10)}")
                for i, p in enumerate(P):
                    comp.append(f"|P{i+1}O|−r = {fmt(dist(O,p)-r, 10)}")
                add_check("最大偏差/尺度", residual)
            else:
                comp.append("前三点共线，圆退化。")
    elif kind in ("parallel", "perpendicular"):
        L = [lines[n] for n in line_names if n in lines]
        if len(L) >= 2:
            a, b = L[0][1], L[1][1]
            s = abs(cross(a, b))
            c = abs(dot(a, b))
            residual = s if kind == "parallel" else c
            comp.append(f"u={fmt_point(a)}, v={fmt_point(b)}")
            comp.append(f"u×v={fmt(cross(a,b),12)}, u·v={fmt(dot(a,b),12)}")
            add_check("方向残差", residual)
    elif kind == "concurrent":
        L = [lines[n] for n in line_names if n in lines]
        if len(L) >= 3:
            best = None
            for i in range(len(L)):
                for j in range(i + 1, len(L)):
                    P = line_intersection(L[i][0], L[i][1], L[j][0], L[j][1])
                    if P is None:
                        continue
                    ds = [abs(cross(sub(P, a), d)) for a, d in L]
                    m = max(ds)
                    if best is None or m < best[0]:
                        best = (m, P, ds)
            if best:
                residual = best[0] / scale
                comp.append(f"公共点 ≈ {fmt_point(best[1])}")
                comp.append("到各线距离: " + ", ".join(fmt(d, 10) for d in best[2]))
                add_check("最大线距/尺度", residual)
    elif kind == "midpoint":
        M = pts.get(goal.get("pointId"))
        pair = goal.get("pairNames") or []
        if M and len(pair) == 2 and pair[0] in pts and pair[1] in pts:
            A, B = pts[pair[0]], pts[pair[1]]
            mid = ((A[0] + B[0]) / 2, (A[1] + B[1]) / 2)
            residual = dist(M, mid) / scale
            comp.append(f"mid(AB)={fmt_point(mid)}, M={fmt_point(M)}")
            add_check("|M−mid|/尺度", residual)
    elif kind == "equalLength":
        pairs = goal.get("pairs") or []
        lens = []
        for a, b in pairs:
            if a in pts and b in pts:
                lens.append(dist(pts[a], pts[b]))
        if len(lens) >= 2:
            mx, mn = max(lens), min(lens)
            residual = (mx - mn) / max(mx, mp.mpf("1e-30"))
            comp.append("长度: " + " / ".join(fmt(x, 10) for x in lens))
            add_check("相对差", residual)
    elif kind == "equalAngle":
        angles = goal.get("angles") or []
        vals = []
        for a, b, c in angles:
            if a in pts and b in pts and c in pts:
                u = norm(sub(pts[a], pts[b]))
                v = norm(sub(pts[c], pts[b]))
                vals.append(mp.acos(max(mp.mpf(-1), min(mp.mpf(1), dot(u, v)))))
        if len(vals) >= 2:
            residual = (max(vals) - min(vals)) / mp.pi
            comp.append("角度: " + " / ".join(fmt(v * 180 / mp.pi, 8) + "°" for v in vals))
            add_check("角差/π", residual)
    elif kind == "tangent":
        line_name = goal.get("lineId") or goal.get("tangentLine")
        circle_name = goal.get("circleId") or goal.get("tangentCircle")
        if line_name in lines and circle_name in circles:
            (a, d), (C, r) = lines[line_name], circles[circle_name]
            dd = abs(cross(sub(C, a), d))
            residual = abs(dd - r) / scale
            comp.append(f"d(O,ℓ)={fmt(dd,12)}, r={fmt(r,12)}")
            add_check("|d−r|/尺度", residual)
        else:
            cn = goal.get("circleNames") or []
            if len(cn) >= 2 and cn[0] in circles and cn[1] in circles:
                (C1, r1), (C2, r2) = circles[cn[0]], circles[cn[1]]
                D = dist(C1, C2)
                ext = abs(D - (r1 + r2))
                inn = abs(D - abs(r1 - r2))
                residual = min(ext, inn) / scale
                comp.append(f"D={fmt(D,12)}, r1+r2={fmt(r1+r2,12)}, |r1−r2|={fmt(abs(r1-r2),12)}")
                add_check("最小相切残差/尺度", residual)
    elif kind == "onCircle":
        pname = goal.get("pointId")
        cname = goal.get("circleId")
        if pname in pts and cname in circles:
            C, r = circles[cname]
            dd = abs(dist(pts[pname], C) - r)
            residual = dd / scale
            comp.append(f"|OP|−r = {fmt(dd,12)}")
            add_check("点圆残差/尺度", residual)
    elif kind == "ratio":
        pairs = goal.get("pairs") or []
        lens = []
        for a, b in pairs:
            if a in pts and b in pts:
                lens.append(dist(pts[a], pts[b]))
        if len(lens) >= 2 and lens[1] != 0:
            actual = lens[0] / lens[1]
            target = F(goal.get("value") or 1)
            residual = abs(actual - target) / max(abs(target), mp.mpf("1e-30"))
            comp.append(f"实际比={fmt(actual,12)}, 目标比={fmt(target,12)}")
            add_check("相对差", residual)

    ok = residual < threshold
    confidence = float(max(mp.mpf(0), min(mp.mpf(100), 99.99 - 7.5 * residual / threshold))) if ok else float(max(mp.mpf(0), min(mp.mpf(88), 88 * (1 - min(mp.mpf(1), residual / (threshold * 25))))))
    scenario = goal.get("scenarioId") or payload.get("scenarioId")
    synth = synthetic_hint(kind, names, scenario, goal)
    return {
        "ok": bool(ok),
        "confidence": confidence,
        "residual": float(residual) if residual != mp.inf else None,
        "residualText": fmt(residual, 10),
        "threshold": float(threshold),
        "precision": "50 dps · mpmath",
        "detail": {"collinear": "行列式与最大偏离", "concyclic": "外接圆半径偏差", "parallel": "方向向量叉积", "perpendicular": "方向向量点积", "concurrent": "各线到公共点距离", "midpoint": "中点距离", "equalLength": "长度相对差", "equalAngle": "角度差", "tangent": "圆心距/半径关系", "onCircle": "点圆距离", "ratio": "比例相对差"}.get(kind, "数值验证"),
        "checks": checks,
        "computation": comp,
        "values": {k: (fmt(v, 10) if isinstance(v, (int, float, mp.mpf)) else v) for k, v in values.items()},
        "synthetic": synth,
        "goalStatement": goal.get("statement") or "",
        "elapsedMs": 0,
    }


def fmt_point(p):
    return f"({fmt(p[0], 6)}, {fmt(p[1], 6)})"


def synthetic_hint(kind, names, scenario, goal):
    ns = set(names or [])
    if kind == "collinear" and {"O", "G", "H"}.issubset(ns):
        return {
            "available": True, "complete": True, "theorem": "Euler line",
            "summary": "以重心 G 为中心、比 −1/2 的位似把三条高映成三边中垂线。",
            "steps": [
                "设 M_a 为 BC 中点，A′ 为 A 的对径点。由 Thales 定理 A′B ⟂ AB、A′C ⟂ AC，故 A′B ∥ CH、A′C ∥ BH，BHCA′ 为平行四边形。",
                "于是 M_a 是 HA′ 的中点。以 G 为中心、比 −1/2 的位似 h 满足 h(A)=M_a、h(H)=O，因此 G、H、O 共线且 GO:GH=1:2。",
            ],
        }
    if kind == "concyclic" and ({"Ma", "Mb", "Mc", "D", "E", "F"}.issubset(ns) or scenario == "euler-ninepoint"):
        return {
            "available": True, "complete": True, "theorem": "Nine-point circle",
            "summary": "九点圆是外接圆在 h(H, 1/2) 下的像。",
            "steps": [
                "取 h=homothety(H, 1/2)，外接圆映成圆心 N=mid(OH)、半径 R/2 的圆。",
                "顶点映到 AH/BH/CH 中点，对径点映到三边中点，H 关于三边的对称点映到三垂足。",
                "九个像点共圆，故九点共圆。",
            ],
        }
    if kind == "tangent" and "Fe" in ns:
        return {"available": True, "complete": False, "theorem": "Feuerbach theorem", "summary": "九点圆与内切圆内切、与三个旁切圆外切。", "steps": ["费尔巴哈定理的标准证明可用反演或位似完成；当前内核只验证了切线条件。"]}
    hints = GENERIC_HINTS.get(kind, ["先用高精度计算确认结论，再把目标化归为标准定理。"])
    return {"available": True, "complete": False, "theorem": "综合法策略", "summary": "后端已经完成高精度坐标验证；以下为综合法入口建议。", "steps": hints}


# ---------------------------------------------------------------------------
# autonomous problem discovery (triangle centres + random samples)
# ---------------------------------------------------------------------------
CENTER_KEYS = ["O", "G", "H", "I", "N", "IA", "IB", "IC", "K", "Ge", "Na", "Sp"]
POINT_KEYS = ["A", "B", "C", "O", "G", "H", "I", "N", "Ma", "Mb", "Mc", "D", "E", "F", "MA", "MB", "MC", "IA", "IB", "IC", "K", "Ge", "Na", "Sp"]


def tri_centers(A, B, C):
    a = dist(B, C)
    b = dist(C, A)
    c = dist(A, B)
    s = (a + b + c) / 2
    area = abs(cross(sub(B, A), sub(C, A))) / 2
    R = a * b * c / (4 * area)
    r = area / s
    O = circumcenter(A, B, C)
    I = ((a * A[0] + b * B[0] + c * C[0]) / (a + b + c), (a * A[1] + b * B[1] + c * C[1]) / (a + b + c))
    H = (A[0] + B[0] + C[0] - 2 * O[0], A[1] + B[1] + C[1] - 2 * O[1])
    G = ((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3)
    N = ((O[0] + H[0]) / 2, (O[1] + H[1]) / 2)
    Ma, Mb, Mc = midpoint(B, C), midpoint(C, A), midpoint(A, B)
    D = project(A, B, sub(C, B))
    E = project(B, C, sub(A, C))
    F = project(C, A, sub(B, A))
    MA = midpoint(A, H)
    MB = midpoint(B, H)
    MC = midpoint(C, H)
    ex = [excenter(A, B, C, i) for i in range(3)]
    K = bary(A, B, C, a * a, b * b, c * c)
    Ge = bary(A, B, C, 1 / (s - a), 1 / (s - b), 1 / (s - c))
    Na = bary(A, B, C, s - a, s - b, s - c)
    Sp = incenter(Ma, Mb, Mc)
    return {
        "A": A, "B": B, "C": C, "O": O, "G": G, "H": H, "I": I, "N": N,
        "Ma": Ma, "Mb": Mb, "Mc": Mc, "D": D, "E": E, "F": F,
        "MA": MA, "MB": MB, "MC": MC, "IA": ex[0], "IB": ex[1], "IC": ex[2],
        "K": K, "Ge": Ge, "Na": Na, "Sp": Sp,
        "_metrics": {"a": a, "b": b, "c": c, "R": R, "r": r, "area": area, "s": s},
    }


def midpoint(A, B):
    return ((A[0] + B[0]) / 2, (A[1] + B[1]) / 2)


def project(P, A, d):
    dd = dot(d, d)
    if dd == 0:
        return A
    t = dot(sub(P, A), d) / dd
    return (A[0] + d[0] * t, A[1] + d[1] * t)


def incenter(A, B, C):
    a, b, c = dist(B, C), dist(C, A), dist(A, B)
    s = a + b + c
    return ((a * A[0] + b * B[0] + c * C[0]) / s, (a * A[1] + b * B[1] + c * C[1]) / s)


def excenter(A, B, C, i):
    a, b, c = dist(B, C), dist(C, A), dist(A, B)
    sg = [(-1, 1, 1), (1, -1, 1), (1, 1, -1)][i]
    den = sg[0] * a + sg[1] * b + sg[2] * c
    return ((sg[0] * a * A[0] + sg[1] * b * B[0] + sg[2] * c * C[0]) / den,
            (sg[0] * a * A[1] + sg[1] * b * B[1] + sg[2] * c * C[1]) / den)


def bary(A, B, C, wa, wb, wc):
    s = wa + wb + wc
    return ((wa * A[0] + wb * B[0] + wc * C[0]) / s, (wa * A[1] + wb * B[1] + wc * C[1]) / s)


def random_triangle(rng):
    for _ in range(200):
        angs = sorted(rng.random() * 2 * math.pi for _ in range(3))
        gaps = [angs[1] - angs[0], angs[2] - angs[1], 2 * math.pi - angs[2] + angs[0]]
        if min(gaps) < 0.55 or max(gaps) > math.pi - 0.12:
            continue
        R = 3.2
        pts = [(R * math.cos(t), R * math.sin(t)) for t in angs]
        A, B, C = pts
        a, b, c = dist(B, C), dist(C, A), dist(A, B)
        cosA = (b * b + c * c - a * a) / (2 * b * c)
        if abs(cosA) > 0.92:
            continue
        return A, B, C
    return (-3.0, -1.4), (3.1, -1.2), (0.1, 2.6)


def all_relations(sample, tol=1e-7):
    pts = {k: sample[k] for k in POINT_KEYS}
    scale = 6.4
    tol = 1e-7 * scale
    cols = {}
    for i in range(len(POINT_KEYS)):
        for j in range(i + 1, len(POINT_KEYS)):
            a, b = pts[POINT_KEYS[i]], pts[POINT_KEYS[j]]
            u = norm(sub(b, a))
            if u == (0, 0):
                continue
            on = [k for k in POINT_KEYS if abs(cross(sub(pts[k], a), u)) < tol]
            if len(on) >= 3:
                sig = tuple(sorted(on))
                cols[sig] = on
    # merge contained sets
    collinear = []
    for sig, on in sorted(cols.items(), key=lambda kv: -len(kv[1])):
        s = set(on)
        if any(s <= set(q) for q in collinear):
            continue
        collinear.append(on)
    cyc = {}
    for i in range(len(POINT_KEYS)):
        for j in range(i + 1, len(POINT_KEYS)):
            for k in range(j + 1, len(POINT_KEYS)):
                a, b, c = pts[POINT_KEYS[i]], pts[POINT_KEYS[j]], pts[POINT_KEYS[k]]
                if abs(cross(sub(b, a), sub(c, a))) < tol * 1e-3:
                    continue
                O = circumcenter(a, b, c)
                if O is None:
                    continue
                r = dist(O, a)
                if r < tol or r > scale * 500:
                    continue
                on = [key for key in POINT_KEYS if abs(dist(O, pts[key]) - r) < tol * 1.5]
                if len(on) >= 4 and not any(set(g) <= set(on) for g in collinear if len(g) >= 3):
                    cyc[tuple(sorted(on))] = on
    cycles = []
    for sig, on in sorted(cyc.items(), key=lambda kv: -len(kv[1])):
        s = set(on)
        if any(s <= set(q) for q in cycles):
            continue
        cycles.append(on)
    return {"collinear": collinear, "concyclic": cycles, "pts": pts, "metrics": sample["_metrics"]}


def relation_holds(sample, kind, names, tol=1e-6):
    pts = sample
    try:
        P = [pts[n] for n in names]
    except KeyError:
        return False
    if kind == "collinear":
        if len(P) < 3:
            return False
        u = norm(sub(P[1], P[0]))
        return u != (0, 0) and all(abs(cross(sub(p, P[0]), u)) < tol for p in P[2:])
    if kind == "concyclic":
        if len(P) < 4:
            return False
        O = circumcenter(P[0], P[1], P[2])
        if not O:
            return False
        r = dist(O, P[0])
        return all(abs(dist(O, p) - r) < tol for p in P)
    return False


def score_relation(kind, names, metrics, points):
    ns = set(names)
    if kind == "collinear":
        if {"O", "G", "H"}.issubset(ns):
            return 99, "欧拉线", "O、G、H 三点共线，且 OG : GH = 1 : 2。"
        if {"G", "I", "Na", "Sp"}.issubset(ns):
            return 95, "奈格尔线", "G、I、Na、Sp 四点共线（奈格尔线）。"
        if {"N", "Ma", "MA"}.issubset(ns):
            return 84, "九点圆心中点链", "九点圆心 N 是 Ma 与 MA 的中点。"
        if len(ns) >= 5:
            return 90, "多点共线", f"{len(ns)} 个特征点共线。"
        centers = ns & set(CENTER_KEYS)
        if len(centers) >= 2:
            return 82, "特征点共线", "两个以上三角形特征点落在同一直线上。"
        if {"A", "H", "D"}.issubset(ns) or {"B", "H", "E"}.issubset(ns):
            return 55, "高线共线", "顶点、垂心与对应垂足共线。"
        return 40, "三点共线", "三点共线。"
    if kind == "concyclic":
        if {"Ma", "Mb", "Mc", "D", "E", "F", "MA", "MB", "MC"}.issubset(ns):
            return 100, "九点圆", "三边中点、三垂足、AH/BH/CH 中点九点共圆。"
        if len(ns) >= 6:
            return 86, "多点共圆", f"{len(ns)} 点共圆。"
        if len(ns & set(CENTER_KEYS)) >= 3:
            return 80, "特征点共圆", "多个三角形特征点共圆。"
        if {"A", "B", "C"}.issubset(ns):
            return 45, "外接圆", "顶点与外接圆上的点共圆。"
        return 58, "四点共圆", "四点共圆。"
    return 50, "关系", "几何关系。"


def construct_candidate(kind, names, sample, score, theorem, description):
    metrics = sample["_metrics"]
    if theorem == "九点圆":
        title = "九点圆定理"
        statement = "证明三边中点、三垂足、AH/BH/CH 的中点九点共圆，并求九点圆半径。"
        tags = ["九点圆", "共圆", "欧拉线"]
        hint = "以外心—垂心连线的中点 N 为圆心，取位似 h(H, 1/2)。"
    elif theorem == "欧拉线":
        title = "欧拉线"
        statement = "证明 O、G、H 三点共线，并求 OG : GH。"
        tags = ["欧拉线", "重心", "外心", "垂心"]
        hint = "以 G 为中心、比 −1/2 的位似把三条高映成三边中垂线。"
    elif theorem == "奈格尔线":
        title = "奈格尔线"
        statement = "证明 G、I、Na、Sp 四点共线（奈格尔线）。"
        tags = ["奈格尔线", "重心", "内心", "奈格尔点"]
        hint = "把内切圆与旁切圆的切点、重心坐标或位似关系联系起来。"
    elif theorem == "九点圆心中点链":
        title = "九点圆心的中点关系"
        statement = "证明九点圆心 N 是 Ma 与 MA 的中点。"
        tags = ["九点圆", "中点", "欧拉线"]
        hint = "利用 N=mid(OH)、Ma=mid(BC) 与 MA=mid(AH)。"
    elif kind == "collinear":
        title = "特征点共线"
        statement = f"证明 {('、'.join(names))} 共线。"
        tags = ["共线", "特征点", "三角形"]
        hint = "尝试用位似、中位线或梅涅劳斯逆定理寻找构造链。"
    elif kind == "concyclic":
        title = "多点共圆"
        statement = f"证明 {('、'.join(names))} 共圆。"
        tags = ["共圆", "圆", "角度追踪"]
        hint = "寻找同弧所对等角，或证明对角互补。"
    else:
        title = "几何命题"
        statement = description
        tags = ["几何"]
        hint = "先锁定关键中间关系。"
    # difficulty heuristic
    depth = 3
    if theorem in ("九点圆", "欧拉线"):
        depth = 4
    if len(names) >= 6:
        depth = 5
    return {
        "id": hashlib.sha1((kind + ":" + ",".join(names) + ":" + str(metrics["R"])).encode()).hexdigest()[:12],
        "title": title,
        "statement": statement,
        "kind": kind,
        "labels": names,
        "theorem": theorem,
        "difficulty": depth,
        "tags": tags,
        "hint": hint,
        "description": description,
        "verifiedOn": 6,
        "score": score,
        "vertices": [sample["A"], sample["B"], sample["C"]],
        "construction": "取锐角三角形 ABC，作其外接圆、内切圆、三条高与三边中点；再标出重心、外心、内心、垂心、九点圆心及常用特征点。",
    }


def generate_problems(seed=20261019, mode="mixed"):
    rng = random.Random(seed)
    samples = []
    for _ in range(6):
        A, B, C = random_triangle(rng)
        samples.append(tri_centers(A, B, C))
    base = all_relations(samples[0])
    candidates = []
    seen = set()
    for kind in ("collinear", "concyclic"):
        for names in base[kind]:
            if len(names) < (3 if kind == "collinear" else 4):
                continue
            if not all(relation_holds(s, kind, names) for s in samples[1:]):
                continue
            score, theorem, desc = score_relation(kind, names, base["metrics"], base["pts"])
            sig = (kind, tuple(names))
            if sig in seen:
                continue
            seen.add(sig)
            candidates.append(construct_candidate(kind, names, samples[0], score, theorem, desc))
    # add Euler-line metric identity / Feuerbach (always true and beautiful)
    m = samples[0]["_metrics"]
    extras = [
        {
            "id": "feuerbach", "title": "费尔巴哈定理", "statement": "证明九点圆与内切圆相切，并说明切点位置。",
            "kind": "tangent", "labels": ["N", "I", "Fe"], "theorem": "Feuerbach theorem",
            "difficulty": 5, "tags": ["九点圆", "内切圆", "相切", "费尔巴哈"], "hint": "用九点圆半径 R/2 与内切圆半径 r；可借助反演或位似。",
            "description": "九点圆与内切圆内切，与三个旁切圆外切。", "verifiedOn": 6, "score": 97,
            "vertices": [samples[0]["A"], samples[0]["B"], samples[0]["C"]],
            "construction": "取三角形 ABC，作外接圆、内切圆、三条高与三边中点。",
        },
        {
            "id": "euler-formula", "title": "欧拉公式", "statement": "证明 OI² = R(R − 2r)。",
            "kind": "identity", "labels": ["O", "I"], "theorem": "Euler's formula",
            "difficulty": 4, "tags": ["外心", "内心", "欧拉公式"], "hint": "计算 OI²，并利用 R、r 与半角公式。",
            "description": "外心—内心距离由外接圆半径与内切圆半径决定。", "verifiedOn": 6, "score": 92,
            "vertices": [samples[0]["A"], samples[0]["B"], samples[0]["C"]],
            "construction": "取三角形 ABC 及其外心 O、内心 I。",
        },
    ]
    candidates.extend(extras)
    # de-duplicate theorem families, keep variety
    candidates.sort(key=lambda c: (-c["score"], c["difficulty"]))
    out, families = [], set()
    for c in candidates:
        fam = c["theorem"] if c["theorem"] in ("九点圆", "欧拉线", "费尔巴哈定理", "欧拉公式", "奈格尔线", "九点圆心中点链") else c["title"]
        if fam in families:
            continue
        families.add(fam)
        out.append(c)
        if len(out) >= 6:
            break
    return out



# ---------------------------------------------------------------------------
# OCR + vision-model bridge
# ---------------------------------------------------------------------------
OCR_VENDOR = ROOT / ".vendor" / "ocr_min"
VISION_TIMEOUT = 600
PROOF_TIMEOUT = 900
# Default backend model credentials. The browser never receives this key.
DEFAULT_LLM_KEY = ""  # set via environment; not distributed
OPENCODE_INFERENCE = "https://opencode.ai/inference"
DEFAULT_VISION_MODEL = "deepseek-v4.1-flash"
DEFAULT_PROOF_MODEL = "deepseek-v4.1-flash"
DEFAULT_LLM_MODEL = "deepseek-v4.1-flash"
MINIHARNESS_URL = os.environ.get("MINIHARNESS_URL", "http://127.0.0.1:8000").rstrip("/")
MINIHARNESS_KEY_FILE = ROOT / ".secrets" / "miniharness_key"
PROOF_BACKEND = os.environ.get("PROOF_BACKEND", "miniharness")
PURE_SKILL_FILE = Path.home() / ".dsh" / "skills" / "pure-geometry" / "SKILL.md"


def llm_key() -> str:
    return os.environ.get("OPENCODE_API_KEY") or os.environ.get("LLM_API_KEY") or DEFAULT_LLM_KEY


def miniharness_key() -> str:
    key = os.environ.get("MINIHARNESS_API_KEY", "").strip()
    if key:
        return key
    try:
        return MINIHARNESS_KEY_FILE.read_text(encoding="utf-8").strip()
    except Exception:
        return ""


def pure_geometry_system() -> str:
    base = PURE_GEOMETRY_SYSTEM
    try:
        skill = PURE_SKILL_FILE.read_text(encoding="utf-8", errors="ignore")
        # Keep the operational rules and the visible process; the full skill is
        # larger than the harness system-message limit.
        marker = "## 0. Standing conventions"
        if marker in skill:
            skill = skill[skill.index(marker):]
        return (base + "\n\n[以下为 ~/none 纯几何 skill 的现场约束，必须遵守]\n" + skill)[:15500]
    except Exception:
        return base


def call_miniharness(system: str, prompt: str, max_tokens: int = 48000, timeout: int = PROOF_TIMEOUT,
                     model: str | None = None, images: list[str] | None = None, max_steps: int = 4) -> dict:
    key = miniharness_key()
    if not key:
        return {"ok": False, "error": "未配置 mini-harness API Key（.secrets/miniharness_key 或 MINIHARNESS_API_KEY）"}
    body = {
        # RunRequest.prompt is capped at 32k by the harness; keep one headroom
        # character so large repair prompts do not fail with HTTP 422.
        "prompt": prompt[:31000],
        "system": system[:16000],
        "max_steps": max(1, int(max_steps)),
        "temperature": 0.2,
        "max_tokens": min(131072, max_tokens),
        "model": model or os.environ.get("MINIHARNESS_MODEL") or "deepseek-flash",
    }
    if images:
        body["images"] = [{"url": u, "detail": "auto"} for u in images[:10]]
    req = urllib.request.Request(
        MINIHARNESS_URL + "/v1/agent/run",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")[:800]
        return {"ok": False, "error": f"mini-harness HTTP {e.code}: {detail}"}
    except Exception as e:
        return {"ok": False, "error": "mini-harness 请求失败：" + str(e)}
    return {
        "ok": True,
        "text": str(raw.get("output") or ""),
        "reasoning": "",
        "model": raw.get("model") or body.get("model"),
        "usage": raw.get("usage") or {},
        "elapsedMs": round((time.perf_counter() - t0) * 1000),
        "runId": raw.get("run_id"),
        "steps": raw.get("steps"),
        "backend": "miniharness",
    }


def call_anthropic(system: str, content, model: str, max_tokens: int = 6000, timeout: int = 300) -> dict:
    key = llm_key()
    if not key:
        return {"ok": False, "error": "后端未配置大模型 Key"}
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": content}],
    }
    req = urllib.request.Request(
        OPENCODE_INFERENCE + "/anthropic/v1/messages",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + key,
            "anthropic-version": "2023-06-01",
            "User-Agent": "GeoMind/1.0",
        },
    )
    t0 = time.perf_counter()
    try:
        with _LLM_SEM:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")[:700]
        return {"ok": False, "error": f"大模型 HTTP {e.code}: {detail}"}
    except Exception as e:
        return {"ok": False, "error": "大模型请求失败：" + str(e)}
    parts = []
    for block in raw.get("content", []):
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    text = "".join(parts).strip()
    if not text:
        return {"ok": False, "error": "大模型返回为空", "raw": raw}
    return {"ok": True, "text": text, "reasoning": reasoning, "model": model, "usage": raw.get("usage", {}), "elapsedMs": round((time.perf_counter() - t0) * 1000)}


def _image_bytes(data_url: str):
    if not isinstance(data_url, str) or not data_url.startswith("data:image/"):
        raise ValueError("需要 data:image/... 图片")
    raw = base64.b64decode(data_url.split(",", 1)[1], validate=False)
    if len(raw) > 12 * 1024 * 1024:
        raise ValueError("图片过大（上限 12 MB）")
    from PIL import Image
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    if max(img.size) > 2200:
        img.thumbnail((2200, 2200))
    return img


def _prepare_vision_image(data_url: str) -> str:
    img = _image_bytes(data_url)
    img.thumbnail((1600, 1600))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _get_ocr():
    global _OCR_ENGINE
    if _OCR_ENGINE is not None:
        return _OCR_ENGINE
    with _OCR_LOCK:
        if _OCR_ENGINE is not None:
            return _OCR_ENGINE
        if OCR_VENDOR.exists():
            sys.path.insert(0, str(OCR_VENDOR))
        from rapidocr_onnxruntime import RapidOCR
        _OCR_ENGINE = RapidOCR()
        return _OCR_ENGINE


def ocr_payload(payload: dict) -> dict:
    image = payload.get("image")
    if not image:
        return {"ok": False, "error": "缺少图片"}
    key = hashlib.sha256(str(image).encode("utf-8", "ignore")).hexdigest()
    cached = cache_get(_OCR_CACHE, key, ttl=3600)
    if cached is not None:
        return {**cached, "cached": True}
    try:
        img = _image_bytes(image)
    except Exception as e:
        return {"ok": False, "error": "图片解析失败：" + str(e)}
    t0 = time.perf_counter()
    try:
        engine = _get_ocr()
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            path = f.name
            img.save(path, format="PNG")
        try:
            result, _ = engine(path)
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass
        lines = []
        for row in result or []:
            if len(row) >= 3 and row[1]:
                lines.append({"text": str(row[1]), "confidence": float(row[2]), "box": row[0]})
        text = "\n".join(x["text"] for x in lines)
        text = (text.replace("Z∠", "∠").replace("ZP", "∠P").replace("△", "△")
                .replace("＜", "<").replace("＞", ">"))
        out = {
            "ok": True, "text": text, "lines": lines,
            "engine": "RapidOCR · local", "elapsedMs": round((time.perf_counter() - t0) * 1000),
            "cached": False,
        }
        cache_put(_OCR_CACHE, key, out)
        return out
    except Exception as e:
        return {"ok": False, "error": "本地 OCR 不可用：" + str(e), "hint": "安装 rapidocr_onnxruntime，或配置视觉大模型。"}


def call_chat(content, model: str = DEFAULT_LLM_MODEL, max_tokens: int = 6000, timeout: int = 300, thinking: str = "disabled") -> dict:
    """OpenCode Zen / OpenAI-compatible chat completion. All LLM traffic stays server-side."""
    key = llm_key()
    if not key:
        return {"ok": False, "error": "后端未配置大模型 Key"}
    body = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": max_tokens,
        "stream": False,
        "thinking": {"type": thinking},
    }
    if thinking == "enabled":
        body["reasoning_effort"] = "high"
    session = "ses_" + hashlib.sha256((key + str(time.time()) + str(random.random())).encode()).hexdigest()[:24]
    req = urllib.request.Request(
        OPENCODE_INFERENCE + "/openai/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + key,
            "User-Agent": "opencode/1.0",
            "x-opencode-session": session,
        },
    )
    t0 = time.perf_counter()
    try:
        with _LLM_SEM:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")[:900]
        return {"ok": False, "error": f"大模型 HTTP {e.code}: {detail}"}
    except Exception as e:
        return {"ok": False, "error": "大模型请求失败：" + str(e)}
    try:
        msg = raw["choices"][0]["message"]
        text = msg.get("content")
        if isinstance(text, list):
            text = "".join(x.get("text", "") for x in text if isinstance(x, dict))
        text = (text or "").strip()
        reasoning = (msg.get("reasoning_content") or "").strip()
    except Exception:
        text = ""
    if not text:
        return {"ok": False, "error": "大模型返回为空（可能达到 token 上限）", "raw": raw}
    return {"ok": True, "text": text, "reasoning": reasoning, "model": model, "usage": raw.get("usage", {}), "elapsedMs": round((time.perf_counter() - t0) * 1000)}


VISION_SYSTEM = r"""你是数学竞赛几何题的“构图解析器”。读取题目图片与文字，输出一个严格 JSON 对象，不要 Markdown，不要解释。
目标：把题面中的每一个点、线、圆和条件都变成几何引擎可以重建的构造，而不是只画一张像图。

【总原则】
1. 先读题，逐句列出所有点（含圆心、交点、切点、五心、弧中点、对称点、定长点、角条件点），再输出 construction；数组顺序必须满足依赖（被依赖的对象在前）。
2. 题面给了定义的点绝不能写成 free。凡出现“⊙X”，X 必须是已定义的点；凡出现“作△UVW 的外接圆⊙P”，P 必须是 triangleCenter(O, deps=[U,V,W])，同时建 circle threePoints(U,V,W) 并命名为 P 的圆。
3. 每个点尽量给 `coordinate`（整张图片归一化坐标，x 向右、y 向下，0..1）。它用于选择交点分支和核对位置，不要求精确。
4. 图中看起来像平行/垂直/等长/共圆，但题面没写的，不要添加。题面写了的，必须用构造或 constraints 表示。
5. construction 中引用的每个 lineXY / circleXYZ / 自定义标签都必须在本数组中先定义；不允许悬空依赖。
6. 只输出 JSON；所有字段名和 sub 名必须来自下面的构造字典。

【输出结构】
{
 "title":"短标题",
 "problem_text":"完整题面",
 "inventory":[{"name":"P","definition":"△DEF 的外接圆圆心（circumcenter D,E,F）"}],
 "points":[{"name":"D","kind":"foot","from":"A","to":["B","C"],"coordinate":[0.3,0.8]}],
 "segments":[["A","B"]],
 "lines":[["B","C"]],
 "circles":[{"name":"omega","through":["A","B","C"]}],
 "constraints":[],
 "construction":[],
 "goal":{"kind":"concyclic","points":["E","F","M","G"],"text":"证明…"}
}

【construction 字典】
点 point，`sub` 与 `deps`：
- free：deps=[]，用 at:[x,y]。
- midpoint：deps=[A,B]。
- foot：deps=[P, 线标签]，垂足。
- intersection：deps=[曲线1,曲线2]，曲线可以是 lineAB/segmentAB/circleABC 或 construction 中定义的标签；给 coordinate 选分支。
- pointOnLine：deps=[线标签]，t 可省略；给 coordinate。
- pointOnCircle：deps=[圆标签]，给 coordinate（引擎转成角度）。
- pointOnLineDistance：deps=[线, anchor, L1, L2]，点在线/射线上且 |P-anchor|=|L1L2|。
- pointOnCircleDistance：deps=[圆, anchor, L1, L2]。
- midpointArc：deps=[圆, B, C] 或 [圆, B, A, C]（A 表示弧 BAC 含 A）。
- reflectLine：deps=[P, 线标签]；reflectPoint：deps=[P, 中心]。
- triangleCenter：deps=[A,B,C]，centerKey 为 O/H/I/G/N/IA/IB/IC 之一；也可直接用 circumcenter/orthocenter/incenter/centroid/ninePointCenter deps=[A,B,C]。
- incircleTouch：deps=[A,B,C]，side:"BC" 指定在哪条边。
- tangentPoint：deps=[P, 圆]，从 P 向圆作切线的切点（P 在圆上时就是 P）。
- angleEqualOnCircle：deps=[圆, V, X, B, C, D]，在圆上找 P 使 ∠XV P = ∠BCD。
- angleEqualOnLine：deps=[线, A, C, O, B]，在线上找 E 使 ∠AEC=∠OEB。
- equalDistance：deps=[U,B,C,A]，在 CA 上找 P 使 CP=BU。
- ratioDistanceOnLine：deps=[X,B,C,A]，在直线 BC 上由 BX·AC=… 派生。
- parallelogramFourth：deps=[A,B,C]；equilateral：deps=[A,B]。
线 line/segment/ray/vector，`sub` 与 `deps`：
- through：deps=[A,B]。
- parallel：deps=[P, 基准线]；perp：deps=[P, 基准线]。
- perpbis：deps=[A,B]；bisector：deps=[A,V,C]（V 为顶点）。
- tangentAt：deps=[P, 圆]（P 在圆上）。
- tangentFrom：deps=[P, 圆]（P 在圆外）。
- isogonal：deps=[B,A,C,L]，L 过顶点 A，返回 L 关于 ∠BAC 平分线的对称线。
- radical：deps=[圆1,圆2]；polar：deps=[P,圆]。
圆 circle，`sub`：
- threePoints：deps=[A,B,C]。
- centerThrough：deps=[圆心, 圆上一点]。
- tangentAtPoint：deps=[A,B, 线]，过 A、B 且切该线于 A。
- diameter：deps=[A,B]；incircle：deps=[A,B,C]；ninePoint：deps=[A,B,C]。

【题面到构造的固定翻译】
- “AD⊥BC 于 D” → D=foot(A,lineBC)。
- “M 为 BC 中点” → midpoint(B,C)。
- “H 为垂心/O 外心/I 内心/G 重心/N 九点圆心” → triangleCenter deps=[A,B,C]。
- “E 为弧 BEC 中点” → midpointArc(外接圆,B,E,C)。
- “内切圆切 BC 于 E” → incircleTouch(A,B,C), side:"BC"。
- “K 关于 BC 的对称点” → reflectLine(K,lineBC)。
- “过 A 作⊙O 的切线” → line tangentAt(A,omega)，交点再由 intersection 得到。
- “以 A 为圆心、AH 为半径作圆” → circle centerThrough(A,H)。
- “以 M 为圆心、ME 为半径作圆” → circle centerThrough(M,E)。
- “⊙P 过 B 且交 AB 于 D” → circle centerThrough(P,B)，D=intersection(lineAB,该圆) 的另一点。
- “△AEF 的外接圆” → circle threePoints(A,E,F)；若写成“⊙P”，再加 P=triangleCenter(O,[A,E,F])。
- “⊙O 的弦 AB” → O 为圆心，A、B 在圆上：circle centerThrough(O,A)，B=pointOnCircle。
- “以 A 为圆心的⊙A 交 AB 于 F” → A 为自由圆心，F=intersection(lineAB, ⊙A)；圆半径可用一个自由辅助点或 M/N 条件确定，不要让 F 反过来定义圆。
- “∠AEC=∠BFC=90°” → 以 AC、BC 为直径的圆，E/F 是圆与 ⊙O 的交点（circle diameter(A,C)）。
- “∠BAD=∠BCD=90°”（两个直角共用斜边 BD）→ 先建 circle diameter(B,D)，A、C 都是该圆上的点；不要用普通 free 或四条互相垂直的线去凑。凡两个直角共用一条斜边，直角顶点都在以该斜边为直径的圆上。
- 多个点在同一个圆上时，先建圆，再把这些点写成 pointOnCircle；不要让每个点各自 free。
- “E、F 在（劣）弧 BC 上” → pointOnCircle(⊙O)，不要写成在线段 BC 上。
- “∠CAE=∠BAD” → AE=isogonal(B,A,C,AD)，E=intersection(AE,⊙O)。
- “BE=BA，延长 CB 到 E” → E=pointOnLineDistance(直线BC, B, B, A)，coordinate 选 B 的外侧。
- “CG=BD，G 在 BC 上” → G=pointOnLineDistance(直线BC, C, B, D)。
- “F 在射线 AE 上且 AF=AD” → F=pointOnLineDistance(直线AE, A, A, D)。
- “K 在 AC 上且 KM=KA” → M=pointOnLineDistance(直线AC, K, K, A)。
- “EF∥BD” → 先建 lineBD，再 F=intersection(parallel(E,lineBD), CD)。
- “NB⊥AB 且 N 在 EF 上” → N=intersection(lineEF, perp(B,lineAB))。
- “⊙P 与 ⊙Q 相切” → 圆心距约束交给 constraints circlesTangent；不要把切点写成 free。
- “一条不过 A、B、C、I 的直线 l 分别交 AI、BI、CI 于 D、E、F” → 先用两个 auxiliary 自由点 L1、L2 定义 lineL，再 D=intersection(lineAI,lineL)、E=intersection(lineBI,lineL)、F=intersection(lineCI,lineL)。**绝对不能用 D、E 反过来定义 l**，否则是循环依赖。
- “x 是 AD 的垂直平分线” → lineX=perpbis(A,D)；垂直关系是 lineX⊥AD，不要把由 x、y、z 围成的三角形的边 PQ 写成⊥AD。
- “ω 是角 A 内的旁切圆，D、E、F 分别是 ω 与 BC、CA、AB 的切点” → IA=triangleCenter(IA,[A,B,C])，ω=circle excircle deps=[A,B,C] index=0，D=foot(IA,lineBC)、E=foot(IA,lineCA)、F=foot(IA,lineAB)。切点绝不能写成 free，ω 也不能用 threePoints(D,E,F)。
- “内切圆切 BC 于 D”同理：I=triangleCenter(I,[A,B,C])，D=foot(I,lineBC) 或 incircleTouch side=BC。
- “AB = BC” → 让 C 落在以 B 为圆心、过 A 的圆上（circle centerThrough(B,A)，C=pointOnCircle），不要只写 equalLength 约束后把 A/B/C 都留成 free。
- “线段 AA₁、BB₁、CC₁ 有相同的垂直平分线” → 先建一条自由直线 l（两个 auxiliary 点），再 A₁=reflectLine(A,l)、B₁=reflectLine(B,l)、C₁=reflectLine(C,l)。这样三条线段的垂直平分线天然是同一条 l；不要把 A₁/B₁/C₁ 写成 free。
- “以 L 为圆心且与 AB、AC 相切的圆” → T=foot(L,lineAB)，ω=circle centerThrough(L,T)。不要写成 centerThrough(L,P)，否则 P 反过来依赖圆，形成循环。
- “延长 AI 交外接圆于 L” → L=intersection(lineAI,omega) 的第二个交点（不是 A），必须给 coordinate 让前端选分支。
- 结论写成“∠IPM=90°”时，goal 用 perpendicular，两条线是 PI 和 PM（顶点 P），不要写成 IM⊥MP。
- “X 是 BA 延长线上的点，使得 BX=AC” → X=pointOnLineDistance(lineBA, B, A, C)，anchor 是 B，长度取 AC；“Y 是边 CA 上的点，使得 CY=AB” → Y=pointOnLineDistance(lineCA, C, A, B)。不要把长度写成 BA/CA，否则 X/Y 会退回 A。
- “直线 XY 与 BC 的中垂线交于 P” → 是 XY 与 **BC 的垂直平分线** 的交点：P=intersection(lineXY, perpbis(B,C))，不是 perpbis(X,Y)∩BC。P 应在 BC 的 A 所在一侧。
- 结论“∠BPC+∠BAC=180°” → goal 用 angleSum，angles=[[B,P,C],[B,A,C]]，value=180。
- 任何直线都不能由它自己的交点来定义；圆也不能由它自己上面的交点来定义。遇到这种情况，先建两个 auxiliary 自由点作为直线/圆的骨架。

【约束】
只有无法用上述构造表达时才写 constraints；可写：
{"point":"P","kind":"equalLength","pairs":[["A","F"],["A","D"]]}
{"point":"P","kind":"equalAngle","angles":[["C","A","E"],["B","A","D"]]}
{"point":"P","kind":"onCircle","circle":"omega"}
{"point":"P","kind":"onLine","line":"lineBC"}
{"kind":"collinear","points":["D","K","M"]}
{"kind":"concyclic","points":["E","F","M","G"]}
{"kind":"perpendicular","lines":[["M","N"],["A","B"]]}
{"kind":"parallel","lines":[["E","F"],["B","D"]]}
{"kind":"circlesTangent","circles":["omega1","omega2"]}
如果某个点有约束但仍被写成 free，构图会被判定失败并返工。

【坐标与分支】
- triangle.coordinates 给三个顶点；所有点给 coordinate。
- 交点、圆上点、弧中点、切点、定长点必须给 coordinate，引擎据此选分支。
- 坐标系是整张图片，含页边距；不要把图形区域重新归一化。

【自检，输出前逐条检查】
1. 题面中出现的每个大写字母是否都有对应点？⊙O、⊙P 的圆心 O/P 是否也建了？
2. 每个有定义的点是否用了派生 sub，而不是 free？有冲突时以题面的“使得/满足”条件为准。
3. 每个 intersection 的两个依赖是否都是已经定义的线/圆（不是两个点）？
4. 每个 pointOnLine 是否依赖线标签（不是两个点）？
5. 所有 target/goal 的点是否都存在？
6. 没有把“弧上”“圆上”误写成线段上，没有把切线误写成半径。
只输出 JSON 对象，不要代码围栏。
"""

def vision_payload(payload: dict) -> dict:
    """Screenshot recognition through mini-harness (default: deepseek-flash, direct provider, thinking on)."""
    cfg = payload.get("config") or {}
    backend = str(cfg.get("backend") or os.environ.get("VISION_BACKEND") or "miniharness").lower()
    default_model = os.environ.get("VISION_HARNESS_MODEL") or os.environ.get("MINIHARNESS_MODEL") or "deepseek-flash"
    model = cfg.get("model") or (default_model if backend == "miniharness" else (os.environ.get("VISION_MODEL") or DEFAULT_VISION_MODEL))
    image = payload.get("image")
    text = payload.get("text") or ""
    if not image and not text.strip():
        return {"ok": False, "error": "缺少图片或题目文字"}
    hash_src = (backend + "|" + model + "|vision-v10|" + (image or "") + "|" + text).encode("utf-8", "ignore")
    keyhash = hashlib.sha256(hash_src).hexdigest()
    cached = cache_get(_VISION_CACHE, keyhash, ttl=1800)
    if cached is not None:
        return {**cached, "cached": True}
    user_text = "请解析这张几何题截图并输出构造 JSON。"
    if text.strip():
        user_text += "\n\n题目文字（如有 OCR 误差，请以图片为准并修正）：\n" + text.strip()
    prepared = None
    if image:
        try:
            prepared = _prepare_vision_image(image)
        except Exception as e:
            return {"ok": False, "error": "图片读取失败：" + str(e)}
    call_model = model
    if backend == "miniharness":
        r = call_miniharness(VISION_SYSTEM, user_text, max_tokens=96000, timeout=VISION_TIMEOUT,
                             model=model, images=[prepared] if prepared else None, max_steps=2)
        if not r.get("ok"):
            fallback = str(os.environ.get("VISION_DIRECT_FALLBACK", "0")) not in ("0", "false", "False", "no")
            if fallback:
                add_log("vision", status="fallback", model=model, backend="miniharness",
                        error=str(r.get("error") or "")[:1000],
                        note="mini-harness 失败，回退到直连视觉模型")
                call_model = os.environ.get("VISION_FALLBACK_MODEL") or DEFAULT_VISION_MODEL
                chat_content = [
                    {"type": "text", "text": VISION_SYSTEM + "\n\n" + user_text},
                    *([] if not prepared else [{"type": "image_url", "image_url": {"url": prepared}}]),
                ]
                r = call_chat(chat_content, model=call_model, max_tokens=32000, timeout=VISION_TIMEOUT)
    else:
        call_model = model
        chat_content = [
            {"type": "text", "text": VISION_SYSTEM + "\n\n" + user_text},
            *([] if not prepared else [{"type": "image_url", "image_url": {"url": prepared}}]),
        ]
        r = call_chat(chat_content, model=call_model, max_tokens=32000, timeout=VISION_TIMEOUT)
    if not r.get("ok"):
        # Empty/truncated responses are usually transient; one retry.
        time.sleep(1.0)
        if backend == "miniharness" and r.get("backend") != "direct":
            r = call_miniharness(VISION_SYSTEM, user_text, max_tokens=96000, timeout=VISION_TIMEOUT,
                                 model=model, images=[prepared] if prepared else None, max_steps=2)
        else:
            r = call_chat([
                {"type": "text", "text": VISION_SYSTEM + "\n\n" + user_text},
                *([] if not prepared else [{"type": "image_url", "image_url": {"url": prepared}}]),
            ], model=call_model, max_tokens=32000, timeout=VISION_TIMEOUT)
    if not r.get("ok"):
        add_log("vision", model=model, prompt=user_text[:12000], status="error", error=str(r.get("error") or "")[:4000],
                request=user_text[:30000], system_prompt=VISION_SYSTEM[:20000], response_raw=str(r.get("text") or "")[:30000],
                image={"present": bool(image), "chars": len(image or "")}, elapsedMs=r.get("elapsedMs", 0))
        return r
    txt = str(r.get("text") or "").strip()
    if not txt:
        rid = r.get("runId") or ""
        where = "mini-harness" if (r.get("backend") == "miniharness") else "直连模型"
        msg = f"{where} 返回为空" + (f"（runId {rid}）" if rid else "") + "；请到 mini-harness /admin/ui 查看该次调用正文"
        add_log("vision", model=r.get("model") or model, status="empty", error=msg,
                runId=rid, steps=r.get("steps"), backend=r.get("backend") or backend,
                request=user_text[:30000], system_prompt=VISION_SYSTEM[:20000],
                image={"present": bool(image), "chars": len(image or "")}, elapsedMs=r.get("elapsedMs", 0))
        return {"ok": False, "error": msg, "runId": rid, "backend": r.get("backend") or backend, "model": r.get("model") or model}
    if txt.startswith("```"):
        txt = txt.split("```", 2)[1]
        if txt.lstrip().startswith("json"):
            txt = txt.lstrip()[4:]
    a, b = txt.find("{"), txt.rfind("}")
    if a >= 0 and b > a:
        txt = txt[a:b + 1]
    try:
        data = json.loads(txt)
    except Exception as e:
        return {"ok": False, "error": "模型返回的不是合法 JSON：" + str(e), "raw": r["text"][:1500]}
    add_log("vision", model=model, phase=("repair" if "【修复任务" in user_text else "initial"), prompt=user_text[:12000], title=str(data.get("title") or ""),
            problem_text=str(data.get("problem_text") or "")[:8000],
            points=len(data.get("points") or []), point_names=[str(p.get("name") or "") for p in (data.get("points") or [])][:60],
            segments=len(data.get("segments") or []), goal=data.get("goal"),
            reasoning=str(r.get("reasoning") or "")[:30000],
            request=user_text[:30000], system_prompt=VISION_SYSTEM[:20000],
            response_raw=str(r.get("text") or "")[:30000],
            parsed_json=json.dumps(data, ensure_ascii=False)[:30000],
            image={"present": bool(image), "chars": len(image or "")},
            backend=r.get("backend") or backend, runId=r.get("runId"), steps=r.get("steps"),
            usage=r.get("usage"), elapsedMs=r.get("elapsedMs", 0), status="ok")
    out = {
        "ok": True, "data": data, "model": r.get("model") or model,
        "backend": r.get("backend") or backend, "runId": r.get("runId"), "steps": r.get("steps"),
        "elapsedMs": r.get("elapsedMs", 0), "cached": False,
    }
    cache_put(_VISION_CACHE, keyhash, out)
    return out



def _extract_json_object(text: str):
    """Best-effort extraction of a JSON object from an agent reply."""
    t = str(text or "").strip()
    if t.startswith("```"):
        try:
            t = t.split("```", 2)[1]
            if t.lstrip().startswith("json"):
                t = t.lstrip()[4:]
        except Exception:
            pass
    a, b = t.find("{"), t.rfind("}")
    if a < 0 or b <= a:
        raise ValueError("回复中没有 JSON 对象")
    return json.loads(t[a:b + 1])


VISION_REVIEW_SYSTEM = r"""你是数学竞赛几何题的“构图审查器”。你会收到：题目原文、当前 construction JSON、程序校验失败原因。
任务：在不改变题意的前提下修正构造，使前端几何引擎可以正确重建。
只输出一个 JSON 对象，不要 Markdown，不要解释。

要求：
1. 保留题目中的全部点；每个有定义的点必须用派生构造，不能写成 free。
2. 直线不能由它自己的交点定义；圆不能由它自己上面的交点定义。需要时先建两个 auxiliary 自由点作为骨架。
3. 交点必须依赖已经定义的线/圆；每个交点、圆上点、切点、弧中点给 coordinate（原图归一化坐标）。
4. 可用 point sub：free/midpoint/foot/intersection/pointOnLine/pointOnCircle/pointOnLineDistance/pointOnCircleDistance/midpointArc/reflectLine/triangleCenter/incircleTouch/angleEqualOnCircle；
   line sub：through/parallel/perp/perpbis/bisector/tangentAt/isogonal；
   circle sub：threePoints/centerThrough/diameter/incircle/excircle。
5. “AB=BC”优先把 C 放到以 B 为圆心、过 A 的圆上；“AA₁、BB₁、CC₁ 有相同垂直平分线”先建自由直线 l，再用 reflectLine。
6. “内切圆/旁切圆与三边切点”用 triangleCenter(I/IA) + foot，不能用 threePoints(切点) 代替圆。
7. 输出尽量紧凑：只输出 title、problem_text、construction、circles、goal；不要输出 inventory/points/segments。construction 必须完整，总长度控制在 10000 字符内。
"""
VISION_REVIEW_SYSTEM = VISION_REVIEW_SYSTEM.strip()


def vision_review_payload(payload: dict) -> dict:
    """Optional mini-harness review of a first-pass construction (text-only)."""
    text = str(payload.get("text") or "").strip()
    data = payload.get("data")
    issues = payload.get("issues") or []
    if not isinstance(data, dict):
        return {"ok": False, "error": "缺少构造 JSON"}
    if not miniharness_key():
        return {"ok": False, "error": "未配置 mini-harness Key（.secrets/miniharness_key）"}
    key_src = json.dumps({"text": text, "data": data, "issues": issues}, ensure_ascii=False, sort_keys=True).encode("utf-8", "ignore")
    keyhash = hashlib.sha256(key_src).hexdigest()
    cached = cache_get(_VISION_CACHE, "review:" + keyhash, ttl=600)
    if cached is not None:
        return {**cached, "cached": True}
    prompt = "【题目】\n" + (text or str(data.get("problem_text") or ""))
    prompt += "\n\n【当前 construction JSON】\n" + json.dumps(data, ensure_ascii=False)[:40000]
    if issues:
        prompt += "\n\n【程序校验失败原因】\n- " + "\n- ".join(str(x) for x in issues[:20])
    prompt += "\n\n请输出修正后的完整 JSON。只输出 construction/circles/goal，不要 inventory/points/segments，保持紧凑。"
    r = call_miniharness(VISION_REVIEW_SYSTEM, prompt, max_tokens=96000, timeout=600)
    if not r.get("ok"):
        add_log("vision_harness", status="error", error=str(r.get("error") or "")[:2000],
                request=prompt[:30000], system_prompt=VISION_REVIEW_SYSTEM[:12000], issues=issues[:30])
        return r
    raw1 = str(r.get("text") or "")
    try:
        revised = _extract_json_object(raw1)
        if not isinstance(revised, dict) or not (revised.get("construction") or revised.get("points")):
            raise ValueError("回复 JSON 中没有 construction/points")
    except Exception as e:
        # A long inventory often makes the agent truncate the JSON.  Retry once
        # asking for a compact construction-only object.
        retry_prompt = prompt + "\n\n【上一次输出被截断或不是合法 JSON】\n" + raw1[-3000:] + "\n\n请重新只输出一个紧凑、完整、合法的 JSON：字段只保留 construction、circles、goal，不要 inventory/points/segments；construction 数组每一项只保留必要字段。"
        r2 = call_miniharness(VISION_REVIEW_SYSTEM, retry_prompt, max_tokens=96000, timeout=600)
        if r2.get("ok"):
            raw2 = str(r2.get("text") or "")
            try:
                revised = _extract_json_object(raw2)
                if not isinstance(revised, dict) or not (revised.get("construction") or revised.get("points")):
                    raise ValueError("回复 JSON 中没有 construction/points")
                r = r2
                raw1 = raw2
            except Exception as e2:
                add_log("vision_harness", status="parse_error", error=str(e2)[:1000],
                        request=retry_prompt[:30000], system_prompt=VISION_REVIEW_SYSTEM[:12000],
                        response_raw=raw2[:30000], issues=issues[:30])
                return {"ok": False, "error": "mini-harness 返回的 JSON 无法解析：" + str(e2), "raw": raw2[:1500]}
        else:
            add_log("vision_harness", status="parse_error", error=str(e)[:1000],
                    request=prompt[:30000], system_prompt=VISION_REVIEW_SYSTEM[:12000],
                    response_raw=raw1[:30000], issues=issues[:30])
            return {"ok": False, "error": "mini-harness 返回的 JSON 无法解析：" + str(e), "raw": raw1[:1500]}
    out = {"ok": True, "data": revised, "model": "mini-harness", "elapsedMs": r.get("elapsedMs", 0), "cached": False}
    add_log("vision_harness", status="ok", model="mini-harness",
            request=prompt[:30000], system_prompt=VISION_REVIEW_SYSTEM[:12000],
            response_raw=raw1[:30000],
            parsed_json=json.dumps(revised, ensure_ascii=False)[:30000],
            issues=issues[:30], runId=r.get("runId"), steps=r.get("steps"), elapsedMs=r.get("elapsedMs", 0))
    cache_put(_VISION_CACHE, "review:" + keyhash, out)
    return out


PURE_GEOMETRY_SYSTEM = r"""你是数学奥林匹克平面几何证明专家。必须使用纯综合几何（synthetic geometry），不能使用坐标、向量、复数、重心/三线性坐标、解析几何、微积分或 CAS 计算。
允许：有向角 mod 180°、全等/相似（含反向相似）、圆内接角与四点共圆、切线-弦、圆幂、根轴、反射、半转、位似、旋转、螺旋相似、反演、正弦定理、角元塞瓦、斯特瓦尔特、梅涅劳斯、塞瓦、托勒密，以及标准构型（垂足三角形、九点圆、欧拉线、西姆松线、Miquel 点、等角线）。
禁止：余弦定理、把长度设成变量解方程、数值验证、残差、代入坐标、把计算说成证明。
证明必须逐步编号，每一步引用一个明确的定理/引理；辅助点/辅助圆必须定义；结论必须与题目完全一致。
同时给出一张纯几何辅助线图：只用点、线、圆、弧、直角/等角标记和字母标签，不要文字块、图例、步骤编号。

只输出一个 JSON 对象，不要 Markdown 代码围栏，不要额外解释。JSON 字段：
{
  "title": "短标题（纯文本）",
  "statement": "题目陈述（纯文本，可用 Unicode 数学符号）",
  "proof_markdown": "面向阅读的完整证明（Markdown，纯文本+Unicode 符号，不要 LaTeX 代码）",
  "proof_latex": "只含证明正文的 LaTeX 片段（可使用 $...$、\[...\]、enumerate，不要 documentclass/begin{document}）",
  "tikz": "可选的纯几何 TikZ 图形代码（只含 tikzpicture 内部命令，不含 documentclass/begin{document}）"
}
TikZ 规则：只能画题面明确给出的对象与关系；不得把一般四边形画成等腰梯形、平行四边形、正方形、菱形等特殊形。若题面没有足够信息或你不能保证图形忠实，必须把 tikz 设为空字符串；宁可不画，也不要臆造。"""


def _latex_escape(s: str) -> str:
    rep = {"\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}"}
    return "".join(rep.get(ch, ch) for ch in str(s))


def _strip_document(tex: str) -> str:
    t = str(tex or "").strip()
    if "\\begin{document}" in t:
        t = t.split("\\begin{document}", 1)[1]
    if "\\end{document}" in t:
        t = t.rsplit("\\end{document}", 1)[0]
    return t.strip()


def _compile_proof_pdf(title: str, statement: str, body: str, tikz: str, image_data: str = "") -> tuple[bytes | None, str]:
    tex_bin = Path.home() / "texlive" / "2026" / "bin" / "x86_64-linux"
    xelatex = tex_bin / "xelatex"
    if not xelatex.exists():
        return None, "未找到 xelatex"
    t = _strip_document(body)
    fig = ""
    z = _strip_document(tikz)
    img_name = ""
    if z:
        if "\\begin{tikzpicture}" not in z:
            z = "\\begin{tikzpicture}[scale=.9]\n" + z + "\n\\end{tikzpicture}"
        fig = "\\begin{center}\n" + z + "\n\\end{center}\n"
    elif image_data:
        try:
            from PIL import Image
            raw = base64.b64decode(str(image_data).split(",", 1)[1])
            im = Image.open(io.BytesIO(raw)).convert("RGB")
            im.thumbnail((1100, 900))
            img_name = "figure.jpg"
            # Save later in the temporary build directory.
            fig = "\\begin{center}\\includegraphics[width=.72\\textwidth]{figure.jpg}\\end{center}\n"
        except Exception:
            img_name = ""
    doc = r"""\documentclass[UTF8,11pt,fontset=fandol]{ctexart}
\usepackage[a4paper,margin=2.2cm]{geometry}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{graphicx}
\usepackage{tikz}
\usepackage[hidelinks]{hyperref}
\setlength{\parindent}{2em}
\setlength{\parskip}{.35em}
\title{%s}
\author{}
\date{}
\begin{document}
\maketitle
\section*{题目}
%s
\section*{证明}
%s
%s
\end{document}
""" % (_latex_escape(title or "几何证明"), _latex_escape(statement or ""), t, fig)
    work = ROOT / ".proofs"
    work.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="proof-", dir=str(work)) as td:
        tex_path = Path(td) / "proof.tex"
        if img_name and image_data:
            try:
                from PIL import Image
                raw = base64.b64decode(str(image_data).split(",", 1)[1])
                im = Image.open(io.BytesIO(raw)).convert("RGB")
                im.thumbnail((1100, 900))
                im.save(Path(td) / img_name, format="JPEG", quality=90)
            except Exception:
                pass
        tex_path.write_text(doc, encoding="utf-8")
        env = dict(os.environ)
        env["PATH"] = str(tex_bin) + os.pathsep + env.get("PATH", "")
        result = subprocess.run(
            [str(xelatex), "-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "proof.tex"],
            cwd=td, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=150,
        )
        pdf_path = Path(td) / "proof.pdf"
        if result.returncode == 0 and pdf_path.exists():
            return pdf_path.read_bytes(), ""
        log = (Path(td) / "proof.log")
        detail = log.read_text(encoding="utf-8", errors="ignore")[-1800:] if log.exists() else result.stdout.decode("utf-8", "ignore")[-1800:]
        return None, "PDF 编译失败：" + detail


def proof_payload(payload: dict) -> dict:
    problem = str(payload.get("problem_text") or "").strip()
    goal = payload.get("goal") or {}
    geometry = payload.get("geometry") or ""
    model = str(payload.get("model") or os.environ.get("PROOF_MODEL") or DEFAULT_PROOF_MODEL)
    if not problem and not goal.get("statement") and not geometry:
        return {"ok": False, "error": "缺少题目、目标或图形信息"}
    t0 = time.perf_counter()
    key_src = json.dumps({"problem": problem, "goal": goal, "geometry": geometry, "model": model, "thinking": "enabled", "backend": PROOF_BACKEND}, ensure_ascii=False, sort_keys=True)
    keyhash = hashlib.sha256(key_src.encode("utf-8", "ignore")).hexdigest()
    cached = cache_get(_PROOF_CACHE, keyhash, ttl=86400)
    if cached is not None:
        return {**cached, "cached": True}
    user = "请为下面的平面几何题给出完整的纯几何证明，并返回规定 JSON。\n\n"
    if problem:
        user += "题目原文：\n" + problem + "\n\n"
    if goal.get("statement") or goal.get("title"):
        user += "待证目标：\n" + str(goal.get("statement") or goal.get("title")) + "\n\n"
    if geometry:
        user += "当前画板对象/构造摘要：\n" + str(geometry)[:12000] + "\n\n"
    user += "请特别注意：不得使用坐标、向量、解析法或数值验证；证明必须能由阅卷人按步骤检查。"
    image = payload.get("image")
    # The proof prompt is text/construction based; the canvas image is used only
    # as the PDF fallback figure, so we do not pay to resend it to the model.
    if PROOF_BACKEND == "miniharness":
        system = pure_geometry_system()
        r = call_miniharness(system, user)
        model = "mini-harness"
    else:
        r = call_chat([{"type": "text", "text": PURE_GEOMETRY_SYSTEM + "\n\n" + user}], model=model, max_tokens=48000, timeout=PROOF_TIMEOUT, thinking="enabled")
        if not r.get("ok") and "token" in str(r.get("error", "")).lower():
            r = call_chat([{"type": "text", "text": PURE_GEOMETRY_SYSTEM + "\n\n" + user}], model=model, max_tokens=64000, timeout=PROOF_TIMEOUT, thinking="enabled")
    if not r.get("ok"):
        add_log("vision", model=model, prompt=user_text[:12000], status="error", error=str(r.get("error") or "")[:4000],
                request=user_text[:30000], system_prompt=VISION_SYSTEM[:20000], response_raw=str(r.get("text") or "")[:30000],
                image={"present": bool(image), "chars": len(image or "")}, elapsedMs=r.get("elapsedMs", 0))
        return r
    txt = str(r.get("text") or "").strip()
    if not txt:
        rid = r.get("runId") or ""
        where = "mini-harness" if (r.get("backend") == "miniharness") else "直连模型"
        msg = f"{where} 返回为空" + (f"（runId {rid}）" if rid else "") + "；请到 mini-harness /admin/ui 查看该次调用正文"
        add_log("vision", model=r.get("model") or model, status="empty", error=msg,
                runId=rid, steps=r.get("steps"), backend=r.get("backend") or backend,
                request=user_text[:30000], system_prompt=VISION_SYSTEM[:20000],
                image={"present": bool(image), "chars": len(image or "")}, elapsedMs=r.get("elapsedMs", 0))
        return {"ok": False, "error": msg, "runId": rid, "backend": r.get("backend") or backend, "model": r.get("model") or model}
    if txt.startswith("```"):
        txt = txt.split("```", 2)[1]
        if txt.lstrip().startswith("json"):
            txt = txt.lstrip()[4:]
    a, b = txt.find("{"), txt.rfind("}")
    if a >= 0 and b > a:
        txt = txt[a:b + 1]
    try:
        data = json.loads(txt)
    except Exception as e:
        return {"ok": False, "error": "模型证明不是合法 JSON：" + str(e), "raw": r["text"][:2000]}
    data.setdefault("title", goal.get("title") or "几何证明")
    data.setdefault("statement", goal.get("statement") or problem)
    data.setdefault("proof_markdown", "")
    data.setdefault("proof_latex", "")
    data.setdefault("tikz", "")
    use_tikz = os.environ.get("PROOF_TIKZ", "0") == "1"
    pdf_bytes, pdf_err = _compile_proof_pdf(data.get("title", ""), data.get("statement", ""), data.get("proof_latex") or "", (data.get("tikz") or "") if use_tikz else "", image or "")
    if not pdf_bytes and data.get("tikz"):
        # A malformed optional figure must not destroy an otherwise valid proof.
        pdf_bytes, pdf_err = _compile_proof_pdf(data.get("title", ""), data.get("statement", ""), data.get("proof_latex") or "", "", image or "")
    if not pdf_bytes and data.get("proof_markdown"):
        # Last-resort PDF: plain proof text (keeps the download useful even if the model's LaTeX is imperfect).
        paras = [p.strip() for p in str(data.get("proof_markdown") or "").split("\n\n") if p.strip()]
        fallback = "\n\n".join(_latex_escape(p).replace("\n", "\\\\\n") for p in paras)
        pdf_bytes, pdf_err = _compile_proof_pdf(data.get("title", ""), data.get("statement", ""), fallback, "", image or "")
    add_log("proof", model=model, backend=PROOF_BACKEND, steps=r.get("steps"), runId=r.get("runId"), problem=problem[:4000], title=str(data.get("title") or ""),
            reasoning=str(r.get("reasoning") or "")[:16000],
            proof=str(data.get("proof_markdown") or "")[:8000],
            pdf=bool(pdf_bytes), pdfError=(pdf_err or "")[:800], status="ok",
            elapsedMs=round((time.perf_counter() - t0) * 1000))
    out = {
        "ok": True, "data": data, "model": model,
        "pdf": base64.b64encode(pdf_bytes).decode("ascii") if pdf_bytes else None,
        "pdfName": "geomind-proof.pdf" if pdf_bytes else None,
        "pdfError": pdf_err if not pdf_bytes else "",
        "elapsedMs": r.get("elapsedMs", 0), "usage": r.get("usage", {}), "cached": False,
    }
    cache_put(_PROOF_CACHE, keyhash, out)
    return out


def start_proof_job(payload: dict) -> str:
    job_id = hashlib.sha256((json.dumps(payload, ensure_ascii=False, sort_keys=True) + str(time.time())).encode("utf-8", "ignore")).hexdigest()[:20]
    with _PROOF_JOBS_LOCK:
        _PROOF_JOBS[job_id] = {"status": "running", "created": time.time(), "result": None}
    def run():
        try:
            result = proof_payload(payload)
        except Exception as e:
            result = {"ok": False, "error": "证明任务异常：" + str(e)}
        with _PROOF_JOBS_LOCK:
            _PROOF_JOBS[job_id] = {"status": "done", "created": time.time(), "result": result}
    add_log("proof_job", jobId=job_id, status="started", problem=str(payload.get("problem_text") or "")[:3000])
    threading.Thread(target=run, daemon=True).start()
    return job_id


def proof_job_status(job_id: str) -> dict:
    with _PROOF_JOBS_LOCK:
        job = _PROOF_JOBS.get(job_id)
        if not job:
            return {"ok": False, "error": "任务不存在或已过期"}
        if job["status"] == "done":
            return {"ok": True, "status": "done", "result": job["result"]}
        return {"ok": True, "status": "running", "elapsedMs": round((time.time() - job["created"]) * 1000)}


def figure_pdf_payload(payload: dict) -> dict:
    title = str(payload.get("title") or "GeoMind figure")
    image = payload.get("image")
    if not image:
        return {"ok": False, "error": "缺少画板截图"}
    pdf, err = _compile_proof_pdf(title, "", "", "", image)
    if not pdf:
        return {"ok": False, "error": err or "PDF 编译失败"}
    return {"ok": True, "pdf": base64.b64encode(pdf).decode("ascii"), "pdfName": "geomind-figure.pdf"}


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = "GeoMind/" + VERSION
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        try:
            print(f"[{time.strftime('%H:%M:%S')}] {self.address_string()} {fmt % args}", flush=True)
        except Exception:
            pass

    def _send(self, status, body: bytes, ctype="application/json; charset=utf-8", cache="no-store", extra=None):
        if self._accepts_gzip() and len(body) > 900 and ctype.startswith(("application/json", "text/", "image/svg")):
            body = gzip.compress(body, 6)
            encoding = "gzip"
        else:
            encoding = None
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        if encoding:
            self.send_header("Content-Encoding", encoding)
            self.send_header("Vary", "Accept-Encoding")
        if extra:
            for k, v in extra.items():
                self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _json(self, status, obj, cache="no-store"):
        self._send(status, json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), cache=cache)

    def _accepts_gzip(self):
        return "gzip" in (self.headers.get("Accept-Encoding") or "")

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            return None
        data = self.rfile.read(length)
        try:
            return json.loads(data.decode("utf-8"))
        except Exception:
            return None

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path == "/api/health":
            return self._json(200, {
                "ok": True, "version": VERSION, "engine": "GeoMind local kernel",
                "precision": "50 dps", "uptime": round(time.time() - STARTED, 1),
                "python": os.sys.version.split()[0], "mpmath": mp.__version__,
                "cache": {"verify": len(_VERIFY_CACHE), "generate": len(_GENERATE_CACHE), "ocr": len(_OCR_CACHE), "vision": len(_VISION_CACHE), "proof": len(_PROOF_CACHE), "logs": len(_LOG_ENTRIES)},
                "ocr": (OCR_VENDOR.exists() or bool(os.environ.get("RAPIDOCR"))),
                "vision": bool(llm_key()) or bool(miniharness_key()),
                "visionBackend": os.environ.get("VISION_BACKEND", "miniharness"),
                "visionModel": os.environ.get("VISION_HARNESS_MODEL") or os.environ.get("MINIHARNESS_MODEL") or "deepseek-flash",
                "visionMaxTokens": 96000, "visionTimeoutSeconds": VISION_TIMEOUT,
                "proof": bool(miniharness_key()) if PROOF_BACKEND == "miniharness" else bool(llm_key()),
                "proofBackend": PROOF_BACKEND,
                "harnessConfigured": bool(miniharness_key()),
            })
        if path == "/api/generate":
            return self._json(405, {"ok": False, "error": "请使用 POST"})
        if path == "/api/proof/status":
            q = parse_qs(urlparse(self.path).query)
            job_id = (q.get("job") or [""])[0]
            return self._json(200, proof_job_status(job_id))
        if path == "/api/logs":
            q = parse_qs(urlparse(self.path).query)
            try: limit = max(1, min(80, int((q.get("limit") or ["60"])[0])))
            except Exception: limit = 60
            return self._json(200, {"ok": True, "logs": get_logs(limit)})
        return self._static(path)

    def do_HEAD(self):
        return self.do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/verify":
            payload = self._read_json()
            if payload is None:
                return self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            key = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            cached = cache_get(_VERIFY_CACHE, key, ttl=600)
            if cached is not None:
                cached = dict(cached)
                cached["cached"] = True
                return self._json(200, cached)
            t0 = time.perf_counter()
            try:
                result = verify_payload(payload)
                result["elapsedMs"] = round((time.perf_counter() - t0) * 1000, 2)
                result["cached"] = False
                cache_put(_VERIFY_CACHE, key, result)
                return self._json(200, result)
            except Exception as e:
                return self._json(500, {"ok": False, "error": str(e)})
        if parsed.path == "/api/generate":
            payload = self._read_json() or {}
            seed = payload.get("seed") or int(time.time() * 1000) % 100000000
            try:
                seed = int(seed)
            except Exception:
                seed = 20261019
            mode = payload.get("mode") or "mixed"
            key = f"{seed}:{mode}"
            cached = cache_get(_GENERATE_CACHE, key, ttl=1800)
            if cached is None:
                try:
                    cached = generate_problems(seed, mode)
                    cache_put(_GENERATE_CACHE, key, cached)
                except Exception as e:
                    return self._json(500, {"ok": False, "error": str(e)})
            return self._json(200, {"ok": True, "seed": seed, "problems": cached, "cached": cached is not None})
        if parsed.path == "/api/ocr":
            payload = self._read_json()
            if payload is None:
                return self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            try:
                return self._json(200, ocr_payload(payload))
            except Exception as e:
                return self._json(500, {"ok": False, "error": str(e)})
        if parsed.path == "/api/complex/symbolic":
            payload = self._read_json()
            if payload is None:
                return self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            try:
                state = payload.get("state")
                if isinstance(state, str):
                    state = json.loads(state)
                objects = state.get("objects") if isinstance(state, dict) else None
                if not isinstance(objects, list):
                    return self._json(400, {"ok": False, "error": "缺少画板 objects"})
                result = symbolic_prove(objects, payload.get("goal") or {})
                return self._json(200, result)
            except Exception as e:
                return self._json(500, {"ok": False, "error": "符号证明异常：" + str(e)})
        if parsed.path == "/api/client-log":
            payload = self._read_json()
            if payload is None:
                return self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            client_log(str(payload.get("kind") or "client"), status=str(payload.get("status") or ""),
                       title=str(payload.get("title") or "")[:200],
                       errors=payload.get("errors") if isinstance(payload.get("errors"), list) else [],
                       detail=str(payload.get("detail") or "")[:3000])
            return self._json(200, {"ok": True})
        if parsed.path == "/api/figure/pdf":
            payload = self._read_json()
            if payload is None:
                return self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            try:
                return self._json(200, figure_pdf_payload(payload))
            except Exception as e:
                return self._json(500, {"ok": False, "error": "图 PDF 生成异常：" + str(e)})
        if parsed.path == "/api/proof/start":
            payload = self._read_json()
            if payload is None:
                return self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            try:
                return self._json(200, {"ok": True, "jobId": start_proof_job(payload)})
            except Exception as e:
                return self._json(500, {"ok": False, "error": str(e)})
        if parsed.path == "/api/proof":
            payload = self._read_json()
            if payload is None:
                return self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            try:
                return self._json(200, proof_payload(payload))
            except Exception as e:
                return self._json(500, {"ok": False, "error": str(e)})
        if parsed.path == "/api/vision":
            payload = self._read_json()
            if payload is None:
                return self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            try:
                return self._json(200, vision_payload(payload))
            except Exception as e:
                return self._json(500, {"ok": False, "error": str(e)})
        if parsed.path == "/api/vision/review":
            payload = self._read_json()
            if payload is None:
                return self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            try:
                return self._json(200, vision_review_payload(payload))
            except Exception as e:
                return self._json(500, {"ok": False, "error": str(e)})
        if parsed.path == "/api/solve":
            # Friendly alias for integrations: verify + backend synthetic hints.
            payload = self._read_json()
            if payload is None:
                return self._json(400, {"ok": False, "error": "请求体不是合法 JSON"})
            try:
                return self._json(200, verify_payload(payload))
            except Exception as e:
                return self._json(500, {"ok": False, "error": str(e)})
        return self._json(404, {"ok": False, "error": "未知 API"})

    def _static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        if path.startswith("/ref/") or path.startswith("/test/") or path.startswith("/."):
            return self._json(404, {"ok": False, "error": "Not found"})
        rel = path.lstrip("/")
        target = (ROOT / rel).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            return self._json(403, {"ok": False, "error": "Forbidden"})
        if not target.exists() or not target.is_file():
            if not path.startswith("/api/"):
                # SPA fallback for friendly routes
                target = ROOT / "index.html"
            else:
                return self._json(404, {"ok": False, "error": "Not found"})
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if target.suffix == ".js":
            ctype = "text/javascript; charset=utf-8"
        elif target.suffix in (".css",):
            ctype = "text/css; charset=utf-8"
        elif target.suffix in (".html",):
            ctype = "text/html; charset=utf-8"
        elif target.suffix in (".json", ".geojson"):
            ctype = "application/json; charset=utf-8"
        elif target.suffix == ".svg":
            ctype = "image/svg+xml"
        try:
            body = target.read_bytes()
        except OSError:
            return self._json(500, {"ok": False, "error": "读取静态文件失败"})
        cache = "no-cache" if (target.name == "index.html" or target.suffix in (".js", ".css")) else "public, max-age=3600"
        return self._send(200, body, ctype=ctype, cache=cache)


def main():
    import argparse
    ap = argparse.ArgumentParser(description="GeoMind geometry workbench")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=4173)
    args = ap.parse_args()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    srv.daemon_threads = True
    print(f"GeoMind v{VERSION} → http://{args.host}:{args.port}", flush=True)
    print(f"root: {ROOT}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
