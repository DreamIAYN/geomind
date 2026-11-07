/* ==========================================================================
   GeoMind · relation discovery engine
   Pure functions. Runs in the UI thread and inside relations-worker.js.
   ========================================================================== */
import {
  dist, mid, dist2, cross, sub, dot, norm, perp, len, angleAt, fmt,
} from './geometry.js';

const CATEGORY = {
  collinear: '共线', concyclic: '共圆', parallel: '平行', perpendicular: '垂直',
  concurrent: '共点', equalLength: '等长', equalAngle: '等角', midpoint: '中点',
  tangent: '相切', ratio: '比例', identity: '恒等式', center: '特征点', similar: '相似',
};

const BASE = {
  center: 92, identity: 84, tangent: 78, concurrent: 76, concyclic: 72,
  equalAngle: 66, ratio: 62, collinear: 58, parallel: 48, perpendicular: 50,
  equalLength: 44, midpoint: 42, similar: 64,
};

function ctxPoint(id) { return null; }

export function buildSnapshot(state) {
  const points = [];
  const index = new Map();
  state.objects.forEach((o, i) => {
    if (o.type === 'point' && o.valid && o.visible) {
      const p = {
        id: o.id, label: o.label || '?', x: o.g.x, y: o.g.y,
        kind: o.sub, centerKey: o.centerKey || null, order: i,
        color: o.style?.color || null, triangle: o.meta?.triangle || null,
      };
      points.push(p); index.set(o.id, p);
    }
  });
  const lines = [];
  state.objects.forEach((o, i) => {
    if (['line', 'segment', 'ray', 'vector'].includes(o.type) && o.valid && o.visible) {
      const members = points.filter((p) => {
        const t = dot(sub(p, o.g.a), o.g.d);
        if (o.type === 'segment' && (t < -1e-6 || t > o.g.len + 1e-6)) return false;
        if (o.type === 'ray' && t < -1e-6) return false;
        return Math.abs(cross(sub(p, o.g.a), o.g.d)) < 1e-6;
      }).map((p) => p.id);
      lines.push({
        id: o.id, label: o.label || '', type: o.type, sub: o.sub, order: i,
        a: { x: o.g.a.x, y: o.g.a.y }, d: { x: o.g.d.x, y: o.g.d.y },
        len: o.g.len, members, p1: o.deps[0], p2: o.deps[1],
        color: o.style?.color || null,
      });
    }
  });
  const circles = [];
  state.objects.forEach((o, i) => {
    if (o.type === 'circle' && o.valid && o.visible) {
      circles.push({
        id: o.id, label: o.label || '', order: i,
        center: { x: o.g.center.x, y: o.g.center.y }, r: o.g.r,
        centerId: o.deps[0] || null, sub: o.sub,
        color: o.style?.color || null,
      });
    }
  });
  const triangles = [];
  const virtualPoints = {};
  state.objects.forEach((o, i) => {
    if (o.type === 'triangle' && o.valid && o.g) {
      const m = o.g.metrics;
      const vids = o.deps;
      const vertexLabels = vids.map((id) => index.get(id)?.label || '?');
      const centerLabels = {};
      for (const [k, id] of Object.entries(o.centers || {})) {
        const p = index.get(id); if (p) centerLabels[k] = p.label;
      }
      const vp = {
        [`${o.id}:Ma`]: { label: 'Ma', x: m.Ma.x, y: m.Ma.y },
        [`${o.id}:Mb`]: { label: 'Mb', x: m.Mb.x, y: m.Mb.y },
        [`${o.id}:Mc`]: { label: 'Mc', x: m.Mc.x, y: m.Mc.y },
        [`${o.id}:D`]: { label: 'D', x: m.feet.D.x, y: m.feet.D.y },
        [`${o.id}:E`]: { label: 'E', x: m.feet.E.x, y: m.feet.E.y },
        [`${o.id}:F`]: { label: 'F', x: m.feet.F.x, y: m.feet.F.y },
        [`${o.id}:MA`]: { label: 'MA', x: (m.centers.A?.x ?? 0), y: 0 },
        [`${o.id}:MB`]: { label: 'MB', x: 0, y: 0 },
        [`${o.id}:MC`]: { label: 'MC', x: 0, y: 0 },
      };
      // AH/BH/CH midpoints
      const pObj = (id) => state.objects.find((x) => x.id === id);
      const pA = pObj(o.deps[0])?.g, pB = pObj(o.deps[1])?.g, pC = pObj(o.deps[2])?.g;
      if (pA && pB && pC && m.centers.H) {
        vp[`${o.id}:MA`] = { label: 'MA', x: (pA.x + m.centers.H.x) / 2, y: (pA.y + m.centers.H.y) / 2 };
        vp[`${o.id}:MB`] = { label: 'MB', x: (pB.x + m.centers.H.x) / 2, y: (pB.y + m.centers.H.y) / 2 };
        vp[`${o.id}:MC`] = { label: 'MC', x: (pC.x + m.centers.H.x) / 2, y: (pC.y + m.centers.H.y) / 2 };
      }
      Object.assign(virtualPoints, vp);
      triangles.push({
        id: o.id, order: i, vertexIds: vids, vertexLabels, centerLabels, virtualPoints: vp,
        metrics: {
          a: m.a, b: m.b, c: m.c, A: m.A, B: m.B, C: m.C, area: m.area,
          R: m.R, r: m.r, s: m.s, type: m.type,
          centers: m.centers, feet: m.feet, Ma: m.Ma, Mb: m.Mb, Mc: m.Mc,
          exradii: m.exradii,
        },
        show: o.show || {},
      });
    }
  });
  return { points, lines, circles, triangles, virtualPoints, scale: snapshotScale(points) };
}

