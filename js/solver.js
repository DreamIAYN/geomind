/* ==========================================================================
   GeoMind · goal evaluation, stability analysis and proof narratives
   ========================================================================== */
import {
  objectById, cloneState, recompute, dist, mid, sub, add, mul, dot, cross, norm, len,
  angleAt, fmt, deg, dist2, circumcenter,
} from './geometry.js';
import { buildSnapshot } from './relations.js';

export const GOAL_LABEL = {
  collinear: '三点共线', concyclic: '共圆', parallel: '两线平行',
  perpendicular: '两线垂直', concurrent: '三线共点', equalLength: '线段等长', angleSum: '角度和',
  equalAngle: '两角相等', isogonal: '等角线对称', midpoint: '中点', tangent: '相切', onCircle: '点在圆上',
  ratio: '定比', angleValue: '定角', identity: '恒等式',
};

function pointOf(state, goal, id) {
  const o = objectById(state, id);
  if (o && o.type === 'point' && o.valid) return { x: o.g.x, y: o.g.y, label: o.label, live: true };
  const c = goal?.coords?.[id];
  if (c) return { x: c.x, y: c.y, label: c.label || '?', live: false };
  return null;
}
function lineOf(state, goal, id) {
  const o = objectById(state, id);
  if (o && ['line', 'segment', 'ray', 'vector'].includes(o.type) && o.valid) {
    return { a: { x: o.g.a.x, y: o.g.a.y }, d: { x: o.g.d.x, y: o.g.d.y }, label: o.label || '', live: true };
  }
  const dat = goal?.lineData?.[id];
  if (dat) return { a: { ...dat.a }, d: { ...dat.d }, label: dat.label || '?', live: false };
  return null;
}
function circleOf(state, goal, id) {
  const o = objectById(state, id);
  if (o && o.type === 'circle' && o.valid) return { center: { x: o.g.center.x, y: o.g.center.y }, r: o.g.r, label: o.label || '', live: true };
  const dat = goal?.circleData?.[id];
  if (dat) return { center: { ...dat.center }, r: dat.r, label: dat.label || '?', live: false };
  return null;
}

