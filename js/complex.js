/* Complex-number reference frame and proposition checker.
 * z = x + i y. Predicates use complex ratios; results are numeric residuals
 * suitable for a quick algebraic verification of the current construction.
 */
const C = (z) => ({ re: z.x, im: z.y });
const add = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const sub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const div = (a, b) => {
  const d = b.re * b.re + b.im * b.im;
  if (d < 1e-18) return { re: NaN, im: NaN };
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const abs = (a) => Math.hypot(a.re, a.im);
const arg = (a) => Math.atan2(a.im, a.re);
const fmt = (a, n = 6) => {
  if (!Number.isFinite(a.re) || !Number.isFinite(a.im)) return 'undefined';
  const r = a.re.toFixed(n), i = a.im.toFixed(n);
  return `${r}${a.im >= 0 ? '+' : '-'}${Math.abs(a.im).toFixed(n)}i`;
};
const mod2 = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

export function complexFrame(state) {
  const points = state.objects.filter((o) => o.type === 'point' && o.valid && o.g);
  const map = new Map();
  const rows = [];
  for (const p of points) {
    const z = C(p.g); map.set(p.label || p.id, { o: p, z });
    rows.push({ label: p.label || p.id, type: p.sub, z });
  }
  return { map, rows };
}

export function parseProp(text) {
  const s = String(text || '').trim().replace(/[(),]/g, ' ').replace(/\s+/g, ' ');
  if (!s) return null;
  const [kind, ...args] = s.split(' ');
  return { kind: kind.toLowerCase(), args, text: String(text || '').trim() };
}

export function checkProp(prop, frame) {
  const P = (name) => frame.map.get(name)?.z;
  const a = prop.args;
  const need = (n) => a.length >= n && a.slice(0, n).every((x) => P(x));
  const near = (v, tol = 1e-7) => Math.abs(v) < tol;
  try {
    switch (prop.kind) {
      case 'coll': {
        if (!need(3)) return { ok: false, residual: Infinity, text: '需要 3 个点' };
        const [A, B, Cc] = a.map(P);
        const v = div(sub(B, A), sub(Cc, A)); const r = Math.abs(v.im);
        return { ok: near(r), residual: r, text: `Im((B−A)/(C−A)) = ${r.toExponential(3)}` };
      }
      case 'cyclic': {
        if (!need(4)) return { ok: false, residual: Infinity, text: '需要 4 个点' };
        const [A, B, Cc, D] = a.map(P);
        const v = div(mul(sub(A, Cc), sub(B, D)), mul(sub(A, D), sub(B, Cc)));
        const r = Math.abs(v.im);
        return { ok: near(r), residual: r, text: `Im(交比) = ${r.toExponential(3)}` };
      }
      case 'perp': case 'para': {
        if (!need(4)) return { ok: false, residual: Infinity, text: '需要 A,B,C,D 四点' };
        const [A, B, Cc, D] = a.map(P);
        const v = div(sub(B, A), sub(D, Cc));
        const r = prop.kind === 'perp' ? Math.abs(v.re) : Math.abs(v.im);
        return { ok: near(r), residual: r, text: prop.kind === 'perp' ? `Re((B−A)/(D−C)) = ${r.toExponential(3)}` : `Im((B−A)/(D−C)) = ${r.toExponential(3)}` };
      }
      case 'cong': {
        if (!need(4)) return { ok: false, residual: Infinity, text: '需要 A,B,C,D 四点' };
        const [A, B, Cc, D] = a.map(P);
        const r = Math.abs(abs(sub(A, B)) - abs(sub(Cc, D)));
        return { ok: near(r), residual: r, text: `||A−B|−|C−D|| = ${r.toExponential(3)}` };
      }
      case 'eqratio': {
        if (!need(6)) return { ok: false, residual: Infinity, text: '需要 6 个点' };
        const [A, B, Cc, D, E, F] = a.map(P);
        const r = Math.abs(abs(sub(A, B)) / abs(sub(Cc, D)) - abs(sub(E, F)) / 1);
        return { ok: near(r), residual: r, text: `比值残差 = ${r.toExponential(3)}` };
      }
      case 'eqangle': {
        if (!need(6)) return { ok: false, residual: Infinity, text: '需要 6 个点' };
        const [A, B, Cc, D, E, F] = a.map(P);
        const r1 = div(sub(B, A), sub(Cc, A)), r2 = div(sub(E, D), sub(F, D));
        const r = Math.abs(mod2(arg(r1) - arg(r2)));
        return { ok: near(Math.min(r, 2 * Math.PI - r)), residual: Math.min(r, 2 * Math.PI - r), text: `角度差 = ${(Math.min(r, 2 * Math.PI - r) * 180 / Math.PI).toExponential(3)}°` };
      }
      case 'onl': {
        if (!need(3)) return { ok: false, residual: Infinity, text: '需要 P,A,B' };
        const [Pp, A, B] = a.map(P); const r = Math.abs(div(sub(Pp, A), sub(B, A)).im);
        return { ok: near(r), residual: r, text: `Im((P−A)/(B−A)) = ${r.toExponential(3)}` };
      }
      case 'onc': {
        if (!need(4)) return { ok: false, residual: Infinity, text: '需要 P,A,B,C' };
        const [Pp, A, B, Cc] = a.map(P);
        const v = div(mul(sub(Pp, A), sub(Cc, B)), mul(sub(Pp, B), sub(Cc, A)));
        const r = Math.abs(v.im);
        return { ok: near(r), residual: r, text: `Im(交比 PABC) = ${r.toExponential(3)}` };
      }
      default: return { ok: false, residual: Infinity, text: '未知命题：' + prop.kind };
    }
  } catch (e) { return { ok: false, residual: Infinity, text: '计算错误：' + e.message }; }
}

export function checkGoalComplex(goal, state) {
  if (!goal) return { ok: false, residual: Infinity, text: '未设置目标' };
  const pt = (id) => {
    const o = state.objects.find((x) => x.id === id);
    return o?.type === 'point' && o.valid ? C(o.g) : null;
  };
  const line = (id) => {
    const o = state.objects.find((x) => x.id === id);
    if (!o?.valid || !o.g || !o.g.a || !o.g.d) return null;
    return { a: C(o.g.a), d: C(o.g.d) };
  };
  const near = (v) => Math.abs(v) < 1e-7;
  try {
    switch (goal.kind) {
      case 'collinear': {
        const [a,b,c] = (goal.ids||[]).map(pt); if(!a||!b||!c) return {ok:false,residual:Infinity,text:'点缺失'};
        const r = Math.abs(div(sub(b,a),sub(c,a)).im);
        return { ok: near(r), residual: r, text: `Im((B−A)/(C−A)) = ${r.toExponential(3)}` };
      }
      case 'concyclic': {
        const [a,b,c,d] = (goal.ids||[]).map(pt); if(!a||!b||!c||!d) return {ok:false,residual:Infinity,text:'点缺失'};
        const r = Math.abs(div(mul(sub(a,c),sub(b,d)),mul(sub(a,d),sub(b,c))).im);
        return { ok: near(r), residual: r, text: `Im(交比) = ${r.toExponential(3)}` };
      }
      case 'perpendicular': case 'parallel': {
        const [l1,l2] = (goal.lineIds||[]).map(line); if(!l1||!l2) return {ok:false,residual:Infinity,text:'线缺失'};
        const v = div(l1.d,l2.d), r = goal.kind === 'perpendicular' ? Math.abs(v.re) : Math.abs(v.im);
        return { ok: near(r), residual: r, text: goal.kind === 'perpendicular' ? `Re(d₁/d₂) = ${r.toExponential(3)}` : `Im(d₁/d₂) = ${r.toExponential(3)}` };
      }
      case 'equalLength': {
        const pairs = goal.pairs || [];
        if (pairs.length < 2) return {ok:false,residual:Infinity,text:'线段不足'};
        const lens = pairs.map(([a,b]) => { const A=pt(a),B=pt(b); return A&&B?abs(sub(A,B)):null; });
        if (lens.some((x)=>x==null)) return {ok:false,residual:Infinity,text:'点缺失'};
        const r = (Math.max(...lens)-Math.min(...lens))/Math.max(1e-9,Math.max(...lens));
        return { ok: near(r), residual: r, text: `|AB| / |CD| 相对差 = ${r.toExponential(3)}` };
      }
      case 'equalAngle': {
        const [A,B,Cc,D,E,F] = (goal.angles||[]).flat().map(pt);
        if(!A||!B||!Cc||!D||!E||!F) return {ok:false,residual:Infinity,text:'点缺失'};
        const r1 = div(sub(A,B),sub(Cc,B)), r2 = div(sub(D,E),sub(F,E));
        let r = Math.abs(arg(r1)-arg(r2)); r = Math.min(r, 2*Math.PI-r);
        return { ok: near(r), residual: r, text: `角度差 = ${(r*180/Math.PI).toExponential(3)}°` };
      }
      case 'angleSum': {
        const angs = (goal.angles||[]).map(([a,b,c]) => {
          const A=pt(a),B=pt(b),Cc=pt(c); if(!A||!B||!Cc) return null;
          const v=div(sub(A,B),sub(Cc,B)); let r=Math.abs(arg(v)); return Math.min(r,Math.PI);
        });
        if (angs.some((x)=>x==null)) return {ok:false,residual:Infinity,text:'点缺失'};
        const sum=angs.reduce((x,y)=>x+y,0), target=goal.value??Math.PI, r=Math.abs(sum-target)/Math.PI;
        return { ok: near(r), residual: r, text: `角度和 = ${(sum*180/Math.PI).toFixed(3)}°，差 = ${((sum-target)*180/Math.PI).toExponential(3)}°` };
      }
      case 'tangent': {
        const l = line(goal.lineId), c = state.objects.find((x)=>x.id===goal.circleId);
        if (!l || !c?.valid || !c.g) return {ok:false,residual:Infinity,text:'线/圆缺失'};
        const P = C(c.g.center), r = Math.abs(div(sub(P,l.a),l.d).im);
        const rr = Math.abs(r - c.g.r)/Math.max(1,c.g.r);
        return { ok: near(rr,1e-6), residual: rr, text: `圆心到线距离 = ${r.toFixed(6)}，半径 = ${c.g.r.toFixed(6)}` };
      }
      default: return { ok: false, residual: Infinity, text: '复数法暂不支持该目标：' + goal.kind };
    }
  } catch (e) { return { ok: false, residual: Infinity, text: '计算错误：' + e.message }; }
}