function snapshotScale(points) {
  if (!points.length) return 1;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

export function runDetection(snapshot, options = {}) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const active = new Set(options.categories || Object.keys(CATEGORY));
  const tol = Math.max(1e-7, snapshot.scale * 1e-6);
  const ctx = {
    snap: snapshot, tol,
    points: snapshot.points.filter((p) => p.visible !== false),
    lines: snapshot.lines.filter((l) => l.visible !== false),
    circles: snapshot.circles.filter((c) => c.visible !== false),
    triangles: snapshot.triangles || [],
    scale: snapshot.scale,
    out: [], seen: new Set(),
  };
  ctx.pointMap = new Map(ctx.points.map((p) => [p.id, p]));
  ctx.lineMap = new Map(ctx.lines.map((l) => [l.id, l]));
  ctx.circleMap = new Map(ctx.circles.map((c) => [c.id, c]));

  if (active.has('collinear')) detectCollinear(ctx);
  if (active.has('concyclic')) detectConcyclic(ctx);
  if (active.has('parallel')) detectParallel(ctx);
  if (active.has('perpendicular')) detectPerpendicular(ctx);
  if (active.has('concurrent')) detectConcurrent(ctx);
  if (active.has('equalLength')) detectEqualLengths(ctx);
  if (active.has('equalAngle')) detectEqualAngles(ctx);
  if (active.has('midpoint')) detectMidpoints(ctx);
  if (active.has('tangent')) detectTangency(ctx);
  if (active.has('center')) detectTriangleTheorems(ctx);

  // Rank: score first, then shallow object order, then shorter statement.
  const results = ctx.out.sort((a, b) => b.score - a.score || a.order - b.order || a.statement.length - b.statement.length);
  const max = options.max || 220;
  return {
    relations: results.slice(0, max),
    total: results.length,
    ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
    categories: [...active],
  };
}

function keyOf(kind, ids) { return kind + ':' + [...ids].sort().join('|'); }
function push(ctx, rel) {
  const key = keyOf(rel.kind, rel.ids || rel.points || rel.lines || rel.circles || []);
  if (ctx.seen.has(key)) return;
  ctx.seen.add(key);
  rel.id = key;
  rel.score = Math.max(1, Math.min(99, Math.round(rel.score)));
  rel.confidence = rel.confidence ?? 0.99;
  rel.order = rel.order ?? 99;
  ctx.out.push(rel);
}
function category(kind) { return CATEGORY[kind] || kind; }
function nameList(arr) { return arr.join('、'); }
function pts2(ctx, ids) { return ids.map((id) => ctx.pointMap.get(id)).filter(Boolean); }
function pLabels(ctx, ids) { return pts2(ctx, ids).map((p) => p.label); }
function important(p) { return p.centerKey || ['A', 'B', 'C'].includes(p.label); }

