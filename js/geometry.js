/* ==========================================================================
   GeoMind · geometry kernel
   Pure, dependency-free plane geometry engine used by the canvas, the
   relation worker and the reasoning layer. Coordinates are Cartesian, y-up.
   ========================================================================== */

export const TAU = Math.PI * 2;
export const EPS = 1e-9;
export const TOL = 1e-7;

export const PALETTE = [
  '#1f2937', '#1d4ed8', '#0f766e', '#b45309', '#6d28d9',
  '#be123c', '#065f46', '#9a3412', '#0e7490', '#4d7c0f',
];

export const CENTER_DEFS = [
  { key: 'G',  label: 'G',  name: '重心',       color: '#f6c76b', en: 'Centroid',        formula: '三条中线的交点' },
  { key: 'O',  label: 'O',  name: '外心',       color: '#60a5fa', en: 'Circumcentre',    formula: '三边中垂线的交点' },
  { key: 'I',  label: 'I',  name: '内心',       color: '#34d399', en: 'Incentre',        formula: '三条内角平分线的交点' },
  { key: 'H',  label: 'H',  name: '垂心',       color: '#fb7185', en: 'Orthocentre',     formula: '三条高线的交点' },
  { key: 'N',  label: 'N',  name: '九点圆心',   color: '#c084fc', en: 'Nine-point centre', formula: '外心与垂心的中点' },
  { key: 'IA', label: 'I_A', name: 'A-旁心',    color: '#f472b6', en: 'A-excentre',      formula: 'A 内角平分线与 B、C 外角平分线的交点' },
  { key: 'IB', label: 'I_B', name: 'B-旁心',    color: '#f9a8d4', en: 'B-excentre',      formula: 'B 内角平分线与 A、C 外角平分线的交点' },
  { key: 'IC', label: 'I_C', name: 'C-旁心',    color: '#fbcfe8', en: 'C-excentre',      formula: 'C 内角平分线与 A、B 外角平分线的交点' },
  { key: 'K',  label: 'K',  name: '陪位重心',   color: '#fbbf24', en: 'Symmedian point', formula: '三条陪位中线的交点（Lemoine 点）' },
  { key: 'Ge', label: 'Ge', name: '热尔岗点',   color: '#22d3ee', en: 'Gergonne point',  formula: '内切圆切点与对顶点的三条塞瓦线交点' },
  { key: 'Na', label: 'Na', name: '奈格尔点',   color: '#fb923c', en: 'Nagel point',     formula: '三条旁切圆切线与对顶点的塞瓦线交点' },
  { key: 'Sp', label: 'Sp', name: '斯皮克点',   color: '#a3e635', en: 'Spieker centre',  formula: '中点三角形的内心' },
  { key: 'F1', label: 'F1', name: '第一费马点', color: '#e879f9', en: 'First Fermat point',  formula: '三边外作正三角形，对顶点连线的交点' },
  { key: 'F2', label: 'F2', name: '第二费马点', color: '#d8b4fe', en: 'Second Fermat point', formula: '三边内作正三角形，对顶点连线的交点' },
  { key: 'Fe', label: 'Fe', name: '费尔巴哈点', color: '#fda4af', en: 'Feuerbach point', formula: '九点圆与内切圆的切点' },
];

export const CORE_CENTERS = ['G', 'O', 'I', 'H', 'N'];

export function centerDef(key) {
  return CENTER_DEFS.find((d) => d.key === key) || CENTER_DEFS[0];
}

/* ------------------------------- vectors --------------------------------- */
export const v = (x = 0, y = 0) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const norm = (a) => { const l = len(a); return l < EPS ? v(0, 0) : { x: a.x / l, y: a.y / l }; };
export const perp = (a) => ({ x: -a.y, y: a.x });
export const rot = (a, t) => ({ x: a.x * Math.cos(t) - a.y * Math.sin(t), y: a.x * Math.sin(t) + a.y * Math.cos(t) });
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const angleOf = (a) => Math.atan2(a.y, a.x);
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const eqPt = (a, b, tol = 1e-8) => dist2(a, b) <= tol * tol;

export function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
export function mod(a, n) { return ((a % n) + n) % n; }
export function deg(r) { return (r * 180) / Math.PI; }
export function rad(d) { return (d * Math.PI) / 180; }
export function fmt(x, p = 2) {
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-10) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e6 || ax < 1e-4) return x.toExponential(2);
  return Number(x.toFixed(p)).toString();
}
export function fmtSigned(x, p = 2) { return (x >= 0 ? '+' : '−') + fmt(Math.abs(x), p); }

/* ------------------------------- state ---------------------------------- */
export function createState(name = '未命名画板') {
  return {
    version: 1,
    docName: name,
    objects: [],
    counters: {},
    view: { cx: 0, cy: 0, scale: 62 },
    settings: {
      grid: false, axes: false, labels: true, snap: true, wheel: true,
      theme: 'ink', precision: 2, autoSave: true, renderCenters: true,
    },
    meta: { createdAt: Date.now(), revision: 0, scenarioId: null },
  };
}

export function nextId(state, type) {
  const prefix = ({ point: 'p', line: 'l', segment: 's', ray: 'r', vector: 'v', circle: 'c', polygon: 'pg', triangle: 't', angle: 'a', measure: 'm', text: 'x' })[type] || 'o';
  let n = (state.counters[prefix] || 0) + 1;
  while (state.objects.some((o) => o.id === prefix + n)) n++;
  state.counters[prefix] = n;
  return prefix + n;
}

export function objectById(state, id) { return state.objects.find((o) => o.id === id) || null; }
export function byLabel(state, label) { return state.objects.find((o) => o.label === label) || null; }
export function usedLabels(state) { return new Set(state.objects.map((o) => o.label).filter(Boolean)); }

export function uniqueLabel(state, preferred) {
  const used = usedLabels(state);
  if (!used.has(preferred)) return preferred;
  let i = 2;
  while (used.has(preferred + i)) i++;
  return preferred + i;
}

export function nextPointLabel(state) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let round = 0; round < 8; round++) {
    for (const ch of letters) {
      const lab = round === 0 ? ch : ch + round;
      if (!state.objects.some((o) => o.label === lab)) return lab;
    }
  }
  return uniqueLabel(state, 'P');
}

const defaultStyle = (extra = {}) => ({
  color: '#44546c', width: 1.1, dash: 0, fill: 'rgba(79,209,197,.08)', opacity: 1, pointSize: 3.0,
  ...extra,
});

export function addObject(state, obj) {
  const type = obj.type;
  const o = {
    id: obj.id || nextId(state, type),
    type,
    sub: obj.sub || 'free',
    label: obj.label || '',
    deps: obj.deps || [],
    visible: obj.visible !== false,
    locked: !!obj.locked,
    style: defaultStyle(obj.style),
    meta: obj.meta || {},
    ...obj,
  };
  o.id = obj.id || o.id;
  o.style = defaultStyle(obj.style);
  state.objects.push(o);
  state.meta.revision = (state.meta.revision || 0) + 1;
  return o;
}

export function removeObjects(state, ids) {
  const del = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const o of state.objects) {
      if (!del.has(o.id) && o.deps.some((d) => del.has(d))) { del.add(o.id); changed = true; }
    }
  }
  const removed = state.objects.filter((o) => del.has(o.id));
  state.objects = state.objects.filter((o) => !del.has(o.id));
  // Clean triangle center maps
  for (const o of state.objects) {
    if (o.type === 'triangle' && o.centers) {
      for (const k of Object.keys(o.centers)) if (del.has(o.centers[k])) delete o.centers[k];
    }
  }
  state.meta.revision = (state.meta.revision || 0) + 1;
  return removed;
}

/* ---------------------------- serialization ------------------------------ */
export function serializeState(state) {
  return JSON.stringify({
    version: state.version, docName: state.docName, objects: state.objects.map((o) => {
      const { g, valid, error, metrics, ...rest } = o;
      if (rest.type === 'triangle') {
        return { ...rest, metrics: undefined };
      }
      return rest;
    }),
    counters: state.counters, view: state.view, settings: state.settings, meta: state.meta,
  });
}

export function deserializeState(text) {
  const data = typeof text === 'string' ? JSON.parse(text) : text;
  if (!data || !Array.isArray(data.objects)) throw new Error('不是有效的 GeoMind 画板文件');
  const st = createState(data.docName || '导入的画板');
  st.objects = data.objects.map((o) => ({ ...o, style: defaultStyle(o.style || {}) }));
  st.counters = data.counters || {};
  st.view = { ...st.view, ...(data.view || {}) };
  st.settings = { ...st.settings, ...(data.settings || {}) };
  st.meta = { ...st.meta, ...(data.meta || {}) };
  recompute(st);
  return st;
}

export function cloneState(state) {
  return deserializeState(serializeState(state));
}

/* ------------------------------ basics ----------------------------------- */
export function circumcenter(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
}

export function incenter(a, b, c) {
  const la = dist(b, c), lb = dist(c, a), lc = dist(a, b);
  const s = la + lb + lc;
  if (s < EPS) return null;
  return { x: (la * a.x + lb * b.x + lc * c.x) / s, y: (la * a.y + lb * b.y + lc * c.y) / s };
}

export function excenter(a, b, c, index = 0) {
  const la = dist(b, c), lb = dist(c, a), lc = dist(a, b);
  const signs = [[-1, 1, 1], [1, -1, 1], [1, 1, -1]][index % 3];
  const den = signs[0] * la + signs[1] * lb + signs[2] * lc;
  if (Math.abs(den) < EPS) return null;
  return {
    x: (signs[0] * la * a.x + signs[1] * lb * b.x + signs[2] * lc * c.x) / den,
    y: (signs[0] * la * a.y + signs[1] * lb * b.y + signs[2] * lc * c.y) / den,
  };
}

export function orthocenter(a, b, c) {
  const o = circumcenter(a, b, c);
  if (!o) return null;
  return { x: a.x + b.x + c.x - 2 * o.x, y: a.y + b.y + c.y - 2 * o.y };
}

export function baryPoint(a, b, c, wa, wb, wc) {
  const s = wa + wb + wc;
  if (Math.abs(s) < EPS) return null;
  return { x: (wa * a.x + wb * b.x + wc * c.x) / s, y: (wa * a.y + wb * b.y + wc * c.y) / s };
}

