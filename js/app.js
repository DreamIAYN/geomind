/* ==========================================================================
   GeoMind · application shell
   ========================================================================== */
import {
  createState, deserializeState, serializeState, cloneState, recompute, objectById, addObject,
  removeObjects, uniqueLabel, nextPointLabel, addTriangle, ensureCenters, removeCenter,
  ensureTriangleCircle, ensureEulerLine, findTriangles, triangleForVertices, triangleMetrics,
  nearestCenter, centerDef, CENTER_DEFS, CORE_CENTERS, PALETTE, fmt, fmtSigned, dist, mid, sub, barycentric,
  add, mul, norm, perp, cross, dot, len, angleAt, deg, rad, projectOnLine, tangentPoints,
  circumcenter, polygonArea, pointInPolygon, clamp, mod, TAU, intersectionOfCurves, getCurve,
  directedAngle3, directedAngle2, conicValue, qlcu1Value,
  basicTriangleScene, harmonicConjugate, crossRatio,
} from './geometry.js';
import { buildSnapshot, runDetection, CATEGORY } from './relations.js';
import {
  evaluateGoal, stabilityCheck, buildSolution, goalFromRelation, inferGoalFromSelection,
  goalStatement, buildGoalForKind, goalPayload, pointLabel, lineLabel, GOAL_LABEL,
} from './solver.js';
import { SCENARIOS, buildScenario, scenarioById, SCENARIO_GLYPHS, PROOFS } from './scenarios.js';
import { health, verify as apiVerify, generate as apiGenerate, vision as apiVision, proof as apiProof, logs as apiLogs, figurePDF, clientLog, complexProve } from './api.js';
import { buildVisionState, sampleVisionData, validateVisionState } from './vision.js';
import { solveConstraints } from './constraints.js';
import { complexFrame, checkGoalComplex } from './complex.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const LOCAL_CLIENT = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------- icons --------------------------------- */
const ICON = {
  cursor: '<path d="M5 3v16l4.2-4.3 2.8 4.9 2.4-1.4-2.8-4.9L18 12 5 3Z"/>',
  point: '<circle cx="12" cy="12" r="2.5"/><path d="M12 3v4m0 10v4M3 12h4m10 0h4"/>',
  line: '<path d="M4 20 20 4"/><circle cx="7" cy="17" r="1.8"/><circle cx="17" cy="7" r="1.8"/>',
  circle: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.4"/>',
  triangle: '<path d="M12 3 21 20H3Z"/><path d="M12 3v17M3 20l9-8 9 8" opacity=".5"/>',
  transform: '<path d="M4 7h10v10H4zM10 3h10v10"/><path d="m14 14 5 5m-5 0 5-5"/>',
  measure: '<path d="M3 15 15 3l6 6L9 21Z"/><path d="M7 13l2 2m1-6 2 2m1-6 2 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeoff: '<path d="m3 3 18 18M10 6.1A12 12 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.3 3.8M6.3 7.5C3.6 9.5 2 12 2 12s4 6 10 6c1.7 0 3.3-.5 4.6-1.3"/>',
  trash: '<path d="M4 6h16M8 6V3h8v3m-9 0 1 15h8l1-15M10 10v7m4-7v7"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
  focus: '<circle cx="12" cy="12" r="3"/><path d="M4 8V4h4m8 0h4v4m0 8v4h-4M8 20H4v-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="M5 5 19 19M19 5 5 19"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  play: '<path d="M8 5v14l11-7Z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  download: '<path d="M12 4v12m-5-5 5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 20V8m-5 5 5-5 5 5M4 4h16"/>',
  fit: '<path d="M9 4H4v5m11-5h5v5m0 11h-5m-6 0H4v-5"/>',
  grid: '<path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 7 18a3 3 0 0 0 5 2V4.5A2.5 2.5 0 0 0 9 4Zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8A3 3 0 0 1 17 18a3 3 0 0 1-5 2V4.5A2.5 2.5 0 0 1 15 4Z"/>',
  book: '<path d="M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4Zm16 0h-4a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h4Z"/>',
  flask: '<path d="M9 3h6m-5 0v5L4 19a2 2 0 0 0 1.8 2h12.4A2 2 0 0 0 20 19L14 8V3"/><path d="M7 15h10"/>',
  command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z"/>',
  text: '<path d="M5 5h14M12 5v14M8 19h8"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.8"/><path d="m3 17 5-5 4 4 3-2 6 5"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10M12 7v10"/>',
  polygon: '<path d="m12 3 8 6-3 10H7L4 9Z"/>',
  conic: '<ellipse cx="12" cy="12" rx="9" ry="5.5"/><path d="M3 12h18" opacity=".35"/>',
  curve: '<path d="M2 17c3-9 6 2 9-4s5-7 11-2"/><circle cx="5" cy="12" r="1.2"/><circle cx="19" cy="10" r="1.2"/>',
  angle: '<path d="M5 20 19 5M5 20h14"/><path d="M11 20a8 8 0 0 0-2-5" opacity=".6"/>',
  perp: '<path d="M4 19h16M12 19V5"/><path d="M12 16h3v3"/>',
  foot: '<path d="M3 18h18M12 18V7"/><path d="M12 15h3v3"/><circle cx="12" cy="7" r="1.6"/>',
  distance: '<path d="M4 17 20 7M4 13v4m16-8v4"/><path d="M9 12h6" stroke-dasharray="2 2"/>',
  area: '<path d="M4 18 10 5l10 4-3 10Z"/><path d="m8 15 4-5 3 1" opacity=".6"/>',
  ratio: '<path d="M5 6h4v12H5zM15 6h4v12h-4z"/><path d="M11 12h2"/>',
  duplicate: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.8 2.1c-.8.5-1.3 1-1.3 2.1M12 17h.01"/>',
};
function svg(name, cls = '') { return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ICON.point}</svg>`; }

/* ------------------------------- tool groups ----------------------------- */
const TOOL_GROUPS = [
  { id: 'basic', label: '基本', icon: 'cursor', title: '基本作图', sub: '选择与点、线、圆', tools: [
    { id: 'select', name: '选择', hint: '拖动点 · 空白处平移', icon: 'cursor', key: 'V' },
    { id: 'freePoint', name: '点', hint: '点击画布放置', icon: 'point', key: 'P' },
    { id: 'onObject', name: '线上点', hint: '点击线 / 圆附着', icon: 'target' },
    { id: 'segment', name: '线段', hint: '两个端点', icon: 'line', key: 'S' },
    { id: 'line', name: '直线', hint: '经过两点', icon: 'line', key: 'L' },
    { id: 'ray', name: '射线', hint: '起点 → 方向点', icon: 'line' },
    { id: 'vector', name: '向量', hint: '起点 → 终点', icon: 'line' },
    { id: 'circleCenter', name: '圆', hint: '圆心 → 过点', icon: 'circle', key: 'C' },
    { id: 'circle3', name: '三点圆', hint: '经过三个点', icon: 'circle' },
    { id: 'diameterCircle', name: '直径圆', hint: '直径两端点', icon: 'circle' },
    { id: 'polygon', name: '多边形', hint: '双击闭合', icon: 'polygon' },
    { id: 'text', name: '文本', hint: '点击画布放置', icon: 'text' },
  ] },
  { id: 'construct', label: '构造', icon: 'layers', title: '几何构造', sub: '三角形、中点、交点、垂线与切线', tools: [
    { id: 'triangle', name: '三角形', hint: '三顶点（不自动添加特征点）', icon: 'triangle', key: 'T' },
    { id: 'midpoint', name: '中点', hint: '点线段，或选择两点', icon: 'distance' },
    { id: 'intersection', name: '交点', hint: '点交点，或选两条曲线', icon: 'layers' },
    { id: 'foot', name: '垂足', hint: '点 → 直线', icon: 'foot' },
    { id: 'parallel', name: '平行线', hint: '点 → 基准线', icon: 'layers' },
    { id: 'perp', name: '垂线', hint: '点 → 基准线', icon: 'perp' },
    { id: 'perpBisector', name: '中垂线', hint: '点线段，或选择两点', icon: 'line' },
    { id: 'angleBisector', name: '角平分线', hint: 'A → 顶点 → C', icon: 'angle' },
    { id: 'lineBisector', name: '两线角平分线', hint: '两条直线 → 两条', icon: 'angle' },
    { id: 'isogonal', name: '等角线', hint: 'A → 顶点 → C → 过顶点的线', icon: 'angle' },
    { id: 'tangent', name: '切线', hint: '圆 → 点（圆上/外）', icon: 'target' },
    { id: 'radical', name: '根轴', hint: '选择两个圆', icon: 'layers' },
    { id: 'circumcircle', name: '外接圆', hint: '三角形三顶点', icon: 'circle' },
    { id: 'incircle', name: '内切圆', hint: '三角形三顶点', icon: 'circle' },
    { id: 'ninePointCircle', name: '九点圆', hint: '三角形三顶点', icon: 'circle' },
    { id: 'conic5', name: '二次曲线', hint: '依次选择五个点', icon: 'conic' },
    { id: 'fixedPoint', name: '定长点', hint: '起点 → 方向点 → 长度对象', icon: 'distance' },
    { id: 'fixedSegment', name: '定长线段', hint: '起点 → 方向点 → 长度对象', icon: 'line' },
    { id: 'fixedCircle', name: '定长圆', hint: '圆心 → 长度对象', icon: 'circle' },
    { id: 'fixedAngleLine', name: '定角线', hint: '过点 → 基线 → 角对象/三点', icon: 'angle' },
    { id: 'equalDistancePoint', name: '等距点', hint: 'U → B → C → A（BU=CV）', icon: 'distance' },
  ] },
  { id: 'transform', label: '变换', icon: 'transform', title: '几何变换', sub: '对称、旋转、平移与位似', tools: [
    { id: 'reflectLine', name: '轴对称', hint: '对象 → 对称轴', icon: 'transform' },
    { id: 'reflectPoint', name: '中心对称', hint: '对象 → 对称中心', icon: 'target' },
    { id: 'rotate', name: '旋转', hint: '对象 → 中心', icon: 'transform' },
    { id: 'translate', name: '平移', hint: '对象 → A → B', icon: 'transform' },
    { id: 'homothety', name: '位似', hint: '对象 → 中心', icon: 'transform' },
    { id: 'inversion', name: '反演', hint: '对象 → 反演圆', icon: 'target' },
    { id: 'iranianInversion', name: '伊朗反演', hint: 'A → B → C → 点', icon: 'transform' },
  ] },
  { id: 'projective', label: '射影', icon: 'layers', title: '射影几何', sub: '调和点列、极点与极线', tools: [
    { id: 'harmonic', name: '调和点', hint: 'A → B → C', icon: 'ratio' },
    { id: 'polar', name: '极线', hint: '点 → 圆', icon: 'line' },
    { id: 'pole', name: '极点', hint: '直线 → 圆', icon: 'target' },
    { id: 'crossRatio', name: '交比', hint: '四个共线点', icon: 'measure' },
    { id: 'qlcu1', name: '巨龙曲线', hint: '依次选择四条直线', icon: 'curve' },
  ] },
  { id: 'measure', label: '度量', icon: 'measure', title: '测量', sub: '距离、角度、面积与比例', tools: [
    { id: 'measureDistance', name: '距离', hint: '两个点或一条线段', icon: 'distance' },
    { id: 'measureAngle', name: '有向角', hint: 'A → 顶点 → C，或两条射线', icon: 'angle' },
    { id: 'measureArea', name: '面积', hint: '多边形或三点', icon: 'area' },
    { id: 'measureRatio', name: '线段比', hint: '依次选择四点', icon: 'ratio' },
  ] },
];

const TOOL_MAP = new Map();
for (const g of TOOL_GROUPS) for (const t of g.tools) TOOL_MAP.set(t.id, { ...t, group: g.id });

/* ------------------------------- app state ------------------------------- */
const S = {
  state: null,
  ui: {
    tool: 'select', group: 'basic', tab: 'triangle', selection: [], hover: null, pending: [],
    activeTriangle: null, goal: null, proof: null, aiResult: null, aiBusy: false, solutionTab: 'verdict', llmProof: null, llmBusy: false, llmError: '', llmElapsed: 0,
    relations: [], relationCats: new Set(['collinear', 'concyclic', 'parallel', 'perpendicular', 'concurrent', 'equalLength', 'equalAngle', 'midpoint', 'tangent', 'ratio', 'identity', 'center']),
    scanStatus: 'idle', scanMs: 0, generated: [], complexProps: [], complexResults: {}, complexGoalResult: null, complexSymbolic: null, generating: false, exploreTab: 'relations',
    libraryFilter: '全部', libraryQuery: '', scenarioId: null, highlight: null, highlightAt: 0,
    method: 'synthetic', spaceDown: false, multiSelect: false, mobileObjectsOpen: false, mobileToolsOpen: false, mobileToolbarHidden: false, pointers: new Map(), pinch: null, curveCache: new Map(), traces: new Map(), traceIds: new Set(), theme: 'ink', inspectorCollapsed: false,
    backend: { online: false, checked: false, latency: 0, version: '' }, saveTimer: null, lastSave: 0,
    worker: null, workerReq: 0, workerPending: new Map(), drag: null, labelDrag: null, pan: null, pointer: { x: 0, y: 0, wx: 0, wy: 0 },
    toolParams: { angle: 90, ratio: 0.5, sides: 5, text: '注' },
    commandIndex: 0, commandItems: [], actionLog: [], lastRender: 0, frames: 0, fpsAt: performance.now(), fps: 60,
  },
  history: [], future: [], renderer: null, autosaveKey: 'geomind:session:v1',
};
window.__GEOMIND__ = S;
const BUILD_VERSION = '2026-10-24-95';
window.__GEOMIND_BUILD__ = BUILD_VERSION;

/* ---------------------------------- API ---------------------------------- */
async function checkBackend() {
  try {
    const h = await health();
    S.ui.backend = { online: true, checked: true, latency: 0, version: h.version || '', engine: h.engine || '' };
  } catch {
    S.ui.backend = { online: false, checked: true, latency: 0, version: '', engine: '' };
  }
  updateBackendBadge();
}

function updateBackendBadge() {
  const dot = $('#backend-dot'); const label = $('#backend-label');
  if (!dot || !label) return;
  if (S.ui.backend.online) {
    dot.classList.remove('off'); label.textContent = `内核在线 · ${S.ui.backend.version || 'v1.0'}`;
  } else {
    dot.classList.add('off'); label.textContent = '离线内核 · 浏览器推理';
  }
}

/* ------------------------------ toast/modal ------------------------------ */
function toast(msg, kind = 'ok', ms = 2600) {
  const root = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (kind === 'error' ? 'error' : kind === 'warn' ? 'warn' : '');
  el.innerHTML = `<span class="dot"></span><span>${esc(msg)}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.2s'; setTimeout(() => el.remove(), 220); }, ms);
}

function modal(html, { onMount, onClose, width = 500 } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" style="width:min(${width}px,96vw)">${html}</div></div>`;
  const close = () => { root.innerHTML = ''; onClose?.(); };
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  root.querySelector('.modal-backdrop')?.addEventListener('pointerdown', (e) => { if (e.target.classList.contains('modal-backdrop')) close(); });
  if (onMount) onMount(root, close);
  return close;
}

function confirmModal(title, message, onConfirm, { danger = false, confirmText = '确认' } = {}) {
  modal(`<div class="modal-head"><div><span class="eyebrow">CONFIRM</span><h3>${esc(title)}</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body"><p style="font-size:10.5px;line-height:1.7;color:var(--muted);margin:0">${esc(message)}</p></div>
    <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn ${danger ? 'danger' : 'primary'}" id="modal-confirm">${esc(confirmText)}</button></div>`,
  { onMount: (root, close) => { $('#modal-confirm', root).addEventListener('click', () => { close(); onConfirm(); }); } });
}

/* ------------------------------ persistence ------------------------------ */
function snapshot() { return serializeState(S.state); }
function pushHistory() {
  S.history.push(snapshot());
  if (S.history.length > 80) S.history.shift();
  S.future = [];
  updateHistoryButtons();
}
function restoreSnapshot(text) {
  try {
    const st = deserializeState(text);
    st.view = S.state?.view || st.view;
    applyCompactVisuals(st);
    S.state = st;
    afterStateReplaced(false);
    toast('已恢复画板状态');
  } catch (err) { toast('恢复失败：' + err.message, 'error'); }
}
function undo() {
  if (!S.history.length) return toast('没有可撤销的操作', 'warn');
  S.future.push(snapshot());
  restoreSnapshot(S.history.pop());
  updateHistoryButtons();
}
function redo() {
  if (!S.future.length) return toast('没有可重做的操作', 'warn');
  S.history.push(snapshot());
  restoreSnapshot(S.future.pop());
  updateHistoryButtons();
}
function updateHistoryButtons() {
  const u = $('#btn-undo'), r = $('#btn-redo');
  if (u) u.disabled = !S.history.length;
  if (r) r.disabled = !S.future.length;
}
function scheduleAutosave() {
  if (!S.state?.settings?.autoSave) return;
  clearTimeout(S.ui.saveTimer);
  S.ui.saveTimer = setTimeout(() => saveSession(true), 350);
}
function saveSession(silent = false) {
  try {
    const payload = { state: snapshot(), goal: S.ui.goal, scenarioId: S.ui.scenarioId, proof: S.ui.proof, tab: S.ui.tab };
    localStorage.setItem(S.autosaveKey, JSON.stringify(payload));
    S.ui.lastSave = Date.now();
    const el = $('#save-state'); if (el) el.textContent = '已保存到本地';
    if (!silent) toast('画板已保存');
  } catch (e) { if (!silent) toast('保存失败：本地存储不可用', 'error'); }
}
function loadSession() {
  try {
    const raw = localStorage.getItem(S.autosaveKey);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.state) return null;
    const st = deserializeState(d.state);
    // The previous first-run demo was a fully populated Euler-line sample.
    // If it is still untouched, start fresh with the new plain triangle ABC.
    if (d.scenarioId === 'euler-ninepoint' && st.objects.length === 13 && st.docName === '五心与欧拉线') return null;
    return { state: st, goal: d.goal || null, scenarioId: d.scenarioId || null, proof: d.proof || null, tab: d.tab || 'triangle' };
  } catch { return null; }
}
function setSavedState(text = '已保存到本地') { const el = $('#save-state'); if (el) el.textContent = text; }

/* ------------------------------ state helpers ---------------------------- */
function addPoint(x, y, opts = {}) {
  const lab = opts.label || nextPointLabel(S.state);
  return addObject(S.state, {
    type: 'point', sub: opts.sub || 'free', x, y, label: uniqueLabel(S.state, lab),
    deps: opts.deps || [], ...opts.extra,
    style: { color: opts.color || '#ff7a59', pointSize: opts.pointSize || 4.6, ...(opts.style || {}) },
    meta: opts.meta || {},
  });
}
function addPointOnCurve(o, world) {
  if (o.type === 'point') return o;
  if (['line', 'segment', 'ray', 'vector'].includes(o.type)) {
    const t = dot(sub(world, o.g.a), o.g.d);
    return addObject(S.state, {
      type: 'point', sub: 'pointOnLine', deps: [o.id], t: o.type === 'segment' ? clamp(t / o.g.len, 0.02, 0.98) : t,
      label: uniqueLabel(S.state, nextPointLabel(S.state)), style: { color: '#263342', pointSize: 3.0 },
    });
  }
  if (o.type === 'circle') {
    const th = Math.atan2(world.y - o.g.center.y, world.x - o.g.center.x);
    return addObject(S.state, {
      type: 'point', sub: 'pointOnCircle', deps: [o.id], theta: th,
      label: uniqueLabel(S.state, nextPointLabel(S.state)), style: { color: '#263342', pointSize: 3.0 },
    });
  }
  return null;
}
function addLineObj(type, sub, deps, opts = {}) {
  return addObject(S.state, {
    type, sub, deps, label: opts.label || '',
    style: { color: opts.color || '#3d4c63', width: opts.width || 1.1, dash: opts.dash || 0, ...(opts.style || {}) },
    meta: opts.meta || {},
  });
}
function addCircleObj(sub, deps, opts = {}) {
  return addObject(S.state, {
    type: 'circle', sub, deps, label: opts.label ? uniqueLabel(S.state, opts.label) : '',
    radius: opts.radius,
    style: { color: opts.color || '#7aa2ff', width: opts.width || .95, dash: opts.dash || 0, fill: 'transparent', opacity: opts.opacity ?? .82, ...(opts.style || {}) },
    meta: opts.meta || {},
  });
}
function addMeasure(sub, deps, world, extra = {}) {
  return addObject(S.state, {
    type: 'measure', sub, deps, x: world?.x || 0, y: world?.y || 0, ...extra,
    style: { color: '#f6c76b', width: .8, dash: 0, ...(extra.style || {}) },
  });
}

function selectObjects(ids, additive = false) {
  if (additive) {
    const set = new Set(S.ui.selection);
    for (const id of ids) { if (set.has(id)) set.delete(id); else set.add(id); }
    S.ui.selection = [...set];
  } else S.ui.selection = [...new Set(ids)];
  if (S.ui.tab === 'objects') renderObjects();
  if (S.ui.mobileObjectsOpen) renderMobileObjects();
  updateHUD();
  requestRender();
}
function selectedObjects() { return S.ui.selection.map((id) => objectById(S.state, id)).filter(Boolean); }
function setTool(id) {
  const t = TOOL_MAP.get(id);
  if (!t) return;
  S.ui.tool = id; S.ui.group = t.group; S.ui.pending = []; S.ui.hover = null;
  $('#active-tool-label').textContent = t.name;
  $('#stage-hint').textContent = t.hint;
  renderRail(); renderTools(); renderToolConfig();
  requestRender();
  if (id !== 'select') setCursor('crosshair');
  else setCursor('default');
  if (id === 'select') syncMultiSelect();
  if (S.ui.mobileToolsOpen && window.matchMedia && window.matchMedia('(max-width:940px)').matches) openMobileTools(false);
}
function setCursor(c) { const st = $('#stage'); if (st) st.style.cursor = c; }
function logAction(text) {
  S.ui.actionLog.push({ time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), text: String(text || '') });
  if (S.ui.actionLog.length > 100) S.ui.actionLog.splice(0, S.ui.actionLog.length - 100);
}
function afterMutation({ render = true, save = true } = {}) {
  recompute(S.state);
  if (!S.ui.scanning) { S.ui.relations = []; S.ui.scanStatus = 'idle'; }
  if (render) { renderAll(); }
  if (save) scheduleAutosave();
  S.ui.lastRevision = (S.ui.lastRevision || 0) + 1;
}
function applyCompactVisuals(st) {
  if (!st?.meta || st.meta.styleVersion === 4) return st;
  st.settings = st.settings || {};
  st.settings.grid = false;
  st.settings.axes = false;
  const ink = '#263342';
  for (const o of st.objects || []) {
    if (o.type === 'point') {
      if (o.centerKey) {
        o.meta = o.meta || {};
        o.meta.centerColor = o.meta.centerColor || centerDef(o.centerKey).color;
        o.style.pointSize = Math.min(o.style.pointSize || 3.2, 3.2);
      } else {
        o.style.pointSize = Math.min(o.style.pointSize || 3.0, 3.0);
      }
      o.style.color = ink;
      o.meta = o.meta || {};
      o.meta.userColor = false;
    } else if (['line', 'segment', 'ray', 'vector', 'polygon'].includes(o.type)) {
      o.style.width = Math.min(o.style.width || 1.1, 1.15);
    } else if (o.type === 'circle') {
      o.style.width = Math.min(o.style.width || .95, 1.0);
    } else if (o.type === 'triangle') {
      o.style.width = Math.min(o.style.width || .8, .9);
    } else if (o.type === 'measure') {
      o.style.width = Math.min(o.style.width || .8, .8);
    }
  }
  st.meta.styleVersion = 4;
  return st;
}

function afterStateReplaced(clearSelection = true) {
  recompute(S.state);
  logAction('载入/新建画板：' + (S.state.docName || ''));
  S.ui.curveCache?.clear();
  S.ui.traces?.clear(); S.ui.traceIds?.clear();
  if (clearSelection) { S.ui.selection = []; S.ui.goal = null; S.ui.proof = null; S.ui.aiResult = null; S.ui.llmProof = null; S.ui.llmError = ''; }
  S.ui.pending = []; S.ui.highlight = null;
  S.ui.activeTriangle = S.state.objects.find((o) => o.type === 'triangle' && o.valid)?.id || null;
  syncDocName(); renderAll(); scheduleAutosave(); updateHistoryButtons();
}

/* ------------------------------ worker -------------------------------- */
function initWorker() {
  try {
    const w = new Worker(new URL('./relations-worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (ev) => {
      const { type, requestId, result, error } = ev.data || {};
      const pending = S.ui.workerPending.get(requestId);
      if (!pending) return;
      if (type === 'result') { S.ui.workerPending.delete(requestId); pending.resolve(result); }
      else if (type === 'error') { S.ui.workerPending.delete(requestId); pending.reject(new Error(error)); }
    };
    w.onerror = () => { S.ui.worker = null; };
    S.ui.worker = w;
  } catch { S.ui.worker = null; }
}
function scanRelations(snapshotData, options) {
  if (!S.ui.worker) return runDetection(snapshotData, options);
  const requestId = ++S.ui.workerReq;
  return new Promise((resolve, reject) => {
    S.ui.workerPending.set(requestId, { resolve, reject });
    S.ui.worker.postMessage({ type: 'scan', requestId, snapshot: snapshotData, options });
    setTimeout(() => {
      if (S.ui.workerPending.has(requestId)) { S.ui.workerPending.delete(requestId); reject(new Error('关系扫描超时')); }
    }, 10000);
  });
}

/* ------------------------------ color tools ------------------------------ */
function parseCssColor(c) {
  if (typeof c !== 'string') return null;
  const t = c.trim();
  let m = t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  m = t.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    if (p.length >= 3) return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  return null;
}
function darkenLineColor(c) {
  const p = parseCssColor(c) || { r: 31, g: 41, b: 55, a: 1 };
  const lum = .299 * p.r + .587 * p.g + .114 * p.b;
  const f = lum > 150 ? .34 : lum > 95 ? .44 : lum > 60 ? .58 : .8;
  const a = Math.max(p.a, .9);
  return `rgba(${Math.round(p.r * f)}, ${Math.round(p.g * f)}, ${Math.round(p.b * f)}, ${a})`;
}

function traceableObject(o) {
  return !!o && o.valid && (o.type === 'point' || ['line', 'segment', 'ray', 'vector'].includes(o.type));
}
function traceSnapshot(o) {
  if (o.type === 'point' && o.g) return { kind: 'point', x: o.g.x, y: o.g.y };
  if (['line', 'segment', 'ray', 'vector'].includes(o.type) && o.g) {
    return { kind: o.type, a: { x: o.g.a.x, y: o.g.a.y }, b: { x: o.g.b.x, y: o.g.b.y }, d: { x: o.g.d.x, y: o.g.d.y }, len: o.g.len };
  }
  return null;
}
function recordTraces() {
  if (!S.ui.traceIds.size || !S.state) return;
  const scale = Math.max(1, S.state.view.scale);
  const minStep = .6 / scale;
  for (const id of [...S.ui.traceIds]) {
    const o = objectById(S.state, id);
    const snap = traceSnapshot(o);
    if (!snap) continue;
    let arr = S.ui.traces.get(id);
    if (!arr) { arr = []; S.ui.traces.set(id, arr); }
    const last = arr[arr.length - 1];
    if (last) {
      if (snap.kind === 'point' && last.kind === 'point' && Math.hypot(snap.x - last.x, snap.y - last.y) < minStep) continue;
      if (snap.kind !== 'point' && last.kind !== 'point') {
        const da = Math.hypot(snap.a.x - last.a.x, snap.a.y - last.a.y);
        const cross = Math.abs(snap.d.x * last.d.y - snap.d.y * last.d.x);
        if (da < minStep && cross < .0004) continue;
      }
    }
    arr.push(snap);
    if (arr.length > 2000) S.ui.traces.set(id, arr.filter((_, i) => i % 2 === 0));
  }
}
function toggleTrace(o) {
  if (!traceableObject(o)) return;
  if (S.ui.traceIds.has(o.id)) {
    S.ui.traceIds.delete(o.id);
    S.ui.traces.delete(o.id);
    toast('已停止并清除 ' + (o.label || TYPE_NAME[o.type]) + ' 的轨迹', 'warn');
  } else {
    S.ui.traceIds.add(o.id);
    const snap = traceSnapshot(o);
    S.ui.traces.set(o.id, snap ? [snap] : []);
    toast('开始追踪 ' + (o.label || TYPE_NAME[o.type]) + '：拖动自由点即可描出轨迹');
  }
  renderInspector(); requestRender();
}
function clearTraces(onlyId = null) {
  const had = onlyId ? S.ui.traces.has(onlyId) : S.ui.traces.size > 0;
  if (onlyId) { S.ui.traceIds.delete(onlyId); S.ui.traces.delete(onlyId); }
  else { S.ui.traceIds.clear(); S.ui.traces.clear(); }
  logAction(onlyId ? '清除对象轨迹' : '清除全部轨迹');
  renderInspector(); requestRender();
  if (had) toast(onlyId ? '已清除该对象轨迹' : '已清除全部轨迹');
}

function curveSegments(o) {
  if (!o?.valid || o.type !== 'curve' || !S.renderer) return [];
  const r = S.renderer, view = S.state.view;
  const key = `${o.id}|${S.ui.lastRevision || 0}|${view.cx.toFixed(2)}|${view.cy.toFixed(2)}|${view.scale.toFixed(3)}|${r.w}|${r.h}`;
  const hit = S.ui.curveCache.get(key);
  if (hit) return hit;
  // QL-Cu1 is a cubic with thin branches; a coarse screen grid makes it look polygonal.
  const step = o.sub === 'qlcu1' ? 3 : 5;
  const nx = Math.max(3, Math.ceil(r.w / step) + 1);
  const ny = Math.max(3, Math.ceil(r.h / step) + 1);
  const p0 = r.toWorld({ x: -step, y: -step });
  const p1 = r.toWorld({ x: r.w + step, y: r.h + step });
  const x0 = Math.min(p0.x, p1.x), x1 = Math.max(p0.x, p1.x);
  const y0 = Math.min(p0.y, p1.y), y1 = Math.max(p0.y, p1.y);
  const dx = (x1 - x0) / (nx - 1), dy = (y1 - y0) / (ny - 1);
  const vals = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = { x: x0 + i * dx, y: y0 + j * dy };
      vals[j * nx + i] = o.sub === 'conic' ? conicValue(o.g, p) : qlcu1Value(o.g, p);
    }
  }
  const segs = [];
  const pointAt = (edge, ix, iy) => {
    const v00 = vals[iy * nx + ix], v10 = vals[iy * nx + ix + 1], v11 = vals[(iy + 1) * nx + ix + 1], v01 = vals[(iy + 1) * nx + ix];
    let a, b, va, vb;
    if (edge === 0) { a = [ix, iy]; b = [ix + 1, iy]; va = v00; vb = v10; }
    else if (edge === 1) { a = [ix + 1, iy]; b = [ix + 1, iy + 1]; va = v10; vb = v11; }
    else if (edge === 2) { a = [ix + 1, iy + 1]; b = [ix, iy + 1]; va = v11; vb = v01; }
    else { a = [ix, iy + 1]; b = [ix, iy]; va = v01; vb = v00; }
    const t = Math.abs(va - vb) < 1e-15 ? .5 : va / (va - vb);
    return { x: x0 + (a[0] + (b[0] - a[0]) * t) * dx, y: y0 + (a[1] + (b[1] - a[1]) * t) * dy };
  };
  const table = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 2], [0, 1]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[2, 1]], 12: [[3, 1]], 13: [[0, 1]], 14: [[3, 0]], 15: [] };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v0 = vals[j * nx + i], v1 = vals[j * nx + i + 1], v2 = vals[(j + 1) * nx + i + 1], v3 = vals[(j + 1) * nx + i];
      if (![v0, v1, v2, v3].every(Number.isFinite)) continue;
      const code = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0);
      const pairs = table[code]; if (!pairs || !pairs.length) continue;
      for (const [ea, eb] of pairs) segs.push([pointAt(ea, i, j), pointAt(eb, i, j)]);
      if (segs.length > 60000) break;
    }
    if (segs.length > 60000) break;
  }
  S.ui.curveCache.set(key, segs);
  if (S.ui.curveCache.size > 40) S.ui.curveCache.clear();
  return segs;
}

function traceCurveSegments(segs) {
  const key = (p) => `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)}`;
  const nodes = new Map(); // key -> {p, edges:[{to,seg}]}
  for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i];
    for (const p of [a, b]) {
      const k = key(p);
      if (!nodes.has(k)) nodes.set(k, { p, edges: [] });
    }
    const ka = key(a), kb = key(b);
    nodes.get(ka).edges.push({ to: kb, seg: i });
    nodes.get(kb).edges.push({ to: ka, seg: i });
  }
  const used = new Uint8Array(segs.length);
  const paths = [];
  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue;
    used[start] = 1;
    const first = key(segs[start][0]);
    let cur = key(segs[start][1]);
    const path = [nodes.get(first).p, nodes.get(cur).p];
    // walk forward until endpoint or branch
    for (let guard = 0; guard < segs.length + 2; guard++) {
      const node = nodes.get(cur); if (!node) break;
      const next = node.edges.find((e) => !used[e.seg]); if (!next) break;
      used[next.seg] = 1;
      path.push(nodes.get(next.to).p);
      cur = next.to;
    }
    // walk backward from first
    cur = first; let back = [];
    for (let guard = 0; guard < segs.length + 2; guard++) {
      const node = nodes.get(cur); if (!node) break;
      const next = node.edges.find((e) => !used[e.seg]); if (!next) break;
      used[next.seg] = 1;
      back.push(nodes.get(next.to).p);
      cur = next.to;
    }
    paths.push([...back.reverse(), ...path]);
  }
  return paths;
}

function drawCurveObject(ctx, o) {
  const segs = curveSegments(o);
  if (!segs.length) return;
  ctx.save();
  ctx.strokeStyle = darkenLineColor(o.style.color || '#9b6cff');
  ctx.lineWidth = Math.max(.8, o.style.width || 1.2);
  ctx.globalAlpha = o.style.opacity ?? 1;
  if (o.style.dash) ctx.setLineDash([o.style.dash, o.style.dash]);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const path of traceCurveSegments(segs)) {
    if (path.length < 2) continue;
    const pts = path.map((p) => S.renderer.toScreen(p));
    ctx.moveTo(pts[0].x, pts[0].y);
    // Catmull-Rom through the contour points; no marching-squares corners.
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      ctx.bezierCurveTo(
        p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
        p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
        p2.x, p2.y,
      );
    }
  }
  ctx.stroke();
  if (S.state.settings.labels && o.label) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity;
    for (const [a] of segs) { const p = S.renderer.toScreen(a); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); }
    if (Number.isFinite(minX)) {
      ctx.globalAlpha = .9; ctx.setLineDash([]);
      ctx.font = '600 11px Inter, "FandolHei", sans-serif';
      ctx.fillStyle = darkenLineColor(o.style.color || '#9b6cff');
      ctx.fillText(o.label, clamp((minX + maxX) / 2, 8, S.renderer.w - 30), Math.max(16, minY - 5));
    }
  }
  ctx.restore();
}

