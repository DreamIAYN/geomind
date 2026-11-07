import assert from 'node:assert/strict';
import * as g from '../js/geometry.js';
import { solveConstraints } from '../js/constraints.js';
import * as rel from '../js/relations.js';
import * as sol from '../js/solver.js';
import { SCENARIOS, buildScenario } from '../js/scenarios.js';
import { buildVisionState, sampleVisionData, parseGeometryText, SAMPLE_TEXT } from '../js/vision.js';
import { harmonicConjugate, crossRatio, polarLine, poleOfLine } from '../js/geometry.js';

const basic = g.basicTriangleScene();
assert.equal(basic.state.objects.length, 7, 'plain triangle scene has only ABC + 3 sides + triangle');
assert.equal(Object.keys(basic.triangle.centers || {}).length, 0, 'plain triangle has no prebuilt centres');
assert.ok(basic.state.objects.find((o) => o.label === 'A' && o.type === 'point').g.y > 0, 'A above BC');
assert.ok(Math.abs(basic.state.objects.find((o) => o.label === 'B').g.y) < 1e-12 && Math.abs(basic.state.objects.find((o) => o.label === 'C').g.y) < 1e-12, 'BC horizontal');
assert.deepEqual([basic.triangle.metrics.A, basic.triangle.metrics.B, basic.triangle.metrics.C].map((x) => Math.round(x * 180 / Math.PI)), [70, 60, 50]);

const { state } = g.defaultScene();
assert.equal(state.objects.length, 13, 'default scene object count');
const tri = state.objects.find((o) => o.type === 'triangle');
assert.ok(tri && tri.valid);
assert.equal(tri.metrics.type, '锐角三角形');
for (const k of ['G', 'O', 'I', 'H', 'N']) assert.ok(tri.centers[k], 'center ' + k);

const goal = { kind: 'collinear', ids: ['O', 'G', 'H'].map((l) => state.objects.find((o) => o.label === l).id) };
const ev = sol.evaluateGoal(state, goal);
assert.ok(ev.ok && ev.residual < 1e-10, 'Euler line residual');
const stab = sol.stabilityCheck(state, goal, 4);
assert.ok(stab.stable);

const snap = rel.buildSnapshot(state);
const scan = rel.runDetection(snap, {});
assert.ok(scan.total >= 10);
assert.ok(scan.relations.some((r) => r.theorem === 'Euler line'));
assert.ok(scan.relations.some((r) => r.theorem === 'Nine-point circle'));

for (const sc of SCENARIOS) {
  const built = buildScenario(sc.id);
  assert.ok(built, sc.id + ' builds');
  assert.equal(built.state.objects.filter((o) => !o.valid).length, 0, sc.id + ' valid objects');
  if (built.goal) {
    const e = sol.evaluateGoal(built.state, built.goal);
    assert.ok(e.ok, sc.id + ' goal verified, residual=' + e.residual);
  }
}

// Derived intersections / tangent construction smoke test
const st2 = g.createState('test');
const O = g.addObject(st2, { type: 'point', sub: 'free', x: 0, y: 0, label: 'O' });
const c = g.addObject(st2, { type: 'circle', sub: 'centerRadius', deps: [O.id], radius: 2, label: 'ω' });
const P = g.addObject(st2, { type: 'point', sub: 'free', x: 3, y: 0, label: 'P' });
g.recompute(st2);
assert.equal(g.tangentPoints(P.g, O.g, 2).length, 2);
const tp = g.addObject(st2, { type: 'point', sub: 'tangentPoint', deps: [P.id, c.id], branch: 0, label: 'T' });
g.recompute(st2);
assert.ok(tp.valid && Math.abs(g.dist(tp.g, O.g) - 2) < 1e-9);

// Isogonal goal (line orientation, not point side)
const gst = g.createState('isogonal goal');
const gA = g.addObject(gst, { type: 'point', sub: 'free', x: 0, y: 0, label: 'A' });
const gB = g.addObject(gst, { type: 'point', sub: 'free', x: 1, y: 0, label: 'B' });
const gC = g.addObject(gst, { type: 'point', sub: 'free', x: 0.5, y: Math.sqrt(3) / 2, label: 'C' });
const gJ = g.addObject(gst, { type: 'point', sub: 'free', x: Math.SQRT1_2, y: Math.SQRT1_2, label: 'J' });
const gK = g.addObject(gst, { type: 'point', sub: 'free', x: Math.cos(Math.PI / 12), y: Math.sin(Math.PI / 12), label: 'K' });
g.recompute(gst);
const isoGoal = { kind: 'isogonal', vertexId: gA.id, arm1Id: gB.id, arm2Id: gC.id, jId: gJ.id, kId: gK.id, ids: [gA.id, gB.id, gC.id, gJ.id, gK.id] };
assert.ok(sol.evaluateGoal(gst, isoGoal).ok, 'isogonal goal');
gK.x = 0; gK.y = 1; g.recompute(gst);
assert.ok(!sol.evaluateGoal(gst, isoGoal).ok, 'non-isogonal rejected');
const builtIso = sol.buildGoalForKind(gst, 'isogonal', [gA.id, gB.id, gC.id, gJ.id, gK.id]);
assert.ok(builtIso && builtIso.kind === 'isogonal', 'build isogonal goal from five selected points');

