/* ==========================================================================
   GeoMind · screenshot → construction
   Converts a structured vision-model response into a live, draggable board.
   ========================================================================== */
import {
  createState, addObject, addTriangle, recompute, objectById, uniqueLabel,
  ensureCenters, triangleForVertices, angleAt, clamp, projectOnLine, lerp, dist,
  curveOf, intersectionOfCurves, circumcenter,
} from './geometry.js';
import { solveConstraints, constraintNorm } from './constraints.js';
import { normalizeVisionPlan } from './vision-plan.js';

const CENTER_KEYS = {
  orthocenter: 'H', circumcenter: 'O', incenter: 'I', centroid: 'G', ninepoint: 'N',
  excenterA: 'IA', excenterB: 'IB', excenterC: 'IC',
};
const DEFAULT_TRIANGLE = {
  A: [-0.5543775927, 4.2359422656],
  B: [-3, 0],
  C: [3, 0],
};

function arrLocal(v) { return Array.isArray(v) ? v : []; }
function pair(v) { return Array.isArray(v) ? v : [v?.x ?? 0, v?.y ?? 0]; }
function normCoord(c) {
  if (!c) return null;
  if (Array.isArray(c)) return [Number(c[0]), Number(c[1])];
  if (typeof c === 'object') return [Number(c.x), Number(c.y)];
  return null;
}
function worldFromNorm(c) {
  const p = normCoord(c);
  if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
  return { x: (p[0] - .5) * 11, y: (.5 - p[1]) * 9.5 };
}

function placePoint(st, name, world, style = {}) {
  return addObject(st, {
    type: 'point', sub: 'free', x: world.x, y: world.y,
    label: uniqueLabel(st, name || 'P'),
    style: { color: '#263342', pointSize: 3.0, ...style },
  });
}

function planCircleLabel(name) {
  if (!name || name === 'omega' || name === 'Omega') return 'ω';
  if (name === 'omega1' || name === 'Omega1') return 'ω₁';
  if (name === 'omega2' || name === 'Omega2') return 'ω₂';
  return name;
}


function inferGoalFromText(data, labels) {
  const text = String(data?.problem_text || '');
  const claim = /证明|求证/.test(text) ? text.slice(Math.max(text.lastIndexOf('证明'), text.lastIndexOf('求证'))) : text;
  const id = (n) => labels.get(n)?.id;
  const lineId = (pair) => {
    const a = id(pair[0]), b = id(pair[1]);
    if (!a || !b) return null;
    const found = [...labels.values()].find((o) => ['line', 'segment', 'ray', 'vector'].includes(o.type) && o.deps?.includes(a) && o.deps?.includes(b));
    return found?.id || null;
  };
  let m = claim.match(/证明[：:]\s*([A-Z](?:[、,，][A-Z]){2,})[^。]{0,20}共圆/);
  if (m) {
    const ids = [...new Set(m[1].match(/[A-Z]/g) || [])].map(id).filter(Boolean);
    if (ids.length >= 4) return { kind: 'concyclic', ids, title: '四点共圆', statement: m[0], source: 'vision' };
  }
  m = claim.match(/证明[：:]\s*([A-Z](?:[、,，][A-Z]){2,})[^。]{0,12}共线/);
  if (m) {
    const ids = [...new Set(m[1].match(/[A-Z]/g) || [])].map(id).filter(Boolean);
    if (ids.length >= 3) return { kind: 'collinear', ids, title: '三点共线', statement: m[0], source: 'vision' };
  }
  m = claim.match(/∠\s*([A-Z])\s*([A-Z])\s*([A-Z])\s*=\s*∠\s*([A-Z])\s*([A-Z])\s*([A-Z])/);
  if (m) {
    const angles = [[m[1], m[2], m[3]].map(id), [m[4], m[5], m[6]].map(id)];
    if (angles.every((a) => a.length === 3 && a.every(Boolean))) return { kind: 'equalAngle', angles, title: '两角相等', statement: m[0], source: 'vision' };
  }
  m = claim.match(/证明[：:][^。]{0,40}?([A-Z][A-Z])\s*[⊥]\s*([A-Z][A-Z])/);
  if (m) {
    const lines = [lineId([m[1][0], m[1][1]]), lineId([m[2][0], m[2][1]])].filter(Boolean);
    if (lines.length === 2) return { kind: 'perpendicular', lineIds: lines, title: '两线垂直', statement: m[0], source: 'vision' };
  }
  m = claim.match(/证明[：:][^。]{0,40}?([A-Z][A-Z])\s*[∥]\s*([A-Z][A-Z])/);
  if (m) {
    const lines = [lineId([m[1][0], m[1][1]]), lineId([m[2][0], m[2][1]])].filter(Boolean);
    if (lines.length === 2) return { kind: 'parallel', lineIds: lines, title: '两线平行', statement: m[0], source: 'vision' };
  }
  m = claim.match(/⊙\s*([A-Za-z0-9_]+)\s*与\s*⊙\s*([A-Za-z0-9_]+)\s*相切/);
  if (m) {
    const findCircle = (name) => {
      const cands = [name, `omega_${name}`, `omega${name}`, `circle${name}`, `circle_${name}`, `ω${name}`];
      for (const c of cands) {
        const o = labels.get(c);
        if (o?.type === 'circle') return o;
      }
      return [...labels.values()].find((o) => o.type === 'circle' && o.label && o.label.includes(name)) || null;
    };
    const c1 = findCircle(m[1]), c2 = findCircle(m[2]);
    if (c1 && c2) return { kind: 'tangent', circleIds: [c1.id, c2.id], title: '两圆相切', statement: m[0], source: 'vision' };
  }
  m = claim.match(/([A-Z][A-Z])\s*=\s*([A-Z][A-Z])/);
  if (m) {
    const pairs = [[id(m[1][0]), id(m[1][1])], [id(m[2][0]), id(m[2][1])]].filter((p) => p.every(Boolean));
    if (pairs.length === 2) return { kind: 'equalLength', pairs, title: '两线段相等', statement: m[0], source: 'vision' };
  }
  return null;
}

function collectFreeAncestors(st, startIds) {
  const byId = new Map(st.objects.map((o) => [o.id, o]));
  const out = new Set();
  const seen = new Set();
  const walk = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const o = byId.get(id);
    if (!o) return;
    if (o.type === 'point' && o.sub === 'free' && o.label) out.add(o.label);
    for (const d of o.deps || []) walk(d);
  };
  for (const id of startIds || []) walk(id);
  return [...out];
}