export function barycentric(a, b, c, p) {
  const d = cross(sub(b, a), sub(c, a));
  if (Math.abs(d) < EPS) return null;
  const wb = cross(sub(p, a), sub(c, a)) / d;
  const wc = cross(sub(b, a), sub(p, a)) / d;
  return { A: 1 - wb - wc, B: wb, C: wc };
}

export function projectOnLine(p, a, d) {
  const dd = dot(d, d);
  if (dd < EPS) return { x: a.x, y: a.y, t: 0 };
  const t = dot(sub(p, a), d) / dd;
  return { x: a.x + d.x * t, y: a.y + d.y * t, t };
}

export function distToLine(p, a, d) {
  const n = norm(perp(d));
  return Math.abs(dot(sub(p, a), n));
}

export function directedAngle3(a, b, c) {
  // Clockwise selection (A→B→C) is positive, per teaching convention.
  const u = sub(a, b), v = sub(c, b);
  return -Math.atan2(cross(u, v), dot(u, v));
}

export function directedAngle2(d1, d2) {
  // Counter-clockwise from the first ray to the second is positive.
  return Math.atan2(cross(d1, d2), dot(d1, d2));
}

export function angleAt(a, b, c) {
  const u = sub(a, b), w = sub(c, b);
  const lu = len(u), lw = len(w);
  if (lu < EPS || lw < EPS) return 0;
  return Math.acos(clamp(dot(u, w) / (lu * lw), -1, 1));
}

export function directedAngle(a, b, c, d) {
  // angle between directed lines AB and CD, in (-pi/2, pi/2]
  const u = sub(b, a), w = sub(d, c);
  let t = Math.atan2(cross(u, w), dot(u, w));
  while (t <= -Math.PI / 2) t += Math.PI;
  while (t > Math.PI / 2) t -= Math.PI;
  return t;
}

export function lineLine(a1, d1, a2, d2, bounds1 = null, bounds2 = null) {
  const den = cross(d1, d2);
  if (Math.abs(den) < 1e-11) return [];
  const q = sub(a2, a1);
  const t = cross(q, d2) / den;
  const u = cross(q, d1) / den;
  if (bounds1 && !inBounds(t, bounds1)) return [];
  if (bounds2 && !inBounds(u, bounds2)) return [];
  return [{ x: a1.x + d1.x * t, y: a1.y + d1.y * t, t, u }];
}

function inBounds(t, b) {
  if (!b) return true;
  if (b.type === 'segment') return t >= -1e-8 && t <= b.len + 1e-8;
  if (b.type === 'ray') return t >= -1e-8;
  return true;
}

export function lineCircle(a, d, c, r) {
  const dd = dot(d, d);
  if (dd < EPS) return [];
  const f = sub(a, c);
  const t0 = -dot(f, d) / dd;
  const p0 = { x: a.x + d.x * t0, y: a.y + d.y * t0 };
  const h2 = r * r - dist2(p0, c);
  if (h2 < -1e-8) return [];
  const h = Math.sqrt(Math.max(0, h2)) / Math.sqrt(dd);
  if (h < 1e-9) return [{ ...p0, t: t0 }];
  return [
    { x: a.x + d.x * (t0 - h), y: a.y + d.y * (t0 - h), t: t0 - h },
    { x: a.x + d.x * (t0 + h), y: a.y + d.y * (t0 + h), t: t0 + h },
  ];
}

export function circleCircle(c1, r1, c2, r2) {
  const dx = c2.x - c1.x, dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-10) return [];
  if (d > r1 + r2 + 1e-8 || d < Math.abs(r1 - r2) - 1e-8) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < -1e-8) return [];
  const h = Math.sqrt(Math.max(0, h2));
  const mx = c1.x + (a * dx) / d, my = c1.y + (a * dy) / d;
  if (h < 1e-9) return [{ x: mx, y: my }];
  const rx = (-dy * h) / d, ry = (dx * h) / d;
  return [{ x: mx + rx, y: my + ry }, { x: mx - rx, y: my - ry }];
}

export function tangentPoints(p, c, r) {
  const d = dist(p, c);
  if (d < r - 1e-8) return [];
  if (Math.abs(d - r) < 1e-8) return [{ ...p }];
  const a = (r * r) / d;
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const u = norm(sub(p, c));
  const base = add(c, mul(u, a));
  const n = perp(u);
  return [add(base, mul(n, h)), sub(base, mul(n, h))];
}

export function lineFromPoints(a, b) { return { a: { ...a }, d: sub(b, a) }; }

/* ---------------------------- projective tools --------------------------- */
export function harmonicConjugate(a, b, c) {
  const ab = sub(b, a), d2 = dot(ab, ab);
  if (d2 < EPS) return null;
  const tc = dot(sub(c, a), ab) / d2;
  const den = 2 * tc - 1;
  if (Math.abs(den) < 1e-9) return null; // harmonic conjugate at infinity
  return add(a, mul(ab, tc / den));
}

export function crossRatio(a, b, c, d) {
  const ab = sub(b, a), d2 = dot(ab, ab);
  if (d2 < EPS) return NaN;
  const t = (p) => dot(sub(p, a), ab) / d2;
  const tc = t(c), td = t(d);
  const den = (td - 1) * tc;
  if (Math.abs(den) < EPS) return NaN;
  return (tc * (td - 1)) / ((tc - 1) * td);
}

export function polarLine(p, center, r) {
  const v = sub(p, center), d2 = dot(v, v);
  if (d2 < EPS || r < EPS) return null;
  const q = add(center, mul(v, (r * r) / d2));
  return { a: q, d: norm(perp(v)) };
}

export function poleOfLine(a, d, center, r) {
  const n = norm(perp(d));
  const c = dot(n, a);
  const delta = c - dot(n, center);
  if (Math.abs(delta) < 1e-10 || r < EPS) return null;
  return add(center, mul(n, (r * r) / delta));
}

export function objectLength(o) {
  if (!o || !o.valid || !o.g) return null;
  if (['line', 'segment', 'ray', 'vector'].includes(o.type)) return o.g.len > EPS ? o.g.len : null;
  if (o.type === 'circle') return o.g.r > EPS ? o.g.r : null;
  if (o.type === 'arc') return o.g.r > EPS ? o.g.r : null;
  if (o.type === 'measure') {
    if (o.sub === 'distance' && o.g.points?.length >= 2) {
      const d = dist(o.g.points[0], o.g.points[1]);
      return d > EPS ? d : null;
    }
  }
  return null;
}

export function objectAngle(o) {
  if (!o || !o.valid || !o.g) return null;
  if (o.type === 'measure') {
    if (o.g.points?.length >= 3) return directedAngle3(o.g.points[0], o.g.points[1], o.g.points[2]);
    if (o.g.dirs?.length >= 2) return directedAngle2(o.g.dirs[0], o.g.dirs[1]);
  }
  return null;
}

export function intersectionOfCurves(curve1, curve2) {
  if (!curve1 || !curve2) return [];
  if (curve1.kind === 'line' && curve2.kind === 'line') {
    return lineLine(curve1.a, curve1.d, curve2.a, curve2.d, curve1.bounds, curve2.bounds);
  }
  if (curve1.kind === 'line' && curve2.kind === 'circle') {
    return lineCircle(curve1.a, curve1.d, curve2.center, curve2.r).filter((p) => inBounds(p.t, curve1.bounds));
  }
  if (curve1.kind === 'circle' && curve2.kind === 'line') {
    return lineCircle(curve2.a, curve2.d, curve1.center, curve1.r).filter((p) => inBounds(p.t, curve2.bounds));
  }
  if (curve1.kind === 'circle' && curve2.kind === 'circle') {
    return circleCircle(curve1.center, curve1.r, curve2.center, curve2.r);
  }
  return [];
}

/* ---------------------------- triangle metrics --------------------------- */
export function triangleMetrics(A, B, C) {
  const a = dist(B, C), b = dist(C, A), c = dist(A, B);
  const s = (a + b + c) / 2;
  const area = Math.abs(cross(sub(B, A), sub(C, A))) / 2;
  const valid = area > 1e-9 && a > 1e-9 && b > 1e-9 && c > 1e-9;
  if (!valid) return { valid: false, A: 0, B: 0, C: 0, a, b, c, s, area, R: 0, r: 0, type: '退化' };
  const angA = Math.acos(clamp((b * b + c * c - a * a) / (2 * b * c), -1, 1));
  const angB = Math.acos(clamp((c * c + a * a - b * b) / (2 * c * a), -1, 1));
  const angC = Math.PI - angA - angB;
  const R = (a * b * c) / (4 * area);
  const r = area / s;
  const O = circumcenter(A, B, C);
  const I = incenter(A, B, C);
  const H = O ? { x: A.x + B.x + C.x - 2 * O.x, y: A.y + B.y + C.y - 2 * O.y } : null;
  const G = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
  const N = O && H ? mid(O, H) : null;
  const Ma = mid(B, C), Mb = mid(C, A), Mc = mid(A, B);
  const D = O ? projectOnLine(A, B, sub(C, B)) : null;
  const E = projectOnLine(B, C, sub(A, C));
  const F = projectOnLine(C, A, sub(B, A));
  // Orthic feet (above D/E/F are the altitude feet).
  const feet = { D: { x: D.x, y: D.y }, E: { x: E.x, y: E.y }, F: { x: F.x, y: F.y } };
  const ex = [excenter(A, B, C, 0), excenter(A, B, C, 1), excenter(A, B, C, 2)];
  const K = baryPoint(A, B, C, a * a, b * b, c * c);
  const Ge = baryPoint(A, B, C, 1 / Math.max(1e-9, s - a), 1 / Math.max(1e-9, s - b), 1 / Math.max(1e-9, s - c));
  const Na = baryPoint(A, B, C, s - a, s - b, s - c);
  const Sp = incenter(Ma, Mb, Mc);
  const F1 = fermatPoint(A, B, C, 1);
  const F2 = fermatPoint(A, B, C, -1);
  const Fe = N && I ? (() => { const d = dist(N, I); return d < 1e-9 ? null : add(N, mul(norm(sub(I, N)), R / 2)); })() : null;
  const centers = { G, O, I, H, N, IA: ex[0], IB: ex[1], IC: ex[2], K, Ge, Na, Sp, F1, F2, Fe };
  const type = classifyTriangle(a, b, c, angA, angB, angC);
  return {
    valid, A: angA, B: angB, C: angC, a, b, c, s, area, R, r,
    exradii: [area / Math.max(1e-9, s - a), area / Math.max(1e-9, s - b), area / Math.max(1e-9, s - c)],
    O, I, H, G, N, K, Ge, Na, Sp, F1, F2, Fe, ex,
    Ma, Mb, Mc, feet, centers, type,
    isEquilateral: Math.abs(a - b) < 1e-7 && Math.abs(b - c) < 1e-7,
    isIsosceles: Math.abs(a - b) < 1e-7 || Math.abs(b - c) < 1e-7 || Math.abs(c - a) < 1e-7,
    isRight: Math.abs(angA - Math.PI / 2) < 1e-6 || Math.abs(angB - Math.PI / 2) < 1e-6 || Math.abs(angC - Math.PI / 2) < 1e-6,
    isAcute: angA < Math.PI / 2 - 1e-7 && angB < Math.PI / 2 - 1e-7 && angC < Math.PI / 2 - 1e-7,
  };
}

