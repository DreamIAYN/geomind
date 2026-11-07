/* General numeric constraint solver for construction plans.
 *
 * Unknowns are the free parameters of existing objects (free point x/y,
 * pointOnLine t, pointOnCircle theta). Derived points are recomputed by the
 * geometry engine, so constraints are evaluated on the resulting figure.
 * This is a drawing/verification tool: solved unknowns can be locked when a
 * conditional configuration is required.
 */
import {
  add, sub, mul, dist, dist2, dot, cross, norm, angleAt, objectById, recompute,
} from './geometry.js';

const at = (state, id) => {
  const o = objectById(state, id);
  return o?.valid ? o.g : null;
};
const scaleOf = (state) => Math.max(1, Math.abs(state?.view?.scale || 1));

function lineOf(state, id) {
  const o = objectById(state, id);
  if (!o?.valid || !o.g) return null;
  if (o.type === 'line' || o.type === 'segment' || o.type === 'ray' || o.type === 'vector') return { a: o.g.a, d: o.g.d };
  if (o.type === 'circle') return null;
  return null;
}
function angle(a, b, c) { return angleAt(a, b, c); }
function lineDist(p, l) { return Math.abs(cross(sub(p, l.a), l.d)); }

export function collectUnknowns(state, opts = {}) {
  const vars = [];
  const only = opts.labels ? new Set(opts.labels) : null;
  for (const o of state.objects) {
    if (only && !only.has(o.label)) continue;
    if (!o.valid && !o.g) continue;
    if (o.type === 'point' && o.sub === 'free') {
      vars.push({ o, key: 'x', get: () => o.x, set: (v) => { o.x = v; }, scale: 1 });
      vars.push({ o, key: 'y', get: () => o.y, set: (v) => { o.y = v; }, scale: 1 });
    } else if (o.type === 'point' && o.sub === 'pointOnLine') {
      vars.push({ o, key: 't', get: () => Number(o.t) || 0, set: (v) => { o.t = v; }, scale: 1 });
    } else if (o.type === 'point' && o.sub === 'pointOnCircle') {
      vars.push({ o, key: 'theta', get: () => Number(o.theta) || 0, set: (v) => { o.theta = v; }, scale: 1 });
    }
  }
  return vars;
}