function buildConstructionState(data) {
  const st = createState(data?.title || '识图构型');
  const labels = new Map();
  const plan = normalizeVisionPlan(data);
  st.meta.visionNotes = plan.notes || [];
  // Parse simple product relations such as BX·AC = CY·AB and turn the
  // dependent on-line point into a ratio-derived point.
  try {
    const text = String(data.problem_text || "");
    const m = text.match(/([A-Za-z])([A-Za-z])\s*[·*×]\s*([A-Za-z])([A-Za-z])\s*=\s*([A-Za-z])([A-Za-z])\s*[·*×]\s*([A-Za-z])([A-Za-z])/);
    if (m) {
      const specs = new Map(plan.construction.map((x) => [x.label, x]));
      const [, a1, a2, b1, b2, c1, c2, d1, d2] = m;
      // Pattern BX·AC = CY·AB: derive the second on-line point from the first.
      const X = specs.get(a2), Y = specs.get(c2);
      if (X?.sub === 'pointOnLine' && Y?.sub === 'pointOnLine') {
        Y.sub = 'ratioDistanceOnLine';
        Y.deps = [a2, a1, c1, b1];
        Y.coordinate = undefined;
        Y.at = undefined;
      }
    }
  } catch {}
  const pending = [...plan.construction];
  const refCoord = new Map((data.points || []).filter((p) => p?.name && p.coordinate).map((p) => [p.name, p.coordinate]));
  const extraConstraints = [];
  try {
    const text = String(data.problem_text || '');
    const specs = new Map(pending.map((x) => [x.label, x]));
    const para = text.match(/平行四边形\s*([A-Za-z])\s*([A-Za-z])\s*([A-Za-z])\s*([A-Za-z])/);
    if (para) {
      const [, a, b, c, d] = para;
      if (!specs.has(d) && ['A','B','C','D'].every((x) => specs.has(x) || x === d)) {
        pending.push({ type: 'point', sub: 'parallelogramFourth', label: d, deps: [a, b, c] });
      } else if (specs.get(d)?.sub === 'free') {
        const sd = specs.get(d);
        sd.sub = 'parallelogramFourth';
        sd.deps = [a, b, c];
        sd.at = undefined;
      }
      if (!specs.has(c) && specs.has(a) && specs.has(b)) {
        pending.push({ type: 'point', sub: 'free', label: c, at: refCoord.get(c) });
      }
    }
    for (const m of text.matchAll(/([A-Za-z])([A-Za-z])\s*=\s*([A-Za-z])([A-Za-z])/g)) {
      const [, a, b, c, d] = m;
      if ([a,b,c,d].every((x) => specs.has(x) || x === 'A' || x === 'B' || x === 'C' || x === 'D')) {
        extraConstraints.push({ kind: 'equalLength', pairs: [[a,b],[c,d]] });
      }
    }
  } catch {}
  const norm = (c) => worldFromNorm(c) || { x: 0, y: 0 };
  const targetCoord = (spec) => spec.coordinate || spec.at || refCoord.get(spec.label) || null;
  const resolvePlanCurve = (name) => {
    if (labels.get(name)) return labels.get(name);
    const line = String(name || '').match(/^(?:line)?([A-Za-z])([A-Za-z])$/);
    if (line && !labels.get(name)) {
      const a = labels.get(line[1]), b = labels.get(line[2]);
      if (a?.valid && b?.valid) {
        const o = addObject(st, { type: 'line', sub: 'through', deps: [a.id, b.id], visible: false });
        labels.set(name, o); return o;
      }
    }
    const circle = String(name || '').match(/^circle([A-Za-z])([A-Za-z])([A-Za-z])$/);
    if (circle) {
      const ps = [circle[1], circle[2], circle[3]].map((x) => labels.get(x));
      if (ps.every((p) => p?.valid)) {
        const o = addObject(st, { type: 'circle', sub: 'threePoints', deps: ps.map((p) => p.id), label: uniqueLabel(st, 'ω'), style: { fill: 'transparent' } });
        labels.set(name, o); return o;
      }
    }
    return null;
  };
  for (let pass = 0; pass < 16 && pending.length; pass++) {
    recompute(st);
    let changed = false;
    for (let i = 0; i < pending.length; i++) {
      const spec = pending[i]; if (!spec || !spec.type) { pending.splice(i, 1); i--; continue; }
      // Re-evaluate just-added dependencies so this spec sees their geometry.
      recompute(st);
      const id = (name) => labels.get(name)?.id;
      const obj = (name) => labels.get(name);
      const deps = (spec.deps || []).map((name) => id(name) || resolvePlanCurve(name)?.id);
      try {
        if (spec.type === 'point') {
          let sub = spec.sub || 'free';
          if (sub === 'triangleCenter' && deps.length === 3 && (spec.center === 'circumcenter' || spec.centerKey === 'O')) sub = 'circumcenter';
          if (sub === 'free') {
            const p = norm(spec.at || spec.coordinate || refCoord.get(spec.label));
            const o = addObject(st, { type: 'point', sub: 'free', x: p.x, y: p.y, label: spec.label || uniqueLabel(st, 'P'), visible: spec.visible !== false });
            labels.set(spec.label, o); pending.splice(i, 1); i--; changed = true; continue;
          }
          if (deps.some((x) => !x)) {
            // Dependencies may simply not have been built yet in this pass;
            // wait for a later pass instead of degrading to a free point.
            continue;
          }
          let pointDeps = deps;
          let pointT = spec.t;
          if (sub === 'pointOnLine' && deps.length === 1) {
            const curve = obj((spec.deps || [])[0]);
            if (curve && !curve.g) continue;
            if (curve && curve.g && ['line', 'segment', 'ray'].includes(curve.type) && (spec.at || spec.coordinate)) {
              const target = norm(targetCoord(spec)), a = curve.g.a, b = curve.g.b;
              if (curve.type === 'segment') {
                const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
                pointT = clamp(((target.x - a.x) * dx + (target.y - a.y) * dy) / L2, .02, .98);
              } else {
                pointT = (target.x - a.x) * curve.g.d.x + (target.y - a.y) * curve.g.d.y;
              }
            }
          }
          if (sub === 'pointOnLine' && deps.length === 2 && obj((spec.deps || [])[0])?.type === 'point' && obj((spec.deps || [])[1])?.type === 'point') {
            const a = obj((spec.deps || [])[0]).g, b = obj((spec.deps || [])[1]).g;
            const seg = addObject(st, { type: 'segment', sub: 'through', deps, visible: false });
            pointDeps = [seg.id];
            const target = targetCoord(spec) ? norm(targetCoord(spec)) : a;
            const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
            pointT = clamp(((target.x - a.x) * dx + (target.y - a.y) * dy) / L2, .02, .98);
          }
          let branch = spec.branch || 0;
          if (sub === 'intersection') {
            const c1 = obj((spec.deps || [])[0]), c2 = obj((spec.deps || [])[1]);
            if (c1 && c2 && !c1.g) continue;
            if (c1 && c2 && !c2.g) continue;
            if (c1 && c2) {
              let hits = intersectionOfCurves(curveOf(c1), curveOf(c2));
              if (!hits.length) {
                // A circle meeting a segment may only meet its extension; the
                // problem text almost always means the full line.
                const inf = (cv) => cv && cv.kind === 'line' ? { ...cv, bounds: null } : cv;
                hits = intersectionOfCurves(inf(curveOf(c1)), inf(curveOf(c2)));
              }
              if (hits.length > 1) {
                if (targetCoord(spec)) {
                  const target = norm(targetCoord(spec)); let bi = 0, bd = Infinity;
                  hits.forEach((h, k) => { const d = Math.hypot(h.x - target.x, h.y - target.y); if (d < bd) { bd = d; bi = k; } });
                  branch = bi;
                } else {
                  // If two curves share a constructed point (e.g. line FA and circle ABP share A),
                  // the other intersection is the meaningful one (P/Q), not the shared endpoint.
                  const onCurve = (q, cv) => {
                    if (!q || !cv) return false;
                    if (cv.kind === 'circle') return Math.abs(dist(q, cv.center) - cv.r) < 0.05;
                    const u = { x: q.x - cv.a.x, y: q.y - cv.a.y };
                    return Math.abs(u.x * cv.d.y - u.y * cv.d.x) / Math.max(1e-9, Math.hypot(cv.d.x, cv.d.y)) < 0.05;
                  };
                  const sharedPts = (c1.deps || []).filter((d) => (c2.deps || []).includes(d) && st.objects.find((o) => o.id === d)?.type === 'point')
                    .map((d) => st.objects.find((o) => o.id === d)).filter((o) => o?.g);
                  let sp = null, spScore = -1;
                  for (const q of sharedPts) {
                    const sc = (onCurve(q.g, curveOf(c1)) ? 1 : 0) + (onCurve(q.g, curveOf(c2)) ? 1 : 0);
                    if (sc > spScore) { spScore = sc; sp = q.g; }
                  }
                  if (sp) {
                    let bi = 0, bd = -1;
                    hits.forEach((h, k) => { const d = Math.hypot(h.x - sp.x, h.y - sp.y); if (d > bd) { bd = d; bi = k; } });
                    branch = bi;
                  }
                }
              }
            }
          }
          if (sub === 'tangentCirclePoint' && pointDeps.length === 3 && targetCoord(spec)) {
            const seg = obj((spec.deps || [])[2]);
            const q = norm(targetCoord(spec));
            if (seg?.g) { const a = seg.g.a, b = seg.g.b; const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1; pointT = clamp(((q.x - a.x) * dx + (q.y - a.y) * dy) / L2, .03, .97); }
          }
          let pointTheta = spec.theta;
          if (sub === 'pointOnCircle' || sub === 'angleEqualOnCircle') {
            const c = obj((spec.deps || [])[0]);
            if (!c?.g?.center) continue;
            if (targetCoord(spec)) { const q = norm(targetCoord(spec)); pointTheta = Math.atan2(q.y - c.g.center.y, q.x - c.g.center.x); }
          }
          if (sub === 'pointOnRay' && pointDeps.length === 1) {
            const ray = obj((spec.deps || [])[0]);
            if (ray?.g && targetCoord(spec)) {
              const q = norm(targetCoord(spec)); pointT = dist(ray.g.a, q);
            }
          }
          const o = addObject(st, {
            type: 'point', sub, deps: pointDeps, branch, t: pointT, theta: pointTheta,
            factor: spec.factor, centerKey: spec.centerKey, center: spec.center, side: spec.side, sideNames: spec.sideNames,
            index: spec.index, sign: spec.sign,
            label: spec.label || uniqueLabel(st, 'P'), visible: spec.visible !== false,
          });
          labels.set(spec.label, o); pending.splice(i, 1); i--; changed = true; continue;
        }
        if (['line', 'segment', 'ray', 'vector'].includes(spec.type)) {
          if (deps.some((x) => !x)) continue;
          const o = addObject(st, { type: spec.type, sub: spec.sub || 'through', deps, label: spec.label || '', visible: spec.visible !== false, style: spec.style || {} });
          if (spec.label) labels.set(spec.label, o); pending.splice(i, 1); i--; changed = true; continue;
        }
        if (spec.type === 'circle') {
          if (deps.some((x) => !x)) continue;
          const o = addObject(st, { type: 'circle', sub: spec.sub || 'threePoints', deps, label: spec.label ? planCircleLabel(spec.label) : uniqueLabel(st, 'ω'), radius: spec.radius, visible: spec.visible !== false, style: { fill: 'transparent', ...(spec.style || {}) } });
          if (spec.label) labels.set(spec.label, o); pending.splice(i, 1); i--; changed = true; continue;
        }
        if (spec.type === 'polygon') {
          if (deps.some((x) => !x)) continue;
          const o = addObject(st, { type: 'polygon', sub: 'polygon', deps, label: spec.label || '', visible: spec.visible !== false, style: { fill: 'rgba(122,162,255,.06)', ...(spec.style || {}) } });
          if (spec.label) labels.set(spec.label, o); pending.splice(i, 1); i--; changed = true; continue;
        }
      } catch (e) { console.warn('construction object failed', spec, e); }
    }
    if (!changed) break;
  }
  // Draw the top-level segments / lines / circles as well.  The construction
  // array describes dependencies, but the model often lists the visible
  // triangle sides and cevians only in the `segments` / `lines` arrays.
  const pairKey = (a, b) => [a, b].sort().join('|');
  const existingSeg = (aId, bId) => st.objects.find((o) => o.type === 'segment' && pairKey(o.deps[0], o.deps[1]) === pairKey(aId, bId));
  const existingLine = (aId, bId) => st.objects.find((o) => ['line', 'ray', 'vector'].includes(o.type) && o.deps?.length === 2 && pairKey(o.deps[0], o.deps[1]) === pairKey(aId, bId));
  for (const pair of (Array.isArray(data.segments) ? data.segments : [])) {
    if (!Array.isArray(pair)) continue;
    const a = labels.get(pair[0]), b = labels.get(pair[1]);
    if (!a?.valid || !b?.valid) continue;
    if (existingSeg(a.id, b.id)) { existingSeg(a.id, b.id).visible = true; continue; }
    const dup = existingLine(a.id, b.id);
    if (dup) dup.visible = false;
    addObject(st, { type: 'segment', sub: 'through', deps: [a.id, b.id], style: { color: '#3d4c63', width: 1.05 } });
  }
  for (const pair of (Array.isArray(data.lines) ? data.lines : [])) {
    if (!Array.isArray(pair)) continue;
    const a = labels.get(pair[0]), b = labels.get(pair[1]);
    if (!a?.valid || !b?.valid) continue;
    if (existingLine(a.id, b.id) || existingSeg(a.id, b.id)) continue;
    addObject(st, { type: 'line', sub: 'through', deps: [a.id, b.id], style: { color: '#3d4c63', width: 1.0 } });
  }
  // Ensure collinear triples added by the compiler are visibly connected
  // (e.g. X,B,A and Y,C,A), even if the model did not list that segment.
  for (const c of plan.constraints || []) {
    if (c.kind !== 'collinear' || !Array.isArray(c.points) || c.points.length < 3) continue;
    const a = labels.get(c.points[0]), b = labels.get(c.points[1]);
    if (!a?.valid || !b?.valid) continue;
    if (existingLine(a.id, b.id) || existingSeg(a.id, b.id)) continue;
    addObject(st, { type: 'segment', sub: 'through', deps: [a.id, b.id], style: { color: '#3d4c63', width: 1.05 } });
  }
  for (const c of (Array.isArray(data.circles) ? data.circles : [])) {
    if (!c?.name) continue;
    const cur = labels.get(c.name);
    if (cur?.type === 'circle') continue;
    const thru = arrLocal(c.through);
    if (thru.length >= 3) {
      const ps = thru.slice(0, 3).map((n) => labels.get(n));
      if (ps.every((p) => p?.valid)) {
        const o = addObject(st, { type: 'circle', sub: 'threePoints', deps: ps.map((p) => p.id), label: c.name, style: { fill: 'transparent' } });
        labels.set(c.name, o);
      }
    } else if (c.center) {
      const cp = labels.get(c.center), tp = labels.get(typeof c.through === 'string' ? c.through : thru[0]);
      if (cp?.valid && tp?.valid) {
        const o = addObject(st, { type: 'circle', sub: 'centerThrough', deps: [cp.id, tp.id], label: c.name, style: { fill: 'transparent' } });
        labels.set(c.name, o);
      }
    }
  }
  if (!labels.size) return null;
  // Last-resort: keep a point visible at the model's approximate position
  // rather than dropping it entirely, but record the fact so validation can
  // report (and repair) the weak dependency.
  const leftovers = [];
  for (const spec of [...pending]) {
    if (spec?.type !== 'point' || !spec.label) continue;
    const coord = targetCoord(spec);
    if (!coord) continue;
    const p = norm(coord);
    const o = addObject(st, { type: 'point', sub: 'free', x: p.x, y: p.y, label: spec.label, visible: spec.visible !== false });
    labels.set(spec.label, o);
    leftovers.push(spec.label);
    pending.splice(pending.indexOf(spec), 1);
  }
  if (leftovers.length) {
    st.meta.visionUnbuilt = leftovers;
    st.meta.visionNotes = [...(st.meta.visionNotes || []), `依赖未建立，暂按自由点放置：${leftovers.join(',')}`];
  }
  recompute(st);
  // Keep the figure visually complete even when a derived construction is
  // degenerate: fall back to the model's image coordinate for that point.
  const degraded = [];
  for (const o of st.objects) {
    if (o.type !== 'point' || o.valid) continue;
    const spec = plan.construction.find((x) => x.label === o.label);
    const coord = spec?.coordinate || spec?.at || refCoord.get(o.label);
    if (!coord) continue;
    const p = norm(coord);
    o.sub = 'free'; o.deps = []; o.x = p.x; o.y = p.y; o.meta = o.meta || {}; o.meta.degraded = true;
    degraded.push(o.label);
  }
  if (degraded.length) {
    recompute(st);
    st.meta.visionDegraded = degraded;
    st.meta.visionNotes = [...(st.meta.visionNotes || []), `构造退化，按原图坐标放置：${degraded.join(',')}`];
  }
  for (const spec of plan.construction) {
    if (!spec?.label) continue;
    const o = labels.get(spec.label); if (!o) continue;
    if (spec.auxiliary === true || spec.visible === false) { o.visible = false; o.meta = o.meta || {}; o.meta.auxiliary = true; }
  }
  recompute(st);
  // Re-select branches by the original image coordinate.
  for (const spec of plan.construction) {
    if (!spec?.label) continue;
    const targetCoord2 = spec.coordinate || spec.at || refCoord.get(spec.label);
    const o = labels.get(spec.label);
    if (!targetCoord2 || !o) continue;
    if (!['intersection', 'pointOnLineDistance', 'pointOnCircleDistance', 'tangentPoint', 'tangentCirclePoint', 'angleDouble'].includes(o.sub)) continue;
    const target = norm(targetCoord2);
    let best = null, bestD = Infinity;
    for (let b = 0; b < 4; b++) {
      o.branch = b; recompute(st);
      if (o.valid && o.g) {
        const coincident = [...labels.values()].some((q) => q !== o && q.type === 'point' && q.valid && q.g && dist(q.g, o.g) < .12);
        const dd = dist(o.g, target) + (coincident ? 10 : 0);
        if (dd < bestD) { bestD = dd; best = b; }
      }
    }
    if (best != null) { o.branch = best; recompute(st); }
  }
  // Two points derived from the same pair of curves must not collapse onto the
  // same branch (e.g. the two intersections of a circle with a line/circle).
  const interGroups = new Map();
  for (const spec of plan.construction) {
    if (spec?.type !== 'point' || spec.sub !== 'intersection' || !spec.label) continue;
    const key = (spec.deps || []).join('|');
    if (!interGroups.has(key)) interGroups.set(key, []);
    interGroups.get(key).push(spec);
  }
  for (const group of interGroups.values()) {
    if (group.length < 2) continue;
    const chosen = [];
    for (const spec of group) {
      const o = labels.get(spec.label);
      if (!o) continue;
      const target = targetCoord(spec) ? norm(targetCoord(spec)) : null;
      let best = 0, bestScore = Infinity;
      for (let b = 0; b < 4; b++) {
        o.branch = b; recompute(st);
        if (!o.valid || !o.g) continue;
        let score = target ? dist(o.g, target) : 0;
        for (const q of chosen) if (dist(o.g, q) < .15) score += 100;
        if (score < bestScore) { bestScore = score; best = b; }
      }
      o.branch = best; recompute(st);
      if (o.valid && o.g) chosen.push(o.g);
    }
  }
  const cs = [...extraConstraints];
  const involved = new Set();
  for (const c of plan.constraints || []) {
    if (!c || !c.kind) continue;
    const id = (n) => labels.get(n)?.id;
    const note = (names) => { for (const n of names || []) if (typeof n === 'string') involved.add(n); };
    if (c.kind === 'equalLength' && c.pairs) {
      note(c.pairs.flat());
      cs.push({ kind: 'equalLength', pairs: c.pairs.map((p) => p.map(id)).filter((p) => p.every(Boolean)) });
    } else if (c.kind === 'equalAngle' && c.angles) {
      note(c.angles.flat());
      cs.push({ kind: 'equalAngle', angles: c.angles.map((a) => a.map(id)).filter((a) => a.every(Boolean)) });
    } else if (c.kind === 'collinear' && c.points) {
      note(c.points);
      cs.push({ kind: 'collinear', points: c.points.map(id).filter(Boolean) });
    } else if (c.kind === 'parallel' || c.kind === 'perpendicular') {
      note(c.lines.flat());
      cs.push({ kind: c.kind, lines: c.lines.map((p) => p.map(id)) });
    } else if (c.kind === 'concyclic' && c.points) {
      note(c.points);
      cs.push({ kind: 'concyclic', points: c.points.map(id).filter(Boolean) });
    } else if (c.kind === 'onCircle' && c.point) {
      note([c.point]);
      const p = id(c.point), cir = labels.get(c.circle)?.id;
      if (p && cir) cs.push({ kind: 'onCircle', point: p, circle: cir });
    } else if (c.kind === 'onLine' && c.point) {
      note([c.point]);
      const p = id(c.point), ln = labels.get(c.line)?.id;
      if (p && ln) cs.push({ kind: 'onLine', point: p, line: ln });
    } else if (c.kind === 'midpoint' && c.point) {
      note([c.point, ...(c.of || [])]);
      cs.push({ kind: 'midpoint', point: id(c.point), a: id((c.of || [])[0]), b: id((c.of || [])[1]) });
    }
  }
  if (cs.length) {
    // Branch choices that satisfy the stated conditions beat ones that only
    // match the (noisy) image coordinates.
    try {
      let best = constraintNorm(st, cs);
      const branchable = st.objects.filter((o) => o.type === 'point' && ['intersection', 'pointOnLineDistance', 'pointOnCircleDistance', 'tangentPoint'].includes(o.sub));
      for (let round = 0; round < 2 && best > 1e-4; round++) {
        let improved = false;
        for (const o of branchable) {
          const old = o.branch || 0;
          let bestB = old;
          for (let b = 0; b < 4; b++) {
            if (b === old) continue;
            o.branch = b; recompute(st);
            const v = constraintNorm(st, cs);
            if (v < best - 1e-9) { best = v; bestB = b; }
          }
          o.branch = bestB; recompute(st);
          if (bestB !== old) improved = true;
        }
        if (!improved) break;
      }
      st.meta.visionBranchResidual = best;
    } catch {}
    const involvedIds = [...involved].map((n) => labels.get(n)?.id).filter(Boolean);
    const solveLabels = [...new Set([
      ...[...involved].filter((n) => labels.get(n)?.sub === 'free'),
      ...collectFreeAncestors(st, involvedIds),
    ])];
    try {
      const r = solveConstraints(st, cs, { maxIter: 120, acceptTol: 1e-6, labels: solveLabels.length ? solveLabels : undefined });
      st.meta.visionSolver = { ok: !!r.ok, residual: r.residual, variables: r.variables };
      if (!r.ok) st.meta.visionNotes = [...(st.meta.visionNotes || []), `条件求解残差 ${Number(r.residual).toExponential(2)}`];
    } catch (e) { console.warn('construction constraints failed', e); }
    recompute(st);
  }
  const g = data.goal || {};
  let goal = null;
  const id = (n) => labels.get(n)?.id;
  if (g.kind === 'concyclic' || g.kind === 'collinear') {
    const ids = (g.points || []).map(id).filter(Boolean);
    if (ids.length >= (g.kind === 'concyclic' ? 4 : 3)) goal = { kind: g.kind, ids, title: g.text || '', statement: g.text || '', source: 'vision' };
  } else if (g.kind === 'angleSum') {
    const am = [...String(g.text || '').matchAll(/∠\s*([A-Z])\s*([A-Z])\s*([A-Z])/g)].slice(0, 2);
    if (am.length === 2) {
      const angles = am.map((x) => [id(x[1]), id(x[2]), id(x[3])]);
      if (angles.every((a) => a.every(Boolean))) goal = { kind: 'angleSum', angles, value: 180, title: g.text || '角度和', statement: g.text || '', source: 'vision' };
    }
  } else if (g.kind === 'angle' && Array.isArray(g.points) && g.points.length >= 3) {
    const pointIds = g.points.slice(0, 3).map(id);
    if (pointIds.every(Boolean)) goal = { kind: 'angle', pointIds, value: Number(g.value) || 90, title: g.text || '证明定角', statement: g.text || '', source: 'vision' };
  } else if (g.kind === 'midpoint' && Array.isArray(g.points) && g.points.length >= 3) {
    const pointId = id(g.points[1]), pairIds = [id(g.points[0]), id(g.points[2])];
    if (pointId && pairIds.every(Boolean)) goal = { kind: 'midpoint', pointId, pairIds, title: g.text || '证明中点', statement: g.text || '', source: 'vision' };
  } else if (g.kind === 'equalLength' && Array.isArray(g.pairs || g.segments)) {
    const pairs = (g.pairs || g.segments).map(([a, b]) => [id(a), id(b)]).filter(([a, b]) => a && b);
    if (pairs.length >= 2) goal = { kind: 'equalLength', pairs, title: g.text || '', statement: g.text || '', source: 'vision' };
  } else if (g.kind === 'perpendicular' || g.kind === 'parallel') {
    // If the conclusion is written as ∠XYZ = 90°, the two perpendicular lines
    // are YX and YZ (vertex Y), not whatever pair the model guessed.
    const am = String(g.text || '').match(/∠\s*([A-Z])\s*([A-Z])\s*([A-Z])\s*=?\s*90/);
    const goalLinePairs = am ? [[am[2], am[1]], [am[2], am[3]]] : (g.lines || []);
    const findLine = (pair) => {
      const a = id(pair?.[0]), b = id(pair?.[1]);
      if (!a || !b) return null;
      const found = st.objects.find((o) => ['line', 'segment', 'ray', 'vector'].includes(o.type) && o.deps?.includes(a) && o.deps?.includes(b));
      if (found) { found.visible = true; return found.id; }
      return addObject(st, { type: 'segment', sub: 'through', deps: [a, b], visible: true, style: { color: '#3d4c63', width: 1.05 } }).id;
    };
    const ids = goalLinePairs.map(findLine).filter(Boolean);
    if (ids.length >= 2) goal = { kind: g.kind, lineIds: ids, title: g.text || '', statement: g.text || '', source: 'vision' };
  } else if (g.kind === 'concurrent' || g.kind === 'concurrent_on_circle') {
    const ids = (g.lines || []).map(([a, b]) => {
      const ia = id(a), ib = id(b);
      if (!ia || !ib) return null;
      const found = st.objects.find((o) => ['line', 'segment', 'ray', 'vector'].includes(o.type) && o.deps?.includes(ia) && o.deps?.includes(ib));
      if (found) { found.visible = true; return found.id; }
      return addObject(st, { type: 'segment', sub: 'through', deps: [ia, ib], visible: true, style: { color: '#3d4c63', width: 1.05 } }).id;
    }).filter(Boolean);
    if (ids.length >= 3) {
      const cid = g.circle ? labels.get(g.circle)?.id : null;
      goal = { kind: 'concurrent', lineIds: ids, circleId: cid || undefined, title: g.text || '', statement: g.text || '', source: 'vision' };
    }
  } else if (g.kind === 'circlesTangent' && Array.isArray(g.circles)) {
    const ids = g.circles.map((n) => labels.get(n)?.id).filter(Boolean);
    if (ids.length >= 2) goal = { kind: 'tangent', circleIds: ids, title: g.text || '两圆相切', statement: g.text || '', source: 'vision' };
  } else if (g.kind === 'tangent' && g.line && g.circle) {
    const ln = (g.line || []).map(id).filter(Boolean);
    let line = st.objects.find((o) => ['line', 'segment', 'ray', 'vector'].includes(o.type) && ln.length === 2 && o.deps?.includes(ln[0]) && o.deps?.includes(ln[1]));
    if (!line && ln.length === 2) line = addObject(st, { type: 'line', sub: 'through', deps: ln, visible: false });
    const circle = labels.get(g.circle);
    if (line && circle) goal = { kind: 'tangent', lineId: line.id, circleId: circle.id, title: g.text || '', statement: g.text || '', source: 'vision' };
  }
  if (!goal) {
    try { goal = inferGoalFromText(data, labels); } catch {}
  }
  // For "当且仅当 DE=DF" style statements the diagram should show the
  // condition holding, so solve the triangle's free vertices for it.
  const iff = /当且仅当|当且仅当|if\s+and\s+only\s+if/i.test(String(data?.problem_text || ''));
  if (iff && goal?.kind === 'equalLength' && Array.isArray(goal.pairs) && goal.pairs.length >= 2) {
    const involvedIds = goal.pairs.flat();
    const move = collectFreeAncestors(st, involvedIds);
    if (move.length) {
      try {
        const r = solveConstraints(st, [{ kind: 'equalLength', pairs: goal.pairs }], {
          maxIter: 200, acceptTol: 1e-7, labels: move,
        });
        st.meta.visionGoalSolver = { ok: !!r.ok, residual: r.residual, moved: move };
        st.meta.visionNotes = [...(st.meta.visionNotes || []), `为满足“当且仅当”条件，调整自由点 ${move.join(',')}（残差 ${Number(r.residual).toExponential(2)}）`];
        recompute(st);
      } catch {}
    }
  }
  recompute(st);
  // Final branch pass after every auxiliary segment/circle has been installed.
  for (const spec of plan.construction) {
    if (spec?.type !== 'point' || spec.sub !== 'intersection' || !spec.label) continue;
    const o = labels.get(spec.label);
    const coord = spec.coordinate || spec.at || refCoord.get(spec.label);
    if (!o || !coord) continue;
    const target = norm(coord);
    let best = o.branch ?? 0, bestD = Infinity;
    for (let b = 0; b < 4; b++) {
      o.branch = b; recompute(st);
      if (!o.valid || !o.g) continue;
      const d = dist(o.g, target);
      if (d < bestD) { bestD = d; best = b; }
    }
    o.branch = best; recompute(st);
  }
  st.view.scale = 62;
  st.meta.scenarioId = 'vision';
  return { state: st, goal, triangleId: null, title: data.title || '识图构型', problemText: data.problem_text || '' };
}