function spanOfPoints(pts) {
  if (!pts.length) return 1;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

export function evaluateGoal(state, goal) {
  const scale = goal.scale || (() => {
    const pts = [];
    for (const id of [...(goal.ids || []), ...(goal.pointIds || []), ...(goal.pairIds || []), ...(goal.pairs?.flat() || []), ...(goal.angles?.flat() || []), goal.vertexId, goal.arm1Id, goal.arm2Id, goal.jId, goal.kId].filter(Boolean)) {
      const p = pointOf(state, goal, id); if (p) pts.push(p);
    }
    return spanOfPoints(pts);
  })();
  const threshold = goal.threshold || 2e-6;
  const base = { kind: goal.kind, scale, threshold, ok: false, residual: Infinity, confidence: 0, values: {}, detail: '' };
  try {
    switch (goal.kind) {
      case 'collinear': {
        const pts = (goal.ids || []).map((id) => pointOf(state, goal, id)).filter(Boolean);
        if (pts.length < 3) return { ...base, detail: '至少需要三个点。' };
        const a = pts[0], b = pts[1];
        const d = sub(b, a), L = len(d);
        if (L < 1e-9) return { ...base, detail: '前两点重合。' };
        const u = { x: d.x / L, y: d.y / L };
        const ds = pts.slice(2).map((p) => Math.abs(cross(sub(p, a), u)));
        const residual = Math.max(...ds) / scale;
        return finalize({ ...base, ok: residual < threshold, residual, values: { distances: ds, det: cross(sub(b, a), sub(pts[2], a)), points: pts.map((p) => p.label) }, detail: `到基准直线的最大距离 ${fmt(Math.max(...ds), 4)}。` });
      }
      case 'concyclic': {
        const pts = (goal.ids || []).map((id) => pointOf(state, goal, id)).filter(Boolean);
        if (pts.length < 4) return { ...base, detail: '至少需要四个点。' };
        const O = circumcenter(pts[0], pts[1], pts[2]);
        if (!O) return { ...base, detail: '前三点共线，无法确定圆。' };
        const r = dist(O, pts[0]);
        const dev = pts.map((p) => Math.abs(dist(O, p) - r));
        const residual = Math.max(...dev) / scale;
        return finalize({ ...base, ok: residual < threshold, residual, values: { center: O, radius: r, deviations: dev, points: pts.map((p) => p.label) }, detail: `四点圆判定：圆心 (${fmt(O.x, 3)}, ${fmt(O.y, 3)})，半径 ${fmt(r, 3)}，最大偏差 ${fmt(Math.max(...dev), 4)}。` });
      }
      case 'parallel':
      case 'perpendicular': {
        const ls = (goal.lineIds || []).map((id) => lineOf(state, goal, id)).filter(Boolean);
        if (ls.length < 2) return { ...base, detail: '需要两条直线。' };
        const s = Math.abs(cross(ls[0].d, ls[1].d));
        const c = Math.abs(dot(ls[0].d, ls[1].d));
        const residual = goal.kind === 'parallel' ? s : c;
        return finalize({ ...base, ok: residual < threshold, residual, values: { sin: s, cos: c, dirs: ls.map((l) => l.d) }, detail: goal.kind === 'parallel' ? `方向向量叉积 |sin θ| = ${fmt(s, 6)}。` : `方向向量点积 |cos θ| = ${fmt(c, 6)}。` });
      }
      case 'concurrent': {
        const ls = (goal.lineIds || []).map((id) => lineOf(state, goal, id)).filter(Boolean);
        if (ls.length < 3) return { ...base, detail: '需要三条直线。' };
        let best = null;
        for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
          const den = cross(ls[i].d, ls[j].d);
          if (Math.abs(den) < 1e-9) continue;
          const q = sub(ls[j].a, ls[i].a);
          const t = cross(q, ls[j].d) / den;
          const P = add(ls[i].a, { x: ls[i].d.x * t, y: ls[i].d.y * t });
          const ds = ls.map((l) => Math.abs(cross(sub(P, l.a), l.d)));
          const m = Math.max(...ds);
          if (!best || m < best.m) best = { P, ds, m, i, j };
        }
        if (!best) return { ...base, detail: '任意两线都平行，不能共点。' };
        let residual = best.m / scale;
        let circleResidual = null;
        if (goal.circleId) {
          const c = circleOf(state, goal, goal.circleId);
          if (c) {
            circleResidual = Math.abs(dist(best.P, c.center) - c.r) / scale;
            residual = Math.max(residual, circleResidual);
          }
        }
        return finalize({ ...base, ok: residual < threshold, residual, values: { P: best.P, distances: best.ds, lines: ls.map((l) => l.label), circleResidual }, detail: `公共点 (${fmt(best.P.x, 3)}, ${fmt(best.P.y, 3)})，到三线最大距离 ${fmt(best.m, 4)}` + (circleResidual != null ? `，到定圆偏差 ${fmt(circleResidual, 5)}` : '') + '。' });
      }
      case 'angleSum': {
        const tris = goal.angles || [];
        if (tris.length < 2) return { ...base, detail: '需要两个角。' };
        const vals = tris.map(([a, b, c]) => {
          const A = pointOf(state, goal, a), B = pointOf(state, goal, b), C = pointOf(state, goal, c);
          return A && B && C ? angleAt(A, B, C) : null;
        });
        if (vals.some((x) => x == null)) return { ...base, detail: '角的点缺失。' };
        const sum = vals.reduce((x, y) => x + y, 0);
        const rawTarget = Number(goal.value) || 180;
        const target = rawTarget <= 2 * Math.PI + 1e-6 ? rawTarget : rawTarget * Math.PI / 180;
        const residual = Math.abs(sum - target) / Math.PI;
        return finalize({ ...base, ok: residual < threshold, residual, values: { sum: deg(sum), target: deg(target), angles: vals.map(deg) }, detail: `角和 ${fmt(deg(sum), 5)}°，目标 ${fmt(deg(target), 5)}°。` });
      }
      case 'angle': {
        const ids = goal.pointIds || [];
        const A = pointOf(state, goal, ids[0]), B = pointOf(state, goal, ids[1]), C = pointOf(state, goal, ids[2]);
        if (!A || !B || !C) return { ...base, detail: '缺少角的三个点。' };
        const actual = angleAt(A, B, C);
        const target = (Number(goal.value) || 90) * Math.PI / 180;
        const residual = Math.abs(actual - target) / Math.PI;
        return finalize({ ...base, ok: residual < threshold, residual, values: { actual: deg(actual), target: deg(target) }, detail: `∠ = ${fmt(deg(actual), 5)}°，目标 ${fmt(deg(target), 5)}°。` });
      }
      case 'midpoint': {
        const M = pointOf(state, goal, goal.pointId);
        const A = pointOf(state, goal, goal.pairIds?.[0]);
        const B = pointOf(state, goal, goal.pairIds?.[1]);
        if (!M || !A || !B) return { ...base, detail: '缺少点。' };
        const residual = dist(M, mid(A, B)) / scale;
        return finalize({ ...base, ok: residual < threshold, residual, values: { M, A, B, mid: mid(A, B) }, detail: `|M − mid(AB)| = ${fmt(dist(M, mid(A, B)), 5)}。` });
      }
      case 'equalLength': {
        const pairs = goal.pairs || [];
        if (pairs.length < 2) return { ...base, detail: '需要至少两组线段。' };
        const lens = pairs.map(([a, b]) => {
          const A = pointOf(state, goal, a), B = pointOf(state, goal, b);
          return A && B ? dist(A, B) : null;
        }).filter((x) => x != null);
        if (lens.length < 2) return { ...base, detail: '线段退化。' };
        const mx = Math.max(...lens), mn = Math.min(...lens);
        const residual = (mx - mn) / Math.max(1e-9, mx);
        return finalize({ ...base, ok: residual < threshold, residual, values: { lengths: lens }, detail: `长度 ${lens.map((x) => fmt(x, 4)).join(' / ')}，相对差 ${fmt(residual, 7)}。` });
      }
      case 'angleSum': {
        const angles = goal.angles || [];
        const vals = angles.map(([a, b, c]) => {
          const A = pointOf(state, goal, a), B = pointOf(state, goal, b), C = pointOf(state, goal, c);
          return A && B && C ? angleAt(A, B, C) : null;
        });
        if (vals.some((x) => x == null)) return { ...base, detail: '角退化。' };
        const sum = vals.reduce((x, y) => x + y, 0), target = goal.value ?? Math.PI;
        const residual = Math.abs(sum - target) / Math.PI;
        return finalize({ ...base, ok: residual < threshold, residual, values: { angles: vals, sum, target }, detail: `角度和 ${fmt(deg(sum), 3)}°，目标 ${fmt(deg(target), 3)}°，差 ${fmt((sum - target) * 180 / Math.PI, 5)}°。` });
      }
      case 'equalAngle': {
        const angles = goal.angles || [];
        if (angles.length < 2) return { ...base, detail: '需要至少两个角。' };
        const vals = angles.map(([a, b, c]) => {
          const A = pointOf(state, goal, a), B = pointOf(state, goal, b), C = pointOf(state, goal, c);
          return A && B && C ? angleAt(A, B, C) : null;
        }).filter((x) => x != null);
        if (vals.length < 2) return { ...base, detail: '角退化。' };
        const residual = (Math.max(...vals) - Math.min(...vals)) / Math.PI;
        return finalize({ ...base, ok: residual < threshold, residual, values: { angles: vals, degrees: vals.map(deg) }, detail: `角度 ${vals.map((x) => fmt(deg(x), 3) + '°').join(' / ')}，最大差 ${fmt((Math.max(...vals) - Math.min(...vals)) * 180 / Math.PI, 5)}°。` });
      }
      case 'isogonal': {
        const A = pointOf(state, goal, goal.vertexId), B = pointOf(state, goal, goal.arm1Id), C = pointOf(state, goal, goal.arm2Id);
        const J = pointOf(state, goal, goal.jId), K = pointOf(state, goal, goal.kId);
        if (!A || !B || !C || !J || !K) return { ...base, detail: '缺少顶点、角边或两条等角线上的点。' };
        const u = norm(sub(B, A)), v = norm(sub(C, A));
        const n = norm(add(u, v));
        if (len(n) < 1e-9) return { ...base, detail: '角 BAC 退化（两臂反向）。' };
        const dJ = sub(J, A), dK = sub(K, A);
        if (len(dJ) < 1e-9 || len(dK) < 1e-9) return { ...base, detail: '等角线上的点与顶点重合。' };
        const reflected = sub(mul(n, 2 * dot(dJ, n)), dJ);
        const residual = Math.abs(cross(dK, reflected)) / Math.max(1e-9, len(dK) * len(reflected));
        return finalize({ ...base, ok: residual < threshold, residual, values: { against: residual }, detail: `AK 与 AJ 关于角平分线的镜像直线的方向偏差 ${fmt(residual, 8)}。` });
      }
      case 'angleSum': {
      const angs = ev.values.angles || [];
      return { title: '角度和计算', lines: angs.map((a, i) => `θ${i + 1} = ${fmt(deg(a), 5)}°`).concat(`和 = ${fmt(deg(ev.values.sum), 5)}°，差 = ${fmt(ev.residual * 180, 8)}°`) };
    }
    case 'tangent': {
        if (goal.lineId && goal.circleId) {
          const l = lineOf(state, goal, goal.lineId), c = circleOf(state, goal, goal.circleId);
          if (!l || !c) return { ...base, detail: '缺少直线或圆。' };
          const d = Math.abs(cross(sub(c.center, l.a), l.d));
          const residual = Math.abs(d - c.r) / scale;
          return finalize({ ...base, ok: residual < threshold, residual, values: { distance: d, radius: c.r }, detail: `圆心到直线距离 ${fmt(d, 4)}，半径 ${fmt(c.r, 4)}。` });
        }
        const cs = (goal.circleIds || []).map((id) => circleOf(state, goal, id)).filter(Boolean);
        if (cs.length < 2) return { ...base, detail: '需要两个圆。' };
        const D = dist(cs[0].center, cs[1].center);
        const ext = Math.abs(D - (cs[0].r + cs[1].r));
        const inn = Math.abs(D - Math.abs(cs[0].r - cs[1].r));
        const residual = Math.min(ext, inn) / scale;
        return finalize({ ...base, ok: residual < threshold, residual, values: { D, ext, inn, radii: cs.map((c) => c.r) }, detail: `圆心距 ${fmt(D, 4)}，外切差 ${fmt(ext, 4)}，内切差 ${fmt(inn, 4)}。` });
      }
      case 'onCircle': {
        const P = pointOf(state, goal, goal.pointId), c = circleOf(state, goal, goal.circleId);
        if (!P || !c) return { ...base, detail: '缺少点或圆。' };
        const d = Math.abs(dist(P, c.center) - c.r);
        const residual = d / scale;
        return finalize({ ...base, ok: residual < threshold, residual, values: { distance: dist(P, c.center), radius: c.r }, detail: `|OP − r| = ${fmt(d, 5)}。` });
      }
      case 'identity': {
        const tri = state.objects.find((o) => o.type === 'triangle' && o.valid && o.centers && o.centers.O === goal.ids?.[0] && o.centers.I === goal.ids?.[1]);
        if (!tri || !tri.metrics) return { ...base, detail: '未找到对应的三角形。' };
        const m = tri.metrics;
        const lhs = dist2(m.O, m.I), rhs = m.R * (m.R - 2 * m.r);
        const residual = Math.abs(lhs - rhs) / Math.max(1, m.R * m.R);
        return finalize({ ...base, ok: residual < threshold, residual, values: { lhs, rhs, R: m.R, r: m.r }, detail: `OI² = ${fmt(lhs, 6)}，R(R−2r) = ${fmt(rhs, 6)}。` });
      }
      case 'ratio': {
        const pairs = goal.pairs || [];
        if (pairs.length < 2) return { ...base, detail: '需要两组线段。' };
        const lens = pairs.map(([a, b]) => {
          const A = pointOf(state, goal, a), B = pointOf(state, goal, b);
          return A && B ? dist(A, B) : null;
        });
        const actual = lens[0] / lens[1];
        const target = goal.value;
        const residual = Math.abs(actual - target) / Math.max(1e-9, Math.abs(target));
        return finalize({ ...base, ok: residual < threshold, residual, values: { lens, actual, target }, detail: `实际比 ${fmt(actual, 5)}，目标比 ${fmt(target, 5)}。` });
      }
      default:
        return { ...base, detail: '暂不支持该目标类型。' };
    }
  } catch (err) {
    return { ...base, detail: '求值异常：' + String(err.message || err) };
  }
}