/* ------------------------------ renderer -------------------------------- */
class Renderer {
  constructor(canvas, state) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.state = state; this.w = 0; this.h = 0; this.dpr = 1;
    this.dirty = true; this.raf = 0; this.last = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
  }
  resize() {
    const parent = this.canvas.parentElement;
    const r = parent.getBoundingClientRect();
    const w = Math.max(200, r.width), h = Math.max(200, r.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    const oldW = this.w, oldH = this.h;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    if (!this.state.view.cx && !this.state.view.cy) { this.state.view.cx = w / 2; this.state.view.cy = h / 2; }
    else if (oldW && oldH) { this.state.view.cx += (w - oldW) / 2; this.state.view.cy += (h - oldH) / 2; }
    this.invalidate();
  }
  invalidate() {
    this.dirty = true;
    if (!this.raf) this.raf = requestAnimationFrame((t) => { this.raf = 0; this.draw(t); });
  }
  toScreen(p) { return { x: this.state.view.cx + p.x * this.state.view.scale, y: this.state.view.cy - p.y * this.state.view.scale }; }
  toWorld(p) { return { x: (p.x - this.state.view.cx) / this.state.view.scale, y: (this.state.view.cy - p.y) / this.state.view.scale }; }
  draw(t) {
    const ctx = this.ctx;
    const { w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const theme = S.ui.theme;
    const canvasBg = '#ffffff';
    ctx.fillStyle = canvasBg; ctx.fillRect(0, 0, w, h);
    if (S.state.settings.grid) this.drawGrid(ctx);
    if (S.state.settings.axes) this.drawAxes(ctx);
    this.drawTriangleOverlays(ctx);
    this.drawCircles(ctx);
    this.drawArcs(ctx);
    this.drawLines(ctx);
    this.drawCurves(ctx);
    this.drawTraces(ctx);
    this.drawRightAngleMarkers(ctx);
    this.drawPolygons(ctx);
    this.drawAngles(ctx);
    this.drawPoints(ctx);
    this.drawMeasures(ctx);
    this.drawTexts(ctx);
    this.drawHighlights(ctx);
    this.drawPreview(ctx);
    this.dirty = false;
    const now = performance.now();
    this.lastMs = now - (t || now);
    const fl = $('#fps-label'); if (fl) fl.textContent = `${this.lastMs.toFixed(1)} ms`;
  }
  drawGrid(ctx) {
    const { w, h } = this; const view = this.state.view;
    let step = 1;
    while (step * view.scale < 34) step *= 2;
    while (step * view.scale > 100) step /= 2;
    const x0 = this.toWorld({ x: 0, y: 0 }), x1 = this.toWorld({ x: w, y: 0 });
    const y0 = this.toWorld({ x: 0, y: 0 }), y1 = this.toWorld({ x: 0, y: h });
    const startX = Math.floor(x0.x / step) * step, endX = x1.x;
    const startY = Math.floor(y1.y / step) * step, endY = y0.y;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = S.ui.theme === 'light' ? 'rgba(190,180,160,.5)' : 'rgba(167,155,133,.45)';
    ctx.beginPath();
    for (let x = startX; x <= endX + step * .5; x += step) {
      const sx = this.toScreen({ x, y: 0 }).x;
      ctx.moveTo(Math.round(sx) + .5, 0); ctx.lineTo(Math.round(sx) + .5, h);
    }
    for (let y = startY; y <= endY + step * .5; y += step) {
      const sy = this.toScreen({ x: 0, y }).y;
      ctx.moveTo(0, Math.round(sy) + .5); ctx.lineTo(w, Math.round(sy) + .5);
    }
    ctx.stroke();
    // major lines
    ctx.strokeStyle = S.ui.theme === 'light' ? 'rgba(175,162,138,.34)' : 'rgba(150,136,112,.3)';
    ctx.beginPath();
    for (let x = Math.floor(startX / (step * 5)) * step * 5; x <= endX; x += step * 5) {
      const sx = this.toScreen({ x, y: 0 }).x;
      ctx.moveTo(Math.round(sx) + .5, 0); ctx.lineTo(Math.round(sx) + .5, h);
    }
    for (let y = Math.floor(startY / (step * 5)) * step * 5; y <= endY; y += step * 5) {
      const sy = this.toScreen({ x: 0, y }).y;
      ctx.moveTo(0, Math.round(sy) + .5); ctx.lineTo(w, Math.round(sy) + .5);
    }
    ctx.stroke();
    ctx.restore();
  }
  drawAxes(ctx) {
    const { w, h } = this; const O = this.toScreen({ x: 0, y: 0 });
    ctx.save();
    ctx.strokeStyle = 'rgba(110,113,105,.4)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(0, O.y + .5); ctx.lineTo(w, O.y + .5); ctx.moveTo(O.x + .5, 0); ctx.lineTo(O.x + .5, h); ctx.stroke();
    ctx.restore();
  }
  strokeStyle(o, selected = false) {
    if (!o.valid) return 'rgba(150,150,150,.2)';
    return darkenLineColor(o.style.color || '#3d4c63');
  }
  drawLineGeom(ctx, o, styleOverride = null, alpha = 1) {
    const g = o.g; if (!g) return;
    const a = this.toScreen(g.a); const b = this.toScreen(g.b);
    let p1 = a, p2 = b;
    if (o.type === 'line') {
      const u = { x: b.x - a.x, y: b.y - a.y }; const L = Math.hypot(u.x, u.y) || 1;
      p1 = { x: a.x - u.x / L * 6000, y: a.y - u.y / L * 6000 };
      p2 = { x: a.x + u.x / L * 6000, y: a.y + u.y / L * 6000 };
    }
    ctx.save();
    const selected = S.ui.selection.includes(o.id);
    if (selected && !styleOverride) {
      ctx.globalAlpha = .28;
      ctx.strokeStyle = '#ff7a59';
      ctx.lineWidth = Math.max(2.4, (o.style.width || 1.1) + 3.4);
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    ctx.globalAlpha = alpha * (o.style.opacity ?? 1);
    ctx.strokeStyle = styleOverride || this.strokeStyle(o);
    ctx.lineWidth = Math.max(1.3, (o.style.width || 1.1) * (o === S.ui.hover?.obj ? 1.7 : 1));
    ctx.setLineDash(o.style.dash ? [o.style.dash, o.style.dash] : []);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    if (o.type === 'vector') {
      const ang = Math.atan2(b.y - a.y, b.x - a.x); const size = 9;
      ctx.setLineDash([]); ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - size * Math.cos(ang - .4), b.y - size * Math.sin(ang - .4)); ctx.lineTo(b.x - size * Math.cos(ang + .4), b.y - size * Math.sin(ang + .4)); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  drawArcs(ctx) {
    for (const o of S.state.objects) {
      if (o.type !== 'arc' || !o.visible || !o.valid) continue;
      const c = this.toScreen(o.g.center), r = o.g.r * S.state.view.scale;
      ctx.save();
      ctx.beginPath(); ctx.arc(c.x, c.y, r, o.g.a1, o.g.a2, o.g.anticlockwise);
      if (S.ui.selection.includes(o.id)) { ctx.strokeStyle = 'rgba(255,122,89,.28)'; ctx.lineWidth = 4; ctx.stroke(); }
      ctx.strokeStyle = darkenLineColor(o.style.color || '#6d28d9');
      ctx.lineWidth = Math.max(1.3, o.style.width || 1.1);
      ctx.setLineDash(o.style.dash ? [o.style.dash, o.style.dash] : []);
      ctx.stroke(); ctx.restore();
    }
  }
  drawLines(ctx) {
    for (const o of S.state.objects) {
      if (!['line', 'segment', 'ray', 'vector'].includes(o.type) || !o.visible || !o.valid) continue;
      this.drawLineGeom(ctx, o);
    }
  }
  drawCircles(ctx) {
    for (const o of S.state.objects) {
      if (o.type !== 'circle' || !o.visible || !o.valid) continue;
      const c = this.toScreen(o.g.center); const r = o.g.r * this.state.view.scale;
      if (r < .5) continue;
      ctx.save();
      if (S.ui.selection.includes(o.id)) {
        ctx.globalAlpha = .24;
        ctx.strokeStyle = '#ff7a59';
        ctx.lineWidth = Math.max(2.2, (o.style.width || .95) + 3);
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = Math.max(o.style.opacity ?? 1, .92);
      ctx.strokeStyle = darkenLineColor(o.style.color || '#1d4ed8');
      ctx.lineWidth = Math.max(1.12, (o.style.width || .95) * (o === S.ui.hover?.obj ? 1.7 : 1));
      ctx.setLineDash(o.style.dash ? [o.style.dash, o.style.dash] : []);
      if (o.style.fill && o.style.fill !== 'transparent') { ctx.fillStyle = o.style.fill; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke();
      if (o.label) this.drawCurveLabel(ctx, c.x + r * .72, c.y - r * .72, o.label, darkenLineColor(o.style.color || '#1d4ed8'));
      ctx.restore();
    }
  }
  drawCurves(ctx) {
    for (const o of S.state.objects) {
      if (o.visible && o.valid && o.type === 'curve') drawCurveObject(ctx, o);
    }
  }
  drawTraces(ctx) {
    for (const [id, arr] of S.ui.traces) {
      if (!arr || !arr.length) continue;
      const o = objectById(S.state, id);
      const col = o?.style?.color || '#ff7a59';
      ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (arr[0].kind === 'point') {
        if (arr.length < 2) { ctx.restore(); continue; }
        ctx.globalAlpha = .42; ctx.lineWidth = 1; ctx.beginPath();
        const p0 = this.toScreen(arr[0]); ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < arr.length; i++) { const p = this.toScreen(arr[i]); ctx.lineTo(p.x, p.y); }
        ctx.stroke();
      } else {
        const view = S.state.view;
        for (const t of arr) {
          ctx.globalAlpha = .18; ctx.lineWidth = .9;
          const a = this.toScreen(t.a), b = this.toScreen(t.b), d = { x: b.x - a.x, y: b.y - a.y };
          const L = Math.hypot(d.x, d.y) || 1; const ux = d.x / L, uy = d.y / L;
          let p1 = a, p2 = b;
          if (t.kind === 'line') { const ext = 5000; p1 = { x: a.x - ux * ext, y: a.y - uy * ext }; p2 = { x: a.x + ux * ext, y: a.y + uy * ext }; }
          else if (t.kind === 'ray') { const ext = 5000; p2 = { x: a.x + ux * ext, y: a.y + uy * ext }; }
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
  drawRightAngleMarkers(ctx) {
    const seen = new Set();
    for (const o of S.state.objects) {
      if (o.type === 'point' && o.sub === 'foot' && o.valid) {
        const src = objectById(S.state, o.deps[0]);
        const base = objectById(S.state, o.deps[1]);
        if (!src?.valid || !base?.valid) continue;
        this.drawRightAngle(ctx, o.g, src.g, base.g.d, o.style.color || '#1f2937');
      }
      if (o.type === 'line' && ['perp', 'altitude'].includes(o.sub) && o.valid) {
        const src = objectById(S.state, o.deps[0]);
        const base = objectById(S.state, o.deps[1]);
        if (!src?.valid || !base?.valid) continue;
        const F = projectOnLine(src.g, base.g.a, base.g.d);
        this.drawRightAngle(ctx, F, src.g, base.g.d, o.style.color || '#1f2937');
      }
    }
  }
  drawRightAngle(ctx, F, P, baseDir, color) {
    const f = this.toScreen(F), p = this.toScreen(P);
    let n = { x: p.x - f.x, y: p.y - f.y };
    const nl = Math.hypot(n.x, n.y);
    if (nl < 5) return;
    n = { x: n.x / nl, y: n.y / nl };
    let u = { x: baseDir.x, y: -baseDir.y };
    const ul = Math.hypot(u.x, u.y);
    if (ul < 1e-8) return;
    u = { x: u.x / ul, y: u.y / ul };
    if (u.x < -1e-9 || (Math.abs(u.x) < 1e-9 && u.y < 0)) { u.x = -u.x; u.y = -u.y; }
    const s = 9.5;
    ctx.save();
    ctx.strokeStyle = darkenLineColor(color);
    ctx.lineWidth = 1.35;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(f.x + u.x * s, f.y + u.y * s);
    ctx.lineTo(f.x + (u.x + n.x) * s, f.y + (u.y + n.y) * s);
    ctx.lineTo(f.x + n.x * s, f.y + n.y * s);
    ctx.stroke();
    ctx.restore();
  }
  drawPolygons(ctx) {
    for (const o of S.state.objects) {
      if (o.type !== 'polygon' || !o.visible || !o.valid) continue;
      const pts = o.g.points.map((p) => this.toScreen(p));
      ctx.save();
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
      ctx.fillStyle = o.style.fill || 'rgba(122,162,255,.06)'; ctx.fill();
      if (S.ui.selection.includes(o.id)) { ctx.strokeStyle = 'rgba(255,122,89,.28)'; ctx.lineWidth = Math.max(2.4, (o.style.width || 1.05) + 3.2); ctx.stroke(); }
      ctx.strokeStyle = darkenLineColor(o.style.color || '#1f2937'); ctx.lineWidth = Math.max(1.3, o.style.width || 1.05); ctx.stroke();
      ctx.restore();
    }
  }
  drawTriangleOverlays(ctx) {
    for (const o of S.state.objects) {
      if (o.type !== 'triangle' || !o.visible || !o.valid || !o.g) continue;
      const m = o.g.metrics; const show = o.show || {};
      const A = this.toScreen(o.g.vertices[0]), B = this.toScreen(o.g.vertices[1]), C = this.toScreen(o.g.vertices[2]);
      ctx.save();
      if (o.style.fill && o.style.fill !== 'transparent') {
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.closePath();
        ctx.fillStyle = o.style.fill; ctx.fill();
      }
      if (show.euler && m.O && m.H && dist(m.O, m.H) > 1e-7) {
        this.drawInfiniteThrough(ctx, m.O, m.H, 'rgba(146,64,14,.92)', 1.0, [5, 4]);
      }
      if (show.ninePoint && m.N) {
        this.drawCircleGeom(ctx, m.N, m.R / 2, 'rgba(109,40,217,.78)', 1.0, [4, 5]);
      }
      if (show.circumcircle && m.O) this.drawCircleGeom(ctx, m.O, m.R, 'rgba(37,99,235,.55)', .95, []);
      if (show.incircle && m.I) this.drawCircleGeom(ctx, m.I, m.r, 'rgba(5,150,105,.65)', .95, []);
      if (show.medians) {
        for (const [P, Q] of [[o.g.vertices[0], m.Ma], [o.g.vertices[1], m.Mb], [o.g.vertices[2], m.Mc]]) this.drawSegmentGeom(ctx, P, Q, 'rgba(146,64,14,.7)', .9, [4, 5]);
      }
      if (show.altitudes) {
        for (const [P, Q] of [[o.g.vertices[0], m.feet.D], [o.g.vertices[1], m.feet.E], [o.g.vertices[2], m.feet.F]]) this.drawSegmentGeom(ctx, P, Q, 'rgba(190,18,60,.7)', .9, [4, 5]);
      }
      if (show.bisectors) {
        for (const [P, Q] of [[o.g.vertices[0], m.I], [o.g.vertices[1], m.I], [o.g.vertices[2], m.I]]) this.drawSegmentGeom(ctx, P, Q, 'rgba(15,118,110,.72)', .9, [4, 5]);
      }
      if (show.orthic) {
        const D = this.toScreen(m.feet.D), E = this.toScreen(m.feet.E), F = this.toScreen(m.feet.F);
        ctx.beginPath(); ctx.moveTo(D.x, D.y); ctx.lineTo(E.x, E.y); ctx.lineTo(F.x, F.y); ctx.closePath();
        ctx.strokeStyle = 'rgba(190,18,60,.92)'; ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]); ctx.stroke();
        this.drawRightAngle(ctx, m.feet.D, o.g.vertices[0], sub(o.g.vertices[2], o.g.vertices[1]), '#be123c');
        this.drawRightAngle(ctx, m.feet.E, o.g.vertices[1], sub(o.g.vertices[0], o.g.vertices[2]), '#be123c');
        this.drawRightAngle(ctx, m.feet.F, o.g.vertices[2], sub(o.g.vertices[1], o.g.vertices[0]), '#be123c');
        ctx.setLineDash([]); ctx.font = '600 9px "FandolHei", Inter, sans-serif';
        for (const [name, Q] of [['D', D], ['E', E], ['F', F]]) {
          ctx.beginPath(); ctx.arc(Q.x, Q.y, 3.1, 0, Math.PI * 2);
          ctx.fillStyle = '#be123c'; ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#7f1d1d'; ctx.fillText(name, Q.x + 6, Q.y - 6);
        }
      }
      ctx.restore();
    }
  }
  drawInfiniteThrough(ctx, A, B, color, width, dash) {
    const a = this.toScreen(A), b = this.toScreen(B);
    const u = { x: b.x - a.x, y: b.y - a.y }; const L = Math.hypot(u.x, u.y) || 1;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(a.x - u.x / L * 5000, a.y - u.y / L * 5000); ctx.lineTo(a.x + u.x / L * 5000, a.y + u.y / L * 5000); ctx.stroke(); ctx.restore();
  }
  drawSegmentGeom(ctx, A, B, color, width, dash) {
    const a = this.toScreen(A), b = this.toScreen(B);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
  }
  drawCircleGeom(ctx, C, r, color, width, dash) {
    const c = this.toScreen(C); const rr = r * this.state.view.scale;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, TAU); ctx.stroke(); ctx.restore();
  }
  drawPoints(ctx) {
    const pts = S.state.objects.filter((o) => o.type === 'point' && o.visible && o.valid);
    for (const o of pts) {
      const p = this.toScreen(o.g); const sel = S.ui.selection.includes(o.id); const hov = S.ui.hover?.id === o.id;
      const coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
      const center = !!o.centerKey; const r = Math.min(o.style.pointSize || 3.0, center ? 3.4 : 3.2) * (coarse ? 1.25 : 1);
      const fillColor = o.meta?.userColor ? (o.style.color || '#263342') : '#263342';
      ctx.save();
      if (sel || hov) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 4.5, 0, TAU); ctx.fillStyle = sel ? 'rgba(255,122,89,.1)' : 'rgba(79,209,197,.08)'; ctx.fill();
        ctx.strokeStyle = sel ? 'rgba(255,122,89,.46)' : 'rgba(79,209,197,.35)'; ctx.lineWidth = .8; ctx.stroke();
      }
      if (center) {
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 1.4, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = .7; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fillStyle = fillColor; ctx.fill();
      ctx.lineWidth = .8; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
      if (S.state.settings.labels) {
        const off = o.sub === 'foot' ? [10, 9] : (center ? ({ G: [6, 13], O: [6, 14], N: [-24, -6], I: [7, -7], H: [7, -8], Fe: [7, 12] }[o.centerKey] || [5, -3]) : [5, -3]);
        this.drawPointLabel(ctx, p.x + r + off[0], p.y - r + off[1], o.label, center ? (o.meta?.centerColor || o.style.color) : (o.meta?.userColor ? o.style.color : '#263342'), center);
      }
      ctx.restore();
    }
  }
  drawPointLabel(ctx, x, y, text, color, center) {
    if (!text) return;
    ctx.save();
    ctx.font = `${center ? 700 : 600} ${center ? 10.5 : 11.5}px "FandolHei", Inter, "PingFang SC", sans-serif`;
    const m = ctx.measureText(text); const w = m.width + 6; const h = 12;
    ctx.fillStyle = S.ui.theme === 'light' ? 'rgba(251,248,240,.86)' : 'rgba(245,241,232,.82)';
    this.roundRect(ctx, x - 2, y - 9, w, h, 3); ctx.fill();
    ctx.fillStyle = center ? color : (color || '#263342');
    ctx.fillText(text, x + 1, y);
    ctx.restore();
  }
  drawCurveLabel(ctx, x, y, text, color) {
    ctx.save(); ctx.font = '600 10px "FandolHei", Inter, "PingFang SC", sans-serif';
    ctx.fillStyle = darkenLineColor(color || '#58677c'); ctx.fillText(text, x, y); ctx.restore();
  }
  roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  drawAngles(ctx) {
    for (const o of S.state.objects) {
      if (o.type !== 'angle' || !o.visible || !o.valid) continue;
      const B = this.toScreen(o.g.B); const A = this.toScreen(o.g.A); const C = this.toScreen(o.g.C);
      const a1 = Math.atan2(A.y - B.y, A.x - B.x), a2 = Math.atan2(C.y - B.y, C.x - B.x);
      let start = a1, end = a2; let diff = end - start;
      while (diff <= -Math.PI) diff += TAU; while (diff > Math.PI) diff -= TAU;
      const rr = 24;
      ctx.save(); ctx.strokeStyle = darkenLineColor(o.style.color || '#b45309'); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(B.x, B.y, rr, start, start + diff, diff < 0); ctx.stroke();
      const midA = start + diff / 2;
      ctx.fillStyle = darkenLineColor(o.style.color || '#b45309'); ctx.font = '10px "SFMono-Regular", monospace';
      ctx.fillText(`${fmt(deg(o.g.value), 1)}°`, B.x + Math.cos(midA) * (rr + 15) - 10, B.y + Math.sin(midA) * (rr + 15) + 3);
      ctx.restore();
    }
  }
  measureAnchor(o) {
    if (o?.meta?.labelPos) return { x: o.meta.labelPos.x, y: o.meta.labelPos.y };
    const P = o?.g?.points || [];
    try {
      if (o.sub === 'distance' && P.length >= 2) return mid(P[0], P[1]);
      if (o.sub === 'ratio' && P.length >= 4) return mid(P[0], P[1]);
      if (o.sub === 'angle' && P.length >= 3) return P[1];
      if (o.sub === 'angle2' && o.g?.vertex) return o.g.vertex;
      if (o.sub === 'area' && P.length >= 3) return { x: P.reduce((s, p) => s + p.x, 0) / P.length, y: P.reduce((s, p) => s + p.y, 0) / P.length };
      if (o.sub === 'crossRatio' && P.length >= 4) return mid(P[1], P[2]);
    } catch {}
    return null;
  }

  drawMeasures(ctx) {
    for (const o of S.state.objects) {
      if (o.type !== 'measure' || !o.visible || !o.valid || !o.g) continue;
      let text = '', anchor = null;
      const P = o.g.points || [];
      try {
        if (o.sub === 'distance' && P.length >= 2) { text = `${fmt(dist(P[0], P[1]), 3)}`; anchor = mid(P[0], P[1]); }
        else if (o.sub === 'angle' && P.length >= 3) {
          const a = deg(directedAngle3(P[0], P[1], P[2]));
          text = `${a > 0 ? '+' : a < 0 ? '−' : ''}${fmt(Math.abs(a), 1)}°`;
          anchor = P[1];
        } else if (o.sub === 'angle2' && o.g.dirs) {
          const a = deg(directedAngle2(o.g.dirs[0], o.g.dirs[1]));
          text = `${a > 0 ? '+' : a < 0 ? '−' : ''}${fmt(Math.abs(a), 1)}°`;
          anchor = o.g.vertex;
        } else if (o.sub === 'area' && P.length >= 3) { text = `S=${fmt(polygonArea(P), 3)}`; anchor = { x: P.reduce((s, p) => s + p.x, 0) / P.length, y: P.reduce((s, p) => s + p.y, 0) / P.length }; }
        else if (o.sub === 'ratio' && P.length >= 4) { const a = dist(P[0], P[1]), b = dist(P[2], P[3]); text = `${fmt(a / b, 3)}`; anchor = mid(P[0], P[1]); }
        else if (o.sub === 'crossRatio' && P.length >= 4) { const cr = crossRatio(P[0], P[1], P[2], P[3]); const nm = o.meta?.names || ['A', 'B', 'C', 'D']; text = `(${nm[0]},${nm[1]};${nm[2]},${nm[3]})=${fmt(cr, 4)}`; anchor = mid(P[1], P[2]); }
      } catch {}
      if (!text || !anchor) continue;
      if (o.meta?.labelPos) anchor = o.meta.labelPos;
      const p = this.toScreen(anchor); const x = p.x + 10, y = p.y - 18;
      ctx.save(); ctx.font = '600 9.5px "SFMono-Regular", monospace';
      const w = ctx.measureText(text).width + 12;
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.strokeStyle = 'rgba(100,110,110,.25)'; ctx.lineWidth = 1;
      this.roundRect(ctx, x, y - 10, w, 16, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = o.style.color || '#8a641c'; ctx.fillText(text, x + 6, y + 1);
      ctx.restore();
    }
  }
  drawTexts(ctx) {
    for (const o of S.state.objects) {
      if (o.type !== 'text' || !o.visible || !o.valid) continue;
      const p = this.toScreen(o.g);
      ctx.save(); const fs = Math.max(8, Math.min(72, Number(o.style.fontSize) || 14)); ctx.font = `500 ${fs}px "FandolHei", Inter, "PingFang SC", sans-serif`; ctx.fillStyle = o.style.color || '#38465a';
      ctx.fillText(o.g.text, p.x, p.y); ctx.restore();
    }
  }
  drawHighlights(ctx) {
    const hl = S.ui.highlight;
    if (!hl) return;
    const pulse = .65 + .35 * Math.sin(performance.now() / 300);
    const ids = new Set(hl.ids || []);
    for (const o of S.state.objects) {
      if (!ids.has(o.id) || !o.valid) continue;
      if (o.type === 'point') {
        const p = this.toScreen(o.g);
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, 9 + 3 * pulse, 0, TAU); ctx.strokeStyle = `rgba(79,209,197,${.35 * pulse})`; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, TAU); ctx.fillStyle = 'rgba(79,209,197,.15)'; ctx.fill(); ctx.restore();
      } else if (['line', 'segment', 'ray', 'vector'].includes(o.type)) {
        this.drawLineGeom(ctx, o, `rgba(79,209,197,${.7 * pulse})`, 1.2);
      } else if (o.type === 'circle') {
        this.drawCircleGeom(ctx, o.g.center, o.g.r, `rgba(79,209,197,${.6 * pulse})`, 2, []);
      }
    }
    if (hl.point) {
      const p = this.toScreen(hl.point);
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(79,209,197,.4)'; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  drawPreview(ctx) {
    const tool = S.ui.tool;
    if (tool === 'select') return;
    const pending = S.ui.pending;
    const mouse = S.ui.pointer;
    if (!pending.length) return;
    const first = pending[0];
    if (['segment', 'line', 'ray', 'vector', 'perp', 'parallel', 'tangent'].includes(tool) && first.kind === 'point') {
      const p0 = objectById(S.state, first.id); if (!p0 || !p0.valid) return;
      const a = this.toScreen(p0.g);
      ctx.save(); ctx.strokeStyle = 'rgba(79,209,197,.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); ctx.restore();
    }
    if ((tool === 'circleCenter') && first.kind === 'point') {
      const p0 = objectById(S.state, first.id); if (!p0 || !p0.valid) return;
      const a = this.toScreen(p0.g); const r = Math.hypot(mouse.x - a.x, mouse.y - a.y);
      ctx.save(); ctx.strokeStyle = 'rgba(79,209,197,.4)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
}

/* helper on renderer */
Renderer.prototype.request = Renderer.prototype.invalidate;

function requestRender() { if (S.renderer) S.renderer.invalidate(); }

/* -------------------------------- HUD ----------------------------------- */
function updateHUD() {
  const count = S.state.objects.filter((o) => o.visible).length;
  const el = $('#obj-count'); if (el) el.textContent = `${count} 对象`;
  const fl = $('#fps-label'); if (fl) fl.textContent = `${S.renderer?.lastMs?.toFixed?.(1) || '0.0'} ms`;
  const zoom = $('#zoom-label'); if (zoom) zoom.textContent = `${Math.round(S.state.view.scale / 62 * 100)}%`;
  const rev = $('#revision'); if (rev) rev.textContent = `REV ${S.state.meta.revision || 0}`;
  const stats = $('#stats-label'); if (stats) stats.textContent = `${S.renderer?.lastMs?.toFixed?.(1) || '0.0'} ms · ${S.state.objects.length} NODES`;
  const triBadge = $('#tri-badge'); if (triBadge) triBadge.textContent = String(S.state.objects.filter((o) => o.type === 'triangle' && o.valid).length);
}
function syncDocName() {
  const inp = $('#doc-name'); if (inp && document.activeElement !== inp) inp.value = S.state.docName || '未命名画板';
}

/* ------------------------------ fit / view ------------------------------ */
function fitView({ padding = 70, maxScale = 110, onlySelection = false } = {}) {
  const objs = S.state.objects.filter((o) => o.valid && o.visible && (onlySelection ? S.ui.selection.includes(o.id) : true));
  const pts = [];
  for (const o of objs) {
    if (o.type === 'point') pts.push(o.g);
    else if (o.type === 'arc') { const c = X(o.g.center), r = o.g.r * S.state.view.scale; const a = { x: c.x + r * Math.cos(o.g.a1), y: c.y + r * Math.sin(o.g.a1) }; const b = { x: c.x + r * Math.cos(o.g.a2), y: c.y + r * Math.sin(o.g.a2) }; parts.push(`<path d="M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${o.g.largeArc ? 1 : 0} ${o.g.anticlockwise ? 0 : 1} ${b.x.toFixed(1)} ${b.y.toFixed(1)}" fill="none" stroke="${darkenLineColor(o.style.color || '#6d28d9')}" stroke-width="${Math.max(1.3, o.style.width || 1.1)}" ${o.style.dash ? `stroke-dasharray="${o.style.dash} ${o.style.dash}"` : ''}/>`); }
    else if (o.type === 'circle') { pts.push({ x: o.g.center.x - o.g.r, y: o.g.center.y - o.g.r }, { x: o.g.center.x + o.g.r, y: o.g.center.y + o.g.r }); }
    else if (['line', 'segment', 'ray', 'vector'].includes(o.type)) { pts.push(o.g.a, o.g.b); }
    else if (o.type === 'polygon') pts.push(...o.g.points);
    else if (o.type === 'triangle') pts.push(...o.g.vertices);
  }
  if (!pts.length) return;
  const r = S.renderer; const { w, h } = r;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const bw = Math.max(.5, maxX - minX), bh = Math.max(.5, maxY - minY);
  const scale = clamp(Math.min((w - padding * 2) / bw, (h - padding * 2) / bh), 8, maxScale);
  S.state.view.scale = scale;
  S.state.view.cx = w / 2 - ((minX + maxX) / 2) * scale;
  S.state.view.cy = h / 2 + ((minY + maxY) / 2) * scale;
  requestRender(); updateHUD(); scheduleAutosave();
}
function centerView(scale = 78) {
  const r = S.renderer;
  S.state.view.scale = scale;
  S.state.view.cx = r.w / 2;
  S.state.view.cy = r.h / 2;
  requestRender(); updateHUD();
}
function zoomAt(screen, factor) {
  const before = S.renderer.toWorld(screen);
  S.state.view.scale = clamp(S.state.view.scale * factor, 8, 420);
  S.state.view.cx = screen.x - before.x * S.state.view.scale;
  S.state.view.cy = screen.y + before.y * S.state.view.scale;
  requestRender(); updateHUD(); scheduleAutosave();
}

/* ------------------------------ render shell ---------------------------- */
function renderRail() {
  const rail = $('#rail'); if (!rail) return;
  rail.innerHTML = TOOL_GROUPS.map((g) => `<button class="rail-btn ${S.ui.group === g.id ? 'active' : ''}" data-group="${g.id}" title="${g.label}">${svg(g.icon)}<span>${g.label}</span></button>`).join('')
    + `<div class="rail-sep"></div><button class="rail-btn" id="rail-objects" title="对象列表">${svg('layers')}<span>对象</span></button><div class="rail-spacer"></div>
       <button class="rail-btn small" id="rail-theme" title="切换主题">${svg(S.ui.theme === 'ink' ? 'sun' : 'moon')}</button>
       <button class="rail-btn small" id="rail-settings" title="设置">${svg('settings')}</button>`;
  rail.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => {
    const g = TOOL_GROUPS.find((x) => x.id === b.dataset.group);
    if (!g) return;
    S.ui.group = g.id; setTool(g.tools[0].id); renderRail();
    if (window.matchMedia && window.matchMedia('(max-width:940px)').matches) openMobileTools(true);
  }));
  $('#rail-objects')?.addEventListener('click', () => openMobileObjects(true));
  $('#rail-theme')?.addEventListener('click', toggleTheme);
  $('#rail-settings')?.addEventListener('click', openSettings);
}
function renderMobileObjects() {
  const body = $('#mobile-objects-body'); if (!body) return;
  const list = S.state.objects.filter((o) => ['point', 'line', 'segment', 'ray', 'vector', 'circle', 'arc', 'polygon', 'triangle', 'text', 'curve'].includes(o.type) && o.visible);
  const count = $('#mobile-obj-count'); if (count) count.textContent = list.length + ' 个';
  if (!list.length) { body.innerHTML = '<div class="mobile-obj-empty">画板为空</div>'; return; }
  body.innerHTML = list.map((o) => `<button class="mobile-obj-row" data-mobj="${o.id}">
    <span class="obj-swatch" style="background:${o.style.color || '#263342'}"></span>
    <b>${esc(objName(o))}</b><small>${esc(objValue(o))}</small><em>${esc(TYPE_NAME[o.type])}</em>
    <span class="obj-eye" data-meye="${o.id}">${svg(o.visible ? 'eye' : 'eyeoff')}</span>
  </button>`).join('');
  body.querySelectorAll('[data-mobj]').forEach((row) => row.addEventListener('click', (e) => {
    if (e.target.closest('[data-meye]')) return;
    selectObjects([row.dataset.mobj], S.ui.multiSelect || e.shiftKey);
  }));
  body.querySelectorAll('[data-meye]').forEach((eye) => eye.addEventListener('click', (e) => {
    e.stopPropagation(); const o = objectById(S.state, eye.dataset.meye); if (!o) return;
    pushHistory(); o.visible = !o.visible; afterMutation();
  }));
}
function openMobileInspector(tab = null) {
  const ins = $('#inspector');
  if (!ins) return;
  ins.classList.remove('hidden');
  ins.classList.add('mobile-open');
  if (tab) switchTab(tab); else renderInspector();
}

function openMobileTools(open = true) {
  S.ui.mobileToolsOpen = open;
  document.body.classList.toggle('mobile-tools-open', open);
  $('#tools-panel')?.classList.toggle('mobile-open', open);
  if (open) openMobileObjects(false);
}
function openMobileObjects(open = true) {
  S.ui.mobileObjectsOpen = open;
  if (open) openMobileTools(false);
  document.body.classList.toggle('mobile-drawer-open', open);
  $('#mobile-objects')?.classList.toggle('open', open);
  if (open) renderMobileObjects();
}
function initMobileControls() {
  const bar = $('#mobile-toolbar');
  try { S.ui.mobileToolbarHidden = localStorage.getItem('geomind:mobileToolbar') === 'hidden'; } catch {}
  const apply = () => {
    bar?.classList.toggle('closed', S.ui.mobileToolbarHidden);
    $('#mobile-toolbar-open')?.toggleAttribute('hidden', !S.ui.mobileToolbarHidden);
  };
  apply();
  $('#mobile-toolbar-close')?.addEventListener('click', () => { S.ui.mobileToolbarHidden = true; try { localStorage.setItem('geomind:mobileToolbar', 'hidden'); } catch {} apply(); });
  $('#mobile-toolbar-open')?.addEventListener('click', () => { S.ui.mobileToolbarHidden = false; try { localStorage.setItem('geomind:mobileToolbar', 'shown'); } catch {} apply(); });
  $('#mobile-objects-close')?.addEventListener('click', () => openMobileObjects(false));
  $('#mobile-tools-close')?.addEventListener('click', () => openMobileTools(false));
  $('#mobile-algebra-run')?.addEventListener('click', () => { const v = $('#mobile-algebra-input')?.value || ''; algebraInputRun(v); const el = $('#mobile-algebra-input'); if (el) el.value = ''; });
  $('#mobile-algebra-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); algebraInputRun($('#mobile-algebra-input')?.value || ''); const el = $('#mobile-algebra-input'); if (el) el.value = ''; } });
  $('#mobile-algebra-script')?.addEventListener('click', openScriptEditor);
  $('#mobile-lock-free')?.addEventListener('click', toggleLockFreePoints);
  $('#mobile-clear-traces')?.addEventListener('click', () => clearTraces());
  bar?.querySelectorAll('[data-mtool]').forEach((b) => b.addEventListener('click', () => {
    const action = b.dataset.mtool;
    if (action === 'objects') return openMobileObjects(true);
    if (action === 'inspector') return openMobileInspector(S.ui.tab);
    if (action === 'library') return openMobileInspector('library');
    if (action === 'logs') return openLogs();
    if (action === 'undo') return undo();
    if (action === 'delete') {
      if (!S.ui.selection.length) return toast('先选择对象', 'warn');
      pushHistory(); removeObjects(S.state, S.ui.selection); S.ui.selection = []; afterMutation(); return;
    }
    if (action === 'fit') return fitView({ padding: 80, maxScale: 100 });
    if (action === 'zoomin' || action === 'zoomout') {
      zoomAt({ x: S.renderer.w / 2, y: S.renderer.h / 2 }, action === 'zoomin' ? 1.25 : .8);
      requestRender(); updateHUD(); return;
    }
    setTool(action);
  }));
}
function syncMultiSelect() {
  const b = $('#btn-multiselect'); if (!b) return;
  b.classList.toggle('on', !!S.ui.multiSelect);
  b.setAttribute('aria-pressed', S.ui.multiSelect ? 'true' : 'false');
  b.textContent = S.ui.multiSelect ? '多选中' : '多选';
  const hint = $('#stage-hint');
  if (hint && S.ui.tool === 'select') hint.textContent = S.ui.multiSelect ? '多选：点击累加，Shift/Ctrl 点击移除；点空白清空' : '拖动自由点，或点击对象查看属性';
}
function toggleMultiSelect() {
  S.ui.multiSelect = !S.ui.multiSelect;
  syncMultiSelect();
  toast(S.ui.multiSelect ? '多选模式已开启：点击对象累加选择' : '多选模式已关闭');
}

function renderTools() {
  const g = TOOL_GROUPS.find((x) => x.id === S.ui.group) || TOOL_GROUPS[0];
  $('#tool-group-title').textContent = g.title;
  $('#tool-group-sub').textContent = g.sub;
  const list = $('#tool-list');
  list.innerHTML = g.tools.map((t) => `<button class="tool-card ${S.ui.tool === t.id ? 'active' : ''}" data-tool="${t.id}" title="${esc(t.name)} · ${esc(t.hint)}">
    <div class="tico">${svg(t.icon)}${t.key ? `<span class="key-hint">${t.key}</span>` : ''}</div>
    <strong>${esc(t.name)}</strong><small>${esc(t.hint)}</small>
  </button>`).join('');
  if (S.ui.group === 'select') list.insertAdjacentHTML('beforeend', `
    <button class="quick-card" data-quick="triangle-panel"><span class="qk">${svg('triangle')}</span><span><strong>三角形特征点</strong><small>右侧选定三角形，按需添加五心</small></span><i>→</i></button>
    <button class="quick-card" data-quick="ai"><span class="qk accent">${svg('spark')}</span><span><strong>AI 分析</strong><small>关系 · 证明 · 自动命题</small></span><i>→</i></button>
    <button class="quick-card" data-quick="library"><span class="qk">${svg('book')}</span><span><strong>经典构型</strong><small>欧拉线 / 西姆松 / 蝴蝶</small></span><i>→</i></button>
  `);
  list.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  list.querySelectorAll('[data-quick]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.quick === 'triangle-panel') switchTab('triangle');
    else if (b.dataset.quick === 'ai') { switchTab('ai'); runLLMProof(); }
    else switchTab('library');
  }));
}
function renderToolConfig() {
  const root = $('#tool-config'); if (!root) return;
  const tool = S.ui.tool;
  if (tool === 'rotate' || tool === 'homothety') {
    const isRot = tool === 'rotate';
    root.innerHTML = `<div class="tool-config-inner"><label>${isRot ? '旋转角（度）' : '位似比 k'}</label>
      <div class="param-row"><input id="param-value" type="number" step="${isRot ? 5 : 0.1}" value="${isRot ? S.ui.toolParams.angle : S.ui.toolParams.ratio}"/>
      <button class="mini-btn" id="param-apply">应用</button></div></div>`;
    $('#param-apply')?.addEventListener('click', () => {
      const val = Number($('#param-value').value);
      if (isRot) S.ui.toolParams.angle = Number.isFinite(val) ? val : 90;
      else S.ui.toolParams.ratio = Number.isFinite(val) ? val : .5;
      toast(isRot ? `旋转角设为 ${S.ui.toolParams.angle}°` : `位似比设为 ${S.ui.toolParams.ratio}`);
    });
  } else if (tool === 'tangent') {
    root.innerHTML = `<div class="tool-config-inner"><label>圆的切线</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">点圆上一点：作该点处的切线；点圆外一点：作两条切线；圆内点无实切线。</div></div>`;
  } else if (tool === 'perpBisector') {
    root.innerHTML = `<div class="tool-config-inner"><label>中垂线</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">直接点击一条线段，或依次选择两个点。中垂线会自动经过线段中点并与线段垂直。</div></div>`;
  } else if (tool === 'isogonal') {
    root.innerHTML = `<div class="tool-config-inner"><label>等角线</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">依次点 A、顶点 B、C，再点一条过 B 的直线/射线/线段；生成它关于 ∠ABC 平分线的对称线。</div></div>`;
  } else if (tool === 'measureAngle') {
    root.innerHTML = `<div class="tool-config-inner"><label>有向角</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">三点 A → 顶点 → C：顺时针为正；两条射线：逆时针为正。图标显示 +/− 与角度值。</div></div>`;
  } else if (tool === 'equalDistancePoint') {
    root.innerHTML = `<div class="tool-config-inner"><label>等距点</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">依次点 U、B、C、A：V 在 CA 上，且 CV=BU；拖动 U 时 V 自动保持等长。</div></div>`;
  } else if (['fixedPoint', 'fixedSegment', 'fixedCircle', 'fixedAngleLine'].includes(tool)) {
    const msg = tool === 'fixedCircle'
      ? '先点圆心，再点一个长度对象（线段 / 圆 / 长度测量）。半径会随来源对象变化。'
      : tool === 'fixedAngleLine'
        ? '先点过线的点，再点基线，最后点一个角测量；也可以依次点 A、B、C 三个点定义角。'
        : '先点起点，再点方向点，最后点一个长度对象（线段 / 圆 / 长度测量）。';
    root.innerHTML = `<div class="tool-config-inner"><label>定长 / 定角</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">${msg}</div></div>`;
  } else if (tool === 'intersection') {
    root.innerHTML = `<div class="tool-config-inner"><label>交点</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">直接点击两线的交叉处：只创建点击位置的那个交点。圆与直线有两个交点时，点哪个画哪个。</div></div>`;
  } else if (['reflectLine', 'reflectPoint', 'rotate', 'translate', 'homothety', 'inversion'].includes(tool)) {
    root.innerHTML = `<div class="tool-config-inner"><label>任意对象变换</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">先点要变换的点/直线/线段/圆/多边形，再点对称轴、中心或平移向量。反演支持点、直线、线段/射线/向量、圆、多边形/三角形：线段与多边形边界会生成精确的圆弧像。</div></div>`;
  } else if (tool === 'lineBisector') {
    root.innerHTML = `<div class="tool-config-inner"><label>两条直线的角平分线</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">依次点击两条直线或线段，生成互相垂直的两条角平分线。平行线没有角平分线。</div></div>`;
  } else if (tool === 'inversion') {
    root.innerHTML = `<div class="tool-config-inner"><label>圆反演</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">选一点和一个圆：OP · OP′ = r²。圆心与点重合时退化。</div></div>`;
  } else if (tool === 'iranianInversion') {
    root.innerHTML = `<div class="tool-config-inner"><label>轴反射反演</label><div class="helper-note" style="font-size:8px;line-height:1.55;color:var(--dim);margin:0">A → B → C → P：以 A 为心、幂 AB·AC 反演，再关于 ∠A 平分线反射。B↔C。</div></div>`;
  } else if (tool === 'text') {
    root.innerHTML = `<div class="tool-config-inner"><label>标注文字</label><input id="param-text" value="${esc(S.ui.toolParams.text)}" maxlength="80"/></div>`;
    $('#param-text')?.addEventListener('input', (e) => { S.ui.toolParams.text = e.target.value; });
  } else {
    root.innerHTML = '';
  }
}

function renderAll() {
  renderRail(); renderTools(); renderToolConfig();
  renderInspector(); updateHUD(); syncDocName(); updateHistoryButtons(); requestRender();
  if (S.ui.mobileObjectsOpen) renderMobileObjects();
}

function switchTab(tab) {
  if (!LOCAL_CLIENT && (tab === 'ai' || tab === 'complex')) { toast('该功能仅在本机工作区提供', 'warn'); return; }
  S.ui.tab = tab;
  $$('#inspector-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  if (window.matchMedia && window.matchMedia('(max-width:940px)').matches) { const ins = $('#inspector'); ins?.classList.remove('hidden'); ins?.classList.add('mobile-open'); }
  renderInspector();
}
function renderInspector() {
  const body = $('#inspector-body'); if (!body) return;
  const titles = { objects: '代数区与构造', triangle: '三角形特征点', complex: '复数法验证', ai: 'AI 解题台', explore: '关系发掘与命题', library: '竞赛构型库' };
  $('#inspector-title').textContent = titles[S.ui.tab] || '几何工作台';
  if (S.ui.tab === 'objects') renderObjects();
  else if (S.ui.tab === 'triangle') renderTrianglePanel();
  else if (S.ui.tab === 'complex') renderComplexPanel();
  else if (S.ui.tab === 'ai') renderAIPanel();
  else if (S.ui.tab === 'explore') renderExplorePanel();
  else if (S.ui.tab === 'library') renderLibraryPanel();
}

/* ------------------------------ objects panel --------------------------- */
const TYPE_NAME = { point: '点', line: '直线', segment: '线段', ray: '射线', vector: '向量', circle: '圆', arc: '圆弧', polygon: '多边形', triangle: '三角形', angle: '角', measure: '测量', text: '文本', curve: '曲线' };
function objName(o) {
  if (o.type === 'curve') return o.label || (o.sub === 'conic' ? 'Γ' : 'Cu₁');
  if (o.type === 'triangle') return o.deps.map((id) => objectById(S.state, id)?.label || '?').join('');
  if (o.type === 'measure') return o.sub === 'distance' ? '长度' : o.sub === 'angle' ? '有向角' : o.sub === 'angle2' ? '两线有向角' : o.sub === 'area' ? '面积' : o.sub === 'crossRatio' ? '交比' : '线段比';
  if (o.type === 'text') return o.text;
  if (['line', 'segment', 'ray', 'vector'].includes(o.type)) {
    const A = objectById(S.state, o.deps?.[0]), B = objectById(S.state, o.deps?.[1]);
    if (A?.label && B?.label) return `${A.label}${B.label}`;
  }
  return o.label || TYPE_NAME[o.type];
}
function selectionDetail(o) {
  const deps = (o.deps || []).map((id) => objectById(S.state, id)?.label).filter(Boolean);
  const fields = [['ID', o.id], ['类型', TYPE_NAME[o.type] + (o.sub ? ' · ' + o.sub : '')], ['构造', deps.join(', ') || '—']];
  if (o.type === 'point' && o.valid) fields.push(['坐标', `(${fmt(o.g.x, 3)}, ${fmt(o.g.y, 3)})`]);
  if (o.type === 'point' && o.centerKey) fields.push(['中心', centerDef(o.centerKey).name]);
  if (o.type === 'point' && o.locked) fields.push(['状态', o.meta?.dynamicConstraint ? '由角度约束固定' : '固定，不可拖动']);
  if (o.type === 'circle' && o.valid) fields.push(['半径', fmt(o.g.r, 3)], ['圆心', `(${fmt(o.g.center.x, 3)}, ${fmt(o.g.center.y, 3)})`]);
  if (o.type === 'arc' && o.valid) fields.push(['半径', fmt(o.g.r, 3)], ['圆心', `(${fmt(o.g.center.x, 3)}, ${fmt(o.g.center.y, 3)})`]);
  if (o.type === 'triangle' && o.valid) fields.push(['类型', o.metrics.type], ['R / r', `${fmt(o.metrics.R, 2)} / ${fmt(o.metrics.r, 2)}`]);
  const color = o.style.color || '#ff7a59';
  return `<div class="hero-card">
    <div class="hero-kicker">SELECTED OBJECT</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px"><span class="obj-swatch" style="background:${color};width:9px;height:9px"></span><span style="font-size:12px;font-weight:700">${esc(objName(o))}</span><span class="tag accent">${TYPE_NAME[o.type]}</span></div>
    <label class="section-title" style="display:block;margin:8px 0 4px">名称</label>
    <input class="input" data-edit="label" value="${esc(o.label || '')}" placeholder="对象名称"/>
    ${o.type === 'text' ? `<label class="section-title" style="display:block;margin:8px 0 4px">文本内容</label><textarea class="input" data-edit="text" maxlength="200" style="height:54px;line-height:1.55">${esc(o.text || '')}</textarea><button class="btn full" data-action="edit-text" style="margin-top:5px">${svg('text')} 编辑文本…</button>` : ''}
    <div style="margin-top:7px">${fields.map(([k, v]) => `<div class="field"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="field"><span>颜色</span><div class="swatches">${PALETTE.map((c) => `<button class="swatch ${c === color ? 'on' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div></div>
    <div class="field"><span>线宽</span><input type="range" min="0.6" max="4" step=".1" value="${o.style.width || 1.7}" data-edit="width" style="width:110px;accent-color:var(--accent)"/></div>
    <div class="field"><span>线型</span><select class="input" data-edit="dash" style="width:100px;height:26px;padding:0 5px"><option value="0" ${!o.style.dash ? 'selected' : ''}>实线</option><option value="4" ${o.style.dash === 4 ? 'selected' : ''}>虚线</option><option value="2" ${o.style.dash === 2 ? 'selected' : ''}>点线</option></select></div>
    ${o.type === 'point' && o.sub === 'free' ? `<div class="field"><span>位置</span><div style="display:flex;gap:4px"><input class="input" style="width:64px;height:26px" data-edit="x" value="${fmt(o.x, 3)}"/><input class="input" style="width:64px;height:26px" data-edit="y" value="${fmt(o.y, 3)}"/></div></div>` : ''}
    ${o.type === 'text' ? `<div class="field"><span>字号</span><input class="input" type="number" min="8" max="72" step="1" data-edit="fontSize" value="${Number(o.style.fontSize) || 14}" style="width:76px;height:26px"/></div>` : ''}
    <div class="detail-actions">
      ${(o.type === 'point' || ['line', 'segment', 'ray', 'vector'].includes(o.type)) ? `<button class="btn" data-action="toggle-trace">${S.ui.traceIds.has(o.id) ? '停止轨迹' : '显示轨迹'}</button><button class="btn" data-action="clear-trace">清除轨迹</button>` : ''}
      ${o.type === 'point' ? `<button class="btn" data-action="toggle-aux-point">${o.meta?.auxiliary ? '取消辅助点' : '设为辅助点'}</button>` : ''}
      ${o.type === 'measure' ? `<button class="btn" data-action="reset-label">复位标签位置</button>` : ''}
      <button class="btn" data-action="focus">${svg('focus')} 聚焦</button>
      <button class="btn" data-action="toggle-visible">${svg(o.visible ? 'eyeoff' : 'eye')} ${o.visible ? '隐藏' : '显示'}</button>
      <button class="btn" data-action="duplicate">${svg('duplicate')} 复制</button>
      <button class="btn danger" data-action="delete">${svg('trash')} 删除</button>
    </div>
    ${o.type === 'point' && o.sub !== 'free' ? `<button class="btn full" data-action="unlock-point" style="margin-top:6px">解除约束，改为自由点</button>` : ''}
    ${o.type === 'triangle' ? `<button class="btn full" data-action="open-triangle" style="margin-top:6px">${svg('triangle')} 打开三角形面板</button>` : ''}
  </div>`;
}
function objDef(o) {
  const L = (id) => objectById(S.state, id)?.label || '?';
  if (o.type === 'point') {
    if (o.sub === 'free') return `(${fmt(o.x, 3)}, ${fmt(o.y, 3)})`;
    if (o.sub === 'midpoint') return `Midpoint(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'foot') return `Foot(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'intersection') return `Intersect(${L(o.deps[0])}, ${L(o.deps[1])}${o.branch ? ', ' + (o.branch + 1) : ''})`;
    if (o.sub === 'triangleCenter') return `Center(${L(o.deps[0])}, "${o.centerKey || 'O'}")`;
    if (o.sub === 'pointOnLine') return `Point(${L(o.deps[0])})`;
    if (o.sub === 'pointOnCircle') return `Point(${L(o.deps[0])})`;
    if (o.sub === 'angleDouble') return `AngleDouble(${L(o.deps[1])}, ${L(o.deps[2])}, ${L(o.deps[3])}, ${L(o.deps[4])}, ${L(o.deps[0])})`;
    if (o.sub === 'equalDistance') return `EqualDistance(${L(o.deps[0])}, ${L(o.deps[1])}, ${L(o.deps[2])}, ${L(o.deps[3])})`;
    if (o.sub === 'fixedDistance') return `FixedPoint(${L(o.deps[0])}, ${L(o.deps[1])}, ${L(o.deps[2])})`;
    if (o.sub === 'trapezoidEndpoint') return `TrapezoidEnd(${L(o.deps[0])}, ${L(o.deps[1])}, ${L(o.deps[2])})`;
    if (o.sub === 'reflectLine') return `Reflect(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'reflectPoint') return `Reflect(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'inversion') return `Invert(${L(o.deps[0])}, ${L(o.deps[1])})`;
  }
  if (['line', 'segment', 'ray', 'vector'].includes(o.type)) {
    const T = o.type === 'segment' ? 'Segment' : o.type === 'ray' ? 'Ray' : o.type === 'vector' ? 'Vector' : 'Line';
    if (o.sub === 'through') return `${T}(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'perp') return `PerpendicularLine(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'parallel') return `ParallelLine(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'perpbis') return `PerpendicularBisector(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'bisector') return `AngleBisector(${L(o.deps[0])}, ${L(o.deps[1])}, ${L(o.deps[2])})`;
    if (o.sub === 'bisector2') return `AngleBisector(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'isogonal') return `Isogonal(${L(o.deps[0])}, ${L(o.deps[1])}, ${L(o.deps[2])}, ${L(o.deps[3])})`;
    if (o.sub === 'fixedAngle') return `FixedAngleLine(${L(o.deps[0])}, ${L(o.deps[1])}, ${L(o.deps[2])})`;
    if (o.sub === 'fixedAngle3') return `FixedAngleLine(${L(o.deps[0])}, ${L(o.deps[1])}, ${L(o.deps[2])}, ${L(o.deps[3])}, ${L(o.deps[4])})`;
    if (o.sub === 'tangentAt') return `Tangent(${L(o.deps[1])}, ${L(o.deps[0])})`;
    if (o.sub === 'tangentFrom') return `Tangent(${L(o.deps[1])}, ${L(o.deps[0])})`;
    if (o.sub === 'altitude') return `Altitude(${L(o.deps[0])}, ${L(o.deps[1])})`;
  }
  if (o.type === 'circle') {
    if (o.sub === 'centerThrough') return `Circle(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'threePoints') return `Circle(${L(o.deps[0])}, ${L(o.deps[1])}, ${L(o.deps[2])})`;
    if (o.sub === 'diameter') return `Circle(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'radiusFrom') return `Circle(${L(o.deps[0])}, ${L(o.deps[1])})`;
    if (o.sub === 'centerRadius') return `Circle(${L(o.deps[0])}, ${fmt(o.radius || 0, 3)})`;
  }
  if (o.type === 'polygon') return `Polygon(${(o.deps || []).map(L).join(', ')})`;
  if (o.type === 'curve') return o.sub === 'conic' ? `Conic(${(o.deps || []).map(L).join(', ')})` : `QLCu1(${(o.deps || []).map(L).join(', ')})`;
  if (o.type === 'measure') return `${o.sub === 'distance' ? 'Distance' : o.sub === 'angle' ? 'Angle' : o.sub === 'angle2' ? 'Angle' : o.sub === 'area' ? 'Area' : 'Measure'}(${(o.deps || []).map(L).join(', ')})`;
  if (o.type === 'text') return `"${o.text || ''}"`;
  return TYPE_NAME[o.type] || o.type;
}

function objValue(o) {
  if (o.type === 'point' && o.valid) return `(${fmt(o.g.x, 2)}, ${fmt(o.g.y, 2)})`;
  if (o.type === 'circle' && o.valid) return `r ${fmt(o.g.r, 2)}`;
  if (o.type === 'arc' && o.valid) return `r ${fmt(o.g.r, 2)}`;
  if (['line', 'segment', 'ray', 'vector'].includes(o.type) && o.valid) return `${fmt(o.g.len, 2)}`;
  if (o.type === 'triangle' && o.valid) return o.metrics?.type || '';
  if (o.type === 'polygon' && o.valid) return `${o.g.points.length} 边`;
  if (o.type === 'curve' && o.valid) return o.sub === 'conic' ? '二次曲线' : 'QL-Cu1';
  return '';
}

/* --------------------------- algebra / scripting ------------------------- */
function splitTop(str, sep = ',') {
  const out = []; let depth = 0, quote = null, cur = '';
  for (const ch of String(str)) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim() || out.length) out.push(cur.trim());
  return out;
}
function algebraLookup(label) {
  return S.state.objects.find((o) => o.label === label) || S.state.objects.find((o) => String(o.label).toLowerCase() === String(label).toLowerCase()) || null;
}
function mathEval(expr, vars = {}) {
  const s = String(expr).replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i];
  const eat = (ch) => { if (s[i] !== ch) throw new Error(`期望 ${ch}`); i++; };
  const number = () => {
    const m = s.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!m) throw new Error('缺少数字');
    i += m[0].length; return Number(m[0]);
  };
  const primary = () => {
    if (peek() === '(') { eat('('); const v = addsub(); eat(')'); return v; }
    if (peek() === '-') { i++; return -primary(); }
    if (peek() === '+') { i++; return primary(); }
    if (/[0-9.]/.test(peek() || '')) return number();
    const m = s.slice(i).match(/^[A-Za-z_]\w*/);
    if (!m) throw new Error('表达式不完整');
    i += m[0].length;
    const name = m[0];
    if (peek() === '(') {
      eat('('); const arg = addsub(); eat(')');
      const fn = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, exp: Math.exp, log: Math.log, ln: Math.log }[name];
      if (!fn) throw new Error('未知函数 ' + name);
      return fn(arg);
    }
    if (name === 'pi' || name === 'PI') return Math.PI;
    if (name === 'e') return Math.E;
    if (name in vars) return Number(vars[name]);
    throw new Error('未知变量 ' + name);
  };
  const power = () => { const a = primary(); if (peek() === '^') { i++; return Math.pow(a, power()); } return a; };
  const muldiv = () => { let v = power(); while (peek() === '*' || peek() === '/') { const op = s[i++]; const b = power(); v = op === '*' ? v * b : v / b; } return v; };
  const addsub = () => { let v = muldiv(); while (peek() === '+' || peek() === '-') { const op = s[i++]; const b = muldiv(); v = op === '+' ? v + b : v - b; } return v; };
  const val = addsub();
  if (i !== s.length) throw new Error('表达式无法解析：' + s.slice(i));
  return val;
}
function parseTuple(str, vars = {}) {
  const t = String(str).trim();
  const m = t.match(/^\((.*)\)$/s);
  if (!m) return null;
  const parts = splitTop(m[1]);
  if (parts.length !== 2) throw new Error('点坐标需要两个分量');
  return { x: mathEval(parts[0], vars), y: mathEval(parts[1], vars) };
}
function resolvePoint(token, vars = {}) {
  const t = String(token).trim();
  const tuple = parseTuple(t, vars);
  if (tuple) return tuple;
  const o = algebraLookup(t);
  if (o?.type === 'point') return o.g || { x: o.x || 0, y: o.y || 0 };
  throw new Error('找不到点 ' + t);
}
function resolveObject(token) {
  const o = algebraLookup(String(token).trim());
  if (!o) throw new Error('找不到对象 ' + token);
  return o;
}
function algebraCreate(type, sub, deps, extra = {}) {
  const o = addObject(S.state, { type, sub, deps, ...extra });
  return o;
}
function commandName(token) {
  const m = String(token).trim().match(/^([A-Za-z_]\w*)\s*\((.*)\)$/s);
  return m ? { name: m[1].toLowerCase(), args: splitTop(m[2]) } : null;
}
function assignLabel(o, label) {
  if (!o) return;
  if (!label) return;
  const other = algebraLookup(label);
  if (other && other.id !== o.id) throw new Error('标签已存在：' + label);
  o.label = label;
}
function algebraPointId(token, vars = {}) {
  const tuple = parseTuple(String(token), vars);
  if (tuple) return addPoint(tuple.x, tuple.y, { label: uniqueLabel(S.state, nextPointLabel(S.state)), color: '#263342', pointSize: 3 }).id;
  const o = algebraLookup(String(token).trim());
  if (o?.type === 'point') return o.id;
  throw new Error('找不到点 ' + token);
}
function runAlgebraLine(line, ctx = {}) {
  const raw = String(line || '').trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('//')) return null;
  const vars = ctx.vars || {};
  const doPush = ctx.push !== false;
  let assign = null, rhs = raw;
  const eq = raw.indexOf('=');
  if (eq > 0 && !raw.slice(0, eq).includes('(')) { assign = raw.slice(0, eq).trim(); rhs = raw.slice(eq + 1).trim(); }
  const point = parseTuple(rhs, vars);
  if (point) {
    if (assign && !assign.includes('(')) {
      const exists = algebraLookup(assign);
      if (exists) {
        if (exists.type === 'point' && exists.sub === 'free') { exists.x = point.x; exists.y = point.y; return exists; }
        throw new Error('标签已存在：' + assign);
      }
      if (doPush) pushHistory();
      const p = addPoint(point.x, point.y, { label: assign, color: '#ff7a59', pointSize: 3.4 });
      return p;
    }
    if (doPush) pushHistory();
    return addPoint(point.x, point.y, { label: nextPointLabel(S.state), color: '#ff7a59', pointSize: 3.4 });
  }
  if (assign && /^[-+]?(?:\d|\.|pi|e)/.test(rhs) && !/^[A-Za-z]+\s*\(/.test(rhs)) {
    vars[assign] = mathEval(rhs, vars);
    return null;
  }
  const cmd = commandName(rhs);
  if (!cmd) throw new Error('无法识别的语句：' + raw);
  const a = cmd.args;
  const n = cmd.name;
  let created = null;
  const firstPoint = (t) => resolvePoint(t, vars);
  const firstObj = (t) => resolveObject(t);
  const lineDeps = (o) => o?.deps || [];
  switch (n) {
    case 'point': created = algebraCreate('point', 'free', [], { x: 0, y: 0, label: nextPointLabel(S.state), style: { color: '#ff7a59', pointSize: 3.4 } }); break;
    case 'segment': case 'line': case 'ray': case 'vector': {
      const paId = algebraPointId(a[0], vars), pbId = algebraPointId(a[1], vars);
      created = addLineObj(n, 'through', [paId, pbId], { color: '#3d4c63', width: 1.1 });
      break;
    }
    case 'midpoint': {
      const o = a.length === 1 ? firstObj(a[0]) : null;
      if (o) created = algebraCreate('point', 'midpoint', o.deps.slice(0, 2), { label: nextPointLabel(S.state), style: { color: '#4fd1c5', pointSize: 3 } });
      else created = algebraCreate('point', 'midpoint', [firstObj(a[0]).id, firstObj(a[1]).id], { label: nextPointLabel(S.state), style: { color: '#4fd1c5', pointSize: 3 } });
      break;
    }
    case 'intersect': {
      const o1 = firstObj(a[0]), o2 = firstObj(a[1]);
      const branch = a[2] ? Math.max(0, Math.round(mathEval(a[2], vars)) - 1) : 0;
      created = algebraCreate('point', 'intersection', [o1.id, o2.id], { branch, label: nextPointLabel(S.state), style: { color: '#fb923c', pointSize: 3 } });
      break;
    }
    case 'perpendicularline': created = algebraCreate('line', 'perp', [firstObj(a[0]).id, firstObj(a[1]).id], { label: '', style: { color: '#3d4c63', width: .95, dash: 4 } }); break;
    case 'parallelline': created = algebraCreate('line', 'parallel', [firstObj(a[0]).id, firstObj(a[1]).id], { label: '', style: { color: '#3d4c63', width: .95, dash: 4 } }); break;
    case 'perpendicularbisector': {
      const o = a.length === 1 ? firstObj(a[0]) : null;
      const deps = o ? o.deps.slice(0, 2) : [firstObj(a[0]).id, firstObj(a[1]).id];
      created = algebraCreate('line', 'perpbis', deps, { label: '', style: { color: '#3d4c63', width: .95, dash: 4 } });
      break;
    }
    case 'anglebisector': {
      if (a.length === 2) created = algebraCreate('line', 'bisector2', [firstObj(a[0]).id, firstObj(a[1]).id], { label: '', style: { color: '#3d4c63', width: .95 } });
      else created = algebraCreate('line', 'bisector', [firstObj(a[0]).id, firstObj(a[1]).id, firstObj(a[2]).id], { label: '', style: { color: '#3d4c63', width: .95 } });
      break;
    }
    case 'circle': {
      if (a.length >= 3) {
        created = addCircleObj('threePoints', [firstObj(a[0]).id, firstObj(a[1]).id, firstObj(a[2]).id], { label: 'ω' });
      } else if (parseTuple(a[1], vars) || a[1].match(/^[-+.\d]/)) {
        created = addCircleObj('centerRadius', [firstObj(a[0]).id], { label: 'ω', radius: mathEval(a[1], vars) });
      } else {
        created = addCircleObj('centerThrough', [firstObj(a[0]).id, firstObj(a[1]).id], { label: 'ω' });
      }
      break;
    }
    case 'polygon': {
      const ids = a.map((x) => firstObj(x).id);
      created = algebraCreate('polygon', 'polygon', ids, { style: { color: '#7aa2ff', width: 1.05, fill: 'rgba(122,162,255,.06)' } });
      break;
    }
    case 'distance': created = addMeasure('distance', [firstObj(a[0]).id, firstObj(a[1]).id], { x: 0, y: 0 }); break;
    case 'angle': created = addMeasure('angle', [firstObj(a[0]).id, firstObj(a[1]).id, firstObj(a[2]).id], { x: 0, y: 0 }); break;
    case 'area': created = addMeasure('area', a.map((x) => firstObj(x).id), { x: 0, y: 0 }); break;
    case 'conic': created = algebraCreate('curve', 'conic', a.map((x) => firstObj(x).id), { label: 'Γ', style: { color: '#c084fc', width: 1.15 } }); break;
    case 'qlcu1': created = algebraCreate('curve', 'qlcu1', a.map((x) => firstObj(x).id), { label: 'Cu₁', style: { color: '#f6c76b', width: 1.25 } }); break;
    case 'equaldistance': created = algebraCreate('point', 'equalDistance', [firstObj(a[0]).id, firstObj(a[1]).id, firstObj(a[2]).id, firstObj(a[3]).id], { label: nextPointLabel(S.state), style: { color: '#4fd1c5', pointSize: 3 } }); break;
    case 'fixedpoint': created = algebraCreate('point', 'fixedDistance', [firstObj(a[0]).id, firstObj(a[1]).id, firstObj(a[2]).id], { label: nextPointLabel(S.state), style: { color: '#4fd1c5', pointSize: 3 } }); break;
    case 'fixedangleline': created = algebraCreate('line', a.length >= 5 ? 'fixedAngle3' : 'fixedAngle', a.map((x) => firstObj(x).id), { label: '', style: { color: '#f6c76b', width: 1.05, dash: 4 } }); break;
    case 'setvalue': {
      const o = firstObj(a[0]); const p = parseTuple(a[1], vars);
      if (!p || o.sub !== 'free') throw new Error('SetValue 目前只支持自由点');
      o.x = p.x; o.y = p.y; created = o; break;
    }
    case 'setcolor': {
      const o = firstObj(a[0]); const m = String(a[1]).match(/["'](.*?)["']/);
      const colors = { red: '#fb7185', orange: '#ff7a59', gold: '#f6c76b', green: '#4fd1c5', blue: '#7aa2ff', violet: '#c084fc', black: '#263342', gray: '#9aa8ba' };
      o.style.color = colors[(m?.[1] || a[1]).toLowerCase()] || (m?.[1] || '#c084fc'); created = o; break;
    }
    case 'setvisible': {
      const o = firstObj(a[0]); o.visible = String(a[1]).toLowerCase() !== 'false' && String(a[1]) !== '0'; created = o; break;
    }
    case 'delete': {
      const o = firstObj(a[0]); removeObjects(S.state, [o.id]); created = null; break;
    }
    case 'zoomin': zoomAt({ x: S.renderer.w / 2, y: S.renderer.h / 2 }, 1.18); break;
    case 'zoomout': zoomAt({ x: S.renderer.w / 2, y: S.renderer.h / 2 }, .85); break;
    case 'sequence': {
      if (a.length < 4) throw new Error('Sequence(点表达式, i, 起, 止)');
      const start = Math.round(mathEval(a[2], vars)), end = Math.round(mathEval(a[3], vars));
      const vname = a[1].trim();
      for (let k = start; k <= end && k - start < 200; k++) {
        const vv = { ...vars, [vname]: k };
        const p = parseTuple(a[0], vv);
        if (!p) throw new Error('Sequence 第一项必须是点坐标');
        addPoint(p.x, p.y, { label: uniqueLabel(S.state, (a[4] ? a[4].replace(/["']/g, '') : 'P') + k), color: '#c084fc', pointSize: 2.8 });
      }
      break;
    }
    default: throw new Error('未知命令 ' + cmd.name);
  }
  if (assign && created) assignLabel(created, assign);
  return created;
}
function algebraInputRun(value = null) {
  const inp = $('#algebra-input');
  const line = String(value ?? inp?.value ?? '').trim(); if (!line) return;
  try {
    pushHistory();
    runAlgebraLine(line, { vars: {}, push: false });
    afterMutation();
    if (inp) inp.value = '';
    toast('已执行：' + line);
    renderObjects();
  } catch (e) { toast('命令错误：' + e.message, 'error'); }
}
function runScript(text) {
  const lines = String(text || '').split(/\r?\n/);
  const vars = {}; const output = [];
  pushHistory();
  let ok = true;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    try { const o = runAlgebraLine(line, { vars, push: false }); output.push(`第 ${i + 1} 行：${o ? (o.label || o.type) + ' 已创建' : '完成'}`); }
    catch (e) { output.push(`第 ${i + 1} 行错误：${e.message}`); ok = false; break; }
  }
  afterMutation();
  logAction('脚本执行：' + (ok ? '成功' : '有错误') + `（${lines.length} 行）`);
  return { ok, output };
}
function runJsScript(code, opts = {}) {
  const state = opts.state || S.state;
  const byLabel = (label) => state.objects.find((o) => o.label === label);
  const id = (label) => byLabel(label)?.id;
  const point = (label, x, y, extra = {}) => addObject(state, { type: 'point', sub: 'free', x, y, label, ...extra });
  const segment = (a, b, label = '') => addObject(state, { type: 'segment', sub: 'through', deps: [byLabel(a).id, byLabel(b).id], label });
  const line = (a, b, label = '', extra = {}) => addObject(state, { type: 'line', sub: 'through', deps: [byLabel(a).id, byLabel(b).id], label, ...extra });
  const circle3 = (a, b, c, label = '') => addObject(state, { type: 'circle', sub: 'threePoints', deps: [byLabel(a).id, byLabel(b).id, byLabel(c).id], label, style: { fill: 'transparent' } });
  const arcMid = (circleLabel, a, b, through, label) => addObject(state, { type: 'point', sub: 'midpointArc', deps: [byLabel(circleLabel).id, byLabel(a).id, ...(through ? [byLabel(through).id] : []), byLabel(b).id], label });
  const incircleTouch = (a, b, c, label) => addObject(state, { type: 'point', sub: 'incircleTouch', deps: [byLabel(a).id, byLabel(b).id, byLabel(c).id], label });
  const midpoint = (a, b, label = '') => addObject(state, { type: 'point', sub: 'midpoint', deps: [byLabel(a).id, byLabel(b).id], label });
  const rayDistance = (a, b, c, d, label = '') => addObject(state, { type: 'point', sub: 'pointOnRayDistance', deps: [byLabel(a).id, byLabel(b).id, byLabel(c).id, byLabel(d).id], label });
  const foot = (p, lineLabel, label = '') => addObject(state, { type: 'point', sub: 'foot', deps: [byLabel(p).id, byLabel(lineLabel).id], label });
  const intersection = (a, b, label = '', branch = 0) => addObject(state, { type: 'point', sub: 'intersection', deps: [byLabel(a).id, byLabel(b).id], branch, label });
  const recomputeAll = () => recompute(state);
  const bisect = (f, lo, hi, iters = 80) => {
    let flo = f(lo), fhi = f(hi);
    if (flo * fhi > 0) throw new Error('二分法区间两端同号');
    for (let i = 0; i < iters; i++) { const m = (lo + hi) / 2, fm = f(m); if (flo * fm <= 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; } }
    return (lo + hi) / 2;
  };
  const api = {
    state, byLabel, id, point, segment, line, circle3, arcMid, incircleTouch, midpoint, foot, intersection,
    rayDistance, recompute: recomputeAll, bisect, dist, angle: angleAt, cross, dot, sub, add, mul, projectOnLine,
    solve: (constraints, opts) => solveConstraints(state, constraints, opts),
    log: (...args) => console.log(...args),
  };
  if (state === S.state) pushHistory();
  const fn = new Function('api', 'state', '"use strict";\n' + code + '\n//# sourceURL=geomind-user-script.js');
  const result = fn(api, state);
  if (state === S.state) afterMutation();
  logAction('JavaScript 构造脚本执行');
  return { ok: true, result };
}

function buildScriptState(code) {
  const saved = S.state, savedGoal = S.ui.goal;
  const st = createState('AI JS 构造');
  S.state = st; S.ui.goal = null;
  try {
    runJsScript(code, { state: st });
    recompute(st);
    return { state: st, goal: S.ui.goal || null, triangleId: null, title: st.docName || 'AI JS 构造', problemText: '' };
  } catch (e) {
    console.warn('script construction failed', e);
    return null;
  } finally {
    S.state = saved; S.ui.goal = savedGoal;
  }
}

function openScriptEditor() {
  const sample = `# GeoMind 命令脚本\nP1 = (-3, 0)\nP2 = (3, 0)\nP3 = (0, 4)\nSegment(P1, P2)\nSegment(P2, P3)\nSegment(P3, P1)\nMidpoint(P1, P2)\nCircle(P1, P2)\nSequence((cos(i), sin(i)), i, 1, 12, "Q")\n`;
  const jsSample = `// JS 构造脚本：可以用二分法求条件点\nconst A = api.point('A', 0, 4);\nconst B = api.point('B', -3, 0);\nconst C = api.point('C', 3, 0);\napi.segment('A', 'B'); api.segment('B', 'C'); api.segment('C', 'A');\napi.recompute();\n// 例：令 D 在 BC 上，使 AD=4\n// D 通过 foot/pointOnLine 构造后，用 api.bisect(...) 求参数\nreturn { A: A.id, B: B.id, C: C.id };`;
  modal(`<div class="modal-head"><div><span class="eyebrow">SCRIPT</span><h3>代数 / 编程控制台</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body">
      <div class="helper-note">DSL 支持：A=(x,y)、Segment(A,B)、Line、Circle、Midpoint、Intersect、PerpendicularLine、ParallelLine、Polygon、Distance、Angle、Sequence(...)、SetColor、SetVisible、SetValue、Delete、ZoomIn/Out。JavaScript 模式可用 api.bisect(f,lo,hi)、api.solve(constraints)、api.point/line/circle3/arcMid/incircleTouch 等现场构造与二分求根。</div>
      <div class="btn-row" style="margin-bottom:5px"><label style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted)">语言 <select id="script-lang" class="input" style="height:26px"><option value="dsl">GeoMind DSL</option><option value="js">JavaScript</option></select></label></div>
      <textarea class="input" id="script-input" style="height:240px;font-family:var(--mono);font-size:10px;line-height:1.7">${esc(sample)}</textarea>
      <div class="btn-row" style="margin-top:6px"><button class="btn" id="script-example">载入示例</button><button class="btn primary" id="script-run">运行脚本</button></div>
      <pre class="script-output" id="script-output">等待运行…</pre>
    </div>
    <div class="modal-foot"><button class="btn" data-close>关闭</button></div>`,
  { width: 760, onMount: (root, close) => {
    const ta = $('#script-input', root), out = $('#script-output', root), lang = $('#script-lang', root);
    const loadSample = () => { ta.value = lang.value === 'js' ? jsSample : sample; };
    $('#script-example', root).addEventListener('click', loadSample);
    lang.addEventListener('change', loadSample);
    $('#script-run', root).addEventListener('click', () => {
      if (lang.value === 'js') {
        try {
          const r = runJsScript(ta.value);
          out.textContent = 'JavaScript 执行成功' + (r.result !== undefined ? '\n返回值：' + JSON.stringify(r.result) : '');
          renderObjects(); requestRender(); toast('JavaScript 构造完成');
        } catch (e) { out.textContent = 'JavaScript 错误：' + e.message; toast('JavaScript 错误：' + e.message, 'error'); }
        return;
      }
      const r = runScript(ta.value);
      out.textContent = r.output.join('\n');
      renderObjects();
      toast(r.ok ? '脚本执行完成' : '脚本有错误，已停止', r.ok ? undefined : 'error');
    });
  } });
}

function toggleLockFreePoints() {
  const pts = S.state.objects.filter((o) => o.type === 'point' && o.sub === 'free');
  if (!pts.length) return toast('当前画板没有自由点', 'warn');
  const allLocked = pts.every((o) => o.locked);
  pushHistory();
  for (const o of pts) o.locked = !allLocked;
  afterMutation();
  renderObjects();
  toast(allLocked ? `已解除固定 ${pts.length} 个自由点` : `已固定 ${pts.length} 个自由点`);
}

function toggleAuxiliary() {
  const aux = S.state.objects.filter((o) => o.meta?.auxiliary);
  if (!aux.length) return toast('当前画板没有辅助对象', 'warn');
  const show = aux.every((o) => !o.visible);
  for (const o of aux) o.visible = show;
  afterMutation();
  renderObjects();
  toast(show ? '已显示辅助点' : '已隐藏辅助点');
}

function renderObjects() {
  const body = $('#inspector-body'); if (!body) return;
  const counts = { point: 0, line: 0, circle: 0, triangle: 0 };
  for (const o of S.state.objects) {
    if (!o.visible) continue;
    if (o.type === 'point') counts.point++;
    else if (['line', 'segment', 'ray', 'vector'].includes(o.type)) counts.line++;
    else if (o.type === 'circle') counts.circle++;
    else if (o.type === 'triangle') counts.triangle++;
  }
  const groups = {};
  for (const o of S.state.objects) {
    if (!['point', 'line', 'segment', 'ray', 'vector', 'circle', 'arc', 'polygon', 'triangle', 'text', 'curve'].includes(o.type)) continue;
    (groups[o.type] = groups[o.type] || []).push(o);
  }
  const order = ['point', 'line', 'segment', 'ray', 'vector', 'circle', 'arc', 'polygon', 'triangle', 'text', 'curve'];
  const sel = selectedObjects()[0];
  let html = `<div class="algebra-bar"><input class="input" id="algebra-input" placeholder="输入命令：A=(1,2) / Midpoint(A,B) / Circle(A,B)" autocomplete="off"/><button class="btn primary" id="algebra-run">执行</button><button class="btn" id="algebra-script">脚本</button><button class="btn" id="algebra-aux">辅助点</button><button class="btn" id="lock-free-points">固定自由点</button><button class="btn" id="clear-traces">清轨迹</button></div>`;
  html += `<div class="stat-grid">
    ${[['点', counts.point], ['线', counts.line], ['圆', counts.circle], ['三角形', counts.triangle]].map(([k, v]) => `<div class="stat-card"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
  </div>`;
  if (sel) html += selectionDetail(sel);
  html += `<div class="obj-list-head"><span>对象</span><span>值</span><span>类型</span></div>`;
  html += `<div class="section"><div class="section-head"><span class="section-title">作图对象</span><button class="section-action" data-action="delete-all-selected">删除选中</button></div>`;
  for (const type of order) {
    const arr = groups[type]; if (!arr || !arr.length) continue;
    html += `<div class="obj-group"><div class="obj-group-head"><span>${TYPE_NAME[type].toUpperCase()}</span><i style="flex:1;height:1px;background:var(--line-soft)"></i><span>${arr.length}</span></div>`;
    for (const o of arr) {
      const color = o.style.color || '#9aa8ba';
      html += `<button class="obj-row ${S.ui.selection.includes(o.id) ? 'selected' : ''} ${o.visible ? '' : 'obj-invisible'}" data-id="${o.id}">
        <span class="obj-swatch ${['line', 'segment', 'ray', 'vector'].includes(o.type) ? 'line' : o.type === 'circle' ? 'circle' : ''}" style="background:${color};${o.type === 'circle' ? `color:${color}` : ''}"></span>
        <span class="obj-name">${esc(objName(o))}<small>${esc(objDef(o))}</small></span>
        <span class="obj-value">${esc(objValue(o))}</span>
        <span class="obj-type">${esc(TYPE_NAME[o.type])}${o.centerKey ? ' · ' + centerDef(o.centerKey).name : ''}${o.locked ? ' · 固定' : ''}${S.ui.traceIds.has(o.id) ? ' · 轨迹' : ''}</span>
        <span class="obj-eye" data-eye="${o.id}">${svg(o.visible ? 'eye' : 'eyeoff')}</span>
      </button>`;
    }
    html += `</div>`;
  }
  if (!S.state.objects.length) html += `<div class="empty-state"><div class="glyph">∅</div><h3>画板还是空的</h3><p>从左侧选择工具开始作图，或从题库载入一个经典构型。</p></div>`;
  html += `</div>`;
  body.innerHTML = html;
  bindObjectPanelEvents(body);
}
function bindObjectPanelEvents(body) {
  body.querySelectorAll('[data-id]').forEach((row) => row.addEventListener('click', (e) => {
    if (e.target.closest('[data-eye]')) return;
    selectObjects([row.dataset.id], e.shiftKey);
  }));
  body.querySelectorAll('[data-eye]').forEach((eye) => eye.addEventListener('click', (e) => {
    e.stopPropagation();
    const o = objectById(S.state, eye.dataset.eye); if (!o) return;
    pushHistory(); o.visible = !o.visible; afterMutation();
  }));
  body.querySelectorAll('[data-id]').forEach((row) => row.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-eye]')) return;
    const o = objectById(S.state, row.dataset.id); if (!o) return;
    if (o.type === 'point') openRename(o);
    else { const inp = $('#algebra-input'); if (inp) { inp.value = `${o.label || objName(o)} = ${objDef(o)}`; inp.focus(); } }
  }));
  $('#algebra-run')?.addEventListener('click', algebraInputRun);
  $('#algebra-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); algebraInputRun(); } });
  $('#algebra-script')?.addEventListener('click', openScriptEditor);
  $('#algebra-aux')?.addEventListener('click', toggleAuxiliary);
  $('#lock-free-points')?.addEventListener('click', toggleLockFreePoints);
  $('#clear-traces')?.addEventListener('click', () => clearTraces());
  body.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
    const o = selectedObjects()[0]; if (!o) return;
    pushHistory(); o.style.color = b.dataset.color;
    if (o.type === 'point') { o.meta = o.meta || {}; o.meta.userColor = true; if (o.centerKey) o.meta.centerColor = b.dataset.color; }
    afterMutation();
  }));
  body.querySelectorAll('[data-edit]').forEach((inp) => {
    const commit = () => {
      const o = selectedObjects()[0]; if (!o) return;
      pushHistory();
      if (inp.dataset.edit === 'label') o.label = uniqueLabelForEdit(o, inp.value.trim() || o.label);
      else if (inp.dataset.edit === 'width') o.style.width = Number(inp.value);
      else if (inp.dataset.edit === 'dash') o.style.dash = Number(inp.value);
      else if (inp.dataset.edit === 'x' && o.sub === 'free') o.x = Number(inp.value);
      else if (inp.dataset.edit === 'y' && o.sub === 'free') o.y = Number(inp.value);
      else if (inp.dataset.edit === 'text' && o.type === 'text') o.text = inp.value;
      else if (inp.dataset.edit === 'fontSize' && o.type === 'text') o.style.fontSize = Math.max(8, Math.min(72, Number(inp.value) || 14));
      afterMutation();
    };
    inp.addEventListener('change', commit);
    if (inp.tagName === 'INPUT' && inp.type === 'number') inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
  });
  body.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const o = selectedObjects()[0];
    switch (b.dataset.action) {
      case 'focus': if (o?.valid) { if (o.type === 'point') { S.state.view.cx = S.renderer.w / 2 - o.g.x * S.state.view.scale; S.state.view.cy = S.renderer.h / 2 + o.g.y * S.state.view.scale; requestRender(); } else fitView({ onlySelection: true }); } break;
      case 'toggle-visible': if (o) { pushHistory(); o.visible = !o.visible; afterMutation(); } break;
      case 'toggle-trace': if (traceableObject(o)) toggleTrace(o); break;
      case 'clear-trace': clearTraces(o?.id || null); break;
      case 'reset-label': if (o) { if (o.type === 'measure') { if (o.meta) delete o.meta.labelPos; } else if (o.type === 'text') { o.x = 0; o.y = 0; o.g = { kind: 'text', x: 0, y: 0, text: o.text || '' }; } afterMutation(); renderObjects(); toast('标签位置已复位'); } break;
      case 'toggle-aux-point': if (o?.type === 'point') { o.meta = o.meta || {}; o.meta.auxiliary = !o.meta.auxiliary; if (o.meta.auxiliary) o.visible = false; afterMutation(); renderObjects(); toast(o.meta.auxiliary ? '已设为辅助点并隐藏' : '已取消辅助点'); } break;
      case 'unlock-fixed': if (o?.type === 'point' && o.sub === 'free') { pushHistory(); o.locked = false; afterMutation(); renderObjects(); toast('已解除固定'); } break;
      case 'unlock-point': if (o?.type === 'point' && o.valid) { pushHistory(); o.sub = 'free'; o.deps = []; o.x = o.g.x; o.y = o.g.y; o.centerKey = null; if (o.meta) o.meta.centerColor = null; o.style.pointSize = Math.min(o.style.pointSize || 3, 3); afterMutation(); toast('已解除约束，现在可自由拖动'); } break;
      case 'duplicate': if (o) duplicateSelected(o); break;
      case 'delete': if (o) { pushHistory(); removeObjects(S.state, [o.id]); S.ui.selection = []; afterMutation(); toast('对象已删除'); } break;
      case 'open-triangle': if (o?.type === 'triangle') { S.ui.activeTriangle = o.id; switchTab('triangle'); } break;
      case 'edit-text': if (o?.type === 'text') openTextEdit(o); break;
      case 'delete-all-selected': if (S.ui.selection.length) { pushHistory(); removeObjects(S.state, S.ui.selection); S.ui.selection = []; afterMutation(); toast('已删除选中对象'); } break;
    }
  }));
}
function uniqueLabelForEdit(o, label) {
  const other = S.state.objects.find((x) => x.id !== o.id && x.label === label);
  return other ? o.label : label;
}
function duplicateSelected(o) {
  pushHistory();
  if (o.type === 'point' && o.valid) {
    const p = addPoint(o.g.x + .2, o.g.y + .2, { label: nextPointLabel(S.state), color: o.style.color });
    selectObjects([p.id]);
  } else toast('当前仅支持复制自由点', 'warn');
  afterMutation();
}

/* ---------------------------- triangle panel ---------------------------- */
function ensureActiveTriangle() {
  let tri = objectById(S.state, S.ui.activeTriangle);
  if (!tri || tri.type !== 'triangle' || !tri.valid) {
    tri = S.state.objects.find((o) => o.type === 'triangle' && o.valid) || null;
    S.ui.activeTriangle = tri?.id || null;
  }
  return tri;
}
function renderComplexPanel() {
  const body = $('#inspector-body'); if (!body) return;
  const frame = complexFrame(S.state);
  const rows = frame.rows.map((r) => `<tr><td style="color:var(--muted)">${esc(r.label)}</td><td><code>${esc(r.z.re.toFixed(5))} ${r.z.im >= 0 ? '+' : '−'} ${Math.abs(r.z.im).toFixed(5)}i</code></td><td style="color:var(--dim)">${esc(r.type)}</td></tr>`).join('');
  const goal = S.ui.goal;
  let goalHtml = '';
  if (goal) {
    goalHtml = `<div class="goal-card" style="margin-top:8px"><div class="goal-top"><span>✦</span> 当前 AI 目标</div><p class="goal-text">${esc(goalStatement(S.state, goal))}</p><div class="goal-meta"><span class="tag accent">${esc(GOAL_LABEL[goal.kind] || goal.kind)}</span></div></div>
      <button class="btn primary full" id="complex-goal-run" style="margin-top:7px">数值复验当前目标</button>
      <button class="btn full" id="complex-symbolic-run" style="margin-top:5px">符号推导恒等式</button>
      ${S.ui.complexGoalResult ? `<div class="complex-row ${S.ui.complexGoalResult.ok ? 'ok' : 'bad'}" style="margin-top:8px"><span>数值复验</span><small>${esc(S.ui.complexGoalResult.text)}</small></div>` : ''}
      ${S.ui.complexSymbolic ? `<div class="complex-row ${S.ui.complexSymbolic.ok ? 'ok' : 'bad'}" style="margin-top:6px"><span>符号推导</span><small>${esc(S.ui.complexSymbolic.ok ? '恒等式成立' : (S.ui.complexSymbolic.error || '未化简为零'))}${S.ui.complexSymbolic.latex ? '：' + esc(S.ui.complexSymbolic.latex.slice(0, 500)) : ''}</small></div>` : ''}`;
  } else {
    goalHtml = `<div class="helper-note">还没有 AI 目标。先选择对象，在下面构造与 AI 解题相同的目标，或切到「AI 解题」设置。</div>
      <div class="field" style="margin-top:7px"><span>目标类型</span><select class="input" id="complex-goal-kind" style="width:150px">${Object.entries(GOAL_LABEL).filter(([k]) => ['collinear','concyclic','perpendicular','parallel','equalLength','equalAngle','angleSum','tangent'].includes(k)).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <button class="btn full" id="complex-goal-build" style="margin-top:6px">用当前选中构造目标</button>
      <button class="btn full" id="complex-goal-ai" style="margin-top:4px">去 AI 解题设置目标</button>`;
  }
  body.innerHTML = `<div class="hero-card"><div class="hero-kicker">COMPLEX METHOD</div><p class="hero-desc">复平面取 z = x + iy。这里直接验证当前 AI 目标，不再输入 coll/cyclic 这类内部语法。</p></div>
    <div class="section-title" style="margin-top:10px">复坐标参考系</div>
    <div class="complex-table"><table><thead><tr><th>点</th><th>z</th><th>类型</th></tr></thead><tbody>${rows || '<tr><td colspan="3">暂无有效点</td></tr>'}</tbody></table></div>
    <div class="section-title" style="margin-top:12px">目标验证</div>${goalHtml}
    <div class="helper-note" style="margin-top:8px">结果是当前构型的复数数值复验，不替代纯几何证明。</div>`;
  $('#complex-goal-run')?.addEventListener('click', () => {
    S.ui.complexGoalResult = checkGoalComplex(S.ui.goal, S.state); renderComplexPanel();
  });
  $('#complex-symbolic-run')?.addEventListener('click', async () => {
    const btn = $('#complex-symbolic-run'); if (btn) btn.disabled = true;
    try {
      const stateObj = JSON.parse(serializeState(S.state));
      S.ui.complexSymbolic = await complexProve({ state: stateObj, goal: S.ui.goal });
    } catch (e) { S.ui.complexSymbolic = { ok: false, error: e.message }; }
    renderComplexPanel();
  });
  $('#complex-goal-build')?.addEventListener('click', () => {
    const kind = $('#complex-goal-kind')?.value || 'collinear';
    const g = buildGoalForKind(S.state, kind, S.ui.selection);
    if (!g) return toast('当前选择不足以构造该目标', 'warn');
    S.ui.goal = g; S.ui.complexGoalResult = null; renderComplexPanel();
  });
  $('#complex-goal-ai')?.addEventListener('click', () => switchTab('ai'));
}

function renderTrianglePanel() {
  const body = $('#inspector-body'); if (!body) return;
  const detected = findTriangles(S.state);
  const triangles = S.state.objects.filter((o) => o.type === 'triangle' && o.valid);
  const tri = ensureActiveTriangle();
  let html = '';
  if (!tri) {
    if (detected.length) {
      html += `<div class="section"><div class="section-head"><span class="section-title">检测到的三角形</span></div>`;
      for (const d of detected) html += `<button class="relation-card" data-create-tri="${d.ids.join(',')}" style="width:100%;text-align:left"><div class="rc-top"><span class="rc-kind">TRIANGLE</span><span class="rc-score">${esc(d.metrics.type)}</span></div><strong>${esc(d.labels.join(' · '))}</strong><small>点击创建三角形</small></button>`;
      html += `</div>`;
    }
    html += `<div class="empty-state"><div class="glyph">△</div><h3>还没有三角形</h3><p>使用左侧「三角形」工具选择三个点，或画三条首尾相接的线段，系统会自动识别。</p><button class="btn primary" data-action="new-triangle" style="margin-top:10px">${svg('triangle')} 选择三点创建</button></div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-create-tri]').forEach((b) => b.addEventListener('click', () => {
      const ids = b.dataset.createTri.split(',');
      pushHistory(); const t = addTriangle(S.state, ids[0], ids[1], ids[2]); S.ui.activeTriangle = t.id; afterMutation(); renderTrianglePanel(); switchTab('triangle'); toast('三角形已创建');
    }));
    $('[data-action="new-triangle"]')?.addEventListener('click', () => setTool('triangle'));
    return;
  }
  const m = tri.metrics;
  const vertices = tri.deps.map((id) => objectById(S.state, id));
  const triLabel = (t) => t.deps.map((id) => objectById(S.state, id)?.label || '?').join('');
  const picker = `<div class="section tri-picker-section"><div class="section-head"><span class="section-title">当前三角形</span><span class="section-action">${triangles.length} 个</span></div><div class="tri-picker-row"><select class="input" id="triangle-picker">${triangles.map((t) => `<option value="${t.id}" ${t.id === tri.id ? 'selected' : ''}>△ ${esc(triLabel(t))}</option>`).join('')}</select></div></div>`;
  const centerRows = CENTER_DEFS.map((def) => {
    const pid = tri.centers?.[def.key];
    const p = pid ? objectById(S.state, pid) : null;
    const has = !!(p && p.valid);
    return `<div class="center-row ${has ? 'on' : ''}" data-center-row="${def.key}">
      <span class="center-sym" style="color:${def.color};border-color:${def.color}44">${esc(def.label)}</span>
      <div class="center-info"><strong>${esc(def.name)} <span style="font-family:var(--mono);font-size:7px;color:var(--dim);font-weight:400">${esc(def.en)}</span></strong><small>${has ? `(${fmt(p.g.x, 3)}, ${fmt(p.g.y, 3)})` : def.formula}</small></div>
      ${has ? `<button class="center-add" data-center-eye="${def.key}" title="显示 / 隐藏">${svg(p.visible ? 'eye' : 'eyeoff')}</button>` : `<button class="center-add" data-center-add="${def.key}" title="添加">+</button>`}
    </div>`;
  }).join('');
  const selPoint = selectedObjects().find((o) => o.type === 'point');
  let bary = '';
  if (selPoint && selPoint.valid) {
    const b = barycentric(vertices[0].g, vertices[1].g, vertices[2].g, selPoint.g);
    const nc = nearestCenter(m, selPoint.g, 3e-3);
    if (b) bary = `<div class="section"><div class="section-head"><span class="section-title">特征点识别 · ${esc(selPoint.label)}</span></div>
      <div class="metric-strip"><span class="metric-pill">A <b>${fmt(b.A, 3)}</b></span><span class="metric-pill">B <b>${fmt(b.B, 3)}</b></span><span class="metric-pill">C <b>${fmt(b.C, 3)}</b></span></div>
      <div class="field" style="margin-top:6px"><span>最近中心</span><b>${nc ? esc(nc.name) : '不是标准中心'}</b></div></div>`;
  }
  html = picker + `<div class="hero-card">
    <div class="hero-kicker">TRIANGLE · ${esc(m.type)}</div>
    <h3 class="hero-title">${vertices.map((v) => esc(v.label)).join(' · ')}</h3>
    <div class="metric-strip" style="margin-top:8px">
      <span class="metric-pill">a <b>${fmt(m.a, 3)}</b></span><span class="metric-pill">b <b>${fmt(m.b, 3)}</b></span><span class="metric-pill">c <b>${fmt(m.c, 3)}</b></span>
      <span class="metric-pill">R <b>${fmt(m.R, 3)}</b></span><span class="metric-pill">r <b>${fmt(m.r, 3)}</b></span><span class="metric-pill">S <b>${fmt(m.area, 3)}</b></span>
    </div>
    <div class="btn-row" style="margin-top:8px">
      <button class="btn" data-action="all-centers">${svg('spark')} 全部特征点</button>
      <button class="btn" data-action="fit-triangle">${svg('fit')} 聚焦</button>
    </div>
  </div>
  <div class="section"><div class="section-head"><span class="section-title">特征点 · 15</span><span class="section-action">BARYCENTRIC</span></div>
    ${centerRows}
  </div>
  <div class="section"><div class="section-head"><span class="section-title">结构显示</span></div>
    ${toggleRow('euler', '欧拉线 O-G-H', tri.show.euler)}
    ${toggleRow('ninePoint', '九点圆', tri.show.ninePoint)}
    ${toggleRow('circumcircle', '外接圆', tri.show.circumcircle)}
    ${toggleRow('incircle', '内切圆', tri.show.incircle)}
    ${toggleRow('medians', '三条中线', tri.show.medians)}
    ${toggleRow('altitudes', '三条高线', tri.show.altitudes)}
    ${toggleRow('bisectors', '三条角平分线', tri.show.bisectors)}
    ${toggleRow('orthic', '垂足三角形', tri.show.orthic)}
    <div class="btn-row" style="margin-top:7px">
      <button class="btn" data-action="solidify-euler">${svg('line')} 固化欧拉线</button>
      <button class="btn" data-action="solidify-nine">${svg('circle')} 固化九点圆</button>
    </div>
  </div>
  ${bary}
  <div class="section"><div class="section-head"><span class="section-title">全部三角形</span><span class="section-action">${detected.length} 个</span></div>
    ${detected.map((d) => `<button class="relation-card ${d.triId === tri.id ? 'on' : ''}" data-select-tri="${d.triId || d.ids.join(',')}" style="width:100%;text-align:left"><div class="rc-top"><span class="rc-kind">△ TRIANGLE</span><span class="rc-score">${esc(d.metrics.type)}</span></div><strong>${esc(d.labels.join(' · '))}</strong></button>`).join('')}
  </div>`;
  body.innerHTML = html;
  body.querySelector('#triangle-picker')?.addEventListener('change', (e) => {
    const id = e.target.value;
    if (!objectById(S.state, id)) return;
    S.ui.activeTriangle = id; selectObjects([id]); renderTrianglePanel(); requestRender();
  });
  bindTriangleEvents(body, tri);
}
function toggleRow(key, label, on) {
  return `<div class="switch-row"><b>${esc(label)}</b><button class="toggle ${on ? 'on' : ''}" data-show="${key}" aria-label="${esc(label)}"></button></div>`;
}
function bindTriangleEvents(body, tri) {
  body.querySelectorAll('[data-center-add]').forEach((b) => b.addEventListener('click', () => {
    pushHistory(); ensureCenters(S.state, tri.id, [b.dataset.centerAdd]); afterMutation(); renderTrianglePanel(); toast('已添加特征点');
  }));
  body.querySelectorAll('[data-center-eye]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const pid = tri.centers?.[b.dataset.centerEye]; const p = pid && objectById(S.state, pid);
    if (!p) return; pushHistory(); p.visible = !p.visible; afterMutation(); renderTrianglePanel();
  }));
  body.querySelectorAll('[data-center-row]').forEach((row) => row.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const pid = tri.centers?.[row.dataset.centerRow]; const p = pid && objectById(S.state, pid);
    if (!p) return;
    selectObjects([p.id]); S.ui.activeTriangle = tri.id;
    S.state.view.cx = S.renderer.w / 2 - p.g.x * S.state.view.scale;
    S.state.view.cy = S.renderer.h / 2 + p.g.y * S.state.view.scale;
    requestRender();
  }));
  body.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => {
    pushHistory(); tri.show[b.dataset.show] = !tri.show[b.dataset.show]; afterMutation(); renderTrianglePanel();
  }));
  body.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => {
    switch (b.dataset.action) {
      case 'all-centers': pushHistory(); ensureCenters(S.state, tri.id, CENTER_DEFS.map((d) => d.key)); afterMutation(); renderTrianglePanel(); toast('已生成 15 个特征点'); break;
      case 'fit-triangle': fitView({ onlySelection: false }); break;
      case 'solidify-euler': pushHistory(); ensureEulerLine(S.state, tri.id); afterMutation(); toast('欧拉线已固化为可操作对象'); break;
      case 'solidify-nine': pushHistory(); ensureTriangleCircle(S.state, tri.id, 'ninePoint'); afterMutation(); toast('九点圆已固化'); break;
    }
  }));
  body.querySelectorAll('[data-select-tri]').forEach((b) => b.addEventListener('click', () => {
    const raw = b.dataset.selectTri;
    if (raw.startsWith('t')) S.ui.activeTriangle = raw;
    else { const ids = raw.split(','); pushHistory(); const t = addTriangle(S.state, ids[0], ids[1], ids[2]); S.ui.activeTriangle = t.id; afterMutation(); }
    renderTrianglePanel();
  }));
}

