// Progress/UI helpers
export const STATES = ['is-neutral','is-low','is-mid','is-high','is-done'];
export function clampPct(done, total) {
  if (!total) return 0;
  var p = Math.round((done / total) * 100);
  if (p < 0) p = 0; else if (p > 100) p = 100;
  return p;
}
export function classify(done, total) {
  var p = total ? (done / total) : 0;
  if (total === 0 || p === 0) return 'is-neutral';
  if (p > 0 && p <= 0.33) return 'is-low';
  if (p > 0.33 && p <= 0.66) return 'is-mid';
  if (p > 0.66 && p < 1) return 'is-high';
  return 'is-done';
}
export function applyState(el, state) {
  if (!el) return;
  for (var i = 0; i < STATES.length; i++) el.classList.remove(STATES[i]);
  el.classList.add(state);
}
export function setBar(wrapEl, done, total) {
  if (!wrapEl) return;
  var bar = wrapEl.querySelector('.bar');
  if (bar) bar.style.width = clampPct(done, total) + '%';
  applyState(wrapEl, classify(done, total));
}

// DOM helpers
export function qs(sel, root) { return (root || document).querySelector(sel); }
export function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
export function on(el, evt, fn, opts) { el && el.addEventListener(evt, fn, opts || false); }