function classifyTriangle(a, b, c, A, B, C) {
  const eq = (x, y) => Math.abs(x - y) < Math.max(1e-7, 1e-6 * Math.max(x, y));
  if (eq(a, b) && eq(b, c)) return '等边三角形';
  if (eq(a, b) || eq(b, c) || eq(c, a)) {
    if (A > Math.PI / 2 - 1e-7 || B > Math.PI / 2 - 1e-7 || C > Math.PI / 2 - 1e-7) return '等腰直角三角形';
    return '等腰三角形';
  }
  if (A > Math.PI / 2 + 1e-7 || B > Math.PI / 2 + 1e-7 || C > Math.PI / 2 + 1e-7) return '钝角三角形';
  if (Math.abs(A - Math.PI / 2) < 1e-6 || Math.abs(B - Math.PI / 2) < 1e-6 || Math.abs(C - Math.PI / 2) < 1e-6) return '直角三角形';
  return '锐角三角形';
}

function fermatPoint(A, B, C, sign) {
  // Equilateral vertices on BC, CA, AB, on the side opposite the remaining
  // vertex (sign=1) or on the same side (sign=-1); intersect two connectors.
  const sideApex = (P, Q, R) => {
    const m = mid(P, Q);
    const u = norm(perp(sub(Q, P)));
    let s = sign;
    if (dot(u, sub(R, m)) < 0) s = -s; // outward = opposite R
    return add(m, mul(u, (Math.sqrt(3) / 2) * dist(P, Q) * s));
  };
  const X = sideApex(B, C, A);
  const Y = sideApex(C, A, B);
  const Z = sideApex(A, B, C);
  const p1 = lineLine(A, sub(X, A), B, sub(Y, B));
  if (p1.length) return p1[0];
  const p2 = lineLine(B, sub(Y, B), C, sub(Z, C));
  if (p2.length) return p2[0];
  const p3 = lineLine(C, sub(Z, C), A, sub(X, A));
  return p3.length ? p3[0] : null;
}

/* ------------------------------ compute ---------------------------------- */
export function curveOf(o) {
  if (!o || !o.valid || !o.g) return null;
  if (['line', 'segment', 'ray', 'vector'].includes(o.type)) {
    return {
      kind: 'line', a: o.g.a, d: o.g.d,
      bounds: o.type === 'segment' ? { type: 'segment', len: o.g.len } : o.type === 'ray' ? { type: 'ray' } : null,
      source: o,
    };
  }
  if (o.type === 'circle') return { kind: 'circle', center: o.g.center, r: o.g.r, source: o };
  return null;
}

export function getCurve(o) { return curveOf(o); }

function applyPointTransform(o, p, byId) {
  const depObj = (i) => byId.get(o.deps[i]);
  const depP = (i) => { const d = depObj(i); return d && d.valid && d.g && d.g.kind === 'point' ? d.g : null; };
  switch (o.kind) {
    case 'reflectLine': {
      const l = depObj(1); if (!l || !l.valid) return null;
      const q = projectOnLine(p, l.g.a, l.g.d);
      return { x: 2 * q.x - p.x, y: 2 * q.y - p.y, kind: 'point' };
    }
    case 'reflectPoint': {
      const c = depP(1); if (!c) return null;
      return { x: 2 * c.x - p.x, y: 2 * c.y - p.y, kind: 'point' };
    }
    case 'rotate': {
      const c = depP(1); if (!c) return null;
      return { ...add(c, rot(sub(p, c), o.angle || 0)), kind: 'point' };
    }
    case 'translate': {
      const a = depP(1), b = depP(2); if (!a || !b) return null;
      return { ...add(p, sub(b, a)), kind: 'point' };
    }
    case 'homothety': {
      const c = depP(1); if (!c) return null;
      return { ...add(c, mul(sub(p, c), o.ratio ?? 0.5)), kind: 'point' };
    }
    default: return null;
  }
}

export function trapezoidEnds(A, B, C) {
  const L = dist(B, C);
  const uB = norm(sub(B, A)), uC = norm(sub(C, A));
  if (len(uB) < EPS || len(uC) < EPS || L < EPS) return null;
  const base = norm(sub(uC, uB));
  if (len(base) < EPS) return null;
  const solve = (u) => {
    const b = sub(B, A), c = sub(C, A);
    const den = cross(u, c) + cross(b, u);
    if (Math.abs(den) < 1e-12) return null;
    const s = (cross(b, c) - L * cross(b, u)) / den;
    return { s, t: s + L, u };
  };
  const one = solve(base), two = solve({ x: -base.x, y: -base.y });
  const candidates = [one, two].filter(Boolean);
  if (!candidates.length) return null;
  let pick = candidates.find((x) => x.s < 0 && x.t > 0) || candidates[0];
  return { F: add(A, mul(pick.u, pick.s)), E: add(A, mul(pick.u, pick.t)), s: pick.s, t: pick.t };
}