function detectCollinear(ctx) {
  const pts = ctx.points;
  if (pts.length < 3) return;
  const sets = new Map();
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j];
    const d = sub(b, a), L = len(d);
    if (L < ctx.tol) continue;
    const u = { x: d.x / L, y: d.y / L };
    const on = pts.filter((p) => Math.abs(cross(sub(p, a), u)) < ctx.tol);
    if (on.length < 3) continue;
    const ids = on.map((p) => p.id).sort();
    sets.set(ids.join('|'), on);
  }
  const all = [...sets.values()].sort((a, b) => b.length - a.length);
  const kept = [];
  for (const set of all) {
    if (kept.some((big) => set.every((p) => big.includes(p)))) continue;
    kept.push(set);
  }
  for (const set of kept) {
    const ids = set.map((p) => p.id);
    const labels = set.map((p) => p.label);
    const centerKeys = set.map((p) => p.centerKey).filter(Boolean);
    const hasEuler = centerKeys.includes('O') && centerKeys.includes('G') && centerKeys.includes('H');
    const hasNine = centerKeys.includes('N');
    let score = 48 + Math.min(10, set.length * 2);
    let theorem = null, title = '三点共线';
    if (hasEuler) {
      score = 98; theorem = 'Euler line';
      title = hasNine ? '欧拉线 · 四心共线' : '欧拉线';
    }
    if (set.every((p) => ctx.lines.some((l) => l.members.includes(p.id)))) score -= 7;
    push(ctx, {
      kind: 'collinear', category: category('collinear'), title,
      statement: `${nameList(labels)} 共线${theorem ? '（' + theorem + '）' : ''}`,
      points: labels, ids, score, theorem,
      detail: theorem === 'Euler line' ? '外心、重心、垂心共线，且 OG : GH = 1 : 2。' : '数值残差低于 1e−7，可由梅涅劳斯、坐标或角度追踪验证。',
      evidence: `共线残差 ${Math.max(...set.map((p) => Math.abs(cross(sub(p, set[0]), sub(set[1], set[0])) / Math.max(1e-12, len(sub(set[1], set[0])))))).toExponential(2)}`,
      order: Math.min(...set.map((p) => p.order)),
    });
  }
}

function detectConcyclic(ctx) {
  const pts = ctx.points.filter((p) => true);
  if (pts.length < 4) return;
  const sets = new Map();
  const limit = Math.min(pts.length, 30);
  const arr = pts.slice(0, limit);
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) for (let k = j + 1; k < arr.length; k++) {
    const a = arr[i], b = arr[j], c = arr[k];
    const den = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(den) < 1e-10) continue;
    const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
    const O = {
      x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / den,
      y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / den,
    };
    const r = dist(O, a);
    if (!(r > ctx.tol)) continue;
    const on = arr.filter((p) => Math.abs(dist(O, p) - r) < ctx.tol * 1.5);
    if (on.length >= 4) {
      const ids = on.map((p) => p.id).sort();
      sets.set(ids.join('|'), { pts: on, O, r });
    }
  }
  const all = [...sets.values()].sort((a, b) => b.pts.length - a.pts.length);
  const kept = [];
  for (const set of all) {
    if (kept.some((big) => set.pts.every((p) => big.pts.includes(p)))) continue;
    kept.push(set);
  }
  for (const set of kept) {
    const labels = set.pts.map((p) => p.label);
    const ids = set.pts.map((p) => p.id);
    const onExisting = ctx.circles.some((c) => set.pts.every((p) => Math.abs(dist(c.center, p) - c.r) < ctx.tol * 1.5));
    let score = BASE.concyclic + Math.min(12, set.pts.length);
    let theorem = null, title = '四点共圆';
    const n = set.pts.length;
    if (n >= 9) { score = 99; theorem = 'Nine-point circle'; title = '九点圆'; }
    else if (n >= 6) { score += 5; title = '多点共圆'; }
    if (onExisting) score -= 8;
    push(ctx, {
      kind: 'concyclic', category: category('concyclic'), title,
      statement: `${nameList(labels)} ${n} 点共圆${theorem ? '（' + theorem + '）' : ''}`,
      points: labels, ids, score, theorem,
      detail: `圆心 ≈ (${fmt(set.O.x, 3)}, ${fmt(set.O.y, 3)})，半径 ≈ ${fmt(set.r, 3)}。`,
      evidence: `最大偏差 ${Math.max(...set.pts.map((p) => Math.abs(dist(set.O, p) - set.r))).toExponential(2)}`,
      order: Math.min(...set.pts.map((p) => p.order)),
    });
  }
}

