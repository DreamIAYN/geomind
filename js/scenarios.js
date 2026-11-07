/* ==========================================================================
   GeoMind · curated olympiad scenario library
   Every scenario builds a live, draggable construction and returns a goal
   plus a human-readable solution blueprint.
   ========================================================================== */
import {
  createState, addObject, recompute, defaultScene, addTriangle, ensureCenters,
  uniqueLabel, mid, sub, norm, perp, dot, cross, dist, TAU, add, mul, basicTriangleScene,
} from './geometry.js';

const ink = '#3d4c63';
const accent = '#ff7a59';
const cool = '#7aa2ff';
const mint = '#4fd1c5';
const gold = '#f6c76b';
const violet = '#c084fc';
const pink = '#fb7185';

function point(st, label, x, y, style = {}) {
  return addObject(st, { type: 'point', sub: 'free', x, y, label: uniqueLabel(st, label), style: { color: accent, ...style } });
}
function seg(st, a, b, style = {}) {
  return addObject(st, { type: 'segment', sub: 'through', deps: [a.id, b.id], style: { color: ink, width: .855, ...style } });
}
function line(st, a, b, label = '', style = {}) {
  return addObject(st, { type: 'line', sub: 'through', deps: [a.id, b.id], label, style: { color: cool, width: .9, dash: 5, ...style } });
}
function circle(st, sub, deps, label = '', style = {}) {
  return addObject(st, { type: 'circle', sub, deps, label, style: { color: cool, width: .95, fill: 'transparent', dash: 0, opacity: .8, ...style } });
}
function derivedPoint(st, sub, deps, label, extra = {}) {
  return addObject(st, { type: 'point', sub, deps, label: uniqueLabel(st, label), style: { color: mint, pointSize: 2.5 }, ...extra });
}
function intersection(st, a, b, label, branch = 0, style = {}) {
  return addObject(st, {
    type: 'point', sub: 'intersection', deps: [a.id, b.id], branch,
    label: uniqueLabel(st, label), style: { color: '#fb923c', pointSize: 2.5, ...style },
  });
}
function onCircle(st, c, theta, label, style = {}) {
  return addObject(st, {
    type: 'point', sub: 'pointOnCircle', deps: [c.id], theta,
    label: uniqueLabel(st, label), style: { color: accent, ...style },
  });
}
function hide(st, ...objs) { for (const o of objs) if (o) o.visible = false; }

export const PROOFS = {
  euler: {
    theorem: '欧拉线定理（Euler line）',
    summary: '用位似 h(G, −1/2) 把三条高映成三边中垂线，垂心被映成外心。',
    steps: [
      '设 M_a 为 BC 的中点，A′ 为 A 关于外接圆的对称点。由直径所对圆周角为直角，A′B ⟂ AB、A′C ⟂ AC。',
      '因为 CH ⟂ AB、BH ⟂ AC，所以 A′B ∥ CH、A′C ∥ BH，四边形 BHCA′ 是平行四边形。',
      '平行四边形对角线互相平分，故 M_a 是 HA′ 的中点。',
      '以 G 为中心、比为 −1/2 的位似 h 把 A 送到 M_a（因为 G=(A+B+C)/3），把 H 送到 O：三条高共点于 H，而中垂线共点于 O。',
      '于是 G、O、H 共线，且 GO : GH = 1 : 2，即 G = (2O+H)/3；同时 N = mid(OH) 是九点圆圆心。',
    ],
    computation: '设 A=(−2.45,−1.45), B=(2.90,−1.10), C=(0.15,2.15)，由中垂线方程得 O，由高线交点得 H；直接验证 det(O−G, H−G)=0 且 |GH|=2|GO|。',
  },
  simson: {
    theorem: '西姆松线定理（Simson line）',
    summary: '圆上一点向三边作垂线，三个垂足共线；逆向命题也成立。',
    steps: [
      '设 P 在 △ABC 的外接圆上，X、Y、Z 分别是 P 到 AB、BC、CA 的垂足。',
      '∠PXB = ∠PYB = 90°，故 B、X、P、Y 四点共圆；同理 C、Y、P、Z 四点共圆。',
      '由 B、X、P、Y 共圆，∠PXY = ∠PBY；由 C、Y、P、Z 共圆，∠PYZ = ∠PCZ。',
      '因为 A、B、C、P 共圆，∠PBY = ∠PCZ（同弧 PA 所对圆周角，需按有向角理解）。',
      '于是 ∠PXY = ∠PYZ，即 XY 与 YZ 重合，X、Y、Z 三点共线。',
    ],
    computation: '取单位外接圆，令 P=p、A=a、B=b、C=c（|a|=|b|=|c|=|p|=1）。垂足公式为 x=(p+a−b−c+ab(\\bar p+\\bar a−\\bar b−\\bar c))/2 等；直接检查 x,y,z 的行列式为 0。',
  },
  butterfly: {
    theorem: '蝴蝶定理（Butterfly theorem）',
    summary: '过弦 AB 中点 M 的两条弦 CD、EF，与 AB 的交点 P、Q 关于 M 对称。',
    steps: [
      '设 M 是圆 O 的弦 AB 的中点，过 M 作两条弦 CD、EF。',
      '记 P = CF ∩ AB，Q = DE ∩ AB。要证 MP = MQ。',
      '对圆内接四边形 CDFE 使用圆幂：MP² − MA² = MC·MD（对 P 的幂），MQ² − MB² = ME·MF（对 Q 的幂）。',
      '由相交弦定理 MC·MD = ME·MF，且 MA = MB，代入两式得 MP² = MQ²。',
      'P、Q 位于 M 的同侧或异侧时按有向长度处理；结合图形位置得 MP = MQ，即 M 是 PQ 的中点。',
    ],
    computation: '以 M 为原点、AB 为 x 轴，设圆 x²+y²=R²−m²（M 在圆内），两条过 M 的直线参数化后与圆求交；C,F,D,E 的坐标满足对合关系，CF、DE 与 x 轴交点的横坐标互为相反数。',
  },
  gergonne: {
    theorem: '热尔岗定理（Gergonne point）与塞瓦定理',
    summary: '内切圆三切点与对顶点的连线共点，交点为热尔岗点。',
    steps: [
      '设内切圆与 BC、CA、AB 分别切于 D、E、F，记 BD = BF = x，CD = CE = y，AE = AF = z（切线长相等）。',
      '于是 BD/DC = x/y，CE/EA = y/z，AF/FB = z/x。',
      '三式相乘得 (BD/DC)(CE/EA)(AF/FB) = 1。',
      '由塞瓦定理的逆定理，AD、BE、CF 三线共点。该公共点称为热尔岗点 Ge。',
    ],
    computation: '取 A、B、C 坐标，利用内切圆圆心 I 到三边距离等于 r 求出 D、E、F；AD、BE、CF 的两两交点重合。',
  },
  fermat: {
    theorem: '费马—托里切利点（Fermat point）',
    summary: '三边外作正三角形，三个外顶点与对顶点的连线共点，且张角均为 120°。',
    steps: [
      '在 △ABC 的三边外侧分别作正三角形 BCX、CAY、ABZ。',
      '把平面绕 A 旋转 60°（配合适当的正三角形方向），可把直线 BX 送到 CY，由此得到 AX、BY、CZ 的共点性。',
      '设公共点为 F。由正三角形的 60° 旋转与圆周角关系，可得 ∠AFB = ∠BFC = ∠CFA = 120°。',
      '因此 F 到三顶点距离之和最小；当三角形有一个角 ≥120° 时，费马点退化为该钝角顶点。',
    ],
    computation: '用复数或坐标直接构造 X = mid(B,C) ± (√3/2)·R₉₀(C−B)，再求 AX 与 BY 的交点，验证该点在 CZ 上。',
  },
  pascal: {
    theorem: '帕斯卡定理（Pascal theorem）',
    summary: '圆内接六边形的三组对边交点共线（Pascal 线）。',
    steps: [
      '设 A₁、A₂、A₃、A₄、A₅、A₆ 依次在圆上。',
      '令 X = A₁A₂ ∩ A₄A₅，Y = A₂A₃ ∩ A₅A₆，Z = A₃A₄ ∩ A₆A₁。',
      '对圆锥曲线（这里是圆）应用帕斯卡定理：六边形三组对边的交点共线。',
      '于是 X、Y、Z 共线，这条直线称为帕斯卡线。',
    ],
    computation: '把圆参数化为 z=e^{iθ}，将六条弦的方程写成复线性方程，求三组交点后用 2×2 行列式验证共线。',
  },
  miquel: {
    theorem: '密克尔定理（Miquel theorem）',
    summary: '三角形三边上的三点所成三个小三角形的外接圆共点。',
    steps: [
      '设 D∈BC、E∈CA、F∈AB。记 M 为 (AEF) 与 (BFD) 的第二个交点。',
      '由 A、E、M、F 共圆，∠EMF = ∠EAF = ∠A；由 B、F、M、D 共圆，∠FMD = ∠FBD = ∠B。',
      '于是 ∠EMD = ∠EMF + ∠FMD = A + B = 180° − C（按 M 的位置取有向角）。',
      '因此 ∠EMD + ∠ECD = 180°，C、D、M、E 四点共圆，即 M 在 (CDE) 上。',
      '所以 (AEF)、(BFD)、(CDE) 三圆共点于 M，称为密克尔点。',
    ],
    computation: '写出三个外接圆的方程，联立 (AEF) 与 (BFD) 得到两个交点 F、M；代入 (CDE) 方程验证。',
  },
};

function goalBase(kind, labels, title, extra = {}) {
  return { kind, labels, title, statement: title.replace(/^证明[：:]?\s*/, ''), ...extra };
}