function pointG(o, byId) {
  const dep = (i) => { const d = byId.get(o.deps[i]); return d && d.valid && d.g && d.g.kind === 'point' ? d.g : null; };
  const depObj = (i) => byId.get(o.deps[i]);
  switch (o.sub) {
    case 'free': return { x: o.x, y: o.y, kind: 'point' };
    case 'midpointArc': {
      const circle = depObj(0);
      if (!circle || !circle.valid) return null;
      const four = o.deps.length >= 4;
      const B = depObj(1), C = depObj(four ? 3 : 2);
      if (!B?.g || !C?.g) return null;
      const A = four ? depObj(2) : circle.deps.map((id) => byId.get(id)).find((p) => p?.type === 'point' && p.id !== B.id && p.id !== C.id);
      const center = circle.g.center;
      const ang = (p) => Math.atan2(p.y - center.y, p.x - center.x);
      const norm = (a) => ((a % TAU) + TAU) % TAU;
      const bAng = norm(ang(B.g)), cAng = norm(ang(C.g));
      const delta = (cAng - bAng + TAU) % TAU;
      const onCCW = (a) => { const v = (a - bAng + TAU) % TAU; return v <= delta + 1e-9; };
      const aAng = A?.g ? norm(ang(A.g)) : null;
      const ccwContainsA = aAng == null ? false : onCCW(aAng) && Math.abs(aAng - bAng) > 1e-9 && Math.abs(aAng - cAng) > 1e-9;
      const wantContainingA = four;
      const useCCW = wantContainingA ? ccwContainsA : !ccwContainsA;
      const mid = useCCW ? bAng + delta / 2 : bAng + delta / 2 + Math.PI;
      return { x: center.x + circle.g.r * Math.cos(mid), y: center.y + circle.g.r * Math.sin(mid), kind: 'point' };
    }
    case 'tangencyPoint': {
      const c1 = depObj(0), c2 = depObj(1);
      if (!c1?.valid || !c2?.valid || c1.type !== 'circle' || c2.type !== 'circle') return null;
      const u = norm(sub(c2.g.center, c1.g.center));
      const sign = (o.branch || 0) === 1 ? -1 : 1;
      return { ...add(c1.g.center, mul(u, c1.g.r * sign)), kind: 'point' };
    }
    case 'angleEqualOnLine': {
      const line = depObj(0), A = dep(1), C = dep(2), O = dep(3), B = dep(4);
      if (!line?.valid || !A || !C || !O || !B) return null;
      const U = line.g.a, V = line.g.b, dir = sub(V, U);
      const isSeg = line.type === 'segment';
      const f = (t) => {
        const E = isSeg ? lerp(U, V, t) : add(U, mul(dir, t));
        return angleAt(A, E, C) - angleAt(O, E, B);
      };
      let lo = isSeg ? .02 : -8, hi = isSeg ? .98 : 8;
      let prevT = lo, prev = f(lo), roots = [];
      for (let i = 1; i <= 240; i++) {
        const t = lo + (hi - lo) * i / 240, v = f(t);
        if (v * prev < 0) roots.push([prevT, t]);
        prevT = t; prev = v;
      }
      let best = null;
      for (const [a, b] of roots) {
        let l = a, h = b;
        for (let k = 0; k < 45; k++) { const m = (l + h) / 2; if (f(l) * f(m) <= 0) h = m; else l = m; }
        const t = (l + h) / 2;
        if (!best || Math.abs(t - (o.t ?? .5)) < Math.abs(best - (o.t ?? .5))) best = t;
      }
      if (best == null) {
        let bt = isSeg ? .5 : 0, bv = Infinity;
        for (let i = 1; i < 240; i++) { const t = lo + (hi - lo) * i / 240, v = Math.abs(f(t)); if (v < bv) { bv = v; bt = t; } }
        best = bt;
      }
      const E = isSeg ? lerp(U, V, best) : add(U, mul(dir, best));
      return { ...E, kind: 'point' };
    }
    case 'angleAtFixedOnLine': {
      const line = depObj(0), P = dep(1), Q = dep(2), U = dep(3), V = dep(4), W = dep(5);
      if (!line?.valid || !P || !Q || !U || !V || !W) return null;
      const a = line.g.a, b = line.g.b, dir = sub(b, a), isSeg = line.type === 'segment';
      const target = angleAt(U, V, W);
      const f = (t) => {
        const X = isSeg ? lerp(a, b, t) : add(a, mul(dir, t));
        return angleAt(P, Q, X) - target;
      };
      let lo = isSeg ? .02 : -8, hi = isSeg ? .98 : 8;
      let prevT = lo, prev = f(lo), roots = [];
      for (let i = 1; i <= 240; i++) { const t = lo + (hi - lo) * i / 240, v = f(t); if (v * prev < 0) roots.push([prevT, t]); prevT = t; prev = v; }
      let best = null;
      for (const [l0, h0] of roots) {
        let l = l0, h = h0;
        for (let k = 0; k < 45; k++) { const m = (l + h) / 2; if (f(l) * f(m) <= 0) h = m; else l = m; }
        const t = (l + h) / 2;
        if (!best || Math.abs(t - (o.t ?? .5)) < Math.abs(best - (o.t ?? .5))) best = t;
      }
      if (best == null) { let bt = isSeg ? .5 : 0, bv = Infinity; for (let i = 1; i < 240; i++) { const t = lo + (hi - lo) * i / 240, v = Math.abs(f(t)); if (v < bv) { bv = v; bt = t; } } best = bt; }
      return { ...(isSeg ? lerp(a, b, best) : add(a, mul(dir, best))), kind: 'point' };
    }
    case 'parallelogramFourth': {
      const A = dep(0), B = dep(1), C = dep(2);
      if (!A || !B || !C) return null;
      return { x: A.x + C.x - B.x, y: A.y + C.y - B.y, kind: 'point' };
    }
    case 'ratioDistanceOnLine': {
      const X = dep(0), B = dep(1), C = dep(2), A = dep(3);
      if (!X || !B || !C || !A) return null;
      const ab = dist(A, B), ac = dist(A, C), bx = dist(B, X);
      if (ab < 1e-12) return null;
      const length = bx * ac / ab;
      const u = norm(sub(C, B));
      return { ...add(C, mul(u, length)), kind: 'point' };
    }
    case 'pointOnRayDistance': {
      const A = dep(0), B = dep(1), L1 = dep(2), L2 = dep(3);
      if (!A || !B || !L1 || !L2) return null;
      const u = norm(sub(B, A));
      if (len(u) < EPS) return null;
      return { ...add(A, mul(u, dist(L1, L2))), kind: 'point' };
    }
    case 'circumcenter': {
      const A = dep(0), B = dep(1), C = dep(2);
      if (!A || !B || !C) return null;
      const O = circumcenter(A, B, C);
      return O ? { ...O, kind: 'point' } : null;
    }
    case 'incircleTouch': {
      const A = dep(0), B = dep(1), C = dep(2);
      if (!A || !B || !C) return null;
      const side = String(o.side || '');
      if (side.length === 2) {
        const map = new Map();
        const names = o.sideNames || ['A', 'B', 'C'];
        names.forEach((n, i) => map.set(n, i === 0 ? A : i === 1 ? B : C));
        const P = map.get(side[0]), Q = map.get(side[1]);
        if (P && Q) {
          const I = incenter(A, B, C);
          if (!I) return null;
          const q = projectOnLine(I, P, sub(Q, P));
          return q ? { x: q.x, y: q.y, kind: 'point' } : null;
        }
      }
      const a = dist(B, C), b = dist(C, A), c = dist(A, B);
      const s = (a + b + c) / 2;
      const AF = s - a;
      const u = norm(sub(B, A));
      return { ...add(A, mul(u, AF)), kind: 'point' };
    }
    case 'midpoint': { const a = dep(0), b = dep(1); return a && b ? { ...mid(a, b), kind: 'point' } : null; }
    case 'pointOnLine': {
      const l = depObj(0); if (!l || !l.valid) return null;
      const a = l.g.a, b = l.g.b;
      if (l.type === 'segment') return { ...lerp(a, b, o.t ?? 0.5), kind: 'point' };
      return { ...add(a, mul(l.g.d, o.t ?? 0)), kind: 'point' };
    }
    case 'pointOnRay': {
      const a = dep(0), b = dep(1);
      if (!a || !b) return null;
      const u = norm(sub(b, a));
      return { ...add(a, mul(u, o.t || 0)), kind: 'point' };
    }
    case 'pointOnCircle': {
      const c = depObj(0); if (!c || !c.valid) return null;
      return { x: c.g.center.x + c.g.r * Math.cos(o.theta || 0), y: c.g.center.y + c.g.r * Math.sin(o.theta || 0), kind: 'point' };
    }
    case 'intersection': {
      const a = depObj(0), b = depObj(1);
      const c1 = curveOf(a), c2 = curveOf(b);
      if (!c1 || !c2) return null;
      let pts = intersectionOfCurves(c1, c2);
      if (!pts.length) {
        // The algebraically defined intersection may lie on the extension of a
        // segment; geometric texts usually mean the full line.
        const inf = (cv) => cv && cv.kind === 'line' ? { ...cv, bounds: null } : cv;
        pts = intersectionOfCurves(inf(c1), inf(c2));
      }
      if (!pts.length) return null;
      const p = pts[Math.min(o.branch ?? 0, pts.length - 1)];
      return p ? { x: p.x, y: p.y, kind: 'point' } : null;
    }
    case 'foot': {
      const p = dep(0), l = depObj(1); if (!p || !l || !l.valid) return null;
      const q = projectOnLine(p, l.g.a, l.g.d);
      return { x: q.x, y: q.y, kind: 'point' };
    }
    case 'reflectPoint': { const p = dep(0), c = dep(1); return p && c ? { x: 2 * c.x - p.x, y: 2 * c.y - p.y, kind: 'point' } : null; }
    case 'equilateral': {
      const a = dep(0), b = dep(1); if (!a || !b) return null;
      const m = mid(a, b), n = perp(norm(sub(b, a)));
      const h = (Math.sqrt(3) / 2) * dist(a, b) * (o.sign || 1);
      return { ...add(m, mul(n, h)), kind: 'point' };
    }
    case 'reflectLine': {
      const p = dep(0), l = depObj(1); if (!p || !l || !l.valid) return null;
      const q = projectOnLine(p, l.g.a, l.g.d);
      return { x: 2 * q.x - p.x, y: 2 * q.y - p.y, kind: 'point' };
    }
    case 'reflectPoint': {
      const p = dep(0), c = dep(1); if (!p || !c) return null;
      return { x: 2 * c.x - p.x, y: 2 * c.y - p.y, kind: 'point' };
    }
    case 'transformPoint': {
      const p = dep(0); if (!p) return null;
      return applyPointTransform(o, p, byId);
    }
    case 'rotate': {
      const p = dep(0), c = dep(1); if (!p || !c) return null;
      return { ...add(c, rot(sub(p, c), o.angle || 0)), kind: 'point' };
    }
    case 'translate': {
      const p = dep(0), a = dep(1), b = dep(2); if (!p || !a || !b) return null;
      return { ...add(p, sub(b, a)), kind: 'point' };
    }
    case 'homothety': {
      const p = dep(0), c = dep(1); if (!p || !c) return null;
      return { ...add(c, mul(sub(p, c), o.ratio ?? 0.5)), kind: 'point' };
    }
    case 'harmonic': {
      const A = dep(0), B = dep(1), C = dep(2);
      if (!A || !B || !C) return null;
      const p = harmonicConjugate(A, B, C);
      return p ? { x: p.x, y: p.y, kind: 'point' } : null;
    }
    case 'pole': {
      const l = depObj(0), c = depObj(1);
      if (!l || !c || !l.valid || !c.valid) return null;
      const p = poleOfLine(l.g.a, l.g.d, c.g.center, c.g.r);
      return p ? { x: p.x, y: p.y, kind: 'point' } : null;
    }
    case 'inversion': {
      const p = dep(0), c = depObj(1); if (!p || !c || !c.valid) return null;
      const O = c.g.center, r = c.g.r, v = sub(p, O), d2 = dot(v, v);
      if (d2 < EPS || r < EPS) return null;
      return { ...add(O, mul(v, (r * r) / d2)), kind: 'point' };
    }
    case 'iranianInversion': {
      const A = dep(0), B = dep(1), C = dep(2), P = dep(3);
      if (!A || !B || !C || !P) return null;
      const ab = dist(A, B), ac = dist(A, C), k = ab * ac;
      const v = sub(P, A), d2 = dot(v, v);
      if (k < EPS || d2 < EPS) return null;
      const Q = add(A, mul(v, k / d2));
      let u = add(norm(sub(B, A)), norm(sub(C, A)));
      if (len(u) < EPS) u = perp(norm(sub(B, A)));
      u = norm(u);
      const w = sub(Q, A);
      const reflected = sub(mul(u, 2 * dot(w, u)), w);
      return { ...add(A, reflected), kind: 'point' };
    }
    case 'triangleCenter': {
      // Two calling conventions are supported: deps=[triangleObject] (the
      // interactive panel) and deps=[A,B,C] (vision / scripts).  A construction
      // plan normally has no explicit triangle object, so the three-point form
      // is essential.
      const tri = depObj(0);
      let c = tri && tri.type === 'triangle' && tri.metrics ? tri.metrics.centers[o.centerKey] : null;
      if (!c && o.deps.length >= 3) {
        const A = dep(0), B = dep(1), C = dep(2);
        if (!A || !B || !C) return null;
        const m = triangleMetrics(A, B, C);
        c = m.valid ? m.centers[o.centerKey] : null;
      }
      return c ? { x: c.x, y: c.y, kind: 'point' } : null;
    }
    case 'orthocenter': {
      const A = dep(0), B = dep(1), C = dep(2);
      if (!A || !B || !C) return null;
      const m = triangleMetrics(A, B, C);
      return m.valid && m.H ? { x: m.H.x, y: m.H.y, kind: 'point' } : null;
    }
    case 'incenter': {
      const A = dep(0), B = dep(1), C = dep(2);
      if (!A || !B || !C) return null;
      const p = incenter(A, B, C);
      return p ? { ...p, kind: 'point' } : null;
    }
    case 'centroid': {
      const A = dep(0), B = dep(1), C = dep(2);
      if (!A || !B || !C) return null;
      return { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3, kind: 'point' };
    }
    case 'ninePointCenter': {
      const A = dep(0), B = dep(1), C = dep(2);
      if (!A || !B || !C) return null;
      const m = triangleMetrics(A, B, C);
      return m.valid && m.N ? { x: m.N.x, y: m.N.y, kind: 'point' } : null;
    }
    case 'excenter': {
      const A = dep(0), B = dep(1), C = dep(2);
      if (!A || !B || !C) return null;
      const p = excenter(A, B, C, Number(o.index) || 0);
      return p ? { ...p, kind: 'point' } : null;
    }
    case 'angleEqualOnCircle': {
      // Find P on a circle with angle(A,V,P) = angle(B,C,D).
      // deps = [circle, V, A, B, C, D]; t = preferred angle (radians).
      const circle = depObj(0), V = dep(1), A = dep(2), B = dep(3), C2 = dep(4), D2 = dep(5);
      if (!circle?.valid || circle.type !== 'circle' || !V || !A || !B || !C2 || !D2) return null;
      const target = angleAt(B, C2, D2);
      const center = circle.g.center, r = circle.g.r;
      if (!(r > EPS)) return null;
      const f = (th) => {
        const P = { x: center.x + r * Math.cos(th), y: center.y + r * Math.sin(th) };
        return angleAt(A, V, P) - target;
      };
      const preferred = Number.isFinite(o.t) ? o.t : Math.atan2(A.y - center.y, A.x - center.x) + 0.4;
      const angDist = (th) => Math.abs(((th - preferred + Math.PI) % TAU + TAU) % TAU - Math.PI);
      const roots = [];
      let prevTh = 0, prev = f(0);
      for (let i = 1; i <= 720; i++) {
        const th = i * TAU / 720, val = f(th);
        if (Number.isFinite(val) && Number.isFinite(prev) && val * prev < 0) roots.push([prevTh, th]);
        prevTh = th; prev = val;
      }
      let pick = null;
      for (const [lo0, hi0] of roots) {
        let lo = lo0, hi = hi0;
        for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
        const th = (lo + hi) / 2;
        const d = angDist(th);
        if (!pick || d < pick.d) pick = { th, d };
      }
      let th = pick?.th;
      if (!Number.isFinite(th)) {
        let bd = Infinity;
        for (let i = 0; i < 720; i++) { const x = i * TAU / 720, d = Math.abs(f(x)) + 1e-6 * angDist(x); if (d < bd) { bd = d; th = x; } }
      }
      return { x: center.x + r * Math.cos(th), y: center.y + r * Math.sin(th), kind: 'point' };
    }
    case 'pointOnLineDistance': {
      // deps = [line, anchor, L1, L2]; P on line with |P-anchor| = |L1L2|.
      // `branch` selects the side of the anchor along the line.
      const l = depObj(0), anchor = dep(1), L1 = dep(2), L2 = dep(3);
      if (!l?.valid || !l.g || !anchor || !L1 || !L2) return null;
      const u = norm(l.g.d);
      if (len(u) < EPS) return null;
      const L = dist(L1, L2);
      const s = (o.branch || 0) === 1 ? -1 : 1;
      return { ...add(anchor, mul(u, s * L)), kind: 'point' };
    }
    case 'pointOnCircleDistance': {
      // deps = [circle, anchor, L1, L2]; intersections of the circle with the
      // circle centred at anchor of radius |L1L2|, selected by branch (0/1).
      const c = depObj(0), anchor = dep(1), L1 = dep(2), L2 = dep(3);
      if (!c?.valid || c.type !== 'circle' || !anchor || !L1 || !L2) return null;
      const r1 = c.g.r, r2 = dist(L1, L2), d = dist(c.g.center, anchor);
      if (d < EPS || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return null;
      const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
      const h2 = r1 * r1 - a * a;
      if (h2 < -1e-9) return null;
      const h = Math.sqrt(Math.max(0, h2));
      const u = norm(sub(anchor, c.g.center));
      const base = add(c.g.center, mul(u, a));
      const n = perp(u);
      const p = (o.branch || 0) === 1 ? sub(base, mul(n, h)) : add(base, mul(n, h));
      return { ...p, kind: 'point' };
    }
    case 'externalHomothetyCenter': {
      // branch 0: external centre; branch 1: internal centre.
      const c1 = depObj(0), c2 = depObj(1);
      if (!c1?.valid || !c2?.valid || c1.type !== 'circle' || c2.type !== 'circle') return null;
      const O1 = c1.g.center, O2 = c2.g.center, r1 = c1.g.r, r2 = c2.g.r;
      const external = (o.branch || 0) === 0;
      const den = external ? (r2 - r1) : (r1 + r2);
      if (Math.abs(den) < 1e-9) return null;
      const x = external ? (r2 * O1.x - r1 * O2.x) / den : (r2 * O1.x + r1 * O2.x) / den;
      const y = external ? (r2 * O1.y - r1 * O2.y) / den : (r2 * O1.y + r1 * O2.y) / den;
      return { x, y, kind: 'point' };
    }
    case 'tangentPoint': {
      const p = dep(0), c = depObj(1); if (!p || !c || !c.valid) return null;
      const pts = tangentPoints(p, c.g.center, c.g.r);
      if (!pts.length) return null;
      const q = pts[Math.min(o.branch || 0, pts.length - 1)];
      return { x: q.x, y: q.y, kind: 'point' };
    }
    case 'trapezoidEndpoint': {
      const A = dep(0), B = dep(1), C = dep(2); if (!A || !B || !C) return null;
      const tr = trapezoidEnds(A, B, C); if (!tr) return null;
      const p = o.branch === 1 ? tr.E : tr.F;
      return { x: p.x, y: p.y, kind: 'point' };
    }
    case 'tangentCirclePoint': {
      const B = dep(0), P = dep(1), seg = depObj(2);
      if (!B || !P || !seg || !seg.valid || !seg.g) return null;
      const U = seg.g.a, V = seg.g.b, dir = sub(V, U), n = perp(dir);
      const f = (t) => {
        const E = add(U, mul(dir, t));
        const eb = sub(E, B), ep = sub(E, P);
        return dot(eb, eb) * dot(n, ep) - dot(ep, ep) * dot(n, eb);
      };
      let prevT = .02, prev = f(prevT), roots = [];
      for (let i = 3; i <= 970; i++) {
        const t = i / 1000, val = f(t);
        if (val * prev < 0) roots.push([prevT, t]);
        prevT = t; prev = val;
      }
      let best = null;
      const preferred = Number.isFinite(o.t) ? o.t : .5;
      for (const [lo0, hi0] of roots) {
        let lo = lo0, hi = hi0;
        for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
        const t = (lo + hi) / 2;
        if (!best || Math.abs(t - preferred) < Math.abs(best - preferred)) best = t;
      }
      if (best == null) {
        let bt = .5, bv = Infinity;
        for (let i = 30; i <= 970; i++) { const t = i / 1000, val = Math.abs(f(t)); if (val < bv) { bv = val; bt = t; } }
        best = bt;
      }
      return { ...add(U, mul(dir, best)), kind: 'point' };
    }
    case 'angleDouble': {
      const seg = depObj(0), N = dep(1), D = dep(2), A2 = dep(3), D2 = dep(4);
      if (!seg || !seg.valid || !seg.g || !N || !D || !A2 || !D2) return null;
      const U = seg.g.a, V = seg.g.b;
      const factor = Number(o.factor) || 2;
      const f = (t) => {
        const Q = lerp(U, V, t);
        return angleAt(Q, N, D) - factor * angleAt(Q, A2, D2);
      };
      let prevT = .02, prev = f(prevT), roots = [];
      for (let i = 3; i <= 970; i++) {
        const t = i / 1000, val = f(t);
        if (val * prev < 0) roots.push([prevT, t]);
        prevT = t; prev = val;
      }
      let best = null;
      const preferred = Number.isFinite(o.t) ? o.t : .5;
      for (const [lo0, hi0] of roots) {
        let lo = lo0, hi = hi0;
        for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
        const t = (lo + hi) / 2;
        if (Math.abs(t - 1) < .02) continue;
        if (!best || Math.abs(t - preferred) < Math.abs(best - preferred)) best = t;
      }
      if (best == null) {
        let bt = .5, bv = Infinity;
        for (let i = 30; i <= 970; i++) { const t = i / 1000, val = Math.abs(f(t)); if (val < bv) { bv = val; bt = t; } }
        best = bt;
      }
      return { ...lerp(U, V, best), kind: 'point' };
    }
    case 'equalDistance': {
      const U = dep(0), B = dep(1), C = dep(2), A = dep(3);
      if (!U || !B || !C || !A) return null;
      const length = dist(B, U);
      const ac = dist(A, C);
      if (length > ac + 1e-9) return null;
      const u = norm(sub(A, C));
      if (len(u) < EPS) return null;
      return { ...add(C, mul(u, length)), kind: 'point' };
    }
    case 'fixedDistance': {
      const A = dep(0), B = dep(1), src = depObj(2); if (!A || !B || !src) return null;
      const L = objectLength(src); if (!L) return null;
      const u = norm(sub(B, A)); if (len(u) < EPS) return null;
      return { ...add(A, mul(u, L)), kind: 'point' };
    }
    default: return null;
  }
}

function lineG(o, byId) {
  const dep = (i) => { const d = byId.get(o.deps[i]); return d && d.valid && d.g && d.g.kind === 'point' ? d.g : null; };
  const depObj = (i) => byId.get(o.deps[i]);
  let a = null, b = null;
  switch (o.sub) {
    case 'through': { a = dep(0); b = dep(1); break; }
    case 'perp': {
      // Accept either [point, line] or [line, point]; vision plans are not
      // always consistent about the order.
      const d0 = depObj(0);
      let p = dep(0), base = depObj(1);
      if (!p && d0 && ['line', 'segment', 'ray', 'vector'].includes(d0.type)) { base = d0; p = dep(1); }
      if (!p || !base || !base.valid || !base.g?.d) return null;
      a = p; b = add(p, perp(base.g.d));
      break;
    }
    case 'parallel': {
      const d0 = depObj(0);
      let p = dep(0), base = depObj(1);
      if (!p && d0 && ['line', 'segment', 'ray', 'vector'].includes(d0.type)) { base = d0; p = dep(1); }
      if (!p || !base || !base.valid || !base.g?.d) return null;
      a = p; b = add(p, base.g.d);
      break;
    }
    case 'perpbis': {
      const p = dep(0), q = dep(1); if (!p || !q) return null;
      a = mid(p, q); b = add(a, perp(sub(q, p)));
      break;
    }
    case 'bisector': {
      const p = dep(0), q = dep(1), r = dep(2); if (!p || !q || !r) return null;
      const u = norm(sub(p, q)), w = norm(sub(r, q));
      let d = add(u, w);
      if (len(d) < 1e-9) d = perp(u);
      a = q; b = add(q, d);
      break;
    }
    case 'externalBisector': {
      const p = dep(0), q = dep(1), r = dep(2); if (!p || !q || !r) return null;
      const u = norm(sub(p, q)), w = norm(sub(r, q));
      let d = sub(u, w);
      if (len(d) < 1e-9) d = perp(u);
      a = q; b = add(q, d);
      break;
    }
    case 'bisector2': {
      const l1 = depObj(0), l2 = depObj(1);
      if (!l1 || !l2 || !l1.valid || !l2.valid) return null;
      const hit = lineLine(l1.g.a, l1.g.d, l2.g.a, l2.g.d);
      if (!hit.length) return null;
      const u = norm(l1.g.d), w = norm(l2.g.d);
      let d = (o.branch === 1) ? sub(u, w) : add(u, w);
      if (len(d) < 1e-9) d = perp(u);
      a = hit[0]; b = add(a, d);
      break;
    }
    case 'isogonal': {
      const A = dep(0), B = dep(1), C = dep(2), L = depObj(3);
      if (!A || !B || !C || !L || !L.valid || !L.g) return null;
      const off = Math.abs(cross(L.g.d, sub(B, L.g.a))) / Math.max(1e-9, len(L.g.d));
      if (off > 1e-6 * Math.max(1, dist(A, B) + dist(B, C))) return null;
      const u = norm(sub(A, B)), v = norm(sub(C, B));
      const n = norm(add(u, v));
      if (len(n) < 1e-9) return null;
      const d = norm(L.g.d);
      const out = sub(mul(n, 2 * dot(d, n)), d);
      if (len(out) < 1e-9) return null;
      a = B; b = add(B, out);
      break;
    }
    case 'tangentAt':
    case 'tangentAtPoint': {
      const d0 = depObj(0), d1 = depObj(1);
      let p = dep(0), c = depObj(1);
      if (!p && d0?.type === 'circle') { c = d0; p = dep(1); }
      if (!p || !c?.valid || c.type !== 'circle') return null;
      a = p; b = add(p, perp(sub(p, c.g.center)));
      break;
    }
    case 'tangentFrom': {
      const d0 = depObj(0), d1 = depObj(1);
      let p = dep(0), c = depObj(1);
      if (!p && d0?.type === 'circle') { c = d0; p = dep(1); }
      if (!p || !c?.valid || c.type !== 'circle') return null;
      const pts = tangentPoints(p, c.g.center, c.g.r);
      if (!pts.length) return null;
      const t = pts[Math.min(o.branch || 0, pts.length - 1)];
      a = p; b = t;
      break;
    }
    case 'radical': {
      const c1 = depObj(0), c2 = depObj(1); if (!c1 || !c2 || !c1.valid || !c2.valid) return null;
      const O1 = c1.g.center, O2 = c2.g.center, r1 = c1.g.r, r2 = c2.g.r;
      const dd = dist2(O1, O2); if (dd < 1e-12) return null;
      const t = (dd + r1 * r1 - r2 * r2) / (2 * dd);
      a = add(O1, mul(sub(O2, O1), t)); b = add(a, perp(sub(O2, O1)));
      break;
    }
    case 'altitude': {
      const p = dep(0), base = depObj(1); if (!p || !base || !base.valid) return null;
      a = p; b = add(p, perp(base.g.d));
      break;
    }
    case 'median': {
      const p = dep(0), q = dep(1), r = dep(2); if (!p || !q || !r) return null;
      a = p; b = mid(q, r);
      break;
    }
    case 'euler': {
      const tri = depObj(0); if (!tri || !tri.valid || !tri.metrics) return null;
      const O = tri.metrics.O, H = tri.metrics.H; if (!O || !H) return null;
      a = O; b = H; break;
    }
    case 'simson': {
      const p1 = dep(0), p2 = dep(1); if (!p1 || !p2) return null;
      a = p1; b = p2; break;
    }
    case 'fixedAngle': {
      const p = dep(0), base = depObj(1), src = depObj(2);
      if (!p || !base || !base.valid || !src) return null;
      const ang = objectAngle(src); if (ang == null) return null;
      a = p; b = add(p, rot(norm(base.g.d), (src.sub === 'angle' ? -ang : ang))); break;
    }
    case 'fixedAngle3': {
      const p = dep(0), base = depObj(1), A = dep(2), B = dep(3), C = dep(4);
      if (!p || !base || !base.valid || !A || !B || !C) return null;
      a = p; b = add(p, rot(norm(base.g.d), -directedAngle3(A, B, C))); break;
    }
    case 'polar': {
      const p = dep(0), c = depObj(1);
      if (!p || !c || !c.valid) return null;
      const pol = polarLine(p, c.g.center, c.g.r);
      if (!pol) return null;
      a = pol.a; b = add(pol.a, pol.d); break;
    }
    case 'transform': {
      const src = depObj(0);
      if (!src || !src.valid || !src.g || !['line', 'segment', 'ray', 'vector'].includes(src.type)) return null;
      a = applyPointTransform(o, src.g.a, byId);
      b = applyPointTransform(o, src.g.b, byId);
      if (!a || !b) return null;
      break;
    }
    case 'inversionOfCircle': {
      const src = depObj(0), inv = depObj(1);
      if (!src || !src.valid || !inv || !inv.valid || src.type !== 'circle') return null;
      const v = sub(src.g.center, inv.g.center), d = len(v);
      if (d < EPS) return null;
      if (Math.abs(d * d - src.g.r * src.g.r) > 1e-7 * Math.max(1, d * d)) return null;
      const n = norm(v);
      a = add(inv.g.center, mul(n, (inv.g.r * inv.g.r) / (2 * d)));
      b = add(a, n);
      break;
    }
    default: return null;
  }
  if (!a || !b) return null;
  const d = sub(b, a);
  const L = len(d);
  if (L < 1e-9) return null;
  const u = mul(d, 1 / L);
  return { a: { ...a }, b: { ...b }, d: u, len: L, kind: 'line' };
}

function circleG(o, byId) {
  const dep = (i) => { const d = byId.get(o.deps[i]); return d && d.valid && d.g && d.g.kind === 'point' ? d.g : null; };
  const depObj = (i) => byId.get(o.deps[i]);
  switch (o.sub) {
    case 'centerThrough': {
      const c = dep(0), p = dep(1); if (!c || !p) return null;
      const r = dist(c, p); return r > 1e-9 ? { center: { ...c }, r, kind: 'circle' } : null;
    }
    case 'threePoints': {
      const a = dep(0), b = dep(1), c = dep(2); if (!a || !b || !c) return null;
      const O = circumcenter(a, b, c); if (!O) return null;
      return { center: O, r: dist(O, a), kind: 'circle' };
    }
    case 'diameter': {
      const a = dep(0), b = dep(1); if (!a || !b) return null;
      const r = dist(a, b) / 2; return r > 1e-9 ? { center: mid(a, b), r, kind: 'circle' } : null;
    }
    case 'incircle': {
      const a = dep(0), b = dep(1), c = dep(2); if (!a || !b || !c) return null;
      const m = triangleMetrics(a, b, c); if (!m.valid || !m.I) return null;
      return { center: m.I, r: m.r, kind: 'circle' };
    }
    case 'excircle': {
      const a = dep(0), b = dep(1), c = dep(2); if (!a || !b || !c) return null;
      const m = triangleMetrics(a, b, c); if (!m.valid) return null;
      const I = m.ex[o.index || 0]; if (!I) return null;
      const r = m.exradii[o.index || 0];
      return { center: I, r, kind: 'circle' };
    }
    case 'ninePoint': {
      const a = dep(0), b = dep(1), c = dep(2); if (!a || !b || !c) return null;
      const m = triangleMetrics(a, b, c); if (!m.valid || !m.N) return null;
      return { center: m.N, r: m.R / 2, kind: 'circle' };
    }
    case 'triangleNinePoint': {
      const tri = depObj(0); if (!tri || !tri.valid || !tri.metrics) return null;
      return { center: tri.metrics.N, r: tri.metrics.R / 2, kind: 'circle' };
    }
    case 'triangleIncircle': {
      const tri = depObj(0); if (!tri || !tri.valid || !tri.metrics) return null;
      return { center: tri.metrics.I, r: tri.metrics.r, kind: 'circle' };
    }
    case 'transform': {
      const src = depObj(0);
      if (!src || !src.valid || !src.g || src.type !== 'circle') return null;
      const center = applyPointTransform(o, src.g.center, byId);
      const edge = applyPointTransform(o, add(src.g.center, { x: src.g.r, y: 0 }), byId);
      if (!center || !edge) return null;
      const r = dist(center, edge);
      return r > EPS ? { center, r, kind: 'circle' } : null;
    }
    case 'inversionOfLine': {
      const line = depObj(0), inv = depObj(1);
      if (!line || !line.valid || !inv || !inv.valid || !line.g) return null;
      if (!['line', 'segment', 'ray', 'vector'].includes(line.type)) return null;
      const n = norm(perp(line.g.d));
      const delta = dot(n, sub(line.g.a, inv.g.center));
      if (Math.abs(delta) < 1e-9) return null; // image is the line itself
      const k = (inv.g.r * inv.g.r) / (2 * delta);
      return { center: add(inv.g.center, mul(n, k)), r: Math.abs(k), kind: 'circle' };
    }
    case 'inversionOfCircle': {
      const src = depObj(0), inv = depObj(1);
      if (!src || !src.valid || !inv || !inv.valid || src.type !== 'circle') return null;
      const v = sub(src.g.center, inv.g.center), d2 = dot(v, v);
      const den = d2 - src.g.r * src.g.r;
      if (Math.abs(den) < 1e-9) return null; // image is a line
      const k = (inv.g.r * inv.g.r) / den;
      return { center: add(inv.g.center, mul(v, k)), r: Math.abs(k) * src.g.r, kind: 'circle' };
    }
    case 'tangentAtPoint': {
      const A = dep(0), B = dep(1), line = depObj(2);
      if (!A || !B || !line || !line.valid) return null;
      const n = perp(line.g.d);
      const v = sub(B, A);
      const den = 2 * dot(n, v);
      if (Math.abs(den) < 1e-10) return null;
      const sgn = dot(v, v) / den;
      const center = add(A, mul(n, sgn));
      return { center, r: Math.abs(sgn), kind: 'circle' };
    }
    case 'radiusFrom': {
      const c = dep(0), src = depObj(1); if (!c || !src) return null;
      const r = objectLength(src); if (!r) return null;
      return { center: { ...c }, r, kind: 'circle' };
    }
    case 'centerRadius': {
      const c = dep(0); if (!c || !(o.radius > 0)) return null;
      return { center: { ...c }, r: o.radius, kind: 'circle' };
    }
    default: return null;
  }
}

function triangleG(o, byId) {
  const dep = (i) => { const d = byId.get(o.deps[i]); return d && d.valid && d.g && d.g.kind === 'point' ? d.g : null; };
  const A = dep(0), B = dep(1), C = dep(2);
  if (!A || !B || !C) return null;
  const metrics = triangleMetrics(A, B, C);
  if (!metrics.valid) return null;
  return { kind: 'triangle', vertices: [A, B, C], metrics };
}

function angleG(o, byId) {
  const dep = (i) => { const d = byId.get(o.deps[i]); return d && d.valid && d.g && d.g.kind === 'point' ? d.g : null; };
  const A = dep(0), B = dep(1), C = dep(2);
  if (!A || !B || !C) return null;
  return { kind: 'angle', A, B, C, value: angleAt(A, B, C) };
}

function inversePointAbout(p, inv) {
  const v = sub(p, inv.g.center), d2 = dot(v, v);
  if (d2 < EPS || inv.g.r < EPS) return null;
  return add(inv.g.center, mul(v, (inv.g.r * inv.g.r) / d2));
}

function inversionOfLineCircle(line, inv) {
  const n = norm(perp(line.d));
  const delta = dot(n, sub(line.a, inv.g.center));
  if (Math.abs(delta) < 1e-9) return null;
  const k = (inv.g.r * inv.g.r) / (2 * delta);
  return { center: add(inv.g.center, mul(n, k)), r: Math.abs(k) };
}

function arcImageOfSegment(line, P, Q, inv, rayEnd = false) {
  const C = inversionOfLineCircle(line, inv);
  if (!C) return null;
  const P2 = inversePointAbout(P, inv);
  if (!P2) return null;
  const Q2 = rayEnd ? inv.g.center : inversePointAbout(Q, inv);
  if (!Q2) return null;
  const a1 = Math.atan2(P2.y - C.center.y, P2.x - C.center.x);
  const a2 = Math.atan2(Q2.y - C.center.y, Q2.x - C.center.x);
  const tau = Math.PI * 2;
  const delta = ((a2 - a1) % tau + tau) % tau;
  const mid1 = a1 + delta / 2, mid2 = mid1 + Math.PI;
  const at = (ang) => ({ x: C.center.x + C.r * Math.cos(ang), y: C.center.y + C.r * Math.sin(ang) });
  const useInc = dist(at(mid1), inv.g.center) >= dist(at(mid2), inv.g.center);
  return {
    kind: 'arc', center: C.center, r: C.r, a1, a2,
    anticlockwise: !useInc,
    largeArc: (useInc ? delta : tau - delta) > Math.PI,
  };
}

function arcG(o, byId) {
  const depObj = (i) => byId.get(o.deps[i]);
  const dep = (i) => { const d = depObj(i); return d && d.valid && d.g && d.g.kind === 'point' ? d.g : null; };
  const inv = depObj(o.sub === 'inversionEndpoints' ? 2 : 1);
  if (!inv || !inv.valid || inv.type !== 'circle') return null;
  if (o.sub === 'inversionLine') {
    const src = depObj(0);
    if (!src || !src.valid || !src.g) return null;
    if (!['segment', 'ray', 'vector'].includes(src.type)) return null;
    return arcImageOfSegment(src.g, src.g.a, src.g.b, inv, src.type === 'ray');
  }
  if (o.sub === 'inversionEndpoints') {
    const P = dep(0), Q = dep(1);
    if (!P || !Q) return null;
    return arcImageOfSegment({ a: P, d: sub(Q, P) }, P, Q, inv, false);
  }
  return null;
}

function conicCoefficients(points) {
  if (!points || points.length !== 5) return null;
  const A = points.map((p) => [p.x * p.x, p.x * p.y, p.y * p.y, p.x, p.y, 1]);
  let r = 0;
  const pivots = [];
  for (let c = 0; c < 5 && r < 5; c++) {
    let pivot = -1;
    for (let i = r; i < 5; i++) if (Math.abs(A[i][c]) > Math.abs(pivot < 0 ? 1e-12 : A[pivot][c]) || pivot < 0) { pivot = i; if (Math.abs(A[i][c]) > 1e-8) break; }
    if (pivot < 0 || Math.abs(A[pivot][c]) < 1e-8) continue;
    [A[r], A[pivot]] = [A[pivot], A[r]];
    const div = A[r][c];
    for (let j = c; j < 6; j++) A[r][j] /= div;
    for (let i = 0; i < 5; i++) {
      if (i === r) continue;
      const f = A[i][c];
      if (Math.abs(f) < 1e-14) continue;
      for (let j = c; j < 6; j++) A[i][j] -= f * A[r][j];
    }
    pivots.push(c); r++;
  }
  const free = [...Array(6).keys()].find((c) => !pivots.includes(c));
  if (free == null) return null;
  const x = new Array(6).fill(0); x[free] = 1;
  for (let i = 0; i < pivots.length; i++) x[pivots[i]] = -A[i][free];
  const max = Math.max(...x.map(Math.abs));
  if (!Number.isFinite(max) || max < 1e-10) return null;
  return x.map((v) => v / max);
}

export function conicValue(g, p) {
  if (!g?.coeffs) return NaN;
  const [A, B, C, D, E, F] = g.coeffs;
  return A * p.x * p.x + B * p.x * p.y + C * p.y * p.y + D * p.x + E * p.y + F;
}

function lineFoot(line, p) {
  const a = line.a, d = line.d;
  const dd = d.x * d.x + d.y * d.y;
  if (dd < 1e-14) return null;
  const t = ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / dd;
  return { x: a.x + d.x * t, y: a.y + d.y * t };
}

function det4(rows) {
  const m = rows;
  return m[0][0] * (m[1][1] * (m[2][2] * m[3][3] - m[2][3] * m[3][2]) - m[1][2] * (m[2][1] * m[3][3] - m[2][3] * m[3][1]) + m[1][3] * (m[2][1] * m[3][2] - m[2][2] * m[3][1]))
    - m[0][1] * (m[1][0] * (m[2][2] * m[3][3] - m[2][3] * m[3][2]) - m[1][2] * (m[2][0] * m[3][3] - m[2][3] * m[3][0]) + m[1][3] * (m[2][0] * m[3][2] - m[2][2] * m[3][0]))
    + m[0][2] * (m[1][0] * (m[2][1] * m[3][3] - m[2][3] * m[3][1]) - m[1][1] * (m[2][0] * m[3][3] - m[2][3] * m[3][0]) + m[1][3] * (m[2][0] * m[3][1] - m[2][1] * m[3][0]))
    - m[0][3] * (m[1][0] * (m[2][1] * m[3][2] - m[2][2] * m[3][1]) - m[1][1] * (m[2][0] * m[3][2] - m[2][2] * m[3][0]) + m[1][2] * (m[2][0] * m[3][1] - m[2][1] * m[3][0]));
}

export function qlcu1Value(g, p) {
  if (!g?.lines || g.lines.length !== 4) return NaN;
  const feet = [];
  for (const l of g.lines) {
    const f = lineFoot(l, p);
    if (!f) return NaN;
    feet.push(f);
  }
  let cx = 0, cy = 0;
  for (const f of feet) { cx += f.x; cy += f.y; }
  cx /= 4; cy /= 4;
  let scale = 1;
  for (const f of feet) scale = Math.max(scale, Math.hypot(f.x - cx, f.y - cy));
  const rows = feet.map((f) => {
    const x = (f.x - cx) / scale, y = (f.y - cy) / scale;
    return [x * x + y * y, x, y, 1];
  });
  return det4(rows);
}

function curveG(o, byId) {
  if (o.sub === 'conic') {
    const pts = (o.deps || []).map((id) => byId.get(id)).filter((d) => d && d.valid && d.g?.kind === 'point').map((d) => d.g);
    if (pts.length !== 5) return null;
    const coeffs = conicCoefficients(pts);
    if (!coeffs) return null;
    return { kind: 'curve', sub: 'conic', coeffs, points: pts };
  }
  if (o.sub === 'qlcu1') {
    const lines = (o.deps || []).map((id) => byId.get(id)).filter((d) => d && d.valid && d.g && ['line', 'segment', 'ray', 'vector'].includes(d.type)).map((d) => ({ a: d.g.a, d: d.g.d }));
    if (lines.length !== 4 || lines.some((l) => !l.d || Math.hypot(l.d.x, l.d.y) < 1e-9)) return null;
    return { kind: 'curve', sub: 'qlcu1', lines };
  }
  return null;
}

export function computeObject(o, byId) {
  let g = null;
  if (o.type === 'point') g = pointG(o, byId);
  else if (['line', 'segment', 'ray', 'vector'].includes(o.type)) g = lineG(o, byId);
  else if (o.type === 'circle') g = circleG(o, byId);
  else if (o.type === 'arc') g = arcG(o, byId);
  else if (o.type === 'curve') g = curveG(o, byId);
  else if (o.type === 'triangle') g = triangleG(o, byId);
  else if (o.type === 'angle') g = angleG(o, byId);
  else if (o.type === 'polygon') {
    const pts = o.deps.map((id) => byId.get(id)).filter((x) => x && x.valid).map((x) => x.g);
    if (pts.length >= 3) g = { kind: 'polygon', points: pts };
  } else if (o.type === 'text') {
    g = { kind: 'text', x: o.x, y: o.y, text: o.text || '' };
  } else if (o.type === 'measure') {
    if (o.sub === 'angle2') {
      const a = byId.get(o.deps[0]), b = byId.get(o.deps[1]);
      const c1 = curveOf(a), c2 = curveOf(b);
      if (c1 && c2) {
        const hit = intersectionOfCurves(c1, c2);
        g = {
          kind: 'measure', mode: 'angle2', vertex: hit.length ? hit[0] : c1.a,
          dirs: [norm(c1.d), norm(c2.d)],
        };
      }
    } else {
      const pts = o.deps.map((id) => byId.get(id)).filter((x) => x && x.valid).map((x) => x.g);
      if (pts.length >= 2) g = { kind: 'measure', points: pts };
    }
  }
  if (g) { o.g = g; o.valid = true; o.error = null; }
  else { o.g = null; o.valid = false; o.error = '构造退化'; }
  return o;
}

function topoOrder(state) {
  const map = new Map(state.objects.map((o) => [o.id, o]));
  const result = [], seen = new Set(), temp = new Set();
  const visit = (o) => {
    if (!o || seen.has(o.id)) return;
    if (temp.has(o.id)) return;
    temp.add(o.id);
    for (const d of o.deps || []) visit(map.get(d));
    temp.delete(o.id); seen.add(o.id); result.push(o);
  };
  for (const o of state.objects) visit(o);
  return result;
}

let lastComputeMs = 0;
export function recompute(state) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const order = topoOrder(state);
  const byId = new Map(order.map((o) => [o.id, o]));
  let valid = 0, invalid = 0;
  for (const o of order) {
    computeObject(o, byId);
    if (o.valid) valid++; else invalid++;
    if (o.type === 'triangle' && o.valid && o.g) o.metrics = o.g.metrics;
  }
  lastComputeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { valid, invalid, ms: lastComputeMs };
}
export function computeStats() { return { ms: lastComputeMs }; }