function lineDirection(l) { return { x: l.d.x, y: l.d.y }; }
function lineName(l) { return l.label || (l.members?.length >= 2 ? l.members.slice(0, 2).map((id) => id) : ''); }
function labelLine(ctx, l) {
  if (l.label) return l.label;
  const ps = pts2(ctx, l.members || []);
  if (ps.length >= 2) return ps[0].label + ps[1].label;
  return '直线';
}

function virtualLines(ctx, maxPoints = 18) {
  const pts = [...ctx.points].sort((a, b) => (important(b) ? 1 : 0) - (important(a) ? 1 : 0) || a.order - b.order).slice(0, maxPoints);
  const out = [...ctx.lines];
  const seen = new Set(out.map((l) => [l.p1, l.p2].sort().join('|')));
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j];
    const key = [a.id, b.id].sort().join('|');
    if (seen.has(key)) continue;
    if (dist(a, b) < ctx.tol) continue;
    seen.add(key);
    const d = norm(sub(b, a));
    out.push({
      id: 'v:' + key, label: a.label + b.label, virtual: true,
      a: { x: a.x, y: a.y }, d, members: [a.id, b.id], p1: a.id, p2: b.id,
      order: Math.min(a.order, b.order), len: dist(a, b),
    });
  }
  return out;
}

function detectParallel(ctx) {
  const lines = virtualLines(ctx, 18);
  const buckets = new Map();
  for (const l of lines) {
    let ang = Math.atan2(l.d.y, l.d.x);
    if (ang < 0) ang += Math.PI;
    if (ang >= Math.PI - 1e-9) ang -= Math.PI;
    const k = Math.round(ang / 1e-5);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(l);
  }
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    // unique by geometric line (avoid duplicate collinear objects)
    const uniq = [];
    for (const l of group) {
      if (!uniq.some((q) => Math.abs(cross(sub(l.a, q.a), q.d)) < ctx.tol && Math.abs(cross(l.d, q.d)) < 1e-6)) uniq.push(l);
    }
    if (uniq.length < 2) continue;
    const chosen = uniq.slice(0, 4);
    const names = chosen.map((l) => labelLine(ctx, l));
    const ids = chosen.map((l) => l.id);
    let score = BASE.parallel + Math.min(8, uniq.length * 2);
    if (chosen.some((l) => l.virtual && l.label.length === 2)) score += 2;
    push(ctx, {
      kind: 'parallel', category: category('parallel'), title: uniq.length > 2 ? '平行线组' : '两线平行',
      statement: `${names.slice(0, 2).join(' ∥ ')}${names.length > 2 ? ' ∥ …' : ''}`,
      lines: names, ids, score,
      detail: `共 ${uniq.length} 条直线方向相同。`,
      evidence: `方向差 < 1e−5 rad`,
      order: Math.min(...chosen.map((l) => l.order)),
    });
  }
}

function detectPerpendicular(ctx) {
  const lines = virtualLines(ctx, 18);
  const pairs = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const l = lines[i], m = lines[j];
    if (Math.abs(dot(l.d, m.d)) > 2e-5) continue;
    if (l.p1 === m.p1 || l.p1 === m.p2 || l.p2 === m.p1 || l.p2 === m.p2) {
      // still meaningful if they meet at a center, but drop the common endpoint
      // only when the endpoint is a vertex and no center is involved.
    }
    const names = [labelLine(ctx, l), labelLine(ctx, m)];
    let score = BASE.perpendicular + (names.some((s) => s.length <= 3) ? 2 : 0);
    if (l.virtual && m.virtual) score += 2;
    pairs.push({ l, m, names, score });
  }
  pairs.sort((a, b) => b.score - a.score);
  for (const p of pairs.slice(0, 26)) {
    push(ctx, {
      kind: 'perpendicular', category: category('perpendicular'), title: '两线垂直',
      statement: `${p.names[0]} ⟂ ${p.names[1]}`,
      lines: p.names, ids: [p.l.id, p.m.id], score: p.score,
      detail: '方向向量点积为 0。',
      evidence: `|cos θ| < 2e−5`,
      order: Math.min(p.l.order, p.m.order),
    });
  }
}

function lineIntersection(l, m) {
  const den = cross(l.d, m.d);
  if (Math.abs(den) < 1e-9) return null;
  const q = sub(m.a, l.a);
  const t = cross(q, m.d) / den;
  return { x: l.a.x + l.d.x * t, y: l.a.y + l.d.y * t };
}