export function buildVisionState(data) {
  if (data?.construction?.length) {
    const built = buildConstructionState(data);
    if (built) return built;
  }

  const st = createState(data?.title || '识图构型');
  const triSpec = data?.triangle || {};
  const labels = (triSpec.vertices && triSpec.vertices.length >= 3) ? triSpec.vertices.slice(0, 3) : ['A', 'B', 'C'];
  const coords = triSpec.coordinates || {};
  const pts = {};
  for (const name of labels) {
    const nc = worldFromNorm(coords[name]);
    const def = DEFAULT_TRIANGLE[name] || [0, 0];
    const p = nc || { x: def[0], y: def[1] };
    pts[name] = placePoint(st, name, p);
  }
  recompute(st);
  const A = pts[labels[0]], B = pts[labels[1]], C = pts[labels[2]];

  const segmentMap = new Map();
  const key = (a, b) => [a, b].sort().join('|');
  function ensureSegment(aName, bName, style = {}) {
    const a = pts[aName], b = pts[bName];
    if (!a || !b || !a.valid || !b.valid) return null;
    const k = key(a.id, b.id);
    if (segmentMap.has(k)) return segmentMap.get(k);
    const existing = st.objects.find((o) => o.type === 'segment' && ((o.deps[0] === a.id && o.deps[1] === b.id) || (o.deps[1] === a.id && o.deps[0] === b.id)));
    if (existing) { segmentMap.set(k, existing); return existing; }
    const seg = addObject(st, {
      type: 'segment', sub: 'through', deps: [a.id, b.id],
      style: { color: '#3d4c63', width: 1.15, ...style },
    });
    segmentMap.set(k, seg);
    return seg;
  }

  const sides = [[labels[0], labels[1]], [labels[1], labels[2]], [labels[2], labels[0]]];
  for (const [a, b] of sides) ensureSegment(a, b);
  const tri = addTriangle(st, A.id, B.id, C.id, {
    centers: false,
    show: { euler: false, ninePoint: false, incircle: false, circumcircle: false, medians: false, altitudes: false, bisectors: false, orthic: false },
  });
  tri.style.fill = 'transparent';
  recompute(st);

  function pointOf(name) {
    if (pts[name]) return pts[name];
    const o = st.objects.find((x) => x.type === 'point' && x.label === name && x.valid);
    if (o) pts[name] = o;
    return o || null;
  }
  function addDerived(name, obj) {
    obj.label = uniqueLabel(st, name || 'P');
    obj.style = obj.style || {};
    obj.style.color = obj.style.color || '#263342';
    obj.style.pointSize = 3.0;
    const p = addObject(st, obj);
    pts[name] = p;
    return p;
  }
  function ensureAliasLine(aName, bName) {
    const a = pointOf(aName), b = pointOf(bName); if (!a || !b) return null;
    const found = st.objects.find((o) => o.type === 'line' && o.deps.includes(a.id) && o.deps.includes(b.id));
    if (found) return found;
    return addObject(st, { type: 'line', sub: 'through', deps: [a.id, b.id], style: { color: '#3d4c63', width: .95, dash: 4 } });
  }
  function ensureAliasCircle(names) {
    const ps = names.map(pointOf); if (ps.some((x) => !x)) return null;
    const key = ps.map((p) => p.id).sort().join('|');
    const found = st.objects.find((o) => o.type === 'circle' && o.sub === 'threePoints' && [...(o.deps || [])].sort().join('|') === key);
    if (found) return found;
    return addObject(st, { type: 'circle', sub: 'threePoints', deps: ps.map((p) => p.id), label: uniqueLabel(st, 'ω'), style: { color: '#c084fc', width: .9, dash: 4, opacity: .7, fill: 'transparent' } });
  }
  function resolveNamedCurve(name) {
    const direct = st.objects.find((o) => o.label === name);
    if (direct) return direct;
    const line = String(name || '').match(/^line([A-Za-z])([A-Za-z])$/);
    if (line) return ensureAliasLine(line[1], line[2]);
    const circle = String(name || '').match(/^circle([A-Za-z])([A-Za-z])([A-Za-z])$/);
    if (circle) return ensureAliasCircle([circle[1], circle[2], circle[3]]);
    return null;
  }

  function circleLabel(name) {
    if (!name || name === 'omega' || name === 'Omega') return 'ω';
    if (name === 'circleABC' || name === 'omega' || name === 'Omega') return 'ω';
    if (name === 'omega1' || name === 'Omega1') return 'ω₁';
    if (name === 'omega2' || name === 'Omega2') return 'ω₂';
    if (name === 'circleBPE') return 'ω₁';
    if (name === 'circleCPF') return 'ω₂';
    return name;
  }
  function asTriangleNames(spec) {
    return (spec && spec.length >= 3) ? spec.slice(0, 3) : labels;
  }

  // If the model recognized D as free but the text explicitly says AD is an altitude,
  // enforce the foot construction instead of leaving a draggable point.
  const visionText = String(data.problem_text || '');
  for (const spec of (Array.isArray(data.points) ? data.points : [])) {
    if (spec && spec.name === 'D' && (spec.kind === 'free' || !spec.kind) && /AD\s*(?:是|为)?\s*高|AD\s*[⊥垂直]/.test(visionText)) {
      spec.kind = 'foot';
      spec.from = 'A';
      spec.to = ['B', 'C'];
    }
  }

  if (/BU\s*=\s*CV|CV\s*=\s*BU/.test(visionText)) {
    for (const spec of (Array.isArray(data.points) ? data.points : [])) {
      if (spec && spec.name === 'V' && (spec.kind === 'free' || !spec.kind)) {
        spec.kind = 'equalDistance';
        spec.from = ['B', 'U'];
        spec.onSegment = ['C', 'A'];
      }
    }
  }

  const pending = (data.points || []).filter((p) => p && p.name && !pts[p.name]);
  for (let pass = 0; pass < 5 && pending.length; pass++) {
    let changed = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const spec = pending[i];
      try {
        const kind = spec.kind || 'free';
        if (kind === 'triangleCenter' || kind === 'center') {
          const tnames = asTriangleNames(spec.triangle);
          const verts = tnames.map(pointOf);
          if (verts.some((v) => !v)) continue;
          let tr = triangleForVertices(st, verts.map((v) => v.id));
          if (!tr) tr = addTriangle(st, verts[0].id, verts[1].id, verts[2].id, { centers: false, show: { euler: false, ninePoint: false, incircle: false, circumcircle: false, medians: false, altitudes: false, bisectors: false, orthic: false } });
          const ck = CENTER_KEYS[spec.center] || spec.center || 'G';
          const [pid] = ensureCenters(st, tr.id, [ck]);
          const p = objectById(st, pid);
          if (p) { p.visible = true; pts[spec.name] = p; }
        } else if (kind === 'foot') {
          const from = pointOf(spec.from);
          const [u, v] = spec.to || spec.segment || [];
          const seg = ensureSegment(u, v);
          if (!from || !seg) continue;
          addDerived(spec.name, { type: 'point', sub: 'foot', deps: [from.id, seg.id] });
        } else if (kind === 'midpoint') {
          const a = pointOf(spec.of?.[0]), b = pointOf(spec.of?.[1]);
          if (!a || !b) continue;
          addDerived(spec.name, { type: 'point', sub: 'midpoint', deps: [a.id, b.id] });
        } else if (kind === 'onSegment' || kind === 'onLine') {
          const [u, v] = spec.segment || spec.onSegment || [];
          const seg = ensureSegment(u, v);
          if (!seg) continue;
          const world = worldFromNorm(spec.coordinate) || { x: 0, y: 0 };
          const a = pointOf(u), b = pointOf(v);
          let t = 0.5;
          if (a?.valid && b?.valid) {
            const q = projectOnLine(world, a.g, { x: b.g.x - a.g.x, y: b.g.y - a.g.y });
            t = clamp(q.t / Math.max(1e-9, dist(a.g, b.g)), .03, .97);
          }
          addDerived(spec.name, { type: 'point', sub: 'pointOnLine', deps: [seg.id], t });
        } else if (kind === 'equalDistance') {
          const [bName, uName] = spec.from || [];
          const [cName, aName] = spec.onSegment || [];
          const U = pointOf(uName), B = pointOf(bName), C = pointOf(cName), A = pointOf(aName);
          if (!U || !B || !C || !A) continue;
          addDerived(spec.name, { type: 'point', sub: 'equalDistance', deps: [U.id, B.id, C.id, A.id] });
        } else if (kind === 'tangentPoint') {
          const segNames = spec.onSegment || spec.segment || [];
          const seg = ensureSegment(segNames[0], segNames[1]);
          const letters = String(spec.circle || '').match(/^circle([A-Za-z]+)$/)?.[1] || '';
          const others = [...letters].filter((ch) => ch !== spec.name).map(pointOf);
          if (!seg || others.length < 2 || others.some((x) => !x)) continue;
          const world = worldFromNorm(spec.coordinate) || { x: 0, y: 0 };
          let t = 0.5;
          const a = pointOf(segNames[0]), b = pointOf(segNames[1]);
          if (a?.valid && b?.valid) {
            const q = projectOnLine(world, a.g, { x: b.g.x - a.g.x, y: b.g.y - a.g.y });
            t = clamp(q.t / Math.max(1e-9, dist(a.g, b.g)), .03, .97);
          }
          addDerived(spec.name, { type: 'point', sub: 'tangentCirclePoint', deps: [others[0].id, others[1].id, seg.id], t });
        } else if (kind === 'intersection') {
          const [o1, o2] = spec.of || [];
          const c1 = resolveNamedCurve(o1), c2 = resolveNamedCurve(o2);
          if (!c1 || !c2) continue;
          recompute(st);
          let branch = spec.branch || 0;
          const target = worldFromNorm(spec.coordinate);
          if (target) {
            const hits = intersectionOfCurves(curveOf(c1), curveOf(c2));
            if (hits.length) {
              let bi = 0, bd = Infinity;
              hits.forEach((h, i) => { const d = Math.hypot(h.x - target.x, h.y - target.y); if (d < bd) { bd = d; bi = i; } });
              branch = bi;
            }
          }
          addDerived(spec.name, { type: 'point', sub: 'intersection', deps: [c1.id, c2.id], branch });
        } else {
          const world = worldFromNorm(spec.coordinate) || { x: 0, y: 0 };
          addDerived(spec.name, { type: 'point', sub: 'free', x: world.x, y: world.y });
        }
        pending.splice(i, 1); changed = true;
      } catch (err) { /* try next pass */ }
    }
    recompute(st);
    if (!changed) break;
  }

  for (const p of pending) {
    if (!p.coordinate) continue;
    const world = worldFromNorm(p.coordinate);
    if (world) { addDerived(p.name, { type: 'point', sub: 'free', x: world.x, y: world.y }); }
  }
  recompute(st);

  for (const pair of (Array.isArray(data.segments) ? data.segments : [])) { if (!Array.isArray(pair)) continue; ensureSegment(pair[0], pair[1]); }
  for (const pair of (Array.isArray(data.lines) ? data.lines : [])) {
    if (!Array.isArray(pair)) continue;
    const [a, b] = pair;
    const pa = pointOf(a), pb = pointOf(b);
    if (!pa || !pb) continue;
    const exists = st.objects.some((o) => o.type === 'line' && o.deps.includes(pa.id) && o.deps.includes(pb.id));
    if (!exists) addObject(st, { type: 'line', sub: 'through', deps: [pa.id, pb.id], style: { color: '#3d4c63', width: 1.0 } });
  }

  const circleByName = new Map();
  for (const c of (Array.isArray(data.circles) ? data.circles : [])) {
    let circ = null;
    if (Array.isArray(c.through) && c.through.length >= 3) {
      const ps = c.through.slice(0, 3).map(pointOf);
      if (ps.every(Boolean)) {
        const key = ps.map((p) => p.id).sort().join('|');
        circ = st.objects.find((o) => o.type === 'circle' && o.sub === 'threePoints' && [...(o.deps || [])].sort().join('|') === key);
        if (!circ) circ = addObject(st, { type: 'circle', sub: 'threePoints', deps: ps.map((p) => p.id), label: uniqueLabel(st, circleLabel(c.name)), visible: c.visible !== false && c.auxiliary !== true, style: { color: '#c084fc', width: .9, dash: 4, opacity: .7, fill: 'transparent' } });
      }
    } else if (c.center && c.through) {
      const cp = pointOf(c.center), tp = pointOf(c.through);
      if (cp && tp) circ = addObject(st, { type: 'circle', sub: 'centerThrough', deps: [cp.id, tp.id], label: uniqueLabel(st, circleLabel(c.name)), visible: c.visible !== false && c.auxiliary !== true, style: { color: '#c084fc', width: .9, dash: 4, opacity: .7, fill: 'transparent' } });
    }
    if (circ) circleByName.set(c.name || 'ω', circ);
  }
  recompute(st);

  // Solve numeric conditions such as ∠PND = 2∠PAD for P constrained to a segment.
  for (const c of (Array.isArray(data.constraints) ? data.constraints : [])) {
    if (!c || c.kind !== 'angle-double' || !c.point) continue;
    const P = pointOf(c.point);
    const [u, v] = c.onSegment || [];
    const U = pointOf(u), V = pointOf(v);
    const a1 = c.angle1 || [], b1 = c.angle2 || [];
    const N = pointOf(a1[1]), D = pointOf(a1[2]), A2 = pointOf(b1[1]), D2 = pointOf(b1[2]);
    if (!P || !U || !V || !N || !D || !A2 || !D2 || P.sub !== 'pointOnLine') continue;
    const seg = ensureSegment(u, v);
    if (!seg) continue;
    // Make the constrained point a dynamic derived point, not a draggable on-segment point.
    P.sub = 'angleDouble';
    P.deps = [seg.id, N.id, D.id, A2.id, D2.id];
    P.factor = Number(c.factor) || 2;
    P.t = Number.isFinite(P.t) ? P.t : .5;
    P.locked = true;
    P.meta = P.meta || {};
    P.meta.dynamicConstraint = 'angle-double';
    recompute(st);
  }

  let goal = null;
  const g = data.goal;
  if (g && g.kind === 'tangent') {
    const [la, lb] = g.line || [];
    const line = ensureSegment(la, lb) || st.objects.find((o) => o.type === 'line' && o.deps.includes(pts[la]?.id) && o.deps.includes(pts[lb]?.id));
    const circle = circleByName.get(g.circle) || [...circleByName.values()][0];
    if (line && circle) goal = {
      kind: 'tangent', lineId: line.id, circleId: circle.id,
      title: g.text || '证明直线与圆相切', statement: g.text || '证明直线与圆相切',
      source: 'vision', theorem: null,
    };
  } else if (g && (g.kind === 'collinear' || g.kind === 'concyclic')) {
    const ids = (g.points || []).map((n) => pointOf(n)?.id).filter(Boolean);
    if (ids.length >= (g.kind === 'collinear' ? 3 : 4)) goal = { kind: g.kind, ids, title: g.text || g.kind, statement: g.text || '', source: 'vision' };
  } else if (g && g.kind === 'concurrent' && Array.isArray(g.lines)) {
    const ids = g.lines.map(([a, b]) => {
      const pa = pointOf(a), pb = pointOf(b); if (!pa || !pb) return null;
      const found = st.objects.find((o) => ['line', 'segment', 'ray', 'vector'].includes(o.type) && o.deps.includes(pa.id) && o.deps.includes(pb.id));
      return (found || ensureSegment(a, b))?.id || null;
    }).filter(Boolean);
    if (ids.length >= 3) goal = { kind: 'concurrent', lineIds: ids, title: g.text || '证明三线共点', statement: g.text || '', source: 'vision' };
  } else if (g && g.kind === 'equalAngle' && Array.isArray(g.angles) && g.angles.length >= 2) {
    const angles = g.angles.slice(0, 2).map((tri) => (tri || []).map((n) => pointOf(n)?.id));
    if (angles.every((tri) => tri.length === 3 && tri.every(Boolean))) {
      goal = { kind: 'equalAngle', angles, title: g.text || '证明两角相等', statement: g.text || '', source: 'vision' };
    }
  }

  // Auxiliary construction objects are kept in the dependency graph but hidden by default.
  for (const spec of (Array.isArray(data.points) ? data.points : [])) {
    if (!spec || !(spec.auxiliary === true || spec.visible === false || spec.hidden === true)) continue;
    const p = pointOf(spec.name);
    if (p) { p.visible = false; p.meta = p.meta || {}; p.meta.auxiliary = true; }
  }
  for (const c of (Array.isArray(data.circles) ? data.circles : [])) {
    if (!c || !(c.auxiliary === true || c.visible === false || c.hidden === true)) continue;
    const circ = circleByName.get(c.name) || [...circleByName.values()].find((x) => x.label === c.name);
    if (circ) { circ.visible = false; circ.meta = circ.meta || {}; circ.meta.auxiliary = true; }
  }
  recompute(st);
  st.view.scale = 90;
  st.meta.scenarioId = 'vision';
  return { state: st, goal, triangleId: tri.id, title: data.title || '识图构型', problemText: data.problem_text || '' };
}