export const SCENARIOS = [
  {
    id: 'basic-triangle', title: '基本三角形 ABC', short: '基本', category: '基础',
    difficulty: 1, tags: ['基本作图', '70° / 60° / 50°'], glyph: 'triangle',
    description: 'A 在 BC 上方，BC 水平，∠A = 70°，∠B = 60°，∠C = 50°。默认只保留三角形三边，可从空画板开始构造。',
    build() {
      const { state, triangle } = basicTriangleScene();
      state.meta.scenarioId = 'basic-triangle';
      return { state, goal: null, proof: null, focus: 'triangle' };
    },
  },
  {
    id: 'euler-ninepoint', title: '欧拉线与九点圆', short: '五心', category: '三角形',
    difficulty: 3, tags: ['五心', '欧拉线', '九点圆'], glyph: 'triangle', proof: PROOFS.euler,
    description: '拖动三角形顶点，观察外心 O、重心 G、垂心 H 始终共线，以及九点圆随位似变化。',
    build() {
      const { state, triangle } = defaultScene();
      state.meta.scenarioId = 'euler-ninepoint';
      triangle.show.ninePoint = true;
      triangle.show.orthic = true;
      recompute(state);
      const ids = ['O', 'G', 'H'].map((l) => state.objects.find((o) => o.label === l)?.id).filter(Boolean);
      return {
        state,
        goal: goalBase('collinear', ['O', 'G', 'H'], '证明 O、G、H 三点共线，并求 OG : GH', { ids, scenarioId: 'euler-ninepoint' }),
        proof: PROOFS.euler,
        focus: 'triangle',
      };
    },
  },
  {
    id: 'simson', title: '西姆松线', short: '共线', category: '圆与共线',
    difficulty: 4, tags: ['西姆松线', '共圆', '垂足'], glyph: 'circle-line', proof: PROOFS.simson,
    description: 'P 在外接圆上，向三边作垂线。三个垂足总在一条直线上，拖动 P 观察包络。',
    build() {
      const st = createState('西姆松线');
      const A = point(st, 'A', -3.25, -1.65, { color: accent });
      const B = point(st, 'B', 3.05, -1.35, { color: accent });
      const C = point(st, 'C', 0.25, 2.55, { color: accent });
      recompute(st);
      const AB = seg(st, A, B), BC = seg(st, B, C), CA = seg(st, C, A);
      const omega = circle(st, 'threePoints', [A.id, B.id, C.id], 'ω', { color: cool, opacity: .7 });
      recompute(st);
      const P = onCircle(st, omega, 4.12, 'P', { color: gold, pointSize: 2.8 });
      recompute(st);
      const X = derivedPoint(st, 'foot', [P.id, AB.id], 'X', { style: { color: mint, pointSize: 2.6 } });
      const Y = derivedPoint(st, 'foot', [P.id, BC.id], 'Y', { style: { color: mint, pointSize: 2.6 } });
      const Z = derivedPoint(st, 'foot', [P.id, CA.id], 'Z', { style: { color: mint, pointSize: 2.6 } });
      recompute(st);
      const simson = line(st, X, Y, 'ℓ', { color: gold, width: .8, dash: 5 });
      seg(st, P, X, { color: 'rgba(79,209,197,.55)', width: 1, dash: 3 });
      seg(st, P, Y, { color: 'rgba(79,209,197,.55)', width: 1, dash: 3 });
      seg(st, P, Z, { color: 'rgba(79,209,197,.55)', width: 1, dash: 3 });
      recompute(st);
      st.meta.scenarioId = 'simson';
      return {
        state: st,
        goal: goalBase('collinear', ['X', 'Y', 'Z'], '证明 X、Y、Z 三点共线（西姆松线）', { ids: [X.id, Y.id, Z.id], scenarioId: 'simson' }),
        proof: PROOFS.simson, focus: 'ai',
      };
    },
  },
  {
    id: 'butterfly', title: '蝴蝶定理', short: '中点', category: '圆与中点',
    difficulty: 4, tags: ['蝴蝶定理', '圆幂', '中点'], glyph: 'butterfly', proof: PROOFS.butterfly,
    description: 'M 是弦 AB 的中点，两弦 CD、EF 过 M。CF、DE 与 AB 交于 P、Q，证明 MP = MQ。',
    build() {
      const st = createState('蝴蝶定理');
      const O = point(st, 'O', 0, 0, { color: cool, pointSize: 2.5 });
      const omega = circle(st, 'centerRadius', [O.id], 'ω', { color: cool, opacity: .75 });
      omega.radius = 3.25;
      const thetaA = Math.PI * 1.12, thetaB = Math.PI * 1.94;
      const A = onCircle(st, omega, thetaA, 'A', { color: accent });
      const B = onCircle(st, omega, thetaB, 'B', { color: accent });
      recompute(st);
      const AB = seg(st, A, B);
      const ABline = line(st, A, B, 'AB', { color: 'rgba(61,76,99,.35)', width: 1, dash: 0 });
      ABline.visible = false;
      const M = derivedPoint(st, 'midpoint', [A.id, B.id], 'M', { style: { color: gold, pointSize: 2.8 } });
      recompute(st);
      const u1 = point(st, 'u', M.g.x + Math.cos(2.8), M.g.y + Math.sin(2.8), { color: mint });
      const u2 = point(st, 'v', M.g.x + Math.cos(1.1), M.g.y + Math.sin(1.1), { color: mint });
      hide(st, u1, u2);
      recompute(st);
      const l1 = line(st, M, u1, '', { color: violet, width: .9, dash: 4 });
      const l2 = line(st, M, u2, '', { color: pink, width: .9, dash: 4 });
      l1.visible = false; l2.visible = false;
      recompute(st);
      const C = intersection(st, omega, l1, 'C', 0, { style: { color: violet, pointSize: 2.6 } });
      const D = intersection(st, omega, l1, 'D', 1, { style: { color: violet, pointSize: 2.6 } });
      const E = intersection(st, omega, l2, 'E', 0, { style: { color: pink, pointSize: 2.6 } });
      const F = intersection(st, omega, l2, 'F', 1, { style: { color: pink, pointSize: 2.6 } });
      recompute(st);
      const CF = line(st, C, F, '', { color: 'rgba(246,199,107,.65)', width: .85 });
      const DE = line(st, D, E, '', { color: 'rgba(246,199,107,.65)', width: .85 });
      CF.visible = false; DE.visible = false;
      recompute(st);
      seg(st, C, D, { color: 'rgba(192,132,252,.62)', width: .9 });
      seg(st, E, F, { color: 'rgba(251,113,133,.6)', width: .9 });
      seg(st, C, F, { color: 'rgba(246,199,107,.62)', width: .8 });
      seg(st, D, E, { color: 'rgba(246,199,107,.62)', width: .8 });
      recompute(st);
      recompute(st);
      const P = intersection(st, CF, ABline, 'P', 0, { style: { color: gold, pointSize: 2.6 } });
      const Q = intersection(st, DE, ABline, 'Q', 0, { style: { color: gold, pointSize: 2.6 } });
      seg(st, M, P, { color: 'rgba(246,199,107,.55)', width: 1, dash: 3 });
      seg(st, M, Q, { color: 'rgba(246,199,107,.55)', width: 1, dash: 3 });
      recompute(st);
      st.meta.scenarioId = 'butterfly';
      return {
        state: st,
        goal: goalBase('midpoint', ['M', 'P', 'Q'], '证明 M 是 PQ 的中点', { pointId: M.id, pairIds: [P.id, Q.id], ids: [M.id, P.id, Q.id], scenarioId: 'butterfly' }),
        proof: PROOFS.butterfly, focus: 'ai',
      };
    },
  },
  {
    id: 'gergonne', title: '热尔岗点与塞瓦', short: '共点', category: '三角形',
    difficulty: 3, tags: ['内切圆', '塞瓦定理', '切线长'], glyph: 'incircle', proof: PROOFS.gergonne,
    description: '内切圆与三边的切点分别与对顶点相连，三条塞瓦线共点于热尔岗点。',
    build() {
      const st = createState('热尔岗点');
      const A = point(st, 'A', -3.05, -1.55, { color: accent });
      const B = point(st, 'B', 3.2, -1.3, { color: accent });
      const C = point(st, 'C', -0.15, 2.6, { color: accent });
      recompute(st);
      const AB = seg(st, A, B), BC = seg(st, B, C), CA = seg(st, C, A);
      const tri = addTriangle(st, A.id, B.id, C.id, { centers: true, centerKeys: ['I'] });
      recompute(st);
      const I = st.objects.find((o) => o.type === 'point' && o.meta?.triangle === tri.id && o.centerKey === 'I');
      const omega = circle(st, 'incircle', [A.id, B.id, C.id], 'ω', { color: mint, opacity: .8 });
      recompute(st);
      const D = derivedPoint(st, 'foot', [I.id, BC.id], 'D', { style: { color: mint } });
      const E = derivedPoint(st, 'foot', [I.id, CA.id], 'E', { style: { color: mint } });
      const F = derivedPoint(st, 'foot', [I.id, AB.id], 'F', { style: { color: mint } });
      const AD = line(st, A, D, '', { color: gold, width: .95, dash: 4 });
      const BE = line(st, B, E, '', { color: gold, width: .95, dash: 4 });
      const CF = line(st, C, F, '', { color: gold, width: .95, dash: 4 });
      AD.visible = false; BE.visible = false; CF.visible = false;
      recompute(st);
      seg(st, A, D, { color: 'rgba(246,199,107,.68)', width: .855 });
      seg(st, B, E, { color: 'rgba(246,199,107,.68)', width: .855 });
      seg(st, C, F, { color: 'rgba(246,199,107,.68)', width: .855 });
      recompute(st);
      const Ge = intersection(st, AD, BE, 'Ge', 0, { style: { color: gold, pointSize: 2.8 } });
      recompute(st);
      st.meta.scenarioId = 'gergonne';
      return {
        state: st,
        goal: goalBase('concurrent', ['AD', 'BE', 'CF'], '证明 AD、BE、CF 三线共点（热尔岗点）', { lineIds: [AD.id, BE.id, CF.id], ids: [AD.id, BE.id, CF.id], pointIds: [Ge.id], scenarioId: 'gergonne' }),
        proof: PROOFS.gergonne, focus: 'ai',
      };
    },
  },
  {
    id: 'fermat', title: '费马点', short: '共点', category: '三角形',
    difficulty: 5, tags: ['费马点', '正三角形', '旋转变换'], glyph: 'fermat', proof: PROOFS.fermat,
    description: '三边外作正三角形，外顶点与对顶点的连线共点；拖动三角形观察 120° 张角。',
    build() {
      const st = createState('费马点');
      const A = point(st, 'A', -3.1, -1.5, { color: accent });
      const B = point(st, 'B', 3.15, -1.2, { color: accent });
      const C = point(st, 'C', 0.1, 2.65, { color: accent });
      recompute(st);
      const AB = seg(st, A, B), BC = seg(st, B, C), CA = seg(st, C, A);
      const outward = (U, V, W) => {
        const m = mid(U.g, V.g);
        const n = perp(norm(sub(V.g, U.g)));
        return dot(n, sub(W.g, m)) < 0 ? 1 : -1;
      };
      const X = addObject(st, { type: 'point', sub: 'equilateral', deps: [B.id, C.id], sign: outward(B, C, A), label: 'X', style: { color: violet, pointSize: 2.5 } });
      const Y = addObject(st, { type: 'point', sub: 'equilateral', deps: [C.id, A.id], sign: outward(C, A, B), label: 'Y', style: { color: violet, pointSize: 2.5 } });
      const Z = addObject(st, { type: 'point', sub: 'equilateral', deps: [A.id, B.id], sign: outward(A, B, C), label: 'Z', style: { color: violet, pointSize: 2.5 } });
      recompute(st);
      seg(st, B, X, { color: 'rgba(192,132,252,.45)', width: 1, dash: 4 });
      seg(st, C, X, { color: 'rgba(192,132,252,.45)', width: 1, dash: 4 });
      seg(st, C, Y, { color: 'rgba(192,132,252,.45)', width: 1, dash: 4 });
      seg(st, A, Y, { color: 'rgba(192,132,252,.45)', width: 1, dash: 4 });
      seg(st, A, Z, { color: 'rgba(192,132,252,.45)', width: 1, dash: 4 });
      seg(st, B, Z, { color: 'rgba(192,132,252,.45)', width: 1, dash: 4 });
      const AX = line(st, A, X, '', { color: gold, width: .95, dash: 3 });
      const BY = line(st, B, Y, '', { color: gold, width: .95, dash: 3 });
      const CZ = line(st, C, Z, '', { color: gold, width: .95, dash: 3 });
      AX.visible = false; BY.visible = false; CZ.visible = false;
      recompute(st);
      seg(st, A, X, { color: 'rgba(246,199,107,.65)', width: .85, dash: 3 });
      seg(st, B, Y, { color: 'rgba(246,199,107,.65)', width: .85, dash: 3 });
      seg(st, C, Z, { color: 'rgba(246,199,107,.65)', width: .85, dash: 3 });
      recompute(st);
      const Fp = intersection(st, AX, BY, 'F', 0, { style: { color: gold, pointSize: 2.9 } });
      recompute(st);
      st.meta.scenarioId = 'fermat';
      return {
        state: st,
        goal: goalBase('concurrent', ['AX', 'BY', 'CZ'], '证明 AX、BY、CZ 三线共点（费马点）', { lineIds: [AX.id, BY.id, CZ.id], ids: [AX.id, BY.id, CZ.id], pointIds: [Fp.id], scenarioId: 'fermat' }),
        proof: PROOFS.fermat, focus: 'ai',
      };
    },
  },
  {
    id: 'pascal', title: '帕斯卡线', short: '共线', category: '圆与射影',
    difficulty: 5, tags: ['帕斯卡定理', '圆内接六边形', '射影几何'], glyph: 'hexagon', proof: PROOFS.pascal,
    description: '圆内接六边形的三组对边交点共线。拖动六个圆上点，直线始终经过三点。',
    build() {
      const st = createState('帕斯卡线');
      const O = point(st, 'O', 0, 0, { color: cool, pointSize: 2.5 });
      const omega = circle(st, 'centerRadius', [O.id], 'ω', { color: cool, opacity: .7 });
      omega.radius = 3.3;
      const angles = [2.114, 3.662, 4.139, 4.768, 5.124, 5.554];
      const pts = angles.map((t, i) => onCircle(st, omega, t, 'A' + (i + 1), { color: accent, pointSize: 2.6 }));
      recompute(st);
      const side = [];
      for (let i = 0; i < 6; i++) side.push(line(st, pts[i], pts[(i + 1) % 6], '', { color: 'rgba(61,76,99,.55)', width: .9 }));
      for (const l of side) l.visible = false;
      recompute(st);
      for (let i = 0; i < 6; i++) seg(st, pts[i], pts[(i + 1) % 6], { color: 'rgba(61,76,99,.58)', width: .855 });
      recompute(st);
      const X = intersection(st, side[0], side[3], 'X', 0, { style: { color: gold, pointSize: 2.8 } });
      const Y = intersection(st, side[1], side[4], 'Y', 0, { style: { color: gold, pointSize: 2.8 } });
      const Z = intersection(st, side[2], side[5], 'Z', 0, { style: { color: gold, pointSize: 2.8 } });
      recompute(st);
      const pascalLine = line(st, X, Y, 'ℓ', { color: gold, width: .855, dash: 4 });
      recompute(st);
      st.meta.scenarioId = 'pascal';
      return {
        state: st,
        goal: goalBase('collinear', ['X', 'Y', 'Z'], '证明 X、Y、Z 三点共线（帕斯卡线）', { ids: [X.id, Y.id, Z.id], scenarioId: 'pascal' }),
        proof: PROOFS.pascal, focus: 'ai',
      };
    },
  },
  {
    id: 'miquel', title: '密克尔点', short: '共圆', category: '圆与共点',
    difficulty: 5, tags: ['密克尔点', '共圆', '角度追踪'], glyph: 'miquel', proof: PROOFS.miquel,
    description: '三角形三边上的三点形成三个小三角形，三个外接圆共点于密克尔点。',
    build() {
      const st = createState('密克尔点');
      const A = point(st, 'A', -3.2, -1.55, { color: accent });
      const B = point(st, 'B', 3.2, -1.35, { color: accent });
      const C = point(st, 'C', 0.15, 2.55, { color: accent });
      recompute(st);
      const AB = seg(st, A, B), BC = seg(st, B, C), CA = seg(st, C, A);
      const D = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [BC.id], t: 0.38, label: 'D', style: { color: mint, pointSize: 2.6 } });
      const E = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [CA.id], t: 0.42, label: 'E', style: { color: mint, pointSize: 2.6 } });
      const F = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [AB.id], t: 0.56, label: 'F', style: { color: mint, pointSize: 2.6 } });
      recompute(st);
      seg(st, D, E, { color: 'rgba(79,209,197,.5)', width: 1, dash: 4 });
      seg(st, E, F, { color: 'rgba(79,209,197,.5)', width: 1, dash: 4 });
      seg(st, F, D, { color: 'rgba(79,209,197,.5)', width: 1, dash: 4 });
      const c1 = circle(st, 'threePoints', [A.id, E.id, F.id], 'ω₁', { color: cool, opacity: .62 });
      const c2 = circle(st, 'threePoints', [B.id, F.id, D.id], 'ω₂', { color: violet, opacity: .62 });
      const c3 = circle(st, 'threePoints', [C.id, D.id, E.id], 'ω₃', { color: gold, opacity: .62 });
      recompute(st);
      const M0 = intersection(st, c1, c2, 'M', 0, { style: { color: gold, pointSize: 2.9 } });
      const M1 = intersection(st, c1, c2, 'M′', 1, { style: { color: gold, pointSize: 2.9 } });
      recompute(st);
      let M = M0;
      if (M0.g && F.g && dist(M0.g, F.g) < 1e-5 && M1.g) M = M1;
      if (M0.valid && M1.valid) {
        // keep the point that is not F
        if (dist(M0.g, F.g) < dist(M1.g, F.g)) { M = M1; M0.visible = false; } else { M = M0; M1.visible = false; }
      }
      recompute(st);
      st.meta.scenarioId = 'miquel';
      return {
        state: st,
        goal: goalBase('concyclic', ['C', 'D', 'E', 'M'], '证明 C、D、E、M 四点共圆（密克尔点）', { ids: [C.id, D.id, E.id, M.id], scenarioId: 'miquel' }),
        proof: PROOFS.miquel, focus: 'ai',
      };
    },
  },
  {
    id: 'conic-five', title: '五点圆锥曲线', short: '二次曲线', category: '曲线',
    difficulty: 2, tags: ['圆锥曲线', '五点定曲线', '椭圆'], glyph: 'conic', proof: null,
    description: '任意五点确定一条二次曲线；拖动五点，观察椭圆、抛物线、双曲线的连续变化。',
    build() {
      const st = createState('五点圆锥曲线');
      const P1 = point(st, 'P₁', -3.0, 0, { color: violet });
      const P2 = point(st, 'P₂', 0, 2.0, { color: violet });
      const P3 = point(st, 'P₃', 3.0, 0, { color: violet });
      const P4 = point(st, 'P₄', 0, -2.0, { color: violet });
      const P5 = point(st, 'P₅', 2.0, 1.49, { color: violet });
      recompute(st);
      addObject(st, { type: 'curve', sub: 'conic', deps: [P1.id, P2.id, P3.id, P4.id, P5.id], label: 'Γ', style: { color: violet, width: 1.2, dash: 0 } });
      recompute(st);
      st.meta.scenarioId = 'conic-five';
      st.view.scale = 72;
      return { state: st, goal: null, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'qlcu1', title: '完全四边形与巨龙曲线', short: '巨龙', category: '曲线',
    difficulty: 5, tags: ['QL-Cu1', '完全四边形', '三次曲线'], glyph: 'curve', proof: null,
    description: '取四条直线组成完全四边形；到四线垂足共圆的点轨迹就是 QL-Cu1（巨龙曲线）。',
    build() {
      const st = createState('完全四边形与巨龙曲线');
      const A = point(st, 'A', -3.1, -2.0, { color: accent });
      const B = point(st, 'B', 3.2, -2.1, { color: accent });
      const C = point(st, 'C', 0.4, 2.6, { color: accent });
      const D = point(st, 'D', -2.4, 1.1, { color: mint });
      const E = point(st, 'E', 2.5, 1.6, { color: mint });
      recompute(st);
      const l1 = line(st, A, B, 'ℓ₁', { color: cool, dash: 0, width: 1 });
      const l2 = line(st, B, C, 'ℓ₂', { color: cool, dash: 0, width: 1 });
      const l3 = line(st, C, A, 'ℓ₃', { color: cool, dash: 0, width: 1 });
      const l4 = line(st, D, E, 'ℓ₄', { color: mint, dash: 0, width: 1 });
      recompute(st);
      addObject(st, { type: 'curve', sub: 'qlcu1', deps: [l1.id, l2.id, l3.id, l4.id], label: 'Cu₁', style: { color: violet, width: 1.35, dash: 0 } });
      recompute(st);
      st.meta.scenarioId = 'qlcu1';
      st.view.scale = 70;
      return { state: st, goal: null, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'exterior-bisector-trapezoid', title: '外角平分线与等腰梯形', short: '四倍角', category: '角度',
    difficulty: 5, tags: ['外角平分线', '等腰梯形', '外心', '四倍角'], glyph: 'trapezoid', proof: null,
    description: 'E、F 在外角平分线上，BCEF 为等腰梯形，P 为其外心；L 在△PEF外接圆上且 PL∥AO。观察 ∠AOP=4∠ALP。',
    build() {
      const { state: st, triangle: tri } = basicTriangleScene();
      const by = (label) => st.objects.find((o) => o.label === label);
      const A = by('A'), B = by('B'), C = by('C');
      const F = addObject(st, { type: 'point', sub: 'trapezoidEndpoint', deps: [A.id, B.id, C.id], branch: 0, label: 'F', style: { color: mint, pointSize: 3.0 } });
      const E = addObject(st, { type: 'point', sub: 'trapezoidEndpoint', deps: [A.id, B.id, C.id], branch: 1, label: 'E', style: { color: mint, pointSize: 3.0 } });
      recompute(st);
      const pbBC = addObject(st, { type: 'line', sub: 'perpbis', deps: [B.id, C.id], visible: false });
      const pbEF = addObject(st, { type: 'line', sub: 'perpbis', deps: [E.id, F.id], visible: false });
      const P = addObject(st, { type: 'point', sub: 'intersection', deps: [pbBC.id, pbEF.id], branch: 0, label: 'P', style: { color: gold, pointSize: 3.1 } });
      const O = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'O', label: 'O', style: { color: cool, pointSize: 3.0 } });
      const AO = addObject(st, { type: 'line', sub: 'through', deps: [A.id, O.id], label: 'AO', style: { color: cool, width: .8, dash: 5, opacity: .55 } });
      const par = addObject(st, { type: 'line', sub: 'parallel', deps: [P.id, AO.id], label: 'ℓ', style: { color: gold, width: .9, dash: 5, opacity: .8 } });
      const circlePEF = addObject(st, { type: 'circle', sub: 'threePoints', deps: [P.id, E.id, F.id], label: 'ω', style: { color: violet, width: 1.05, dash: 4, fill: 'transparent', opacity: .9 } });
      recompute(st);
      const L0 = addObject(st, { type: 'point', sub: 'intersection', deps: [par.id, circlePEF.id], branch: 0, label: 'L', style: { color: pink, pointSize: 3.1 } });
      const L1 = addObject(st, { type: 'point', sub: 'intersection', deps: [par.id, circlePEF.id], branch: 1, label: 'L′', style: { color: pink, pointSize: 3.1 } });
      recompute(st);
      let L = L0;
      if (!L0.valid || (L1.valid && dist(L1.g, P.g) > dist(L0.g, P.g))) L = L1;
      L.label = 'L';
      const other = L === L0 ? L1 : L0;
      other.visible = false;
      recompute(st);
      const pointOrder = ['A', 'B', 'C', 'O', 'E', 'F', 'P', 'L'];
      const orderedPoints = pointOrder.map((l) => st.objects.find((o) => o.type === 'point' && o.label === l)).filter(Boolean);
      st.objects = [...orderedPoints, ...st.objects.filter((o) => o.type !== 'point')];
      st.docName = '外角平分线与等腰梯形';
      st.meta.scenarioId = 'exterior-bisector-trapezoid';
      st.view.scale = 78;
      return { state: st, goal: null, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'bisector-parallel-tangent', title: '角平分线·平行弦·双切圆', short: '四点共圆', category: '圆与共点',
    difficulty: 5, tags: ['角平分线', '平行线', '切圆', '四点共圆'], glyph: 'circle-line', proof: null,
    description: 'AC 平分∠BAD，E、F 在 BC、CD 上且 EF∥BD；过 A、B、P 与 A、D、Q 的圆均切 AC 于 A。观察 B、P、Q、D 共圆。',
    build() {
      const st = createState('角平分线·平行弦·双切圆');
      const A = point(st, 'A', 0, 4.2, { color: accent });
      const B = point(st, 'B', -4, 0, { color: accent });
      const C = point(st, 'C', 0, -4.2, { color: accent });
      const segAB = seg(st, A, B), segBC = seg(st, B, C), segCA = seg(st, C, A);
      const ac = line(st, A, C, 'AC', { color: ink, dash: 0, width: .8 });
      const D = addObject(st, { type: 'point', sub: 'reflectLine', deps: [B.id, ac.id], label: 'D', style: { color: accent, pointSize: 3.0 } });
      const E = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [segBC.id], t: .48, label: 'E', style: { color: mint, pointSize: 2.9 } });
      const bd = addObject(st, { type: 'line', sub: 'through', deps: [B.id, D.id], visible: false });
      const cd = addObject(st, { type: 'line', sub: 'through', deps: [C.id, D.id], label: 'CD', style: { color: ink, width: .85, dash: 0 } });
      const throughE = addObject(st, { type: 'line', sub: 'parallel', deps: [E.id, bd.id], visible: false });
      const F = addObject(st, { type: 'point', sub: 'intersection', deps: [throughE.id, cd.id], branch: 0, label: 'F', style: { color: mint, pointSize: 2.9 } });
      recompute(st);
      const af = addObject(st, { type: 'line', sub: 'through', deps: [A.id, F.id], visible: false });
      const c1 = addObject(st, { type: 'circle', sub: 'tangentAtPoint', deps: [A.id, B.id, ac.id], label: 'ω₁', style: { color: violet, width: 1, dash: 4, fill: 'transparent', opacity: .9 } });
      const ae = addObject(st, { type: 'line', sub: 'through', deps: [A.id, E.id], visible: false });
      const c2 = addObject(st, { type: 'circle', sub: 'tangentAtPoint', deps: [A.id, D.id, ac.id], label: 'ω₂', style: { color: cool, width: 1, dash: 4, fill: 'transparent', opacity: .9 } });
      recompute(st);
      const p0 = addObject(st, { type: 'point', sub: 'intersection', deps: [af.id, c1.id], branch: 0, label: 'P', style: { color: pink, pointSize: 3.0 } });
      const p1 = addObject(st, { type: 'point', sub: 'intersection', deps: [af.id, c1.id], branch: 1, label: 'P′', style: { color: pink, pointSize: 3.0 } });
      const q0 = addObject(st, { type: 'point', sub: 'intersection', deps: [ae.id, c2.id], branch: 0, label: 'Q', style: { color: pink, pointSize: 3.0 } });
      const q1 = addObject(st, { type: 'point', sub: 'intersection', deps: [ae.id, c2.id], branch: 1, label: 'Q′', style: { color: pink, pointSize: 3.0 } });
      recompute(st);
      const far = (a, b) => (a.valid && b.valid && dist(a.g, A.g) >= dist(b.g, A.g) ? a : b);
      const P = far(p0, p1); P.label = 'P'; (P === p0 ? p1 : p0).visible = false;
      const Q = far(q0, q1); Q.label = 'Q'; (Q === q0 ? q1 : q0).visible = false;
      addObject(st, { type: 'segment', sub: 'through', deps: [E.id, F.id], style: { color: mint, width: 1, dash: 4 } });
      addObject(st, { type: 'segment', sub: 'through', deps: [F.id, P.id], style: { color: pink, width: .8, dash: 3, opacity: .7 } });
      addObject(st, { type: 'segment', sub: 'through', deps: [E.id, Q.id], style: { color: pink, width: .8, dash: 3, opacity: .7 } });
      recompute(st);
      st.docName = '角平分线·平行弦·双切圆';
      st.meta.scenarioId = 'bisector-parallel-tangent';
      st.view.scale = 62;
      return { state: st, goal: { kind: 'concyclic', ids: [B.id, P.id, Q.id, D.id], title: '证明 B、P、Q、D 四点共圆', statement: '证明 B、P、Q、D 四点共圆', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'arc-incircle-perp', title: '弧中点·内切圆·垂直', short: 'DF⊥FG', category: '圆与共点',
    difficulty: 5, tags: ['弧中点', '内切圆', '垂直', '等长'], glyph: 'circle-line', proof: null,
    description: '锐角 △ABC，D、E 为外接圆弧 BAC、BC 的中点，F 为内切圆在 AB 上的切点，G=AE∩BC，N=EF∩过 B 垂直 AB 的直线。取满足 BN=EM 的三角形，观察 DF⊥FG。',
    build() {
      const st = createState('弧中点·内切圆·垂直');
      const A = point(st, 'A', -2.37395017737, 4, { color: accent });
      const B = point(st, 'B', -3, 0, { color: accent });
      const C = point(st, 'C', 3, 0, { color: accent });
      seg(st, A, B); seg(st, B, C); seg(st, C, A);
      const omega = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id], label: 'Ω', style: { color: mint, width: 1, dash: 0, fill: 'transparent' } });
      const inc = addObject(st, { type: 'circle', sub: 'incircle', deps: [A.id, B.id, C.id], label: '', style: { color: mint, width: .9, dash: 4, fill: 'transparent', opacity: .65 } });
      const D = addObject(st, { type: 'point', sub: 'midpointArc', deps: [omega.id, B.id, A.id, C.id], label: 'D', style: { color: accent, pointSize: 3.0 } });
      const E = addObject(st, { type: 'point', sub: 'midpointArc', deps: [omega.id, B.id, C.id], label: 'E', style: { color: accent, pointSize: 3.0 } });
      const M = addObject(st, { type: 'point', sub: 'midpoint', deps: [B.id, C.id], label: 'M', style: { color: mint, pointSize: 2.9 } });
      const F = addObject(st, { type: 'point', sub: 'incircleTouch', deps: [A.id, B.id, C.id], label: 'F', style: { color: accent, pointSize: 3.0 } });
      const ae = addObject(st, { type: 'line', sub: 'through', deps: [A.id, E.id], visible: false });
      const bc = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const G = addObject(st, { type: 'point', sub: 'intersection', deps: [ae.id, bc.id], label: 'G', style: { color: mint, pointSize: 2.9 } });
      const ef = addObject(st, { type: 'line', sub: 'through', deps: [E.id, F.id], visible: false });
      const ab = addObject(st, { type: 'line', sub: 'through', deps: [A.id, B.id], visible: false });
      const bp = addObject(st, { type: 'line', sub: 'perp', deps: [B.id, ab.id], visible: false });
      const N = addObject(st, { type: 'point', sub: 'intersection', deps: [ef.id, bp.id], label: 'N', style: { color: pink, pointSize: 2.9 } });
      const df = addObject(st, { type: 'segment', sub: 'through', deps: [D.id, F.id], style: { color: violet, width: 1, dash: 0 } });
      const fg = addObject(st, { type: 'segment', sub: 'through', deps: [F.id, G.id], style: { color: violet, width: 1, dash: 0 } });
      addObject(st, { type: 'segment', sub: 'through', deps: [B.id, N.id], style: { color: pink, width: .8, dash: 4 } });
      addObject(st, { type: 'segment', sub: 'through', deps: [E.id, F.id], style: { color: mint, width: .8, dash: 4, opacity: .75 } });
      recompute(st);
      st.docName = '弧中点·内切圆·垂直';
      st.meta.scenarioId = 'arc-incircle-perp';
      st.view.scale = 78;
      return { state: st, goal: { kind: 'perpendicular', lineIds: [df.id, fg.id], title: '若 BN=EM，证明 DF⊥FG', statement: '若 BN=EM，则 DF⊥FG', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'imo2022-g2', title: 'IMO 2022 G2 · 平行线与等弦', short: 'B,C,X,Y 共圆', category: '圆与共点',
    difficulty: 4, tags: ['IMO', '平行线', '等弦', '共圆'], glyph: 'circle-line', proof: null,
    description: 'P 在 A 到 BC 的垂线上，过 P 作 AC、AB 的平行线交 BC 于 D、E；X 在 (ABD) 上且 DA=DX，Y 在 (ACE) 上且 EA=EY。观察 B、C、X、Y 共圆。',
    build() {
      const st = createState('IMO 2022 G2 · 平行线与等弦');
      const A = point(st, 'A', -0.55, 4.24, { color: accent });
      const B = point(st, 'B', -3, 0, { color: accent });
      const C = point(st, 'C', 3, 0, { color: accent });
      const bc = seg(st, B, C); seg(st, A, B); seg(st, C, A);
      const alt = addObject(st, { type: 'line', sub: 'altitude', deps: [A.id, bc.id], visible: false });
      const P = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [alt.id], t: -2.2, label: 'P', style: { color: mint, pointSize: 2.9 } });
      const ac = addObject(st, { type: 'line', sub: 'through', deps: [A.id, C.id], visible: false });
      const ab = addObject(st, { type: 'line', sub: 'through', deps: [A.id, B.id], visible: false });
      const throughPac = addObject(st, { type: 'line', sub: 'parallel', deps: [P.id, ac.id], visible: false });
      const throughPab = addObject(st, { type: 'line', sub: 'parallel', deps: [P.id, ab.id], visible: false });
      const bcl = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const D = addObject(st, { type: 'point', sub: 'intersection', deps: [throughPac.id, bcl.id], label: 'D', style: { color: mint, pointSize: 2.9 } });
      const E = addObject(st, { type: 'point', sub: 'intersection', deps: [throughPab.id, bcl.id], label: 'E', style: { color: mint, pointSize: 2.9 } });
      addObject(st, { type: 'segment', sub: 'through', deps: [P.id, D.id], style: { color: mint, width: .8, dash: 4, opacity: .7 } });
      addObject(st, { type: 'segment', sub: 'through', deps: [P.id, E.id], style: { color: mint, width: .8, dash: 4, opacity: .7 } });
      const cabd = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, D.id], style: { color: violet, width: .9, dash: 4, fill: 'transparent', opacity: .8 } });
      const cace = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, C.id, E.id], style: { color: cool, width: .9, dash: 4, fill: 'transparent', opacity: .8 } });
      const cd = addObject(st, { type: 'circle', sub: 'centerThrough', deps: [D.id, A.id], style: { color: violet, width: .9, dash: 2, fill: 'transparent', opacity: .55 } });
      const ce = addObject(st, { type: 'circle', sub: 'centerThrough', deps: [E.id, A.id], style: { color: cool, width: .9, dash: 2, fill: 'transparent', opacity: .55 } });
      recompute(st);
      const x0 = addObject(st, { type: 'point', sub: 'intersection', deps: [cabd.id, cd.id], branch: 0, label: 'X', style: { color: violet, pointSize: 2.9 } });
      const x1 = addObject(st, { type: 'point', sub: 'intersection', deps: [cabd.id, cd.id], branch: 1, label: 'X2', style: { color: violet, pointSize: 2.9 } });
      const y0 = addObject(st, { type: 'point', sub: 'intersection', deps: [cace.id, ce.id], branch: 0, label: 'Y', style: { color: cool, pointSize: 2.9 } });
      const y1 = addObject(st, { type: 'point', sub: 'intersection', deps: [cace.id, ce.id], branch: 1, label: 'Y2', style: { color: cool, pointSize: 2.9 } });
      recompute(st);
      x0.label = 'X2'; y1.label = 'Y2';
      const X = dist(x0.g, A.g) >= dist(x1.g, A.g) ? x0 : x1; X.label = 'X'; (X === x0 ? x1 : x0).visible = false;
      const Y = dist(y0.g, A.g) >= dist(y1.g, A.g) ? y0 : y1; Y.label = 'Y'; (Y === y0 ? y1 : y0).visible = false;
      recompute(st);
      st.docName = 'IMO 2022 G2 · 平行线与等弦';
      st.meta.scenarioId = 'imo2022-g2';
      st.view.scale = 72;
      return { state: st, goal: { kind: 'concyclic', ids: [B.id, C.id, X.id, Y.id], title: '证明 B、C、X、Y 四点共圆', statement: '证明 B、C、X、Y 四点共圆', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'imo2025-g3', title: 'IMO 2025 G3 · 等弦与四次交点', short: 'CX⊥AB', category: '圆与共点',
    difficulty: 4, tags: ['IMO', '等弦', '圆交点', '垂直'], glyph: 'circle-line', proof: null,
    description: 'D 是过 B 作 AC 垂线与外接圆的交点，Q 是外接圆上 AB=AQ 的点；R=BQ∩AC，S=DR∩Γ，T=BC∩(QRS)，X=TQ∩RS。观察 CX⊥AB。',
    build() {
      const st = createState('IMO 2025 G3 · 等弦与四次交点');
      const A = point(st, 'A', -0.4, 4.0, { color: accent });
      const B = point(st, 'B', -3.2, 0, { color: accent });
      const C = point(st, 'C', 3.4, 0, { color: accent });
      seg(st, A, B); seg(st, B, C); seg(st, C, A);
      const omega = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id], label: 'Γ', style: { color: mint, width: 1, fill: 'transparent' } });
      const ac = addObject(st, { type: 'line', sub: 'through', deps: [A.id, C.id], visible: false });
      const perpB = addObject(st, { type: 'line', sub: 'perp', deps: [B.id, ac.id], visible: false });
      recompute(st);
      const d0 = addObject(st, { type: 'point', sub: 'intersection', deps: [perpB.id, omega.id], branch: 0, label: 'D0', style: { color: cool, pointSize: 2.9 } });
      const d1 = addObject(st, { type: 'point', sub: 'intersection', deps: [perpB.id, omega.id], branch: 1, label: 'D', style: { color: cool, pointSize: 2.9 } });
      recompute(st);
      // Q is on omega with AQ=AB: use circle centered A through B, intersect omega
      const cA = addObject(st, { type: 'circle', sub: 'centerThrough', deps: [A.id, B.id], style: { color: cool, width: .8, dash: 3, fill: 'transparent', opacity: .6 } });
      const q1 = addObject(st, { type: 'point', sub: 'intersection', deps: [omega.id, cA.id], branch: 0, label: 'Q1', style: { color: cool, pointSize: 2.9 } });
      const q2 = addObject(st, { type: 'point', sub: 'intersection', deps: [omega.id, cA.id], branch: 1, label: 'Q', style: { color: cool, pointSize: 2.9 } });
      recompute(st);
      const D = dist(d0.g, B.g) >= dist(d1.g, B.g) ? d0 : d1; D.label = 'D'; (D === d0 ? d1 : d0).visible = false;
      const Q = dist(q1.g, B.g) >= dist(q2.g, B.g) ? q1 : q2; Q.label = 'Q'; (Q === q1 ? q2 : q1).visible = false;
      addObject(st, { type: 'segment', sub: 'through', deps: [A.id, D.id], style: { color: mint, width: .8, dash: 4, opacity: .7 } });
      addObject(st, { type: 'segment', sub: 'through', deps: [B.id, Q.id], style: { color: mint, width: .8, dash: 4, opacity: .7 } });
      const bq = addObject(st, { type: 'line', sub: 'through', deps: [B.id, Q.id], visible: false });
      const R = addObject(st, { type: 'point', sub: 'intersection', deps: [bq.id, ac.id], label: 'R', style: { color: pink, pointSize: 2.9 } });
      const dr = addObject(st, { type: 'line', sub: 'through', deps: [D.id, R.id], visible: false });
      const s0 = addObject(st, { type: 'point', sub: 'intersection', deps: [dr.id, omega.id], branch: 0, label: 'S0', style: { color: pink, pointSize: 2.9 } });
      const s1 = addObject(st, { type: 'point', sub: 'intersection', deps: [dr.id, omega.id], branch: 1, label: 'S', style: { color: pink, pointSize: 2.9 } });
      recompute(st);
      const S = dist(s0.g, D.g) >= dist(s1.g, D.g) ? s0 : s1; S.label = 'S'; (S === s0 ? s1 : s0).visible = false;
      const qrs = addObject(st, { type: 'circle', sub: 'threePoints', deps: [Q.id, R.id, S.id], style: { color: violet, width: .9, dash: 4, fill: 'transparent', opacity: .8 } });
      const bc = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const t0 = addObject(st, { type: 'point', sub: 'intersection', deps: [bc.id, qrs.id], branch: 0, label: 'T0', style: { color: pink, pointSize: 2.9 } });
      const t1 = addObject(st, { type: 'point', sub: 'intersection', deps: [bc.id, qrs.id], branch: 1, label: 'T', style: { color: pink, pointSize: 2.9 } });
      recompute(st);
      const inBC = (p) => p.g && p.g.x >= Math.min(B.g.x, C.g.x) - 1e-7 && p.g.x <= Math.max(B.g.x, C.g.x) + 1e-7;
      const T = (inBC(t0) && !inBC(t1)) ? t0 : (inBC(t1) && !inBC(t0)) ? t1 : (dist(t0.g, { x: (B.g.x + C.g.x) / 2, y: 0 }) <= dist(t1.g, { x: (B.g.x + C.g.x) / 2, y: 0 }) ? t0 : t1);
      T.label = 'T'; (T === t0 ? t1 : t0).visible = false;
      const tq = addObject(st, { type: 'line', sub: 'through', deps: [T.id, Q.id], visible: false });
      const rs = addObject(st, { type: 'line', sub: 'through', deps: [R.id, S.id], visible: false });
      const X = addObject(st, { type: 'point', sub: 'intersection', deps: [tq.id, rs.id], label: 'X', style: { color: accent, pointSize: 3.0 } });
      const cx = seg(st, C, X);
      const ab = seg(st, A, B);
      recompute(st);
      st.docName = 'IMO 2025 G3 · 等弦与四次交点';
      st.meta.scenarioId = 'imo2025-g3';
      st.view.scale = 70;
      return { state: st, goal: { kind: 'perpendicular', lineIds: [cx.id, ab.id], title: '证明 CX⊥AB', statement: '证明 CX⊥AB', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'imo2022-g5', title: 'IMO 2022 G5 · 平行线截边与垂线三角形', short: '两圆相切', category: '圆与共点',
    difficulty: 5, tags: ['IMO', '平行线', '垂线', '相切'], glyph: 'circle-line', proof: null,
    description: '两条平行线分别截三边于 X,Y,Z；过 X、Y、Z 作对应边的垂线，围成两个三角形。观察两三角形外接圆相切。',
    build() {
      const st = createState('IMO 2022 G5 · 平行线截边与垂线三角形');
      const A = point(st, 'A', 0, 4.2, { color: accent });
      const B = point(st, 'B', -4, 0, { color: accent });
      const C = point(st, 'C', 4.5, 0, { color: accent });
      const bc = seg(st, B, C); const ca = seg(st, C, A); const ab = seg(st, A, B);
      const bcL = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const caL = addObject(st, { type: 'line', sub: 'through', deps: [C.id, A.id], visible: false });
      const abL = addObject(st, { type: 'line', sub: 'through', deps: [A.id, B.id], visible: false });
      const L1 = addObject(st, { type: 'point', sub: 'free', x: -1.8, y: 1.2, label: 'L₁', style: { color: cool, pointSize: 2.4 } });
      const L1b = addObject(st, { type: 'point', sub: 'free', x: 2.2, y: 3.2, label: 'L₁b', visible: false });
      const l1 = addObject(st, { type: 'line', sub: 'through', deps: [L1.id, L1b.id], label: 'ℓ₁', style: { color: cool, width: .9, dash: 4 } });
      const L2 = addObject(st, { type: 'point', sub: 'free', x: -2.6, y: 2.4, label: 'L₂', style: { color: violet, pointSize: 2.4 } });
      const l2 = addObject(st, { type: 'line', sub: 'parallel', deps: [L2.id, l1.id], label: 'ℓ₂', style: { color: violet, width: .9, dash: 4 } });
      recompute(st);
      const X1 = addObject(st, { type: 'point', sub: 'intersection', deps: [l1.id, bcL.id], label: 'X₁', style: { color: cool, pointSize: 2.6 } });
      const Y1 = addObject(st, { type: 'point', sub: 'intersection', deps: [l1.id, caL.id], label: 'Y₁', style: { color: cool, pointSize: 2.6 } });
      const Z1 = addObject(st, { type: 'point', sub: 'intersection', deps: [l1.id, abL.id], label: 'Z₁', style: { color: cool, pointSize: 2.6 } });
      const X2 = addObject(st, { type: 'point', sub: 'intersection', deps: [l2.id, bcL.id], label: 'X₂', style: { color: violet, pointSize: 2.6 } });
      const Y2 = addObject(st, { type: 'point', sub: 'intersection', deps: [l2.id, caL.id], label: 'Y₂', style: { color: violet, pointSize: 2.6 } });
      const Z2 = addObject(st, { type: 'point', sub: 'intersection', deps: [l2.id, abL.id], label: 'Z₂', style: { color: violet, pointSize: 2.6 } });
      recompute(st);
      const px1 = addObject(st, { type: 'line', sub: 'perp', deps: [X1.id, bcL.id], visible: false });
      const py1 = addObject(st, { type: 'line', sub: 'perp', deps: [Y1.id, caL.id], visible: false });
      const pz1 = addObject(st, { type: 'line', sub: 'perp', deps: [Z1.id, abL.id], visible: false });
      const px2 = addObject(st, { type: 'line', sub: 'perp', deps: [X2.id, bcL.id], visible: false });
      const py2 = addObject(st, { type: 'line', sub: 'perp', deps: [Y2.id, caL.id], visible: false });
      const pz2 = addObject(st, { type: 'line', sub: 'perp', deps: [Z2.id, abL.id], visible: false });
      recompute(st);
      const U1 = addObject(st, { type: 'point', sub: 'intersection', deps: [px1.id, py1.id], label: 'U₁', style: { color: cool, pointSize: 2.7 } });
      const V1 = addObject(st, { type: 'point', sub: 'intersection', deps: [py1.id, pz1.id], label: 'V₁', style: { color: cool, pointSize: 2.7 } });
      const W1 = addObject(st, { type: 'point', sub: 'intersection', deps: [pz1.id, px1.id], label: 'W₁', style: { color: cool, pointSize: 2.7 } });
      const U2 = addObject(st, { type: 'point', sub: 'intersection', deps: [px2.id, py2.id], label: 'U₂', style: { color: violet, pointSize: 2.7 } });
      const V2 = addObject(st, { type: 'point', sub: 'intersection', deps: [py2.id, pz2.id], label: 'V₂', style: { color: violet, pointSize: 2.7 } });
      const W2 = addObject(st, { type: 'point', sub: 'intersection', deps: [pz2.id, px2.id], label: 'W₂', style: { color: violet, pointSize: 2.7 } });
      recompute(st);
      const omega1 = addObject(st, { type: 'circle', sub: 'threePoints', deps: [U1.id, V1.id, W1.id], label: 'ω₁', style: { color: cool, width: .9, dash: 2, fill: 'transparent', opacity: .8 } });
      const omega2 = addObject(st, { type: 'circle', sub: 'threePoints', deps: [U2.id, V2.id, W2.id], label: 'ω₂', style: { color: violet, width: .9, dash: 2, fill: 'transparent', opacity: .8 } });
      recompute(st);
      st.docName = 'IMO 2022 G5 · 平行线截边与垂线三角形';
      st.meta.scenarioId = 'imo2022-g5';
      st.view.scale = 60;
      return { state: st, goal: { kind: 'tangent', circleIds: [omega1.id, omega2.id], title: '证明两外接圆相切', statement: '证明两个三角形的外接圆相切', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'imo2022-g3', title: 'IMO 2022 G3 · 切圆与中点', short: '切点交于 CD', category: '圆与共点',
    difficulty: 5, tags: ['IMO', '切圆', '中点', '共线'], glyph: 'circle-line', proof: null,
    description: 'ABCD 共圆；Q、P 在 AB 上，使 AC 切 (ADQ) 于 A、BD 切 (BCP) 于 B；M、N 为 BC、AD 中点。观察 (ANQ) 在 A 的切线与 (BMP) 在 B 的切线交于 CD。',
    build() {
      const st = createState('IMO 2022 G3 · 切圆与中点');
      const A = point(st, 'A', 0, 4, { color: accent });
      const B = point(st, 'B', -3.46, -2, { color: accent });
      const C = point(st, 'C', 3.46, -2, { color: accent });
      const D = point(st, 'D', 0, -4, { color: accent });
      const ab = seg(st, A, B), bc = seg(st, B, C), cd = seg(st, C, D), da = seg(st, D, A);
      const omega = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id, D.id].slice(0, 3), label: 'Ω', style: { color: mint, width: 1, fill: 'transparent' } });
      const ac = addObject(st, { type: 'line', sub: 'through', deps: [A.id, C.id], visible: false });
      const bd = addObject(st, { type: 'line', sub: 'through', deps: [B.id, D.id], visible: false });
      const abl = addObject(st, { type: 'line', sub: 'through', deps: [A.id, B.id], visible: false });
      const cq = addObject(st, { type: 'circle', sub: 'tangentAtPoint', deps: [A.id, D.id, ac.id], style: { color: violet, width: .9, dash: 4, fill: 'transparent', opacity: .7 } });
      const cp = addObject(st, { type: 'circle', sub: 'tangentAtPoint', deps: [B.id, C.id, bd.id], style: { color: cool, width: .9, dash: 4, fill: 'transparent', opacity: .7 } });
      recompute(st);
      const q0 = addObject(st, { type: 'point', sub: 'intersection', deps: [cq.id, abl.id], branch: 0, label: 'Q0', style: { color: violet, pointSize: 2.9 } });
      const q1 = addObject(st, { type: 'point', sub: 'intersection', deps: [cq.id, abl.id], branch: 1, label: 'Q', style: { color: violet, pointSize: 2.9 } });
      const p0 = addObject(st, { type: 'point', sub: 'intersection', deps: [cp.id, abl.id], branch: 0, label: 'P0', style: { color: cool, pointSize: 2.9 } });
      const p1 = addObject(st, { type: 'point', sub: 'intersection', deps: [cp.id, abl.id], branch: 1, label: 'P', style: { color: cool, pointSize: 2.9 } });
      recompute(st);
      const Q = dist(q0.g, A.g) >= dist(q1.g, A.g) ? q0 : q1; Q.label = 'Q'; (Q === q0 ? q1 : q0).visible = false;
      const P = dist(p0.g, B.g) >= dist(p1.g, B.g) ? p0 : p1; P.label = 'P'; (P === p0 ? p1 : p0).visible = false;
      const M = addObject(st, { type: 'point', sub: 'midpoint', deps: [B.id, C.id], label: 'M', style: { color: mint, pointSize: 2.8 } });
      const N = addObject(st, { type: 'point', sub: 'midpoint', deps: [A.id, D.id], label: 'N', style: { color: mint, pointSize: 2.8 } });
      const anq = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, N.id, Q.id], style: { color: violet, width: .9, dash: 2, fill: 'transparent', opacity: .7 } });
      const bmp = addObject(st, { type: 'circle', sub: 'threePoints', deps: [B.id, M.id, P.id], style: { color: cool, width: .9, dash: 2, fill: 'transparent', opacity: .7 } });
      const ta = addObject(st, { type: 'line', sub: 'tangentAt', deps: [A.id, anq.id], visible: false });
      const tb = addObject(st, { type: 'line', sub: 'tangentAt', deps: [B.id, bmp.id], visible: false });
      const T = addObject(st, { type: 'point', sub: 'intersection', deps: [ta.id, tb.id], label: 'T', style: { color: pink, pointSize: 2.9 } });
      const cdl = addObject(st, { type: 'line', sub: 'through', deps: [C.id, D.id], visible: false });
      recompute(st);
      st.docName = 'IMO 2022 G3 · 切圆与中点';
      st.meta.scenarioId = 'imo2022-g3';
      st.view.scale = 70;
      return { state: st, goal: { kind: 'collinear', ids: [T.id, C.id, D.id], title: '证明两条切线的交点在 CD 上', statement: '证明 (ANQ) 在 A 的切线与 (BMP) 在 B 的切线交于 CD', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'imo2025-g6', title: 'IMO 2025 G6 · 切线反射与共线', short: 'A,Z,Q 共线', category: '圆与共点',
    difficulty: 5, tags: ['IMO', '切线', '反射', '共线'], glyph: 'circle-line', proof: null,
    description: '外接圆在 B、C 的切线交于 P；BP、CP 分别交 AC、AB 于 E、F；D 为 A 关于 EF 的对称点；(DEB)、(DFC) 交于 Q；DP 交 BC 于 Z。观察 A、Z、Q 共线。',
    build() {
      const st = createState('IMO 2025 G6 · 切线反射与共线');
      const A = point(st, 'A', -0.4, 4.1, { color: accent });
      const B = point(st, 'B', -3.6, 0, { color: accent });
      const C = point(st, 'C', 3.8, 0, { color: accent });
      seg(st, A, B); seg(st, B, C); seg(st, C, A);
      const omega = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id], label: 'Ω', style: { color: mint, width: 1, fill: 'transparent' } });
      const tb = addObject(st, { type: 'line', sub: 'tangentAt', deps: [B.id, omega.id], visible: false });
      const tc = addObject(st, { type: 'line', sub: 'tangentAt', deps: [C.id, omega.id], visible: false });
      const P = addObject(st, { type: 'point', sub: 'intersection', deps: [tb.id, tc.id], label: 'P', style: { color: pink, pointSize: 2.9 } });
      const bp = addObject(st, { type: 'line', sub: 'through', deps: [B.id, P.id], visible: false });
      const cp = addObject(st, { type: 'line', sub: 'through', deps: [C.id, P.id], visible: false });
      const ac = addObject(st, { type: 'line', sub: 'through', deps: [A.id, C.id], visible: false });
      const ab = addObject(st, { type: 'line', sub: 'through', deps: [A.id, B.id], visible: false });
      const E = addObject(st, { type: 'point', sub: 'intersection', deps: [bp.id, ac.id], label: 'E', style: { color: mint, pointSize: 2.8 } });
      const F = addObject(st, { type: 'point', sub: 'intersection', deps: [cp.id, ab.id], label: 'F', style: { color: mint, pointSize: 2.8 } });
      const ef = addObject(st, { type: 'line', sub: 'through', deps: [E.id, F.id], visible: false });
      const D = addObject(st, { type: 'point', sub: 'reflectLine', deps: [A.id, ef.id], label: 'D', style: { color: cool, pointSize: 2.9 } });
      const deb = addObject(st, { type: 'circle', sub: 'threePoints', deps: [D.id, E.id, B.id], style: { color: violet, width: .9, dash: 2, fill: 'transparent', opacity: .75 } });
      const dfc = addObject(st, { type: 'circle', sub: 'threePoints', deps: [D.id, F.id, C.id], style: { color: pink, width: .9, dash: 2, fill: 'transparent', opacity: .75 } });
      recompute(st);
      const q0 = addObject(st, { type: 'point', sub: 'intersection', deps: [deb.id, dfc.id], branch: 0, label: 'Q0', style: { color: violet, pointSize: 2.8 } });
      const q1 = addObject(st, { type: 'point', sub: 'intersection', deps: [deb.id, dfc.id], branch: 1, label: 'Q', style: { color: violet, pointSize: 2.8 } });
      recompute(st);
      const Q = dist(q0.g, D.g) >= dist(q1.g, D.g) ? q0 : q1; Q.label = 'Q'; (Q === q0 ? q1 : q0).visible = false;
      const dp = addObject(st, { type: 'line', sub: 'through', deps: [D.id, P.id], visible: false });
      const bcl = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const Z = addObject(st, { type: 'point', sub: 'intersection', deps: [dp.id, bcl.id], label: 'Z', style: { color: pink, pointSize: 2.9 } });
      recompute(st);
      st.docName = 'IMO 2025 G6 · 切线反射与共线';
      st.meta.scenarioId = 'imo2025-g6';
      st.view.scale = 65;
      return { state: st, goal: { kind: 'collinear', ids: [A.id, Z.id, Q.id], title: '证明 A、Z、Q 共线', statement: '证明 A、Z、Q 三点共线', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'orig-1032', title: '原创 1032 · 垂心圆与等距点', short: 'O₁O₂MN 共圆', category: '圆与共点',
    difficulty: 4, tags: ['原创', '垂心', '外心', '共圆'], glyph: 'circle-line', proof: null,
    description: 'H 为垂心，E 在 CH 上；过 E 作 BH 垂线，垂足 G；(ABG)、(BHC) 的外心 O₁、O₂，另一交点为 N；M 在 CH 上且 MG=ME。观察 O₁,O₂,M,N 共圆。',
    build() {
      const st = createState('原创 1032 · 垂心圆与等距点');
      const A = point(st, 'A', -0.5, 4.2, { color: accent });
      const B = point(st, 'B', -3.3, 0, { color: accent });
      const C = point(st, 'C', 3.8, 0, { color: accent });
      seg(st, A, B); seg(st, B, C); seg(st, C, A);
      const tri = addObject(st, { type: 'triangle', sub: 'generic', deps: [A.id, B.id, C.id], centers: {}, show: {} });
      const H = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'H', label: 'H', style: { color: pink, pointSize: 2.9 } });
      const ch = addObject(st, { type: 'line', sub: 'through', deps: [C.id, H.id], visible: false });
      const bh = addObject(st, { type: 'line', sub: 'through', deps: [B.id, H.id], visible: false });
      const E = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [ch.id], t: 2.4, label: 'E', style: { color: mint, pointSize: 2.8 } });
      const G = addObject(st, { type: 'point', sub: 'foot', deps: [E.id, bh.id], label: 'G', style: { color: mint, pointSize: 2.8 } });
      const gamma1 = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, G.id], style: { color: cool, width: .9, dash: 3, fill: 'transparent', opacity: .65 } });
      const gamma2 = addObject(st, { type: 'circle', sub: 'threePoints', deps: [B.id, H.id, C.id], style: { color: violet, width: .9, dash: 3, fill: 'transparent', opacity: .65 } });
      const O1 = addObject(st, { type: 'point', sub: 'circumcenter', deps: [A.id, B.id, G.id], label: 'O₁', style: { color: cool, pointSize: 2.7 } });
      const O2 = addObject(st, { type: 'point', sub: 'circumcenter', deps: [B.id, H.id, C.id], label: 'O₂', style: { color: violet, pointSize: 2.7 } });
      recompute(st);
      const n0 = addObject(st, { type: 'point', sub: 'intersection', deps: [gamma1.id, gamma2.id], branch: 0, label: 'N0', style: { color: pink, pointSize: 2.7 } });
      const n1 = addObject(st, { type: 'point', sub: 'intersection', deps: [gamma1.id, gamma2.id], branch: 1, label: 'N', style: { color: pink, pointSize: 2.7 } });
      recompute(st);
      const N = dist(n0.g, B.g) >= dist(n1.g, B.g) ? n0 : n1; N.label = 'N'; (N === n0 ? n1 : n0).visible = false;
      const perpGE = addObject(st, { type: 'line', sub: 'perpbis', deps: [G.id, E.id], visible: false });
      const M = addObject(st, { type: 'point', sub: 'intersection', deps: [perpGE.id, ch.id], label: 'M', style: { color: mint, pointSize: 2.8 } });
      recompute(st);
      st.docName = '原创 1032 · 垂心圆与等距点';
      st.meta.scenarioId = 'orig-1032';
      st.view.scale = 62;
      return { state: st, goal: { kind: 'concyclic', ids: [O1.id, O2.id, M.id, N.id], title: '证明 O₁,O₂,M,N 共圆', statement: '证明 O₁、O₂、M、N 四点共圆', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'orig-1035', title: '原创 1035 · 倍长与垂足', short: 'PL⊥BC', category: '圆与共点',
    difficulty: 5, tags: ['原创', '弧中点', '倍长', '垂足', '垂直'], glyph: 'circle-line', proof: null,
    description: 'D 为弧 BC 中点，AD∩BC=E；倍长 BD、CD 到 G、F；BH⊥AG、CI⊥AF，交于 J；P 为 (IEH) 的外心，JD 交圆 P 于 L。观察 PL⊥BC。',
    build() {
      const st = createState('原创 1035 · 倍长与垂足');
      const A = point(st, 'A', -0.6, 4.0, { color: accent });
      const B = point(st, 'B', -3.2, 0, { color: accent });
      const C = point(st, 'C', 3.4, 0, { color: accent });
      const bc = seg(st, B, C); seg(st, A, B); seg(st, C, A);
      const omega = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id], label: 'Ω', style: { color: mint, width: 1, fill: 'transparent' } });
      const D = addObject(st, { type: 'point', sub: 'midpointArc', deps: [omega.id, B.id, C.id], label: 'D', style: { color: accent, pointSize: 3.0 } });
      const ad = addObject(st, { type: 'line', sub: 'through', deps: [A.id, D.id], visible: false });
      const bcl = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const E = addObject(st, { type: 'point', sub: 'intersection', deps: [ad.id, bcl.id], label: 'E', style: { color: mint, pointSize: 2.8 } });
      const G = addObject(st, { type: 'point', sub: 'reflectPoint', deps: [B.id, D.id], label: 'G', style: { color: cool, pointSize: 2.9 } });
      const F = addObject(st, { type: 'point', sub: 'reflectPoint', deps: [C.id, D.id], label: 'F', style: { color: cool, pointSize: 2.9 } });
      recompute(st);
      const ag = addObject(st, { type: 'line', sub: 'through', deps: [A.id, G.id], visible: false });
      const af = addObject(st, { type: 'line', sub: 'through', deps: [A.id, F.id], visible: false });
      const H = addObject(st, { type: 'point', sub: 'foot', deps: [B.id, ag.id], label: 'H', style: { color: cool, pointSize: 2.8 } });
      const I = addObject(st, { type: 'point', sub: 'foot', deps: [C.id, af.id], label: 'I', style: { color: cool, pointSize: 2.8 } });
      const bh = addObject(st, { type: 'line', sub: 'through', deps: [B.id, H.id], visible: false });
      const ci = addObject(st, { type: 'line', sub: 'through', deps: [C.id, I.id], visible: false });
      const J = addObject(st, { type: 'point', sub: 'intersection', deps: [bh.id, ci.id], label: 'J', style: { color: pink, pointSize: 2.9 } });
      const P = addObject(st, { type: 'point', sub: 'circumcenter', deps: [I.id, E.id, H.id], label: 'P', style: { color: violet, pointSize: 2.9 } });
      const circ = addObject(st, { type: 'circle', sub: 'centerThrough', deps: [P.id, E.id], style: { color: violet, width: .9, dash: 2, fill: 'transparent', opacity: .7 } });
      const jd = addObject(st, { type: 'line', sub: 'through', deps: [J.id, D.id], visible: false });
      recompute(st);
      const l0 = addObject(st, { type: 'point', sub: 'intersection', deps: [jd.id, circ.id], branch: 0, label: 'L0', style: { color: violet, pointSize: 2.8 } });
      const l1 = addObject(st, { type: 'point', sub: 'intersection', deps: [jd.id, circ.id], branch: 1, label: 'L', style: { color: violet, pointSize: 2.8 } });
      recompute(st);
      const perpRes = (p) => Math.abs(dot(sub(P.g, p.g), sub(C.g, B.g)));
      const L = perpRes(l0) <= perpRes(l1) ? l0 : l1; L.label = 'L'; (L === l0 ? l1 : l0).visible = false;
      const pl = seg(st, P, L);
      addObject(st, { type: 'segment', sub: 'through', deps: [A.id, D.id], style: { color: mint, width: .8, dash: 4, opacity: .7 } });
      recompute(st);
      st.docName = '原创 1035 · 倍长与垂足';
      st.meta.scenarioId = 'orig-1035';
      st.view.scale = 65;
      return { state: st, goal: { kind: 'perpendicular', lineIds: [pl.id, (st.objects.find(o=>o.type==='segment'&&o.deps.includes(B.id)&&o.deps.includes(C.id))||{}).id], title: '证明 PL⊥BC', statement: '证明 PL⊥BC', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'orig-1039', title: '原创 1039 · 弧中点与切线', short: 'OA,XY,PH', category: '圆与共点',
    difficulty: 5, tags: ['原创', '弧中点', '切线', '共点'], glyph: 'circle-line', proof: null,
    description: 'U、V 分别为弧 BAC、弧 BC 的中点；UH、VH 延长交圆于 X、Y；B、C 处切线交于 P。观察 OA、XY、PH 共点或平行。',
    build() {
      const st = createState('原创 1039 · 弧中点与切线');
      const A = point(st, 'A', -0.4, 4.1, { color: accent });
      const B = point(st, 'B', -3.4, 0, { color: accent });
      const C = point(st, 'C', 3.7, 0, { color: accent });
      seg(st, A, B); seg(st, B, C); seg(st, C, A);
      const tri = addObject(st, { type: 'triangle', sub: 'generic', deps: [A.id, B.id, C.id], centers: {}, show: {} });
      const O = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'O', label: 'O', style: { color: cool, pointSize: 2.8 } });
      const H = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'H', label: 'H', style: { color: pink, pointSize: 2.8 } });
      const omega = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id], label: 'Ω', style: { color: mint, width: 1, fill: 'transparent' } });
      const U = addObject(st, { type: 'point', sub: 'midpointArc', deps: [omega.id, B.id, A.id, C.id], label: 'U', style: { color: accent, pointSize: 2.9 } });
      const V = addObject(st, { type: 'point', sub: 'midpointArc', deps: [omega.id, B.id, C.id], label: 'V', style: { color: accent, pointSize: 2.9 } });
      const uh = addObject(st, { type: 'line', sub: 'through', deps: [U.id, H.id], visible: false });
      const vh = addObject(st, { type: 'line', sub: 'through', deps: [V.id, H.id], visible: false });
      recompute(st);
      const x0 = addObject(st, { type: 'point', sub: 'intersection', deps: [uh.id, omega.id], branch: 0, label: 'X0', style: { color: cool, pointSize: 2.8 } });
      const x1 = addObject(st, { type: 'point', sub: 'intersection', deps: [uh.id, omega.id], branch: 1, label: 'X', style: { color: cool, pointSize: 2.8 } });
      const y0 = addObject(st, { type: 'point', sub: 'intersection', deps: [vh.id, omega.id], branch: 0, label: 'Y0', style: { color: cool, pointSize: 2.8 } });
      const y1 = addObject(st, { type: 'point', sub: 'intersection', deps: [vh.id, omega.id], branch: 1, label: 'Y', style: { color: cool, pointSize: 2.8 } });
      recompute(st);
      const X = dist(x0.g, U.g) >= dist(x1.g, U.g) ? x0 : x1; X.label = 'X'; (X === x0 ? x1 : x0).visible = false;
      const Y = dist(y0.g, V.g) >= dist(y1.g, V.g) ? y0 : y1; Y.label = 'Y'; (Y === y0 ? y1 : y0).visible = false;
      const tb = addObject(st, { type: 'line', sub: 'tangentAt', deps: [B.id, omega.id], visible: false });
      const tc = addObject(st, { type: 'line', sub: 'tangentAt', deps: [C.id, omega.id], visible: false });
      const P = addObject(st, { type: 'point', sub: 'intersection', deps: [tb.id, tc.id], label: 'P', style: { color: pink, pointSize: 2.9 } });
      const oa = addObject(st, { type: 'line', sub: 'through', deps: [O.id, A.id], visible: false });
      const xy = addObject(st, { type: 'line', sub: 'through', deps: [X.id, Y.id], visible: false });
      const ph = addObject(st, { type: 'line', sub: 'through', deps: [P.id, H.id], visible: false });
      recompute(st);
      st.docName = '原创 1039 · 弧中点与切线';
      st.meta.scenarioId = 'orig-1039';
      st.view.scale = 68;
      // Determine whether the three lines concur or are parallel.
      const L = [oa, xy, ph];
      const dirs = L.map((l) => l.g?.d).filter(Boolean);
      const px = L[0].g?.a, qx = L[1].g?.a;
      const den = cross(L[0].g?.d || {x:0,y:0}, L[1].g?.d || {x:0,y:0});
      const goal = Math.abs(den) < 1e-8
        ? { kind: 'parallel', lineIds: [oa.id, xy.id], title: 'OA∥XY', statement: 'OA 与 XY 平行', source: 'scenario' }
        : { kind: 'concurrent', lineIds: [oa.id, xy.id, ph.id], title: 'OA,XY,PH 共点', statement: 'OA、XY、PH 三线共点', source: 'scenario' };
      return { state: st, goal, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'imo2025-g2', title: 'IMO 2025 G2 · 旁心圆截线段', short: 'BY⊥CX', category: '圆与共点',
    difficulty: 4, tags: ['IMO', '旁心', '垂足', '垂直'], glyph: 'circle-line', proof: null,
    description: 'I_B、I_C 为 B、C 旁心；E、F 满足 EI_B⊥I_BB、FI_C⊥I_CC；以旁心为圆心、旁心到 E/F 为半径的圆截 I_BB、I_CC 于 X、Y。证明 BY⊥CX。',
    build() {
      const st = createState('IMO 2025 G2 · 旁心圆截线段');
      const A = point(st, 'A', 0, 4, { color: accent });
      const B = point(st, 'B', -3, 0, { color: accent });
      const C = point(st, 'C', 4, 0, { color: accent });
      seg(st, A, B); seg(st, B, C); seg(st, C, A);
      const tri = addObject(st, { type: 'triangle', sub: 'generic', deps: [A.id, B.id, C.id], centers: {}, show: {} });
      const IB = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'IB', label: 'I_B', style: { color: pink, pointSize: 2.8 } });
      const IC = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'IC', label: 'I_C', style: { color: pink, pointSize: 2.8 } });
      const ab = addObject(st, { type: 'line', sub: 'through', deps: [A.id, B.id], visible: false });
      const ac = addObject(st, { type: 'line', sub: 'through', deps: [A.id, C.id], visible: false });
      const ibb = addObject(st, { type: 'line', sub: 'through', deps: [IB.id, B.id], visible: false });
      const icc = addObject(st, { type: 'line', sub: 'through', deps: [IC.id, C.id], visible: false });
      const pib = addObject(st, { type: 'line', sub: 'perp', deps: [IB.id, ibb.id], visible: false });
      const pic = addObject(st, { type: 'line', sub: 'perp', deps: [IC.id, icc.id], visible: false });
      const E = addObject(st, { type: 'point', sub: 'intersection', deps: [pib.id, ab.id], label: 'E', style: { color: pink, pointSize: 2.8 } });
      const F = addObject(st, { type: 'point', sub: 'intersection', deps: [pic.id, ac.id], label: 'F', style: { color: pink, pointSize: 2.8 } });
      const cB = addObject(st, { type: 'circle', sub: 'centerThrough', deps: [IB.id, E.id], style: { color: violet, width: .9, dash: 4, fill: 'transparent', opacity: .65 } });
      const cC = addObject(st, { type: 'circle', sub: 'centerThrough', deps: [IC.id, F.id], style: { color: cool, width: .9, dash: 4, fill: 'transparent', opacity: .65 } });
      recompute(st);
      const x0 = addObject(st, { type: 'point', sub: 'intersection', deps: [cB.id, ibb.id], branch: 0, label: 'X0', style: { color: violet, pointSize: 2.8 } });
      const X = addObject(st, { type: 'point', sub: 'intersection', deps: [cB.id, ibb.id], branch: 1, label: 'X', style: { color: violet, pointSize: 2.9 } });
      const y0 = addObject(st, { type: 'point', sub: 'intersection', deps: [cC.id, icc.id], branch: 0, label: 'Y0', style: { color: cool, pointSize: 2.8 } });
      const Y = addObject(st, { type: 'point', sub: 'intersection', deps: [cC.id, icc.id], branch: 1, label: 'Y', style: { color: cool, pointSize: 2.9 } });
      x0.visible = false; y0.visible = false;
      const by = seg(st, B, Y); const cx = seg(st, C, X);
      recompute(st);
      st.docName = 'IMO 2025 G2 · 旁心圆截线段';
      st.meta.scenarioId = 'imo2025-g2';
      st.view.scale = 62;
      return { state: st, goal: { kind: 'perpendicular', lineIds: [by.id, cx.id], title: '证明 BY⊥CX', statement: '证明 BY⊥CX', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'imo2022-g4', title: 'IMO 2022 G4 · 等距点与切线', short: 'DZ 相切', category: '圆与共点',
    difficulty: 5, tags: ['IMO', '外心', '等距', '切线'], glyph: 'circle-line', proof: null,
    description: 'D 在 BC 上；过 D 作 BC 垂线交 AO、AC、AB 于 W、X、Y；(AXY) 与 (ABC) 交于 Z。取满足 OW=OD 且 W≠D 的 D，观察 DZ 与 (AXY) 相切。',
    build() {
      const st = createState('IMO 2022 G4 · 等距点与切线');
      const A = point(st, 'A', 0, 4, { color: accent });
      const B = point(st, 'B', -3, 0, { color: accent });
      const C = point(st, 'C', 4, 0, { color: accent });
      const bc = seg(st, B, C); seg(st, A, B); seg(st, C, A);
      const tri = addObject(st, { type: 'triangle', sub: 'generic', deps: [A.id, B.id, C.id], centers: {}, show: {} });
      const O = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'O', label: 'O', style: { color: cool, pointSize: 2.8 } });
      const D = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [bc.id], t: 0.4897959183673469, label: 'D', style: { color: accent, pointSize: 2.9 } });
      const bcL = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const perp = addObject(st, { type: 'line', sub: 'perp', deps: [D.id, bcL.id], visible: false });
      const ao = addObject(st, { type: 'line', sub: 'through', deps: [A.id, O.id], visible: false });
      const ac = addObject(st, { type: 'line', sub: 'through', deps: [A.id, C.id], visible: false });
      const ab = addObject(st, { type: 'line', sub: 'through', deps: [A.id, B.id], visible: false });
      const W = addObject(st, { type: 'point', sub: 'intersection', deps: [perp.id, ao.id], label: 'W', style: { color: cool, pointSize: 2.8 } });
      const X = addObject(st, { type: 'point', sub: 'intersection', deps: [perp.id, ac.id], label: 'X', style: { color: mint, pointSize: 2.8 } });
      const Y = addObject(st, { type: 'point', sub: 'intersection', deps: [perp.id, ab.id], label: 'Y', style: { color: mint, pointSize: 2.8 } });
      const omega = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id], label: 'ω', style: { color: mint, width: .9, dash: 3, fill: 'transparent', opacity: .7 } });
      const cxy = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, X.id, Y.id], label: 'ω₁', style: { color: violet, width: .9, dash: 3, fill: 'transparent', opacity: .8 } });
      recompute(st);
      const z0 = addObject(st, { type: 'point', sub: 'intersection', deps: [omega.id, cxy.id], branch: 0, label: 'Z0', style: { color: pink, pointSize: 2.8 } });
      const Z = addObject(st, { type: 'point', sub: 'intersection', deps: [omega.id, cxy.id], branch: 1, label: 'Z', style: { color: pink, pointSize: 2.9 } });
      z0.visible = false;
      const dz = seg(st, D, Z);
      recompute(st);
      st.docName = 'IMO 2022 G4 · 等距点与切线';
      st.meta.scenarioId = 'imo2022-g4';
      st.view.scale = 68;
      return { state: st, goal: { kind: 'tangent', lineId: dz.id, circleId: cxy.id, title: '证明 DZ 与 (AXY) 相切', statement: '证明 DZ 与 (AXY) 相切', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'imo2022-g7', title: 'IMO 2022 G7 · 共圆共垂心双三角形', short: '外心在 OH 上', category: '圆与共点',
    difficulty: 5, tags: ['IMO', '垂心', '外接圆', '共线'], glyph: 'circle-line', proof: null,
    description: '△ABC 与 △A′B′C′ 共用外接圆和外心/垂心 H；P=AA′∩BB′，Q=BB′∩CC′，R=CC′∩AA′。观察 △PQR 的外心在 OH 上。',
    build() {
      const st = createState('IMO 2022 G7 · 共圆共垂心双三角形');
      const A = point(st, 'A', 0, 4, { color: accent });
      const B = point(st, 'B', -3, 0, { color: accent });
      const C = point(st, 'C', 3.5, 0, { color: accent });
      seg(st, A, B); seg(st, B, C); seg(st, C, A);
      const tri = addObject(st, { type: 'triangle', sub: 'generic', deps: [A.id, B.id, C.id], centers: {}, show: {} });
      const O = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'O', label: 'O', style: { color: cool, pointSize: 2.8 } });
      const H = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'H', label: 'H', style: { color: pink, pointSize: 2.8 } });
      const omega = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id], label: 'Ω', style: { color: mint, width: 1, fill: 'transparent' } });
      const A2 = addObject(st, { type: 'point', sub: 'pointOnCircle', deps: [omega.id], theta: 2.2, label: 'A′', style: { color: violet, pointSize: 2.9 } });
      const A2r = addObject(st, { type: 'point', sub: 'reflectPoint', deps: [A2.id, O.id], visible: false });
      const M = addObject(st, { type: 'point', sub: 'midpoint', deps: [H.id, A2r.id], visible: false });
      const a2h = addObject(st, { type: 'line', sub: 'through', deps: [A2.id, H.id], visible: false });
      const perp = addObject(st, { type: 'line', sub: 'perp', deps: [M.id, a2h.id], visible: false });
      const b2 = addObject(st, { type: 'point', sub: 'intersection', deps: [perp.id, omega.id], branch: 0, label: 'B′', style: { color: violet, pointSize: 2.9 } });
      const c2 = addObject(st, { type: 'point', sub: 'intersection', deps: [perp.id, omega.id], branch: 1, label: 'C′', style: { color: violet, pointSize: 2.9 } });
      addObject(st, { type: 'segment', sub: 'through', deps: [A2.id, b2.id], style: { color: violet, width: .8, dash: 4, opacity: .6 } });
      addObject(st, { type: 'segment', sub: 'through', deps: [b2.id, c2.id], style: { color: violet, width: .8, dash: 4, opacity: .6 } });
      addObject(st, { type: 'segment', sub: 'through', deps: [c2.id, A2.id], style: { color: violet, width: .8, dash: 4, opacity: .6 } });
      const aa = addObject(st, { type: 'line', sub: 'through', deps: [A.id, A2.id], visible: false });
      const bb = addObject(st, { type: 'line', sub: 'through', deps: [B.id, b2.id], visible: false });
      const cc = addObject(st, { type: 'line', sub: 'through', deps: [C.id, c2.id], visible: false });
      const P = addObject(st, { type: 'point', sub: 'intersection', deps: [aa.id, bb.id], label: 'P', style: { color: pink, pointSize: 2.8 } });
      const Q = addObject(st, { type: 'point', sub: 'intersection', deps: [bb.id, cc.id], label: 'Q', style: { color: pink, pointSize: 2.8 } });
      const R = addObject(st, { type: 'point', sub: 'intersection', deps: [cc.id, aa.id], label: 'R', style: { color: pink, pointSize: 2.8 } });
      const cen = addObject(st, { type: 'point', sub: 'circumcenter', deps: [P.id, Q.id, R.id], label: 'X', style: { color: gold, pointSize: 3.0 } });
      recompute(st);
      st.docName = 'IMO 2022 G7 · 共圆共垂心双三角形';
      st.meta.scenarioId = 'imo2022-g7';
      st.view.scale = 55;
      return { state: st, goal: { kind: 'collinear', ids: [O.id, H.id, cen.id], title: '证明 △PQR 的外心在 OH 上', statement: '证明 △PQR 的外心在 OH 上', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'imo2025-g1', title: 'IMO 2025 G1 · 共圆切线与共线', short: 'A,P,Q 共线', category: '圆与共点',
    difficulty: 5, tags: ['IMO', '共圆', '切线', '共线'], glyph: 'circle-line', proof: null,
    description: 'D、E 使 B,D,E,C 共圆；(ADE) 交 BC 于 X,Y；Ω=(BDX)，Γ=(CEY)；PD、PE、QB、QC 为切线，P、Q 为两组切线交点。观察 A、P、Q 共线。',
    build() {
      const st = createState('IMO 2025 G1 · 共圆切线与共线');
      const A = point(st, 'A', 0, 2, { color: accent });
      const B = point(st, 'B', -5, 0, { color: accent });
      const C = point(st, 'C', 5, 0, { color: accent });
      seg(st, A, B); seg(st, B, C); seg(st, C, A);
      const ab = st.objects.find((o) => o.type === 'segment' && o.deps.includes(A.id) && o.deps.includes(B.id));
      const acL = addObject(st, { type: 'line', sub: 'through', deps: [A.id, C.id], visible: false });
      const bcL = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const D = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [ab.id], t: 0.45, label: 'D', style: { color: mint, pointSize: 2.8 } });
      const cBCD = addObject(st, { type: 'circle', sub: 'threePoints', deps: [B.id, C.id, D.id], style: { color: mint, width: .9, dash: 4, fill: 'transparent', opacity: .7 } });
      recompute(st);
      const e0 = addObject(st, { type: 'point', sub: 'intersection', deps: [cBCD.id, acL.id], branch: 0, label: 'E0', style: { color: mint, pointSize: 2.8 } });
      const e1 = addObject(st, { type: 'point', sub: 'intersection', deps: [cBCD.id, acL.id], branch: 1, label: 'E', style: { color: mint, pointSize: 2.8 } });
      recompute(st);
      const E = dist(e0.g, C.g) >= dist(e1.g, C.g) ? e0 : e1; E.label = 'E'; (E === e0 ? e1 : e0).visible = false;
      const ade = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, D.id, E.id], style: { color: cool, width: .9, dash: 3, fill: 'transparent', opacity: .7 } });
      recompute(st);
      const x0 = addObject(st, { type: 'point', sub: 'intersection', deps: [ade.id, bcL.id], branch: 0, label: 'X0', style: { color: cool, pointSize: 2.8 } });
      const x1 = addObject(st, { type: 'point', sub: 'intersection', deps: [ade.id, bcL.id], branch: 1, label: 'Y0', style: { color: cool, pointSize: 2.8 } });
      recompute(st);
      const X = x0.g.x <= x1.g.x ? x0 : x1, Y = x0.g.x <= x1.g.x ? x1 : x0;
      X.label = 'X'; Y.label = 'Y';
      const om = addObject(st, { type: 'circle', sub: 'threePoints', deps: [B.id, D.id, X.id], label: 'Ω', style: { color: violet, width: .9, dash: 2, fill: 'transparent', opacity: .7 } });
      const ga = addObject(st, { type: 'circle', sub: 'threePoints', deps: [C.id, E.id, Y.id], label: 'Γ', style: { color: pink, width: .9, dash: 2, fill: 'transparent', opacity: .7 } });
      recompute(st);
      const pd = addObject(st, { type: 'line', sub: 'tangentAt', deps: [D.id, om.id], visible: false });
      const pe = addObject(st, { type: 'line', sub: 'tangentAt', deps: [E.id, ga.id], visible: false });
      const qb = addObject(st, { type: 'line', sub: 'tangentAt', deps: [B.id, om.id], visible: false });
      const qc = addObject(st, { type: 'line', sub: 'tangentAt', deps: [C.id, ga.id], visible: false });
      recompute(st);
      const P = addObject(st, { type: 'point', sub: 'intersection', deps: [pd.id, pe.id], label: 'P', style: { color: violet, pointSize: 2.9 } });
      const Q = addObject(st, { type: 'point', sub: 'intersection', deps: [qb.id, qc.id], label: 'Q', style: { color: pink, pointSize: 2.9 } });
      recompute(st);
      st.docName = 'IMO 2025 G1 · 共圆切线与共线';
      st.meta.scenarioId = 'imo2025-g1';
      st.view.scale = 55;
      return { state: st, goal: { kind: 'collinear', ids: [A.id, P.id, Q.id], title: '证明 A、P、Q 共线', statement: '证明 A、P、Q 三点共线', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'orig-1036', title: '原创 1036 · 塞瓦共点与根轴', short: 'MI 为根轴', category: '圆与共点',
    difficulty: 5, tags: ['原创', 'Ceva', '根轴', '共圆'], glyph: 'circle-line', proof: null,
    description: 'D、E 在 BC、CA 上，AD、BE 交于 P，CP 交 AB 于 F；FE 交 AD 于 I、交外接圆于 H、交 BC 于 G；M 为 BC 中点。观察 MI 是 (AMG) 与 (MDH) 的根轴。',
    build() {
      const st = createState('原创 1036 · 塞瓦共点与根轴');
      const A = point(st, 'A', 0, 4, { color: accent });
      const B = point(st, 'B', -3, 0, { color: accent });
      const C = point(st, 'C', 4, 0, { color: accent });
      const bc = seg(st, B, C); const ca = seg(st, C, A); const ab = seg(st, A, B);
      const D = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [bc.id], t: 0.4, label: 'D', style: { color: mint, pointSize: 2.8 } });
      const E = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [ca.id], t: 0.45, label: 'E', style: { color: mint, pointSize: 2.8 } });
      const ad = addObject(st, { type: 'line', sub: 'through', deps: [A.id, D.id], visible: false });
      const be = addObject(st, { type: 'line', sub: 'through', deps: [B.id, E.id], visible: false });
      const P = addObject(st, { type: 'point', sub: 'intersection', deps: [ad.id, be.id], label: 'P', style: { color: pink, pointSize: 2.8 } });
      const cp = addObject(st, { type: 'line', sub: 'through', deps: [C.id, P.id], visible: false });
      const abl = addObject(st, { type: 'line', sub: 'through', deps: [A.id, B.id], visible: false });
      const F = addObject(st, { type: 'point', sub: 'intersection', deps: [cp.id, abl.id], label: 'F', style: { color: pink, pointSize: 2.8 } });
      const fe = addObject(st, { type: 'line', sub: 'through', deps: [F.id, E.id], visible: false });
      const I = addObject(st, { type: 'point', sub: 'intersection', deps: [fe.id, ad.id], label: 'I', style: { color: violet, pointSize: 2.8 } });
      const bcl = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const G = addObject(st, { type: 'point', sub: 'intersection', deps: [fe.id, bcl.id], label: 'G', style: { color: violet, pointSize: 2.8 } });
      const om = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id], style: { color: mint, width: .8, dash: 4, fill: 'transparent', opacity: .55 } });
      recompute(st);
      const h0 = addObject(st, { type: 'point', sub: 'intersection', deps: [fe.id, om.id], branch: 0, label: 'H0', style: { color: cool, pointSize: 2.8 } });
      const H = addObject(st, { type: 'point', sub: 'intersection', deps: [fe.id, om.id], branch: 1, label: 'H', style: { color: cool, pointSize: 2.8 } });
      h0.visible = false;
      const M = addObject(st, { type: 'point', sub: 'midpoint', deps: [B.id, C.id], label: 'M', style: { color: mint, pointSize: 2.8 } });
      const c1 = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, M.id, G.id], style: { color: violet, width: .9, dash: 2, fill: 'transparent', opacity: .7 } });
      const c2 = addObject(st, { type: 'circle', sub: 'threePoints', deps: [M.id, D.id, H.id], style: { color: cool, width: .9, dash: 2, fill: 'transparent', opacity: .7 } });
      const rad = addObject(st, { type: 'line', sub: 'radical', deps: [c1.id, c2.id], label: '根轴', style: { color: pink, width: 1, dash: 2 } });
      const R = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [rad.id], t: 0.25, label: 'R', style: { color: pink, pointSize: 2.4 } });
      recompute(st);
      st.docName = '原创 1036 · 塞瓦共点与根轴';
      st.meta.scenarioId = 'orig-1036';
      st.view.scale = 58;
      return { state: st, goal: { kind: 'collinear', ids: [M.id, I.id, R.id], title: '证明 MI 是两圆根轴', statement: '证明 MI 是 (AMG) 与 (MDH) 的根轴', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'orig-1037', title: '原创 1037 · 内切圆切线与共线', short: 'O,P,Q 共线', category: '圆与共点',
    difficulty: 5, tags: ['原创', '弧中点', '切圆', '共线'], glyph: 'circle-line', proof: null,
    description: 'D 为弧 BAC 中点，BD、CD 交 AI 于 E、F；过 I 作 AI 垂线交 BC 于 G。圆 AED、AFD 与以 G 为圆心、GI 为半径的圆相切于 P、Q。观察 O、P、Q 共线。',
    build() {
      const st = createState('原创 1037 · 内切圆切线与共线');
      const A = point(st, 'A', -0.5, 4, { color: accent });
      const B = point(st, 'B', -3, 0, { color: accent });
      const C = point(st, 'C', 4, 0, { color: accent });
      seg(st, A, B); seg(st, B, C); seg(st, C, A);
      const tri = addObject(st, { type: 'triangle', sub: 'generic', deps: [A.id, B.id, C.id], centers: {}, show: {} });
      const O = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'O', label: 'O', style: { color: cool, pointSize: 2.8 } });
      const I = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'I', label: 'I', style: { color: mint, pointSize: 2.8 } });
      const om = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, C.id], style: { color: mint, width: .8, dash: 4, fill: 'transparent', opacity: .55 } });
      const D = addObject(st, { type: 'point', sub: 'midpointArc', deps: [om.id, B.id, A.id, C.id], label: 'D', style: { color: accent, pointSize: 2.9 } });
      const ai = addObject(st, { type: 'line', sub: 'through', deps: [A.id, I.id], visible: false });
      const bd = addObject(st, { type: 'line', sub: 'through', deps: [B.id, D.id], visible: false });
      const cd = addObject(st, { type: 'line', sub: 'through', deps: [C.id, D.id], visible: false });
      const E = addObject(st, { type: 'point', sub: 'intersection', deps: [bd.id, ai.id], label: 'E', style: { color: mint, pointSize: 2.8 } });
      const F = addObject(st, { type: 'point', sub: 'intersection', deps: [cd.id, ai.id], label: 'F', style: { color: mint, pointSize: 2.8 } });
      const bc = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const perp = addObject(st, { type: 'line', sub: 'perp', deps: [I.id, ai.id], visible: false });
      const G = addObject(st, { type: 'point', sub: 'intersection', deps: [perp.id, bc.id], label: 'G', style: { color: pink, pointSize: 2.8 } });
      const c1 = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, E.id, D.id], style: { color: violet, width: .9, dash: 2, fill: 'transparent', opacity: .7 } });
      const c2 = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, F.id, D.id], style: { color: cool, width: .9, dash: 2, fill: 'transparent', opacity: .7 } });
      const cg = addObject(st, { type: 'circle', sub: 'centerThrough', deps: [G.id, I.id], style: { color: pink, width: .9, dash: 3, fill: 'transparent', opacity: .7 } });
      const P = addObject(st, { type: 'point', sub: 'tangencyPoint', deps: [c1.id, cg.id], branch: 0, label: 'P', style: { color: violet, pointSize: 2.9 } });
      const Q = addObject(st, { type: 'point', sub: 'tangencyPoint', deps: [c2.id, cg.id], branch: 0, label: 'Q', style: { color: cool, pointSize: 2.9 } });
      recompute(st);
      st.docName = '原创 1037 · 内切圆切线与共线';
      st.meta.scenarioId = 'orig-1037';
      st.view.scale = 62;
      return { state: st, goal: { kind: 'collinear', ids: [O.id, P.id, Q.id], title: '证明 O、P、Q 共线', statement: '证明 O、P、Q 三点共线', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'orig-1034', title: '原创 1034 · 角度约束与圆', short: '∠CFD+∠CAD', category: '圆与共点',
    difficulty: 5, tags: ['原创', '角度约束', '共圆', '角度和'], glyph: 'circle-line', proof: null,
    description: 'D 满足 DB⊥CB 且 C,O,B,D 共圆；E 在 BC 上使 ∠AEC=∠OEB；F 使 ∠CAF=∠BAE 且 O,E,F 共线。观察 ∠CFD+∠CAD=180°。',
    build() {
      const st = createState('原创 1034 · 角度约束与圆');
      const A = point(st, 'A', -0.5, 4, { color: accent });
      const B = point(st, 'B', -3, 0, { color: accent });
      const C = point(st, 'C', 4, 0, { color: accent });
      const bc = seg(st, B, C); seg(st, A, B); seg(st, C, A);
      const tri = addObject(st, { type: 'triangle', sub: 'generic', deps: [A.id, B.id, C.id], centers: {}, show: {} });
      const O = addObject(st, { type: 'point', sub: 'triangleCenter', deps: [tri.id], centerKey: 'O', label: 'O', style: { color: cool, pointSize: 2.8 } });
      const bcL = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const cob = addObject(st, { type: 'circle', sub: 'threePoints', deps: [C.id, O.id, B.id], style: { color: mint, width: .8, dash: 3, fill: 'transparent', opacity: .55 } });
      const perpB = addObject(st, { type: 'line', sub: 'perp', deps: [B.id, bcL.id], visible: false });
      recompute(st);
      const d0 = addObject(st, { type: 'point', sub: 'intersection', deps: [cob.id, perpB.id], branch: 0, label: 'D0', style: { color: pink, pointSize: 2.8 } });
      const d1 = addObject(st, { type: 'point', sub: 'intersection', deps: [cob.id, perpB.id], branch: 1, label: 'D', style: { color: pink, pointSize: 2.8 } });
      recompute(st);
      const D = dist(d0.g, B.g) >= dist(d1.g, B.g) ? d0 : d1; D.label = 'D'; (D === d0 ? d1 : d0).visible = false;
      const E = addObject(st, { type: 'point', sub: 'angleEqualOnLine', deps: [bc.id, A.id, C.id, O.id, B.id], label: 'E', style: { color: mint, pointSize: 2.8 } });
      const oe = addObject(st, { type: 'line', sub: 'through', deps: [O.id, E.id], visible: false });
      const F = addObject(st, { type: 'point', sub: 'angleAtFixedOnLine', deps: [oe.id, C.id, A.id, B.id, A.id, E.id], label: 'F', style: { color: violet, pointSize: 2.8 } });
      recompute(st);
      st.docName = '原创 1034 · 角度约束与圆';
      st.meta.scenarioId = 'orig-1034';
      st.view.scale = 62;
      return { state: st, goal: { kind: 'angleSum', angles: [[C.id, F.id, D.id], [C.id, A.id, D.id]], value: Math.PI, title: '证明 ∠CFD+∠CAD=180°', statement: '证明 ∠CFD+∠CAD=180°', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'ratio-line-isosceles', title: '比例点与等腰三角形', short: 'AU=AV', category: '圆与共点',
    difficulty: 3, tags: ['比例', '外心', '等腰', '直线'], glyph: 'circle-line', proof: null,
    description: 'X、Y 在直线 BC 上（可在延长线），BX·AC=CY·AB；O₁、O₂ 为 (ACX)、(ABY) 外心；O₁O₂ 交 AB、AC 于 U、V。观察 AU=AV。',
    build() {
      const st = createState('比例点与等腰三角形');
      const A = point(st, 'A', 0, 4, { color: accent });
      const B = point(st, 'B', -3, 0, { color: accent });
      const C = point(st, 'C', 3, 0, { color: accent });
      const bc = seg(st, B, C); seg(st, A, B); seg(st, C, A);
      const bcl = addObject(st, { type: 'line', sub: 'through', deps: [B.id, C.id], visible: false });
      const X = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [bcl.id], t: -2, label: 'X', style: { color: mint, pointSize: 2.9 } });
      const Y = addObject(st, { type: 'point', sub: 'ratioDistanceOnLine', deps: [X.id, B.id, C.id, A.id], label: 'Y', style: { color: mint, pointSize: 2.9 } });
      const c1 = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, C.id, X.id], style: { color: violet, width: .9, dash: 3, fill: 'transparent', opacity: .65 } });
      const c2 = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, B.id, Y.id], style: { color: cool, width: .9, dash: 3, fill: 'transparent', opacity: .65 } });
      const O1 = addObject(st, { type: 'point', sub: 'circumcenter', deps: [A.id, C.id, X.id], label: 'O₁', style: { color: violet, pointSize: 2.8 } });
      const O2 = addObject(st, { type: 'point', sub: 'circumcenter', deps: [A.id, B.id, Y.id], label: 'O₂', style: { color: cool, pointSize: 2.8 } });
      const oo = addObject(st, { type: 'line', sub: 'through', deps: [O1.id, O2.id], visible: false });
      const abl = addObject(st, { type: 'line', sub: 'through', deps: [A.id, B.id], visible: false });
      const acl = addObject(st, { type: 'line', sub: 'through', deps: [A.id, C.id], visible: false });
      const U = addObject(st, { type: 'point', sub: 'intersection', deps: [oo.id, abl.id], label: 'U', style: { color: pink, pointSize: 2.9 } });
      const V = addObject(st, { type: 'point', sub: 'intersection', deps: [oo.id, acl.id], label: 'V', style: { color: pink, pointSize: 2.9 } });
      recompute(st);
      st.docName = '比例点与等腰三角形';
      st.meta.scenarioId = 'ratio-line-isosceles';
      st.view.scale = 68;
      return { state: st, goal: { kind: 'equalLength', pairs: [[A.id, U.id], [A.id, V.id]], title: '证明 △AUV 是等腰三角形', statement: '证明 AU=AV', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
  {
    id: 'parallelogram-circle-concurrent', title: '平行四边形·双圆交线共点', short: 'CD,AQ,BR 共点', category: '圆与共点',
    difficulty: 4, tags: ['平行四边形', '外接圆', '共点'], glyph: 'circle-line', proof: null,
    description: '平行四边形 ABCD，AC=BC；P 在 AB 延长线上；(ACD) 与 PD 交于 Q；(APQ) 与 PC 交于 R。观察 CD、AQ、BR 共点。',
    build() {
      const st = createState('平行四边形·双圆交线共点');
      const A = point(st, 'A', -3, 0, { color: accent });
      const B = point(st, 'B', 3, 0, { color: accent });
      const C = point(st, 'C', 0, 4, { color: accent });
      const D = addObject(st, { type: 'point', sub: 'parallelogramFourth', deps: [A.id, B.id, C.id], label: 'D', style: { color: accent, pointSize: 2.9 } });
      seg(st, A, B); seg(st, B, C); seg(st, C, D); seg(st, D, A);
      const ab = addObject(st, { type: 'line', sub: 'through', deps: [A.id, B.id], visible: false });
      const P = addObject(st, { type: 'point', sub: 'pointOnLine', deps: [ab.id], t: 7, label: 'P', style: { color: mint, pointSize: 2.9 } });
      const acd = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, C.id, D.id], style: { color: mint, width: .9, dash: 3, fill: 'transparent', opacity: .7 } });
      const pd = addObject(st, { type: 'line', sub: 'through', deps: [P.id, D.id], visible: false });
      recompute(st);
      const q0 = addObject(st, { type: 'point', sub: 'intersection', deps: [acd.id, pd.id], branch: 0, label: 'Q0', style: { color: violet, pointSize: 2.8 } });
      const q1 = addObject(st, { type: 'point', sub: 'intersection', deps: [acd.id, pd.id], branch: 1, label: 'Q', style: { color: violet, pointSize: 2.8 } });
      recompute(st);
      const Q = dist(q0.g, D.g) >= dist(q1.g, D.g) ? q0 : q1; Q.label = 'Q'; (Q === q0 ? q1 : q0).visible = false;
      const apq = addObject(st, { type: 'circle', sub: 'threePoints', deps: [A.id, P.id, Q.id], style: { color: cool, width: .9, dash: 3, fill: 'transparent', opacity: .7 } });
      const pc = addObject(st, { type: 'line', sub: 'through', deps: [P.id, C.id], visible: false });
      recompute(st);
      const r0 = addObject(st, { type: 'point', sub: 'intersection', deps: [apq.id, pc.id], branch: 0, label: 'R0', style: { color: pink, pointSize: 2.8 } });
      const r1 = addObject(st, { type: 'point', sub: 'intersection', deps: [apq.id, pc.id], branch: 1, label: 'R', style: { color: pink, pointSize: 2.8 } });
      recompute(st);
      const R = dist(r0.g, P.g) >= dist(r1.g, P.g) ? r0 : r1; R.label = 'R'; (R === r0 ? r1 : r0).visible = false;
      const cd = addObject(st, { type: 'line', sub: 'through', deps: [C.id, D.id], visible: false });
      const aq = addObject(st, { type: 'line', sub: 'through', deps: [A.id, Q.id], visible: false });
      const br = addObject(st, { type: 'line', sub: 'through', deps: [B.id, R.id], visible: false });
      recompute(st);
      st.docName = '平行四边形·双圆交线共点';
      st.meta.scenarioId = 'parallelogram-circle-concurrent';
      st.view.scale = 55;
      return { state: st, goal: { kind: 'concurrent', lineIds: [cd.id, aq.id, br.id], title: '证明 CD、AQ、BR 三线共点', statement: '证明 CD、AQ、BR 三线共点', source: 'scenario' }, proof: null, focus: 'ai' };
    },
  },
];


export const SCENARIO_GLYPHS = {
  triangle: '△', circle: '◯', 'circle-line': '◎', angle: '∠',
  transform: '⇄', polygon: '⬠', curve: '∿', measure: '↔',
};

export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) || null;
}

export function buildScenario(id) {
  const sc = scenarioById(id);
  if (!sc) return null;
  try {
    const built = sc.build();
    if (!built?.state) return null;
    built.state.meta = built.state.meta || {};
    built.state.meta.scenarioId = sc.id;
    if (!built.state.docName) built.state.docName = sc.title;
    return built;
  } catch (e) {
    console.warn('scenario build failed', id, e);
    return null;
  }
}