function detectConcurrent(ctx) {
  const lines = virtualLines(ctx, 16).slice(0, 44);
  if (lines.length < 3) return;
  const groups = new Map();
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const p = lineIntersection(lines[i], lines[j]);
    if (!p) continue;
    const key = Math.round(p.x / ctx.tol) + ',' + Math.round(p.y / ctx.tol);
    if (!groups.has(key)) groups.set(key, { p, lines: [lines[i], lines[j]] });
    else {
      const g = groups.get(key);
      if (!g.lines.includes(lines[i])) g.lines.push(lines[i]);
      if (!g.lines.includes(lines[j])) g.lines.push(lines[j]);
    }
  }
  const results = [];
  for (const g of groups.values()) {
    if (g.lines.length < 3) continue;
    // verify all lines pass through p
    const valid = g.lines.every((l) => Math.abs(cross(sub(g.p, l.a), l.d)) < ctx.tol);
    if (!valid) continue;
    const uniq = [];
    for (const l of g.lines) if (!uniq.some((q) => Math.abs(cross(sub(l.a, q.a), q.d)) < ctx.tol)) uniq.push(l);
    if (uniq.length < 3) continue;
    const at = ctx.points.find((p) => dist(p, g.p) < ctx.tol * 2);
    const endpointHits = at ? uniq.filter((l) => l.p1 === at.id || l.p2 === at.id).length : 0;
    if (at && endpointHits >= 2) continue;
    const pLabels = at ? at.label : `P(${fmt(g.p.x, 2)}, ${fmt(g.p.y, 2)})`;
    const names = uniq.slice(0, 4).map((l) => labelLine(ctx, l));
    let score = BASE.concurrent + Math.min(8, uniq.length * 2);
    if (at && at.centerKey) score += 8;
    if (names.every((n) => n.length <= 4)) score += 2;
    results.push({ p: g.p, at, pLabels, names, uniq, score });
  }
  results.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const r of results) {
    if (kept.some((k) => dist(k.p, r.p) < ctx.tol * 2)) continue;
    kept.push(r);
  }
  for (const r of kept.slice(0, 24)) {
    push(ctx, {
      kind: 'concurrent', category: category('concurrent'), title: r.at?.centerKey ? '特征点共点' : '三线共点',
      statement: `${r.names.join('、')} 共点于 ${r.pLabels}`,
      lines: r.names, points: [r.pLabels], ids: r.uniq.map((l) => l.id), score: r.score,
      point: { x: r.p.x, y: r.p.y, label: r.pLabels },
      detail: `共 ${r.uniq.length} 条直线经过同一点。`,
      evidence: `最大偏离 ${Math.max(...r.uniq.map((l) => Math.abs(cross(sub(r.p, l.a), l.d)))).toExponential(2)}`,
      order: Math.min(...r.uniq.map((l) => l.order)),
    });
  }
}

function detectEqualLengths(ctx) {
  const pts = ctx.points;
  if (pts.length < 4) return;
  const groups = new Map();
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j], d = dist(a, b);
    if (d < ctx.tol) continue;
    const k = Math.round(d / (ctx.tol * 3));
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push([a, b, d]);
  }
  const rels = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // pick disjoint pairs first
    const chosen = [];
    for (const pair of group.sort((a, b) => a[2] - b[2])) {
      if (chosen.some((q) => q[0].id === pair[0].id || q[0].id === pair[1].id || q[1].id === pair[0].id || q[1].id === pair[1].id)) continue;
      chosen.push(pair);
      if (chosen.length >= 3) break;
    }
    if (chosen.length < 2) continue;
    const names = chosen.map(([a, b]) => a.label + b.label);
    let score = BASE.equalLength + chosen.length * 4;
    if (chosen.some(([a, b]) => a.centerKey || b.centerKey)) score += 3;
    rels.push({ names, chosen, score });
  }
  rels.sort((a, b) => b.score - a.score);
  for (const r of rels.slice(0, 18)) {
    push(ctx, {
      kind: 'equalLength', category: category('equalLength'), title: r.names.length > 2 ? '等长线段组' : '线段相等',
      statement: `${r.names.join(' = ')}`,
      points: [...new Set(r.chosen.flatMap(([a, b]) => [a.label, b.label]))],
      pairs: r.chosen.map(([a, b]) => [a.id, b.id]),
      ids: r.chosen.flatMap(([a, b]) => [a.id, b.id]), score: r.score,
      detail: `公共长度 ≈ ${fmt(r.chosen[0][2], 4)}。`,
      evidence: `长度极差 ${(Math.max(...r.chosen.map((x) => x[2])) - Math.min(...r.chosen.map((x) => x[2]))).toExponential(2)}`,
      order: Math.min(...r.chosen.flatMap(([a, b]) => [a.order, b.order])),
    });
  }
}