/* -------------------------------- AI panel ------------------------------- */
function parseProblemText() {
  const text = ($('#problem-text')?.value || S.ui.problemText || '').trim();
  if (!text) return toast('请先粘贴或输入题目文本', 'warn');
  S.ui.problemText = text;
  // Isogonal lines: AJ, AK symmetric about the bisector of ∠BAC.
  const iso = text.match(/([A-Z])([A-Z])\s*[、,，与和]\s*([A-Z])([A-Z])\s*关于\s*[角∠]?\s*([A-Z])([A-Z])([A-Z])\s*的?\s*平分线/);
  if (iso) {
    const [, A1, J, A2, K, B, A, C] = iso;
    const idsFor = (labels) => labels.map((l) => S.state.objects.find((o) => o.type === 'point' && o.label === l && o.valid)?.id);
    const a1 = idsFor([B, A, J]), a2 = idsFor([K, A, C]);
    if (A1 !== A2) return toast('等角线需要共享同一个顶点', 'warn');
    if (a1.every(Boolean) && a2.every(Boolean)) {
      const idsForPoint = (label) => S.state.objects.find((o) => o.type === 'point' && o.label === label && o.valid)?.id;
      S.ui.goal = {
        kind: 'isogonal', source: 'text',
        vertexId: idsForPoint(A), arm1Id: idsForPoint(B), arm2Id: idsForPoint(C),
        jId: idsForPoint(J), kId: idsForPoint(K),
        ids: [A, B, C, J, K].map(idsForPoint).filter(Boolean),
        title: `证明 ${A1}${J}、${A2}${K} 关于 ∠${B}${A}${C} 平分线对称`,
        problemText: text,
      };
      S.ui.proof = null; S.ui.aiResult = null; renderAIPanel();
      toast('已识别等角线关系：∠' + B + A + J + ' = ∠' + K + A + C, 'info');
      return;
    }
    return toast(`识别到等角线，但画板缺少点 ${[B, A, J, K, C].filter((l) => !S.state.objects.some((o) => o.type === 'point' && o.label === l)).join('、')}`, 'warn');
  }
  const kindMap = [
    ['concyclic', ['共圆', '四点共圆', '同圆']],
    ['collinear', ['共线', '三点共线']],
    ['concurrent', ['共点', '三线共点', '交于一点']],
    ['perpendicular', ['垂直', '⟂']],
    ['parallel', ['平行', '∥']],
    ['midpoint', ['中点']],
    ['tangent', ['相切', '切线']],
    ['equalLength', ['等长', '相等']],
    ['equalAngle', ['等角', '角相等']],
  ];
  let kind = null;
  for (const [k, words] of kindMap) if (words.some((w) => text.includes(w))) { kind = k; break; }
  if (!kind) return toast('未能识别目标类型；可手动选择下方目标类型', 'warn');
  const goalPart = text.split(/证明|求证|试证|判断|求/).pop() || text;
  let allLabels = [...new Set((goalPart.match(/[A-Z](?:_[A-Z]|[0-9]|′|')?/g) || []))];
  if (allLabels.length < 3) allLabels = [...new Set((text.match(/[A-Z](?:_[A-Z]|[0-9]|′|')?/g) || []))];
  const existing = allLabels.filter((l) => S.state.objects.some((o) => o.type === 'point' && o.label === l && o.valid));
  let ids = existing.map((l) => S.state.objects.find((o) => o.type === 'point' && o.label === l).id);
  if (ids.length < 2) ids = S.ui.selection.filter((id) => objectById(S.state, id)?.type === 'point');
  if (kind === 'perpendicular' || kind === 'parallel' || kind === 'concurrent') {
    const lineIds = S.ui.selection.filter((id) => ['line', 'segment', 'ray', 'vector'].includes(objectById(S.state, id)?.type));
    if (lineIds.length >= (kind === 'concurrent' ? 3 : 2)) {
      if (kind === 'concurrent') S.ui.goal = { kind, lineIds: lineIds.slice(0, 3), source: 'text', title: '证明三线共点', problemText: text };
      else S.ui.goal = { kind, lineIds: lineIds.slice(0, 2), source: 'text', title: kind === 'parallel' ? '证明两线平行' : '证明两线垂直', problemText: text };
      S.ui.proof = null; S.ui.aiResult = null; renderAIPanel(); toast('已从题目文本识别目标'); return;
    }
    return toast('需要在画板中先选中两条（或三条）直线，再解析文本', 'warn');
  }
  if (kind === 'tangent') {
    const lines = S.ui.selection.map((id) => objectById(S.state, id)).filter((o) => o?.type === 'line' || o?.type === 'segment');
    const circles = S.ui.selection.map((id) => objectById(S.state, id)).filter((o) => o?.type === 'circle');
    if (lines.length && circles.length) { S.ui.goal = { kind, lineId: lines[0].id, circleId: circles[0].id, source: 'text', title: '证明直线与圆相切', problemText: text }; S.ui.proof = null; S.ui.aiResult = null; renderAIPanel(); return; }
    return toast('请先选中一条直线和一个圆，再解析', 'warn');
  }
  if (kind === 'midpoint') {
    if (ids.length >= 3) { S.ui.goal = { kind, pointId: ids[0], pairIds: [ids[1], ids[2]], source: 'text', title: '证明中点', problemText: text }; S.ui.proof = null; S.ui.aiResult = null; renderAIPanel(); toast('已识别中点目标'); }
    else toast('文本中未找到足够点；可先选中一个中点与两个端点', 'warn');
    return;
  }
  const need = kind === 'collinear' ? 3 : kind === 'concyclic' ? 4 : 2;
  if (ids.length < need) return toast(`识别到 ${ids.length} 个点，${GOAL_LABEL[kind]}至少需要 ${need} 个`, 'warn');
  if (kind === 'equalLength') {
    if (ids.length < 4) return toast('等长目标需要四个点或两条线段', 'warn');
    S.ui.goal = { kind, pairs: [[ids[0], ids[1]], [ids[2], ids[3]]], source: 'text', title: '证明两线段等长', problemText: text };
  } else if (kind === 'equalAngle') {
    if (ids.length < 6) return toast('等角目标需要六个点（两组三点）', 'warn');
    S.ui.goal = { kind, angles: [ids.slice(0, 3), ids.slice(3, 6)], source: 'text', title: '证明两角相等', problemText: text };
  } else {
    S.ui.goal = { kind, ids: ids.slice(0, need), source: 'text', title: GOAL_LABEL[kind], problemText: text };
  }
  S.ui.proof = null; S.ui.aiResult = null; renderAIPanel(); toast('已从题目文本识别目标');
}

function proofGeometrySummary() {
  const st = S.state; if (!st) return '';
  const pts = st.objects.filter((o) => o.type === 'point' && o.valid).map((o) => `${o.label || o.id}=(${fmt(o.g.x, 4)}, ${fmt(o.g.y, 4)})${o.centerKey ? ' ' + centerDef(o.centerKey).name : ''}`);
  const lines = st.objects.filter((o) => ['line', 'segment', 'ray', 'vector'].includes(o.type) && o.valid).map((o) => {
    const A = objectById(st, o.deps?.[0]), B = objectById(st, o.deps?.[1]);
    return `${TYPE_NAME[o.type]} ${A?.label || '?'}${B?.label || '?'}`;
  });
  const circles = st.objects.filter((o) => o.type === 'circle' && o.valid).map((o) => `${o.label || '圆'}(O=(${fmt(o.g.center.x, 4)},${fmt(o.g.center.y, 4)}),r=${fmt(o.g.r, 4)})`);
  const goal = S.ui.goal ? goalStatement(st, S.ui.goal) : '';
  return [`画板: ${st.docName}`, `点: ${pts.join('; ')}`, `线: ${lines.join('; ')}`, `圆: ${circles.join('; ')}`, goal ? `目标: ${goal}` : ''].filter(Boolean).join('\n');
}

function mdLite(md) {
  return esc(String(md || ''))
    .replace(/^###\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^##\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}

function downloadProofPDF() {
  const b64 = S.ui.llmProof?.pdf;
  if (!b64) return toast('本次证明没有生成 PDF', 'warn');
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = S.ui.llmProof.pdfName || 'geomind-proof.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('证明 PDF 已开始下载');
  } catch (e) { toast('PDF 下载失败：' + e.message, 'error'); }
}

function proofFigureDataUrl() {
  const board = $('#board');
  if (!board || !board.width || !board.height) return null;
  try {
    const max = 1200;
    const k = Math.min(1, max / Math.max(board.width, board.height));
    const w = Math.max(1, Math.round(board.width * k));
    const h = Math.max(1, Math.round(board.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(board, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.82);
  } catch { return null; }
}

async function runLLMProof(textOverride = null) {
  if (S.ui.llmBusy) return;
  const text = String(textOverride ?? $('#problem-text')?.value ?? S.ui.problemText ?? '').trim() || S.ui.problemText || '';
  if (!text && !S.ui.goal) { switchTab('ai'); return toast('请先输入题目，或从画板/探索设置目标', 'warn'); }
  S.ui.llmBusy = true; S.ui.llmProof = null; S.ui.llmError = ''; S.ui.llmElapsed = 0; S.ui.llmStartedAt = performance.now();
  switchTab('ai'); renderAIPanel();
  const timer = setInterval(() => {
    const el = $('#llm-busy-elapsed');
    if (el && S.ui.llmStartedAt) el.textContent = Math.max(0, Math.round((performance.now() - S.ui.llmStartedAt) / 1000)) + 's';
  }, 1000);
  S.ui._llmTimer = timer;
  try { await health(); } catch {
    clearInterval(S.ui._llmTimer); S.ui._llmTimer = null;
    S.ui.llmBusy = false;
    S.ui.llmError = '后端未连接：请确认服务正在运行（或稍后重试）。';
    renderAIPanel();
    logAction('纯几何证明失败：后端未连接');
    return toast(S.ui.llmError, 'error');
  }
  const t0 = performance.now();
  try {
    const image = proofFigureDataUrl();
    const payload = {
      problem_text: text,
      goal: S.ui.goal ? { kind: S.ui.goal.kind, statement: goalStatement(S.state, S.ui.goal), title: S.ui.goal.title || '' } : null,
      geometry: proofGeometrySummary(),
    };
    if (image) payload.image = image;
    const r = await apiProof(payload);
    if (!r.ok) throw new Error(r.error || '大模型证明失败');
    S.ui.llmProof = r;
    S.ui.llmElapsed = Math.round(performance.now() - t0);
    S.ui.problemText = text;
    toast(`纯几何证明已生成 · ${(r.data?.title || '完成').slice(0, 40)}`);
  } catch (e) {
    S.ui.llmError = e.message || String(e);
    logAction('纯几何证明失败：' + S.ui.llmError);
    toast('纯几何证明失败：' + S.ui.llmError, 'error');
  } finally {
    clearInterval(S.ui._llmTimer); S.ui._llmTimer = null;
    S.ui.llmBusy = false; renderAIPanel();
  }
}

function llmProofCard() {
  if (S.ui.llmBusy) {
    return `<div class="llm-proof-card busy"><div class="llm-proof-head"><span class="orb"></span><b>正在生成纯几何证明</b><span>THINKING · <i id="llm-busy-elapsed">0s</i></span></div><p class="llm-proof-note">后端模型正在深度推理；思考 token 通常占大头，可能需要 1–5 分钟，之后还要编译 PDF。不会用本地模板伪造证明。</p></div>`;
  }
  if (S.ui.llmError) {
    return `<div class="llm-proof-card error"><div class="llm-proof-head"><b>纯几何证明失败</b><span>LLM</span></div><p class="llm-proof-note">${esc(S.ui.llmError)}</p><div class="btn-row" style="margin-top:7px"><button class="btn primary" data-action="run-proof">重试证明</button><button class="btn" data-action="open-logs">查看日志</button></div></div>`;
  }
  const r = S.ui.llmProof; if (!r?.data) return '';
  const d = r.data;
  const pdfBtn = r.pdf ? `<button class="btn primary" data-action="download-proof-pdf">${svg('download')} 下载证明 PDF</button>` : '';
  return `<div class="llm-proof-card">
    <div class="llm-proof-head"><b>${esc(d.title || '纯几何证明')}</b><span>${esc(r.model || 'LLM')} · THINKING</span></div>
    <div class="llm-proof-meta">${esc(d.statement || '')}${r.elapsedMs ? ` <i>· ${(r.elapsedMs / 1000).toFixed(1)} s</i>` : ''}</div>
    <div class="llm-proof">${mdLite(d.proof_markdown || '')}</div>
    <div class="btn-row" style="margin-top:8px">${pdfBtn}<button class="btn" data-action="copy-llm-proof">${svg('copy')} 复制证明</button><button class="btn" data-action="open-logs">运行日志 / 思考</button></div>
    ${r.pdfError ? `<div class="helper-note" style="color:var(--danger)">PDF 编译提示：${esc(r.pdfError).slice(0, 300)}</div>` : ''}
  </div>`;
}

function renderAIPanel() {
  const body = $('#inspector-body'); if (!body) return;
  const goal = S.ui.goal;
  const res = S.ui.aiResult;
  const busy = S.ui.aiBusy;
  let html = `<div class="ai-status"><span class="orb"></span><span><b>神经符号推理内核</b><br/>${S.ui.backend.online ? '高精度后端已连接 · 50 dps 验证' : '离线模式 · 浏览器数值内核'}</span><span class="st">${S.ui.backend.online ? 'ONLINE' : 'LOCAL'}</span></div>`;
  if (!goal) {
    const inferred = inferGoalFromSelection(S.state, S.ui.selection);
    html += `<div class="hero-card"><div class="hero-kicker">GOAL BUILDER</div><h3 class="hero-title">把题目交给纯几何大模型</h3><p class="hero-desc">粘贴原题直接生成纯几何证明；后端 deepseek-v4.1-flash 开启 thinking，返回证明全文与可下载 PDF。本地只做数值验证。</p></div>`;
    if (inferred) html += `<div class="goal-card"><div class="goal-top"><span>✦</span> 从当前选择推断</div><p class="goal-text">${esc(goalStatement(S.state, inferred))}</p><div class="goal-meta"><span class="tag accent">${GOAL_LABEL[inferred.kind] || inferred.kind}</span><span class="tag">${S.ui.selection.length} 个对象</span></div><button class="run-btn" data-action="use-inferred">使用这个目标 →</button></div>`;
    html += `<div class="section"><div class="section-head"><span class="section-title">题目文本 · 直接交给 AI</span></div>
      <textarea class="input" id="problem-text" placeholder="粘贴完整题目。文本会原样发给后端大模型，不做离线猜测。" style="height:72px">${esc(S.ui.problemText || '')}</textarea>
      <button class="run-btn" data-action="proof-from-text" style="margin-top:6px">${svg('spark')} 直接生成纯几何证明</button>
      <div class="helper-note">不进行离线命题解析。模型会按题目原文理解，并把完整证明和 PDF 一起返回。</div>
    </div>` + llmProofCard();
    html += `<div class="section"><div class="section-head"><span class="section-title">手动设定目标</span></div>
      <div class="field"><span>目标类型</span><select class="input" id="goal-kind" style="width:150px">${Object.entries(GOAL_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <button class="btn full" data-action="goal-from-selection" style="margin-top:7px">用当前选中构造目标</button>
      <div class="helper-note" style="font-size:8px;color:var(--dim);line-height:1.7;margin-top:7px">共线 3 点 · 共圆 4 点 · 平行/垂直 2 线 · 共点 3 线 · 中点 3 点（第 1 个为中点）· 等长 4 点 · 等角线 5 点（顶点、两角边、两线点）· 相切 线+圆。</div>
    </div>`;
    html += `<div class="section"><div class="section-head"><span class="section-title">或者载入经典目标</span></div>
      ${['euler-ninepoint', 'simson', 'butterfly'].map((id) => { const sc = scenarioById(id); return `<button class="relation-card" data-load-scenario="${id}" style="width:100%;text-align:left"><div class="rc-top"><span class="rc-kind">${esc(sc.category)}</span><span class="rc-score">${'★'.repeat(sc.difficulty)}</span></div><strong>${esc(sc.title)}</strong><small>${esc(sc.description)}</small></button>`; }).join('')}
    </div>`;
    body.innerHTML = html;
    bindAIPanelEvents(body);
    return;
  }
  const stmt = goalStatement(S.state, goal);
  html += `<div class="goal-card"><div class="goal-top"><span>⊢</span> 待证目标 <span style="margin-left:auto;color:var(--dim)">${esc(goal.source || 'custom')}</span></div><p class="goal-text">${esc(stmt)}</p><div class="goal-meta"><span class="tag accent">${esc(GOAL_LABEL[goal.kind] || goal.kind)}</span>${goal.theorem ? `<span class="tag blue">${esc(goal.theorem)}</span>` : ''}${goal.scenarioId ? `<span class="tag">${esc(goal.scenarioId)}</span>` : ''}</div></div>`;
  html += `<div class="section"><div class="section-head"><span class="section-title">题目原文（可选）</span></div><textarea class="input" id="problem-text" placeholder="可粘贴原题，模型会结合目标与画板证明" style="height:58px">${esc(S.ui.problemText || '')}</textarea></div>`;
  html += `<div class="btn-row"><button class="btn" data-action="clear-goal">清除</button><button class="btn" data-action="goal-from-selection">重设目标</button></div>`;
  html += `<button class="run-btn" data-action="run-proof" ${S.ui.llmBusy ? 'disabled' : ''}>${S.ui.llmBusy ? '<span class="orb" style="width:13px;height:13px"></span> 纯几何证明生成中…' : `${svg('spark')} 生成纯几何证明 · 大模型`}</button>`;
  html += `<div class="btn-row"><button class="btn" data-action="run-ai" ${busy ? 'disabled' : ''}>${busy ? '数值验证中…' : '仅数值验证'}</button><button class="btn" data-action="proof-from-text">用题目文本重证</button></div>`;
  html += llmProofCard();
  if (!res) {
    html += `<div class="empty-state"><div class="glyph">⊢</div><h3>目标已就绪</h3><p>点击上方按钮：扫描图形关系 → 数值稳定性检验 → 高精度后端复核 → 生成综合法与计算法双解。</p></div>`;
  } else {
    const v = res.verification || {}; const stable = v.stability;
    const ok = res.status === 'verified';
    const unstable = res.status === 'unstable';
    const cls = ok ? 'ok' : unstable ? 'warn' : 'bad';
    const title = ok ? '结论成立' : unstable ? '当前构型成立' : '当前图形不满足目标';
    const sub = unstable ? '微扰检验未通过：结果依赖当前自由点位置' : `${S.ui.backend.online ? '后端高精度复核' : '本地数值复核'} · 残差 ${fmt(v.residual ?? 0, 10)}`;
    html += `<div class="verdict ${cls}"><span class="verdict-icon">${ok ? '✓' : unstable ? '~' : '!'}</span><div><strong>${title}</strong><small>${sub}</small></div><div class="confidence"><b>${res.confidence.toFixed(1)}</b><small>CONFIDENCE</small></div></div>`;
    html += `<div class="solution-tabs">${[['verdict', '结论'], ['synthetic', '综合法'], ['compute', '计算法'], ['log', '验证日志']].map(([k, l]) => `<button data-stab="${k}" class="${S.ui.solutionTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    if (S.ui.solutionTab === 'verdict') {
      html += `<div class="proof-card"><h4>稳定性检验 <span>${stable?.stable === true ? 'STABLE' : stable?.stable === null ? 'VIRTUAL' : 'CHECK'}</span></h4><p>${stable?.stable === true ? `在 ${stable.samples?.length || 0} 组随机微扰下结论保持；最坏残差 ${fmt(stable.worst, 10)}。` : stable?.stable === null ? '该目标包含由三角形派生出的虚拟点，只做当前构型的精确验证；拖动画板后请重新运行。' : '未通过微扰复验，结论可能只在当前坐标下偶然成立。'}</p></div>`;
      html += `<div class="proof-card"><h4>结论摘要 <span>${esc(res.theorem || 'GEOMIND')}</span></h4><p>${esc(res.synthetic?.summary || '')}</p></div>`;
      html += `<div class="btn-row"><button class="btn primary" data-action="add-conclusion">${svg('plus')} 把结论加入画板</button><button class="btn" data-action="copy-proof">${svg('copy')} 复制证明</button></div>`;
      html += `<div class="section" style="margin-top:10px"><div class="section-head"><span class="section-title">核心检验</span></div><div class="field"><span>残差 / 阈值</span><b>${fmt(v.residual, 9)} / ${fmt(v.threshold, 1)}</b></div><div class="field"><span>稳定性</span><b>${stable?.stable === true ? '通过' : stable?.stable === null ? '虚拟点' : '待检查'}</b></div><div class="field"><span>验证方式</span><b>${S.ui.backend.online ? '50 dps 高精度' : '双精度 + 微扰'}</b></div></div>`;
    } else if (S.ui.solutionTab === 'synthetic') {
      const sy = res.synthetic;
      html += `<div class="proof-card"><h4>${esc(sy.theorem)} <span>${sy.complete ? 'SYNTHETIC' : 'STRATEGY'}</span></h4><p>${esc(sy.summary)}</p></div>`;
      html += (sy.steps || []).map((s, i) => `<div class="proof-step"><span class="step-num">${i + 1}</span><p>${esc(s)}</p></div>`).join('');
      if (!sy.complete) html += `<div class="proof-card" style="border-color:rgba(246,199,107,.28);background:rgba(246,199,107,.04)"><h4>严格性说明 <span>CAUTION</span></h4><p>${esc(sy.caution)}</p></div>`;
      html += `<div class="btn-row" style="margin-top:8px"><button class="btn" data-action="copy-proof">${svg('copy')} 复制综合法</button></div>`;
    } else if (S.ui.solutionTab === 'compute') {
      html += `<div class="proof-card"><h4>${esc(res.computation.title)} <span>COMPUTE</span></h4><div class="computation">${(res.computation.lines || []).map(esc).join('\n')}</div></div>`;
      if (S.ui.backendResult) {
        html += `<div class="proof-card"><h4>后端高精度复核 <span>${esc(S.ui.backendResult.precision || '')}</span></h4><div class="computation">${(S.ui.backendResult.computation || []).map(esc).join('\n')}</div></div>`;
      }
    } else {
      html += `<div class="proof-card"><h4>验证日志 <span>TRACE</span></h4><div class="field"><span>本地残差</span><b>${fmt(v.residual, 12)}</b></div><div class="field"><span>后端残差</span><b>${S.ui.backendResult ? esc(S.ui.backendResult.residualText) : '未连接'}</b></div><div class="field"><span>后端耗时</span><b>${S.ui.backendResult ? S.ui.backendResult.elapsedMs + ' ms' : '—'}</b></div><div class="field"><span>缓存</span><b>${S.ui.backendResult?.cached ? '命中' : '—'}</b></div></div>`;
      html += (S.ui.backendResult?.checks || []).map((c) => `<div class="field"><span>${esc(c.name)}</span><b>${esc(c.value)}</b></div>`).join('');
      html += `<div class="proof-card"><h4>微扰样本 <span>${stable?.samples?.length || 0}</span></h4><div class="computation">${(stable?.samples || []).map((s, i) => `#${i + 1}  residual=${fmt(s.residual, 10)}  ${s.ok ? 'PASS' : 'FAIL'}`).join('\n') || '无自由点'}</div></div>`;
    }
  }
  body.innerHTML = html;
  bindAIPanelEvents(body);
}
function bindAIPanelEvents(body) {
  const pt = $('#problem-text');
  if (pt) pt.addEventListener('input', (e) => { S.ui.problemText = e.target.value; });
  body.querySelectorAll('[data-load-scenario]').forEach((b) => b.addEventListener('click', () => loadScenario(b.dataset.loadScenario)));
  body.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => {
    switch (b.dataset.action) {
      case 'use-inferred': { const g = inferGoalFromSelection(S.state, S.ui.selection); if (g) { S.ui.goal = g; S.ui.proof = null; S.ui.aiResult = null; renderAIPanel(); } break; }
      case 'proof-from-text': runLLMProof($('#problem-text')?.value || ''); break;
      case 'run-proof': runLLMProof(); break;
      case 'download-proof-pdf': downloadProofPDF(); break;
      case 'open-logs': openLogs(); break;
      case 'copy-llm-proof': if (S.ui.llmProof?.data?.proof_markdown) navigator.clipboard?.writeText(S.ui.llmProof.data.proof_markdown).then(() => toast('证明已复制')).catch(() => toast('复制失败', 'error')); break;
      case 'parse-problem': parseProblemText(); break;
      case 'goal-from-selection': {
        const kind = $('#goal-kind')?.value || 'collinear';
        const g = buildGoalForKind(S.state, kind, S.ui.selection);
        if (!g) return toast('当前选择不足以构造该目标，请检查对象数量/类型', 'warn');
        S.ui.goal = g; S.ui.proof = null; S.ui.aiResult = null; S.ui.solutionTab = 'verdict'; renderAIPanel(); toast(`已设定目标：${GOAL_LABEL[kind]}`);
        break;
      }
      case 'clear-goal': S.ui.goal = null; S.ui.aiResult = null; S.ui.backendResult = null; S.ui.proof = null; renderAIPanel(); break;
      case 'run-ai': runAI(); break;
      case 'add-conclusion': addConclusionToCanvas(); break;
      case 'copy-proof': copyProof(); break;
    }
  }));
  body.querySelectorAll('[data-stab]').forEach((b) => b.addEventListener('click', () => { S.ui.solutionTab = b.dataset.stab; renderAIPanel(); }));
}

/* ------------------------------ explore panel ---------------------------- */
const CAT_LABEL = { collinear: '共线', concyclic: '共圆', parallel: '平行', perpendicular: '垂直', concurrent: '共点', equalLength: '等长', equalAngle: '等角', midpoint: '中点', tangent: '相切', ratio: '比例', identity: '恒等式', center: '特征点' };
function renderExplorePanel() {
  const body = $('#inspector-body'); if (!body) return;
  let html = `<div class="seg" style="margin-bottom:10px"><button data-explore-tab="relations" class="${S.ui.exploreTab === 'relations' ? 'on' : ''}">关系发掘</button><button data-explore-tab="generate" class="${S.ui.exploreTab === 'generate' ? 'on' : ''}">自动命题</button></div>`;
  if (S.ui.exploreTab === 'relations') {
    html += `<div class="hero-card"><div class="hero-kicker">RELATION RADAR</div><h3 class="hero-title">从图形中发掘隐藏结论</h3><p class="hero-desc">扫描共线、共圆、共点、等长、等角、相切与五心结构。结果按“有趣程度”排序，并标出可识别的定理。</p></div>`;
    html += `<div class="section"><div class="section-head"><span class="section-title">关系类型</span><span class="section-action" data-action="toggle-cats">全选 / 清空</span></div><div class="scan-grid">${Object.entries(CAT_LABEL).map(([k, v]) => `<label class="scan-check ${S.ui.relationCats.has(k) ? 'on' : ''}"><input type="checkbox" data-cat="${k}" ${S.ui.relationCats.has(k) ? 'checked' : ''}/>${v}</label>`).join('')}</div>`;
    html += `<button class="btn primary full" data-action="scan" ${S.ui.scanStatus === 'scanning' ? 'disabled' : ''}>${S.ui.scanStatus === 'scanning' ? '扫描中…' : `${svg('spark')} 扫描当前图形`}</button>`;
    html += `<div class="scan-meta"><span>${S.ui.scanStatus === 'done' ? `${S.ui.relations.length} 条结果 · ${S.ui.scanMs.toFixed(1)} ms` : S.ui.scanStatus === 'scanning' ? 'Worker 计算中…' : '尚未扫描'}</span><span>${S.ui.backend.online ? 'WORKER + 后端' : 'WEB WORKER'}</span></div>`;
    if (S.ui.scanStatus === 'scanning') html += `<div class="progress"><i style="width:65%"></i></div>`;
    html += `</div>`;
    if (S.ui.relations.length) {
      html += `<div class="section"><div class="section-head"><span class="section-title">发现 · ${S.ui.relations.length}</span><span class="section-action">按分数排序</span></div>`;
      for (let i = 0; i < S.ui.relations.length; i++) {
        const r = S.ui.relations[i];
        const on = S.ui.highlight?.id === r.id;
        html += `<div class="relation-card ${on ? 'on' : ''}" data-rel="${i}">
          <div class="rc-top"><span class="rc-kind">${esc(r.category)}</span>${r.theorem ? `<span class="theorem">${esc(r.theorem)}</span>` : ''}<span class="rc-score"><b>${r.score}</b>/100</span></div>
          <strong>${esc(r.statement)}</strong><small>${esc(r.detail || '')}</small>
          <div class="pc-actions" style="margin-top:6px"><button class="btn" data-rel-goal="${i}" style="height:24px;font-size:7.5px">设为目标</button><button class="btn" data-rel-copy="${i}" style="height:24px;font-size:7.5px">复制</button></div>
        </div>`;
      }
      html += `</div>`;
    } else if (S.ui.scanStatus === 'done') {
      html += `<div class="empty-state"><div class="glyph">✳</div><h3>没有命中关系</h3><p>尝试增加辅助线、构造更多特征点，或扩大关系类型。</p></div>`;
    }
  } else {
    html += `<div class="hero-card"><div class="hero-kicker">AUTO-PROPOSER</div><h3 class="hero-title">让机器从随机构型中出题</h3><p class="hero-desc">后端在 6 组随机锐角三角形上重复计算，只保留稳定成立、且非平凡的几何关系，再转写成竞赛命题。</p></div>`;
    html += `<button class="btn primary full" data-action="generate" ${S.ui.generating ? 'disabled' : ''}>${S.ui.generating ? '正在随机探索…' : `${svg('spark')} 生成一批新命题`}</button>`;
    html += `<div class="scan-meta"><span>${S.ui.generated.length ? `${S.ui.generated.length} 道候选 · seed ${S.ui.generatedSeed || '—'}` : '尚未生成'}</span><span>6 组构型复验</span></div>`;
    if (S.ui.generated.length) {
      for (let i = 0; i < S.ui.generated.length; i++) {
        const p = S.ui.generated[i];
        html += `<div class="problem-card"><div class="pc-top"><span class="pc-index">P${String(i + 1).padStart(2, '0')}</span><span class="tag">${esc(p.theorem || p.kind)}</span><span class="pc-diff">${'★'.repeat(p.difficulty || 3)}</span></div>
          <h4>${esc(p.title)}</h4><p>${esc(p.statement)}</p><div class="pc-tags">${(p.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}<span class="tag green">${p.verifiedOn || 6} 组验证</span></div>
          <div class="pc-actions"><button class="btn" data-gen-load="${i}">载入画板</button><button class="btn" data-gen-hint="${i}">查看提示</button></div></div>`;
      }
    }
  }
  body.innerHTML = html;
  bindExploreEvents(body);
}
function bindExploreEvents(body) {
  body.querySelectorAll('[data-explore-tab]').forEach((b) => b.addEventListener('click', () => { S.ui.exploreTab = b.dataset.exploreTab; renderExplorePanel(); }));
  body.querySelectorAll('[data-cat]').forEach((cb) => cb.addEventListener('change', () => {
    const k = cb.dataset.cat; if (cb.checked) S.ui.relationCats.add(k); else S.ui.relationCats.delete(k);
    cb.closest('.scan-check').classList.toggle('on', cb.checked);
  }));
  body.querySelectorAll('[data-rel]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const r = S.ui.relations[+el.dataset.rel]; if (!r) return;
    S.ui.highlight = { id: r.id, ids: r.ids || [] }; requestRender(); renderExplorePanel();
  }));
  body.querySelectorAll('[data-rel-goal]').forEach((b) => b.addEventListener('click', (ev) => {
    const r = S.ui.relations[+b.dataset.relGoal];
    let g = null;
    try { g = goalFromRelation(r, buildSnapshot(S.state), S.state); } catch (err) { console.error('goalFromRelation error', err); }
    if (!g) return toast('这条结论暂时不能直接作为目标（缺少可验证对象）', 'warn');
    S.ui.goal = g; S.ui.proof = null; S.ui.aiResult = null; S.ui.solutionTab = 'verdict'; switchTab('ai'); toast('目标已设定，点击运行 AI 分析');
  }));
  body.querySelectorAll('[data-rel-copy]').forEach((b) => b.addEventListener('click', () => {
    const r = S.ui.relations[+b.dataset.relCopy]; if (!r) return;
    navigator.clipboard?.writeText(r.statement).then(() => toast('命题已复制')).catch(() => toast('复制失败', 'error'));
  }));
  body.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.action === 'scan') scanNow();
    else if (b.dataset.action === 'generate') generateNow();
    else if (b.dataset.action === 'toggle-cats') {
      if (S.ui.relationCats.size) S.ui.relationCats.clear(); else Object.keys(CAT_LABEL).forEach((k) => S.ui.relationCats.add(k));
      renderExplorePanel();
    }
  }));
  body.querySelectorAll('[data-gen-load]').forEach((b) => b.addEventListener('click', () => loadGeneratedProblem(S.ui.generated[+b.dataset.genLoad])));
  body.querySelectorAll('[data-gen-hint]').forEach((b) => b.addEventListener('click', () => {
    const p = S.ui.generated[+b.dataset.genHint]; if (!p) return;
    modal(`<div class="modal-head"><div><span class="eyebrow">HINT</span><h3>${esc(p.title)}</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div><div class="modal-body"><p style="font-size:10.5px;line-height:1.75;color:var(--muted)">${esc(p.hint)}</p><div class="proof-card" style="margin-top:8px"><h4>命题</h4><p>${esc(p.statement)}</p></div><div class="field"><span>定理标签</span><b>${esc(p.theorem || p.kind)}</b></div><div class="field"><span>验证样本</span><b>${p.verifiedOn || 6} 组随机构型</b></div></div><div class="modal-foot"><button class="btn" data-close>关闭</button></div>`);
  }));
}

/* ------------------------------ library panel --------------------------- */
function hiddenScenario(s) {
  const id = String(s?.id || '');
  const title = String(s?.title || '');
  return id.startsWith('imo') || id.startsWith('orig-') || /IMOSL|IMO|原创|高中联赛|100 题/i.test(title);
}

async function openLeague100() {
  let items = [];
  try { items = await (await fetch('/data/league100/index.json', { cache: 'no-store' })).json(); }
  catch (e) { return toast('100 题题库读取失败：' + e.message, 'error'); }
  const rows = items.map((x) => `<div class="library-card" data-league="${x.n}" style="cursor:pointer"><div class="lib-glyph">${x.n}</div><div class="lib-info"><h4>第 ${x.n} 题</h4><p>${esc(x.text.split('\n').slice(0, 3).join(' ').slice(0, 140))}…</p></div><div class="lib-difficulty">识图</div></div>`).join('');
  modal(`<div class="modal-head"><div><span class="eyebrow">PROBLEM BANK</span><h3>高中联赛难度几何 100 题</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body"><div class="library-search">${svg('search')}<input id="league-search" placeholder="搜索题号或关键词…"/></div>
    <div id="league-list" class="library-list" style="max-height:58vh;overflow:auto;display:flex;flex-direction:column;gap:5px">${rows}</div>
    <div class="helper-note">点击任意题目会载入原图和题面；再点「大模型识图并画图」即可按图现场构造。</div></div>
    <div class="modal-foot"><button class="btn" data-close>关闭</button></div>`,
  { width: 760, onMount: (root, close) => {
    const list = $('#league-list', root), search = $('#league-search', root);
    const render = () => {
      const q = (search?.value || '').trim().toLowerCase();
      list.innerHTML = items.filter((x) => !q || String(x.n).includes(q) || x.text.toLowerCase().includes(q)).map((x) => `<div class="library-card" data-league="${x.n}" style="cursor:pointer"><div class="lib-glyph">${x.n}</div><div class="lib-info"><h4>第 ${x.n} 题</h4><p>${esc(x.text.split('\n').slice(0, 2).join(' ').slice(0, 150))}…</p></div><div class="lib-difficulty">识图</div></div>`).join('');
      bindList();
    };
    const bindList = () => list.querySelectorAll('[data-league]').forEach((el) => el.addEventListener('click', () => {
      const item = items.find((x) => x.n === Number(el.dataset.league)); if (!item) return;
      close(); openVisionModal({ imageUrl: item.image, text: item.text });
    }));
    search?.addEventListener('input', render);
    bindList();
  } });
}

function renderLibraryPanel() {
  const body = $('#inspector-body'); if (!body) return;
  const visibleScenarios = SCENARIOS.filter((s) => !hiddenScenario(s));
  const cats = ['全部', ...new Set(visibleScenarios.map((s) => s.category))];
  const q = S.ui.libraryQuery.toLowerCase();
  const list = SCENARIOS.filter((s) => !hiddenScenario(s) && (S.ui.libraryFilter === '全部' || s.category === S.ui.libraryFilter) && (!q || (s.title + s.description + s.tags.join(' ')).toLowerCase().includes(q)));
  let html = `<div class="library-search">${svg('search')}<input id="lib-search" placeholder="搜索构型、定理、标签…" value="${esc(S.ui.libraryQuery)}"/></div>`;
  html += `<div class="filter-row">${cats.map((c) => `<button class="filter-chip ${S.ui.libraryFilter === c ? 'on' : ''}" data-lib-filter="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
  html += `<div class="section-head"><span class="section-title">经典构型 · ${list.length}</span><span class="section-action">可拖动探究</span></div>`;
  html += list.map((s) => `<div class="library-card" data-scenario="${s.id}">
    <div class="lib-glyph">${SCENARIO_GLYPHS[s.glyph] || SCENARIO_GLYPHS.triangle}</div>
    <div class="lib-info"><h4>${esc(s.title)}</h4><p>${esc(s.description)}</p><div class="tags">${s.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
    <div class="lib-difficulty">${'★'.repeat(s.difficulty)}</div>
  </div>`).join('');
  if (!list.length) html += `<div class="empty-state"><div class="glyph">▤</div><h3>没有匹配的构型</h3><p>换一个关键词或分类试试。</p></div>`;
  html += `<div class="hero-card" style="margin-top:12px"><div class="hero-kicker">ABOUT THE LIBRARY</div><p class="hero-desc">每个构型都是动态画板：拖动自由点，关系、证明与计算会同步更新。题目证明只保留结论与考场写法，探索过程在关系面板中。</p></div>`;
  body.innerHTML = html;
  $('#lib-search')?.addEventListener('input', (e) => { S.ui.libraryQuery = e.target.value; renderLibraryPanel(); setTimeout(() => { const inp = $('#lib-search'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }, 0); });
  body.querySelectorAll('[data-lib-filter]').forEach((b) => b.addEventListener('click', () => { S.ui.libraryFilter = b.dataset.libFilter; renderLibraryPanel(); }));
  body.querySelectorAll('[data-scenario]').forEach((b) => b.addEventListener('click', () => loadScenario(b.dataset.scenario)));
}

/* ------------------------------ canvas logic ---------------------------- */
function hitTest(screen) {
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
  const tol = coarse ? 20 : 11;
  const world = S.renderer.toWorld(screen);
  const objs = S.state.objects;
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i]; if (!o.visible || !o.valid) continue;
    if (o.type === 'point') {
      const p = S.renderer.toScreen(o.g);
      if (Math.hypot(p.x - screen.x, p.y - screen.y) <= Math.max(tol, (o.style.pointSize || 4) + 6)) return { type: 'point', obj: o, id: o.id };
    }
  }
  // Measure labels sit on top of segments/lines: prioritize them so a measured length can be used as a source.
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i]; if (!o.visible || !o.valid || o.type !== 'measure') continue;
    const anchors = [S.renderer.measureAnchor(o), { x: o.x, y: o.y }].filter(Boolean);
    for (const anchor of anchors) {
      const p = S.renderer.toScreen(anchor);
      if (Math.hypot(p.x - screen.x, p.y - screen.y) < 26) return { type: 'measure', obj: o, id: o.id };
    }
  }
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i]; if (!o.visible || !o.valid) continue;
    if (['line', 'segment', 'ray', 'vector'].includes(o.type)) {
      const a = S.renderer.toScreen(o.g.a); const b = S.renderer.toScreen(o.g.b);
      const d = { x: b.x - a.x, y: b.y - a.y }; const L2 = d.x * d.x + d.y * d.y; if (L2 < 1) continue;
      const t = ((screen.x - a.x) * d.x + (screen.y - a.y) * d.y) / L2;
      if (o.type === 'segment' && (t < -.03 || t > 1.03)) continue;
      if (o.type === 'ray' && t < -.03) continue;
      const tt = o.type === 'line' ? ((screen.x - a.x) * d.x + (screen.y - a.y) * d.y) / L2 : clamp(t, 0, 1);
      const px = a.x + d.x * tt, py = a.y + d.y * tt;
      if (Math.hypot(screen.x - px, screen.y - py) < tol) return { type: 'line', obj: o, id: o.id };
    }
    if (o.type === 'curve' && S.ui.tool !== 'qlcu1') {
      for (const [A, B] of curveSegments(o)) {
        const a = S.renderer.toScreen(A), b = S.renderer.toScreen(B);
        const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
        const t = clamp(((screen.x - a.x) * dx + (screen.y - a.y) * dy) / L2, 0, 1);
        if (Math.hypot(screen.x - (a.x + dx * t), screen.y - (a.y + dy * t)) < tol) return { type: 'curve', obj: o, id: o.id };
      }
    }
    if (o.type === 'circle') {
      const c = S.renderer.toScreen(o.g.center); const r = o.g.r * S.state.view.scale;
      const dd = Math.abs(Math.hypot(screen.x - c.x, screen.y - c.y) - r);
      if (dd < tol) return { type: 'circle', obj: o, id: o.id };
    }
    if (o.type === 'arc') {
      const c = S.renderer.toScreen(o.g.center); const r = o.g.r * S.state.view.scale;
      const d = Math.hypot(screen.x - c.x, screen.y - c.y);
      if (Math.abs(d - r) < tol) {
        const tau = Math.PI * 2, normA = (x) => ((x % tau) + tau) % tau;
        const ang = normA(Math.atan2(screen.y - c.y, screen.x - c.x));
        const a1 = normA(o.g.a1), a2 = normA(o.g.a2);
        const span = o.g.anticlockwise ? normA(a1 - a2) : normA(a2 - a1);
        const rel = o.g.anticlockwise ? normA(a1 - ang) : normA(ang - a1);
        if (rel <= span + 1e-4) return { type: 'arc', obj: o, id: o.id };
      }
    }
  }
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i]; if (!o.visible || !o.valid) continue;
    if (o.type === 'polygon' && pointInPolygon(world, o.g.points)) return { type: 'polygon', obj: o, id: o.id };
    if (o.type === 'triangle' && pointInPolygon(world, o.g.vertices)) return { type: 'triangle', obj: o, id: o.id };
    if (o.type === 'measure' || o.type === 'text') {
      const anchors = o.type === 'measure' ? [S.renderer.measureAnchor(o), { x: o.x, y: o.y }].filter(Boolean) : [o.g || { x: o.x, y: o.y }];
      for (const anchor of anchors) {
        const p = S.renderer.toScreen(anchor);
        if (Math.hypot(p.x - screen.x, p.y - screen.y) < 30) return { type: o.type, obj: o, id: o.id };
      }
    }
  }
  return null;
}