/* ------------------------- triangle helpers ------------------------------ */
export function addTriangle(state, aId, bId, cId, opts = {}) {
  const tri = addObject(state, {
    type: 'triangle', sub: 'triangle', label: opts.label || '',
    deps: [aId, bId, cId], visible: true,
    style: { color: '#7aa2ff', width: .8, fill: 'rgba(122,162,255,.035)', dash: 0 },
    centers: {},
    show: { euler: false, ninePoint: false, incircle: false, circumcircle: false, medians: false, altitudes: false, bisectors: false, orthic: false, ...(opts.show || {}) },
    meta: { autoCenters: opts.centers === true, ...(opts.meta || {}) },
  });
  recompute(state);
  if (opts.centers === true) ensureCenters(state, tri.id, opts.centerKeys || CORE_CENTERS);
  return tri;
}

export function ensureCenters(state, triId, keys = CORE_CENTERS) {
  const tri = objectById(state, triId);
  if (!tri || tri.type !== 'triangle') return [];
  tri.centers = tri.centers || {};
  const out = [];
  for (const key of keys) {
    if (tri.centers[key] && objectById(state, tri.centers[key])) { out.push(tri.centers[key]); continue; }
    const def = centerDef(key);
    const p = addObject(state, {
      type: 'point', sub: 'triangleCenter', label: uniqueLabel(state, def.label),
      deps: [triId], centerKey: key, visible: true,
      style: { color: '#263342', pointSize: 3.2, width: 1.1 },
      meta: { triangle: triId, centerKey: key, name: def.name, system: true, centerColor: def.color },
    });
    tri.centers[key] = p.id;
    out.push(p.id);
  }
  recompute(state);
  return out;
}