function finalize(r) {
  if (!Number.isFinite(r.residual)) r.residual = Infinity;
  const ok = r.ok || r.residual < r.threshold;
  const ratio = Math.min(1, r.residual / Math.max(1e-12, r.threshold));
  const confidence = ok ? Math.max(92, 99.99 - ratio * 7.5) : Math.max(0, Math.min(88, 88 * (1 - Math.min(1, ratio / 25))));
  return { ...r, ok, confidence, status: ok ? 'verified' : 'failed' };
}

export function pointLabel(state, goal, id) {
  return objectById(state, id)?.label || goal?.coords?.[id]?.label || goal?.labels?.[id] || '?';
}
export function lineLabel(state, goal, id) {
  const o = objectById(state, id);
  if (o?.label) return o.label;
  if (goal?.lineLabels?.[id]) return goal.lineLabels[id];
  if (['line', 'segment', 'ray', 'vector'].includes(o?.type)) {
    const A = objectById(state, o.deps[0]), B = objectById(state, o.deps[1]);
    if (A && B) return A.label + B.label;
  }
  return '?';
}

export function goalStatement(state, goal) {
  if (!goal) return '';
  if (goal.statement) return goal.statement;
  const P = (id) => pointLabel(state, goal, id);
  const L = (id) => lineLabel(state, goal, id);
  switch (goal.kind) {
    case 'collinear': return `${(goal.ids || []).map(P).join('、')} 三点共线`;
    case 'concyclic': {
      const n = (goal.ids || []).length;
      return `${(goal.ids || []).map(P).join('、')} ${n > 4 ? n + ' 点' : '四点'}共圆`;
    }
    case 'parallel': return `${L(goal.lineIds?.[0])} ∥ ${L(goal.lineIds?.[1])}`;
    case 'perpendicular': return `${L(goal.lineIds?.[0])} ⟂ ${L(goal.lineIds?.[1])}`;
    case 'concurrent': return `${(goal.lineIds || []).map(L).join('、')} 三线共点`;
    case 'equalLength': return (goal.pairs || []).map(([a, b]) => P(a) + P(b)).join(' = ');
    case 'equalAngle': return (goal.angles || []).map(([a, b, c]) => `∠${P(a)}${P(b)}${P(c)}`).join(' = ');
    case 'angleSum': return (goal.angles || []).map(([a, b, c]) => `∠${P(a)}${P(b)}${P(c)}`).join(' + ') + ' = ' + fmt((goal.value ?? Math.PI) * 180 / Math.PI, 1) + '°';
    case 'isogonal': return `${P(goal.vertexId)}${P(goal.jId)}、${P(goal.vertexId)}${P(goal.kId)} 关于 ∠${P(goal.arm1Id)}${P(goal.vertexId)}${P(goal.arm2Id)} 的平分线对称`;
    case 'midpoint': return `${P(goal.pointId)} 是 ${P(goal.pairIds?.[0])}${P(goal.pairIds?.[1])} 的中点`;
    case 'tangent': return goal.lineId ? '直线与圆相切' : '两圆相切';
    case 'onCircle': return `${P(goal.pointId)} 在圆上`;
    case 'ratio': return '线段比等于定值';
    default: return goal.title || '几何目标';
  }
}