function currentPointHit(hit) { return hit?.obj?.type === 'point' && hit.obj.valid ? hit.obj : null; }
function isDraggablePoint(o) { return !!o && o.type === 'point' && o.valid && !o.locked && ['free', 'pointOnCircle', 'pointOnLine'].includes(o.sub); }
function currentCurveHit(hit) { return hit?.obj && (['line', 'segment', 'ray', 'vector', 'circle'].includes(hit.obj.type)) && hit.obj.valid ? hit.obj : null; }
function ensurePointFromClick(hit, screen, { attach = true } = {}) {
  const world = S.renderer.toWorld(screen);
  if (hit?.obj?.type === 'point' && hit.obj.valid) return hit.obj;
  if (attach && currentCurveHit(hit)) {
    pushHistory();
    const p = addPointOnCurve(hit.obj, world);
    if (p) { recompute(S.state); if (S.ui.tab === 'objects') renderObjects(); requestRender(); }
    return p;
  }
  pushHistory();
  const p = addPoint(world.x, world.y);
  recompute(S.state);
  if (S.ui.tab === 'objects') renderObjects();
  requestRender();
  return p;
}
function pendingPush(kind, id) { S.ui.pending.push({ kind, id }); requestRender(); }
function pendingClear() { S.ui.pending = []; requestRender(); }
function pendingIds() { return S.ui.pending.map((p) => p.id); }
function pendingHas(kind) { return S.ui.pending.some((p) => p.kind === kind); }
function isLengthSource(o) {
  return !!o && o.valid && (['line', 'segment', 'ray', 'vector', 'circle', 'arc', 'measure'].includes(o.type));
}
function isAngleSource(o) {
  return !!o && o.valid && o.type === 'measure' && (o.sub === 'angle' || o.sub === 'angle2');
}
function selectedSource(pred) {
  return S.ui.selection.map((id) => objectById(S.state, id)).find((o) => pred(o)) || null;
}