export function residualsFor(state, constraints, scale) {
  const R = [];
  const push = (v) => { if (Number.isFinite(v)) R.push(v); };
  const P = (id) => at(state, id);
  for (const c of constraints || []) {
    try {
      switch (c.kind) {
        case 'equalLength': {
          const pairs = c.pairs || [];
          if (pairs.length && pairs[0].length === 2) {
            // [[A,B],[C,D],...] — all listed segments must be equal.
            const lens = pairs.map(([a, b]) => {
              const A = P(a), B = P(b);
              return A && B ? dist(A, B) : null;
            });
            const valid = lens.filter((x) => x != null);
            for (let i = 1; i < valid.length; i++) push((valid[0] - valid[i]) / scale);
          } else {
            for (const [a, b, d, e] of pairs) {
              const A = P(a), B = P(b), C = P(d), D = P(e);
              if (A && B && C && D) push((dist(A, B) - dist(C, D)) / scale);
            }
          }
          break;
        }
        case 'equalAngle': {
          const list = c.angles || [];
          if (list.length === 2 && Array.isArray(list[0]) && list[0].length >= 3) {
            const [a, b, cc, d, e, f] = [...list[0], ...list[1]];
            const A = P(a), B = P(b), C = P(cc), D = P(d), E = P(e), F = P(f);
            if (A && B && C && D && E && F) push((angle(A, B, C) - angle(D, E, F)) / Math.PI);
          } else {
            for (const [a, b, cc, d, e, f] of list) {
              const A = P(a), B = P(b), C = P(cc), D = P(d), E = P(e), F = P(f);
              if (A && B && C && D && E && F) push((angle(A, B, C) - angle(D, E, F)) / Math.PI);
            }
          }
          break;
        }
        case 'angleDouble': {
          const [a, b, cc, d, e, f] = c.angles || [];
          const A = P(a), B = P(b), C = P(cc), D = P(d), E = P(e), F = P(f);
          if (A && B && C && D && E && F) push((angle(A, B, C) - (c.factor || 2) * angle(D, E, F)) / Math.PI);
          break;
        }
        case 'collinear': {
          const ids = c.points || []; const p = ids.map(P).filter(Boolean);
          for (let i = 2; i < p.length; i++) {
            const a = sub(p[1], p[0]), b = sub(p[i], p[0]);
            push(cross(a, b) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y) || scale));
          }
          break;
        }
        case 'concyclic': {
          const ids = c.points || []; const p = ids.map(P).filter(Boolean);
          if (p.length >= 4) {
            const [a, b, cc, d] = p;
            const det = (u, v, w) => (u.x - w.x) * (v.y - w.y) - (u.y - w.y) * (v.x - w.x);
            const rows = [
              [a.x, a.y, a.x * a.x + a.y * a.y, 1],
              [b.x, b.y, b.x * b.x + b.y * b.y, 1],
              [cc.x, cc.y, cc.x * cc.x + cc.y * cc.y, 1],
              [d.x, d.y, d.x * d.x + d.y * d.y, 1],
            ];
            const m = rows;
            const det4 = (q) => q[0][0] * (q[1][1] * (q[2][2] * q[3][3] - q[2][3] * q[3][2]) - q[1][2] * (q[2][1] * q[3][3] - q[2][3] * q[3][1]) + q[1][3] * (q[2][1] * q[3][2] - q[2][2] * q[3][1])) - q[0][1] * (q[1][0] * (q[2][2] * q[3][3] - q[2][3] * q[3][2]) - q[1][2] * (q[2][0] * q[3][3] - q[2][3] * q[3][0]) + q[1][3] * (q[2][0] * q[3][2] - q[2][2] * q[3][0])) + q[0][2] * (q[1][0] * (q[2][1] * q[3][3] - q[2][3] * q[3][1]) - q[1][1] * (q[2][0] * q[3][3] - q[2][3] * q[3][0]) + q[1][3] * (q[2][0] * q[3][1] - q[2][1] * q[3][0])) - q[0][3] * (q[1][0] * (q[2][1] * q[3][2] - q[2][2] * q[3][1]) - q[1][1] * (q[2][0] * q[3][2] - q[2][2] * q[3][0]) + q[1][2] * (q[2][0] * q[3][1] - q[2][1] * q[3][0]));
            push(det4(m) / (scale * scale * scale * scale));
          }
          break;
        }
        case 'parallel':
        case 'perpendicular':
        case 'tangent': {
          const lines = (c.lines || []).map((pair) => {
            if (Array.isArray(pair)) {
              const a = P(pair[0]), b = P(pair[1]); return a && b ? { a, d: norm(sub(b, a)) } : null;
            }
            return lineOf(state, pair);
          });
          if (c.kind === 'tangent' && c.line && c.circle) {
            const l = lineOf(state, c.line), cir = objectById(state, c.circle);
            if (l && cir?.valid && cir.g) push((lineDist(cir.g.center, l) - cir.g.r) / scale);
            break;
          }
          if (lines[0] && lines[1]) {
            const u = norm(lines[0].d), v = norm(lines[1].d);
            push((c.kind === 'parallel' ? cross(u, v) : dot(u, v)));
          }
          break;
        }
        case 'midpoint': {
          const M = P(c.point), A = P(c.a), B = P(c.b);
          if (M && A && B) push(dist(M, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }) / scale);
          break;
        }
        case 'onLine': {
          const p = P(c.point), l = lineOf(state, c.line);
          if (p && l) push(lineDist(p, l) / scale);
          break;
        }
        case 'onCircle': {
          const p = P(c.point), cir = objectById(state, c.circle);
          if (p && cir?.valid && cir.g) push((dist(p, cir.g.center) - cir.g.r) / scale);
          break;
        }
        case 'ratio': {
          const [a, b, d, e] = c.pairs || [];
          const A = P(a), B = P(b), C = P(d), D = P(e);
          if (A && B && C && D && c.value) push(dist(A, B) / dist(C, D) - c.value);
          break;
        }
        case 'concurrent': {
          const lines = (c.lines || []).map((pair) => {
            if (Array.isArray(pair)) { const a = P(pair[0]), b = P(pair[1]); return a && b ? { a, d: norm(sub(b, a)) } : null; }
            return lineOf(state, pair);
          }).filter(Boolean);
          if (lines.length >= 3) {
            let best = Infinity;
            for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
              const den = cross(lines[i].d, lines[j].d);
              if (Math.abs(den) < 1e-12) continue;
              const t = cross(sub(lines[j].a, lines[i].a), lines[j].d) / den;
              const q = add(lines[i].a, mul(lines[i].d, t));
              best = Math.min(best, Math.max(...lines.map((l) => lineDist(q, l))));
            }
            push((Number.isFinite(best) ? best : scale) / scale);
          }
          break;
        }
        case 'circlesTangent': {
          const [a, b] = c.circles || [];
          const A = objectById(state, a), B = objectById(state, b);
          if (A?.valid && B?.valid && A.g && B.g) {
            const d = dist(A.g.center, B.g.center);
            push(Math.min(Math.abs(d - A.g.r - B.g.r), Math.abs(d - Math.abs(A.g.r - B.g.r))) / scale);
          }
          break;
        }
        default: break;
      }
    } catch { /* ignore malformed constraint in this pass */ }
  }
  return R;
}