export function removeCenter(state, triId, key) {
  const tri = objectById(state, triId); if (!tri || !tri.centers) return;
  const id = tri.centers[key]; if (!id) return;
  delete tri.centers[key];
  removeObjects(state, [id]);
}

export function ensureTriangleCircle(state, triId, sub = 'ninePoint') {
  const tri = objectById(state, triId); if (!tri) return null;
  const existing = state.objects.find((o) => o.type === 'circle' && o.sub === sub && o.deps[0] === triId);
  if (existing) { existing.visible = true; return existing; }
  return addObject(state, {
    type: 'circle', sub, deps: [triId], label: '',
    style: { color: sub === 'ninePoint' ? '#c084fc' : '#34d399', width: .95, dash: sub === 'ninePoint' ? 5 : 0, fill: 'transparent' },
    meta: { system: true, triangle: triId },
  });
}

export function ensureEulerLine(state, triId) {
  const tri = objectById(state, triId); if (!tri) return null;
  const existing = state.objects.find((o) => ['line', 'segment'].includes(o.type) && o.sub === 'euler' && o.deps[0] === triId);
  if (existing) { existing.visible = true; return existing; }
  return addObject(state, {
    type: 'line', sub: 'euler', deps: [triId], label: '',
    style: { color: '#f6c76b', width: .9, dash: 6, fill: 'transparent' },
    meta: { system: true, triangle: triId },
  });
}