function detectEqualAngles(ctx) {
  if (ctx.points.length > 22) return;
  const pts = ctx.points;
  const angles = [];
  for (let i = 0; i < pts.length; i++) for (let j = 0; j < pts.length; j++) for (let k = 0; k < pts.length; k++) {
    if (i === j || j === k || i === k) continue;
    const a = pts[i], b = pts[j], c = pts[k];
    if (dist(a, b) < ctx.tol || dist(c, b) < ctx.tol) continue;
    const ang = angleAt(a, b, c);
    if (ang < 0.03 || ang > Math.PI - 0.03) continue;
    angles.push({ a, b, c, ang, key: Math.round((ang * 180 / Math.PI) / 0.0005) });
  }
  const groups = new Map();
  for (const x of angles) {
    if (!groups.has(x.key)) groups.set(x.key, []);
    groups.get(x.key).push(x);
  }
  const rels = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const chosen = [];
    const used = new Set();
    const raySignature = (x) => {
      const d1 = Math.atan2(x.a.y - x.b.y, x.a.x - x.b.x);
      const d2 = Math.atan2(x.c.y - x.b.y, x.c.x - x.b.x);
      const normAng = (t) => { let v = ((t % Math.PI) + Math.PI) % Math.PI; return Math.round(v * 1e6); };
      return x.b.id + ':' + [normAng(d1), normAng(d2)].sort((p, q) => p - q).join(',');
    };
    const seenRays = new Set();
    for (const x of group) {
      const k = [x.a.id, x.b.id, x.c.id].sort().join('|');
      const rs = raySignature(x);
      if (used.has(k) || seenRays.has(rs)) continue;
      if (chosen.some((q) => q.b.id === x.b.id && [q.a.id, q.c.id].every((id) => id === x.a.id || id === x.c.id))) continue;
      chosen.push(x); used.add(k); seenRays.add(rs);
      if (chosen.length >= 3) break;
    }
    if (chosen.length < 2) continue;
    const names = chosen.map((x) => `∠${x.a.label}${x.b.label}${x.c.label}`);
    let score = BASE.equalAngle + chosen.length * 3;
    if (chosen.some((x) => x.a.centerKey || x.b.centerKey || x.c.centerKey)) score += 2;
    rels.push({ names, chosen, score });
  }
  rels.sort((a, b) => b.score - a.score);
  for (const r of rels.slice(0, 16)) {
    push(ctx, {
      kind: 'equalAngle', category: category('equalAngle'), title: '等角关系',
      statement: `${r.names.join(' = ')}`,
      points: [...new Set(r.chosen.flatMap((x) => [x.a.label, x.b.label, x.c.label]))],
      angles: r.chosen.map((x) => [x.a.id, x.b.id, x.c.id]),
      ids: r.chosen.flatMap((x) => [x.a.id, x.b.id, x.c.id]), score: r.score,
      detail: `公共角 ≈ ${fmt(r.chosen[0].ang * 180 / Math.PI, 3)}°。`,
      evidence: `角差 ${(Math.max(...r.chosen.map((x) => x.ang)) - Math.min(...r.chosen.map((x) => x.ang))).toExponential(2)} rad`,
      order: Math.min(...r.chosen.flatMap((x) => [x.a.order, x.b.order, x.c.order])),
    });
  }
}