/* ------------------------------ selection -------------------------------- */
export function inferGoalFromSelection(state, ids, preferred = null) {
  if (!ids || !ids.length) return null;
  const objs = ids.map((id) => objectById(state, id)).filter(Boolean);
  const points = objs.filter((o) => o.type === 'point' && o.valid);
  const lines = objs.filter((o) => ['line', 'segment', 'ray', 'vector'].includes(o.type) && o.valid);
  const circles = objs.filter((o) => o.type === 'circle' && o.valid);
  const kind = preferred || (lines.length >= 3 ? 'concurrent' : points.length >= 4 ? 'concyclic' : points.length >= 3 ? 'collinear' : lines.length === 2 ? 'parallel' : null);
  if (!kind) return null;
  if (kind === 'collinear' || kind === 'concyclic') {
    if (points.length < (kind === 'collinear' ? 3 : 4)) return null;
    return { kind, ids: points.map((o) => o.id), title: kind === 'collinear' ? '证明三点共线' : '证明四点共圆', source: 'selection' };
  }
  if (kind === 'parallel' || kind === 'perpendicular') {
    if (lines.length < 2) return null;
    return { kind, lineIds: lines.slice(0, 2).map((o) => o.id), title: kind === 'parallel' ? '证明两线平行' : '证明两线垂直', source: 'selection' };
  }
  if (kind === 'concurrent') {
    if (lines.length < 3) return null;
    return { kind, lineIds: lines.slice(0, 3).map((o) => o.id), title: '证明三线共点', source: 'selection' };
  }
  if (kind === 'midpoint') {
    if (points.length < 3) return null;
    return { kind, pointId: points[0].id, pairIds: [points[1].id, points[2].id], title: `${points[0].label} 是 ${points[1].label}${points[2].label} 的中点`, source: 'selection' };
  }
  if (kind === 'equalLength') {
    if (lines.length >= 2) {
      const pairs = lines.slice(0, 2).map((o) => o.deps);
      return { kind, pairs, title: '证明两线段等长', source: 'selection' };
    }
    if (points.length >= 4) {
      return { kind, pairs: [[points[0].id, points[1].id], [points[2].id, points[3].id]], title: '证明两线段等长', source: 'selection' };
    }
    return null;
  }
  if (kind === 'equalAngle') {
    if (objs.filter((o) => o.type === 'angle').length >= 2) {
      const as = objs.filter((o) => o.type === 'angle');
      return { kind, angles: as.slice(0, 2).map((o) => o.deps), title: '证明两角相等', source: 'selection' };
    }
    if (points.length >= 6) {
      return { kind, angles: [points.slice(0, 3).map((o) => o.id), points.slice(3, 6).map((o) => o.id)], title: '证明两角相等', source: 'selection' };
    }
    return null;
  }
  if (kind === 'tangent') {
    if (lines.length && circles.length) return { kind, lineId: lines[0].id, circleId: circles[0].id, title: '证明直线与圆相切', source: 'selection' };
    if (circles.length >= 2) return { kind, circleIds: circles.slice(0, 2).map((o) => o.id), title: '证明两圆相切', source: 'selection' };
    return null;
  }
  if (kind === 'onCircle') {
    if (points.length && circles.length) return { kind, pointId: points[0].id, circleId: circles[0].id, title: '证明点在圆上', source: 'selection' };
    return null;
  }
  return null;
}