export function findTriangles(state) {
  const pts = state.objects.filter((o) => o.type === 'point' && o.valid && o.visible);
  const segs = state.objects.filter((o) => o.type === 'segment' && o.valid);
  const adj = new Map();
  for (const s of segs) {
    if (s.deps.length !== 2) continue;
    if (!adj.has(s.deps[0])) adj.set(s.deps[0], new Set());
    if (!adj.has(s.deps[1])) adj.set(s.deps[1], new Set());
    adj.get(s.deps[0]).add(s.deps[1]); adj.get(s.deps[1]).add(s.deps[0]);
  }
  const found = new Map();
  const ids = pts.map((p) => p.id);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let k = j + 1; k < ids.length; k++) {
    const a = ids[i], b = ids[j], c = ids[k];
    if (adj.get(a)?.has(b) && adj.get(b)?.has(c) && adj.get(c)?.has(a)) {
      const key = [a, b, c].sort().join('|');
      if (!found.has(key)) {
        const P = objectById(state, a), Q = objectById(state, b), R = objectById(state, c);
        const m = triangleMetrics(P.g, Q.g, R.g);
        if (m.valid) found.set(key, { key, ids: [a, b, c], labels: [P.label, Q.label, R.label], metrics: m });
      }
    }
  }
  for (const t of state.objects.filter((o) => o.type === 'triangle' && o.valid)) {
    const [a, b, c] = t.deps;
    const P = objectById(state, a), Q = objectById(state, b), R = objectById(state, c);
    if (!P || !Q || !R) continue;
    const key = [a, b, c].sort().join('|');
    if (!found.has(key)) found.set(key, { key, ids: [a, b, c], labels: [P.label, Q.label, R.label], metrics: t.g.metrics, triId: t.id });
    else found.get(key).triId = t.id;
  }
  return [...found.values()];
}