// Isogonal line
const ist = g.createState('isogonal');
const iB = g.addObject(ist, { type: 'point', sub: 'free', x: 0, y: 0, label: 'B' });
const iA = g.addObject(ist, { type: 'point', sub: 'free', x: 1, y: Math.sqrt(3), label: 'A' });
const iC = g.addObject(ist, { type: 'point', sub: 'free', x: 2, y: 0, label: 'C' });
const iL = g.addObject(ist, { type: 'segment', sub: 'through', deps: [iB.id, iC.id], label: 'BC' });
const iIso = g.addObject(ist, { type: 'line', sub: 'isogonal', deps: [iA.id, iB.id, iC.id, iL.id], label: 'l' });
g.recompute(ist);
assert.ok(iIso.valid && Math.abs(g.dot(iIso.g.d, g.norm(g.sub(iA.g, iB.g)))) > 0.999999, 'isogonal of BC is BA');

// Directed angle sign conventions
const dA = { x: -0.5543775927, y: 4.2359422656 }, dB = { x: -3, y: 0 }, dC = { x: 3, y: 0 };
assert.ok(Math.abs(g.deg(g.directedAngle3(dA, dB, dC)) - 60) < 1e-6, '3-point clockwise positive');
assert.ok(Math.abs(g.deg(g.directedAngle3(dC, dB, dA)) + 60) < 1e-6, '3-point counter-clockwise negative');
assert.ok(Math.abs(g.deg(g.directedAngle2(g.sub(dC, dB), g.sub(dA, dB))) - 60) < 1e-6, '2-ray counter-clockwise positive');
assert.ok(Math.abs(g.deg(g.directedAngle2(g.sub(dA, dB), g.sub(dC, dB))) + 60) < 1e-6, '2-ray clockwise negative');

// Arbitrary-object transforms and inversion images
const tst2 = g.createState('transform images');
const tO = g.addObject(tst2, { type: 'point', sub: 'free', x: 0, y: 0, label: 'O' });
const tA = g.addObject(tst2, { type: 'point', sub: 'free', x: 2, y: 0, label: 'A' });
const tB = g.addObject(tst2, { type: 'point', sub: 'free', x: 2, y: 2, label: 'B' });
const tInv = g.addObject(tst2, { type: 'circle', sub: 'centerThrough', deps: [tO.id, tA.id], label: 'ω' });
const tLine = g.addObject(tst2, { type: 'line', sub: 'through', deps: [tA.id, tB.id], label: 'l' });
const tLineImg = g.addObject(tst2, { type: 'circle', sub: 'inversionOfLine', deps: [tLine.id, tInv.id], label: 'ω1' });
const tCircle = g.addObject(tst2, { type: 'circle', sub: 'centerThrough', deps: [tA.id, tB.id], label: 'c' });
const tCircleLine = g.addObject(tst2, { type: 'line', sub: 'inversionOfCircle', deps: [tCircle.id, tInv.id], label: 'l2' });
const tSeg = g.addObject(tst2, { type: 'segment', sub: 'through', deps: [tA.id, tB.id], label: 's' });
const tArc = g.addObject(tst2, { type: 'arc', sub: 'inversionLine', deps: [tSeg.id, tInv.id], label: 'γ' });
const tY = g.addObject(tst2, { type: 'line', sub: 'through', deps: [tO.id, g.addObject(tst2, { type: 'point', sub: 'free', x: 0, y: 3, label: 'Y' }).id], label: 'y' });
const tRef = g.addObject(tst2, { type: 'line', sub: 'transform', deps: [tLine.id, tY.id], kind: 'reflectLine', label: 'l3' });
const tRot = g.addObject(tst2, { type: 'circle', sub: 'transform', deps: [tCircle.id, tO.id], kind: 'rotate', angle: Math.PI / 2, label: 'ω2' });
g.recompute(tst2);
assert.ok(tLineImg.valid && Math.abs(tLineImg.g.center.x - 1) < 1e-9 && Math.abs(tLineImg.g.r - 1) < 1e-9, 'line inversion circle');
assert.ok(tCircleLine.valid && Math.abs(tCircleLine.g.a.x - 1) < 1e-9, 'circle through center inversion line');
assert.ok(tArc.valid && tArc.g.kind === 'arc', 'segment inversion arc');
assert.ok(tRef.valid && Math.abs(tRef.g.a.x + 2) < 1e-9, 'line reflection');
assert.ok(tRot.valid && Math.abs(tRot.g.center.y - 2) < 1e-9 && Math.abs(tRot.g.r - 2) < 1e-9, 'circle rotation');