export function goalFromRelation(rel, snapshot, state) {
  if (!rel) return null;
  const coords = {}; const lineData = {}; const circleData = {};
  if (snapshot.virtualPoints) for (const [id, p] of Object.entries(snapshot.virtualPoints)) coords[id] = { ...p };
  const pointInSnapshot = (id) => snapshot.points.find((x) => x.id === id)
    || (snapshot.virtualPoints && snapshot.virtualPoints[id])
    || (() => { const o = objectById(state, id); return o?.type === 'point' && o.valid ? { id, label: o.label, x: o.g.x, y: o.g.y } : null; })();
  for (const id of rel.ids || []) {
    const p = pointInSnapshot(id);
    if (p) coords[id] = { x: p.x, y: p.y, label: p.label };
    const l = snapshot.lines.find((x) => x.id === id);
    if (l) lineData[id] = { a: l.a, d: l.d, label: l.label };
    // Relation scanner also creates virtual lines such as v:p1|p4.
    if (!lineData[id] && String(id).startsWith('v:')) {
      const [aId, bId] = String(id).slice(2).split('|');
      const A = pointInSnapshot(aId), B = pointInSnapshot(bId);
      if (A && B) lineData[id] = { a: { x: A.x, y: A.y }, d: { x: B.x - A.x, y: B.y - A.y }, label: '' };
    }
    const c = snapshot.circles.find((x) => x.id === id);
    if (c) circleData[id] = { center: c.center, r: c.r, label: c.label };
  }
  const virtual = (rel.ids || []).some((id) => !objectById(state, id));
  const base = { source: 'relation', relationId: rel.id, theorem: rel.theorem || null, coords, lineData, circleData, labels: rel.points || rel.lines || [], virtual, statement: rel.statement };
  if (rel.kind === 'collinear' || rel.kind === 'concyclic') {
    if ((rel.ids || []).length < (rel.kind === 'collinear' ? 3 : 4)) return null;
    return { ...base, kind: rel.kind, ids: rel.ids, title: rel.statement };
  }
  if (rel.kind === 'parallel' || rel.kind === 'perpendicular' || rel.kind === 'concurrent') {
    if ((rel.ids || []).length < 2) return null;
    return { ...base, kind: rel.kind, lineIds: rel.ids, title: rel.statement };
  }
  if (rel.kind === 'midpoint' && rel.pointId) return { ...base, kind: 'midpoint', pointId: rel.pointId, pairIds: rel.pairIds, title: rel.statement };
  if (rel.kind === 'equalLength' && rel.pairs) return { ...base, kind: 'equalLength', pairs: rel.pairs, title: rel.statement };
  if (rel.kind === 'equalAngle' && rel.angles) return { ...base, kind: 'equalAngle', angles: rel.angles, title: rel.statement };
  if (rel.kind === 'tangent') {
    if (rel.lineId && rel.circleId) return { ...base, kind: 'tangent', lineId: rel.lineId, circleId: rel.circleId, title: rel.statement };
    if (rel.circleIds) return { ...base, kind: 'tangent', circleIds: rel.circleIds, title: rel.statement };
  }
  return null;
}