export const SAMPLE_TEXT = '如图，在锐角△ABC中，AB<AC，AD是高，H是垂心，O是外心，N是HO的中点。线段BD内一点P满足∠PND=2∠PAD。求证：直线BC与△AOP的外接圆相切。';

export function sampleVisionData() {
  return {
    title: '截图示例 · 高线与倍角',
    problem_text: SAMPLE_TEXT,
    triangle: { vertices: ['A', 'B', 'C'] },
    points: [
      { name: 'D', kind: 'foot', from: 'A', to: ['B', 'C'] },
      { name: 'H', kind: 'triangleCenter', center: 'orthocenter', triangle: ['A', 'B', 'C'] },
      { name: 'O', kind: 'triangleCenter', center: 'circumcenter', triangle: ['A', 'B', 'C'] },
      { name: 'N', kind: 'midpoint', of: ['H', 'O'] },
      { name: 'P', kind: 'onSegment', segment: ['B', 'D'], coordinate: [0.30, 0.82] },
    ],
    segments: [['A', 'B'], ['B', 'C'], ['C', 'A'], ['A', 'D'], ['B', 'D'], ['A', 'P'], ['P', 'N'], ['N', 'D'], ['A', 'O'], ['H', 'D']],
    circles: [{ name: 'omega', through: ['A', 'O', 'P'] }],
    constraints: [{ point: 'P', kind: 'angle-double', onSegment: ['B', 'D'], angle1: ['P', 'N', 'D'], angle2: ['P', 'A', 'D'], factor: 2 }],
    goal: { kind: 'tangent', line: ['B', 'C'], circle: 'omega', text: '证明：直线 BC 与 △AOP 的外接圆相切' },
  };
}

