"""Symbolic complex geometry compiler (SymPy).

Input: serialized GeoMind state objects + goal ids.
Free points become real symbolic coordinates; common derived constructions are
compiled to symbolic expressions.  Goals are reduced to a complex identity and
simplified.  Unsupported constructions are reported explicitly, never guessed.
"""
from __future__ import annotations
import sympy as sp

I = sp.I

def _xy(p): return (p[0], p[1])
def add(a,b): return (a[0]+b[0], a[1]+b[1])
def sub(a,b): return (a[0]-b[0], a[1]-b[1])
def mul(a,k): return (a[0]*k, a[1]*k)
def dot(a,b): return a[0]*b[0]+a[1]*b[1]
def cross(a,b): return a[0]*b[1]-a[1]*b[0]
def norm2(a): return a[0]**2+a[1]**2
def dist2(a,b): return norm2(sub(a,b))

def complex_of(p):
    return sp.simplify(p[0] + I*p[1])

def safe_sym(label, i):
    name = ''.join(c if c.isalnum() else '_' for c in (label or f'P{i}'))
    if not name or name[0].isdigit(): name = 'P'+name
    return sp.symbols(f'x_{name} y_{name}', real=True)

def line_exp(p, q):
    return (p, sub(q,p))

def is_zero(expr):
    try:
        e = sp.simplify(sp.together(expr))
        if e == 0: return True, e
        e2 = sp.simplify(sp.expand(e))
        return e2 == 0, e2
    except Exception:
        return False, expr