/* ------------------------------ stability -------------------------------- */
function seeded(i, k) {
  const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export function stabilityCheck(state, goal, samples = 8) {
  const base = evaluateGoal(state, goal);
  if (goal?.virtual) return { base, worst: base.residual, best: base.residual, samples: [], stable: null, reason: '目标包含派生点坐标，无法在微扰后自动重算' };
  if (!base.ok) return { base, worst: base.residual, best: base.residual, samples: [], stable: false, reason: '目标未通过单次验证' };
  let worst = 0, best = Infinity;
  const list = [];
  const free = state.objects.filter((o) => o.type === 'point' && o.sub === 'free' && !o.locked && o.valid);
  if (!free.length) return { base, worst: base.residual, best: base.residual, samples: [], stable: true, reason: '无自由点可微扰' };
  for (let s = 0; s < samples; s++) {
    const st = cloneState(state);
    for (const o of st.objects) {
      if (o.type === 'point' && o.sub === 'free' && !o.locked) {
        const amp = 0.0012 * base.scale;
        o.x += amp * seeded(s, o.id.length + o.label.charCodeAt(0));
        o.y += amp * seeded(s + 31, o.label.charCodeAt(0) + 7);
      }
    }
    recompute(st);
    const r = evaluateGoal(st, goal);
    list.push({ residual: r.residual, ok: r.ok });
    if (r.residual > worst) worst = r.residual;
    if (r.residual < best) best = r.residual;
  }
  const stable = worst < Math.max(base.threshold * 35, 5e-5);
  return { base, worst, best, samples: list, stable, reason: stable ? '微扰后结论保持稳定' : '微扰后残差增大，需检查偶然性' };
}

/* ------------------------------ computation ------------------------------ */
export function buildComputation(state, goal, ev) {
  const P = (id) => pointOf(state, goal, id);
  const L = (id) => lineOf(state, goal, id);
  const vf = (p) => `(${fmt(p.x, 4)}, ${fmt(p.y, 4)})`;
  switch (goal.kind) {
    case 'collinear': {
      const pts = (goal.ids || []).map((id) => ({ id, p: P(id) })).filter((x) => x.p);
      const [A, B, C] = pts;
      if (!A || !B || !C) return { title: '坐标判定', lines: [] };
      return {
        title: '坐标行列式判定',
        lines: [
          `A = ${vf(A.p)}, B = ${vf(B.p)}, C = ${vf(C.p)}`,
          `det(B−A, C−A) = (${fmt(B.p.x - A.p.x, 4)})(${fmt(C.p.y - A.p.y, 4)}) − (${fmt(B.p.y - A.p.y, 4)})(${fmt(C.p.x - A.p.x, 4)})`,
          `det = ${fmt((B.p.x - A.p.x) * (C.p.y - A.p.y) - (B.p.y - A.p.y) * (C.p.x - A.p.x), 8)}`,
          `共线残差 = ${fmt(ev.residual, 8)} < ${ev.threshold}`,
        ],
      };
    }
    case 'concyclic': {
      const pts = (goal.ids || []).map((id) => P(id)).filter(Boolean);
      const O = pts.length >= 3 ? circumcenter(pts[0], pts[1], pts[2]) : null;
      if (!O) return { title: '共圆判定', lines: ['前三点退化。'] };
      const r = dist(O, pts[0]);
      return {
        title: '四点共圆判定',
        lines: [
          `A = ${vf(pts[0])}, B = ${vf(pts[1])}, C = ${vf(pts[2])}`,
          `外接圆圆心 O = ${vf(O)}，半径 r = ${fmt(r, 4)}`,
          ...pts.map((p, i) => `|P${i + 1}O| − r = ${fmt(dist(p, O) - r, 8)}`),
          `最大偏差 / 尺度 = ${fmt(ev.residual, 8)}`,
        ],
      };
    }
    case 'parallel':
    case 'perpendicular': {
      const a = L(goal.lineIds?.[0]), b = L(goal.lineIds?.[1]);
      if (!a || !b) return { title: '方向向量判定', lines: [] };
      return {
        title: '方向向量判定',
        lines: [
          `u = (${fmt(a.d.x, 4)}, ${fmt(a.d.y, 4)}), v = (${fmt(b.d.x, 4)}, ${fmt(b.d.y, 4)})`,
          `u · v = ${fmt(dot(a.d, b.d), 8)}`,
          `u × v = ${fmt(cross(a.d, b.d), 8)}`,
          goal.kind === 'parallel' ? `平行残差 |u × v| = ${fmt(Math.abs(cross(a.d, b.d)), 8)}` : `垂直残差 |u · v| = ${fmt(Math.abs(dot(a.d, b.d)), 8)}`,
        ],
      };
    }
    case 'concurrent': {
      const ls = (goal.lineIds || []).map((id) => L(id)).filter(Boolean);
      const p = ev.values.P;
      return {
        title: '三线共点判定',
        lines: [
          ...ls.map((l, i) => `ℓ${i + 1}: 过 (${fmt(l.a.x, 3)}, ${fmt(l.a.y, 3)})，方向 (${fmt(l.d.x, 3)}, ${fmt(l.d.y, 3)})`),
          p ? `两两交点 ≈ ${vf(p)}` : '无交点',
          `各线到公共点的最大距离 = ${fmt((ev.values.distances || []).reduce((m, x) => Math.max(m, x), 0), 8)}`,
        ],
      };
    }
    case 'midpoint': {
      const M = P(goal.pointId), A = P(goal.pairIds?.[0]), B = P(goal.pairIds?.[1]);
      if (!M || !A || !B) return { title: '中点判定', lines: [] };
      return {
        title: '中点坐标判定',
        lines: [
          `A = ${vf(A)}, B = ${vf(B)}`,
          `mid(A,B) = ((${fmt(A.x, 4)} + ${fmt(B.x, 4)})/2, (${fmt(A.y, 4)} + ${fmt(B.y, 4)})/2) = ${vf(mid(A, B))}`,
          `M = ${vf(M)}`,
          `|M − mid(A,B)| = ${fmt(dist(M, mid(A, B)), 8)}`,
        ],
      };
    }
    case 'equalLength': {
      const lens = ev.values.lengths || [];
      return { title: '长度计算', lines: lens.map((l, i) => `|${i + 1}| = ${fmt(l, 6)}`).concat(`相对差 = ${fmt(ev.residual, 8)}`) };
    }
    case 'equalAngle': {
      const angs = ev.values.degrees || [];
      return { title: '角度计算', lines: angs.map((a, i) => `θ${i + 1} = ${fmt(a, 5)}°`).concat(`最大差 = ${fmt(ev.residual * 180, 8)}°`) };
    }
    case 'tangent': {
      if (goal.lineId && goal.circleId) {
        const l = L(goal.lineId), c = circleOf(state, goal, goal.circleId);
        if (!l || !c) return { title: '相切判定', lines: [] };
        return { title: '圆心到直线距离', lines: [`圆心到直线距离 d = ${fmt(ev.values.distance, 6)}`, `半径 r = ${fmt(ev.values.radius, 6)}`, `|d − r| / 尺度 = ${fmt(ev.residual, 8)}`] };
      }
      return { title: '圆心距判定', lines: [`圆心距 D = ${fmt(ev.values.D, 6)}`, `外切差 = ${fmt(ev.values.ext, 6)}`, `内切差 = ${fmt(ev.values.inn, 6)}`] };
    }
    case 'onCircle': {
      return { title: '点圆判定', lines: [`|OP| = ${fmt(ev.values.distance, 6)}`, `r = ${fmt(ev.values.radius, 6)}`, `偏差 = ${fmt(Math.abs(ev.values.distance - ev.values.radius), 8)}`] };
    }
    case 'identity': {
      return { title: '欧拉公式 · 精确恒等式', lines: [`OI² = ${fmt(ev.values.lhs, 8)}`, `R(R−2r) = ${fmt(ev.values.rhs, 8)}`, `R = ${fmt(ev.values.R, 6)}, r = ${fmt(ev.values.r, 6)}`, `相对残差 = ${fmt(ev.residual, 10)}`] };
    }
    default:
      return { title: '数值验证', lines: [ev.detail || ''] };
  }
}

/* ------------------------------ narratives ------------------------------- */
const GENERIC = {
  collinear: {
    summary: '共线问题的核心是把“三点共线”转化为角、比例或位似关系。',
    steps: [
      '优先寻找第三条直线上的已知点、中点或位似中心，把三点放到同一构造链上。',
      '若三点分别在三边上，尝试梅涅劳斯定理（或其逆定理）；若出现中点、平行四边形，优先用中位线/位似。',
      '也可以建立坐标系或复平面，把共线写成行列式为 0，作为验证与最后兜底。',
    ],
  },
  concyclic: {
    summary: '共圆问题通常由“同弧所对圆周角相等”或“对角互补”驱动。',
    steps: [
      '寻找四点中能形成的两组等角：∠ABC = ∠ADC 或 ∠ABC + ∠ADC = 180°。',
      '若出现垂足、切线、圆幂结构，可先用四点共圆（如 ∠ADB = ∠AEB = 90°）作为中间结论。',
      '最后用“同侧等角 ⇒ 共圆”或圆幂逆定理收束。',
    ],
  },
  parallel: {
    summary: '平行可由角相等、中位线或位似直接得到。',
    steps: ['寻找截线形成的同位角/内错角相等。', '若有中点，优先考虑三角形中位线定理。', '若有位似或平移，直接用变换保持方向。'],
  },
  perpendicular: {
    summary: '垂直通常来自直径所对圆周角、切线半径或勾股逆定理。',
    steps: ['寻找 90° 圆周角或切线半径。', '用角度追踪把目标角拆成已知直角之和。', '也可用向量点积或斜率乘积作为验证。'],
  },
  concurrent: {
    summary: '三线共点优先考虑塞瓦定理的逆定理。',
    steps: ['若三条线分别经过三角形顶点与对边上的点，计算三组有向比。', '验证三个比值的乘积为 1 后，由塞瓦逆定理得共点。', '若没有三角形结构，可化为根轴、极线或位似中心的共点问题。'],
  },
  midpoint: {
    summary: '中点问题优先用中位线、平行四边形对角线或位似。',
    steps: ['寻找以目标线段为对角线的平行四边形。', '寻找经过中点的中线/中位线。', '若出现圆，结合垂径定理与圆幂。'],
  },
  equalLength: {
    summary: '等长问题优先构造全等三角形或利用圆幂。',
    steps: ['寻找包含两条线段的三角形，证明全等或相似。', '若有圆，利用同圆半径、等弦或切割线定理。', '也可用中点/垂直平分线转化。'],
  },
  equalAngle: {
    summary: '等角问题优先用圆周角、相似或等角共轭。',
    steps: ['寻找四点共圆，把角转移到同弧上。', '寻找相似三角形或对称/旋转关系。', '最后用有向角 mod 180° 收束。'],
  },
  tangent: {
    summary: '相切的核心是圆心到直线距离等于半径，或圆心距等于半径和/差。',
    steps: ['直线与圆：证明半径与直线垂直，且垂足在圆上。', '两圆：证明圆心距等于半径和（外切）或半径差（内切）。', '若涉及九点圆与内切圆，可识别费尔巴哈定理。'],
  },
  onCircle: {
    summary: '点在圆上可转化为到圆心距离等于半径，或共圆判定。',
    steps: ['证明该点到圆心的距离等于半径。', '或证明它与圆上另外三点共圆。', '若有切线/垂足结构，优先用圆幂或直径所对圆周角。'],
  },
};

export function buildSolution(state, goal, ev, stability, opts = {}) {
  const proof = opts.proof || null;
  const theorem = goal.theorem || proof?.theorem || null;
  let synthetic;
  if (proof && proof.steps) {
    synthetic = {
      available: true, complete: true, theorem: proof.theorem, summary: proof.summary,
      steps: proof.steps, caution: proof.caution || '以上为综合法证明主线；细节中的辅助线存在性与退化情形需按图形位置独立检查。',
    };
  } else {
    const labels = (goal.ids || []).map((id) => pointLabel(state, goal, id));
    const isEuler = goal.kind === 'collinear' && ['O', 'G', 'H'].every((x) => labels.includes(x));
    const isEulerFormula = goal.kind === 'identity' || (goal.theorem || '').toLowerCase().includes("euler's formula");
    const isNine = goal.kind === 'concyclic' && (labels.includes('N') || (goal.theorem || '').toLowerCase().includes('nine'));
    if (isEulerFormula) synthetic = {
      available: true, complete: true, theorem: "Euler's formula",
      summary: '用弧中点 M 与圆幂 IA·IM = R² − OI²，得到 OI² = R² − 2Rr。',
      steps: [
        '设 M 为不含 A 的弧 BC 的中点。由构型 86，M 是 △BIC 的外心，且 MI = MB = MC = 2R sin(A/2)。',
        'AI 是角平分线，A、I、M 共线；在直角三角形中 AI = r / sin(A/2)。',
        '对圆内一点 I 用圆幂：IA·IM = R² − OI²。',
        '代入 IA·IM = [r/sin(A/2)]·[2R sin(A/2)] = 2Rr，即得 OI² = R² − 2Rr。',
      ],
    };
    else if (isEuler) synthetic = { available: true, complete: true, theorem: 'Euler line', summary: '用位似 h(G, −1/2) 把三高映成中垂线。', steps: [
      '设 M_a 为 BC 中点，A′ 为 A 的对径点。由直径所对圆周角为直角，A′B ∥ CH、A′C ∥ BH，故 BHCA′ 是平行四边形。',
      '于是 M_a 是 HA′ 的中点。以 G 为中心、比 −1/2 的位似 h 满足 h(A)=M_a、h(H)=O。',
      '因此 G、H、O 共线，且 GO : GH = 1 : 2。',
    ] };
    else if (isNine) synthetic = { available: true, complete: true, theorem: 'Nine-point circle', summary: '九点圆是外接圆在 h(H, 1/2) 下的像。', steps: [
      '取以 H 为中心、比 1/2 的位似 h，外接圆映成圆心 N=mid(OH)、半径 R/2 的圆。',
      '三顶点映到 AH、BH、CH 的中点；对径点映到三边中点；H 关于三边的对称点映到三垂足。',
      '这九个点都在像圆上，故九点共圆。',
    ] };
    else {
      const g = GENERIC[goal.kind] || { summary: '先用数值验证锁定结论，再寻找标准定理入口。', steps: ['识别图形中的共圆、相似、中点或圆幂结构。', '把目标化归为标准定理。', '用有向角/有向长度处理退化。'] };
      synthetic = {
        available: true, complete: false, theorem: theorem || '综合法策略',
        summary: g.summary, steps: g.steps,
        caution: '当前给出的是可执行的综合法路线，尚未自动闭合为形式证明；请结合画板中的高亮关系补全关键引理。',
      };
    }
  }
  const computation = buildComputation(state, goal, ev);
  const status = !ev.ok ? 'failed' : (stability && stability.stable === false ? 'unstable' : 'verified');
  return {
    status,
    confidence: ev.ok ? (stability?.stable === false ? Math.min(88, ev.confidence) : ev.confidence) : ev.confidence,
    theorem: synthetic.theorem || theorem,
    synthetic,
    computation,
    verification: {
      residual: ev.residual,
      threshold: ev.threshold,
      detail: ev.detail,
      stability,
    },
    goalStatement: goalStatement(state, goal),
  };
}

/* ------------------------------ backend payload -------------------------- */
export function goalPayload(state, goal) {
  const points = new Map(), lines = new Map(), circles = new Map();
  const addPoint = (p) => { if (p) points.set(p.label || ('P' + points.size), { name: p.label || ('P' + points.size), x: p.x, y: p.y }); };
  const pids = new Set([...(goal.ids || []), ...(goal.pointIds || []), ...(goal.pairIds || []), ...(goal.pairs?.flat() || []), ...(goal.angles?.flat() || []), goal.vertexId, goal.arm1Id, goal.arm2Id, goal.jId, goal.kId].filter(Boolean));
  for (const id of pids) addPoint(pointOf(state, goal, id));
  for (const id of goal.lineIds || []) {
    const l = lineOf(state, goal, id); if (!l) continue;
    lines.set(lineLabel(state, goal, id), { name: lineLabel(state, goal, id), a: l.a, d: l.d });
    addPoint({ ...l.a, label: 'L' + lines.size + 'a' }); addPoint({ ...add(l.a, l.d), label: 'L' + lines.size + 'b' });
  }
  if (goal.lineId) {
    const l = lineOf(state, goal, goal.lineId); if (l) lines.set(lineLabel(state, goal, goal.lineId), { name: lineLabel(state, goal, goal.lineId), a: l.a, d: l.d });
  }
  const cids = new Set([...(goal.circleIds || []), ...(goal.circleId ? [goal.circleId] : [])]);
  for (const id of cids) {
    const c = circleOf(state, goal, id); if (!c) continue;
    circles.set(c.label || ('C' + circles.size), { name: c.label || ('C' + circles.size), center: c.center, r: c.r });
  }
  return {
    goal: {
      kind: goal.kind,
      names: (goal.ids || []).map((id) => pointLabel(state, goal, id)),
      pointNames: (goal.ids || []).map((id) => pointLabel(state, goal, id)),
      lineNames: (goal.lineIds || []).map((id) => lineLabel(state, goal, id)),
      pointId: goal.pointId ? pointLabel(state, goal, goal.pointId) : null,
      pairNames: (goal.pairIds || []).map((id) => pointLabel(state, goal, id)),
      pairs: (goal.pairs || []).map(([a, b]) => [pointLabel(state, goal, a), pointLabel(state, goal, b)]),
      angles: (goal.angles || []).map(([a, b, c]) => [pointLabel(state, goal, a), pointLabel(state, goal, b), pointLabel(state, goal, c)]),
      lineId: goal.lineId ? lineLabel(state, goal, goal.lineId) : null,
      circleId: goal.circleId ? (circleOf(state, goal, goal.circleId)?.label || null) : null,
      circleNames: [...cids].map((id) => circleOf(state, goal, id)?.label || ''),
      tangentLine: goal.lineId ? lineLabel(state, goal, goal.lineId) : null,
      tangentCircle: goal.circleId ? (circleOf(state, goal, goal.circleId)?.label || null) : null,
      value: goal.value ?? null,
      statement: goalStatement(state, goal),
      scenarioId: goal.scenarioId || optsScenario(state),
    },
    points: [...points.values()],
    lines: [...lines.values()],
    circles: [...circles.values()],
  };
}

function optsScenario(state) { return state.meta?.scenarioId || null; }

export function buildGoalForKind(state, kind, ids = null) {
  const sel = ids || [];
  const objs = sel.map((id) => objectById(state, id)).filter(Boolean);
  const points = objs.filter((o) => o.type === 'point');
  const lines = objs.filter((o) => ['line', 'segment', 'ray', 'vector'].includes(o.type));
  const circles = objs.filter((o) => o.type === 'circle');
  if (kind === 'collinear' && points.length >= 3) return { kind, ids: points.slice(0, 3).map((o) => o.id), title: '证明三点共线', source: 'selection' };
  if (kind === 'concyclic' && points.length >= 4) return { kind, ids: points.slice(0, 4).map((o) => o.id), title: '证明四点共圆', source: 'selection' };
  if ((kind === 'parallel' || kind === 'perpendicular') && lines.length >= 2) return { kind, lineIds: lines.slice(0, 2).map((o) => o.id), title: kind === 'parallel' ? '证明两线平行' : '证明两线垂直', source: 'selection' };
  if (kind === 'concurrent' && lines.length >= 3) return { kind, lineIds: lines.slice(0, 3).map((o) => o.id), title: '证明三线共点', source: 'selection' };
  if (kind === 'isogonal' && points.length >= 5) {
    const byLabel = new Map(points.map((p) => [p.label, p]));
    const A = byLabel.get('A') || points[0];
    const B = byLabel.get('B') || points[1];
    const C = byLabel.get('C') || points[2];
    const J = byLabel.get('J') || points[3];
    const K = byLabel.get('K') || points[4];
    return {
      kind: 'isogonal', vertexId: A.id, arm1Id: B.id, arm2Id: C.id,
      jId: J.id, kId: K.id, ids: [A.id, B.id, C.id, J.id, K.id],
      title: `${A.label}${J.label}、${A.label}${K.label} 关于 ∠${B.label}${A.label}${C.label} 的平分线对称`,
      source: 'selection',
    };
  }
  if (kind === 'midpoint' && points.length >= 3) return { kind, pointId: points[0].id, pairIds: [points[1].id, points[2].id], title: '证明中点', source: 'selection' };
  if (kind === 'equalLength' && lines.length >= 2) return { kind, pairs: lines.slice(0, 2).map((o) => o.deps), title: '证明两线段等长', source: 'selection' };
  if (kind === 'equalLength' && points.length >= 4) return { kind, pairs: [[points[0].id, points[1].id], [points[2].id, points[3].id]], title: '证明两线段等长', source: 'selection' };
  if (kind === 'tangent' && lines.length && circles.length) return { kind, lineId: lines[0].id, circleId: circles[0].id, title: '证明直线与圆相切', source: 'selection' };
  if (kind === 'tangent' && circles.length >= 2) return { kind, circleIds: circles.slice(0, 2).map((o) => o.id), title: '证明两圆相切', source: 'selection' };
  if (kind === 'onCircle' && points.length && circles.length) return { kind, pointId: points[0].id, circleId: circles[0].id, title: '证明点在圆上', source: 'selection' };
  return null;
}