// Explore relation goals must resolve virtual lines (v:p1|p4)
const relState = g.defaultScene().state;
const relSnap = rel.buildSnapshot(relState);
const relScan = rel.runDetection(relSnap, { max: 220 });
const vrel = relScan.relations.find((r) => (r.ids || []).some((id) => String(id).startsWith('v:')));
assert.ok(vrel, 'find virtual-line relation');
const vgoal = sol.goalFromRelation(vrel, relSnap, relState);
assert.ok(vgoal && sol.evaluateGoal(relState, vgoal).ok, 'relation goal with virtual lines verifies');

// Triangle creation is clean unless centers are explicitly requested
const cleanState = g.createState('clean triangle');
const cA = g.addObject(cleanState, { type: 'point', sub: 'free', x: 0, y: 0, label: 'A' });
const cB = g.addObject(cleanState, { type: 'point', sub: 'free', x: 1, y: 0, label: 'B' });
const cC = g.addObject(cleanState, { type: 'point', sub: 'free', x: 0, y: 1, label: 'C' });
const cleanTri = g.addTriangle(cleanState, cA.id, cB.id, cC.id);
assert.deepStrictEqual(Object.keys(cleanTri.centers || {}), []);
assert.ok(!cleanTri.show.euler && !cleanTri.show.ninePoint && !cleanTri.show.incircle, 'clean triangle has no overlays');

// Tangent at a point on a circle
const tst = g.createState('tangent');
const tc = g.addObject(tst, { type: 'point', sub: 'free', x: 0, y: 0, label: 'O' });
const tpo = g.addObject(tst, { type: 'point', sub: 'free', x: 1, y: 0, label: 'P' });
const tcirc = g.addObject(tst, { type: 'circle', sub: 'centerThrough', deps: [tc.id, tpo.id], label: 'ω' });
const tline = g.addObject(tst, { type: 'line', sub: 'tangentAt', deps: [tpo.id, tcirc.id], label: 't' });
g.recompute(tst);
assert.ok(tline.valid && Math.abs(g.dot(tline.g.d, g.sub(tpo.g, tc.g))) < 1e-9, 'tangent at point is perpendicular to radius');

// Two-line angle bisectors
const bst = g.createState('bisectors');
const bA = g.addObject(bst, { type: 'point', sub: 'free', x: 0, y: 0, label: 'A' });
const bB = g.addObject(bst, { type: 'point', sub: 'free', x: 1, y: 0, label: 'B' });
const bC = g.addObject(bst, { type: 'point', sub: 'free', x: 1, y: 1, label: 'C' });
const bl1 = g.addObject(bst, { type: 'line', sub: 'through', deps: [bA.id, bB.id], label: 'l1' });
const bl2 = g.addObject(bst, { type: 'line', sub: 'through', deps: [bA.id, bC.id], label: 'l2' });
const bb1 = g.addObject(bst, { type: 'line', sub: 'bisector2', deps: [bl1.id, bl2.id], branch: 0, label: 'b1' });
const bb2 = g.addObject(bst, { type: 'line', sub: 'bisector2', deps: [bl1.id, bl2.id], branch: 1, label: 'b2' });
g.recompute(bst);
assert.ok(bb1.valid && bb2.valid);
assert.ok(Math.abs(g.dot(bb1.g.d, bb2.g.d)) < 1e-9, 'two-line bisectors perpendicular');
assert.ok(Math.abs(g.deg(g.angleAt({ x: 1, y: 0 }, bA.g, bb1.g.d)) - 22.5) < 1e-6, 'bisects 45°');

// Projective: harmonic conjugate, cross ratio, pole/polar
const hA = { x: -1, y: 0 }, hB = { x: 1, y: 0 }, hC = { x: 0.4, y: 0 };
const hD = harmonicConjugate(hA, hB, hC);
assert.ok(hD && Math.abs(crossRatio(hA, hB, hC, hD) + 1) < 1e-9, 'harmonic conjugate');
const cO = { x: 0, y: 0 }, cR = 2, cP = { x: 4, y: 0 };
const pol = polarLine(cP, cO, cR);
assert.ok(pol && Math.abs(pol.a.x - 1) < 1e-9 && Math.abs(pol.d.x) < 1e-9, 'polar line');
const pole = poleOfLine(pol.a, pol.d, cO, cR);
assert.ok(pole && Math.abs(pole.x - 4) < 1e-9, 'pole of line');