function finishConstruction(msg) {
  if (msg) toast(msg);
  logAction(`${TOOL_MAP.get(S.ui.tool)?.name || '构造'}：${msg || '完成'}`);
  pendingClear(); afterMutation();
  renderToolConfig(); renderInspector();
}
function getTriForSelection(ids) {
  return triangleForVertices(S.state, ids) || (() => { pushHistory(); return addTriangle(S.state, ids[0], ids[1], ids[2]); })();
}
function triangleFromIds(ids, { centers = false } = {}) {
  pushHistory();
  let tri = triangleForVertices(S.state, ids);
  if (!tri) {
    tri = addTriangle(S.state, ids[0], ids[1], ids[2], {
      centers: centers !== false,
      show: centers === false ? { euler: false, ninePoint: false, incircle: false, circumcircle: false, medians: false, altitudes: false, bisectors: false, orthic: false } : undefined,
    });
    // ensure sides exist for hit testing / detection
    for (let i = 0; i < 3; i++) {
      const a = ids[i], b = ids[(i + 1) % 3];
      const exists = S.state.objects.some((o) => o.type === 'segment' && ((o.deps[0] === a && o.deps[1] === b) || (o.deps[1] === a && o.deps[0] === b)));
      if (!exists) addObject(S.state, { type: 'segment', sub: 'through', deps: [a, b], style: { color: '#3d4c63', width: 1.15 } });
    }
  }
  S.ui.activeTriangle = tri.id;
  return tri;
}

const CENTER_TOOL_MAP = { centroid: 'G', circumcenter: 'O', incenter: 'I', orthocenter: 'H', nineCenter: 'N' };
function addSingleCenter(ids, key) {
  const tri = triangleFromIds(ids, { centers: false });
  const [pid] = ensureCenters(S.state, tri.id, [key]);
  const p = objectById(S.state, pid);
  if (p) { p.visible = true; selectObjects([p.id]); }
  return { tri, p };
}

function constructTangentsFromPoint(p, c) {
  if (!p || !c || !p.valid || !c.valid) return false;
  const d = dist(p.g, c.g.center);
  const onCircle = Math.abs(d - c.g.r) < 1e-6 * Math.max(1, c.g.r);
  if (onCircle) {
    pushHistory();
    const ln = addLineObj('line', 'tangentAt', [p.id, c.id], { color: '#b45309', width: 1.1 });
    selectObjects([ln.id]);
    finishConstruction(`已构造圆上 ${p.label} 处的切线`);
    return true;
  }
  if (d < c.g.r - 1e-8) {
    toast('该点在圆内，没有实切线', 'warn');
    return false;
  }
  const pts = tangentPoints(p.g, c.g.center, c.g.r);
  if (!pts.length) { toast('无法构造切线', 'warn'); return false; }
  pushHistory();
  const ids = [];
  pts.forEach((_, i) => {
    const tp = addObject(S.state, {
      type: 'point', sub: 'tangentPoint', deps: [p.id, c.id], branch: i,
      label: uniqueLabel(S.state, nextPointLabel(S.state)),
      style: { color: '#263342', pointSize: 3.0 },
    });
    const ln = addLineObj('line', 'through', [p.id, tp.id], { color: '#b45309', width: 1.1 });
    ids.push(tp.id, ln.id);
  });
  selectObjects(ids);
  finishConstruction(`已构造 ${pts.length} 条切线`);
  return true;
}

const TRANSFORMABLE_TYPES = new Set(['point', 'line', 'segment', 'ray', 'vector', 'circle', 'polygon', 'triangle']);

function transformSourceAt(hit, screen) {
  if (hit?.obj) {
    if (TRANSFORMABLE_TYPES.has(hit.obj.type) && hit.obj.valid) return hit.obj;
    toast('文本、测量与圆弧暂不支持作为变换源', 'warn');
    return null;
  }
  return ensurePointFromClick(hit, screen);
}

function addTransformResult(src, kind, paramIds, extra = {}) {
  const deps = [src.id, ...paramIds];
  const created = [];
  if (src.type === 'point') {
    const p = addObject(S.state, {
      type: 'point', sub: 'transformPoint', deps, kind, ...extra,
      label: uniqueLabel(S.state, nextPointLabel(S.state)),
      style: { color: '#263342', pointSize: 3.0 },
    });
    created.push(p);
  } else if (['line', 'segment', 'ray', 'vector'].includes(src.type)) {
    const o = addObject(S.state, {
      type: src.type, sub: 'transform', deps, kind, ...extra,
      style: { color: '#6d28d9', width: 1.1, dash: 0 },
    });
    created.push(o);
  } else if (src.type === 'circle') {
    const o = addObject(S.state, {
      type: 'circle', sub: 'transform', deps, kind, ...extra,
      style: { color: '#6d28d9', width: 1.05, dash: 0, fill: 'transparent', opacity: .9 },
    });
    created.push(o);
  } else if (src.type === 'polygon' || src.type === 'triangle') {
    const vids = src.deps.map((id) => addObject(S.state, {
      type: 'point', sub: 'transformPoint', deps: [id, ...paramIds], kind, ...extra,
      label: uniqueLabel(S.state, nextPointLabel(S.state)),
      style: { color: '#263342', pointSize: 3.0 },
    }).id);
    if (src.type === 'polygon') {
      created.push(addObject(S.state, {
        type: 'polygon', sub: 'polygon', deps: vids,
        style: { color: '#6d28d9', width: 1.05, dash: 4, fill: 'rgba(109,40,217,.035)' },
      }));
    } else {
      const tri = addTriangle(S.state, vids[0], vids[1], vids[2]);
      created.push(tri);
      for (const [a, b] of [[vids[0], vids[1]], [vids[1], vids[2]], [vids[2], vids[0]]]) {
        created.push(addObject(S.state, { type: 'segment', sub: 'through', deps: [a, b], style: { color: '#6d28d9', width: 1.1 } }));
      }
    }
    created.push(...vids);
  }
  return created;
}

function invertSourceObject(src, invCircle) {
  if (src.type === 'point') {
    const p = addObject(S.state, {
      type: 'point', sub: 'inversion', deps: [src.id, invCircle.id],
      label: uniqueLabel(S.state, nextPointLabel(S.state)),
      style: { color: '#263342', pointSize: 3.0 },
    });
    selectObjects([p.id]); finishConstruction('反演点已构造：OP · OP′ = r²'); return true;
  }
  if (src.type === 'line') {
    const n = norm(perp(src.g.d));
    const delta = dot(n, sub(src.g.a, invCircle.g.center));
    if (Math.abs(delta) < 1e-7) { toast('这条直线过反演中心，反演像为自身', 'warn'); return false; }
    const c = addObject(S.state, {
      type: 'circle', sub: 'inversionOfLine', deps: [src.id, invCircle.id], label: 'ω′',
      style: { color: '#6d28d9', width: 1.05, dash: 4, fill: 'transparent', opacity: .9 },
    });
    selectObjects([c.id]); finishConstruction('直线反演为过反演中心的圆'); return true;
  }
  if (src.type === 'circle') {
    if (src.id === invCircle.id) { toast('反演圆的反演像是自身', 'warn'); return false; }
    const d = dist(src.g.center, invCircle.g.center);
    if (Math.abs(d - src.g.r) < 1e-7 * Math.max(1, src.g.r)) {
      const l = addObject(S.state, {
        type: 'line', sub: 'inversionOfCircle', deps: [src.id, invCircle.id],
        style: { color: '#6d28d9', width: 1.1, dash: 0 },
      });
      selectObjects([l.id]); finishConstruction('过反演中心的圆反演为直线'); return true;
    }
    const c = addObject(S.state, {
      type: 'circle', sub: 'inversionOfCircle', deps: [src.id, invCircle.id], label: 'ω′',
      style: { color: '#6d28d9', width: 1.05, dash: 4, fill: 'transparent', opacity: .9 },
    });
    selectObjects([c.id]); finishConstruction('圆反演为圆'); return true;
  }
  if (['segment', 'ray', 'vector'].includes(src.type)) {
    const n = norm(perp(src.g.d));
    if (Math.abs(dot(n, sub(src.g.a, invCircle.g.center))) < 1e-7) {
      toast('这条线段的支撑线过反演中心，反演像退化为射线', 'warn'); return false;
    }
    const arc = addObject(S.state, {
      type: 'arc', sub: 'inversionLine', deps: [src.id, invCircle.id], label: 'γ',
      style: { color: '#6d28d9', width: 1.1, dash: 4 },
    });
    selectObjects([arc.id]); finishConstruction('线段反演为圆弧'); return true;
  }
  if (src.type === 'polygon' || src.type === 'triangle') {
    const pts = src.deps.map((id) => objectById(S.state, id));
    if (pts.some((p) => !p || !p.valid)) { toast('对象顶点无效', 'warn'); return false; }
    const ids = [];
    for (let i = 0; i < pts.length; i++) {
      const P = pts[i], Q = pts[(i + 1) % pts.length];
      const n = norm(perp(sub(Q.g, P.g)));
      if (Math.abs(dot(n, sub(P.g, invCircle.g.center))) < 1e-7) {
        toast('有一条边过反演中心，反演像退化，暂不支持', 'warn'); return false;
      }
      const arc = addObject(S.state, {
        type: 'arc', sub: 'inversionEndpoints', deps: [P.id, Q.id, invCircle.id], label: '',
        style: { color: '#6d28d9', width: 1.1, dash: 4 },
      });
      ids.push(arc.id);
    }
    selectObjects(ids); finishConstruction('多边形边界反演为圆弧'); return true;
  }
  toast('该对象暂不支持反演', 'warn');
  return false;
}

