import { runDetection } from './relations.js';

self.onmessage = (event) => {
  const { type, requestId, snapshot, options } = event.data || {};
  if (type !== 'scan') return;
  try {
    self.postMessage({ type: 'progress', requestId, phase: 'scan', progress: 0.2 });
    const result = runDetection(snapshot, options || {});
    self.postMessage({ type: 'result', requestId, result });
  } catch (err) {
    self.postMessage({ type: 'error', requestId, error: String(err && err.message || err) });
  }
};