// Inversion and Iranian inversion
const st3 = g.createState('inversion');
const O3 = g.addObject(st3, { type: 'point', sub: 'free', x: 0, y: 0, label: 'O' });
const c3 = g.addObject(st3, { type: 'circle', sub: 'centerRadius', deps: [O3.id], radius: 2, label: 'ω' });
const P3 = g.addObject(st3, { type: 'point', sub: 'free', x: 4, y: 0, label: 'P' });
const P3i = g.addObject(st3, { type: 'point', sub: 'inversion', deps: [P3.id, c3.id], label: "P'" });
const A3 = g.addObject(st3, { type: 'point', sub: 'free', x: 0, y: 0, label: 'A' });
const B3 = g.addObject(st3, { type: 'point', sub: 'free', x: 2, y: 0, label: 'B' });
const C3 = g.addObject(st3, { type: 'point', sub: 'free', x: 0, y: 3, label: 'C' });
const IB = g.addObject(st3, { type: 'point', sub: 'iranianInversion', deps: [A3.id, B3.id, C3.id, B3.id], label: "B'" });
const IC = g.addObject(st3, { type: 'point', sub: 'iranianInversion', deps: [A3.id, B3.id, C3.id, C3.id], label: "C'" });
g.recompute(st3);
assert.ok(P3i.valid && Math.abs(P3i.g.x - 1) < 1e-9 && Math.abs(P3i.g.y) < 1e-9, 'circle inversion');
assert.ok(IB.valid && g.dist(IB.g, C3.g) < 1e-9, 'Iranian inversion B→C');
assert.ok(IC.valid && g.dist(IC.g, B3.g) < 1e-9, 'Iranian inversion C→B');

// Screenshot → construction pipeline
const vision = buildVisionState(sampleVisionData());
assert.ok(vision.goal && vision.goal.kind === 'tangent', 'vision sample goal');
const ve = sol.evaluateGoal(vision.state, vision.goal);
assert.ok(ve.ok, 'vision sample tangency residual=' + ve.residual);
const parsed = parseGeometryText(SAMPLE_TEXT);
assert.ok(parsed && parsed.constraints?.[0]?.factor === 2, 'built-in text parser');
// Vision schema can set an equal-angle goal (not midpoint)
const vd = sampleVisionData();
vd.points = [
  { name: 'J', kind: 'free', coordinate: [.3, .4] },
  { name: 'K', kind: 'free', coordinate: [.7, .4] },
];
vd.goal = { kind: 'equalAngle', angles: [['B', 'A', 'J'], ['K', 'A', 'C']], text: '等角线' };
const vb = buildVisionState(vd);
assert.ok(vb.goal && vb.goal.kind === 'equalAngle', 'vision equalAngle goal');

const parsedOcr = parseGeometryText('如图，在锐角△ABC中，AB<AC，AD是高，H是垂\n心，O是外心，N是HO的中点.线段BD内一点P满足\n∠PND=2∠PAD.求证：直线BC与△AOP的外接圆相');
assert.ok(parsedOcr && parsedOcr.goal, 'OCR-truncated text parser');

const conicScenario = buildScenario('conic-five');
assert.ok(conicScenario?.state, 'conic scenario builds');
const conicCurve = conicScenario.state.objects.find((o) => o.type === 'curve' && o.sub === 'conic');
assert.ok(conicCurve?.valid && conicCurve.g?.coeffs, 'conic curve valid');
for (const dep of conicCurve.deps) {
  const p = conicScenario.state.objects.find((o) => o.id === dep);
  assert.ok(Math.abs(g.conicValue(conicCurve.g, p.g)) < 1e-8, 'conic passes through its five points');
}
const qlScenario = buildScenario('qlcu1');
assert.ok(qlScenario?.state, 'QL-Cu1 scenario builds');
const qlCurve = qlScenario.state.objects.find((o) => o.type === 'curve' && o.sub === 'qlcu1');
assert.ok(qlCurve?.valid && qlCurve.g?.lines?.length === 4, 'QL-Cu1 curve valid');
const qlLines = qlCurve.deps.map((id) => qlScenario.state.objects.find((o) => o.id === id));
for (let i = 0; i < qlLines.length; i++) {
  for (let j = i + 1; j < qlLines.length; j++) {
    const hit = g.intersectionOfCurves(qlLines[i].g, qlLines[j].g)[0];
    if (hit) assert.ok(Math.abs(g.qlcu1Value(qlCurve.g, hit)) < 1e-8, 'QL-Cu1 passes through a line intersection');
  }
}
assert.ok(SCENARIOS.length >= 10, 'curve scenarios registered');