function findIntersectionAtClick(screen, tol = 12) {
  const curves = S.state.objects.filter((o) => o.visible && o.valid && ['line', 'segment', 'ray', 'vector', 'circle'].includes(o.type));
  let best = null;
  for (let i = 0; i < curves.length; i++) {
    for (let j = i + 1; j < curves.length; j++) {
      const a = curves[i], b = curves[j];
      const pts = intersectionOfCurves(getCurve(a), getCurve(b));
      for (let branch = 0; branch < pts.length; branch++) {
        const p = S.renderer.toScreen(pts[branch]);
        const d = Math.hypot(p.x - screen.x, p.y - screen.y);
        if (d <= tol && (!best || d < best.d)) best = { a, b, p: pts[branch], branch, d };
      }
    }
  }
  return best;
}

function handleCanvasClick(screen, ev) {
  const hit = hitTest(screen);
  const world = S.renderer.toWorld(screen);
  const tool = S.ui.tool;
  const need = (n) => S.ui.pending.length >= n;
  const addPt = () => { pushHistory(); return addPoint(world.x, world.y); };

  switch (tool) {
    case 'freePoint': {
      const p = ensurePointFromClick(hit, screen, { attach: S.state.settings.snap });
      selectObjects([p.id]); finishConstruction('已创建点 ' + p.label);
      break;
    }
    case 'onObject': {
      const c = currentCurveHit(hit);
      if (!c) return toast('请点击一条直线或圆', 'warn');
      const p = addPointOnCurve(c, world);
      selectObjects([p.id]); finishConstruction('已创建对象上的点 ' + p.label);
      break;
    }
    case 'midpoint': {
      // Direct mode: click a segment and get its midpoint immediately.
      if (!pendingHas('point') && hit?.obj?.type === 'segment' && hit.obj.valid) {
        const a = objectById(S.state, hit.obj.deps[0]);
        const b = objectById(S.state, hit.obj.deps[1]);
        if (!a || !b) return toast('这条线段端点无效', 'warn');
        pushHistory();
        const m = addObject(S.state, {
          type: 'point', sub: 'midpoint', deps: [a.id, b.id],
          label: uniqueLabel(S.state, 'M'),
          style: { color: '#263342', pointSize: 3.0 },
        });
        selectObjects([m.id]);
        finishConstruction(`${a.label}${b.label} 的中点 ${m.label} 已构造`);
        break;
      }
      const p = currentPointHit(hit);
      if (!p) return toast('点击一条线段，或依次选择两个点', 'warn');
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      if (pendingIds()[0] === p.id) return toast('请选择另一个点', 'warn');
      pushHistory();
      const m = addObject(S.state, { type: 'point', sub: 'midpoint', deps: [pendingIds()[0], p.id], label: uniqueLabel(S.state, 'M'), style: { color: '#263342', pointSize: 3.0 } });
      selectObjects([m.id]); finishConstruction('中点已构造');
      break;
    }
    case 'intersection': {
      // If the click is already on an existing point, select it instead of duplicating.
      if (hit?.obj?.type === 'point' && hit.obj.valid) {
        selectObjects([hit.obj.id]);
        finishConstruction(`已选中点 ${hit.obj.label}`);
        break;
      }
      // Direct mode: click near a crossing → create exactly that one intersection.
      const direct = findIntersectionAtClick(screen);
      if (direct) {
        pushHistory();
        const p = addObject(S.state, {
          type: 'point', sub: 'intersection', deps: [direct.a.id, direct.b.id],
          branch: direct.branch, label: uniqueLabel(S.state, nextPointLabel(S.state)),
          style: { color: '#263342', pointSize: 3.0 },
        });
        selectObjects([p.id]);
        finishConstruction(`交点 ${p.label} 已构造（点击处）`);
        break;
      }
      // Fallback: two-curve mode (useful when the intersection is outside the viewport).
      const c = currentCurveHit(hit);
      if (!c) return toast('请点击两曲线的交点，或依次选择两条曲线', 'warn');
      if (!pendingHas('curve')) { pendingPush('curve', c.id); return toast('已选第一条曲线；再选另一条，或直接点它们的交点'); }
      if (pendingIds()[0] === c.id) return toast('请选择另一条曲线', 'warn');
      const a = objectById(S.state, pendingIds()[0]); if (!a) return pendingClear();
      const pts = intersectionOfCurves(getCurve(a), getCurve(c));
      if (!pts.length) { toast('两条曲线在当前范围内没有交点', 'warn'); pendingClear(); return; }
      pushHistory();
      const ids = [];
      pts.forEach((q, i) => {
        const p = addObject(S.state, { type: 'point', sub: 'intersection', deps: [a.id, c.id], branch: i, label: uniqueLabel(S.state, nextPointLabel(S.state)), style: { color: '#263342', pointSize: 3.0 } });
        ids.push(p.id);
      });
      selectObjects(ids); finishConstruction(`已创建 ${ids.length} 个交点`);
      break;
    }
    case 'foot': {
      if (!pendingHas('point')) {
        const p = currentPointHit(hit); if (!p) return toast('先选择一个点', 'warn');
        pendingPush('point', p.id); return;
      }
      const c = currentCurveHit(hit); if (!c) return toast('请选择一条基准直线', 'warn');
      pushHistory();
      const f = addObject(S.state, { type: 'point', sub: 'foot', deps: [pendingIds()[0], c.id], label: uniqueLabel(S.state, nextPointLabel(S.state)), style: { color: '#4fd1c5', pointSize: 3.0 } });
      selectObjects([f.id]); finishConstruction('垂足已构造');
      break;
    }
    case 'segment': case 'line': case 'ray': case 'vector': {
      const p = ensurePointFromClick(hit, screen);
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      if (pendingIds()[0] === p.id) return toast('请选择不同的第二点', 'warn');
      pushHistory();
      const o = addLineObj(tool, 'through', [pendingIds()[0], p.id], { color: '#3d4c63' });
      selectObjects([o.id]); finishConstruction(`${TYPE_NAME[tool]}已构造`);
      break;
    }
    case 'perp': case 'parallel': {
      if (!pendingHas('point') && !pendingHas('line')) {
        const p = currentPointHit(hit); const l = currentCurveHit(hit);
        if (p) { pendingPush('point', p.id); return; }
        if (l) { pendingPush('line', l.id); return; }
        const np = addPt(); pendingPush('point', np.id); return;
      }
      if (pendingHas('point') && !pendingHas('line')) {
        const l = currentCurveHit(hit); if (!l) return toast('请选择基准直线', 'warn');
        pushHistory();
        const o = addLineObj('line', tool === 'perp' ? 'perp' : 'parallel', [pendingIds()[0], l.id], { color: '#7aa2ff', dash: 4 });
        selectObjects([o.id]); finishConstruction(tool === 'perp' ? '垂线已构造' : '平行线已构造');
      } else if (pendingHas('line') && !pendingHas('point')) {
        const p = currentPointHit(hit) || (() => { const np = addPt(); return np; })();
        pushHistory();
        const o = addLineObj('line', tool === 'perp' ? 'perp' : 'parallel', [p.id, pendingIds()[0]], { color: '#7aa2ff', dash: 4 });
        selectObjects([o.id]); finishConstruction(tool === 'perp' ? '垂线已构造' : '平行线已构造');
      }
      break;
    }
    case 'perpBisector': {
      // Direct mode: click a segment and get its perpendicular bisector.
      if (!pendingHas('point') && hit?.obj?.type === 'segment' && hit.obj.valid) {
        const a = objectById(S.state, hit.obj.deps[0]);
        const b = objectById(S.state, hit.obj.deps[1]);
        if (!a || !b) return toast('这条线段端点无效', 'warn');
        pushHistory();
        const o = addLineObj('line', 'perpbis', [a.id, b.id], { color: '#7aa2ff', dash: 4 });
        selectObjects([o.id]); finishConstruction(`${a.label}${b.label} 的中垂线已构造`);
        break;
      }
      const p = currentPointHit(hit); if (!p) return toast('点击一条线段，或依次选择两个点', 'warn');
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      if (pendingIds()[0] === p.id) return toast('请选择另一个点', 'warn');
      pushHistory();
      const o = addLineObj('line', 'perpbis', [pendingIds()[0], p.id], { color: '#7aa2ff', dash: 4 });
      selectObjects([o.id]); finishConstruction('中垂线已构造');
      break;
    }
    case 'angleBisector': {
      const p = currentPointHit(hit); if (!p) return toast('请依次选择 A、顶点 B、C', 'warn');
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      if (S.ui.pending.length === 1) { if (p.id === pendingIds()[0]) return toast('顶点不能与 A 重合', 'warn'); pendingPush('point', p.id); return; }
      if (pendingIds().includes(p.id)) return toast('请选择不同的 C', 'warn');
      pushHistory();
      const o = addLineObj('line', 'bisector', [pendingIds()[0], pendingIds()[1], p.id], { color: '#4fd1c5', dash: 4 });
      selectObjects([o.id]); finishConstruction('角平分线已构造');
      break;
    }
    case 'tangent': {
      if (!pendingHas('circle') && !pendingHas('point')) {
        const c = hit?.obj?.type === 'circle' ? hit.obj : null;
        const p = currentPointHit(hit);
        if (c) { pendingPush('circle', c.id); return; }
        if (p) { pendingPush('point', p.id); return; }
        return toast('先选择圆或圆外一点', 'warn');
      }
      if (pendingHas('circle') && !pendingHas('point')) {
        const p = currentPointHit(hit); if (!p) return toast('请选择圆上或圆外一点', 'warn');
        const c = objectById(S.state, S.ui.pending.find((x) => x.kind === 'circle').id);
        constructTangentsFromPoint(p, c);
        break;
      }
      const c = hit?.obj?.type === 'circle' ? hit.obj : null; if (!c) return toast('请选择圆', 'warn');
      const p = objectById(S.state, S.ui.pending.find((x) => x.kind === 'point').id);
      constructTangentsFromPoint(p, c);
      break;
    }
    case 'radical': {
      const c = hit?.obj?.type === 'circle' ? hit.obj : null; if (!c) return toast('请选择两个圆', 'warn');
      if (!pendingHas('circle')) { pendingPush('circle', c.id); return; }
      if (pendingIds()[0] === c.id) return toast('请选择另一个圆', 'warn');
      pushHistory();
      const o = addLineObj('line', 'radical', [pendingIds()[0], c.id], { color: '#c084fc', dash: 4 });
      selectObjects([o.id]); finishConstruction('根轴已构造');
      break;
    }
    case 'conic5': {
      const p = ensurePointFromClick(hit, screen);
      if (pendingIds().includes(p.id)) return toast('五点不能重复', 'warn');
      pendingPush('point', p.id);
      if (S.ui.pending.length < 5) return;
      pushHistory();
      const c = addObject(S.state, { type: 'curve', sub: 'conic', deps: pendingIds(), label: 'Γ', style: { color: '#c084fc', width: 1.15, dash: 0 } });
      selectObjects([c.id]); finishConstruction('二次曲线已构造（过五点）');
      break;
    }
    case 'qlcu1': {
      const line = hit?.obj && ['line', 'segment', 'ray', 'vector'].includes(hit.obj.type) ? hit.obj : null;
      if (!line) return toast('巨龙曲线需要依次选择四条直线（可点线段）', 'warn');
      if (pendingIds().includes(line.id)) return toast('请选择另一条直线', 'warn');
      pendingPush('line', line.id);
      if (S.ui.pending.length < 4) return;
      pushHistory();
      const c = addObject(S.state, { type: 'curve', sub: 'qlcu1', deps: pendingIds(), label: 'Cu₁', style: { color: '#f6c76b', width: 1.25, dash: 0 } });
      selectObjects([c.id]); finishConstruction('巨龙曲线 QL-Cu1 已构造');
      break;
    }
    case 'fixedCircle': {
      const p = ensurePointFromClick(hit, screen);
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      const src = hit?.obj && isLengthSource(hit.obj) ? hit.obj : selectedSource(isLengthSource);
      if (!src) return toast('请选择线段、圆或长度测量作为半径来源', 'warn');
      pushHistory();
      const c = addCircleObj('radiusFrom', [pendingIds()[0], src.id], { label: 'ω', color: '#4fd1c5' });
      selectObjects([c.id]); finishConstruction('定长圆已构造：半径 = ' + (objName(src) || '所选对象'));
      break;
    }
    case 'fixedPoint': {
      if (S.ui.pending.length < 2) {
        const p = ensurePointFromClick(hit, screen);
        if (pendingIds().includes(p.id)) return toast('起点和方向点不能相同', 'warn');
        pendingPush('point', p.id); return;
      }
      const src = hit?.obj && isLengthSource(hit.obj) ? hit.obj : selectedSource(isLengthSource);
      if (!src) return toast('请点击线段、圆或长度测量（距离标签）作为长度来源', 'warn');
      const [a, b] = pendingIds();
      pushHistory();
      const p = addPoint(0, 0, { sub: 'fixedDistance', deps: [a, b, src.id], label: nextPointLabel(S.state), color: '#4fd1c5', pointSize: 3.2 });
      selectObjects([p.id]); finishConstruction('定长点已构造：' + (objName(src) || '长度对象'));
      break;
    }
    case 'fixedSegment': {
      if (S.ui.pending.length < 2) {
        const p = ensurePointFromClick(hit, screen);
        if (pendingIds().includes(p.id)) return toast('起点和方向点不能相同', 'warn');
        pendingPush('point', p.id); return;
      }
      const src = hit?.obj && isLengthSource(hit.obj) ? hit.obj : selectedSource(isLengthSource);
      if (!src) return toast('请点击线段、圆或长度测量（距离标签）作为长度来源', 'warn');
      const [a, b] = pendingIds();
      pushHistory();
      const p = addPoint(0, 0, { sub: 'fixedDistance', deps: [a, b, src.id], label: nextPointLabel(S.state), color: '#4fd1c5', pointSize: 3.2 });
      const seg = addLineObj('segment', 'through', [a, p.id], { color: '#4fd1c5', width: 1.15 });
      selectObjects([seg.id]); finishConstruction('定长线段已构造：长度 = ' + (objName(src) || '长度对象'));
      break;
    }
    case 'fixedAngleLine': {
      if (!pendingHas('point')) { const p = ensurePointFromClick(hit, screen); pendingPush('point', p.id); return; }
      if (!pendingHas('line')) {
        const base = hit?.obj && ['line', 'segment', 'ray', 'vector'].includes(hit.obj.type) ? hit.obj : null;
        if (!base) return toast('请选择一条基线', 'warn');
        pendingPush('line', base.id); return;
      }
      const angleSrc = (hit?.obj && isAngleSource(hit.obj) ? hit.obj : selectedSource(isAngleSource));
      if (isAngleSource(angleSrc)) {
        pushHistory();
        const l = addLineObj('line', 'fixedAngle', [pendingIds()[0], pendingIds()[1], angleSrc.id], { color: '#f6c76b', width: 1.15, dash: 4 });
        selectObjects([l.id]); finishConstruction('定角线已构造：角 = ' + (objName(angleSrc) || '所选角'));
        break;
      }
      const p = ensurePointFromClick(hit, screen);
      if (pendingIds().includes(p.id)) return toast('角的点不能重复', 'warn');
      pendingPush('point', p.id);
      const anglePts = S.ui.pending.filter((x) => x.kind === 'point').slice(1);
      if (anglePts.length < 3) return;
      const [through, base] = [pendingIds()[0], pendingIds()[1]];
      const [A, B, C] = anglePts.map((x) => x.id);
      pushHistory();
      const l = addLineObj('line', 'fixedAngle3', [through, base, A, B, C], { color: '#f6c76b', width: 1.15, dash: 4 });
      selectObjects([l.id]); finishConstruction('定角线已构造（三点角）');
      break;
    }
    case 'equalDistancePoint': {
      const p = ensurePointFromClick(hit, screen);
      if (pendingIds().includes(p.id)) return toast('点不能重复', 'warn');
      pendingPush('point', p.id);
      if (S.ui.pending.length < 4) return;
      pushHistory();
      const [U, B, C, A] = pendingIds();
      const v = addPoint(0, 0, { sub: 'equalDistance', deps: [U, B, C, A], label: nextPointLabel(S.state), color: '#4fd1c5', pointSize: 3.1 });
      selectObjects([v.id]); finishConstruction('等距点已构造：CV = BU');
      break;
    }
    case 'circleCenter': {
      const p = ensurePointFromClick(hit, screen);
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      if (pendingIds()[0] === p.id) return toast('半径不能为零', 'warn');
      pushHistory();
      const c = addCircleObj('centerThrough', [pendingIds()[0], p.id], { label: 'ω' });
      selectObjects([c.id]); finishConstruction('圆已构造');
      break;
    }
    case 'circle3': case 'circumcircle': case 'incircle': case 'ninePointCircle': {
      const p = ensurePointFromClick(hit, screen);
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      if (S.ui.pending.length === 1) { if (p.id === pendingIds()[0]) return toast('请选择不同的点', 'warn'); pendingPush('point', p.id); return; }
      if (pendingIds().includes(p.id)) return toast('三点不能重复', 'warn');
      const ids = [...pendingIds(), p.id];
      pushHistory();
      let c; let msg = '圆已构造';
      if (tool === 'circle3') c = addCircleObj('threePoints', ids, { label: 'ω' });
      else if (tool === 'circumcircle') {
        triangleFromIds(ids, { centers: false });
        c = addCircleObj('threePoints', ids, { label: 'ω', color: '#7aa2ff' });
        msg = '外接圆已构造（未生成特征点）';
      } else if (tool === 'incircle') {
        triangleFromIds(ids, { centers: false });
        c = addCircleObj('incircle', ids, { label: 'ω', color: '#34d399' });
        msg = '内切圆已构造（未生成特征点）';
      } else {
        triangleFromIds(ids, { centers: false });
        c = addCircleObj('ninePoint', ids, { label: 'ω₉', color: '#c084fc', dash: 4 });
        msg = '九点圆已构造（未生成特征点）';
      }
      selectObjects([c.id]); finishConstruction(msg);
      break;
    }
    case 'diameterCircle': {
      const p = ensurePointFromClick(hit, screen);
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      if (pendingIds()[0] === p.id) return toast('直径不能为零', 'warn');
      pushHistory();
      const c = addCircleObj('diameter', [pendingIds()[0], p.id], { label: 'ω' });
      selectObjects([c.id]); finishConstruction('直径圆已构造');
      break;
    }
    case 'polygon': {
      const hitPoint = hit?.obj?.type === 'point' ? hit.obj : null;
      const p = hitPoint || addPt();
      if (S.ui.pending.length >= 3 && hitPoint && hitPoint.id === S.ui.pending[0].id) {
        pushHistory();
        const poly = addObject(S.state, { type: 'polygon', sub: 'polygon', deps: pendingIds(), style: { color: '#7aa2ff', width: 1.05, fill: 'rgba(122,162,255,.06)' } });
        selectObjects([poly.id]); finishConstruction('多边形已闭合');
        return;
      }
      if (pendingIds().includes(p.id)) return toast('该点已在多边形中', 'warn');
      pendingPush('point', p.id);
      break;
    }
    case 'triangle': case 'center': case 'centersAll': case 'coreCenters':
    case 'centroid': case 'circumcenter': case 'incenter': case 'orthocenter': case 'nineCenter': {
      const p = ensurePointFromClick(hit, screen);
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      if (S.ui.pending.length === 1) { if (p.id === pendingIds()[0]) return toast('请选择不同的顶点', 'warn'); pendingPush('point', p.id); return; }
      if (pendingIds().includes(p.id)) return toast('顶点不能重复', 'warn');
      const ids = [...pendingIds(), p.id];
      const centerKey = CENTER_TOOL_MAP[tool];
      if (centerKey) {
        const { tri, p: cp } = addSingleCenter(ids, centerKey);
        const def = centerDef(centerKey);
        finishConstruction(`已作${def.name} ${cp?.label || ''}`);
        switchTab('triangle');
        renderTrianglePanel();
      } else {
        const tri = triangleFromIds(ids);
        if (tool === 'centersAll') { ensureCenters(S.state, tri.id, CENTER_DEFS.map((d) => d.key)); tri.show.euler = true; tri.show.ninePoint = true; tri.show.orthic = true; }
        else if (tool === 'coreCenters') ensureCenters(S.state, tri.id, CORE_CENTERS);
        selectObjects([tri.id]); finishConstruction(tool === 'centersAll' ? '已生成全部 15 个特征点' : tool === 'coreCenters' ? '已生成全部五心' : '三角形已构造');
        switchTab('triangle');
      }
      break;
    }
    case 'eulerLine': case 'ninePoint': case 'orthic': {
      let tri = ensureActiveTriangle();
      if (!tri) {
        const p = ensurePointFromClick(hit, screen);
        if (!pendingHas('point')) { pendingPush('point', p.id); return; }
        if (S.ui.pending.length < 3) { if (pendingIds().includes(p.id)) return toast('顶点重复', 'warn'); pendingPush('point', p.id); return; }
        tri = triangleFromIds([...pendingIds(), p.id]);
      }
      pushHistory();
      if (tool === 'eulerLine') { tri.show.euler = true; ensureEulerLine(S.state, tri.id); toast('欧拉线已显示并固化'); }
      else if (tool === 'ninePoint') { tri.show.ninePoint = true; ensureTriangleCircle(S.state, tri.id, 'ninePoint'); toast('九点圆已显示并固化'); }
      else { tri.show.orthic = true; toast('垂足三角形已显示：虚线三角形 + 三个垂足'); }
      pendingClear(); afterMutation(); switchTab('triangle');
      break;
    }
    case 'reflectLine': case 'reflectPoint': {
      if (!pendingHas('source')) { const src = transformSourceAt(hit, screen); if (!src) return; pendingPush('source', src.id); return; }
      const src = objectById(S.state, pendingIds()[0]);
      if (!src) { pendingClear(); return; }
      let paramId;
      if (tool === 'reflectLine') {
        const l = currentCurveHit(hit); if (!l) return toast('请选择对称轴', 'warn');
        paramId = l.id;
      } else {
        const c = ensurePointFromClick(hit, screen); if (!c) return toast('请选择对称中心', 'warn');
        paramId = c.id;
      }
      pushHistory();
      const created = addTransformResult(src, tool, [paramId]);
      if (!created.length) { toast('该对象暂不支持此变换', 'warn'); return; }
      selectObjects(created.map((o) => o.id));
      finishConstruction(`已对${TYPE_NAME[src.type]}作对称变换`);
      break;
    }
    case 'rotate': {
      if (!pendingHas('source')) { const src = transformSourceAt(hit, screen); if (!src) return; pendingPush('source', src.id); return; }
      const src = objectById(S.state, pendingIds()[0]);
      if (!src) { pendingClear(); return; }
      const c = ensurePointFromClick(hit, screen); if (!c) return toast('请选择旋转中心', 'warn');
      pushHistory();
      const created = addTransformResult(src, 'rotate', [c.id], { angle: rad(S.ui.toolParams.angle) });
      if (!created.length) { toast('该对象暂不支持旋转', 'warn'); return; }
      selectObjects(created.map((o) => o.id));
      finishConstruction(`已旋转 ${S.ui.toolParams.angle}°`);
      break;
    }
    case 'translate': {
      if (!pendingHas('source')) { const src = transformSourceAt(hit, screen); if (!src) return; pendingPush('source', src.id); return; }
      const src = objectById(S.state, pendingIds()[0]);
      if (!src) { pendingClear(); return; }
      if (S.ui.pending.length === 1) {
        const p = ensurePointFromClick(hit, screen); if (!p) return;
        pendingPush('point', p.id); return;
      }
      if (S.ui.pending.length === 2) {
        const p = ensurePointFromClick(hit, screen); if (!p) return;
        pushHistory();
        const created = addTransformResult(src, 'translate', [pendingIds()[1], p.id]);
        if (!created.length) { toast('该对象暂不支持平移', 'warn'); return; }
        selectObjects(created.map((o) => o.id));
        finishConstruction('平移变换已构造');
      }
      break;
    }
    case 'homothety': {
      if (!pendingHas('source')) { const src = transformSourceAt(hit, screen); if (!src) return; pendingPush('source', src.id); return; }
      const src = objectById(S.state, pendingIds()[0]);
      if (!src) { pendingClear(); return; }
      const c = ensurePointFromClick(hit, screen); if (!c) return toast('请选择位似中心', 'warn');
      pushHistory();
      const created = addTransformResult(src, 'homothety', [c.id], { ratio: S.ui.toolParams.ratio });
      if (!created.length) { toast('该对象暂不支持位似', 'warn'); return; }
      selectObjects(created.map((o) => o.id));
      finishConstruction(`位似变换已构造（k=${S.ui.toolParams.ratio}）`);
      break;
    }
    case 'inversion': {
      if (!pendingHas('source')) {
        const src = transformSourceAt(hit, screen); if (!src) return;
        pendingPush('source', src.id); return;
      }
      const src = objectById(S.state, pendingIds()[0]);
      if (!src) { pendingClear(); return; }
      const circleHit = hit?.obj?.type === 'circle' && hit.obj.valid ? hit.obj : null;
      // Legacy-friendly shortcut: first click circle, then click a point → invert that point.
      if (src.type === 'circle' && !circleHit) {
        const p = currentPointHit(hit);
        if (p) {
          pushHistory();
          invertSourceObject(p, src);
          return;
        }
        return toast('请选择反演圆（或先点对象，再点反演圆）', 'warn');
      }
      if (!circleHit) return toast('请选择反演圆', 'warn');
      if (circleHit.id === src.id) return toast('反演圆的反演像是自身', 'warn');
      pushHistory();
      invertSourceObject(src, circleHit);
      break;
    }
    case 'iranianInversion': {
      const p = ensurePointFromClick(hit, screen);
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      if (S.ui.pending.length < 3) {
        if (pendingIds().includes(p.id)) return toast('A、B、C 不能重复', 'warn');
        pendingPush('point', p.id); return;
      }
      if (S.ui.pending.length === 3) {
        const ids = [...pendingIds(), p.id];
        pushHistory();
        const np = addObject(S.state, { type: 'point', sub: 'iranianInversion', deps: ids, label: uniqueLabel(S.state, nextPointLabel(S.state)), style: { color: '#c084fc', pointSize: 3.0 } });
        selectObjects([np.id]); finishConstruction('伊朗反演点已构造：A、B、C 定义幂与角平分线');
      }
      break;
    }
    case 'lineBisector': {
      const l = currentCurveHit(hit);
      if (!l) return toast('请依次点击两条直线或线段', 'warn');
      if (!pendingHas('line')) { pendingPush('line', l.id); return; }
      if (pendingIds()[0] === l.id) return toast('请选择另一条直线', 'warn');
      const l1 = objectById(S.state, pendingIds()[0]);
      if (!l1 || !l1.valid) { pendingClear(); return toast('第一条直线已失效', 'warn'); }
      if (Math.abs(cross(l1.g.d, l.g.d)) < 1e-7) return toast('两条直线平行，没有角平分线', 'warn');
      pushHistory();
      const b1 = addLineObj('line', 'bisector2', [l1.id, l.id], { color: '#b45309', width: 1.05, dash: 0 });
      const b2 = addLineObj('line', 'bisector2', [l1.id, l.id], { color: '#0f766e', width: 1.05, dash: 0 });
      b1.branch = 0; b2.branch = 1;
      selectObjects([b1.id, b2.id]);
      finishConstruction('两条角平分线已构造（互相垂直）');
      break;
    }
    case 'isogonal': {
      if (S.ui.pending.length < 3) {
        const p = ensurePointFromClick(hit, screen);
        if (pendingIds().includes(p.id)) return toast('三个点不能重复', 'warn');
        pendingPush('point', p.id); return;
      }
      const l = currentCurveHit(hit);
      if (!l) return toast('请选择一条过顶点的直线、射线或线段', 'warn');
      if (!['line', 'segment', 'ray', 'vector'].includes(l.type)) return toast('请选择直线、射线或线段', 'warn');
      const A = objectById(S.state, pendingIds()[0]);
      const B = objectById(S.state, pendingIds()[1]);
      const C = objectById(S.state, pendingIds()[2]);
      if (!A || !B || !C) { pendingClear(); return; }
      const off = Math.abs(cross(l.g.d, sub(B.g, l.g.a))) / Math.max(1e-9, Math.hypot(l.g.d.x, l.g.d.y));
      if (off > 1e-5 * Math.max(1, dist(A.g, B.g) + dist(B.g, C.g))) return toast('等角线要求所选直线经过顶点 B', 'warn');
      pushHistory();
      const ln = addLineObj('line', 'isogonal', [A.id, B.id, C.id, l.id], { color: '#0f766e', width: 1.05, dash: 0 });
      selectObjects([ln.id]); finishConstruction('等角线已构造');
      break;
    }
    case 'harmonic': {
      const p = ensurePointFromClick(hit, screen);
      if (!pendingHas('point')) { pendingPush('point', p.id); return; }
      if (S.ui.pending.length === 1) {
        if (p.id === pendingIds()[0]) return toast('请选择不同的点', 'warn');
        pendingPush('point', p.id); return;
      }
      if (pendingIds().includes(p.id)) return toast('三点不能重复', 'warn');
      const A = objectById(S.state, pendingIds()[0]), B = objectById(S.state, pendingIds()[1]);
      if (A && B) {
        const ab = sub(B.g, A.g);
        const off = Math.abs(cross(ab, sub(p.g, A.g))) / Math.max(1e-9, Math.hypot(ab.x, ab.y));
        if (off > 1e-5 * Math.max(1, dist(A.g, B.g))) return toast('调和点要求 A、B、C 三点共线', 'warn');
      }
      pushHistory();
      const hp = addObject(S.state, {
        type: 'point', sub: 'harmonic', deps: [...pendingIds(), p.id],
        label: uniqueLabel(S.state, 'D'), style: { color: '#263342', pointSize: 3.0 },
      });
      selectObjects([hp.id]);
      finishConstruction('调和共轭点已构造：(A,B;C,D) = −1');
      break;
    }
    case 'polar': {
      const circleHit = hit?.obj?.type === 'circle' && hit.obj.valid ? hit.obj : null;
      const pointHit = currentPointHit(hit);
      const newPoint = () => { pushHistory(); return addPoint(world.x, world.y); };
      if (!pendingHas('point') && !pendingHas('circle')) {
        if (circleHit) { pendingPush('circle', circleHit.id); return; }
        const p = pointHit || newPoint(); pendingPush('point', p.id); return;
      }
      if (pendingHas('point') && !pendingHas('circle')) {
        if (!circleHit) return toast('请选择一个圆', 'warn');
        const p = objectById(S.state, pendingIds()[0]);
        pushHistory();
        const ln = addLineObj('line', 'polar', [p.id, circleHit.id], { color: '#6d28d9', dash: 4, width: 1.05 });
        selectObjects([ln.id]); finishConstruction('极线已构造（点关于圆的极线）');
        break;
      }
      if (pendingHas('circle') && !pendingHas('point')) {
        const p = pointHit || newPoint();
        const c = objectById(S.state, S.ui.pending.find((x) => x.kind === 'circle').id);
        pushHistory();
        const ln = addLineObj('line', 'polar', [p.id, c.id], { color: '#6d28d9', dash: 4, width: 1.05 });
        selectObjects([ln.id]); finishConstruction('极线已构造（点关于圆的极线）');
        break;
      }
      break;
    }
    case 'pole': {
      const circleHit = hit?.obj?.type === 'circle' && hit.obj.valid ? hit.obj : null;
      const lineHit = hit?.obj && ['line', 'segment', 'ray'].includes(hit.obj.type) && hit.obj.valid ? hit.obj : null;
      if (!pendingHas('line') && !pendingHas('circle')) {
        if (circleHit) { pendingPush('circle', circleHit.id); return; }
        if (lineHit) { pendingPush('line', lineHit.id); return; }
        return toast('请选择一条直线或一个圆', 'warn');
      }
      if (pendingHas('line') && !pendingHas('circle')) {
        if (!circleHit) return toast('请选择一个圆', 'warn');
        const ln = objectById(S.state, pendingIds()[0]);
        pushHistory();
        const pp = addObject(S.state, {
          type: 'point', sub: 'pole', deps: [ln.id, circleHit.id],
          label: uniqueLabel(S.state, 'P'), style: { color: '#263342', pointSize: 3.0 },
        });
        selectObjects([pp.id]); finishConstruction('极点已构造（直线关于圆的极点）');
        break;
      }
      if (pendingHas('circle') && !pendingHas('line')) {
        if (!lineHit) return toast('请选择一条直线', 'warn');
        const c = objectById(S.state, S.ui.pending.find((x) => x.kind === 'circle').id);
        pushHistory();
        const pp = addObject(S.state, {
          type: 'point', sub: 'pole', deps: [lineHit.id, c.id],
          label: uniqueLabel(S.state, 'P'), style: { color: '#263342', pointSize: 3.0 },
        });
        selectObjects([pp.id]); finishConstruction('极点已构造（直线关于圆的极点）');
        break;
      }
      break;
    }
    case 'crossRatio': {
      const p = ensurePointFromClick(hit, screen);
      if (pendingIds().includes(p.id)) return toast('四点不能重复', 'warn');
      pendingPush('point', p.id);
      if (S.ui.pending.length === 4) {
        pushHistory();
        const m = addMeasure('crossRatio', pendingIds(), world);
        m.meta = { ...(m.meta || {}), names: pendingIds().map((id) => objectById(S.state, id)?.label).filter(Boolean) };
        selectObjects([m.id]); finishConstruction('交比已测量');
      }
      break;
    }
    case 'measureDistance': case 'measureRatio': {
      if (tool === 'measureDistance' && !pendingIds().length && hit?.obj?.type === 'segment' && hit.obj.deps?.length >= 2) {
        pushHistory();
        const seg = hit.obj;
        const a = objectById(S.state, seg.deps[0]), b = objectById(S.state, seg.deps[1]);
        const m = addMeasure('distance', [a.id, b.id], a.g && b.g ? { x: (a.g.x + b.g.x) / 2, y: (a.g.y + b.g.y) / 2 } : world);
        selectObjects([m.id]); finishConstruction('线段长度已测量'); break;
      }
      const p = ensurePointFromClick(hit, screen);
      if (pendingIds().includes(p.id)) return toast('点不能重复', 'warn');
      pendingPush('point', p.id);
      if (S.ui.pending.length === (tool === 'measureDistance' ? 2 : 4)) {
        pushHistory();
        const m = addMeasure(tool === 'measureDistance' ? 'distance' : 'ratio', pendingIds(), world);
        m.x = world.x; m.y = world.y;
        selectObjects([m.id]); finishConstruction(tool === 'measureDistance' ? '距离已测量' : '线段比已测量');
      }
      break;
    }
    case 'measureAngle': {
      const curveHit = currentCurveHit(hit);
      const lineCurve = curveHit && ['line', 'segment', 'ray', 'vector'].includes(curveHit.type) ? curveHit : null;
      if (pendingHas('curve') || (!pendingHas('point') && lineCurve && !currentPointHit(hit))) {
        if (!lineCurve) return toast('请选择两条射线或直线', 'warn');
        if (!pendingHas('curve')) { pendingPush('curve', lineCurve.id); return; }
        if (pendingIds()[0] === lineCurve.id) return toast('请选择另一条射线', 'warn');
        pushHistory();
        const m = addMeasure('angle2', [pendingIds()[0], lineCurve.id], world);
        selectObjects([m.id]); finishConstruction('有向角已测量（逆时针为正）');
        break;
      }
      const p = ensurePointFromClick(hit, screen);
      if (pendingIds().includes(p.id)) return toast('点不能重复', 'warn');
      pendingPush('point', p.id);
      if (S.ui.pending.length === 3) {
        pushHistory();
        const m = addMeasure('angle', pendingIds(), world); selectObjects([m.id]); finishConstruction('有向角已测量（顺时针为正）');
      }
      break;
    }
    case 'measureArea': {
      if (hit?.obj?.type === 'polygon') {
        pushHistory(); const m = addMeasure('area', hit.obj.deps, world); selectObjects([m.id]); finishConstruction('面积已测量'); break;
      }
      const p = ensurePointFromClick(hit, screen);
      if (pendingIds().includes(p.id)) return toast('点不能重复', 'warn');
      pendingPush('point', p.id);
      if (S.ui.pending.length === 3) { pushHistory(); const m = addMeasure('area', pendingIds(), world); selectObjects([m.id]); finishConstruction('面积已测量'); }
      break;
    }
    case 'text': {
      pushHistory();
      const t = addObject(S.state, { type: 'text', sub: 'text', x: world.x, y: world.y, text: S.ui.toolParams.text || '注', label: '', style: { color: '#38465a', fontSize: 14 } });
      selectObjects([t.id]); afterMutation(); setTool('select'); switchTab('objects'); toast('文本已放置，可在右侧修改文字');
      break;
    }
  }
  if (!['freePoint', 'onObject', 'midpoint', 'intersection', 'foot'].includes(tool)) requestRender();
}