function solveLinear(A, b) {
  const n = b.length; const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-14) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) if (r !== col) {
      const f = M[r][col];
      if (Math.abs(f) < 1e-18) continue;
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row[n]);
}

export function constraintNorm(state, constraints) {
  const R = residualsFor(state, constraints, scaleOf(state));
  return Math.hypot(...R);
}

export function solveConstraints(state, constraints, opts = {}) {
  const maxIter = opts.maxIter || 80;
  const tol = opts.tol || 1e-9;
  const scale = scaleOf(state);
  const vars = collectUnknowns(state, opts);
  if (!vars.length) return { ok: false, residual: Infinity, iterations: 0, message: '没有可求解的自由参数' };
  const base = vars.map((v) => v.get());
  const restore = () => { vars.forEach((v, i) => v.set(base[i])); recompute(state); };
  let lambda = 1e-3;
  let bestNorm = Infinity;
  let bestVals = base.slice();
  for (let it = 0; it < maxIter; it++) {
    recompute(state);
    const r0 = residualsFor(state, constraints, scale);
    const norm0 = Math.hypot(...r0);
    if (norm0 < bestNorm) { bestNorm = norm0; bestVals = vars.map((v) => v.get()); }
    if (norm0 < tol) break;
    const n = vars.length, m = r0.length;
    if (!m) break;
    // finite-difference Jacobian
    const J = Array.from({ length: m }, () => new Array(n).fill(0));
    const h = 1e-6;
    for (let j = 0; j < n; j++) {
      const old = vars[j].get();
      vars[j].set(old + h);
      recompute(state);
      const r1 = residualsFor(state, constraints, scale);
      vars[j].set(old);
      for (let i = 0; i < m; i++) J[i][j] = (r1[i] - r0[i]) / h;
    }
    const JTJ = Array.from({ length: n }, () => new Array(n).fill(0));
    const JTr = new Array(n).fill(0);
    for (let i = 0; i < m; i++) for (let a = 0; a < n; a++) {
      JTr[a] += J[i][a] * r0[i];
      for (let b = 0; b < n; b++) JTJ[a][b] += J[i][a] * J[i][b];
    }
    for (let a = 0; a < n; a++) JTJ[a][a] += lambda * (1 + Math.abs(JTJ[a][a]));
    const dx = solveLinear(JTJ, JTr.map((v) => -v));
    if (!dx) { restore(); break; }
    // line search
    let accepted = false;
    for (let k = 0; k < 8; k++) {
      const step = 1 / (2 ** k);
      vars.forEach((v, i) => v.set(v.get() + dx[i] * step));
      recompute(state);
      const rn = residualsFor(state, constraints, scale);
      if (Math.hypot(...rn) < norm0) { accepted = true; break; }
    }
    if (!accepted) { restore(); break; }
    lambda = Math.max(1e-9, lambda * .5);
  }
  recompute(state);
  const finalR = residualsFor(state, constraints, scale);
  const finalNorm = Math.hypot(...finalR);
  if (finalNorm > bestNorm) {
    vars.forEach((v, i) => v.set(bestVals[i])); recompute(state);
  }
  if (opts.lock && finalNorm < (opts.lockTol || 1e-5)) {
    for (const o of state.objects) if (o.sub === 'free') o.locked = true;
  }
  return { ok: finalNorm < (opts.acceptTol || 1e-4), residual: finalNorm, iterations: maxIter, residuals: finalR, variables: vars.length };
}

export function constraintsForGoal(goal, state) {
  // Handy adapter for common goals; ids must already refer to point ids.
  if (!goal) return [];
  if (goal.kind === 'concyclic') return [{ kind: 'concyclic', points: goal.ids || [] }];
  if (goal.kind === 'collinear') return [{ kind: 'collinear', points: goal.ids || [] }];
  if (goal.kind === 'perpendicular') return [{ kind: 'perpendicular', lines: (goal.lineIds || []).map((id) => id) }];
  return [];
}