const fixedState = g.createState('fixed');
const fA = g.addObject(fixedState, { type: 'point', sub: 'free', x: 0, y: 0, label: 'A' });
const fB = g.addObject(fixedState, { type: 'point', sub: 'free', x: 2, y: 0, label: 'B' });
const fC = g.addObject(fixedState, { type: 'point', sub: 'free', x: 0, y: 1, label: 'C' });
const fSeg = g.addObject(fixedState, { type: 'segment', sub: 'through', deps: [fA.id, fB.id] });
const fCircle = g.addObject(fixedState, { type: 'circle', sub: 'radiusFrom', deps: [fC.id, fSeg.id] });
const fPoint = g.addObject(fixedState, { type: 'point', sub: 'fixedDistance', deps: [fC.id, fA.id, fSeg.id] });
const fAngleMeasure = g.addObject(fixedState, { type: 'measure', sub: 'angle', deps: [fA.id, fB.id, fC.id] });
const fAngleLine = g.addObject(fixedState, { type: 'line', sub: 'fixedAngle', deps: [fA.id, fSeg.id, fAngleMeasure.id] });
g.recompute(fixedState);
assert.ok(fCircle.valid && Math.abs(fCircle.g.r - 2) < 1e-9, 'fixed circle radius from segment');
assert.ok(fPoint.valid && Math.abs(g.dist(fC.g, fPoint.g) - 2) < 1e-9, 'fixed-distance point');
assert.ok(fAngleLine.valid, 'fixed-angle line valid');
assert.ok(Math.abs(Math.abs(g.directedAngle2(fSeg.g.d, fAngleLine.g.d)) - Math.abs(g.directedAngle3(fA.g, fB.g, fC.g))) < 1e-8, 'fixed-angle line angle matches source');

const auxState = buildVisionState({
  title: 'aux test',
  triangle: { vertices: ['A', 'B', 'C'] },
  points: [
    { name: 'D', kind: 'free', coordinate: [0.5, 0.5], auxiliary: true },
    { name: 'E', kind: 'free', coordinate: [0.6, 0.5] },
  ],
});
const auxD = auxState.state.objects.find((o) => o.label === 'D');
const auxE = auxState.state.objects.find((o) => o.label === 'E');
assert.ok(auxD && auxD.visible === false && auxD.meta.auxiliary, 'auxiliary point hidden by default');
assert.ok(auxE && auxE.visible === true, 'normal point stays visible');

const imageData = JSON.parse((await import('node:fs')).readFileSync(new URL('./tangent-image-vision.json', import.meta.url), 'utf8'));
const imageBuilt = buildVisionState(imageData);
const dPoint = imageBuilt.state.objects.find((o) => o.label === 'D');
const pPoint = imageBuilt.state.objects.find((o) => o.label === 'P');
assert.equal(dPoint.sub, 'foot', 'altitude foot D is derived');
assert.equal(pPoint.sub, 'angleDouble', 'angle-constrained P is derived');
assert.ok(pPoint.locked, 'constrained P is locked');
const pN = imageBuilt.state.objects.find((o) => o.label === 'N');
assert.ok(Math.abs(g.angleAt(pPoint.g, pN.g, dPoint.g) - 2 * g.angleAt(pPoint.g, imageBuilt.state.objects.find((o) => o.label === 'A').g, dPoint.g)) < 1e-6, 'P satisfies angle-double constraint');

const tcData = JSON.parse((await import('node:fs')).readFileSync(new URL('./tangent-circles-vision.json', import.meta.url), 'utf8'));
const tcv = buildVisionState(tcData);
const tcvBy = (l) => tcv.state.objects.find((o) => o.label === l);
assert.equal(tcvBy('D').sub, 'midpoint', 'D is midpoint');
assert.equal(tcvBy('P').sub, 'intersection', 'P is intersection');
assert.equal(tcvBy('E').sub, 'tangentCirclePoint', 'E is tangent-circle point');
assert.equal(tcvBy('F').sub, 'tangentCirclePoint', 'F is tangent-circle point');
assert.equal(tcv.goal?.kind, 'concurrent', 'concurrent goal built');
for (const [label, circleLabel, lineA, lineB] of [['E', 'ω', 'A', 'C'], ['F', 'ω2', 'A', 'B']]) {
  const e = tcvBy(label), a = tcvBy(lineA), b = tcvBy(lineB);
  const circ = tcv.state.objects.find((o) => o.type === 'circle' && o.deps?.includes(e.id));
  assert.ok(circ?.valid && e?.valid, `tangent point/circle ${label}`);
  const dx = b.g.x - a.g.x, dy = b.g.y - a.g.y;
  const dist = Math.abs((circ.g.center.x - a.g.x) * dy - (circ.g.center.y - a.g.y) * dx) / Math.hypot(dx, dy);
  assert.ok(Math.abs(dist - circ.g.r) < 1e-6, `circle tangent at ${label}`);
}