export function parseGeometryText(text) {
  const t = String(text || '').replace(/\s+/g, '').replace(/Z(?=[A-Z∠])/g, '∠');
  if (!/△ABC/.test(t) || !/(AD是高|AD⊥BC)/.test(t)) return null;
  if (!/H是垂心/.test(t) || !/O是外心/.test(t) || !/N是HO的中点/.test(t)) return null;
  const angle = t.match(/∠PND=(\d+)∠PAD/);
  if (!angle || !(/P[^。]*BD/.test(t) || /BD[^。]*P/.test(t))) return null;
  return {
    title: '截图识题 · 锐角三角形与倍角',
    problem_text: text,
    triangle: { vertices: ['A', 'B', 'C'] },
    points: [
      { name: 'D', kind: 'foot', from: 'A', to: ['B', 'C'] },
      { name: 'H', kind: 'triangleCenter', center: 'orthocenter', triangle: ['A', 'B', 'C'] },
      { name: 'O', kind: 'triangleCenter', center: 'circumcenter', triangle: ['A', 'B', 'C'] },
      { name: 'N', kind: 'midpoint', of: ['H', 'O'] },
      { name: 'P', kind: 'onSegment', segment: ['B', 'D'], coordinate: [.3, .82] },
    ],
    segments: [['A', 'B'], ['B', 'C'], ['C', 'A'], ['A', 'D'], ['B', 'D'], ['A', 'P'], ['P', 'N'], ['N', 'D'], ['A', 'O']],
    circles: /AOP/.test(t) ? [{ name: 'omega', through: ['A', 'O', 'P'] }] : [],
    constraints: [{ point: 'P', kind: 'angle-double', onSegment: ['B', 'D'], angle1: ['P', 'N', 'D'], angle2: ['P', 'A', 'D'], factor: Number(angle[1]) }],
    goal: /(相切|外接圆相$|外接圆相[。.]?$)/.test(t) && /AOP/.test(t) ? { kind: 'tangent', line: ['B', 'C'], circle: 'omega', text: '证明：直线 BC 与 △AOP 的外接圆相切' } : null,
  };
}

