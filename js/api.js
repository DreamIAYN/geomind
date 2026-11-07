/* GeoMind · backend client with cancellation and graceful offline fallback */
const DEFAULT_TIMEOUT = 9000;

export async function request(path, { method = 'GET', body = null, timeout = DEFAULT_TIMEOUT, signal = null } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { ok: false, error: text.slice(0, 200) }; }
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('请求超时：后端没有及时响应');
    if (e instanceof TypeError) throw new Error('网络连接失败：无法连接后端（服务可能已重启或网络中断）');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function health() { return request('/api/health', { timeout: 2500 }); }
export function verify(payload, signal) { return request('/api/verify', { method: 'POST', body: payload, timeout: 12000, signal }); }
export function generate(payload = {}, signal) { return request('/api/generate', { method: 'POST', body: payload, timeout: 15000, signal }); }

export function ocr(payload, signal) { return request('/api/ocr', { method: 'POST', body: payload, timeout: 30000, signal }); }
export function vision(payload, signal) { return request('/api/vision', { method: 'POST', body: payload, timeout: 300000, signal }); }
export function visionReview(payload, signal) { return request('/api/vision/review', { method: 'POST', body: payload, timeout: 330000, signal }); }
export async function proof(payload, signal) {
  let started = null;
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      started = await request('/api/proof/start', { method: 'POST', body: payload, timeout: 30000, signal });
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  if (!started) throw new Error((lastErr?.message || '证明任务启动失败') + '。请确认后端仍在运行后重试。');
  if (!started.ok || !started.jobId) throw new Error(started.error || '证明任务启动失败');
  const deadline = Date.now() + 900000;
  let netFails = 0;
  for (;;) {
    if (Date.now() > deadline) throw new Error('证明生成超时（15 分钟），请重试');
    await new Promise((resolve) => setTimeout(resolve, 1800));
    let r;
    try {
      r = await request('/api/proof/status?job=' + encodeURIComponent(started.jobId), { timeout: 20000, signal });
      netFails = 0;
    } catch (e) {
      netFails++;
      if (netFails >= 5) throw new Error('证明过程中后端连接中断（服务可能重启）。请重试；本次任务已丢失。');
      continue;
    }
    if (!r.ok) throw new Error((r.error || '证明任务状态读取失败') + '。服务可能已重启，请重试。');
    if (r.status === 'done') return r.result;
  }
}

export function clientLog(payload, signal) { return request('/api/client-log', { method: 'POST', body: payload, timeout: 8000, signal }); }
export function complexProve(payload, signal) { return request('/api/complex/symbolic', { method: 'POST', body: payload, timeout: 60000, signal }); }
export function figurePDF(payload, signal) { return request('/api/figure/pdf', { method: 'POST', body: payload, timeout: 120000, signal }); }
export function logs(limit = 60) { return request('/api/logs?limit=' + limit, { timeout: 8000 }); }