const eqState = g.createState('eq');
const eA = g.addObject(eqState, { type: 'point', sub: 'free', x: 0, y: 4, label: 'A' });
const eB = g.addObject(eqState, { type: 'point', sub: 'free', x: -3, y: 0, label: 'B' });
const eC = g.addObject(eqState, { type: 'point', sub: 'free', x: 3, y: 0, label: 'C' });
const eAB = g.addObject(eqState, { type: 'segment', sub: 'through', deps: [eA.id, eB.id] });
const eU = g.addObject(eqState, { type: 'point', sub: 'pointOnLine', deps: [eAB.id], t: .3, label: 'U' });
const eV = g.addObject(eqState, { type: 'point', sub: 'equalDistance', deps: [eU.id, eB.id, eC.id, eA.id], label: 'V' });
g.recompute(eqState);
assert.ok(Math.abs(g.dist(eB.g, eU.g) - g.dist(eC.g, eV.g)) < 1e-9, 'CV=BU initially');
eU.t = .75; g.recompute(eqState);
assert.ok(Math.abs(g.dist(eB.g, eU.g) - g.dist(eC.g, eV.g)) < 1e-9, 'CV=BU after dragging U');

const livePlan = buildVisionState(JSON.parse((await import('node:fs')).readFileSync(new URL('./bisector-live-vision2.json', import.meta.url), 'utf8')));
const lp = (l) => livePlan.state.objects.find((o) => o.label === l);
assert.ok(lp('D') && lp('D').sub === 'reflectLine', 'live plan D derived');
assert.ok(lp('E') && lp('E').sub === 'pointOnLine', 'live plan E derived');
assert.ok(lp('F') && lp('F').sub === 'intersection', 'live plan F derived');
assert.ok(lp('P') && lp('P').sub === 'intersection' && !(Math.abs(lp('P').g.x - lp('A').g.x) < 1e-6 && Math.abs(lp('P').g.y - lp('A').g.y) < 1e-6), 'live plan P is not A');
assert.ok(lp('Q') && lp('Q').sub === 'intersection' && !(Math.abs(lp('Q').g.x - lp('A').g.x) < 1e-6 && Math.abs(lp('Q').g.y - lp('A').g.y) < 1e-6), 'live plan Q is not A');
assert.equal(livePlan.goal?.kind, 'concyclic', 'live plan goal');

const arcScenario = buildScenario('arc-incircle-perp');
const arcBy = (l) => arcScenario.state.objects.find((o) => o.label === l);
for (const label of ['D', 'E']) {
  const p = arcBy(label), c = arcScenario.state.objects.find((o) => o.sub === 'threePoints');
  assert.ok(Math.abs(g.dist(p.g, c.g.center) - c.g.r) < 1e-7, `${label} is on circumcircle`);
}
const fa = arcBy('F'), aa = arcBy('A'), bb = arcBy('B'), cc = arcBy('C');
const side = g.dist(aa.g, bb.g), ac = g.dist(aa.g, cc.g), bc = g.dist(bb.g, cc.g);
const ss = (side + ac + bc) / 2;
assert.ok(Math.abs(g.dist(aa.g, fa.g) - (ss - bc)) < 1e-7, 'incircle touch AF=s-a');
assert.ok(Math.abs(g.dist(bb.g, fa.g) - (ss - ac)) < 1e-7, 'incircle touch BF=s-b');
const dd = arcBy('D'), ff = arcBy('F'), gg = arcBy('G');
assert.ok(Math.abs(g.dot(g.sub(dd.g, ff.g), g.sub(gg.g, ff.g))) < 1e-6, 'DF perpendicular FG in the BN=EM scenario');

{
  const cs = g.createState('constraint');
  const cA = g.addObject(cs, { type: 'point', sub: 'free', x: 0, y: 0, label: 'A' });
  const cB = g.addObject(cs, { type: 'point', sub: 'free', x: 3, y: 0, label: 'B' });
  const cC = g.addObject(cs, { type: 'point', sub: 'free', x: 0, y: 4, label: 'C' });
  const cD = g.addObject(cs, { type: 'point', sub: 'free', x: 1, y: 1, label: 'D' });
  g.recompute(cs);
  const solved = solveConstraints(cs, [{ kind: 'equalLength', pairs: [[cA.id, cB.id, cC.id, cD.id]] }], { maxIter: 30 });
  assert.ok(solved.ok, 'constraint solver equalLength');
  assert.ok(Math.abs(g.dist(cA.g, cB.g) - g.dist(cC.g, cD.g)) < 1e-5, 'constraint solver residual');
}

const g2 = buildScenario('imo2022-g2');
const g2By = (l) => g2.state.objects.find((o) => o.label === l);
const g2A = g2By('A'), g2B = g2By('B'), g2C = g2By('C'), g2X = g2By('X'), g2Y = g2By('Y'), g2D = g2By('D'), g2E = g2By('E');
assert.ok(g2X?.valid && g2Y?.valid, 'IMO2022 G2 X/Y');
assert.ok(Math.abs(g.dist(g2A.g, g2D.g) - g.dist(g2D.g, g2X.g)) < 1e-7, 'DA=DX');
assert.ok(Math.abs(g.dist(g2A.g, g2E.g) - g.dist(g2E.g, g2Y.g)) < 1e-7, 'EA=EY');
const g2O = g.circumcenter(g2B.g, g2C.g, g2X.g);
assert.ok(g2O && Math.abs(g.dist(g2O, g2Y.g) - g.dist(g2O, g2B.g)) < 1e-7, 'B,C,X,Y concyclic');