def build(objects):
    byid = {o.get('id'): o for o in objects}
    pts, lines, circles, triangles = {}, {}, {}, {}
    errors = []
    # iterate several passes; objects are normally topological already
    pending = list(objects)
    for _ in range(12):
        changed = False
        for o in list(pending):
            try:
                t, s = o.get('type'), o.get('sub')
                deps = o.get('deps') or []
                if t == 'point':
                    if s == 'free':
                        pts[o['id']] = safe_sym(o.get('label'), len(pts))
                        pending.remove(o); changed = True
                    elif s == 'midpoint' and len(deps) >= 2 and all(d in pts for d in deps[:2]):
                        pts[o['id']] = mul(add(pts[deps[0]], pts[deps[1]]), sp.Rational(1,2))
                        pending.remove(o); changed = True
                    elif s == 'pointOnLine' and deps and deps[0] in lines:
                        a, d = lines[deps[0]]
                        param = sp.symbols(f't_{len(pts)}', real=True)
                        pts[o['id']] = _xy(add(a, mul(d, param)))
                        pending.remove(o); changed = True
                    elif s == 'intersection' and len(deps) >= 2:
                        a, b = deps[0], deps[1]
                        if a in lines and b in lines:
                            p1,d1 = lines[a]; p2,d2 = lines[b]
                            den = cross(d1,d2)
                            if den != 0:
                                t = cross(sub(p2,p1), d2)/den
                                pts[o['id']] = _xy(add(p1,mul(d1,t)))
                                pending.remove(o); changed = True
                        elif a in lines and b in circles:
                            p,d = lines[a]; c,r2 = circles[b]
                            q = sub(p,c); A = norm2(d); B = 2*dot(q,d); C = norm2(q)-r2
                            disc = sp.simplify(B*B-4*A*C)
                            branch = 1 if int(o.get('branch') or 0) % 2 == 0 else -1
                            tt = (-B + branch*sp.sqrt(disc))/(2*A)
                            pts[o['id']] = _xy(add(p,mul(d,tt)))
                            pending.remove(o); changed = True
                    elif s == 'pointOnCircle' and deps and deps[0] in circles:
                        c, r2 = circles[deps[0]]
                        t = sp.symbols(f't_{len(pts)}', real=True)
                        den = 1 + t*t
                        r = sp.sqrt(r2)
                        cs = (1 - t*t) / den
                        sn = 2 * t / den
                        pts[o['id']] = (c[0] + r*cs, c[1] + r*sn)
                        pending.remove(o); changed = True
                    elif s == 'reflectPoint' and len(deps) >= 2 and deps[0] in pts and deps[1] in pts:
                        p0, c0 = pts[deps[0]], pts[deps[1]]
                        pts[o['id']] = (sp.simplify(2*c0[0]-p0[0]), sp.simplify(2*c0[1]-p0[1]))
                        pending.remove(o); changed = True
                    elif s == 'triangleCenter' and deps and deps[0] in triangles:
                        verts = triangles[deps[0]]
                        A,B,C = verts
                        ux,uy = sp.symbols(f'ox2_{len(pts)} oy2_{len(pts)}', real=True)
                        eq1 = sp.Eq(dist2((ux,uy),A), dist2((ux,uy),B))
                        eq2 = sp.Eq(dist2((ux,uy),A), dist2((ux,uy),C))
                        sol = sp.solve([eq1,eq2],[ux,uy], dict=True)
                        if sol:
                            O = (sp.simplify(sol[0][ux]), sp.simplify(sol[0][uy]))
                            key = o.get('centerKey')
                            if key == 'O': pts[o['id']] = O
                            elif key == 'H': pts[o['id']] = (sp.simplify(A[0]+B[0]+C[0]-2*O[0]), sp.simplify(A[1]+B[1]+C[1]-2*O[1]))
                            elif key == 'G': pts[o['id']] = (sp.simplify((A[0]+B[0]+C[0])/3), sp.simplify((A[1]+B[1]+C[1])/3))
                            elif key == 'N':
                                H = (sp.simplify(A[0]+B[0]+C[0]-2*O[0]), sp.simplify(A[1]+B[1]+C[1]-2*O[1]))
                                pts[o['id']] = (sp.simplify((O[0]+H[0])/2), sp.simplify((O[1]+H[1])/2))
                            pending.remove(o); changed = True
                    elif s == 'circumcenter' and len(deps) >= 3 and all(d in pts for d in deps[:3]):
                        A,B,C = pts[deps[0]],pts[deps[1]],pts[deps[2]]
                        # solve |X-A|^2=|X-B|^2, |X-A|^2=|X-C|^2
                        ux,uy = sp.symbols(f'ox_{len(pts)} oy_{len(pts)}', real=True)
                        eq1 = sp.Eq(dist2((ux,uy),A), dist2((ux,uy),B))
                        eq2 = sp.Eq(dist2((ux,uy),A), dist2((ux,uy),C))
                        sol = sp.solve([eq1,eq2],[ux,uy], dict=True)
                        if sol:
                            pts[o['id']] = (sp.simplify(sol[0][ux]), sp.simplify(sol[0][uy]))
                            pending.remove(o); changed = True
                elif t in ('line','segment','ray','vector'):
                    if s == 'through' and len(deps) >= 2 and all(d in pts for d in deps[:2]):
                        lines[o['id']] = line_exp(pts[deps[0]], pts[deps[1]])
                        pending.remove(o); changed = True
                    elif s == 'parallel' and len(deps) >= 2 and deps[0] in pts and deps[1] in lines:
                        p = pts[deps[0]]; a,d = lines[deps[1]]
                        lines[o['id']] = (p,d)
                        pending.remove(o); changed = True
                    elif s == 'perp' and len(deps) >= 2 and deps[0] in pts and deps[1] in lines:
                        p = pts[deps[0]]; a,d = lines[deps[1]]
                        lines[o['id']] = (p,(-d[1],d[0]))
                        pending.remove(o); changed = True
                elif t == 'triangle':
                    if len(deps) >= 3 and all(d in pts for d in deps[:3]):
                        triangles[o['id']] = (pts[deps[0]],pts[deps[1]],pts[deps[2]])
                        pending.remove(o); changed = True
                elif t == 'circle':
                    if s == 'threePoints' and len(deps) >= 3 and all(d in pts for d in deps[:3]):
                        A,B,C = pts[deps[0]],pts[deps[1]],pts[deps[2]]
                        ux,uy = sp.symbols(f'cx_{len(circles)} cy_{len(circles)}', real=True)
                        eq1 = sp.Eq(dist2((ux,uy),A), dist2((ux,uy),B))
                        eq2 = sp.Eq(dist2((ux,uy),A), dist2((ux,uy),C))
                        sol = sp.solve([eq1,eq2],[ux,uy], dict=True)
                        if sol:
                            c = (sp.simplify(sol[0][ux]), sp.simplify(sol[0][uy]))
                            circles[o['id']] = (c, sp.simplify(dist2(c,A)))
                            pending.remove(o); changed = True
                    elif s == 'centerRadius' and deps and deps[0] in pts:
                        c = pts[deps[0]]; r = o.get('radius') or o.get('r') or 0
                        circles[o['id']] = (c, sp.simplify(sp.sympify(r)**2))
                        pending.remove(o); changed = True
                    elif s == 'centerThrough' and len(deps) >= 2 and deps[0] in pts and deps[1] in pts:
                        c = pts[deps[0]]; r2 = dist2(c,pts[deps[1]])
                        circles[o['id']] = (c, sp.simplify(r2))
                        pending.remove(o); changed = True
            except Exception as e:
                errors.append(f'{o.get("label") or o.get("id")}: {e}')
        if not changed: break
    for o in pending:
        errors.append(f'未编译: {o.get("type")}/{o.get("sub")} {o.get("label") or o.get("id")}')
    return pts, lines, circles, errors

