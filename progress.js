import { clampPct, applyState, classify, setBar } from './utils.js';

export function updateCountEl(gState, scope, step, sub) {
  if (scope === 'step') {
    var el = document.querySelector('summary .counts[data-scope="step"][data-step="' + step + '"]');
    var c = gState.counts.steps[step] || { done: 0, total: 0 };
    if (el) {
      el.textContent = '(' + c.done + '/' + c.total + ')';
      applyState(el, classify(c.done, c.total));
    }
  } else if (scope === 'sub') {
    var el2 = document.querySelector('summary .counts[data-scope="sub"][data-step="' + step + '"][data-substep="' + sub + '"]');
    var c2 = gState.counts.subs[step + '.' + sub] || { done: 0, total: 0 };
    if (el2) {
      el2.textContent = '(' + c2.done + '/' + c2.total + ')';
      applyState(el2, classify(c2.done, c2.total));
    }
  }
}

export function renderAllCounts(gState) {
  Object.keys(gState.counts.steps).forEach(function (step) { updateCountEl(gState, 'step', step); });
  Object.keys(gState.counts.subs).forEach(function (k) { var p = k.split('.'); updateCountEl(gState, 'sub', p[0], p[1]); });
}

export function pct(done, total) { return clampPct(done, total); }

export function updateProgressBars(gState) {
  // Global
  (function () {
    var aggDone = 0, aggTotal = 0;
    Object.keys(gState.counts.steps).forEach(function (k) { var c = gState.counts.steps[k]; aggDone += c.done; aggTotal += c.total; });
    var elWrap = document.querySelector('.global-progress .progress');
    var elText = document.querySelector('.global-progress .progress-text');
    if (elWrap) setBar(elWrap, aggDone, aggTotal);
    if (elText) elText.textContent = aggDone + ' solved of ' + aggTotal + ' (' + pct(aggDone, aggTotal) + '%)';
  })();

  // Steps
  Object.keys(gState.counts.steps).forEach(function (step) {
    var c = gState.counts.steps[step];
    var wrap = document.querySelector('.progress.step[data-step="' + step + '"]');
    setBar(wrap, c.done, c.total);
  });
  // Substeps
  Object.keys(gState.counts.subs).forEach(function (k) {
    var c2 = gState.counts.subs[k];
    var parts = k.split('.');
    var wrap2 = document.querySelector('.progress.sub[data-step="' + parts[0] + '"][data-substep="' + parts[1] + '"]');
    setBar(wrap2, c2.done, c2.total);
  });
}