export function validateVisionState(built, data) {
  const issues = [];
  if (!built?.state) return ['没有生成画板'];
  const labels = new Map(built.state.objects.map((o) => [o.label, o]));
  const plan = normalizeVisionPlan(data);
  for (const p of data?.points || []) {
    if (!p?.name) continue;
    if (p.kind === 'circle' || p.type === 'circle' || p.kind === 'line' || p.type === 'line') continue;
    const o = labels.get(p.name);
    if (!o) { issues.push(`点 ${p.name} 未生成`); continue; }
    if (!o.valid) { issues.push(`点 ${p.name} 无效（依赖不足或分支错误）`); continue; }
    if (p.coordinate && o.type === 'point' && o.g && o.sub === 'free') {
      const target = worldFromNorm(p.coordinate);
      if (target) {
        const d = Math.hypot(o.g.x - target.x, o.g.y - target.y);
        if (d > 3.0) issues.push(`⚠ 点 ${p.name} 与原图坐标偏差 ${d.toFixed(2)}`);
      }
    }
  }
  for (const spec of plan.construction || []) {
    if (spec?.type !== 'point' || !spec.label) continue;
    if (!labels.has(spec.label) && !(data?.points || []).some((p) => p?.name === spec.label)) {
      issues.push(`构造点 ${spec.label} 未生成`);
    }
  }
  // Prefer a ruler-and-compass construction over a solver/free parameter.
  const constructive = new Set(['midpoint', 'foot', 'reflect', 'reflectLine', 'reflectPoint', 'onCircle', 'onLine', 'equalLength', 'equalAngle', 'angle-double', 'tangentPoint', 'circumcenter', 'arcMidpoint', 'incircleTouch']);
  for (const c of data?.constraints || []) {
    const name = c?.point || c?.name;
    if (!name || !constructive.has(String(c?.kind))) continue;
    const o = labels.get(name);
    if (o && (o.sub === 'free' || o.sub === 'pointOnLine')) issues.push(`⚠ 点 ${name} 有约束 ${c.kind}，却仍是 ${o.sub}；应优先用尺规构造`);
  }

  /* ---- numeric verification of every condition the model claimed ---- */
  const S = (() => {
    let m = 1;
    const pts = [...labels.values()].filter((o) => o.type === 'point' && o.valid && o.g);
    for (const p of pts) m = Math.max(m, Math.abs(p.g.x), Math.abs(p.g.y));
    return m;
  })();
  const P = (n) => { const o = labels.get(n); return o?.valid && o.type === 'point' ? o.g : null; };
  const ang = (a, b, c) => { const A = P(a), B = P(b), C = P(c); return A && B && C ? angleAt(A, B, C) : null; };
  const dirOf = (entry) => {
    if (Array.isArray(entry)) {
      const A = P(entry[0]), B = P(entry[1]);
      if (!A || !B) return null;
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
      return L > 1e-9 ? { x: dx / L, y: dy / L } : null;
    }
    const o = labels.get(entry);
    if (!o?.valid || !o.g) return null;
    if (['line', 'segment', 'ray', 'vector'].includes(o.type)) {
      const d = o.g.d, L = Math.hypot(d.x, d.y);
      return L > 1e-9 ? { x: d.x / L, y: d.y / L } : null;
    }
    return null;
  };
  const bad = (msg) => { if (issues.length < 40) issues.push('⚠ ' + msg); };
  const degradedNames = new Set([...(built.state.meta?.visionDegraded || []), ...(built.state.meta?.visionUnbuilt || [])]);
  for (const c of plan.constraints || []) {
    const cn = c.points || c.pairs?.flat() || c.angles?.flat() || [];
    if (cn.some((n) => degradedNames.has(n))) continue;
    try {
      if (c.kind === 'equalLength' && c.pairs) {
        for (const [a, b, d, e] of c.pairs) {
          const A = P(a), B = P(b), D = P(d), E = P(e);
          if (!A || !B || !D || !E) continue;
          const r = Math.abs(dist(A, B) - dist(D, E)) / S;
          if (r > 2e-3) bad(`条件 ${a}${b}=${d}${e} 残差 ${r.toExponential(1)}`);
        }
      } else if (c.kind === 'equalAngle' && c.angles) {
        const [x, y] = c.angles;
        if (x?.length >= 3 && y?.length >= 3) {
          const a1 = ang(x[0], x[1], x[2]), a2 = ang(y[0], y[1], y[2]);
          if (a1 != null && a2 != null && Math.abs(a1 - a2) > 5e-3) bad(`条件 ∠${x.join('')}=∠${y.join('')} 残差 ${(a1 - a2).toFixed(3)} rad`);
        }
      } else if (c.kind === 'collinear' && c.points) {
        const q = c.points.map(P);
        if (q.length >= 3 && q.every(Boolean)) {
          const u = { x: q[1].x - q[0].x, y: q[1].y - q[0].y };
          let worst = 0;
          for (let i = 2; i < q.length; i++) {
            const v = { x: q[i].x - q[0].x, y: q[i].y - q[0].y };
            worst = Math.max(worst, Math.abs(u.x * v.y - u.y * v.x) / Math.max(1e-9, Math.hypot(u.x, u.y) * S));
          }
          if (worst > 3e-3) bad(`条件 ${c.points.join('')} 共线残差 ${worst.toExponential(1)}`);
        }
      } else if (c.kind === 'concyclic' && c.points) {
        const q = c.points.map(P);
        if (q.length >= 4 && q.every(Boolean)) {
          const [A, B, C, ...rest] = q;
          const O = circumcenter(A, B, C);
          if (O) {
            const r0 = dist(O, A);
            let worst = 0;
            for (const D of rest) worst = Math.max(worst, Math.abs(dist(O, D) - r0) / S);
            if (worst > 5e-3) bad(`条件 ${c.points.join('')} 共圆残差 ${worst.toExponential(1)}`);
          }
        }
      } else if (c.kind === 'parallel' || c.kind === 'perpendicular') {
        const [u, v] = (c.lines || []).map(dirOf);
        if (u && v) {
          const r = c.kind === 'parallel' ? Math.abs(u.x * v.y - u.y * v.x) : Math.abs(u.x * v.x + u.y * v.y);
          if (r > 5e-3) bad(`条件 ${c.kind} 残差 ${r.toExponential(1)}`);
        }
      } else if (c.kind === 'onCircle' && c.point) {
        const A = P(c.point), cir = labels.get(c.circle);
        if (A && cir?.valid && cir.g) {
          const r = Math.abs(dist(A, cir.g.center) - cir.g.r) / S;
          if (r > 3e-3) bad(`点 ${c.point} 在圆上残差 ${r.toExponential(1)}`);
        }
      } else if (c.kind === 'onLine' && c.point) {
        const A = P(c.point), ln = labels.get(c.line);
        if (A && ln?.valid && ln.g) {
          const u = ln.g.d, v = { x: A.x - ln.g.a.x, y: A.y - ln.g.a.y };
          const r = Math.abs(u.x * v.y - u.y * v.x) / (Math.max(1e-9, Math.hypot(u.x, u.y)) * S);
          if (r > 3e-3) bad(`点 ${c.point} 在线上残差 ${r.toExponential(1)}`);
        }
      } else if (c.kind === 'tangent' && c.line && c.circle) {
        const ln = labels.get(Array.isArray(c.line) ? `line${c.line[0]}${c.line[1]}` : c.line);
        const cir = labels.get(c.circle);
        if (ln?.valid && ln.g && cir?.valid && cir.g) {
          const u = ln.g.d, v = { x: cir.g.center.x - ln.g.a.x, y: cir.g.center.y - ln.g.a.y };
          const d = Math.abs(u.x * v.y - u.y * v.x) / Math.max(1e-9, Math.hypot(u.x, u.y));
          const r = Math.abs(d - cir.g.r) / S;
          if (r > 5e-3) bad(`切线条件残差 ${r.toExponential(1)}`);
        }
      }
    } catch { /* malformed constraint */ }
  }
  // Weak/incorrect dependencies recorded by the builder.
  for (const n of built.state.meta?.visionUnbuilt || []) issues.push(`点 ${n} 的依赖未能建立，暂为自由点`);
  // Source text names that never became a point.
  const text = String(data?.problem_text || '');
  const letters = new Set((text.match(/[A-Z](?![A-Za-z_])/g) || []));
  for (const ch of letters) {
    if (!labels.has(ch) && !(data?.points || []).some((p) => p?.name === ch)) {
      bad(`题面出现字母 ${ch}，但构图中没有该点`);
    }
  }
  const coreGoals = new Set(['concyclic', 'collinear', 'perpendicular', 'parallel', 'tangent', 'equalAngle', 'equalLength', 'midpoint']);
  const gk = String(data?.goal?.kind || '');
  const g = data?.goal || {};
  const wellFormed = (gk === 'concyclic' && (g.points || []).length >= 4)
    || (gk === 'collinear' && (g.points || []).length >= 3)
    || (gk === 'midpoint' && (g.points || []).length >= 3)
    || ['perpendicular', 'parallel'].includes(gk)
    || gk === 'tangent' || gk === 'equalAngle' || gk === 'equalLength';
  const concurrentGoal = gk === 'concurrent' && (g.lines || []).length >= 3;
  if (data?.goal && ((coreGoals.has(gk) && wellFormed) || concurrentGoal) && !built.goal) issues.push('目标没有生成');
  return issues;
}