export function triangleForVertices(state, ids) {
  const key = [...ids].sort().join('|');
  return state.objects.find((o) => o.type === 'triangle' && [...o.deps].sort().join('|') === key) || null;
}

export function nearestCenter(metrics, p, tol = 1e-5) {
  let best = null;
  for (const def of CENTER_DEFS) {
    const c = metrics.centers[def.key];
    if (!c) continue;
    const d = dist(p, c);
    if (d < tol * Math.max(1, metrics.R) && (!best || d < best.d)) best = { ...def, point: c, d };
  }
  return best;
}

/* ------------------------------ analysis --------------------------------- */
export function pointOnSegment(p, a, b, tol = 1e-7) {
  const ab = sub(b, a), ap = sub(p, a);
  const t = dot(ap, ab) / Math.max(EPS, dot(ab, ab));
  if (t < -tol || t > 1 + tol) return false;
  return distToLine(p, a, ab) < tol;
}

export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
}

export function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/* --------------------------- demo construction --------------------------- */
export function basicTriangleScene() {
  const st = createState('三角形 ABC');
  // BC horizontal, A above BC; ∠A:∠B:∠C = 70°:60°:50°.
  const B = addObject(st, { type: 'point', sub: 'free', x: -3, y: 0, label: 'B', style: { color: '#263342' } });
  const C = addObject(st, { type: 'point', sub: 'free', x: 3, y: 0, label: 'C', style: { color: '#263342' } });
  const A = addObject(st, { type: 'point', sub: 'free', x: -0.5543775927, y: 4.2359422656, label: 'A', style: { color: '#263342' } });
  recompute(st);
  addObject(st, { type: 'segment', sub: 'through', deps: [A.id, B.id], style: { width: 1.15, color: '#3d4c63' } });
  addObject(st, { type: 'segment', sub: 'through', deps: [B.id, C.id], style: { width: 1.15, color: '#3d4c63' } });
  addObject(st, { type: 'segment', sub: 'through', deps: [C.id, A.id], style: { width: 1.15, color: '#3d4c63' } });
  const tri = addTriangle(st, A.id, B.id, C.id, {
    centers: false,
    show: { euler: false, ninePoint: false, incircle: false, circumcircle: false, medians: false, altitudes: false, bisectors: false, orthic: false },
  });
  tri.style.fill = 'transparent';
  recompute(st);
  st.view.scale = 90;
  return { state: st, triangle: tri };
}

export function defaultScene() {
  const st = createState('五心与欧拉线');
  const B = addObject(st, { type: 'point', sub: 'free', x: -3, y: 0, label: 'B', style: { color: '#ff7a59' } });
  const C = addObject(st, { type: 'point', sub: 'free', x: 3, y: 0, label: 'C', style: { color: '#ff7a59' } });
  const A = addObject(st, { type: 'point', sub: 'free', x: -0.5543775927, y: 4.2359422656, label: 'A', style: { color: '#ff7a59' } });
  recompute(st);
  addObject(st, { type: 'segment', sub: 'through', deps: [A.id, B.id], style: { width: 1.2, color: '#3d4c63' } });
  addObject(st, { type: 'segment', sub: 'through', deps: [B.id, C.id], style: { width: 1.2, color: '#3d4c63' } });
  addObject(st, { type: 'segment', sub: 'through', deps: [C.id, A.id], style: { width: 1.2, color: '#3d4c63' } });
  addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id], label: 'ω', style: { color: '#7aa2ff', width: .85, dash: 0, fill: 'transparent', opacity: .55 } });
  recompute(st);
  const tri = addTriangle(st, A.id, B.id, C.id, {
    centers: true, centerKeys: ['G', 'O', 'I', 'H', 'N'],
    show: { euler: true, ninePoint: true, incircle: true, circumcircle: false, medians: false, altitudes: false, bisectors: false, orthic: true },
  });
  recompute(st);
  st.meta.scenarioId = 'euler-ninepoint';
  st.view.scale = 78;
  return { state: st, triangle: tri };
}