const g3 = buildScenario('imo2025-g3');
const g3By = (l) => g3.state.objects.find((o) => o.label === l);
assert.ok(g3By('D')?.valid && g3By('Q')?.valid && g3By('X')?.valid, 'IMO2025 G3 points');
assert.ok(Math.abs(g.dot(g.sub(g3By('C').g, g3By('X').g), g.sub(g3By('B').g, g3By('A').g))) < 1e-6, 'CX perpendicular AB');

const g5 = buildScenario('imo2022-g5');
const g5c = g5.state.objects.filter((o) => o.type === 'circle' && o.valid);
assert.equal(g5c.length, 2, 'IMO2022 G5 two circles');
{
  const [a, b] = g5c;
  const d = g.dist(a.g.center, b.g.center);
  assert.ok(Math.min(Math.abs(d - a.g.r - b.g.r), Math.abs(d - Math.abs(a.g.r - b.g.r))) < 1e-7, 'two circumcircles tangent');
}

const g3b = buildScenario('imo2022-g3');
const g3bBy = (l) => g3b.state.objects.find((o) => o.label === l);
assert.ok(g3bBy('T')?.valid, 'IMO2022 G3 tangent intersection');
assert.ok(Math.abs(g.cross(g.sub(g3bBy('C').g, g3bBy('T').g), g.sub(g3bBy('D').g, g3bBy('T').g))) < 1e-6, 'tangent intersection on CD');

const g6 = buildScenario('imo2025-g6');
const g6By = (l) => g6.state.objects.find((o) => o.label === l);
assert.ok(g6By('A')?.valid && g6By('Z')?.valid && g6By('Q')?.valid, 'IMO2025 G6 points');
assert.ok(Math.abs(g.cross(g.sub(g6By('Z').g, g6By('A').g), g.sub(g6By('Q').g, g6By('A').g))) < 1e-6, 'A,Z,Q collinear');

const o1032 = buildScenario('orig-1032');
const oBy = (l) => o1032.state.objects.find((o) => o.label === l);
assert.ok(oBy('O₁')?.valid && oBy('O₂')?.valid && oBy('M')?.valid && oBy('N')?.valid, '1032 points');
{
  const O = g.circumcenter(oBy('O₁').g, oBy('O₂').g, oBy('M').g);
  assert.ok(O && Math.abs(g.dist(O, oBy('N').g) - g.dist(O, oBy('O₁').g)) < 1e-6, 'O1,O2,M,N concyclic');
}

const o1035 = buildScenario('orig-1035');
const o35 = (l) => o1035.state.objects.find((o) => o.label === l);
assert.ok(o35('L')?.valid && o35('P')?.valid, '1035 points');
assert.ok(Math.abs(g.dot(g.sub(o35('P').g, o35('L').g), g.sub(o35('C').g, o35('B').g))) < 1e-6, 'PL perpendicular BC');

const o1039 = buildScenario('orig-1039');
const o39 = (l) => o1039.state.objects.find((o) => o.label === l);
assert.ok(o39('X')?.valid && o39('Y')?.valid && o39('P')?.valid, '1039 points');
{
  const L = o1039.goal.lineIds.map((id) => o1039.state.objects.find((o) => o.id === id));
  const hit = g.intersectionOfCurves(g.curveOf(L[0]), g.curveOf(L[1]))[0];
  assert.ok(hit && L.every((l) => Math.abs(g.cross(g.sub(hit, l.g.a), l.g.d)) < 1e-6), 'OA,XY,PH concurrent');
}

const g2b = buildScenario('imo2025-g2');
const g2bBy = (l) => g2b.state.objects.find((o) => o.label === l);
assert.ok(g2bBy('X')?.valid && g2bBy('Y')?.valid, 'IMO2025 G2 points');
assert.ok(Math.abs(g.dot(g.sub(g2bBy('B').g, g2bBy('Y').g), g.sub(g2bBy('C').g, g2bBy('X').g))) < 1e-6, 'BY perpendicular CX');