def compile_goal(goal, pts, lines, circles):
    k = goal.get('kind')
    ids = goal.get('ids') or []
    if k in ('collinear','concyclic'):
        P = [pts.get(i) for i in ids]
        if any(p is None for p in P):
            miss = [str(ids[i]) for i,p in enumerate(P) if p is None]
            return '缺少点表达式: ' + ', '.join(miss)
        if k == 'collinear':
            if len(P) < 3: return '共线需要三点'
            z = (complex_of(P[1])-complex_of(P[0]))/(complex_of(P[2])-complex_of(P[0]))
            return sp.im(z)
        if len(P) < 4: return '共圆需要四点'
        a,b,c,d = [complex_of(p) for p in P]
        return sp.im(((a-c)*(b-d))/((a-d)*(b-c)))
    if k in ('parallel','perpendicular'):
        L = [lines.get(i) for i in (goal.get('lineIds') or [])]
        if len(L) < 2 or any(l is None for l in L): return '缺少线表达式'
        z = (L[0][1][0]+I*L[0][1][1])/(L[1][1][0]+I*L[1][1][1])
        return sp.re(z) if k == 'perpendicular' else sp.im(z)
    if k == 'equalLength':
        pairs = goal.get('pairs') or []
        if len(pairs) < 2: return '等长需要两组点'
        vals = []
        for a,b in pairs:
            if a not in pts or b not in pts: return '缺少点表达式'
            vals.append(sp.sqrt(dist2(pts[a], pts[b])))
        return vals[0]-vals[1]
    if k == 'equalAngle':
        angles = goal.get('angles') or []
        if len(angles) < 2: return '等角需要两组角'
        vals=[]
        for tri in angles:
            A,B,C = [pts.get(i) for i in tri]
            if A is None or B is None or C is None: return '缺少点表达式'
            vals.append(sp.arg((complex_of(A)-complex_of(B))/(complex_of(C)-complex_of(B)), evaluate=False))
        return vals[0]-vals[1]
    if k == 'tangent':
        l = lines.get(goal.get('lineId')); c = circles.get(goal.get('circleId'))
        if not l or not c: return '缺少线/圆表达式'
        a,d = l; center,r2 = c
        # distance from center to line = |cross(d, center-a)| / |d|; square compare r2
        return cross(d, sub(center,a))**2 - r2*norm2(d)
    return '目标类型暂未符号化: ' + str(k)

def prove(objects, goal):
    pts, lines, circles, errors = build(objects)
    try:
        expr = compile_goal(goal, pts, lines, circles)
    except Exception as e:
        return {'ok': False, 'error': '目标编译失败: '+str(e), 'errors': errors}
    if isinstance(expr, str):
        return {'ok': False, 'error': expr, 'errors': errors}
    ok, simplified = is_zero(expr)
    return {
        'ok': bool(ok),
        'expression': str(expr),
        'simplified': str(simplified),
        'latex': sp.latex(simplified),
        'errors': errors,
        'freeSymbols': sorted({str(s) for s in simplified.free_symbols}) if hasattr(simplified,'free_symbols') else [],
    }