/* pointer events */
function screenPos(e) {
  const r = $('#board').getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function onPointerDown(e) {
  if (e.button === 2) return;
  const screen = screenPos(e); const world = S.renderer.toWorld(screen);
  if (e.pointerType === 'touch') {
    S.ui.pointers.set(e.pointerId, screen);
    if (S.ui.pointers.size >= 2) {
      const pts = [...S.ui.pointers.values()];
      const a = pts[0], b = pts[1];
      S.ui.pinch = { dist: Math.hypot(b.x - a.x, b.y - a.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      S.ui.drag = null; S.ui.pan = null;
      $('#board').setPointerCapture?.(e.pointerId);
      return;
    }
  }
  const hit = hitTest(screen);
  if (e.button === 1 || S.ui.spaceDown) { startPan(e, screen); return; }
  if (S.ui.tool === 'select') {
    const additive = !!(e.shiftKey || e.ctrlKey || e.metaKey || S.ui.multiSelect);
    if (hit) {
      const o = hit.obj;
      if (isDraggablePoint(o)) {
        if (!S.ui.selection.includes(o.id)) selectObjects([o.id], additive);
        else if (e.shiftKey || e.ctrlKey || e.metaKey) { selectObjects([o.id], true); return; }
        const ids = selectedObjects().filter(isDraggablePoint).map((x) => x.id);
        pushHistory();
        const base = new Map();
        for (const id of ids) {
          const q = objectById(S.state, id);
          if (q?.sub === 'free') base.set(id, { x: q.x, y: q.y });
        }
        S.ui.drag = { start: screen, last: screen, ids, moved: false, base };
        $('#board').setPointerCapture?.(e.pointerId);
        setCursor('grabbing');
      } else if (o.type === 'text' || o.type === 'measure') {
        selectObjects([o.id], additive);
        pushHistory();
        S.ui.labelDrag = { id: o.id, start: screen, moved: false, base: o.type === 'measure' ? (o.meta?.labelPos || null) : { x: o.x, y: o.y } };
        $('#board').setPointerCapture?.(e.pointerId);
        setCursor('grabbing');
      } else {
        selectObjects([o.id], additive);
        if (o.type === 'triangle') { S.ui.activeTriangle = o.id; if (S.ui.tab === 'triangle') renderTrianglePanel(); }
      }
    } else {
      selectObjects([]);
      startPan(e, screen);
    }
    return;
  }
  handleCanvasClick(screen, e);
}
function startPan(e, screen) {
  S.ui.pan = { start: screen, cx: S.state.view.cx, cy: S.state.view.cy };
  setCursor('grabbing');
  $('#board').setPointerCapture?.(e.pointerId);
}
function onPointerMove(e) {
  const screen = screenPos(e);
  if (e.pointerType === 'touch' && S.ui.pointers.has(e.pointerId)) {
    S.ui.pointers.set(e.pointerId, screen);
    if (S.ui.pointers.size >= 2) {
      const pts = [...S.ui.pointers.values()];
      const a = pts[0], b = pts[1];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (S.ui.pinch && S.ui.pinch.dist > 0) {
        zoomAt(mid, dist / S.ui.pinch.dist);
        S.state.view.cx += mid.x - S.ui.pinch.mid.x;
        S.state.view.cy += mid.y - S.ui.pinch.mid.y;
      }
      S.ui.pinch = { dist, mid };
      requestRender(); updateHUD();
      return;
    }
  }
  S.ui.pointer = { x: screen.x, y: screen.y, ...S.renderer.toWorld(screen) };
  const coords = $('#coords'); if (coords) coords.innerHTML = `x ${fmt(S.ui.pointer.wx, 2).padStart(6, ' ')}&nbsp;&nbsp;y ${fmt(S.ui.pointer.wy, 2).padStart(6, ' ')}`;
  if (S.ui.labelDrag) {
    const ld = S.ui.labelDrag; const o = objectById(S.state, ld.id);
    if (o) {
      const w = S.renderer.toWorld(screen);
      if (o.type === 'text') { o.x = w.x; o.y = w.y; o.g = { kind: 'text', x: w.x, y: w.y, text: o.text || '' }; }
      else { o.meta = o.meta || {}; o.meta.labelPos = { x: w.x, y: w.y }; }
      ld.moved = true; requestRender(); updateHUD();
    }
    return;
  }
  if (S.ui.drag) {
    const delta = { x: (screen.x - S.ui.drag.start.x) / S.state.view.scale, y: -(screen.y - S.ui.drag.start.y) / S.state.view.scale };
    if (Math.hypot(screen.x - S.ui.drag.start.x, screen.y - S.ui.drag.start.y) > 1) S.ui.drag.moved = true;
    const w = S.renderer.toWorld(screen);
    for (const id of S.ui.drag.ids) {
      const o = objectById(S.state, id);
      if (!o) continue;
      if (o.sub === 'free') {
        const base = S.ui.drag.base.get(id);
        if (base) { o.x = base.x + delta.x; o.y = base.y + delta.y; }
      } else if (o.sub === 'pointOnCircle') {
        const c = objectById(S.state, o.deps[0]);
        if (c?.valid && c.type === 'circle') o.theta = Math.atan2(w.y - c.g.center.y, w.x - c.g.center.x);
      } else if (o.sub === 'pointOnLine') {
        const l = objectById(S.state, o.deps[0]);
        if (l?.valid) {
          const q = projectOnLine(w, l.g.a, l.g.d);
          o.t = l.type === 'segment' ? clamp(q.t / Math.max(1e-9, l.g.len), 0.015, 0.985) : q.t;
        }
      }
    }
    recompute(S.state); recordTraces(); requestRender(); updateHUD();
    return;
  }
  if (S.ui.pan) {
    S.state.view.cx = S.ui.pan.cx + (screen.x - S.ui.pan.start.x);
    S.state.view.cy = S.ui.pan.cy + (screen.y - S.ui.pan.start.y);
    requestRender(); updateHUD();
    return;
  }
  const hit = hitTest(screen);
  if (hit?.id !== S.ui.hover?.id) { S.ui.hover = hit ? { id: hit.id, obj: hit.obj } : null; if (S.ui.tool === 'select') setCursor(hit ? (isDraggablePoint(hit.obj) || hit.obj?.type === 'text' || hit.obj?.type === 'measure' ? 'grab' : 'pointer') : 'default'); requestRender(); }
  else if (S.ui.pending.length || S.ui.tool !== 'select') requestRender();
}
function onPointerUp(e) {
  if (e.pointerType === 'touch') {
    S.ui.pointers.delete(e.pointerId);
    if (S.ui.pointers.size < 2) S.ui.pinch = null;
  }
  if (S.ui.labelDrag) {
    const moved = S.ui.labelDrag.moved; S.ui.labelDrag = null; setCursor('default');
    if (moved) { afterMutation(); scheduleAutosave(); setSavedState('未保存'); } else requestRender();
    return;
  }
  if (S.ui.drag) {
    const moved = S.ui.drag.moved;
    S.ui.drag = null; setCursor('default');
    if (moved) { afterMutation(); scheduleAutosave(); setSavedState('未保存'); }
    else { requestRender(); }
  }
  if (S.ui.pan) { S.ui.pan = null; setCursor(S.ui.tool === 'select' ? 'default' : 'crosshair'); scheduleAutosave(); }
}
function onWheel(e) {
  if (!S.state.settings.wheel) return;
  e.preventDefault();
  const screen = screenPos(e);
  zoomAt(screen, e.deltaY < 0 ? 1.1 : 0.9);
}
function onDoubleClick(e) {
  const screen = screenPos(e); const hit = hitTest(screen);
  if (S.ui.tool === 'polygon' && S.ui.pending.length >= 3) {
    if (hit?.obj?.type === 'point' && hit.obj.id === S.ui.pending[0].id) { pushHistory(); const poly = addObject(S.state, { type: 'polygon', sub: 'polygon', deps: pendingIds(), style: { color: '#7aa2ff', width: 1.05, fill: 'rgba(122,162,255,.06)' } }); selectObjects([poly.id]); finishConstruction('多边形已闭合'); }
    return;
  }
  if (hit?.obj?.type === 'point') openRename(hit.obj);
  else if (hit?.obj?.type === 'text') openTextEdit(hit.obj);
}

function openRename(o) {
  modal(`<div class="modal-head"><div><span class="eyebrow">LABEL</span><h3>重命名对象</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body"><input class="input" id="rename-input" value="${esc(o.label || '')}" maxlength="24" autofocus/><p style="font-size:8.5px;color:var(--dim);line-height:1.6;margin:7px 0 0">名称用于命题、证明与关系扫描，建议使用单个大写字母或常见记号。</p></div>
    <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn primary" id="rename-ok">保存</button></div>`,
  { onMount: (root, close) => { const inp = $('#rename-input', root); inp.focus(); inp.select(); const go = () => { pushHistory(); o.label = uniqueLabelForEdit(o, inp.value.trim() || o.label); close(); afterMutation(); }; $('#rename-ok', root).addEventListener('click', go); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); } });
}
function openTextEdit(o) {
  modal(`<div class="modal-head"><div><span class="eyebrow">ANNOTATION</span><h3>编辑文本</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body"><textarea class="input" id="text-input" maxlength="200">${esc(o.text || '')}</textarea></div>
    <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn primary" id="text-ok">保存</button></div>`,
  { onMount: (root, close) => { const inp = $('#text-input', root); inp.focus(); $('#text-ok', root).addEventListener('click', () => { pushHistory(); o.text = inp.value; close(); afterMutation(); }); } });
}

/* keyboard / shortcuts */
function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}
function selectAllGeometry() {
  const ids = S.state.objects.filter((o) => o.visible && o.valid).map((o) => o.id);
  if (!ids.length) return toast('画板上还没有几何对象', 'warn');
  selectObjects(ids);
  toast(`已选中 ${ids.length} 个几何对象`);
}

function keydown(e) {
  if (e.key === 'Escape') {
    if ($('#cmdk')?.hidden === false) { closeCmdk(); e.preventDefault(); return; }
    if ($('#modal-root').innerHTML) { $('#modal-root').innerHTML = ''; return; }
    if (S.ui.pending.length) { pendingClear(); toast('已取消当前构造'); return; }
    if (S.ui.tool !== 'select') { setTool('select'); return; }
    selectObjects([]);
    return;
  }
  if (isTyping(e)) return;
  const meta = e.ctrlKey || e.metaKey;
  if (meta && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAllGeometry(); return; }
  if (e.code === 'Space') { S.ui.spaceDown = true; setCursor('grab'); e.preventDefault(); return; }
  if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); saveSession(); return; }
  if (meta && e.key.toLowerCase() === 'o') { e.preventDefault(); $('#file-input').click(); return; }
  if (meta && e.key.toLowerCase() === 'e') { e.preventDefault(); openExport(); return; }
  if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); return; }
  if (meta && e.key === 'Enter') { e.preventDefault(); runLLMProof(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (S.ui.selection.length) { pushHistory(); removeObjects(S.state, S.ui.selection); S.ui.selection = []; afterMutation(); toast('已删除选中对象'); } return; }
  if (e.key === 'Enter' && S.ui.tool === 'polygon' && S.ui.pending.length >= 3) {
    pushHistory(); const poly = addObject(S.state, { type: 'polygon', sub: 'polygon', deps: pendingIds(), style: { color: '#7aa2ff', width: 1.05, fill: 'rgba(122,162,255,.06)' } }); selectObjects([poly.id]); finishConstruction('多边形已闭合'); return;
  }
  const kmap = { v: 'select', p: 'freePoint', s: 'segment', l: 'line', c: 'circleCenter', t: 'triangle', g: null, a: null, f: null };
  const k = e.key.toLowerCase();
  if (k === 'f') { fitView(); return; }
  if (k === 'g') { S.state.settings.grid = !S.state.settings.grid; afterMutation(); toast(S.state.settings.grid ? '网格已开启' : '网格已关闭'); return; }
  if (k === 'a') { S.state.settings.axes = !S.state.settings.axes; afterMutation(); return; }
  if (kmap[k]) { setTool(kmap[k]); return; }
  if (e.shiftKey && k === '?') openShortcuts();
}
function keyup(e) {
  if (e.code === 'Space') { S.ui.spaceDown = false; setCursor(S.ui.tool === 'select' ? 'default' : 'crosshair'); }
}

/* ------------------------------ AI execution ----------------------------- */
async function scanNow(opts = {}) {
  S.ui.scanStatus = 'scanning'; renderExplorePanel();
  try {
    const snap = buildSnapshot(S.state);
    const result = await scanRelations(snap, { categories: [...S.ui.relationCats], max: 200 });
    S.ui.relations = result.relations || [];
    S.ui.scanMs = result.ms || 0;
    S.ui.scanStatus = 'done';
    S.ui.lastSnapshot = snap;
    renderExplorePanel();
    toast(`扫描完成：发现 ${S.ui.relations.length} 条关系 · ${S.ui.scanMs.toFixed(1)} ms`);
  } catch (err) {
    S.ui.scanStatus = 'error';
    renderExplorePanel();
    toast('关系扫描失败：' + err.message, 'error');
  }
}
async function generateNow() {
  if (S.ui.generating) return;
  S.ui.generating = true; renderExplorePanel();
  try {
    const seed = Math.floor(Math.random() * 1e8);
    const res = await apiGenerate({ seed, mode: 'mixed' });
    S.ui.generated = res.problems || [];
    S.ui.generatedSeed = seed;
    toast(`已生成 ${S.ui.generated.length} 道候选命题`);
  } catch (e) {
    toast('后端不可用，使用本地构型库生成占位命题', 'warn');
    S.ui.generated = SCENARIOS.slice(0, 4).map((s) => ({ title: s.title, statement: s.description, kind: 'mixed', theorem: s.tags[0], difficulty: s.difficulty, tags: s.tags, hint: '从题库载入后运行 AI 分析。', verifiedOn: 1, scenarioId: s.id }));
  } finally {
    S.ui.generating = false; renderExplorePanel();
  }
}
async function runAI() {
  if (S.ui.aiBusy) return;
  if (!S.ui.goal) {
    const inferred = inferGoalFromSelection(S.state, S.ui.selection);
    if (inferred) S.ui.goal = inferred;
    else if (S.ui.activeTriangle) {
      const tri = objectById(S.state, S.ui.activeTriangle);
      if (tri?.centers?.O && tri?.centers?.G && tri?.centers?.H) {
        S.ui.goal = { kind: 'collinear', ids: [tri.centers.O, tri.centers.G, tri.centers.H], title: '证明 O、G、H 三点共线', source: 'triangle', scenarioId: S.ui.scenarioId };
      }
    }
  }
  if (!S.ui.goal) { toast('请先选择对象设定目标', 'warn'); switchTab('ai'); return; }
  S.ui.aiBusy = true; S.ui.aiResult = null; S.ui.backendResult = null; S.ui.solutionTab = 'verdict';
  switchTab('ai');
  try {
    const goal = S.ui.goal;
    const ev = evaluateGoal(S.state, goal);
    const stab = stabilityCheck(S.state, goal, 8);
    const proof = S.ui.proof && (S.ui.goal.scenarioId === S.ui.scenarioId) ? S.ui.proof : (goal.scenarioId ? PROOFS[goal.scenarioId] || null : null);
    const local = buildSolution(S.state, goal, ev, stab, { proof });
    S.ui.aiResult = local;
    S.ui.backendResult = null;
    renderAIPanel();
    // Backend independent check (non-blocking for UI)
    if (S.ui.backend.online && goal.kind !== 'identity' && goal.kind !== 'isogonal') {
      try {
        const payload = goalPayload(S.state, goal);
        payload.scenarioId = goal.scenarioId || S.ui.scenarioId;
        const t0 = performance.now();
        const back = await apiVerify(payload);
        S.ui.backend.latency = Math.round(performance.now() - t0);
        S.ui.backendResult = back;
        if (back.ok !== undefined) {
          // Prefer theorem-complete local narrative; use backend for numbers.
          S.ui.aiResult = { ...local, backend: back, confidence: Math.max(local.confidence, back.confidence || 0) };
        }
        renderAIPanel();
      } catch (e) {
        console.warn('backend verify failed', e);
        toast('后端复核失败，保留本地结果', 'warn');
      }
    } else {
      await checkBackend();
    }
    if (local.status === 'verified') toast(`结论成立 · 置信度 ${local.confidence.toFixed(1)}%`);
    else if (local.status === 'unstable') toast('当前构型成立；微扰后不稳定，结果依赖当前自由点位置', 'warn');
    else toast('当前图形不满足目标' + (ev.detail ? '：' + ev.detail : '，请检查选择或拖动图形'), 'warn');
  } catch (err) {
    console.error(err); toast('推理失败：' + err.message, 'error');
  } finally {
    S.ui.aiBusy = false; renderAIPanel();
  }
}
function addConclusionToCanvas() {
  const goal = S.ui.goal; if (!goal) return;
  pushHistory();
  try {
    if (goal.kind === 'collinear') {
      const pts = goal.ids.map((id) => objectById(S.state, id)).filter((o) => o?.valid);
      if (pts.length >= 2) {
        const exists = S.state.objects.some((o) => o.type === 'line' && o.deps.includes(pts[0].id) && o.deps.includes(pts[1].id));
        if (!exists) addLineObj('line', 'through', [pts[0].id, pts[1].id], { color: '#f6c76b', dash: 4, label: 'ℓ' });
      }
    } else if (goal.kind === 'concyclic') {
      const pts = goal.ids.map((id) => objectById(S.state, id)).filter((o) => o?.valid);
      if (pts.length >= 3) addCircleObj('threePoints', pts.slice(0, 3).map((p) => p.id), { label: 'Γ', color: '#c084fc', dash: 4 });
    } else if (goal.kind === 'midpoint') {
      const A = objectById(S.state, goal.pairIds?.[0]), B = objectById(S.state, goal.pairIds?.[1]);
      if (A && B) addObject(S.state, { type: 'point', sub: 'midpoint', deps: [A.id, B.id], label: uniqueLabel(S.state, 'M'), style: { color: '#f6c76b', pointSize: 3.0 } });
    } else if (goal.kind === 'concurrent') {
      const ls = (goal.lineIds || []).map((id) => objectById(S.state, id)).filter((o) => o?.valid);
      if (ls.length >= 2) {
        const pts = intersectionOfCurves(getCurve(ls[0]), getCurve(ls[1]));
        if (pts[0]) addObject(S.state, { type: 'point', sub: 'intersection', deps: [ls[0].id, ls[1].id], branch: 0, label: uniqueLabel(S.state, 'P'), style: { color: '#f6c76b', pointSize: 3.0 } });
      }
    } else if (goal.kind === 'tangent' && goal.lineId && goal.circleId) {
      const l = objectById(S.state, goal.lineId), c = objectById(S.state, goal.circleId);
      if (l && c) {
        const p = projectOnLine(c.g.center, l.g.a, l.g.d);
        addObject(S.state, { type: 'point', sub: 'foot', deps: [c.deps[0] || c.id, l.id], label: uniqueLabel(S.state, 'T'), style: { color: '#f6c76b', pointSize: 3.0 } });
      }
    }
    afterMutation(); toast('结论对应的几何对象已加入画板');
  } catch (e) { toast('无法加入画板：' + e.message, 'error'); }
}
function copyProof() {
  const r = S.ui.aiResult; if (!r) return;
  const lines = [`目标：${r.goalStatement}`, '', `【结论】${r.status === 'verified' ? '成立' : r.status === 'unstable' ? '当前构型成立（微扰不稳定）' : '未通过验证'}（置信度 ${r.confidence.toFixed(1)}%）`, `【定理】${r.synthetic.theorem}`, r.synthetic.summary, '', '【综合法】', ...(r.synthetic.steps || []).map((s, i) => `${i + 1}. ${s}`), '', '【计算验证】', ...(r.computation.lines || []), '', `残差 ${fmt(r.verification.residual, 12)}`];
  navigator.clipboard?.writeText(lines.join('\n')).then(() => toast('证明与计算过程已复制')).catch(() => toast('复制失败', 'error'));
}

