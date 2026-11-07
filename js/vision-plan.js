/* ==========================================================================
   GeoMind · vision construction-plan normalizer
   Faithfully turns the loose schema produced by the multimodal model into the
   exact constructor grammar of js/geometry.js.  This file deliberately has no
   DOM or geometry dependency: it only rewrites plain JSON objects.
   ========================================================================== */

const POINT_SUBS = new Set([
  'free', 'midpoint', 'foot', 'intersection', 'pointOnLine', 'pointOnCircle',
  'pointOnRay', 'pointOnRayDistance', 'midpointArc', 'reflectLine', 'reflectPoint',
  'rotate', 'translate', 'homothety', 'inversion', 'triangleCenter', 'circumcenter',
  'orthocenter', 'incenter', 'centroid', 'ninePointCenter', 'excenter',
  'incircleTouch', 'tangentPoint', 'tangentCirclePoint', 'angleDouble',
  'angleEqualOnLine', 'angleAtFixedOnLine', 'angleEqualOnCircle',
  'equalDistance', 'ratioDistanceOnLine', 'parallelogramFourth', 'equilateral',
  'fixedDistance', 'pointOnLineDistance', 'pointOnCircleDistance', 'harmonic',
  'trapezoidEndpoint',
]);
const LINE_TYPES = new Set(['line', 'segment', 'ray', 'vector']);

const CENTER_KEYS = {
  circumcenter: 'O', circumcentre: 'O', orthocenter: 'H', orthocentre: 'H',
  incenter: 'I', incentre: 'I', centroid: 'G', ninepoint: 'N', ninePointCenter: 'N',
  excenterA: 'IA', excenterB: 'IB', excenterC: 'IC',
  '外心': 'O', '垂心': 'H', '内心': 'I', '重心': 'G', '九点圆心': 'N',
  '旁心A': 'IA', 'A旁心': 'IA', '旁心B': 'IB', '旁心C': 'IC',
};

const POINT_KIND_MAP = {
  free: 'free', point: 'free',
  midpoint: 'midpoint',
  foot: 'foot', perpendicularFoot: 'foot', projection: 'foot',
  intersection: 'intersection', intersect: 'intersection',
  onSegment: 'pointOnLine', onLine: 'pointOnLine', pointOnLine: 'pointOnLine',
  onCircle: 'pointOnCircle', pointOnCircle: 'pointOnCircle',
  onRay: 'pointOnRay', pointOnRay: 'pointOnRay',
  midpointArc: 'midpointArc', arcMidpoint: 'midpointArc', midpointOfArc: 'midpointArc',
  reflect: 'reflectLine', reflectLine: 'reflectLine', reflection: 'reflectLine',
  triangleCenter: 'triangleCenter', center: 'triangleCenter', centre: 'triangleCenter',
  circumcenter: 'circumcenter', orthocenter: 'orthocenter', incenter: 'incenter',
  centroid: 'centroid', ninepoint: 'triangleCenter',
  incircleTouch: 'incircleTouch', tangentPoint: 'tangentCirclePoint',
  tangentCirclePoint: 'tangentCirclePoint', equalDistance: 'equalDistance',
  ratioDistanceOnLine: 'ratioDistanceOnLine', pointOnLineDistance: 'pointOnLineDistance',
  pointOnCircleDistance: 'pointOnCircleDistance', angleEqualOnCircle: 'angleEqualOnCircle',
  angleDouble: 'angleDouble', angleEqualOnLine: 'angleEqualOnLine', externalHomothetyCenter: 'externalHomothetyCenter',
  fixedDistance: 'pointOnRayDistance', pointOnRayDistance: 'pointOnRayDistance',
  parallelogramFourth: 'parallelogramFourth',
};

