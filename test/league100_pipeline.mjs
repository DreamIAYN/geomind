/* End-to-end vision benchmark with the same auto-repair loop as the browser.
 *
 *   node test/league100_pipeline.mjs --start 1 --end 20 --jobs 3
 *
 * For every problem it calls /api/vision, builds the board locally, validates
 * point dependencies and the claimed conditions, and asks the model to repair
 * up to two times when validation fails.  Results are written to
 * data/league100/pipeline/<NNN>.json for offline analysis.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildVisionState, validateVisionState } from '../js/vision.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DATA = path.join(ROOT, 'data/league100');
const OUT = path.join(DATA, 'pipeline');
const API = process.env.VISION_API || 'http://127.0.0.1:4174/api/vision';
const index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
const byN = new Map(index.map((x) => [x.n, x]));

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, a) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), a[i + 1]]);
  return acc;
}, []));
const start = Number(args.start || 1);
const end = Number(args.end || 100);
const jobs = Math.max(1, Number(args.jobs || 3));
const maxRepairs = Number(args.repairs || 2);
const force = args.force === 'true' || args.force === undefined;

function b64(n) {
  return 'data:image/png;base64,' + fs.readFileSync(path.join(DATA, `p${String(n).padStart(3, '0')}.png`)).toString('base64');
}

async function callVision(text, image) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text || undefined, image: image ? b64(image) : undefined }),
  });
  return r.json();
}

function evaluate(data) {
  if (!data?.construction?.length && !data?.points?.length) return { built: null, issues: ['没有构造'] };
  let built = null;
  try { built = buildVisionState(data); } catch (e) { return { built: null, issues: ['构图执行异常：' + e.message] }; }
  if (!built) return { built: null, issues: ['构图执行失败'] };
  let issues = [];
  try { issues = validateVisionState(built, data); } catch (e) { issues = ['校验异常：' + e.message]; }
  return { built, issues };
}

async function one(n) {
  const item = byN.get(n);
  const dst = path.join(OUT, `${String(n).padStart(3, '0')}.json`);
  if (fs.existsSync(dst) && !force) {
    const prev = JSON.parse(fs.readFileSync(dst, 'utf8'));
    return { n, skipped: true, ok: prev.ok, issues: prev.issuesAfter?.length ?? -1 };
  }
  const t0 = Date.now();
  let r = await callVision(item.text, n);
  const attempts = [{ ok: r.ok, elapsedMs: r.elapsedMs }];
  if (!r.ok) {
    fs.writeFileSync(dst, JSON.stringify({ n, ok: false, error: r.error, attempts }, null, 1));
    return { n, ok: false, issues: -1, error: r.error };
  }
  let data = r.data;
  let { built, issues } = evaluate(data);
  const isBlocking = (arr) => (arr || []).filter((x) => !String(x).startsWith('⚠'));
  const issuesBefore = issues.slice();
  let repairs = 0;
  let prevJson = JSON.stringify(data).slice(0, 12000);
  while (isBlocking(issues).length && repairs < maxRepairs) {
    repairs += 1;
    const repairText = '【修复任务，必须执行】上一版几何构图经过程序校验后失败。请对照原图逐条修复下列问题，'
      + '不要原样返回上一版；只改有问题的点/构造，保留其余正确部分，最后输出完整 JSON（不是补丁）。\n'
      + '\n【题目原文】\n' + item.text
      + '\n\n【上一次构图 JSON】\n' + prevJson
      + '\n\n【自动校验发现的问题】\n- ' + issues.slice(0, 12).join('\n- ')
      + '\n\n修复要求：所有有定义的点使用派生构造；每个交点/圆上点必须有 coordinate；'
      + '所有 deps 必须有对应对象；两个圆没有交点时，调整自由点坐标使图形可行，或改用满足题设的构造。';
    const rr = await callVision(repairText, n);
    attempts.push({ ok: rr.ok, elapsedMs: rr.elapsedMs, repair: repairs });
    if (!rr.ok) { issues.push('修复请求失败：' + rr.error); break; }
    data = rr.data;
    prevJson = JSON.stringify(data).slice(0, 12000);
    ({ built, issues } = evaluate(data));
  }
  const out = {
    n, ok: true, title: data.title, goal: built?.goal?.kind || null,
    points: built?.state?.objects?.filter((o) => o.type === 'point').length || 0,
    invalid: built?.state?.objects?.filter((o) => o.type === 'point' && !o.valid).map((o) => o.label) || [],
    free: built?.state?.objects?.filter((o) => o.type === 'point' && o.sub === 'free').map((o) => o.label) || [],
    notes: built?.state?.meta?.visionNotes || [],
    issuesBefore, issuesAfter: issues,
    repairs, attempts, data,
    seconds: Math.round((Date.now() - t0) / 1000),
  };
  fs.writeFileSync(dst, JSON.stringify(out, null, 1));
  return { n, ok: true, issues: issues.length, before: issuesBefore.length, repairs, invalid: out.invalid.length };
}

fs.mkdirSync(OUT, { recursive: true });
const nums = [];
for (let n = start; n <= end; n++) nums.push(n);
let done = 0, clean = 0, apiFail = 0;
const queue = nums.slice();
const workers = Array.from({ length: jobs }, async () => {
  while (queue.length) {
    const n = queue.shift();
    try {
      const r = await one(n);
      done += 1;
      if (r.skipped) { if (r.issues === 0) clean += 1; continue; }
      if (!r.ok) { apiFail += 1; console.log(`[${n}] API_FAIL ${r.error}`); continue; }
      if (r.issues === 0) clean += 1;
      console.log(`[${n}] issues ${r.before}->${r.issues} repairs=${r.repairs} invalid=${r.invalid}`);
    } catch (e) {
      console.log(`[${n}] ERROR ${e.message}`);
    }
  }
});
await Promise.all(workers);
console.log(`done ${done}/${nums.length} clean=${clean} apiFail=${apiFail}`);