/* ------------------------------ scenario loading ------------------------- */
function installState(st, { fit = true, preserveView = false } = {}) {
  const oldView = S.state?.view;
  S.state = st;
  if (preserveView && oldView) S.state.view = { ...oldView };
  S.renderer.state = S.state;
  applyCompactVisuals(S.state);
  recompute(S.state);
  S.ui.selection = []; S.ui.pending = []; S.ui.relations = []; S.ui.scanStatus = 'idle';
  S.ui.highlight = null; S.ui.aiResult = null; S.ui.backendResult = null; S.ui.solutionTab = 'verdict';
  S.ui.activeTriangle = S.state.objects.find((o) => o.type === 'triangle' && o.valid)?.id || null;
  if (!S.state.view.cx && !S.state.view.cy) centerView(92);
  requestRender(); updateHUD(); syncDocName();
}
function loadScenario(id) {
  const built = buildScenario(id);
  if (!built) return toast('构型载入失败', 'error');
  if (S.state) pushHistory();
  installState(built.state);
  S.ui.scenarioId = id;
  S.ui.goal = built.goal;
  if (S.ui.goal) S.ui.goal.source = 'scenario';
  if (S.ui.goal && built.proof?.theorem) S.ui.goal.theorem = built.proof.theorem;
  S.ui.proof = built.proof || PROOFS[id] || null;
  S.ui.activeTriangle = S.state.objects.find((o) => o.type === 'triangle' && o.valid)?.id || null;
  S.ui.tab = built.focus === 'ai' ? 'ai' : 'triangle';
  S.ui.libraryFilter = '全部';
  fitView({ padding: 82, maxScale: 90 });
  $$('#inspector-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === S.ui.tab));
  renderAll();
  scheduleAutosave();
  toast(`已载入「${built.scenario?.title || id}」`);
  if (S.ui.tab === 'explore') setTimeout(() => scanNow(), 120);
}

function buildGeneratedState(problem) {
  const st = createState(problem.title || 'AI 自动命题');
  const V = problem.vertices || [[-3, -1.4], [3.1, -1.2], [0.1, 2.6]];
  const A = addObject(st, { type: 'point', sub: 'free', x: V[0][0], y: V[0][1], label: 'A', style: { color: '#ff7a59' } });
  const B = addObject(st, { type: 'point', sub: 'free', x: V[1][0], y: V[1][1], label: 'B', style: { color: '#ff7a59' } });
  const C = addObject(st, { type: 'point', sub: 'free', x: V[2][0], y: V[2][1], label: 'C', style: { color: '#ff7a59' } });
  recompute(st);
  for (const [a, b] of [[A, B], [B, C], [C, A]]) addObject(st, { type: 'segment', sub: 'through', deps: [a.id, b.id], style: { color: '#3d4c63', width: 1.15 } });
  const tri = addTriangle(st, A.id, B.id, C.id, { centers: true, centerKeys: CENTER_DEFS.map((d) => d.key), show: { euler: true, ninePoint: true, incircle: true, circumcircle: true, orthic: true, medians: false, altitudes: false, bisectors: false } });
  recompute(st);
  const centerId = (key) => tri.centers[key];
  const D = addObject(st, { type: 'point', sub: 'foot', deps: [centerId('H'), st.objects.find((o) => o.type === 'segment' && o.deps.includes(B.id) && o.deps.includes(C.id)).id], label: 'D', style: { color: '#4fd1c5', pointSize: 3.0 } });
  const E = addObject(st, { type: 'point', sub: 'foot', deps: [centerId('H'), st.objects.find((o) => o.type === 'segment' && o.deps.includes(C.id) && o.deps.includes(A.id)).id], label: 'E', style: { color: '#4fd1c5', pointSize: 3.0 } });
  const F = addObject(st, { type: 'point', sub: 'foot', deps: [centerId('H'), st.objects.find((o) => o.type === 'segment' && o.deps.includes(A.id) && o.deps.includes(B.id)).id], label: 'F', style: { color: '#4fd1c5', pointSize: 3.0 } });
  const Ma = addObject(st, { type: 'point', sub: 'midpoint', deps: [B.id, C.id], label: 'Ma', style: { color: '#7aa2ff', pointSize: 3.0 } });
  const Mb = addObject(st, { type: 'point', sub: 'midpoint', deps: [C.id, A.id], label: 'Mb', style: { color: '#7aa2ff', pointSize: 3.0 } });
  const Mc = addObject(st, { type: 'point', sub: 'midpoint', deps: [A.id, B.id], label: 'Mc', style: { color: '#7aa2ff', pointSize: 3.0 } });
  const H = centerId('H');
  const MA = addObject(st, { type: 'point', sub: 'midpoint', deps: [A.id, H], label: 'MA', style: { color: '#c084fc', pointSize: 3.0 } });
  const MB = addObject(st, { type: 'point', sub: 'midpoint', deps: [B.id, H], label: 'MB', style: { color: '#c084fc', pointSize: 3.0 } });
  const MC = addObject(st, { type: 'point', sub: 'midpoint', deps: [C.id, H], label: 'MC', style: { color: '#c084fc', pointSize: 3.0 } });
  addObject(st, { type: 'circle', sub: 'triangleNinePoint', deps: [tri.id], label: 'ω₉', style: { color: '#c084fc', width: .9, dash: 5, fill: 'transparent', opacity: .8 } });
  const inc = addObject(st, { type: 'circle', sub: 'triangleIncircle', deps: [tri.id], label: 'ω', style: { color: '#34d399', width: .9, fill: 'transparent', opacity: .7 } });
  recompute(st);
  // Keep only labels relevant to the generated proposition visible.
  const wanted = new Set(problem.labels || []);
  if (problem.theorem === '九点圆' || (problem.kind === 'concyclic' && (problem.labels || []).length >= 8)) wanted.add('N');
  if (problem.theorem === '费尔巴哈定理') { wanted.add('N'); wanted.add('I'); wanted.add('Fe'); }
  const core = new Set(['A', 'B', 'C']);
  for (const o of st.objects) {
    if (o.type === 'point' && (o.centerKey || o.meta?.system)) {
      if (!core.has(o.label) && !wanted.has(o.label) && !['Ma', 'Mb', 'Mc', 'MA', 'MB', 'MC', 'D', 'E', 'F'].includes(o.label)) o.visible = false;
    }
  }
  if (problem.theorem !== '费尔巴哈定理' && !wanted.has('I')) inc.visible = false;
  const byLabel = (lab) => st.objects.find((o) => o.label === lab && o.valid);
  let goal = null;
  const labels = problem.labels || [];
  if (problem.theorem === '九点圆' || (problem.kind === 'concyclic' && labels.length >= 8)) {
    const ids = [Ma, Mb, Mc, D, E, F, MA, MB, MC].map((o) => o.id);
    goal = { kind: 'concyclic', ids, title: '证明九点共圆', statement: problem.statement, source: 'generated', theorem: 'Nine-point circle', scenarioId: null };
  } else if (problem.theorem === '欧拉线' || (problem.kind === 'collinear' && ['O', 'G', 'H'].every((l) => labels.includes(l)))) {
    goal = { kind: 'collinear', ids: ['O', 'G', 'H'].map((l) => byLabel(l)?.id).filter(Boolean), title: '证明欧拉线', statement: problem.statement, source: 'generated', theorem: 'Euler line' };
  } else if (problem.theorem === '费尔巴哈定理') {
    goal = { kind: 'tangent', circleIds: [st.objects.find((o) => o.sub === 'triangleNinePoint')?.id, st.objects.find((o) => o.sub === 'triangleIncircle')?.id].filter(Boolean), title: '证明九点圆与内切圆相切', statement: problem.statement, source: 'generated', theorem: 'Feuerbach theorem' };
  } else if (problem.theorem === '奈格尔线') {
    goal = { kind: 'collinear', ids: ['G', 'I', 'Na', 'Sp'].map((l) => byLabel(l)?.id).filter(Boolean), title: '证明奈格尔线', statement: problem.statement, source: 'generated', theorem: 'Nagel line' };
  } else if (problem.theorem === '九点圆心中点链') {
    goal = { kind: 'midpoint', pointId: byLabel('N')?.id, pairIds: [byLabel('Ma')?.id, byLabel('MA')?.id], title: '证明九点圆心是中点', statement: problem.statement, source: 'generated', theorem: 'Nine-point circle' };
  } else if (['O', 'I'].every((l) => labels.includes(l))) {
    goal = { kind: 'identity', ids: ['O', 'I'].map((l) => byLabel(l)?.id).filter(Boolean), title: '欧拉公式', statement: problem.statement, source: 'generated', theorem: "Euler's formula" };
  }
  if (goal) goal.labels = labels;
  st.meta.scenarioId = 'generated';
  return { state: st, goal, triangle: tri, proof: null };
}

/* ------------------------------ new documents ---------------------------- */
function createBlankBoard() {
  if (S.state) pushHistory();
  installState(createState('未命名画板'));
  S.ui.goal = null; S.ui.proof = null; S.ui.scenarioId = null; S.ui.problemText = '';
  S.ui.activeTriangle = null; S.ui.tab = 'objects';
  centerView(92);
  $$('#inspector-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'objects'));
  renderAll(); scheduleAutosave();
  toast('已新建空画布');
}

function createTriangleBoard() {
  const built = basicTriangleScene();
  if (S.state) pushHistory();
  installState(built.state);
  S.ui.goal = null; S.ui.proof = null; S.ui.scenarioId = null; S.ui.problemText = '';
  S.ui.activeTriangle = built.triangle?.id || null; S.ui.tab = 'triangle';
  fitView({ padding: 100, maxScale: 105 });
  $$('#inspector-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'triangle'));
  renderAll(); scheduleAutosave();
  toast('已新建三角形 ABC · ∠A=70° ∠B=60° ∠C=50°');
}

function openNewBoardMenu() {
  modal(`<div class="modal-head"><div><span class="eyebrow">NEW BOARD</span><h3>新建画板</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body">
      <div class="export-grid">
        <button class="export-option" id="new-empty"><strong>空画布</strong><small>从零开始，不放置任何点、线或圆。</small></button>
        <button class="export-option" id="new-triangle"><strong>三角形 ABC</strong><small>BC 水平，A 在 BC 上方，∠A=70°，∠B=60°，∠C=50°；只含三角形。</small></button>
      </div>
      <div class="hero-card" style="margin-top:9px"><div class="hero-kicker">EXAMPLES</div><p class="hero-desc">需要欧拉线、西姆松线、蝴蝶定理等构型时，打开右侧「题库」即可载入示例，不会污染当前默认画板。</p></div>
    </div>
    <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn" id="new-browse-examples">打开题库</button></div>`,
  { width: 560, onMount: (root, close) => {
    $('#new-empty', root).addEventListener('click', () => { close(); createBlankBoard(); });
    $('#new-triangle', root).addEventListener('click', () => { close(); createTriangleBoard(); });
    $('#new-browse-examples', root).addEventListener('click', () => { close(); switchTab('library'); });
  } });
}

/* --------------------------- screenshot → geometry ----------------------- */
const VISION_CONFIG_KEY = 'geomind:vision:v1';
const VISION_HARNESS_KEY = 'geomind:vision:harness:v1';
const VISION_AUTO_REPAIR_KEY = 'geomind:vision:autorepair:v1';
function loadVisionConfig() {
  try { return { base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', api_key: '', allow_remote: false, ...(JSON.parse(localStorage.getItem(VISION_CONFIG_KEY) || '{}')) }; }
  catch { return { base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', api_key: '', allow_remote: false }; }
}
function saveVisionConfig(cfg) {
  try { localStorage.setItem(VISION_CONFIG_KEY, JSON.stringify(cfg)); toast('视觉模型设置已保存'); }
  catch { toast('保存设置失败', 'error'); }
}
function openVisionSettings(onBack) {
  const cfg = loadVisionConfig();
  modal(`<div class="modal-head"><div><span class="eyebrow">VISION MODEL</span><h3>视觉大模型设置</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body">
      <p style="font-size:9px;line-height:1.7;color:var(--muted);margin:0 0 10px">兼容 OpenAI Chat Completions 的视觉模型端点。密钥只保存在本机浏览器，通过本地后端转发，不写入项目文件。</p>
      <label class="field-label">API Base URL</label><input class="input" id="vision-base" value="${esc(cfg.base_url)}" placeholder="https://api.openai.com/v1"/>
      <label class="field-label" style="margin-top:8px">模型名</label><input class="input" id="vision-model" value="${esc(cfg.model)}" placeholder="gpt-4o-mini / qwen-vl-max / glm-4v"/>
      <label class="field-label" style="margin-top:8px">API Key</label><input class="input" id="vision-key" type="password" value="${esc(cfg.api_key)}" placeholder="sk-..."/>
      <label style="display:flex;align-items:flex-start;gap:7px;margin-top:10px;font-size:9px;line-height:1.55;color:var(--muted);cursor:pointer"><input id="vision-allow" type="checkbox" ${cfg.allow_remote ? 'checked' : ''} style="margin-top:1px;accent-color:var(--accent)"/><span><strong style="color:var(--text)">允许调用外部视觉模型</strong><br/>默认关闭。开启后每次识图仍会再次确认，可能产生 API 费用。</span></label>
      <div class="helper-note" style="margin-top:9px;font-size:8px;line-height:1.65;color:var(--dim)">本地 OCR 不需要 Key，也不产生费用；只有当本地题目解析失败且你明确允许时，才会调用视觉模型。也可在服务端设置 OPENAI_API_KEY / VISION_API_KEY。</div>
    </div>
    <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn primary" id="vision-save">保存设置</button></div>`,
  { width: 520, onMount: (root, close) => {
    $('#vision-save', root).addEventListener('click', () => {
      saveVisionConfig({ base_url: $('#vision-base', root).value.trim() || 'https://api.openai.com/v1', model: $('#vision-model', root).value.trim() || 'gpt-4o-mini', api_key: $('#vision-key', root).value.trim(), allow_remote: !!$('#vision-allow', root)?.checked });
      close(); if (onBack) onBack();
    });
  } });
}

function confirmRemoteVision(conf) {
  const kb = Math.max(1, Math.round(((S.ui.visionImage?.length || 0) * .75) / 1024));
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    modal(`<div class="modal-head"><div><span class="eyebrow">BILLED API CALL</span><h3>确认调用视觉模型？</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
      <div class="modal-body">
        <p style="font-size:10px;line-height:1.75;color:var(--muted);margin:0 0 8px">本地解析没有匹配这道题。继续将向 <b style="color:var(--text)">${esc(conf.model)}</b> 发送一次截图/文本请求，可能产生 API 费用。</p>
        <div class="metric-strip"><span class="metric-pill">图片 <b>${kb} KB</b></span><span class="metric-pill">模型 <b>${esc(conf.model)}</b></span><span class="metric-pill">调用 <b>1 次</b></span></div>
        <div class="helper-note" style="margin-top:9px;font-size:8px;line-height:1.6;color:var(--dim)">取消不会调用任何模型。可以先用「本地识别文字」或「仅解析文本并画图」。</div>
      </div>
      <div class="modal-foot"><button class="btn" data-close>取消，不调用</button><button class="btn primary" id="remote-go">确认调用一次</button></div>`,
    { width: 500, onClose: () => finish(false), onMount: (root, close) => {
      root.querySelector('#remote-go')?.addEventListener('click', () => { finish(true); close(); });
    } });
  });
}

function openVisionModal(prefill = null) {
  S.ui.visionImage = null;
  modal(`<div class="modal-head"><div><span class="eyebrow">SCREENSHOT → CONSTRUCTION</span><h3>截图识题并自动画图</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body">
      <div class="vision-drop" id="vision-drop" tabindex="0">
        <input type="file" id="vision-file" accept="image/*" hidden/>
        <img id="vision-preview" hidden alt="题目截图预览"/>
        <div id="vision-placeholder"><div class="vision-glyph">${svg('image')}</div><strong>拖入题目截图</strong><small>点击选择图片，或直接 Ctrl+V 粘贴</small></div>
      </div>
      <div class="vision-actions">
        <button class="btn primary" id="vision-ai">${svg('spark')} 大模型识图并画图</button>
        <button class="btn" id="vision-sample">载入示例</button>
      </div>
      <label class="vision-auto-repair" style="display:flex;align-items:flex-start;gap:7px;margin:8px 0 4px;font-size:9px;line-height:1.55;color:var(--muted);cursor:pointer">
        <input id="vision-auto-repair" type="checkbox" style="margin-top:1px;accent-color:var(--accent)"/>
        <span><strong style="color:var(--text)">自动修复</strong>（默认关闭）<br/>勾选后校验失败会再调用模型；关闭时只画第一次识图结果，速度最快。</span>
      </label>
      <label class="vision-harness" style="display:flex;align-items:flex-start;gap:7px;margin:0 0 10px;font-size:9px;line-height:1.55;color:var(--muted);cursor:pointer">
        <input id="vision-harness" type="checkbox" style="margin-top:1px;accent-color:var(--accent)"/>
        <span><strong style="color:var(--text)">使用 mini-harness 复核 / 修正</strong><br/>仅在开启「自动修复」时生效；把题目和当前构造 JSON 交给 miniharness mini-harness 审查并返回修正版。</span>
      </label>
      <label class="field-label">题目文字（可选，模型会结合截图）</label>
      <textarea class="input vision-text" id="vision-text" placeholder="可直接粘贴题面；识别只使用后端多模态大模型"></textarea>
      <div class="vision-status" id="vision-status">后端模型：deepseek-flash（mini-harness 直连 DeepSeek）· 自动修复默认关闭 · 不做本地 OCR/规则回退。</div>
    </div>
    <div class="modal-foot"><button class="btn" data-close>取消</button></div>`,
  { width: 760, onMount: (root, close) => {
    const drop = $('#vision-drop', root); const file = $('#vision-file', root); const preview = $('#vision-preview', root); const placeholder = $('#vision-placeholder', root);
    const textarea = $('#vision-text', root); const status = $('#vision-status', root);
    const harnessBox = $('#vision-harness', root);
    const autoRepairBox = $('#vision-auto-repair', root);
    try { harnessBox.checked = localStorage.getItem(VISION_HARNESS_KEY) === '1'; } catch {}
    try { autoRepairBox.checked = localStorage.getItem(VISION_AUTO_REPAIR_KEY) === '1'; } catch {}
    if (!LOCAL_CLIENT) {
      autoRepairBox.checked = false; autoRepairBox.disabled = true;
      if (harnessBox) { harnessBox.checked = false; harnessBox.disabled = true; }
    }
    harnessBox?.addEventListener('change', () => { try { localStorage.setItem(VISION_HARNESS_KEY, harnessBox.checked ? '1' : '0'); } catch {} });
    autoRepairBox?.addEventListener('change', () => { try { localStorage.setItem(VISION_AUTO_REPAIR_KEY, autoRepairBox.checked ? '1' : '0'); } catch {} });
    const setStatus = (msg, kind = '') => { status.textContent = msg; status.dataset.kind = kind; };
    health().then((h) => {
      if (!h?.visionModel) return;
      const where = h.visionBackend === 'miniharness' ? 'mini-harness' : (h.visionBackend || '直连');
      setStatus(`后端模型：${h.visionModel} · ${where} · 识图请求会记录在 mini-harness 调用历史中。`);
    }).catch(() => {});
    const setImage = (dataUrl) => {
      S.ui.visionImage = dataUrl; preview.src = dataUrl; preview.hidden = false; placeholder.hidden = true;
      setStatus('截图已载入。点击「大模型识图并画图」发送到后端。');
    };
    const readFile = (f) => {
      if (!f || !f.type.startsWith('image/')) return toast('请选择图片文件', 'warn');
      const reader = new FileReader();
      reader.onload = () => setImage(String(reader.result));
      reader.readAsDataURL(f);
    };
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') file.click(); });
    file.addEventListener('change', () => readFile(file.files?.[0]));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => readFile(e.dataTransfer?.files?.[0]));
    const onPaste = (e) => {
      if (!$('#vision-drop')) { document.removeEventListener('paste', onPaste); return; }
      const item = [...(e.clipboardData?.items || [])].find((x) => x.type.startsWith('image/'));
      if (item) { const f = item.getAsFile(); if (f) { readFile(f); e.preventDefault(); } }
    };
    document.addEventListener('paste', onPaste);
    const observer = new MutationObserver(() => { if (!$('#vision-drop')) { document.removeEventListener('paste', onPaste); observer.disconnect(); } });
    observer.observe(document.body, { childList: true, subtree: true });

    if (prefill?.text) textarea.value = prefill.text;
    if (prefill?.imageUrl) {
      fetch(prefill.imageUrl).then((r) => r.blob()).then((blob) => {
        const reader = new FileReader();
        reader.onload = () => setImage(String(reader.result));
        reader.readAsDataURL(blob);
      }).catch(() => setStatus('题目图片读取失败，可手动选择截图', 'error'));
    }
    const apply = async (data, source, allowRepair = true) => {
      if (!data) return toast('没有可用的构图数据', 'warn');
      let built = data.script_js ? buildScriptState(data.script_js) : null;
      if (!built) built = buildVisionState(data);
      let issues = built ? validateVisionState(built, data) : ['构图执行失败'];
      const blocking = (arr) => (arr || []).filter((x) => !String(x).startsWith('⚠'));
      const autoRepair = LOCAL_CLIENT && !!autoRepairBox?.checked;
      if (autoRepair && blocking(issues).length && harnessBox?.checked) {
        setStatus('mini-harness 正在复核并调整构图…');
        try {
          const before = blocking(issues).length;
          const hr = await apiVisionReview({ text: textarea.value.trim(), data, issues: blocking(issues) });
          if (hr?.ok && hr.data) {
            const hb = hr.data.script_js ? buildScriptState(hr.data.script_js) : buildVisionState(hr.data);
            if (hb) {
              const hi = validateVisionState(hb, hr.data);
              if (blocking(hi).length <= before) {
                data = hr.data; built = hb; issues = hi; source = hr.model || 'mini-harness';
                setStatus('mini-harness 复核完成 · ' + (blocking(hi).length ? blocking(hi).length + ' 处仍需处理' : '构图通过'));
              }
            }
          } else if (hr && !hr.ok) {
            issues.push('⚠ mini-harness 复核失败：' + (hr.error || '未知错误'));
          }
        } catch (e) {
          issues.push('⚠ mini-harness 复核失败：' + e.message);
        }
      }
      if (autoRepair && blocking(issues).length && allowRepair) {
        setStatus('构图自动校验失败，正在让模型根据原图修复…');
        for (let attempt = 1; attempt <= 2 && blocking(issues).length; attempt++) {
          try {
            let prevJson = '';
            try { prevJson = JSON.stringify(data).slice(0, 16000); } catch {}
            const repairText = "【修复任务，必须执行】上一版几何构图经过程序校验后失败。请对照原图逐条修复下列问题，"
              + "不要原样返回上一版；只改有问题的点/构造，保留其余正确部分，最后输出完整 JSON（不是补丁）。\n"
              + "\n【题目原文】\n" + textarea.value.trim()
              + "\n\n【上一次构图 JSON】\n" + prevJson
              + "\n\n【自动校验发现的问题】\n- " + issues.slice(0, 12).join('\n- ')
              + "\n\n修复要求：所有有定义的点使用派生构造；每个交点/圆上点必须有 coordinate；"
              + "所有 deps 必须有对应对象；两个圆没有交点时，调整自由点坐标使图形可行，或改用满足题设的构造。";
            if (attempt > 1) setStatus('第一次修复仍有问题，正在第二次修复…');
            const rr = await apiVision({ image: S.ui.visionImage || null, text: repairText });
            if (rr?.ok && rr.data) {
              data = rr.data;
              built = data.script_js ? buildScriptState(data.script_js) : null;
              if (!built) built = buildVisionState(data);
              issues = built ? validateVisionState(built, data) : ['构图修复执行失败'];
            } else if (rr && !rr.ok) {
              issues.push('自动修复请求失败：' + (rr.error || '未知错误'));
              break;
            }
          } catch (e) {
            issues.push('自动修复请求失败：' + e.message);
            break;
          }
        }
      }
      if (blocking(issues).length) {
        logAction('识图校验失败：' + blocking(issues).slice(0, 6).join('；'));
        clientLog({ kind: 'vision_check', status: 'failed', title: '识图构图校验', errors: issues.slice(0, 30), detail: issues.join('\n') }).catch(() => {});
      } else if (issues.length) {
        logAction('识图完成（' + issues.length + ' 处约束警告）');
        clientLog({ kind: 'vision_check', status: 'warning', title: '识图构图校验（仅警告）', errors: issues.slice(0, 30), detail: issues.join('\n') }).catch(() => {});
      }
      if (!built || !built.state.objects.some((o) => o.type === 'point' && o.valid)) return toast('识图结果没有有效几何点', 'warn');
      if (S.state) pushHistory();
      installState(built.state);
      S.ui.scenarioId = 'vision';
      S.ui.goal = built.goal;
      S.ui.proof = null;
      S.ui.problemText = built.problemText || textarea.value.trim();
      S.ui.activeTriangle = built.triangleId;
      fitView({ padding: 80, maxScale: 96 });
      close();
      switchTab(built.goal ? 'ai' : 'triangle');
      renderAll(); scheduleAutosave();
      toast(`识图完成 · ${source}${built.goal ? ' · 已设为目标' : ''}${issues.length ? ' · ' + issues.length + ' 处约束警告' : ''}`, blocking(issues).length ? 'error' : issues.length ? 'warn' : undefined);
    };

    let remoteBusy = false;
    const doAI = async () => {
      if (remoteBusy) return;
      const text = textarea.value.trim();
      if (!S.ui.visionImage && !text) return toast('请先载入截图或输入题目文字', 'warn');
      remoteBusy = true;
      const btn = $('#vision-ai', root); if (btn) btn.disabled = true;
      setStatus('后端 deepseek-v4.1-flash 正在识图，可能需要数十秒…');
      try {
        const r = await apiVision({ image: S.ui.visionImage, text });
        if (r.ok) {
          setStatus(`识图完成 · ${r.model || 'deepseek-v4.1-flash'} · ${r.elapsedMs || 0} ms`);
          apply(r.data, r.model || '大模型');
        } else {
          setStatus(r.error || '视觉识别失败', 'error');
          toast(r.error || '视觉识别失败', 'error');
        }
      } catch (e) { setStatus('识图请求失败：' + e.message, 'error'); toast(e.message, 'error'); }
      finally { remoteBusy = false; if (btn) btn.disabled = false; }
    };
    $('#vision-ai', root).addEventListener('click', doAI);
    $('#vision-sample', root).addEventListener('click', () => apply(sampleVisionData(), '内置示例'));
  } });
}

function loadGeneratedProblem(p) {
  if (!p) return;
  if (p.scenarioId) { loadScenario(p.scenarioId); return; }
  const built = buildGeneratedState(p);
  if (S.state) pushHistory();
  installState(built.state);
  S.ui.scenarioId = 'generated';
  S.ui.goal = built.goal;
  S.ui.proof = null;
  S.ui.activeTriangle = built.triangle?.id || null;
  S.ui.tab = 'ai';
  fitView({ padding: 78, maxScale: 90 });
  $$('#inspector-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'ai'));
  renderAll(); scheduleAutosave();
  toast(`已载入 AI 命题「${p.title}」`);
  if (!built.goal) toast('该题为恒等式，可在关系面板查看数值验证', 'warn');
}

/* ------------------------------- export/import --------------------------- */
function download(filename, content, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function safeName(s) { return (s || 'geomind').replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 50); }
function exportJSON() {
  download(safeName(S.state.docName) + '.geomind.json', serializeState(S.state), 'application/json');
  toast('画板 JSON 已导出');
}
function exportPNG() {
  const sel = S.ui.selection, hl = S.ui.highlight;
  S.ui.selection = []; S.ui.highlight = null;
  S.renderer.draw(performance.now());
  const data = $('#board').toDataURL('image/png');
  S.ui.selection = sel; S.ui.highlight = hl; requestRender();
  const a = document.createElement('a'); a.href = data; a.download = safeName(S.state.docName) + '.png'; a.click();
  toast('PNG 已导出');
}
async function exportPDF() {
  const sel = S.ui.selection, hl = S.ui.highlight;
  S.ui.selection = []; S.ui.highlight = null; S.renderer.draw(performance.now());
  const image = $('#board').toDataURL('image/png');
  S.ui.selection = sel; S.ui.highlight = hl; requestRender();
  try {
    const r = await figurePDF({ image, title: S.state.docName || 'GeoMind' });
    if (!r.ok || !r.pdf) throw new Error(r.error || 'PDF 生成失败');
    const bin = atob(r.pdf); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    download(safeName(S.state.docName) + '.pdf', new Blob([bytes], { type: 'application/pdf' }), 'application/pdf');
    toast('PDF 已导出');
  } catch (e) { toast('PDF 导出失败：' + e.message, 'error'); }
}
function svgForState() {
  const r = S.renderer; const w = r.w, h = r.h;
  const X = (p) => r.toScreen(p);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#ffffff"/>`];
  const line = (o) => {
    const a = X(o.g.a), b = X(o.g.b);
    let p1 = a, p2 = b;
    if (o.type === 'line') {
      const u = { x: b.x - a.x, y: b.y - a.y }; const L = Math.hypot(u.x, u.y) || 1;
      p1 = { x: a.x - u.x / L * 5000, y: a.y - u.y / L * 5000 }; p2 = { x: a.x + u.x / L * 5000, y: a.y + u.y / L * 5000 };
    }
    return `<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${darkenLineColor(o.style.color || '#1f2937')}" stroke-width="${Math.max(1.3, o.style.width || 1.1)}" ${o.style.dash ? `stroke-dasharray="${o.style.dash} ${o.style.dash}"` : ''} opacity="${o.style.opacity ?? 1}"/>`;
  };
  for (const o of S.state.objects) {
    if (!o.visible || !o.valid) continue;
    if (['line', 'segment', 'ray', 'vector'].includes(o.type)) parts.push(line(o));
    else if (o.type === 'arc') { const c = X(o.g.center), r = o.g.r * S.state.view.scale; const a = { x: c.x + r * Math.cos(o.g.a1), y: c.y + r * Math.sin(o.g.a1) }; const b = { x: c.x + r * Math.cos(o.g.a2), y: c.y + r * Math.sin(o.g.a2) }; parts.push(`<path d="M ${a.x.toFixed(1)} ${a.y.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${o.g.largeArc ? 1 : 0} ${o.g.anticlockwise ? 0 : 1} ${b.x.toFixed(1)} ${b.y.toFixed(1)}" fill="none" stroke="${darkenLineColor(o.style.color || '#6d28d9')}" stroke-width="${Math.max(1.3, o.style.width || 1.1)}" ${o.style.dash ? `stroke-dasharray="${o.style.dash} ${o.style.dash}"` : ''}/>`); }
    else if (o.type === 'circle') { const c = X(o.g.center); parts.push(`<circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${(o.g.r * S.state.view.scale).toFixed(2)}" fill="none" stroke="${darkenLineColor(o.style.color || '#1d4ed8')}" stroke-width="${Math.max(1.12, o.style.width || .95)}" ${o.style.dash ? `stroke-dasharray="${o.style.dash} ${o.style.dash}"` : ''} opacity="${o.style.opacity ?? 1}"/>`); }
    else if (o.type === 'curve') { const segs = curveSegments(o); if (segs.length) parts.push(`<path d="${segs.map(([a, b]) => { const p = X(a), q = X(b); return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join(' ')}" fill="none" stroke="${darkenLineColor(o.style.color || '#9b6cff')}" stroke-width="${Math.max(1.1, o.style.width || 1.2)}" opacity="${o.style.opacity ?? 1}"/>`); }
    else if (o.type === 'polygon') { const pts = o.g.points.map((p) => X(p)); parts.push(`<polygon points="${pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}" fill="${o.style.fill || 'none'}" stroke="${darkenLineColor(o.style.color || '#1f2937')}" stroke-width="${Math.max(1.3, o.style.width || 1.05)}"/>`); }
    else if (o.type === 'triangle') {
      const m = o.g.metrics;
      if (o.show?.euler && m.O && m.H) { const a = X(m.O), b = X(m.H); const u = { x: b.x - a.x, y: b.y - a.y }; const L = Math.hypot(u.x, u.y) || 1; parts.push(`<line x1="${(a.x - u.x / L * 5000).toFixed(1)}" y1="${(a.y - u.y / L * 5000).toFixed(1)}" x2="${(a.x + u.x / L * 5000).toFixed(1)}" y2="${(a.y + u.y / L * 5000).toFixed(1)}" stroke="#92400e" stroke-width="1.1" stroke-dasharray="5 5" opacity=".9"/>`); }
      if (o.show?.ninePoint && m.N) { const c = X(m.N); parts.push(`<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${(m.R / 2 * S.state.view.scale).toFixed(1)}" fill="none" stroke="#6d28d9" stroke-width="1.1" stroke-dasharray="4 5" opacity=".8"/>`); }
    }
    else if (o.type === 'point') { const p = X(o.g); parts.push(`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${Math.min(o.style.pointSize || 3.0, 3.2)}" fill="#263342" stroke="#fff" stroke-width=".8"/>`); if (S.state.settings.labels && o.label) parts.push(`<text x="${(p.x + 8).toFixed(1)}" y="${(p.y - 7).toFixed(1)}" font-family="Inter, PingFang SC, sans-serif" font-size="10" font-weight="600" fill="${o.centerKey ? (o.meta?.centerColor || o.style.color) : '#263342'}">${esc(o.label)}</text>`); }
    else if (o.type === 'text') { const p = X(o.g); parts.push(`<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" font-family="Inter, PingFang SC, sans-serif" font-size="11" fill="${o.style.color || '#38465a'}">${esc(o.g.text)}</text>`); }
  }
  parts.push('</svg>');
  return parts.join('\n');
}
function exportSVG() { download(safeName(S.state.docName) + '.svg', svgForState(), 'image/svg+xml'); toast('SVG 矢量图已导出'); }
function exportTikZ() {
  const pts = S.state.objects.filter((o) => o.type === 'point' && o.valid && o.visible);
  const lines = S.state.objects.filter((o) => ['segment', 'line', 'ray'].includes(o.type) && o.valid && o.visible);
  const circles = S.state.objects.filter((o) => o.type === 'circle' && o.valid && o.visible);
  const out = ['% GeoMind · 竞赛几何工作台', '\\begin{tikzpicture}[scale=1]'];
  for (const p of pts) out.push(`  \\coordinate (${p.label}) at (${fmt(p.g.x, 4)}, ${fmt(p.g.y, 4)});`);
  for (const l of lines) {
    const A = objectById(S.state, l.deps[0]), B = objectById(S.state, l.deps[1]);
    if (!A || !B) continue;
    out.push(`  \\draw (${A.label}) -- (${B.label});`);
  }
  for (const c of circles) out.push(`  \\draw (${fmt(c.g.center.x, 4)}, ${fmt(c.g.center.y, 4)}) circle (${fmt(c.g.r, 4)});`);
  // Curves: export the contour as smooth sampled polylines. This covers conics
  // and QL-Cu1, which have no simple TikZ primitive in the current kernel.
  const curves = S.state.objects.filter((o) => o.type === 'curve' && o.valid && o.visible);
  for (const c of curves) {
    const paths = traceCurveSegments(curveSegments(c));
    out.push(`  % ${c.label || (c.sub === 'conic' ? 'conic' : 'QL-Cu1')}`);
    for (const path of paths) {
      if (!path || path.length < 2) continue;
      const stride = Math.max(1, Math.ceil(path.length / 220));
      const coords = [];
      for (let i = 0; i < path.length; i += stride) coords.push(`(${fmt(path[i].x, 4)},${fmt(path[i].y, 4)})`);
      if ((path.length - 1) % stride) coords.push(`(${fmt(path[path.length - 1].x, 4)},${fmt(path[path.length - 1].y, 4)})`);
      out.push(`  \\draw plot[smooth] coordinates { ${coords.join(' ')} };`);
    }
  }
  for (const p of pts) out.push(`  \\node[above right] at (${p.label}) {$${p.label}$};`);
  out.push('\\end{tikzpicture}');
  download(safeName(S.state.docName) + '.tex', out.join('\n'), 'text/plain');
  toast('TikZ 代码已导出');
}
function openExport() {
  modal(`<div class="modal-head"><div><span class="eyebrow">EXPORT</span><h3>导出画板</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body"><div class="export-grid">
      <button class="export-option" data-export="json"><strong>GeoMind JSON</strong><small>完整构造、依赖与样式，可重新导入</small></button>
      <button class="export-option" data-export="png"><strong>PNG 图片</strong><small>当前视图的高分辨率位图</small></button>
      <button class="export-option" data-export="pdf"><strong>PDF 图</strong><small>适合打印和提交</small></button>
      <button class="export-option" data-export="svg"><strong>SVG 矢量</strong><small>适合网页、Illustrator 与印刷</small></button>
      <button class="export-option" data-export="tikz"><strong>TikZ 代码</strong><small>直接粘贴进 LaTeX 文档</small></button>
    </div></div>
    <div class="modal-foot"><button class="btn" data-close>关闭</button><button class="btn" data-export="copy">${svg('copy')} 复制 JSON</button></div>`,
  { onMount: (root, close) => {
    root.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => {
      const kind = b.dataset.export; close();
      if (kind === 'json') exportJSON();
      else if (kind === 'png') exportPNG();
      else if (kind === 'pdf') exportPDF();
      else if (kind === 'svg') exportSVG();
      else if (kind === 'tikz') exportTikZ();
      else if (kind === 'copy') navigator.clipboard?.writeText(serializeState(S.state)).then(() => toast('JSON 已复制')).catch(() => toast('复制失败', 'error'));
    }));
  } });
}
function importJSON(text) {
  try {
    const st = deserializeState(text);
    pushHistory(); installState(st); S.ui.goal = null; S.ui.proof = null; S.ui.scenarioId = null;
    S.ui.tab = 'objects'; $$('#inspector-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'objects'));
    renderAll(); scheduleAutosave(); toast('画板已导入');
  } catch (e) { toast('导入失败：' + e.message, 'error'); }
}

/* --------------------------------- settings ------------------------------ */
function openLogs() {
  if (!LOCAL_CLIENT) return toast('日志仅在本机工作区提供', 'warn');
  const localHtml = () => S.ui.actionLog.length
    ? S.ui.actionLog.slice().reverse().map((x) => `<div class="log-line"><span>${esc(x.time)}</span>${esc(x.text)}</div>`).join('')
    : '<div class="log-empty">还没有本地作图记录</div>';
  modal(`<div class="modal-head"><div><span class="eyebrow">RUN LOG</span><h3>作图 / 解题日志</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body">
      <div class="section"><div class="section-head"><span class="section-title">本地作图记录</span><span class="section-action">最近 ${S.ui.actionLog.length} 条</span></div><div class="log-list" id="local-log">${localHtml()}</div></div>
      <div class="section"><div class="section-head"><span class="section-title">后端 AI 调用</span><span class="section-action" id="log-count">读取中…</span></div><div id="backend-log" class="log-list"><div class="log-empty">正在读取后端日志…</div></div></div>
      <div class="helper-note">后端日志包含完整识图请求、系统提示词、模型原始返回、解析后的构造 JSON、校验失败点、证明请求、模型思考过程与错误。不会包含 API Key 或图片二进制。思考过程是模型原始推理，仅供排查，不是最终证明。<br/><a href="http://127.0.0.1:8000/admin/ui" target="_blank" rel="noopener">打开 mini-harness 调用记录（/admin/ui）</a> · build ${esc(window.__GEOMIND_BUILD__ || "")}</div>
    </div>
    <div class="modal-foot"><button class="btn" id="log-refresh">刷新</button><button class="btn primary" data-close>关闭</button></div>`,
  { width: 780, onMount: (root, close) => {
    const target = $('#backend-log', root); const count = $('#log-count', root);
    const load = async () => {
      if (!target) return;
      target.innerHTML = '<div class="log-empty">读取中…</div>';
      try {
        const r = await apiLogs(60);
        const logs = r.logs || [];
        count.textContent = `${logs.length} 条`;
        if (!logs.length) { target.innerHTML = '<div class="log-empty">还没有后端调用记录</div>'; return; }
        target.innerHTML = logs.map((x, i) => {
          const title = x.kind === 'proof' ? '纯几何证明' : x.kind === 'proof_job' ? '证明任务' : x.kind === 'vision' ? (x.phase === 'repair' ? '识图修复' : '识图') : x.kind === 'vision_harness' ? 'mini-harness 复核' : x.kind === 'vision_check' ? '识图构图校验' : x.kind;
          const status = x.status || '';
          const body = [
            x.problem ? `<div class="log-field"><b>题目</b><pre>${esc(x.problem)}</pre></div>` : '',
            x.prompt && x.kind === 'vision' ? `<div class="log-field"><b>识图提示</b><pre>${esc(x.prompt)}</pre></div>` : '',
            x.title ? `<div class="log-field"><b>结果</b>${esc(x.title)}</div>` : '',
            x.points ? `<div class="log-field"><b>识别对象</b>${x.points} 个点${x.point_names?.length ? '：' + esc(x.point_names.join('、')) : ''}${x.segments ? ` · ${x.segments} 条线段` : ''}</div>` : '',
            x.request ? `<details class="log-think"><summary>完整请求 (${x.request.length} 字符)</summary><pre>${esc(x.request)}</pre></details>` : '',
            x.response_raw ? `<details class="log-think"><summary>模型原始返回 (${x.response_raw.length} 字符)</summary><pre>${esc(x.response_raw)}</pre></details>` : '',
            x.parsed_json ? `<details class="log-think"><summary>解析后的构造 JSON (${x.parsed_json.length} 字符)</summary><pre>${esc(x.parsed_json)}</pre></details>` : '',
            x.system_prompt ? `<details class="log-think"><summary>系统提示词 (${x.system_prompt.length} 字符)</summary><pre>${esc(x.system_prompt)}</pre></details>` : '',
            x.reasoning ? `<details class="log-think"><summary>AI 思考过程 (${x.reasoning.length} 字符)</summary><pre>${esc(x.reasoning)}</pre></details>` : '',
            x.proof ? `<details class="log-think"><summary>证明正文</summary><pre>${esc(x.proof)}</pre></details>` : '',
            x.error ? `<div class="log-field error"><b>错误</b><pre>${esc(x.error)}</pre></div>` : '',
            x.errors ? `<div class="log-field ${x.status === 'failed' ? 'error' : ''}"><b>校验失败点</b><pre>${esc((x.errors || []).join('\n'))}</pre></div>` : '',
          ].filter(Boolean).join('');
          return `<details class="log-entry" ${i === 0 ? 'open' : ''}><summary><b>${esc(title)}</b><span>${esc(x.time || '')}</span><em>${esc(x.model || '')} ${esc(status)}</em></summary>${body}</details>`;
        }).join('');
      } catch (e) {
        target.innerHTML = `<div class="log-empty error">读取失败：${esc(e.message)}</div>`;
        count.textContent = '失败';
      }
    };
    $('#log-refresh', root)?.addEventListener('click', load);
    load();
  } });
}

function openSettings() {
  modal(`<div class="modal-head"><div><span class="eyebrow">PREFERENCES</span><h3>工作区设置</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body">
      <div class="section"><div class="section-head"><span class="section-title">外观</span></div>
        <div class="setting-row"><div><strong>主题</strong><small>深色工作台 / 纸感画布，或全亮界面</small></div><div class="seg" style="width:150px"><button data-theme-set="ink" class="${S.ui.theme === 'ink' ? 'on' : ''}">深色</button><button data-theme-set="light" class="${S.ui.theme === 'light' ? 'on' : ''}">浅色</button></div></div>
        ${settingToggle('网格', '显示坐标网格', 'grid')}
        ${settingToggle('坐标轴', '显示原点与坐标轴', 'axes')}
        ${settingToggle('点标签', '在画布上显示点名称', 'labels')}
      </div>
      <div class="section"><div class="section-head"><span class="section-title">交互</span></div>
        ${settingToggle('吸附', '点击线/圆时自动创建附着点', 'snap')}
        ${settingToggle('滚轮缩放', '以鼠标为中心缩放', 'wheel')}
        ${settingToggle('自动保存', '操作后保存到浏览器本地', 'autoSave')}
      </div>
      <div class="section"><div class="section-head"><span class="section-title">内核</span></div>
        <div class="field"><span>后端</span><b>${S.ui.backend.online ? '在线 · ' + esc(S.ui.backend.version) : '离线 · 浏览器推理'}</b></div>
        <div class="field"><span>验证精度</span><b>50 dps · mpmath</b></div>
        <div class="field"><span>关系引擎</span><b>Web Worker · ${S.ui.relations.length} 条缓存</b></div>
        <button class="btn full" data-action="recheck-backend" style="margin-top:6px">重新检测后端</button>
      </div>
      <div class="section"><div class="section-head"><span class="section-title">快捷键</span></div>
        <div class="shortcut-grid">
          ${[['V / P / L / S', '选择 / 点 / 线 / 线段'], ['C / T', '圆 / 三角形'], ['Space + 拖动', '平移画布'], ['滚轮', '缩放'], ['F', '适应视图'], ['G / A', '网格 / 坐标轴'], ['Ctrl+Z / ⇧Z', '撤销 / 重做'], ['Ctrl+K', '命令面板'], ['Ctrl+A', '全选几何对象'], ['Ctrl+Enter', '运行 AI 分析'], ['Delete', '删除选中']].map(([k, v]) => `<div class="shortcut-row"><span>${v}</span><kbd>${k}</kbd></div>`).join('')}
        </div>
      </div>
      <div class="section"><div class="section-head"><span class="section-title">数据</span></div>
        <div class="btn-row"><button class="btn" data-action="new-board">新建空画布</button><button class="btn" data-action="new-triangle">新建三角形 ABC</button><button class="btn danger" data-action="reset-all">重置工作区</button></div>
        <p style="font-size:8px;color:var(--dim);line-height:1.7;margin:7px 0 0">画板与目标保存在浏览器 localStorage 中。导出 JSON 可做永久备份。重置会清除自动保存。</p>
      </div>
    </div>
    <div class="modal-foot"><span style="margin-right:auto;font-family:var(--mono);font-size:7px;color:var(--dim)">GEOMIND v1.0 · LOCAL-FIRST</span><button class="btn primary" data-close>完成</button></div>`,
  { onMount: (root, close) => {
    root.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.themeSet); root.querySelectorAll('[data-theme-set]').forEach((x) => x.classList.toggle('on', x === b)); }));
    root.querySelectorAll('[data-toggle-setting]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.toggleSetting; S.state.settings[k] = !S.state.settings[k]; b.classList.toggle('on', S.state.settings[k]); afterMutation(); scheduleAutosave();
    }));
    root.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.action === 'recheck-backend') { checkBackend().then(() => toast('后端状态已刷新')); }
      else if (b.dataset.action === 'new-board') { close(); createBlankBoard(); }
      else if (b.dataset.action === 'new-triangle') { close(); createTriangleBoard(); }
      else if (b.dataset.action === 'reset-all') { if (confirm('重置工作区？本地自动保存将被清除。')) { localStorage.removeItem(S.autosaveKey); close(); location.reload(); } }
    }));
  } });
}
function settingToggle(name, desc, key) {
  return `<div class="setting-row"><div><strong>${name}</strong><small>${desc}</small></div><button class="toggle ${S.state.settings[key] ? 'on' : ''}" data-toggle-setting="${key}"></button></div>`;
}
function toggleTheme() { setTheme(S.ui.theme === 'ink' ? 'light' : 'ink'); }
function setTheme(theme) {
  S.ui.theme = theme; S.state.settings.theme = theme;
  document.body.dataset.theme = theme === 'light' ? 'light' : 'ink';
  try { localStorage.setItem('geomind:theme', theme); } catch {}
  renderRail(); requestRender(); toast(theme === 'light' ? '浅色主题' : '深色主题');
}

/* ------------------------------- command palette ------------------------- */
function commandList() {
  const cmds = [];
  for (const t of TOOL_MAP.values()) cmds.push({ id: 'tool:' + t.id, title: t.name, hint: t.hint, icon: t.icon, action: () => setTool(t.id) });
  for (const [tab, name] of Object.entries({ objects: '对象与构造', triangle: '三角形特征点', ai: 'AI 解题台', explore: '关系发掘', library: '竞赛构型库' })) cmds.push({ id: 'tab:' + tab, title: '切换到 · ' + name, hint: '面板', icon: tab === 'ai' ? 'brain' : tab === 'explore' ? 'spark' : tab === 'library' ? 'book' : tab === 'triangle' ? 'triangle' : 'layers', action: () => switchTab(tab) });
  for (const [name, icon, fn] of [
    ['新建空画布', 'plus', () => createBlankBoard()], ['新建三角形 ABC', 'triangle', () => createTriangleBoard()], ['切换多选模式', 'layers', toggleMultiSelect],
    ...(LOCAL_CLIENT ? [['运行 AI 分析', 'spark', runAI]] : []), ['截图识题并自动画图', 'image', openVisionModal], ['扫描当前关系', 'target', () => { switchTab('explore'); scanNow(); }],
    ['自动生成命题', 'flask', () => { switchTab('explore'); S.ui.exploreTab = 'generate'; renderExplorePanel(); generateNow(); }],
    ['适应视图', 'fit', fitView], ['导出画板', 'download', openExport], ['保存画板', 'check', () => saveSession()],
    ['打开设置', 'settings', openSettings], ['撤销', 'cursor', undo], ['重做', 'cursor', redo],
  ]) cmds.push({ id: 'action:' + name, title: name, hint: '操作', icon, action: fn });
  for (const s of SCENARIOS) cmds.push({ id: 'scenario:' + s.id, title: '载入 · ' + s.title, hint: s.category + ' · ' + s.tags[0], icon: 'book', action: () => loadScenario(s.id) });
  return cmds;
}
function openCmdk() {
  const el = $('#cmdk'); if (!el) return;
  el.hidden = false; const inp = $('#cmdk-input'); inp.value = ''; S.ui.commandIndex = 0; renderCmdk('');
  setTimeout(() => inp.focus(), 20);
}
function closeCmdk() { const el = $('#cmdk'); if (el) el.hidden = true; }
function renderCmdk(q) {
  const all = commandList();
  const items = all.filter((c) => (c.title + ' ' + c.hint).toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  S.ui.commandItems = items;
  const root = $('#cmdk-list');
  root.innerHTML = items.map((c, i) => `<button class="cmdk-item ${i === S.ui.commandIndex ? 'on' : ''}" data-cmd="${i}"><span class="ci-icon">${svg(c.icon)}</span><span class="ci-text"><strong>${esc(c.title)}</strong><small>${esc(c.hint)}</small></span><span class="ci-key">${esc(c.id.split(':')[0].toUpperCase())}</span></button>`).join('') || `<div class="empty-state"><div class="glyph">⌕</div><h3>没有匹配命令</h3><p>试试“欧拉”“关系”“导出”或工具名称。</p></div>`;
  root.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => { const c = items[+b.dataset.cmd]; closeCmdk(); c?.action(); }));
}
function cmdkKey(e) {
  if ($('#cmdk')?.hidden !== false) return false;
  if (e.key === 'ArrowDown') { S.ui.commandIndex = Math.min(S.ui.commandItems.length - 1, S.ui.commandIndex + 1); renderCmdk($('#cmdk-input').value); e.preventDefault(); return true; }
  if (e.key === 'ArrowUp') { S.ui.commandIndex = Math.max(0, S.ui.commandIndex - 1); renderCmdk($('#cmdk-input').value); e.preventDefault(); return true; }
  if (e.key === 'Enter') { const c = S.ui.commandItems[S.ui.commandIndex]; closeCmdk(); c?.action(); e.preventDefault(); return true; }
  return false;
}

/* ---------------------------------- init --------------------------------- */
function bindGlobalEvents() {
  $('#btn-undo')?.addEventListener('click', undo);
  $('#btn-redo')?.addEventListener('click', redo);
  $('#btn-new')?.addEventListener('click', openNewBoardMenu);
  $('#btn-vision')?.addEventListener('click', openVisionModal);
  $('#btn-multiselect')?.addEventListener('click', toggleMultiSelect);
  initMobileControls();
  $('#btn-import')?.addEventListener('click', () => $('#file-input').click());
  $('#btn-export')?.addEventListener('click', openExport);
  $('#btn-logs')?.addEventListener('click', openLogs);
  $('#btn-settings')?.addEventListener('click', openSettings);
  $('#btn-ai')?.addEventListener('click', () => { switchTab('ai'); runLLMProof(); });
  $('#ai-fab')?.addEventListener('click', () => { switchTab('ai'); runLLMProof(); });
  $('#btn-fit')?.addEventListener('click', () => fitView());
  $('#btn-zoom-in')?.addEventListener('click', () => zoomAt({ x: S.renderer.w / 2, y: S.renderer.h / 2 }, 1.18));
  $('#btn-zoom-out')?.addEventListener('click', () => zoomAt({ x: S.renderer.w / 2, y: S.renderer.h / 2 }, .85));
  $('#btn-grid')?.addEventListener('click', () => { S.state.settings.grid = !S.state.settings.grid; afterMutation(); });
  $('#btn-command')?.addEventListener('click', openCmdk);
  $('#btn-collapse-inspector')?.addEventListener('click', () => {
    const ins = $('#inspector'); ins.classList.add('hidden'); ins.classList.remove('mobile-open');
    const btn = document.createElement('button'); btn.className = 'round-btn'; btn.id = 'restore-inspector'; btn.title = '展开面板'; btn.style.cssText = 'position:absolute;top:64px;right:14px;z-index:20'; btn.innerHTML = svg('layers');
    btn.addEventListener('click', () => { ins.classList.remove('hidden'); btn.remove(); });
    $('#stage').appendChild(btn);
  });
  $$('#inspector-tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  const doc = $('#doc-name');
  doc?.addEventListener('change', () => { S.state.docName = doc.value.trim() || '未命名画板'; scheduleAutosave(); toast('画板已重命名'); });
  doc?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doc.blur(); });
  $('#file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text(); importJSON(text); e.target.value = '';
  });
  const canvas = $('#board');
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', () => { if (!S.ui.drag && !S.ui.pan) { S.ui.hover = null; requestRender(); } });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDoubleClick);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    if (cmdkKey(e)) return;
    keydown(e);
  });
  document.addEventListener('keyup', keyup);
  document.addEventListener('pointerup', () => { if (S.ui.pan) { S.ui.pan = null; setCursor(S.ui.tool === 'select' ? 'default' : 'crosshair'); } });
  window.addEventListener('beforeunload', () => { if (S.state) saveSession(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveSession(true); });
  $('#cmdk-input')?.addEventListener('input', (e) => { S.ui.commandIndex = 0; renderCmdk(e.target.value); });
  $('#cmdk')?.addEventListener('pointerdown', (e) => { if (e.target.id === 'cmdk') closeCmdk(); });
}
function openShortcuts() {
  modal(`<div class="modal-head"><div><span class="eyebrow">REFERENCE</span><h3>快捷键与操作</h3></div><button class="icon-btn small" data-close>${svg('close')}</button></div>
    <div class="modal-body"><div class="shortcut-grid">${[['V / P / L / S', '选择 / 点 / 线 / 线段'], ['C / T', '圆 / 三角形'], ['Space + 拖动', '平移画布'], ['滚轮', '缩放'], ['F', '适应视图'], ['G / A', '网格 / 坐标轴'], ['Ctrl+Z / ⇧Z', '撤销 / 重做'], ['Ctrl+S', '保存'], ['Ctrl+O', '导入'], ['Ctrl+E', '导出'], ['Ctrl+K', '命令面板'], ['Ctrl+A', '全选几何对象'], ['Ctrl+Enter', '运行 AI 分析'], ['Delete', '删除选中'], ['Esc', '取消当前操作']].map(([k, v]) => `<div class="shortcut-row"><span>${v}</span><kbd>${k}</kbd></div>`).join('')}</div></div><div class="modal-foot"><button class="btn primary" data-close>知道了</button></div>`);
}
async function warmScan() {
  if (!S.state || S.ui.scanStatus === 'scanning') return;
  try {
    const result = await scanRelations(buildSnapshot(S.state), { categories: [...S.ui.relationCats], max: 120 });
    S.ui.relations = result.relations || []; S.ui.scanMs = result.ms || 0; S.ui.scanStatus = 'done';
    if (S.ui.tab === 'explore') renderExplorePanel();
  } catch (e) { console.warn(e); }
}
function applyAccessVisibility() {
  document.body.dataset.local = LOCAL_CLIENT ? '1' : '0';
  // The public tunnel is a sharing surface; local-only tools stay on 127.0.0.1.
  if (!LOCAL_CLIENT) {
    for (const sel of ['#btn-ai', '#btn-logs', '#inspector-tabs button[data-tab="ai"]', '#inspector-tabs button[data-tab="complex"]', '#mobile-toolbar [data-mtool="logs"]']) {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    }
  }
  document.querySelectorAll('[data-quick="ai"], [data-quick="library"]').forEach((el) => el.remove());
}

async function init() {
  applyAccessVisibility();
  initWorker();
  try { S.ui.theme = localStorage.getItem('geomind:theme') || 'ink'; } catch {}
  document.body.dataset.theme = S.ui.theme === 'light' ? 'light' : 'ink';
  const saved = loadSession();
  if (saved) {
    S.state = saved.state;
    S.ui.goal = saved.goal; S.ui.proof = saved.proof; S.ui.scenarioId = saved.scenarioId; S.ui.tab = saved.tab || 'triangle';
    S.ui.activeTriangle = S.state.objects.find((o) => o.type === 'triangle' && o.valid)?.id || null;
    if (!S.ui.proof && S.ui.scenarioId && PROOFS[S.ui.scenarioId]) S.ui.proof = PROOFS[S.ui.scenarioId];
  } else {
    const built = basicTriangleScene();
    S.state = built.state; S.ui.goal = null; S.ui.proof = null; S.ui.scenarioId = null; S.ui.tab = 'triangle';
    S.ui.activeTriangle = built.triangle?.id || null;
  }
  applyCompactVisuals(S.state);
  recompute(S.state);
  S.renderer = new Renderer($('#board'), S.state);
  if (!saved) { fitView({ padding: 100, maxScale: 105 }); }
  else if (!S.state.view.cx && !S.state.view.cy) centerView(92);
  $$('#inspector-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === S.ui.tab));
  bindGlobalEvents();
  renderAll();
  const qs = new URLSearchParams(location.search);
  const qScenario = qs.get('scenario');
  if (qScenario && scenarioById(qScenario)) setTimeout(() => loadScenario(qScenario), 0);
  checkBackend();
  updateHistoryButtons();
  setTool('select');
  if (!saved) { setTimeout(() => warmScan(), 900); }
  else if (!S.ui.relations.length) setTimeout(() => warmScan(), 1200);
  setTimeout(() => { if (!S.ui.scanStatus || S.ui.scanStatus === 'idle') warmScan(); }, 2200);
  console.info('%cGeoMind v1.0','color:#ff7a59;font-weight:bold','AI competition geometry workbench ready.');
}

init().catch((err) => { console.error(err); document.body.innerHTML = `<div style="padding:40px;color:#fff;font-family:monospace">GeoMind 启动失败：${esc(err.message)}</div>`; });