function arr(x) { return Array.isArray(x) ? x : []; }
function pointLike(name) { return typeof name === 'string' && /^[A-Za-z][A-Za-z0-9'′]*$/.test(name); }
function lineAlias(name) {
  const m = String(name || '').match(/^line([A-Za-z])([A-Za-z])$/);
  return m ? [m[1], m[2]] : null;
}
function circleAlias(name) {
  const m = String(name || '').match(/^circle([A-Za-z])([A-Za-z])([A-Za-z])$/);
  return m ? [m[1], m[2], m[3]] : null;
}
function normCoord(c) {
  if (!c) return null;
  if (Array.isArray(c) && c.length >= 2) return [Number(c[0]), Number(c[1])];
  if (typeof c === 'object') return [Number(c.x), Number(c.y)];
  return null;
}

/**
 * @param {object} data raw vision JSON
 * @returns {{construction: object[], points: object[], constraints: object[], notes: string[]}}
 */
export function normalizeVisionPlan(data) {
  const notes = [];
  const out = [];
  const source = arr(data?.construction).filter((x) => x && typeof x === 'object');
  const existing = new Map();
  const pointCoords = new Map();
  for (const p of arr(data?.points)) {
    if (p?.name) pointCoords.set(p.name, normCoord(p.coordinate || p.at));
  }
  for (const s of source) {
    if (s.label || s.name) existing.set(s.label || s.name, s);
  }
  const pre = [];
  const tri = data?.triangle || {};
  const triVerts = arr(tri.vertices).length >= 3 ? arr(tri.vertices).slice(0, 3) : ['A', 'B', 'C'];
  const triCoords = tri.coordinates || {};
  for (const name of triVerts) {
    if (!name || existing.has(name)) continue;
    const c = normCoord(triCoords[name] || pointCoords.get(name));
    if (!c) continue;
    const spec = { type: 'point', sub: 'free', label: name, at: c, deps: [] };
    pre.push(spec); existing.set(name, spec);
  }
  for (const c of arr(data?.circles)) {
    if (!c?.name || existing.has(c.name)) continue;
    const thru = arr(c.through);
    const spec = { type: 'circle', label: c.name, deps: [], sub: 'threePoints' };
    if (Array.isArray(thru) && thru.length >= 3) spec.deps = thru.slice(0, 3);
    else if (c.center && thru.length >= 1) { spec.sub = 'centerThrough'; spec.deps = [c.center, thru[0]]; }
    else if (c.center && c.through) { spec.sub = 'centerThrough'; spec.deps = [c.center, c.through]; }
    else continue;
    pre.push(spec); existing.set(c.name, spec);
  }

  const specType = (name) => {
    if (!name) return null;
    const s = existing.get(name);
    if (s) return s.type === 'point' ? 'point' : (s.type || null);
    if (lineAlias(name)) return 'line';
    if (circleAlias(name)) return 'circle';
    if (pointCoords.has(name)) return 'point';
    return null;
  };
  const isPoint = (name) => specType(name) === 'point';
  const isCurve = (name) => ['line', 'segment', 'ray', 'vector', 'circle'].includes(specType(name));

  const ensureLine = (label, a, b) => {
    if (!label || existing.has(label)) return label;
    const s = { type: 'line', sub: 'through', label, deps: [a, b], visible: false };
    out.push(s); existing.set(label, s);
    return label;
  };
  const ensureCircle = (label, thru) => {
    if (!label || existing.has(label)) return label;
    const s = { type: 'circle', sub: 'threePoints', label, deps: thru, visible: true };
    out.push(s); existing.set(label, s);
    return label;
  };
  const resolveCircleName = (name) => {
    if (!name || typeof name !== 'string') return name;
    const s = existing.get(name);
    if (s?.type === 'circle') return name;
    if (circleAlias(name)) return name;
    if (/^(circumcircle|circumCircle|odotABC|circleABC|Omega|omegaABC|外接圆)$/.test(name)) {
      const explicit = source.find((x) => x.type === 'circle' && arr(x.deps).length >= 3
        && ['A', 'B', 'C'].every((p) => arr(x.deps).includes(p)));
      if (explicit?.label) return explicit.label;
      return ensureCircle('circleABC', ['A', 'B', 'C']);
    }
    return name;
  };

  /* First pass: canonicalise every source spec. */
  const canonical = [];
  for (const raw of source) {
    const s = { ...raw };
    // The model sometimes uses "name" instead of "label" for construction
    // entries (both schemas are natural); canonicalise it immediately.
    if (!s.label && s.name) s.label = s.name;
    // Some responses put the object kind in `sub` and the actual operation in
    // `type` (e.g. {sub:"point", type:"intersection"}).  Swap them before the
    // generic-type handling below.
    const genericTypes = new Set(['point', 'line', 'circle', 'segment', 'ray', 'vector']);
    if (genericTypes.has(s.sub) && s.type && !genericTypes.has(s.type)) {
      const kind = s.sub;
      s.sub = s.type;
      s.type = kind;
    }
    if (s.sub === 'line') {
      s.type = 'line';
      s.sub = s.sub_type || s.lineSub || s.line_sub || 'through';
    } else if (s.sub === 'circle') {
      s.type = 'circle';
      s.sub = s.sub_type || s.circleSub || s.circle_sub || 'threePoints';
    } else if (s.sub === 'point') {
      s.type = 'point';
      s.sub = s.pointSub || s.point_sub || 'free';
    }
    if (!s.type) {
      // A bare spec with a label and a known sub: infer its object type.
      if (POINT_SUBS.has(s.sub) || POINT_KIND_MAP[s.sub]) s.type = 'point';
      else if (['threePoints', 'centerThrough', 'tangentAtPoint', 'diameter', 'incircle', 'excircle', 'ninePoint'].includes(s.sub)) s.type = 'circle';
      else if (['through', 'parallel', 'perp', 'perpbis', 'bisector', 'tangentAt', 'tangentFrom', 'isogonal', 'radical', 'polar', 'altitude', 'median'].includes(s.sub)) s.type = 'line';
      else if (s.deps?.length === 2 && s.label && isPoint(s.deps[0]) && isPoint(s.deps[1])) s.type = 'line';
    }
    if (s.type === 'point') {
      const generic = ['point', 'line', 'circle', 'segment', 'ray', 'vector'];
      const kind = (s.kind && !generic.includes(s.kind)) ? s.kind
        : (s.sub && !generic.includes(s.sub) ? s.sub : (s.center ? 'triangleCenter' : 'free'));
      let sub = POINT_KIND_MAP[kind] || (POINT_SUBS.has(kind) ? kind : 'free');
      if (sub === 'triangleCenter' && !s.centerKey) {
        s.centerKey = CENTER_KEYS[s.center] || CENTER_KEYS[kind] || 'O';
      } else if (['circumcenter'].includes(sub)) {
        s.centerKey = 'O';
      } else if (['orthocenter'].includes(sub)) {
        s.centerKey = 'H';
      } else if (['incenter'].includes(sub)) {
        s.centerKey = 'I';
      } else if (['centroid'].includes(sub)) {
        s.centerKey = 'G';
      } else if (sub === 'ninepoint') {
        sub = 'triangleCenter'; s.centerKey = 'N';
      } else if (sub === 'excenter') {
        s.centerKey = CENTER_KEYS[s.center] || 'IA';
      } else if (sub === 'triangleCenter' && s.center && CENTER_KEYS[s.center]) {
        s.centerKey = CENTER_KEYS[s.center];
      }
      s.sub = sub;

      // Dependency extraction for the loose `points` schema.
      let deps = arr(s.deps);
      if (sub === 'foot' && (s.from || s.to || s.segment)) {
        const from = s.from || s.point;
        const to = s.to || s.segment || s.onSegment || s.line;
        const base = Array.isArray(to) ? to : [];
        if (from && base.length >= 2) {
          const label = `line${base[0]}${base[1]}`;
          ensureLine(label, base[0], base[1]);
          deps = [from, label];
        }
      } else if (sub === 'midpoint' && (s.of || s.onSegment)) {
        deps = arr(s.of || s.onSegment).slice(0, 2);
      } else if (sub === 'midpointArc') {
        let circle = resolveCircleName(s.circle || s.ofCircle || (Array.isArray(s.of) ? s.of[0] : null));
        let of = arr(s.of).filter((x) => x !== circle);
        if (!circle && Array.isArray(s.deps) && s.deps.length >= 3) {
          circle = resolveCircleName(s.deps[0]);
          of = s.deps.slice(1);
        }
        if (circle) deps = [circle, ...of];
      } else if (sub === 'intersection') {
        const of = s.of || s.lines || s.deps;
        let pair = arr(of);
        if (pair.length === 1 && Array.isArray(pair[0])) pair = pair[0];
        if (pair.length >= 2) {
          const resolved = pair.slice(0, 2).map((x) => {
            if (Array.isArray(x)) {
              const label = `line${x[0]}${x[1]}`;
              ensureLine(label, x[0], x[1]);
              return label;
            }
            if (isCurve(x) || lineAlias(x) || circleAlias(x)) return resolveCircleName(x);
            if (isPoint(x)) return x;
            return x;
          });
          deps = resolved;
        }
      } else if (sub === 'reflectLine') {
        if (s.line) {
          const lineName = Array.isArray(s.line) ? `line${s.line[0]}${s.line[1]}` : s.line;
          if (Array.isArray(s.line)) ensureLine(lineName, s.line[0], s.line[1]);
          deps = [s.of || s.point || s.from || deps[0], lineName];
        }
      } else if (sub === 'pointOnLine') {
        const seg = s.segment || s.line || s.onSegment || s.onLine;
        if (seg) deps = Array.isArray(seg) && seg.length === 2 ? [`line${seg[0]}${seg[1]}`] : [seg];
        if (Array.isArray(seg) && seg.length === 2) ensureLine(`line${seg[0]}${seg[1]}`, seg[0], seg[1]);
      } else if (sub === 'pointOnCircle') {
        const c = resolveCircleName(s.circle || s.onCircle || arr(s.deps)[0]);
        if (c) deps = [c];
        else if (lineAlias(s.circle)) deps = [s.circle];
      } else if (sub === 'triangleCenter' || ['circumcenter', 'orthocenter', 'incenter', 'centroid', 'ninePointCenter', 'excenter'].includes(sub)) {
        const tri = arr(s.triangle);
        if (tri.length >= 3) deps = tri.slice(0, 3);
        else if (deps.length >= 3) deps = deps.slice(0, 3);
        if (deps.length < 3) {
          const triName = s.triangle;
          if (Array.isArray(triName) && triName.length >= 3) deps = triName.slice(0, 3);
        }
      } else if (sub === 'equalDistance') {
        const from = arr(s.from);
        const on = arr(s.onSegment || s.on);
        if (from.length >= 2 && on.length >= 2) {
          deps = [from[1], from[0], on[0], on[1]];
        } else if (from.length >= 2 && s.onLine) {
          // BE=BA with E on line BC: turn it into a fixed-distance point.
          const line = Array.isArray(s.onLine) ? `line${s.onLine[0]}${s.onLine[1]}` : s.onLine;
          if (Array.isArray(s.onLine)) ensureLine(line, s.onLine[0], s.onLine[1]);
          sub = 'pointOnLineDistance';
          deps = [line, from[0], from[1], from[0]];
        } else if (deps.length >= 3) {
          // [U,B,C]: P on line BC with |P-U| = |U-B|
          const [U, B, C] = deps;
          const line = `line${B}${C}`;
          ensureLine(line, B, C);
          sub = 'pointOnLineDistance';
          deps = [line, U, U, B];
        } else if (deps.length === 4) {
          // already [U,B,C,A]
        }
      } else if (sub === 'pointOnLineDistance' || sub === 'pointOnCircleDistance') {
        if (deps.length < 4 && s.on) {
          const on = arr(s.on);
          deps = [on[0], s.anchor, ...arr(s.length || s.ofLength).slice(0, 2)];
        }
      } else if (sub === 'tangentCirclePoint') {
        if (deps.length === 2 && isCurve(deps[1])) {
          // A point on a circle: the tangent point is the point itself.
          deps = [deps[0], deps[1]];
        }
      }
      if (!deps.length) deps = arr(s.deps);
      s.sub = sub;
      s.deps = deps;

      // A "free" point that the loose points list describes with a real kind:
      // promote it so the plan does not silently contain a fake free point.
      if (sub === 'free') {
        const rich = (data?.points || []).find((p) => p?.name === s.label);
        if (rich && rich.kind && !['free', 'point'].includes(rich.kind)) {
          const promoted = normalizePointOnly(rich, ensureLine, ensureCircle);
          if (promoted) { Object.assign(s, promoted); }
        }
      }
      if (!s.at && !s.coordinate) {
        const c = pointCoords.get(s.label);
        if (c) s.at = c;
      }
    } else if (LINE_TYPES.has(s.type)) {
      if (s.sub === 'tangentAtPoint') s.sub = 'tangentAt';
      if (['perpendicular', 'perpendicularLine'].includes(s.sub)) s.sub = 'perp';
      if (['parallelLine'].includes(s.sub)) s.sub = 'parallel';
      if (s.sub === 'through' && !arr(s.deps).length) {
        const thru = arr(s.through || s.points);
        if (thru.length >= 2) s.deps = thru.slice(0, 2);
      }
      if (s.sub === 'tangentAt') {
        let [a, b] = arr(s.deps);
        if (isCurve(a) && isPoint(b)) [a, b] = [b, a];
        if (!b && s.circle) b = s.circle;
        if (!a && s.point) a = s.point;
        s.deps = [a, b];
      }
      if (s.sub === 'bisector' && arr(s.deps).length < 3 && s.vertex) {
        const [p, r] = arr(s.arms || s.points);
        s.deps = [p, s.vertex, r];
      }
      if (['perp', 'parallel'].includes(s.sub)) {
        let deps = arr(s.deps);
        if (deps.length >= 3) {
          const [p, a, b] = deps;
          const line = `line${a}${b}`;
          ensureLine(line, a, b);
          deps = [p, line];
        } else if (deps.length === 2) {
          const [a, b] = deps;
          if (isCurve(a) && isPoint(b)) deps = [b, a];
          else if (isPoint(a) && isCurve(b)) deps = [a, b];
          else if (isPoint(a) && isPoint(b)) {
            if (s.sub === 'parallel') deps = [a, b];
            else {
              // "through H perpendicular to AH": deps [H,A]
              const line = `line${a}${b}`;
              ensureLine(line, a, b);
              deps = [a, line];
            }
          }
        }
        s.deps = deps;
      }
      s.deps = arr(s.deps);
    } else if (s.type === 'circle') {
      if (s.sub === 'centerThrough') {
        const center = s.center || s.deps?.[0];
        const through = s.through || s.deps?.[1];
        if (center && through) s.deps = Array.isArray(through) ? [center, through[0]] : [center, through];
      } else {
        const thru = arr(s.through || s.points);
        if (thru.length >= 3) { s.sub = 'threePoints'; s.deps = thru.slice(0, 3); }
        else if (s.center && thru.length >= 1) { s.sub = 'centerThrough'; s.deps = [s.center, thru[0]]; }
      }
      s.deps = arr(s.deps);
    }
    canonical.push(s);
  }

  /* Second pass: emit in original order, force every point in `points` to
     exist, and repair line/segment labels referenced but never created. */
  const emitted = new Set();
  for (const s of pre) { if (s.label) emitted.add(s.label); out.push(s); }
  for (const s of canonical) {
    if (s.type === 'point' && s.label && emitted.has(s.label)) {
      notes.push(`重复点 ${s.label} 已忽略`);
      continue;
    }
    if (s.type === 'point' && (s.sub === 'triangleCenter' || s.sub === 'circumcenter')) {
      // triangle centers need three real point deps
      const deps = arr(s.deps).slice(0, 3);
      if (deps.length === 3 && deps.every((d) => isPoint(d) || pointCoords.has(d))) s.deps = deps;
    }
    if (s.label) emitted.add(s.label);
    out.push(s);
  }

  const synth = [];
  for (const p of arr(data?.points)) {
    if (!p?.name || emitted.has(p.name)) continue;
    if (p.kind === 'circle' || p.type === 'circle' || p.kind === 'line' || p.type === 'line') continue;
    const s = normalizePointOnly(p, ensureLine, ensureCircle);
    if (!s) continue;
    if (['pointOnCircle', 'midpointArc'].includes(s.sub) && arr(s.deps).length) {
      s.deps[0] = resolveCircleName(s.deps[0]);
    }
    synth.push(s);
    emitted.add(p.name);
    notes.push(`补建点 ${p.name} (${s.sub})`);
  }
  // Emit synthesized points after existing curve definitions but before final
  // "document" objects.  Construction objects are dependency-resolved in
  // multiple passes, so append order is not critical.
  out.push(...synth);
  for (const s of synth) if (s.label) existing.set(s.label, s);

  // Make sure every deps reference that names a two-letter line exists.
  for (const s of out) {
    if (s.type === 'point' && ['foot', 'reflectLine'].includes(s.sub)) {
      const d = s.deps?.[1];
      const pair = lineAlias(d);
      if (pair && !existing.has(d)) ensureLine(d, pair[0], pair[1]);
    }
  }

  /* Constraints: keep only well-formed objects, normalise common spellings. */
  const constraints = [];
  for (const c of arr(data?.constraints)) {
    if (!c || typeof c !== 'object') continue;
    const kind = c.kind || c.type;
    if (!kind) continue;
    const cc = { ...c, kind };
    if (kind === 'equalLength') {
      if (!cc.pairs && Array.isArray(cc.segments)) {
        cc.pairs = cc.segments.map((seg) => Array.isArray(seg) ? seg.slice(0, 2) : [seg?.[0], seg?.[1]]);
      }
      if (!cc.pairs && Array.isArray(cc.points) && cc.points.length >= 4) {
        cc.pairs = [[cc.points[0], cc.points[1]], [cc.points[2], cc.points[3]]];
      }
      if (!Array.isArray(cc.pairs) || cc.pairs.length < 1) continue;
    }
    if (kind === 'equalAngle') {
      if (!cc.angles && Array.isArray(cc.points) && cc.points.length >= 6) {
        cc.angles = [cc.points.slice(0, 3), cc.points.slice(3, 6)];
      }
      if (!Array.isArray(cc.angles) || cc.angles.length < 2) continue;
    }
    if (kind === 'collinear' && !Array.isArray(cc.points)) continue;
    if (kind === 'concyclic' && !Array.isArray(cc.points)) continue;
    if (['parallel', 'perpendicular'].includes(kind) && !Array.isArray(cc.lines)) continue;
    constraints.push(cc);
  }

  /* Constraint-driven promotion: turn explicit "P on a curve satisfying a
     scalar condition" statements into genuine derived constructions.  This is
     what makes the resulting board both correct and draggable. */
  const byLabel = new Map(out.map((s) => [s.label, s]).filter(([k]) => k));
  const problemText = String(data?.problem_text || '');
  const givenText = problemText.split(/证明|求证/)[0];

  // AB = BC: make the third vertex lie on the circle centred at the shared
  // vertex through the other one.  Doing it structurally is more reliable than
  // leaving three free points plus a numerical equalLength constraint.
  for (const m of problemText.matchAll(/([A-Z])([A-Z])\s*=\s*([A-Z])([A-Z])/g)) {
    const [, x, y, u, v] = m;
    if (y !== u || x === v) continue;
    const zs = byLabel.get(v), ys = byLabel.get(y), xs = byLabel.get(x);
    if (!zs || zs.type !== 'point' || zs.sub !== 'free') continue;
    if (!ys || !xs) continue;
    const circleLabel = `__eq_${y}${x}`;
    if (!byLabel.has(circleLabel)) {
      const cs = { type: 'circle', sub: 'centerThrough', label: circleLabel, deps: [y, x], visible: false, auxiliary: true };
      out.push(cs); byLabel.set(circleLabel, cs);
    }
    zs.sub = 'pointOnCircle';
    zs.deps = [circleLabel];
    zs.coordinate = zs.coordinate || zs.at;
    notes.push(`由 ${x}${y}=${y}${v} 将 ${v} 放在以 ${y} 为圆心、${x} 为过的点的圆上`);
  }

  // AA₁、BB₁、CC₁ 有相同的垂直平分线: choose one free line l and reflect
  // A,B,C across it.  All three segments then share l as perpendicular
  // bisector by construction.
  {
    const m = problemText.match(/线段\s*([A-Z])([A-Z][₁1]?)\s*[、,，]\s*([A-Z])([A-Z][₁1]?)\s*[、,，]\s*([A-Z])([A-Z][₁1]?)\s*有相同的垂直平分线/);
    if (m) {
      const pairs = [[m[1], m[2]], [m[3], m[4]], [m[5], m[6]]];
      const coordOf = (n) => pointCoords.get(n) || byLabel.get(n)?.at || byLabel.get(n)?.coordinate || null;
      let base = null;
      for (const [a, a1] of pairs) {
        const c1 = coordOf(a), c2 = coordOf(a1);
        if (Array.isArray(c1) && Array.isArray(c2)) { base = [c1, c2]; break; }
      }
      if (base) {
        const [c1, c2] = base;
        const mid = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
        let dx = c2[0] - c1[0], dy = c2[1] - c1[1];
        const L = Math.hypot(dx, dy) || 1;
        dx /= L; dy /= L;
        const a0 = [mid[0] - dy * 0.15, mid[1] + dx * 0.15];
        const a1 = [mid[0] + dy * 0.15, mid[1] - dx * 0.15];
        const n0 = '__aux_pb0', n1 = '__aux_pb1';
        for (const [nm, at] of [[n0, a0], [n1, a1]]) {
          if (!byLabel.has(nm)) {
            const sp = { type: 'point', sub: 'free', label: nm, deps: [], at, visible: false, auxiliary: true };
            out.push(sp); byLabel.set(nm, sp);
          }
        }
        const lineLabel = '__common_perp_bisector';
        if (!byLabel.has(lineLabel)) {
          const ls = { type: 'line', sub: 'through', label: lineLabel, deps: [n0, n1], visible: false };
          out.push(ls); byLabel.set(lineLabel, ls);
        }
        for (const [a, a1] of pairs) {
          const sp = byLabel.get(a1);
          if (!sp || sp.type !== 'point') continue;
          sp.sub = 'reflectLine';
          sp.deps = [a, lineLabel];
          sp.coordinate = sp.coordinate || sp.at;
          notes.push(`将 ${a1} 改为 ${a} 关于公共垂直平分线的对称点`);
        }
      }
    }
  }

  // Points defined by an equal length on a ray/segment:
  // "X 是 BA 延长线上的点，使得 BX=AC"
  // "Y 是边 CA 上的点，使得 CY=AB"
  for (const sp of out) {
    if (sp.type !== 'point' || !sp.label) continue;
    if (!['free', 'pointOnLine', 'pointOnRay', 'pointOnLineDistance', 'equalDistance'].includes(sp.sub)) continue;
    const name = sp.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let m = givenText.match(new RegExp(`${name}\\s*是\\s*([A-Z])([A-Z])\\s*延长线上的点[^。；]{0,20}?使得\\s*([A-Z])${name}\\s*=\\s*([A-Z])([A-Z])`));
    if (m) {
      const line = `line${m[1]}${m[2]}`;
      ensureLine(line, m[1], m[2]);
      sp.deps = [line, m[3], m[4], m[5]];
      notes.push(`按“${name} 在 ${m[1]}${m[2]} 延长线上且 ${m[3]}${name}=${m[4]}${m[5]}”重建 ${name}`);
      constraints.push({ kind: 'collinear', points: [name, m[3], m[2]] });
      continue;
    }
    m = givenText.match(new RegExp(`${name}\\s*是\\s*边\\s*([A-Z])([A-Z])\\s*上的点[^。；]{0,20}?使得\\s*([A-Z])${name}\\s*=\\s*([A-Z])([A-Z])`));
    if (m) {
      const line = `line${m[1]}${m[2]}`;
      ensureLine(line, m[1], m[2]);
      sp.deps = [line, m[3], m[4], m[5]];
      notes.push(`按“${name} 在 ${m[1]}${m[2]} 上且 ${m[3]}${name}=${m[4]}${m[5]}”重建 ${name}`);
      constraints.push({ kind: 'collinear', points: [name, m[3], m[2]] });
    }
  }

  // "以 L 为圆心且与 AB、AC 相切的圆": the radius is the distance from L to
  // the line, so use a hidden foot as the through-point; do not let the circle
  // depend on a later intersection P.
  for (const m of givenText.matchAll(/以\s*([A-Z](?:_[a-z])?)\s*为圆心[^。；]*?与\s*([A-Z])([A-Z])\s*[、,，]\s*([A-Z])([A-Z])\s*相切/g)) {
    const center = m[1], side = m[2] + m[3];
    const cs = [...byLabel.values()].find((c) => c.type === 'circle' && c.sub === 'centerThrough' && arr(c.deps)[0] === center);
    if (!cs) continue;
    const line = `line${side}`;
    ensureLine(line, m[2], m[3]);
    const footLabel = `__tangent_${center}_${side}`;
    if (!byLabel.has(footLabel)) {
      const fp = { type: 'point', sub: 'foot', label: footLabel, deps: [center, line], visible: false, auxiliary: true };
      out.push(fp); byLabel.set(footLabel, fp);
    }
    cs.deps = [center, footLabel];
    notes.push(`将 ${cs.label || '圆'} 改为以 ${center} 为圆心、与 ${side} 相切的圆`);
  }

  // "与线段 AD 交于 P": use the segment, not the infinite line, so the
  // intersection is the point on the actual segment in the figure.
  for (const m of givenText.matchAll(/与线段\s*([A-Z])([A-Z])\s*交于/g)) {
    const a = m[1], b = m[2];
    const ls = out.find((o) => LINE_TYPES.has(o.type) && o.sub === 'through' && arr(o.deps).length === 2
      && ((o.deps[0] === a && o.deps[1] === b) || (o.deps[0] === b && o.deps[1] === a)));
    if (ls) { ls.type = 'segment'; notes.push(`将 ${a}${b} 改为线段，用于交点 P`); }
  }

  // Incircle / excircle touchpoints: "D、E、F 分别是 ω 与 BC、CA、AB 的切点".
  // Build the actual incircle/excircle centre and use perpendicular feet, so
  // the three points are genuine tangency points instead of free dots.
  {
    const m = problemText.match(/([A-Z])\s*[、,，]\s*([A-Z])\s*[、,，]\s*([A-Z])\s*分别是\s*[^。；]*?与\s*([A-Z]{2})\s*[、,，]\s*([A-Z]{2})\s*[、,，]\s*([A-Z]{2})\s*的切点/);
    if (m && /(内切圆|旁切圆)/.test(problemText)) {
      const pts = [m[1], m[2], m[3]];
      const sides = [[m[4][0], m[4][1]], [m[5][0], m[5][1]], [m[6][0], m[6][1]]];
      const isEx = /旁切圆/.test(problemText);
      let idx = 0;
      if (isEx) {
        const am = problemText.match(/(?:角\s*([ABC])\s*内?的?旁切圆|([ABC])\s*[-－]?\s*旁切圆)/);
        idx = am ? 'ABC'.indexOf(am[1] || am[2]) : 0;
        if (idx < 0) idx = 0;
      }
      const centerName = isEx ? `I${'ABC'[idx]}` : 'I';
      const centerKey = isEx ? `I${'ABC'[idx]}` : 'I';
      if (!byLabel.has(centerName)) {
        const cp = { type: 'point', sub: 'triangleCenter', label: centerName, deps: ['A', 'B', 'C'], centerKey, visible: false, auxiliary: true };
        out.push(cp); byLabel.set(centerName, cp);
      }
      const circle = [...byLabel.values()].find((c) => c.type === 'circle' && arr(c.deps).some((d) => pts.includes(d)));
      if (circle) {
        circle.sub = isEx ? 'excircle' : 'incircle';
        circle.deps = ['A', 'B', 'C'];
        if (isEx) circle.index = idx;
        notes.push(`将 ${circle.label || '圆'} 改为${isEx ? '旁切圆' : '内切圆'}`);
      }
      pts.forEach((name, i) => {
        const sp = byLabel.get(name);
        if (!sp || sp.type !== 'point') return;
        const [a, b] = sides[i];
        const line = `line${a}${b}`;
        ensureLine(line, a, b);
        sp.sub = 'foot';
        sp.deps = [centerName, line];
        notes.push(`将切点 ${name} 改为 ${centerName} 到 ${a}${b} 的垂足`);
      });
    }
  }

  // "四边形 ABCD 内接于 ⊙O": points not already defining the circle must be
  // on it.  This catches free D in cyclic-quadrilateral problems.
  const findCircleByName = (name) => {
    const cands = [name, `omega_${name}`, `omega${name}`, `circle${name}`, `circle_${name}`, `ω${name}`, `⊙${name}`];
    for (const c of cands) {
      const o = byLabel.get(c);
      if (o?.type === 'circle') return o;
    }
    return [...byLabel.values()].find((o) => o.type === 'circle' && o.label && o.label.includes(name)) || null;
  };
  for (const m of problemText.matchAll(/([A-Z]{3,})\s*内接于\s*⊙?\s*([A-Za-z0-9_]+)/g)) {
    const names = [...m[1]];
    const circle = findCircleByName(m[2]);
    if (!circle) continue;
    for (const name of names) {
      const s = byLabel.get(name);
      if (!s || s.type !== 'point' || s.sub !== 'free') continue;
      if (arr(circle.deps).includes(name)) continue;
      s.sub = 'pointOnCircle';
      s.deps = [circle.label];
      s.coordinate = s.coordinate || s.at;
      notes.push(`由“${m[1]} 内接于 ⊙${m[2]}”将 ${name} 放在 ${circle.label} 上`);
    }
  }

  // External homothety centres of two circumcircles:
  // "△UVW、△XYZ 的外接圆的外位似中心是 P".
  for (const m of givenText.matchAll(/△\s*([A-Z](?:_[a-z])?)\s*([A-Z](?:_[a-z])?)\s*([A-Z](?:_[a-z])?)\s*[、,，]\s*△\s*([A-Z](?:_[a-z])?)\s*([A-Z](?:_[a-z])?)\s*([A-Z](?:_[a-z])?)\s*的外接圆的外位似中心是\s*([A-Z])/g)) {
    const tri1 = [m[1], m[2], m[3]], tri2 = [m[4], m[5], m[6]], target = m[7];
    const sp = byLabel.get(target);
    if (!sp || sp.type !== 'point') continue;
    const circ = [];
    for (const tri of [tri1, tri2]) {
      const label = `__hom_${tri.join('_')}`;
      let cs = byLabel.get(label);
      if (!cs) {
        cs = { type: 'circle', sub: 'threePoints', label, deps: tri, visible: false, auxiliary: true };
        out.push(cs); byLabel.set(label, cs);
      }
      circ.push(label);
    }
    sp.sub = 'externalHomothetyCenter';
    sp.deps = circ;
    notes.push(`将 ${target} 改为两外接圆的外位似中心`);
  }

  // Right angles: ∠UVW = 90° means V lies on the circle with diameter UW.
  // Only true equalities count ("∠ABC>90°" must not trigger this).
  const rightAngles = [];
  for (const m of givenText.matchAll(/=\s*90\s*[°度]?/g)) {
    const from = Math.max(
      problemText.lastIndexOf('，', m.index),
      problemText.lastIndexOf('。', m.index),
      problemText.lastIndexOf('；', m.index),
      problemText.lastIndexOf('且', m.index),
    ) + 1;
    const clause = problemText.slice(from, m.index + 3);
    for (const am of clause.matchAll(/∠\s*([A-Z])\s*([A-Z])\s*([A-Z])/g)) {
      rightAngles.push([am[1], am[2], am[3]]);
    }
  }
  // If the model made a "diameter" circle whose endpoint is itself the vertex
  // of a right angle, the circle is the wrong Thales circle (e.g. ∠BAD=90 but
  // it built the circle with diameter AC).  Drop it and rebuild from the arms.
  for (let i = out.length - 1; i >= 0; i--) {
    const c = out[i];
    if (c.type !== 'circle' || arr(c.deps).length !== 2) continue;
    const [U, W] = arr(c.deps);
    if (!rightAngles.some(([a, b, d]) => b === U || b === W)) continue;
    for (const s of out) {
      if (s.type !== 'point') continue;
      if (arr(s.deps)[0] !== c.label) continue;
      s.sub = 'free'; s.deps = [];
      s.coordinate = s.coordinate || s.at;
    }
    byLabel.delete(c.label);
    out.splice(i, 1);
    notes.push(`移除错误的直径圆 ${c.label}（端点不是直角三角形的斜边）`);
  }
  for (const [U, V, W] of rightAngles) {
    const s = byLabel.get(V);
    if (!s || s.type !== 'point') continue;
    const diam = `diam${U}${W}`;
    if (!byLabel.has(diam)) {
      const cs = { type: 'circle', sub: 'diameter', label: diam, deps: [U, W], visible: false, auxiliary: true };
      out.push(cs); byLabel.set(diam, cs);
    }
    if (s.sub === 'pointOnCircle' && arr(s.deps)[0]) {
      s.sub = 'intersection';
      s.deps = [arr(s.deps)[0], diam];
      notes.push(`由 ∠${U}${V}${W}=90° 将 ${V} 改为与直径圆的交点`);
    } else if (['free', 'pointOnLine', 'pointOnRay'].includes(s.sub)) {
      s.sub = 'pointOnCircle';
      s.deps = [diam];
      s.coordinate = s.coordinate || s.at;
      notes.push(`由 ∠${U}${V}${W}=90° 将 ${V} 放在直径 ${U}${W} 的圆上`);
    }
  }

  // A line "through P,Q" where P or Q is itself defined by intersecting that
  // same line is circular (e.g. l=DE with D=l∩AI, E=l∩BI).  Replace the
  // offending endpoint by a hidden free point at the model's coordinate; the
  // real intersection is then computed from the free line.
  for (const s of out) {
    if (!LINE_TYPES.has(s.type) || s.sub !== 'through') continue;
    const deps = arr(s.deps);
    if (deps.length < 2) continue;
    let changed = false;
    for (let i = 0; i < 2; i++) {
      const ps = byLabel.get(deps[i]);
      if (!ps || ps.type !== 'point' || !arr(ps.deps).includes(s.label)) continue;
      const coord = ps.coordinate || ps.at || pointCoords.get(ps.label) || [0.5, 0.5];
      const auxLabel = `__aux_${s.label}_${i}`;
      if (!byLabel.has(auxLabel)) {
        const aux = { type: 'point', sub: 'free', label: auxLabel, at: coord, deps: [], visible: false, auxiliary: true };
        out.push(aux); byLabel.set(auxLabel, aux);
      }
      deps[i] = auxLabel;
      changed = true;
    }
    if (changed) {
      s.deps = deps;
      notes.push(`为 ${s.label} 增加自由端点，打断“直线由交点定义”的循环`);
    }
  }

  // A circle defined as centreThrough(O,P) where P is constructed from that
  // same circle is circular.  Replace P by a hidden free "radius witness" at
  // the model's approximate location; the real P is then a genuine
  // intersection with the circle.
  for (const s of out) {
    if (s.type !== 'circle' || s.sub !== 'centerThrough') continue;
    const [C, P] = arr(s.deps);
    const ps = byLabel.get(P);
    if (!C || !P || !ps || ps.type !== 'point') continue;
    const usesThisCircle = arr(ps.deps).includes(s.label);
    if (!usesThisCircle) continue;
    const coord = ps.coordinate || ps.at || pointCoords.get(P) || [0.5, 0.5];
    const auxLabel = `__aux_${s.label}`;
    if (!byLabel.has(auxLabel)) {
      const aux = { type: 'point', sub: 'free', label: auxLabel, at: coord, deps: [], visible: false, auxiliary: true };
      out.push(aux); byLabel.set(auxLabel, aux);
    }
    s.deps = [C, auxLabel];
    notes.push(`为 ${s.label} 增加半径辅助点，打断循环依赖`);
  }

  // Break the common circular dependency A ∈ ω(…,A): a point cannot be defined
  // by a circle that is itself defined through that point.
  for (const s of out) {
    if (s.type !== 'point' || s.sub !== 'pointOnCircle') continue;
    const circle = byLabel.get(arr(s.deps)[0]);
    if (circle && arr(circle.deps).includes(s.label)) {
      s.sub = 'free';
      s.deps = [];
      notes.push(`打断循环依赖：${s.label} 改为自由点`);
    }
  }

  // "过 A 的切线" written as a line through A and its (coincident) tangent
  // point should be a tangentAt line, not a degenerate through-line.
  for (const s of out) {
    if (!LINE_TYPES.has(s.type) || s.sub !== 'through') continue;
    const [a, b] = arr(s.deps);
    const tb = byLabel.get(b);
    if (tb?.type === 'point' && tb.sub === 'tangentCirclePoint' && arr(tb.deps)[0] === a) {
      s.sub = 'tangentAt';
      s.deps = [a, tb.deps[1]];
      tb.visible = false;
      notes.push(`将 ${s.label} 改为过 ${a} 的切线`);
    }
  }

  // Incircle touchpoint side: "内切圆切 BC 于 E" fixes the side of E.
  for (const m of problemText.matchAll(/切\s*([A-Z])([A-Z])\s*于\s*([A-Z])/g)) {
    const s = byLabel.get(m[3]);
    if (s?.type === 'point' && s.sub === 'incircleTouch') {
      s.side = m[1] + m[2];
      s.sideNames = arr(s.deps).slice(0, 3);
      notes.push(`内切圆切点 ${m[3]} 取在 ${s.side} 上`);
    }
  }
  const curveKind = (name) => {
    if (!name) return null;
    const s = byLabel.get(name);
    if (s && s.type === 'circle') return 'circle';
    if (s && LINE_TYPES.has(s.type)) return 'line';
    if (circleAlias(name)) return 'circle';
    if (lineAlias(name)) return 'line';
    return null;
  };
  for (const c of constraints) {
    if (c.kind === 'onCircle' && c.point) {
      const s = byLabel.get(c.point);
      if (s && s.type === 'point' && s.sub === 'free' && c.circle) {
        s.sub = 'pointOnCircle';
        s.deps = [c.circle];
        s.coordinate = s.coordinate || s.at;
        notes.push(`由在圆条件将 ${c.point} 提升为圆上点`);
      }
    } else if (c.kind === 'onLine' && c.point) {
      const s = byLabel.get(c.point);
      if (s && s.type === 'point' && s.sub === 'free' && c.line) {
        s.sub = 'pointOnLine';
        s.deps = [c.line];
        s.coordinate = s.coordinate || s.at;
        notes.push(`由在直线条件将 ${c.point} 提升为线上点`);
      }
    }
  }
  // A free point lying on two curves is their intersection, not a free point.
  {
    const perPoint = new Map();
    for (const c of constraints) {
      if (!['onCircle', 'onLine'].includes(c.kind) || !c.point) continue;
      const curve = c.circle || c.line;
      if (!curve) continue;
      if (!perPoint.has(c.point)) perPoint.set(c.point, []);
      perPoint.get(c.point).push(curve);
    }
    for (const [name, curves] of perPoint) {
      const s = byLabel.get(name);
      if (!s || s.type !== 'point' || !['free', 'pointOnCircle', 'pointOnLine'].includes(s.sub)) continue;
      const uniq = [...new Set(curves)];
      if (uniq.length >= 2) {
        s.sub = 'intersection';
        s.deps = uniq.slice(0, 2);
        s.coordinate = s.coordinate || s.at;
        notes.push(`由两条曲线条件将 ${name} 提升为交点`);
      }
    }
  }
  for (const c of constraints) {
    if (c.kind === 'equalAngle' && Array.isArray(c.angles) && c.angles.length >= 2) {
      for (let k = 0; k < 2; k++) {
        const tri = c.angles[k], other = c.angles[1 - k];
        if (!Array.isArray(tri) || tri.length < 3 || !Array.isArray(other) || other.length < 3) continue;
        const pname = tri[2];
        const s = byLabel.get(pname);
        if (!s || s.type !== 'point' || s.sub === 'angleEqualOnCircle') continue;
        let circle = null;
        if (s.sub === 'pointOnCircle') circle = s.deps?.[0];
        else if (s.sub === 'intersection') circle = arr(s.deps).find((d) => curveKind(d) === 'circle');
        if (!circle) continue;
        s.sub = 'angleEqualOnCircle';
        s.deps = [circle, tri[1], tri[0], other[0], other[1], other[2]];
        s.coordinate = s.coordinate || s.at;
        notes.push(`由角条件将 ${pname} 提升为圆上的角度构造`);
      }
    } else if (c.kind === 'equalLength' && Array.isArray(c.pairs)) {
      for (const pair of c.pairs) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        for (const pname of pair) {
          if (c.point && c.point !== pname) continue;
          const s = byLabel.get(pname);
          if (!s || s.type !== 'point' || s.sub !== 'pointOnLine') continue;
          const partner = c.pairs.find((q) => q !== pair);
          if (!partner || partner.length < 2) continue;
          const other = pair[0] === pname ? pair[1] : pair[0];
          if (!other || other === pname) continue;
          // If the two segments share an endpoint, the point's distance is
          // measured from that endpoint; otherwise from the other endpoint of
          // its own segment (CG=BD, G on BC).
          const common = pair.find((x) => partner.includes(x));
          const anchor = common || other;
          s.sub = 'pointOnLineDistance';
          s.deps = [arr(s.deps)[0], anchor, partner[0], partner[1]];
          s.coordinate = s.coordinate || s.at;
          notes.push(`由等长条件将 ${pname} 提升为直线上的定长点`);
        }
      }
    }
  }

  // A circumcentre is not on its own circumcircle; models often emit a
  // spurious "D,E,F,P concyclic" when P is the centre of (DEF).  Drop those.
  const centerNames = new Set(out.filter((s) => s.type === 'point' && (
    s.sub === 'circumcenter' || s.sub === 'orthocenter' || s.sub === 'incenter'
    || (s.sub === 'triangleCenter' && ['O', 'I', 'H', 'G', 'N'].includes(s.centerKey))
  )).map((s) => s.label));
  for (let i = constraints.length - 1; i >= 0; i--) {
    const c = constraints[i];
    if (c.kind === 'concyclic' && Array.isArray(c.points) && c.points.some((p) => centerNames.has(p))) constraints.splice(i, 1);
  }

  // A constraint that merely restates the goal is not a given; enforcing it
  // would specialise the figure and can hide construction errors.
  const g = data?.goal || {};
  if (g.kind === 'concyclic' && Array.isArray(g.points)) {
    const want = [...g.points].sort().join('|');
    for (let i = constraints.length - 1; i >= 0; i--) {
      const c = constraints[i];
      if (c.kind === 'concyclic' && [...(c.points || [])].sort().join('|') === want) constraints.splice(i, 1);
    }
  }

  // Promotions above can re-introduce A ∈ circle(…,A); break those cycles too.
  for (const s of out) {
    if (s.type !== 'point' || s.sub !== 'pointOnCircle') continue;
    const circle = byLabel.get(arr(s.deps)[0]);
    if (circle && arr(circle.deps).includes(s.label)) {
      s.sub = 'free';
      s.deps = [];
      notes.push(`打断循环依赖：${s.label} 改为自由点`);
    }
  }

  // Right-angle constraints must agree with the text: for ∠UVW=90 the two
  // perpendicular segments are UV and VW.  Models often emit AB⊥BC instead.
  if (rightAngles.length) {
    const key = (a, b) => [a, b].sort().join('|');
    const combos = new Set();
    for (const [U, V, W] of rightAngles) combos.add([key(U, V), key(V, W)].sort().join('&'));
    for (let i = constraints.length - 1; i >= 0; i--) {
      const c = constraints[i];
      if (c.kind !== 'perpendicular' || !Array.isArray(c.lines)) continue;
      const ks = c.lines.map((p) => Array.isArray(p) ? key(p[0], p[1]) : null).filter(Boolean).sort();
      if (ks.length === 2 && combos.has(ks.join('&'))) continue;
      constraints.splice(i, 1);
      notes.push('删除与题面直角不一致的垂直约束');
    }
    for (const combo of combos) {
      const [k1, k2] = combo.split('&');
      const [a1, b1] = k1.split('|'), [a2, b2] = k2.split('|');
      const has = constraints.some((c) => c.kind === 'perpendicular' && Array.isArray(c.lines)
        && c.lines.length === 2 && c.lines.map((p) => Array.isArray(p) ? key(p[0], p[1]) : null).sort().join('&') === combo);
      if (!has) constraints.push({ kind: 'perpendicular', lines: [[a1, b1], [a2, b2]] });
    }
  }

  return { construction: out, points: arr(data?.points), constraints, notes };
}

function normalizePointOnly(p, ensureLine, ensureCircle) {
  const name = p.name;
  if (!name) return null;
  const kind = p.kind || 'free';
  const sub0 = POINT_KIND_MAP[kind] || kind;
  let deps = [];
  let sub = sub0;
  if (sub === 'triangleCenter' || ['circumcenter', 'orthocenter', 'incenter', 'centroid', 'ninepoint'].includes(sub)) {
    if (sub === 'ninepoint') { sub = 'triangleCenter'; p = { ...p, center: 'ninepoint' }; }
    const tri = arr(p.triangle);
    deps = tri.length >= 3 ? tri.slice(0, 3) : ['A', 'B', 'C'];
    if (['circumcenter', 'orthocenter', 'incenter', 'centroid'].includes(sub)) {
      deps = deps.slice(0, 3);
    }
  } else if (sub === 'foot') {
    const from = p.from || p.point;
    const to = arr(p.to || p.segment || p.onSegment);
    if (!from || to.length < 2) return null;
    const label = `line${to[0]}${to[1]}`;
    ensureLine(label, to[0], to[1]);
    deps = [from, label];
  } else if (sub === 'midpoint') {
    deps = arr(p.of || p.onSegment).slice(0, 2);
  } else if (sub === 'midpointArc') {
    const circle = p.circle || arr(p.of)[0];
    const rest = arr(p.of).filter((x) => x !== circle);
    deps = circle ? [circle, ...rest] : arr(p.of);
  } else if (sub === 'intersection') {
    let pair = arr(p.of || p.lines);
    if (pair.length === 1 && Array.isArray(pair[0])) pair = pair[0];
    deps = pair.slice(0, 2).map((x) => Array.isArray(x) ? `line${x[0]}${x[1]}` : x);
  } else if (sub === 'pointOnLine') {
    const seg = p.segment || p.onSegment || p.line;
    if (Array.isArray(seg) && seg.length === 2) {
      const label = `line${seg[0]}${seg[1]}`;
      ensureLine(label, seg[0], seg[1]);
      deps = [label];
    } else deps = [seg];
  } else if (sub === 'pointOnCircle') {
    deps = [p.circle || p.onCircle];
  } else if (sub === 'reflectLine') {
    const line = p.line;
    if (Array.isArray(line)) { const label = `line${line[0]}${line[1]}`; ensureLine(label, line[0], line[1]); deps = [p.of || p.point, label]; }
    else deps = [p.of || p.point, line];
  } else if (sub === 'equalDistance') {
    const from = arr(p.from), on = arr(p.onSegment || p.on);
    if (from.length >= 2 && on.length >= 2) deps = [from[1], from[0], on[0], on[1]];
    else return null;
  } else if (sub === 'tangentCirclePoint') {
    deps = arr(p.deps || [p.from, p.circle]);
  }
  const s = { type: 'point', sub, label: name, deps, visible: p.visible !== false };
  if (p.coordinate) s.at = p.coordinate;
  if (p.center) s.center = p.center;
  if (p.center) s.centerKey = CENTER_KEYS[p.center] || p.center;
  if (p.triangle) s.triangle = p.triangle;
  if (p.auxiliary) s.auxiliary = true;
  return s;
}

export { CENTER_KEYS };