const g4 = buildScenario('imo2022-g4');
const g4By = (l) => g4.state.objects.find((o) => o.label === l);
assert.ok(g4By('W')?.valid && g4By('D')?.valid && g4By('Z')?.valid, 'IMO2022 G4 points');
assert.ok(Math.abs(g.dist(g4By('O').g, g4By('W').g) - g.dist(g4By('O').g, g4By('D').g)) < 1e-6, 'OW=OD');
{
  const c = g4.state.objects.find((o) => o.type === 'circle' && o.label === 'ω₁');
  const l = g4.state.objects.find((o) => o.type === 'segment' && o.deps.includes(g4By('D').id) && o.deps.includes(g4By('Z').id));
  const dist = Math.abs(g.cross(g.sub(c.g.center, l.g.a), l.g.d));
  assert.ok(Math.abs(dist - c.g.r) < 1e-6, 'DZ tangent to (AXY)');
}

const g7 = buildScenario('imo2022-g7');
const g7By = (l) => g7.state.objects.find((o) => o.label === l);
assert.ok(g7By('P')?.valid && g7By('Q')?.valid && g7By('R')?.valid && g7By('X')?.valid, 'IMO2022 G7 points');
assert.ok(Math.abs(g.cross(g.sub(g7By('O').g, g7By('X').g), g.sub(g7By('H').g, g7By('X').g))) < 1e-6, 'circumcenter of PQR on OH');

const g1c = buildScenario('imo2025-g1');
const g1cBy = (l) => g1c.state.objects.find((o) => o.label === l);
assert.ok(g1cBy('P')?.valid && g1cBy('Q')?.valid, 'IMO2025 G1 P/Q');
assert.ok(Math.abs(g.cross(g.sub(g1cBy('P').g, g1cBy('A').g), g.sub(g1cBy('Q').g, g1cBy('A').g))) < 1e-6, 'A,P,Q collinear');

const o1036 = buildScenario('orig-1036');
const o36 = (l) => o1036.state.objects.find((o) => o.label === l);
assert.ok(o36('M')?.valid && o36('I')?.valid && o36('R')?.valid, '1036 points');
assert.ok(Math.abs(g.cross(g.sub(o36('M').g, o36('I').g), g.sub(o36('R').g, o36('I').g))) < 1e-6, 'M,I,R on radical axis');

const o1037 = buildScenario('orig-1037');
const o37 = (l) => o1037.state.objects.find((o) => o.label === l);
assert.ok(o37('O')?.valid && o37('P')?.valid && o37('Q')?.valid, '1037 points');
assert.ok(Math.abs(g.cross(g.sub(o37('O').g, o37('P').g), g.sub(o37('Q').g, o37('P').g))) < 1e-6, 'O,P,Q collinear');

const o1034 = buildScenario('orig-1034');
const o34 = (l) => o1034.state.objects.find((o) => o.label === l);
assert.ok(o34('E')?.valid && o34('F')?.valid && o34('D')?.valid, '1034 points');
assert.ok(Math.abs(g.angleAt(o34('C').g, o34('F').g, o34('D').g) + g.angleAt(o34('C').g, o34('A').g, o34('D').g) - Math.PI) < 1e-6, 'angle sum 180');

const ratio = buildScenario('ratio-line-isosceles');
const rr = (l) => ratio.state.objects.find((o) => o.label === l);
assert.ok(rr('X')?.valid && rr('Y')?.valid, 'ratio points');
assert.ok(Math.abs(g.dist(rr('A').g, rr('U').g) - g.dist(rr('A').g, rr('V').g)) < 1e-6, 'AU=AV');
assert.ok(Math.abs(g.dist(rr('B').g, rr('X').g) * g.dist(rr('A').g, rr('C').g) - g.dist(rr('C').g, rr('Y').g) * g.dist(rr('A').g, rr('B').g)) < 1e-6, 'BX*AC=CY*AB');

const ratioVision = buildVisionState(JSON.parse((await import('node:fs')).readFileSync(new URL('./ratio-vision.json', import.meta.url), 'utf8')));
const rv = (l) => ratioVision.state.objects.find((o) => o.label === l);
assert.equal(rv('Y').sub, 'ratioDistanceOnLine', 'vision ratio point derived');
assert.ok(rv('O1')?.valid && rv('O2')?.valid, 'vision circumcentres');
assert.ok(Math.abs(g.dist(rv('A').g, rv('U').g) - g.dist(rv('A').g, rv('V').g)) < 1e-6, 'vision ratio problem AU=AV');

const para = buildScenario('parallelogram-circle-concurrent');
const pp = (l) => para.state.objects.find((o) => o.label === l);
assert.ok(pp('Q')?.valid && pp('R')?.valid, 'parallelogram Q/R');
{
  const L = para.goal.lineIds.map((id) => para.state.objects.find((o) => o.id === id));
  const hit = g.intersectionOfCurves(g.curveOf(L[0]), g.curveOf(L[1]))[0];
  assert.ok(hit && L.every((l) => Math.abs(g.cross(g.sub(hit, l.g.a), l.g.d)) < 1e-6), 'CD,AQ,BR concurrent');
}

console.log('geometry.test.mjs: OK', { relations: scan.total, scenarios: SCENARIOS.length, vision: true });