function detectMidpoints(ctx) {
  const pts = ctx.points;
  if (pts.length < 3) return;
  const out = [];
  for (const m of pts) {
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      if (a.id === m.id || b.id === m.id) continue;
      if (dist(m, mid(a, b)) < ctx.tol * 1.5) {
        const trivial = m.kind === 'midpoint' || (m.label === 'G' && false);
        out.push({ m, a, b, score: BASE.midpoint + (m.centerKey ? 15 : 0) + (trivial ? 5 : 0) });
      }
    }
  }
  out.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const r of out) {
    if (kept.some((q) => q.m.id === r.m.id && q.a.id === r.a.id && q.b.id === r.b.id)) continue;
    kept.push(r);
  }
  for (const r of kept.slice(0, 18)) {
    push(ctx, {
      kind: 'midpoint', category: category('midpoint'), title: r.m.centerKey ? '特征点是中点' : '中点关系',
      statement: `${r.m.label} 是 ${r.a.label}${r.b.label} 的中点`,
      points: [r.m.label, r.a.label, r.b.label],
      pointId: r.m.id, pairIds: [r.a.id, r.b.id],
      ids: [r.m.id, r.a.id, r.b.id], score: r.score,
      detail: `${r.m.label}${r.a.label} = ${r.m.label}${r.b.label} ≈ ${fmt(dist(r.m, r.a), 4)}。`,
      evidence: `偏差 ${dist(r.m, mid(r.a, r.b)).toExponential(2)}`,
      order: r.m.order,
    });
  }
}

function detectTangency(ctx) {
  const out = [];
  for (const c of ctx.circles) {
    for (const l of ctx.lines) {
      const dd = Math.abs(cross(sub(c.center, l.a), l.d));
      if (Math.abs(dd - c.r) < ctx.tol * 2) out.push({ type: 'line', c, l, score: BASE.tangent });
    }
    for (const d of ctx.circles) {
      if (c.id >= d.id) continue;
      const D = dist(c.center, d.center);
      const ext = Math.abs(D - (c.r + d.r));
      const inn = Math.abs(D - Math.abs(c.r - d.r));
      if (ext < ctx.tol * 2) out.push({ type: 'ext', c, d, score: BASE.tangent + 4 });
      else if (inn < ctx.tol * 2) out.push({ type: 'int', c, d, score: BASE.tangent + 3 });
    }
  }
  out.sort((a, b) => b.score - a.score);
  for (const r of out.slice(0, 18)) {
    if (r.type === 'line') {
      push(ctx, {
        kind: 'tangent', category: category('tangent'), title: '直线与圆相切',
        statement: `直线 ${labelLine(ctx, r.l)} 与 ⊙${r.c.label || 'O'} 相切`,
        lines: [labelLine(ctx, r.l)], circles: [r.c.label || 'O'],
        lineId: r.l.id, circleId: r.c.id,
        ids: [r.l.id, r.c.id], score: r.score,
        detail: `圆心到直线距离 ≈ 半径 ≈ ${fmt(r.c.r, 4)}。`,
        evidence: `|d − r| = ${Math.abs(Math.abs(cross(sub(r.c.center, r.l.a), r.l.d)) - r.c.r).toExponential(2)}`,
        order: r.c.order,
      });
    } else {
      const isFeuerbach = (r.c.sub === 'ninePoint' && r.d.sub === 'incircle') || (r.c.sub === 'incircle' && r.d.sub === 'ninePoint');
      push(ctx, {
        kind: 'tangent', category: category('tangent'), title: isFeuerbach ? '费尔巴哈定理' : (r.type === 'int' ? '两圆内切' : '两圆外切'),
        statement: `⊙${r.c.label || 'O₁'} 与 ⊙${r.d.label || 'O₂'} ${r.type === 'int' ? '内切' : '外切'}${isFeuerbach ? '（费尔巴哈）' : ''}`,
        circles: [r.c.label || 'O₁', r.d.label || 'O₂'],
        circleIds: [r.c.id, r.d.id],
        ids: [r.c.id, r.d.id], score: isFeuerbach ? 96 : r.score,
        theorem: isFeuerbach ? 'Feuerbach theorem' : null,
        detail: `圆心距 ≈ ${fmt(dist(r.c.center, r.d.center), 4)}。`,
        evidence: `半径差/和与圆心距之差 < 1e−6`,
        order: r.c.order,
      });
    }
  }
}

function detectTriangleTheorems(ctx) {
  for (const tri of ctx.triangles) {
    const m = tri.metrics;
    const O = m.centers.O, G = m.centers.G, H = m.centers.H, N = m.centers.N;
    const centerNames = tri.centerLabels;
    if (O && G && H && centerNames.O && centerNames.G && centerNames.H) {
      const og = dist(O, G), gh = dist(G, H), oh = dist(O, H);
      if (Math.abs(og - gh / 2) < ctx.tol * 4) {
        push(ctx, {
          kind: 'ratio', category: category('ratio'), title: '欧拉线比例',
          statement: `OG : GH = 1 : 2（${centerNames.O}、${centerNames.G}、${centerNames.H}）`,
          points: [centerNames.O, centerNames.G, centerNames.H],
          ids: [tri.id + ':O', tri.id + ':G', tri.id + ':H'], score: 95, theorem: 'Euler line',
          detail: `OG ≈ ${fmt(og, 4)}，GH ≈ ${fmt(gh, 4)}。`,
          evidence: `|2·OG − GH| / OH ≈ ${(Math.abs(2 * og - gh) / Math.max(1e-9, oh)).toExponential(2)}`,
          order: tri.order,
        });
      }
    }
    if (N && O && H) {
      push(ctx, {
        kind: 'identity', category: category('identity'), title: '九点圆半径',
        statement: `九点圆半径 = R / 2 = ${fmt(m.R / 2, 3)}`,
        points: [centerNames.N || 'N'], ids: [tri.id + ':N'], score: 86, theorem: 'Nine-point circle',
        detail: `外接圆半径 R ≈ ${fmt(m.R, 4)}。`,
        evidence: '由九点圆位似定理直接得到。', order: tri.order,
      });
    }
    // Euler's formula OI² = R(R−2r)
    if (O && m.centers.I) {
      const lhs = dist2(O, m.centers.I), rhs = m.R * (m.R - 2 * m.r);
      if (Math.abs(lhs - rhs) < ctx.tol * Math.max(1, m.R * m.R) * 3) {
        push(ctx, {
          kind: 'identity', category: category('identity'), title: '欧拉公式',
          statement: `OI² = R(R − 2r) = ${fmt(rhs, 3)}`,
          points: [centerNames.O || 'O', centerNames.I || 'I'], ids: [tri.id + ':O', tri.id + ':I'], score: 91, theorem: "Euler's formula",
          detail: `R ≈ ${fmt(m.R, 4)}，r ≈ ${fmt(m.r, 4)}。`,
          evidence: `|OI² − R(R−2r)| = ${Math.abs(lhs - rhs).toExponential(2)}`, order: tri.order,
        });
      }
    }
    // OH² = 9R² − (a²+b²+c²)
    if (O && H) {
      const lhs = dist2(O, H), rhs = 9 * m.R * m.R - (m.a * m.a + m.b * m.b + m.c * m.c);
      if (Math.abs(lhs - rhs) < ctx.tol * Math.max(1, m.R * m.R) * 3) {
        push(ctx, {
          kind: 'identity', category: category('identity'), title: '外心—垂心距离',
          statement: `OH² = 9R² − (a² + b² + c²)`,
          points: [centerNames.O || 'O', centerNames.H || 'H'], ids: [tri.id + ':O', tri.id + ':H'], score: 83,
          detail: `OH ≈ ${fmt(Math.sqrt(Math.max(0, lhs)), 4)}。`,
          evidence: `恒等式残差 ${Math.abs(lhs - rhs).toExponential(2)}`, order: tri.order,
        });
      }
    }
    // Nine-point concyclicity using the nine classical points (virtual if not on canvas)
    const vnames = [tri.vertexLabels[0] + '₁', tri.vertexLabels[1] + '₁', tri.vertexLabels[2] + '₁', 'D', 'E', 'F', 'M_A', 'M_B', 'M_C'];
    const vids = ['Ma', 'Mb', 'Mc', 'D', 'E', 'F', 'MA', 'MB', 'MC'].map((k) => tri.id + ':' + k);
    push(ctx, {
      kind: 'concyclic', category: category('concyclic'), title: '九点圆定理',
      statement: `三边中点、三垂足、AH/BH/CH 的中点共九点共圆${centerNames.N ? '，圆心为 ' + centerNames.N : ''}`,
      points: vnames, ids: vids, score: 93, theorem: 'Nine-point circle',
      detail: `九点圆圆心 N ≈ (${fmt(N?.x ?? 0, 3)}, ${fmt(N?.y ?? 0, 3)})，半径 R/2 ≈ ${fmt(m.R / 2, 3)}。`,
      evidence: '九点圆位似定理：九点均为外接圆在 h(H, 1/2) 下的像。',
      order: tri.order,
    });
  }
}

export function relationSummary(relations) {
  const counts = {};
  for (const r of relations) counts[r.category] = (counts[r.category] || 0) + 1;
  return counts;
}

export { CATEGORY };
